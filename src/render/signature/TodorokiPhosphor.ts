import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { TODOROKI_MOVES } from '../../game/fighters/todoroki';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { armoryDraws } from '../vfx/armory/drawn';
import { MoveStage, STAGE, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const isTodorokiPhosphor = (id: string | undefined) => id === 'todoroki';
export const TODOROKI_PHOSPHOR_ASSETS: readonly string[] = Object.freeze([]);
export const TODOROKI_PHOSPHOR_LIMITS = Object.freeze({ ice: 192, flames: 160, rings: 64, impacts: 24, ultimates: 8, glaciers: 8, walls: 4 });
export const TODOROKI_WALL = Object.freeze({ stand: 1, sink: .4 });
export const TODOROKI_PHOSPHOR_BEATS = Object.freeze({ balance: .423, ignition: .585, open: .747, fire: 1.656, final: 2.916 });
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
const ICE = new THREE.Color(0x9be8fa), FROST = new THREE.Color(0xeaffff), DEEP = new THREE.Color(0x23688a);
const FIRE = new THREE.Color(0xff7138), HEAT = new THREE.Color(0xffe3ac), COLD = new THREE.Color(0xb7fbec);
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const easeOut = (v: number) => 1 - (1 - clamp(v)) * (1 - clamp(v)) * (1 - clamp(v));
const FROSTED = stageLook(0xffffff, 0x9be8fa, 0x23688a, { heart: .5 }), FLAME = STAGE.fire;
const ICE_LIT = new THREE.Color(.5, 1.2, 1.42), FROST_LIT = new THREE.Color(1.3, 1.55, 1.6), DEEP_LIT = new THREE.Color(.05, .3, .56);
const HEAVY = TODOROKI_MOVES.heavy, SPECIAL = TODOROKI_MOVES.special, ULT = TODOROKI_MOVES.ultimate;
const manual = (action: string) => action === 'light' || action === 'heavy' || action === 'special' || action === 'ultimate';

function fracturedIceGeometry() {
  const geometry = new THREE.ConeGeometry(1, 1, 5, 3).toNonIndexed();
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i), t = y + .5;
    const theta = Math.atan2(z, x), radial = Math.hypot(x, z);
    const profile = t < .2 ? .42 : t < .5 ? 1 : t < .85 ? .48 : 0;
    const irregular = .88 + .16 * Math.sin(theta * 3 + .7) + .08 * Math.cos(theta * 2);
    position.setXYZ(i, (radial > .0001 ? x / radial * profile * irregular : 0) + .17 * t * t,
      y, (radial > .0001 ? z / radial * profile * irregular : 0) - .13 * t * t);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); return geometry;
}

class PhosphorBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D();
  private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, readonly capacity: number, kind: number) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('phosphorTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: `Todoroki-${name}`, transparent: true, depthWrite: kind === 0,
      side: THREE.DoubleSide, toneMapped: false, uniforms: { kind: { value: kind }, clock: { value: 0 } },
      vertexShader: `attribute vec4 phosphorTint; varying vec4 vTint; varying vec3 vP; varying float vFace;
        void main(){vTint=phosphorTint;vP=position;vec3 p=position;
        vec3 scale2=vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));
        vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*(normal/max(scale2,vec3(.000001))));vFace=dot(n,normalize(vec3(-.4,.8,.6)));
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float kind;uniform float clock;varying vec4 vTint;varying vec3 vP;varying float vFace;
        void main(){if(vTint.a<.008)discard;float band=vFace>.42?1.:(vFace>-.2?.73:.37);
        float stripe=step(.15,sin(atan(vP.z,vP.x)*5.+vP.y*14.-clock*17.));
        vec3 color=kind<.5?vTint.rgb*band:(kind<1.5?mix(vTint.rgb*.32,vTint.rgb,stripe):vTint.rgb);
        gl_FragColor=vec4(color,vTint.a);}` });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `todoroki-${name}`;
    this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1;
    scene.add(this.mesh);
  }
  begin(time: number) { this.count = 0; this.mesh.material.uniforms.clock.value = time; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, color: THREE.Color, alpha = 1) {
    if (this.count >= this.capacity || alpha <= .008 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.tint.setXYZW(this.count++, color.r, color.g, color.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Impact = { actor: string; born: number; point: THREE.Vector3; floor: number; grade: number; fire: boolean; seed: number };
type Aegir = { actor: string; target: string; seq: number; final: boolean; erupted: boolean; floor: number; endpoint: THREE.Vector3 };
type Glacier = { p: THREE.Vector3; born: number; life: number; size: number; count: number; seed: number; live: boolean };
type Wall = { key: string; origin: THREE.Vector3; head: THREE.Vector3; heading: THREE.Vector3; seen: number; floor: number; live: boolean };

export class TodorokiPhosphor {
  private readonly stage: MoveStage; private readonly full?: VfxKit;
  private glaciers: Glacier[] = Array.from({ length: TODOROKI_PHOSPHOR_LIMITS.glaciers }, () => ({ p: new THREE.Vector3(), born: -1e9, life: 0, size: 0, count: 0, seed: 0, live: false }));
  private walls: Wall[] = Array.from({ length: TODOROKI_PHOSPHOR_LIMITS.walls }, () => ({ key: '', origin: new THREE.Vector3(), head: new THREE.Vector3(), heading: new THREE.Vector3(0, 0, 1), seen: -1e9, floor: 0, live: false }));
  private glacierCursor = 0;
  private heading = new THREE.Vector3(); private right = new THREE.Vector3(); private ground = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private ice: PhosphorBatch;
  private flames: PhosphorBatch;
  private rings: PhosphorBatch;
  private batches: PhosphorBatch[];
  private impacts: Impact[] = Array.from({ length: TODOROKI_PHOSPHOR_LIMITS.impacts }, () => ({ actor: '', born: -1e9, point: new THREE.Vector3(), floor: 0, grade: 0, fire: false, seed: 0 }));
  private ultimates: Aegir[] = Array.from({ length: TODOROKI_PHOSPHOR_LIMITS.ultimates }, () => ({ actor: '', target: '', seq: -1, final: false, erupted: false, floor: 0, endpoint: new THREE.Vector3() }));
  private seen = new Float64Array(128).fill(-1);
  private seenTime = new Float64Array(128).fill(-1);
  private eventCursor = 0; private impactCursor = 0; private ultimateCursor = 0; private disposed = false;
  private p = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3(); private axis = new THREE.Vector3();
  private q = new THREE.Quaternion(); private tilt = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit); this.full = kit.sparks && kit.dust && kit.marks && kit.debris ? kit as VfxKit : undefined;
    this.ice = new PhosphorBatch(scene, 'ice-facets', fracturedIceGeometry(), TODOROKI_PHOSPHOR_LIMITS.ice, 0);
    this.flames = new PhosphorBatch(scene, 'fire-strokes', new THREE.ConeGeometry(1, 1, 7, 2, true), TODOROKI_PHOSPHOR_LIMITS.flames, 1);
    this.rings = new PhosphorBatch(scene, 'temperature-fronts', new THREE.RingGeometry(.92, 1, 40), TODOROKI_PHOSPHOR_LIMITS.rings, 2);
    this.batches = [this.ice, this.flames, this.rings];
  }
  load(_ids: readonly string[]) { return Promise.resolve(); }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') {
      for (const u of this.ultimates) if (u.actor === event.actorId || u.target === event.actorId && !u.final) u.actor = '';
      return;
    }
    if (!isTodorokiPhosphor(event.fighter)) return;
    if (event.kind === 'rejected' || event.kind === 'whiff') { for (const u of this.ultimates) if (u.actor === event.actorId) u.actor = ''; return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const seen = this.eventCursor++ % this.seen.length; this.seen[seen] = event.id; this.seenTime[seen] = event.serverTime;
    const actor = fighters?.get(event.actorId), target = event.targetId ? fighters?.get(event.targetId) : undefined;
    const seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId)
        Object.assign(this.ultimates[this.ultimateCursor++ % this.ultimates.length], { actor: event.actorId, target: event.targetId, seq, final: false, erupted: false,
          floor: blowFloor(actor, target, 0) });
      return;
    }
    if (!target && !event.endpoint) return;
    const final = event.slot === 'ultimate' && !event.branch && event.contactIndex === 2;
    if (armoryDraws(event.fighter, event.slot, event.branch, event.actorId)) {
      if (final) {
        for (const u of this.ultimates) if (u.actor === event.actorId && u.seq === seq) u.final = true;
        if (target) bodyCentre(target, this.p); else this.p.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
        if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.46, this.p);
      }
      return;
    }
    const hit = this.impacts[this.impactCursor++ % this.impacts.length];
    Object.assign(hit, { actor: event.actorId, born: event.serverTime, floor: target ? blowFloor(actor, target, 0) : Math.max(0, (event.endpoint?.y ?? 1) - 1),
      grade: final ? 3 : event.slot === 'special' || event.slot === 'heavy' ? 2 : 1,
      fire: event.slot === 'heavy' || event.slot === 'ultimate' && event.contactIndex === 1, seed: event.id });
    if (target) bodyCentre(target, hit.point); else hit.point.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    if (final) {
      for (const u of this.ultimates) if (u.actor === event.actorId && u.seq === seq) { u.final = true; if (!u.erupted) { u.endpoint.copy(hit.point); u.erupted = true; } hit.floor = u.floor; }
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.46, hit.point);
    }
    this.land(event, hit.point, actor, target, final, hit.floor);
  }
  private land(e: CombatEvent, point: THREE.Vector3, actor: Fighter | undefined, target: Fighter | undefined, final: boolean, captured: number) {
    const st = this.stage, t = e.serverTime, dir = this.heading, yaw = actor?.state.yaw ?? actor?.group.rotation.y ?? 0;
    const floor = final ? captured : blowFloor(actor, target, point.y - 1.05), ground = this.ground.set(point.x, floor, point.z);
    if (actor) dir.subVectors(point, actor.group.position).setY(0);
    if (!actor || dir.lengthSq() < .01) dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    dir.normalize();
    if (e.slot === 'light') { st.burst(point, FROSTED, .4, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      st.burst(point, FLAME, .95 * big, t, { dir, floor, clean: true });
      st.erupt(this.c.copy(point).addScaledVector(dir, .45), this.d.copy(dir).setY(.14).normalize(), FLAME, .34 * big, 3.6 * big, t, .34);
      st.scar(this.c.copy(ground).addScaledVector(dir, 1.3), FLAME, 1.2 * big, t + .05, 1.5);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, FROSTED, 2, t, { floor }); st.shock(ground, FROSTED, 4.6, t, .45); this.glacier(ground, t, 1.5, 1.1, 7, e.id); return; }
      const big = e.branch ? .7 : 1;
      this.glacier(this.c.copy(ground).addScaledVector(dir, 1.7), t, 1.05, 1.55 * big, 9, e.id);
      st.burst(point, FROSTED, 1.8 * big, t, { dir, floor, clean: true });
      st.shock(ground, FROSTED, 6 * big, t, .5);
      st.shatter(this.c.copy(ground).addScaledVector(dir, 1.7).setY(floor + .06), UP, FROSTED, 3.6 * big, t, 1);
      st.scar(this.c.copy(ground).addScaledVector(dir, 1.7), FROSTED, 2.4 * big, t + .05, 2.2);
      this.mist(this.c.copy(ground).addScaledVector(dir, 1.2), .8 * big, 5, t + .05, e.id, dir);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      if (e.contactIndex) {
        st.burst(point, FLAME, 1.4, t, { dir, floor });
        st.erupt(this.c.copy(point).addScaledVector(dir, .4), this.d.copy(dir).setY(.12).normalize(), FLAME, .4, 4.5, t, .4);
        st.shock(ground, FLAME, 5, t, .5);
      } else { st.burst(point, FROSTED, 1.05, t, { dir, floor, clean: true }); this.glacier(this.c.copy(ground).addScaledVector(dir, .6), t, .9, .8, 4, e.id); }
      return;
    }
    this.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    this.glacier(this.c.copy(ground).addScaledVector(dir, 1.6), t, 1.8, 2.2, 14, e.id);
    st.burst(point, FROSTED, 2.1, t, { dir, floor, clean: true });
    st.dome(point, FROSTED, 4, t, .5);
    st.erupt(ground, UP, FROSTED, 1, 10, t + .04, .7);
    st.erupt(this.c.copy(ground).addScaledVector(this.right, -2.7), UP, FLAME, .75, 7.5, t + .12, .7);
    st.shock(ground, FROSTED, 10, t, .6);
    st.shatter(this.c.copy(ground).setY(floor + .06), UP, FROSTED, 8, t + .04, 1.4);
    st.scar(this.c.copy(ground).addScaledVector(this.right, 1.4), FROSTED, 3, t + .2, 2.1);
    st.scar(this.c.copy(ground).addScaledVector(this.right, -2.7), FLAME, 2, t + .25, 2);
    this.mist(ground, 1.4, 7, t + .1, e.id);
  }
  private glacier(p: THREE.Vector3, born: number, life: number, size: number, count: number, seed: number) {
    const g = this.glaciers[this.glacierCursor++ % this.glaciers.length];
    g.p.copy(p); g.born = born; g.life = life; g.size = size; g.count = count; g.seed = seed; g.live = true;
  }
  private mist(ground: THREE.Vector3, size: number, count: number, born: number, seed: number, away?: THREE.Vector3) {
    const kit = this.full; if (!kit) return;
    const base = away ? Math.atan2(away.z, away.x) : 0;
    for (let i = 0, n = kit.n(count, 2); i < n; i++) {
      const ang = away ? base + (hash(i * 2.3 + seed) - .5) * 2 : i * 2.399963 + seed, r = size * (away ? .6 + hash(i + seed) : 1.2 + .8 * hash(i + seed)), v = 1 + 1.4 * hash(i * 3.3 + seed);
      kit.smoke(ground.x + Math.cos(ang) * r, ground.y + size * .35, ground.z + Math.sin(ang) * r, Math.cos(ang) * v, .25 + .3 * hash(i * 5.1 + seed), Math.sin(ang) * v, size * (.8 + .5 * hash(i * 7.7 + seed)), born + .04 * i, .9 + .4 * hash(i + 2.2), 0xf4ffff, 0x9fd6ea);
    }
  }
  private berg(p: THREE.Vector3, yaw: number, height: number, width: number, bright: boolean) {
    this.q.setFromAxisAngle(UP, yaw); this.tilt.setFromAxisAngle(FRONT, .24 * Math.sin(yaw * 1.7)); this.q.multiply(this.tilt);
    this.ice.add(p, this.q, width, height, width * (.5 + .23 * (1 + Math.sin(yaw * 2.7))), bright ? FROST_LIT : Math.sin(yaw) > -.15 ? ICE_LIT : DEEP_LIT, 1);
  }
  private shard(p: THREE.Vector3, yaw: number, height: number, width: number, alpha: number, bright = false) {
    this.q.setFromAxisAngle(UP, yaw); this.tilt.setFromAxisAngle(FRONT, .24 * Math.sin(yaw * 1.7)); this.q.multiply(this.tilt);
    this.ice.add(p, this.q, width, height, width * (.5 + .23 * (1 + Math.sin(yaw * 2.7))), bright ? FROST : Math.sin(yaw) > -.15 ? ICE : DEEP, alpha);
  }
  private flame(p: THREE.Vector3, time: number, size: number, alpha: number, cold = false) {
    for (let i = 0; i < 3; i++) {
      this.b.copy(p); this.b.x += Math.sin(i * 2.1 + time * 7) * size * .18; this.b.z += Math.cos(i * 2.1 + time * 7) * size * .18;
      this.b.y += size * .12; this.q.setFromAxisAngle(FRONT, Math.sin(time * 8 + i) * .22);
      this.flames.add(this.b, this.q, size * (.35 - i * .07), size * (1.5 - i * .23), size * (.3 - i * .06), cold ? i ? FROST : COLD : i ? HEAT : FIRE, alpha);
    }
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    for (const b of this.batches) b.begin(time);
    const detail = this.kit.budget >= .65, st = this.stage.open(time);
    for (const fighter of fighters.values()) {
      const s = fighter.state; if (!isTodorokiPhosphor(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration;
      if (s.action === 'awaken') this.awakening(fighter, elapsed, time, detail);
      if (!manual(s.action) || s.whiffedAt !== undefined) continue;
      if (s.action === 'ultimate' && elapsed > .6 && s.confirmedAt === undefined) continue;
      if (!armoryDraws('todoroki', s.action, s.branch, s.id)) this.windup(fighter, elapsed);
      const wave = Math.sin(clamp(s.actionTime) * Math.PI), alpha = .9 * wave;
      if (s.action === 'light' || s.action === 'special') {
        const n = detail ? 3 : 2;
        for (let i = 0; i < n; i++) { this.p.copy(fighter.handR); this.p.y += .02 + i * .035; this.shard(this.p, time + i * 2, .10 + wave * .11, .035, alpha, i === 0); }
      }
      if (s.action === 'heavy' || s.action === 'ultimate' && elapsed > 1.05 && elapsed < 1.9) this.flame(fighter.handL, time, .15 + wave * .12, alpha, !!s.awakened);
    }
    for (const flight of flights.values()) {
      if (!isTodorokiPhosphor(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released || armoryDraws(flight.fighter, 'special', undefined, flight.actorId)) continue;
      const yaw = Math.atan2(flight.heading.x, flight.heading.z), count = detail ? 7 : 4;
      for (let i = 0; i < count; i++) {
        const offset = i - (count - 1) / 2, height = .8 + .8 * (1 - Math.abs(offset) / count);
        this.p.copy(flight.position); this.p.x += Math.cos(yaw) * offset * .25; this.p.z -= Math.sin(yaw) * offset * .25;
        this.p.addScaledVector(flight.heading, -.25 * Math.abs(offset)); this.p.y += height / 2 - .65;
        this.shard(this.p, yaw + i * .7, height, .18 + i % 2 * .035, 1, i === Math.floor(count / 2));
      }
      this.p.copy(flight.position); this.p.y -= .62; this.rings.add(this.p, this.flat, .95, .7, 1, DEEP, .65);
      const floor = (flight.actorId ? fighters.get(flight.actorId)?.group.position.y : undefined) ?? flight.position.y - 1.1;
      for (let i = -1; i <= 1; i++) {
        const height = 2.3 - Math.abs(i) * .7; this.p.copy(flight.position); this.p.x += Math.cos(yaw) * i * .7; this.p.z -= Math.sin(yaw) * i * .7; this.p.y = floor + height / 2;
        this.berg(this.p, yaw + i * 1.3, height, .34 - Math.abs(i) * .06, i === 0);
      }
      st.glow(this.p.copy(flight.position).setY(floor + 1.1), 1.4, FROSTED.main, .5); st.light(this.p, 6.5, FROSTED, .65);
      const key = flight.actorId ?? '';
      let wall = this.walls.find(w => w.live && w.key === key && time - w.seen < .2);
      if (!wall) { wall = this.walls.find(w => !w.live) ?? this.walls[0]; wall.key = key; wall.live = true; wall.origin.copy(flight.origin ?? flight.position).setY(floor); }
      wall.head.copy(flight.position).setY(floor); wall.heading.copy(flight.heading); wall.seen = time; wall.floor = floor;
    }
    for (const wall of this.walls) {
      if (!wall.live) continue;
      const gone = time - wall.seen;
      if (gone > TODOROKI_WALL.stand + TODOROKI_WALL.sink || gone < -.5) { wall.live = false; continue; }
      const span = wall.origin.distanceTo(wall.head), n = Math.min(detail ? 20 : 10, Math.floor(span / 1.05)), sink = gone > TODOROKI_WALL.stand ? 1 - (gone - TODOROKI_WALL.stand) / TODOROKI_WALL.sink : 1, yaw = Math.atan2(wall.heading.x, wall.heading.z);
      for (let i = 0; i < n; i++) {
        const along = (i + .5) / Math.max(1, n), height = (1.1 + 1.5 * hash(i * 3.7 + 1.1) + along * .9) * sink, off = (hash(i * 5.3) - .5) * .8;
        if (height <= .05) continue;
        this.p.copy(wall.origin).lerp(wall.head, along); this.p.x += Math.cos(yaw) * off; this.p.z -= Math.sin(yaw) * off; this.p.y = wall.floor + height / 2;
        this.berg(this.p, yaw + i * 2.1, height, .26 + .14 * hash(i * 1.9), i % 3 === 0);
      }
      if (n > 0) { st.light(this.p.copy(wall.origin).lerp(wall.head, .35).setY(wall.floor + .6), 5.5, FROSTED, .4 * sink); st.light(this.p.copy(wall.origin).lerp(wall.head, .8).setY(wall.floor + .6), 5.5, FROSTED, .4 * sink); }
    }
    for (const g of this.glaciers) {
      if (!g.live) continue;
      const age = time - g.born;
      if (age >= g.life) { g.live = false; continue; }
      if (age < 0) continue;
      const rise = easeOut(age / .14), sink = clamp((g.life - age) / .35), n = detail ? g.count : Math.ceil(g.count * .6);
      for (let i = 0; i < n; i++) {
        const u = i / Math.max(1, n - 1), theta = i * 2.399963 + g.seed, radius = g.size * .95 * Math.sqrt(u), up = easeOut((age - u * .08) / .14);
        const height = g.size * (2.7 - 1.7 * u) * (.8 + .35 * hash(i * 3.1 + g.seed)) * Math.min(rise, up) * sink;
        if (height <= .05) continue;
        this.p.set(g.p.x + Math.sin(theta) * radius, g.p.y + height / 2, g.p.z + Math.cos(theta) * radius);
        this.berg(this.p, theta, height, g.size * (.3 - .12 * u) + .08, i % 3 === 0);
      }
      st.light(this.p.copy(g.p).setY(g.p.y + g.size), 3 + g.size * 2, FROSTED, .32 * sink);
      st.glow(this.p, g.size * 1.1, FROSTED.main, .16 * sink);
    }
    for (const u of this.ultimates) {
      if (!u.actor) continue;
      const actor = fighters.get(u.actor), victim = fighters.get(u.target), s = actor?.state;
      if (!actor || !s?.alive || (!victim?.state.alive && !u.final) || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== u.seq || s.whiffedAt !== undefined) { u.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (!u.final && elapsed < TODOROKI_PHOSPHOR_BEATS.final && !armoryDraws('todoroki', 'ultimate', undefined, u.actor)) this.aegir(actor, u, elapsed, time);
      if (elapsed < 2.08) continue;
      if (elapsed > 3.38) { u.actor = ''; continue; }
      this.a.copy(actor.handL).lerp(actor.handR, .5);
      const k = clamp((elapsed - 2.08) / .836); this.flame(this.a, time, .14 + k * .20, .9, true);
      if (elapsed < TODOROKI_PHOSPHOR_BEATS.final) continue;
      if (armoryDraws('todoroki', 'ultimate', undefined, u.actor)) continue;
      if (!u.erupted) { if (victim) bodyCentre(victim, u.endpoint); u.erupted = true; }
      this.axis.copy(u.endpoint);
      const floor = u.floor, fade = clamp((3.38 - elapsed) / .3), growth = clamp((elapsed - 2.916) / .14), n = detail ? 11 : 6;
      for (let i = 0; i < n; i++) {
        const theta = TAU * i / n + .12 * Math.sin(i * 4.7), radius = .8 + growth * (1.05 + .3 * Math.sin(i * 2.2)),
          height = (.7 + .48 * (1 + Math.sin(i * 4.31))) * growth;
        this.p.set(this.axis.x + Math.sin(theta) * radius, floor + height / 2, this.axis.z + Math.cos(theta) * radius);
        this.shard(this.p, theta, height, .20 + growth * (.13 + .07 * Math.sin(i * 2.7)), fade, i % 3 === 0);
      }
      this.p.set(this.axis.x, floor + .04, this.axis.z); this.rings.add(this.p, this.flat, .7 + growth * 2.4, .7 + growth * 2.4, 1, FROST, fade);
    }
    for (const hit of this.impacts) {
      if (!hit.actor) continue;
      const age = time - hit.born, life = hit.grade === 3 ? .52 : .30;
      if (age >= life) { hit.actor = ''; continue; } if (age < 0) continue;
      const fade = 1 - age / life, count = detail ? hit.grade * 5 : hit.grade * 3;
      for (let i = 0; i < count; i++) {
        const theta = i * 2.39996 + hit.seed;
        this.p.copy(hit.point); this.p.x += Math.sin(theta) * age * (2 + hit.grade); this.p.z += Math.cos(theta) * age * (2 + hit.grade);
        this.p.y = Math.max(hit.floor + .05, this.p.y + age * (1 + i % 3) - age * age * 7);
        if (hit.fire) this.flame(this.p, time + i, .06 * fade, fade);
        else this.shard(this.p, theta + age * 5, (.09 + hit.grade * .04) * fade, .04 * fade, fade, i % 3 === 0);
      }
    }
    for (const b of this.batches) b.end(); st.close();
  }
  private windup(f: Fighter, elapsed: number) {
    const st = this.stage, s = f.state, seed = (s.actionSeq ?? 0) * 7.3, yaw = s.yaw ?? f.group.rotation.y, feet = f.group.position;
    const heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
    if (s.action === 'light') {
      const k = Math.sin(clamp(s.actionTime) * Math.PI);
      st.glow(f.handR, .22, FROSTED.main, .5 * k); st.glow(f.handR, .09, FROSTED.core, .6 * k); st.light(f.handR, 1.8, FROSTED, .18 * k);
    } else if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .54 : HEAVY.contacts[0];
      if (elapsed < contact) {
        const k = clamp(elapsed / contact);
        st.charge(f.handL, FLAME, .26, k, seed);
        this.d.copy(heading).multiplyScalar(-1).setY(.4).normalize();
        for (let i = 0; i < 2; i++) st.tongue(this.c.copy(f.handL).addScaledVector(heading, -.25 - i * .3 * k), this.d, .3 - i * .06, .45 + .7 * k, FLAME, k * (1 - i * .25), seed + i);
      } else if (elapsed < contact + .22) {
        const flare = 1 - (elapsed - contact) / .22; this.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
        for (let i = 0; i < 6; i++) {
          const a = -1.1 + i * .44;
          this.c.copy(feet).addScaledVector(heading, Math.cos(a) * 1.5).addScaledVector(this.right, Math.sin(a) * 1.5); this.c.y += 1.15;
          st.tongue(this.c, this.d.copy(this.right).multiplyScalar(-.5).setY(.85).normalize(), .3, .7 + .5 * Math.cos(a), FLAME, flare * (.9 - Math.abs(a) * .25), seed + i);
        }
        st.light(this.c.copy(feet).addScaledVector(heading, 1.3).setY(feet.y + 1.1), 3, FLAME, .35 * flare);
      }
    } else if (s.action === 'special' && !s.branch) {
      if (elapsed < SPECIAL.contacts[0]) {
        const k = clamp(elapsed / SPECIAL.contacts[0]);
        st.charge(f.handR, FROSTED, .32, k, seed);
        st.pool(this.c.copy(feet).addScaledVector(heading, 1.1), 1.4 + 1.2 * k, FROSTED, k, seed);
      }
    } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .1) st.charge(f.handR, FROSTED, .26, elapsed / ULT.contacts[0], seed);
  }
  private aegir(actor: Fighter, u: Aegir, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - ULT.contacts[0]) / (TODOROKI_PHOSPHOR_BEATS.final - ULT.contacts[0])), yaw = actor.state.yaw ?? actor.group.rotation.y, seed = u.seq * 3.7;
    const feet = this.ground.copy(actor.group.position).setY(u.floor), heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), right = this.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    st.dim(.3 + .4 * g, u.actor, u.target);
    st.pool(this.c.copy(feet).addScaledVector(right, 1.6), 1.9 + 1.7 * g, FROSTED, .3 + .7 * g, seed);
    st.pool(this.c.copy(feet).addScaledVector(right, -1.6), 1.9 + 1.7 * g, FLAME, .3 + .7 * g, seed + 1);
    for (let i = 0; i < 3; i++) {
      const a = -1.05 + i * 1.05, r = 2.7 + .3 * g, ax = Math.cos(a) * r, az = Math.sin(a) * r;
      const tall = (.5 + 1.3 * g) * (.75 + .5 * hash(i * 3.3 + seed));
      this.p.copy(feet).addScaledVector(right, ax).addScaledVector(heading, az); this.p.y += tall / 2;
      this.berg(this.p, a + seed + i, tall, .16 + .1 * g, i % 2 === 0);
      const flame = (.8 + 1.3 * g) * (.82 + .18 * Math.sin(time * 7 + i * 2.1));
      this.c.copy(feet).addScaledVector(right, -ax).addScaledVector(heading, az); this.c.y += flame * .45;
      st.tongue(this.c, UP, flame * .42, flame, FLAME, (.55 + .45 * g) * (.6 + .35 * hash(i + seed)), seed + i);
    }
    st.light(this.c.copy(feet).addScaledVector(right, 1.8).setY(u.floor + .6), 3.6 + g, FROSTED, .3 + .2 * g);
    st.light(this.c.copy(feet).addScaledVector(right, -1.8).setY(u.floor + .6), 3.6 + g, FLAME, .3 + .2 * g);
    st.charge(actor.handR, FROSTED, .14 + .1 * g, Math.max(.3, g * .7), seed); st.charge(actor.handL, FLAME, .14 + .1 * g, Math.max(.3, g * .7), seed + 1);
    if (g > .8) st.speed(.5 * (g - .8) / .2, u.actor, u.target);
  }
  private awakening(fighter: Fighter, elapsed: number, time: number, detail: boolean) {
    const fade = clamp((.9 - elapsed) / .13), merge = clamp(elapsed / TODOROKI_PHOSPHOR_BEATS.balance);
    this.flame(fighter.handL, time, .09 + merge * .10, fade, elapsed >= TODOROKI_PHOSPHOR_BEATS.ignition);
    this.p.copy(fighter.handR); this.shard(this.p, time, .16 + merge * .11, .055, fade, true);
    if (elapsed < TODOROKI_PHOSPHOR_BEATS.ignition) return;
    const age = elapsed - TODOROKI_PHOSPHOR_BEATS.ignition;
    bodyCentre(fighter, this.a); const n = detail ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const theta = TAU * i / n + time * 3, radius = .27 + age * 1.5;
      this.p.set(this.a.x + Math.sin(theta) * radius, this.a.y + Math.cos(theta * 2) * .15, this.a.z + Math.cos(theta) * radius);
      this.flame(this.p, time + i, .07 + age * .08, fade * .75, true);
    }
    this.p.copy(fighter.group.position); this.p.y += .035; this.rings.add(this.p, this.flat, .4 + age * 5, .4 + age * 5, 1, COLD, fade);
  }
  reset() {
    for (const u of this.ultimates) u.actor = '';
    for (const h of this.impacts) h.actor = '';
    for (const g of this.glaciers) g.live = false; for (const w of this.walls) w.live = false;
    this.seen.fill(-1); this.seenTime.fill(-1); this.eventCursor = this.impactCursor = this.ultimateCursor = this.glacierCursor = 0;
    for (const b of this.batches) { b.begin(0); b.end(); }
    this.stage.reset();
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.reset(); for (const b of this.batches) b.dispose(); this.stage.release(); }
}
