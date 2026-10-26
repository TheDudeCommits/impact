import * as THREE from 'three';
import { INK_ON, INK_MARK_PARS, inkUniforms } from '../rift/ink';

export const enum Shape { Lane = 0, Circle = 1, Line = 2, Arc = 3, Heal = 4, Rift = 5 }

const MAX = 96;
const VERTEX = `
attribute vec4 aShape;
varying vec2 vUv;
varying vec4 vShape;
void main() {
	vUv = uv; vShape = aShape;
	gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
}`;
const FRAGMENT = `
uniform float uTime;
varying vec2 vUv;
varying vec4 vShape;
void main() {
	// x: shape; y: fill 0-1 (the blow lands at 1); z: aspect (length / width), for the edge; w: seed.
	float shape = vShape.x, fill = vShape.y;
	vec2 p = vUv; // 0-1 across (x) and along (y), the grunt at y = 0 for a lane, a line or an arc.
	if ( shape > 1.5 && shape < 2.5 ) {
		// A gunner's line of fire: a sight, not a strip (the owner: the red lines
		// from ranged enemies were "too annoying") - a hairline with a soft glow,
		// dashes running out along it toward where the shot goes, dim as the aim
		// begins and sharpening as it comes, a flare only as it fires.
		float across = abs( p.x - .5 ) * 2.0;
		float core = 1.0 - smoothstep( .0, .14, across ), glow = 1.0 - smoothstep( .0, 1.0, across );
		float ends = smoothstep( .0, .07, p.y ) * ( 1.0 - smoothstep( .86, 1.0, p.y ) );
		float dash = smoothstep( .4, .6, fract( p.y * vShape.z * .5 - uTime * 2.4 + vShape.w ) );
		float fired = smoothstep( .9, 1.0, fill );
		float a = ends * ( core * ( .07 + .26 * fill * fill ) * mix( .35, 1.0, dash ) + glow * glow * .035 * fill ) * ( 1.0 + 1.8 * fired );
		vec3 hue = mix( vec3( .8, .05, .06 ), vec3( 1.7, .42, .12 ), fill * fill );
		hue = mix( hue, vec3( 2.3, 1.25, .55 ), fired );
		if ( a < .005 ) discard;
		gl_FragColor = vec4( hue, a );
		return;
	}
	float inside, along, edge;
	if ( shape < .5 || ( shape > 1.5 && shape < 2.5 ) ) {
		// A lane or a line: a strip from the grunt forward.
		float across = abs( p.x - .5 ) * 2.0;
		along = p.y;
		inside = step( across, 1.0 );
		edge = smoothstep( .78, .98, across ) + smoothstep( .96, 1.0, along );
	} else if ( shape < 1.5 || shape > 3.5 ) {
		// A circle round the grunt.
		float r = length( p - .5 ) * 2.0;
		if ( r > 1.0 ) discard;
		along = r;
		inside = 1.0;
		edge = smoothstep( .86, .98, r );
	} else {
		// An arc in front: a sector of a circle whose centre is the grunt.
		vec2 q = vec2( ( p.x - .5 ) * 2.0, p.y );
		float r = length( q ), a = abs( atan( q.x, q.y ) );
		if ( r > 1.0 || a > 1.1 ) discard;
		along = r;
		inside = 1.0;
		edge = smoothstep( .88, .99, r ) + smoothstep( .95, 1.1, a );
	}
	// The part the blow has already reached, and the part still coming.
	float reached = step( along, fill );
	float strike = smoothstep( .9, 1.0, fill );
	float stripes = step( .7, fract( ( p.x + p.y ) * vShape.z * 3.0 - uTime * 3.0 + vShape.w ) );
	// Drawn, not flooded: a crisp edge, faint hatching inside, the reached part
	// a little stronger, and the whole of it flaring as the blow lands.
	float line = clamp( edge, 0.0, 1.0 );
	float alpha = inside * ( .035 + .05 * stripes + .09 * reached + .55 * line ) * ( .75 + .5 * strike );
	vec3 color = mix( mix( vec3( 1.1, .08, .03 ), vec3( 2.2, .3, .08 ), line ), vec3( 2.8, 1.2, .35 ), strike * reached );
	if ( shape > 3.5 ) color = shape < 4.5 ? mix( vec3( .1, 1.4, .45 ), vec3( .6, 2.4, 1.0 ), line + strike * reached ) : mix( vec3( .8, .15, 1.5 ), vec3( 1.6, .6, 2.4 ), line + strike * reached );
	if ( alpha < .01 ) discard;
	gl_FragColor = vec4( color, alpha );
}`;

const INK_VERTEX = `
attribute vec4 aShape;
varying vec2 vUv;
varying vec4 vShape;
varying vec2 vGround;
void main() {
	vUv = uv; vShape = aShape;
	vec4 world = modelMatrix * instanceMatrix * vec4( position, 1.0 );
	vGround = world.xz;
	gl_Position = projectionMatrix * viewMatrix * world;
}`;
const INK_FRAGMENT = `
uniform float uTime;
${INK_MARK_PARS}
varying vec2 vUv;
varying vec4 vShape;
varying vec2 vGround;
void main() {
	float shape = vShape.x, fill = vShape.y;
	vec2 p = vUv;
	if ( shape > 1.5 && shape < 2.5 ) {
		float across = abs( p.x - .5 ) * 2.0;
		float core = 1.0 - smoothstep( .1, .34, across );
		float ends = smoothstep( .0, .07, p.y ) * ( 1.0 - smoothstep( .86, 1.0, p.y ) );
		float dash = step( .45, fract( p.y * vShape.z * .5 + vShape.w ) );
		float fired = smoothstep( .9, 1.0, fill );
		float a = ends * core * max( mix( .22, .8, fill ) * dash, fired );
		if ( a < .01 ) discard;
		gl_FragColor = vec4( mix( uInkDanger, uInkHot, fired ), a );
		return;
	}
	float inside, along, edge;
	if ( shape < .5 ) {
		float across = abs( p.x - .5 ) * 2.0;
		along = p.y;
		inside = step( across, 1.0 );
		edge = smoothstep( .8, .94, across ) + smoothstep( .95, .99, along );
	} else if ( shape < 1.5 || shape > 3.5 ) {
		float r = length( p - .5 ) * 2.0;
		if ( r > 1.0 ) discard;
		along = r;
		inside = 1.0;
		edge = smoothstep( .88, .96, r );
	} else {
		vec2 q = vec2( ( p.x - .5 ) * 2.0, p.y );
		float r = length( q ), a = abs( atan( q.x, q.y ) );
		if ( r > 1.0 || a > 1.1 ) discard;
		along = r;
		inside = 1.0;
		edge = smoothstep( .9, .97, r ) + smoothstep( 1.0, 1.08, a );
	}
	float reached = step( along, fill );
	float strike = smoothstep( .9, 1.0, fill );
	float line = clamp( edge, 0.0, 1.0 );
	// (As it lands the strokes thicken until they close: drawn in, not faded in - a fill at
	// part strength was a pale pink wash over the paper.)
	float hatch = inkMarkHatch( vGround, 2.6, .16 + .36 * reached + .5 * strike * reached );
	float a = inside * max( line, hatch );
	vec3 color = mix( uInkDanger, uInkHot, strike * reached );
	if ( shape > 3.5 ) color = shape < 4.5 ? uInkMend : uInkCall;
	if ( a < .01 ) discard;
	gl_FragColor = vec4( color, a );
}`;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

export class Telegraphs {
  readonly mesh: THREE.InstancedMesh;
  private readonly shape: THREE.InstancedBufferAttribute;
  private readonly time = { value: 0 };
  private count = 0;

  constructor(parent: THREE.Object3D) {
    const card = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    card.translate(0, 0, .5);
    const uv = card.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    this.shape = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    card.setAttribute('aShape', this.shape);
    this.mesh = new THREE.InstancedMesh(card, new THREE.ShaderMaterial({ uniforms: { uTime: this.time, ...(INK_ON ? inkUniforms : {}) }, vertexShader: INK_ON ? INK_VERTEX : VERTEX, fragmentShader: INK_ON ? INK_FRAGMENT : FRAGMENT,
      transparent: true, depthWrite: false, blending: INK_ON ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }), MAX);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.name = 'horde-telegraphs';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(this.mesh);
  }

  begin(time: number) { this.count = 0; this.time.value = time; }

  add(shape: Shape, x: number, z: number, yaw: number, length: number, width: number, fill: number, seed: number) {
    if (this.count >= MAX) return;
    const n = this.count++;
    _q.setFromAxisAngle(UP, yaw);
    if (shape === Shape.Circle || shape === Shape.Heal || shape === Shape.Rift) {
      _p.set(x - Math.sin(yaw) * length, .045, z - Math.cos(yaw) * length);
      _s.set(length * 2, 1, length * 2);
    } else {
      _p.set(x, .045, z);
      _s.set(shape === Shape.Arc ? length * 2 : width, 1, length);
    }
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(n, _m);
    this.shape.setXYZW(n, shape, Math.max(0, Math.min(1, fill)), shape === Shape.Circle || shape === Shape.Heal || shape === Shape.Rift ? 1 : length / Math.max(.2, width), seed);
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    if (this.count) { this.mesh.instanceMatrix.needsUpdate = true; this.shape.needsUpdate = true; }
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}
