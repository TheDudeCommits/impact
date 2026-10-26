import * as THREE from 'three';
import { CORPSE_POSES, adoptCorpse, corpseKey, hasCorpse } from './corpses';
import { adoptHand, hasHand } from './landmarks';

interface Meshed {
  key: string;
  attributes: { name: string; array: THREE.TypedArray; itemSize: number; normalized: boolean }[];
  index?: THREE.TypedArray;
}

let started = false;
const made = (key: string) => key === 'hand' ? hasHand() : hasCorpse(key);

export function meshAhead() {
  if (started || typeof Worker === 'undefined') return;
  started = true;
  const queue = ['hand', ...CORPSE_POSES.flatMap(pose => [0, 1, 2, 3].map(variant => corpseKey(pose, variant)))];
  let worker: Worker;
  try { worker = new Worker(new URL('./fleshWorker.ts', import.meta.url), { type: 'module' }); } catch { return; }
  const next = () => {
    let key = queue.shift();
    while (key !== undefined && made(key)) key = queue.shift();
    if (key === undefined) worker.terminate();
    else worker.postMessage(key);
  };
  worker.onmessage = (event: MessageEvent<Meshed>) => { adopt(event.data); next(); };
  worker.onerror = () => worker.terminate();
  next();
}

function adopt({ key, attributes, index }: Meshed) {
  const geometry = new THREE.BufferGeometry();
  for (const { name, array, itemSize, normalized } of attributes) geometry.setAttribute(name, new THREE.BufferAttribute(array, itemSize, normalized));
  if (index) geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  if (key === 'hand') adoptHand(geometry); else adoptCorpse(key, geometry);
}
