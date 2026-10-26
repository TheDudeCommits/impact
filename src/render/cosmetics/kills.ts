import * as THREE from 'three';
import { NOISE, auraShared } from './auras';

export interface KillFx {
  readonly root: THREE.Object3D;
  emit(x: number, y: number, z: number, full: boolean, time: number, eye: number): void;
  dispose(): void;
}

const MOTE_VERTEX = `
uniform float uAuraTime;
uniform float uAuraHeight;
uniform vec3 uPull;
uniform float uDrag;
uniform vec2 uSway;
attribute vec3 aVel;
/** Born (s), a seed, its size (m), its life (s). */
attribute vec4 aBorn;
varying float vAge; varying float vSeed; varying float vT;
/** Which way it moves on the screen (y up). */
varying vec2 vDir;
void main() {
	float t = uAuraTime - aBorn.x;
	vAge = t / aBorn.w; vSeed = aBorn.y; vT = t;
	float k = max( uDrag, 1e-3 ), slow = ( 1. - exp( -k * t ) ) / k;
	vec3 p = position + aVel * slow + .5 * uPull * t * t;
	float sway = min( 1., t * 2. );
	p.x += sin( aBorn.y * 41. + t * uSway.y ) * uSway.x * sway;
	p.z += cos( aBorn.y * 23. + t * uSway.y * .83 ) * uSway.x * sway;
	vec3 v = aVel * exp( -k * t ) + uPull * t;
	vec4 here = projectionMatrix * viewMatrix * vec4( p, 1. ), ahead = projectionMatrix * viewMatrix * vec4( p + v * .05, 1. );
	vec2 d = ahead.xy / max( ahead.w, 1e-3 ) - here.xy / max( here.w, 1e-3 );
	d.x *= projectionMatrix[ 1 ][ 1 ] / projectionMatrix[ 0 ][ 0 ];
	vDir = length( d ) > 1e-5 ? normalize( d ) : vec2( 1., 0. );
	gl_Position = here;
	float alive = step( 0., vAge ) * step( vAge, 1. );
	gl_PointSize = alive * aBorn.z * projectionMatrix[ 1 ][ 1 ] * uAuraHeight * .5 / max( .1, here.w );
}`;
const ALONG = `
vec2 along( vec2 d ) { vec2 p = ( gl_PointCoord - .5 ) * 2.; p.y = -p.y; return vec2( dot( p, d ), dot( p, vec2( -d.y, d.x ) ) ); }
`;

class KillMotes {
  readonly points: THREE.Points;
  private readonly start: THREE.BufferAttribute; private readonly vel: THREE.BufferAttribute; private readonly born: THREE.BufferAttribute;
  private next = 0;
  constructor(private readonly count: number, fragment: string, options: { pull?: [number, number, number]; drag?: number; sway?: [number, number]; uniforms?: Record<string, THREE.IUniform>; order?: number }) {
    const geometry = new THREE.BufferGeometry();
    this.start = new THREE.BufferAttribute(new Float32Array(count * 3), 3); this.vel = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.born = new THREE.BufferAttribute(new Float32Array(count * 4).fill(-1e6), 4);
    for (const attribute of [this.start, this.vel, this.born]) attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.start); geometry.setAttribute('aVel', this.vel); geometry.setAttribute('aBorn', this.born);
    const material = new THREE.ShaderMaterial({ vertexShader: MOTE_VERTEX, fragmentShader: NOISE + ALONG + fragment, transparent: true, depthWrite: false, toneMapped: false, fog: false,
      uniforms: { ...auraShared, uPull: { value: new THREE.Vector3(...(options.pull ?? [0, 0, 0])) }, uDrag: { value: options.drag ?? 0 }, uSway: { value: new THREE.Vector2(...(options.sway ?? [0, 1])) }, ...options.uniforms } });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false; this.points.renderOrder = options.order ?? 6;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, time: number, size: number, life: number) {
    const i = this.next; this.next = (i + 1) % this.count;
    this.start.setXYZ(i, x, y, z); this.vel.setXYZ(i, vx, vy, vz); this.born.setXYZW(i, time, Math.random(), size, life);
    this.start.needsUpdate = this.vel.needsUpdate = this.born.needsUpdate = true;
  }
  dispose() { this.points.removeFromParent(); this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose(); }
}

const DECAL_VERTEX = `
uniform float uAuraTime;
/** Where (x, y, z) and how wide (m). */
attribute vec4 aSpot;
/** Born (s), a seed, its life (s), and whether it is the whole effect (1) or its echo (0). */
attribute vec4 aBorn;
/** Its heading: the way the top of what it letters faces. */
attribute float aTurn;
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vFull; varying float vT;
void main() {
	vUv = uv; vSeed = aBorn.y; vFull = aBorn.w;
	vT = uAuraTime - aBorn.x; vAge = vT / aBorn.z;
	float c = cos( aTurn ), s = sin( aTurn );
	// (The quad's x to the eye's right as it faced then, its y away from it.)
	vec2 g = ( position.x * vec2( -c, s ) + position.y * vec2( s, c ) ) * aSpot.w;
	gl_Position = projectionMatrix * viewMatrix * vec4( aSpot.x + g.x, aSpot.y + .03, aSpot.z + g.y, 1. );
	if ( vAge < 0. || vAge > 1. ) gl_Position = vec4( 2., 2., 2., 1. );
}`;
class Decals {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly spot: THREE.InstancedBufferAttribute; private readonly born: THREE.InstancedBufferAttribute; private readonly turn: THREE.InstancedBufferAttribute;
  private next = 0;
  constructor(private readonly count: number, fragment: string, uniforms: Record<string, THREE.IUniform> = {}, order = 4) {
    const quad = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index; geometry.setAttribute('position', quad.getAttribute('position')); geometry.setAttribute('uv', quad.getAttribute('uv'));
    this.spot = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4); this.born = new THREE.InstancedBufferAttribute(new Float32Array(count * 4).fill(-1e6), 4);
    this.turn = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    for (const attribute of [this.spot, this.born, this.turn]) attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aSpot', this.spot); geometry.setAttribute('aBorn', this.born); geometry.setAttribute('aTurn', this.turn);
    geometry.instanceCount = count;
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ vertexShader: DECAL_VERTEX, fragmentShader: NOISE + fragment, transparent: true, depthWrite: false, toneMapped: false, fog: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, uniforms: { ...auraShared, ...uniforms } }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
  }
  emit(x: number, y: number, z: number, size: number, time: number, life: number, full: boolean, turn = Math.random() * Math.PI * 2) {
    const i = this.next; this.next = (i + 1) % this.count;
    this.spot.setXYZW(i, x, y, z, size); this.born.setXYZW(i, time, Math.random(), life, full ? 1 : 0); this.turn.setX(i, turn);
    this.spot.needsUpdate = this.born.needsUpdate = this.turn.needsUpdate = true;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
function thrown(out: [number, number], up: [number, number]) { const a = Math.random() * Math.PI * 2, s = rand(...out); return [Math.cos(a) * s, rand(...up), Math.sin(a) * s] as const; }

const BLOT = `
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vFull; varying float vT;
void main() {
	vec2 p = ( vUv - .5 ) * 2.;
	float r = length( p ), a = atan( p.y, p.x );
	// Thrown down in a tenth of a second: a heavy black core, its edge lumpy where the ink landed hardest.
	float grow = smoothstep( 0., .1, vT );
	float edge = .4 * grow * ( .7 + .3 * noise( vec2( a * 1.7 + vSeed * 40., vSeed * 9. ) ) + .12 * noise( vec2( a * 6.5, vSeed * 3. ) ) );
	float core = 1. - smoothstep( edge - .012, edge + .012, r );
	// Then it soaks in: the water carries a grey fringe out past the ink, feathered by the paper's fibres.
	float soak = smoothstep( .04, .45, vAge ) * .22;
	float fibre = noise( p * 16. + vSeed * 30. ) * .55 + noise( vec2( a * 24., r * 5. ) ) * .45;
	float bleed = ( 1. - smoothstep( edge, edge + soak * ( .5 + fibre ), r ) ) * ( 1. - core );
	// Spatter: drops flung out round it, some drawn out into tears along the way they flew.
	float cells = 28., u = a / 6.2831853 * cells + vSeed * 7., cell = floor( u );
	float h = hash( vec2( cell, vSeed * 13. ) ), h2 = hash( vec2( cell, vSeed * 5. + 2. ) ), h3 = hash( vec2( cell, vSeed * 3. + 7. ) );
	float out_ = ( .5 + .45 * h2 ) * grow, across = ( fract( u ) - .5 ) / cells * 6.2831853 * r;
	float size = .014 + .04 * h3, long_ = 1. + step( .7, h ) * ( 1.5 + 2.5 * h2 );
	float drop = step( .4, h ) * ( 1. - smoothstep( .8, 1.05, length( vec2( across / size, ( r - out_ ) / ( size * long_ ) ) ) ) );
	float ink = max( core, drop ) * ( .86 + .14 * noise( p * 30. + vSeed * 20. ) );
	float alpha = max( ink, bleed * .3 ) * ( 1. - smoothstep( .66, 1., vAge ) );
	if ( alpha < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .32, .32, .36 ), vec3( .018, .018, .03 ), step( .5, max( core, drop ) ) ), alpha );
}`;
const DROP = `
varying float vAge; varying float vSeed; varying vec2 vDir;
void main() {
	vec2 q = along( vDir ); q.x /= 1.7;
	float a = ( 1. - smoothstep( .52, .66, length( q ) ) ) * ( 1. - smoothstep( .85, 1., vAge ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( vec3( .015, .015, .028 ), a );
}`;
class Soak implements KillFx {
  readonly root = new THREE.Group();
  private readonly blots = new Decals(96, BLOT);
  private readonly drops = new KillMotes(360, DROP, { pull: [0, -11, 0], drag: .6 });
  constructor() { this.root.add(this.blots.mesh, this.drops.points); }
  emit(x: number, y: number, z: number, full: boolean, time: number) {
    this.blots.emit(x, y, z, full ? rand(2.6, 3.1) : rand(1.1, 1.5), time, full ? 3.4 : 1.9, full);
    for (let i = full ? 18 : 6; i > 0; i--) { const [vx, vy, vz] = thrown(full ? [2, 6] : [1.4, 3.6], full ? [3, 7] : [2, 4.5]); this.drops.emit(x, y + rand(.5, 1.2), z, vx, vy, vz, time, rand(.08, .17), rand(.55, .9)); }
  }
  dispose() { this.blots.dispose(); this.drops.dispose(); this.root.removeFromParent(); }
}

const DOTS = `
float tone( vec2 p, float pitch, float cover ) {
	vec2 g = mat2( .7071, -.7071, .7071, .7071 ) * p * pitch;
	float d = length( fract( g ) - .5 ), r = sqrt( clamp( cover, 0., 1. ) ) * .62;
	return ( 1. - smoothstep( r - .07, r + .07, d ) ) * step( .01, cover );
}
// Three printings, each a little off the others: black over cyan over magenta.
vec4 printed( vec2 p, float pitch, float cover, vec2 off ) {
	float k = tone( p, pitch, cover ), c = tone( p + off, pitch, cover * .8 ), m = tone( p - off * vec2( 1., -1.2 ), pitch, cover * .8 );
	vec3 col = vec3( 1. );
	col *= mix( vec3( 1. ), vec3( 0., .63, .9 ), c );
	col *= mix( vec3( 1. ), vec3( .92, .1, .52 ), m );
	col = mix( col, vec3( .03 ), k );
	return vec4( col, max( k, max( c, m ) * .95 ) );
}
`;
const PATCH = DOTS + `
varying float vAge; varying float vSeed; varying vec2 vDir;
void main() {
	vec2 p = ( gl_PointCoord - .5 ) * 2.;
	float r = length( p );
	// A round patch of tone, thinning from its edge in as it goes.
	float cover = clamp( ( 1. - r ) * 1.6 - vAge * 1.25, 0., 1. ) * .9;
	vec4 ink = printed( p, 3.2 + vSeed * 1.5, cover, vec2( .09, .05 ) );
	float a = ink.a * ( 1. - smoothstep( .8, 1., vAge ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( ink.rgb, a );
}`;
const PRINT = DOTS + `
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vFull; varying float vT;
void main() {
	vec2 p = ( vUv - .5 ) * 2.;
	float r = length( p );
	// Printed in a blink, from the middle out; then each dot shrinks away, the outer ones first.
	float press = smoothstep( 0., .09, vT );
	float cover = clamp( ( 1. - r / max( .01, press ) ) * 1.35 + .1, 0., 1. ) * step( r, press ) * ( 1. - smoothstep( .2, 1., vAge + r * .25 ) );
	vec4 ink = printed( p, 7.5, cover, vec2( .045, .025 ) );
	if ( ink.a < .02 ) discard;
	gl_FragColor = vec4( ink.rgb, ink.a );
}`;
class Screentone implements KillFx {
  readonly root = new THREE.Group();
  private readonly prints = new Decals(80, PRINT);
  private readonly patches = new KillMotes(240, PATCH, { pull: [0, .6, 0], drag: 2.4, sway: [.15, 2] });
  constructor() { this.root.add(this.prints.mesh, this.patches.points); }
  emit(x: number, y: number, z: number, full: boolean, time: number) {
    this.prints.emit(x, y, z, full ? rand(2.8, 3.4) : rand(1.2, 1.6), time, full ? 2.2 : 1.3, full);
    for (let i = full ? 14 : 5; i > 0; i--) { const [vx, vy, vz] = thrown(full ? [2.5, 7] : [1.6, 4], full ? [1, 5] : [.8, 3]); this.patches.emit(x, y + rand(.4, 1.5), z, vx, vy, vz, time, full ? rand(.5, .95) : rand(.34, .55), rand(.7, 1.15)); }
  }
  dispose() { this.prints.dispose(); this.patches.dispose(); this.root.removeFromParent(); }
}

const CRANE = `
varying float vAge; varying float vSeed; varying float vT; varying vec2 vDir;
float tri( vec2 p, vec2 a, vec2 b, vec2 c ) {
	vec2 e0 = b - a, e1 = c - b, e2 = a - c, v0 = p - a, v1 = p - b, v2 = p - c;
	vec2 pq0 = v0 - e0 * clamp( dot( v0, e0 ) / dot( e0, e0 ), 0., 1. ), pq1 = v1 - e1 * clamp( dot( v1, e1 ) / dot( e1, e1 ), 0., 1. ), pq2 = v2 - e2 * clamp( dot( v2, e2 ) / dot( e2, e2 ), 0., 1. );
	float s = sign( e0.x * e2.y - e0.y * e2.x );
	vec2 d = min( min( vec2( dot( pq0, pq0 ), s * ( v0.x * e0.y - v0.y * e0.x ) ), vec2( dot( pq1, pq1 ), s * ( v1.x * e1.y - v1.y * e1.x ) ) ), vec2( dot( pq2, pq2 ), s * ( v2.x * e2.y - v2.y * e2.x ) ) );
	return -sqrt( d.x ) * sign( d.y );
}
void main() {
	vec2 p = ( gl_PointCoord - .5 ) * 2.2; p.y = -p.y;
	// Seen side on, heading the way it flies (level-ish: a crane does not climb nose up).
	p.x *= vDir.x < 0. ? -1. : 1.;
	float tilt = clamp( atan( vDir.y, abs( vDir.x ) ), -.45, .45 ), c = cos( tilt ), s = sin( tilt );
	p = mat2( c, -s, s, c ) * p;
	float flap = sin( vT * ( 11. + vSeed * 5. ) + vSeed * 20. );
	float body = min( tri( p, vec2( -.34, .02 ), vec2( .34, .02 ), vec2( 0., -.2 ) ), tri( p, vec2( -.24, .02 ), vec2( .26, .02 ), vec2( .02, .12 ) ) );
	float neck = tri( p, vec2( .18, -.02 ), vec2( .3, .02 ), vec2( .66, .5 ) ), head = tri( p, vec2( .6, .44 ), vec2( .68, .52 ), vec2( .8, .36 ) );
	float tail = tri( p, vec2( -.3, .02 ), vec2( -.16, -.02 ), vec2( -.7, .44 ) );
	float wing = tri( p, vec2( -.28, .03 ), vec2( .26, .03 ), vec2( -.1, .86 * flap ) );
	float flap2 = sin( vT * ( 11. + vSeed * 5. ) + vSeed * 20. - .7 );
	float far_ = tri( p, vec2( -.2, .05 ), vec2( .22, .05 ), vec2( .04, .74 * flap2 ) );
	float shape = min( min( min( body, wing ), far_ ), min( min( neck, head ), tail ) );
	float a = ( 1. - smoothstep( -.005, .02, shape ) ) * smoothstep( 0., .06, vAge ) * ( 1. - smoothstep( .8, 1., vAge ) );
	if ( a < .02 ) discard;
	// Washi of five colours, a fold's shade on the wing turned down, and an ink line round it all.
	float pick = floor( fract( vSeed * 7.31 ) * 5. );
	vec3 paper = pick < 1. ? vec3( .86, .12, .12 ) : pick < 2. ? vec3( .96, .95, .9 ) : pick < 3. ? vec3( .14, .26, .6 ) : pick < 4. ? vec3( .95, .66, .14 ) : vec3( .96, .56, .66 );
	paper *= wing < 0. && flap < 0. ? .72 : 1.;
	paper *= far_ < 0. && wing > 0. && body > 0. ? .66 : 1.;
	paper *= 1. - .18 * smoothstep( -.06, .0, min( body, neck ) ) * step( .0, wing );
	float line = smoothstep( -.035, -.012, shape );
	gl_FragColor = vec4( mix( paper, vec3( .03 ), line ), a );
}`;
const SCRAP = `
varying float vAge; varying float vSeed; varying float vT;
void main() {
	vec2 p = ( gl_PointCoord - .5 ) * 2.;
	float spin = vSeed * 6.283 + vT * ( 6. + vSeed * 8. );
	p = mat2( cos( spin ), -sin( spin ), sin( spin ), cos( spin ) ) * p;
	p.y /= max( .15, abs( cos( vT * 9. + vSeed * 30. ) ) );
	float square = max( abs( p.x ), abs( p.y ) );
	float a = ( 1. - smoothstep( .5, .56, square ) ) * ( 1. - smoothstep( .75, 1., vAge ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .97, .96, .92 ), vec3( .05 ), smoothstep( .42, .5, square ) ), a );
}`;
class Cranes implements KillFx {
  readonly root = new THREE.Group();
  private readonly cranes = new KillMotes(160, CRANE, { pull: [0, 1.1, 0], drag: .9, sway: [.5, 2.2], order: 7 });
  private readonly scraps = new KillMotes(160, SCRAP, { pull: [0, -2.4, 0], drag: 1.6, sway: [.3, 3] });
  constructor() { this.root.add(this.cranes.points, this.scraps.points); }
  emit(x: number, y: number, z: number, full: boolean, time: number) {
    for (let i = full ? 13 : 2; i > 0; i--) { const [vx, vy, vz] = thrown(full ? [2.2, 5.5] : [1.5, 3], full ? [2.4, 5] : [2, 3.4]); this.cranes.emit(x + vx * .06, y + rand(.7, 1.4), z + vz * .06, vx, vy, vz, time + (full ? rand(0, .12) : 0), full ? rand(.95, 1.35) : rand(.75, .95), full ? rand(2.4, 3.2) : rand(1.5, 2)); }
    for (let i = full ? 16 : 3; i > 0; i--) { const [vx, vy, vz] = thrown([1, 4], [1.5, 4]); this.scraps.emit(x, y + rand(.5, 1.3), z, vx, vy, vz, time, rand(.08, .15), rand(.9, 1.5)); }
  }
  dispose() { this.cranes.dispose(); this.scraps.dispose(); this.root.removeFromParent(); }
}

const CRACKS = `
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vFull; varying float vT;
// How far a point is from the cracks: n lines out from the middle that zigzag as they go, and a few across.
float cracks( vec2 p, float seed, float n, out float k ) {
	float r = length( p ), a = atan( p.y, p.x );
	// (Zigzag: the line turns at a new angle every few centimetres out, straight between - short straight runs.)
	float t = r * 7. + seed * 3., i = floor( t ), f = fract( t ), lane = floor( a / 6.2831853 * n + seed * 3. );
	float jag = mix( hash( vec2( i, lane + seed * 7. ) ), hash( vec2( i + 1., lane + seed * 7. ) ), f ) - .5;
	float s = a / 6.2831853 * n + seed * 3. + ( jag * .42 + ( noise( vec2( r * 2.5, seed * 20. ) ) - .5 ) * .45 ) * smoothstep( .0, .3, r );
	k = floor( s );
	return abs( fract( s ) - .5 ) / n * 6.2831853 * r;
}
void main() {
	vec2 p = ( vUv - .5 ) * 2.;
	float r = length( p );
	// The ground breaks out from where they fell in a fifth of a second; the gold runs out along it behind.
	float reachNow = smoothstep( 0., .2, vT ), gold = clamp( ( vT - .08 ) / .5, 0., 1. );
	float k, k2;
	float d = cracks( p, vSeed, 6. + floor( vSeed * 3. ), k );
	// Branches: a second, finer set, only part of the way out.
	float d2 = cracks( p * 1.3 + .2, vSeed + 4.1, 9., k2 );
	float reach = ( .45 + .55 * hash( vec2( k, vSeed * 31. ) ) ) * reachNow, reach2 = ( .2 + .5 * hash( vec2( k2, vSeed * 11. ) ) ) * reachNow;
	float width = .03 * ( 1. - r / max( reach, .01 ) ) + .008;
	float main_ = ( 1. - smoothstep( width, width + .01, d ) ) * step( r, reach );
	float branch = ( 1. - smoothstep( width * .6, width * .6 + .008, d2 ) ) * step( r, reach2 ) * step( .5, hash( vec2( k2, vSeed * 5. ) ) );
	float crack = max( main_, branch );
	// The gold: a thinner line down the middle of each crack, once it has run that far.
	float inlay = max( ( 1. - smoothstep( width * .45, width * .45 + .006, d ) ) * main_, ( 1. - smoothstep( width * .3, width * .3 + .005, d2 ) ) * branch );
	float filled = inlay * step( r, gold * .95 + .04 );
	float glint = pow( max( 0., sin( r * 16. - vT * 10. + vSeed * 6. ) ), 10. ) * filled;
	vec3 col = mix( vec3( .05, .035, .02 ), vec3( .96, .64, .14 ) + vec3( 2.4, 1.9, 1. ) * glint, filled );
	float alpha = crack * ( 1. - smoothstep( .74, 1., vAge ) );
	if ( alpha < .02 ) discard;
	gl_FragColor = vec4( col, alpha );
}`;
const GLINT = `
varying float vAge; varying float vSeed; varying float vT;
void main() {
	vec2 p = ( gl_PointCoord - .5 ) * 2.;
	// A four-pointed glint that twinkles, gold with a brown edge.
	float tw = .55 + .45 * sin( vT * 18. + vSeed * 40. );
	float star = max( 1. - abs( p.x ) * 7. - abs( p.y ) * 1.1, 1. - abs( p.y ) * 7. - abs( p.x ) * 1.1 ) * tw;
	float core = 1. - smoothstep( .0, .32, length( p ) );
	float body = max( star, core * .9 );
	float a = smoothstep( .05, .35, body ) * smoothstep( 0., .1, vAge ) * ( 1. - smoothstep( .7, 1., vAge ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .45, .26, .02 ), vec3( 1., .82, .34 ) * 2.2, smoothstep( .3, .8, body ) ), a );
}`;
class Kintsugi implements KillFx {
  readonly root = new THREE.Group();
  private readonly cracks = new Decals(80, CRACKS);
  private readonly dust = new KillMotes(320, GLINT, { pull: [0, .7, 0], drag: 2.2, sway: [.2, 2.4] });
  private readonly flash = new KillMotes(24, GLINT, {});
  constructor() { this.root.add(this.cracks.mesh, this.dust.points, this.flash.points); }
  emit(x: number, y: number, z: number, full: boolean, time: number) {
    this.cracks.emit(x, y, z, full ? rand(3.2, 3.8) : rand(1.3, 1.7), time, full ? 3.8 : 2, full);
    for (let i = full ? 22 : 6; i > 0; i--) { const [vx, vy, vz] = thrown(full ? [.8, 3.4] : [.5, 1.8], full ? [1, 3.4] : [.8, 2]); this.dust.emit(x + vx * .15, y + rand(.1, 1.3), z + vz * .15, vx, vy, vz, time + rand(0, .15), rand(.1, .22), rand(1, 1.9)); }
    if (full) this.flash.emit(x, y + 1, z, 0, 0, 0, time + .04, 2.8, .32);
  }
  dispose() { this.cracks.dispose(); this.dust.dispose(); this.flash.dispose(); this.root.removeFromParent(); }
}

const SEAL_GLYPHS = '討斬滅殺終断鎮封';
let sealAtlas: THREE.CanvasTexture | undefined;
function sealTexture() {
  if (sealAtlas) return sealAtlas;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 128);
  c.font = '900 96px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Songti SC",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
  [...SEAL_GLYPHS].forEach((glyph, i) => c.fillText(glyph, i * 128 + 64, 70));
  sealAtlas = new THREE.CanvasTexture(canvas); sealAtlas.colorSpace = THREE.NoColorSpace; sealAtlas.generateMipmaps = true; sealAtlas.anisotropy = 4;
  return sealAtlas;
}
const SEAL_ROOM = 1.8;
const SEAL = `
uniform sampler2D uAtlas;
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vFull; varying float vT;
void main() {
	// Brought down from high in a tenth of a second, a small give as it lands, then pressed.
	float t = vT;
	float scale = t < .1 ? mix( 1.75, .95, t * t / .01 ) : mix( .95, 1., smoothstep( .1, .18, t ) );
	vec2 p = ( vUv - .5 ) * 2. * ${SEAL_ROOM.toFixed(2)} / scale;
	float ax = abs( p.x ), ay = abs( p.y ), box = max( ax, ay );
	// Where the stone did not take the ink: the stamp's own grain, and a lighter edge.
	float grain = noise( p * 9. + vSeed * 40. ) * .7 + noise( p * 27. + vSeed * 13. ) * .3;
	float took = step( .3, grain + .22 - smoothstep( .7, 1., box ) * .12 );
	float border = ( 1. - smoothstep( .035, .055, abs( box - .92 ) ) ) + ( 1. - smoothstep( .012, .026, abs( box - .79 ) ) ) * .9;
	vec2 cellUv = clamp( p * .5 * 1.12 + .5, 0., 1. );
	float glyph = texture2D( uAtlas, vec2( ( floor( vSeed * 8. ) + cellUv.x ) / 8., cellUv.y ) ).r * step( box, .76 );
	float ink = clamp( border + glyph, 0., 1. ) * step( box, .98 ) * took;
	// The whole one leaves a ring as it lands.
	float ring = vFull * ( 1. - smoothstep( .02, .06, abs( length( p ) * scale - mix( 1.05, 1.75, smoothstep( .1, .35, t ) ) ) ) ) * ( 1. - smoothstep( .12, .4, t ) ) * step( .1, t );
	float fall = smoothstep( 0., .06, t );
	float alpha = max( ink * fall, ring * .8 ) * ( 1. - smoothstep( .7, 1., vAge ) );
	if ( alpha < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .82, .1, .07 ), vec3( .95, .2, .1 ), grain * .3 ) * ( t < .1 ? .8 : 1. ), alpha );
}`;
const RED_DROP = `
varying float vAge; varying float vSeed; varying vec2 vDir;
void main() {
	vec2 q = along( vDir ); q.x /= 1.6;
	float a = ( 1. - smoothstep( .5, .66, length( q ) ) ) * ( 1. - smoothstep( .8, 1., vAge ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( vec3( .78, .07, .05 ), a );
}`;
class VermilionSeal implements KillFx {
  readonly root = new THREE.Group();
  private readonly seals = new Decals(64, SEAL, { uAtlas: { value: sealTexture() } }, 5);
  private readonly drops = new KillMotes(160, RED_DROP, { pull: [0, -11, 0], drag: .5 });
  constructor() { this.root.add(this.seals.mesh, this.drops.points); }
  emit(x: number, y: number, z: number, full: boolean, time: number, eye: number) {
    const side = full ? rand(2.1, 2.4) : rand(.8, .95);
    this.seals.emit(x, y, z, side * SEAL_ROOM, time, full ? 2.6 : 1.5, full, eye + rand(-.22, .22));
    if (full) for (let i = 0; i < 12; i++) { const [vx, vy, vz] = thrown([2.5, 5.5], [1.2, 3.2]); this.drops.emit(x, y + .15, z, vx, vy, vz, time + .1, rand(.07, .14), rand(.4, .7)); }
  }
  dispose() { this.seals.dispose(); this.drops.dispose(); this.root.removeFromParent(); }
}

export const KILL_IDS = ['kill-soak', 'kill-screentone', 'kill-cranes', 'kill-kintsugi', 'kill-seal'] as const;
export const KILL_SOUND: Partial<Record<string, 'bell' | 'thud'>> = { 'kill-kintsugi': 'bell', 'kill-seal': 'thud' };
export function makeKillFx(id: string): KillFx | undefined {
  switch (id) {
    case 'kill-soak': return new Soak();
    case 'kill-screentone': return new Screentone();
    case 'kill-cranes': return new Cranes();
    case 'kill-kintsugi': return new Kintsugi();
    case 'kill-seal': return new VermilionSeal();
    default: return undefined;
  }
}
