import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { MINATO_MOVES } from '../../game/fighters/minato';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { SPHERES } from './EnergySphere';
import { SignaturePoolUpload } from './SignaturePoolUpload';
import { MoveStage, stageLook, SHEEN } from './MoveStage';
import { blowFloor } from './blowFloor';

export const isMinatoRaijin = (id: string | undefined) => id === 'minato';
export const MINATO_RAIJIN_LIMITS = Object.freeze({ arcs: 96, rings: 64, strokes: 320, marks: 24, grinds: 8, tracks: 8, confirms: 8 });
export const MINATO_TEMPEST = Object.freeze({ marks: 6, radius: 3.1, beat: .22 });
const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const FLASH = stageLook(0xfff4c2, 0xffc93c, 0xc47a12), RASEN = stageLook(0xe8fbff, 0x41b9ff, 0x1c58d8, { sphere: SPHERES.blue });
const GOLD = new THREE.Color(2.5, 1.5, .24), PALE = new THREE.Color(3, 2.7, 1.9), WHITE = new THREE.Color(2.5, 2.9, 3.1), CYAN = new THREE.Color(.5, 1.7, 3);
const clamp = (v: number) => Math.max(0, Math.min(1, v)), MANUAL = new Set(['light', 'heavy', 'special', 'ultimate']);
const HEAVY = MINATO_MOVES.heavy, SPECIAL = MINATO_MOVES.special, ULT = MINATO_MOVES.ultimate;
const MARKS_LINGER = .6;
const FLASH_LIFE = .45;
const palmBlow = (e: CombatEvent) => e.slot === 'ultimate' ? (e.contactIndex ?? 0) > 0 : e.slot === 'special' ? e.branch === 'airSpecial' : e.slot === 'heavy' ? !e.branch || e.branch === 'llh' : (e.chain ?? 0) >= 2;

class RaijinBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly tint: THREE.InstancedBufferAttribute; private readonly upload: SignaturePoolUpload; private readonly object = new THREE.Object3D(); count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, private readonly capacity: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('raijinTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: 'MinatoRaijin', transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute vec4 raijinTint;varying vec4 vTint;void main(){vTint=raijinTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec4 vTint;void main(){gl_FragColor=vec4(vTint.rgb*vTint.a,1.);}' });
    material.forceSinglePass = true;
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = 'minato-' + name; this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1;
    this.upload = new SignaturePoolUpload(this.mesh, this.tint); scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, c: THREE.Color, gain: number) {
    if (this.count >= this.capacity || gain < .004 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, c.r, c.g, c.b, Math.min(1.5, gain));
  }
  end() { this.upload.end(this.count); }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Mark = { at: THREE.Vector3; born: number; life: number; size: number; flash: number; live: boolean };
type Grind = { at: THREE.Vector3; born: number; life: number; size: number; live: boolean };
type Track = { actor: string; seq: number; origin: THREE.Vector3; aim: THREE.Vector3 };
type Confirm = { actor: string; target: string; seq: number; final: boolean; floor: number; centre: THREE.Vector3; turn: number };

export class MinatoRaijin {
  private readonly stage: MoveStage;
  private readonly arcs: RaijinBatch; private readonly rings: RaijinBatch; private readonly strokes: RaijinBatch; private readonly batches: RaijinBatch[];
  private marks: Mark[] = Array.from({ length: MINATO_RAIJIN_LIMITS.marks }, () => ({ at: new THREE.Vector3(), born: 0, life: 0, size: 0, flash: 0, live: false }));
  private grinds: Grind[] = Array.from({ length: MINATO_RAIJIN_LIMITS.grinds }, () => ({ at: new THREE.Vector3(), born: 0, life: 0, size: 0, live: false }));
  private tracks: Track[] = Array.from({ length: MINATO_RAIJIN_LIMITS.tracks }, () => ({ actor: '', seq: -1, origin: new THREE.Vector3(), aim: new THREE.Vector3() }));
  private confirms: Confirm[] = Array.from({ length: MINATO_RAIJIN_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0, centre: new THREE.Vector3(), turn: 0 }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private markCursor = 0; private grindCursor = 0; private trackCursor = 0; private confirmCursor = 0; private seenCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private d = new THREE.Vector3(); private strike = new THREE.Vector3();
  private heading = new THREE.Vector3(); private dir = new THREE.Vector3(); private ground = new THREE.Vector3();
  private q = new THREE.Quaternion(); private q2 = new THREE.Quaternion(); private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.arcs = new RaijinBatch(scene, 'spiral-arcs', new THREE.TorusGeometry(1, .075, 5, 26, Math.PI * 1.5), MINATO_RAIJIN_LIMITS.arcs);
    this.rings = new RaijinBatch(scene, 'seal-rings', new THREE.RingGeometry(.9, 1, 48), MINATO_RAIJIN_LIMITS.rings);
    this.strokes = new RaijinBatch(scene, 'flash-strokes', new THREE.BoxGeometry(1, 1, 1), MINATO_RAIJIN_LIMITS.strokes);
    this.batches = [this.arcs, this.rings, this.strokes];
  }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (e.kind === 'eliminated' || e.kind === 'respawn') { this.cancel(e.actorId, true); return; }
    if (!isMinatoRaijin(e.fighter)) return;
    if (e.kind === 'whiff' || e.kind === 'rejected') { this.cancel(e.actorId); return; }
    if (e.kind !== 'hit' && e.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const actor = fighters?.get(e.actorId), target = e.targetId ? fighters?.get(e.targetId) : undefined, seq = e.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (e.kind === 'hit' && !target && !e.endpoint) return;
    const slot = this.seenCursor++ % this.seen.length; this.seen[slot] = e.id; this.seenTime[slot] = e.serverTime;
    const floor = blowFloor(actor, target, (e.endpoint ? e.endpoint.y - 1 : 0));
    if (e.kind === 'confirm') {
      if (e.slot !== 'ultimate' || e.branch || !target) return;
      const c = this.confirms[this.confirmCursor++ % this.confirms.length];
      c.actor = e.actorId; c.target = e.targetId!; c.seq = seq; c.final = false; c.floor = floor; c.centre.copy(target.group.position); c.turn = (actor?.state.yaw ?? 0) + .5;
      return;
    }
    const point = this.p, st = this.stage, t = e.serverTime, palm = palmBlow(e);
    if (target) bodyCentre(target, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    const dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.copy(FORWARD);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'light') {
      st.burst(point, palm ? RASEN : FLASH, palm ? .48 : .42, t, { dir, floor, clean: true });
      if (!palm) this.mark(ground, t, .5, .45);
      return;
    }
    if (e.slot === 'heavy') {
      if (!palm) { st.burst(point, FLASH, .9, t, { dir, floor }); this.mark(ground, t, 1.1, .8); return; }
      const big = e.branch ? .85 : 1;
      st.burst(point, RASEN, .9 * big, t, { dir, floor });
      this.grind(this.a.copy(point).addScaledVector(dir, -.25), t, .2, .34 * big);
      st.dome(point, RASEN, 2 * big, t, .4);
      st.shock(ground, RASEN, 4.2 * big, t, .45);
      st.scar(ground, RASEN, 1.2 * big, t + .05, 1.2);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, RASEN, 2.1, t, { floor }); this.grind(point, t, .4, .9); st.shock(ground, RASEN, 4.6, t, .45); st.scar(ground, RASEN, 2.3, t + .05, 2); return; }
      const big = e.branch ? .75 : 1, past = this.b.copy(ground).addScaledVector(dir, 1);
      st.burst(this.a.copy(point).addScaledVector(dir, .9), FLASH, 1.2 * big, t, { dir, floor });
      st.shock(past, FLASH, 4.6 * big, t, .5);
      st.scar(past, FLASH, 1.6 * big, t + .15, 2.4);
      this.mark(past, t, 2.7, 1.9 * big, 7 * big);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (e.contactIndex !== 2) {
      if (e.contactIndex) { st.burst(point, RASEN, 1.5, t, { dir, floor }); this.grind(point, t, .3, .6); st.shock(ground, RASEN, 4.6, t, .45); }
      else { st.burst(point, FLASH, 1.05, t, { dir, floor }); this.mark(ground, t, 3.4, 1.1); }
      return;
    }
    if (involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.52, point);
    st.burst(point, RASEN, 2.4, t, { dir, floor });
    this.grind(point, t, .45, 1);
    st.dome(point, RASEN, 4.6, t, .5);
    st.shock(ground, FLASH, 9, t, .6);
    let turn = (actor?.state.yaw ?? 0) + .5;
    for (const c of this.confirms) if (c.actor === e.actorId && c.seq === seq) { c.final = true; turn = c.turn; }
    for (let i = 0; i < 3; i++) { const ang = turn + i * TAU / 3; this.mark(this.a.set(ground.x + Math.sin(ang) * MINATO_TEMPEST.radius, floor, ground.z + Math.cos(ang) * MINATO_TEMPEST.radius), t + .05 + i * .05, .5, .62, 7); }
    st.scar(ground, RASEN, 3, t + .15, 2.2);
    this.mark(ground, t, 2.4, 2.3);
  }
  private mark(at: THREE.Vector3, born: number, life: number, size: number, flash = 0) { const m = this.marks[this.markCursor++ % this.marks.length]; m.at.copy(at); m.born = born; m.life = life; m.size = size; m.flash = flash; m.live = true; }
  private grind(at: THREE.Vector3, born: number, life: number, size: number) { const g = this.grinds[this.grindCursor++ % this.grinds.length]; g.at.copy(at); g.born = born; g.life = life; g.size = size; g.live = true; }
  private cancel(id: string, victim = false) {
    for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = '';
    for (const track of this.tracks) if (track.actor === id) track.actor = '';
  }

  private rasengan(at: THREE.Vector3, radius: number, fade: number, time: number, seed: number, spin = 1) {
    if (fade <= .02 || radius <= .02) return;
    const st = this.stage;
    st.ball(at, radius, RASEN, seed, fade);
    st.glow(at, radius * 2.1, RASEN.main, .36 * fade);
    for (let i = 0, n = st.n(this.kit.budget >= .65 ? 6 : 4, 3); i < n; i++) {
      this.q.setFromAxisAngle(UP, i * Math.PI / n + seed); this.q2.setFromAxisAngle(FORWARD, time * (9 + i * 1.3) * spin + i * 1.7); this.q.multiply(this.q2);
      const r = radius * (1.12 + .2 * (i % 3));
      this.arcs.add(at, this.q, r, r, r, i % 3 ? CYAN : WHITE, fade * .5);
    }
    st.light(this.b.copy(at).setY(at.y + .15), 1.4 + radius * 6, RASEN, (.2 + .4 * Math.min(1, radius / .45)) * fade);
  }
  private wind(at: THREE.Vector3, radius: number, k: number, time: number, seed: number) {
    const st = this.stage;
    for (let i = 0, n = st.n(7, 4); i < n; i++) {
      const phase = (time * 1.9 + i * .618) % 1, ang = i * 2.399963 + seed + phase * 2.4, r = radius * (1.3 + 4.5 * (1 - phase) * (1 - phase)), lift = Math.sin(i * 1.7 + seed) * .5, r2 = Math.max(radius, r - radius * 1.6);
      this.a.set(at.x + Math.cos(ang) * r, at.y + lift * r * .5, at.z + Math.sin(ang) * r); this.b.set(at.x + Math.cos(ang + .5) * r2, at.y + lift * r2 * .5, at.z + Math.sin(ang + .5) * r2);
      st.streak(this.a, this.b, radius * .16, RASEN.main, Math.sin(Math.PI * phase) * k * 1.1);
    }
  }
  private seal(at: THREE.Vector3, radius: number, gain: number, time: number, sheen = true) {
    if (gain <= .01 || radius <= .02) return;
    this.d.copy(at).setY(at.y + .05);
    this.rings.add(this.d, this.flat, radius, radius, 1, GOLD, gain); this.rings.add(this.d, this.flat, radius * .6, radius * .6, 1, GOLD, gain * .8);
    for (let i = 0; i < 8; i++) {
      const ang = i * Math.PI / 4 + time * .3;
      this.d.set(at.x + Math.sin(ang) * radius * .8, at.y + .05, at.z + Math.cos(ang) * radius * .8); this.q.setFromAxisAngle(UP, ang);
      this.strokes.add(this.d, this.q, radius * .07, .012, radius * .3, GOLD, gain);
    }
    this.q.setFromAxisAngle(UP, time * .3);
    for (let i = -1; i <= 1; i++) { this.d.set(at.x + Math.cos(time * .3) * i * radius * .16, at.y + .05, at.z - Math.sin(time * .3) * i * radius * .16); this.strokes.add(this.d, this.q, radius * .07, .012, radius * (i ? .56 : .84), PALE, gain); }
    if (sheen) this.stage.disc(at, radius * 1.7, FLASH.main, .5 * Math.min(1, gain), SHEEN, 1);
  }
  private kunai(tip: THREE.Vector3, along: THREE.Vector3, gain: number, size = 1) {
    this.q.setFromUnitVectors(UP, along);
    this.strokes.add(this.d.copy(tip).addScaledVector(along, -.2 * size), this.q, .05 * size, .4 * size, .016, PALE, gain);
    this.strokes.add(this.d.copy(tip).addScaledVector(along, -.2 * size), this.q, .17 * size, .05 * size, .016, PALE, gain);
    this.strokes.add(this.d.copy(tip).addScaledVector(along, -.5 * size), this.q, .035 * size, .22 * size, .03, GOLD, gain);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, _flights?: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time); for (const batch of this.batches) batch.begin();
    for (const f of fighters.values()) {
      const s = f.state; if (!isMinatoRaijin(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration, seed = (s.actionSeq ?? 0) * 6.1;
      if (s.action === 'awaken') { this.awakening(f, elapsed, time); continue; }
      if (!MANUAL.has(s.action) || s.whiffedAt !== undefined) { this.cancel(s.id); continue; }
      if (s.action === 'ultimate' && elapsed > .8 && s.confirmedAt === undefined) continue;
      const yaw = s.yaw ?? f.group.rotation.y, heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), swing = Math.sin(clamp(s.actionTime) * Math.PI), boost = s.awakened ? 1.15 : 1;
      const strike = f.strikePoint(this.strike), left = (f.shownBody ?? f).joints?.get('LeftHand'), palm = !!left && left.getWorldPosition(this.d).distanceToSquared(strike) < 1e-8;
      if (palm) {
        const wind = s.action === 'heavy' && !s.branch ? clamp(elapsed / HEAVY.contacts[0]) : s.action === 'ultimate' ? clamp((elapsed - ULT.contacts[1]) / (ULT.contacts[2] - ULT.contacts[1])) : 1;
        const radius = (s.action === 'heavy' ? .1 + .14 * wind : s.action === 'ultimate' ? .16 + .22 * wind : s.action === 'special' ? .28 : .13) * boost;
        if (wind > 0 && wind < 1) this.wind(strike, radius, wind, time, seed);
        this.rasengan(strike, radius, Math.min(1, swing * 4), time, seed);
        continue;
      }
      st.glow(strike, .12 * boost, FLASH.core, .9 * swing); st.glow(strike, .3 * boost, FLASH.main, .4 * swing);
      st.streak(this.p.copy(strike).addScaledVector(heading, -(.3 + .5 * swing)), strike, .035, FLASH.core, 1.3 * swing);
      st.light(strike, 1.9, FLASH, .2 * swing);
      if (s.action === 'special' && !s.branch) this.raijin(f, fighters, elapsed, heading, strike, time, seed);
      else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined) st.charge(strike, FLASH, .3, clamp(elapsed / ULT.contacts[0]), seed);
    }
    for (const track of this.tracks) if (track.actor) { const s = fighters.get(track.actor)?.state; if (!s?.alive || s.action !== 'special' || (s.actionSeq ?? -1) !== track.seq) track.actor = ''; }
    for (const m of this.marks) {
      if (!m.live) continue;
      const age = time - m.born; if (age >= m.life) { m.live = false; continue; } if (age < 0) continue;
      const u = age / m.life;
      this.seal(m.at, m.size * (.55 + .45 * Math.min(1, age / .12)), Math.min(1, age / .05) * (u < .5 ? 1 : 1 - (u - .5) / .5) * 1.2, time, m.size >= 1);
      if (m.flash > 0 && age < FLASH_LIFE) {
        const k = 1 - age / FLASH_LIFE, top = this.a.copy(m.at).setY(m.at.y + m.flash * Math.min(1, age / .05 + .3));
        st.streak(m.at, top, .5 * k + .1, FLASH.main, .7 * k); st.streak(m.at, top, .16 * k + .03, FLASH.core, 1.7 * k);
        st.glow(this.b.copy(m.at).setY(m.at.y + .5), 1.1, FLASH.main, .55 * k);
      }
    }
    for (const g of this.grinds) {
      if (!g.live) continue;
      const age = time - g.born; if (age >= g.life) { g.live = false; continue; } if (age < 0) continue;
      const u = age / g.life;
      this.rasengan(g.at, g.size * (.55 + .45 * Math.min(1, age / .07)) * (1 - .25 * u), 1 - u * u, time, g.born, 1.6);
    }
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed >= ULT.duration) { c.actor = ''; continue; }
      if (elapsed < ULT.contacts[2] + MARKS_LINGER) this.gather(c, elapsed, time);
    }
    for (const batch of this.batches) batch.end();
    st.close();
  }

  private raijin(f: Fighter, fighters: ReadonlyMap<string, Fighter>, elapsed: number, heading: THREE.Vector3, strike: THREE.Vector3, time: number, seed: number) {
    const st = this.stage, s = f.state, feet = f.group.position, seq = s.actionSeq ?? -1, release = SPECIAL.contacts[0];
    let track: Track | undefined, free: Track | undefined;
    for (const t of this.tracks) { if (t.actor === s.id) track = t; else if (!t.actor) free ??= t; }
    if (!track || track.seq !== seq) {
      track ??= free ?? this.tracks[this.trackCursor++ % this.tracks.length];
      track.actor = s.id; track.seq = seq; track.origin.copy(feet);
      let best = 13 * 13; track.aim.copy(feet).addScaledVector(heading, 5);
      for (const other of fighters.values()) {
        if (other === f || !other.state.alive) continue;
        this.d.subVectors(other.group.position, feet).setY(0); const far = this.d.lengthSq();
        if (far < best && this.d.dot(heading) > 0) { best = far; track.aim.copy(other.group.position).addScaledVector(this.d.normalize(), -.55); }
      }
    }
    const k = clamp(elapsed / release), after = elapsed - release, fade = after < 0 ? 1 : clamp(1 - after / .3);
    if (fade <= 0) return;
    if (after < 0) { st.charge(strike, FLASH, .3, k, seed); this.seal(track.origin, .3 + .75 * k, .9, time); }
    const fly = clamp((elapsed - .05) / .17);
    if (fly > 0 && fly < 1) {
      this.a.copy(strike).lerp(this.b.copy(track.aim).setY(track.aim.y + .12), fly); this.d.subVectors(this.b, strike).normalize(); this.dir.copy(this.d);
      this.kunai(this.a, this.dir, 1.3);
      st.streak(this.b.copy(this.a).addScaledVector(this.dir, -1.3), this.a, .05, FLASH.core, 1.4); st.glow(this.a, .22, FLASH.main, .8);
    } else if (fly >= 1) {
      this.kunai(this.a.copy(track.aim).setY(track.aim.y + .02), this.dir.set(-heading.x * .35, -1, -heading.z * .35).normalize(), 1.2 * fade);
      this.seal(track.aim, .7 * Math.min(1, (elapsed - .22) / .12 + .3), fade, time);
      st.glow(this.a.setY(track.aim.y + .3), .5, FLASH.main, .5 * fade);
    }
    this.d.subVectors(feet, track.origin).setY(0); const moved = this.d.length();
    if (moved > 14) { track.origin.copy(feet); return; }
    if (moved < .9) return;
    this.d.divideScalar(moved);
    const a = this.a.copy(track.origin).setY(track.origin.y + .14), b = this.b.copy(feet).addScaledVector(this.d, -.75).setY(feet.y + .14);
    st.streak(a, b, .36, FLASH.main, .55 * fade); st.streak(a, b, .1, FLASH.core, 1.6 * fade);
    if (after < 0) { a.y = track.origin.y + .1; st.streak(a, this.p.copy(a).setY(track.origin.y + 1.85), .16, FLASH.main, .7 * (1 - k)); }
    st.light(this.p.copy(track.origin).lerp(feet, .5).setY(feet.y + .3), 3 + moved * .6, FLASH, .6 * fade);
    if (after < 0) st.light(this.p.copy(feet).setY(feet.y + .4), 4, FLASH, .5);
    st.speed(.45 * fade, s.id);
  }

  private gather(c: Confirm, elapsed: number, time: number) {
    const st = this.stage, T = MINATO_TEMPEST, since = elapsed - ULT.contacts[0], g = clamp(since / (ULT.contacts[2] - ULT.contacts[0]));
    if (since < 0) return;
    const over = elapsed - ULT.contacts[2], hold = over <= 0 ? 1 : clamp(1 - over / MARKS_LINGER);
    if (over <= 0) st.dim(.28 + .42 * g, c.actor, c.target);
    const centre = this.ground.copy(c.centre).setY(c.floor);
    st.disc(centre, T.radius + 1.6, FLASH.main, (.35 + .45 * g) * hold, SHEEN, 1);
    for (let i = 0; i < T.marks; i++) {
      const born = i * .11; if (since < born) break;
      const ang = c.turn + i * TAU / T.marks, at = this.a.set(centre.x + Math.sin(ang) * T.radius, c.floor, centre.z + Math.cos(ang) * T.radius), grown = Math.min(1, (since - born) / .12);
      this.seal(at, .62 * (.5 + .5 * grown), (.75 + .25 * Math.sin(time * 9 + i)) * hold, time, false);
      this.kunai(this.p.copy(at).setY(c.floor + .02), this.dir.set(Math.sin(ang) * .3, -1, Math.cos(ang) * .3).normalize(), 1.2 * hold);
      st.glow(this.p.setY(c.floor + .28), .34, FLASH.main, .45 * grown * hold);
    }
    const beat = Math.floor(since / T.beat), u = since / T.beat - beat, from = (beat * 5) % T.marks, to = (from + 2) % T.marks;
    if (since < .5 || over > 0) return;
    const a0 = c.turn + from * TAU / T.marks, a1 = c.turn + to * TAU / T.marks, fade = u < .35 ? 1 : 1 - (u - .35) / .65;
    const a = this.a.set(centre.x + Math.sin(a0) * T.radius, c.floor + .16, centre.z + Math.cos(a0) * T.radius), b = this.b.set(centre.x + Math.sin(a1) * T.radius, c.floor + .16, centre.z + Math.cos(a1) * T.radius);
    const head = this.p.copy(a).lerp(b, Math.min(1, u / .35));
    st.streak(a, head, .34, FLASH.main, .6 * fade); st.streak(a, head, .1, FLASH.core, 1.7 * fade);
    st.glow(head, .5, FLASH.core, .8 * fade);
    if (u >= .3) { st.streak(b, this.d.copy(b).setY(c.floor + 1.9), .2, FLASH.main, .8 * fade); st.glow(this.d.setY(c.floor + 1), .9, FLASH.main, .4 * fade); }
    st.light(this.d.copy(a).lerp(b, .5).setY(c.floor + .4), 5.5, FLASH, (.45 + .25 * g) * fade);
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }

  private awakening(f: Fighter, elapsed: number, time: number) {
    const release = .522, fade = clamp((.9 - elapsed) / .18);
    this.seal(this.a.copy(f.group.position), .25 + clamp(elapsed / release) * .7, fade, time, false);
    if (elapsed >= release) { const r = .1 + (elapsed - release) * 4; this.rings.add(this.d.copy(f.group.position).setY(f.group.position.y + .8), this.flat, r, r, 1, GOLD, fade * .8); }
  }
  reset() {
    for (const m of this.marks) m.live = false; for (const g of this.grinds) g.live = false; for (const track of this.tracks) track.actor = ''; for (const c of this.confirms) c.actor = '';
    this.seen.fill(-1); this.seenTime.fill(-1); this.markCursor = this.grindCursor = this.trackCursor = this.confirmCursor = this.seenCursor = 0;
    for (const batch of this.batches) { batch.begin(); batch.end(); }
    this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; for (const batch of this.batches) batch.dispose(); this.stage.release(); }
}
