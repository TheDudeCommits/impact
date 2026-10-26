import type { ExternalBlow, ExternalBody, ExternalTargets } from '../../game/simulation';
import type { MoveDefinition } from '../../game/moves';
import type { ReactionKind, Vec3 } from '../../game/types';
import { GRUNTS, type GruntKind, type GruntMove } from './kinds';

export const GS = {
  FREE: 0, SPAWN: 1, MOVE: 2, ATTACK: 3, FLINCH: 4, KNOCK: 5, AIR: 6, DOWN: 7, GETUP: 8, STUN: 9, DEAD: 10, CHARGE: 11,
} as const;
export const GF = {
  ELITE: 1, BURNING: 2, FROZEN: 4, TELEGRAPH: 8, STOPPED: 16, ENRAGED: 32, ARMOURED: 64,
  AFFIX: 896,
  BROKEN: 1024,
} as const;
export const AFFIX_SHIFT = 7;
export const DEATH = { COLLAPSE: 0, BLOWN: 1, SLICED: 2, BURST: 3, ASH: 4 } as const;
export const GORE = { HEAD: 1, ARM_L: 2, ARM_R: 4, WAIST: 8 } as const;

export const HORDE_CAPACITY = 320;
const CELL = 2;
const GRAVITY = 23;
const HOLD_MAX = .22, HOLD_REFILL = .45;
const LAUNCH_GRAVITY = .68;
const JUGGLE_LIFT = 6.2, JUGGLE_DECAY = .24, MAX_JUGGLE = 5;
const SPAWN_SECONDS = .75;
const CORPSE_SECONDS = 3.2;
const HERO_RADIUS = .45;
export const PACK_WAKE = 13;
const PACK_ROAM = 2.6;

export interface HordeHero {
  id: string; x: number; y: number; z: number;
  standing: boolean;
  airborne: boolean;
}
export interface HordeWorld {
  halfX: number; halfZ: number;
  circles: readonly { x: number; z: number; r: number }[];
  boxes: readonly { x: number; z: number; hx: number; hz: number }[];
}
export interface HordeHooks {
  strike(gruntId: string, heroId: string, move: MoveDefinition, origin: Vec3, heavy: boolean): void;
  killed(slot: number, killer: string | undefined): void;
  summon?(slot: number, count: number): void;
}
export type HordeEventKind = 'spawn' | 'death' | 'windup' | 'shot' | 'slam' | 'explode' | 'bark' | 'topple' | 'mend' | 'summon' | 'block' | 'guardbreak';
export interface HordeEvent { id: number; at: number; kind: HordeEventKind; slot: number; serial: number; type: number; x: number; y: number; z: number; value: number; extra: number }

export interface SpawnOptions { hp?: number; damage?: number; speed?: number; elite?: boolean; target?: number; yaw?: number; pack?: number; dormant?: boolean; affix?: number }

export class Horde implements ExternalTargets {
  readonly capacity: number;
  readonly serial: Uint32Array;
  readonly kind: Uint8Array;
  readonly state: Uint8Array;
  readonly stateAt: Float64Array;
  readonly stateUntil: Float64Array;
  readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array;
  readonly vx: Float32Array; readonly vz: Float32Array; readonly vy: Float32Array;
  readonly kx: Float32Array; readonly kz: Float32Array;
  readonly yaw: Float32Array;
  readonly hp: Float32Array; readonly maxHp: Float32Array;
  readonly poise: Float32Array; readonly poiseMax: Float32Array;
  readonly damageScale: Float32Array; readonly speedScale: Float32Array;
  readonly target: Int8Array; readonly retargetAt: Float32Array;
  readonly nextAttack: Float32Array;
  readonly move: Uint8Array; readonly struck: Uint8Array;
  readonly freezeUntil: Float64Array; readonly stopUntil: Float64Array;
  readonly holdLeft: Float32Array; readonly holdAt: Float64Array;
  readonly frostUntil: Float64Array;
  readonly juggle: Uint8Array;
  readonly ring: Float32Array; readonly seed: Float32Array;
  readonly flags: Uint16Array;
  readonly hitAt: Float64Array;
  readonly lastHitAt: Float64Array;
  readonly burnUntil: Float64Array; readonly burnDps: Float32Array; readonly burnNext: Float64Array;
  readonly death: Uint8Array; readonly gore: Uint8Array;
  readonly chargeX: Float32Array; readonly chargeZ: Float32Array;
  readonly toppledAt: Float64Array;
  readonly pack: Int16Array;
  readonly homeX: Float32Array; readonly homeZ: Float32Array;
  readonly dormant: Uint8Array;
  private readonly roamAt: Float32Array; private readonly roamX: Float32Array; private readonly roamZ: Float32Array;
  private readonly woken = new Set<number>();
  private readonly lastHitBy: (string | undefined)[];
  readonly lastMove: string[];
  private readonly burnBy: (string | undefined)[];
  readonly ids: string[];
  private readonly bySerial = new Map<number, number>();
  private readonly free: number[] = [];
  private nextSerial = 0;
  alive = 0;
  private cols = 1; private rows = 1; private originX = 0; private originZ = 0;
  private head = new Int32Array(1);
  private readonly next: Int32Array;
  readonly shots: { active: boolean; slot: number; serial: number; type: number; move: number; x: number; y: number; z: number; px: number; py: number; pz: number; vx: number; vy: number; vz: number; life: number; damage: number; id: number }[] = [];
  private shotSerial = 0;
  private readonly bodies: ExternalBody[];
  private readonly events: HordeEvent[] = [];
  private eventSerial = 0;
  private readonly moveDefs: MoveDefinition[][];
  world: HordeWorld = { halfX: 30, halfZ: 30, circles: [], boxes: [] };
  heroes: readonly HordeHero[] = [];
  aggression = 0;
  summonCap = HORDE_CAPACITY - 60;
  private readonly leapt: Uint8Array;
  holdUntil = 0;
  now = 0;
  private readonly blows = new Float32Array(8);
  private readonly volleys = new Float32Array(8);

  constructor(private readonly random: () => number, private readonly hooks: HordeHooks, capacity = HORDE_CAPACITY) {
    this.capacity = capacity;
    const f32 = () => new Float32Array(capacity), f64 = () => new Float64Array(capacity), u8 = () => new Uint8Array(capacity);
    this.serial = new Uint32Array(capacity); this.kind = u8(); this.state = u8(); this.stateAt = f64(); this.stateUntil = f64();
    this.x = f32(); this.y = f32(); this.z = f32(); this.vx = f32(); this.vz = f32(); this.vy = f32(); this.kx = f32(); this.kz = f32();
    this.yaw = f32(); this.hp = f32(); this.maxHp = f32(); this.poise = f32(); this.poiseMax = f32(); this.damageScale = f32(); this.speedScale = f32();
    this.target = new Int8Array(capacity); this.retargetAt = f32(); this.nextAttack = f32(); this.move = u8(); this.struck = u8();
    this.freezeUntil = f64(); this.stopUntil = f64(); this.holdLeft = f32(); this.holdAt = f64(); this.frostUntil = f64(); this.juggle = u8(); this.ring = f32(); this.seed = f32(); this.flags = new Uint16Array(capacity);
    this.hitAt = f64(); this.lastHitAt = f64(); this.burnUntil = f64(); this.burnDps = f32(); this.burnNext = f64(); this.death = u8(); this.gore = u8();
    this.chargeX = f32(); this.chargeZ = f32(); this.toppledAt = f64();
    this.pack = new Int16Array(capacity).fill(-1); this.homeX = f32(); this.homeZ = f32(); this.dormant = u8();
    this.roamAt = f32(); this.roamX = f32(); this.roamZ = f32();
    this.lastHitBy = new Array(capacity).fill(undefined); this.burnBy = new Array(capacity).fill(undefined); this.ids = new Array(capacity).fill('');
    this.lastMove = new Array(capacity).fill('');
    this.leapt = new Uint8Array(capacity);
    this.next = new Int32Array(capacity);
    this.bodies = Array.from({ length: capacity }, () => ({ id: '', x: 0, y: 0, z: 0, radius: .4, height: 1.8, airborne: false }));
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);
    for (let i = 0; i < 48; i++) this.shots.push({ active: false, slot: 0, serial: 0, type: 0, move: 0, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, life: 0, damage: 0, id: 0 });
    this.moveDefs = GRUNTS.map(kind => kind.moves.map(move => toMoveDefinition(move)));
    this.setWorld(this.world);
  }

  setWorld(world: HordeWorld) {
    this.world = world;
    const margin = 6;
    this.originX = -world.halfX - margin; this.originZ = -world.halfZ - margin;
    this.cols = Math.ceil((world.halfX + margin) * 2 / CELL); this.rows = Math.ceil((world.halfZ + margin) * 2 / CELL);
    this.head = new Int32Array(this.cols * this.rows);
  }

  spawn(type: number, x: number, z: number, options: SpawnOptions = {}): number | undefined {
    const slot = this.free.pop();
    if (slot === undefined) return undefined;
    const kind = GRUNTS[type];
    const serial = ++this.nextSerial;
    this.serial[slot] = serial; this.ids[slot] = `g${serial}`; this.bySerial.set(serial, slot);
    this.kind[slot] = type;
    this.x[slot] = x; this.z[slot] = z; this.y[slot] = kind.hover ?? 0;
    this.vx[slot] = this.vz[slot] = this.vy[slot] = this.kx[slot] = this.kz[slot] = 0;
    this.yaw[slot] = options.yaw ?? 0;
    const hp = kind.hp * (options.hp ?? 1) * (options.elite ? 3.2 : 1);
    this.hp[slot] = this.maxHp[slot] = hp;
    this.poise[slot] = this.poiseMax[slot] = (kind.poise ?? 0) * (options.hp ?? 1) * (options.elite ? 2 : 1);
    this.damageScale[slot] = (options.damage ?? 1) * (options.elite ? 1.35 : 1);
    this.speedScale[slot] = (options.speed ?? 1) * (options.elite ? 1.08 : 1);
    this.target[slot] = options.target ?? -1; this.retargetAt[slot] = 0;
    this.nextAttack[slot] = this.now + SPAWN_SECONDS + .2 + this.random() * .8;
    this.move[slot] = 0; this.struck[slot] = 0; this.juggle[slot] = 0;
    this.freezeUntil[slot] = this.stopUntil[slot] = this.frostUntil[slot] = 0; this.holdLeft[slot] = HOLD_MAX; this.holdAt[slot] = this.now;
    this.ring[slot] = this.random() * Math.PI * 2; this.seed[slot] = this.random();
    this.flags[slot] = (options.elite ? GF.ELITE : 0) | ((options.affix ?? 0) << AFFIX_SHIFT & GF.AFFIX);
    this.hitAt[slot] = -10; this.lastHitAt[slot] = -10; this.lastHitBy[slot] = undefined; this.lastMove[slot] = '';
    this.burnUntil[slot] = 0; this.burnDps[slot] = 0; this.burnNext[slot] = 0; this.burnBy[slot] = undefined;
    this.death[slot] = 0; this.gore[slot] = 0; this.toppledAt[slot] = -10;
    this.pack[slot] = options.pack ?? -1; this.homeX[slot] = this.roamX[slot] = x; this.homeZ[slot] = this.roamZ[slot] = z;
    this.dormant[slot] = options.dormant ? 1 : 0; this.roamAt[slot] = this.now + this.random() * 3;
    this.alive++;
    if (options.dormant) { this.enter(slot, GS.MOVE, 0); return slot; }
    this.enter(slot, GS.SPAWN, SPAWN_SECONDS);
    this.emit('spawn', slot, 0, 0);
    return slot;
  }

  private release(slot: number) {
    this.bySerial.delete(this.serial[slot]);
    this.pack[slot] = -1; this.dormant[slot] = 0;
    this.state[slot] = GS.FREE; this.ids[slot] = ''; this.lastHitBy[slot] = undefined; this.burnBy[slot] = undefined;
    this.free.push(slot);
  }

  forgetTargets() { this.target.fill(-1); this.retargetAt.fill(0); }

  clear() {
    for (let i = 0; i < this.capacity; i++) if (this.state[i] !== GS.FREE) this.release(i);
    for (const shot of this.shots) shot.active = false;
    this.alive = 0; this.woken.clear();
  }

  recall(slot: number) {
    if (!this.isAlive(slot)) return;
    this.alive--;
    this.death[slot] = DEATH.ASH; this.gore[slot] = 0;
    this.kx[slot] = this.kz[slot] = 0; this.vx[slot] = this.vz[slot] = 0;
    this.flags[slot] &= ~(GF.TELEGRAPH | GF.BURNING);
    this.dormant[slot] = 0;
    this.enter(slot, GS.DEAD, CORPSE_SECONDS * .5);
    this.emit('death', slot, DEATH.ASH, 0);
  }

  wake(pack: number) {
    if (pack < 0) return;
    let barked = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.pack[i] !== pack || !this.dormant[i] || !this.isAlive(i)) continue;
      this.dormant[i] = 0; this.retargetAt[i] = 0;
      this.nextAttack[i] = Math.max(this.nextAttack[i], this.now + .35 + this.random() * .7);
      if (!barked) { barked = true; this.emit('bark', i, 3, 0); }
    }
    this.woken.add(pack);
  }
  roused(): number[] { const out = [...this.woken]; this.woken.clear(); return out; }
  packCount(pack: number): { left: number; waiting: number } {
    let left = 0, waiting = 0;
    for (let i = 0; i < this.capacity; i++) if (this.pack[i] === pack && this.isAlive(i)) { left++; if (this.dormant[i]) waiting++; }
    return { left, waiting };
  }

  slotOf(id: string | number): number | undefined {
    const serial = typeof id === 'number' ? id : id.charCodeAt(0) === 103 ? Number(id.slice(1)) : NaN;
    return this.bySerial.get(serial);
  }
  kindOf(slot: number): GruntKind { return GRUNTS[this.kind[slot]]; }
  isAlive(slot: number) { const s = this.state[slot]; return s !== GS.FREE && s !== GS.DEAD; }
  idOf(slot: number) { return this.ids[slot]; }
  swinging(slot: number) {
    if (this.state[slot] !== GS.ATTACK || this.struck[slot]) return false;
    const move = GRUNTS[this.kind[slot]].moves[this.move[slot]];
    const scale = (this.stateUntil[slot] - this.stateAt[slot]) / move.duration;
    return this.now - this.stateAt[slot] > move.contact * scale * .45;
  }

  private hittable(slot: number) { const s = this.state[slot]; return s !== GS.FREE && s !== GS.DEAD && !(s === GS.SPAWN && this.now - this.stateAt[slot] < SPAWN_SECONDS * .45); }

  private body(slot: number): ExternalBody {
    const body = this.bodies[slot], kind = GRUNTS[this.kind[slot]];
    body.id = this.ids[slot]; body.x = this.x[slot]; body.y = this.y[slot]; body.z = this.z[slot];
    body.radius = kind.radius * (this.flags[slot] & GF.ELITE ? 1.15 : 1); body.height = kind.height * (this.flags[slot] & GF.ELITE ? 1.15 : 1);
    body.airborne = this.state[slot] === GS.AIR || this.y[slot] > (kind.hover ?? 0) + .25;
    return body;
  }

  query(a: Vec3, b: Vec3, radius: number, out: ExternalBody[]): number {
    const minX = Math.min(a.x, b.x) - radius, maxX = Math.max(a.x, b.x) + radius;
    const minZ = Math.min(a.z, b.z) - radius, maxZ = Math.max(a.z, b.z) + radius;
    const c0 = Math.max(0, Math.floor((minX - this.originX) / CELL)), c1 = Math.min(this.cols - 1, Math.floor((maxX - this.originX) / CELL));
    const r0 = Math.max(0, Math.floor((minZ - this.originZ) / CELL)), r1 = Math.min(this.rows - 1, Math.floor((maxZ - this.originZ) / CELL));
    let n = 0;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      for (let i = this.head[r * this.cols + c]; i >= 0; i = this.next[i]) {
        if (!this.hittable(i)) continue;
        out[n++] = this.body(i);
      }
    }
    return n;
  }

  locate(id: string): ExternalBody | undefined {
    const slot = this.slotOf(id);
    return slot !== undefined && this.hittable(slot) ? this.body(slot) : undefined;
  }

  freeze(centre: Vec3, radius: number, seconds: number) {
    for (let i = 0; i < this.capacity; i++) {
      if (!this.isAlive(i) || Math.hypot(this.x[i] - centre.x, this.z[i] - centre.z) > radius) continue;
      this.stopUntil[i] = Math.max(this.stopUntil[i], this.now + seconds);
    }
  }

  chill(slot: number, seconds: number) {
    if (!this.isAlive(slot)) return;
    this.frostUntil[slot] = Math.max(this.frostUntil[slot], this.now + seconds);
    this.stopUntil[slot] = Math.max(this.stopUntil[slot], this.now + seconds);
    this.flags[slot] = (this.flags[slot] | GF.FROZEN) & ~GF.TELEGRAPH;
  }
  frozen(slot: number) { return this.now < this.frostUntil[slot] && this.isAlive(slot); }

  receive(body: ExternalBody, blow: ExternalBlow): { damage: number; reaction?: ReactionKind; killed: boolean } | null {
    const slot = this.slotOf(body.id);
    if (slot === undefined || !this.hittable(slot)) return null;
    const kind = GRUNTS[this.kind[slot]];
    let damage = Math.max(1, Math.round(blow.damage * (kind.damageIn ?? 1)));
    if (this.dormant[slot]) this.wake(this.pack[slot]);
    if (kind.shield && !(this.flags[slot] & GF.BROKEN) && this.state[slot] !== GS.AIR) {
      const front = -(blow.pushX * Math.sin(this.yaw[slot]) + blow.pushZ * Math.cos(this.yaw[slot]));
      if (front > .35) {
        this.hitAt[slot] = this.now; this.lastHitAt[slot] = this.now; this.lastHitBy[slot] = blow.attackerId; this.lastMove[slot] = blow.move.name;
        if (!(blow.slot === 'heavy' || blow.slot === 'special' || blow.slot === 'ultimate' || blow.move.guardBreak)) {
          const chip = Math.max(1, Math.round(damage * .12));
          this.hp[slot] = Math.max(1, this.hp[slot] - chip);
          this.kx[slot] += blow.pushX * 1.2; this.kz[slot] += blow.pushZ * 1.2;
          this.emit('block', slot, 0, 0);
          return { damage: chip, killed: false };
        }
        this.flags[slot] = (this.flags[slot] | GF.BROKEN) & ~GF.TELEGRAPH;
        this.emit('guardbreak', slot, 0, 0);
        damage = Math.max(1, Math.round(damage * .6));
        this.hp[slot] = Math.max(0, this.hp[slot] - damage);
        if (this.hp[slot] <= 0) { this.die(slot, blow, blow.knockback / kind.mass); return { damage, killed: true, reaction: 'launched' }; }
        this.enter(slot, GS.STUN, 1.2);
        return { damage, killed: false, reaction: 'stun' };
      }
    }
    this.hp[slot] = Math.max(0, this.hp[slot] - damage);
    this.hitAt[slot] = this.now; this.lastHitAt[slot] = this.now; this.lastHitBy[slot] = blow.attackerId; this.lastMove[slot] = blow.move.name;
    const heavyBlow = blow.slot === 'special' || blow.slot === 'ultimate' || (blow.finisher && blow.knockback >= 6);
    const push = blow.knockback * (blow.finisher ? 1 : .35) / kind.mass;
    if (this.hp[slot] <= 0) {
      this.die(slot, blow, push);
      return { damage, killed: true, reaction: 'launched' };
    }
    const since = Math.max(0, this.now - Math.max(this.holdAt[slot], this.freezeUntil[slot]));
    const left = Math.min(HOLD_MAX, this.holdLeft[slot] + since * HOLD_REFILL);
    const held = Math.max(0, this.freezeUntil[slot] - this.now);
    const wanted = blow.hitstop * Math.min(1.25, Math.max(.75, .7 + damage / 200));
    const extra = Math.min(Math.max(0, wanted - held), left);
    this.holdLeft[slot] = left - extra; this.holdAt[slot] = this.now;
    if (extra > 0) this.freezeUntil[slot] = this.now + held + extra;
    if (this.poise[slot] > 0 && !heavyBlow) {
      this.poise[slot] = Math.max(0, this.poise[slot] - damage * (blow.slot === 'heavy' ? 1.6 : 1));
      if (this.poise[slot] > 0) { this.kx[slot] += blow.pushX * push * .15; this.kz[slot] += blow.pushZ * push * .15; return { damage, killed: false }; }
      this.enter(slot, GS.STUN, 2.2); this.flags[slot] &= ~GF.TELEGRAPH;
      this.emit('bark', slot, 2, 0);
      return { damage, killed: false, reaction: 'stun' };
    }
    const airborne = this.state[slot] === GS.AIR || this.y[slot] > (kind.hover ?? 0) + .25;
    this.flags[slot] &= ~GF.TELEGRAPH;
    this.struck[slot] = 1;
    if ((airborne && this.juggle[slot] < MAX_JUGGLE) || (blow.launch && kind.mass < 3)) {
      if (airborne) { this.juggle[slot]++; this.vy[slot] = Math.max(this.vy[slot], JUGGLE_LIFT * Math.max(.25, 1 - (this.juggle[slot] - 1) * JUGGLE_DECAY)); }
      else { this.juggle[slot] = 0; this.vy[slot] = blow.slot === 'ultimate' ? 11 : blow.slot === 'special' ? 9.5 : blow.slot === 'heavy' ? 8.2 : 7.5; }
      this.kx[slot] = blow.pushX * push * .6; this.kz[slot] = blow.pushZ * push * .6;
      this.enter(slot, GS.AIR, 9);
      return { damage, killed: false, reaction: 'launched' };
    }
    this.kx[slot] += blow.pushX * push; this.kz[slot] += blow.pushZ * push;
    if (push >= 5.5 || heavyBlow) { this.enter(slot, GS.KNOCK, Math.max(.5, blow.stun * 1.4)); return { damage, killed: false, reaction: 'hurt' }; }
    this.enter(slot, GS.FLINCH, Math.max(.26, blow.stun * 1.15));
    return { damage, killed: false, reaction: 'flinch' };
  }

  ignite(slot: number, dps: number, seconds: number, by: string) {
    if (!this.isAlive(slot)) return;
    this.burnUntil[slot] = this.now + seconds; this.burnDps[slot] = Math.max(this.burnDps[slot] * (this.burnUntil[slot] > this.now ? 1 : 0), dps);
    this.burnNext[slot] = Math.min(this.burnNext[slot] || Infinity, this.now + .5); this.burnBy[slot] = by;
  }

  stagger(slot: number, seconds: number) {
    if (!this.isAlive(slot) || this.state[slot] === GS.AIR) return;
    this.flags[slot] &= ~GF.TELEGRAPH;
    this.enter(slot, GS.STUN, seconds);
  }

  damage(slot: number, amount: number, by?: string) {
    if (!this.isAlive(slot)) return 0;
    if (this.dormant[slot]) this.wake(this.pack[slot]);
    const before = this.hp[slot];
    this.hp[slot] = Math.max(0, before - amount);
    if (by) this.lastHitBy[slot] = by;
    this.lastMove[slot] = '';
    if (this.hp[slot] <= 0) this.die(slot, undefined, 2);
    return before - this.hp[slot];
  }

  private die(slot: number, blow: ExternalBlow | undefined, push: number) {
    const kind = GRUNTS[this.kind[slot]];
    this.alive--;
    const roll = this.random();
    let style: number = DEATH.COLLAPSE, gore = 0;
    const burning = this.burnUntil[slot] > this.now;
    if (!blow) style = burning ? DEATH.ASH : DEATH.COLLAPSE;
    else if (blow.move.style === 'beam' || blow.move.style === 'bomb' || blow.move.style === 'field') style = roll < .6 ? DEATH.BURST : DEATH.BLOWN;
    else if (blow.slot === 'ultimate' || push >= 8 || blow.launch) style = roll < .3 && blow.move.style === 'melee' ? DEATH.SLICED : DEATH.BLOWN;
    else if (blow.move.style === 'melee' && (blow.finisher || blow.slot !== 'light') && roll < .62) style = DEATH.SLICED;
    else if (blow.move.style === 'melee' && roll < .22) style = DEATH.SLICED;
    if (style === DEATH.SLICED) {
      const cut = this.random();
      gore = cut < .38 ? GORE.HEAD : cut < .6 ? GORE.ARM_R : cut < .78 ? GORE.ARM_L : cut < .9 ? GORE.WAIST : GORE.HEAD | GORE.ARM_L;
    }
    if (burning && style === DEATH.COLLAPSE) style = DEATH.ASH;
    this.death[slot] = style; this.gore[slot] = gore;
    if (blow) {
      const fling = Math.min(16, push * (style === DEATH.BLOWN ? 2.2 : 1.1) + 1.5);
      this.kx[slot] = blow.pushX * fling; this.kz[slot] = blow.pushZ * fling;
      this.vy[slot] = style === DEATH.BLOWN ? Math.min(10, 4.5 + push * .55) : this.y[slot] > .3 ? Math.max(this.vy[slot], 1) : 1.2;
    }
    this.flags[slot] &= ~(GF.TELEGRAPH | GF.BURNING);
    this.enter(slot, GS.DEAD, CORPSE_SECONDS);
    this.emit('death', slot, style, gore);
    this.hooks.killed(slot, this.lastHitBy[slot] ?? this.burnBy[slot]);
    void kind;
  }

  step(dt: number, now: number) {
    this.now = now;
    this.think(dt);
    this.integrate(dt);
    this.rebuild();
    this.separate();
    this.flyShots(dt);
  }

  private enter(slot: number, state: number, seconds: number) {
    this.state[slot] = state; this.stateAt[slot] = this.now; this.stateUntil[slot] = this.now + seconds;
  }

  private emit(kind: HordeEventKind, slot: number, value: number, extra: number) {
    this.events.push({ id: ++this.eventSerial, at: this.now, kind, slot, serial: this.serial[slot], type: this.kind[slot], x: this.x[slot], y: this.y[slot], z: this.z[slot], value, extra });
    if (this.events.length > 384) this.events.splice(0, this.events.length - 384);
  }
  eventsSince(since: number): readonly HordeEvent[] {
    const events = this.events;
    if (!events.length || events[events.length - 1].id <= since) return EMPTY;
    let i = events.length - 1;
    while (i > 0 && events[i - 1].id > since) i--;
    return events.slice(i);
  }
  get lastEvent() { return this.eventSerial; }

  private chooseTarget(slot: number): number {
    const heroes = this.heroes;
    const current = this.target[slot];
    if (current >= 0 && current < heroes.length && heroes[current].standing && this.now < this.retargetAt[slot]) return current;
    let best = -1, gap = Infinity;
    for (let h = 0; h < heroes.length; h++) {
      const hero = heroes[h];
      if (!hero.standing) continue;
      const d = Math.hypot(hero.x - this.x[slot], hero.z - this.z[slot]) * (h === current ? .75 : 1);
      if (d < gap) { gap = d; best = h; }
    }
    this.target[slot] = best;
    this.retargetAt[slot] = this.now + 1 + this.seed[slot] * 1.5;
    return best;
  }

  private think(dt: number) {
    const now = this.now;
    const { blows, volleys, burst } = this.pace();
    if (now < this.holdUntil) for (let h = 0; h < 8; h++) { this.blows[h] = Math.min(this.blows[h], 0); this.volleys[h] = Math.min(this.volleys[h], 0); }
    else for (let h = 0; h < 8; h++) { this.blows[h] = Math.min(burst, this.blows[h] + blows * dt); this.volleys[h] = Math.min(burst, this.volleys[h] + volleys * dt); }
    for (let i = 0; i < this.capacity; i++) {
      const state = this.state[i];
      if (state === GS.FREE) continue;
      if (now < this.freezeUntil[i] || now < this.stopUntil[i]) {
        this.stateAt[i] += dt; this.stateUntil[i] += dt; this.nextAttack[i] += dt;
        const frost = now < this.frostUntil[i];
        this.flags[i] = frost ? (this.flags[i] | GF.FROZEN) & ~GF.STOPPED : now < this.stopUntil[i] ? this.flags[i] | GF.STOPPED : this.flags[i] & ~GF.STOPPED;
        this.vx[i] = this.vz[i] = 0;
        continue;
      }
      this.flags[i] &= ~(GF.STOPPED | GF.FROZEN);
      if (state === GS.DEAD) { if (now >= this.stateUntil[i]) this.release(i); continue; }
      if (this.burnUntil[i] > now) {
        this.flags[i] |= GF.BURNING;
        if (now >= this.burnNext[i]) { this.burnNext[i] = now + .5; this.damage(i, this.burnDps[i] * .5, this.burnBy[i]); if (!this.isAlive(i)) continue; }
      } else this.flags[i] &= ~GF.BURNING;
      const kind = GRUNTS[this.kind[i]];
      switch (state) {
        case GS.SPAWN: if (now >= this.stateUntil[i]) this.enter(i, GS.MOVE, 0); this.vx[i] = this.vz[i] = 0; continue;
        case GS.FLINCH: case GS.KNOCK: case GS.STUN:
          this.vx[i] = this.vz[i] = 0;
          if (now >= this.stateUntil[i]) { this.enter(i, GS.MOVE, 0); this.struck[i] = 0; this.nextAttack[i] = Math.max(this.nextAttack[i], now + .25 + this.random() * .5); }
          continue;
        case GS.AIR: this.vx[i] = this.vz[i] = 0; continue;
        case GS.DOWN: this.vx[i] = this.vz[i] = 0; if (now >= this.stateUntil[i]) this.enter(i, GS.GETUP, .75); continue;
        case GS.GETUP: this.vx[i] = this.vz[i] = 0; if (now >= this.stateUntil[i]) { this.enter(i, GS.MOVE, 0); this.nextAttack[i] = Math.max(this.nextAttack[i], now + .3); } continue;
        case GS.ATTACK: this.attack(i, kind); continue;
        case GS.CHARGE: this.charge(i, kind); continue;
        default: if (this.dormant[i]) this.lurk(i, kind); else this.pursue(i, kind);
      }
    }
  }

  private lurk(i: number, kind: GruntKind) {
    const sight = PACK_WAKE * (kind.role === 'gunner' ? 1.2 : 1);
    for (const hero of this.heroes) {
      if (hero.standing && Math.hypot(hero.x - this.x[i], hero.z - this.z[i]) < sight) { this.wake(this.pack[i]); return; }
    }
    if (this.now >= this.roamAt[i]) {
      const a = this.random() * Math.PI * 2, r = this.random() * PACK_ROAM;
      this.roamX[i] = this.homeX[i] + Math.sin(a) * r; this.roamZ[i] = this.homeZ[i] + Math.cos(a) * r;
      this.roamAt[i] = this.now + 3 + this.random() * 4;
    }
    const mx = this.roamX[i] - this.x[i], mz = this.roamZ[i] - this.z[i], m = Math.hypot(mx, mz);
    if (m < .35) { this.vx[i] *= .7; this.vz[i] *= .7; return; }
    const pace = kind.speed * this.speedScale[i] * .22 / m;
    this.vx[i] = mx * pace; this.vz[i] = mz * pace;
    this.turn(i, Math.atan2(mx, mz), 3);
  }

  private pursue(i: number, kind: GruntKind) {
    const h = this.chooseTarget(i);
    if (h < 0) { this.vx[i] *= .8; this.vz[i] *= .8; return; }
    const hero = this.heroes[h];
    const dx = hero.x - this.x[i], dz = hero.z - this.z[i], d = Math.hypot(dx, dz) || 1e-3;
    const face = Math.atan2(dx, dz);
    const speed = kind.speed * this.speedScale[i];
    const gunner = kind.role === 'gunner';
    if (this.now >= this.nextAttack[i]) {
      const pick = this.pick(i, kind, d);
      if (pick >= 0) {
        const chosen = kind.moves[pick].kind;
        if (chosen === 'mend' || chosen === 'summon') { this.begin(i, kind, pick, face); return; }
        const budget = chosen === 'shot' ? this.volleys : this.blows;
        if (budget[h] >= 1) { budget[h]--; this.begin(i, kind, pick, face); return; }
        this.nextAttack[i] = this.now + .15 + this.random() * .35;
      }
    }
    this.ring[i] += (this.seed[i] - .5) * .004;
    const ranged = gunner || kind.role === 'sniper' || kind.role === 'healer' || kind.role === 'summoner' || kind.role === 'diver';
    const want = kind.role === 'sniper' ? 15 + this.seed[i] * 6 : kind.role === 'healer' ? 5 + this.seed[i] * 2.5 : kind.role === 'summoner' ? 9 + this.seed[i] * 4
      : kind.role === 'diver' ? 6 + this.seed[i] * 3 : gunner ? 7 + this.seed[i] * 5 : kind.radius + HERO_RADIUS + .5;
    const tx = hero.x - Math.sin(this.ring[i]) * want, tz = hero.z - Math.cos(this.ring[i]) * want;
    let mx = tx - this.x[i], mz = tz - this.z[i];
    if (d > want + 4) { mx = dx; mz = dz; }
    const m = Math.hypot(mx, mz);
    const arrive = ranged && d < want - 1.5 ? -.6 : Math.min(1, m / 1.2);
    const pace = speed * arrive / (m || 1);
    this.vx[i] = mx * pace; this.vz[i] = mz * pace;
    this.turn(i, face, 8);
  }

  pace() { const a = this.aggression; return { blows: 2.2 + a * 3.2, volleys: .65 + a * 1, burst: 2.6 + a * 2 }; }

  private pick(i: number, kind: GruntKind, d: number): number {
    let total = 0;
    const moves = kind.moves;
    const usable = (k: number) => this.inRange(moves[k], kind, d) && (moves[k].kind !== 'mend' || this.hurtNear(i, moves[k].radius ?? 6)) && (moves[k].kind !== 'summon' || this.alive < this.summonCap);
    for (let k = 0; k < moves.length; k++) if (usable(k)) total += moves[k].weight ?? 1;
    if (total <= 0) return -1;
    let roll = this.random() * total;
    for (let k = 0; k < moves.length; k++) {
      if (!usable(k)) continue;
      roll -= moves[k].weight ?? 1;
      if (roll <= 0) return k;
    }
    return -1;
  }
  private hurtNear(i: number, radius: number) {
    for (let j = 0; j < this.capacity; j++) {
      if (j === i || !this.isAlive(j) || this.hp[j] > this.maxHp[j] * .75) continue;
      if (Math.abs(this.x[j] - this.x[i]) < radius && Math.abs(this.z[j] - this.z[i]) < radius && Math.hypot(this.x[j] - this.x[i], this.z[j] - this.z[i]) < radius) return true;
    }
    return false;
  }
  private inRange(move: GruntMove, kind: GruntKind, d: number) {
    const reach = move.kind === 'melee' || move.kind === 'slam' || move.kind === 'explode' ? move.range + kind.radius + HERO_RADIUS + (move.lunge ?? 0) * .5 : move.maxRange ?? move.range;
    return d >= (move.minRange ?? 0) && d <= (move.maxRange ?? reach) && d <= reach + (move.kind === 'charge' ? 20 : 0);
  }

  private begin(i: number, kind: GruntKind, k: number, face: number) {
    const move = kind.moves[k];
    this.move[i] = k; this.struck[i] = 0; this.yaw[i] = face; this.leapt[i] = 0;
    this.flags[i] |= GF.TELEGRAPH;
    const pace = Math.max(.68, 1 - this.aggression * .26);
    if (move.kind === 'charge') {
      this.chargeX[i] = Math.sin(face); this.chargeZ[i] = Math.cos(face);
      this.enter(i, GS.CHARGE, move.duration * pace);
    } else this.enter(i, GS.ATTACK, move.duration * pace);
    this.emit('windup', i, k, 0);
  }

  private attack(i: number, kind: GruntKind) {
    const now = this.now, move = kind.moves[this.move[i]];
    const span = this.stateUntil[i] - this.stateAt[i], scale = span / move.duration;
    const age = now - this.stateAt[i], contact = move.contact * scale;
    const h = this.target[i], hero = h >= 0 ? this.heroes[h] : undefined;
    if (move.kind === 'dive') { this.dive(i, kind, move, age, contact, hero); return; }
    if (!this.struck[i] && hero?.standing) {
      this.turn(i, Math.atan2(hero.x - this.x[i], hero.z - this.z[i]), age < contact * .7 ? 9 : 2);
      const lunge = move.lunge ?? 0;
      if (lunge > 0 && age > contact * .35 && age < contact) {
        const d = Math.hypot(hero.x - this.x[i], hero.z - this.z[i]);
        const room = Math.max(0, d - kind.radius - HERO_RADIUS - move.range * .55);
        const v = Math.min(lunge / Math.max(.05, contact * .65), room / Math.max(.05, contact - age));
        this.vx[i] = Math.sin(this.yaw[i]) * v; this.vz[i] = Math.cos(this.yaw[i]) * v;
      } else { this.vx[i] = this.vz[i] = 0; }
    } else { this.vx[i] = this.vz[i] = 0; }
    if (!this.struck[i] && age >= contact) {
      this.struck[i] = 1; this.flags[i] &= ~GF.TELEGRAPH;
      this.land(i, kind, move);
      if (!this.isAlive(i)) return;
    }
    if (now >= this.stateUntil[i]) {
      this.enter(i, GS.MOVE, 0);
      const rest = move.cooldown * (1 - Math.min(.55, this.aggression * .45)) * (.8 + this.random() * .5);
      this.nextAttack[i] = now + rest;
    }
  }

  private dive(i: number, kind: GruntKind, move: GruntMove, age: number, contact: number, hero: HordeHero | undefined) {
    const now = this.now, leap = contact * .32;
    if (!this.leapt[i]) {
      this.vx[i] = this.vz[i] = 0;
      if (hero?.standing) this.turn(i, Math.atan2(hero.x - this.x[i], hero.z - this.z[i]), 9);
      if (age < leap) return;
      this.leapt[i] = 1;
      const t = Math.max(.35, contact - age);
      const tx = hero ? hero.x : this.x[i] + Math.sin(this.yaw[i]) * 5, tz = hero ? hero.z : this.z[i] + Math.cos(this.yaw[i]) * 5;
      this.vy[i] = GRAVITY * LAUNCH_GRAVITY * t / 2 + .5;
      this.y[i] = Math.max(this.y[i], .05);
      this.chargeX[i] = (tx - this.x[i]) / t; this.chargeZ[i] = (tz - this.z[i]) / t;
    }
    if (!this.struck[i]) { this.vx[i] = this.chargeX[i]; this.vz[i] = this.chargeZ[i]; }
    if (!this.struck[i] && age >= contact) {
      this.struck[i] = 1; this.flags[i] &= ~GF.TELEGRAPH; this.vx[i] = this.vz[i] = 0;
      this.land(i, kind, move);
    }
    if (now >= this.stateUntil[i]) {
      this.enter(i, GS.MOVE, 0);
      this.nextAttack[i] = now + move.cooldown * (1 - Math.min(.55, this.aggression * .45)) * (.8 + this.random() * .5);
    }
  }

  private charge(i: number, kind: GruntKind) {
    const now = this.now, move = kind.moves[this.move[i]];
    const age = now - this.stateAt[i], windup = .55;
    if (age < windup) { this.vx[i] = this.vz[i] = 0; return; }
    this.flags[i] &= ~GF.TELEGRAPH;
    const speed = 13.5;
    this.vx[i] = this.chargeX[i] * speed; this.vz[i] = this.chargeZ[i] * speed;
    if (!this.struck[i]) {
      for (const hero of this.heroes) {
        if (!hero.standing || hero.airborne) continue;
        if (Math.hypot(hero.x - this.x[i], hero.z - this.z[i]) > kind.radius + HERO_RADIUS + .35) continue;
        this.struck[i] = 1;
        this.hooks.strike(this.ids[i], hero.id, this.scaled(i, this.move[i]), { x: this.x[i], y: this.y[i] + kind.height * .5, z: this.z[i] }, true);
        this.enter(i, GS.ATTACK, .6); this.move[i] = 0; this.struck[i] = 1;
        this.nextAttack[i] = now + move.cooldown;
        return;
      }
    }
    const { halfX, halfZ } = this.world;
    if (now >= this.stateUntil[i] || Math.abs(this.x[i]) > halfX - 1 || Math.abs(this.z[i]) > halfZ - 1) {
      this.enter(i, GS.MOVE, 0); this.nextAttack[i] = now + move.cooldown * .5;
    }
  }

  private land(i: number, kind: GruntKind, move: GruntMove) {
    if (move.kind === 'mend') {
      const radius = move.radius ?? 6;
      for (let j = 0; j < this.capacity; j++) {
        if (!this.isAlive(j) || Math.hypot(this.x[j] - this.x[i], this.z[j] - this.z[i]) > radius) continue;
        this.hp[j] = Math.min(this.maxHp[j], this.hp[j] + this.maxHp[j] * move.damage);
      }
      this.emit('mend', i, this.move[i], 0);
      return;
    }
    if (move.kind === 'summon') { this.hooks.summon?.(i, Math.round(move.damage)); this.emit('summon', i, this.move[i], 0); return; }
    const def = this.scaled(i, this.move[i]);
    const yaw = this.yaw[i], fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (move.kind === 'dive') {
      const radius = move.radius ?? 2.2;
      for (const hero of this.heroes) {
        if (!hero.standing || hero.y > 2.2) continue;
        if (Math.hypot(hero.x - this.x[i], hero.z - this.z[i]) > radius + HERO_RADIUS) continue;
        this.hooks.strike(this.ids[i], hero.id, def, { x: this.x[i], y: .6, z: this.z[i] }, !!move.heavy);
      }
      this.emit('slam', i, this.move[i], 0);
      return;
    }
    const origin = { x: this.x[i] + fx * kind.radius, y: this.y[i] + kind.height * .55, z: this.z[i] + fz * kind.radius };
    if (move.kind === 'shot') {
      const h = this.target[i], hero = h >= 0 ? this.heroes[h] : undefined;
      let dx = fx, dy = 0, dz = fz;
      if (hero) {
        const far = Math.hypot(hero.x - origin.x, hero.z - origin.z), spread = Math.min(1.3, far * .07);
        const a = this.random() * Math.PI * 2, r = spread * Math.sqrt(this.random());
        const tx = hero.x + Math.sin(a) * r - origin.x, ty = hero.y + 1 - origin.y, tz = hero.z + Math.cos(a) * r - origin.z, n = Math.hypot(tx, ty, tz) || 1;
        dx = tx / n; dy = ty / n; dz = tz / n;
      }
      this.fire(i, origin, dx, dy, dz, move, def.damage);
      return;
    }
    if (move.kind === 'slam' || move.kind === 'explode') {
      const at = move.kind === 'slam' ? { x: this.x[i] + fx * (kind.radius + 1), y: 0, z: this.z[i] + fz * (kind.radius + 1) } : { x: this.x[i], y: 0, z: this.z[i] };
      const radius = move.radius ?? 2.5;
      for (const hero of this.heroes) {
        if (!hero.standing || hero.y > 2.2) continue;
        if (Math.hypot(hero.x - at.x, hero.z - at.z) > radius + HERO_RADIUS) continue;
        this.hooks.strike(this.ids[i], hero.id, def, { x: at.x, y: .6, z: at.z }, !!move.heavy);
      }
      this.emit(move.kind === 'slam' ? 'slam' : 'explode', i, this.move[i], 0);
      if (move.kind === 'explode') {
        for (let j = 0; j < this.capacity; j++) {
          if (j === i || !this.isAlive(j) || Math.hypot(this.x[j] - at.x, this.z[j] - at.z) > radius) continue;
          const dx = this.x[j] - at.x, dz = this.z[j] - at.z, n = Math.hypot(dx, dz) || 1;
          this.hp[j] = Math.max(1, this.hp[j] - def.damage * .5);
          this.topple(j, dx / n * 7, dz / n * 7, 5);
        }
        this.hp[i] = 0; this.alive--;
        this.death[i] = DEATH.BURST; this.gore[i] = 0; this.enter(i, GS.DEAD, 1.2);
        this.emit('death', i, DEATH.BURST, 0);
        this.hooks.killed(i, undefined);
      }
      return;
    }
    for (const hero of this.heroes) {
      if (!hero.standing) continue;
      if (hero.airborne && hero.y > this.y[i] + 1.6) continue;
      const dx = hero.x - this.x[i], dz = hero.z - this.z[i], d = Math.hypot(dx, dz) || 1e-3;
      if (d > move.range + kind.radius + HERO_RADIUS) continue;
      if ((dx * fx + dz * fz) / d < move.arc) continue;
      this.hooks.strike(this.ids[i], hero.id, def, origin, !!move.heavy);
    }
  }

  private topple(j: number, kx: number, kz: number, vy: number) {
    if (!this.isAlive(j) || this.state[j] === GS.AIR || this.state[j] === GS.SPAWN) return;
    if (this.poise[j] > 0) { this.kx[j] += kx * .2; this.kz[j] += kz * .2; return; }
    const mass = GRUNTS[this.kind[j]].mass;
    this.kx[j] = kx / mass; this.kz[j] = kz / mass; this.vy[j] = vy / mass;
    this.juggle[j] = MAX_JUGGLE; this.flags[j] &= ~GF.TELEGRAPH;
    this.enter(j, GS.AIR, 9);
    this.toppledAt[j] = this.now;
    this.emit('topple', j, 0, 0);
  }

  private fire(i: number, origin: Vec3, dx: number, dy: number, dz: number, move: GruntMove, damage: number) {
    const shot = this.shots.find(each => !each.active);
    if (!shot) return;
    const speed = move.speed ?? 24;
    Object.assign(shot, { active: true, slot: i, serial: this.serial[i], type: this.kind[i], move: this.move[i], x: origin.x, y: origin.y, z: origin.z,
      px: origin.x, py: origin.y, pz: origin.z, vx: dx * speed, vy: dy * speed, vz: dz * speed, life: move.range / speed, damage, id: ++this.shotSerial });
    this.emit('shot', i, this.move[i], shot.id);
  }

  private flyShots(dt: number) {
    const { halfX, halfZ } = this.world;
    for (const shot of this.shots) {
      if (!shot.active) continue;
      shot.px = shot.x; shot.py = shot.y; shot.pz = shot.z;
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.z += shot.vz * dt; shot.life -= dt;
      if (shot.life <= 0 || shot.y < 0 || Math.abs(shot.x) > halfX + 2 || Math.abs(shot.z) > halfZ + 2) { shot.active = false; continue; }
      const kind = GRUNTS[shot.type], move = kind.moves[shot.move];
      for (const hero of this.heroes) {
        if (!hero.standing) continue;
        if (segmentPointDistance(shot.px, shot.py, shot.pz, shot.x, shot.y, shot.z, hero.x, hero.y + 1, hero.z) > (move.radius ?? .35) + HERO_RADIUS + .15) continue;
        const def = { ...this.moveDefs[shot.type][shot.move], damage: shot.damage };
        this.hooks.strike(`g${shot.serial}`, hero.id, def, { x: shot.px, y: shot.py, z: shot.pz }, !!move.heavy);
        shot.active = false;
        break;
      }
    }
  }

  private scaled(i: number, k: number): MoveDefinition {
    const base = this.moveDefs[this.kind[i]][k];
    return { ...base, damage: Math.max(1, Math.round(base.damage * this.damageScale[i])) };
  }

  private turn(i: number, to: number, rate: number) {
    let d = to - this.yaw[i];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = rate * (1 / 60);
    this.yaw[i] += Math.abs(d) <= step ? d : Math.sign(d) * step;
  }

  private integrate(dt: number) {
    const now = this.now;
    for (let i = 0; i < this.capacity; i++) {
      const state = this.state[i];
      if (state === GS.FREE || now < this.freezeUntil[i] || now < this.stopUntil[i]) continue;
      const kind = GRUNTS[this.kind[i]], floor = state === GS.DEAD ? 0 : kind.hover ?? 0;
      const drag = state === GS.DEAD ? (this.y[i] > .05 ? .6 : 5) : state === GS.AIR ? 1.2 : 6.5;
      this.x[i] += (this.vx[i] + this.kx[i]) * dt;
      this.z[i] += (this.vz[i] + this.kz[i]) * dt;
      const decay = Math.exp(-drag * dt);
      this.kx[i] *= decay; this.kz[i] *= decay;
      if (this.y[i] > floor || this.vy[i] !== 0) {
        this.vy[i] -= GRAVITY * LAUNCH_GRAVITY * dt;
        this.y[i] += this.vy[i] * dt;
        if (this.y[i] <= floor) {
          this.y[i] = floor;
          const falling = this.vy[i];
          this.vy[i] = 0;
          if (state === GS.AIR) {
            this.kx[i] *= .3; this.kz[i] *= .3; this.juggle[i] = 0;
            this.enter(i, GS.DOWN, .75 + this.random() * .35);
          } else if (state === GS.DEAD && falling < -6) { this.vy[i] = -falling * .25; this.y[i] = floor + .01; }
        }
      }
      this.collideWorld(i, kind.radius);
    }
  }

  private collideWorld(i: number, radius: number) {
    const { halfX, halfZ, circles, boxes } = this.world;
    for (const c of circles) {
      const dx = this.x[i] - c.x, dz = this.z[i] - c.z, d = Math.hypot(dx, dz), min = c.r + radius;
      if (d >= min) continue;
      if (d < 1e-4) { this.x[i] += min; continue; }
      this.x[i] = c.x + dx / d * min; this.z[i] = c.z + dz / d * min;
      if (this.state[i] === GS.CHARGE) this.stateUntil[i] = this.now;
    }
    for (const b of boxes) {
      const ox = b.hx + radius - Math.abs(this.x[i] - b.x), oz = b.hz + radius - Math.abs(this.z[i] - b.z);
      if (ox <= 0 || oz <= 0) continue;
      if (ox < oz) this.x[i] += Math.sign(this.x[i] - b.x || 1) * ox; else this.z[i] += Math.sign(this.z[i] - b.z || 1) * oz;
      if (this.state[i] === GS.CHARGE) this.stateUntil[i] = this.now;
    }
    const lx = halfX - radius, lz = halfZ - radius;
    if (this.x[i] < -lx) this.x[i] = -lx; else if (this.x[i] > lx) this.x[i] = lx;
    if (this.z[i] < -lz) this.z[i] = -lz; else if (this.z[i] > lz) this.z[i] = lz;
  }

  private rebuild() {
    this.head.fill(-1);
    for (let i = 0; i < this.capacity; i++) {
      if (this.state[i] === GS.FREE) continue;
      const c = Math.min(this.cols - 1, Math.max(0, Math.floor((this.x[i] - this.originX) / CELL)));
      const r = Math.min(this.rows - 1, Math.max(0, Math.floor((this.z[i] - this.originZ) / CELL)));
      const cell = r * this.cols + c;
      this.next[i] = this.head[cell]; this.head[cell] = i;
    }
  }

  private separate() {
    const now = this.now;
    for (let i = 0; i < this.capacity; i++) {
      const si = this.state[i];
      if (si === GS.FREE) continue;
      const ki = GRUNTS[this.kind[i]], ri = ki.radius;
      const dead = si === GS.DEAD;
      const flung = (si === GS.AIR || (dead && this.y[i] > .15) || si === GS.KNOCK) && Math.hypot(this.kx[i], this.kz[i]) > 5.5;
      if (dead && !flung) continue;
      const c = Math.floor((this.x[i] - this.originX) / CELL), r = Math.floor((this.z[i] - this.originZ) / CELL);
      for (let rr = r - 1; rr <= r + 1; rr++) {
        if (rr < 0 || rr >= this.rows) continue;
        for (let cc = c - 1; cc <= c + 1; cc++) {
          if (cc < 0 || cc >= this.cols) continue;
          for (let j = this.head[rr * this.cols + cc]; j >= 0; j = this.next[j]) {
            if (j <= i && !flung) continue;
            if (j === i) continue;
            const sj = this.state[j];
            if (sj === GS.DEAD || sj === GS.FREE) continue;
            const kj = GRUNTS[this.kind[j]], min = ri + kj.radius;
            const dx = this.x[j] - this.x[i], dz = this.z[j] - this.z[i];
            if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
            if (Math.abs(this.y[j] - this.y[i]) > 1.4) continue;
            const d = Math.hypot(dx, dz);
            if (d >= min) continue;
            if (flung) {
              if (sj !== GS.AIR && sj !== GS.SPAWN && now - this.toppledAt[j] > .6) {
                const speed = Math.hypot(this.kx[i], this.kz[i]);
                this.topple(j, this.kx[i] * .55, this.kz[i] * .55, Math.min(6, 2 + speed * .25));
                this.lastHitBy[j] = this.lastHitBy[i]; this.lastHitAt[j] = now;
                const knocked = Math.max(1, Math.round(6 + speed * 1.2));
                this.hp[j] = Math.max(0, this.hp[j] - knocked);
                if (this.hp[j] <= 0) this.die(j, undefined, speed * .5);
              }
              continue;
            }
            const overlap = (min - d) * .5, ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0;
            const wi = kj.mass / (ki.mass + kj.mass), wj = 1 - wi;
            this.x[i] -= ux * overlap * 2 * wi; this.z[i] -= uz * overlap * 2 * wi;
            this.x[j] += ux * overlap * 2 * wj; this.z[j] += uz * overlap * 2 * wj;
          }
        }
      }
      if (dead) continue;
      for (const hero of this.heroes) {
        if (!hero.standing && !hero.airborne) continue;
        if (Math.abs(hero.y - this.y[i]) > 1.5) continue;
        const dx = this.x[i] - hero.x, dz = this.z[i] - hero.z, min = ri + HERO_RADIUS + .08, d = Math.hypot(dx, dz);
        if (d >= min) continue;
        if (d < 1e-4) { this.x[i] += min; continue; }
        this.x[i] = hero.x + dx / d * min; this.z[i] = hero.z + dz / d * min;
      }
    }
  }
}

const EMPTY: readonly HordeEvent[] = [];

export function toMoveDefinition(move: GruntMove): MoveDefinition {
  return { name: move.name, duration: move.duration, contacts: [move.contact], damage: move.damage, range: move.range, radius: move.radius ?? .5,
    stamina: 0, cooldown: move.cooldown, stun: move.stun, knockback: move.knockback, style: move.kind === 'shot' ? 'projectile' : move.kind === 'slam' || move.kind === 'explode' ? 'bomb' : 'melee',
    hitstop: move.heavy ? .07 : .035,
    ...(move.heavy ? { guardBreak: move.kind === 'slam' || move.kind === 'explode' } : {}) };
}

function segmentPointDistance(ax: number, ay: number, az: number, bx: number, by: number, bz: number, px: number, py: number, pz: number) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const len = abx * abx + aby * aby + abz * abz;
  const t = len > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / len)) : 0;
  return Math.hypot(ax + abx * t - px, ay + aby * t - py, az + abz * t - pz);
}
