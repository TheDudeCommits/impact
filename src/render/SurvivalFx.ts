import * as THREE from 'three';
import { attachCosmetics, gameCosmetics } from './cosmetics/index';
import { KILL_SOUND } from './cosmetics/kills';
import { INK_ON, INK_MARK_PARS, inkColour, inkUniforms } from './rift/ink';
import { VfxKit, DUST_LIT, DUST_SHADE } from './vfx/VfxKit';
import { SPRITE, ORIENT } from './vfx/SparkField';
import { Drops } from './survival/Drops';
import { Flames } from './horde/Flames';
import { crater, CHARCOAL, CHARCOAL_SHADE } from './survival/crater';
import type { Element } from './vfx/palette';
import { isProc, isQuiet, RESCUE_REACH, type FeedItem, type RunView } from '../survival/SurvivalGame';
import type { CombatEvent } from '../game/types';
import { RiftAudio } from '../audio/survival/RiftAudio';
import { activeRift, prebuildRiftStage } from './rift/RiftStage';
import { Bolt } from './rift/bolt';
import { MARKS, UPLOAD } from './EnemyHorde';
import { locationFor } from '../survival/locations';
import { seeLens } from '../survival/lens';
import { riftBoss } from '../survival/riftTargeting';
import type { RiftStageId } from '../game/riftLayouts';
import { MAP_VIEW } from '../ui/survival/minimap';
import { ArtFx, ART_PALETTE } from './survival/artFx';
import { HeroGlow, type GlowSubject } from './survival/heroGlow';
import { releaseHidden } from './survival/vram';
import { glitch, watchGlitches } from '../ui/survival/glitch';
import { ALLY_MARKS, type MarkSubject } from '../ui/survival/allyMarks';
import { SELF_AURA, SELF_COLOUR, seatColour } from '../ui/survival/seats';
import { riftMoment, riftMomentReset, seriesOfUniverse } from '../audio/musicTracks';
import { ForkFx } from './survival/forkFx';
import { PATH_MARKS } from '../ui/survival/pathMarks';
import { THREAT_MARKS } from '../ui/survival/threatMarks';

const _look = new THREE.Vector3();
const SWEEPS = new Set(['Flying Slash', 'Flash Step']);


const E = (spike: number, rim: number, light = rim, ink = 0x10131a): Element => ({ spike, rim, light, ink });
const RIFT = E(0xf2dcff, 0x8a3cff, 0xa860ff, 0x0a0214);
const SHOCK = E(0xf2fbff, 0x6fd8ff, 0x9fe6ff);
const GOLD = E(0xfff3b0, 0xffb21e, 0xffc84a);
const BOLT = E(0xf2fbff, 0x5aa8ff, 0x9fd0ff, 0x0c1426);
const EMBER = E(0xfff1b0, 0xff4a1e, 0xff7a2a, 0x1c0a04);
const EMBER_FIRE = EMBER;
const PURGATORY = E(0xffd8f0, 0xd01030, 0xff2a5a, 0x10020a);
const BLOOD = E(0xffd2d8, 0xe0142e, 0xff3048, 0x050103);
const ICE = E(0xf4fdff, 0x7fd6ff, 0xa8e6ff, 0x0a1a2a);
const VOID = E(0xf6eaff, 0xb04dff, 0xc080ff, 0x06000c);
const STEEL = E(0xffffff, 0x9cc8ff, 0xc8e0ff, 0x08101c);
const MOCHI = E(0xfff4f8, 0xd06a9a, 0xffc8e0);
const QUAKE = E(0xfffcf0, 0xe8dcb0, 0xfff4d0);
const SHRINE_REACH = 7;
const QUAKE_INK = { core: 0xfffcf0, color: 0x14110e };
const WARD_INK = { core: 0xbfe8ff, color: 0x4ab8ff, deep: 0x0a2440 };
const GETSUGA_INK = { core: 0xff2038, color: 0x050103 };
const MOCHI_INK = { core: 0xffb0d0, color: 0x14080e };
const CLAW_INK = { core: 0x5ab4ff, color: 0x04080e };
const HOWL_INK = { core: 0xfff6ea, color: 0x0b0c0e };

const PORTALS = 10, BLADES = 8;
const RANK_MARK: Record<string, number> = { F: 0x9aa0a8, E: 0x6fc79a, D: 0x5a9cff, C: 0xff8a2a, B: 0xa060ff, A: 0xff2038, S: 0xffc03a };

type RiftScreen = { impactFrame(strength: number, at?: THREE.Vector3): void; chromaticPulse(amount: number): void;
  timeStop?(amount: number): void; techniqueGrade(color: number, strength: number, seconds: number, at?: { x: number; y: number; z: number }, reach?: number): void; speedLines(amount: number): void;
  bloomPass?: { bloom: { strength: number; threshold: number } };
  finalPass?: { uniforms: { uBloom: { value: number } } };
  renderer?: THREE.WebGLRenderer;
  composer?: { renderTarget1: THREE.WebGLRenderTarget };
  hemi?: THREE.HemisphereLight; sun?: THREE.DirectionalLight; fill?: THREE.DirectionalLight;
  look?: { hemi: { intensity: number }; key: { intensity: number }; fill: { intensity: number } } };
const COMPILES = new WeakSet<object>();
function compileForTarget(view: RiftScreen) {
  const renderer = view.renderer;
  if (!renderer || !view.composer || COMPILES.has(renderer)) return;
  COMPILES.add(renderer);
  const compile = renderer.compileAsync.bind(renderer);
  renderer.compileAsync = (scene, camera, targetScene) => {
    const previous = renderer.getRenderTarget(), target = view.composer?.renderTarget1;
    if (!target) return compile(scene, camera, targetScene);
    renderer.setRenderTarget(target);
    try { return compile(scene, camera, targetScene); } finally { renderer.setRenderTarget(previous); }
  };
}

const OWN_GRADE = new WeakMap<object, RiftScreen['techniqueGrade']>();
function rationInk(view: RiftScreen) {
  if (OWN_GRADE.has(view) || typeof view.impactFrame !== 'function' || typeof view.techniqueGrade !== 'function') return;
  const ink = view.impactFrame.bind(view), grade = view.techniqueGrade.bind(view);
  OWN_GRADE.set(view, grade);
  let last = -10;
  view.impactFrame = (strength: number, at?: THREE.Vector3) => {
    if (activeRift()) {
      const now = performance.now() / 1000;
      if (now - last < (strength < .95 ? 2 : 1)) return;
      last = now;
    }
    ink(strength, at);
  };
  view.techniqueGrade = (color: number, strength: number, seconds: number, at?: { x: number; y: number; z: number }, reach?: number) => {
    if (activeRift()) { strength = Math.min(strength, .65); seconds = Math.min(seconds, 1.2); }
    grade(color, strength, seconds, at, reach);
  };
}

const WEAPON: Partial<Record<string, 'steel' | 'iron'>> = { zoro: 'steel', ichigo: 'steel', sasuke: 'steel', law: 'steel', guts: 'iron' };

const HERO_RING_FRAGMENT = `
uniform float uTime; uniform float uAlpha;
varying vec2 vUv;
void main() {
	vec2 p = vUv * 2.0 - 1.0; float r = length( p ), a = atan( p.y, p.x );
	if ( r > 1.0 ) discard;
	float aa = fwidth( r ) * 1.5;
	float band = smoothstep( .8 - aa, .8, r ) * ( 1.0 - smoothstep( .9, .9 + aa, r ) );
	float ink = smoothstep( .74 - aa, .74, r ) * ( 1.0 - smoothstep( .96, .96 + aa, r ) );
	float gaps = step( .1, fract( ( a - uTime * .6 ) / 6.2831853 * 3.0 ) );
	float alpha = max( band * gaps, ink * gaps * .8 ) * uAlpha;
	if ( alpha < .01 ) discard;
	gl_FragColor = vec4( mix( vec3( .02 ), vec3( 1.6, 1.45, 1.2 ), band ), alpha );
}`;

const SOOTED = new WeakSet<object>();
function sootKit(k: VfxKit) {
  if (SOOTED.has(k)) return;
  SOOTED.add(k);
  const smoke = k.smoke.bind(k), dustRing = k.dustRing.bind(k), dustSpray = k.dustSpray.bind(k), puff = k.puff.bind(k), burst = k.debris.burst.bind(k.debris);
  k.smoke = (x, y, z, vx, vy, vz, size, born, life = .5, lit = DUST_LIT, shade = DUST_SHADE) => {
    const rift = !!activeRift();
    smoke(x, y, z, vx, vy, vz, size, born, life, rift && lit === DUST_LIT ? CHARCOAL : lit, rift && shade === DUST_SHADE ? CHARCOAL_SHADE : shade);
  };
  k.dustRing = (x, floor, z, count, radius, speed, size, born, life = .75) => {
    if (!activeRift()) return dustRing(x, floor, z, count, radius, speed, size, born, life);
    for (let i = 0, n = k.n(Math.ceil(count * .7), 2); i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * .5, v = speed * (.5 + Math.random() * .5);
      smoke(x + Math.cos(a) * radius, floor + .2, z + Math.sin(a) * radius, Math.cos(a) * v, .3 + Math.random() * .3, Math.sin(a) * v, size * (.8 + Math.random() * .4), born + Math.random() * .03, life * .85, CHARCOAL, CHARCOAL_SHADE);
    }
  };
  k.dustSpray = (x, floor, z, dx, dz, count, speed, size, born, life = .45, spread = 1.4) => {
    if (!activeRift()) return dustSpray(x, floor, z, dx, dz, count, speed, size, born, life, spread);
    const base = Math.atan2(dz, dx);
    for (let i = 0, n = k.n(Math.ceil(count * .7), 1); i < n; i++) {
      const a = base + (Math.random() - .5) * spread, v = speed * (.6 + Math.random() * .5);
      smoke(x, floor + .2, z, Math.cos(a) * v, .3 + Math.random() * .4, Math.sin(a) * v, size * (.8 + Math.random() * .4), born, life, CHARCOAL, CHARCOAL_SHADE);
    }
  };
  k.puff = (x, y, z, vx, vy, vz, size, born, life = .6, opacity = .62) => {
    if (activeRift()) smoke(x, y, z, vx, vy, vz, size * .8, born, life, CHARCOAL, CHARCOAL_SHADE);
    else puff(x, y, z, vx, vy, vz, size, born, life, opacity);
  };
  k.debris.burst = (count, x, y, z, nx, ny, nz, speed, spread, size, floor, life = 1.8) => {
    if (activeRift()) burst(Math.max(1, Math.round(count * .35)), x, y, z, nx, ny, nz, speed * .8, spread, size * .6, floor, life * .7);
    else burst(count, x, y, z, nx, ny, nz, speed, spread, size, floor, life);
  };
}

const PORTAL_VERTEX = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PORTAL_FRAGMENT = `
uniform float uTime; uniform float uOpen; uniform vec3 uRim;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
  float edge = .72 + .14 * noise(vec2(a * 3.0, uTime * 2.4)) + .08 * noise(vec2(a * 9.0, -uTime * 4.0));
  edge *= uOpen;
  if (r > edge + .12) discard;
  float swirl = noise(vec2(a * 2.0 + r * 6.0 - uTime * 5.0, r * 4.0));
  float core = smoothstep(edge, edge - .35, r);
  float rim = smoothstep(edge + .12, edge, r) * smoothstep(edge - .2, edge, r);
  vec3 ink = vec3(.02, .005, .04) + vec3(.12, .02, .2) * swirl * core;
  vec3 color = mix(ink, uRim * (2.2 + swirl * 1.6), rim);
  float alpha = max(core * .92, rim);
  gl_FragColor = vec4(color, alpha * smoothstep(0.0, .15, uOpen));
}`;
const SLIT_FRAGMENT = `
uniform float uTime; uniform float uOpen; uniform vec3 uRim;
varying vec2 vUv;
float hash(float n){ return fract(sin(n) * 43758.5453); }
// Smooth 1-D noise: the tear's edge crawls, it does not step in blocks.
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f); }
void main(){
  float y = vUv.y; float x = vUv.x * 2.0 - 1.0;
  float jag = (n1(y * 14.0 + uTime * 6.0) - .5) * .22 + (n1(y * 37.0 - uTime * 11.0) - .5) * .08;
  float width = uOpen * (.55 - abs(y - .5) * .9) * .5;
  float d = abs(x - jag);
  if (d > width + .08 || width <= 0.0) discard;
  float core = smoothstep(width, width * .2, d);
  vec3 color = mix(uRim * 2.5, vec3(3.0, 2.6, 3.4), core);
  gl_FragColor = vec4(color, smoothstep(width + .08, width, d));
}`;

const PORTAL_INK_FRAGMENT = `
uniform float uTime; uniform float uOpen; uniform vec3 uRim;
${INK_MARK_PARS}
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
  float edge = (.72 + .14 * noise(vec2(a * 3.0, uTime * 2.4)) + .08 * noise(vec2(a * 9.0, -uTime * 4.0))) * uOpen;
  if (r > edge + .14) discard;
  float hole = 1.0 - smoothstep(edge - .03, edge, r);
  float rim = (1.0 - smoothstep(edge, edge + .14 * (.6 + .4 * noise(vec2(a * 14.0, uTime))), r)) * (1.0 - hole);
  gl_FragColor = vec4(mix(uInkHot, uInkDark, hole), max(hole, rim) * smoothstep(0.0, .15, uOpen));
}`;
const SLIT_INK_FRAGMENT = `
uniform float uTime; uniform float uOpen; uniform vec3 uRim;
${INK_MARK_PARS}
varying vec2 vUv;
float hash(float n){ return fract(sin(n) * 43758.5453); }
float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash(i), hash(i + 1.0), f); }
void main(){
  float y = vUv.y; float x = vUv.x * 2.0 - 1.0;
  float jag = (n1(y * 14.0 + uTime * 6.0) - .5) * .22 + (n1(y * 37.0 - uTime * 11.0) - .5) * .08;
  float width = uOpen * (.55 - abs(y - .5) * .9) * .5;
  float d = abs(x - jag);
  if (d > width * 2.2 + .02 || width <= 0.0) discard;
  float core = 1.0 - smoothstep(width * .55, width, d);
  float rim = (1.0 - smoothstep(width, width * 2.2 + .02, d)) * (1.0 - core);
  gl_FragColor = vec4(mix(uInkHot, uInkDark, core), max(core, rim * .9));
}`;

interface Portal { mesh: THREE.Mesh; slit: THREE.Mesh; born: number; radius: number; life: number; uniforms: { uTime: { value: number }; uOpen: { value: number }; uRim: { value: THREE.Color } } }
interface Meteor { x: number; z: number; radius: number; lands: number; started: number; fx: number; fy: number; fz: number; last: number }
interface Burning { x: number; z: number; radius: number; until: number; next: number }

const _size = new THREE.Vector2();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

export class SurvivalFx {
  private kit: VfxKit;
  private portals: Portal[] = [];
  private drops: Drops;
  private blades: THREE.InstancedMesh;
  private lastFeed = 0;
  private bladeTrail = 0;
  private rescues: { ring: THREE.Mesh; arc: THREE.Mesh }[] = [];
  private meteors: Meteor[] = [];
  private burning: Burning[] = [];
  private readonly audio = new RiftAudio();
  get screen(): RiftScreen | undefined { return this.view; }
  set screen(view: RiftScreen | undefined) {
    this.view = view;
    if (view) { rationInk(view); compileForTarget(view); }
    UPLOAD.texture = view?.renderer ? texture => { this.uploads.push(texture); texture.addEventListener('dispose', this.dropUpload); } : undefined;
  }
  private view?: RiftScreen;
  private readonly uploads: THREE.Texture[] = [];
  private readonly dropUpload = (event: { target: THREE.Texture }) => {
    const i = this.uploads.indexOf(event.target);
    if (i >= 0) this.uploads.splice(i, 1);
  };
  uploadNextTexture() {
    const texture = this.uploads.shift(), renderer = this.view?.renderer;
    if (!texture) return;
    texture.removeEventListener('dispose', this.dropUpload);
    if (renderer) try { renderer.initTexture(texture); } catch { }
  }
  private bloomBase = -1;
  private bloomSet = -1;
  private kneeBase = -1;
  private kneeSet = -1;
  private limitBloom(load: number) {
    const glow = this.view?.finalPass?.uniforms.uBloom, bloom = this.view?.bloomPass?.bloom;
    if (!glow || !bloom) return;
    if (Math.abs(glow.value - this.bloomSet) > 1e-4) this.bloomBase = glow.value;
    if (Math.abs(bloom.threshold - this.kneeSet) > 1e-4) this.kneeBase = bloom.threshold;
    const ease = this.bloomSet < 0 ? 1 : .25;
    this.bloomSet = glow.value += (this.bloomBase * (1 - .5 * load) - glow.value) * ease;
    this.kneeSet = bloom.threshold += (this.kneeBase * (1 + .6 * load) - bloom.threshold) * ease;
  }
  private grade(color: number, strength: number, seconds: number) {
    const view = this.view;
    if (view) (OWN_GRADE.get(view) ?? view.techniqueGrade.bind(view))(color, strength, seconds);
  }
  private nextBolt = 0;
  private boltAt = -99;
  private moody = false;
  private readonly arts: ArtFx;
  private readonly glow: HeroGlow;
  private nextRelease = 0;
  constructor(private scene: THREE.Scene) {
    attachCosmetics(scene);
    this.forks = new ForkFx(scene);
    this.kit = VfxKit.for(scene);
    this.arts = new ArtFx(scene);
    this.glow = new HeroGlow(scene);
    this.fires = new Flames(scene, 160); this.fires.mesh.name = 'survival-art-flames';
    sootKit(this.kit);
    scene.add(this.storm.mesh);
    const disc = new THREE.CircleGeometry(1, 48); disc.rotateX(-Math.PI / 2);
    const slit = new THREE.PlaneGeometry(1.4, 3.4); slit.translate(0, 1.7, 0);
    for (let i = 0; i < PORTALS; i++) {
      const uniforms = { uTime: { value: 0 }, uOpen: { value: 0 }, uRim: { value: new THREE.Color(0x9a4dff) } };
      const inked = INK_ON ? { ...uniforms, ...inkUniforms } : uniforms;
      const mesh = new THREE.Mesh(disc, new THREE.ShaderMaterial({ uniforms: inked, vertexShader: PORTAL_VERTEX, fragmentShader: INK_ON ? PORTAL_INK_FRAGMENT : PORTAL_FRAGMENT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      const gate = new THREE.Mesh(slit, new THREE.ShaderMaterial({ uniforms: inked, vertexShader: PORTAL_VERTEX, fragmentShader: INK_ON ? SLIT_INK_FRAGMENT : SLIT_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: INK_ON ? THREE.NormalBlending : THREE.AdditiveBlending }));
      (mesh.material as THREE.Material).forceSinglePass = true; (gate.material as THREE.Material).forceSinglePass = true;
      mesh.visible = gate.visible = false; mesh.frustumCulled = gate.frustumCulled = false; mesh.renderOrder = 2; gate.renderOrder = 3;
      scene.add(mesh, gate);
      this.portals.push({ mesh, slit: gate, born: -1e9, radius: 1, life: 1.3, uniforms });
    }
    this.drops = new Drops(scene, this.kit);
    const bladeGeometry = new THREE.OctahedronGeometry(.5, 0); bladeGeometry.scale(.12, .07, 1);
    this.blades = new THREE.InstancedMesh(bladeGeometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.8, 3.4), toneMapped: false }), BLADES);
    this.blades.count = 0; this.blades.frustumCulled = false; this.blades.name = 'survival-blades';
    scene.add(this.blades);
    const ring = new THREE.PlaneGeometry(1.6, 1.6); ring.rotateX(-Math.PI / 2);
    this.heroRing = new THREE.Mesh(ring, new THREE.ShaderMaterial({ uniforms: this.heroRingUniforms, vertexShader: PORTAL_VERTEX, fragmentShader: HERO_RING_FRAGMENT,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false }));
    this.heroRing.renderOrder = 3; this.heroRing.frustumCulled = false; this.heroRing.visible = false; this.heroRing.name = 'survival-hero-ring';
    scene.add(this.heroRing);
    const ringGeometry = new THREE.RingGeometry(RESCUE_REACH - .12, RESCUE_REACH, 64, 1); ringGeometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const arcGeometry = new THREE.RingGeometry(RESCUE_REACH - .34, RESCUE_REACH - .14, 64, 1, Math.PI / 2, -Math.PI * 2); arcGeometry.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, .25, .35), transparent: true, depthWrite: false, toneMapped: false }));
      const arc = new THREE.Mesh(arcGeometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 2.1, .5), transparent: true, depthWrite: false, toneMapped: false }));
      ring.visible = arc.visible = false; ring.renderOrder = arc.renderOrder = 3; ring.frustumCulled = arc.frustumCulled = false;
      scene.add(ring, arc);
      this.rescues.push({ ring, arc });
    }
  }

  allies(downed: readonly { x: number; y: number; z: number; rescue: number }[], time: number) {
    this.rescues.forEach(({ ring, arc }, i) => {
      const ally = downed[i];
      ring.visible = arc.visible = !!ally;
      if (!ally) return;
      ring.position.set(ally.x, ally.y + .06, ally.z); arc.position.copy(ring.position);
      (ring.material as THREE.MeshBasicMaterial).opacity = .55 + Math.sin(time * 6) * .35;
      const segments = Math.round(Math.max(0, Math.min(1, ally.rescue)) * 64);
      arc.geometry.setDrawRange(0, segments * 6);
      arc.visible = segments > 0;
    });
  }

  private mood(view: RunView | undefined, time: number) {
    const s = this.screen;
    if (!s?.hemi || !s.sun || !s.look) return;
    const stage = view?.location?.stage;
    let hemi = 1, key = 1, bolt = 0;
    if (stage === 'rift-village') {
      key = 1 + .09 * Math.sin(time * 7.3) * Math.sin(time * 2.9 + 1) + .05 * Math.sin(time * 17.1);
    } else if (stage === 'rift-fortress') {
      if (time >= this.nextBolt || this.nextBolt - time > 40) {
        if (this.boltAt > 0 || this.nextBolt > 0) {
          this.boltAt = time; this.audio.strike(.35 + Math.random() * .9);
          const aim = this.boltAim.copy(this.subject).sub(this.lens).setY(0);
          if (aim.lengthSq() < 1e-4) aim.set(0, 0, -1);
          this.storm.strike(this.lens, aim.normalize());
        }
        this.nextBolt = time + 9 + Math.random() * 14;
      }
      const t = time - this.boltAt;
      const flash = t < 0 || t > 1 ? 0 : Math.max(Math.exp(-t * 26) * (t < .09 ? 1 : 0), t > .14 ? Math.exp(-(t - .14) * 9) * .8 : 0);
      hemi = 1 + flash * 3.2; key = 1 + flash * 1.4;
      const rift = activeRift();
      if (rift) rift.lightning = flash;
      bolt = flash;
    } else if (stage === 'rift-eclipse') {
      const beat = (time % 1.25) / 1.25;
      hemi = 1 + .1 * (Math.exp(-beat * 18) + .7 * Math.exp(-Math.max(0, beat - .19) * 18) * (beat > .19 ? 1 : 0));
    }
    this.storm.flash = bolt;
    if (!stage) { if (this.moody) this.calm(); return; }
    this.moody = true;
    s.hemi.intensity = s.look.hemi.intensity * hemi;
    s.sun.intensity = s.look.key.intensity * key;
  }
  private calm() {
    const s = this.screen;
    this.moody = false;
    if (s?.hemi && s.sun && s.look) { s.hemi.intensity = s.look.hemi.intensity; s.sun.intensity = s.look.key.intensity; }
  }

  reset() { this.sootArena(false); this.calm(); this.nextBolt = 0; this.boltAt = -99; this.audio.reset(); for (const { ring, arc } of this.rescues) ring.visible = arc.visible = false; this.lastFeed = 0; this.meteors.length = 0; this.burning.length = 0; this.columns.length = 0; this.fires.begin(0); this.fires.end(); for (const p of this.portals) { p.born = -1e9; p.mesh.visible = p.slit.visible = false; } this.drops.clear(); this.blades.count = 0; this.arts.clear(); this.glow.clear(); ALLY_MARKS.current?.clear(); riftMomentReset(); this.forks.reset(); PATH_MARKS.current?.clear(); }

  private portal(x: number, y: number, z: number, radius: number, time: number) {
    const slot = this.portals.reduce((oldest, p) => p.born < oldest.born ? p : oldest, this.portals[0]);
    slot.born = time; slot.radius = radius;
    slot.mesh.position.set(x, y + .03, z); slot.slit.position.set(x, y, z);
    slot.mesh.visible = slot.slit.visible = true;
    const k = this.kit;
    k.ring(x, y + .06, z, .2, radius * 2.2, time, .5, 0xffffff, RIFT.rim, .2, 'flat');
    this.soot(x, y, z, 10, radius * .6, 4, .8, time + .1);
    k.pulse(x, y + 1.2, z, RIFT.light, 6, 8, time, .6);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.smoke(x + Math.cos(a) * radius * .7, y + .3, z + Math.sin(a) * radius * .7, Math.cos(a) * .8, 1.4, Math.sin(a) * .8, 1.2, time + .15 + i * .02, .7, 0x3a1860, 0x12061e); }
  }

  private draftSince = -1;
  private prebuildAhead(view: RunView | undefined) {
    const still = !!view && (view.phase === 'draft' || (view.phase === 'fight' && view.roundState === 'interlude'));
    if (!still) { this.draftSince = -1; return; }
    const now = performance.now();
    if (this.draftSince < 0) { this.draftSince = now; return; }
    if (now - this.draftSince < 800) return;
    const next = view.next ?? locationFor(view.round + 1).location.stage;
    if (next !== view.location?.stage && next.startsWith('rift-')) prebuildRiftStage(next as RiftStageId);
  }

  private activeUntil = 0;
  private nextPhantomLook = 0;
  private hookPhantoms() {
    for (const root of this.scene.getObjectsByProperty('name', 'asura-phantom')) {
      if (root.userData.riftThinned) continue;
      root.userData.riftThinned = true;
      root.traverse(node => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh) return;
        const before = mesh.onBeforeRender;
        mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
          before.call(mesh, renderer, scene, camera, geometry, material, group);
          this.thinPhantom(root, material as THREE.ShaderMaterial, camera, renderer.info.render.frame);
        };
      });
    }
  }
  private thinPhantom(root: THREE.Object3D, material: THREE.ShaderMaterial, camera: THREE.Camera, frame: number) {
    const opacity = material.uniforms?.uOpacity;
    if (!opacity || performance.now() > this.activeUntil) return;
    const data = material.userData;
    if (data.riftFrame !== frame) { data.riftFrame = frame; data.riftBase = opacity.value; }
    const now = performance.now();
    if (data.riftBase < .01) data.riftSince = undefined; else data.riftSince ??= now;
    const risen = data.riftSince === undefined ? 0 : Math.min(1, Math.max(0, (now - data.riftSince - 1200) / 900));
    root.getWorldPosition(_p); _p.y += 2.2;
    const near = Math.min(1, Math.max(.3, (camera.position.distanceTo(_p) - 2.5) / 4));
    opacity.value = data.riftBase * (.55 - .35 * risen) * near;
  }

  private readonly heroRing: THREE.Mesh;
  private readonly forks: ForkFx;
  private readonly riftPulse = new Map<string, number>();
  private readonly heroRingUniforms = { uTime: { value: 0 }, uAlpha: { value: 0 } };
  private readonly artCasts: number[] = [];
  private readonly fires: Flames;
  private readonly columns: { x: number; y: number; z: number; radius: number; born: number; tall: number; heat: number; tint: number; seed: number }[] = [];
  private victimAt = -1;
  private victims = 0;
  private artBudget = 1;

  private readonly lens = new THREE.Vector3(0, 1e4, 0);
  private readonly subject = new THREE.Vector3();
  private readonly storm = new Bolt();
  private readonly boltAim = new THREE.Vector3();

  private soot(x: number, floor: number, z: number, count: number, radius: number, speed: number, size: number, time: number) {
    const k = this.kit;
    for (let i = 0, n = k.n(Math.ceil(count * .6), 2); i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * .6, v = speed * .5 * (.6 + Math.random() * .6);
      k.smoke(x + Math.cos(a) * radius, floor + .25, z + Math.sin(a) * radius, Math.cos(a) * v, .25 + Math.random() * .3, Math.sin(a) * v,
        size * (.8 + Math.random() * .5), time + Math.random() * .04, .7 + Math.random() * .3, CHARCOAL, CHARCOAL_SHADE);
    }
  }

  private lensDim(x: number, y: number, z: number) {
    const lx = this.lens.x, ly = this.lens.y, lz = this.lens.z;
    const near = Math.hypot(x - lx, y + 1.5 - ly, z - lz);
    let dim = .15 + .85 * Math.min(1, Math.max(0, (near - 3) / 5));
    const sx = this.subject.x - lx, sz = this.subject.z - lz, span = Math.hypot(sx, sz);
    if (span > .5) {
      const t = ((x - lx) * sx + (z - lz) * sz) / (span * span);
      if (t > 0 && t < .95) {
        const off = Math.abs((x - lx) * sz - (z - lz) * sx) / span;
        dim = Math.min(dim, .3 + .7 * Math.min(1, Math.max(0, (off - 1.2) / 2.3)));
      }
    }
    const hero = Math.hypot(x - this.subject.x, z - this.subject.z);
    dim = Math.min(dim, .35 + .65 * Math.min(1, Math.max(0, (hero - 1.2) / 1.8)));
    const boss = riftBoss.current;
    if (boss) dim = Math.min(dim, .3 + .7 * Math.min(1, Math.max(0, (Math.hypot(x - boss.x, z - boss.z) - boss.radius - 1) / 2)));
    return dim;
  }

  handle(feed: readonly FeedItem[], time: number, player?: THREE.Vector3) {
    try { this.handleFeed(feed, time, player); } catch (error) { glitch(error, 'effects'); }
  }
  private handleFeed(feed: readonly FeedItem[], time: number, player?: THREE.Vector3) {
    if (player) this.subject.copy(player);
    this.audio.handle(feed);
    for (const item of feed) if (item.id > this.lastFeed && item.kind === 'path') this.forks.feed(item, time);
    const ARTS = new Set(['smite', 'whirl', 'pillar', 'meteor', 'frost', 'slash', 'shockwave', 'chain', 'burst']);
    for (const item of feed) if (item.id > this.lastFeed && ARTS.has(item.kind)) this.artCasts.push(time);
    while (this.artCasts.length && time - this.artCasts[0] > 1) this.artCasts.shift();
    this.artBudget = Math.max(.4, Math.min(1, 4 / Math.max(4, this.artCasts.length)));
    this.limitBloom(Math.max(0, Math.min(1, (this.artCasts.length - 3) / 9)));
    let pillars = 0;
    for (const item of feed) if (item.id > this.lastFeed && item.kind === 'pillar') pillars++;
    const pillarDim = 1 / Math.sqrt(Math.max(1, pillars));
    for (const item of feed) {
      if (item.id <= this.lastFeed) continue;
      this.lastFeed = item.id;
      const x = item.x ?? player?.x ?? 0, y = item.y ?? player?.y ?? 0, z = item.z ?? player?.z ?? 0, k = this.kit;
      switch (item.kind) {
        case 'spawn': this.portal(x, y, z, item.radius ?? 2, time); break;
        case 'rend': {
          const sp = k.sparks.spec, a = Math.random() * Math.PI, tilt = (Math.random() - .5) * 1.2;
          if (!item.value) {
            sp.reset(SPRITE.streak, time, .7).pos(x, y, z).sized(.045, .75, .4).hot(BLOOD.spike, 1.7).cool(BLOOD.rim, .9); sp.orient = ORIENT.axial; sp.axis(Math.cos(a), tilt, Math.sin(a)); k.sparks.emit();
            break;
          }
          for (const turn of [0, 1.9]) {
            sp.reset(SPRITE.streak, time, .26).pos(x, y, z).sized(.07, 1.4, .4).hot(0xffffff, 2).cool(BLOOD.rim, .6); sp.orient = ORIENT.axial; sp.axis(Math.cos(a + turn), tilt * (turn ? -1 : 1), Math.sin(a + turn)); k.sparks.emit();
          }
          k.hitSpark(x, y, z, BLOOD, 2, time);
          k.ring(x, y - 1.05, z, .3, (item.radius ?? 1.8) * 2, time, .32, 0xffffff, BLOOD.rim, .18, 'flat');
          if (this.lensDim(x, y, z) > .5) this.screen?.impactFrame(.35, _p.set(x, y, z));
          break;
        }
        case 'echo': {
          const sp = k.sparks.spec, a = Math.random() * Math.PI, ult = item.value === 2, tone = ult ? GOLD : SHOCK;
          sp.reset(SPRITE.streak, time, ult ? .4 : .3).pos(x, y, z).sized(ult ? .1 : .06, ult ? 2.6 : 1.6, .3).hot(0xffffff, ult ? 1.8 : 1.4).cool(tone.rim, .5); sp.orient = ORIENT.axial; sp.axis(Math.cos(a), .3, Math.sin(a)); k.sparks.emit();
          k.hitSpark(x, y, z, tone, ult ? 2 : 1, time);
          if (ult) { k.ring(x, y - 1, z, .4, (item.radius ?? 1.6) * 2.4, time, .35, 0xffffff, GOLD.rim, .15, 'flat'); k.pulse(x, y, z, GOLD.light, 5, 7, time, .3); }
          break;
        }
        case 'crescent': {
          const yaw = item.value ?? 0, dx = Math.sin(yaw), dz = Math.cos(yaw), speed = (item.radius ?? 9) / .45, sp = k.sparks.spec;
          for (let i = -5; i <= 5; i++) {
            const t = i / 5, back = (1 - Math.cos(t * 1.1)) * 1.9, px = x + dz * t * 1.9 - dx * back, pz = z - dx * t * 1.9 - dz * back;
            sp.reset(SPRITE.glow, time, .45).pos(px, y, pz).velocity(dx * speed, 0, dz * speed).sized(.5, .3, .15).hot(STEEL.rim, 1.25).cool(STEEL.rim, .45); sp.orient = ORIENT.axial; sp.axis(dz, 0, -dx); sp.stretch = 1.9; k.sparks.emit();
            sp.reset(SPRITE.glow, time, .38).pos(px, y, pz).velocity(dx * speed, 0, dz * speed).sized(.13, .07, .1).hot(0xffffff, 2); sp.orient = ORIENT.axial; sp.axis(dz, 0, -dx); sp.stretch = 3.4; k.sparks.emit();
            if (i % 2 === 0) { sp.reset(SPRITE.streak, time + .05, .3).pos(px, y, pz).velocity(dx * speed * .7 + dz * t * 3, 1.5, dz * speed * .7 - dx * t * 3); sp.orient = ORIENT.velocity; sp.sized(.04, .02, .5); sp.stretch = 4; sp.gravity = 6; sp.hot(0xffffff, 1.4).cool(STEEL.rim, .3); k.sparks.emit(); }
          }
          k.ring(x + dx * 1.2, y - .95, z + dz * 1.2, .4, 3, time, .28, 0xffffff, STEEL.rim, .12, 'flat');
          k.pulse(x + dx * 2, y, z + dz * 2, STEEL.light, 4, 7, time, .22);
          break;
        }
        case 'shockwave':
          this.arts.decal(0, x, y + .07, z, (item.radius ?? 3.6) * 1.9, ART_PALETTE.gold, time, .45);
          this.arts.decal(3, x, y + .06, z, (item.radius ?? 3.6) * .8, ART_PALETTE.gold, time, .3, { spin: Math.random() * 6.28 });
          k.ring(x, y + .1, z, .5, (item.radius ?? 3.6) * 2, time, .42, 0xffffff, SHOCK.rim, .15, 'flat');
          k.ring(x, y + 1, z, .4, 3.2, time, .3, 0xffffff, SHOCK.rim, .1);
          this.soot(x, y, z, 12, .6, 6, 1, time); k.pulse(x, y + 1.2, z, SHOCK.light, 7, 9, time, .35);
          break;
        case 'counter':
          k.ring(x, y + .1, z, .6, (item.radius ?? 4) * 2, time, .5, 0xffffff, GOLD.rim, .2, 'flat');
          k.hitSpark(x, y + 1.1, z, GOLD, 3, time); k.pulse(x, y + 1.2, z, GOLD.light, 10, 10, time, .45);
          this.screen?.impactFrame(.5);
          break;
        case 'haki':
          k.ring(x, y + .1, z, 1, (item.radius ?? 9) * 2, time, .7, BLOOD.spike, BLOOD.rim, .35, 'flat');
          this.arts.decal(0, x, y + .08, z, (item.radius ?? 9) * 1.1, ART_PALETTE.blood, time, .6);
          this.arts.whirlwind(x, y, z, (item.radius ?? 9) * .5, time, false);
          this.soot(x, y, z, 16, 1, 8, 1.2, time);
          this.screen?.impactFrame(.35); this.screen?.chromaticPulse(.6);
          break;
        case 'burst':
          this.arts.decal(3, x, y + .07, z, (item.radius ?? 3) * .9, ART_PALETTE.fire, time, .28, { spin: Math.random() * 6.28, alpha: .9 });
          k.hitSpark(x, y + 1, z, EMBER, 2, time); k.ring(x, y + .1, z, .3, (item.radius ?? 3) * 2, time, .35, 0xffffff, EMBER.rim, .15, 'flat');
          k.smoke(x, y + .8, z, 0, 1.2, 0, 1.2, time, .5, CHARCOAL, CHARCOAL_SHADE);
          break;
        case 'chain':
          if (item.points) for (let i = 1; i < item.points.length; i++) {
            const a = item.points[i - 1], b = item.points[i];
            _a.set(a.x, a.y, a.z); _b.set(b.x, b.y, b.z);
            k.crackle(_a, _b, .12, BOLT, 14, time); k.hitSpark(b.x, b.y, b.z, BOLT, 1, time);
            k.pulse(b.x, b.y + .4, b.z, BOLT.light, 4, 6, time, .25);
          }
          break;
        case 'level': {
          const sp = k.sparks.spec;
          sp.reset(SPRITE.glow, time, .7).pos(x, y + 2.6, z).sized(.42, .6, .3).hot(GOLD.spike, .75); sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.stretch = 6; k.sparks.emit();
          sp.reset(SPRITE.glow, time, .5).pos(x, y + 2.6, z).sized(.08, .14, .3).hot(0xfff0c0, .9); sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.stretch = 16; k.sparks.emit();
          k.ring(x, y + .1, z, .4, 6, time, .7, GOLD.spike, GOLD.rim, .25, 'flat');
          for (let i = 0; i < 4; i++) k.ring(x, y + .4 + i * .8, z, .3, 1.8, time + i * .07, .55, GOLD.spike, GOLD.rim, .15, 'flat');
          for (let i = 0, n = k.n(18, 6); i < n; i++) {
            const a = i / n * Math.PI * 2, r = .5 + Math.random() * .6;
            sp.reset(SPRITE.streak, time + Math.random() * .1, .6).pos(x + Math.cos(a) * r, y + .2, z + Math.sin(a) * r).velocity(Math.cos(a) * .6, 7 + Math.random() * 5, Math.sin(a) * .6);
            sp.orient = ORIENT.velocity; sp.sized(.06, .04, .5); sp.stretch = 5; sp.trail = .03; sp.drag = 1.2; sp.hot(GOLD.spike, 1.6).cool(GOLD.rim, .3); k.sparks.emit();
          }
          k.pulse(x, y + 1.5, z, GOLD.light, 5, 8, time, .7);
          this.grade(0xffcf5a, .22, .6);
          break;
        }
        case 'enraged': {
          const last = item.value === 2;
          k.ring(x, y + .1, z, .6, last ? 24 : 12, time, last ? .9 : .6, 0xffffff, BLOOD.rim, .3, 'flat');
          k.pulse(x, y + 2, z, BLOOD.light, last ? 14 : 8, last ? 16 : 10, time, .6);
          if (last) { this.screen?.impactFrame(.95, _p.set(x, y + 2, z)); this.screen?.chromaticPulse(1); this.grade(0xd01030, .5, 1.4); this.audio.strike(1.2); }
          break;
        }
        case 'break':
          k.ring(x, y + 1.4, z, .5, 4, time, .45, GOLD.spike, 0xffcf5a, .2);
          k.hitSpark(x, y + 1.4, z, GOLD, 3, time);
          this.screen?.impactFrame(item.boss ? .55 : .3, _p.set(x, y + 1.4, z)); if (item.boss) this.screen?.chromaticPulse(.7);
          break;
        case 'down':
          this.screen?.impactFrame(1); this.screen?.chromaticPulse(1); this.grade(0xffcf5a, .6, 1.4);
          break;
        case 'revive':
          k.ring(x, y + .1, z, .5, 12, time + 1.2, .8, 0xffffff, GOLD.rim, .3, 'flat');
          break;
        case 'second-wind':
          k.ring(x, y + .1, z, .5, 7, time, .7, 0xeaffea, 0x3ae88a, .3, 'flat');
          k.pulse(x, y + 1.2, z, 0x3ae88a, 5, 22, time, .7);
          break;
        case 'finale':
          this.screen?.impactFrame(1); this.screen?.chromaticPulse(.6); this.grade(0xffcf5a, .55, 3.2);
          k.ring(x, .1, z, 1, 60, time, 2.4, 0xffffff, GOLD.rim, .35, 'flat');
          k.pulse(x, 3, z, GOLD.light, 10, 40, time, 1.6);
          break;
        case 'smite':
          for (const at of item.points ?? []) { this.arts.lightning(at.x, at.y, at.z, time, item.value === 2); this.boltDebris(at.x, at.y, at.z, item.value === 2 ? GOLD : BOLT, time + (item.value === 2 ? .28 : 0)); }
          break;
        case 'whirl':
          this.arts.whirlwind(x, y, z, item.radius ?? 4.5, time, item.value === 2);
          this.whirl(x, y, z, item.radius ?? 4.5, time);
          if (item.value === 2) { k.ring(x, y + .16, z, .5, (item.radius ?? 6) * 2.2, time + .05, .35, BLOOD.rim, 0x5a0612, .2, 'flat'); this.grade(0x8a0a1a, .18, .4); }
          break;
        case 'pillar':
          this.arts.hellfire(x, y, z, item.radius ?? 2.3, time, item.sub === 'evolved', this.lensDim(x, y, z));
          this.pillar(x, y, z, item.radius ?? 2.3, time + .22, item.sub === 'evolved' ? PURGATORY : EMBER, pillarDim);
          if (item.value) this.burning.push({ x, z, radius: item.radius ?? 2.3, until: time + item.value, next: time });
          break;
        case 'meteor':
          this.arts.meteor(x, z, item.radius ?? 5, Math.max(time + .3, item.value ?? time + .8), time, item.sub === 'evolved');
          this.meteors.push({ x, z, radius: item.radius ?? 5, lands: Math.max(time + .3, item.value ?? time + .8), started: time,
            fx: x + 7 * (Math.random() < .5 ? 1 : -1), fy: 26, fz: z - 5, last: time });
          k.ring(x, .08, z, (item.radius ?? 5) * 1.9, (item.radius ?? 5) * 2.05, time, Math.max(.3, (item.value ?? time + .8) - time), 0xffd0a0, EMBER.rim, .35, 'flat');
          break;
        case 'frost':
          this.arts.frost(x, y, z, item.radius ?? 7, time, item.sub === 'evolved');
          this.frost(x, y, z, item.radius ?? 7, time);
          if (item.hero && item.text === 'aokiji') this.arts.decal(3, x, y + .07, z, (item.radius ?? 4.5) * 1.15, ART_PALETTE.ice, time, 1.5, { ink: true, spin: Math.random() * 6.28 });
          if (item.sub === 'evolved') { k.ring(x, y + .1, z, 1, (item.radius ?? 14) * 2.1, time, .7, 0xa8e2ff, ICE.rim, .5, 'flat'); this.grade(0x9fdcff, .25, .6); }
          break;
        case 'slash': {
          const points = item.points ?? [], share = Math.min(1, 1.6 / Math.sqrt(Math.max(1, points.length / 2))) * this.artBudget;
          for (let i = 0; i + 1 < points.length; i += 2) { this.arts.tear(points[i], points[i + 1], time, item.value === 2); this.slash(points[i], points[i + 1], item.value === 2 ? GOLD : item.value ? RIFT : VOID, time, share * .5); }
          break;
        }
        case 'smash': {
          const r = item.radius ?? .6, stone = item.text === 'grave' || item.text === 'rock';
          if (item.text === 'corpse') {
            this.soot(x, 0, z, 6, r * .5, 2.5, .6, time);
            for (let i = 0, n = k.n(14, 5); i < n; i++) {
              const a = Math.random() * Math.PI * 2, v = 2.5 + Math.random() * 5;
              const sp = k.sparks.spec;
              sp.reset(SPRITE.shard, time, .45 + Math.random() * .35).pos(x, .3 + Math.random() * .4, z).velocity(Math.cos(a) * v, 2.5 + Math.random() * 4.5, Math.sin(a) * v);
              sp.sized(.08 + Math.random() * .07, .05, .5).hot(0x8a0a12, 1).cool(0x2a0204, .95); sp.gravity = 16; sp.drag = .7; sp.spin = (Math.random() - .5) * 18; sp.rotation = Math.random() * 6.28; k.sparks.emit();
            }
            break;
          }
          k.debris.burst(k.n(stone ? 10 : 14, 4), x, .5, z, 0, 1, 0, stone ? 6 : 7.5, 1, stone ? .13 : .1, 0, 1.6);
          this.soot(x, 0, z, 8, r * .6, 3.5, .8, time);
          k.ring(x, .06, z, .3, r * 2.6 + 1, time, .3, 0xffffff, stone ? 0xb8b4ac : 0x9a6a3a, .15, 'flat');
          for (let i = 0, n = k.n(8, 3); i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 5;
            const sp = k.sparks.spec;
            sp.reset(SPRITE.shard, time, .5 + Math.random() * .3).pos(x, .5 + Math.random() * .6, z).velocity(Math.cos(a) * v, 3 + Math.random() * 4, Math.sin(a) * v);
            sp.sized(.07 + Math.random() * .06, .05, .5).hot(stone ? 0xd8d2c4 : 0xc08a4a, 1).cool(stone ? 0x5a5650 : 0x4a2a14, .9); sp.gravity = 14; sp.drag = .8; sp.spin = (Math.random() - .5) * 20; sp.rotation = Math.random() * 6.28; k.sparks.emit();
          }
          break;
        }
        case 'relic': this.relic(item, time); break;
        case 'hazard': if (item.enemy === 'rift' && item.sub === 'zeus') this.placeBolts.push({ x, z, at: item.value ?? time + 1 }); break;
        case 'rage':
          if (item.value) {
            k.ring(x, y + .1, z, .6, 7, time, .5, 0xffffff, BLOOD.rim, .3, 'flat');
            k.hitSpark(x, y + 1.2, z, BLOOD, 2, time); k.pulse(x, y + 1.4, z, BLOOD.light, 12, 10, time, .5);
            this.grade(0x8a0a1a, .5, .8);
          }
          break;
        default: break;
      }
    }
  }

  private boltDebris(x: number, y: number, z: number, el: typeof BOLT, time: number) {
    const k = this.kit, dim = this.lensDim(x, y, z) * this.artBudget;
    k.hitSpark(x, y + .7, z, el, 2, time);
    k.pulse(x, y + 2.5, z, el.light, 7 * dim, 11, time, .2);
    k.scorch(x, y + .02, z, 0, 1, 0, 1.4, time, .8);
  }

  private bolt(x: number, y: number, z: number, el: typeof BOLT, time: number, height = 13) {
    const k = this.kit, sp = k.sparks.spec;
    const dim = this.lensDim(x, y, z) * this.artBudget;
    const tx = x + (Math.random() - .5) * 3, tz = z + (Math.random() - .5) * 3;
    let ax = tx, ay = y + height, az = tz;
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, wander = (1 - t) * 1.2;
      const bx = i === steps ? x : tx + (x - tx) * t + (Math.random() - .5) * wander * 2;
      const by = y + height * (1 - t) + (i === steps ? .1 : 0);
      const bz = i === steps ? z : tz + (z - tz) * t + (Math.random() - .5) * wander * 2;
      _a.set(bx - ax, by - ay, bz - az); const length = _a.length(); _a.divideScalar(length || 1);
      const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
      sp.reset(SPRITE.glow, time, .2).pos(mx, my, mz).sized(.08, .07, .1).hot(0xffffff, 2.2 * dim); sp.orient = ORIENT.axial; sp.axis(_a.x, _a.y, _a.z); sp.stretch = length * .5 / .08; k.sparks.emit();
      sp.reset(SPRITE.glow, time, .28).pos(mx, my, mz).sized(.42, .5, .2).hot(el.rim, 1.3 * dim); sp.orient = ORIENT.axial; sp.axis(_a.x, _a.y, _a.z); sp.stretch = length * .5 / .42; k.sparks.emit();
      ax = bx; ay = by; az = bz;
    }
    k.hitSpark(x, y + .7, z, el, 2, time);
    k.ring(x, y + .06, z, .3, 3.2, time, .3, 0xffffff, el.rim, .2, 'flat');
    k.pulse(x, y + 2.5, z, el.light, 7 * dim, 11, time, .2);
    k.scorch(x, y + .02, z, 0, 1, 0, 1.4, time, .8);
  }

  private whirl(x: number, y: number, z: number, radius: number, time: number) {
    const k = this.kit, sp = k.sparks.spec;
    const dim = this.lensDim(x, y, z) * this.artBudget;
    k.ring(x, y + .12, z, .6, radius * 2, time, .3, BLOOD.spike, BLOOD.rim, .3, 'flat');
    k.ring(x, y + .2, z, .5, radius * 1.6, time, .24, BLOOD.rim, 0x5a0612, .15, 'flat');
    for (let i = 0, n = k.n(14, 6); i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * .3, r = radius * (.45 + Math.random() * .4);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, speed = 16 + Math.random() * 8;
      sp.reset(SPRITE.streak, time + Math.random() * .05, .22).pos(px, y + .7 + Math.random() * .8, pz).velocity(-Math.sin(a) * speed, 0, Math.cos(a) * speed);
      sp.orient = ORIENT.velocity; sp.sized(.07, .05, .5); sp.stretch = 7; sp.trail = .04; sp.drag = 3; sp.hot(BLOOD.spike, 1.4 * dim).cool(BLOOD.rim, .5); k.sparks.emit();
    }
    if (!INK_ON) for (let i = 0; i < k.n(3, 1); i++) { const a = Math.random() * Math.PI * 2, r = radius * .7; k.smoke(x + Math.cos(a) * r, y + .6, z + Math.sin(a) * r, Math.cos(a) * 1.5, .6, Math.sin(a) * 1.5, .9, time + .05, .7, 0x8a1020, 0x1a0206); }
    k.pulse(x, y + 1.2, z, BLOOD.light, 6 * dim, radius * 2.2, time, .3);
  }

  private pillar(x: number, y: number, z: number, radius: number, time: number, EMBER = EMBER_FIRE, dim = 1) {
    const k = this.kit, sp = k.sparks.spec;
    const lens = this.lensDim(x, y, z);
    dim *= lens * this.artBudget;
    if (lens > .45 && this.columns.length < 8) this.columns.push({ x, y, z, radius, born: time, tall: .6 + .4 * lens, heat: Math.min(.7, .3 + .4 * dim), tint: EMBER === EMBER_FIRE ? 0 : 1, seed: Math.random() });
    for (let i = 0, n = k.n(10, 4); i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius * .45;
      sp.reset(SPRITE.streak, time + Math.random() * .12, .35 + Math.random() * .25).pos(x + Math.cos(a) * r, y + .2, z + Math.sin(a) * r)
        .velocity(Math.cos(a) * 1.5, 9 + Math.random() * 7, Math.sin(a) * 1.5);
      sp.orient = ORIENT.velocity; sp.sized(.045, .03, .5); sp.stretch = 3; sp.trail = .03; sp.drag = 1.5; sp.gravity = -2; sp.hot(EMBER.spike, 1.2 * dim).cool(EMBER.rim, .3); k.sparks.emit();
    }
    k.hitSpark(x, y + .6, z, EMBER, 1, time);
    k.ring(x, y + .06, z, .3, radius * 2, time, .35, 0xffffff, EMBER.rim, .25, 'flat');
    k.pulse(x, y + 1.5, z, EMBER.light, 6 * dim, 8, time, .4);
    k.scorch(x, y + .02, z, 0, 1, 0, radius * 1.2, time, 1);
  }

  private frost(x: number, y: number, z: number, radius: number, time: number) {
    const k = this.kit, sp = k.sparks.spec;
    k.ring(x, y + .1, z, .8, radius * 2, time, .45, 0xffffff, ICE.rim, .4, 'flat');
    k.ring(x, y + .1, z, radius * 1.85, radius * 2.02, time + .3, .9, 0xe8f8ff, ICE.rim, .5, 'flat');
    for (let i = 0, n = k.n(Math.round(26 * this.artBudget), 6); i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 6;
      sp.reset(SPRITE.shard, time + Math.random() * .08, .5 + Math.random() * .3).pos(x + Math.cos(a) * .8, y + .5 + Math.random() * .6, z + Math.sin(a) * .8)
        .velocity(Math.cos(a) * v, 2 + Math.random() * 3, Math.sin(a) * v);
      sp.sized(.1 + Math.random() * .1, .07, .5).hot(ICE.spike, 1.3).cool(0xffffff, .4); sp.gravity = 9; sp.drag = 1; sp.spin = (Math.random() - .5) * 16; sp.rotation = Math.random() * 6.28; k.sparks.emit();
    }
    for (let i = 0, n = k.n(5, 2); i < n; i++) {
      const a = i / n * Math.PI * 2, r = radius * (.5 + Math.random() * .4), px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (this.lensDim(px, y, pz) < .55) continue;
      k.smoke(px, y + .2, pz, Math.cos(a) * .8, .25, Math.sin(a) * .8, 1.3, time + .1, .7, 0x9ab4c8, 0x2a3a4c);
    }
    k.pulse(x, y + 1.2, z, ICE.light, 6 * this.artBudget, radius * 2, time, .45);
  }

  private relic(item: FeedItem, time: number) {
    const k = this.kit, sp = k.sparks.spec, x = item.x ?? this.subject.x, y = item.y ?? this.subject.y, z = item.z ?? this.subject.z;
    switch (item.sub) {
      case 'getsuga': {
        const yaw = item.value ?? 0, dx = Math.sin(yaw), dz = Math.cos(yaw), reach = item.radius ?? 16;
        for (let d = 1.4; d < reach; d += 2.5) {
          const arc: { x: number; y: number; z: number }[] = [];
          for (let i = -4; i <= 4; i++) {
            const t = i / 4, bow = (1 - t * t) * 1.1, cx = x + dx * (d + bow), cz = z + dz * (d + bow);
            arc.push({ x: cx + dz * t * 1.9, y: y + (1 - t * t) * .35 - .15, z: cz - dx * t * 1.9 });
          }
          this.arts.crack(arc, time + d / 34, GETSUGA_INK, .95, .3);
        }
        k.pulse(x + dx * 2, y, z + dz * 2, BLOOD.light, 5, 8, time, .25);
        this.grade(0xd0203a, .22, .35);
        break;
      }
      case 'rokuogan': {
        const yaw = item.value ?? 0, dx = Math.sin(yaw), dz = Math.cos(yaw), reach = item.radius ?? 7;
        for (let i = 0; i < 4; i++) {
          const d = 1 + i * (reach - 1) / 3;
          k.ring(x + dx * d, y, z + dz * d, .3, 1.6 + d * .25, time + i * .035, .3, 0xffffff, SHOCK.rim, .14, 'plane', dx, 0, dz);
        }
        for (let i = 0, n = k.n(10, 4); i < n; i++) {
          const side = (Math.random() - .5) * 1.6, v = 16 + Math.random() * 10;
          sp.reset(SPRITE.streak, time + Math.random() * .05, .28).pos(x + dz * side, y + (Math.random() - .5) * .8, z - dx * side).velocity(dx * v, 0, dz * v);
          sp.orient = ORIENT.velocity; sp.sized(.05, .03, .5); sp.stretch = 6; sp.drag = 2; sp.hot(0xffffff, 1.6).cool(SHOCK.rim, .3); k.sparks.emit();
        }
        k.pulse(x + dx * 2, y, z + dz * 2, SHOCK.light, 7, 9, time, .3);
        this.screen?.impactFrame(.55, _p.set(x + dx * 2, y, z + dz * 2));
        break;
      }
      case 'mochi': {
        const [a, b] = item.points ?? [];
        if (!a || !b) break;
        this.arts.crack([a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + .08, z: (a.z + b.z) / 2 }, b], time, MOCHI_INK, 1.5, .4);
        k.hitSpark(b.x, b.y, b.z, MOCHI, 3, time);
        k.ring(b.x, b.y, b.z, .4, 3.4, time, .32, 0xffffff, MOCHI.rim, .16);
        k.pulse(b.x, b.y, b.z, MOCHI.light, 8, 8, time, .3);
        this.screen?.impactFrame(.5, _p.set(b.x, b.y, b.z));
        break;
      }
      case 'foresight':
        k.ring(x, y + 1.1, z, .3, 1.7, time, .35, 0xffffff, MOCHI.rim, .1);
        break;
      case 'quake':
        for (const end of item.points ?? []) {
          const dx = end.x - x, dz = end.z - z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, crack: { x: number; y: number; z: number }[] = [];
          for (let i = 0; i <= 5; i++) {
            const r = .3 + i * .72, off = i ? (Math.random() - .5) * .5 : 0;
            crack.push({ x: x + ux * r - uz * off, y: y + 1.15 + i * .16 + (i ? (Math.random() - .5) * .35 : 0), z: z + uz * r + ux * off });
          }
          this.arts.crack(crack, time, QUAKE_INK, .42);
        }
        this.arts.decal(0, x, (item.y ?? 0) + .07, z, 9, ART_PALETTE.gold, time, .5);
        this.arts.decal(3, x, (item.y ?? 0) + .06, z, 5, ART_PALETTE.gold, time, .4, { spin: Math.random() * 6.28 });
        k.ring(x, y + 1.2, z, .4, 5, time, .35, 0xffffff, QUAKE.rim, .18);
        this.soot(x, item.y ?? 0, z, 14, 1.2, 7, 1.2, time);
        k.pulse(x, y + 1.2, z, QUAKE.light, 10, 12, time, .4);
        this.screen?.impactFrame(.9, _p.set(x, y + 1, z)); this.screen?.chromaticPulse(.95);
        break;
      case 'howl':
        for (const [radius, delay] of [[2.6, .06], [5.4, .2], [8.2, .36]] as const) {
          for (let s = 0; s < 6; s++) {
            const from = (s + Math.random() * .3) / 6 * Math.PI * 2, span = Math.PI * 2 / 6 * .62, arc: { x: number; y: number; z: number }[] = [];
            for (let i = 0; i <= 4; i++) { const a = from + span * i / 4; arc.push({ x: x + Math.cos(a) * radius, y: (item.y ?? 0) + .5 + radius * .05, z: z + Math.sin(a) * radius }); }
            this.arts.crack(arc, time + delay, HOWL_INK, .3, .34, false);
          }
        }
        k.ring(x, y + 1.3, z, .4, 3.4, time, .3, 0xffffff, SHOCK.rim, .12);
        k.pulse(x, y + 1.2, z, SHOCK.light, 6, 10, time, .3);
        break;
      case 'claws': {
        const yaw = item.value ?? 0, floor = (item.y ?? 0) + .2;
        for (let i = -2; i <= 2; i++) {
          const a = yaw + i * .21, dx = Math.sin(a), dz = Math.cos(a), claw: { x: number; y: number; z: number }[] = [];
          for (let j = 0; j <= 4; j++) { const r = .8 + j * 2.8; claw.push({ x: x + dx * r + dz * (j % 2 ? .12 : -.12), y: floor + (j ? .05 : .5), z: z + dz * r - dx * (j % 2 ? .12 : -.12) }); }
          this.arts.crack(claw, time + .04 + Math.abs(i) * .03, CLAW_INK, .42, .55);
        }
        k.pulse(x, y + 1, z, BOLT.light, 5, 8, time, .25);
        break;
      }
      case 'cut': {
        const points = item.points ?? [], share = Math.min(1, 1.4 / Math.sqrt(Math.max(1, points.length / 2))) * this.artBudget;
        for (let i = 0; i + 1 < points.length; i += 2) { this.arts.crack([points[i], points[i + 1]], time, GETSUGA_INK, .32, .3, false); this.slash(points[i], points[i + 1], BLOOD, time, share); }
        break;
      }
      case 'shrine':
        if (item.hero && item.value) this.shrines.set(item.hero, item.value);
        k.ring(x, (item.y ?? 0) + .1, z, 1, SHRINE_REACH * 2, time, .6, 0xffffff, BLOOD.rim, .3, 'flat');
        this.grade(0xd81f3a, .35, .8);
        this.screen?.impactFrame(.7, _p.set(x, y + 1, z));
        break;
      case 'stop':
        k.ring(x, y + 1, z, .5, 60, time, .45, 0xffffff, GOLD.rim, .3, 'flat');
        k.ring(x, y + 1, z, .5, 24, time, .35, 0xffffff, GOLD.rim, .2);
        this.screen?.impactFrame(1, _p.set(x, y + 1, z));
        break;
      default: break;
    }
  }
  private readonly shrines = new Map<string, number>();
  private shrineBeat = 0;
  private domains(view: RunView | undefined, time: number) {
    if (!this.shrines.size) return;
    if (!view || view.phase === 'over') { this.shrines.clear(); return; }
    if (time < this.shrineBeat) return;
    this.shrineBeat = time + .45;
    for (const [hero, until] of this.shrines) {
      const at = view.party.findIndex(member => member.id === hero), spot = view.spots[at];
      if (view.time >= until || !spot || !view.party[at]?.awake) { this.shrines.delete(hero); continue; }
      this.arts.decal(1, spot.x, .07, spot.z, SHRINE_REACH, ART_PALETTE.blood, time, .95, { ink: true, spin: 1.1, alpha: .8 });
    }
  }
  private ventAt = 0;
  private wardAt = 0;
  private wardMark(view: RunView | undefined, time: number) {
    const ward = view?.ward;
    if (!ward || time < this.wardAt) return;
    this.wardAt = time + .45;
    this.arts.decal(1, ward.x, .07, ward.z, ward.radius, WARD_INK, time, .95, { ink: true, spin: ward.held ? 1.6 : .6, alpha: .85 });
    this.kit.ring(ward.x, .09, ward.z, ward.radius * 1.94, ward.radius * 2.04, time, .5, 0xffffff, ward.held ? GOLD.rim : WARD_INK.color, .3, 'flat');
    if (ward.held) this.kit.pulse(ward.x, 2, ward.z, GOLD.light, 5, ward.radius * 2, time, .5, .6);
  }
  private placeBolts: { x: number; z: number; at: number }[] = [];
  private ventsSeen = new Set<string>();
  private ventSmoke(view: RunView | undefined, time: number) {
    const vents = view?.vents;
    if (!vents?.length) { this.ventsSeen.clear(); return; }
    for (const vent of vents) {
      const key = `${vent.x},${vent.z}`;
      if (this.ventsSeen.has(key)) continue;
      this.ventsSeen.add(key);
      this.arts.decal(3, vent.x, .07, vent.z, 2.6, ART_PALETTE.fire, time, 2.2, { ink: true, spin: Math.random() * 6.28 });
      this.soot(vent.x, 0, vent.z, 10, .8, 5, 1, time);
      this.kit.ring(vent.x, .08, vent.z, .3, 4.4, time, .5, 0xffffff, EMBER.rim, .2, 'flat');
    }
    if (!view || view.phase === 'over' || time < this.ventAt) return;
    this.ventAt = time + .11;
    const vent = vents[Math.floor(Math.random() * vents.length)], k = this.kit;
    k.smoke(vent.x + (Math.random() - .5) * .5, .3, vent.z + (Math.random() - .5) * .5, (Math.random() - .5) * .3, 1.5 + Math.random() * .6, (Math.random() - .5) * .3, .55 + Math.random() * .4, time, 1.7, 0x3a2a22, 0x0c0806);
    if (Math.random() < .3) k.pulse(vent.x, .35, vent.z, EMBER.light, 3, 3.5, time, .45, .6);
  }
  private stopSince = -1;
  private stoppedTime(left: number | undefined, time: number) {
    const screen = this.screen;
    if (!left || left <= 0) { if (this.stopSince >= 0) { screen?.timeStop?.(0); this.stopSince = -1; } return; }
    if (this.stopSince < 0) this.stopSince = time;
    screen?.timeStop?.(Math.min(1, (time - this.stopSince) / .2) * Math.min(1, left / .3));
  }

  private slash(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, el: typeof VOID, time: number, share = 1) {
    const k = this.kit, sp = k.sparks.spec;
    _a.set(b.x - a.x, b.y - a.y, b.z - a.z); const length = _a.length(); if (length < .1) return; _a.divideScalar(length);
    const from = Math.min(.9, length * .3), part = (length - from) / 3;
    let lit = 0;
    for (let i = 0; i < 3; i++) {
      const mid = from + part * (i + .5), mx = a.x + _a.x * mid, my = a.y + _a.y * mid, mz = a.z + _a.z * mid;
      const dim = this.lensDim(mx, my - 1.5, mz) * share, half = part * .5;
      lit = Math.max(lit, dim);
      sp.reset(SPRITE.glow, time, .34).pos(mx, my, mz).sized(.3, .16, .15).hot(el.ink, 1).cool(el.ink, .85); sp.orient = ORIENT.axial; sp.axis(_a.x, _a.y, _a.z); sp.stretch = half / .3; k.sparks.emit();
      sp.reset(SPRITE.glow, time, .26).pos(mx, my, mz).sized(.05, .03, .1).hot(0xffffff, 2.2 * dim); sp.orient = ORIENT.axial; sp.axis(_a.x, _a.y, _a.z); sp.stretch = half / .05; k.sparks.emit();
      sp.reset(SPRITE.glow, time, .3).pos(mx, my, mz).sized(.2, .26, .2).hot(el.rim, 1.15 * dim); sp.orient = ORIENT.axial; sp.axis(_a.x, _a.y, _a.z); sp.stretch = half / .2; k.sparks.emit();
    }
    _b.set(a.x + _a.x * from, a.y + _a.y * from, a.z + _a.z * from); _p.set(b.x, b.y, b.z);
    k.crackle(_b, _p, .08, el, Math.max(2, Math.round(k.n(12, 4) * lit)), time);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2;
    k.pulse(mx, my + .5, mz, el.light, 6 * lit, 7, time, .2);
  }

  rage(x: number, y: number, z: number, time: number) {
    const k = this.kit;
    if (Math.random() < .35) {
      const a = Math.random() * Math.PI * 2, r = .25 + Math.random() * .3;
      k.smoke(x + Math.cos(a) * r, y + .2 + Math.random() * 1.5, z + Math.sin(a) * r, Math.cos(a) * .2, 1.4 + Math.random() * .8, Math.sin(a) * .2, .12 + Math.random() * .08, time, .5, 0xb0101e, 0x1a0204);
    }
  }

  contacts(events: readonly CombatEvent[], time: number) {
    const k = this.kit;
    this.audio.casts(events);
    for (const event of events) {
      const at = event.endpoint;
      if (event.kind === 'awaken' && event.actorId === this.selfId) this.audio.awakened();
      if (event.kind === 'hit' && !event.enemy && event.fighter && !isProc(event.move)) {
        const weapon = WEAPON[event.fighter];
        if (weapon) this.audio.weapon(weapon, event.slot === 'heavy' || event.slot === 'special' || event.slot === 'ultimate');
      }
      if (event.kind === 'hit' && at && isProc(event.move) && !isQuiet(event.move) && !SWEEPS.has(event.move!)) {
        const el = event.move === 'Thunder Chain' || event.move === 'Storm Ki' ? BOLT : event.move === 'Counter Blast' ? GOLD : event.move === 'Chain Reaction' || event.move === 'Burst Point' ? EMBER : event.move === 'Awakening Nova' ? BLOOD : SHOCK;
        k.hitSpark(at.x, at.y, at.z, el, 1, time);
      } else if (event.kind === 'hit' && at && SWEEPS.has(event.move!)) {
        if (time - this.victimAt > .1) { this.victimAt = time; this.victims = 0; }
        if (this.victims++ >= 3 || this.lensDim(at.x, at.y, at.z) < .5) continue;
        const el = event.move === "Heaven's Wrath" ? BOLT : event.move === 'Frost Prison' ? ICE : event.move === 'Dimension Slash' ? VOID : event.move === 'Crimson Whirlwind' ? BLOOD : event.move === 'Flying Slash' ? STEEL : EMBER;
        const sp = k.sparks.spec, size = .35 + Math.random() * .4;
        sp.reset(SPRITE.burst, time, .16).pos(at.x, at.y, at.z).sized(size * .4, size, .2).hot(el.spike, 1).cool(el.rim, .8); sp.rotation = Math.random() * 6.28; k.sparks.emit();
      } else if (event.kind === 'hit' && at && event.move === 'Burn') {
        const sp = k.sparks.spec;
        for (let i = 0; i < 3; i++) {
          sp.reset(SPRITE.streak, time + i * .04, .4 + Math.random() * .25).pos(at.x + (Math.random() - .5) * .5, at.y + (Math.random() - .5) * .6, at.z + (Math.random() - .5) * .5)
            .velocity((Math.random() - .5) * .8, 2.2 + Math.random() * 1.6, (Math.random() - .5) * .8);
          sp.orient = ORIENT.velocity; sp.sized(.035, .02, .5); sp.stretch = 3; sp.gravity = -1; sp.drag = 1.2; sp.hot(0xffb060, 1.4).cool(0xb0300a, .4); k.sparks.emit();
        }
        if (Math.random() < .35) k.smoke(at.x, at.y + .5, at.z, 0, 1.2, 0, .22, time, .6, 0x3a2e28, 0x0a0606);
      } else if (event.kind === 'eliminated' && event.targetId && event.origin === undefined && at === undefined) {
      }
    }
  }
  aura(x: number, y: number, z: number, time: number) {
    const k = this.kit;
    if (Math.random() < .22) {
      const a = Math.random() * Math.PI * 2, r = .3 + Math.random() * .25;
      k.smoke(x + Math.cos(a) * r, y + .3 + Math.random() * 1.3, z + Math.sin(a) * r, Math.cos(a) * .15, 1.1 + Math.random() * .6, Math.sin(a) * .15, .09 + Math.random() * .06, time, .45, 0x4a1aa8, 0x0c0418);
    }
    if (Math.random() < .025) k.ring(x, y + .05, z, .5, 1.6, time, .45, 0xb898ff, RIFT.rim, .08, 'flat');
  }

  private lastSlain = 0;
  private runKills = 0;
  private dressed(view: RunView | undefined) {
    const cosmetics = gameCosmetics();
    if (!cosmetics || !view) return;
    cosmetics.eye = MAP_VIEW.yaw;
    for (const member of view.party) cosmetics.react(member.id, { kills: member.kills, style: member.style, awake: member.awake });
    if (view.kills < this.runKills) this.lastSlain = 0;
    this.runKills = view.kills;
    const slain = view.slain;
    if (!slain) return;
    for (let i = 0; i + 3 < slain.length; i += 4) {
      const serial = slain[i];
      if (serial <= this.lastSlain) continue;
      this.lastSlain = serial;
      const code = slain[i + 1], member = view.party.find(each => each.seat === (code & 7));
      if (!member) continue;
      const x = slain[i + 2] / 10, z = slain[i + 3] / 10, played = cosmetics.killed(member.id, x, 0, z, code >= 8);
      const sound = played?.full ? KILL_SOUND[played.effect] : undefined;
      if (sound) this.audio.cosmetic(sound, Math.hypot(x - this.lens.x, z - this.lens.z));
    }
  }

  death(x: number, y: number, z: number, height: number, time: number, boss = false) {
    const k = this.kit;
    k.hitSpark(x, y + height * .55, z, boss ? GOLD : RIFT, boss ? 3 : 1, time);
    k.ring(x, y + .06, z, .3, boss ? 9 : 2.4, time + .05, boss ? .7 : .35, 0xffffff, boss ? GOLD.rim : RIFT.rim, .18, 'flat');
    if (boss) { crater(k, x, y, z, true, time, GOLD); k.pulse(x, y + 2, z, 0xffffff, 16, 14, time, .9, 3); }
    if (boss) { const cosmetics = gameCosmetics(), ko = cosmetics?.wornBy(cosmetics.self)?.ko; if (ko) cosmetics!.knockout(ko, x, y, z, height, document.querySelector('#sv-endpage:not(.hidden)') ? 1.85 : 0); }
  }

  private readonly arenaDust = new Set<THREE.Material>();
  private readonly arenaChips = new Set<THREE.MeshBasicMaterial>();
  private arenaSeen = 0;
  private sooted = false;
  private sootArena(on: boolean) {
    const now = performance.now();
    if (on && now > this.arenaSeen) {
      this.arenaSeen = now + 2000;
      for (const group of this.scene.children) {
        if (!group.name.startsWith('combat-')) continue;
        for (const child of group.children) {
          const material = (child as THREE.Mesh).material;
          if (!material || Array.isArray(material)) continue;
          if (child.name === 'impact-ground-dust' && !this.arenaDust.has(material)) { this.arenaDust.add(material); material.visible = !this.sooted; }
          if (child.name === 'impact-ground-debris' && material instanceof THREE.MeshBasicMaterial && !this.arenaChips.has(material)) {
            this.arenaChips.add(material); if (this.sooted) material.color.setHex(0x2a2624);
          }
        }
      }
    }
    if (on === this.sooted) return;
    this.sooted = on;
    for (const material of this.arenaDust) material.visible = !on;
    for (const material of this.arenaChips) material.color.setHex(on ? 0x2a2624 : 0x6c604b);
    (this.kit.debris.mesh.material as THREE.MeshToonMaterial).color.setHex(on ? 0x55504c : 0xffffff);
  }

  private party(view: RunView | undefined, time: number, dt: number, camera: THREE.Camera) {
    const fighting = !!view && (view.phase === 'fight' || view.phase === 'draft');
    const party = fighting ? view!.party : [];
    const aura = SELF_AURA.colour !== SELF_COLOUR;
    const subjects: GlowSubject[] = party.map((member, i) => ({ id: member.id, colour: i ? seatColour(member.seat) : SELF_AURA.colour,
      strength: i ? 1 : aura ? .8 : .55, ring: i > 0, down: member.down }));
    const renderer = this.screen?.renderer;
    if (renderer) { renderer.getDrawingBufferSize(_size); this.glow.resize(_size.x, _size.y); }
    this.glow.update(subjects, time, dt);
    const marks: MarkSubject[] = [];
    for (let i = 1; i < party.length; i++) {
      const member = party[i], at = this.glow.where(member.id);
      if (at) marks.push({ id: member.id, name: member.name, fighter: member.fighter, colour: seatColour(member.seat), hp: member.hp, maxHp: member.maxHp, down: member.down, rescue: member.rescue, at });
    }
    ALLY_MARKS.current?.place(marks, camera, fighting ? this.subject : undefined);
    for (const member of party) {
      if (!member.joining) continue;
      const at = this.glow.where(member.id);
      if (!at) continue;
      this.kit.lights.request(at.x, at.y + 1.8, at.z, 0xa050ff, 26, 6, 1);
      if (time < (this.riftPulse.get(member.id) ?? 0)) continue;
      this.riftPulse.set(member.id, time + .45);
      this.kit.ring(at.x, at.y + .06, at.z, .45, 1.6, time, .9, 0xe8d8ff, 0x8a3ae0, .25, 'flat');
    }
    const forks = fighting ? view!.forks : undefined;
    this.forks.update(forks, time, camera);
    const ward = fighting && !forks?.length ? view!.ward : undefined;
    PATH_MARKS.current?.place(ward ? [{ kind: 'ward', x: ward.x, z: ward.z, votes: ward.held ? 1 : 0 }] : forks, camera, view?.party.length ?? 1);
    THREAT_MARKS.current?.place(camera, view?.spots[0], view?.bosses, fighting && !view!.party[0]?.down);
    if (fighting && !party[0]?.down && this.subject.y > -5) this.kit.lights.request(this.subject.x, this.subject.y + 4.6, this.subject.z, 0xffe2bc, 44, 13, 1.1);
  }

  update(view: RunView | undefined, time: number, dt: number, camera: THREE.Camera) {
    if (view) watchGlitches(this.screen?.renderer?.domElement, () => !!activeRift());
    try { this.frame(view, time, dt, camera); } catch (error) { glitch(error, 'effects'); }
  }
  private selfId = '';
  private frame(view: RunView | undefined, time: number, dt: number, camera: THREE.Camera) {
    if (view && view.phase !== 'lobby') {
      const fighting = view.phase === 'fight' || view.phase === 'draft';
      const boss = fighting && (view.roundState === 'entrance' || view.roundState === 'battle' || view.roundState === 'interlude');
      riftMoment(seriesOfUniverse(view.guardian), boss ? 'boss' : 'hunt', view.coming ?? view.round);
    }
    if (view?.party[0]) this.selfId = view.party[0].id;
    this.lens.copy(camera.position);
    camera.getWorldDirection(_look);
    MAP_VIEW.yaw = Math.atan2(_look.x, _look.z);
    this.sootArena(!!view && !!activeRift());
    if (view?.phase === 'fight' && activeRift() && performance.now() > this.nextRelease) { this.nextRelease = performance.now() + 5000; releaseHidden(this.scene, ['MangaHarborEnvironment']); }
    if (view?.round) seeLens(this.lens.x, this.lens.z, this.subject.x, this.subject.z);
    this.activeUntil = performance.now() + 400;
    this.prebuildAhead(view);
    this.uploadNextTexture();
    if (performance.now() > this.nextPhantomLook) { this.nextPhantomLook = performance.now() + 1000; this.hookPhantoms(); }
    this.audio.update(view, time, dt);
    this.mood(view, time);
    if (INK_ON) inkColour(!!view?.party[0]?.awake && view.phase !== 'over', Math.min(dt, .1));
    if (view?.round) activeRift()?.escalate((view.location?.progress ?? 0) + Math.min(.4, view.loop * .2), dt);
    MARKS.clear();
    for (const boss of view?.bosses ?? []) if (boss.hp > 0) MARKS.set(boss.id, boss.champion ? 0xb07a3a : RANK_MARK[boss.rank ?? 'F'] ?? 0x9aa0a8);
    for (const fall of activeRift()?.takeCollapses() ?? []) {
      const k = this.kit, dx = Math.sin(fall.angle), dz = Math.cos(fall.angle), land = time + .85;
      for (let n = 0; n < 7; n++) {
        const along = (n / 6) * fall.height * .95, across = (Math.random() - .5) * fall.size;
        k.smoke(fall.x + dx * along + dz * across, (fall.y ?? 0) + .6 + Math.random() * 1.6, fall.z + dz * along - dx * across, dx * 2.4 + (Math.random() - .5) * 2, .8 + Math.random(), dz * 2.4 + (Math.random() - .5) * 2,
          fall.size * .7 + fall.height * .25 + Math.random() * 2, land + n * .05, 2.6 + Math.random() * 1.2, 0x5a4a42, 0x161010);
      }
      this.audio.collapse(Math.hypot(fall.x - this.lens.x, fall.z - this.lens.z));
    }
    for (const p of this.portals) {
      const age = time - p.born;
      if (age < 0 || age > p.life) { p.mesh.visible = p.slit.visible = false; continue; }
      const open = age < .22 ? age / .22 : age > p.life - .3 ? Math.max(0, (p.life - age) / .3) : 1;
      p.uniforms.uOpen.value = open; p.uniforms.uTime.value = time;
      p.mesh.scale.setScalar(p.radius * (1 + (1 - open) * .3));
      _p.copy(camera.position).sub(p.slit.position); p.slit.rotation.set(0, Math.atan2(_p.x, _p.z), 0);
      p.slit.scale.set(p.radius * .8, Math.min(1.4, .6 + p.radius * .35), 1);
    }
    this.fly(time);
    this.stoppedTime(view?.stopped, time);
    this.domains(view, time);
    this.ventSmoke(view, time);
    this.wardMark(view, time);
    for (let i = this.placeBolts.length - 1; i >= 0; i--) {
      const bolt = this.placeBolts[i];
      if (time < bolt.at) continue;
      this.placeBolts.splice(i, 1);
      this.arts.lightning(bolt.x, 0, bolt.z, time, false); this.boltDebris(bolt.x, 0, bolt.z, BOLT, time);
      this.screen?.impactFrame(.45, _p.set(bolt.x, 1.5, bolt.z));
    }
    this.arts.density = this.artBudget;
    this.arts.update(time);
    const ringOn = !!view && view.phase === 'fight' && this.subject.y > -5;
    const ru = this.heroRingUniforms; ru.uTime.value = time;
    ru.uAlpha.value = Math.max(0, Math.min(.7, ru.uAlpha.value + (ringOn ? dt * 3 : -dt * 4)));
    this.heroRing.visible = ru.uAlpha.value > 0;
    if (this.heroRing.visible) this.heroRing.position.set(this.subject.x, Math.max(0, this.subject.y) + .05, this.subject.z);
    this.party(view, time, dt, camera);
    this.dressed(view);
    if (!view) { this.drops.clear(); this.blades.count = 0; return; }
    this.drops.update(view.orbs, time, dt, this.lens);
    let b = 0;
    this.bladeTrail += dt;
    for (let i = 0; i < view.blades.length && b < BLADES; i++) {
      const blade = view.blades[i], next = view.blades[(i + 1) % view.blades.length];
      void next;
      const angle = Math.atan2(blade.x, blade.z);
      _q.setFromAxisAngle(_up, angle + time * 3.4);
      _m.compose(_p.set(blade.x, blade.y + Math.sin(time * 6 + i) * .08, blade.z), _q, _s.setScalar(1));
      this.blades.setMatrixAt(b++, _m);
      if (this.bladeTrail > .03) this.kit.pulse(blade.x, blade.y, blade.z, 0x6fd8ff, .8, 2.5, time, .08, .5);
    }
    if (this.bladeTrail > .03) this.bladeTrail = 0;
    this.blades.count = b; this.blades.instanceMatrix.needsUpdate = true;
  }

  private fly(time: number) {
    const k = this.kit, sp = k.sparks.spec;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      if (time >= m.lands) {
        this.meteors.splice(i, 1);
        k.hitSpark(m.x, .8, m.z, EMBER, 3, time);
        k.ring(m.x, .1, m.z, .6, m.radius * 2.3, time, .45, 0xffffff, EMBER.rim, .35, 'flat');
        this.soot(m.x, 0, m.z, 12, m.radius * .5, 9, 1.4, time);
        for (let j = 0; j < k.n(4, 2); j++) { const a = (j + Math.random() * .5) / 4 * Math.PI * 2; k.smoke(m.x + Math.cos(a) * m.radius * .4, .6, m.z + Math.sin(a) * m.radius * .4, Math.cos(a) * 2.2, 1.6, Math.sin(a) * 2.2, 1.5, time + .05, .9, CHARCOAL, CHARCOAL_SHADE); }
        k.pulse(m.x, 2.5, m.z, EMBER.light, 22, m.radius * 3, time, .6, 3);
        k.scorch(m.x, .02, m.z, 0, 1, 0, m.radius * 1.4, time, 1.2);
        this.screen?.impactFrame(.45, _p.set(m.x, 1, m.z));
        continue;
      }
      const t = Math.max(0, Math.min(1, (time - m.started) / Math.max(.05, m.lands - m.started))), e = t * t;
      const px = m.fx + (m.x - m.fx) * e, py = m.fy * (1 - e), pz = m.fz + (m.z - m.fz) * e;
      if (time - m.last > .03) {
        m.last = time;
        k.smoke(px, py, pz, 0, .4, 0, 1.2, time, .6, 0xff8a3a, 0x3a1206);
        sp.reset(SPRITE.streak, time, .18).pos(px, py, pz).velocity((m.fx - m.x) * .5, m.fy * .5, (m.fz - m.z) * .5);
        sp.orient = ORIENT.velocity; sp.sized(.5, .3, .3); sp.stretch = 5; sp.drag = 2; sp.hot(EMBER.spike, 2).cool(EMBER.rim, .3); k.sparks.emit();
      }
    }
    for (let i = this.burning.length - 1; i >= 0; i--) {
      const b = this.burning[i];
      if (time >= b.until) { this.burning.splice(i, 1); continue; }
      if (time < b.next) continue;
      b.next = time + .16;
      const dim = this.lensDim(b.x, 0, b.z);
      if (dim < .35) continue;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * b.radius;
      sp.reset(SPRITE.streak, time, .4 + Math.random() * .3).pos(b.x + Math.cos(a) * r, .3, b.z + Math.sin(a) * r).velocity((Math.random() - .5) * 1.2, 2.5 + Math.random() * 2.5, (Math.random() - .5) * 1.2);
      sp.orient = ORIENT.velocity; sp.sized(.03, .02, .5); sp.stretch = 1.6; sp.gravity = -1; sp.drag = 1.2; sp.hot(EMBER.spike, 1.1 * dim).cool(EMBER.rim, .2); k.sparks.emit();
    }
    this.fire(time);
  }

  private fire(time: number) {
    const f = this.fires;
    f.begin(time);
    for (let i = this.columns.length - 1; i >= 0; i--) {
      const c = this.columns[i], age = time - c.born;
      if (age > .65) { this.columns.splice(i, 1); continue; }
      const heat = c.heat * (age < .08 ? age / .08 : 1 - THREE.MathUtils.smoothstep(age, .25, .65)), t = c.tall, w = .75 * t;
      f.add(c.x, c.y, c.z, w, heat, c.seed, c.tint);
      f.add(c.x, c.y + .85 * t, c.z, w * .75, heat * .9, c.seed + .31, c.tint);
      f.add(c.x, c.y + 1.5 * t, c.z, w * .5, heat * .8, c.seed + .57, c.tint);
      for (let j = 0; j < 2; j++) {
        const a = c.seed * 6.283 + j * 3.14;
        f.add(c.x + Math.cos(a) * w * .45, c.y, c.z + Math.sin(a) * w * .45, w * .55, heat * .7, c.seed + .13 * (j + 1), c.tint);
      }
    }
    for (const b of this.burning) {
      const dim = this.lensDim(b.x, 0, b.z);
      if (dim < .35) continue;
      const heat = .75 * dim * Math.min(1, (b.until - time) / .6);
      const n = Math.min(5, 2 + Math.round(b.radius));
      for (let j = 0; j < n; j++) {
        const h = Math.sin((b.x * 12.9898 + b.z * 78.233 + j * 37.719)) * 43758.5453, u = h - Math.floor(h);
        const a = u * 6.283 + j * 2.4, r = Math.sqrt((j + .5) / n) * b.radius * .7;
        f.add(b.x + Math.cos(a) * r, 0, b.z + Math.sin(a) * r, .35 + u * .3, heat, u);
      }
    }
    f.end();
  }

  dispose() {
    this.fires.dispose(); this.heroRing.removeFromParent(); this.heroRing.geometry.dispose(); (this.heroRing.material as THREE.Material).dispose();
    for (const { ring, arc } of this.rescues) { ring.removeFromParent(); arc.removeFromParent(); (ring.material as THREE.Material).dispose(); (arc.material as THREE.Material).dispose(); arc.geometry.dispose(); }
    this.rescues[0]?.ring.geometry.dispose();
    for (const p of this.portals) { p.mesh.removeFromParent(); p.slit.removeFromParent(); (p.mesh.material as THREE.Material).dispose(); (p.slit.material as THREE.Material).dispose(); }
    this.drops.dispose(); this.blades.removeFromParent(); this.blades.dispose();
  }
}
