import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import type { RiftProp, RiftStageId } from '../../game/riftLayouts';

export interface PropModel {
  geometry: THREE.BufferGeometry;
  far: THREE.BufferGeometry;
  texture: THREE.Texture;
  size: THREE.Vector3;
}

export interface Fit { w?: number; d?: number; h?: number }
export interface Dress extends Fit { id: string; sink?: number; tilt?: readonly [number, number] }

const IDS = ['house-a', 'house-b', 'ruin', 'bell-tower', 'cart', 'sword', 'grave', 'giant-sword', 'dead-tree',
  'fortress-tower', 'knight-statue', 'brazier', 'cage', 'stake-body', 'altar', 'curtain-wall', 'fortress-keep', 'rock-spire', 'boulder',
  'great-wave', 'wreck', 'lighthouse'] as const;
const url = (id: string) => `/assets/survival/motion/prop-${id}.glb`;

export function dressFor(stage: RiftStageId, p: RiftProp): Dress | undefined {
  const r = p.seed, footprint = { w: p.w, d: p.d };
  switch (p.kind) {
    case 'house': return { id: r > .55 ? 'house-b' : 'house-a', ...footprint };
    case 'ruin': return { id: 'ruin', ...footprint };
    case 'tower': return { id: stage === 'rift-village' ? 'bell-tower' : 'fortress-tower', ...footprint };
    case 'cart': return { id: 'cart', ...footprint };
    case 'sword': return { id: 'sword', h: p.h + .3, sink: .3, tilt: [(r - .5) * .7, (r - .5) * .4] };
    case 'grave': return { id: 'grave', h: p.h, tilt: [(r - .5) * .3, (r - .5) * .25] };
    case 'statue': return stage === 'rift-swords' ? { id: 'giant-sword', h: p.h + 1.5 } : { id: 'knight-statue', h: p.h };
    case 'tree': return { id: 'dead-tree', h: p.h };
    case 'wall': return { id: 'curtain-wall', w: p.w, d: p.d, h: p.h + 1 };
    case 'brazier': return { id: 'brazier', h: 1.6 };
    case 'cage': return { id: 'cage', ...footprint };
    case 'stake': return { id: 'stake-body', h: Math.max(4.6, p.h + 1.8) };
    case 'stone': return stage === 'rift-eclipse' ? { id: 'stake-body', h: p.h + 2.2 } : undefined;
    case 'altar': return { id: 'altar', ...footprint };
    case 'rock': return { id: 'boulder', w: p.w, d: p.d, h: p.h };
    default: return undefined;
  }
}

const models = new Map<string, PropModel>();
let loading: Promise<void> | undefined;
let settled = false;

export function loadPropModels(): Promise<void> {
  const wanted = typeof location === 'object' && new URLSearchParams(location.search).has('noprops') ? [] : IDS;
  return loading ??= Promise.all(wanted.map(async id => {
    try { const model = await loadOne(url(id)); if (model) models.set(id, model); }
    catch (error) { console.warn(`Rift: prop ${id} did not load; it stays code-built`, error); }
  })).then(() => { settled = true; });
}
export const propModelsSettled = () => settled;
export const propModel = (id: string) => models.get(id);

const loader = new GLTFLoader();
async function loadOne(src: string): Promise<PropModel | undefined> {
  const gltf = await loader.loadAsync(src);
  gltf.scene.updateMatrixWorld(true);
  let mesh: THREE.Mesh | undefined;
  gltf.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) return undefined;
  const geometry = new THREE.BufferGeometry();
  const source = mesh.geometry;
  geometry.setAttribute('position', source.getAttribute('position').clone());
  geometry.setAttribute('normal', source.getAttribute('normal').clone());
  geometry.setAttribute('uv', source.getAttribute('uv').clone());
  if (source.index) geometry.setIndex(source.index.clone());
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!, size = box.getSize(new THREE.Vector3());
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const texture = ((mesh.material as THREE.MeshStandardMaterial).map ?? new THREE.Texture()) as THREE.Texture;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { geometry, far: await coarser(geometry, .35), texture, size };
}

async function coarser(geometry: THREE.BufferGeometry, share: number): Promise<THREE.BufferGeometry> {
  try {
    await MeshoptSimplifier.ready;
    const positions = geometry.getAttribute('position').array as Float32Array;
    const index = geometry.getIndex() ? Uint32Array.from(geometry.getIndex()!.array as ArrayLike<number>) : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
    const [coarse] = MeshoptSimplifier.simplify(index, Float32Array.from(positions), 3, Math.floor(index.length * share / 3) * 3, .03);
    if (coarse.length < 3 || coarse.length > index.length * .85) return geometry;
    const remap = new Map<number, number>(), order: number[] = [];
    const out = new Uint32Array(coarse.length);
    for (let i = 0; i < coarse.length; i++) {
      let to = remap.get(coarse[i]);
      if (to === undefined) { to = order.length; remap.set(coarse[i], to); order.push(coarse[i]); }
      out[i] = to;
    }
    const far = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const from = geometry.getAttribute(name), size = from.itemSize, data = new Float32Array(order.length * size);
      order.forEach((v, i) => { for (let c = 0; c < size; c++) data[i * size + c] = from.getComponent(v, c); });
      far.setAttribute(name, new THREE.BufferAttribute(data, size));
    }
    far.setIndex(new THREE.BufferAttribute(out, 1));
    return far;
  } catch (error) {
    console.warn('Rift: a prop could not be simplified', error);
    return geometry;
  }
}

export function fitOf(fit: Fit, model: PropModel): { scale: { x: number; y: number; z: number }; turn: number } {
  const size = model.size, even = (k: number) => ({ scale: { x: k, y: k, z: k }, turn: 0 });
  if (fit.w === undefined || fit.d === undefined) return even((fit.h ?? size.y) / Math.max(.01, size.y));
  const turned = (fit.w >= fit.d) !== (size.x >= size.z);
  const mx = Math.max(.01, turned ? size.z : size.x), mz = Math.max(.01, turned ? size.x : size.z), turn = turned ? Math.PI / 2 : 0;
  if (fit.h !== undefined) {
    const sx = fit.w / mx, sz = fit.d / mz, sy = fit.h / Math.max(.01, size.y);
    return { scale: turned ? { x: sz, y: sy, z: sx } : { x: sx, y: sy, z: sz }, turn };
  }
  const k = Math.min(fit.w / mx, fit.d / mz) * 1.04;
  return { scale: { x: k, y: k, z: k }, turn };
}
