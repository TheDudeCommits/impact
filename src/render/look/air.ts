import * as THREE from 'three';
import type { AirLook, LookPreset } from './stageLooks';


const STAGE_AIR = new Float32Array(4);
const FIGHTER_AIR = new Float32Array(4);
const SHAPE = new Float32Array(4);
const SUN = new Float32Array([0, 1, 0, 8]);
const COLOR = new Float32Array(3);
const SUN_COLOR = new Float32Array(3);

export const airUniforms = {
  uAirFog: { value: STAGE_AIR },
  uAirShape: { value: SHAPE },
  uAirSun: { value: SUN },
  uAirColor: { value: COLOR },
  uAirSunColor: { value: SUN_COLOR },
};

const PARS_VERTEX = `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vAirRay;
#endif
`;
const VERTEX = `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	// The lens-to-point ray in world space (the view matrix's rotation, transposed): its length is the true
	// distance, its height the climb.
	vAirRay = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz;
#endif
`;
const PARS_FRAGMENT = `
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vAirRay;
	uniform vec4 uAirFog;
	uniform vec4 uAirShape;
	uniform vec4 uAirSun;
	uniform vec3 uAirColor;
	uniform vec3 uAirSunColor;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif
`;
export const AIR_FRAGMENT = `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	if ( uAirFog.x > 0.0 ) {
		float airDistance = length( vAirRay );
		float airDepth = uAirFog.z * max( airDistance - uAirFog.y, 0.0 );
		if ( uAirShape.y > 0.0 ) {
			// Thinner with height: the mean of exp(-h/H) between the lens's height and the point's.
			float airFrom = max( cameraPosition.y - uAirShape.x, 0.0 ) / uAirShape.y;
			float airTo = max( cameraPosition.y + vAirRay.y - uAirShape.x, 0.0 ) / uAirShape.y;
			airDepth *= abs( airTo - airFrom ) > 1e-3 ? ( exp( - airFrom ) - exp( - airTo ) ) / ( airTo - airFrom ) : exp( - airFrom );
		}
		float air = uAirFog.x * uAirFog.w * ( 1.0 - exp( - airDepth ) );
		vec3 airColor = uAirColor;
		if ( uAirShape.w > 0.0 ) airColor = mix( uAirColor, uAirSunColor, uAirShape.w * pow( max( dot( vAirRay, uAirSun.xyz ) / max( airDistance, 1e-4 ), 0.0 ), uAirSun.w ) );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( dot( gl_FragColor.rgb, vec3( .2126, .7152, .0722 ) ) ), air * uAirShape.z );
		gl_FragColor.rgb = mix( gl_FragColor.rgb, airColor, air );
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;

let installed = false;
export function installAir() {
  if (installed) return;
  installed = true;
  THREE.ShaderChunk.fog_pars_vertex = PARS_VERTEX;
  THREE.ShaderChunk.fog_vertex = VERTEX;
  THREE.ShaderChunk.fog_pars_fragment = PARS_FRAGMENT;
  THREE.ShaderChunk.fog_fragment = AIR_FRAGMENT;
  for (const [name, lib] of Object.entries(THREE.ShaderLib) as [string, { uniforms: Record<string, THREE.IUniform> }][]) {
    if (!lib.uniforms || !('fogColor' in lib.uniforms)) continue;
    Object.assign(lib.uniforms, airUniforms);
    if (name === 'toon') lib.uniforms.uAirFog = { value: FIGHTER_AIR };
  }
  Object.assign(THREE.UniformsLib.fog, airUniforms);
}
installAir();

let quality: 'high' | 'medium' | 'low' = 'high';
let current: LookPreset | undefined;
export function setAirQuality(next: 'high' | 'medium' | 'low') { quality = next; if (current) setAirLook(current); }

const scratch = new THREE.Color();
export function setAirLook(look: LookPreset) {
  current = look;
  const a = look.air;
  if (!a) { STAGE_AIR.fill(0); FIGHTER_AIR.fill(0); SHAPE.fill(0); return; }
  const density = Math.LN2 / Math.max(1, a.half);
  STAGE_AIR.set([1, a.start, density, a.most]);
  FIGHTER_AIR.set([a.fighters, a.start, density, a.most]);
  const shaped = quality !== 'low';
  SHAPE.set([a.base ?? 0, shaped && a.height ? a.height / Math.LN2 : 0, shaped ? a.desaturate ?? 0 : 0, shaped && a.sun ? a.sun.amount : 0]);
  const d = look.sky.sunDir ?? look.key.dir, l = Math.hypot(d[0], d[1], d[2]) || 1;
  SUN.set([d[0] / l, d[1] / l, d[2] / l, a.sun?.power ?? 6]);
  scratch.setHex(a.color ?? look.fog.color);
  COLOR.set([scratch.r, scratch.g, scratch.b]);
  scratch.setHex(a.sun?.color ?? a.color ?? look.fog.color);
  SUN_COLOR.set([scratch.r, scratch.g, scratch.b]);
}

export function airAt(air: AirLook, distance: number, fighter = false) {
  const depth = Math.LN2 / Math.max(1, air.half) * Math.max(distance - air.start, 0);
  return (fighter ? air.fighters : 1) * air.most * (1 - Math.exp(-depth));
}
