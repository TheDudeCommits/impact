import * as THREE from 'three';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from './dressing';
import { cutPiece, instanceParts, placeProps } from './build';
import { seeded } from './ambient';
import { heroAir, horizonClouds } from './hero';
import { cypressRows, rimCurb, rimLampSpots } from './kamiRim';

export async function dressKamiLookout(c: DressContext) {
  const { kit, ambient, model } = c;
  await Promise.all([
    c.sky({ rotation: 0, drift: .0008 }),
    kit.load(['br/tree-place', 'br/flowers-a', 'br/flowers-b', 'br/grass', 'asian/bush', 'br/pot']),
  ]);

  const palm = cutPiece(model, /^Tex_004[0-4]_0_Mat$/, new THREE.Box3(new THREE.Vector3(-16, -1, 29), new THREE.Vector3(-4, 16, 51)), new THREE.Vector3(-10.25, 0, 34.75));
  const palms: { x: number; z: number; y?: number; rot?: number; scale?: number }[] = [];
  const props = STAGE_PROPS['kami-lookout'] ?? [];
  placeProps(kit, props);
  const lampSpots = props.filter(p => p.piece === 'none' && p.solid !== true && p.solid?.halfY === .8);
  for (const p of props) if (p.piece === 'none' && !lampSpots.includes(p) && !(p.solid !== true && p.solid?.halfY === 8)) palms.push({ x: p.x, z: p.z, y: p.z === 36 ? .9 : .3, rot: p.rot, scale: p.z === 36 ? .75 : .9 });
  const lamp = cutPiece(model, /./, new THREE.Box3(new THREE.Vector3(20.3, .05, -20.9), new THREE.Vector3(23.7, 20, -17.6)), new THREE.Vector3(22, 0, -19.25));
  if (lamp.length) instanceParts(c.root, lamp, lampSpots.map(p => ({ x: p.x, z: p.z })), 'lamp post', true);
  if (lamp.length) instanceParts(c.root, lamp, rimLampSpots(), 'rim lamp post', false);
  const rng = seeded(707);
  for (const p of props) if (p.piece === 'br/tree-place') bed(p.x, p.z, 2.7);
  function bed(x: number, z: number, radius: number, count = 9) {
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
      const pick = rng();
      kit.place(pick < .4 ? 'br/flowers-a' : pick < .75 ? 'br/flowers-b' : 'br/grass', { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, y: .38, rot: rng() * 6.3, scale: 1.3 + rng() * .7 });
    }
  }

  cypressRows(c);
  rimCurb(c);
  kit.shadows.add('br/pot').add('br/tree-place');
  kit.flush('kami-lookout');
  if (palm.length) {
    for (const part of palm) { const m = part.material as THREE.MeshStandardMaterial; if (m.color && !m.userData.kamiLifted) { m.color.multiplyScalar(1.35); m.userData.kamiLifted = true; } }
    instanceParts(c.root, palm, palms, 'palm', true);
  }

  const clouds: { x: number; y: number; z: number; size: number }[] = [];
  const cr = seeded(88);
  for (let i = 0; i < 24; i++) {
    const a = cr() * Math.PI * 2, r = 80 + cr() * 240;
    clouds.push({ x: Math.sin(a) * r, y: -46 - cr() * 22 - r * .04, z: Math.cos(a) * r, size: 34 + cr() * 34 });
  }
  for (let i = 0; i < 4; i++) {
    const a = cr() * Math.PI * 2, r = 160 + cr() * 140;
    clouds.push({ x: Math.sin(a) * r, y: 6 + cr() * 30, z: Math.cos(a) * r, size: 50 + cr() * 50 });
  }
  ambient.puffs({ spots: clouds, color: 0xffffff, shade: 0xb4c0e6, opacity: .9, life: 0, drift: [1.2, 0, .4], seed: 41, order: 0 });
  const under: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 6; i++) { const a = cr() * Math.PI * 2, r = 20 + cr() * 50; under.push({ x: Math.sin(a) * r, y: -84 - cr() * 20, z: Math.cos(a) * r, size: 40 + cr() * 30 }); }
  ambient.puffs({ spots: under, color: 0xf4f8ff, shade: 0xa8b4dc, opacity: .85, life: 0, drift: [2, 0, .8], seed: 42, order: 0 });
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (/^(partedefora|partefora|parteforabola|foragold|foraroxo|escada)/.test(m.name)) heroAir(m, .22);
  });
  c.root.add(horizonClouds({ radius: 430, count: 18, seed: 47, base: -36, size: [140, 240] }));
  const horizon: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + cr() * .2, r = 160 + cr() * 420; horizon.push({ x: Math.sin(a) * r, y: -30 - cr() * 12, z: Math.cos(a) * r, size: 70 + cr() * 60 }); }
  const carpet = ambient.puffs({ spots: horizon, color: 0xffffff, shade: 0xb4c0e6, opacity: .95, life: 0, drift: [1, 0, .3], seed: 49, order: 0 });
  heroAir(carpet.material as THREE.Material, .4);
  ambient.birds({ centre: [0, 0, -20], count: 12, radius: 34, height: 30, spread: 10, speed: 7, size: .45, color: 0xf6f6fa, seed: 43 });
  ambient.motes({ min: [-38, .5, -38], max: [38, 9, 38], count: 100, velocity: [.7, -.15, .4], size: .07, color: 0xffd8e8, color2: 0xfff6c8, opacity: .85, wobble: 1, seed: 44 });
}
