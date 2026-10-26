import * as THREE from 'three';
import type {Fighter} from '../Fighter';

const SAMPLES = 10, STEPS = 4, POINTS = (SAMPLES - 1) * STEPS + 1;
const NEAR = 2.2, FLOOR = .5;
const HILT = .4, POINT = .9;
const EDGE = new THREE.Color(1, .93, .86), TAIL = new THREE.Color(.78, .05, .14);

class Ribbon {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly points: THREE.Vector3[] = [];
  private readonly inner: THREE.Vector3[] = [];
  private readonly centre: THREE.Vector3[] = [];
  private readonly axes: THREE.Vector3[] = [];
  private count = 0;
  private head = 0;
  private readonly position: THREE.BufferAttribute;
  private readonly color: THREE.BufferAttribute;
  private readonly c = new THREE.Color();
  private readonly p = new THREE.Vector3();
  private readonly q = new THREE.Vector3();
  private readonly o = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly pa = new THREE.Vector3();
  private readonly pb = new THREE.Vector3();
  private readonly x = new THREE.Vector3();
  private readonly turn = new THREE.Quaternion();

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < SAMPLES; i++) {
      this.points.push(new THREE.Vector3()); this.inner.push(new THREE.Vector3()); this.centre.push(new THREE.Vector3()); this.axes.push(new THREE.Vector3(0, 1, 0));
    }
    const geometry = new THREE.BufferGeometry();
    this.position = new THREE.BufferAttribute(new Float32Array(POINTS * 2 * 3), 3);
    this.color = new THREE.BufferAttribute(new Float32Array(POINTS * 2 * 4), 4);
    this.position.setUsage(THREE.DynamicDrawUsage); this.color.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('color', this.color);
    const index: number[] = [];
    for (let i = 0; i < POINTS - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      index.push(a, b, c, b, d, c);
    }
    geometry.setIndex(index);
    const material = new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false});
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'levi-blade-trail';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  push(point: THREE.Vector3, inner: THREE.Vector3, centre: THREE.Vector3, axis: THREE.Vector3) {
    this.head = (this.head + SAMPLES - 1) % SAMPLES;
    this.points[this.head].copy(point);
    this.inner[this.head].copy(inner);
    this.centre[this.head].copy(centre);
    this.axes[this.head].copy(axis);
    this.count = Math.min(SAMPLES, this.count + 1);
  }

  private between(a: THREE.Vector3, b: THREE.Vector3, ca: THREE.Vector3, cb: THREE.Vector3, na: THREE.Vector3, nb: THREE.Vector3, u: number, out: THREE.Vector3) {
    this.o.lerpVectors(ca, cb, u);
    this.n.lerpVectors(na, nb, u);
    if (this.n.lengthSq() < 1e-8) return out.lerpVectors(a, b, u);
    this.n.normalize();
    this.pa.subVectors(a, ca); const ha = this.pa.dot(this.n); this.pa.addScaledVector(this.n, -ha);
    this.pb.subVectors(b, cb); const hb = this.pb.dot(this.n); this.pb.addScaledVector(this.n, -hb);
    const ra = this.pa.length(), rb = this.pb.length();
    if (ra < 1e-4 || rb < 1e-4) return out.lerpVectors(a, b, u);
    const angle = Math.atan2(this.n.dot(this.x.crossVectors(this.pa, this.pb)), this.pa.dot(this.pb));
    this.turn.setFromAxisAngle(this.n, angle * u);
    return out.copy(this.pa).multiplyScalar((ra + (rb - ra) * u) / ra).applyQuaternion(this.turn)
      .add(this.o).addScaledVector(this.n, ha + (hb - ha) * u);
  }

  draw(strength: number, floor: number, lens?: THREE.Vector3) {
    const n = this.count;
    if (n < 2) { this.mesh.visible = false; return; }
    const pos = this.position.array as Float32Array, col = this.color.array as Float32Array;
    for (let i = 0; i < POINTS; i++) {
      const f = Math.min(i / STEPS, n - 1), j = Math.min(Math.floor(f), n - 2), u = f - j;
      const k0 = (this.head + j) % SAMPLES, k1 = (this.head + j + 1) % SAMPLES;
      this.between(this.points[k0], this.points[k1], this.centre[k0], this.centre[k1], this.axes[k0], this.axes[k1], u, this.p);
      this.between(this.inner[k0], this.inner[k1], this.centre[k0], this.centre[k1], this.axes[k0], this.axes[k1], u, this.q);
      pos[i * 6] = this.p.x; pos[i * 6 + 1] = this.p.y; pos[i * 6 + 2] = this.p.z;
      pos[i * 6 + 3] = this.q.x; pos[i * 6 + 4] = this.q.y; pos[i * 6 + 5] = this.q.z;
      const age = f / (SAMPLES - 1);
      this.c.copy(EDGE).lerp(TAIL, Math.min(1, age * 4));
      const near = lens ? THREE.MathUtils.clamp(this.p.distanceTo(lens) / NEAR, 0, 1) : 1;
      const low = THREE.MathUtils.smoothstep(Math.min(this.p.y, this.q.y) - floor, .1, FLOOR);
      const alpha = i / STEPS <= n - 1 ? strength * Math.pow(1 - age, 1.4) * near * near * low : 0;
      col[i * 8] = col[i * 8 + 4] = this.c.r; col[i * 8 + 1] = col[i * 8 + 5] = this.c.g; col[i * 8 + 2] = col[i * 8 + 6] = this.c.b;
      col[i * 8 + 3] = alpha * .9; col[i * 8 + 7] = 0;
    }
    this.position.needsUpdate = true;
    this.color.needsUpdate = true;
    this.mesh.visible = true;
  }

  clear() { this.count = 0; this.mesh.visible = false; }

  dispose(scene: THREE.Scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

export class BladeWhirl {
  private ribbons: Ribbon[];
  private readonly dir = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly inner = new THREE.Vector3();
  private readonly elbow = new THREE.Vector3();
  private readonly centre = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private readonly top = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene) {
    this.ribbons = [new Ribbon(scene), new Ribbon(scene)];
  }

  update(actor: Fighter, strength: number, lens?: THREE.Vector3) {
    if (strength < .02) { this.hide(); return; }
    const hips = actor.bones.get('hips'), head = actor.bones.get('head');
    if (hips) hips.getWorldPosition(this.centre); else this.centre.copy(actor.group.position);
    if (head) this.axis.subVectors(head.getWorldPosition(this.top), this.centre); else this.axis.set(0, 1, 0);
    if (this.axis.lengthSq() < 1e-6) this.axis.set(0, 1, 0);
    this.axis.normalize();
    const sides = [['leftforearm', actor.handL], ['rightforearm', actor.handR]] as const;
    sides.forEach(([forearm, hand], i) => {
      const bone = actor.bones.get(forearm);
      if (!bone) return;
      bone.getWorldPosition(this.elbow);
      this.dir.subVectors(hand, this.elbow);
      if (this.dir.lengthSq() < 1e-6) return;
      this.dir.normalize();
      this.point.copy(hand).addScaledVector(this.dir, POINT);
      this.inner.copy(hand).addScaledVector(this.dir, HILT);
      this.ribbons[i].push(this.point, this.inner, this.centre, this.axis);
      this.ribbons[i].draw(strength, actor.group.position.y, lens);
    });
  }

  hide() { for (const ribbon of this.ribbons) ribbon.clear(); }

  dispose() { for (const ribbon of this.ribbons) ribbon.dispose(this.scene); }
}
