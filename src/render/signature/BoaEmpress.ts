import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AttackSlot, CombatEvent } from '../../game/types';
import { MOVES, RUSH } from '../../game/moves';
import { comboMove } from '../../game/combos';
import { BOA_HANCOCK_MOVES } from '../../game/fighters/boa-hancock';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { BURN, MoveStage, SHEEN, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const BOA_EMPRESS_ASSETS: readonly string[] = Object.freeze([]);
export const BOA_EMPRESS_BEATS = Object.freeze({ opener: .42, leap: 1.05, heel: 1.86, flourish: .38 });
export const BOA_EMPRESS_LIMITS = Object.freeze({ hearts: 96, contours: 96, arrows: 96, stones: 192, haki: 96, shells: 8, impacts: 24 });
export const isBoaEmpress = (id: string | undefined) => id === 'boa-hancock';

const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(0, 0, 1);
const PINK = new THREE.Color(2, .5, 1.1), PEARL = new THREE.Color(2.2, 1.9, 2);
export const LOVE: StageLook = stageLook(0xffe5ef, 0xe54b94, 0x5a0f33);
const PETRIFIED: StageLook = stageLook(0xf4f0ea, 0xbdb6bc, 0x3a3438);
const ROSE = new THREE.Color(1.05, .16, .5);
const FLOOR: StageLook = { ...LOVE, main: ROSE, light: new THREE.Color(.75, .3, .5) };
const HEAVY = BOA_HANCOCK_MOVES.heavy, SPECIAL = BOA_HANCOCK_MOVES.special, ULT = BOA_HANCOCK_MOVES.ultimate, FINAL = ULT.contacts.length - 1;
type Gather = { actor: string; target: string; seq: number; floor: number; final: boolean };
const STONE = new THREE.Color(0xc5c3d0), SHADE = new THREE.Color(0x666071), INK = new THREE.Color(0x231322);
const TAU = Math.PI * 2;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const attacking = (action: string) => action === 'light' || action === 'heavy' || action === 'special' || action === 'ultimate';
const handOrigin = new THREE.Vector3(), forearmOrigin = new THREE.Vector3();

export function boaFingertip(fighter: Fighter, out: THREE.Vector3): THREE.Vector3 {
  const hand = fighter.joints?.get('RightHand');
  if (hand?.parent) {
    hand.getWorldPosition(handOrigin); hand.parent.getWorldPosition(forearmOrigin);
    out.copy(handOrigin).sub(forearmOrigin);
    if (out.lengthSq() > 1e-8) return out.normalize().multiplyScalar(.10).add(handOrigin);
    return out.copy(handOrigin);
  }
  return out.copy(fighter.handR);
}

export function boaHeelContact(fighter: Fighter, index: number, out: THREE.Vector3): boolean {
  if (!isBoaEmpress(fighter.state.fighter)) return false;
  const s = fighter.state;
  const drop = s.branch === 'lllh' || s.branch === 'airSpecial' ||
    s.action === 'ultimate' && index > 0 || s.action === 'light' && (s.chain ?? 0) >= (s.grounded ? 3 : 2);
  const foot = fighter.joints?.get(drop ? 'RightFoot' : 'LeftFoot');
  if (!foot) return false;
  foot.getWorldPosition(out); return true;
}

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -.5);
  s.bezierCurveTo(-.16, -.31, -.53, -.02, -.51, .23);
  s.bezierCurveTo(-.49, .57, -.13, .61, 0, .34);
  s.bezierCurveTo(.13, .61, .49, .57, .51, .23);
  s.bezierCurveTo(.53, -.02, .16, -.31, 0, -.5);
  return s;
}
function solid(shape: THREE.Shape, depth = .032) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
  return g.translate(0, 0, -depth / 2);
}
function contourGeometry() {
  const points = heartShape().getPoints(12).map(p => new THREE.Vector3(p.x, p.y, 0));
  points.pop();
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, 'centripetal'), 56, .025, 4, true);
}
function arrowGeometry() {
  const shaft = new THREE.Shape();
  shaft.moveTo(-.018, -.52); shaft.lineTo(-.11, -.64); shaft.lineTo(-.10, -.45);
  shaft.lineTo(-.018, -.35); shaft.lineTo(-.018, .33); shaft.lineTo(.018, .33);
  shaft.lineTo(.018, -.35); shaft.lineTo(.10, -.45); shaft.lineTo(.11, -.64);
  shaft.lineTo(.018, -.52); shaft.closePath();
  const a = solid(shaft), b = solid(heartShape()).scale(.28, .28, 1).rotateZ(Math.PI).translate(0, .38, 0);
  const merged = mergeGeometries([a, b])!; a.dispose(); b.dispose(); return merged;
}
function hakiGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-.015, -.5); s.bezierCurveTo(.16, -.08, -.21, .17, .09, .60);
  s.bezierCurveTo(-.37, .20, -.035, -.11, -.015, -.5);
  return solid(s, .018);
}

class EmpressBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private tint: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D();
  count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, readonly capacity: number, faceted = false) {
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('empressTint', this.tint);
    const material = new THREE.ShaderMaterial({ name: 'BoaEmpressCel', transparent: true, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false,
      uniforms: { faceted: { value: faceted ? 1 : 0 } },
      vertexShader: `attribute vec4 empressTint;varying vec4 vTint;varying float vFace;
        void main(){vTint=empressTint;vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
        vFace=dot(n,normalize(vec3(-.4,.8,.6)));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float faceted;varying vec4 vTint;varying float vFace;
        void main(){if(vTint.a<.003)discard;float cel=vFace>.3?1.:(vFace>-.25?.76:.48);
        gl_FragColor=vec4(vTint.rgb*mix(1.,cel,faceted),vTint.a);}`,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = `boa-empress-${name}`; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.renderOrder = 3;
    this.object.scale.setScalar(0); this.object.updateMatrix();
    this.mesh.setMatrixAt(0, this.object.matrix); this.mesh.count = 1; scene.add(this.mesh);
  }
  begin() { this.count = 0; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, color: THREE.Color, opacity = 1) {
    if (this.count >= this.capacity || opacity <= .003 || x <= 0 || y <= 0 || z <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix);
    this.tint.setXYZW(this.count++, color.r, color.g, color.b, Math.min(1, opacity));
  }
  end() {
    this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.tint.needsUpdate = true;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

type Shell = { actor: string; target: string; seq: number; born: number; held: boolean };
type Impact = { actor: string; seq: number; born: number; seed: number; stone: boolean; big: boolean; yaw: number; p: THREE.Vector3 };

export class BoaEmpress {
  private stage?: MoveStage;
  private gathers: Gather[] = Array.from({ length: 6 }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false }));
  private gatherCursor = 0; private blow = new THREE.Vector3(); private ground = new THREE.Vector3(); private heel = new THREE.Vector3(); private b = new THREE.Vector3();
  private hearts: EmpressBatch;
  private contours: EmpressBatch;
  private arrows: EmpressBatch;
  private stones: EmpressBatch;
  private haki: EmpressBatch;
  private batches: EmpressBatch[];
  private shells: Shell[] = Array.from({ length: BOA_EMPRESS_LIMITS.shells }, () => ({ actor: '', target: '', seq: -1, born: -1e9, held: false }));
  private impacts: Impact[] = Array.from({ length: BOA_EMPRESS_LIMITS.impacts }, () => ({ actor: '', seq: -1, born: -1e9, seed: 0, stone: false, big: false, yaw: 0, p: new THREE.Vector3() }));
  private shellCursor = 0;
  private impactCursor = 0;
  private eventCursor = 0;
  private seen = new Float64Array(128).fill(-1);
  private seenAt = new Float64Array(128).fill(-1);
  private disposed = false;
  private p = new THREE.Vector3();
  private a = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private roll = new THREE.Quaternion();
  constructor(private scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.hearts = new EmpressBatch(scene, 'hearts', solid(heartShape()), BOA_EMPRESS_LIMITS.hearts);
    this.contours = new EmpressBatch(scene, 'heart-contours', contourGeometry(), BOA_EMPRESS_LIMITS.contours);
    this.arrows = new EmpressBatch(scene, 'slave-arrows', arrowGeometry(), BOA_EMPRESS_LIMITS.arrows);
    this.stones = new EmpressBatch(scene, 'stone', new THREE.IcosahedronGeometry(1, 0), BOA_EMPRESS_LIMITS.stones, true);
    this.haki = new EmpressBatch(scene, 'regal-ink', hakiGeometry(), BOA_EMPRESS_LIMITS.haki, true);
    this.batches = [this.hearts, this.contours, this.arrows, this.stones, this.haki];
  }
  load(ids: readonly string[]): Promise<void> {
    if (!this.disposed) { if (ids.some(isBoaEmpress)) this.stage ??= MoveStage.for(this.scene, this.kit); else if (this.stage) { this.stage.release(); this.stage = undefined; } }
    return Promise.resolve();
  }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') {
      this.cancel(event.actorId, true); return;
    }
    if (!isBoaEmpress(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'hit' && event.kind !== 'confirm') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenAt[i] === event.serverTime) return;
    const seen = this.eventCursor++ % this.seen.length; this.seen[seen] = event.id; this.seenAt[seen] = event.serverTime;
    const actor = fighters?.get(event.actorId), target = event.targetId ? fighters?.get(event.targetId) : undefined;
    const seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot !== 'ultimate' || event.branch || !event.targetId) return;
      Object.assign(this.gathers[this.gatherCursor++ % this.gathers.length], { actor: event.actorId, target: event.targetId, seq, final: false, floor: blowFloor(actor, target, 0) });
      const shell = this.shells[this.shellCursor++ % this.shells.length];
      Object.assign(shell, { actor: event.actorId, target: event.targetId, seq, born: event.serverTime, held: true });
      return;
    }
    const big = event.slot === 'ultimate' && !event.branch && (event.contactIndex ?? 0) > 0;
    const stone = event.slot === 'heavy' || event.slot === 'special' || big || !!event.branch || (event.chain ?? 0) > 0;
    if (big) for (const shell of this.shells) if (shell.actor === event.actorId && shell.seq === seq) shell.actor = '';
    if (!event.endpoint && !target) return;
    const impact = this.impacts[this.impactCursor++ % this.impacts.length];
    Object.assign(impact, { actor: event.actorId, seq, born: event.serverTime, seed: event.id, stone, big, yaw: actor?.group.rotation.y ?? 0 });
    if (target) bodyCentre(target, impact.p);
    else impact.p.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    if (stone && !big && event.slot !== 'ultimate' && event.targetId) {
      const shell = this.shells[this.shellCursor++ % this.shells.length];
      Object.assign(shell, { actor: event.actorId, target: event.targetId, seq, born: event.serverTime, held: false });
    }
    if (big && involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.45, impact.p);
    this.land(event, actor, target, impact.p, seq);
  }
  private land(event: CombatEvent, actor: Fighter | undefined, victim: Fighter | undefined, point: THREE.Vector3, seq: number) {
    const st = this.stage; if (!st) return;
    const t = event.serverTime, big = actor?.state.awakened ? 1.15 : 1, dir = this.blow;
    let floor = blowFloor(actor, victim, point.y - 1);
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (event.slot === 'light') { st.burst(point, LOVE, .42, t, { dir, floor, clean: true }); return; }
    if (event.slot === 'heavy') {
      const last = !!event.branch || (event.contactIndex ?? 0) >= HEAVY.contacts.length - 1, k = (event.branch ? .85 : 1) * big;
      st.burst(point, LOVE, (last ? .85 : .5) * k, t, { dir, floor, clean: !last });
      if (last) { st.shatter(point, dir, PETRIFIED, 2.4 * k, t, .4); st.shock(ground, LOVE, 4.2 * k, t, .42); }
      return;
    }
    if (event.slot === 'special') {
      if (event.branch === 'airSpecial') { st.burst(point, LOVE, 2, t, { floor }); st.shock(ground, LOVE, 4.5, t, .45); st.scar(ground, FLOOR, 2.4, t + .05, 1.8); return; }
      const k = (event.branch ? .6 : 1) * big;
      st.burst(point, LOVE, 1.9 * k, t, { dir, floor });
      st.shatter(point, dir, PETRIFIED, 3 * k, t, .55);
      st.shock(ground, LOVE, 5 * k, t, .45);
      st.scar(ground, FLOOR, 2.3 * k, t + .05, 2);
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    if ((event.contactIndex ?? 0) < FINAL) { st.burst(point, LOVE, 1, t, { dir, floor }); return; }
    let confirmed = false;
    for (const g of this.gathers) if (g.actor === event.actorId && g.seq === seq) { g.final = true; floor = g.floor; confirmed = true; }
    if (!confirmed) return;
    ground.y = floor;
    st.shatter(point, dir, PETRIFIED, 7, t, .7);
    st.dome(point, LOVE, 4.6, t, .45);
    st.erupt(ground, UP, LOVE, .8, 9, t + .03, .5);
    st.burst(point, LOVE, 2.2, t, { dir, floor });
    st.shock(ground, LOVE, 9.5, t, .6);
    st.scar(ground, FLOOR, 3, t + .1, 2);
  }
  private cancel(id: string, targetToo = false) {
    for (const g of this.gathers) if (g.actor === id || targetToo && g.target === id && !g.final) g.actor = '';
    for (const shell of this.shells) if (shell.actor === id || targetToo && shell.target === id) shell.actor = '';
    for (const impact of this.impacts) if (impact.actor === id) impact.actor = '';
  }
  private heart(p: THREE.Vector3, q: THREE.Quaternion, scale: number, alpha: number, fill = .28) {
    this.hearts.add(p, q, scale, scale, scale, PINK, alpha * fill);
    this.contours.add(p, q, scale, scale, scale, PEARL, alpha);
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    for (const batch of this.batches) batch.begin();
    const budget = clamp(this.kit.budget), detail = budget >= .65;
    let st = this.stage?.open(time);
    for (const fighter of fighters.values()) {
      const s = fighter.state;
      if (!isBoaEmpress(s.fighter) || !s.alive) continue;
      st ??= (this.stage = MoveStage.for(this.scene, this.kit)).open(time);
      const age = s.actionTime * s.actionDuration, yaw = fighter.group.rotation.y;
      this.forward.set(Math.sin(yaw), 0, Math.cos(yaw)); this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      this.q.setFromAxisAngle(UP, yaw);
      if (s.action === 'awaken') this.flourish(fighter, age, s.actionDuration);
      if (s.awakened) this.regalia(fighter, time, (s.action === 'awaken' ? clamp((age - .38) / .30) : 1) *
        (s.awakenedUntil === undefined ? 1 : clamp(s.awakenedUntil - time)), detail);
      const kiss = s.action === 'light' && !s.branch && !(s.chain ?? 0);
      const volley = s.action === 'special' && (!s.branch || s.branch === 'llls');
      const move = !attacking(s.action) ? undefined : s.branch ? comboMove(s.fighter, s.branch, s.awakened) :
        s.action === 'light' && (s.chain ?? 0) > 0 ? RUSH[s.fighter]?.[(s.chain ?? 1) - 1] :
        (MOVES[s.fighter] ?? BOA_HANCOCK_MOVES)[s.action as AttackSlot];
      const release = move?.contacts[0] ?? (kiss ? .19 : .54);
      if ((kiss || volley) && age < release && s.whiffedAt === undefined) {
        boaFingertip(fighter, this.p);
        const k = clamp(age / release);
        this.heart(this.p, this.q, (kiss ? .12 : .34) * (.6 + k * .4), .65 + k * .3, .12);
        if (kiss) { st.glow(this.p, .26, LOVE.main, .5 * k); st.light(this.p, 2, LOVE, .2 * k); }
        else if (!s.branch) { st.charge(this.p, LOVE, .36 * (s.awakened ? 1.15 : 1), k, (s.actionSeq ?? 0) * 5.3); st.disc(this.a.copy(fighter.group.position), 1.6 + 1.6 * k, ROSE, .5 * k, SHEEN, 1, s.actionSeq ?? 0); }
      }
      if (move?.style === 'melee' && s.whiffedAt === undefined) {
        const beats = move.contacts;
        for (let i = 0; i < beats.length; i++) {
          if (s.action === 'ultimate' && i > 0 && s.confirmedAt === undefined) continue;
          const distance = Math.abs(age - beats[i]);
          if (distance > .075) continue;
          if (!boaHeelContact(fighter, i, this.p)) continue;
          this.heart(this.p, this.q, .23 + .06 * (i > 0 ? 1 : 0), (1 - distance / .075) * .85, .08);
        }
        let near = 0; for (let i = 1; i < beats.length; i++) if (Math.abs(age - beats[i]) < Math.abs(age - beats[near])) near = i;
        if ((s.action !== 'ultimate' || near === 0 || s.confirmedAt !== undefined) && boaHeelContact(fighter, near, this.heel)) {
          const k = clamp(1 - Math.abs(age - beats[near]) / .22);
          if (k > .02) { st.glow(this.heel, .32, LOVE.main, .6 * k); st.glow(this.heel, .4, LOVE.core, .5 * k, STAR, .2, Math.floor(time * 24)); st.light(this.heel, 2.4, LOVE, .26 * k); }
        }
      }
    }
    for (const flight of flights.values()) {
      if (!isBoaEmpress(flight.fighter) || !flight.released) continue;
      if (flight.slot === 'light' && !flight.branch) {
        this.q.setFromUnitVectors(FRONT, flight.heading);
        this.heart(flight.position, this.q, .25, 1, .7);
        if (st) { st.glow(flight.position, .5, LOVE.main, .55); st.streak(this.a.copy(flight.position).addScaledVector(flight.heading, -.9), flight.position, .06, LOVE.main, .7); st.light(flight.position, 2.6, LOVE, .3); }
        if (detail) {
          this.p.copy(flight.position).addScaledVector(flight.heading, -.24);
          this.contours.add(this.p, this.q, .16, .16, .16, PINK, .52);
        }
      } else if (flight.slot === 'special' && (!flight.branch || flight.branch === 'llls')) {
        this.q.setFromUnitVectors(UP, flight.heading);
        this.right.crossVectors(flight.heading, UP);
        if (this.right.lengthSq() < 1e-8) this.right.set(1, 0, 0); else this.right.normalize();
        const count = detail ? 5 : 3;
        for (let i = 0; i < count; i++) {
          const offset = i - (count - 1) / 2;
          this.p.copy(flight.position).addScaledVector(this.right, offset * .18).addScaledVector(flight.heading, -Math.abs(offset) * .12);
          this.p.y += Math.abs(offset) * .055;
          this.arrows.add(this.p, this.q, .85, .85, .85, i % 2 ? PINK : PEARL, .96);
          if (st) { st.streak(this.a.copy(this.p).addScaledVector(flight.heading, -2.2 + Math.abs(offset) * .3), this.p, .09, LOVE.main, .55); st.streak(this.a.copy(this.p).addScaledVector(flight.heading, -1.1), this.p, .03, LOVE.core, 1.4); }
        }
        if (st && (!flight.branch)) {
          const floor = (flight.actorId ? fighters.get(flight.actorId)?.group.position.y : undefined) ?? flight.position.y - 1.2;
          st.glow(flight.position, 1.25, LOVE.main, .45); st.glow(this.a.copy(flight.position).addScaledVector(flight.heading, .5), .42, LOVE.core, .8, STAR, .2, Math.floor(time * 24));
          st.light(this.a.copy(flight.position).setY(flight.position.y + .2), 6.2, LOVE, .9);
          st.light(this.a.copy(flight.position).addScaledVector(flight.heading, -3).setY(floor + .6), 4.5, LOVE, .45);
          st.disc(this.a.set(flight.position.x, floor, flight.position.z), 2.3, ROSE, .6, SHEEN, 1, flight.since);
        }
      }
    }
    for (const shell of this.shells) {
      if (!shell.actor) continue;
      const actor = fighters.get(shell.actor), target = fighters.get(shell.target), s = actor?.state;
      const age = s ? s.actionTime * s.actionDuration : 0, elapsed = time - shell.born;
      if (!s?.alive || !target?.state.alive || !attacking(s.action) || (s.actionSeq ?? -1) !== shell.seq || s.whiffedAt !== undefined ||
        (shell.held ? s.action !== 'ultimate' || age >= BOA_EMPRESS_BEATS.heel : elapsed >= .32)) { shell.actor = ''; continue; }
      if (elapsed < 0) continue;
      bodyCentre(target, this.a);
      const grow = shell.held ? clamp((age - BOA_EMPRESS_BEATS.opener) / .20) : clamp(elapsed / .055) * (1 - elapsed / .32);
      const count = shell.held && detail ? 8 : 4;
      const size = Math.min(1.5, Math.max(.65, target.state.size ?? 1));
      for (let i = 0; i < count; i++) {
        const angle = i * TAU / count + target.group.rotation.y;
        this.p.copy(this.a); this.p.x += Math.sin(angle) * .29 * size; this.p.z += Math.cos(angle) * .29 * size;
        this.p.y += ((i % 3) - 1) * .29 * size;
        this.q.setFromAxisAngle(UP, angle);
        this.stones.add(this.p, this.q, .17 * size * grow, .28 * size * grow, .065 * size, i % 2 ? STONE : SHADE, .68 * grow);
      }
    }
    for (const impact of this.impacts) {
      if (!impact.actor) continue;
      const s = fighters.get(impact.actor)?.state, age = time - impact.born, life = impact.big ? .44 : .26;
      if (!s?.alive || !attacking(s.action) || (s.actionSeq ?? -1) !== impact.seq || s.whiffedAt !== undefined || age >= life) { impact.actor = ''; continue; }
      if (age < 0) continue;
      const fade = 1 - age / life;
      this.q.setFromAxisAngle(UP, impact.yaw);
      this.heart(impact.p, this.q, (impact.big ? .58 : .22) + age * .7, fade, .1);
      if (!impact.stone) continue;
      const count = impact.big ? (detail ? 16 : 9) : (detail ? 6 : 3);
      for (let i = 0; i < count; i++) {
        const angle = i * 2.39996 + impact.seed * .41, spread = (impact.big ? 2.8 : 1.2) * age;
        this.p.copy(impact.p).add(this.a.set(Math.sin(angle) * spread, Math.cos(i * 1.7) * spread * .65 + .4 * age - 2 * age * age, Math.cos(angle) * spread));
        this.p.y = Math.max(.035, this.p.y); this.q.setFromAxisAngle(this.a.set(.3, 1, .2).normalize(), angle + age * 7);
        const size = (impact.big ? .10 : .055) * fade * (1 + (i % 3) * .25);
        this.stones.add(this.p, this.q, size, size * 1.65, size * .5, i % 2 ? STONE : SHADE, fade);
      }
    }
    for (const g of this.gathers) {
      if (!g.actor) continue;
      const actor = fighters.get(g.actor), victim = fighters.get(g.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !g.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== g.seq || s.whiffedAt !== undefined) { g.actor = ''; continue; }
      const age = s.actionTime * s.actionDuration;
      if (age > ULT.duration) { g.actor = ''; continue; }
      if (st && !g.final && age < ULT.contacts[FINAL]) this.gather(st, actor, g, age, time, detail);
    }
    for (const batch of this.batches) batch.end();
    st?.close();
  }
  private gather(st: MoveStage, actor: Fighter, g: Gather, age: number, time: number, detail: boolean) {
    const k = clamp((age - ULT.contacts[0]) / (ULT.contacts[FINAL] - ULT.contacts[0])), seed = g.seq * 3.7, feet = this.ground.copy(actor.group.position).setY(g.floor);
    st.dim(.3 + .4 * k, g.actor, g.target);
    st.disc(feet, (2.6 + 3.6 * k) * (.6 + .4 * k), ROSE, .75, BURN, .3 + .7 * k, seed);
    st.disc(feet, 3 + 3.6 * k, ROSE, .16 + .12 * k, SHEEN, 1, seed);
    for (let i = 0, n = detail ? 8 : 5; i < n; i++) {
      const phase = (time * .9 + i * .618) % 1, ang = i * Math.PI * 2 / n + seed + time * .3, r = 2 + .5 * Math.sin(i * 1.7);
      this.p.set(feet.x + Math.cos(ang) * r, g.floor + .3 + phase * (1.6 + 1.6 * k), feet.z + Math.sin(ang) * r);
      this.q.setFromAxisAngle(UP, ang + Math.PI / 2);
      const fade = Math.sin(Math.PI * phase);
      this.heart(this.p, this.q, .22 + .16 * k, fade * (.6 + .4 * k), .5);
      st.glow(this.p, .34 + .2 * k, LOVE.main, .4 * fade);
    }
    if (age >= BOA_EMPRESS_BEATS.leap - .2 && boaHeelContact(actor, FINAL, this.heel)) st.charge(this.heel, LOVE, .3 + .2 * k, clamp((age - BOA_EMPRESS_BEATS.leap + .2) / (BOA_EMPRESS_BEATS.heel - BOA_EMPRESS_BEATS.leap + .2)), seed);
    else { boaFingertip(actor, this.b); st.charge(this.b, LOVE, .26, Math.max(.4, k), seed); }
    if (k > .8) st.speed(.5 * (k - .8) / .2, g.actor, g.target);
  }
  private flourish(fighter: Fighter, age: number, duration: number) {
    const fade = clamp((duration - age) / .2);
    boaFingertip(fighter, this.p);
    const gather = clamp(age / BOA_EMPRESS_BEATS.flourish);
    if (age < .65) this.heart(this.p, this.q, .16 + gather * .22, fade * clamp((.65 - age) / .18), .1);
    if (age < .26 || age > .86) return;
    const t = (age - .26) / .6;
    bodyCentre(fighter, this.a);
    for (let i = 0; i < 7; i++) {
      const side = (i - 3) / 3;
      this.p.copy(this.a).addScaledVector(this.right, side * (.28 + t * .65)).addScaledVector(this.forward, -.28);
      this.p.y += .18 + Math.sin(t * Math.PI) * (.6 - Math.abs(side) * .2);
      this.stones.add(this.p, this.q, .045, .15 * (1 - t), .035, i % 2 ? PEARL : STONE, (1 - t) * fade);
    }
  }
  private regalia(fighter: Fighter, time: number, strength: number, detail: boolean) {
    if (strength <= 0) return;
    const head = fighter.joints?.get('Head');
    if (head) head.getWorldPosition(this.a); else bodyCentre(fighter, this.a).addScaledVector(UP, .65);
    this.p.copy(this.a).addScaledVector(this.forward, -.29); this.p.y -= .28;
    this.contours.add(this.p, this.q, .74, .82, .30, PINK, .65 * strength);
    for (let i = 0; i < (detail ? 6 : 4); i++) {
      const side = i % 2 ? 1 : -1, tier = Math.floor(i / 2);
      this.p.copy(this.a).addScaledVector(this.right, side * (.31 + tier * .095)).addScaledVector(this.forward, -.31);
      this.p.y -= .42 + tier * .20;
      this.roll.setFromAxisAngle(FRONT, side * (-.35 - tier * .18));
      this.roll.premultiply(this.q);
      this.haki.add(this.p, this.roll, .28, .54 - tier * .06, .7, INK, .87 * strength);
    }
    for (let i = 0; i < (detail ? 5 : 3); i++) {
      const angle = time * .25 + i * TAU / (detail ? 5 : 3);
      this.p.copy(fighter.group.position); this.p.x += Math.sin(angle) * .62; this.p.z += Math.cos(angle) * .62;
      this.p.y += .11 + Math.sin(time * 1.4 + i) * .035;
      this.stones.add(this.p, this.q, .045, .085, .035, i % 2 ? STONE : PINK, .65 * strength);
    }
  }
  reset() {
    for (const shell of this.shells) shell.actor = '';
    for (const impact of this.impacts) impact.actor = '';
    for (const g of this.gathers) g.actor = '';
    for (const batch of this.batches) { batch.begin(); batch.end(); }
    this.seen.fill(-1); this.seenAt.fill(-1); this.eventCursor = this.shellCursor = this.impactCursor = this.gatherCursor = 0;
    this.stage?.reset();
  }
  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    this.stage?.release(); this.stage = undefined;
    for (const batch of this.batches) batch.dispose();
  }
}
