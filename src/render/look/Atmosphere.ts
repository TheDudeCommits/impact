import * as THREE from 'three';
import type { AtmosphereKind, LookPreset } from './stageLooks';
import { COOKIE_GLSL, cookieUniforms, setCookieQuality } from './lightCookie';
import { setAirLook, setAirQuality } from './air';
import { setPlaceShadowQuality } from './placeShadows';

const MAX_PARTICLES = 900;
const MAX_SHAFTS = 8;
const KINDS: Record<AtmosphereKind, number> = { none: 0, dust: 1, sparkles: 2, embers: 3, leaves: 4, petals: 5 };

export class Atmosphere {
  readonly group = new THREE.Group();
  private readonly glow: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly solid: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly shafts: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly shaftStarts: THREE.InstancedBufferAttribute;
  private readonly uniforms = {
    uTime: { value: 0 }, uCamera: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(26, 9, 26) },
    uKind: { value: 1 }, uSize: { value: .03 }, uColorA: { value: new THREE.Color() }, uColorB: { value: new THREE.Color() },
    uWind: { value: new THREE.Vector3(.35, 0, .12) }, uFall: { value: 0 }, uFloor: { value: 0 },
    ...cookieUniforms,
  };
  private readonly shaftUniforms = {
    uTime: { value: 0 }, uDir: { value: new THREE.Vector3(0, -1, 0) }, uLength: { value: 20 }, uWidth: { value: 2 },
    uColor: { value: new THREE.Color() },
  };
  private wanted = 0;
  private density = 1;
  private shaftsAllowed = true;
  private shaftCount = 0;

  constructor(scene: THREE.Scene) {
    this.group.name = 'look-atmosphere';
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const seeds = new Float32Array(MAX_PARTICLES * 4);
    let s = 12345;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
    quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    quad.instanceCount = 0;
    const particle = (additive: boolean) => new THREE.ShaderMaterial({
      name: additive ? 'LookAtmosphereGlow' : 'LookAtmosphereSolid',
      uniforms: this.uniforms, vertexShader: PARTICLE_VERTEX, fragmentShader: PARTICLE_FRAGMENT,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      defines: additive ? { LOOK_GLOW: '' } : {}, fog: false, toneMapped: false, side: THREE.DoubleSide,
    });
    this.glow = new THREE.Mesh(quad, particle(true));
    this.solid = new THREE.Mesh(quad.clone(), particle(false));
    (this.solid.geometry as THREE.InstancedBufferGeometry).instanceCount = 0;
    for (const mesh of [this.glow, this.solid]) { mesh.frustumCulled = false; mesh.renderOrder = 5; this.group.add(mesh); }

    const shaft = new THREE.InstancedBufferGeometry();
    shaft.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, .5, 1, 0, -.5, 1, 0], 3));
    shaft.setIndex([0, 1, 2, 0, 2, 3]);
    this.shaftStarts = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SHAFTS * 4), 4);
    shaft.setAttribute('aShaft', this.shaftStarts);
    shaft.instanceCount = 0;
    this.shafts = new THREE.Mesh(shaft, new THREE.ShaderMaterial({
      name: 'LookShafts', uniforms: this.shaftUniforms, vertexShader: SHAFT_VERTEX, fragmentShader: SHAFT_FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, side: THREE.DoubleSide,
    }));
    this.shafts.frustumCulled = false;
    this.shafts.renderOrder = 4;
    this.group.add(this.shafts);
    scene.add(this.group);
  }

  setLook(look: LookPreset) {
    setAirLook(look);
    const a = look.atmosphere, u = this.uniforms;
    u.uKind.value = KINDS[a.kind];
    u.uSize.value = a.size;
    u.uColorA.value.setHex(a.color); u.uColorB.value.setHex(a.color2);
    const falling = a.kind === 'leaves' || a.kind === 'petals';
    u.uFall.value = falling ? .55 : a.kind === 'embers' ? -.6 : 0;
    u.uWind.value.set(falling ? 1.1 : .25, 0, falling ? .45 : .1);
    u.uBox.value.set(falling ? 34 : 24, falling ? 12 : 8, falling ? 34 : 24);
    this.wanted = a.kind === 'none' ? 0 : a.count;
    const glow = a.kind === 'dust' || a.kind === 'sparkles' || a.kind === 'embers';
    this.glow.visible = glow; this.solid.visible = !glow && a.kind !== 'none';
    const s = a.shafts;
    this.shaftCount = s ? Math.min(MAX_SHAFTS, s.openings.length) : 0;
    if (s) {
      s.openings.slice(0, MAX_SHAFTS).forEach((o, i) => this.shaftStarts.setXYZW(i, o[0], o[1], o[2], i * .173 + .1));
      this.shaftStarts.needsUpdate = true;
      this.shaftUniforms.uLength.value = s.length; this.shaftUniforms.uWidth.value = s.width;
      this.shaftUniforms.uColor.value.setHex(s.color).multiplyScalar(s.strength);
      const d = look.key.dir;
      this.shaftUniforms.uDir.value.set(-d[0], -d[1], -d[2]).normalize();
    }
    this.applyCounts();
  }

  setQuality(quality: 'high' | 'medium' | 'low', effects: number) {
    setAirQuality(quality); setCookieQuality(quality); setPlaceShadowQuality(quality);
    this.density = (quality === 'high' ? 1 : quality === 'medium' ? .6 : .3) * Math.max(0, Math.min(1, effects));
    this.shaftsAllowed = quality !== 'low' && effects > .05;
    this.applyCounts();
  }

  private applyCounts() {
    const count = Math.min(MAX_PARTICLES, Math.round(this.wanted * this.density));
    this.glow.geometry.instanceCount = count;
    this.solid.geometry.instanceCount = count;
    this.shafts.geometry.instanceCount = this.shaftsAllowed ? this.shaftCount : 0;
    this.shafts.visible = this.shaftsAllowed && this.shaftCount > 0;
  }

  update(time: number, camera: THREE.Camera) {
    this.uniforms.uTime.value = time;
    this.shaftUniforms.uTime.value = time;
    this.uniforms.uCamera.value.setFromMatrixPosition(camera.matrixWorld);
  }

  dispose() {
    for (const mesh of [this.glow, this.solid, this.shafts]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    this.group.removeFromParent();
  }
}

const PARTICLE_VERTEX = `
uniform float uTime;
uniform vec3 uCamera;
uniform vec3 uBox;
uniform float uKind;
uniform float uSize;
uniform vec3 uWind;
uniform float uFall;
uniform float uFloor;
attribute vec4 aSeed;
varying vec2 vQuad;
varying float vRand;
varying float vFade;
${COOKIE_GLSL}
void main() {
	float rnd = aSeed.w;
	vec3 p = aSeed.xyz * uBox + uWind * uTime * ( .6 + .8 * rnd ) - vec3( 0., uFall * uTime * ( .5 + rnd ), 0. );
	p.x += sin( uTime * ( .5 + rnd * .7 ) + rnd * 40. ) * .45;
	p.z += cos( uTime * ( .4 + rnd * .6 ) + rnd * 23. ) * .45;
	p.y += sin( uTime * ( .8 + rnd ) + rnd * 17. ) * .12;
	vec3 origin = vec3( uCamera.x - uBox.x * .5, uFloor, uCamera.z - uBox.z * .5 );
	vec3 q = mod( p - origin, uBox ) / uBox;
	vec3 world = origin + q * uBox;
	vFade = smoothstep( 0., .15, q.x ) * smoothstep( 1., .85, q.x ) * smoothstep( 0., .15, q.z ) * smoothstep( 1., .85, q.z ) * smoothstep( 0., .06, q.y ) * smoothstep( 1., .8, q.y );
	vec4 mv = viewMatrix * vec4( world, 1. );
	// Nothing drifts across the lens: the chase camera sits 4.5 m behind the
	// fighter, and a leaf a metre from it would cover half the screen.
	vFade *= uKind > 3.5 ? smoothstep( 2.5, 5.5, - mv.z ) : smoothstep( 1.2, 3.2, - mv.z );
	// Dust is only seen where the sun catches it: inside a window's light a
	// mote glints, in the hall's shade it all but disappears.
	if ( uCookieOn > .5 && uKind < 3.5 ) { float lit = lookCookie( world ); vFade *= .2 + 1.5 * lit * lit; }
	float size = uSize * ( .55 + .9 * fract( rnd * 7.31 ) );
	vec2 corner = position.xy;
	if ( uKind > 3.5 ) {
		float spin = uTime * ( 1.2 + rnd * 2.2 ) + rnd * 6.283;
		corner = mat2( cos( spin ), - sin( spin ), sin( spin ), cos( spin ) ) * ( corner * vec2( 1., .45 + .4 * abs( sin( spin * 1.37 ) ) ) );
	}
	mv.xy += corner * size * 2.;
	gl_Position = projectionMatrix * mv;
	vQuad = position.xy * 2.;
	vRand = rnd;
}`;

const PARTICLE_FRAGMENT = `
uniform float uTime;
uniform float uKind;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vQuad;
varying float vRand;
varying float vFade;
void main() {
	vec3 color = mix( uColorA, uColorB, fract( vRand * 13.7 ) );
	float alpha;
	#ifdef LOOK_GLOW
		float r = length( vQuad );
		alpha = smoothstep( 1., .15, r );
		float twinkle = .55 + .45 * sin( uTime * ( 2. + vRand * 4. ) + vRand * 60. );
		if ( uKind > 1.5 && uKind < 2.5 ) {
			float star = max( 1. - abs( vQuad.x ) * 6., 0. ) * max( 1. - abs( vQuad.y ) * 1.2, 0. ) + max( 1. - abs( vQuad.y ) * 6., 0. ) * max( 1. - abs( vQuad.x ) * 1.2, 0. );
			alpha = max( alpha * .6, star ) * twinkle;
		} else alpha *= .45 + .55 * twinkle;
		gl_FragColor = vec4( color * alpha * vFade * 1.6, 1. );
	#else
		float e = length( vQuad * vec2( 1., 1.9 ) );
		alpha = 1. - smoothstep( .82, 1., e );
		float rib = 1. - ( 1. - smoothstep( 0., .07, abs( vQuad.y ) ) ) * .25;
		if ( alpha * vFade < .02 ) discard;
		gl_FragColor = vec4( color * rib, alpha * vFade * .92 );
	#endif
}`;

const SHAFT_VERTEX = `
uniform vec3 uDir;
uniform float uLength;
uniform float uWidth;
attribute vec4 aShaft;
varying vec2 vUv;
varying float vSeed;
varying float vNear;
void main() {
	vec3 p = aShaft.xyz + uDir * position.y * uLength;
	vec3 toCamera = normalize( cameraPosition - p );
	vec3 side = normalize( cross( uDir, toCamera ) );
	p += side * position.x * uWidth * ( 1. + position.y * .45 );
	vec4 mv = viewMatrix * vec4( p, 1. );
	// A card is only a beam from the side. Looking down its length it
	// collapses into a bright slab, so it fades as the view lines up with it;
	// it also fades close to the lens, and into the floor rather than being
	// cut off by it.
	vNear = smoothstep( 1.5, 5., - mv.z ) * ( 1. - smoothstep( .78, .97, abs( dot( uDir, toCamera ) ) ) ) * smoothstep( .1, 1.6, p.y );
	gl_Position = projectionMatrix * mv;
	vUv = vec2( position.x + .5, position.y );
	vSeed = aShaft.w;
}`;

const SHAFT_FRAGMENT = `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying float vSeed;
varying float vNear;
void main() {
	float across = smoothstep( 0., .38, vUv.x ) * smoothstep( 1., .62, vUv.x );
	float along = smoothstep( 0., .06, vUv.y ) * ( 1. - smoothstep( .35, 1., vUv.y ) );
	float streak = .78 + .22 * sin( vUv.x * 23. + vSeed * 40. + uTime * .35 ) * sin( vUv.x * 9. - uTime * .2 + vSeed * 7. );
	float breathe = .86 + .14 * sin( uTime * .45 + vSeed * 20. );
	gl_FragColor = vec4( uColor * across * along * streak * breathe * vNear, 1. );
}`;
