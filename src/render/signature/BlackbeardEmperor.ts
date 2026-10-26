import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { RING } from './GlowBatch';
import { MoveStage, STAGE, WAVE } from './MoveStage';
import { blowFloor } from './blowFloor';

export const isBlackbeardEmperor = (id: string | undefined) => id === 'blackbeard';
export const BLACKBEARD_EMPEROR_ASSETS: readonly string[] = Object.freeze([]);
export const BLACKBEARD_EMPEROR_LIMITS = Object.freeze({ confirms: 8 });
export const BLACKBEARD_EMPEROR_BEATS = Object.freeze({ darkness: .36, quake: .55, release: .72, final: 3.25 });
export type BlackbeardSocket = 'LeftHand' | 'RightHand' | 'LeftToeBase' | 'RightToeBase' | 'Both';
export function blackbeardStrikeSocket(action: string, elapsed: number, clip?: string, contactIndex?: number, outfitId?: string): BlackbeardSocket {
  const original = outfitId === 'outfit-blackbeard-original';
  if (clip === 'Liberation Worldbreaker' || action === 'ultimate' && !clip) {
    const contact = contactIndex ?? (elapsed < .95 ? 0 : elapsed < 2.9 ? 1 : 2);
    return contact === 2 ? 'Both' : contact === 0 ? original ? 'LeftHand' : 'RightHand' : original ? 'RightHand' : 'LeftToeBase';
  }
  if (clip === 'Emperor Heel') return 'LeftToeBase';
  if (clip === 'Quake Uppercut') return original ? 'RightToeBase' : 'LeftToeBase';
  if (clip === 'Rush 3') return 'LeftToeBase';
  if (clip === 'Gura Hammer' || clip === 'Island Breaker' || action === 'heavy' && !clip) return original ? 'RightHand' : 'LeftToeBase';
  if (clip === 'Dark Descent') return original ? 'RightHand' : 'Both';
  if (clip === 'Dark Backfist' || clip === 'Yami Jab' || clip === 'Rush 1' || action === 'light' && !clip) return original ? 'LeftHand' : 'RightHand';
  return 'RightHand';
}
export function blackbeardAuthoredKick(clip?: string, outfitId?: string, elapsed = 0): boolean {
  const original = outfitId === 'outfit-blackbeard-original';
  if (clip === 'Rush 3' || clip === 'Quake Uppercut' || clip === 'Emperor Heel') return true;
  if (original) return false;
  return clip === 'Gura Hammer' || clip === 'Island Breaker' || clip === 'Liberation Worldbreaker' && elapsed > .95 && elapsed < 2.15;
}
export function blackbeardStrikePoint(fighter: Fighter, out: THREE.Vector3, clip?: string, sourceTime?: number, contactIndex?: number): THREE.Vector3 {
  const s = fighter.state;
  if (!clip && s.branch) clip = ({ lh: 'Dark Backfist', llh: 'Quake Uppercut', lllh: 'Island Breaker', llls: 'Gravity Crash', airHeavy: 'Emperor Heel', airSpecial: 'Dark Descent' } as const)[s.branch];
  if (!clip && s.action === 'light' && s.chain) clip = `Rush ${s.chain}`;
  const socket = blackbeardStrikeSocket(s.action, sourceTime ?? s.actionTime * s.actionDuration, clip, contactIndex, fighter.outfitId ?? s.outfit);
  if (socket === 'Both') return out.copy(fighter.handL).lerp(fighter.handR, .5);
  if (socket.endsWith('ToeBase')) {
    const bone = fighter.bones?.get(socket.toLowerCase()) ?? fighter.bones?.get(socket.replace('ToeBase', 'Foot').toLowerCase());
    if (bone) return bone.getWorldPosition(out);
  }
  return out.copy(socket === 'LeftHand' ? fighter.handL : fighter.handR);
}
const UP = new THREE.Vector3(0, 1, 0);
const DARK = STAGE.dark, QUAKE = STAGE.quake;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const B = BLACKBEARD_EMPEROR_BEATS;
type Confirm = { actor: string; target: string; seq: number; final: boolean; floor: number; endpoint: THREE.Vector3 };
type Vortex = { at: THREE.Vector3; born: number; size: number; live: boolean };
const VORTEX_LIFE = 1.15;

export class BlackbeardEmperor {
  private readonly stage: MoveStage;
  private confirms: Confirm[] = Array.from({ length: BLACKBEARD_EMPEROR_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0, endpoint: new THREE.Vector3() }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private vortices: Vortex[] = Array.from({ length: 4 }, () => ({ at: new THREE.Vector3(), born: -1e9, size: 1, live: false }));
  private cursor = 0; private confirmCursor = 0; private vortexCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3();
  private centre = new THREE.Vector3(); private heading = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isBlackbeardEmperor(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = event.id; this.seenTime[index] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined, seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, 0);
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], { actor: event.actorId, target: event.targetId, seq, final: false, floor });
      return;
    }
    if (!victim && !event.endpoint) return;
    const final = event.slot === 'ultimate' && !event.branch && event.contactIndex === 2, point = this.p, st = this.stage, t = event.serverTime;
    if (event.endpoint) point.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); else bodyCentre(victim!, point);
    let confirmed = false;
    if (final) for (const c of this.confirms) if (c.actor === event.actorId && c.seq === seq) { c.final = true; c.endpoint.copy(point); floor = c.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (event.slot === 'light') { st.burst(point, DARK, .5, t, { dir, floor, clean: true }); return; }
    if (event.slot === 'heavy') { this.quake(point, ground, dir, floor, event.branch ? .8 : 1, t); return; }
    if (event.slot === 'special') {
      if (event.branch === 'airSpecial') { st.burst(point, DARK, 2, t, { floor }); st.shock(ground, QUAKE, 4.5, t, .45); st.scar(ground, DARK, 3.4, t, 1.8); return; }
      const big = event.branch ? .65 : 1;
      st.burst(point, DARK, 1.9 * big, t, { dir, floor });
      st.scar(ground, DARK, 4.2 * big, t, 1.6);
      st.erupt(ground, UP, DARK, .85 * big, 4.4 * big, t + .05, 1);
      const vortex = this.vortices[this.vortexCursor++ % this.vortices.length];
      vortex.at.copy(ground); vortex.born = t; vortex.size = big; vortex.live = true;
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    if (!final) {
      if (event.contactIndex) this.quake(point, ground, dir, floor, 1.05, t); else st.burst(point, DARK, 1.05, t, { dir, floor });
      return;
    }
    if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.5, point);
    st.shatter(point, dir, QUAKE, 7, t, .8);
    st.shatter(this.a.copy(ground).setY(floor + .06), UP, QUAKE, 8.5, t + .04, 1.4);
    st.dome(point, QUAKE, 6, t, .45);
    st.burst(point, QUAKE, 1.9, t, { dir, floor });
    st.shock(ground, QUAKE, 10, t, .6);
    st.erupt(ground, UP, DARK, 1.2, 8, t + .22, .6);
    for (let i = 0; i < 3; i++) { const ang = i * 2.094 + 1; st.erupt(this.a.set(ground.x + Math.cos(ang) * 3.8, floor, ground.z + Math.sin(ang) * 3.8), UP, DARK, .6, 5, t + .3 + i * .06, .55); }
    st.scar(ground, DARK, 6, t + .1, 2);
  }
  private quake(point: THREE.Vector3, ground: THREE.Vector3, dir: THREE.Vector3, floor: number, big: number, t: number) {
    const st = this.stage;
    st.shatter(point, dir, QUAKE, 2.8 * big, t, .45);
    st.burst(point, QUAKE, .8 * big, t, { dir, floor });
    st.shock(ground, QUAKE, 4.6 * big, t, .45);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isBlackbeardEmperor(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 5.1, yaw = s.yaw ?? f.group.rotation.y;
      const heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), feet = f.group.position;
      if (s.action === 'awaken') { this.awakening(f, elapsed); continue; }
      if (!['light', 'heavy', 'special', 'ultimate'].includes(s.action) || s.whiffedAt !== undefined) continue;
      if (s.action === 'ultimate' && elapsed > .56 && s.confirmedAt === undefined) continue;
      const strike = f.strikePoint(this.centre), boost = s.awakened ? 1.2 : 1;
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        st.ball(strike, .2 * boost * (.5 + .5 * k), DARK, seed, k);
        st.glow(strike, .34 * boost, DARK.core, .7 * k, RING, .06, Math.floor(time * 30), .8);
        st.tongue(this.p.copy(strike).addScaledVector(heading, -.3).setY(strike.y + .12), this.a.copy(heading).multiplyScalar(-1).setY(.6).normalize(), .34, .5 + .5 * k, DARK, k, seed);
        st.light(strike, 2.2, DARK, .2 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .5 : .6;
        if (elapsed < contact) { const k = clamp(elapsed / contact); st.bubble(strike, (.26 + .3 * k) * boost, QUAKE, .45 + .55 * k); st.charge(strike, QUAKE, .2, k, seed); }
        else if (elapsed < contact + .22) st.cracks(strike, heading, 1.3 * boost, QUAKE, 1, seed, 1 - (elapsed - contact) / .22);
      } else if (s.action === 'special' && !s.branch && elapsed < B.release) {
        const k = clamp(elapsed / B.release);
        st.pool(this.p.copy(feet), 2.4 + 1.5 * k, DARK, k, seed);
        st.charge(strike, DARK, .42 * boost, k, seed);
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined) {
        st.charge(strike, DARK, .32, clamp(elapsed / .52), seed);
      }
    }
    for (const flight of flights.values()) {
      if (!isBlackbeardEmperor(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      const seed = (flight.since ?? 0) * 3.3, floor = (flight.actorId ? fighters.get(flight.actorId)?.group.position.y : undefined) ?? flight.position.y - 1.2;
      st.orb(flight.position, flight.heading, .95, DARK, seed);
      st.pool(this.p.set(flight.position.x, floor, flight.position.z), 2.3, DARK, 1, seed, .9);
      for (let i = 0, n = st.n(6, 3); i < n; i++) {
        const phase = (time * 2.2 + i * .618) % 1, az = i * 2.399963 + seed;
        this.a.set(Math.cos(az), .15 + .5 * Math.sin(az * 1.7), Math.sin(az)).normalize();
        const r = 1.1 + 3.4 * (1 - phase) * (1 - phase);
        st.streak(this.b.copy(flight.position).addScaledVector(this.a, r), this.p.copy(flight.position).addScaledVector(this.a, Math.max(.9, r - .9 - phase)), .07, DARK.main, 1.3 * Math.sin(Math.PI * phase));
      }
    }
    for (const vortex of this.vortices) {
      if (!vortex.live) continue;
      const age = time - vortex.born;
      if (age >= VORTEX_LIFE) { vortex.live = false; continue; }
      if (age < 0) continue;
      const u = age / VORTEX_LIFE, fade = Math.min(1, age / .1) * (1 - u), reach = 4 * vortex.size;
      st.ball(this.p.copy(vortex.at).setY(vortex.at.y + 1.1), (.55 + .25 * Math.sin(time * 14)) * vortex.size * (1 - u * .6), DARK, vortex.born, fade);
      for (let i = 0, n = st.n(10, 5); i < n; i++) {
        const phase = (time * 1.6 + i * .618) % 1, r = reach * (1 - phase) * (1 - phase) + .4, ang = i * 2.399963 + vortex.born + phase * 2.6, r2 = Math.max(.3, r - .9), ang2 = ang + .45;
        this.a.set(vortex.at.x + Math.cos(ang) * r, vortex.at.y + .12 + .9 * phase, vortex.at.z + Math.sin(ang) * r);
        this.b.set(vortex.at.x + Math.cos(ang2) * r2, vortex.at.y + .12 + 1.05 * phase, vortex.at.z + Math.sin(ang2) * r2);
        st.streak(this.a, this.b, .08, DARK.main, 1.4 * Math.sin(Math.PI * phase) * fade);
      }
    }
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > 3.90) { c.actor = ''; continue; }
      if (!c.final && elapsed < B.final) this.gather(actor, c, elapsed);
    }
    st.close();
  }

  private gather(actor: Fighter, c: Confirm, elapsed: number) {
    const st = this.stage, g = clamp((elapsed - .52) / (B.final - .52)), seed = c.seq * 2.7, feet = this.ground.copy(actor.group.position).setY(c.floor);
    st.pool(feet, 3 + 4.2 * g, DARK, Math.min(1, .3 + g * 1.2), seed);
    st.ring(feet, 2.3 + .5 * g, 1.3 + 1.5 * g, DARK, .6 + .4 * g, seed, 9);
    st.charge(actor.handL, DARK, .3 + .22 * g, Math.max(.4, g), seed);
    st.bubble(actor.handR, .3 + .45 * g, QUAKE, .5 + .5 * g);
    st.charge(actor.handR, QUAKE, .22 + .14 * g, g, seed + 1);
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }

  private awakening(f: Fighter, elapsed: number) {
    const st = this.stage, fade = clamp(elapsed / .36) * clamp((.9 - elapsed) / .10);
    st.ball(f.handL, .18 + fade * .17, DARK, 1, fade); st.glow(f.handL, .5, DARK.core, .7 * fade, RING, .06, 0, .8);
    if (elapsed > .36) st.bubble(f.handR, .2 + fade * .14, QUAKE, fade);
    if (elapsed > .55) st.disc(this.p.copy(f.group.position), .5 + (elapsed - .55) * 4, DARK.core, fade * .72, WAVE, .96);
  }
  reset() {
    for (const c of this.confirms) c.actor = ''; for (const vortex of this.vortices) vortex.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.confirmCursor = this.vortexCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
