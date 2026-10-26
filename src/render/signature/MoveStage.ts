import * as THREE from 'three';
import { GlowBatch, GLOW, RING, STAR } from './GlowBatch';
import { BoltBatch } from './BoltBatch';
import { LightVolumes } from './LightVolumes';
import { BLACK, FIRE, flamePalette, flameSpriteGeometry, flameSpriteMaterial } from './FlameSprites';
import { EnergySpheres, type SphereStyle } from './EnergySphere';
import { SignaturePoolUpload } from './SignaturePoolUpload';
import { SIGNATURE, involvesLocal } from './context';
import { floorProbe, floorUnder } from './blowFloor';
import { noiseTexture } from '../vfx/noiseTexture';
import { SPRITE, ORIENT } from '../vfx/SparkField';
import type { VfxKit } from '../vfx/VfxKit';
import type { Element } from '../vfx/palette';


export interface StageLook {
  readonly core: THREE.Color;
  readonly main: THREE.Color;
  readonly rim: THREE.Color;
  readonly light: THREE.Color;
  readonly element: Element;
  readonly shell: number; readonly edge: number;
  readonly flame: number;
  readonly dark: boolean;
  readonly heart: number;
  readonly sphere?: SphereStyle;
}
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
export const STAGE = {
  fire: { core: lin(3.4, 2.3, .9), main: lin(2.05, .74, .12), rim: lin(.95, .17, .03), light: lin(1.35, .6, .18), element: { spike: 0xfff1b0, rim: 0xff4a1e, light: 0xff7a2a, ink: 0x1c0a04 }, shell: 0xff8a1e, edge: 0x8a1a06, flame: FIRE, dark: false, heart: 0 },
  quake: { core: lin(2.7, 2.95, 3.2), main: lin(.75, 1.35, 2.2), rim: lin(.2, .45, 1), light: lin(.8, .98, 1.25), element: { spike: 0xffffff, rim: 0x9fd0ff, light: 0xe4f2ff, ink: 0x0a1220 }, shell: 0xbfe6ff, edge: 0x2a5aa8, flame: -1, dark: false, heart: .5 },
  dark: { core: lin(1.9, 1.05, 2.7), main: lin(.8, .24, 1.55), rim: lin(.2, .05, .42), light: lin(.55, .22, .95), element: { spike: 0xd9b8ff, rim: 0x7a34c8, light: 0x9a5cff, ink: 0x06020c }, shell: 0x5a1e9a, edge: 0x0a0414, flame: BLACK, dark: true, heart: 0,
    sphere: { body: lin(.014, .006, .03), core: lin(.3, .1, .6), rimA: lin(1.7, .55, 2.5), rimB: lin(.75, .25, 1.9), spin: 1.5 } },
  green: { core: lin(2.5, 3.1, 1.5), main: lin(.6, 1.75, .24), rim: lin(.1, .45, .06), light: lin(.62, 1.12, .36), element: { spike: 0xeaffc5, rim: 0x83b442, light: 0xb8e86a, ink: 0x0c1a06 }, shell: 0xa8e04a, edge: 0x1e4a10, flame: -1, dark: false, heart: 0 },
} satisfies Record<string, StageLook>;

export function stageLook(core: number, main: number, rim: number, options: { flame?: number; dark?: boolean; heart?: number; sphere?: SphereStyle } = {}): StageLook {
  const c = new THREE.Color(core), m = new THREE.Color(main), r = new THREE.Color(rim);
  const body = m.clone().multiplyScalar(2 / Math.max(.25, m.r, m.g, m.b)).addScalar(.06);
  const heart = c.clone().multiplyScalar(3.2 / Math.max(.4, c.r, c.g, c.b));
  const light = m.clone().multiplyScalar(1.2 / Math.max(.25, m.r, m.g, m.b)).addScalar(.12);
  return { core: heart, main: body, rim: r, light, element: { spike: core, rim: main, light: main, ink: rim }, shell: main, edge: rim, flame: options.flame ?? -1, dark: !!options.dark, heart: options.heart ?? 0, sphere: options.sphere };
}

const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _f = new THREE.Vector3();
const _color = new THREE.Color();
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const clamp01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
const easeOut = (v: number) => 1 - (1 - clamp01(v)) * (1 - clamp01(v)) * (1 - clamp01(v));

export const POOL = 0, BURN = 1, WAVE = 2, SHEEN = 3;
const DISC_STRIDE = 12;
const discVertex = `
attribute vec4 aP;attribute vec4 aC;attribute vec4 aS;
varying vec2 vQ;varying vec4 vC;varying vec4 vS;
void main(){vQ=position.xy;vC=aC;vS=aS;gl_Position=projectionMatrix*viewMatrix*vec4(aP.xyz+vec3(position.x,0.,position.y)*aP.w,1.);}`;
const discFragment = `
uniform float uTime;uniform sampler2D uNoise;
varying vec2 vQ;varying vec4 vC;varying vec4 vS;
void main(){
  float r=length(vQ);if(r>=1.)discard;
  int kind=int(vS.x+.5);float seed=vS.y,k=vS.z,spin=vS.w;
  float ang=atan(vQ.y,vQ.x);
  vec3 col=vec3(0.);float alpha=0.;
  if(kind==0){
    // Darkness on the floor: a ragged black pool out to k of its radius, turning; a lit rim crawling at its edge.
    float n=texture2D(uNoise,vec2(ang*.318+seed,r*.5-uTime*.11)).g;
    float m=texture2D(uNoise,vQ*.6+vec2(seed,uTime*.04)).b;
    float edge=k*(.84+.24*n);
    float body=1.-smoothstep(edge-.09,edge,r);
    float arms=smoothstep(.5,.95,.5+.5*sin(ang*3.+r*10.*spin-uTime*2.6*spin+m*3.));
    float rim=exp(-pow((r-edge)/.04,2.));
    col=vC.rgb*(rim*1.5+arms*body*.2*(1.-r));
    alpha=body*vC.a*(.94-.18*arms);
  }else if(kind==1){
    // A burn: glowing veins in a charred patch, hottest in the middle, cooling as k falls.
    float n=texture2D(uNoise,vQ*.9+seed).g,m=texture2D(uNoise,vQ*2.3-seed).b;
    float vein=pow(1.-abs(2.*n-1.),5.)+.6*pow(1.-abs(2.*m-1.),7.);
    float mask=1.-smoothstep(.5,1.,r+(n-.5)*.35);
    col=vC.rgb*(vein*1.7+.3*(1.-r))*k*mask;
    alpha=mask*.55*vC.a*min(1.,k*2.+.25);
  }else if(kind==2){
    // A shock ring racing out: thin and bright, a soft wake inside it.
    float band=exp(-pow((r-k)/.028,2.))+.22*(1.-smoothstep(k-.35,k,r))*step(r,k);
    col=vC.rgb*band*vC.a*(1.-k*.7);
  }else{
    col=vC.rgb*(1.-r)*(1.-r)*vC.a;
  }
  gl_FragColor=vec4(col,alpha);
}`;
class DiscBatch {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Float32Array; private buffer: THREE.InstancedInterleavedBuffer; private drawn = false; count = 0;
  constructor(readonly capacity: number, name: string) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3)); geometry.setIndex([0, 2, 1, 2, 3, 1]);
    this.data = new Float32Array(capacity * DISC_STRIDE); this.buffer = new THREE.InstancedInterleavedBuffer(this.data, DISC_STRIDE, 1); this.buffer.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aP', new THREE.InterleavedBufferAttribute(this.buffer, 4, 0)); geometry.setAttribute('aC', new THREE.InterleavedBufferAttribute(this.buffer, 4, 4)); geometry.setAttribute('aS', new THREE.InterleavedBufferAttribute(this.buffer, 4, 8));
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({ name: 'StageDisc', vertexShader: discVertex, fragmentShader: discFragment, uniforms: { uTime: { value: 0 }, uNoise: { value: noiseTexture() } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.mesh.onAfterRender = () => { this.drawn = true; };
  }
  begin(time: number) { this.count = 0; this.mesh.material.uniforms.uTime.value = time; }
  add(x: number, y: number, z: number, radius: number, color: THREE.Color, strength: number, kind: number, k: number, seed = 0, spin = 1, gain = 1) {
    if (this.count >= this.capacity || radius <= .01 || strength <= .004) return;
    const o = this.count++ * DISC_STRIDE, d = this.data;
    d[o] = x; d[o + 1] = y + .02; d[o + 2] = z; d[o + 3] = radius; d[o + 4] = color.r * gain; d[o + 5] = color.g * gain; d[o + 6] = color.b * gain; d[o + 7] = strength;
    d[o + 8] = kind; d[o + 9] = seed % 17; d[o + 10] = k; d[o + 11] = spin;
  }
  end() {
    this.mesh.geometry.instanceCount = this.count; this.mesh.visible = this.count > 0 || !this.drawn;
    if (this.count > 0) { this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.count * DISC_STRIDE); this.buffer.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

const shellVertex = `
attribute vec4 shellTint;varying vec4 vTint;varying vec3 vN;varying vec3 vV;varying vec3 vP;
void main(){vTint=shellTint;vP=position;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const shellFragment = `
uniform float uTime;varying vec4 vTint;varying vec3 vN;varying vec3 vV;varying vec3 vP;
void main(){
  float facing=abs(dot(normalize(vN),normalize(vV)));
  float rim=pow(1.-facing,2.4);
  float rings=.5+.5*sin(vP.y*15.-uTime*24.);
  float tremor=.5+.5*sin(atan(vP.z,vP.x)*9.+uTime*33.);
  vec3 col=vTint.rgb*(rim*(1.25+.75*rings)+.05+.12*rim*tremor)+vec3(2.3)*pow(rim,5.);
  gl_FragColor=vec4(col*vTint.a,0.);
}`;

type Kit = Pick<VfxKit, 'budget'> & Partial<VfxKit>;
const BURST = 0, SCAR = 1, SHOCK = 2, SHATTER = 3, ERUPT = 4, DOME = 5;
interface Shot { kind: number; born: number; life: number; size: number; length: number; seed: number; look: StageLook; at: THREE.Vector3; dir: THREE.Vector3; floor: number; live: boolean }
export interface BurstOptions {
  dir?: THREE.Vector3;
  floor?: number;
  clean?: boolean;
}

const FLAMES = 640, GLOWS = 512, BOLTS = 768, LIGHTS = 20, DISCS = 24, SHELLS = 12, SPHERES = 6, SHOTS = 40;
export const STAGE_LIMITS = Object.freeze({ flames: FLAMES, glows: GLOWS, bolts: BOLTS, lights: LIGHTS, discs: DISCS, shells: SHELLS, spheres: SPHERES, shots: SHOTS });
const stages = new WeakMap<THREE.Scene, MoveStage>();

export class MoveStage {
  static for(scene: THREE.Scene, kit: Kit): MoveStage {
    let stage = stages.get(scene);
    if (!stage) { stage = new MoveStage(scene, kit); stages.set(scene, stage); }
    stage.refs++;
    return stage;
  }
  private refs = 0;
  private readonly flames: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly flameUpload: SignaturePoolUpload;
  private flameCount = 0;
  private readonly glows = new GlowBatch(GLOWS, 'stage-glow', true);
  private readonly bolts = new BoltBatch(BOLTS, 'stage-bolts');
  private readonly volumes = new LightVolumes(LIGHTS, 'stage-light');
  private readonly discs = new DiscBatch(DISCS, 'stage-discs');
  private readonly shells: THREE.InstancedMesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly shellTint: THREE.InstancedBufferAttribute;
  private readonly shellUpload: SignaturePoolUpload;
  private shellCount = 0;
  private readonly spheres: EnergySpheres;
  private readonly shots: Shot[] = Array.from({ length: SHOTS }, () => ({ kind: 0, born: 0, life: 0, size: 0, length: 0, seed: 0, look: STAGE.fire, at: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0), floor: 0, live: false }));
  private shotCursor = 0;
  private readonly object = new THREE.Object3D();
  private readonly full?: VfxKit;
  time = -1; tick = false;
  private opened = false; private disposed = false;

  private constructor(private readonly scene: THREE.Scene, private readonly kit: Kit) {
    this.full = (kit as VfxKit).sparks && (kit as VfxKit).dust ? kit as VfxKit : undefined;
    this.flames = new THREE.InstancedMesh(flameSpriteGeometry(), flameSpriteMaterial(), FLAMES);
    this.flames.name = 'stage-flames'; this.flames.frustumCulled = false; this.flames.renderOrder = 3; this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flames.setColorAt(0, _color.setRGB(0, 0, 0)); this.flames.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.object.scale.setScalar(0); this.object.updateMatrix(); this.flames.setMatrixAt(0, this.object.matrix); this.flames.count = 1;
    this.flameUpload = new SignaturePoolUpload(this.flames, this.flames.instanceColor!);
    const sphere = new THREE.SphereGeometry(1, 28, 18);
    this.shellTint = new THREE.InstancedBufferAttribute(new Float32Array(SHELLS * 4), 4).setUsage(THREE.DynamicDrawUsage); sphere.setAttribute('shellTint', this.shellTint);
    this.shells = new THREE.InstancedMesh(sphere, new THREE.ShaderMaterial({ name: 'StageShell', vertexShader: shellVertex, fragmentShader: shellFragment, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }), SHELLS);
    this.shells.name = 'stage-shells'; this.shells.frustumCulled = false; this.shells.renderOrder = 4; this.shells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shells.setMatrixAt(0, this.object.matrix); this.shells.count = 1;
    this.shellUpload = new SignaturePoolUpload(this.shells, this.shellTint);
    this.spheres = new EnergySpheres(scene, SPHERES, 'stage-sphere');
    scene.add(this.flames, this.glows.mesh, this.bolts.mesh, this.volumes.mesh, this.discs.mesh, this.shells);
  }

  n(count: number, floor = 1) { return Math.max(floor, Math.round(count * this.kit.budget)); }
  private get detail() { return this.kit.budget >= .65; }

  open(time: number): this {
    if (this.disposed) return this;
    if (time !== this.time || !this.opened) {
      this.tick = Math.floor(time * 30) !== Math.floor(this.time * 30);
      this.time = time; this.opened = true;
      this.flameCount = 0; this.shellCount = 0;
      this.flames.material.uniforms.uTime.value = time; this.shells.material.uniforms.uTime.value = time;
      this.glows.begin(time); this.bolts.begin(); this.volumes.begin(); this.discs.begin(time); this.spheres.begin();
      for (const shot of this.shots) if (shot.live) this.drawShot(shot, time);
    }
    return this;
  }
  close() {
    if (this.disposed) return;
    this.flameUpload.end(this.flameCount); this.shellUpload.end(this.shellCount);
    this.glows.end(); this.bolts.end(); this.volumes.end(); this.discs.end(); this.spheres.end();
  }


  glow(at: THREE.Vector3, radius: number, color: THREE.Color, intensity: number, type = GLOW, core = .0001, seed = 0, p1 = 0) { this.glows.add(at, radius, color, intensity, type, core, seed, p1); }
  streak(a: THREE.Vector3, b: THREE.Vector3, width: number, color: THREE.Color, intensity = 1, core = 0) { this.bolts.segment(a, b, width, color, intensity, core); }
  tongue(at: THREE.Vector3, dir: THREE.Vector3, width: number, length: number, look: StageLook, heat = 1, seed = 0) {
    if (look.flame < 0 || this.flameCount >= FLAMES || width <= .01 || length <= .01 || heat <= .02) return;
    const o = this.object;
    o.position.copy(at); o.quaternion.setFromUnitVectors(UP, dir); o.scale.set(width * 7, length * 2, width * 7); o.updateMatrix();
    this.flames.setMatrixAt(this.flameCount, o.matrix);
    this.flames.setColorAt(this.flameCount++, _color.setRGB(clamp01(heat), hash(seed * 1.7 + 3.1), flamePalette(look.flame)));
  }
  light(at: THREE.Vector3, radius: number, look: StageLook, intensity: number) { this.volumes.add(at, radius, look.light, intensity); }
  disc(at: THREE.Vector3, radius: number, color: THREE.Color, strength: number, kind: number, k: number, seed = 0, spin = 1, gain = 1) { this.discs.add(at.x, floorUnder(at.x, at.y, at.z), at.z, radius, color, strength, kind, k, seed, spin, gain); }
  private laid(at: THREE.Vector3, normal: THREE.Vector3) {
    if (normal.y < .9) return at;
    const floor = floorProbe(at.x, at.y, at.z);
    return floor === undefined ? at : _f.set(at.x, floor + .05, at.z);
  }
  ball(at: THREE.Vector3, radius: number, look: StageLook, seed = 0, fade = 1) { if (look.sphere) this.spheres.add(at, radius, look.sphere, this.time, seed, fade); }


  charge(at: THREE.Vector3, look: StageLook, size: number, k: number, seed = 0) {
    k = clamp01(k); if (k <= .01) return;
    const t = this.time, grow = .35 + .65 * k;
    if (look.dark) {
      this.ball(at, size * grow * .9, look, seed);
      this.glow(at, size * 2 * grow, look.main, .45 * k);
      this.glow(at, size * 1.25 * grow, look.core, .55 * k, RING, .05, Math.floor(t * 30), .82);
    } else {
      this.glow(at, size * 2.2 * grow, look.main, .3 + .4 * k);
      this.glow(at, size * .9 * grow, look.core, .3 + .7 * k);
      this.glow(at, size * 1.9, look.core, .26 * k, RING, .035, 0, 1 - ((t * 1.7 + seed * .37) % 1) * .8);
    }
    for (let i = 0, n = this.n(look.dark ? 7 : 9, 4); i < n; i++) {
      const phase = (t * (1.5 + .5 * hash(seed + i * 5.3)) + i * .618) % 1, az = i * 2.399963 + seed, lift = -.25 + 1.1 * hash(seed * 3.1 + i);
      _d.set(Math.cos(az), lift, Math.sin(az)).normalize();
      const far = size * (5 + 5 * hash(i * 2.7 + seed)), r = size * .6 + (far - size * .6) * (1 - phase) * (1 - phase), len = Math.min(r - size * .4, size * (1 + 2.2 * (1 - phase)));
      if (len <= .02) continue;
      _a.copy(at).addScaledVector(_d, r); _b.copy(at).addScaledVector(_d, r - len);
      this.streak(_a, _b, size * (.07 + .09 * phase), look.dark ? look.rim : look.main, Math.sin(Math.PI * phase) * k * (look.dark ? 1.6 : 1.1));
    }
    this.light(_a.copy(at).setY(at.y + .35), 1.2 + 1.6 * k + size * 5, look, look.dark ? .2 * k : .12 + .36 * k);
  }

  orb(at: THREE.Vector3, heading: THREE.Vector3, radius: number, look: StageLook, seed = 0) {
    const t = this.time, pulse = 1 + .06 * Math.sin(t * 41 + seed);
    if (look.dark) {
      this.ball(at, radius * pulse, look, seed);
      this.glow(at, radius * 2.1, look.main, .55);
      this.glow(at, radius * 1.42, look.core, .8, RING, .045, Math.floor(t * 30), .8);
      for (let i = 1, n = this.n(5, 3); i <= n; i++) { _a.copy(at).addScaledVector(heading, -radius * (.5 + i * .55)); _a.y += Math.sin(t * 9 + i * 1.7 + seed) * radius * .18; this.tongue(_a, _d.copy(heading).multiplyScalar(-1).setY(.55).normalize(), radius * (1.5 - i * .16), radius * (2.3 - i * .2), look, 1 - i * .13, seed + i); }
    } else {
      this.glow(at, radius * 1.9 * pulse, look.main, .7);
      this.glow(at, radius * .8 * pulse, look.core, 1);
      this.glow(at, radius * 1.6, look.core, .4, STAR, .2, Math.floor(t * 24));
      for (let i = 1; i <= 4; i++) { _a.copy(at).addScaledVector(heading, -radius * i * .7); this.glow(_a, radius * (1.5 - i * .25), look.main, .34 - i * .07); }
      for (let i = 0, n = this.n(6, 3); i < n; i++) {
        _a.copy(at).addScaledVector(heading, -radius * (.3 + i * .5)); _a.y += Math.sin(t * 13 + i * 2.1 + seed) * radius * .22;
        this.tongue(_a, _d.copy(heading).multiplyScalar(-1).setY(.35).normalize(), radius * (1.2 - i * .12), radius * (2.2 - i * .2), look, .85 - i * .1, seed + i);
      }
    }
    this.light(_a.copy(at).setY(at.y + .2), radius * 3.5 + 2.6, look, look.dark ? .3 : .55);
    this.poolLight(at.x, at.y + .4, at.z, look, look.dark ? 6 : 14, 9, 1.5);
  }

  beam(from: THREE.Vector3, to: THREE.Vector3, radius: number, look: StageLook, life: number, seed = 1, impact = 1) {
    const fade = life < .8 ? 1 : Math.max(0, 1 - (life - .8) / .2), drawn = !!this.full?.beams.draw(from, to, life, seed, radius, look.shell, look.edge, impact, 1.15, 1);
    _w.subVectors(to, from); const span = _w.length(); if (span < .05) return drawn;
    _w.divideScalar(span);
    if (!drawn) for (let i = 0, n = Math.min(10, Math.ceil(span / radius)); i < n; i++) this.glow(_a.copy(from).addScaledVector(_w, span * (i + .5) / n), radius * 2.2, look.main, .9 * fade);
    this.glow(from, radius * 1.6, look.core, .8 * fade); this.glow(to, radius * (1.5 + impact), look.core, (.5 + .5 * impact) * fade);
    for (let i = 0; i < 3; i++) this.light(_a.copy(from).addScaledVector(_w, span * (.12 + .38 * i)).setY(from.y + _w.y * span * (.12 + .38 * i) + .3), radius * 4 + 3.5, look, .5 * fade);
    this.poolLight(from.x + _w.x * Math.min(1.6, span * .5), from.y + .2, from.z + _w.z * Math.min(1.6, span * .5), look, 20 * fade, 10, 3);
    this.poolLight(to.x - _w.x * 1.1, to.y + .3, to.z - _w.z * 1.1, look, (12 + 12 * impact) * fade, 11, 3);
    if (look.flame >= 0 && fade > .1) for (let i = 0, n = Math.min(this.n(10, 4), Math.ceil(span / (radius * 1.3))); i < n; i++) {
      const s = (i + ((this.time * 2.2 + seed * .13) % 1)) / n;
      _a.copy(from).addScaledVector(_w, span * s); _a.y += radius * .55;
      this.tongue(_a, _d.copy(_w).multiplyScalar(.55).setY(_w.y * .55 + .8).normalize(), radius * 1.1, radius * 2.4, look, fade * (.85 - s * .3), seed + i);
    }
    return drawn;
  }

  column(base: THREE.Vector3, dir: THREE.Vector3, radius: number, length: number, look: StageLook, k = 1, seed = 0) {
    k = clamp01(k); if (k <= .02 || length <= .05) return;
    const tip = _b.copy(base).addScaledVector(dir, length), t = this.time;
    if (!look.dark) this.full?.beams.draw(base, tip, k > .98 ? .5 : .8 + (1 - k) * .19, seed + 1, radius * .55, look.shell, look.edge, 0, 1, k);
    _u.set(Math.abs(dir.y) < .9 ? 0 : 1, Math.abs(dir.y) < .9 ? 1 : 0, 0).cross(dir).normalize(); _v.crossVectors(dir, _u);
    const rows = Math.max(2, Math.min(8, Math.ceil(length / (radius * 1.6)))), spacing = length / rows, around = this.detail ? 3 : 2;
    for (let row = 0; row < rows; row++) for (let j = 0; j < around; j++) {
      const s = (row + ((t * 1.9 + j * .37 + seed * .11) % 1)) / rows, ang = j * TAU / around + row * 1.9 + seed, lean = look.dark ? .75 : .55;
      _a.copy(base).addScaledVector(dir, length * s).addScaledVector(_u, Math.cos(ang) * radius * lean).addScaledVector(_v, Math.sin(ang) * radius * lean);
      _d.copy(dir).addScaledVector(_u, Math.cos(ang) * .22).addScaledVector(_v, Math.sin(ang) * .22).normalize();
      this.tongue(_a, _d, radius * (look.dark ? 1.6 : 1.15), spacing * 2.4, look, k * (.82 - s * .4), seed + row * 7 + j);
    }
    if (look.dark) { this.glow(base, radius * 2, look.main, .4 * k); this.glow(_a.copy(base).addScaledVector(dir, length * .5), radius * 2.4, look.rim, .7 * k); }
    else { this.glow(base, radius * 1.7, look.core, .7 * k); this.glow(tip, radius * 1.5, look.main, .5 * k); this.glow(_a.copy(base).addScaledVector(dir, length * .5), radius * 2.4, look.main, .3 * k); }
    this.light(_a.copy(base).addScaledVector(dir, length * .4), length * .4 + radius * 2.5 + 1.5, look, (look.dark ? .3 : .5) * k);
    this.poolLight(base.x + dir.x * length * .3, base.y + dir.y * length * .3 + .5, base.z + dir.z * length * .3, look, (look.dark ? 8 : 26) * k, 12, 3);
  }

  bubble(at: THREE.Vector3, radius: number, look: StageLook, k = 1) {
    if (this.shellCount >= SHELLS || k <= .02 || radius <= .02) return;
    const o = this.object; o.position.copy(at); o.quaternion.identity(); o.scale.setScalar(radius); o.updateMatrix();
    this.shells.setMatrixAt(this.shellCount, o.matrix); this.shellTint.setXYZW(this.shellCount++, look.main.r, look.main.g, look.main.b, clamp01(k));
    this.glow(at, radius * 1.4, look.main, .3 * k);
    this.light(at, Math.min(7, radius * 2 + 1.5), look, .32 * k);
  }

  pool(at: THREE.Vector3, radius: number, look: StageLook, k: number, seed = 0, strength = 1) {
    k = clamp01(k); if (k <= .01 || strength <= .01) return;
    at = _f.set(at.x, floorUnder(at.x, at.y, at.z), at.z);
    if (look.dark) {
      this.disc(at, radius, look.main, strength, POOL, k, seed, 1, 1.2);
      for (let i = 0, n = this.n(Math.round(5 + radius * 2.2), 4); i < n; i++) {
        const ang = i * 2.399963 + seed + this.time * .25, inside = i % 3 === 0 ? .25 + .5 * hash(i + seed) : .9, r = radius * k * inside, h = (.5 + 1.1 * hash(i * 3.7 + seed)) * (.6 + .4 * Math.sin(this.time * 3 + i)) * Math.min(1.6, .5 + radius * .22);
        _a.set(at.x + Math.cos(ang) * r, at.y + h * .45, at.z + Math.sin(ang) * r);
        this.tongue(_a, UP, h * .55, h, look, .55 + .4 * hash(i + 1.3), seed + i);
      }
      this.light(_a.copy(at).setY(at.y + .3), Math.min(6, radius * k * .8 + 1.5), look, .22 * strength);
    } else {
      this.disc(at, radius * (.4 + .6 * k), look.main, strength, BURN, k, seed);
      this.light(_a.copy(at).setY(at.y + .3), radius * 1.5 + 1.5, look, .3 * k * strength);
    }
  }

  ring(at: THREE.Vector3, radius: number, height: number, look: StageLook, k = 1, seed = 0, count = 9) {
    k = clamp01(k); if (k <= .02) return;
    const floor = floorUnder(at.x, at.y, at.z);
    for (let i = 0, n = this.n(count, 4); i < n; i++) {
      const ang = i * TAU / n + seed + this.time * .5, h = height * (.6 + .4 * hash(seed + i * 3.3)) * (.82 + .18 * Math.sin(this.time * 7 + i * 2.1));
      _a.set(at.x + Math.cos(ang) * radius, floor + h * .45, at.z + Math.sin(ang) * radius);
      this.tongue(_a, UP, h * .42, h, look, k * (.55 + .35 * hash(i + seed)), seed + i);
    }
    this.light(_a.copy(at).setY(floor + .5), radius * 1.4 + 1.5, look, (look.dark ? .22 : .32) * k);
  }

  cracks(at: THREE.Vector3, normal: THREE.Vector3, radius: number, look: StageLook, k: number, seed = 0, fade = 1) {
    k = clamp01(k); if (k <= .02 || fade <= .02) return;
    at = this.laid(at, normal);
    _u.set(Math.abs(normal.y) < .9 ? 0 : 1, Math.abs(normal.y) < .9 ? 1 : 0, 0).cross(normal).normalize(); _v.crossVectors(normal, _u);
    const arms = this.n(11, 6), width = Math.max(.035, radius * .022) * (.5 + .5 * fade), stroke = look.heart > 0 ? look.main : look.core;
    for (let i = 0; i < arms; i++) {
      const ang = (i + hash(seed + i * 7.1) * .7) * TAU / arms, reach = radius * (.5 + .5 * hash(seed + i * 3.3)) * k;
      let px = 0, py = 0;
      for (let s = 1; s <= 4; s++) {
        const turn = ang + (hash(seed + i * 13.7 + s * 5.3) - .5) * (s < 4 ? .9 : .4), r = reach * s / 4, nx = Math.cos(turn) * r, ny = Math.sin(turn) * r;
        _a.copy(at).addScaledVector(_u, px).addScaledVector(_v, py); _b.copy(at).addScaledVector(_u, nx).addScaledVector(_v, ny);
        this.streak(_a, _b, width * (1.25 - s * .2), stroke, 1.25 * fade, look.heart);
        if (s === 2 || (s === 3 && i % 2 === 0)) {
          const off = turn + (hash(seed + i * 2.9 + s) > .5 ? .75 : -.75), len = reach * (.2 + .2 * hash(seed + i + s * 1.9));
          _c.copy(_b).addScaledVector(_u, Math.cos(off) * len).addScaledVector(_v, Math.sin(off) * len);
          this.streak(_b, _c, width * .6, stroke, fade, look.heart);
        }
        px = nx; py = ny;
      }
    }
    this.glow(at, Math.min(.9, radius * .3) * k, look.core, .6 * fade, STAR, .22, seed);
    this.light(at, Math.min(9, radius * 1.2 + 2), look, .3 * fade);
  }


  private shot(kind: number, at: THREE.Vector3, look: StageLook, size: number, born: number, life: number, dir?: THREE.Vector3, floor = at.y, length = 0): Shot {
    const shot = this.shots[this.shotCursor]; this.shotCursor = (this.shotCursor + 1) % SHOTS;
    shot.kind = kind; shot.at.copy(at); shot.look = look; shot.size = size; shot.born = born; shot.life = life; shot.floor = floor; shot.length = length; shot.live = true;
    shot.seed = (Math.abs(at.x * 31.7 + at.z * 17.3 + born * 5.1)) % 97;
    if (dir && dir.lengthSq() > 1e-6) shot.dir.copy(dir).normalize(); else shot.dir.set(0, 1, 0);
    return shot;
  }

  burst(point: THREE.Vector3, look: StageLook, size: number, born: number, options: BurstOptions = {}) {
    const floor = options.floor === undefined ? undefined : floorUnder(point.x, options.floor, point.z);
    this.shot(BURST, point, look, size, born, .4 + .14 * size, options.dir, floor ?? point.y);
    const kit = this.full; if (!kit) return;
    const el = look.element, sp = kit.sparks.spec, x = point.x, y = point.y, z = point.z;
    sp.reset(SPRITE.core, born, .09).pos(x, y, z).sized(size * .45, size * .8, .3).hot(0xffffff, 2.8).cool(el.spike); sp.bias = .12; kit.sparks.emit();
    sp.reset(SPRITE.star, born, .26).pos(x, y, z).sized(size * .7, size * 1.9, .25).hot(el.spike, 1.5).cool(el.rim, .4); sp.rotation = hash(born) * TAU; sp.bias = Math.min(.6, size * .3); kit.sparks.emit();
    kit.ring(x, y, z, size * .4, size * 2.4, born, .3, 0xffffff, el.rim, .08);
    kit.ring(x, y, z, size * .6, size * 3.2, born + .05, .4, el.spike, el.rim, .05);
    kit.streaks(x, y, z, el, kit.n(Math.round(10 + size * 5), 5), 11 + size * 3, .028 + size * .008, born, options.dir, .5);
    kit.pulse(x, y + .8, z, el.light, Math.min(42, 5 + 11 * Math.pow(size, 1.4)), 5 + size * 2.6, born, .3 + .1 * size, 2);
    if (look.dark) for (let i = 0, n = kit.n(6, 3); i < n; i++) { const a = i * 2.4 + born; kit.smoke(x + Math.cos(a) * size * .3, y + (hash(i + born) - .3) * size * .5, z + Math.sin(a) * size * .3, Math.cos(a) * 2.2, .8 + hash(i) * 1.2, Math.sin(a) * 2.2, size * (.7 + .4 * hash(i * 3)), born, .5, 0x3a1a5c, 0x07030d); }
    if (floor !== undefined && !options.clean && y - floor < 1.6 + size) {
      kit.groundImpact(x, floor, z, 0, 1, 0, size >= 1.5 ? 3 : 2, born, el, floor);
      if (!look.dark) kit.scorch(x, floor, z, 0, 1, 0, size * 1.5, born, el.light);
    }
  }

  scar(point: THREE.Vector3, look: StageLook, radius: number, born: number, life = 1.8) {
    if (this.kit.budget < .45 || this.kit.quality === 'low') return;
    this.shot(SCAR, point, look, radius, born, life, undefined, floorUnder(point.x, point.y, point.z));
  }

  shock(point: THREE.Vector3, look: StageLook, radius: number, born: number, life = .5) {
    const floor = floorUnder(point.x, point.y, point.z);
    this.shot(SHOCK, point, look, radius, born, life, undefined, floor);
    this.full?.dustRing(point.x, floor, point.z, this.n(12, 5), radius * .25, radius * 1.6, .7, born);
  }

  shatter(point: THREE.Vector3, normal: THREE.Vector3, look: StageLook, radius: number, born: number, life = .7) {
    point = this.laid(point, normal);
    this.shot(SHATTER, point, look, radius, born, life, normal, point.y);
    const kit = this.full; if (!kit) return;
    const el = look.element, sp = kit.sparks.spec;
    sp.reset(SPRITE.core, born, .1).at(point).sized(radius * .25, radius * .5, .3).hot(0xffffff, 3).cool(el.spike); sp.bias = .15; kit.sparks.emit();
    kit.ring(point.x, point.y, point.z, radius * .2, radius * 1.3, born, .26, 0xffffff, el.rim, .06, 'plane', normal.x, normal.y, normal.z);
    for (let i = 0, n = kit.n(12, 5); i < n; i++) {
      const a = hash(i + born) * TAU, v = 3 + 6 * hash(i * 2.3 + born);
      sp.reset(SPRITE.shard, born + .05, .5 + .3 * hash(i)).pos(point.x, point.y, point.z).velocity(Math.cos(a) * v, 2 + Math.sin(a) * v, (hash(i * 5.1) - .5) * v);
      sp.sized(.07 + .08 * hash(i * 7), .05, .4); sp.gravity = 9; sp.drag = 1.2; sp.spin = (hash(i) - .5) * 14; sp.hot(el.spike, 1.3).cool(el.rim, .5); kit.sparks.emit();
    }
    kit.pulse(point.x, point.y + .6, point.z, el.light, 14 + radius * 5, 8 + radius * 2, born, .4, 2);
  }

  erupt(base: THREE.Vector3, dir: THREE.Vector3, look: StageLook, radius: number, length: number, born: number, life = .7) {
    this.shot(ERUPT, base, look, radius, born, life, dir, base.y, length);
  }

  dome(point: THREE.Vector3, look: StageLook, radius: number, born: number, life = .55) {
    this.shot(DOME, point, look, radius, born, life, undefined, point.y);
  }

  private drawShot(shot: Shot, time: number) {
    const age = time - shot.born;
    if (age >= shot.life) { shot.live = false; return; }
    if (age < 0) return;
    const u = age / shot.life, look = shot.look, size = shot.size, at = shot.at, seed = shot.seed;
    switch (shot.kind) {
      case BURST: {
        const fade = (1 - u) * (1 - u), swell = easeOut(u * 1.6);
        if (look.dark) {
          this.ball(at, size * (.28 + .3 * swell), look, seed, 1 - u);
          this.glow(at, size * (.8 + .7 * swell), look.main, .9 * fade);
          this.glow(at, size * (.5 + .9 * swell), look.core, 1.1 * fade, RING, .05, Math.floor(time * 30), .85);
        } else {
          this.glow(at, size * (.7 + .6 * swell), look.main, .9 * fade);
          this.glow(at, size * (.32 + .25 * swell), look.core, 1.3 * (1 - u) * fade);
          this.glow(at, size * (.8 + .8 * swell), look.core, .55 * fade, STAR, .16, seed);
        }
        for (let i = 0, n = this.n(look.dark ? 7 : 8, 4); i < n; i++) {
          const ang = i * 2.399963 + seed, lift = .25 + .9 * hash(seed + i * 3.1);
          _d.set(Math.cos(ang), lift, Math.sin(ang)).addScaledVector(shot.dir, shot.dir.y > .9 ? 0 : .7).normalize();
          _a.copy(at).addScaledVector(_d, size * (.18 + .62 * swell) * (.6 + .5 * hash(i * 5.7 + seed)));
          this.tongue(_a, _d, size * (.5 - .2 * u), size * (.85 + .75 * swell), look, (1 - u) * .8, seed + i);
        }
        this.light(_a.copy(at).setY(at.y + .5), size * 2.6 + 1.2, look, (look.dark ? .6 : 1) * Math.min(.6, .22 + .26 * size) * fade);
        break;
      }
      case SCAR: {
        const heat = (1 - u) * Math.min(1, age / .08);
        _c.set(at.x, shot.floor, at.z);
        if (look.dark) { this.pool(_c, size, look, Math.min(.95, .2 + age / .22), seed, heat); break; }
        this.disc(_c, size, look.main, 1, BURN, heat, seed);
        if (look.flame >= 0) for (let i = 0, n = this.n(Math.round(4 + size * 2), 2); i < n; i++) {
          const ang = i * 2.399963 + seed, r = size * .7 * Math.sqrt(hash(i * 1.3 + seed)), h = size * (.3 + .5 * hash(i * 2.9 + seed)) * heat * (.75 + .25 * Math.sin(time * 9 + i * 2.3));
          _a.set(at.x + Math.cos(ang) * r, shot.floor + h * .42, at.z + Math.sin(ang) * r);
          this.tongue(_a, UP, h * .6, h, look, .45 + .5 * heat, seed + i);
        }
        if (this.tick && this.full && heat > .15) {
          const sp = this.full.sparks.spec, ang = hash(time * 7.3 + seed) * TAU, r = size * .7 * hash(time * 3.1);
          sp.reset(SPRITE.streak, time, .5 + .4 * hash(time)).pos(at.x + Math.cos(ang) * r, shot.floor + .1, at.z + Math.sin(ang) * r).velocity((hash(time * 1.7) - .5) * .8, 1.4 + 1.6 * hash(time * 2.3), (hash(time * 2.9) - .5) * .8);
          sp.orient = ORIENT.velocity; sp.sized(.022, .012, .5); sp.stretch = 2; sp.trail = .05; sp.drag = .6; sp.gravity = -.6; sp.hot(look.element.spike, 1.6).cool(look.element.rim, 0); this.full.sparks.emit();
        }
        this.light(_a.set(at.x, shot.floor + .4, at.z), size * 1.8 + 1.5, look, .3 * heat);
        break;
      }
      case SHOCK: {
        _c.set(at.x, shot.floor, at.z);
        this.disc(_c, size, look.core, 1 - u * .5, WAVE, .08 + .92 * easeOut(u), seed);
        this.light(_a.set(at.x, shot.floor + .4, at.z), size * (.4 + .8 * u) + 2, look, .35 * (1 - u));
        break;
      }
      case SHATTER: this.cracks(at, shot.dir, size, look, age / .07, seed, u < .4 ? 1 : 1 - (u - .4) / .6); break;
      case DOME: this.bubble(at, size * (.12 + .88 * easeOut(u)), look, Math.pow(1 - u, 1.4)); break;
      case ERUPT: {
        const rise = easeOut(age / .12), k = u < .4 ? 1 : 1 - (u - .4) / .6;
        this.column(at, shot.dir, size * (.75 + .25 * rise), shot.length * rise, look, k, seed);
        break;
      }
    }
  }


  private poolLight(x: number, y: number, z: number, look: StageLook, intensity: number, distance: number, priority: number) {
    this.full?.lights.request(x, y, z, look.element.light, intensity, distance, priority);
  }
  dim(amount: number, ...ids: (string | undefined)[]) { if (amount > .01 && involvesLocal(...ids)) SIGNATURE.screen?.powerDim?.(amount); }
  speed(amount: number, ...ids: (string | undefined)[]) { if (amount > .01 && involvesLocal(...ids)) SIGNATURE.screen?.speedLines?.(amount); }

  reset() {
    for (const shot of this.shots) shot.live = false;
    this.opened = false; this.open(this.time < 0 ? 0 : this.time); this.close();
  }
  release() {
    if (--this.refs > 0 || this.disposed) return;
    this.disposed = true; stages.delete(this.scene);
    this.flames.removeFromParent(); this.flames.geometry.dispose(); this.flames.material.dispose(); this.flames.dispose();
    this.shells.removeFromParent(); this.shells.geometry.dispose(); this.shells.material.dispose(); this.shells.dispose();
    this.glows.dispose(); this.bolts.dispose(); this.volumes.dispose(); this.discs.dispose(); this.spheres.dispose();
  }
  get counts() { return { flames: this.flameCount, glows: this.glows.count, bolts: this.bolts.count, lights: this.volumes.count, discs: this.discs.count, shells: this.shellCount, shots: this.shots.reduce((n, s) => n + (s.live ? 1 : 0), 0) }; }
}
