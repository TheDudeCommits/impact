import * as THREE from 'three';

export function measuredShadowSide(geometry: THREE.BufferGeometry, outward: number | null = 1): THREE.Side | null {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  if (!position || !normal || outward === null) return null;
  const index = geometry.getIndex();
  const triangles = Math.floor((index ? index.count : position.count) / 3);
  if (triangles === 0) return null;
  const at = (i: number) => index ? index.getX(i) : i;
  const step = Math.max(1, Math.floor(triangles / 4000));
  let agree = 0, counted = 0;
  for (let t = 0; t < triangles; t += step) {
    const a = at(3 * t), b = at(3 * t + 1), c = at(3 * t + 2);
    const ax = position.getX(a), ay = position.getY(a), az = position.getZ(a);
    const ux = position.getX(b) - ax, uy = position.getY(b) - ay, uz = position.getZ(b) - az;
    const vx = position.getX(c) - ax, vy = position.getY(c) - ay, vz = position.getZ(c) - az;
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * fx + fy * fy + fz * fz < 1e-20) continue;
    const nx = normal.getX(a) + normal.getX(b) + normal.getX(c);
    const ny = normal.getY(a) + normal.getY(b) + normal.getY(c);
    const nz = normal.getZ(a) + normal.getZ(b) + normal.getZ(c);
    const d = fx * nx + fy * ny + fz * nz;
    if (d === 0) continue;
    counted++; if (d > 0) agree++;
  }
  if (counted < 8) return null;
  const share = agree / counted;
  const agrees = share >= SHADOW_WINDING_SURE ? true : share <= 1 - SHADOW_WINDING_SURE ? false : null;
  const out = outward >= SHADOW_OUTWARD_SURE ? true : outward <= 1 - SHADOW_OUTWARD_SURE ? false : null;
  if (agrees === null || out === null) return null;
  return agrees === out ? THREE.BackSide : THREE.FrontSide;
}
export const SHADOW_OUTWARD_SURE = .6;

export function outwardShare(mesh: THREE.SkinnedMesh): number | null {
  const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
  const skeleton = mesh.skeleton;
  if (!position || !normal || !skeleton) return null;
  const heads: THREE.Vector3[] = [], tails: THREE.Vector3[] = [];
  const at = skeleton.boneInverses.map(inverse => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(inverse).invert()));
  skeleton.bones.forEach((bone, i) => {
    const parent = skeleton.bones.indexOf(bone.parent as THREE.Bone);
    if (parent >= 0 && at[parent].distanceToSquared(at[i]) > 1e-8) { heads.push(at[parent]); tails.push(at[i]); }
  });
  if (!heads.length) return null;
  const bind = mesh.bindMatrix, normalBind = new THREE.Matrix3().getNormalMatrix(bind);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3(), v = new THREE.Vector3(), w = new THREE.Vector3();
  const step = Math.max(1, Math.floor(position.count / 1500));
  let outward = 0, counted = 0;
  for (let i = 0; i < position.count; i += step) {
    p.fromBufferAttribute(position, i).applyMatrix4(bind);
    n.fromBufferAttribute(normal, i).applyMatrix3(normalBind);
    let best = Infinity;
    for (let k = 0; k < heads.length; k++) {
      v.subVectors(tails[k], heads[k]);
      const t = THREE.MathUtils.clamp(w.subVectors(p, heads[k]).dot(v) / v.lengthSq(), 0, 1);
      const d = w.copy(heads[k]).addScaledVector(v, t).distanceToSquared(p);
      if (d < best) { best = d; q.copy(heads[k]).addScaledVector(v, t); }
    }
    const s = q.subVectors(p, q).dot(n);
    if (s === 0) continue;
    counted++; if (s > 0) outward++;
  }
  return counted >= 8 ? outward / counted : null;
}
export const SHADOW_WINDING_SURE = .8;

export const SHADOW_SIDE_FIGHTERS: ReadonlySet<string> = new Set(['goku', 'vegeta', 'guts']);

export function fixShadowSide(mesh: THREE.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  if (!materials.some(m => m.side === THREE.DoubleSide)) return null;
  const skinned = mesh as THREE.SkinnedMesh;
  const side = measuredShadowSide(mesh.geometry, skinned.isSkinnedMesh ? outwardShare(skinned) : null);
  if (side === null) return null;
  for (const m of materials) if (m.side === THREE.DoubleSide) m.shadowSide = side;
  return side;
}
