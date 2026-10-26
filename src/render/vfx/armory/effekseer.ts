import * as THREE from 'three';
import { ASSET_BASE } from './assetBase';


interface EfkHandle {
  readonly exists: boolean;
  stop(): void;
  setLocation(x: number, y: number, z: number): void;
  setRotation(x: number, y: number, z: number): void;
  setScale(x: number, y: number, z: number): void;
  setSpeed(s: number): void;
  setAllColor(r: number, g: number, b: number, a: number): void;
}
interface EfkEffect { readonly isLoaded?: boolean }
interface EfkContext {
  init(gl: WebGLRenderingContext | WebGL2RenderingContext, settings: { instanceMaxCount: number; squareMaxCount: number }): void;
  setRestorationOfStatesFlag(on: boolean): void;
  loadEffect(path: string, scale: number, onload: () => void, onerror: (message: string, url: string) => void): EfkEffect;
  play(effect: EfkEffect, x: number, y: number, z: number): EfkHandle | null;
  update(frames: number): void;
  setProjectionMatrix(m: ArrayLike<number>): void;
  setCameraMatrix(m: ArrayLike<number>): void;
  draw(): void;
}
interface EfkModule { initRuntime(wasm: string, onload: () => void, onerror: () => void): void; createContext(): EfkContext }

const RUNTIME = () => `${ASSET_BASE}fxlib/effekseer/`;
let runtime: Promise<EfkModule> | undefined;

function loadRuntime(): Promise<EfkModule> {
  return runtime ??= new Promise<EfkModule>((resolve, reject) => {
    const w = window as unknown as { effekseer?: EfkModule };
    const init = () => w.effekseer!.initRuntime(`${RUNTIME()}effekseer.wasm`, () => resolve(w.effekseer!), () => reject(new Error('Effekseer: its WebAssembly runtime failed to start')));
    if (w.effekseer) { init(); return; }
    const script = document.createElement('script');
    script.src = `${RUNTIME()}effekseer.min.js`;
    script.async = true;
    script.onload = init;
    script.onerror = () => reject(new Error('Effekseer: its runtime script failed to load'));
    document.head.appendChild(script);
  });
}

export interface EffekseerHost { readonly root: THREE.Object3D; readonly renderer?: THREE.WebGLRenderer; readonly gameCamera?: THREE.Camera }

class EffekseerRuntime {
  private context?: EfkContext;
  private starting?: Promise<void>;
  private restoring = false;
  private readonly effects = new Map<string, { effect?: EfkEffect; loaded: boolean; failed: boolean }>();
  private readonly live = new Set<EfkHandle>();
  private last = -1;
  private drawn = -1;
  globalScale = 1;

  constructor(private readonly host: EffekseerHost) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    const sentinel = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false, transparent: true }));
    sentinel.name = 'EffekseerSentinel';
    sentinel.frustumCulled = false;
    sentinel.renderOrder = 1e9;
    sentinel.onAfterRender = (renderer, _scene, camera) => this.draw(renderer, camera);
    host.root.add(sentinel);
  }

  start() {
    if (this.context || this.starting || !this.host.renderer) return;
    const renderer = this.host.renderer;
    if (!this.restoring) { this.restoring = true; renderer.domElement.addEventListener('webglcontextrestored', () => this.restart()); }
    this.starting = loadRuntime().then(module => {
      const ctx = module.createContext();
      ctx.init(renderer.getContext(), { instanceMaxCount: 4000, squareMaxCount: 20000 });
      ctx.setRestorationOfStatesFlag(false);
      renderer.resetState();
      this.context = ctx;
      for (const [path, entry] of this.effects) if (!entry.effect) this.load(path, entry);
    }).catch(error => { console.warn(error); this.starting = undefined; });
  }

  private restart() {
    this.live.clear(); this.context = undefined; this.starting = undefined;
    for (const entry of this.effects.values()) { entry.effect = undefined; entry.loaded = false; entry.failed = false; }
    this.start();
  }

  private load(path: string, entry: { effect?: EfkEffect; loaded: boolean; failed: boolean }) {
    entry.effect = this.context!.loadEffect(`${RUNTIME()}fx/${path}`, 1, () => { entry.loaded = true; }, (message, url) => { entry.failed = true; console.warn(`Effekseer: ${message} ${url}`); });
  }

  preload(path: string) {
    let entry = this.effects.get(path);
    if (!entry) {
      entry = { loaded: false, failed: false };
      this.effects.set(path, entry);
      if (this.context) this.load(path, entry);
    }
    this.start();
    return entry;
  }

  isLoaded(path: string) { const entry = this.effects.get(path); return !!entry && (entry.loaded || !!entry.effect?.isLoaded); }

  play(path: string, x: number, y: number, z: number): EfkHandle | null {
    const entry = this.preload(path);
    if (!this.context || !entry.effect || !(entry.loaded || entry.effect.isLoaded)) return null;
    const handle = this.context.play(entry.effect, x, y, z);
    if (handle) this.live.add(handle);
    return handle;
  }

  stop(handle: EfkHandle | null | undefined) {
    if (!handle) return;
    try { handle.stop(); } catch { }
    this.live.delete(handle);
  }

  stopAll() { for (const handle of [...this.live]) this.stop(handle); }

  loaded(until: number): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        const done = !!this.context && [...this.effects.values()].every(e => e.loaded || e.failed || !!e.effect?.isLoaded);
        if (done || performance.now() >= until) resolve(); else setTimeout(check, 25);
      };
      check();
    });
  }

  private draw(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    if (!this.host.renderer) return;
    if (camera !== this.host.gameCamera) return;
    const now = performance.now() / 1000;
    if (now === this.drawn) return;
    this.drawn = now;
    this.start();
    const ctx = this.context;
    if (!ctx) return;
    const dt = this.last < 0 ? 0 : Math.min(.1, Math.max(0, now - this.last));
    this.last = now;
    ctx.update(dt * 60);
    for (const handle of this.live) if (!handle.exists) this.live.delete(handle);
    if (!this.live.size) return;
    const target = renderer.getRenderTarget();
    const gl = renderer.getContext();
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    renderer.state.buffers.color.setMask(true);
    ctx.setProjectionMatrix(camera.projectionMatrix.elements);
    ctx.setCameraMatrix(camera.matrixWorldInverse.elements);
    ctx.draw();
    renderer.resetState();
    const gl2 = gl as WebGL2RenderingContext;
    if (gl2.UNPACK_ROW_LENGTH !== undefined) for (const name of [gl2.UNPACK_ROW_LENGTH, gl2.UNPACK_IMAGE_HEIGHT, gl2.UNPACK_SKIP_PIXELS, gl2.UNPACK_SKIP_ROWS, gl2.UNPACK_SKIP_IMAGES]) renderer.state.pixelStorei(name, 0);
    renderer.setRenderTarget(target);
  }
}

const runtimes = new WeakMap<object, EffekseerRuntime>();
let current: EffekseerHost | undefined;
export function effekseerHost(host: EffekseerHost | undefined) { current = host; }

export function effekseerLoaded(host: EffekseerHost, until: number): Promise<void> {
  const runtime = runtimes.get(host);
  runtime?.start();
  return runtime?.loaded(until) ?? Promise.resolve();
}

export function prefetchEffekseer(host: EffekseerHost): void {
  if (runtimes.has(host)) void loadRuntime().catch(() => { });
}

export function startEffekseer(host: EffekseerHost): void { runtimes.get(host)?.start(); }

export function getEffekseer(_ctx?: unknown): EffekseerRuntime {
  const host = current;
  if (!host) throw new Error('Effekseer: no Armory host is building an effect');
  let rt = runtimes.get(host);
  if (!rt) { rt = new EffekseerRuntime(host); runtimes.set(host, rt); }
  return rt;
}
