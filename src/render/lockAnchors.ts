import * as THREE from 'three';
import { drawnBulk } from './CameraDirector';
import type { FighterId } from '../game/types';

const HEAD_PAD = .24, SOLE_PAD = .06, CROWN = 1.95;
const BOX_JOINTS = ['Head', 'Hips', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm'] as const;
const ENEMY_HEIGHT = 1.8, ENEMY_CENTRE = .55;

export interface LockBody {
  readonly group: THREE.Object3D;
  readonly model?: { visible: boolean };
  readonly joints?: ReadonlyMap<string, THREE.Object3D>;
  readonly shownBody?: LockBody;
  readonly state: { fighter: FighterId; awakened?: boolean; alive?: boolean };
}

export interface LockFrame {
  ok: boolean;
  inFront: boolean;
  ax: number; ay: number;
  dx: number; dy: number;
  l: number; t: number; r: number; b: number;
  cx: number; cy: number;
}
export const lockFrame = (): LockFrame => ({ ok: false, inFront: false, ax: 0, ay: 0, dx: 0, dy: 1, l: 0, t: 0, r: 0, b: 0, cx: 0, cy: 0 });

const _p = new THREE.Vector3(), _v = new THREE.Vector3();
let _depth = 0;
function toScreen(p: THREE.Vector3, camera: THREE.Camera, w: number, h: number) {
  _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
  _depth = -_v.z;
  if (!(_depth > .05)) return false;
  _v.applyMatrix4((camera as THREE.PerspectiveCamera).projectionMatrix);
  if (!Number.isFinite(_v.x) || !Number.isFinite(_v.y)) return false;
  _v.set((_v.x * .5 + .5) * w, (-_v.y * .5 + .5) * h, _depth);
  return true;
}
function include(out: LockFrame, x: number, y: number) {
  if (x < out.l) out.l = x; if (x > out.r) out.r = x;
  if (y < out.t) out.t = y; if (y > out.b) out.b = y;
}
function anchor(out: LockFrame, p: THREE.Vector3, camera: THREE.Camera, w: number, h: number) {
  const m = (camera as THREE.PerspectiveCamera).projectionMatrix.elements;
  _v.copy(p).applyMatrix4(camera.matrixWorldInverse);
  out.dx = m[0] * _v.x * w / 2; out.dy = -m[5] * _v.y * h / 2;
  if (out.dx === 0 && out.dy === 0) out.dy = 1;
  out.inFront = toScreen(p, camera, w, h);
  if (out.inFront) { out.ax = _v.x; out.ay = _v.y; out.dx = _v.x - w / 2; out.dy = _v.y - h / 2; }
}

export function measureLock(out: LockFrame, body: LockBody | undefined, centre: THREE.Vector3 | undefined, size: number, camera: THREE.Camera, w: number, h: number): LockFrame {
  out.ok = false; out.l = out.t = Infinity; out.r = out.b = -Infinity; out.cx = out.cy = NaN;
  const shown = body?.shownBody ?? body;
  const joints = shown && shown.model?.visible !== false ? shown.joints : undefined;
  const head = joints?.get('Head'), hips = joints?.get('Hips');
  if (body && shown && joints && head && hips) {
    const bulk = drawnBulk(body);
    hips.getWorldPosition(_p); anchor(out, _p, camera, w, h);
    for (let i = 0; i < BOX_JOINTS.length; i++) {
      const name = BOX_JOINTS[i], bone = joints.get(name); if (!bone) continue;
      bone.getWorldPosition(_p);
      if (name === 'Head') _p.y += HEAD_PAD * bulk; else if (i >= 2 && i <= 5) _p.y -= SOLE_PAD;
      if (!toScreen(_p, camera, w, h)) continue;
      include(out, _v.x, _v.y);
      if (name === 'Head') { out.cx = _v.x; out.cy = _v.y; }
    }
    if (out.r >= out.l && !(out.cy >= out.t && out.cy <= out.b && out.cx >= out.l && out.cx <= out.r)) { out.cx = (out.l + out.r) / 2; out.cy = out.t; }
  } else {
    let height: number;
    if (body) { _p.copy(body.group.position); height = CROWN * drawnBulk(body); }
    else if (centre) { height = ENEMY_HEIGHT * Math.max(.2, size); _p.copy(centre); _p.y -= ENEMY_CENTRE * height; }
    else return out;
    const bottomY = _p.y;
    _p.y = bottomY + height / 2; anchor(out, _p, camera, w, h);
    _p.y = bottomY; if (toScreen(_p, camera, w, h)) include(out, _v.x, _v.y);
    _p.y = bottomY + height; if (toScreen(_p, camera, w, h)) { include(out, _v.x, _v.y); out.cx = _v.x; out.cy = _v.y; }
    else if (out.r >= out.l) { out.cx = (out.l + out.r) / 2; out.cy = out.t; }
  }
  out.ok = out.r >= out.l && out.b >= out.t;
  return out;
}

export interface Box { l: number; t: number; r: number; b: number }
export const box = (): Box => ({ l: 0, t: 0, r: 0, b: 0 });
export const PAD_SIDE = .13, PAD_END = .055, PAD_MIN = 6;
export const MIN_ASPECT = .5;
export const MIN_BOX = 26;
export function padBox(l: number, t: number, r: number, b: number, out: Box): Box {
  let w = Math.max(0, r - l), h = Math.max(0, b - t);
  const cx = (l + r) / 2, cy = (t + b) / 2, size = Math.max(w, h);
  w += 2 * Math.max(PAD_MIN, PAD_SIDE * size); h += 2 * Math.max(PAD_MIN, PAD_END * size);
  w = Math.max(w, MIN_ASPECT * h, MIN_BOX); h = Math.max(h, MIN_BOX);
  out.l = cx - w / 2; out.r = cx + w / 2; out.t = cy - h / 2; out.b = cy + h / 2;
  return out;
}
export const bracketArm = (w: number, h: number) => Math.max(10, Math.min(36, .2 * Math.min(w, h)));
export const FADE_FROM = .52, FADE_TO = .64;
export function bracketFade(boxHeight: number, viewHeight: number) {
  const k = (boxHeight / Math.max(1, viewHeight) - FADE_FROM) / (FADE_TO - FADE_FROM);
  if (k <= 0) return 1; if (k >= 1) return 0;
  return 1 - k * k * (3 - 2 * k);
}
export const PIN_W = 24, PIN_H = 20;
export const pinWidth = (boxHeight: number) => Math.max(16, Math.min(28, PIN_W * Math.pow(Math.max(1, boxHeight) / 185, .45)));
