import { roomKit } from './forge/roomKit';
import { requireRosterProtocol, type RosterProtocolOptions } from '../game/rosterProtocol';
import { isReleasedFighter } from '../game/rosterAvailability';
import {draftBots} from '../game/matchmaking';
export {draftBots} from '../game/matchmaking';
import {RoomRewards} from './economy/RoomRewards';
import {DuelSet} from '../game/duel/DuelSet';
import {AssetGate} from './social/AssetGate';
import {CustomLobby} from './social/CustomLobby';
import {PartyStart,PARTY_COUNTDOWN} from './social/PartyStart';
import {BOT_SKILL,customRules,duelStage,votedArena,type CustomLobby as CustomView} from '../game/social/custom';
import { MOVES } from '../game/moves';
import { Room, type Client, type FixedTimestepCallback } from 'colyseus';
import { ArenaSimulation, LAG_COMPENSATION } from '../game/simulation';
import { buildCollision, createRapierCollision } from '../game/rapierCollision';
import { STAGES, RoyaleDeck, DuelDeck, chooseStage, seriesStage, type StageId } from '../game/stages';
import { COMBO_HP, COMBO_STAMINA, KO_HEAL, MAX_PLAYERS, MIN_MATCH_FIELD, SIMULATION_HZ, SNAPSHOT_HZ } from '../game/moves';
import type { FighterId, GameSnapshot, RoomMode } from '../game/types';
import { privateCodes, PRIVATE_WAIT_SECONDS } from './privateCodes';
import {InputQueue} from './InputQueue';
import { roomName, sharedEconomy } from './economy/api';
import { freshAccount } from './cluster/economyLink';
import { outfitFor } from '../game/economy/outfits';
import { lockedOut } from '../game/economy/fighters';
import { owns } from '../game/economy/account';
import {StepClock} from './StepClock';
import {SoloPause} from './SoloPause';
import {ReadyGate,READY_SECONDS,LATE_HOLD_SECONDS} from './ReadyGate';
import {RoomFaults} from './RoomFaults';
import {ResyncGate} from './ResyncGate';
import {netStats} from './netStats';
import {capacity} from './capacity';
import type {RoomException,RoomMethodName} from 'colyseus';

interface JoinOptions extends RosterProtocolOptions { mode?: RoomMode; fighter?: FighterId; name?: string; code?:string; creationToken?:string; players?:number;
  account?: string; rules?:unknown;assetGate?:boolean;
  stage?:unknown;
  party?:unknown;
  readyGate?:boolean;
  forge?:unknown }
export const RECONNECTION_SECONDS = 15;
export const BOT_ROYALE_SIZES = [4, 6, 8, 10, 12] as const;
export const PRIVATE_ROOM_SIZES = [2, 4, 8, 12] as const;
const BOT_ROYALE_COUNTDOWN = 4;
const LOADED_COUNTDOWN = 3;
export const MATCH_COUNTDOWN = 15;
export const SOLO_COUNTDOWN = 20;
export const FINISHED_ROOM_SECONDS = 300;
export const FINISHED_ROOM_CLOSE = 4006;
const royaleDeck = new RoyaleDeck();
const duelDeck = new DuelDeck();
const BOT_NAMES = ['Rival','Challenger','Contender','Duelist','Upstart','Veteran','Prospect','Outsider','Wildcard','Rogue','Drifter'];

export class ArenaRoom extends Room {
  private inputQueues=new Map<string,InputQueue>();
  private rejected=new Set<string>();
  private readyAt:number|null=null;
  private loop=0;
  simulation!: ArenaSimulation;
  private duelSet?:DuelSet;
  private rewards=new RoomRewards();
  private startAt: number | null = null;
  private dropped = new Set<string>();
  protected privateRoom=false;
  private forgeCodes=new Map<string,string>();
  protected duelRoom=false;
  protected botRoom=false;
  private botSeats=0;
  private code?:string;
  private creationToken?:string;
  private hostId:string|null=null;
  private partyStart=new PartyStart(undefined,0);
  private expiring=false;
  private overAt:number|null=null;
  private roomSize?:number;
  private custom?:CustomLobby;
  private assets!:AssetGate;
  private rosterPrepared=false;
  private plannedBots:FighterId[]=[];
  private planKey='';
  private activeAt:number|null=null;
  private pause?:SoloPause;
  private ready?:ReadyGate;
  private faults=new RoomFaults(this);
  private resync?:ResyncGate;

  async onCreate(options: JoinOptions = {}) {
    requireRosterProtocol(options.rosterProtocol);
    const mode: RoomMode = this.duelRoom || this.privateRoom || this.botRoom || options.mode === 'match' ? 'match' : 'training';
    if(this.botRoom){
      const asked=Number(options.players);
      this.botSeats=(BOT_ROYALE_SIZES as readonly number[]).includes(asked)?asked-1:BOT_ROYALE_SIZES[0]-1;
    }
    if(this.privateRoom){
      if(typeof options.creationToken!=='string'||!/^[-0-9a-f]{36}$/i.test(options.creationToken))throw new Error('Create a private room from the lobby.');
      capacity.admit(this);
      this.creationToken=options.creationToken;this.code=privateCodes.allocate();this.roomId=`${this.duelRoom?'duel':'private'}-${this.code}`;
      const asked=Number(options.players);
      if((PRIVATE_ROOM_SIZES as readonly number[]).includes(asked))this.roomSize=asked;
    }else capacity.admit(this);
    if(this.duelRoom){this.roomSize=2;this.duelSet=new DuelSet();}
    this.maxClients = this.botRoom || mode === 'training' ? 1 : this.roomSize ?? MAX_PLAYERS;
    if (this.privateRoom) this.partyStart = new PartyStart(options.party, this.maxClients, 2);
    this.maxMessagesPerSecond = 320;
    this.autoDispose = true;
    try {
      if (mode === 'training') {
        const stage = chooseStage([], mode);
        this.simulation = new ArenaSimulation({ roomMode: mode, stage, collision: await createRapierCollision(stage), maxStamina: COMBO_STAMINA, maxHp: COMBO_HP });
        this.simulation.rewind = LAG_COMPENSATION;
      } else {
        this.simulation = new ArenaSimulation({ roomMode: mode, maxStamina: COMBO_STAMINA, maxHp: COMBO_HP, koHeal: this.duelRoom ? 0 : KO_HEAL });
        this.simulation.rewind = LAG_COMPENSATION;
        const named = this.privateRoom ? customRules('royale', options.rules).arena : 'auto';
        const stage = this.duelRoom ? (this.privateRoom ? duelStage(options.stage) : duelDeck.deal(pool => this.simulation.pick(pool))) : named !== 'auto' && named !== 'vote' ? named : royaleDeck.deal(pool => this.simulation.pick(pool), this.botRoom ? this.botSeats + 1 : undefined);
        this.simulation.setStage(stage, await createRapierCollision(stage));
      }
      const own=this.privateRoom||this.botRoom||mode==='training';
      if(own)await this.setPrivate(true);
      await this.setMetadata({ mode, visibility:own?'private':'public', map: this.simulation.stage, humanCapacity: this.maxClients, botCount: this.botRoom ? this.botSeats : mode === 'training' ? 1 : 0 });
    } catch(error){if(this.code)privateCodes.release(this.code);capacity.release(this);this.simulation?.dispose();throw error;}
    if(this.privateRoom&&!this.duelRoom)this.custom=new CustomLobby(this,'royale',options.rules,()=>this.hostId,()=>this.simulation.status==='waiting'&&this.startAt===null&&!this.rosterPrepared);
    this.assets=new AssetGate(this);
    this.ready=new ReadyGate(this,()=>this.simulation.serverTime);
    this.pause=new SoloPause({solo:()=>this.soloHuman(),open:()=>this.pauseOpen(),queued:id=>this.inputQueues.get(id)?.length??0,
      frozen:()=>{for(const queue of this.inputQueues.values())queue.clear();this.sendSnapshots();},thawed:ms=>{this.assets.shift(ms);this.sendSnapshots();},beat:()=>this.sendSnapshots()});
    this.onMessage('pause',(client,raw:unknown)=>this.pause?.request(client,raw,true));
    this.onMessage('resume',(client,raw:unknown)=>this.pause?.request(client,raw,false));
    this.onMessage('start-private-match',client=>this.requestPrivateStart(client));
    this.onMessage('input', (client, raw: unknown) => {
      if (this.pause?.frozen) return;
      if (this.inputQueues.get(client.sessionId)?.push(raw)) return;
      if (this.rejected.has(client.sessionId)) return;
      this.rejected.add(client.sessionId);
      client.send('input-rejected', { reason: 'Invalid, stale or excess input' });
    });
    this.resync=new ResyncGate(this,client=>{
      this.rejected.delete(client.sessionId);
      this.inputQueues.get(client.sessionId)?.clear();
      this.simulation.clearPlayerInput(client.sessionId);
      client.send('input-resync',this.forOwner(this.snapshot(),client.sessionId));
    });
    this.onMessage('training', (client, command:unknown)=>{this.simulation.trainingCommand(client.sessionId,command);if(this.pause?.frozen)this.sendSnapshots();});
    this.onMessage('account', (client, token: unknown) => freshAccount(token, () => this.dress(client, token), () => this.clients.includes(client)));
    this.onMessage('duel-runback',client=>{const asked=this.duelSet?.view.runback.length??0;if(this.duelSet?.request(this.simulation,client.sessionId)){for(const queue of this.inputQueues.values())queue.clear();}else if((this.duelSet?.view.runback.length??0)>asked)this.overAt=this.simulation.serverTime;this.sendSnapshots();});
    this.onMessage('ping', (client, raw: unknown) => {
      if (typeof raw === 'number' && Number.isFinite(raw)) client.send('pong', { clientTime: raw, serverTime: this.simulation.serverTime });
    });
    this.setFixedTimestep(({ dt }) => this.faults.guard(() => {
      if (this.pause?.hold()) return;
      const waiting=new Set<string>();
      for(const [id,queue] of this.inputQueues){
        const input=queue.take();
        if(input){this.simulation.submitInput(id,input);this.rewards.input(id,input);}else waiting.add(id);
      }
      try { this.simulation.step(dt,waiting); } catch (error) { this.faults.fault(error); }
      this.customTimer();
      const human=this.botRoom&&this.simulation.status==='waiting'?this.soloHuman():undefined;
      if (human!==undefined&&this.ready?.gated(human)) {
        const now=this.simulation.serverTime;
        if (this.startAt === null) {
          if (this.assets.ready(this.simulation.snapshot()) && this.ready.ready([human])) { this.readyAt = now; this.startAt = now + READY_SECONDS; }
        } else if (now >= this.startAt && this.simulation.startMatch()) { this.startAt=null;void this.lock();
          this.broadcast('notice', { message: `Battle royale in ${STAGES[this.simulation.stage].name} — ${this.botSeats} rivals, one life each` }); }
      } else if (this.botRoom && this.simulation.status === 'waiting') {
        if (this.startAt !== null && this.simulation.serverTime >= this.startAt) {
          this.applyStage();
          if (this.assets.ready(this.simulation.snapshot())) {
            if (this.readyAt === null) {
              this.readyAt = this.simulation.serverTime;
              if (this.readyAt > this.startAt + .5) this.startAt = this.readyAt + LOADED_COUNTDOWN;
            }
            if (this.simulation.serverTime >= this.startAt && this.simulation.startMatch()) { this.startAt=null;void this.lock();
              this.broadcast('notice', { message: `Battle royale in ${STAGES[this.simulation.stage].name} — ${this.botSeats} rivals, one life each` }); }
          }
        }
      } else if (this.simulation.roomMode === 'match' && this.simulation.status === 'waiting') {
        const entrantsReady = this.clients.length >= (this.privateRoom || this.duelRoom ? 2 : 1) && this.dropped.size === 0;
        if (!entrantsReady) this.startAt = null;
        if (!this.privateRoom && entrantsReady) {
          const at = this.simulation.serverTime + (this.duelRoom ? 3 : this.clients.length >= 2 ? MATCH_COUNTDOWN : SOLO_COUNTDOWN);
          this.startAt = this.startAt === null ? at : Math.min(this.startAt, at);
        }
        if (!this.privateRoom && !this.duelRoom && this.startAt !== null && !this.rosterPrepared) this.planBots();
        if(this.custom){const named=this.custom.view.rules.arena;if(named!=='auto'&&named!=='vote'&&named!==this.simulation.stage&&!this.rosterPrepared)this.applyStage();}
        if(this.partyStart.waiting&&this.startAt===null&&entrantsReady&&this.partyStart.complete(this.clients.length,this.dropped.size)){
          const present=this.clients.map(client=>client.sessionId);
          if(this.assets.ready(this.simulation.snapshot())&&(this.ready?.ready(present)??true)){
            this.startAt=this.simulation.serverTime+PARTY_COUNTDOWN;
            this.broadcast('notice',{message:`Everyone is here — the ${this.duelRoom?'duel':'match'} starts in ${PARTY_COUNTDOWN} seconds.`});
          }
        }
        if(this.privateRoom&&this.simulation.serverTime>=PRIVATE_WAIT_SECONDS&&!this.expiring){
          this.expiring=true;this.broadcast('notice',{message:'Private room expired after 15 minutes in the lobby. Create a new room.'});
          void this.disconnect(4004);return;
        }
        if (this.startAt !== null && entrantsReady && (this.simulation.serverTime >= this.startAt || (!this.privateRoom&&this.clients.length === MAX_PLAYERS))) {
          if(!this.rosterPrepared){
          if (!this.privateRoom&&!this.duelRoom) this.fillWithBots(Math.max(0, MIN_MATCH_FIELD - this.simulation.actors.size));
          else if (this.roomSize) this.fillWithBots(Math.max(0, this.roomSize - this.simulation.actors.size));
          this.applyStage();this.rosterPrepared=true;void this.lock();
          }
          const present=this.clients.map(client=>client.sessionId);
          const loaded=this.assets.ready(this.simulation.snapshot())&&(this.ready?.ready(present)??true);
          const settled=loaded&&this.ready?this.ready.lastShown(present)+LATE_HOLD_SECONDS:-Infinity;
          if(settled>this.simulation.serverTime&&settled>this.startAt!)this.startAt=settled;
          if(this.duelRoom&&loaded&&this.readyAt===null){this.readyAt=this.simulation.serverTime;if(this.readyAt>this.startAt!+.5)this.startAt=this.readyAt+3;}
          if (loaded&&this.simulation.serverTime>=settled&&(!this.duelRoom||this.simulation.serverTime>=this.startAt!)&&this.simulation.startMatch()) {
            this.startAt=null;void this.lock();this.partyStart.started();
            const bots = this.botCount();
            this.broadcast('notice', { message: `Match started in ${STAGES[this.simulation.stage].name} — one life per fighter${bots ? `, ${bots} bot${bots === 1 ? '' : 's'} filling the field` : ''}` });
          }
        }
      }
      this.duelSet?.step(this.simulation);
      if(this.overFor()>=FINISHED_ROOM_SECONDS&&!this.expiring){this.expiring=true;void this.disconnect(FINISHED_ROOM_CLOSE);return;}
      if (this.simulation.tick % (SIMULATION_HZ / SNAPSHOT_HZ) === 0) this.sendSnapshots();
    }), SIMULATION_HZ);
  }

  onUncaughtException(error:RoomException,method:RoomMethodName){this.faults.report(error,method);}

  private sendSnapshots(){
    const began=performance.now();
    const snapshot=this.snapshot(true);if(this.simulation.roomMode==='match')this.rewards.observe(snapshot);
    for(const client of this.clients)client.send('snapshot',this.forOwner(snapshot,client.sessionId));
    netStats.onSnapshots(performance.now()-began);
  }

  private overFor(){
    const sim=this.simulation,over=sim.roomMode==='match'&&sim.status==='finished'&&(!this.duelSet||this.duelSet.view.phase==='complete');
    if(!over){this.overAt=null;return 0;}
    this.overAt??=sim.serverTime;return sim.serverTime-this.overAt;
  }

  private soloHuman(){
    let id:string|undefined;
    for(const actor of this.simulation.actors.values())if(!actor.state.isBot){if(id!==undefined)return undefined;id=actor.state.id;}
    return id;
  }
  private pauseOpen(){
    if(this.expiring)return false;
    return this.simulation.status==='active'||(this.botRoom&&this.simulation.status==='waiting');
  }

  override setFixedTimestep(step:FixedTimestepCallback,tickRate=SIMULATION_HZ){
    const clock=new StepClock(tickRate),loop=++this.loop,dt=1/tickRate;
    let tick=0,budget=0,pending=false;
    clock.advance(performance.now());
    const run=()=>{
      pending=false;
      if(loop!==this.loop)return;
      if(budget>0&&clock.take()){budget--;const began=performance.now();step({dt,dtMs:dt*1000,tick:tick++,subSteps:1,subDt:dt,subDtMs:dt*1000});netStats.onTick(performance.now()-began);}
      if(budget>0&&clock.owed>0&&loop===this.loop){pending=true;setImmediate(run);}
    };
    this.setTimestep(()=>{
      if(loop!==this.loop)return;
      const writtenOff=clock.dropped;
      clock.advance(performance.now());
      netStats.onWrittenOff(clock.dropped-writtenOff);netStats.onOwed(clock.owed);
      budget=StepClock.PER_CALLBACK;
      if(!pending&&clock.owed>0){pending=true;setImmediate(run);}
    },1000/tickRate);
  }

  private applyStage(field=false){
    if(this.simulation.roomMode!=='match')return;
    const current=this.simulation.stage;
    const stage=this.custom?votedArena(this.custom.view,current)
      :field?seriesStage(this.simulation.snapshot().players.map(p=>p.fighter))??current:current;
    if(stage===this.simulation.stage)return;
    this.simulation.setStage(stage,buildCollision(stage));
    void this.setMetadata({ mode:this.simulation.roomMode, visibility:this.privateRoom||this.botRoom?'private':'public',
      map: stage, humanCapacity: this.maxClients, botCount: this.botCount() });
  }

  botCount(){ return this.simulation.snapshot().players.filter(p=>p.isBot).length; }

  onAuth(_client:Client,options:JoinOptions={}){requireRosterProtocol(options.rosterProtocol);
    if(this.duelRoom&&this.simulation.status!=='waiting')throw new Error('This Duel has already started.');
    if(this.duelRoom&&this.simulation.actors.size>=2&&!this.simulation.actors.has(_client.sessionId))throw new Error('This Duel is full.');
    if (options.fighter !== undefined && !isReleasedFighter(options.fighter)) throw new Error('Fighter is not available');
    const locked = options.fighter !== undefined && this.simulation.roomMode !== 'training' ? lockedOut(options.fighter, sharedEconomy()?.book.find(options.account)) : undefined;
    if (locked) throw new Error(locked);
    if(this.expiring)throw new Error('This private room has expired.');
    if(this.privateRoom&&options.code!==this.code&&options.creationToken!==this.creationToken)throw new Error('Enter the room code to join this private match.');
    if(options.forge!==undefined)roomKit(options.forge,options.fighter,this.privateRoom);
    return true;
  }

  private dress(client: Client, token: unknown) {
    this.rewards.bind(client.sessionId,token);
    const account = sharedEconomy()?.book.find(token), state = this.simulation.actors.get(client.sessionId)?.state;
    if (!account || !state) return;
    const outfit = account.worn.outfits?.[state.fighter];
    if (outfit && owns(account, outfit) && outfitFor(outfit, state.fighter)) state.outfit = outfit; else delete state.outfit;
  }
  onJoin(client: Client, options: JoinOptions = {}) {
    this.onAuth(client,options);this.assets.add(client,options.assetGate);this.ready?.add(client,options.readyGate);
    if(this.hostId===null)this.hostId=client.sessionId;
    this.simulation.addPlayer(client.sessionId, options.fighter ?? 'goku', roomName(options.account, typeof options.name === 'string' ? options.name : 'Fighter'));
    if(options.forge!==undefined){const kit=roomKit(options.forge,options.fighter,this.privateRoom);this.simulation.forge(client.sessionId,kit.moves,kit.hash);this.forgeCodes.set(kit.hash,kit.code);this.broadcast('forge-kits',Object.fromEntries(this.forgeCodes));}
    else if(this.forgeCodes.size)client.send('forge-kits',Object.fromEntries(this.forgeCodes));
    this.inputQueues.set(client.sessionId,new InputQueue());
    this.rewards.bind(client.sessionId,options.account);
    if(this.botRoom){this.fillWithBots(this.botSeats);this.startAt=this.ready?.gated(client.sessionId)?null:this.simulation.serverTime+BOT_ROYALE_COUNTDOWN;this.applyStage(true);}
    if(this.simulation.roomMode==='training'&&!this.botRoom&&this.maxClients<MAX_PLAYERS-1)this.maxClients=MAX_PLAYERS-1;
    client.send('welcome', { playerId: client.sessionId, roomId: this.roomId, mode: this.simulation.roomMode,
      tickRate: SIMULATION_HZ, snapshotRate: SNAPSHOT_HZ, botCount: this.botCount() });
    client.send('snapshot', this.forOwner(this.snapshot(),client.sessionId));
    if(this.plannedBots.length)client.send('planned-bots',this.plannedBots);
  }

  private planBots(){
    let key='';const taken:FighterId[]=[];
    for(const actor of this.simulation.actors.values())if(!actor.state.isBot){taken.push(actor.state.fighter);key+=`${actor.state.fighter},`;}
    if(key===this.planKey)return;this.planKey=key;
    const seats=Math.max(0,MIN_MATCH_FIELD-taken.length),kept=this.plannedBots.filter(f=>!taken.includes(f)).slice(0,seats);
    this.plannedBots=[...kept,...draftBots([...taken,...kept],seats-kept.length,items=>this.simulation.shuffle(items))];
    this.broadcast('planned-bots',this.plannedBots);
  }

  private fillWithBots(seats:number){
    if(seats<=0)return;
    const players=this.simulation.snapshot().players;
    const taken=players.filter(p=>!p.isBot).map(p=>p.fighter);
    const existing=players.filter(p=>p.isBot).length;
    const planned=this.plannedBots.filter(f=>!taken.includes(f)).slice(0,seats);this.plannedBots=[];
    const draft=[...planned,...draftBots([...taken,...planned],seats-planned.length,items=>this.simulation.shuffle(items))];
    for(let seat=0;seat<seats;seat++){
      const n=existing+seat;
      this.simulation.addPlayer(`bot-${n + 1}`, draft[seat], BOT_NAMES[n % BOT_NAMES.length], true);
      if(this.custom)this.simulation.actors.get(`bot-${n + 1}`)!.botSkill=BOT_SKILL[this.custom.view.rules.difficulty];
    }
  }

  async onDrop(client: Client) {
    if (!this.simulation.getPlayer(client.sessionId)) return;
    this.dropped.add(client.sessionId);
    this.inputQueues.get(client.sessionId)?.clear();
    this.simulation.clearPlayerInput(client.sessionId);
    this.pause?.drop(client.sessionId);
    try {
      await this.allowReconnection(client, RECONNECTION_SECONDS);
    } catch {
      this.onLeave(client);
    }
  }

  onReconnect(client: Client) {
    this.dropped.delete(client.sessionId);this.rejected.delete(client.sessionId);this.resync?.forget(client.sessionId);
    this.inputQueues.get(client.sessionId)?.clear();
    this.simulation.clearPlayerInput(client.sessionId);
    client.send('snapshot', this.forOwner(this.snapshot(),client.sessionId));
    if(this.plannedBots.length)client.send('planned-bots',this.plannedBots);
  }

  onLeave(client: Client) {
    this.custom?.remove(client.sessionId);this.assets?.remove(client.sessionId);this.ready?.remove(client.sessionId);
    this.dropped.delete(client.sessionId);this.rejected.delete(client.sessionId);this.resync?.forget(client.sessionId);
    this.inputQueues.delete(client.sessionId);
    this.rewards.leave(client.sessionId);
    this.simulation.removePlayer(client.sessionId);
    if(this.duelRoom&&this.simulation.actors.size<2)this.duelSet?.forfeit(this.simulation,this.simulation.playerStates()[0]?.id??null);
    if(this.partyStart.waiting)this.partyStart.left();
    if(this.rosterPrepared&&this.simulation.status==='waiting'){for(const p of this.simulation.playerStates())if(p.isBot)this.simulation.removePlayer(p.id);this.rosterPrepared=false;this.startAt=null;void this.unlock();}
    if(this.duelRoom&&this.simulation.status==='waiting'){this.readyAt=null;this.startAt=null;}
    if(this.hostId===client.sessionId){this.hostId=this.simulation.snapshot().players.find(p=>!p.isBot)?.id??null;this.startAt=null;}
  }
  snapshot(consumeEvents=false):GameSnapshot {
    const snapshot=this.simulation.snapshot(consumeEvents);
    snapshot.lobby={...(this.duelRoom?{duel:true}:{}),visibility:this.privateRoom?'private':'public',code:this.code,hostId:this.privateRoom?this.hostId:null,...(this.roomSize?{size:this.roomSize}:{}),
      canStart:this.privateRoom&&snapshot.status==='waiting'&&this.clients.length>=2&&this.dropped.size===0&&this.startAt===null&&!this.expiring,
      ...this.partyStart.view(snapshot.serverTime),
      startsAt:this.startAt,expiresAt:this.privateRoom&&snapshot.status==='waiting'?PRIVATE_WAIT_SECONDS:null};
    this.duelSet?.snapshot(snapshot);
    if(this.custom)(snapshot as GameSnapshot&{custom:CustomView}).custom=this.custom.snapshot();
    if(this.pause)snapshot.pause=this.pause.view();
    return snapshot;
  }
  private customTimer(){
    const sim=this.simulation,custom=this.custom?.view;if(!custom||sim.status!=='active')return;
    this.activeAt??=sim.serverTime;
    if(!custom.rules.seconds)return;custom.endsAt=this.activeAt+custom.rules.seconds;
    if(sim.serverTime<custom.endsAt)return;
    const alive=sim.playerStates().filter(p=>p.alive).sort((a,b)=>b.hp/b.maxHp-a.hp/a.maxHp||(b.damageDealt??0)-(a.damageDealt??0));
    const first=alive[0],second=alive[1];
    const tied=first&&second&&Math.abs(first.hp/first.maxHp-second.hp/second.maxHp)<.0001&&(first.damageDealt??0)===(second.damageDealt??0);
    sim.status='finished';sim.winnerId=first&&!tied?first.id:null;
    for(const a of sim.actors.values()){sim.clearPlayerInput(a.state.id);a.cast=null;if(a.state.alive){a.state.action=a.state.id===sim.winnerId?'victory':'idle';a.state.actionStarted=sim.serverTime;a.state.actionDuration=0;}}
  }
  private forOwner(snapshot:GameSnapshot,id:string):GameSnapshot {
    snapshot=this.rewards.forOwner(snapshot,id);
    const checkpoint=this.simulation.predictionCheckpoint(id,true);
    return checkpoint?{...snapshot,prediction:{[id]:checkpoint},queued:this.inputQueues.get(id)?.low}:snapshot;
  }
  requestPrivateStart(client:Client){
    if(!this.privateRoom||this.simulation.status!=='waiting')return;
    if(client.sessionId!==this.hostId){client.send('notice',{message:'Only the room host can start the match.'});return;}
    if(this.clients.length<2){client.send('notice',{message:'Invite at least one friend before starting.'});return;}
    if(this.dropped.size){client.send('notice',{message:'Waiting for a disconnected fighter to reconnect.'});return;}
    if(this.startAt!==null||this.expiring)return;
    this.startAt=this.simulation.serverTime+3;
    this.broadcast('notice',{message:'Get ready — the match starts in 3 seconds.'});
  }
  onDispose() { this.loop++;this.inputQueues.clear();this.dropped.clear();this.resync?.clear(); if(this.code)privateCodes.release(this.code); capacity.release(this); this.simulation?.dispose(); }
}

export class PrivateArenaRoom extends ArenaRoom {
  protected override privateRoom=true;
}

export class BotArenaRoom extends ArenaRoom {
  protected override botRoom=true;
}

export class DuelRoom extends ArenaRoom { protected override duelRoom=true; }
export class PrivateDuelRoom extends DuelRoom { protected override privateRoom=true; }
