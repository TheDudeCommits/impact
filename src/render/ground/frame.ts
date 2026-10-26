import * as THREE from 'three';
import { Bodies, type Body } from './bodies';
import { GROUND_TIERS, QualityWatch, type GroundQuality, type GroundTier } from './quality';

export interface GroundTick {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  time: number;
  dt: number;
  bodies: readonly Body[];
  frustum: THREE.Frustum;
  viewMoved: boolean;
}

const SCENE_FRAMES = new WeakMap<THREE.Scene, Set<GroundFrame>>();

function sceneFrames(scene: THREE.Scene) {
  let frames = SCENE_FRAMES.get(scene);
  if (frames) return frames;
  const set = frames = new Set<GroundFrame>();
  SCENE_FRAMES.set(scene, set);
  const before = scene.onBeforeRender;
  scene.onBeforeRender = function (renderer, s, camera, geometry, material, group) {
    before.call(this, renderer, s, camera, geometry, material, group);
    for (const frame of set) frame.beforeScene(renderer, scene, camera);
  };
  return set;
}

export class GroundFrame {
  readonly time = { value: 0 };
  readonly wind = { value: new THREE.Vector4(.8, .6, .22, 3.5) };
  readonly bodies = new Bodies();
  readonly quality = new QualityWatch();
  private readonly layers: { tick(t: GroundTick): void; setQuality?(tier: GroundTier, quality: GroundQuality): void }[] = [];
  private readonly started = performance.now() / 1000;
  private last = -1;
  private frame = -1;
  private readonly tickInfo: GroundTick = { renderer: undefined!, scene: undefined!, camera: undefined!, time: 0, dt: 0, bodies: [], frustum: new THREE.Frustum(), viewMoved: true };
  private readonly view = new THREE.Matrix4();
  private readonly lastView = new THREE.Matrix4();
  enabled = true;

  constructor(wind?: { heading: number; strength: number; gusts?: number }) {
    if (wind) this.wind.value.set(Math.sin(wind.heading), Math.cos(wind.heading), wind.strength, wind.gusts ?? 3.5);
  }

  get tier() { return GROUND_TIERS[this.quality.current]; }

  add(layer: { tick(t: GroundTick): void; setQuality?(tier: GroundTier, quality: GroundQuality): void }) { this.layers.push(layer); return layer; }

  private owner?: THREE.Object3D;
  private scene?: THREE.Scene;

  watch(owner: THREE.Object3D) { this.owner = owner; }

  sceneHook = true;

  drive(object: THREE.Object3D) {
    const before = object.onBeforeRender, frame = this;
    object.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
      if (frame.sceneHook && (scene as THREE.Scene).isScene && scene !== frame.scene) frame.attach(scene as THREE.Scene);
      frame.tick(renderer, scene, camera);
      before.call(this, renderer, scene, camera, geometry, material, group);
    };
  }

  private attach(scene: THREE.Scene) {
    this.detach();
    this.scene = scene;
    sceneFrames(scene).add(this);
  }

  detach() {
    if (this.scene) SCENE_FRAMES.get(this.scene)?.delete(this);
    this.scene = undefined;
  }

  beforeScene(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    for (let o: THREE.Object3D | null = this.owner ?? null; o; o = o.parent) {
      if (!o.visible) return;
      if (o !== scene) continue;
      this.tick(renderer, scene, camera);
      if (renderer.info.autoReset) this.frame = renderer.info.render.frame + 1;
      return;
    }
  }

  tick(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const frame = renderer.info.render.frame;
    if (frame === this.frame || !this.enabled) return;
    this.frame = frame;
    const now = performance.now() / 1000 - this.started;
    const dt = this.last < 0 ? 1 / 60 : Math.min(.1, Math.max(0, now - this.last));
    this.last = now;
    this.time.value = now;
    const rebuilt = this.quality.poll();
    if (rebuilt) for (const layer of this.layers) layer.setQuality?.(this.tier, this.quality.current);
    const t = this.tickInfo;
    t.renderer = renderer; t.scene = scene; t.camera = camera; t.time = now; t.dt = dt;
    this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    t.viewMoved = !this.view.equals(this.lastView);
    if (t.viewMoved) { this.lastView.copy(this.view); t.frustum.setFromProjectionMatrix(this.view); }
    if (rebuilt) { t.viewMoved = true; }
    t.bodies = this.bodies.update(scene, now);
    for (const layer of this.layers) layer.tick(t);
    this.frame = renderer.info.render.frame;
  }
}
