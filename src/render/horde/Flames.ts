import * as THREE from 'three';

const MAX = 240;
const VERTEX = `
attribute vec4 aFlame; // seed, size, heat, tint (0 fire, 1 crimson hellfire)
varying vec2 vUv;
varying vec4 vFlame;
void main() {
	vUv = uv; vFlame = aFlame;
	vec3 centre = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
	// Gone near the lens: a burning body beside the camera was an orange sheet
	// across a third of the frame, and a burning crowd a white-out.
	vFlame.z *= smoothstep( 2.5, 5.5, distance( centre, cameraPosition ) );
	vec3 right = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] );
	// Upright in the world, not tilted with the camera: flames climb.
	vec3 up = vec3( 0.0, 1.0, 0.0 );
	// A little toward the lens, so the body it burns on does not hide it.
	vec3 toward = normalize( cameraPosition - centre );
	vec3 world = centre + toward * .3 + right * position.x * aFlame.y + up * ( position.y + .5 ) * aFlame.y * 1.7;
	gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}`;
const FRAGMENT = `
uniform float uTime;
varying vec2 vUv;
varying vec4 vFlame;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float noise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
}
void main() {
	float t = uTime * 2.6 + vFlame.x * 17.0;
	vec2 p = vUv;
	// Turbulence rising through it: it tears more the higher it climbs, and
	// its top is ragged - a tongue, not a cone.
	float turb = noise( vec2( p.x * 4.0 + vFlame.x * 9.0, p.y * 3.0 - t ) ) * .6 + noise( vec2( p.x * 9.0 - vFlame.x * 3.0, p.y * 6.0 - t * 1.6 ) ) * .4;
	float x = ( p.x - .5 ) * 2.0 + ( turb - .5 ) * .8 * ( .25 + p.y );
	float h = p.y + ( turb - .5 ) * .4;
	float shape = 1.0 - smoothstep( 0.0, 1.0, abs( x ) / max( .05, ( 1.0 - h ) * .85 ) );
	shape *= smoothstep( 0.0, .18, p.y ) * ( 1.0 - smoothstep( .6, .95, h ) );
	float a = pow( max( shape, 0.0 ), 1.4 ) * vFlame.z * .85;
	if ( a < .02 ) discard;
	float core = pow( max( shape, 0.0 ), 2.2 );
	vec3 color = mix( mix( vec3( 1.0, .17, .02 ), vec3( 1.6, .8, .2 ), core ), mix( vec3( .75, .02, .07 ), vec3( 1.7, .38, .45 ), core ), vFlame.w );
	gl_FragColor = vec4( color * a, a );
}`;

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);

export class Flames {
  readonly mesh: THREE.InstancedMesh;
  private readonly flame: THREE.InstancedBufferAttribute;
  private readonly time = { value: 0 };
  private count = 0;

  constructor(parent: THREE.Object3D, private readonly max = MAX) {
    const card = new THREE.PlaneGeometry(1, 1);
    this.flame = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    card.setAttribute('aFlame', this.flame);
    this.mesh = new THREE.InstancedMesh(card, new THREE.ShaderMaterial({ uniforms: { uTime: this.time }, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, toneMapped: false }), this.max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.name = 'horde-flames';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(this.mesh);
  }

  begin(time: number) { this.count = 0; this.time.value = time % 1000; }

  add(x: number, y: number, z: number, size: number, heat: number, seed: number, tint = 0) {
    if (this.count >= this.max) return;
    const n = this.count++;
    _m.compose(_p.set(x, y, z), _q, _s);
    this.mesh.setMatrixAt(n, _m);
    this.flame.setXYZW(n, seed, size, heat, tint);
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count) { this.mesh.instanceMatrix.needsUpdate = true; this.flame.needsUpdate = true; }
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}
