import type { Fighter } from '../Fighter';
import type { VfxKit } from './VfxKit';
import { SPRITE, ORIENT } from './SparkField';
import { ghostTint } from './palette';
import { MOVES } from '../../game/moves';
import { DREAM_IMPACT } from '../dreamFlag';
const SPEED_BURST = .14;
const GHOST_DIAL = { fewer: 1, fade: .7 } as const;

export interface ScreenFx {
  impactFrame(strength: number, at?: import('three').Vector3, hold?: number): void; chromaticPulse(amount: number): void; speedLines(amount: number): void;
  extendImpact?(hold: number): void;
  techniqueGrade?(color: number, strength: number, seconds: number, at?: { x: number; y: number; z: number }, reach?: number): void; timeStop?(amount: number): void;
  impactBlur?(strength: number, at: { x: number; y: number; z: number }, keep?: import('../GameRenderer').BlurKeep[]): void;
}

interface Track { action: string; started: number; grounded: boolean; floor: number; airFrom: number; lastPuff: number; ghostNext: number; ghosts: number; chaseUntil: number; chaseFrom: number; seen: number; gx: number; gz: number }
const SLIDES = new Set(['hurt', 'flinch', 'launched', 'knockdown', 'splat', 'stun', 'guard']);

export class MotionFx {
  private tracks = new Map<string, Track>();
  private frame = 0;

  update(time: number, fighters: ReadonlyMap<string, Fighter>, kit: VfxKit, localId?: string, screen?: ScreenFx) {
    this.frame++;
    for (const [id, f] of fighters) {
      const s = f.state, pos = f.group.position;
      let tr = this.tracks.get(id);
      if (!tr) {
        tr = { action: s.action, started: s.actionStarted, grounded: s.grounded, floor: pos.y, airFrom: time, lastPuff: 0, ghostNext: 0, ghosts: 0, chaseUntil: 0, chaseFrom: -Infinity, seen: this.frame, gx: pos.x, gz: pos.z };
        this.tracks.set(id, tr); kit.ghosts.prepare(f); continue;
      }
      tr.seen = this.frame;
      const began = s.action !== tr.action || Math.abs(s.actionStarted - tr.started) > 1e-4;
      const velocity = f.velocity as { x: number; z: number } | undefined, vx = velocity?.x ?? 0, vz = velocity?.z ?? 0, speed = Math.hypot(vx, vz), dx = speed > .1 ? vx / speed : Math.sin(s.yaw), dz = speed > .1 ? vz / speed : Math.cos(s.yaw);
      const tint = ghostTint(s.fighter, !!s.awakened, s.action === 'light' ? 'light' : undefined, s.chain ?? 0);
      if (s.alive) {
        if (s.action === 'dash' && began) {
          tr.ghosts = Math.max(1, Math.round(((s.dashKind === 'forward' ? 3 : 2) - (DREAM_IMPACT ? GHOST_DIAL.fewer : 0)) * kit.budget)); tr.ghostNext = time + .03; tr.gx = pos.x; tr.gz = pos.z;
          if (s.grounded && kit.splashes(pos.y)) kit.splash(pos.x - dx * .35, pos.z - dz * .35, .5, time, -dx, -dz);
          else if (s.grounded) for (let i = 0; i < kit.n(3, 2); i++) kit.puff(pos.x - dx * .35 + (Math.random() - .5) * .4, pos.y + .1, pos.z - dz * .35 + (Math.random() - .5) * .4, -dx * (2 + Math.random() * 2), .3 + Math.random() * .4, -dz * (2 + Math.random() * 2), .3 + Math.random() * .12, time, .45);
        }
        if (tr.action === 'dash' && s.action !== 'dash' && s.grounded && speed > 2) {
          if (kit.splashes(pos.y)) kit.splash(pos.x + dx * .3, pos.z + dz * .3, .4, time, dx, dz);
          else for (let i = 0; i < kit.n(2, 1); i++) kit.puff(pos.x + dx * .3 + (Math.random() - .5) * .3, pos.y + .1, pos.z + dz * .3 + (Math.random() - .5) * .3, dx * 2.2, .35, dz * 2.2, .34, time, .42);
        }
        if (s.action === 'light' && (s.chain ?? 0) >= 3 && began) { tr.ghosts = Math.max(1, Math.round((2 - (DREAM_IMPACT ? GHOST_DIAL.fewer : 0)) * kit.budget)); tr.ghostNext = time + .05; tr.gx = pos.x; tr.gz = pos.z; }
        const chasing = time < tr.chaseUntil;
        if (tr.ghosts > 0 && time >= tr.ghostNext && (s.action === 'dash' || s.action === 'light' || chasing) && (chasing || Math.hypot(pos.x - tr.gx, pos.z - tr.gz) > .35)) {
          kit.ghosts.spawn(f, tint, time, chasing ? .26 : .24, (chasing ? .7 : .6) * (DREAM_IMPACT ? GHOST_DIAL.fade : 1));
          tr.ghosts--; tr.ghostNext = time + (chasing ? .04 : .05); tr.gx = pos.x; tr.gz = pos.z;
        }
        if (chasing) {
          const sp = kit.sparks.spec;
          for (let i = 0; i < kit.n(2, 1); i++) {
            sp.reset(SPRITE.streak, time, .16).pos(pos.x + (Math.random() - .5) * .8, pos.y + .4 + Math.random() * 1.4, pos.z + (Math.random() - .5) * .8).velocity(-dx * 14, 0, -dz * 14);
            sp.orient = ORIENT.velocity; sp.sized(.02, .012, .5); sp.stretch = 3; sp.trail = .06; sp.drag = 6; sp.hot(0xffffff, 1.2).cool(tint, 0); kit.sparks.emit();
          }
        }
        if (tr.grounded && !s.grounded) tr.airFrom = time;
        if (tr.grounded && !s.grounded && (s.action === 'jump' || s.action === 'dash')) kit.dustRing(pos.x, tr.floor, pos.z, 5, .2, 2.2, .42, time, .5);
        if (!tr.grounded && s.grounded && time - tr.airFrom > .2) {
          const heavy = s.action === 'knockdown' || s.action === 'launched' || tr.action === 'launched';
          kit.dustRing(pos.x, pos.y, pos.z, heavy ? 9 : 6, .25, heavy ? 4 : 2.6, heavy ? .75 : .45, time, heavy ? .8 : .55);
          if (heavy && !kit.splashes(pos.y)) { kit.debris.burst(kit.n(4, 1), pos.x, pos.y, pos.z, 0, 1, 0, 4.5, .9, .09, pos.y, 1.4); kit.ring(pos.x, pos.y + .05, pos.z, .3, 2.6, time, .4, 0xffffff, 0x9d8e76, .15, 'flat'); }
        }
        if (s.action === 'knockdown' && began && s.grounded) kit.dustRing(pos.x, pos.y, pos.z, 7, .3, 3, .75, time, .75);
        const wet = s.grounded && kit.splashes(pos.y);
        if (s.grounded && SLIDES.has(s.action) && speed > 3 && time - tr.lastPuff > (wet ? .09 : .045)) {
          tr.lastPuff = time;
          if (wet) kit.splash(pos.x, pos.z, .3 + Math.min(.4, speed * .04), time, dx, dz, 1);
          else kit.puff(pos.x + (Math.random() - .5) * .3, pos.y + .1, pos.z + (Math.random() - .5) * .3, dx * speed * .25, .4 + Math.random() * .4, dz * speed * .25, .28 + Math.min(.24, speed * .03), time, .5, .7);
        }
        if (id === localId && screen) {
          const move = s.action === 'ultimate' ? MOVES[s.fighter].ultimate : undefined;
          const charging = !!move && s.actionTime * s.actionDuration < move.contacts[0];
          const amount = chasing ? (!DREAM_IMPACT || time - tr.chaseFrom < SPEED_BURST ? 1 : 0)
            : s.action === 'dash' ? (!DREAM_IMPACT || time - s.actionStarted < SPEED_BURST ? .55 : 0) : charging ? .75 : 0;
          if (amount > 0) screen.speedLines(amount);
        }
      }
      if (s.grounded) tr.floor = pos.y;
      tr.action = s.action; tr.started = s.actionStarted; tr.grounded = s.grounded;
    }
    if (this.frame % 120 === 0) for (const [id, tr] of this.tracks) if (this.frame - tr.seen > 60) this.tracks.delete(id);
  }

  chase(id: string, time: number) {
    const tr = this.tracks.get(id);
    if (tr) { tr.chaseUntil = time + .42; tr.chaseFrom = time; tr.ghosts = DREAM_IMPACT ? 4 - 2 * GHOST_DIAL.fewer : 4; tr.ghostNext = time; }
  }

  footstep(kit: VfxKit, x: number, y: number, z: number, speed: number, time: number) {
    if (kit.splashes(y) && speed > 2.5 && kit.quality !== 'low') { kit.splash(x, z, Math.min(.5, .16 + speed * .04), time, 0, 0, 1); return; }
    if (speed < 5.5 || kit.quality === 'low') return;
    kit.puff(x, y + .08, z, (Math.random() - .5) * .6, .3, (Math.random() - .5) * .6, .28, time, .36, .45);
  }

  clear() { this.tracks.clear(); }
}
