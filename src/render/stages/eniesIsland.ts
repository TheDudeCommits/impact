import * as THREE from 'three';
import type { DressContext } from './dressing';
import { stageMaterial } from './build';
import { Atlas, heroAir, horizonClouds, inkHull, Quads, skyIsland } from './hero';

export function eniesIsland(c: DressContext) {
  const atlas = paint();
  const map = atlas.texture();
  const q = new Quads();
  const cell = (n: string) => atlas.uv(n);
  eniesGate(q, cell, c);
  for (const isle of SIDE_ISLES) sideIsle(q, cell, c, isle);
  const material = stageMaterial(c.stage, 'Enies Lobby island', { map, vertexColors: true, roughness: .85 });
  material.emissive.setHex(0xffffff); material.emissiveMap = map; material.emissiveIntensity = .3;
  heroAir(material, .25);
  const geometry = q.geometry();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'enies island'; mesh.receiveShadow = false; mesh.castShadow = false;
  c.root.add(mesh);
  const ink = inkHull(geometry, .32, 0x1c2a40);
  heroAir(ink.material as THREE.Material, .25);
  c.root.add(ink);
  c.root.add(horizonClouds({ radius: 700, count: 18, seed: 31, base: -24, size: [170, 300], skip: b => Math.abs(Math.atan2(Math.sin(b - Math.PI), Math.cos(b - Math.PI))) < .5 }));
  const sea: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const a = (i * 2.399) % (Math.PI * 2), r = 70 + ((i * 97) % 380);
    sea.push({ x: Math.sin(a) * r, y: -52 - ((i * 37) % 34), z: Math.cos(a) * r * 1.2, size: 40 + ((i * 53) % 36) });
  }
  const seaOfCloud = c.ambient.puffs({ spots: sea, color: 0xffffff, shade: 0xaec0e8, opacity: .92, life: 0, drift: [1, 0, .3], seed: 71, order: 0 });
  heroAir(seaOfCloud.material as THREE.Material, .35);
}

type Cell = (name: string) => readonly [number, number, number, number];

export const GATE = 112;
function eniesGate(q: Quads, cell: Cell, c: DressContext) {
  const F = GATE;
  const plain = (face: number) => face === 0 ? null : { cell: cell('wall'), w: 8, h: 8, shade: .86, shadeTop: 1 };
  for (const [x0, x1] of [[-46, -29], [29, 46]] as const) {
    q.box([x0, -.3, F], [x1, 21, F + 8], plain, cell('roof'));
    facade(q, cell, [x1, F, x0], 21, [[-.3, 2, 'wall'], [2, 11, 'arch'], [11, 12, 'trim'], [12, 18, 'panel'], [18, 19, 'trim'], [19, 21, 'wall']]);
    merlons(q, cell, x0, x1, F, 21, 4);
  }
  q.box([-16, -.3, F - 2], [16, 27, F + 14], plain, cell('roof'));
  facade(q, cell, [16, F - 2, -16], 27, [[-.3, 11, 'gate', 12], [11, 11.5, 'trim'], [11.5, 16.5, 'sign', 32], [16.5, 17.5, 'trim'], [17.5, 25, 'panel'], [25, 27, 'wall']]);
  for (const [u0, u1] of [[-16, -6], [6, 16]] as const) q.quad([u1, -.3, F - 2.05], [u0, -.3, F - 2.05], [u0, 11, F - 2.05], [u1, 11, F - 2.05], cell('arch'), .9, 1);
  merlons(q, cell, -16, 16, F - 2, 27, 4);
  q.box([-.5, 27, F + 5.5], [.5, 45, F + 6.5], () => ({ cell: cell('pole'), w: 1, h: 18 }));
  c.ambient.cloth(flag(), { x: 0, y: 41, z: F + 5.4, width: 10, height: 6.5, wind: .8, readable: true, lit: .5 });
  for (const x of [-22.5, 22.5]) {
    q.prism(x, F + 1, 7, -.3, 30, 10, cell('tower'), 10, cell('roof'));
    ringMerlons(q, cell, x, F + 1, 7.4, 30, 10);
  }
  for (const x of [-50, 50]) {
    q.box([x - 4.5, -.3, F - 1], [x + 4.5, 26, F + 9], () => ({ cell: cell('tower'), w: 9, h: 8.7, shade: .88, shadeTop: 1 }), cell('roof'));
    merlons(q, cell, x - 4.5, x + 4.5, F - 1, 26, 3);
  }
}

function towerOfJustice(q: Quads, cell: Cell, c: DressContext, x: number, base: number, z: number, s: number, H: number) {
  const faceTo = Math.atan2(-x, -z);
  const g = new Quads();
  g.box([-s, -.6, -s], [s, H, s], f => f === 2 ? { cell: cell('wall'), w: 10, h: 10, shade: .88, shadeTop: 1 } : null, cell('roof'));
  for (const face of [0, 1, 3]) towerFace(g, cell, face, 0, s, H);
  g.box([-s - 1.2, H - 2, -s - 1.2], [s + 1.2, H, s + 1.2], () => ({ cell: cell('trim'), w: 32, h: 2 }), cell('roof'));
  merlons(g, cell, -s - 1.2, s + 1.2, -s - 1.2, H + 3, 3, H);
  g.box([-.5, H, -.5], [.5, H + 18, .5], () => ({ cell: cell('pole'), w: 1, h: 18 }));
  const geo = g.geometry(); geo.rotateY(faceTo + Math.PI); geo.translate(x, base, z);
  q.raw(Array.from(geo.getAttribute('position').array), Array.from(geo.getAttribute('uv').array), Array.from(geo.getAttribute('color').array).filter((_, i) => i % 3 === 0));
  const fx = x + Math.sin(faceTo) * .6, fz = z + Math.cos(faceTo) * .6;
  c.ambient.cloth(flag(), { x: fx, y: base + H + 13.5, z: fz, width: 11, height: 7, rot: faceTo + Math.PI, wind: .8, readable: true, lit: .5 });
}

function towerFace(q: Quads, cell: Cell, face: number, T: number, s: number, H: number) {
  const o: [number, number, number] = face === 0 ? [s, 0, T - s] : face === 1 ? [s, 0, T + s] : [-s, 0, T - s];
  const r: [number, number, number] = face === 0 ? [-1, 0, 0] : face === 1 ? [0, 0, -1] : [0, 0, 1];
  const n: [number, number, number] = face === 0 ? [0, 0, -1] : face === 1 ? [1, 0, 0] : [-1, 0, 0];
  const at = (u: number, y: number, out: number): [number, number, number] => [o[0] + r[0] * u + n[0] * out, y, o[2] + r[2] * u + n[2] * out];
  const W = 2 * s, pil = 3.4, bay = (W - pil * 4) / 3;
  const bands: [number, number, string][] = [[-.6, 26, 'arch'], [26, 27.5, 'trim'], [27.5, 61, 'panel'], [61, 62.5, 'trim'], [62.5, 74, 'windows'], [74, 75, 'trim']];
  for (let b = 0; b < 3; b++) {
    const u0 = pil + b * (bay + pil), u1 = u0 + bay;
    for (const [y0, y1, name] of bands) q.quad(at(u0, y0, 0), at(u1, y0, 0), at(u1, y1, 0), at(u0, y1, 0), cell(name), y0 < 30 ? .9 : 1, y1 < 30 ? .92 : 1);
  }
  q.quad(at(0, 75, .8), at(W, 75, .8), at(W, H - 2, .8), at(0, H - 2, .8), cell(face === 0 ? 'sign' : 'wall'));
  for (let p = 0; p < 4; p++) {
    const u0 = p * (bay + pil), u1 = u0 + pil;
    q.quad(at(u0, -.6, .8), at(u1, -.6, .8), at(u1, 75, .8), at(u0, 75, .8), cell('pilaster'), .9, 1);
    q.quad(at(u0, -.6, 0), at(u0, -.6, .8), at(u0, 75, .8), at(u0, 75, 0), cell('pilaster'), .78, .86);
    q.quad(at(u1, -.6, .8), at(u1, -.6, 0), at(u1, 75, 0), at(u1, 75, .8), cell('pilaster'), .78, .86);
  }
}

function facade(q: Quads, cell: Cell, [x1, z, x0]: readonly [number, number, number], _top: number, bands: readonly (readonly [number, number, string, number?])[]) {
  for (const [y0, y1, name, w] of bands) {
    const width = w ?? (name === 'trim' || name === 'wall' ? 16 : 8);
    if (w) {
      const mid = (x0 + x1) / 2, half = w / 2;
      q.quad([mid + half, y0, z - .05], [mid - half, y0, z - .05], [mid - half, y1, z - .05], [mid + half, y1, z - .05], cell(name), .92, 1);
      continue;
    }
    q.tiles([x1, y0, z - .05], [x0 - x1, 0, 0], [0, y1 - y0, 0], cell(name), width, y1 - y0, y0 < 12 ? .9 : 1, 1);
  }
}

function merlons(q: Quads, cell: Cell, x0: number, x1: number, z: number, top: number, step: number, base = top) {
  const h = base === top ? 2.6 : top - base;
  for (let x = x0 + step * .25; x + step * .5 <= x1 + 1e-3; x += step) q.box([x, base, z - .3], [x + step * .5, base + h, z + 1.6], f => f === 2 ? null : { cell: cell('wall'), w: 4, h: 4 }, cell('roof'));
}
function ringMerlons(q: Quads, cell: Cell, x: number, z: number, r: number, top: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = (i + .5) / n * Math.PI * 2, mx = x + Math.sin(a) * r, mz = z + Math.cos(a) * r;
    q.box([mx - 1.1, top, mz - 1.1], [mx + 1.1, top + 2.6, mz + 1.1], () => ({ cell: cell('wall'), w: 4, h: 4 }), cell('roof'));
  }
}

const SIDE_ISLES = [
  { x: 172, z: 28, r: 46, rz: 40, top: 9, depth: 110, seed: 13, build: 'tower' },
  { x: -132, z: -12, r: 40, rz: 58, top: 7, depth: 100, seed: 11, build: 'court' },
  { x: 138, z: -156, r: 34, rz: 30, top: 10, depth: 80, seed: 17, build: 'round' },
  { x: -150, z: 150, r: 34, rz: 30, top: 10, depth: 80, seed: 18, build: 'block' },
  { x: 158, z: 168, r: 32, rz: 28, top: 12, depth: 76, seed: 19, build: 'block' },
  { x: -150, z: -170, r: 32, rz: 28, top: 10, depth: 76, seed: 20, build: 'round' },
  { x: 268, z: 190, r: 42, rz: 32, top: 48, depth: 80, seed: 15, build: 'none' },
  { x: -312, z: 168, r: 38, rz: 30, top: 66, depth: 70, seed: 12, build: 'none' },
  { x: 222, z: -236, r: 36, rz: 28, top: 74, depth: 62, seed: 14, build: 'none' },
  { x: -262, z: -214, r: 34, rz: 28, top: 40, depth: 60, seed: 16, build: 'none' },
] as const;

function sideIsle(q: Quads, cell: Cell, c: DressContext, o: typeof SIDE_ISLES[number]) {
  const rim = skyIsland(q, { x: o.x, z: o.z, top: o.top, r: o.r, rz: o.rz, depth: o.depth, seed: o.seed, rock: cell('rock'), grass: cell('grass'), lip: cell('lip'), segments: 40 });
  const toward = Math.atan2(-o.x, -o.z);
  const order = rim.map(([x, z], k) => ({ k, s: Math.cos(Math.atan2(x - o.x, z - o.z) - toward) })).sort((a, b) => b.s - a.s);
  for (const { k } of [order[1], order[4]]) {
    const [fx, fz] = rim[k], a = Math.atan2(fx - o.x, fz - o.z);
    c.ambient.waterfall({ x: fx + Math.sin(a) * 1.5, y: o.top - o.depth * .45, z: fz + Math.cos(a) * 1.5, width: o.r * .28, height: o.depth * .9, rot: a, color: 0xd8f0ff, speed: .4, curve: .5 });
  }
  if (o.build === 'tower') {
    towerOfJustice(q, cell, c, o.x, o.top, o.z, 15, 38);
    for (const [dx, dz] of [[6, 30], [10, -30]] as const) {
      const hx = o.x + dx, hz = o.z + dz;
      q.box([hx - 9, o.top, hz - 9], [hx + 9, o.top + 18, hz + 9], () => ({ cell: cell('windows'), w: 9, h: 9, shade: .9, shadeTop: 1 }), cell('roof'));
    }
  } else if (o.build === 'round') {
    q.prism(o.x, o.z, 11, o.top, o.top + 30, 12, cell('tower'), 10, cell('roof'));
    ringMerlons(q, cell, o.x, o.z, 11.4, o.top + 30, 12);
    q.box([o.x - .5, o.top + 30, o.z - .5], [o.x + .5, o.top + 44, o.z + .5], () => ({ cell: cell('pole'), w: 1, h: 14 }));
    c.ambient.cloth(flag(), { x: o.x + .6, y: o.top + 40.5, z: o.z, width: 7, height: 4.6, rot: Math.atan2(-o.x, -o.z) + Math.PI, wind: .9, readable: true, lit: .5 });
  } else if (o.build === 'block') {
    const faceTo = Math.atan2(-o.x, -o.z), g = new Quads();
    g.box([-16, 0, -9], [16, 22, 9], f => f === 0 ? null : { cell: cell('wall'), w: 8, h: 11, shade: .88, shadeTop: 1 }, cell('roof'));
    facade(g, cell, [16, -9, -16], 22, [[0, 11, 'arch'], [11, 12, 'trim'], [12, 19, 'panel'], [19, 20, 'trim'], [20, 22, 'wall']]);
    merlons(g, cell, -16, 16, -9, 22, 4);
    g.box([4, 22, -6], [14, 32, 4], f => f === 0 ? { cell: cell('windows'), w: 10, h: 10, shade: .92, shadeTop: 1 } : { cell: cell('wall'), w: 10, h: 10, shade: .88, shadeTop: 1 }, cell('roof'));
    const geo = g.geometry(); geo.rotateY(faceTo + Math.PI); geo.translate(o.x, o.top, o.z);
    q.raw(Array.from(geo.getAttribute('position').array), Array.from(geo.getAttribute('uv').array), Array.from(geo.getAttribute('color').array).filter((_, i) => i % 3 === 0));
  } else if (o.build === 'court') {
    const faceTo = Math.atan2(-o.x, -o.z), g = new Quads(), W = 30, D = 12, H = 22;
    g.box([-W, 0, -D], [W, H, D], f => f === 0 ? null : { cell: cell('wall'), w: 8, h: 10, shade: .88, shadeTop: 1 }, cell('roof'));
    facade(g, cell, [W, -D, -W], H, [[0, 12, 'arch'], [12, 13, 'trim'], [13, 19, 'panel'], [19, 20, 'trim'], [20, 22, 'wall']]);
    merlons(g, cell, -W, W, -D, H, 4);
    for (const x of [-W - 5, W + 5]) { g.prism(x, 0, 6, 0, 29, 8, cell('tower'), 9.7, cell('roof')); ringMerlons(g, cell, x, 0, 6.3, 29, 8); }
    for (const dx of [-20, 0, 20]) g.box([dx - .3, H, -D + 1], [dx + .3, H + 12, -D + 1.6], () => ({ cell: cell('pole'), w: 1, h: 12 }));
    const turn = faceTo + Math.PI, at = (lx: number, ly: number, lz: number): [number, number, number] =>
      [lx * Math.cos(turn) + lz * Math.sin(turn) + o.x + 4, ly + o.top, -lx * Math.sin(turn) + lz * Math.cos(turn) + o.z + 6];
    const geo = g.geometry(); geo.rotateY(turn); geo.translate(o.x + 4, o.top, o.z + 6);
    q.raw(Array.from(geo.getAttribute('position').array), Array.from(geo.getAttribute('uv').array), Array.from(geo.getAttribute('color').array).filter((_, i) => i % 3 === 0));
    for (const dx of [-20, 0, 20]) {
      const [px, py, pz] = at(dx + 3.1, H + 9.6, -D + 1.3);
      c.ambient.cloth(flag(), { x: px, y: py, z: pz, width: 5.6, height: 3.8, rot: turn, wind: .9, readable: true, lit: .5 });
    }
  }
}

function flag() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 160;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 160);
  const cx = 128, cy = 80;
  g.fillStyle = '#141414';
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    g.beginPath();
    g.moveTo(cx - dy * 8, cy + dx * 8); g.lineTo(cx + dx * 58 - dy * 26, cy + dy * 58 + dx * 26);
    g.quadraticCurveTo(cx + dx * 50, cy + dy * 50, cx + dx * 58 + dy * 26, cy + dy * 58 - dx * 26);
    g.lineTo(cx + dy * 8, cy - dx * 8); g.closePath(); g.fill();
  }
  g.beginPath(); g.arc(cx, cy, 17, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function paint() {
  const a = new Atlas(1024);
  const white = '#f1ede3', joint = 'rgba(150,140,120,.32)', shade = 'rgba(60,70,110,.10)';
  const stone = (g: CanvasRenderingContext2D, w: number, h: number, course = 32, base = white) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const grad = g.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(255,255,255,.18)'); grad.addColorStop(1, 'rgba(70,80,120,.12)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = joint; g.lineWidth = 2;
    for (let y = course; y < h; y += course) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let y = 0, row = 0; y < h; y += course, row++) for (let x = (row % 2) * course; x < w; x += course * 2) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + course); g.stroke(); }
  };
  a.cell('wall', 0, 0, 256, 256, (g, w, h) => stone(g, w, h));
  a.cell('panel', 256, 0, 256, 256, (g, w, h) => {
    g.fillStyle = white; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9b968'; g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#4f9d5c'; g.fillRect(20, 20, w - 40, h - 40);
    g.save(); g.beginPath(); g.rect(20, 20, w - 40, h - 40); g.clip();
    const d = 27;
    for (let y = 20 - d; y < h; y += d) for (let x = 20 - d; x < w; x += d) {
      const cx = x + (Math.round(y / d) % 2) * d / 2, cy = y;
      g.fillStyle = '#5fb46b'; g.beginPath(); g.moveTo(cx, cy - d / 2 + 3); g.lineTo(cx + d / 2 - 3, cy); g.lineTo(cx, cy + d / 2 - 3); g.lineTo(cx - d / 2 + 3, cy); g.fill();
      g.fillStyle = '#7ccf82'; g.beginPath(); g.moveTo(cx, cy - d / 2 + 3); g.lineTo(cx + d / 2 - 3, cy); g.lineTo(cx, cy - 2); g.lineTo(cx - d / 2 + 3, cy); g.fill();
    }
    g.strokeStyle = '#2f7440'; g.lineWidth = 2.5;
    for (let k = -12; k < 24; k++) { g.beginPath(); g.moveTo(20 + k * d / 2, 20); g.lineTo(20 + k * d / 2 + h, 20 + h); g.stroke(); g.beginPath(); g.moveTo(20 + k * d / 2, 20 + h); g.lineTo(20 + k * d / 2 + h, 20); g.stroke(); }
    g.restore();
    g.fillStyle = shade; g.fillRect(20, h - 34, w - 40, 14);
  });
  const keyhole = (g: CanvasRenderingContext2D, w: number, h: number, inner: (g: CanvasRenderingContext2D) => void, scale = 1) => {
    const cx = w / 2, R = 62 * scale, neck = 44 * scale, top = 52 * scale + R, foot = h - 10;
    const path = (grow: number) => { g.beginPath(); g.arc(cx, top, R + grow, Math.PI * .78, Math.PI * .22, false); g.lineTo(cx + neck + grow, foot); g.lineTo(cx - neck - grow, foot); g.closePath(); };
    g.fillStyle = '#d9b968'; path(9); g.fill();
    g.fillStyle = '#a88a44'; path(4); g.fill();
    g.save(); path(0); g.clip(); inner(g); g.restore();
  };
  a.cell('arch', 512, 0, 256, 256, (g, w, h) => {
    stone(g, w, h);
    keyhole(g, w, h, g => { const grad = g.createLinearGradient(0, 30, 0, h); grad.addColorStop(0, '#2f8fc4'); grad.addColorStop(.6, '#7fc8e6'); grad.addColorStop(1, '#e6f6fa'); g.fillStyle = grad; g.fillRect(0, 0, w, h); });
  });
  a.cell('gate', 768, 0, 256, 256, (g, w, h) => {
    stone(g, w, h, 24);
    keyhole(g, w, h, g => {
      g.fillStyle = '#3c6fb4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#5a8fd0'; for (const x of [w / 2 - 40, w / 2 + 6]) g.fillRect(x, 70, 34, h - 90);
      g.fillStyle = '#1f3f72'; g.fillRect(w / 2 - 3, 0, 6, h);
      g.fillStyle = '#d9b968'; for (let y = 80; y < h - 20; y += 22) for (const x of [w / 2 - 30, w / 2 - 12, w / 2 + 12, w / 2 + 30]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    }, 1.45);
  });
  a.cell('windows', 0, 256, 256, 256, (g, w, h) => {
    stone(g, w, h);
    for (const row of [0, 1]) for (let k = 0; k < 4; k++) {
      const x = 22 + k * 60, y = 30 + row * 116, ww = 32, hh = 74;
      g.fillStyle = '#d9b968'; g.beginPath(); g.arc(x + ww / 2, y + ww / 2 + 2, ww / 2 + 5, Math.PI, 0); g.lineTo(x + ww + 5, y + hh + 4); g.lineTo(x - 5, y + hh + 4); g.closePath(); g.fill();
      g.fillStyle = '#2d5d96'; g.beginPath(); g.arc(x + ww / 2, y + ww / 2 + 2, ww / 2, Math.PI, 0); g.lineTo(x + ww, y + hh); g.lineTo(x, y + hh); g.closePath(); g.fill();
      g.fillStyle = 'rgba(200,235,255,.5)'; g.fillRect(x + 4, y + 18, 6, hh - 24);
    }
  });
  a.cell('tower', 256, 256, 256, 256, (g, w, h) => {
    stone(g, w, h, 28);
    g.fillStyle = '#d9b968'; g.fillRect(0, 96, w, 6); g.fillRect(0, 160, w, 6);
    g.fillStyle = '#4f9d5c'; g.fillRect(0, 102, w, 58);
    g.strokeStyle = '#2f7440'; g.lineWidth = 2; for (let x = -60; x < w + 60; x += 18) { g.beginPath(); g.moveTo(x, 102); g.lineTo(x + 58, 160); g.stroke(); g.beginPath(); g.moveTo(x + 58, 102); g.lineTo(x, 160); g.stroke(); }
    g.fillStyle = '#2d5d96'; for (const x of [w * .3, w * .7]) { g.fillRect(x - 6, 196, 12, 40); g.beginPath(); g.arc(x, 196, 6, Math.PI, 0); g.fill(); }
  });
  a.cell('sign', 512, 256, 512, 128, (g, w, h) => {
    g.fillStyle = white; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9b968'; g.fillRect(0, 0, w, 8); g.fillRect(0, h - 8, w, 8);
    g.save(); g.translate(w / 2, h / 2 + 4); g.rotate(-.06);
    g.fillStyle = '#26386a'; g.font = 'bold 76px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ENIES LOBBY', 0, 0, w - 40); g.restore();
  });
  a.cell('pilaster', 512, 384, 128, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, '#fbf8f0'); grad.addColorStop(.55, '#ece6d8'); grad.addColorStop(1, '#cfc9c4');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(150,140,120,.3)'; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 2);
  });
  a.cell('trim', 640, 384, 128, 128, (g, w, h) => {
    g.fillStyle = '#dcbd6c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2dc96'; g.fillRect(0, 0, w, h * .35);
    g.fillStyle = '#a8883e'; g.fillRect(0, h * .8, w, h * .2);
  });
  a.cell('roof', 768, 384, 128, 128, (g, w, h) => { g.fillStyle = '#d7d4cc'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,120,130,.25)'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 2, h); });
  a.cell('pole', 896, 384, 128, 128, (g, w, h) => { g.fillStyle = '#5a5a62'; g.fillRect(0, 0, w, h); });
  a.cell('rock', 0, 512, 512, 512, (g, w, h) => {
    g.fillStyle = '#6e5644'; g.fillRect(0, 0, w, h);
    const tones = ['#9a7a5e', '#8a6c52', '#a4866a', '#7e624a', '#94765a'];
    let k = 0;
    for (let y = 0; y < h; y += 64) for (let x = -((y / 64) % 2) * 40; x < w; x += 80 + (k % 3) * 18) {
      const bw = 70 + (k * 37) % 40, bh = 56 + (k * 23) % 18, sx = x + (k * 13) % 10, sy = y + (k * 7) % 8;
      g.fillStyle = tones[k % tones.length];
      g.beginPath(); g.moveTo(sx + 6, sy); g.lineTo(sx + bw - 4, sy + 3); g.lineTo(sx + bw, sy + bh - 6); g.lineTo(sx + bw - 10, sy + bh); g.lineTo(sx + 4, sy + bh - 2); g.lineTo(sx, sy + 10); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,236,200,.22)'; g.beginPath(); g.moveTo(sx + 6, sy); g.lineTo(sx + bw - 4, sy + 3); g.lineTo(sx + bw - 8, sy + 14); g.lineTo(sx + 4, sy + 12); g.closePath(); g.fill();
      g.fillStyle = 'rgba(40,26,20,.28)'; g.beginPath(); g.moveTo(sx + 4, sy + bh - 14); g.lineTo(sx + bw - 6, sy + bh - 16); g.lineTo(sx + bw - 10, sy + bh); g.lineTo(sx + 4, sy + bh - 2); g.closePath(); g.fill();
      k++;
    }
  });
  a.cell('lip', 512, 512, 512, 256, (g, w, h) => {
    g.fillStyle = '#8a7a66'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,30,30,.2)'; for (let y = 40; y < h; y += 46) g.fillRect(0, y, w, 4);
    g.fillStyle = '#5ea047';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0);
    for (let x = w; x >= 0; x -= 16) g.lineTo(x, 46 + Math.sin(x * .07) * 14 + ((x * 13) % 22));
    g.closePath(); g.fill();
    g.fillStyle = '#7cc25a'; g.fillRect(0, 0, w, 14);
  });
  a.cell('grass', 512, 768, 512, 256, (g, w, h) => {
    g.fillStyle = '#69ad4f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { g.fillStyle = i % 2 ? 'rgba(130,200,90,.35)' : 'rgba(40,100,40,.25)'; g.beginPath(); g.arc((i * 151) % w, (i * 89) % h, 8 + (i % 5) * 4, 0, Math.PI * 2); g.fill(); }
  });
  return a;
}
