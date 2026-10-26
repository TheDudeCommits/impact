import * as THREE from 'three';
import { TOPPLE_PARS } from './topple';

export interface FireSpot { x: number; y: number; z: number; size: number; smoke: number; seed: number; from?: number; tag?: number }

const FLAME_VERTEX = `
attribute vec4 aFire;
uniform float uLevel;
varying vec2 vUv;
varying vec4 vFire;
${TOPPLE_PARS}
void main() {
	vUv = uv; vFire = aFire;
	// On something that comes down, it comes down with it, flaring as it
	// falls, and burns on in the wreck (a fall lights one not yet caught).
	vec3 centre = ( instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
	float fell = riftTopple( centre, aFire.w );
	// Not yet caught: nothing drawn. Catching: it grows in.
	float caught = aFire.z <= 0.0 ? 1.0 : max( smoothstep( aFire.z - .15, aFire.z, uLevel ), smoothstep( .55, 1.0, fell ) );
	vFire.y *= caught;
	if ( caught <= 0.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
	// A card that turns round its own upright axis to face the lens.
	vec3 toCam = cameraPosition - centre; toCam.y = 0.0;
	vec3 side = normalize( cross( vec3( 0.0, 1.0, 0.0 ), normalize( toCam + vec3( 1e-4 ) ) ) );
	float flare = 1.0 + sin( min( fell * 1.4, 1.0 ) * 3.14159 ) * .9;
	float w = length( instanceMatrix[ 0 ].xyz ) * flare, h = length( instanceMatrix[ 1 ].xyz ) * ( .55 + .45 * caught ) * ( 1.0 + .25 * uLevel ) * flare;
	vec3 world = centre + side * position.x * w + vec3( 0.0, 1.0, 0.0 ) * position.y * h;
	gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}`;
const NOISE = `
float fHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float fNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( fHash( i ), fHash( i + vec2( 1, 0 ) ), f.x ), mix( fHash( i + vec2( 0, 1 ) ), fHash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
float fFbm( vec2 p ) { float v = 0.0, a = .5; for ( int i = 0; i < 4; i ++ ) { v += a * fNoise( p ); p *= 2.03; a *= .5; } return v; }`;
const FLAME_FRAGMENT = `
uniform float uTime;
varying vec2 vUv;
varying vec4 vFire;
${NOISE}
void main() {
	vec2 p = vUv * 2.0 - vec2( 1.0, 0.0 );
	float t = uTime * ( 1.6 + vFire.x * .6 ) + vFire.x * 40.0;
	// A teardrop, torn at the top by noise rising through it - and swaying,
	// bent by it the more the higher it climbs, its sides licking in and out
	// (a smooth cone of light over each brazier read as a lampshade).
	float n = fFbm( vec2( p.x * 2.2, p.y * 2.6 - t * 1.9 ) );
	float sway = ( fNoise( vec2( p.y * 1.7 - t * 1.3, vFire.x * 7.0 ) ) - .5 ) * .9 * p.y;
	float px = p.x + sway + ( n - .5 ) * .4 * p.y;
	float body = 1.0 - smoothstep( 0.0, 1.0, abs( px ) / max( .02, ( 1.0 - p.y ) * ( .7 + .35 * n ) + .05 ) );
	float heat = body * smoothstep( 1.02, .1, p.y + ( n - .5 ) * .9 ) * smoothstep( 0.0, .12, p.y );
	if ( heat < .05 ) discard;
	vec3 color = mix( vec3( 1.2, .18, .02 ), vec3( 3.2, 1.35, .3 ), smoothstep( .15, .6, heat ) );
	color = mix( color, vec3( 4.2, 3.2, 1.6 ), smoothstep( .72, 1.0, heat ) );
	gl_FragColor = vec4( color * vFire.y, smoothstep( .05, .35, heat ) );
}`;
const SMOKE_FRAGMENT = `
uniform float uTime;
varying vec2 vUv;
varying vec4 vFire;
${NOISE}
void main() {
	vec2 p = vUv * 2.0 - vec2( 1.0, 0.0 );
	float t = uTime * .35 + vFire.x * 17.0;
	// A column that widens and thins as it climbs, billowing.
	float width = .25 + p.y * .55;
	float n = fFbm( vec2( p.x * 1.6 + sin( p.y * 3.0 + t ) * .3, p.y * 2.2 - t ) );
	float column = 1.0 - smoothstep( width * .45, width, abs( p.x + ( n - .5 ) * .5 * p.y ) );
	float alpha = column * smoothstep( 0.0, .15, p.y ) * ( 1.0 - smoothstep( .55, 1.0, p.y ) ) * ( .55 + .45 * n ) * vFire.y;
	if ( alpha < .02 ) discard;
	vec3 color = mix( vec3( .05, .035, .035 ), vec3( .16, .1, .08 ), n );
	// Lit from below by what is burning.
	color += vec3( .9, .28, .05 ) * ( 1.0 - smoothstep( 0.0, .3, p.y ) ) * .5;
	gl_FragColor = vec4( color, alpha * .82 );
	#include <colorspace_fragment>
}`;
const GLOW_VERTEX = `
attribute vec4 aFire;
uniform float uLevel;
varying vec2 vUv;
varying vec4 vFire;
${TOPPLE_PARS}
void main() {
	vUv = uv; vFire = aFire;
	vec3 foot = ( instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
	float fell = riftTopple( foot, aFire.w );
	float caught = aFire.z <= 0.0 ? 1.0 : max( smoothstep( aFire.z - .15, aFire.z, uLevel ), smoothstep( .55, 1.0, fell ) );
	vFire.y *= caught;
	if ( caught <= 0.0 ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
	gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
}`;
const GLOW_FRAGMENT = `
uniform float uTime;
varying vec2 vUv;
varying vec4 vFire;
void main() {
	float r = length( vUv * 2.0 - 1.0 );
	float flicker = .82 + .18 * sin( uTime * 9.0 + vFire.x * 30.0 ) * sin( uTime * 5.3 + vFire.x * 11.0 );
	float glow = pow( max( 0.0, 1.0 - r ), 2.2 ) * flicker * vFire.y;
	if ( glow < .004 ) discard;
	gl_FragColor = vec4( vec3( 1.0, .38, .08 ) * glow * .9, 1.0 );
}`;

export class FireField {
  readonly root = new THREE.Group();
  private readonly flames: THREE.InstancedMesh;
  private readonly smoke: THREE.InstancedMesh;
  private readonly glow: THREE.InstancedMesh;
  private readonly time = { value: 0 };
  readonly level = { value: 0 };
  private spots: FireSpot[] = [];

  constructor(capacity: number, topple: { uBroken: { value: THREE.Texture }; uRiftTime: { value: number } }) {
    const card = new THREE.PlaneGeometry(1, 1); card.translate(0, .5, 0);
    const flameAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const smokeAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const glowAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const flameCard = card.clone(); flameCard.setAttribute('aFire', flameAttr);
    const smokeCard = card.clone(); smokeCard.setAttribute('aFire', smokeAttr);
    const disc = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); disc.setAttribute('aFire', glowAttr);
    const uniforms = { uTime: this.time, uLevel: this.level, ...topple };
    this.flames = new THREE.InstancedMesh(flameCard, new THREE.ShaderMaterial({ uniforms, vertexShader: FLAME_VERTEX, fragmentShader: FLAME_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), capacity);
    this.smoke = new THREE.InstancedMesh(smokeCard, new THREE.ShaderMaterial({ uniforms, vertexShader: FLAME_VERTEX, fragmentShader: SMOKE_FRAGMENT, transparent: true, depthWrite: false }), capacity);
    this.glow = new THREE.InstancedMesh(disc, new THREE.ShaderMaterial({ uniforms, vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), capacity);
    for (const mesh of [this.flames, this.smoke, this.glow]) { mesh.count = 0; mesh.frustumCulled = false; }
    this.glow.renderOrder = -1; this.smoke.renderOrder = 4; this.flames.renderOrder = 5;
    this.root.add(this.glow, this.smoke, this.flames);
    this.root.name = 'rift-fire';
  }

  set(spots: FireSpot[]) {
    this.spots = spots;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    const fa = this.flames.geometry.getAttribute('aFire') as THREE.InstancedBufferAttribute;
    const sa = this.smoke.geometry.getAttribute('aFire') as THREE.InstancedBufferAttribute;
    const ga = this.glow.geometry.getAttribute('aFire') as THREE.InstancedBufferAttribute;
    let f = 0, s = 0, g = 0;
    for (const spot of spots) {
      if (f >= this.flames.instanceMatrix.count) break;
      m.compose(new THREE.Vector3(spot.x, spot.y, spot.z), q, new THREE.Vector3(spot.size * .9, spot.size * 1.6, 1));
      this.flames.setMatrixAt(f, m); fa.setXYZW(f++, spot.seed, 1, spot.from ?? 0, spot.tag ?? 0);
      if (spot.smoke > 0) {
        m.compose(new THREE.Vector3(spot.x, spot.y + spot.size * .8, spot.z), q, new THREE.Vector3(spot.size * 2.4, spot.size * 7 * spot.smoke + 3, 1));
        this.smoke.setMatrixAt(s, m); sa.setXYZW(s++, spot.seed, spot.smoke, spot.from ?? 0, spot.tag ?? 0);
      }
      m.compose(new THREE.Vector3(spot.x, .03, spot.z), q, new THREE.Vector3(spot.size * 6, 1, spot.size * 6));
      this.glow.setMatrixAt(g, m); ga.setXYZW(g++, spot.seed, Math.min(1.4, .5 + spot.size * .4), spot.from ?? 0, spot.tag ?? 0);
    }
    this.flames.count = f; this.smoke.count = s; this.glow.count = g;
    for (const mesh of [this.flames, this.smoke, this.glow]) mesh.instanceMatrix.needsUpdate = true;
    fa.needsUpdate = sa.needsUpdate = ga.needsUpdate = true;
  }
  get count() { return this.spots.length; }

  update(time: number) { this.time.value = time; }

  dispose() {
    for (const mesh of [this.flames, this.smoke, this.glow]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); }
    this.root.removeFromParent();
  }
}
