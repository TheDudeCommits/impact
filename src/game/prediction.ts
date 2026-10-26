import { forgedMoves } from '../engine/sim/forgedKits';
import { MOVES, TECH_DELAY, TECH_STAMINA } from './moves';
import { ArenaSimulation, type ExternalTargets, type AimAssist } from './simulation';
import type { CollisionWorld, CombatEvent, GameSnapshot, PlayerInput, PlayerState, StageId } from './types';
import { LANDED } from './landedBlows';

const SERVER_OWNED = new Set(['hurt', 'flinch', 'launched', 'knockdown', 'getup', 'stun', 'splat', 'defeated', 'awaken', 'victory']);
const CORRECTION_RATE = 18;
const CORRECTION_SNAP = 3;
const PREDICTED_REACH = 10;
const TELEPORTS = new Set(['vanish']);
const VANISH_HOLD = .25;
const UNDECIDED = new Set(['idle', 'run', 'jump', 'dash', 'guard']);
const ATTACKS = new Set(['light', 'heavy', 'special', 'ultimate', 'area']);
export const impactKey=(event:CombatEvent)=>`${event.actorId}:${event.actionSeq}:${event.targetId}:${event.contactIndex??0}`;
const REACTIONS=new Set(['hurt','flinch','launched','knockdown','getup','stun','splat']);
type ContactView={age:number;confirmed:boolean;offset:{x:number;y:number;z:number};placed:boolean;action?:string;started:number;phase:number;
  seq?:number;index?:number;last?:{x:number;y:number;z:number};leaving?:boolean;letGo?:{x:number;y:number;z:number;t:number}};
type Seen={action:string;speed:number;reaction:string|null;stunUntil:number;lastDamageAt:number;stamina:number;timeStopped:boolean;grounded:boolean};
const TRUST_SPEED=1.2;
const PREVIEW_LET_GO=.25;
const HELD_REACTIONS=new Set(['hurt','flinch','knockdown','stun','splat']);
const RECONCILE_GAP=8;
const COSTLY_RECONCILE=3;
const COSTLY_GAP=50;

const EMPTY_WORLD: CollisionWorld = { move: (_id, _position, displacement) => ({ ...displacement }) };

export class Prediction {
  private forgedApplied = new Map<string, string>();
  private sim: ArenaSimulation | null = null;
  private id = '';
  private stage: StageId = 'harbor';
  private collision?: CollisionWorld;
  private pending: PlayerInput[] = [];
  private offset = { x: 0, y: 0, z: 0 };
  private previousPosition?:{x:number;y:number;z:number};
  private casts: CombatEvent[] = [];
  private impacts:CombatEvent[]=[];
  private reportedImpacts=new Set<string>();
  private presentedImpacts=new Set<string>();
  private confirmedImpacts=new Set<string>();
  private authoritativeImpacts=new Set<string>();
  private contacts=new Map<string,ContactView>();
  private seen=new Map<string,Seen>();
  private remotePrevious=new Map<string,{x:number;y:number;z:number}>();
  private playback?: {seq:number;slot:PlayerState['action'];age:number;duration:number;started:number};
  active = false;
  requireCollision = false;
  private owned = false;
  private serverOwns = false;
  private lastDrawn?: { x: number; y: number; z: number };
  visualTime = NaN;
  private vanishHold?: { at: number; x: number; y: number; z: number; until: number };
  private deferred?: GameSnapshot;
  private lastReconcile = -Infinity;
  private lastCost = 0;
  replayed = 0;
  folded = 0;
  clock: () => number = () => performance.now();

  get enabled() { return this.sim !== null; }

  start(id: string, snapshot: GameSnapshot, collision?: CollisionWorld) {
    this.stop();
    this.id = id;
    this.stage = snapshot.stage ?? 'harbor';
    this.collision = collision;
    this.sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage: this.stage, collision, capacity: 48, resolveAreas: false });
    this.sim.serverTime = snapshot.serverTime;
    this.sync(snapshot);
  }

  setExternalTargets(external?:ExternalTargets,assist?:AimAssist){
    if(!this.sim)return;
    this.sim.external=external;this.sim.assist=assist;
  }

  stop() {
    this.sim?.dispose();
    this.sim = null;
    this.vanishHold = undefined;
    this.deferred = undefined; this.lastReconcile = -Infinity; this.lastCost = 0;
    this.pending.length = 0;
    this.casts.length = 0;
    this.impacts.length=0;this.reportedImpacts.clear();this.presentedImpacts.clear();this.confirmedImpacts.clear();this.authoritativeImpacts.clear();this.contacts.clear();this.remotePrevious.clear();this.seen.clear();
    this.offset.x = this.offset.y = this.offset.z = 0;
    this.active = false;
    this.playback=undefined;
    this.previousPosition=undefined;
    this.serverOwns=false;this.lastDrawn=undefined;
  }

  setStage(stage: StageId, collision?: CollisionWorld) {
    if (stage === this.stage && !collision) return;
    const changed = stage !== this.stage;
    this.stage = stage;
    this.collision = collision ?? (changed ? undefined : this.collision);
    this.sim?.setStage(stage, collision ?? (changed ? EMPTY_WORLD : undefined));
  }

  submit(input: PlayerInput) {
    const sim = this.sim;
    if (!sim || !sim.actors.has(this.id)) return;
    const before=sim.actors.get(this.id)!.state;
    this.previousPosition={x:before.x,y:before.y,z:before.z};
    this.pending.push(input);
    if (this.pending.length > 240) this.pending.shift();
    sim.submitInput(this.id, input);
    this.rememberRemote();
    sim.step();
    const current=sim.actors.get(this.id)!.state;
    if(this.playback&&!current.hitstop&&!current.timeStopped)this.playback.age+=1/60;
    this.consumeEvents(sim.snapshot(true).events,true);
  }

  private consumeEvents(events:CombatEvent[],casts:boolean){
    LANDED.predict(events,this.id,this.pending.at(-1)?.seq??-1,casts?undefined:this.pending[0]?.seq,this.trust);
    const current=this.sim!.actors.get(this.id)!.state;
    for (const event of events) {
      if (casts&&event.kind === 'cast' && event.actorId === this.id) {
        this.casts.push(event);
        if(event.actionSeq!==undefined)this.playback={seq:event.actionSeq,slot:current.action,age:0,duration:current.actionDuration,started:current.actionStarted};
      }
      if(event.kind==='hit'&&event.actorId===this.id&&event.fighter==='naruto'&&event.slot==='heavy'&&!event.branch
          &&event.actionSeq!==undefined&&event.targetId&&!current.awakened&&current.grounded&&this.committed(event.targetId,event.serverTime)){
        const key=impactKey(event);if(this.reportedImpacts.has(key))continue;
        this.reportedImpacts.add(key);this.impacts.push(event);
        if(this.reportedImpacts.size>128)this.reportedImpacts.delete(this.reportedImpacts.values().next().value!);
      }
    }
  }
  private rememberRemote(){for(const [id,a]of this.sim!.actors)if(id!==this.id)this.remotePrevious.set(id,{x:a.state.x,y:a.state.y,z:a.state.z});}
  private committed(id:string,at:number){
    const seen=this.seen.get(id);
    if(!seen)return false;
    if(seen.timeStopped)return true;
    if(seen.reaction==='launched')return at<seen.lastDamageAt+TECH_DELAY||seen.stamina<TECH_STAMINA;
    return !!seen.reaction&&HELD_REACTIONS.has(seen.reaction)&&seen.stunUntil>at;
  }
  readonly trust=(id:string,at:number,event?:CombatEvent)=>{
    const seen=this.seen.get(id);
    if(!seen)return true;
    if(this.committed(id,at))return true;
    const thrown=event?.fighter&&event.slot?MOVES[event.fighter][event.slot]:undefined;
    if(thrown?.chargeIn&&(event!.move===undefined||event!.move===thrown.name))return false;
    return !seen.reaction&&(seen.action==='idle'||seen.action==='guard')&&seen.grounded&&seen.speed<TRUST_SPEED;
  };
  private see(player:PlayerState,reaction?:{mx:number;mz:number;reaction:string|null;stunUntil:number;lastDamageAt:number}){
    let seen=this.seen.get(player.id);
    if(!seen){seen={action:'idle',speed:0,reaction:null,stunUntil:-Infinity,lastDamageAt:-Infinity,stamina:0,timeStopped:false,grounded:true};this.seen.set(player.id,seen);}
    seen.action=player.action;seen.grounded=player.grounded;seen.timeStopped=!!player.timeStopped;seen.stamina=player.stamina;
    seen.speed=reaction?Math.hypot(reaction.mx,reaction.mz):0;seen.reaction=reaction?.reaction??null;
    seen.stunUntil=reaction?.stunUntil??-Infinity;seen.lastDamageAt=reaction?.lastDamageAt??-Infinity;
  }
  takeImpacts(){
    const ready:CombatEvent[]=[];
    this.impacts=this.impacts.filter(event=>{
      if(this.authoritativeImpacts.has(impactKey(event)))return false;
      const playback=this.playback;
      if(!playback||playback.seq!==event.actionSeq)return false;
      if(event.branch)return false;
      if(playback.age<MOVES.naruto.heavy.contacts[0])return true;
      ready.push(event);
      const key=impactKey(event);this.presentedImpacts.add(key);
      if(this.presentedImpacts.size>128)this.presentedImpacts.delete(this.presentedImpacts.values().next().value!);
      this.contacts.set(event.targetId!,{age:0,confirmed:this.confirmedImpacts.has(key),offset:{x:0,y:0,z:0},placed:false,started:0,phase:0,seq:event.actionSeq,index:event.contactIndex??0});
      return false;
    });return ready;
  }
  markAuthoritativeImpacts(events:CombatEvent[]){
    for(const event of events)if(event.kind==='hit'&&event.actorId===this.id&&event.actionSeq!==undefined){
      this.authoritativeImpacts.add(impactKey(event));
      if(this.authoritativeImpacts.size>128)this.authoritativeImpacts.delete(this.authoritativeImpacts.values().next().value!);
    }
  }
  impactWasPresented(event:CombatEvent){return event.kind==='hit'&&event.actionSeq!==undefined&&this.presentedImpacts.has(impactKey(event));}

  takeCasts() {
    const out = this.casts.slice();
    this.casts.length = 0;
    return out;
  }

  receive(snapshot: GameSnapshot, now = performance.now()) {
    const waiting = this.deferred;
    if (waiting) { this.folded++; this.deferred = waiting.events.length ? { ...snapshot, events: [...waiting.events, ...snapshot.events] } : snapshot; }
    else this.deferred = snapshot;
    return this.flush(now);
  }

  flush(now = performance.now()) {
    const snapshot = this.deferred;
    if (!snapshot || !this.sim) return false;
    if (now - this.lastReconcile < (this.lastCost >= COSTLY_RECONCILE && !this.urgent(snapshot) ? COSTLY_GAP : RECONCILE_GAP)) return false;
    this.deferred = undefined;
    const began = this.clock();
    this.reconcile(snapshot);
    this.lastCost = this.clock() - began; this.lastReconcile = now; this.replayed++;
    return true;
  }

  private urgent(snapshot: GameSnapshot) {
    const me = snapshot.players.find(p => p.id === this.id);
    if (!me || !me.alive || SERVER_OWNED.has(me.action) || me.timeStopped) return true;
    for (const event of snapshot.events) if (event.actorId === this.id || event.targetId === this.id) return true;
    return false;
  }

  reconcile(snapshot: GameSnapshot) {
    LANDED.authoritative(snapshot, this.id);
    const sim = this.sim;
    const server = snapshot.players.find(p => p.id === this.id);
    if (!sim || !server) return;
    const before = sim.actors.get(this.id)?.state;
    for(const event of snapshot.events)if(event.kind==='hit'&&event.actorId===this.id&&event.actionSeq!==undefined){
      this.confirmedImpacts.add(impactKey(event));
      if(this.confirmedImpacts.size>128)this.confirmedImpacts.delete(this.confirmedImpacts.values().next().value!);
    }
    const previousTargets=new Map([...this.contacts.keys()].map(id=>{const p=sim.actors.get(id)?.state;return [id,p?{x:p.x,y:p.y,z:p.z}:undefined];}));
    const was = before ? { x: before.x, y: before.y, z: before.z } : null;
    const teleported = snapshot.events.some(event => TELEPORTS.has(event.kind) && event.actorId === this.id);
    const vanish = Number.isFinite(this.visualTime) ? snapshot.events.find(event => event.kind === 'vanish' && event.actorId === this.id) : undefined;
    if (vanish && this.lastDrawn && vanish.serverTime > this.visualTime)
      this.vanishHold = { at: vanish.serverTime, x: this.lastDrawn.x, y: this.lastDrawn.y, z: this.lastDrawn.z, until: performance.now() + VANISH_HOLD * 1000 };
    sim.serverTime = snapshot.serverTime;
    this.sync(snapshot);
    const ack = server.ackSeq ?? -1;
    const held = SERVER_OWNED.has(server.action) || !server.alive;
    this.serverOwns = SERVER_OWNED.has(server.action) || !!server.timeStopped;
    this.pending = this.pending.filter(input => input.seq > ack);
    for (const input of this.pending) {
      sim.submitInput(this.id, input);
      this.rememberRemote();
      sim.step();
    }
    this.consumeEvents(sim.snapshot(true).events,false);
    for(const [id,contact]of this.contacts){
      const from=previousTargets.get(id),to=sim.actors.get(id)?.state;
      if(from&&to&&contact.placed){
        const dx=from.x-to.x,dy=from.y-to.y,dz=from.z-to.z;
        contact.offset.x+=dx;contact.offset.y+=dy;contact.offset.z+=dz;
        const previous=this.remotePrevious.get(id);
        if(!this.pending.length&&previous){previous.x-=dx;previous.y-=dy;previous.z-=dz;}
      }
      if(contact.letGo)continue;
      for(const event of snapshot.events)if(event.targetId===id){
        if(event.kind==='hit'&&event.actorId===this.id&&this.impactWasPresented(event))contact.confirmed=true;
        else if(event.kind==='hit'||event.actorId===this.id&&(event.kind==='blocked'||event.kind==='guard-break'||event.kind==='dodge'||event.kind==='just-guard'))contact.leaving=true;
      }
      if(!contact.confirmed&&contact.seq!==undefined&&LANDED.refused(LANDED.blow(this.id,contact.seq,id,contact.index??0)))contact.leaving=true;
    }
    const now = sim.actors.get(this.id)?.state;
    if (!was || !now || held) return;
    const dx = was.x - now.x, dy = was.y - now.y, dz = was.z - now.z;
    if(this.previousPosition){this.previousPosition.x-=dx;this.previousPosition.y-=dy;this.previousPosition.z-=dz;}
    if (teleported || Math.hypot(dx, dy, dz) > CORRECTION_SNAP) { this.offset.x = this.offset.y = this.offset.z = 0; return; }
    this.offset.x += dx; this.offset.y += dy; this.offset.z += dz;
  }

  private sync(snapshot: GameSnapshot) {
    const sim = this.sim!;
    const seen = new Set<string>();
    const me = snapshot.players.find(p => p.id === this.id);
    for (const player of snapshot.players) {
      if (player.enemy && me && Math.hypot(player.x - me.x, player.z - me.z) > PREDICTED_REACH) continue;
      seen.add(player.id);
      let actor = sim.actors.get(player.id);
      if (!actor) {
        sim.addPlayer(player.id, player.fighter, player.name, false, player);
        actor = sim.actors.get(player.id);
        if (!actor) continue;
      }
      const forged=forgedMoves(player.forge),applied=this.forgedApplied.get(player.id);
      if(forged?applied!==player.forge:applied!==undefined){sim.forge(player.id,forged,forged?player.forge:undefined);if(forged)this.forgedApplied.set(player.id,player.forge!);else this.forgedApplied.delete(player.id);}
      const checkpoint=player.id===this.id?snapshot.prediction?.[player.id]:undefined;
      if(checkpoint)this.sim!.restorePrediction(player.id,checkpoint);
      const ours = !checkpoint && player.id === this.id && actor.state.actionDuration > 0
        && ATTACKS.has(actor.state.action) && actor.state.actionTime < .98
        && (UNDECIDED.has(player.action) || player.action === actor.state.action);
      const held = ours ? { action: actor.state.action, actionStarted: actor.state.actionStarted,
        actionDuration: actor.state.actionDuration } : null;
      Object.assign(actor.state, player, { cooldowns: { ...player.cooldowns }, isBot: false }, held ?? {});
      if(player.id===this.id&&!checkpoint){actor.lastSeq=player.ackSeq??-1;actor.input={seq:actor.lastSeq,moveX:0,moveZ:0,yaw:player.yaw};}
      if (player.id !== this.id) {
        const reaction=snapshot.reactions?.[player.id];
        if(reaction)Object.assign(actor,reaction);
        this.see(player,reaction);
        actor.input = { seq: actor.lastSeq, moveX: 0, moveZ: 0, yaw: player.yaw };
        if(player.guarding||player.action==='guard'){actor.input.guard=true;actor.lastInputAt=sim.serverTime;actor.guardHeld=actor.wasGuarding=true;actor.guardAt=actor.guardPressedAt=-Infinity;}
        actor.mx = actor.mz = 0;
      }
    }
    for (const id of [...sim.actors.keys()]) if (!seen.has(id)) sim.removePlayer(id);
  }


  get action() { return this.sim?.actors.get(this.id)?.state.action; }

  get diagnostics() {
    const actor=this.sim?.actors.get(this.id);
    return {time:this.sim?.serverTime,pending:this.pending.map(p=>p.seq),offset:{...this.offset},
      position:actor?{x:actor.state.x,y:actor.state.y,z:actor.state.z}:undefined,
      velocity:actor?{x:actor.mx,z:actor.mz}:undefined,input:actor?{...actor.input}:undefined};
  }

  sampleRemote(dt:number,server:PlayerState,alpha=1):PlayerState {
    const contact=this.contacts.get(server.id),actor=this.sim?.actors.get(server.id);
    if(!contact)return server;
    if(contact.leaving||!actor||!server.alive||!actor.state.alive)return this.letGo(contact,server,dt);
    contact.age+=dt;
    const state=actor.state;
    if(contact.age>(contact.confirmed?2.5:1.2)||(contact.confirmed&&!REACTIONS.has(state.action)&&!REACTIONS.has(server.action)&&!state.hitstop)){
      contact.leaving=true;return this.letGo(contact,server,dt);
    }
    const previous=this.remotePrevious.get(server.id)??state,t=Math.max(0,Math.min(1,alpha));
    const position={x:previous.x+(state.x-previous.x)*t,y:previous.y+(state.y-previous.y)*t,z:previous.z+(state.z-previous.z)*t};
    if(!contact.placed){contact.offset={x:server.x-position.x,y:server.y-position.y,z:server.z-position.z};contact.placed=true;}
    else{const decay=Math.exp(-18*dt);contact.offset.x*=decay;contact.offset.y*=decay;contact.offset.z*=decay;}
    if(contact.action!==state.action){contact.action=state.action;contact.started=state.actionStarted;contact.phase=0;}
    contact.phase=Math.max(contact.phase,state.actionTime);
    const x=position.x+contact.offset.x,y=position.y+contact.offset.y,z=position.z+contact.offset.z;
    if(contact.last){contact.last.x=x;contact.last.y=y;contact.last.z=z;}else contact.last={x,y,z};
    return {...server,x,y,z,
      action:state.action,actionStarted:contact.started,actionTime:contact.phase,actionDuration:state.actionDuration,
      grounded:state.grounded,hitstop:state.hitstop,hitstopFrom:state.hitstopFrom,hitstopUntil:state.hitstopUntil,actionFrozen:state.actionFrozen};
  }
  private letGo(contact:ContactView,server:PlayerState,dt:number):PlayerState{
    if(!contact.letGo){const last=contact.last;contact.letGo={x:last?last.x-server.x:0,y:last?last.y-server.y:0,z:last?last.z-server.z:0,t:0};}
    const carry=contact.letGo;carry.t+=dt;
    const u=Math.min(1,carry.t/PREVIEW_LET_GO),left=1-u*u*(3-2*u);
    if(!server.alive||left<=0||Math.hypot(carry.x,carry.y,carry.z)>CORRECTION_SNAP){this.contacts.delete(server.id);return server;}
    return {...server,x:server.x+carry.x*left,y:Math.max(server.y,server.y+carry.y*left),z:server.z+carry.z*left};
  }

  sample(dt: number, server: PlayerState, alpha=1): PlayerState | null {
    const state = this.sim?.actors.get(this.id)?.state;
    this.active = false;
    if (!state || !server.alive || (this.requireCollision && !this.collision)) { this.owned = false; this.lastDrawn = undefined; return null; }
    const owned = SERVER_OWNED.has(server.action) || !!server.timeStopped || this.serverOwns;
    const decay = server.hitstop ? 1 : Math.exp(-CORRECTION_RATE * dt);
    this.offset.x *= decay; this.offset.y *= decay; this.offset.z *= decay;
    const blend=Math.max(0,Math.min(1,alpha)),previous=this.previousPosition??state;
    if (owned !== this.owned) {
      const from = this.owned ? server : state, to = this.owned ? state : server;
      this.offset.x += from.x - to.x; this.offset.y += from.y - to.y; this.offset.z += from.z - to.z;
      const drawn=this.lastDrawn;
      if(drawn){
        const bx=owned?server.x:previous.x+(state.x-previous.x)*blend,by=owned?server.y:previous.y+(state.y-previous.y)*blend,bz=owned?server.z:previous.z+(state.z-previous.z)*blend;
        this.offset.x=drawn.x-bx;this.offset.y=drawn.y-by;this.offset.z=drawn.z-bz;
      }
      if (Math.hypot(this.offset.x, this.offset.y, this.offset.z) > CORRECTION_SNAP) this.offset.x = this.offset.y = this.offset.z = 0;
      this.owned = owned;
    }
    if (owned) return this.drew({ ...server, x: server.x + this.offset.x, y: server.y + this.offset.y, z: server.z + this.offset.z });
    this.active = true;
    const playback=this.playback?.seq===state.actionSeq&&ATTACKS.has(state.action)?this.playback:undefined;
    const finished=playback&&playback.age>=playback.duration;
    const moving=Math.hypot(this.sim!.actors.get(this.id)!.mx,this.sim!.actors.get(this.id)!.mz)>.15;
    const holding=finished&&!moving;
    const action=finished&&!holding?(!state.grounded?'jump':'run'):state.action;
    return this.drew({
      ...server,
      x: previous.x+(state.x-previous.x)*blend+this.offset.x,
      y: previous.y+(state.y-previous.y)*blend+this.offset.y,
      z: previous.z+(state.z-previous.z)*blend+this.offset.z,
      yaw: state.yaw, grounded: state.grounded, guarding: state.guarding,
      chain: state.chain, dashKind: state.dashKind,
      branch: state.branch,
      confirmedAt: state.confirmedAt, whiffedAt: state.whiffedAt,
      action, actionSeq:state.actionSeq, actionStarted: playback?.started??state.actionStarted,
      actionDuration: holding?playback!.duration:finished?0:state.actionDuration,
      actionTime: holding?1:finished?0:playback?Math.min(1,playback.age/playback.duration):state.actionTime,
      actionFrozen: state.actionFrozen, hitstop: state.hitstop,
      hitstopFrom: state.hitstopFrom, hitstopUntil: state.hitstopUntil,
    });
  }
  private drew(shown:PlayerState){
    const hold=this.vanishHold;
    if(hold){if(this.visualTime<hold.at&&performance.now()<hold.until)shown={...shown,x:hold.x,y:hold.y,z:hold.z};else this.vanishHold=undefined;}
    if(this.lastDrawn){this.lastDrawn.x=shown.x;this.lastDrawn.y=shown.y;this.lastDrawn.z=shown.z;}else this.lastDrawn={x:shown.x,y:shown.y,z:shown.z};
    return shown;
  }
}
