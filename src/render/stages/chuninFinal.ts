import * as THREE from 'three';
import { STAGE_PROPS } from '../../game/stageProps';
import { STAGES } from '../../game/stages';
import type { DressContext } from './dressing';
import { cutPiece, instanceParts, leafGreen, placeProps, stageMaterial, stoneShapes, type CutPart } from './build';
import { lookStageMaterial } from '../look/stageMaterials';
import { optOutOfCutaway } from '../ground/toon';
import { seeded } from './ambient';
import { spawnSeats } from '../ground/mask';
import { RIM, stadiumRim, wallShrubs } from './chuninWall';

const WALL = 77.4;
const { halfX: BOUND } = STAGES['chunin-final'];

export async function dressChuninFinal(c: DressContext) {
  const { kit, ambient, model } = c;
  kit.grade = (material, piece) => {
    if (piece === 'asian/sakura' && /Sakura/.test(material.name)) leafGreen(material, [0x1c3a14, 0x86b848]);
    if (/RG Plants Mat 1/.test(material.name)) material.color.multiplyScalar(1.45);
    if (/^br\/rock/.test(piece)) {
      material.color.multiplyScalar(1.5);
      material.emissive.setHex(0x3a3026); material.emissiveIntensity = 1;
    }
  };
  await Promise.all([
    c.sky({ url: '/assets/environment/sky/leaf-dusk.webp', rotation: -2.85, drift: .0005, exposure: .95 }),
    kit.load(['br/wall-column', 'br/rock-a', 'br/rock-b', 'br/rock-c', 'br/rock-d', 'br/rock-formation-b', 'asian/sakura', 'asian/bush', 'br/kunai', 'br/shuriken',
      'br/stone-a', 'br/stone-b', 'br/flowers-a', 'br/flowers-b']),
  ]);
  stadiumRim(c, model, WALL);
  const props = STAGE_PROPS['chunin-final'] ?? [];
  placeProps(kit, props);
  const logs = stoneShapes(props, stageMaterial(c.stage, 'Felled log', { color: 0x8a6448, roughness: 1 }), 1.5);
  if (logs) c.root.add(logs);

  const rng = seeded(1212);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + .2, r = 44 + rng() * 5;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.abs(x) > 47 || Math.abs(z) > 47) continue;
    if (i % 2 === 0) kit.place('asian/sakura', { x, z, rot: rng() * 6.3, scale: .8 + rng() * .35 });
    kit.place('asian/bush', { x: x * .96, z: z * .96, rot: rng() * 6.3, scale: 2.6 + rng() * 1.6 });
  }
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2, r = 8 + rng() * 38;
    const stone = rng() < .3;
    if (stone) kit.place('br/stone-a', { x: Math.sin(a) * r, z: Math.cos(a) * r, rot: rng() * 6.3, scale: .3 + rng() * .25, tint: 0xd8c8b0 });
  }
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, r = 4 + rng() * 34;
    const kunai = rng() < .6;
    kit.place(kunai ? 'br/kunai' : 'br/shuriken', { x: Math.sin(a) * r, z: Math.cos(a) * r, y: kunai ? .3 : .05, rot: rng() * 6.3, tilt: kunai ? Math.PI + (rng() - .5) * .6 : Math.PI / 2 - .3, scale: 2.2 });
  }
  lowCover(kit);
  pocket(c, kit);
  wallShrubs(c, WALL);
  kit.shadows.add('br/wall-column').add('br/rock-b').add('br/rock-c').add('br/rock-formation-b').add('br/rock-d');
  kit.flush('chunin-final');

  const banners = bannerAtlas();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + .26;
    const x = Math.sin(a) * (WALL - .8), z = Math.cos(a) * (WALL - .8);
    ambient.cloth(banners, { x, y: RIM.eave - .1, z, width: 4.6, height: 7.2, rot: Math.atan2(-x, -z), uv: [(i % 4) * .25, 0, (i % 4) * .25 + .25, 1], wind: .3 });
  }
  kit.flush('chunin-final');

  ambient.motes({ min: [-48, 1, -48], max: [48, 14, 48], count: 160, velocity: [.9, -.35, .5], size: .09, color: 0x7fa83a, color2: 0xe08a3a, opacity: .9, wobble: 1.3, seed: 51 });
  ambient.birds({ centre: [0, 0, 0], count: 14, radius: 60, height: 46, spread: 14, speed: 9, size: .7, color: 0x16121a, seed: 52 });

  if (!RING_TREES) return;
  const tree = cutPiece(model, /^Material\.07[2-6]$/, new THREE.Box3(new THREE.Vector3(2, -1.5, -58.5), new THREE.Vector3(17.5, 22, -41.5)), new THREE.Vector3(9.8, 0, -50.1));
  if (tree.length) instanceParts(c.root, ownMaterials(tree, c.stage), treeRing(model), 'pocket tree', false);
}

const RING_TREES = false;

function ownMaterials(parts: CutPart[], stage: DressContext['stage']): CutPart[] {
  const made = new Map<THREE.Material, THREE.Material>();
  return parts.map(part => {
    let material = made.get(part.material);
    if (!material) {
      material = lookStageMaterial((part.material as THREE.MeshStandardMaterial).clone(), stage, 'pocket tree');
      optOutOfCutaway(material);
      made.set(part.material, material);
    }
    return { geometry: part.geometry, material };
  });
}

function lowCover(kit: DressContext['kit']) {
  const rng = seeded(1313), seats = spawnSeats('chunin-final');
  const clear = (x: number, z: number) => Math.abs(x) < BOUND - 1.5 && Math.abs(z) < BOUND - 1.5 && seats.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 3.2) && Math.hypot(x, z) > 7;
  for (let drift = 0; drift < 9; drift++) {
    const a = rng() * Math.PI * 2, r = 12 + Math.sqrt(rng()) * 33;
    const cx = Math.sin(a) * r, cz = Math.cos(a) * r;
    for (let k = 0, n = 2 + Math.floor(rng() * 3); k < n; k++) {
      const x = cx + (rng() - .5) * 5, z = cz + (rng() - .5) * 5;
      if (!clear(x, z)) continue;
      const pick = rng();
      if (pick < .4) kit.place('br/flowers-a', { x, z, rot: rng() * 6.3, scale: .8 + rng() * .3 });
      else if (pick < .7) kit.place('br/flowers-b', { x, z, rot: rng() * 6.3, scale: .9 + rng() * .3 });
      else if (pick < .9) kit.place('asian/bush', { x, z, rot: rng() * 6.3, scale: .65 + rng() * .2, sy: .9 });
      else kit.place('br/stone-b', { x, z, rot: rng() * 6.3, scale: .6 + rng() * .5, tint: 0xd0c0a8 });
    }
  }
}

function pocket(c: DressContext, kit: DressContext['kit']) {
  const rng = seeded(1414);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + rng() * .12;
    const r = WALL - 1.2 - rng() * 1.2;
    const piece = (['br/rock-a', 'br/rock-b', 'br/rock-c', 'br/rock-formation-b'] as const)[i % 4];
    if (i % 3 === 2) continue;
    const scale = .6 + rng() * .35, height = kit.size(piece).y * scale;
    kit.place(piece, { x: Math.sin(a) * r, z: Math.cos(a) * r, y: -height * (.35 + rng() * .2), rot: a + rng() * .8, scale, tint: 0xb89c80 });
  }
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2, r = 50 + rng() * 25;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (Math.max(Math.abs(x), Math.abs(z)) < BOUND + 1.5 || r > WALL - 2) continue;
    kit.place('asian/bush', { x, z, rot: rng() * 6.3, scale: 2.4 + rng() * 2 });
  }
}

export const CHUNIN_OWN_TREES: readonly (readonly [number, number])[] = [[-41.5, 33.9], [-52.5, 13.7], [33.7, 33.2], [54.3, -3.2], [9.5, -50], [-9.4, 50.5], [-41.2, -40.6], [36, -42.7]];

export function treeRing(_model?: THREE.Object3D) {
  const rng = seeded(1515);
  const own = CHUNIN_OWN_TREES;
  const spots: { x: number; z: number; rot: number; scale: number }[] = [];
  const free = (x: number, z: number, gap: number) => own.every(([ox, oz]) => Math.hypot(x - ox, z - oz) > 10) && spots.every(s => Math.hypot(x - s.x, z - s.z) > gap);
  for (let g = 0; g < 16; g++) {
    if (g % 4 === 3) continue;
    const a0 = g / 16 * Math.PI * 2 + rng() * .1;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (rng() - .5) * .34, outer = false;
      const s = Math.sin(a), co = Math.cos(a), edge = (BOUND + 1.8) / Math.max(Math.abs(s), Math.abs(co));
      const r = outer ? Math.max(edge + 8, 60 + rng() * 10) : Math.max(edge, 50 + rng() * 8);
      const fits = (WALL - .5 - r) / (7.2 * .8);
      const scale = Math.min(.72 + rng() * .3, fits);
      if (scale < .5) continue;
      const x = s * r, z = co * r;
      if (!free(x, z, outer ? 10 : 7.5)) continue;
      spots.push({ x, z, rot: rng() * Math.PI * 2, scale });
    }
  }
  return spots;
}

function bannerAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const g = canvas.getContext('2d')!;
  const banners: [string, string, string][] = [['木', '#2d5a2c', '#f4e7c4'], ['砂', '#b8763a', '#2a1c12'], ['霧', '#3a5a7a', '#eaf2f6'], ['雲', '#e8e2d2', '#7a1e1a']];
  banners.forEach(([glyph, cloth, ink], i) => {
    const x = i * 256;
    g.fillStyle = cloth; g.fillRect(x, 0, 256, 512);
    g.strokeStyle = ink; g.lineWidth = 10; g.strokeRect(x + 16, 16, 224, 480);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 170px serif'; g.fillText(glyph, x + 128, 230);
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(x, 512); g.lineTo(x + 128, 440); g.lineTo(x + 256, 512); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}
