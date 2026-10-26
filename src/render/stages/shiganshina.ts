import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from './dressing';
import { placeProps, roundedRect, stageMaterial, street, wallBand, wearGround } from './build';
import { seeded } from './ambient';
import { addMesh, awningAtlas, awnings, beams, canvasAtlas, flutter, hangingCloth, nearMaterial, nearShare, ropes, scatterWear, thin, wearDecals,
  type Awning, type Beam, type Hang, type Line } from './near';

export async function dressShiganshina(c: DressContext) {
  const { kit, ambient, root, model, stage } = c;
  const houses = ['br/house-a', 'br/house-b', 'br/house-c'];
  await Promise.all([
    c.sky({ rotation: .6, drift: .0008 }),
    kit.load([...houses, 'br/rock-a', 'br/rock-b', 'br/rock-c', 'br/rock-d', 'br/rock-formation-b', 'br/stone-a', 'br/stone-b',
      'br/cart', 'br/meshy-stall', 'br/meshy-well', 'br/meshy-rubble', 'br/kenney-town-lantern',
      'br/kenney-town-wall-broken', 'br/kenney-town-wall-wood-broken', 'br/kenney-town-cart-high', 'br/kenney-town-planks', 'br/kenney-town-poles',
      'br/kenney-town-wheel', 'br/kenney-town-rock-wide', 'br/kenney-town-rock-small', 'br/kenney-pirate-cannon',
      'harbor/crate', 'harbor/barrel', 'harbor/crate-bottles']),
  ]);
  kit.shadows.add('br/house-a').add('br/house-b').add('br/house-c');
  for (const p of ['harbor/crate', 'harbor/barrel', 'harbor/crate-bottles', 'br/cart', 'br/meshy-stall', 'br/meshy-well', 'br/meshy-rubble', 'br/rock-b', 'br/rock-c', 'br/rock-d', 'br/rock-formation-b', 'br/kenney-town-cart-high'])
    kit.shadows.add(p);

  const ground = findMaterial(model, /^Shiganshina_Cobbles$/) as THREE.MeshStandardMaterial | undefined;
  if (ground) {
    ground.color.setHex(0xd9cfc2); ground.roughness = .92;
    wearGround(ground, { key: 'shiganshina', scale: 1, light: [.7, 1.08], patch: 0x6e5a40, patchAmount: .55, damp: .3 });
  }

  const wallMap = (findMaterial(model, /^Material_2$/) as THREE.MeshStandardMaterial | undefined)?.map ?? null;
  const wallMaterial = stageMaterial(stage, 'District wall', { map: wallMap, color: wallMap ? 0xf4efe6 : 0xd8d0bc, roughness: .95 });
  const ring = roundedRect(-131, -97, 131, 112, 34, 7).filter(([x, z]) => !(z < -95 && Math.abs(x) < 117));
  const east = ring.findIndex(([x, z]) => x > 0 && z > -95), path: [number, number][] = [[118, -96.4], ...ring.slice(east), ...ring.slice(0, east), [-118, -96.4]];
  const wall = new THREE.Mesh(wallBand(path, { height: 52, tile: 14, inside: [0, 0], pilaster: 26, pilasterWidth: 6, depth: 2.4 }), wallMaterial);
  wall.name = 'District wall'; wall.receiveShadow = true;
  root.add(wall);
  const emblem = (findMaterial(model, /^Material_0$/) as THREE.MeshStandardMaterial | undefined)?.map ?? null;
  let k = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const [x0, z0] = path[i], [x1, z1] = path[i + 1], length = Math.hypot(x1 - x0, z1 - z0);
    for (let s = 6; s < length; s += 24) {
      const x = x0 + (x1 - x0) * s / length, z = z0 + (z1 - z0) * s / length;
      const inward = Math.atan2(-x, -z);
      kit.place('br/kenney-pirate-cannon', { x: x * .985, z: z * .985, y: 52, rot: inward + Math.PI, scale: 2.6 });
      if (emblem && k++ % 3 === 0) ambient.cloth(emblem, { x: x * .99, y: 50, z: z * .99, width: 7, height: 12, rot: inward, uv: [.05, 0, .95, 1], color: 0xe8e2d8, wind: .5 });
    }
  }
  if (emblem) for (const x of [-30, 30]) ambient.cloth(emblem, { x, y: 46, z: -95.2, width: 9, height: 15, uv: [.05, 0, .95, 1], color: 0xe8e2d8, wind: .45 });

  const wings = wingsBanner();
  for (const [x, z, rot] of [[-24, -39.8, 0], [27, -39.8, 0], [39.8, -18, -Math.PI / 2], [39.8, 21, -Math.PI / 2], [-39.8, 4, Math.PI / 2], [-14, 39.8, Math.PI], [22, 39.8, Math.PI]] as const)
    ambient.cloth(wings, { x, y: 8.6, z, width: 2.6, height: 5, rot, wind: .55 });

  const rng = seeded(1845);
  const tints = [0xffffff, 0xf2e6da, 0xe6ddd6, 0xfff4e6, 0xe0d4c8];
  const row = (from: [number, number], to: [number, number], facing: number, skip?: (x: number, z: number) => boolean, scale: [number, number] = [.92, 1.12]) =>
    street(kit, houses, from, to, facing, rng, { gap: [.2, 1.4], alley: 4, scale, tints, skip });
  const fronts: { x: number; z: number; facing: number }[] = [];
  const front = (facing: number, edge: (x: number, z: number) => [number, number]) => (x: number, z: number) => { fronts.push({ ...xz(edge(x, z)), facing }); return false; };
  const xz = ([x, z]: [number, number]) => ({ x, z });
  row([-38, -40], [-20, -40], 0, front(0, x => [x, -40])); row([20, -40], [38, -40], 0, front(0, x => [x, -40]));
  row([38, 40], [-38, 40], Math.PI, front(Math.PI, x => [x, 40])); row([40, -38], [40, 38], -Math.PI / 2, front(-Math.PI / 2, (_, z) => [40, z]));
  row([-40, 38], [-40, -38], Math.PI / 2, front(Math.PI / 2, (_, z) => [-40, z]));
  row([-20, -55], [-47, -55], Math.PI); row([47, -55], [20, -55], Math.PI);
  row([-47, 55], [47, 55], 0); row([55, 47], [55, -47], Math.PI / 2); row([-55, -47], [-55, 47], -Math.PI / 2);
  row([-20, -66], [-62, -66], 0, undefined, [1, 1.25]); row([62, -66], [20, -66], 0, undefined, [1, 1.25]);
  row([62, 66], [-62, 66], Math.PI, undefined, [1, 1.25]); row([66, -58], [66, 62], -Math.PI / 2, undefined, [1, 1.25]); row([-66, 62], [-66, -58], Math.PI / 2, undefined, [1, 1.25]);
  row([-86, -84], [-20, -84], 0, undefined, [1.1, 1.3]); row([20, -84], [86, -84], 0, undefined, [1.1, 1.3]);
  row([86, 90], [-86, 90], Math.PI, undefined, [1.1, 1.35]); row([92, -76], [92, 86], -Math.PI / 2, undefined, [1.1, 1.35]); row([-92, 86], [-92, -76], Math.PI / 2, undefined, [1.1, 1.35]);
  street(kit, houses, [11, -41], [11, -70], -Math.PI / 2, rng, { gap: [.3, 1], scale: [.95, 1.15], tints, alley: 3 });
  street(kit, houses, [-11, -70], [-11, -41], Math.PI / 2, rng, { gap: [.3, 1], scale: [.95, 1.15], tints, alley: 3 });

  const crushed: [string, number, number, number, number, number][] = [
    ['br/house-c', -17, -79, Math.PI / 2 + .3, .3, 2.5], ['br/house-b', 17, -82, -Math.PI / 2 - .4, -.28, 2.2], ['br/house-a', -15, -91, .2, .45, 3.2],
  ];
  for (const [piece, x, z, rot, roll, sink] of crushed) kit.place(piece, { x, z, y: -sink, rot, roll, tilt: roll * .4, tint: 0x9a8f86 });
  const boulders: [string, number, number, number, number][] = [
    ['br/rock-b', -3, -62, 1.1, .3], ['br/rock-c', 5, -72, .9, 1.2], ['br/rock-a', -6, -79, .55, 1.9], ['br/rock-b', 7, -88, .8, 2.4],
    ['br/rock-c', 16, -66, .5, .7], ['br/rock-d', -14, -60, 1.4, 2], ['br/rock-formation-b', 0, -50, .6, 2.8], ['br/rock-d', 22, -48, 1.2, .2],
  ];
  for (const [piece, x, z, scale, rot] of boulders) kit.place(piece, { x, z, scale, rot, tint: 0xb4aa9c, tilt: rot * .15 });
  for (const [x, z, s, rot] of [[-6, -58, 1.1, .4], [6, -67, 1.3, 2.2], [-4, -76, 1.2, 1.1], [8, -84, 1.4, 3.3], [-16, -66, .9, 4.4], [17, -60, 1, 5.1], [0, -92, 1.6, .8]] as const)
    kit.place('br/meshy-rubble', { x, z, scale: s, rot });
  const rubble = seeded(77);
  for (let i = 0; i < 70; i++) {
    const z = -40 - rubble() * 55, x = (rubble() - .5) * (18 + (z + 40) * -.2);
    const pick = rubble();
    if (pick < .45) kit.place(rubble() < .5 ? 'br/stone-a' : 'br/stone-b', { x, z, scale: .6 + rubble() * 1.2, rot: rubble() * 6.3, tint: 0xbab0a2 });
    else if (pick < .7) kit.place('br/kenney-town-rock-small', { x, z, scale: .8 + rubble() * 1.2, rot: rubble() * 6.3, tint: 0xd0c6b6 });
    else if (pick < .85) kit.place('br/kenney-town-planks', { x, z, y: .02, scale: 1.6 + rubble(), rot: rubble() * 6.3, tilt: (rubble() - .5) * .3 });
    else kit.place('br/kenney-town-poles', { x, z, y: .1, scale: 2.4, rot: rubble() * 6.3, roll: Math.PI / 2 });
  }
  for (const [x, z, s] of [[-9, -27, .5], [3, -31, .4], [14, -26, .55], [-15, -18, .35], [25, -8, .45], [-4, -29, .3], [8, -21, .4]] as const)
    kit.place('br/stone-a', { x, z, scale: s, rot: x, tint: 0xbab0a2 });

  placeProps(kit, STAGE_PROPS.shiganshina ?? []);
  for (const [x, z, rot] of [[-30, 18.6, .3], [-23.4, 31.6, 1.2], [28.4, 15.2, 2]] as const) kit.place('br/kenney-town-wheel', { x, z, rot, scale: 2.2, roll: Math.PI / 2 - .2, y: .1 });

  await dressNear(c, fronts, wings);
  kit.flush('shiganshina');

  ambient.fire([
    { x: -16, y: 3.5, z: -78, size: 4.2, smoke: .9, seed: .2 }, { x: 17, y: 3, z: -81, size: 3.6, smoke: .8, seed: .5 },
    { x: -14, y: 2.5, z: -90, size: 4.8, smoke: 1, seed: .8 }, { x: -48, y: 9, z: -60, size: 3, smoke: .7, seed: .35 },
    { x: 52, y: 10, z: -70, size: 3.2, smoke: .7, seed: .65 },
  ]);
  const columns: { x: number; y: number; z: number; size: number }[] = [];
  for (const [x, z, h] of [[-16, -78, 6], [17, -81, 6], [-14, -90, 5], [-48, -60, 12], [52, -70, 13], [-90, -20, 12], [84, 40, 11]] as const)
    for (let i = 0; i < 7; i++) columns.push({ x: x + Math.sin(i * 2.1) * 1.5, y: h + i * 1.2, z: z + Math.cos(i * 1.3) * 1.5, size: 6 + i * 1.1 });
  ambient.puffs({ spots: columns, color: 0x5d5752, shade: 0x2a2624, opacity: .55, life: 14, rise: 34, drift: [1.6, 0, .6], grow: 2.6, seed: 5 });
  const steam: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 14; i++) { const side = i % 2 ? 1 : -1; steam.push({ x: -15 + side * (11 + (i % 5) * 4), y: 44 + (i % 3) * 4, z: -126 - (i % 4) * 2, size: 10 + (i % 3) * 4 }); }
  ambient.puffs({ spots: steam, color: 0xf6f2ee, shade: 0xb8b0ac, opacity: .4, life: 11, rise: 24, drift: [0, 0, -.6], grow: 2.2, seed: 9 });
  ambient.motes({ min: [-40, 0, -100], max: [40, 14, 40], count: 260, velocity: [.6, .15, .9], size: .07, color: 0xd6c8b0, color2: 0xf2e8d6, opacity: .55, wobble: .6, seed: 3 });
  ambient.birds({ centre: [0, 0, -30], count: 14, radius: 70, height: 58, spread: 18, speed: 9, size: .8, color: 0x141216, seed: 4 });
  ambient.birds({ centre: [40, 0, 50], count: 8, radius: 40, height: 42, spread: 10, speed: 8, size: .7, color: 0x141216, seed: 8 });
}

async function dressNear(c: DressContext, fronts: readonly { x: number; z: number; facing: number }[], wings: THREE.Texture) {
  const { kit, ambient, stage } = c;
  const share = nearShare();
  const rng = seeded(2013);
  const props = STAGE_PROPS.shiganshina ?? [];

  const wood = (kit.material('br/cart', /Wood/) as THREE.MeshStandardMaterial);
  const timber = nearMaterial(c, 'Near timber', { map: wood.map, normalMap: wood.normalMap, color: 0xb59a86, roughness: .95 });
  const parts: Beam[] = [];
  const masts = props.filter(p => p.draw === 'mast');
  for (const m of masts) {
    const facing = Math.atan2(-m.x, -m.z);
    const sx = Math.cos(facing), sz = -Math.sin(facing);
    parts.push({ a: [m.x, -.2, m.z], b: [m.x, 11.4, m.z], w: .34 });
    parts.push({ a: [m.x - sx * 1.5, 10.7, m.z - sz * 1.5], b: [m.x + sx * 1.5, 10.7, m.z + sz * 1.5], w: .16 });
  }
  for (const b of props.filter(p => p.draw === 'barricade')) {
    const length = b.length ?? 5, yaw = b.rot ?? 0;
    const ax = Math.cos(yaw), az = -Math.sin(yaw), nx = Math.sin(yaw), nz = Math.cos(yaw);
    parts.push({ a: [b.x - ax * length / 2, .72, b.z - az * length / 2], b: [b.x + ax * length / 2, .72, b.z + az * length / 2], w: .3 });
    for (let s = -length / 2 + .35; s <= length / 2 - .3; s += .82) {
      const x = b.x + ax * s, z = b.z + az * s, lean = (rng() - .5) * .12;
      parts.push({ a: [x - nx * .62 + ax * lean, .02, z - nz * .62 + az * lean], b: [x + nx * .62, 1.55, z + nz * .62], w: .12 });
      parts.push({ a: [x + nx * .62 - ax * lean, .02, z + nz * .62 - az * lean], b: [x - nx * .62, 1.55, z - nz * .62], w: .12 });
    }
    for (const s of [-1.6, .3, 1.7]) parts.push({ a: [b.x + ax * s + nx * 1.3, .02, b.z + az * s + nz * 1.3], b: [b.x + ax * (s + .2) + nx * .35, 1.35, b.z + az * (s + .2) + nz * .35], w: .32, d: .05 });
  }
  const slabs: THREE.BufferGeometry[] = [];
  for (const t of props.filter(p => p.draw === 'tower')) {
    const h = 1.4, top = 8.2, deck = 6.2;
    const corners = [[-h, -h], [h, -h], [h, h], [-h, h]] as const;
    for (const [dx, dz] of corners) parts.push({ a: [t.x + dx, -.1, t.z + dz], b: [t.x + dx * .9, top, t.z + dz * .9], w: .26 });
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4];
      for (const [y0, y1] of [[.4, 3.3], [3.3, deck]]) {
        parts.push({ a: [t.x + ax, y0, t.z + az], b: [t.x + bx, y1, t.z + bz], w: .12 });
        parts.push({ a: [t.x + bx, y0, t.z + bz], b: [t.x + ax, y1, t.z + az], w: .12 });
      }
      parts.push({ a: [t.x + ax * .95, deck + 1, t.z + az * .95], b: [t.x + bx * .95, deck + 1, t.z + bz * .95], w: .1 });
    }
    slabs.push(new THREE.BoxGeometry(3.4, .16, 3.4).translate(t.x, deck, t.z));
    const roof = new THREE.ConeGeometry(2.7, 1.5, 4, 1, true).rotateY(Math.PI / 4).translate(t.x, top + .7, t.z);
    slabs.push(roof);
    parts.push({ a: [t.x, top + 1.3, t.z], b: [t.x, top + 3.4, t.z], w: .08 });
    ambient.cloth(wings, { x: t.x + .08, y: top + 3.3, z: t.z, width: 1.1, height: 1.8, rot: Math.PI / 2 + .4, wind: .55 });
  }
  const timberGeometry = beams(parts, 1.6);
  if (timberGeometry && slabs.length) {
    const flat = slabs.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; });
    addMesh(c, mergeGeometries([timberGeometry, ...flat]), timber, 'near timber', { shadow: true });
    slabs.forEach(g => g.dispose());
  } else addMesh(c, timberGeometry, timber, 'near timber', { shadow: true });

  const garrison = garrisonBanner();
  masts.forEach((m, i) => {
    const facing = Math.atan2(-m.x, -m.z);
    ambient.cloth(i < 2 ? wings : garrison, { x: m.x + Math.sin(facing) * .22, y: 10.62, z: m.z + Math.cos(facing) * .22, width: 2.6, height: 5.2, rot: facing, wind: .55 });
  });

  const canvas = awningAtlas([['#b8342c', '#efe6d2'], ['#2f5f8f', '#e8e2d2'], ['#3f6f4a', '#e9dfc4'], ['#c9962f', '#5a3d26'], ['#7d2f45', '#e6d6c6'], ['#2d7f86', '#efe8da'], ['#a85a2a', '#f0e2c8'], ['#4b4f8a', '#dcd6c8']]);
  const list: Awning[] = [];
  for (const f of thin(fronts, share > .9 ? .62 : share > .5 ? .45 : .25)) {
    const width = 2.8 + rng() * 1.2;
    list.push({ x: f.x, z: f.z, y: 3.1 + rng() * .5, rot: f.facing, width, depth: 1.5 + rng() * .4, drop: .7, cell: Math.floor(rng() * 8), valance: .38 });
  }
  list.push({ x: 6.6, z: -9.45, y: 3.3, rot: 0, width: 3.6, depth: 1.8, drop: .8, cell: 1 }, { x: 11.2, z: -9.45, y: 3.3, rot: 0, width: 3, depth: 1.7, drop: .75, cell: 5 },
    { x: -12.45, z: 5.2, y: 3.2, rot: Math.PI / 2, width: 3.4, depth: 1.8, drop: .8, cell: 2 }, { x: -12.45, z: 10.8, y: 3.2, rot: Math.PI / 2, width: 3, depth: 1.7, drop: .75, cell: 3 },
    { x: 16, z: 27.45, y: 3.2, rot: Math.PI, width: 3.2, depth: 1.7, drop: .75, cell: 1 });
  addMesh(c, awnings(list, canvas.cols, canvas.rows), nearMaterial(c, 'Near awnings', { map: canvas.map, cloth: true, roughness: .95 }), 'near awnings', { shadow: true });

  const lines = washingLines(masts, props.filter(p => p.draw === 'tower'));
  const hangs: Hang[] = [];
  for (const line of lines) {
    const length = Math.hypot(line.b[0] - line.a[0], line.b[2] - line.a[2]);
    for (let s = 1.2 + rng(); s < length - 1; s += .9 + rng() * 1.1) {
      const cell = Math.floor(rng() * 16), kind = CLOTHES[cell];
      hangs.push({ line, t: s / length, width: kind[0] * (.9 + rng() * .2), height: kind[1] * (.9 + rng() * .2), cell });
    }
  }
  const rope = nearMaterial(c, 'Near rope', { color: 0x5b4a3a, roughness: 1 });
  addMesh(c, ropes(lines, { radius: .025 }), rope, 'near ropes');
  const clothes = flutter(nearMaterial(c, 'Near washing', { map: washingAtlas(), cloth: true }), ambient.time, .16);
  addMesh(c, hangingCloth(thin(hangs, share), 4, 4), clothes, 'near washing');

  const spot = (): [number, number] => {
    if (rng() < .62) { const a = rng() * Math.PI * 2, r = 4 + Math.sqrt(rng()) * 20; return [Math.sin(a) * r, Math.cos(a) * r]; }
    return [(rng() - .5) * 74, (rng() - .5) * 74 - (rng() < .4 ? 10 : 0)];
  };
  const decals = scatterWear(rng, {
    share, spot, floor: (x, z) => Math.abs(x) < 38.5 && Math.abs(z) < 38.5 ? 0 : undefined,
    kinds: {
      crack: { count: 40, size: [3, 6], opacity: [.75, 1] },
      crater: { count: 5, size: [4.5, 7], opacity: [.8, 1] },
      scorch: { count: 6, size: [2.5, 4.5], opacity: [.6, .85] },
      stain: { count: 26, size: [2, 4.5], tint: [0xffffff, 0xd8c8b0], opacity: [.5, .85] },
      dust: { count: 36, size: [4, 9], tint: [0xffffff, 0xe4e6ea, 0xf2e6d0], opacity: [.6, .95] },
      chips: { count: 40, size: [2, 3.5], tint: [0xc8bcaa, 0xb0a696, 0xd8cebe] },
      splinters: { count: 12, size: [1.5, 2.5] },
      scuff: { count: 12, size: [3, 5], opacity: [.55, .85] },
    },
  });
  await wearDecals(c, decals, 'near wear');
  const loose = (piece: string, n: number, scale: [number, number], tint?: number, o: { y?: number; roll?: number } = {}) => {
    for (let i = 0; i < Math.round(n * share); i++) {
      const a = rng() * Math.PI * 2, r = 5 + Math.sqrt(rng()) * 22, x = Math.sin(a) * r, z = Math.cos(a) * r - 3;
      kit.place(piece, { x, z, y: o.y, scale: scale[0] + rng() * (scale[1] - scale[0]), rot: rng() * 6.3, tint, roll: o.roll, tilt: (rng() - .5) * .25 });
    }
  };
  loose('br/stone-a', 14, [.25, .5], 0xbab0a2);
  loose('br/stone-b', 12, [.3, .6], 0xb4aa9c);
  loose('br/kenney-town-rock-small', 8, [.5, .9], 0xd0c6b6);
  loose('br/kenney-town-planks', 6, [1.1, 1.6], 0x7a6a60, { y: .02 });
}

export function washingLines(masts: readonly { x: number; z: number }[], towers: readonly { x: number; z: number }[] = []): Line[] {
  const mast = (i: number, y = 11.1): [number, number, number] => [masts[i].x, y, masts[i].z];
  return [
    { a: [17.6, 8.3, -9.6], b: [39.3, 8.6, -8.4], sag: .8 },
    { a: [17.6, 8.2, -15.4], b: [39.3, 8.5, -23], sag: .7 },
    { a: mast(2), b: [16, 8.6, 27.3], sag: 1.1 },
    { a: [-12.4, 8.3, 2.4], b: mast(0), sag: 1 },
    { a: [2.9, 8.2, -9.6], b: mast(0), sag: 1.1 },
    { a: mast(0), b: [-25, 8.6, -39.3], sag: 1 },
    { a: mast(1), b: [31, 8.6, -39.3], sag: 1 },
    { a: mast(1), b: [17.6, 8.4, -15.4], sag: .9 },
    { a: mast(3), b: [-39.3, 8.6, 12], sag: 1 },
    { a: [-12.4, 8.2, 13.6], b: mast(3), sag: .9 },
    { a: [-12.4, 8.2, 13.6], b: [-4, 8.6, 39.3], sag: 1 },
    ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ a: [sx * 31, 8.4, sz * 39.3], b: [sx * 39.3, 8.4, sz * 31], sag: .6 } as Line)),
    ...towers.flatMap(t => [
      { a: [t.x + 1.3, 8.6, t.z + 1.3], b: [2.9, 8.5, -15.4], sag: 1.1 },
      { a: [t.x - 1.3, 8.6, t.z + 1.3], b: mast(0, 10.8), sag: .8 },
    ] as Line[]),
  ];
}

const CLOTHES: readonly (readonly [number, number])[] = [
  [.7, .75], [.7, .75], [.7, .75], [.7, .75],
  [.48, 1], [.48, 1], [1.5, 1.3], [1.5, 1.3],
  [1.2, 1.1], [.8, .55], [.9, .8], [1.1, .9],
  [.5, .5], [.55, .8], [.7, 1.15], [1.4, 1.2],
];

function washingAtlas() {
  return canvasAtlas(4, 4, 128, (g, i, s) => {
    const shirt = (fill: string, trim: string) => {
      g.fillStyle = fill; g.beginPath();
      g.moveTo(s * .3, 2); g.lineTo(s * .7, 2); g.lineTo(s * .98, s * .22); g.lineTo(s * .86, s * .4); g.lineTo(s * .74, s * .32);
      g.lineTo(s * .76, s * .97); g.lineTo(s * .24, s * .97); g.lineTo(s * .26, s * .32); g.lineTo(s * .14, s * .4); g.lineTo(s * .02, s * .22); g.closePath(); g.fill();
      g.strokeStyle = trim; g.lineWidth = 3; g.beginPath(); g.moveTo(s * .42, 2); g.lineTo(s * .5, s * .16); g.lineTo(s * .58, 2); g.stroke();
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(s * .24, s * .6, s * .52, s * .37);
    };
    const trousers = (fill: string) => {
      g.fillStyle = fill; g.beginPath();
      g.moveTo(s * .12, 2); g.lineTo(s * .88, 2); g.lineTo(s * .92, s * .98); g.lineTo(s * .56, s * .98); g.lineTo(s * .5, s * .3);
      g.lineTo(s * .44, s * .98); g.lineTo(s * .08, s * .98); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(s * .12, 2, s * .76, s * .08);
    };
    const sheet = (fill: string, stripe?: string, hem = .96) => {
      g.fillStyle = fill; g.beginPath(); g.moveTo(0, 2); g.lineTo(s, 2);
      for (let k = 0; k <= 8; k++) g.lineTo(s * (1 - k / 8), s * (hem - .04 * ((k * 7) % 3) / 2));
      g.closePath(); g.fill();
      if (stripe) { g.fillStyle = stripe; for (let k = 0; k < 5; k++) g.fillRect(s * (.06 + k * .2), 2, s * .07, s * hem - 4); }
      g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, s * .5, s, s * .45);
    };
    const pegs = () => { g.fillStyle = '#6a5440'; for (const x of [.18, .82]) g.fillRect(s * x - 3, 0, 6, 10); };
    switch (i) {
      case 0: shirt('#efeae0', '#b8b0a2'); break;
      case 1: shirt('#e2d2b4', '#a89070'); break;
      case 2: shirt('#7f9fbf', '#4e6a88'); break;
      case 3: shirt('#a8483c', '#6a2a22'); break;
      case 4: trousers('#6b5240'); break;
      case 5: trousers('#3a4660'); break;
      case 6: sheet('#f2eee6'); break;
      case 7: sheet('#eef0ee', '#5f86b0'); break;
      case 8: sheet('#3f6b4a', undefined, .9); g.fillStyle = '#e8e4da'; g.beginPath(); g.arc(s * .5, s * .45, s * .12, 0, Math.PI * 2); g.fill(); break;
      case 9: sheet('#c99a4a', '#e0c070', .7); break;
      case 10: sheet('#a39a86', undefined, .9); break;
      case 11: sheet('#e6dccb', '#b03a30'); break;
      case 12: g.fillStyle = '#d8d0c0'; g.fillRect(s * .15, 2, s * .25, s * .9); g.fillRect(s * .55, 2, s * .25, s * .8); break;
      case 13: g.fillStyle = '#f0ece2'; g.fillRect(s * .2, 2, s * .6, s * .95); g.fillStyle = '#c8bfae'; g.fillRect(s * .2, s * .3, s * .6, 5); break;
      case 14: g.fillStyle = '#6e2c3a'; g.beginPath(); g.moveTo(s * .3, 2); g.lineTo(s * .7, 2); g.lineTo(s * .95, s * .98); g.lineTo(s * .05, s * .98); g.closePath(); g.fill(); break;
      default: sheet('#e8dca8'); break;
    }
    pegs();
  });
}

function garrisonBanner() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#7e1f22'; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = '#c9b67a'; g.lineWidth = 8; g.strokeRect(12, 12, 232, 488);
  const rose = (cx: number, cy: number, r: number, petal: string, edge: string) => {
    for (let ring = 0; ring < 3; ring++) {
      const rr = r * (1 - ring * .3), n = 5 + ring;
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + ring * .5;
        g.beginPath(); g.ellipse(cx + Math.cos(a) * rr * .45, cy + Math.sin(a) * rr * .45, rr * .42, rr * .3, a, 0, Math.PI * 2);
        g.fillStyle = petal; g.fill(); g.lineWidth = 3; g.strokeStyle = edge; g.stroke();
      }
    }
  };
  g.fillStyle = '#2f5a34';
  for (const [x, y, a] of [[92, 330, -.6], [164, 330, .6], [128, 360, 0]] as const) { g.beginPath(); g.ellipse(x, y, 34, 12, a, 0, Math.PI * 2); g.fill(); }
  rose(98, 236, 58, '#c8323a', '#6a1418');
  rose(158, 262, 58, '#f2ece2', '#8a8278');
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 512); g.lineTo(128, 444); g.lineTo(256, 512); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

function findMaterial(model: THREE.Object3D, name: RegExp) {
  let found: THREE.Material | undefined;
  model.traverse(o => {
    if (found || !(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (name.test(m.name)) { found = m; return; }
  });
  return found;
}

function wingsBanner() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#2c4a34'; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = '#c9b67a'; g.lineWidth = 8; g.strokeRect(12, 12, 232, 488);
  const wing = (dx: number, fill: string, edge: string) => {
    g.save(); g.translate(128 + dx, 250);
    for (let i = 0; i < 4; i++) {
      const len = 70 + i * 18, lift = -24 - i * 26;
      g.beginPath(); g.moveTo(-30, 40 - i * 8);
      g.quadraticCurveTo(-10 + i * 6, lift + 10, len - 40, lift);
      g.quadraticCurveTo(len - 52, lift + 26, -20, 52 - i * 6);
      g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 4; g.strokeStyle = edge; g.stroke();
    }
    g.restore();
  };
  wing(18, '#3b6fb6', '#1c3560');
  wing(-14, '#f4f2ea', '#5a5a5a');
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 512); g.lineTo(128, 444); g.lineTo(256, 512); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}
