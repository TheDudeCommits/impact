import * as THREE from 'three';
import { AWAKENING_ENTRY } from '../../game/awakening';
import type { Fighter } from '../Fighter';
import { VfxKit } from '../vfx/VfxKit';
import { noiseGLSL } from '../vfx/noise';
import { BoltBatch } from './BoltBatch';
import { LightningPainter, Rng, type BoltStyle } from './Lightning';

const GLOW = new THREE.Color(.5, .85, 2.5), DEEP = new THREE.Color(.22, .5, 2.2), ARC = new THREE.Color(.62, .95, 2.6);
const GHOST = 0xc8ecff;
const SAMPLES = 16;
const ATTACKS = new Set(['light', 'heavy', 'special', 'ultimate']);
const ARC_JOINTS = ['Head', 'Spine2', 'Hips', 'LeftHand', 'RightHand', 'LeftForeArm', 'RightForeArm', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'] as const;
const HAIR_GLOW = new THREE.Color(.16, .34, .7);

const SHELL_VERTEX = `
#include <common>
#include <skinning_pars_vertex>
uniform float uTime; uniform float uStrength; uniform float uThick; uniform float uPush;
varying vec3 vNormalW; varying vec3 vWorld;
${noiseGLSL}
void main(){
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  // The band jumps as the current re-forks, 24 times a second.
  float tick = floor(uTime * 24.0);
  float jump = snoise(world.xyz * 5.0 + vec3(tick * 1.7, tick * .9, -tick * 1.3));
  world.xyz += n * uThick * (1.0 + .7 * jump) * uStrength;
  vNormalW = n; vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  mv.xyz += normalize(mv.xyz) * uPush;
  gl_Position = projectionMatrix * mv;
}`;
const SHELL_FRAGMENT = `
uniform vec3 uGlow; uniform vec3 uDeep; uniform float uTime; uniform float uStrength;
varying vec3 vNormalW; varying vec3 vWorld;
${noiseGLSL}
void main(){
  // Drawn by its back faces, pushed behind him: what shows is the band round
  // his silhouette. Filaments where a re-forked noise crosses zero: a web of
  // thin white-blue lines over a faint blue glow.
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float f = abs(dot(n, v)), near = smoothstep(0.0, .3, f);
  float tick = floor(uTime * 24.0);
  float w = snoise(vWorld * 7.5 + vec3(tick * 2.3, -tick * 1.1, tick * .7));
  float lines = 1.0 - smoothstep(.0, .16, abs(w));
  vec3 col = mix(uDeep * .8, vec3(1.7, 2.1, 2.8), lines);
  float a = near * (.22 + .78 * lines) * uStrength;
  if (a < .004) discard;
  gl_FragColor = vec4(col, min(.95, a));
}`;

interface Track {
  hips: Float32Array; times: Float32Array; head: number; size: number;
  action: string; started: number; ghostAt: number; dashAt: number; dashFrom: THREE.Vector3; nextEarth: number; earth: number; earthFoot: number; earthAngle: number;
}
interface Aura { fighter: Fighter; parts: { source: THREE.SkinnedMesh; shell: THREE.SkinnedMesh }[]; material: THREE.ShaderMaterial; hair: THREE.MeshToonMaterial[]; joints: (THREE.Object3D | undefined)[]; shown: number; used: number; nextArc: number }
interface Discharge { aura: Aura | null; joint: number; dir: THREE.Vector3; born: number; life: number; seed: number; length: number }

export class Godspeed {
  private bolts = new BoltBatch(640, 'godspeed-trail');
  private painter = new LightningPainter(this.bolts, 16);
  private arcs = new BoltBatch(480, 'godspeed-discharge');
  private arcPainter = new LightningPainter(this.arcs, 8);
  private discharges: Discharge[] = Array.from({ length: 16 }, () => ({ aura: null, joint: 0, dir: new THREE.Vector3(), born: -1e9, life: 0, seed: 0, length: 0 }));
  private dischargeCursor = 0;
  private tracks = new Map<Fighter, Track>();
  private auras = new Map<Fighter, Aura>();
  private kit: VfxKit;
  private rng = new Rng();
  private style: BoltStyle = { width: .02, color: GLOW, levels: 4, jag: .3, branches: 1, branchLength: .35, taper: .5, core: .28 };
  private arcStyle: BoltStyle = { width: .014, color: ARC, levels: 3, jag: .42, branches: 1, branchLength: .45, taper: .3, core: .3 };
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private frame = 0;
  private warm?: THREE.SkinnedMesh;
  constructor(private scene: THREE.Scene) { scene.add(this.bolts.mesh, this.arcs.mesh); this.kit = VfxKit.for(scene); }

  private shellMaterial() {
    return new THREE.ShaderMaterial({
      name: 'GodspeedShell', vertexShader: SHELL_VERTEX, fragmentShader: SHELL_FRAGMENT, side: THREE.BackSide,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uThick: { value: .032 }, uPush: { value: .4 }, uGlow: { value: GLOW.clone() }, uDeep: { value: DEEP.clone() } },
      transparent: true, depthWrite: false, toneMapped: false,
    });
  }
  warmup() {
    if (this.warm) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .01, 0, .01, 0, 0], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, this.shellMaterial());
    mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
    mesh.name = 'godspeed-shell-warmup'; mesh.frustumCulled = false; mesh.visible = false;
    this.scene.add(mesh); this.warm = mesh;
  }
  hideWarmup() { if (this.warm) this.warm.visible = false; }

  private track(fighter: Fighter) {
    let t = this.tracks.get(fighter);
    if (!t) {
      t = { hips: new Float32Array(SAMPLES * 3), times: new Float32Array(SAMPLES).fill(-1e9), head: 0, size: 0, action: fighter.state.action, started: fighter.state.actionStarted,
        ghostAt: -1, dashAt: -1e9, dashFrom: new THREE.Vector3(), nextEarth: 0, earth: -1e9, earthFoot: 0, earthAngle: 0 };
      this.tracks.set(fighter, t);
    }
    return t;
  }
  private aura(fighter: Fighter) {
    let aura = this.auras.get(fighter);
    if (aura) return aura;
    const material = this.shellMaterial(), parts: Aura['parts'] = [], hair: THREE.MeshToonMaterial[] = [];
    fighter.model.traverse(o => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh || mesh.name.endsWith('-ink') || /outline|shadow/i.test(mesh.name)) return;
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
      for (const m of materials) if (/hair/i.test(m.name) && (m as THREE.MeshToonMaterial).isMeshToonMaterial && !hair.includes(m as THREE.MeshToonMaterial)) hair.push(m as THREE.MeshToonMaterial);
      if (!mesh.isSkinnedMesh || materials.some(m => m.transparent && m.opacity < .9) || mesh.geometry.attributes.position.count < 300) return;
      const geometry = new THREE.BufferGeometry(), from = mesh.geometry;
      if (from.index) geometry.setIndex(from.index);
      for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) if (from.attributes[name]) geometry.setAttribute(name, from.attributes[name]);
      geometry.groups = from.groups.slice(); geometry.drawRange = { ...from.drawRange };
      const shell = new THREE.SkinnedMesh(geometry, material);
      shell.bindMode = mesh.bindMode; shell.bindMatrix.copy(mesh.bindMatrix); shell.bindMatrixInverse.copy(mesh.bindMatrixInverse); shell.skeleton = mesh.skeleton;
      shell.name = 'godspeed-shell'; shell.frustumCulled = false; shell.visible = false; shell.renderOrder = 1; shell.castShadow = shell.receiveShadow = false;
      this.scene.add(shell); parts.push({ source: mesh, shell });
    });
    aura = { fighter, parts, material, hair, joints: ARC_JOINTS.map(n => fighter.joints?.get(n)), shown: 0, used: 0, nextArc: 0 };
    this.auras.set(fighter, aura);
    return aura;
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, density: number, dt = 1 / 60) {
    this.frame++;
    this.bolts.begin(); this.arcs.begin();
    const d = Math.max(.35, density), tick = Math.floor(time * 30);
    for (const f of fighters.values()) {
      const s = f.state;
      if (s.fighter !== 'killua') continue;
      const t = this.track(f), p = f.group.position;
      const began = s.action !== t.action || Math.abs(s.actionStarted - t.started) > 1e-4;
      t.action = s.action; t.started = s.actionStarted;
      const velocity = f.velocity as THREE.Vector3 | undefined, speed = Math.hypot(velocity?.x ?? 0, velocity?.z ?? 0);
      this.body(f, time, dt, d, speed);
      const k = s.awakened && s.alive ? THREE.MathUtils.clamp((s.awakenedUntil ?? 0) - time, 0, 1) : 0;
      if (k <= 0) { t.size = 0; t.ghostAt = -1; continue; }
      const hips = f.joints?.get('Hips');
      if (hips) hips.getWorldPosition(this.a); else this.a.set(p.x, p.y + .95, p.z);
      if (time - t.times[t.head] > .014 || t.size === 0) {
        t.head = (t.head + 1) % SAMPLES; t.size = Math.min(SAMPLES, t.size + 1);
        t.hips[t.head * 3] = this.a.x; t.hips[t.head * 3 + 1] = this.a.y; t.hips[t.head * 3 + 2] = this.a.z; t.times[t.head] = time;
      }
      if (speed > 3.2) {
        let oldest = t.head;
        for (let i = 1; i < t.size; i++) { const j = (t.head - i + SAMPLES) % SAMPLES; if (time - t.times[j] > .2) break; oldest = j; }
        this.b.set(t.hips[oldest * 3], t.hips[oldest * 3 + 1], t.hips[oldest * 3 + 2]);
        if (this.b.distanceToSquared(this.a) > .09) {
          const fast = Math.min(1, (speed - 3.2) / 5) * k, st = this.style;
          for (let strand = 0; strand < 2; strand++) {
            this.c.copy(this.b); this.c.y -= .25 + strand * .3;
            this.a.y -= .25 + strand * .3;
            st.width = .016 + .01 * fast; st.color = strand ? DEEP : GLOW; st.intensity = .55 + .45 * fast; st.levels = 4; st.jag = .28; st.branches = strand ? 0 : 1;
            this.painter.bolt(this.c, this.a, tick * 17 + strand * 7, st);
            this.a.y += .25 + strand * .3;
          }
        }
      }
      if (began && s.action === 'dash') { t.dashAt = time; t.dashFrom.copy(p); }
      const dashAge = time - t.dashAt;
      if (dashAge >= 0 && dashAge < .18) {
        const st = this.style; st.width = .014; st.color = GLOW; st.intensity = (1 - dashAge / .18) * k; st.levels = 3; st.jag = .4; st.branches = 1; st.branchLength = .5;
        this.c.copy(t.dashFrom); this.c.y += .8;
        this.painter.burst(this.c, .7, Math.max(4, Math.round(7 * d)), tick, 29, st, .15);
      }
      if (began) t.ghostAt = (s.action === 'light' && (s.chain ?? 0) < 3) || s.action === 'heavy' ? time + Math.min(.1, s.actionDuration * .16) : -1;
      if (t.ghostAt > 0 && time >= t.ghostAt) { t.ghostAt = -1; if (ATTACKS.has(s.action)) this.kit.ghosts.spawn(f, GHOST, time, .2, .38 * k); }
      if (s.grounded && speed < 1.5 && time >= t.nextEarth) {
        this.rng.seed(tick * 613 + 11);
        t.nextEarth = time + (.35 + this.rng.next() * .8) / d; t.earth = time; t.earthFoot = this.rng.next() < .5 ? 0 : 1; t.earthAngle = this.rng.next() * Math.PI * 2;
      }
      if (time - t.earth < .1) {
        const foot = f.joints?.get(t.earthFoot ? 'RightFoot' : 'LeftFoot');
        if (foot) {
          foot.getWorldPosition(this.a);
          this.b.set(this.a.x + Math.cos(t.earthAngle) * .45, p.y + .01, this.a.z + Math.sin(t.earthAngle) * .45);
          const st = this.style; st.width = .01; st.color = GLOW; st.intensity = .9 * k; st.levels = 3; st.jag = .38; st.branches = 1; st.branchLength = .4;
          this.painter.bolt(this.a, this.b, tick * 5 + t.earthFoot, st);
        }
      }
    }
    for (const c of this.discharges) {
      const aura = c.aura;
      if (!aura) continue;
      const age = time - c.born, joint = aura.joints[c.joint];
      if (age > c.life || age < 0 || !joint || aura.shown <= 0) { c.aura = null; continue; }
      this.rng.seed(tick * 37 + c.seed);
      if (this.rng.next() < .2) continue;
      joint.getWorldPosition(this.a);
      this.b.copy(this.a).addScaledVector(c.dir, c.length);
      const st = this.arcStyle; st.intensity = (.6 + .4 * (1 - age / c.life)) * aura.shown; st.branches = c.seed % 3 === 0 ? 2 : 1;
      this.arcPainter.bolt(this.a, this.b, tick * 11 + c.seed, st);
    }
    for (const [f, aura] of this.auras) {
      if (aura.used === this.frame) continue;
      for (const part of aura.parts) part.shell.visible = false;
      if ((this.frame & 63) === 0) { let present = false; for (const g of fighters.values()) if (g === f) { present = true; break; } if (!present) this.release(f, aura); }
    }
    if ((this.frame & 63) === 0) for (const f of this.tracks.keys()) { let present = false; for (const g of fighters.values()) if (g === f) { present = true; break; } if (!present) this.tracks.delete(f); }
    this.bolts.end(); this.arcs.end();
  }

  private body(f: Fighter, time: number, dt: number, density: number, speed: number) {
    const s = f.state, aura = this.aura(f);
    aura.used = this.frame;
    const elapsed = s.actionTime * s.actionDuration;
    const entry = s.action === 'awaken' ? THREE.MathUtils.smoothstep(elapsed, AWAKENING_ENTRY * .2, AWAKENING_ENTRY * .75) : 1;
    const want = s.awakened && s.alive ? THREE.MathUtils.clamp((s.awakenedUntil ?? 0) - time, 0, 1) * entry : 0;
    aura.shown += (want - aura.shown) * (1 - Math.exp(-Math.min(.05, Math.max(0, dt)) * 10));
    if (want === 0 && aura.shown < .02) aura.shown = 0;
    const k = aura.shown, u = aura.material.uniforms;
    u.uTime.value = time; u.uStrength.value = k;
    for (const part of aura.parts) {
      let visible = k > .01;
      for (let o: THREE.Object3D | null = part.source; o && visible; o = o.parent) { visible = o.visible; if (o === f.group) break; }
      part.shell.visible = visible;
      if (visible && part.source.bindMode !== THREE.AttachedBindMode) { part.shell.matrixAutoUpdate = false; part.shell.matrix.copy(part.source.matrixWorld); part.shell.matrixWorldNeedsUpdate = true; }
    }
    if (k <= 0) return;
    for (const m of aura.hair) m.emissive.setRGB(Math.max(m.emissive.r, HAIR_GLOW.r * k), Math.max(m.emissive.g, HAIR_GLOW.g * k), Math.max(m.emissive.b, HAIR_GLOW.b * k));
    if (time >= aura.nextArc) {
      const busy = ATTACKS.has(s.action) || s.action === 'dash';
      const rate = (3 + (speed > 2.5 ? 3 : 0) + (busy ? 2 : 0)) * density;
      this.rng.seed(Math.floor(time * 60) * 389 + this.dischargeCursor * 17);
      aura.nextArc = time + (.4 + this.rng.next() * 1.2) / rate;
      const c = this.discharges[this.dischargeCursor];
      this.dischargeCursor = (this.dischargeCursor + 1) % this.discharges.length;
      let joint = Math.floor(this.rng.next() * ARC_JOINTS.length);
      for (let i = 0; i < ARC_JOINTS.length && !aura.joints[joint]; i++) joint = (joint + 1) % ARC_JOINTS.length;
      if (aura.joints[joint]) {
        c.dir.set(this.rng.signed(), .15 + this.rng.next() * .8, this.rng.signed()).normalize();
        c.aura = aura; c.joint = joint; c.born = time; c.life = .1 + this.rng.next() * .12; c.seed = Math.floor(this.rng.next() * 9973); c.length = .32 + this.rng.next() * .34;
      }
    }
  }

  private release(f: Fighter, aura: Aura) {
    for (const part of aura.parts) { part.shell.removeFromParent(); part.shell.geometry.index = null; part.shell.geometry.attributes = {}; part.shell.geometry.dispose(); }
    aura.material.dispose(); this.auras.delete(f);
    for (const c of this.discharges) if (c.aura === aura) c.aura = null;
  }

  get segments() { return this.bolts.count; }
  get discharge() { return this.arcs.count; }
  get shellCount() { let n = 0; for (const a of this.auras.values()) for (const part of a.parts) if (part.shell.visible) n++; return n; }
  reset() {
    this.tracks.clear();
    for (const a of this.auras.values()) { a.shown = 0; for (const part of a.parts) part.shell.visible = false; }
    for (const c of this.discharges) c.aura = null;
    this.bolts.begin(); this.bolts.end(); this.arcs.begin(); this.arcs.end();
  }
  dispose() {
    this.reset();
    for (const [f, aura] of [...this.auras]) this.release(f, aura);
    if (this.warm) { this.warm.removeFromParent(); (this.warm.material as THREE.Material).dispose(); this.warm.geometry.dispose(); this.warm = undefined; }
    this.bolts.dispose(); this.arcs.dispose(); this.kit.release();
  }
}
