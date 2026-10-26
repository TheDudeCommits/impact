import * as THREE from 'three';
import { sceneShown } from '../../emptyInstances';
import { frame } from './vendor/core/FrameUniforms.js';
import { LAYER } from './vendor/core/Layers.js';
import { ParticleEngine } from './vendor/particles/ParticleEngine.js';
import { DecalSystem } from './vendor/effects/GroundDecals.js';
import { BurstSystem } from './vendor/effects/BurstSphere.js';
import { FissureSystem } from './vendor/effects/GroundFissures.js';
import { sceneHooks } from './vendor/vfx/SceneHooks.js';
import { settings } from './vendor/config/settings.js';
import { patchOnBeforeCompile } from './vendor/utils/shaderPatch.js';
import { noiseGLSL } from './vendor/shaders/lib/noise.glsl.js';
import type { EffectLayer } from '../engine/Effect';
import type { Fighter } from '../../Fighter';
import { effekseerLoaded } from './effekseer';
import { skipHiddenChildren } from '../../hiddenMatrices';
import type { ArmoryContext, ArmoryFlashApi, ArmoryLightHandle, ArmoryLightsApi, ArmoryShakeApi } from './types';


export const GAME_LAYER = 0;

const LENS = { value: new THREE.Vector2(.5, 2.2) };
const MAIN = /void\s+main\s*\(\s*(?:void\s*)?\)/;
const NOISE_FNS = [...String(noiseGLSL).matchAll(/\b(?:float|vec[234])\s+(\w+)\s*\(/g)].map(m => m[1]);
const NOISE_DEFINED = new RegExp(`\\b(?:float|vec[234])\\s+(?:${NOISE_FNS.join('|')})\\s*\\(`);
function ensureNoise(shader: { vertexShader: string; fragmentShader: string }) {
  for (const stage of ['vertexShader', 'fragmentShader'] as const) {
    const src = shader[stage];
    if (src.includes('#include <common>') && NOISE_FNS.some(fn => src.includes(`${fn}(`)) && !NOISE_DEFINED.test(src)) shader[stage] = src.replace('#include <common>', `#include <common>\n${noiseGLSL}`);
  }
}

function lensFade(shader: { uniforms: Record<string, unknown>; fragmentShader: string }) {
  const src = shader.fragmentShader;
  if (!MAIN.test(src) || !(src.includes('gl_FragColor') || src.includes('_fragment>'))) return;
  shader.uniforms.armoryLens = LENS;
  shader.uniforms.armoryNear = frame.uCameraNear;
  shader.uniforms.armoryFar = frame.uCameraFar;
  shader.fragmentShader = `uniform vec2 armoryLens;\nuniform float armoryNear;\nuniform float armoryFar;\n${src.replace(MAIN, 'void armoryLensMain()')}
void main() {
  armoryLensMain();
  float armoryDepth = (armoryNear * armoryFar) / (armoryFar - gl_FragCoord.z * (armoryFar - armoryNear));
  gl_FragColor *= smoothstep(armoryLens.x, armoryLens.y, armoryDepth);
}
`;
}
const GAME_MASK = 1 << GAME_LAYER, DISTORTION_MASK = 1 << LAYER.DISTORTION;

function adaptNode(node: THREE.Object3D, adapted: WeakSet<object>, clock?: { value: number }, delta?: { value: number }) {
  const mask = node.layers.mask;
  if (mask !== GAME_MASK && mask !== DISTORTION_MASK) node.layers.set(GAME_LAYER);
  const mesh = node as THREE.Mesh;
  if (!mesh.material) return;
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    if (adapted.has(material)) continue;
    adapted.add(material);
    if (material.transparent && material.side === THREE.DoubleSide) material.forceSinglePass = true;
    if (material.transparent && material.depthTest !== false && !(material as THREE.RawShaderMaterial).isRawShaderMaterial) patchOnBeforeCompile(material, lensFade);
    if (!(material as THREE.RawShaderMaterial).isRawShaderMaterial && !(material as THREE.ShaderMaterial).isShaderMaterial) patchOnBeforeCompile(material, ensureNoise);
    const uniforms = (material as THREE.ShaderMaterial).uniforms;
    if (uniforms && clock && delta) {
      if (uniforms.uTime === frame.uTime) uniforms.uTime = clock;
      if (uniforms.uDelta === frame.uDelta) uniforms.uDelta = delta;
    }
  }
}

const SHARED = new Set(['fxlib:QuarksBatch']);
const OWN_UPDATE = Symbol('armory.ownUpdate');

const hosts = new WeakMap<THREE.Scene, ArmoryHost>();
const hooked = new WeakSet<THREE.Scene>();
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector2();

function hook(scene: THREE.Scene) {
  if (hooked.has(scene)) return;
  hooked.add(scene);
  const before = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, s, camera, geometry, material, group) {
    before.call(this, renderer, s, camera, geometry, material, group);
    hosts.get(scene)?.seen(renderer, camera);
  };
}

interface LightSlot { inUse: boolean; target: number; intensity: number; distance: number; readonly position: THREE.Vector3; readonly color: THREE.Color }
const LIGHT_SLOTS = 4;

export class SpaceLights implements ArmoryLightsApi {
  readonly slots: LightSlot[] = Array.from({ length: LIGHT_SLOTS }, () => ({ inUse: false, target: 0, intensity: 0, distance: 1, position: new THREE.Vector3(), color: new THREE.Color() }));
  acquire(): ArmoryLightHandle {
    for (const slot of this.slots) if (!slot.inUse) { slot.inUse = true; slot.target = 0; slot.intensity = 0; return slot; }
    return null;
  }
  set(handle: ArmoryLightHandle, position: THREE.Vector3, color: THREE.Color, intensity: number, distance: number, dt: number) {
    const slot = handle as LightSlot | null;
    if (!slot) return;
    slot.position.copy(position); slot.color.copy(color);
    slot.target = intensity * settings.global.lightIntensity;
    slot.intensity = THREE.MathUtils.lerp(slot.target, slot.intensity, Math.pow(.0005, dt));
    slot.distance = distance * settings.global.lightRadius;
  }
  release(handle: ArmoryLightHandle) { const slot = handle as LightSlot | null; if (slot) { slot.inUse = false; slot.target = 0; } }
  update(dt: number) { for (const slot of this.slots) if (!slot.inUse && slot.intensity > .001) slot.intensity = THREE.MathUtils.lerp(0, slot.intensity, Math.pow(.0001, dt)); }
  reset() { for (const slot of this.slots) { slot.inUse = false; slot.target = 0; slot.intensity = 0; } }
  dispose() { this.reset(); }
  flush(matrix: THREE.Matrix4, request: ((x: number, y: number, z: number, hex: number, intensity: number, distance: number) => void) | undefined, gain = 1, reach = 1) {
    if (!request) return;
    for (const slot of this.slots) {
      if (slot.intensity <= .02) continue;
      _v.copy(slot.position).applyMatrix4(matrix);
      request(_v.x, _v.y, _v.z, slot.color.getHex(), slot.intensity * gain, slot.distance * reach);
    }
  }
}


export interface SpaceBodies { fighters: ReadonlyMap<string, Fighter>; actor?: string }
const spacesByContext = new WeakMap<object, ArmorySpace>();
export function spaceOfContext(ctx: object): ArmorySpace | undefined { return spacesByContext.get(ctx); }

export class ArmorySpace {
  readonly root = new THREE.Group();
  readonly ctx: ArmoryContext;
  readonly particles: { flush(): void; reset(): void; dispose(): void; systems: Map<string, unknown> };
  readonly decals: { spawn(type: unknown, position: THREE.Vector3, options?: Record<string, unknown>): unknown; update(dt: number): void; clear(): void; dispose(): void; pools: Map<unknown, { free: { mesh: THREE.Object3D }[] }>; group: THREE.Group; _poolFor(type: unknown): { acquire(): { mesh: THREE.Object3D }; release(item: unknown): void; free: unknown[] } };
  readonly bursts: { spawn(mode: unknown, position: THREE.Vector3, options?: Record<string, unknown>): unknown; update(dt: number): void; clear(): void; dispose(): void; pools: Map<unknown, { free: { mesh: THREE.Object3D }[] }>; group: THREE.Group; _poolFor(mode: unknown): { acquire(): { mesh: THREE.Object3D }; release(item: unknown): void; free: unknown[] } };
  readonly fissures: { update(dt: number): void; clear(): void; dispose(): void; pool: { acquire(): { group: THREE.Object3D }; release(item: unknown): void; free: { group: THREE.Object3D }[] }; group: THREE.Group };
  readonly lights = new SpaceLights();
  readonly clock = { value: 0 };
  readonly delta = { value: 0 };
  readonly camera = new THREE.PerspectiveCamera();
  flashTo?: (color: THREE.Color, strength: number) => void;
  onHit?: (intensity: number) => void;
  bodies?: SpaceBodies;
  burstScale = 1;
  burstOpacity = 1;
  decalScale = 1;
  private readonly burstOptions: Record<string, unknown> = {};
  private readonly decalOptions: Record<string, unknown> = {};
  private readonly held: { release(): void }[] = [];
  private readonly adapted = new WeakSet<object>();
  private readonly emitters = new Set<THREE.Object3D>();
  private drawing = false;

  constructor(readonly host: ArmoryHost, name: string) {
    this.root.name = `armory-space:${name}`;
    this.root.matrixAutoUpdate = false;
    this.root.visible = false;
    host.root.add(this.root);
    this.particles = new ParticleEngine(this.root);
    this.decals = new DecalSystem(this.root);
    this.bursts = new BurstSystem(this.root);
    this.fissures = new FissureSystem(this.root);
    const spawnBurst = this.bursts.spawn.bind(this.bursts), spawnDecal = this.decals.spawn.bind(this.decals);
    this.bursts.spawn = (mode, position, options = {}) => {
      this.onHit?.(.5);
      const o = this.burstOptions;
      for (const key in o) delete o[key];
      Object.assign(o, options);
      o.radius = ((options.radius as number | undefined) ?? .4) * this.burstScale;
      o.endRadius = ((options.endRadius as number | undefined) ?? 3) * this.burstScale;
      o.opacity = ((options.opacity as number | undefined) ?? 1) * this.burstOpacity;
      return spawnBurst(mode, position, o);
    };
    this.decals.spawn = (type, position, options = {}) => {
      const o = this.decalOptions;
      for (const key in o) delete o[key];
      Object.assign(o, options);
      o.radius = ((options.radius as number | undefined) ?? 2) * this.decalScale;
      return spawnDecal(type, position, o);
    };
    const flash: ArmoryFlashApi = { trigger: (color, strength) => { this.onHit?.(Math.min(3, strength ?? 0)); this.flashTo?.(color, strength); }, update() {}, reset() {} };
    const shake: ArmoryShakeApi = { add: amount => this.onHit?.(Math.min(3, amount ?? 0)), rumble() {}, update() {}, reset() {} };
    const environment = {
      scene: this.root, equirect: null,
      registerShadowCaster: <M>(material: M) => material,
      registerShadowCasterWithPatch: <M>(material: M, patch: unknown) => { patchOnBeforeCompile(material, patch); patchOnBeforeCompile(material, ensureNoise); return material; },
    };
    this.ctx = {
      scene: this.root, camera: this.camera, environment,
      particles: this.particles, lights: this.lights, decals: this.decals, fissures: this.fissures, bursts: this.bursts,
      shake, flash,
    };
    spacesByContext.set(this.ctx, this);
  }

  adapt() {
    for (const child of this.root.children) if (SHARED.has(child.name)) { this.host.share(child); break; }
    this.root.traverse(node => {
      adaptNode(node, this.adapted, this.clock, this.delta);
      if (node.type === 'ParticleEmitter' && !this.emitters.has(node)) this.emitters.add(node);
    });
    this.syncEmitters();
    this.host.adaptShared();
  }

  show(visible: boolean) {
    this.root.visible = visible;
    this.syncEmitters();
    if (visible) sceneShown();
  }

  private syncEmitters() {
    for (const emitter of this.emitters) emitter.visible = this.root.visible;
    const drawing = this.root.visible && this.emitters.size > 0;
    if (drawing !== this.drawing) { this.drawing = drawing; this.host.drawShared(drawing ? 1 : -1); }
  }

  step(dt: number) {
    this.particles.flush();
    this.decals.update(dt);
    this.fissures.update(dt);
    this.bursts.update(dt);
    this.lights.update(dt);
  }

  hold() {
    const keep = (pool: { acquire(): unknown; release(item: unknown): void; free: unknown[] }, object: (item: unknown) => THREE.Object3D, parent: THREE.Object3D) => {
      if (!pool.free.length) return;
      const item = pool.acquire(), o = object(item);
      o.visible = false; parent.add(o);
      this.held.push({ release: () => pool.release(item) });
    };
    for (const type of this.decals.pools.keys()) keep(this.decals._poolFor(type), item => (item as { mesh: THREE.Object3D }).mesh, this.decals.group);
    for (const mode of this.bursts.pools.keys()) keep(this.bursts._poolFor(mode), item => (item as { mesh: THREE.Object3D }).mesh, this.bursts.group);
    keep(this.fissures.pool, item => (item as { group: THREE.Object3D }).group, this.fissures.group);
    this.adapt();
  }
  unhold() { for (const h of this.held.splice(0)) h.release(); }

  clear() {
    this.particles.reset();
    this.decals.clear();
    this.bursts.clear();
    this.fissures.clear();
    this.lights.reset();
  }

  see(game: THREE.Camera | undefined) {
    if (!game) return;
    _m.copy(this.root.matrixWorld).invert().multiply(game.matrixWorld);
    _m.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
    const p = game as THREE.PerspectiveCamera;
    if (p.isPerspectiveCamera) { this.camera.fov = p.fov; this.camera.aspect = p.aspect; this.camera.near = p.near; this.camera.far = p.far; }
    this.camera.projectionMatrix.copy(game.projectionMatrix);
    this.camera.projectionMatrixInverse.copy(game.projectionMatrixInverse);
    this.camera.updateMatrixWorld(true);
  }

  dispose() {
    this.unhold();
    this.clear();
    this.particles.dispose(); this.decals.dispose(); this.bursts.dispose(); this.fissures.dispose();
    this.show(false);
    for (const emitter of this.emitters) (emitter as THREE.Object3D & { system?: { dispose?(): void } }).system?.dispose?.();
    this.emitters.clear();
    this.root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh && !(o as THREE.Points).isPoints && !(o as THREE.Line).isLine) return;
      mesh.geometry?.dispose();
      for (const material of [mesh.material].flat()) material?.dispose();
    });
    this.root.removeFromParent();
  }
}

export interface ArmoryCharacter { position: THREE.Vector3; facing: number; height: number; model: THREE.Object3D | null; root: THREE.Object3D | null }

export class ArmoryHost implements EffectLayer {
  static for(scene: THREE.Scene) {
    let host = hosts.get(scene);
    if (!host) { host = new ArmoryHost(scene); hosts.set(scene, host); }
    host.refs++;
    return host;
  }
  readonly root = new THREE.Group();
  readonly types = new Map<string, unknown>();
  gameCamera?: THREE.Camera;
  renderer?: THREE.WebGLRenderer;
  readonly depth: THREE.DataTexture;
  readonly character: ArmoryCharacter = { position: new THREE.Vector3(), facing: 0, height: 1.8, model: null, root: null };
  private refs = 0;
  private readonly begun = new Set<object>();
  private frames = 0;
  private readonly shared = new Set<THREE.Object3D>();
  private readonly sharedAdapted = new WeakSet<object>();
  private sharedDrawn = 0;
  private key?: THREE.DirectionalLight;
  private keySearch = 0;
  private readonly spaces = new Set<ArmorySpace>();

  private constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'armory';
    skipHiddenChildren(this.root);
    scene.add(this.root);
    hook(scene);
    this.depth = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this.depth.needsUpdate = true;
    frame.uSceneDepth.value = this.depth;
    sceneHooks.install({});
    if (typeof window === 'object' && window) {
      const w = window as unknown as { __armory?: { app?: { character?: ArmoryCharacter } } };
      if (!w.__armory) w.__armory = { app: { character: this.character } };
    }
  }

  space(name: string) { const space = new ArmorySpace(this, name); this.spaces.add(space); return space; }
  dropSpace(space: ArmorySpace) { this.spaces.delete(space); }

  retainTypes(keep: ReadonlySet<string>): string[] {
    const dropped: string[] = [];
    for (const [id, type] of [...this.types]) {
      if (keep.has(id)) continue;
      try { (type as { dispose?(): void }).dispose?.(); } catch (error) { console.warn(`armory: ${id} could not be let go`, error); }
      this.types.delete(id); dropped.push(id);
    }
    return dropped;
  }

  share(object: THREE.Object3D) {
    this.root.add(object);
    object.visible = this.sharedDrawn > 0;
    if (this.shared.has(object)) return;
    this.shared.add(object);
    const o = object as THREE.Object3D & { update?: (dt: number) => void; [OWN_UPDATE]?: (dt: number) => void };
    const own = o[OWN_UPDATE] ??= o.update;
    if (typeof own !== 'function') return;
    let stepped = -1;
    o.update = (dt: number) => { if (stepped === this.frames) return; stepped = this.frames; own.call(o, dt); };
  }

  drawShared(change: number) {
    this.sharedDrawn = Math.max(0, this.sharedDrawn + change);
    for (const object of this.shared) object.visible = this.sharedDrawn > 0;
  }

  adaptShared() { for (const object of this.shared) object.traverse(node => adaptNode(node, this.sharedAdapted)); }

  loaded(cap: number, effekseer = true): Promise<void> {
    const waits: Promise<unknown>[] = effekseer ? [effekseerLoaded(this, performance.now() + cap)] : [], seen = new WeakSet<object>();
    const image = (value: unknown) => {
      const texture = value as { isTexture?: boolean; image?: unknown } | null | undefined;
      if (!texture?.isTexture || seen.has(texture)) return;
      seen.add(texture);
      const img = texture.image as { complete?: boolean; addEventListener?: (type: string, f: () => void, o: object) => void } | undefined;
      if (img?.complete === false && typeof img.addEventListener === 'function')
        waits.push(new Promise<void>(resolve => { img.addEventListener!('load', resolve, { once: true }); img.addEventListener!('error', resolve, { once: true }); }));
    };
    this.root.traverse(node => {
      const material = (node as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        if (seen.has(m)) continue;
        seen.add(m);
        for (const value of Object.values(m)) image(value);
        for (const uniform of Object.values((m as THREE.ShaderMaterial).uniforms ?? {})) {
          const value = (uniform as { value?: unknown } | undefined)?.value;
          if (Array.isArray(value)) value.forEach(image); else image(value);
        }
      }
    });
    return Promise.race([Promise.all(waits).then(() => undefined), new Promise<void>(resolve => setTimeout(resolve, cap))]);
  }

  seen(renderer: THREE.WebGLRenderer, camera: THREE.Camera) { this.renderer = renderer; this.gameCamera = camera; }

  begin(_time: number, owner: object = this) {
    if (this.begun.size !== 0 && !this.begun.has(owner)) { this.begun.add(owner); return; }
    this.begun.clear(); this.begun.add(owner);
    this.frames++;
    if (this.renderer) { this.renderer.getDrawingBufferSize(_s); if (_s.x > 0) frame.uResolution.value.set(_s.x, _s.y); }
    const camera = this.gameCamera as THREE.PerspectiveCamera | undefined;
    if (camera?.isPerspectiveCamera) { frame.uCameraNear.value = camera.near; frame.uCameraFar.value = camera.far; }
    frame.uShaderIntensity.value = settings.global.shaderIntensity;
    frame.uGlobalGlow.value = settings.global.glow;
    frame.uSceneDepth.value = this.depth;
    if (!this.key && (this.keySearch++ % 120) === 0) this.scene.traverse(o => { if (!this.key && (o as THREE.DirectionalLight).isDirectionalLight && (o as THREE.DirectionalLight).castShadow) this.key = o as THREE.DirectionalLight; });
    if (this.key) { _v.copy(this.key.position).sub(this.key.target.position); if (_v.lengthSq() > 1e-6) frame.uLightDir.value.copy(_v.normalize()); }
    sceneHooks.apply();
  }
  end(_owner?: object) {}
  reset() { for (const space of this.spaces) space.clear(); }
  dispose() {
    if (--this.refs > 0) return;
    hosts.delete(this.scene);
    for (const space of this.spaces) space.dispose();
    this.spaces.clear();
    this.types.clear();
    for (const object of this.shared) object.removeFromParent();
    this.shared.clear();
    this.root.removeFromParent();
    this.depth.dispose();
  }
}
