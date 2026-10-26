import * as THREE from 'three';
import { GRUNTS } from '../../survival/horde/kinds';
import { GS, GF, DEATH, GORE, AFFIX_SHIFT } from '../../survival/horde/Horde';
import { ICHOR } from './Gore';
import { MODEL_LOOKS, loadModelLook, type ModelLook } from './modelLooks';
import { loadPropModels } from '../rift/propModels';
import { HORDE_DOTS } from '../../ui/survival/minimap';
import { Telegraphs, Shape } from './Telegraphs';
import { Flames } from './Flames';
import type { HordeFrame, HordeFrames } from '../../survival/horde/frame';
import { BONE, MotionLibrary, type ClipSample, type MotionClip } from './motion';
import { buildLook } from './looks';
import { sculptLook } from './fleshLooks';
import { activeRift } from '../rift/RiftStage';
const FAR_CELL = .06;
import { GROUP } from './kit';
import { applyInkShell, applyToonShading, frameUniforms } from '../look/toonShading';
import { INK_ON, INK_PARS, INK_SHIFT_PARS, inkUniforms } from '../rift/ink';
import { applyInstancedThreatInk, type ThreatInk } from '../ThreatOutline';
import { addShaderPatch, replaceOnce } from '../look/shaderPatch';
import { uploadInstances } from './instanceUploads';
import { crowdCoverage,riftCrowdCoverage } from './crowdCoverage';
import {RIFT_TROOP_MODELS} from '../moba/troopAssets';
import {RIFT_TROOP_HEIGHTS} from '../../game/moba/armyIdentity';

const PER_KIND = 220;
const GIBS = 72;
const BRUTES = new Set(['pacifista', 'gifter-brute', 'menos', 'apostle-spawn', 'gamorrean']);
const CROSSFADE = .12;
export interface CrowdPose {clip?:string;progress?:number;key?:string;visibility:number}
const GAIT: Record<string, { metres: number; min: number; max: number }> = {
  walk: { metres: 1.5, min: 0, max: 99 }, run: { metres: 5.2, min: 0, max: 99 },
  'walk-monster': { metres: 3.4, min: .7, max: 1.7 }, 'walk-unsteady': { metres: 2.5, min: .7, max: 1.7 }, 'walk-orc': { metres: 1.9, min: .7, max: 1.9 },
  'run-charge': { metres: 5.3, min: .6, max: 1.5 }, 'run-sprint': { metres: 4.1, min: .6, max: 1.5 },
};
const SOLDIER = { walks: ['walk', 'walk', 'walk-unsteady'], runs: ['run', 'run-charge', 'run-sprint'] };
const MONSTER = { walks: ['walk-monster', 'walk-unsteady', 'walk'], runs: ['run-sprint', 'run-charge', 'run'] };
const BRUTE = { walks: ['walk-orc', 'walk-monster'], runs: ['run-charge', 'run'] };
const GAITS: Record<string, { walks: string[]; runs: string[] }> = {
  marine: SOLDIER, 'marine-rifle': SOLDIER, 'beast-pirate': SOLDIER, 'chess-soldier': SOLDIER, 'frieza-soldier': SOLDIER, 'skiff-guard': SOLDIER,
  'rogue-ninja': { walks: ['walk', 'walk-unsteady'], runs: ['run-sprint', 'run-sprint', 'run'] },
  hollow: MONSTER, 'hollow-cero': MONSTER, saibaman: MONSTER, 'cell-jr': MONSTER, 'white-zetsu': MONSTER, husk: MONSTER,
  pacifista: BRUTE, 'gifter-brute': BRUTE, menos: BRUTE, 'apostle-spawn': BRUTE, gamorrean: BRUTE,
};

interface Tier {
  restHeight:number;
  body: THREE.InstancedMesh; ink: THREE.InstancedMesh;
  poseA: THREE.InstancedBufferAttribute; poseB: THREE.InstancedBufferAttribute;
  look: THREE.InstancedBufferAttribute; fx: THREE.InstancedBufferAttribute;
  threat: THREE.InstancedBufferAttribute; threatWiden: THREE.InstancedBufferAttribute;
  count: number;
}
interface KindMesh {
  kind: number;
  height?:number;
  near: Tier; far?: Tier;
  scale: number;
  modelled?: boolean;
}
const LOD_FAR = 15;
const LOD_MODEL = typeof location === 'object' && new URLSearchParams(location.search).has('lodfar') ? Number(new URLSearchParams(location.search).get('lodfar')) : 10;

interface Body {
  serial: number; kind: number;
  clip: MotionClip; time: number; loop: boolean;
  from?: MotionClip; fromTime: number; fromLoop: boolean; fadeAt: number;
  key: string;
  stride: number; lastX: number; lastZ: number; speed: number;
  walk: string; run: string; pace: number;
  seen: number;
  gored: boolean;
  tumble: number; tumbleAxis: number;
  far: boolean;
  corpse?: { m: THREE.Matrix4; rowA: number; rowB: number; frac: number; hide: number; variant: number };
}

interface Fallen { kind: number; m: THREE.Matrix4; rowA: number; rowB: number; frac: number; hide: number; variant: number; born: number; crumble: number }
const FALLEN_MAX = 70, FALLEN_LIFE = 45, CRUMBLE = 1.4;

interface Gib {
  alive: boolean; kind: number; group: number;
  hide: number;
  rowA: number; rowB: number; frac: number;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  q: THREE.Quaternion; spin: THREE.Vector3; pivot: THREE.Vector3; scale: number; born: number; life: number; variant: number;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const _e = new THREE.Euler(), _sphere = new THREE.Sphere(), _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _t = new THREE.Matrix4();
const _coverView = new THREE.Matrix4(), _coverPoint = new THREE.Vector3();
const _sample: ClipSample = { row: 0, next: 0, frac: 0 }, _from: ClipSample = { row: 0, next: 0, frac: 0 };
const UP = new THREE.Vector3(0, 1, 0);

const PART_BONE: Record<number, string> = { [GROUP.HEAD]: 'Head', [GROUP.ARM_L]: 'LeftForeArm', [GROUP.ARM_R]: 'RightForeArm', [GROUP.UPPER]: 'Spine01' };

const SKIN_PARS = `
// Bone, second bone, the first's weight, and the part (see kit.ts GROUP): one
// vec4, since WebGL has sixteen attribute slots and the instance matrix takes four.
attribute vec4 aSkin;
attribute float aGlow;
// Baked wear (flesh.ts): blood-splash order, grain, mud.
attribute vec3 aWear;
varying vec3 vHordeWear;
attribute vec4 aPoseA;
attribute vec4 aPoseB;
attribute vec4 aLook;
attribute vec4 aFx;
uniform sampler2D uMotion;
uniform vec3 uPivots[ 5 ];
uniform float uPivotBones[ 5 ];
varying vec3 vHordeLocal;
varying float vHordeFlash;
varying float vHordeDissolve;
varying float vHordeGlow;
varying vec4 vHordeFx;
varying float vHordeVariant;
varying float vHordeWound;
mat4 hordeBone( float row, int bone ) {
	int r = int( row + .5 );
	vec4 a = texelFetch( uMotion, ivec2( bone * 3, r ), 0 );
	vec4 b = texelFetch( uMotion, ivec2( bone * 3 + 1, r ), 0 );
	vec4 c = texelFetch( uMotion, ivec2( bone * 3 + 2, r ), 0 );
	return mat4( a.x, b.x, c.x, 0., a.y, b.y, c.y, 0., a.z, b.z, c.z, 0., a.w, b.w, c.w, 1. );
}
// One bone's pose: between two frames of the clip, and faded from the last clip.
mat4 hordePosed( int bone ) {
	mat4 m = hordeBone( aPoseA.x, bone ) * ( 1. - aPoseA.z ) + hordeBone( aPoseA.y, bone ) * aPoseA.z;
	if ( aPoseA.w < .999 ) {
		mat4 p = hordeBone( aPoseB.x, bone ) * ( 1. - aPoseB.z ) + hordeBone( aPoseB.y, bone ) * aPoseB.z;
		m = p * ( 1. - aPoseA.w ) + m * aPoseA.w;
	}
	return m;
}
// A sculpted body's vertex follows two bones where it bridges a joint (flesh.ts).
mat4 hordeSkin() {
	mat4 m = hordePosed( int( aSkin.x + .5 ) );
	if ( aSkin.z < .999 ) m = m * aSkin.z + hordePosed( int( aSkin.y + .5 ) ) * ( 1. - aSkin.z );
	return m;
}
bool hordeHidden() { int hide = int( aLook.z + .5 ), group = int( aSkin.w + .5 ); return ( ( hide >> group ) & 1 ) == 1; }
// Where a part that is gone closes up: a stump on its own hinge, or - on a
// severed part flying alone - everything else closes on that part's hinge.
// Every vertex of it lands on the one point, carried by the hinge's bone.
int hordeStump() {
	int shown = ( ~int( aLook.z + .5 ) ) & 31, g = int( aSkin.w + .5 );
	if ( shown != 0 && ( shown & ( shown - 1 ) ) == 0 ) for ( int i = 0; i < 5; i ++ ) if ( shown == ( 1 << i ) ) g = i;
	// (Gear broken off closes onto the arm that carried it.)
	return g > 4 ? 2 : g;
}
`;
const SKIN_MAIN = 'void main() {\n\tbool hordeGone = hordeHidden();\n\tint hordeCut = hordeGone ? hordeStump() : 0;\n\tmat4 hordeM = hordeGone ? hordePosed( int( uPivotBones[ hordeCut ] + .5 ) ) : hordeSkin();';
const SKIN_NORMAL = '#include <beginnormal_vertex>\n\tobjectNormal = mat3( hordeM ) * objectNormal;';
const SKIN_VERTEX = `#include <begin_vertex>
	vHordeLocal = position;
	transformed = ( hordeM * vec4( hordeGone ? uPivots[ hordeCut ] : transformed, 1. ) ).xyz;
	vHordeFlash = aLook.x; vHordeDissolve = aLook.y; vHordeVariant = fract( aLook.w ); vHordeWound = floor( aLook.w ) / 8.; vHordeFx = aFx; vHordeWear = aWear;
	vHordeGlow = aGlow * ( .55 + aFx.x * 2.2 );`;
const COVER_PARS = 'uniform vec3 uFocusView;\nvarying float vHordeScreen;\n';
const COVER_MAIN = `
	vHordeScreen = aPoseB.w;
	// Every fragment of this instance was already discarded by the cutaway.
	// Clip it before texture-based skinning; depth/shadow programs do not use this.
	if ( vHordeScreen >= 1.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; } // cutaway-cull
`;
const DISSOLVE = `
	// BEGIN_CROWD_COVERAGE
	// Nothing of the horde stands in the lens: a body within a couple of metres
	// of the camera is screened out on a dither, so a cinematic's orbit through
	// the crowd, or a wall of them at the fighter's back, never fills the frame.
	float hordeNear = smoothstep( mix(2.2,.65,uRiftCrowd), mix(2.9,1.15,uRiftCrowd), length( vViewPosition ) );
	// Nor in the line of sight to the fighter the camera follows: a body
	// between the lens and them is screened down to a ghost of itself, so a
	// crowd at their back never hides them. uFocusView is their chest in view
	// space (the lens itself when there is nobody to keep in sight).
	vec3 hordeP = -vViewPosition;
	float hordeT = clamp( dot( hordeP, uFocusView ) / max( dot( uFocusView, uFocusView ), 1e-3 ), 0.0, 1.0 );
	float hordeLine = length( hordeP - uFocusView * hordeT );
	// Only what truly covers them - and that cleanly gone, not thinned: a body
	// thinned to a dithered ghost over the fighter read as a dot-pattern
	// silhouette hiding them; a narrow dithered edge is all that is left of it.
	float hordeHide = ( 1.0 - smoothstep( .62, .8, hordeLine ) ) * ( 1.0 - smoothstep( .8, .86, hordeT ) ) * mix(1.,.45,uRiftCrowd);
	hordeNear = min( hordeNear, 1.0 - max( hordeHide, vHordeScreen ) );
	if ( hordeNear < 1.0 && fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( .06711056, .00583715 ) ) ) ) > hordeNear ) discard;
	// Smooth noise, so a body burns away along ragged edges rather than in
	// cubes (a voxel dissolve read as a rendering fault).
	// (Only a body arriving or leaving pays for the noise.)
	float hordeBurn = 0.0;
	if ( vHordeDissolve > .001 ) {
		float hordeEaten = hordeVnoise( vHordeLocal * 9.0 ) * .6 + hordeVnoise( vHordeLocal * 23.0 + 5.7 ) * .4;
		if ( hordeEaten < vHordeDissolve ) discard;
		hordeBurn = 1.0 - smoothstep( 0.0, .06, hordeEaten - vHordeDissolve );
	}
	// END_CROWD_COVERAGE
`;
export const FOCUS = { value: new THREE.Vector3(0, 0, 0) };
const HORDE_TIME = { value: 0 };
const RIFT_CROWD={value:0};
const PIVOTS = { value: Array.from({ length: 5 }, () => new THREE.Vector3()) };
const REST = { value: 1.8 };
const PIVOT_BONES = { value: [BONE.Spine01, BONE.Head, BONE.LeftArm, BONE.RightArm, BONE.Spine01] };
const QA = typeof location === 'object' ? new URLSearchParams(location.search) : new URLSearchParams();
export const HORDE_LOOKS = { sculpted: !QA.has('kitlooks'), grime: !QA.has('nogrime'), models: !QA.has('nomodels') };
const FRAG_PARS = `uniform vec3 uFocusView;
uniform float uRiftCrowd;
uniform vec3 uIchor;
uniform float uHordeTime;
// Smooth 3-D value noise: fire and ice drawn on a body without bands or blocks.
float hordeHash( vec3 p ) { p = fract( p * .3183099 + .1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float hordeVnoise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( hordeHash( i ), hordeHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( hordeHash( i + vec3( 0, 1, 0 ) ), hordeHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
		mix( mix( hordeHash( i + vec3( 0, 0, 1 ) ), hordeHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( hordeHash( i + vec3( 0, 1, 1 ) ), hordeHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
varying vec3 vHordeLocal;
varying float vHordeFlash;
varying float vHordeDissolve;
varying float vHordeGlow;
varying vec4 vHordeFx;
varying float vHordeVariant;
varying float vHordeWound;
varying vec3 vHordeWear;
varying float vHordeScreen;
// Where its own insides have splashed it (the inked page draws that in colour).
float hordeBlood = 0.0;
// An elite's colour by its affix (vHordeFx.y is 1 + the affix): gold, a
// molten orange, a storm's blue-white, frost's cyan, a hasted yellow-green.
vec3 hordeEliteTint( float fx ) {
	float a = fx - 1.0;
	return a < .5 ? vec3( 1.0, .72, .2 ) : a < 1.5 ? vec3( 1.0, .34, .06 ) : a < 2.5 ? vec3( .5, .72, 1.3 ) : a < 3.5 ? vec3( .4, 1.0, 1.25 ) : vec3( .85, 1.0, .3 );
}
`;

const HORDE_INK = `
	{
		vec3 inkGlow = max( totalEmissiveRadiance - diffuseColor.rgb * .09, 0.0 );
		float inkAway = smoothstep( 20.0, 55.0, vViewPosition.z );
		float inkBody = min( inkTone( .22 + .58 * toonLit, diffuseColor.rgb, .7 ), uInkCrowd );
		// A blow lands: the body goes to ink for a moment (a pale flash is lost on the page).
		inkBody *= 1.0 - vHordeFlash * .75;
		outgoingLight = inkPage( inkBody, diffuseColor.rgb, 0.0, inkAway );
		#ifdef HORDE_GRIME
		// Blood in its own colour: dark and dried, not paint.
		outgoingLight = mix( outgoingLight, uIchor * uInkPaper * ( .28 + .22 * toonLit ), hordeBlood * .75 );
		#endif
		outgoingLight += inkGlow;
	}`;
function patchBody(material: THREE.MeshToonMaterial, motion: THREE.DataTexture, ichor: THREE.Color, inkMix: {value:number}) {
  addShaderPatch(material, INK_ON ? 'horde-body-v36-ink4' : 'horde-body-v35', shader => {
    if (INK_ON) { Object.assign(shader.uniforms, inkUniforms); shader.uniforms.uHordeInkMix = inkMix; }
    shader.uniforms.uMotion = { value: motion }; shader.uniforms.uRiftCrowd=RIFT_CROWD; shader.uniforms.uFocusView = FOCUS; shader.uniforms.uPivots = PIVOTS; shader.uniforms.uPivotBones = PIVOT_BONES; shader.uniforms.uHordeTime = HORDE_TIME; shader.uniforms.uHordeRest = REST;
    shader.vertexShader = (INK_ON ? INK_SHIFT_PARS : '') + COVER_PARS + SKIN_PARS + shader.vertexShader;
    if (INK_ON) shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', '#include <project_vertex>\n\tvInkShift = inkShift();', 'horde ink shift');
    shader.vertexShader = replaceOnce(shader.vertexShader, 'void main() {', SKIN_MAIN.replace('void main() {', `void main() {${COVER_MAIN}`), 'horde skin main');
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <beginnormal_vertex>', SKIN_NORMAL, 'horde skin normal');
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', SKIN_VERTEX, 'horde skin');
    shader.vertexShader = 'uniform vec3 uIchor;\n' + replaceOnce(shader.vertexShader, '#include <color_vertex>', '#include <color_vertex>\n\tif ( hordeHidden() ) vColor.rgb = uIchor * 1.6;', 'horde stump');
    shader.fragmentShader = (INK_ON ? 'uniform float uHordeInkMix;\n' + INK_PARS : '') + FRAG_PARS + shader.fragmentShader;
    shader.uniforms.uLookTechRaw = frameUniforms.uLookTech;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, 'uniform float uLookTech;', 'uniform float uLookTechRaw;\n#define uLookTech ( uLookTechRaw * .3 )', 'horde technique rim');
    shader.uniforms.uToonFloorRaw = shader.uniforms.uToonFloor;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, 'uniform vec3 uToonFloor;', 'uniform vec3 uToonFloorRaw;\n#define uToonFloor ( uToonFloorRaw * .2 )', 'horde toon floor');
    shader.uniforms.uToonFillFloorRaw = shader.uniforms.uToonFillFloor;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, 'uniform float uToonFillFloor;', 'uniform float uToonFillFloorRaw;\n#define uToonFillFloor ( uToonFillFloorRaw * .35 )', 'horde fill floor');
    shader.uniforms.uIchor = { value: ichor };
    if (HORDE_LOOKS.grime) shader.defines = { ...shader.defines, HORDE_GRIME: '' };
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <map_fragment>', `#ifdef USE_MAP
	// (Sampled everywhere, chosen after: a sample in a branch loses its mip level at the seams.)
	vec4 hordeTexel = texture2D( map, vMapUv );
	if ( vMapUv.x > -1.0 ) diffuseColor *= hordeTexel;
#endif`, 'horde model map');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <color_fragment>', `#include <color_fragment>
	diffuseColor.rgb *= .86 + .28 * fract( vHordeVariant * 7.13 );
	#ifdef HORDE_GRIME
	// Worn and filthy: a grain through whatever it wears, the rift's mud
	// climbing from the feet, and the splashes of what it has been through -
	// its own insides, more of them the more it has been cut. All baked per
	// vertex (flesh.ts), so it costs the fragment nothing but a mix.
	{
		float grain = vHordeWear.y, mud = vHordeWear.z;
		diffuseColor.rgb *= ( .84 + .3 * grain ) * ( 1.0 - mud * .42 );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( .09, .07, .06 ), mud * .22 );
		float splash = fract( vHordeWear.x + vHordeVariant * .37 );
		// (Splashes, dark and dried at the edges - not the whole body: a cut-up
		// crowd went bright red all over, "fake" mannequins in red paint.)
		float soaked = clamp( vHordeWound * 1.2 + step( .8, fract( vHordeVariant * 3.7 ) ) * .15, 0.0, 1.0 );
		float blood = smoothstep( .8 - soaked * .12, .84 - soaked * .12, splash ) * step( .01, soaked );
		diffuseColor.rgb = mix( diffuseColor.rgb, uIchor * ( .38 + .3 * grain ), blood * .85 );
		hordeBlood = blood * .85;
	}
	#endif
	// Stopped time drains a body grey (w 1); frost turns it to deep, mottled
	// ice (w 2); fire chars it (z), the flames drawn on as light below.
	float hordeFrost = step( 1.5, vHordeFx.w );
	diffuseColor.rgb = mix( diffuseColor.rgb, vec3( dot( diffuseColor.rgb, vec3( .3, .59, .11 ) ) ) * vec3( .7, .8, 1.0 ), min( vHordeFx.w, 1.0 ) * .8 * ( 1.0 - hordeFrost ) );
	// Ice over the body, not instead of it: its clothes and face still read
	// under a dark steel-blue glaze, crusted white with hoarfrost in patches
	// (a smooth pale glaze read as a placeholder doll, with no ice on it).
	if ( hordeFrost > .5 ) {
		// A steel-blue glaze, and frost laid over it in soft drifts - no flecks:
		// a crust in patches read as camouflage, and in fine flecks as blue pixels.
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( .16, .28, .42 ), .5 );
		float hordeDrift = smoothstep( .35, .78, hordeVnoise( vHordeLocal * 3.2 + 7.3 ) );
		diffuseColor.rgb = mix( diffuseColor.rgb, vec3( .58, .74, .92 ), hordeDrift * .45 );
	}
	diffuseColor.rgb *= 1.0 - vHordeFx.z * .86;`, 'horde variety');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	totalEmissiveRadiance += vColor.rgb * vHordeGlow * 2.4;
	#ifdef USE_MAP
	// A generated model's eyes are painted: its brightest, purest reds burn,
	// flaring on a wind-up as a sculpted grunt's do.
	{
		float hordeRed = smoothstep( .16, .34, diffuseColor.r - max( diffuseColor.g, diffuseColor.b ) ) * smoothstep( .35, .6, diffuseColor.r );
		totalEmissiveRadiance += vec3( 1.0, .12, .05 ) * hordeRed * ( 1.4 + max( vHordeFx.x, 0.0 ) * 3.0 ) * step( -.1, vHordeFx.x );
	}
	#endif
	// A little of its own colour always shows: in the Rift's darkest places a
	// crowd was black cut-outs with a rim, its costumes unreadable.
	totalEmissiveRadiance += diffuseColor.rgb * .09;
	// Burning: the body charred dark, lit from its edges by a flickering
	// orange and embers glowing through the char; the flames themselves
	// rise off it as cards (Flames.ts). The rim stays under the bloom's
	// threshold: on a body this thin a blooming edge floods it orange.
	if ( vHordeFx.z > .01 ) {
		float edge = pow( 1.0 - abs( dot( normal, normalize( vViewPosition ) ) ), 2.0 );
		float flick = .6 + .4 * hordeVnoise( vec3( vHordeLocal.y * 3.0, uHordeTime * 7.0, vHordeVariant * 40.0 ) );
		float ember = smoothstep( .76, .82, hordeVnoise( vHordeLocal * 26.0 + vec3( 2.3, uHordeTime * .6, 0.0 ) ) );
		totalEmissiveRadiance += ( vec3( .85, .17, .02 ) * edge * flick + vec3( .8, .14, .02 ) * ember * .4 ) * vHordeFx.z;
	}
	// Ice: veins of light wandering through it (isolines of noise, not
	// ruled lines) and a cold rim where it turns from the eye.
	if ( step( 1.5, vHordeFx.w ) > .5 ) {
		float vein = 1.0 - smoothstep( .0, .025, abs( hordeVnoise( vHordeLocal * 5.0 + 3.1 ) - .5 ) );
		float rim = pow( 1.0 - abs( dot( normal, normalize( vViewPosition ) ) ), 3.0 );
		// Glints: a few points of the ice catching the light, twinkling - round
		// and rare (whole cells lit read as a pattern of pale squares).
		vec3 hordeCell = vHordeLocal * 42.0;
		float glint = step( .988, hordeHash( floor( hordeCell ) + floor( uHordeTime * 3.0 ) * .37 ) ) * ( 1.0 - smoothstep( .12, .24, length( fract( hordeCell ) - .5 ) ) );
		// (A cold light of its own, so ice stays ice under a red sky.)
		totalEmissiveRadiance += vec3( .3, .7, 1.25 ) * ( .13 + .3 * vein + .26 * rim ) + vec3( .9, .95, 1.0 ) * glint * .8;
	}`, 'horde glow');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', `${DISSOLVE}${INK_ON ? `if (uHordeInkMix > .5) ${HORDE_INK}` : ''}
	// A hit brightens the body for a moment and keeps its shading: a crowd
	// struck by arts all at once must not turn into white cut-outs.
	outgoingLight = mix( outgoingLight, outgoingLight * 1.45 + vec3( .3, .26, .22 ), vHordeFlash * .8 * ${INK_ON ? '(1.0 - uHordeInkMix)' : '1.0'} );
	outgoingLight = mix( outgoingLight, vec3( 2.6, .6, .12 ) * 1.6, hordeBurn );
	outgoingLight += hordeEliteTint( vHordeFx.y ) * step( .5, vHordeFx.y ) * .18;
#include <opaque_fragment>`, 'horde flash and dissolve');
  });
}
function patchInk(material: THREE.MeshToonMaterial, motion: THREE.DataTexture) {
  addShaderPatch(material, 'horde-ink-v14', shader => {
    shader.uniforms.uMotion = { value: motion }; shader.uniforms.uRiftCrowd=RIFT_CROWD; shader.uniforms.uFocusView = FOCUS; shader.uniforms.uPivots = PIVOTS; shader.uniforms.uPivotBones = PIVOT_BONES; shader.uniforms.uHordeRest = REST;
    shader.vertexShader = COVER_PARS + SKIN_PARS + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, 'void main() {', SKIN_MAIN.replace('void main() {', `void main() {${COVER_MAIN}`), 'horde ink main');
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <beginnormal_vertex>', SKIN_NORMAL, 'horde ink normal');
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', SKIN_VERTEX, 'horde ink skin');
    shader.fragmentShader = FRAG_PARS + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', `${DISSOLVE}
	outgoingLight = mix( outgoingLight, hordeEliteTint( vHordeFx.y ) * 1.6, step( .5, vHordeFx.y ) * .85 );
#include <opaque_fragment>`, 'horde ink dissolve');
  });
}
function patchDepth(material: THREE.MeshDepthMaterial, motion: THREE.DataTexture) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uMotion = { value: motion }; shader.uniforms.uPivots = PIVOTS; shader.uniforms.uPivotBones = PIVOT_BONES;
    shader.vertexShader = SKIN_PARS + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, 'void main() {', SKIN_MAIN, 'horde depth main');
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', SKIN_VERTEX, 'horde depth skin');
  };
  material.customProgramCacheKey = () => 'horde-depth-v3';
}

function shareVertices(geometry: THREE.BufferGeometry, index: THREE.BufferAttribute) {
  const shared = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) shared.setAttribute(name, attribute);
  shared.setIndex(index);
  shared.boundingSphere = geometry.boundingSphere?.clone() ?? null;
  return shared;
}

function packSkin(geometry: THREE.BufferGeometry) {
  const bone = geometry.getAttribute('aBone'), bone2 = geometry.getAttribute('aBone2'), weight = geometry.getAttribute('aBoneW'), group = geometry.getAttribute('aGroup');
  const skin = new Float32Array(bone.count * 4);
  for (let i = 0; i < bone.count; i++) {
    skin[i * 4] = bone.getX(i); skin[i * 4 + 1] = bone2 ? bone2.getX(i) : bone.getX(i);
    skin[i * 4 + 2] = weight ? weight.getX(i) : 1; skin[i * 4 + 3] = group.getX(i);
  }
  geometry.setAttribute('aSkin', new THREE.Float32BufferAttribute(skin, 4));
  if (!geometry.getAttribute('aWear')) geometry.setAttribute('aWear', new THREE.Float32BufferAttribute(new Float32Array(bone.count * 3), 3));
  for (const name of ['aBone', 'aBone2', 'aBoneW', 'aGroup']) geometry.deleteAttribute(name);
}

const SHOT_COLORS: Record<string, THREE.Color> = {
  steel: new THREE.Color(2.2, 2.1, 1.8), ki: new THREE.Color(1.2, 2.4, 3.6), cero: new THREE.Color(3.6, .5, .8), jade: new THREE.Color(.8, 3.4, 1.4),
  laser: new THREE.Color(3.8, 2.2, .6), blaster: new THREE.Color(3.8, .8, .5), dark: new THREE.Color(2.2, .6, 3.2), sound: new THREE.Color(2.6, 2.2, 3.4),
  fire: new THREE.Color(3.8, 1.6, .5), blood: new THREE.Color(3, .3, .4),
};

export class GruntRenderer {
  private readonly inkMix={value:INK_ON?1:0};
  set pageInk(value:boolean){this.inkMix.value=INK_ON&&value?1:0;}
  readonly root = new THREE.Group();
  threats?: ReadonlyMap<number, ThreatInk>;
  poses?:ReadonlyMap<number,CrowdPose>;
  private motion?: MotionLibrary;
  private loading?: Promise<void>;
  private readonly kinds: (KindMesh | undefined)[] = [];
  private arcadeKinds:(KindMesh|undefined)[]=[];private riftKinds:(KindMesh|undefined)[]=[];
  private riftLoading?:Promise<void>;private motionLoading?:Promise<MotionLibrary>;
  private catalog:'arcade'|'rift'='arcade';
  private readonly ownedMotion=new Set<THREE.Texture>();
  private readonly bodies = new Map<number, Body>();
  private readonly gibs: Gib[] = [];
  private readonly shadows: THREE.InstancedMesh;
  private readonly shots: THREE.InstancedMesh;
  private shotCount = 0;
  private readonly telegraphs: Telegraphs;
  private readonly flames: Flames;
  private readonly fallen: Fallen[] = [];
  private fallenPlace: unknown = null;
  private variant = 0;
  private readonly drawn = new Map<number, { x: number; y: number; z: number; height: number }>();
  focus?: THREE.Vector3;
  onDeath?: (x: number, y: number, z: number, kind: number, death: number, gore: number, dx: number, dz: number) => void;

  constructor(scene: THREE.Scene) {
    this.root.name = 'horde';
    scene.add(this.root);
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x07040a, transparent: true, opacity: .42, depthWrite: false, alphaMap: shadowTexture() });
    this.shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), shadowMaterial, GRUNTS.length * PER_KIND);
    this.shadows.count = 0; this.shadows.frustumCulled = false; this.shadows.renderOrder = -1;
    this.root.add(this.shadows);
    const shotMaterial = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: .95, depthWrite: false, blending: INK_ON ? THREE.NormalBlending : THREE.AdditiveBlending });
    if (INK_ON) shotMaterial.color.setScalar(.32);
    this.shots = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.12, .9, 4, 8).rotateX(Math.PI / 2), shotMaterial, 64);
    this.shots.count = 0; this.shots.frustumCulled = false;
    this.root.add(this.shots);
    this.telegraphs = new Telegraphs(this.root);
    this.flames = new Flames(this.root);
    for (let i = 0; i < GIBS; i++) this.gibs.push({ alive: false, kind: 0, group: 0, hide: 0, rowA: 0, rowB: 0, frac: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      q: new THREE.Quaternion(), spin: new THREE.Vector3(), pivot: new THREE.Vector3(), scale: 1, born: 0, life: 0, variant: 0 });
  }

  get ready() { return !!this.motion; }
  private ensureMotion(){return this.motionLoading??=MotionLibrary.load().then(motion=>{
    this.motion=motion;[BONE.Spine01,BONE.Head,BONE.LeftArm,BONE.RightArm,BONE.Spine01].forEach((bone,i)=>PIVOTS.value[i].copy(motion.rest[bone]));REST.value=motion.height;return motion;
  });}
  loadRift():Promise<void>{
    return (this.riftLoading??=this.ensureMotion().then(async motion=>{
      const assets=new Map<string,Promise<ModelLook|undefined>>();
      for(let i=0;i<GRUNTS.length;i++){
        const kind=GRUNTS[i].id,url=RIFT_TROOP_MODELS[kind];if(!url)continue;
        let asset=assets.get(url);if(!asset){asset=loadModelLook(kind,url,motion);assets.set(url,asset);}
        const look=await asset;if(!look)throw new Error(`Rift troop has no animated mesh: ${kind}`);
        const built=this.build(i,{...look,geometry:look.geometry.clone()});
        built.height=RIFT_TROOP_HEIGHTS[kind]??GRUNTS[i].height;built.scale*=built.height/GRUNTS[i].height;this.riftKinds[i]=built;
      }
      for(const asset of assets.values())(await asset)?.geometry.dispose();
    })).then(()=>this.useRiftModels(true));
  }
  useRiftModels(on:boolean){
    RIFT_CROWD.value=on?1:0;
    const next=on?'rift':'arcade',catalog=on?this.riftKinds:this.arcadeKinds;
    if((this.catalog===next&&this.kinds.length)||!catalog.length)return;
    this.clear();for(const t of this.tiers())t.body.visible=t.ink.visible=false;
    this.kinds.length=catalog.length;for(let i=0;i<catalog.length;i++)this.kinds[i]=catalog[i];this.catalog=next;
  }

  load(): Promise<void> {
    void loadPropModels();
    return (this.loading ??= this.ensureMotion().then(async motion => {
      this.motion = motion;
      [BONE.Spine01, BONE.Head, BONE.LeftArm, BONE.RightArm, BONE.Spine01].forEach((bone, i) => PIVOTS.value[i].copy(motion.rest[bone]));
      REST.value = motion.height;
      const looks = new Map<number, ModelLook>();
      if (HORDE_LOOKS.models) await Promise.all(GRUNTS.map(async (def, i) => {
        const url = MODEL_LOOKS[def.id];
        if (!url) return;
        try { const look = await loadModelLook(def.id, url, motion); if (look) looks.set(i, look); }
        catch (error) { console.warn(`Horde: ${def.id}'s model did not load; it is sculpted instead`, error); }
      }));
      for (let i = 0; i < GRUNTS.length; i++) this.arcadeKinds[i] = this.build(i, looks.get(i));
    })).then(()=>this.useRiftModels(false));
  }

  private build(kind: number, look?: ModelLook): KindMesh {
    const motion = this.motion!, def = GRUNTS[kind], own = look?.motion ?? motion;
    this.ownedMotion.add(own.texture);
    const sculpted = !look && HORDE_LOOKS.sculpted ? sculptLook(def.id, motion.rest) : undefined;
    const geometry = look?.geometry ?? sculpted ?? buildLook(def.id, motion.rest, motion.height).geometry;
    packSkin(geometry);
    const material = new THREE.MeshToonMaterial({ vertexColors: true, color: 0xffffff, map: look?.texture ?? null });
    material.name = `horde-${def.id}`;
    applyToonShading(material, 'body');
    patchBody(material, own.texture, ICHOR[def.ichor], this.inkMix);
    const ink = new THREE.MeshToonMaterial({ color: 0x081621, side: THREE.BackSide, depthWrite: false });
    ink.userData.ink = true;
    applyInkShell(ink, (BRUTES.has(def.id) ? 1.25 : 1) * (INK_ON ? 1.55 : 1), .035);
    patchInk(ink, own.texture);
    applyInstancedThreatInk(ink);
    const depth = BRUTES.has(def.id) ? new THREE.MeshDepthMaterial() : undefined;
    if (depth) patchDepth(depth, own.texture);
    const coarse = look?.far ? shareVertices(geometry, look.far) : undefined;
    const near = this.tier(def.id, geometry, material, ink, depth, '',own.height);
    if (look) return { kind, near, far: coarse && this.tier(def.id, coarse, material, ink, depth, '-far',own.height), scale: def.height / own.height, modelled: true };
    let far: Tier | undefined;
    if (sculpted) {
      const coarse = sculptLook(def.id, motion.rest, FAR_CELL)!;
      packSkin(coarse);
      far = this.tier(def.id, coarse, material, ink, depth, '-far',own.height);
    }
    return { kind, near, far, scale: def.height / motion.height };
  }

  private mapDots(frame: HordeFrames['frames'][number] | undefined) {
    let n = 0;
    if (frame) for (let j = 0; j < frame.n && n < HORDE_DOTS.x.length; j++) {
      const state = frame.state[j];
      if (state === GS.FREE || state === GS.DEAD) continue;
      HORDE_DOTS.x[n] = frame.x[j]; HORDE_DOTS.z[n] = frame.z[j];
      HORDE_DOTS.kind[n] = frame.flags[j] & GF.ELITE ? 1 : BRUTES.has(GRUNTS[frame.kind[j]]?.id ?? '') ? 2 : 0;
      const role = GRUNTS[frame.kind[j]]?.role;
      HORDE_DOTS.threat[n] = frame.flags[j] & GF.TELEGRAPH ? role === 'gunner' || role === 'sniper' ? 2 : 1 : 0;
      n++;
    }
    HORDE_DOTS.n = n;
  }

  private tier(id: string, geometry: THREE.BufferGeometry, material: THREE.Material, inkMaterial: THREE.Material, depth: THREE.Material | undefined, suffix: string,restHeight:number): Tier {
    const poseA = new THREE.InstancedBufferAttribute(new Float32Array(PER_KIND * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const poseB = new THREE.InstancedBufferAttribute(new Float32Array(PER_KIND * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const look = new THREE.InstancedBufferAttribute(new Float32Array(PER_KIND * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const fx = new THREE.InstancedBufferAttribute(new Float32Array(PER_KIND * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const threat = new THREE.InstancedBufferAttribute(new Float32Array(PER_KIND * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const threatWiden = new THREE.InstancedBufferAttribute(new Float32Array(PER_KIND), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aThreat', threat); geometry.setAttribute('aThreatWiden', threatWiden);
    geometry.setAttribute('aPoseA', poseA); geometry.setAttribute('aPoseB', poseB); geometry.setAttribute('aLook', look); geometry.setAttribute('aFx', fx);
    const body = new THREE.InstancedMesh(geometry, material, PER_KIND);
    const hull = new THREE.InstancedMesh(geometry, inkMaterial, PER_KIND);
    for (const mesh of [body, hull]) { mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    body.name = `horde-${id}${suffix}`; hull.name = `horde-${id}${suffix}-ink`;
    body.receiveShadow = true; body.castShadow = !!depth; hull.castShadow = false;
    if (depth) body.customDepthMaterial = depth;
    hull.instanceMatrix = body.instanceMatrix;
    this.root.add(body, hull);
    return { restHeight,body, ink: hull, poseA, poseB, look, fx, threat, threatWiden, count: 0 };
  }
  private *tiers() { for (const k of this.kinds) if (k) { yield k.near; if (k.far) yield k.far; } }

  warm(): THREE.Object3D[] { return [...this.tiers()].flatMap(t => [t.body, t.ink]); }

  centre(id: string | number, out: THREE.Vector3) {
    const serial = typeof id === 'number' ? id : Number(id.slice(1));
    const at = this.drawn.get(serial);
    if (!at) return undefined;
    return out.set(at.x, at.y + at.height * .55, at.z);
  }
  heightOf(id: string | number) { const serial = typeof id === 'number' ? id : Number(id.slice(1)); return this.drawn.get(serial)?.height; }

  clear() {
    HORDE_DOTS.n = 0;
    this.bodies.clear(); this.drawn.clear(); this.fallen.length = 0;
    for (const gib of this.gibs) gib.alive = false;
    for (const t of this.tiers()) { t.count = 0; t.body.count = 0; t.ink.count = 0; }
    this.shadows.count = 0; this.shots.count = 0;
  }

  update(frames: HordeFrames, time: number, dt: number, camera: THREE.Camera) {
    const motion = this.motion;
    if (!motion) return;
    for (const t of this.tiers()) { t.count = 0; t.threat.array.fill(0); t.threatWiden.array.fill(0); }
    this.drawn.clear();
    const pair = frames.around(time);
    camera.updateMatrixWorld();
    if (this.focus) FOCUS.value.copy(this.focus).applyMatrix4(camera.matrixWorldInverse); else FOCUS.value.set(0, 0, 0);
    HORDE_TIME.value = time % 1000;
    _pv.multiplyMatrices((camera as THREE.PerspectiveCamera).projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    let shadows = 0;
    this.telegraphs.begin(time);
    this.flames.begin(time);
    if (pair) {
      const { a, b, alpha } = pair;
      const seen = ++this.variant;
      for (let j = 0; j < b.n; j++) {
        const serial = b.serial[j], i = a.find(serial);
        const kind = b.kind[j], k = this.kinds[kind];
        if (!k) continue;
        const w = i === undefined ? 1 : alpha;
        const x = i === undefined ? b.x[j] : a.x[i] + (b.x[j] - a.x[i]) * w;
        const y = i === undefined ? b.y[j] : a.y[i] + (b.y[j] - a.y[i]) * w;
        const z = i === undefined ? b.z[j] : a.z[i] + (b.z[j] - a.z[i]) * w;
        const yaw = i === undefined ? b.yaw[j] : lerpAngle(a.yaw[i], b.yaw[j], w);
        const state = b.state[j];
        const phase = (i !== undefined && a.state[i] === state ? a.phase[i] + (b.phase[j] - a.phase[i]) * w : b.phase[j] - (1 - w) * (b.time - a.time));
        const body = this.remember(serial, kind, x, z, dt, seen);
        const def = GRUNTS[kind],height=k.height??def.height, elite = (b.flags[j] & GF.ELITE) !== 0;
        const scale = k.scale * (elite ? 1.15 : 1) * (.93 + ((serial * .7548776) % 1) * .14);
        this.animate(body, b, j, state, Math.max(0, phase), dt, motion);
        this.drawn.set(serial, { x, y, z, height: height * (elite ? 1.15 : 1) });
        if (state === GS.DEAD && !body.gored) { body.gored = true; this.died(body, b, j, x, y, z, yaw, scale, motion); }
        _sphere.center.set(x, y + height * .5, z); _sphere.radius = height * .8 + .5;
        if (!_frustum.intersectsSphere(_sphere)) continue;
        if (state === GS.ATTACK && (b.flags[j] & GF.TELEGRAPH)) this.warn(def, b.move[j], x, z, yaw, phase, b.span[j], serial, elite);
        const lens = camera.position.distanceTo(_sphere.center), line = k.modelled ? LOD_MODEL : LOD_FAR;
        if (body.far ? lens < line - 1 : lens > line + 1) body.far = !body.far;
        const t = body.far && k.far ? k.far : k.near;
        if (t.count >= PER_KIND) continue;
        const n = t.count++;
        let tilt = 0;
        if (state === GS.AIR || (state === GS.DEAD && b.death[j] === DEATH.BLOWN && y > .05)) { body.tumble += dt * (6 + Math.abs(b.vy[j])); tilt = body.tumble; }
        else if (state === GS.KNOCK) tilt = -.35 * Math.min(1, Math.hypot(b.kx[j], b.kz[j]) / 6);
        else body.tumble *= .8;
        _q.setFromAxisAngle(UP, yaw);
        if (tilt) { _q2.setFromEuler(_e.set(-tilt, 0, 0)); _q.multiply(_q2); }
        _m.compose(_p.set(x, y + (state === GS.AIR ? .3 * Math.sin(Math.min(Math.PI, tilt)) : 0), z), _q, _s.setScalar(scale));
        t.body.setMatrixAt(n, _m);
        this.writePose(t, n, body, motion);
        const glow = state !== GS.DEAD ? this.threats?.get(serial) : undefined;
        if (glow && glow.mix.value > 0) {
          const c = glow.color.value;
          t.threat.setXYZW(n, c.r, c.g, c.b, glow.mix.value);
          t.threatWiden.setX(n, glow.widen.value);
        }
        if (this.catalog!=='rift' && state === GS.DEAD && b.death[j] !== DEATH.BURST && b.death[j] !== DEATH.ASH && y < .3) {
          const c = body.corpse ??= { m: new THREE.Matrix4(), rowA: 0, rowB: 0, frac: 0, hide: 0, variant: 0 };
          c.m.copy(_m); c.rowA = _sample.row; c.rowB = _sample.next; c.frac = _sample.frac;
          c.hide = goreMask(b.gore[j]) | (b.flags[j] & GF.BROKEN ? 1 << GROUP.GEAR : 0); c.variant = (serial * .618034) % 1 + Math.min(7, Math.floor((1 - b.hp[j]) * 8));
        }
        const flash = Math.max(0, 1 - b.hit[j] / .11);
        const dissolve = Math.max(1-(this.poses?.get(serial)?.visibility??1),state === GS.SPAWN ? Math.max(0, 1 - phase / .55) : state === GS.DEAD ? this.deathDissolve(b.death[j], phase, b.span[j]) : 0);
        const gear = b.flags[j] & GF.BROKEN ? 1 << GROUP.GEAR : 0;
        const hide = (state === GS.DEAD ? goreMask(b.gore[j]) | (b.death[j] === DEATH.BURST ? 31 | (1 << GROUP.GEAR) : 0) : 0) | gear;
        t.look.setXYZW(n, flash, dissolve, hide, (serial * .618034) % 1 + Math.min(7, Math.floor((1 - b.hp[j]) * 8)));
        const flags = b.flags[j];
        t.fx.setXYZW(n, state === GS.DEAD ? -.25 : flags & GF.TELEGRAPH ? Math.min(1, phase * 3) : flags & GF.ENRAGED ? .35 : 0, elite ? 1 + ((flags & GF.AFFIX) >> AFFIX_SHIFT) : 0, flags & GF.BURNING ? 1 : 0, flags & GF.FROZEN ? 2 : flags & GF.STOPPED ? 1 : 0);
        if ((flags & GF.BURNING) && (state !== GS.DEAD || phase < .8)) {
          const h = def.height * scale / k.scale, heat = state === GS.DEAD ? 1 - phase / .8 : 1, r = (serial * .6180339) % 1;
          this.flames.add(x + Math.sin(yaw + 1.7) * .1, y + h * .3, z + Math.cos(yaw + 1.7) * .1, h * .34, heat * .85, r);
          if (h > 2.2) this.flames.add(x - Math.sin(yaw + 1.7) * .12, y + h * .55, z - Math.cos(yaw + 1.7) * .12, h * .26, heat * .75, r + .37);
        }
        if (state !== GS.DEAD || phase < 1) {
          const lift = Math.max(0, 1 - y / 2.5);
          _m.compose(_p.set(x, .025, z), _q.identity(), _s.set(def.radius * 3.1 * lift, 1, def.radius * 3.1 * lift));
          this.shadows.setMatrixAt(shadows++, _m);
        }
      }
      this.shotsFrom(b, a, alpha);
      for (const [serial, body] of this.bodies) if (body.seen !== seen) {
        if (body.corpse) this.fallen.push({ kind: body.kind, ...body.corpse, born: time, crumble: -1 });
        this.bodies.delete(serial);
      }
    }
    this.telegraphs.end();
    this.flames.end();
    this.mapDots(pair?.b);
    this.drawFallen(time, motion, camera);
    this.flyGibs(time, dt, camera);
    for (const t of this.tiers()) {
      t.body.count = t.count; t.ink.count = t.count;
      if (t.count) {
        uploadInstances(t.body.instanceMatrix, t.count);
        uploadInstances(t.poseA, t.count); uploadInstances(t.poseB, t.count);
        uploadInstances(t.look, t.count); uploadInstances(t.fx, t.count);
        uploadInstances(t.threat, t.count); uploadInstances(t.threatWiden, t.count);
      }
      t.body.visible = t.ink.visible = t.count > 0;
    }
    this.shadows.count = shadows; uploadInstances(this.shadows.instanceMatrix, shadows);
  }

  prepareCamera(camera: THREE.Camera) {
    if (!this.motion) return;
    camera.updateMatrixWorld();
    _coverView.multiplyMatrices(camera.matrixWorldInverse, this.root.matrixWorld);
    if (this.focus) FOCUS.value.copy(this.focus).applyMatrix4(camera.matrixWorldInverse); else FOCUS.value.set(0, 0, 0);
    const focus = FOCUS.value;
    for (const t of this.tiers()) if (t.count) {
      const matrices = t.body.instanceMatrix.array;
      for (let i = 0; i < t.count; i++) {
        _m.fromArray(matrices, i * 16);
        const e = _m.elements;
        _coverPoint.set(0, t.restHeight * .55, 0).applyMatrix4(_m).applyMatrix4(_coverView);
        const cover=this.catalog==='rift'?riftCrowdCoverage:crowdCoverage;
        t.poseB.setW(i, cover(_coverPoint.x, _coverPoint.y, _coverPoint.z, Math.hypot(e[4], e[5], e[6]) * t.restHeight, focus.x, focus.y, focus.z));
      }
      uploadInstances(t.poseB, t.count);
    }
  }

  private warn(def: (typeof GRUNTS)[number], moveIndex: number, x: number, z: number, yaw: number, phase: number, span: number, serial: number, elite: boolean) {
    const move = def.moves[moveIndex];
    if (!move) return;
    const scale = Math.max(.05, span) / move.duration, fill = phase / Math.max(.05, move.contact * scale);
    const grow = elite ? 1.15 : 1, seed = (serial * .37) % 1;
    if (move.kind === 'charge') this.telegraphs.add(Shape.Lane, x, z, yaw, (move.lunge ?? 8) + 1, def.radius * 2.6 * grow, fill, seed);
    else if (move.kind === 'slam' || move.kind === 'explode' || move.kind === 'dive') this.telegraphs.add(Shape.Circle, x, z, yaw, (move.radius ?? 2.5) * grow, 0, fill, seed);
    else if (move.kind === 'mend') this.telegraphs.add(Shape.Heal, x, z, yaw, (move.radius ?? 6) * grow, 0, fill, seed);
    else if (move.kind === 'summon') this.telegraphs.add(Shape.Rift, x, z, yaw, 2.2 * grow, 0, fill, seed);
    else if (move.kind === 'shot') this.telegraphs.add(Shape.Line, x, z, yaw, Math.min(move.maxRange ?? 15, move.range), Math.max(.35, (move.radius ?? .3) * 2.2), fill, seed);
    else if (move.heavy) this.telegraphs.add(Shape.Arc, x, z, yaw, (move.range + (move.lunge ?? 0) * .5) * grow, 0, fill, seed);
  }

  private remember(serial: number, kind: number, x: number, z: number, dt: number, seen: number): Body {
    let body = this.bodies.get(serial);
    if (!body) {
      const idle = this.motion!.clip('idle');
      const gait = GAITS[GRUNTS[kind]?.id] ?? SOLDIER, pick = (list: string[], k: number) => list[Math.floor(((serial * k) % 1) * list.length)];
      body = { serial, kind, clip: idle, time: Math.random() * 2, loop: true, fromTime: 0, fromLoop: true, fadeAt: -10, key: '', stride: Math.random(), lastX: x, lastZ: z, speed: 0, seen, gored: false, tumble: 0, tumbleAxis: 0, far: false,
        walk: pick(gait.walks, .5698403), run: pick(gait.runs, .4142136), pace: .92 + ((serial * .3183099) % 1) * .16 };
      this.bodies.set(serial, body);
    }
    const moved = Math.hypot(x - body.lastX, z - body.lastZ);
    if (dt > 0) body.speed += (moved / dt - body.speed) * Math.min(1, dt * 10);
    body.lastX = x; body.lastZ = z; body.seen = seen;
    return body;
  }

  private animate(body: Body, frame: HordeFrame, j: number, state: number, phase: number, dt: number, motion: MotionLibrary) {
    const def = GRUNTS[frame.kind[j]];
    const span = Math.max(.05, frame.span[j]);
    let name = 'idle', t = 0, loop = true, key = '';
    switch (state) {
      case GS.SPAWN: { name = 'getup'; const c = motion.clip('getup'); t = c.duration * (.66 + .34 * Math.min(1, phase / span)); loop = false; key = 'spawn'; break; }
      case GS.ATTACK: {
        const move = def.moves[frame.move[j]];
        name = move.clip; loop = false; key = `attack${frame.move[j]}`;
        t = motion.clip(name).duration * Math.min(1, phase / span);
        break;
      }
      case GS.CHARGE: name = phase < .55 ? 'roar2' : 'run-charge'; t = phase < .55 ? phase * 1.6 : phase * 1.9; loop = phase >= .55; key = name; break;
      case GS.FLINCH: name = 'hit'; t = Math.min(.8, phase * 1.8); loop = false; key = 'hit'; break;
      case GS.KNOCK: name = 'hit'; t = Math.min(1.1, phase * 1.3); loop = false; key = 'knock'; break;
      case GS.STUN: name = 'hit'; t = .35 + Math.sin(phase * 3) * .2; loop = false; key = 'stun'; break;
      case GS.AIR: name = 'launched'; t = Math.min(.45, phase * 1.2); loop = false; key = 'air'; break;
      case GS.DOWN: name = 'knockdown'; t = Math.min(2.4, .9 + phase * 1.6); loop = false; key = 'down'; break;
      case GS.GETUP: { name = 'getup'; const c = motion.clip('getup'); t = c.duration * (.62 + .38 * Math.min(1, phase / span)); loop = false; key = 'getup'; break; }
      case GS.DEAD: {
        const death = frame.death[j];
        const way = frame.serial[j] % 3;
        if (death === DEATH.BLOWN) { name = 'die-blown'; t = Math.min(2.65, .45 + phase * 1.2); }
        else if (way === 0) { name = 'knockdown'; t = Math.min(2.4, .2 + phase * 1.2); }
        else if (way === 1) { name = 'die'; t = Math.min(2.9, phase * 1.25); }
        else { name = 'die-fall'; t = Math.min(2.5, phase * 1.25); }
        loop = false; key = `dead${death}`;
        break;
      }
      default: {
        if (frame.flags[j] & (GF.FROZEN | GF.STOPPED)) dt = 0;
        const speed = body.speed;
        name = speed > 2.4 ? body.run : speed > .35 ? body.walk : 'idle';
        const c = motion.clip(name);
        if (name === 'idle') { body.stride += dt; t = body.stride; }
        else {
          const gait = GAIT[name] ?? GAIT.walk;
          const rate = Math.min(gait.max, Math.max(gait.min, speed / gait.metres * c.duration)) * body.pace;
          body.stride += dt * rate / c.duration;
          t = body.stride * c.duration;
        }
        key = name;
      }
    }
    const override=this.poses?.get(frame.serial[j]);
    if(override?.clip){name=override.clip;t=motion.clip(name).duration*(override.progress??0);loop=false;key=override.key??name;}
    if (key !== body.key) {
      body.from = body.clip; body.fromTime = body.time; body.fromLoop = body.loop; body.fadeAt = 0;
      body.key = key;
    }
    body.clip = motion.clip(name); body.time = t; body.loop = loop;
    body.fadeAt += dt;
  }

  private writePose(k: Tier, n: number, body: Body, motion: MotionLibrary) {
    motion.sample(body.clip, body.time, body.loop, _sample);
    const w = body.from ? Math.min(1, body.fadeAt / CROSSFADE) : 1;
    k.poseA.setXYZW(n, _sample.row, _sample.next, _sample.frac, w);
    if (body.from && w < 1) {
      motion.sample(body.from, body.fromTime, body.fromLoop, _from);
      k.poseB.setXYZW(n, _from.row, _from.next, _from.frac, 0);
    } else k.poseB.setXYZW(n, _sample.row, _sample.next, _sample.frac, 0);
  }

  private deathDissolve(death: number, phase: number, _span: number) {
    if (death === DEATH.BURST) return 1;
    if (death === DEATH.ASH) return Math.min(1, Math.max(0, (phase - .25) / 1.1));
    return 0;
  }

  private drawFallen(time: number, motion: MotionLibrary, camera: THREE.Camera) {
    const place = activeRift() ?? null;
    if (place !== this.fallenPlace) { this.fallenPlace = place; this.fallen.length = 0; }
    let over = this.fallen.length - FALLEN_MAX;
    for (const f of this.fallen) {
      if (f.crumble < 0 && (over > 0 || time - f.born > FALLEN_LIFE)) { f.crumble = time; over--; }
    }
    for (let i = this.fallen.length - 1; i >= 0; i--) if (this.fallen[i].crumble >= 0 && time - this.fallen[i].crumble > CRUMBLE) this.fallen.splice(i, 1);
    for (let i = this.fallen.length - 1; i >= 0; i--) {
      const f = this.fallen[i], k = this.kinds[f.kind];
      if (!k) continue;
      _p.setFromMatrixPosition(f.m); _sphere.center.copy(_p); _sphere.radius = 1.6;
      if (!_frustum.intersectsSphere(_sphere)) continue;
      const t = k.far && (!k.modelled || camera.position.distanceTo(_p) > LOD_MODEL) ? k.far : k.near;
      if (t.count >= PER_KIND) continue;
      const n = t.count++;
      t.body.setMatrixAt(n, f.m);
      t.poseA.setXYZW(n, f.rowA, f.rowB, f.frac, 1); t.poseB.setXYZW(n, f.rowA, f.rowB, f.frac, 0);
      t.look.setXYZW(n, 0, f.crumble >= 0 ? Math.min(1, (time - f.crumble) / CRUMBLE) : 0, f.hide, f.variant);
      t.fx.setXYZW(n, -.25, 0, 0, 0);
    }
    void motion;
  }

  private died(body: Body, frame: HordeFrame, j: number, x: number, y: number, z: number, yaw: number, scale: number, motion: MotionLibrary) {
    const death = frame.death[j], gore = frame.gore[j];
    const kx = frame.kx[j], kz = frame.kz[j];
    const n = Math.hypot(kx, kz) || 1;
    this.onDeath?.(x, y, z, frame.kind[j], death, gore, kx / n, kz / n);
    const all = (1 << GROUP.BODY) | (1 << GROUP.HEAD) | (1 << GROUP.ARM_L) | (1 << GROUP.ARM_R) | (1 << GROUP.UPPER) | (1 << GROUP.GEAR);
    const parts: [number, number][] = [];
    if (gore & GORE.HEAD || death === DEATH.BURST) parts.push([GROUP.HEAD, all & ~(1 << GROUP.HEAD)]);
    if (gore & GORE.ARM_L || death === DEATH.BURST) parts.push([GROUP.ARM_L, all & ~(1 << GROUP.ARM_L)]);
    if (gore & GORE.ARM_R || death === DEATH.BURST) parts.push([GROUP.ARM_R, all & ~(1 << GROUP.ARM_R)]);
    if (death === DEATH.BURST) parts.push([GROUP.UPPER, all & ~(1 << GROUP.UPPER)]);
    else if (gore & GORE.WAIST) {
      let keep = 1 << GROUP.UPPER;
      for (const [bit, group] of [[GORE.HEAD, GROUP.HEAD], [GORE.ARM_L, GROUP.ARM_L], [GORE.ARM_R, GROUP.ARM_R]] as const) if (!(gore & bit)) keep |= 1 << group;
      parts.push([GROUP.UPPER, all & ~keep]);
    }
    motion.sample(body.clip, body.time, body.loop, _sample);
    for (const [group, hide] of parts) {
      const gib = this.gibs.find(each => !each.alive);
      if (!gib) break;
      motion.posed(BONE[PART_BONE[group] as keyof typeof BONE], _sample.row, gib.pivot);
      gib.alive = true; gib.kind = frame.kind[j]; gib.group = group; gib.hide = hide; gib.rowA = _sample.row; gib.rowB = _sample.next; gib.frac = _sample.frac;
      gib.scale = scale; gib.variant = (body.serial * .618034) % 1;
      _v.copy(gib.pivot).multiplyScalar(scale).applyAxisAngle(UP, yaw);
      gib.x = x + _v.x; gib.y = y + _v.y; gib.z = z + _v.z;
      const fling = death === DEATH.BURST ? 6 : 3.2;
      gib.vx = kx * .5 + (Math.random() - .5) * fling; gib.vz = kz * .5 + (Math.random() - .5) * fling; gib.vy = 3 + Math.random() * (death === DEATH.BURST ? 6 : 3.5);
      gib.q.setFromAxisAngle(UP, yaw); gib.spin.set((Math.random() - .5) * 16, (Math.random() - .5) * 10, (Math.random() - .5) * 16);
      gib.born = 0; gib.life = 3.2 + Math.random();
    }
  }

  private flyGibs(time: number, dt: number, camera: THREE.Camera) {
    for (const gib of this.gibs) {
      if (!gib.alive) continue;
      gib.born += dt;
      if (gib.born > gib.life) { gib.alive = false; continue; }
      gib.vy -= 18 * dt;
      gib.x += gib.vx * dt; gib.y += gib.vy * dt; gib.z += gib.vz * dt;
      if (gib.y < .08) { gib.y = .08; gib.vy = Math.abs(gib.vy) > 2 ? -gib.vy * .3 : 0; gib.vx *= .6; gib.vz *= .6; gib.spin.multiplyScalar(.5); }
      _q2.setFromEuler(_e.set(gib.spin.x * dt, gib.spin.y * dt, gib.spin.z * dt));
      gib.q.multiply(_q2);
      _sphere.center.set(gib.x, gib.y, gib.z); _sphere.radius = Math.max(.7, GRUNTS[gib.kind].height * .55);
      if (!_frustum.intersectsSphere(_sphere)) continue;
      const model = this.kinds[gib.kind]; if (!model) continue;
      const distance = camera.position.distanceTo(_sphere.center);
      const k = model.far && distance > 7 ? model.far : model.near;
      if (k.count >= PER_KIND) continue;
      _m.compose(_p.set(gib.x, gib.y, gib.z), gib.q, _s.setScalar(gib.scale)).multiply(_t.makeTranslation(-gib.pivot.x, -gib.pivot.y, -gib.pivot.z));
      const n = k.count++;
      k.body.setMatrixAt(n, _m);
      k.poseA.setXYZW(n, gib.rowA, gib.rowB, gib.frac, 1); k.poseB.setXYZW(n, gib.rowA, gib.rowB, gib.frac, 0);
      const dissolve = Math.max(0, (gib.born - (gib.life - .8)) / .8);
      k.look.setXYZW(n, 0, dissolve, gib.hide, gib.variant + 6);
      k.fx.setXYZW(n, -.25, 0, 0, 0);
    }
    void time;
  }

  private shotsFrom(b: HordeFrame, a: HordeFrame, alpha: number) {
    let n = 0;
    for (const shot of b.shots) {
      if (n >= 64) break;
      const prev = a.shots.find(s => s.id === shot.id);
      const x = prev ? prev.x + (shot.x - prev.x) * alpha : shot.x, y = prev ? prev.y + (shot.y - prev.y) * alpha : shot.y, z = prev ? prev.z + (shot.z - prev.z) * alpha : shot.z;
      _v.set(shot.vx, shot.vy, shot.vz).normalize();
      _q.setFromUnitVectors(_p.set(0, 0, 1), _v);
      const element = GRUNTS[shot.type]?.moves[shot.move]?.element ?? 'steel';
      const big = element === 'cero' || element === 'laser' ? 2 : 1;
      _m.compose(_p.set(x, y, z), _q, _s.set(big, big, big));
      this.shots.setMatrixAt(n, _m);
      this.shots.setColorAt(n, SHOT_COLORS[element] ?? SHOT_COLORS.steel);
      n++;
    }
    this.shots.count = n;
    uploadInstances(this.shots.instanceMatrix, n);
    if (this.shots.instanceColor) uploadInstances(this.shots.instanceColor, n);
  }

  dispose() {
    const materials=new Set<THREE.Material>(),geometries=new Set<THREE.BufferGeometry>();
    for(const k of [...this.arcadeKinds,...this.riftKinds])if(k)for(const t of [k.near,k.far])if(t){
      geometries.add(t.body.geometry);materials.add(t.body.material as THREE.Material);materials.add(t.ink.material as THREE.Material);
      if(t.body.customDepthMaterial)materials.add(t.body.customDepthMaterial);t.body.dispose();t.ink.dispose();
    }
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();
    for(const texture of this.ownedMotion)texture.dispose();this.ownedMotion.clear();
    this.shadows.geometry.dispose(); (this.shadows.material as THREE.MeshBasicMaterial).alphaMap?.dispose(); (this.shadows.material as THREE.Material).dispose(); this.shadows.dispose();
    this.telegraphs.dispose();
    this.flames.dispose();
    this.shots.geometry.dispose(); (this.shots.material as THREE.Material).dispose(); this.shots.dispose();
    this.motion?.texture.dispose();
    this.root.removeFromParent();
  }
}

function goreMask(gore: number) {
  let hide = 0;
  if (gore & GORE.HEAD) hide |= 1 << GROUP.HEAD;
  if (gore & GORE.ARM_L) hide |= 1 << GROUP.ARM_L;
  if (gore & GORE.ARM_R) hide |= 1 << GROUP.ARM_R;
  if (gore & GORE.WAIST) hide |= (1 << GROUP.UPPER) | (1 << GROUP.HEAD) | (1 << GROUP.ARM_L) | (1 << GROUP.ARM_R);
  return hide;
}
function lerpAngle(a: number, b: number, t: number) { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * t; }

let shadowMap: THREE.DataTexture | undefined;
function shadowTexture() {
  if (shadowMap) return shadowMap;
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot((x + .5) / size - .5, (y + .5) / size - .5) * 2, t = Math.max(0, Math.min(1, 1 - d));
    const v = Math.round(255 * t * t * (3 - 2 * t)), i = (y * size + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  shadowMap = new THREE.DataTexture(data, size, size); shadowMap.needsUpdate = true;
  return shadowMap;
}
