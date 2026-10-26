import * as THREE from 'three';

export interface CloseStyleRig {
  boom: number; lift: number; focus: number; shoulder: number;
  sideMost: number;
  fov: number; fovKeep: number;
  top: number; myBottom: number; foeBottom: number; cardTop: number;
  latchMost: number; latchRate: number; blockRate: number;
}
export const CLOSE_STYLE: CloseStyleRig = {
  boom: .84, lift: .77, focus: .72, shoulder: 1.4, sideMost: .66,
  fov: 42, fovKeep: .6,
  top: .64, myBottom: .84, foeBottom: .9, cardTop: .7,
  latchMost: .45, latchRate: 24, blockRate: 6,
};

export const CLOSE_GROUP_FROM = .2, CLOSE_GROUP_TO = .7;
export const CLOSE_RATE = 4;

export const GHOST_GONE = 2.2, GHOST_CLEAR = 4.4;
export const GHOST_FADE = { value: new THREE.Vector3(0, GHOST_GONE, GHOST_CLEAR) };
export function ghostScale(height?: number) { return THREE.MathUtils.clamp((height ?? 1.9) / 1.9, 1, 2); }
export function ghostLensFade(distance: number, scale: number, weight: number) {
  return 1 - weight * (1 - THREE.MathUtils.smoothstep(distance, GHOST_GONE * scale, GHOST_CLEAR * scale));
}

export function closeStyleGoal(style: 'classic' | 'close', battlefield: boolean, group: number) {
  if (style !== 'close' || battlefield) return 0;
  return 1 - THREE.MathUtils.smoothstep(group, CLOSE_GROUP_FROM, CLOSE_GROUP_TO);
}

export function closeStyleRig(size: { boom: number; lift: number; shoulder: number; focus: number }, w: number, tanH: number) {
  if (!(w > 0)) return;
  const shoulder = Math.min(size.shoulder * CLOSE_STYLE.shoulder, CLOSE_STYLE.sideMost * tanH * size.boom * CLOSE_STYLE.boom);
  size.shoulder += (Math.max(shoulder, size.shoulder * CLOSE_STYLE.boom) - size.shoulder) * w;
  size.boom *= 1 + (CLOSE_STYLE.boom - 1) * w;
  size.lift *= 1 + (CLOSE_STYLE.lift - 1) * w;
  size.focus *= 1 + (CLOSE_STYLE.focus - 1) * w;
}

export function closeStyleFov(classic: number, w: number) {
  return w > 0 ? classic + ((CLOSE_STYLE.fov - 50) + (classic - 50) * (CLOSE_STYLE.fovKeep - 1)) * w : classic;
}

export const CLOSE_SHOT = {
  angle: .7, orbit: .5, reach: 3.4, push: 1, zoom: .5, low: -.45, fov: 30, atX: -.1, atY: .34, hold: 1.3, floor: -.8,
  in: .3, out: .45,
};
