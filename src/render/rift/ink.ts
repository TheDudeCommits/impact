import * as THREE from 'three';
import { addShaderPatch, replaceOnce } from '../look/shaderPatch';
import type { LookPreset, Vec3 } from '../look/stageLooks';
import type { RiftStageId } from '../../game/riftLayouts';

const QUERY = typeof location === 'object' ? new URLSearchParams(location.search) : new URLSearchParams();
export const INK_ON = QUERY.get('ink') !== '0';
const CHROMA = INK_ON && Number(QUERY.get('ink')) > 0 ? Math.min(1, Number(QUERY.get('ink'))) : 0;

export interface InkSky {
  top: number; low: number;
  clouds: number; cloudLit: number; cloudShade: number;
  stars: number;
  disc?: { size: number; color: number; glow: number; eclipse?: boolean };
}
export interface InkPage {
  paper: number; ink: number;
  shade: number;
  tone: number;
  sky: InkSky;
  danger?: number; hot?: number; accent?: number;
  crowd?: number;
  far?: number;
}

const DAY: InkSky = { top: .34, low: .1, clouds: .55, cloudLit: 0, cloudShade: .3, stars: 0 };
const NIGHT: InkSky = { top: .99, low: .88, clouds: .34, cloudLit: .62, cloudShade: .9, stars: .5 };
export const INK_PAGES: Record<RiftStageId, InkPage> = {
  'rift-village': { paper: 0xf4e8d2, ink: 0x0c0a0c, shade: 0x7a5238, tone: .82,
    sky: { ...DAY, top: .42, low: .14, clouds: .72, cloudShade: .42, disc: { size: .09, color: 0xfff6e4, glow: .3 } } },
  'rift-swords': { paper: 0xeee6da, ink: 0x0c0a0c, shade: 0x5e4c5c, tone: .82,
    sky: { ...DAY, top: .56, low: .36, clouds: .3, cloudLit: .3, cloudShade: .7, disc: { size: .23, color: 0xfffdf6, glow: .5 } } },
  'rift-fortress': { paper: 0xe2e8f2, ink: 0x080a12, shade: 0x3c4868, tone: .8,
    sky: { ...NIGHT, low: .84, clouds: .72, cloudLit: .56, cloudShade: .9, stars: 0 } },
  'rift-eclipse': { paper: 0xd8301e, ink: 0x0a0204, shade: 0x5a0c10, tone: .86, danger: 0x0a0204, hot: 0xfff2e4, accent: 0xfff2e4, crowd: .14,
    sky: { ...DAY, top: .5, low: .16, clouds: .34, cloudLit: .6, cloudShade: .95, disc: { size: .15, color: 0xfff0e0, glow: .6, eclipse: true } } },
  'rift-frost': { paper: 0xf2f6ff, ink: 0x0a1020, shade: 0x5a6e98, tone: .8, crowd: .3,
    sky: { ...NIGHT, low: .8, clouds: .3, disc: { size: .12, color: 0xffffff, glow: .55 } } },
  'rift-grove': { paper: 0xf2e6da, ink: 0x120608, shade: 0x7a2c2c, tone: .82,
    sky: { ...NIGHT, clouds: .3, stars: .2, disc: { size: .16, color: 0xff2a1e, glow: .35 } } },
  'rift-wastes': { paper: 0xeae0d0, ink: 0x0c0a0a, shade: 0x6e5444, tone: .82,
    sky: { ...DAY, top: .36, low: .12, clouds: .8, cloudShade: .46, disc: { size: .1, color: 0xfff4e0, glow: .3 } } },
  'rift-harbor': { paper: 0xdce8e6, ink: 0x061012, shade: 0x38524e, tone: .8, far: 320,
    sky: { ...DAY, top: .6, low: .34, clouds: .82, cloudLit: .3, cloudShade: .62 } },
};

const linear = (hex: number, scale = 1) => new THREE.Color(hex).multiplyScalar(scale);
const blend = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);

export const inkUniforms = {
  uInkChroma: { value: CHROMA },
  uInkDark: { value: new THREE.Color(0, 0, 0) },
  uInkPaper: { value: new THREE.Color(1, 1, 1) },
  uInkShade: { value: new THREE.Color(.3, .3, .3) },
  uInkSteps: { value: new THREE.Vector3(.13, .34, .7) },
  uInkPitch: { value: 5 },
  uInkLine: { value: 1.6 },
  uInkHalf: { value: 540 },
  uInkFlash: { value: 0 },
  uInkDanger: { value: new THREE.Color(.5, .02, .03) },
  uInkHot: { value: new THREE.Color(1, .1, .05) },
  uInkAccent: { value: new THREE.Color(.8, .03, .05) },
  uInkElite: { value: new THREE.Color(.1, .3, .9) },
  uInkGold: { value: new THREE.Color(1, .6, .05) },
  uInkCrowd: { value: .45 },
  uInkMend: { value: new THREE.Color(.02, .35, .12) },
  uInkCall: { value: new THREE.Color(.3, .04, .45) },
};
export const inkSkyUniforms = {
  uSkyTone: { value: new THREE.Vector2(.3, .1) },
  uSkyCloud: { value: new THREE.Vector3(.5, 0, .3) },
  uSkyCloudOffset: { value: new THREE.Vector2() },
  uSkyStars: { value: 0 },
  uSkyDiscDir: { value: new THREE.Vector3(0, 1, 0) },
  uSkyDisc: { value: new THREE.Vector4(.99, .3, 0, 0) },
  uSkyDiscColor: { value: new THREE.Color(1, 1, 1) },
  uSkyFlood: { value: new THREE.Vector4(1, 1, 1, 0) },
  uSkyHaze: { value: new THREE.Color(1, 1, 1) },
  uSkyTime: { value: 0 },
};

const hazeOf = (page: InkPage) => blend(page.paper, page.ink, page.sky.low * .8).multiplyScalar(page.tone);

export function setInkPage(stage: RiftStageId, look: LookPreset) {
  const page = INK_PAGES[stage], k = 1 / Math.max(.2, look.exposure), sky = page.sky;
  pageExposure = Math.max(.2, look.exposure);
  const tone = Number(QUERY.get('inkpaper')) || page.tone;
  inkUniforms.uInkDark.value.copy(linear(page.ink, k));
  inkUniforms.uInkPaper.value.copy(linear(page.paper, k * tone));
  inkUniforms.uInkShade.value.copy(linear(page.shade, k));
  inkUniforms.uInkDanger.value.copy(linear(page.danger ?? 0xa80e18, k));
  inkUniforms.uInkHot.value.copy(linear(page.hot ?? 0xff2a14, k));
  inkUniforms.uInkAccent.value.copy(linear(page.accent ?? 0xd0141e, k));
  inkUniforms.uInkElite.value.copy(linear(0x2a6ee8, k));
  inkUniforms.uInkGold.value.copy(linear(0xf0b020, k));
  inkUniforms.uInkMend.value.copy(linear(0x14803c, k));
  inkUniforms.uInkCrowd.value = page.crowd ?? .45;
  inkUniforms.uInkCall.value.copy(linear(0x6a1c9a, k));
  const s = inkSkyUniforms;
  s.uSkyTone.value.set(sky.top, sky.low);
  s.uSkyCloud.value.set(sky.clouds, sky.cloudLit, sky.cloudShade);
  s.uSkyStars.value = sky.stars;
  const d: Vec3 = look.sky.sunDir ?? look.key.dir;
  s.uSkyDiscDir.value.set(d[0], d[1], d[2]).normalize();
  s.uSkyDisc.value.set(Math.cos(sky.disc?.size ?? .1), sky.disc?.glow ?? 0, sky.disc?.eclipse ? 1 : 0, sky.disc ? 1 : 0);
  s.uSkyDiscColor.value.copy(linear(sky.disc?.color ?? 0xffffff, k * 1.25));
  s.uSkyHaze.value.copy(hazeOf(page).multiplyScalar(k));
}
let canvas: HTMLCanvasElement | null | undefined;
export function inkFrameHeight() {
  if (typeof document !== 'object') return 1080;
  if (!canvas?.isConnected) canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  return canvas?.height || Math.round(innerHeight * Math.min(devicePixelRatio, 1.5));
}
export function setInkResolution(height = inkFrameHeight()) {
  inkUniforms.uInkPitch.value = Number(QUERY.get('inkpitch')) || Math.max(3.4, height / 235);
  inkUniforms.uInkLine.value = Math.max(1.1, height / 760);
  inkUniforms.uInkHalf.value = height / 2;
}
export function inkColour(awake: boolean, dt: number) {
  const u = inkUniforms.uInkChroma, target = awake ? Math.max(CHROMA, .72) : CHROMA;
  u.value += (target - u.value) * (1 - Math.exp(-dt * (target > u.value ? 5 : 1.2)));
  if (Math.abs(u.value - target) < .002) u.value = target;
}
let pageExposure = 1;
const _flood = new THREE.Color(), _hsl = { h: 0, s: 0, l: 0 };
export function inkFlood(color: number | undefined, dt: number) {
  const u = inkSkyUniforms.uSkyFlood.value;
  if (color !== undefined) {
    _flood.setHex(color).getHSL(_hsl, THREE.SRGBColorSpace);
    _flood.setHSL(_hsl.h, Math.max(.62, _hsl.s), Math.min(.56, Math.max(.44, _hsl.l)), THREE.SRGBColorSpace).multiplyScalar(1 / pageExposure);
    u.x = _flood.r; u.y = _flood.g; u.z = _flood.b;
  }
  const target = color !== undefined ? 1 : 0;
  u.w += (target - u.w) * (1 - Math.exp(-dt * (target > u.w ? 7 : 1.4)));
  if (Math.abs(u.w - target) < .002) u.w = target;
}
export function updateInkSky(time: number, dt: number, speed: number) {
  inkSkyUniforms.uSkyTime.value = time;
  inkSkyUniforms.uSkyCloudOffset.value.x += speed * dt * .8; inkSkyUniforms.uSkyCloudOffset.value.y += speed * dt * .35;
}

export function inkLook(stage: RiftStageId, look: LookPreset): LookPreset {
  const page = INK_PAGES[stage];
  const haze = hazeOf(page).multiplyScalar(1 / Math.max(.2, look.exposure)).getHex();
  return {
    ...look,
    fog: { color: haze, near: 18, far: page.far ?? 200 },
    sky: { ...look.sky, zenith: haze, horizon: haze, ground: haze, cloudCoverage: 0, stars: 0, sunIntensity: 0, sunGlow: 0 },
    grade: { ...look.grade, saturation: Math.min(1.05, look.grade.saturation + .08), vignette: look.grade.vignette * .6, split: look.grade.split * .35, shadowDesat: 0 },
    atmosphere: look.atmosphere.kind === 'embers' ? look.atmosphere
      : { ...look.atmosphere, color: blend(look.atmosphere.color, page.ink, .5).getHex(), color2: blend(look.atmosphere.color2, page.ink, .7).getHex() },
  };
}


export const INK_MARK_PARS = `
uniform vec3 uInkDark;
uniform vec3 uInkPaper;
uniform vec3 uInkDanger;
uniform vec3 uInkHot;
uniform vec3 uInkAccent;
uniform vec3 uInkElite;
uniform vec3 uInkGold;
uniform vec3 uInkMend;
uniform vec3 uInkCall;
// Pen hatching fixed to a surface (its uv), for a mark lying in the world: a stroke every 1/density.
float inkMarkHatch( vec2 p, float density, float cover ) {
	float a = abs( fract( ( p.x + p.y ) * density ) - .5 ) * 2.0;
	float w = clamp( cover, 0.0, .9 );
	float aa = fwidth( ( p.x + p.y ) * density ) * 2.0;
	return ( 1.0 - smoothstep( w - aa, w + aa, a ) ) * step( .004, w );
}
`;


export const INK_SHIFT_PARS = `
uniform float uInkHalf;
varying vec2 vInkShift;
vec2 inkShift() {
	vec3 ahead = - vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] );
	float focal = projectionMatrix[ 1 ][ 1 ] * uInkHalf;
	return vec2( - atan( ahead.x, ahead.z ), asin( clamp( ahead.y, -1.0, 1.0 ) ) ) * focal;
}
`;

export const INK_PARS = `
uniform float uInkChroma;
uniform vec3 uInkDark;
uniform vec3 uInkPaper;
uniform vec3 uInkShade;
uniform vec3 uInkSteps;
uniform float uInkPitch;
uniform float uInkLine;
uniform float uInkFlash;
uniform float uInkCrowd;
varying vec2 vInkShift;
float inkLuma( vec3 c ) { return dot( c, vec3( .2126, .7152, .0722 ) ); }
float inkValue( vec3 c ) { return max( max( c.r, c.g ), c.b ) * .6 + inkLuma( c ) * .4; }
float inkHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
// Screentone: dots on a turned grid, as large as the tone is dark.
float inkDots( float cover ) {
	vec2 p = mat2( .7071, -.7071, .7071, .7071 ) * ( gl_FragCoord.xy - vInkShift ) / uInkPitch;
	float d = length( fract( p ) - .5 );
	float r = sqrt( clamp( cover, 0.0, 1.0 ) ) * .6;
	float aa = .75 / uInkPitch;
	return ( 1.0 - smoothstep( r - aa, r + aa, d ) ) * step( .004, cover );
}
// Pen hatching: strokes down one diagonal, a second set across them where it is darker.
float inkHatch( float cover ) {
	float pitch = uInkPitch * 1.1;
	vec2 at = gl_FragCoord.xy - vInkShift;
	float a = abs( fract( ( at.x + at.y ) / pitch ) - .5 ) * 2.0;
	float b = abs( fract( ( at.x - at.y ) / pitch + .25 ) - .5 ) * 2.0;
	float w1 = clamp( cover * 1.5, 0.0, .86 ), w2 = clamp( cover * 1.7 - .8, 0.0, .86 );
	float aa = 1.5 / pitch;
	float s1 = ( 1.0 - smoothstep( w1 - aa, w1 + aa, a ) ) * step( .004, w1 );
	float s2 = ( 1.0 - smoothstep( w2 - aa, w2 + aa, b ) ) * step( .004, w2 );
	return max( s1, s2 );
}
// Paper: its colour, with a grain of fibre in it.
vec3 inkPaper() { return uInkPaper * ( 1.0 - .04 * inkHash( floor( ( gl_FragCoord.xy - vInkShift ) * .75 ) ) ); }
/** What a surface is on the page. v: its tone (0 the dark - 1 and over, the
 *  light); albedo: its own colour (for the page with colour let in); line: a
 *  drawn line (0-1); away: 0 near, 1 where marks smaller than a pixel would
 *  shimmer and give way to the flat tone they add up to. */
vec3 inkPage( float v, vec3 albedo, float line, float away ) {
	v += uInkFlash * .6 * step( uInkSteps.x, v );
	float solid = 1.0 - smoothstep( uInkSteps.x * .82, uInkSteps.x * 1.18, v );
	float hatchCover = 1.0 - smoothstep( uInkSteps.x, uInkSteps.y, v );
	float toneCover = ( 1.0 - smoothstep( uInkSteps.y, uInkSteps.z, v ) ) * .42;
	float drawn = max( inkHatch( hatchCover ), inkDots( toneCover ) );
	float level = clamp( hatchCover * .62 + toneCover * .55, 0.0, 1.0 );
	float marks = mix( drawn, level, away );
	float inked = max( max( solid, marks ), line );
	vec3 mono = mix( inkPaper(), uInkDark, inked );
	if ( uInkChroma < .004 ) return mono;
	// Colour let back in: the surface's own hue, flat, in two tones - lit at
	// the paper's brightness, shaded toward the place's shade - with the solid
	// blacks, the lines and a share of the hatching kept over it.
	float peak = max( max( albedo.r, albedo.g ), max( albedo.b, 1e-3 ) );
	vec3 hue = mix( vec3( 1.0 ), albedo / peak, .85 );
	float lit = smoothstep( uInkSteps.y * .8, uInkSteps.y * 1.25, v );
	vec3 coloured = mix( hue * uInkShade * 1.35, hue * uInkPaper, lit );
	coloured = mix( coloured, uInkDark, max( max( solid, line ), marks * .55 ) );
	return mix( mono, coloured, uInkChroma );
}
// How dark a thing is itself: 1 for the pale, toward 0 for the black-clad.
float inkOwn( vec3 albedo, float local ) { return mix( 1.0, clamp( pow( inkValue( albedo ) / .3, 1.5 ), .06, 1.35 ), local ); }
// A tone from the light on a thing and its own paint: the paint dims the lit
// side, and in the shade its lighter and darker parts still show - a wall
// out of the key is hatched, its gaps and windows solid black - instead of
// the whole side going to one black.
float inkTone( float light, vec3 albedo, float local ) {
	float own = inkOwn( albedo, local );
	return light * mix( 1.0, own, .6 ) + ( inkValue( albedo ) - .3 ) * .45 * local;
}
// A contour where a rounded surface turns from the eye, a line's width on screen.
float inkContour( vec3 n, vec3 toEye ) {
	float facing = abs( dot( n, toEye ) );
	float px = facing / max( fwidth( facing ), 1e-4 );
	return ( 1.0 - smoothstep( uInkLine * .7, uInkLine * 1.7, px ) ) * ( 1.0 - smoothstep( .16, .34, facing ) );
}
`;

const lightsBegin = () => {
  let chunk = THREE.ShaderChunk.lights_fragment_begin;
  chunk = replaceOnce(chunk, 'getDirectionalLightInfo( directionalLight, directLight );',
    'getDirectionalLightInfo( directionalLight, directLight );\n\t\tinkIsKey = UNROLLED_LOOP_INDEX == 0; inkShadowTerm = 1.0;', 'ink key light');
  chunk = replaceOnce(chunk, 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]',
    'inkShadowTerm = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]', 'ink key shadow');
  return chunk;
};
let LIGHTS_BEGIN: string | undefined;
const INK_LIGHT_PARS = `
bool inkIsKey = false;
float inkShadowTerm = 1.0;
float inkKeyLit = 0.0;
vec3 inkOther = vec3( 0.0 );
void RE_Direct_Ink( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	if ( inkIsKey ) { inkIsKey = false; inkKeyLit = dotNL * inkShadowTerm; }
	else inkOther += dotNL * directLight.color;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Ink`;

export interface InkSurface {
  water?: boolean;
  faces?: boolean;
  local?: number;
  stain?: string;
}

export function inkStageMaterial(parameters: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial(parameters);
}

const WATER_STROKES = `
		{
			vec2 w = vInkWorld;
			// Strokes a level of detail apart, blended by distance: from a low lens a sea of
			// lines one spacing apart closes into a flat tone twenty metres out.
			float level = max( 0.0, log2( max( inkDepth, 1.0 ) / 16.0 ) );
			float fine = exp2( - floor( level ) ), blend = fract( level );
			float stroke = 0.0, closed = 0.0;
			for ( int n = 0; n < 2; n ++ ) {
				float scale = n == 0 ? fine : fine * .5;
				float swell = ( w.y * .42 - uSkyTime * .22 ) * scale + sin( w.x * .085 * scale + uSkyTime * .3 ) * 1.3 + sin( w.x * .27 * scale - uSkyTime * .45 + w.y * .1 * scale ) * .4;
				float row = floor( swell );
				float across = abs( fract( swell ) - .5 );
				float aa = fwidth( swell ) * 1.2;
				// Each stroke breaks off and picks up again along its length, no two rows alike.
				float run = sin( w.x * scale * ( .16 + .07 * inkHash( vec2( row, 3.0 + float( n ) ) ) ) + row * 2.7 + uSkyTime * .18 );
				float one = ( 1.0 - smoothstep( .07 - aa, .07 + aa, across ) ) * smoothstep( -.25, .05, run ) * ( 1.0 - smoothstep( .35, .9, aa ) );
				float share = n == 0 ? 1.0 - blend : blend;
				stroke += one * share; closed += smoothstep( .2, .8, aa ) * share;
			}
			inkLine = max( inkLine * .4, stroke );
			// A light tone under them, a shade darker toward the horizon.
			inkValueHere = mix( .62, .44, max( closed, smoothstep( 60.0, 220.0, inkDepth ) ) ) - .1 * ( 1.0 - inkKeyLit );
		}`;
export function inkMaterial(material: THREE.Material, { faces = false, local = 1, stain, water = false }: InkSurface = {}) {
  if (!INK_ON) return;
  LIGHTS_BEGIN ??= lightsBegin();
  addShaderPatch(material, `rift-ink-v6${faces ? '-faces' : ''}-${local}${stain ? '-stain' : ''}${water ? '-water' : ''}`, shader => {
    Object.assign(shader.uniforms, inkUniforms);
    if (water) shader.uniforms.uSkyTime = inkSkyUniforms.uSkyTime;
    shader.vertexShader = INK_SHIFT_PARS + (faces ? 'attribute vec2 aFace;\nvarying vec2 vInkFace;\n' : '') + (water ? 'varying vec2 vInkWorld;\n' : '') + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <project_vertex>', `#include <project_vertex>
	vInkShift = inkShift();${faces ? '\n\tvInkFace = aFace;' : ''}${water ? '\n\tvInkWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xz;' : ''}`, 'rift ink vertex');
    shader.fragmentShader = INK_PARS + (faces ? 'varying vec2 vInkFace;\n' : '') + (water ? 'varying vec2 vInkWorld;\nuniform float uSkyTime;\n' : '') + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <lights_lambert_pars_fragment>', '#include <lights_lambert_pars_fragment>\n' + INK_LIGHT_PARS, 'rift ink light model');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <lights_fragment_begin>', LIGHTS_BEGIN!, 'rift ink lights');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <lights_fragment_maps>', '', 'rift ink image light');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <opaque_fragment>', `{
		float inkDepth = vViewPosition.z;
		float inkAway = smoothstep( 26.0, 70.0, inkDepth );
		vec3 inkUp = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
		float inkSky = clamp( dot( normal, inkUp ) * .5 + .5, 0.0, 1.0 );
		// Lit by the key: paper. In its shadow but open to the sky: tone. Turned from both: ink.
		float inkLight = inkKeyLit * 1.2 + inkSky * inkSky * .38 + min( inkValue( inkOther ) * .16, .5 );
		float inkValueHere = inkTone( inkLight, diffuseColor.rgb, ${local.toFixed(2)} );
		float inkLine = ${faces ? `0.0;
		{
			vec2 f = min( vInkFace, 1.0 - vInkFace );
			vec2 px = f / max( fwidth( vInkFace ), vec2( 1e-5 ) );
			inkLine = ( 1.0 - smoothstep( uInkLine * .5, uInkLine * 1.5, min( px.x, px.y ) ) ) * ( 1.0 - inkAway * .7 );
		}` : 'inkContour( normal, normalize( vViewPosition ) ) * ( 1.0 - inkAway * .6 );'}
		vec3 inkGlow = totalEmissiveRadiance;
		${water ? WATER_STROKES : ''}
		outgoingLight = inkPage( inkValueHere, diffuseColor.rgb, inkLine, inkAway );
		${stain ? `outgoingLight = mix( outgoingLight, uInkPaper * vec3( .62, .03, .04 ) * ( .55 + .45 * inkKeyLit ), clamp( ${stain}, 0.0, 1.0 ) );` : ''}
		outgoingLight += inkGlow;
	}
#include <opaque_fragment>`, 'rift ink finish');
  });
}


const SKY_VERTEX = `
${INK_SHIFT_PARS}
varying vec3 vDir;
void main() {
	vec4 view = inverse( projectionMatrix ) * vec4( position.xy, 1.0, 1.0 );
	vDir = transpose( mat3( viewMatrix ) ) * ( view.xyz / view.w );
	vInkShift = inkShift();
	gl_Position = vec4( position.xy, .9999, 1.0 );
}`;
const SKY_FRAGMENT = `
${INK_PARS}
uniform vec2 uSkyTone;
uniform vec3 uSkyCloud;
uniform vec2 uSkyCloudOffset;
uniform float uSkyStars;
uniform vec3 uSkyDiscDir;
uniform vec4 uSkyDisc;
uniform vec3 uSkyDiscColor;
uniform vec3 uSkyHaze;
uniform float uSkyTime;
uniform vec4 uSkyFlood;
varying vec3 vDir;
float skyHash3( vec3 p ) { p = fract( p * .1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
float skyNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ); vec2 u = f * f * ( 3. - 2. * f );
	return mix( mix( inkHash( i ), inkHash( i + vec2( 1, 0 ) ), u.x ), mix( inkHash( i + vec2( 0, 1 ) ), inkHash( i + vec2( 1, 1 ) ), u.x ), u.y );
}
float skyFbm( vec2 p ) {
	float v = 0., a = .5; mat2 m = mat2( 1.6, 1.2, -1.2, 1.6 );
	for ( int i = 0; i < 4; i ++ ) { v += a * skyNoise( p ); p = m * p; a *= .5; }
	return v / .9375;
}
void main() {
	vec3 d = normalize( vDir );
	float h = d.y, up = max( h, 0. );
	// The sky's own tone: darker toward the zenith, cleared round the sun or moon.
	float tone = mix( uSkyTone.y, uSkyTone.x, smoothstep( 0., .6, up ) );
	float toSun = dot( d, uSkyDiscDir );
	float near = smoothstep( uSkyDisc.x - ( 1. - uSkyDisc.x ) * 9., uSkyDisc.x, toSun );
	tone *= 1. - uSkyDisc.y * near * uSkyDisc.w;
	float line = 0., hatch = 0.;
	// Stars: specks of bare paper in a dark sky.
	float star = 0.;
	if ( uSkyStars > 0. ) {
		vec3 p = d * 210.; float r = skyHash3( floor( p ) );
		star = step( 1. - .006 * uSkyStars, r ) * ( 1. - smoothstep( .1, .45, length( fract( p ) - .5 ) ) ) * smoothstep( .02, .2, h );
	}
	// The sun or moon: a clean disc (or, eclipsed, a black one in a ragged corona).
	float disc = smoothstep( uSkyDisc.x, uSkyDisc.x + ( 1. - uSkyDisc.x ) * .06, toSun ) * uSkyDisc.w;
	float corona = 0.;
	if ( uSkyDisc.z > .5 ) {
		float ang = atan( dot( d, normalize( cross( uSkyDiscDir, vec3( 0., 1., 0. ) ) + 1e-4 ) ), d.y - uSkyDiscDir.y * toSun );
		float rays = .4 + .6 * skyFbm( vec2( ang * 7., uSkyTime * .06 ) );
		corona = smoothstep( uSkyDisc.x - ( 1. - uSkyDisc.x ) * 3.2 * rays, uSkyDisc.x, toSun ) * ( 1. - disc );
	}
	// Clouds: flat shapes with a hard edge, a lit side and a hatched shade, an ink line where they end.
	float cover = 0., lit = 0.;
	if ( uSkyCloud.x > 0. && h > -.02 ) {
		vec2 cuv = d.xz / ( h + .12 ) * .9 + uSkyCloudOffset;
		vec2 warp = vec2( skyFbm( cuv * .45 + 3.1 ), skyFbm( cuv * .45 - 1.7 ) );
		float density = skyFbm( cuv * 1.6 + warp * 1.4 );
		float cut = 1. - uSkyCloud.x;
		float aa = max( fwidth( density ) * .9, .004 );
		cover = smoothstep( cut - aa, cut + aa, density ) * smoothstep( .015, .16, h );
		if ( cover > 0. ) {
			vec2 sunward = normalize( uSkyDiscDir.xz + 1e-4 ) * .22;
			float split = density - skyFbm( ( cuv + sunward ) * 1.6 + warp * 1.4 ) + .035;
			float litAA = max( fwidth( split ), .004 );
			lit = smoothstep( -litAA, litAA, split );
			line = ( 1. - smoothstep( aa * 1.5, aa * 3.5, abs( density - cut ) ) ) * smoothstep( .03, .2, h );
			hatch = ( 1. - lit ) * cover;
		}
	}
	float cloudTone = mix( uSkyCloud.z, uSkyCloud.y, lit );
	tone = mix( tone, cloudTone, cover );
	// An awakened boss's colour is coming over the sky: a night's black opens to tone to show it.
	tone *= 1. - .5 * uSkyFlood.w;
	// To marks: hatching in a cloud's shade, screentone elsewhere, solid where it is all but black.
	float solid = smoothstep( .86, .94, tone );
	float marks = mix( inkDots( tone * .78 ), inkHatch( tone * .9 ), hatch );
	float inked = max( max( solid, marks ), line * .9 );
	inked *= 1. - star * ( 1. - cover );
	vec3 sky = mix( mix( inkPaper(), uSkyFlood.rgb, uSkyFlood.w ), uInkDark, inked );
	float bare = ( 1. - cover * .85 );
	sky = mix( sky, uSkyDisc.z > .5 ? uInkDark : uSkyDiscColor, disc * bare );
	sky = mix( sky, uSkyDiscColor, corona * bare * uSkyDisc.z );
	sky = mix( sky, uSkyHaze, ( 1. - smoothstep( 0., .1, abs( h ) ) ) * .75 );
	if ( h < 0. ) sky = mix( sky, uSkyHaze, 1. - smoothstep( -.12, 0., h ) );
	gl_FragColor = vec4( sky, 1. );
}`;

export function inkSkyMesh(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const material = new THREE.ShaderMaterial({ name: 'RiftInkSky', uniforms: { ...inkUniforms, ...inkSkyUniforms }, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT,
    depthWrite: true, depthTest: true, depthFunc: THREE.LessEqualDepth, fog: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'rift-ink-sky'; mesh.frustumCulled = false; mesh.renderOrder = 999_999;
  return mesh;
}
