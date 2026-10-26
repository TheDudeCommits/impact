import * as THREE from 'three';
import { BONE, BONES } from './motion';
import { GROUP, GruntKit, type V3 } from './kit';

const PARENT: number[] = (() => {
  const p = new Array<number>(BONES.length).fill(-1);
  const chain = (...names: (typeof BONES)[number][]) => { for (let i = 1; i < names.length; i++) p[BONE[names[i]]] = BONE[names[i - 1]]; };
  chain('Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end');
  p[BONE.headfront] = BONE.Head;
  chain('Spine', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand');
  chain('Spine', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand');
  chain('Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase');
  chain('Hips', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase');
  return p;
})();
const neighbours = (a: number, b: number) => a === b || PARENT[a] === b || PARENT[b] === a;

const enum Kind { Cone, Ellipsoid, Box, Torus }
interface Prim {
  kind: Kind;
  ax: number; ay: number; az: number; bx: number; by: number; bz: number; ra: number; rb: number;
  rx: number; ry: number; rz: number; round: number; m: Float32Array;
  l2: number; rr: number; a2: number; il2: number;
  soft: number; cut: boolean;
  bone: number; group: number; color: THREE.Color; glow: number; head: number;
  min: [number, number, number]; max: [number, number, number];
}

function coneDistance(p: Prim, x: number, y: number, z: number) {
  const bax = p.bx - p.ax, bay = p.by - p.ay, baz = p.bz - p.az;
  const pax = x - p.ax, pay = y - p.ay, paz = z - p.az;
  const l2 = p.l2, rr = p.rr, a2 = p.a2, il2 = p.il2;
  const yy = pax * bax + pay * bay + paz * baz;
  const zz = yy - l2;
  const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yy * yy * l2, z2 = zz * zz * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - p.rb;
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - p.ra;
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - p.ra;
}

function distance(p: Prim, x: number, y: number, z: number): number {
  if (p.kind === Kind.Cone) return coneDistance(p, x, y, z);
  const m = p.m, dx = x - p.ax, dy = y - p.ay, dz = z - p.az;
  const lx = m[0] * dx + m[1] * dy + m[2] * dz, ly = m[3] * dx + m[4] * dy + m[5] * dz, lz = m[6] * dx + m[7] * dy + m[8] * dz;
  if (p.kind === Kind.Ellipsoid) {
    const k0 = Math.hypot(lx / p.rx, ly / p.ry, lz / p.rz), k1 = Math.hypot(lx / (p.rx * p.rx), ly / (p.ry * p.ry), lz / (p.rz * p.rz));
    return k1 < 1e-9 ? -Math.min(p.rx, p.ry, p.rz) : k0 * (k0 - 1) / k1;
  }
  if (p.kind === Kind.Box) {
    const qx = Math.abs(lx) - p.rx + p.round, qy = Math.abs(ly) - p.ry + p.round, qz = Math.abs(lz) - p.rz + p.round;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - p.round;
  }
  const q = Math.hypot(lx, lz) - p.rx;
  return Math.hypot(q, ly) - p.ry;
}

function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise3(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx), fy),
    l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}

const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; };
const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

const _e = new THREE.Euler(), _mat = new THREE.Matrix4(), _c = new THREE.Color();

export interface FleshOptions {
  cell?: number;
  occlusion?: number;
}

export class Flesh {
  private readonly prims: Prim[] = [];
  private curBone = 0; private curGroup = 0; private curGlow = 0; private curHead = 0; private curSoft = .03; private carving = false;
  private readonly curColor = new THREE.Color(1, 1, 1);
  readonly kit: GruntKit;

  constructor(readonly rest: readonly THREE.Vector3[]) { this.kit = new GruntKit(rest); }

  at(bone: number, dx = 0, dy = 0, dz = 0): V3 { const p = this.rest[bone]; return [p.x + dx, p.y + dy, p.z + dz]; }
  between(a: number, b: number, t: number, dx = 0, dy = 0, dz = 0): V3 {
    const p = this.rest[a], q = this.rest[b];
    return [p.x + (q.x - p.x) * t + dx, p.y + (q.y - p.y) * t + dy, p.z + (q.z - p.z) * t + dz];
  }
  on(bone: number, group: number = GROUP.BODY) { this.curBone = bone; this.curGroup = group; this.curHead = 0; return this; }
  head(weight = 1) { this.curHead = weight; return this; }
  color(hex: number | THREE.Color) { if (typeof hex === 'number') this.curColor.setHex(hex); else this.curColor.copy(hex); return this; }
  glow(value: number) { this.curGlow = value; return this; }
  soft(k: number) { this.curSoft = Math.max(.002, k); return this; }
  carve() { this.carving = true; return this; }

  private push(prim: Omit<Prim, 'soft' | 'cut' | 'bone' | 'group' | 'color' | 'glow' | 'head' | 'min' | 'max'>, reach: number) {
    const cut = this.carving; this.carving = false;
    const pad = reach + this.curSoft;
    let min: [number, number, number], max: [number, number, number];
    if (prim.kind === Kind.Cone) {
      min = [Math.min(prim.ax - prim.ra, prim.bx - prim.rb) - pad, Math.min(prim.ay - prim.ra, prim.by - prim.rb) - pad, Math.min(prim.az - prim.ra, prim.bz - prim.rb) - pad];
      max = [Math.max(prim.ax + prim.ra, prim.bx + prim.rb) + pad, Math.max(prim.ay + prim.ra, prim.by + prim.rb) + pad, Math.max(prim.az + prim.ra, prim.bz + prim.rb) + pad];
    } else {
      const r = reach + pad;
      min = [prim.ax - r, prim.ay - r, prim.az - r]; max = [prim.ax + r, prim.ay + r, prim.az + r];
    }
    this.prims.push({ ...prim, soft: this.curSoft, cut, bone: this.curBone, group: this.curGroup, color: this.curColor.clone(), glow: this.curGlow, head: this.curHead, min, max });
    return this;
  }
  private rotation(yaw: number, pitch: number, roll: number) {
    _mat.makeRotationFromEuler(_e.set(pitch, yaw, roll, 'YXZ')).transpose();
    const e = _mat.elements;
    return new Float32Array([e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]]);
  }
  private static readonly NONE = new Float32Array(9);

  capsule(a: V3, b: V3, ra: number, rb = ra) {
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const l2 = Math.max(1e-8, bax * bax + bay * bay + baz * baz), rr = ra - rb;
    return this.push({ kind: Kind.Cone, ax: a[0], ay: a[1], az: a[2], bx: b[0], by: b[1], bz: b[2], ra, rb, rx: 0, ry: 0, rz: 0, round: 0, m: Flesh.NONE,
      l2, rr, a2: l2 - rr * rr, il2: 1 / l2 }, 0);
  }
  ellipsoid(c: V3, rx: number, ry: number, rz: number, yaw = 0, pitch = 0, roll = 0) {
    return this.push({ kind: Kind.Ellipsoid, ax: c[0], ay: c[1], az: c[2], bx: 0, by: 0, bz: 0, ra: 0, rb: 0, rx, ry, rz, round: 0, m: this.rotation(yaw, pitch, roll),
      l2: 0, rr: 0, a2: 0, il2: 0 }, Math.max(rx, ry, rz));
  }
  box(c: V3, sx: number, sy: number, sz: number, yaw = 0, pitch = 0, roll = 0, round = .015) {
    const rx = sx / 2, ry = sy / 2, rz = sz / 2;
    return this.push({ kind: Kind.Box, ax: c[0], ay: c[1], az: c[2], bx: 0, by: 0, bz: 0, ra: 0, rb: 0, rx, ry, rz, round: Math.min(round, rx, ry, rz), m: this.rotation(yaw, pitch, roll),
      l2: 0, rr: 0, a2: 0, il2: 0 }, Math.hypot(rx, ry, rz));
  }
  torus(c: V3, ring: number, tube: number, yaw = 0, pitch = 0, roll = 0) {
    return this.push({ kind: Kind.Torus, ax: c[0], ay: c[1], az: c[2], bx: 0, by: 0, bz: 0, ra: 0, rb: 0, rx: ring, ry: tube, rz: 0, round: 0, m: this.rotation(yaw, pitch, roll),
      l2: 0, rr: 0, a2: 0, il2: 0 }, ring + tube);
  }

  field(x: number, y: number, z: number) {
    let d = 10;
    for (const p of this.prims) if (!p.cut) d = smin(d, distance(p, x, y, z), p.soft);
    for (const p of this.prims) if (p.cut) d = smax(d, -distance(p, x, y, z), p.soft);
    return d;
  }

  build(options: FleshOptions = {}): THREE.BufferGeometry {
    const cell = options.cell ?? .022, occlusionStrength = options.occlusion ?? .75;
    const prims = this.prims;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of prims) if (!p.cut) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p.min[a]); hi[a] = Math.max(hi[a], p.max[a]); }
    const pad = cell * 3;
    const ox = lo[0] - pad, oy = lo[1] - pad, oz = lo[2] - pad;
    const nx = Math.ceil((hi[0] - lo[0] + pad * 2) / cell) + 1, ny = Math.ceil((hi[1] - lo[1] + pad * 2) / cell) + 1, nz = Math.ceil((hi[2] - lo[2] + pad * 2) / cell) + 1;
    const F = new Float32Array(nx * ny * nz).fill(10);
    const at = (i: number, j: number, k: number) => i + nx * (j + ny * k);
    const splat = (p: Prim) => {
      const band = p.soft + cell * 2;
      const i0 = Math.max(0, Math.floor((p.min[0] - band - ox) / cell)), i1 = Math.min(nx - 1, Math.ceil((p.max[0] + band - ox) / cell));
      const j0 = Math.max(0, Math.floor((p.min[1] - band - oy) / cell)), j1 = Math.min(ny - 1, Math.ceil((p.max[1] + band - oy) / cell));
      const k0 = Math.max(0, Math.floor((p.min[2] - band - oz) / cell)), k1 = Math.min(nz - 1, Math.ceil((p.max[2] + band - oz) / cell));
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) {
        const z = oz + k * cell, y = oy + j * cell;
        let o = at(i0, j, k);
        for (let i = i0; i <= i1; i++, o++) {
          const d = distance(p, ox + i * cell, y, z);
          F[o] = p.cut ? smax(F[o], -d, p.soft) : smin(F[o], d, p.soft);
        }
      }
    };
    for (const p of prims) if (!p.cut) splat(p);
    for (const p of prims) if (p.cut) splat(p);

    const cx = nx - 1, cy = ny - 1, cz = nz - 1;
    const cellVertex = new Int32Array(cx * cy * cz).fill(-1);
    const pos: number[] = [];
    const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const v = new Float32Array(8);
    for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      let inside = 0;
      for (let c = 0; c < 8; c++) { const [a, b, d] = CORNERS[c]; v[c] = F[at(i + a, j + b, k + d)]; if (v[c] < 0) inside++; }
      if (inside === 0 || inside === 8) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [e0, e1] of EDGES) {
        const a = v[e0], b = v[e1];
        if ((a < 0) === (b < 0)) continue;
        const t = a / (a - b), [x0, y0, z0] = CORNERS[e0], [x1, y1, z1] = CORNERS[e1];
        sx += x0 + (x1 - x0) * t; sy += y0 + (y1 - y0) * t; sz += z0 + (z1 - z0) * t; n++;
      }
      cellVertex[i + cx * (j + cy * k)] = pos.length / 3;
      pos.push(ox + (i + sx / n) * cell, oy + (j + sy / n) * cell, oz + (k + sz / n) * cell);
    }
    const index: number[] = [];
    const cv = (i: number, j: number, k: number) => cellVertex[i + cx * (j + cy * k)];
    const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      if (flip) { const t = b; b = d; d = t; }
      const ac = (pos[a * 3] - pos[c * 3]) ** 2 + (pos[a * 3 + 1] - pos[c * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[c * 3 + 2]) ** 2;
      const bd = (pos[b * 3] - pos[d * 3]) ** 2 + (pos[b * 3 + 1] - pos[d * 3 + 1]) ** 2 + (pos[b * 3 + 2] - pos[d * 3 + 2]) ** 2;
      if (ac <= bd) index.push(a, b, c, a, c, d); else index.push(a, b, d, b, c, d);
    };
    for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const f0 = F[at(i, j, k)], inside = f0 < 0;
      if (inside !== (F[at(i + 1, j, k)] < 0)) quad(cv(i, j - 1, k - 1), cv(i, j, k - 1), cv(i, j, k), cv(i, j - 1, k), !inside);
      if (inside !== (F[at(i, j + 1, k)] < 0)) quad(cv(i - 1, j, k - 1), cv(i - 1, j, k), cv(i, j, k), cv(i, j, k - 1), !inside);
      if (inside !== (F[at(i, j, k + 1)] < 0)) quad(cv(i - 1, j - 1, k), cv(i, j - 1, k), cv(i, j, k), cv(i - 1, j, k), !inside);
    }

    const count = pos.length / 3;
    const nor = new Float32Array(count * 3);
    const h = cell * .25;
    const gradient = (x: number, y: number, z: number, out: number[]) => {
      out[0] = this.field(x + h, y, z) - this.field(x - h, y, z);
      out[1] = this.field(x, y + h, z) - this.field(x, y - h, z);
      out[2] = this.field(x, y, z + h) - this.field(x, y, z - h);
      const l = Math.hypot(out[0], out[1], out[2]) || 1;
      out[0] /= l; out[1] /= l; out[2] /= l;
    };
    const g = [0, 0, 0];
    for (let n = 0; n < count; n++) {
      let x = pos[n * 3], y = pos[n * 3 + 1], z = pos[n * 3 + 2];
      for (let step = 0; step < 2; step++) {
        const d = this.field(x, y, z);
        if (Math.abs(d) < cell * .02) break;
        gradient(x, y, z, g);
        const move = Math.max(-cell, Math.min(cell, d));
        x -= g[0] * move; y -= g[1] * move; z -= g[2] * move;
      }
      pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z;
      gradient(x, y, z, g);
      nor[n * 3] = g[0]; nor[n * 3 + 1] = g[1]; nor[n * 3 + 2] = g[2];
    }

    const col = new Float32Array(count * 3), bone1 = new Float32Array(count), bone2 = new Float32Array(count), weight = new Float32Array(count);
    const groups = new Float32Array(count), glows = new Float32Array(count), heads = new Float32Array(count), wear = new Float32Array(count * 3);
    const near = new Float32Array(prims.length);
    const boneWeight = new Float32Array(BONES.length);
    const AO = [.018, .036, .06, .09, .13];
    for (let n = 0; n < count; n++) {
      const x = pos[n * 3], y = pos[n * 3 + 1], z = pos[n * 3 + 2];
      let owner = 0, best = Infinity;
      for (let i = 0; i < prims.length; i++) {
        const d = Math.abs(distance(prims[i], x, y, z));
        near[i] = d;
        if (d < best) { best = d; owner = i; }
      }
      const o = prims[owner];
      _c.copy(o.color);
      boneWeight.fill(0);
      for (let i = 0; i < prims.length; i++) {
        const p = prims[i];
        if (p.cut || !neighbours(p.bone, o.bone)) continue;
        const s = Math.max(p.soft, .012);
        const w = Math.exp(-Math.max(0, near[i] - best) / s * 2.2);
        if (w > .02) boneWeight[p.bone] += w;
      }
      let b1 = o.bone, w1 = 0, b2 = o.bone, w2 = 0;
      for (let b = 0; b < boneWeight.length; b++) {
        const w = boneWeight[b];
        if (w > w1) { b2 = b1; w2 = w1; b1 = b; w1 = w; } else if (w > w2) { b2 = b; w2 = w; }
      }
      if (w1 <= 0) { b1 = o.bone; w1 = 1; }
      if (!neighbours(b1, b2)) { b2 = b1; w2 = 0; }
      let w = w1 / (w1 + w2);
      if (w > .9) { w = 1; b2 = b1; }
      bone1[n] = b1; bone2[n] = b2; weight[n] = w;
      let occ = 0;
      for (let s = 0; s < AO.length; s++) {
        const d = AO[s];
        occ += Math.max(0, d - this.field(x + nor[n * 3] * d, y + nor[n * 3 + 1] * d, z + nor[n * 3 + 2] * d)) / d * (1 / (s + 1.5));
      }
      const ao = Math.max(0, 1 - occ * 1.4);
      const shade = 1 - occlusionStrength + occlusionStrength * ao;
      col[n * 3] = _c.r * shade; col[n * 3 + 1] = _c.g * shade; col[n * 3 + 2] = _c.b * shade;
      groups[n] = o.group; glows[n] = o.glow; heads[n] = o.head;
      wear[n * 3] = noise3(x * 5.3, y * 5.3, z * 5.3) * .7 + noise3(x * 19 + 3.1, y * 19, z * 19) * .3;
      wear[n * 3 + 1] = noise3(x * 23 + 7.7, y * 23, z * 23) * .6 + noise3(x * 61, y * 61 + 1.3, z * 61) * .4;
      wear[n * 3 + 2] = Math.max(0, Math.min(1, (.62 - y) / .58)) * (.55 + .45 * noise3(x * 7 + 3.1, y * 7, z * 7));
    }

    const hard = this.kit.build();
    const hp = hard.getAttribute('position'), hn = hard.getAttribute('normal'), hc = hard.getAttribute('color');
    const hb = hard.getAttribute('aBone'), hgr = hard.getAttribute('aGroup'), hgl = hard.getAttribute('aGlow'), hh = hard.getAttribute('lookHead');
    const total = count + hp.count;
    const P = new Float32Array(total * 3), N = new Float32Array(total * 3), C = new Float32Array(total * 3);
    const B = new Float32Array(total), B2 = new Float32Array(total), W = new Float32Array(total), G = new Float32Array(total), L = new Float32Array(total), H = new Float32Array(total);
    const E = new Float32Array(total * 3);
    P.set(pos); N.set(nor); C.set(col); B.set(bone1); B2.set(bone2); W.set(weight); G.set(groups); L.set(glows); H.set(heads); E.set(wear);
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i), o = (count + i) * 3;
      E[o] = noise3(x * 5.3, y * 5.3, z * 5.3); E[o + 1] = noise3(x * 23 + 7.7, y * 23, z * 23); E[o + 2] = Math.max(0, Math.min(1, (.62 - y) / .58)) * .6;
    }
    P.set(hp.array as Float32Array, count * 3); N.set(hn.array as Float32Array, count * 3); C.set(hc.array as Float32Array, count * 3);
    B.set(hb.array as Float32Array, count); B2.set(hb.array as Float32Array, count); W.fill(1, count); G.set(hgr.array as Float32Array, count); L.set(hgl.array as Float32Array, count); H.set(hh.array as Float32Array, count);
    const hardIndex = hard.getIndex()!.array;
    const I = new Uint32Array(index.length + hardIndex.length);
    I.set(index); for (let i = 0; i < hardIndex.length; i++) I[index.length + i] = hardIndex[i] + count;
    hard.dispose();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(C, 3));
    geometry.setAttribute('aBone', new THREE.BufferAttribute(B, 1));
    geometry.setAttribute('aBone2', new THREE.BufferAttribute(B2, 1));
    geometry.setAttribute('aBoneW', new THREE.BufferAttribute(W, 1));
    geometry.setAttribute('aGroup', new THREE.BufferAttribute(G, 1));
    geometry.setAttribute('aGlow', new THREE.BufferAttribute(L, 1));
    geometry.setAttribute('lookHead', new THREE.BufferAttribute(H, 1));
    geometry.setAttribute('aWear', new THREE.BufferAttribute(E, 3));
    geometry.setIndex(new THREE.BufferAttribute(total > 65535 ? I : new Uint16Array(I), 1));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
