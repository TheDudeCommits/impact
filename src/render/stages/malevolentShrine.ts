import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_PROPS } from '../../game/stageProps';
import { addShaderPatch } from '../look/shaderPatch';
import type { DressContext } from './dressing';
import { placeProps } from './build';
import { seeded } from './ambient';
import { addMesh, beams, canvasAtlas, flutter, hangingCloth, linePoint, nearMaterial, nearShare, ropes, thin, type Beam, type Hang, type Line } from './near';
import { beforeAShrine, burningCity, shrineFacade } from './shrineFacade';

export async function dressMalevolentShrine(c: DressContext) {
  const { kit, ambient, model, root } = c;
  const [sky] = await Promise.all([
    c.sky({ rotation: 0, drift: .0015, exposure: 1.05 }),
    kit.load(['asian/torii', 'br/stone-lamp', 'br/pot', 'br/rock-formation-b', 'br/rock-a']),
  ]);
  model.updateMatrixWorld(true);

  model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const m = o.material as THREE.MeshStandardMaterial;
    if (m.name === 'Domain_Blood') bloodMirror(m, sky.mesh.material.uniforms.uMap.value as THREE.Texture, ambient.time);
  });
  const facadeFires = shrineFacade(c, model);
  burningCity(c);

  const arc = cutArc(model, new THREE.Vector3(-30, 0, 24), 11);
  if (arc) {
    const spots: [number, number, number, number][] = [];
    const rng = seeded(919);
    for (let i = 0; i < 11; i++) {
      const a = i / 11 * Math.PI * 2 + rng() * .3, r = 50 + rng() * 26;
      spots.push([Math.sin(a) * r, Math.cos(a) * r - 6, .8 + rng() * .6, rng() * 6.3]);
    }
    for (const [x, z, s, rot] of [[-150, -120, 3.2, 1], [40, -170, 3.6, 2.2], [175, -40, 3, 4]] as const) spots.push([x, z, s, rot]);
    const mesh = new THREE.InstancedMesh(arc.geometry, arc.material, spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    spots.forEach(([x, z, s, rot], i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, -.15 * s, z), q.setFromAxisAngle(up, rot), new THREE.Vector3(s, s, s))));
    mesh.name = 'skull piles'; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
  }

  placeProps(kit, STAGE_PROPS['malevolent-shrine'] ?? []);
  const lamps: [number, number][] = [[-10, -18], [10, -18], [-10, 0], [10, 0], [-10, 18], [10, 18]];
  const rng = seeded(31);
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2, r = 85 + rng() * 60;
    const piece = rng() < .5 ? 'br/rock-a' : 'br/rock-formation-b', x = Math.sin(a) * r, z = Math.cos(a) * r, scale = 1 + rng() * 2.2, rot = rng() * 6.3;
    if (beforeAShrine(x, z)) continue;
    kit.place(piece, { x, z, y: -1.5, scale, rot, tint: 0x3a2224 });
  }
  kit.shadows.add('br/stone-lamp').add('br/pot').add('asian/torii');
  dressNear(c);
  kit.flush('malevolent-shrine');

  ambient.fire([
    ...lamps.map(([x, z], i) => ({ x, y: 1.75, z, size: .55, smoke: .15, seed: i * .13 })),
    { x: -18, y: 1.65, z: -26, size: 1.8, smoke: .7, seed: .31 }, { x: 18, y: 1.65, z: -26, size: 1.8, smoke: .7, seed: .77 },
    { x: -9, y: 1, z: -38, size: 2.4, smoke: .9, seed: .5 }, { x: 9, y: 1, z: -38, size: 2.4, smoke: .9, seed: .9 },
    ...facadeFires.map((f, i) => ({ ...f, size: 2.8, smoke: .9, seed: .2 + i * .4 })),
  ]);
  const mist: { x: number; y: number; z: number; size: number }[] = [];
  const mr = seeded(77);
  for (let i = 0; i < 34; i++) { const a = mr() * Math.PI * 2, r = 12 + mr() * 80; mist.push({ x: Math.sin(a) * r, y: .6 + mr() * 1.2, z: Math.cos(a) * r - 10, size: 14 + mr() * 18 }); }
  ambient.puffs({ spots: mist, color: 0x8a1c22, shade: 0x2a0408, opacity: .2, life: 0, flat: true, seed: 12, order: 1 });
  ambient.motes({ min: [-40, 0, -50], max: [40, 26, 45], count: 340, velocity: [.25, -.7, .15], size: .07, color: 0x6a6262, color2: 0x2a2222, opacity: .7, wobble: 1.4, seed: 13 });
  ambient.motes({ min: [-22, 0, -42], max: [22, 18, 26], count: 120, velocity: [.1, 1.1, .2], size: .05, color: 0xff7a3a, color2: 0xffc060, opacity: .9, wobble: .8, additive: true, twinkle: .6, seed: 14 });
  ambient.birds({ centre: [0, 0, -46], count: 12, radius: 30, height: 40, spread: 12, speed: 7, size: .75, color: 0x0a0405, seed: 15 });
}

function dressNear(c: DressContext) {
  const { kit, ambient } = c;
  const share = nearShare();
  const rng = seeded(4242);
  const props = STAGE_PROPS['malevolent-shrine'] ?? [];

  const bone = nearMaterial(c, 'Near bone', { color: 0xf0e2cc, roughness: .8, vertexColors: true });
  const ribs = props.filter(p => p.draw === 'rib').map((p, i) => ribCurve(p.x, p.z, i));
  const ribParts = ribs.map(curve => ribGeometry(curve));
  addMesh(c, mergeGeometries(ribParts), bone, 'near ribs', { shadow: true });
  ribParts.forEach(g => g.dispose());

  const lying: { x: number; z: number; rot: number; scale: number }[] = [];
  const clear = (x: number, z: number) => !props.some(p => p.solid && p.solid !== true && Math.abs(x - p.x - (p.solid.dx ?? 0)) < p.solid.halfX + 1 && Math.abs(z - p.z - (p.solid.dz ?? 0)) < p.solid.halfZ + 1);
  for (let tries = 0; lying.length < Math.round(64 * share) && tries < 600; tries++) {
    const a = rng() * Math.PI * 2, r = 3 + Math.sqrt(rng()) * 26, x = Math.sin(a) * r, z = Math.cos(a) * r - 4;
    if (clear(x, z)) lying.push({ x, z, rot: rng() * Math.PI * 2, scale: .55 + rng() * .9 });
  }
  if (lying.length) {
    const piece = boneGeometry();
    const mesh = new THREE.InstancedMesh(piece, bone, lying.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3();
    lying.forEach((b, i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(b.x, -.03 * b.scale, b.z), q.setFromAxisAngle(up, b.rot), s.setScalar(b.scale))));
    mesh.name = 'malevolent-shrine:near bones'; mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    c.root.add(mesh);
  }

  const wood = kit.material('asian/torii', /Wood 1/) as THREE.MeshStandardMaterial;
  const tablets: Beam[] = [];
  for (const t of [...props.filter(p => p.draw === 'tablets'), ...OUTSIDE_TABLETS]) {
    const facing = Math.atan2(-t.x, -t.z), ax = Math.cos(facing), az = -Math.sin(facing);
    for (let k = 0; k < 7; k++) {
      const along = (k / 6 - .5) * 1.5 + (rng() - .5) * .2, back = (rng() - .5) * .9;
      const x = t.x + ax * along + Math.sin(facing) * back, z = t.z + az * along + Math.cos(facing) * back;
      const h = 1.4 + rng() * 1.3, lean = (rng() - .5) * .35;
      tablets.push({ a: [x, -.3, z], b: [x + ax * lean, h, z + az * lean + (rng() - .5) * .2], w: .24 + rng() * .08, d: .05 });
    }
  }
  addMesh(c, beams(tablets, 1.2), nearMaterial(c, 'Near tablets', { map: wood.map, color: 0xd6c4ac, roughness: 1 }), 'near tablets', { shadow: true });

  const side = (sign: number) => ribs.filter(r => Math.sign(r.v0.x) === sign).sort((a, b) => a.v0.z - b.v0.z).map(r => pointAtHeight(r, 8.2));
  const lines: Line[] = [];
  for (const sign of [-1, 1]) {
    const knots = side(sign);
    for (let i = 0; i + 1 < knots.length; i++) lines.push({ a: knots[i].toArray() as [number, number, number], b: knots[i + 1].toArray() as [number, number, number], sag: 1.1 });
  }
  const gate = props.find(p => p.piece === 'asian/torii' && p.z < 0);
  if (gate) lines.push({ a: [gate.x - 2.1, 3.55, gate.z + .1], b: [gate.x + 2.1, 3.55, gate.z + .1], sag: .2 });
  addMesh(c, ropes(lines, { radius: .15, sides: 6 }), nearMaterial(c, 'Near shimenawa', { color: 0xc9b78c, roughness: 1 }), 'near shimenawa', { shadow: true });
  const paper: Hang[] = [];
  for (const line of lines) {
    const length = Math.hypot(line.b[0] - line.a[0], line.b[2] - line.a[2]);
    for (let s = .6; s < length - .4; s += .9 + rng() * .4) paper.push({ line, t: s / length, width: .26, height: .62 + rng() * .1, cell: Math.floor(rng() * 2) });
  }
  addMesh(c, hangingCloth(thin(paper, share), 2, 1), flutter(nearMaterial(c, 'Near shide', { map: shideAtlas(), cloth: true, roughness: .9 }), ambient.time, .1), 'near shide');
  const lanterns: THREE.Vector3[] = [];
  for (const line of lines.slice(0, -1)) for (const t of [.3, .7]) lanterns.push(linePoint(line, t).add(new THREE.Vector3(0, -1.15, 0)));
  const lantern = lanternGeometry();
  const glow = nearMaterial(c, 'Near lanterns', { color: 0xd8382a, emissive: 0xff4a24, emissiveIntensity: .85, roughness: .9, vertexColors: true });
  addShaderPatch(glow, 'near-lantern-glow', shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vColor.r;');
  });
  const mesh = new THREE.InstancedMesh(lantern, glow, lanterns.length);
  const m = new THREE.Matrix4();
  lanterns.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
  mesh.name = 'malevolent-shrine:near lanterns'; mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  c.root.add(mesh);
}

const OUTSIDE_TABLETS = [{ x: 17, z: 46 }, { x: -17, z: 46 }, { x: 22, z: 60 }];

function ribCurve(x: number, z: number, i: number) {
  const s = Math.sign(x) || 1, rng = seeded(31 + i * 7);
  const drift = (rng() - .5) * 3, top = 14.5 + rng() * 3;
  return new THREE.CubicBezierCurve3(
    new THREE.Vector3(x, -1.2, z),
    new THREE.Vector3(x + s * .8, 8, z + drift * .2),
    new THREE.Vector3(x * .5, top + 2, z + drift * .7),
    new THREE.Vector3(x * (.18 + rng() * .14), top - 1.5 - rng() * 2.5, z + drift),
  );
}

function pointAtHeight(curve: THREE.CubicBezierCurve3, y: number) {
  let best = curve.getPoint(0), bestD = Infinity;
  for (let k = 0; k <= 60; k++) { const p = curve.getPoint(k / 120); const d = Math.abs(p.y - y); if (d < bestD) { bestD = d; best = p; } }
  return best;
}

function ribGeometry(curve: THREE.CubicBezierCurve3) {
  const RINGS = 16, SIDES = 8;
  const positions: number[] = [], normals: number[] = [], colours: number[] = [], index: number[] = [];
  const t3 = new THREE.Vector3(), side = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), p = new THREE.Vector3(), out = new THREE.Vector3();
  const ivory = new THREE.Color(0xffffff), soaked = new THREE.Color(0x5a1612), stain = new THREE.Color(0xb89a86), c = new THREE.Color();
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    curve.getPoint(t, p); curve.getTangent(t, t3);
    n.crossVectors(side, t3).normalize();
    const b = new THREE.Vector3().crossVectors(t3, n).normalize();
    const r = (.9 - .6 * t) * (t < .08 ? 1.1 : 1) * (1 + .07 * Math.sin(t * 29 + curve.v0.z));
    for (let k = 0; k < SIDES; k++) {
      const a = k / SIDES * Math.PI * 2, rough = 1 + .06 * Math.sin(k * 2.3 + i * 1.7);
      out.copy(n).multiplyScalar(Math.cos(a) * r * .58 * rough).addScaledVector(b, Math.sin(a) * r * rough);
      positions.push(p.x + out.x, p.y + out.y, p.z + out.z);
      const nn = out.clone().normalize();
      normals.push(nn.x, nn.y, nn.z);
      const wet = THREE.MathUtils.smoothstep(p.y + out.y, 3.2, .2);
      c.copy(ivory).lerp(stain, .25 + .25 * Math.sin(t * 19 + k)).lerp(soaked, wet);
      colours.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < RINGS; i++) for (let k = 0; k < SIDES; k++) {
    const a = i * SIDES + k, b2 = i * SIDES + (k + 1) % SIDES;
    index.push(a, b2, a + SIDES, b2, b2 + SIDES, a + SIDES);
  }
  curve.getPoint(1, p); curve.getTangent(1, t3);
  const tip = positions.length / 3;
  positions.push(p.x + t3.x * .45, p.y + t3.y * .45, p.z + t3.z * .45); normals.push(t3.x, t3.y, t3.z);
  c.copy(ivory).lerp(stain, .4); colours.push(c.r, c.g, c.b);
  for (let k = 0; k < SIDES; k++) index.push(RINGS * SIDES + k, RINGS * SIDES + (k + 1) % SIDES, tip);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  g.setIndex(index);
  return g;
}

function boneGeometry() {
  const shaft = new THREE.CylinderGeometry(.06, .07, .9, 6, 1).rotateZ(Math.PI / 2);
  const knobA = new THREE.IcosahedronGeometry(.13, 0).scale(1, .8, 1.3).translate(.48, 0, 0);
  const knobB = new THREE.IcosahedronGeometry(.12, 0).scale(1, .8, 1.25).translate(-.47, 0, 0);
  const parts = [shaft, knobA, knobB].map(g => g.index ? g.toNonIndexed() : g);
  const g = mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p; }))!;
  const n = g.getAttribute('position').count, colour = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colour.set([.62, .5, .44], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.translate(0, .03, 0);
  return g;
}

function lanternGeometry() {
  const body = new THREE.LatheGeometry([[0, -.42], [.2, -.4], [.32, -.26], [.36, 0], [.32, .26], [.2, .4], [0, .42]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
  const capA = new THREE.CylinderGeometry(.2, .22, .08, 10).translate(0, .44, 0);
  const capB = new THREE.CylinderGeometry(.22, .2, .08, 10).translate(0, -.44, 0);
  const cord = new THREE.CylinderGeometry(.015, .015, .75, 4).translate(0, .85, 0);
  const parts = [body, capA, capB, cord].map(g => g.index ? g.toNonIndexed() : g);
  const tones = [[1, 1, 1], [.05, .04, .04], [.05, .04, .04], [.1, .08, .06]];
  parts.forEach((g, i) => { const n = g.getAttribute('position').count, col = new Float32Array(n * 3); for (let k = 0; k < n; k++) col.set(tones[i], k * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); });
  const g = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return g;
}

function shideAtlas() {
  return canvasAtlas(2, 1, 128, (g, i, s) => {
    g.fillStyle = '#f4f1ea';
    const steps = 4, w = s * .34, x0 = s * (i ? .36 : .3);
    g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + w, 0);
    for (let k = 0; k < steps; k++) {
      const y0 = k / steps * s, y1 = (k + 1) / steps * s, dx = k % 2 ? -w * .6 : w * .6;
      g.lineTo(x0 + w + dx, y0 + (y1 - y0) * .5); g.lineTo(x0 + w + dx, y1);
    }
    for (let k = steps - 1; k >= 0; k--) {
      const y0 = k / steps * s, y1 = (k + 1) / steps * s, dx = k % 2 ? -w * .6 : w * .6;
      g.lineTo(x0 + dx, y1); g.lineTo(x0 + dx, y0 + (y1 - y0) * .5);
    }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,110,96,.5)'; g.lineWidth = 2; g.stroke();
  });
}

function bloodMirror(material: THREE.MeshStandardMaterial, sky: THREE.Texture, time: { value: number }) {
  material.color.setRGB(.02, .001, .002); material.roughness = .35;
  addShaderPatch(material, 'br-blood-mirror', shader => {
    shader.uniforms.uMirrorSky = { value: sky };
    shader.uniforms.uMirrorTime = time;
    shader.vertexShader = 'varying vec3 vMirrorWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvMirrorWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = `uniform sampler2D uMirrorSky;
      uniform float uMirrorTime;
      varying vec3 vMirrorWorld;
      float mHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float mNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
        return mix( mix( mHash( i ), mHash( i + vec2( 1., 0. ) ), f.x ), mix( mHash( i + vec2( 0., 1. ) ), mHash( i + vec2( 1., 1. ) ), f.x ), f.y ); }
      ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec2 p = vMirrorWorld.xz;
        float t = uMirrorTime;
        // Wide slow swells, and rings spreading from the shrine.
        vec2 slope = vec2( mNoise( p * .06 + vec2( t * .05, 0. ) ) - .5, mNoise( p * .06 + vec2( 3.1, t * .04 ) ) - .5 ) * .18;
        float d = length( p - vec2( 0., -47. ) );
        slope += normalize( p - vec2( 0., -47. ) + 1e-3 ) * sin( d * .5 - t * 1.4 ) * .02 * smoothstep( 120., 20., d );
        vec3 n = normalize( vec3( slope.x, 1., slope.y ) );
        vec3 v = normalize( vMirrorWorld - cameraPosition );
        vec3 r = reflect( v, n );
        float u = atan( r.x, -r.z ) * .15915494 + .5;
        float w = clamp( asin( clamp( r.y, -1., 1. ) ) * .63661977 * .5 + .5, .002, .998 );
        vec3 seen = texture2D( uMirrorSky, vec2( u, w ) ).rgb;
        float fresnel = .12 + .88 * pow( 1. - max( dot( -v, n ), 0. ), 4. );
        totalEmissiveRadiance += seen * fresnel * .55;
      }`);
  });
}

function cutArc(model: THREE.Object3D, centre: THREE.Vector3, radius: number) {
  let source: THREE.Mesh | undefined;
  model.traverse(o => { if (o instanceof THREE.Mesh && /Bull_Skulls1_Bull_Skull_Material_0\.001/.test(o.name)) source = o; });
  if (!source) model.traverse(o => { if (!source && o instanceof THREE.Mesh && /Bull_Skull_Material\.001/.test((o.material as THREE.Material).name)) source = o; });
  if (!source) return undefined;
  const g = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone();
  g.applyMatrix4(source.matrixWorld);
  const pos = g.getAttribute('position') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined, normal = g.getAttribute('normal') as THREE.BufferAttribute;
  const keep: number[] = [], keepUv: number[] = [], keepNormal: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    if (Math.hypot(cx - centre.x, cz - centre.z) > radius) continue;
    for (let k = 0; k < 3; k++) {
      keep.push(pos.getX(t + k) - centre.x, pos.getY(t + k), pos.getZ(t + k) - centre.z);
      keepNormal.push(normal.getX(t + k), normal.getY(t + k), normal.getZ(t + k));
      if (uv) keepUv.push(uv.getX(t + k), uv.getY(t + k));
    }
  }
  g.dispose();
  if (!keep.length) return undefined;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(keepNormal, 3));
  if (keepUv.length) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(keepUv, 2));
  return { geometry, material: source.material as THREE.Material };
}
