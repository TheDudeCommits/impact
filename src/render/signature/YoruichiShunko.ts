import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { YORUICHI_MOVES } from '../../game/fighters/yoruichi';
import { RING } from './GlowBatch';
import { MoveStage, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { CastBook, Strikes, arc, flare, jag, sheenAhead, type Gather } from './StageCraft';

export const YORUICHI_SHUNKO_ASSETS: readonly string[] = Object.freeze([]);
export const YORUICHI_SHUNKO_LIMITS = Object.freeze({ bolts: 384, rings: 96, impacts: 24, confirms: 8 });
export const YORUICHI_SHUNKO_BEATS = Object.freeze({ release: .486, special: .594, final: 2.34, end: 2.72 });
export const isYoruichiShunko = (id: string | undefined) => id === 'yoruichi';
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const VIOLET = new THREE.Color(0x9250df), WHITE = new THREE.Color(0xfff8ec), INK = new THREE.Color(0x34184f);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const attacking = (s: string) => s === 'light' || s === 'heavy' || s === 'special' || s === 'ultimate';
const SHUNKO = stageLook(0xffffff, 0xe2d6ff, 0x6a3bea, { heart: .5 });
const HEAVY = YORUICHI_MOVES.heavy, SPECIAL = YORUICHI_MOVES.special, ULT = YORUICHI_MOVES.ultimate;
class ShunkoBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D();
  private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, private capacity: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('shunkoTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: `Yoruichi-${name}`, transparent: true, depthWrite: false, forceSinglePass: true, side: THREE.DoubleSide, toneMapped: false,
      vertexShader: `attribute vec4 shunkoTint;varying vec4 vTint;void main(){vTint=shunkoTint;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec4 vTint;void main(){if(vTint.a<.005)discard;gl_FragColor=vTint;}` });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `yoruichi-shunko-${name}`;
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
}
type Confirm = { actor: string; target: string; seq: number; finalHit: boolean; endpoint: THREE.Vector3 };
type Impact = { actor: string; seq: number; born: number; grade: number; seed: number; point: THREE.Vector3; floor: number };
export class YoruichiShunko {
  private readonly stage: MoveStage; private readonly book = new CastBook('yoruichi', ULT.contacts.length); private readonly strikes = new Strikes(10, SHUNKO);
  private heading = new THREE.Vector3(); private side = new THREE.Vector3(); private c = new THREE.Vector3(); private m = new THREE.Vector3();
  private bolts: ShunkoBatch;
  private rings: ShunkoBatch;
  private confirms: Confirm[] = Array.from({ length: YORUICHI_SHUNKO_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, finalHit: false, endpoint: new THREE.Vector3() }));
  private impacts: Impact[] = Array.from({ length: YORUICHI_SHUNKO_LIMITS.impacts }, () => ({ actor: '', seq: -1, born: 0, grade: 0, seed: 0, point: new THREE.Vector3(), floor: 0 }));
  private seen = new Float64Array(128).fill(-1);
  private seenTime = new Float64Array(128).fill(-1);
  private cursor = 0; private impactCursor = 0; private confirmCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3();
  private start = new THREE.Vector3(); private end = new THREE.Vector3(); private direction = new THREE.Vector3();
  private right = new THREE.Vector3(); private forward = new THREE.Vector3(); private centre = new THREE.Vector3();
  private q = new THREE.Quaternion(); private face = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.bolts = new ShunkoBatch(scene, 'bolts', new THREE.CylinderGeometry(1, .7, 1, 4, 1), YORUICHI_SHUNKO_LIMITS.bolts);
    this.rings = new ShunkoBatch(scene, 'rings', new THREE.RingGeometry(.91, 1, 32), YORUICHI_SHUNKO_LIMITS.rings);
  }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    this.staged(event, fighters);
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isYoruichiShunko(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = event.id; this.seenTime[index] = event.serverTime;
    const actor = fighters?.get(event.actorId), target = event.targetId ? fighters?.get(event.targetId) : undefined;
    const seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId)
        Object.assign(this.confirms[this.confirmCursor++ % this.confirms.length], { actor: event.actorId, target: event.targetId, seq, finalHit: false });
      return;
    }
    if (!target && !event.endpoint) return;
    const final = event.slot === 'ultimate' && !event.branch && event.contactIndex === 3;
    const impact = this.impacts[this.impactCursor++ % this.impacts.length];
    Object.assign(impact, { actor: event.actorId, seq, born: event.serverTime, seed: event.id, grade: final ? 3 : event.slot === 'special' || event.slot === 'heavy' ? 2 : 1, floor: target ? blowFloor(actor, target, 0) : 0 });
    if (target) bodyCentre(target, impact.point); else impact.point.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    if (final) {
      for (const c of this.confirms) if (c.actor === event.actorId && c.seq === seq && c.target === event.targetId) { c.finalHit = true; c.endpoint.copy(impact.point); }
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.42, impact.point);
    }
  }
  private staged(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const blow = this.book.take(e, fighters); if (!blow) return;
    const st = this.stage, { point, ground, dir, side, floor, t } = blow;
    if (e.slot === 'light') { st.burst(point, SHUNKO, .3, t, { dir, floor, clean: true }); st.shatter(point, dir, SHUNKO, .65, t, .18); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      st.burst(point, SHUNKO, .7 * big, t, { dir, floor }); this.strikes.add(this.c.copy(ground).addScaledVector(dir, .9), 6 * big, .07, SHUNKO, t, .2);
      st.shatter(this.c.copy(ground).setY(floor + .06), UP, SHUNKO, 2.1 * big, t, .5); st.shock(ground, SHUNKO, 3.4 * big, t, .4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, SHUNKO, 2.1, t, { floor }); this.strikes.add(ground, 7, .11, SHUNKO, t); st.shock(ground, SHUNKO, 3.6, t, .45); st.scar(ground, SHUNKO, 2.2, t + .05, 1.8); return; }
      const big = e.branch ? .75 : 1;
      st.burst(point, SHUNKO, 1.9 * big, t, { dir, floor }); st.shatter(point, dir, SHUNKO, 3 * big, t, .6); st.dome(point, SHUNKO, 3 * big, t, .4);
      for (let i = 0; i < 3; i++) this.strikes.add(this.c.copy(ground).addScaledVector(side, (i - 1) * .9).addScaledVector(dir, i === 1 ? 0 : .5), 6.5 * big, .1, SHUNKO, t + i * .07, .26, i === 0);
      st.shock(ground, SHUNKO, 4.6 * big, t, .45); st.scar(ground, SHUNKO, 2 * big, t + .05, 2);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!blow.final) {
      st.burst(point, SHUNKO, blow.index ? 1.5 : 1.2, t, { dir, floor }); st.shatter(point, dir, SHUNKO, blow.index ? 2 : 1.4, t, .35);
      if (blow.index) { this.strikes.add(ground, 6.5, .1, SHUNKO, t); st.shock(ground, SHUNKO, 4.2, t, .45); }
      return;
    }
    st.erupt(ground, UP, SHUNKO, .9, 13, t, .6);
    for (let i = 0; i < 4; i++) { const ang = i * 1.571 + .6; this.strikes.add(this.c.set(ground.x + Math.cos(ang) * 2.6, floor, ground.z + Math.sin(ang) * 2.6), 8, .12, SHUNKO, t + .04 + i * .05, .3, i === 0); }
    st.shatter(point, dir, SHUNKO, 5.5, t, .8);
    st.dome(point, SHUNKO, 3.8, t, .42);
    st.burst(point, SHUNKO, 1.9, t, { dir, floor });
    st.shock(ground, SHUNKO, 9, t, .6);
    st.scar(ground, SHUNKO, 3, t + .2, 2.1);
  }
  private cancel(id: string, victim = false) {
    for (const c of this.confirms) if (c.actor === id || victim && c.target === id && !c.finalHit) c.actor = '';
    for (const i of this.impacts) if (i.actor === id) i.actor = '';
  }
  private bolt(a: THREE.Vector3, b: THREE.Vector3, width: number, alpha: number, phase: number, segments = 5) {
    this.start.copy(a);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments; this.end.copy(a).lerp(b, t);
      if (i !== segments) { const wave = Math.sin(i * 12.17 + phase) * .09; this.end.x += wave; this.end.y += Math.cos(i * 7.91 + phase) * .065; this.end.z -= wave * .7; }
      this.direction.subVectors(this.end, this.start); const length = this.direction.length();
      if (length > .001) {
        this.direction.multiplyScalar(1 / length); this.q.setFromUnitVectors(UP, this.direction); this.p.copy(this.start).lerp(this.end, .5);
        this.bolts.add(this.p, this.q, width * 2.2, length, width * 2.2, VIOLET, alpha * .85);
        this.bolts.add(this.p, this.q, width, length, width, WHITE, alpha);
      }
      this.start.copy(this.end);
    }
  }
  private corona(f: Fighter, alpha: number, phase: number, detail: boolean) {
    const yaw = f.group.rotation.y; this.forward.set(Math.sin(yaw), 0, Math.cos(yaw)); this.right.set(Math.cos(yaw), 0, -Math.sin(yaw)); this.face.setFromUnitVectors(FRONT, this.forward);
    bodyCentre(f, this.centre); this.centre.addScaledVector(this.forward, -.25); this.centre.y += .30;
    const count = detail ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const theta = Math.PI * (.08 + .84 * i / (count - 1));
      this.a.copy(this.centre).addScaledVector(this.right, Math.cos(theta) * .68); this.a.y += Math.sin(theta) * .72;
      this.rings.add(this.a, this.face, .21, .21, 1, INK, alpha);
      this.rings.add(this.a, this.face, .18, .18, 1, WHITE, alpha);
      this.b.copy(this.centre).addScaledVector(this.right, Math.cos(theta) * .28); this.b.y += .12;
      this.bolt(this.a, this.b, .008, alpha * .85, phase + i, 3);
    }
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    this.bolts.begin(); this.rings.begin(); const detail = this.kit.budget >= .65, phase = Math.floor(time * 15), st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (!isYoruichiShunko(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration;
      if (attacking(s.action) && s.whiffedAt === undefined) this.pose(f, time, elapsed);
      if (s.action === 'awaken') {
        const alpha = clamp((.9 - elapsed) / .17);
        if (elapsed < YORUICHI_SHUNKO_BEATS.release) {
          this.bolt(f.handL, f.handR, .010, clamp(elapsed / .2), phase, detail ? 6 : 3);
        } else {
          this.corona(f, alpha, phase, detail);
          this.a.copy(f.group.position); this.a.y += .025;
          const radius = .4 + (elapsed - YORUICHI_SHUNKO_BEATS.release) * 5;
          this.rings.add(this.a, this.flat, radius, radius, 1, VIOLET, alpha * .7);
        }
      } else if (s.action === 'special' && !s.branch && s.whiffedAt === undefined) {
        const envelope = Math.sin(clamp(s.actionTime) * Math.PI);
        bodyCentre(f, this.a); this.a.y += .3; this.bolt(this.a, f.handR, .012, envelope, phase, detail ? 5 : 3);
        this.face.setFromAxisAngle(UP, time * 3); this.rings.add(f.handR, this.face, .11 + .05 * envelope, .11 + .05 * envelope, 1, WHITE, envelope);
      } else if (s.awakened && attacking(s.action) && s.whiffedAt === undefined) {
        const envelope = Math.sin(clamp(s.actionTime) * Math.PI) * .65;
        this.a.copy(f.handL); this.a.y += .18; this.bolt(this.a, f.handL, .007, envelope, phase, 2);
        this.a.copy(f.handR); this.a.y += .18; this.bolt(this.a, f.handR, .007, envelope, phase + 1, 2);
      }
    }
    for (const c of this.confirms) {
      if (!c.actor) continue;
      const f = fighters.get(c.actor), target = fighters.get(c.target), s = f?.state;
      if (!f || !s?.alive || !target?.state.alive && !c.finalHit || s.action !== 'ultimate' || s.branch || s.whiffedAt !== undefined || (s.actionSeq ?? -1) !== c.seq) { c.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > YORUICHI_SHUNKO_BEATS.end) { c.actor = ''; continue; }
      if (elapsed < 1.9) continue;
      const alpha = Math.min(clamp((elapsed - 1.9) / .2), clamp((YORUICHI_SHUNKO_BEATS.end - elapsed) / .18));
      this.corona(f, alpha, phase, detail);
      if (elapsed < YORUICHI_SHUNKO_BEATS.final) continue;
      if (c.finalHit && !target?.state.alive) this.b.copy(c.endpoint); else bodyCentre(target!, this.b);
      this.a.copy(f.handR); this.bolt(this.a, this.b, .026, alpha, phase, detail ? 8 : 4);
      this.a.copy(f.handL); this.bolt(this.a, this.b, .024, alpha, phase + 3, detail ? 8 : 4);
    }
    for (const impact of this.impacts) {
      if (!impact.actor) continue;
      const s = fighters.get(impact.actor)?.state, age = time - impact.born, life = impact.grade === 3 ? .42 : .22;
      if (!s?.alive || (s.actionSeq ?? -1) !== impact.seq || !attacking(s.action) || s.whiffedAt !== undefined || age >= life) { impact.actor = ''; continue; }
      if (age < 0) continue;
      const alpha = 1 - age / life, count = detail ? impact.grade * 3 : impact.grade + 1;
      for (let i = 0; i < count; i++) {
        const theta = impact.seed + i * 2.39996, radius = (.18 + age * 3) * (impact.grade === 3 ? 1.4 : 1);
        this.a.copy(impact.point); this.b.copy(impact.point); this.b.x += Math.cos(theta) * radius; this.b.z += Math.sin(theta) * radius; this.b.y += Math.cos(i * 1.7) * radius * .7;
        this.bolt(this.a, this.b, impact.grade === 3 ? .018 : .009, alpha, impact.seed + i, 2);
      }
      if (impact.grade === 3) { this.a.copy(impact.point); this.a.y = impact.floor + .025; const size = .3 + age * 6; this.rings.add(this.a, this.flat, size, size, 1, VIOLET, alpha); }
    }
    this.book.each(fighters, ULT.duration, this.gather);
    this.strikes.draw(st, time);
    this.bolts.end(); this.rings.end(); st.close();
  }
  private strike(f: Fighter, out: THREE.Vector3) { return typeof f.strikePoint === 'function' ? f.strikePoint(out) : out.copy(f.handR); }
  private crackle(at: THREE.Vector3, reach: number, count: number, k: number, seed: number) {
    const st = this.stage;
    for (let i = 0; i < count; i++) { const az = seed * 1.7 + i * 2.399963, lift = Math.sin(seed + i * 1.3); this.a.set(at.x + Math.cos(az) * reach, at.y + lift * reach * .8, at.z + Math.sin(az) * reach); jag(st, at, this.a, .035, SHUNKO.main, k, seed + i * 7, .28, 3, .5); }
  }
  private shunko(f: Fighter, k: number, reach: number, seed: number) {
    const st = this.stage, heading = this.heading, right = this.side.set(heading.z, 0, -heading.x), back = bodyCentre(f, this.m); back.y += .32; back.addScaledVector(heading, -.2);
    for (let i = 0, n = st.n(7, 4); i < n; i++) {
      const fan = (i / (n - 1) - .5) * 2.5;
      this.a.copy(back).addScaledVector(right, Math.sin(fan) * .34); this.a.y += .18 + Math.cos(fan) * .16;
      this.b.copy(this.a).addScaledVector(right, Math.sin(fan) * reach).addScaledVector(heading, -.3 * reach); this.b.y += Math.cos(fan) * reach * 1.1;
      jag(st, this.a, this.b, .036, SHUNKO.main, k, seed + i * 9, .22, 4, .5);
    }
    for (let side = 0; side < 2; side++) { const hand = side ? f.handL : f.handR; if (!hand) continue; this.a.copy(back).addScaledVector(right, side ? -.24 : .24); jag(st, this.a, hand, .03, SHUNKO.main, k, seed + 40 + side * 5, .2, 4, .5); st.glow(hand, .12, SHUNKO.core, .5 * k); }
    st.light(this.a.copy(back).addScaledVector(heading, 3.6), 2.6, SHUNKO, .4 * k);
  }
  private step(f: Fighter, k: number, seed: number) {
    const st = this.stage, heading = this.heading, right = this.side.set(heading.z, 0, -heading.x), feet = f.group.position;
    for (let i = 0; i < 5; i++) { this.a.copy(feet).addScaledVector(right, (i - 2) * .22).addScaledVector(heading, -.35); this.a.y += .35 + i * .3; this.b.copy(this.a).addScaledVector(heading, -(1 + 1.4 * k) * (.6 + .4 * Math.sin(seed + i * 2.1) ** 2)); st.streak(this.a, this.b, .03, SHUNKO.main, .9 * k, .5); }
  }
  private pose(f: Fighter, time: number, elapsed: number) {
    const st = this.stage, s = f.state, tick = Math.floor(time * 20), seed = (s.actionSeq ?? 0) * 3.7 + tick * 13, yaw = s.yaw ?? f.group.rotation.y, heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), at = this.strike(f, this.c), feet = f.group.position;
    if (s.action === 'light') { const k = Math.sin(clamp(s.actionTime) * Math.PI); this.crackle(at, .32, 3, k, seed); st.glow(at, .2, SHUNKO.core, .5 * k); st.light(at, 1.8, SHUNKO, .2 * k); return; }
    if (s.action === 'heavy' || s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .12) {
      const contact = s.action === 'ultimate' ? ULT.contacts[0] : s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
      if (elapsed < contact) { const k = clamp(elapsed / contact); st.charge(at, SHUNKO, .22, k, (s.actionSeq ?? 0) * 3.7); this.crackle(at, .3 + .3 * k, 4, k, seed); this.step(f, k, seed); }
      else if (s.action === 'heavy' && elapsed < contact + .2) {
        const k = 1 - (elapsed - contact) / .2; this.a.copy(feet).addScaledVector(heading, .2); this.a.y += .9;
        arc(st, this.a, heading, UP, 1.5, 2, .15, .12, SHUNKO.main, .9 * k, .5); st.light(this.b.copy(this.a).addScaledVector(heading, 1.2), 3.6, SHUNKO, .4 * k);
      }
      return;
    }
    if (s.action === 'special') {
      const release = s.branch ? s.actionDuration * .5 : SPECIAL.contacts[0];
      if (elapsed < release) {
        const k = clamp(elapsed / release); st.charge(at, SHUNKO, .26, k, (s.actionSeq ?? 0) * 3.7);
        if (!s.branch) { this.shunko(f, .4 + .45 * k, .7 + .9 * k, seed); sheenAhead(st, feet, heading, 2 + 1.4 * k, SHUNKO, .5 * k); if (k > .45) this.step(f, (k - .45) / .55, seed); }
      } else if (elapsed < release + .22) { const k = 1 - (elapsed - release) / .22; this.crackle(at, .9, 5, k, seed); st.glow(at, .4, SHUNKO.core, .7 * k); st.light(at, 3.4, SHUNKO, .4 * k); }
    }
  }
  private readonly gather = (actor: Fighter, g: Gather, elapsed: number) => {
    const final = ULT.contacts[ULT.contacts.length - 1]; if (elapsed >= final + .1) return;
    const st = this.stage, time = st.time, opener = ULT.contacts[0], build = clamp((elapsed - opener) / (final - opener)), rise = clamp((elapsed - opener) / .3), seed = g.seq * 4.3, tick = Math.floor(time * 12);
    const yaw = actor.state.yaw ?? actor.group.rotation.y, heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), feet = this.c.copy(actor.group.position).setY(g.floor);
    st.dim(.3 + .45 * build, g.actor, g.target);
    flare(st, feet, 1.9 + .4 * build, (1.6 + 2.8 * build) * rise, SHUNKO, .5 + .5 * build, seed, 7, .07, .14, false);
    st.cracks(this.a.copy(feet).addScaledVector(heading, 4.6).setY(g.floor + .05), UP, (1.2 + .6 * build) * rise, SHUNKO, 1, seed + tick * 7, .55 + .25 * build);
    sheenAhead(st, feet, heading, 2.4 + 2 * build, SHUNKO, .4 + .3 * build, g.floor);
    this.shunko(actor, .4 + .3 * build, .8 + .8 * build, seed + tick * 13);
    if (build > .3) {
      const k = clamp((build - .3) / .2), back = bodyCentre(actor, this.m); back.y += 1.75; back.addScaledVector(heading, -.3); const right = this.side.set(heading.z, 0, -heading.x), radius = .8 + .2 * build;
      st.glow(back, radius / .82, SHUNKO.core, .5 * k, RING, .03, 0, .82);
      for (let i = 0; i < 6; i++) { const ang = i * 1.0472 + time * .6; this.a.copy(back).addScaledVector(right, Math.cos(ang) * radius); this.a.y += Math.sin(ang) * radius; st.glow(this.a, .15, SHUNKO.core, .9 * k); }
    }
    if (build > .75) st.speed(.5 * (build - .75) / .25, g.actor, g.target);
  };
  reset() { for (const c of this.confirms) c.actor = ''; for (const i of this.impacts) i.actor = ''; this.seen.fill(-1); this.seenTime.fill(-1); this.bolts.begin(); this.rings.begin(); this.bolts.end(); this.rings.end(); this.book.reset(); this.strikes.reset(); this.stage.reset(); }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.bolts.dispose(); this.rings.dispose(); this.stage.release(); }
}
