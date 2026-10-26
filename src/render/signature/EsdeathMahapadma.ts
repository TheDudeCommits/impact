import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { ESDEATH_MOVES } from '../../game/fighters/esdeath';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { RING, STAR } from './GlowBatch';
import { BURN, MoveStage, STAGE, SHEEN, WAVE, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { sweep } from './StageStrokes';

export const isEsdeathMahapadma = (id: string | undefined) => id === 'esdeath';
export const ESDEATH_FROST_LIMITS = Object.freeze({ marks: 10, freezes: 6, spears: 6, motes: 18 });
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const ICE: StageLook = { ...STAGE.quake, element: { spike: 0xffffff, rim: 0x8fd4ff, light: 0xd4eeff, ink: 0x0a1626 } };
const HEAVY = ESDEATH_MOVES.heavy, SPECIAL = ESDEATH_MOVES.special, ULT = ESDEATH_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1];
const ARC = .22, BREATH = .4, VOLLEY = .16;
type Freeze = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; live: boolean };

export class EsdeathMahapadma {
  private readonly stage: MoveStage;
  private freezes: Freeze[] = Array.from({ length: ESDEATH_FROST_LIMITS.freezes }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: ESDEATH_FROST_LIMITS.marks }, () => ({ born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private freezeCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3(); private tip = new THREE.Vector3(); private prey = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const f of this.freezes) if (f.actor === id || victim && f.target === id && !f.final) f.actor = ''; }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isEsdeathMahapadma(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1, st = this.stage, t = e.serverTime;
    let floor = blowFloor(actor, victim, Infinity);
    if (e.kind === 'confirm') {
      if (e.slot !== 'ultimate' || e.branch || !e.targetId) return;
      Object.assign(this.freezes[this.freezeCursor++ % this.freezes.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      if (actor) { st.dome(bodyCentre(actor, this.p), ICE, 11, t, .34); st.shock(this.a.copy(actor.group.position), ICE, 9, t, .45); }
      if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.6, actor ? this.p : undefined);
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p;
    if (victim) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const f of this.freezes) if (f.actor === e.actorId && f.seq === seq) { f.final = true; floor = f.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, ICE, .4, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      st.burst(point, ICE, .7 * big, t, { dir, floor });
      st.shock(ground, ICE, 4.2 * big, t, .4);
      st.scar(ground, ICE, 1.8 * big, t + .05, 1.3);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, ICE, 2, t, { floor }); st.shock(ground, ICE, 4.5, t, .45); st.scar(ground, ICE, 3, t, 1.8); return; }
      const big = e.branch ? .7 : 1, m = this.marks[this.markCursor++ % this.marks.length];
      m.at.copy(point); m.dir.copy(dir); m.born = t; m.life = .55; m.size = big; m.seed = (Math.abs(point.x * 7.3 + point.z * 4.1 + t * 2.7)) % 43; m.live = true;
      st.burst(point, ICE, 1.9 * big, t, { dir, floor });
      st.shatter(point, dir, ICE, 2.7 * big, t, .55);
      st.shock(ground, ICE, 5.5 * big, t, .45);
      st.scar(ground, ICE, 2.8 * big, t + .05, 2);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) { st.burst(point, ICE, 1, t, { dir, floor }); return; }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.45, point);
    st.shatter(point, dir, ICE, 7, t, .9);
    st.shatter(this.a.copy(ground).setY(floor + .06), UP, ICE, 8, t + .04, 1.3);
    st.burst(point, ICE, 2.5, t, { dir, floor });
    st.dome(point, ICE, 6, t, .5);
    st.shock(ground, ICE, 10, t, .6);
    st.scar(ground, ICE, 5, t + .1, 2.2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isEsdeathMahapadma(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 5.9, feet = f.group.position, heading = this.face(f), side = this.side, tip = f.strikePoint(this.tip);
      if (s.action === 'light') {
        this.glint(f.handR, tip, Math.sin(clamp(s.actionTime) * Math.PI), .7);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) { const k = clamp(elapsed / contact); this.glint(f.handR, tip, k, .7); st.charge(tip, ICE, .12, k, seed); }
        else if (elapsed < contact + ARC) {
          const w = (elapsed - contact) / ARC, cut = clamp(w / .3), fade = 1 - w * w;
          this.p.copy(feet).addScaledVector(heading, .7).setY(feet.y + 1.05);
          this.c.copy(heading).multiplyScalar(.8).addScaledVector(side, .6).normalize(); this.d.copy(UP).addScaledVector(side, -.62).normalize();
          sweep(st, this.p, this.c, this.d, 1.7, -.7, -.7 + 1.8 * cut, .2, ICE, 1.3 * fade, 10);
          st.light(this.a.copy(this.p).addScaledVector(heading, 1.2).setY(feet.y + .5), 4, ICE, .35 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) { const k = clamp(elapsed / release); this.spear(tip, heading, 2.8 * k, .5 + .5 * k, k); st.charge(tip, ICE, .34, k, seed); }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        this.glint(f.handR, tip, k, 1.2); st.charge(tip, ICE, .26, k, seed);
      }
    }
    for (const flight of flights.values()) {
      if (!isEsdeathMahapadma(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      const floor = (flight.actorId ? fighters.get(flight.actorId)?.group.position.y : undefined) ?? flight.position.y - 1.2;
      this.spear(this.p.copy(flight.position).addScaledVector(flight.heading, -1.7), flight.heading, 2.8, 1, 1);
      for (let i = 1; i <= 3; i++) st.glow(this.a.copy(flight.position).addScaledVector(flight.heading, -1.7 - i * .9), .9 - i * .2, ICE.main, .4 - i * .1, RING, .06, 0, .8);
      st.disc(this.a.set(flight.position.x, floor, flight.position.z), 2, ICE.main, .7, SHEEN, 1);
      st.light(this.a.copy(flight.position).setY(flight.position.y + .2), 6.5, ICE, 1);
    }
    for (const fr of this.freezes) {
      if (!fr.actor) continue;
      const actor = fighters.get(fr.actor), victim = fighters.get(fr.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !fr.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== fr.seq || s.whiffedAt !== undefined) { fr.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { fr.actor = ''; continue; }
      if (!fr.final && elapsed < LAST && victim) this.frozen(actor, victim, fr, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age < 0) continue;
      const w = age / m.life, fade = (1 - w) * (1 - w), out = clamp(age / .06), right = this.a.set(m.dir.z, 0, -m.dir.x);
      for (let i = 0, n = st.n(7, 4); i < n; i++) {
        const fan = (i / (n - 1) - .5) * 2.4, len = (1.5 + 1.3 * hash(m.seed + i * 3.1)) * m.size * out;
        this.b.copy(UP).multiplyScalar(Math.cos(fan)).addScaledVector(right, Math.sin(fan)).addScaledVector(m.dir, .35).normalize();
        this.c.copy(m.at).addScaledVector(this.b, .2); this.d.copy(m.at).addScaledVector(this.b, .2 + len);
        st.streak(this.c, this.d, .13 * m.size * (.4 + .6 * fade), ICE.main, 1.3 * fade, .5);
      }
    }
    st.close();
  }

  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }
  private glint(hand: THREE.Vector3, tip: THREE.Vector3, k: number, size: number) {
    if (k <= .02) return;
    const st = this.stage;
    st.streak(hand, tip, .06 * size, ICE.main, .9 * k, .5);
    st.glow(tip, .24 * size, ICE.main, .7 * k); st.glow(tip, .12 * size, ICE.core, k, STAR, .2, 4);
    st.light(tip, 2 + size, ICE, .26 * k);
  }
  private spear(at: THREE.Vector3, along: THREE.Vector3, length: number, weight: number, k: number) {
    if (k <= .02 || length <= .05) return;
    const st = this.stage, point = this.b.copy(at).addScaledVector(along, length), neck = this.c.copy(at).addScaledVector(along, length * .68);
    st.streak(at, point, .1 * weight, ICE.main, 1.1 * k, .5);
    st.streak(neck, point, .2 * weight, ICE.main, 1.2 * k, .45);
    st.glow(point, .5 * weight, ICE.main, .8 * k); st.glow(point, .2 * weight, ICE.core, k, STAR, .2, 6);
    st.glow(neck, .8 * weight, ICE.main, .35 * k);
  }

  private frozen(actor: Fighter, victim: Fighter, fr: Freeze, elapsed: number, time: number) {
    const st = this.stage, since = elapsed - FIRST, g = clamp(since / (LAST - FIRST)), seed = fr.seq * 2.9, feet = this.ground.copy(actor.group.position).setY(fr.floor);
    const heading = this.face(actor), side = this.side, prey = bodyCentre(victim, this.prey);
    this.dir.subVectors(prey, feet).setY(0); if (this.dir.lengthSq() < .01) this.dir.copy(heading); this.dir.normalize();
    const breath = since < BREATH ? Math.min(1, since / .08) * (1 - clamp((since - BREATH + .2) / .2)) : 0;
    if (breath > .01) {
      if (involvesLocal(fr.actor, fr.target)) SIGNATURE.screen?.timeStop?.(breath);
      st.light(this.p.copy(feet).lerp(prey, .5).setY(feet.y + 1.5), 14, ICE, .7 * breath);
    }
    st.dim(.25 + .4 * g, fr.actor, fr.target);
    st.disc(this.p.set(prey.x, fr.floor, prey.z), 6.5 * (.4 + .6 * clamp(since / .35)), ICE.rim, .75, BURN, clamp(since / .35), seed, 1, 1.5);
    st.light(this.p.copy(prey).addScaledVector(this.dir, 1.2), 4.5, ICE, .3);
    for (let i = 0, n = st.n(ESDEATH_FROST_LIMITS.motes, 8); i < n; i++) {
      const ang = i * 2.399963 + seed, r = 2 + 4.4 * hash(seed + i * 1.7);
      this.p.set(feet.x + Math.cos(ang) * r, feet.y + .4 + 2.8 * hash(seed + i * 4.3), feet.z + Math.sin(ang) * r);
      st.glow(this.p, .1 + .12 * hash(i * 2.1), ICE.core, (.5 + .4 * Math.sin(time * 3 + i)) * clamp(since / .3), STAR, .2, i);
    }
    st.bubble(prey, 1.2, ICE, .55 + .3 * g);
    st.cracks(prey, this.dir, 1.1 + 1.3 * g, ICE, .25 + .75 * g, seed, .7);
    const flown = clamp((elapsed - (LAST - VOLLEY)) / VOLLEY);
    for (let i = 0; i < ESDEATH_FROST_LIMITS.spears; i++) {
      const born = BREATH + .12 + i * .2, k = clamp((since - born) / .16); if (k <= 0) continue;
      const out = (i % 2 ? 1 : -1) * (1.5 + .6 * Math.floor(i / 2)), up = 2.1 + .5 * Math.floor(i / 2) - .15 * (i % 2);
      this.a.copy(feet).addScaledVector(side, out).addScaledVector(heading, .7).setY(feet.y + up);
      this.d.subVectors(prey, this.a).normalize();
      this.a.addScaledVector(this.d, flown * Math.max(0, this.a.distanceTo(prey) - 2.4));
      this.spear(this.a, this.d, 2.4, .55, k);
    }
    actor.strikePoint(this.tip); st.glow(this.tip, .16, ICE.core, .6 + .3 * g, STAR, .2, 4);
    if (g > .85) st.speed(.5 * (g - .85) / .15, fr.actor, fr.target);
  }

  private awakening(f: Fighter) {
    const st = this.stage, w = clamp(f.state.actionTime), release = .76, pre = w < release, progress = pre ? clamp(w / release) : clamp((w - release) / (1 - release)), fade = pre ? Math.sin(progress * Math.PI * .5) * .55 : 1 - progress;
    if (fade <= .02) return;
    st.disc(this.p.copy(f.group.position), pre ? 1.6 - progress * .8 : .8 + progress * 3.4, ICE.core, fade * .8, WAVE, .96);
    if (w > .17 && w < .66) st.glow(f.handL, .16, ICE.core, Math.sin(clamp((w - .17) / .49) * Math.PI) * .8, STAR, .2, 2);
    for (let i = 0, n = st.n(10, 5); i < n; i++) {
      const theta = i * 2.399, r = pre ? .55 : .55 + progress * .8;
      this.a.set(f.group.position.x + Math.sin(theta) * r, f.group.position.y + .12 + (i % 5) * .29, f.group.position.z + Math.cos(theta) * r);
      st.streak(this.a, this.b.copy(this.a).setY(this.a.y + .3), .035, ICE.main, fade * .9, .5);
    }
    st.light(this.p.setY(f.group.position.y + 1), 3.5, ICE, .4 * fade);
  }
  reset() {
    for (const f of this.freezes) f.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.freezeCursor = this.markCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
