import * as THREE from 'three';
import type { LookPreset } from './stageLooks';
import { frameUniforms } from './toonShading';

export class SkyDome {
  readonly mesh: THREE.Mesh;
  readonly envScene = new THREE.Scene();
  readonly uniforms = {
    uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
    uHorizonHeight: { value: .3 }, uFogColor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() },
    uSunCos: { value: new THREE.Vector2(.999, .9995) }, uSunGlow: { value: new THREE.Vector2(.8, 7) }, uSunDisc: { value: 1 },
    uCloudCoverage: { value: .4 }, uCloudLit: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() }, uCloudRim: { value: new THREE.Color() },
    uCloudScale: { value: 1 }, uCloudOffset: { value: new THREE.Vector2() },
    uStars: { value: 0 }, uNebulaA: { value: new THREE.Color() }, uNebulaB: { value: new THREE.Color() }, uNebula: { value: 0 },
    uTime: { value: 0 },
    uCloudLow: { value: 0 }, uCloudBillow: { value: 0 },
    uEclipse: { value: 0 }, uBlood: { value: 0 }, uBloodColor: { value: new THREE.Color(0x8a0610) },
    uDim: { value: 0 }, uDimColor: { value: new THREE.Color(0x0a1030) },
    uLookSilhouette: frameUniforms.uLookSilhouette,
  };
  private cloudSpeed = 0;
  private lifeSpeed = 1;
  private lookEclipse = 0;
  private readonly wind = new THREE.Vector2(.8, .35).normalize();

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const material = new THREE.ShaderMaterial({
      name: 'LookSky', uniforms: this.uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT,
      depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, fog: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'look-sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1_000_000;
    scene.add(this.mesh);
    const probe = new THREE.Mesh(geometry, material);
    probe.frustumCulled = false;
    this.envScene.add(probe);
  }

  setLook(look: LookPreset, fogColor: THREE.Color) {
    const s = look.sky, u = this.uniforms;
    u.uZenith.value.setHex(s.zenith); u.uHorizon.value.setHex(s.horizon); u.uGround.value.setHex(s.ground);
    u.uHorizonHeight.value = s.horizonHeight;
    u.uFogColor.value.copy(fogColor);
    const d = s.sunDir ?? look.key.dir;
    u.uSunDir.value.set(d[0], d[1], d[2]).normalize();
    u.uSunColor.value.setHex(s.sunColor).multiplyScalar(s.sunIntensity);
    u.uSunCos.value.set(Math.cos(s.sunSize), Math.cos(s.sunSize * .82));
    u.uSunGlow.value.set(s.sunGlow, s.sunGlowWidth);
    u.uCloudCoverage.value = s.cloudCoverage;
    u.uCloudLit.value.setHex(s.cloudLit); u.uCloudShade.value.setHex(s.cloudShade); u.uCloudRim.value.setHex(s.cloudRim);
    u.uCloudScale.value = s.cloudScale;
    this.cloudSpeed = s.cloudSpeed;
    u.uStars.value = s.stars;
    u.uNebulaA.value.setHex(s.nebulaA); u.uNebulaB.value.setHex(s.nebulaB); u.uNebula.value = s.nebula;
    this.lookEclipse = s.eclipse ?? 0;
    u.uEclipse.value = this.lookEclipse; u.uBlood.value = 0;
  }

  setRift(eclipse: number, blood: number) {
    this.uniforms.uEclipse.value = Math.max(this.lookEclipse, eclipse);
    this.uniforms.uBlood.value = blood;
  }

  setLife(clouds?: { speed: number; billow: number; low: number }) {
    this.lifeSpeed = clouds?.speed ?? 1;
    this.uniforms.uCloudBillow.value = clouds?.billow ?? 0;
    this.uniforms.uCloudLow.value = clouds?.low ?? 0;
  }

  dim(k: number) { this.uniforms.uDim.value = k; }

  set disc(on: boolean) { this.uniforms.uSunDisc.value = on ? 1 : 0; }

  update(time: number, dt: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uCloudOffset.value.addScaledVector(this.wind, this.cloudSpeed * this.lifeSpeed * dt);
  }
}

const SKY_VERTEX = `
varying vec3 vDir;
void main() {
	vec4 view = inverse( projectionMatrix ) * vec4( position.xy, 1.0, 1.0 );
	vDir = transpose( mat3( viewMatrix ) ) * ( view.xyz / view.w );
	gl_Position = vec4( position.xy, .99999, 1.0 );
}`;

const SKY_FRAGMENT = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uHorizonHeight;
uniform vec3 uFogColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec2 uSunCos;
uniform vec2 uSunGlow;
uniform float uSunDisc;
uniform float uCloudCoverage;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uCloudRim;
uniform float uCloudScale;
uniform vec2 uCloudOffset;
uniform float uStars;
uniform vec3 uNebulaA;
uniform vec3 uNebulaB;
uniform float uNebula;
uniform float uTime;
uniform float uCloudLow;
uniform float uCloudBillow;
uniform float uLookSilhouette;
uniform float uEclipse;
uniform float uBlood;
uniform float uDim;
uniform vec3 uDimColor;
uniform vec3 uBloodColor;
varying vec3 vDir;
float hash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float hash3( vec3 p ) { p = fract( p * .1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
float noise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p );
	vec2 u = f * f * ( 3. - 2. * f );
	return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), u.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), u.x ), u.y );
}
float fbm( vec2 p ) {
	float v = 0., a = .5;
	mat2 m = mat2( 1.6, 1.2, -1.2, 1.6 );
	for ( int i = 0; i < 4; i ++ ) { v += a * noise( p ); p = m * p; a *= .5; }
	return v / .9375;
}
void main() {
	vec3 d = normalize( vDir );
	float h = d.y;
	float up = max( h, 0. );
	vec3 sky = mix( uHorizon, uZenith, smoothstep( 0., uHorizonHeight * 2., up ) );
	sky = mix( sky, uGround, smoothstep( 0., .22, - h ) );
	float toSun = dot( d, uSunDir );
	float glow = pow( max( toSun, 0. ), uSunGlow.y ) * uSunGlow.x + pow( max( toSun, 0. ), 2. ) * .12 * uSunGlow.x * ( 1. - up );
	sky += uSunColor * glow * .06;
	if ( uStars > 0. ) {
		vec2 np = d.xz / ( abs( d.y ) + .6 ) * 1.6 + d.y;
		float n1 = fbm( np * 1.3 + 3.1 ), n2 = fbm( np * 2.7 - 7.3 );
		sky += mix( uNebulaA, uNebulaB, smoothstep( .3, .75, n2 ) ) * pow( smoothstep( .35, .95, n1 ), 1.6 ) * uNebula;
		vec3 p = d * 240.;
		vec3 cell = floor( p );
		float r = hash3( cell );
		float star = step( .9955, r ) * smoothstep( .42, .08, length( fract( p ) - .5 ) );
		sky += star * uStars * ( .8 + 2.6 * fract( r * 431.7 ) ) * ( .7 + .3 * sin( uTime * ( 1.5 + r * 3. ) + r * 90. ) );
	}
	if ( uCloudCoverage > 0. && h > -.02 ) {
		// Clouds on a flat layer over the arena, cut with a hard, slightly
		// anti-aliased edge; the density toward the sun decides which side is
		// lit, and the lit edge gets a bright rim.
		// A warped fbm gives the billowing outline of a painted cumulus rather
		// than the smooth blobs of plain noise.
		vec2 cuv = d.xz / ( h + .12 ) * .9 * uCloudScale + uCloudOffset;
			vec2 boil = vec2( uTime, - uTime * .8 ) * uCloudBillow;
			vec2 warp = vec2( fbm( cuv * .45 + 3.1 + boil ), fbm( cuv * .45 - 1.7 - boil.yx ) );
		float density = fbm( cuv * 1.6 + warp * 1.4 );
		float cut = 1. - uCloudCoverage;
		float aa = max( fwidth( density ) * .9, .004 );
		float cover = smoothstep( cut - aa, cut + aa, density ) * smoothstep( .015 - .012 * uCloudLow, .16 - .11 * uCloudLow, h );
		if ( cover > 0. ) {
			// Two flat tones split by where the cloud is thicker toward the
			// sun, with a thin bright rim on its sun-facing edge: the cel look.
			vec2 sunward = normalize( uSunDir.xz + 1e-4 ) * .22;
			float toward = fbm( ( cuv + sunward ) * 1.6 + warp * 1.4 );
			float split = density - toward + .035;
			float litAA = max( fwidth( split ), .004 );
			float lit = smoothstep( -litAA, litAA, split );
			vec3 cloud = mix( uCloudShade, uCloudLit, lit );
			float edge = 1. - smoothstep( cut + aa, cut + .05, density );
			cloud = mix( cloud, uCloudRim, edge * lit );
			cloud += uSunColor * .025 * pow( max( toSun, 0. ), 8. ) * ( .3 + lit );
			cloud = mix( cloud, uFogColor, ( 1. - smoothstep( .03, .32, h ) ) * ( .6 - .38 * uCloudLow ) );
			sky = mix( sky, cloud, cover );
		}
	}
	float disc = smoothstep( uSunCos.x, uSunCos.y, toSun ) * uSunDisc;
	if ( uEclipse > 0. ) {
		// A black sun in a ring of fire: the disc goes out, and a corona of
		// ragged streaks burns round it, brightest at its rim.
		float ang = atan( dot( d, normalize( cross( uSunDir, vec3( 0., 1., 0. ) ) + 1e-4 ) ), d.y - uSunDir.y * toSun );
		float rays = .55 + .45 * fbm( vec2( ang * 5.5, uTime * .05 ) );
		float rim = smoothstep( uSunCos.x - ( 1. - uSunCos.x ) * 2.4 * rays, uSunCos.x, toSun ) * ( 1. - disc );
		sky += uSunColor * rim * 1.6 * uEclipse * uSunDisc;
		sky = mix( sky + uSunColor * disc, vec3( .004, .001, .001 ), disc * uEclipse );
	} else sky += uSunColor * disc;
	if ( uBlood > 0. ) sky = mix( sky, uBloodColor * ( .25 + .75 * smoothstep( -.1, .6, h ) + glow * .02 ), uBlood * .65 );
	sky = mix( sky, uFogColor, ( 1. - smoothstep( 0., .1, abs( h ) ) ) * .7 );
	if ( uDim > 0. ) sky = mix( sky, uDimColor * ( .55 + .45 * smoothstep( -.1, .6, h ) ), uDim * .88 );
	sky = max( sky, vec3( .03 * uLookSilhouette ) );
	gl_FragColor = vec4( sky, 1. );
}`;
