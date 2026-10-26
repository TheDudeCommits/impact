import { ROSTER_PROTOCOL, ROSTER_REFRESH_MESSAGE } from './game/rosterProtocol';
import { ARENAS_FULL_MESSAGE, isArenasFull } from './game/arenasFull';
import { isReleasedFighter, requireReleasedFighter } from './game/rosterAvailability';
import { laboratoryFighter } from './fighterLab';
import { forgeJoinOption, forgeWanted } from './engine/client/forgeJoin';
import { forgetForgeKits, rememberForgeKits } from './engine/sim/forgedKits';
import {joinRiftPublic} from './network/riftQueue';
import {account as playerAccount} from './ui/shop/account';
import type {PartyTravel} from './social/PartyClient';
import {RIFT_PROTOCOL} from './game/moba/model';
import {OBJECTIVE_PROTOCOL,type ObjectiveKind,type ObjectiveAccess,type RolePreference} from './game/objectives/model';
import { Client, type Room } from '@colyseus/sdk';
import { LinkQuality } from './network/linkQuality';
import { errorReports } from './boot/errorReports';
import type { AttackSlot, FighterId, GameSnapshot, PlayerInput, RoomMode } from './game/types';
import { COOP_LINK, COOP_ROOM, SURVIVAL_PROTOCOL, decode, type CoopFrame } from './survival/coopNet';
import { HordeFrames } from './survival/horde/frame';
import { carried } from './survival/progressStore';
import type { HordeEvent } from './survival/horde/Horde';
import { ArenaSimulation } from './game/simulation';
import { chooseStage, STAGES, type StageId } from './game/stages';
import { placeForStart, royaleRules } from './game/stageChoice';
import { BODY_SIZE, COMBO_HP, COMBO_STAMINA, MOVES, SIMULATION_HZ } from './game/moves';
import { HELD } from './game/economy/fighters';
import { trainingPlace, trainingRival } from './ui/modes/prefs';
import { activePack, activePackRoster } from './engine/packs/active';

export type NetworkAccess={kind:'rift-war';access:'quick'|'bots'|'host'|'join';code?:string}|{kind:'duel';access:'online'|'bot'|'host'|'join';code?:string; rival?:FighterId; place?:StageId}|{kind:'party';travel:PartyTravel}|{kind:'objective';objective:ObjectiveKind;access:ObjectiveAccess;role?:RolePreference;fighter?:FighterId;code?:string; place?:StageId}|{kind:'public'}|{kind:'create-private';players?:number; place?:StageId}|{kind:'join-private';code:string}|{kind:'bots';players:number; place?:StageId; field?:FighterId[]; lone?:true}
  |{kind:'survival'}
  |{kind:'coop-create'}|{kind:'coop-join';code:string;
  quick?:boolean};

export function closeMessage(code:number){
  if(code===4001)return 'The server was updated. Press PLAY to jump back in.';
  if(code===4004)return 'This room expired. Press PLAY to start a new one.';
  if(code===4006)return 'Your match ended while you were away. Press PLAY for another.';
  if(code===4008)return 'Loading took too long. Press PLAY to try again.';
  return 'Lost connection to the match. Press PLAY to find a new one.';
}
export function joinFailure(error:unknown,online=typeof navigator!=='object'||navigator.onLine!==false):string|undefined{
  if(!error||typeof error!=='object')return undefined;
  const {message,code}=error as {message?:unknown;code?:unknown},text=typeof message==='string'?message:'';
  if(text.includes(ROSTER_REFRESH_MESSAGE)||text.includes(ROSTER_REFRESH_MESSAGE.replace('Refresh ','Refresh Jump ')))return ROSTER_REFRESH_MESSAGE;
  if(isArenasFull(error))return ARENAS_FULL_MESSAGE;
  const unreachable=/Failed to fetch|NetworkError when attempting|^Load failed$|fetch failed|ECONNREFUSED|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED/i.test(text)||code==='ECONNREFUSED';
  if(unreachable&&!online)return "You're offline. Check your connection, then try again.";
  if(unreachable||code===502||code===503||code===504||code===1005||code===1006||/Bad Gateway|Service Unavailable|Gateway Time-?out|Application failed to respond|no processId available|shutting.down/i.test(text))return 'The servers are restarting. Try again in a minute.';
  return undefined;
}

export class Network {
  constructor(private readonly endpoint?:string){}
  room:Room|null=null;
  snapshot:GameSnapshot|null=null;
  receivedAt=0;
  predictionReady=false;
  readonly link=new LinkQuality();
  private pingTimer:ReturnType<typeof setInterval>|undefined;
  private awaitingInputResync=false;
  private generation=0;
  private resyncTimer:ReturnType<typeof setTimeout>|undefined;
  private askResync(room:Room){
    clearTimeout(this.resyncTimer);
    if(room.connection.isOpen)room.send('resync-input');
    this.resyncTimer=setTimeout(()=>{if(this.room===room&&this.awaitingInputResync)this.askResync(room);},1000);
  }
  onSnapshot=(_snapshot:GameSnapshot)=>{};
  onControlReset=()=>{};
  onDisconnect=(_reason:string,_code?:number)=>{};
  onNotice=(_message:string)=>{};
  plannedBots:FighterId[]=[];
  onPlannedBots=(_bots:readonly FighterId[])=>{};
  get id(){return this.room?.sessionId??'';}
  coop=false;
  get run(){return this.coop?(this.snapshot as CoopFrame|null)?.survival:undefined;}
  readonly hordeFrames=new HordeFrames();
  hordeEvents:HordeEvent[]=[];
  private hordeFrame(snapshot:CoopFrame){if(snapshot.horde){const events=this.hordeFrames.next().unpack(snapshot.horde);if(events.length)this.hordeEvents.push(...events);if(this.hordeEvents.length>256)this.hordeEvents.splice(0,this.hordeEvents.length-256);}}
  async connect(fighter:FighterId,mode:RoomMode,name:string,access:NetworkAccess={kind:'public'}){
    requireReleasedFighter(fighter);
    const generation=++this.generation;
    const url=this.endpoint || import.meta.env.VITE_MATCH_SERVER || `${location.protocol==='https:'?'https':'http'}://${location.hostname}:2567`;
    const client=new Client(url);
    let activeRoom:Room;
    if(mode!=='training')await playerAccount.open().catch(()=>undefined);
    const account=playerAccount.secret()??COOP_LINK.token;
    try {
      if(access.kind==='duel'){
        const options={rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,name,mode:'match'};
        if(access.access==='online')activeRoom=await client.joinOrCreate('duel_arena',options);
        else if(access.access==='host'){const stage=placeForStart(access.place,'duel','friends');activeRoom=await client.create('private_duel',{...options,...forgeJoinOption(fighter),creationToken:crypto.randomUUID(),...(stage?{stage}:{})});}
        else if(access.access==='join'){const code=access.code?.trim();if(!code||!/^\d{6}$/.test(code))throw new Error('Enter the six-digit Duel code.');activeRoom=await client.joinById(`duel-${code}`,{...options,...forgeJoinOption(fighter),code});}
        else throw new Error('Bot Duel runs locally.');
      }else if(access.kind==='party')activeRoom=await client.consumeSeatReservation(access.travel.reservation);
      else if(access.kind==='rift-war'){
        const options={rosterProtocol:ROSTER_PROTOCOL,assetGate:true,riftProtocol:RIFT_PROTOCOL,fighter,account,name,access:access.access};
        if(access.access==='join'){const code=access.code?.trim();if(!code||!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code.');activeRoom=await client.joinById(`rift-${code}`,{...options,code});}
        else if(access.access==='quick')activeRoom=await joinRiftPublic(client,url,options);
        else activeRoom=await client.create('rift_war',{...options,creationToken:crypto.randomUUID()});
      }
      else if(access.kind==='objective'){
        const options={rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,objectiveProtocol:OBJECTIVE_PROTOCOL,fighter,account,name,objective:access.objective,access:access.access,role:access.role};
        if(access.access==='join'){const code=access.code?.trim();if(!code||!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code.');activeRoom=await client.joinById(`objective-${code}`,{...options,code});}
        else if(access.access==='quick'){try{activeRoom=await client.joinOrCreate('objective_arena',options);}catch(error){if(error instanceof Error&&error.message.includes('faction is full'))activeRoom=await client.create('objective_arena',options);else throw error;}}
        else{
          const arena=access.objective==='bad-blood'&&access.access==='host'?placeForStart(access.place,'bad-blood','friends'):undefined;
          activeRoom=await client.create('objective_arena',{...options,creationToken:crypto.randomUUID(),...(arena?{rules:{arena}}:{})});
        }
      }else if(access.kind==='bots')activeRoom=await client.create('bot_arena',{rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,mode:'match',name,players:access.players});
      else if(access.kind==='coop-create'){const {unlocked,bonus}=carried(fighter);activeRoom=await client.create(COOP_ROOM,{rosterProtocol:ROSTER_PROTOCOL,survivalProtocol:SURVIVAL_PROTOCOL,assetGate:true,readyGate:true,fighter,account,name,creationToken:crypto.randomUUID(),unlocked,bonus});}
      else if(access.kind==='coop-join'&&access.quick){const {unlocked,bonus}=carried(fighter);activeRoom=await client.joinOrCreate(COOP_ROOM,{rosterProtocol:ROSTER_PROTOCOL,survivalProtocol:SURVIVAL_PROTOCOL,assetGate:true,readyGate:true,fighter,account,name,quick:true,unlocked,bonus});}
      else if(access.kind==='coop-join'){
        const code=access.code.trim();
        if(!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code from your friend.');
        const {unlocked,bonus}=carried(fighter);
        activeRoom=await client.joinById(`coop-${code}`,{rosterProtocol:ROSTER_PROTOCOL,survivalProtocol:SURVIVAL_PROTOCOL,assetGate:true,readyGate:true,fighter,account,name,code,unlocked,bonus});
      }
      else if(access.kind==='create-private'){
        const rules=royaleRules(access.place,access.players);
        activeRoom=await client.create('private_arena',{rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,mode:'match',name,creationToken:crypto.randomUUID(),...(access.players?{players:access.players}:{}),...(rules?{rules}:{}),...forgeJoinOption(fighter)});
      }
      else if(access.kind==='join-private'){
        const code=access.code.trim();
        if(!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit room code from your friend.');
        activeRoom=await client.joinById(`private-${code}`,{rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,mode:'match',name,code,...forgeJoinOption(fighter)});
      }else activeRoom=await client.joinOrCreate('arena',{rosterProtocol:ROSTER_PROTOCOL,assetGate:true,readyGate:true,fighter,account,mode,name});
    }catch(error){
      const down=joinFailure(error);if(down)throw new Error(down);
      if(access.kind==='duel'&&access.access==='join'&&error instanceof Error&&!error.message.startsWith('Enter the six-digit'))throw new Error('This Duel is unavailable. Check the code — it may be full, started, or expired.');
      if(access.kind==='objective'&&access.access==='join'&&error instanceof Error)throw new Error('This team room is unavailable. Check the mode and code — it may be full or already started.');
      if(access.kind==='join-private'&&error instanceof Error&&!error.message.startsWith('Enter the 6-digit'))throw new Error('This room is unavailable. Check the code — it may be full, started, or expired.');
      if(access.kind==='coop-join'&&access.quick&&error instanceof Error)throw new Error('Quick co-op is unavailable right now — try again, or host a room.');
      if(access.kind==='coop-join'&&error instanceof Error&&!error.message.startsWith('Enter the 6-digit'))throw new Error(/just ended/i.test(error.message)?'That run has just ended — join when the party is back in the lobby.':'This co-op room is unavailable. Check the code — it may be full or expired.');
      throw error;
    }
    if(generation!==this.generation){activeRoom.reconnection.enabled=false;await activeRoom.leave();throw new Error('Connection cancelled.');}
    this.room=activeRoom;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.awaitingInputResync=false;this.coop=access.kind==='coop-create'||access.kind==='coop-join'||access.kind==='party'&&access.travel.mode==='survival';
    const rival=mode==='training'?trainingRival():undefined;if(rival)activeRoom.send('training',{lab:'opponent',value:rival});
    COOP_LINK.room=this.coop?activeRoom:undefined;COOP_LINK.match=this.coop?undefined:activeRoom;
    activeRoom.reconnection.minUptime=0;
    let lastError:string|undefined;
    activeRoom.onMessage('welcome',()=>{});
    this.plannedBots=[];
    activeRoom.onMessage('planned-bots',(bots:unknown)=>{
      if(this.room!==activeRoom||!Array.isArray(bots))return;
      this.plannedBots=bots.filter(isReleasedFighter).slice(0,12);this.onPlannedBots(this.plannedBots);
    });
    this.link.reset();clearInterval(this.pingTimer);
    this.pingTimer=setInterval(()=>{if(this.room===activeRoom&&activeRoom.connection.isOpen)activeRoom.send('ping',this.link.ping(performance.now()));},2000);
    activeRoom.onMessage('pong',(pong:unknown)=>{if(this.room===activeRoom&&typeof pong==='object'&&pong!==null)this.link.pong((pong as {clientTime?:unknown}).clientTime,performance.now());});
    forgetForgeKits();activeRoom.onMessage('forge-kits',(codes:unknown)=>{rememberForgeKits(codes);});
    activeRoom.onMessage('snapshot',(snapshot:GameSnapshot)=>{
      if(this.room!==activeRoom)return;
      if(!this.awaitingInputResync)this.predictionReady=true;
      this.snapshot=snapshot;this.receivedAt=performance.now();this.link.heard(this.receivedAt);this.onSnapshot(snapshot);
    });
    activeRoom.onMessage('input-resync',(snapshot:GameSnapshot)=>{
      if(this.room!==activeRoom)return;
      clearTimeout(this.resyncTimer);
      this.awaitingInputResync=false;this.predictionReady=true;
      this.snapshot=snapshot;this.receivedAt=performance.now();this.link.heard(this.receivedAt);this.onSnapshot(snapshot);
    });
    activeRoom.onMessage('frame',(bytes:Uint8Array)=>{
      if(this.room!==activeRoom)return;
      if(!this.awaitingInputResync)this.predictionReady=true;
      const snapshot=decode(bytes);this.hordeFrame(snapshot);this.snapshot=snapshot;this.receivedAt=performance.now();this.link.heard(this.receivedAt);this.onSnapshot(snapshot);
    });
    activeRoom.onMessage('resync',(bytes:Uint8Array)=>{
      if(this.room!==activeRoom)return;
      this.awaitingInputResync=false;this.predictionReady=true;
      const snapshot=decode(bytes);this.hordeFrame(snapshot);this.snapshot=snapshot;this.receivedAt=performance.now();this.link.heard(this.receivedAt);this.onSnapshot(snapshot);
    });
    activeRoom.onDrop(()=>{if(this.room===activeRoom){this.receivedAt=-Infinity;this.predictionReady=false;this.awaitingInputResync=true;this.onControlReset();}});
    activeRoom.onReconnect(()=>{
      if(this.room!==activeRoom){queueMicrotask(()=>{if(activeRoom.connection.isOpen)void activeRoom.leave();});return;}
      lastError=undefined;
      this.receivedAt=-Infinity;
      this.askResync(activeRoom);
    });
    activeRoom.onLeave(code=>{
      if(this.room!==activeRoom)return;
      clearInterval(this.pingTimer);
      this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;
      if(lastError)console.warn(`Room closed (${code}): ${lastError}`);
      if(code===4008)errorReports.report('stall','the match did not load within 90 s, and the server closed the room (4008)');
      this.onDisconnect(closeMessage(code),code);
    });
    activeRoom.onError((_code,message)=>{if(this.room===activeRoom)lastError=message;});
    activeRoom.onMessage('input-rejected',()=>{
      if(this.room!==activeRoom||this.awaitingInputResync)return;
      this.predictionReady=false;this.awaitingInputResync=true;this.onControlReset();
      this.askResync(activeRoom);
    });
    activeRoom.onMessage('notice',(notice:unknown)=>{
      if(this.room!==activeRoom||typeof notice!=='object'||notice===null)return;
      const message=(notice as {message?:unknown}).message;if(typeof message==='string')this.onNotice(message);
    });
  }
  control(request:{type:'pause'|'resume';n:number}){if(this.room?.connection.isOpen)this.room.send(request.type,{n:request.n});}
  ready(){if(!this.coop&&this.room?.connection.isOpen&&!(this.snapshot&&('objective' in this.snapshot||'rift' in this.snapshot)))this.room.send('ready');}
  objectiveCommand(action:'start'|'role'|'rematch',role?:RolePreference){if(this.room?.connection.isOpen)this.room.send('objective-'+action,role);}
  startPrivateMatch(){if(this.room?.connection.isOpen)this.room.send('start-private-match');}
  choose(card?:string){if(this.coop&&this.room?.connection.isOpen)this.room.send('choose',card??null);}
  reroll(){if(this.coop&&this.room?.connection.isOpen)this.room.send('reroll',null);}
  loaded(run:number){if(this.coop&&this.room?.connection.isOpen)this.room.send('loaded',run);}
  backToLobby(){if(this.coop&&this.room?.connection.isOpen)this.room.send('lobby');}
  send(input:PlayerInput){if(!this.predictionReady||!this.room?.connection.isOpen)return false;this.room.send('input',input);return true;}
  async leave(){
    clearTimeout(this.resyncTimer);clearInterval(this.pingTimer);
    this.generation++;const room=this.room;this.room=null;this.snapshot=null;this.plannedBots=[];this.receivedAt=0;this.predictionReady=false;this.awaitingInputResync=false;this.coop=false;this.hordeFrames.clear();this.hordeEvents=[];
    if(COOP_LINK.room===room)COOP_LINK.room=undefined;if(COOP_LINK.match===room)COOP_LINK.match=undefined;
    if(!room)return;
    room.reconnection.enabled=false;
    room.reconnection.enqueuedMessages=[];
    if(room.connection.isOpen)await room.leave();
  }
}

export class LocalTraining {
  readonly local = true;
  room: { send(type: string, payload?: unknown): void } | null = null;
  snapshot: GameSnapshot | null = null;
  receivedAt = 0;
  predictionReady = false;
  sim: ArenaSimulation | null = null;
  onSnapshot = (_snapshot: GameSnapshot) => {};
  onControlReset = () => {};
  onDisconnect = (_reason: string) => {};
  onNotice = (_message: string) => {};
  paused = false;
  private forge?: { dispose(): void; readonly carried: { open: boolean; dummyWas?: string } };
  private makeForge?: (body: FighterId, carried: { open?: boolean; dummyWas?: string }) => NonNullable<LocalTraining['forge']>;
  private pressed?: AttackSlot;
  private packKits?: { restore(): void };
  get id() { return this.sim ? LocalTraining.PLAYER : ''; }
  static readonly PLAYER = 'you';
  static wanted() {
    const query = new URLSearchParams(typeof location === 'object' ? location.search : '');
    if (laboratoryFighter()) return true;
    if (query.has('online-training')) return false;
    if (query.has('local-training')) return true;
    return !(typeof navigator === 'object' && navigator.webdriver);
  }
  async connect(fighter: FighterId, name: string) {
    const laboratory = laboratoryFighter();
    if (!laboratory || fighter !== laboratory) requireReleasedFighter(fighter);
    await this.leave();
    const pack = activePack();
    if (pack) {
      const { PackSession } = await import('./engine/packs/session');
      const session = new PackSession(), applied = session.apply(pack);
      if (applied.ok) this.packKits = session; else console.warn(`[packs] ${pack.id}: kits not applied`, applied.errors);
    }
    const asked = import.meta.env.DEV && typeof location === 'object' ? new URLSearchParams(location.search).get('training-stage') : null;
    const stage = asked && asked in STAGES ? asked as StageId : (laboratory ? undefined : trainingPlace()) ?? chooseStage([], 'training');
    const { createRapierCollision } = await import('./game/rapierCollision');
    const sim = new ArenaSimulation({ roomMode: 'training', stage, collision: await createRapierCollision(stage), maxStamina: COMBO_STAMINA, maxHp: COMBO_HP });
    sim.addPlayer(LocalTraining.PLAYER, fighter, name);
    const roster = activePackRoster(), rival = trainingRival();
    const packed = roster && (rival && roster.includes(rival as FighterId) ? rival : roster[(roster.indexOf(fighter) + 1) % roster.length]);
    const partner = (import.meta.env.DEV && typeof location === 'object' ? new URLSearchParams(location.search).get('training-bot') : null) ?? packed ?? rival;
    const sparring = sim.actors.get('sparring-bot');
    if (sparring && partner && isReleasedFighter(partner) && !HELD.has(partner as FighterId)) { sparring.state.fighter = partner as FighterId; sparring.state.size = BODY_SIZE[partner as FighterId]; }
    this.sim = sim;
    this.room = { send: (type: string, payload?: unknown) => { if (type === 'training') this.command(payload); } };
    if (import.meta.env.DEV && typeof window === 'object') (window as unknown as { trainingVictory?: () => void }).trainingVictory = () => {
      if (this.sim) { this.sim.status = 'finished'; this.sim.winnerId = LocalTraining.PLAYER; }
    };
    this.predictionReady = true;
    this.publish();
    if (typeof document === 'object') void import('./ui/forge/ForgeStudio').then(({ ForgeStudio }) => {
      if (this.sim !== sim) return;
      this.makeForge = (body, carried) => new ForgeStudio({ body, playerId: LocalTraining.PLAYER, dummyId: 'sparring-bot', ...carried,
        command: command => this.sim?.trainingCommand(LocalTraining.PLAYER, command), press: slot => this.press(slot), snapshot: () => this.snapshot, paused: () => this.paused });
      this.forge = this.makeForge(sim.actors.get(LocalTraining.PLAYER)?.state.fighter ?? fighter, { open: forgeWanted() });
    }, error => console.warn('[forge] the studio could not load', error));
  }
  private command(payload: unknown) {
    const sim = this.sim;
    if (!sim) return;
    const body = () => sim.actors.get(LocalTraining.PLAYER)?.state.fighter, before = body();
    sim.trainingCommand(LocalTraining.PLAYER, payload);
    const now = body();
    if (!now || now === before || !this.forge || !this.makeForge) return;
    const carried = this.forge.carried;
    this.forge.dispose();
    this.forge = this.makeForge(now, carried);
  }
  press(slot: AttackSlot) { this.pressed = slot; }
  send(input: PlayerInput) {
    const sim = this.sim;
    if (!sim) return false;
    if (!this.paused) {
      const pressed = this.pressed; this.pressed = undefined;
      sim.submitInput(LocalTraining.PLAYER, pressed ? { ...input, attack: pressed, targetId: 'sparring-bot', lock: true } : input); sim.step(1 / SIMULATION_HZ);
    }
    this.publish();
    return true;
  }
  private publish() {
    if (!this.sim) return;
    const snapshot = this.sim.snapshot(true);
    this.snapshot = snapshot; this.receivedAt = performance.now();
    this.onSnapshot(snapshot);
  }
  startPrivateMatch() {}
  async leave() {
    this.forge?.dispose(); this.forge = undefined; this.makeForge = undefined; this.pressed = undefined;
    this.packKits?.restore(); this.packKits = undefined;
    this.sim?.dispose(); this.sim = null; this.room = null;
    this.snapshot = null; this.receivedAt = 0; this.predictionReady = false; this.paused = false;
  }
}
