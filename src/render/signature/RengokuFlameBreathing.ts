import * as T from 'three';
import type { CombatEvent } from '../../game/types';
import { RENGOKU_MOVES } from '../../game/fighters/rengoku';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import type { VfxKit } from '../vfx/VfxKit';
import { armoryDraws } from '../vfx/armory/drawn';
import { SIGNATURE, involvesLocal } from './context';
import { STAR } from './GlowBatch';
import { MoveStage, STAGE } from './MoveStage';
import { SignaturePoolUpload } from './SignaturePoolUpload';
import { RengokuFlameTiger } from './RengokuFlameTiger';
import { blowFloor } from './blowFloor';

export const RENGOKU_FLAME_LIMITS = Object.freeze({ tongues: 144, arcs: 72, sparks: 96, hearts: 16, impacts: 24, blooms: 6, confirms: 6, spine: 18 });
export const RENGOKU_NINTH = Object.freeze({ confirm: RENGOKU_MOVES.ultimate.contacts[0], last: RENGOKU_MOVES.ultimate.contacts[3], lunge: .7 });
const UP = new T.Vector3(0, 1, 0), Z = new T.Vector3(0, 0, 1);
const SCARLET = new T.Color(0xe73616), GOLD = new T.Color(0xffad25), WHITE = new T.Color(0xfff1c5);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const FLAME = STAGE.fire;
const HEAVY = RENGOKU_MOVES.heavy, SPECIAL = RENGOKU_MOVES.special, ULT = RENGOKU_MOVES.ultimate;

export function rengokuFlameGeometry(arc = false): T.BufferGeometry {
  const p: number[] = [], uv: number[] = [], indices: number[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, taper = Math.pow(Math.max(0, Math.sin(u * Math.PI)), .65);
    for (const side of [-1, 1]) {
      if (arc) {
        const theta = (u - .5) * 3.7, r = 1 + side * .12 * taper;
        p.push(Math.sin(theta) * r, Math.cos(theta) * r - .35, 0);
      } else {
        const bend = Math.sin(u * 6.4) * .13 * u;
        p.push(bend + side * .29 * taper * (1 - u * .55), u - .5, 0);
      }
      uv.push(u, (side + 1) * .5);
    }
    if (i < steps) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return geometry;
}
class FlameBatch {
  readonly mesh: T.InstancedMesh<T.BufferGeometry, T.ShaderMaterial>;
  private tint: T.InstancedBufferAttribute;
  private object = new T.Object3D();
  private used = 0;
  private upload: SignaturePoolUpload;
  constructor(scene: T.Scene, name: string, geometry: T.BufferGeometry, private capacity: number, flicker = false, lift = 1.45) {
    this.tint = new T.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('flameTint', this.tint);
    const material = new T.ShaderMaterial({ name: `rengoku-${name}`, transparent: true, depthWrite: false,
      side: T.DoubleSide, toneMapped: false, uniforms: { clock: { value: 0 }, flicker: { value: flicker ? 1 : 0 }, lift: { value: lift } },
      vertexShader: `attribute vec4 flameTint;uniform float clock;uniform float flicker;varying vec4 tint;varying vec2 tex;void main(){tint=flameTint;tex=uv;vec3 p=position;float seed=instanceMatrix[3].x*3.17+instanceMatrix[3].z*7.13;p.x+=sin(uv.x*12.-clock*9.+seed)*.055*uv.x*flicker;vec4 view=modelViewMatrix*instanceMatrix*vec4(p,1.);if(flicker>.5){vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);vec3 along=(modelViewMatrix*instanceMatrix*vec4(0.,1.,0.,0.)).xyz;vec2 across=vec2(along.y,-along.x);float span=length(across);across=span>.0001?across/span:vec2(1.,0.);view=center+vec4(along*p.y+vec3(across,0.)*p.x*length(instanceMatrix[0].xyz),0.);}gl_Position=projectionMatrix*view;}`,
      fragmentShader: `uniform float lift;varying vec4 tint;varying vec2 tex;void main(){float side=abs(tex.y-.5)*2.;float alpha=tint.a*(1.-smoothstep(.86,1.,side))*pow(max(0.,sin(tex.x*3.14159265)),.2);if(alpha<.005)discard;vec3 color=mix(tint.rgb,vec3(1.,.67,.12),1.-smoothstep(.46,.52,side));color=mix(color,vec3(1.,.95,.75),(1.-smoothstep(.12,.18,side))*.88);gl_FragColor=vec4(color*lift,alpha);\n#include <colorspace_fragment>\n}` });
    material.forceSinglePass = true;
    this.mesh = new T.InstancedMesh(geometry, material, capacity);
    this.mesh.name = `rengoku-${name}`; this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.upload = new SignaturePoolUpload(this.mesh, this.tint); scene.add(this.mesh);
  }
  begin(time: number) { this.used = 0; this.mesh.material.uniforms.clock.value = time; }
  add(p: T.Vector3, q: T.Quaternion, x: number, y: number, color: T.Color, alpha: number) {
    if (this.used >= this.capacity || alpha <= .005 || x <= 0 || y <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, 1); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.used, this.object.matrix); this.tint.setXYZW(this.used++, color.r, color.g, color.b, clamp(alpha));
  }
  end() { this.upload.end(this.used); }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
type Impact = { actor: string; target: string; born: number; seq: number; final: boolean; seed: number; yaw: number; point: T.Vector3 };
type Bloom = { p: T.Vector3; yaw: number; born: number; life: number; size: number; petals: number; rise: number; live: boolean };
type Ninth = { actor: string; target: string; seq: number; final: boolean; loosed: number; from: T.Vector3; dir: T.Vector3; reach: number };
export class RengokuFlameBreathing {
  private readonly stage: MoveStage;
  private blooms: Bloom[] = Array.from({ length: RENGOKU_FLAME_LIMITS.blooms }, () => ({ p: new T.Vector3(), yaw: 0, born: -Infinity, life: 0, size: 0, petals: 0, rise: 0, live: false }));
  private ninths: Ninth[] = Array.from({ length: RENGOKU_FLAME_LIMITS.confirms }, () => ({ actor: '', target: '', seq: -1, final: false, loosed: -Infinity, from: new T.Vector3(), dir: new T.Vector3(0, 0, 1), reach: 0 }));
  private spine: T.Vector3[] = Array.from({ length: RENGOKU_FLAME_LIMITS.spine }, () => new T.Vector3());
  private bloomCursor = 0; private ninthCursor = 0;
  private heading = new T.Vector3(); private ground = new T.Vector3(); private c = new T.Vector3(); private d = new T.Vector3(); private side = new T.Vector3();
  private tiger: RengokuFlameTiger;
  private tongues: FlameBatch; private arcs: FlameBatch; private sparks: FlameBatch; private hearts: FlameBatch;
  private batches: FlameBatch[];
  private impacts: Impact[] = Array.from({ length: RENGOKU_FLAME_LIMITS.impacts }, () => ({ actor: '', target: '', born: -Infinity, seq: 0, final: false, seed: 0, yaw: 0, point: new T.Vector3() }));
  private seen = new Float64Array(128).fill(-1); private seenTime = new Float64Array(128).fill(-1);
  private bladeBases = new WeakMap<T.Object3D, T.Object3D>();
  private cursor = 0; private eventCursor = 0; private disposed = false;
  private start = new T.Vector3(); private tip = new T.Vector3(); private p = new T.Vector3(); private axis = new T.Vector3();
  private face = new T.Quaternion(); private q = new T.Quaternion(); private spin = new T.Quaternion();
  constructor(scene: T.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.stage = MoveStage.for(scene, kit);
    this.tiger = new RengokuFlameTiger(scene, kit);
    this.tongues = new FlameBatch(scene, 'blade-flames', rengokuFlameGeometry(), RENGOKU_FLAME_LIMITS.tongues, true);
    this.arcs = new FlameBatch(scene, 'breathing-crescents', rengokuFlameGeometry(true), RENGOKU_FLAME_LIMITS.arcs);
    this.sparks = new FlameBatch(scene, 'embers', rengokuFlameGeometry(), RENGOKU_FLAME_LIMITS.sparks);
    this.hearts = new FlameBatch(scene, 'resolve-crest', rengokuFlameGeometry(), RENGOKU_FLAME_LIMITS.hearts, true, 1);
    this.batches = [this.tongues, this.arcs, this.sparks, this.hearts];
  }
  load(ids: readonly string[]) { return this.tiger.load(ids); }
  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    this.tiger.handle(e, fighters);
    if (e.kind === 'eliminated' || e.kind === 'respawn' || e.kind === 'whiff' || e.kind === 'rejected') {
      for (const h of this.impacts) if (h.actor === e.actorId || h.target === e.actorId) h.actor = '';
      const gone = e.kind === 'eliminated' || e.kind === 'respawn';
      for (const n of this.ninths) if (n.actor === e.actorId || gone && n.target === e.actorId && !n.final) n.actor = '';
      return;
    }
    if (e.fighter === 'rengoku' && e.kind === 'confirm') {
      const seq = e.actionSeq ?? fighters?.get(e.actorId)?.state.actionSeq ?? -1;
      if (e.slot === 'ultimate' && !e.branch && e.targetId && !armoryDraws(e.fighter, e.slot, e.branch, e.actorId) && !this.ninths.some(n => n.actor === e.actorId && n.seq === seq))
        Object.assign(this.ninths[this.ninthCursor++ % this.ninths.length], { actor: e.actorId, target: e.targetId, seq, final: false, loosed: -Infinity });
      return;
    }
    if (e.fighter !== 'rengoku' || e.kind !== 'hit' || !e.endpoint || e.slot === 'area') return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTime[i] === e.serverTime) return;
    const f = fighters?.get(e.actorId); if (!f) return;
    const j = this.eventCursor++ % this.seen.length; this.seen[j] = e.id; this.seenTime[j] = e.serverTime;
    const final = e.slot === 'ultimate' && !e.branch && e.contactIndex === 3;
    if (armoryDraws(e.fighter, e.slot, e.branch, e.actorId)) return;
    const h = this.impacts[this.cursor++ % this.impacts.length];
    h.actor = e.actorId; h.target = e.targetId ?? ''; h.seq = e.actionSeq ?? f.state.actionSeq ?? 0;
    h.born = e.serverTime; h.final = final; h.seed = e.id; h.yaw = f.state.yaw;
    h.point.set(e.endpoint.x, e.endpoint.y, e.endpoint.z);
    if (final && involvesLocal(e.actorId, e.targetId)) SIGNATURE.screen?.impactFrame?.(.4, h.point);
    this.land(e, h.point, f, e.targetId ? fighters?.get(e.targetId) : undefined, final, h.seq);
  }
  private land(e: CombatEvent, point: T.Vector3, actor: Fighter, target: Fighter | undefined, final: boolean, seq: number) {
    const st = this.stage, t = e.serverTime, dir = this.heading, yaw = actor.state.yaw ?? actor.group.rotation.y;
    const floor = blowFloor(actor, target, point.y - 1.05), ground = this.ground.set(point.x, floor, point.z);
    dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(yaw), 0, Math.cos(yaw)); dir.normalize();
    if (e.slot === 'light') { st.burst(point, FLAME, .42, t, { dir, floor, clean: true }); return; }
    if (e.slot === 'heavy') {
      const big = e.branch ? .85 : 1;
      st.burst(point, FLAME, .9 * big, t, { dir, floor, clean: true });
      st.erupt(this.c.copy(ground).addScaledVector(dir, 1.3), UP, FLAME, .4 * big, 4.2 * big, t, .3);
      st.scar(this.c.copy(ground).addScaledVector(dir, 1.5), FLAME, 1.1 * big, t + .05, 1.4);
      this.bloom(this.c.copy(point).addScaledVector(dir, .8), yaw, t, .34, 1.6 * big, 3, 2.6);
      return;
    }
    if (e.slot === 'special') {
      if (e.branch === 'airSpecial') { st.burst(point, FLAME, 2.1, t, { floor }); st.shock(ground, FLAME, 4.6, t, .45); st.scar(ground, FLAME, 2.4, t + .05, 2.2); this.bloom(point, yaw, t, .5, 1.6, 8, 0); return; }
      const big = e.branch ? .7 : 1;
      this.bloom(point, yaw, t, .55, 1.9 * big, 8, 0);
      st.burst(point, FLAME, 1.9 * big, t, { dir, floor });
      st.shock(ground, FLAME, 5.6 * big, t, .5);
      st.scar(ground, FLAME, 2.1 * big, t + .05, 2.3);
      if (!e.branch) for (let i = 1; i <= 2; i++) { const back = Math.min(i * 2.4, ground.distanceTo(actor.group.position) - 1.3); if (back > .8) st.scar(this.c.copy(ground).addScaledVector(dir, -back), FLAME, 1.1 - i * .15, t, 1.6); }
      return;
    }
    if (e.slot !== 'ultimate' || e.branch) return;
    if (!final) {
      const i = e.contactIndex ?? 0;
      st.burst(point, FLAME, 1 + .2 * i, t, { dir, floor, clean: i === 0 });
      if (i) st.shock(ground, FLAME, 4 + i, t, .45);
      return;
    }
    for (const n of this.ninths) if (n.actor === e.actorId && n.seq === seq) { n.final = true; n.loosed = t; n.from.copy(actor.group.position); n.from.y += 1.3; n.dir.copy(dir); n.reach = n.from.distanceTo(point) + 5; }
    st.erupt(this.c.copy(actor.group.position).setY(actor.group.position.y + 1.2).addScaledVector(dir, .9), this.d.copy(dir).setY(.06).normalize(), FLAME, .75, 12, t, .5);
    st.burst(point, FLAME, 2.2, t, { dir, floor });
    st.erupt(ground, UP, FLAME, 1, 9, t + .08, .65);
    st.shock(ground, FLAME, 10, t, .6);
    st.scar(ground, FLAME, 3.2, t + .2, 2.2);
    st.scar(this.c.copy(ground).addScaledVector(dir, 3.6), FLAME, 2, t + .25, 1.9);
    st.scar(this.c.copy(ground).addScaledVector(dir, -2.6), FLAME, 1.5, t + .25, 1.6);
  }
  private bloom(p: T.Vector3, yaw: number, born: number, life: number, size: number, petals: number, rise: number) {
    const b = this.blooms[this.bloomCursor++ % this.blooms.length];
    b.p.copy(p); b.yaw = yaw; b.born = born; b.life = life; b.size = size; b.petals = petals; b.rise = rise; b.live = true;
  }
  private dragon(count: number, girth: number, alpha: number, time: number) {
    if (count < 2 || alpha <= .02) return;
    const st = this.stage, spine = this.spine, head = spine[0];
    for (let i = 0; i < count - 1; i++) {
      const a = spine[i], b = spine[i + 1], u = i / (RENGOKU_FLAME_LIMITS.spine - 1);
      this.axis.subVectors(b, a); const span = this.axis.length(); if (span < .02) continue;
      this.q.setFromUnitVectors(UP, this.axis.multiplyScalar(1 / span)); this.p.copy(a).lerp(b, .5);
      const width = girth * (1 - .62 * u) * (i === 0 ? 1.15 : 1);
      this.tongues.add(this.p, this.q, width, span * 2.3, i % 2 ? SCARLET : GOLD, alpha * (1 - .35 * u));
      this.tongues.add(this.p, this.q, width * .5, span * 1.9, WHITE, alpha * .85 * (1 - .5 * u));
    }
    this.axis.subVectors(head, spine[1]).normalize();
    this.d.copy(this.axis).multiplyScalar(.55);
    for (let j = -1; j <= 1; j++) {
      this.c.copy(this.axis).multiplyScalar(-1); this.c.y += j * .42; this.c.normalize();
      this.q.setFromUnitVectors(UP, this.c); this.p.copy(head).add(this.d); this.p.y += j * girth * .3;
      this.tongues.add(this.p, this.q, girth * (j ? .7 : .95), girth * (j ? 1.9 : 1.5), j ? SCARLET : GOLD, alpha);
    }
    for (let j = -1; j <= 1; j += 2) {
      this.c.copy(this.axis).multiplyScalar(-.7); this.c.y += .8; this.c.x += j * .25 * this.axis.z; this.c.z -= j * .25 * this.axis.x; this.c.normalize();
      this.q.setFromUnitVectors(UP, this.c); this.p.copy(head).addScaledVector(this.c, girth * .7);
      this.tongues.add(this.p, this.q, girth * .4, girth * 1.6, GOLD, alpha * .95);
    }
    this.p.copy(head).add(this.d); this.p.y += girth * .22;
    st.glow(this.p, girth * .34, FLAME.core, 1.1 * alpha, STAR, .2, Math.floor(time * 24));
    st.glow(head, girth * 1.5, FLAME.main, .5 * alpha); st.glow(head, girth * .6, FLAME.core, .6 * alpha);
    st.light(head, 4.5 + girth * 2, FLAME, .6 * alpha);
    st.light(spine[Math.min(count - 1, 6)], 4 + girth * 2, FLAME, .4 * alpha);
    for (let i = 2; i < count - 1; i += 3) st.tongue(spine[i], UP, girth * .55, girth * 1.5, FLAME, alpha * .6, i);
  }
  private blade(f: Fighter, intensity: number, time: number, detail: boolean) {
    const hand = f.drawnJoint('RightHand'); if (!hand) return;
    const model = (f.shownBody ?? f).model;
    let base = model ? this.bladeBases.get(model) : undefined;
    if (!base && model) { base = model.getObjectByName('RengokuBladeBase') ?? hand; this.bladeBases.set(model, base); }
    (base ?? hand).getWorldPosition(this.start); f.strikePoint(this.tip);
    this.axis.subVectors(this.tip, this.start); let length = this.axis.length(); if (length < .05) return;
    this.axis.multiplyScalar(1 / length);
    const grip = Math.min(.14, length * .2); this.start.addScaledVector(this.axis, grip); length -= grip;
    this.q.setFromUnitVectors(UP, this.axis);
    this.p.copy(this.start).lerp(this.tip, .55);
    this.tongues.add(this.p, this.q, .23, length, SCARLET, intensity);
    this.tongues.add(this.p, this.q, .12, length * .95, GOLD, intensity * .9);
    const n = detail ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const u = .2 + .8 * i / n;
      this.p.copy(this.start).lerp(this.tip, u); this.p.y += .08;
      this.spin.setFromAxisAngle(Z, Math.sin(i * 2.4 + time * 5) * .3);
      this.q.copy(this.face).multiply(this.spin);
      this.tongues.add(this.p, this.q, .20 + u * .22, (.19 + u * .33) * intensity, i % 2 ? GOLD : SCARLET, intensity * .8);
    }
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    this.tiger.update(time, fighters);
    for (const b of this.batches) b.begin(time);
    const detail = this.kit.budget >= .65, st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state; if (s.fighter !== 'rengoku' || !s.alive || s.whiffedAt !== undefined) continue;
      this.face.copy(f.group.quaternion);
      if (s.action === 'awaken') {
        const u = clamp(s.actionTime), flare = clamp((u - .48) / .2), fade = 1 - clamp((u - .84) / .16);
        this.start.copy(f.group.position); this.start.y += 1.2;
        for (let i = 0; i < (detail ? 7 : 5); i++) {
          const a = (i - (detail ? 3 : 2)) * .27;
          this.q.copy(this.face).multiply(this.spin.setFromAxisAngle(Z, a));
          this.p.copy(this.start); this.p.y += flare * .28;
          this.hearts.add(this.p, this.q, .22 + flare * .23, .15 + flare * (1.1 - Math.abs(a) * .6), i % 2 ? GOLD : SCARLET, fade * (.18 + flare * .65));
        }
        this.blade(f, flare * fade, time, detail); continue;
      }
      if (s.action !== 'light' && s.action !== 'heavy' && s.action !== 'special' && s.action !== 'ultimate') continue;
      const elapsed = s.actionTime * s.actionDuration;
      if (s.action === 'ultimate' && s.confirmedAt === undefined && elapsed > .6) continue;
      const intensity = Math.sin(clamp(s.actionTime) * Math.PI) * (s.awakened ? .95 : .75);
      this.blade(f, intensity, time, detail);
      if (armoryDraws(s.fighter, s.action, s.branch, s.id)) continue;
      this.windup(f, elapsed, intensity);
      if (s.action === 'heavy' || s.action === 'special' || s.action === 'ultimate') {
        f.strikePoint(this.p); this.q.copy(this.face);
        const roll = s.action === 'heavy' ? Math.PI / 2 : s.action === 'special' ? -.4 : elapsed * 2.8;
        this.q.multiply(this.spin.setFromAxisAngle(Z, roll));
        const size = s.action === 'special' ? .75 : .48;
        this.arcs.add(this.p, this.q, size, size, SCARLET, intensity * .7);
        this.arcs.add(this.p, this.q, size * .91, size * .91, GOLD, intensity * .6);
      }
    }
    for (const flight of flights.values()) {
      if (flight.fighter !== 'rengoku' || flight.slot !== 'special' || flight.branch || !flight.released || armoryDraws(flight.fighter, 'special', undefined, flight.actorId)) continue;
      this.axis.copy(flight.heading).normalize(); this.face.setFromUnitVectors(Z, this.axis);
      this.arcs.add(flight.position, this.face, 1.05, 1.15, SCARLET, .95);
      this.arcs.add(flight.position, this.face, .93, 1.02, GOLD, .9);
      const n = detail ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const angle = (i / (n - 1) - .5) * 3.1;
        this.p.set(Math.sin(angle) * 1.02, Math.cos(angle) * 1.1 - .35, -.12 - .04 * (i % 3));
        this.p.applyQuaternion(this.face).add(flight.position);
        this.q.copy(this.face).multiply(this.spin.setFromAxisAngle(Z, -angle));
        this.tongues.add(this.p, this.q, .3, .42 + (i % 2) * .18, i % 2 ? GOLD : SCARLET, .86);
      }
      this.arcs.add(flight.position, this.face, 2.05, 2.2, SCARLET, .8);
      this.arcs.add(flight.position, this.face, 1.8, 1.95, GOLD, .75);
      st.glow(flight.position, 1.5, FLAME.main, .6); st.glow(flight.position, .5, FLAME.core, .9);
      this.d.copy(this.axis).multiplyScalar(-1).setY(.4).normalize();
      for (let i = 0, k = st.n(6, 3); i < k; i++) { this.p.copy(flight.position).addScaledVector(this.axis, -.5 - i * .6); this.p.y += Math.sin(time * 13 + i * 2.1) * .3; st.tongue(this.p, this.d, .7 - i * .07, 1.6 - i * .15, FLAME, .85 - i * .1, i); }
      st.light(this.p.copy(flight.position).setY(flight.position.y + .2), 7.5, FLAME, .75);
    }
    for (const b of this.blooms) {
      if (!b.live) continue;
      const age = time - b.born;
      if (age >= b.life) { b.live = false; continue; }
      if (age < 0) continue;
      const w = age / b.life, open = Math.min(1, age / .08), fade = w < .45 ? 1 : 1 - (w - .45) / .55;
      this.face.setFromAxisAngle(UP, b.yaw);
      for (let i = 0; i < b.petals; i++) {
        const a = b.rise ? (i - (b.petals - 1) / 2) * .5 : i * Math.PI * 2 / b.petals + .3, len = b.size * (.5 + .5 * open);
        this.p.set(Math.sin(a) * len * .5, Math.cos(a) * len * .5 + b.rise * w, 0).applyQuaternion(this.face).add(b.p);
        this.q.copy(this.face).multiply(this.spin.setFromAxisAngle(Z, -a));
        this.tongues.add(this.p, this.q, b.size * .34, len, i % 2 ? GOLD : SCARLET, fade * .95);
      }
      st.light(b.p, 2 + b.size * 1.5, FLAME, .35 * fade);
    }
    for (const n of this.ninths) {
      if (!n.actor) continue;
      const actor = fighters.get(n.actor), victim = fighters.get(n.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !n.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== n.seq || s.whiffedAt !== undefined) { n.actor = ''; continue; }
      const elapsed = s.actionTime * s.actionDuration;
      if (!n.final) { if (elapsed < RENGOKU_NINTH.last) this.gather(actor, n, elapsed, time); continue; }
      const age = time - n.loosed; if (age < 0) continue; if (age >= RENGOKU_NINTH.lunge) continue;
      const run = Math.min(n.reach, age * 30), fade = age < RENGOKU_NINTH.lunge - .3 ? 1 : (RENGOKU_NINTH.lunge - age) / .3;
      this.side.set(n.dir.z, 0, -n.dir.x);
      let count = 0;
      for (let i = 0; i < RENGOKU_FLAME_LIMITS.spine; i++) {
        const at = run - i * .8; if (at < 0) break;
        this.spine[i].copy(n.from).addScaledVector(n.dir, at).addScaledVector(this.side, Math.sin(at * 1.25 + n.seq) * .55 * Math.min(1, i * .5));
        this.spine[i].y += Math.sin(at * 1.7 + 1) * .35 * Math.min(1, i * .5); count++;
      }
      this.dragon(count, 1.25, fade, time);
    }
    for (const h of this.impacts) {
      if (!h.actor) continue;
      const actor = fighters.get(h.actor), age = time - h.born, life = h.final ? .62 : .28;
      if (!actor?.state.alive || actor.state.whiffedAt !== undefined || age >= life || (actor.state.actionSeq ?? 0) !== h.seq) { h.actor = ''; continue; }
      if (age < 0) continue;
      const fade = 1 - age / life; this.face.setFromAxisAngle(UP, h.yaw);
      const radius = .2 + age * (h.final ? 5.5 : 3);
      for (let i = 0; i < (h.final ? 3 : 1); i++) {
        this.q.copy(this.face).multiply(this.spin.setFromAxisAngle(Z, i * 2.09 + .4));
        this.arcs.add(h.point, this.q, radius, radius, SCARLET, fade * .9);
        this.arcs.add(h.point, this.q, radius * .87, radius * .87, WHITE, fade * .7);
      }
      if (h.final) for (let i = 0; i < (detail ? 16 : 8); i++) {
        const u = i / (detail ? 16 : 8), angle = u * Math.PI * 3 + age * 3;
        this.p.set(Math.sin(angle) * (.14 + u * .5), Math.cos(angle) * (.14 + u * .5), -u * 2.4 * clamp(age * 9));
        this.p.applyQuaternion(this.face).add(h.point);
        this.q.copy(this.face).multiply(this.spin.setFromAxisAngle(Z, angle + .8));
        this.tongues.add(this.p, this.q, .5 - u * .25, .8 - u * .35, i % 2 ? GOLD : SCARLET, fade * .9);
      }
      const n = detail ? (h.final ? 14 : 5) : (h.final ? 7 : 3);
      for (let i = 0; i < n; i++) {
        const a = i * 2.399 + h.seed;
        this.p.set(Math.sin(a) * radius, Math.cos(a) * radius + age * .6, Math.sin(a * .7) * age);
        this.p.applyQuaternion(this.face).add(h.point);
        this.q.copy(this.face).multiply(this.spin.setFromAxisAngle(Z, -a));
        this.sparks.add(this.p, this.q, .045 * fade, .14 * fade, GOLD, fade);
      }
    }
    for (const b of this.batches) b.end(); st.close();
  }
  private windup(f: Fighter, elapsed: number, intensity: number) {
    const st = this.stage, s = f.state, seed = (s.actionSeq ?? 0) * 7.3, yaw = s.yaw ?? f.group.rotation.y;
    const tip = f.strikePoint(this.c), heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
    if (s.action === 'light') { st.glow(tip, .26, FLAME.main, .5 * intensity); st.light(tip, 2, FLAME, .22 * intensity); return; }
    if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .55 : HEAVY.contacts[0];
      if (elapsed < contact) st.charge(tip, FLAME, .24, elapsed / contact, seed);
      else if (elapsed < contact + .22) {
        const flare = 1 - (elapsed - contact) / .22;
        this.p.copy(f.group.position).addScaledVector(heading, 1.3); this.p.y += 1 + 1.4 * (1 - flare);
        this.q.copy(this.face).multiply(this.spin.setFromAxisAngle(Z, Math.PI / 2));
        this.arcs.add(this.p, this.q, 1.5, 1.7, SCARLET, flare * .9); this.arcs.add(this.p, this.q, 1.32, 1.5, GOLD, flare * .8);
        st.light(this.p, 3.2, FLAME, .4 * flare);
      }
      return;
    }
    if (s.action === 'special' && !s.branch) { if (elapsed < SPECIAL.contacts[0]) st.charge(tip, FLAME, .34, elapsed / SPECIAL.contacts[0], seed); return; }
    if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && elapsed < ULT.contacts[0] + .1) st.charge(tip, FLAME, .28, elapsed / ULT.contacts[0], seed);
  }
  private gather(actor: Fighter, n: Ninth, elapsed: number, time: number) {
    const st = this.stage, g = clamp((elapsed - RENGOKU_NINTH.confirm) / (RENGOKU_NINTH.last - RENGOKU_NINTH.confirm)), feet = actor.group.position, seed = n.seq * 2.9;
    st.dim(.3 + .45 * g, n.actor, n.target);
    st.pool(this.c.copy(feet), 2.3 + 2.6 * g, FLAME, .3 + .7 * g, seed);
    const count = Math.min(RENGOKU_FLAME_LIMITS.spine, 4 + Math.ceil(g * (RENGOKU_FLAME_LIMITS.spine - 4))), turn = time * 2.4 + seed;
    for (let i = 0; i < count; i++) {
      const a = turn - i * .4, r = 2.1 + .3 * Math.sin(i * .9 + time);
      this.spine[i].set(feet.x + Math.cos(a) * r, feet.y + 3 - i * .15 + .22 * Math.sin(time * 3 + i), feet.z + Math.sin(a) * r);
    }
    this.dragon(count, .62 + .3 * g, .75 + .25 * g, time);
    st.charge(actor.strikePoint(this.c), FLAME, .26 + .26 * g, Math.max(.4, g), seed);
    if (g > .75) st.speed(.5 * (g - .75) / .25, n.actor, n.target);
  }
  reset() {
    this.tiger.reset();
    for (const h of this.impacts) h.actor = '';
    for (const b of this.blooms) b.live = false; for (const n of this.ninths) n.actor = '';
    this.bloomCursor = this.ninthCursor = 0; this.stage.reset();
    this.seen.fill(-1); this.seenTime.fill(-1); this.cursor = this.eventCursor = 0;
    for (const b of this.batches) { b.begin(0); b.end(); }
  }
  dispose() { if (this.disposed) return; this.reset(); this.disposed = true; this.tiger.dispose(); for (const b of this.batches) b.dispose(); this.stage.release(); }
}
