import * as THREE from 'three';
import { GROUND_NOISE } from './glsl';
import { edit, groundMaterial } from './toon';
import type { GroundFrame, GroundTick } from './frame';
import type { GroundTier } from './quality';
import type { GroundField, Rect, TerrainField } from './mask';
import { ClumpGrid, CLUMP_FETCH } from './clumps';

export interface LitterLook {
  colors: readonly number[];
  size?: number;
  reach?: number;
  where: (x: number, z: number, field: GroundField) => number;
}

export function leafGeometry() {
  const position = [
    0, .05, 0,
    0, 0, -.5, -.27, 0, -.18, -.23, .01, .2, 0, 0, .5, .23, .01, .2, .27, 0, -.18,
  ];
  const index: number[] = [];
  for (let k = 0; k < 6; k++) index.push(0, 1 + k, 1 + (k + 1) % 6);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  const normal: number[] = [];
  for (let i = 0; i < position.length; i += 3) { const n = new THREE.Vector3(position[i] * .6, 1, 0).normalize(); normal.push(n.x, n.y, n.z); }
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('lookHead', new THREE.Float32BufferAttribute(new Float32Array(position.length / 3), 1));
  g.setIndex(index);
  return g;
}

const LITTER_VERTEX = `
uniform float uSize;
uniform vec3 uLeafColors[ 4 ];
varying vec3 vLeafColor;
${GROUND_NOISE}
${CLUMP_FETCH}`;

const LITTER_PLACE = `
	vec3 leafWorld;
	{
		// The leaf this instance draws, as the CPU culled it: where, and its
		// size (shrinking away by the band's edge).
		vec4 clump = groundClump();
		vec2 base = clump.xz;
		vec2 h = groundHash2( base * 3.7 + 1.3 );
		float yaw = h.x * 6.2832, c = cos( yaw ), s = sin( yaw );
		vec3 p = position * uSize * clump.w * ( .7 + .6 * h.y );
		p.xz = vec2( c * p.x + s * p.z, - s * p.x + c * p.z );
		leafWorld = vec3( base.x, clump.y + .012, base.y ) + p;
		objectNormal = normalize( vec3( c * objectNormal.x, objectNormal.y, - s * objectNormal.x ) );
		vec3 colour = uLeafColors[ int( groundHash( base * 2.9 + 4.1 ) * 3.99 ) ];
		// Each leaf a little lighter or darker than its colour.
		vLeafColor = colour * ( .78 + .4 * groundHash( base * 5.3 + 2.2 ) );
	}`;

export class LitterField {
  readonly mesh: THREE.Mesh;
  private grid?: ClumpGrid;
  private readonly clumps = { value: null as THREE.Texture | null };
  private readonly band: { fadeIn: [number, number]; fadeOut: [number, number] };
  private culled = false;

  constructor(private readonly frame: GroundFrame, private readonly field: { cpu: GroundField; region: Rect; floor: TerrainField | number }, private readonly look: LitterLook, name = 'litter') {
    const reach = look.reach ?? 22;
    this.band = { fadeIn: [0, 0], fadeOut: [reach * .75, reach] };
    const colors = look.colors.slice(0, 4);
    while (colors.length < 4) colors.push(colors[colors.length - 1] ?? 0x8a6a3a);
    const uniforms = { uClumps: this.clumps, uSize: { value: look.size ?? .13 }, uLeafColors: { value: colors.map(h => new THREE.Color(h)) } };
    const material = groundMaterial(name, 'ground-litter-v1', shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = LITTER_VERTEX + '\n' + shader.vertexShader;
      shader.vertexShader = edit(shader.vertexShader, '#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + LITTER_PLACE, 'litter placement');
      shader.vertexShader = edit(shader.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = leafWorld;', 'litter position');
      shader.fragmentShader = 'varying vec3 vLeafColor;\n' + shader.fragmentShader;
      shader.fragmentShader = edit(shader.fragmentShader, '#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vLeafColor;', 'litter colour');
    }, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const geometry = leafGeometry();
    geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    frame.drive(this.mesh);
    frame.add(this);
    this.setQuality(frame.tier);
  }

  setQuality(tier: GroundTier) {
    this.grid?.dispose(); this.grid = undefined;
    const share = tier.decals;
    this.mesh.visible = share > 0;
    if (!this.mesh.visible) return;
    const { cpu, region, floor } = this.field, r = cpu.rect, reach = this.band.fadeOut[1], where = this.look.where;
    const cell = .38;
    this.grid = new ClumpGrid({
      region: { x0: Math.max(r.x0, region.x0 - reach), z0: Math.max(r.z0, region.z0 - reach), x1: Math.min(r.x1, region.x1 + reach), z1: Math.min(r.z1, region.z1 + reach) },
      cell, block: 6, salt: 307, capacity: Math.PI * reach * reach / (cell * cell) * .25, top: .1,
      clump: (x, z, h1) => h1 < Math.min(1, Math.max(0, where(x, z, cpu))) * share ? 1 : 0,
      floor: typeof floor === 'number' ? () => floor : (x, z) => floor.sample(x, z),
    });
    this.clumps.value = this.grid.texture;
    this.culled = false;
  }

  get count() { return this.grid?.count ?? 0; }

  tick(t: GroundTick) {
    const grid = this.grid, geometry = this.mesh.geometry as THREE.InstancedBufferGeometry;
    if (!grid) { geometry.instanceCount = 0; return; }
    if (t.viewMoved || !this.culled) {
      const c = t.camera.position;
      geometry.instanceCount = grid.cull(c.x, c.z, t.frustum, this.band, 'fade', .2);
      if (grid.drawn) t.renderer.initTexture(grid.texture);
      this.culled = true;
    }
  }

  dispose() { this.grid?.dispose(); }
}
