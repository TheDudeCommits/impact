import * as THREE from 'three';

export type V3 = readonly [number, number, number];
export const GROUP = { BODY: 0, HEAD: 1, ARM_L: 2, ARM_R: 3, UPPER: 4, GEAR: 5 } as const;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _n = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class GruntKit {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly col: number[] = [];
  private readonly bones: number[] = [];
  private readonly groups: number[] = [];
  private readonly glows: number[] = [];
  private readonly heads: number[] = [];
  private readonly index: number[] = [];
  private curBone = 0; private curGroup = 0; private curGlow = 0; private curHead = 0;
  private readonly curColor = new THREE.Color(1, 1, 1);

  constructor(readonly rest: readonly THREE.Vector3[]) {}

  at(bone: number, dx = 0, dy = 0, dz = 0): V3 { const p = this.rest[bone]; return [p.x + dx, p.y + dy, p.z + dz]; }
  between(a: number, b: number, t: number, dx = 0, dy = 0, dz = 0): V3 {
    const p = this.rest[a], q = this.rest[b];
    return [p.x + (q.x - p.x) * t + dx, p.y + (q.y - p.y) * t + dy, p.z + (q.z - p.z) * t + dz];
  }

  on(bone: number, group: number = GROUP.BODY) { this.curBone = bone; this.curGroup = group; this.curHead = 0; return this; }
  head(weight = 1) { this.curHead = weight; return this; }
  color(hex: number | THREE.Color) { if (typeof hex === 'number') this.curColor.setHex(hex); else this.curColor.copy(hex); return this; }
  glow(value: number) { this.curGlow = value; return this; }

  private vertex(p: THREE.Vector3, n: THREE.Vector3) {
    this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z);
    this.col.push(this.curColor.r, this.curColor.g, this.curColor.b);
    this.bones.push(this.curBone); this.groups.push(this.curGroup); this.glows.push(this.curGlow); this.heads.push(this.curHead);
    return this.pos.length / 3 - 1;
  }
  private tri(a: number, b: number, c: number) { this.index.push(a, b, c); }

  revolve(a: V3, b: V3, profile: readonly (readonly [number, number])[], sides = 10, squash: readonly [number, number] = [1, 1], twist = 0) {
    _a.set(...a); _b.set(...b);
    _y.subVectors(_b, _a); const len = _y.length(); _y.normalize();
    _x.set(0, 0, 1); if (Math.abs(_x.dot(_y)) > .9) _x.set(1, 0, 0);
    _z.crossVectors(_x, _y).normalize(); _x.crossVectors(_y, _z).normalize();
    if (twist) { _q.setFromAxisAngle(_y, twist); _x.applyQuaternion(_q); _z.applyQuaternion(_q); }
    const rings: number[][] = [];
    for (let i = 0; i < profile.length; i++) {
      const [t, r] = profile[i];
      const prev = profile[Math.max(0, i - 1)], next = profile[Math.min(profile.length - 1, i + 1)];
      const dr = (next[1] - prev[1]), dt = Math.max(1e-4, (next[0] - prev[0]) * len);
      const slope = -dr / dt;
      const ring: number[] = [];
      for (let s = 0; s < sides; s++) {
        const ang = s / sides * Math.PI * 2, cx = Math.cos(ang) * squash[0], cz = Math.sin(ang) * squash[1];
        _c.copy(_a).addScaledVector(_y, t * len).addScaledVector(_x, cx * r).addScaledVector(_z, cz * r);
        _n.copy(_x).multiplyScalar(Math.cos(ang) / Math.max(.2, squash[0])).addScaledVector(_z, Math.sin(ang) / Math.max(.2, squash[1])).normalize().addScaledVector(_y, slope).normalize();
        if (r < 1e-4) _n.copy(_y).multiplyScalar(t < .5 ? -1 : 1);
        ring.push(this.vertex(_c, _n));
      }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < rings.length; i++) for (let s = 0; s < sides; s++) {
      const a0 = rings[i][s], a1 = rings[i][(s + 1) % sides], b0 = rings[i + 1][s], b1 = rings[i + 1][(s + 1) % sides];
      this.tri(a0, b0, a1); this.tri(a1, b0, b1);
    }
    return this;
  }

  limb(a: V3, b: V3, ra: number, rb: number, sides = 10, squash: readonly [number, number] = [1, 1]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-3;
    const capA = Math.min(.45, ra / len), capB = Math.min(.45, rb / len);
    const p: [number, number][] = [];
    for (let i = 0; i <= 3; i++) { const ang = (i / 3) * Math.PI / 2; p.push([capA - Math.cos(ang) * capA, Math.sin(ang) * ra]); }
    p.push([.5, (ra + rb) / 2]);
    for (let i = 3; i >= 0; i--) { const ang = (i / 3) * Math.PI / 2; p.push([1 - capB + Math.cos(ang) * capB, Math.sin(ang) * rb]); }
    return this.revolve(a, b, p, sides, squash);
  }

  ellipsoid(c: V3, rx: number, ry: number, rz: number, rings = 7, sides = 12, yaw = 0, pitch = 0) {
    _m.makeRotationFromEuler(_e.set(pitch, yaw, 0, 'YXZ'));
    const grid: number[][] = [];
    for (let i = 0; i <= rings; i++) {
      const v = i / rings, phi = v * Math.PI;
      const row: number[] = [];
      for (let s = 0; s <= sides; s++) {
        const u = s / sides, th = u * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        _c.set(nx * rx, ny * ry, nz * rz).applyMatrix4(_m).add(_d.set(...c));
        _n.set(nx / rx, ny / ry, nz / rz).normalize().transformDirection(_m);
        row.push(this.vertex(_c, _n));
      }
      grid.push(row);
    }
    for (let i = 0; i < rings; i++) for (let s = 0; s < sides; s++) {
      const a0 = grid[i][s], a1 = grid[i][s + 1], b0 = grid[i + 1][s], b1 = grid[i + 1][s + 1];
      this.tri(a0, a1, b0); this.tri(a1, b1, b0);
    }
    return this;
  }

  box(c: V3, sx: number, sy: number, sz: number, yaw = 0, pitch = 0, roll = 0, round = .35) {
    _m.makeRotationFromEuler(_e.set(pitch, yaw, roll, 'YXZ')).setPosition(c[0], c[1], c[2]);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const faces: [V3, V3, V3][] = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
      [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    for (const [n, u, v] of faces) {
      const idx: number[] = [];
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = n[0] ? n[0] * hx : (u[0] * su + v[0] * sv) * hx, y = n[1] ? n[1] * hy : (u[1] * su + v[1] * sv) * hy, z = n[2] ? n[2] * hz : (u[2] * su + v[2] * sv) * hz;
        _c.set(x, y, z).applyMatrix4(_m);
        _n.set(n[0] + (u[0] * su + v[0] * sv) * round, n[1] + (u[1] * su + v[1] * sv) * round, n[2] + (u[2] * su + v[2] * sv) * round).normalize().transformDirection(_m);
        idx.push(this.vertex(_c, _n));
      }
      this.tri(idx[0], idx[1], idx[2]); this.tri(idx[0], idx[2], idx[3]);
    }
    return this;
  }

  cone(base: V3, tip: V3, r: number, sides = 8) { return this.revolve(base, tip, [[0, 0], [.01, r], [1, 0]], sides); }

  blade(from: V3, dir: V3, length: number, width: number, thickness = .02, tipTaper = .15, up: V3 = [0, 1, 0]) {
    _y.set(...dir).normalize(); _x.set(...up); _z.crossVectors(_y, _x).normalize(); _x.crossVectors(_z, _y).normalize();
    const base = _a.set(...from);
    const pts: [number, number][] = [[0, -width / 2], [0, width / 2], [length * (1 - tipTaper), width / 2], [length, 0], [length * (1 - tipTaper), -width / 2]];
    for (const side of [1, -1]) {
      _n.copy(_z).multiplyScalar(side);
      const idx = pts.map(([l, w]) => this.vertex(_c.copy(base).addScaledVector(_y, l).addScaledVector(_x, w).addScaledVector(_z, side * thickness / 2), _n));
      if (side > 0) { this.tri(idx[0], idx[1], idx[2]); this.tri(idx[0], idx[2], idx[4]); this.tri(idx[4], idx[2], idx[3]); }
      else { this.tri(idx[0], idx[2], idx[1]); this.tri(idx[0], idx[4], idx[2]); this.tri(idx[4], idx[3], idx[2]); }
    }
    return this;
  }

  torus(c: V3, radius: number, tube: number, axis: V3 = [0, 1, 0], radial = 6, tubular = 14, squash = 1) {
    _y.set(...axis).normalize(); _x.set(1, 0, 0); if (Math.abs(_x.dot(_y)) > .9) _x.set(0, 0, 1);
    _z.crossVectors(_x, _y).normalize(); _x.crossVectors(_y, _z).normalize();
    const grid: number[][] = [];
    for (let i = 0; i <= tubular; i++) {
      const u = i / tubular * Math.PI * 2, row: number[] = [];
      _d.copy(_x).multiplyScalar(Math.cos(u)).addScaledVector(_z, Math.sin(u) * squash);
      for (let j = 0; j <= radial; j++) {
        const v = j / radial * Math.PI * 2;
        _n.copy(_d).normalize().multiplyScalar(Math.cos(v)).addScaledVector(_y, Math.sin(v)).normalize();
        _c.set(...c).addScaledVector(_d, radius).addScaledVector(_n, tube);
        row.push(this.vertex(_c, _n));
      }
      grid.push(row);
    }
    for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
      const a0 = grid[i][j], a1 = grid[i + 1][j], b0 = grid[i][j + 1], b1 = grid[i + 1][j + 1];
      this.tri(a0, a1, b0); this.tri(a1, b1, b0);
    }
    return this;
  }

  sheet(a: V3, b: V3, drop: number, down: V3, out: V3, bulge = .08, cols = 5, rows = 4, flare = 1.25) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), D = new THREE.Vector3(...down).normalize(), O = new THREE.Vector3(...out).normalize();
    const mid = A.clone().add(B).multiplyScalar(.5);
    for (const side of [1, -1]) {
      const grid: number[][] = [];
      for (let r = 0; r <= rows; r++) {
        const v = r / rows, row: number[] = [];
        for (let c = 0; c <= cols; c++) {
          const u = c / cols;
          _c.lerpVectors(A, B, u).sub(mid).multiplyScalar(1 + (flare - 1) * v).add(mid).addScaledVector(D, drop * v).addScaledVector(O, Math.sin(u * Math.PI) * bulge * (.4 + v));
          _n.copy(O).multiplyScalar(side);
          row.push(this.vertex(_c.addScaledVector(O, side * .004), _n));
        }
        grid.push(row);
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const a0 = grid[r][c], a1 = grid[r][c + 1], b0 = grid[r + 1][c], b1 = grid[r + 1][c + 1];
        if (side > 0) { this.tri(a0, b0, a1); this.tri(a1, b0, b1); } else { this.tri(a0, a1, b0); this.tri(a1, b1, b0); }
      }
    }
    return this;
  }

  get vertexCount() { return this.pos.length / 3; }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aBone', new THREE.Float32BufferAttribute(this.bones, 1));
    g.setAttribute('aGroup', new THREE.Float32BufferAttribute(this.groups, 1));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glows, 1));
    g.setAttribute('lookHead', new THREE.Float32BufferAttribute(this.heads, 1));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}
