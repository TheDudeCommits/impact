import * as THREE from 'three';
import type { AttackSlot, CombatEvent, FighterId } from '../../../game/types';
import { comboMove, type ComboKey } from '../../../game/combos';
import { MOVES, type MoveDefinition } from '../../../game/moves';
import type { Fighter } from '../../Fighter';
import type { Flight } from '../../CombatEffects';
import { bodyCentre } from '../VfxKit';
import { elementFor, type Element } from '../palette';
import { castAge, type HeldCast } from '../../signature/castClock';
import { involvesLocal } from '../../signature/context';
import type { CancelReason, CueContext, EffectAnchor, EffectFrame, EffectInstance, EffectRegistry, EffectType, Socket, StandardJoint, Tier } from './Effect';


export type CueOn = 'cast' | 'release' | 'hit' | 'confirm' | 'whiff' | 'land';
export type CueLife = 'move' | 'charge' | 'own';

export interface CueAnchorSpec {
  of?: 'actor' | 'target';
  joint?: StandardJoint;
  socket?: Socket;
  follow: boolean;
}

export interface Cue {
  on: CueOn;
  slot?: AttackSlot;
  branch?: ComboKey | 'any';
  contact?: number;
  at?: number;
  type: string;
  preset: string;
  anchor: CueAnchorSpec;
  params?: object;
  life?: CueLife;
}
export type CueTrack = readonly Cue[];

export interface CueDirectorOptions {
  registry: EffectRegistry;
  tracks: (fighter: FighterId, event: CombatEvent) => CueTrack | undefined;
  tier: () => Tier;
  density?: () => number;
  move?: (fighter: FighterId, slot: AttackSlot, branch?: ComboKey, awakened?: boolean) => Pick<MoveDefinition, 'contacts' | 'duration'> | undefined;
  palette?: (fighter: FighterId, slot: AttackSlot, awakened: boolean, branch?: ComboKey) => Element;
  slots?: number;
  light?: (x: number, y: number, z: number, hex: number, intensity: number, distance: number) => void;
}

const FREE = 0, ARMED = 1, LIVE = 2;
const EMPTY = Object.freeze({});
const CASTS = 24, SEEN = 256;

interface CastRecord extends HeldCast {
  used: boolean;
  actorId: string;
  fighter?: FighterId;
  slot?: AttackSlot;
  branch?: ComboKey;
  seq?: number;
  release: number;
  duration: number;
  flight: string;
  age: number;
  refs: number;
}

interface MutableAnchor { point: THREE.Vector3; fighter?: string; joint?: StandardJoint; socket?: Socket; flight?: string; follow: boolean; floor: number }
interface MutableCue { seed: number; palette: Element; preset: string; anchor: MutableAnchor; tier: Tier; density: number; local: boolean; actorId: string; targetId?: string; heading: THREE.Vector3 }

interface Slot {
  state: number;
  cue?: Cue;
  type?: EffectType<object>;
  instance?: EffectInstance<object>;
  cast?: CastRecord;
  trigger?: CombatEvent;
  dueTime: number;
  dueAge: number;
  startAge: number;
  startTime: number;
  life: CueLife;
  cancelled: boolean;
  readonly ctx: MutableCue;
}

const defaultMove = (fighter: FighterId, slot: AttackSlot, branch?: ComboKey, awakened = false) =>
  (branch ? comboMove(fighter, branch, awakened) : undefined) ?? MOVES[fighter]?.[slot];

const matches = (cue: Cue, e: CombatEvent) =>
  cue.on === e.kind && (cue.slot === undefined || cue.slot === e.slot)
  && (cue.branch === 'any' || cue.branch === e.branch)
  && (cue.contact === undefined || cue.contact === (e.contactIndex ?? 0));

export class CueDirector {
  dropped = 0;
  private readonly registry: EffectRegistry;
  private readonly tracks: CueDirectorOptions['tracks'];
  private readonly tier: () => Tier;
  private readonly density: () => number;
  private readonly moveOf: NonNullable<CueDirectorOptions['move']>;
  private readonly paletteOf: NonNullable<CueDirectorOptions['palette']>;
  private readonly slots: Slot[];
  private readonly casts: CastRecord[];
  private readonly seenId = new Float64Array(SEEN).fill(-1);
  private readonly seenAt = new Float64Array(SEEN).fill(-1);
  private seenCursor = 0;
  private readonly floors = new Map<string, number>();
  private last?: number;
  private disposed = false;
  private warned = new Set<string>();
  private readonly frame: EffectFrame & { time: number; fighters: ReadonlyMap<string, Fighter>; flights: ReadonlyMap<string, Flight> };

  constructor(options: CueDirectorOptions) {
    this.registry = options.registry;
    this.tracks = options.tracks;
    this.tier = options.tier;
    this.density = options.density ?? (() => 1);
    this.moveOf = options.move ?? defaultMove;
    this.paletteOf = options.palette ?? ((fighter, slot, awakened, branch) => elementFor(fighter, slot, awakened, 0, branch));
    this.slots = Array.from({ length: options.slots ?? 48 }, () => ({
      state: FREE, dueTime: 0, dueAge: -Infinity, startAge: 0, startTime: 0, life: 'own' as CueLife, cancelled: false,
      ctx: { seed: 0, palette: { spike: 0xffffff, rim: 0xffffff, light: 0xffffff, ink: 0 }, preset: '', tier: 'high' as Tier, density: 1, local: false, actorId: '',
        heading: new THREE.Vector3(0, 0, 1), anchor: { point: new THREE.Vector3(), follow: false, floor: 0 } },
    }));
    this.casts = Array.from({ length: CASTS }, () => ({
      used: false, event: undefined as unknown as CombatEvent, actorId: '', release: 0, duration: 0, flight: '', age: 0, refs: 0,
    }));
    const locate = (anchor: EffectAnchor, out: THREE.Vector3) => this.locate(anchor, out);
    this.frame = { time: 0, fighters: new Map(), flights: new Map(), locate, light: options.light };
  }

  get live() { let n = 0; for (const s of this.slots) if (s.state === LIVE) n++; return n; }
  get armed() { let n = 0; for (const s of this.slots) if (s.state === ARMED) n++; return n; }
  liveEffects() { return this.slots.filter(s => s.state === LIVE).map(s => ({ type: s.type!.id, actorId: s.ctx.actorId, targetId: s.ctx.targetId, cancelled: s.cancelled })); }

  handle(e: CombatEvent, _fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed || this.seen(e)) return;
    switch (e.kind) {
      case 'eliminated': this.knockedOut(e.actorId); return;
      case 'respawn': for (const s of this.slots) if (s.state !== FREE && (s.ctx.actorId === e.actorId || s.ctx.targetId === e.actorId || s.cast?.actorId === e.actorId || s.trigger?.targetId === e.actorId)) this.cancel(s, 'despawn'); return;
      case 'projectile-clash': this.clash(e.actorId); if (e.targetId) this.clash(e.targetId); return;
      case 'rejected': this.cutCast(e.actorId, e.slot, 'interrupt'); return;
    }
    const track = e.fighter ? this.tracks(e.fighter, e) : undefined;
    if (!track) return;
    if (e.kind === 'whiff') this.cutCast(e.actorId, e.slot, 'whiff');
    let cast: CastRecord | undefined;
    if (e.kind === 'cast') cast = this.record(e);
    else {
      cast = this.castOf(e);
      if (e.kind === 'release' && cast && cast.releasedAt === undefined) cast.releasedAt = e.serverTime;
    }
    for (const cue of track) if (matches(cue, e)) this.arm(cue, e, cast ?? this.standIn(e));
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const dt = this.last === undefined ? 0 : Math.max(0, Math.min(.1, time - this.last));
    this.last = time;
    const frame = this.frame; frame.time = time; frame.fighters = fighters; frame.flights = flights;
    for (const c of this.casts) if (c.used) c.age = castAge(c, time, fighters.get(c.actorId), c.release);
    for (const [id, f] of fighters) if (f.state?.grounded !== false || !this.floors.has(id)) this.floors.set(id, f.group.position.y);
    this.registry.begin(time);
    for (const s of this.slots) {
      if (s.state === ARMED) {
        if (this.cut(s, fighters) || time - s.dueTime > 8) { this.free(s); continue; }
        if (time < s.dueTime || (s.cast && s.cast.age < s.dueAge)) continue;
        this.begin(s, time, fighters, flights);
      }
      if (s.state !== LIVE) continue;
      if (!s.cancelled && this.cut(s, fighters)) { s.cancelled = true; s.instance!.cancel('interrupt'); }
      const age = s.cast ? s.cast.age - s.startAge : time - s.startTime;
      let alive = false;
      try { alive = s.instance!.update(Math.max(0, age), dt, frame); }
      catch (error) { console.warn(`CueDirector: ${s.type?.id} failed`, error); }
      if (!alive) this.free(s);
    }
    this.registry.end();
    for (const c of this.casts) if (c.used && c.refs <= 0 && time - c.event.serverTime > c.duration + 2) c.used = false;
  }

  reset() {
    for (const s of this.slots) if (s.state !== FREE) this.cancel(s, 'despawn');
    for (const c of this.casts) { c.used = false; c.refs = 0; }
    this.seenId.fill(-1); this.seenAt.fill(-1); this.seenCursor = 0; this.last = undefined; this.floors.clear();
    this.registry.reset();
  }

  dispose() {
    if (this.disposed) return;
    this.reset();
    this.disposed = true;
    this.registry.dispose();
  }

  locate(anchor: EffectAnchor, out: THREE.Vector3): boolean {
    if (!anchor.follow || anchor.socket === 'origin' || anchor.socket === 'endpoint') { out.copy(anchor.point); return true; }
    if (anchor.socket === 'flight') {
      const flight = anchor.flight ? this.frame.flights.get(anchor.flight) : undefined;
      if (!flight) { out.copy(anchor.point); return false; }
      out.copy(flight.position); return true;
    }
    const body = anchor.fighter ? this.frame.fighters.get(anchor.fighter) : undefined;
    if (!body) { out.copy(anchor.point); return false; }
    this.bodyPoint(body, anchor.joint, anchor.socket, anchor.floor, out);
    return true;
  }


  private seen(e: CombatEvent) {
    for (let i = 0; i < SEEN; i++) if (this.seenId[i] === e.id && this.seenAt[i] === e.serverTime) return true;
    const i = this.seenCursor++ % SEEN; this.seenId[i] = e.id; this.seenAt[i] = e.serverTime;
    return false;
  }

  private record(e: CombatEvent): CastRecord {
    let c = this.casts.find(r => !r.used);
    if (!c) {
      c = this.casts.reduce((a, b) => (a.refs > 0) !== (b.refs > 0) ? (a.refs > 0 ? b : a) : a.event.serverTime <= b.event.serverTime ? a : b);
      for (const s of this.slots) if (s.cast === c && s.state !== FREE) this.cancel(s, 'despawn');
    }
    const move = e.fighter && e.slot ? this.moveOf(e.fighter, e.slot, e.branch) : undefined;
    Object.assign(c, { used: true, event: e, actorId: e.actorId, fighter: e.fighter, slot: e.slot, branch: e.branch, seq: e.actionSeq,
      release: move?.contacts[0] ?? 0, duration: move?.duration ?? 1, flight: `${e.id}:0`, age: 0, refs: 0,
      hold: undefined, releasedAt: undefined, drawn: undefined });
    return c;
  }

  private castOf(e: CombatEvent): CastRecord | undefined {
    let best: CastRecord | undefined;
    for (const c of this.casts) {
      if (!c.used || c.actorId !== e.actorId || (e.slot && c.slot !== e.slot) || c.event.serverTime > e.serverTime + 1e-6) continue;
      if (e.actionSeq !== undefined && c.seq !== undefined && e.actionSeq !== c.seq) continue;
      if (e.serverTime - c.event.serverTime > c.duration + 4) continue;
      if (!best || c.event.serverTime > best.event.serverTime) best = c;
    }
    return best;
  }

  private standIn(e: CombatEvent): CastRecord {
    const move = e.fighter && e.slot ? this.moveOf(e.fighter, e.slot, e.branch) : undefined;
    const into = e.kind === 'confirm' || e.kind === 'whiff' ? e.castAge ?? move?.contacts[0] ?? 0
      : e.kind === 'hit' ? move?.contacts[Math.min(move.contacts.length - 1, e.contactIndex ?? 0)] ?? 0
      : e.kind === 'release' ? move?.contacts[0] ?? 0 : 0;
    const stand: CombatEvent = { id: -e.id - 1, kind: 'cast', serverTime: e.serverTime - into, actorId: e.actorId, fighter: e.fighter, slot: e.slot, branch: e.branch, actionSeq: e.actionSeq, origin: e.origin, endpoint: e.endpoint };
    const c = this.record(stand);
    if (e.kind === 'release') c.releasedAt = e.serverTime;
    return c;
  }

  private arm(cue: Cue, e: CombatEvent, cast: CastRecord) {
    const type = this.registry.get(cue.type) as EffectType<object> | undefined;
    if (!type) { if (!this.warned.has(cue.type)) { this.warned.add(cue.type); console.warn(`CueDirector: no effect type '${cue.type}'`); } return; }
    const s = this.slots.find(x => x.state === FREE);
    if (!s) { this.dropped++; return; }
    s.state = ARMED; s.cue = cue; s.type = type; s.trigger = e; s.cast = cast; cast.refs++;
    s.dueTime = e.serverTime; s.dueAge = cue.at ?? -Infinity; s.life = cue.life ?? (cue.on === 'cast' ? 'charge' : 'own'); s.cancelled = false;
  }

  private begin(s: Slot, time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    const instance = s.type!.acquire();
    if (!instance) { this.dropped++; this.free(s); return; }
    const e = s.trigger!, cast = s.cast!, cue = s.cue!, ctx = s.ctx, a = ctx.anchor, spec = cue.anchor;
    const castEvent = cast.event, actor = fighters.get(e.actorId), fighter = (e.fighter ?? castEvent.fighter) as FighterId;
    const who = spec.of === 'target' ? e.targetId ?? castEvent.targetId : e.actorId;
    ctx.seed = castEvent.seed ?? e.seed ?? castEvent.id;
    ctx.palette = this.paletteOf(fighter, (e.slot ?? castEvent.slot ?? 'light') as AttackSlot, !!actor?.state.awakened, e.branch ?? castEvent.branch);
    ctx.preset = cue.preset; ctx.tier = this.tier(); ctx.density = this.density();
    ctx.actorId = e.actorId; ctx.targetId = e.targetId ?? castEvent.targetId;
    ctx.local = involvesLocal(e.actorId, ctx.targetId);
    const from = e.origin && e.endpoint ? e : castEvent;
    if (from.origin && from.endpoint) ctx.heading.set(from.endpoint.x - from.origin.x, 0, from.endpoint.z - from.origin.z);
    else ctx.heading.set(Math.sin(actor?.state.yaw ?? 0), 0, Math.cos(actor?.state.yaw ?? 0));
    if (ctx.heading.lengthSq() < 1e-8) ctx.heading.set(0, 0, 1);
    ctx.heading.normalize();
    a.fighter = who; a.joint = spec.joint; a.socket = spec.socket ?? (spec.joint ? undefined : 'centre'); a.follow = spec.follow;
    a.flight = a.socket === 'flight' ? cast.flight : undefined;
    a.floor = this.floors.get(e.actorId) ?? (actor ? actor.group.position.y : castEvent.origin ? castEvent.origin.y - 1.05 : 0);
    if (a.socket === 'origin' || a.socket === 'endpoint') {
      const p = (a.socket === 'origin' ? e.origin ?? castEvent.origin : e.endpoint ?? castEvent.endpoint);
      if (p) a.point.set(p.x, p.y, p.z); else if (actor) bodyCentre(actor, a.point); else a.point.set(0, a.floor + 1, 0);
    } else if (a.socket === 'flight') {
      const flight = a.flight ? flights.get(a.flight) : undefined;
      if (flight) a.point.copy(flight.position);
      else if (actor) a.point.copy(actor.handR);
      else if (castEvent.origin) a.point.set(castEvent.origin.x, castEvent.origin.y, castEvent.origin.z);
    } else {
      const body = who ? fighters.get(who) : undefined;
      if (body) this.bodyPoint(body, a.joint, a.socket, a.floor, a.point);
      else {
        const p = spec.of === 'target' ? e.endpoint ?? castEvent.endpoint : e.origin ?? castEvent.origin;
        if (!p) { s.type = undefined; instance.release(); this.free(s); return; }
        a.point.set(p.x, a.socket === 'floor' ? a.floor : p.y, p.z);
      }
    }
    s.instance = instance; s.state = LIVE; s.startTime = time;
    s.startAge = s.dueAge > -Infinity ? s.dueAge : cast.age;
    instance.start((cue.params ?? EMPTY) as object, ctx as unknown as CueContext);
  }

  private bodyPoint(body: Fighter, joint: StandardJoint | undefined, socket: Socket | undefined, floor: number, out: THREE.Vector3) {
    if (joint) {
      const bone = (body as Fighter & { drawnJoint?(name: string): THREE.Object3D | undefined }).drawnJoint?.(joint) ?? body.joints?.get(joint);
      if (bone) { bone.getWorldPosition(out); return; }
      bodyCentre(body, out); return;
    }
    switch (socket) {
      case 'floor': {
        const p = body.group.position;
        out.set(p.x, body.state?.grounded === false ? Math.min(p.y, floor) : p.y, p.z); return;
      }
      case 'strike': if (typeof body.strikePoint === 'function') { body.strikePoint(out); return; } break;
      case 'hand': out.copy(body.handR); return;
    }
    bodyCentre(body, out);
  }


  private cut(s: Slot, fighters: ReadonlyMap<string, Fighter>) {
    if (s.life === 'own' && (s.state === LIVE || s.dueAge === -Infinity)) return false;
    const c = s.cast; if (!c) return false;
    const st = fighters.get(c.actorId)?.state;
    if (!st || st.alive === false) return true;
    if (s.life === 'charge' && s.state === LIVE && c.age >= c.release) return false;
    const same = st.action === c.slot && (c.seq === undefined || st.actionSeq === undefined || st.actionSeq === c.seq);
    if (same) return false;
    return c.age < (s.life === 'charge' ? c.release : c.duration) - .1;
  }

  private cancel(s: Slot, reason: CancelReason) {
    if (s.state === ARMED) { this.free(s); return; }
    if (s.state !== LIVE) return;
    if (reason === 'despawn') { s.instance!.cancel('despawn'); this.free(s); return; }
    if (!s.cancelled) { s.cancelled = true; s.instance!.cancel(reason); }
  }

  private cutCast(actorId: string, slot: AttackSlot | undefined, reason: CancelReason) {
    for (const s of this.slots) {
      if (s.state === FREE || s.cast?.actorId !== actorId || (slot && s.cast.slot !== slot)) continue;
      if (s.state === ARMED || s.life !== 'own') this.cancel(s, reason);
    }
  }

  private knockedOut(id: string) {
    for (const s of this.slots) {
      if (s.state === FREE || s.cast?.actorId !== id) continue;
      if (s.state === ARMED) { if (s.dueAge > -Infinity || s.life !== 'own') this.free(s); }
      else if (s.life !== 'own' && !(s.life === 'charge' && s.cast.age >= s.cast.release)) this.cancel(s, 'interrupt');
    }
  }

  private clash(id: string) {
    for (const s of this.slots) if (s.state !== FREE && s.cast?.actorId === id && s.cue?.anchor.socket === 'flight') this.cancel(s, 'clash');
  }

  private free(s: Slot) {
    if (s.state === LIVE) s.instance?.release();
    if (s.cast) s.cast.refs--;
    s.state = FREE; s.instance = undefined; s.cast = undefined; s.trigger = undefined; s.cue = undefined; s.type = undefined; s.cancelled = false;
    s.ctx.targetId = undefined;
  }
}
