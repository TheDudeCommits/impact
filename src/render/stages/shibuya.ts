import * as THREE from 'three';
import { KIT_SIZE, STAGE_PROPS, type KitPieceId } from '../../game/stageProps';
import { addShaderPatch } from '../look/shaderPatch';
import { lookStageMaterial } from '../look/stageMaterials';
import type { DressContext } from './dressing';
import { leafGreen, placeProps } from './build';
import { seeded } from './ambient';
import { nearShare, scatterWear, wearDecals, WEAR } from './near';
import { Beacons, LightPools } from './glow';

export async function dressShibuya(c: DressContext) {
  const { kit, ambient, model } = c;
  kit.grade = (material, piece) => {
    if (piece === 'asian/sakura' && /Sakura/.test(material.name)) leafGreen(material, [0x1a3424, 0x5e9a52]);
  };
  const [sky] = await Promise.all([
    c.sky({ rotation: 0, drift: .0003, exposure: 1 }),
    kit.load(['shibuya/bus', 'shibuya/taxi', 'shibuya/police-car', 'shibuya/sedan', 'shibuya/kei-truck', 'shibuya/van', 'shibuya/vending',
      'shibuya/hachiko', 'br/meshy-rubble', 'asian/sakura']),
  ]);
  model.updateMatrixWorld(true);
  c.root.add(curtain(ambient.time));
  const meshes = new Map<string, THREE.Mesh>(), materials = new Map<string, THREE.MeshStandardMaterial>();
  model.traverse(o => { if (o instanceof THREE.Mesh) { meshes.set(o.name, o); materials.set((o.material as THREE.Material).name, o.material as THREE.MeshStandardMaterial); } });
  const mat = (name: string) => materials.get(name);

  const glow: Record<string, number> = { Shibuya_Screens: 1.35, Shibuya_Signs: 1.4, Shibuya_Signs2: 1.0, Shibuya_Facade: .8, Shibuya_Hero: 1.2, Shibuya_Far: .9 };
  for (const [name, value] of Object.entries(glow)) { const m = mat(name); if (m) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = value; } }

  const time = ambient.time;
  const screens = mat('Shibuya_Screens');
  if (screens) cycleScreens(screens, time);
  const signs = mat('Shibuya_Signs');
  if (signs) flickerSigns(signs, time);

  const emitters = [
    ...(meshes.get('Shibuya_Screens') ? quads(meshes.get('Shibuya_Screens')!).map(q => ({ ...q, screen: true })) : []),
    ...(meshes.get('Shibuya_Signs') ? quads(meshes.get('Shibuya_Signs')!).filter(q => q.area > 6 && q.centre.length() < 75).sort((a, b) => b.area - a.area).slice(0, 12).map(q => ({ ...q, screen: false })) : []),
  ].slice(0, EMITTERS);
  const [screenCells, signColours] = await Promise.all([
    screens?.map ? cellColours(screens.map, 2, 4) : Promise.resolve([] as THREE.Color[]),
    signs?.map ? regionColours(signs.map, emitters.filter(e => !e.screen).map(e => e.uv)) : Promise.resolve([] as THREE.Color[]),
  ]);
  const wet = wetUniforms(emitters, sky.mesh.material.uniforms.uMap.value as THREE.Texture, time);
  let sign = 0;
  emitters.forEach((e, i) => { if (!e.screen) wet.uEmitCol.value[i].copy(signColours[sign++] ?? new THREE.Color(1, 1, 1)).multiplyScalar(2.2); });
  for (const [name, strength] of [['Shibuya_Asphalt', 1], ['Shibuya_Paint', .55], ['Shibuya_Paint_Yellow', .55], ['Shibuya_Brick', .45], ['Shibuya_Tiles', .5]] as const) {
    const m = mat(name);
    if (m) wetStreet(m, wet, strength);
  }
  const screenIndex = emitters.map(e => e.screen ? screenCell(e.uv) : -1);

  const props = STAGE_PROPS.shibuya ?? [];
  placeProps(kit, props);
  for (const p of props) {
    if (p.draw === 'hachiko') kit.place('shibuya/hachiko', { x: p.x, z: p.z, rot: -2.2 });
    if (p.draw === 'tree') kit.place('asian/sakura', { x: p.x, z: p.z, y: .25, rot: p.x * 1.7, scale: .68 + (Math.abs(p.z * 7.3) % 1) * .14 });
  }
  kit.shadows.add('shibuya/bus').add('shibuya/taxi').add('shibuya/police-car').add('shibuya/sedan').add('shibuya/kei-truck').add('shibuya/van')
    .add('shibuya/vending').add('shibuya/hachiko').add('br/meshy-rubble');
  kit.flush('shibuya');

  const lamps = heads(meshes.get('Shibuya_Landmarks'), LAMP_UV);
  const pools = new LightPools(c.root, lamps.length + emitters.length + 8);
  for (const at of lamps) pools.add(at.x, at.z, 8.5, new THREE.Color(0xffb46a).multiplyScalar(.34));
  pools.add(0, 0, 40, new THREE.Color(0x9fbce0).multiplyScalar(.11));
  pools.add(0, 0, 22, new THREE.Color(0xb8d0ee).multiplyScalar(.1));
  const screenPools: { index: number; slot: number }[] = [];
  emitters.forEach((e, i) => {
    if (!e.screen || e.centre.y > 32) return;
    const out = Math.min(14, e.centre.y * .8);
    const x = e.centre.x + e.normal.x * out, z = e.centre.z + e.normal.z * out;
    screenPools.push({ index: i, slot: pools.add(x, z, Math.max(10, e.halfWidth * 2.2), new THREE.Color(1, 1, 1)) });
  });
  const police = props.filter(p => p.piece === 'shibuya/police-car');
  const policeSlots = police.map(p => pools.add(p.x, p.z, 9, new THREE.Color(0, 0, 0)));
  pools.finish('shibuya:light pools');
  lampCones(c.root, lamps, time);

  const colour = new THREE.Color();
  ambient.onUpdate(t => {
    emitters.forEach((e, i) => {
      if (!e.screen) return;
      const cell = showing(screenIndex[i], t);
      colour.copy(screenCells[cell.now] ?? colour.setRGB(1, 1, 1)).lerp(screenCells[cell.next] ?? colour, cell.wipe).multiplyScalar(2.2);
      wet.uEmitCol.value[i].copy(colour);
    });
    for (const { index, slot } of screenPools) pools.colour(slot, colour.copy(wet.uEmitCol.value[index]).multiplyScalar(.045));
    policeSlots.forEach((slot, i) => {
      const phase = (t * 2.6 + i * .37) % 1;
      pools.colour(slot, colour.setRGB(phase < .5 ? .5 : .05, .02, phase < .5 ? .04 : .45));
    });
    pools.update();
  });

  const beacons = new Beacons(c.root, 64, time);
  police.forEach((car, i) => {
    const yaw = car.rot ?? 0, ax = Math.sin(yaw), az = Math.cos(yaw);
    for (const side of [-1, 1]) beacons.add(car.x + Math.cos(yaw) * .45 * side - ax * .2, 1.86, car.z - Math.sin(yaw) * .45 * side - az * .2, .9, side < 0 ? 0xff2020 : 0x2050ff, 2.6, (side < 0 ? 0 : .5) + i * .37, .5);
  });
  beacons.add(-18, 6.3, 31.2, .9, 0xff2a20, .6, 0, .9);
  for (const [i, p] of props.entries()) {
    if (!/^shibuya\/(taxi|sedan|van|kei-truck|bus)$/.test(p.piece) || p.roll) continue;
    const yaw = p.rot ?? 0, ax = Math.sin(yaw), az = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const [w, h, len] = KIT_SIZE[p.piece as KitPieceId];
    for (const end of [-1, 1]) for (const side of [-1, 1])
      beacons.add(p.x + ax * end * (len / 2 - .08) + rx * side * (w / 2 - .22), Math.min(.95, h * .5), p.z + az * end * (len / 2 - .08) + rz * side * (w / 2 - .22),
        end < 0 ? .5 : .55, end < 0 ? 0xff1a14 : 0xffa020, end < 0 ? 0 : 1.15, (i * .29) % 1, end < 0 ? 1 : .5);
    if (p.piece === 'shibuya/taxi') beacons.add(p.x, h + .12, p.z, .6, 0xfff0c0, 0, 0, 1);
  }
  for (const [x, y, z] of [[78, 236, 112], [178, 186, -18], [-128, 189, 182], [-72, 99, 112], [36.5, 56, -46]] as const) beacons.add(x, y, z, 3.2, 0xff2a1a, .55, (Math.abs(x) * 7.3) % 1, .35);
  for (const [x, y, z] of [[-64, 39.6, -62], [-32, 39.6, -62], [42, 47.6, -60], [31, 47.6, -31.5], [-62, 31.6, 58], [-4, 31.8, 77], [43, 31.8, 77], [-29, 27.6, -65]] as const)
    beacons.add(x, y, z, 1.4, 0xff2a1a, .9, (Math.abs(x * 3.1 + z) % 10) / 10, .3);
  beacons.finish('shibuya:beacons');

  const sedan = props.find(p => p.piece === 'shibuya/sedan' && p.roll === Math.PI), bus = props.find(p => p.piece === 'shibuya/bus');
  const pile = props.find(p => p.piece === 'shibuya/sedan' && p.y && p.roll !== Math.PI);
  const fires = [
    ...(sedan ? [{ x: sedan.x, y: .9, z: sedan.z, size: 1.9, smoke: 1, seed: .2 }, { x: sedan.x + .9, y: .5, z: sedan.z + 1.4, size: 1.2, smoke: .6, seed: .7 }] : []),
    ...(bus ? [{ x: bus.x - Math.sin(bus.rot ?? 0) * 4.6, y: 1.5, z: bus.z - Math.cos(bus.rot ?? 0) * 4.6, size: 1.6, smoke: 1, seed: .45 }] : []),
    { x: -3.5, y: .4, z: -29.5, size: .9, smoke: .5, seed: .9 },
    ...(pile ? [{ x: pile.x + .6, y: 1.9, z: pile.z - .4, size: .9, smoke: .7, seed: .33 }] : []),
  ];
  ambient.fire(fires);
  const smoke = fires.slice(0, 3).flatMap((f, i) => Array.from({ length: 6 }, (_, k) => ({ x: f.x + (k - 2.5) * .5, y: 3 + k * 3, z: f.z + i * .3, size: 4 + k * 2.6 })));
  ambient.puffs({ spots: smoke, color: 0x2e2c36, shade: 0x0c0b12, opacity: .5, life: 11, rise: 26, drift: [1.1, 0, .5], grow: 3.6, seed: 61, order: 2 });
  const haze: { x: number; y: number; z: number; size: number }[] = [];
  const hr = seeded(71);
  for (let i = 0; i < 22; i++) { const a = hr() * Math.PI * 2, r = 30 + hr() * 70; haze.push({ x: Math.sin(a) * r, y: 1 + hr() * 3, z: Math.cos(a) * r, size: 18 + hr() * 20 }); }
  ambient.puffs({ spots: haze, color: 0x3a4a7a, shade: 0x141a30, opacity: .16, life: 0, flat: true, drift: [.3, 0, .15], seed: 72, order: 1 });
  ambient.motes({ min: [-24, 0, -18], max: [-8, 14, 20], count: 140, velocity: [.3, 1.4, .2], size: .05, color: 0xff8a3a, color2: 0xffd080, opacity: .9, wobble: .7, additive: true, twinkle: .6, seed: 81 });
  ambient.motes({ min: [-40, 0, -40], max: [40, 22, 40], count: 260, velocity: [.35, -.5, .2], size: .06, color: 0x6a6670, color2: 0x2a2830, opacity: .6, wobble: 1.2, seed: 82 });
  ambient.motes({ min: [-36, 0, -36], max: [36, 6, 36], count: Math.round(120 * nearShare()), velocity: [.9, -.1, .4], size: .09, color: 0xff7a2a, color2: 0xb060ff, opacity: .85, wobble: 1.6, seed: 83 });
  ambient.birds({ centre: [0, 0, -6], count: 14, radius: 26, height: 34, spread: 10, speed: 8, size: .6, color: 0x060508, seed: 84 });

  const rng = seeded(1031);
  const decals = scatterWear(rng, {
    kinds: {
      crack: { count: 18, size: [1.2, 2.8], tint: 0xa4a4b0, opacity: [.5, .8] }, crater: { count: 5, size: [2.6, 4.2], tint: 0x8a8890 },
      scorch: { count: 8, size: [2.4, 5], tint: 0x6a5a5a }, stain: { count: 14, size: [1, 2.6], tint: [0x5a1418, 0x4a4450] },
      dust: { count: 12, size: [2, 4], tint: 0x9a96a0, opacity: [.4, .7] }, chips: { count: 14, size: [.8, 1.8], tint: 0xb0aeb8 },
    },
    spot: () => { const a = rng() * Math.PI * 2, r = 4 + Math.sqrt(rng()) * 32; return [Math.sin(a) * r, Math.cos(a) * r]; },
    floor: (x, z) => (Math.abs(x) <= 24 && Math.abs(z) <= 24) || (Math.abs(x) <= 10) || (Math.abs(z) <= 10) ? -.024 : .066,
  });
  decals.push({ x: 1.5, z: -2.5, y: -.022, size: 7.5, rot: .7, cell: WEAR.crater[0], tint: 0x9a98a2, opacity: 1 },
    { x: 4.6, z: -1.2, y: -.021, size: 5.5, rot: 2.1, cell: WEAR.crack[1], tint: 0x9a9aa6, opacity: .7 },
    { x: -1.4, z: -4.6, y: -.021, size: 5, rot: 4.0, cell: WEAR.crack[3], tint: 0x9a9aa6, opacity: .65 });
  await wearDecals(c, decals, 'shibuya wear');
  await streetMarks(c, props);
  policeTape(c);
}

const MARK = { manhole: 0, tyres: 1, glass: 2, blood: 3, litter: 4, hat: 5, drain: 6, stop: 7 } as const;
async function streetMarks(c: DressContext, props: readonly { piece: string; x: number; z: number; rot?: number; roll?: number }[]) {
  const rng = seeded(4310);
  const road = (x: number, z: number) => (Math.abs(x) <= 24 && Math.abs(z) <= 24) || Math.abs(x) <= 10 || Math.abs(z) <= 10;
  const y = (x: number, z: number) => road(x, z) ? -.024 : .066;
  const marks: { x: number; z: number; size: number; rot: number; cell: number; alpha?: number }[] = [];
  for (const [x, z] of [[6, -8], [-9, 4], [3, 15], [-4, -16], [0, -33], [-33, 2], [33, -3]]) marks.push({ x, z, size: .9, rot: rng() * 6.3, cell: MARK.manhole });
  for (const [x, z, rot] of [[23.35, -14, 0], [-23.35, 13, 0], [14, 23.35, Math.PI / 2], [-14, -23.35, Math.PI / 2], [23.35, 16, 0], [-16, 23.35, Math.PI / 2]]) marks.push({ x, z, size: 1.1, rot, cell: MARK.drain });
  marks.push({ x: 5, z: -30.5, size: 3.6, rot: Math.PI, cell: MARK.stop }, { x: -5, z: 30.5, size: 3.6, rot: 0, cell: MARK.stop },
    { x: -30.5, z: -5, size: 3.6, rot: -Math.PI / 2, cell: MARK.stop }, { x: 30.5, z: 5, size: 3.6, rot: Math.PI / 2, cell: MARK.stop });
  for (const p of props) {
    if (!/^shibuya\/(taxi|sedan|van|bus|police-car)$/.test(p.piece)) continue;
    const yaw = p.rot ?? 0, ax = Math.sin(yaw), az = Math.cos(yaw);
    marks.push({ x: p.x - ax * 5, z: p.z - az * 5, size: 5.5, rot: yaw + Math.PI / 2 + (rng() - .5) * .6, cell: MARK.tyres, alpha: .8 });
    marks.push({ x: p.x + ax * 2.6 + (rng() - .5), z: p.z + az * 2.6 + (rng() - .5), size: 2.6 + rng(), rot: rng() * 6.3, cell: MARK.glass, alpha: .9 });
  }
  for (const [x, z, size] of [[-33, 33, 4.2], [-31, 30.5, 3.4], [-28.6, 33.2, 3]]) marks.push({ x, z, size, rot: rng() * 6.3, cell: MARK.glass });
  for (const [x, z] of [[-15.5, 27.5], [4.5, -7.5], [19, -21], [-26, -9]]) marks.push({ x, z, size: 1.8 + rng(), rot: rng() * 6.3, cell: MARK.blood, alpha: .85 });
  for (let i = 0; i < Math.round(20 * nearShare()); i++) {
    const a = rng() * Math.PI * 2, r = 5 + rng() * 31, x = Math.sin(a) * r, z = Math.cos(a) * r;
    marks.push({ x, z, size: 1.3 + rng() * 1.2, rot: rng() * 6.3, cell: rng() < .78 ? MARK.litter : MARK.hat });
  }
  const map = await c.texture('/assets/environment/shibuya/decals.webp', { anisotropy: 8 });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const material = lookStageMaterial(new THREE.MeshStandardMaterial({
    name: 'Shibuya street marks', map, transparent: true, depthWrite: false, roughness: .9, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  }), c.stage, 'street marks') as THREE.MeshStandardMaterial;
  addShaderPatch(material, 'shibuya-marks-v1', shader => {
    shader.vertexShader = 'attribute vec3 aMark;\nvarying float vMarkAlpha;\n' + shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
        vMapUv = ( vMapUv + aMark.xy ) * vec2( .25, .5 );
      #endif
      vMarkAlpha = aMark.z;`);
    shader.fragmentShader = 'varying float vMarkAlpha;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.a *= vMarkAlpha;`);
  });
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const cells = new Float32Array(marks.length * 3);
  marks.forEach((m, i) => cells.set([m.cell % 4, 1 - Math.floor(m.cell / 4), m.alpha ?? 1], i * 3));
  geometry.setAttribute('aMark', new THREE.InstancedBufferAttribute(cells, 3));
  const mesh = new THREE.InstancedMesh(geometry, material, marks.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
  marks.forEach((m, i) => mesh.setMatrixAt(i, m4.compose(p3.set(m.x, y(m.x, m.z) + .014, m.z), q.setFromAxisAngle(up, m.rot), sc.set(m.size, 1, m.size))));
  mesh.name = 'shibuya:street marks'; mesh.receiveShadow = true; mesh.renderOrder = -1;
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  c.root.add(mesh);
}

function policeTape(c: DressContext) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 32;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f4c81a'; g.fillRect(0, 0, 512, 32);
  g.fillStyle = '#141414'; g.font = 'bold 22px sans-serif'; g.textBaseline = 'middle';
  g.fillText('KEEP OUT  立入禁止  KEEP OUT  立入禁止', 6, 17);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping;
  const runs: [number, number, number, number][] = [[-23.4, 30.2, -21.4, 30.2], [-21.4, 30.2, -16, 29.3], [-13.9, 33.6, -13.9, 35.6], [-21.6, 36.6, -19.6, 36.6], [-12, 29, -6.5, 31.5]];
  const positions: number[] = [], uvs: number[] = [], index: number[] = [];
  for (const [x0, z0, x1, z1] of runs) {
    const L = Math.hypot(x1 - x0, z1 - z0), segments = 8;
    const start = positions.length / 3;
    for (let k = 0; k <= segments; k++) {
      const t = k / segments, sag = .18 * 4 * t * (1 - t), x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      positions.push(x, 1.02 - sag, z, x, .94 - sag, z);
      uvs.push(t * L / 3.2, 1, t * L / 3.2, 0);
    }
    for (let k = 0; k < segments; k++) { const a = start + k * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index); geometry.computeVertexNormals();
  const material = lookStageMaterial(new THREE.MeshStandardMaterial({ name: 'Shibuya police tape', map, side: THREE.DoubleSide, roughness: .8, metalness: 0 }), c.stage, 'police tape');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'shibuya:police tape';
  c.root.add(mesh);
}

const EMITTERS = 22;
const LAMP_UV = new THREE.Box2(new THREE.Vector2(642 / 1024, 898 / 1024), new THREE.Vector2(702 / 1024, 958 / 1024));
const SCREEN_PERIOD = 7, SCREEN_WIPE = .35;

interface Quad { centre: THREE.Vector3; normal: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; halfWidth: number; halfHeight: number; area: number; uv: THREE.Box2 }

function quads(mesh: THREE.Mesh): Quad[] {
  const g = mesh.geometry, pos = g.getAttribute('position'), uv = g.getAttribute('uv');
  const index = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i);
  const parent = Array.from({ length: pos.count }, (_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) { const k = key(i), j = seen.get(k); if (j === undefined) seen.set(k, i); else parent[find(i)] = find(j); }
  for (let t = 0; t < index.length; t += 3) { const a = find(index[t]); parent[find(index[t + 1])] = a; parent[find(index[t + 2])] = a; }
  const groups = new Map<number, number[]>();
  for (let t = 0; t < index.length; t += 3) { const r = find(index[t]); const list = groups.get(r) ?? []; list.push(index[t], index[t + 1], index[t + 2]); groups.set(r, list); }
  const out: Quad[] = [];
  const m = mesh.matrixWorld, p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const list of groups.values()) {
    if (list.length < 6) continue;
    const pts = [...new Set(list)].map(i => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m));
    const centre = pts.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    a.fromBufferAttribute(pos, list[0]).applyMatrix4(m); b.fromBufferAttribute(pos, list[1]).applyMatrix4(m); c.fromBufferAttribute(pos, list[2]).applyMatrix4(m);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (Math.abs(normal.y) > .3) continue;
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    let hw = 0, hh = 0;
    for (const q of pts) { p.subVectors(q, centre); hw = Math.max(hw, Math.abs(p.dot(right))); hh = Math.max(hh, Math.abs(p.dot(up))); }
    const box = new THREE.Box2();
    for (const i of list) box.expandByPoint(new THREE.Vector2(uv.getX(i), uv.getY(i)));
    out.push({ centre, normal, right, up, halfWidth: hw, halfHeight: hh, area: hw * hh * 4, uv: box });
  }
  return out;
}

function screenCell(uv: THREE.Box2) {
  const c = uv.getCenter(new THREE.Vector2());
  return Math.floor(c.y * 4) * 2 + Math.floor(c.x * 2);
}
function showing(index: number, t: number) {
  const local = t + index * 2.37, step = Math.floor(local / SCREEN_PERIOD), phase = local - step * SCREEN_PERIOD;
  return { now: (index + step) % 8, next: (index + step + 1) % 8, wipe: THREE.MathUtils.smoothstep(phase, SCREEN_PERIOD - SCREEN_WIPE, SCREEN_PERIOD) };
}

function cycleScreens(material: THREE.MeshStandardMaterial, time: { value: number }) {
  addShaderPatch(material, 'shibuya-screens-v1', shader => {
    shader.uniforms.uScreenTime = time;
    const decl = 'varying vec2 vScreenLocal;\nvarying vec2 vScreenNow;\nvarying vec2 vScreenNext;\nvarying float vScreenWipe;\nvarying float vScreenBroken;\n';
    shader.vertexShader = 'uniform float uScreenTime;\n' + decl + shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_MAP
      {
        vec2 grid = vec2( 2.0, 4.0 );
        vec2 cell = floor( vMapUv * grid );
        float index = cell.y * 2.0 + cell.x;
        float local = uScreenTime + index * 2.37;
        float step = floor( local / ${SCREEN_PERIOD.toFixed(1)} );
        float now = mod( index + step, 8.0 ), next = mod( index + step + 1.0, 8.0 );
        vScreenLocal = vMapUv * grid - cell;
        vScreenNow = vec2( mod( now, 2.0 ), floor( now / 2.0 ) );
        vScreenNext = vec2( mod( next, 2.0 ), floor( next / 2.0 ) );
        vScreenWipe = smoothstep( ${(SCREEN_PERIOD - SCREEN_WIPE).toFixed(2)}, ${SCREEN_PERIOD.toFixed(1)}, local - step * ${SCREEN_PERIOD.toFixed(1)} );
        // One screen took a blow in the fighting: it glitches.
        vScreenBroken = index == 6.0 ? 1.0 : 0.0;
      }
      #endif`);
    shader.fragmentShader = 'uniform float uScreenTime;\n' + decl + shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 screenUv = ( ( vScreenLocal.y < vScreenWipe ? vScreenNext : vScreenNow ) + vScreenLocal ) / vec2( 2.0, 4.0 );
      #ifdef USE_MAP
        diffuseColor *= texture2D( map, screenUv );
      #endif`).replace('#include <emissivemap_fragment>', `
      #ifdef USE_EMISSIVEMAP
        totalEmissiveRadiance *= texture2D( emissiveMap, screenUv ).rgb;
        // The wipe's leading edge flares, as an LED wall does when it changes.
        totalEmissiveRadiance *= 1.0 + 1.6 * exp( -abs( vScreenLocal.y - vScreenWipe ) * 40.0 ) * step( .001, vScreenWipe ) * step( vScreenWipe, .999 );
        if ( vScreenBroken > .5 ) {
          float tick = floor( uScreenTime * 9.0 );
          vec2 block = floor( vScreenLocal * vec2( 14.0, 9.0 ) );
          float dead = step( .62, fract( sin( dot( block + tick * .13, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) );
          float blackout = step( .78, fract( sin( floor( uScreenTime * 2.3 ) * 91.7 ) * 4375.85 ) );
          float band = step( .9, fract( vScreenLocal.y * 23.0 + uScreenTime * 1.7 ) );
          totalEmissiveRadiance *= ( 1.0 - dead * .9 ) * ( 1.0 - blackout * .85 ) * ( 1.0 + band * 1.5 );
          totalEmissiveRadiance.r *= 1.0 + dead * 2.0;
        }
      #endif`);
  });
}

function flickerSigns(material: THREE.MeshStandardMaterial, time: { value: number }) {
  addShaderPatch(material, 'shibuya-signs-v1', shader => {
    shader.uniforms.uSignTime = time;
    shader.fragmentShader = 'uniform float uSignTime;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_EMISSIVEMAP
      {
        vec2 suv = vEmissiveMapUv;
        vec2 id = suv.x < .5 ? vec2( floor( suv.x * 16.0 ), floor( suv.y * 2.0 ) ) : vec2( 20.0 + floor( suv.x * 4.0 ), floor( suv.y * 16.0 ) );
        id += floor( vLookWorld.xz / 3.0 ) * 7.0;
        float h = fract( sin( dot( id, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
        if ( h > .86 ) {
          float t = floor( uSignTime * ( 6.0 + h * 10.0 ) );
          float on = step( .32, fract( sin( t * 91.7 + h * 13.0 ) * 4375.85 ) );
          totalEmissiveRadiance *= mix( .18, 1.0, on );
        }
      }
      #endif`);
  });
}

function wetUniforms(list: (Quad & { screen: boolean })[], sky: THREE.Texture, time: { value: number }) {
  const n = EMITTERS;
  const v4 = () => Array.from({ length: n }, () => new THREE.Vector4());
  const u = {
    uEmitC: { value: v4() }, uEmitR: { value: v4() }, uEmitU: { value: v4() }, uEmitN: { value: v4() },
    uEmitCol: { value: Array.from({ length: n }, () => new THREE.Color(0, 0, 0)) },
    uWetSky: { value: sky }, uWetTime: time,
  };
  list.forEach((q, i) => {
    u.uEmitC.value[i].set(q.centre.x, q.centre.y, q.centre.z, 0);
    u.uEmitR.value[i].set(q.right.x * q.halfWidth, q.right.y * q.halfWidth, q.right.z * q.halfWidth, 0);
    u.uEmitU.value[i].set(q.up.x * q.halfHeight, q.up.y * q.halfHeight, q.up.z * q.halfHeight, 0);
    u.uEmitN.value[i].set(q.normal.x, q.normal.y, q.normal.z, q.screen ? 1 : .8);
  });
  return u;
}

function wetStreet(material: THREE.MeshStandardMaterial, u: ReturnType<typeof wetUniforms>, strength: number) {
  addShaderPatch(material, `shibuya-wet-v1-${strength}`, shader => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = `#define WET_N ${EMITTERS}
      uniform vec4 uEmitC[ WET_N ];
      uniform vec4 uEmitR[ WET_N ];
      uniform vec4 uEmitU[ WET_N ];
      uniform vec4 uEmitN[ WET_N ];
      uniform vec3 uEmitCol[ WET_N ];
      uniform sampler2D uWetSky;
      uniform float uWetTime;
      float wHash2( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float wNoise2( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
        return mix( mix( wHash2( i ), wHash2( i + vec2( 1., 0. ) ), f.x ), mix( wHash2( i + vec2( 0., 1. ) ), wHash2( i + vec2( 1., 1. ) ), f.x ), f.y ); }
      ` + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      // The road's repairs: rectangles of newer, darker asphalt and older, paler.
      vec2 patchCell = floor( vLookWorld.xz / vec2( 5.5, 2.8 ) + vec2( 0.0, floor( vLookWorld.x / 5.5 ) * .5 ) );
      float patchH = wHash2( patchCell );
      diffuseColor.rgb *= patchH > .86 ? .78 : patchH < .08 ? 1.12 : 1.0;
      float wetPuddle = smoothstep( .5, .64, wNoise2( vLookWorld.xz * .11 ) * .7 + wNoise2( vLookWorld.xz * .43 ) * .3 );
      float wetness = mix( .4, 1.35, wetPuddle ) * ${strength.toFixed(2)};
      diffuseColor.rgb *= 1.0 - .4 * wetPuddle * ${Math.min(1, strength).toFixed(2)};`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec2 p = vLookWorld.xz;
        vec2 slope = ( vec2( wNoise2( p * .9 + vec2( uWetTime * .05, 0. ) ), wNoise2( p * .9 + vec2( 4.3, uWetTime * .04 ) ) ) - .5 ) * mix( .035, .01, wetPuddle );
        vec3 nn = normalize( vec3( slope.x, 1.0, slope.y ) );
        vec3 view = normalize( vLookWorld - cameraPosition );
        vec3 ray = reflect( view, nn );
        vec3 seen = vec3( 0.0 );
        float rough = mix( 1.0, .3, wetPuddle );
        for ( int i = 0; i < WET_N; i++ ) {
          vec4 nrm = uEmitN[ i ];
          if ( nrm.w == 0.0 ) continue;
          float facing = dot( ray, nrm.xyz );
          if ( facing > -1e-3 ) continue;
          float t = dot( uEmitC[ i ].xyz - vLookWorld, nrm.xyz ) / facing;
          if ( t <= 0.0 ) continue;
          vec3 hit = vLookWorld + ray * t - uEmitC[ i ].xyz;
          vec3 ra = uEmitR[ i ].xyz, ua = uEmitU[ i ].xyz;
          float a = dot( hit, ra ) / dot( ra, ra ), b = dot( hit, ua ) / dot( ua, ua );
          // Wide, soft columns of the source's colour (a hair-thin streak read
          // as a crack, a blind critic): blurred across by at least a metre.
          float ba = .35 + ( 1.2 + t * .03 * rough ) / max( length( ra ), .5 ), bb = .4 + t * .06 * rough;
          float w = ( 1.0 - smoothstep( 1.0 - ba, 1.0 + ba, abs( a ) ) ) * ( 1.0 - smoothstep( 1.0 - bb, 1.0 + bb, abs( b ) ) );
          seen += uEmitCol[ i ] * w * nrm.w / ( 1.0 + t * .012 );
        }
        float fres = .04 + .96 * pow( 1.0 - max( dot( -view, nn ), 0.0 ), 5.0 );
        float su = atan( ray.x, -ray.z ) * .15915494 + .5;
        float sv = clamp( asin( clamp( ray.y, -1., 1. ) ) * .63661977 * .5 + .5, .002, .998 );
        vec3 curtain = texture2D( uWetSky, vec2( su, sv ) ).rgb;
        seen = min( seen, vec3( 1.1 ) );
        totalEmissiveRadiance += ( seen * ( .9 + .8 * fres ) + curtain * fres * .3 ) * wetness;
      }`);
  });
}

async function cellColours(texture: THREE.Texture, cols: number, rows: number) {
  const boxes: THREE.Box2[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) boxes.push(new THREE.Box2(new THREE.Vector2(c / cols, r / rows), new THREE.Vector2((c + 1) / cols, (r + 1) / rows)));
  return regionColours(texture, boxes);
}
async function regionColours(texture: THREE.Texture, boxes: THREE.Box2[]): Promise<THREE.Color[]> {
  const image = texture.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (!image || typeof document === 'undefined') return boxes.map(() => new THREE.Color(1, 1, 1));
  const W = 128, H = 128;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) return boxes.map(() => new THREE.Color(1, 1, 1));
  g.drawImage(image, 0, 0, W, H);
  const data = g.getImageData(0, 0, W, H).data;
  return boxes.map(box => {
    const x0 = Math.max(0, Math.floor(box.min.x * W)), x1 = Math.min(W, Math.ceil(box.max.x * W));
    const y0 = Math.max(0, Math.floor(box.min.y * H)), y1 = Math.min(H, Math.ceil(box.max.y * H));
    let r = 0, gr = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const k = (y * W + x) * 4; r += data[k]; gr += data[k + 1]; b += data[k + 2]; n++; }
    const c = new THREE.Color().setRGB(r / Math.max(1, n) / 255, gr / Math.max(1, n) / 255, b / Math.max(1, n) / 255, THREE.SRGBColorSpace);
    return c;
  });
}

function heads(mesh: THREE.Mesh | undefined, region: THREE.Box2) {
  if (!mesh) return [];
  const g = mesh.geometry, pos = g.getAttribute('position'), uv = g.getAttribute('uv');
  const index = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const found: THREE.Vector3[] = [];
  const c = new THREE.Vector2(), p = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    c.set(0, 0);
    for (let k = 0; k < 3; k++) c.x += uv.getX(index[t + k]) / 3, c.y += uv.getY(index[t + k]) / 3;
    if (!region.containsPoint(c)) continue;
    p.set(0, 0, 0);
    for (let k = 0; k < 3; k++) p.x += pos.getX(index[t + k]) / 3, p.y += pos.getY(index[t + k]) / 3, p.z += pos.getZ(index[t + k]) / 3;
    p.applyMatrix4(mesh.matrixWorld);
    if (!found.some(q => q.distanceToSquared(p) < 1)) found.push(p.clone());
  }
  return found;
}

function curtain(time: { value: number }) {
  const radius = 335, sink = 30;
  const geometry = new THREE.SphereGeometry(radius, 96, 36, 0, Math.PI * 2, 0, Math.PI * .56);
  const material = new THREE.ShaderMaterial({
    name: 'Shibuya curtain',
    uniforms: { uTime: time },
    vertexShader: `
      varying vec3 vWorld; varying vec3 vDir;
      void main() {
        vec4 world = modelMatrix * vec4( position, 1.0 );
        vWorld = world.xyz; vDir = normalize( position );
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorld; varying vec3 vDir;
      float cHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float cNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
        return mix( mix( cHash( i ), cHash( i + vec2( 1., 0. ) ), f.x ), mix( cHash( i + vec2( 0., 1. ) ), cHash( i + vec2( 1., 1. ) ), f.x ), f.y ); }
      void main() {
        vec3 d = normalize( vDir );
        float h = max( vWorld.y, 0.0 );
        float az = atan( d.x, d.z ), elev = asin( clamp( d.y, -1.0, 1.0 ) );
        // Near black, a whisper of navy: the curtain shuts the sky out.
        vec3 col = vec3( .0035, .0045, .0095 );
        // The veil's ripples: slow broad waves crossing the shell, barely there.
        float wave = sin( az * 7.0 + elev * 11.0 + uTime * .22 ) * sin( az * 4.0 - elev * 17.0 - uTime * .15 );
        float n = cNoise( vec2( az * 5.0, elev * 6.0 ) + uTime * .015 );
        col += vec3( .006, .009, .018 ) * ( wave * .5 + .5 ) * ( .4 + n );
        // Its limb: toward its foot all round, the look runs through more of
        // the membrane and it shines a cold teal-navy - the shell's shape.
        float limb = pow( 1.0 - clamp( elev / 1.5708, 0.0, 1.0 ), 9.0 );
        col += vec3( .018, .034, .06 ) * limb * ( .8 + .4 * n );
        // Above the rooftops, all round, a band of the city's light caught in
        // the membrane, shimmering as the veil ripples - where a fan sees the
        // curtain come down over the district (the reference's dome edge).
        float band = smoothstep( 52.0, 74.0, h ) * ( 1.0 - smoothstep( 80.0, 112.0, h ) );
        float shimmer = .5 + .5 * sin( az * 34.0 + h * .11 - uTime * .45 ) * sin( az * 11.0 - h * .07 + uTime * .3 );
        col += vec3( .05, .085, .14 ) * band * shimmer * ( .7 + .5 * n );
        // Its foot holds the city's light; the seam where it meets the street.
        col += vec3( .008, .014, .03 ) * exp( -h / 40.0 );
        col += vec3( .11, .13, .3 ) * ( exp( -h / 1.4 ) + .22 * exp( -h / 8.0 ) );
        gl_FragColor = vec4( col, 1.0 );
      }`,
    side: THREE.BackSide, depthWrite: true, fog: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Shibuya curtain';
  mesh.position.y = -sink;
  mesh.frustumCulled = false;
  mesh.renderOrder = 999_998;
  return mesh;
}

function lampCones(root: THREE.Object3D, heads: THREE.Vector3[], time: { value: number }) {
  if (!heads.length) return;
  const height = 7.7;
  const geometry = new THREE.ConeGeometry(2.6, height, 20, 1, true).translate(0, -height / 2, 0);
  const material = new THREE.ShaderMaterial({
    name: 'Shibuya lamp cones',
    uniforms: { uTime: time, uColour: { value: new THREE.Color(0xffb870) } },
    vertexShader: `
      varying float vDown; varying vec3 vNormalView; varying vec3 vView;
      void main() {
        vDown = -position.y / ${height.toFixed(1)};
        vec4 world = modelMatrix * instanceMatrix * vec4( position, 1.0 );
        vec4 view = viewMatrix * world;
        vView = normalize( -view.xyz );
        vNormalView = normalize( mat3( viewMatrix ) * mat3( modelMatrix ) * mat3( instanceMatrix ) * normal );
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform vec3 uColour;
      varying float vDown; varying vec3 vNormalView; varying vec3 vView;
      void main() {
        // Seen through the cone's middle it is dense; at its rim, thin.
        float edge = pow( abs( dot( normalize( vNormalView ), normalize( vView ) ) ), 1.6 );
        float fade = ( 1.0 - smoothstep( .0, 1.0, vDown ) ) * smoothstep( .0, .06, vDown );
        gl_FragColor = vec4( uColour * edge * fade * .16, 1.0 );
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, heads.length);
  const m = new THREE.Matrix4();
  heads.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y - .05, p.z)));
  mesh.name = 'shibuya:lamp cones'; mesh.renderOrder = 4; mesh.frustumCulled = false;
  root.add(mesh);
}
