import * as THREE from 'three';
import { addShaderPatch } from '../look/shaderPatch';
import type { DressContext } from './dressing';
import { seeded } from './ambient';
import { crowdCards, figureAtlas, stripSpots } from './crowd';

export async function dressGalacticArena(c: DressContext) {
  const time = c.ambient.time;
  const tiles = await c.texture('/assets/environment/br/galactic-tiles.webp', { repeat: 4, anisotropy: 8 });
  c.model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
      const id = Number(/_(\d+)$/.exec(material.name)?.[1] ?? -1);
      if (/Material046_0$/.test(material.name)) { material.map = tiles; material.needsUpdate = true; }
      else if (/Material046_(9|14)$/.test(material.name)) mesh.visible = false;
      else if (/Material046_1$/.test(material.name)) mesh.visible = false;
      else if (/Material046_8$/.test(material.name)) { material.map = null; material.color.setRGB(.05, .3, .32); material.emissive = new THREE.Color(.1, .55, .58); material.needsUpdate = true; }
      else if (/Material046_5$/.test(material.name)) screenGrid(material, time);
      else if (/Material046_2$/.test(material.name)) { neon(material); rimLamps(material); }
      else if (NEON.has(id) || /Material046$/.test(material.name)) neon(material);
      if (/Material046_15$/.test(material.name)) pylonGlass(material);
    }
  });
  beams(c);
  const name = await c.texture('/assets/environment/br/galactic-name.webp', { anisotropy: 8 });
  standCap(c, name);
  cables(c);
  inlay(c);
  alienCrowd(c);
  await monitors(c);
  nameSigns(c, name);
  bandBeams(c);
  lowNameBand(c, name);
  c.ambient.motes({ min: [-24, 2, -24], max: [24, 10, 24], count: 320, velocity: [.2, -.7, .15], size: .13, color: 0xfff27a, color2: 0xff7ab8, opacity: .95, wobble: 1.6, seed: 61 });
  c.ambient.motes({ min: [-24, 2, -24], max: [24, 10, 24], count: 240, velocity: [-.15, -.6, .2], size: .12, color: 0x7affd8, color2: 0xffffff, opacity: .9, wobble: 1.4, seed: 62 });

}

const NEON = new Set([2, 3, 6, 7, 10, 12, 15, 16]);

function screenGrid(material: THREE.MeshStandardMaterial, time: { value: number }) {
  material.emissive = new THREE.Color(0, 0, 0);
  addShaderPatch(material, 'galactic-screen-v1', shader => {
    shader.uniforms.uGaTime = time;
    shader.fragmentShader = 'uniform float uGaTime;\n' + shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec2 gaUv = fract( vMapUv );
        vec2 gaCell = abs( fract( gaUv * vec2( 18., 10. ) ) - .5 );
        float gaLine = smoothstep( .44, .5, max( gaCell.x, gaCell.y ) );
        float gaScan = smoothstep( .06, 0., abs( fract( gaUv.y - uGaTime * .08 ) - .5 ) - .02 );
        float gaEdge = smoothstep( .0, .06, min( min( gaUv.x, 1. - gaUv.x ), min( gaUv.y, 1. - gaUv.y ) ) );
        vec3 gaField = vec3( .10, .55, .16 ) + vec3( .25, .9, .3 ) * gaLine + vec3( .4, 1., .5 ) * gaScan * .35;
        diffuseColor.rgb = gaField * .3;
        totalEmissiveRadiance += gaField * 1.35 * gaEdge;
      }`);
  });
}

function neon(material: THREE.MeshStandardMaterial) {
  material.emissive = new THREE.Color(0, 0, 0);
  addShaderPatch(material, 'galactic-neon-v1', shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 gaPaint = diffuseColor.rgb;`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float gaMax = max( gaPaint.r, max( gaPaint.g, gaPaint.b ) ), gaMin = min( gaPaint.r, min( gaPaint.g, gaPaint.b ) );
        float gaSat = ( gaMax - gaMin ) / max( gaMax, 1e-3 );
        // Saturated and bright: the frames' green, the panels' cyan, the lamps' gold.
        float gaGlow = smoothstep( .45, .7, gaSat ) * smoothstep( .45, .8, gaMax );
        totalEmissiveRadiance += gaPaint * gaGlow * 1.6;
      }`);
  });
}

function pylonGlass(material: THREE.MeshStandardMaterial) {
  addShaderPatch(material, 'galactic-pylon-glass-v1', shader => {
    shader.vertexShader = 'varying vec3 vGaWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vGaWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`);
    shader.fragmentShader = 'varying vec3 vGaWorld;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 gaPod = diffuseColor.rgb;`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float gaR = length( vGaWorld.xz );
        float gaOn = smoothstep( 31.5, 32.5, gaR ) * ( 1. - smoothstep( 38.5, 39.5, gaR ) ) * ( 1. - smoothstep( 21., 22., vGaWorld.y ) );
        float gaDark = smoothstep( .02, .004, dot( gaPod, vec3( .2126, .7152, .0722 ) ) );
        totalEmissiveRadiance += vec3( .16, .9, .84 ) * gaDark * gaOn;
      }`);
  });
}

function rimLamps(material: THREE.MeshStandardMaterial) {
  addShaderPatch(material, 'galactic-rim-v1', shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 gaRim = diffuseColor.rgb;`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3( .35, 1.1, 1.2 ) * smoothstep( .1, .03, dot( gaRim, vec3( .2126, .7152, .0722 ) ) );`);
  });
}

function beams(c: DressContext) {
  const spots: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2 + .13, b = a + (k % 2 ? .35 : -.35);
    spots.push({ from: new THREE.Vector3(Math.sin(a) * 18, 1.2, Math.cos(a) * 18), to: new THREE.Vector3(Math.sin(b) * 40, 36, Math.cos(b) * 40) });
  }
  beamsFrom(c, spots, 'galactic beams', .34, 3.4);
}

function beamsFrom(c: DressContext, spots: readonly { from: THREE.Vector3; to: THREE.Vector3 }[], name: string, strength: number, spread: number, tints?: readonly (readonly [number, number, number])[]) {
  const parts: THREE.BufferGeometry[] = [];
  spots.forEach(({ from, to }, k) => {
    const length = from.distanceTo(to);
    const cone = new THREE.CylinderGeometry(.3, spread, length, 20, 1, true);
    const n = cone.attributes.position.count;
    const along = new Float32Array(n), base = new Float32Array(n * 3), phase = new Float32Array(n);
    const tint = new Float32Array(n * 3), colour = (tints ?? [[.66, 1, .96]])[k % (tints ?? [[0]]).length];
    for (let i = 0; i < n; i++) { along[i] = .5 - cone.attributes.position.getY(i) / length; base.set([from.x, from.y, from.z], i * 3); phase[i] = k * 1.7; tint.set(colour, i * 3); }
    cone.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
    cone.setAttribute('aAlong', new THREE.BufferAttribute(along, 1));
    cone.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
    cone.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize()));
    cone.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    cone.deleteAttribute('uv');
    parts.push(cone.toNonIndexed());
    cone.dispose();
  });
  const material = new THREE.ShaderMaterial({
    name: 'Galactic beams',
    vertexShader: `attribute float aAlong; attribute vec3 aBase; attribute float aPhase; attribute vec3 aTint; uniform float uTime;
      varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vTint;
      void main() {
        vAlong = aAlong; vTint = aTint;
        // A slow sway about the lamp, round the vertical.
        float s = sin( uTime * .23 + aPhase ) * .16, cs = cos( s ), sn = sin( s );
        vec3 p = position - aBase; p = vec3( cs * p.x - sn * p.z, p.y, sn * p.x + cs * p.z ) + aBase;
        vec3 nn = vec3( cs * normal.x - sn * normal.z, normal.y, sn * normal.x + cs * normal.z );
        vec4 world = modelMatrix * vec4( p, 1. );
        vW = world.xyz;
        vN = normalize( mat3( modelMatrix ) * nn );
        vV = normalize( cameraPosition - world.xyz );
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    uniforms: { uTime: c.ambient.time },
    fragmentShader: `uniform float uTime; varying float vAlong; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vTint;
      float gaHash( vec3 p ) { return fract( sin( dot( p, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ); }
      float gaNoise( vec3 p ) { vec3 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
        return mix( mix( mix( gaHash( i ), gaHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( gaHash( i + vec3( 0, 1, 0 ) ), gaHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                    mix( mix( gaHash( i + vec3( 0, 0, 1 ) ), gaHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( gaHash( i + vec3( 0, 1, 1 ) ), gaHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }
      void main() {
        // Soft across the beam (no hard card edge), brightest along its axis seen side on.
        float face = pow( abs( dot( normalize( vN ), normalize( vV ) ) ), 1.6 );
        float dust = .5 + .7 * gaNoise( vW * .45 + vec3( 0., uTime * .35, uTime * .15 ) ) * ( .6 + .4 * gaNoise( vW * 1.7 - vec3( uTime * .2 ) ) );
        float a = ${strength.toFixed(3)} * face * dust * smoothstep( 1., .7, vAlong ) * ( 1. - .55 * vAlong ) * smoothstep( 0., .05, vAlong );
        gl_FragColor = vec4( vTint * a, a );
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(merge(parts), material);
  mesh.name = name; mesh.frustumCulled = false; mesh.renderOrder = 2;
  c.root.add(mesh);
  const lamps = new THREE.BufferGeometry();
  lamps.setAttribute('position', new THREE.Float32BufferAttribute(spots.flatMap(({ from }) => [from.x, from.y + .2, from.z]), 3));
  const flare = new THREE.Points(lamps, glowPoints(new THREE.Color(.75, 1.4, 1.5), 2200, 6, 40));
  flare.name = `${name} flares`; flare.frustumCulled = false;
  c.root.add(flare);
}

function glowPoints(colour: THREE.Color, scale: number, min: number, max: number, time?: { value: number }) {
  return new THREE.ShaderMaterial({
    name: 'Galactic glow points',
    uniforms: { uTime: time ?? { value: 0 }, uColour: { value: colour } },
    vertexShader: `uniform float uTime; varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1. );
        vTwinkle = .8 + .2 * sin( uTime * 2.6 + position.x * 1.7 + position.z * 2.3 );
        gl_PointSize = clamp( ${scale.toFixed(1)} / -mv.z, ${min.toFixed(1)}, ${max.toFixed(1)} );
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uColour; varying float vTwinkle;
      void main() { float d = length( gl_PointCoord - .5 ) * 2.; float a = ( smoothstep( 1., .25, d ) * .6 + smoothstep( .35, 0., d ) ) * vTwinkle; gl_FragColor = vec4( uColour * a, a ); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function standCap(c: DressContext, name: THREE.Texture) {
  const RADIUS = 42.05, BOTTOM = 18.05, HEIGHT = 5.9;
  c.model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && /Material046_13$/.test((m.material as THREE.Material).name)) m.visible = false; });
  const band = new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 192, 1, true).translate(0, BOTTOM + HEIGHT / 2, 0);
  const texture = name.clone();
  texture.wrapS = THREE.RepeatWrapping; texture.repeat.set(-11, 1); texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ name: 'Galactic stand cap', map: texture, side: THREE.BackSide, color: new THREE.Color(1.25, 1.25, 1.25) });
  const mesh = new THREE.Mesh(band, material);
  mesh.name = 'galactic stand cap';
  c.root.add(mesh);
  const count = 260, positions = new Float32Array(count * 2 * 3);
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    positions.set([Math.sin(a) * (RADIUS - .2), BOTTOM - .15, Math.cos(a) * (RADIUS - .2)], i * 6);
    positions.set([Math.sin(a) * (RADIUS - .2), BOTTOM + HEIGHT + .15, Math.cos(a) * (RADIUS - .2)], i * 6 + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const bulbs = new THREE.Points(geometry, glowPoints(new THREE.Color(2.2, 1.6, .7), 520, 2, 7, c.ambient.time));
  bulbs.name = 'galactic bulbs'; bulbs.frustumCulled = false;
  c.root.add(bulbs);
}

function cables(c: DressContext) {
  const parts: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const from = new THREE.Vector3(sx * 6.5, 24.6, sz * 6.5), to = new THREE.Vector3(sx * 10, 40, sz * 10);
    const length = from.distanceTo(to);
    const g = new THREE.CylinderGeometry(.09, .09, length, 6, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    parts.push(g.toNonIndexed());
    g.dispose();
  }
  const material = new THREE.MeshStandardMaterial({ name: 'Galactic cables', color: 0x2a3438, roughness: .6, metalness: 0 });
  const mesh = new THREE.Mesh(merge(parts.map(p => { p.deleteAttribute('uv'); return p; })), material);
  mesh.name = 'galactic cables';
  c.root.add(mesh);
}

function inlay(c: DressContext) {
  const ring = new THREE.RingGeometry(11.25, 11.5, 180, 1).rotateX(-Math.PI / 2).translate(0, .012, 0);
  const material = new THREE.MeshBasicMaterial({ name: 'Galactic inlay', color: new THREE.Color(.45, 1.25, 1.3), transparent: true, opacity: .85,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const mesh = new THREE.Mesh(ring, material);
  mesh.name = 'galactic inlay';
  c.root.add(mesh);
}

const END = 33.5;

function bandBeams(c: DressContext) {
  const spots: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2 + .07, b = a + (k % 2 ? .3 : -.3), up = 24 + (k % 3) * 4;
    spots.push({ from: new THREE.Vector3(Math.sin(a) * 33, .9, Math.cos(a) * 33), to: new THREE.Vector3(Math.sin(b) * 47, up, Math.cos(b) * 47) });
  }
  beamsFrom(c, spots, 'galactic band beams', .7, 2.6, [[.3, .9, 1.1], [.35, .55, 1.15], [.3, .9, 1.1], [1.05, .45, .9]]);
}

function lowNameBand(c: DressContext, name: THREE.Texture) {
  const RADIUS = 44, BOTTOM = 6.6, HEIGHT = 2.2;
  const band = new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 192, 1, true).translate(0, BOTTOM + HEIGHT / 2, 0);
  const texture = name.clone();
  texture.wrapS = THREE.RepeatWrapping; texture.repeat.set(-12, 1); texture.needsUpdate = true;
  const mesh = new THREE.Mesh(band, new THREE.MeshBasicMaterial({ name: 'Galactic low name band', map: texture, side: THREE.BackSide, color: new THREE.Color(1.3, 1.3, 1.3) }));
  mesh.name = 'galactic low name band';
  c.root.add(mesh);
  const count = 300, positions = new Float32Array(count * 2 * 3);
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    positions.set([Math.sin(a) * (RADIUS - .15), BOTTOM - .12, Math.cos(a) * (RADIUS - .15)], i * 6);
    positions.set([Math.sin(a) * (RADIUS - .15), BOTTOM + HEIGHT + .12, Math.cos(a) * (RADIUS - .15)], i * 6 + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const bulbs = new THREE.Points(geometry, glowPoints(new THREE.Color(2.3, 1.7, .75), 560, 2.5, 8, c.ambient.time));
  bulbs.name = 'galactic low band bulbs'; bulbs.frustumCulled = false;
  c.root.add(bulbs);
}

async function monitors(c: DressContext) {
  const W = 12, H = 6, R = .9, Y = 1.8 + H / 2;
  const faceMap = await c.texture('/assets/environment/br/galactic-monitor.webp', { anisotropy: 8 });
  const rounded = (w: number, h: number, r: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  };
  const faces: THREE.BufferGeometry[] = [], frames: THREE.BufferGeometry[] = [], wires: THREE.BufferGeometry[] = [];
  for (const end of [-1, 1]) for (const side of [-1, 1]) {
    const x = side * 10.6, z = end * END;
    const place = new THREE.Matrix4().makeRotationY(Math.atan2(-x, -z)).setPosition(x, Y, z);
    const face = new THREE.ShapeGeometry(rounded(W, H, R), 6);
    const uv = face.getAttribute('uv') as THREE.BufferAttribute, pos = face.getAttribute('position') as THREE.BufferAttribute;
    const top = side * end > 0;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, ((pos.getY(i) + H / 2) / H) * .5 + (top ? .5 : 0));
    faces.push(face.applyMatrix4(place).toNonIndexed());
    const ring = rounded(W + 1.4, H + 1.4, R + .7);
    ring.holes.push(new THREE.Path(rounded(W, H, R).getPoints(6).reverse()));
    const bezel = new THREE.ExtrudeGeometry(ring, { depth: .6, bevelEnabled: true, bevelThickness: .12, bevelSize: .12, bevelSegments: 2, curveSegments: 6 }).translate(0, 0, -.55);
    frames.push(bezel.applyMatrix4(place).toNonIndexed());
    const back = new THREE.BoxGeometry(W + .8, H + .8, .5).translate(0, 0, -.5);
    frames.push(back.applyMatrix4(place).toNonIndexed());
    for (const k of [-1, 1]) {
      const from = new THREE.Vector3(k * (W / 2 - .6), H / 2 + .7, -.3).applyMatrix4(place), to = from.clone().setY(38);
      const g = new THREE.CylinderGeometry(.06, .06, to.y - from.y, 5, 1, true).translate(from.x, (from.y + to.y) / 2, from.z);
      g.deleteAttribute('uv'); wires.push(g.toNonIndexed());
    }
  }
  const screen = new THREE.MeshBasicMaterial({ name: 'Galactic monitors', map: faceMap, color: new THREE.Color(1.05, 1.05, 1.05) });
  addShaderPatch(screen, 'galactic-monitor-v1', shader => {
    shader.uniforms.uGmTime = c.ambient.time;
    shader.fragmentShader = 'uniform float uGmTime;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        float gmV = fract( vMapUv.y * 2. );
        float gmScan = smoothstep( .05, 0., abs( fract( gmV + uGmTime * .12 ) - .5 ) - .01 );
        diffuseColor.rgb *= 1. + .45 * gmScan;
      }`);
  });
  const faceMesh = new THREE.Mesh(merge(faces), screen);
  faceMesh.name = 'galactic monitors';
  c.root.add(faceMesh);
  const frameGeometry = merge(frames.map(g => { g.deleteAttribute('uv'); return g; }));
  frameGeometry.computeVertexNormals();
  const bezel = new THREE.MeshStandardMaterial({ name: 'Galactic monitor bezels', color: 0xdce6ea, roughness: .42, metalness: .1, emissive: new THREE.Color(.06, .16, .17) });
  const frameMesh = new THREE.Mesh(frameGeometry, bezel);
  frameMesh.name = 'galactic monitor bezels';
  c.root.add(frameMesh);
  const wire = new THREE.Mesh(merge(wires), new THREE.MeshStandardMaterial({ name: 'Galactic monitor cables', color: 0x2a3438, roughness: .6 }));
  wire.name = 'galactic monitor cables';
  c.root.add(wire);
}

const NAME_Y = 4.65;
function nameSigns(c: DressContext, name: THREE.Texture) {
  const parts: THREE.BufferGeometry[] = [];
  for (const end of [-1, 1]) {
    const g = new THREE.PlaneGeometry(10, 2.5).rotateY(end < 0 ? 0 : Math.PI).translate(0, NAME_Y, end * (END + .4));
    parts.push(g.toNonIndexed());
  }
  const material = new THREE.MeshBasicMaterial({ name: 'Galactic name signs', map: name, color: new THREE.Color(1.35, 1.35, 1.35) });
  const mesh = new THREE.Mesh(merge(parts), material);
  mesh.name = 'galactic name signs';
  c.root.add(mesh);
  const rims: THREE.BufferGeometry[] = [];
  for (const end of [-1, 1]) {
    const g = new THREE.BoxGeometry(10.5, 3, .3).translate(0, NAME_Y, -.2).rotateY(end < 0 ? 0 : Math.PI).translate(0, 0, end * (END + .4));
    g.deleteAttribute('uv'); rims.push(g.toNonIndexed());
  }
  const rim = new THREE.Mesh(merge(rims), new THREE.MeshStandardMaterial({ name: 'Galactic name sign frames', color: 0xdce6ea, roughness: .45, emissive: new THREE.Color(.06, .16, .17) }));
  rim.name = 'galactic name sign frames';
  c.root.add(rim);
}

function alienCrowd(c: DressContext) {
  const spots = stripSpots(c.model, /Material046_(9|14)$/, { spacing: 1.3, height: 2.1, cells: 24, rows: 2, tall: 3, rise: 1.5, back: .9, seed: seeded(4242) });
  const atlas = figureAtlas(8, 3, 96, 160, drawAlien);
  const crowd = crowdCards(c, atlas, 8, 3, spots, { name: 'galactic alien crowd', aspect: .6, shade: 1, sway: .06 });
  if (crowd) (crowd.material as THREE.MeshBasicMaterial).color.setRGB(.46, .66, .72);
}

function drawAlien(g: CanvasRenderingContext2D, i: number, w: number, h: number) {
  const kind = i % 12, cheer = i >= 12, r = seeded(91 + i * 7);
  const ink = '#101820', cx = w / 2;
  g.lineWidth = 3.5; g.strokeStyle = ink; g.lineJoin = 'round'; g.lineCap = 'round';
  const shape = (fill: string, path: () => void) => { g.beginPath(); path(); g.fillStyle = fill; g.fill(); g.stroke(); };
  const K = [
    { skin: '#64c04c', body: '#6a3c9a', head: 'antennae' },
    { skin: '#f0eef8', body: '#3a3c8a', head: 'horns' },
    { skin: '#f08ab8', body: '#262230', head: 'tentacle' },
    { skin: '#7ad040', body: '#7ad040', head: 'bald' },
    { skin: '#6ab0e8', body: '#e8c040', head: 'cat' },
    { skin: '#f0c830', body: '#8a8c94', head: 'robot' },
    { skin: '#f08a3a', body: '#3a7ab0', head: 'fish' },
    { skin: '#d84a3a', body: '#f0c040', head: 'oni' },
    { skin: '#9a7ad8', body: '#e8e4d8', head: 'cyclops' },
    { skin: '#f4b0a0', body: '#c83a4a', head: 'pig' },
    { skin: '#58c8b8', body: '#e86a2a', head: 'spikes' },
    { skin: '#c8c4bc', body: '#3a8a58', head: 'dome' },
  ][kind];
  const sh = h * .52, headY = h * .3, hr = w * (kind === 3 || kind === 11 ? .21 : .17);
  const arm = (sx: number, up: boolean) => {
    const x0 = cx + sx * w * .26, y0 = sh + 6;
    const x1 = up ? cx + sx * w * (.34 + r() * .06) : cx + sx * w * .3, y1 = up ? h * (.05 + r() * .06) : h * .9;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = 14; g.strokeStyle = ink; g.stroke();
    g.lineWidth = 9; g.strokeStyle = K.skin; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = ink;
    shape(K.skin, () => g.arc(x1, y1, 6.5, 0, Math.PI * 2));
  };
  if (cheer) { arm(-1, true); arm(1, true); }
  shape(K.body, () => { g.moveTo(cx - w * .33, h); g.lineTo(cx - w * .31, sh + 2); g.quadraticCurveTo(cx, sh - 10, cx + w * .31, sh + 2); g.lineTo(cx + w * .33, h); g.closePath(); });
  if (kind === 1) for (const sx of [-1, 1]) shape('#e8c860', () => g.ellipse(cx + sx * w * .3, sh + 4, w * .13, h * .05, sx * .4, 0, Math.PI * 2));
  if (kind === 7) { g.fillStyle = ink; for (let k = 0; k < 4; k++) g.fillRect(cx - w * .3 + k * w * .16, sh + 14 + (k % 2) * 6, 5, 18); }
  const head = () => {
    if (kind === 1) shape(K.skin, () => g.ellipse(cx, headY - 4, hr * 1.05, hr * 1.25, 0, 0, Math.PI * 2));
    else if (kind === 5) { shape(K.skin, () => { g.arc(cx, headY, hr * 1.1, Math.PI, 0); g.lineTo(cx + hr * 1.1, headY + hr * .7); g.lineTo(cx - hr * 1.1, headY + hr * .7); g.closePath(); }); shape('#36e0ff', () => g.rect(cx - hr * .8, headY - 2, hr * 1.6, hr * .5)); }
    else if (kind === 6) shape(K.skin, () => g.ellipse(cx, headY, hr * 1.3, hr * .9, 0, 0, Math.PI * 2));
    else shape(K.skin, () => g.arc(cx, headY, hr, 0, Math.PI * 2));
  };
  const top = headY - hr;
  if (K.head === 'antennae') for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 5, top + 4); g.lineTo(cx + sx * 12, top - 16); g.stroke(); shape(K.skin, () => g.arc(cx + sx * 12, top - 17, 3.5, 0, Math.PI * 2)); }
  if (K.head === 'horns' || K.head === 'oni') for (const sx of [-1, 1]) shape(K.head === 'oni' ? '#f4ead0' : '#2a2a3a', () => { g.moveTo(cx + sx * hr * .5, top + 6); g.lineTo(cx + sx * hr * (K.head === 'oni' ? .7 : 1.3), top - (K.head === 'oni' ? 10 : 14)); g.lineTo(cx + sx * hr * .9, top + 10); g.closePath(); });
  if (K.head === 'tentacle') { g.beginPath(); g.moveTo(cx, top + 2); g.quadraticCurveTo(cx + 18, top - 14, cx + 22, top + 6); g.lineWidth = 9; g.strokeStyle = ink; g.stroke(); g.lineWidth = 5; g.strokeStyle = K.skin; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = ink; }
  if (K.head === 'cat' || K.head === 'pig') for (const sx of [-1, 1]) shape(K.skin, () => { g.moveTo(cx + sx * hr * .3, top + 5); g.lineTo(cx + sx * hr * .95, top - 9); g.lineTo(cx + sx * hr, top + 9); g.closePath(); });
  if (K.head === 'robot') { g.beginPath(); g.moveTo(cx, top - 2); g.lineTo(cx, top - 14); g.stroke(); shape('#ff4a4a', () => g.arc(cx, top - 15, 3.5, 0, Math.PI * 2)); }
  if (K.head === 'fish') for (const sx of [-1, 1]) shape('#f4d04a', () => { g.moveTo(cx + sx * hr * 1.1, headY); g.lineTo(cx + sx * hr * 1.7, headY - 10); g.lineTo(cx + sx * hr * 1.7, headY + 10); g.closePath(); });
  if (K.head === 'spikes') for (let k = -2; k <= 2; k++) shape('#2a8a7a', () => { g.moveTo(cx + k * 7 - 5, top + 6); g.lineTo(cx + k * 9, top - 12 + Math.abs(k) * 3); g.lineTo(cx + k * 7 + 5, top + 6); g.closePath(); });
  head();
  g.fillStyle = ink;
  if (K.head === 'cyclops') { shape('#ffffff', () => g.arc(cx, headY - 1, hr * .5, 0, Math.PI * 2)); g.fillStyle = ink; g.beginPath(); g.arc(cx, headY - 1, hr * .22, 0, Math.PI * 2); g.fill(); }
  else if (K.head !== 'robot') {
    const eye = K.head === 'bald' ? '#ff3030' : K.head === 'dome' ? '#101010' : ink;
    g.fillStyle = eye;
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * hr * .38, headY - 1, K.head === 'bald' || K.head === 'dome' ? 5 : 3.2, K.head === 'bald' ? 3 : 4, 0, 0, Math.PI * 2); g.fill(); }
    if (cheer && K.head !== 'bald') { g.beginPath(); g.arc(cx, headY + hr * .35, hr * .32, 0, Math.PI); g.fillStyle = '#5a1020'; g.fill(); }
  }
  if (K.head === 'pig') shape('#e88a80', () => g.ellipse(cx, headY + hr * .3, hr * .38, hr * .26, 0, 0, Math.PI * 2));
  if (K.head === 'bald') { g.strokeStyle = '#3a8a2a'; g.lineWidth = 2.5; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 3, top + 3); g.quadraticCurveTo(cx + sx * hr * .8, top + hr * .4, cx + sx * hr * .7, headY - 6); g.stroke(); } g.strokeStyle = ink; g.lineWidth = 3.5; }
  if (!cheer) { arm(-1, false); arm(1, false); }
  g.globalCompositeOperation = 'source-atop';
  const glow = g.createLinearGradient(0, 0, w, 0);
  glow.addColorStop(0, 'rgba(160,255,240,0.28)'); glow.addColorStop(.35, 'rgba(160,255,240,0)'); glow.addColorStop(1, 'rgba(0,20,30,0.18)');
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

function merge(parts: THREE.BufferGeometry[]) {
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(parts[0].attributes)) {
    const size = parts[0].attributes[name].itemSize;
    const array = new Float32Array(parts.reduce((n, p) => n + p.attributes[name].count, 0) * size);
    let at = 0;
    for (const p of parts) { array.set(p.attributes[name].array as Float32Array, at); at += p.attributes[name].count * size; }
    out.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  parts.forEach(p => p.dispose());
  return out;
}
