import * as THREE from 'three';
import { skipHiddenChildren } from '../hiddenMatrices';

const TAU = Math.PI * 2;
const LENS = `float artLens( vec3 world ) { return smoothstep( 1.1, 3.4, distance( world, cameraPosition ) ); }`;
const NOISE = `
float artHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float artNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( artHash( i ), artHash( i + vec2( 1, 0 ) ), f.x ), mix( artHash( i + vec2( 0, 1 ) ), artHash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
float artFbm( vec2 p ) { float v = 0.0, a = .5; for ( int i = 0; i < 4; i ++ ) { v += artNoise( p ) * a; p *= 2.03; a *= .5; } return v; }`;

const RIBBON_POINTS = 16;
const RIBBON_VERTEX = `
attribute float aSide; attribute vec3 aTangent; attribute float aAlong; attribute float aWidth;
uniform float uWidth;
varying float vSide; varying float vAlong; varying vec3 vWorld;
void main() {
	vec3 world = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
	vec3 toCam = normalize( cameraPosition - world );
	vec3 side = normalize( cross( aTangent, toCam ) + vec3( 1e-5 ) );
	world += side * aSide * uWidth * aWidth;
	vSide = aSide; vAlong = aAlong; vWorld = world;
	gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}`;
const RIBBON_FRAGMENT = `
uniform vec3 uColor; uniform vec3 uCore; uniform float uAlpha; uniform float uGrow; uniform float uTear; uniform float uTime;
varying float vSide; varying float vAlong; varying vec3 vWorld;
${LENS}
${NOISE}
void main() {
	if ( vAlong > uGrow ) discard;
	float d = abs( vSide );
	float a, core;
	vec3 col;
	if ( uTear > .5 ) {
		// A tear in space: ink black across, ragged, with a hot white lip.
		float rag = artNoise( vec2( vAlong * 38.0, uTime * 3.0 ) ) * .35;
		float body = 1.0 - smoothstep( .55 - rag, .75 - rag, d );
		float lip = smoothstep( .45 - rag, .7 - rag, d ) * ( 1.0 - smoothstep( .75 - rag, .95 - rag, d ) );
		col = mix( vec3( 0.0 ), uCore * 2.0, lip );
		a = max( body, lip ) * uAlpha;
	} else {
		core = 1.0 - smoothstep( 0.0, .3, d );
		float glow = pow( max( 0.0, 1.0 - d ), 2.4 );
		col = uColor * glow * 1.5 + uCore * core * 2.3;
		a = ( glow * .75 + core ) * uAlpha;
	}
	a *= artLens( vWorld );
	gl_FragColor = vec4( col, a );
	#include <colorspace_fragment>
}`;

interface Ribbon { mesh: THREE.Mesh; material: THREE.ShaderMaterial; geometry: THREE.BufferGeometry; born: number; life: number; kind: 'bolt' | 'trail' | 'tear'; strike: number; width: number; active: boolean; seed: number }

function ribbonGeometry() {
  const n = RIBBON_POINTS, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aTangent', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aWidth', new THREE.BufferAttribute(new Float32Array(n * 2), 1).setUsage(THREE.DynamicDrawUsage));
  const side = new Float32Array(n * 2), along = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; along[i * 2] = along[i * 2 + 1] = i / (n - 1); }
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aAlong', new THREE.BufferAttribute(along, 1).setUsage(THREE.DynamicDrawUsage));
  const index: number[] = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(index);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  return g;
}

const DECAL_VERTEX = `
varying vec2 vUv; varying vec3 vWorld;
void main() { vUv = uv; vec4 w = modelMatrix * vec4( position, 1.0 ); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const DECAL_FRAGMENT = `
uniform float uMode; uniform float uAge; uniform float uLife; uniform float uSpin; uniform float uHead; uniform float uSpan; uniform float uInner; uniform float uAlpha;
uniform vec3 uColor; uniform vec3 uCore;
varying vec2 vUv; varying vec3 vWorld;
${LENS}
${NOISE}
float line( float v, float at, float w ) { return 1.0 - smoothstep( 0.0, w, abs( v - at ) ); }
void main() {
	vec2 p = vUv * 2.0 - 1.0;
	float r = length( p ), ang = atan( p.y, p.x );
	float t = clamp( uAge / uLife, 0.0, 1.0 );
	float a = 0.0; vec3 col = uColor;
	if ( uMode < .5 ) {
		// A shock ring: a thin hot edge racing out, a soft wake behind it.
		float edge = mix( .12, .98, sqrt( t ) ), w = mix( .12, .03, t );
		float ring = smoothstep( edge - w, edge, r ) * ( 1.0 - smoothstep( edge, edge + .02, r ) );
		float wake = ( 1.0 - smoothstep( 0.0, edge, r ) ) * .12 * ( 1.0 - t );
		a = ( ring * .85 + wake ) * ( 1.0 - t * t );
		col = mix( uColor, uCore, ring * ring * .6 );
	} else if ( uMode < 1.5 ) {
		// A sigil: rings, runes and a turning hexagram, drawn on and flaring out.
		float spin = uAge * uSpin, on = smoothstep( 0.0, .25, t ), off = 1.0 - smoothstep( .75, 1.0, t );
		float rings = line( r, .96, .014 ) + line( r, .8, .01 ) * .9 + line( r, .52, .012 ) * .7;
		float band = step( .81, r ) * step( r, .95 );
		float seg = ( ang + spin ) / 6.2831853 * 24.0;
		float runes = band * step( .45, artHash( vec2( floor( seg ), 3.0 ) ) ) * step( .22, fract( seg ) ) * step( fract( seg ), .78 );
		float star = 0.0;
		for ( int k = 0; k < 6; k ++ ) {
			float o = float( k ) * 1.0471976 + spin * .6;
			vec2 d = vec2( cos( o ), sin( o ) );
			float edge = dot( p, d );
			star += line( edge, .45, .012 ) * step( abs( dot( p, vec2( -d.y, d.x ) ) ), .78 ) * step( r, .8 );
		}
		a = ( rings + runes * .55 + min( star, 1.0 ) ) * on * off;
		col = mix( uColor, uCore, rings * .5 );
	} else if ( uMode < 2.5 ) {
		// A crescent sweeping round: the arc behind its head, hot at the head.
		float head = uHead + uAge * uSpin;
		float rel = mod( ( uSpin >= 0.0 ? head - ang : ang - head ), 6.2831853 );
		float arc = 1.0 - smoothstep( 0.0, uSpan, rel );
		// Thick at the head, thinning to a hair behind it: a crescent, not a band.
		float inner = mix( uInner, .95, clamp( rel / uSpan, 0.0, 1.0 ) );
		float band = smoothstep( inner, inner + .05, r ) * ( 1.0 - smoothstep( .95, 1.0, r ) );
		float lead = 1.0 - smoothstep( 0.0, .45, rel );
		float streaks = .55 + .45 * artNoise( vec2( r * 40.0, rel * 2.0 ) );
		a = arc * band * streaks * ( 1.0 - smoothstep( .55, 1.0, t ) );
		col = mix( uColor, uCore, lead * lead );
	} else {
		// A burst star where a blow lands: spikes, a hot heart, gone fast.
		float spikes = .35 + .65 * pow( abs( cos( ang * 4.0 + uSpin ) ), 10.0 ) + .25 * pow( abs( cos( ang * 7.0 - uSpin ) ), 16.0 );
		float reach = spikes * mix( .4, 1.0, sqrt( t ) );
		float body = 1.0 - smoothstep( reach * .6, reach, r );
		float heart = 1.0 - smoothstep( 0.0, .25, r );
		a = ( body * .8 + heart ) * ( 1.0 - t );
		col = mix( uColor, uCore, heart );
	}
	a *= uAlpha * artLens( vWorld );
	gl_FragColor = vec4( col, a );
	#include <colorspace_fragment>
}`;

interface Decal { mesh: THREE.Mesh; material: THREE.ShaderMaterial; born: number; life: number; active: boolean }

const VORTEX_VERTEX = `
varying vec2 vUv; varying vec3 vWorld;
void main() { vUv = uv; vec4 w = modelMatrix * vec4( position, 1.0 ); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const VORTEX_FRAGMENT = `
uniform float uAge; uniform float uLife; uniform float uHead; uniform float uSpin; uniform float uSpan; uniform float uInk; uniform float uAlpha;
uniform vec3 uColor; uniform vec3 uCore;
varying vec2 vUv; varying vec3 vWorld;
${LENS}
${NOISE}
void main() {
	float ang = vUv.x * 6.2831853;
	float head = uHead + uAge * uSpin;
	float rel = mod( uSpin >= 0.0 ? head - ang : ang - head, 6.2831853 );
	float arc = 1.0 - smoothstep( 0.0, uSpan, rel );
	float t = clamp( uAge / uLife, 0.0, 1.0 );
	// A blade of it: thick at its head, a hair at its tail, ragged with streaks.
	float thick = mix( .9, .12, clamp( rel / uSpan, 0.0, 1.0 ) );
	float v = abs( vUv.y - .5 ) * 2.0;
	float band = 1.0 - smoothstep( thick * .75, thick, v );
	float streak = .5 + .5 * artNoise( vec2( vUv.x * 70.0, vUv.y * 5.0 + uAge * 9.0 ) );
	float lead = 1.0 - smoothstep( 0.0, .6, rel );
	float a = arc * band * mix( streak, 1.0, lead ) * ( 1.0 - smoothstep( .5, 1.0, t ) );
	vec3 col = uInk > .5 ? mix( uColor * .35, uColor, lead ) : mix( uColor * 1.2, uCore * 1.8, lead * lead );
	a *= uAlpha * artLens( vWorld );
	gl_FragColor = vec4( col, a );
	#include <colorspace_fragment>
}`;
interface Vortex { mesh: THREE.Mesh; material: THREE.ShaderMaterial; born: number; life: number; active: boolean }

const FLAME_VERTEX = `
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
void main() { vUv = uv; vec4 w = modelMatrix * vec4( position, 1.0 ); vWorld = w.xyz; vNormalW = normalize( mat3( modelMatrix ) * normal ); gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLAME_FRAGMENT = `
uniform float uTime; uniform float uAge; uniform float uLife; uniform float uSeed; uniform float uAlpha;
uniform vec3 uHot; uniform vec3 uMid; uniform vec3 uCool;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
${LENS}
${NOISE}
void main() {
	float t = clamp( uAge / uLife, 0.0, 1.0 );
	vec2 q = vec2( vUv.x * 7.0 + uSeed * 13.0, vUv.y * 2.6 - uTime * 3.4 );
	float n = artFbm( q ) * .8 + artFbm( q * 2.1 + 3.7 ) * .35;
	// Hotter low down, licked away toward the top and as it dies.
	float heat = n * 1.15 - vUv.y * .85 - t * .55 + .25;
	// Cel bands, as anime paints fire.
	vec3 col = heat > .78 ? uHot * 1.6 : heat > .5 ? uMid * 1.25 : uCool * 1.0;
	float a = smoothstep( .22, .3, heat );
	// Softer where the surface turns from the eye: no hard cylinder edge.
	float face = abs( dot( normalize( cameraPosition - vWorld ), vNormalW ) );
	a *= mix( .35, 1.0, face ) * uAlpha * artLens( vWorld );
	gl_FragColor = vec4( col, a );
	#include <colorspace_fragment>
}`;
interface Flame { mesh: THREE.Mesh; material: THREE.ShaderMaterial; born: number; life: number; active: boolean; radius: number; height: number; dome: boolean }

const ICE_VERTEX = `
varying vec3 vNormalW; varying vec3 vWorld; varying float vHeight;
void main() {
	vec4 w = modelMatrix * instanceMatrix * vec4( position, 1.0 );
	vHeight = position.y;
	vWorld = w.xyz; vNormalW = normalize( mat3( modelMatrix * instanceMatrix ) * normal );
	gl_Position = projectionMatrix * viewMatrix * w;
}`;
const ICE_FRAGMENT = `
uniform vec3 uDeep; uniform vec3 uEdge; uniform float uAlpha;
varying vec3 vNormalW; varying vec3 vWorld; varying float vHeight;
${LENS}
void main() {
	vec3 v = normalize( cameraPosition - vWorld );
	float fres = pow( 1.0 - abs( dot( normalize( vNormalW ), v ) ), 2.2 );
	// Facets: a hard light from above, as cel shading draws crystal.
	float top = step( .35, normalize( vNormalW ).y );
	float tip = smoothstep( .55, 1.0, vHeight );
	vec3 col = mix( uDeep, uDeep * 2.4, top ) + uEdge * ( fres * .35 + tip * .5 );
	gl_FragColor = vec4( col, ( .55 + fres * .3 + tip * .15 ) * uAlpha * artLens( vWorld ) );
	#include <colorspace_fragment>
}`;
const SPIKES = 96;
interface Spike { active: boolean; x: number; y: number; z: number; tilt: number; yaw: number; tall: number; wide: number; born: number; life: number; slot: number }

const ROCK_VERTEX = `
varying vec3 vLocal; varying vec3 vNormalW; varying vec3 vWorld;
void main() { vLocal = position; vec4 w = modelMatrix * vec4( position, 1.0 ); vWorld = w.xyz; vNormalW = normalize( mat3( modelMatrix ) * normal ); gl_Position = projectionMatrix * viewMatrix * w; }`;
const ROCK_FRAGMENT = `
uniform float uTime;
varying vec3 vLocal; varying vec3 vNormalW; varying vec3 vWorld;
${NOISE}
void main() {
	float n = artFbm( vLocal.xy * 3.0 + vLocal.z * 2.0 + uTime * .8 );
	float crack = smoothstep( .58, .64, n );
	float lit = .35 + .65 * max( 0.0, dot( normalize( vNormalW ), normalize( vec3( .3, 1.0, .2 ) ) ) );
	vec3 col = vec3( .09, .05, .04 ) * lit + vec3( 3.2, 1.1, .25 ) * crack;
	gl_FragColor = vec4( col, 1.0 );
	#include <colorspace_fragment>
}`;
interface Meteor { rock: THREE.Mesh; trail: Ribbon; from: THREE.Vector3; to: THREE.Vector3; born: number; lands: number; radius: number; evolved: boolean; active: boolean; path: THREE.Vector3[] }

export interface ArtPalette { core: number; color: number; deep?: number }
export const ART_PALETTE = {
  storm: { core: 0xf4fdff, color: 0x22b8ff },
  judgement: { core: 0xfff6d0, color: 0xffb21e },
  blood: { core: 0xffd6d0, color: 0xff1030, deep: 0x3a0008 },
  fire: { core: 0xfff0a0, color: 0xff6a18, deep: 0x8a1404 },
  purgatory: { core: 0xffc0e0, color: 0xc01040, deep: 0x2a0418 },
  ice: { core: 0xd8f6ff, color: 0x4ac0ff, deep: 0x0a4a8a },
  void: { core: 0xf0e4ff, color: 0x8a3cff },
  gold: { core: 0xfff3b0, color: 0xffb21e },
} satisfies Record<string, ArtPalette>;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

export class ArtFx {
  private readonly root = new THREE.Group();
  private readonly ribbons: Ribbon[] = [];
  private readonly decals: Decal[] = [];
  private readonly inkDecals: Decal[] = [];
  private readonly flames: Flame[] = [];
  private readonly vortices: Vortex[] = [];
  private readonly spikes: Spike[] = [];
  private readonly ice: THREE.InstancedMesh;
  private readonly meteors: Meteor[] = [];
  private readonly pending: { at: number; run: () => void }[] = [];
  density = 1;

  constructor(scene: THREE.Scene) {
    this.root.name = 'rift-arts';
    skipHiddenChildren(this.root);
    scene.add(this.root);
    for (let i = 0; i < 64; i++) this.ribbons.push(this.makeRibbon());
    const plane = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let i = 0; i < 40; i++) this.decals.push(this.makeDecal(plane, THREE.AdditiveBlending));
    for (let i = 0; i < 12; i++) this.inkDecals.push(this.makeDecal(plane, THREE.NormalBlending));
    const column = new THREE.CylinderGeometry(.55, 1, 1, 28, 10, true).translate(0, .5, 0);
    const dome = new THREE.SphereGeometry(1, 28, 18, 0, TAU, 0, Math.PI / 2);
    for (let i = 0; i < 12; i++) this.flames.push(this.makeFlame(column, false));
    const wall = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, .5, 0);
    for (let i = 0; i < 8; i++) this.vortices.push(this.makeVortex(wall, i % 2 === 0));
    for (let i = 0; i < 4; i++) this.flames.push(this.makeFlame(dome, true));
    const crystal = new THREE.ConeGeometry(.5, 1, 5, 1).translate(0, .5, 0);
    this.ice = new THREE.InstancedMesh(crystal, new THREE.ShaderMaterial({
      uniforms: { uDeep: { value: new THREE.Color(ART_PALETTE.ice.deep) }, uEdge: { value: new THREE.Color(ART_PALETTE.ice.core) }, uAlpha: { value: 1 } },
      vertexShader: ICE_VERTEX, fragmentShader: ICE_FRAGMENT, transparent: true, depthWrite: true }), SPIKES);
    this.ice.count = 0; this.ice.frustumCulled = false; this.ice.name = 'art-ice'; this.ice.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(this.ice);
    const rock = new THREE.IcosahedronGeometry(1, 2);
    const pos = rock.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { _a.fromBufferAttribute(pos, i); const n = .78 + .3 * Math.abs(Math.sin(_a.x * 3.1 + _a.y * 4.7) * Math.cos(_a.z * 2.3)); _a.multiplyScalar(n); pos.setXYZ(i, _a.x, _a.y, _a.z); }
    rock.computeVertexNormals();
    const rockMaterial = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: ROCK_VERTEX, fragmentShader: ROCK_FRAGMENT });
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(rock, rockMaterial); mesh.visible = false; mesh.frustumCulled = false; this.root.add(mesh);
      this.meteors.push({ rock: mesh, trail: this.makeRibbon(), from: new THREE.Vector3(), to: new THREE.Vector3(), born: 0, lands: 0, radius: 5, evolved: false, active: false, path: [] });
    }
    for (let i = 0; i < SPIKES; i++) this.spikes.push({ active: false, x: 0, y: 0, z: 0, tilt: 0, yaw: 0, tall: 1, wide: 1, born: 0, life: 1, slot: i });
  }

  private makeRibbon(): Ribbon {
    const geometry = ribbonGeometry();
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color() }, uCore: { value: new THREE.Color() }, uAlpha: { value: 0 }, uGrow: { value: 1 }, uWidth: { value: .3 }, uTear: { value: 0 }, uTime: { value: 0 } },
      vertexShader: RIBBON_VERTEX, fragmentShader: RIBBON_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 4;
    this.root.add(mesh);
    const ribbon: Ribbon = { mesh, material, geometry, born: 0, life: 1, kind: 'bolt', strike: .08, width: .3, active: false, seed: 0 };
    return ribbon;
  }
  private makeDecal(plane: THREE.BufferGeometry, blending: THREE.Blending): Decal {
    const material = new THREE.ShaderMaterial({
      uniforms: { uMode: { value: 0 }, uAge: { value: 0 }, uLife: { value: 1 }, uSpin: { value: 0 }, uHead: { value: 0 }, uSpan: { value: 2 }, uInner: { value: .6 }, uAlpha: { value: 1 },
        uColor: { value: new THREE.Color() }, uCore: { value: new THREE.Color() } },
      vertexShader: DECAL_VERTEX, fragmentShader: DECAL_FRAGMENT, transparent: true, depthWrite: false, blending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.Mesh(plane, material);
    mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3;
    this.root.add(mesh);
    return { mesh, material, born: 0, life: 1, active: false };
  }
  private makeFlame(geometry: THREE.BufferGeometry, dome: boolean): Flame {
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAge: { value: 0 }, uLife: { value: 1 }, uSeed: { value: 0 }, uAlpha: { value: 1 }, uHot: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uCool: { value: new THREE.Color() } },
      vertexShader: FLAME_VERTEX, fragmentShader: FLAME_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 4;
    this.root.add(mesh);
    return { mesh, material, born: 0, life: 1, active: false, radius: 1, height: 6, dome };
  }
  private makeVortex(geometry: THREE.BufferGeometry, ink: boolean): Vortex {
    const material = new THREE.ShaderMaterial({
      uniforms: { uAge: { value: 0 }, uLife: { value: 1 }, uHead: { value: 0 }, uSpin: { value: 0 }, uSpan: { value: 3 }, uInk: { value: ink ? 1 : 0 }, uAlpha: { value: 1 },
        uColor: { value: new THREE.Color() }, uCore: { value: new THREE.Color() } },
      vertexShader: VORTEX_VERTEX, fragmentShader: VORTEX_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: ink ? THREE.NormalBlending : THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = ink ? 3 : 4;
    this.root.add(mesh);
    return { mesh, material, born: 0, life: 1, active: false };
  }
  private take<T extends { active: boolean; born: number }>(pool: T[]): T {
    return pool.find(each => !each.active) ?? pool.reduce((oldest, each) => each.born < oldest.born ? each : oldest, pool[0]);
  }

  private ribbon(points: readonly THREE.Vector3[], kind: Ribbon['kind'], palette: ArtPalette, width: number, time: number, life: number, strike = .08) {
    const r = this.take(this.ribbons);
    this.fill(r, points, kind === 'bolt' ? (t: number) => .45 + .55 * t : kind === 'tear' ? (t: number) => Math.sin(Math.PI * t) : (t: number) => t);
    r.kind = kind; r.born = time; r.life = life; r.strike = strike; r.width = width; r.active = true; r.seed = Math.random();
    r.material.uniforms.uColor.value.setHex(palette.color); r.material.uniforms.uCore.value.setHex(palette.core);
    r.material.uniforms.uTear.value = kind === 'tear' ? 1 : 0;
    r.material.blending = kind === 'tear' ? THREE.NormalBlending : THREE.AdditiveBlending;
    r.material.uniforms.uWidth.value = width;
    r.mesh.visible = true;
    return r;
  }
  private fill(r: Ribbon, points: readonly THREE.Vector3[], widthAt: (t: number) => number) {
    const pos = r.geometry.getAttribute('position') as THREE.BufferAttribute, tan = r.geometry.getAttribute('aTangent') as THREE.BufferAttribute, wid = r.geometry.getAttribute('aWidth') as THREE.BufferAttribute;
    const n = RIBBON_POINTS, m = points.length;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1) * (m - 1), k = Math.min(m - 2, Math.floor(f)), u = f - k;
      _a.copy(points[k]).lerp(points[k + 1], u);
      _b.copy(points[k + 1]).sub(points[k]).normalize();
      for (const s of [0, 1]) { pos.setXYZ(i * 2 + s, _a.x, _a.y, _a.z); tan.setXYZ(i * 2 + s, _b.x, _b.y, _b.z); wid.setX(i * 2 + s, widthAt(i / (n - 1))); }
    }
    pos.needsUpdate = tan.needsUpdate = wid.needsUpdate = true;
  }
  decal(mode: 0 | 1 | 2 | 3, x: number, y: number, z: number, radius: number, palette: ArtPalette, time: number, life: number,
    options: { spin?: number; head?: number; span?: number; inner?: number; alpha?: number; ink?: boolean; tilt?: number } = {}) {
    const d = this.take(options.ink ? this.inkDecals : this.decals);
    const u = d.material.uniforms;
    u.uMode.value = mode; u.uLife.value = life; u.uSpin.value = options.spin ?? 0; u.uHead.value = options.head ?? 0; u.uSpan.value = options.span ?? 2.4;
    u.uInner.value = options.inner ?? .55; u.uAlpha.value = options.alpha ?? 1; u.uAge.value = 0;
    u.uColor.value.setHex(options.ink ? (palette.deep ?? 0x000000) : palette.color); u.uCore.value.setHex(options.ink ? palette.color : palette.core);
    d.mesh.position.set(x, y, z); d.mesh.scale.setScalar(radius);
    d.mesh.rotation.set(options.tilt ?? 0, 0, 0);
    d.born = time; d.life = life; d.active = true; d.mesh.visible = true;
    return d;
  }
  flame(x: number, y: number, z: number, radius: number, height: number, palette: ArtPalette, time: number, life: number, dome = false, alpha = 1) {
    const f = this.take(this.flames.filter(each => each.dome === dome));
    const u = f.material.uniforms;
    u.uAlpha.value = alpha;
    u.uHot.value.setHex(palette.core); u.uMid.value.setHex(palette.color); u.uCool.value.setHex(palette.deep ?? palette.color); u.uSeed.value = Math.random(); u.uAge.value = 0; u.uLife.value = life;
    f.mesh.position.set(x, y, z); f.radius = radius; f.height = height; f.born = time; f.life = life; f.active = true; f.mesh.visible = true;
    f.mesh.rotation.y = Math.random() * TAU;
  }

  lightning(x: number, y: number, z: number, time: number, judgement = false) {
    const palette = judgement ? ART_PALETTE.judgement : ART_PALETTE.storm;
    const height = judgement ? 20 : 15, delay = judgement ? .28 : 0;
    const strike = () => {
      const now = time + delay;
      const top = new THREE.Vector3(x + (Math.random() - .5) * 3, y + height, z + (Math.random() - .5) * 3);
      const points = [top];
      for (let i = 1; i < 10; i++) {
        const t = i / 10, wander = (1 - t) * (1.4 + Math.random());
        points.push(new THREE.Vector3(top.x + (x - top.x) * t + (Math.random() - .5) * wander, top.y + (y - top.y) * t, top.z + (z - top.z) * t + (Math.random() - .5) * wander));
      }
      points.push(new THREE.Vector3(x, y + .05, z));
      this.ribbon(points, 'bolt', palette, judgement ? .5 : .34, now, .32, .07);
      for (let b = 0; b < (this.density > .5 ? 2 : 1); b++) {
        const from = points[2 + Math.floor(Math.random() * 5)], branch = [from.clone()];
        const dir = new THREE.Vector3(Math.random() - .5, -.8 - Math.random() * .6, Math.random() - .5).normalize();
        for (let i = 1; i < 5; i++) branch.push(branch[i - 1].clone().addScaledVector(dir, 1 + Math.random() * .9).add(new THREE.Vector3((Math.random() - .5) * .8, 0, (Math.random() - .5) * .8)));
        this.ribbon(branch, 'bolt', palette, .14, now + .02, .22, .05);
      }
      this.decal(3, x, y + .06, z, judgement ? 3.4 : 2.4, palette, now, .3, { spin: Math.random() * TAU });
      this.decal(0, x, y + .07, z, judgement ? 6 : 4, palette, now, .45);
    };
    if (judgement) { this.decal(1, x, y + .05, z, 2.6, ART_PALETTE.gold, time, delay + .35, { spin: 2.2 }); this.pending.push({ at: time + delay, run: strike }); }
    else strike();
  }

  whirlwind(x: number, y: number, z: number, radius: number, time: number, tempest = false) {
    const head = Math.random() * TAU, spin = (Math.random() < .5 ? -1 : 1) * 16;
    const rings = tempest ? 3 : 2;
    for (let i = 0; i < rings; i++) {
      const r = radius * (.62 + i * .2), tall = 1.5 + i * .4, lean = (i - (rings - 1) / 2) * .12;
      for (const ink of [true, false]) {
        const v = this.vortices.filter(each => (each.material.uniforms.uInk.value > .5) === ink).find(each => !each.active)
          ?? this.vortices.filter(each => (each.material.uniforms.uInk.value > .5) === ink)[0];
        const u = v.material.uniforms;
        u.uAge.value = 0; u.uLife.value = ink ? .5 : .44; u.uHead.value = head + i * 2.1; u.uSpin.value = spin * (1 - i * .12); u.uSpan.value = ink ? 3.6 : 2.4; u.uAlpha.value = ink ? .9 : 1.25;
        u.uColor.value.setHex(ink ? ART_PALETTE.blood.deep! : ART_PALETTE.blood.color); u.uCore.value.setHex(ART_PALETTE.blood.core);
        v.mesh.position.set(x, y + .15 + i * .2, z); v.mesh.scale.set(r * (ink ? 1.03 : 1), tall, r * (ink ? 1.03 : 1)); v.mesh.rotation.set(lean, 0, lean * .5);
        v.born = time + i * .05; v.life = u.uLife.value; v.active = true; v.mesh.visible = false;
      }
    }
    this.decal(0, x, y + .08, z, radius * 1.4, ART_PALETTE.blood, time, .4, { alpha: .8 });
  }

  hellfire(x: number, y: number, z: number, radius: number, time: number, purgatory = false, sight = 1) {
    const palette = purgatory ? ART_PALETTE.purgatory : ART_PALETTE.fire;
    const k = Math.max(.3, sight);
    this.decal(1, x, y + .05, z, radius * 1.3, palette, time, .7, { spin: 3, alpha: .5 + .5 * sight });
    this.pending.push({ at: time + .22, run: () => {
      this.flame(x, y, z, radius * .7 * k, (purgatory ? 9 : 7) * k, palette, time + .22, .75, false, .35 + .65 * sight);
      this.decal(0, x, y + .06, z, radius * 2.4, palette, time + .22, .4, { alpha: sight });
    } });
  }

  meteor(x: number, z: number, radius: number, lands: number, time: number, apocalypse = false) {
    const m = this.meteors.find(each => !each.active) ?? this.meteors[0];
    m.active = true; m.born = time; m.lands = Math.max(time + .25, lands); m.radius = radius; m.evolved = apocalypse;
    const side = Math.random() < .5 ? 1 : -1;
    m.from.set(x + 10 * side, 30, z - 8); m.to.set(x, 0, z);
    m.rock.visible = true; m.rock.scale.setScalar(apocalypse ? 2.2 : 1.4);
    m.path = [];
    this.decal(1, x, .05, z, radius * 1.1, ART_PALETTE.fire, time, m.lands - time + .15, { spin: 1.4, alpha: .8 });
  }

  frost(x: number, y: number, z: number, radius: number, time: number, absolute = false) {
    const crowns = absolute ? 2 : 1;
    for (let c = 0; c < crowns; c++) {
      const r = radius * (c ? 1.35 : .8), n = Math.round((absolute ? 30 : 24) * Math.max(.5, this.density));
      for (let i = 0; i < n; i++) {
        const s = this.spikes.find(each => !each.active);
        if (!s) break;
        const a = i / n * TAU + Math.random() * .2, rr = r * (.7 + Math.random() * .45);
        s.active = true; s.x = x + Math.cos(a) * rr; s.y = y; s.z = z + Math.sin(a) * rr; s.yaw = Math.PI / 2 - a; s.tilt = .25 + Math.random() * .45;
        const big = i % 3 === 0;
        s.tall = (big ? 2.4 + Math.random() * 1.4 : .8 + Math.random() * 1.1) * (c ? 1.2 : 1); s.wide = big ? .5 + Math.random() * .2 : .22 + Math.random() * .16; s.born = time + c * .12 + rr / r * .08; s.life = 1.1;
      }
    }
    this.decal(0, x, y + .06, z, radius * 2.2, ART_PALETTE.ice, time, .6);
    this.decal(1, x, y + .05, z, radius * 1.2, ART_PALETTE.ice, time, 1.1, { spin: .8, alpha: .7 });
  }

  crack(points: readonly { x: number; y: number; z: number }[], time: number, palette: ArtPalette, width = .34, life = .6, hot = true) {
    const line = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
    this.ribbon(line, 'tear', palette, width, time, life, .04);
    if (hot) this.ribbon(line, 'bolt', palette, width * .18, time, life * .5, .03);
  }
  tear(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, time: number, gold = false) {
    const points = [new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)];
    const palette = gold ? ART_PALETTE.gold : ART_PALETTE.void;
    this.ribbon(points, 'tear', palette, .5, time, .45, .05);
    this.ribbon(points, 'bolt', palette, .09, time, .22, .03);
  }

  update(time: number) {
    for (let i = this.pending.length - 1; i >= 0; i--) if (time >= this.pending[i].at) { const run = this.pending[i].run; this.pending.splice(i, 1); run(); }
    for (const r of this.ribbons) this.age(r, time);
    for (const m of this.meteors) {
      if (!m.active) continue;
      if (time >= m.lands) {
        m.active = false; m.rock.visible = false; m.trail.active = false; m.trail.mesh.visible = false;
        const R = m.radius * (m.evolved ? 1.5 : 1);
        this.flame(m.to.x, 0, m.to.z, R * .55, R * .5, ART_PALETTE.fire, time, .6, true);
        this.decal(0, m.to.x, .08, m.to.z, R * 2.6, ART_PALETTE.fire, time, .55);
        this.decal(3, m.to.x, .07, m.to.z, R * 1.2, ART_PALETTE.fire, time, .4, { spin: Math.random() * TAU });
        continue;
      }
      const t = Math.max(0, Math.min(1, (time - m.born) / Math.max(.05, m.lands - m.born))), e = t * t;
      m.rock.position.copy(m.from).lerp(m.to, e);
      m.rock.rotation.x += .08; m.rock.rotation.z += .05;
      m.path.push(m.rock.position.clone());
      if (m.path.length > 10) m.path.shift();
      if (m.path.length > 2) {
        const points = [...m.path].reverse();
        if (!m.trail.active) { this.fill(m.trail, points, s => 1 - s); m.trail.active = true; m.trail.kind = 'trail'; m.trail.born = time; m.trail.life = 9; m.trail.mesh.visible = true;
          m.trail.material.uniforms.uColor.value.setHex(ART_PALETTE.fire.color); m.trail.material.uniforms.uCore.value.setHex(ART_PALETTE.fire.core); m.trail.material.uniforms.uTear.value = 0; m.trail.material.blending = THREE.AdditiveBlending;
          m.trail.material.uniforms.uWidth.value = m.evolved ? 2 : 1.3; m.trail.material.uniforms.uGrow.value = 1; m.trail.material.uniforms.uAlpha.value = 1; }
        else this.fill(m.trail, points, s => 1 - s);
      }
    }
    for (const d of [...this.decals, ...this.inkDecals]) {
      if (!d.active) continue;
      const age = time - d.born;
      if (age > d.life) { d.active = false; d.mesh.visible = false; continue; }
      d.material.uniforms.uAge.value = Math.max(0, age);
      d.mesh.visible = age >= 0;
    }
    for (const v of this.vortices) {
      if (!v.active) continue;
      const age = time - v.born;
      if (age > v.life) { v.active = false; v.mesh.visible = false; continue; }
      v.material.uniforms.uAge.value = Math.max(0, age);
      v.mesh.visible = age >= 0;
    }
    for (const f of this.flames) {
      if (!f.active) continue;
      const age = time - f.born;
      if (age > f.life) { f.active = false; f.mesh.visible = false; continue; }
      const u = f.material.uniforms;
      u.uAge.value = Math.max(0, age); u.uTime.value = time;
      const rise = Math.min(1, Math.max(0, age) / .1), fall = Math.max(0, (age - f.life * .5) / (f.life * .5));
      if (f.dome) f.mesh.scale.set(f.radius * (.4 + .6 * Math.sqrt(Math.min(1, age / .25))), f.height * (.4 + .6 * Math.sqrt(Math.min(1, age / .25))), f.radius * (.4 + .6 * Math.sqrt(Math.min(1, age / .25))));
      else f.mesh.scale.set(f.radius * (1 - fall * .5), f.height * rise * (1 + fall * .3), f.radius * (1 - fall * .5));
      f.mesh.visible = age >= 0;
    }
    let n = 0;
    for (const s of this.spikes) {
      if (!s.active) continue;
      const age = time - s.born;
      if (age > s.life) { s.active = false; continue; }
      if (age < 0) continue;
      const up = Math.min(1, age / .1), down = Math.max(0, (age - s.life * .7) / (s.life * .3));
      const h = s.tall * up * (1 - down * .6), w = s.wide * (1 - down * .5);
      _q.setFromEuler(_e.set(s.tilt, s.yaw, 0, 'YXZ'));
      _m.compose(_a.set(s.x, s.y - down * .4, s.z), _q, _s.set(w, h, w));
      this.ice.setMatrixAt(n++, _m);
    }
    this.ice.count = n;
    if (n) this.ice.instanceMatrix.needsUpdate = true;
  }
  private age(r: Ribbon, time: number) {
    if (!r.active || r.kind === 'trail') return;
    const age = time - r.born;
    if (age > r.life) { r.active = false; r.mesh.visible = false; return; }
    const u = r.material.uniforms;
    u.uTime.value = time;
    r.mesh.visible = age >= 0;
    if (age < 0) return;
    u.uGrow.value = Math.min(1, age / Math.max(.01, r.strike));
    const fade = 1 - Math.max(0, (age - r.life * .35) / (r.life * .65));
    const flicker = r.kind === 'bolt' ? .75 + .25 * Math.sin(age * 90 + r.seed * 20) : 1;
    u.uAlpha.value = Math.max(0, fade) * flicker;
    if (r.kind === 'tear') u.uWidth.value = r.width * Math.sin(Math.PI * Math.min(1, age / r.life));
  }

  clear() {
    for (const r of this.ribbons) { r.active = false; r.mesh.visible = false; }
    for (const d of [...this.decals, ...this.inkDecals]) { d.active = false; d.mesh.visible = false; }
    for (const f of this.flames) { f.active = false; f.mesh.visible = false; }
    for (const v of this.vortices) { v.active = false; v.mesh.visible = false; }
    for (const s of this.spikes) s.active = false;
    for (const m of this.meteors) { m.active = false; m.rock.visible = false; m.trail.active = false; m.trail.mesh.visible = false; }
    this.ice.count = 0; this.pending.length = 0;
  }
}
