import * as THREE from 'three';
import { addShaderPatch, replaceOnce, shaderPatchKeys } from '../look/shaderPatch';

export const SKIN: Record<string, number> = { 'skin-newsprint': 1, 'skin-blueline': 2, 'skin-sumi-e': 3, 'skin-sepia': 4, 'skin-negative': 5, 'skin-blood-moon': 6, 'skin-gold-leaf': 7, 'skin-spectral': 8, 'skin-authors-hand': 9,
  'skin-living-ink': 10 };
export const ONI = 11, CELESTIAL = 12, COLOUR_PAGE = 13;
export const LIVING_STAGES = [2, 3, COLOUR_PAGE, 7] as const;
export const LIVING_AT = [0, 100, 500, 2000] as const;
export const LIVING_NAMES = ['SKETCHED', 'INKED', 'IN COLOUR', 'GILDED'] as const;
export const livingStage = (kills: number) => LIVING_AT.reduce<number>((stage, at, i) => kills >= at ? i : stage, 0);

export const skinShared = { uCosTime: { value: 0 }, uCosPitch: { value: 4.6 } };
export interface SkinUniforms { uCosSkin: { value: number }; uCosOrigin: { value: THREE.Vector3 }; uCosLive: { value: THREE.Vector4 } }
export const skinUniforms = (): SkinUniforms => ({ uCosSkin: { value: 0 }, uCosOrigin: { value: new THREE.Vector3() }, uCosLive: { value: new THREE.Vector4(2, 2, 1, 1.75) } });
export function setSkinResolution(height: number) { skinShared.uCosPitch.value = Math.max(3.2, height / 250); }

const PARS = `
uniform float uCosSkin;
uniform float uCosTime;
uniform float uCosPitch;
uniform vec3 uCosOrigin;
uniform vec4 uCosLive;
float cosLuma( vec3 c ) { return dot( c, vec3( .2126, .7152, .0722 ) ); }
float cosHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float cosNoise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
	return mix( mix( cosHash( i ), cosHash( i + vec2( 1., 0. ) ), f.x ), mix( cosHash( i + vec2( 0., 1. ) ), cosHash( i + vec2( 1., 1. ) ), f.x ), f.y );
}
// Screentone: dots on a turned grid, as large as the tone is dark.
float cosDots( float cover, float pitch ) {
	vec2 p = mat2( .7071, -.7071, .7071, .7071 ) * gl_FragCoord.xy / pitch;
	float d = length( fract( p ) - .5 ), r = sqrt( clamp( cover, 0., 1. ) ) * .6, aa = .75 / pitch;
	return ( 1. - smoothstep( r - aa, r + aa, d ) ) * step( .004, cover );
}
// Pen strokes down a diagonal (slope: how steep), as wide as the tone is dark.
float cosHatch( float cover, float pitch, float slope ) {
	float a = abs( fract( ( gl_FragCoord.x + slope * gl_FragCoord.y ) / pitch ) - .5 ) * 2.;
	float w = clamp( cover, 0., .9 ), aa = 1.5 / pitch;
	return ( 1. - smoothstep( w - aa, w + aa, a ) ) * step( .004, w );
}

// What a skin draws at one point of a fighter's body: what it is drawn from (gathered in BODY), and the skin.
struct CosAt { vec3 lit; float w; float a; float v; float fres; vec3 n; vec3 at; vec2 uv; float toon; float edge; vec3 paint; };
vec3 cosSkin( float skin, CosAt s ) {
	vec3 cosIn = s.lit, cosN = s.n, cosAt = s.at; vec2 cosUv = s.uv;
	float cosW = s.w, cosA = s.a, cosV = s.v, cosFres = s.fres, toonLit = s.toon, lookSilhouetteEdge = s.edge;
	vec3 cosOut = cosIn;
	if ( skin < 1.5 ) {
		// Newsprint: grey halftone on a greyish sheet, as a weekly prints it.
		float solid = 1. - smoothstep( .15, .21, cosV );
		float dots = cosDots( ( 1. - smoothstep( .22, .7, cosV ) ) * .6, uCosPitch );
		cosOut = mix( vec3( .84, .83, .79 ) * cosW * 1.12, vec3( .035 ), max( solid, dots ) );
	} else if ( skin < 2.5 ) {
		// Blueline: a pencil sketch in non-photo blue - strokes in the shade, a line where the form turns.
		float solid = 1. - smoothstep( .13, .2, cosV );
		float strokes = cosHatch( ( 1. - smoothstep( .2, .62, cosV ) ) * .62, uCosPitch * 1.25, 1. );
		float cross = cosHatch( ( 1. - smoothstep( .16, .36, cosV ) ) * .5, uCosPitch * 1.25, -1. );
		float line = smoothstep( .62, .8, cosFres );
		cosOut = mix( vec3( .9, .95, 1. ) * cosW * 1.12, vec3( .07, .36, .82 ) * cosW, max( max( solid, max( strokes, cross ) * .85 ), line * .75 ) );
	} else if ( skin < 3.5 ) {
		// Sumi-e: black ink and bare paper, the brush's edge uneven, a grey wash in the half-light.
		// (What the key lights is paper whatever its colour; what it does not is ink, thinned to a wash where the paint is pale.)
		float n = cosNoise( cosUv * 46. ) - .5, n2 = cosNoise( cosUv * 11. + 4. ) - .5;
		float shade = 1. - toonLit;
		float ink = max( 1. - smoothstep( .3 + n * .1, .38 + n * .1, cosA ), shade * ( 1. - smoothstep( .5 + n * .16, .62 + n * .16, cosA ) ) );
		float wash = max( shade * .55, ( 1. - smoothstep( .4, .66, cosA + n2 * .2 ) ) * .34 ) * ( .8 + .4 * n2 );
		float dry = smoothstep( .52, .8, cosFres + n * .34 );
		cosOut = mix( mix( vec3( .96, .93, .86 ) * cosW * 1.1, vec3( .2, .19, .2 ) * cosW, clamp( wash, 0., 1. ) ), vec3( .018 ), max( ink, dry * .9 ) );
	} else if ( skin < 4.5 ) {
		// Sepia: an old collected edition, its ink gone brown and its paper cream.
		float l = pow( clamp( cosLuma( cosIn ) / cosW, 0., 1.15 ), .8 );
		cosOut = mix( vec3( .1, .045, .02 ), vec3( 1., .85, .6 ), l ) * cosW * 1.08;
		cosOut *= 1. - .07 * cosHash( floor( gl_FragCoord.xy * .7 ) );
	} else if ( skin < 5.5 ) {
		// Negative: white ink on black, as a rank-S page - what was black is white, the form is a white line.
		float white = 1. - smoothstep( .15, .21, cosV );
		float dots = cosDots( ( 1. - smoothstep( .22, .7, cosV ) ) * .6, uCosPitch );
		float line = max( smoothstep( .62, .8, cosFres ), lookSilhouetteEdge );
		cosOut = mix( vec3( .012 ), vec3( 1., .98, .94 ) * cosW * 1.25, max( max( white, dots ), line ) );
	} else if ( skin < 6.5 ) {
		// Blood Moon: black and one red.
		float black = 1. - smoothstep( .2, .3, cosV );
		float dots = cosDots( ( 1. - smoothstep( .3, .64, cosV ) ) * .55, uCosPitch );
		cosOut = mix( vec3( .82, .03, .045 ) * cosW * 1.4, vec3( .012 ), max( black, dots ) );
		cosOut += vec3( 1., .12, .08 ) * lookSilhouetteEdge * .55;
	} else if ( skin < 7.5 ) {
		// Gold Leaf: black lacquer where the light does not reach, gold leaf where it does, and a sheen that travels.
		vec3 gold = vec3( 1., .7, .2 ), deep = vec3( .42, .22, .03 );
		float facing = dot( cosN, normalize( vec3( .35, .55, .75 ) ) );
		float leaf = smoothstep( .33, .45, cosV + ( cosNoise( cosUv * 30. ) - .5 ) * .08 );
		float band = pow( max( 0., sin( cosAt.y * 2.6 + cosN.x * 1.8 - uCosTime * 1.5 ) ), 14. );
		vec3 leafed = mix( deep, gold, smoothstep( .15, .95, toonLit * .55 + facing * .5 + cosNoise( cosUv * 90. ) * .16 ) ) * cosW * 1.3 + gold * band * 1.1;
		vec3 lacquer = vec3( .016, .013, .013 ) + vec3( 1., .95, .85 ) * pow( max( 0., facing ), 26. ) * .5 + gold * band * .12;
		cosOut = mix( lacquer, leafed, leaf ) + gold * lookSilhouetteEdge * .7;
	} else if ( skin < 8.5 ) {
		// Spectral: a spirit - pale blue, brightest where it turns from the eye, its edges burning off upward.
		float fire = cosNoise( vec2( ( cosAt.x + cosAt.z ) * 5., cosAt.y * 4. - uCosTime * 2.4 ) );
		float flicker = .86 + .14 * sin( uCosTime * 9. + cosAt.y * 13. );
		float rim = smoothstep( .3, .95, cosFres );
		vec3 core = mix( vec3( .03, .09, .2 ), vec3( .3, .62, .95 ), cosV ) * ( .7 + .5 * fire );
		cosOut = ( core + vec3( .62, .9, 1. ) * rim * ( 1.1 + 1.7 * fire ) ) * cosW * 1.3 * flicker;
	} else if ( skin < 9.5 ) {
		// The Author's Hand: an unfinished drawing, redrawn every few frames - a pencil's line, hatching
		// that changes its mind, and the construction lines still under it in blue.
		float beat = floor( uCosTime * 7. );
		vec2 jolt = vec2( cosHash( vec2( beat, 1. ) ), cosHash( vec2( beat, 7. ) ) ) - .5;
		float wobble = cosNoise( gl_FragCoord.xy * .07 + jolt * 50. );
		float line = smoothstep( .4 + wobble * .16, .56 + wobble * .16, cosFres );
		float dark = 1. - smoothstep( .16, .24, cosA );
		float tone = 1. - smoothstep( .24, .66, cosA );
		float slope = mix( .55, 1.7, cosHash( vec2( beat, 3. ) ) );
		float hatch = max( cosHatch( max( ( 1. - toonLit ) * .5, tone * .74 ), uCosPitch * 1.5, slope ), cosHatch( tone * tone * .8, uCosPitch * 1.5, -slope ) );
		float rings = 1. - smoothstep( .014, .034, abs( fract( cosAt.y * 3.4 + jolt.x * .04 ) - .5 ) );
		float volume = 1. - smoothstep( .012, .03, abs( cosFres - .3 - jolt.y * .05 ) );
		vec3 sheet = vec3( .97, .96, .93 ) * cosW * 1.12;
		sheet = mix( sheet, vec3( .16, .52, .95 ) * cosW, max( rings, volume ) * .7 * ( 1. - dark ) );
		cosOut = mix( sheet, vec3( .055, .055, .065 ), max( max( line, dark * ( .78 + .22 * wobble ) ), hatch * .8 ) );
	} else if ( skin < 11.5 ) {
		// Oni (a form): black lacquer, red only where it faces the light, and magma in its cracks - a demon's
		// hide, glowing where it splits - with a rim of fire that climbs.
		float n = cosNoise( cosUv * 24. ) - .5;
		float facing = dot( cosN, normalize( vec3( .35, .55, .75 ) ) );
		float red = smoothstep( .45, .7, facing * .75 + cosV * .35 + n * .1 ) * toonLit;
		vec3 lacquer = mix( vec3( .018, .006, .006 ), vec3( .72, .04, .02 ) * cosW * 1.15, red );
		float gloss = pow( max( 0., facing ), 30. ) * .55;
		float split = 1. - smoothstep( .0, .028, abs( cosNoise( cosUv * 7. + 5. ) - .5 ) );
		float pulse = .75 + .25 * sin( uCosTime * 4. + cosAt.y * 3. );
		float heat = cosNoise( vec2( ( cosAt.x + cosAt.z ) * 4., cosAt.y * 3. - uCosTime * 3.2 ) );
		float rim = smoothstep( .55, .95, cosFres ) * ( .4 + .9 * heat );
		cosOut = lacquer + vec3( 1., .8, .7 ) * gloss + vec3( 1., .38, .05 ) * split * 1.6 * pulse * ( 1. - red * .6 ) + vec3( 1., .3, .04 ) * rim * 1.3 + vec3( 1., .25, .04 ) * lookSilhouetteEdge * .6;
	} else if ( skin < 12.5 ) {
		// Celestial (a form): blue-and-white porcelain - white where the light lands, cobalt washed into the shade -
		// veined with gold where it was mended, and lit at its edges.
		float n = cosNoise( cosUv * 11. + 4. ) - .5;
		float wash = 1. - smoothstep( .38, .7, cosV * .75 + toonLit * .4 + n * .14 );
		vec3 porcelain = mix( vec3( .97, .97, .95 ) * cosW * 1.12, vec3( .07, .2, .62 ) * cosW, wash * .92 );
		float vein = 1. - smoothstep( .0, .038, abs( cosNoise( cosUv * 6. + 3. ) - .5 ) );
		float vein2 = 1. - smoothstep( .0, .02, abs( cosNoise( cosUv * 15. + 11. ) - .5 ) );
		float band = pow( max( 0., sin( cosAt.y * 3.1 - uCosTime * 1.8 ) ), 10. );
		vec3 gold = vec3( .92, .62, .12 ) * cosW * ( 1.15 + band * .9 );
		cosOut = mix( porcelain, gold, max( vein, vein2 * .75 ) ) + vec3( 1., .86, .5 ) * smoothstep( .6, .95, cosFres ) * .45;
		cosOut = mix( cosOut, vec3( .04, .1, .32 ), smoothstep( .72, .9, cosFres ) * .6 );
	} else {
		// A colour page (Living Ink's third stage), printed as the old four-colour comics were: the fighter's own
		// colours flat and loud in the light, as dots of themselves on bare paper in the half-light, solid black
		// in the shade and a heavy black line where the form turns.
		float l = cosLuma( s.paint );
		vec3 paint = clamp( mix( vec3( l ), s.paint, 1.7 ) * 1.2, 0., 1. ) * cosW * 1.06;
		float tone = 1. - smoothstep( .3, .75, cosV );
		float dots = cosDots( tone * .75, uCosPitch * 1.35 );
		float solid = 1. - smoothstep( .1, .16, cosV ), line = smoothstep( .6, .78, cosFres );
		cosOut = mix( paint, mix( vec3( .97, .96, .92 ) * cosW * 1.1, paint * .9, dots ), smoothstep( .12, .45, tone ) );
		cosOut = mix( cosOut, vec3( .03 ), max( solid, line * .92 ) );
	}
	return cosOut;
}
`;

const BODY = `
if ( uCosSkin > .5 ) {
	vec3 cosIn = gl_FragColor.rgb;
	// The fighter's own white (their light's soft ceiling), and what the surface is: how light it is painted,
	// taken down where the key does not reach - less so on a face, which a page leaves clean.
	float cosW = uToonClip.y;
	float cosPaint = cosLuma( diffuseColor.rgb );
	#ifdef USE_MAP
	// (Near black a texel is no evidence - the sources were block-compressed - so a dark one is read from the cloth round it.)
	cosPaint = mix( cosLuma( texture2D( map, vMapUv, 3. ).rgb * diffuse ), cosPaint, smoothstep( .03, .12, cosPaint ) );
	#endif
	float cosA = pow( clamp( cosPaint, 0., 1. ), .5 );
	float cosV = cosA * mix( mix( .5, .8, vLookHead ), 1., toonLit );
	vec3 cosN = normalize( normal ), cosE = normalize( vViewPosition );
	float cosFres = 1. - abs( dot( cosN, cosE ) );
	vec3 cosAt = vLookWorld - uCosOrigin;
	#ifdef USE_MAP
	vec2 cosUv = vMapUv;
	#else
	vec2 cosUv = cosAt.xy;
	#endif
	CosAt cosS = CosAt( cosIn, cosW, cosA, cosV, cosFres, cosN, cosAt, cosUv, toonLit, lookSilhouetteEdge, diffuseColor.rgb );
	vec3 cosOut;
	if ( uCosSkin > 9.5 && uCosSkin < 10.5 ) {
		// Living Ink: the stage it has reached - and while it changes, the next climbing the body from the feet behind a line of ink.
		cosOut = cosSkin( uCosLive.y, cosS );
		if ( uCosLive.z < .999 ) {
			float front = uCosLive.z * uCosLive.w * 1.15 - .05;
			float h = cosAt.y + ( cosNoise( cosUv * 9. + uCosTime * 2. ) - .5 ) * .14;
			cosOut = mix( cosSkin( uCosLive.x, cosS ), cosOut, 1. - smoothstep( front - .02, front + .02, h ) );
			cosOut = mix( cosOut, vec3( .02 ), 1. - smoothstep( .015, .05, abs( h - front ) ) );
		}
	} else cosOut = cosSkin( uCosSkin, cosS );
	// What the fight itself lights on a fighter (a blow's flash, an awakening's glow) still shows.
	gl_FragColor.rgb = cosOut + totalEmissiveRadiance;
}
`;

const OUTLINE = `
if ( uCosSkin > .5 ) {
	float cosLineSkin = uCosSkin > 9.5 && uCosSkin < 10.5 ? uCosLive.y : uCosSkin;
	vec3 cosLine = gl_FragColor.rgb;
	if ( cosLineSkin < 1.5 ) cosLine = vec3( .03 );
	else if ( cosLineSkin < 2.5 ) cosLine = vec3( .05, .27, .62 );
	else if ( cosLineSkin < 3.5 ) cosLine = vec3( .016 );
	else if ( cosLineSkin < 4.5 ) cosLine = vec3( .07, .03, .012 );
	else if ( cosLineSkin < 5.5 ) cosLine = vec3( .92, .9, .86 );
	else if ( cosLineSkin < 6.5 ) cosLine = vec3( .012 );
	else if ( cosLineSkin < 7.5 ) cosLine = vec3( .5, .3, .04 );
	else if ( cosLineSkin < 8.5 ) cosLine = vec3( .5, .85, 1. ) * ( 1.3 + .5 * sin( uCosTime * 9. ) );
	else if ( cosLineSkin < 9.5 ) cosLine = vec3( .1, .1, .12 );
	else if ( cosLineSkin < 11.5 ) cosLine = vec3( .9, .22, .03 ) * ( 1.2 + .4 * sin( uCosTime * 11. ) );
	else if ( cosLineSkin < 12.5 ) cosLine = vec3( .03, .08, .3 );
	else cosLine = vec3( .02 );
	gl_FragColor.rgb = cosLine;
}
`;

function part(material: THREE.Material): 'body' | 'outline' | undefined {
  const keys = shaderPatchKeys(material);
  if (keys.some(key => key.startsWith('look-toon-'))) return 'body';
  if (keys.some(key => key.startsWith('look-ink-') || key.startsWith('look-authored-ink-'))) return 'outline';
  return undefined;
}

export function skinMaterial(material: THREE.Material, uniforms: SkinUniforms): boolean {
  const kind = part(material);
  if (!kind) return false;
  addShaderPatch(material, `cosmetic-skin-${kind}-v2`, shader => {
    Object.assign(shader.uniforms, skinShared, uniforms);
    shader.fragmentShader = PARS + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <tonemapping_fragment>', `${kind === 'body' ? BODY : OUTLINE}\n#include <tonemapping_fragment>`, 'cosmetic skin');
  });
  return true;
}
