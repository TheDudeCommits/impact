import * as THREE from 'three';
import { Flesh } from '../horde/flesh';
import type { V3 } from '../horde/kit';
import type { Sculpt } from './sculpt';

const ORIGIN: V3 = [0, 0, 0];
let HAND: THREE.BufferGeometry | undefined;

export function stoneHand(): THREE.BufferGeometry {
  return HAND ??= sculptHand();
}
export const hasHand = () => !!HAND;
export function adoptHand(geometry: THREE.BufferGeometry) {
  if (HAND) geometry.dispose(); else HAND = geometry;
}
export function sculptHand(): THREE.BufferGeometry {
  const f = new Flesh([]);
  const add = (p: V3, d: V3, k: number): V3 => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
  const dir = (x: number, y: number, z: number): V3 => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  f.soft(.35).color(0x4a3e44);
  f.capsule([0, -2.4, -.2], [0, 4.2, 0], 1.25, .95);
  f.ellipsoid([0, 5.1, .05], 1.65, 1.35, .72);
  const fingers: [number, number, number][] = [[-1.25, 1, -.42], [-.42, 1.2, -.14], [.42, 1.15, .14], [1.2, .9, .4]];
  for (const [x, length, spread] of fingers) {
    let at: V3 = [x, 6.1, .05];
    let d = dir(spread, 1, .05);
    const joints = [1.35 * length, 1.05 * length, .8 * length], radii = [.4, .33, .26];
    for (let i = 0; i < 3; i++) {
      const next = add(at, d, joints[i]);
      f.soft(.14).capsule(at, next, radii[i], radii[i] * (i === 2 ? .45 : .88));
      f.soft(.1).ellipsoid(at, radii[i] * 1.12, radii[i] * 1.05, radii[i] * 1.05);
      at = next;
      d = dir(d[0] * 1.05, d[1] * .9, d[2] + .2);
    }
  }
  let at: V3 = [1.5, 4.5, .3], d = dir(1, .7, .35);
  for (const [length, radius] of [[1.2, .45], [.95, .36], [.7, .27]] as const) {
    const next = add(at, d, length);
    f.soft(.14).capsule(at, next, radius, radius * .85);
    at = next; d = dir(d[0] * .7, d[1], d[2] + .35);
  }
  for (const x of [-.9, -.3, .3, .9]) f.soft(.2).capsule([x * .6, 2.8, -.72], [x, 5.8, -.55], .16, .12);
  void ORIGIN;
  return f.build({ cell: .13, occlusion: .95 });
}

export function colossalSword(k: Sculpt, x: number, y: number, z: number, yaw: number, scale = 1, lean = .12) {
  const blade = 52 * scale, width = 3.6 * scale, thick = .6 * scale;
  const up = (h: number): [number, number, number] => [x + Math.sin(yaw) * Math.sin(lean) * h, y + Math.cos(lean) * h, z + Math.cos(yaw) * Math.sin(lean) * h];
  k.use('metal', 0x2e2c30, .05);
  const [bx, by, bz] = up(-4 * scale);
  k.box(bx, by, bz, width, blade + 4 * scale, thick, yaw, lean, 0);
  k.use('metal', 0x46444a, .05).box(bx, by, bz, width * .18, blade + 4 * scale, thick * 1.2, yaw, lean, 0);
  const [cx, cy, cz] = up(blade);
  k.use('metal', 0x2a282c, .05).box(cx, cy, cz, width * 4.2, 1.8 * scale, thick * 2.6, yaw, lean, 0);
  const [gx, gy, gz] = up(blade + 1.8 * scale);
  k.use('cloth', 0x1a1214, .08).box(gx, gy, gz, width * .34, 9 * scale, width * .34, yaw, lean, 0);
  const [px, py, pz] = up(blade + 10.8 * scale);
  k.use('metal', 0x2a282c, .05).box(px, py, pz, width * .8, 2.2 * scale, width * .8, yaw, lean, 0);
}

export class SkyDemons {
  readonly mesh: THREE.InstancedMesh;
  private readonly time: { value: number };

  constructor(centre: THREE.Vector3, count: number, time: { value: number }, ring = { radius: [14, 60], height: [-18, 32], size: 1, round: .55, seed: 7 }) {
    this.time = time;
    const v: number[] = [], wing = (side: number) => {
      const pts: [number, number][] = [[.08, .12], [.55, .3], [1, .05], [.82, -.12], [.66, -.02], [.5, -.22], [.34, -.06], [.14, -.2]];
      for (let i = 1; i < pts.length - 1; i++) {
        for (const [px, pz] of [pts[0], pts[i], pts[i + 1]]) v.push(px * side, 0, pz);
      }
    };
    wing(1); wing(-1);
    v.push(0, 0, .45, -.07, 0, -.1, .07, 0, -.1);
    v.push(-.07, 0, -.1, 0, 0, -.5, .07, 0, -.1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const data = new Float32Array(count * 4);
    let seed = ring.seed;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const [r0, r1] = ring.radius, [h0, h1] = ring.height;
    for (let i = 0; i < count; i++) data.set([r0 + rnd() * (r1 - r0), (rnd() < .5 ? -1 : 1) * (.06 + rnd() * .08) * 74 / (r0 + r1), rnd() * 6.283, h0 + rnd() * (h1 - h0)], i * 4);
    geometry.setAttribute('aDemon', new THREE.InstancedBufferAttribute(data, 4));
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uCentre: { value: centre.clone() }, uColor: { value: new THREE.Color(0x0b0305) }, uSize: { value: ring.size }, uRound: { value: ring.round } },
      vertexShader: `
uniform float uTime; uniform vec3 uCentre; uniform float uSize; uniform float uRound;
attribute vec4 aDemon; // circle radius, angular speed, phase, height
void main() {
	float a = aDemon.z + uTime * aDemon.y;
	float flap = sin( uTime * ( 5.0 + fract( aDemon.z * 3.1 ) * 3.0 ) + aDemon.z * 11.0 );
	vec3 p = position;
	// The wings beat: lifted at the tip, the body still.
	p.y += flap * abs( p.x ) * .55;
	p.x *= 1.0 - abs( flap ) * .12;
	float size = ( 3.2 + fract( aDemon.z * 7.3 ) * 2.6 ) * uSize;
	// Facing along its circle.
	float heading = a + ( aDemon.y > 0.0 ? 1.5708 : -1.5708 );
	mat2 turn = mat2( cos( heading ), -sin( heading ), sin( heading ), cos( heading ) );
	p.xz = turn * p.xz;
	vec3 world = uCentre + vec3( cos( a ) * aDemon.x, aDemon.w + sin( uTime * .4 + aDemon.z ) * 3.0 * uSize, sin( a ) * aDemon.x * uRound ) + p * size;
	gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}`,
      fragmentShader: `uniform vec3 uColor; void main() { gl_FragColor = vec4( uColor, 1.0 ); }`,
      side: THREE.DoubleSide, fog: false, toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.name = 'rift-sky-demons'; this.mesh.frustumCulled = false; this.mesh.renderOrder = -4;
  }

  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}
