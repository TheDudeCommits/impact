import * as THREE from 'three';
import type { StageId } from '../../game/stages';
import type { LookPreset } from './stageLooks';
import type { SkyDome } from './SkyDome';
import { COOKIE_GLSL, cookieUniforms } from './lightCookie';

export interface MoteLife {
  count: number;
  box: readonly [number, number, number];
  lead: number;
  floor: number;
  size: number;
  color: number; glow: number;
  shade: number;
  wind: readonly [number, number, number]; swirl: number;
}

export interface ShaftLife {
  beams: readonly (readonly [x: number, z: number, halfWidth: number, strength: number])[];
  height: number;
  color?: number; glow: number; strength: number;
  guard: number;
}

export interface CloudLife {
  speed: number;
  billow: number;
  low: number;
}

export interface StageLifeConfig { motes?: MoteLife; shafts?: ShaftLife; clouds?: CloudLife }

export const STAGE_LIFE: Partial<Record<StageId, StageLifeConfig>> = {
  'kami-lookout': {
    motes: {
      count: 1400, box: [26, 10, 26], lead: 8, floor: .2, size: .045, color: 0xfff0d2, glow: 8, shade: .4,
      wind: [.3, .05, .12], swirl: 1.1,
    },
    shafts: {
      beams: [
        [-6, -34, 4.6, .6], [24, -30, 4.2, .55],
        [-34, -24, 1.7, 1], [-22, -30, 1.5, .9], [-12, -26, 2, .8], [4, -24, 1.6, 1], [12, -38, 2.1, .9], [32, -34, 1.7, .85],
        [40, -20, 1.8, .8], [-44, -12, 1.7, .7],
        [-40, 14, 2.4, .6], [40, 18, 2.2, .6], [-16, 36, 2.6, .5], [20, 38, 2.2, .5],
      ],
      height: 34, glow: 2.2, strength: .7, guard: 7,
    },
    clouds: { speed: 6, billow: .006, low: 1 },
  },
};

export const MAX_MOTES = 1400;
export const MAX_BEAMS = 14;

const SHARED_GLSL = `
uniform float uTime;
uniform vec3 uSun;
uniform float uDim;
uniform vec3 uFocus;
uniform float uGuard;
uniform float uBeamCount;
uniform vec4 uBeamS[ MAX_BEAMS ];
uniform vec4 uBeamD[ MAX_BEAMS ];
uniform vec4 uBeamK[ MAX_BEAMS ];
${COOKIE_GLSL}
// How much of the sun gets down along one shaft: its line meets the cloud layer at one point, wherever on it we look.
float beamGate( vec4 s ) {
	if ( uCloudOn < .5 ) return 1.;
	return mix( .5, 1., smoothstep( uCloud.w + .03, 1., lookCloud( s.xyz ) ) );
}`;

export class StageLife {
  readonly group = new THREE.Group();
  private readonly motes: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly shafts: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly beamS = Array.from({ length: MAX_BEAMS }, () => new THREE.Vector4());
  private readonly beamD = Array.from({ length: MAX_BEAMS }, () => new THREE.Vector4());
  private readonly beamK = Array.from({ length: MAX_BEAMS }, () => new THREE.Vector4());
  private readonly shared = {
    uTime: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uDim: { value: 0 }, uBeamCount: { value: 0 },
    uFocus: { value: new THREE.Vector3() }, uGuard: { value: 7 },
    uBeamS: { value: this.beamS }, uBeamD: { value: this.beamD }, uBeamK: { value: this.beamK },
    ...cookieUniforms,
  };
  private readonly moteUniforms = {
    ...this.shared,
    uCamera: { value: new THREE.Vector3() }, uOrigin: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(30, 11, 30) },
    uWind: { value: new THREE.Vector3() }, uSwirl: { value: 1 }, uSize: { value: .04 }, uPx: { value: 800 },
    uShade: { value: .3 }, uGlow: { value: 2 }, uColor: { value: new THREE.Color() },
  };
  private readonly shaftUniforms = {
    ...this.shared,
    uColor: { value: new THREE.Color() }, uOpacity: { value: .4 },
  };
  private config?: StageLifeConfig;
  private quality: 'high' | 'medium' | 'low' = 'high';
  private effects = 1;
  private beams = 0;
  private lead = new THREE.Vector3(0, 0, -1);
  private readonly forward = new THREE.Vector3();
  private readonly sun = new THREE.Vector3();
  private readonly eye = new THREE.Vector3();
  private readonly frustum = new THREE.Frustum();
  private readonly viewProjection = new THREE.Matrix4();
  private readonly bound = new THREE.Sphere();
  private readonly bounds = new Float32Array(MAX_BEAMS * 4);

  constructor(scene: THREE.Scene, private readonly sky: SkyDome, private readonly canvas: HTMLCanvasElement) {
    this.group.name = 'look-stage-life';
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3));
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const seeds = new Float32Array(MAX_MOTES * 4);
    let s = 24681;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
    quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    quad.instanceCount = 0;
    this.motes = new THREE.Mesh(quad, new THREE.ShaderMaterial({
      name: 'LifeMotes', uniforms: this.moteUniforms, vertexShader: MOTE_VERTEX, fragmentShader: MOTE_FRAGMENT,
      defines: { MAX_BEAMS }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      fog: false, toneMapped: false, side: THREE.DoubleSide,
    }));

    const corners: number[] = [], index: number[] = [];
    for (let b = 0; b < MAX_BEAMS; b++) {
      corners.push(-1, 0, b, 1, 0, b, 1, 1, b, -1, 1, b);
      index.push(b * 4, b * 4 + 1, b * 4 + 2, b * 4, b * 4 + 2, b * 4 + 3);
    }
    const ribbons = new THREE.BufferGeometry();
    ribbons.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3));
    ribbons.setIndex(index);
    ribbons.setDrawRange(0, 0);
    this.shafts = new THREE.Mesh(ribbons, new THREE.ShaderMaterial({
      name: 'LifeShafts', uniforms: this.shaftUniforms, vertexShader: SHAFT_VERTEX, fragmentShader: SHAFT_FRAGMENT,
      defines: { MAX_BEAMS }, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      fog: false, toneMapped: false, side: THREE.DoubleSide,
    }));
    for (const mesh of [this.motes, this.shafts]) { mesh.frustumCulled = false; this.group.add(mesh); }
    this.motes.renderOrder = 5; this.shafts.renderOrder = 4;
    this.group.visible = false;
    scene.add(this.group);
  }

  setStage(stage: StageId, look: LookPreset) {
    const c = this.config = STAGE_LIFE[stage];
    this.sky.setLife(c?.clouds);
    this.group.visible = !!c;
    if (!c) return;
    const d = look.sky.sunDir ?? look.key.dir;
    this.sun.set(d[0], d[1], d[2]).normalize();
    this.shared.uSun.value.copy(this.sun);
    const m = c.motes, u = this.moteUniforms;
    if (m) {
      u.uBox.value.set(m.box[0], m.box[1], m.box[2]);
      u.uWind.value.set(m.wind[0], m.wind[1], m.wind[2]);
      u.uSwirl.value = m.swirl; u.uSize.value = m.size; u.uShade.value = m.shade; u.uGlow.value = m.glow;
      u.uColor.value.setHex(m.color);
    }
    const sh = c.shafts;
    this.beams = 0;
    if (sh) {
      this.beams = Math.min(MAX_BEAMS, sh.beams.length);
      const lift = 1 / Math.max(this.sun.y, .25), top = sh.height * lift, foot = 1.5 * lift;
      for (let i = 0; i < this.beams; i++) {
        const [x, z, w, k] = sh.beams[i];
        this.beamS[i].set(x + this.sun.x * top, this.sun.y * top, z + this.sun.z * top, w);
        this.beamD[i].set(-this.sun.x, -this.sun.y, -this.sun.z, top + foot);
        this.beamK[i].set(k, i * .173 + .1, 0, 0);
        const reach = (top + foot) * .5;
        this.bounds.set([x + this.sun.x * (top - reach), this.sun.y * (top - reach), z + this.sun.z * (top - reach), reach + w], i * 4);
      }
      this.shaftUniforms.uColor.value.setHex(sh.color ?? look.key.color).multiplyScalar(sh.glow);
      this.shaftUniforms.uOpacity.value = sh.strength;
      this.shared.uGuard.value = sh.guard;
    }
    this.apply();
  }

  set enabled(on: boolean) {
    this.group.visible = on && !!this.config;
    this.sky.setLife(on ? this.config?.clouds : undefined);
  }

  setQuality(quality: 'high' | 'medium' | 'low', effects: number) {
    this.quality = quality;
    this.effects = Math.max(0, Math.min(1, effects));
    this.apply();
  }

  private apply() {
    const c = this.config;
    if (!c) return;
    const q = this.quality, e = this.effects;
    const motes = Math.round((c.motes?.count ?? 0) * (q === 'high' ? 1 : q === 'medium' ? .6 : .22) * e);
    this.motes.geometry.instanceCount = Math.min(MAX_MOTES, motes);
    this.motes.visible = motes > 0;
    const beams = q === 'low' || e <= .05 ? 0 : q === 'medium' ? Math.min(this.beams, 6) : this.beams;
    this.shared.uBeamCount.value = beams;
    this.shafts.geometry.setDrawRange(0, beams * 6);
    this.shafts.visible = beams > 0;
  }

  update(time: number, dt: number, camera: THREE.PerspectiveCamera, dim: number, focus: THREE.Vector3) {
    const c = this.config;
    if (!c || !this.group.visible) return;
    this.shared.uTime.value = time;
    this.shared.uDim.value = dim;
    const m = this.moteUniforms;
    this.shared.uFocus.value.copy(focus);
    const mc = c.motes;
    if (mc && this.motes.visible) {
      camera.getWorldDirection(this.forward);
      this.forward.y = 0;
      if (this.forward.lengthSq() > 1e-4) this.lead.lerp(this.forward.normalize(), 1 - Math.exp(-dt * 2.5)).normalize();
      this.eye.setFromMatrixPosition(camera.matrixWorld);
      m.uCamera.value.copy(this.eye);
      m.uOrigin.value.set(this.eye.x + this.lead.x * mc.lead - mc.box[0] * .5, mc.floor, this.eye.z + this.lead.z * mc.lead - mc.box[2] * .5);
      m.uPx.value = camera.projectionMatrix.elements[5] * this.canvas.height * .5;
    }
    let seen = false;
    const beams = this.shared.uBeamCount.value;
    if (beams > 0 && dim < .995) {
      this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      for (let i = 0; i < beams && !seen; i++) {
        this.bound.center.set(this.bounds[i * 4], this.bounds[i * 4 + 1], this.bounds[i * 4 + 2]);
        this.bound.radius = this.bounds[i * 4 + 3];
        seen = this.frustum.intersectsSphere(this.bound);
      }
    }
    this.shafts.visible = seen;
  }

  dispose() {
    for (const mesh of [this.motes, this.shafts]) { mesh.geometry.dispose(); mesh.material.dispose(); }
    this.sky.setLife(undefined);
    this.group.removeFromParent();
  }
}

const MOTE_VERTEX = `
uniform vec3 uCamera;
uniform vec3 uOrigin;
uniform vec3 uBox;
uniform vec3 uWind;
uniform float uSwirl;
uniform float uSize;
uniform float uPx;
uniform float uShade;
uniform float uGlow;
attribute vec4 aSeed;
varying vec2 vQuad;
varying float vRand;
varying float vBright;
varying float vBokeh;
${SHARED_GLSL}
void main() {
	float rnd = aSeed.w;
	// Where this mote is in the window: a seed, carried on the wind, wrapped round the box.
	vec3 p = aSeed.xyz * uBox + uWind * uTime * ( .7 + .6 * rnd );
	vec3 q = mod( p - uOrigin, uBox ) / uBox;
	vec3 world = uOrigin + q * uBox;
	// The air's swirl is a function of where the mote is, so neighbours move together; each also circles a little of its own.
	vec3 flow = vec3(
		sin( world.z * .23 + uTime * .21 ) + .6 * sin( world.y * .5 - uTime * .33 ),
		.35 * sin( world.x * .19 + world.z * .13 + uTime * .17 ),
		cos( world.x * .21 - uTime * .19 ) + .6 * cos( world.y * .45 + uTime * .27 ) );
	world += flow * uSwirl;
	float a = uTime * ( .25 + rnd * .5 ) + rnd * 40.;
	world += vec3( sin( a ), sin( a * 1.3 + 2. ) * .5, cos( a ) ) * ( .12 + .3 * fract( rnd * 9.7 ) );
	float edge = smoothstep( 0., .14, q.x ) * smoothstep( 1., .86, q.x ) * smoothstep( 0., .14, q.z ) * smoothstep( 1., .86, q.z )
		* smoothstep( 0., .1, q.y ) * smoothstep( 1., .75, q.y );
	vec4 mv = viewMatrix * vec4( world, 1. );
	float depth = max( - mv.z, .05 );
	// Nothing drifts across the lens, and the far air thins out.
	float fade = edge * smoothstep( 1., 3.4, depth ) * ( 1. - smoothstep( 20., 34., depth ) );
	// The sun on it: inside a shaft, outside a cloud's shadow, and more looking toward the sun.
	float inBeam = 0.;
	for ( int i = 0; i < MAX_BEAMS; i ++ ) {
		if ( float( i ) >= uBeamCount ) break;
		vec4 s = uBeamS[ i ], dir = uBeamD[ i ], k = uBeamK[ i ];
		vec3 d = world - s.xyz;
		float t = dot( d, dir.xyz );
		vec3 perp = d - dir.xyz * t;
		float r = length( perp ) / ( s.w * 1.1 );
		float along = smoothstep( 0., dir.w * .12, t ) * ( 1. - smoothstep( dir.w * .8, dir.w, t ) );
		inBeam = max( inBeam, exp( - r * r * 1.6 ) * along * k.x * beamGate( s ) );
	}
	float sunlit = mix( .45, 1., smoothstep( .3, 1., lookCloud( world ) ) );
	// Around the fight they thin out: a speck by a fist must never read as a spark.
	vec3 off = world - uFocus;
	float clear = 1. - .65 * exp( - dot( off, off ) / ( uGuard * uGuard * .6 ) );
	float toward = pow( max( dot( normalize( world - uCamera ), uSun ), 0. ), 3. );
	float bright = uGlow * ( uShade + ( 1. - uShade ) * inBeam ) * sunlit * clear * ( .7 + .6 * toward ) * ( 1. - .55 * uDim );
	// A few pixels across, never less (a sub-pixel speck shimmers); the near ones are out of focus: wider, softer, dimmer.
	float px = uSize * uPx / depth * 2.;
	float bokeh = smoothstep( 5., 2., depth );
	float diameter = max( px, 2.8 ) * ( 1. + 1.1 * bokeh );
	bright *= mix( .4, 1., clamp( px / 2.8, 0., 1. ) ) / ( 1. + 4. * bokeh );
	mv.xy += position.xy * diameter * depth / uPx;
	gl_Position = projectionMatrix * mv;
	vQuad = position.xy * 2.;
	vRand = rnd;
	vBokeh = bokeh;
	vBright = bright * fade;
}`;

const MOTE_FRAGMENT = `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vQuad;
varying float vRand;
varying float vBright;
varying float vBokeh;
void main() {
	float r = length( vQuad );
	if ( r > 1. ) discard;
	float speck = pow( 1. - r, 1.8 );
	float disc = smoothstep( 1., .74, r ) * ( .5 + .5 * smoothstep( .3, .85, r ) );
	float shape = mix( speck, disc, vBokeh * .45 );
	float twinkle = .8 + .2 * sin( uTime * ( 1.1 + vRand * 2.2 ) + vRand * 50. );
	vec3 tint = mix( uColor, vec3( 1. ), .35 * fract( vRand * 13.7 ) );
	gl_FragColor = vec4( tint * shape * twinkle * vBright, 1. );
}`;

const SHAFT_VERTEX = `
varying float vAcross;
varying float vAlong;
varying float vGain;
varying float vView;
varying vec3 vWorld;
varying vec3 vInfo;
${SHARED_GLSL}
void main() {
	int i = int( position.z + .5 );
	vec4 s = uBeamS[ i ], dir = uBeamD[ i ], k = uBeamK[ i ];
	vec3 p = s.xyz + dir.xyz * ( position.y * dir.w );
	vec3 toCamera = cameraPosition - p;
	toCamera /= max( length( toCamera ), 1e-3 );
	vec3 side = cross( dir.xyz, toCamera );
	side /= max( length( side ), 1e-3 );
	p += side * position.x * s.w;
	vec4 mv = viewMatrix * vec4( p, 1. );
	gl_Position = projectionMatrix * mv;
	// A ribbon is only a beam from the side: looking down its length it collapses to a bright slab, so it fades out as the view lines up with it.
	float facing = 1. - smoothstep( .78, .96, abs( dot( dir.xyz, toCamera ) ) );
	vGain = k.x * beamGate( s ) * facing * ( 1. - uDim );
	vAcross = position.x;
	vAlong = position.y;
	vView = - mv.z;
	vWorld = p;
	vInfo = vec3( k.y, s.w, dir.w );
}`;

const SHAFT_FRAGMENT = `
uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
uniform vec3 uFocus;
uniform float uGuard;
varying float vAcross;
varying float vAlong;
varying float vGain;
varying float vView;
varying vec3 vWorld;
varying vec3 vInfo;
float h2( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float vn( vec2 p ) {
	vec2 i = floor( p ), f = fract( p );
	vec2 u = f * f * ( 3. - 2. * f );
	return mix( mix( h2( i ), h2( i + vec2( 1., 0. ) ), u.x ), mix( h2( i + vec2( 0., 1. ) ), h2( i + vec2( 1., 1. ) ), u.x ), u.y );
}
void main() {
	float x = vAcross;
	// Across: a smooth swell to nothing at the edges, so there is no edge to see.
	float profile = exp( - 2.2 * x * x ) * ( 1. - smoothstep( .72, 1., abs( x ) ) );
	// Within it, a handful of distinct rays with dark gaps between them, straight along the beam and drifting sideways very slowly.
	float seed = vInfo.x, hw = vInfo.y, len = vInfo.z;
	float across = x * hw;
	float r1 = vn( vec2( across * .42 + seed * 31. + uTime * .03, vAlong * len * .012 - uTime * .02 ) );
	float r2 = vn( vec2( across * .95 - uTime * .025 + seed * 7., vAlong * len * .02 + uTime * .015 ) );
	float streak = ( .1 + 1.2 * smoothstep( .24, .86, r1 ) ) * ( .62 + .55 * r2 );
	float swell = .78 + .22 * sin( vAlong * 9. - uTime * .32 + seed * 20. );
	float breathe = .82 + .18 * sin( uTime * .4 + seed * 25. );
	float topIn = smoothstep( 0., .24, vAlong );
	float floorFade = smoothstep( -.2, 3.6, vWorld.y );
	float nearFade = smoothstep( 2.5, 10., vView );
	float farFade = 1. - smoothstep( 70., 170., distance( vWorld, cameraPosition ) );
	vec3 off = vWorld - uFocus;
	float guard = 1. - .75 * exp( - dot( off, off ) / ( uGuard * uGuard ) );
	float a = profile * streak * swell * breathe * topIn * floorFade * nearFade * farFade * guard * vGain * uOpacity;
	// A touch of noise, so the long gradients do not band in the half-float target.
	a *= 1. + ( h2( gl_FragCoord.xy ) - .5 ) * .08;
	gl_FragColor = vec4( uColor, clamp( a, 0., .85 ) );
}`;
