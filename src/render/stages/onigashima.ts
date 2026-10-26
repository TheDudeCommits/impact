import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from './dressing';
import { stageMaterial } from './build';
import { heroAir } from './hero';

export async function dressOnigashima(c: DressContext) {
  const { model, ambient } = c;
  const done = new Set<THREE.Material>();
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (/^SkullHorn/.test(mesh.name)) { mesh.visible = false; return; }
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (done.has(m)) return;
    done.add(m);
    if (m.name === 'onigashima_bone') { m.color.setHex(0x5a3640); heroAir(m, .35); m.emissive.setHex(0x3a1c24); m.emissiveIntensity = 1; }
    if (m.name === 'onigashima_socket') m.color.setHex(0x120a10);
    if (m.name === 'onigashima_eyes') { m.color.setHex(0xffc040); m.emissive.setHex(0xffa020); m.emissiveIntensity = 3.2; }
  });
  model.updateMatrixWorld(true);

  const horn = (side: number) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 92, 48, -520), new THREE.Vector3(side * 160, 66, -520), new THREE.Vector3(side * 215, 92, -505),
      new THREE.Vector3(side * 246, 128, -480), new THREE.Vector3(side * 252, 158, -455),
    ]);
    return taperedTube(curve, 34, 2, 40, 12);
  };
  const horns = new THREE.Mesh(mergeGeometries([horn(-1), horn(1)]), heroAir(stageMaterial(c.stage, 'Onigashima horns', { color: 0x6a4650, roughness: .8, emissive: 0x40202a, emissiveIntensity: 1 }), .35));
  horns.name = 'onigashima horns';
  c.root.add(horns);

  c.root.add(katana(c));

  ambient.puffs({ spots: [-55, 55].flatMap(x => [0, 1, 2].map(k => ({ x: x + (k - 1) * 6, y: -12 + k * 3, z: -410, size: 34 + k * 8 }))), color: 0xffa030, shade: 0xff5a10, opacity: .35, life: 0, additive: true, seed: 71, order: 1 });

  const clouds: { x: number; y: number; z: number; size: number }[] = [];
  let s = 811;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 54; i++) {
    const a = i / 54 * Math.PI * 2 + rnd() * .1, r = 150 + rnd() * 170;
    const high = i % 2 === 0 && Math.abs(((a - Math.PI + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > .75;
    clouds.push({ x: Math.sin(a) * r, y: high ? -10 + rnd() * 14 : -40 - rnd() * 30, z: Math.cos(a) * r, size: high ? 30 + rnd() * 22 : 50 + rnd() * 40 });
  }
  ambient.puffs({ spots: clouds, color: 0x8c74cc, shade: 0x2c1c52, opacity: .7, life: 0, cel: true, seed: 72 });

  c.root.add(towers(c));
  c.root.add(parapet(c));
}

function parapet(c: DressContext) {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, f: (y: number) => [number, number, number]) => {
    const p = g.getAttribute('position') as THREE.BufferAttribute, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) col.set(f(p.getY(i)), i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const R = 39.4, H = 1.3;
  for (let side = 0; side < 4; side++) {
    const turn = side * Math.PI / 2, wall = new THREE.BoxGeometry(R * 2 + 1.2, H, 1.1).translate(0, H / 2, R).rotateY(turn);
    parts.push(paint(wall, y => y > H - .15 ? [.42, .4, .5] : [.22, .2, .28]));
    for (let k = -9; k <= 9; k++) {
      const spike = new THREE.ConeGeometry(.42, 2.4, 6).translate(k * 4.2, H + 1.2, R).rotateY(turn);
      parts.push(paint(spike, y => y > H + 1.6 ? [.95, .94, .9] : [.24, .22, .3]));
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, stageMaterial(c.stage, 'Onigashima parapet', { color: 0xffffff, vertexColors: true, roughness: .85 }));
  mesh.name = 'onigashima parapet'; mesh.receiveShadow = true;
  return mesh;
}

function towers(c: DressContext) {
  const parts: THREE.BufferGeometry[] = [];
  const colour = (g: THREE.BufferGeometry, f: (y: number) => [number, number, number]) => {
    const p = g.getAttribute('position') as THREE.BufferAttribute, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) col.set(f(p.getY(i)), i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  for (const tower of onigashimaTowers()) {
    const { x, z, tiers: list } = tower;
    let y = 0;
    list.forEach((t, k) => {
      const last = k === list.length - 1;
      const wall = new THREE.BoxGeometry(t.w * .78, t.h, t.w * .78, 1, 3, 1).translate(x, t.y + t.h / 2, z);
      const y0 = t.y, y1 = t.y + t.h;
      parts.push(colour(wall, py => (py - y0) / (y1 - y0) > .45 && (py - y0) / (y1 - y0) < .8 && k > 0 ? [1.4, .8, .3] : [.36, .12, .1]));
      const roof = new THREE.ConeGeometry(t.w * .8, last ? 7 : 3.2, 4, 1, true).rotateY(Math.PI / 4).translate(x, y1 + (last ? 3.5 : 1.6), z);
      parts.push(colour(roof, () => [.1, .1, .14]));
      y = y1 + (last ? 7 : 1.2);
    });
    parts.push(colour(new THREE.CylinderGeometry(.6, .6, 6, 6).translate(x, y + 2, z), () => [.86, .66, .26]));
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  geometry.computeVertexNormals();
  const material = heroAir(stageMaterial(c.stage, 'Onigashima towers', { color: 0xffffff, vertexColors: true, roughness: .8, side: THREE.DoubleSide }), .4);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'onigashima towers';
  return mesh;
}

function taperedTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, steps: number, sides: number) {
  const frames = curve.computeFrenetFrames(steps, false), pos: number[] = [], index: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = curve.getPointAt(t), r = r0 + (r1 - r0) * Math.pow(t, .8);
    for (let k = 0; k <= sides; k++) {
      const a = k / sides * Math.PI * 2, n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
    }
  }
  for (let i = 0; i < steps; i++) for (let k = 0; k < sides; k++) {
    const a = i * (sides + 1) + k, b = a + sides + 1;
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

function katana(c: DressContext) {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, rgb: [number, number, number]) => {
    const n = g.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set(rgb, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const blade = new THREE.BoxGeometry(9, 150, 2.4, 1, 12, 1);
  const bp = blade.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i) + 75; bp.setX(i, bp.getX(i) * (y < 18 ? .4 + y / 30 : 1) + Math.pow(y / 150, 2) * 6); bp.setY(i, y); }
  parts.push(paint(blade, [.18, .2, .26]));
  parts.push(paint(new THREE.CylinderGeometry(14, 14, 3, 16).translate(6, 151.5, 0), [.86, .66, .26]));
  const hilt = new THREE.CylinderGeometry(4.2, 4.6, 46, 8, 8).translate(6, 176, 0);
  const hp = hilt.getAttribute('position') as THREE.BufferAttribute;
  const hcol = new Float32Array(hp.count * 3);
  for (let i = 0; i < hp.count; i++) { const k = Math.floor((hp.getY(i) - 153) / 5.75) % 2; hcol.set(k ? [.12, .1, .14] : [.5, .16, .14], i * 3); }
  hilt.setAttribute('color', new THREE.BufferAttribute(hcol, 3));
  parts.push(hilt.toNonIndexed());
  parts.push(paint(new THREE.CylinderGeometry(5, 4.4, 5, 8).translate(6, 201.5, 0), [.86, .66, .26]));
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  geometry.computeVertexNormals();
  const material = heroAir(stageMaterial(c.stage, 'Onigashima katana', { color: 0xffffff, vertexColors: true, roughness: .55 }), .35);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(190, -110, -450);
  mesh.rotation.set(0, -.3, -.28);
  mesh.scale.set(1.7, 1, 1.7);
  mesh.name = 'onigashima katana';
  return mesh;
}

export function onigashimaTowers() {
  let s = 913;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out: { x: number; z: number; top: number; width: number; tiers: { y: number; h: number; w: number }[] }[] = [];
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * .7 + i / 8 * Math.PI * 1.4 + (rnd() - .5) * .12, r = 120 + rnd() * 100;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    let y = -48 - rnd() * 10, w = 22 + rnd() * 6;
    const width = w, n = 5 + Math.floor(rnd() * 2), tiers: { y: number; h: number; w: number }[] = [];
    for (let t = 0; t < n; t++) {
      const h = t === 0 ? 30 + rnd() * 8 : 6.5 - t * .4;
      tiers.push({ y, h, w });
      y += h + (t === n - 1 ? 7 : 1.2);
      w *= .82;
    }
    out.push({ x, z, top: y, width, tiers });
  }
  return out;
}
