import * as THREE from 'three';

export const auraShared = { uAuraTime: { value: 0 }, uAuraHeight: { value: 1080 } };

export interface Aura {
  readonly root: THREE.Object3D;
  update(time: number, dt: number, at: THREE.Vector3, height: number, seen: boolean): void;
  level?(level: number): void;
  dispose(): void;
}

const MOTE_VERTEX = `
uniform float uAuraTime;
uniform float uAuraHeight;
uniform float uLife;
uniform vec2 uSize;
uniform vec3 uPull;
uniform vec2 uSway;
attribute vec3 aVel;
attribute vec2 aBorn;
varying float vAge;
varying float vSeed;
void main() {
	float age = uAuraTime - aBorn.x;
	vAge = age / uLife; vSeed = aBorn.y;
	vec3 p = position + aVel * age + uPull * age * age;
	p.x += sin( aBorn.y * 41. + age * uSway.y ) * uSway.x * min( 1., age * 2. );
	p.z += cos( aBorn.y * 23. + age * uSway.y * .83 ) * uSway.x * min( 1., age * 2. );
	vec4 mv = viewMatrix * vec4( p, 1. );
	gl_Position = projectionMatrix * mv;
	float alive = step( 0., vAge ) * step( vAge, 1. );
	gl_PointSize = alive * mix( uSize.x, uSize.y, vAge ) * ( .7 + .6 * fract( aBorn.y * 7.3 ) ) * projectionMatrix[ 1 ][ 1 ] * uAuraHeight * .5 / max( .1, -mv.z );
}`;

export class Motes {
  readonly points: THREE.Points;
  private readonly start: THREE.BufferAttribute; private readonly vel: THREE.BufferAttribute; private readonly born: THREE.BufferAttribute;
  private next = 0;
  private owed = 0;
  constructor(private readonly count: number, fragment: string, options: { life: number; size: [number, number]; pull?: [number, number, number]; sway?: [number, number]; uniforms?: Record<string, THREE.IUniform> }) {
    const geometry = new THREE.BufferGeometry();
    this.start = new THREE.BufferAttribute(new Float32Array(count * 3), 3); this.vel = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    this.born = new THREE.BufferAttribute(new Float32Array(count * 2).fill(-1e6), 2);
    for (const attribute of [this.start, this.vel, this.born]) attribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.start); geometry.setAttribute('aVel', this.vel); geometry.setAttribute('aBorn', this.born);
    const material = new THREE.ShaderMaterial({ vertexShader: MOTE_VERTEX, fragmentShader: fragment, transparent: true, depthWrite: false, toneMapped: false, fog: false,
      uniforms: { ...auraShared, uLife: { value: options.life }, uSize: { value: new THREE.Vector2(...options.size) }, uPull: { value: new THREE.Vector3(...(options.pull ?? [0, 0, 0])) }, uSway: { value: new THREE.Vector2(...(options.sway ?? [0, 1])) }, ...options.uniforms } });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false; this.points.renderOrder = 6;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, time: number) {
    const i = this.next; this.next = (i + 1) % this.count;
    this.start.setXYZ(i, x, y, z); this.vel.setXYZ(i, vx, vy, vz); this.born.setXY(i, time, Math.random());
    this.start.needsUpdate = this.vel.needsUpdate = this.born.needsUpdate = true;
  }
  due(rate: number, dt: number) { this.owed += rate * dt; const n = Math.floor(this.owed); this.owed -= n; return Math.min(n, 8); }
  dispose() { this.points.removeFromParent(); this.points.geometry.dispose(); (this.points.material as THREE.Material).dispose(); }
}

class MoteAura implements Aura {
  readonly root = new THREE.Group();
  protected readonly motes: Motes;
  constructor(count: number, fragment: string, options: ConstructorParameters<typeof Motes>[2], private readonly rate: number,
    private readonly spawn: (at: THREE.Vector3, height: number, emit: (x: number, y: number, z: number, vx: number, vy: number, vz: number) => void) => void) {
    this.motes = new Motes(count, fragment, options);
    this.root.add(this.motes.points);
  }
  update(time: number, dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    if (!seen) return;
    for (let n = this.motes.due(this.rate, dt); n > 0; n--) this.spawn(at, height, (x, y, z, vx, vy, vz) => this.motes.emit(x, y, z, vx, vy, vz, time));
  }
  dispose() { this.motes.dispose(); this.root.removeFromParent(); }
}
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const ring = (r0: number, r1: number) => { const a = Math.random() * Math.PI * 2, r = rand(r0, r1); return [Math.cos(a) * r, Math.sin(a) * r, a] as const; };

const EMBER = `
varying float vAge; varying float vSeed;
void main() {
	float d = length( gl_PointCoord - .5 ) * 2.;
	float core = smoothstep( .75, .0, d );
	float a = smoothstep( 1., .55, d ) * smoothstep( 0., .12, vAge ) * ( 1. - vAge * vAge ) * ( .75 + .25 * sin( vAge * 40. + vSeed * 60. ) );
	if ( a < .02 ) discard;
	// A spark: a white-hot heart, orange round it, a burnt edge (so it reads on paper as on the dark).
	vec3 hot = mix( vec3( 1., .6, .16 ) * 2., vec3( 1., .26, .03 ) * 1.3, vAge );
	gl_FragColor = vec4( mix( vec3( .5, .07, .0 ), hot, core ), a );
}`;
export const PETAL = `
varying float vAge; varying float vSeed;
void main() {
	float spin = vSeed * 6.283 + vAge * ( 5. + vSeed * 6. );
	vec2 p = mat2( cos( spin ), -sin( spin ), sin( spin ), cos( spin ) ) * ( gl_PointCoord - .5 ) * 2.;
	// A petal: an ellipse that thins as it turns edge-on, with a notch at its tip.
	p.y /= mix( .35, 1., abs( cos( vAge * 9. + vSeed * 20. ) ) );
	float d = length( p * vec2( 1.5, 1. ) );
	float notch = smoothstep( .0, .22, length( p - vec2( 0., .78 ) ) );
	float a = ( 1. - smoothstep( .74, .86, d ) ) * notch * smoothstep( 0., .1, vAge ) * ( 1. - smoothstep( .8, 1., vAge ) );
	vec3 c = mix( vec3( 1., .5, .66 ), vec3( 1., .84, .89 ), fract( vSeed * 13. ) ) * ( .74 - .3 * smoothstep( .3, .82, d ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( c, a * .96 );
}`;
const WISP = `
varying float vAge; varying float vSeed;
float hash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float noise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f ); return mix( mix( hash( i ), hash( i + vec2( 1., 0. ) ), f.x ), mix( hash( i + vec2( 0., 1. ) ), hash( i + vec2( 1., 1. ) ), f.x ), f.y ); }
void main() {
	vec2 p = ( gl_PointCoord - .5 ) * 2.;
	// A curl of ink: a soft blot, torn by noise that drifts up through it.
	float field = length( p * vec2( 1.3, .78 ) ) + ( noise( p * 2.6 + vec2( vSeed * 30., vAge * 3. ) ) - .5 ) * 1.1 + ( noise( p * 6. - vec2( 0., vAge * 5. ) + vSeed * 9. ) - .5 ) * .3;
	// (Ink does not fade: it thins to threads, and only at the last is gone.)
	float thin = ( 1. - smoothstep( 0., .15, vAge ) ) * .5 + vAge * vAge * .55;
	float blot = 1. - smoothstep( .44, .56, field + thin ), rim = ( 1. - smoothstep( .58, .68, field + thin ) ) - blot;
	float a = max( blot * .93, rim * .45 ) * ( 1. - smoothstep( .86, 1., vAge ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .72, .76, .86 ), vec3( .012, .01, .016 ), blot ), a );
}`;

export const STANDING = `
uniform vec2 uSize;
uniform float uBack;
uniform float uRoll;
varying vec2 vUv;
void main() {
	vUv = uv;
	vec3 centre = ( modelMatrix * vec4( 0., 0., 0., 1. ) ).xyz;
	vec3 right = normalize( vec3( viewMatrix[ 0 ][ 0 ], 0., viewMatrix[ 2 ][ 0 ] ) );
	vec2 at = mat2( cos( uRoll ), sin( uRoll ), -sin( uRoll ), cos( uRoll ) ) * ( position.xy * uSize );
	vec4 mv = viewMatrix * vec4( centre + right * at.x + vec3( 0., at.y, 0. ), 1. );
	// (Behind the fighter as the eye sees them: their body stands in front of it.)
	mv.z -= uBack;
	gl_Position = projectionMatrix * mv;
}`;
export const NOISE = `
float hash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float noise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f ); return mix( mix( hash( i ), hash( i + vec2( 1., 0. ) ), f.x ), mix( hash( i + vec2( 0., 1. ) ), hash( i + vec2( 1., 1. ) ), f.x ), f.y ); }
float fbm( vec2 p ) { return noise( p ) * .55 + noise( p * 2.1 + 7. ) * .3 + noise( p * 4.3 + 13. ) * .15; }
`;
const quad = new THREE.PlaneGeometry(1, 1);
function standing(fragment: string, uniforms: Record<string, THREE.IUniform>) {
  const mesh = new THREE.Mesh(quad, new THREE.ShaderMaterial({ vertexShader: STANDING, fragmentShader: NOISE + fragment, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide,
    uniforms: { ...auraShared, uSize: { value: new THREE.Vector2(1, 1) }, uBack: { value: 0 }, uRoll: { value: 0 }, ...uniforms } }));
  mesh.frustumCulled = false; mesh.renderOrder = 5;
  return mesh;
}
type Sized = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

const FLAME = `
uniform float uAuraTime;
uniform vec3 uCore; uniform vec3 uBody; uniform vec3 uEdge;
uniform float uFade;
uniform float uHot;
varying vec2 vUv;
void main() {
	vec2 p = vec2( ( vUv.x - .5 ) * 2., vUv.y );
	// A flame's body: wide at the feet, drawn to a point overhead, its edge eaten by noise that climbs.
	float climb = uAuraTime * 1.7;
	float n = fbm( vec2( p.x * 2.2, p.y * 2.6 - climb ) ), lick = fbm( vec2( p.x * 5., p.y * 4.5 - climb * 1.6 ) + 9. );
	float width = mix( .82, .0, pow( p.y, 1.35 ) ) * ( .78 + .34 * n );
	float inside = 1. - smoothstep( width * .55, width, abs( p.x ) + ( lick - .5 ) * .22 * ( .4 + p.y ) );
	float foot = smoothstep( .0, .1, p.y );
	float fire = inside * foot * ( 1. - smoothstep( .74, 1., p.y ) );
	// Hottest in a band just inside its edge; the middle, where the fighter stands, is thin air with tongues rising through it.
	float shell = smoothstep( width * .2, width * .62, abs( p.x ) + ( lick - .5 ) * .16 ) * ( 1. - smoothstep( .0, .55, 1. - inside ) );
	float tongue = smoothstep( .58, .8, fbm( vec2( p.x * 3.4, p.y * 3. - climb * 2.1 ) + 3. ) ) * .5;
	float heat = fire * ( .16 + .84 * max( shell, tongue ) ) * ( .7 + .5 * n );
	float alpha = smoothstep( .03, .42, heat ) * .92 * uFade;
	if ( alpha < .02 ) discard;
	vec3 c = mix( uEdge, uBody * 1.3, smoothstep( .12, .5, heat ) );
	c = mix( c, uCore * uHot, smoothstep( .62, 1., heat ) );
	gl_FragColor = vec4( c, alpha );
}`;
class FlameAura implements Aura {
  readonly root = new THREE.Group();
  private readonly flame: Sized;
  private readonly sparks: Motes;
  constructor(core: number, body: number, edge: number) {
    this.flame = standing(FLAME, { uCore: { value: new THREE.Color(core) }, uBody: { value: new THREE.Color(body) }, uEdge: { value: new THREE.Color(edge) }, uFade: { value: 1 }, uHot: { value: 2.2 } }) as Sized;
    this.flame.material.uniforms.uBack.value = .42;
    this.root.add(this.flame);
    this.sparks = new Motes(24, EMBER_TINT, { life: 1.1, size: [.07, .02], pull: [0, .5, 0], sway: [.06, 5], uniforms: { uTint: { value: new THREE.Color(body).lerp(new THREE.Color(core), .5) } } });
    this.sparks.points.matrixAutoUpdate = false;
  }
  update(time: number, dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    this.root.visible = seen;
    if (!this.sparks.points.parent && this.root.parent) this.root.parent.add(this.sparks.points);
    if (!seen) return;
    this.root.position.copy(at);
    this.flame.position.y = height * .82; this.flame.material.uniforms.uSize.value.set(height * .98, height * 1.9);
    for (let n = this.sparks.due(9, dt); n > 0; n--) { const [x, z] = ring(.1, .42); this.sparks.emit(at.x + x, at.y + rand(.05, height * .5), at.z + z, x * .3, rand(.9, 1.7), z * .3, time); }
  }
  dispose() { this.sparks.dispose(); (this.flame.material as THREE.Material).dispose(); this.root.removeFromParent(); }
}
const EMBER_TINT = `
uniform vec3 uTint;
varying float vAge; varying float vSeed;
void main() {
	float d = length( gl_PointCoord - .5 ) * 2.;
	float a = smoothstep( 1., .5, d ) * smoothstep( 0., .1, vAge ) * ( 1. - vAge );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( uTint * .45, uTint * 2.8, smoothstep( .8, .0, d ) ), a );
}`;

const ARC = `
uniform float uSeed; uniform float uLit; uniform vec3 uTint;
varying vec2 vUv;
void main() {
	float x = vUv.x, taper = smoothstep( 0., .12, x ) * smoothstep( 1., .88, x );
	float jag = ( noise( vec2( x * 7. + uSeed * 31., uSeed * 5. ) ) - .5 ) * .62 + ( noise( vec2( x * 23. + uSeed * 17., uSeed ) ) - .5 ) * .2;
	float d = abs( vUv.y - .5 - jag * taper );
	// A bolt as a page draws one: white at the heart, its colour round it, a dark edge to hold it on paper.
	float line = smoothstep( .05, .0, d ), glow = smoothstep( .15, .05, d ), edge = smoothstep( .27, .19, d );
	float a = edge * taper * uLit;
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( mix( uTint * .1, uTint * 1.5, glow ), vec3( 3.2 ), line ), a );
}`;
class ArcAura implements Aura {
  readonly root = new THREE.Group();
  private readonly arcs: { mesh: Sized; until: number }[] = [];
  private nextSnap = 0;
  constructor(tint: number, private readonly every: [number, number], private readonly reach = .5) {
    for (let i = 0; i < 4; i++) {
      const mesh = standing(ARC, { uSeed: { value: 0 }, uLit: { value: 0 }, uTint: { value: new THREE.Color(tint) } }) as Sized;
      mesh.visible = false; this.root.add(mesh); this.arcs.push({ mesh, until: 0 });
    }
  }
  update(time: number, _dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    this.root.visible = seen;
    if (!seen) return;
    this.root.position.copy(at);
    if (time >= this.nextSnap) {
      this.nextSnap = time + rand(...this.every);
      const arc = this.arcs.find(each => time >= each.until) ?? this.arcs[0], [x, z] = ring(.2, this.reach);
      arc.until = time + rand(.09, .17);
      arc.mesh.position.set(x, rand(.18, .95) * height, z);
      arc.mesh.material.uniforms.uRoll.value = rand(-1.3, 1.3);
      arc.mesh.material.uniforms.uSize.value.set(rand(.45, .85) * height * .5, rand(.22, .34) * height * .5);
      arc.mesh.material.uniforms.uSeed.value = Math.random() * 10;
    }
    for (const arc of this.arcs) { const lit = time < arc.until; arc.mesh.visible = lit; arc.mesh.material.uniforms.uLit.value = lit ? .75 + .25 * Math.sin(time * 190) : 0; }
  }
  dispose() { for (const arc of this.arcs) arc.mesh.material.dispose(); this.root.removeFromParent(); }
}

const COIL_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1. ); }`;
const COIL = `
uniform float uAuraTime;
varying vec2 vUv;
void main() {
	float turn = vUv.x * 2. + vUv.y * 2.6 - uAuraTime * .85;
	// (Jitter measured round the drum, so the line has no seam where it closes.)
	vec2 round_ = vec2( cos( vUv.x * 6.2831853 ), sin( vUv.x * 6.2831853 ) );
	float jag = ( noise( round_ * 7. + floor( uAuraTime * 18. ) * 3.7 ) - .5 ) * .08 + ( noise( round_ * 2.6 + uAuraTime * 1.4 + 4. ) - .5 ) * .1;
	float d = abs( fract( turn + jag ) - .5 );
	float line = smoothstep( .035, .0, d ), glow = smoothstep( .11, .02, d ), edge = smoothstep( .16, .09, d );
	float ends = smoothstep( 0., .16, vUv.y ) * smoothstep( 1., .84, vUv.y );
	float flicker = .75 + .25 * noise( round_ * 1.5 + floor( uAuraTime * 24. ) );
	float a = edge * ends * flicker;
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( mix( vec3( .2, .1, .0 ), vec3( 1., .78, .12 ) * 1.7, glow ), vec3( 3.4, 3.3, 2.6 ), line ), a );
}`;
class CoilAura implements Aura {
  readonly root = new THREE.Group();
  private readonly drum: Sized;
  private readonly arcs = new ArcAura(0xffe34d, [.28, .7], .62);
  constructor() {
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 40, 1, true);
    this.drum = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ vertexShader: COIL_VERTEX, fragmentShader: NOISE + COIL, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, uniforms: { ...auraShared } })) as Sized;
    this.drum.frustumCulled = false; this.drum.renderOrder = 5;
    this.root.add(this.drum);
  }
  update(time: number, dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    this.root.visible = seen;
    if (!this.arcs.root.parent && this.root.parent) this.root.parent.add(this.arcs.root);
    this.arcs.update(time, dt, at, height, seen);
    if (!seen) return;
    this.root.position.copy(at);
    this.drum.position.y = height * .55; this.drum.scale.set(height * .36, height * .92, height * .36);
  }
  dispose() { this.arcs.dispose(); this.drum.geometry.dispose(); this.drum.material.dispose(); this.root.removeFromParent(); }
}

const ECLIPSE = `
uniform float uAuraTime;
varying vec2 vUv;
void main() {
	vec2 p = ( vUv - .5 ) * 2.;
	float r = length( p ), a = atan( p.y, p.x );
	float disc = 1. - smoothstep( .4, .42, r );
	float rim = smoothstep( .4, .425, r ) * ( 1. - smoothstep( .43, .5, r ) );
	float rays = fbm( vec2( a * 3.2 + uAuraTime * .12, r * 2.4 - uAuraTime * .3 ) ) * .7 + fbm( vec2( a * 9. - uAuraTime * .2, 3. ) ) * .5;
	float corona = smoothstep( .42, .44, r ) * pow( max( 0., 1. - ( r - .42 ) / ( .22 + .36 * rays ) ), 2.2 );
	vec3 light = vec3( 1., .97, .9 ) * rim * 3.4 + mix( vec3( .9, .16, .05 ), vec3( 1., .78, .42 ), corona ) * corona * 2.6;
	float alpha = max( disc, clamp( rim + corona, 0., 1. ) );
	if ( alpha < .01 ) discard;
	// (Premultiplied: the disc is black whatever stands behind it, the light adds to it.)
	gl_FragColor = vec4( light * ( 1. - disc ), alpha );
}`;
class EclipseAura implements Aura {
  readonly root = new THREE.Group();
  private readonly disc: Sized;
  constructor() {
    this.disc = standing(ECLIPSE, {}) as Sized;
    this.disc.material.premultipliedAlpha = true; this.disc.material.uniforms.uBack.value = .34;
    this.root.add(this.disc);
  }
  update(_time: number, _dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    this.root.visible = seen;
    if (!seen) return;
    this.root.position.copy(at);
    this.disc.position.y = height * .93; this.disc.material.uniforms.uSize.value.setScalar(height * 1.05);
  }
  dispose() { this.disc.material.dispose(); this.root.removeFromParent(); }
}

const SEALS = '封印滅破禁鬼神魔';
let sealAtlas: THREE.CanvasTexture | undefined;
function sealTexture() {
  if (sealAtlas) return sealAtlas;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 128);
  c.font = '900 92px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Songti SC",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = 5;
  [...SEALS].forEach((glyph, i) => { c.strokeRect(i * 128 + 12, 12, 104, 104); c.fillText(glyph, i * 128 + 64, 68); });
  sealAtlas = new THREE.CanvasTexture(canvas); sealAtlas.colorSpace = THREE.NoColorSpace; sealAtlas.generateMipmaps = true;
  return sealAtlas;
}
const SEAL_VERTEX = `
uniform float uAuraTime; uniform float uRadius; uniform float uTag;
attribute float aIndex;
varying vec2 vUv; varying float vFace;
void main() {
	float count = 14., a = aIndex / count * 6.2831853 + uAuraTime * .34;
	vec3 out_ = vec3( cos( a ), 0., sin( a ) ), along = vec3( -sin( a ), 0., cos( a ) );
	vec3 local = out_ * uRadius + along * position.x * uTag + vec3( 0., position.y * uTag * 1. + sin( uAuraTime * 1.3 + aIndex * 1.7 ) * .05, 0. );
	vec4 world = modelMatrix * vec4( local, 1. );
	vec4 mv = viewMatrix * world;
	// Which of the eight, and whether it is on the near side of the ring.
	vUv = vec2( ( mod( aIndex, 8. ) + uv.x ) / 8., uv.y );
	vFace = dot( normalize( ( viewMatrix * vec4( ( modelMatrix * vec4( out_, 0. ) ).xyz, 0. ) ).xyz ), vec3( 0., 0., 1. ) );
	gl_Position = projectionMatrix * mv;
}`;
const SEAL = `
uniform sampler2D uAtlas; uniform float uAuraTime;
varying vec2 vUv; varying float vFace;
void main() {
	float ink = texture2D( uAtlas, vUv ).r;
	float a = ink * ( .62 + .38 * smoothstep( -.3, .5, vFace ) );
	if ( a < .03 ) discard;
	gl_FragColor = vec4( vec3( .86, .03, .05 ) * ( 1.15 + .35 * sin( uAuraTime * 3. + vUv.x * 50. ) ), a );
}`;
const CIRCLE = `
uniform float uAuraTime;
varying vec2 vUv;
void main() {
	vec2 p = ( vUv - .5 ) * 2.; float r = length( p ), a = atan( p.y, p.x );
	float line = smoothstep( .018, .0, abs( r - .94 ) ) + smoothstep( .012, .0, abs( r - .8 ) ) * .7;
	float ticks = step( .5, fract( ( a + uAuraTime * .34 ) / 6.2831853 * 28. ) ) * smoothstep( .8, .82, r ) * ( 1. - smoothstep( .92, .94, r ) ) * .45;
	float alpha = clamp( line + ticks, 0., 1. ) * .85;
	if ( alpha < .02 ) discard;
	gl_FragColor = vec4( vec3( .86, .03, .05 ) * 1.2, alpha );
}`;
class SealAura implements Aura {
  readonly root = new THREE.Group();
  private readonly tags: Sized; private readonly circle: Sized;
  constructor() {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index; geometry.setAttribute('position', quad.getAttribute('position')); geometry.setAttribute('uv', quad.getAttribute('uv'));
    geometry.setAttribute('aIndex', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: 14 }, (_, i) => i)), 1));
    geometry.instanceCount = 14;
    const options = { transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide } as const;
    this.tags = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ ...options, vertexShader: SEAL_VERTEX, fragmentShader: SEAL, uniforms: { ...auraShared, uRadius: { value: 1 }, uTag: { value: .3 }, uAtlas: { value: sealTexture() } } })) as Sized;
    const floor = new THREE.PlaneGeometry(2, 2); floor.rotateX(-Math.PI / 2);
    this.circle = new THREE.Mesh(floor, new THREE.ShaderMaterial({ ...options, vertexShader: COIL_VERTEX, fragmentShader: CIRCLE, uniforms: { ...auraShared } })) as Sized;
    for (const mesh of [this.tags, this.circle]) { mesh.frustumCulled = false; mesh.renderOrder = 5; this.root.add(mesh); }
  }
  update(_time: number, _dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    this.root.visible = seen;
    if (!seen) return;
    this.root.position.copy(at);
    const u = this.tags.material.uniforms; u.uRadius.value = height * .58; u.uTag.value = height * .15;
    this.tags.position.y = height * .52;
    this.circle.position.y = .04; this.circle.scale.setScalar(height * .62);
  }
  dispose() { this.tags.geometry.dispose(); this.tags.material.dispose(); this.circle.geometry.dispose(); this.circle.material.dispose(); this.root.removeFromParent(); }
}

class RisingAura implements Aura {
  readonly root = new THREE.Group();
  private readonly flame: Sized;
  private readonly wisps = new Motes(40, WISP, { life: 1.7, size: [.18, .5], pull: [0, .12, 0], sway: [.12, 1.6] });
  private readonly sparks = new Motes(60, EMBER_TINT, { life: 1.2, size: [.09, .02], pull: [0, 1.4, 0], sway: [.1, 5], uniforms: { uTint: { value: new THREE.Color(0xffb13a) } } });
  private shown = 0;
  private want = 0;
  private readonly black = { core: new THREE.Color(0xff3a1a), body: new THREE.Color(0x0b0606), edge: new THREE.Color(0x000000) };
  private readonly gold = { core: new THREE.Color(0xffb020), body: new THREE.Color(0xc80c14), edge: new THREE.Color(0x140000) };
  constructor() {
    this.flame = standing(FLAME, { uCore: { value: new THREE.Color() }, uBody: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() }, uFade: { value: 0 }, uHot: { value: 1.3 } }) as Sized;
    this.flame.material.uniforms.uBack.value = .42;
    this.root.add(this.flame);
    for (const motes of [this.wisps, this.sparks]) motes.points.matrixAutoUpdate = false;
  }
  level(level: number) { this.want = Math.max(0, Math.min(1, level)); }
  update(time: number, dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    this.root.visible = seen;
    if (!this.wisps.points.parent && this.root.parent) this.root.parent.add(this.wisps.points, this.sparks.points);
    this.shown += (this.want - this.shown) * Math.min(1, dt * 2.5);
    if (!seen) return;
    const l = this.shown, fire = Math.max(0, Math.min(1, (l - .25) / .3)), hot = Math.max(0, Math.min(1, (l - .6) / .35));
    this.root.position.copy(at);
    const u = this.flame.material.uniforms;
    u.uFade.value = fire * (.82 - hot * .1);
    u.uCore.value.copy(this.black.core).lerp(this.gold.core, hot); u.uBody.value.copy(this.black.body).lerp(this.gold.body, hot); u.uEdge.value.copy(this.black.edge).lerp(this.gold.edge, hot);
    const tall = height * (1.3 + fire * .5 + hot * .5);
    this.flame.visible = fire > 0;
    this.flame.position.y = tall * .43; u.uSize.value.set(height * (.9 + hot * .2), tall);
    for (let n = this.wisps.due((4 + l * 10) * (1 - hot * .7), dt); n > 0; n--) { const [x, z] = ring(.2, .42); this.wisps.emit(at.x + x, at.y + rand(.05, .7) * height, at.z + z, x * .2, rand(.3, .7 + l), z * .2, time); }
    for (let n = this.sparks.due(hot * 26, dt); n > 0; n--) { const [x, z] = ring(.15, .5); this.sparks.emit(at.x + x, at.y + rand(.1, .8) * height, at.z + z, x * 1.4, rand(1.6, 3.4), z * 1.4, time); }
  }
  dispose() { this.wisps.dispose(); this.sparks.dispose(); this.flame.material.dispose(); this.root.removeFromParent(); }
}

const HORNS = `
uniform float uAuraTime;
varying vec2 vUv;
void main() {
	vec2 p = vec2( ( vUv.x - .5 ) * 2., vUv.y );
	float side = sign( p.x ); p.x = abs( p.x );
	float lick = fbm( vec2( p.x * 4. + side * 3., p.y * 3. - uAuraTime * 2.6 ) );
	// Each horn stands from the brow, leans out, and turns its point back in.
	float centre = .26 + .34 * sin( p.y * 2.2 ), width = .15 * pow( 1. - p.y, 1.1 ) + .012;
	float inside = 1. - smoothstep( width * .6, width, abs( p.x - centre ) + ( lick - .5 ) * .12 );
	inside *= smoothstep( .0, .08, p.y ) * ( 1. - smoothstep( .86, 1., p.y + ( lick - .5 ) * .2 ) );
	float heat = inside * ( .45 + .55 * ( 1. - p.y ) ) * ( .75 + .45 * lick );
	float alpha = smoothstep( .05, .35, heat );
	if ( alpha < .02 ) discard;
	vec3 c = mix( vec3( .12, .0, .0 ), vec3( .9, .1, .03 ), smoothstep( .15, .5, heat ) );
	gl_FragColor = vec4( mix( c, vec3( 1., .55, .12 ) * 1.6, smoothstep( .66, .95, heat ) ), alpha );
}`;
class OniAura implements Aura {
  readonly root = new THREE.Group();
  private readonly fire = new FlameAura(0xd23c0a, 0x8a0505, 0x000000);
  private readonly horns: Sized;
  constructor() {
    this.horns = standing(HORNS, {}) as Sized;
    this.horns.material.uniforms.uBack.value = .1;
    this.root.add(this.horns);
  }
  update(time: number, dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    if (!this.fire.root.parent && this.root.parent) this.root.parent.add(this.fire.root);
    this.fire.update(time, dt, at, height * 1.12, seen); this.fire.root.updateMatrixWorld(true);
    this.root.visible = seen;
    if (!seen) return;
    this.root.position.copy(at);
    this.horns.position.y = height * 1.06; this.horns.material.uniforms.uSize.value.set(height * .4, height * .3);
  }
  dispose() { this.fire.dispose(); this.horns.material.dispose(); this.root.removeFromParent(); }
}
const HALO = `
uniform float uAuraTime;
varying vec2 vUv;
void main() {
	vec2 p = ( vUv - .5 ) * 2.;
	float r = length( p ), a = atan( p.y, p.x ) + uAuraTime * .25;
	float band = 1. - smoothstep( .025, .05, abs( r - .66 ) );
	float inner = ( 1. - smoothstep( .008, .02, abs( r - .56 ) ) ) * .8;
	float points = ( 1. - smoothstep( .0, .1, length( vec2( ( fract( a / 6.2831853 * 12. ) - .5 ) * 1.2, r - .66 ) * 3. ) ) );
	float rays = pow( max( 0., cos( a * 24. ) ), 14. ) * smoothstep( .7, .76, r ) * ( 1. - smoothstep( .76, .98, r ) ) * .7;
	float light = max( max( band, inner ), max( points, rays ) );
	if ( light < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .3, .16, .0 ), vec3( .98, .7, .2 ) * 1.15, smoothstep( .45, .95, light ) ), light );
}`;
class CelestialAura implements Aura {
  readonly root = new THREE.Group();
  private readonly halo: Sized;
  private readonly light = new MoteAura(40, EMBER_TINT, { life: 2.2, size: [.12, .03], pull: [0, .3, 0], sway: [.12, 2], uniforms: { uTint: { value: new THREE.Color(0xffe6a0) } } }, 14,
    (at, h, emit) => { const [x, z] = ring(.25, .7); emit(at.x + x, at.y + rand(.05, .9) * h, at.z + z, 0, rand(.4, .9), 0); });
  constructor() {
    this.halo = standing(HALO, {}) as Sized;
    this.halo.material.uniforms.uBack.value = .3;
    this.root.add(this.halo);
  }
  update(time: number, dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    this.root.visible = seen;
    if (!this.light.root.parent && this.root.parent) this.root.parent.add(this.light.root);
    this.light.update(time, dt, at, height, seen);
    if (!seen) return;
    this.root.position.copy(at);
    this.halo.position.y = height * .96; this.halo.material.uniforms.uSize.value.setScalar(height * .72);
  }
  dispose() { this.light.dispose(); this.halo.material.dispose(); this.root.removeFromParent(); }
}
const RUN = `
varying float vAge; varying float vSeed;
void main() {
	vec2 p = ( gl_PointCoord - .5 ) * 2.;
	p.y = -p.y; p.x *= 1.9;
	float drop = length( vec2( p.x, max( 0., p.y - .1 ) * .45 + min( 0., p.y - .1 ) ) );
	float a = ( 1. - smoothstep( .5, .62, drop ) ) * smoothstep( 0., .1, vAge ) * ( 1. - smoothstep( .85, 1., vAge ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( vec3( .01, .01, .018 ), a );
}`;
const POOL = `
uniform float uAuraTime;
varying vec2 vUv;
void main() {
	vec2 p = ( vUv - .5 ) * 2.;
	float r = length( p ), a = atan( p.y, p.x );
	float edge = .72 + .12 * noise( vec2( a * 2.5, uAuraTime * .4 ) ) + .06 * sin( a * 7. + uAuraTime * 1.3 );
	float pool = 1. - smoothstep( edge - .03, edge + .03, r );
	float shine = ( 1. - smoothstep( .0, .05, abs( r - edge * .55 ) ) ) * .25;
	if ( pool < .02 ) discard;
	gl_FragColor = vec4( vec3( .012, .012, .02 ) + vec3( .5 ) * shine, pool * .9 );
}`;
class NegativeAura implements Aura {
  readonly root = new THREE.Group();
  private readonly runs = new MoteAura(60, RUN, { life: .5, size: [.12, .08], pull: [0, -7, 0], sway: [0, 1] }, 26,
    (at, h, emit) => { const [x, z] = ring(.12, .3); emit(at.x + x, at.y + rand(.35, .95) * h, at.z + z, x * .3, rand(-.3, .2), z * .3); });
  private readonly pool: Sized;
  constructor() {
    const floor = new THREE.PlaneGeometry(1, 1); floor.rotateX(-Math.PI / 2);
    this.pool = new THREE.Mesh(floor, new THREE.ShaderMaterial({ vertexShader: COIL_VERTEX, fragmentShader: NOISE + POOL, transparent: true, depthWrite: false, toneMapped: false, fog: false, uniforms: { ...auraShared } })) as Sized;
    this.pool.frustumCulled = false; this.pool.renderOrder = 4;
    this.root.add(this.pool);
  }
  update(time: number, dt: number, at: THREE.Vector3, height: number, seen: boolean) {
    this.root.visible = seen;
    if (!this.runs.root.parent && this.root.parent) this.root.parent.add(this.runs.root);
    this.runs.update(time, dt, at, height, seen);
    if (!seen) return;
    this.root.position.copy(at);
    this.pool.position.y = .03; this.pool.scale.setScalar(height * 1.05);
  }
  dispose() { this.runs.dispose(); this.pool.geometry.dispose(); this.pool.material.dispose(); this.root.removeFromParent(); }
}

export const AURA_IDS = ['aura-embers', 'aura-sakura', 'aura-ink-wisps', 'aura-static', 'aura-azure-flame', 'aura-thunder-coil', 'aura-black-sun', 'aura-hundred-seals', 'aura-rising'] as const;
export const FORM_IDS = ['form-oni', 'form-celestial', 'form-negative'] as const;
export function makeAura(id: string): Aura | undefined {
  switch (id) {
    case 'aura-embers': return new MoteAura(64, EMBER, { life: 1.6, size: [.11, .03], pull: [0, .12, 0], sway: [.09, 3.4] }, 28,
      (at, h, emit) => { const [x, z] = ring(.16, .42); emit(at.x + x, at.y + rand(.3, .98) * h, at.z + z, x * .5, rand(.5, 1.15), z * .5); });
    case 'aura-sakura': return new MoteAura(40, PETAL, { life: 3.4, size: [.17, .17], pull: [0, -.04, 0], sway: [.24, 2.1] }, 10,
      (at, h, emit) => { const [x, z] = ring(.1, 1); emit(at.x + x, at.y + h * rand(1.02, 1.3), at.z + z, rand(.08, .3), rand(-.62, -.38), rand(-.1, .1)); });
    case 'aura-ink-wisps': return new MoteAura(36, WISP, { life: 1.9, size: [.2, .62], pull: [0, .1, 0], sway: [.14, 1.5] }, 12,
      (at, h, emit) => { const [x, z] = ring(.22, .42); emit(at.x + x, at.y + rand(.06, .78) * h, at.z + z, x * .25, rand(.3, .62), z * .25); });
    case 'aura-static': return new ArcAura(0x4fc8ff, [.05, .16]);
    case 'aura-azure-flame': return new FlameAura(0xeafcff, 0x2e8bff, 0x0a2a9a);
    case 'aura-thunder-coil': return new CoilAura();
    case 'aura-black-sun': return new EclipseAura();
    case 'aura-hundred-seals': return new SealAura();
    case 'aura-rising': return new RisingAura();
    case 'form-oni': return new OniAura();
    case 'form-celestial': return new CelestialAura();
    case 'form-negative': return new NegativeAura();
    default: return undefined;
  }
}
