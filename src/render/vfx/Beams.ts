// The tube construction and the facing term are adapted from
// LinearAbiltyCastingExtendedThreeJS (MIT, Mohamed Achref Elouafi, 2026),
// by way of GrowthLanceMaterial; see LICENSE.upstream.txt.
import * as THREE from 'three';
import { noiseGLSL } from './noise';
import { noiseTexture, NOISE_GLSL } from './noiseTexture';
import { VEIL, VEIL_GLSL, veilUniforms } from './VictimVeil';
import { DREAM_IMPACT } from '../dreamFlag';

/** How many beams may be drawn at once. One instance apiece, two draws for all. */
export const MAX_BEAMS = 6;

const UNIFORMS = /* glsl */`
uniform vec3 uOrigin[MAX_BEAMS]; uniform vec3 uTarget[MAX_BEAMS];
uniform vec4 uState[MAX_BEAMS]; uniform vec3 uShell[MAX_BEAMS]; uniform vec3 uEdge[MAX_BEAMS]; uniform vec4 uExtra[MAX_BEAMS];
uniform float uTime; uniform float uStrike; uniform float uHold;
`;

const TUBE_VERTEX = /* glsl */`
#define TAU 6.283185307179586
attribute float aLance;
${UNIFORMS}
varying float vT; varying float vA; varying float vFacing; varying float vSeed; varying float vFade; varying float vLen;
varying vec3 vShell; varying vec3 vEdge; varying float vLive; varying float vAxial;
varying vec3 vWorld; varying vec3 vFrom; varying vec3 vDir; varying float vRadius;
${noiseGLSL}
void main(){
  int i = int(aLance + .5);
  vec3 from = uOrigin[i], to = uTarget[i]; vec4 st = uState[i];
  float life = st.x, seed = st.y, radius = st.z, live = st.w;
  vShell = uShell[i]; vEdge = uEdge[i]; vLive = live; vSeed = seed;
  // Fast out of the hands, eased so it lands rather than stopping dead.
  float reach = 1.0 - pow(1.0 - clamp(life / max(uStrike, 1e-3), 0.0, 1.0), 3.0);
  float spent = clamp((life - uHold) / max(1.0 - uHold, 1e-3), 0.0, 1.0);
  vFade = 1.0 - spent * spent;
  vec3 delta = to - from; float span = max(length(delta), .01); vec3 dir = delta / span;
  vec3 n1 = normalize(cross(dir, abs(dir.y) < .9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), n2 = cross(dir, n1);
  float t = position.x * reach, ang = position.y * TAU, metres = t * span;
  vLen = span; vT = t; vA = position.y;
  vec3 nrm = n1 * cos(ang) + n2 * sin(ang);
  // Out of the palms at half its width, full width a metre on: the beam is
  // poured from the hands, and is the full beam almost at once.
  float muzzle = smoothstep(0.0, 1.0, metres);
  float r = radius * mix(.5, 1.0, muzzle);
  float billow = snoise(vec3(cos(ang) * 2.2, sin(ang) * 2.2, metres * .8 - uTime * 9.0 + seed));
  r *= 1.0 + billow * .1 * muzzle + .05 * sin(metres * 1.2 - uTime * 26.0 + seed);
  r *= vFade * smoothstep(0.0, .02, position.x) * (1.0 - smoothstep(.975, 1.0, position.x));
  vec3 axis = from + dir * metres;
  float ends = sin(clamp(position.x, 0.0, 1.0) * 3.14159);
  axis += (n1 * snoise(vec3(t * 3.0, uTime * 1.5, seed)) + n2 * snoise(vec3(t * 3.0 + 21.3, uTime * 1.5, seed + 4.1))) * .06 * ends;
  vec3 here = mix(from, axis + nrm * max(r, 1e-5), live);
  vec3 ray = normalize(cameraPosition - here), radial = ray - dir * dot(ray, dir);
  vFacing = clamp(abs(dot(radial, nrm)) / max(length(radial), 1e-3), 0.0, 1.0);
  vAxial = abs(dot(ray, dir));
  vWorld = here; vFrom = from; vDir = dir; vRadius = max(r, 1e-3);
  gl_Position = projectionMatrix * viewMatrix * vec4(here, 1.0);
}`;

/** The dream loop (22 October 2026): the white core is the beam's heart, not its body - narrower, so the saturated
 *  shell round it reads as the beam's colour, as the reference's Kamehameha does; at .46-.58 it was a white bar. */
const CORE_BAND = DREAM_IMPACT ? [.62, .72] : [.46, .58];
const TUBE_FRAGMENT = /* glsl */`
#define TAU 6.283185307179586
#define CORE_IN ${CORE_BAND[0].toFixed(2)}
#define CORE_OUT ${CORE_BAND[1].toFixed(2)}
uniform float uTime;
varying float vT; varying float vA; varying float vFacing; varying float vSeed; varying float vFade; varying float vLen;
varying vec3 vShell; varying vec3 vEdge; varying float vLive; varying float vAxial;
varying vec3 vWorld; varying vec3 vFrom; varying vec3 vDir; varying float vRadius;
uniform float uVeilStrength;
${NOISE_GLSL}
${VEIL_GLSL}
const vec3 INK = vec3(.012, .016, .04);
void main(){
  if (vLive < .5) discard;
  float metres = vT * vLen;
  // How close this pixel's view ray passes to the beam's axis, against the
  // radius: 1 straight through the middle, 0 grazing the edge. Measured on
  // the ray itself, so it holds from any angle, including from behind the
  // caster straight down the beam.
  vec3 ray = normalize(vWorld - cameraPosition), w = cameraPosition - vFrom, cr = cross(ray, vDir);
  float cl = length(cr);
  float b = cl > 1e-3 ? abs(dot(w, cr)) / cl : length(w - dot(w, vDir) * vDir);
  float through = 1.0 - clamp(b / vRadius, 0.0, 1.0);
  float aa = fwidth(through) + 1e-4;
  float flow = tnoise(vec2(vA * 2.0, metres * .09 - uTime * 1.6 + vSeed * .1)).b * 2.0 - 1.0;
  float streak = smoothstep(.25, .8, flow);
  float helix = 1.0 - smoothstep(0.0, .14, abs(fract(vA * 2.0 - metres * .3 + uTime * 2.6 + vSeed) - .5) * 2.0);
  // Solid, in four printed bands from the rim in: an ink line, the deep
  // edge colour, the saturated shell with the flow and a helix running down
  // it, and a white-hot core wide enough to be the body of the beam. The
  // core and the brightest of the flow go well past the bloom threshold;
  // the shell sits just under it and stays coloured. It used to be a pale
  // see-through funnel with a thin white line down it.
  float ink = 1.0 - smoothstep(aa * 1.8, aa * 3.4, through);
  vec3 col = mix(vEdge * 1.4, vShell * .85, smoothstep(.05, .2, through));
  col += (vShell * .6 + .15) * (helix * .45 + streak * .4) * smoothstep(.08, .22, through);
  float core = smoothstep(CORE_IN - aa, CORE_OUT + aa, through + streak * .08);
  col = mix(col, vec3(2.3) + vShell * .6, core);
  col = mix(col, vec3(3.2), smoothstep(.78, .94, through));
  col = mix(col, INK, ink);
  // Thinned where it passes in front of the body it is hitting (VictimVeil).
  gl_FragColor = vec4(col * vFade + INK * (1.0 - vFade) * ink, vFade * victimVeilThrough(vWorld, uVeilStrength));
}`;

const CORONA_VERTEX = /* glsl */`
attribute float aLance;
${UNIFORMS}
varying vec2 vMetric; varying float vR; varying float vLen; varying float vFade; varying float vSeed; varying vec3 vShell; varying float vLive; varying vec4 vExtra;
varying vec3 vVeil;
void main(){
  int i = int(aLance + .5);
  vec3 from = uOrigin[i], to = uTarget[i]; vec4 st = uState[i];
  float reach = 1.0 - pow(1.0 - clamp(st.x / max(uStrike, 1e-3), 0.0, 1.0), 3.0);
  float spent = clamp((st.x - uHold) / max(1.0 - uHold, 1e-3), 0.0, 1.0);
  vFade = 1.0 - spent * spent; vSeed = st.y; vShell = uShell[i]; vLive = st.w; vExtra = uExtra[i];
  vec3 delta = to - from; float span = max(length(delta), .01); vec3 dir = delta / span;
  float head = span * reach, R = st.z * 1.9 * uExtra[i].y, ext = R * 1.3;
  float along = mix(-ext, head + ext, position.x * .5 + .5);
  vec3 p = from + dir * along;
  vec3 side = cross(dir, normalize(cameraPosition - p)); float sl = length(side);
  side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
  float across = position.y * ext;
  vMetric = vec2(along, across); vR = R; vLen = head;
  vVeil = mix(from, p + side * across, st.w);
  gl_Position = projectionMatrix * viewMatrix * vec4(vVeil, 1.0);
}`;

const CORONA_FRAGMENT = /* glsl */`
uniform float uTime; uniform float uVeilStrength;
varying vec2 vMetric; varying float vR; varying float vLen; varying float vFade; varying float vSeed; varying vec3 vShell; varying float vLive; varying vec4 vExtra;
varying vec3 vVeil;
${NOISE_GLSL}
${VEIL_GLSL}
void main(){
  if (vLive < .5) discard;
  float along = vMetric.x, across = vMetric.y;
  float outside = along < 0.0 ? -along : max(0.0, along - vLen);
  float d2 = (outside * outside + across * across) / (vR * vR);
  float wisp = tnoise(vec2(along * .04 - uTime * .7, across / vR * .25 + vSeed * .1)).g;
  // The saturated glow the beam throws round itself: strongest at the tube's
  // wall, which is half the corona's radius, and fading out past it.
  float glow = exp(-d2 * 2.6) * (.75 + .5 * wisp);
  // The palms and the point of impact burn brighter than the length of it.
  float muzzle = exp(-(along * along + across * across) / (vR * vR * .1));
  float hit = exp(-((along - vLen) * (along - vLen) + across * across) / (vR * vR * .14)) * vExtra.x;
  vec3 col = vShell * glow * .8 + (vec3(1.1) + vShell) * (muzzle * .5 + hit * .7);
  gl_FragColor = vec4(col * vFade * vExtra.z * victimVeilThrough(vVeil, uVeilStrength), 0.0);
}`;

const additive = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } as const;
const colour = new THREE.Color();

/** The energy beams: Kamehameha, Galick Gun, Final Flash, Hollow Purple.
 *
 *  Two layers per beam, each one instanced draw for every beam in flight: a
 *  solid tube, nearly as wide as the move's hitbox - an inked rim, the deep
 *  edge colour, a saturated shell with flow and a helix travelling along it,
 *  and a white-hot core that blooms - and a corona, one camera-facing quad
 *  along the beam, that throws the coloured glow around it and burns white
 *  at the palms and at whatever it hit.
 */
export class Beams {
  readonly tube: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  readonly corona: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private uniforms: Record<string, THREE.IUniform>;
  private used = 0;
  constructor(scene: THREE.Scene) {
    const vec3s = () => Array.from({ length: MAX_BEAMS }, () => new THREE.Vector3());
    const vec4s = (w = 0) => Array.from({ length: MAX_BEAMS }, () => new THREE.Vector4(0, 0, 1, w));
    this.uniforms = {
      uOrigin: { value: vec3s() }, uTarget: { value: vec3s() }, uState: { value: vec4s() },
      uShell: { value: vec3s() }, uEdge: { value: vec3s() }, uExtra: { value: vec4s() },
      uTime: { value: 0 }, uStrike: { value: .03 }, uHold: { value: .8 }, uNoise: { value: noiseTexture() },
    };
    const lance = new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: MAX_BEAMS }, (_, i) => i)), 1);
    const tube = new THREE.InstancedBufferGeometry(), vertices: number[] = [], indices: number[] = [];
    const rows = 48, cols = 20;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) vertices.push(i / (rows - 1), j / (cols - 1), 0);
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) { const a = i * cols + j, b = a + cols; indices.push(a, b, a + 1, b, b + 1, a + 1); }
    tube.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); tube.setIndex(indices);
    tube.setAttribute('aLance', lance); tube.instanceCount = MAX_BEAMS;
    this.tube = new THREE.Mesh(tube, new THREE.ShaderMaterial({ name: 'BeamTube', defines: { MAX_BEAMS }, uniforms: { ...this.uniforms, ...veilUniforms(VEIL.beam) },
      vertexShader: TUBE_VERTEX, fragmentShader: TUBE_FRAGMENT, transparent: true, depthWrite: false, side: THREE.BackSide, toneMapped: false }));
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); quad.setIndex([0, 1, 2, 0, 2, 3]);
    quad.setAttribute('aLance', lance); quad.instanceCount = MAX_BEAMS;
    this.corona = new THREE.Mesh(quad, new THREE.ShaderMaterial({ name: 'BeamCorona', defines: { MAX_BEAMS }, uniforms: { ...this.uniforms, ...veilUniforms(VEIL.corona) },
      vertexShader: CORONA_VERTEX, fragmentShader: CORONA_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false, ...additive }));
    this.tube.name = 'combat-beams'; this.corona.name = 'combat-beam-corona';
    for (const mesh of [this.tube, this.corona]) { mesh.frustumCulled = false; scene.add(mesh); }
    this.tube.renderOrder = 3; this.corona.renderOrder = 4;
  }

  /** Start a frame: every slot dark until drawn again. */
  begin(time: number) {
    this.used = 0; this.uniforms.uTime.value = time;
    for (const state of this.uniforms.uState.value as THREE.Vector4[]) state.w = 0;
  }

  /** One beam this frame. `life` is 0..1 through the beam's window; `radius`
   *  the tube's radius in metres; `impact` how hard the point of contact
   *  burns (0 for a beam ending in open air). Returns false when full. */
  draw(from: THREE.Vector3, to: THREE.Vector3, life: number, seed: number, radius: number, shell: number, edge: number, impact: number, glow = 1, intensity = 1) {
    if (this.used >= MAX_BEAMS) return false;
    const i = this.used++;
    (this.uniforms.uOrigin.value as THREE.Vector3[])[i].copy(from);
    (this.uniforms.uTarget.value as THREE.Vector3[])[i].copy(to);
    (this.uniforms.uState.value as THREE.Vector4[])[i].set(Math.max(.02, Math.min(.999, life)), seed % 1000, radius, 1);
    colour.setHex(shell); (this.uniforms.uShell.value as THREE.Vector3[])[i].set(colour.r, colour.g, colour.b);
    colour.setHex(edge); (this.uniforms.uEdge.value as THREE.Vector3[])[i].set(colour.r, colour.g, colour.b);
    (this.uniforms.uExtra.value as THREE.Vector4[])[i].set(impact, glow, intensity, 0);
    return true;
  }

  /** Where the drawn head of a beam is, given its life: the strike eases out
   *  over `uStrike` of the window, and the effects at the head follow it. */
  reach(life: number) { const x = Math.min(1, Math.max(0, life / (this.uniforms.uStrike.value as number))); return 1 - Math.pow(1 - x, 3); }

  get count() { return this.used; }
  clear() { for (const state of this.uniforms.uState.value as THREE.Vector4[]) state.w = 0; this.used = 0; }
  dispose() { for (const mesh of [this.tube, this.corona]) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); } }
}
