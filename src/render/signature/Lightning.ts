import * as THREE from 'three';
import { BoltBatch } from './BoltBatch';

export interface BoltStyle {
  width: number;
  color: THREE.Color;
  intensity?: number;
  levels?: number;
  jag?: number;
  branches?: number;
  branchLength?: number;
  taper?: number;
  core?: number;
}
const MAX_LEVELS = 5, MAX_POINTS = (1 << MAX_LEVELS) + 1;

export class Rng {
  private s = 1;
  seed(n: number) { this.s = (Math.floor(n) * 2654435761) >>> 0 || 1; return this; }
  next() { let t = (this.s = (this.s + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  signed() { return this.next() * 2 - 1; }
}

interface Spark { p: THREE.Vector3; v: THREE.Vector3; age: number; life: number; width: number; bright: number }

export class LightningPainter {
  readonly rng = new Rng();
  private pts = new Float32Array(MAX_POINTS * 3);
  private tmp = new Float32Array(MAX_POINTS * 3);
  private sub = new Float32Array(MAX_POINTS * 3);
  private axis = new THREE.Vector3(); private u = new THREE.Vector3(); private v = new THREE.Vector3();
  private p = new THREE.Vector3(); private q = new THREE.Vector3(); private r = new THREE.Vector3();
  private a0 = new THREE.Vector3(); private b0 = new THREE.Vector3(); private d = new THREE.Vector3();
  private branchColor = new THREE.Color();
  private sparks: Spark[] = [];
  private sparkNext = 0;
  private sparkColor = new THREE.Color();
  constructor(readonly batch: BoltBatch, sparkCapacity = 96) {
    for (let i = 0; i < sparkCapacity; i++) this.sparks.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 1, life: 0, width: 0, bright: 0 });
  }
  private basis(axis: THREE.Vector3) {
    const len = axis.length();
    if (len < 1e-6) { this.u.set(1, 0, 0); this.v.set(0, 0, 1); return; }
    this.axis.copy(axis).multiplyScalar(1 / len);
    if (Math.abs(this.axis.y) < .9) this.u.set(0, 1, 0); else this.u.set(1, 0, 0);
    this.u.crossVectors(this.axis, this.u).normalize(); this.v.crossVectors(this.axis, this.u);
  }
  private displace(a: THREE.Vector3, b: THREE.Vector3, levels: number, jag: number, out: Float32Array) {
    this.a0.copy(a); this.b0.copy(b);
    this.d.subVectors(this.b0, this.a0); const length = this.d.length(); this.basis(this.d);
    out[0] = this.a0.x; out[1] = this.a0.y; out[2] = this.a0.z; out[3] = this.b0.x; out[4] = this.b0.y; out[5] = this.b0.z;
    let n = 2, amp = jag * length;
    for (let l = 0; l < levels; l++) {
      const t = this.tmp;
      for (let i = 0; i < n - 1; i++) {
        const o = i * 3, w = i * 6;
        t[w] = out[o]; t[w + 1] = out[o + 1]; t[w + 2] = out[o + 2];
        const angle = this.rng.next() * Math.PI * 2, kick = this.rng.signed() * amp * .5;
        const cu = Math.cos(angle) * kick, cv = Math.sin(angle) * kick;
        t[w + 3] = (out[o] + out[o + 3]) * .5 + this.u.x * cu + this.v.x * cv;
        t[w + 4] = (out[o + 1] + out[o + 4]) * .5 + this.u.y * cu + this.v.y * cv;
        t[w + 5] = (out[o + 2] + out[o + 5]) * .5 + this.u.z * cu + this.v.z * cv;
      }
      const last = (n - 1) * 3, w = (n - 1) * 6;
      t[w] = out[last]; t[w + 1] = out[last + 1]; t[w + 2] = out[last + 2];
      n = n * 2 - 1; for (let i = 0; i < n * 3; i++) out[i] = t[i]; amp *= .55;
    }
    return n;
  }
  private stroke(points: Float32Array, n: number, width: number, taper: number, color: THREE.Color, intensity: number, core: number) {
    for (let i = 0; i < n - 1; i++) {
      const t = i / Math.max(1, n - 2), o = i * 3;
      this.p.set(points[o], points[o + 1], points[o + 2]); this.q.set(points[o + 3], points[o + 4], points[o + 5]);
      this.batch.segment(this.p, this.q, width * (1 - (1 - taper) * t), color, intensity, core);
    }
  }
  bolt(a: THREE.Vector3, b: THREE.Vector3, seed: number, style: BoltStyle) {
    const levels = Math.min(MAX_LEVELS, style.levels ?? 3), jag = style.jag ?? .22, intensity = style.intensity ?? 1, taper = style.taper ?? .45, core = style.core ?? .32;
    this.rng.seed(seed);
    const n = this.displace(a, b, levels, jag, this.pts);
    this.stroke(this.pts, n, style.width, taper, style.color, intensity, core);
    const branches = style.branches ?? 0;
    if (!branches) return;
    const total = a.distanceTo(b), share = style.branchLength ?? .45;
    this.branchColor.copy(style.color);
    for (let k = 0; k < branches; k++) {
      const j = 1 + Math.floor(this.rng.next() * (n - 2)), o = j * 3, t = j / (n - 1);
      this.p.set(this.pts[o], this.pts[o + 1], this.pts[o + 2]);
      this.q.set(this.pts[o + 3] - this.pts[o], this.pts[o + 4] - this.pts[o + 1], this.pts[o + 5] - this.pts[o + 2]).normalize();
      this.r.set(this.rng.signed(), this.rng.signed(), this.rng.signed()).multiplyScalar(.9);
      this.q.add(this.r).normalize().multiplyScalar(total * share * (.45 + .55 * this.rng.next()) * (1 - t * .6));
      this.r.copy(this.p).add(this.q);
      const m = this.displace(this.p, this.r, Math.max(1, levels - 1), jag * 1.2, this.sub);
      this.stroke(this.sub, m, style.width * (1 - (1 - taper) * t) * .55, taper, this.branchColor, intensity * .8, core);
    }
  }
  burst(center: THREE.Vector3, reach: number, rays: number, tick: number, salt: number, style: BoltStyle, lift = 0) {
    for (let i = 0; i < rays; i++) {
      this.rng.seed(tick * 131 + i * 977 + salt * 7919);
      if (this.rng.next() < .18) continue;
      const z = this.rng.signed(), phi = this.rng.next() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      this.p.set(Math.cos(phi) * s, z + lift, Math.sin(phi) * s).normalize().multiplyScalar(reach * (.45 + .55 * this.rng.next()));
      this.r.copy(center).add(this.p);
      this.bolt(center, this.r, tick * 71 + i * 13 + salt, style);
    }
  }
  emit(from: THREE.Vector3, count: number, speed: number, seed: number, width = .012, up = .6, bright = 1) {
    this.rng.seed(seed);
    for (let i = 0; i < count; i++) {
      const s = this.sparks[this.sparkNext]; this.sparkNext = (this.sparkNext + 1) % this.sparks.length;
      s.p.copy(from);
      s.v.set(this.rng.signed(), this.rng.signed() * .6 + up, this.rng.signed()).normalize().multiplyScalar(speed * (.45 + .55 * this.rng.next()));
      s.age = 0; s.life = .18 + .3 * this.rng.next(); s.width = width * (.6 + .6 * this.rng.next()); s.bright = bright;
    }
  }
  sparksUpdate(dt: number, color: THREE.Color, gravity = 9) {
    for (const s of this.sparks) {
      if (s.age >= s.life) continue;
      s.age += dt; if (s.age >= s.life) continue;
      s.v.y -= gravity * dt; s.v.multiplyScalar(1 - Math.min(.5, dt * 2.2)); s.p.addScaledVector(s.v, dt);
      const fade = 1 - s.age / s.life;
      this.q.copy(s.p).addScaledVector(s.v, -.028);
      this.sparkColor.copy(color);
      this.batch.segment(s.p, this.q, s.width * (.5 + .5 * fade), this.sparkColor, s.bright * fade, .55);
    }
  }
  clearSparks() { for (const s of this.sparks) s.age = s.life = 0; }
}
