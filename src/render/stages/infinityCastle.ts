import * as THREE from 'three';
import { STAGE_PROPS } from '../../game/stageProps';
import type { DressContext } from './dressing';
import { seeded } from './ambient';
import { Beacons, LightPools } from './glow';
import { mirrorBright } from './mirror';

export async function dressInfinityCastle(c: DressContext) {
  const { ambient, model } = c;
  await c.sky({ rotation: 0, drift: .0004, exposure: 1 });
  model.updateMatrixWorld(true);
  const meshes = new Map<string, THREE.Mesh>(), materials = new Map<string, THREE.MeshStandardMaterial>();
  model.traverse(o => { if (o instanceof THREE.Mesh) { meshes.set(o.name, o); materials.set((o.material as THREE.Material).name, o.material as THREE.MeshStandardMaterial); } });
  for (const [name, glow] of [['Castle_Doors', .9], ['Castle_Rooms', 1.0]] as const) {
    const m = materials.get(name);
    if (m) { m.emissive.setRGB(1, 1, 1); m.emissiveIntensity = glow; }
  }
  materials.get('Castle_Plaster')?.color.setRGB(.64, .46, .32);

  const bands: THREE.Mesh[][] = [[], [], []];
  for (const [name, mesh] of meshes) {
    const band = /^Castle_Void(\d)_/.exec(name);
    if (band) bands[Number(band[1])]?.push(mesh);
  }
  const glows = bands.map((list, k) => {
    const group = new THREE.Group();
    group.name = `infinity-castle:void lanterns ${k}`;
    c.root.add(group);
    const spots = list.flatMap(mesh => mesh.name.endsWith('_Doors') ? papers(mesh, LANTERN_UV) : []);
    const beacons = new Beacons(group, spots.length, ambient.time);
    const tone = [1, .85, .7][k];
    const hues = [0xffa850, 0xffa850, 0xffa850, 0xffa850, 0xffa850, 0xffa850, 0xffa850, 0xff5a34, 0xfff0d2, 0xffc070];
    for (const [i, at] of spots.entries()) beacons.add(at.x, at.y, at.z, 1.9, new THREE.Color(hues[(i * 7919) % hues.length]).multiplyScalar(tone).getHex(), -1, (i * .0731) % 1, 1);
    beacons.finish(`infinity-castle:void lanterns ${k}`, 1.5);
    return group;
  });
  const targets = [0, 0, 0], from = [0, 0, 0], shown = [0, 0, 0];
  let next = 6, began = -10;
  const rng = seeded(1914);
  ambient.onUpdate(t => {
    if (t >= next) {
      for (let k = 0; k < 3; k++) { from[k] = shown[k]; targets[k] = (rng() - .5) * (k === 0 ? 10 : 18); }
      began = t; next = t + 7 + rng() * 6;
    }
    const p = Math.min(1, (t - began) / 1.4), ease = 1 - Math.pow(1 - p, 4);
    for (let k = 0; k < 3; k++) {
      shown[k] = from[k] + (targets[k] - from[k]) * ease;
      for (const mesh of bands[k]) mesh.position.y = shown[k];
      glows[k].position.y = shown[k];
    }
  });

  const lanterns = papers(meshes.get('Castle_Doors'), LANTERN_UV);
  const halos = new Beacons(c.root, lanterns.length + 8, ambient.time);
  const pools = new LightPools(c.root, 64);
  for (const [i, at] of lanterns.entries()) {
    if (Math.hypot(at.x, at.z) < 1.5 && at.y > 8) continue;
    halos.add(at.x, at.y + .45, at.z, 1.7, 0xffb060, -1, (i * .137) % 1, 1);
    if (at.y < 2) pools.add(at.x, at.z, 8, new THREE.Color(0xffa050).multiplyScalar(.36), .12);
    else if (at.y > 8 && at.y < 14) pools.add(at.x * .97, at.z * .97, 9, new THREE.Color(0xffa860).multiplyScalar(.1), .1);
  }
  halos.add(0, 10.5, 0, 6, 0xffa858, -1, .3, 1);
  halos.finish('infinity-castle:lantern halos', 1.5);
  pools.finish('infinity-castle:lantern light');
  heartLight(c.root);
  const mats = meshes.get('Castle_Tatami_Floor'), doors = meshes.get('Castle_Doors');
  const emit = (doors?.material as THREE.MeshStandardMaterial | undefined)?.emissiveMap;
  if (mats && doors && emit) mirrorBright(c, [{ mesh: doors, map: emit, tint: 0xffc890 }], { floor: [mats], y: .02, strength: .38, f0: .04, fade: 7, blur: 4.5, smear: .045, polish: { size: 3, amount: .6 }, extent: [36, 36] });

  ambient.motes({ min: [-38, .3, -38], max: [38, 12, 38], count: 90, velocity: [.08, .1, .05], size: .03, color: 0xffa040, color2: 0xffc870, opacity: .6, additive: true, twinkle: .5, wobble: 1.2, seed: 91 });
  ambient.motes({ min: [-60, -30, -120], max: [60, 30, -50], count: 60, velocity: [.05, .5, .03], size: .07, color: 0xffa040, color2: 0xffc870, opacity: .7, additive: true, twinkle: .7, wobble: 2, seed: 92 });
  shafts(c.root);

  void STAGE_PROPS['infinity-castle'];
}

const LANTERN_UV = new THREE.Box2(new THREE.Vector2(514 / 1024, 770 / 1024), new THREE.Vector2(766 / 1024, 1022 / 1024));

function papers(mesh: THREE.Mesh | undefined, region: THREE.Box2) {
  if (!mesh) return [];
  const g = mesh.geometry, pos = g.getAttribute('position'), uv = g.getAttribute('uv');
  const index = g.index ? g.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const found: THREE.Vector3[] = [];
  const c = new THREE.Vector2(), p = new THREE.Vector3(), lo = new THREE.Vector2(), hi = new THREE.Vector2();
  for (let t = 0; t < index.length; t += 3) {
    c.set(0, 0); lo.set(1, 1); hi.set(0, 0);
    for (let k = 0; k < 3; k++) {
      const u = uv.getX(index[t + k]), v = uv.getY(index[t + k]);
      c.x += u / 3; c.y += v / 3; lo.min(new THREE.Vector2(u, v)); hi.max(new THREE.Vector2(u, v));
    }
    if (!region.containsPoint(c) || hi.x - lo.x < .05) continue;
    p.set(0, 0, 0);
    for (let k = 0; k < 3; k++) p.x += pos.getX(index[t + k]) / 3, p.y += pos.getY(index[t + k]) / 3, p.z += pos.getZ(index[t + k]) / 3;
    p.applyMatrix4(mesh.matrixWorld);
    if (!found.some(q => q.distanceToSquared(p) < .8)) found.push(p.clone());
  }
  return found;
}

function heartLight(root: THREE.Object3D) {
  const s = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [at, a] of [[0, 1], [.2, .9], [.4, .6], [.6, .3], [.8, .1], [1, 0]] as const) grad.addColorStop(at, `rgb(${Math.round(255 * a)},${Math.round(255 * a)},${Math.round(255 * a)})`);
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.NoColorSpace;
  const material = new THREE.MeshBasicMaterial({ map, color: new THREE.Color(0xffffff).multiplyScalar(.55), transparent: true, depthWrite: false, fog: false, toneMapped: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.OneFactor,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  material.name = 'infinity-castle:the hall lit from its heart';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(52, 52).rotateX(-Math.PI / 2), material);
  mesh.position.y = .1; mesh.name = 'infinity-castle:the hall lit from its heart'; mesh.renderOrder = 2; mesh.frustumCulled = false;
  root.add(mesh);
}

function shafts(root: THREE.Object3D) {
  const spots: [number, number, number, number, number][] = [[0, 62, 0, 9, 62]];
  const r = seeded(77);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = 62 + r() * 70;
    spots.push([Math.sin(a) * d, 70 + r() * 40, Math.cos(a) * d, 4 + r() * 5, 90 + r() * 60]);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i + .5) / 8 * Math.PI * 2 + (r() - .5) * .3, d = 56 + r() * 12;
    spots.push([Math.sin(a) * d, 46 + r() * 16, Math.cos(a) * d, 3 + r() * 2.5, 70 + r() * 30]);
  }
  const geometry = new THREE.ConeGeometry(1, 1, 18, 1, true).translate(0, -.5, 0);
  const material = new THREE.ShaderMaterial({
    name: 'Castle light shafts',
    uniforms: { uColour: { value: new THREE.Color(0xffb468) } },
    vertexShader: `
      varying float vDown; varying vec3 vNormalView; varying vec3 vView;
      void main() {
        vDown = -position.y;
        vec4 view = viewMatrix * modelMatrix * instanceMatrix * vec4( position, 1.0 );
        vView = normalize( -view.xyz );
        vNormalView = normalize( mat3( viewMatrix ) * mat3( modelMatrix ) * mat3( instanceMatrix ) * normal );
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform vec3 uColour;
      varying float vDown; varying vec3 vNormalView; varying vec3 vView;
      void main() {
        float edge = pow( abs( dot( normalize( vNormalView ), normalize( vView ) ) ), 2.0 );
        float fade = ( 1.0 - smoothstep( .0, 1.0, vDown ) ) * smoothstep( .0, .05, vDown );
        gl_FragColor = vec4( uColour * edge * fade * .3, 1.0 );
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, y, z, radius, length], i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(radius, length, radius))));
  mesh.name = 'infinity-castle:light shafts'; mesh.renderOrder = 4; mesh.frustumCulled = false;
  root.add(mesh);
}
