import * as THREE from 'three';
import { Motes, NOISE, STANDING, auraShared } from './auras';
import type { Effect } from './knockouts';

const FLAT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1. ); }`;
const RING = `
uniform float uAuraTime; uniform float uStart; uniform float uKind;
uniform vec3 uBody; uniform vec3 uEdge; uniform vec3 uCore;
varying vec2 vUv;
void main() {
	float age = uAuraTime - uStart;
	vec2 p = ( vUv - .5 ) * 2.;
	float r = length( p ), a = atan( p.y, p.x );
	float front = 1. - pow( 1. - min( 1., age / .45 ), 3. );
	float rough = ( noise( vec2( a * 5., uStart * 3. ) ) - .5 ) * .12 + ( noise( vec2( a * 17., uStart ) ) - .5 ) * .05;
	float width = mix( .16, .05, front );
	float band = 1. - smoothstep( width * .5, width, abs( r - front * .92 + rough * front ) );
	float fade = 1. - smoothstep( .5, 1.3, age );
	float alpha = band * fade;
	if ( uKind > 2.5 ) {
		vec2 g = mat2( .7071, -.7071, .7071, .7071 ) * p * 14.;
		float d = length( fract( g ) - .5 );
		alpha *= step( d, .38 );
	}
	if ( alpha < .02 ) discard;
	float heat = smoothstep( .3, 1., band );
	vec3 c = mix( uEdge, uBody, smoothstep( .05, .45, band ) );
	c = mix( c, uCore, heat * step( .5, uKind ) * step( uKind, 2.5 ) );
	gl_FragColor = vec4( c, alpha );
}`;
const BEAM = `
uniform float uAuraTime; uniform float uStart;
varying vec2 vUv;
void main() {
	float age = uAuraTime - uStart;
	float x = abs( vUv.x - .5 ) * 2.;
	float open = smoothstep( 0., .12, age ) * ( 1. - smoothstep( .35, 1.1, age ) );
	float core = 1. - smoothstep( .0, .22 + .2 * noise( vec2( vUv.y * 6. - age * 8., 3. ) ), x );
	float a = core * open * smoothstep( 0., .1, vUv.y ) * ( 1. - smoothstep( .7, 1., vUv.y ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .55, .36, .05 ), vec3( 1., .92, .64 ) * 2.4, smoothstep( .3, .9, core ) ), a );
}`;
const SPECK = `
uniform vec3 uTint; uniform vec3 uDark;
varying float vAge; varying float vSeed;
void main() {
	float d = length( gl_PointCoord - .5 ) * 2.;
	float a = ( 1. - smoothstep( .6, .8, d ) ) * ( 1. - smoothstep( .75, 1., vAge ) );
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( uDark, uTint, smoothstep( .75, .2, d ) ), a );
}`;

interface Look { kind: number; body: number; edge: number; core: number; speck: number; dark: number; beam?: boolean }
const LOOKS: Record<string, Look> = {
  'form-oni': { kind: 1, body: 0xff2a0a, edge: 0x2a0000, core: 0xffe2a0, speck: 0xff8a2a, dark: 0x3a0500 },
  'form-celestial': { kind: 2, body: 0xffc94a, edge: 0x5a3a05, core: 0xfff4c8, speck: 0xffe6a0, dark: 0x6a4a10, beam: true },
  'form-negative': { kind: 0, body: 0x050508, edge: 0x000000, core: 0x050508, speck: 0x050508, dark: 0x000000 },
};
const STAGE_LOOKS: Look[] = [
  { kind: 0, body: 0x0a0a12, edge: 0x000000, core: 0x0a0a12, speck: 0x0a0a12, dark: 0x000000 },
  { kind: 0, body: 0x0a0a12, edge: 0x000000, core: 0x0a0a12, speck: 0x0a0a12, dark: 0x000000 },
  { kind: 3, body: 0xe0187e, edge: 0x05a0e0, core: 0xe0187e, speck: 0x05a0e0, dark: 0x101010 },
  { kind: 2, body: 0xffc94a, edge: 0x5a3a05, core: 0xfff0b0, speck: 0xffd060, dark: 0x6a4a10, beam: true },
];

class Burst implements Effect {
  readonly root = new THREE.Group();
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly specks: Motes;
  constructor(look: Look, at: THREE.Vector3, height: number, private readonly start: number) {
    const options = { transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide } as const;
    const ground = new THREE.PlaneGeometry(1, 1); ground.rotateX(-Math.PI / 2); this.geometries.push(ground);
    const ring = new THREE.Mesh(ground, new THREE.ShaderMaterial({ ...options, vertexShader: FLAT, fragmentShader: NOISE + RING,
      uniforms: { ...auraShared, uStart: { value: start }, uKind: { value: look.kind }, uBody: { value: new THREE.Color(look.body) }, uEdge: { value: new THREE.Color(look.edge) }, uCore: { value: new THREE.Color(look.core).multiplyScalar(2) } } }));
    ring.position.set(at.x, at.y + .05, at.z); ring.scale.setScalar(height * 4.2);
    this.add(ring);
    if (look.beam) {
      const quad = new THREE.PlaneGeometry(1, 1); this.geometries.push(quad);
      const beam = new THREE.Mesh(quad, new THREE.ShaderMaterial({ ...options, vertexShader: STANDING, fragmentShader: NOISE + BEAM,
        uniforms: { ...auraShared, uSize: { value: new THREE.Vector2(height * .9, height * 7) }, uBack: { value: .2 }, uRoll: { value: 0 }, uStart: { value: start } } }));
      beam.position.set(at.x, at.y + height * 3.4, at.z);
      this.add(beam);
    }
    this.specks = new Motes(40, SPECK, { life: 1.1, size: [.14, .05], pull: [0, -4, 0], sway: [.1, 3], uniforms: { uTint: { value: new THREE.Color(look.speck).multiplyScalar(look.kind === 1 || look.kind === 2 ? 1.8 : 1) }, uDark: { value: new THREE.Color(look.dark) } } });
    this.root.add(this.specks.points);
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4.5;
      this.specks.emit(at.x + Math.cos(a) * .25, at.y + height * (.2 + Math.random() * .7), at.z + Math.sin(a) * .25, Math.cos(a) * s, 1.5 + Math.random() * 3, Math.sin(a) * s, start + Math.random() * .1);
    }
  }
  private add(mesh: THREE.Mesh) { mesh.frustumCulled = false; mesh.renderOrder = 7; this.root.add(mesh); this.materials.push(mesh.material as THREE.Material); }
  update(time: number) { return time - this.start < 1.6; }
  dispose() { this.specks.dispose(); for (const material of this.materials) material.dispose(); for (const geometry of this.geometries) geometry.dispose(); this.root.removeFromParent(); }
}

export function makeBurst(id: string, at: THREE.Vector3, height: number, start: number, stage = 0): Effect | undefined {
  const look = id === 'skin-living-ink' ? STAGE_LOOKS[stage] : LOOKS[id];
  return look ? new Burst(look, at.clone(), height, start) : undefined;
}
