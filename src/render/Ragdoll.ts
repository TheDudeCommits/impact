import type RAPIER_NS from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

let RAPIER: typeof RAPIER_NS | undefined;


const SEGMENTS: [string, string, number][] = [
  ['Hips', 'Spine', .42],
  ['Spine', 'Neck', .36],
  ['Neck', 'Head', .5],
  ['LeftArm', 'LeftForeArm', .22], ['LeftForeArm', 'LeftHand', .2],
  ['RightArm', 'RightForeArm', .22], ['RightForeArm', 'RightHand', .2],
  ['LeftUpLeg', 'LeftLeg', .26], ['LeftLeg', 'LeftFoot', .22],
  ['RightUpLeg', 'RightLeg', .26], ['RightLeg', 'RightFoot', .22],
];
const ATTACH: [number, number][] = [
  [0, 1], [1, 2],
  [1, 3], [3, 4], [1, 5], [5, 6],
  [0, 7], [7, 8], [0, 9], [9, 10],
];
const MASS = [12, 12, 4, 2.5, 1.5, 2.5, 1.5, 5, 3, 5, 3];
const SPRING = 20, SPRING_DAMPING = 8;
const SPRING_TORQUE = 3;
const SKULL = .12;
const FLESH = 0x0001_0002, FLOOR = 0x0002_0001;

let ready = false;
let starting: Promise<void> | undefined;
export function prepareRagdolls() {
  return (starting ??= import('../game/rapierCollision').then(async ({ initRapier }) => {
    RAPIER = await initRapier() as unknown as typeof RAPIER_NS;
    ready = true;
  }));
}
export function ragdollsReady() { return ready; }

type Part = { body: RAPIER_NS.RigidBody; bone: THREE.Bone; child: THREE.Bone;
  offset: THREE.Quaternion;
  origin: THREE.Vector3;
  tail: THREE.Vector3 };

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _mid = new THREE.Vector3();
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _dir = new THREE.Vector3();
const _parent = new THREE.Quaternion(), _scale = new THREE.Vector3(), _pos = new THREE.Vector3();

export class Ragdoll {
  private world: RAPIER_NS.World;
  private parts: Part[] = [];
  private linked = new Set<number>();
  weight = 0;

  constructor(joints: Map<string, THREE.Bone>, velocity: THREE.Vector3, floor: number) {
    const R = RAPIER!;
    this.world = new R.World({ x: 0, y: -23, z: 0 });
    this.world.numSolverIterations = 8;
    this.world.createCollider(R.ColliderDesc.cuboid(60, .5, 60).setTranslation(0, floor - .5, 0)
      .setCollisionGroups(FLOOR));
    const alias = new Map<string, string>();
    const hips = joints.get('Hips'), spine = joints.get('Spine');
    if (hips && spine) {
      hips.getWorldPosition(_a); spine.getWorldPosition(_b);
      if (_a.distanceTo(_b) < .02) {
        for (const next of ['Spine1', 'Spine2', 'Neck']) {
          const node = joints.get(next);
          if (!node) continue;
          node.getWorldPosition(_b);
          if (_a.distanceTo(_b) >= .02) { alias.set('Spine', next); break; }
        }
      }
    }
    const named = (name: string) => joints.get(alias.get(name) ?? name);
    const made = new Map<number, RAPIER_NS.RigidBody>();
    for (let i = 0; i < SEGMENTS.length; i++) {
      const [from, to, thickness] = SEGMENTS[i];
      const bone = named(from), child = named(to);
      if (!bone || !child) continue;
      bone.getWorldPosition(_a); child.getWorldPosition(_b);
      if (_a.distanceTo(_b) < .02) continue;
      if (to === 'Head') _b.addScaledVector(_dir.copy(_b).sub(_a).normalize(), SKULL);
      const length = _a.distanceTo(_b);
      _mid.copy(_a).add(_b).multiplyScalar(.5);
      _dir.copy(_b).sub(_a).normalize();
      _q.setFromUnitVectors(_up, _dir);
      const body = this.world.createRigidBody(R.RigidBodyDesc.dynamic()
        .setTranslation(_mid.x, _mid.y, _mid.z)
        .setLinvel(velocity.x, velocity.y, velocity.z)
        .setLinearDamping(.3).setAngularDamping(3));
      const radius = Math.max(.035, length * thickness * .5);
      this.world.createCollider(
        R.ColliderDesc.capsule(Math.max(.01, length / 2 - radius), radius)
          .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
          .setMass(MASS[i]).setFriction(.9).setRestitution(.02).setCollisionGroups(FLESH), body);
      made.set(i, body);
      const offset = bone.getWorldQuaternion(new THREE.Quaternion());
      this.parts.push({ body, bone, child, offset, origin: _a.clone(), tail: _a.clone().sub(_mid) });
    }
    for (const [a, b] of ATTACH) {
      const first = made.get(a), second = made.get(b);
      if (!first || !second) continue;
      const parent = this.parts.find(p => p.body === first)!;
      const childPart = this.parts.find(p => p.body === second)!;
      const t = first.translation(), r = first.rotation();
      _a.copy(childPart.origin).sub(_b.set(t.x, t.y, t.z))
        .applyQuaternion(_q.set(r.x, r.y, r.z, r.w).invert());
      const joint = this.world.createImpulseJoint(
        R.JointData.spherical({ x: _a.x, y: _a.y, z: _a.z }, childPart.tail),
        first, second, true);
      const spherical = R.SphericalImpulseJoint.prototype;
      for (const axis of [R.JointAxis.AngX, R.JointAxis.AngY, R.JointAxis.AngZ]) {
        spherical.configureMotorModel.call(joint, axis, R.MotorModel.AccelerationBased);
        spherical.configureMotorPosition.call(joint, axis, 0, SPRING, SPRING_DAMPING);
        spherical.setMotorMaxForce.call(joint, axis, SPRING_TORQUE * MASS[b]);
      }
      this.linked.add(a); this.linked.add(b);
    }
  }

  get built() {
    if (this.parts.length !== SEGMENTS.length) return false;
    for (let i = 0; i < SEGMENTS.length; i++) if (!this.linked.has(i)) return false;
    return true;
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.world.timestep = Math.min(dt, 1 / 30);
    this.world.step();
    for (const part of this.parts) {
      const r = part.body.rotation();
      _q.set(r.x, r.y, r.z, r.w);
      const bone = part.bone;
      const parent = bone.parent;
      if (!parent) continue;
      parent.updateWorldMatrix(true, false);
      parent.matrixWorld.decompose(_pos, _parent, _scale);
      bone.quaternion.copy(_parent.invert().multiply(_q.multiply(part.offset)));
      const t = part.body.translation();
      _a.copy(part.tail).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_b.set(t.x, t.y, t.z));
      bone.position.copy(parent.worldToLocal(_a));
    }
  }

  restless() {
    let spin = 0;
    for (const part of this.parts) {
      const w = part.body.angvel();
      spin = Math.max(spin, Math.hypot(w.x, w.y, w.z));
    }
    return spin;
  }

  dispose() { this.world.free(); this.parts.length = 0; this.linked.clear(); }
}
