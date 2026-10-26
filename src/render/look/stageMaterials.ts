import * as THREE from 'three';
import type { StageId } from '../../game/stages';
import { addShaderPatch, replaceOnce } from './shaderPatch';
import { COOKIE_GLSL, cookieUniforms } from './lightCookie';
import type { LookPreset } from './stageLooks';

const BACKDROP = /(^|_)(sky|skybox|clouds?|background)(_|$)/i;

const HIDDEN: Partial<Record<StageId, RegExp>> = {
  'chunin-final': /^Material\.0(41|70|71|77|78|79|81|83|84|85|86)$/,
};
export function hiddenByLook(stage: StageId, materialName: string) {
  return HIDDEN[stage]?.test(materialName) ?? false;
}

export function lookStageMaterial(material: THREE.Material, stage: StageId, meshName: string, options: { doubleSided?: boolean; baked?: number } = {}): THREE.Material {
  const name = `${meshName} ${material.name}`;
  if (BACKDROP.test(material.name) || BACKDROP.test(meshName)) {
    const src = material as THREE.MeshBasicMaterial;
    const basic = material instanceof THREE.MeshBasicMaterial ? material : new THREE.MeshBasicMaterial({ name: material.name, map: src.map ?? null, color: src.color, transparent: material.transparent, opacity: material.opacity, alphaTest: material.alphaTest, side: material.side });
    basic.fog = false;
    basic.userData.lookBackdrop = true;
    if (basic !== material) material.dispose();
    return basic;
  }
  let lit = material as THREE.MeshStandardMaterial;
  if (material instanceof THREE.MeshBasicMaterial) {
    lit = new THREE.MeshStandardMaterial({
      name: material.name, map: material.map, color: material.color.clone().multiplyScalar(options.baked ?? .7),
      transparent: material.transparent, opacity: material.opacity, alphaTest: material.alphaTest, alphaHash: material.alphaHash,
      side: material.side, vertexColors: material.vertexColors, roughness: .92, metalness: 0,
    });
    material.dispose();
  }
  if (!(lit instanceof THREE.MeshStandardMaterial)) return material;
  lit.metalness = 0;
  lit.roughness = Math.max(.75, lit.roughness);
  if (options.doubleSided) lit.side = THREE.DoubleSide;
  for (const value of Object.values(lit)) if (value instanceof THREE.Texture) value.anisotropy = 8;
  installAlbedoGrade(lit);
  installStageLight(lit);
  if (stage === 'chunin-exam-room' && /Mesh5_/.test(name)) installWindowGlow(lit);
  return lit;
}

export const albedoUniforms = { uAlbedoSaturation: { value: 1 }, uAlbedoTint: { value: new THREE.Color(1, 1, 1) },
  uGroundTint: { value: new THREE.Color(1, 1, 1) }, uGroundGain: { value: 1 }, uGroundMax: { value: 1 }, uGroundAmount: { value: 0 } };
export const stageLightUniforms = { uStageKey: { value: 1 } };
const room = { tint: new THREE.Color(1, 1, 1), key: 1, dim: 0 };
export function gradeGround(rgb: readonly [number, number, number], ground: NonNullable<LookPreset['ground']>, roomAlbedo = 1): [number, number, number] {
  const tint = groundHue(ground.tint), gain = groundGain(ground, roomAlbedo);
  const c = rgb.map((v, i) => v * roomAlbedo * tint[i] * gain) as [number, number, number];
  const l = .2126 * c[0] + .7152 * c[1] + .0722 * c[2], s = groundShoulder(l, ground.max) / Math.max(l, 1e-5);
  return c.map((v, i) => { const graded = v * s, plain = rgb[i] * roomAlbedo; return plain + (graded - plain) * ground.amount; }) as [number, number, number];
}
export function groundHue(hex: number): [number, number, number] {
  const c = new THREE.Color(hex), l = .2126 * c.r + .7152 * c.g + .0722 * c.b;
  return [c.r / l, c.g / l, c.b / l];
}
export const groundGain = (ground: NonNullable<LookPreset['ground']>, roomAlbedo: number) => (ground.gain ?? 1) / Math.max(roomAlbedo, 1e-3);
export const GROUND_KNEE = .55;
export function groundShoulder(l: number, max: number) {
  const knee = max * GROUND_KNEE, span = max - knee;
  return l <= knee ? l : knee + span * (1 - Math.exp((knee - l) / span));
}
export function setAlbedoLook(look: LookPreset) {
  albedoUniforms.uAlbedoSaturation.value = look.albedo?.saturation ?? 1;
  room.tint.setHex(look.albedo?.tint ?? 0xffffff).multiplyScalar(look.room?.albedo ?? 1);
  room.key = look.room?.key ?? 1;
  setRoomDim(room.dim);
  const ground = look.ground;
  albedoUniforms.uGroundTint.value.setRGB(...(ground ? groundHue(ground.tint) : [1, 1, 1] as [number, number, number]), THREE.LinearSRGBColorSpace);
  albedoUniforms.uGroundGain.value = ground ? groundGain(ground, look.room?.albedo ?? 1) : 1;
  albedoUniforms.uGroundMax.value = ground?.max ?? 1;
  albedoUniforms.uGroundAmount.value = ground?.amount ?? 0;
}
export function setRoomDim(k: number) {
  room.dim = k;
  albedoUniforms.uAlbedoTint.value.copy(room.tint).multiplyScalar(1 - .62 * k);
  stageLightUniforms.uStageKey.value = room.key * (1 - .75 * k);
}
function installAlbedoGrade(material: THREE.MeshStandardMaterial) {
  addShaderPatch(material, 'look-albedo-v3', shader => {
    Object.assign(shader.uniforms, albedoUniforms);
    shader.fragmentShader = 'uniform float uAlbedoSaturation;\nuniform vec3 uAlbedoTint;\nuniform vec3 uGroundTint;\nuniform float uGroundGain;\nuniform float uGroundMax;\nuniform float uGroundAmount;\n' + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <map_fragment>', `#include <map_fragment>
	diffuseColor.rgb = max( mix( vec3( dot( diffuseColor.rgb, vec3( .2126, .7152, .0722 ) ) ), diffuseColor.rgb, uAlbedoSaturation ), 0. ) * uAlbedoTint;
	#ifndef FLAT_SHADED
	// The floor, graded once (the floors round, 25 October 2026; the owner: "Go ahead with all three"). Up-facing
	// surfaces take the room's albedo back (uGroundGain) and the floor's own exposure instead, a hue that keeps their
	// luminance, and a shoulder in place of the old clamp: pale stone stays above mid stone and eases toward the
	// ceiling, so it reads pale without going paper-white (gradeGround is this, on the CPU).
	if ( uGroundAmount > 0.0 ) {
		float lookUp = smoothstep( .55, .85, dot( normalize( vNormal ), normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz ) ) );
		vec3 lookGround = diffuseColor.rgb * uGroundTint * uGroundGain;
		float lookGroundL = dot( lookGround, vec3( .2126, .7152, .0722 ) );
		float lookKnee = uGroundMax * ${GROUND_KNEE.toFixed(3)}, lookSpan = uGroundMax - lookKnee;
		float lookShoulder = lookGroundL <= lookKnee ? lookGroundL : lookKnee + lookSpan * ( 1. - exp( ( lookKnee - lookGroundL ) / lookSpan ) );
		lookGround *= lookShoulder / max( lookGroundL, 1e-5 );
		diffuseColor.rgb = mix( diffuseColor.rgb, lookGround, lookUp * uGroundAmount );
	}
	#endif`, 'albedo grade');
  });
}

function installStageLight(material: THREE.MeshStandardMaterial) {
  addShaderPatch(material, 'look-stage-light-v1', shader => {
    Object.assign(shader.uniforms, cookieUniforms, stageLightUniforms);
    shader.vertexShader = 'varying vec3 vLookWorld;\n' + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', 'vLookWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\n#include <project_vertex>', 'cookie world position');
    shader.fragmentShader = 'varying vec3 vLookWorld;\nuniform float uStageKey;\n' + COOKIE_GLSL + '\n' + shader.fragmentShader;
    const lights = replaceOnce(THREE.ShaderChunk.lights_fragment_begin, 'getDirectionalLightInfo( directionalLight, directLight );',
      'getDirectionalLightInfo( directionalLight, directLight );\n\t\tif ( UNROLLED_LOOP_INDEX == 0 ) directLight.color *= uStageKey * lookCookie( vLookWorld );', 'stage key light');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <lights_fragment_begin>', lights, 'cookie lights');
  });
}

export const windowGlow = { uPaneGlow: { value: new THREE.Color(0, 0, 0) } };
function installWindowGlow(material: THREE.MeshStandardMaterial) {
  addShaderPatch(material, 'look-window-glow-v1', shader => {
    Object.assign(shader.uniforms, windowGlow);
    shader.fragmentShader = 'uniform vec3 uPaneGlow;\n' + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <map_fragment>', `#include <map_fragment>
	float lookPane = smoothstep( .015, .06, diffuseColor.b - diffuseColor.r ) * smoothstep( .16, .32, dot( diffuseColor.rgb, vec3( .2126, .7152, .0722 ) ) );`, 'window pane mask');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	vec2 lookLight = fract( vec2( vLookWorld.x / .55, vLookWorld.y / .66 ) );
	float lookMuntin = step( .1, lookLight.x ) * step( .1, lookLight.y );
	// The sky through them: a pale blue toward each window's top, the sun's warm glow toward its foot (the panes
	// read as blank white, "no sky").
	float lookSkyUp = smoothstep( 2.6, 6.0, vLookWorld.y );
	vec3 lookSky = mix( vec3( 1.0, .86, .64 ), vec3( .46, .62, .96 ), lookSkyUp );
	// And the Forest of Death's canopy along their feet, dark against the glow.
	float lookCanopy = smoothstep( .0, .06, 3.15 + .22 * sin( vLookWorld.x * 2.3 ) + .14 * sin( vLookWorld.x * 5.7 + 1.3 ) - vLookWorld.y );
	lookSky = mix( lookSky, vec3( .1, .17, .13 ), lookCanopy * .85 );
	totalEmissiveRadiance += lookSky * dot( uPaneGlow, vec3( .2126, .7152, .0722 ) ) * smoothstep( .3, .65, lookPane ) * lookMuntin;`, 'window panes');
  });
}
