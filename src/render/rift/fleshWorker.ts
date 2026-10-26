import type * as THREE from 'three';
import { sculptCorpse, type CorpsePose } from './corpses';
import { sculptHand } from './landmarks';

const scope = self as unknown as { onmessage: ((event: MessageEvent<string>) => void) | null; postMessage(message: unknown, transfer: Transferable[]): void };
scope.onmessage = event => {
  const key = event.data;
  const [pose, variant] = key.split(':');
  const geometry = key === 'hand' ? sculptHand() : sculptCorpse(pose as CorpsePose, Number(variant));
  const buffers = new Set<ArrayBufferLike>();
  const attributes = Object.entries(geometry.attributes).map(([name, attribute]) => {
    const array = (attribute as THREE.BufferAttribute).array;
    buffers.add(array.buffer);
    return { name, array, itemSize: attribute.itemSize, normalized: attribute.normalized };
  });
  const index = geometry.index?.array;
  if (index) buffers.add(index.buffer);
  scope.postMessage({ key, attributes, index }, [...buffers] as Transferable[]);
};
