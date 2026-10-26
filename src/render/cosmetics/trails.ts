import * as THREE from 'three';
import { auraShared } from './auras';

export interface Trail {
  readonly root: THREE.Object3D;
  update(time: number, dt: number, at: THREE.Vector3, height: number, speed: number, bodies: readonly THREE.Object3D[], seen: boolean): void;
  dispose(): void;
}
const DASHING = 13;

const STREAK_VERTEX = `
attribute float aBorn;
varying vec2 vUv; varying float vBorn;
void main() { vUv = uv; vBorn = aBorn; gl_Position = projectionMatrix * viewMatrix * vec4( position, 1. ); }`;
const STREAK = `
uniform float uAuraTime; uniform float uLife;
varying vec2 vUv; varying float vBorn;
float hash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
void main() {
	float age = clamp( ( uAuraTime - vBorn ) / uLife, 0., 1. );
	// The page's own way of drawing a dash: lines along it at different heights, each reaching back its own
	// distance, over a pale chalk smear - black lines read on paper, the smear on the dark.
	float rows = 11., row = floor( vUv.y * rows ), inRow = abs( fract( vUv.y * rows ) - .5 ) * 2.;
	float reach = .3 + .7 * hash( vec2( row, 5. ) ), weight = .1 + .16 * hash( vec2( row, 9. ) );
	float line = step( inRow, weight ) * step( vUv.x, reach ) * step( .3, hash( vec2( row, 2. ) ) ) * smoothstep( reach, reach - .12, vUv.x );
	float grain = hash( floor( gl_FragCoord.xy * .5 ) );
	float smear = smoothstep( 0., .2, vUv.y ) * smoothstep( 1., .8, vUv.y ) * ( .4 + .25 * grain ) * ( 1. - vUv.x * .6 );
	float fade = ( 1. - age ) * ( 1. - age );
	float alpha = max( line * .92, smear ) * fade;
	if ( alpha < .02 ) discard;
	gl_FragColor = vec4( mix( vec3( .95, .94, .9 ), vec3( .02 ), line ), alpha );
}`;
class ChalkTrail implements Trail {
  readonly root = new THREE.Group();
  private static readonly COLUMNS = 26;
  private readonly samples: { x: number; y: number; z: number; t: number }[] = [];
  private readonly bands: { mesh: THREE.Mesh; position: THREE.BufferAttribute; born: THREE.BufferAttribute; flat: boolean }[] = [];
  private readonly life = .42;
  constructor() {
    const n = ChalkTrail.COLUMNS;
    for (const flat of [false, true]) {
      const geometry = new THREE.BufferGeometry();
      const position = new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3), born = new THREE.BufferAttribute(new Float32Array(n * 2).fill(-1e6), 1), uv = new Float32Array(n * 2 * 2), index: number[] = [];
      for (let i = 0; i < n; i++) { uv.set([i / (n - 1), 0, i / (n - 1), 1], i * 4); if (i < n - 1) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
      position.setUsage(THREE.DynamicDrawUsage); born.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', position); geometry.setAttribute('aBorn', born); geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.setIndex(index);
      const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ vertexShader: STREAK_VERTEX, fragmentShader: STREAK, transparent: true, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide, uniforms: { ...auraShared, uLife: { value: this.life } } }));
      mesh.frustumCulled = false; mesh.renderOrder = 4; this.root.add(mesh);
      this.bands.push({ mesh, position, born, flat });
    }
  }
  update(time: number, _dt: number, at: THREE.Vector3, height: number, speed: number, _bodies: readonly THREE.Object3D[], seen: boolean) {
    const samples = this.samples;
    while (samples.length && time - samples[samples.length - 1].t > this.life) samples.pop();
    if (seen && speed > DASHING) samples.unshift({ x: at.x, y: at.y, z: at.z, t: time });
    else if (samples.length && samples[0].t > -1e5 && time - samples[0].t > .05) samples.unshift({ x: samples[0].x, y: samples[0].y, z: samples[0].z, t: -1e6 });
    if (samples.length > ChalkTrail.COLUMNS) samples.length = ChalkTrail.COLUMNS;
    this.root.visible = samples.length > 1;
    if (!this.root.visible) return;
    for (const band of this.bands) {
      for (let i = 0; i < ChalkTrail.COLUMNS; i++) {
        const s = samples[Math.min(i, samples.length - 1)], next = samples[Math.min(i + 1, samples.length - 1)];
        let sx = 0, sy = height * .4, sz = 0;
        if (band.flat) { const dx = next.x - s.x, dz = next.z - s.z, l = Math.hypot(dx, dz) || 1; sx = -dz / l * height * .3; sy = 0; sz = dx / l * height * .3; }
        const cy = s.y + height * .56;
        band.position.setXYZ(i * 2, s.x - sx, cy - sy, s.z - sz); band.position.setXYZ(i * 2 + 1, s.x + sx, cy + sy, s.z + sz);
        const born = i < samples.length ? s.t : -1e6;
        band.born.setX(i * 2, born); band.born.setX(i * 2 + 1, born);
      }
      band.position.needsUpdate = band.born.needsUpdate = true;
    }
  }
  dispose() { for (const band of this.bands) { band.mesh.geometry.dispose(); (band.mesh.material as THREE.Material).dispose(); } this.root.removeFromParent(); }
}

class FrozenSkeleton extends THREE.Skeleton {
  update() { }
  hold(live: THREE.Skeleton) {
    if (!this.boneTexture) this.computeBoneTexture();
    const from = live.boneMatrices!, to = this.boneMatrices!;
    to.set(from.length > to.length ? from.subarray(0, to.length) : from);
    this.boneTexture!.needsUpdate = true;
  }
}
const SKIP = /aura|effect|fx|shadow|outline|glow|trail|smoke|flame|wing_fx/i;
interface Ghost { material: THREE.MeshBasicMaterial; meshes: THREE.SkinnedMesh[]; skeletons: Map<THREE.Skeleton, FrozenSkeleton>; body?: THREE.Object3D; born: number }

class Afterimage implements Trail {
  readonly root = new THREE.Group();
  private readonly ghosts: Ghost[] = [];
  private nextGhost = 0;
  private cursor = 0;
  private readonly life = .34;
  constructor(private readonly tint: THREE.Color, count = 5) {
    for (let i = 0; i < count; i++) this.ghosts.push({ material: new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }), meshes: [], skeletons: new Map(), born: -1e6 });
  }
  update(time: number, _dt: number, _at: THREE.Vector3, _height: number, speed: number, bodies: readonly THREE.Object3D[], seen: boolean) {
    if (seen && speed > DASHING && time >= this.nextGhost) {
      const body = bodies.find(each => each.visible && each.parent);
      if (body) { this.nextGhost = time + .05; this.capture(this.ghosts[this.cursor], body, time); this.cursor = (this.cursor + 1) % this.ghosts.length; }
    }
    for (const ghost of this.ghosts) {
      const age = (time - ghost.born) / this.life, shown = age >= 0 && age < 1;
      for (const mesh of ghost.meshes) mesh.visible = shown;
      if (shown) ghost.material.opacity = .62 * (1 - age) * (1 - age);
    }
  }
  private capture(ghost: Ghost, body: THREE.Object3D, time: number) {
    if (ghost.body !== body) {
      for (const mesh of ghost.meshes) mesh.removeFromParent();
      ghost.meshes = []; ghost.skeletons.clear(); ghost.body = body;
      body.traverse(node => {
        const live = node as THREE.SkinnedMesh;
        if (!live.isSkinnedMesh || live.userData.glowHull || live.userData.afterimage || SKIP.test(live.name)) return;
        const materials = Array.isArray(live.material) ? live.material : [live.material];
        if (materials.some(m => m.transparent || !m.visible || m.side === THREE.BackSide)) return;
        let frozen = ghost.skeletons.get(live.skeleton);
        if (!frozen) { frozen = new FrozenSkeleton(live.skeleton.bones, live.skeleton.boneInverses); ghost.skeletons.set(live.skeleton, frozen); }
        const copy = new THREE.SkinnedMesh(live.geometry, ghost.material);
        copy.bind(frozen, live.bindMatrix);
        copy.userData.afterimage = live; copy.name = 'cosmetic-afterimage';
        copy.matrixAutoUpdate = false; copy.frustumCulled = false; copy.castShadow = false; copy.receiveShadow = false; copy.renderOrder = 3;
        this.root.add(copy); ghost.meshes.push(copy);
      });
    }
    for (const [live, frozen] of ghost.skeletons) frozen.hold(live);
    for (const copy of ghost.meshes) { copy.matrix.copy((copy.userData.afterimage as THREE.SkinnedMesh).matrixWorld); copy.matrixWorldNeedsUpdate = true; }
    ghost.born = time;
  }
  dispose() {
    for (const ghost of this.ghosts) { for (const mesh of ghost.meshes) mesh.removeFromParent(); for (const frozen of ghost.skeletons.values()) frozen.dispose(); ghost.material.dispose(); }
    this.root.removeFromParent();
  }
}

export const TRAIL_IDS = ['trail-chalk', 'trail-afterimage'] as const;
export function makeTrail(id: string, tint: THREE.Color): Trail | undefined {
  switch (id) {
    case 'trail-chalk': return new ChalkTrail();
    case 'trail-afterimage': return new Afterimage(tint);
    default: return undefined;
  }
}
