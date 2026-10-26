import type { ArenaSimulation } from '../game/simulation';
import type { AttackSlot, PlayerInput, PlayerState } from '../game/types';
import type { EnemyDefinition, EnemyMove } from './enemies';

type Command = Omit<PlayerInput, 'seq'>;
const REACTING = new Set(['flinch', 'hurt', 'launched', 'knockdown', 'getup', 'stun', 'splat', 'defeated']);
const ATTACKING = new Set(['light', 'heavy', 'special', 'ultimate']);

export interface Rations { melee: number; shots: number; brutes: number }

export class TokenPool {
  private held = new Map<string, { kind: keyof Rations; until: number }>();
  private committed: Record<keyof Rations, number> = { melee: -Infinity, shots: -Infinity, brutes: -Infinity };
  gaps: Record<keyof Rations, number> = { melee: 1, shots: 1.5, brutes: 1.5 };
  constructor(public rations: Rations) {}
  commit(kind: keyof Rations, now: number) {
    if (now - this.committed[kind] < this.gaps[kind]) return false;
    this.committed[kind] = now;
    return true;
  }
  take(id: string, kind: keyof Rations, now: number, seconds: number) {
    const mine = this.held.get(id);
    if (mine && mine.kind === kind) { mine.until = Math.max(mine.until, now + seconds); return true; }
    let used = 0;
    for (const [holder, token] of this.held) {
      if (token.until < now) { this.held.delete(holder); continue; }
      if (token.kind === kind) used++;
    }
    if (used >= this.rations[kind]) return false;
    this.held.set(id, { kind, until: now + seconds });
    return true;
  }
  holds(id: string, kind: keyof Rations, now: number) {
    const token = this.held.get(id);
    return !!token && token.kind === kind && token.until >= now;
  }
  release(id: string) { this.held.delete(id); }
}

export interface BrainWorld {
  sim: ArenaSimulation;
  now: number;
  target: PlayerState | undefined;
  tokens: TokenPool;
  random: () => number;
  crowd: readonly PlayerState[];
  wave: number;
  rank?: number;
}

export class EnemyBrain {
  private orbit: number;
  private radius: number;
  private nextAttack: number;
  private windup = -1;
  private chosen?: EnemyMove;
  private lastUsed = new Map<string, number>();
  private spawnedAt: number;
  private strafeFlip = 0;
  phase = 0;
  private roarUntil = -1;
  private nextDefend = 0;
  private nextPunish = 0;
  private nextDash = 0;
  private counterUntil = -1;
  private stringRun = 0;
  private seen?: { x: number; z: number; at: number; vx: number; vz: number };
  private farSince = -1;

  constructor(readonly id: string, readonly def: EnemyDefinition, now: number, private readonly random: () => number) {
    this.orbit = random() < .5 ? -1 : 1;
    const band = def.brain === 'gunner' ? [8, 12] : def.brain === 'brute' ? [2.5, 3.5] : [3.6, 5.8];
    this.radius = band[0] + random() * (band[1] - band[0]);
    this.nextAttack = now + .6 + random() * 1.2;
    this.spawnedAt = now;
  }

  enterPhase(phase: number, now: number) { this.phase = phase; this.roarUntil = now + 1.6; this.nextAttack = now + 1.9; }
  hurry(now: number) { this.nextAttack = Math.min(this.nextAttack, now + .22); this.chosen = undefined; this.windup = -1; }
  get roaring() { return this.roarUntil; }
  still(now: number, seconds: number) { this.roarUntil = Math.max(this.roarUntil, now + seconds); this.nextAttack = Math.max(this.nextAttack, now + seconds + .05); this.chosen = undefined; }
  force(now: number, slot: AttackSlot) {
    this.roarUntil = Math.min(this.roarUntil, now); this.nextAttack = now; this.windup = -1;
    this.chosen = this.def.moves.find(move => move.slot === slot && (move.phase ?? 0) <= this.phase && move.style === 'melee')
      ?? this.def.moves.find(move => move.style === 'melee' && (move.phase ?? 0) <= this.phase);
  }

  think(self: PlayerState, world: BrainWorld): Command {
    const { now, target } = world;
    const idle: Command = { moveX: 0, moveZ: 0, yaw: self.yaw, targetId: target?.id ?? null };
    if (now - this.spawnedAt < .7 || !self.alive || !target?.alive) return idle;
    if (now < this.roarUntil) return idle;
    const dx = target.x - self.x, dz = target.z - self.z, d = Math.hypot(dx, dz) || 1;
    const face = Math.atan2(dx, dz);
    if (REACTING.has(self.action) || self.hitstop) { world.tokens.release(this.id); this.windup = -1; return { ...idle, yaw: face }; }
    if (ATTACKING.has(self.action)) return { ...idle, yaw: face };
    switch (this.def.brain) {
      case 'gunner': return this.gunner(self, world, dx, dz, d, face);
      case 'brute': return this.brute(self, world, dx, dz, d, face);
      case 'boss': return this.boss(self, world, dx, dz, d, face);
      default: return this.swarm(self, world, dx, dz, d, face);
    }
  }

  private spread(self: PlayerState, crowd: readonly PlayerState[]) {
    let x = 0, z = 0;
    for (const other of crowd) {
      if (other.id === self.id) continue;
      const ox = self.x - other.x, oz = self.z - other.z, gap = Math.hypot(ox, oz);
      if (gap > 2.2 || gap < 1e-3) continue;
      const push = (2.2 - gap) / 2.2;
      x += ox / gap * push; z += oz / gap * push;
    }
    return { x, z };
  }

  private hold(self: PlayerState, world: BrainWorld, dx: number, dz: number, d: number, radius: number, pace: number) {
    const ux = dx / d, uz = dz / d;
    const radial = d > radius ? Math.min(1, (d - radius) * .7) : Math.max(-.22, (d - radius) * .25);
    if (world.now > this.strafeFlip) { this.strafeFlip = world.now + 2.5 + world.random() * 3; if (world.random() < .35) this.orbit *= -1; }
    const around = this.orbit * (d < radius + 1.5 ? .55 : .15);
    const spread = this.spread(self, world.crowd);
    let mx = ux * radial + -uz * around + spread.x * .9, mz = uz * radial + ux * around + spread.z * .9;
    const n = Math.hypot(mx, mz);
    if (n > 1) { mx /= n; mz /= n; }
    return { moveX: mx * pace, moveZ: mz * pace };
  }

  private pick(self: PlayerState, d: number, now: number, filter: (move: EnemyMove) => boolean = () => true) {
    const cooled = (move: EnemyMove) => now >= (this.lastUsed.get(move.name) ?? -Infinity) + (move.rest ?? 0)
      && now >= (self.cooldowns[move.slot] ?? 0);
    const moves = this.def.moves.filter(move => (move.phase ?? 0) <= this.phase && filter(move) && cooled(move)
      && d >= (move.minRange ?? 0) && d <= (move.maxRange ?? move.range + 1));
    if (!moves.length) return undefined;
    const total = moves.reduce((sum, move) => sum + (move.weight ?? 1), 0);
    let roll = this.random() * total;
    return moves.find(move => (roll -= move.weight ?? 1) <= 0) ?? moves[0];
  }

  private strike(self: PlayerState, world: BrainWorld, move: EnemyMove, face: number): Command {
    world.sim.setMove(self.id, move.slot, move);
    if (move.slot === 'ultimate') world.sim.addMeter(self.id, 100);
    this.lastUsed.set(move.name, world.now);
    this.chosen = undefined; this.windup = -1;
    return { moveX: 0, moveZ: 0, yaw: face, targetId: world.target?.id ?? null, attack: move.slot as AttackSlot };
  }

  private swarm(self: PlayerState, world: BrainWorld, dx: number, dz: number, d: number, face: number): Command {
    const { now, tokens } = world;
    const base = { yaw: face, targetId: world.target!.id };
    const armed = tokens.holds(this.id, 'melee', now) || (now >= this.nextAttack && tokens.take(this.id, 'melee', now, 3.2));
    if (!armed) return { ...base, ...this.hold(self, world, dx, dz, d, this.radius, .85) };
    const move = this.chosen ?? (this.chosen = this.pick(self, d, now) ?? this.pick(self, 1, now));
    if (!move) return { ...base, ...this.hold(self, world, dx, dz, d, 2.2, 1) };
    const reach = (move.maxRange ?? move.range) - .2;
    if (d > reach) {
      const spread = this.spread(self, world.crowd);
      return { ...base, moveX: dx / d + spread.x * .4, moveZ: dz / d + spread.z * .4 };
    }
    if (this.windup < 0) this.windup = now + .08 + world.random() * .22;
    if (now < this.windup || !tokens.commit('melee', now)) return { ...base, moveX: 0, moveZ: 0 };
    tokens.take(this.id, 'melee', now, move.duration + .5);
    this.nextAttack = now + move.duration + Math.max(.5, 1.6 - world.wave * .08) + world.random() * Math.max(.6, 1.8 - world.wave * .07);
    return this.strike(self, world, move, face);
  }

  private gunner(self: PlayerState, world: BrainWorld, dx: number, dz: number, d: number, face: number): Command {
    const { now, tokens } = world;
    const base = { yaw: face, targetId: world.target!.id };
    if (d < 3) {
      const jab = this.pick(self, d, now, move => move.style === 'melee');
      if (jab && now >= this.nextAttack && tokens.take(this.id, 'melee', now, jab.duration + .4) && tokens.commit('melee', now)) {
        this.nextAttack = now + jab.duration + 1.2;
        return this.strike(self, world, jab, face);
      }
      return { ...base, moveX: -dx / d, moveZ: -dz / d };
    }
    const volley = this.pick(self, d, now, move => move.style !== 'melee');
    if (volley && now >= this.nextAttack && tokens.take(this.id, 'shots', now, volley.duration + .3) && tokens.commit('shots', now)) {
      this.nextAttack = now + volley.duration + 1.1 + world.random() * 1.5 - Math.min(.9, world.wave * .06);
      return this.strike(self, world, volley, face);
    }
    return { ...base, ...this.hold(self, world, dx, dz, d, this.radius, .7) };
  }

  private brute(self: PlayerState, world: BrainWorld, dx: number, dz: number, d: number, face: number): Command {
    const { now, tokens } = world;
    const base = { yaw: face, targetId: world.target!.id };
    const armed = tokens.holds(this.id, 'brutes', now) || tokens.take(this.id, 'brutes', now, 6);
    if (!armed) return { ...base, ...this.hold(self, world, dx, dz, d, 5.5, .6) };
    if (now < this.nextAttack) return { ...base, ...this.hold(self, world, dx, dz, d, 2.4, .7) };
    const move = this.chosen ?? (this.chosen = this.pick(self, d, now) ?? this.pick(self, 1.5, now));
    if (!move) return { ...base, moveX: dx / d, moveZ: dz / d };
    if (d > (move.maxRange ?? move.range) - .2) return { ...base, moveX: dx / d, moveZ: dz / d };
    if (!tokens.commit('brutes', now)) return { ...base, moveX: 0, moveZ: 0 };
    this.nextAttack = now + move.duration + 1.1 + world.random() * 1.2;
    return this.strike(self, world, move, face);
  }

  private boss(self: PlayerState, world: BrainWorld, dx: number, dz: number, d: number, face: number): Command {
    const { now } = world, target = world.target!;
    const base = { yaw: face, targetId: target.id };
    const rank = world.rank ?? Math.min(6, Math.max(0, Math.floor((world.wave / 2 - 1) / 2)));
    const wounded = target.hp < target.maxHp * .3;
    const fury = Math.min(1, .38 + rank * .08 + this.phase * .2 + (wounded ? .12 : 0));
    this.read(target, now);
    const ux = dx / d, uz = dz / d;
    const facing = Math.cos(target.yaw - Math.atan2(-dx, -dz)) > .55;
    const left = ATTACKING.has(target.action) || target.action === 'dash' ? target.actionStarted + target.actionDuration + (target.actionFrozen ?? 0) - now : 0;
    const swinging = ATTACKING.has(target.action) && now - target.actionStarted < .16;
    if (swinging && facing && d < 4.4 && now >= this.nextDefend) {
      this.nextDefend = now + 1.1 - fury * .45;
      if (world.random() < .1 + fury * .38) {
        this.counterUntil = now + .9; this.chosen = undefined; this.stringRun = 0;
        this.nextAttack = Math.min(this.nextAttack, now + .3);
        const through = fury > .62 && world.random() < .35;
        return { ...base, moveX: through ? ux : -ux, moveZ: through ? uz : -uz, dash: true };
      }
    }
    const exposed = (left > .24 && target.action !== 'dash') || (target.action === 'dash' && left < .12) || target.action === 'getup';
    if (exposed && now >= this.nextPunish && now >= this.roarUntil) {
      const quick = this.pick(self, d, now, move => move.style === 'melee' && move.duration < 1.7);
      if (quick) { this.nextPunish = now + 2.2 - fury * .9; this.stringRun = 0; return this.strike(self, world, quick, face); }
      if (d > 3 && d < 9 && now >= this.nextDash) { this.nextDash = now + 1.6; this.nextAttack = Math.min(this.nextAttack, now + .32); return { ...base, moveX: ux, moveZ: uz, dash: true }; }
    }
    if (d > 7) { if (this.farSince < 0) this.farSince = now; } else this.farSince = -1;
    if (d > 6.5 && now >= this.nextDash && now >= this.nextAttack - .25 && world.random() < .5 + fury * .4) {
      this.nextDash = now + 2.6 - fury;
      return { ...base, moveX: ux, moveZ: uz, dash: true };
    }
    if (now < this.nextAttack) {
      const want = d > 6 ? 1.9 : 2.2 - fury * .5;
      return { ...base, ...this.hold(self, world, dx, dz, d, want, d > 4.5 ? 1 : .75 + fury * .3) };
    }
    const kiting = this.farSince >= 0 && now - this.farSince > 1.6;
    const countering = now < this.counterUntil;
    const guarded = target.guarding && d < 4;
    const move = this.chosen ?? (this.chosen = (countering ? this.pick(self, d, now, m => m.style === 'melee' && m.duration < 1.7) : undefined)
      ?? (guarded ? this.pick(self, d, now, m => !!m.guardBreak) : undefined)
      ?? (kiting ? this.pick(self, d, now, m => m.style !== 'melee' || (m.maxRange ?? m.range) > 5) : undefined)
      ?? this.pick(self, d, now));
    if (!move) {
      return { ...base, moveX: ux, moveZ: uz };
    }
    if (d > (move.maxRange ?? move.range + 1)) {
      if (d > 4.5 && now >= this.nextDash) { this.nextDash = now + 2.2 - fury * .8; return { ...base, moveX: ux, moveZ: uz, dash: true }; }
      return { ...base, moveX: ux, moveZ: uz };
    }
    let aim = face;
    if (move.style !== 'melee' && this.seen) {
      const flight = Math.min(1.2, d / Math.max(8, move.speed ?? 20));
      aim = Math.atan2(target.x + this.seen.vx * flight * .8 - self.x, target.z + this.seen.vz * flight * .8 - self.z);
    }
    this.counterUntil = -1;
    const string = move.style === 'melee' && d < 3.6 && this.stringRun < 3 && world.random() < .4 + fury * .45;
    this.stringRun = string ? this.stringRun + 1 : 0;
    const pause = Math.max(.05, .55 - fury * .5 - this.phase * .1);
    const beat = string && world.random() < .15 + fury * .2 ? .32 + world.random() * .2 : 0;
    this.nextAttack = now + (string ? move.duration * (.62 + world.random() * .16) + beat : move.duration + pause + world.random() * (.35 - fury * .25));
    return this.strike(self, world, move, aim);
  }

  private read(target: PlayerState, now: number) {
    const seen = this.seen;
    if (!seen) { this.seen = { x: target.x, z: target.z, at: now, vx: 0, vz: 0 }; return; }
    const dt = now - seen.at;
    if (dt < 1 / 30) return;
    const k = Math.min(1, dt * 6);
    seen.vx += ((target.x - seen.x) / dt - seen.vx) * k; seen.vz += ((target.z - seen.z) / dt - seen.vz) * k;
    seen.x = target.x; seen.z = target.z; seen.at = now;
  }
}
