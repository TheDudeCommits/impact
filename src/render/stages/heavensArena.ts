import * as THREE from 'three';
import type { DressContext } from './dressing';
import { seeded } from './ambient';
import { crowdCards, figureAtlas, type CrowdSpot } from './crowd';
import { nearShare } from './near';
import { addShaderPatch } from '../look/shaderPatch';
import { mirrorBright, type MirrorSource } from './mirror';

const S = 17;
const LOWER0 = 22.5, ROW_D = .85, ROW_H = .72, LOWER_ROWS = 16;
const FASCIA_R = LOWER0 + ROW_D * LOWER_ROWS + 3, FASCIA_TOP = 13.6, UPPER_ROWS = 18;
const TRUSS_Y = 24, TRUSS_HALF = 15;
const AISLE_EVERY = 8;

interface OutlinePoint { x: number; z: number; north: boolean }

function outline(r: number): OutlinePoint[] {
  const pts: OutlinePoint[] = [];
  const pieces: [('side' | 'corner'), [number, number] | number, [number, number] | number, number][] = [
    ['side', [0, -1], [1, -1], 8], ['corner', -90, 0, 16], ['side', [1, -1], [1, 1], 16], ['corner', 0, 90, 16],
    ['side', [1, 1], [-1, 1], 16], ['corner', 90, 180, 16], ['side', [-1, 1], [-1, -1], 16], ['corner', 180, 270, 16],
    ['side', [-1, -1], [0, -1], 8],
  ];
  const corners: Record<string, [number, number]> = { '-90': [1, -1], '0': [1, 1], '90': [-1, 1], '180': [-1, -1] };
  for (const [kind, a, b, n] of pieces) {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let x: number, z: number;
      if (kind === 'side') {
        const [ax, az] = a as [number, number], [bx, bz] = b as [number, number];
        if (az === bz) { x = S * (ax + (bx - ax) * t); z = r * az; } else { x = r * ax; z = S * (az + (bz - az) * t); }
      } else {
        const [cx, cz] = corners[String(a)];
        const ang = ((a as number) + ((b as number) - (a as number)) * t) * Math.PI / 180;
        const rho = Math.max(r - S, 0);
        x = S * cx + rho * Math.cos(ang); z = S * cz + rho * Math.sin(ang);
      }
      pts.push({ x, z, north: Math.abs(z + r) < 1e-6 && Math.abs(x) <= S + 1e-6 });
    }
  }
  return pts;
}

function treads() {
  const rows: { r: number; y: number; upper: boolean }[] = [];
  for (let k = 0; k < LOWER_ROWS; k++) rows.push({ r: LOWER0 + ROW_D * (k + .62), y: ROW_H * (k + 1), upper: false });
  for (let k = 0; k < UPPER_ROWS; k++) rows.push({ r: FASCIA_R + ROW_D * (k + .62), y: FASCIA_TOP + ROW_H * k, upper: true });
  return rows;
}

export async function dressHeavensArena(c: DressContext) {
  const spots = crowd(c);
  flashes(c, spots);
  beams(c);
  screens(c);
  spill(c);
  reflections(c);
  referee(c);
  operators(c);
  await emblems(c);
}

function crowd(c: DressContext) {
  const rng = seeded(200);
  const spots: CrowdSpot[] = [], front: CrowdSpot[] = [];
  const share = Math.max(.45, nearShare());
  for (const row of treads()) {
    const pts = outline(row.r);
    const fill = (row.upper ? .5 : .66) * share;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (i % AISLE_EVERY === 0 || (a.north && b.north)) continue;
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      for (let d = .3; d < length - .1; d += .62) {
        if (rng() > fill) continue;
        const t = Math.min(1, Math.max(0, (d + (rng() - .5) * .3) / length));
        const back = (rng() - .5) * .16;
        const nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length;
        const x = a.x + (b.x - a.x) * t - nx * back, z = a.z + (b.z - a.z) * t - nz * back;
        if (x < -LOWER0 + 1 && x > -LOWER0 - 3.4 && Math.abs(z) < 7 && row.y < 4.6) continue;
        if (Math.abs(x) < 12.4 && z > 29.5 && z < 36) continue;
        if (x > 42.7 && x < 45.5 && row.y > 16 && row.y < 29 && [-16.5, -5.5, 5.5, 16.5].some(zc => Math.abs(z - zc) < 2.8)) continue;
        (row.r < LOWER0 + ROW_D * 7 ? front : spots).push({ x, y: row.y + .02, z, cell: Math.floor(rng() * 24), height: 1.22 * (.92 + rng() * .14), flip: rng() < .5 });
      }
    }
  }
  const atlas = figureAtlas(8, 3, 96, 160, drawSpectator);
  crowdCards(c, atlas, 8, 3, front, { name: 'heavens arena crowd front', aspect: .6, shade: .66, sway: .05 });
  crowdCards(c, atlas, 8, 3, spots, { name: 'heavens arena crowd', aspect: .6, shade: .36, sway: .05 });
  glowSticks(c, spots);
  return [...front, ...spots];
}

function drawSpectator(g: CanvasRenderingContext2D, i: number, w: number, h: number) {
  const r = seeded(31 + i * 13);
  const ink = '#14121c';
  const skin = ['#c8a890', '#b89480', '#a07a64', '#d0b4a0', '#8a6a58'][Math.floor(r() * 5)];
  const hair = ['#1c1814', '#2a1e18', '#4a3422', '#6a5a40', '#22222a', '#4a2a24', '#8a8480'][Math.floor(r() * 7)];
  const shirt = ['#4e4a56', '#8a3a42', '#3a5a7a', '#c8c4bc', '#5c5664', '#b08a3a', '#3c3844', '#4a7a6a', '#9a5a7a', '#46424e', '#d8d4cc', '#5a6a8a',
    '#a04a3a', '#3e4652', '#7a7a84', '#6a4a8a', '#2e3a4a', '#c86a5a', '#4a5a3a', '#e0dcd4', '#8a8aa0', '#3a3a44', '#a87a5a', '#506a9a'][i % 24];
  const pose = i >= 16 ? 4 + (i % 2) : i % 4;
  const cx = w / 2;
  g.lineWidth = 3.5; g.strokeStyle = ink; g.lineJoin = 'round'; g.lineCap = 'round';
  const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
  const sh = h * .5, head = h * .3, hr = w * .17;
  const arm = (sx: number, up: boolean, fist = false) => {
    const x0 = cx + sx * w * .27, y0 = sh + 6;
    const x1 = up ? cx + sx * w * (.3 + r() * .08) : cx + sx * w * .3;
    const y1 = up ? h * (.04 + r() * .06) : h * .92;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 14; g.strokeStyle = ink; g.stroke();
    g.lineWidth = 9; g.strokeStyle = shirt; g.stroke();
    g.lineWidth = 3.5; g.strokeStyle = ink;
    shape(skin, () => g.arc(x1, y1, fist ? 7 : 6, 0, Math.PI * 2));
  };
  if (pose === 1 || pose === 4) { arm(-1, true); arm(1, true); }
  if (pose === 4) {
    const towel = ['#e8e0d0', '#c84a6a', '#3aa0c8', '#e0b040'][i % 4];
    g.fillStyle = towel; g.strokeStyle = ink; g.lineWidth = 3;
    g.beginPath(); g.rect(cx - w * .38, h * .02, w * .76, h * .12); g.fill(); g.stroke();
  }
  if (pose === 5) {
    const sx = r() < .5 ? -1 : 1, fx = cx + sx * w * .34;
    g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(fx, h * .55); g.lineTo(fx, h * .02); g.stroke();
    g.fillStyle = ['#c84a6a', '#3aa0c8', '#e8e0d0', '#58a060'][i % 4];
    g.beginPath(); g.moveTo(fx, h * .03); g.lineTo(fx + sx * w * .3, h * .08); g.lineTo(fx, h * .14); g.closePath(); g.fill(); g.stroke();
    arm(sx, true, true);
  }
  if (pose === 2) arm(r() < .5 ? -1 : 1, true, true);
  shape(shirt, () => { g.moveTo(cx - w * .32, h); g.lineTo(cx - w * .3, sh + 4); g.quadraticCurveTo(cx, sh - 8, cx + w * .3, sh + 4); g.lineTo(cx + w * .32, h); g.closePath(); });
  shape(skin, () => g.arc(cx, head, hr, 0, Math.PI * 2));
  shape(hair, () => { g.arc(cx, head - 2, hr + 1, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); });
  if (pose === 0) { arm(-1, false); arm(1, false); }
  if (pose === 3) {
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * w * .27, sh + 8); g.lineTo(cx + sx * 4, sh + 22); g.lineWidth = 12; g.strokeStyle = ink; g.stroke(); g.lineWidth = 7; g.strokeStyle = shirt; g.stroke(); }
    g.lineWidth = 3.5; g.strokeStyle = ink;
    shape(skin, () => g.arc(cx, sh + 20, 7, 0, Math.PI * 2));
  }
  if (pose === 2) arm(r() < .5 ? 1 : -1, false);
}

function glowSticks(c: DressContext, spots: readonly CrowdSpot[]) {
  if (!spots.length) return;
  const rng = seeded(808);
  const n = Math.min(260, Math.round(spots.length * .07));
  const position = new Float32Array(n * 3), seed = new Float32Array(n), colour = new Float32Array(n * 3);
  const palette = [[.3, .9, 1], [1, .3, .8], [1, .75, .25], [.6, 1, .5]];
  for (let i = 0; i < n; i++) {
    const s = spots[Math.floor(rng() * spots.length)];
    position.set([s.x, s.y + 1.3, s.z], i * 3);
    seed[i] = rng();
    colour.set(palette[Math.floor(rng() * palette.length)], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute('aColour', new THREE.BufferAttribute(colour, 3));
  const material = new THREE.ShaderMaterial({
    name: 'Glow sticks',
    uniforms: { uTime: c.ambient.time },
    vertexShader: `attribute float aSeed; attribute vec3 aColour; uniform float uTime; varying vec3 vC;
      void main() {
        vec3 p = position + vec3(sin(uTime * (1.4 + aSeed) + aSeed * 30.) * .35, 0., 0.);
        vC = aColour * (.7 + .3 * sin(uTime * 3. + aSeed * 50.));
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = clamp(90. / -mv.z, 1.5, 7.);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vC; void main() { float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .1, d); if (a < .01) discard; gl_FragColor = vec4(vC * a * 1.6, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'glow sticks';
  points.frustumCulled = false;
  c.root.add(points);
}

function flashes(c: DressContext, spots: readonly CrowdSpot[]) {
  if (!spots.length) return;
  const rng = seeded(4040);
  const n = Math.min(320, Math.round(spots.length * .08));
  const position = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = spots[Math.floor(rng() * spots.length)];
    position.set([s.x, s.y + 1.05, s.z], i * 3);
    seed[i] = rng();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const material = new THREE.ShaderMaterial({
    name: 'Crowd flashes',
    uniforms: { uTime: c.ambient.time },
    vertexShader: `attribute float aSeed; uniform float uTime; varying float vFlash;
      void main() {
        float period = 3.5 + aSeed * 9.;
        float t = mod(uTime + aSeed * 97., period);
        vFlash = exp(-t * 38.) * step(0., t);
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_PointSize = vFlash > .003 ? clamp(260. / -mv.z, 2., 26.) : 0.;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vFlash;
      void main() {
        vec2 p = gl_PointCoord - .5; float d = length(p);
        float a = smoothstep(.5, 0., d) * vFlash;
        if (a < .002) discard;
        gl_FragColor = vec4(vec3(1., .98, .94) * a * 2.4, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'crowd flashes';
  points.frustumCulled = false;
  c.root.add(points);
}

function beams(c: DressContext) {
  const cans: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  for (let side = 0; side < 4; side++) for (let k = 0; k < 6; k++) {
    const t = -.8 + 1.6 * k / 5;
    const [px, pz] = side === 0 ? [t * TRUSS_HALF, -TRUSS_HALF] : side === 1 ? [TRUSS_HALF, t * TRUSS_HALF] : side === 2 ? [-t * TRUSS_HALF, TRUSS_HALF] : [-TRUSS_HALF, -t * TRUSS_HALF];
    cans.push({ from: new THREE.Vector3(px, TRUSS_Y - .5, pz), to: new THREE.Vector3(px * .35, 0, pz * .35) });
  }
  const parts: THREE.BufferGeometry[] = [];
  for (const { from, to } of cans.filter((_, i) => i % 2 === 0)) {
    const length = from.distanceTo(to);
    const cone = new THREE.CylinderGeometry(.3, 2.7, length, 18, 1, true);
    const along = new Float32Array(cone.attributes.position.count);
    for (let i = 0; i < along.length; i++) along[i] = .5 - cone.attributes.position.getY(i) / length;
    cone.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
    cone.applyQuaternion(q);
    cone.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    cone.deleteAttribute('uv');
    parts.push(cone);
  }
  const geometry = mergeAll(parts);
  const material = new THREE.ShaderMaterial({
    name: 'Spot beams',
    vertexShader: `attribute float aAlong; varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        vAlong = aAlong;
        vec4 world = modelMatrix * vec4(position, 1.);
        vW = world.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    uniforms: { uTime: c.ambient.time },
    fragmentShader: `uniform float uTime; varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float noise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
      void main() {
        float face = pow(abs(dot(normalize(vN), normalize(vV))), 2.);
        // Dust drifting through the light: the beam's body breaks up a little, slowly.
        float dust = .65 + .55 * noise(vW * .9 + vec3(0., uTime * .25, uTime * .1));
        float a = .34 * face * dust * smoothstep(0., .12, vAlong) * (1. - .2 * vAlong) * smoothstep(1., .9, vAlong);
        gl_FragColor = vec4(vec3(1., .95, .86) * a, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'spot beams';
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  c.root.add(mesh);
  const pools: THREE.BufferGeometry[] = [];
  for (const { to } of cans) {
    const disc = new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2);
    disc.translate(to.x, .015, to.z);
    pools.push(disc);
  }
  const poolMaterial = new THREE.ShaderMaterial({
    name: 'Spot pools',
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; void main() { float d = length(vUv - .5) * 2.; float a = .13 * smoothstep(1., .78, d) + .12 * smoothstep(.9, .0, d) * smoothstep(.9, .0, d); gl_FragColor = vec4(vec3(1., .96, .88) * a, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const poolMesh = new THREE.Mesh(mergeAll(pools), poolMaterial);
  poolMesh.name = 'spot pools';
  c.root.add(poolMesh);
  glare(c, cans.map(({ from, to }) => from.clone().addScaledVector(to.clone().sub(from).normalize(), .62)));
}

function glare(c: DressContext, at: readonly THREE.Vector3[]) {
  const position = new Float32Array(at.length * 3), seed = new Float32Array(at.length);
  at.forEach((p, i) => { position.set([p.x, p.y, p.z], i * 3); seed[i] = (i * .618) % 1; });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const material = new THREE.ShaderMaterial({
    name: 'Flood glare',
    uniforms: { uTime: c.ambient.time },
    vertexShader: `attribute float aSeed; uniform float uTime; varying float vFlicker;
      void main() {
        vFlicker = .92 + .08 * sin(uTime * 7. + aSeed * 40.);
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        gl_PointSize = clamp(2600. / -mv.z, 6., 120.);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vFlicker;
      void main() {
        float d = length(gl_PointCoord - .5) * 2.;
        float core = smoothstep(.16, .0, d), halo = pow(max(1. - d, 0.), 3.);
        float a = (core * 2.6 + halo * .55) * vFlicker;
        if (a < .004) discard;
        gl_FragColor = vec4(vec3(1., .97, .9) * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'flood glare';
  points.frustumCulled = false;
  points.renderOrder = 3;
  c.root.add(points);
}

function mergeAll(parts: THREE.BufferGeometry[]) {
  const nonIndexed = parts.map(p => p.index ? p.toNonIndexed() : p);
  const names = Object.keys(nonIndexed[0].attributes);
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const size = nonIndexed[0].attributes[name].itemSize;
    const total = nonIndexed.reduce((n, p) => n + p.attributes[name].count, 0);
    const array = new Float32Array(total * size);
    let at = 0;
    for (const p of nonIndexed) { array.set(p.attributes[name].array as Float32Array, at); at += p.attributes[name].count * size; }
    out.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  return out;
}

function screens(c: DressContext) {
  const time = c.ambient.time;
  c.model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshBasicMaterial[]) {
      if (!material?.map) continue;
      if (/HA_(Screen|Lamp|Board|Booth)/.test(material.name)) material.color.setScalar(/Lamp/.test(material.name) ? 2.0 : /Screen/.test(material.name) ? 1.35 : /Booth/.test(material.name) ? .52 : 1.0);
      if (/HA_LED/.test(material.name)) material.color.setScalar(.36);
      if (/HA_Banner/.test(material.name)) material.color.setScalar(.78);
      if (/HA_Screen/.test(material.name)) {
        material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping;
        addShaderPatch(material, 'heavens-screen-v1', shader => {
          shader.uniforms.uHaTime = time;
          shader.fragmentShader = 'uniform float uHaTime;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
            #ifdef USE_MAP
              float haCycle = fract( uHaTime / 20. );
              vec2 haUv = vMapUv;
              if ( haCycle > .5 ) haUv.y = haUv.y >= .5 ? haUv.y - .5 : haUv.y + .5;
              vec4 sampledDiffuseColor = texture2D( map, haUv );
              float haEdge = min( abs( haCycle - .5 ), min( haCycle, 1. - haCycle ) );
              float haFlash = smoothstep( .012, 0., haEdge );
              sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, vec3( 1. ), haFlash * .8 ) * ( .95 + .05 * sin( uHaTime * 2.1 ) );
              diffuseColor *= sampledDiffuseColor;
            #endif`);
        });
      } else if (/HA_LED/.test(material.name)) {
        material.map.wrapS = THREE.RepeatWrapping;
        addShaderPatch(material, 'heavens-led-v1', shader => {
          shader.uniforms.uHaTime = time;
          shader.fragmentShader = 'uniform float uHaTime;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
            #ifdef USE_MAP
              vec4 sampledDiffuseColor = texture2D( map, vMapUv + vec2( uHaTime * .06, 0. ) );
              diffuseColor *= sampledDiffuseColor;
            #endif`);
        });
      }
    }
  });
}

function spill(c: DressContext) {
  const wash = (x0: number, x1: number, z0: number, z1: number, y: number, strength: number) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const m = new THREE.ShaderMaterial({
      name: 'Screen spill',
      uniforms: { uZ: { value: new THREE.Vector2(z0, z1) }, uS: { value: strength } },
      vertexShader: `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec2 uZ; uniform float uS; varying vec3 vW;
        void main() { float t = clamp((vW.z - uZ.x) / (uZ.y - uZ.x), 0., 1.); float a = uS * pow(1. - t, 1.6) * smoothstep(16., 9., abs(vW.x));
          vec3 col = mix(vec3(.42, .86, 1.), vec3(1., .45, .85), smoothstep(-8., 8., vW.x) * .7);
          gl_FragColor = vec4(col * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.name = 'screen spill';
    c.root.add(mesh);
  };
  wash(-14, 14, -20.4, -13.6, -1.48, .26);
  wash(-12.5, 12.5, -12.5, 2, .012, .24);
}

function reflections(c: DressContext) {
  const floor: THREE.Mesh[] = [];
  const sources: MirrorSource[] = [];
  c.model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as THREE.Material).name ?? '';
    if (name === 'HA_Tile') floor.push(mesh);
    else if (/HA_Screen/.test(name)) sources.push({ mesh, cycle: true, strength: 1, edge: { u: .16, v: .22, cells: 2 } });
    else if (/HA_Lamp/.test(name)) sources.push({ mesh, strength: .7 });
  });
  if (!floor.length) return;
  mirrorBright(c, sources, { floor, strength: 1.5, f0: .08, fade: 15, blur: 2.6, smear: .022, polish: { size: 2.2, amount: .45 }, extent: [12.6, 12.6] });
}

function operators(c: DressContext) {
  const atlas = figureAtlas(1, 1, 128, 256, (g, _i, w, h) => {
    const ink = '#121018', cx = w / 2;
    g.lineWidth = 4; g.strokeStyle = ink; g.lineJoin = 'round';
    const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
    shape('#2a2a34', () => { g.moveTo(cx - 16, h * .55); g.lineTo(cx - 18, h * .98); g.lineTo(cx + 18, h * .98); g.lineTo(cx + 16, h * .55); g.closePath(); });
    shape('#3a3e4c', () => { g.moveTo(cx - 24, h * .27); g.lineTo(cx + 24, h * .27); g.lineTo(cx + 22, h * .6); g.lineTo(cx - 22, h * .6); g.closePath(); });
    shape('#d8b090', () => g.arc(cx, h * .17, 17, 0, Math.PI * 2));
    shape('#1a1614', () => { g.arc(cx, h * .155, 18, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); });
    g.strokeStyle = '#101010'; g.lineWidth = 5; g.beginPath(); g.arc(cx, h * .16, 20, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    shape('#202020', () => g.arc(cx - 19, h * .18, 6, 0, Math.PI * 2));
  });
  const spots: CrowdSpot[] = [];
  for (const [x, z] of [[-16.9, 8.0], [16.9, -8.0], [-16.2, -16.2], [8.5, 16.9]] as const) {
    const r = Math.hypot(x, z);
    spots.push({ x: x + x / r * .9, y: -1.5, z: z + z / r * .9, cell: 0, height: 1.8 });
  }
  crowdCards(c, atlas, 1, 1, spots, { name: 'heavens arena camera operators', aspect: .5, shade: .7 });
}

async function emblems(c: DressContext) {
  const map = await c.texture('/assets/environment/br/heavens-emblem.webp', { anisotropy: 8 });
  const material = new THREE.MeshBasicMaterial({ name: 'Heavens emblem', map, transparent: true, alphaTest: .05, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, fog: true });
  material.color.setScalar(1.25);
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, z, yaw] of [[-7, 13.12, 0], [7, 13.12, 0], [-7, -13.12, Math.PI], [7, -13.12, Math.PI], [13.12, 0, Math.PI / 2], [-13.12, 0, -Math.PI / 2]] as const) {
    parts.push(new THREE.PlaneGeometry(1.0, 1.0).rotateY(yaw).translate(x, -.72, z));
  }
  const mesh = new THREE.Mesh(mergeAll(parts), material);
  mesh.name = 'heavens emblems';
  c.root.add(mesh);
}

function referee(c: DressContext) {
  const atlas = figureAtlas(1, 1, 128, 256, (g, _i, w, h) => {
    const ink = '#121018', cx = w / 2;
    g.lineWidth = 4; g.strokeStyle = ink; g.lineJoin = 'round'; g.lineCap = 'round';
    const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
    shape('#eeeef2', () => { g.moveTo(cx - 16, h * .55); g.lineTo(cx - 18, h * .98); g.lineTo(cx - 4, h * .98); g.lineTo(cx, h * .62); g.lineTo(cx + 4, h * .98); g.lineTo(cx + 18, h * .98); g.lineTo(cx + 16, h * .55); g.closePath(); });
    g.beginPath(); g.moveTo(cx + 16, h * .3); g.lineTo(cx + 58, h * .2); g.lineWidth = 15; g.stroke(); g.lineWidth = 10; g.strokeStyle = '#c42a2e'; g.stroke(); g.lineWidth = 4; g.strokeStyle = ink;
    shape('#f0c8a0', () => g.arc(cx + 58, h * .2, 6, 0, Math.PI * 2));
    shape('#c42a2e', () => { g.moveTo(cx - 22, h * .27); g.lineTo(cx + 22, h * .27); g.lineTo(cx + 22, h * .6); g.lineTo(cx - 22, h * .6); g.closePath(); });
    g.strokeStyle = '#f4f4f0'; g.lineWidth = 3;
    for (let k = 0; k < 4; k++) { const y = h * (.33 + k * .065); g.beginPath(); g.moveTo(cx - 10, y); g.lineTo(cx + 10, y); g.stroke(); }
    g.beginPath(); g.moveTo(cx, h * .28); g.lineTo(cx, h * .6); g.stroke();
    g.strokeStyle = ink; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx - 20, h * .3); g.lineTo(cx - 26, h * .55); g.lineWidth = 15; g.stroke(); g.lineWidth = 10; g.strokeStyle = '#c42a2e'; g.stroke(); g.lineWidth = 4; g.strokeStyle = ink;
    shape('#f0c8a0', () => g.arc(cx, h * .17, 17, 0, Math.PI * 2));
    shape('#c42a2e', () => { g.rect(cx - 15, h * .06, 30, 16); });
    shape('#f4f4f0', () => { g.rect(cx - 15, h * .06 + 12, 30, 5); });
  });
  crowdCards(c, atlas, 1, 1, [{ x: 1.6, y: -1.25, z: 15.0, cell: 0, height: 1.85 }], { name: 'heavens arena referee', aspect: .5, shade: .96 });
}
