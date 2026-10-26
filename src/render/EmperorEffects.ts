import * as THREE from 'three';
import { armoryDraws } from './vfx/armory/drawn';
import type {CombatEvent, FighterId} from '../game/types';
import type {Fighter} from './Fighter';
import {MOVES} from '../game/moves';
import {rushMove} from '../game/awakening';
import {comboMove, type ComboKey} from '../game/combos';
import type {MoveDefinition} from '../game/moves';
import {ElectricKit} from './signature/ElectricKit';
import {GLOW, RING, STAR} from './signature/GlowBatch';
import {slashWaveMaterial, applySlashStyle, ENERGY, DARK, SLASH, type SlashStyle} from './signature/SlashWave';
import {ABYSS, BLACK, BLOOD, FIRE as FLAME_FIRE, flamePalette, flameSpriteGeometry, flameSpriteMaterial} from './signature/FlameSprites';
import {SIGNATURE, involvesLocal} from './signature/context';
import {COMBO_KEYS} from '../game/combos';
import {DIZZY_SECONDS} from '../game/moves';
import {GhostShell} from './signature/GhostShell';
import {whiffGone} from './signature/ultimateClock';
import {MalevolentShrineDomain} from './shop/MalevolentShrine';
import {KyokaDecoy} from './shop/KyokaSuigetsu';
import {BladeWhirl} from './shop/BladeWhirl';
import {CrowFlock} from './shop/CrowFlock';
import {VfxKit, DUST_LIT, DUST_SHADE, DREAM_IMPACT } from './vfx/VfxKit';
import {MARK} from './vfx/GroundMarks';
import {SPRITE, ORIENT} from './vfx/SparkField';
import {ghostTint, enderElement, type Element} from './vfx/palette';

const SUSANOO_TINT: Partial<Record<FighterId, { body: number; rim: number }>> = {
  itachi: { body: 0xc8341e, rim: 0xff9a6a }, madara: { body: 0x2a52d8, rim: 0x8cc8ff } };

type Emperor = 'kaido' | 'whitebeard' | 'shanks' | 'roger' | 'aizen' | 'sukuna' | 'griffith' | 'meruem' | 'goku-black' | 'jiren' | 'golden-frieza'
  | 'gohan-beast' | 'saitama' | 'akaza' | 'itachi' | 'madara' | 'tanjiro' | 'levi' | 'sung-jinwoo' | 'gon';
const EMPERORS: ReadonlySet<FighterId> = new Set<FighterId>(['kaido', 'whitebeard', 'shanks', 'roger', 'aizen', 'sukuna', 'griffith', 'meruem', 'goku-black', 'jiren', 'golden-frieza',
  'gohan-beast', 'saitama', 'akaza', 'itachi', 'madara', 'tanjiro', 'levi', 'sung-jinwoo', 'gon']);
const COLOR: Record<Emperor, {glow: THREE.Color; light: THREE.Color}> = {
  kaido: {glow: new THREE.Color(1.35, .42, 2.7), light: new THREE.Color(.9, .4, 1.6)},
  whitebeard: {glow: new THREE.Color(2.3, 2.7, 3.1), light: new THREE.Color(1.2, 1.5, 1.9)},
  shanks: {glow: new THREE.Color(3.0, .22, .32), light: new THREE.Color(1.5, .2, .25)},
  roger: {glow: new THREE.Color(3.0, 1.9, .42), light: new THREE.Color(1.6, 1.0, .25)},
  aizen: {glow: new THREE.Color(1.9, .9, 3.4), light: new THREE.Color(1.0, .5, 1.9)},
  sukuna: {glow: new THREE.Color(3.3, .35, .42), light: new THREE.Color(1.7, .2, .25)},
  griffith: {glow: new THREE.Color(2.5, 2.8, 3.4), light: new THREE.Color(1.3, 1.45, 1.9)},
  meruem: {glow: new THREE.Color(.55, 3.2, 1.5), light: new THREE.Color(.3, 1.7, .8)},
  'goku-black': {glow: new THREE.Color(3.2, .9, 2.4), light: new THREE.Color(1.7, .5, 1.3)},
  jiren: {glow: new THREE.Color(3.3, .45, .38), light: new THREE.Color(1.8, .25, .2)},
  'golden-frieza': {glow: new THREE.Color(3.3, 2.3, .55), light: new THREE.Color(1.8, 1.2, .3)},
  'gohan-beast': {glow: new THREE.Color(2.9, 2.3, 3.3), light: new THREE.Color(1.5, 1.15, 1.8)},
  saitama: {glow: new THREE.Color(3.3, 3.0, 2.0), light: new THREE.Color(1.8, 1.6, 1.0)},
  akaza: {glow: new THREE.Color(3.3, 1.2, 2.2), light: new THREE.Color(1.8, .6, 1.2)},
  itachi: {glow: new THREE.Color(3.2, .25, .32), light: new THREE.Color(1.7, .15, .2)},
  madara: {glow: new THREE.Color(3.2, .35, .4), light: new THREE.Color(1.7, .2, .25)},
  tanjiro: {glow: new THREE.Color(1.0, 2.4, 3.4), light: new THREE.Color(.5, 1.3, 1.9)},
  levi: {glow: new THREE.Color(2.6, 3.2, 2.8), light: new THREE.Color(1.3, 1.7, 1.4)},
  'sung-jinwoo': {glow: new THREE.Color(1.9, .9, 3.4), light: new THREE.Color(1.0, .45, 1.9)},
  gon: {glow: new THREE.Color(3.4, 2.3, .55), light: new THREE.Color(1.9, 1.25, .3)},
};
const DEATH = new THREE.Color(3.2, .7, 2.8), DEATH_LIGHT = new THREE.Color(1.7, .35, 1.5), DEATH_BALL_RED = new THREE.Color(3.4, .9, .3);
const BEAST_RIM = new THREE.Color(2.9, .55, 1.7), MASENKO_GOLD = new THREE.Color(3.4, 2.8, .7), MASENKO_LIGHT = new THREE.Color(1.9, 1.5, .35);
const SPIRAL = new THREE.Color(2.1, .7, 3.3);
const SERIOUS = new THREE.Color(3.4, .7, .35);
const COMPASS = new THREE.Color(1.6, 2.4, 3.4);
const SHARINGAN = new THREE.Color(3.3, .2, .26), TSUKUYOMI = new THREE.Color(2.4, .1, .14), AMATERASU = new THREE.Color(1.1, .3, 1.6);
const SUSANOO = new THREE.Color(3.3, 1.1, .45);
const PERFECT_SUSANOO = new THREE.Color(1.1, 1.9, 3.4), WATER_RIM = new THREE.Color(1.0, 2.4, 3.4), SUN = new THREE.Color(3.4, 1.5, .4);
const WINGS = new THREE.Color(1.4, 3.0, 2.0), SHADOW = new THREE.Color(1.5, .55, 3.2);
const FIRE = new THREE.Color(3.4, 1.3, .35), FIRE_LIGHT = new THREE.Color(1.8, .7, .2);
const HALO = 9;
const CUT_RED = new THREE.Color(3.2, 1.05, .95);
const CUT: Record<Emperor, SlashStyle> = {
  kaido: {mode: ENERGY, edge: new THREE.Color(2.4, 1.6, 3.2), body: new THREE.Color(.55, .2, 1.1), glow: new THREE.Color(.35, .1, .8)},
  whitebeard: {mode: ENERGY, edge: new THREE.Color(2.6, 3.0, 3.3), body: new THREE.Color(.6, .85, 1.3), glow: new THREE.Color(.25, .45, .9)},
  shanks: {mode: DARK, edge: new THREE.Color(3.2, .35, .4), body: new THREE.Color(.03, .004, .008), glow: new THREE.Color(1.0, .06, .08)},
  roger: {mode: DARK, edge: new THREE.Color(3.2, 2.2, .55), body: new THREE.Color(.03, .02, .004), glow: new THREE.Color(1.0, .62, .1)},
  aizen: {mode: DARK, edge: new THREE.Color(2.7, 2.1, 3.4), body: new THREE.Color(.04, .01, .07), glow: new THREE.Color(.6, .25, 1.1)},
  sukuna: {mode: ENERGY, edge: new THREE.Color(3.4, .9, .9), body: new THREE.Color(1.2, .1, .15), glow: new THREE.Color(.9, .05, .1)},
  griffith: {mode: ENERGY, edge: new THREE.Color(3.1, 3.2, 3.5), body: new THREE.Color(.75, .82, 1.3), glow: new THREE.Color(.3, .38, .95)},
  meruem: {mode: ENERGY, edge: new THREE.Color(2.4, 3.4, 2.8), body: new THREE.Color(.2, 1.1, .55), glow: new THREE.Color(.08, .85, .35)},
  'goku-black': {mode: ENERGY, edge: new THREE.Color(3.4, 1.8, 3.0), body: new THREE.Color(1.2, .25, .9), glow: new THREE.Color(.9, .1, .6)},
  jiren: {mode: ENERGY, edge: new THREE.Color(3.4, 1.1, .9), body: new THREE.Color(1.2, .12, .1), glow: new THREE.Color(.95, .05, .04)},
  'golden-frieza': {mode: ENERGY, edge: new THREE.Color(3.4, 2.8, 1.4), body: new THREE.Color(1.3, .8, .12), glow: new THREE.Color(.9, .5, .05)},
  'gohan-beast': {mode: ENERGY, edge: new THREE.Color(3.3, 3.0, 3.4), body: new THREE.Color(1.0, .45, 1.1), glow: new THREE.Color(.7, .15, .6)},
  saitama: {mode: ENERGY, edge: new THREE.Color(3.4, 3.2, 2.6), body: new THREE.Color(1.2, .9, .4), glow: new THREE.Color(.8, .5, .1)},
  akaza: {mode: ENERGY, edge: new THREE.Color(3.4, 2.4, 3.0), body: new THREE.Color(1.2, .3, .7), glow: new THREE.Color(.8, .1, .45)},
  itachi: {mode: DARK, edge: new THREE.Color(3.3, .3, .36), body: new THREE.Color(.02, .003, .005), glow: new THREE.Color(.95, .04, .06)},
  madara: {mode: DARK, edge: new THREE.Color(3.3, .35, .4), body: new THREE.Color(.03, .004, .006), glow: new THREE.Color(1.0, .06, .08)},
  tanjiro: {mode: ENERGY, edge: new THREE.Color(2.6, 3.2, 3.4), body: new THREE.Color(.3, .9, 1.6), glow: new THREE.Color(.1, .5, 1.1)},
  levi: {mode: ENERGY, edge: new THREE.Color(3.2, 3.4, 3.3), body: new THREE.Color(.8, 1.1, .95), glow: new THREE.Color(.3, .6, .45)},
  'sung-jinwoo': {mode: DARK, edge: new THREE.Color(2.4, 1.6, 3.4), body: new THREE.Color(.03, .01, .06), glow: new THREE.Color(.6, .25, 1.2)},
  gon: {mode: ENERGY, edge: new THREE.Color(3.4, 3.1, 1.8), body: new THREE.Color(1.5, .95, .25), glow: new THREE.Color(.95, .55, .08)},
};
const SUN_CUT: SlashStyle = {mode: ENERGY, edge: new THREE.Color(3.4, 2.6, 1.2), body: new THREE.Color(1.6, .5, .1), glow: new THREE.Color(1.1, .25, .04)};
const ECLIPSE = new THREE.Color(.95, .32, 1.7), BRAND = new THREE.Color(3.2, .2, .3);
const WIND: SlashStyle = {mode: ENERGY, edge: new THREE.Color(2.8, 2.9, 3.2), body: new THREE.Color(.75, .7, 1.3), glow: new THREE.Color(.3, .25, .7)};
const CUTS = 10, CUT_SECONDS = .22;
const CRACKS = 8, CRACK_SECONDS = .7;
const RINGS = 6, RING_SECONDS = .6;
const DOMES = 4, DOME_OPEN = .3, DOME_SECONDS = .9;
const STRIKES = 4, STRIKE_SECONDS = .45;
const FLASHES = 6, FLASH_SECONDS = .3;
const BEAMS = 24, BEAM_SECONDS = .16;

interface Cut {mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; since: number; seconds: number; active: boolean}
interface Crack {center: THREE.Vector3; normal: THREE.Vector3; since: number; seconds: number; seed: number; reach: number; count: number; active: boolean; color: THREE.Color}
interface Ring {mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; since: number; radius: number; active: boolean}
interface Dome {mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>; actorId: string; since: number; radius: number; seconds: number; lift: number; active: boolean}
interface Strike {center: THREE.Vector3; targetId: string; since: number; seed: number; kind: 'sky' | 'floor'; active: boolean; color: THREE.Color}
interface Flash {center: THREE.Vector3; since: number; seed: number; strength: number; reach: number; active: boolean; color: THREE.Color; soft?: boolean}
interface Beam {from: THREE.Vector3; to: THREE.Vector3; since: number; seconds: number; seed: number; width: number; active: boolean; color: THREE.Color}
const APPEAR_HOLD = .04;
const CROW_EYE = new THREE.Color(3.2, .25, .2);
const CROW_LEAD = .05;
const CLONE_STANDS = .08, CLONE_BREAK = .1;
const CLONE_JOINTS = ['Head', 'Neck', 'Spine2', 'Spine1', 'Spine', 'Hips', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
  'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot'];
const FORMED = .11;
const BLINKS: Partial<Record<FighterId, {vanish: number; appear: number}>> = {'goku-black': MOVES['goku-black'].heavy.teleport!, itachi: MOVES.itachi.heavy.teleport!,
  aizen: MOVES.aizen.heavy.teleport!};
const BLINK = BLINKS['goku-black']!;
const ILLUSION_BREAKS = .27;
const FLAMES = 700;
const METEORS = 2;
const SIGNATURE_SECONDS = 2.8;
const SERIOUS_WIND = new THREE.Color(2.6, 2.6, 2.4);
const LIGHT_SCALE = .35;

function meteorRock(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 3);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const heat = new Float32Array(position.count), v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    const crag = Math.sin(v.x * 5.1 + 1.3) * Math.sin(v.y * 4.3 + .7) * Math.sin(v.z * 4.7 + 2.1);
    const r = 1 + .13 * Math.sin(v.x * 2.2 + v.y * 1.7) + .09 * Math.sin(v.z * 3.1 - v.x * 2.4) + .12 * crag;
    position.setXYZ(i, v.x * r, v.y * r, v.z * r);
    heat[i] = 1 - THREE.MathUtils.smoothstep(Math.abs(crag), .015, .1);
  }
  geometry.setAttribute('heat', new THREE.BufferAttribute(heat, 1));
  geometry.computeVertexNormals();
  return geometry;
}

const HAKI_RED = new THREE.Color(3.0, .12, .2);

class InkStrokes {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private data: Float32Array;
  private buffer: THREE.InstancedInterleavedBuffer;
  count = 0;
  constructor(readonly capacity: number) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 2, 1, 3]);
    this.data = new Float32Array(capacity * 8);
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, 8, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aA', new THREE.InterleavedBufferAttribute(this.buffer, 4, 0));
    geometry.setAttribute('aB', new THREE.InterleavedBufferAttribute(this.buffer, 4, 4));
    geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      name: 'HakiInk', transparent: true, depthWrite: false,
      vertexShader: `attribute vec4 aA;attribute vec4 aB;varying vec3 vShape;varying float vAlpha;
        void main(){vec4 a=modelViewMatrix*vec4(aA.xyz,1.);vec4 b=modelViewMatrix*vec4(aB.xyz,1.);
          vec2 d=b.xy-a.xy;float len=length(d);vec2 dir=len>1e-6?d/len:vec2(1.,0.);vec2 perp=vec2(-dir.y,dir.x);
          vec4 p=mix(a,b,position.x);float w=aA.w;p.xy+=perp*position.y*w+dir*(position.x*2.-1.)*w;
          gl_Position=projectionMatrix*p;float L=len/w;vShape=vec3(-1.+position.x*(L+2.),position.y,L);vAlpha=aB.w;}`,
      fragmentShader: `varying vec3 vShape;varying float vAlpha;
        void main(){float ax=max(0.,max(-vShape.x,vShape.x-vShape.z));float r=length(vec2(ax,vShape.y));if(r>=1.)discard;
          gl_FragColor=vec4(.035,.0,.012,(1.-r*r)*vAlpha);}`,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'haki-ink'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
  }
  begin() { this.count = 0; }
  segment(a: THREE.Vector3, b: THREE.Vector3, width: number, alpha: number) {
    if (this.count >= this.capacity || alpha <= .01) return;
    const o = this.count++ * 8, d = this.data;
    d[o] = a.x; d[o + 1] = a.y; d[o + 2] = a.z; d[o + 3] = width; d[o + 4] = b.x; d[o + 5] = b.y; d[o + 6] = b.z; d[o + 7] = alpha;
  }
  end() {
    this.mesh.geometry.instanceCount = this.count; this.mesh.visible = this.count > 0;
    if (this.count > 0) { this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.count * 8); this.buffer.needsUpdate = true; }
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

function coffinMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'Kurohitsugi', transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: {uOpacity: {value: 0}, uTime: {value: 0}, uRim: {value: new THREE.Color(1.6, .55, 3.0)}},
    vertexShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vV;
      void main(){vUv=uv;vN=normalMatrix*normal;vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec2 vUv;varying vec3 vN;varying vec3 vV;uniform float uOpacity;uniform float uTime;uniform vec3 uRim;
      void main(){float e=max(abs(vUv.x-.5),abs(vUv.y-.5))*2.;float edge=smoothstep(.94,.995,e);
        float sheen=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.);
        float streak=smoothstep(.96,1.,sin(vUv.x*41.+sin(vUv.y*5.+uTime*1.4)*1.8))*(1.-vUv.y*.55);
        vec3 c=vec3(.008,.003,.012)+uRim*(.05*sheen+.16*streak);
        c=mix(c,uRim*.75,edge);gl_FragColor=vec4(c,uOpacity);}`,
  });
}
const COFFIN_SLABS: [number, number, number, number, number, number][] = [
  [1.3, 2.5, .07, 0, 0, .65], [1.3, 2.5, .07, 0, 0, -.65], [.07, 2.5, 1.3, .65, 0, 0], [.07, 2.5, 1.3, -.65, 0, 0], [1.37, .07, 1.37, 0, 1.25, 0]];

function gunbai(): THREE.Group {
  const group = new THREE.Group(), face = new THREE.MeshStandardMaterial({color: 0xe4d8c2, roughness: .7}),
    black = new THREE.MeshStandardMaterial({color: 0x0b0808, roughness: .55}), wood = new THREE.MeshStandardMaterial({color: 0x3a2214, roughness: .8});
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, .035, 40), face);
  disc.rotation.x = Math.PI / 2; disc.position.y = .72; group.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.33, .022, 6, 40), black);
  rim.position.y = .72; group.add(rim);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 2;
    for (const side of [1, -1]) {
      const tomoe = new THREE.Mesh(new THREE.CircleGeometry(.055, 16), black);
      tomoe.position.set(Math.cos(a) * .13, .72 + Math.sin(a) * .13, side * .019); tomoe.rotation.y = side < 0 ? Math.PI : 0;
      group.add(tomoe);
    }
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.022, .026, .52, 10), wood);
  handle.position.y = .14; group.add(handle);
  group.name = 'madara-gunbai'; group.visible = false;
  group.traverse(o => { o.frustumCulled = false; });
  return group;
}

const SCYTHE_REACH = 1.6;
function scytheBlade(): THREE.BufferGeometry {
  const N = 18, reach = SCYTHE_REACH, drop = .62 * reach, bend = 1.45, root = .38, points: number[] = [], index: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = reach * Math.sin(bend * t), y = -drop * (1 - Math.cos(bend * t));
    points.push(x, y, 0, x * (1 - .18 * Math.sin(Math.PI * t)), y - root * (1 - t), 0);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setIndex(index);
  return geometry;
}

function meteorMaterial(fall: THREE.Vector3): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({color: 0x2c1e16, emissive: 0xff6a18, emissiveIntensity: 2.4, roughness: .95, flatShading: true});
  material.onBeforeCompile = shader => {
    shader.uniforms.uFall = {value: fall};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float heat;\nuniform vec3 uFall;\nvarying float vHeat;\nvarying float vLead;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvHeat = heat;\nvLead = dot(normalize(mat3(modelMatrix) * objectNormal), uFall);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHeat;\nvarying float vLead;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (length(vViewPosition) < 2.2 + 1.6 * fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453)) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= max(vHeat, .7 * smoothstep(.6, .95, vLead));');
  };
  return material;
}

type Accent = 'bolt' | 'fire' | 'black' | 'abyss' | 'blood';
const FLAME_OF: Record<Exclude<Accent, 'bolt'>, number> = {fire: FLAME_FIRE, black: BLACK, abyss: ABYSS, blood: BLOOD};
const ENDER_ACCENTS: Partial<Record<FighterId, Partial<Record<ComboKey, Accent>>>> = {
  kaido: { lllh: 'bolt', airHeavy: 'bolt' }, shanks: { lllh: 'bolt', llls: 'bolt' }, roger: { lllh: 'bolt', llls: 'bolt' },
  sukuna: { llls: 'bolt' }, 'goku-black': { llls: 'bolt' }, jiren: { llls: 'bolt' }, 'golden-frieza': { llls: 'bolt' },
  itachi: { airHeavy: 'fire', airSpecial: 'fire' }, madara: { airSpecial: 'fire' }, tanjiro: { lllh: 'fire' }, 'gohan-beast': { lh: 'bolt' },
  kakashi: { airSpecial: 'bolt' }, killua: { llh: 'bolt', airSpecial: 'bolt' }, sasuke: { llls: 'bolt', airSpecial: 'bolt' },
  ace: { llh: 'fire', airSpecial: 'fire' }, sanji: { lllh: 'fire', airSpecial: 'fire' }, zoro: { airHeavy: 'fire' }, luffy: { airSpecial: 'fire' },
  ichigo: { lllh: 'abyss', airSpecial: 'abyss' }, guts: { lllh: 'blood', airSpecial: 'fire' },
};

const AWAKENED_ACCENTS: Partial<Record<FighterId, Partial<Record<ComboKey, Accent>>>> = { kaido: { llls: 'fire' } };
const FLAME_TALL: Partial<Record<FighterId, Partial<Record<ComboKey, number>>>> = { ace: { airSpecial: 2.6 }, guts: { airSpecial: 1.6 } };

interface EnderLook { glow: THREE.Color; cut: SlashStyle; cracks: boolean; soft: boolean; ring?: THREE.Color; el?: Element; flavour?: Flavour; move?: MoveDefinition }
const SHOP_LOOK = Object.fromEntries((Object.keys(COLOR) as Emperor[]).map(who => [who, {glow: COLOR[who].glow, cut: CUT[who], cracks: true, soft: false} satisfies EnderLook])) as Record<Emperor, EnderLook>;
const RING_WHITE = new THREE.Color(2, 2.4, 2.8);
type Flavour = 'chakra' | 'ki' | 'haki' | 'slash' | 'fire' | 'room' | 'cursed' | 'stand' | 'reiatsu' | 'steel' | 'bolt'
  | 'flash' | 'explosion' | 'water' | 'earth' | 'plain' | 'blackFlash' | 'infinity' | 'frost' | 'claw' | 'inhale' | 'fireflies' | 'knives' | 'spark' | 'flurry';
const ROOM_CUT: SlashStyle = {mode: ENERGY, edge: new THREE.Color(1.7, 2.6, 3.2), body: new THREE.Color(.22, .75, 1.5), glow: new THREE.Color(.08, .45, 1.0)};
const MAIN: Partial<Record<FighterId, {flavour: Flavour; cut?: SlashStyle}>> = {
  naruto: {flavour: 'chakra'}, goku: {flavour: 'ki'}, vegeta: {flavour: 'ki'}, luffy: {flavour: 'haki'}, zoro: {flavour: 'slash', cut: SLASH.zoro},
  sanji: {flavour: 'fire'}, ace: {flavour: 'fire'}, law: {flavour: 'room', cut: ROOM_CUT}, gojo: {flavour: 'cursed'}, jotaro: {flavour: 'stand'},
  dio: {flavour: 'stand'}, ichigo: {flavour: 'reiatsu', cut: SLASH.getsuga}, guts: {flavour: 'steel', cut: SLASH.dragonslayer},
  killua: {flavour: 'bolt'}, kakashi: {flavour: 'bolt'}, sasuke: {flavour: 'bolt'},
};
const MAIN_KEYS: Partial<Record<FighterId, Partial<Record<ComboKey, Flavour>>>> = {
  goku: { llls: 'flash' }, vegeta: { llh: 'explosion' }, kakashi: { lh: 'water', llh: 'plain', lllh: 'earth', llls: 'earth' },
  sasuke: { lllh: 'fire' }, gojo: { lh: 'blackFlash', llls: 'infinity' }, dio: { llls: 'frost', airSpecial: 'knives' },
  guts: { llls: 'explosion', airSpecial: 'explosion' }, killua: { lh: 'spark', lllh: 'claw' }, jotaro: { llls: 'inhale' },
  ace: { llls: 'fireflies' }, luffy: { llh: 'flurry', airSpecial: 'fire' }, sanji: { llls: 'flurry' },
  law: { lllh: 'bolt', airSpecial: 'bolt' },
};
const SOFT: ReadonlySet<Flavour> = new Set<Flavour>(['chakra', 'slash', 'fire', 'room', 'stand', 'reiatsu', 'steel', 'flash', 'explosion', 'water', 'earth',
  'plain', 'infinity', 'frost', 'claw', 'inhale', 'fireflies', 'knives', 'spark', 'flurry']);
const CRACKED: ReadonlySet<Flavour> = new Set<Flavour>(['ki', 'haki', 'cursed', 'stand', 'bolt', 'blackFlash']);
const MAIN_LOOKS = new Map<number, EnderLook>();
const MAIN_ORDER: readonly FighterId[] = ['goku', 'naruto', 'luffy', 'sanji', 'vegeta', 'kakashi', 'sasuke', 'zoro', 'jotaro', 'ichigo', 'ace', 'law', 'gojo', 'dio', 'guts', 'killua'];
function mainLook(fighter: FighterId, key: ComboKey, awakened: boolean): EnderLook | undefined {
  const row = MAIN[fighter], index = MAIN_ORDER.indexOf(fighter) * 16 + COMBO_KEYS.indexOf(key) * 2 + (awakened ? 1 : 0);
  if (!row || index < 0) return undefined;
  let look = MAIN_LOOKS.get(index);
  if (look) return look;
  const el = enderElement(fighter, key, awakened), move = comboMove(fighter, key, awakened);
  if (!el || !move) return undefined;
  const rim = new THREE.Color(el.rim), spike = new THREE.Color(el.spike), flavour = MAIN_KEYS[fighter]?.[key] ?? row.flavour;
  const glow = rim.clone().multiplyScalar(el.rim === 0x3a0a4a ? 5 : 2.4);
  const struck = !DREAM_IMPACT || flavour === 'bolt';
  look = {glow, el, move, flavour, cracks: CRACKED.has(flavour) && struck, soft: SOFT.has(flavour) || !struck,
    ring: spike.clone().multiplyScalar(.5).add(rim.clone().multiplyScalar(1.7)),
    cut: row.cut ?? {mode: ENERGY, edge: spike.clone().multiplyScalar(3.2), body: rim.clone().multiplyScalar(1.1), glow: rim.clone().multiplyScalar(.6)}};
  MAIN_LOOKS.set(index, look);
  return look;
}
interface Daze {targetId: string; since: number; active: boolean; glow: THREE.Color; electric: boolean; seed: number}
const DAZES = 6;
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const STEEL_SPARK: Element = {spike: 0xffffff, rim: 0xffd9a0, light: 0xfff0d0, ink: 0x10141a};
const BLOOD_SPRAY: Element = {spike: 0xd0242a, rim: 0x6a0408, light: 0xff4a40, ink: 0x0a0002};

export class EmperorEffects {
  private kit: ElectricKit;
  private cutGeometry = new THREE.PlaneGeometry(1, 1);
  private ringGeometry = new THREE.RingGeometry(.86, 1, 64, 1);
  private sphere = new THREE.SphereGeometry(1, 40, 24);
  private cuts: Cut[] = [];
  private cracks: Crack[] = [];
  private rings: Ring[] = [];
  private domes: Dome[] = [];
  private strikes: Strike[] = [];
  private flashes: Flash[] = [];
  private beams: Beam[] = [];
  private hidden = new Set<Fighter>();
  private formed = new Map<Fighter, Map<THREE.Object3D, THREE.Vector3>>();
  private susanoos = new WeakMap<Fighter, GhostShell | null>();
  private allShells: GhostShell[] = [];
  private susanoo(f: Fighter, tint: { body: number; rim: number }) {
    if (this.susanoos.has(f)) return;
    const form = f.group.children.find(c => c !== f.model && c.name.startsWith('fighter-'));
    if (!form) return;
    let model: THREE.Object3D | undefined; form.traverse(o => { if (!model && (o as THREE.SkinnedMesh).isSkinnedMesh) model = o.parent ?? undefined; });
    if (!model) { this.susanoos.set(f, null); return; }
    const shell = new GhostShell(form, tint.body, tint.rim, .9, 0x020818, 2, true); shell.enabled = true;
    shell.fadeNear(f.group, 3.2, 6.8);
    this.susanoos.set(f, shell); this.allShells.push(shell);
  }
  private fields = new Map<string, {at: THREE.Vector3; since: number}>();
  private meteors: {mesh: THREE.Mesh; owner: string; fall: THREE.Vector3}[] = [];
  private risen = new Map<string, number>();
  private signatures: {who: Emperor; actorId: string; since: number; seed: number}[] = [];
  private domain: MalevolentShrineDomain;
  private lens = new THREE.Vector3();
  private seeing = false;
  private domainAt = new Map<string, {key: number; at: THREE.Vector3; flashed: boolean}>();
  private decoys = new Map<string, {decoy: KyokaDecoy; key: number}>();
  private whirls = new Map<string, BladeWhirl>();
  private crows?: CrowFlock;
  private clones = new Map<string, KyokaDecoy>();
  private warmDecoy?: KyokaDecoy;
  private warmWhirl?: BladeWhirl;
  private crowsAt = NaN;
  private crackWhite = new THREE.Color(2.2, 2.0, 2.6);
  private signs = new WeakMap<Fighter, {left?: THREE.Object3D; right?: THREE.Object3D; spear?: THREE.Object3D; dagger?: THREE.Object3D}>();
  private gunbais: {fan: THREE.Group; owner: string}[] = [];
  private elbow = new THREE.Vector3();
  private coffins: {slabs: THREE.Mesh[]; material: THREE.ShaderMaterial; owner: string}[] = [];
  private fuga = new Map<string, THREE.Vector3>();
  private ink = new InkStrokes(900);
  private jag = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private across = new THREE.Vector3();
  private scythes: {haft: THREE.Mesh; blade: THREE.Mesh; owner: string}[] = [];
  private flameMaterial = flameSpriteMaterial();
  private flames = new THREE.InstancedMesh(flameSpriteGeometry(), this.flameMaterial, FLAMES);
  private flameCount = 0;
  private transform = new THREE.Object3D();
  private tint = new THREE.Color();
  private flameAxis = new THREE.Vector3();
  private seen = new Set<number>();
  private drawn = new Map<string, number>();
  private enderDrawn = new Map<string, number>();
  private enderHit = new Map<string, number>();
  private vfx?: VfxKit;
  private enderAt = new Map<string, {at: THREE.Vector3; since: number}>();
  private dazes: Daze[] = Array.from({length: DAZES}, () => ({targetId: '', since: 0, active: false, glow: RING_WHITE, electric: false, seed: 0}));
  private m1 = new THREE.Vector3();
  private m2 = new THREE.Vector3();
  private m3 = new THREE.Vector3();
  private m4 = new THREE.Vector3();
  private dust = new THREE.Color();
  private dust2 = new THREE.Color();
  private softTint = new THREE.Color();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private side = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private forward = new THREE.Vector3();
  private axis = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    this.kit = new ElectricKit(scene, 'emperor-bolts', 1600);
    for (let i = 0; i < CUTS; i++) {
      const mesh = new THREE.Mesh(this.cutGeometry, slashWaveMaterial()); mesh.name = 'emperor-cut'; mesh.frustumCulled = false; mesh.renderOrder = 4;
      applySlashStyle(mesh.material, CUT.kaido, i * 13, 1.25, .18); mesh.scale.setScalar(.001); mesh.position.set(0, -50, 0); scene.add(mesh);
      const cut: Cut = {mesh, since: 0, seconds: CUT_SECONDS, active: false}; mesh.onAfterRender = () => { if (!cut.active) mesh.visible = false; }; this.cuts.push(cut);
    }
    for (let i = 0; i < CRACKS; i++) this.cracks.push({center: new THREE.Vector3(), normal: new THREE.Vector3(), since: 0, seconds: CRACK_SECONDS, seed: 0, reach: 1, count: 8, active: false, color: COLOR.whitebeard.glow});
    for (let i = 0; i < RINGS; i++) {
      const material = new THREE.MeshBasicMaterial({color: new THREE.Color(2, 2.4, 2.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false});
      const mesh = new THREE.Mesh(this.ringGeometry, material); mesh.name = 'emperor-ring'; mesh.rotation.x = -Math.PI / 2; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3;
      scene.add(mesh); this.rings.push({mesh, since: 0, radius: 1, active: false});
    }
    for (let i = 0; i < DOMES; i++) {
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        uniforms: {uTime: {value: 0}, uOpacity: {value: 0}, uRim: {value: new THREE.Color(3.0, .18, .24)}},
        vertexShader: 'varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;void main(){vLocal=position;vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}',
        fragmentShader: `varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;uniform float uTime;uniform float uOpacity;uniform vec3 uRim;
          void main(){float facing=abs(dot(normalize(vNormal),normalize(vView)));float rim=pow(1.0-facing,2.4);
          float lines=smoothstep(.9,1.0,sin(vLocal.y*18.0+uTime*6.0+sin(vLocal.x*9.0)*1.5))*.5;
          vec3 colour=mix(vec3(.05,.0,.01),uRim,rim*.85+lines*.6);
          gl_FragColor=vec4(colour,(.32+rim*.55+lines*.3)*uOpacity);}`,
      });
      const mesh = new THREE.Mesh(this.sphere, material); mesh.name = 'shanks-haki-dome'; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3;
      scene.add(mesh); this.domes.push({mesh, actorId: '', since: 0, radius: 1, seconds: DOME_SECONDS, lift: .9, active: false});
    }
    for (let i = 0; i < STRIKES; i++) this.strikes.push({center: new THREE.Vector3(), targetId: '', since: 0, seed: 0, kind: 'sky', active: false, color: COLOR.kaido.glow});
    for (let i = 0; i < FLASHES; i++) this.flashes.push({center: new THREE.Vector3(), since: 0, seed: 0, strength: 1, reach: 1, active: false, color: COLOR.kaido.glow});
    for (let i = 0; i < BEAMS; i++) this.beams.push({from: new THREE.Vector3(), to: new THREE.Vector3(), since: 0, seconds: BEAM_SECONDS, seed: 0, width: .03, active: false, color: DEATH});
    this.flames.count = 0; this.flames.setColorAt(0, new THREE.Color(0, 0, flamePalette(BLACK))); this.flames.frustumCulled = false;
    this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.flames.name = 'emperor-flames'; scene.add(this.flames);
    scene.add(this.ink.mesh);
    const rock = meteorRock();
    for (let i = 0; i < METEORS; i++) {
      const fall = new THREE.Vector3(0, -1, 0), mesh = new THREE.Mesh(rock, meteorMaterial(fall));
      mesh.name = 'madara-meteor'; mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh); this.meteors.push({mesh, owner: '', fall});
    }
    const blade = scytheBlade(), shaft = new THREE.CylinderGeometry(.045, .045, 1, 8, 1).translate(0, .5, 0);
    for (let i = 0; i < METEORS; i++) {
      const lit = () => new THREE.MeshBasicMaterial({color: new THREE.Color(3.2, 1.2, 2.6), transparent: true, opacity: .9, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
      const haft = new THREE.Mesh(shaft, lit()), edge = new THREE.Mesh(blade, lit());
      for (const mesh of [haft, edge]) { mesh.name = 'goku-black-scythe'; mesh.visible = false; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.renderOrder = 4; scene.add(mesh); }
      this.scythes.push({haft, blade: edge, owner: ''});
    }
    for (let i = 0; i < METEORS; i++) {
      const material = coffinMaterial();
      const slabs = COFFIN_SLABS.map(([w, h, d]) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.name = 'aizen-kurohitsugi'; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3; scene.add(mesh);
        return mesh;
      });
      this.coffins.push({slabs, material, owner: ''});
    }
    for (let i = 0; i < METEORS; i++) { const fan = gunbai(); scene.add(fan); this.gunbais.push({fan, owner: ''}); }
    this.domain = new MalevolentShrineDomain(scene);
  }

  load(fighters: Iterable<string>) {
    const ids = new Set(fighters);
    if (ids.has('itachi')) this.crows ??= new CrowFlock(this.scene, CROW_EYE);
    if (ids.has('itachi') || ids.has('aizen')) this.warmDecoy ??= new KyokaDecoy(this.scene, COLOR.aizen.glow);
    if (ids.has('levi')) this.warmWhirl ??= new BladeWhirl(this.scene);
  }

  handle(events: readonly CombatEvent[], fighters: ReadonlyMap<string, Fighter>) {
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      const fighter = event.fighter;
      if (fighter && !EMPERORS.has(fighter) && MAIN[fighter] && event.branch) this.mainEvent(event, fighter, fighters);
      if (!fighter || !EMPERORS.has(fighter)) continue;
      const who = fighter as Emperor, actor = fighters.get(event.actorId);
      if (event.kind === 'awaken' && actor) this.awaken(who, actor, event.serverTime, event.id, fighters);
      if (event.kind === 'cast' && (who === 'itachi' || who === 'madara' || who === 'sung-jinwoo') && event.slot === 'special' && event.endpoint) {
        const field = this.fields.get(event.actorId) ?? {at: new THREE.Vector3(), since: 0};
        field.at.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); field.since = event.serverTime; this.fields.set(event.actorId, field);
      }
      if (event.kind !== 'hit' || event.slot !== 'ultimate') continue;
      const last = (event.contactIndex ?? 0) >= MOVES[who].ultimate.contacts.length - 1, opener = (event.contactIndex ?? 0) === 0;
      const between = !last && !opener, index = event.contactIndex ?? 0;
      const victim = event.targetId ? fighters.get(event.targetId) : undefined;
      if (victim) this.a.copy(victim.group.position).setY(victim.group.position.y + 1.1);
      else if (event.endpoint) this.a.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
      else continue;
      const seed = event.seed ?? event.id;
      if (who === 'kaido' && last) { this.strike(this.a, event.targetId ?? '', event.serverTime, seed, 'sky', COLOR.kaido.glow); this.ring(this.b.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 4.2); }
      if (who === 'whitebeard' && actor) {
        this.facing(actor);
        this.crack(this.b.copy(actor.handL).addScaledVector(this.forward, .4), this.forward, event.serverTime, seed, last ? 3.2 : 2.2, last ? 14 : 9, COLOR.whitebeard.glow);
        this.crack(this.c.copy(actor.handR).addScaledVector(this.forward, .4), this.forward, event.serverTime, seed + 7, last ? 3 : 2, last ? 12 : 8, COLOR.whitebeard.glow);
        this.ring(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), event.serverTime, last ? 5.2 : 3.6);
      }
      if (who === 'shanks' && last) {
        this.strike(this.a, event.targetId ?? '', event.serverTime, seed, 'floor', HAKI_RED);
        if (actor) { this.facing(actor); this.cut('shanks', this.a, actor.state.yaw, 5.2, -.35, event.serverTime, .4, seed); }
      }
      if (who === 'sukuna' && actor) {
        this.facing(actor);
        if (last) { this.flash(this.a, 2.4, seed, 2.8, FIRE, event.serverTime); this.ring(this.b.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 3.4); }
        else {
          for (let i = 0; i < 3; i++) {
            const r = this.kit.painter.rng.seed(seed * 3 + i);
            this.b.copy(this.a).setY(this.a.y + r.signed() * .4);
            this.cut('sukuna', this.b, actor.state.yaw + (i - 1) * 1.1 + r.signed() * .3, 2.6 + r.next(), r.signed() * 1.4, event.serverTime + i * .03, .26, seed + i * 17);
          }
          this.flash(this.a, .7, seed, 1.2, COLOR.sukuna.glow, event.serverTime);
        }
      }
      if (who === 'aizen') {
        if (between && actor) {
          this.facing(actor);
          this.cut('aizen', this.a, actor.state.yaw + index * 1.9, 2.8, (index % 2 ? 1 : -1) * 1.25, event.serverTime, .3, seed);
          this.flash(this.a, .6, seed, 1.1, COLOR.aizen.glow, event.serverTime);
        }
        if (last) {
          if (actor) this.facing(actor);
          this.crack(this.a, this.forward, event.serverTime, seed, 3.2, 18, COLOR.aizen.glow);
          this.strike(this.b.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR.aizen.glow);
          this.flash(this.a, 1.4, seed, 2.2, COLOR.aizen.glow, event.serverTime);
        }
      }
      if (who === 'griffith') {
        const held = MOVES.griffith.ultimate.contacts[1] - MOVES.griffith.ultimate.contacts[0] + .15;
        if (!last) {
          this.dome(event.targetId ?? '', event.serverTime, 1.35, ECLIPSE, held);
          this.dome(event.targetId ?? '', event.serverTime, .85, BRAND, held, 4.6);
        } else if (actor) {
          this.facing(actor);
          this.cut('griffith', this.a, actor.state.yaw, 5.6, .62, event.serverTime, .45, seed);
          this.crack(this.b.copy(this.a).setY(this.a.y + .25), this.forward, event.serverTime, seed, 2.8, 14, BRAND);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', ECLIPSE);
          this.flash(this.a, 1.5, seed, 2.4, COLOR.griffith.glow, event.serverTime);
        }
      }
      if (who === 'goku-black' && actor) {
        this.facing(actor);
        if (last) {
          this.cut('goku-black', this.a, actor.state.yaw, 6.6, 1.15, event.serverTime, .5, seed);
          this.crack(this.b.copy(this.a).setY(this.a.y + .4), this.forward, event.serverTime, seed, 3.6, 16, COLOR['goku-black'].glow);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR['goku-black'].glow);
          this.flash(this.a, 1.6, seed, 2.6, COLOR['goku-black'].glow, event.serverTime);
        } else if (between) {
          this.cut('goku-black', this.a, actor.state.yaw, 4.4, -.9, event.serverTime, .35, seed);
          this.flash(this.a, .9, seed, 1.4, COLOR['goku-black'].glow, event.serverTime);
        } else this.flash(this.a, .8, seed, 1.3, COLOR['goku-black'].glow, event.serverTime);
      }
      if (who === 'jiren' && actor) {
        this.facing(actor);
        if (last) {
          this.cut('jiren', this.a, actor.state.yaw, 6.4, .2, event.serverTime, .5, seed);
          this.crack(this.a, this.forward, event.serverTime, seed, 3.8, 18, COLOR.jiren.glow);
          this.strike(this.b.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR.jiren.glow);
          this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 5);
          this.flash(this.a, 1.7, seed, 2.8, COLOR.jiren.glow, event.serverTime);
        } else {
          this.crack(this.a, this.forward, event.serverTime, seed, 1.8, 10, COLOR.jiren.glow);
          this.flash(this.a, .8, seed, 1.3, COLOR.jiren.glow, event.serverTime);
        }
      }
      if (who === 'gohan-beast' && actor) {
        this.facing(actor);
        if (last) {
          this.crack(this.b.copy(this.a).addScaledVector(this.forward, .45), this.forward, event.serverTime, seed, 3.4, 16, SPIRAL);
          this.flash(this.a, 1.6, seed, 2.6, MASENKO_GOLD, event.serverTime);
          this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 3.4);
        } else this.flash(this.a, .9, seed, 1.4, MASENKO_GOLD, event.serverTime);
      }
      if (who === 'akaza' && actor) {
        this.facing(actor);
        if (last) {
          this.crack(this.a, this.forward, event.serverTime, seed, 4, 20, COLOR.akaza.glow);
          this.flash(this.a, 1.8, seed, 2.8, COLOR.akaza.glow, event.serverTime);
          for (let i = 0; i < 2; i++) this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime + i * .07, 3 + i * 1.6);
          this.strike(this.b.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COMPASS);
        } else {
          this.crack(this.a, this.forward, event.serverTime, seed, 1.5, 9, COLOR.akaza.glow);
          this.flash(this.a, .8, seed, 1.3, COLOR.akaza.glow, event.serverTime);
        }
      }
      if (who === 'madara' && last) {
        this.crack(this.b.copy(this.a).setY(this.a.y + .3), this.up, event.serverTime, seed, 4, 20, FIRE);
        for (let i = 0; i < 3; i++) this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime + i * .07, 3 + i * 1.7);
        this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', FIRE);
        this.flash(this.a, 2.2, seed, 3.4, FIRE, event.serverTime);
      }
      if (who === 'tanjiro' && actor && between) {
        this.facing(actor);
        this.cut('sun', this.a, actor.state.yaw + .4, 4.4, -.7, event.serverTime, .4, seed);
        this.flash(this.a, 1, seed, 1.6, SUN, event.serverTime);
      }
      if (who === 'tanjiro' && actor && last) {
        this.facing(actor);
        this.cut('sun', this.a, actor.state.yaw, 5.8, 1.1, event.serverTime, .5, seed);
        this.cut('sun', this.b.copy(this.a).setY(this.a.y + .2), actor.state.yaw, 4.2, .9, event.serverTime + .04, .45, seed + 3);
        this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', FIRE);
        this.flash(this.a, 1.8, seed, 2.8, SUN, event.serverTime);
      }
      if (who === 'levi' && actor && between) {
        this.cut('levi', this.b.copy(this.a).setY(this.a.y + (index % 2 ? .3 : -.15)), actor.state.yaw + index * 1.26, 3.2, index % 2 ? .7 : -.7, event.serverTime, .3, seed);
        this.flash(this.a, .6, seed, 1.1, COLOR.levi.glow, event.serverTime);
      }
      if (who === 'levi' && actor && last) {
        for (let i = 0; i < 5; i++) {
          const yaw = actor.state.yaw + i * Math.PI * 2 / 5;
          this.cut('levi', this.b.copy(this.a).setY(this.a.y + (i % 2 ? .25 : -.2)), yaw, 3.6, i % 2 ? .6 : -.6, event.serverTime + i * .03, .42, seed + i * 7);
        }
        this.ring(this.c.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 3.8);
        this.flash(this.a, 1.6, seed, 2.6, COLOR.levi.glow, event.serverTime);
      }
      if (who === 'sung-jinwoo' && actor && between) {
        this.cut('sung-jinwoo', this.a, actor.state.yaw + (index - 2) * .9, 3.6, (index % 2 ? 1 : -1) * .9, event.serverTime, .35, seed);
        this.flash(this.a, .8, seed, 1.3, SHADOW, event.serverTime);
      }
      if (who === 'sung-jinwoo' && actor && last) {
        for (let i = 0; i < 4; i++) this.cut('sung-jinwoo', this.a, actor.state.yaw + (i - 1.5) * .5, 4.2, (i % 2 ? 1 : -1) * .8, event.serverTime + i * .05, .45, seed + i * 5);
        this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', SHADOW);
        this.flash(this.a, 1.7, seed, 2.6, SHADOW, event.serverTime);
      }
      if (who === 'itachi') {
        const contacts = MOVES.itachi.ultimate.contacts, held = contacts[contacts.length - 1] - contacts[0] + .15;
        if (opener) {
          this.dome(event.targetId ?? '', event.serverTime, 1.5, TSUKUYOMI, held);
          this.dome(event.targetId ?? '', event.serverTime, .9, SHARINGAN, held, 4.4);
        } else if (between && actor) {
          this.facing(actor);
          this.cut('itachi', this.a, actor.state.yaw + index * 2.1, 2.4, (index % 2 ? 1 : -1) * 1.1, event.serverTime, .26, seed);
          this.flash(this.a, .5, seed, .9, SHARINGAN, event.serverTime);
        } else if (actor) {
          this.facing(actor);
          this.cut('itachi', this.a, actor.state.yaw, 4.8, .55, event.serverTime, .45, seed);
          this.crack(this.b.copy(this.a).setY(this.a.y + .2), this.forward, event.serverTime, seed, 3.2, 16, SHARINGAN);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', TSUKUYOMI);
          this.flash(this.a, 1.5, seed, 2.4, SHARINGAN, event.serverTime);
        }
      }
      if (who === 'saitama' && actor) {
        this.facing(actor);
        if (last) {
          this.crack(this.a, this.forward, event.serverTime, seed, 4.6, 22, SERIOUS);
          this.flash(this.a, 2, seed, 3.2, COLOR.saitama.glow, event.serverTime);
          for (let i = 0; i < 3; i++) this.ring(this.c.copy(this.a).setY(this.a.y - 1.05).addScaledVector(this.forward, i * 1.6), event.serverTime + i * .06, 3.2 + i * 1.8);
          for (let i = 0; i < 3; i++) {
            this.b.copy(this.a).addScaledVector(this.forward, 1.2 + i * 1.8);
            this.cut('wind', this.b, actor.state.yaw, 4.2 + i * 1.4, .1 - i * .2, event.serverTime + i * .05, .45, seed + i * 11);
          }
          this.side.set(this.forward.z, 0, -this.forward.x);
          for (let i = 0; i < 14; i++) {
            const r = this.kit.painter.rng.seed(seed * 17 + i), spread = r.signed() * .42, rise = r.signed() * .28;
            this.c.copy(this.forward).addScaledVector(this.side, spread).addScaledVector(this.up, rise).normalize();
            this.b.copy(actor.handR).addScaledVector(this.c, .3);
            this.tip.copy(this.b).addScaledVector(this.c, 5 + r.next() * 7);
            this.beam(this.b, this.tip, event.serverTime + i * .008, seed + i * 3, .05 + r.next() * .05, i % 3 ? SERIOUS : COLOR.saitama.glow, .38);
          }
          const vfx = VfxKit.for(this.scene), floor = actor.group.position.y;
          vfx.debris.burst(12, this.a.x, floor + .05, this.a.z, this.forward.x, .55, this.forward.z, 11, .5, .16, floor, 2);
          vfx.dustSpray(this.a.x, floor, this.a.z, this.forward.x, this.forward.z, 8, 5, .8, event.serverTime, .55, .6);
          for (let i = 0; i < 7; i++) {
            this.b.copy(actor.handR).addScaledVector(this.forward, .8 + i * 1.4);
            vfx.ring(this.b.x, this.b.y, this.b.z, .3 + i * .25, 1.4 + i * .55, event.serverTime + i * .07, .34, 0xffffff, 0xffb070, .12, 'plane', this.forward.x, 0, this.forward.z);
            this.c.copy(actor.group.position).addScaledVector(this.forward, 1.6 + i * 1.3);
            vfx.marks.mark(MARK.crack, this.c.x, floor, this.c.z, 0, 1, 0, 1.7 + i * .25, event.serverTime + i * .07, 3, 0x000000, 0);
          }
          this.b.copy(this.a).addScaledVector(this.forward, 9).setY(this.a.y + 6.5);
          this.crack(this.b, this.forward, event.serverTime + .08, seed + 31, 9, 34, SERIOUS);
          this.flash(this.b, 1.4, seed + 37, 6, COLOR.saitama.glow, event.serverTime + .08);
          this.ring(this.c.copy(this.a).setY(this.a.y - 1.05).addScaledVector(this.forward, 7), event.serverTime + .16, 9);
        } else {
          const vfx = VfxKit.for(this.scene), floor = actor.group.position.y, at = actor.group.position;
          vfx.marks.mark(MARK.crack, at.x, floor, at.z, 0, 1, 0, 2, event.serverTime, 2.6, 0x000000, 0);
          vfx.dustRing(at.x, floor, at.z, 5, .35, 2.2, .5, event.serverTime);
          vfx.ring(at.x, floor + 1.1, at.z, .4, 2.8, event.serverTime, .38, 0xffffff, 0xffc870, .1, 'camera');
        }
      }
      if (who === 'gon' && actor) {
        this.facing(actor);
        if (last) {
          this.crack(this.a, this.forward, event.serverTime, seed, 4.4, 22, COLOR.gon.glow);
          this.flash(this.a, 2, seed, 3.2, COLOR.gon.glow, event.serverTime);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR.gon.glow);
          for (let i = 0; i < 3; i++) this.ring(this.c.copy(this.a).setY(this.a.y - 1.05).addScaledVector(this.forward, i * 1.4), event.serverTime + i * .06, 3 + i * 1.6);
        } else {
          this.crack(this.a, this.forward, event.serverTime, seed, 1.5, 9, COLOR.gon.glow);
          this.flash(this.a, .8, seed, 1.3, COLOR.gon.glow, event.serverTime);
        }
      }
      if (who === 'golden-frieza') {
        this.crack(this.b.copy(this.a).setY(this.a.y + .4), this.up, event.serverTime, seed, 2.6, 12, DEATH_BALL_RED);
        this.flash(this.a, 1.3, seed, 2.2, DEATH_BALL_RED, event.serverTime);
      }
      if (who === 'meruem' && actor) {
        this.facing(actor);
        if (last) {
          this.ring(this.b.copy(this.a).setY(this.a.y - 1.05), event.serverTime, 4.6);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', COLOR.meruem.glow);
          this.crack(this.a, this.up, event.serverTime, seed, 3.2, 16, COLOR.meruem.glow);
          this.flash(this.a, 1.5, seed, 2.4, COLOR.meruem.glow, event.serverTime);
        } else {
          this.crack(this.a, this.forward, event.serverTime, seed, 1.8, 10, COLOR.meruem.glow);
          this.flash(this.a, .8, seed, 1.2, COLOR.meruem.glow, event.serverTime);
        }
      }
      if (who === 'roger' && actor) {
        this.facing(actor);
        if (last) {
          this.cut('roger', this.a, actor.state.yaw, 6.2, .62, event.serverTime, .5, seed);
          this.crack(this.b.copy(this.a).setY(this.a.y + .7).addScaledVector(this.forward, .6), this.forward, event.serverTime, seed, 4.2, 18, HAKI_RED);
          this.strike(this.c.copy(this.a).setY(this.a.y - 1.05), event.targetId ?? '', event.serverTime, seed, 'floor', HAKI_RED);
        } else this.cut('roger', this.a, actor.state.yaw, 3.6, -.5, event.serverTime, .3, seed);
      }
    }
  }

  private awaken(who: Emperor, actor: Fighter, time: number, seed: number, fighters?: ReadonlyMap<string, Fighter>) {
    const head = this.a.copy(actor.group.position).setY(actor.group.position.y + 2.2);
    if (who === 'akaza' || who === 'whitebeard' || who === 'levi' || who === 'saitama' || who === 'tanjiro') {
      this.signatures = this.signatures.filter(m => m.actorId !== actor.state.id);
      this.signatures.push({who, actorId: actor.state.id, since: time, seed});
    }
    if (who === 'kaido') { this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + 1.2), actor.state.id, time, seed, 'sky', COLOR.kaido.glow); this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 4.6); }
    if (who === 'whitebeard') { this.crack(head.setY(head.y + .6), this.up, time, seed, 3.4, 16, COLOR.whitebeard.glow); this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 5); }
    if (who === 'shanks') { this.dome(actor.state.id, time, 3.6, HAKI_RED); this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', HAKI_RED); }
    if (who === 'sukuna') {
      this.dome(actor.state.id, time, 5, new THREE.Color(1.4, .1, .14), 1.4);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.sukuna.glow);
    }
    if (who === 'aizen') {
      this.dome(actor.state.id, time, 4, COLOR.aizen.glow);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.aizen.glow);
      this.crack(head.setY(head.y + .5), this.up, time, seed, 2.6, 12, COLOR.aizen.glow);
    }
    if (who === 'griffith') {
      this.dome(actor.state.id, time, 4.4, ECLIPSE, 1.2);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', ECLIPSE);
      this.crack(head.setY(head.y + .9), this.up, time, seed, 2.8, 12, COLOR.griffith.glow);
    }
    if (who === 'goku-black') {
      this.dome(actor.state.id, time, 4, COLOR['goku-black'].glow, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR['goku-black'].glow);
    }
    if (who === 'jiren') {
      this.dome(actor.state.id, time, 4.2, COLOR.jiren.glow, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.jiren.glow);
      this.crack(head.setY(head.y + .3), this.up, time, seed, 3, 14, COLOR.jiren.glow);
    }
    if (who === 'golden-frieza') {
      this.dome(actor.state.id, time, 3.8, COLOR['golden-frieza'].glow, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR['golden-frieza'].glow);
      this.flash(this.c.copy(actor.group.position).setY(actor.group.position.y + 1.2), 1.4, seed, 2.2, COLOR['golden-frieza'].glow, time);
    }
    if (who === 'gohan-beast') {
      this.dome(actor.state.id, time, 4.2, BEAST_RIM, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', BEAST_RIM);
      this.crack(head.setY(head.y + .4), this.up, time, seed, 3, 14, COLOR['gohan-beast'].glow);
    }
    if (who === 'akaza') {
      this.dome(actor.state.id, time, 4.2, COMPASS, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COMPASS);
      this.crack(head.setY(head.y + .3), this.up, time, seed, 2.8, 12, COLOR.akaza.glow);
    }
    if (who === 'itachi') {
      this.dome(actor.state.id, time, 4.2, SUSANOO, 1.2);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', SUSANOO);
      this.crack(head.setY(head.y + .5), this.up, time, seed, 2.8, 12, SUSANOO);
    }
    if (who === 'madara') {
      this.dome(actor.state.id, time, 4.6, PERFECT_SUSANOO, 1.3);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', PERFECT_SUSANOO);
      this.crack(head.setY(head.y + .6), this.up, time, seed, 3.2, 14, PERFECT_SUSANOO);
    }
    if (who === 'tanjiro') {
      this.dome(actor.state.id, time, 4, SUN, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', FIRE);
      this.flash(this.c.copy(actor.group.position).setY(actor.group.position.y + 1.1), 1.4, seed, 2.2, SUN, time);
    }
    if (who === 'levi') {
      this.dome(actor.state.id, time, 3.8, WINGS, 1);
      this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 4.2);
    }
    if (who === 'sung-jinwoo') {
      this.dome(actor.state.id, time, 4.4, SHADOW, 1.2);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', SHADOW);
      this.crack(head.setY(head.y + .4), this.up, time, seed, 2.8, 12, SHADOW);
    }
    if (who === 'gon') {
      this.dome(actor.state.id, time, 4.4, COLOR.gon.glow, 1.2);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.gon.glow);
      this.crack(head.setY(head.y + .6), this.up, time, seed, 3, 14, COLOR.gon.glow);
    }
    if (who === 'saitama') {
      this.dome(actor.state.id, time, 4, SERIOUS, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', SERIOUS);
      this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 4.4);
    }
    if (who === 'meruem') {
      this.dome(actor.state.id, time, 4.2, COLOR.meruem.glow, 1.1);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', COLOR.meruem.glow);
      this.crack(head.setY(head.y + .6), this.up, time, seed, 2.6, 12, COLOR.meruem.glow);
    }
    if (who === 'roger') {
      this.dome(actor.state.id, time, 4, HAKI_RED);
      this.strike(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, seed, 'floor', HAKI_RED);
      this.crack(head.setY(head.y + .7), this.up, time, seed, 3, 14, HAKI_RED);
    }
  }

  private cut(who: Emperor | 'wind' | 'sun', at: THREE.Vector3, yaw: number, scale: number, roll: number, time: number, seconds: number, seed: number) {
    this.cutWith(who === 'wind' ? WIND : who === 'sun' ? SUN_CUT : CUT[who], who === 'wind' ? .3 : .18, at, yaw, scale, roll, time, seconds, seed);
  }
  private cutWith(style: SlashStyle, thick: number, at: THREE.Vector3, yaw: number, scale: number, roll: number, time: number, seconds: number, seed: number) {
    const cut = this.cuts.find(c => !c.active) ?? this.cuts.reduce((x, y) => x.since <= y.since ? x : y);
    cut.active = true; cut.since = time; cut.seconds = seconds; cut.mesh.visible = true;
    applySlashStyle(cut.mesh.material, style, seed, 1.25, thick);
    cut.mesh.position.copy(at); cut.mesh.rotation.set(0, yaw, roll); cut.mesh.scale.setScalar(scale);
  }
  private crack(center: THREE.Vector3, normal: THREE.Vector3, time: number, seed: number, reach: number, count: number, color: THREE.Color, seconds = CRACK_SECONDS) {
    const crack = this.cracks.find(c => !c.active) ?? this.cracks.reduce((x, y) => x.since <= y.since ? x : y);
    crack.center.copy(center); crack.normal.copy(normal).normalize(); crack.since = time; crack.seconds = seconds; crack.seed = seed % 997; crack.reach = reach; crack.count = count; crack.color = color; crack.active = true;
  }
  private ring(center: THREE.Vector3, time: number, radius: number, color = RING_WHITE) {
    const ring = this.rings.find(r => !r.active) ?? this.rings.reduce((x, y) => x.since <= y.since ? x : y);
    ring.mesh.position.copy(center); ring.since = time; ring.radius = radius; ring.active = true; ring.mesh.visible = true;
    ring.mesh.material.color.copy(color);
  }
  private dome(actorId: string, time: number, radius: number, rim: THREE.Color, seconds = DOME_SECONDS, lift = .9) {
    const dome = this.domes.find(d => !d.active) ?? this.domes.reduce((x, y) => x.since <= y.since ? x : y);
    dome.actorId = actorId; dome.since = time; dome.radius = radius; dome.seconds = seconds; dome.lift = lift; dome.active = true; dome.mesh.visible = true;
    dome.mesh.material.uniforms.uRim.value.copy(rim);
  }
  private flash(center: THREE.Vector3, strength: number, seed: number, reach: number, color: THREE.Color, time: number, soft = false) {
    const flash = this.flashes.find(f => !f.active) ?? this.flashes.reduce((x, y) => x.since <= y.since ? x : y);
    const dream = DREAM_IMPACT ? (soft ? .2 : .3) : 1, wide = DREAM_IMPACT ? .7 : 1;
    flash.center.copy(center); flash.since = time; flash.seed = seed % 97; flash.strength = strength * dream; flash.reach = reach * wide; flash.color = color; flash.active = true;
    flash.soft = soft;
  }
  private beam(from: THREE.Vector3, to: THREE.Vector3, time: number, seed: number, width: number, color: THREE.Color, seconds = BEAM_SECONDS) {
    const beam = this.beams.find(b => !b.active) ?? this.beams.reduce((x, y) => x.since <= y.since ? x : y);
    beam.from.copy(from); beam.to.copy(to); beam.since = time; beam.seconds = seconds; beam.seed = seed % 997; beam.width = width; beam.color = color; beam.active = true;
  }
  private strike(center: THREE.Vector3, targetId: string, time: number, seed: number, kind: Strike['kind'], color: THREE.Color) {
    const strike = this.strikes.find(s => !s.active) ?? this.strikes.reduce((x, y) => x.since <= y.since ? x : y);
    strike.center.copy(center); strike.targetId = targetId; strike.since = time; strike.seed = seed % 997; strike.kind = kind; strike.color = color; strike.active = true;
  }
  private facing(actor: Fighter) { this.forward.set(Math.sin(actor.state.yaw), 0, Math.cos(actor.state.yaw)); }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, density: number, camera?: THREE.Camera) {
    const kit = this.kit; kit.begin(time, density); this.ink.begin();
    this.domain.begin();
    if (camera) { camera.getWorldPosition(this.lens); this.seeing = true; }
    this.flameCount = 0; this.flameMaterial.uniforms.uTime.value = time;
    for (const f of this.hidden) { let present = false; for (const g of fighters.values()) if (g === f) { present = true; break; } if (!present) this.hidden.delete(f); }
    for (const f of this.formed.keys()) { let present = false; for (const g of fighters.values()) if (g === f) { present = true; break; } if (!present) this.formed.delete(f); }
    for (const [id, actor] of fighters) {
      const s = actor.state;
      const worn = SUSANOO_TINT[s.fighter];
      if (worn && s.awakened) this.susanoo(actor, worn);
      if (worn && s.action === 'awaken') this.risen.set(id, time);
      const shell = worn ? this.susanoos.get(actor) : undefined;
      if (shell) { if (time - (this.risen.get(id) ?? -9) < 2) shell.fadeRange(.8, 2.2); else shell.fadeRange(3.2, 6.8); }
      const elapsedNow = s.actionTime * s.actionDuration, blink = s.action === 'heavy' && !s.branch ? BLINKS[s.fighter] : undefined;
      const gone = s.alive && !!blink && elapsedNow >= blink.vanish && elapsedNow < blink.appear + APPEAR_HOLD;
      if (gone !== this.hidden.has(actor)) {
        actor.group.visible = !gone;
        if (gone) this.hidden.add(actor); else this.hidden.delete(actor);
      }
      const forming = s.alive && s.fighter === 'itachi' && s.action === 'heavy' && !s.branch ? elapsedNow - BLINKS.itachi!.appear - APPEAR_HOLD : NaN;
      if (forming >= 0 && forming < FORMED) this.form(actor, forming); else if (this.formed.has(actor)) this.unform(actor);
      if (!EMPERORS.has(s.fighter)) { if (s.alive) this.mainEnder(id, actor, time, fighters); continue; }
      if (!s.alive) continue;
      const who = s.fighter as Emperor, colour = COLOR[who];
      const elapsed = s.actionTime * s.actionDuration, key = Math.round(s.actionStarted * 1000);
      this.facing(actor);
      const ender = s.branch && (s.action === 'heavy' || s.action === 'special') ? s.branch : undefined;
      const enderMove = ender ? comboMove(who, ender, !!s.awakened) : undefined;
      if (s.action === 'light' || s.action === 'heavy' && (ender ? enderMove?.style === 'melee' && ender !== 'airSpecial' : who !== 'akaza' && MOVES[who].heavy.style === 'melee')) {
        const move = s.action === 'light' ? rushMove(who, s.chain ?? 0, !!s.awakened) : enderMove ?? MOVES[who].heavy;
        const contact = move.contacts[0];
        if (elapsed >= contact && elapsed < contact + .1 && this.drawn.get(id) !== key) {
          this.drawn.set(id, key);
          const big = s.action === 'heavy';
          this.a.copy(actor.group.position).addScaledVector(this.forward, big ? 1.5 : 1.3).setY(actor.group.position.y + (big ? 1.0 : 1.15));
          let yaw = s.yaw;
          const struck = s.target ? fighters.get(s.target) : undefined;
          if (struck && struck !== actor && struck.state.alive) {
            const dx = struck.group.position.x - actor.group.position.x, dz = struck.group.position.z - actor.group.position.z, d = Math.hypot(dx, dz);
            if (d > .3 && d < 4.5 && (dx * this.forward.x + dz * this.forward.z) / d > .5) {
              this.a.copy(struck.group.position).setY(struck.group.position.y + (big ? 1.0 : 1.15));
              yaw = Math.atan2(dx, dz);
            }
          }
          if (who === 'aizen' && !s.awakened && s.action === 'light' && s.chain === 2) {
            this.flash(this.b.copy(actor.group.position).setY(actor.group.position.y + 1.1), .8, key + 3, 1.2, colour.glow, time);
            this.ring(this.c.copy(actor.group.position).setY(actor.group.position.y + .05), time, 1.6);
          }
          if (who === 'aizen' && s.awakened && !big && !(s.action === 'light' && s.chain === 2)) {
            this.crack(this.a, this.forward, time, key, big ? 2.2 : 1.1, big ? 12 : 7, colour.glow);
            this.flash(this.a, big ? .9 : .5, key, big ? 1.4 : .9, colour.glow, time);
          }
          if (who === 'jiren') this.prideBlow(actor, big, s.chain ?? 0, key, time);
          else if (who === 'golden-frieza') this.emperorBlow(actor, big, s.chain ?? 0, key, time);
          else if (who === 'gohan-beast') this.beastBlow(actor, big, s.chain ?? 0, key, time);
          else if (who === 'saitama') this.heroBlow(actor, big, s.chain ?? 0, key, time);
          else if (who === 'akaza') this.demonBlow(actor, s.chain ?? 0, key, time);
          else if (who === 'gon') this.hunterBlow(actor, big, s.chain ?? 0, key, time);
          else if ((who !== 'aizen' || !s.awakened || big || s.chain === 2) && !(who === 'goku-black' && big))
            this.cut(who, this.a, yaw, big ? 3.4 : 2.7, (s.chain ?? 0) % 2 ? -.5 : .5, time, big ? .3 : CUT_SECONDS, key);
          if (who === 'levi')
            this.cut('levi', this.b.copy(this.a).setY(this.a.y - .25), yaw, big ? 3 : 2.4, (s.chain ?? 0) % 2 ? .5 : -.5, time + .03, CUT_SECONDS, key + 9);
          if (who === 'meruem' && s.action === 'light' && !s.chain)
            for (let i = 0; i < 2; i++) {
              this.b.copy(this.a).setY(this.a.y + (i ? -.22 : .22));
              this.cut('meruem', this.b, yaw, 2.4, .5, time + .02 * (i + 1), CUT_SECONDS, key + 11 * (i + 1));
            }
          if (who === 'sukuna' && !big)
            for (let i = 0; i < 2; i++) {
              const r = kit.painter.rng.seed(key * 3 + i);
              this.b.copy(this.a).addScaledVector(this.forward, .3 + r.next() * .5).setY(this.a.y + r.signed() * .35);
              this.cut('sukuna', this.b, s.yaw + r.signed() * .3, 1.6 + r.next() * .6, r.signed() * 1.3, time + .03 * (i + 1), CUT_SECONDS, key + 17 * (i + 1));
            }
          if (big && who !== 'shanks' && who !== 'roger' && who !== 'aizen' && who !== 'sukuna' && who !== 'golden-frieza' && who !== 'jiren' && who !== 'itachi') this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.6).setY(actor.group.position.y + .05), time, 2.2);
        }
      }
      if (who === 'goku-black' && s.action === 'heavy' && !ender) this.transmission(id, actor, elapsed, key, time);
      if (who === 'itachi' && s.action === 'heavy' && !ender) this.crowClone(id, actor, elapsed, key, time, fighters);
      if (who === 'itachi' && !(s.action === 'heavy' && !ender && s.alive)) this.clones.get(id)?.release();
      if (who === 'akaza' && s.action === 'heavy' && !ender) this.disorder(id, actor, elapsed, key, time, fighters);
      if (who === 'jiren' && s.action === 'heavy' && !ender) this.risingFist(id, actor, elapsed, key, time);
      if (who === 'saitama' && s.action === 'heavy' && !ender) this.sneeze(id, actor, elapsed, key, time);
      if (who === 'aizen') this.illusion(id, actor, elapsed, key, time);
      if (who === 'sukuna' && s.action === 'ultimate') this.fourHandedSign(actor, elapsed);
      if (who === 'madara' && !(s.action === 'ultimate' && s.alive)) this.hideMeteor(id);
      if (who === 'levi' && !(s.action === 'ultimate' && s.alive)) this.whirls.get(id)?.hide();
      if (who === 'goku-black' && !(s.action === 'ultimate' && s.alive)) this.hideScythe(id);
      if (who === 'aizen' && !(s.action === 'ultimate' && s.alive)) this.hideCoffin(id);
      if (who === 'madara') {
        const forearm = actor.bones.get('rightforearm');
        if (s.alive && s.action === 'light' && (s.chain ?? 0) === 0 && forearm) {
          let slot = this.gunbais.find(m => m.owner === id);
          slot ??= this.gunbais.find(m => !m.owner) ?? this.gunbais[0];
          slot.owner = id;
          forearm.getWorldPosition(this.elbow);
          this.axis.subVectors(actor.handR, this.elbow);
          if (this.axis.lengthSq() < 1e-4) this.axis.copy(this.up); else this.axis.normalize();
          this.side.crossVectors(this.axis, this.up);
          if (this.side.lengthSq() < 1e-4) this.side.copy(this.forward);
          this.side.normalize();
          this.tip.crossVectors(this.side, this.axis).normalize();
          const fan = slot.fan;
          fan.matrix.makeBasis(this.side, this.axis, this.tip).setPosition(this.a.copy(actor.handR).addScaledVector(this.axis, -.1));
          fan.matrixAutoUpdate = false; fan.matrixWorldNeedsUpdate = true; fan.visible = true;
        } else this.hideGunbai(id);
      }
      if (s.action === 'special' && !ender) this.special(who, id, actor, elapsed, key, time, fighters);
      if (ender && enderMove && s.alive) this.ender(who, SHOP_LOOK[who], id, actor, ender, enderMove, elapsed, key, time, fighters);
      if (s.action === 'ultimate') this.ultimate(who, id, actor, elapsed, key, time, fighters);
      const haki = who === 'shanks' || who === 'roger';
      if (s.awakened && kit.ticked && density > .2) for (let pass = 0; pass < (haki ? 2 : 1); pass++) {
        const r = kit.painter.rng.seed(kit.tick * 31 + key + pass * 977);
        if (r.next() < (who === 'whitebeard' ? .25 : haki ? .9 : .55)) {
          actor.strikePoint(this.tip);
          const from = r.next() < .5 ? actor.handR : actor.handL;
          this.a.set(r.signed() * .5, r.signed() * .6 + .3, r.signed() * .5).add(from);
          if (who === 'whitebeard') for (let i = 0; i < 5; i++) {
            const angle = i / 5 * Math.PI * 2 + r.signed() * .4;
            this.b.copy(this.a).addScaledVector(this.forward, .05).y += Math.sin(angle) * .45;
            this.b.addScaledVector(this.c.set(this.forward.z, 0, -this.forward.x), Math.cos(angle) * .45);
            kit.arc(this.a, this.b, kit.tick * 7 + i + key, .014, colour.glow, .8, 1, 2, .5);
          }
          else if (haki) this.hakiBolt(from, r.next() < .5 ? this.tip : this.a, kit.tick * 7 + 3 + pass * 131, .05, .95);
          else kit.arc(from, r.next() < .5 ? this.tip : this.a, kit.tick * 7 + 3, .03, colour.glow, .9, 1, 3, .34);
        }
      }
    }
    if (this.crows) {
      const dt = Number.isFinite(this.crowsAt) ? THREE.MathUtils.clamp(time - this.crowsAt, 0, .1) : 0;
      this.crowsAt = time;
      this.crows.update(time, dt, this.seeing ? this.lens : undefined);
    }
    this.draw(time, fighters, density);
    this.drawSignatures(time, fighters);
    const lights = kit.lights, lit = lights.mesh.instanceColor!.array as Float32Array;
    for (let i = 0; i < lights.count * 3; i++) lit[i] *= LIGHT_SCALE;
    kit.end(COLOR.kaido.glow); this.ink.end();
    this.domain.end();
    this.flames.count = this.flameCount; this.flames.instanceMatrix.needsUpdate = true;
    if (this.flames.instanceColor) this.flames.instanceColor.needsUpdate = true;
  }

  private prideBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR.jiren;
    if (heavy) {
      this.side.set(this.forward.z, 0, -this.forward.x);
      for (let i = 0; i < 5; i++) {
        const out = i - 2;
        this.b.copy(actor.handR).addScaledVector(this.side, out * .13).addScaledVector(this.up, -.35 + Math.abs(out) * .1);
        this.c.copy(this.b).addScaledVector(this.side, out * .08).setY(this.b.y + 2.3 - Math.abs(out) * .45);
        this.beam(this.b, this.c, time + Math.abs(out) * .025, key + i, .045 - Math.abs(out) * .006, colour.glow, .26);
      }
      this.flash(this.c.copy(this.a).setY(this.a.y + .5), .6, key, 1.1, colour.glow, time);
      return;
    }
    const heel = chain === 3;
    this.crack(this.a, this.forward, time, key, heel ? 1.7 : 1, heel ? 10 : 6, colour.glow);
    this.flash(this.a, heel ? .9 : .55, key, heel ? 1.4 : .9, colour.glow, time);
    if (heel) this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + .05), time, 2.6);
  }

  private beastBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR['gohan-beast'];
    if (heavy) {
      this.cut('gohan-beast', this.b.copy(this.a).setY(this.a.y + .3), actor.state.yaw, 3.2, -1.3, time, .3, key);
      this.crack(this.c.copy(this.a).setY(this.a.y + .5), this.forward, time, key, 2, 11, colour.glow);
      this.flash(this.c, .9, key, 1.5, colour.glow, time);
      return;
    }
    const hammer = chain === 3;
    this.crack(this.a, this.forward, time, key, hammer ? 1.7 : 1, hammer ? 10 : 6, colour.glow);
    this.flash(this.a, hammer ? .9 : .5, key, hammer ? 1.4 : .85, colour.glow, time);
    if (hammer) this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + .05), time, 2.6);
  }

  private heroBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR.saitama;
    if (heavy) {
      this.cut('saitama', this.b.copy(this.a).setY(this.a.y + .35), actor.state.yaw, 3.2, 1.4, time, .3, key);
      this.crack(this.c.copy(this.a).setY(this.a.y + .6), this.up, time, key, 2.2, 12, colour.glow);
      this.flash(this.c, 1, key, 1.6, colour.glow, time);
      return;
    }
    const kick = chain === 3;
    this.crack(this.a, this.forward, time, key, kick ? 1.8 : 1, kick ? 11 : 6, colour.glow);
    this.flash(this.a, kick ? .95 : .5, key, kick ? 1.5 : .85, colour.glow, time);
    if (kick) this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + .05), time, 2.8);
  }

  private hunterBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR.gon;
    if (heavy) {
      this.cut('gon', this.b.copy(this.a).setY(this.a.y + .1), actor.state.yaw, 3.8, -.35, time, .32, key);
      this.flash(this.b, .8, key, 1.3, colour.glow, time);
      return;
    }
    const rising = chain === 3;
    this.crack(this.a, rising ? this.up : this.forward, time, key, rising ? 1.6 : 1, rising ? 10 : 6, colour.glow);
    this.flash(this.a, rising ? .9 : .55, key, rising ? 1.4 : .9, colour.glow, time);
  }

  private demonBlow(actor: Fighter, chain: number, key: number, time: number) {
    const colour = COLOR.akaza;
    this.crack(this.a, this.forward, time, key, chain === 3 ? 1.7 : 1, chain === 3 ? 10 : 6, colour.glow);
    this.flash(this.a, chain === 3 ? .9 : .5, key, chain === 3 ? 1.4 : .85, colour.glow, time);
    if (chain === 0) this.cut('wind', this.b.copy(this.a).addScaledVector(this.forward, 1.1), actor.state.yaw, 2.2, .1, time + .03, .3, key + 5);
    if (chain === 3) this.ring(this.b.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + .05), time, 2.6);
  }

  private risingFist(id: string, actor: Fighter, elapsed: number, key: number, time: number) {
    const move = MOVES.jiren.heavy, contact = move.contacts[0], colour = COLOR.jiren, vfx = VfxKit.for(this.scene);
    const gather = THREE.MathUtils.smoothstep(elapsed, .04, contact - .08) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .08));
    if (gather > .03) this.kit.ball(actor.handR, gather * .5, 71, NaN, colour.glow, colour.light, .38);
    const floor = actor.group.position.y;
    if (elapsed >= contact * .6 && this.drawn.get(`${id}:rise`) !== key) {
      this.drawn.set(`${id}:rise`, key);
      vfx.marks.mark(MARK.crack, actor.group.position.x, floor, actor.group.position.z, 0, 1, 0, 1.9, time, 2.2, 0x000000, 0);
    }
    if (elapsed >= contact && this.drawn.get(`${id}:erupt`) !== key) {
      this.drawn.set(`${id}:erupt`, key);
      this.side.set(this.forward.z, 0, -this.forward.x);
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + .4, x = Math.sin(angle), z = Math.cos(angle);
        this.a.copy(actor.group.position).addScaledVector(this.forward, .35 + z * .5).addScaledVector(this.side, x * .5);
        vfx.debris.burst(4, this.a.x, floor + .05, this.a.z, (this.forward.x * z + this.side.x * x) * .8, 1, (this.forward.z * z + this.side.z * x) * .8, 6.5, .4, .14, floor, 1.4);
      }
    }
  }

  private disorder(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const move = MOVES.akaza.heavy, colour = COLOR.akaza, kit = this.kit, contacts = move.contacts, last = contacts.length - 1;
    const first = contacts[0], end = contacts[last];
    if (elapsed < first || elapsed > end + .1) return;
    this.a.copy(actor.group.position).addScaledVector(this.forward, 1.3).setY(actor.group.position.y + 1.15);
    const struck = actor.state.target ? fighters.get(actor.state.target) : undefined;
    if (struck && struck !== actor && struck.state.alive) {
      const dx = struck.group.position.x - actor.group.position.x, dz = struck.group.position.z - actor.group.position.z, d = Math.hypot(dx, dz);
      if (d > .3 && d < 3.5 && (dx * this.forward.x + dz * this.forward.z) / d > .5)
        this.a.copy(struck.group.position).addScaledVector(this.forward, -.3).setY(struck.group.position.y + 1.15);
    }
    this.side.set(this.forward.z, 0, -this.forward.x);
    const vfx = VfxKit.for(this.scene);
    const beat = Math.floor((elapsed - first) / .0625), mark = key * 64 + beat;
    if (this.drawn.get(`${id}:flurry`) !== mark) {
      this.drawn.set(`${id}:flurry`, mark);
      const r = kit.painter.rng.seed(mark);
      this.b.copy(this.a).addScaledVector(this.side, r.signed() * .38).addScaledVector(this.up, r.signed() * .32);
      this.flash(this.b, .2, mark, .4, colour.glow, time);
      vfx.ring(this.b.x, this.b.y, this.b.z, .08, .42, time, .12, 0xffffff, 0xff9ad0, .1, 'plane', this.forward.x, 0, this.forward.z);
    }
    contacts.forEach((at, blow) => {
      const hit = key * 8 + blow;
      if (elapsed < at || elapsed > at + .1 || this.drawn.get(`${id}:disorder`) === hit) return;
      this.drawn.set(`${id}:disorder`, hit);
      const final = blow === last;
      const burst = final ? this.b.copy(this.a).addScaledVector(this.forward, .5) : this.a;
      this.crack(burst, this.forward, time, hit, final ? 1 : .55, final ? 9 : 5, colour.glow, final ? .3 : .22);
      for (const hand of [-1, 1]) {
        this.c.copy(this.side).multiplyScalar(hand * .26).addScaledVector(this.forward, -.18);
        vfx.ghosts.spawn(actor, ghostTint('akaza'), time + (hand > 0 ? .03 : 0), .13, .3, this.c);
      }
      if (final) {
        this.flash(burst, .6, hit, .9, colour.glow, time);
        vfx.ring(burst.x, burst.y, burst.z, .2, 1.2, time, .3, 0xffffff, 0xff9ad0, .14, 'plane', this.forward.x, 0, this.forward.z);
        const floor = actor.group.position.y;
        vfx.debris.burst(7, this.a.x + this.forward.x * .3, floor + .05, this.a.z + this.forward.z * .3, this.forward.x, .9, this.forward.z, 6.5, .55, .12, floor, 1.5);
      }
    });
  }

  private emperorBlow(actor: Fighter, heavy: boolean, chain: number, key: number, time: number) {
    const colour = COLOR['golden-frieza'];
    if (heavy) {
      this.cut('golden-frieza', this.a.setY(actor.group.position.y + .7), actor.state.yaw, 4, .12, time, .32, key);
      this.ring(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), time, 2.8);
      this.flash(this.a, .8, key, 1.3, colour.glow, time);
      return;
    }
    if (chain === 0 || chain === 2) {
      const tip = this.b.copy(actor.handR).addScaledVector(this.forward, .12);
      this.beam(tip, this.c.copy(tip).addScaledVector(this.forward, chain ? 2.2 : 3.4), time, key, chain ? .035 : .045, DEATH);
      this.flash(tip, .5, key, .8, DEATH, time);
      return;
    }
    this.cut('golden-frieza', this.a, actor.state.yaw, 2.8, chain === 1 ? -.35 : .2, time, CUT_SECONDS, key);
  }

  private aimOf(actor: Fighter, fighters: ReadonlyMap<string, Fighter>, out: THREE.Vector3, reach: number) {
    const target = actor.state.target ? fighters.get(actor.state.target) : undefined;
    if (target?.state.alive) {
      out.copy(target.group.position).setY(target.group.position.y + 1.1);
      const dx = out.x - actor.group.position.x, dz = out.z - actor.group.position.z;
      if (Math.hypot(dx, dz) < reach && dx * this.forward.x + dz * this.forward.z > 0) return out;
    }
    return out.copy(actor.group.position).addScaledVector(this.forward, 14).setY(actor.group.position.y + 1.2);
  }

  private compassNeedle(actor: Fighter, elapsed: number, contact: number, key: number, time: number, reach: number) {
    const kit = this.kit;
    const open = THREE.MathUtils.smoothstep(elapsed, .05, contact * .8) * (1 - THREE.MathUtils.smoothstep(elapsed, contact + .25, contact + .55));
    if (open > .02) {
      const radius = reach * open, y = actor.group.position.y + .04;
      for (let arm = 0; arm < 6; arm++) {
        const yaw = actor.state.yaw + arm * Math.PI / 3, dx = Math.sin(yaw), dz = Math.cos(yaw);
        this.a.copy(actor.group.position).setY(y);
        this.b.set(this.a.x + dx * radius, y, this.a.z + dz * radius);
        kit.arc(this.a, this.b, key + arm * 5, .03 * open, COMPASS, 1.1 * open, 0, 1, .02);
        for (const at of [.45, .72]) {
          this.c.set(this.a.x + dx * radius * at, y, this.a.z + dz * radius * at);
          for (const side of [-1, 1]) {
            const branch = yaw + side * .7;
            this.tip.set(this.c.x + Math.sin(branch) * radius * .22, y, this.c.z + Math.cos(branch) * radius * .22);
            kit.arc(this.c, this.tip, key + arm * 11 + (side > 0 ? 1 : 2) + Math.round(at * 10), .02 * open, COMPASS, .9 * open, 0, 1, .02);
          }
        }
      }
    }
  }

  private sneeze(id: string, actor: Fighter, elapsed: number, key: number, time: number) {
    const contact = MOVES.saitama.heavy.contacts[0];
    if (elapsed < contact || elapsed > contact + .1 || this.drawn.get(`${id}:sneeze`) === key) return;
    this.drawn.set(`${id}:sneeze`, key);
    const vfx = VfxKit.for(this.scene), floor = actor.group.position.y, face = this.eye(actor, this.a);
    for (let i = 0; i < 4; i++) {
      this.b.copy(face).addScaledVector(this.forward, 1.1 + i * 2.6).setY(face.y - i * .12);
      this.cut('wind', this.b, actor.state.yaw, 2.4 + i * 1.1, i % 2 ? .45 : -.45, time + i * .05, .4, key + i * 7);
    }
    for (let i = 0; i < 6; i++) {
      this.b.copy(face).addScaledVector(this.forward, .7 + i * 2.3).setY(face.y - i * .1);
      vfx.ring(this.b.x, this.b.y, this.b.z, .25 + i * .2, 1 + i * .45, time + i * .05, .3, 0xffffff, 0xdfe8ff, .1, 'plane', this.forward.x, 0, this.forward.z);
    }
    vfx.dustSpray(actor.group.position.x + this.forward.x * 1.6, floor, actor.group.position.z + this.forward.z * 1.6, this.forward.x, this.forward.z, 8, 5, .8, time, .55, .6);
  }

  private tailStorm(actor: Fighter, mark: number, time: number, radius: number) {
    this.ring(this.a.copy(actor.group.position).setY(actor.group.position.y + .05), time, radius);
    for (let i = 0; i < 3; i++) {
      const yaw = actor.state.yaw + i * Math.PI * 2 / 3;
      this.b.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(1.6).add(actor.group.position).setY(actor.group.position.y + .5);
      this.cut('meruem', this.b, yaw + Math.PI / 2, 3.2, .25, time + i * .03, .32, mark * 7 + i);
    }
    this.flash(this.a.setY(actor.group.position.y + .8), .9, mark, 1.6, COLOR.meruem.glow, time);
  }

  private ender(who: FighterId, look: EnderLook, id: string, actor: Fighter, ender: ComboKey, move: MoveDefinition, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const s = actor.state, contact = move.contacts[0];
    if (who === 'akaza' && ender === 'llls') { this.compassNeedle(actor, elapsed, contact, key, time, move.radius); }
    const accent = (s.awakened ? AWAKENED_ACCENTS[who]?.[ender] : undefined) ?? ENDER_ACCENTS[who]?.[ender];
    if (accent && !(ender === 'airSpecial' && !s.grounded) && !(look.el && move.style === 'projectile')) {
      const target = s.target ? fighters.get(s.target) : undefined, point = this.tip;
      if (ender === 'airSpecial' || !target?.state.alive) point.copy(actor.group.position).addScaledVector(this.forward, ender === 'airSpecial' ? 0 : 1.4);
      else point.copy(target.group.position);
      if (accent === 'bolt' && elapsed >= contact - .06 && elapsed < contact + .22) for (let i = 0; i < 3; i++) {
        this.c.set(point.x + Math.sin(i * 2.1 + key) * .6, point.y + 4.5, point.z + Math.cos(i * 2.1 + key) * .6);
        this.b.copy(point).setY(point.y + 1.2);
        this.kit.arc(this.c, this.b, key * 5 + i + this.kit.tick, .03, look.glow, 1, 2, 3, .32);
      }
      if (accent !== 'bolt' && elapsed >= contact && elapsed < contact + .9) {
        const ignite = THREE.MathUtils.smoothstep(elapsed, contact, contact + .2), fade = 1 - THREE.MathUtils.smoothstep(elapsed, contact + .5, contact + .9);
        this.flameField(this.c.copy(point).setY(actor.group.position.y), ender === 'airSpecial' ? move.radius * .8 : 1.4, ignite, fade, time, FLAME_OF[accent], Math.round(70 * Math.min(1, this.kit.density)), FLAME_TALL[who]?.[ender] ?? 1.1);
      }
    }
    if (elapsed < contact || elapsed > contact + .12 && !(look.el && ender === 'airSpecial') || this.enderDrawn.get(id) === key) return;
    if (ender === 'airSpecial' && !s.grounded) return;
    this.enderDrawn.set(id, key);
    if (look.el && move.style === 'projectile') { this.enderMuzzle(look, actor, key, time); return; }
    const target = s.target ? fighters.get(s.target) : undefined, reach = Math.max(move.range, 2.2) + 1.2;
    const dx = target ? target.group.position.x - actor.group.position.x : 0, dz = target ? target.group.position.z - actor.group.position.z : 0;
    const onTarget = !!target?.state.alive && Math.hypot(dx, dz) < reach && dx * this.forward.x + dz * this.forward.z > 0;
    if (onTarget && (target!.state.guarding || target!.state.action === 'guard') && !move.guardBreak && ender !== 'lllh' && ender !== 'airSpecial') return;
    const at = onTarget
      ? this.a.copy(target!.group.position).setY(target!.group.position.y + 1.1) : this.a.copy(actor.group.position).addScaledVector(this.forward, 1.4).setY(actor.group.position.y + 1.1);
    const field = look.el && move.style === 'field' && ender !== 'airSpecial' ? this.enderAt.get(id) : undefined;
    if (field && Math.abs(field.since - s.actionStarted) < .3) at.set(field.at.x, actor.group.position.y + 1.1, field.at.z);
    this.decorate(who, look, ender, move, at, actor.group.position.y, key, time, actor);
  }
  private decorate(who: FighterId, look: EnderLook, ender: ComboKey, move: MoveDefinition, at: THREE.Vector3, floor: number, key: number, time: number, actor: Fighter) {
    const s = actor.state;
    switch (ender) {
      case 'lh':
        this.a.setY(floor + 1.05);
        if (look.cracks) this.crack(this.a, this.forward, time, key, 1.8, 10, look.glow);
        this.flash(this.a, .9, key, 1.5, look.glow, time, look.soft);
        break;
      case 'llh':
        this.a.setY(floor + .9);
        if (look.cracks) this.crack(this.a, this.up, time, key, 2.2, 9, look.glow);
        this.flash(this.a, .9, key, 1.5, look.glow, time, look.soft);
        this.ring(this.b.copy(at).setY(floor + .05), time, 1.5, look.ring);
        break;
      case 'lllh':
        this.ring(this.b.copy(at).setY(floor + .05), time, 2.2, look.ring);
        if (look.cracks) this.crack(this.c.copy(at).setY(floor + .08), this.up, time, key, 2.4, 12, look.glow);
        this.flash(this.a.setY(floor + .6), 1, key, 1.7, look.glow, time, look.soft);
        VfxKit.for(this.scene).groundImpact(at.x, floor, at.z, 0, 1, 0, 2, time, undefined, floor);
        break;
      case 'llls':
        this.a.setY(floor + 1.5);
        this.flash(this.a, .8, key, 1.3, look.glow, time, look.soft);
        this.ring(this.b.copy(at).setY(floor + 1.75), time, .7, look.ring);
        break;
      case 'airHeavy':
        this.cutWith(look.cut, .18, this.a.setY(Math.max(floor + .8, this.a.y + .9)), s.yaw, 3, 1.45, time, .3, key);
        this.flash(this.a, .8, key, 1.4, look.glow, time, look.soft);
        break;
      case 'airSpecial': {
        if (who === 'meruem' && !s.awakened) this.tailStorm(actor, key, time, move.radius);
        const ground = this.b.copy(actor.group.position).setY(floor + .05);
        this.ring(ground, time, move.radius, look.ring);
        this.ring(this.c.copy(ground), time + .06, move.radius * .6, look.ring);
        if (look.cracks) this.crack(this.c.copy(ground).setY(floor + .1), this.up, time, key, move.radius * .7, 14, look.glow);
        this.flash(this.a.copy(ground).setY(floor + .8), 1.1, key, 2, look.glow, time, look.soft);
        VfxKit.for(this.scene).groundImpact(ground.x, floor, ground.z, 0, 1, 0, 3, time, undefined, floor);
        VfxKit.for(this.scene).pulse(ground.x, floor + 1.4, ground.z, look.glow.getHex(), 7, move.radius * 2, time, .3);
        break;
      }
    }
    if (look.el) this.mainAccent(look, ender, move, at, floor, key, time, actor);
  }

  private mainEnder(id: string, actor: Fighter, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const s = actor.state, branch = s.branch && (s.action === 'heavy' || s.action === 'special') ? s.branch : undefined;
    if (!branch) return;
    const look = mainLook(s.fighter, branch, !!s.awakened), move = look?.move;
    if (!look || !move) return;
    this.facing(actor);
    this.ender(s.fighter, look, id, actor, branch, move, s.actionTime * s.actionDuration, Math.round(s.actionStarted * 1000), time, fighters);
  }
  private enderMuzzle(look: EnderLook, actor: Fighter, key: number, time: number) {
    const v = this.vfx ??= VfxKit.for(this.scene), el = look.el!, hand = this.m1.copy(actor.handR).addScaledVector(this.forward, .25);
    this.flash(hand, .55, key, .9, look.glow, time, true);
    v.ring(hand.x, hand.y, hand.z, .1, .9, time, .2, 0xffffff, el.rim, .1, 'plane', this.forward.x, 0, this.forward.z);
    v.streaks(hand.x, hand.y, hand.z, el, v.n(6, 3), 10, .02, time, this.forward, 1.4, 2);
  }
  private mainEvent(event: CombatEvent, fighter: FighterId, fighters: ReadonlyMap<string, Fighter>) {
    if (event.kind === 'hit' && event.endpoint && event.branch) {
      const actor = fighters.get(event.actorId), awakened = !!actor?.state.awakened, found = mainLook(fighter, event.branch, awakened), move = found?.move;
      const look = move?.style === 'projectile' ? found : undefined;
      const throwKey = event.actionSeq ?? Math.round(event.serverTime * 4);
      if (actor && move && look && this.enderHit.get(event.actorId) !== throwKey) {
        this.enderHit.set(event.actorId, throwKey);
        const victim = event.targetId ? fighters.get(event.targetId) : undefined;
        if (event.origin) { this.forward.set(event.endpoint.x - event.origin.x, 0, event.endpoint.z - event.origin.z); if (this.forward.lengthSq() < 1e-6) this.facing(actor); else this.forward.normalize(); }
        else this.facing(actor);
        const at = victim ? this.a.copy(victim.group.position).setY(victim.group.position.y + 1.1) : this.a.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
        this.decorate(fighter, look, event.branch, move, at, victim ? victim.group.position.y : event.endpoint.y - 1.05, throwKey, event.serverTime, actor);
      }
    }
    if (event.kind === 'cast' && event.endpoint) {
      const held = this.enderAt.get(event.actorId) ?? {at: new THREE.Vector3(), since: 0};
      held.at.set(event.endpoint.x, event.endpoint.y, event.endpoint.z); held.since = event.serverTime; this.enderAt.set(event.actorId, held);
    }
    if (event.kind === 'hit' && event.outcome === 'dizzy' && event.targetId) {
      const look = mainLook(fighter, event.branch!, !!fighters.get(event.actorId)?.state.awakened);
      if (!look) return;
      const daze = this.dazes.find(d => !d.active) ?? this.dazes.reduce((x, y) => x.since <= y.since ? x : y);
      daze.targetId = event.targetId; daze.since = event.serverTime; daze.active = true; daze.glow = look.glow; daze.electric = look.flavour === 'bolt' || look.flavour === 'blackFlash'; daze.seed = event.id % 97;
    }
  }
  private mainAccent(look: EnderLook, ender: ComboKey, move: MoveDefinition, at: THREE.Vector3, floor: number, key: number, time: number, actor: Fighter) {
    const v = this.vfx ??= VfxKit.for(this.scene), el = look.el!, f = this.forward, sp = v.sparks.spec, p = this.m1.copy(at);
    switch (ender) {
      case 'lh':
        v.ring(p.x, p.y, p.z, .2, 2.8, time, .32, 0xffffff, el.rim, .12, 'plane', f.x, 0, f.z);
        v.ring(p.x, p.y, p.z, .3, 1.5, time + .04, .24, el.spike, el.rim, .1);
        v.streaks(p.x, p.y, p.z, el, v.n(14, 5), 15, .03, time, f, 1.6, 2);
        this.flavour(look, 0, p, floor, 1, key, time);
        break;
      case 'llh':
        for (let i = 0; i < 4; i++) v.ring(p.x, floor + .2 + i * .55, p.z, .3, 1.1 + i * .22, time + i * .04, .3, 0xffffff, el.rim, .1, 'flat');
        v.streaks(p.x, floor + .3, p.z, el, v.n(16, 6), 13, .028, time, UP, 1.8, -3);
        sp.reset(SPRITE.glow, time, .3).pos(p.x, floor + 1.6, p.z).sized(DREAM_IMPACT ? .14 : .32, DREAM_IMPACT ? .2 : .45, .3).hot(el.rim, DREAM_IMPACT ? .8 : 1.3); sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.stretch = 6; v.sparks.emit();
        this.flavour(look, 1, p, floor, 1, key, time);
        break;
      case 'lllh':
        if (v.quality !== 'low') v.marks.mark(MARK.crack, p.x, floor, p.z, 0, 1, 0, 2.6, time, 2.6, el.light, .6);
        v.debris.burst(v.n(5, 2), p.x, floor, p.z, 0, 1, 0, 7, .9, .12, floor, 2);
        v.ring(p.x, floor + .06, p.z, .5, 3.6, time, .42, 0xffffff, el.rim, .18, 'flat');
        v.streaks(p.x, p.y + .4, p.z, el, v.n(10, 4), 11, .026, time, DOWN, 1.3, 9);
        this.flavour(look, 2, p, floor, 1.6, key, time);
        break;
      case 'llls': {
        if (look.flavour === 'inhale') this.inhale(el, p, actor, floor, time);
        const h = look.flavour === 'infinity' ? this.m2.copy(actor.group.position).setY(floor + 1.2) : this.m2.copy(p).setY(floor + 1.65);
        sp.reset(SPRITE.star, time, .24).pos(h.x, h.y, h.z).sized(.4, 1.3, .25).hot(0xffffff, 1.4).cool(el.rim, .4); sp.rotation = key % 6; v.sparks.emit();
        v.ring(h.x, h.y + .15, h.z, .25, 1.1, time, .36, el.spike, el.rim, .12, 'flat');
        this.flavour(look, 3, h, floor, .8, key, time);
        break;
      }
      case 'airHeavy':
        v.streaks(p.x, p.y, p.z, el, v.n(12, 5), 14, .03, time, DOWN, 1.6, 12);
        v.ring(p.x, p.y, p.z, .2, 2.2, time, .26, 0xffffff, el.rim, .1, 'flat');
        this.flavour(look, 0, p, floor, 1, key, time);
        break;
      case 'airSpecial': {
        const R = move.radius, g = this.m2.copy(actor.group.position);
        if (v.quality !== 'low') v.marks.mark(MARK.crack, g.x, floor, g.z, 0, 1, 0, Math.min(4.5, R * 1.1), time, 3, el.light, .7);
        v.ring(g.x, floor + .07, g.z, .6, R / .86, time, .55, 0xffffff, el.rim, .2, 'flat');
        v.ring(g.x, floor + 1, g.z, .4, R * .9, time + .03, .3, el.spike, el.rim, .08);
        if (look.flavour !== 'steel' && look.flavour !== 'slash') v.scorch(g.x, floor, g.z, 0, 1, 0, R * .85, time, el.light);
        const lit = this.dust.setHex(DUST_LIT).lerp(this.dust2.setHex(el.light), .45).getHex();
        for (let i = 0, n = v.n(8, 4); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a);
          v.smoke(g.x + c * R * .55, floor + .3, g.z + sn * R * .55, c * 3.6, .5, sn * 3.6, .75, time + (i % 3) * .02, .5, lit, DUST_SHADE);
        }
        v.streaks(g.x, floor + .3, g.z, el, v.n(16, 6), 13, .03, time, UP, 1.3, 6);
        v.pulse(g.x, floor + 1.4, g.z, el.light, 12, R * 2.4, time, .4, 2);
        this.flavour(look, 2, g, floor, R, key, time);
        if (involvesLocal(actor.state.id, actor.state.target ?? undefined)) SIGNATURE.screen?.chromaticPulse?.(.6);
        break;
      }
    }
  }
  private flavour(look: EnderLook, shape: 0 | 1 | 2 | 3, p: THREE.Vector3, floor: number, size: number, key: number, time: number) {
    const v = this.vfx!, el = look.el!, f = this.forward, sp = v.sparks.spec, low = shape === 2 ? floor + .45 : p.y;
    switch (look.flavour) {
      case 'chakra':
        if (shape === 0 || shape === 2) for (let i = 0; i < 3; i++) {
          const a = i * 2.094 + key * .7, c = Math.cos(a), sn = Math.sin(a), r = shape === 2 ? .4 * Math.min(size, 3) + .5 : .75;
          v.smoke(p.x + c * r, shape === 2 ? floor + .25 : p.y - .5 + (i % 2) * .3, p.z + sn * r, c * 1.4, .7, sn * 1.4, .5, time + .05 + i * .03, .4, 0xffffff, 0xc4d0e4);
        }
        for (let i = 0; i < 3; i++) {
          if (shape === 2) v.ring(p.x, floor + .1 + i * .3, p.z, .2, (1 + i * .5) * Math.min(size, 3), time + i * .05, .32, 0xffffff, el.rim, .1, 'flat');
          else if (shape === 1) v.ring(p.x, floor + .6 + i * .6, p.z, .2, .9 - i * .15, time + .05 + i * .05, .3, 0xffffff, el.rim, .1, 'flat');
          else v.ring(p.x + f.x * i * .3, p.y, p.z + f.z * i * .3, .15, .8 + i * .35, time + i * .04, .24, 0xffffff, el.rim, .1, 'plane', f.x, 0, f.z);
        }
        break;
      case 'ki':
        if (!DREAM_IMPACT) { sp.reset(SPRITE.core, time, .12).pos(p.x, low, p.z).sized(.35, .9 * Math.min(size, 2), .3).hot(0xffffff, 2.2).cool(el.rim); v.sparks.emit(); }
        sp.reset(SPRITE.flare, time, .2).pos(p.x, low, p.z).sized(.7 * (DREAM_IMPACT ? .5 : 1), 1.8 * Math.min(size, 2) * (DREAM_IMPACT ? .5 : 1), .2).hot(el.spike, DREAM_IMPACT ? .9 : 1.2).cool(el.rim); sp.rotation = key; v.sparks.emit();
        v.ring(p.x, low, p.z, .3, 2.2 * Math.min(size, 2), time, .3, el.spike, el.rim, .08);
        break;
      case 'haki':
        if (shape !== 1) this.strike(this.m3.copy(p).setY(shape === 2 ? floor + .05 : p.y), '', time, key, 'floor', HAKI_RED);
        for (let i = 0; i < 3; i++) v.smoke(p.x + (i - 1) * .3 * f.z, low, p.z - (i - 1) * .3 * f.x, f.x * 2 + (i - 1) * .4, .6, f.z * 2, .55, time + i * .02, .38, 0x3a0c10, 0x0c0204);
        break;
      case 'slash':
        for (let i = 0; i < 2; i++) this.cutWith(look.cut, .18, this.m3.copy(p).setY((shape === 2 ? floor + .9 : p.y) + (i ? -.18 : .18)), this.facingYaw() + (i ? .5 : -.5), shape === 2 ? 3.6 : 2.8, i ? -.9 : .9, time + .03 * (i + 1), .26, key + 11 * (i + 1));
        break;
      case 'fire':
        for (let i = 0, n = v.n(7, 3); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a), r = shape === 2 ? Math.min(size, 3.5) * .45 : .25;
          v.smoke(p.x + c * r, low, p.z + sn * r, c * (shape === 2 ? 2.6 : 1.4) + (shape === 0 ? f.x * 2 : 0), shape === 1 ? 4.5 : 1.6, sn * (shape === 2 ? 2.6 : 1.4) + (shape === 0 ? f.z * 2 : 0), shape === 2 ? .75 : .5, time + i * .015, .42, 0xffb347, 0xd9481e);
        }
        break;
      case 'room':
        v.ring(p.x, floor + .05, p.z, .5, shape === 2 ? size / .86 : 2.6, time, .5, 0xffffff, el.rim, .14, 'flat');
        v.ring(p.x, floor + .05, p.z, .4, shape === 2 ? size * .7 : 1.8, time + .08, .4, el.spike, el.rim, .1, 'flat');
        break;
      case 'cursed':
        sp.reset(SPRITE.core, time, .12).pos(p.x, low, p.z).sized(.35, .9, .3).hot(0xffffff, 2.2).cool(el.rim); v.sparks.emit();
        if (el.rim !== 0x2ec4ff) v.streaks(p.x, low, p.z, el, v.n(14, 5), 13, .03, time, undefined, .5, 1);
        if (el.rim !== 0xff2a1e) for (let i = 0, n = v.n(10, 4); i < n; i++) {
          const a = i * 2.399 + key, c = Math.cos(a), sn = Math.sin(a), r = 1.6, up = (i % 3 - 1) * .5;
          sp.reset(SPRITE.streak, time, .22).pos(p.x + c * r, low + up, p.z + sn * r).velocity(-c * r / .22, -up / .22, -sn * r / .22); sp.orient = ORIENT.velocity;
          sp.sized(.03, .012, .8); sp.stretch = 2.2; sp.trail = .05; sp.hot(el.spike, 1.4).cool(el.rim, 0); v.sparks.emit();
        }
        v.ring(p.x, low, p.z, .25, 2 * Math.min(size, 2), time, .3, 0xffffff, el.rim, .08);
        break;
      case 'stand': case 'flurry':
        for (let i = 0, n = v.n(7, 3); i < n; i++) {
          const r = this.kit.painter.rng.seed(key * 13 + i);
          v.hitSpark(p.x + r.signed() * .55, (shape === 2 ? floor + .3 : p.y) + r.signed() * .5, p.z + r.signed() * .55, el, 0, time + i * .028, f, 1);
        }
        break;
      case 'reiatsu':
        this.cutWith(look.cut, .22, this.m3.copy(p).setY(shape === 2 ? floor + .9 : p.y), this.facingYaw(), shape === 2 ? 4 : 3, shape === 1 ? -1.3 : .4, time, .3, key + 5);
        for (let i = 0; i < 3; i++) v.smoke(p.x - f.x * .3 * i, low, p.z - f.z * .3 * i, f.x * 2, .5, f.z * 2, .65, time + i * .03, .42, 0x3a0b12, 0x120306);
        break;
      case 'steel':
        v.streaks(p.x, low, p.z, STEEL_SPARK, v.n(12, 5), 12, .022, time, f, 1.2, 8);
        v.streaks(p.x, low, p.z, BLOOD_SPRAY, v.n(10, 4), 6, .04, time, f, 1, 10);
        if (shape === 2) v.debris.burst(v.n(10, 4), p.x, floor, p.z, 0, 1, 0, 7, .9, .2, floor, 2.4);
        break;
      case 'bolt':
        v.crackle(this.m3.copy(p).setY(low - .6), this.m4.copy(p).setY(low + .6), .3, el, v.n(10, 4), time);
        if (shape === 2) this.strike(this.m3.copy(p).setY(floor + .05), '', time, key, 'floor', look.glow);
        break;
      case 'flash':
        sp.reset(SPRITE.flare, time, .34).pos(p.x, low, p.z).sized(1.2, 3.4, .2).hot(0xffffff, 2.2).cool(el.rim); sp.rotation = key; v.sparks.emit();
        sp.reset(SPRITE.core, time, .2).pos(p.x, low, p.z).sized(.8, 1.9, .3).hot(0xffffff, 2.6).cool(el.spike); v.sparks.emit();
        v.ring(p.x, low, p.z, .4, 3.2, time, .32, 0xffffff, el.rim, .06);
        v.pulse(p.x, low + .5, p.z, el.light, 22, 10, time, .35, 2);
        break;
      case 'explosion': {
        const k = shape === 2 ? Math.min(size, 4) / 2.5 : 1;
        sp.reset(SPRITE.core, time, .14).pos(p.x, low, p.z).sized(.5, 1.4 * k, .3).hot(0xffffff, 2.4).cool(0xffb347); v.sparks.emit();
        sp.reset(SPRITE.burst, time, .3).pos(p.x, low, p.z).sized(.6, 2.2 * k, .2).hot(0xfff1b0, 1.2).cool(0xff4a1e, .9); sp.rotation = key; v.sparks.emit();
        for (let i = 0, n = v.n(8, 3); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a);
          v.smoke(p.x + c * .3 * k, low, p.z + sn * .3 * k, c * 2.4 * k, 1.4, sn * 2.4 * k, .6 * k, time + i * .01, .32, 0xffb347, 0xd9481e);
          v.smoke(p.x + c * .5 * k, low + .3, p.z + sn * .5 * k, c * .9, 1.6, sn * .9, .7 * k, time + .12 + i * .02, .6, 0x6a5c52, 0x2a221e);
        }
        v.streaks(p.x, low, p.z, el, v.n(14, 5), 14, .03, time, undefined, .5, 6);
        v.pulse(p.x, low + .5, p.z, 0xff8a3a, 16, 9, time, .35, 2);
        break;
      }
      case 'water':
        for (let i = 0, n = v.n(8, 3); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a);
          v.smoke(p.x + c * .3, low, p.z + sn * .3, c * 2.2 + f.x * 2.4, 1.4, sn * 2.2 + f.z * 2.4, .55, time + i * .012, .45, 0xeaf8ff, 0x5aa8e8);
        }
        v.streaks(p.x, low, p.z, el, v.n(16, 6), 9, .025, time, f, .9, 14);
        v.ring(p.x, low, p.z, .3, 2.2, time, .3, 0xffffff, el.rim, .1);
        break;
      case 'earth':
        v.debris.burst(v.n(9, 4), p.x, floor, p.z, 0, 1, 0, 6, .9, .13, floor, 2.2);
        v.dustRing(p.x, floor, p.z, 9, .4, 3.4, .8, time);
        for (let i = 0; i < 4; i++) v.smoke(p.x + Math.cos(i * 1.57 + key) * .4, floor + .3, p.z + Math.sin(i * 1.57 + key) * .4, 0, 2.4, 0, .55, time + i * .03, .5, 0xe8d8b8, 0x9a8468);
        if (v.quality !== 'low') v.marks.mark(MARK.crack, p.x, floor, p.z, 0, 1, 0, 2, time, 2.6, el.light, .3);
        break;
      case 'blackFlash':
        this.strike(this.m3.copy(p).setY(low), '', time, key, 'floor', HAKI_RED);
        sp.reset(SPRITE.core, time, .1).pos(p.x, low, p.z).sized(.3, .8, .3).hot(0xffffff, 2).cool(el.rim); v.sparks.emit();
        v.ring(p.x, low, p.z, .2, 2.4, time, .26, 0xff6a5a, el.rim, .08, 'plane', f.x, 0, f.z);
        break;
      case 'infinity':
        for (let i = 0; i < 4; i++) v.ring(p.x, floor + .1 + i * .45, p.z, .3, 2.4 + i * .3, time + i * .06, .75, 0xffffff, el.rim, .08, 'flat');
        v.ring(p.x, low, p.z, .5, 2.8, time, .8, el.spike, el.rim, .05);
        break;
      case 'frost':
        for (let i = 0, n = v.n(6, 3); i < n; i++) { const a = i * 1.05 + key, c = Math.cos(a), sn = Math.sin(a); v.smoke(p.x + c * .25, low + (i % 3 - 1) * .3, p.z + sn * .25, c * .8, .3, sn * .8, .5, time + i * .02, .6, 0xf6fdff, 0x9ad8f0); }
        for (let i = 0, n = v.n(10, 4); i < n; i++) {
          const r = this.kit.painter.rng.seed(key * 17 + i);
          sp.reset(SPRITE.shard, time, .5 + r.next() * .2).pos(p.x, low, p.z).velocity(r.signed() * 3, 1.5 + r.next() * 2, r.signed() * 3);
          sp.sized(.06 + r.next() * .05, .05, .5).hot(0xffffff, 1.2).cool(el.rim, .3); sp.gravity = 7; sp.spin = r.signed() * 14; sp.rotation = r.next() * 6.28; v.sparks.emit();
        }
        break;
      case 'claw':
        for (let i = 0; i < 3; i++) this.cutWith(look.cut, .1, this.m3.copy(p).setY(p.y + (i - 1) * .2), this.facingYaw(), 2.4, .9, time + i * .02, .24, key + i * 13);
        break;
      case 'fireflies':
        for (let i = 0, n = v.n(14, 5); i < n; i++) {
          const a = i * 2.399 + key, c = Math.cos(a), sn = Math.sin(a), r = 2.2, up = (i % 3 - 1) * .6;
          sp.reset(SPRITE.glow, time, .3).pos(p.x + c * r, low + up, p.z + sn * r).velocity(-c * r / .28, -up / .28, -sn * r / .28).sized(.05, .09, .5).hot(0xffd070, 1.6); v.sparks.emit();
        }
        sp.reset(SPRITE.core, time + .28, .16).pos(p.x, low, p.z).sized(.4, 1.1, .3).hot(0xffffff, 2.2).cool(0xff7a2a); v.sparks.emit();
        for (let i = 0; i < 5; i++) v.smoke(p.x, low, p.z, Math.cos(i * 1.26) * 1.6, 1.4, Math.sin(i * 1.26) * 1.6, .5, time + .28 + i * .01, .4, 0xffb347, 0xd9481e);
        break;
      case 'knives':
        for (let i = 0, n = v.n(14, 6); i < n; i++) {
          const a = i / n * Math.PI * 2 + key, c = Math.cos(a), sn = Math.sin(a), r0 = Math.min(size, 4) + 2.2, y = floor + .6 + (i % 3) * .4;
          sp.reset(SPRITE.streak, time + (i % 4) * .03, .22).pos(p.x + c * r0, y, p.z + sn * r0).velocity(-c * (r0 - .6) / .2, -.4, -sn * (r0 - .6) / .2);
          sp.orient = ORIENT.velocity; sp.sized(.035, .02, .6); sp.stretch = 5; sp.trail = .06; sp.hot(0xffffff, 1.6).cool(0xc8d4e0, .2); v.sparks.emit();
        }
        break;
      case 'spark':
        v.streaks(p.x, low, p.z, STEEL_SPARK, v.n(12, 5), 12, .022, time, f, 1.2, 8);
        break;
    }
  }
  private inhale(el: Element, from: THREE.Vector3, actor: Fighter, floor: number, time: number) {
    const v = this.vfx!, sp = v.sparks.spec, to = this.m4.copy(actor.group.position).setY(floor + 1.5);
    for (let i = 0, n = v.n(16, 6); i < n; i++) {
      const a = i * 2.399, r = .9, ox = Math.cos(a) * r, oy = Math.sin(a) * r * .7, oz = Math.sin(a * 1.7) * r;
      const x = from.x + ox, y = from.y + oy, z = from.z + oz, life = .26 + (i % 3) * .05;
      sp.reset(SPRITE.streak, time + (i % 5) * .03, life).pos(x, y, z).velocity((to.x - x) / life, (to.y - y) / life, (to.z - z) / life);
      sp.orient = ORIENT.velocity; sp.sized(.03, .012, .7); sp.stretch = 3; sp.trail = .08; sp.hot(0xffffff, 1.2).cool(el.rim, .1); v.sparks.emit();
    }
  }
  private facingYaw() { return Math.atan2(this.forward.x, this.forward.z); }

  private special(who: Emperor, id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit, colour = COLOR[who], contact = MOVES[who].special.contacts[0];
    if (who === 'itachi') { if (!armoryDraws('itachi', 'special', undefined, id)) this.amaterasu(id, actor, elapsed, key, time, fighters); return; }
    if (who === 'madara') { this.majesticFlame(id, actor, elapsed, key, time, fighters); return; }
    if (who === 'sung-jinwoo') { this.rulersAuthority(id, actor, elapsed, key, time, fighters); return; }
    if (who === 'tanjiro') {
      MOVES.tanjiro.special.contacts.forEach((at, step) => {
        const mark = key * 3 + step;
        if (elapsed < at || elapsed > at + .15 || this.drawn.get(`${id}:dance`) === mark) return;
        this.drawn.set(`${id}:dance`, mark);
        for (let i = 0; i < 3; i++) {
          const yaw = actor.state.yaw + step * .9 + i * Math.PI * 2 / 3;
          this.b.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(1.3).add(actor.group.position).setY(actor.group.position.y + .7 + step * .25);
          this.cut('tanjiro', this.b, yaw + Math.PI / 2, 2.8, step % 2 ? -.3 : .3, time + i * .03, .34, mark * 7 + i);
        }
        this.flash(this.a.copy(actor.group.position).setY(actor.group.position.y + .9), .7, mark, 1.3, WATER_RIM, time);
      });
      return;
    }
    if (who === 'levi') {
      const line = THREE.MathUtils.smoothstep(elapsed, .1, contact * .6) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .15));
      if (line > .03) {
        this.side.set(this.forward.z, 0, -this.forward.x);
        for (const sideSign of [-1, 1]) {
          this.b.copy(actor.group.position).addScaledVector(this.side, sideSign * .25).setY(actor.group.position.y + .95);
          this.c.copy(actor.group.position).addScaledVector(this.forward, 7 * line).addScaledVector(this.side, sideSign * 1.6).setY(actor.group.position.y + 3.4);
          kit.arc(this.b, this.c, key + (sideSign > 0 ? 3 : 4), .012, colour.light, line, 0, 1, .02);
        }
      }
      if (elapsed >= contact && this.drawn.get(id) !== key) {
        this.drawn.set(id, key);
        this.a.copy(actor.group.position).addScaledVector(this.forward, -1.4).setY(actor.group.position.y + 1.05);
        this.cut('levi', this.a, actor.state.yaw, 4.4, .15, time, .4, key);
        this.cut('levi', this.b.copy(this.a).setY(this.a.y - .25), actor.state.yaw, 3.6, -.55, time + .04, .36, key + 7);
        this.flash(this.a, 1, key, 1.5, colour.glow, time);
      }
      return;
    }
    if (who === 'meruem') {
      this.a.copy(actor.handR).addScaledVector(this.forward, .25);
      if (elapsed < contact) this.flash(this.a, .35 * THREE.MathUtils.smoothstep(elapsed, 0, contact), key + 1, .8, colour.glow, time);
      else if (this.drawn.get(id) !== key) { this.drawn.set(id, key); this.flash(this.a, 1, key, 1.6, colour.glow, time); }
      return;
    }
    if (who === 'akaza') {
      if (elapsed >= contact && this.drawn.get(id) !== key) {
        this.drawn.set(id, key);
        this.a.copy(actor.group.position).addScaledVector(this.forward, 1.2).setY(actor.group.position.y + 1.25);
        this.crack(this.a, this.forward, time, key, 1.7, 10, COLOR.akaza.glow);
        this.flash(this.a, .85, key, 1.4, COLOR.akaza.glow, time);
      }
      return;
    }
    if (who === 'saitama') {
      MOVES.saitama.special.contacts.forEach((at, blow) => {
        const mark = key * 9 + blow;
        if (elapsed < at || elapsed > at + .1 || this.drawn.get(`${id}:flurry`) === mark) return;
        this.drawn.set(`${id}:flurry`, mark);
        const r = kit.painter.rng.seed(mark);
        this.side.set(this.forward.z, 0, -this.forward.x);
        for (let i = 0; i < 3; i++) {
          this.a.copy(actor.group.position).addScaledVector(this.forward, 1.2 + r.next() * .4).addScaledVector(this.side, r.signed() * .45)
            .setY(actor.group.position.y + .9 + r.next() * .55);
          this.flash(this.a, .45, mark + i, .7, colour.glow, time + i * .03);
        }
        this.crack(this.a, this.forward, time, mark, blow === MOVES.saitama.special.contacts.length - 1 ? 2 : .9, 6, colour.glow);
      });
      return;
    }
    if (who === 'whitebeard') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact + .05, contact + .3));
      if (gather > .02) kit.ball(actor.handL, gather * 1.1, 13, NaN, colour.glow, colour.light, .42);
    }
    if (who === 'aizen') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .1));
      if (gather > .02) {
        if (actor.state.awakened) kit.ball(this.back(actor, this.b), gather * 1.1, 31, NaN, colour.glow, colour.light, .44);
        else for (let i = 0; i < HALO; i++) kit.ball(this.halo(actor, i, this.b), gather * .3 * THREE.MathUtils.smoothstep(gather, i / HALO * .6, i / HALO * .6 + .4), 31 + i, NaN, colour.glow, colour.light, .4);
      }
    }
    if (who === 'goku-black') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .12));
      if (gather > .02) kit.ball(actor.handR, gather * 1.1, 59, NaN, colour.glow, colour.light, .5);
    }
    if (who === 'jiren') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .2, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .1));
      if (gather > .02) kit.ball(actor.handR, gather * 1.2, 67, NaN, colour.glow, colour.light, .5);
    }
    if (who === 'golden-frieza') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .25, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact + .4, contact + .55));
      if (gather > .02) {
        kit.ball(actor.handR, gather * .45, 73, NaN, DEATH, DEATH_LIGHT, .3);
        kit.ball(actor.handL, gather * .45, 79, NaN, DEATH, DEATH_LIGHT, .3);
      }
    }
    if (who === 'gohan-beast') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .12));
      if (gather > .02) kit.ball(this.b.copy(actor.handL).add(actor.handR).multiplyScalar(.5), gather * 1.15, 97, NaN, MASENKO_GOLD, MASENKO_LIGHT, .5);
    }
    if (who === 'roger') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .2, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .12));
      if (gather > .02) kit.ball(this.muzzle(actor, this.b), gather * .7, 23, NaN, colour.glow, colour.light, .46);
    }
    if (who === 'gon') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .1));
      if (gather > .02) kit.ball(actor.handR, gather * 1.05, 131, NaN, colour.glow, colour.light, .5);
    }
    if (elapsed < contact || this.drawn.get(id) === key) return;
    this.drawn.set(id, key);
    const yaw = actor.state.yaw;
    if (who === 'gon') this.flash(this.a.copy(actor.handR), 1, key, 1.5, colour.glow, time);
    if (who === 'kaido') {
      for (let i = 0; i < 3; i++) {
        this.a.copy(actor.group.position).addScaledVector(this.forward, 1.6 + i * 1.3).setY(actor.group.position.y + 1.1);
        this.cut('wind', this.a, yaw, 3.6 + i * .9, .25 - i * .25, time + i * .05, .38, key + i * 11);
      }
    }
    if (who === 'whitebeard') {
      this.a.copy(actor.handL).addScaledVector(this.forward, .55);
      this.crack(this.a, this.forward, time, key, 2.6, 14, colour.glow);
      this.flash(this.a, 1.2, key, 1.8, colour.glow, time);
    }
    if (who === 'shanks') {
      this.dome(id, time, MOVES.shanks.special.radius, HAKI_RED);
      this.strike(this.a.copy(actor.group.position).setY(actor.group.position.y + .05), '', time, key, 'floor', HAKI_RED);
    }
    if (who === 'sukuna') {
      for (let i = 0; i < 5; i++) {
        const r = kit.painter.rng.seed(key * 5 + i);
        this.a.copy(actor.group.position).addScaledVector(this.forward, 1.4 + i * 1.1).setY(actor.group.position.y + .7 + r.next() * .8);
        this.cut('sukuna', this.a, actor.state.yaw + r.signed() * .25, 2.4 + r.next(), r.signed() * 1.4, time + i * .045, .3, key + i * 13);
      }
    }
    if (who === 'aizen') {
      const winged = !!actor.state.awakened, from = this.back(actor, this.a);
      this.flash(from, 1, key, 1.6, colour.glow, time);
      for (let i = 0, n = winged ? 7 : HALO; i < n; i++) {
        const r = kit.painter.rng.seed(key * 7 + i);
        this.side.set(this.forward.z, 0, -this.forward.x);
        if (winged) this.b.copy(from).addScaledVector(this.side, r.signed() * .9).addScaledVector(this.up, r.signed() * .5);
        else this.halo(actor, i, this.b);
        this.c.copy(this.b).addScaledVector(this.forward, 6 + r.next() * 3).addScaledVector(this.side, r.signed() * 1.4);
        kit.arc(this.b, this.c, key + i * 3, .035, colour.glow, 1.1, 2, 3, .28);
      }
    }
    if (who === 'griffith') {
      this.a.copy(actor.state.awakened ? actor.handR : actor.handL).addScaledVector(this.forward, .3);
      this.flash(this.a, .7, key, 1.1, colour.glow, time);
    }
    if (who === 'goku-black') {
      this.flash(this.a.copy(actor.handR), 1.1, key, 1.6, colour.glow, time);
    }
    if (who === 'gohan-beast') {
      this.flash(this.a.copy(actor.handL).add(actor.handR).multiplyScalar(.5), 1.2, key, 1.7, MASENKO_GOLD, time);
    }
    if (who === 'jiren') {
      this.flash(this.a.copy(actor.handR), 1.2, key, 1.7, colour.glow, time);
      this.crack(this.b.copy(actor.handR).addScaledVector(this.forward, .5), this.forward, time, key, 1.8, 10, colour.glow);
    }
    if (who === 'golden-frieza') {
      const aim = this.aimOf(actor, fighters, this.c, MOVES['golden-frieza'].special.range);
      for (let i = 0; i < 6; i++) {
        const r = kit.painter.rng.seed(key * 6 + i);
        this.a.copy(i % 2 ? actor.handL : actor.handR).addScaledVector(this.forward, .12);
        this.b.set(r.signed() * .5, r.signed() * .45, r.signed() * .5).add(aim);
        this.beam(this.a, this.b, time + i * .065, key + i * 7, .04, DEATH, .14);
      }
      this.flash(this.a.copy(actor.handR), .9, key, 1.3, DEATH, time);
    }
    if (who === 'roger') {
      const muzzle = this.muzzle(actor, this.a);
      this.flash(muzzle, 1.1, key, 1.6, colour.glow, time);
      this.b.copy(muzzle).addScaledVector(this.forward, 4.5);
      kit.arc(muzzle, this.b, key, .05, colour.glow, 1.2, 3, 4, .3);
      kit.arc(muzzle, this.b, key + 1, .03, colour.glow, .9, 2, 3, .36);
    }
  }

  private fourHandedSign(actor: Fighter, elapsed: number) {
    const body = actor.shownBody;
    if (body === actor) return;
    let bones = this.signs.get(body);
    if (!bones) {
      const joint = (name: string) => body.model.getObjectByName(name) ?? undefined;
      bones = {left: joint('LowerLeftHand'), right: joint('LowerRightHand'), spear: joint('Spear'), dagger: joint('Dagger')};
      this.signs.set(body, bones);
    }
    const held = THREE.MathUtils.smoothstep(elapsed, .45, .7) * (1 - THREE.MathUtils.smoothstep(elapsed, 1.5, 1.75));
    if (held < .02 || !bones.left || !bones.right) return;
    const glow = COLOR.sukuna.glow, kit = this.kit, pulse = .85 + .15 * Math.sin(elapsed * 17);
    bones.left.getWorldPosition(this.a); bones.right.getWorldPosition(this.b);
    this.c.copy(this.a).lerp(this.b, .5);
    kit.glows.add(this.c, .55 * held, glow, 1.2 * held * pulse, GLOW, .3, 31);
    kit.glows.add(this.c, .9 * held, glow, .5 * held, RING, .08, 32, .4);
    for (const [i, weapon] of [bones.spear, bones.dagger].entries()) {
      if (!weapon) continue;
      weapon.getWorldPosition(this.a);
      kit.glows.add(this.a, (i ? .45 : .7) * held, glow, .9 * held * pulse, GLOW, .2, 33 + i);
    }
  }

  private illusion(id: string, actor: Fighter, elapsed: number, key: number, time: number) {
    const s = actor.state, blink = BLINKS.aizen!, colour = COLOR.aizen, kit = this.kit;
    let held = this.decoys.get(id);
    const heavy = s.action === 'heavy' && !s.branch && s.alive;
    if (held && held.decoy.standing && (!heavy || held.key !== key)) held.decoy.shatter(time);
    if (!heavy) return;
    if (elapsed >= blink.vanish && elapsed < ILLUSION_BREAKS && (!held || held.key !== key)) {
      if (!held) { held = {decoy: new KyokaDecoy(this.scene, colour.glow), key}; this.decoys.set(id, held); }
      held.key = key;
      held.decoy.show(actor.shownBody);
    }
    if (!held || held.key !== key || !held.decoy.standing) return;
    const decoy = held.decoy;
    const grown = THREE.MathUtils.smoothstep(elapsed, blink.vanish + .03, ILLUSION_BREAKS);
    if (grown > 0) {
      this.side.set(decoy.facing.z, 0, -decoy.facing.x);
      for (let i = 0; i < 11; i++) {
        const r = kit.painter.rng.seed(key * 13 + i), angle = (i / 11) * Math.PI * 2 + r.signed() * .3, reach = (.45 + .5 * r.next()) * grown;
        this.a.copy(decoy.chest).addScaledVector(this.side, Math.cos(angle) * reach).addScaledVector(this.up, Math.sin(angle) * reach * 1.4)
          .addScaledVector(decoy.facing, -.08);
        kit.arc(decoy.chest, this.a, key * 7 + i, .012 + .006 * grown, this.crackWhite, .9 + grown, 2, 3, .45);
      }
    }
    if (elapsed >= ILLUSION_BREAKS) {
      decoy.shatter(time);
      this.flash(this.a.copy(decoy.chest), .45, key + 9, .9, colour.glow, time);
    }
  }

  private transmission(id: string, actor: Fighter, elapsed: number, key: number, time: number) {
    const kit = this.kit, colour = COLOR['goku-black'], contact = MOVES['goku-black'].heavy.contacts[0];
    if (elapsed < BLINK.vanish) {
      const k = THREE.MathUtils.smoothstep(elapsed, .02, BLINK.vanish - .01);
      if (k > .02) kit.ball(this.a.copy(actor.handR).addScaledVector(this.up, .08), .3 * k, 61, NaN, colour.glow, colour.light, .25);
    }
    const mark = key * 2;
    if (elapsed >= BLINK.vanish && this.drawn.get(`${id}:gone`) !== mark) {
      this.drawn.set(`${id}:gone`, mark);
      this.flash(this.a.copy(actor.group.position).setY(actor.group.position.y + 1.1), .9, key, 1.4, colour.glow, time);
      this.ring(this.b.copy(actor.group.position).setY(actor.group.position.y + .05), time, 1.6);
    }
    if (elapsed >= BLINK.appear + APPEAR_HOLD && this.drawn.get(`${id}:back`) !== mark) {
      this.drawn.set(`${id}:back`, mark);
      this.flash(this.a.copy(actor.group.position).setY(actor.group.position.y + 1.1), 1.1, key + 1, 1.6, colour.glow, time);
    }
    const blade = THREE.MathUtils.smoothstep(elapsed, BLINK.appear, BLINK.appear + .08) * (1 - THREE.MathUtils.smoothstep(elapsed, contact + .08, contact + .3));
    if (blade > .03) {
      this.b.copy(actor.handR).sub(actor.handL).normalize();
      this.c.copy(this.forward).multiplyScalar(.7).add(this.b.multiplyScalar(.3)).normalize();
      this.a.copy(actor.handR).addScaledVector(this.c, 1.5 * blade);
      kit.arc(actor.handR, this.a, kit.tick * 3 + 5, .05 * blade + .015, colour.glow, 1.3 * blade, 0, 2, .06);
      kit.ball(actor.handR, .35 * blade, 53, NaN, colour.glow, colour.light, .4);
    }
    if (elapsed >= contact && this.drawn.get(`${id}:cut`) !== mark) {
      this.drawn.set(`${id}:cut`, mark);
      this.a.copy(actor.group.position).addScaledVector(this.forward, 1.5).setY(actor.group.position.y + 1.05);
      this.cut('goku-black', this.a, actor.state.yaw, 4, .5, time, .36, key);
      this.flash(this.a, 1, key, 1.5, colour.glow, time);
    }
  }

  private crowClone(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const blink = BLINKS.itachi!, mark = key * 2;
    this.crows ??= new CrowFlock(this.scene, CROW_EYE);
    let clone = this.clones.get(id);
    if (!clone) { clone = new KyokaDecoy(this.scene, COLOR.itachi.glow); this.clones.set(id, clone); }
    if (elapsed >= blink.vanish - CROW_LEAD && this.drawn.get(`${id}:gone`) !== mark) {
      this.drawn.set(`${id}:gone`, mark);
      this.crows.burst(actor, time, 5);
      clone.show(actor);
    }
    const target = actor.state.target ? fighters.get(actor.state.target) : undefined;
    const struck = target && target !== actor && target.state.alive ? this.c.copy(target.group.position).setY(target.group.position.y + 1.2) : undefined;
    const breaking = elapsed - blink.vanish - CLONE_STANDS;
    if (clone.standing && breaking >= 0) {
      if (this.drawn.get(`${id}:break`) !== mark) {
        this.drawn.set(`${id}:break`, mark);
        const points = clone.joints(CLONE_JOINTS);
        this.crows.burstFrom(points, clone.chest, time, CLONE_JOINTS.length, struck, CLONE_BREAK * .6);
      }
      if (breaking >= CLONE_BREAK) clone.release(); else clone.crumble(breaking / CLONE_BREAK);
    }
    if (elapsed >= blink.appear + APPEAR_HOLD * .5 && this.drawn.get(`${id}:back`) !== mark) {
      this.drawn.set(`${id}:back`, mark);
      this.crows.gather(actor, time, struck, joint => APPEAR_HOLD * .5 + FORMED * (.35 + .55 * ((joint.charCodeAt(0) + joint.length) % 5) / 4));
    }
  }

  private form(actor: Fighter, since: number) {
    let rest = this.formed.get(actor);
    if (!rest) { rest = new Map(); this.formed.set(actor, rest); }
    const bone = actor.bones.get('hips');
    if (!bone) return;
    let scale = rest.get(bone);
    if (!scale) { scale = bone.scale.clone(); rest.set(bone, scale); }
    const u = THREE.MathUtils.clamp(since / FORMED, 0, 1);
    bone.scale.copy(scale).multiplyScalar(Math.max(.02, u * u * (3 - 2 * u)));
  }

  private unform(actor: Fighter) {
    const rest = this.formed.get(actor);
    if (!rest) return;
    for (const [bone, scale] of rest) bone.scale.copy(scale);
    this.formed.delete(actor);
  }

  private amaterasu(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const move = MOVES.itachi.special, contact = move.contacts[0];
    const look = THREE.MathUtils.smoothstep(elapsed, .05, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, contact, contact + .3));
    if (look > .03) this.kit.ball(this.eye(actor, this.a), .22 * look, 109, NaN, SHARINGAN, COLOR.itachi.light, .2);
    if (elapsed < contact) return;
    const field = this.fields.get(id), floor = actor.state.grounded ? actor.group.position.y : 0;
    const center = field && Math.abs(field.since - actor.state.actionStarted) < .25 ? this.c.copy(field.at) : this.aimOf(actor, fighters, this.c, move.range);
    center.y = floor;
    if (this.drawn.get(`${id}:ignite`) !== key) {
      this.drawn.set(`${id}:ignite`, key);
      this.flash(this.b.copy(center).setY(floor + .9), 1, key, 1.6, AMATERASU, time);
    }
    const fade = 1 - THREE.MathUtils.smoothstep(elapsed, move.duration - .6, move.duration), ignite = THREE.MathUtils.smoothstep(elapsed, contact, contact + .25);
    const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
    if (victim && victim.state.alive && Math.hypot(victim.group.position.x - center.x, victim.group.position.z - center.z) < move.radius + 1.5) {
      const at = victim.group.position, count = Math.round(80 * Math.min(1, this.kit.density) * ignite);
      for (let j = 0; j < count && this.flameCount < FLAMES; j++) {
        const a = j * 2.399963, h = .15 + ((j * .618) % 1) * 1.55, girth = .22 + .14 * Math.sin(h * 2.2), phase = (time * (1.3 + (j % 4) * .2) + j * .37) % 1;
        this.a.set(at.x + Math.cos(a + time * .7) * girth, at.y + h, at.z + Math.sin(a + time * .7) * girth);
        this.flame(this.a, a, time + j, (.6 + .25 * (j % 3)) * fade, (.85 + phase * .8) * fade, 1 - phase * .5, (j * .137) % 1, BLACK);
      }
      this.flameField(this.b.copy(at).setY(floor), .8, ignite, fade, time, BLACK, Math.round(36 * Math.min(1, this.kit.density)), .6);
    } else this.flameField(center, move.radius * .7, ignite, fade, time, BLACK, Math.round(70 * Math.min(1, this.kit.density)), .8);
  }

  private flameField(center: THREE.Vector3, radius: number, ignite: number, fade: number, time: number, palette: number, count: number, tallness = 1) {
    for (let j = 0; j < count && this.flameCount < FLAMES; j++) {
      const a = j * 2.4, r = Math.sqrt((j + .5) / count) * radius * (.35 + .65 * ignite), phase = (time * (1.1 + (j % 3) * .25) + j * .618) % 1;
      const grow = (1 - phase * .4) * fade, tall = (1.5 + phase * (1.4 + (j % 5) * .3)) * grow * tallness;
      this.flame(this.a.set(center.x + Math.cos(a) * r, center.y + tall * .25 * .92 + .02, center.z + Math.sin(a) * r), a, time + j, (1.6 + .5 * (j % 3)) * grow, tall, 1 - phase * .6, (j * .137) % 1, palette);
    }
  }

  private flame(at: THREE.Vector3, angle: number, clock: number, width: number, tall: number, heat: number, seed: number, palette: number) {
    if (this.flameCount >= FLAMES) return;
    this.transform.position.copy(at);
    this.transform.quaternion.setFromAxisAngle(this.flameAxis.set(Math.cos(angle + 1.6), 0, Math.sin(angle + 1.6)), Math.sin(clock * 2.3) * .14);
    this.transform.scale.set(width, tall, 1); this.transform.updateMatrix();
    this.flames.setMatrixAt(this.flameCount, this.transform.matrix);
    this.flames.setColorAt(this.flameCount++, this.tint.setRGB(heat, seed, flamePalette(palette)));
  }

  private fieldAt(id: string, actor: Fighter, fighters: ReadonlyMap<string, Fighter>, range: number, out: THREE.Vector3) {
    const field = this.fields.get(id);
    return field && Math.abs(field.since - actor.state.actionStarted) < .25 ? out.copy(field.at) : this.aimOf(actor, fighters, out, range);
  }

  private majesticFlame(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const move = MOVES.madara.special, contact = move.contacts[0], last = move.contacts[move.contacts.length - 1];
    if (elapsed < contact - .1) return;
    const floor = actor.state.grounded ? actor.group.position.y : 0;
    const center = this.fieldAt(id, actor, fighters, move.range, this.c); center.y = floor;
    const fade = 1 - THREE.MathUtils.smoothstep(elapsed, move.duration - .5, move.duration), ignite = THREE.MathUtils.smoothstep(elapsed, contact, contact + .3);
    const breath = THREE.MathUtils.smoothstep(elapsed, contact - .1, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, last, last + .25));
    if (breath > .03) {
      const mouth = this.eye(actor, this.axis), landing = this.tip.set(center.x, floor + 1.1, center.z);
      for (let j = 0; j < 64 && this.flameCount < FLAMES; j++) {
        const u = ((j / 64) + time * 1.6) % 1, spread = .3 + u * 3.4;
        this.b.copy(mouth).lerp(landing, u);
        this.b.x += Math.sin(j * 2.1 + time * 5) * spread * .45; this.b.z += Math.cos(j * 1.7 + time * 4) * spread * .45; this.b.y += Math.sin(j * 1.3) * spread * .3;
        this.flame(this.b, j * 2.4, time + j, (.9 + u * 2.9) * breath, (1 + u * 2.4) * breath, .98 - u * .35, (j * .137) % 1, FLAME_FIRE);
      }
    }
    if (elapsed >= contact && this.drawn.get(`${id}:ignite`) !== key) {
      this.drawn.set(`${id}:ignite`, key);
      this.flash(this.b.copy(center).setY(floor + .9), 1.3, key, 2.2, FIRE, time);
      this.ring(this.b.copy(center).setY(floor + .05), time, move.radius);
    }
    if (elapsed >= contact) this.flameField(center, move.radius * 1.35, ignite, fade, time, FLAME_FIRE, Math.round(170 * Math.min(1, this.kit.density)), 1.8);
  }

  private rulersAuthority(id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit, move = MOVES['sung-jinwoo'].special, contact = move.contacts[0];
    const floor = actor.state.grounded ? actor.group.position.y : 0;
    const center = this.fieldAt(id, actor, fighters, move.range, this.c); center.y = floor;
    const lift = THREE.MathUtils.smoothstep(elapsed, .15, contact) * (1 - THREE.MathUtils.smoothstep(elapsed, move.duration - .3, move.duration));
    if (lift > .03 && kit.ticked) {
      for (let i = 0; i < 6; i++) {
        const r = kit.painter.rng.seed(kit.tick * 7 + i + key), a = r.next() * Math.PI * 2, d = r.next() * move.radius;
        this.a.set(center.x + Math.cos(a) * d, floor + .05, center.z + Math.sin(a) * d);
        this.b.copy(this.a).setY(floor + .4 + 1.6 * lift * r.next());
        kit.arc(this.a, this.b, kit.tick * 11 + i, .02, SHADOW, lift, 0, 2, .2);
      }
    }
    move.contacts.forEach((at, blow) => {
      const mark = key * 2 + blow;
      if (elapsed < at || elapsed > at + .15 || this.drawn.get(`${id}:slam`) === mark) return;
      this.drawn.set(`${id}:slam`, mark);
      this.ring(this.a.copy(center).setY(floor + .05), time, move.radius * (blow ? 1.4 : 1));
      this.crack(this.b.copy(center).setY(floor + .3), this.up, time, mark, 2.4 + blow, 12, SHADOW);
      this.flash(this.b.copy(center).setY(floor + 1), 1 + blow * .3, mark, 1.8, SHADOW, time);
    });
  }

  private meteor(id: string, actor: Fighter, elapsed: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const move = MOVES.madara.ultimate, open = move.contacts[0], finish = move.contacts[move.contacts.length - 1];
    const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
    let slot = this.meteors.find(m => m.owner === id);
    if (!victim || actor.state.confirmedAt === undefined || elapsed < open || elapsed > finish) { if (slot) { slot.mesh.visible = false; slot.owner = ''; } return; }
    slot ??= this.meteors.find(m => !m.owner) ?? this.meteors[0];
    slot.owner = id;
    const u = THREE.MathUtils.clamp((elapsed - open) / (finish - open), 0, 1), fall = u * u;
    const target = this.a.copy(victim.group.position).setY(victim.group.position.y + 1.1);
    this.b.set(this.forward.x * 6, 8, this.forward.z * 6);
    slot.fall.copy(this.b).negate().normalize();
    slot.mesh.position.copy(target).addScaledVector(this.b, 1 - fall);
    slot.mesh.scale.setScalar(1.25 + .35 * u); slot.mesh.rotation.set(time * .7, time * .4, 0); slot.mesh.visible = true;
    for (let j = 0; j < 22 && this.flameCount < FLAMES; j++) {
      const k = j / 22;
      this.c.copy(slot.mesh.position).addScaledVector(slot.fall, -(.8 + k * 2.6));
      this.c.x += Math.sin(j * 2.3 + time * 6) * .5 * k; this.c.z += Math.cos(j * 1.9 + time * 5) * .5 * k;
      this.flame(this.c, j * 2.4, time + j, 1.6 + 1.4 * (1 - k), 1.8 + 1.6 * (1 - k), .95 - k * .5, (j * .137) % 1, FLAME_FIRE);
    }
    this.kit.lights.add(slot.mesh.position, 6, FIRE_LIGHT, .9 / LIGHT_SCALE);
  }
  private drawSignatures(time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit;
    this.signatures = this.signatures.filter(m => time - m.since < SIGNATURE_SECONDS);
    for (const mark of this.signatures) {
      const actor = fighters.get(mark.actorId), age = time - mark.since;
      if (!actor || !actor.state.alive || age < 0) continue;
      const base = actor.group.position, on = THREE.MathUtils.smoothstep(age, .2, .7) * (1 - THREE.MathUtils.smoothstep(age, SIGNATURE_SECONDS - .6, SIGNATURE_SECONDS));
      if (on < .02) continue;
      if (mark.who === 'akaza') {
        const radius = 4.6 * Math.min(1, age * 2.2), y = base.y + .04, turn = actor.state.yaw + age * .25;
        for (let arm = 0; arm < 6; arm++) {
          const yaw = turn + arm * Math.PI / 3, dx = Math.sin(yaw), dz = Math.cos(yaw);
          this.a.copy(base).setY(y); this.b.set(base.x + dx * radius, y, base.z + dz * radius);
          kit.arc(this.a, this.b, mark.seed + arm * 5, .035 * on, COMPASS, 1.2 * on, 0, 1, .02);
          for (const at of [.4, .7]) {
            this.c.set(base.x + dx * radius * at, y, base.z + dz * radius * at);
            for (const side of [-1, 1]) {
              const branch = yaw + side * .7;
              this.tip.set(this.c.x + Math.sin(branch) * radius * .22, y, this.c.z + Math.cos(branch) * radius * .22);
              kit.arc(this.c, this.tip, mark.seed + arm * 11 + side + Math.round(at * 10), .022 * on, COMPASS, on, 0, 1, .02);
            }
          }
        }
      } else if (mark.who === 'whitebeard') {
        for (let k = 0; k < 6; k++) {
          const show = THREE.MathUtils.smoothstep(age, .15 + k * .14, .25 + k * .14) * on;
          if (show < .02) continue;
          const yaw = actor.state.yaw + k * Math.PI / 3 + .4, reach = 1.6 + (k % 2) * .5;
          this.c.set(base.x + Math.sin(yaw) * reach, base.y + 1.3 + (k % 3) * .45, base.z + Math.cos(yaw) * reach);
          this.side.set(Math.cos(yaw), 0, -Math.sin(yaw));
          for (let i = 0; i < 9; i++) {
            const r = kit.painter.rng.seed(mark.seed * 31 + k * 97 + i * 13), angle = i / 9 * Math.PI * 2 + r.signed() * .3, length = (.5 + .6 * r.next()) * 1.1;
            this.a.copy(this.c).addScaledVector(this.side, Math.cos(angle) * length).y += Math.sin(angle) * length;
            kit.arc(this.c, this.a, mark.seed * 7 + k * 31 + i, .02 * show + .005, COLOR.whitebeard.glow, show, 2, 3, .5);
          }
        }
      } else if (mark.who === 'levi') {
        for (let k = 0; k < 3; k++) {
          const spin = age * (9 + k * 2) + k * 2.1, y = base.y + .6 + k * .55, radius = 1.15 + k * .2;
          this.c.set(base.x + Math.sin(spin) * radius, y, base.z + Math.cos(spin) * radius);
          for (let i = 1; i <= 5; i++) {
            const a = spin - i * .28;
            this.a.set(base.x + Math.sin(a) * radius, y + Math.sin(i + k) * .06, base.z + Math.cos(a) * radius);
            kit.arc(this.c, this.a, mark.seed + k * 7 + i, (.05 - i * .007) * on, COLOR.levi.glow, (1.3 - i * .18) * on, 0, 1, .02);
            this.c.copy(this.a);
          }
        }
      } else if (mark.who === 'saitama') {
        for (let wave = 0; wave < 2; wave++) {
          const t = THREE.MathUtils.clamp((age - .25 - wave * .35) / .7, 0, 1);
          if (t <= 0 || t >= 1) continue;
          const radius = 1 + t * 7.5, fade = (1 - t) * on, y = base.y + .08;
          for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2, b = (i + 1) / 24 * Math.PI * 2;
            this.a.set(base.x + Math.sin(a) * radius, y, base.z + Math.cos(a) * radius);
            this.b.set(base.x + Math.sin(b) * radius, y, base.z + Math.cos(b) * radius);
            kit.arc(this.a, this.b, mark.seed + wave * 97 + i, .05 * fade, SERIOUS_WIND, fade, 0, 1, .05);
          }
        }
      } else if (mark.who === 'tanjiro') {
        for (let i = 0; i < 26 && this.flameCount < FLAMES; i++) {
          const a = i / 26 * Math.PI * 2 + age * .4, r = 2.1 + Math.sin(i * 1.7) * .15;
          this.flame(this.a.set(base.x + Math.sin(a) * r, base.y + .45 * on, base.z + Math.cos(a) * r), a, time + i, .7 * on, (1.1 + (i % 3) * .3) * on, .95, (i * .137) % 1, FLAME_FIRE);
        }
        kit.lights.add(this.a.copy(base).setY(base.y + 1), 4, FIRE_LIGHT, .6 * on / LIGHT_SCALE * .5);
      }
    }
  }
  private hakiBolt(a: THREE.Vector3, b: THREE.Vector3, seed: number, width: number, strength: number, branches = 1) {
    const r = this.kit.painter.rng.seed(seed), points = this.jag, n = points.length - 1, span = a.distanceTo(b);
    this.across.subVectors(b, a).cross(this.up);
    if (this.across.lengthSq() < 1e-6) this.across.set(1, 0, 0);
    this.across.normalize();
    for (let i = 0; i <= n; i++) {
      const t = i / n, off = i === 0 || i === n ? 0 : r.signed() * span * .16;
      points[i].copy(a).lerp(b, t).addScaledVector(this.across, off).y += i === 0 || i === n ? 0 : r.signed() * span * .1;
    }
    for (let i = 0; i < n; i++) {
      this.kit.bolts.segment(points[i], points[i + 1], width, HAKI_RED, strength, 0);
      this.ink.segment(points[i], points[i + 1], width * .42, Math.min(1, strength * 1.2));
    }
    for (let k = 0; k < branches; k++) {
      const from = points[1 + Math.floor(r.next() * (n - 1))];
      this.b.copy(from).addScaledVector(this.across, r.signed() * span * .35).y += r.signed() * span * .2;
      this.kit.bolts.segment(from, this.b, width * .7, HAKI_RED, strength * .8, 0);
      this.ink.segment(from, this.b, width * .3, Math.min(1, strength));
    }
  }
  private hideMeteor(id: string) { const slot = this.meteors.find(m => m.owner === id); if (slot) { slot.mesh.visible = false; slot.owner = ''; } }
  private hideGunbai(id: string) { const slot = this.gunbais.find(m => m.owner === id); if (slot) { slot.fan.visible = false; slot.owner = ''; } }
  private hideCoffin(id: string) { const slot = this.coffins.find(m => m.owner === id); if (slot) { for (const m of slot.slabs) m.visible = false; slot.owner = ''; } }
  private hideScythe(id: string) { const slot = this.scythes.find(m => m.owner === id); if (slot) { slot.haft.visible = slot.blade.visible = false; slot.owner = ''; } }

  private eye(actor: Fighter, out: THREE.Vector3) {
    const head = actor.bones.get('head');
    if (head) head.getWorldPosition(out).addScaledVector(this.forward, .1).setY(out.y + .06);
    else out.copy(actor.group.position).addScaledVector(this.forward, .1).setY(actor.group.position.y + 1.65);
    return out;
  }

  private back(actor: Fighter, out: THREE.Vector3) {
    return out.copy(actor.group.position).addScaledVector(this.forward, -.35).setY(actor.group.position.y + 1.55);
  }
  private halo(actor: Fighter, i: number, out: THREE.Vector3) {
    const yaw = actor.state.yaw, angle = (i / (HALO - 1) - .5) * Math.PI * .9;
    return out.copy(actor.group.position).addScaledVector(this.forward.set(Math.sin(yaw), 0, Math.cos(yaw)), -.45)
      .addScaledVector(this.across.set(Math.cos(yaw), 0, -Math.sin(yaw)), Math.sin(angle) * 1.25).setY(actor.group.position.y + 1.45 + Math.cos(angle) * .95);
  }

  private muzzle(actor: Fighter, out: THREE.Vector3) {
    const gun = actor.bones.get('qiangbone410106') ?? actor.bones.get('qiangbone340105');
    if (gun) gun.getWorldPosition(out); else out.copy(actor.handL);
    return out.addScaledVector(this.forward, .18);
  }

  private ultimate(who: Emperor, id: string, actor: Fighter, elapsed: number, key: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit, colour = COLOR[who], move = MOVES[who].ultimate;
    const finish = move.contacts[move.contacts.length - 1];
    if (who === 'gohan-beast') {
      const open = move.contacts[0];
      const point = THREE.MathUtils.smoothstep(elapsed, .05, open) * (1 - THREE.MathUtils.smoothstep(elapsed, open, open + .08));
      if (point > .03) {
        kit.ball(this.a.copy(actor.handR).addScaledVector(this.up, .05), .4 * point, 101, NaN, MASENKO_GOLD, MASENKO_LIGHT, .3);
        if (kit.ticked) {
          const r = kit.painter.rng.seed(kit.tick * 13 + key);
          this.b.set(r.signed() * .3, r.signed() * .3, r.signed() * .3).add(this.a);
          kit.arc(this.a, this.b, kit.tick * 5 + 9, .02, SPIRAL, point, 0, 2, .3);
        }
      }
      if (elapsed >= open && elapsed < finish + .12) {
        const from = actor.handR, to = this.aimOf(actor, fighters, this.c, move.range);
        this.axis.copy(to).sub(from);
        const span = this.axis.length();
        if (span > .3) {
          this.axis.divideScalar(span);
          this.side.crossVectors(this.axis, this.up);
          if (this.side.lengthSq() < 1e-4) this.side.set(1, 0, 0);
          this.side.normalize();
          this.tip.crossVectors(this.side, this.axis);
          const reach = Math.max(span + 9, 14), turns = 56, fade = 1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .12);
          const bore = THREE.MathUtils.smoothstep(elapsed, open, open + .06) * fade;
          this.b.copy(from).addScaledVector(this.axis, reach);
          kit.arc(from, this.b, key + 701, .03, MASENKO_GOLD, 2.2 * bore, 0, 1, .012);
          kit.arc(from, this.b, key + 709, .075, SPIRAL, .55 * bore, 0, 1, .02);
          this.a.copy(from);
          for (let i = 1; i <= turns; i++) {
            const along = i / turns, phase = along * reach * 2.6 - time * 20, radius = .16 + .05 * Math.sin(along * 21);
            this.b.copy(from).addScaledVector(this.axis, along * reach)
              .addScaledVector(this.side, Math.cos(phase) * radius).addScaledVector(this.tip, Math.sin(phase) * radius);
            kit.arc(this.a, this.b, key + i * 3, .028, SPIRAL, 1.2 * fade, 0, 1, .04);
            this.a.copy(this.b);
          }
          if (bore > .05) {
            kit.glows.add(this.b.copy(from).addScaledVector(this.axis, span + .35), .45 * bore, MASENKO_GOLD, bore, STAR, .2, key % 97);
            kit.glows.add(this.b.copy(from).addScaledVector(this.axis, reach), .3 * bore, SPIRAL, bore, STAR, .2, (key + 7) % 97);
          }
        }
      }
      if (elapsed >= open && this.drawn.get(`${id}:cannon`) !== key) {
        this.drawn.set(`${id}:cannon`, key);
        this.flash(this.a.copy(actor.handR), 1.2, key, 1.8, MASENKO_GOLD, time);
      }
    }
    if (who === 'madara') this.meteor(id, actor, elapsed, time, fighters);
    if (who === 'tanjiro') {
      const burn = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .1, move.contacts[0] + .4) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .2));
      if (burn > .03 && actor.state.confirmedAt !== undefined) {
        actor.strikePoint(this.tip);
        for (let j = 0; j < 10 && this.flameCount < FLAMES; j++) {
          this.b.copy(actor.handR).lerp(this.tip, (j + .5) / 10);
          this.flame(this.b, j * 2.4, time + j, .7 * burn, (.9 + (j % 3) * .25) * burn, .95, (j * .137) % 1, FLAME_FIRE);
        }
        kit.arc(actor.handR, this.tip, kit.tick * 3 + 13, .03 * burn, SUN, burn, 1, 2, .2);
      }
    }
    if (who === 'levi') {
      let whirl = this.whirls.get(id);
      if (!whirl) { whirl = new BladeWhirl(this.scene); this.whirls.set(id, whirl); }
      const spin = move.contacts[1] - .12;
      const spinning = actor.state.confirmedAt === undefined ? 0
        : THREE.MathUtils.smoothstep(elapsed, spin, spin + .1) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .15));
      whirl.update(actor, spinning, this.seeing ? this.lens : undefined);
      if (spinning > .03) {
        const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
        this.side.set(this.forward.z, 0, -this.forward.x);
        this.c.copy(victim?.state.alive ? victim.group.position : this.a.copy(actor.group.position).addScaledVector(this.forward, 1.5));
        for (const sideSign of [-1, 1]) {
          this.b.copy(actor.group.position).setY(actor.group.position.y + .95);
          const hips = actor.bones.get('hips');
          if (hips) hips.getWorldPosition(this.b);
          this.tip.copy(this.c).addScaledVector(this.forward, 1.6).addScaledVector(this.side, sideSign * 2.6).setY(this.c.y + 4.6);
          kit.arc(this.b, this.tip, key + (sideSign > 0 ? 7 : 8), .012, colour.light, spinning, 0, 1, .02);
        }
      }
    }
    if (who === 'sung-jinwoo' && actor.state.confirmedAt !== undefined) {
      const rise = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .1, finish - .2) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .25));
      if (rise > .03) {
        this.side.set(this.forward.z, 0, -this.forward.x);
        for (let soldier = 0; soldier < 5; soldier++) {
          const across = (soldier - 2) * 1.1, back = 1.6 + Math.abs(soldier - 2) * .5;
          this.c.copy(actor.group.position).addScaledVector(this.side, across).addScaledVector(this.forward, -back).setY(actor.group.position.y);
          for (let j = 0; j < 14 && this.flameCount < FLAMES; j++) {
            const h = (j / 14) * 1.9 * rise;
            this.b.copy(this.c).setY(this.c.y + h + .1);
            this.b.x += Math.sin(j * 2.1 + soldier) * .14; this.b.z += Math.cos(j * 1.7 + soldier) * .14;
            this.flame(this.b, soldier * 1.3 + j * 2.4, time + j + soldier * 3, .9 * rise, 1.3 * rise, .7, ((j + soldier * 5) * .137) % 1, BLACK);
          }
          kit.glows.add(this.b.copy(this.c).setY(this.c.y + 1.75 * rise), .25 * rise, SHADOW, rise, STAR, .2, soldier + key);
        }
      }
    }
    if (who === 'gon' && actor.state.confirmedAt !== undefined) {
      const charge = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .1, finish - .15) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .15));
      if (charge > .03) kit.ball(actor.handR, .2 + charge * .65, 137, NaN, colour.glow, colour.light, .6);
    }
    if (who === 'itachi') {
      const look = THREE.MathUtils.smoothstep(elapsed, .05, move.contacts[0]) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .2));
      if (look > .03) kit.ball(this.eye(actor, this.a), .24 * look, 113, NaN, SHARINGAN, colour.light, .2);
    }
    if (who === 'saitama' && actor.state.confirmedAt !== undefined) {
      const open = move.contacts[0];
      const build = THREE.MathUtils.smoothstep(elapsed, open + .05, finish) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .08));
      if (build > .02) {
        if (kit.ticked) {
          const r = kit.painter.rng.seed(kit.tick * 11 + key);
          for (let i = 0; i < 2; i++) {
            this.c.set(r.signed(), r.signed() * .7, r.signed()).normalize();
            this.b.copy(actor.handR).addScaledVector(this.c, .38 + r.next() * .3);
            this.tip.copy(actor.handR).addScaledVector(this.c, .1);
            this.beam(this.b, this.tip, time, kit.tick * 3 + i + key, .012 + build * .014, SERIOUS, .1);
          }
        }
        const period = .3 - .14 * build, phase = Math.max(0, elapsed - open) / period;
        for (let i = 0; i < 2; i++) {
          const u = (phase + i * .5) % 1;
          kit.glows.add(actor.handR, .9 - u * .75, SERIOUS, u * (.35 + build * .6), RING, .25, (key + i) % 97);
        }
        kit.glows.add(actor.handR, .08 + build * .12, SERIOUS, .4 + build * .6, GLOW, .3, key % 97);
        if (kit.ticked && kit.tick % 2 === 0) {
          const r = kit.painter.rng.seed(kit.tick * 7 + key), angle = r.next() * Math.PI * 2, out = 1.8 + r.next() * 1.2, floor = actor.group.position.y;
          const x = actor.group.position.x + Math.sin(angle) * out, z = actor.group.position.z + Math.cos(angle) * out, pull = 2 + build * 4;
          VfxKit.for(this.scene).puff(x, floor + .1, z, -Math.sin(angle) * pull, .1, -Math.cos(angle) * pull, .5 + r.next() * .3, time, .45, .5);
        }
      }
    }
    if (who === 'jiren') {
      const charge = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .25, finish - .15) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .2));
      if (charge > .03) kit.ball(actor.handR, charge * .75, 83, NaN, colour.glow, colour.light, .6);
    }
    if (who === 'golden-frieza') {
      const gather = THREE.MathUtils.smoothstep(elapsed, .3, finish) * (1 - THREE.MathUtils.smoothstep(elapsed, finish, finish + .1));
      if (gather > .03) {
        kit.ball(actor.handL, gather * .5, 89, NaN, DEATH_BALL_RED, colour.light, .35);
        this.b.copy(actor.handL).addScaledVector(this.up, .12 + 1.5 * (.14 + .86 * Math.pow(Math.min(1, elapsed / finish), .8)) * .4);
        kit.arc(actor.handL, this.b, kit.tick * 3 + 7, .03 * gather + .01, DEATH_BALL_RED, gather, 1, 3, .3);
      }
      if (elapsed >= finish && this.drawn.get(`${id}:thrown`) !== key) {
        this.drawn.set(`${id}:thrown`, key);
        this.flash(this.a.copy(actor.handL), 1.2, key, 1.8, DEATH_BALL_RED, time);
      }
    }
    if (who === 'goku-black') {
      const draw = THREE.MathUtils.smoothstep(elapsed, move.contacts[0] + .3, finish - .35) * (1 - THREE.MathUtils.smoothstep(elapsed, finish + .05, finish + .3));
      if (draw > .03) {
        const grip = actor.handR;
        let slot = this.scythes.find(m => m.owner === id);
        slot ??= this.scythes.find(m => !m.owner) ?? this.scythes[0];
        slot.owner = id;
        this.axis.copy(grip).sub(this.c.copy(actor.group.position).setY(actor.group.position.y + 1.4));
        if (this.axis.lengthSq() < .01) this.axis.copy(this.up); else this.axis.normalize();
        this.side.copy(this.forward).addScaledVector(this.axis, -this.forward.dot(this.axis));
        if (this.side.lengthSq() < .01) this.side.copy(this.up).addScaledVector(this.axis, -this.up.dot(this.axis));
        this.side.normalize();
        this.tip.crossVectors(this.side, this.axis).normalize();
        const length = 1.15 * draw, butt = this.b.copy(grip).addScaledVector(this.axis, -.9 * draw);
        slot.haft.matrix.makeBasis(this.tip, this.axis, this.side).scale(this.c.set(1, length, 1)).setPosition(butt);
        slot.haft.matrixWorldNeedsUpdate = true;
        const head = this.a.copy(butt).addScaledVector(this.axis, length);
        slot.blade.matrix.makeBasis(this.side, this.axis, this.tip).scale(this.c.setScalar(draw)).setPosition(head);
        slot.blade.matrixWorldNeedsUpdate = true;
        slot.haft.visible = slot.blade.visible = true;
        this.c.copy(head);
        for (let i = 1; i <= 6; i++) {
          const t = i / 6, bend = 1.45 * t, reach = SCYTHE_REACH * draw;
          this.b.copy(head).addScaledVector(this.side, reach * Math.sin(bend)).addScaledVector(this.axis, -.62 * reach * (1 - Math.cos(bend)));
          kit.arc(this.c, this.b, kit.tick * 5 + i * 13, .03 * draw, colour.glow, 1.4 * draw, 0, 1, .05);
          this.c.copy(this.b);
        }
        kit.ball(grip, .3 * draw, 71, NaN, colour.glow, colour.light, .3);
      } else this.hideScythe(id);
    }
    if (who === 'sukuna') {
      const s = actor.state, stop = move.timeStop!, from = move.contacts[stop.contact], to = Math.min(finish + .45, whiffGone(s));
      if (elapsed >= from - .05 && elapsed < to) {
        const inside = elapsed - from, left = to - elapsed;
        const grow = inside < 0 ? .02 : 1 - Math.pow(1 - THREE.MathUtils.clamp(inside / .35, 0, 1), 3), close = THREE.MathUtils.smoothstep(left, 0, .28);
        let anchor = this.domainAt.get(id);
        if (!anchor) { anchor = {key: NaN, at: new THREE.Vector3(), flashed: false}; this.domainAt.set(id, anchor); }
        if (anchor.key !== s.actionStarted) { anchor.key = s.actionStarted; anchor.at.copy(actor.group.position); anchor.flashed = false; }
        const at = anchor.at, open = Math.max(.02, grow * close);
        this.domain.show(id, this.a.set(at.x, at.y + 1, at.z), at.y, stop.radius, open, time, .6 + .4 * close);
        if (inside >= 0 && !anchor.flashed) { anchor.flashed = true; this.flash(this.a, 2.2, key, 1.3, COLOR.sukuna.glow, time); }
        const strokes = Math.round(9 * Math.min(1, kit.density) * open);
        for (let i = 0; i < strokes; i++) {
          const clock = time * 6 + i * .37, slot = Math.floor(clock), age = clock - slot, r = kit.painter.rng.seed(slot * 31 + i * 7 + key);
          const yaw = r.next() * Math.PI * 2, out = Math.sqrt(r.next()) * stop.radius * .9 * open, tilt = r.signed() * 1.2, long = .7 + r.next() * 1.3;
          this.b.set(at.x + Math.sin(yaw) * out, at.y + .3 + r.next() * 2.4, at.z + Math.cos(yaw) * out);
          this.side.set(Math.cos(yaw + tilt), Math.sin(tilt) * .8, -Math.sin(yaw + tilt)).normalize();
          this.tip.copy(this.b).addScaledVector(this.side, long);
          const near = this.seeing ? THREE.MathUtils.smoothstep(this.b.distanceTo(this.lens), 1.2, 2.6) : 1;
          if (near > .02) kit.arc(this.b.addScaledVector(this.side, -long), this.tip, slot * 13 + i, .032, CUT_RED, 1.9 * (1 - age) * near, 0, 1, .02);
        }
        kit.lights.add(this.a, stop.radius * 1.1, COLOR.sukuna.light, .1 * open);
      } else this.domainAt.delete(id);
      const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
      const hands = this.b.copy(actor.handL).lerp(actor.handR, .5);
      const aim = victim ? this.c.copy(victim.group.position).setY(victim.group.position.y + 1.1) : this.c.copy(hands).addScaledVector(this.forward, 4);
      this.axis.subVectors(aim, hands);
      const span = this.axis.length();
      if (span > 1e-3) this.axis.divideScalar(span); else this.axis.copy(this.forward);
      const draw = THREE.MathUtils.smoothstep(elapsed, move.contacts[move.contacts.length - 2] + .05, finish - .2) * (1 - THREE.MathUtils.smoothstep(elapsed, finish - .15, finish - .12));
      if (draw > .03) {
        kit.ball(hands, draw * .8, 41, NaN, FIRE, FIRE_LIGHT, .5);
        this.tip.copy(hands).addScaledVector(this.axis, -.5);
        this.side.copy(hands).addScaledVector(this.axis, 1.1);
        kit.arc(this.tip, this.side, kit.tick * 3 + 41, .05 * draw, FIRE, 1.6 * draw, 0, 1, .02);
        for (let j = 0; j < 10 && this.flameCount < FLAMES; j++) {
          const t = j / 9;
          this.flame(this.tip.copy(hands).addScaledVector(this.axis, -.5 + t * 1.6), j * 1.7, time + j, .18 * draw, (.3 + .25 * (1 - Math.abs(t - .5) * 2)) * draw, .95, (j * .137) % 1, FLAME_FIRE);
        }
      }
      const fly = (elapsed - (finish - .14)) / .14;
      if (fly > 0 && fly < 1) {
        const head = this.tip.copy(hands).lerp(aim, fly);
        this.side.copy(head).addScaledVector(this.axis, -1.8);
        kit.arc(this.side, head, kit.tick * 3 + 43, .16, FIRE, 2.6, 0, 1, .03);
        for (let j = 0; j < 20 && this.flameCount < FLAMES; j++) {
          const t = j / 19;
          this.flame(this.side.copy(head).addScaledVector(this.axis, -t * 2.8), j * 1.3, time + j, .5 * (1 - t * .6), .75 * (1 - t * .5), .95 - t * .4, (j * .17) % 1, FLAME_FIRE);
        }
        kit.ball(head, .6, 43, NaN, FIRE, FIRE_LIGHT, .45);
        kit.lights.add(head, 4, FIRE_LIGHT, .8);
      }
      if (elapsed < finish) this.fuga.delete(id);
      else if (elapsed < finish + 1.1) {
        let at = this.fuga.get(id);
        if (!at && victim) { at = victim.group.position.clone(); this.fuga.set(id, at); }
        if (at) {
          const burn = 1 - (elapsed - finish) / 1.1;
          this.flameField(at, 3, Math.min(1, (elapsed - finish) * 6), burn, time, FLAME_FIRE, Math.round(110 * Math.min(1, kit.density)), 1.6);
          kit.lights.add(this.side.copy(at).setY(at.y + 1), 5, FIRE_LIGHT, .9 * burn);
        }
      }
    }
    if (who === 'aizen') {
      const cast = THREE.MathUtils.smoothstep(elapsed, .05, move.contacts[0]) * (1 - THREE.MathUtils.smoothstep(elapsed, move.contacts[0], move.contacts[0] + .25));
      if (cast > .03) kit.ball(actor.handR, cast * .7, 37, NaN, colour.glow, colour.light, .5);
      const victim = actor.state.target ? fighters.get(actor.state.target) : undefined;
      const shut = THREE.MathUtils.smoothstep(elapsed, move.contacts[0], move.contacts[0] + .45), burst = THREE.MathUtils.clamp((elapsed - finish) / .3, 0, 1);
      if (victim && actor.state.confirmedAt !== undefined && elapsed >= move.contacts[0] && burst < 1) {
        let slot = this.coffins.find(m => m.owner === id);
        slot ??= this.coffins.find(m => !m.owner) ?? this.coffins[0];
        slot.owner = id;
        const centre = this.c.copy(victim.group.position).setY(victim.group.position.y + 1.25), yaw = actor.state.yaw;
        const out = 1 + (1 - shut) * 2.4 + burst * 1.6, cos = Math.cos(yaw), sin = Math.sin(yaw);
        slot.slabs.forEach((slab, i) => {
          const [, , , x, y, z] = COFFIN_SLABS[i];
          const lift = i === 4 ? (1 - shut) * 2.2 + burst * 1.2 : 0;
          slab.position.set(centre.x + (x * cos + z * sin) * out, centre.y + y + lift, centre.z + (z * cos - x * sin) * out);
          slab.rotation.set(0, yaw, 0); slab.visible = true;
        });
        const opacity = Math.min(1, shut * 1.4) * (1 - burst);
        slot.material.uniforms.uOpacity.value = opacity; slot.material.uniforms.uTime.value = time;
        slot.material.depthWrite = opacity > .98;
      } else this.hideCoffin(id);
    }
    if (who === 'kaido' || who === 'shanks' || who === 'roger' || who === 'griffith') {
      const charge = THREE.MathUtils.smoothstep(elapsed, .2, finish - .1) * (1 - THREE.MathUtils.smoothstep(elapsed, finish + .05, finish + .35));
      if (charge > .03) {
        actor.strikePoint(this.tip);
        kit.arc(actor.handR, this.tip, kit.tick * 5 + 1, .045 * charge + .01, colour.glow, charge, 2, 3, .3);
        kit.arc(actor.handR, this.tip, kit.tick * 5 + 2, .03 * charge + .008, colour.glow, charge * .8, 1, 3, .38);
        kit.ball(this.tip, charge * .9, who === 'kaido' ? 17 : who === 'shanks' ? 19 : who === 'griffith' ? 43 : 29, NaN, colour.glow, colour.light, .5);
      }
    }
  }

  private draw(time: number, fighters: ReadonlyMap<string, Fighter>, density: number) {
    const kit = this.kit;
    for (const [id, held] of this.decoys) { held.decoy.update(time); if (!fighters.has(id)) { held.decoy.dispose(); this.decoys.delete(id); } }
    for (const cut of this.cuts) {
      if (!cut.active) continue;
      const age = time - cut.since;
      if (age > cut.seconds) { cut.active = false; cut.mesh.visible = false; continue; }
      cut.mesh.material.uniforms.uFade.value = age < 0 ? 0 : 1 - THREE.MathUtils.smoothstep(age, .05, cut.seconds);
      cut.mesh.material.uniforms.uClock.value = time;
    }
    for (const crack of this.cracks) {
      if (!crack.active) continue;
      const age = time - crack.since;
      if (age > crack.seconds) { crack.active = false; continue; }
      const life = Math.max(0, age) / crack.seconds, strength = (1 - life) * (age < .06 ? 1.6 : 1);
      this.side.crossVectors(crack.normal, Math.abs(crack.normal.y) > .9 ? this.axis.set(1, 0, 0) : this.up).normalize();
      this.c.crossVectors(this.side, crack.normal).normalize();
      const n = Math.max(4, Math.round(crack.count * Math.min(1, density)));
      for (let i = 0; i < n; i++) {
        const r = kit.painter.rng.seed(crack.seed * 131 + i * 17);
        const angle = (i / n) * Math.PI * 2 + r.signed() * .35, length = crack.reach * (.45 + .55 * r.next()) * (.75 + .25 * Math.min(1, age * 12));
        this.a.copy(crack.center).addScaledVector(this.side, Math.cos(angle) * length).addScaledVector(this.c, Math.sin(angle) * length);
        kit.arc(crack.center, this.a, crack.seed * 7 + i, .022 * strength + .006, crack.color, strength, 2, 3, .5);
      }
      const size = Math.min(1, crack.reach / 2.2);
      if (!DREAM_IMPACT) {
        kit.glows.add(crack.center, .9 * strength * size, crack.color, strength, STAR, .2, crack.seed);
        if (age < .25) kit.glows.add(crack.center, 1.4 * (1 - age * 3) * size, crack.color, .8, RING, .06, crack.seed, .35 + age * 2);
      }
    }
    for (const ring of this.rings) {
      if (!ring.active) continue;
      const age = time - ring.since;
      if (age > RING_SECONDS) { ring.active = false; ring.mesh.visible = false; continue; }
      const life = Math.max(0, age) / RING_SECONDS;
      ring.mesh.scale.setScalar(.2 + ring.radius * (1 - (1 - life) * (1 - life)));
      ring.mesh.material.opacity = (1 - life) * .9 * Math.min(1, density + .3);
    }
    for (const dome of this.domes) {
      if (!dome.active) continue;
      const age = time - dome.since;
      if (age > dome.seconds) { dome.active = false; dome.mesh.visible = false; continue; }
      const actor = fighters.get(dome.actorId);
      if (actor) dome.mesh.position.copy(actor.group.position).setY(actor.group.position.y + dome.lift);
      const open = THREE.MathUtils.smoothstep(age, 0, DOME_OPEN), close = 1 - THREE.MathUtils.smoothstep(age, dome.seconds * .55, dome.seconds);
      dome.mesh.scale.setScalar(Math.max(.05, dome.radius * open));
      dome.mesh.material.uniforms.uTime.value = time; dome.mesh.material.uniforms.uOpacity.value = .55 * close;
    }
    for (const strike of this.strikes) {
      if (!strike.active) continue;
      const age = time - strike.since;
      if (age > STRIKE_SECONDS) { strike.active = false; continue; }
      const life = Math.max(0, age) / STRIKE_SECONDS, strength = (1 - life) * (1 - life);
      const victim = strike.targetId ? fighters.get(strike.targetId) : undefined;
      if (victim && strike.kind === 'sky') strike.center.copy(victim.group.position).setY(victim.group.position.y + 1.1);
      if (strike.kind === 'sky') {
        const colour = COLOR.kaido;
        for (let i = 0; i < 3; i++) {
          const r = kit.painter.rng.seed(strike.seed * 11 + i * 29 + kit.tick);
          this.a.set(r.signed() * 1.6, 7 + r.next() * 3, r.signed() * 1.6).add(strike.center);
          kit.arc(this.a, strike.center, strike.seed + i * 3 + kit.tick, .08 * strength + .02, colour.glow, strength * 1.4, 3, 4, .32);
        }
        kit.flash(strike.center, Math.min(1.4, strength * 1.6), strike.seed % 97, 2.2 + life, colour.glow);
      } else {
        const colour = strike.color, n = Math.max(6, Math.round(12 * Math.min(1, density))), haki = colour === HAKI_RED;
        for (let i = 0; i < n; i++) {
          const r = kit.painter.rng.seed(strike.seed * 13 + i * 37);
          const angle = (i / n) * Math.PI * 2 + r.signed() * .3, reach = (2.2 + r.next() * 2.4) * (.4 + .6 * Math.min(1, age * 8));
          this.a.set(Math.cos(angle) * reach, .05 + r.next() * .4, Math.sin(angle) * reach).add(strike.center);
          if (haki) this.hakiBolt(strike.center, this.a, strike.seed + i * 5 + kit.tick, .06 * strength + .015, strength * 1.2, 1);
          else kit.arc(strike.center, this.a, strike.seed + i * 5 + kit.tick, .03 * strength + .008, colour, strength * 1.2, 2, 3, .42);
        }
        kit.flash(strike.center, Math.min(1.2, strength * 1.3), strike.seed % 97, 1.6, colour);
      }
    }
    for (const flash of this.flashes) {
      if (!flash.active) continue;
      const age = time - flash.since;
      if (age > FLASH_SECONDS) { flash.active = false; continue; }
      const life = Math.max(0, age) / FLASH_SECONDS;
      if (flash.soft) this.softFlash(flash.center, flash.strength * (1 - life) * (1 - life), flash.seed, flash.reach, flash.color);
      else kit.flash(flash.center, flash.strength * (1 - life) * (1 - life), flash.seed, flash.reach, flash.color);
    }
    this.drawDazes(time, fighters);
    for (const beam of this.beams) {
      if (!beam.active) continue;
      const age = time - beam.since;
      if (age < 0) continue;
      if (age > beam.seconds) { beam.active = false; continue; }
      const strength = 1 - age / beam.seconds;
      kit.arc(beam.from, beam.to, beam.seed, beam.width * (.45 + .55 * strength), beam.color, 1.7 * strength, 0, 1, .015);
      kit.glows.add(beam.from, .16 * strength, beam.color, strength, STAR, .2, beam.seed % 97);
      kit.glows.add(beam.to, .32 * strength, beam.color, strength, STAR, .2, (beam.seed + 5) % 97);
    }
  }

  private softFlash(center: THREE.Vector3, strength: number, seed: number, reach: number, color: THREE.Color) {
    if (strength < .02) return;
    const kit = this.kit;
    kit.glows.add(center, .75 * strength, color, 1, STAR, .2, seed);
    kit.glows.add(center, .55 * reach * strength, color, .8, RING, .06, seed, .35 + .5 * (1 - strength));
    kit.halos.add(center, 1.2 * strength, this.softTint.copy(color).multiplyScalar(.45), .55 * strength, GLOW, .1);
    kit.lights.add(center, 3.4 * strength, this.softTint.copy(color).multiplyScalar(.5), .7 * strength);
  }
  private drawDazes(time: number, fighters: ReadonlyMap<string, Fighter>) {
    const kit = this.kit;
    for (const d of this.dazes) {
      if (!d.active) continue;
      const victim = fighters.get(d.targetId), age = time - d.since;
      if (age < -.05) continue;
      if (!victim || !victim.state.alive || age > DIZZY_SECONDS + .1 || age > .3 && victim.state.action !== 'stun') { d.active = false; continue; }
      const head = victim.joints.get('Head');
      if (head) head.getWorldPosition(this.m4); else this.m4.copy(victim.group.position).setY(victim.group.position.y + 1.7);
      this.m4.y += .3;
      const fade = Math.min(1, Math.max(0, age) / .12) * (1 - THREE.MathUtils.smoothstep(age, DIZZY_SECONDS - .25, DIZZY_SECONDS + .1));
      for (let i = 0; i < 3; i++) {
        const a = time * 5.5 + i * 2.094;
        this.m3.set(this.m4.x + Math.cos(a) * .32, this.m4.y + Math.sin(a * 2 + i) * .05, this.m4.z + Math.sin(a) * .32);
        kit.glows.add(this.m3, .14, d.glow, fade, STAR, .25, (d.seed + i * 7 + kit.tick) % 97);
      }
      kit.glows.add(this.m4, .42, d.glow, .3 * fade, RING, .05, d.seed, .55);
      if (d.electric && kit.ticked && (kit.tick + d.seed) % 3 === 0) {
        const r = kit.painter.rng.seed(kit.tick * 17 + d.seed);
        this.m3.set(this.m4.x + r.signed() * .3, this.m4.y - .2 - r.next() * 1.2, this.m4.z + r.signed() * .3);
        this.m1.set(this.m4.x + r.signed() * .3, this.m4.y - .1 - r.next() * .6, this.m4.z + r.signed() * .3);
        kit.arc(this.m3, this.m1, kit.tick + d.seed, .02 * fade, d.glow, fade, 1, 3, .35);
      }
    }
  }

  reset() {
    this.seen.clear(); this.drawn.clear(); this.enderDrawn.clear(); this.enderHit.clear(); this.enderAt.clear();
    for (const d of this.dazes) d.active = false;
    for (const cut of this.cuts) { cut.active = false; cut.mesh.visible = false; }
    for (const crack of this.cracks) crack.active = false;
    for (const ring of this.rings) { ring.active = false; ring.mesh.visible = false; }
    for (const dome of this.domes) { dome.active = false; dome.mesh.visible = false; }
    for (const strike of this.strikes) strike.active = false;
    for (const flash of this.flashes) flash.active = false;
    for (const beam of this.beams) beam.active = false;
    this.fields.clear(); this.flames.count = 0;
    for (const m of this.meteors) { m.mesh.visible = false; m.owner = ''; }
    for (const m of this.scythes) { m.haft.visible = m.blade.visible = false; m.owner = ''; }
    for (const m of this.coffins) { for (const slab of m.slabs) slab.visible = false; m.owner = ''; }
    for (const m of this.gunbais) { m.fan.visible = false; m.owner = ''; }
    this.domain.reset(); this.domainAt.clear();
    for (const held of this.decoys.values()) held.decoy.reset();
    for (const whirl of this.whirls.values()) whirl.hide();
    this.crows?.reset(); this.crowsAt = NaN;
    for (const clone of this.clones.values()) clone.reset();
    for (const actor of [...this.formed.keys()]) this.unform(actor);
    this.signatures = [];
    this.fuga.clear();
    for (const f of this.hidden) f.group.visible = true;
    this.hidden.clear();
    this.kit.reset();
  }

  dispose() {
    this.reset();
    for (const cut of this.cuts) { cut.mesh.removeFromParent(); cut.mesh.material.dispose(); }
    for (const ring of this.rings) { ring.mesh.removeFromParent(); ring.mesh.material.dispose(); }
    for (const dome of this.domes) { dome.mesh.removeFromParent(); dome.mesh.material.dispose(); }
    this.flames.removeFromParent(); this.flames.geometry.dispose(); this.flameMaterial.dispose();
    for (const m of this.meteors) { m.mesh.removeFromParent(); (m.mesh.material as THREE.Material).dispose(); }
    this.meteors[0]?.mesh.geometry.dispose();
    for (const m of this.scythes) for (const mesh of [m.haft, m.blade]) { mesh.removeFromParent(); (mesh.material as THREE.Material).dispose(); }
    this.ink.dispose();
    for (const m of this.coffins) { for (const slab of m.slabs) { slab.removeFromParent(); slab.geometry.dispose(); } m.material.dispose(); }
    this.domain.dispose();
    for (const held of this.decoys.values()) held.decoy.dispose(); this.decoys.clear();
    for (const whirl of this.whirls.values()) whirl.dispose(); this.whirls.clear();
    this.crows?.dispose(); this.crows = undefined;
    for (const clone of this.clones.values()) clone.dispose(); this.clones.clear(); this.warmDecoy?.dispose(); this.warmDecoy = undefined; this.warmWhirl?.dispose(); this.warmWhirl = undefined;
    for (const m of this.gunbais) { m.fan.removeFromParent(); m.fan.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } }); }
    this.scythes[0]?.haft.geometry.dispose(); this.scythes[0]?.blade.geometry.dispose();
    this.cutGeometry.dispose(); this.ringGeometry.dispose(); this.sphere.dispose();
    for (const shell of this.allShells) shell.dispose(); this.allShells = [];
    this.vfx?.release(); this.vfx = undefined;
    this.kit.dispose();
  }
}
