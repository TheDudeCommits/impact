import * as THREE from 'three';
import type { CombatEvent } from '../../game/types';
import { AWAKENING_ENTRY } from '../../game/awakening';
import type { Fighter } from '../Fighter';
import { FLIGHTS } from '../CombatEffects';
import { VfxKit } from '../vfx/VfxKit';
import { noiseGLSL } from '../vfx/noise';
import { BoltBatch } from './BoltBatch';
import { GlowBatch, GLOW, STAR } from './GlowBatch';
import { LightVolumes } from './LightVolumes';
import { LightningPainter, Rng, type BoltStyle } from './Lightning';


const SHELL_VERTEX = `
#include <common>
#include <skinning_pars_vertex>
uniform float uTime; uniform float uStrength; uniform float uThick; uniform float uPush; uniform float uLick;
uniform vec3 uHead; uniform vec4 uRipple[4];
varying vec3 vNormalW; varying vec3 vWorld; varying float vCrown; varying float vSwell;
${noiseGLSL}
void main(){
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * objectNormal);
  // The crown burns a little brighter - the hair is where the Six Eyes'
  // light reads from behind - and the band swells toward whatever is closing
  // on him.
  float crown = 1.0 - smoothstep(.12, .45, distance(world.xyz, uHead));
  float swell = 0.0;
  for (int i = 0; i < 4; i++) swell = max(swell, uRipple[i].w * (1.0 - smoothstep(0.0, .62, distance(world.xyz, uRipple[i].xyz))));
  // Round 3c: cursed energy rising off him. The band is torn by noise that
  // scrolls up the body in world space and licked upward off every surface
  // that faces up - tallest over the shoulders and the crown - so it reads
  // as energy coming off the man, not as a second outline beside him (a
  // uniform 4.5 cm band did; a 2 cm one read as nothing from a fight's
  // distance: "an unchanged body inside a translucent bubble").
  float drift = snoise(vec3(world.xyz * 3.0 + vec3(0.0, -uTime * .5, uTime * .2)));
  float flow = snoise(vec3(world.x * 3.4, world.y * 2.3 - uTime * 2.6, world.z * 3.4));
  float lick = max(0.0, flow) * smoothstep(-.3, .85, n.y) * (1.0 + .3 * crown);
  world.xyz += n * (uThick * (1.0 + .35 * drift + 2.2 * swell) + lick * uLick) * uStrength;
  world.y += lick * uLick * .7 * uStrength;
  vNormalW = n; vWorld = world.xyz; vCrown = crown; vSwell = swell;
  // Pushed straight away from the lens: the same outline on screen, but
  // behind the body, so the shell shows only round the silhouette and never
  // over an arm held in front of the chest.
  vec4 mv = viewMatrix * world;
  mv.xyz += normalize(mv.xyz) * uPush;
  gl_Position = projectionMatrix * mv;
}`;

const SHELL_FRAGMENT = `
uniform vec3 uCore; uniform vec3 uRim; uniform float uTime; uniform float uStrength;
varying vec3 vNormalW; varying vec3 vWorld; varying float vCrown; varying float vSwell;
${noiseGLSL}
void main(){
  // Drawn by its back faces, so what shows is the band of shell standing out
  // round the silhouette; how square it is to the eye runs from 0 at its
  // outer edge to about 0.4 against the body. The light is white-blue against
  // him and fades to cyan across the band: a rim of light that hugs him, with
  // soft bands of brightness climbing it - clean where the aura is torn.
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float f = abs(dot(n, v)), near = smoothstep(0.0, .34, f);
  float wave = .5 + .5 * sin(vWorld.y * 7.0 - uTime * 2.6 + f * 6.0);
  // Wisps: a finer noise flowing up the band tears its outer edge into
  // tongues of cursed energy; against the body it stays whole.
  float wisp = snoise(vec3(vWorld.x * 3.6, vWorld.y * 2.4 - uTime * 3.0, vWorld.z * 3.6));
  float torn = smoothstep(-.3, .3, wisp * .7 + near * 1.2 - .5);
  // Cursed blue outside, cyan toward him, white-hot only against his body -
  // a flame of his energy, not a paper halo.
  float inner = smoothstep(.6, .97, near);
  vec3 col = mix(vec3(.04, .2, 1.05), vec3(.16, .52, 1.55), smoothstep(.1, .7, near));
  col = mix(col, vec3(.55, 1.05, 1.95), inner * (.55 + .45 * wave));
  float a = torn * (.2 + .42 * near) * (.72 + .28 * wave) * (.75 + .25 * vCrown + .35 * vSwell);
  // Strength runs over 1 while the eyes open: the band swells, but alpha
  // over 1 would turn straight alpha into a negative blend.
  a = min(.8, a * uStrength);
  if (a < .004) discard;
  gl_FragColor = vec4(col, a);
}`;

const ENERGY_FRAGMENT = `
uniform float uTime; uniform float uStrength;
varying vec3 vNormalW; varying vec3 vWorld; varying float vCrown; varying float vSwell;
void main(){
  vec3 n = normalize(vNormalW), v = normalize(cameraPosition - vWorld);
  float rim = pow(1.0 - abs(dot(n, v)), 2.2);
  float flow = pow(.5 + .5 * sin(vWorld.y * 8.0 - uTime * 3.2 + sin(vWorld.x * 5.0 + vWorld.z * 4.0) * 1.2), 3.0);
  vec3 col = mix(vec3(.1, .4, 1.4), vec3(.55, 1.0, 1.9), rim);
  float a = clamp(rim * .72 + flow * .12 * (1.0 - rim) + vCrown * .16 + vSwell * .3, 0.0, .8) * min(uStrength, 1.0);
  if (a < .004) discard;
  gl_FragColor = vec4(col * a, a);
}`;

const RIPPLE_VERTEX = `
attribute vec4 aC;attribute vec4 aN;attribute vec4 aP;
varying vec2 vQ;varying vec4 vP;varying float vS;
void main(){
  vec3 n=normalize(aN.xyz);
  vec3 up=abs(n.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.);
  vec3 u=normalize(cross(up,n)),w=cross(n,u);
  vec3 p=aC.xyz+(u*position.x+w*position.y)*aC.w;
  vQ=position.xy;vP=aP;vS=aN.w;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const RIPPLE_FRAGMENT = `
uniform vec3 uRim;
varying vec2 vQ;varying vec4 vP;varying float vS;
void main(){
  float r=length(vQ);if(r>=1.)discard;
  float a=atan(vQ.y,vQ.x),depth=-log2(max(r,.004)),l=depth-vP.x,k=fract(l),d=min(k,1.-k);
  float ring=(1.-smoothstep(.03,.14,d))*exp(-depth*.85)*smoothstep(.05,.18,r)*(1.-smoothstep(.62,1.,r));
  float arcs=smoothstep(-.2,.9,sin(a*2.+vP.x*1.7+floor(l)*2.3)+.35*sin(a*5.-vP.x*2.9));
  float held=exp(-r*r*160.);
  float b=vP.y,shock=b<0.?0.:exp(-pow((r-(.25+.75*b))/.05,2.))*(1.-b)*(.6+.4*arcs);
  vec3 hot=vec3(1.7,2.1,2.6);
  vec3 col=uRim*(ring*arcs*1.3+shock*1.3)+hot*(pow(ring*arcs,3.)*.4+held*.55+shock*.3);
  gl_FragColor=vec4(col*vS,1.);
}`;
const RIPPLE_STRIDE = 12;

const FIELD_VERTEX = `
varying vec3 vW;
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
const FIELD_FRAGMENT = `
uniform vec3 uCenter;uniform vec3 uRadii;uniform float uTime;uniform float uStrength;uniform float uFloor;
uniform vec3 uCore;uniform vec3 uEdge;
varying vec3 vW;
void main(){
  // The ellipsoid's own normal, not the scaled sphere's.
  vec3 n=normalize((vW-uCenter)/(uRadii*uRadii)),v=normalize(cameraPosition-vW);
  float c=abs(dot(n,v)),r=sqrt(max(0.,1.-c*c));
  vec3 q=(viewMatrix*vec4(vW-uCenter,0.)).xyz;
  float ang=atan(q.y,q.x),depth=-log2(max(r,.03)),s=depth-uTime*.45,k=fract(s),d=min(k,1.-k);
  float ring=(1.-smoothstep(.025,.11,d))*exp(-depth*1.35)*smoothstep(.34,.62,r);
  float arcs=smoothstep(-.15,.85,sin(ang*3.+floor(s)*2.4+uTime*.6)+.35*sin(ang*7.-uTime*1.4+floor(s)));
  // The edge: a line a couple of pixels wide at any range - where the eye
  // grazes the field - inside a soft glow that breathes round it.
  float line=1.-smoothstep(0.,2.2*fwidth(c)+1e-4,c),halo=pow(r,12.);
  float shimmer=.5+.5*sin(ang*5.+uTime*2.1+vW.y*6.);
  // Round 3c: the grazing line was what made the field read as a glass
  // bubble round an unchanged body; the Infinity is the rings closing on him
  // and the motes, so the line is a whisper now and the body carries the power.
  float edge=line*.18+halo*(.06+.05*shimmer);
  float lift=smoothstep(uFloor+.3,uFloor+.95,vW.y);
  vec3 col=uEdge*edge+uCore*ring*arcs*1.2;
  float a=(edge*.7+ring*arcs*.55+.006)*lift*uStrength;
  gl_FragColor=vec4(col*lift*uStrength,min(.9,a));
}`;

class RippleBatch {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Float32Array;
  private buffer: THREE.InstancedInterleavedBuffer;
  count = 0;
  private drawn = false;
  constructor(readonly capacity: number, name: string) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    this.data = new Float32Array(capacity * RIPPLE_STRIDE);
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, RIPPLE_STRIDE, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aC', new THREE.InterleavedBufferAttribute(this.buffer, 4, 0));
    geometry.setAttribute('aN', new THREE.InterleavedBufferAttribute(this.buffer, 4, 4));
    geometry.setAttribute('aP', new THREE.InterleavedBufferAttribute(this.buffer, 4, 8));
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      name: 'InfinityRipple', vertexShader: RIPPLE_VERTEX, fragmentShader: RIPPLE_FRAGMENT,
      uniforms: { uRim: { value: new THREE.Color(.3, .95, 2.1) } },
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true,
      blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    this.mesh.onAfterRender = () => { this.drawn = true; };
  }
  begin() { this.count = 0; }
  add(c: THREE.Vector3, n: THREE.Vector3, radius: number, strength: number, phase: number, burst = -1) {
    if (this.count >= this.capacity || strength <= .004) return;
    const o = this.count++ * RIPPLE_STRIDE, d = this.data;
    d[o] = c.x; d[o + 1] = c.y; d[o + 2] = c.z; d[o + 3] = radius;
    d[o + 4] = n.x; d[o + 5] = n.y; d[o + 6] = n.z; d[o + 7] = strength;
    d[o + 8] = phase; d[o + 9] = burst; d[o + 10] = 0; d[o + 11] = 0;
  }
  end() {
    this.mesh.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0 || !this.drawn;
    if (this.count > 0) { this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.count * RIPPLE_STRIDE); this.buffer.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

const EYE = new THREE.Color(.34, 1.25, 2.8), EYE_FLARE = new THREE.Color(.5, 1.3, 2.6), EYE_LIT = new THREE.Color(.28, .95, 1.6), EYE_HALO = new THREE.Color(.12, .5, 1.3);
const CRACKLE = new THREE.Color(.42, .92, 2.4), CRACKLE_DEEP = new THREE.Color(.12, .42, 1.7);
const STREAK = new THREE.Color(.42, .85, 1.7);
const LIGHT = new THREE.Color(.16, .42, .95);
const GHOST = 0x8fe6ff;
const CORE = 0x9fe8ff, RIM = 0x2a6fe0;
const REACH = .42;
const THICK = .035, LICK = .07, PUSH = .4;
const CRACKLE_JOINTS = ['Head', 'Spine2', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'Hips', 'LeftLeg', 'LeftFoot', 'RightLeg', 'RightFoot'] as const;
const EYE_SAMPLES = 10;
const FIELD_R = .7, FIELD_H = 1.08, FIELD_Y = 1.02, FIELD_NEAR = [1.9, 3] as const;
const FIELD_CORE = new THREE.Color(.36, .86, 1.7), FIELD_EDGE = new THREE.Color(.62, .96, 1.45);
const MOTES = 18, MOTE_LIFE = 1.9, MOTE_HALF = .42, MOTE_IN = .5;
const MOTE = new THREE.Color(.6, 1.1, 1.9);
const HAIR_GLOW = new THREE.Color(.26, .56, .86);
const ATTACKS = new Set(['light', 'heavy', 'special', 'ultimate']);

interface Part { source: THREE.SkinnedMesh; shell: THREE.SkinnedMesh; energy: THREE.SkinnedMesh }
interface Rig {
  fighter: Fighter;
  parts: Part[];
  material: THREE.ShaderMaterial;
  energyMaterial: THREE.ShaderMaterial;
  joints: (THREE.Object3D | undefined)[];
  eyes: (THREE.Object3D | undefined)[];
  head?: THREE.Object3D;
  glasses: THREE.Object3D[];
  irises: THREE.MeshToonMaterial[];
  hair: THREE.MeshToonMaterial[];
  field: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  motes: { dir: THREE.Vector3; born: number }[];
  center: THREE.Vector3;
  used: number;
  clock: number;
  shown: number;
  action: string; started: number;
  ghostAt: number;
  dashAt: number; dashFrom: THREE.Vector3;
  arrived: number;
  nextCrackle: number;
  eyeTrail: Float32Array; eyeTimes: Float32Array; eyeHead: number; eyeSize: number;
  ripple: THREE.Vector4[];
}
interface Crackle { rig: Rig | null; joint: number; offset: THREE.Vector3; dir: THREE.Vector3; born: number; life: number; seed: number; width: number }
interface Burst { rig: Rig | null; dir: THREE.Vector3; height: number; born: number; power: number }
const BURST_LIFE = .6;

function warmMesh(material: THREE.Material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, .01, 0, .01, 0, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
  mesh.name = 'infinity-shell-warmup'; mesh.frustumCulled = false; mesh.visible = false;
  return mesh;
}
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const materialsOf = (mesh: THREE.Mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.Material[];

export class GojoInfinity {
  private rigs = new Map<Fighter, Rig>();
  private bolts = new BoltBatch(720, 'gojo-infinity-crackle');
  private glows = new GlowBatch(24, 'gojo-six-eyes');
  private motesBatch = new GlowBatch(48, 'gojo-infinity-motes');
  private fieldGeometry = new THREE.SphereGeometry(1, 40, 28);
  private warmField?: THREE.Mesh;
  private ripples = new RippleBatch(24, 'gojo-infinity-ripple');
  private lights = new LightVolumes(4, 'gojo-infinity-light');
  private painter = new LightningPainter(this.bolts, 32);
  private rng = new Rng();
  private crackles: Crackle[] = Array.from({ length: 32 }, () => ({ rig: null, joint: 0, offset: new THREE.Vector3(), dir: new THREE.Vector3(), born: 0, life: 0, seed: 0, width: 0 }));
  private bursts: Burst[] = Array.from({ length: 12 }, () => ({ rig: null, dir: new THREE.Vector3(), height: 1, born: -1e9, power: 0 }));
  private burstCursor = 0; private crackleCursor = 0;
  private seen = new Set<number>();
  private kit: VfxKit;
  private warm?: THREE.SkinnedMesh;
  private warmEnergy?: THREE.SkinnedMesh;
  private frame = 0;
  private style: BoltStyle = { width: .01, color: CRACKLE, levels: 3, jag: .38, branches: 0, branchLength: .45, taper: .35, core: .3 };
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private headAt = new THREE.Vector3(); private camera = new THREE.Vector3(); private dir = new THREE.Vector3();
  private eyeL = new THREE.Vector3(); private eyeR = new THREE.Vector3(); private side = new THREE.Vector3();
  private eyePair = [this.eyeL, this.eyeR] as const;
  enabled = true;
  readonly stats = { ms: 0, parts: 0, bolts: 0, glows: 0, ripples: 0, crackles: 0 };
  constructor(private scene: THREE.Scene) {
    scene.add(this.lights.mesh, this.bolts.mesh, this.glows.mesh, this.ripples.mesh, this.motesBatch.mesh);
    this.kit = VfxKit.for(scene);
    if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __gojoInfinity?: GojoInfinity }).__gojoInfinity = this;
  }

  private material() {
    return new THREE.ShaderMaterial({
      name: 'InfinityShell', vertexShader: SHELL_VERTEX, fragmentShader: SHELL_FRAGMENT, side: THREE.BackSide,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uThick: { value: THICK }, uPush: { value: PUSH }, uLick: { value: LICK },
        uHead: { value: new THREE.Vector3(0, -100, 0) }, uRipple: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -100, 0, 0)) },
        uCore: { value: new THREE.Color(CORE) }, uRim: { value: new THREE.Color(RIM) } },
      transparent: true, depthWrite: false, toneMapped: false,
    });
  }
  private energyMaterial() {
    return new THREE.ShaderMaterial({
      name: 'InfinityEnergy', vertexShader: SHELL_VERTEX, fragmentShader: ENERGY_FRAGMENT, side: THREE.FrontSide,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uThick: { value: 0 }, uPush: { value: 0 }, uLick: { value: 0 },
        uHead: { value: new THREE.Vector3(0, -100, 0) }, uRipple: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -100, 0, 0)) } },
      transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  }
  private fieldMaterial() {
    return new THREE.ShaderMaterial({
      name: 'InfinityField', vertexShader: FIELD_VERTEX, fragmentShader: FIELD_FRAGMENT, side: THREE.FrontSide,
      uniforms: { uCenter: { value: new THREE.Vector3() }, uRadii: { value: new THREE.Vector3(FIELD_R, FIELD_H, FIELD_R) }, uTime: { value: 0 }, uStrength: { value: 0 }, uFloor: { value: 0 },
        uCore: { value: FIELD_CORE.clone() }, uEdge: { value: FIELD_EDGE.clone() } },
      transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
  }
  warmup() {
    if (this.warm) return;
    this.warm = warmMesh(this.material());
    this.scene.add(this.warm);
    this.warmEnergy = warmMesh(this.energyMaterial()); this.warmEnergy.name = 'infinity-energy-warmup';
    this.scene.add(this.warmEnergy);
    this.warmField = new THREE.Mesh(this.fieldGeometry, this.fieldMaterial());
    this.warmField.name = 'infinity-field-warmup'; this.warmField.visible = false; this.warmField.frustumCulled = false;
    this.scene.add(this.warmField);
  }
  hideWarmup() { if (this.warm) this.warm.visible = false; if (this.warmEnergy) this.warmEnergy.visible = false; }

  private rig(fighter: Fighter) {
    let rig = this.rigs.get(fighter);
    if (rig) return rig;
    const material = this.material(), energyMaterial = this.energyMaterial(), parts: Part[] = [], glasses: THREE.Object3D[] = [], irises: THREE.MeshToonMaterial[] = [], hair: THREE.MeshToonMaterial[] = [];
    const eyes: (THREE.Object3D | undefined)[] = [undefined, undefined];
    fighter.model.traverse(o => {
      if ((o as THREE.Bone).isBone) { const name = clean(o.name); if (/^liris\d*$/.test(name)) eyes[0] = o; else if (/^riris\d*$/.test(name)) eyes[1] = o; return; }
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isMesh || mesh.name.endsWith('-ink') || /outline|shadow/i.test(mesh.name)) return;
      const materials = materialsOf(mesh), names = materials.map(m => m.name).join(' ');
      if (/glass/i.test(names) && !mesh.name.startsWith('awaken-')) glasses.push(mesh);
      if (/eyesb/i.test(names)) for (const m of materials) if ((m as THREE.MeshToonMaterial).isMeshToonMaterial) irises.push(m as THREE.MeshToonMaterial);
      for (const m of materials) if (/hair/i.test(m.name) && (m as THREE.MeshToonMaterial).isMeshToonMaterial && !hair.includes(m as THREE.MeshToonMaterial)) hair.push(m as THREE.MeshToonMaterial);
      if (!mesh.isSkinnedMesh || /eye|lens|glass|facepart/i.test(names) || mesh.name.startsWith('awaken-')) return;
      if (materials.some(m => m.transparent && m.opacity < .9) || mesh.geometry.attributes.position.count < 600) return;
      const geometry = new THREE.BufferGeometry(), from = mesh.geometry;
      if (from.index) geometry.setIndex(from.index);
      for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) if (from.attributes[name]) geometry.setAttribute(name, from.attributes[name]);
      geometry.groups = from.groups.slice(); geometry.drawRange = { ...from.drawRange };
      const shell = new THREE.SkinnedMesh(geometry, material);
      shell.bindMode = mesh.bindMode; shell.bindMatrix.copy(mesh.bindMatrix); shell.bindMatrixInverse.copy(mesh.bindMatrixInverse); shell.skeleton = mesh.skeleton;
      shell.name = 'infinity-shell'; shell.frustumCulled = false; shell.visible = false; shell.renderOrder = 1;
      shell.castShadow = shell.receiveShadow = false;
      this.scene.add(shell);
      const energy = new THREE.SkinnedMesh(geometry, energyMaterial);
      energy.bindMode = mesh.bindMode; energy.bindMatrix.copy(mesh.bindMatrix); energy.bindMatrixInverse.copy(mesh.bindMatrixInverse); energy.skeleton = mesh.skeleton;
      energy.name = 'infinity-energy'; energy.frustumCulled = false; energy.visible = false; energy.renderOrder = 2;
      energy.castShadow = energy.receiveShadow = false;
      this.scene.add(energy);
      parts.push({ source: mesh, shell, energy });
    });
    const field = new THREE.Mesh(this.fieldGeometry, this.fieldMaterial());
    field.name = 'infinity-field'; field.visible = false; field.frustumCulled = false; field.renderOrder = 4;
    field.scale.set(FIELD_R, FIELD_H, FIELD_R);
    this.scene.add(field);
    rig = {
      fighter, parts, material, energyMaterial, glasses, irises, eyes, hair, field, center: new THREE.Vector3(),
      motes: Array.from({ length: MOTES }, (_, i) => ({ dir: new THREE.Vector3(), born: -1e9 - i })),
      joints: CRACKLE_JOINTS.map(name => fighter.joints?.get(name)), head: fighter.joints?.get('Head'),
      used: 0, clock: 0, shown: 0, action: fighter.state.action, started: fighter.state.actionStarted, ghostAt: -1,
      dashAt: -1e9, dashFrom: new THREE.Vector3(), arrived: -1e9, nextCrackle: 0,
      eyeTrail: new Float32Array(EYE_SAMPLES * 6), eyeTimes: new Float32Array(EYE_SAMPLES).fill(-1e9), eyeHead: 0, eyeSize: 0,
      ripple: material.uniforms.uRipple.value as THREE.Vector4[],
    };
    this.rigs.set(fighter, rig);
    return rig;
  }

  handle(events: readonly CombatEvent[], fighters: ReadonlyMap<string, Fighter>) {
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      if (event.kind === 'awaken' && event.fighter === 'gojo') {
        const f = fighters.get(event.actorId);
        if (!f) continue;
        const rig = this.rig(f);
        rig.arrived = event.serverTime;
        for (let i = 0; i < 3; i++) {
          const burst = this.bursts[this.burstCursor], a = f.state.yaw + i * Math.PI * 2 / 3;
          this.burstCursor = (this.burstCursor + 1) % this.bursts.length;
          burst.rig = rig; burst.born = event.serverTime + .45 + i * .06; burst.power = .75; burst.height = 1.15;
          burst.dir.set(Math.sin(a), 0, Math.cos(a));
        }
        continue;
      }
      if (event.kind !== 'hit') continue;
      const target = event.targetId ? fighters.get(event.targetId) : undefined;
      if (!target || target.state.fighter !== 'gojo' || !target.state.awakened) continue;
      const from = event.origin ?? fighters.get(event.actorId)?.group.position;
      if (!from) continue;
      const p = target.group.position, burst = this.bursts[this.burstCursor];
      this.burstCursor = (this.burstCursor + 1) % this.bursts.length;
      burst.rig = this.rig(target); burst.born = event.serverTime; burst.power = event.kind === 'hit' ? 1 : .7;
      burst.dir.set(from.x - p.x, 0, from.z - p.z); if (burst.dir.lengthSq() < 1e-6) burst.dir.set(Math.sin(target.state.yaw), 0, Math.cos(target.state.yaw)); burst.dir.normalize();
      burst.height = THREE.MathUtils.clamp(from.y - p.y, .7, 1.6);
    }
  }

  update(time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, density: number, camera?: THREE.Camera) {
    const started = performance.now();
    this.frame++;
    this.bolts.begin(); this.glows.begin(time); this.ripples.begin(); this.lights.begin(); this.motesBatch.begin(time);
    if (camera) camera.getWorldPosition(this.camera);
    let parts = 0;
    if (this.enabled) for (const fighter of fighters.values()) {
      if (fighter.state.fighter !== 'gojo') continue;
      const rig = this.rig(fighter);
      rig.used = this.frame;
      parts += this.draw(rig, time, Math.min(.05, Math.max(0, dt)), Math.max(.35, density), fighters, !!camera);
    }
    for (const rig of this.rigs.values()) {
      if (rig.used === this.frame) continue;
      for (const part of rig.parts) part.shell.visible = part.energy.visible = false;
      rig.field.visible = false;
      for (const g of rig.glasses) g.visible = true;
      if ((this.frame & 63) === 0) { let present = false; for (const f of fighters.values()) if (f === rig.fighter) { present = true; break; } if (!present) this.release(rig.fighter, rig); }
    }
    this.painter.sparksUpdate(dt, CRACKLE);
    const s = this.stats;
    s.parts = parts; s.bolts = this.bolts.count; s.glows = this.glows.count; s.ripples = this.ripples.count;
    this.bolts.end(); this.glows.end(); this.ripples.end(); this.lights.end(); this.motesBatch.end();
    s.ms = s.ms * .9 + (performance.now() - started) * .1;
  }

  private draw(rig: Rig, time: number, dt: number, density: number, fighters: ReadonlyMap<string, Fighter>, framed: boolean) {
    const f = rig.fighter, s = f.state, p = f.group.position;
    const awake = !!s.awakened && s.alive;
    const elapsed = s.actionTime * s.actionDuration;
    const entry = s.action === 'awaken' ? THREE.MathUtils.smoothstep(elapsed, AWAKENING_ENTRY * .15, AWAKENING_ENTRY * .7) : 1;
    const want = awake ? THREE.MathUtils.clamp((s.awakenedUntil ?? 0) - time, 0, 1) * entry : 0;
    rig.shown += (want - rig.shown) * (1 - Math.exp(-dt * 9));
    if (want === 0 && rig.shown < .02) rig.shown = 0;
    for (const g of rig.glasses) g.visible = !awake;
    if (rig.shown <= 0) { for (const part of rig.parts) part.shell.visible = part.energy.visible = false; rig.field.visible = false; rig.eyeSize = 0; rig.ghostAt = -1; this.track(rig, time); return 0; }
    if (!s.timeStopped) rig.clock += dt;
    const k = rig.shown, clock = rig.clock, tick = Math.floor(clock * 30);
    const arrival = time - rig.arrived, flare = arrival >= 0 && arrival < 1.3 ? Math.sin(Math.PI * THREE.MathUtils.clamp((arrival - .15) / 1.1, 0, 1)) : 0;
    if (rig.head) rig.head.getWorldPosition(this.headAt); else this.headAt.set(p.x, p.y + 1.75, p.z);

    let slot = 0;
    const guardUp = s.guarding || s.action === 'guard';
    for (const v of rig.ripple) v.w = 0;
    for (const other of fighters.values()) {
      if (guardUp) break;
      if (other === f || !other.state.alive || !ATTACKS.has(other.state.action)) continue;
      if (other.state.target !== s.id && Math.hypot(other.group.position.x - p.x, other.group.position.z - p.z) > 2.6) continue;
      const hand = this.nearer(other.handR, other.handL, p);
      const reach = Math.hypot(hand.x - p.x, hand.z - p.z);
      const power = THREE.MathUtils.smoothstep(1.35 - reach, 0, .85);
      if (power > .02 && slot < 2) this.hold(rig, hand.x - p.x, hand.z - p.z, THREE.MathUtils.clamp(hand.y - p.y, .5, 1.8), power, clock, slot++);
    }
    for (const flight of FLIGHTS.values()) {
      if (guardUp) break;
      if (!flight.released || slot >= 2) continue;
      const dx = flight.position.x - p.x, dz = flight.position.z - p.z, dist = Math.hypot(dx, dz);
      if (dist > 2.2 || (flight.heading.x * -dx + flight.heading.z * -dz) < .3 * dist) continue;
      this.hold(rig, dx, dz, THREE.MathUtils.clamp(flight.position.y - p.y, .5, 1.8), THREE.MathUtils.smoothstep(2.2 - dist, 0, 1.4), clock, slot++);
    }
    for (const burst of this.bursts) {
      if (burst.rig !== rig) continue;
      const age = time - burst.born;
      if (age > BURST_LIFE || age < -.1) continue;
      const fade = 1 - Math.max(0, age) / BURST_LIFE;
      this.c.copy(burst.dir).multiplyScalar(REACH).add(p); this.c.y = p.y + burst.height;
      this.ripples.add(this.c, burst.dir, .62, burst.power * fade * k, clock * 1.6, Math.max(0, age) / BURST_LIFE);
      if (slot < 4) rig.ripple[slot++].set(this.c.x, this.c.y, this.c.z, fade * k);
    }

    const u = rig.material.uniforms;
    u.uTime.value = clock; u.uStrength.value = k * (1 + .9 * flare);
    (u.uHead.value as THREE.Vector3).copy(this.headAt);
    const e = rig.energyMaterial.uniforms;
    const close = framed ? .35 + .65 * THREE.MathUtils.smoothstep(this.camera.distanceTo(this.headAt), 1.6, 3.2) : 1;
    e.uTime.value = clock; e.uStrength.value = k * (1 + .6 * flare) * close;
    (e.uHead.value as THREE.Vector3).copy(this.headAt);
    let drawn = 0;
    for (const part of rig.parts) {
      let visible = true;
      for (let o: THREE.Object3D | null = part.source; o && visible; o = o.parent) { visible = o.visible; if (o === f.group) break; }
      part.shell.visible = part.energy.visible = visible;
      if (!visible) continue;
      drawn++;
      if (part.source.bindMode !== THREE.AttachedBindMode) {
        part.shell.matrixAutoUpdate = part.energy.matrixAutoUpdate = false;
        part.shell.matrix.copy(part.source.matrixWorld); part.energy.matrix.copy(part.source.matrixWorld);
        part.shell.matrixWorldNeedsUpdate = part.energy.matrixWorldNeedsUpdate = true;
      }
    }

    this.eyes(rig, time, k, flare, framed);

    this.infinity(rig, clock, k, flare, framed);
    for (const m of rig.hair) m.emissive.setRGB(Math.max(m.emissive.r, HAIR_GLOW.r * k), Math.max(m.emissive.g, HAIR_GLOW.g * k), Math.max(m.emissive.b, HAIR_GLOW.b * k));

    const velocity = f.velocity as THREE.Vector3 | undefined, vx = velocity?.x ?? 0, vz = velocity?.z ?? 0, speed = Math.hypot(vx, vz);
    const busy = ATTACKS.has(s.action) || s.action === 'dash';
    if (clock >= rig.nextCrackle) {
      const rate = (2.6 + (speed > 2.5 ? 3.5 : 0) + (busy ? 3 : 0)) * density;
      this.rng.seed(tick * 7919 + this.crackleCursor * 131);
      rig.nextCrackle = clock + (.35 + this.rng.next() * 1.3) / rate;
      this.crackle(rig, clock, vx, vz, speed);
    }
    let live = 0;
    for (const c of this.crackles) {
      if (c.rig !== rig) continue;
      const age = clock - c.born;
      if (age > c.life || age < 0) { c.rig = null; continue; }
      const joint = rig.joints[c.joint];
      if (!joint) continue;
      live++;
      this.rng.seed(tick * 31 + c.seed);
      if (this.rng.next() < .22) continue;
      joint.getWorldPosition(this.a).add(c.offset);
      this.b.copy(this.a).add(c.dir);
      const st = this.style, fade = 1 - age / c.life;
      st.width = c.width; st.color = c.seed % 3 ? CRACKLE : CRACKLE_DEEP; st.intensity = (.55 + .45 * fade) * k; st.levels = 3; st.jag = .4; st.branches = c.seed % 4 === 0 ? 1 : 0; st.branchLength = .5; st.taper = .3; st.core = .32;
      this.painter.bolt(this.a, this.b, tick * 13 + c.seed, st);
    }
    this.stats.crackles = live;

    const began = s.action !== rig.action || Math.abs(s.actionStarted - rig.started) > 1e-4;
    if (began && s.alive) {
      if (s.action === 'dash') { rig.dashAt = time; rig.dashFrom.copy(p); }
      const move = s.action === 'light' && (s.chain ?? 0) < 3 || s.action === 'heavy';
      rig.ghostAt = move ? time + Math.min(.12, s.actionDuration * .18) : -1;
    }
    if (rig.ghostAt > 0 && time >= rig.ghostAt) { rig.ghostAt = -1; if (s.alive && ATTACKS.has(s.action)) this.kit.ghosts.spawn(f, GHOST, time, .18, .3 * k); }
    const dashAge = time - rig.dashAt;
    if (dashAge >= 0 && dashAge < .32) {
      const fade = (1 - dashAge / .32) * k;
      this.a.set(p.x - rig.dashFrom.x, 0, p.z - rig.dashFrom.z);
      const span = this.a.length();
      if (span > .3) {
        this.side.set(-this.a.z / span, 0, this.a.x / span);
        for (let i = 0; i < 6; i++) {
          const h = .3 + i * .27, lateral = ((i * 37) % 11 / 10 - .5) * .5, lag = .25 + ((i * 53) % 7) / 7 * .45;
          this.b.copy(rig.dashFrom).addScaledVector(this.side, lateral); this.b.y = p.y + h;
          this.c.copy(p).addScaledVector(this.side, lateral).addScaledVector(this.a, -lag / span); this.c.y = p.y + h;
          this.bolts.segment(this.b, this.c, .012 + .006 * (i % 2), STREAK, fade * (.55 + .45 * ((i * 29) % 5) / 5), .4);
        }
      }
      if (dashAge < .16) {
        const st = this.style; st.width = .012; st.color = CRACKLE; st.intensity = (1 - dashAge / .16) * k; st.levels = 3; st.jag = .42; st.branches = 1; st.taper = .3; st.core = .3;
        this.c.copy(rig.dashFrom); this.c.y += .9;
        this.painter.burst(this.c, .55, Math.max(3, Math.round(5 * density)), tick, 17, st, .1);
      }
    }
    this.track(rig, time);

    const chest = rig.joints[1];
    if (chest) chest.getWorldPosition(this.a); else this.a.set(p.x, p.y + 1.3, p.z);
    const radius = Math.min(1.05, this.a.y - p.y - .45);
    if (radius > .3) this.lights.add(this.a, radius, LIGHT, (.26 + .2 * flare) * k);
    return drawn;
  }

  private infinity(rig: Rig, clock: number, k: number, flare: number, framed: boolean) {
    const f = rig.fighter, p = f.group.position, hips = rig.joints[8], c = rig.center;
    if (hips) { hips.getWorldPosition(c); c.y = p.y + FIELD_Y; } else c.set(p.x, p.y + FIELD_Y, p.z);
    const near = framed ? THREE.MathUtils.smoothstep(this.camera.distanceTo(c), FIELD_NEAR[0], FIELD_NEAR[1]) : 1;
    const strength = k * near * (1 + .5 * flare);
    const field = rig.field, u = field.material.uniforms;
    field.visible = strength > .01;
    field.position.copy(c);
    (u.uCenter.value as THREE.Vector3).copy(c); u.uTime.value = clock; u.uStrength.value = Math.min(1.4, strength); u.uFloor.value = p.y;
    if (strength <= .01) return;
    for (let i = 0; i < rig.motes.length; i++) {
      const m = rig.motes[i];
      let age = clock - m.born;
      if (age > MOTE_LIFE || age < 0) {
        this.rng.seed(Math.floor(clock * 60) * 131 + i * 977);
        const z = this.rng.signed() * .8, phi = this.rng.next() * Math.PI * 2, sz = Math.sqrt(1 - z * z);
        m.dir.set(Math.cos(phi) * sz, z, Math.sin(phi) * sz);
        m.born = clock - this.rng.next() * .3; age = clock - m.born;
      }
      const fade = THREE.MathUtils.smoothstep(age, 0, .18) * (1 - THREE.MathUtils.smoothstep(age, MOTE_LIFE - .45, MOTE_LIFE)) * strength;
      if (fade < .01) continue;
      this.mote(c, m.dir, age, this.a); this.mote(c, m.dir, Math.max(0, age - .09), this.b);
      const low = THREE.MathUtils.smoothstep(this.a.y - p.y, .35, .8);
      if (low < .01) continue;
      this.motesBatch.add(this.a, .04, MOTE, .85 * fade * low, GLOW, .28);
      this.bolts.segment(this.b, this.a, .007, MOTE, .55 * fade * low, .35);
    }
  }
  private mote(c: THREE.Vector3, dir: THREE.Vector3, age: number, out: THREE.Vector3) {
    const r = MOTE_IN + (1 - MOTE_IN) * Math.pow(2, -age / MOTE_HALF);
    return out.set(c.x + dir.x * FIELD_R * r, c.y + dir.y * FIELD_H * r, c.z + dir.z * FIELD_R * r);
  }

  private nearer(a: THREE.Vector3, b: THREE.Vector3, p: THREE.Vector3) {
    return Math.hypot(a.x - p.x, a.z - p.z) <= Math.hypot(b.x - p.x, b.z - p.z) ? a : b;
  }

  private hold(rig: Rig, dx: number, dz: number, height: number, power: number, clock: number, slot: number) {
    const p = rig.fighter.group.position, len = Math.hypot(dx, dz) || 1;
    this.dir.set(dx / len, 0, dz / len);
    this.c.copy(this.dir).multiplyScalar(REACH).add(p); this.c.y = p.y + height;
    this.ripples.add(this.c, this.dir, .5, power * rig.shown, clock * 1.3);
    rig.ripple[slot].set(this.c.x, this.c.y, this.c.z, power * rig.shown);
  }

  private crackle(rig: Rig, clock: number, vx: number, vz: number, speed: number) {
    const c = this.crackles[this.crackleCursor];
    this.crackleCursor = (this.crackleCursor + 1) % this.crackles.length;
    const r = this.rng;
    let joint = Math.floor(r.next() * CRACKLE_JOINTS.length);
    for (let i = 0; i < CRACKLE_JOINTS.length && !rig.joints[joint]; i++) joint = (joint + 1) % CRACKLE_JOINTS.length;
    if (!rig.joints[joint]) return;
    const z = r.signed(), phi = r.next() * Math.PI * 2, sz = Math.sqrt(1 - z * z);
    c.offset.set(Math.cos(phi) * sz, z * .6, Math.sin(phi) * sz).multiplyScalar(.07 + r.next() * .07);
    const fast = speed > 2.5 ? Math.min(1, speed / 8) : 0, len = .12 + r.next() * .16 + fast * .22;
    c.dir.set(r.signed(), r.signed() * .6 + .25, r.signed()).normalize();
    if (fast > 0) c.dir.addScaledVector(this.d.set(-vx / speed, 0, -vz / speed), 1.4 * fast).normalize();
    c.dir.multiplyScalar(len);
    c.rig = rig; c.joint = joint; c.born = clock; c.life = .1 + r.next() * .14; c.seed = Math.floor(r.next() * 9973); c.width = .006 + r.next() * .005;
  }

  private eyes(rig: Rig, time: number, k: number, flare: number, framed: boolean) {
    const left = rig.eyes[0], right = rig.eyes[1];
    if (!left || !right) return;
    left.getWorldPosition(this.eyeL); right.getWorldPosition(this.eyeR);
    this.a.addVectors(this.eyeL, this.eyeR).multiplyScalar(.5);
    this.dir.copy(this.a).sub(this.headAt); this.dir.y = 0;
    const along = this.dir.length();
    if (along > 1e-4) this.dir.divideScalar(along); else this.dir.set(Math.sin(rig.fighter.state.yaw), 0, Math.cos(rig.fighter.state.yaw));
    this.b.copy(this.camera).sub(this.a).normalize();
    const facing = framed ? THREE.MathUtils.smoothstep(this.dir.dot(this.b), -.15, .45) : 1;
    for (const m of rig.irises) m.emissive.setRGB(EYE_LIT.r * k, EYE_LIT.g * k, EYE_LIT.b * k);
    this.side.subVectors(this.eyeR, this.eyeL);
    const gap = this.side.length();
    if (gap > 1e-4) this.side.divideScalar(gap);
    const glow = k * facing;
    for (const eye of this.eyePair) {
      this.c.copy(eye).addScaledVector(this.dir, .018);
      this.glows.add(this.c, .065 + .03 * flare, EYE, glow, GLOW, .3);
      this.glows.add(this.c, .2, EYE_HALO, .72 * glow, GLOW, .05);
      if (flare > .02) this.glows.add(this.c, .09 + .28 * flare, EYE_FLARE, flare * facing, STAR, .16, 7);
      this.d.copy(this.c).addScaledVector(this.side, -.026); this.b.copy(this.c).addScaledVector(this.side, .026);
      this.bolts.segment(this.d, this.b, .0045, EYE, .8 * glow, .5);
    }
    if (gap > 1e-4) {
      this.a.addVectors(this.eyeL, this.eyeR).multiplyScalar(.5).addScaledVector(this.dir, .03);
      this.b.copy(this.a).addScaledVector(this.side, -.19); this.c.copy(this.a).addScaledVector(this.side, .19);
      this.bolts.segment(this.b, this.c, .007, EYE, .85 * glow, .45);
    }
    const t = rig.eyeTrail, n = rig.eyeSize;
    for (let i = 0; i + 1 < n; i++) {
      const at = (rig.eyeHead - i + EYE_SAMPLES) % EYE_SAMPLES, prev = (at - 1 + EYE_SAMPLES) % EYE_SAMPLES, age = time - rig.eyeTimes[prev];
      if (age > .16 || age < 0) break;
      const fade = (1 - age / .16) * k;
      for (let e = 0; e < 2; e++) {
        const o = at * 6 + e * 3, q = prev * 6 + e * 3;
        this.c.set(t[o], t[o + 1], t[o + 2]); this.d.set(t[q], t[q + 1], t[q + 2]);
        if (this.c.distanceToSquared(this.d) < 2.5e-3) continue;
        this.bolts.segment(this.c, this.d, .011 * fade + .003, EYE, fade * .9, .35);
      }
    }
  }

  private track(rig: Rig, time: number) {
    const s = rig.fighter.state;
    rig.action = s.action; rig.started = s.actionStarted;
    if (rig.shown <= 0 || !rig.eyes[0] || !rig.eyes[1]) return;
    const last = rig.eyeTimes[rig.eyeHead];
    if (time - last < .014 && rig.eyeSize > 0) return;
    rig.eyeHead = (rig.eyeHead + 1) % EYE_SAMPLES; rig.eyeSize = Math.min(EYE_SAMPLES, rig.eyeSize + 1);
    const o = rig.eyeHead * 6, t = rig.eyeTrail;
    t[o] = this.eyeL.x; t[o + 1] = this.eyeL.y; t[o + 2] = this.eyeL.z; t[o + 3] = this.eyeR.x; t[o + 4] = this.eyeR.y; t[o + 5] = this.eyeR.z;
    rig.eyeTimes[rig.eyeHead] = time;
  }

  private release(fighter: Fighter, rig: Rig) {
    for (const part of rig.parts) { part.shell.removeFromParent(); part.energy.removeFromParent(); part.shell.geometry.index = null; part.shell.geometry.attributes = {}; part.shell.geometry.dispose(); }
    for (const g of rig.glasses) g.visible = true;
    rig.field.removeFromParent(); rig.field.material.dispose();
    rig.material.dispose(); rig.energyMaterial.dispose(); this.rigs.delete(fighter);
    for (const c of this.crackles) if (c.rig === rig) c.rig = null;
    for (const b of this.bursts) if (b.rig === rig) b.rig = null;
  }

  get shellCount() { let n = 0; for (const rig of this.rigs.values()) for (const part of rig.parts) if (part.shell.visible) n++; return n; }

  reset() {
    for (const rig of this.rigs.values()) { for (const part of rig.parts) part.shell.visible = part.energy.visible = false; rig.field.visible = false; for (const m of rig.motes) m.born = -1e9; for (const g of rig.glasses) g.visible = true; rig.shown = 0; rig.arrived = -1e9; rig.dashAt = -1e9; rig.eyeSize = 0; }
    for (const c of this.crackles) c.rig = null;
    for (const b of this.bursts) b.rig = null;
    this.seen.clear(); this.painter.clearSparks();
    this.bolts.begin(); this.glows.begin(0); this.ripples.begin(); this.lights.begin(); this.motesBatch.begin(0);
    this.bolts.end(); this.glows.end(); this.ripples.end(); this.lights.end(); this.motesBatch.end();
  }

  dispose() {
    this.reset();
    for (const rig of [...this.rigs.values()]) this.release(rig.fighter, rig);
    if (this.warm) { this.warm.removeFromParent(); (this.warm.material as THREE.Material).dispose(); this.warm.geometry.dispose(); this.warm = undefined; }
    if (this.warmEnergy) { this.warmEnergy.removeFromParent(); (this.warmEnergy.material as THREE.Material).dispose(); this.warmEnergy.geometry.dispose(); this.warmEnergy = undefined; }
    if (this.warmField) { this.warmField.removeFromParent(); (this.warmField.material as THREE.Material).dispose(); this.warmField = undefined; }
    this.fieldGeometry.dispose();
    this.bolts.dispose(); this.glows.dispose(); this.ripples.dispose(); this.lights.dispose(); this.motesBatch.dispose();
    this.kit.release();
  }
}
