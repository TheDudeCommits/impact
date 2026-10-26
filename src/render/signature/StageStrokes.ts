import * as THREE from 'three';
import type { MoveStage, StageLook } from './MoveStage';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

export function limb(st: MoveStage, from: THREE.Vector3, via: THREE.Vector3, to: THREE.Vector3, width: number, look: StageLook, k = 1, intensity = 1, steps = 8, taper = .3, out?: THREE.Vector3) {
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  if (k <= .02 || intensity <= .02) { out?.copy(from); return; }
  _a.copy(from);
  for (let i = 1; i <= steps; i++) {
    const s = i / steps, u = k * s, v = 1 - u, w = width * (1 - (1 - taper) * s);
    _b.set(v * v * from.x + 2 * u * v * via.x + u * u * to.x, v * v * from.y + 2 * u * v * via.y + u * u * to.y, v * v * from.z + 2 * u * v * via.z + u * u * to.z);
    st.streak(_a, _b, w, look.main, intensity); st.streak(_a, _b, w * .34, look.core, intensity * .9);
    _a.copy(_b);
  }
  out?.copy(_a);
}

export function sweep(st: MoveStage, centre: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, radius: number, from: number, to: number, width: number, look: StageLook, intensity = 1, steps = 10) {
  if (intensity <= .02 || Math.abs(to - from) < .01) return;
  _a.copy(centre).addScaledVector(x, Math.cos(from) * radius).addScaledVector(y, Math.sin(from) * radius);
  for (let i = 1; i <= steps; i++) {
    const s = i / steps, ang = from + (to - from) * s, belly = Math.sin(Math.PI * (s - .5 / steps)), w = width * (.2 + .8 * belly), lit = intensity * (.35 + .65 * s);
    _b.copy(centre).addScaledVector(x, Math.cos(ang) * radius).addScaledVector(y, Math.sin(ang) * radius);
    st.streak(_a, _b, w, look.main, lit); st.streak(_a, _b, w * .3, look.core, lit);
    _a.copy(_b);
  }
}

export function bolt(st: MoveStage, from: THREE.Vector3, to: THREE.Vector3, width: number, color: THREE.Color, intensity: number, seed: number, jitter = .25, steps = 6, core = .4) {
  if (intensity <= .02) return;
  _c.subVectors(to, from); const span = _c.length(); if (span < .05) return;
  _c.divideScalar(span);
  _d.set(Math.abs(_c.y) < .9 ? 0 : 1, Math.abs(_c.y) < .9 ? 1 : 0, 0).cross(_c).normalize();
  _a.copy(from);
  for (let i = 1; i <= steps; i++) {
    const s = i / steps, off = i === steps ? 0 : jitter * Math.sin(Math.PI * s);
    _b.copy(from).addScaledVector(_c, span * s).addScaledVector(_d, (hash(seed + i * 3.7) - .5) * 2 * off); _b.y += (hash(seed * 1.3 + i * 5.1) - .5) * 2 * off;
    st.streak(_a, _b, width, color, intensity, core);
    _a.copy(_b);
  }
}

export function polygon(st: MoveStage, at: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, radius: number, sides: number, width: number, color: THREE.Color, intensity = 1, spin = 0, core = 0, first = 0, count = sides) {
  if (intensity <= .02 || radius <= .02) return;
  const step = Math.PI * 2 / sides, from = spin + first * step;
  _a.copy(at).addScaledVector(x, Math.cos(from) * radius).addScaledVector(y, Math.sin(from) * radius);
  for (let i = 1; i <= count; i++) {
    const ang = from + i * step;
    _b.copy(at).addScaledVector(x, Math.cos(ang) * radius).addScaledVector(y, Math.sin(ang) * radius);
    st.streak(_a, _b, width, color, intensity, core);
    _a.copy(_b);
  }
}

export function nested(st: MoveStage, at: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, radius: number, sides: number, count: number, width: number, look: StageLook, k = 1, intensity = 1, spin = 0, time = 0, first = 0, span = sides) {
  if (k <= .02 || intensity <= .02) return;
  for (let i = 1; i <= count; i++) {
    const s = i / count; if (s > k + .001) break;
    const ripple = .55 + .45 * Math.max(0, Math.sin(time * 9 - i * 1.1)), outer = i === count || s + 1 / count > k + .001;
    polygon(st, at, x, y, radius * s, sides, width * (.7 + .5 * s), outer ? look.core : look.main, intensity * ripple * (outer ? 1.1 : .9), spin, 0, first, span);
  }
}
