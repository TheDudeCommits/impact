import * as THREE from 'three';
import { lookStageMaterial } from '../look/stageMaterials';
import type { DressContext } from './dressing';
import { heroAir } from './hero';


export const SHRINE = { at: [0, -47.75], facades: [{ x: 0, z: 118, skulls: true }, { x: 118, z: 0, skulls: false }, { x: -118, z: 0, skulls: false }] } as const;

export function shrineFacade(c: DressContext, model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  c.root.updateMatrixWorld(true);
  const parts: THREE.Mesh[] = [];
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && /^(Shrine_Material|Mouths_Material|Bull_Skull_Material|Extra_Stuff_Material)$/.test((mesh.material as THREE.Material).name)) parts.push(mesh);
  });
  const toRoot = c.root.matrixWorld.clone().invert();
  const copies = new Map<THREE.Material, THREE.Material>();
  const fires: { x: number; y: number; z: number }[] = [];
  for (const f of SHRINE.facades) {
    const turn = Math.atan2(-f.x, -f.z);
    const move = new THREE.Matrix4().makeTranslation(f.x, 0, f.z)
      .multiply(new THREE.Matrix4().makeRotationY(turn))
      .multiply(new THREE.Matrix4().makeTranslation(-SHRINE.at[0], 0, -SHRINE.at[1]));
    for (const part of parts) {
      const source = part.material as THREE.MeshStandardMaterial;
      if (!f.skulls && source.name === 'Bull_Skull_Material') continue;
      let material = copies.get(source);
      if (!material) {
        const copy = lookStageMaterial(source.clone(), c.stage, 'shrine facade') as THREE.MeshStandardMaterial;
        heroAir(copy, .4);
        if (copy.name !== 'Mouths_Material' && copy.map) { copy.emissive.setHex(0xffffff); copy.emissiveMap = copy.map; copy.emissiveIntensity = .55; }
        copies.set(source, material = copy);
      }
      const mesh = new THREE.Mesh(part.geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(toRoot).multiply(move).multiply(part.matrixWorld);
      mesh.name = `${part.name} (facade ${f.x},${f.z})`;
      mesh.receiveShadow = true;
      c.root.add(mesh);
    }
    const d = Math.hypot(f.x, f.z), ux = -f.x / d, uz = -f.z / d;
    for (const side of [-9, 9]) fires.push({ x: f.x + ux * 9.75 - uz * side, y: 1, z: f.z + uz * 9.75 + ux * side });
  }
  return fires;
}

export function beforeAShrine(x: number, z: number) {
  return SHRINE.facades.some(f => {
    const d = Math.hypot(f.x, f.z), ux = f.x / d, uz = f.z / d, along = x * ux + z * uz, across = Math.abs(-x * uz + z * ux);
    return along > 55 && along < d + 10 && across < 34;
  });
}

export function burningCity(c: DressContext) {
  const rng = (() => { let s = 6007; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const pos: number[] = [], uv: number[] = [];
  const glowSpots: { x: number; y: number; z: number; size: number }[] = [], smoke: { x: number; y: number; z: number; size: number }[] = [];
  const bearings = SHRINE.facades.map(f => Math.atan2(f.x, f.z)).concat([Math.atan2(SHRINE.at[0], SHRINE.at[1])]);
  const clearOf = (a: number) => bearings.every(b => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > .2);
  const face = (ax: number, az: number, bx: number, bz: number, h: number, u0: number, u1: number, v1: number) => {
    pos.push(ax, -1, az, bx, -1, bz, bx, h, bz, ax, -1, az, bx, h, bz, ax, h, az);
    uv.push(u0, 0, u1, 0, u1, v1, u0, 0, u1, v1, u0, v1);
  };
  for (let i = 0; i < 150; i++) {
    const a = rng() * Math.PI * 2;
    if (!clearOf(a)) continue;
    const r = 240 + rng() * 180, h = 24 + Math.pow(rng(), 1.6) * 46, w = 14 + rng() * 16, d = 14 + rng() * 12;
    const cx = Math.sin(a) * r, cz = Math.cos(a) * r, turn = rng() * Math.PI;
    const ux = Math.cos(turn), uz = Math.sin(turn), vx = -uz, vz = ux;
    const corner = (s: number, t: number) => [cx + ux * s * w / 2 + vx * t * d / 2, cz + uz * s * w / 2 + vz * t * d / 2];
    const [p0, p1, p2, p3] = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
    const off = Math.floor(rng() * 4) * .25, v = h / 32;
    for (const [a0, a1, len] of [[p0, p1, w], [p1, p2, d], [p2, p3, w], [p3, p0, d]] as const) face(a0[0], a0[1], a1[0], a1[1], h, off, off + len / 32, v);
    pos.push(p0[0], h, p0[1], p2[0], h, p2[1], p1[0], h, p1[1], p0[0], h, p0[1], p3[0], h, p3[1], p2[0], h, p2[1]);
    uv.push(.99, .99, .99, .99, .99, .99, .99, .99, .99, .99, .99, .99);
    if (rng() < .45) glowSpots.push({ x: cx, y: 4 + rng() * 6, z: cz, size: 28 + rng() * 22 });
    if (rng() < .22) for (let k = 0; k < 4; k++) smoke.push({ x: cx + (rng() - .5) * 8, y: h + 4 + k * 9, z: cz + (rng() - .5) * 8, size: 18 + k * 7 });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const map = windowAtlas();
  const material = lookStageMaterial(new THREE.MeshStandardMaterial({ name: 'Burning city', map, color: 0x2a1416, roughness: 1, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 1 }), c.stage, 'burning city') as THREE.MeshStandardMaterial;
  heroAir(material, .45);
  const mesh = new THREE.Mesh(g, material);
  mesh.name = 'burning city';
  c.root.add(mesh);
  c.ambient.puffs({ spots: glowSpots, color: 0xff5a1c, shade: 0xb02010, opacity: .35, life: 0, additive: true, seed: 61, order: 1 });
  c.ambient.puffs({ spots: smoke, color: 0x3a2224, shade: 0x120a0c, opacity: .6, life: 18, rise: 30, drift: [1.2, 0, .4], grow: 2.2, seed: 62, cel: true });
}

function windowAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000000'; g.fillRect(0, 0, 512, 512);
  let s = 41;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) {
    const x = col * 32 + 7, y = row * 32 + 9, k = rnd();
    g.fillStyle = k < .3 ? '#ffb040' : k < .36 ? '#ff4a20' : k < .5 ? '#2a1008' : '#000000';
    g.fillRect(x, y, 18, 14);
  }
  g.fillStyle = '#000000'; g.fillRect(500, 0, 12, 12);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
  return map;
}
