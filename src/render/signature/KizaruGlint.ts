import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { KIZARU_MOVES } from '../../game/fighters/kizaru';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, SHEEN, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const KIZARU_GLINT_ASSETS: readonly string[] = Object.freeze([]);
export const KIZARU_GLINT_LIMITS = Object.freeze({ rays: 192, beads: 64, rings: 48, releases: 12, impacts: 24, confirms: 8 });
export const KIZARU_GLINT_BEATS = Object.freeze({ entry: .36, laser: .4515, firstVolley: 1.12, final: 2.74, end: 3.09 });
export const isKizaruGlint = (id: string | undefined) => id === 'kizaru';
const fingerTips = new WeakMap<Fighter, { mesh: THREE.SkinnedMesh; vertex: number }>();
export function kizaruFingerPoint(fighter: Fighter, out: THREE.Vector3): THREE.Vector3 {
  let tip = fingerTips.get(fighter);
  if (!tip) {
    const mesh = fighter.model?.getObjectByName('Kizaru_Hand_Right_Point') as THREE.SkinnedMesh | undefined;
    const hand = fighter.joints?.get('RightHand');
    if (!mesh?.isSkinnedMesh || !hand) return out.copy(fighter.handR);
    const wrist = hand.getWorldPosition(new THREE.Vector3()), sample = new THREE.Vector3();
    let vertex = 0, farthest = -1;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, sample).applyMatrix4(mesh.matrixWorld);
      const distance = sample.distanceToSquared(wrist);
      if (distance > farthest) { farthest = distance; vertex = i; }
    }
    tip = { mesh, vertex }; fingerTips.set(fighter, tip);
  }
  return tip.mesh.getVertexPosition(tip.vertex, out).applyMatrix4(tip.mesh.matrixWorld);
}
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1);
const GOLD = new THREE.Color(2.1, 1.5, .34), WHITE = new THREE.Color(2.3, 2.25, 2), INK = new THREE.Color(0x5c3519);
export const PIKA: StageLook = stageLook(0xfffce6, 0xf9bf32, 0x5c3519);
const HEAVY = KIZARU_MOVES.heavy, ULT = KIZARU_MOVES.ultimate, B = KIZARU_GLINT_BEATS;
const BEAM = .46, FINAL = ULT.contacts.length - 1;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const manual = (action: string) => action === 'light' || action === 'heavy' || action === 'special' || action === 'ultimate';
class GlintBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D();
  private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, private capacity: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('glintTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: `Kizaru-${name}`, transparent: true, depthWrite: false, forceSinglePass: true, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: `attribute vec4 glintTint;varying vec4 vTint;void main(){vTint=glintTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec4 vTint;void main(){if(vTint.a<.005)discard;gl_FragColor=vTint;}` });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `kizaru-glint-${name}`;
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1; scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, tint: THREE.Color, alpha: number) {
    if (this.count >= this.capacity || alpha <= .005 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, tint.r, tint.g, tint.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}type Release = { actor: string; seq: number; born: number; a: THREE.Vector3; b: THREE.Vector3 };
type Impact = { actor: string; seq: number; born: number; grade: number; seed: number; point: THREE.Vector3 };
type Confirm = { actor: string; target: string; seq: number; final: boolean; finalAt: number; floor: number; endpoint: THREE.Vector3 };
export class KizaruGlint {
  private readonly stage: MoveStage;
  private rays: GlintBatch; private beads: GlintBatch; private rings: GlintBatch;
  private releases: Release[] = Array.from({ length: KIZARU_GLINT_LIMITS.releases }, () => ({ actor: '', seq: -1, born: 0, a: new THREE.Vector3(), b: new THREE.Vector3() }));
  private impacts: Impact[] = Array.from({ length: KIZARU_GLINT_LIMITS.impacts }, () => ({ actor: '', seq: -1, born: 0, grade: 0, seed: 0, point: new THREE.Vector3() }));
  private confirms: Confirm[] = Array.from({ length: KIZARU_GLINT_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, final: false, finalAt: 0, floor: 0, endpoint: new THREE.Vector3() }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private eventCursor = 0; private releaseCursor = 0; private impactCursor = 0; private confirmCursor = 0; private disposed = false;
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private p = new THREE.Vector3(); private d = new THREE.Vector3();
  private forward = new THREE.Vector3(); private right = new THREE.Vector3(); private centre = new THREE.Vector3(); private target = new THREE.Vector3();
  private blow = new THREE.Vector3(); private ground = new THREE.Vector3(); private strike = new THREE.Vector3(); private mid = new THREE.Vector3();
  private q = new THREE.Quaternion(); private face = new THREE.Quaternion(); private identity = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.rays = new GlintBatch(scene, 'rays', new THREE.CylinderGeometry(1, 1, 1, 6, 1), KIZARU_GLINT_LIMITS.rays);
    this.beads = new GlintBatch(scene, 'beads', new THREE.IcosahedronGeometry(1, 1), KIZARU_GLINT_LIMITS.beads);
    this.rings = new GlintBatch(scene, 'rings', new THREE.RingGeometry(.94, 1, 32), KIZARU_GLINT_LIMITS.rings);
  }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isKizaruGlint(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'release' && event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const n = this.eventCursor++ % this.seen.length; this.seen[n] = event.id; this.seenTime[n] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined;
    const seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], { actor: event.actorId, target: event.targetId, seq, final: false, floor: blowFloor(actor, victim, 0) });
      return;
    }
    if (event.kind === 'release') {
      if (event.slot !== 'special' || event.branch || !event.endpoint || !actor) return;
      const r = this.releases[this.releaseCursor++ % this.releases.length]; Object.assign(r, { actor: event.actorId, seq, born: event.serverTime });
      kizaruFingerPoint(actor, r.a); r.b.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); return;
    }
    if (!victim && !event.endpoint) return;
    const final = event.slot === 'ultimate' && !event.branch && event.contactIndex === FINAL;
    const hit = this.impacts[this.impactCursor++ % this.impacts.length]; Object.assign(hit, { actor: event.actorId, seq, born: event.serverTime, grade: final ? 3 : event.slot === 'light' ? 1 : 2, seed: event.id });
    if (event.endpoint) hit.point.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); else bodyCentre(victim!, hit.point);
    let confirmed = false;
    if (final) {
      for (const c of this.confirms) if (c.actor === event.actorId && c.seq === seq) { c.final = true; c.finalAt = event.serverTime; c.endpoint.copy(hit.point); confirmed = true; }
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.45, hit.point);
    }
    const st = this.stage, t = event.serverTime, point = hit.point, floor = blowFloor(actor, victim, point.y - 1), dir = this.blow;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z), big = actor?.state.awakened ? 1.15 : 1;
    if (event.slot === 'light') { st.burst(point, PIKA, .42, t, { dir, floor, clean: true }); return; }
    if (event.slot === 'heavy') {
      const k = (event.branch ? .8 : 1) * big;
      st.burst(point, PIKA, .85 * k, t, { dir, floor });
      st.erupt(ground, UP, PIKA, .3 * k, 6.5 * k, t, .34);
      st.shock(ground, PIKA, 4.2 * k, t, .4);
      return;
    }
    if (event.slot === 'special') {
      if (event.branch === 'airSpecial') { st.burst(point, PIKA, 2, t, { floor }); st.erupt(ground, UP, PIKA, .5, 7, t, .45); st.shock(ground, PIKA, 4.5, t, .45); st.scar(ground, PIKA, 2.4, t + .05, 1.8); return; }
      const k = (event.branch ? .7 : 1) * big;
      st.burst(point, PIKA, 1.6 * k, t, { dir, floor });
      st.dome(point, PIKA, 2.4 * k, t, .4);
      st.shock(ground, PIKA, 4.8 * k, t, .45);
      st.scar(ground, PIKA, 2.1 * k, t + .05, 1.9);
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    if (!final) { st.burst(point, PIKA, event.contactIndex ? 1.25 : 1, t, { dir, floor }); if (event.contactIndex) st.shock(ground, PIKA, 4.6, t, .45); return; }
    if (!confirmed) return;
    st.burst(point, PIKA, 2.2, t, { dir, floor });
    st.dome(point, PIKA, 3.4, t, .4);
    st.erupt(ground, UP, PIKA, .7, 10, t, .55);
    st.shock(ground, PIKA, 9, t, .6);
    st.scar(ground, PIKA, 3, t + .1, 2);
  }
  private cancel(id: string, target = false) {
    for (const r of this.releases) if (r.actor === id) r.actor = '';
    for (const i of this.impacts) if (i.actor === id) i.actor = '';
    for (const c of this.confirms) if (c.actor === id || target && c.target === id && !c.final) c.actor = '';
  }
  private ray(a: THREE.Vector3, b: THREE.Vector3, width: number, alpha: number) {
    this.d.subVectors(b, a); const length = this.d.length(); if (length < .001 || alpha <= .005) return;
    this.q.setFromUnitVectors(UP, this.d.multiplyScalar(1 / length)); this.p.copy(a).lerp(b, .5);
    this.rays.add(this.p, this.q, width * 1.65, length, width * 1.65, INK, alpha * .75);
    this.rays.add(this.p, this.q, width, length, width, GOLD, alpha);
    this.rays.add(this.p, this.q, width * .42, length, width * .42, WHITE, alpha);
  }
  private star(p: THREE.Vector3, size: number, alpha: number) {
    this.centre.copy(p);
    for (let i = 0; i < 3; i++) {
      this.a.copy(this.centre); this.b.copy(this.centre); const radius = i ? size * .58 : size;
      this.a.setComponent(i, this.a.getComponent(i) - radius); this.b.setComponent(i, this.b.getComponent(i) + radius);
      this.ray(this.a, this.b, .012 * Math.max(.5, size), alpha);
    }
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return; this.rays.begin(); this.beads.begin(); this.rings.begin(); const detail = this.kit.budget >= .65;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isKizaruGlint(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration, yaw = f.group.rotation.y, seed = (s.actionSeq ?? 0) * 5.3;
      this.forward.set(Math.sin(yaw), 0, Math.cos(yaw)); this.right.set(Math.cos(yaw), 0, -Math.sin(yaw)); this.face.setFromUnitVectors(FRONT, this.forward);
      if (s.action === 'awaken') {
        const alpha = Math.min(clamp(elapsed / .12), clamp((.88 - elapsed) / .20));
        bodyCentre(f, this.target); this.target.y += .67; this.target.addScaledVector(this.forward, .08);
        this.star(this.target, elapsed < KIZARU_GLINT_BEATS.entry ? .12 : .25, alpha);
        if (elapsed >= KIZARU_GLINT_BEATS.entry) {
          const radius = .1 + (elapsed - KIZARU_GLINT_BEATS.entry) * 2.7;
          this.rings.add(this.target, this.face, radius, radius, 1, GOLD, alpha * .8);
          this.target.copy(f.group.position); this.target.y += .025; this.rings.add(this.target, this.flat, radius * 1.3, radius * 1.3, 1, GOLD, alpha * .45);
        }
      } else if (s.action === 'special' && !s.branch && s.whiffedAt === undefined && elapsed < KIZARU_GLINT_BEATS.laser) {
        kizaruFingerPoint(f, this.target); this.star(this.target, .035 + .11 * clamp(elapsed / KIZARU_GLINT_BEATS.laser), clamp(elapsed / .12));
        const k = clamp(elapsed / B.laser);
        st.charge(this.target, PIKA, .3, k, seed); st.glow(this.target, .3 + .3 * k, PIKA.core, .5 * k, STAR, .2, Math.floor(time * 24));
        st.disc(this.p.copy(f.group.position), 1.5 + 1.5 * k, PIKA.main, .5 * k, SHEEN, 1, seed);
      } else if (s.awakened && (s.action === 'light' || s.action === 'heavy') && s.whiffedAt === undefined) {
        f.chargePosition(this.target); this.star(this.target, .10, Math.sin(clamp(s.actionTime) * Math.PI) * .7);
      }
      if (s.whiffedAt !== undefined || s.action !== 'light' && s.action !== 'heavy' && s.action !== 'ultimate') continue;
      const strike = typeof f.strikePoint === 'function' ? f.strikePoint(this.strike) : this.strike.copy(f.handR);
      if (s.action === 'light') {
        const k = Math.sin(clamp(s.actionTime) * Math.PI);
        st.glow(strike, .26, PIKA.main, .6 * k); st.glow(strike, .36, PIKA.core, .55 * k, STAR, .2, Math.floor(time * 24)); st.light(strike, 2.2, PIKA, .22 * k);
      } else if (s.action === 'heavy') {
        const contact = s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
        if (elapsed < contact) st.charge(strike, PIKA, .22, clamp(elapsed / contact), seed);
        else if (elapsed < contact + .2) {
          const flare = 1 - (elapsed - contact) / .2;
          this.a.copy(strike); this.a.y += 1.5 * flare + .3; this.b.copy(strike); this.b.y = Math.min(strike.y, f.group.position.y + .1);
          st.streak(this.a, this.b, .13, PIKA.main, .6 * flare); st.streak(this.a, this.b, .045, PIKA.core, 1.6 * flare);
          st.glow(strike, .5, PIKA.core, .7 * flare, STAR, .2, seed); st.light(strike, 3, PIKA, .42 * flare);
        }
      } else if (!s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .1) st.charge(strike, PIKA, .26, clamp(elapsed / ULT.contacts[0]), seed);
    }
    for (const r of this.releases) {
      if (!r.actor) continue; const s = fighters.get(r.actor)?.state, age = time - r.born;
      if (!s?.alive || (s.actionSeq ?? -1) !== r.seq || !manual(s.action) || age > BEAM) { r.actor = ''; continue; }
      if (age >= 0 && age <= .23) { this.ray(r.a, r.b, .035 * (1 - age / .28), 1 - age / .23); this.star(r.b, .10 + age * .7, 1 - age / .23); }
      if (age >= 0) { st.beam(r.a, r.b, .17, PIKA, clamp(age / BEAM), r.seq * 3 + 1, 1); st.glow(r.a, .5, PIKA.core, .8 * (1 - age / BEAM), STAR, .2, Math.floor(time * 30)); }
    }
    for (const c of this.confirms) {
      if (!c.actor) continue; const f = fighters.get(c.actor), victim = fighters.get(c.target), s = f?.state;
      if (!f || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || s.whiffedAt !== undefined || (s.actionSeq ?? -1) !== c.seq) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > KIZARU_GLINT_BEATS.end) { c.actor = ''; continue; }
      if (c.final) this.target.copy(c.endpoint); else bodyCentre(victim!, this.target);
      if (!c.final && elapsed < B.final) this.gather(f, c, elapsed, time);
      else if (c.final && time - c.finalAt < BEAM) { this.mid.copy(f.handL).lerp(f.handR, .5); st.beam(this.mid, c.endpoint, .26, PIKA, clamp((time - c.finalAt) / BEAM), c.seq * 3 + 2, 1); }
      if (elapsed < KIZARU_GLINT_BEATS.firstVolley) continue;
      const alpha = Math.min(clamp((elapsed - 1.12) / .10), clamp((3.09 - elapsed) / .22)), count = detail ? 12 : 6;
      if (elapsed < KIZARU_GLINT_BEATS.final) {
        for (let i = 0; i < count; i++) {
          const start = i % 2 ? f.handL : f.handR, progress = ((elapsed - 1.12) * 3 + i / count) % 1, theta = i * 2.39996;
          this.a.copy(start).lerp(this.target, progress); const spread = Math.sin(progress * Math.PI) * .42;
          this.a.x += Math.cos(theta) * spread; this.a.y += Math.sin(theta) * spread;
          this.b.copy(this.a).addScaledVector(this.d.subVectors(this.target, start).normalize(), -.10);
          this.ray(this.b, this.a, .017, alpha * .8);
          this.beads.add(this.a, this.identity, .055, .055, .055, GOLD, alpha); this.beads.add(this.a, this.identity, .027, .027, .027, WHITE, alpha);
        }
      } else {
        this.ray(f.handL, this.target, .072, alpha); this.ray(f.handR, this.target, .072, alpha); this.star(this.target, .48, alpha);
      }
    }
    for (const hit of this.impacts) {
      if (!hit.actor) continue; const s = fighters.get(hit.actor)?.state, age = time - hit.born, life = hit.grade === 3 ? .36 : .20;
      if (!s?.alive || (s.actionSeq ?? -1) !== hit.seq || !manual(s.action) || age > life) { hit.actor = ''; continue; }
      if (age < 0) continue; const alpha = 1 - age / life; this.star(hit.point, .10 * hit.grade + age * 1.1, alpha);
      this.face.setFromAxisAngle(UP, hit.seed); const scale = .08 + age * (hit.grade === 3 ? 4 : 2); this.rings.add(hit.point, this.face, scale, scale, 1, GOLD, alpha * .8);
    }
    this.rays.end(); this.beads.end(); this.rings.end();
    st.close();
  }
  private gather(f: Fighter, c: Confirm, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - ULT.contacts[0]) / (B.final - ULT.contacts[0])), seed = c.seq * 4.1, mid = this.mid.copy(f.handL).lerp(f.handR, .5);
    const yaw = f.group.rotation.y; this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    st.dim(.3 + .45 * g, c.actor, c.target);
    st.disc(this.p.copy(f.group.position).setY(c.floor), 2.8 + 3 * g, PIKA.main, .5 + .3 * g, SHEEN, 1, seed);
    st.charge(mid, PIKA, .28 + .26 * g, Math.max(.4, g), seed);
    const n = st.n(10, 6), radius = .65 + .55 * g, volley = elapsed >= B.firstVolley;
    for (let i = 0; i < n; i++) {
      const ang = i / n * Math.PI * 2 + time * 1.7, cos = Math.cos(ang), sin = Math.sin(ang);
      this.a.copy(mid).addScaledVector(this.right, cos * radius); this.a.y += sin * radius;
      st.glow(this.a, .12 + .05 * g, PIKA.core, .7 + .3 * g);
      this.b.copy(mid).addScaledVector(this.right, cos * (radius + .9 + 1.6 * g)); this.b.y += sin * (radius + .9 + 1.6 * g);
      this.d.copy(mid).addScaledVector(this.right, cos * (radius + .2)); this.d.y += sin * (radius + .2);
      st.streak(this.d, this.b, .035, PIKA.main, .35 + .35 * g);
      if (!volley) continue;
      const progress = ((elapsed - B.firstVolley) * 3.3 + i / n) % 1, spread = Math.sin(progress * Math.PI) * .5;
      this.b.copy(this.a).lerp(this.target, progress); this.b.x += Math.cos(i * 2.39996) * spread; this.b.y += Math.sin(i * 2.39996) * spread;
      this.d.subVectors(this.target, this.a).normalize(); this.a.copy(this.b).addScaledVector(this.d, -.75);
      st.streak(this.a, this.b, .13, PIKA.main, .5); st.streak(this.a, this.b, .045, PIKA.core, 1.5);
    }
    st.light(this.p.copy(mid), 4.5 + 2 * g, PIKA, .35 + .4 * g);
    if (volley) {
      const tick = Math.floor(time * 30), jx = Math.sin(tick * 12.9898) * .5, jy = Math.sin(tick * 78.233) * .6;
      this.a.copy(this.target); this.a.x += jx; this.a.y += jy; this.a.z += Math.sin(tick * 37.7) * .4;
      st.glow(this.a, .34, PIKA.core, .9, STAR, .2, tick); st.glow(this.a, .5, PIKA.main, .5);
      st.light(this.target, 4, PIKA, .5 + .2 * Math.sin(time * 40));
    }
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }
  reset() { for (const r of this.releases) r.actor = ''; for (const i of this.impacts) i.actor = ''; for (const c of this.confirms) c.actor = ''; this.seen.fill(-1); this.seenTime.fill(-1); for (const b of [this.rays, this.beads, this.rings]) { b.begin(); b.end(); } this.stage.reset(); }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.rays.dispose(); this.beads.dispose(); this.rings.dispose(); this.stage.release(); }
}
