import * as THREE from 'three';
import { STAR } from './GlowBatch';
import type { MoveStage, StageLook } from './MoveStage';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3();
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

export function fistRush(st: MoveStage, from: THREE.Vector3, to: THREE.Vector3, look: StageLook, k: number, time: number, seed = 0, count = 9, spread = .55, length = 1) {
  if (k <= .02) return;
  _d.subVectors(to, from); const span = _d.length(); if (span < .05) return;
  _d.divideScalar(span);
  _u.set(Math.abs(_d.y) < .9 ? 0 : 1, Math.abs(_d.y) < .9 ? 1 : 0, 0).cross(_d).normalize(); _v.crossVectors(_d, _u);
  const tick = Math.floor(time * 30), reach = Math.min(span + .4, 2.4) * length;
  for (let i = 0, n = st.n(count, 4); i < n; i++) {
    const slot = Math.floor((tick + i) / 3), phase = ((tick + i) % 3) / 2, a1 = hash(seed + i * 5.3 + slot * 1.7) * Math.PI * 2, r1 = spread * Math.sqrt(hash(seed + i * 2.9 + slot * 3.1));
    _b.copy(to).addScaledVector(_u, Math.cos(a1) * r1).addScaledVector(_v, Math.sin(a1) * r1 * 1.3);
    _a.copy(_b).addScaledVector(_d, -reach * (.55 + .45 * hash(i + slot))).addScaledVector(_u, Math.cos(a1) * r1 * .7).addScaledVector(_v, Math.sin(a1) * r1 * .5);
    const lit = k * (.55 + .45 * phase);
    st.streak(_a, _b, .1, look.main, lit); st.streak(_a, _b, .035, look.core, lit * 1.2);
    if (phase >= .5) st.glow(_b, .16 + .1 * phase, look.core, lit, STAR, .22, tick + i);
  }
}
