import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { addShaderPatch } from '../look/shaderPatch';
import { AIR_FRAGMENT } from '../look/air';


export function heroAir(material: THREE.Material, share: number, fog = 1) {
  const find = 'float air = uAirFog.x * uAirFog.w * ( 1.0 - exp( - airDepth ) );', linear = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
  if (!AIR_FRAGMENT.includes(find) || !AIR_FRAGMENT.includes(linear)) throw new Error('heroAir: the air chunk changed');
  let chunk = AIR_FRAGMENT.replace(find, `float air = ${share.toFixed(3)} * uAirFog.x * uAirFog.w * ( 1.0 - exp( - airDepth ) );`);
  if (fog !== 1) chunk = chunk.replace(linear, `gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, ${fog.toFixed(3)} * fogFactor );`);
  addShaderPatch(material, `hero-air-${share.toFixed(2)}-${fog.toFixed(2)}`, shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', chunk); });
  return material;
}

export class Atlas {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  private readonly cells = new Map<string, [number, number, number, number]>();
  constructor(readonly size = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.g = this.canvas.getContext('2d')!;
  }
  cell(name: string, x: number, y: number, w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    const g = this.g;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y);
    paint(g, w, h);
    g.restore();
    const s = this.size, e = 1.5;
    this.cells.set(name, [(x + e) / s, 1 - (y + h - e) / s, (x + w - e) / s, 1 - (y + e) / s]);
  }
  uv(name: string) {
    const c = this.cells.get(name); if (!c) throw new Error(`No atlas cell ${name}`);
    return c;
  }
  texture() {
    const map = new THREE.CanvasTexture(this.canvas);
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
    return map;
  }
}

type V3 = readonly [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

export class Quads {
  private readonly position: number[] = [];
  private readonly uv: number[] = [];
  private readonly color: number[] = [];
  quad(a: V3, b: V3, c: V3, d: V3, [u0, v0, u1, v1]: readonly [number, number, number, number], shade = 1, shadeTop = shade) {
    this.position.push(...a, ...b, ...c, ...a, ...c, ...d);
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    for (const s of [shade, shade, shadeTop, shade, shadeTop, shadeTop]) this.color.push(s, s, s);
  }
  tiles(origin: V3, along: V3, up: V3, cell: readonly [number, number, number, number], w: number, h: number, shade = 1, shadeTop = shade) {
    const W = Math.hypot(...along), H = Math.hypot(...up), ax = mul(along, 1 / W), ux = mul(up, 1 / H);
    const [u0, v0, u1, v1] = cell;
    for (let y = 0; y < H - 1e-3; y += h) for (let x = 0; x < W - 1e-3; x += w) {
      const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
      const p = (s: number, t: number) => add(add(origin, mul(ax, s)), mul(ux, t));
      const fu = (x1 - x) / w, fv = (y1 - y) / h;
      const k0 = shade + (shadeTop - shade) * y / H, k1 = shade + (shadeTop - shade) * y1 / H;
      this.position.push(...p(x, y), ...p(x1, y), ...p(x1, y1), ...p(x, y), ...p(x1, y1), ...p(x, y1));
      const uu = u0 + (u1 - u0) * fu, vv = v0 + (v1 - v0) * fv;
      this.uv.push(u0, v0, uu, v0, uu, vv, u0, v0, uu, vv, u0, vv);
      for (const s of [k0, k0, k1, k0, k1, k1]) this.color.push(s, s, s);
    }
  }
  box(min: V3, max: V3, side: (face: number) => { cell: readonly [number, number, number, number]; w: number; h: number; shade?: number; shadeTop?: number } | null, top?: readonly [number, number, number, number]) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max, H = y1 - y0;
    const faces: [V3, V3][] = [[[x1, y0, z0], [-(x1 - x0), 0, 0]], [[x1, y0, z1], [0, 0, -(z1 - z0)]], [[x0, y0, z1], [x1 - x0, 0, 0]], [[x0, y0, z0], [0, 0, z1 - z0]]];
    faces.forEach(([origin, along], k) => { const s = side(k); if (s) this.tiles(origin, along, [0, H, 0], s.cell, s.w, s.h, s.shade ?? 1, s.shadeTop ?? s.shade ?? 1); });
    if (top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
  }
  prism(x: number, z: number, r: number, y0: number, y1: number, n: number, cell: readonly [number, number, number, number], h: number, top?: readonly [number, number, number, number], turn = 0) {
    for (let i = 0; i < n; i++) {
      const a0 = turn + i / n * Math.PI * 2, a1 = turn + (i + 1) / n * Math.PI * 2;
      const p0: V3 = [x + Math.sin(a0) * r, y0, z + Math.cos(a0) * r], p1: V3 = [x + Math.sin(a1) * r, y0, z + Math.cos(a1) * r];
      this.tiles(p0, sub(p1, p0), [0, y1 - y0, 0], cell, Math.hypot(p0[0] - p1[0], p0[2] - p1[2]) + 1e-3, h);
      if (top) {
        this.position.push(x, y1, z, p0[0], y1, p0[2], p1[0], y1, p1[2]);
        this.uv.push(...mid(top), top[0], top[1], top[2], top[1]);
        this.color.push(1, 1, 1, 1, 1, 1, 1, 1, 1);
      }
    }
  }
  raw(positions: number[], uvs: number[], shade?: number[]) {
    this.position.push(...positions); this.uv.push(...uvs);
    if (shade) for (const s of shade) this.color.push(s, s, s); else for (let i = 0; i < positions.length / 3; i++) this.color.push(1, 1, 1);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
const mid = ([u0, v0, u1, v1]: readonly [number, number, number, number]) => [(u0 + u1) / 2, (v0 + v1) / 2];

export function noise1(seed: number) {
  const h = (i: number) => { const s = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  return (x: number) => { const i = Math.floor(x), f = x - i, t = f * f * (3 - 2 * f); return h(i) * (1 - t) + h(i + 1) * t; };
}

export function skyIsland(q: Quads, o: { x: number; z: number; top: number; r: number; rz?: number; depth: number; rough?: number; seed: number; rock: readonly [number, number, number, number]; grass: readonly [number, number, number, number]; lip?: readonly [number, number, number, number]; segments?: number }) {
  const n = o.segments ?? 36, wave = noise1(o.seed), rz = o.rz ?? o.r, rough = o.rough ?? .18;
  const rim: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, k = 1 + (wave(i * .9) - .5) * 2 * rough;
    rim.push([o.x + Math.sin(a) * o.r * k, o.z + Math.cos(a) * rz * k]);
  }
  const rings = [0, .03, .1, .2, .32, .45, .58, .7, .8, .89, .95, 1];
  const scale = rings.map(t => t < .1 ? 1 + t * .6 : Math.max(.03, 1.06 * Math.pow(1 - (t - .1) / .9, 1.35)));
  const at = (i: number, k: number): V3 => {
    const [x, z] = rim[i % n], s = scale[k], y = o.top - rings[k] * o.depth, inner = k > 0 && k < rings.length - 1;
    const jit = inner ? (wave(i * 1.7 + k * 13) - .5) * .16 * s + (wave(i * .45 + k * 3.1) - .5) * .1 * s : 0;
    return [o.x + (x - o.x) * (s + jit), y, o.z + (z - o.z) * (s + jit)];
  };
  let around = 0;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = rim[i], [x1, z1] = rim[(i + 1) % n], seg = Math.hypot(x1 - x0, z1 - z0);
    for (let k = 0; k + 1 < rings.length; k++) {
      const a = at(i, k), b = at(i + 1, k), c = at(i + 1, k + 1), d = at(i, k + 1);
      const cell = k === 0 && o.lip ? o.lip : o.rock;
      const [u0, v0, u1, v1] = cell, tile = 18;
      const su = (around % tile) / tile, eu = Math.min(1, su + seg / tile), ev = Math.max(0, 1 - (rings[k + 1] - rings[k]) * o.depth / tile);
      const U = (f: number) => u0 + (u1 - u0) * f, V = (f: number) => v0 + (v1 - v0) * f;
      const shadeTop = 1 - rings[k] * .55, shadeLow = 1 - rings[k + 1] * .55;
      q.raw([...a, ...d, ...c, ...a, ...c, ...b], [U(su), V(1), U(su), V(ev), U(eu), V(ev), U(su), V(1), U(eu), V(ev), U(eu), V(1)],
        [shadeTop, shadeLow, shadeLow, shadeTop, shadeLow, shadeTop]);
    }
    around += seg;
  }
  const [g0, gv0, g1, gv1] = o.grass, gu = (x: number) => g0 + (g1 - g0) * (((x - o.x) / (o.r * 2.4)) + .5), gvv = (z: number) => gv0 + (gv1 - gv0) * (((z - o.z) / (rz * 2.4)) + .5);
  for (let i = 0; i < n; i++) {
    const [x0, z0] = rim[i], [x1, z1] = rim[(i + 1) % n];
    q.raw([o.x, o.top + .4, o.z, x0, o.top, z0, x1, o.top, z1], [gu(o.x), gvv(o.z), gu(x0), gvv(z0), gu(x1), gvv(z1)]);
  }
  return rim;
}

export function inkHull(geometry: THREE.BufferGeometry, width: number, color = 0x1a2233) {
  const bare = new THREE.BufferGeometry();
  bare.setAttribute('position', geometry.getAttribute('position').clone());
  const merged = mergeVertices(bare, 1e-3);
  merged.computeVertexNormals();
  const p = merged.getAttribute('position') as THREE.BufferAttribute, n = merged.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * width, p.getY(i) + n.getY(i) * width, p.getZ(i) + n.getZ(i) * width);
  merged.deleteAttribute('normal');
  bare.dispose();
  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ name: 'Hero ink', color, side: THREE.BackSide, fog: true }));
  mesh.name = 'hero ink';
  return mesh;
}

export function horizonClouds(o: { radius: number; count: number; seed: number; base: number; size: [number, number]; skip?: (bearing: number) => boolean; tint?: number }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const g = canvas.getContext('2d')!;
  const wave = noise1(o.seed);
  for (let cellIndex = 0; cellIndex < 4; cellIndex++) {
    const x0 = (cellIndex % 2) * 512, y0 = Math.floor(cellIndex / 2) * 256, base = y0 + 214;
    const puffs: [number, number, number][] = [];
    const count = 7 + cellIndex;
    for (let k = 0; k < count; k++) {
      const t = (k + .5) / count, x = x0 + 40 + t * 432, hump = Math.sin(t * Math.PI);
      const r = 34 + hump * 52 * (.7 + wave(k * 3.3 + cellIndex * 17) * .6);
      puffs.push([x, base - r * .55 - hump * 60 * wave(k * 1.9 + cellIndex * 5), r]);
    }
    const shape = (grow: number) => { g.beginPath(); for (const [x, y, r] of puffs) { g.moveTo(x + r + grow, Math.min(y, base)); g.arc(x, Math.min(y, base), r + grow, 0, Math.PI * 2); } g.rect(x0 + 40 - grow, base - 30, 432 + grow * 2, 30 + grow); };
    g.fillStyle = '#2e4a7a'; shape(3); g.fill();
    g.fillStyle = '#ffffff'; shape(0); g.fill();
    g.save(); shape(0); g.clip();
    g.fillStyle = '#b8c6ea'; g.beginPath(); g.moveTo(x0, base + 10);
    for (let x = x0; x <= x0 + 512; x += 16) g.lineTo(x, base - 38 - Math.sin((x - x0) * .03 + cellIndex) * 10);
    g.lineTo(x0 + 512, base + 10); g.closePath(); g.fill();
    g.restore();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const parts: THREE.BufferGeometry[] = [];
  const rnd = noise1(o.seed + 7);
  for (let i = 0; i < o.count; i++) {
    const bearing = (i + rnd(i * 2.7) * .6) / o.count * Math.PI * 2;
    if (o.skip?.(bearing)) continue;
    const w = o.size[0] + (o.size[1] - o.size[0]) * rnd(i * 5.1), h = w * .5, r = o.radius * (.85 + rnd(i * 8.3) * .3), cell = i % 4;
    const plane = new THREE.PlaneGeometry(w, h);
    const uv = plane.getAttribute('uv') as THREE.BufferAttribute;
    const u0 = (cell % 2) * .5, v0 = 1 - (Math.floor(cell / 2) + 1) * .5;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * .5, v0 + uv.getY(k) * .5);
    plane.rotateY(bearing + Math.PI).translate(Math.sin(bearing) * r, o.base + h / 2, Math.cos(bearing) * r);
    parts.push(plane);
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ name: 'Horizon clouds', map, alphaTest: .5, fog: false, color: o.tint ?? 0xffffff }));
  mesh.name = 'horizon clouds';
  parts.forEach(p => p.dispose());
  return mesh;
}

export function mountainRidges(o: { radius: number; count: number; seed: number; base: number; height: [number, number]; far: number; near: number; crest: number; skip?: (bearing: number) => boolean }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const g = canvas.getContext('2d')!;
  const wave = noise1(o.seed);
  const far = new THREE.Color(o.far), near = new THREE.Color(o.near);
  for (let cell = 0; cell < 4; cell++) {
    const x0 = (cell % 2) * 512, y0 = Math.floor(cell / 2) * 256;
    const tone = far.clone().lerp(near, cell / 3), crest = new THREE.Color(o.crest);
    const pts: [number, number][] = [];
    for (let x = 0; x <= 512; x += 8) {
      const t = x / 512, peak = Math.sin(t * Math.PI) * .55 + .35, n = wave(x * .02 + cell * 7) * .6 + wave(x * .07 + cell * 3) * .25 + wave(x * .21 + cell) * .15;
      pts.push([x0 + x, y0 + 250 - (60 + n * 170) * peak]);
    }
    g.fillStyle = `#${tone.getHexString()}`;
    g.beginPath(); g.moveTo(x0, y0 + 256); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(x0 + 512, y0 + 256); g.closePath(); g.fill();
    g.strokeStyle = `#${crest.getHexString()}`; g.lineWidth = 5; g.globalAlpha = .7;
    g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y + 2) : g.moveTo(x, y + 2)); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = `#${tone.clone().lerp(crest, .25).getHexString()}`;
    for (let k = 4; k < pts.length - 4; k += 7) { const [x, y] = pts[k]; g.beginPath(); g.moveTo(x, y + 3); g.lineTo(x + 14, y + 40 + (k % 3) * 12); g.lineTo(x - 6, y + 46); g.closePath(); g.fill(); }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const parts: THREE.BufferGeometry[] = [];
  const rnd = noise1(o.seed + 11);
  for (let i = 0; i < o.count; i++) {
    const bearing = (i + rnd(i * 3.1) * .5) / o.count * Math.PI * 2;
    if (o.skip?.(bearing)) continue;
    const layer = i % 2, r = o.radius * (layer ? .78 : 1), h = o.height[0] + (o.height[1] - o.height[0]) * rnd(i * 6.7), w = 2 * Math.PI * r / o.count * 1.6;
    const cell = layer ? 2 + (i % 2) : (i % 2);
    const plane = new THREE.PlaneGeometry(w, h);
    const uv = plane.getAttribute('uv') as THREE.BufferAttribute;
    const u0 = (cell % 2) * .5, v0 = 1 - (Math.floor(cell / 2) + 1) * .5;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * .5, v0 + uv.getY(k) * .5);
    plane.rotateY(bearing + Math.PI).translate(Math.sin(bearing) * r, o.base + h / 2, Math.cos(bearing) * r);
    parts.push(plane);
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ name: 'Mountain ridges', map, alphaTest: .5, fog: false }));
  mesh.name = 'mountain ridges';
  parts.forEach(p => p.dispose());
  return mesh;
}
