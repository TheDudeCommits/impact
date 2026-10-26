import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from './dressing';
import { stageMaterial } from './build';

export function cypressRows(c: DressContext) {
  const trees: THREE.BufferGeometry[] = [], planters: THREE.BufferGeometry[] = [];
  const tree = cypress();
  const R = 51.5, LONG = 14, WIDE = 3.2, HIGH = .9;
  for (const axis of [Math.PI / 2, 0, -Math.PI / 2]) for (const off of [-.36, 0, .36]) {
    const a = axis + off, cx = Math.sin(a) * R, cz = Math.cos(a) * R;
    const tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), half = LONG / 2;
    const ends = [-half, half].map(s => new THREE.Vector3(cx + tangent.x * s, 0, cz + tangent.z * s));
    if (ends.some(e => Math.abs(e.x) < 39.2 && Math.abs(e.z) < 39.2)) continue;
    const box = new THREE.BoxGeometry(LONG, HIGH, WIDE).toNonIndexed();
    paint(box, (_x, y) => y > HIGH / 2 - 1e-3 ? [.36, .5, .28] : y > HIGH / 2 - .18 ? [.98, .98, .96] : [.92, .93, .95]);
    box.rotateY(a + Math.PI / 2).translate(cx, HIGH / 2, cz);
    planters.push(box);
    for (let k = 0; k < 5; k++) {
      const s = -LONG / 2 + 1.4 + k * (LONG - 2.8) / 4, h = .92 + ((k * 7 + Math.round(off * 10)) % 5) * .05;
      const g = tree.clone().scale(h, h, h).translate(cx + tangent.x * s, HIGH, cz + tangent.z * s);
      trees.push(g);
    }
  }
  if (!planters.length) return;
  const stone = stageMaterial(c.stage, 'Kami planters', { color: 0xffffff, vertexColors: true, roughness: .8 });
  const planterMesh = new THREE.Mesh(mergeGeometries(planters), stone);
  planterMesh.name = 'kami planters'; planterMesh.receiveShadow = true; planterMesh.castShadow = true;
  const leaves = stageMaterial(c.stage, 'Kami cypress', { color: 0xffffff, vertexColors: true, roughness: .85 });
  const treeMesh = new THREE.Mesh(mergeGeometries(trees), leaves);
  treeMesh.name = 'kami cypress'; treeMesh.receiveShadow = true; treeMesh.castShadow = true;
  c.root.add(planterMesh, treeMesh);
  planters.forEach(g => g.dispose()); trees.forEach(g => g.dispose()); tree.dispose();
}

function cypress() {
  const profile: THREE.Vector2[] = [];
  const H = 10, steps = 9;
  profile.push(new THREE.Vector2(.001, 0), new THREE.Vector2(.28, 0), new THREE.Vector2(.28, .9));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, y = .9 + t * (H - .9);
    const r = 1.25 * Math.pow(Math.sin(Math.min(1, t * 2.4 + .08) * Math.PI / 2), .8) * Math.pow(1 - t, .75) + (i === steps ? .001 : 0);
    profile.push(new THREE.Vector2(Math.max(.001, r), y));
  }
  const g = new THREE.LatheGeometry(profile, 9).toNonIndexed();
  paint(g, (x, y, z) => {
    if (y < .9) return [.38, .27, .18];
    const t = (y - .9) / (H - .9), lit = Math.max(0, (x * .45 + z * .5) / 1.3);
    const dark = [.14, .34, .16], light = [.36, .66, .32];
    const k = Math.min(1, .25 + t * .45 + lit * .4);
    return [dark[0] + (light[0] - dark[0]) * k, dark[1] + (light[1] - dark[1]) * k, dark[2] + (light[2] - dark[2]) * k];
  });
  g.computeVertexNormals();
  return g;
}

function paint(g: THREE.BufferGeometry, colour: (x: number, y: number, z: number) => number[]) {
  const p = g.getAttribute('position') as THREE.BufferAttribute, out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) out.set(colour(p.getX(i), p.getY(i), p.getZ(i)), i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
}

export function rimCurb(c: DressContext) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 64;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#7a1c24'; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#f2ece2'; g.beginPath(); g.moveTo(0, 46);
  for (let x = 0; x <= 512; x += 32) { g.lineTo(x + 16, 18); g.lineTo(x + 32, 46); }
  g.lineTo(512, 52); g.lineTo(0, 52); g.closePath(); g.fill();
  g.fillStyle = '#5a1018'; g.beginPath(); g.moveTo(0, 46); for (let x = 0; x <= 512; x += 32) { g.lineTo(x + 16, 26); g.lineTo(x + 32, 46); } g.lineTo(512, 46); g.closePath(); g.fill();
  g.fillStyle = '#d8b04a'; g.fillRect(0, 0, 512, 6); g.fillRect(0, 58, 512, 6);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping; map.anisotropy = 8;
  const R0 = 56.0, R1 = 56.5, H = .6, n = 160;
  const pos: number[] = [], uv: number[] = [];
  const around = 2 * Math.PI * R1 / 4.5;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, u0 = i / n * around, u1 = (i + 1) / n * around;
    const p = (a: number, r: number, y: number) => [Math.sin(a) * r, y, Math.cos(a) * r];
    pos.push(...p(a0, R1, -.2), ...p(a1, R1, -.2), ...p(a1, R1, H), ...p(a0, R1, -.2), ...p(a1, R1, H), ...p(a0, R1, H));
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
    pos.push(...p(a1, R0, 0), ...p(a0, R0, 0), ...p(a0, R0, H), ...p(a1, R0, 0), ...p(a0, R0, H), ...p(a1, R0, H));
    uv.push(u1, 0, u0, 0, u0, 1, u1, 0, u0, 1, u1, 1);
    pos.push(...p(a0, R0, H), ...p(a0, R1, H), ...p(a1, R1, H), ...p(a0, R0, H), ...p(a1, R1, H), ...p(a1, R0, H));
    uv.push(u0, .95, u0, .99, u1, .99, u0, .95, u1, .99, u1, .95);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  const curb = new THREE.Mesh(geometry, stageMaterial(c.stage, 'Kami curb', { map, roughness: .7 }));
  curb.name = 'kami curb'; curb.receiveShadow = true;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, 220, 8).translate(0, -150, 0), stageMaterial(c.stage, 'Kami pole', { color: 0x8a2a24, roughness: .6 }));
  pole.name = 'kami pole';
  c.root.add(curb, pole);
}

export function rimLampSpots() {
  const out: { x: number; z: number; rot: number; scale: number }[] = [];
  for (const axis of [Math.PI / 2, 0, -Math.PI / 2]) for (const off of [-.18, .18]) {
    const a = axis + off, x = Math.sin(a) * 53.2, z = Math.cos(a) * 53.2;
    if (Math.abs(x) < 39.5 && Math.abs(z) < 39.5) continue;
    out.push({ x, z, rot: a, scale: .62 });
  }
  return out;
}
