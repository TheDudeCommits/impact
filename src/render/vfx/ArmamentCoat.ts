import * as THREE from 'three';
import type { Fighter } from '../Fighter';
import { resolveSkeleton, type Canonical } from '../skeleton';
import { noiseTexture, NOISE_GLSL } from './noiseTexture';

export type CoatPart = 'hands' | 'arms' | 'legs' | 'feet' | 'weapon';
const ROOTS: Record<Exclude<CoatPart, 'weapon'>, readonly Canonical[]> = {
  hands: ['LeftHand', 'RightHand'], arms: ['LeftForeArm', 'RightForeArm'], legs: ['LeftLeg', 'RightLeg'], feet: ['LeftFoot', 'RightFoot'],
};
const WEAPON = /weapon|blade|sword|katana|kanabo|bisento|naginata|wuqi/i, SHEATH = /sheath|saya|scabbard|shoulder|scapula/i;

const VERTEX = `
#include <common>
#include <skinning_pars_vertex>
attribute float aCoat;
uniform float uPush;
varying vec3 vNormalW; varying vec3 vWorld; varying float vCoat; varying vec3 vRest;
void main(){
  vRest = position;
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  // A hair off the surface it covers, so it is never fought for by the body's own depth.
  world.xyz += n * uPush;
  vNormalW = n; vWorld = world.xyz; vCoat = aCoat;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = `
uniform vec3 uEdge; uniform float uStrength; uniform float uTime; uniform float uGrain;
varying vec3 vNormalW; varying vec3 vWorld; varying float vCoat; varying vec3 vRest;
${NOISE_GLSL}
const vec3 KEY = vec3(-.3665, .7330, .4123);
void main(){
  // Where the limb's weights end the black ends, torn: noise in the body's own rest space, so the edge stays where
  // it is on the arm however the arm moves, creeping a little.
  float n = tnoise(vec2(vRest.x + vRest.z, vRest.y) * uGrain + vec2(0., uTime * .11)).g;
  float m = vCoat + (n - .5) * .34;
  float cover = smoothstep(.42, .5, m) * uStrength;
  if (cover < .01) discard;
  vec3 N = normalize(vNormalW), V = normalize(cameraPosition - vWorld);
  float facing = max(dot(N, V), 0.);
  // Lacquer: near black, one hard highlight where it turns to the key light, and the Haki's own colour along the
  // rim where it turns from the lens and at the torn edge.
  float shine = step(.9, dot(N, normalize(KEY + V))) * .5 + step(.972, dot(N, normalize(KEY + V))) * .5;
  float rim = smoothstep(.62, .95, 1. - facing);
  float edge = 1. - smoothstep(.5, .6, m);
  vec3 col = vec3(.016, .012, .022) + vec3(.42, .4, .52) * shine + uEdge * (rim * .5 + edge * .9);
  gl_FragColor = vec4(col, cover);
}`;

function coatSources(fighter: Fighter) {
  const out: THREE.SkinnedMesh[] = [];
  fighter.group.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton || mesh.name.endsWith('-ink') || /outline|shadow/i.test(mesh.name)) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (materials.some(m => m.transparent && m.opacity < .9)) return;
    out.push(mesh);
  });
  return out;
}

export function coatMask(mesh: THREE.SkinnedMesh, parts: readonly CoatPart[]): Float32Array | null {
  const geometry = mesh.geometry, index = geometry.attributes.skinIndex, weight = geometry.attributes.skinWeight, bones = mesh.skeleton.bones;
  if (!index || !weight) return null;
  const count = index.count, mask = new Float32Array(count);
  const weapon = parts.includes('weapon');
  if (weapon && WEAPON.test(mesh.name) && !SHEATH.test(mesh.name)) return mask.fill(1);
  const marked = new Uint8Array(bones.length), at = new Map<THREE.Object3D, number>();
  bones.forEach((bone, i) => at.set(bone, i));
  const mark = (bone: THREE.Object3D) => { const i = at.get(bone); if (i !== undefined) marked[i] = 1; for (const child of bone.children) mark(child); };
  const named = resolveSkeleton(bones.map(bone => bone.name));
  for (const part of parts) {
    if (part === 'weapon') continue;
    for (const joint of ROOTS[part]) { const actual = named.get(joint), bone = actual === undefined ? undefined : bones.find(b => b.name === actual); if (bone) mark(bone); }
  }
  bones.forEach((bone, i) => { const is = WEAPON.test(bone.name) && !SHEATH.test(bone.name); if (is && !weapon) unmark(bone, at, marked); else if (is && weapon) marked[i] = 2; });
  if (weapon) bones.forEach((bone, i) => { if (marked[i] === 2) for (const child of bone.children) markAll(child, at, marked); });
  let most = 0;
  for (let v = 0; v < count; v++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) { const w = weight.getComponent(v, k); if (w > 0 && marked[index.getComponent(v, k)]) sum += w; }
    mask[v] = sum; if (sum > most) most = sum;
  }
  return most >= .5 ? mask : null;
}
function unmark(bone: THREE.Object3D, at: Map<THREE.Object3D, number>, marked: Uint8Array) { const i = at.get(bone); if (i !== undefined) marked[i] = 0; for (const child of bone.children) unmark(child, at, marked); }
function markAll(bone: THREE.Object3D, at: Map<THREE.Object3D, number>, marked: Uint8Array) { const i = at.get(bone); if (i !== undefined && !SHEATH.test(bone.name)) marked[i] = 2; for (const child of bone.children) markAll(child, at, marked); }

interface Rig { parts: { source: THREE.SkinnedMesh; coat: THREE.SkinnedMesh }[]; material: THREE.ShaderMaterial; used: number }

export class ArmamentCoat {
  private rigs = new Map<Fighter, Rig>();
  private warm?: THREE.SkinnedMesh;
  private frame = 0;
  constructor(private scene: THREE.Scene) {}

  private material() {
    return new THREE.ShaderMaterial({
      name: 'ArmamentCoat', vertexShader: VERTEX, fragmentShader: FRAGMENT, side: THREE.FrontSide,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uPush: { value: .003 }, uGrain: { value: 1.6 }, uEdge: { value: new THREE.Color() }, uNoise: { value: noiseTexture() } },
      transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
  }

  warmup() {
    if (this.warm) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .01, 0, .01, 0, 0], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    geometry.setAttribute('aCoat', new THREE.Float32BufferAttribute([1, 1, 1], 1));
    const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, this.material());
    mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
    mesh.name = 'armament-coat-warmup'; mesh.frustumCulled = false; mesh.visible = false;
    this.scene.add(mesh); this.warm = mesh;
  }
  hideWarmup() { if (this.warm) this.warm.visible = false; }

  private rig(fighter: Fighter, parts: readonly CoatPart[]) {
    let rig = this.rigs.get(fighter);
    if (rig) return rig;
    const material = this.material(), made: Rig['parts'] = [];
    let span = 0;
    for (const source of coatSources(fighter)) {
      const mask = coatMask(source, parts);
      if (!mask) continue;
      const geometry = new THREE.BufferGeometry(), from = source.geometry;
      if (from.index) geometry.setIndex(from.index);
      for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) if (from.attributes[name]) geometry.setAttribute(name, from.attributes[name]);
      geometry.setAttribute('aCoat', new THREE.BufferAttribute(mask, 1));
      geometry.groups = from.groups.slice(); geometry.drawRange = { ...from.drawRange };
      if (!from.boundingBox) from.computeBoundingBox();
      if (from.boundingBox) span = Math.max(span, from.boundingBox.max.y - from.boundingBox.min.y);
      const coat = new THREE.SkinnedMesh(geometry, material);
      coat.bindMode = source.bindMode; coat.bindMatrix.copy(source.bindMatrix); coat.bindMatrixInverse.copy(source.bindMatrixInverse); coat.skeleton = source.skeleton;
      coat.name = 'armament-coat'; coat.frustumCulled = false; coat.visible = false; coat.renderOrder = 2;
      coat.castShadow = coat.receiveShadow = false;
      this.scene.add(coat);
      made.push({ source, coat });
    }
    material.uniforms.uGrain.value = 2.8 / Math.max(.2, span || 1.7);
    rig = { parts: made, material, used: 0 };
    this.rigs.set(fighter, rig);
    return rig;
  }

  draw(fighter: Fighter, time: number, strength: number, parts: readonly CoatPart[], edge: THREE.Color) {
    const rig = this.rig(fighter, parts), u = rig.material.uniforms;
    u.uTime.value = time; u.uStrength.value = strength; rig.used = this.frame;
    (u.uEdge.value as THREE.Color).copy(edge);
    for (const part of rig.parts) {
      let visible = strength > .01;
      for (let o: THREE.Object3D | null = part.source; o && visible; o = o.parent) { visible = o.visible; if (o === fighter.group) break; }
      part.coat.visible = visible;
      if (visible && part.source.bindMode !== THREE.AttachedBindMode) { part.coat.matrixAutoUpdate = false; part.coat.matrix.copy(part.source.matrixWorld); part.coat.matrixWorldNeedsUpdate = true; }
    }
  }

  begin() { this.frame++; }
  end(fighters: ReadonlyMap<string, Fighter>) {
    for (const [fighter, rig] of this.rigs) {
      if (rig.used !== this.frame) for (const part of rig.parts) part.coat.visible = false;
      if ((this.frame & 63) === 0) { let present = false; for (const f of fighters.values()) if (f === fighter) { present = true; break; } if (!present) this.release(fighter, rig); }
    }
  }

  private release(fighter: Fighter, rig: Rig) {
    for (const part of rig.parts) { part.coat.removeFromParent(); part.coat.geometry.index = null; const mask = part.coat.geometry.attributes.aCoat; part.coat.geometry.attributes = mask ? { aCoat: mask } : {}; part.coat.geometry.dispose(); }
    rig.material.dispose(); this.rigs.delete(fighter);
  }
  get count() { let n = 0; for (const rig of this.rigs.values()) for (const part of rig.parts) if (part.coat.visible) n++; return n; }
  reset() { for (const rig of this.rigs.values()) for (const part of rig.parts) part.coat.visible = false; }
  dispose() {
    for (const [fighter, rig] of this.rigs) this.release(fighter, rig);
    if (this.warm) { this.warm.removeFromParent(); (this.warm.material as THREE.Material).dispose(); this.warm.geometry.dispose(); this.warm = undefined; }
  }
}
