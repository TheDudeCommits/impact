import * as THREE from 'three';
import { Flesh } from '../horde/flesh';
import type { V3 } from '../horde/kit';

export type CorpsePose = 'back' | 'face' | 'hanged' | 'impaled' | 'slumped' | 'heap';

const SKINS = [0x6a5a58, 0x5c4c50, 0x76625c, 0x52464c];
const RAGS = [0x3a2a22, 0x2a2622, 0x4a3a2a, 0x302a30, 0x3a1c1a];
const BLOOD = 0x2a0406;

function body(f: Flesh, hip: V3, up: V3, side: V3, v: number, limbs: { armL: V3; armR: V3; legL: V3; legR: V3; head?: V3 }) {
  const at = (u: number, s: number, extra: V3 = [0, 0, 0]): V3 => [hip[0] + up[0] * u + side[0] * s + extra[0], hip[1] + up[1] * u + side[1] * s + extra[1], hip[2] + up[2] * u + side[2] * s + extra[2]];
  const add = (p: V3, d: V3, k: number): V3 => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
  const skin = SKINS[v % SKINS.length], rag = RAGS[(v * 3 + 1) % RAGS.length];
  f.soft(.05).color(rag).capsule(at(0, 0), at(.42, 0), .135, .155);
  f.ellipsoid(at(.3, 0), .17, .13, .12);
  const shoulderL = at(.46, .16), shoulderR = at(.46, -.16), hipL = at(-.02, .08), hipR = at(-.02, -.08);
  f.soft(.04).color(skin).capsule(at(.48, 0), at(.62, 0, limbs.head ? [0, 0, 0] : [0, 0, 0]), .05, .045);
  const head = limbs.head ? add(at(.62, 0), limbs.head, .12) : at(.72, 0);
  f.ellipsoid(head, .1, .11, .1);
  for (const [from, dir] of [[shoulderL, limbs.armL], [shoulderR, limbs.armR]] as const) {
    const elbow = add(from, dir, .28), wrist = add(from, dir, .52);
    f.soft(.035).color(skin).capsule(from, elbow, .05, .042).capsule(elbow, wrist, .042, .032).ellipsoid(add(from, dir, .58), .045, .035, .045);
  }
  for (const [from, dir] of [[hipL, limbs.legL], [hipR, limbs.legR]] as const) {
    const knee = add(from, dir, .42), ankle = add(from, dir, .84);
    f.soft(.04).color(rag).capsule(from, knee, .085, .06).color(skin).capsule(knee, ankle, .058, .042).color(0x1e1814).ellipsoid(add(from, dir, .9), .05, .05, .09);
  }
  f.soft(.02).color(BLOOD).ellipsoid(at(.3, .02, [0, .02, 0]), .12, .06, .1, v * .7);
}

function sculpt(pose: CorpsePose, v: number): Flesh {
  const f = new Flesh([]);
  const Y: V3 = [0, 1, 0], Z: V3 = [0, 0, 1], X: V3 = [1, 0, 0], nX: V3 = [-1, 0, 0];
  const n = (x: number, y: number, z: number): V3 => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  switch (pose) {
    case 'back':
      f.soft(.03).color(BLOOD).ellipsoid([0, -.02, .35], .55, .04, .7);
      body(f, [0, .13, 0], Z, X, v, { armL: n(1, 0, .3 - v % 3 * .3), armR: n(-1, 0, .1 + v % 2 * .6), legL: n(.2, 0, -1), legR: n(-.25, 0, -1), head: n(.3, .2, 1) });
      break;
    case 'face':
      f.soft(.03).color(BLOOD).ellipsoid([.1, -.02, .3], .45, .04, .55);
      body(f, [0, .15, 0], Z, nX, v, { armL: n(-.2, -.2, 1), armR: n(.9, 0, .5), legL: n(-.3, 0, -1), legR: n(.15, 0, -1), head: n(0, -.3, 1) });
      break;
    case 'hanged':
      f.soft(.02).color(0x5a4a30).capsule([0, 2.25, 0], [0, 1.72, .02], .018, .018);
      body(f, [0, .95, 0], Y, X, v, { armL: n(.15, -1, .05), armR: n(-.15, -1, .05), legL: n(.05, -1, .08), legR: n(-.05, -1, .02), head: n(.5, .6, .35) });
      break;
    case 'impaled':
      body(f, [0, 1.45, 0], n(0, 1, .25), X, v, { armL: n(.6, -.8, .2), armR: n(-.5, -.85, .15), legL: n(.15, -1, .2), legR: n(-.1, -1, -.1), head: n(.1, -.2, 1) });
      f.soft(.03).color(BLOOD).capsule([0, 1.2, .04], [0, .9, .04], .06, .02);
      break;
    case 'slumped':
      body(f, [0, .12, 0], n(0, 1, -.35), X, v, { armL: n(.4, -.9, .2), armR: n(-.3, -.95, .25), legL: n(.15, -.05, 1), legR: n(-.2, -.05, 1), head: n(0, -.6, 1) });
      break;
    case 'heap':
      f.soft(.03).color(BLOOD).ellipsoid([0, -.02, 0], .9, .04, .8);
      body(f, [-.3, .13, -.2], n(1, 0, .4), n(-.4, 0, 1), v, { armL: n(0, 0, 1), armR: n(.2, 0, -1), legL: n(-1, 0, -.2), legR: n(-1, 0, .3), head: n(1, .2, .3) });
      body(f, [.3, .3, .1], n(-.8, .15, .6), n(.6, 0, .8), v + 1, { armL: n(.3, -.3, 1), armR: n(-.2, -.4, -1), legL: n(.9, -.3, -.4), legR: n(.8, -.3, .1), head: n(-.6, -.2, .7) });
      body(f, [0, .45, .5], n(.2, .1, -1), n(1, 0, .2), v + 2, { armL: n(1, -.4, .1), armR: n(-1, -.5, -.2), legL: n(.1, -.4, 1), legR: n(-.2, -.4, 1), head: n(0, -.3, -1) });
      break;
  }
  return f;
}

const CACHE = new Map<string, THREE.BufferGeometry>();
export const CORPSE_POSES: readonly CorpsePose[] = ['heap', 'back', 'face', 'impaled', 'hanged', 'slumped'];
export const corpseKey = (pose: CorpsePose, variant: number) => `${pose}:${variant & 3}`;
export function sculptCorpse(pose: CorpsePose, variant: number): THREE.BufferGeometry {
  return sculpt(pose, variant & 3).build({ cell: .05, occlusion: .9 });
}
export const hasCorpse = (key: string) => CACHE.has(key);
export function adoptCorpse(key: string, geometry: THREE.BufferGeometry) {
  if (CACHE.has(key)) geometry.dispose(); else CACHE.set(key, geometry);
}
export function corpse(pose: CorpsePose, variant: number): THREE.BufferGeometry {
  const key = corpseKey(pose, variant);
  let geometry = CACHE.get(key);
  if (!geometry) {
    geometry = sculptCorpse(pose, variant);
    CACHE.set(key, geometry);
  }
  return geometry;
}
