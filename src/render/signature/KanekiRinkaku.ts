import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { KANEKI_MOVES } from '../../game/fighters/kaneki';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { ABYSS, BLOOD } from './FlameSprites';
import { STAR } from './GlowBatch';
import { MoveStage, WAVE, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { limb, sweep } from './StageStrokes';

export const isKanekiRinkaku = (id: string | undefined) => id === 'ken-kaneki';
export const KANEKI_RINKAKU_LIMITS = Object.freeze({ marks: 12, confirms: 6 });
export const KANEKI_KNUCKLE_LOCAL = Object.freeze([.085805319, -.033871409, -.017292341] as const);
export const KANEKI_TIP_LENGTHS = Object.freeze([.17629492282867432, .1773757040500641, .06668964773416519, .06647805869579315] as const);
export function kanekiStrikeJoint(action: string, clip?: string, contactIndex = 0): string {
  if (action === 'ultimate' && (!clip || clip === 'One-Eyed Requiem')) return contactIndex === 0 ? 'RightHand' : contactIndex === 2 ? 'Rinkaku2_8' : 'Rinkaku1_8';
  if (['Ghoul Knuckle', 'Rush 1'].includes(clip ?? '') || (!clip && action === 'light')) return 'RightHand';
  return ['Rush 2', 'Predator Cross'].includes(clip ?? '') ? 'Rinkaku2_8' : 'Rinkaku1_8';
}
export function kanekiAuthoredJabStep(clip: string | undefined, sourceSeconds: number): boolean {
  if (!Number.isFinite(sourceSeconds) || sourceSeconds < 0) return false;
  if (clip === 'Ghoul Knuckle' || clip === 'Rush 1') return sourceSeconds < .60;
  return clip === 'One-Eyed Requiem' && sourceSeconds < .8625;
}
export function kanekiContactPoint(f: Pick<Fighter, 'shownBody' | 'drawnJoint'>, action: string, clip: string | undefined, index: number, out: THREE.Vector3): boolean {
  const name = kanekiStrikeJoint(action, clip, index);
  if (name === 'RightHand') { const hand = f.drawnJoint(name); if (!hand) return false; out.set(...KANEKI_KNUCKLE_LOCAL); hand.localToWorld(out); return true; }
  const node = f.shownBody.model.getObjectByName(name); if (!node) return false;
  const tail = Number(name[7]) - 1; out.set(0, KANEKI_TIP_LENGTHS[tail] ?? KANEKI_TIP_LENGTHS[0], 0); node.localToWorld(out); return true;
}

const UP = new THREE.Vector3(0, 1, 0);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const KAGUNE: StageLook = { core: lin(3.1, .8, .95), main: lin(1.9, .07, .17), rim: lin(.7, .03, .08), light: lin(1.3, .14, .2), element: { spike: 0xff6f88, rim: 0xd0102e, light: 0xe0203a, ink: 0x120709 }, shell: 0xd0102e, edge: 0x3a0510, flame: BLOOD, dark: false, heart: 0 };
const VEIN: StageLook = { ...KAGUNE, core: lin(2.2, .13, .25), main: lin(1.4, .045, .11) };
const KAKUJA: StageLook = { core: lin(2.9, .5, .7), main: lin(1.7, .1, .2), rim: lin(.55, .03, .08), light: lin(1, .14, .2), element: { spike: 0xff9bb0, rim: 0xc20a26, light: 0xd0102e, ink: 0x120709 }, shell: 0xc20a26, edge: 0x120709, flame: ABYSS, dark: true, heart: 0,
  sphere: { body: lin(.03, .004, .008), core: lin(.55, .03, .07), rimA: lin(2.6, .22, .3), rimB: lin(1.5, .06, .12), spin: 1.3 } };
const HEAVY = KANEKI_MOVES.heavy, SPECIAL = KANEKI_MOVES.special, ULT = KANEKI_MOVES.ultimate;
const FIRST = ULT.contacts[0], LAST = ULT.contacts[ULT.contacts.length - 1];
const REAP = .26, LANCE = .34;
const CUT = 0, PIERCE = 1, STRIKE = 2;
type Confirm = { actor: string; target: string; seq: number; final: boolean; floor: number };
type Mark = { kind: number; actor: string; born: number; life: number; size: number; seed: number; at: THREE.Vector3; dir: THREE.Vector3; floor: number; live: boolean };

export class KanekiRinkaku {
  private readonly stage: MoveStage;
  private confirms: Confirm[] = Array.from({ length: KANEKI_RINKAKU_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0 }));
  private marks: Mark[] = Array.from({ length: KANEKI_RINKAKU_LIMITS.marks }, () => ({ kind: 0, actor: '', born: -1e9, life: 0, size: 1, seed: 0, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), floor: 0, live: false }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private confirmCursor = 0; private markCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  private root = new THREE.Vector3(); private via = new THREE.Vector3(); private tip = new THREE.Vector3(); private strike = new THREE.Vector3();
  constructor(scene: THREE.Scene, kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) { this.stage = MoveStage.for(scene, kit); }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) { for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = ''; }
  private mark(kind: number, actor: string, at: THREE.Vector3, dir: THREE.Vector3, floor: number, born: number, life: number, size: number) {
    const m = this.marks[this.markCursor++ % this.marks.length];
    m.kind = kind; m.actor = actor; m.at.copy(at); m.dir.copy(dir); m.floor = floor; m.born = born; m.life = life; m.size = size; m.seed = (Math.abs(at.x * 13.1 + at.z * 7.7 + born * 3.3)) % 53; m.live = true;
  }
  private marked(actor: string, kind: number) { for (const m of this.marks) if (m.live && m.kind === kind && m.actor === actor) return true; return false; }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isKanekiRinkaku(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTime[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), victim = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    let floor = blowFloor(actor, victim, Infinity);
    if (e.kind === 'confirm') {
      if (e.slot === 'ultimate' && !e.branch && e.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], { actor: e.actorId, target: e.targetId, seq, final: false, floor: Number.isFinite(floor) ? floor : 0 });
      return;
    }
    if (!victim && !e.endpoint) return;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === ULT.contacts.length - 1, point = this.p, st = this.stage, t = e.serverTime;
    if (victim) bodyCentre(victim, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    if (!Number.isFinite(floor)) floor = point.y - 1.05;
    let confirmed = false;
    if (final) for (const c of this.confirms) if (c.actor === e.actorId && c.seq === seq) { c.final = true; floor = c.floor; confirmed = true; }
    if (final && !confirmed) return;
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') { st.burst(point, KAGUNE, .45, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      this.mark(CUT, e.actorId, point, dir, floor, t, .34, 1.5 * big);
      st.burst(point, KAGUNE, .95 * big, t, { dir, floor });
      st.shock(ground, KAGUNE, 4 * big, t, .4);
      st.scar(ground, KAKUJA, 1.7 * big, t + .05, 1.3);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, KAGUNE, 2, t, { floor }); st.shock(ground, KAGUNE, 4.5, t, .45); st.scar(ground, KAKUJA, 3.2, t, 1.8); return; }
      const big = e.branch ? .7 : 1;
      this.mark(PIERCE, e.actorId, point, dir, floor, t, .55, big);
      st.burst(point, KAGUNE, 2 * big, t, { dir, floor });
      st.erupt(ground, UP, KAKUJA, .7 * big, 4.2 * big, t + .05, .75);
      st.shock(ground, KAGUNE, 5.5 * big, t, .45);
      st.scar(ground, KAKUJA, 3.2 * big, t + .05, 1.9);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      st.burst(point, KAGUNE, e.contactIndex ? 1.25 + .2 * e.contactIndex : 1, t, { dir, floor });
      if (e.contactIndex) { this.mark(CUT, e.actorId, point, dir, floor, t, .4, 1.6 + .3 * e.contactIndex); st.shock(ground, KAGUNE, 3.5 + e.contactIndex, t, .45); }
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.42, point);
    this.mark(STRIKE, e.actorId, point, dir, floor, t, .6, 1);
    st.burst(point, KAGUNE, 2.6, t, { dir, floor });
    st.shatter(this.a.copy(ground).setY(floor + .06), UP, VEIN, 7, t + .03, 1.3);
    st.shock(ground, KAGUNE, 9, t, .6);
    st.erupt(ground, UP, KAKUJA, 1.15, 9, t + .06, .8);
    for (let i = 0; i < 3; i++) {
      const ang = i * 2.094 + .5;
      this.a.set(ground.x + Math.cos(ang) * 2.9, floor, ground.z + Math.sin(ang) * 2.9); this.b.set(Math.cos(ang) * .32, 1, Math.sin(ang) * .32).normalize();
      st.erupt(this.a, this.b, KAGUNE, .42, 5.2, t + .2 + i * .05, .55);
    }
    st.scar(ground, KAKUJA, 5.5, t + .1, 2.2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isKanekiRinkaku(s.fighter) || !s.alive) continue;
      if (s.action === 'awaken') { this.awakening(f); continue; }
      if (s.whiffedAt !== undefined || (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate')) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.1, feet = f.group.position, strike = f.strikePoint(this.strike);
      const heading = this.face(f), side = this.side;
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        st.glow(strike, .3, KAGUNE.main, .6 * k); st.glow(strike, .11, KAGUNE.core, .8 * k);
        st.tongue(this.p.copy(strike).addScaledVector(heading, -.28), this.a.copy(heading).multiplyScalar(-1).setY(.4).normalize(), .3, .4 + .5 * k, KAGUNE, k, seed);
        st.light(this.p.copy(strike).addScaledVector(heading, .4), 2.2, KAGUNE, .25 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
        if (elapsed < contact) {
          const k = clamp(elapsed / contact);
          st.charge(strike, KAGUNE, .2, k, seed);
          st.tongue(this.p.copy(strike).setY(strike.y + .15), UP, .3, .5 + .5 * k, KAGUNE, k, seed);
        } else if (elapsed < contact + REAP) {
          const u = (elapsed - contact) / REAP, cut = clamp(u / .35), fade = 1 - u * u;
          this.p.copy(feet).setY(feet.y + 1.05);
          sweep(st, this.p, heading, side, 2.5, -1.35, -1.35 + 2.7 * cut, .34, VEIN, 1.5 * fade, 12);
          sweep(st, this.p, heading, side, 2.05, -1.2, -1.2 + 2.4 * cut, .2, KAGUNE, fade, 10);
          st.light(this.a.copy(this.p).addScaledVector(heading, 2), 5, KAGUNE, .5 * fade);
        }
      } else if (s.action === 'special' && !s.branch) {
        const release = SPECIAL.contacts[0];
        if (elapsed < release) {
          const k = clamp(elapsed / release);
          st.pool(this.p.copy(feet), 2.2 + 1.2 * k, KAKUJA, k, seed);
          this.tails(f, k, 1, time, seed, this.a.copy(feet).addScaledVector(heading, .5).setY(feet.y + 2.75));
          st.charge(this.a, KAGUNE, .34, k, seed);
        } else if (elapsed < release + LANCE && !this.marked(s.id, PIERCE)) {
          const u = (elapsed - release) / LANCE;
          this.tails(f, 1, 1 - u, time, seed, this.a.copy(feet).addScaledVector(heading, 3.3).setY(feet.y + 1.1), clamp(u / .16));
        }
      } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < FIRST + .12) {
        const k = clamp(elapsed / FIRST);
        st.charge(strike, KAGUNE, .28, k, seed);
        st.tongue(this.p.copy(strike).addScaledVector(heading, -.3), this.a.copy(heading).multiplyScalar(-1).setY(.4).normalize(), .32, .5 + .6 * k, KAGUNE, k, seed);
      }
    }
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > ULT.duration) { c.actor = ''; continue; }
      if (!c.final && elapsed < LAST) this.gather(actor, victim, c, elapsed, time);
    }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born;
      if (age >= m.life) { m.live = false; continue; }
      if (age >= 0) this.drawMark(m, age, time, fighters.get(m.actor));
    }
    st.close();
  }

  private face(f: Fighter) {
    const yaw = f.state.yaw ?? f.group.rotation.y;
    this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
  }

  private tails(f: Fighter, k: number, fade: number, time: number, seed: number, to: THREE.Vector3, spread = 0) {
    const st = this.stage, feet = f.group.position, heading = this.heading, side = this.side;
    for (let i = 0; i < 4; i++) {
      const out = i < 2 ? -1 : 1, high = i % 2, sway = Math.sin(time * 6 + i * 1.9 + seed) * .12 * (1 - spread);
      this.root.copy(feet).addScaledVector(side, out * .16).addScaledVector(heading, -.22).setY(feet.y + 1 + high * .12);
      this.via.copy(feet).addScaledVector(side, out * (1.5 + high * .5 + sway)).addScaledVector(heading, .1 + spread * 1.2).setY(feet.y + 1.9 + high * .9);
      this.tip.copy(to).addScaledVector(side, out * (1 - spread) * (.55 + high * .5)).addScaledVector(UP, (1 - spread) * (high * .5 - .25) + spread * (high * .34 - .17)).addScaledVector(side, out * spread * .16);
      limb(st, this.root, this.via, this.tip, .15, VEIN, k, fade, 9, .28, this.c);
      st.glow(this.c, .2 + .16 * spread, KAGUNE.core, .9 * fade * k);
    }
    st.light(this.p.copy(to).setY(to.y + .2), 4.5 + 2 * spread, KAGUNE, .45 * fade * k);
  }

  private gather(actor: Fighter, victim: Fighter | undefined, c: Confirm, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - FIRST) / (LAST - FIRST)), seed = c.seq * 2.7, feet = this.ground.copy(actor.group.position).setY(c.floor), heading = this.face(actor);
    st.pool(feet, 3 + 3.4 * g, KAKUJA, Math.min(1, .3 + g * 1.2), seed);
    st.ring(feet, 2.5 + .5 * g, 1.1 + 1.3 * g, KAKUJA, .6 + .4 * g, seed, 8);
    st.light(this.p.copy(feet).setY(feet.y + 1.2), 6 + 2.5 * g, KAGUNE, .28 + .32 * g);
    const reach = victim ? Math.min(4.5, Math.max(1.6, Math.hypot(victim.group.position.x - feet.x, victim.group.position.z - feet.z))) : 2.4;
    this.root.copy(feet).addScaledVector(heading, -.25).setY(feet.y + 1.05);
    this.via.copy(feet).addScaledVector(heading, -1.5).addScaledVector(this.side, -1.1).setY(feet.y + 3.4 + 2.6 * g);
    this.tip.copy(feet).addScaledVector(heading, reach * (.25 + .6 * g)).setY(feet.y + 2.5 + 1.6 * g + .25 * Math.sin(time * 2.3));
    this.centipede(this.root, this.via, this.tip, clamp(.15 + g * 1.9), 1, time, seed);
    st.charge(this.tip, KAGUNE, .26 + .2 * g, Math.max(.35, g), seed);
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }

  private centipede(root: THREE.Vector3, via: THREE.Vector3, head: THREE.Vector3, k: number, fade: number, time: number, seed: number, girth = .34) {
    if (k <= .03 || fade <= .02) return;
    const st = this.stage, a = this.a.copy(root), b = this.b, along = this.c, leg = this.d, n = st.n(16, 9);
    for (let i = 1; i <= n; i++) {
      const s = i / n, u = k * s, v = 1 - u, sway = Math.sin(u * 8 - time * 4.5 + seed) * .34 * s * (1 - s * .45);
      b.set(v * v * root.x + 2 * u * v * via.x + u * u * head.x, v * v * root.y + 2 * u * v * via.y + u * u * head.y, v * v * root.z + 2 * u * v * via.z + u * u * head.z).addScaledVector(this.side, sway);
      along.subVectors(b, a); const len = along.length(); if (len < .01) continue;
      along.divideScalar(len);
      const w = girth * (.55 + .45 * Math.sin(Math.PI * Math.min(1, s * 1.15)));
      st.tongue(this.p.copy(a).lerp(b, .5), along, w * 2.5, len * 2.2, KAKUJA, (.5 + .45 * fade) * fade, seed + i);
      st.streak(a, b, w * .42, VEIN.main, .95 * fade); st.streak(a, b, w * .15, VEIN.core, fade);
      leg.copy(this.side).addScaledVector(along, -this.side.dot(along)); if (leg.lengthSq() < .01) leg.set(along.z, 0, -along.x); leg.normalize();
      const walk = .5 + .3 * Math.sin(time * 13 + i * 1.7);
      for (let j = -1; j <= 1; j += 2) st.streak(b, this.p.copy(b).addScaledVector(leg, j * w * 2.3).addScaledVector(along, -w * (1.2 + walk * j)), w * .14, VEIN.core, .95 * fade);
      a.copy(b);
    }
    st.glow(a, girth * 2, KAGUNE.main, .75 * fade); st.glow(a, girth * 1.1, KAGUNE.core, .9 * fade, STAR, .22, Math.floor(time * 24));
    for (let j = -1; j <= 1; j += 2) st.streak(a, this.p.copy(a).addScaledVector(along, girth * 2.2).addScaledVector(leg, j * girth * 1.3), girth * .22, VEIN.core, 1.2 * fade);
  }

  private drawMark(m: Mark, age: number, time: number, actor: Fighter | undefined) {
    const st = this.stage, u = age / m.life, fade = (1 - u) * (1 - u);
    if (m.kind === CUT) {
      const reach = m.size * clamp(age / .05), across = this.a.set(m.dir.z, 0, -m.dir.x);
      for (let j = -1; j <= 1; j += 2) {
        const tilt = j * (.62 + .2 * Math.sin(m.seed + j));
        this.b.copy(across).multiplyScalar(Math.cos(tilt)).addScaledVector(UP, Math.sin(tilt));
        this.c.copy(m.at).addScaledVector(this.b, -reach); this.d.copy(m.at).addScaledVector(this.b, reach);
        st.streak(this.c, this.d, .2 * (.4 + .6 * fade), VEIN.main, 1.2 * fade); st.streak(this.c, this.d, .07 * (.4 + .6 * fade), KAGUNE.core, 1.5 * fade);
      }
      st.light(m.at, 3 + m.size, KAGUNE, .4 * fade);
      return;
    }
    if (m.kind === PIERCE) {
      if (actor?.state.alive && age < LANCE) { this.face(actor); this.tails(actor, 1, 1 - age / LANCE, time, m.seed, m.at, 1); }
      const through = clamp(age / .07), right = this.a.set(m.dir.z, 0, -m.dir.x);
      for (let i = 0; i < 4; i++) {
        const out = i < 2 ? -1 : 1, high = i % 2;
        this.b.copy(m.dir).addScaledVector(right, out * (.3 + high * .25)).addScaledVector(UP, .12 + high * .5).normalize();
        this.c.copy(m.at).addScaledVector(this.b, .25); this.d.copy(m.at).addScaledVector(this.b, .25 + (1.5 + high * .7) * m.size * through);
        st.streak(this.c, this.d, .13 * (.5 + .5 * fade), VEIN.main, 1.3 * fade); st.streak(this.c, this.d, .045, KAGUNE.core, 1.3 * fade);
        st.glow(this.d, .22, KAGUNE.core, .8 * fade);
      }
      return;
    }
    const fall = clamp(age / .09), right = this.side.set(m.dir.z, 0, -m.dir.x);
    this.root.copy(m.at).addScaledVector(m.dir, -3.4).addScaledVector(right, -.8).setY(m.floor + 5.4);
    this.via.copy(m.at).addScaledVector(m.dir, -.6).setY(m.floor + 6.4);
    this.tip.set(m.at.x, m.floor + .15, m.at.z);
    this.centipede(this.root, this.via, this.tip, fall, 1 - u * u, time, m.seed, .42);
  }

  private awakening(f: Fighter) {
    const st = this.stage, s = f.state;
    if (s.actionTime <= .43 || s.actionTime >= .94) return;
    const u = (s.actionTime - .43) / .51, alpha = Math.sin(u * Math.PI);
    st.disc(this.p.copy(f.group.position), .5 + u * 2.2, KAGUNE.main, alpha * .8, WAVE, .96);
    const head = f.drawnJoint?.('Head');
    if (head) { head.getWorldPosition(this.p); st.glow(this.p, .16, KAGUNE.core, alpha * .8, STAR, .2, 1); }
  }
  reset() {
    for (const c of this.confirms) c.actor = ''; for (const m of this.marks) m.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.confirmCursor = this.markCursor = 0; this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.stage.release(); }
}
