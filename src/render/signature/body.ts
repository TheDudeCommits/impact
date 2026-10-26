import * as THREE from 'three';
import type { Fighter } from '../Fighter';

const HIPS = /^(mixamorig:?)?hips$|^(def)?pelvis$|^bip0?1[ _]pelvis$/i;
const bones = new WeakMap<Fighter, THREE.Bone[]>();
const since = new WeakMap<Fighter, number>();
const shown = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true; };
function gather(f: Fighter) {
  const found: THREE.Bone[] = [];
  f.group.traverse(o => { if ((o as THREE.Bone).isBone && HIPS.test(o.name)) found.push(o as THREE.Bone); });
  bones.set(f, found); since.set(f, 0); return found;
}
export function bodyCenter(f: Fighter, out: THREE.Vector3) {
  let list = bones.get(f) ?? gather(f);
  for (let pass = 0; pass < 2; pass++) {
    for (const bone of list) if (shown(bone)) return bone.getWorldPosition(out);
    const calls = (since.get(f) ?? 0) + 1; since.set(f, calls);
    if (pass > 0 || calls < 60) break;
    list = gather(f);
  }
  return out.copy(f.group.position).setY(f.group.position.y + 1);
}
