import * as THREE from 'three';
import { noiseTexture } from '../noiseTexture';

export const SHEET = { body: 0, flare: 1, veil: 2 } as const;
export type Sheet = typeof SHEET[keyof typeof SHEET];
export const SHEETS = { body: 1, flare: 2, veil: 4, all: 7 } as const;
const CARD_WIDTH = 1.36;

const VERTEX = `
attribute vec4 aHot; attribute vec4 aCore; attribute vec4 aDeep; attribute vec4 aShape; attribute vec4 aMore;
varying vec2 vUv; varying vec4 vHot; varying vec4 vCore; varying vec4 vDeep; varying vec4 vShape; varying vec4 vMore; varying vec2 vSize;
void main(){
  vUv = uv; vHot = aHot; vCore = aCore; vDeep = aDeep; vShape = aShape; vMore = aMore;
  vSize = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  float len = max(length(mv.xyz), 1e-3);
  // Along its own ray: the same place on the screen, nearer or further in depth - never through the lens.
  mv.xyz *= max(len + aShape.x, .12) / len;
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform float uTime; uniform sampler2D uNoise;
uniform vec4 uForm;   // x: the bell's widest point up the card, y: tongue reach, z: tongues up each side, w: rise speed
uniform vec4 uBands;  // x: where the edge starts to light, y: where the heart gives way to the body, z: halo reach, w: halo strength
varying vec2 vUv; varying vec4 vHot; varying vec4 vCore; varying vec4 vDeep; varying vec4 vShape; varying vec4 vMore; varying vec2 vSize;
/* Flame tongues on the edge, one to a slot up each side from the floor (a = PI) to the crown (a = 0). Each is a spike
   with concave flanks and a sharp tip, of its own width and length, that grows and dies on its own clock while the
   whole row rides up toward the crown. Up to 1.1 long. */
float tongues(float a, float t, float seed, float count, float rise){
  float u = a * .3183 * count + t * rise, i = floor(u), reach = 0.;
  for (int k = -1; k <= 1; k++) {
    float id = i + float(k);
    vec2 hg = fract(sin(vec2(id + seed, id * 1.73 + seed + 3.1) * 127.1) * 43758.5453);
    float c = id + .5 + (hg.y - .5) * .5, w = .45 + .5 * hg.x;
    float life = fract(t * (.45 + .5 * hg.x) + hg.y);
    float len = (.2 + .9 * hg.y * hg.y * hg.y) * sin(3.1416 * life);
    float f = max(0., 1. - abs(u - c) / w);
    reach = max(reach, len * f * f * (1.3 - .3 * f));
  }
  return reach;
}
void main(){
  float seed = vCore.w, sheet = vDeep.w, strength = vShape.y, flare = vShape.z, heart = vShape.w, bodyCover = vMore.x;
  // The bell: widest low, domed over the crown.
  float x = vUv.x * 2. - 1., y = vUv.y, cy = uForm.x;
  float dome = 1. - .22 * smoothstep(cy, 1., y);
  vec2 q = vec2(x * 1.45 / dome, (y - cy) / (y > cy ? .9 - cy : cy * 3.));
  float d = length(q);
  float th = atan(q.x, q.y), a = abs(th), side = th < 0. ? 0. : 17.3;
  float crown = smoothstep(2.95, 2.4, a) * (.4 + .6 * smoothstep(1.9, .1, a));
  float reach = uForm.y * crown * (.75 + .5 * flare);
  // Past the longest tongue and its halo there is nothing to draw: most of the card, and the cheapest way out of it.
  if (d > 1. + 1.9 * reach + uBands.z) { gl_FragColor = vec4(0.); return; }
  float t = uTime * uForm.w * (1. + .6 * flare) + seed * 7.13;
  // Further out, nearer the crown: the tongues curl up as they leave.
  float ab = max(0., a - clamp(d - .9, 0., .8) * .55);
  float e = d - (tongues(ab, t * .5, seed + side, uForm.z, .55) + .7 * tongues(ab, t * .9, seed * 1.9 + side + 5.7, uForm.z * 2.3, 1.1)) * reach;
  float aa = fwidth(e) * 1.2 + 1e-4;
  float inside = 1. - smoothstep(1. - aa, 1. + aa, e);
  float edge = smoothstep(.9, 1., e);
  float card = 1. - smoothstep(.86, .99, abs(x));
  vec3 hot = vHot.rgb * vHot.w;
  // FLARE is its edge only; VEIL the faint front of it: neither needs the layers inside.
  if (sheet > .5) {
    float cover = inside * edge * (sheet > 1.5 ? .45 : 1.) * strength * card;
    gl_FragColor = vec4(mix(vCore.rgb, hot, .5 + .5 * smoothstep(.95, 1., e)) * cover, cover);
    return;
  }
  // Layers of flame inside it, each edged in tongues of its own, as the reference draws them: the deep heart round the
  // fighter, the body of the aura's own colour licking up into it, a lighter flame inside the edge, and the white-hot
  // edge itself. The colour within a layer is soft; the layers meet hard.
  vec3 col = hot;
  float g = 1.;
  if (e < 1.05) {
    float lift = smoothstep(2.9, .2, a);
    float heartEdge = d + tongues(ab, t * .62, seed * 2.7 + side + 11.3, uForm.z * .8, .7) * .26 * lift;
    float lightEdge = d + tongues(ab, t * .8, seed * 3.3 + side + 23.9, uForm.z * 1.3, .9) * .16 * lift;
    float ah = fwidth(heartEdge) * 1.2 + 1e-4, al = fwidth(lightEdge) * 1.2 + 1e-4;
    g = smoothstep(uBands.y - ah, uBands.y + ah, heartEdge);
    float light = smoothstep(uBands.x - al, uBands.x + al, lightEdge);
    col = mix(vDeep.rgb * (.8 + .4 * smoothstep(.0, uBands.y, d)), vCore.rgb, g);
    col = mix(col, mix(vCore.rgb, hot, .3), light);
    float lit = smoothstep(.95, 1., e) * .65 + smoothstep(1., 1.3, d) * .45 + smoothstep(.3, .95, y) * smoothstep(.7, 1., d) * .2;
    col = mix(col, hot, lit);
    // The floor it stands on burns white - a glow at its foot, not a line drawn across the floor.
    col = mix(col, hot, (1. - smoothstep(.0, .1, y)) * .45);
  }
  float cover = max(inside * mix(heart, bodyCover, g), inside * edge * .9) * strength * card;
  float halo = (1. - smoothstep(1., 1. + uBands.z, e)) * (1. - inside) * uBands.w * strength;
  gl_FragColor = vec4(col * cover + vHot.rgb * halo * card, cover);
}`;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
const white = new THREE.Color(1, 1, 1);

export interface KiColours { hot: THREE.Color; core: THREE.Color; deep: THREE.Color; hotness: number }
export function kiColours(coreHex: number, rimHex: number, out?: KiColours): KiColours {
  const o = out ?? { hot: new THREE.Color(), core: new THREE.Color(), deep: new THREE.Color(), hotness: 1.8 };
  o.core.setHex(coreHex);
  o.hot.copy(o.core).lerp(white, .45);
  o.core.getHSL(hsl);
  if (hsl.s > .12) o.core.setHSL(hsl.h, Math.max(hsl.s, .92), Math.min(hsl.l, .58));
  o.core.multiplyScalar(.82 / Math.max(.82, o.core.r, o.core.g, o.core.b));
  o.deep.setHex(rimHex).getHSL(hsl);
  o.deep.setHSL(hsl.h, Math.min(1, hsl.s * 1.1 + .1), Math.min(hsl.l, .42)).multiplyScalar(.8);
  return o;
}
const hsl = { h: 0, s: 0, l: 0 };

export interface KiAuraDraw {
  x: number; y: number; z: number;
  size: number;
  aspect?: number;
  strength: number;
  flare: number;
  heart: number;
  body?: number;
  colours: KiColours;
  seed: number;
  sheets?: number;
  push?: number;
}

export class KiAura {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private aHot: THREE.InstancedBufferAttribute; private aCore: THREE.InstancedBufferAttribute;
  private aDeep: THREE.InstancedBufferAttribute; private aShape: THREE.InstancedBufferAttribute;
  private aMore: THREE.InstancedBufferAttribute;
  private count = 0;
  private eye = new THREE.Vector3();
  private drawn = false;
  constructor(scene: THREE.Scene, readonly capacity = 48) {
    const geometry = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
    const attr = () => new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aHot = attr(); this.aCore = attr(); this.aDeep = attr(); this.aShape = attr(); this.aMore = attr();
    geometry.setAttribute('aHot', this.aHot); geometry.setAttribute('aCore', this.aCore); geometry.setAttribute('aDeep', this.aDeep);
    geometry.setAttribute('aShape', this.aShape); geometry.setAttribute('aMore', this.aMore);
    const material = new THREE.ShaderMaterial({
      name: 'KiAura', vertexShader: VERTEX, fragmentShader: FRAGMENT,
      uniforms: { uTime: { value: 0 }, uNoise: { value: noiseTexture() },
        uForm: { value: new THREE.Vector4(.14, .5, 15, 1.2) }, uBands: { value: new THREE.Vector4(.9, .42, .1, .25) } },
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'ki-aura'; this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.renderOrder = 2;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.onAfterRender = () => { this.drawn = true; };
    scene.add(this.mesh);
  }

  begin(time: number, camera?: THREE.Camera) {
    this.count = 0;
    this.mesh.material.uniforms.uTime.value = time;
    if (camera) camera.getWorldPosition(this.eye);
  }

  draw(a: KiAuraDraw) {
    if (a.strength <= .005 || a.size <= .01) return;
    const sheets = a.sheets ?? SHEETS.body, push = a.push ?? .55;
    _q.setFromAxisAngle(_y, Math.atan2(this.eye.x - a.x, this.eye.z - a.z));
    if (sheets & SHEETS.flare) this.sheet(a, SHEET.flare, 1.08, 1.12, push + .3, a.seed + 3.7);
    if (sheets & SHEETS.body) this.sheet(a, SHEET.body, 1, 1, push, a.seed);
    if (sheets & SHEETS.veil) this.sheet(a, SHEET.veil, .94, .95, -.35, a.seed + 9.1);
  }

  private sheet(a: KiAuraDraw, kind: Sheet, wide: number, tall: number, push: number, seed: number) {
    if (this.count >= this.capacity) return;
    const i = this.count++, c = a.colours;
    _p.set(a.x, a.y - .04, a.z); _s.set(a.size * CARD_WIDTH * (a.aspect ?? 1) * wide, a.size * tall, 1);
    this.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    this.aHot.setXYZW(i, c.hot.r, c.hot.g, c.hot.b, c.hotness);
    this.aCore.setXYZW(i, c.core.r, c.core.g, c.core.b, seed % 97);
    this.aDeep.setXYZW(i, c.deep.r, c.deep.g, c.deep.b, kind);
    this.aShape.setXYZW(i, push, a.strength, a.flare, a.heart);
    this.aMore.setXYZW(i, a.body ?? .94, 0, 0, 0);
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0 || !this.drawn;
    if (!this.count) return;
    this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, this.count * 16); this.mesh.instanceMatrix.needsUpdate = true;
    for (const attr of [this.aHot, this.aCore, this.aDeep, this.aShape, this.aMore]) { attr.clearUpdateRanges(); attr.addUpdateRange(0, this.count * 4); attr.needsUpdate = true; }
  }

  get live() { return this.count; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
