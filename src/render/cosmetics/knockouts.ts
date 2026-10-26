import * as THREE from 'three';
import { Motes, NOISE, PETAL, STANDING, auraShared } from './auras';

export interface Effect { readonly root: THREE.Object3D; update(time: number): boolean; dispose(): void }

class Petals implements Effect {
  readonly root = new THREE.Group();
  private readonly motes = new Motes(90, PETAL, { life: 2.6, size: [.26, .2], pull: [0, -1.1, 0], sway: [.3, 2.4] });
  constructor(at: THREE.Vector3, height: number, private readonly start: number) {
    this.root.add(this.motes.points);
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, up = Math.random() * 1.4 - .2, speed = 1.8 + Math.random() * 3.6;
      this.motes.emit(at.x + Math.cos(a) * .3, at.y + height * (.3 + Math.random() * .5), at.z + Math.sin(a) * .3, Math.cos(a) * speed, speed * up + 1.2, Math.sin(a) * speed, start + Math.random() * .25);
    }
  }
  update(time: number) { return time - this.start < 3.4; }
  dispose() { this.motes.dispose(); this.root.removeFromParent(); }
}

const BOLT = `
uniform float uAuraTime; uniform float uStart; uniform float uSeed;
varying vec2 vUv;
void main() {
	float age = uAuraTime - uStart;
	float lit = step( 0., age ) * ( 1. - smoothstep( .28, .6, age ) ) * ( .65 + .35 * step( .5, fract( age * 22. ) ) );
	float y = vUv.y;
	float jag = ( noise( vec2( y * 9. + uSeed * 40., floor( age * 20. ) ) ) - .5 ) * .5 + ( noise( vec2( y * 31., uSeed * 7. + floor( age * 20. ) ) ) - .5 ) * .16;
	float d = abs( vUv.x - .5 - jag * .5 * smoothstep( 0., .1, y ) );
	float core = smoothstep( .035, .0, d ), glow = smoothstep( .12, .02, d ), edge = smoothstep( .2, .13, d );
	float a = edge * lit;
	if ( a < .02 ) discard;
	gl_FragColor = vec4( mix( mix( vec3( .1, .08, .0 ), vec3( 1., .86, .25 ) * 1.8, glow ), vec3( 4. ), core ), a );
}`;
const SCORCH = `
uniform float uAuraTime; uniform float uStart;
varying vec2 vUv;
void main() {
	float age = uAuraTime - uStart;
	vec2 p = ( vUv - .5 ) * 2.; float r = length( p ), a = atan( p.y, p.x );
	float wave = smoothstep( .1, .0, abs( r - min( 1., age * 2.6 ) ) ) * ( 1. - smoothstep( .2, .6, age ) );
	float cracks = step( .72, noise( vec2( a * 5., r * 3. ) ) ) * ( 1. - smoothstep( .15, .9, r ) ) * ( 1. - smoothstep( .6, 1.8, age ) );
	float alpha = max( wave * .9, cracks * .85 );
	if ( alpha < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .05, .04, .0 ), vec3( 1., .9, .4 ) * 2.2, wave ), alpha );
}`;
const FLAT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1. ); }`;
class Thunder implements Effect {
  readonly root = new THREE.Group();
  private readonly materials: THREE.ShaderMaterial[] = [];
  constructor(at: THREE.Vector3, height: number, private readonly start: number) {
    const options = { transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide } as const;
    const bolt = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ ...options, vertexShader: STANDING, fragmentShader: NOISE + BOLT,
      uniforms: { ...auraShared, uSize: { value: new THREE.Vector2(3.2, 40) }, uBack: { value: 0 }, uRoll: { value: 0 }, uStart: { value: start }, uSeed: { value: Math.random() * 10 } } }));
    bolt.position.set(at.x, at.y + 20, at.z);
    const ground = new THREE.PlaneGeometry(1, 1); ground.rotateX(-Math.PI / 2);
    const scorch = new THREE.Mesh(ground, new THREE.ShaderMaterial({ ...options, vertexShader: FLAT, fragmentShader: NOISE + SCORCH, uniforms: { ...auraShared, uStart: { value: start } } }));
    scorch.position.set(at.x, at.y + .05, at.z); scorch.scale.setScalar(Math.max(4, height * 3.2));
    for (const mesh of [bolt, scorch]) { mesh.frustumCulled = false; mesh.renderOrder = 7; this.root.add(mesh); this.materials.push(mesh.material as THREE.ShaderMaterial); }
  }
  update(time: number) { return time - this.start < 2; }
  dispose() { for (const mesh of this.root.children as THREE.Mesh[]) mesh.geometry.dispose(); for (const material of this.materials) material.dispose(); this.root.removeFromParent(); }
}

export const KNOCKOUT_IDS = ['ko-petals', 'ko-thunder'] as const;
export function makeKnockout(id: string, at: THREE.Vector3, height: number, start: number): Effect | undefined {
  switch (id) {
    case 'ko-petals': return new Petals(at, height, start);
    case 'ko-thunder': return new Thunder(at, height, start);
    default: return undefined;
  }
}
