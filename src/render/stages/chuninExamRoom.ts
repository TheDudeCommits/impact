import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { DressContext } from './dressing';
import { stageMaterial } from './build';
import { addShaderPatch } from '../look/shaderPatch';

const SIDE = 7.25, FAR = -11.72, NEAR = 11.48, WALL_TOP = 7.3;
const CEILING = 11.2;
const GALLERY = 3.7, GALLERY_EDGE = 6.1, GALLERY_END = 5.63;
const FLOOR_TILE = 12;
const VAULT_CROWN = 13.8;

export async function dressChuninExamRoom(c: DressContext) {
  const { model, root } = c;
  model.updateMatrixWorld(true);
  let wallMap: THREE.Texture | null = null;
  const statue: THREE.Mesh[] = [], sleeves: THREE.Mesh[] = [], floors: THREE.Mesh[] = [];
  const box = new THREE.Box3();
  model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    box.setFromObject(mesh);
    if (/Mesh30_/.test(material.name)) statue.push(mesh);
    if (/Mesh11_/.test(material.name) && material.map) wallMap = material.map;
    if (/Mesh14_/.test(material.name) && box.max.y < 2.5) sleeves.push(mesh);
    if ((/Mesh1_0_0_0_root/.test(material.name) || /Mesh8_0_0_0$/.test(material.name)) && box.max.y < .5) floors.push(mesh);
  });
  for (const m of statue) m.visible = false;
  await c.kit.load(['br/ram-seal']);
  c.kit.place('br/ram-seal', { x: 0, y: 0, z: -9.42, scale: 9 });
  lightStatue([c.kit.material('br/ram-seal', /./)], new THREE.Color(.62, .86, .8), 99);
  for (const m of sleeves) m.visible = false;
  root.add(statueSleeves(c));

  if (floors.length) {
    const tiles = await c.texture('/assets/environment/br/exam-tiles.webp', { repeat: 1, anisotropy: 8 });
    for (const mesh of floors) {
      worldUv(mesh, FLOOR_TILE);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.map = tiles; material.needsUpdate = true;
      if (/Mesh8_/.test(material.name)) material.color.setRGB(1.3, 1.3, 1.24);
    }
  }

  const concrete = stageMaterial(c.stage, 'Hall upper walls', { map: wallMap, color: 0xdfe8e2, roughness: .95, side: THREE.FrontSide });
  const ceiling = stageMaterial(c.stage, 'Hall ceiling', { map: wallMap, color: 0x8e9a94, roughness: 1, side: THREE.FrontSide });
  const walls: THREE.BufferGeometry[] = [];
  const height = CEILING - WALL_TOP + .05;
  walls.push(wallPlane(NEAR - FAR, height, [-SIDE, WALL_TOP - .05 + height / 2, (NEAR + FAR) / 2], Math.PI / 2));
  walls.push(wallPlane(NEAR - FAR, height, [SIDE, WALL_TOP - .05 + height / 2, (NEAR + FAR) / 2], -Math.PI / 2));
  walls.push(wallPlane(2 * SIDE, height, [0, WALL_TOP - .05 + height / 2, FAR], 0));
  walls.push(wallPlane(2 * SIDE, height, [0, WALL_TOP - .05 + height / 2, NEAR], Math.PI));
  const wallMesh = new THREE.Mesh(mergeGeometries(walls), concrete);
  wallMesh.name = 'hall upper walls'; wallMesh.receiveShadow = true;
  root.add(wallMesh);
  const { vault, ribs, lunettes } = barrelVault();
  const ceilingMesh = new THREE.Mesh(mergeGeometries([vault, lunettes]), concrete);
  ceilingMesh.name = 'hall vault'; ceilingMesh.receiveShadow = true;
  root.add(ceilingMesh);
  const ribMesh = new THREE.Mesh(ribs, ceiling);
  ribMesh.name = 'hall vault ribs'; ribMesh.receiveShadow = true;
  root.add(ribMesh);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, NEAR - FAR - 3).translate(0, VAULT_CROWN - .55, (NEAR + FAR) / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeafff2).multiplyScalar(1.6), name: 'Hall tube light' }));
  strip.name = 'hall tube light';
  root.add(strip);
  root.add(portal(c));

  const banner = bannerTexture();
  const cloth = stageMaterial(c.stage, 'Hall banners', { map: banner, color: 0xffffff, roughness: .9, side: THREE.FrontSide, transparent: true, alphaTest: .5 });
  const banners: THREE.BufferGeometry[] = [];
  for (const x of [-3.85, 3.85]) banners.push(new THREE.PlaneGeometry(1.8, 4.2).translate(x, 8.55, FAR + .06));
  banners.push(new THREE.PlaneGeometry(1.5, 4.3).rotateY(Math.PI).translate(0, 8.95, NEAR - .06));
  for (const z of [-8.6, -3.6, 1.4]) for (const side of [-1, 1]) {
    banners.push(new THREE.PlaneGeometry(1.7, 3.6).rotateY(-side * Math.PI / 2).translate(side * (SIDE - .07), 6.35, z));
  }
  for (const z of [-8.45, -4.95, -1.45, 2.05]) for (const side of [-1, 1]) {
    banners.push(new THREE.PlaneGeometry(1.25, 2.3).rotateY(-side * Math.PI / 2).translate(side * (SIDE - .06), 2.3, z));
  }
  const bannerMesh = new THREE.Mesh(mergeGeometries(banners), cloth);
  bannerMesh.name = 'hall banners';
  root.add(bannerMesh);

  const rust = stageMaterial(c.stage, 'Hall pilasters', { map: wallMap, color: 0xffffff, roughness: .9, vertexColors: true });
  const pilasters: THREE.BufferGeometry[] = [];
  const tone = (g: THREE.BufferGeometry, hex: number) => {
    const colour = new THREE.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colour.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  for (let z = FAR + 1.5; z < GALLERY_END - 1; z += 3.5) for (const side of [-1, 1]) {
    const back = new THREE.BoxGeometry(.15, GALLERY - .22, .8).translate(side * 7.025, (GALLERY - .22) / 2, z);
    const face = new THREE.BoxGeometry(.04, GALLERY - .22, .58).translate(side * 6.93, (GALLERY - .22) / 2, z);
    for (const [g, hex] of [[back, 0xa3ad9f], [face, 0xd4dbcf]] as const) { metresUv(g, 'xy', 4); pilasters.push(tone(openBox(g.toNonIndexed(), side), hex)); }
  }
  const pilasterMesh = new THREE.Mesh(mergeGeometries(pilasters), rust);
  pilasterMesh.name = 'hall pilasters'; pilasterMesh.receiveShadow = true;
  root.add(pilasterMesh);

  const rail = stageMaterial(c.stage, 'Hall railings', { map: railTexture(), color: 0xffffff, roughness: .8, side: THREE.DoubleSide, alphaTest: .5 });
  const rails: THREE.BufferGeometry[] = [];
  const length = GALLERY_END - FAR;
  for (const side of [-1, 1]) {
    const g = new THREE.PlaneGeometry(length, 1.05);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length / 9.6);
    rails.push(g.rotateY(-side * Math.PI / 2).translate(side < 0 ? -GALLERY_EDGE + .03 : GALLERY_EDGE + .03, GALLERY + .525, (GALLERY_END + FAR) / 2));
  }
  const railMesh = new THREE.Mesh(mergeGeometries(rails), rail);
  railMesh.name = 'hall railings';
  root.add(railMesh);
  c.kit.flush(c.stage);
}

function barrelVault() {
  const rise = VAULT_CROWN - CEILING, R = (SIDE * SIDE + rise * rise) / (2 * rise), cy = VAULT_CROWN - R, half = Math.asin(SIDE / R);
  const N = 24;
  const at = (k: number, inset = 0) => { const a = -half + 2 * half * k / N; return [Math.sin(a) * (R - inset), cy + Math.cos(a) * (R - inset)] as const; };
  const pos: number[] = [], uv: number[] = [];
  let arc = 0;
  for (let k = 0; k < N; k++) {
    const [x0, y0] = at(k), [x1, y1] = at(k + 1), step = Math.hypot(x1 - x0, y1 - y0);
    const quad = [[x0, y0, FAR, arc], [x1, y1, FAR, arc + step], [x1, y1, NEAR, arc + step], [x0, y0, NEAR, arc]];
    for (const i of [0, 1, 2, 0, 2, 3]) { const [x, y, z, u] = quad[i]; pos.push(x, y, z); uv.push(u / 4, z / 4); }
    arc += step;
  }
  const vault = new THREE.BufferGeometry();
  vault.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  vault.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  vault.computeVertexNormals();
  const rp: number[] = [];
  for (let z = FAR + 1.6; z < NEAR - 1; z += 3) for (let k = 0; k < N; k++) {
    const [ax, ay] = at(k, .3), [bx, by] = at(k + 1, .3), [ox, oy] = at(k), [px, py] = at(k + 1);
    const z0 = z - .2, z1 = z + .2;
    rp.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z0, bx, by, z1, ax, ay, z1);
    rp.push(ox, oy, z0, px, py, z0, bx, by, z0, ox, oy, z0, bx, by, z0, ax, ay, z0);
    rp.push(ox, oy, z1, bx, by, z1, px, py, z1, ox, oy, z1, ax, ay, z1, bx, by, z1);
  }
  const ribs = new THREE.BufferGeometry();
  ribs.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  ribs.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(rp.length / 3 * 2).fill(0).map((_, i) => (i % 2 ? rp[(i >> 1) * 3 + 1] : rp[(i >> 1) * 3]) / 4), 2));
  ribs.computeVertexNormals();
  const lp: number[] = [], lu: number[] = [];
  for (const [z, facing] of [[FAR, 1], [NEAR, -1]] as const) for (let k = 0; k < N; k++) {
    const [x0, y0] = at(k), [x1, y1] = at(k + 1);
    const tri = facing > 0 ? [[0, CEILING], [x1, y1], [x0, y0]] : [[0, CEILING], [x0, y0], [x1, y1]];
    for (const [x, y] of tri) { lp.push(x, y, z + facing * .01); lu.push(x / 4, y / 4); }
  }
  const lunettes = new THREE.BufferGeometry();
  lunettes.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lunettes.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2));
  lunettes.computeVertexNormals();
  return { vault, ribs, lunettes };
}

function portal(c: DressContext) {
  const arch = (w: number, spring: number, cut?: { w: number; spring: number }) => {
    const sh = new THREE.Shape();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, spring);
    sh.absarc(0, spring, w / 2, 0, Math.PI, false); sh.lineTo(-w / 2, 0);
    if (cut) {
      const hole = new THREE.Path();
      hole.moveTo(-cut.w / 2, 0); hole.lineTo(-cut.w / 2, cut.spring); hole.absarc(0, cut.spring, cut.w / 2, Math.PI, 0, true); hole.lineTo(cut.w / 2, 0); hole.lineTo(-cut.w / 2, 0);
      sh.holes.push(hole);
    }
    return sh;
  };
  const group = new THREE.Group();
  group.name = 'hall portal';
  const niche = new THREE.Mesh(new THREE.ShapeGeometry(arch(3.0, 3.5, { w: 2.16, spring: 2.28 }), 12).rotateY(Math.PI).translate(0, 0, NEAR - .02),
    stageMaterial(c.stage, 'Hall portal niche', { color: 0x2c3432, roughness: 1, side: THREE.FrontSide }));
  const surround = new THREE.ExtrudeGeometry(arch(4.4, 3.8, { w: 3.0, spring: 3.5 }), { depth: .25, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 1, curveSegments: 14 });
  surround.rotateY(Math.PI).translate(0, 0, NEAR - .03);
  const key = new THREE.BoxGeometry(.6, .9, .4).translate(0, 3.8 + 2.2 - .05, NEAR - .2);
  const stone = stageMaterial(c.stage, 'Hall portal stone', { color: 0xd6d2c2, roughness: .9 });
  group.add(niche, new THREE.Mesh(mergeGeometries([surround.toNonIndexed(), key.toNonIndexed()].map(g => { g.deleteAttribute('uv'); return g; })), stone));
  return group;
}

function scaleAbout(meshes: THREE.Mesh[], scale: [number, number, number], pivot: THREE.Vector3) {
  const about = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new THREE.Matrix4().makeScale(...scale))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  for (const m of meshes) {
    const world = m.matrixWorld.clone();
    const parentInverse = m.parent ? m.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
    const next = parentInverse.multiply(about).multiply(world);
    next.decompose(m.position, m.quaternion, m.scale);
    m.updateMatrixWorld(true);
  }
}

function lightStatue(materials: THREE.Material[], hue: THREE.Color | null, below: number) {
  for (const material of new Set(materials)) addShaderPatch(material, hue ? 'exam-statue-v1' : 'exam-statue-own-v1', shader => {
    shader.uniforms.uStatueHue = { value: hue ?? new THREE.Color(1, 1, 1) };
    shader.uniforms.uStatueBelow = { value: below };
    shader.uniforms.uStatueKey = { value: new THREE.Color(1, .93, .84).multiplyScalar(.85) };
    shader.uniforms.uStatueDir = { value: new THREE.Vector3(.35, .55, .76).normalize() };
    shader.vertexShader = 'varying float vStatueY;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n\tvStatueY = ( modelMatrix * vec4( transformed, 1.0 ) ).y;');
    shader.fragmentShader = 'uniform vec3 uStatueHue;\nuniform float uStatueBelow;\nuniform vec3 uStatueKey;\nuniform vec3 uStatueDir;\nvarying float vStatueY;\n'
      + shader.fragmentShader
        .replace('#include <roughnessmap_fragment>', `float statueOn = step( vStatueY, uStatueBelow );
	${hue ? 'diffuseColor.rgb = mix( diffuseColor.rgb, vec3( dot( diffuseColor.rgb, vec3( .2126, .7152, .0722 ) ) ) * uStatueHue, statueOn );' : ''}
	#include <roughnessmap_fragment>`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	totalEmissiveRadiance += statueOn * diffuseColor.rgb * uStatueKey * ( .1 + max( dot( normal, normalize( ( viewMatrix * vec4( uStatueDir, 0.0 ) ).xyz ) ), 0.0 ) );`);
  });
}

function worldUv(mesh: THREE.Mesh, tile: number) {
  mesh.updateMatrixWorld(true);
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  let uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2); mesh.geometry.setAttribute('uv', uv); }
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    uv.setXY(i, p.x / tile, -p.z / tile);
  }
  uv.needsUpdate = true;
}

function wallPlane(width: number, height: number, at: [number, number, number], yaw: number) {
  const g = new THREE.PlaneGeometry(width, height);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width / 4, uv.getY(i) * height / 4);
  g.rotateY(yaw).translate(...at);
  return g.toNonIndexed();
}

function metresUv(g: THREE.BufferGeometry, plane: 'xz' | 'xy', tile: number) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute, uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / tile, (plane === 'xz' ? pos.getZ(i) : pos.getY(i)) / tile);
}

function bannerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 768;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#c4572c'; g.fillRect(0, 0, 256, 768);
  g.strokeStyle = '#f4ead8'; g.lineWidth = 12; g.strokeRect(14, 14, 228, 740);
  g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 256, 26);
  g.strokeStyle = '#f4ead8'; g.lineWidth = 24; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(66, 262); g.lineTo(94, 330); g.stroke();
  g.beginPath(); g.moveTo(192, 254); g.lineTo(160, 332); g.stroke();
  g.beginPath(); g.moveTo(130, 196); g.quadraticCurveTo(132, 330, 58, 446); g.stroke();
  g.beginPath(); g.moveTo(132, 344); g.quadraticCurveTo(160, 410, 206, 446); g.stroke();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 768); g.lineTo(128, 690); g.lineTo(256, 768); g.closePath(); g.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}

function railTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const iron = '#b4603c', light = '#de9466';
  g.fillStyle = iron;
  for (let x = 0; x < 1024; x += 32) g.fillRect(x + 13, 0, 6, 128);
  g.fillRect(0, 0, 1024, 16); g.fillRect(0, 60, 1024, 6); g.fillRect(0, 116, 1024, 12);
  g.fillStyle = light; g.fillRect(0, 0, 1024, 5); g.fillRect(0, 60, 1024, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function statueSleeves(c: DressContext) {
  const R = 1.05, TILE = 1.1;
  const parts: THREE.BufferGeometry[] = [];
  const metres = (g: THREE.BufferGeometry, u: number, v: number) => {
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u / TILE, uv.getY(i) * v / TILE);
    return g.index ? g.toNonIndexed() : g;
  };
  const cuffs: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const points = [[3.9, 1.35, -9.2], [5.1, 1.25, -9.55], [6.2, 1.15, -10.3], [7.0, 1.1, -11.4], [7.9, 1.1, -12.4]].map(([x, y, z]) => new THREE.Vector3(side * x, y, z));
    const path = new THREE.CatmullRomCurve3(points);
    parts.push(metres(new THREE.TubeGeometry(path, 40, R, 18, false), path.getLength(), 2 * Math.PI * R));
    for (const end of [points[0], points[points.length - 1]]) parts.push(metres(new THREE.SphereGeometry(R, 18, 10).translate(end.x, end.y, end.z), 2 * Math.PI * R, Math.PI * R));
    const at = path.getPointAt(.06), along = path.getTangentAt(.06);
    const cuff = new THREE.CylinderGeometry(R + .06, R + .06, .8, 36, 1, true);
    cuff.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), along)).translate(at.x, at.y, at.z);
    cuffs.push(cuff.index ? cuff.toNonIndexed() : cuff);
  }
  const material = stageMaterial(c.stage, 'Statue sleeves', { map: scaleTexture(), color: 0xffffff, roughness: .7 });
  lightStatue([material], new THREE.Color(.2, .62, .56), 99);
  const mesh = new THREE.Mesh(mergeGeometries(parts), material);
  mesh.name = 'statue sleeves'; mesh.castShadow = true; mesh.receiveShadow = true;
  const bronze = stageMaterial(c.stage, 'Statue cuffs', { color: 0xc4b89c, roughness: .8 });
  lightStatue([bronze], new THREE.Color(.52, .45, .34), 99);
  const ring = new THREE.Mesh(mergeGeometries(cuffs), bronze);
  ring.name = 'statue cuffs'; ring.castShadow = true;
  mesh.add(ring);
  return mesh;
}

function openBox(g: THREE.BufferGeometry, side: number) {
  const drop = new Set([side > 0 ? 0 : 1, 3]);
  const keep: number[] = [];
  for (let face = 0; face < 6; face++) if (!drop.has(face)) for (let k = 0; k < 6; k++) keep.push(face * 6 + k);
  const out = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(g.attributes)) {
    const a = attribute as THREE.BufferAttribute, data = new Float32Array(keep.length * a.itemSize);
    keep.forEach((i, j) => { for (let c = 0; c < a.itemSize; c++) data[j * a.itemSize + c] = a.array[i * a.itemSize + c]; });
    out.setAttribute(name, new THREE.BufferAttribute(data, a.itemSize));
  }
  return out;
}

function scaleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#1e322a'; g.fillRect(0, 0, 256, 256);
  const W = 64, H = 32;
  for (let row = -1; row <= 256 / H + 1; row++) for (let col = -1; col <= 256 / W + 1; col++) {
    const x = col * W + (row % 2 ? W / 2 : 0), y = row * H;
    const shade = g.createLinearGradient(x, y - H, x, y + H * .95);
    shade.addColorStop(0, '#2e4a3e'); shade.addColorStop(.6, '#5a8070'); shade.addColorStop(1, '#8ab494');
    g.fillStyle = shade;
    g.beginPath(); g.ellipse(x, y, W * .5, H * .95, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#b4d4a8'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(x, y, W * .5 - 2, H * .95 - 2, 0, Math.PI * .15, Math.PI * .85); g.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
