import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { FighterDefinition } from '../../config';
import type { PlayerState } from '../../game/types';
import { addOpenHands } from './openHands';
import { joinClips } from '../clipMatch';

export const G5_FLOAT = {
  lift: .3, striking: .22,
  bob: [[.034, .42], [.013, .97]] as const,
  ease: 4.5,
  land: .1, landFor: .28,
  idle: 'G5 Float', run: 'G5 Glide', guard: 'G5 Guard',
} as const;

const FLOORED = new Set(['knockdown', 'getup', 'defeated', 'splat']);
const STRIKING = new Set(['light', 'heavy', 'special', 'ultimate']);

export function floatTarget(state: Pick<PlayerState, 'action' | 'alive'>) {
  if (!state.alive || FLOORED.has(state.action)) return 0;
  return STRIKING.has(state.action) ? G5_FLOAT.striking : G5_FLOAT.lift;
}

export function floatBob(time: number, phase = 0) {
  let y = 0;
  for (const [amount, rate] of G5_FLOAT.bob) y += amount * Math.sin(2 * Math.PI * rate * time + phase * (1 + rate));
  return y;
}

export function floatLanding(since: number) {
  if (since < 0 || since > G5_FLOAT.landFor) return 0;
  const u = since / G5_FLOAT.landFor;
  return G5_FLOAT.land * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u);
}

export async function bindFormExtras(loader: GLTFLoader, definition: FighterDefinition, body: GLTF, form: GLTF | undefined,
  bind: (scene: THREE.Object3D, clips: THREE.AnimationClip[], label?: string) => THREE.AnimationClip[]) {
  if (form) for (const url of definition.formExtraModels ?? []) {
    try {
      form.animations = joinClips(form.animations, bind(form.scene, (await loader.loadAsync(url)).animations, `${definition.name} form`));
    } catch (error) { console.warn(`${definition.name}: form clips unavailable (${url})`, error); }
  }
  if (definition.openHandsModel) {
    try {
      const hands = await loader.loadAsync(definition.openHandsModel);
      addOpenHands(body, hands, 'luffy');
      if (form) addOpenHands(form, hands, 'luffy-g5');
    } catch (error) { console.warn(`${definition.name}: open hands unavailable (${definition.openHandsModel})`, error); }
  }
}
