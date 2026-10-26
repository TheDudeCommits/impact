import * as THREE from 'three';
import type { PlayerState } from '../../game/types';
import type { HandKind, HandPose, HandRow, HandShape } from './handTable';

export const HANDS = {
  on: true,
};
export const FLAT_BELOW = 27;
export const FAN_ABOVE = 8.5;
const KEEP_BELOW = 31, KEEP_ABOVE = 6.5;
const TAKE = .1, EASE = 22, EASE_FOR = .3;

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const;
type Finger = typeof FINGERS[number];
const MEASURED_TAIL = /thumb|index|middle|ring|pinky|finger/i;

export interface Shape { curl: readonly (readonly [number, number, number])[]; spread: number; thumb: readonly (readonly [number, number, number])[] }
export const SHAPES: Record<HandShape, Shape> = {
  relaxed: { curl: [[22, 40, 26], [25, 44, 28], [28, 47, 30], [32, 50, 32]], spread: 9, thumb: [[.8, .5, .3], [.92, .28, .25], [.95, .15, .28]] },
  fist: { curl: [[72, 92, 78], [74, 94, 80], [75, 94, 80], [74, 92, 78]], spread: 2, thumb: [[.55, .55, .63], [.45, -.75, .48], [.2, -.95, -.2]] },
  grip: { curl: [[58, 84, 50], [62, 86, 52], [64, 86, 52], [64, 84, 50]], spread: 3, thumb: [[.5, .55, .67], [.5, -.45, .74], [.3, -.9, .3]] },
  palm: { curl: [[16, 34, 24], [17, 36, 25], [18, 37, 25], [20, 39, 26]], spread: 5, thumb: [[.82, .52, .22], [.95, .25, .18], [.97, .12, .2]] },
  claw: { curl: [[26, 62, 46], [28, 64, 48], [29, 64, 48], [30, 62, 46]], spread: 30, thumb: [[.6, .6, .52], [.72, .3, .62], [.6, .05, .8]] },
};
const FAN: Record<Exclude<Finger, 'Thumb'>, number> = { Index: .5, Middle: .17, Ring: -.17, Pinky: -.5 };

const v = () => new THREE.Vector3(), q = () => new THREE.Quaternion();
const deg = (r: number) => r * 180 / Math.PI, rad = (d: number) => d * Math.PI / 180;

export function handKind(state: Pick<PlayerState, 'action' | 'chain'>): HandKind {
  switch (state.action) {
    case 'guard': case 'run': case 'dash': case 'jump': case 'heavy': case 'special': case 'ultimate': case 'area': return state.action;
    case 'light': return LIGHTS[Math.min(3, Math.max(0, Math.floor(state.chain ?? 0)))];
    case 'flinch': case 'hurt': case 'stun': return 'hit';
    case 'launched': case 'splat': return 'launched';
    case 'knockdown': case 'defeated': return 'down';
    case 'getup': return 'getup';
    default: return 'idle';
  }
}
const LIGHTS = ['light1', 'light2', 'light3', 'light4'] as const;
const GROUP: Record<HandKind, 'stand' | 'move' | 'blow' | 'cast' | 'struck'> = { idle: 'stand', guard: 'stand', run: 'move', dash: 'move', jump: 'move', light1: 'blow', light2: 'blow', light3: 'blow', light4: 'blow', heavy: 'blow', special: 'cast', ultimate: 'cast', area: 'cast', hit: 'struck', launched: 'struck', down: 'struck', getup: 'struck' };
export const HAND_DEFAULT: Record<HandKind, HandPose> = { idle: 'relaxed', guard: 'fist', run: 'relaxed', dash: 'relaxed', jump: 'relaxed', light1: 'fist', light2: 'fist', light3: 'fist', light4: 'fist', heavy: 'fist', special: 'fist', ultimate: 'fist', area: 'fist', hit: 'relaxed', launched: 'relaxed', down: 'relaxed', getup: 'relaxed' };
export const HAND_KINDS = Object.keys(HAND_DEFAULT) as HandKind[];
const KIND_AT = Object.fromEntries(HAND_KINDS.map((kind, i) => [kind, i])) as Record<HandKind, number>;
export function handPose(row: HandRow, side: 'L' | 'R', kind: HandKind, form = false): HandPose {
  const keys = [kind, ...(kind.startsWith('light') ? ['light'] : []), GROUP[kind], 'all'] as const, source = form && row.form ? row.form : row;
  for (const hand of [source[side], source.both]) {
    if (!hand) continue;
    if (typeof hand === 'string') return hand;
    for (const key of keys) { const pose = (hand as Record<string, HandPose | undefined>)[key]; if (pose) return pose; }
  }
  return HAND_DEFAULT[kind];
}

export interface HandRig {
  side: 'L' | 'R';
  hand: THREE.Bone;
  bones: THREE.Bone[];
  chains: { finger: Finger; from: number; count: number }[];
  bindQ: THREE.Quaternion[]; joint: THREE.Vector3[]; along: THREE.Vector3[]; step: (THREE.Vector3 | undefined)[]; rest: THREE.Quaternion[];
  rootQ: THREE.Quaternion[];
  fwd: THREE.Vector3; across: THREE.Vector3; palm: THREE.Vector3;
  four: number[]; middle: number; first: number; last: number; line: THREE.Vector3;
  runs: Float32Array;
  watch: [number, number];
}

export function handRig(hand: THREE.Bone, side: 'L' | 'R', model: THREE.Object3D): HandRig | undefined {
  const S = side === 'L' ? 'Left' : 'Right', named = new Map<string, THREE.Bone>();
  hand.traverse(o => { if ((o as THREE.Bone).isBone && o !== hand && !named.has(o.name)) named.set(o.name, o as THREE.Bone); });
  const bind = new Map<THREE.Object3D, THREE.Matrix4>();
  model.traverse(o => { const mesh = o as THREE.SkinnedMesh; if (!mesh.isSkinnedMesh || !mesh.skeleton) return; mesh.skeleton.bones.forEach((bone, i) => { if (!bind.has(bone) && (bone === hand || named.get(bone.name) === bone)) bind.set(bone, mesh.skeleton.boneInverses[i].clone().invert()); }); });
  const handBind = bind.get(hand), inHand = handBind?.clone().invert();
  const frame = (bone: THREE.Object3D) => {
    const m = new THREE.Matrix4(), own = bind.get(bone);
    if (own && inHand) m.multiplyMatrices(inHand, own);
    else { const up: THREE.Object3D[] = []; for (let n: THREE.Object3D | null = bone; n && n !== hand; n = n.parent) up.unshift(n); for (const n of up) m.multiply(new THREE.Matrix4().compose(n.position, n.quaternion, n.scale)); }
    const p = v(), r = q(); m.decompose(p, r, v()); return { p, r };
  };
  const rig: HandRig = { side, hand, bones: [], chains: [], bindQ: [], joint: [], along: [], step: [], rest: [], rootQ: [], fwd: v(), across: v(), palm: v(), four: [], middle: 0, first: 0, last: 0, line: v(), runs: new Float32Array(0), watch: [0, 0] };
  for (const finger of FINGERS) {
    const chain: THREE.Bone[] = [];
    for (let n = 1; n <= 4; n++) { const bone = named.get(`${S}Hand${finger}${n}`); if (!bone || (chain.length && bone.parent !== chain[chain.length - 1])) break; chain.push(bone); }
    if (chain.length < 2) continue;
    const from = rig.bones.length, places = chain.map(frame);
    rig.chains.push({ finger, from, count: chain.length });
    rig.rootQ.push(chain[0].parent === hand || !chain[0].parent ? q() : frame(chain[0].parent).r);
    chain.forEach((bone, i) => {
      const inverse = places[i].r.clone().invert();
      let step: THREE.Vector3 | undefined, along: THREE.Vector3;
      if (i + 1 < chain.length) { step = places[i + 1].p.clone().sub(places[i].p).applyQuaternion(inverse); along = step.clone().normalize(); }
      else {
        const before = rig.along[rig.along.length - 1].clone(), was = rig.step[rig.step.length - 1]!.length();
        const tail = bone.children.find(c => (c as THREE.Bone).isBone && MEASURED_TAIL.test(c.name) && bind.has(c) === bind.has(bone));
        const to = tail ? frame(tail).p.sub(places[i].p).applyQuaternion(inverse) : undefined;
        step = to; along = to && to.length() > was * .3 && to.length() < was * 3 ? to.clone().normalize() : before;
      }
      rig.bones.push(bone); rig.bindQ.push(places[i].r); rig.joint.push(places[i].p); rig.along.push(along); rig.step.push(step); rig.rest.push(bone.quaternion.clone());
    });
  }
  rig.runs = new Float32Array(rig.bones.length * 3);
  rig.step.forEach((step, k) => { if (step && step.lengthSq() > 1e-12) step.clone().normalize().toArray(rig.runs, k * 3); });
  rig.four = rig.chains.flatMap((c, i) => c.finger === 'Thumb' ? [] : [i]);
  if (rig.four.length < 2) return undefined;
  for (const i of rig.four) rig.fwd.add(rig.joint[rig.chains[i].from]);
  rig.fwd.normalize();
  const is = (finger: Finger) => rig.four.find(i => rig.chains[i].finger === finger);
  rig.first = is('Index') ?? rig.four[0]; rig.last = is('Pinky') ?? rig.four[rig.four.length - 1]; rig.middle = is('Middle') ?? rig.four[Math.floor(rig.four.length / 2)];
  rig.line.copy(rig.joint[rig.chains[rig.middle].from]).normalize();
  rig.watch = [rig.chains[rig.first].from, rig.chains[rig.last].from + 1];
  rig.across.copy(rig.joint[rig.chains[rig.first].from]).sub(rig.joint[rig.chains[rig.last].from]); rig.across.addScaledVector(rig.fwd, -rig.across.dot(rig.fwd)).normalize();
  if (!(rig.fwd.lengthSq() > .5) || !(rig.across.lengthSq() > .5)) return undefined;
  if (side === 'R') rig.palm.crossVectors(rig.across, rig.fwd); else rig.palm.crossVectors(rig.fwd, rig.across);
  rig.palm.normalize();
  return rig;
}

export function readHand(rig: HandRig, quats?: readonly THREE.Quaternion[], out: { curl: number; spread: number; splay: number } = { curl: 0, spread: 0, splay: 0 }) {
  const runs = rig.runs, bones = rig.bones, line = rig.line;
  let curl = 0, count = 0, ax = 0, ay = 0, az = 1, bx = 0, by = 0, bz = 1;
  for (const index of rig.four) {
    const c = rig.chains[index], root = rig.rootQ[index];
    let wx = root.x, wy = root.y, wz = root.z, ww = root.w, px = line.x, py = line.y, pz = line.z;
    for (let k = c.from, end = c.from + c.count; k < end; k++) {
      const turn = quats ? quats[k] : bones[k].quaternion, qx = turn.x, qy = turn.y, qz = turn.z, qw = turn.w;
      const nx = wx * qw + ww * qx + wy * qz - wz * qy, ny = wy * qw + ww * qy + wz * qx - wx * qz, nz = wz * qw + ww * qz + wx * qy - wy * qx, nw = ww * qw - wx * qx - wy * qy - wz * qz;
      wx = nx; wy = ny; wz = nz; ww = nw;
      const dx = runs[k * 3], dy = runs[k * 3 + 1], dz = runs[k * 3 + 2];
      if (dx === 0 && dy === 0 && dz === 0) continue;
      const tx = 2 * (wy * dz - wz * dy), ty = 2 * (wz * dx - wx * dz), tz = 2 * (wx * dy - wy * dx);
      let rx = dx + ww * tx + (wy * tz - wz * ty), ry = dy + ww * ty + (wz * tx - wx * tz), rz = dz + ww * tz + (wx * ty - wy * tx);
      const length = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1; rx /= length; ry /= length; rz /= length;
      const cos = px * rx + py * ry + pz * rz;
      curl += Math.acos(cos > 1 ? 1 : cos < -1 ? -1 : cos); count++; px = rx; py = ry; pz = rz;
      if (k === c.from) { if (index === rig.first) { ax = rx; ay = ry; az = rz; } if (index === rig.last) { bx = rx; by = ry; bz = rz; } }
    }
  }
  const fan = ax * bx + ay * by + az * bz;
  out.curl = count ? deg(curl / count) : 0;
  out.spread = rig.first !== rig.last ? deg(Math.acos(fan > 1 ? 1 : fan < -1 ? -1 : fan)) : 0;
  out.splay = out.spread * Math.min(1, Math.max(0, 1 - out.curl / 60));
  return out;
}

export function shapeHand(rig: HandRig, shape: Shape): THREE.Quaternion[] {
  const out: THREE.Quaternion[] = [], world = q(), swing = q(), now = v(), want = v(), base = v();
  rig.chains.forEach((c, index) => {
    world.copy(rig.rootQ[index]);
    const thumb = c.finger === 'Thumb', fan = thumb ? 0 : rad(shape.spread * FAN[c.finger as Exclude<Finger, 'Thumb'>]);
    const curl = thumb ? undefined : shape.curl[Math.min(shape.curl.length - 1, ['Index', 'Middle', 'Ring', 'Pinky'].indexOf(c.finger))];
    base.copy(rig.fwd).multiplyScalar(Math.cos(fan)).addScaledVector(rig.across, Math.sin(fan));
    let fold = 0;
    for (let i = 0; i < c.count; i++) {
      const k = c.from + i;
      if (thumb) { const t = shape.thumb[Math.min(shape.thumb.length - 1, c.count < 3 ? i + 1 : i)]; want.set(0, 0, 0).addScaledVector(rig.fwd, t[0]).addScaledVector(rig.across, t[1]).addScaledVector(rig.palm, t[2]).normalize(); }
      else { fold += rad(curl![Math.min(2, i)]); want.copy(base).multiplyScalar(Math.cos(fold)).addScaledVector(rig.palm, Math.sin(fold)); }
      const modelled = (i ? rig.bindQ[k - 1].clone().invert() : rig.rootQ[index].clone().invert()).multiply(rig.bindQ[k]), carried = world.clone().multiply(modelled);
      now.copy(rig.along[k]).applyQuaternion(carried);
      swing.setFromUnitVectors(now, want);
      const posed = swing.clone().multiply(carried);
      out.push(world.clone().invert().multiply(posed).normalize());
      world.copy(posed);
    }
  });
  return out;
}

interface ClipHand { tracks: (THREE.KeyframeTrack | undefined)[]; unkeyed: number[]; still: boolean }
type Sampler = THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant };
interface Held {
  poses: HandPose[];
  weight: number; taken: boolean;
  shown: THREE.Quaternion[]; clip?: THREE.AnimationClip; pose?: HandPose; easing: number;
  targets: Partial<Record<HandPose, THREE.Quaternion[]>>;
  curl: number; splay: number; read?: THREE.AnimationClip; watch: Float64Array;
}
const _read = { curl: 0, spread: 0, splay: 0 };
const near = (x: number, y: number) => x - y < 1e-7 && y - x < 1e-7;

export class HandLayer {
  readonly rigs: HandRig[] = [];
  readonly bones: THREE.Bone[] = [];
  private plans = new WeakMap<THREE.AnimationClip, ClipHand[]>();
  private byTrack = new Map<string, [number, number]>();
  private held: Held[] = [];
  constructor(readonly row: HandRow, readonly form: boolean, joints: ReadonlyMap<string, THREE.Bone>, model: THREE.Object3D, private reference?: THREE.AnimationClip) {
    for (const side of ['L', 'R'] as const) {
      const hand = joints.get(side === 'L' ? 'LeftHand' : 'RightHand'), rig = hand && handRig(hand, side, model);
      if (!rig) continue;
      const h = this.rigs.length;
      this.rigs.push(rig);
      this.held.push({ poses: HAND_KINDS.map(kind => handPose(row, side, kind, form)), weight: 0, taken: false, shown: rig.bones.map(() => q()), easing: 0, targets: {}, curl: 0, splay: 0, watch: new Float64Array(8) });
      rig.bones.forEach((bone, k) => { this.bones.push(bone); this.byTrack.set(`${bone.name}.quaternion`, [h, k]); });
    }
  }
  private plan(clip: THREE.AnimationClip): ClipHand[] {
    let plan = this.plans.get(clip);
    if (plan) return plan;
    plan = this.rigs.map(rig => ({ tracks: rig.bones.map(() => undefined), unkeyed: [] as number[], still: true }));
    for (const track of clip.tracks) { const at = this.byTrack.get(track.name); if (at && track.times.length) plan[at[0]].tracks[at[1]] = track; }
    for (const hand of plan) { hand.unkeyed = hand.tracks.flatMap((track, k) => track ? [] : [k]); hand.still = hand.tracks.every(track => !track || held(track)); }
    this.plans.set(clip, plan);
    return plan;
  }
  sample(h: number, clip: THREE.AnimationClip, time: number): THREE.Quaternion[] {
    const hand = this.plan(clip)[h];
    return this.rigs[h].rest.map((rest, k) => { const track = hand.tracks[k]; return track ? q().fromArray((track as Sampler).createInterpolant().evaluate(Math.min(Math.max(0, time), clip.duration)) as unknown as number[]) : rest.clone(); });
  }
  target(h: number, pose: HandPose): THREE.Quaternion[] {
    const state = this.held[h], known = state.targets[pose]; if (known) return known;
    let made: THREE.Quaternion[] | undefined;
    if (pose === 'held' && this.reference) { const own = this.sample(h, this.reference, 0), r = readHand(this.rigs[h], own); if (!unposed(r)) made = own; }
    made ??= shapeHand(this.rigs[h], SHAPES[pose === 'held' || pose === 'own' ? 'grip' : pose]);
    return state.targets[pose] = made;
  }
  poseOf(h: number, kind: HandKind) { return this.held[h].poses[HAND_KINDS.indexOf(kind)]; }
  apply(clip: THREE.AnimationClip, state: Pick<PlayerState, 'action' | 'chain'>, dt: number) {
    const kind = KIND_AT[handKind(state)], plan = this.plan(clip);
    for (let h = 0; h < this.rigs.length; h++) {
      const rig = this.rigs[h], hand = this.held[h], pose = hand.poses[kind], fresh = hand.clip !== clip;
      for (const k of plan[h].unkeyed) rig.bones[k].quaternion.copy(rig.rest[k]);
      if (pose === 'own') hand.taken = false;
      else {
        const a = rig.bones[rig.watch[0]].quaternion, b = rig.bones[rig.watch[1]].quaternion, w = hand.watch;
        if (!(plan[h].still && hand.read === clip && near(a.x, w[0]) && near(a.y, w[1]) && near(a.z, w[2]) && near(a.w, w[3]) && near(b.x, w[4]) && near(b.y, w[5]) && near(b.z, w[6]) && near(b.w, w[7]))) {
          readHand(rig, undefined, _read); hand.curl = _read.curl; hand.splay = _read.splay; hand.read = clip;
          w[0] = a.x; w[1] = a.y; w[2] = a.z; w[3] = a.w; w[4] = b.x; w[5] = b.y; w[6] = b.z; w[7] = b.w;
        }
        hand.taken = hand.taken && !fresh ? hand.curl < KEEP_BELOW || hand.splay > KEEP_ABOVE : hand.curl < FLAT_BELOW || hand.splay > FAN_ABOVE;
      }
      const goal = hand.taken ? 1 : 0;
      hand.weight = fresh || !(dt > 0) ? goal : hand.weight + Math.min(dt / TAKE, Math.max(-dt / TAKE, goal - hand.weight));
      if (!(hand.weight > 0)) { hand.clip = clip; hand.pose = undefined; continue; }
      const want = hand.taken ? pose : hand.pose ?? pose, to = this.target(h, want), shown = hand.shown;
      if (fresh || hand.pose === undefined || !(dt > 0)) hand.easing = 0; else if (hand.pose !== want) hand.easing = EASE_FOR;
      if (hand.easing > 0 && dt > 0) { const k = 1 - Math.exp(-dt * EASE); for (let i = 0; i < shown.length; i++) shown[i].slerp(to[i], k); hand.easing -= dt; }
      else if (!(hand.easing > 0)) for (let i = 0; i < shown.length; i++) shown[i].copy(to[i]);
      const w = hand.weight * hand.weight * (3 - 2 * hand.weight);
      if (w >= 1) for (let i = 0; i < shown.length; i++) rig.bones[i].quaternion.copy(shown[i]);
      else for (let i = 0; i < shown.length; i++) rig.bones[i].quaternion.slerp(shown[i], w);
      hand.clip = clip; hand.pose = want;
    }
  }
  survey(clips: readonly THREE.AnimationClip[], samples = 9) {
    return clips.map(clip => ({ clip: clip.name, hands: this.rigs.map((rig, h) => {
      const hand = this.plan(clip)[h], samplers = hand.tracks.map(track => track ? (track as Sampler).createInterpolant() : undefined), values = rig.rest.map(r => r.clone());
      const n = hand.tracks.some(track => track && track.times.length > 1) ? samples : 1, curls: number[] = [], splays: number[] = []; let open = 0;
      for (let i = 0; i < n; i++) {
        const t = n > 1 ? clip.duration * i / (n - 1) : 0;
        samplers.forEach((s, k) => { if (s) values[k].fromArray(s.evaluate(Math.min(t, clip.duration)) as unknown as number[]); });
        const r = readHand(rig, values); curls.push(r.curl); splays.push(r.splay); if (unposed(r)) open++;
      }
      curls.sort((a, b) => a - b); splays.sort((a, b) => a - b);
      return { side: rig.side, keyed: hand.tracks.filter(Boolean).length, curl: [curls[0], curls[(n - 1) >> 1], curls[n - 1]].map(x => +x.toFixed(1)), splay: [splays[(n - 1) >> 1], splays[n - 1]].map(x => +x.toFixed(1)), unposed: +(open / n).toFixed(2) };
    }) }));
  }
}
function held(track: THREE.KeyframeTrack) {
  const values = track.values;
  if (values.length !== track.times.length * 4) return track.times.length <= 1;
  for (let i = 4; i < values.length; i++) if (Math.abs(values[i] - values[i & 3]) > 1e-6) return false;
  return true;
}
export const unposed = (read: { curl: number; splay: number }) => read.curl < FLAT_BELOW || read.splay > FAN_ABOVE;
