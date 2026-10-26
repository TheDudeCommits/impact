import * as THREE from 'three';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from './dressing';
import { leafGreen, ModelProbe, placeProps, stageMaterial, stoneShapes } from './build';
import { seeded } from './ambient';
import { heroAir, mountainRidges } from './hero';

export async function dressValleyOfTheEnd(c: DressContext) {
  const { kit, ambient, model } = c;
  await Promise.all([
    c.sky({ rotation: 0, drift: .0006 }),
    kit.load(['asian/sakura', 'asian/bush', 'asian/ivy', 'br/reeds', 'br/lilies', 'br/grass', 'br/rock-a', 'br/rock-b', 'br/rock-c', 'br/rock-d',
      'br/stone-a', 'br/stone-b', 'br/podest', 'br/kunai', 'br/shuriken', STATUE.madara, STATUE.hashirama]),
  ]);
  kit.grade = (material, piece) => {
    if (piece === 'asian/sakura' && /Sakura/.test(material.name)) leafGreen(material, [0x1e3a16, 0x8cbc4a]);
    if (piece === 'asian/bush') material.color.multiplyScalar(1.15);
  };

  model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const s = m as THREE.MeshStandardMaterial;
      if (!/^Material\.0(01|10|16)$/.test(s.name)) o.visible = false;
      if (/^Material\.016$/.test(s.name)) { s.emissiveIntensity = .22; s.color.multiplyScalar(.78); }
      if (/^Material\.010$/.test(s.name)) ambient.flowWater(s, [.004, -.07], .18);
    }
  });
  ambient.waterfall({ x: -2.6, y: 13.8, z: -85.6, width: 23, height: 28, color: 0x94b8d6, speed: .5 });
  ambient.waterfall({ x: -2.6, y: 13.6, z: -86.4, width: 20, height: 27.5, color: 0xaccbe6, speed: .72, curve: .6 });
  const mist: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 22; i++) mist.push({ x: -2.6 + (i % 7 - 3) * 3.4, y: 1 + (i % 3) * 1.5, z: -82 + (i % 4) * 1.8, size: 7 + (i % 5) * 1.6 });
  ambient.puffs({ spots: mist, color: 0xfff2ea, shade: 0xc6b6c8, opacity: .32, life: 7, rise: 9, drift: [0, 0, 1.4], grow: 2, seed: 21 });
  ambient.motes({ min: [-15, 0, -88], max: [10, 9, -74], count: 220, velocity: [0, 1.6, 1.1], size: .06, color: 0xffffff, color2: 0xffe8d0, opacity: .7, wobble: .5, seed: 22 });
  const cascades: { x: number; y: number; z: number; size: number }[] = [];
  const faceProbe = new ModelProbe(model, m => !/Material\.0(10|16)/.test((Array.isArray(m.material) ? m.material[0] : m.material).name));
  for (const [side, z, width] of [[1, 6, 3.6]] as const) {
    const hit = faceProbe.hit(new THREE.Vector3(0, 14, z), new THREE.Vector3(side, 0, 0), 60);
    if (!hit?.face) continue;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    ambient.waterfall({ x: hit.point.x + n.x * .6, y: 14, z: hit.point.z + n.z * .6, width, height: 28, rot: Math.atan2(n.x, n.z), color: 0xc8e2f6, speed: .6, curve: .4 });
    for (let i = 0; i < 4; i++) cascades.push({ x: hit.point.x + n.x * 2.5, y: .8, z: hit.point.z + (i - 1.5) * 1.6, size: 4 + i });
  }
  ambient.puffs({ spots: cascades, color: 0xfff4ee, shade: 0xc8bccc, opacity: .26, life: 6, rise: 5, drift: [0, 0, .6], grow: 1.8, seed: 23 });
  ambient.foam({ y: .05, opacity: .85, spots: [
    { x: -2.6, z: -83, radius: 13 }, { x: -16, z: -82, radius: 6 }, { x: 11, z: -82, radius: 6 },
    { x: -6, z: -21.75, radius: 3.6 }, { x: 6.9, z: -9, radius: 3 }, { x: -8, z: 8, radius: 3.6 }, { x: 6.1, z: 22.1, radius: 3.4 },
    { x: 13.5, z: 37, radius: 2.8 }, { x: -13.6, z: -36.9, radius: 2.8 }, { x: 12.5, z: -31, radius: 2.4 }, { x: -12.5, z: 30, radius: 2.6 },
    { x: .2, z: -27, radius: 4.4 }, { x: -4, z: 15.8, radius: 4.4 }, { x: -9, z: -2, radius: 1.8 }, { x: 11, z: 3, radius: 2.4 }, { x: -2, z: -40, radius: 2.8 }, { x: 9, z: 31, radius: 3.2 },
  ] });

  const probe = new ModelProbe(model, m => !/Material\.0(10|16)/.test((Array.isArray(m.material) ? m.material[0] : m.material).name));
  const rng = seeded(4404);
  for (const side of [-1, 1]) {
    let trees = 0;
    for (let z = -96; z < 150; z += 5.5 + rng() * 3.5) {
      let x = 0, y: number | undefined;
      for (let out = 19; out < 46; out += 1.5) { const top = probe.top(side * out, z); if (top !== undefined && top > 20) { x = side * (out + .6 + rng() * 1.5); y = probe.top(x, z) ?? top; break; } }
      if (y === undefined) continue;
      kit.place('asian/bush', { x, z, y: y - .3, rot: rng() * 6.3, scale: 2.6 + rng() * 2.4 });
      if (rng() < .25) kit.place('asian/bush', { x: x + side * (2.5 + rng() * 3), z: z + rng() * 2, y: y - .3, rot: rng() * 6.3, scale: 3 + rng() * 2 });
      const framed = z < -40 || Math.abs(z) < 30;
      if (framed && trees < 6 && rng() < .55) { trees++; kit.place('asian/sakura', { x: x + side * (3 + rng() * 4), z, y: y - .6, rot: rng() * 6.3, scale: 1.05 + rng() * .5 }); }
    }
    for (let z = -70; z < 120; z += 6 + rng() * 7) {
      const h = 6 + rng() * 18;
      const hit = probe.hit(new THREE.Vector3(0, h, z), new THREE.Vector3(side, 0, 0), 60);
      if (!hit?.face) continue;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      kit.place('asian/ivy', { x: hit.point.x + n.x * .3, z: hit.point.z + n.z * .3, y: h - 4, rot: Math.atan2(n.x, n.z), scale: 3.4 + rng() * 2.2 });
    }
    for (let z = -74; z < 110; z += 3 + rng() * 5) {
      const x = side * (18.6 + rng() * 2.4);
      const pick = rng();
      if (pick < .45) { if (rng() < .45) kit.place('br/reeds', { x: x + side * 1.5, z, rot: rng() * 6.3, scale: .4 + rng() * .3 }); }
      else if (pick < .7) kit.place('br/rock-d', { x: x + side, z, rot: rng() * 6.3, scale: .7 + rng() * .9, tint: 0xa88a72 });
      else if (pick < .85) kit.place('br/stone-a', { x, z, rot: rng() * 6.3, scale: 1 + rng(), tint: 0xa88a72 });
      else kit.place('asian/bush', { x: x + side * .8, z, rot: rng() * 6.3, scale: 2 + rng() * 1.5 });
    }
  }
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    kit.place('br/lilies', { x: side * (14 + rng() * 3.5), z: -40 + rng() * 85, y: -.05, rot: rng() * 6.3, scale: .7 + rng() * .5 });
  }
  for (const [piece, x, z, scale, rot] of [['br/rock-a', -24, -70, .9, .4], ['br/rock-b', 19, -66, .8, 1.2], ['br/rock-c', -21, 58, .9, 2.1],
    ['br/rock-b', 22, 74, .9, .3], ['br/rock-a', 20, -52, .5, 2.6], ['br/rock-c', -22, -50, .6, .9]] as const)
    kit.place(piece, { x, z, scale, rot, tint: 0xa88a72 });

  const props = STAGE_PROPS['valley-of-the-end'] ?? [];
  placeProps(kit, props);
  const statueStone = (findMap(model, /^Material\.002$/));
  const stone = stoneShapes(props, stageMaterial(c.stage, 'Valley plinth stone', { map: statueStone, color: 0xe8dccb, roughness: .95 }), 2.6);
  if (stone) c.root.add(stone);
  const blades: [string, number, number, number, number, number][] = [
    ['br/kunai', -5.2, -21.2, 2.2, .5, 1.7], ['br/kunai', -6.6, -20.6, 2.5, -.4, 1.6], ['br/kunai', 6.3, -8.3, 1.9, .3, 1.5],
    ['br/kunai', 1.5, -26.6, 1.15, .2, 1.4], ['br/shuriken', -7.3, 8.8, 2.4, 1.2, 0], ['br/shuriken', 5.4, 22.6, 2.2, .6, 0], ['br/kunai', -12.1, 30.5, 1.6, .5, 1.5],
  ];
  for (const [piece, x, z, y, rot, tilt] of blades) kit.place(piece, { x, z, y, rot, tilt: piece === 'br/kunai' ? Math.PI + tilt * .3 : Math.PI / 2, scale: 2.4 });

  kit.place(STATUE.madara, { x: -16.5, z: -82, y: -1.2, rot: Math.PI / 2 - .5, height: 36 });
  kit.place(STATUE.hashirama, { x: 11.5, z: -82, y: -1.2, rot: -Math.PI / 2 + .5, height: 36 });
  for (const piece of [STATUE.madara, STATUE.hashirama]) {
    const m = kit.material(piece, /./) as THREE.MeshStandardMaterial;
    heroAir(m, .3);
    if (m.map) { m.emissive.setHex(0xffd8b8); m.emissiveMap = m.map; m.emissiveIntensity = .42; }
  }

  kit.shadows.add('br/rock-b').add('br/rock-c').add('br/podest');
  kit.flush('valley-of-the-end');

  c.root.add(mountainRidges({ radius: 420, count: 22, seed: 57, base: 6, height: [70, 130], far: 0x6c5a8e, near: 0x44385e, crest: 0xf2a86e }));
  ambient.birds({ centre: [0, 0, -20], count: 10, radius: 26, height: 9, spread: 8, speed: 13, size: .32, color: 0x1a1418, seed: 31 });
  ambient.birds({ centre: [0, 0, -60], count: 16, radius: 60, height: 52, spread: 14, speed: 8, size: .7, color: 0x22181c, seed: 32 });
  ambient.motes({ min: [-20, 1, -60], max: [20, 16, 60], count: 120, velocity: [.6, -.35, 1.1], size: .09, color: 0x8aa04c, color2: 0xd8803a, opacity: .85, wobble: 1.2, seed: 33 });
}

const STATUE = { madara: '/assets/environment/br/valley-madara.glb', hashirama: '/assets/environment/br/valley-hashirama.glb' } as const;

function findMap(model: THREE.Object3D, name: RegExp) {
  let map: THREE.Texture | null = null;
  model.traverse(o => {
    if (map || !(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (name.test(m.name) && (m as THREE.MeshStandardMaterial).map) { map = (m as THREE.MeshStandardMaterial).map; return; }
  });
  return map;
}
