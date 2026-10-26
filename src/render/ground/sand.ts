import * as THREE from 'three';
import { edit, optOutOfCutaway } from './toon';
import type { GroundFrame, GroundTick } from './frame';
import type { GroundTier } from './quality';
import type { Rect } from './mask';

export interface SandPlan {
  name: string;
  rect: Rect; level: number;
  life?: number;
  shade?: number;
}

const PRINT_VERTEX = `
attribute vec4 aPrint;
attribute float aBorn;
uniform float uTime;
uniform float uLife;
varying vec2 vPrintUv;
varying float vPrintAge;`;

const PRINT_FRAGMENT = `
uniform float uShade;
varying vec2 vPrintUv;
varying float vPrintAge;`;

export class SandPrints {
  readonly mesh: THREE.InstancedMesh;
  private readonly prints: THREE.InstancedBufferAttribute;
  private readonly born: THREE.InstancedBufferAttribute;
  private next = 0;
  private count = 0;
  laid = 0;

  constructor(private readonly frame: GroundFrame, readonly plan: SandPlan, capacity = 384) {
    const card = new THREE.PlaneGeometry(.26, .42).rotateX(-Math.PI / 2);
    this.prints = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.born = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(-1e6), 1);
    card.setAttribute('aPrint', this.prints); card.setAttribute('aBorn', this.born);
    const uniforms = { uTime: frame.time, uLife: { value: plan.life ?? 24 }, uShade: { value: plan.shade ?? .62 } };
    const material = new THREE.MeshBasicMaterial({ name: `${plan.name} prints`, transparent: true, depthWrite: false, fog: false,
      blending: THREE.MultiplyBlending, premultipliedAlpha: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = PRINT_VERTEX + '\n' + shader.vertexShader;
      shader.vertexShader = edit(shader.vertexShader, '#include <begin_vertex>', `#include <begin_vertex>
	{
		// aPrint: x, z, heading (the way the foot points: forward is sin, cos), side (+1 left, -1 right).
		vPrintAge = ( uTime - aBorn ) / uLife;
		vPrintUv = uv;
		float c = cos( aPrint.z ), s = sin( aPrint.z );
		vec3 p = transformed;
		p.x *= aPrint.w;
		// The card's -z (its toe) along the heading, its x to the foot's right.
		transformed = vec3( c * p.x - s * p.z, .012, - s * p.x - c * p.z ) + vec3( aPrint.x, 0., aPrint.y );
		if ( vPrintAge > 1. || vPrintAge < 0. ) transformed = vec3( 0., -1e4, 0. );
	}`, 'print place');
      shader.fragmentShader = PRINT_FRAGMENT + '\n' + shader.fragmentShader;
      shader.fragmentShader = edit(shader.fragmentShader, '#include <color_fragment>', `#include <color_fragment>
	{
		// A sole: the ball and the heel, the arch narrower between, in a 0..1 card (heel at v = 0).
		vec2 q = vPrintUv * 2. - 1.;
		float ball = length( ( q - vec2( .08, .42 ) ) / vec2( .82, .5 ) );
		float heel = length( ( q - vec2( -.04, -.55 ) ) / vec2( .6, .38 ) );
		float arch = length( ( q - vec2( .1, -.05 ) ) / vec2( .5, .55 ) );
		float sole = min( min( ball, heel ), arch );
		float hollow = 1. - smoothstep( .8, .95, sole );
		// Its wall, darkest just inside the edge, where the light does not reach.
		float wall = smoothstep( .62, .86, sole ) * hollow;
		// Fresh, then filled in by the wind over its life.
		float fade = 1. - smoothstep( .45, 1., vPrintAge );
		float shade = mix( 1., uShade, hollow * ( .75 + .25 * wall ) * fade );
		// Multiplied over the sand: white leaves it as it is.
		diffuseColor = vec4( vec3( shade ), 1. );
	}`, 'print colour');
    };
    material.customProgramCacheKey = () => 'ground-prints-v2';
    optOutOfCutaway(material);
    this.mesh = new THREE.InstancedMesh(card, material, capacity);
    this.mesh.name = `${plan.name} prints`; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    this.mesh.position.y = plan.level;
    this.mesh.renderOrder = -1;
    const identity = new THREE.Matrix4();
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, identity);
    frame.drive(this.mesh);
    frame.add(this);
    this.setQuality(frame.tier);
  }

  setQuality(tier: GroundTier) {
    this.count = Math.min(this.mesh.instanceMatrix.count, tier.prints);
    this.mesh.count = Math.max(1, this.count);
    this.mesh.visible = this.count > 0;
    this.next = 0;
    this.born.array.fill(-1e6); this.born.needsUpdate = true;
  }

  print(x: number, z: number, heading: number, side: number, time: number) {
    if (this.count <= 0) return;
    const i = this.next; this.next = (this.next + 1) % this.count;
    this.prints.setXYZW(i, x, z, heading, side); this.born.setX(i, time);
    this.prints.needsUpdate = true; this.born.needsUpdate = true;
    this.laid++;
  }

  private readonly last = new Map<string, [number, number, number, number]>();

  tick(t: GroundTick) {
    const r = this.plan.rect;
    for (const b of t.bodies) {
      if (Math.abs(b.y - this.plan.level) > .3 || b.x < r.x0 || b.x > r.x1 || b.z < r.z0 || b.z > r.z1) continue;
      let last = this.last.get(b.id);
      if (!last) this.last.set(b.id, last = [Infinity, Infinity, Infinity, Infinity]);
      for (let i = 0; i < 2; i++) {
        if (!b.stepped[i]) continue;
        const f = b.feet[i];
        if (Math.hypot(f.x - last[i * 2], f.z - last[i * 2 + 1]) < .22) continue;
        last[i * 2] = f.x; last[i * 2 + 1] = f.z;
        this.print(f.x, f.z, b.yaw, i === 0 ? 1 : -1, t.time);
      }
    }
  }

  dispose() { }
}
