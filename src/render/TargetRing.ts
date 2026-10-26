import * as THREE from 'three';
import { riftBoss } from '../survival/riftTargeting';
import { INK_ON, INK_MARK_PARS, inkUniforms } from './rift/ink';

const VERTEX = `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAGMENT = `
uniform float uTime; uniform vec3 uColor; uniform float uAlpha; uniform float uLock; uniform float uBoss;
varying vec2 vUv;
float band(float r, float a, float b, float soft) { return smoothstep(a - soft, a, r) * (1.0 - smoothstep(b, b + soft, r)); }
void main() {
	float r = length(vUv), a = atan(vUv.y, vUv.x);
	if (r > 1.0) discard;
	float aa = fwidth(r) * 1.5;
	// Dashes, turning.
	float dashes = step(.34, fract((a + uTime * 1.3) / 6.2831853 * (8.0 + uBoss * 4.0)));
	float ring = band(r, .7, .87, aa) * dashes;
	float ink = band(r, .64, .92, aa) * dashes;
	// Three chevrons, turning the other way and pointing in.
	float ca = mod(a - uTime * .8, 2.0943951) - 1.0471976;
	float chevron = (1.0 - smoothstep(0.0, aa * 3.0 + .02, abs(abs(ca) * 1.9 - (r - .52)) - .035)) * band(r, .5, .66, aa);
	// A lock's brackets and its pulse.
	float ba = mod(a + .785398, 1.5707963) - .785398;
	float brackets = uLock * band(r, .9, .97, aa) * step(abs(ba), .34);
	float pulse = uLock * band(r, .6 + fract(uTime * 1.4) * .4, .63 + fract(uTime * 1.4) * .4, aa) * (1.0 - fract(uTime * 1.4));
	float glow = (1.0 - smoothstep(.55, 1.0, r)) * smoothstep(.3, .85, r) * .28;
	float lit = max(max(ring, chevron), max(brackets, pulse));
	// (A boss's ring at a little over half the light: its mark is meant to be quiet.)
	vec3 tint = uColor * mix(1.0, .55, uBoss);
	vec3 color = mix(vec3(.02, .01, .02), tint, lit);
	float alpha = max(max(ink * .95, lit), glow) * uAlpha * mix(1.0, .8, uBoss);
	if (alpha < .01) discard;
	gl_FragColor = vec4(color + tint * glow, alpha);
}`;

const INK_FRAGMENT = `
uniform float uTime; uniform vec3 uColor; uniform float uAlpha; uniform float uLock; uniform float uBoss;
${INK_MARK_PARS}
varying vec2 vUv;
float band(float r, float a, float b, float soft) { return smoothstep(a - soft, a, r) * (1.0 - smoothstep(b, b + soft, r)); }
void main() {
	float r = length(vUv), a = atan(vUv.y, vUv.x);
	if (r > 1.0) discard;
	float aa = fwidth(r) * 1.5;
	float dashes = step(.3, fract((a + uTime * 1.3) / 6.2831853 * (7.0 + uBoss * 3.0)));
	float paper = band(r, .73, .85, aa) * dashes;
	float ink = band(r, .66, .92, aa) * dashes;
	float ca = mod(a - uTime * .8, 2.0943951) - 1.0471976;
	float chevron = (1.0 - smoothstep(0.0, aa * 3.0 + .02, abs(abs(ca) * 1.9 - (r - .5)) - .045)) * band(r, .48, .66, aa);
	float chevronInk = (1.0 - smoothstep(0.0, aa * 3.0 + .02, abs(abs(ca) * 1.9 - (r - .5)) - .085)) * band(r, .44, .7, aa);
	float ba = mod(a + .785398, 1.5707963) - .785398;
	float brackets = uLock * band(r, .93, .99, aa) * step(abs(ba), .34);
	float pulse = uLock * band(r, .6 + fract(uTime * 1.4) * .38, .64 + fract(uTime * 1.4) * .38, aa) * (1.0 - fract(uTime * 1.4));
	vec3 color = uInkDark;
	color = mix(color, uInkPaper * 1.18, paper);
	color = mix(color, uColor, max(max(chevron, brackets), pulse));
	float alpha = max(max(ink, chevronInk), max(max(chevron, brackets), pulse)) * uAlpha;
	if (alpha < .01) discard;
	gl_FragColor = vec4(color, alpha);
}`;

const COLORS = { grunt: new THREE.Color(.3, 2.1, 2.4), elite: new THREE.Color(.55, 1.1, 2.7), boss: new THREE.Color(2.9, 2.05, .45) };

const POINTER_VERTEX = `
uniform float uSize;
uniform vec2 uSpan;
uniform float uShape;
varying vec2 vUv;
varying vec2 vDir;
varying float vEdge;
varying float vShown;
void main() {
	vUv = uv * 2.0 - 1.0;
	vec3 centre = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
	vec4 clip = projectionMatrix * viewMatrix * vec4( centre, 1.0 );
	float wide = projectionMatrix[ 0 ][ 0 ] / projectionMatrix[ 1 ][ 1 ];
	// Its world size, held on screen between two bounds (a chevron's 4% and
	// 8.5% of the frame's half height: over a grunt beside the lens it was as
	// big as the fighter's torso, and over one across the field a speck).
	float span = clamp( uSize * projectionMatrix[ 1 ][ 1 ] / max( clip.w, .05 ), uSpan.x, uSpan.y );
	// Where it stands on the screen - behind the lens, the way it lies.
	vec2 at = clip.xy / max( abs( clip.w ), 1e-3 );
	// A boss past the frame's edge, or behind the lens, is an arrow pinned
	// inside the edge, pointing the way to it: the over-the-shoulder lens
	// leaves a boss at the fighter's side out of frame, and its brackets hung
	// half off the screen round nothing. A grunt's chevron just goes.
	float side = max( .6, .98 - .88 * span * wide );
	float past = clip.w < .2 ? 1.0 : max( max( abs( at.x ) - side, at.y - .62 ), max( -.8 - at.y, 0.0 ) );
	float edge = smoothstep( 0.0, .14, past ), boss = step( .5, uShape );
	vDir = normalize( at + vec2( 1e-5, 0.0 ) );
	vEdge = edge * boss;
	vShown = 1.0 - edge * ( 1.0 - boss );
	// Its pin: along the way to it, clear of the HUD's bands.
	vec2 room = vec2( .9, at.y > 0.0 ? .5 : .62 );
	vec2 pinned = at * min( 1.0, min( room.x / max( abs( at.x ), 1e-4 ), room.y / max( abs( at.y ), 1e-4 ) ) );
	span = mix( span, .095, vEdge );
	gl_Position = vec4( mix( at, pinned, vEdge ) + vec2( position.x * wide, position.y ) * span, 0.0, 1.0 );
}`;
const POINTER_FRAGMENT = `
uniform vec3 uColor; uniform float uAlpha; uniform float uShape; uniform float uNear; uniform float uTime;
varying vec2 vUv;
varying vec2 vDir;
varying float vEdge;
varying float vShown;
// (The brackets in the ring's colour at a little over half its light: at full HDR gold they bloomed into bars.)
// Four corner brackets round a square: a lock on the whole body. Each is an
// L of two strokes along the frame's edge at .88, arms .4 long.
float stroke( vec2 p, vec2 a, vec2 b ) { vec2 pa = p - a, ba = b - a; return length( pa - ba * clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 ) ); }
float brackets( vec2 p, float w ) {
	p = abs( p );
	return min( stroke( p, vec2( .48, .88 ), vec2( .88, .88 ) ), stroke( p, vec2( .88, .48 ), vec2( .88, .88 ) ) ) - w;
}
// Distance to a downward chevron: two strokes meeting at the bottom.
float chevron( vec2 p, float w ) {
	p.x = abs( p.x );
	vec2 a = vec2( 0.0, -.55 ), b = vec2( .8, .45 );
	vec2 pa = p - a, ba = b - a;
	float h = clamp( dot( pa, ba ) / dot( ba, ba ), 0.0, 1.0 );
	return length( pa - ba * h ) - w;
}
void main() {
	if ( vShown < .01 ) discard;
	float d = chevron( vUv, .16 );
	if ( vEdge > .001 ) {
		// The arrow: the chevron turned so its point is the way to the boss,
		// beating (drawn smaller in its square so a turned arm is not cut off).
		vec2 q = vec2( dot( vUv, vec2( -vDir.y, vDir.x ) ), -dot( vUv, vDir ) ) * 1.25 * ( 1.0 + .07 * sin( uTime * 7.0 ) );
		d = mix( d, chevron( q, .16 ), vEdge );
	}
	float aa = fwidth( d ) * 1.2;
	float fill = 1.0 - smoothstep( -aa, aa, d );
	float ink = 1.0 - smoothstep( -aa, aa, d - .09 );
	float alpha = max( fill, ink * .95 ) * uAlpha * uNear * vShown;
	if ( alpha < .01 ) discard;
	gl_FragColor = vec4( mix( vec3( .02, .01, .02 ), uColor * ( uShape > .5 ? .8 : 1.0 ), fill ), alpha );
}`;

interface Mark { mesh: THREE.Mesh; size: { value: number }; span: { value: THREE.Vector2 }; shape: { value: number }; near: { value: number }; alpha: { value: number } }

export class TargetRing {
  private readonly mesh: THREE.Mesh;
  private readonly pointer: Mark;
  private readonly frame: Mark;
  private readonly uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uLock: { value: 0 }, uBoss: { value: 0 } };
  private readonly at = new THREE.Vector3();
  private readonly frameAt = new THREE.Vector3();
  private frameId: string | null = null;
  private radius = 1;
  private shown = false;
  private id: string | null = null;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: INK_ON ? { ...this.uniforms, ...inkUniforms } : this.uniforms, vertexShader: VERTEX, fragmentShader: INK_ON ? INK_FRAGMENT : FRAGMENT, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false }));
    this.mesh.renderOrder = 3; this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.name = 'survival-target-ring';
    scene.add(this.mesh);
    this.pointer = this.mark(scene, 'survival-target-pointer', this.uniforms.uColor, this.uniforms.uAlpha);
    this.frame = this.mark(scene, 'survival-boss-frame', INK_ON ? inkUniforms.uInkGold : { value: COLORS.boss.clone().multiplyScalar(.85) }, { value: 0 });
  }

  private mark(scene: THREE.Scene, name: string, color: { value: THREE.Color }, alpha: { value: number }): Mark {
    const mark: Mark = { mesh: undefined!, size: { value: .3 }, span: { value: new THREE.Vector2(.04, .085) }, shape: { value: 0 }, near: { value: 1 }, alpha };
    mark.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { uColor: color, uAlpha: alpha, uSize: mark.size, uSpan: mark.span, uShape: mark.shape, uNear: mark.near, uTime: this.uniforms.uTime },
      vertexShader: POINTER_VERTEX, fragmentShader: POINTER_FRAGMENT, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    mark.mesh.renderOrder = 30; mark.mesh.frustumCulled = false; mark.mesh.visible = false; mark.mesh.name = name;
    scene.add(mark.mesh);
    return mark;
  }

  private bracket(mark: Mark, at: THREE.Vector3, radius: number, time: number) {
    const tall = Math.max(1.3, radius * 4.2);
    mark.mesh.position.set(at.x, at.y + tall + .5 + Math.sin(time * 4) * .06, at.z);
    mark.size.value = .4;
    mark.span.value.set(.045, .085); mark.shape.value = 1; mark.near.value = 1;
    mark.mesh.visible = true;
  }

  update(target: { id: string; x: number; y: number; z: number; radius: number; boss: boolean; elite: boolean; dist?: number } | undefined, locked: boolean, time: number, dt: number) {
    const u = this.uniforms;
    u.uTime.value = time;
    this.framing(target, time, dt);
    if (!target) {
      u.uAlpha.value = Math.max(0, u.uAlpha.value - dt * 6);
      this.mesh.visible = this.pointer.mesh.visible = u.uAlpha.value > 0;
      if (!this.mesh.visible) { this.shown = false; this.id = null; }
      return;
    }
    const size = Math.max(.75, target.radius * 1.9 + .35) * (target.boss ? 1.15 : 1);
    const jump = !this.shown || Math.hypot(target.x - this.at.x, target.z - this.at.z) > 7;
    if (jump) { this.at.set(target.x, target.y, target.z); this.radius = size; }
    else {
      const k = 1 - Math.exp(-dt * (target.id === this.id ? 30 : 16));
      this.at.x += (target.x - this.at.x) * k; this.at.z += (target.z - this.at.z) * k; this.at.y += (target.y - this.at.y) * k;
      this.radius += (size - this.radius) * k;
    }
    this.id = target.id; this.shown = true;
    this.mesh.position.set(this.at.x, Math.max(0, this.at.y * .15) + .06, this.at.z);
    this.mesh.scale.setScalar(this.radius);
    if (INK_ON) u.uColor.value.copy(target.boss ? inkUniforms.uInkGold.value : target.elite ? inkUniforms.uInkElite.value : inkUniforms.uInkAccent.value);
    else u.uColor.value.copy(target.boss ? COLORS.boss : target.elite ? COLORS.elite : COLORS.grunt);
    u.uLock.value += ((locked ? 1 : 0) - u.uLock.value) * Math.min(1, dt * 10);
    u.uBoss.value = target.boss ? 1 : 0;
    u.uAlpha.value = Math.min(1, u.uAlpha.value + dt * 8);
    this.mesh.visible = true;
    if (target.boss) this.bracket(this.pointer, this.at, target.radius, time);
    else {
      const tall = Math.max(1.3, target.radius * 4.2), pointer = this.pointer;
      pointer.mesh.position.set(this.at.x, this.at.y + tall + .35 + Math.sin(time * 5) * .08, this.at.z);
      pointer.size.value = target.elite ? .34 : .28;
      pointer.span.value.set(.04, .085); pointer.shape.value = 0;
      pointer.near.value = target.dist === undefined ? 1 : 1 - THREE.MathUtils.smoothstep(target.dist, 6, 9);
      pointer.mesh.visible = true;
    }
  }

  private framing(target: { id: string } | undefined, time: number, dt: number) {
    const boss = riftBoss.current, frame = this.frame;
    const other = boss && boss.id !== target?.id ? boss : undefined;
    if (!other) {
      frame.alpha.value = boss ? 0 : Math.max(0, frame.alpha.value - dt * 6);
      frame.mesh.visible = frame.alpha.value > 0;
      if (!frame.mesh.visible) this.frameId = null;
      return;
    }
    if (other.id !== this.frameId) {
      if (other.id === this.id && this.shown) { this.frameAt.copy(this.at); frame.alpha.value = .45; }
      else this.frameAt.set(other.x, other.y, other.z);
    } else this.frameAt.lerp(_to.set(other.x, other.y, other.z), 1 - Math.exp(-dt * 30));
    this.frameId = other.id;
    frame.alpha.value = Math.min(.45, frame.alpha.value + dt * 6);
    this.bracket(frame, this.frameAt, other.radius, time);
  }

  hide() {
    this.uniforms.uAlpha.value = this.frame.alpha.value = 0;
    this.mesh.visible = this.pointer.mesh.visible = this.frame.mesh.visible = false;
    this.shown = false; this.id = this.frameId = null;
  }
  dispose() {
    for (const mesh of [this.mesh, this.pointer.mesh, this.frame.mesh]) { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
  }
}

const _to = new THREE.Vector3();
