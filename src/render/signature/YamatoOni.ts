import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { YAMATO_MOVES } from '../../game/fighters/yamato';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { BURN, MoveStage, SHEEN, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const isYamatoOni = (id: string | undefined) => id === 'yamato';
export const YAMATO_ONI_ASSETS: readonly string[] = Object.freeze([]);
export const YAMATO_ONI_LIMITS = Object.freeze({ bolts: 256, crescents: 48, rings: 32, impacts: 24, confirms: 8 });
export const YAMATO_ONI_BEATS = Object.freeze({ ignition: .55, release: .66, final: 3.12 });
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const INK = new THREE.Color(0x200b20), RED = new THREE.Color(1.9, .16, .5), WHITE = new THREE.Color(2.3, 2.1, 1.95), VIOLET = new THREE.Color(1.5, 1.1, 2.2);
export const ONI: StageLook = stageLook(0xffffff, 0xb48cf5, 0x2a1050, { heart: .5 });
const DEEP = new THREE.Color(.5, .2, 1.1);
const FLOOR: StageLook = { ...ONI, main: DEEP, light: new THREE.Color(.5, .3, .85) };
const HEAVY = YAMATO_MOVES.heavy, SPECIAL = YAMATO_MOVES.special, ULT = YAMATO_MOVES.ultimate, FINAL = ULT.contacts.length - 1;
type Strike = { live: boolean; born: number; life: number; seed: number; size: number; at: THREE.Vector3 };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
function narikaburaBlade() {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [], segments = 48;
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, arc = -.56 * Math.PI + u * 1.12 * Math.PI;
    const swell = Math.pow(Math.max(0, Math.sin(u * Math.PI)), .85);
    const width = .19 * swell * (.83 + .17 * Math.sin(u * Math.PI * 3 + .3));
    const outside = .92 + .09 * Math.sin(u * Math.PI) + .018 * Math.sin(u * Math.PI * 5) * swell;
    for (let side = 0; side < 2; side++) {
      const radius = outside - side * width;
      positions.push(Math.cos(arc) * radius, Math.sin(arc) * radius, 0); uv.push(u, side);
    }
    if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
const kanaboPoints = new WeakMap<Fighter, { bone: THREE.Object3D; local: THREE.Vector3 }>();
export function yamatoKanaboPoint(fighter: Fighter, out: THREE.Vector3): THREE.Vector3 {
  let held = kanaboPoints.get(fighter);
  if (!held) {
    const bone = fighter.model?.getObjectByName('r_weapon_joint_060');
    const mesh = fighter.model?.getObjectByName('weapon_yamato_right_hand') as THREE.SkinnedMesh | undefined;
    if (!bone || !mesh?.isSkinnedMesh) return out.copy(fighter.handR);
    const inverse = new THREE.Matrix4().copy(bone.matrixWorld).invert(), point = new THREE.Vector3(), local = new THREE.Vector3();
    let longest = -1;
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      const length = point.lengthSq(); if (length > longest) { longest = length; local.copy(point); }
    }
    held = { bone, local }; kanaboPoints.set(fighter, held);
  }
  return out.copy(held.local).applyMatrix4(held.bone.matrixWorld);
}
function kanaboGrip(fighter: Fighter, out: THREE.Vector3) {
  const bone = kanaboPoints.get(fighter)?.bone;
  return bone ? bone.getWorldPosition(out) : out.copy(fighter.handR);
}

class OniBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D(); private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, private capacity: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('oniTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: `Yamato-${name}`, transparent: true, depthWrite: false, forceSinglePass: true, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: 'attribute vec4 oniTint;varying vec4 vTint;varying vec2 vUv;void main(){vTint=oniTint;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
      fragmentShader: name === 'shockwaves'
        ? 'varying vec4 vTint;varying vec2 vUv;void main(){float arc=max(0.,sin(vUv.x*3.14159265));float alpha=vTint.a*pow(arc,.22)*mix(1.,.55,vUv.y);if(alpha<.005)discard;float light=.66+.34*arc;gl_FragColor=vec4(vTint.rgb*light,alpha);}'
        : 'varying vec4 vTint;void main(){if(vTint.a<.005)discard;gl_FragColor=vTint;}' });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `yamato-oni-${name}`; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.count = 0; scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, tint: THREE.Color, alpha: number) {
    if (this.count >= this.capacity || alpha <= .005 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, tint.r, tint.g, tint.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Confirm = { actor: string; target: string; seq: number; final: boolean; floor: number; endpoint: THREE.Vector3 };
type Impact = { actor: string; born: number; grade: number; seed: number; point: THREE.Vector3; floor: number };
export class YamatoOni {
  private readonly stage: MoveStage;
  private strikes: Strike[] = Array.from({ length: 10 }, () => ({ live: false, born: 0, life: .25, seed: 0, size: 1, at: new THREE.Vector3() }));
  private strikeCursor = 0; private blow = new THREE.Vector3(); private ground = new THREE.Vector3(); private grip = new THREE.Vector3();
  private bolts: OniBatch; private crescents: OniBatch; private rings: OniBatch; private batches: OniBatch[];
  private confirms: Confirm[] = Array.from({ length: YAMATO_ONI_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, final: false, floor: 0, endpoint: new THREE.Vector3() }));
  private impacts: Impact[] = Array.from({ length: YAMATO_ONI_LIMITS.impacts }, () => ({ actor: '', born: -1e9, grade: 0, seed: 0, point: new THREE.Vector3(), floor: 0 }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private impactCursor = 0; private confirmCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private tip = new THREE.Vector3();
  private start = new THREE.Vector3(); private end = new THREE.Vector3(); private direction = new THREE.Vector3();
  private forward = new THREE.Vector3(); private centre = new THREE.Vector3();
  private q = new THREE.Quaternion(); private face = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.bolts = new OniBatch(scene, 'haki', new THREE.CylinderGeometry(.55, 1, 1, 4, 1), YAMATO_ONI_LIMITS.bolts);
    this.crescents = new OniBatch(scene, 'shockwaves', narikaburaBlade(), YAMATO_ONI_LIMITS.crescents);
    this.rings = new OniBatch(scene, 'impact-fronts', new THREE.RingGeometry(.95, 1, 36), YAMATO_ONI_LIMITS.rings);
    this.batches = [this.bolts, this.crescents, this.rings];
  }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  private cancel(id: string, victim = false) {
    for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.final) c.actor = '';
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isYamatoOni(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = event.id; this.seenTime[index] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined, seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId) Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], {
        actor: event.actorId, target: event.targetId, seq, final: false, floor: blowFloor(actor, victim, 0) });
      return;
    }
    if (!victim && !event.endpoint) return;
    const final = event.slot === 'ultimate' && !event.branch && event.contactIndex === 2;
    const hit = this.impacts[this.impactCursor++ % this.impacts.length];
    Object.assign(hit, { actor: event.actorId, born: event.serverTime, seed: event.id, grade: final ? 3 : event.slot === 'heavy' || event.slot === 'special' ? 2 : 1,
      floor: blowFloor(actor, victim, 0) });
    if (event.endpoint) hit.point.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
    else if (victim) bodyCentre(victim, hit.point);
    let confirmed = false;
    if (final) {
      for (const c of this.confirms) if (c.actor === event.actorId && c.seq === seq) { c.final = true; c.endpoint.copy(hit.point); hit.floor = c.floor; confirmed = true; }
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.45, hit.point);
    }
    const st = this.stage, t = event.serverTime, point = hit.point, floor = hit.floor, dir = this.blow, big = actor?.state.awakened ? 1.15 : 1;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (event.slot === 'light') { st.burst(point, ONI, .42, t, { dir, floor, clean: true }); return; }
    if (event.slot === 'heavy') {
      const k = (event.branch ? .8 : 1) * big;
      st.burst(point, ONI, .85 * k, t, { dir, floor });
      st.shatter(this.a.copy(ground).setY(floor + .05), UP, ONI, 2.8 * k, t, .45);
      this.strike(ground, t, .9 * k, .22);
      st.shock(ground, ONI, 4.6 * k, t, .42);
      return;
    }
    if (event.slot === 'special') {
      if (event.branch === 'airSpecial') { st.burst(point, ONI, 2, t, { floor }); st.shock(ground, ONI, 4.5, t, .45); st.scar(ground, FLOOR, 2.4, t + .05, 1.8); return; }
      const k = (event.branch ? .7 : 1) * big;
      st.burst(point, ONI, 1.9 * k, t, { dir, floor });
      st.shatter(point, dir, ONI, 3 * k, t, .55);
      st.shock(ground, ONI, 5 * k, t, .45);
      st.scar(ground, FLOOR, 2.3 * k, t + .05, 2);
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    if (!final) { st.burst(point, ONI, event.contactIndex ? 1.25 : .95, t, { dir, floor }); if (event.contactIndex) { this.strike(ground, t, 1.1, .24); st.shock(ground, ONI, 5, t, .5); } return; }
    if (!confirmed) return;
    this.strike(ground, t, 2.2, .4);
    st.erupt(ground, UP, ONI, 1, 11, t, .5);
    st.shatter(point, dir, ONI, 7, t, .7);
    st.dome(point, ONI, 4.6, t, .45);
    st.burst(point, ONI, 2.2, t, { dir, floor });
    st.shock(ground, ONI, 10, t, .6);
    st.scar(ground, FLOOR, 3, t + .1, 2);
  }
  private strike(at: THREE.Vector3, born: number, size: number, life: number) { const k = this.strikes[this.strikeCursor++ % this.strikes.length]; k.live = true; k.born = born; k.life = life; k.size = size; k.seed = Math.abs(at.x * 17.3 + at.z * 9.1 + born * 7.7) % 97; k.at.copy(at); }
  private fork(fromX: number, fromY: number, fromZ: number, to: THREE.Vector3, seed: number, width: number, intensity: number, segments: number, jitter: number) {
    const st = this.stage; let x = fromX, y = fromY, z = fromZ;
    for (let i = 1; i <= segments; i++) {
      const u = i / segments, j = i === segments ? 0 : Math.sin(u * Math.PI) * jitter, nx = fromX + (to.x - fromX) * u + Math.sin(seed * 1.3 + i * 4.7) * j, ny = fromY + (to.y - fromY) * u + Math.cos(seed * .7 + i * 3.8) * j * .4, nz = fromZ + (to.z - fromZ) * u + Math.sin(seed * .9 + i * 6.1) * j;
      st.streak(this.start.set(x, y, z), this.end.set(nx, ny, nz), width, ONI.main, intensity, .5); x = nx; y = ny; z = nz;
    }
  }
  private bolt(a: THREE.Vector3, b: THREE.Vector3, width: number, alpha: number, seed: number, count: number) {
    this.start.copy(a);
    for (let i = 1; i <= count; i++) {
      this.end.copy(a).lerp(b, i / count);
      if (i !== count) { this.end.x += Math.sin(seed + i * 7.7) * .12; this.end.y += Math.cos(seed + i * 4.1) * .10; this.end.z += Math.sin(seed - i * 5.9) * .10; }
      this.direction.subVectors(this.end, this.start); const length = this.direction.length();
      if (length > .001) {
        this.q.setFromUnitVectors(UP, this.direction.multiplyScalar(1 / length)); this.p.copy(this.start).lerp(this.end, .5);
        this.bolts.add(this.p, this.q, width * 2.8, length, width * 2.8, RED, alpha * .7);
        this.bolts.add(this.p, this.q, width * 1.7, length, width * 1.7, INK, alpha);
        this.bolts.add(this.p, this.q, width * .45, length, width * .45, WHITE, alpha * .85);
      }
      this.start.copy(this.end);
    }
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    for (const batch of this.batches) batch.begin();
    const detail = this.kit.budget >= .65, phase = Math.floor(time * 14);
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isYamatoOni(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration; yamatoKanaboPoint(f, this.tip);
      this.swing(f, elapsed, time);
      if (s.action === 'awaken') {
        const strength = clamp(elapsed / .55) * clamp((.9 - elapsed) / .12);
        kanaboGrip(f, this.a); this.bolt(this.a, this.tip, .023, strength, phase, detail ? 6 : 3);
        if (elapsed > .55) {
          bodyCentre(f, this.centre); const count = detail ? 5 : 3;
          for (let i = 0; i < count; i++) {
            const theta = i * TAU / count, radius = .65 + (elapsed - .55) * 2;
            this.a.copy(this.centre); this.a.y += .2; this.b.copy(this.a); this.b.x += Math.sin(theta) * radius; this.b.y += .4 + .2 * Math.sin(i * 2); this.b.z += Math.cos(theta) * radius;
            this.bolt(this.a, this.b, .019, strength, phase + i, detail ? 4 : 2);
          }
        }
        continue;
      }
      if (!['light', 'heavy', 'special', 'ultimate'].includes(s.action) || s.whiffedAt !== undefined) continue;
      if (s.action === 'ultimate' && elapsed > .6 && s.confirmedAt === undefined) continue;
      const strength = Math.sin(clamp(s.actionTime) * Math.PI) * (s.awakened || s.action === 'ultimate' ? .9 : .55);
      kanaboGrip(f, this.a); this.bolt(this.a, this.tip, .013 + (s.action === 'heavy' ? .006 : 0), strength, phase, detail ? 5 : 3);
    }
    for (const flight of flights.values()) {
      if (!isYamatoOni(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      this.forward.copy(flight.heading).normalize(); this.face.setFromUnitVectors(FRONT, this.forward);
      const big = flight.awakened ? 1.75 : 1.55;
      this.p.copy(flight.position); this.crescents.add(this.p, this.face, .84 * big, 1.34 * big, 1, INK, .94);
      this.p.addScaledVector(this.forward, .009); this.crescents.add(this.p, this.face, .815 * big, 1.30 * big, 1, VIOLET, .88);
      this.p.addScaledVector(this.forward, .009); this.crescents.add(this.p, this.face, .79 * big, 1.255 * big, 1, WHITE, .93);
      const floor = (flight.actorId ? fighters.get(flight.actorId)?.group.position.y : undefined) ?? flight.position.y - 1.2, roll = Math.floor(time * 30);
      st.glow(flight.position, 1.3 * big, ONI.main, .4); st.glow(this.p.copy(flight.position).addScaledVector(this.forward, .7), .45, ONI.core, .8, STAR, .2, roll);
      for (let i = 0; i < 2; i++) { this.p.copy(flight.position).addScaledVector(this.forward, -2.2 - i * 1.3); this.fork(flight.position.x, flight.position.y + (i ? .5 : -.4), flight.position.z, this.p, roll + i * 9, .05, 1.2 - i * .4, 5, .4); }
      st.light(this.p.copy(flight.position).setY(flight.position.y + .2), 6.2, ONI, .9);
      st.light(this.p.copy(flight.position).addScaledVector(this.forward, -3).setY(floor + .6), 4.5, ONI, .45);
      st.disc(this.p.set(flight.position.x, floor, flight.position.z), 2.3, DEEP, .6, SHEEN, 1, flight.since);
      const seams = detail ? 8 : 4;
      for (let i = 0; i < seams; i++) {
        const angleA = -.5 * Math.PI + i / seams * Math.PI, angleB = -.5 * Math.PI + (i + 1) / seams * Math.PI;
        this.a.set(Math.cos(angleA) * .735, Math.sin(angleA) * 1.22, .035).applyQuaternion(this.face).add(flight.position);
        this.b.set(Math.cos(angleB) * .735, Math.sin(angleB) * 1.22, .035).applyQuaternion(this.face).add(flight.position);
        this.bolt(this.a, this.b, .0045, .8 * Math.sin((i + .5) / seams * Math.PI), phase + i, 2);
      }
    }
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const actor = fighters.get(c.actor), victim = fighters.get(c.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !c.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== c.seq || s.whiffedAt !== undefined) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > 3.6) { c.actor = ''; continue; }
      if (!c.final && elapsed < ULT.contacts[FINAL]) this.gather(actor, c, elapsed, time);
      if (elapsed < 2.35) continue;
      yamatoKanaboPoint(actor, this.tip); const charge = clamp((elapsed - 2.35) / .65), fade = clamp((3.6 - elapsed) / .3);
      if (!c.final) {
        kanaboGrip(actor, this.a); this.bolt(this.a, this.tip, .023 + charge * .02, charge * fade, phase, detail ? 7 : 4);
      } else {
        this.a.copy(this.tip); this.b.copy(c.endpoint); this.bolt(this.a, this.b, .038, fade, phase, detail ? 7 : 4);
        this.p.set(c.endpoint.x, c.floor + .035, c.endpoint.z); const radius = .7 + Math.max(0, elapsed - 3.12) * 5;
        this.rings.add(this.p, this.flat, radius, radius, 1, WHITE, fade * .75);
      }
    }
    for (const hit of this.impacts) {
      if (!hit.actor) continue;
      const age = time - hit.born, life = hit.grade === 3 ? .48 : .25;
      if (age >= life) { hit.actor = ''; continue; } if (age < 0) continue;
      const fade = 1 - age / life, count = detail ? hit.grade * 3 : hit.grade * 2;
      for (let i = 0; i < count; i++) {
        const theta = i * 2.39996 + hit.seed, radius = (.3 + age * 6) * (hit.grade === 3 ? 1.25 : .65);
        this.a.copy(hit.point); this.b.copy(hit.point); this.b.x += Math.sin(theta) * radius; this.b.y += Math.cos(theta) * radius; this.b.z += Math.sin(theta * 1.7) * radius * .6;
        this.bolt(this.a, this.b, .017 * fade, fade, hit.seed + i, detail ? 3 : 2);
      }
    }
    for (const k of this.strikes) {
      if (!k.live) continue; const age = time - k.born; if (age >= k.life) { k.live = false; continue; } if (age < 0) continue;
      const fade = 1 - age / k.life, roll = k.seed + Math.floor(age * 30), top = k.at.y + 9 * k.size;
      this.fork(k.at.x + Math.sin(roll) * 1.2, top, k.at.z + Math.cos(roll * 1.3) * 1.2, k.at, roll, .09 * k.size, 1.5 * fade, 7, .7 * k.size);
      this.fork(k.at.x + Math.sin(roll * 1.7) * 2, top, k.at.z + Math.cos(roll * .6) * 2, k.at, roll + 11, .05 * k.size, 1.1 * fade, 6, 1 * k.size);
      st.glow(this.p.copy(k.at).setY(k.at.y + .5), 1.1 * k.size, ONI.core, .9 * fade, STAR, .2, roll);
      st.light(this.p.copy(k.at).setY(k.at.y + 1), 4 + 2.5 * k.size, ONI, .6 * fade);
    }
    for (const batch of this.batches) batch.end();
    st.close();
  }
  private swing(f: Fighter, elapsed: number, time: number) {
    const s = f.state, st = this.stage;
    if (s.whiffedAt !== undefined || s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate') return;
    const seed = (s.actionSeq ?? 0) * 6.1, big = s.awakened ? 1.15 : 1, tip = this.tip, grip = kanaboGrip(f, this.grip), roll = seed + Math.floor(time * 24);
    if (s.action === 'light') {
      const k = Math.sin(clamp(s.actionTime) * Math.PI);
      st.streak(grip, tip, .11, ONI.main, .45 * k); st.streak(grip, tip, .035, ONI.core, 1.2 * k, .5);
      st.glow(tip, .3, ONI.main, .5 * k); st.light(tip, 2.2, ONI, .22 * k);
    } else if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
      if (elapsed < contact) { const k = clamp(elapsed / contact); st.charge(tip, ONI, .23 * big, k, seed); this.fork(grip.x, grip.y, grip.z, tip, roll, .05, 1.1 * k, 4, .12); }
      else if (elapsed < contact + .2) { const flare = 1 - (elapsed - contact) / .2; this.p.copy(tip); this.p.y = f.group.position.y + .05; this.fork(tip.x, tip.y + .2, tip.z, this.p, roll, .07, 1.5 * flare, 4, .3); st.glow(tip, .55, ONI.core, .7 * flare, STAR, .2, roll); st.light(tip, 3, ONI, .42 * flare); }
    } else if (s.action === 'special' && !s.branch) {
      const release = SPECIAL.contacts[0];
      if (elapsed < release) { const k = clamp(elapsed / release); st.charge(tip, ONI, .36 * big, k, seed); this.fork(grip.x, grip.y, grip.z, tip, roll, .05, 1.2 * k, 4, .14); st.disc(this.p.copy(f.group.position), 1.6 + 1.6 * k, DEEP, .5 * k, SHEEN, 1, seed); }
    } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .1) { const k = clamp(elapsed / ULT.contacts[0]); st.charge(tip, ONI, .27, k, seed); this.fork(grip.x, grip.y, grip.z, tip, roll, .05, 1.1 * k, 4, .12); }
  }
  private gather(actor: Fighter, c: Confirm, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - ULT.contacts[0]) / (ULT.contacts[FINAL] - ULT.contacts[0])), seed = c.seq * 3.9;
    const feet = this.ground.copy(actor.group.position).setY(c.floor), tip = yamatoKanaboPoint(actor, this.tip), grip = kanaboGrip(actor, this.grip), roll = seed + Math.floor(time * 24);
    st.dim(.3 + .4 * g, c.actor, c.target);
    st.disc(feet, (2.8 + 4.2 * g) * (.6 + .4 * g), DEEP, .75, BURN, .3 + .7 * g, seed);
    st.disc(feet, 3.2 + 4 * g, DEEP, .16 + .12 * g, SHEEN, 1, seed);
    for (let i = 0, n = st.n(4, 2); i < n; i++) {
      const clock = time * (4 + 4 * g) + i * .37, cycle = Math.floor(clock), phase = clock - cycle; if (phase > .55) continue;
      const h = cycle * 7.31 + i * 3.7 + seed, ang = h * 2.399963, r = 1.9 + 1.6 * Math.abs(Math.sin(h * 1.9)), fade = 1 - phase / .55;
      this.p.set(feet.x + Math.cos(ang) * r, c.floor + 1.2 + 2.2 * g * Math.abs(Math.sin(h * .7)) + .6, feet.z + Math.sin(ang) * r);
      this.fork(feet.x + Math.cos(ang) * r * 1.1, c.floor + .03, feet.z + Math.sin(ang) * r * 1.1, this.p, h + Math.floor(phase * 6), .045 + .03 * g, 1.4 * fade, 5, .35);
      st.glow(this.a.set(feet.x + Math.cos(ang) * r * 1.1, c.floor + .1, feet.z + Math.sin(ang) * r * 1.1), .35, ONI.core, .7 * fade, STAR, .2, cycle);
    }
    this.fork(grip.x, grip.y, grip.z, tip, roll, .05 + .04 * g, 1.2 + .5 * g, 5, .14 + .1 * g);
    st.charge(tip, ONI, .26 + .26 * g, Math.max(.4, g), seed);
    if (g > .8) st.speed(.5 * (g - .8) / .2, c.actor, c.target);
  }
  reset() {
    for (const c of this.confirms) c.actor = ''; for (const hit of this.impacts) hit.actor = '';
    for (const k of this.strikes) k.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.impactCursor = this.confirmCursor = 0;
    for (const batch of this.batches) { batch.begin(); batch.end(); }
    this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.reset(); for (const batch of this.batches) batch.dispose(); this.stage.release(); }
}
