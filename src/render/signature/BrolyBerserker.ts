import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { BROLY_MOVES } from '../../game/fighters/broly';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { MoveStage, SHEEN, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';
import { CastBook, flare, type Gather } from './StageCraft';

export const BROLY_BERSERKER_ASSETS: readonly string[] = Object.freeze([]);
export const BROLY_BERSERKER_LIMITS = Object.freeze({ cores: 64, beams: 24, rings: 64, debris: 160, impacts: 24, roars: 8 });
export const BROLY_BERSERKER_BEATS = Object.freeze({ crush: 1.2636, charge: 1.96, beam: 2.4948, end: 2.82, transform: .477 });
export const isBrolyBerserker = (id: string | undefined) => id === 'broly';
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const GREEN = new THREE.Color(0x7fd526), LIME = new THREE.Color(0xe5ff96), INK = new THREE.Color(0x163b22);
const ROCK = new THREE.Color(0x656855), WHITE = new THREE.Color(0xf8ffe3);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const attacks = (action: string) => ['light', 'heavy', 'special', 'ultimate'].includes(action);
const KI = stageLook(0xe5ff96, 0x7fd526, 0x163b22, { sphere: { body: new THREE.Color(.1, 1.15, .1), core: new THREE.Color(2.3, 3, 1.5), rimA: new THREE.Color(.5, 2.4, .3), rimB: new THREE.Color(1.3, 2.8, .6), spin: 1.2 } });
const HEAVY = BROLY_MOVES.heavy, SPECIAL = BROLY_MOVES.special, ULT = BROLY_MOVES.ultimate;
type Sphere = { at: THREE.Vector3; born: number; life: number; from: number; to: number; live: boolean };
const headPosition = new THREE.Vector3(), jawPosition = new THREE.Vector3();
export function brolyMouth(fighter: Fighter, out: THREE.Vector3): THREE.Vector3 {
  const body = fighter.shownBody ?? fighter;
  const head = body.joints?.get('Head'), jaw = body.model?.getObjectByName('Jaw');
  if (jaw && head) out.copy(jaw.getWorldPosition(jawPosition)).lerp(head.getWorldPosition(headPosition), .12);
  else if (head) head.getWorldPosition(out);
  else bodyCentre(fighter, out).addScaledVector(UP, .58);
  const yaw = fighter.group.rotation.y;
  out.x += Math.sin(yaw) * .075; out.z += Math.cos(yaw) * .075;
  return out;
}

class BerserkerBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D();
  private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, readonly capacity: number, kind: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('berserkerTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: `Broly-${name}`, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false, uniforms: { kind: { value: kind }, clock: { value: 0 } },
      vertexShader: `attribute vec4 berserkerTint;varying vec4 vTint;varying vec3 vP;varying float vFace;
        void main(){vTint=berserkerTint;vP=position;vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
        vFace=dot(n,normalize(vec3(-.3,.9,.4)));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float kind;uniform float clock;varying vec4 vTint;varying vec3 vP;varying float vFace;
        void main(){if(vTint.a<.003)discard;float band=vFace>.4?1.:(vFace>-.15?.79:.49);
        float streak=step(.4,sin(atan(vP.z,vP.x)*7.+vP.y*13.-clock*22.));
        vec3 ink=mix(vTint.rgb*.52,vTint.rgb,streak);vec3 col=kind<.5?vTint.rgb*band:(kind<1.5?ink:vTint.rgb);
        gl_FragColor=vec4(col,vTint.a);}`,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = `broly-berserker-${name}`; this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1;
    scene.add(this.mesh);
  }
  begin(time: number) { this.count = 0; this.mesh.material.uniforms.clock.value = time; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, color: THREE.Color, alpha = 1) {
    if (this.count >= this.capacity || alpha <= .003 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, color.r, color.g, color.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Roar = { actor: string; target: string; seq: number; finalHit: boolean; endpoint: THREE.Vector3 };
type Impact = { actor: string; seq: number; born: number; grade: number; seed: number; point: THREE.Vector3; floor: number; projectile: boolean };

export class BrolyBerserker {
  private readonly stage: MoveStage; private readonly book = new CastBook('broly', ULT.contacts.length);
  private spheres: Sphere[] = Array.from({ length: 4 }, () => ({ at: new THREE.Vector3(), born: 0, life: 0, from: 0, to: 0, live: false })); private sphereCursor = 0;
  private c = new THREE.Vector3(); private heading = new THREE.Vector3();
  private cores: BerserkerBatch;
  private beams: BerserkerBatch;
  private rings: BerserkerBatch;
  private debris: BerserkerBatch;
  private batches: BerserkerBatch[];
  private roars: Roar[] = Array.from({ length: BROLY_BERSERKER_LIMITS.roars }, () => ({ actor: '', target: '', seq: -1, finalHit: false, endpoint: new THREE.Vector3() }));
  private impacts: Impact[] = Array.from({ length: BROLY_BERSERKER_LIMITS.impacts }, () => ({ actor: '', seq: -1, born: 0, grade: 0, seed: 0, point: new THREE.Vector3(), floor: 0, projectile: false }));
  private seen = new Float64Array(128).fill(-1);
  private seenTime = new Float64Array(128).fill(-1);
  private eventCursor = 0;
  private roarCursor = 0;
  private impactCursor = 0;
  private disposed = false;
  private p = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.cores = new BerserkerBatch(scene, 'cores', new THREE.IcosahedronGeometry(1, 1), BROLY_BERSERKER_LIMITS.cores, 0);
    this.beams = new BerserkerBatch(scene, 'beams', new THREE.CylinderGeometry(.82, .24, 1, 14, 4, true), BROLY_BERSERKER_LIMITS.beams, 1);
    this.rings = new BerserkerBatch(scene, 'rings', new THREE.RingGeometry(.90, 1, 40), BROLY_BERSERKER_LIMITS.rings, 2);
    this.debris = new BerserkerBatch(scene, 'debris', new THREE.IcosahedronGeometry(1, 0), BROLY_BERSERKER_LIMITS.debris, 0);
    this.batches = [this.cores, this.beams, this.rings, this.debris];
  }
  load(_ids: readonly string[]): Promise<void> { return Promise.resolve(); }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    this.staged(event, fighters);
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isBrolyBerserker(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const slot = this.eventCursor++ % this.seen.length; this.seen[slot] = event.id; this.seenTime[slot] = event.serverTime;
    const actor = fighters?.get(event.actorId), target = event.targetId ? fighters?.get(event.targetId) : undefined;
    const seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId)
        Object.assign(this.roars[this.roarCursor++ % this.roars.length], { actor: event.actorId, target: event.targetId, seq, finalHit: false });
      return;
    }
    if (!target && !event.endpoint) return;
    const final = event.slot === 'ultimate' && !event.branch && event.contactIndex === 2;
    const impact = this.impacts[this.impactCursor++ % this.impacts.length];
    Object.assign(impact, { actor: event.actorId, seq, born: event.serverTime, seed: event.id,
      grade: final ? 3 : event.slot === 'heavy' || event.slot === 'special' ? 2 : 1, floor: target ? blowFloor(actor, target, 0) : 0,
      projectile: event.slot === 'special' && !event.branch });
    if (target) bodyCentre(target, impact.point); else impact.point.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    if (final) {
      for (const roar of this.roars) if (roar.actor === event.actorId && roar.seq === seq && roar.target === event.targetId) {
        roar.finalHit = true; roar.endpoint.copy(impact.point);
      }
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.48, impact.point);
    }
  }
  private staged(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    const blow = this.book.take(e, fighters); if (!blow) return;
    const st = this.stage, { point, ground, dir, floor, t } = blow;
    if (e.slot === 'light') { st.burst(point, KI, .42, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      st.burst(point, KI, .9 * big, t, { dir, floor }); st.dome(point, KI, 2 * big, t, .34);
      st.shatter(this.c.copy(ground).setY(floor + .06), UP, KI, 2.3 * big, t, .55); st.shock(ground, KI, 3.6 * big, t, .4);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, KI, 2.1, t, { floor }); this.grow(point, t, .45, .5, 1.6); st.shock(ground, KI, 3.6, t, .45); st.scar(ground, KI, 2.2, t + .05, 1.8); return; }
      const big = e.branch ? .75 : 1;
      this.grow(point, t, .5, .6 * big, 1.55 * big);
      st.burst(point, KI, 1.8 * big, t, { dir, floor }); st.dome(point, KI, 3.2 * big, t, .45);
      st.shock(ground, KI, 4.6 * big, t, .45); st.scar(ground, KI, 2 * big, t + .05, 2.1);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!blow.final) { st.burst(point, KI, blow.index ? 1.6 : 1.25, t, { dir, floor }); if (blow.index) { st.shock(ground, KI, 5, t, .5); st.shatter(this.c.copy(ground).setY(floor + .06), UP, KI, 3, t, .7); } return; }
    this.grow(point, t, .62, .9, 2.4);
    st.dome(point, KI, 4.4, t, .44);
    st.burst(point, KI, 2.1, t, { dir, floor });
    st.shatter(this.c.copy(ground).setY(floor + .06), UP, KI, 7, t + .04, 1.2);
    st.shock(ground, KI, 9, t, .6);
    st.scar(ground, KI, 3.2, t + .2, 2.2);
  }
  private grow(at: THREE.Vector3, born: number, life: number, from: number, to: number) { const s = this.spheres[this.sphereCursor++ % this.spheres.length]; s.at.copy(at); s.born = born; s.life = life; s.from = from; s.to = to; s.live = true; }
  private cancel(id: string, targetToo = false) {
    for (const roar of this.roars) if (roar.actor === id || targetToo && roar.target === id && !roar.finalHit) roar.actor = '';
    for (const impact of this.impacts) if (impact.actor === id) impact.actor = '';
  }
  private core(p: THREE.Vector3, radius: number, alpha: number) {
    this.q.identity();
    this.cores.add(p, this.q, radius, radius, radius, GREEN, alpha);
    this.cores.add(p, this.q, radius * .7, radius * .7, radius * .7, WHITE, alpha);
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    for (const batch of this.batches) batch.begin(time);
    const detail = this.kit.budget >= .65, st = this.stage.open(time);
    for (const fighter of fighters.values()) {
      const s = fighter.state;
      if (!isBrolyBerserker(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration;
      if (attacks(s.action) && s.whiffedAt === undefined) this.pose(fighter, elapsed);
      if (s.action === 'awaken') this.awakening(fighter, elapsed, detail);
      if (s.action === 'special' && !s.branch && s.whiffedAt === undefined && elapsed < BROLY_MOVES.special.contacts[0]) {
        this.p.copy(fighter.handR); const k = clamp(elapsed / BROLY_MOVES.special.contacts[0]);
        this.core(this.p, .07 + .19 * k, .9);
        if (detail) {
          this.q.setFromAxisAngle(UP, time * 5); this.rings.add(this.p, this.q, .15 + .15 * k, .15 + .15 * k, 1, LIME, .8);
        }
      }
      if (s.awakened && s.action !== 'awaken' && attacks(s.action)) {
        const fade = Math.sin(clamp(s.actionTime) * Math.PI) * .5;
        this.q.setFromAxisAngle(FRONT, time * 2);
        this.rings.add(fighter.handR, this.q, .15, .15, 1, LIME, fade);
        this.rings.add(fighter.handL, this.q, .15, .15, 1, GREEN, fade);
      }
    }
    for (const flight of flights.values()) {
      if (!isBrolyBerserker(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      st.ball(flight.position, .55, KI, (flight.since ?? 0) * 3.1); st.orb(flight.position, flight.heading, .8, KI, (flight.since ?? 0) * 3.1);
      this.core(flight.position, .33, 1);
      this.q.setFromUnitVectors(UP, flight.heading);
      this.p.copy(flight.position).addScaledVector(flight.heading, -.55);
      this.beams.add(this.p, this.q, .35, 1.1, .35, GREEN, .8);
      if (detail) {
        this.q.setFromUnitVectors(FRONT, flight.heading);
        this.rings.add(flight.position, this.q, .43, .43, 1, INK, .7);
      }
    }
    for (const roar of this.roars) {
      if (!roar.actor) continue;
      const actor = fighters.get(roar.actor), victim = fighters.get(roar.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !roar.finalHit || s.action !== 'ultimate' || s.branch ||
        (s.actionSeq ?? -1) !== roar.seq || s.whiffedAt !== undefined) { roar.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (elapsed > BROLY_BERSERKER_BEATS.end) { roar.actor = ''; continue; }
      if (elapsed < BROLY_BERSERKER_BEATS.charge) continue;
      brolyMouth(actor, this.a);
      if (roar.finalHit && !victim?.state.alive) this.b.copy(roar.endpoint);
      else bodyCentre(victim!, this.b);
      const charge = clamp((elapsed - BROLY_BERSERKER_BEATS.charge) / (BROLY_BERSERKER_BEATS.beam - BROLY_BERSERKER_BEATS.charge));
      this.core(this.a, .045 + charge * .15, 1);
      if (elapsed < BROLY_BERSERKER_BEATS.beam) { st.ball(this.a, .06 + .3 * charge * charge, KI, roar.seq); st.charge(this.a, KI, .42, charge, roar.seq); continue; }
      const fade = clamp((BROLY_BERSERKER_BEATS.end - elapsed) / .12);
      st.beam(this.a, this.b, .6, KI, clamp(.1 + (elapsed - BROLY_BERSERKER_BEATS.beam) / (BROLY_BERSERKER_BEATS.end - BROLY_BERSERKER_BEATS.beam) * .9), roar.seq + 1);
      this.direction.subVectors(this.b, this.a); const length = Math.min(10, this.direction.length());
      if (length < .05) continue;
      this.direction.normalize(); this.q.setFromUnitVectors(UP, this.direction);
      this.p.copy(this.a).addScaledVector(this.direction, length / 2);
      this.beams.add(this.p, this.q, .52, length, .52, GREEN, fade);
      this.beams.add(this.p, this.q, .29, length, .29, WHITE, fade);
      this.q.setFromUnitVectors(FRONT, this.direction);
      for (let i = 0; i < (detail ? 3 : 1); i++) {
        const t = ((elapsed - BROLY_BERSERKER_BEATS.beam) * 4 + i / 3) % 1;
        this.p.copy(this.a).addScaledVector(this.direction, t * length);
        this.rings.add(this.p, this.q, .2 + .45 * t, .2 + .45 * t, 1, LIME, fade * .7);
      }
    }
    for (const impact of this.impacts) {
      if (!impact.actor) continue;
      const s = fighters.get(impact.actor)?.state, age = time - impact.born, life = impact.grade === 3 ? .48 : .25;
      if (!s?.alive || !impact.projectile && ((s.actionSeq ?? -1) !== impact.seq || !attacks(s.action) || s.whiffedAt !== undefined) || age >= life) { impact.actor = ''; continue; }
      if (age < 0) continue;
      const fade = 1 - age / life, n = detail ? impact.grade * 5 : impact.grade * 3;
      this.p.copy(impact.point); this.p.y = impact.floor + .04;
      this.rings.add(this.p, this.flat, .25 + age * impact.grade * 2, .25 + age * impact.grade * 2, 1, GREEN, fade * .8);
      for (let i = 0; i < n; i++) {
        const theta = i * 2.39996 + impact.seed, speed = .6 + impact.grade * .75;
        this.p.copy(impact.point); this.p.x += Math.sin(theta) * age * speed; this.p.z += Math.cos(theta) * age * speed;
        this.p.y += age * (1 + i % 3) - 4 * age * age;
        this.p.y = Math.max(impact.floor + .03, this.p.y); this.q.setFromAxisAngle(UP, theta + age * 4);
        const size = (.025 + impact.grade * .015) * fade;
        this.debris.add(this.p, this.q, size, size * 1.7, size, i % 3 ? ROCK : LIME, fade);
      }
    }
    this.book.each(fighters, BROLY_BERSERKER_BEATS.beam, this.gather);
    for (const sphere of this.spheres) {
      if (!sphere.live) continue; const age = time - sphere.born;
      if (age >= sphere.life) { sphere.live = false; continue; } if (age < 0) continue;
      const u = age / sphere.life, radius = sphere.from + (sphere.to - sphere.from) * (1 - (1 - u) * (1 - u)), fade = u < .55 ? 1 : 1 - (u - .55) / .45;
      st.ball(sphere.at, radius, KI, sphere.born * 5.3, fade); st.glow(sphere.at, radius * 1.7, KI.main, .6 * fade); st.light(sphere.at, Math.min(9, radius * 2.4 + 2.5), KI, .6 * fade);
    }
    for (const batch of this.batches) batch.end(); st.close();
  }
  private pose(f: Fighter, elapsed: number) {
    const st = this.stage, s = f.state, seed = (s.actionSeq ?? 0) * 4.3, at = typeof f.strikePoint === 'function' ? f.strikePoint(this.c) : this.c.copy(f.handR), feet = f.group.position;
    if (s.action === 'light') { const k = Math.sin(clamp(s.actionTime) * Math.PI); st.glow(at, .3, KI.main, .55 * k); st.glow(at, .12, KI.core, .8 * k); st.light(at, 1.9, KI, .2 * k); return; }
    if (s.action === 'heavy' || s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .12) {
      const contact = s.action === 'ultimate' ? ULT.contacts[0] : s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
      if (elapsed < contact) { const k = clamp(elapsed / contact); st.charge(at, KI, .26, k, seed); st.ball(at, .07 + .15 * k, KI, seed); }
      else if (s.action === 'heavy' && elapsed < contact + .2) { const k = 1 - (elapsed - contact) / .2; st.bubble(at, .35 + .6 * (1 - k), KI, k); }
      return;
    }
    if (s.action === 'special') {
      const release = s.branch ? s.actionDuration * .5 : SPECIAL.contacts[0]; if (elapsed >= release) return;
      const k = clamp(elapsed / release), hand = f.handR ?? at;
      st.charge(hand, KI, .38, k, seed);
      if (!s.branch) { st.ball(hand, .1 + .36 * k * k, KI, seed); st.disc(this.p.copy(feet), 2.2 + 1.8 * k, KI.main, .55 * k, SHEEN, 1); st.light(this.p.copy(feet).setY(feet.y + .5), 3.4 + 2 * k, KI, .36 * k); }
    }
  }
  private readonly gather = (actor: Fighter, g: Gather, elapsed: number) => {
    const st = this.stage, opener = ULT.contacts[0], build = clamp((elapsed - opener) / (BROLY_BERSERKER_BEATS.beam - opener)), rise = clamp((elapsed - opener) / .35), seed = g.seq * 3.9, feet = this.c.copy(actor.group.position).setY(g.floor);
    st.dim(.3 + .45 * build, g.actor, g.target);
    flare(st, feet, 1.7 + .5 * build, (2 + 3.4 * build) * rise, KI, .5 + .5 * build, seed, 9, .11);
    st.pool(this.p.copy(feet), 2.6 + 3 * build, KI, .3 + .7 * build, seed);
    if (build > .75) st.speed(.5 * (build - .75) / .25, g.actor, g.target);
  };
  private awakening(fighter: Fighter, elapsed: number, detail: boolean) {
    const p = fighter.group.position, born = BROLY_BERSERKER_BEATS.transform;
    const fade = clamp((.9 - elapsed) / .16);
    this.p.copy(p); this.p.y += .06;
    if (elapsed < born) {
      const radius = 1.25 - .85 * clamp(elapsed / born);
      this.rings.add(this.p, this.flat, radius, radius, 1, GREEN, .7);
    } else for (let i = 0; i < (detail ? 2 : 1); i++) {
      const age = elapsed - born - i * .075;
      if (age < 0) continue;
      const radius = .45 + age * 7;
      this.rings.add(this.p, this.flat, radius, radius, 1, i ? LIME : GREEN, fade * .85);
    }
    const n = detail ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const theta = i * TAU / n + .2, burst = Math.max(0, elapsed - born), radius = .48 + burst * 2;
      this.p.set(p.x + Math.sin(theta) * radius, p.y + .07 + Math.sin(clamp(elapsed / .9) * Math.PI) * (.25 + i % 3 * .15), p.z + Math.cos(theta) * radius);
      this.q.setFromAxisAngle(UP, theta + elapsed * 3);
      this.debris.add(this.p, this.q, .04, .07, .03, i % 3 ? ROCK : GREEN, fade);
    }
  }
  reset() {
    for (const roar of this.roars) roar.actor = '';
    for (const impact of this.impacts) impact.actor = '';
    this.seen.fill(-1); this.seenTime.fill(-1);
    this.eventCursor = this.roarCursor = this.impactCursor = 0;
    for (const batch of this.batches) { batch.begin(0); batch.end(); }
    for (const sphere of this.spheres) sphere.live = false; this.book.reset(); this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; for (const batch of this.batches) batch.dispose(); this.stage.release(); }
}
