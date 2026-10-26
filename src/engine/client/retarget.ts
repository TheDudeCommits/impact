import * as THREE from 'three';
import { resolveSkeleton, type Canonical } from '../../render/skeleton';

type Sampler = { evaluate(time: number): ArrayLike<number> };
const KEYED = ['position', 'quaternion', 'scale'] as const;
type Keyed = typeof KEYED[number];

export interface Rig {
  readonly root?: THREE.Object3D;
  readonly nodes: readonly { readonly name: string }[];
  readonly parent: Int32Array;
  readonly byName: ReadonlyMap<string, number>;
  readonly joints: ReadonlyMap<Canonical, number>;
  readonly refP: readonly THREE.Vector3[];
  readonly refQ: readonly THREE.Quaternion[];
  readonly refS: readonly THREE.Vector3[];
  readonly refWorld: readonly THREE.Matrix4[];
  readonly refWorldQ: readonly THREE.Quaternion[];
  readonly yaw: number;
  readonly hipsHeight: number;
  readonly problem?: string;
}

const CHAIN: readonly [Canonical, readonly Canonical[]][] = [
  ['Hips', ['Spine', 'Spine1', 'Spine2', 'Neck']],
  ['Spine', ['Spine1', 'Spine2', 'Neck']], ['Spine1', ['Spine2', 'Neck']], ['Spine2', ['Neck']], ['Neck', ['Head']], ['Head', []],
  ['LeftShoulder', ['LeftArm']], ['LeftArm', ['LeftForeArm']], ['LeftForeArm', ['LeftHand']], ['LeftHand', []],
  ['RightShoulder', ['RightArm']], ['RightArm', ['RightForeArm']], ['RightForeArm', ['RightHand']], ['RightHand', []],
  ['LeftUpLeg', ['LeftLeg']], ['LeftLeg', ['LeftFoot']], ['LeftFoot', ['LeftToeBase']], ['LeftToeBase', []],
  ['RightUpLeg', ['RightLeg']], ['RightLeg', ['RightFoot']], ['RightFoot', ['RightToeBase']], ['RightToeBase', []],
];
const PARENT: Partial<Record<Canonical, Canonical>> = {
  Spine: 'Hips', Spine1: 'Spine', Spine2: 'Spine1', Neck: 'Spine2', Head: 'Neck', LeftShoulder: 'Spine2', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm',
  LeftHand: 'LeftForeArm', RightShoulder: 'Spine2', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm', LeftUpLeg: 'Hips',
  LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot', RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot',
};
const CORE: readonly (Canonical | readonly Canonical[])[] = [
  'Hips', ['Spine', 'Spine1', 'Spine2'], ['Neck', 'Head'], 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
];
const CHECKED: readonly Canonical[] = ['LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg', 'Spine', 'Neck'];
const STRAY = 30;

const samplers = new WeakMap<THREE.KeyframeTrack, Sampler>();
const samplerOf = (track: THREE.KeyframeTrack) => {
  let sampler = samplers.get(track);
  if (!sampler) { sampler = (track as THREE.KeyframeTrack & { createInterpolant(): Sampler }).createInterpolant(); samplers.set(track, sampler); }
  return sampler;
};
function bind(rig: Pick<Rig, 'byName'>, clip: THREE.AnimationClip) {
  const out = new Map<number, Partial<Record<Keyed, Sampler>>>();
  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name), property = parsed.propertyName as Keyed;
    if (!KEYED.includes(property)) continue;
    const index = rig.byName.get(parsed.nodeName);
    if (index === undefined) continue;
    const entry = out.get(index) ?? {};
    entry[property] = samplerOf(track);
    out.set(index, entry);
  }
  return out;
}

const rigs = new WeakMap<THREE.Object3D, Map<THREE.AnimationClip | null, Rig>>();
export function rigOf(root: THREE.Object3D, reference?: THREE.AnimationClip): Rig {
  let byReference = rigs.get(root);
  if (!byReference) rigs.set(root, byReference = new Map());
  let rig = byReference.get(reference ?? null);
  if (!rig) byReference.set(reference ?? null, rig = buildRig(root, reference));
  return rig;
}
function buildRig(root: THREE.Object3D, reference?: THREE.AnimationClip): Rig {
  const nodes: THREE.Object3D[] = [], index = new Map<THREE.Object3D, number>();
  root.traverse(node => { index.set(node, nodes.length); nodes.push(node); });
  const parent = new Int32Array(nodes.length).fill(-1);
  nodes.forEach((node, i) => { if (node.parent && index.has(node.parent)) parent[i] = index.get(node.parent)!; });
  const byName = new Map<string, number>();
  nodes.forEach((node, i) => { if (!byName.has(node.name)) byName.set(node.name, i); });
  const bones: string[] = [];
  for (const node of nodes) if ((node as THREE.Bone).isBone) bones.push(node.name);
  const joints = new Map<Canonical, number>();
  for (const [canonical, actual] of resolveSkeleton(bones)) {
    const i = nodes.findIndex(node => (node as THREE.Bone).isBone && node.name === actual);
    if (i >= 0) joints.set(canonical as Canonical, i);
  }
  const refP = nodes.map(node => node.position.clone()), refQ = nodes.map(node => node.quaternion.clone()), refS = nodes.map(node => node.scale.clone());
  if (reference) for (const [i, tracks] of bind({ byName }, reference)) {
    if (tracks.position) refP[i].fromArray(tracks.position.evaluate(0) as number[]);
    if (tracks.quaternion) refQ[i].fromArray(tracks.quaternion.evaluate(0) as number[]).normalize();
    if (tracks.scale) refS[i].fromArray(tracks.scale.evaluate(0) as number[]);
  }
  return finishRig({ root, nodes, parent, byName, joints, refP, refQ, refS });
}

export interface RigData { readonly names: readonly string[]; readonly parents: ArrayLike<number>; readonly joints: Readonly<Partial<Record<Canonical, number>>>; readonly reference: ArrayLike<number> }
export function rigFromData(data: RigData): Rig {
  const count = data.names.length, parent = new Int32Array(count), byName = new Map<string, number>(), joints = new Map<Canonical, number>();
  const refP: THREE.Vector3[] = [], refQ: THREE.Quaternion[] = [], refS: THREE.Vector3[] = [], r = data.reference;
  for (let i = 0; i < count; i++) {
    parent[i] = data.parents[i];
    if (!byName.has(data.names[i])) byName.set(data.names[i], i);
    refP.push(new THREE.Vector3(r[i * 10], r[i * 10 + 1], r[i * 10 + 2]));
    refQ.push(new THREE.Quaternion(r[i * 10 + 3], r[i * 10 + 4], r[i * 10 + 5], r[i * 10 + 6]));
    refS.push(new THREE.Vector3(r[i * 10 + 7], r[i * 10 + 8], r[i * 10 + 9]));
  }
  for (const [joint, i] of Object.entries(data.joints)) if (i !== undefined) joints.set(joint as Canonical, i);
  return finishRig({ nodes: data.names.map(name => ({ name })), parent, byName, joints, refP, refQ, refS });
}
export function rigData(rig: Rig): RigData & { readonly kept: readonly number[] } {
  const needed = new Set<number>();
  for (const joint of rig.joints.values()) for (let i = joint; i >= 0; i = rig.parent[i]) needed.add(i);
  const kept = [...needed].sort((a, b) => a - b), at = new Map(kept.map((index, i) => [index, i]));
  const reference = new Float32Array(kept.length * 10);
  kept.forEach((index, i) => { rig.refP[index].toArray(reference, i * 10); rig.refQ[index].toArray(reference, i * 10 + 3); rig.refS[index].toArray(reference, i * 10 + 7); });
  return {
    kept, names: kept.map(index => rig.nodes[index].name), parents: kept.map(index => rig.parent[index] < 0 ? -1 : at.get(rig.parent[index])!),
    joints: Object.fromEntries([...rig.joints].map(([joint, index]) => [joint, at.get(index)!])), reference,
  };
}

type Parts = Pick<Rig, 'root' | 'nodes' | 'parent' | 'byName' | 'joints' | 'refP' | 'refQ' | 'refS'>;
function finishRig({ root, nodes, parent, byName, joints, refP, refQ, refS }: Parts): Rig {
  const refWorld: THREE.Matrix4[] = [], refWorldQ: THREE.Quaternion[] = [], local = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
  nodes.forEach((_, i) => {
    local.compose(refP[i], refQ[i], refS[i]);
    refWorld.push(i === 0 ? new THREE.Matrix4() : parent[i] < 0 ? local.clone() : refWorld[parent[i]].clone().multiply(local));
    refWorldQ.push(new THREE.Quaternion());
    refWorld[i].decompose(p, refWorldQ[i], s);
  });
  const at = (joint: Canonical) => { const i = joints.get(joint); return i === undefined ? undefined : new THREE.Vector3().setFromMatrixPosition(refWorld[i]); };
  const missing = CORE.filter(need => (Array.isArray(need) ? need : [need]).every(joint => !joints.has(joint as Canonical))).map(need => Array.isArray(need) ? need.join('/') : need);
  const hips = at('Hips'), head = at('Head') ?? at('Neck'), leftLeg = at('LeftUpLeg'), rightLeg = at('RightUpLeg');
  const feet = (['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'] as Canonical[]).map(at).filter((v): v is THREE.Vector3 => !!v);
  let yaw = 0, hipsHeight = 0, problem: string | undefined = missing.length ? `missing joints: ${missing.join(', ')}` : undefined;
  if (!problem && hips && head && leftLeg && rightLeg && feet.length) {
    const up = head.clone().sub(hips).normalize(), across = rightLeg.clone().sub(leftLeg);
    const forward = new THREE.Vector3(0, 1, 0).cross(across).setY(0);
    yaw = Math.atan2(forward.x, forward.z);
    hipsHeight = hips.y - Math.min(...feet.map(foot => foot.y));
    if (up.y < .8) problem = `its reference pose does not stand upright (spine ${Math.round(Math.acos(Math.min(1, up.y)) * 180 / Math.PI)} degrees off)`;
    else if (!(hipsHeight > 1e-4) || forward.lengthSq() < 1e-10) problem = 'its reference pose has no hips over its feet';
  }
  return { root, nodes, parent, byName, joints: joints as ReadonlyMap<Canonical, number>, refP, refQ, refS, refWorld, refWorldQ, yaw, hipsHeight, problem };
}

export type Fitted = { clip: THREE.AnimationClip; reason?: undefined; stray: number; pinned: number } | { clip?: undefined; reason: string };

function chainsOf(rig: Rig, joints: Iterable<number>) {
  const needed = new Set<number>();
  for (const joint of joints) for (let i = joint; i >= 0; i = rig.parent[i]) needed.add(i);
  return [...needed].sort((a, b) => a - b);
}

export function retarget(source: Rig, clip: THREE.AnimationClip, target: Rig, fps = 60): Fitted {
  if (source.problem) return { reason: `the source rig: ${source.problem}` };
  if (target.problem) return { reason: `the body: ${target.problem}` };
  if (!(clip.duration > 0)) return { reason: 'the clip has no length' };
  const tracks = bind(source, clip);
  if (!tracks.size) return { reason: 'the clip keys nothing on its own rig' };
  const shared = CHAIN.filter(([joint]) => source.joints.has(joint) && target.joints.has(joint))
    .map(([joint, toward]) => ({ joint, toward: toward.find(next => source.joints.has(next) && target.joints.has(next)), s: source.joints.get(joint)!, t: target.joints.get(joint)! }));
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), source.yaw - target.yaw), unturn = turn.clone().invert();
  const align = new Map<Canonical, THREE.Quaternion>();
  const toward = (rig: Rig, from: number, to: number) => new THREE.Vector3().setFromMatrixPosition(rig.refWorld[to]).sub(new THREE.Vector3().setFromMatrixPosition(rig.refWorld[from]));
  for (const entry of shared) {
    if (!entry.toward) { align.set(entry.joint, align.get(PARENT[entry.joint] ?? entry.joint)?.clone() ?? new THREE.Quaternion()); continue; }
    const s = toward(source, entry.s, source.joints.get(entry.toward)!), t = toward(target, entry.t, target.joints.get(entry.toward)!).applyQuaternion(turn);
    if (s.lengthSq() < 1e-12 || t.lengthSq() < 1e-12) { align.set(entry.joint, align.get(PARENT[entry.joint] ?? entry.joint)?.clone() ?? new THREE.Quaternion()); continue; }
    align.set(entry.joint, new THREE.Quaternion().setFromUnitVectors(t.normalize(), s.normalize()));
  }
  const sourceChain = chainsOf(source, shared.map(entry => entry.s)), targetChain = chainsOf(target, shared.map(entry => entry.t));
  const sourceShared = new Map(shared.map(entry => [entry.s, entry])), targetShared = new Map(shared.map(entry => [entry.t, entry]));
  const hipsS = source.joints.get('Hips')!, hipsT = target.joints.get('Hips')!;
  const scale = target.hipsHeight / source.hipsHeight;
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1), times = new Float32Array(frames);
  for (let f = 0; f < frames; f++) times[f] = Math.min(clip.duration, f / fps);
  times[frames - 1] = clip.duration;
  const rotations = new Map(shared.map(entry => [entry.t, new Float32Array(frames * 4)])), hipsTrack = new Float32Array(frames * 3);
  const sWorld = source.nodes.map(() => new THREE.Matrix4()), tWorldQ = target.nodes.map(() => new THREE.Quaternion()), tWorld = target.nodes.map(() => new THREE.Matrix4());
  const local = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), worldQ = new THREE.Quaternion(), delta = new THREE.Quaternion();
  const refHipsS = new THREE.Vector3().setFromMatrixPosition(source.refWorld[hipsS]), refHipsT = new THREE.Vector3().setFromMatrixPosition(target.refWorld[hipsT]);
  const hipsParentInverse = target.parent[hipsT] >= 0 ? target.refWorld[target.parent[hipsT]].clone().invert() : new THREE.Matrix4();
  const travel = new THREE.Vector3(), hipsLocal = new THREE.Vector3();
  let moved = 0, stray = 0, strayJoint = '', pinned = 0;
  const FEET: readonly Canonical[] = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
  const feetS = FEET.filter(joint => source.joints.has(joint) && target.joints.has(joint)).map(joint => source.joints.get(joint)!);
  const feetT = FEET.filter(joint => source.joints.has(joint) && target.joints.has(joint)).map(joint => target.joints.get(joint)!);
  const lowest = (world: readonly THREE.Matrix4[], feet: readonly number[]) => Math.min(...feet.map(i => world[i].elements[13]));
  const floorS = lowest(source.refWorld, feetS), floorT = lowest(target.refWorld, feetT);
  const underHips = new Set<number>();
  for (const i of targetChain) for (let k = i; k >= 0; k = target.parent[k]) if (k === hipsT) { underHips.add(i); break; }
  const carries = (rig: Rig, from: number, to: number) => { for (let i = rig.parent[to]; i >= 0; i = rig.parent[i]) if (i === from) return true; return false; };
  const checked = shared.filter(entry => entry.toward && CHECKED.includes(entry.joint) && carries(source, entry.s, source.joints.get(entry.toward)!) && carries(target, entry.t, target.joints.get(entry.toward)!));
  const sDir = new THREE.Vector3(), tDir = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), swing = new THREE.Quaternion();
  for (let f = 0; f < frames; f++) {
    const time = times[f];
    for (const i of sourceChain) {
      const entry = tracks.get(i);
      p.copy(source.refP[i]); q.copy(source.refQ[i]); s.copy(source.refS[i]);
      if (entry?.position) p.fromArray(entry.position.evaluate(time) as number[]);
      if (entry?.quaternion) q.fromArray(entry.quaternion.evaluate(time) as number[]).normalize();
      if (entry?.scale) s.fromArray(entry.scale.evaluate(time) as number[]);
      local.compose(p, q, s);
      if (i === 0) sWorld[i].identity(); else if (source.parent[i] < 0) sWorld[i].copy(local); else sWorld[i].multiplyMatrices(sWorld[source.parent[i]], local);
    }
    for (const i of targetChain) {
      const parentQ = target.parent[i] >= 0 && i !== 0 ? tWorldQ[target.parent[i]] : undefined, entry = targetShared.get(i);
      if (entry) {
        sWorld[entry.s].decompose(p, worldQ, s);
        delta.copy(worldQ).multiply(q.copy(source.refWorldQ[entry.s]).invert());
        if (entry.toward) {
          const to = source.joints.get(entry.toward)!;
          sDir.setFromMatrixPosition(sWorld[to]).sub(a.setFromMatrixPosition(sWorld[entry.s]));
          b.setFromMatrixPosition(source.refWorld[to]).sub(a.setFromMatrixPosition(source.refWorld[entry.s])).applyQuaternion(delta);
          if (sDir.lengthSq() > 1e-12 && b.lengthSq() > 1e-12) delta.premultiply(swing.setFromUnitVectors(b.normalize(), sDir.normalize()));
        }
        moved = Math.max(moved, 2 * Math.acos(Math.min(1, Math.abs(delta.w))));
        tWorldQ[i].copy(unturn).multiply(delta).multiply(align.get(entry.joint)!).multiply(turn).multiply(target.refWorldQ[i]);
        const localQ = q.copy(parentQ ?? new THREE.Quaternion()).invert().multiply(tWorldQ[i]).normalize();
        const out = rotations.get(i)!, prev = f > 0 ? out.subarray((f - 1) * 4, f * 4) : undefined;
        if (prev && prev[0] * localQ.x + prev[1] * localQ.y + prev[2] * localQ.z + prev[3] * localQ.w < 0) localQ.set(-localQ.x, -localQ.y, -localQ.z, -localQ.w);
        localQ.toArray(out, f * 4);
        local.compose(i === hipsT ? hipsLocal : target.refP[i], localQ, target.refS[i]);
      } else {
        if (i === 0) tWorldQ[i].identity(); else tWorldQ[i].copy(parentQ ?? new THREE.Quaternion()).multiply(target.refQ[i]);
        local.compose(target.refP[i], target.refQ[i], target.refS[i]);
      }
      if (i === hipsT) {
        travel.setFromMatrixPosition(sWorld[hipsS]).sub(refHipsS).multiplyScalar(scale).applyQuaternion(unturn);
        hipsLocal.copy(refHipsT).add(travel).applyMatrix4(hipsParentInverse);
        hipsLocal.toArray(hipsTrack, f * 3);
        local.compose(hipsLocal, q.copy(parentQ ?? new THREE.Quaternion()).invert().multiply(tWorldQ[i]).normalize(), target.refS[i]);
      }
      if (i === 0) tWorld[i].identity(); else if (target.parent[i] < 0) tWorld[i].copy(local); else tWorld[i].multiplyMatrices(tWorld[target.parent[i]], local);
    }
    for (const entry of checked) {
      sDir.setFromMatrixPosition(sWorld[source.joints.get(entry.toward!)!]).sub(a.setFromMatrixPosition(sWorld[entry.s]));
      tDir.setFromMatrixPosition(tWorld[target.joints.get(entry.toward!)!]).sub(b.setFromMatrixPosition(tWorld[entry.t])).applyQuaternion(turn);
      if (sDir.lengthSq() < 1e-12 || tDir.lengthSq() < 1e-12) continue;
      const angle = sDir.angleTo(tDir) * 180 / Math.PI;
      if (angle > stray) { stray = angle; strayJoint = entry.joint; }
    }
    if (feetS.length) {
      const dy = (lowest(sWorld, feetS) - floorS) / source.hipsHeight * target.hipsHeight - (lowest(tWorld, feetT) - floorT);
      if (Math.abs(dy) > 1e-7) {
        travel.y += dy;
        hipsLocal.copy(refHipsT).add(travel).applyMatrix4(hipsParentInverse);
        hipsLocal.toArray(hipsTrack, f * 3);
        for (const i of underHips) tWorld[i].elements[13] += dy;
        pinned = Math.max(pinned, Math.abs(dy) / target.hipsHeight);
      }
    }
    for (const value of hipsTrack.subarray(f * 3, f * 3 + 3)) if (!Number.isFinite(value)) return { reason: 'the fit came out non-finite' };
  }
  if (moved < .02) return { reason: 'the clip moves no joint the two rigs share' };
  if (stray > STRAY) return { reason: `the rigs disagree: the ${strayJoint} strays ${Math.round(stray)} degrees from the source's` };
  const out: THREE.KeyframeTrack[] = [], ends = [0, clip.duration];
  const held = (name: string, property: 'position' | 'quaternion' | 'scale', value: THREE.Vector3 | THREE.Quaternion) => {
    const values = [...value.toArray(), ...value.toArray()];
    out.push(property === 'quaternion' ? new THREE.QuaternionKeyframeTrack(`${name}.${property}`, ends, values) : new THREE.VectorKeyframeTrack(`${name}.${property}`, ends, values));
  };
  for (const i of targetChain) {
    if (i === 0) continue;
    const name = target.nodes[i].name, entry = targetShared.get(i);
    if (!entry) { held(name, 'position', target.refP[i]); held(name, 'quaternion', target.refQ[i]); held(name, 'scale', target.refS[i]); continue; }
    const values = rotations.get(i)!;
    for (const value of values) if (!Number.isFinite(value)) return { reason: 'the fit came out non-finite' };
    out.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
    if (i === hipsT) out.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, hipsTrack));
    else held(name, 'position', target.refP[i]);
  }
  return { clip: new THREE.AnimationClip(clip.name, clip.duration, out), stray, pinned };
}
