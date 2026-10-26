import * as THREE from 'three';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from './dressing';
import { placeProps, stageMaterial } from './build';
import { seeded } from './ambient';
import { addMesh, beams, nearMaterial, nearShare, scatterWear, wearDecals, type Beam } from './near';
import { addShaderPatch } from '../look/shaderPatch';

export async function dressPainsCrater(c: DressContext) {
  const { kit, ambient } = c;
  const props = STAGE_PROPS['pains-crater'] ?? [];
  await Promise.all([
    c.sky({ rotation: 2.4, drift: .0005 }),
    kit.load(['br/kenney-town-wall-wood-broken', 'br/kenney-town-cart-high', 'br/meshy-rubble', 'br/kenney-town-planks', 'br/kenney-town-wheel',
      STONE, STONE_B, 'br/rock-d', SHOP, COURTYARD]),
  ]);
  ownMaps(c);
  placeProps(kit, props);
  kit.shadows.add('br/kenney-town-wall-wood-broken').add('br/kenney-town-cart-high').add('br/meshy-rubble');
  const rng = seeded(1667);
  for (let i = 0; i < 10; i++) {
    const a = rng() * Math.PI * 2, rr = 24 + rng() * 12, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (rng() < .5) kit.place('br/kenney-town-wheel', { x, z, y: .05, rot: rng() * 6, scale: 2, roll: Math.PI / 2, tint: 0xc0aa90 });
    else kit.place('br/kenney-town-planks', { x, z, rot: Math.atan2(-z, x), scale: 1.8, tint: 0xc8b090 });
  }
  receivers(c);
  scatter(c);
  banners(c);
  heaps(c);
  wallHouses(c);
  await blast(c);
  monument(c);
  lift(c);
  aftermath(c);
  await wear(c);
  kit.flush('pains-crater');
}

function heaps(c: DressContext) {
  const { kit } = c;
  const rng = seeded(2025);
  for (let k = 0; k < 22; k++) {
    const a = (k + rng() * .7) / 22 * Math.PI * 2, r = 43 + rng() * 11;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 40.5 && Math.abs(z) < 40.5) continue;
    const yaw = rng() * Math.PI * 2;
    if (k % 6 === 0) kit.place('br/meshy-rubble', { x, z, rot: yaw, scale: 2.4 + rng() * 1.2, tint: 0xb8a68e });
    for (let i = 0; i < 3; i++) kit.place(rng() < .5 ? STONE : STONE_B, { x: x + (rng() - .5) * 4, z: z + (rng() - .5) * 4, rot: rng() * 6, scale: 1.4 + rng() * 1.2, tint: 0xa89a86 });
    for (let i = 0; i < 2; i++) kit.place('br/kenney-town-wall-wood-broken', { x: x + Math.cos(yaw + i * 2) * 1.8, z: z + Math.sin(yaw + i * 2) * 1.8, rot: yaw + 1.2 + i * 1.7, scale: 1.5 + rng() * .4, tint: 0xc0aa8c });
    for (let i = 0; i < 3; i++) kit.place('br/kenney-town-planks', { x: x + (rng() - .5) * 4.5, z: z + (rng() - .5) * 4.5, rot: rng() * 6, scale: 1.6 + rng() * .6, tint: 0xbca486 });
  }
}

const SHOP = 'asian/building-shop-bare', COURTYARD = 'asian/building-courtyard-bare', STONE = 'br/stone-a-bare', STONE_B = 'br/stone-b-bare';
export const CRATER_BARE = [SHOP, COURTYARD, STONE, STONE_B] as const;
export const CRATER_OWN_MAP: Record<string, string> = {
  '74da8b70ed734eea0026': 'RG Wood 1', '157e324f4de6d8e92f2a': 'RG Cocnrate 1  Mat',
  '201eee08b7dd3cc181fa': 'RG Bricks', '999d44ef291c89cba165': 'RG Roof 2',
};
function ownMaps(c: DressContext) {
  const own = new Map<string, THREE.Texture>();
  c.model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) if (m.map && !own.has(m.name)) own.set(m.name, m.map);
  });
  for (const piece of CRATER_BARE) for (const material of c.kit.pieceMaterials(piece) as THREE.MeshStandardMaterial[]) {
    const u = material.userData as { colorMap?: string; mapOffset?: number[]; mapScale?: number[]; mapRotation?: number };
    if (!u.colorMap || material.map) continue;
    const source = own.get(CRATER_OWN_MAP[u.colorMap]);
    if (!source) { console.warn(`Pain's Crater: no ${u.colorMap} map in the model for ${material.name}`); continue; }
    const map = source.clone();
    map.offset.fromArray(u.mapOffset ?? [0, 0]); map.repeat.fromArray(u.mapScale ?? [1, 1]); map.rotation = u.mapRotation ?? 0;
    material.map = map;
    material.needsUpdate = true;
  }
}

function wallHouses(c: DressContext) {
  const { kit } = c;
  const rng = seeded(1951);
  const talus = (r: number) => r <= 112 ? 6 : 6 + 6 * Math.min(1, (r - 112) / 4) ** 1.4;
  const n = 24;
  for (let k = 0; k < n; k++) {
    const t = (k + .25 + rng() * .5) / n * Math.PI * 2, r = 109.5 + rng() * 3.5;
    const x = Math.cos(t) * r, z = Math.sin(t) * r;
    const face = Math.atan2(-x, -z) + (rng() - .5) * 1.4;
    const piece = rng() < .55 ? SHOP : COURTYARD;
    kit.place(piece, { x, z, y: talus(r) - 2.2 - rng() * 1.6, rot: face, scale: 1.5 + rng() * .5,
      tilt: (rng() < .5 ? -1 : 1) * (.14 + rng() * .26), roll: (rng() - .5) * .6, tint: 0xc4b298 });
    for (let i = 0; i < 2; i++) {
      const a = t + (rng() - .5) * .08, rr = r - 3 - rng() * 4;
      kit.place('br/kenney-town-wall-wood-broken', { x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: talus(rr) - .6, rot: rng() * 6, scale: 2 + rng() * .6, tilt: (rng() - .5) * .5, tint: 0xbca486 });
    }
    kit.place('br/kenney-town-planks', { x: Math.cos(t) * (r - 6), z: Math.sin(t) * (r - 6), y: talus(r - 6) - .2, rot: rng() * 6, scale: 2.2, tint: 0xbca486 });
  }
}

function receivers(c: DressContext) {
  const rng = seeded(1789);
  const parts: THREE.BufferGeometry[] = [];
  for (const p of (STAGE_PROPS['pains-crater'] ?? []).filter(p => p.draw === 'receivers')) {
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const len = 2.2 + rng() * .8, lean = .06 + rng() * .22, yaw = rng() * Math.PI * 2;
      const rod = new THREE.CylinderGeometry(.13, .15, len, 8, 6).translate(0, len / 2, 0);
      const head = new THREE.CylinderGeometry(.26, .14, .32, 8).translate(0, len + .1, 0);
      for (const g of [rod, head]) {
        g.rotateZ(lean).rotateY(yaw).translate(p.x + (i ? .7 : 0), -.3, p.z + (i ? -.5 : 0));
        parts.push(g.index ? g.toNonIndexed() : g);
      }
    }
  }
  if (!parts.length) return;
  const merged = new THREE.BufferGeometry();
  const geos = parts;
  const position: number[] = [], normal: number[] = [];
  for (const g of geos) {
    const pa = g.getAttribute('position'), na = g.getAttribute('normal');
    for (let k = 0; k < pa.count; k++) { position.push(pa.getX(k), pa.getY(k), pa.getZ(k)); normal.push(na.getX(k), na.getY(k), na.getZ(k)); }
    g.dispose();
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  addMesh(c, merged, nearMaterial(c, 'Near receivers', { color: 0x221e2a, roughness: .55 }), 'near receivers', { shadow: true });
}

function scatter(c: DressContext) {
  const rng = seeded(1901);
  const stone = new THREE.DodecahedronGeometry(.5, 0);
  stone.scale(1, .55, .8);
  const chip = new THREE.BoxGeometry(.9, .07, .55);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const lay = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number, size: [number, number], name: string, tints: number[]) => {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const colour = new THREE.Color();
    let n = 0;
    for (let i = 0; i < count * 3 && n < count; i++) {
      const r = 10 + Math.pow(rng(), .7) * 100, a = rng() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const keep = r < 30 ? .25 : r < 56 ? .6 : 1;
      if (rng() > keep) continue;
      const s = size[0] + rng() * (size[1] - size[0]);
      mesh.setMatrixAt(n, m.compose(v.set(x, .03, z), q.setFromEuler(e.set((rng() - .5) * .5, rng() * 6.28, (rng() - .5) * .5)), sc.set(s, s, s)));
      mesh.setColorAt(n, colour.setHex(tints[Math.floor(rng() * tints.length)]));
      n++;
    }
    mesh.count = n;
    mesh.name = name; mesh.receiveShadow = true;
    c.root.add(mesh);
  };
  lay(stone, stageMaterial(c.stage, 'Crater rubble', { color: 0xffffff, roughness: 1 }), 520, [.25, .9], 'crater rubble', [0xa89a86, 0x948a7c, 0xbcae96, 0x7e7468]);
  lay(chip, stageMaterial(c.stage, 'Crater tile chips', { color: 0xffffff, roughness: 1 }), 220, [.4, .9], 'crater tile chips', [0x8a8478, 0x7a7670, 0x9a8e7c, 0x6e6a64]);
}

function banners(c: DressContext) {
  const { ambient } = c;
  const atlas = leafBanner();
  const poles: Beam[] = [];
  for (const [x, z, h, lean] of [[-44, -26, 10, .12], [46, 18, 9, -.15], [-30, 46, 10.5, .08], [24, -47, 9.5, -.1], [52, -40, 10, .14], [-55, 22, 9, -.1]] as const) {
    poles.push({ a: [x, 0, z], b: [x + Math.sin(lean) * h, h, z], w: .16 });
    ambient.cloth(atlas, { x: x + Math.sin(lean) * h + 2.2, y: h - .2, z, width: 4.4, height: 6.2, rot: .4 + lean, uv: [0, 0, 1, 1], wind: 1.1 });
  }
  addMesh(c, beams(poles, 2), nearMaterial(c, 'Near banner poles', { color: 0x5a4636, roughness: .9 }), 'near banner poles');
}

async function blast(c: DressContext) {
  const relief = await c.texture('/assets/environment/br/crater-detail.jpg', { repeat: 1, srgb: false, anisotropy: 8 });
  c.model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshStandardMaterial;
    if (m.name !== 'Crater_Earth') return;
    addShaderPatch(m, 'crater-blast-v2', shader => {
      shader.uniforms.uCraterDetail = { value: relief };
      shader.vertexShader = 'varying vec3 vBlastWorld;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vBlastWorld = ( modelMatrix * vec4( transformed, 1. ) ).xyz;`);
      shader.fragmentShader = 'varying vec3 vBlastWorld;\nuniform sampler2D uCraterDetail;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 craterSlope = ( craterRelief.rg * 2. - 1. ) * craterNear + ( craterRelief2.rg * 2. - 1. ) * .45;
          vec3 craterN = normalize( ( vec4( normal, 0. ) * viewMatrix ).xyz );
          float craterUp = smoothstep( .55, .85, craterN.y );
          craterN = normalize( craterN + vec3( craterSlope.x, 0., -craterSlope.y ) * craterUp * .85 );
          normal = normalize( ( viewMatrix * vec4( craterN, 0. ) ).xyz );
        }`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec4 craterRelief = texture2D( uCraterDetail, vBlastWorld.xz / 2.6 );
        vec4 craterRelief2 = texture2D( uCraterDetail, vBlastWorld.xz / 10.3 + vec2( .37, .61 ) );
        float craterNear = 1. - smoothstep( 40., 90., length( vBlastWorld.xz - cameraPosition.xz ) );
        diffuseColor.rgb *= mix( 1., .62 + .76 * craterRelief.b, .55 * craterNear ) * mix( 1., .76 + .48 * craterRelief2.b, .35 );
        {
          float bR = length( vBlastWorld.xz ), bA = atan( vBlastWorld.z, vBlastWorld.x );
          // Furrows the blast ploughed outward: dark grooves with a lit ridge on one side, fanning in petals.
          float petal = .6 + .4 * sin( bA * 9. + 1.3 );
          float fw = bA * 64. + sin( bA * 13. ) * 2.2 + sin( bR * .05 ) * 1.5;
          float groove = smoothstep( .55, .95, sin( fw ) );
          float ridge = smoothstep( .55, .95, sin( fw + .9 ) );
          float rayAmt = smoothstep( 20., 40., bR ) * ( 1. - smoothstep( 92., 115., bR ) ) * petal;
          // (Round 2: deeper - R2's rays are the floor's strongest pattern; at 8% a critic saw "no radial scour".)
          diffuseColor.rgb *= 1. - groove * .2 * rayAmt;
          diffuseColor.rgb *= 1. + ridge * .1 * rayAmt;
          float ring = smoothstep( .9, 1., sin( bR * .48 ) ) * smoothstep( 12., 30., bR );
          diffuseColor.rgb *= 1. - ring * .08;
          // Where Pain stood the ground is pressed hardest: a darker heart.
          diffuseColor.rgb *= mix( .82, 1., smoothstep( 2., 11., bR ) );
        }`);
    });
  });
}

function lift(c: DressContext) {
  c.model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshStandardMaterial;
    if (m.name === 'Crater_Cover' || m.name === 'Crater_Cover_Tiles') m.color.multiplyScalar(1.3);
  });
}

function monument(c: DressContext) {
  c.model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshStandardMaterial;
    if (m.name === 'mat_200') m.color.setRGB(m.color.r * 1.02, m.color.g * 1.02, m.color.b * 1.06);
    if (m.name === 'mat_122') m.color.setRGB(m.color.r * .7, m.color.g * .75, m.color.b * .84);
  });
}

function aftermath(c: DressContext) {
  const { ambient } = c;
  const rim = (t: number, r: number, y: number) => ({ x: Math.cos(t) * r, y, z: Math.sin(t) * r });
  const fires = [.5, 1.3, 2.2, 3.2, 5.6, 6.0].map((t, i) => ({ ...rim(t, 136 + (i % 3) * 4, 37), size: 4 + (i % 3), smoke: .9, seed: i * .13 }));
  ambient.fire(fires);
  const columns: { x: number; y: number; z: number; size: number }[] = [];
  for (const [t, r] of [[.5, 136], [1.3, 140], [2.2, 144], [3.2, 136], [5.6, 140], [6.0, 144], [2.8, 220], [0, 250]] as const)
    for (let i = 0; i < 6; i++) { const p = rim(t, r, 39 + i * 2.4); columns.push({ x: p.x + Math.sin(i * 2) * 2, y: p.y, z: p.z + Math.cos(i) * 2, size: 8 + i * 1.6 }); }
  ambient.puffs({ spots: columns, color: 0x6a6662, shade: 0x2c2a28, opacity: .7, life: 16, rise: 34, drift: [1.4, 0, .8], grow: 2.6, seed: 81 });
  const dust: { x: number; y: number; z: number; size: number }[] = [];
  const rng = seeded(83);
  for (let i = 0; i < 26; i++) {
    const t = rng() * Math.PI * 2, r = 46 + rng() * 70;
    dust.push({ x: Math.cos(t) * r, y: 1.2, z: Math.sin(t) * r, size: 10 + rng() * 10 });
  }
  ambient.puffs({ spots: dust.slice(0, 12), color: 0xd8c8a8, shade: 0xa8987e, opacity: .3, life: 18, rise: 3, drift: [1.6, 0, .6], grow: 1.6, seed: 84 });
  const banks: { x: number; y: number; z: number; size: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const t = (i + rng() * .9) / 40 * Math.PI * 2, r = 96 + rng() * 16;
    banks.push({ x: Math.cos(t) * r, y: 1 + rng() * 5, z: Math.sin(t) * r, size: 14 + rng() * 22 });
  }
  ambient.puffs({ spots: banks, color: 0xc4ae8c, shade: 0x8e7c64, opacity: .42, life: 30, rise: 3, drift: [.9, 0, .4], grow: 1.5, seed: 88 });
  ambient.motes({ min: [-50, .3, -50], max: [50, 12, 50], count: 240, velocity: [1.4, .1, .5], size: .035, color: 0x4a4440, color2: 0x8a7e70, opacity: .7, wobble: .7, seed: 85 });
  ambient.birds({ centre: [0, 0, -40], count: 12, radius: 70, height: 48, spread: 16, speed: 9, size: .8, color: 0x16141a, seed: 86 });
  ambient.birds({ centre: [60, 0, 60], count: 8, radius: 40, height: 36, spread: 10, speed: 8, size: .7, color: 0x16141a, seed: 87 });
}

async function wear(c: DressContext) {
  const share = nearShare();
  const rng = seeded(4321);
  const spot = (): [number, number] => [(rng() - .5) * 84, (rng() - .5) * 84];
  const decals = scatterWear(rng, {
    share, spot, floor: (x, z) => Math.abs(x) < 44 && Math.abs(z) < 44 ? 0 : undefined,
    kinds: {
      crack: { count: 30, size: [3, 7], tint: [0x7a5e44, 0x6a5038], opacity: [.6, .9] },
      crater: { count: 6, size: [4, 7], tint: 0x8a6e52, opacity: [.6, .85] },
      scorch: { count: 5, size: [3, 5], opacity: [.35, .55] },
      splinters: { count: 18, size: [1.6, 3], tint: [0xc8a880, 0xb89878] },
      dust: { count: 20, size: [4, 8], tint: [0xc8b898, 0xbca888], opacity: [.22, .36] },
      scuff: { count: 12, size: [2.5, 4.5], tint: 0x9a7e60, opacity: [.35, .6] },
    },
  });
  await wearDecals(c, decals, 'near wear');
}

function leafBanner() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 384;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#b4a68a'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#5a7a4a'; g.fillRect(0, 0, 256, 34); g.fillRect(0, 350, 256, 34);
  g.strokeStyle = '#b02a22'; g.lineWidth = 16; g.lineCap = 'round';
  g.beginPath();
  for (let a = 0; a < Math.PI * 3.2; a += .1) { const r = 6 + a * 10; const x = 128 + Math.cos(a) * r, y = 196 + Math.sin(a) * r * .9; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  g.beginPath(); g.moveTo(186, 150); g.lineTo(226, 96); g.lineTo(206, 170); g.closePath(); g.fillStyle = '#b02a22'; g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(i * 40, 384); g.lineTo(i * 40 + 18, 330 - (i % 3) * 18); g.lineTo(i * 40 + 34, 384); g.fill(); }
  g.beginPath(); g.moveTo(60, 120); g.lineTo(84, 220); g.lineTo(70, 222); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
