import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { ENDEAVOR_MOVES, ENDEAVOR_AWAKENING } from '../../game/fighters/endeavor';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { armoryDraws } from '../vfx/armory/drawn';
import { MoveStage, STAGE, WAVE } from './MoveStage';
import { blowFloor } from './blowFloor';

export const ENDEAVOR_FLASHFIRE_ASSETS: readonly string[] = Object.freeze([]);
export const ENDEAVOR_FLASHFIRE_LIMITS = Object.freeze({ burns: 8, threads: 6 });
export const ENDEAVOR_FLASHFIRE_BEATS = Object.freeze({ compress: 1.55, charge: 2.088, burst: 2.808, end: 3.19 });
export const isEndeavorFlashfire = (id: string | undefined) => id === 'endeavor';
const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1);
const FIRE = STAGE.fire;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const HEAVY = ENDEAVOR_MOVES.heavy, SPECIAL = ENDEAVOR_MOVES.special, ULT = ENDEAVOR_MOVES.ultimate;
const THREAD_LINGER = .3;

type Burn = { actor: string; target: string; seq: number; finalHit: boolean; endpoint: THREE.Vector3 };
type Thread = { actor: string; origin: THREE.Vector3; head: THREE.Vector3; heading: THREE.Vector3; seen: number; live: boolean };

export class EndeavorFlashfire {
  private readonly stage: MoveStage;
  private burns: Burn[] = Array.from({ length: ENDEAVOR_FLASHFIRE_LIMITS.burns }, () => ({ actor: '', target: '', seq: -1, finalHit: false, endpoint: new THREE.Vector3() }));
  private threads: Thread[] = Array.from({ length: ENDEAVOR_FLASHFIRE_LIMITS.threads }, () => ({ actor: '', origin: new THREE.Vector3(), head: new THREE.Vector3(), heading: new THREE.Vector3(0, 0, 1), seen: -1e9, live: false }));
  private seen = new Float64Array(128).fill(-1);
  private seenTimes = new Float64Array(128).fill(-1);
  private eventCursor = 0;
  private burnCursor = 0;
  private disposed = false;
  private flameJoints = new Map<string, { model: THREE.Object3D; joints: { joint: THREE.Object3D; rest: THREE.Quaternion; phase: number }[] }>();
  private flicker = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private side = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private heading = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isEndeavorFlashfire(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'confirm' && e.kind !== 'hit') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTimes[i] === e.serverTime) return;
    const index = this.eventCursor++ % this.seen.length; this.seen[index] = e.id; this.seenTimes[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), target = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.burns[this.burnCursor++ % this.burns.length], { actor: e.actorId, target: e.targetId, seq, finalHit: false });
      return;
    }
    if (!target && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === 2, point = this.p, st = this.stage, t = e.serverTime;
    if (target) bodyCentre(target, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (armoryDraws(e.fighter, e.slot, e.branch, e.actorId)) { if (final && involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.47, point); return; }
    const dir = this.direction, floor = blowFloor(actor, target, point.y - 1);
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); } else dir.copy(FORWARD);
    dir.normalize();
    const ground = this.c.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, FIRE, .42, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      st.burst(point, FIRE, e.branch ? .9 : 1, t, { dir, floor });
      this.a.copy(dir).setY(.14).normalize();
      st.erupt(this.b.copy(point).addScaledVector(dir, .45), this.a, FIRE, e.branch ? .32 : .38, e.branch ? 3 : 4.2, t, .34);
      st.scar(ground.addScaledVector(dir, 1.1), FIRE, e.branch ? 1 : 1.3, t + .05, 1.5);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, FIRE, 2.2, t, { floor }); st.shock(ground, FIRE, 3.6, t, .45); st.scar(ground, FIRE, 2.4, t + .05, 2.2); return; }
      st.burst(point, FIRE, e.branch ? 1.7 : 2.1, t, { dir, floor });
      st.shatter(point, dir, FIRE, e.branch ? 2.1 : 2.9, t, .6);
      st.scar(ground, FIRE, e.branch ? 1.4 : 2, t + .05, 2.3);
      if (!e.branch && actor) for (let i = 1; i <= 2; i++) { const back = Math.min(i * 2.3, ground.distanceTo(actor.group.position) - 1.2); if (back > .8) st.scar(this.b.copy(ground).addScaledVector(dir, -back), FIRE, 1 - i * .15, t, 1.5); }
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      st.burst(point, FIRE, e.contactIndex ? 1.8 : 1.35, t, { dir, floor });
      if (e.contactIndex) st.shock(ground, FIRE, 5, t, .5);
      return;
    }
    for (const burn of this.burns) if (burn.actor === e.actorId && burn.seq === seq && burn.target === e.targetId) { burn.finalHit = true; burn.endpoint.copy(point); }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.47, point);
    const from = this.a; if (actor) from.copy(actor.handR).lerp(actor.handL, .5); else from.copy(point).addScaledVector(dir, -2);
    const along = this.b.subVectors(point, from); along.y = Math.max(along.y, .1 * Math.hypot(along.x, along.z)); if (along.lengthSq() < .01) along.copy(dir); along.normalize();
    st.erupt(from.addScaledVector(along, .6), along, FIRE, 1.05, 14, t, .6);
    st.erupt(ground, UP, FIRE, 1.4, 12, t + .05, .8);
    this.side.set(dir.z, 0, -dir.x);
    for (let i = -1; i <= 1; i += 2) st.erupt(this.b.copy(ground).addScaledVector(this.side, i * 2.7).addScaledVector(dir, 1), UP, FIRE, .7, 6.5, t + .14 + (i > 0 ? .06 : 0), .7);
    st.burst(point, FIRE, 2.8, t, { dir, floor });
    st.shock(ground, FIRE, 9, t, .6);
    st.scar(ground, FIRE, 3.2, t + .2, 2.1);
    st.scar(this.b.copy(ground).addScaledVector(dir, 3.6), FIRE, 2, t + .25, 1.8);
    st.scar(this.b.copy(ground).addScaledVector(dir, -2.6), FIRE, 1.5, t + .25, 1.5);
  }
  private cancel(id: string, targetToo = false) {
    for (const burn of this.burns) if (burn.actor === id || targetToo && burn.target === id && !burn.finalHit) burn.actor = '';
    for (const thread of this.threads) if (thread.actor === id) thread.live = false;
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const [id, cache] of this.flameJoints) if (!fighters.has(id)) { for (const entry of cache.joints) entry.joint.quaternion.copy(entry.rest); this.flameJoints.delete(id); }
    for (const f of fighters.values()) {
      const s = f.state; if (!isEndeavorFlashfire(s.fighter) || !s.alive) continue;
      this.animateNativeFlames(f, time);
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 7.3, yaw = s.yaw ?? f.group.rotation.y;
      const heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), hand = f.handR;
      if (s.action === 'awaken') { this.awakening(f, elapsed); continue; }
      if (s.whiffedAt !== undefined) continue;
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        st.tongue(this.p.copy(hand).setY(hand.y + .2), UP, .36, .45 + .7 * k, FIRE, .3 + .7 * k, seed);
        st.tongue(this.p.copy(hand).addScaledVector(heading, -.3), this.a.copy(heading).multiplyScalar(-1).setY(.45).normalize(), .3, .4 + .6 * k, FIRE, k, seed + 1);
        st.glow(hand, .34, FIRE.main, .6 * k); st.glow(hand, .14, FIRE.core, .8 * k);
        st.light(this.p.copy(hand).addScaledVector(heading, .4), 2.2, FIRE, .25 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
        if (elapsed < contact) {
          const k = clamp(elapsed / contact);
          st.charge(hand, FIRE, .27, k, seed);
          this.a.copy(heading).multiplyScalar(-1).setY(.25).normalize();
          for (let i = 0; i < 3; i++) st.tongue(this.p.copy(hand).addScaledVector(heading, -.3 - i * .38 * k), this.a, .34 - i * .05, (.5 + .9 * k) * (1 - i * .18), FIRE, k * (1 - i * .2), seed + i);
        } else if (elapsed < contact + .24) {
          const flare = 1 - (elapsed - contact) / .24;
          st.column(hand, this.a.copy(heading).setY(.1).normalize(), .3, .5 + 1.3 * flare, FIRE, flare, seed);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          st.charge(hand, FIRE, .36, k, seed);
          this.side.set(heading.z, 0, -heading.x);
          for (let i = -2; i <= 2; i++) {
            this.p.copy(hand).addScaledVector(this.side, i * .075).addScaledVector(heading, .1); this.p.y += .07 - Math.abs(i) * .025;
            st.glow(this.p, .08 + .07 * k, FIRE.core, .5 + .7 * k);
            st.streak(this.p, this.a.copy(this.p).addScaledVector(heading, .12 + .55 * k).addScaledVector(this.side, i * .09 * k), .035, FIRE.core, k);
          }
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .12) {
        const k = clamp(elapsed / ULT.contacts[0]);
        st.charge(hand, FIRE, .3, k, seed);
        st.tongue(this.p.copy(hand).addScaledVector(heading, -.35), this.a.copy(heading).multiplyScalar(-1).setY(.3).normalize(), .34, .5 + .8 * k, FIRE, k, seed);
      }
    }
    for (const f of flights.values()) {
      if (!isEndeavorFlashfire(f.fighter) || f.slot !== 'special' || f.branch || !f.released || !f.actorId || armoryDraws(f.fighter, 'special', undefined, f.actorId)) continue;
      let thread = this.threads.find(th => th.live && th.actor === f.actorId);
      if (!thread) { thread = this.threads.find(th => !th.live) ?? this.threads[0]; thread.actor = f.actorId; thread.live = true; }
      thread.head.copy(f.position); thread.heading.copy(f.heading); thread.seen = time;
      if (f.origin) thread.origin.copy(f.origin); else thread.origin.copy(f.position).addScaledVector(f.heading, -1);
    }
    for (const thread of this.threads) {
      if (!thread.live) continue;
      const gone = time - thread.seen;
      if (gone > THREAD_LINGER || gone < -.5 || !fighters.get(thread.actor)?.state.alive) { thread.live = false; continue; }
      this.spider(thread, 1 - clamp(gone / THREAD_LINGER), time);
    }
    for (const burn of this.burns) {
      if (!burn.actor) continue;
      const actor = fighters.get(burn.actor), victim = fighters.get(burn.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !burn.finalHit || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== burn.seq || s.whiffedAt !== undefined) { burn.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration; if (elapsed > ENDEAVOR_FLASHFIRE_BEATS.end) { burn.actor = ''; continue; }
      if (elapsed >= ENDEAVOR_FLASHFIRE_BEATS.burst) continue;
      this.gather(actor, burn, elapsed);
    }
    st.close();
  }

  private spider(thread: Thread, fade: number, time: number) {
    const st = this.stage, heading = thread.heading, side = this.side.set(heading.z, 0, -heading.x), span = thread.origin.distanceTo(thread.head);
    if (span < .2) return;
    const fan = Math.min(.42, span * .12), bow = Math.min(.55, span * .09);
    for (let i = -2; i <= 2; i++) {
      const a = this.a.copy(thread.origin).addScaledVector(side, i * .05), b = this.b.copy(thread.head).addScaledVector(side, i * fan); b.y += .22 - Math.abs(i) * .1;
      const mid = this.c.copy(a).lerp(b, .5).addScaledVector(side, i * bow); mid.y += .28 + .06 * Math.sin(time * 19 + i * 2.1);
      st.streak(a, mid, .26, FIRE.main, .6 * fade); st.streak(mid, b, .26, FIRE.main, .6 * fade);
      st.streak(a, mid, .085, FIRE.core, 1.5 * fade); st.streak(mid, b, .085, FIRE.core, 1.5 * fade);
      for (let j = 0; j < 2; j++) {
        const u = ((time * 1.7 + i * .37 + j * .5) % 1 + 1) % 1;
        this.p.copy(u < .5 ? a : mid).lerp(u < .5 ? mid : b, u < .5 ? u * 2 : u * 2 - 2 + 1); this.p.y += .2;
        st.tongue(this.p, UP, .26, .55 + .25 * Math.abs(i), FIRE, fade * (.6 + .4 * u), i * 5 + j);
      }
    }
    st.glow(thread.head, 1.15, FIRE.main, .95 * fade); st.glow(thread.head, .45, FIRE.core, 1.2 * fade);
    st.glow(thread.origin, .6, FIRE.core, .9 * fade);
    st.light(this.p.copy(thread.head).setY(thread.head.y + .3), 6.5, FIRE, 1.15 * fade);
    st.light(this.p.copy(thread.origin).lerp(thread.head, .45).setY(thread.origin.y + .3), 5.5, FIRE, .9 * fade);
  }

  private gather(actor: Fighter, burn: Burn, elapsed: number) {
    const st = this.stage, B = ENDEAVOR_FLASHFIRE_BEATS, s = actor.state, seed = burn.seq * 3.7;
    const ignite = clamp((elapsed - ULT.contacts[0]) / (B.compress - ULT.contacts[0])), build = clamp((elapsed - B.compress) / (B.burst - B.compress));
    const yaw = s.yaw ?? actor.group.rotation.y, feet = actor.group.position;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    st.dim(.3 + .5 * build, burn.actor, burn.target);
    st.ring(feet, 2.1 + .4 * build, .9 + 1.1 * ignite + 1.1 * build, FIRE, .55 + .45 * build, seed, 8);
    st.pool(this.p.copy(feet), 2.2 + 2.4 * build, FIRE, .3 + .7 * ignite, seed);
    this.a.copy(actor.handR).lerp(actor.handL, .5);
    st.charge(this.a, FIRE, .36 + .34 * build, Math.max(ignite * .45, build), seed);
    if (build > .6) st.speed(.55 * (build - .6) / .4, burn.actor, burn.target);
  }

  private animateNativeFlames(f: Fighter, time: number) {
    const model = (f.shownBody ?? f).model; if (!model) return;
    let cache = this.flameJoints.get(f.state.id);
    if (!cache || cache.model !== model) {
      const joints: { joint: THREE.Object3D; rest: THREE.Quaternion; phase: number }[] = [];
      model.traverse(joint => { if (/^AC_.*(?:fire|hige).*_[BC]_/.test(joint.name)) joints.push({ joint, rest: joint.quaternion.clone(), phase: joints.length * 1.83 }); });
      cache = { model, joints }; this.flameJoints.set(f.state.id, cache);
    }
    for (const entry of cache.joints) { this.flicker.setFromAxisAngle(FORWARD, Math.sin(time * 9 + entry.phase) * .035); entry.joint.quaternion.copy(entry.rest).multiply(this.flicker); }
  }
  private awakening(f: Fighter, elapsed: number) {
    const st = this.stage, born = ENDEAVOR_AWAKENING.beats.fistRaise, fade = clamp((.9 - elapsed) / .14), k = clamp(elapsed / born), yaw = f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    if (elapsed < born) {
      st.tongue(f.handR, UP, .2 + .3 * k, .4 + .6 * k, FIRE, .8, 1); st.tongue(f.handL, UP, .16 + .25 * k, .33 + .5 * k, FIRE, .8, 2);
      st.glow(f.handR, .3 + .3 * k, FIRE.main, .7 * k); st.glow(f.handL, .26 + .26 * k, FIRE.main, .7 * k);
    } else {
      const age = elapsed - born;
      st.tongue(this.p.copy(f.handR).setY(f.handR.y + .18), UP, .6, 1.25, FIRE, fade, 3);
      st.glow(f.handR, .7, FIRE.main, fade);
      st.disc(this.p.copy(f.group.position), .35 + age * 6, FIRE.core, fade * .8, WAVE, .96);
      for (let i = -1; i <= 1; i += 2) { this.p.copy(f.group.position).addScaledVector(this.side, i * .65); this.p.y += .8; st.tongue(this.p, UP, .5, 1.75, FIRE, fade * .8, 4 + i); }
      st.light(this.p.copy(f.group.position).setY(f.group.position.y + 1), 4.5, FIRE, .8 * fade);
    }
  }
  reset() {
    for (const cache of this.flameJoints.values()) for (const entry of cache.joints) entry.joint.quaternion.copy(entry.rest);
    this.flameJoints.clear(); for (const burn of this.burns) burn.actor = ''; for (const thread of this.threads) thread.live = false;
    this.seen.fill(-1); this.seenTimes.fill(-1); this.eventCursor = this.burnCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
