import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { CombatEvent } from '../../game/types';
import { AKAINU_AWAKENING, AKAINU_CONTACTS, AKAINU_MOVES, akainuArmVariants } from '../../game/fighters/akainu';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { releaseTextures } from '../sharedTextures';
import { SIGNATURE, involvesLocal } from './context';
import { armoryDraws } from '../vfx/armory/drawn';
import { FIRE } from './FlameSprites';
import { MoveStage, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';

export const AKAINU_HOUND_ASSET = '/assets/fighters/akainu-hound-projectile.glb';
export const AKAINU_FIST_SOURCE = '/assets/fighters/akainu-br1.glb';
export const AKAINU_MAGMA_ASSETS = Object.freeze([AKAINU_HOUND_ASSET, AKAINU_FIST_SOURCE]);
export const AKAINU_MAGMA_LIMITS = Object.freeze({ hounds: 16, fists: 48, basalt: 192, steam: 128, pressure: 32, volcanoes: 8, impacts: 24 });
export const AKAINU_MAGMA_BEATS = Object.freeze({ opener: .44, eruption: 1.51, descent: 2.40, final: 3.15 });
export const isAkainuMagma = (id: string | undefined) => id === 'akainu';
export const MAGMA: StageLook = stageLook(0xffd27a, 0xe0380c, 0x2b0f09, { flame: FIRE });
const HEAVY = AKAINU_MOVES.heavy, SPECIAL = AKAINU_MOVES.special, ULT = AKAINU_MOVES.ultimate, FINAL = ULT.contacts.length - 1;
const FRONT = new THREE.Vector3(0, 0, 1), UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const attacking = (action: string) => action === 'light' || action === 'heavy' || action === 'special' || action === 'ultimate';

type Side = 'Left' | 'Right';
type Sockets = { model: THREE.Object3D | undefined; Left?: THREE.Object3D; Right?: THREE.Object3D; LeftFore?: THREE.Object3D; RightFore?: THREE.Object3D };
const sockets = new WeakMap<Fighter, Sockets>();
function rigSockets(fighter: Fighter) {
  let found = sockets.get(fighter);
  if (!found || found.model !== fighter.model) {
    found = { model: fighter.model, Left: fighter.model?.getObjectByName('LArm_Upper_Palm_Magma_041'), Right: fighter.model?.getObjectByName('RArm_Upper_Palm_Magma_054'),
      LeftFore: fighter.model?.getObjectByName('LArm_Upper_Fore_Magma_038'), RightFore: fighter.model?.getObjectByName('RArm_Upper_Fore_Magma_051') };
    sockets.set(fighter, found);
  }
  return found;
}
function normalVolleyHands(fighter: Fighter): boolean {
  const s = fighter.state;
  return s.action === 'ultimate' && akainuArmVariants(s.action, s.actionTime * s.actionDuration, s.awakened)[0] === 'Normal';
}
export function akainuMagmaSocket(fighter: Fighter, side: Side, out: THREE.Vector3): THREE.Vector3 {
  const normal = fighter.joints?.get(side === 'Left' ? 'LeftHand' : 'RightHand');
  const node = normalVolleyHands(fighter) ? normal : rigSockets(fighter)[side] ?? normal;
  return node ? node.getWorldPosition(out) : out.copy(side === 'Left' ? fighter.handL : fighter.handR);
}
export function akainuMagmaContact(fighter: Fighter, out: THREE.Vector3, clip?: string): boolean {
  if (!isAkainuMagma(fighter.state.fighter)) return false;
  const s = fighter.state;
  const right = clip === 'Rush 2' || clip === 'Magma Backfist' || clip === 'Eruption Uppercut' ||
    s.branch === 'lh' || s.branch === 'llh' || s.action === 'light' && s.chain === 2;
  akainuMagmaSocket(fighter, right ? 'Right' : 'Left', out); return true;
}

function meshIn(gltf: GLTF, name?: string): THREE.Mesh {
  let mesh = name ? gltf.scene.getObjectByName(name) as THREE.Mesh | undefined : undefined;
  if (!mesh && !name) gltf.scene.traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh?.isMesh) throw new Error(`Akainu native asset is missing ${name ?? 'projectile geometry'}`);
  return mesh;
}
function atlasOf(mesh: THREE.Mesh): THREE.Texture {
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshBasicMaterial;
  if (!material.map) throw new Error('Akainu native magma atlas is missing');
  return material.map;
}
function bakedGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const geometry = mesh.geometry.clone(), count = geometry.getAttribute('position').count;
  const positions = new Float32Array(count * 3), p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld); p.toArray(positions, i * 3);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.deleteAttribute('skinIndex'); geometry.deleteAttribute('skinWeight'); geometry.morphAttributes = {};
  geometry.computeVertexNormals(); return geometry;
}

export function bakeAkainuMeteorFist(gltf: GLTF): THREE.BufferGeometry {
  const mesh = meshIn(gltf, 'Akainu_Magma_Left');
  const clip = gltf.animations.find(c => c.name === 'Magma Knuckle');
  const palm = gltf.scene.getObjectByName('LArm_Upper_Palm_Magma_041');
  const elbow = gltf.scene.getObjectByName('LArm_Upper_Fore_Magma_038');
  if (!clip || !palm || !elbow) throw new Error('Akainu native fist contact take or magma joints are missing');
  const mixer = new THREE.AnimationMixer(gltf.scene);
  try {
    mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1).play(); mixer.setTime(clip.duration * AKAINU_CONTACTS.light);
    gltf.scene.updateMatrixWorld(true);
    const p = palm.getWorldPosition(new THREE.Vector3()), direction = p.clone().sub(elbow.getWorldPosition(new THREE.Vector3()));
    if (direction.lengthSq() < 1e-8) throw new Error('Akainu magma fist has a degenerate forward axis');
    const geometry = bakedGeometry(mesh);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(direction.normalize(), FRONT));
    geometry.computeBoundingBox(); const box = geometry.boundingBox!, size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
    if (size.z < .05 || !Number.isFinite(size.z)) { geometry.dispose(); throw new Error('Akainu magma fist has invalid bounds'); }
    geometry.translate(-centre.x, -centre.y, -centre.z); geometry.scale(1.7 / size.z, 1.7 / size.z, 1.7 / size.z);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.nativeTake = 'Magma Knuckle'; geometry.userData.nativeFraction = AKAINU_CONTACTS.light;
    return geometry;
  } finally { mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene); }
}

function releaseSource(gltf: GLTF) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
  gltf.scene.traverse(o => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    if (mesh.isSkinnedMesh) skeletons.add(mesh.skeleton);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if ((value as THREE.Texture | null)?.isTexture) textures.add(value as THREE.Texture);
    }
  });
  releaseTextures(gltf.scene);
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}

const solidVertex = `attribute vec4 magmaData;varying vec4 vData;varying vec2 vUv;varying vec3 vP;varying float vLight;
  void main(){vData=magmaData;vUv=uv;vP=position;vec3 n=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
  vLight=dot(n,normalize(vec3(-.3,.85,.4)));gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const nativeFragment = `uniform sampler2D atlas;uniform float clock;varying vec4 vData;varying vec2 vUv;varying vec3 vP;varying float vLight;
  void main(){if(vData.y<.003)discard;vec3 source=texture2D(atlas,vUv).rgb;
  float vein=1.-smoothstep(.025,.13,abs(sin(vP.x*5.1+sin(vP.y*5.7)+vP.z*4.1)));
  float crust=smoothstep(-.3,.7,sin(vP.x*3.3+sin(vP.z*3.9))*cos(vP.y*4.3))*(1.-vein)*.48;
  float cel=vLight>.35?1.:(vLight>-.25?.83:.62);
  vec3 base=mix(source,vec3(.022,.016,.019),crust)*cel;
  vec3 molten=vec3(1.55,.21,.009)*vein*vData.x*(.19+.025*sin(clock*4.+vData.z));
  gl_FragColor=vec4(base+molten,vData.y);}`;
const basaltFragment = `varying vec4 vData;varying vec2 vUv;varying vec3 vP;varying float vLight;
  void main(){if(vData.y<.003)discard;float seam=1.-smoothstep(.02,.16,abs(sin(vP.x*9.+vP.y*7.+vP.z*11.)));
  float cel=vLight>.35?1.:(vLight>-.25?.75:.45);vec3 crust=vec3(.055,.043,.047)*cel;
  gl_FragColor=vec4(crust+vec3(1.2,.105,.004)*seam*vData.x,vData.y);}`;
const pressureFragment = `varying vec4 vData;varying vec2 vUv;varying vec3 vP;varying float vLight;
  void main(){float edge=pow(max(0.,sin(vUv.y*3.14159)),.55);float broken=.45+.55*step(-.25,sin(vUv.x*48.+vData.z));
  gl_FragColor=vec4(mix(vec3(.12,.095,.10),vec3(.75,.19,.035),vData.x),edge*broken*vData.y);}`;
const steamVertex = `attribute vec4 magmaData;varying vec4 vData;varying vec2 vUv;
  void main(){vData=magmaData;vUv=uv;vec4 centre=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
  centre.xy+=position.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));gl_Position=projectionMatrix*centre;}`;
const steamFragment = `uniform float clock;varying vec4 vData;varying vec2 vUv;
  void main(){vec2 p=vUv*2.-1.;float r=min(length(p-vec2(-.27,-.04))/.79,min(length(p-vec2(.28,.07))/.70,length(p-vec2(.02,.36))/.72));
  float swirl=.82+.18*sin(p.x*12.+sin(p.y*9.+vData.z)+clock*1.7);
  float a=(1.-smoothstep(.36,1.,r))*swirl*vData.y;if(a<.003)discard;
  vec3 smoke=mix(vec3(.15,.145,.16),vec3(.55,.52,.51),clamp(p.y*.4+.5,0.,1.));
  gl_FragColor=vec4(smoke+vec3(.11,.018,0.)*vData.x,a);}`;

class MagmaBatch {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private data: THREE.InstancedBufferAttribute;
  private object = new THREE.Object3D();
  count = 0;
  constructor(scene: THREE.Scene, name: string, geometry: THREE.BufferGeometry, readonly capacity: number,
    kind: 'native' | 'basalt' | 'steam' | 'pressure', atlas?: THREE.Texture) {
    this.data = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('magmaData', this.data);
    const material = new THREE.ShaderMaterial({ name: `Akainu-${kind}`, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false, uniforms: { clock: { value: 0 }, atlas: { value: atlas ?? null } },
      vertexShader: kind === 'steam' ? steamVertex : solidVertex,
      fragmentShader: kind === 'native' ? nativeFragment : kind === 'steam' ? steamFragment : kind === 'pressure' ? pressureFragment : basaltFragment });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity); this.mesh.name = `akainu-magma-${name}`;
    this.mesh.frustumCulled = false; this.mesh.renderOrder = kind === 'steam' ? 4 : kind === 'native' ? 6 : 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.mesh.setMatrixAt(0, this.object.matrix);
    this.mesh.count = 1; scene.add(this.mesh);
  }
  begin(time: number) { this.count = 0; this.mesh.material.uniforms.clock.value = time; }
  add(p: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number, heat = 1, alpha = 1, seed = 0) {
    if (this.count >= this.capacity || alpha <= .003 || x <= 0 || y <= 0 || z <= 0) return;
    this.object.position.copy(p); this.object.quaternion.copy(q); this.object.scale.set(x, y, z); this.object.updateMatrix();
    this.mesh.setMatrixAt(this.count, this.object.matrix); this.data.setXYZW(this.count++, clamp(heat), clamp(alpha), seed, 0);
  }
  end() { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.data.needsUpdate = true; }
  dispose() { this.mesh.removeFromParent(); this.mesh.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

type Volcano = { actor: string; target: string; seq: number; seed: number; left: THREE.Vector3; right: THREE.Vector3; launched: boolean };
type Impact = { actor: string; seq: number; born: number; seed: number; grade: number; p: THREE.Vector3; floor: number };
type Gather = { actor: string; target: string; seq: number; floor: number; final: boolean };

export class AkainuMagma {
  private stage?: MoveStage;
  private gathers: Gather[] = Array.from({ length: 6 }, () => ({ actor: '', target: '', seq: -1, floor: 0, final: false }));
  private gatherCursor = 0;
  private strike = new THREE.Vector3(); private ground = new THREE.Vector3(); private blow = new THREE.Vector3(); private heading = new THREE.Vector3();
  private hounds?: MagmaBatch;
  private fists?: MagmaBatch;
  private basalt: MagmaBatch;
  private steam: MagmaBatch;
  private pressure: MagmaBatch;
  private batches: MagmaBatch[];
  private sources: GLTF[] = [];
  private loading?: Promise<void>;
  private loaded = false;
  private disposed = false;
  private volcanoes: Volcano[] = Array.from({ length: AKAINU_MAGMA_LIMITS.volcanoes }, () => ({ actor: '', target: '', seq: -1, seed: 0, left: new THREE.Vector3(), right: new THREE.Vector3(), launched: false }));
  private impacts: Impact[] = Array.from({ length: AKAINU_MAGMA_LIMITS.impacts }, () => ({ actor: '', seq: -1, born: -1e9, seed: 0, grade: 0, p: new THREE.Vector3(), floor: 0 }));
  private volcanoCursor = 0;
  private impactCursor = 0;
  private eventCursor = 0;
  private seen = new Float64Array(128).fill(-1);
  private seenAt = new Float64Array(128).fill(-1);
  private p = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private target = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private side = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private flat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  constructor(private scene: THREE.Scene, private kit: Pick<VfxKit, 'budget'> & Partial<VfxKit>) {
    this.basalt = new MagmaBatch(scene, 'basalt', new THREE.IcosahedronGeometry(1, 0), AKAINU_MAGMA_LIMITS.basalt, 'basalt');
    this.steam = new MagmaBatch(scene, 'steam', new THREE.PlaneGeometry(1, 1), AKAINU_MAGMA_LIMITS.steam, 'steam');
    this.pressure = new MagmaBatch(scene, 'pressure', new THREE.RingGeometry(.86, 1, 32, 1), AKAINU_MAGMA_LIMITS.pressure, 'pressure');
    this.batches = [this.basalt, this.steam, this.pressure];
  }
  load(ids: readonly string[]): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (ids.some(isAkainuMagma)) this.stage ??= MoveStage.for(this.scene, this.kit); else if (this.stage) { this.stage.release(); this.stage = undefined; }
    if (this.loaded || !ids.some(isAkainuMagma)) return Promise.resolve();
    return this.loading ??= this.loadNative().catch(error => { this.loading = undefined; throw error; });
  }
  private async loadNative() {
    const loader = new GLTFLoader();
    const result = await Promise.allSettled(AKAINU_MAGMA_ASSETS.map(path => loader.loadAsync(path)));
    const sources = result.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
    const failed = result.find(r => r.status === 'rejected');
    if (this.disposed || failed) {
      for (const source of sources) releaseSource(source);
      if (failed?.status === 'rejected') throw failed.reason;
      return;
    }
    let houndGeometry: THREE.BufferGeometry | undefined, fistGeometry: THREE.BufferGeometry | undefined;
    try {
      const [hound, body] = sources; hound.scene.updateMatrixWorld(true);
      const houndMesh = meshIn(hound), fistMesh = meshIn(body, 'Akainu_Magma_Left');
      const houndAtlas = atlasOf(houndMesh), fistAtlas = atlasOf(fistMesh);
      houndGeometry = bakedGeometry(houndMesh); houndGeometry.computeBoundingBox();
      const size = houndGeometry.boundingBox!.getSize(new THREE.Vector3());
      if (size.z < 3 || size.z > 7) throw new Error('Akainu hound projectile has unexpected native scale');
      fistGeometry = bakeAkainuMeteorFist(body);
      this.hounds = new MagmaBatch(this.scene, 'crimson-hounds', houndGeometry, AKAINU_MAGMA_LIMITS.hounds, 'native', houndAtlas);
      this.fists = new MagmaBatch(this.scene, 'meteor-fists', fistGeometry, AKAINU_MAGMA_LIMITS.fists, 'native', fistAtlas);
      this.batches.push(this.hounds, this.fists); this.sources = sources; this.loaded = true;
    } catch (error) {
      houndGeometry?.dispose(); fistGeometry?.dispose();
      for (const source of sources) releaseSource(source);
      throw error;
    }
  }
  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed) return;
    if (event.kind === 'eliminated' || event.kind === 'respawn') { this.cancel(event.actorId, true); return; }
    if (!isAkainuMagma(event.fighter)) return;
    if (event.kind === 'whiff' || event.kind === 'rejected') { this.cancel(event.actorId); return; }
    if (event.kind !== 'confirm' && event.kind !== 'hit') return;
    const cast = armoryDraws(event.fighter, event.slot, event.branch, event.actorId);
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === event.id && this.seenAt[i] === event.serverTime) return;
    const seen = this.eventCursor++ % this.seen.length; this.seen[seen] = event.id; this.seenAt[seen] = event.serverTime;
    const actor = fighters?.get(event.actorId), victim = event.targetId ? fighters?.get(event.targetId) : undefined;
    const seq = event.actionSeq ?? actor?.state.actionSeq ?? -1;
    if (event.kind === 'confirm') {
      if (event.slot !== 'ultimate' || event.branch || !event.targetId) return;
      Object.assign(this.gathers[this.gatherCursor++ % this.gathers.length], { actor: event.actorId, target: event.targetId, seq, final: false, floor: blowFloor(actor, victim, 0) });
      if (cast) return;
      const volcano = this.volcanoes[this.volcanoCursor++ % this.volcanoes.length];
      Object.assign(volcano, { actor: event.actorId, target: event.targetId, seq, seed: event.id, launched: false });
      return;
    }
    if (!victim && !event.endpoint) return;
    this.land(event, actor, victim, seq);
    if (cast) return;
    const big = event.slot === 'ultimate' && !event.branch && (event.contactIndex ?? 0) >= 2;
    const impact = this.impacts[this.impactCursor++ % this.impacts.length];
    Object.assign(impact, { actor: event.actorId, seq, born: event.serverTime, seed: event.id,
      grade: big ? 2 : event.slot === 'light' ? 0 : 1, floor: victim ? blowFloor(actor, victim, 0) : Math.max(0, (event.endpoint?.y ?? 1.05) - 1.05) });
    if (victim) bodyCentre(victim, impact.p); else impact.p.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    if (big) {
      for (const volcano of this.volcanoes) if (volcano.actor === event.actorId && volcano.seq === seq) volcano.actor = '';
      if (involvesLocal(event.actorId, event.targetId)) SIGNATURE.screen?.impactFrame?.(.55, impact.p);
    }
  }
  private land(event: CombatEvent, actor: Fighter | undefined, victim: Fighter | undefined, seq: number) {
    const st = this.stage; if (!st) return;
    const point = this.p, t = event.serverTime, big = actor?.state.awakened ? 1.15 : 1;
    if (victim) bodyCentre(victim, point); else point.set(event.endpoint!.x, event.endpoint!.y, event.endpoint!.z);
    let floor = blowFloor(actor, victim, point.y - 1);
    const dir = this.blow;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.group.rotation.y), 0, Math.cos(actor.group.rotation.y)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (event.slot === 'light') { st.burst(point, MAGMA, .45, t, { dir, floor, clean: true }); return; }
    if (event.slot === 'heavy') {
      const k = (event.branch ? .85 : 1) * big;
      st.burst(point, MAGMA, 1 * k, t, { dir, floor });
      st.erupt(this.a.copy(point).addScaledVector(dir, .45), this.b.copy(dir).setY(.14).normalize(), MAGMA, .36 * k, 4 * k, t, .34);
      st.scar(this.a.copy(ground).addScaledVector(dir, 1.1), MAGMA, 1.3 * k, t + .05, 1.6);
      return;
    }
    if (event.slot === 'special') {
      if (event.branch === 'airSpecial') { st.burst(point, MAGMA, 2.2, t, { floor }); st.shock(ground, MAGMA, 3.8, t, .45); st.scar(ground, MAGMA, 2.5, t + .05, 2.2); return; }
      const k = (event.branch ? .75 : 1) * big;
      st.burst(point, MAGMA, 2.1 * k, t, { dir, floor });
      st.erupt(ground, UP, MAGMA, .9 * k, 5.2 * k, t + .03, .75);
      st.shock(ground, MAGMA, 5 * k, t, .45);
      st.scar(ground, MAGMA, 2.4 * k, t + .05, 2.4);
      return;
    }
    if (event.slot !== 'ultimate' || event.branch) return;
    if ((event.contactIndex ?? 0) < FINAL) {
      st.burst(point, MAGMA, event.contactIndex ? 1.3 : 1.1, t, { dir, floor });
      if (event.contactIndex) st.shock(ground, MAGMA, 5, t, .5);
      return;
    }
    let confirmed = false;
    for (const g of this.gathers) if (g.actor === event.actorId && g.seq === seq) { g.final = true; floor = g.floor; confirmed = true; }
    if (!confirmed) return;
    ground.y = floor;
    st.burst(point, MAGMA, 1.1, t, { dir, floor });
    st.erupt(this.a.copy(ground).addScaledVector(dir, 1.8), UP, MAGMA, .7, 8, t + .04, .5);
    st.shock(ground, MAGMA, 9.5, t, .6);
    st.scar(this.a.copy(ground).addScaledVector(dir, 2.2), MAGMA, 2.4, t + .15, 2);
    st.scar(this.a.copy(ground).addScaledVector(dir, -2.4), MAGMA, 1.6, t + .25, 1.6);
  }
  private cancel(id: string, victimToo = false) {
    for (const g of this.gathers) if (g.actor === id || victimToo && g.target === id && !g.final) g.actor = '';
    for (const volcano of this.volcanoes) if (volcano.actor === id || victimToo && volcano.target === id) volcano.actor = '';
    for (const impact of this.impacts) if (impact.actor === id) impact.actor = '';
  }
  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    for (const batch of this.batches) batch.begin(time);
    const detail = this.kit.budget >= .65;
    let st = this.stage?.open(time);
    for (const fighter of fighters.values()) {
      const s = fighter.state;
      if (!isAkainuMagma(s.fighter) || !s.alive) continue;
      st ??= (this.stage = MoveStage.for(this.scene, this.kit)).open(time);
      const age = s.actionTime * s.actionDuration;
      const entry = s.action === 'awaken', focus = !!s.awakened || entry && age >= AKAINU_AWAKENING.beats.gather;
      const attackingNow = attacking(s.action) && s.whiffedAt === undefined;
      if (!focus && !attackingNow) continue;
      const until = s.awakenedUntil === undefined ? 1 : clamp(s.awakenedUntil - time);
      const strength = focus ? (entry ? clamp((age - .08) / .27) : until) : .65;
      this.forearm(fighter, 'Left', time, strength, detail);
      if (focus || s.action === 'ultimate' || s.branch === 'lh' || s.branch === 'llh' || s.chain === 2) this.forearm(fighter, 'Right', time, strength, detail);
      if (entry) this.activation(fighter, age, s.actionDuration);
      if (attackingNow) this.swing(st, fighter, age);
    }
    for (const flight of flights.values()) {
      if (!isAkainuMagma(flight.fighter) || flight.slot !== 'special' || flight.branch || !flight.released || armoryDraws(flight.fighter, 'special', undefined, flight.actorId)) continue;
      this.q.setFromUnitVectors(FRONT, flight.heading);
      const hound = flight.awakened ? .6 : .52;
      this.hounds?.add(flight.position, this.q, hound, hound, hound, flight.awakened ? 1 : .65, 1, flight.since);
      if (st) {
        for (let i = 0, n = st.n(5, 3); i < n; i++) {
          this.p.copy(flight.position).addScaledVector(flight.heading, -(.3 + i * .62)); this.p.y += .25 + Math.sin(time * 13 + i * 2.1) * .14;
          st.tongue(this.p, this.a.copy(flight.heading).multiplyScalar(-1).setY(.5).normalize(), 1 - i * .11, 1.9 - i * .18, MAGMA, .85 - i * .12, flight.since + i);
        }
        st.glow(flight.position, 1.25, MAGMA.main, .45); st.glow(this.p.copy(flight.position).addScaledVector(flight.heading, .8), .42, MAGMA.core, .8);
        st.light(this.p.copy(flight.position).setY(flight.position.y + .2), 6.2, MAGMA, .9);
      }
      for (let i = 0; i < (detail ? 5 : 3); i++) {
        const phase = (time * 3.2 + i * .31) % 1;
        this.p.copy(flight.position).addScaledVector(flight.heading, -(.70 + phase * .7));
        this.p.y -= phase * phase * .18;
        const size = .045 * (1 - phase);
        this.basalt.add(this.p, this.q, size, size, size * 1.9, .9, 1 - phase, i);
        if (i < (detail ? 3 : 1)) this.steam.add(this.p, this.q, .23 + phase * .25, .18 + phase * .22, 1, .5, .20 * (1 - phase), i);
      }
    }
    for (const volcano of this.volcanoes) {
      if (!volcano.actor) continue;
      const actor = fighters.get(volcano.actor), victim = fighters.get(volcano.target), s = actor?.state;
      if (!s?.alive || !victim?.state.alive || s.action !== 'ultimate' || (s.actionSeq ?? -1) !== volcano.seq || s.whiffedAt !== undefined) { volcano.actor = ''; continue; }
      const age = s.actionTime * s.actionDuration;
      if (age >= AKAINU_MAGMA_BEATS.final) { volcano.actor = ''; continue; }
      if (age < 1.27) continue;
      if (!volcano.launched) {
        akainuMagmaSocket(actor!, 'Left', volcano.left); akainuMagmaSocket(actor!, 'Right', volcano.right); volcano.launched = true;
      }
      bodyCentre(victim, this.target);
      this.side.set(Math.cos(actor!.group.rotation.y), 0, -Math.sin(actor!.group.rotation.y));
      const count = detail ? 6 : 4;
      for (let i = 0; i < count; i++) {
        const delay = Math.floor(i / 2) * .11, launch = 1.27 + delay, sign = i % 2 ? 1 : -1;
        const rise = clamp((age - launch) / .67);
        if (age < launch) continue;
        const offset = sign * (.22 + Math.floor(i / 2) * .19), sky = Math.max(volcano.left.y, volcano.right.y, this.target.y) + 2.8;
        this.a.copy(this.target).addScaledVector(this.side, offset); this.a.y = sky;
        if (age < AKAINU_MAGMA_BEATS.descent + delay * .32) {
          if (rise >= 1) continue;
          const source = i % 2 ? volcano.right : volcano.left;
          this.p.copy(source).lerp(this.a, rise);
          this.direction.copy(this.a).sub(source).normalize();
          this.q.setFromUnitVectors(FRONT, this.direction);
          this.fists?.add(this.p, this.q, .50, .50, .50, 1, Math.min(1, rise * 5) * (1 - clamp((rise - .82) / .18)), volcano.seed + i);
        } else {
          const start = AKAINU_MAGMA_BEATS.descent + delay * .32;
          const fall = clamp((age - start) / (AKAINU_MAGMA_BEATS.final - start));
          this.b.copy(this.target).addScaledVector(this.side, offset * .50);
          this.p.copy(this.a).lerp(this.b, fall * fall);
          this.direction.copy(this.b).sub(this.a).normalize(); this.q.setFromUnitVectors(FRONT, this.direction);
          const size = .54 + (i === 0 ? .12 : 0);
          this.fists?.add(this.p, this.q, size, size, size, 1, Math.min(1, fall * 7), volcano.seed + i);
        }
        this.b.copy(this.p).addScaledVector(this.direction, -.46);
        this.steam.add(this.b, this.q, .40, .58, 1, .6, .16, i);
      }
    }
    for (const g of this.gathers) {
      if (!g.actor) continue;
      const actor = fighters.get(g.actor), victim = fighters.get(g.target), s = actor?.state;
      if (!actor || !s?.alive || !victim?.state.alive && !g.final || s.action !== 'ultimate' || s.branch || (s.actionSeq ?? -1) !== g.seq || s.whiffedAt !== undefined) { g.actor = ''; continue; }
      const age = s.actionTime * s.actionDuration;
      if (age > ULT.duration) { g.actor = ''; continue; }
      if (st && !g.final && age < ULT.contacts[FINAL]) this.gather(st, actor, g, age);
    }
    for (const impact of this.impacts) {
      if (!impact.actor) continue;
      const age = time - impact.born, life = impact.grade === 2 ? .56 : .30;
      if (age >= life) { impact.actor = ''; continue; }
      if (age < 0) continue;
      const fade = 1 - age / life, count = impact.grade === 2 ? (detail ? 20 : 10) : impact.grade === 1 ? (detail ? 9 : 5) : 4;
      for (let i = 0; i < count; i++) {
        const angle = i * 2.39996 + impact.seed * .37, velocity = impact.grade === 2 ? 3.2 : 1.6;
        this.p.copy(impact.p).add(this.a.set(Math.cos(angle) * velocity * age, (1 + i % 3 * .4) * age - 4 * age * age, Math.sin(angle) * velocity * age));
        this.p.y = Math.max(impact.floor + .04, this.p.y);
        this.q.setFromAxisAngle(UP, angle + age * 7);
        const size = (impact.grade === 2 ? .09 : .045) * (1 + (i % 3) * .18) * fade;
        this.basalt.add(this.p, this.q, size, size * 1.5, size * .7, fade, fade, i);
      }
      if (impact.grade > 0) {
        this.p.copy(impact.p); this.p.y = impact.floor + .035;
        const r = .25 + age * (impact.grade === 2 ? 3.2 : 1.6);
        this.pressure.add(this.p, this.flat, r, r, r, fade * .75, fade * .55, impact.seed);
        this.p.copy(impact.p); this.p.y += age * .7;
        this.steam.add(this.p, this.q, .5 + age * 1.4, .4 + age * 1.1, 1, fade, fade * .25, impact.seed);
      }
    }
    for (const batch of this.batches) batch.end();
    st?.close();
  }
  private swing(st: MoveStage, fighter: Fighter, age: number) {
    const s = fighter.state, seed = (s.actionSeq ?? 0) * 6.7, yaw = fighter.group.rotation.y, big = s.awakened ? 1.15 : 1;
    const heading = this.heading.set(Math.sin(yaw), 0, Math.cos(yaw)), fist = this.strike;
    akainuMagmaContact(fighter, fist);
    if (s.action === 'light') {
      const k = Math.sin(clamp(s.actionTime) * Math.PI);
      st.tongue(this.p.copy(fist).setY(fist.y + .2), UP, .36, .45 + .6 * k, MAGMA, .3 + .7 * k, seed);
      st.glow(fist, .34, MAGMA.main, .6 * k); st.glow(fist, .14, MAGMA.core, .8 * k);
      st.light(this.p.copy(fist).addScaledVector(heading, .4), 2.2, MAGMA, .25 * k);
    } else if (s.action === 'heavy') {
      const contact = s.branch ? s.actionDuration * .5 : HEAVY.contacts[0];
      if (age < contact) {
        const k = clamp(age / contact);
        st.charge(fist, MAGMA, .28 * big, k, seed);
        this.a.copy(heading).multiplyScalar(-1).setY(.3).normalize();
        for (let i = 0; i < 3; i++) st.tongue(this.p.copy(fist).addScaledVector(heading, -.3 - i * .38 * k), this.a, .36 - i * .05, (.5 + .9 * k) * (1 - i * .18), MAGMA, k * (1 - i * .2), seed + i);
      } else if (age < contact + .24) {
        const flare = 1 - (age - contact) / .24;
        st.column(fist, this.a.copy(heading).setY(.1).normalize(), .32 * big, .5 + 1.3 * flare, MAGMA, flare, seed);
      }
    } else if (s.action === 'special' && !s.branch) {
      const release = SPECIAL.contacts[0];
      if (age < release) {
        const k = clamp(age / release);
        akainuMagmaSocket(fighter, 'Left', fist);
        st.charge(fist, MAGMA, .36 * big, k, seed);
        st.tongue(this.p.copy(fist).setY(fist.y + .25), UP, .4, .5 + .8 * k, MAGMA, k, seed);
        st.pool(this.p.copy(fighter.group.position), 1.5 + 1.3 * k, MAGMA, .6 * k, seed);
      }
    } else if (s.action === 'ultimate' && !s.branch && s.confirmedAt === undefined && age < ULT.contacts[0] + .1) st.charge(fist, MAGMA, .3, clamp(age / ULT.contacts[0]), seed);
  }
  private gather(st: MoveStage, actor: Fighter, g: Gather, age: number) {
    const k = clamp((age - ULT.contacts[0]) / (ULT.contacts[FINAL] - ULT.contacts[0])), seed = g.seq * 3.1, feet = this.ground.copy(actor.group.position).setY(g.floor);
    const u = clamp((age - 1.8) / .4), live = 1 - u * u * (3 - 2 * u);
    st.dim(.2 + .25 * k, g.actor, g.target);
    st.pool(feet, 2 + 1.8 * k, MAGMA, .3 + .6 * k, seed, .5 + .5 * live);
    if (live > .02) st.ring(feet, 2 + .3 * k, .5 + .7 * k, MAGMA, (.45 + .3 * k) * live, seed, 7);
    const up = clamp((age - AKAINU_MAGMA_BEATS.eruption + .25) / .15) * clamp((2.05 - age) / .3);
    if (up > .02) for (const side of ['Left', 'Right'] as const) { akainuMagmaSocket(actor, side, this.p); st.column(this.p, UP, .26, 3.5 + 2.5 * up, MAGMA, up * .85, seed + (side === 'Left' ? 1 : 2)); }
    if (live > .02) { akainuMagmaSocket(actor, 'Left', this.p); st.charge(this.p, MAGMA, .26 + .14 * k, Math.max(.4, k) * live, seed); }
    if (k > .85) st.speed(.5 * (k - .85) / .15, g.actor, g.target);
  }
  private forearm(fighter: Fighter, side: Side, time: number, strength: number, detail: boolean) {
    if (strength <= 0) return;
    akainuMagmaSocket(fighter, side, this.a);
    const fore = normalVolleyHands(fighter)
      ? fighter.joints?.get(side === 'Left' ? 'LeftForeArm' : 'RightForeArm')
      : rigSockets(fighter)[side === 'Left' ? 'LeftFore' : 'RightFore'];
    if (fore) fore.getWorldPosition(this.b); else this.b.copy(this.a).y -= .25;
    this.direction.copy(this.a).sub(this.b);
    if (this.direction.lengthSq() < 1e-8) this.direction.copy(UP); else this.direction.normalize();
    this.q.setFromUnitVectors(UP, this.direction);
    for (let i = 0; i < (detail ? 4 : 2); i++) {
      const angle = i * TAU / (detail ? 4 : 2), phase = (time * .65 + i * .29) % 1;
      this.p.set(Math.cos(angle) * .13, -.12 - (i % 2) * .08, Math.sin(angle) * .13).applyQuaternion(this.q).add(this.a);
      this.basalt.add(this.p, this.q, .045, .085, .035, strength * (.45 + .12 * Math.sin(time * 3 + i)), strength * .85, i);
      if (i < (detail ? 2 : 1)) {
        this.p.y += phase * .35;
        this.steam.add(this.p, this.q, .18 + phase * .17, .25 + phase * .27, 1, strength * .4, strength * .15 * Math.sin(phase * Math.PI), i);
      }
    }
  }
  private activation(fighter: Fighter, age: number, duration: number) {
    const beat = AKAINU_AWAKENING.beats, fall = age - beat.release;
    if (fall < 0 || fall > .42) return;
    const k = clamp(fall / .42), strength = (1 - k) * clamp((duration - age) / .1);
    for (const side of ['Left', 'Right'] as const) {
      akainuMagmaSocket(fighter, side, this.a);
      for (let i = 0; i < 4; i++) {
        const angle = i * TAU / 4 + (side === 'Left' ? .4 : -.4);
        this.p.copy(this.a).add(this.b.set(Math.cos(angle) * fall * .85, -fall * 1.3, Math.sin(angle) * fall * .85));
        this.p.y = Math.max(fighter.group.position.y + .04, this.p.y); this.q.setFromAxisAngle(UP, angle);
        this.basalt.add(this.p, this.q, .055 * strength, .10 * strength, .055 * strength, strength, strength, i);
      }
    }
    this.p.copy(fighter.group.position); this.p.y += .035;
    const r = .28 + k * .76;
    this.pressure.add(this.p, this.flat, r, r, r, strength * .8, strength * .48, 17);
  }
  reset() {
    for (const volcano of this.volcanoes) volcano.actor = '';
    for (const impact of this.impacts) impact.actor = '';
    for (const g of this.gathers) g.actor = '';
    for (const batch of this.batches) { batch.begin(0); batch.end(); }
    this.seen.fill(-1); this.seenAt.fill(-1); this.eventCursor = this.volcanoCursor = this.impactCursor = this.gatherCursor = 0;
    this.stage?.reset();
  }
  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    this.stage?.release(); this.stage = undefined;
    for (const batch of this.batches) batch.dispose();
    for (const source of this.sources) releaseSource(source);
    this.sources = []; this.batches = [];
  }
}
