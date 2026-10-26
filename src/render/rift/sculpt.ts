import * as THREE from 'three';
import { INK_ON } from './ink';

export type Bucket = 'ground' | 'stone' | 'wood' | 'plaster' | 'thatch' | 'metal' | 'cloth' | 'bone' | 'flesh' | 'glow' | 'dark'
  | `model:${string}`;

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

interface Part { pos: number[]; nor: number[]; col: number[]; uv: number[]; tag: number[]; idx: number[];
  face: number[] }

export class Sculpt {
  private readonly parts = new Map<Bucket, Part>();
  private readonly color = new THREE.Color(1, 1, 1);
  private bucket: Bucket = 'stone';
  private jitter = 0;
  private seed = 1;
  private curTag = 0;
  texel = 2;

  constructor(seed = 1) { this.seed = seed; }
  private rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  use(bucket: Bucket, hex: number, jitter = .08) { this.bucket = bucket; this.color.setHex(hex); this.jitter = jitter; return this; }

  tag(value: number) { this.curTag = value; return this; }

  private part(): Part {
    let part = this.parts.get(this.bucket);
    if (!part) { part = { pos: [], nor: [], col: [], uv: [], tag: [], idx: [], face: [] }; this.parts.set(this.bucket, part); }
    return part;
  }

  add(geometry: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, own = false) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
    _n.getNormalMatrix(_m);
    const part = this.part(), base = part.pos.length / 3;
    const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal');
    const k = 1 + (this.rnd() - .5) * 2 * this.jitter;
    const r = Math.min(1, this.color.r * k), g = Math.min(1, this.color.g * k), b = Math.min(1, this.color.b * k);
    const colors = own ? geometry.getAttribute('color') : undefined;
    const uvs = this.bucket.startsWith('model:') ? geometry.getAttribute('uv') : undefined;
    const ruled = INK_ON && RULED.has(geometry) ? geometry.getAttribute('uv') : undefined;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(_m);
      _w.fromBufferAttribute(nor, i).applyMatrix3(_n).normalize();
      part.pos.push(_v.x, _v.y, _v.z); part.nor.push(_w.x, _w.y, _w.z); part.tag.push(this.curTag);
      if (INK_ON) { if (ruled && !(ruled !== BOX_UV && Math.abs(nor.getY(i)) > .99)) part.face.push(ruled.getX(i), ruled.getY(i)); else part.face.push(.5, .5); }
      if (colors) part.col.push(colors.getX(i) * r, colors.getY(i) * g, colors.getZ(i) * b); else part.col.push(r, g, b);
      if (uvs) { part.uv.push(uvs.getX(i), uvs.getY(i)); continue; }
      const ax = Math.abs(_w.x), ay = Math.abs(_w.y), az = Math.abs(_w.z);
      if (ay >= ax && ay >= az) part.uv.push(_v.x / this.texel, _v.z / this.texel);
      else if (ax >= az) part.uv.push(_v.z / this.texel, _v.y / this.texel);
      else part.uv.push(_v.x / this.texel, _v.y / this.texel);
    }
    const index = geometry.getIndex();
    if (index) for (let i = 0; i < index.count; i++) part.idx.push(base + index.getX(i));
    else for (let i = 0; i < pos.count; i++) part.idx.push(base + i);
    return this;
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, ry = 0, rx = 0, rz = 0) { return this.add(BOX, x, y, z, rx, ry, rz, w, h, d); }
  cylinder(x: number, y: number, z: number, r: number, h: number, sides = 10, ry = 0, rx = 0, rz = 0, top = 1) {
    return this.add(cylinderOf(sides, top), x, y, z, rx, ry, rz, r, h, r);
  }
  cone(x: number, y: number, z: number, r: number, h: number, sides = 8, ry = 0, rx = 0, rz = 0) { return this.add(cylinderOf(sides, 0), x, y, z, rx, ry, rz, r, h, r); }
  gable(x: number, y: number, z: number, w: number, d: number, h: number, ry = 0) { return this.add(GABLE, x, y, z, 0, ry, 0, w, h, d); }
  sphere(x: number, y: number, z: number, r: number, sy = 1) { return this.add(SPHERE, x, y, z, 0, 0, 0, r, r * sy, r); }
  rock(x: number, y: number, z: number, w: number, h: number, d: number, ry = 0) { return this.add(ROCK, x, y, z, 0, ry, 0, w, h, d); }

  build(materials: Partial<Record<Bucket, THREE.Material>>): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const [bucket, part] of this.parts) {
      const material = materials[bucket];
      if (!material || !part.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(part.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(part.col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
      g.setAttribute('aTag', new THREE.Float32BufferAttribute(part.tag, 1));
      if (INK_ON) g.setAttribute('aFace', new THREE.Float32BufferAttribute(part.face, 2));
      g.setIndex(part.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(part.idx, 1) : new THREE.Uint16BufferAttribute(part.idx, 1));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, material);
      mesh.name = `rift-${bucket}`;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}

const BOX = (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, .5, 0); return g; })();
const RULED = new WeakSet<THREE.BufferGeometry>([BOX]);
const BOX_UV = BOX.getAttribute('uv');
const cylinders = new Map<string, THREE.BufferGeometry>();
function cylinderOf(sides: number, top: number) {
  const key = `${sides}:${top}`;
  let g = cylinders.get(key);
  if (!g) { g = new THREE.CylinderGeometry(top, 1, 1, sides, 1); g.translate(0, .5, 0); cylinders.set(key, g); RULED.add(g); }
  return g;
}
const GABLE = (() => {
  const s = new THREE.Shape([new THREE.Vector2(-.5, 0), new THREE.Vector2(.5, 0), new THREE.Vector2(0, 1)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -.5); g.rotateY(Math.PI / 2);
  return g;
})();
const SPHERE = new THREE.IcosahedronGeometry(1, 1);
const ROCK = (() => {
  const g = new THREE.IcosahedronGeometry(.5, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.abs(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453) % 1;
    const k = .78 + h * .44;
    p.setXYZ(i, x * k, Math.max(0, y * k + .2), z * k);
  }
  g.computeVertexNormals();
  return g;
})();
