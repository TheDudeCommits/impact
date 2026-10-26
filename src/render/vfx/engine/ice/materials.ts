// The crystal shading is adapted from the VFX Armory (MIT; notices in ./LICENSE.upstream.txt): ability-project-27
// src/abilities/frostLance/FrostLanceMaterial.ts (itzmitto, from LinearAbilityExtThreeJS's ice by mohamedachrefelouafi)
// and hand-cast-abilities src/materials/ShardCrystalMaterial.js (mohamedachrefelouafi): thickness from the view angle,
// the deep tint, the fresnel rim, the screen-space key that lifts one facet and shades the next, rime at the foot and a
// milky tip, pinpoint glints, the birth flash and the soft ceiling on the glow. The floor's frost is adapted from
// ability-project-27 src/abilities/ice/FrostGroundEffect.ts (spread front, Voronoi cracks, radial branches, the ring at
// the front) and elemental-sandbox's sheet-ice plates and thaw (src/vfx/GroundField.js PLATE, BlackIceAbility.js); the
// mist from ability-project-27 src/abilities/ice/ColdMist.ts.
// Changes for the game: unlit ShaderMaterials instead of patched MeshStandardMaterials (no scene lights, so no program
// changes with the light pool), the donors' simplex noise replaced by the game's shared noise texture (one tap where
// they took eleven octaves), colours from instance attributes (several presets in one draw, no compiles), the victim
// veil and a near-lens fade, and every core bright in its own right for frames without bloom.
import * as THREE from 'three';
import { noiseTexture } from '../../noiseTexture';
import { VEIL_GLSL, veilUniforms } from '../../VictimVeil';
import { iceCellTexture } from './cells';

/** How much of a crystal gives way over a struck body (VictimVeil): most of it, so the fighter reads through. */
export const ICE_VEIL = .7;

const CRYSTAL_VERTEX = /* glsl */`
attribute vec4 iceTint;
attribute vec4 iceData;
attribute vec3 aBary;
attribute float aVariant;
varying vec4 vTint; varying vec4 vData; varying vec3 vBary; varying vec3 vLocal; varying vec3 vWorld; varying vec3 vN; varying vec3 vViewN;
void main(){
  // One buffer holds every shape; an instance draws its own (iceData.z) and the rest fall outside the clip volume.
  if (abs(aVariant - iceData.z) > .5) { gl_Position = vec4(0., 0., 2., 1.); return; }
  vTint = iceTint; vData = iceData; vBary = aBary; vLocal = position;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.);
  vWorld = world.xyz;
  vec3 s2 = vec3(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
  vec3 n = normalize(mat3(modelMatrix) * (mat3(instanceMatrix) * (normal / max(s2, vec3(1e-8)))));
  vN = n; vViewN = normalize(mat3(viewMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const CRYSTAL_FRAGMENT = /* glsl */`
uniform sampler2D uNoise; uniform float uTime; uniform float uVeilStrength;
varying vec4 vTint; varying vec4 vData; varying vec3 vBary; varying vec3 vLocal; varying vec3 vWorld; varying vec3 vN; varying vec3 vViewN;
${VEIL_GLSL}
void main(){
  float alpha = vTint.a;
  if (alpha < .003) discard;
  vec3 V = normalize(cameraPosition - vWorld), N = normalize(vN);
  float ndv = clamp(abs(dot(N, V)), 0., 1.);
  float rim = pow(1. - ndv, 2.4);
  float h = clamp(vLocal.y, 0., 1.);
  vec3 tint = vTint.rgb, frost = vec3(.88, .96, 1.);
  // Thick where you look down into it, light where you graze it.
  vec3 body = mix(tint, tint * vec3(.17, .32, .55), clamp(ndv * 1.15, 0., 1.));
  // A key in screen space, upper left: on every crystal, from every angle, one facet lit and the next in shade.
  float key = clamp(dot(normalize(vViewN), vec3(-.5604, .7336, .4278)), 0., 1.);
  body *= .45 + 1.1 * mix(ndv, key, .7);
  // Fracture planes in world space, so every crystal is cut from the same glacier.
  vec4 nz = texture2D(uNoise, vWorld.xz * .17 + vWorld.y * vec2(.11, .07) + vData.x * .37);
  float crack = smoothstep(.9, .985, 1. - abs(nz.b * 2. - 1.));
  body = mix(body, frost, crack * .55);
  // Rime where it left the floor, milk at the tip.
  float rime = (1. - smoothstep(0., .3, h)) * (.5 + .5 * nz.g);
  float tip = smoothstep(.6, 1., h) * (.55 + .45 * nz.r);
  body = mix(body, frost * .92, clamp(rime * .6 + tip * .55, 0., 1.));
  // A frozen body's shell (iceData.w): frosted and see-through.
  body = mix(body, mix(tint, frost, .6), vData.w * .45);
  // The cut edges.
  vec3 wv = fwidth(vBary) * 1.3, ev = smoothstep(vec3(0.), wv, vBary);
  float edge = 1. - min(min(ev.x, ev.y), ev.z);
  // Pinpoint glints, moving as the lens does.
  float g = texture2D(uNoise, vWorld.xz * .9 + vWorld.yy * .6 + V.xz * .35 + vData.x).a;
  float glint = pow(clamp(g * 1.8 - .8, 0., 1.), 5.) * (.4 + rim);
  vec3 glow = frost * (rim * 1.05 + edge * .5) + vec3(glint * 1.6) + mix(tint, frost, .5) * vData.y * .9;
  // The donors' soft ceiling: the terms all peak at grazing angles and stack.
  glow /= 1. + glow * .22;
  alpha *= clamp(.86 + .3 * rim + .25 * edge, 0., 1.);
  alpha *= mix(1., .74 + .26 * rim, vData.w);
  // Nothing in the lens's face, and thinned over a struck body (never the shell that is on it).
  alpha *= smoothstep(.9, 2.2, length(cameraPosition - vWorld));
  alpha *= mix(victimVeil(vWorld, uVeilStrength), 1., step(.5, vData.w));
  if (alpha < .02) discard;
  gl_FragColor = vec4(body + glow, alpha);
}`;

/** The crystals, the lance, the shell and every chip: one program. Per instance: `iceTint` (colour, alpha) and
 *  `iceData` (seed, birth flash 0..1, shape, shell 0/1). */
export function crystalMaterial(name: string) {
  return new THREE.ShaderMaterial({
    name, vertexShader: CRYSTAL_VERTEX, fragmentShader: CRYSTAL_FRAGMENT,
    uniforms: { uNoise: { value: noiseTexture() }, uTime: { value: 0 }, ...veilUniforms(ICE_VEIL) },
    // Near-opaque, so it writes depth: a field sorts itself, and what is behind a crystal stays behind it.
    transparent: true, depthWrite: true, side: THREE.FrontSide, toneMapped: false,
  });
}

const FLOOR_VERTEX = /* glsl */`
attribute vec4 iceTint;
attribute vec4 iceData;
varying vec2 vLocal; varying vec3 vWorld; varying vec4 vTint; varying vec4 vData; varying vec2 vHalf;
void main(){
  vLocal = position.xz; vTint = iceTint; vData = iceData;
  vHalf = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[2].xyz));
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FLOOR_FRAGMENT = /* glsl */`
uniform sampler2D uNoise; uniform sampler2D uCells; uniform float uTime;
varying vec2 vLocal; varying vec3 vWorld; varying vec4 vTint; varying vec4 vData; varying vec2 vHalf;
void main(){
  // iceData: x the front (metres from where it started), y the thaw 0..1, z the seed, w the shape (0 disc, 1 strip).
  float strip = step(.5, vData.w);
  vec2 m = vLocal * vHalf;
  float d = mix(length(m), m.y + vHalf.y, strip);
  float side = mix(vHalf.x - length(m), vHalf.x - abs(m.x), strip);
  // Out past the ragged edge or ahead of the front, before any texture is read: the quad's corners cost nothing.
  if (side < -1.1 || d > vData.x + .6) discard;
  // Lobes a few metres long (R, G) and the fringe on them (B), so its edges are never the quad's.
  vec4 nz = texture2D(uNoise, vWorld.xz * .09 + vData.z);
  float rag = (nz.g - .5) * 1.2 + (nz.b - .5) * .6;
  float front = vData.x - (nz.r - .5) * 1.1;
  float inside = (1. - smoothstep(front - .3, front, d)) * smoothstep(0., .7, side + rag);
  inside *= mix(1., smoothstep(0., .9, d + rag * .8 - .2), strip);
  if (inside < .004) discard;
  // Sheet ice in plates about 0.8 m across (ice/cells.ts: the seams, each plate's number, its bevel).
  vec4 cell = texture2D(uCells, vWorld.xz * .156 + vData.z * 3.7);
  float seam = 1. - smoothstep(.06, .2, cell.r);
  // The thaw takes it plate by plate, the way it froze in reverse.
  float thaw = vData.y, melt = smoothstep(cell.g * .85, cell.g * .85 + .15, thaw);
  // Cracks running out from where it started (a disc), or down its length (a strip).
  float ang = atan(m.y, m.x);
  float branch = smoothstep(.93, 1., .5 + .5 * sin(ang * 13. + d * 1.6 + nz.b * 2.6)) * (1. - strip) * (1. - smoothstep(0., vHalf.x, d));
  float lane = strip * smoothstep(.9, 1., .5 + .5 * sin(m.x * 7.5 + d * .6 + nz.b * 3.));
  float crust = (1. - smoothstep(0., .45, abs(d - front))) * (1. - thaw);
  vec3 tint = vTint.rgb;
  vec3 sheet = mix(tint, vec3(.9, .97, 1.), .55) * (.78 + .22 * nz.a) * (.88 + .24 * cell.b);
  vec3 col = mix(sheet, tint * vec3(.36, .58, .86), clamp(seam * .7 + branch * .75 + lane * .45, 0., 1.));
  col += vec3(.95, 1., 1.) * crust * .8;
  // Sparkle, finer than the plates, drifting a little.
  float glint = smoothstep(.62, 1., texture2D(uCells, vWorld.xz * .9 + vec2(uTime * .015, vData.z)).a);
  col += glint * 1.3 * (1. - thaw);
  float a = vTint.a * inside * (1. - melt) * clamp(.5 + .35 * seam + .3 * crust + .15 * branch, 0., 1.);
  gl_FragColor = vec4(col, a);
}`;

/** The frozen floor: a disc spreading from a point, or a strip down a projectile's path. */
export function floorMaterial(name: string) {
  return new THREE.ShaderMaterial({
    name, vertexShader: FLOOR_VERTEX, fragmentShader: FLOOR_FRAGMENT,
    uniforms: { uNoise: { value: noiseTexture() }, uCells: { value: iceCellTexture() }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
}

const MIST_VERTEX = /* glsl */`
attribute vec4 iceTint;
attribute vec4 iceData;
varying vec2 vUv; varying vec4 vTint; varying vec4 vData;
void main(){
  vUv = position.xy; vTint = iceTint; vData = iceData;
  vec4 centre = modelViewMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
  centre.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
  gl_Position = projectionMatrix * centre;
}`;

const MIST_FRAGMENT = /* glsl */`
uniform sampler2D uNoise; uniform float uTime;
varying vec2 vUv; varying vec4 vTint; varying vec4 vData;
void main(){
  float r = dot(vUv, vUv);
  if (r > 1.) discard;
  vec4 n = texture2D(uNoise, vUv * .32 + vData.x + vec2(uTime * .025, 0.));
  float cloud = smoothstep(.3, .8, n.g * .6 + n.b * .4);
  // Soft at the bottom, where the card meets the floor.
  float a = vTint.a * exp(-r * 2.4) * cloud * smoothstep(-1., -.25, vUv.y);
  if (a < .004) discard;
  gl_FragColor = vec4(vTint.rgb, a);
}`;

/** Cold mist rolling off the ice: soft cards facing the lens. */
export function mistMaterial(name: string) {
  return new THREE.ShaderMaterial({
    name, vertexShader: MIST_VERTEX, fragmentShader: MIST_FRAGMENT,
    uniforms: { uNoise: { value: noiseTexture() }, uTime: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
  });
}
