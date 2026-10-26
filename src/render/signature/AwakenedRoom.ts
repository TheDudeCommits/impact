import * as THREE from 'three';
import { AWAKENING_ENTRY } from '../../game/awakening';
import type { Fighter } from '../Fighter';

const SKIN_HEAD = `
#include <common>
#include <skinning_pars_vertex>
uniform float uStrength; uniform float uThick; uniform float uPush;
varying vec3 vNormalW; varying vec3 vWorld;
void main(){
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  world.xyz += n * uThick * uStrength;
  vNormalW = n; vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  mv.xyz += normalize(mv.xyz) * uPush;
  gl_Position = projectionMatrix * mv;
}`;
const FILM_FRAGMENT = `
uniform vec3 uCore; uniform vec3 uEdge; uniform float uTime; uniform float uStrength;
varying vec3 vNormalW; varying vec3 vWorld;
void main(){
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float graze = 1.0 - abs(dot(n, v));
  float scan = pow(.5 + .5 * sin((vWorld.x + vWorld.y + vWorld.z) * 22.0 - uTime * 7.0), 6.0);
  vec3 col = uCore * (.6 + 1.0 * graze) + uEdge * (pow(graze, 3.0) * 1.4 + scan * .7);
  float a = (.4 + .55 * pow(graze, 1.5) + .3 * scan) * uStrength;
  gl_FragColor = vec4(col * a, a);
}`;
const MEMBRANE_FRAGMENT = `
uniform vec3 uCore; uniform vec3 uEdge; uniform float uTime; uniform float uStrength;
varying vec3 vNormalW; varying vec3 vWorld;
void main(){
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float f = abs(dot(n, v)), near = smoothstep(0.0, .3, f);
  float sweep = pow(.5 + .5 * sin(vWorld.y * 9.0 - uTime * 3.2), 4.0);
  vec3 col = mix(uEdge, uCore, near) + uEdge * sweep * .6;
  float a = near * (.55 + .45 * sweep) * uStrength;
  if (a < .004) discard;
  gl_FragColor = vec4(col * a, a);
}`;
const SCAN_FRAGMENT = `
uniform vec3 uCore; uniform vec3 uEdge; uniform float uTime; uniform float uStrength; uniform float uBase;
varying vec3 vNormalW; varying vec3 vWorld;
void main(){
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(n, v)), 2.2);
  float y = vWorld.y - uBase;
  // Scan-lines climbing him, and a bright sweep every beat and a half.
  float lines = pow(.5 + .5 * sin(y * 46.0 - uTime * 9.0), 18.0);
  float sweepAt = fract(uTime * .65) * 2.4 - .2;
  float sweep = exp(-pow((y - sweepAt) / .07, 2.0));
  // The ROOM's cut space: a faint grid, a line a few millimetres wide every
  // fifteen centimetres, anchored in the world so he moves through it.
  vec3 cell = abs(fract(vWorld / .15 + .5) - .5) * .15;
  float grid = 1.0 - smoothstep(.0, .006 + fwidth(vWorld.x) * .6, min(min(cell.x, cell.y), cell.z));
  vec3 col = uCore * (rim * 1.1 + lines * .3 + grid * .14) + uEdge * (sweep * 1.1 + rim * rim * .8);
  float a = clamp(rim * .65 + lines * .18 + sweep * .5 + grid * .08, 0.0, .8) * uStrength;
  gl_FragColor = vec4(col * uStrength, a);
}`;
const CUBE_VERTEX = `
attribute float aFade;
varying vec2 vUv; varying float vFade; varying vec3 vNormalW; varying vec3 vWorld;
void main(){
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vUv = uv; vFade = aFade; vWorld = world.xyz; vNormalW = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;
const CUBE_FRAGMENT = `
uniform vec3 uCore; uniform vec3 uEdge;
varying vec2 vUv; varying float vFade; varying vec3 vNormalW; varying vec3 vWorld;
void main(){
  float d = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)), aa = fwidth(d) * 1.5 + 1e-4;
  float edge = 1.0 - smoothstep(.045, .045 + aa, d);
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float face = .1 + .12 * (1.0 - abs(dot(n, v)));
  vec3 col = uEdge * edge * 1.3 + uCore * face;
  float a = max(edge * .95, face) * vFade;
  gl_FragColor = vec4(col * a, a);
}`;
const premultiplied = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } as const;

const CORE = new THREE.Color(.16, .5, 1.25), EDGE = new THREE.Color(.62, 1.05, 1.7);
const CUBES = 6, ORBIT = 1.05, CUBE = .2;

interface Part { source: THREE.SkinnedMesh; shell: THREE.SkinnedMesh }
interface Rig { fighter: Fighter; film: Part[]; membrane: Part[]; scan: Part[]; filmMaterial: THREE.ShaderMaterial; membraneMaterial: THREE.ShaderMaterial; scanMaterial: THREE.ShaderMaterial; used: number; shown: number; hips?: THREE.Object3D; slot: number }

const skinnedCopy = (mesh: THREE.SkinnedMesh, material: THREE.Material, name: string, order: number) => {
  const geometry = new THREE.BufferGeometry(), from = mesh.geometry;
  if (from.index) geometry.setIndex(from.index);
  for (const n of ['position', 'normal', 'skinIndex', 'skinWeight']) if (from.attributes[n]) geometry.setAttribute(n, from.attributes[n]);
  geometry.groups = from.groups.slice(); geometry.drawRange = { ...from.drawRange };
  const shell = new THREE.SkinnedMesh(geometry, material);
  shell.bindMode = mesh.bindMode; shell.bindMatrix.copy(mesh.bindMatrix); shell.bindMatrixInverse.copy(mesh.bindMatrixInverse); shell.skeleton = mesh.skeleton;
  shell.name = name; shell.frustumCulled = false; shell.visible = false; shell.renderOrder = order; shell.castShadow = shell.receiveShadow = false;
  return shell;
};
function warmSkinned(material: THREE.Material, name: string) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .01, 0, .01, 0, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
  mesh.name = name; mesh.frustumCulled = false; mesh.visible = false;
  return mesh;
}

export class AwakenedRoom {
  private rigs = new Map<Fighter, Rig>();
  private cubes: THREE.InstancedMesh<THREE.BoxGeometry, THREE.ShaderMaterial>;
  private fade: THREE.InstancedBufferAttribute;
  private warm: THREE.SkinnedMesh[] = [];
  private frame = 0;
  private pose = new THREE.Object3D(); private at = new THREE.Vector3();
  constructor(private scene: THREE.Scene) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    this.fade = new THREE.InstancedBufferAttribute(new Float32Array(CUBES * 4), 1);
    this.fade.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aFade', this.fade);
    this.cubes = new THREE.InstancedMesh(geometry, new THREE.ShaderMaterial({ name: 'ShamblesCube', vertexShader: CUBE_VERTEX, fragmentShader: CUBE_FRAGMENT,
      uniforms: { uCore: { value: CORE.clone() }, uEdge: { value: EDGE.clone() } }, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true, ...premultiplied }), CUBES * 4);
    this.cubes.name = 'shambles-cubes'; this.cubes.count = 0; this.cubes.frustumCulled = false; this.cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.cubes.renderOrder = -1;
    scene.add(this.cubes);
  }
  private filmMaterial() {
    return new THREE.ShaderMaterial({ name: 'KRoomFilm', vertexShader: SKIN_HEAD, fragmentShader: FILM_FRAGMENT, side: THREE.FrontSide,
      uniforms: { uStrength: { value: 0 }, uThick: { value: .034 }, uPush: { value: 0 }, uTime: { value: 0 }, uCore: { value: CORE.clone() }, uEdge: { value: EDGE.clone() } },
      transparent: true, depthWrite: false, toneMapped: false, ...premultiplied });
  }
  private membraneMaterial() {
    return new THREE.ShaderMaterial({ name: 'RoomMembrane', vertexShader: SKIN_HEAD, fragmentShader: MEMBRANE_FRAGMENT, side: THREE.BackSide,
      uniforms: { uStrength: { value: 0 }, uThick: { value: .045 }, uPush: { value: .4 }, uTime: { value: 0 }, uCore: { value: CORE.clone() }, uEdge: { value: EDGE.clone() } },
      transparent: true, depthWrite: false, toneMapped: false, ...premultiplied });
  }
  private scanMaterial() {
    return new THREE.ShaderMaterial({ name: 'RoomScan', vertexShader: SKIN_HEAD, fragmentShader: SCAN_FRAGMENT, side: THREE.FrontSide,
      uniforms: { uStrength: { value: 0 }, uThick: { value: 0 }, uPush: { value: 0 }, uTime: { value: 0 }, uBase: { value: 0 }, uCore: { value: CORE.clone() }, uEdge: { value: EDGE.clone() } },
      transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, toneMapped: false, ...premultiplied });
  }
  warmup() {
    if (this.warm.length) return;
    this.warm = [warmSkinned(this.filmMaterial(), 'k-room-warmup'), warmSkinned(this.membraneMaterial(), 'room-membrane-warmup'), warmSkinned(this.scanMaterial(), 'room-scan-warmup')];
    this.scene.add(...this.warm);
  }
  hideWarmup() { for (const mesh of this.warm) mesh.visible = false; }

  private rig(fighter: Fighter) {
    let rig = this.rigs.get(fighter);
    if (rig) return rig;
    const filmMaterial = this.filmMaterial(), membraneMaterial = this.membraneMaterial(), scanMaterial = this.scanMaterial(), film: Part[] = [], membrane: Part[] = [], scan: Part[] = [];
    fighter.model.traverse(o => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh || mesh.name.endsWith('-ink') || mesh.name.startsWith('awaken-') || /outline|shadow/i.test(mesh.name)) return;
      const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];
      if (materials.some(m => m.transparent && m.opacity < .9)) return;
      const blade = /blade/i.test(mesh.name) || (!/hilt|sheath|scabbard|handle/i.test(mesh.name) && materials.some(m => /weapon/i.test(m.name)));
      if (blade) { const shell = skinnedCopy(mesh, filmMaterial, 'k-room', -1); this.scene.add(shell); film.push({ source: mesh, shell }); return; }
      if (/sheath|scabbard|hilt/i.test(mesh.name) || mesh.geometry.attributes.position.count < 150) return;
      const shell = skinnedCopy(mesh, membraneMaterial, 'room-membrane', -1); this.scene.add(shell); membrane.push({ source: mesh, shell });
      const over = skinnedCopy(mesh, scanMaterial, 'room-scan', -1); this.scene.add(over); scan.push({ source: mesh, shell: over });
    });
    rig = { fighter, film, membrane, scan, filmMaterial, membraneMaterial, scanMaterial, used: 0, shown: 0, hips: fighter.joints?.get('Hips'), slot: this.rigs.size % 4 };
    this.rigs.set(fighter, rig);
    return rig;
  }

  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, density: number) {
    this.frame++;
    let cubes = 0;
    for (const fighter of fighters.values()) {
      const s = fighter.state;
      if (s.fighter !== 'law') continue;
      const rig = this.rig(fighter);
      rig.used = this.frame;
      const elapsed = s.actionTime * s.actionDuration;
      const entry = s.action === 'awaken' ? THREE.MathUtils.smoothstep(elapsed, AWAKENING_ENTRY * .3, AWAKENING_ENTRY * .85) : 1;
      const want = s.awakened && s.alive ? THREE.MathUtils.clamp((s.awakenedUntil ?? 0) - time, 0, 1) * entry : 0;
      rig.shown += (want - rig.shown) * (1 - Math.exp(-Math.min(.05, Math.max(0, dt)) * 8));
      if (want === 0 && rig.shown < .02) rig.shown = 0;
      const k = rig.shown;
      const strength = k * Math.max(.6, density);
      rig.filmMaterial.uniforms.uTime.value = rig.membraneMaterial.uniforms.uTime.value = rig.scanMaterial.uniforms.uTime.value = time;
      rig.filmMaterial.uniforms.uStrength.value = rig.membraneMaterial.uniforms.uStrength.value = rig.scanMaterial.uniforms.uStrength.value = strength;
      rig.scanMaterial.uniforms.uBase.value = fighter.group.position.y;
      for (const part of rig.film) this.place(part, fighter, k);
      for (const part of rig.membrane) this.place(part, fighter, k);
      for (const part of rig.scan) this.place(part, fighter, k);
      if (k <= .01 || cubes + CUBES > this.cubes.instanceMatrix.count) continue;
      const p = fighter.group.position;
      if (rig.hips) rig.hips.getWorldPosition(this.at); else this.at.set(p.x, p.y + 1, p.z);
      for (let i = 0; i < CUBES; i++) {
        const a = time * (.45 + (i % 3) * .08) + i * (Math.PI * 2 / CUBES) + rig.slot;
        const r = ORBIT * (.92 + .12 * Math.sin(time * .7 + i * 1.7)), h = .25 + .6 * ((i * .37) % 1) + .08 * Math.sin(time * 1.3 + i);
        this.pose.position.set(this.at.x + Math.cos(a) * r, p.y + 1 + h, this.at.z + Math.sin(a) * r);
        this.pose.rotation.set(time * (.6 + i * .11), time * (.4 + i * .07) + i, time * .3 + i * .5);
        this.pose.scale.setScalar(CUBE * (.8 + .4 * ((i * .61) % 1)) * (.6 + .4 * k));
        this.pose.updateMatrix();
        this.cubes.setMatrixAt(cubes, this.pose.matrix);
        this.fade.setX(cubes++, k);
      }
    }
    this.cubes.count = cubes;
    this.cubes.instanceMatrix.needsUpdate = true;
    if (cubes) { this.fade.clearUpdateRanges(); this.fade.addUpdateRange(0, cubes); this.fade.needsUpdate = true; }
    for (const rig of this.rigs.values()) {
      if (rig.used === this.frame) continue;
      for (const part of rig.film) part.shell.visible = false;
      for (const part of rig.membrane) part.shell.visible = false;
      for (const part of rig.scan) part.shell.visible = false;
      if ((this.frame & 63) === 0) { let present = false; for (const f of fighters.values()) if (f === rig.fighter) { present = true; break; } if (!present) this.release(rig.fighter, rig); }
    }
  }
  private place(part: Part, fighter: Fighter, k: number) {
    let visible = k > .01;
    for (let o: THREE.Object3D | null = part.source; o && visible; o = o.parent) { visible = o.visible; if (o === fighter.group) break; }
    part.shell.visible = visible;
    if (visible && part.source.bindMode !== THREE.AttachedBindMode) { part.shell.matrixAutoUpdate = false; part.shell.matrix.copy(part.source.matrixWorld); part.shell.matrixWorldNeedsUpdate = true; }
  }
  private release(fighter: Fighter, rig: Rig) {
    for (const part of [...rig.film, ...rig.membrane, ...rig.scan]) { part.shell.removeFromParent(); part.shell.geometry.index = null; part.shell.geometry.attributes = {}; part.shell.geometry.dispose(); }
    rig.filmMaterial.dispose(); rig.membraneMaterial.dispose(); rig.scanMaterial.dispose(); this.rigs.delete(fighter);
  }
  get showing() {
    let film = 0, membrane = 0, scan = 0;
    for (const rig of this.rigs.values()) { for (const p of rig.film) if (p.shell.visible) film++; for (const p of rig.membrane) if (p.shell.visible) membrane++; for (const p of rig.scan) if (p.shell.visible) scan++; }
    return { film, membrane, scan, cubes: this.cubes.count };
  }
  reset() { for (const rig of this.rigs.values()) { rig.shown = 0; for (const part of [...rig.film, ...rig.membrane, ...rig.scan]) part.shell.visible = false; } this.cubes.count = 0; }
  dispose() {
    for (const rig of [...this.rigs.values()]) this.release(rig.fighter, rig);
    for (const mesh of this.warm) { mesh.removeFromParent(); (mesh.material as THREE.Material).dispose(); mesh.geometry.dispose(); }
    this.warm = [];
    this.cubes.removeFromParent(); this.cubes.geometry.dispose(); this.cubes.material.dispose(); this.cubes.dispose();
  }
}
