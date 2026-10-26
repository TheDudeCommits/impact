import * as THREE from 'three';
import type { Rect } from './mask';

export interface Impulse { x: number; z: number; radius: number; depth: number }

export const IMPULSES = 16;

export const PUSH_RATE = 120;

export function waveConstants(o: { speed: number; damping: number; cell: number; rate: number }) {
  const dt = 1 / o.rate;
  const courant = Math.min(o.speed * dt / o.cell, .7);
  return { dt, c2: courant * courant, courant, keep: Math.pow(1 - Math.min(.95, o.damping), dt), push: PUSH_RATE / o.rate };
}

const STEP_VERTEX = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0., 1. ); }`;

const STEP_FRAGMENT = `
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uC2;
uniform float uKeep;
uniform vec4 uRect;
uniform vec4 uOpen;
uniform vec2 uOpenX;
uniform vec4 uImpulse[ ${IMPULSES} ];
uniform int uImpulses;
varying vec2 vUv;
float heightAt( vec2 uv, float self ) {
	vec4 n = texture2D( uState, uv );
	return mix( n.r, self, step( .5, n.b ) );
}
void main() {
	vec4 s = texture2D( uState, vUv );
	float h = s.r, before = s.g, wall = s.b;
	if ( wall > .5 ) { gl_FragColor = vec4( 0., 0., wall, 1. ); return; }
	float lap = heightAt( vUv - vec2( uTexel.x, 0. ), h ) + heightAt( vUv + vec2( uTexel.x, 0. ), h )
		+ heightAt( vUv - vec2( 0., uTexel.y ), h ) + heightAt( vUv + vec2( 0., uTexel.y ), h ) - 4. * h;
	// The open ends: a sponge a few metres deep (uOpen: its depth in uv along x and z, and which z ends are open;
	// uOpenX: which x ends).
	float sponge = 1.;
	if ( uOpen.z > .5 ) sponge = min( sponge, smoothstep( 0., uOpen.y, vUv.y ) );
	if ( uOpen.w > .5 ) sponge = min( sponge, smoothstep( 0., uOpen.y, 1. - vUv.y ) );
	if ( uOpenX.x > .5 ) sponge = min( sponge, smoothstep( 0., uOpen.x, vUv.x ) );
	if ( uOpenX.y > .5 ) sponge = min( sponge, smoothstep( 0., uOpen.x, 1. - vUv.x ) );
	float keep = uKeep * mix( .9, 1., sponge );
	float next = h + ( h - before ) * keep + uC2 * lap;
	next *= mix( .97, 1., sponge );
	vec2 world = uRect.xy + vUv * uRect.zw;
	for ( int i = 0; i < ${IMPULSES}; i ++ ) {
		if ( i >= uImpulses ) break;
		vec4 p = uImpulse[ i ];
		vec2 d = world - p.xy;
		next -= p.w * exp( - dot( d, d ) / ( p.z * p.z ) );
	}
	gl_FragColor = vec4( clamp( next, -2., 2. ), h, wall, 1. );
}`;

const INIT_FRAGMENT = `
uniform sampler2D uWalls;
varying vec2 vUv;
void main() { gl_FragColor = vec4( 0., 0., step( .5, texture2D( uWalls, vUv ).r ), 1. ); }`;

export class WaveField {
  readonly targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  readonly texel = new THREE.Vector2();
  readonly state = { value: null as THREE.Texture | null };
  private current = 0;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly init: THREE.ShaderMaterial;
  private readonly queue: Impulse[] = [];
  private readonly impulses = Array.from({ length: IMPULSES }, () => new THREE.Vector4());
  private debt = 0;
  private readonly dt: number;
  private readonly kick: number;
  readonly width: number;
  readonly height: number;
  private cleared = false;

  constructor(readonly rect: Rect, walls: THREE.Texture, o: { cell: number; rate: number; speed: number; damping: number; open?: readonly [boolean, boolean, boolean?, boolean?] }) {
    this.width = Math.max(8, Math.round((rect.x1 - rect.x0) / o.cell));
    this.height = Math.max(8, Math.round((rect.z1 - rect.z0) / o.cell));
    const make = () => new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, generateMipmaps: false,
    });
    this.targets = [make(), make()];
    for (const t of this.targets) t.texture.name = 'ground waves';
    this.texel.set(1 / this.width, 1 / this.height);
    const k = waveConstants(o);
    this.dt = k.dt; this.kick = k.push;
    const spongeMetres = 6;
    this.init = new THREE.ShaderMaterial({ name: 'ground waves init', uniforms: { uWalls: { value: walls } }, vertexShader: STEP_VERTEX, fragmentShader: INIT_FRAGMENT, depthTest: false, depthWrite: false });
    this.material = new THREE.ShaderMaterial({
      name: 'ground waves step',
      uniforms: {
        uState: { value: null }, uImpulses: { value: 0 }, uTexel: { value: this.texel },
        uC2: { value: k.c2 }, uKeep: { value: k.keep },
        uRect: { value: new THREE.Vector4(rect.x0, rect.z0, rect.x1 - rect.x0, rect.z1 - rect.z0) },
        uOpen: { value: new THREE.Vector4(spongeMetres / (rect.x1 - rect.x0), spongeMetres / (rect.z1 - rect.z0), o.open?.[0] ? 1 : 0, o.open?.[1] ? 1 : 0) },
        uOpenX: { value: new THREE.Vector2(o.open?.[2] ? 1 : 0, o.open?.[3] ? 1 : 0) },
        uImpulse: { value: this.impulses },
      },
      vertexShader: STEP_VERTEX, fragmentShader: STEP_FRAGMENT, depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.state.value = this.targets[0].texture;
  }

  push(p: Impulse) {
    if (p.x < this.rect.x0 - p.radius * 2 || p.x > this.rect.x1 + p.radius * 2 || p.z < this.rect.z0 - p.radius * 2 || p.z > this.rect.z1 + p.radius * 2) return;
    if (this.queue.length < 64) this.queue.push(p);
    else {
      let weakest = 0;
      for (let i = 1; i < this.queue.length; i++) if (this.queue[i].depth < this.queue[weakest].depth) weakest = i;
      if (this.queue[weakest].depth < p.depth) this.queue[weakest] = p;
    }
  }

  step(renderer: THREE.WebGLRenderer, dt: number) {
    const previous = renderer.getRenderTarget(), autoClear = renderer.autoClear;
    renderer.autoClear = false;
    if (!this.cleared) {
      const quad = this.scene.children[0] as THREE.Mesh;
      quad.material = this.init;
      for (const t of this.targets) { renderer.setRenderTarget(t); renderer.render(this.scene, this.camera); }
      quad.material = this.material;
      this.cleared = true;
    }
    this.debt = Math.min(this.debt + dt, this.dt * 4);
    let steps = 0;
    while (this.debt >= this.dt && steps < 4) {
      this.debt -= this.dt; steps++;
      this.load();
      const read = this.targets[this.current], write = this.targets[1 - this.current];
      this.material.uniforms.uState.value = read.texture;
      renderer.setRenderTarget(write);
      renderer.render(this.scene, this.camera);
      this.current = 1 - this.current;
    }
    this.state.value = this.targets[this.current].texture;
    renderer.setRenderTarget(previous);
    renderer.autoClear = autoClear;
    return steps;
  }

  private load() {
    this.queue.sort((a, b) => b.depth - a.depth);
    const n = Math.min(IMPULSES, this.queue.length);
    for (let i = 0; i < n; i++) { const p = this.queue[i]; this.impulses[i].set(p.x, p.z, p.radius, p.depth * this.kick); }
    this.material.uniforms.uImpulses.value = n;
    this.queue.splice(0, n);
  }

  dispose() {
    for (const t of this.targets) t.dispose();
    this.material.dispose(); this.init.dispose();
    (this.scene.children[0] as THREE.Mesh).geometry.dispose();
  }
}
