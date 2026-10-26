import {LAG_COMPENSATION} from '../../game/simulation';
import { requireRosterProtocol, type RosterProtocolOptions } from '../../game/rosterProtocol';
import { isReleasedFighter } from '../../game/rosterAvailability';
import {PartyStart,PARTY_COUNTDOWN} from '../social/PartyStart';
import {Room,type Client,type FixedTimestepCallback,type RoomException,type RoomMethodName} from 'colyseus';
import {MOVES,SIMULATION_HZ} from '../../game/moves';
import type {FighterId} from '../../game/types';
import {buildCollision,createRapierCollision} from '../../game/rapierCollision';
import {factionOf} from '../../game/objectives/model';
import {snapshotFor} from '../../game/moba/vision';
import {RiftMatch} from '../../game/moba/RiftMatch';
import {RIFT_PROTOCOL,RIFT_RULES,RIFT_STAGE,type RiftSnapshot} from '../../game/moba/model';
import {InputQueue} from '../InputQueue';
import {StepClock} from '../StepClock';
import {SoloPause} from '../SoloPause';
import {AssetGate} from '../social/AssetGate';
import {RoomFaults} from '../RoomFaults';
import {capacity} from '../capacity';
import {privateCodes,PRIVATE_WAIT_SECONDS} from '../privateCodes';
import {roomName,sharedEconomy} from '../economy/api';
import {freshAccount} from '../cluster/economyLink';
import {lockedOut} from '../../game/economy/fighters';
import {owns} from '../../game/economy/account';
import {outfitFor} from '../../game/economy/outfits';
interface Options extends RosterProtocolOptions {party?:unknown;riftProtocol?:unknown;access?:unknown;fighter?:unknown;name?:unknown;code?:unknown;creationToken?:unknown;account?:string;assetGate?:boolean;}
export class RiftRoom extends Room {
  game!:RiftMatch;
  private partyStart=new PartyStart(undefined,0);
  private access:'quick'|'host'='quick';
  private code?:string;
  private nonce?:string;
  private queues=new Map<string,InputQueue>();
  private dropped=new Set<string>();
  private rejected=new Set<string>();
  private commandsAt=new Map<string,number>();
  private resyncAt=new Map<string,number>();
  private assets!:AssetGate;
  private pause?:SoloPause;
  private autoStartAt=Infinity;
  private expired=false;
  private loop=0;
  private faults=new RoomFaults(this);
  async onCreate(options:Options={}) {
    requireRosterProtocol(options.rosterProtocol);
    if(options.riftProtocol!==RIFT_PROTOCOL)throw new Error('Refresh Impact to load Rift War.');
    if(options.access!=='quick'&&options.access!=='host')throw new Error('Choose online matchmaking or a private room.');
    this.access=options.access;
    if(this.access==='host'){
      if(typeof options.creationToken!=='string'||!/^[-0-9a-f]{36}$/i.test(options.creationToken))throw new Error('Create this room from the Rift War menu.');
      this.nonce=options.creationToken;
    }
    capacity.admit(this);
    this.code=privateCodes.allocate();this.roomId='rift-'+this.code;this.maxClients=RIFT_RULES.capacity;this.maxMessagesPerSecond=320;this.autoDispose=true;
    try {
      this.game=new RiftMatch({collision:await createRapierCollision(RIFT_STAGE),seed:this.seed(),access:this.access});this.game.sim.rewind=LAG_COMPENSATION;
      this.game.view.code=this.code;this.partyStart=new PartyStart(options.party,10);
      if(this.access==='host')await this.setPrivate(true);
      await this.setMetadata({mode:'rift-war',access:this.access,map:RIFT_STAGE,heroes:0,villains:0});
    } catch(error) {privateCodes.release(this.code);capacity.release(this);this.game?.dispose();throw error;}
    this.assets=new AssetGate(this);
    this.pause=new SoloPause({solo:()=>{const humans=[...this.game.seats.values()].filter(s=>!s.bot);return humans.length===1?humans[0].id:undefined;},open:()=>this.game.view.phase==='countdown'||this.game.view.phase==='active',queued:id=>this.queues.get(id)?.length??0,frozen:()=>{for(const q of this.queues.values())q.clear();this.sendSnapshots();},thawed:ms=>{this.assets.shift(ms);this.sendSnapshots();},beat:()=>this.sendSnapshots()});
    this.onMessage('pause',(c,data:unknown)=>this.pause?.request(c,data,true));
    this.onMessage('resume',(c,data:unknown)=>this.pause?.request(c,data,false));
    this.onMessage('input',(c,data:unknown)=>{if(this.pause?.frozen)return;if(this.queues.get(c.sessionId)?.push(data)||this.rejected.has(c.sessionId))return;this.rejected.add(c.sessionId);c.send('input-rejected',{reason:'Invalid, stale or excess input'});});
    this.onMessage('resync-input',c=>{const now=performance.now();if(now<(this.resyncAt.get(c.sessionId)??0))return;this.resyncAt.set(c.sessionId,now+500);this.rejected.delete(c.sessionId);this.queues.get(c.sessionId)?.clear();this.game.sim.clearPlayerInput(c.sessionId);c.send('input-resync',this.forOwner(this.game.snapshot(),c.sessionId));});
    this.onMessage('rift-start',(c,payload:unknown)=>{if(this.access!=='host'||c.sessionId!==this.game.view.hostId)return;if(this.access==='host'&&payload&&typeof payload==='object'&&'fillBots' in payload)this.game.setFill(c.sessionId,payload.fillBots);this.begin();});
    this.onMessage('rift-rematch',c=>{if(this.access==='host'&&c.sessionId===this.game.view.hostId&&this.game.view.phase==='over')this.rematch();});
    this.onMessage('rift-buy',(c,item:unknown)=>this.command(c,()=>this.game.buy(c.sessionId,item)));
    this.onMessage('rift-buyback',c=>this.command(c,()=>this.game.buyback(c.sessionId)));
    this.onMessage('rift-recall',c=>this.command(c,()=>this.game.recall(c.sessionId)));
    this.onMessage('rift-ping',(c,lane:unknown)=>this.command(c,()=>this.game.ping(c.sessionId,lane)));
    this.onMessage('account',(c,token:unknown)=>freshAccount(token,()=>this.dress(c,token),()=>this.clients.includes(c)));
    this.onMessage('ping',(c,data:unknown)=>{if(typeof data==='number'&&Number.isFinite(data))c.send('pong',{clientTime:data,serverTime:this.game.sim.serverTime});});
    this.setFixedTimestep(({dt})=>this.faults.guard(()=>this.tick(dt)),SIMULATION_HZ);
  }
  private async updateSeats(){if(this.access==='quick')await this.setMetadata({mode:'rift-war',access:this.access,map:RIFT_STAGE,heroes:[...this.game.seats.values()].filter(s=>s.team==='heroes').length,villains:[...this.game.seats.values()].filter(s=>s.team==='villains').length});}
  private seed(){return Math.random()*0x7fffffff|0||1;}
  private command(client:Client,fn:()=>unknown){
    const now=performance.now();if(now<(this.commandsAt.get(client.sessionId)??0))return;
    this.commandsAt.set(client.sessionId,now+120);const error=fn();if(typeof error==='string')client.send('notice',{message:error});
  }
  onAuth(_client:Client,options:Options={}){requireRosterProtocol(options.rosterProtocol);
    if(options.riftProtocol!==RIFT_PROTOCOL)throw new Error('Refresh Impact to load Rift War.');
    if(!this.game||this.expired||this.game.view.phase!=='lobby')throw new Error('This war has already started or expired.');
    if(typeof options.fighter!=='string'||!isReleasedFighter(options.fighter))throw new Error('Choose an available fighter.');
    const fighter=options.fighter as FighterId,team=factionOf(fighter);
    if([...this.game.seats.values()].filter(s=>s.team===team).length>=RIFT_RULES.teamSize)throw new Error('That faction is full. Choose a fighter from the other side.');
    const locked=lockedOut(fighter,sharedEconomy()?.book.find(options.account));if(locked)throw new Error(locked);
    if(this.access==='host'&&options.code!==this.code&&options.creationToken!==this.nonce)throw new Error('Enter the six-digit room code.');
    return true;
  }
  onJoin(client:Client,options:Options={}){
    this.onAuth(client,options);this.assets.add(client,options.assetGate);
    this.game.add(client.sessionId,options.fighter as FighterId,roomName(options.account,options.name,18));this.queues.set(client.sessionId,new InputQueue());this.dress(client,options.account);void this.updateSeats().catch(error=>this.faults.fault(error));
    if(this.access==='quick'&&this.autoStartAt===Infinity)this.autoStartAt=this.game.sim.serverTime+20;
    client.send('welcome',{playerId:client.sessionId,roomId:this.roomId,mode:'rift-war',tickRate:SIMULATION_HZ,snapshotRate:RIFT_RULES.snapshotHz});
    client.send('snapshot',this.forOwner(this.game.snapshot(),client.sessionId));
  }
  private dress(client:Client,token:unknown){const account=sharedEconomy()?.book.find(token),state=this.game.sim.actors.get(client.sessionId)?.state;if(!account||!state)return;const outfit=account.worn.outfits?.[state.fighter];state.outfit=outfit&&owns(account,outfit)&&outfitFor(outfit,state.fighter)?outfit:undefined;}
  private begin(){if(this.dropped.size){this.broadcast('notice',{message:'Waiting for a teammate to reconnect.'});return;}if(this.game.start()){this.partyStart.started();void this.lock();}else if(this.game.view.phase==='lobby')this.broadcast('notice',{message:'Each side needs a fighter. Enable bots to fill the teams.'});}
  private tick(dt:number){
    if(this.pause?.hold())return;
    if(this.game.view.phase==='lobby'){
      if(this.partyStart.waiting&&this.autoStartAt===Infinity&&this.partyStart.complete(this.queues.size,this.dropped.size)&&this.assets.ready(this.game.snapshot()))this.autoStartAt=this.game.sim.serverTime+PARTY_COUNTDOWN;
      if(this.game.sim.serverTime>=PRIVATE_WAIT_SECONDS){this.expired=true;this.broadcast('notice',{message:'This room expired. Start a new war.'});void this.disconnect(4004);return;}
      if((this.access==='quick'||this.partyStart.waiting)&&!this.dropped.size&&this.queues.size&&(this.game.sim.serverTime>=this.autoStartAt||this.queues.size>=this.maxClients))this.begin();
    }
    const waiting=new Set<string>();for(const [id,q] of this.queues){const input=q.take();if(input)this.game.submit(id,input);else waiting.add(id);}
    if(this.game.view.phase==='countdown'&&!this.assets.ready(this.game.snapshot()))this.game.view.startsAt=this.game.sim.serverTime+RIFT_RULES.countdown;
    this.game.step(dt,waiting);
    if(this.game.sim.tick%(SIMULATION_HZ/RIFT_RULES.snapshotHz)===0)this.sendSnapshots();
  }
  private forOwner(snapshot:RiftSnapshot,id:string):RiftSnapshot {
    const checkpoint=this.game.sim.predictionCheckpoint(id);
    return snapshotFor({...snapshot,...(this.pause?{pause:this.pause.view()}:{}),...(checkpoint?{prediction:{[id]:checkpoint},queued:this.queues.get(id)?.low}:{}),rift:{...snapshot.rift,startsAt:snapshot.rift.phase==='lobby'&&Number.isFinite(this.autoStartAt)?this.autoStartAt:snapshot.rift.startsAt,...this.partyStart.view(this.game.sim.serverTime)}},id);
  }
  private sendSnapshots(){const snapshot=this.game.snapshot(true);for(const client of this.clients)client.send('snapshot',this.forOwner(snapshot,client.sessionId));}
  private rematch(){
    if(this.dropped.size){this.broadcast('notice',{message:'Wait for your teammates to reconnect.'});return;}
    const old=this.game,seats=[...old.seats.values()].filter(s=>!s.bot),looks=new Map(old.sim.playerStates().map(p=>[p.id,p.outfit]));
    this.game=new RiftMatch({collision:buildCollision(RIFT_STAGE),seed:this.seed(),access:this.access,round:old.view.round+1});this.game.view.code=this.code;this.game.sim.rewind=LAG_COMPENSATION;
    for(const seat of seats){this.game.add(seat.id,seat.fighter,seat.name);this.game.sim.actors.get(seat.id)!.state.outfit=looks.get(seat.id);}
    old.dispose();this.autoStartAt=this.access==='quick'?this.game.sim.serverTime+10:Infinity;this.rejected.clear();this.commandsAt.clear();this.resyncAt.clear();
    for(const [id,q] of this.queues){q.clear();this.clients.find(c=>c.sessionId===id)?.send('input-resync',this.forOwner(this.game.snapshot(),id));}void this.updateSeats().then(()=>this.unlock()).catch(error=>this.faults.fault(error));
  }
  async onDrop(client:Client){if(!this.game.seats.has(client.sessionId))return;this.dropped.add(client.sessionId);this.queues.get(client.sessionId)?.clear();this.game.disconnect(client.sessionId,true);this.pause?.drop(client.sessionId);try{await this.allowReconnection(client,20);}catch{this.onLeave(client);}}
  onReconnect(client:Client){this.resyncAt.delete(client.sessionId);this.dropped.delete(client.sessionId);this.rejected.delete(client.sessionId);this.queues.get(client.sessionId)?.clear();this.game.disconnect(client.sessionId,false);client.send('input-resync',this.forOwner(this.game.snapshot(),client.sessionId));}
  onLeave(client:Client){if(this.partyStart.waiting&&this.game?.view.phase==='lobby'){this.partyStart.left();this.autoStartAt=Infinity;}this.assets?.remove(client.sessionId);this.dropped.delete(client.sessionId);this.rejected.delete(client.sessionId);this.queues.delete(client.sessionId);this.commandsAt.delete(client.sessionId);this.resyncAt.delete(client.sessionId);this.game?.remove(client.sessionId);void this.updateSeats().catch(error=>this.faults.fault(error));}
  override setFixedTimestep(step:FixedTimestepCallback,hz=SIMULATION_HZ){const clock=new StepClock(hz),loop=++this.loop,dt=1/hz;let tick=0,budget=0,pending=false;clock.advance(performance.now());const run=()=>{pending=false;if(loop!==this.loop)return;if(budget>0&&clock.take()){budget--;step({dt,dtMs:dt*1000,tick:tick++,subSteps:1,subDt:dt,subDtMs:dt*1000});}if(budget>0&&clock.owed>0&&loop===this.loop){pending=true;setImmediate(run);}};this.setTimestep(()=>{if(loop!==this.loop)return;clock.advance(performance.now());budget=StepClock.PER_CALLBACK;if(!pending&&clock.owed>0){pending=true;setImmediate(run);}},1000/hz);}
  onUncaughtException(error:RoomException,method:RoomMethodName){this.faults.report(error,method);}
  onDispose(){this.loop++;this.queues.clear();this.dropped.clear();this.commandsAt.clear();this.resyncAt.clear();if(this.code)privateCodes.release(this.code);capacity.release(this);this.game?.dispose();}
}
