import * as THREE from 'three';
import { AWAKENING_ENTRY } from '../../game/awakening';
import type { FighterId } from '../../game/types';
import type { Fighter } from '../Fighter';
import { VfxKit } from '../vfx/VfxKit';
import { SPRITE, ORIENT } from '../vfx/SparkField';
import { noiseGLSL } from '../vfx/noise';
import { noiseTexture, NOISE_GLSL } from '../vfx/noiseTexture';

const VERTEX = `
#include <common>
#include <skinning_pars_vertex>
attribute float aLeg;
uniform float uTime; uniform float uStrength; uniform float uThick; uniform float uLick; uniform float uPush;
varying vec3 vNormalW; varying vec3 vWorld; varying float vLeg;
${noiseGLSL}
void main(){
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  // Tongues rising up the limb in world space, whichever way it is turned: a
  // limb is a cylinder, so the licks are not kept to upward faces.
  float flame = snoise(vec3(world.x * 3.4, world.y * 2.3 - uTime * 3.8, world.z * 3.4));
  float lick = max(0.0, flame) * smoothstep(-.6, .6, n.y + .35);
  float k = aLeg * uStrength;
  world.xyz += n * (uThick * (1.0 + .45 * flame) + lick * uLick) * k;
  world.y += lick * uLick * 1.8 * k;
  vNormalW = n; vWorld = world.xyz; vLeg = aLeg;
  vec4 mv = viewMatrix * world;
  mv.xyz += normalize(mv.xyz) * uPush;
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform vec3 uCore; uniform vec3 uRim; uniform vec3 uWhite; uniform float uTime; uniform float uStrength;
varying vec3 vNormalW; varying vec3 vWorld; varying float vLeg;
${NOISE_GLSL}
const vec3 INK = vec3(.01, .02, .06);
void main(){
  if (vLeg < .04) discard;
  // The same printed bands as the Saiyans' aura, in the fire's colours:
  // white-hot against the limb, the flame, a deep edge and an ink line, the
  // edge torn into tongues by noise rising up the body.
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float facing = abs(dot(n, v));
  float rise = tnoise(vec2(vWorld.x * .5 + vWorld.z * .5, vWorld.y * .38 - uTime * .95)).g;
  float e = facing - rise * .24, aa = fwidth(facing) + 1e-4;
  if (e < -aa) discard;
  float ink = 1.0 - smoothstep(aa * 1.5, aa * 3.0, e);
  float band1 = smoothstep(.1 - aa, .1 + aa, e), band2 = smoothstep(.5 - aa, .5 + aa, e);
  vec3 col = mix(uRim, uCore * 1.1, band1);
  col = mix(col, uWhite, band2);
  col = mix(col, INK, ink);
  float a = smoothstep(-aa, aa, e) * uStrength * smoothstep(.04, .3, vLeg) * mix(.95, .85, band2);
  gl_FragColor = vec4(col, min(.97, a));
}`;

const HEAT_VERTEX = `
#include <common>
#include <skinning_pars_vertex>
attribute float aLeg;
varying vec3 vNormalW; varying vec3 vWorld; varying float vLeg;
void main(){
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * objectNormal); vWorld = world.xyz; vLeg = aLeg;
  vec4 mv = viewMatrix * world;
  mv.xyz *= .9985;
  gl_Position = projectionMatrix * mv;
}`;
const HEAT_FRAGMENT = `
uniform vec3 uHeat; uniform float uTime; uniform float uStrength; uniform float uBase;
varying vec3 vNormalW; varying vec3 vWorld; varying float vLeg;
${NOISE_GLSL}
void main(){
  if (vLeg < .04) discard;
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float graze = 1.0 - abs(dot(n, v));
  float flicker = tnoise(vec2(vWorld.x * 1.3 + vWorld.z * 1.1, vWorld.y * 1.6 - uTime * 1.9)).r;
  float heat = smoothstep(.04, .5, vLeg) * (uBase + (1.0 - uBase) * pow(graze, 1.4)) * (.65 + .55 * flicker) * uStrength;
  // Alpha 1: three's additive blend weighs the source by its alpha.
  gl_FragColor = vec4(uHeat * heat, 1.0);
}`;

export interface Blaze {
  fighter: FighterId;
  name: string;
  weights: Readonly<Record<string, number>>;
  chains: readonly (readonly string[])[];
  stations: readonly number[];
  perStation: number;
  size: number; taper: number;
  ahead: number;
  fire: readonly [number, number, number];
  white: THREE.Color;
  heat: THREE.Color;
  heatBase: number;
  thick: number; lick: number;
  embers: readonly string[];
  emberEvery: number;
  edge?: readonly [number, number];
}

export const IFRIT: Blaze = {
  fighter: 'sanji', name: 'ifrit-jambe',
  weights: { LeftLeg: 1, RightLeg: 1, LeftFoot: 1, RightFoot: 1, LeftToeBase: 1, RightToeBase: 1 },
  chains: [['LeftFoot', 'LeftLeg'], ['RightFoot', 'RightLeg']],
  stations: [0, .25, .5, .7], perStation: 3, size: .38, taper: -.07, ahead: .09,
  fire: [0xc6ecff, 0x3a8cff, 0x2352e6], white: new THREE.Color(.75, 1.05, 1.6), heat: new THREE.Color(.14, .44, 1.25), heatBase: .55,
  thick: .03, lick: .06, embers: ['LeftFoot', 'RightFoot'], emberEvery: .035, edge: [.4, .8],
};
export const FLAME_EMPEROR: Blaze = {
  fighter: 'ace', name: 'flame-emperor',
  weights: { LeftHand: 1, RightHand: 1, LeftForeArm: 1, RightForeArm: 1, LeftArm: .9, RightArm: .9, LeftShoulder: .6, RightShoulder: .6 },
  chains: [['LeftHand', 'LeftForeArm', 'LeftArm', 'LeftShoulder'], ['RightHand', 'RightForeArm', 'RightArm', 'RightShoulder']],
  stations: [0, .5, 1, 1.5, 2, 2.6], perStation: 2, size: .5, taper: .06, ahead: .06,
  fire: [0xfff0c2, 0xff8a1c, 0xd8300a], white: new THREE.Color(1.5, 1.25, .8), heat: new THREE.Color(.95, .36, .06), heatBase: .45,
  thick: .028, lick: .09, embers: ['LeftHand', 'RightHand', 'LeftForeArm', 'RightForeArm', 'LeftArm', 'RightArm'], emberEvery: .035,
};

interface Part { source: THREE.SkinnedMesh; shell: THREE.SkinnedMesh; heat: THREE.SkinnedMesh }
interface Rig { fighter: Fighter; parts: Part[]; material: THREE.ShaderMaterial; heat: THREE.ShaderMaterial; used: number; shown: number; embers: (THREE.Object3D | undefined)[]; chains: (THREE.Object3D | undefined)[][]; nextEmber: number }

function warmMesh(material: THREE.Material, name: string) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .01, 0, .01, 0, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('aLeg', new THREE.Float32BufferAttribute([0, 0, 0], 1));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
  mesh.name = name; mesh.frustumCulled = false; mesh.visible = false;
  return mesh;
}

export class LimbFire {
  private rigs = new Map<Fighter, Rig>();
  private warm: THREE.SkinnedMesh[] = [];
  private frame = 0;
  private kit: VfxKit;
  private at = new THREE.Vector3(); private a = new THREE.Vector3(); private b = new THREE.Vector3();
  private transform = new THREE.Object3D(); private colour = new THREE.Color(); private toward = new THREE.Vector3(); private side = new THREE.Vector3();
  private points: THREE.Vector3[] = Array.from({ length: 6 }, () => new THREE.Vector3());
  constructor(private scene: THREE.Scene, readonly blaze: Blaze) { this.kit = VfxKit.for(scene); }

  private material() {
    const b = this.blaze;
    return new THREE.ShaderMaterial({
      name: 'IfritJambe', vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.BackSide,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uThick: { value: b.thick }, uLick: { value: b.lick }, uPush: { value: .35 },
        uCore: { value: new THREE.Color(b.fire[1]) }, uRim: { value: new THREE.Color(b.fire[2]) }, uWhite: { value: b.white.clone() }, uNoise: { value: noiseTexture() } },
      transparent: true, depthWrite: false, toneMapped: false,
    });
  }
  private heatMaterial() {
    return new THREE.ShaderMaterial({
      name: 'LimbHeat', vertexShader: HEAT_VERTEX, fragmentShader: HEAT_FRAGMENT,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uHeat: { value: this.blaze.heat.clone() }, uBase: { value: this.blaze.heatBase }, uNoise: { value: noiseTexture() } },
      transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, toneMapped: false, blending: THREE.AdditiveBlending,
    });
  }
  warmup() {
    if (this.warm.length) return;
    this.warm = [warmMesh(this.material(), `${this.blaze.name}-warmup`), warmMesh(this.heatMaterial(), `${this.blaze.name}-heat-warmup`)];
    this.scene.add(...this.warm);
  }
  hideWarmup() { for (const mesh of this.warm) mesh.visible = false; }

  private rig(fighter: Fighter) {
    let rig = this.rigs.get(fighter);
    if (rig) return rig;
    const b = this.blaze, material = this.material(), heat = this.heatMaterial(), parts: Part[] = [];
    const burning = new Map<THREE.Object3D, number>();
    for (const [name, weight] of Object.entries(b.weights)) { const bone = fighter.joints?.get(name); if (bone) burning.set(bone, weight); }
    fighter.model.traverse(o => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh || mesh.name.endsWith('-ink') || /outline|shadow/i.test(mesh.name)) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.some(m => m.transparent && m.opacity < .9)) return;
      const from = mesh.geometry, ids = from.attributes.skinIndex, weights = from.attributes.skinWeight;
      if (!ids || !weights) return;
      const bones = mesh.skeleton.bones.map(bone => burning.get(bone) ?? 0), leg = new Float32Array(ids.count);
      let any = false;
      for (let i = 0; i < leg.length; i++) {
        let w = 0;
        for (let j = 0; j < 4; j++) w += (bones[ids.getComponent(i, j)] ?? 0) * weights.getComponent(i, j);
        if (b.edge) w = THREE.MathUtils.smoothstep(w, b.edge[0], b.edge[1]);
        leg[i] = Math.min(1, w); if (w > .04) any = true;
      }
      if (!any) return;
      const geometry = new THREE.BufferGeometry();
      if (from.index) geometry.setIndex(from.index);
      for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) if (from.attributes[name]) geometry.setAttribute(name, from.attributes[name]);
      geometry.setAttribute('aLeg', new THREE.BufferAttribute(leg, 1));
      geometry.groups = from.groups.slice(); geometry.drawRange = { ...from.drawRange };
      const skin = (m: THREE.ShaderMaterial, name: string, order: number) => {
        const s = new THREE.SkinnedMesh(geometry, m);
        s.bindMode = mesh.bindMode; s.bindMatrix.copy(mesh.bindMatrix); s.bindMatrixInverse.copy(mesh.bindMatrixInverse); s.skeleton = mesh.skeleton;
        s.name = name; s.frustumCulled = false; s.visible = false; s.renderOrder = order; s.castShadow = s.receiveShadow = false;
        this.scene.add(s); return s;
      };
      parts.push({ source: mesh, shell: skin(material, b.name, 1), heat: skin(heat, `${b.name}-heat`, 2) });
    });
    rig = { fighter, parts, material, heat, used: 0, shown: 0, embers: b.embers.map(n => fighter.joints?.get(n)),
      chains: b.chains.map(chain => chain.map(n => fighter.joints?.get(n))), nextEmber: 0 };
    this.rigs.set(fighter, rig);
    return rig;
  }

  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, density: number, cards?: THREE.InstancedMesh, count = 0, budget = 0, eye?: THREE.Vector3) {
    this.frame++;
    const b = this.blaze;
    for (const fighter of fighters.values()) {
      const s = fighter.state;
      if (s.fighter !== b.fighter) continue;
      const rig = this.rig(fighter);
      rig.used = this.frame;
      const elapsed = s.actionTime * s.actionDuration;
      const entry = s.action === 'awaken' ? THREE.MathUtils.smoothstep(elapsed, AWAKENING_ENTRY * .2, AWAKENING_ENTRY * .8) : 1;
      const want = s.awakened && s.alive ? THREE.MathUtils.clamp((s.awakenedUntil ?? 0) - time, 0, 1) * entry : 0;
      rig.shown += (want - rig.shown) * (1 - Math.exp(-Math.min(.05, Math.max(0, dt)) * 9));
      if (want === 0 && rig.shown < .02) rig.shown = 0;
      const k = rig.shown * Math.max(.5, density);
      const u = rig.material.uniforms, h = rig.heat.uniforms;
      u.uTime.value = time; u.uStrength.value = k; h.uTime.value = time; h.uStrength.value = k;
      for (const part of rig.parts) {
        let visible = k > .01;
        for (let o: THREE.Object3D | null = part.source; o && visible; o = o.parent) { visible = o.visible; if (o === fighter.group) break; }
        part.shell.visible = part.heat.visible = visible;
        if (visible && part.source.bindMode !== THREE.AttachedBindMode) {
          part.shell.matrixAutoUpdate = part.heat.matrixAutoUpdate = false;
          part.shell.matrix.copy(part.source.matrixWorld); part.heat.matrix.copy(part.source.matrixWorld);
          part.shell.matrixWorldNeedsUpdate = part.heat.matrixWorldNeedsUpdate = true;
        }
      }
      if (cards && k > .02) count = this.flames(rig, fighter, time, k, density, cards, count, budget, eye);
      if (k > .05 && time >= rig.nextEmber) {
        rig.nextEmber = time + b.emberEvery / Math.max(.4, density);
        const joint = rig.embers[Math.floor(Math.random() * rig.embers.length)];
        if (joint) {
          joint.getWorldPosition(this.at);
          const sp = this.kit.sparks.spec, a = Math.random() * Math.PI * 2, r = .06 + Math.random() * .1;
          sp.reset(SPRITE.streak, time, .22 + Math.random() * .22).pos(this.at.x + Math.cos(a) * r, this.at.y + Math.random() * .25, this.at.z + Math.sin(a) * r).velocity(Math.cos(a) * .4, 1.2 + Math.random() * 1.2, Math.sin(a) * .4);
          sp.orient = ORIENT.velocity; sp.sized(.026, .012, .5); sp.stretch = 2.2; sp.trail = .03; sp.drag = 2; sp.gravity = -1;
          sp.hot(0xffffff, 1.7).cool(b.fire[2], 0); this.kit.sparks.emit();
        }
      }
    }
    for (const rig of this.rigs.values()) {
      if (rig.used === this.frame) continue;
      for (const part of rig.parts) part.shell.visible = part.heat.visible = false;
      if ((this.frame & 63) === 0) { let present = false; for (const f of fighters.values()) if (f === rig.fighter) { present = true; break; } if (!present) this.release(rig.fighter, rig); }
    }
    return count;
  }

  private flames(rig: Rig, fighter: Fighter, time: number, k: number, density: number, cards: THREE.InstancedMesh, count: number, budget: number, eye?: THREE.Vector3) {
    const b = this.blaze, base = fighter.group.position, facing = eye ? Math.atan2(eye.x - base.x, eye.z - base.z) : 0;
    const toward = this.toward.set(Math.sin(facing), 0, Math.cos(facing)), side = this.side.set(toward.z, 0, -toward.x);
    const per = density < .6 ? Math.max(1, b.perStation - 1) : b.perStation;
    for (let c = 0; c < rig.chains.length; c++) {
      const chain = rig.chains[c];
      let joints = 0;
      for (let j = 0; j < chain.length && chain[j]; j++) { chain[j]!.getWorldPosition(this.points[j]); joints = j + 1; }
      if (joints < 2) continue;
      for (let i = 0; i < b.stations.length; i++) {
        const t = Math.min(b.stations[i], joints - 1), seg = Math.min(joints - 2, Math.floor(t));
        this.at.lerpVectors(this.points[seg], this.points[seg + 1], t - seg);
        for (let j = 0; j < per && count < budget; j++) {
          const n = c * 32 + i * 4 + j, phase = (time * (1.5 + (n % 3) * .35) + n * .618) % 1;
          const across = Math.sin(n * 2.399963 + time * .9) * .075, height = (b.size + b.taper * i) * (.55 + .45 * Math.sin(phase * Math.PI)) * k;
          this.transform.position.set(this.at.x + toward.x * b.ahead + side.x * across, this.at.y + height * .42, this.at.z + toward.z * b.ahead + side.z * across);
          this.transform.rotation.set(0, facing, 0);
          this.transform.scale.set(height * .7, height, 1);
          this.transform.updateMatrix();
          cards.setMatrixAt(count, this.transform.matrix);
          cards.setColorAt(count++, this.colour.set(b.fire[n % 3]));
        }
      }
    }
    return count;
  }

  private release(fighter: Fighter, rig: Rig) {
    for (const part of rig.parts) {
      part.shell.removeFromParent(); part.heat.removeFromParent();
      const g = part.shell.geometry; g.index = null; for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) g.deleteAttribute(name); g.dispose();
    }
    rig.material.dispose(); rig.heat.dispose(); this.rigs.delete(fighter);
  }
  get shellCount() { let n = 0; for (const rig of this.rigs.values()) for (const part of rig.parts) if (part.shell.visible) n++; return n; }
  reset() { for (const rig of this.rigs.values()) { rig.shown = 0; for (const part of rig.parts) part.shell.visible = part.heat.visible = false; } }
  dispose() {
    for (const rig of [...this.rigs.values()]) this.release(rig.fighter, rig);
    for (const mesh of this.warm) { mesh.removeFromParent(); (mesh.material as THREE.Material).dispose(); mesh.geometry.dispose(); }
    this.warm = [];
    this.kit.release();
  }
}

export class IfritJambe extends LimbFire {
  constructor(scene: THREE.Scene) { super(scene, IFRIT); }
}
