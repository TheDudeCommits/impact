import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from './dressing';
import { seeded } from './ambient';
import { crowdCards, figureAtlas, stripSpots, type CrowdSpot } from './crowd';
import { addShaderPatch } from '../look/shaderPatch';
import { addMesh, beams, canvasAtlas, flutter, hangingCloth, nearMaterial, nearShare, ropes, scatterWear, thin, wearDecals, type Beam, type Hang, type Line } from './near';

const FIELD = -1.8;
export const TOURNAMENT_MASTS: readonly (readonly [number, number])[] = [
  [-11, -20.5], [11, -20.5], [16, -16], [22.5, 0], [16, 16], [7, 21.5], [-7, 21.5], [-16, 16], [-22.5, 0], [-16, -16],
];
const MAST_TOP = 12.6;
const ONI = 0xd2a070;

export function buntingLines(): Line[] {
  const top = (i: number, y = MAST_TOP - .6): [number, number, number] => [TOURNAMENT_MASTS[i][0], y, TOURNAMENT_MASTS[i][1]];
  const lines: Line[] = [];
  for (let i = 0; i < TOURNAMENT_MASTS.length; i++) lines.push({ a: top(i), b: top((i + 1) % TOURNAMENT_MASTS.length), sag: 1.4 });
  for (let i = 0; i < TOURNAMENT_MASTS.length; i++) {
    const [x, z] = TOURNAMENT_MASTS[i], r = Math.hypot(x, z);
    if (z > 18) continue;
    lines.push({ a: top(i, MAST_TOP - 1.4), b: [x / r * 33.5, 3.4, z / r * 33.5], sag: .7 });
  }
  lines.push({ a: top(0, MAST_TOP - .2), b: top(6, MAST_TOP - .2), sag: 3 }, { a: top(1, MAST_TOP - .2), b: top(5, MAST_TOP - .2), sag: 3 },
    { a: top(8, MAST_TOP - .2), b: top(3, MAST_TOP - .2), sag: 3 });
  return lines;
}

export async function dressMartialArtsTournament(c: DressContext) {
  const { kit, ambient, model, stage } = c;
  const share = nearShare();
  const rng = seeded(1984);
  await Promise.all([
    kit.load(['br/gong', 'br/table', 'br/umbrella', 'br/board', 'br/stone-lamp', 'br/pot', 'br/oni-mask']),
    c.sky({ url: '/assets/environment/br/sky-enies-lobby.webp', rotation: .23, drift: .0005, horizon: -.12, tint: 0xd6e6ff }),
  ]);
  model.traverse(o => { if ((o as THREE.Mesh).isMesh && /skybox/.test(((o as THREE.Mesh).material as THREE.Material).name)) o.visible = false; });

  kit.place('br/table', { x: -19.5, z: 3, y: FIELD, rot: Math.PI / 2, scale: 1.3 });
  kit.place('br/table', { x: -19.5, z: -3.2, y: FIELD, rot: Math.PI / 2, scale: 1.3 });
  for (const z of [5.2, 0, -5.4]) kit.place('br/umbrella', { x: -21.4, z, y: FIELD, scale: 2.6, rot: z });
  kit.place('br/board', { x: 20.5, z: -6, y: FIELD, rot: -Math.PI / 2, scale: 2.2 });
  kit.place('br/table', { x: 19.6, z: 1.5, y: FIELD, rot: -Math.PI / 2, scale: 1.2 });
  kit.place('br/umbrella', { x: 21.6, z: 1.5, y: FIELD, scale: 2.6, rot: 1 });
  kit.place('br/gong', { x: -20, z: -11, y: FIELD, rot: Math.PI / 2, scale: 1.9 });
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
  for (const [sx, sz] of corners) kit.place('br/pot', { x: sx * 17.2, z: sz * 17.2, y: FIELD, scale: 1.5, tint: 0x8a7a68 });
  for (const [sx, sz] of corners) kit.place('br/stone-lamp', { x: sx * 26.5, z: sz * 26.5, y: FIELD, scale: 3.2, tint: 0xd8d0c4 });

  const wood = kit.material('br/table', /Wood 1/) as THREE.MeshStandardMaterial;
  const timber = nearMaterial(c, 'Near masts', { map: wood.map, color: 0xd2a07a, roughness: .9 });
  const poles: Beam[] = [];
  const banners = tournamentBanners();
  TOURNAMENT_MASTS.forEach(([x, z], i) => {
    const facing = Math.atan2(-x, -z), sx = Math.cos(facing), sz = -Math.sin(facing);
    poles.push({ a: [x, FIELD - .2, z], b: [x, MAST_TOP, z], w: .3 });
    poles.push({ a: [x - sx * 1.1, MAST_TOP - .9, z - sz * 1.1], b: [x + sx * 1.1, MAST_TOP - .9, z + sz * 1.1], w: .14 });
    ambient.cloth(banners, { x: x + Math.sin(facing) * .2, y: MAST_TOP - .95, z: z + Math.cos(facing) * .2, width: 1.9, height: 7.2, rot: facing, uv: [(i % 3) / 3, 0, (i % 3 + 1) / 3, 1], wind: .7 });
  });
  addMesh(c, beams(poles, 2), timber, 'near masts', { shadow: true });

  const lines = buntingLines();
  const pennants: Hang[] = [];
  for (const line of lines) {
    const length = Math.hypot(line.b[0] - line.a[0], line.b[2] - line.a[2]);
    for (let s = .7; s < length - .5; s += .78) pennants.push({ line, t: s / length, width: .6, height: .78, cell: Math.floor(rng() * 8) });
  }
  addMesh(c, ropes(lines, { radius: .022 }), nearMaterial(c, 'Near bunting rope', { color: 0x6a5a4a, roughness: 1 }), 'near ropes');
  addMesh(c, hangingCloth(thin(pennants, share), 4, 2), flutter(nearMaterial(c, 'Near bunting', { map: pennantAtlas(), cloth: true }), ambient.time, .14), 'near bunting');

  ambient.puffs({ spots: corners.flatMap(([sx, sz]) => Array.from({ length: 5 }, (_, k) => ({ x: sx * 17.2, y: FIELD + 1.4 + k * .5, z: sz * 17.2, size: 1.1 + k * .35 }))),
    color: 0xe8e4dc, shade: 0xa8a4a0, opacity: .1, life: 7, rise: 6, drift: [.3, 0, .2], grow: 2.4, seed: 21 });

  const ringMaterial = findMaterial(model, /ground1/) as THREE.MeshStandardMaterial | undefined;
  if (ringMaterial) {
    ringMaterial.map = await c.texture('/assets/environment/br/tournament-tiles.webp', { repeat: 2.5, anisotropy: 8 });
    ringMaterial.needsUpdate = true;
  }
  const onRing = (x: number, z: number) => Math.abs(x) < 14.6 && Math.abs(z) < 14.6 ? 0 : undefined;
  const spot = (): [number, number] => [(rng() - .5) * 29, (rng() - .5) * 29];
  const decals = scatterWear(rng, {
    share, spot, floor: onRing,
    kinds: {
      crack: { count: 6, size: [2, 3.6], opacity: [.22, .34] },
      crater: { count: 1, size: [3.5, 5], opacity: [.3, .4] },
      scorch: { count: 2, size: [2.5, 4], opacity: [.2, .3] },
      chips: { count: 14, size: [1.6, 2.8], tint: [0xb8c8c6, 0xa8b8b8] },
      dust: { count: 4, size: [3, 5], tint: 0xd4e2e6, opacity: [.3, .45] },
      scuff: { count: 8, size: [2.5, 4.5], opacity: [.25, .45] },
    },
  });
  await wearDecals(c, decals, 'near wear');
  signboard(c);
  heroes(c);
  kit.flush(stage);
}

function heroes(c: DressContext) {
  const { kit } = c;
  for (const sx of [-1, 1]) kit.place('br/oni-mask', { x: sx * 7.4, z: 29.95, y: -1.25, rot: Math.PI, scale: 3.6, tint: ONI });
  const FASCIA_S = -31.1, FASCIA_X = 29.4;
  const roundels: [number, number, number][] = [];
  for (const sx of [-1, 1]) {
    kit.place('br/oni-mask', { x: sx * 24, z: FASCIA_S + .16, y: -1.75, rot: 0, scale: 3.2, tint: ONI });
    roundels.push([sx * 15.5, FASCIA_S + .06, 0]);
    for (const z of [-12, 12]) kit.place('br/oni-mask', { x: sx * (FASCIA_X - .16), z, y: -1.75, rot: -sx * Math.PI / 2, scale: 3.2, tint: ONI });
    for (const z of [-23.5, 0, 23.5]) roundels.push([sx * (FASCIA_X - .06), z, -sx * Math.PI / 2]);
  }
  roundel(c, roundels);
  addShaderPatch(kit.material('br/oni-mask', /./), 'tournament-oni-glow-v1', shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * .32;`);
  });
  southGatehouse(c);
  drums(c, [[-11, 26.6, Math.PI], [11, 26.6, Math.PI], [-14.5, -26.4, 0], [14.5, -26.4, 0]]);
  stripCloth(c, FASCIA_S, FASCIA_X);
  featherFlags(c);
  spectators(c);
}

function featherFlags(c: DressContext) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  ['#8a3ac8', '#f2c230', '#f0589a', '#2ab8d8'].forEach((colour, i) => {
    const x0 = i * 128;
    g.fillStyle = colour;
    g.beginPath(); g.moveTo(x0 + 8, 1024); g.lineTo(x0 + 8, 40); g.quadraticCurveTo(x0 + 20, 0, x0 + 70, 30);
    g.quadraticCurveTo(x0 + 128, 160, x0 + 118, 560); g.quadraticCurveTo(x0 + 112, 860, x0 + 96, 1024); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x0 + 8, 40, 12, 984);
    g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.moveTo(x0 + 70, 30); g.quadraticCurveTo(x0 + 128, 160, x0 + 118, 560); g.lineTo(x0 + 104, 560); g.quadraticCurveTo(x0 + 110, 180, x0 + 64, 44); g.closePath(); g.fill();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const spots: [number, number][] = [[-22.5, -22.5], [22.5, -22.5], [-22.5, 22.5], [22.5, 22.5], [-4.2, 26.2], [4.2, 26.2], [-4.2, -21.2], [4.2, -21.2]];
  const poles: Beam[] = [];
  spots.forEach(([x, z], i) => {
    const facing = Math.atan2(-x, -z);
    poles.push({ a: [x, FIELD - .2, z], b: [x, FIELD + 10.2, z], w: .16 });
    c.ambient.cloth(texture, { x, y: FIELD + 10, z, width: 1.5, height: 8, rot: facing, uv: [(i % 4) / 4, 0, (i % 4 + 1) / 4, 1], wind: .9 });
  });
  addMesh(c, beams(poles, 2), nearMaterial(c, 'Near flag poles', { color: 0x3a2a24, roughness: .8 }), 'near flag poles');
}

function spectators(c: DressContext) {
  const spots = stripSpots(c.model, /crowd/, { spacing: .78, height: 1.3, cells: 24, skip: .1, seed: seeded(77) });
  c.model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && /crowd/.test((m.material as THREE.Material).name)) m.visible = false; });
  crowdCards(c, figureAtlas(8, 3, 96, 160, drawFan), 8, 3, spots, { name: 'tournament spectators', aspect: .6, shade: .9, sway: .05 });
}

function drawFan(g: CanvasRenderingContext2D, i: number, w: number, h: number) {
  const r = seeded(13 + i * 29), ink = '#1a1614', cx = w / 2;
  const skin = ['#e8c4a0', '#d8a882', '#c08a68', '#f0d4b8', '#a87458'][Math.floor(r() * 5)];
  const hair = ['#1c1814', '#3a2a1e', '#6a4a2a', '#2a2a30', '#8a6a3a'][Math.floor(r() * 5)];
  const shirt = ['#c0645a', '#5a82b4', '#d2b25a', '#6a9a62', '#e2dcd0', '#8a68a8', '#d08450', '#4a8c96', '#b85a78', '#7a8a4a', '#d8c8a8', '#5a6a9a'][i % 12];
  const pose = i % 4;
  g.lineWidth = 3.5; g.strokeStyle = ink; g.lineJoin = 'round'; g.lineCap = 'round';
  const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
  const sh = h * .5, headY = h * .3, hr = w * .17;
  const arm = (sx: number, up: boolean) => {
    const x0 = cx + sx * w * .27, y0 = sh + 6, x1 = up ? cx + sx * w * (.32 + r() * .06) : cx + sx * w * .3, y1 = up ? h * (.05 + r() * .06) : h * .92;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 14; g.strokeStyle = ink; g.stroke(); g.lineWidth = 9; g.strokeStyle = shirt; g.stroke();
    g.lineWidth = 3.5; g.strokeStyle = ink; shape(skin, () => g.arc(x1, y1, 6, 0, Math.PI * 2));
  };
  if (pose === 1) { arm(-1, true); arm(1, true); }
  if (pose === 2) {
    const sx = r() < .5 ? -1 : 1, fx = cx + sx * w * .34;
    g.beginPath(); g.moveTo(fx, h * .55); g.lineTo(fx, h * .03); g.lineWidth = 3; g.stroke();
    g.fillStyle = ['#c42228', '#f2c230', '#2f6fd0', '#f4f0e6'][i % 4];
    g.beginPath(); g.moveTo(fx, h * .04); g.lineTo(fx + sx * w * .3, h * .09); g.lineTo(fx, h * .15); g.closePath(); g.fill(); g.stroke();
    arm(sx, true);
  }
  if (pose === 3) arm(r() < .5 ? -1 : 1, true);
  shape(shirt, () => { g.moveTo(cx - w * .32, h); g.lineTo(cx - w * .3, sh + 4); g.quadraticCurveTo(cx, sh - 8, cx + w * .3, sh + 4); g.lineTo(cx + w * .32, h); g.closePath(); });
  shape(skin, () => g.arc(cx, headY, hr, 0, Math.PI * 2));
  if (i % 5 === 0) {
    shape('#e2c27a', () => g.ellipse(cx, headY - hr * .45, hr * 1.7, hr * .45, 0, 0, Math.PI * 2));
    shape('#e2c27a', () => { g.arc(cx, headY - hr * .5, hr * .85, Math.PI, 0); g.closePath(); });
  } else {
    shape(hair, () => { g.arc(cx, headY - 2, hr + 1, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); });
    if (i % 7 === 1) { g.fillStyle = '#e8e4dc'; g.fillRect(cx - hr, headY - hr * .45, hr * 2, 5); }
  }
  g.fillStyle = ink; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * hr * .38, headY + 1, 2.4, 0, Math.PI * 2); g.fill(); }
  if (pose === 0) { arm(-1, false); arm(1, false); }
  if (pose === 3) arm(r() < .5 ? 1 : -1, false);
}

function southGatehouse(c: DressContext) {
  const turn = new THREE.Matrix4().makeRotationY(Math.PI).premultiply(new THREE.Matrix4().makeTranslation(0, 0, 5));
  const keep = (name: string, x: number, y: number, z: number) =>
    /buildings/.test(name) ? Math.abs(x) < 5.2 && z > 28.5 && z < 38.5 && y < 11 : /walls/.test(name) ? Math.abs(x) < 11 && z > 28.5 && z < 35.5 : false;
  c.model.updateMatrixWorld(true);
  const made: THREE.Mesh[] = [];
  c.model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.Material;
    if (!/buildings|walls/.test(material.name)) return;
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    source.applyMatrix4(mesh.matrixWorld);
    const pos = source.getAttribute('position') as THREE.BufferAttribute;
    const picked: number[] = [];
    for (let t = 0; t < pos.count; t += 3) {
      const x = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, y = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3, z = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
      if (keep(material.name, x, y, z)) picked.push(t, t + 1, t + 2);
    }
    if (!picked.length) { source.dispose(); return; }
    const copy = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const a = attribute as THREE.BufferAttribute, data = new Float32Array(picked.length * a.itemSize);
      picked.forEach((i, j) => { for (let k = 0; k < a.itemSize; k++) data[j * a.itemSize + k] = a.array[i * a.itemSize + k]; });
      copy.setAttribute(name, new THREE.BufferAttribute(data, a.itemSize, a.normalized));
    }
    source.dispose();
    const normals = copy.getAttribute('normal')?.clone();
    copy.applyMatrix4(turn);
    if (normals) copy.setAttribute('normal', normals);
    const twin = new THREE.Mesh(copy, material);
    twin.name = `${c.stage}:south gatehouse`; twin.receiveShadow = true;
    made.push(twin);
  });
  for (const m of made) c.root.add(m);
  board(c, 'near south board', new THREE.Vector3(0, 6.55, -23.55), 0, 7.2, 1.35);
  for (const sx of [-1, 1]) c.kit.place('br/oni-mask', { x: sx * 7.4, z: -24.95, y: -1.25, rot: 0, scale: 3.6, tint: ONI });
}

function board(c: DressContext, name: string, at: THREE.Vector3, yaw: number, w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 192;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#b8862e'; g.fillRect(0, 0, 1024, 192);
  g.fillStyle = '#f2ead2'; g.fillRect(14, 14, 996, 164);
  g.strokeStyle = '#6a4a1c'; g.lineWidth = 4; g.strokeRect(24, 24, 976, 144);
  g.fillStyle = '#16120c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 128px serif';
  g.fillText('天下一武道会', 512, 100);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(yaw).translate(at.x, at.y, at.z), nearMaterial(c, name, { map: texture, roughness: .8 }));
  mesh.name = name; mesh.receiveShadow = true;
  c.root.add(mesh);
}

function roundel(c: DressContext, at: readonly [number, number, number][]) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f2e8d0'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#c4262c'; g.lineWidth = 18; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#b8862e'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#c4262c'; g.font = 'bold 150px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('武', 128, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const parts = at.map(([x, z, rot]) => new THREE.CircleGeometry(.8, 32).rotateY(rot).translate(x, -.42, z));
  addMesh(c, mergeGeometries(parts), nearMaterial(c, 'Near roundels', { map: texture, transparent: true, alphaTest: .5, roughness: .8 }), 'near roundels');
}

function drums(c: DressContext, spots: readonly [number, number, number][]) {
  const lacquer = nearMaterial(c, 'Near drum lacquer', { color: 0xc42228, roughness: .45 });
  const gold = nearMaterial(c, 'Near drum studs', { color: 0xe8b840, roughness: .35, metalness: .3 });
  const skin = nearMaterial(c, 'Near drum heads', { color: 0xeee2c4, roughness: .8 });
  const timber = nearMaterial(c, 'Near drum stands', { color: 0xb06a3c, roughness: .8 });
  const body: THREE.BufferGeometry[] = [], studs: THREE.BufferGeometry[] = [], heads: THREE.BufferGeometry[] = [], stands: THREE.BufferGeometry[] = [];
  const monks: CrowdSpot[] = [];
  const DECK = FIELD + 1.2, H = .9, RAD = .62;
  spots.forEach(([x, z, yaw], k) => {
    stands.push(new THREE.BoxGeometry(2.6, 1.2, 2.2).translate(x, FIELD + .6, z).toNonIndexed());
    stands.push(new THREE.BoxGeometry(1.6, .35, .8).translate(x - Math.sin(yaw) * .8, DECK + .175, z - Math.cos(yaw) * .8).toNonIndexed());
    const drum = new THREE.CylinderGeometry(RAD, RAD, H, 28, 4, true);
    const p = drum.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const t = p.getY(i) / (H / 2), f = 1 + .08 * (1 - t * t); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
    drum.computeVertexNormals();
    body.push(drum.translate(x, DECK + H / 2, z).toNonIndexed());
    heads.push(new THREE.CircleGeometry(RAD, 28).rotateX(-Math.PI / 2).translate(x, DECK + H + .005, z).toNonIndexed());
    for (const yy of [DECK + .14, DECK + H - .14]) for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      studs.push(new THREE.SphereGeometry(.05, 6, 4).translate(x + Math.sin(a) * RAD * 1.02, yy, z + Math.cos(a) * RAD * 1.02).toNonIndexed());
    }
    monks.push({ x: x - Math.sin(yaw) * .8, y: DECK + .35, z: z - Math.cos(yaw) * .8, cell: k % 4, height: 2.05, flip: x < 0 });
  });
  const strip = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map(g => { g.deleteAttribute('uv'); return g; }));
  addMesh(c, strip(body), lacquer, 'near drums', { shadow: true });
  addMesh(c, strip(studs), gold, 'near drum studs');
  addMesh(c, strip(heads), skin, 'near drum heads');
  addMesh(c, strip(stands), timber, 'near drum stands', { shadow: true });
  crowdCards(c, figureAtlas(4, 1, 112, 192, drawMonk), 4, 1, monks, { name: 'tournament monks', aspect: .58, shade: 1, sway: .04 });
}

function drawMonk(g: CanvasRenderingContext2D, i: number, w: number, h: number) {
  const ink = '#1a1210', cx = w / 2;
  g.lineWidth = 4; g.strokeStyle = ink; g.lineJoin = 'round'; g.lineCap = 'round';
  const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
  const robe = '#f0902a', shade = '#c8661a', skin = '#f2c49a', cap = '#6a3a9a';
  const headY = h * .24, hr = w * .15;
  const strike = i % 2 === 1;
  for (const sx of [-1, 1]) {
    const hx = cx + sx * w * (strike && sx > 0 ? .3 : .36), hy = strike && sx > 0 ? h * .34 : h * .1;
    g.beginPath(); g.moveTo(cx + sx * w * .22, h * .44); g.lineTo(hx, hy); g.lineWidth = 16; g.strokeStyle = ink; g.stroke();
    g.lineWidth = 11; g.strokeStyle = robe; g.stroke(); g.lineWidth = 4; g.strokeStyle = ink;
    const tx = hx + sx * w * .08, ty = hy - h * .12;
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.lineWidth = 7; g.strokeStyle = ink; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#d8b07a'; g.stroke(); g.strokeStyle = ink;
    shape('#f4ead8', () => g.arc(tx, ty, 7, 0, Math.PI * 2));
    shape(skin, () => g.arc(hx, hy, 7, 0, Math.PI * 2));
  }
  shape(robe, () => { g.moveTo(cx - w * .36, h); g.lineTo(cx - w * .28, h * .42); g.quadraticCurveTo(cx, h * .34, cx + w * .28, h * .42); g.lineTo(cx + w * .36, h); g.closePath(); });
  g.fillStyle = shade; g.beginPath(); g.moveTo(cx + w * .06, h * .4); g.lineTo(cx + w * .3, h * .45); g.lineTo(cx + w * .36, h); g.lineTo(cx + w * .1, h); g.closePath(); g.fill();
  g.strokeStyle = '#8a4a14'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - w * .26, h * .44); g.lineTo(cx + w * .22, h * .62); g.stroke(); g.strokeStyle = ink; g.lineWidth = 4;
  shape(skin, () => g.arc(cx, headY, hr, 0, Math.PI * 2));
  shape(cap, () => { g.moveTo(cx - hr * 1.05, headY - hr * .1); g.quadraticCurveTo(cx, headY - hr * 1.9, cx + hr * 1.05, headY - hr * .1); g.closePath(); });
  g.fillStyle = ink; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * hr * .4, headY + hr * .2, 2.6, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.arc(cx, headY + hr * .55, hr * .3, 0, Math.PI); g.fillStyle = '#7a2a1a'; g.fill();
}

function stripCloth(c: DressContext, south: number, side: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 80;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 1024, 80);
  g.fillStyle = '#c4262c'; g.fillRect(0, 0, 1024, 7); g.fillRect(0, 73, 1024, 7);
  g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('天下一武道会', 512, 42);
  for (const x of [80, 944]) { g.beginPath(); g.arc(x, 40, 20, 0, Math.PI * 2); g.fill(); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8; texture.wrapS = THREE.RepeatWrapping;
  const Y0 = 1.35, Y1 = 2.05, TILE = 9;
  const along = (g2: THREE.BufferGeometry, u: (x: number, z: number) => number) => {
    const uv = g2.getAttribute('uv') as THREE.BufferAttribute, pos = g2.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u(pos.getX(i), pos.getZ(i)) / TILE);
    return g2.toNonIndexed();
  };
  const parts = [along(new THREE.PlaneGeometry(2 * side - 1, Y1 - Y0).translate(0, (Y0 + Y1) / 2, south + .3), x => x)];
  for (const sx of [-1, 1]) parts.push(along(new THREE.PlaneGeometry(2 * Math.abs(south) - 4, Y1 - Y0).rotateY(-sx * Math.PI / 2).translate(sx * (side - .3), (Y0 + Y1) / 2, -2), (_x, z) => z * sx));
  addMesh(c, mergeGeometries(parts), nearMaterial(c, 'Near stand cloth', { map: texture, roughness: .95, side: THREE.DoubleSide }), 'near stand cloth');
}

function signboard(c: DressContext) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 192;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#b8862e'; g.fillRect(0, 0, 1024, 192);
  g.fillStyle = '#f2ead2'; g.fillRect(14, 14, 996, 164);
  g.strokeStyle = '#6a4a1c'; g.lineWidth = 4; g.strokeRect(24, 24, 976, 144);
  g.fillStyle = '#16120c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 128px serif';
  g.fillText('天下一武道会', 512, 100);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.8).rotateY(Math.PI).translate(0, 7.05, 28.62),
    nearMaterial(c, 'Near hall sign', { map: texture, roughness: .8 }));
  board.name = 'near hall sign'; board.receiveShadow = true;
  c.root.add(board);
}

function findMaterial(model: THREE.Object3D, name: RegExp) {
  let found: THREE.Material | undefined;
  model.traverse(o => {
    if (found || !(o instanceof THREE.Mesh)) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (name.test(m.name)) { found = m; return; }
  });
  return found;
}

function tournamentBanners() {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  const designs: [string, string, string][] = [['#c7262e', '#f2c230', '#f2c230'], ['#f2c230', '#c7262e', '#c7262e'], ['#f4f0e6', '#c7262e', '#c7262e']];
  designs.forEach(([field, edge, mark], i) => {
    const x0 = i * 128;
    g.fillStyle = field; g.fillRect(x0, 0, 128, 1024);
    g.fillStyle = edge; g.fillRect(x0, 0, 10, 1024); g.fillRect(x0 + 118, 0, 10, 1024); g.fillRect(x0, 0, 128, 18);
    g.fillStyle = mark;
    if (i === 2) { g.beginPath(); g.arc(x0 + 64, 300, 40, 0, Math.PI * 2); g.fill(); }
    else {
      g.font = 'bold 92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('武', x0 + 64, 260); g.fillText('道', x0 + 64, 380); g.fillText('会', x0 + 64, 500);
    }
    g.save(); g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.moveTo(x0, 1024); g.lineTo(x0 + 64, 900); g.lineTo(x0 + 128, 1024); g.closePath(); g.fill();
    g.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

function pennantAtlas() {
  const colours = ['#d42b2b', '#f2c12e', '#2f6fd0', '#2e9e4f', '#f4f1e8', '#ee7a22', '#7c3fb0', '#18a4b8'];
  return canvasAtlas(4, 2, 128, (g, i, s) => {
    g.fillStyle = colours[i];
    g.beginPath(); g.moveTo(4, 2); g.lineTo(s - 4, 2); g.lineTo(s / 2, s - 4); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(4, 2, s - 8, 10);
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 3; g.beginPath(); g.moveTo(s / 2, 12); g.lineTo(s / 2, s - 12); g.stroke();
  });
}
