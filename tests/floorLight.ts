import * as THREE from 'three';
import type { LookPreset } from '../src/render/look/stageLooks';

type RGB = [number, number, number];
const linear = (hex: number): RGB => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
export const luma = (c: readonly number[]) => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];

export function floorLight(look: LookPreset, inPool = false): RGB {
  const key = linear(look.key.color), sky = linear(look.hemi.sky), up = Math.max(0, look.key.dir[1] / Math.hypot(...look.key.dir));
  const share = (look.room?.key ?? 1) * (look.cookie && !inPool ? look.cookie.floor : 1);
  const horizon = linear(look.sky.horizon), zenith = linear(look.sky.zenith);
  return [0, 1, 2].map(i => key[i] * look.key.intensity * share * up / Math.PI + sky[i] * look.hemi.intensity / Math.PI
    + (horizon[i] + zenith[i]) / 2 * look.ibl) as RGB;
}
