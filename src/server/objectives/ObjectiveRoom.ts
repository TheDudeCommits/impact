import {LAG_COMPENSATION} from '../../game/simulation';
import { requireRosterProtocol, type RosterProtocolOptions } from '../../game/rosterProtocol';
import { isReleasedFighter } from '../../game/rosterAvailability';
import {RoomRewards} from '../economy/RoomRewards';
import {DEFENCES,type DefenceId} from '../../game/objectives/lastStand';
import {AssetGate} from '../social/AssetGate';
import {CustomLobby} from '../social/CustomLobby';
import {PartyStart,PARTY_COUNTDOWN} from '../social/PartyStart';
import {votedArena,customRules,type CustomRules} from '../../game/social/custom';
import {Room,type Client,type FixedTimestepCallback} from 'colyseus';
import {MOVES,SIMULATION_HZ,SNAPSHOT_HZ} from '../../game/moves';
import type {FighterId} from '../../game/types';
import {buildCollision,createRapierCollision} from '../../game/rapierCollision';
import {ObjectiveMatch} from '../../game/objectives/ObjectiveMatch';
import {CAPACITY,OBJECTIVE_PROTOCOL,OBJECTIVE_STAGE,RULES,factionOf,isBadBloodFighter,isObjectiveKind,isRole,type ObjectiveAccess,type ObjectiveKind,type ObjectiveSnapshot,type RolePreference} from '../../game/objectives/model';
import {InputQueue} from '../InputQueue';
import {StepClock} from '../StepClock';
import {SoloPause} from '../SoloPause';
import {privateCodes,PRIVATE_WAIT_SECONDS} from '../privateCodes';
import {roomName,sharedEconomy} from '../economy/api';
import {freshAccount} from '../cluster/economyLink';
import {lockedOut} from '../../game/economy/fighters';
import {owns} from '../../game/economy/account';
import {outfitFor} from '../../game/economy/outfits';
import {RoomFaults} from '../RoomFaults';
import {ResyncGate} from '../ResyncGate';
import {capacity} from '../capacity';
import type {RoomException,RoomMethodName} from 'colyseus';
interface Options extends RosterProtocolOptions {objective?:unknown;access?:unknown;role?:unknown;fighter?:unknown;name?:unknown;code?:unknown;creationToken?:unknown;account?:string;rules?:unknown;assetGate?:boolean;objectiveProtocol?:number;
  party?:unknown;fill?:unknown;}
export class ObjectiveRoom extends Room {
  private rewards=new RoomRewards();
  game!:ObjectiveMatch;
  private kind!:ObjectiveKind;
  private access!:ObjectiveAccess;
  private queues=new Map<string,InputQueue>();
  private rejected=new Set<string>();
  private code?:string;
  private nonce?:string;
  private autoStartAt=Infinity;
  private dropped=new Set<string>();
  private loop=0;
  private expired=false;
  private custom?:CustomLobby;
  private partyStart=new PartyStart(undefined,0);
  private assets!:AssetGate;
  private pause?:SoloPause;
  private faults=new RoomFaults(this);
  private resync?:ResyncGate;
  async onCreate(options:Options={}){
    requireRosterProtocol(options.rosterProtocol);
    if(options.assetGate&&options.objectiveProtocol!==OBJECTIVE_PROTOCOL)throw new Error('Refresh Impact to load the updated team modes.');
    if(!isObjectiveKind(options.objective))throw new Error('Choose Last Stand or Bad Blood.');this.kind=options.objective;
    if(!['quick','bots','solo','host'].includes(String(options.access)))throw new Error('Choose how to enter the mode.');this.access=options.access as ObjectiveAccess;
    if(this.access!=='quick'){
      if(typeof options.creationToken!=='string'||!/^[-0-9a-f]{36}$/i.test(options.creationToken))throw new Error('Create this room from the mode menu.');
      this.nonce=options.creationToken;
    }
    capacity.admit(this);
    this.code=privateCodes.allocate();this.roomId='objective-'+this.code;this.maxClients=(this.access==='bots'||this.access==='solo')?1:CAPACITY[this.kind];this.maxMessagesPerSecond=320;this.autoDispose=true;
    try{
      const rules=customRules(this.kind,this.access==='host'?options.rules:undefined);
      this.game=new ObjectiveMatch(this.kind,await createRapierCollision(OBJECTIVE_STAGE[this.kind]),this.seed(),this.access,1,rules);this.game.view.code=this.code;this.game.sim.rewind=LAG_COMPENSATION;
      this.placeNamed(rules.arena);
      if(this.access==='host'){this.partyStart=new PartyStart(options.party,CAPACITY[this.kind]);if(this.partyStart.party&&this.kind==='last-stand'&&options.fill===true)this.game.view.fillBots=true;}
      if(this.access!=='quick')await this.setPrivate(true);
      await this.setMetadata({objective:this.kind,access:this.access,mode:'objective',map:this.game.sim.stage});
    }catch(error){privateCodes.release(this.code);capacity.release(this);this.game?.dispose();throw error;}
    if(this.access==='host')this.custom=new CustomLobby(this,this.kind,options.rules,()=>this.game.view.hostId,()=>this.game.view.phase==='lobby');
    this.onMessage('assign-team',(client,data:unknown)=>{
      if(!this.custom||client.sessionId!==this.game.view.hostId||this.game.view.phase!=='lobby'||!data||typeof data!=='object')return;
      const {id,role}=data as {id?:unknown;role?:unknown};if(typeof id==='string'&&isRole(role)&&!this.game.role(id,role))client.send('notice',{message:'That team is full. Move a fighter to the other team first.'});
    });
    this.onMessage('objective-buy',(client,item:unknown)=>{const error=this.game.buy(client.sessionId,item);if(error)client.send('notice',{message:error});else client.send('notice',{message:`${DEFENCES[item as DefenceId].name} purchased for the village.`});});
    this.onMessage('objective-fill',(client,fill:unknown)=>{if(!this.game.setFill(client.sessionId,fill))client.send('notice',{message:'Only the host can choose allies before starting.'});});
    this.assets=new AssetGate(this);
    this.pause=new SoloPause({solo:()=>{const humans=[...this.game.seats.values()].filter(seat=>!seat.bot);return humans.length===1?humans[0].id:undefined;},
      open:()=>this.game.view.phase==='countdown'||this.game.view.phase==='active',queued:id=>this.queues.get(id)?.length??0,
      frozen:()=>{for(const queue of this.queues.values())queue.clear();this.sendSnapshots();},thawed:ms=>{this.assets.shift(ms);this.sendSnapshots();},beat:()=>this.sendSnapshots()});
    this.onMessage('pause',(client,raw:unknown)=>this.pause?.request(client,raw,true));
    this.onMessage('resume',(client,raw:unknown)=>this.pause?.request(client,raw,false));
    this.onMessage('input',(client,raw:unknown)=>{if(this.pause?.frozen)return;if(this.queues.get(client.sessionId)?.push(raw)||this.rejected.has(client.sessionId))return;this.rejected.add(client.sessionId);client.send('input-rejected',{reason:'Invalid, stale or excess input'});});
    this.resync=new ResyncGate(this,client=>{this.rejected.delete(client.sessionId);this.queues.get(client.sessionId)?.clear();this.game.sim.clearPlayerInput(client.sessionId);client.send('input-resync',this.forOwner(this.game.snapshot(),client.sessionId));});
    this.onMessage('objective-start',client=>{if(client.sessionId!==this.game.view.hostId){client.send('notice',{message:'Only the host can start the match.'});return;}this.begin();});
    this.onMessage('objective-role',(client,role:unknown)=>{if(!isRole(role)||!this.game.role(client.sessionId,role))client.send('notice',{message:'That role is full, or the match has already started.'});});
    this.onMessage('objective-rematch',client=>{if(client.sessionId===this.game.view.hostId&&this.game.view.phase==='over')this.rematch();else client.send('notice',{message:'The host can open a rematch after this match ends.'});});
    this.onMessage('account',(client,token:unknown)=>freshAccount(token,()=>this.dress(client,token),()=>this.clients.includes(client)));
    this.onMessage('ping',(client,raw:unknown)=>{if(typeof raw==='number'&&Number.isFinite(raw))client.send('pong',{clientTime:raw,serverTime:this.game.sim.serverTime});});
    this.setFixedTimestep(({dt})=>this.faults.guard(()=>this.tick(dt)),SIMULATION_HZ);
  }
  private seed(){return Math.random()*0x7fffffff|0||1;}
  private placeNamed(arena:CustomRules['arena']|undefined){if(arena&&arena!=='auto'&&arena!=='vote'&&arena!==this.game.sim.stage)this.game.sim.setStage(arena,buildCollision(arena));}
  onAuth(_client:Client,options:Options={}){requireRosterProtocol(options.rosterProtocol);
    if(options.assetGate&&options.objectiveProtocol!==OBJECTIVE_PROTOCOL)throw new Error('Refresh Impact to load the updated team modes.');
    if(!this.game||this.expired||this.game.view.phase!=='lobby')throw new Error('This match has already started or expired.');
    if(options.objective!==this.kind)throw new Error('This code belongs to the other game mode.');
    if(options.fighter!==undefined&&(typeof options.fighter!=='string'||!isReleasedFighter(options.fighter)))throw new Error('Fighter is not available.');
    if(this.kind==='bad-blood'){
      if(!isBadBloodFighter((options.fighter??'goku') as FighterId))throw new Error('Choose a fighter from the Bad Blood roster.');
      const faction=factionOf((options.fighter??'goku') as FighterId);
      if(isRole(options.role)&&options.role!=='auto'&&options.role!==faction)throw new Error('Choose a fighter from your selected faction.');
      if([...this.game.seats.values()].filter(s=>s.team===faction).length>=3)throw new Error('That faction is full. Choose a fighter from the other side.');
    }
    const locked=lockedOut((options.fighter??'goku') as FighterId,sharedEconomy()?.book.find(options.account));if(locked)throw new Error(locked);
    if(this.access!=='quick'&&options.code!==this.code&&options.creationToken!==this.nonce)throw new Error('Enter the six-digit room code.');
    return true;
  }
  onJoin(client:Client,options:Options={}){
    this.onAuth(client,options);this.assets.add(client,options.assetGate);
    this.game.add(client.sessionId,(options.fighter??'goku') as FighterId,roomName(options.account,options.name,18),isRole(options.role)?options.role:'auto');
    this.queues.set(client.sessionId,new InputQueue());this.dress(client,options.account);this.rewards.bind(client.sessionId,options.account);
    if(this.autoStartAt===Infinity&&this.access!=='host')this.autoStartAt=this.game.sim.serverTime+((this.access==='bots'||this.access==='solo')?RULES.soloWait:RULES.quickWait);
    client.send('welcome',{playerId:client.sessionId,roomId:this.roomId,mode:this.kind,tickRate:SIMULATION_HZ,snapshotRate:SNAPSHOT_HZ});client.send('snapshot',this.forOwner(this.game.snapshot(),client.sessionId));
  }
  private dress(client:Client,token:unknown){
    this.rewards.bind(client.sessionId,token);
    const account=sharedEconomy()?.book.find(token),state=this.game.sim.actors.get(client.sessionId)?.state;if(!account||!state)return;
    const outfit=account.worn.outfits?.[state.fighter];state.outfit=outfit&&owns(account,outfit)&&outfitFor(outfit,state.fighter)?outfit:undefined;
  }
  private begin(){if(this.dropped.size){this.broadcast('notice',{message:'Waiting for a disconnected player to reconnect.'});return;}if(this.custom){Object.assign(this.game.rules,this.custom.view.rules);const stage=votedArena(this.custom.view,OBJECTIVE_STAGE[this.kind]);if(stage!==this.game.sim.stage)this.game.sim.setStage(stage,buildCollision(stage));}if(this.game.start()){this.partyStart.started();void this.lock();}}
  private tick(dt:number){
    if(this.pause?.hold())return;
    if(this.game.view.phase==='lobby'){
      if(this.partyStart.waiting&&this.autoStartAt===Infinity&&this.partyStart.complete(this.queues.size,this.dropped.size)&&this.assets.ready(this.game.snapshot()))this.autoStartAt=this.game.sim.serverTime+PARTY_COUNTDOWN;
      if(this.game.sim.serverTime>=PRIVATE_WAIT_SECONDS){this.expired=true;this.broadcast('notice',{message:'This room expired. Create a new room.'});void this.disconnect(4004);return;}
      if(!this.dropped.size&&this.queues.size&&(this.game.sim.serverTime>=this.autoStartAt||this.access==='quick'&&this.queues.size>=this.maxClients))this.begin();
    }
    const waiting=new Set<string>();for(const [id,queue] of this.queues){const input=queue.take();if(input){this.game.submit(id,input);this.rewards.input(id,input);}else waiting.add(id);}
    if(this.game.view.phase==='countdown'&&!this.assets.ready(this.game.snapshot()))this.game.view.startsAt=this.game.sim.serverTime+RULES.countdown;
    try{this.game.step(dt,waiting);}catch(error){this.faults.fault(error);}
    if(this.game.sim.tick%(SIMULATION_HZ/SNAPSHOT_HZ)===0)this.sendSnapshots();
  }
  private sendSnapshots(){const snapshot=this.game.snapshot(true);this.rewards.observe(snapshot);for(const client of this.clients)client.send('snapshot',this.forOwner(snapshot,client.sessionId));}
  private forOwner(snapshot:ObjectiveSnapshot,id:string):ObjectiveSnapshot{
    snapshot=this.rewards.forOwner(snapshot,id);
    const checkpoint=this.game.sim.predictionCheckpoint(id);
    return {...snapshot,...(this.pause?{pause:this.pause.view()}:{}),...(this.custom?{custom:this.custom.snapshot()}:{}),...(checkpoint?{prediction:{[id]:checkpoint},queued:this.queues.get(id)?.low}:{}),objective:{...snapshot.objective,startsAt:snapshot.objective.phase==='lobby'&&Number.isFinite(this.autoStartAt)?this.autoStartAt:snapshot.objective.startsAt,...this.partyStart.view(this.game.sim.serverTime)}};
  }
  private rematch(){
    if(this.dropped.size){this.broadcast('notice',{message:'Wait for your party to reconnect before rematching.'});return;}
    const old=this.game,seats=[...old.seats.values()].filter(s=>!s.bot),looks=new Map(old.sim.playerStates().map(p=>[p.id,p.outfit]));
    this.game=new ObjectiveMatch(this.kind,buildCollision(OBJECTIVE_STAGE[this.kind]),this.seed(),this.access,old.view.round+1,customRules(this.kind,this.custom?.view.rules));this.rewards.next(this.game.view.round);this.game.view.code=this.code;this.game.sim.rewind=LAG_COMPENSATION;this.game.view.fillBots=old.view.fillBots;
    this.placeNamed(this.custom?.view.rules.arena);
    for(const s of seats){this.game.add(s.id,s.fighter,s.name,s.team as RolePreference);this.game.sim.actors.get(s.id)!.state.outfit=looks.get(s.id);}
    this.autoStartAt=this.access==='host'?Infinity:this.game.sim.serverTime+(this.access==='bots'||this.access==='solo'?RULES.soloWait:RULES.quickWait);old.dispose();
    this.rejected.clear();for(const [id,q] of this.queues){q.clear();const client=this.clients.find(c=>c.sessionId===id);client?.send('input-resync',this.forOwner(this.game.snapshot(),id));}
    void this.unlock();
  }
  async onDrop(client:Client){
    if(!this.game.seats.has(client.sessionId))return;this.dropped.add(client.sessionId);this.queues.get(client.sessionId)?.clear();this.game.disconnect(client.sessionId,true);this.pause?.drop(client.sessionId);
    try{await this.allowReconnection(client,15);}catch{this.onLeave(client);}
  }
  onReconnect(client:Client){this.dropped.delete(client.sessionId);this.rejected.delete(client.sessionId);this.resync?.forget(client.sessionId);this.queues.get(client.sessionId)?.clear();this.game.disconnect(client.sessionId,false);client.send('snapshot',this.forOwner(this.game.snapshot(),client.sessionId));}
  onLeave(client:Client){
    if(this.partyStart.waiting&&this.game?.view.phase==='lobby'){this.partyStart.left();this.autoStartAt=Infinity;}
    this.rewards.leave(client.sessionId);this.custom?.remove(client.sessionId);this.assets.remove(client.sessionId);this.dropped.delete(client.sessionId);this.rejected.delete(client.sessionId);this.resync?.forget(client.sessionId);this.queues.delete(client.sessionId);this.game.remove(client.sessionId);}
  override setFixedTimestep(step:FixedTimestepCallback,hz=SIMULATION_HZ){
    const clock=new StepClock(hz),loop=++this.loop,dt=1/hz;let tick=0,budget=0,pending=false;clock.advance(performance.now());
    const run=()=>{pending=false;if(loop!==this.loop)return;if(budget>0&&clock.take()){budget--;step({dt,dtMs:dt*1000,tick:tick++,subSteps:1,subDt:dt,subDtMs:dt*1000});}if(budget>0&&clock.owed>0&&loop===this.loop){pending=true;setImmediate(run);}};
    this.setTimestep(()=>{if(loop!==this.loop)return;clock.advance(performance.now());budget=StepClock.PER_CALLBACK;if(!pending&&clock.owed>0){pending=true;setImmediate(run);}},1000/hz);
  }
  onUncaughtException(error:RoomException,method:RoomMethodName){this.faults.report(error,method);}
  onDispose(){this.loop++;this.queues.clear();this.rejected.clear();this.resync?.clear();if(this.code)privateCodes.release(this.code);capacity.release(this);this.game?.dispose();}
}
