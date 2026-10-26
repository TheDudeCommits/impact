import * as THREE from 'three';
import type {Fighter} from '../Fighter';

const CROWS = 64;
const FEATHERS = 120;
const BURST = 16;
const GATHER = 22;
const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1);
export const CROW_GATHER = .14;
const JOINTS = ['head', 'neck', 'spine2', 'spine1', 'spine', 'hips', 'leftarm', 'rightarm', 'leftforearm', 'rightforearm',
  'lefthand', 'righthand', 'leftupleg', 'rightupleg', 'leftleg', 'rightleg'];

interface Crow {
  active: boolean; born: number; life: number;
  p: THREE.Vector3; v: THREE.Vector3; turn: number; flap: number; phase: number; size: number;
  into?: Fighter; joint?: string; from?: THREE.Vector3;
}
interface Feather { active: boolean; born: number; life: number; p: THREE.Vector3; v: THREE.Vector3; axis: THREE.Vector3; spin: number }

function crowBody() {
  const p = [
    0, .01, .22, 0, .055, .03, -.05, 0, .03, 0, -.045, .03, .05, 0, .03, 0, .01, -.13,
    -.085, 0, -.3, .085, 0, -.3, 0, 0, -.25, 0, .01, -.1,
  ];
  const index = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 5, 2, 1, 5, 3, 2, 5, 4, 3, 5, 1, 4, 9, 6, 8, 9, 8, 7];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(index);
  return g;
}

function crowWing() {
  const outline = [
    [0, .05], [.12, .085], [.26, .055], [.36, .01], [.44, -.035], [.4, -.075], [.37, -.06], [.36, -.11], [.32, -.085],
    [.29, -.13], [.24, -.1], [.19, -.14], [.12, -.11], [0, -.075],
  ];
  const p = [0, 0, -.01];
  for (const [x, z] of outline) p.push(x, 0, z);
  const index: number[] = [];
  for (let i = 1; i < outline.length; i++) index.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(index);
  return g;
}

function crowEyes() {
  const p = [-.027, .03, .15, -.027, .055, .17, -.027, .03, .19, .027, .03, .15, .027, .055, .17, .027, .03, .19];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex([0, 1, 2, 3, 5, 4]);
  return g;
}

function feather() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .07, -.018, 0, 0, 0, 0, -.06, .018, 0, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export class CrowFlock {
  private crows: Crow[] = [];
  private feathers: Feather[] = [];
  private bodies: THREE.InstancedMesh;
  private wings: THREE.InstancedMesh;
  private eyes: THREE.InstancedMesh;
  private plumes: THREE.InstancedMesh;
  private materials: THREE.Material[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly w = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly t = new THREE.Vector3();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly mirror = new THREE.Matrix4().makeScale(-1, 1, 1);
  private readonly hinge = new THREE.Matrix4();
  private readonly toLens = new THREE.Vector3();
  private readonly heading = new THREE.Vector3();
  private readonly back = new THREE.Vector3();
  private readonly across = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly roll = new THREE.Quaternion();
  private seed = 1;

  constructor(private readonly scene: THREE.Scene, eye: THREE.Color) {
    const black = new THREE.MeshBasicMaterial({color: 0x0b0a10, side: THREE.DoubleSide});
    const lit = new THREE.MeshBasicMaterial({color: eye, side: THREE.DoubleSide, toneMapped: false});
    this.materials.push(black, lit);
    const make = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number, name: string) => {
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.name = name; mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = false; mesh.visible = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
      return mesh;
    };
    this.bodies = make(crowBody(), black, CROWS, 'itachi-crows');
    this.wings = make(crowWing(), black, CROWS * 2, 'itachi-crow-wings');
    this.eyes = make(crowEyes(), lit, CROWS, 'itachi-crow-eyes');
    this.plumes = make(feather(), black, FEATHERS, 'itachi-crow-feathers');
    for (let i = 0; i < CROWS; i++) this.crows.push({active: false, born: 0, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), turn: 0, flap: 0, phase: 0, size: 1});
    for (let i = 0; i < FEATHERS; i++) this.feathers.push({active: false, born: 0, life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), axis: new THREE.Vector3(), spin: 0});
  }

  private rand() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed % 100000) / 100000; }
  private crow() { return this.crows.find(c => !c.active) ?? this.crows.reduce((a, b) => a.born <= b.born ? a : b); }

  private joint(actor: Fighter, name: string | undefined, out: THREE.Vector3) {
    const bone = name ? actor.bones.get(name) : undefined;
    if (bone) return bone.getWorldPosition(out);
    return out.copy(actor.group.position).setY(actor.group.position.y + 1.1);
  }

  burst(actor: Fighter, time: number, count = BURST) {
    actor.group.updateMatrixWorld(true);
    const points = JOINTS.map(name => this.joint(actor, name, new THREE.Vector3()));
    this.burstFrom(points, this.joint(actor, 'spine2', new THREE.Vector3()), time, count);
  }

  burstFrom(points: readonly THREE.Vector3[], chest: THREE.Vector3, time: number, count = BURST, aim?: THREE.Vector3, over = .14) {
    this.seed = (Math.floor(time * 1000) % 9973) + 7;
    for (let i = 0; i < count; i++) {
      const c = this.crow();
      c.p.copy(points[i % points.length]);
      c.p.x += (this.rand() - .5) * .3; c.p.y += (this.rand() - .5) * .3; c.p.z += (this.rand() - .5) * .3;
      const out = this.v.copy(c.p).sub(chest).setY(0);
      if (aim && i % 3 === 0) {
        out.copy(aim).sub(c.p).setY(0);
        if (out.lengthSq() > 1e-4) {
          out.normalize();
          const side = (i / 3) % 2 ? .75 : -.75;
          out.set(out.x - out.z * side, 0, out.z + out.x * side);
        }
      }
      if (out.lengthSq() < 1e-4) out.set(this.rand() - .5, 0, this.rand() - .5);
      out.normalize();
      const speed = 3.4 + this.rand() * 3.2;
      c.v.set(out.x * speed, (aim && i % 3 === 0 ? 1.2 : 2.6) + this.rand() * 2.4, out.z * speed);
      c.turn = (this.rand() - .5) * 3;
      c.flap = Math.PI * 2 * (4.5 + this.rand() * 2);
      c.phase = this.rand() * Math.PI * 2;
      c.size = 1 + this.rand() * .45;
      c.born = time + i / count * over + this.rand() * .02; c.life = .45 + this.rand() * .3;
      c.into = undefined; c.joint = undefined;
      c.active = true;
    }
  }

  gather(actor: Fighter, time: number, avoid?: THREE.Vector3, arrive?: (joint: string) => number) {
    this.seed = (Math.floor(time * 1000) % 9973) + 11;
    actor.group.updateMatrixWorld(true);
    const centre = this.joint(actor, 'spine2', new THREE.Vector3());
    const toward = avoid ? Math.atan2(avoid.x - centre.x, avoid.z - centre.z) : NaN;
    for (let i = 0; i < GATHER; i++) {
      const c = this.crow();
      const angle = Number.isFinite(toward) ? toward + Math.PI * (.35 + this.rand() * 1.3) : this.rand() * Math.PI * 2;
      const out = 1.1 + this.rand() * .9;
      c.p.set(centre.x + Math.sin(angle) * out, centre.y - .5 + this.rand() * 1.6, centre.z + Math.cos(angle) * out);
      c.from = (c.from ?? new THREE.Vector3()).copy(c.p);
      c.into = actor; c.joint = JOINTS[i % JOINTS.length];
      c.flap = Math.PI * 2 * (6 + this.rand() * 2);
      c.phase = this.rand() * Math.PI * 2;
      c.size = .8 + this.rand() * .35;
      if (arrive) { c.born = time; c.life = Math.max(.04, arrive(c.joint) + this.rand() * .015); }
      else { c.born = time - this.rand() * .03; c.life = CROW_GATHER + this.rand() * .03; }
      c.turn = 0;
      c.active = true;
    }
  }

  private shed(at: THREE.Vector3, time: number, n: number) {
    for (let i = 0; i < n; i++) {
      const f = this.feathers.find(x => !x.active) ?? this.feathers.reduce((a, b) => a.born <= b.born ? a : b);
      f.p.copy(at); f.p.x += (this.rand() - .5) * .2; f.p.y += (this.rand() - .5) * .2; f.p.z += (this.rand() - .5) * .2;
      f.v.set((this.rand() - .5) * 1.2, .2 + this.rand() * .6, (this.rand() - .5) * 1.2);
      f.axis.set(this.rand() - .5, this.rand() - .5, this.rand() - .5).normalize();
      f.spin = (this.rand() - .5) * 18;
      f.born = time; f.life = .7 + this.rand() * .5; f.active = true;
    }
  }

  update(time: number, dt: number, lens?: THREE.Vector3) {
    if (!this.bodies.visible && !this.plumes.visible && !this.crows.some(c => c.active) && !this.feathers.some(f => f.active)) return;
    let birds = 0, wings = 0;
    for (const c of this.crows) {
      if (!c.active) continue;
      const age = time - c.born;
      if (age < 0) continue;
      let grow: number;
      if (c.into) {
        const u = Math.min(1, age / c.life);
        this.joint(c.into, c.joint, this.t);
        const k = u * u;
        this.v.copy(c.p);
        c.p.lerpVectors(c.from!, this.t, k);
        c.p.y += Math.sin(u * Math.PI) * .25;
        const swirl = (1 - k) * .9, ox = c.p.x - this.t.x, oz = c.p.z - this.t.z;
        c.p.x = this.t.x + ox * Math.cos(swirl) - oz * Math.sin(swirl);
        c.p.z = this.t.z + ox * Math.sin(swirl) + oz * Math.cos(swirl);
        this.v.subVectors(c.p, this.v);
        if (this.v.lengthSq() < 1e-8) this.v.subVectors(this.t, c.from!);
        grow = 1 - THREE.MathUtils.smoothstep(u, .55, 1);
        if (u >= 1) { this.shed(this.t, time, 1); c.active = false; continue; }
      } else {
        if (age > c.life) { this.shed(c.p, time, 3); c.active = false; continue; }
        const yaw = c.turn * dt;
        const x = c.v.x * Math.cos(yaw) - c.v.z * Math.sin(yaw), z = c.v.x * Math.sin(yaw) + c.v.z * Math.cos(yaw);
        c.v.x = x; c.v.z = z; c.v.y -= 1.2 * dt;
        c.p.addScaledVector(c.v, dt);
        this.v.copy(c.v);
        grow = THREE.MathUtils.smoothstep(age, 0, .08) * (1 - THREE.MathUtils.smoothstep(age, c.life - .18, c.life));
      }
      if (lens) {
        this.toLens.copy(lens).sub(c.p).normalize();
        this.heading.copy(this.v);
        if (this.heading.lengthSq() < 1e-8) this.heading.set(0, 0, 1);
        this.heading.normalize();
        this.heading.addScaledVector(this.toLens, -this.heading.dot(this.toLens) * .75);
        if (this.heading.lengthSq() < 1e-6) this.heading.set(this.toLens.z, 0, -this.toLens.x);
        this.heading.normalize();
        this.back.copy(this.toLens).multiplyScalar(.8).add(UP);
        this.back.addScaledVector(this.heading, -this.back.dot(this.heading));
        if (this.back.lengthSq() < 1e-6) this.back.copy(UP).addScaledVector(this.heading, -this.heading.y);
        this.back.normalize();
        this.across.crossVectors(this.back, this.heading);
        this.basis.makeBasis(this.across, this.back, this.heading);
        this.q.setFromRotationMatrix(this.basis).multiply(this.roll.setFromAxisAngle(FORWARD, -c.turn * .15));
      } else {
        const flat = Math.hypot(this.v.x, this.v.z);
        this.e.set(-Math.atan2(this.v.y, Math.max(1e-4, flat)) * .8, Math.atan2(this.v.x, this.v.z), -c.turn * .15);
        this.q.setFromEuler(this.e);
      }
      const seen = lens ? c.p.distanceTo(lens) : Infinity;
      const near = lens ? THREE.MathUtils.clamp(seen / 4, .25, 1) * THREE.MathUtils.smoothstep(seen, 1.5, 2.4) : 1;
      const size = c.size * near * Math.max(.001, grow);
      this.s.setScalar(size);
      this.m.compose(c.p, this.q, this.s);
      this.bodies.setMatrixAt(birds, this.m);
      this.eyes.setMatrixAt(birds, this.m);
      birds++;
      const beat = Math.sin(age * c.flap + c.phase) * .95 + .12;
      for (const side of [1, -1]) {
        this.w.makeTranslation(side * .035, .012, .02).multiply(this.hinge.makeRotationZ(side * beat));
        if (side < 0) this.w.multiply(this.mirror);
        this.wings.setMatrixAt(wings++, this.hinge.multiplyMatrices(this.m, this.w));
      }
    }
    this.bodies.count = birds; this.eyes.count = birds; this.wings.count = wings;
    this.bodies.instanceMatrix.needsUpdate = this.eyes.instanceMatrix.needsUpdate = this.wings.instanceMatrix.needsUpdate = true;
    let plumes = 0;
    for (const f of this.feathers) {
      if (!f.active) continue;
      const age = time - f.born;
      if (age > f.life) { f.active = false; continue; }
      f.v.y -= 1.6 * dt; f.v.multiplyScalar(Math.exp(-3 * dt));
      f.p.addScaledVector(f.v, dt);
      f.p.x += Math.sin(age * 9 + f.spin) * .2 * dt;
      this.q.setFromAxisAngle(f.axis, f.spin * age);
      this.s.setScalar(1.4 * (1 - THREE.MathUtils.smoothstep(age, f.life * .6, f.life)));
      this.m.compose(f.p, this.q, this.s);
      this.plumes.setMatrixAt(plumes++, this.m);
    }
    this.plumes.count = plumes;
    this.plumes.instanceMatrix.needsUpdate = true;
    this.bodies.visible = this.eyes.visible = this.wings.visible = birds > 0; this.plumes.visible = plumes > 0;
  }

  reset() {
    for (const c of this.crows) { c.active = false; c.into = undefined; }
    for (const f of this.feathers) f.active = false;
    this.bodies.count = this.wings.count = this.eyes.count = this.plumes.count = 0;
    this.bodies.visible = this.wings.visible = this.eyes.visible = this.plumes.visible = false;
  }

  dispose() {
    for (const mesh of [this.bodies, this.wings, this.eyes, this.plumes]) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    for (const material of this.materials) material.dispose();
  }
}

