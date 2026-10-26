import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from './dressing';
import { ModelProbe, placeProps, stageMaterial } from './build';
import { addShaderPatch } from '../look/shaderPatch';
import { seeded } from './ambient';
import { eniesIsland, GATE } from './eniesIsland';
import { heroAir } from './hero';
import { addMesh, canvasAtlas, flutter, hangingCloth, nearMaterial, nearShare, ropes, scatterWear, thin, wearDecals,
  type Hang, type Line } from './near';

const WOOD = 0xa8acb4;

export async function dressEniesLobby(c: DressContext) {
  const { kit, ambient, root } = c;
  kit.grade = (material, piece) => {
    if (/cannon/.test(piece)) material.color.multiplyScalar(1.9);
    else if (/crate|barrel/.test(piece)) material.color.multiplyScalar(1.35);
  };
  await Promise.all([
    c.sky({ rotation: -1.6, drift: .001, horizon: -.15, tint: 0xb4d0ff }),
    kit.load(['harbor/crate', 'harbor/barrel', 'harbor/crate-bottles', 'br/kenney-pirate-cannon-mobile', 'br/kenney-pirate-cannon', 'br/kenney-town-lantern',
      'br/kenney-pirate-cannon-ball']),
  ]);
  const deckMap = await c.texture('/assets/environment/br/enies-deck.webp', { repeat: 1, anisotropy: 8 });
  c.model.traverse(o => {
    const mesh = o as THREE.Mesh, m = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!mesh.isMesh || !m) return;
    if (/5_sea/.test(m.name)) { m.color.setRGB(.62, 1.05, 1.15); heroAir(m, .4); }
    if (/5_doors/.test(m.name)) mesh.visible = false;
    if (/7_background/.test(m.name)) mesh.visible = false;
    if (/5_house01/.test(m.name)) mesh.visible = false;
    if (/ground01/.test(m.name)) crispDeck(m, deckMap);
  });
  root.add(gatesOfJustice(c));
  root.add(trusses(c));
  root.add(farIsland(c));
  eniesIsland(c);
  const underMaterial = stageMaterial(c.stage, 'Bridge underlay', { color: 0x9a9890, roughness: 1 });
  crispDeck(underMaterial, deckMap);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(27, 112).rotateX(-Math.PI / 2), underMaterial);
  under.position.y = -.06; under.receiveShadow = true; under.name = 'bridge underlay';
  root.add(under);

  placeProps(kit, STAGE_PROPS['enies-lobby'] ?? []);
  const flags = flagAtlas();
  const rng = seeded(2024);
  for (const side of [-1, 1]) {
    for (let z = -50; z <= 50; z += 12.5) {
      const x = side * 14.2;
      ambient.cloth(flags, { x, y: 9.6, z, width: 2.6, height: 4.4, rot: side * Math.PI / 2, uv: [(Math.round(z / 12.5) + 4) % 2 * .5, 0, (Math.round(z / 12.5) + 4) % 2 * .5 + .5, 1], wind: .9, readable: true, lit: .35 });
      kit.place('br/kenney-town-lantern', { x: side * 13.7, z: z + 6.25, scale: 2.6, tint: 0xd8dce8 });
    }
    for (let z = -44; z <= 44; z += 22) {
      kit.place('br/kenney-pirate-cannon', { x: side * 15.4, z, rot: side * Math.PI / 2, scale: 1.8, tint: 0x8494b0 });
      for (let k = 0; k < 3; k++) kit.place('br/kenney-pirate-cannon-ball', { x: side * (15.2 + rng() * .6), z: z + 2.4 + k * .5, scale: .45 });
    }
  }
  const poles: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) for (let z = -50; z <= 50; z += 12.5) poles.push(new THREE.CylinderGeometry(.07, .09, 10.4, 6).translate(side * 14.25, 5.2, z));
  const mast = new THREE.Mesh(mergeGeometries(poles)!, stageMaterial(c.stage, 'Flag masts', { color: 0x2a3040, roughness: .7 }));
  poles.forEach(g => g.dispose()); mast.name = 'flag masts'; root.add(mast);
  kit.shadows.add('harbor/crate').add('harbor/barrel').add('harbor/crate-bottles').add('br/kenney-pirate-cannon-mobile');
  await dressNear(c, flags);
  kit.flush('enies-lobby');

  ambient.birds({ centre: [0, 0, 0], count: 16, radius: 40, height: 22, spread: 12, speed: 9, size: .55, color: 0xf2f4f8, seed: 61 });
  ambient.birds({ centre: [60, 0, -120], count: 10, radius: 70, height: 30, spread: 20, speed: 8, size: .6, color: 0xeef2f6, seed: 62 });
  ambient.motes({ min: [-13, .5, -52], max: [13, 8, 52], count: 90, velocity: [.6, .1, .3], size: .04, color: 0xffffff, color2: 0xd8f0ff, opacity: .8, wobble: .8, additive: true, twinkle: .7, seed: 63 });
}

async function dressNear(c: DressContext, flags: THREE.Texture) {
  const { kit, ambient, model, stage } = c;
  const share = nearShare();
  const rng = seeded(1515);
  const deck = new ModelProbe(model, mesh => /ground01/.test((mesh.material as THREE.Material).name));
  const floor = (x: number, z: number) => deck.top(x, z, 20) ?? 0;

  const lines = signalLines();
  if (lines.length) {
    const signals: Hang[] = [];
    for (const line of lines) for (let s = .9; s < 28; s += .92) signals.push({ line, t: s / 28.5, width: .66, height: .62 + rng() * .08, cell: Math.floor(rng() * 16) });
    addMesh(c, ropes(lines, { radius: .022 }), nearMaterial(c, 'Near halyards', { color: 0x2a3040, roughness: .8 }), 'near halyards');
    addMesh(c, hangingCloth(thin(signals, share), 4, 4), flutter(nearMaterial(c, 'Near signal flags', { map: signalAtlas(), cloth: true }), ambient.time, .14), 'near signal flags');
  }

  const camp: [number, number][] = [[24, -31], [22, -8], [26, 3], [24, 33], [23, 47], [-24, -42], [-24, -14], [-22, 6], [-26, 20], [-24, 45]];
  for (const [x, z] of camp) {
    const side = Math.sign(x);
    const stack = (sx: number, sz: number, high: number, rot: number) => {
      for (let k = 0; k < high; k++) kit.place('harbor/crate', { x: sx, z: sz, y: floor(sx, sz) + k * .77 * 1.3, rot: rot + k * .3, scale: 1.3, tint: WOOD });
    };
    stack(x - side * .6, z - 1.2, 2, rng());
    stack(x + side * .5, z + 1.1, 1 + Math.floor(rng() * 2), rng());
    kit.place('harbor/crate-bottles', { x: x + side * 2.6, z: z - 2.4, y: floor(x + side * 2.6, z - 2.4), rot: rng() * 6, scale: 1.3, tint: WOOD });
    for (let k = 0; k < 3; k++) kit.place('harbor/barrel', { x: x - side * (2.8 + rng() * .6), z: z + 2.2 + k * 1.3, y: floor(x, z), scale: .9, tint: WOOD });
  }
  for (const side of [-1, 1]) for (let z = -46; z <= 46; z += 15.5) {
    const x = side * (17.5 + rng() * 2.5), zz = z + side * 4 + (rng() - .5) * 3;
    kit.place('harbor/crate', { x, z: zz, y: floor(x, zz), rot: rng() * 6, scale: 1.3, tint: WOOD });
    if (rng() < .6) kit.place('harbor/crate', { x, z: zz, y: floor(x, zz) + 1, rot: rng() * 6, scale: 1.2, tint: WOOD });
    kit.place('harbor/barrel', { x: x + side * 1.4, z: zz + 1.1, y: floor(x, zz), scale: .9, tint: WOOD });
  }
  for (const side of [-1, 1]) for (let z = -33; z <= 33; z += 22) {
    const x0 = side * 18.5, y0 = floor(x0, z);
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 3 - layer; i++) for (let j = 0; j < 3 - layer; j++)
      kit.place('br/kenney-pirate-cannon-ball', { x: x0 + (i - (2 - layer) / 2) * .3, z: z + (j - (2 - layer) / 2) * .3, y: y0 + layer * .25, scale: .45 });
  }

  const columns: THREE.BufferGeometry[] = [], gold: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) for (const z of [-44, -14, 16, 46]) {
    const x = side * 33, y = floor(x, z);
    columns.push(new THREE.BoxGeometry(2, 1, 2).translate(x, y + .5, z), new THREE.CylinderGeometry(.62, .7, 8.4, 8).translate(x, y + 5.2, z),
      new THREE.BoxGeometry(1.7, .5, 1.7).translate(x, y + 9.6, z));
    gold.push(new THREE.SphereGeometry(.75, 12, 8).translate(x, y + 10.6, z));
    ambient.cloth(flags, { x: x - side * .9, y: y + 8.8, z, width: 1.8, height: 3, rot: -side * Math.PI / 2, uv: [.5, 0, 1, 1], wind: .9, readable: true, lit: .35 });
  }
  const stone = nearMaterial(c, 'Near columns', { color: 0xe6e8ea, roughness: .9 });
  addMesh(c, mergeGeometries(columns.map(g => g.index ? g.toNonIndexed() : g)), stone, 'near columns', { shadow: true });
  addMesh(c, mergeGeometries(gold.map(g => g.index ? g.toNonIndexed() : g)), nearMaterial(c, 'Near gold', { color: 0xd8a83a, roughness: .55 }), 'near gold');
  columns.forEach(g => g.dispose()); gold.forEach(g => g.dispose());

  const spot = (): [number, number] => [(rng() - .5) * 30, (rng() - .5) * 100];
  const decals = scatterWear(rng, {
    share, spot, floor: (x, z) => Math.abs(x) < 14.5 && Math.abs(z) < 51 ? floor(x, z) : undefined,
    kinds: {
      crack: { count: 10, size: [2, 4], opacity: [.3, .45] },
      crater: { count: 2, size: [3.5, 5], opacity: [.35, .5] },
      scorch: { count: 4, size: [2.5, 4], opacity: [.25, .4] },
      chips: { count: 22, size: [1.6, 2.8], tint: [0xd8dde2, 0xc4ccd4] },
      dust: { count: 16, size: [3, 6.5], tint: [0xe8f0f8, 0xffffff], opacity: [.35, .6] },
      stain: { count: 10, size: [2, 4], tint: 0xc8d4e0, opacity: [.3, .5] },
      scuff: { count: 12, size: [2.5, 4.5], opacity: [.4, .7] },
    },
  });
  await wearDecals(c, decals, 'near wear');
}

export function signalLines(): Line[] {
  return [];
}

function signalAtlas() {
  const R = '#c8262c', B = '#1f4fa8', Y = '#f1c21b', W = '#f4f3ee', K = '#1a1a1e';
  return canvasAtlas(4, 4, 128, (g, i, s) => {
    const rect = (c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x * s, y * s, w * s, h * s); };
    switch (i) {
      case 0: rect(W, 0, 0, .5, 1); rect(B, .5, 0, .5, 1); break;
      case 1: rect(R, 0, 0, 1, 1); break;
      case 2: rect(B, 0, 0, 1, .2); rect(W, 0, .2, 1, .2); rect(R, 0, .4, 1, .2); rect(W, 0, .6, 1, .2); rect(B, 0, .8, 1, .2); break;
      case 3: rect(Y, 0, 0, 1, 1); rect(B, 0, .3, 1, .4); break;
      case 4: rect(B, 0, 0, 1, .5); rect(R, 0, .5, 1, .5); break;
      case 5: rect(W, 0, 0, 1, 1); g.fillStyle = R; g.beginPath(); g.moveTo(s / 2, 4); g.lineTo(s - 4, s / 2); g.lineTo(s / 2, s - 4); g.lineTo(4, s / 2); g.fill(); break;
      case 6: for (let k = 0; k < 6; k++) rect(k % 2 ? B : Y, k / 6, 0, 1 / 6, 1); break;
      case 7: rect(W, 0, 0, .5, 1); rect(R, .5, 0, .5, 1); break;
      case 8: rect(Y, 0, 0, 1, 1); g.fillStyle = K; g.beginPath(); g.arc(s / 2, s / 2, s * .22, 0, Math.PI * 2); g.fill(); break;
      case 9: rect(B, 0, 0, 1, 1); rect(W, 0, .33, 1, .34); break;
      case 10: rect(Y, 0, 0, .5, 1); rect(B, .5, 0, .5, 1); break;
      case 11: rect(Y, 0, 0, .5, .5); rect(K, .5, 0, .5, .5); rect(K, 0, .5, .5, .5); rect(Y, .5, .5, .5, .5); break;
      case 12: rect(B, 0, 0, 1, 1); g.strokeStyle = W; g.lineWidth = s * .16; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, s); g.moveTo(s, 0); g.lineTo(0, s); g.stroke(); break;
      case 13: for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) rect((a + b) % 2 ? W : B, a / 4, b / 4, .25, .25); break;
      case 14: rect(Y, 0, 0, 1, 1); g.fillStyle = R; g.beginPath(); g.moveTo(0, 0); g.lineTo(s, 0); g.lineTo(0, s); g.fill(); break;
      default: rect(B, 0, 0, 1, 1); rect(W, .3, .3, .4, .4); break;
    }
    if (i < 2) { g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(s, 0); g.lineTo(s * .7, s / 2); g.lineTo(s, s); g.fill(); g.restore(); }
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, s, 5);
  });
}

function flagAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const g = canvas.getContext('2d')!;
  for (const x0 of [0, 256]) {
    const cx = x0 + 128, cy = 220;
    g.fillStyle = '#f4f4f0'; g.fillRect(x0, 0, 256, 512);
    g.fillStyle = '#141414';
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      g.beginPath();
      g.moveTo(cx - dy * 14, cy + dx * 14); g.lineTo(cx + dx * 100 - dy * 44, cy + dy * 100 + dx * 44);
      g.quadraticCurveTo(cx + dx * 86, cy + dy * 86, cx + dx * 100 + dy * 44, cy + dy * 100 - dx * 44);
      g.lineTo(cx + dy * 14, cy - dx * 14); g.closePath(); g.fill();
    }
    g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#141414'; g.fillRect(x0, 444, 256, 18);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

function crispDeck(material: THREE.MeshStandardMaterial, map: THREE.Texture) {
  addShaderPatch(material, 'enies-deck-v1', shader => {
    shader.uniforms.uDeckMap = { value: map };
    shader.vertexShader = 'varying vec3 vDeckWorld;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n\tvDeckWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = 'uniform sampler2D uDeckMap;\nvarying vec3 vDeckWorld;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
	#ifndef FLAT_SHADED
	float deckOn = smoothstep( .8, .95, dot( normalize( vNormal ), normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ) )
		* step( abs( vDeckWorld.y ), .7 ) * step( abs( vDeckWorld.x ), 40.5 );
	diffuseColor.rgb = mix( diffuseColor.rgb, texture2D( uDeckMap, vDeckWorld.xz / 6.0 ).rgb, deckOn );
	#endif`);
  });
}

function gatesOfJustice(c: DressContext) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  const cx = 512, cy = 512, R = 500;
  const steel = g.createLinearGradient(0, 0, 0, 1024);
  steel.addColorStop(0, '#4c6884'); steel.addColorStop(1, '#344a62');
  g.fillStyle = steel; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.save(); g.beginPath(); g.arc(cx, cy, R - 30, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(220,236,250,.28)'; g.beginPath(); g.arc(cx, cy, R - 30, 0, Math.PI * 2); g.arc(cx + 70, cy + 70, R - 40, 0, Math.PI * 2, true); g.fill('evenodd');
  g.restore();
  g.lineWidth = 26; g.strokeStyle = '#b4c8dc'; g.beginPath(); g.arc(cx, cy, R - 13, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 10; g.strokeStyle = '#1c2a3c'; g.beginPath(); g.arc(cx, cy, R - 4, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 6; g.strokeStyle = '#3b5068'; g.beginPath(); g.arc(cx, cy, R - 30, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, R - 120, 0, Math.PI * 2); g.stroke();
  for (const [dx, dy, r] of [[0, 0, 92], [0, -250, 74], [0, 250, 74], [-250, 0, 74], [250, 0, 74]]) {
    g.fillStyle = '#1c2c42'; g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#a8c0d6'; g.lineWidth = 6; g.beginPath(); g.arc(cx + dx, cy + dy, r - 3, -.2, Math.PI * .7); g.stroke();
    g.strokeStyle = '#2e4258'; g.beginPath(); g.arc(cx + dx, cy + dy, r - 3, Math.PI * .8, Math.PI * 1.7); g.stroke();
  }
  g.fillStyle = '#3b5068'; g.fillRect(cx - 5, cy - R + 30, 10, 2 * R - 60);
  g.fillStyle = '#3b5068';
  for (const ring of [R - 50, R - 100]) for (let k = 0; k < 72; k++) { const t = k / 72 * Math.PI * 2; g.beginPath(); g.arc(cx + Math.cos(t) * ring, cy + Math.sin(t) * ring, 7, 0, Math.PI * 2); g.fill(); }
  for (let y = cy - R + 70; y < cy + R - 60; y += 38) for (const dx of [-22, 22]) { g.beginPath(); g.arc(cx + dx, y, 5, 0, Math.PI * 2); g.fill(); }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const gate = new THREE.Mesh(new THREE.PlaneGeometry(480, 480), new THREE.MeshBasicMaterial({ name: 'Gates of Justice', map, alphaTest: .5, fog: false }));
  gate.position.set(0, 85, -400);
  gate.name = 'gates of justice';
  const rim = new THREE.Mesh(new THREE.TorusGeometry(236, 6, 6, 96), new THREE.MeshBasicMaterial({ name: 'Gates of Justice rim', color: 0x24344a, fog: false }));
  rim.position.z = 1.5; rim.name = 'gates rim';
  gate.add(rim);
  return gate;
}

function trusses(c: DressContext) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const g = canvas.getContext('2d')!;
  const steel = '#d2dee8', edge = '#5a7690';
  const member = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    for (const [colour, width] of [[edge, w + 6], [steel, w]] as const) {
      g.strokeStyle = colour; g.lineWidth = width; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
  };
  member(0, 490, 256, 22, 34); member(256, 22, 512, 490, 34);
  member(0, 26, 512, 26, 52); member(0, 486, 512, 486, 52);
  member(14, 0, 14, 512, 28); member(498, 0, 498, 512, 28);
  g.fillStyle = '#3f9a5a'; for (const x of [0, 484]) g.fillRect(x, 200, 28, 112);
  g.fillStyle = edge;
  for (let x = 16; x < 512; x += 32) for (const y of [14, 30, 482, 498]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; map.wrapS = THREE.RepeatWrapping;
  const from = -185, to = GATE - 1, length = to - from, H = 5.5;
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const plane = new THREE.PlaneGeometry(length, H);
    const uv = plane.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length / H);
    parts.push(plane.rotateY(side * Math.PI / 2).translate(side * 42, H / 2, (from + to) / 2));
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), stageMaterial(c.stage, 'Bridge trusses', { map, alphaTest: .5, side: THREE.DoubleSide, roughness: .6 }));
  mesh.name = 'bridge trusses';
  const drums: THREE.BufferGeometry[] = [], caps: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) for (let z = -175; z < GATE - 5; z += 25) {
    const x = side * 42.6;
    drums.push(band(new THREE.CylinderGeometry(1.7, 1.9, 11, 12, 22).translate(x, 5.5, z)));
    caps.push(new THREE.SphereGeometry(1.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, 11, z));
  }
  const drumMesh = new THREE.Mesh(mergeGeometries(drums), stageMaterial(c.stage, 'Bridge pylons', { color: 0xffffff, vertexColors: true, roughness: .7 }));
  const capMesh = new THREE.Mesh(mergeGeometries(caps), stageMaterial(c.stage, 'Bridge pylon caps', { color: 0xd8a83a, roughness: .5 }));
  drumMesh.name = 'bridge pylons'; capMesh.name = 'bridge pylon caps';
  drums.forEach(g => g.dispose()); caps.forEach(g => g.dispose());
  const group = new THREE.Group(); group.add(mesh, drumMesh, capMesh);
  return group;
}

function farIsland(c: DressContext) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const g = canvas.getContext('2d')!;
  const white = '#f3efe2', shade = '#c9cfe8', green = '#5baa62', line = '#3e8a4a', gold = '#e7d79a';
  g.fillStyle = white; g.fillRect(20, 150, 300, 874);
  g.fillStyle = shade; g.fillRect(230, 150, 90, 874);
  for (let x = 20; x < 320; x += 50) { g.fillStyle = white; g.fillRect(x, 112, 30, 40); g.fillStyle = shade; if (x > 220) g.fillRect(x, 112, 30, 40); }
  g.fillStyle = white; g.fillRect(40, 190, 260, 92);
  g.save(); g.translate(170, 236); g.rotate(-.12); g.fillStyle = '#2c3e6c'; g.font = 'bold 44px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ENIES LOBBY', 0, 0, 240); g.restore();
  g.fillStyle = gold; g.fillRect(20, 300, 300, 10); g.fillRect(20, 560, 300, 10);
  g.save(); g.beginPath(); g.rect(36, 318, 268, 236); g.clip();
  g.fillStyle = green; g.fillRect(36, 318, 268, 236);
  g.strokeStyle = line; g.lineWidth = 4;
  for (let k = -12; k < 20; k++) { g.beginPath(); g.moveTo(36 + k * 26, 318); g.lineTo(36 + k * 26 + 236, 554); g.stroke(); g.beginPath(); g.moveTo(36 + k * 26, 554); g.lineTo(36 + k * 26 + 236, 318); g.stroke(); }
  g.restore();
  for (const x of [80, 170, 260]) {
    const arch = g.createLinearGradient(0, 640, 0, 1000);
    arch.addColorStop(0, '#3fa0c8'); arch.addColorStop(1, '#e6f6fa');
    g.fillStyle = gold; g.beginPath(); g.arc(x, 690, 38, Math.PI, 0); g.lineTo(x + 24, 760); g.lineTo(x + 24, 1000); g.lineTo(x - 24, 1000); g.lineTo(x - 24, 760); g.lineTo(x - 38, 690); g.fill();
    g.fillStyle = arch; g.beginPath(); g.arc(x, 690, 30, Math.PI, 0); g.lineTo(x + 16, 760); g.lineTo(x + 16, 1000); g.lineTo(x - 16, 1000); g.lineTo(x - 16, 760); g.lineTo(x - 30, 690); g.fill();
  }
  g.fillStyle = '#4a4a50'; g.fillRect(166, 0, 6, 116);
  g.fillStyle = white; g.fillRect(172, 6, 70, 46);
  g.fillStyle = '#141414'; g.fillRect(201, 12, 12, 34); g.fillRect(188, 23, 38, 12);
  for (let bank = 0; bank < 3; bank++) {
    const y0 = 120 + bank * 320;
    const puffs: [number, number, number][] = [];
    for (let k = 0; k < 9; k++) puffs.push([400 + k * 68 + (bank * 23 % 40), y0 + 150 - Math.sin(k * 1.3 + bank) * 50 - (k % 3) * 18, 70 + ((k * 37 + bank * 11) % 45)]);
    g.fillStyle = '#b4c6ea';
    for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x, y + 18, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#ffffff';
    for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x, y, r * .92, 0, Math.PI * 2); g.fill(); }
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(360, y0 + 200, 664, 120); g.restore();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const parts: THREE.BufferGeometry[] = [];
  const card = (w: number, h: number, at: [number, number, number], [u0, v0, u1, v1]: [number, number, number, number]) => {
    const plane = new THREE.PlaneGeometry(w, h);
    const uv = plane.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    parts.push(plane.translate(...at));
  };
  card(53, 160, [118, 30, -300], [0, 0, 340 / 1024, 1]);
  const bank = (b: number): [number, number, number, number] => [360 / 1024, 1 - (120 + b * 320 + 210) / 1024, 1, 1 - (120 + b * 320 - 10) / 1024];
  card(330, 110, [-150, -30, -380], bank(0));
  card(330, 110, [170, -40, -386], bank(1));
  card(240, 80, [150, -38, -280], bank(2));
  card(260, 90, [0, -60, -360], bank(1));
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ name: 'Far island', map, alphaTest: .5, fog: false }));
  mesh.name = 'far island';
  return mesh;
}

function band(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position') as THREE.BufferAttribute, out = new Float32Array(p.count * 3);
  g.computeBoundingBox();
  const y0 = g.boundingBox!.min.y, y1 = g.boundingBox!.max.y;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - y0) / (y1 - y0), green = (t > .55 && t < .7) || (t > .82 && t < .9);
    out.set(green ? [.25, .62, .36] : [.95, .95, .93], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return g;
}
