import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import type { GradeLook, LookPreset } from './stageLooks';

const VERTEX = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;

export class LookBloom {
  strength = .6; radius = .55; threshold = 1.25; knee = .45;
  active: number;
  private readonly down: THREE.WebGLRenderTarget[] = [];
  private readonly up: THREE.WebGLRenderTarget[] = [];
  private readonly quad = new FullScreenQuad();
  private readonly prefilter: THREE.ShaderMaterial;
  private readonly downsample: THREE.ShaderMaterial;
  private readonly upsample: THREE.ShaderMaterial;
  constructor(readonly levels = 5) {
    this.active = levels;
    const target = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter });
    for (let i = 0; i < this.levels; i++) this.down.push(target());
    for (let i = 0; i < this.levels - 1; i++) this.up.push(target());
    this.prefilter = new THREE.ShaderMaterial({
      uniforms: { tInput: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: .5 } },
      vertexShader: VERTEX, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tInput;uniform vec2 uTexel;uniform float uThreshold;uniform float uKnee;varying vec2 vUv;
        vec3 tap(vec2 o){vec3 c=texture2D(tInput,vUv+o*uTexel).rgb;c=min(c,vec3(64.));float br=max(c.r,max(c.g,c.b));
          float soft=clamp(br-uThreshold+uKnee,0.,2.*uKnee);soft=soft*soft/(4.*uKnee+1e-4);
          float w=max(soft,br-uThreshold)/max(br,1e-4);c*=w;return c/(1.+dot(c,vec3(.2126,.7152,.0722)));}
        void main(){vec3 s=tap(vec2(-1.,-1.))+tap(vec2(1.,-1.))+tap(vec2(-1.,1.))+tap(vec2(1.,1.));s*=.25;
          gl_FragColor=vec4(s/max(1.-dot(s,vec3(.2126,.7152,.0722)),.02),1.);}`,
    });
    this.downsample = new THREE.ShaderMaterial({
      uniforms: { tInput: { value: null }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: VERTEX, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tInput;uniform vec2 uTexel;varying vec2 vUv;
        void main(){vec2 h=uTexel;vec3 s=texture2D(tInput,vUv).rgb*4.;s+=texture2D(tInput,vUv-h).rgb;s+=texture2D(tInput,vUv+h).rgb;
          s+=texture2D(tInput,vUv+vec2(h.x,-h.y)).rgb;s+=texture2D(tInput,vUv-vec2(h.x,-h.y)).rgb;gl_FragColor=vec4(s*.125,1.);}`,
    });
    this.upsample = new THREE.ShaderMaterial({
      uniforms: { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: .6 } },
      vertexShader: VERTEX, depthTest: false, depthWrite: false,
      fragmentShader: `uniform sampler2D tLow;uniform sampler2D tHigh;uniform vec2 uTexel;uniform float uRadius;varying vec2 vUv;
        void main(){vec2 h=uTexel;vec3 s=texture2D(tLow,vUv+vec2(-2.*h.x,0.)).rgb+texture2D(tLow,vUv+vec2(2.*h.x,0.)).rgb
          +texture2D(tLow,vUv+vec2(0.,2.*h.y)).rgb+texture2D(tLow,vUv+vec2(0.,-2.*h.y)).rgb
          +2.*(texture2D(tLow,vUv+h).rgb+texture2D(tLow,vUv-h).rgb+texture2D(tLow,vUv+vec2(h.x,-h.y)).rgb+texture2D(tLow,vUv+vec2(-h.x,h.y)).rgb);
          gl_FragColor=vec4(texture2D(tHigh,vUv).rgb+s/12.*uRadius,1.);}`,
    });
  }
  get texture() { return this.up[0].texture; }
  setSize(width: number, height: number) {
    for (let i = 0; i < this.levels; i++) this.down[i].setSize(Math.max(1, width >> (i + 1)), Math.max(1, height >> (i + 1)));
    for (let i = 0; i < this.levels - 1; i++) this.up[i].setSize(Math.max(1, width >> (i + 1)), Math.max(1, height >> (i + 1)));
  }
  render(renderer: THREE.WebGLRenderer, input: THREE.Texture, width: number, height: number) {
    const p = this.prefilter.uniforms;
    p.tInput.value = input; p.uTexel.value.set(1 / width, 1 / height); p.uThreshold.value = this.threshold; p.uKnee.value = Math.max(.01, this.knee);
    this.pass(renderer, this.prefilter, this.down[0]);
    const levels = Math.max(2, Math.min(this.levels, this.active));
    for (let i = 1; i < levels; i++) {
      const source = this.down[i - 1];
      this.downsample.uniforms.tInput.value = source.texture;
      this.downsample.uniforms.uTexel.value.set(1 / source.width, 1 / source.height);
      this.pass(renderer, this.downsample, this.down[i]);
    }
    for (let i = levels - 2; i >= 0; i--) {
      const low = i === levels - 2 ? this.down[levels - 1] : this.up[i + 1];
      const u = this.upsample.uniforms;
      u.tLow.value = low.texture; u.tHigh.value = this.down[i].texture; u.uRadius.value = this.radius;
      u.uTexel.value.set(.5 / low.width, .5 / low.height);
      this.pass(renderer, this.upsample, this.up[i]);
    }
  }
  private pass(renderer: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    this.quad.render(renderer);
  }
  dispose() {
    for (const t of [...this.down, ...this.up]) t.dispose();
    this.prefilter.dispose(); this.downsample.dispose(); this.upsample.dispose(); this.quad.dispose();
  }
}

export class LookBloomPass extends Pass {
  readonly bloom = new LookBloom();
  private width = 1; private height = 1;
  constructor() { super(); this.needsSwap = false; }
  setSize(width: number, height: number) { this.width = width; this.height = height; this.bloom.setSize(width, height); }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    this.bloom.render(renderer, read.texture, this.width, this.height);
  }
  dispose() { this.bloom.dispose(); }
}

export const focusUniforms = {
  tDepth: { value: null as THREE.Texture | null },
  uClip: { value: new THREE.Vector2(.1, 400) },
  uFocus: { value: new THREE.Vector4(2, 14, 40, .8) },
  uProj: { value: new THREE.Vector2(1, 1) },
  uViewToWorld: { value: new THREE.Matrix4() },
  uUpView: { value: new THREE.Vector3(0, 1, 0) },
  uPool: { value: new THREE.Vector4(0, 0, 4, 12) },
};
const FOCUS_GLSL = `
uniform sampler2D tDepth;
uniform vec2 uClip;
uniform vec4 uFocus;
uniform vec2 uProj;
uniform mat4 uViewToWorld;
uniform vec3 uUpView;
uniform vec4 uPool;
float lookViewZ( float d ) { return uClip.x * uClip.y / max( uClip.y - ( uClip.y - uClip.x ) * d, 1e-5 ); }
float lookFarness( float z ) { return smoothstep( uFocus.y, uFocus.z, z ); }
float lookNearness( float z ) { return 1. - smoothstep( uFocus.w, uFocus.x * .9, z ); }
`;

const TONE_MAPS = { neutral: 0, aces: 1, agx: 2 } as const;

const FINAL_FRAGMENT = `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uHasBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform int uToneMap;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uSplit;
uniform float uShadowDesat;
uniform float uToe;
uniform float uVignette;
uniform float uSharpen;
uniform vec3 uVignetteColor;
uniform vec2 uCenter;
uniform float uPunch;
uniform float uCinema;
uniform float uChroma;
uniform float uSpeed;
uniform vec3 uSpeedColor;
uniform float uSeed;
uniform float uImpact;
uniform vec2 uImpactCenter;
uniform float uTech;
uniform vec3 uTechColor;
uniform float uTechLocal;
uniform vec2 uTechFocus;
uniform float uTechRadius;
uniform float uStop;
uniform vec3 uStopDark;
uniform vec3 uStopLight;
uniform float uBlur;
uniform vec2 uBlurCenter;
uniform vec4 uBlurKeep[2];
// The anime finish (look/sparkingLook.ts): its glow (the bloom's pyramid) and its strengths.
uniform sampler2D tGlow;
uniform float uHasFinish;
uniform float uAnime;
uniform vec4 uFinishA;
uniform vec4 uFinishB;
uniform vec4 uHaze;
uniform vec3 uAnimeShadow;
uniform vec3 uAnimeLift;
uniform vec3 uAnimeWarm;
uniform float uAnimeVignette;
uniform float uWrapPx;
${FOCUS_GLSL}
varying vec2 vUv;
#include <tonemapping_pars_fragment>
float hash11( float p ) { p = fract( p * .1031 ); p *= p + 33.33; p *= p + p; return fract( p ); }
float hash12( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float luma( vec3 c ) { return dot( c, vec3( .2126, .7152, .0722 ) ); }
/** Khronos PBR Neutral with an adjustable toe. The stock toe subtracts up to
 *  0.04 from every channel of the darkest colours, which is what crushed a
 *  black coat's shadow side to zero; uToe scales that offset (1 = stock). */
vec3 lookNeutral( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset * uToe;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 softLight( vec3 b, vec3 s ) {
	return mix( 2. * b * s + b * b * ( 1. - 2. * s ), sqrt( b ) * ( 2. * s - 1. ) + 2. * b * ( 1. - s ), step( .5, s ) );
}
/** Tapered anime lines converging on a centre: a hundred-odd angular slots,
 *  each holding a line or not, starting at a random radius and thickening
 *  toward the edge of the frame. The seed re-deals them a few times a second,
 *  the way hand-drawn lines boil. */
float speedPattern( vec2 d, float seed, float amount, float reach ) {
	float r = length( d );
	float a = atan( d.y, d.x ) * .15915494 + .5;
	float slots = 120.;
	float cell = floor( a * slots );
	float f = fract( a * slots );
	float h1 = hash11( cell * 1.37 + seed * 17.1 );
	float h2 = hash11( cell * 2.91 + seed * 5.3 + 1.7 );
	float h3 = hash11( cell * .73 + seed * 9.7 + 3.1 );
	float present = step( 1. - ( .3 + .5 * amount ), h1 );
	float inner = mix( reach, reach + .38, h2 );
	float t = smoothstep( inner, inner + .5, r );
	float w = mix( .1, .42, h3 ) * t;
	float aa = min( fwidth( a * slots ) * 1.5, .5 );
	return ( 1. - smoothstep( w - aa, w + aa, abs( f - .5 ) * 2. ) ) * present * t;
}
void main() {
	vec2 uv = vUv;
	vec2 aspect = vec2( uResolution.x / max( uResolution.y, 1. ), 1. );
	vec2 fromCenter = uv - uCenter;
	float r = length( fromCenter * aspect );
	vec3 c;
	// The anime finish keeps a fringe of its own toward the frame's edges (uFinishB.w px), under a hit's pulse.
	float chromaPx = uChroma + uAnime * uFinishB.w;
	if ( chromaPx > .0005 ) {
		// uChroma is the fringe in pixels: none around the centre of action,
		// so the fighters stay clean, and never more than two at the edges.
		vec2 dir = fromCenter / max( length( fromCenter ), 1e-4 );
		vec2 fringe = dir * min( chromaPx, 2.5 ) * smoothstep( .15, .7, r ) / max( uResolution, vec2( 1. ) );
		c = vec3( texture2D( tScene, uv + fringe ).r, texture2D( tScene, uv ).g, texture2D( tScene, uv - fringe ).b );
	} else {
		c = texture2D( tScene, uv ).rgb;
	}
	if ( uSharpen > .0005 ) {
		// The Sparking pass: a light sharpen (look.grade.sharpen). A frame drawn under the screen's resolution comes back
		// to the crisp edge the reference has - least where the contrast is high already (an outline), so it never rings.
		vec2 px = 1. / max( uResolution, vec2( 1. ) );
		vec3 sn = texture2D( tScene, uv + vec2( 0., px.y ) ).rgb, ss = texture2D( tScene, uv - vec2( 0., px.y ) ).rgb;
		vec3 se = texture2D( tScene, uv + vec2( px.x, 0. ) ).rgb, sw = texture2D( tScene, uv - vec2( px.x, 0. ) ).rgb;
		float lo = min( min( luma( sn ), luma( ss ) ), min( luma( se ), luma( sw ) ) ), hi = max( max( luma( sn ), luma( ss ) ), max( luma( se ), luma( sw ) ) );
		float amount = uSharpen * ( 1. - smoothstep( .15, .6, ( hi - lo ) / max( hi, .05 ) ) );
		c = max( c + ( c - ( sn + ss + se + sw ) * .25 ) * amount, 0. );
	}
	if ( uBlur > .0005 ) {
		// The Rise of a Ninja pass: a big blow throws the room behind the pair
		// into a zoom blur toward the blow for a few frames - the reference does
		// it on every heavy hit - while the two fighters stay sharp: each is
		// kept inside a soft ellipse round their drawn body (uBlurKeep: centre
		// and radii in uv), which is what the old full-frame radial blur, taken
		// out for smearing whole frames, never did.
		float keep = 0.;
		for ( int i = 0; i < 2; i ++ ) {
			vec4 k = uBlurKeep[ i ];
			if ( k.z > 0. ) keep = max( keep, 1. - smoothstep( .78, 1.18, length( ( uv - k.xy ) / k.zw ) ) );
		}
		float amount = uBlur * ( 1. - keep );
		if ( amount > .002 ) {
			vec2 toward = uBlurCenter - uv;
			vec3 sum = vec3( 0. ); float weight = 0.;
			for ( int i = 0; i < 12; i ++ ) {
				float f = float( i ) / 11., w = 1. - .55 * f;
				sum += texture2D( tScene, uv + toward * f * amount * .17 ).rgb * w; weight += w;
			}
			c = mix( c, sum / weight, min( 1., amount * 1.5 ) );
		}
	}
	// The scene's own luminance, before anything below changes it. A fighter
	// drawn as a silhouette is exactly black, and nothing else in a lit room
	// is: this is the key that keeps silhouettes ink while the world is
	// repainted around them.
	float ink = 1. - smoothstep( .0015, .02, luma( c ) );
	// How far behind the fight a pixel is (0 in the focus band .. 1 the far blur's whole): the grade below gives the
	// background less contrast and colour than the fighters, as a compositor flattens a background painting.
	float lookBg = 0.;
	if ( uAnime > .0005 ) {
		// The anime finish's background, pushed back (sparkingLook.ts) - never blurred: the bright background wrapped onto
		// the fighters' edges, the air far behind them and the ground outside the fight darkened, all keyed on the depth,
		// so the fighters themselves are left alone.
		float sceneD = texture2D( tDepth, uv ).r, z = lookViewZ( sceneD );
		lookBg = lookFarness( z );
		float inBand = ( 1. - lookFarness( z ) ) * ( 1. - lookNearness( z ) );
		if ( uHasFinish > .5 && uFinishA.y > .0005 && inBand > .02 ) {
			vec2 o = uWrapPx / max( uResolution, vec2( 1. ) );
			float behind = 0., far = z * 1.3 + .8;
			behind += step( far, lookViewZ( texture2D( tDepth, uv + vec2( o.x, 0. ) ).r ) ) + step( far, lookViewZ( texture2D( tDepth, uv - vec2( o.x, 0. ) ).r ) );
			behind += step( far, lookViewZ( texture2D( tDepth, uv + vec2( 0., o.y ) ).r ) ) + step( far, lookViewZ( texture2D( tDepth, uv - vec2( 0., o.y ) ).r ) );
			c += texture2D( tGlow, uv ).rgb * behind * .25 * inBand * uFinishA.y * uAnime;
		}
		float haze = uFinishA.z * smoothstep( uFocus.z, uFocus.z + uHaze.w, z ) * mix( 1., .3, step( .99999, sceneD ) );
		c = mix( c, uHaze.rgb, haze * uAnime );
		// The ground outside the pool of light the fight stands in goes darker, the more so toward the bottom of the
		// frame: the surface's facing comes from the depth's own slope, where it is from the pixel's world position.
		vec3 viewP = vec3( ( uv * 2. - 1. ) * uProj * z, - z );
		float ground = smoothstep( .75, .92, abs( dot( normalize( cross( dFdx( viewP ), dFdy( viewP ) ) ), uUpView ) ) );
		vec3 worldP = ( uViewToWorld * vec4( viewP, 1. ) ).xyz;
		ground *= smoothstep( uPool.z, uPool.w, length( worldP.xz - uPool.xy ) ) * ( 1. - step( .99999, sceneD ) );
		c *= 1. - uFinishA.w * ground * ( .45 + .55 * ( 1. - smoothstep( 0., .6, uv.y ) ) ) * uAnime;
	}
	// Round 3c: an ordinary special's grade is local - a pool round the
	// technique that falls off across the frame - so the rest of a crowd keeps
	// its own colours ("the whole crowd flattened into one hue"); ultimates
	// and stopped time still take the whole frame (uTechLocal 0).
	float techK = uTech;
	if ( uTechLocal > .0005 ) {
		float techR = length( ( uv - uTechFocus ) * aspect );
		techK *= mix( 1., 1. - smoothstep( uTechRadius, uTechRadius * 2.2 + .05, techR ), uTechLocal );
	}
	if ( techK > .0005 ) {
		// A technique's grade: the room drained of colour, dimmed by up to a
		// half and pushed toward the technique's hue, so the technique is the
		// brightest and most saturated thing on screen. Its own hot core -
		// the effects put theirs at 1.5-3 - keeps its light.
		float l = luma( c );
		float energy = smoothstep( .85, 1.9, max( c.r, max( c.g, c.b ) ) );
		// A local pool drains less: it tints the caster's corner of the fight
		// rather than printing it monochrome.
		vec3 room = mix( c, vec3( l ), mix( .6, .32, uTechLocal ) * techK );
		room = mix( room, l * uTechColor, mix( .4, .26, uTechLocal ) * techK );
		room *= 1. - .5 * techK;
		c = mix( room, c, energy );
	}
	if ( uHasBloom > .5 ) c += texture2D( tBloom, uv ).rgb * uBloom * ( 1. + .5 * techK );
	if ( uToneMap == 1 ) c = ACESFilmicToneMapping( c );
	else if ( uToneMap == 2 ) c = AgXToneMapping( c );
	else c = lookNeutral( c );
	c = sRGBTransferOETF( vec4( clamp( c, 0., 1. ), 1. ) ).rgb;
	// The grade, in display space where lift, gamma and gain mean what a
	// colourist means by them.
	c = pow( max( c * uGain + uLift * ( 1. - c ), 0. ), 1. / uGamma );
	c = ( c - .46 ) * uContrast + .46;
	// A shoulder instead of a clip: the contrast used to push everything past
	// 0.93 straight to white, which is where white armour and the lit floor
	// lost their detail.
	c = min( c, .8 ) + .2 * ( 1. - exp( - max( c - .8, 0. ) / .2 ) );
	c = max( c, 0. );
	float l = luma( c );
	// Saturation is taken out of the darks before the split tone paints them
	// violet, so shade reads as coloured shade (the concepts' sits near 0.3
	// saturation), while the mids and highs get the vibrance - so a gi in
	// half light stays orange.
	float dark = 1. - smoothstep( .1, .38, l );
	c = max( mix( vec3( l ), c, uSaturation * ( 1. - uShadowDesat * dark ) ), 0. );
	// The split tone only tints the ends: violet in the darks, the warm tint
	// in the highlights, nothing in the mids, where skin in half light went
	// mauve under a tint that ran all the way through.
	vec3 tone = mix( mix( uShadowTint, vec3( .5 ), smoothstep( .12, .42, l ) ), uHighlightTint, smoothstep( .58, .92, l ) );
	c = mix( c, softLight( clamp( c, 0., 1. ), tone ), uSplit );
	vec2 v = ( uv - .5 ) * aspect;
	if ( uAnime > .0005 ) {
		// The anime finish's diffusion: the bright half of the frame, blurred wide, screened over it.
		if ( uHasFinish > .5 ) {
			vec3 glow = 1. - exp( - texture2D( tGlow, uv ).rgb * uFinishA.x );
			c = 1. - ( 1. - clamp( c, 0., 1. ) ) * ( 1. - glow * uAnime );
		}
		// Its grade: an S-curve, the darks deep blue-violet, the highlights warm and the mids rich.
		vec3 g = clamp( c, 0., 1. );
		g += uFinishB.x * ( 1. - .45 * lookBg ) * g * ( 1. - g ) * ( 2. * g - 1. );
		float lg = luma( g );
		g = mix( g, g * uAnimeShadow + uAnimeLift, 1. - smoothstep( .03, .45, lg ) );
		g = mix( g, g * uAnimeWarm, smoothstep( .55, .95, lg ) );
		float chromaG = max( g.r, max( g.g, g.b ) ) - min( g.r, min( g.g, g.b ) );
		g = max( mix( vec3( lg ), g, 1. + uFinishB.y * ( 1. - abs( lg - .5 ) * 2. ) * ( 1. - chromaG ) - .12 * lookBg ), 0. );
		c = mix( c, g, uAnime );
		c *= 1. - uAnimeVignette * uAnime * smoothstep( .35, 1.15, length( v ) );
	}
	float vig = smoothstep( .38, 1.05, length( v ) * 1.08 ) * uVignette;
	c = c * ( 1. - vig ) + uVignetteColor * vig * .4;
	if ( uCinema > .0005 ) {
		// An ultimate's cinema (render/FinisherCuts.ts): the contrast pushed round the middle grey, the room a little
		// drained and an ink vignette closing in from the corners - punched in on the moment, held lighter between.
		c = clamp( ( c - .5 ) * ( 1. + .3 * uCinema ) + .5, 0., 1. );
		c = mix( c, vec3( luma( c ) ), .2 * uCinema );
		c *= 1. - smoothstep( .32, 1.02, length( v ) * 1.12 ) * .72 * uCinema;
	}
	if ( uStop > .0005 ) {
		// Stopped time: the world as a two-tone cyan print, its range held
		// between a mid teal and a pale cyan so it never blows out or goes
		// black - and the fighters, drawn as black ink with a white edge, the
		// only black on screen. A sliver of the world's own colour survives,
		// so it is still the same room.
		float w = luma( c );
		vec3 world = mix( uStopDark, uStopLight, smoothstep( .02, .95, w ) );
		world = mix( world, c, .1 ) * ( 1. - ink );
		c = mix( c, world, uStop );
	}
	if ( uPunch > .0005 ) {
		// A hit on you: the frame bites - it drains a little colour, darkens
		// at the edges and throws ink lines at the blow - but never lifts or
		// blurs, so a rush string cannot strobe or smear.
		c = mix( c, vec3( luma( c ) ), uPunch * .3 );
		c *= 1. - smoothstep( .25, .85, r * 1.2 ) * uPunch * .35;
		c = mix( c, vec3( .02, .025, .035 ), speedPattern( fromCenter * aspect, uSeed + 7., 1., .3 ) * uPunch * .45 );
	}
	if ( uSpeed > .0005 ) c = mix( c, uSpeedColor, speedPattern( fromCenter * aspect, uSeed, uSpeed, .32 ) * min( 1., uSpeed * 1.4 ) * .78 );
	if ( uImpact > .0005 ) {
		// The impact frame, always on paper: the fighters are solid ink (they
		// draw themselves black for it), the world is paper with screentone
		// dots in its shade - the one place the halftone belongs - and radial
		// lines are thrown out from the blow. The dots never close into solid
		// black, so however dark the room the silhouettes read.
		float lum = luma( c );
		float pitch = max( 3., uResolution.y / 190. );
		vec2 cellUv = mat2( .7071, -.7071, .7071, .7071 ) * gl_FragCoord.xy / pitch;
		float dotR = length( fract( cellUv ) - .5 );
		float shade = 1. - smoothstep( .05, .34, lum );
		float dots = step( dotR, .34 * shade ) * step( .08, shade );
		float inked = max( max( ink, dots ), speedPattern( ( uv - uImpactCenter ) * aspect, uSeed * 3.7 + 11., 1., .12 ) );
		vec3 paperColor = vec3( .97, .94, .87 ), inkColor = vec3( .03, .028, .04 );
		c = mix( c, mix( paperColor, inkColor, inked ), uImpact );
	}
	// Half a code value of noise so the painted sky's long gradients do not
	// band in 8 bits; invisible at any viewing distance.
	if ( uAnime > .0005 ) {
		// Film grain, re-dealt 24 times a second: two hashes summed (a soft, triangular spread), most in the mids.
		float grainSeed = floor( uTime * 24. );
		float n = hash12( gl_FragCoord.xy + fract( grainSeed * .618034 ) * 1013. ) + hash12( gl_FragCoord.xy * 1.37 + fract( grainSeed * .754878 ) * 997. ) - 1.;
		c += n * uFinishB.z * uAnime * ( .4 + .6 * ( 1. - abs( luma( c ) - .45 ) * 1.6 ) );
	}
	c += ( hash12( gl_FragCoord.xy + fract( uTime * 7.13 ) * 97. ) - .5 ) / 255.;
	gl_FragColor = vec4( c, 1. );
}`;

export class LookFinalPass extends Pass {
  readonly uniforms = {
    tScene: { value: null as THREE.Texture | null },
    tBloom: { value: null as THREE.Texture | null },
    uBloom: { value: .6 }, uHasBloom: { value: 1 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    toneMappingExposure: { value: 1 },
    uToneMap: { value: 0 },
    uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSaturation: { value: 1 }, uContrast: { value: 1 },
    uShadowTint: { value: new THREE.Color(.5, .5, .5) }, uHighlightTint: { value: new THREE.Color(.5, .5, .5) }, uSplit: { value: 0 }, uShadowDesat: { value: 0 }, uToe: { value: 1 },
    uVignette: { value: 0 }, uVignetteColor: { value: new THREE.Color(0, 0, 0) }, uSharpen: { value: 0 },
    uCenter: { value: new THREE.Vector2(.5, .5) },
    uPunch: { value: 0 }, uCinema: { value: 0 }, uChroma: { value: 0 }, uSpeed: { value: 0 }, uSpeedColor: { value: new THREE.Color(1, .98, .94) },
    uSeed: { value: 0 },
    uImpact: { value: 0 }, uImpactCenter: { value: new THREE.Vector2(.5, .5) },
    uTech: { value: 0 }, uTechColor: { value: new THREE.Color(1, 1, 1) },
    uTechLocal: { value: 0 }, uTechFocus: { value: new THREE.Vector2(.5, .5) }, uTechRadius: { value: .3 },
    uStop: { value: 0 },
    uBlur: { value: 0 }, uBlurCenter: { value: new THREE.Vector2(.5, .5) }, uBlurKeep: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    uStopDark: { value: new THREE.Color(.1, .29, .33) }, uStopLight: { value: new THREE.Color(.82, .95, .95) },
    ...focusUniforms,
    tGlow: { value: null as THREE.Texture | null },
    uHasFinish: { value: 0 }, uAnime: { value: 0 },
    uFinishA: { value: new THREE.Vector4() },
    uFinishB: { value: new THREE.Vector4() },
    uHaze: { value: new THREE.Vector4(1, 1, 1, 40) },
    uAnimeShadow: { value: new THREE.Color(1, 1, 1) }, uAnimeLift: { value: new THREE.Color(0, 0, 0) }, uAnimeWarm: { value: new THREE.Color(1, 1, 1) },
    uAnimeVignette: { value: 0 }, uWrapPx: { value: 3 },
  };
  readonly material: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  bloom: LookBloomPass | null = null;
  private fringe = 0;
  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({ name: 'LookFinal', uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FINAL_FRAGMENT, depthTest: false, depthWrite: false, toneMapped: false });
    this.quad = new FullScreenQuad(this.material);
    if (import.meta.env?.DEV && typeof window !== 'undefined') (window as { __lookFinal?: LookFinalPass }).__lookFinal ??= this;
  }
  setSize(width: number, height: number) {
    const u = this.uniforms, scale = Math.max(.5, height / 1080);
    u.uResolution.value.set(width, height); u.uFinishB.value.w = this.fringe * scale; u.uWrapPx.value = 3 * scale;
  }
  setGrade(look: LookPreset) {
    const u = this.uniforms, g: GradeLook = look.grade;
    u.uLift.value.set(...g.lift); u.uGamma.value.set(...g.gamma); u.uGain.value.set(...g.gain);
    u.uSaturation.value = g.saturation; u.uContrast.value = g.contrast;
    u.uShadowTint.value.setHex(g.shadowTint, THREE.LinearSRGBColorSpace);
    u.uHighlightTint.value.setHex(g.highlightTint, THREE.LinearSRGBColorSpace);
    u.uSplit.value = g.split;
    u.uShadowDesat.value = g.shadowDesat ?? 0;
    u.uToe.value = g.toe ?? .5;
    u.uVignette.value = g.vignette;
    u.uSharpen.value = g.sharpen ?? 0;
    u.uVignetteColor.value.setHex(g.vignetteColor, THREE.LinearSRGBColorSpace);
    u.toneMappingExposure.value = look.exposure;
    u.uToneMap.value = TONE_MAPS[look.toneMapping];
    u.uBloom.value = look.bloom.strength;
    const f = look.finish, code = (hex: number, out: THREE.Color) => out.setHex(hex, THREE.LinearSRGBColorSpace);
    u.uAnime.value = f ? 1 : 0;
    if (!f) return;
    u.uFinishA.value.set(f.diffusion.strength, f.wrap, f.haze.most, f.ground);
    this.fringe = f.fringe;
    u.uFinishB.value.set(f.curve, f.vibrance, f.grain, f.fringe * Math.max(.5, u.uResolution.value.y / 1080));
    const haze = new THREE.Color(f.haze.color);
    u.uHaze.value.set(haze.r, haze.g, haze.b, f.haze.range);
    code(f.shadow, u.uAnimeShadow.value); code(f.lift, u.uAnimeLift.value).multiplyScalar(f.liftStrength); code(f.warm, u.uAnimeWarm.value);
    u.uAnimeVignette.value = f.vignette;
  }
  beforeRender?: () => void;
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.beforeRender?.();
    this.uniforms.tScene.value = readBuffer.texture;
    focusUniforms.tDepth.value = readBuffer.depthTexture;
    const bloom = this.bloom?.enabled ? this.bloom.bloom.texture : null;
    this.uniforms.tBloom.value = bloom; this.uniforms.uHasBloom.value = bloom ? 1 : 0;
    this.uniforms.tGlow.value = bloom; this.uniforms.uHasFinish.value = bloom ? 1 : 0;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() { this.material.dispose(); this.quad.dispose(); }
}
