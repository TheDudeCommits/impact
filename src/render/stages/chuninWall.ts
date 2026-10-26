import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from './dressing';
import { stageMaterial } from './build';
import { seeded } from './ambient';
import { heroAir } from './hero';


export function wallShrubs(c: DressContext, wall: number) {
  const rng = seeded(1616), parts: THREE.BufferGeometry[] = [];
  const puff = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
  for (let i = 0; i < 84; i++) {
    const a = i / 84 * Math.PI * 2 + (rng() - .5) * .02, r = wall - 2.4 - rng() * .5;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (z > 60 && Math.abs(x) < 11) continue;
    if (rng() < .1) continue;
    const h = 2.4 + rng() * .8, w = h * (1.05 + rng() * .25);
    for (let k = -1; k <= 1; k++) {
      const g = puff.clone(), s = k ? .72 : 1;
      g.scale(w * .5 * s, h * .5 * s, w * .45 * s);
      g.translate(k * w * .42, h * .5 * s - .15, (rng() - .5) * .3);
      g.rotateY(a + Math.PI / 2 + (rng() - .5) * .3).translate(x, 0, z);
      parts.push(g);
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose()); puff.dispose();
  const p = geometry.getAttribute('position') as THREE.BufferAttribute, colour = new Float32Array(p.count * 3);
  const dark = new THREE.Color(0x2c5a26), light = new THREE.Color(0x8cc45a), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, p.getY(i) / 3.2)), n = (Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.3) * .5 + .5) * .18;
    tmp.copy(dark).lerp(light, Math.min(1, t * .9 + n));
    colour.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  geometry.computeVertexNormals();
  const material = stageMaterial(c.stage, 'Chunin wall shrubs', { color: 0xffffff, vertexColors: true, roughness: .9, emissive: 0x1e3a18, emissiveIntensity: 1 });
  heroAir(material, .4);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'chunin wall shrubs'; mesh.receiveShadow = true;
  c.root.add(mesh);
}

export function stadiumRim(c: DressContext, model: THREE.Object3D, wall: number) {
  let wallMap: THREE.Texture | null = null, crowdMap: THREE.Texture | null = null;
  const gold = new Set<THREE.Material>();
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    if (/^Material\.0(3[6-9]|40)$/.test(m.name)) { if (m.name === 'Material.036') wallMap = m.map; mesh.visible = false; }
    if (m.name === 'Material.021') crowdMap = m.map;
    if (STANDS.test(m.name)) {
      const at = mesh.getWorldPosition(new THREE.Vector3());
      at.y -= RIM.standsDrop;
      mesh.position.copy(mesh.parent ? mesh.parent.worldToLocal(at) : at);
      mesh.updateMatrixWorld(true);
      if (ROOFS.test(m.name) && !gold.has(m)) {
        gold.add(m);
        m.color.multiply(new THREE.Color(1.12, 1.02, .62));
        if (/^Material\.01[57]$/.test(m.name)) { m.color.setHex(0xf0c060); m.emissive.setHex(0x4a3208); m.emissiveIntensity = 1; }
      }
    }
  });
  model.updateMatrixWorld(true);
  const H = RIM.wall, n = 240, R = wall, TAU = Math.PI * 2;
  const at = (a: number, r: number, y: number) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  const sets = { wall: new Quad(), trim: new Quad(), crowd: new Quad(), roof: new Quad() };
  const around = TAU * R, tiles = 24, tileW = around / tiles;
  const cream = [.93, .92, .86], shade = [.42, .34, .3], red = [.36, .16, .12], dark = [.16, .12, .11];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, u0 = a0 * R / tileW, u1 = a1 * R / tileW;
    sets.wall.quad(at(a1, R, 0), at(a0, R, 0), at(a0, R, H), at(a1, R, H), [u1, 0], [u0, 0], [u0, 1], [u1, 1]);
    sets.trim.quad(at(a1, R, H), at(a0, R, H), at(a0, R + 1.4, H), at(a1, R + 1.4, H), null, null, null, null, cream);
    sets.trim.quad(at(a1, R - .15, H), at(a0, R - .15, H), at(a0, R - .15, H + .9), at(a1, R - .15, H + .9), null, null, null, null, cream);
    sets.trim.quad(at(a1, R - .15, H + .9), at(a0, R - .15, H + .9), at(a0, R + .2, H + .9), at(a1, R + .2, H + .9), null, null, null, null, cream);
    const cu0 = a0 * (R + 1) / 9.6, cu1 = a1 * (R + 1) / 9.6;
    sets.crowd.quad(at(a1, R + 1, H + .2), at(a0, R + 1, H + .2), at(a0, R + 1, H + 2.6), at(a1, R + 1, H + 2.6), [cu1, .5], [cu0, .5], [cu0, 0], [cu1, 0]);
    sets.trim.quad(at(a1, R + 2.2, H), at(a0, R + 2.2, H), at(a0, R + 2.2, RIM.eave), at(a1, R + 2.2, RIM.eave), null, null, null, null, dark);
    sets.trim.quad(at(a1, R + 2.2, RIM.eave), at(a0, R + 2.2, RIM.eave), at(a0, R - .6, RIM.eave), at(a1, R - .6, RIM.eave), null, null, null, null, shade);
    sets.trim.quad(at(a1, R - .6, RIM.eave), at(a0, R - .6, RIM.eave), at(a0, R - .6, RIM.eave + .7), at(a1, R - .6, RIM.eave + .7), null, null, null, null, cream);
    const tu0 = a0 * R / 4, tu1 = a1 * R / 4, slope = Math.hypot(RIM.ridgeR - (R - .6), RIM.ridge - RIM.eave - .7) / 2;
    sets.roof.quad(at(a1, R - .6, RIM.eave + .7), at(a0, R - .6, RIM.eave + .7), at(a0, RIM.ridgeR, RIM.ridge), at(a1, RIM.ridgeR, RIM.ridge), [tu1, 0], [tu0, 0], [tu0, slope], [tu1, slope]);
    sets.roof.quad(at(a0, RIM.ridgeR + 3.2, RIM.ridge - 1.6), at(a1, RIM.ridgeR + 3.2, RIM.ridge - 1.6), at(a1, RIM.ridgeR, RIM.ridge), at(a0, RIM.ridgeR, RIM.ridge), [tu0, 0], [tu1, 0], [tu1, 1.8], [tu0, 1.8]);
    sets.trim.quad(at(a0, RIM.ridgeR + 3.2, 0), at(a1, RIM.ridgeR + 3.2, 0), at(a1, RIM.ridgeR + 3.2, RIM.ridge - 1.6), at(a0, RIM.ridgeR + 3.2, RIM.ridge - 1.6), null, null, null, null, [.5, .24, .18]);
    sets.trim.quad(at(a1, RIM.ridgeR - .25, RIM.ridge + .05), at(a0, RIM.ridgeR - .25, RIM.ridge + .05), at(a0, RIM.ridgeR + .25, RIM.ridge + .3), at(a1, RIM.ridgeR + .25, RIM.ridge + .3), null, null, null, null, red);
  }
  const pillar = (a: number) => {
    const r = R + .25, w = .28, t = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), o = at(a, r, 0), nIn = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a));
    const c0 = o.clone().addScaledVector(t, -w).addScaledVector(nIn, w), c1 = o.clone().addScaledVector(t, w).addScaledVector(nIn, w);
    const c2 = o.clone().addScaledVector(t, w).addScaledVector(nIn, -w), c3 = o.clone().addScaledVector(t, -w).addScaledVector(nIn, -w);
    const y0 = H + .9, y1 = RIM.eave, col = [.3, .13, .1];
    for (const [p, q] of [[c0, c1], [c1, c2], [c3, c0]] as const)
      sets.trim.quad(new THREE.Vector3(q.x, y0, q.z), new THREE.Vector3(p.x, y0, p.z), new THREE.Vector3(p.x, y1, p.z), new THREE.Vector3(q.x, y1, q.z), null, null, null, null, col);
  };
  for (let k = 0; k < 72; k++) pillar((k + .5) / 72 * TAU);
  for (const g of RIM.gates) {
    const steps = 10, half = 4 / R, top = 5.4;
    for (let s = 0; s < steps; s++) {
      const t0 = -1 + 2 * s / steps, t1 = -1 + 2 * (s + 1) / steps;
      const y0 = top - 1.6 * (1 - Math.sqrt(1 - t0 * t0)), y1 = top - 1.6 * (1 - Math.sqrt(1 - t1 * t1));
      sets.trim.quad(at(g + t1 * half, R - .06, 0), at(g + t0 * half, R - .06, 0), at(g + t0 * half, R - .06, y0), at(g + t1 * half, R - .06, y1), null, null, null, null, [.1, .08, .07]);
    }
  }
  const wallTexture = wallMap ? (wallMap as THREE.Texture).clone() : null;
  if (wallTexture) { wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping; wallTexture.needsUpdate = true; }
  const wallMaterial = stageMaterial(c.stage, 'Chunin rim wall', { map: wallTexture, color: 0xffffff, roughness: .95 });
  sageWall(wallMaterial);
  const trim = stageMaterial(c.stage, 'Chunin rim trim', { color: 0xffffff, vertexColors: true, roughness: .85, side: THREE.DoubleSide });
  heroAir(trim, .3);
  const crowdTexture = crowdMap ? (crowdMap as THREE.Texture).clone() : null;
  if (crowdTexture) { crowdTexture.wrapS = THREE.RepeatWrapping; crowdTexture.needsUpdate = true; }
  const crowd = stageMaterial(c.stage, 'Chunin rim crowd', { map: crowdTexture, color: 0xd8d0c8, roughness: 1, alphaTest: .4, transparent: false });
  heroAir(crowd, .3);
  const roof = stageMaterial(c.stage, 'Chunin rim tile', { map: tileTexture(), color: 0xffffff, roughness: .7, side: THREE.DoubleSide });
  heroAir(roof, .3);
  roof.emissive.setHex(0x3a140c); roof.emissiveIntensity = 1;
  const meshes: [Quad, THREE.Material, string][] = [[sets.wall, wallMaterial, 'chunin rim wall'], [sets.trim, trim, 'chunin rim trim'], [sets.crowd, crowd, 'chunin rim crowd'], [sets.roof, roof, 'chunin rim tile']];
  for (const [q, material, name] of meshes) {
    const mesh = new THREE.Mesh(q.geometry(), material);
    mesh.name = name; mesh.receiveShadow = true;
    c.root.add(mesh);
  }
  return H;
}

export const RIM = { wall: 7.5, eave: 10.5, ridge: 14, ridgeR: 81.6, gates: [0, Math.PI], standsDrop: 15 } as const;
const STANDS = /^Material\.0(0[2-7]|1[578]|2[0137-9]|3[0-4]|87)$/, ROOFS = /^Material\.0(1[57]|2[78]|30|34|87)$/;

function sageWall(m: THREE.MeshStandardMaterial) {
  heroAir(m, .3);
  m.color.multiply(new THREE.Color(.9, 1, .95));
  if (m.map) { m.emissive.setHex(0xc4dcc8); m.emissiveMap = m.map; m.emissiveIntensity = .5; }
}

function tileTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#b5543f'; g.fillRect(0, 0, 256, 128);
  for (let row = 0; row < 8; row++) {
    const y = row * 16;
    g.fillStyle = '#d06a4c'; g.fillRect(0, y, 256, 4);
    g.fillStyle = '#7a2e22'; g.fillRect(0, y + 14, 256, 2);
    for (let x = (row % 2) * 8; x < 256; x += 16) { g.fillStyle = '#8c3a2a'; g.fillRect(x, y, 2, 16); }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  return map;
}

class Quad {
  private readonly p: number[] = []; private readonly uv: number[] = []; private readonly col: number[] = [];
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ua: number[] | null, ub: number[] | null, uc: number[] | null, ud: number[] | null, colour = [1, 1, 1]) {
    for (const [v, u] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]] as [THREE.Vector3, number[] | null][]) {
      this.p.push(v.x, v.y, v.z); this.uv.push(u ? u[0] : 0, u ? u[1] : 0); this.col.push(...colour);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}
