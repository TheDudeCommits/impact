import * as THREE from 'three';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from './dressing';
import { placeProps } from './build';
import { seeded } from './ambient';
import { addMesh, beams, nearMaterial, nearShare, scatterWear, thin, wearDecals, type Beam } from './near';
import { addShaderPatch } from '../look/shaderPatch';
import { crowdCards, figureAtlas, type CrowdSpot } from './crowd';

const BAY = { x: 0, z: 70, r: 84 };
const onIce = (x: number, z: number) => Math.hypot(x - BAY.x, z - BAY.z) < BAY.r;

export async function dressMarineford(c: DressContext) {
  const { kit, ambient } = c;
  const props = STAGE_PROPS.marineford ?? [];
  await Promise.all([
    c.sky({ rotation: .4, drift: .0008, exposure: .95, tint: 0xe4ecff }),
    kit.load(['harbor/crate', 'harbor/barrel', 'harbor/crate-bottles', 'br/kenney-pirate-cannon-mobile', 'br/kenney-pirate-cannon', 'br/kenney-pirate-cannon-ball',
      'br/meshy-rubble', 'br/stone-a', 'br/stone-b']),
  ]);
  placeProps(kit, props);
  kit.shadows.add('harbor/crate').add('harbor/barrel').add('harbor/crate-bottles').add('br/kenney-pirate-cannon-mobile').add('br/meshy-rubble');
  const rng = seeded(1059);
  for (const side of [-1, 1]) {
    const x0 = side * 11, z0 = -18.5;
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 3 - layer; i++) for (let j = 0; j < 3 - layer; j++)
      kit.place('br/kenney-pirate-cannon-ball', { x: x0 + (i - (2 - layer) / 2) * .34, z: z0 + (j - (2 - layer) / 2) * .34, y: layer * .28, scale: .5 });
  }
  for (let i = 0; i < 26; i++) {
    const x = (rng() - .5) * 74, z = -37 + rng() * 24;
    if (Math.abs(x) < 6 && z > -30) continue;
    kit.place(rng() < .5 ? 'br/stone-a' : 'br/stone-b', { x, z, scale: .35 + rng() * .4, rot: rng() * 6, tint: 0xe2e4ea });
  }
  dressMast(c);
  flags(c);
  war(c);
  armies(c);
  iceSheen(c);
  await wear(c);
  kit.flush('marineford');

  ambient.birds({ centre: [0, 0, 40], count: 16, radius: 60, height: 34, spread: 14, speed: 9, size: .6, color: 0xf2f4f8, seed: 71 });
  ambient.birds({ centre: [-60, 0, -90], count: 10, radius: 70, height: 60, spread: 20, speed: 8, size: .7, color: 0xeef2f6, seed: 72 });
  ambient.motes({ min: [-40, .3, -40], max: [40, 9, 40], count: 120, velocity: [.5, .05, .3], size: .035, color: 0xffffff, color2: 0xcdeeff, opacity: .85, wobble: .7, additive: true, twinkle: .8, seed: 73 });
  ambient.motes({ min: [-46, 0, -46], max: [46, 20, 46], count: 220, velocity: [.6, -1.1, .3], size: .055, color: 0xffffff, color2: 0xe6f4ff, opacity: .8, wobble: 1.4, seed: 75 });
  const mist: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 22; i++) {
    const a = rng() * Math.PI * 2, r = 30 + rng() * 50, x = Math.sin(a) * r, z = 70 - Math.cos(a) * r * .8;
    if (onIce(x, z) && (Math.abs(x) > 40 || z > 40)) mist.push({ x, y: .8, z, size: 9 + rng() * 8 });
  }
  ambient.puffs({ spots: mist, color: 0xeef8ff, shade: 0xc8dcec, opacity: .22, life: 16, rise: 1.2, drift: [.6, 0, -.3], grow: 1.6, flat: false, seed: 74 });
}

function dressMast(c: DressContext) {
  const timber = nearMaterial(c, 'Near spars', { color: 0x7a5a42, roughness: .9 });
  const parts: Beam[] = [];
  for (const p of (STAGE_PROPS.marineford ?? []).filter(p => p.draw === 'mast')) {
    const half = (p.length ?? 8) / 2, yaw = p.rot ?? 0, cx = Math.cos(yaw), sx = -Math.sin(yaw);
    parts.push({ a: [p.x - cx * half, .42, p.z - sx * half], b: [p.x + cx * half, .3, p.z + sx * half], w: .5 });
    parts.push({ a: [p.x + cx * (half - 1.2) - sx * 1.6, .2, p.z + sx * (half - 1.2) + cx * 1.6], b: [p.x + cx * (half - .8) + sx * 1.4, .55, p.z + sx * (half - .8) - cx * 1.4], w: .26 });
  }
  addMesh(c, beams(parts, 2), timber, 'near spars', { shadow: true });
}

function flags(c: DressContext) {
  const { ambient } = c;
  const atlas = flagAtlas();
  const poles: Beam[] = [];
  for (const deg of [-62, -46, -34, 34, 46, 62]) {
    const t = deg * Math.PI / 180, x = BAY.x + (BAY.r + 3) * Math.sin(t), z = BAY.z - (BAY.r + 3) * Math.cos(t);
    poles.push({ a: [x, 0, z], b: [x, 13, z], w: .16 });
    ambient.cloth(atlas, { x: x + 1.6, y: 12.6, z, width: 3, height: 2.6, rot: 0, uv: [.5, .5, 1, 1], wind: .9 });
  }
  for (const [x, z, h] of [[-44, -40, 14], [44, -40, 14], [-34, -76, 18], [34, -76, 18], [-60, -70, 16], [60, -70, 16]] as const) {
    poles.push({ a: [x, 0, z], b: [x, h, z], w: .18 });
    ambient.cloth(atlas, { x: x + 1.9, y: h - .4, z, width: 3.6, height: 3, rot: 0, uv: [.5, .5, 1, 1], wind: .85 });
  }
  for (const [x, z] of [[-52, -22], [-66, -30], [52, -22], [66, -30], [-20, -50], [0, -52], [20, -50], [-36, -60], [36, -60]] as const) {
    poles.push({ a: [x, 0, z], b: [x, 7.5, z], w: .1 });
    ambient.cloth(atlas, { x: x + 1.15, y: 7.4, z, width: 2.1, height: 1.6, rot: 0, uv: [.5, .5, 1, 1], wind: .9 });
  }
  for (const x of [-74, -60, 60, 74]) ambient.cloth(atlas, { x, y: 95, z: -141.5, width: 5, height: 16, rot: 0, uv: [0, 0, .5, .5], wind: .35 });
  const name = nameBanners();
  for (const [x, u] of [[-21, 0], [21, .5]] as const) {
    poles.push({ a: [x - 8.1, 20.7, -131.1], b: [x + 8.1, 20.7, -131.1], w: .3 });
    ambient.cloth(name, { x, y: 20.5, z: -131, width: 15, height: 12, rot: 0, uv: [u, 0, u + .5, 1], wind: .25, lit: .35 });
  }
  for (const [x, u] of [[-10, 0], [10, .5]] as const) {
    for (const px of [x - 4.7, x + 4.7]) poles.push({ a: [px, 0, -43.2], b: [px, 11.2, -43.2], w: .22 });
    poles.push({ a: [x - 4.8, 10.6, -43.2], b: [x + 4.8, 10.6, -43.2], w: .18 });
    ambient.cloth(name, { x, y: 10.5, z: -43.1, width: 9, height: 9.4, rot: 0, uv: [u, 0, u + .5, 1], wind: .45, lit: .35 });
  }
  ambient.cloth(atlas, { x: 72.5, y: 54, z: 40, width: 6, height: 4.4, rot: -.7, uv: [0, .5, .5, 1], wind: 1 });
  for (const [x, z, y] of [[-46, 56, 34], [-12, 98, 38], [24, 78, 31]] as const) ambient.cloth(atlas, { x, y, z, width: 4, height: 3, rot: .3, uv: [0, .5, .5, 1], wind: 1 });
  addMesh(c, beams(poles, 2), nearMaterial(c, 'Near flag poles', { color: 0x30384a, roughness: .7 }), 'near flag poles');
}

function war(c: DressContext) {
  const { ambient } = c;
  ambient.fire([
    { x: -12, y: 6, z: 98, size: 6, smoke: 1, seed: .2 }, { x: -46, y: 5, z: 56, size: 4.4, smoke: .8, seed: .5 },
    { x: 104, y: 12, z: -40, size: 4.4, smoke: .9, seed: .8 }, { x: -112, y: 14, z: -24, size: 4, smoke: .9, seed: .35 },
    { x: 24, y: 5, z: 78, size: 4, smoke: .8, seed: .15 },
    { x: -54, y: 1, z: 46, size: 2.6, smoke: .6, seed: .9 }, { x: 46, y: 1, z: 52, size: 2.4, smoke: .6, seed: .45 },
  ]);
  ambient.motes({ min: [-70, 1, 40], max: [40, 22, 110], count: 140, velocity: [-1.2, .9, -.8], size: .07, color: 0xffb060, color2: 0xff7030, opacity: .9, wobble: .8, additive: true, twinkle: .6, seed: 77 });
  const columns: { x: number; y: number; z: number; size: number }[] = [];
  for (const [x, z, h] of [[-12, 98, 10], [-46, 56, 8], [104, -40, 16], [-112, -24, 18], [-70, 92, 9], [140, 30, 20], [-150, 10, 20],
    [24, 78, 9], [0, 150, 30]] as const)
    for (let i = 0; i < 6; i++) columns.push({ x: x + Math.sin(i * 2.1) * 2, y: h + i * 1.4, z: z + Math.cos(i * 1.3) * 2, size: 6 + i * 1.1 });
  ambient.puffs({ spots: columns, color: 0x8a847e, shade: 0x34302c, opacity: .78, life: 14, rise: 30, drift: [2.2, 0, 1.2], grow: 2.4, seed: 75, cel: true });
  const guns: { x: number; y: number; z: number; size: number }[] = [];
  for (const deg of [-94, -72, -52, 52, 72, 94]) {
    const t = deg * Math.PI / 180;
    guns.push({ x: BAY.x + (BAY.r + 8) * Math.sin(t), y: 4, z: BAY.z - (BAY.r + 8) * Math.cos(t), size: 6 });
  }
  for (const deg of [140, 165, 195, 220]) {
    const t = deg * Math.PI / 180;
    guns.push({ x: BAY.x + (BAY.r + 2) * Math.sin(t), y: 31, z: BAY.z - (BAY.r + 2) * Math.cos(t), size: 9 });
  }
  ambient.puffs({ spots: guns, color: 0xf2f0ec, shade: 0xb4b2ae, opacity: .8, life: 9, rise: 6, drift: [-1.2, 0, -.6], grow: 2.4, seed: 76, cel: true });
}

function armies(c: DressContext) {
  const rng = seeded(31);
  const spots: CrowdSpot[] = [];
  const marine = () => Math.floor(rng() * 8), pirate = () => 8 + Math.floor(rng() * 8);
  const put = (x: number, y: number, z: number, cell: number, h = 2.1) => {
    if (Math.abs(x) < 41 && Math.abs(z) < 41) return;
    spots.push({ x, y, z, cell, height: h * (.92 + rng() * .16), flip: rng() < .5 });
  };
  for (const side of [-1, 1]) for (let row = 0; row < 12; row++) for (let k = 0; k < 22; k++)
    put(side * (45 + k * 1.6 + (row % 2) * .8) + (rng() - .5) * .5, 0, -16 - row * 2 + (rng() - .5) * .5, marine());
  for (let row = 0; row < 12; row++) for (let k = 0; k < 56; k++) put(-44 + k * 1.6 + (row % 2) * .8, 0, -44 - row * 2, marine());
  for (let row = 0; row < 4; row++) for (let k = 0; k < 110; k++) put(-140 + k * 2.55, 8.75, -90 - row * 2.6, marine());
  for (let k = 0; k < 90; k++) { const t = rng(); put(-28 + rng() * 56, 8.75 * t, -81 - t * 14, marine()); }
  for (let k = 0; k < 160; k++) {
    const t = (rng() < .5 ? -1 : 1) * (.5 + rng() * 1.6), r = BAY.r + 2 + rng() * 6;
    put(BAY.x + r * Math.sin(t), 0, BAY.z - r * Math.cos(t), marine());
  }
  for (let k = 0; k < 260; k++) {
    const t = (rng() < .5 ? -1 : 1) * (28 + rng() * 94) * Math.PI / 180, r = BAY.r + 30 + (rng() - .5) * 2;
    const x = BAY.x + r * Math.sin(t), z = BAY.z - r * Math.cos(t);
    if (Math.abs(x) < 112 && z < 118) put(x, 9.6, z, marine());
  }
  for (let k = 0; k < 140; k++) {
    const t = (118 + rng() * 124) * Math.PI / 180, r = BAY.r + 2.5 + (rng() - .5) * 3;
    put(BAY.x + r * Math.sin(t), 31, BAY.z - r * Math.cos(t), marine());
  }
  for (let k = 0; k < 900; k++) {
    const x = (rng() - .5) * 150, z = 44 + rng() * 80;
    if (onIce(x, z)) put(x, 0, z, pirate());
  }
  for (const [x, z] of [[-46, 56], [-12, 98], [24, 78], [73, 41]] as const)
    for (let k = 0; k < 40; k++) { const a = rng() * Math.PI * 2, r = 14 + rng() * 14; put(x + Math.cos(a) * r, 0, z + Math.sin(a) * r, pirate()); }
  const atlas = figureAtlas(8, 2, 96, 192, drawFigure);
  crowdCards(c, atlas, 8, 2, spots, { name: 'marineford armies', aspect: .5, shade: .92, sway: .03 });
}

function drawFigure(g: CanvasRenderingContext2D, i: number, w: number, h: number) {
  const r = seeded(101 + i * 7);
  const marine = i < 8;
  const cx = w / 2, ink = '#141820';
  const skin = ['#f2c8a0', '#e0a87c', '#c98a5e', '#f6d4b0'][Math.floor(r() * 4)];
  const coat = marine ? (r() < .7 ? '#f4f4f0' : '#e8ecf2') : ['#7a4a44', '#4a5e48', '#54486a', '#806048', '#3e5070', '#6a5446', '#a8a090', '#3a3a44'][i - 8];
  const legs = marine ? (r() < .5 ? '#3a5a8c' : '#f0f0ec') : ['#3a3a44', '#5a4a3a', '#2a3a5a', '#4a4a4a'][Math.floor(r() * 4)];
  const lean = (r() - .5) * .25 + (marine ? 0 : .15);
  g.save(); g.translate(cx, h * .98); g.rotate(lean); g.translate(-cx, -h * .98);
  g.lineWidth = 4; g.strokeStyle = ink; g.lineJoin = 'round';
  const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
  const stride = (r() - .5) * 18;
  shape(legs, () => { g.moveTo(cx - 12, h * .58); g.lineTo(cx - 14 - stride, h * .97); g.lineTo(cx - 3 - stride, h * .97); g.lineTo(cx, h * .66); g.lineTo(cx + 3 + stride, h * .97); g.lineTo(cx + 14 + stride, h * .97); g.lineTo(cx + 12, h * .58); g.closePath(); });
  shape(coat, () => { g.moveTo(cx - 18, h * .3); g.lineTo(cx + 18, h * .3); g.lineTo(cx + 21, h * .64); g.lineTo(cx - 21, h * .64); g.closePath(); });
  if (marine) shape('#2a5ab0', () => { g.moveTo(cx - 14, h * .3); g.lineTo(cx + 14, h * .3); g.lineTo(cx, h * .4); g.closePath(); });
  const raised = r() < .5;
  g.lineWidth = 9; g.strokeStyle = ink; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx + 15, h * .33); g.lineTo(cx + 26, raised ? h * .16 : h * .42); g.stroke();
  g.lineWidth = 6; g.strokeStyle = coat;
  g.beginPath(); g.moveTo(cx + 15, h * .33); g.lineTo(cx + 26, raised ? h * .16 : h * .42); g.stroke();
  g.lineWidth = 4; g.strokeStyle = marine && !raised ? '#3a3a40' : '#c8ccd4';
  g.beginPath(); g.moveTo(cx + 26, raised ? h * .16 : h * .42); g.lineTo(cx + (raised ? 34 : 46), raised ? h * .02 : h * .36); g.stroke();
  g.lineWidth = 9; g.strokeStyle = ink;
  g.beginPath(); g.moveTo(cx - 15, h * .33); g.lineTo(cx - 24, h * .5); g.stroke();
  g.lineWidth = 6; g.strokeStyle = coat;
  g.beginPath(); g.moveTo(cx - 15, h * .33); g.lineTo(cx - 24, h * .5); g.stroke();
  g.lineWidth = 4; g.strokeStyle = ink;
  shape(skin, () => { g.arc(cx, h * .22, 12, 0, Math.PI * 2); });
  if (marine) {
    shape('#f6f6f2', () => { g.moveTo(cx - 14, h * .2); g.quadraticCurveTo(cx, h * .07, cx + 14, h * .2); g.closePath(); });
    g.fillStyle = '#2a5ab0'; g.fillRect(cx - 13, h * .185, 26, 4);
  } else {
    const hat = ['#c83a32', '#2a2a30', '#e8d8a8', '#3a7a3e'][Math.floor(r() * 4)];
    if (r() < .5) shape(hat, () => { g.moveTo(cx - 13, h * .21); g.quadraticCurveTo(cx, h * .1, cx + 13, h * .21); g.lineTo(cx + 18, h * .22); g.lineTo(cx - 6, h * .22); g.closePath(); });
    else { g.fillStyle = '#2a2018'; g.beginPath(); g.arc(cx, h * .26, 9, 0, Math.PI); g.fill(); }
  }
  g.restore();
}

function iceSheen(c: DressContext) {
  const sky = new THREE.Color(0xc4dcf4), crest = new THREE.Color(0xf4fbff);
  const sun = new THREE.Vector3(-.5, .64, .58).normalize(), glint = new THREE.Color(0xfff2dc);
  c.model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshStandardMaterial;
    if (!/^Marineford_(Ice|Cover_Ice)$/.test(m.name)) return;
    const rings = m.name === 'Marineford_Ice';
    if (rings) m.color.multiply(new THREE.Color(.8, .86, .9));
    addShaderPatch(m, `marineford-ice-${rings ? 'sheet-v2' : 'plates'}`, shader => {
      shader.vertexShader = 'varying vec3 vIceWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vIceWorld = ( modelMatrix * vec4( transformed, 1. ) ).xyz;`);
      shader.fragmentShader = 'varying vec3 vIceWorld;\n' + shader.fragmentShader;
      if (rings) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 iceD = vIceWorld.xz - vec2( 0., 6. );
          float iceR = length( iceD ), iceA = atan( iceD.y, iceD.x );
          float iceWob = sin( iceA * 5. + iceR * .04 ) * .8 * smoothstep( 6., 30., iceR );
          // Round 2: two arms winding out from where Aokiji froze it (R4's swirl; round 1's rings read as rounded squares).
          float iceWave = sin( iceR * .42 + iceA * 2. + iceWob );
          // Feathered frost bands: a hard crest, a soft frosted fall behind it (R4's frozen bay).
          float iceBand = ( smoothstep( .7, .93, iceWave ) * .8 + smoothstep( .2, .7, iceWave ) * .2 ) * smoothstep( 120., 70., iceR );
          diffuseColor.rgb = mix( diffuseColor.rgb, vec3( ${crest.r.toFixed(3)}, ${crest.g.toFixed(3)}, ${crest.b.toFixed(3)} ), iceBand * .42 );
        }`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 iceView = normalize( cameraPosition - vIceWorld );
          float iceFres = pow( 1. - clamp( dot( normalize( vNormal ), normalize( ( viewMatrix * vec4( iceView, 0. ) ).xyz ) ), 0., 1. ), 3. );
          totalEmissiveRadiance += vec3( ${sky.r.toFixed(3)}, ${sky.g.toFixed(3)}, ${sky.b.toFixed(3)} ) * iceFres * .34;
          // The sun's glint off the glassy sheet: a tight highlight along its reflection.
          vec3 iceN = normalize( ( vec4( normalize( vNormal ), 0. ) * viewMatrix ).xyz );
          float iceGlint = pow( max( dot( reflect( -iceView, iceN ), vec3( ${sun.x.toFixed(3)}, ${sun.y.toFixed(3)}, ${sun.z.toFixed(3)} ) ), 0. ), 60. );
          totalEmissiveRadiance += vec3( ${glint.r.toFixed(3)}, ${glint.g.toFixed(3)}, ${glint.b.toFixed(3)} ) * iceGlint * .55;
        }`);
    });
  });
}

async function wear(c: DressContext) {
  const share = nearShare();
  const rng = seeded(4651);
  const spot = (): [number, number] => [(rng() - .5) * 80, (rng() - .5) * 80];
  const plaza = scatterWear(rng, {
    share, spot, floor: (x, z) => !onIce(x, z) && Math.abs(x) < 42 && z > -42 && z < 0 ? 0 : undefined,
    kinds: {
      crack: { count: 22, size: [3, 7], opacity: [.65, .95] },
      crater: { count: 3, size: [4, 6], opacity: [.6, .85] },
      scorch: { count: 6, size: [3, 5], opacity: [.45, .7] },
      chips: { count: 18, size: [1.6, 2.8], tint: [0xe4e8ee, 0xd4dae2] },
      dust: { count: 10, size: [3, 6], tint: [0xf0f4f8, 0xffffff], opacity: [.3, .5] },
      scuff: { count: 10, size: [2.5, 4.5], opacity: [.4, .7] },
    },
  });
  const ice = scatterWear(rng, {
    share, spot, floor: (x, z) => onIce(x, z) && Math.abs(x) < 42 && z < 42 ? 0 : undefined,
    kinds: {
      crack: { count: 6, size: [3, 6], tint: [0xb0d4ee, 0xc4e0f2], opacity: [.18, .3] },
      dust: { count: 26, size: [4, 9], tint: [0xffffff, 0xf2fbff], opacity: [.35, .6] },
      chips: { count: 16, size: [1.6, 2.6], tint: [0xffffff, 0xe8f6ff] },
      stain: { count: 10, size: [3, 6], tint: 0xe8f6ff, opacity: [.3, .5] },
    },
  });
  await wearDecals(c, [...plaza, ...thin(ice, 1)], 'near wear');
}

function nameBanners() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const g = canvas.getContext('2d')!;
  for (const [k, ch] of [[0, '海'], [1, '軍']] as const) {
    const x0 = k * 256;
    g.fillStyle = '#1e2f5c'; g.fillRect(x0, 0, 256, 256);
    g.strokeStyle = '#f4f2ec'; g.lineWidth = 8; g.strokeRect(x0 + 10, 10, 236, 236);
    g.fillStyle = '#f4f2ec'; g.font = 'bold 190px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, x0 + 128, 138);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

function flagAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#141418'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#f4f2ec';
  g.save(); g.translate(128, 120);
  for (const a of [.6, -.6]) { g.save(); g.rotate(a); g.fillRect(-92, -11, 184, 22); for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 92, -8, 13, 0, Math.PI * 2); g.arc(s * 92, 8, 13, 0, Math.PI * 2); g.fill(); } g.restore(); }
  g.beginPath(); g.ellipse(0, -14, 50, 46, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(-28, 14, 56, 30);
  g.fillStyle = '#141418';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 19, -18, 12, 14, 0, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.moveTo(0, -4); g.lineTo(-6, 8); g.lineTo(6, 8); g.fill();
  g.fillStyle = '#f4f2ec';
  g.beginPath(); g.moveTo(-86, -6); g.quadraticCurveTo(0, 46, 86, -6); g.quadraticCurveTo(0, 22, -86, -6); g.fill();
  g.restore();
  g.fillStyle = '#f6f6f2'; g.fillRect(256, 0, 256, 256);
  g.strokeStyle = '#2a64c8'; g.lineWidth = 11; g.lineCap = 'round';
  g.beginPath(); g.moveTo(318, 96); g.quadraticCurveTo(350, 56, 384, 104); g.quadraticCurveTo(418, 56, 450, 96); g.stroke();
  g.fillStyle = '#2a64c8'; g.beginPath(); g.arc(384, 106, 9, 0, Math.PI * 2); g.fill();
  g.textAlign = 'center'; g.font = 'bold 46px sans-serif'; g.fillText('MARINE', 384, 178);
  g.fillRect(256, 226, 256, 14);
  g.fillStyle = '#1e2f5c'; g.fillRect(0, 256, 256, 256);
  g.fillStyle = '#f4f2ec'; g.font = 'bold 96px serif';
  g.fillText('正', 128, 360); g.fillText('義', 128, 470);
  g.fillStyle = '#e8e4da'; g.fillRect(256, 256, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}
