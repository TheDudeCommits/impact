import * as THREE from 'three';
import type { FighterId } from '../../game/types';

export const HAND_GRIP: Partial<Record<FighterId, { side: 'Right' | 'Left'; curl: readonly [number, number, number]; thumb: readonly [number, number, number] }>> = {
  sasuke: { side: 'Right', curl: [70, 88, 62], thumb: [34, 30, 24] },
};

const NOT_FINGER = /effect|equip|weapon|blade|sword|kunai|prop|attach|tail|twist/i, THUMB = /thumb|finger0/i;

export function gripPlan(hand: THREE.Bone, curl: readonly number[], thumb: readonly number[], body?: THREE.Object3D) {
  const root = hand.parent ?? hand;
  root.updateMatrixWorld(true);
  const bones = (o: THREE.Object3D) => o.children.filter((c): c is THREE.Bone => (c as THREE.Bone).isBone && !NOT_FINGER.test(c.name));
  const through = (b: THREE.Bone | undefined): THREE.Bone | undefined => { while (b && /_scaleCompensation$/.test(b.name)) b = bones(b)[0]; return b; };
  const roots: THREE.Bone[] = [];
  for (const c of bones(hand)) { const b = through(c); if (!b) continue; if (/base/i.test(b.name)) roots.push(...bones(b).map(through).filter((x): x is THREE.Bone => !!x)); else roots.push(b); }
  const chains = roots.map(r => { const chain = [r]; while (chain.length < 3) { const next = through(bones(chain[chain.length - 1])[0]); if (!next) break; chain.push(next); } return chain; }).filter(c => c.length >= 2);
  const at = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3());
  const centre = at(hand), reach = 3 * Math.max(...chains.map(c => at(c[0]).distanceTo(centre)));
  const thumbs = chains.filter(c => THUMB.test(c[0].name)), fingers = chains.filter(c => !THUMB.test(c[0].name));
  if (fingers.length < 2) return [];
  const along = new THREE.Vector3();
  for (const c of fingers) along.add(at(c[1]).sub(at(c[0])).normalize());
  along.normalize();
  let a = at(fingers[0][0]), b = at(fingers[1][0]), far = -1;
  for (const p of fingers) for (const q of fingers) { const d = at(p[0]).distanceTo(at(q[0])); if (d > far) { far = d; a = at(p[0]); b = at(q[0]); } }
  const across = b.sub(a).normalize(), normal = new THREE.Vector3().crossVectors(along, across).normalize();
  const middle = body ? at(body) : new THREE.Vector3();
  const inward = new THREE.Vector3(middle.x - centre.x, 0, middle.z - centre.z);
  if (inward.lengthSq() > 1e-8) inward.normalize();
  const palm = normal.dot(new THREE.Vector3(0, -1, 0)) + normal.dot(inward) >= 0 ? normal : normal.clone().negate();
  const out: { bone: THREE.Bone; target: THREE.Quaternion }[] = [];
  const turn = new THREE.Quaternion(), world = new THREE.Quaternion();
  for (const [isThumb, chain] of [...fingers.map(c => [false, c] as const), ...thumbs.map(c => [true, c] as const)]) {
    const axisWorld = (isThumb ? along : across).clone();
    const start = at(chain[0]), end = at(chain[chain.length - 1]);
    const moved = end.clone().sub(start).applyQuaternion(turn.setFromAxisAngle(axisWorld, THREE.MathUtils.degToRad(30))).add(start);
    if (moved.sub(end).dot(palm) < 0) axisWorld.negate();
    const degrees = isThumb ? thumb : curl;
    chain.forEach((bone, i) => {
      if (at(bone).distanceTo(centre) > reach) return;
      bone.getWorldQuaternion(world);
      const local = axisWorld.clone().applyQuaternion(world.clone().invert()).normalize();
      out.push({ bone, target: bone.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(local, THREE.MathUtils.degToRad(degrees[Math.min(i, 2)]))) });
    });
  }
  return out;
}
