import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { ALL_MIGHT_MOVES, ALL_MIGHT_AWAKENING, ALL_MIGHT_ULTIMATE_BEATS } from '../../game/fighters/all-might';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { MARK } from '../vfx/GroundMarks';
import { armoryDraws } from '../vfx/armory/drawn';
import { SIGNATURE, involvesLocal } from './context';
import { RING } from './GlowBatch';
import { MoveStage, stageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const ALL_MIGHT_PRESSURE_ASSETS: readonly string[] = Object.freeze([]);
export const ALL_MIGHT_PRESSURE_LIMITS = Object.freeze({ rings: 128, gusts: 96, debris: 128, impacts: 24, finishers: 8 });
export const isAllMightPressure = (id: string | undefined) => id === 'all-might';
export function allMightContact(fighter: Fighter, index: number, out: THREE.Vector3, clip = ''): boolean {
  if (!isAllMightPressure(fighter.state.fighter)) return false;
  if (/Carolina Smash|Double Hammer|Aerial Hammer|Meteor Landing|Rush3/.test(clip)) {
    out.copy(fighter.handR).lerp(fighter.handL, .5);
  } else if (/Hero Backfist|Rush1/.test(clip) || fighter.state.action === 'ultimate' && index === 1) {
    out.copy(fighter.handL);
  } else out.copy(fighter.handR);
  return true;
}
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1);
const WHITE = new THREE.Color(0xfffbee), GOLD = new THREE.Color(0xf6c65a);
const BLUE = new THREE.Color(0x31609c), STONE = new THREE.Color(0x807564);
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const PRESSURE = stageLook(0xffffff, 0xe6f1ff, 0x31609c), PLUS = stageLook(0xfffbee, 0xffd23a, 0x1f4fbf);
const HEAVY = ALL_MIGHT_MOVES.heavy, SPECIAL = ALL_MIGHT_MOVES.special, ULT = ALL_MIGHT_MOVES.ultimate;

function pressureRibbon(): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [], segments = 56;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, angle = t * Math.PI * 1.72;
    const halfWidth = .009 + .075 * Math.pow(Math.sin(t * Math.PI), .7);
    const radius = .79 + t * .21;
    for (const edge of [-1, 1]) positions.push((radius + edge * halfWidth) * Math.cos(angle), (radius + edge * halfWidth) * Math.sin(angle), (t - .5) * .72);
    if (i < segments) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

class PressureBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private colors: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D();
  private count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, readonly capacity: number, broken: boolean) {
    this.colors = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('pressureColor', this.colors);
    const material = new THREE.ShaderMaterial({ name: `AllMight-${name}`, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false, uniforms: { clock: { value: 0 }, broken: { value: broken ? 1 : 0 }, vapor: { value: name === 'gusts' ? 1 : 0 } },
      vertexShader: `attribute vec4 pressureColor;varying vec4 vColor;varying vec3 vP;varying vec3 vN;
        void main(){vColor=pressureColor;vP=position;
        mat3 m=mat3(instanceMatrix);vec3 s2=vec3(dot(m[0],m[0]),dot(m[1],m[1]),dot(m[2],m[2]));
        vN=normalize(normalMatrix*m*(normal/max(s2,vec3(.000001))));
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float clock;uniform float broken;uniform float vapor;varying vec4 vColor;varying vec3 vP;varying vec3 vN;
        void main(){if(vColor.a<.003)discard;
        float band=broken>.5?(.78+.22*smoothstep(-.36,.36,vP.z)):1.;
        float feather=pow(abs(normalize(vN).z),1.6);
        float curl=.60+.40*sin(vP.x*7.+vP.y*9.-clock*4.+sin(vP.z*8.+clock*2.));
        float mist=vapor>.5?feather*(.32+.68*curl)*.68:1.;
        gl_FragColor=vec4(vColor.rgb*band,vColor.a*mist);}`,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = `all-might-pressure-${name}`; this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1;
    scene.add(this.mesh);
  }
  begin(time: number) { this.count = 0; this.mesh.material.uniforms.clock.value = time; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, tint: THREE.Color, alpha: number) {
    if (this.count >= this.capacity || alpha <= .003 || Math.min(x, y, z) <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.colors.setXYZW(this.count++, tint.r, tint.g, tint.b, clamp(alpha));
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.colors.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

type Finisher = { actor: string; target: string; seq: number; finalHit: boolean; endpoint: THREE.Vector3; floor: number };
type Impact = { actor: string; born: number; point: THREE.Vector3; final: boolean; seed: number };
type Cross = { p: THREE.Vector3; yaw: number; born: number; life: number; size: number; live: boolean };

export class AllMightPressure {
  private stage?: MoveStage; private full?: VfxKit;
  private crosses: Cross[] = Array.from({ length: 6 }, () => ({ p: new THREE.Vector3(), yaw: 0, born: -1e9, life: 0, size: 0, live: false }));
  private crossCursor = 0;
  private heading = new THREE.Vector3(); private ground = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private rings: PressureBatch;
  private gusts: PressureBatch;
  private debris: PressureBatch;
  private batches: PressureBatch[];
  private finishers: Finisher[] = Array.from({ length: ALL_MIGHT_PRESSURE_LIMITS.finishers }, () => ({ actor: '', target: '', seq: -1, finalHit: false, endpoint: new THREE.Vector3(), floor: 0 }));
  private impacts: Impact[] = Array.from({ length: ALL_MIGHT_PRESSURE_LIMITS.impacts }, () => ({ actor: '', born: 0, point: new THREE.Vector3(), final: false, seed: 0 }));
  private seen = new Float64Array(128).fill(-1);
  private seenTime = new Float64Array(128).fill(-1);
  private eventCursor = 0;
  private finisherCursor = 0;
  private impactCursor = 0;
  private disposed = false;
  private p = new THREE.Vector3();
  private a = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(private scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.full = kit.sparks && kit.dust && kit.marks && kit.debris ? kit as VfxKit : undefined;
    this.rings = new PressureBatch(scene, 'rings', pressureRibbon(), ALL_MIGHT_PRESSURE_LIMITS.rings, true);
    this.gusts = new PressureBatch(scene, 'gusts', new THREE.IcosahedronGeometry(1, 1), ALL_MIGHT_PRESSURE_LIMITS.gusts, false);
    this.debris = new PressureBatch(scene, 'debris', new THREE.IcosahedronGeometry(1, 0), ALL_MIGHT_PRESSURE_LIMITS.debris, false);
    this.batches = [this.rings, this.gusts, this.debris];
  }
  load(ids: readonly string[]): Promise<void> {
    const wanted = !this.disposed && ids.some(isAllMightPressure);
    if (wanted && !this.stage) this.stage = MoveStage.for(this.scene, this.kit);
    else if (!wanted && this.stage) { this.stage.release(); this.stage = undefined; }
    return Promise.resolve();
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isAllMightPressure(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'confirm' && event.kind !== 'hit') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenTime[i] === event.serverTime) return;
    const slot = this.eventCursor++ % this.seen.length; this.seen[slot] = event.id; this.seenTime[slot] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined;
    const seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot === 'ultimate' && !event.branch && event.targetId)
        Object.assign(this.finishers[this.finisherCursor++ % this.finishers.length], { actor: event.actorId, target: event.targetId, seq, finalHit: false });
      return;
    }
    if (!victim && !event.endpoint) return;
    const final = event.slot === 'ultimate' && !event.branch && event.contactIndex === 2;
    const impact = this.impacts[this.impactCursor++ % this.impacts.length];
    Object.assign(impact, { actor: event.actorId, born: event.serverTime, final, seed: event.id });
    if (victim) bodyCentre(victim, impact.point); else impact.point.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    if (final) {
      for (const record of this.finishers) if (record.actor === event.actorId && record.target === event.targetId && record.seq === seq) {
        record.finalHit = true; record.endpoint.copy(impact.point); record.floor = blowFloor(actor, victim, 0);
      }
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.52, impact.point);
    }
    if (this.stage && !armoryDraws(event.fighter, event.slot, event.branch, event.actorId)) this.land(this.stage, event, impact.point, actor, victim, final);
  }
  private land(st: MoveStage, e: CombatEvent, point: THREE.Vector3, actor: Fighter | undefined, victim: Fighter | undefined, final: boolean) {
    const kit = this.full, t = e.serverTime, dir = this.heading, yaw = actor?.state.yaw ?? actor?.group.rotation.y ?? 0;
    const floor = blowFloor(actor, victim, point.y - 1.05), ground = this.ground.set(point.x, floor, point.z);
    if (actor) dir.subVectors(point, actor.group.position).setY(0);
    if (!actor || dir.lengthSq() < .01) dir.set(Math.sin(yaw), 0, Math.cos(yaw));
    dir.normalize();
    if (e.slot === 'light') { st.burst(point, PRESSURE, .45, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1, cross = this.crosses[this.crossCursor++ % this.crosses.length];
      cross.p.copy(point); cross.yaw = yaw; cross.born = t; cross.life = .42; cross.size = 2.4 * big; cross.live = true;
      st.burst(point, PLUS, big, t, { dir, floor, clean: true });
      st.dome(this.c.copy(point).addScaledVector(dir, .8), PRESSURE, 1.6 * big, t, .36);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, PLUS, 2, t, { floor }); st.dome(point, PRESSURE, 3, t, .45); st.shock(ground, PRESSURE, 5, t, .45); this.dust(ground, 1, 5, t + .05, e.id); return; }
      const big = e.branch ? .7 : 1;
      st.burst(point, PLUS, 1.7 * big, t, { dir, floor });
      st.dome(point, PRESSURE, 3.4 * big, t, .5);
      st.erupt(this.c.copy(point).addScaledVector(dir, .5), this.d.copy(dir).setY(.08).normalize(), PRESSURE, .5 * big, 6.5 * big, t, .42);
      st.shock(ground, PRESSURE, 6.5 * big, t, .5);
      if (kit && kit.quality !== 'low') for (let i = 0; i < 3; i++) kit.marks.mark(MARK.crack, ground.x + dir.x * (.8 + i * 1.7), floor, ground.z + dir.z * (.8 + i * 1.7), 0, 1, 0, 2.2 - i * .4, t + .04 * i, 2.8);
      this.dust(this.c.copy(ground).addScaledVector(dir, 1.6), .9 * big, 6, t + .05, e.id, dir);
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      st.burst(point, PLUS, e.contactIndex ? 1.3 : 1, t, { dir, floor, clean: true });
      st.dome(this.c.copy(point).addScaledVector(dir, .6), PRESSURE, e.contactIndex ? 2 : 1.5, t, .36);
      if (e.contactIndex) st.shock(ground, PRESSURE, 5, t, .45);
      return;
    }
    st.burst(point, PLUS, 2.4, t, { dir, floor });
    st.dome(point, PRESSURE, 6, t, .55);
    st.erupt(ground, UP, PRESSURE, 1.2, 12, t + .04, .7);
    st.shock(ground, PRESSURE, 11, t, .65);
    st.shock(ground, PRESSURE, 6.5, t + .14, .5);
    if (!kit) return;
    for (let i = 0; i < 5; i++) {
      const ang = i * 1.2566 + yaw + .5, r = 2.6 + hash(i + e.id); this.c.set(ground.x + Math.cos(ang) * r, floor, ground.z + Math.sin(ang) * r);
      kit.debris.burst(kit.n(6, 2), this.c.x, floor, this.c.z, 0, 1, 0, 8.5, .8, .15, floor, 2.2);
      if (kit.quality !== 'low') kit.marks.mark(MARK.crack, this.c.x, floor, this.c.z, 0, 1, 0, 2.6, t + .05, 3);
    }
    this.dust(ground, 1.6, 9, t + .08, e.id);
  }
  private dust(ground: THREE.Vector3, size: number, count: number, born: number, seed: number, away?: THREE.Vector3) {
    const kit = this.full; if (!kit) return;
    const base = away ? Math.atan2(away.z, away.x) : 0;
    for (let i = 0, n = kit.n(count, 2); i < n; i++) {
      const ang = away ? base + (hash(i * 2.3 + seed) - .5) * 2 : i * 2.399963 + seed, r = size * (away ? .6 + hash(i + seed) : 1.3 + .8 * hash(i + seed)), v = 1.8 + 2.2 * hash(i * 3.3 + seed);
      kit.smoke(ground.x + Math.cos(ang) * r, ground.y + size * (.3 + .3 * hash(i * 1.9 + seed)), ground.z + Math.sin(ang) * r, Math.cos(ang) * v, .5 + .8 * hash(i * 5.1 + seed), Math.sin(ang) * v, size * (.8 + .5 * hash(i * 7.7 + seed)), born + .03 * i, .8 + .4 * hash(i + 2.2));
    }
  }
  private stroke(st: MoveStage, p: THREE.Vector3, yaw: number, roll: number, size: number, fade: number) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll), parts = 7;
    for (let i = 0; i < parts; i++) {
      const u0 = i / parts * 2 - 1, u1 = (i + 1) / parts * 2 - 1, b0 = (1 - u0 * u0) * size * .18, b1 = (1 - u1 * u1) * size * .18, thick = 1 - Math.abs(u0 + u1) * .5;
      this.b.set(p.x + cy * (u0 * size * cr - b0 * sr), p.y + u0 * size * sr + b0 * cr, p.z - sy * (u0 * size * cr - b0 * sr));
      this.c.set(p.x + cy * (u1 * size * cr - b1 * sr), p.y + u1 * size * sr + b1 * cr, p.z - sy * (u1 * size * cr - b1 * sr));
      st.streak(this.b, this.c, size * .07 * thick + .02, PRESSURE.main, .85 * fade); st.streak(this.b, this.c, size * .02 * thick + .008, PRESSURE.core, 1.2 * fade);
    }
  }
  private cancel(id: string, targetToo = false) {
    for (const record of this.finishers) if (record.actor === id || targetToo && record.target === id && !record.finalHit) record.actor = '';
    for (const impact of this.impacts) if (impact.actor === id) impact.actor = '';
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    for (const batch of this.batches) batch.begin(time);
    const detail = this.kit.budget >= .65;
    if (!this.stage) for (const f of fighters.values()) if (isAllMightPressure(f.state.fighter)) { this.stage = MoveStage.for(this.scene, this.kit); break; }
    const st = this.stage?.open(time);
    for (const fighter of fighters.values()) {
      const s = fighter.state;
      if (!isAllMightPressure(s.fighter) || !s.alive) continue;
      const elapsed = s.actionTime * s.actionDuration;
      if (s.action === 'awaken') this.awakening(fighter, elapsed, detail);
      if (st && s.whiffedAt === undefined && (s.action === 'light' || s.action === 'heavy' || s.action === 'special' || s.action === 'ultimate') && !armoryDraws('all-might', s.action, s.branch, s.id)) this.windup(st, fighter, elapsed);
      if (s.action === 'special' && !s.branch && s.whiffedAt === undefined && elapsed < ALL_MIGHT_MOVES.special.contacts[0]) {
        const k = clamp(elapsed / ALL_MIGHT_MOVES.special.contacts[0]);
        this.direction.set(Math.sin(fighter.group.rotation.y), 0, Math.cos(fighter.group.rotation.y)); this.q.setFromUnitVectors(FRONT, this.direction);
        this.rings.add(fighter.handR, this.q, .12 + k * .22, .12 + k * .22, 1, WHITE, k * .75);
        this.p.copy(fighter.handR).addScaledVector(this.direction, -.1);
        this.rings.add(this.p, this.q, .08 + k * .16, .08 + k * .16, 1, GOLD, k * .7);
      }
    }
    for (const flight of flights.values()) {
      if (!isAllMightPressure(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released) continue;
      this.q.setFromUnitVectors(FRONT, flight.heading);
      for (let i = 0; i < (detail ? 4 : 2); i++) {
        this.p.copy(flight.position).addScaledVector(flight.heading, -.36 * i); const radius = .5 - .085 * i;
        this.rings.add(this.p, this.q, radius, radius, 1, i === 0 ? WHITE : i === 1 ? GOLD : BLUE, .9 - .14 * i);
      }
      if (!st || armoryDraws('all-might', 'special', undefined, flight.actorId)) continue;
      st.glow(flight.position, 1.2, PRESSURE.main, .7); st.glow(flight.position, .45, PRESSURE.core, 1);
      for (let i = 0; i < 4; i++) { this.p.copy(flight.position).addScaledVector(flight.heading, -i * .9); st.glow(this.p, .8 + i * .42, i % 2 ? PLUS.main : PRESSURE.core, .95 - i * .18, RING, .05, 0, .86); }
      this.c.set(flight.heading.z, 0, -flight.heading.x);
      for (let i = 0; i < 6; i++) {
        const ang = i * 1.047 + (flight.since ?? 0), off = .5 + .25 * hash(i * 3.1);
        this.b.copy(flight.position).addScaledVector(this.c, Math.cos(ang) * off); this.b.y += Math.sin(ang) * off;
        this.d.copy(this.b).addScaledVector(flight.heading, -2.2 - 1.4 * hash(i * 5.7)).addScaledVector(this.c, Math.cos(ang) * .5); this.d.y += Math.sin(ang) * .5;
        st.streak(this.b, this.d, .035, PRESSURE.main, .7);
      }
      st.light(this.p.copy(flight.position).setY(flight.position.y + .2), 7.5, PRESSURE, .7);
    }
    if (st) for (const cross of this.crosses) {
      if (!cross.live) continue;
      const age = time - cross.born;
      if (age >= cross.life) { cross.live = false; continue; }
      if (age < 0) continue;
      const w = age / cross.life, fade = w < .4 ? 1 : 1 - (w - .4) / .6;
      this.stroke(st, cross.p, cross.yaw, .78, cross.size, fade); if (age > .04) this.stroke(st, cross.p, cross.yaw, -.78, cross.size, fade);
      st.light(cross.p, 1.6 + cross.size, PLUS, .3 * (1 - w));
    }
    for (const record of this.finishers) {
      if (!record.actor) continue;
      const actor = fighters.get(record.actor), victim = fighters.get(record.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !record.finalHit || s.action !== 'ultimate' || s.branch ||
        s.actionSeq !== record.seq || s.whiffedAt !== undefined) { record.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (st && !record.finalHit && elapsed < ULT.contacts[2] && !armoryDraws('all-might', 'ultimate', undefined, record.actor)) this.smash(st, actor, record, elapsed, time);
      if (elapsed < ALL_MIGHT_ULTIMATE_BEATS.gather) continue;
      if (elapsed > ALL_MIGHT_ULTIMATE_BEATS.end) { record.actor = ''; continue; }
      if (elapsed < ALL_MIGHT_ULTIMATE_BEATS.release) {
        const charge = clamp((elapsed - ALL_MIGHT_ULTIMATE_BEATS.gather) / (ALL_MIGHT_ULTIMATE_BEATS.release - ALL_MIGHT_ULTIMATE_BEATS.gather));
        this.q.setFromAxisAngle(UP, time * 5); this.rings.add(actor.handR, this.q, .18 + charge * .16, .18 + charge * .16, 1, GOLD, charge * .8);
        this.p.copy(actor.handR); this.q.identity(); this.gusts.add(this.p, this.q, .055, .12, .055, WHITE, charge * .5);
      } else if (record.finalHit) {
        const k = clamp((elapsed - ALL_MIGHT_ULTIMATE_BEATS.release) / .62), fade = (1 - k) * .85;
        this.a.copy(record.endpoint); this.a.y = record.floor + .06;
        for (let i = 0; i < (detail ? 7 : 4); i++) {
          const h = i / 7, radius = 1.2 + h * 1.9 + k * 2.6;
          this.p.copy(this.a); this.p.y += .5 + h * 4.6; this.q.setFromAxisAngle(UP, time * 7 + i * 1.45).multiply(this.flat);
          this.rings.add(this.p, this.q, radius, radius, 2.4, i % 4 === 0 ? GOLD : WHITE, fade * (1 - h * .6));
        }
        this.rings.add(this.a, this.flat, 1 + k * 2.8, 1 + k * 2.8, .08, WHITE, fade);
        const burst = clamp(1 - k / .42);
        if (burst > 0) {
          this.direction.subVectors(record.endpoint, actor.handR); const length = Math.min(3, this.direction.length());
          if (length > .05) {
            this.direction.normalize(); this.p.copy(actor.handR).addScaledVector(this.direction, length * .5);
            this.q.setFromUnitVectors(UP, this.direction); this.gusts.add(this.p, this.q, .13 + k * .24, length * .5, .13 + k * .24, WHITE, burst * .8);
          }
          for (let i = 0; i < (detail ? 5 : 3); i++) {
            const angle = i * 2.4 + time * .5; this.p.copy(record.endpoint); this.p.x += Math.sin(angle) * k * 1.3; this.p.z += Math.cos(angle) * k * 1.3; this.p.y += Math.sin(angle * 1.7) * .18;
            this.q.setFromAxisAngle(UP, angle); const size = .16 + k * .8;
            this.gusts.add(this.p, this.q, size, size * .72, size, i % 2 ? WHITE : GOLD, burst * .3);
          }
        }
      }
    }
    for (const impact of this.impacts) {
      if (!impact.actor) continue;
      const age = time - impact.born, life = impact.final ? .7 : .34;
      if (age < 0) continue;
      if (age > life) { impact.actor = ''; continue; }
      const k = age / life;
      this.q.identity(); this.rings.add(impact.point, this.q, .2 + k * (impact.final ? 1.4 : .7), .2 + k * .7, 1, GOLD, (1 - k) * .65);
      if (detail) for (let i = 0; i < (impact.final ? 9 : 4); i++) {
        const angle = i * 2.399 + impact.seed * .71;
        this.p.copy(impact.point); this.p.x += Math.sin(angle) * k * 1.4; this.p.z += Math.cos(angle) * k * 1.4; this.p.y += Math.sin(k * Math.PI) * .6;
        this.q.setFromAxisAngle(UP, angle + time); this.debris.add(this.p, this.q, .035, .09, .035, i % 2 ? WHITE : STONE, (1 - k) * .7);
      }
    }
    for (const batch of this.batches) batch.end(); st?.close();
  }
  private windup(st: MoveStage, f: Fighter, elapsed: number) {
    const s = f.state, seed = (s.actionSeq ?? 0) * 7.3, yaw = s.yaw ?? f.group.rotation.y, heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
    if (s.action === 'light') {
      const k = Math.sin(clamp(s.actionTime) * Math.PI);
      for (let i = 0; i < 3; i++) { this.b.copy(f.handR).addScaledVector(heading, .1); this.b.y += (i - 1) * .12; st.streak(this.b, this.c.copy(this.b).addScaledVector(heading, .5 + .5 * k), .03, PRESSURE.main, .8 * k); }
      st.light(f.handR, 1.8, PRESSURE, .16 * k);
    } else if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .52 : HEAVY.contacts[0];
      if (elapsed >= contact && elapsed < contact + .2) {
        const flare = 1 - (elapsed - contact) / .2; this.d.copy(f.handR).lerp(f.handL, .5).addScaledVector(heading, .5);
        this.stroke(st, this.d, yaw, .78, 1.3, flare); this.stroke(st, this.d, yaw, -.78, 1.3, flare); st.light(this.d, 2.6, PRESSURE, .3 * flare);
      }
    } else if (s.action === 'special' && !s.branch) {
      if (elapsed < SPECIAL.contacts[0]) st.charge(f.handR, PRESSURE, .34, elapsed / SPECIAL.contacts[0], seed);
    } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .1) st.charge(f.handR, PLUS, .26, elapsed / ULT.contacts[0], seed);
  }
  private smash(st: MoveStage, actor: Fighter, record: Finisher, elapsed: number, time: number) {
    const g = clamp((elapsed - ULT.contacts[0]) / (ULT.contacts[2] - ULT.contacts[0])), feet = actor.group.position, seed = record.seq * 3.3;
    st.dim(.3 + .45 * g, record.actor, record.target);
    for (let i = 0, n = this.kit.budget >= .65 ? 5 : 3; i < n; i++) {
      const h = i / 5, radius = 1.9 + h * 1.1 + g * .6;
      this.p.copy(feet); this.p.y += .3 + h * (1.6 + 1.8 * g); this.q.setFromAxisAngle(UP, time * (4 + 3 * g) + i * 1.9).multiply(this.flat);
      this.rings.add(this.p, this.q, radius, radius, 1.6, i % 3 === 0 ? GOLD : WHITE, (.35 + .4 * g) * (1 - h * .4));
    }
    st.light(this.p.copy(feet).setY(feet.y + .7), 4 + 1.6 * g, PRESSURE, .28 + .22 * g);
    st.charge(actor.handR, PLUS, .22 + .2 * g, Math.max(.4, g), seed);
    if (st.tick && Math.floor(time * 30) % 4 === 0 && this.full) { const ang = hash(time * 5.3 + seed) * Math.PI * 2; this.full.puff(feet.x + Math.cos(ang) * 2.6, feet.y + .15, feet.z + Math.sin(ang) * 2.6, -Math.sin(ang) * 3, .5, Math.cos(ang) * 3, .5, time, .45, .5); }
    if (g > .75) st.speed(.55 * (g - .75) / .25, record.actor, record.target);
  }
  private awakening(fighter: Fighter, elapsed: number, detail: boolean) {
    const beats = ALL_MIGHT_AWAKENING.beats;
    if (elapsed < beats.gather || elapsed > ALL_MIGHT_AWAKENING.runtimeDuration) return;
    const release = elapsed >= beats.release;
    const k = release ? clamp((elapsed - beats.release) / .36) : clamp((elapsed - beats.gather) / (beats.release - beats.gather));
    const fade = release ? 1 - k : k * .55;
    const base = fighter.group.position;
    for (let i = 0; i < (detail ? 6 : 3); i++) {
      const angle = i * Math.PI / 3 + fighter.group.rotation.y;
      const rise = (elapsed * 1.8 + i * .13) % .6;
      this.p.copy(base); this.p.x += Math.sin(angle) * (.42 + rise * .12) + Math.sin(elapsed * 8 + i) * .025;
      this.p.z += Math.cos(angle) * (.3 + rise * .08);
      this.p.y += 1.12 + rise;
      this.q.setFromAxisAngle(FRONT, Math.sin(elapsed * 5 + i * 1.8) * .28);
      this.gusts.add(this.p, this.q, .026 + rise * .03, .105 + rise * .09, .029, WHITE, fade * .24);
    }
    if (release) {
      this.p.copy(base); this.p.y += .05;
      this.rings.add(this.p, this.flat, .65 + k * 2.1, .65 + k * 2.1, .06, GOLD, fade * .85);
      this.p.y += .08; this.rings.add(this.p, this.flat, .5 + k * 1.7, .5 + k * 1.7, .06, WHITE, fade * .7);
    }
  }
  reset() {
    for (const record of this.finishers) record.actor = '';
    for (const impact of this.impacts) impact.actor = '';
    this.seen.fill(-1); this.seenTime.fill(-1); this.eventCursor = this.finisherCursor = this.impactCursor = 0;
    for (const cross of this.crosses) cross.live = false;
    for (const batch of this.batches) { batch.begin(0); batch.end(); }
    this.stage?.reset();
  }
  dispose() { if (this.disposed) return; this.disposed = true; for (const batch of this.batches) batch.dispose(); this.stage?.release(); this.stage = undefined; }
}
