import * as THREE from 'three';
import type { Fighter } from '../Fighter';
import { AWAKENINGS } from '../../game/awakening';
import { VEIL, VEIL_GLSL, veilUniforms } from './VictimVeil';
import { FIGHTERS } from '../../config';
import { GHOST_FADE, ghostScale } from '../closeStyle';
import { DREAM_IMPACT } from '../dreamFlag';

const VERTEX = `
#include <common>
#include <skinning_pars_vertex>
uniform float uInk;
varying vec3 vNormalV; varying vec3 vViewV; varying vec3 vVeil;
void main(){
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec3 n = normalize(normalMatrix * objectNormal);
  vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
  vNormalV = n; vViewV = -mv.xyz; vVeil = (modelMatrix * vec4(transformed, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
  // The ink hull: the same body pushed out across the screen by a fixed
  // number of pixels, whatever its distance. Zero for the fill and depth.
  vec2 across = n.xy; float l = length(across);
  if (uInk > 0.0 && l > 1e-4) gl_Position.xy += across / l * vec2(projectionMatrix[0][0] / projectionMatrix[1][1], 1.0) * uInk * gl_Position.w;
}`;

const LENS = `
uniform vec3 uLens; uniform float uNearScale;
float lensFade( vec3 world ) { return 1.0 - uLens.x * ( 1.0 - smoothstep( uLens.y * uNearScale, uLens.z * uNearScale, distance( world, cameraPosition ) ) ); }
`;

const FILL = `
uniform vec3 uTint; uniform float uOpacity; uniform float uVeilStrength;
varying vec3 vNormalV; varying vec3 vViewV; varying vec3 vVeil;
${VEIL_GLSL}
${LENS}
void main(){
  // A printed pose rather than glass: two flat tones of the tint off a light
  // from above the lens, and a thin white rim at the silhouette.
  vec3 n = normalize(vNormalV);
  float d = dot(n, normalize(vec3(-.3, .75, .55))), soft = fwidth(d) + .01;
  // Kept under the bloom threshold (1.0): a ghost is a printed pose, not a light.
  // Close tones: some rigs carry sculpted normals, and a hard split on them
  // mottles the pose like camouflage.
  vec3 col = uTint * mix(.72, .95, smoothstep(.1 - soft, .1 + soft, d));
  float edge = 1.0 - abs(dot(n, normalize(vViewV)));
  col = mix(col, vec3(1.0), smoothstep(.74, .8, edge) * .7);
  // A ghost left over the body it is chasing is see-through there (VictimVeil).
  gl_FragColor = vec4(col * uOpacity, uOpacity) * victimVeil(vVeil, uVeilStrength) * lensFade(vVeil);
}`;
const INK = `
uniform float uOpacity; uniform float uVeilStrength;
varying vec3 vVeil;
${VEIL_GLSL}
${LENS}
void main(){ gl_FragColor = vec4(vec3(.012, .014, .03) * uOpacity, uOpacity) * victimVeil(vVeil, uVeilStrength) * lensFade(vVeil); }`;
const DEPTH = `
varying vec3 vVeil;
${LENS}
void main(){ if ( lensFade( vVeil ) < .02 ) discard; gl_FragColor = vec4(0.0); }`;
const INK_WIDTH = 2 * 2.4 / 1080;

class FrozenSkeleton extends THREE.Skeleton {
  private static scratch = new THREE.Matrix4();
  update() {}
  capture(source: THREE.Skeleton, carry: THREE.Matrix4) {
    const out = this.boneMatrices!, m = FrozenSkeleton.scratch;
    for (let i = 0; i < source.bones.length; i++) {
      const bone = source.bones[i];
      m.multiplyMatrices(carry, bone ? bone.matrixWorld : m.identity());
      m.multiply(source.boneInverses[i]).toArray(out, i * 16);
    }
    if (this.boneTexture) this.boneTexture.needsUpdate = true;
  }
}

interface GhostPart { source: THREE.Mesh; ghost: THREE.Mesh; depth: THREE.Mesh; ink: THREE.Mesh; skeleton?: FrozenSkeleton }
interface GhostBody { parts: GhostPart[]; material: THREE.ShaderMaterial; inkMaterial: THREE.ShaderMaterial; depthMaterial: THREE.ShaderMaterial; born: number; life: number; opacity: number; active: boolean }
interface Pool { bodies: GhostBody[]; geometries: THREE.BufferGeometry[]; next: number }

const carry = new THREE.Matrix4(), offsetMatrix = new THREE.Matrix4(), bindInverse = new THREE.Matrix4();

export class Afterimages {
  private pools = new Map<Fighter, Pool>();
  private warm: THREE.Object3D[] = [];
  private captured = new Set<FrozenSkeleton>();
  constructor(private scene: THREE.Scene, private perFighter = 5) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .01, 0, .01, 0, 0], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const bone = new THREE.Bone();
    for (const material of [this.material(), this.inkMaterial(), this.depth()]) {
      const skinned = new THREE.SkinnedMesh(geometry, material);
      skinned.add(bone.clone()); skinned.bind(new THREE.Skeleton([skinned.children[0] as THREE.Bone]));
      const rigid = new THREE.Mesh(geometry, material);
      for (const mesh of [skinned, rigid]) { mesh.name = 'afterimage-warmup'; mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh); this.warm.push(mesh); }
    }
  }

  private material() {
    return new THREE.ShaderMaterial({
      name: 'Afterimage', vertexShader: VERTEX, fragmentShader: FILL,
      uniforms: { uTint: { value: new THREE.Color(0x9fe6ff) }, uOpacity: { value: 0 }, uInk: { value: 0 }, uLens: GHOST_FADE, uNearScale: { value: 1 }, ...veilUniforms(VEIL.ghost) },
      transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  }
  private inkMaterial() {
    return new THREE.ShaderMaterial({
      name: 'AfterimageInk', vertexShader: VERTEX, fragmentShader: INK, side: THREE.BackSide,
      uniforms: { uOpacity: { value: 0 }, uInk: { value: INK_WIDTH }, uLens: GHOST_FADE, uNearScale: { value: 1 }, ...veilUniforms(VEIL.ghost) },
      transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  }

  private depth() {
    return new THREE.ShaderMaterial({ name: 'AfterimageDepth', vertexShader: VERTEX, fragmentShader: DEPTH, uniforms: { uInk: { value: 0 }, uLens: GHOST_FADE, uNearScale: { value: 1 } },
      transparent: true, colorWrite: false, depthWrite: true });
  }

  prepare(fighter: Fighter) {
    if (this.pools.has(fighter)) return;
    const sources: THREE.Mesh[] = [];
    const summon = AWAKENINGS[fighter.state.fighter].kind === 'summon';
    const walk = (o: THREE.Object3D) => {
      if (o !== fighter.group && summon && o.name.startsWith('fighter-')) return;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh && !mesh.name.endsWith('-ink') && mesh.name !== 'contact-shadow' && !/outline/i.test(mesh.name)) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (!(mesh.name.startsWith('awaken-on') && materials.some(m => m.transparent))) sources.push(mesh);
      }
      for (const child of o.children) walk(child);
    };
    walk(fighter.group);
    const geometries = sources.map(mesh => {
      const geometry = new THREE.BufferGeometry(), from = mesh.geometry;
      if (from.index) geometry.setIndex(from.index);
      for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) if (from.attributes[name]) geometry.setAttribute(name, from.attributes[name]);
      geometry.groups = from.groups.slice(); geometry.drawRange = { ...from.drawRange };
      return geometry;
    });
    const bodies: GhostBody[] = [];
    for (let b = 0; b < this.perFighter; b++) {
      const material = this.material(), inkMaterial = this.inkMaterial(), depthMaterial = this.depth(), parts: GhostPart[] = [];
      const shared = new Map<THREE.Skeleton, FrozenSkeleton>();
      sources.forEach((source, i) => {
        const skinned = source as THREE.SkinnedMesh;
        let skeleton: FrozenSkeleton | undefined;
        if (skinned.isSkinnedMesh) {
          const attached = skinned.bindMode === THREE.AttachedBindMode;
          skeleton = attached ? shared.get(skinned.skeleton) : undefined;
          if (!skeleton) { skeleton = new FrozenSkeleton(skinned.skeleton.bones, skinned.skeleton.boneInverses); if (attached) shared.set(skinned.skeleton, skeleton); }
        }
        const make = (m: THREE.Material, name: string, order: number) => {
          let mesh: THREE.Mesh;
          if (skeleton) { const sm = new THREE.SkinnedMesh(geometries[i], m); sm.bindMatrix.copy(skinned.bindMatrix); sm.skeleton = skeleton; mesh = sm; } else mesh = new THREE.Mesh(geometries[i], m);
          mesh.name = name; mesh.frustumCulled = false; mesh.visible = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = order;
          mesh.castShadow = mesh.receiveShadow = false; this.scene.add(mesh); return mesh;
        };
        parts.push({ source, depth: make(depthMaterial, 'afterimage-depth', 7), ink: make(inkMaterial, 'afterimage-ink', 8), ghost: make(material, 'afterimage', 9), skeleton });
      });
      bodies.push({ parts, material, inkMaterial, depthMaterial, born: 0, life: 0, opacity: 0, active: false });
    }
    this.pools.set(fighter, { bodies, geometries, next: 0 });
  }

  spawn(fighter: Fighter, tint: number, born: number, life: number, opacity = .8, offset?: THREE.Vector3) {
    if (DREAM_IMPACT) { opacity *= .5; life *= .65; }
    this.prepare(fighter);
    const pool = this.pools.get(fighter)!;
    const body = pool.bodies[pool.next]; pool.next = (pool.next + 1) % pool.bodies.length;
    fighter.group.updateMatrixWorld(true);
    offsetMatrix.identity(); if (offset) offsetMatrix.setPosition(offset);
    const captured = this.captured; captured.clear();
    let any = false;
    for (const part of body.parts) {
      let visible = true;
      for (let o: THREE.Object3D | null = part.source; o && visible; o = o.parent) { visible = o.visible; if (o === fighter.group) break; }
      part.ghost.visible = part.depth.visible = part.ink.visible = visible;
      if (!visible) continue;
      any = true;
      const skinned = part.source as THREE.SkinnedMesh;
      if (part.skeleton) {
        if (captured.has(part.skeleton)) continue;
        captured.add(part.skeleton);
        bindInverse.copy(skinned.bindMatrixInverse);
        carry.multiplyMatrices(offsetMatrix, skinned.matrixWorld).multiply(bindInverse);
        part.skeleton.capture(skinned.skeleton, carry);
      } else {
        for (const mesh of [part.ghost, part.depth, part.ink]) { mesh.matrix.multiplyMatrices(offsetMatrix, part.source.matrixWorld); mesh.matrixWorldNeedsUpdate = true; }
      }
    }
    body.active = any; body.born = born; body.life = life; body.opacity = opacity;
    (body.material.uniforms.uTint.value as THREE.Color).setHex(tint);
    const scale = ghostScale(FIGHTERS[fighter.state.fighter]?.height);
    body.material.uniforms.uNearScale.value = body.inkMaterial.uniforms.uNearScale.value = body.depthMaterial.uniforms.uNearScale.value = scale;
    body.material.uniforms.uOpacity.value = 0; body.inkMaterial.uniforms.uOpacity.value = 0;
  }

  update(time: number) {
    for (const pool of this.pools.values()) for (const body of pool.bodies) {
      if (!body.active) continue;
      const t = (time - body.born) / body.life;
      if (t >= 1 || t < -1) { body.active = false; for (const part of body.parts) part.ghost.visible = part.depth.visible = part.ink.visible = false; continue; }
      const k = t < 0 ? 0 : 1 - Math.pow(Math.max(0, t - .25) / .75, 1.3);
      body.material.uniforms.uOpacity.value = body.opacity * k;
      body.inkMaterial.uniforms.uOpacity.value = Math.min(1, body.opacity * 1.15) * k;
    }
  }

  retain(fighters: ReadonlyMap<string, Fighter>) {
    for (const [fighter, pool] of this.pools) {
      let present = false; for (const f of fighters.values()) if (f === fighter) { present = true; break; }
      if (!present) { this.releasePool(pool); this.pools.delete(fighter); }
    }
  }

  private releasePool(pool: Pool) {
    for (const body of pool.bodies) { for (const part of body.parts) { part.ghost.removeFromParent(); part.depth.removeFromParent(); part.ink.removeFromParent(); part.skeleton?.boneTexture?.dispose(); } body.material.dispose(); body.inkMaterial.dispose(); body.depthMaterial.dispose(); }
    for (const geometry of pool.geometries) { geometry.index = null; geometry.attributes = {}; geometry.dispose(); }
  }

  get activeCount() { let n = 0; for (const pool of this.pools.values()) for (const body of pool.bodies) if (body.active) n++; return n; }
  clear() { for (const pool of this.pools.values()) for (const body of pool.bodies) { body.active = false; for (const part of body.parts) part.ghost.visible = part.depth.visible = part.ink.visible = false; } }
  dispose() {
    for (const pool of this.pools.values()) this.releasePool(pool);
    this.pools.clear();
    const materials = new Set<THREE.Material>();
    for (const mesh of this.warm) { mesh.removeFromParent(); materials.add((mesh as THREE.Mesh).material as THREE.Material); }
    for (const m of materials) m.dispose();
    (this.warm[0] as THREE.Mesh | undefined)?.geometry.dispose(); this.warm = [];
  }
}
