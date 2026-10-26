import * as THREE from 'three';
import { GROUND_NOISE, GROUND_WIND } from './glsl';
import { edit, groundMaterial, withLookHead } from './toon';
import type { GroundFrame, GroundTick } from './frame';
import type { GroundTier } from './quality';
import { DENSITY, FLOWERS, HEIGHT, type GroundField, type Rect } from './mask';
import { PRESS_POINTS, pressPoints } from './grass';
import { ClumpGrid, CLUMP_FETCH } from './clumps';

export interface FlowerLook { colors: readonly number[]; size?: number; reach?: number }

function blossom() {
  const position: number[] = [], petal: number[] = [], index: number[] = [];
  position.push(0, 0, 0); petal.push(0);
  const petals = 5;
  for (let k = 0; k < petals; k++) {
    const a = k / petals * Math.PI * 2, w = Math.PI / petals * .8;
    const base = position.length / 3;
    position.push(Math.cos(a - w) * .22, 0, Math.sin(a - w) * .22, Math.cos(a) * .5, .04, Math.sin(a) * .5, Math.cos(a + w) * .22, 0, Math.sin(a + w) * .22);
    petal.push(.5, 1, .5);
    index.push(0, base + 2, base + 1, 0, base + 1, base);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(position.map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  g.setAttribute('aPetal', new THREE.Float32BufferAttribute(petal, 1));
  g.setIndex(index);
  return withLookHead(g);
}

const FLOWER_VERTEX = `
attribute float aPetal;
uniform float uTime;
uniform float uSize;
uniform float uHeight;
uniform float uBaseY;
uniform vec4 uPress[ ${PRESS_POINTS} ];
uniform vec3 uColors[ 4 ];
varying vec3 vFlowerColor;
${GROUND_NOISE}
${GROUND_WIND}
${CLUMP_FETCH}`;

const FLOWER_PLACE = `
	vec3 flowerWorld;
	{
		// The flower this instance draws, as the CPU culled it: where, and its
		// height in the grass (fading out by the band's edge).
		vec4 clump = groundClump();
		vec2 base = clump.xz;
		float top = clump.w;
		// At the grass's own top, swaying with it, pressed down with it.
		vec2 bend = groundWind( base, uTime ) * .8;
		for ( int i = 0; i < ${PRESS_POINTS}; i ++ ) {
			vec4 p = uPress[ i ];
			if ( p.w <= 0. ) continue;
			vec2 away = base - p.xz; float d = length( away );
			if ( d < p.w ) bend += ( d > 1e-3 ? away / d : vec2( .7 ) ) * ( 1. - smoothstep( p.w * .3, p.w, d ) ) * 1.3;
		}
		float lean = min( length( bend ), .95 );
		vec2 off = normalize( bend + vec2( 1e-4 ) ) * lean * top;
		float rise = sqrt( max( top * top - dot( off, off ), 0. ) );
		// Tipped toward the lens a little, so a flower seen low is not a sliver.
		vec2 toLens = normalize( cameraPosition.xz - base + vec2( 1e-4 ) );
		float size = uSize * ( .7 + .6 * groundHash( base * 4.1 + 8.1 ) ) * clamp( top / max( uHeight, 1e-3 ), .3, 1.2 );
		vec3 p = position * size;
		p.y += dot( p.xz, toLens ) * .55;
		flowerWorld = vec3( base.x + off.x, uBaseY + rise, base.y + off.y ) + p;
		vec3 colour = uColors[ int( groundHash( base * 2.3 + 5.9 ) * 3.99 ) ];
		// A warm heart in every flower.
		vFlowerColor = mix( vec3( 1., .78, .22 ), colour, smoothstep( .1, .45, aPetal ) );
	}
	objectNormal = normalize( vec3( 0., 1., 0. ) + vec3( normalize( cameraPosition.xz - flowerWorld.xz + vec2( 1e-4 ) ), 0. ).xzy * .5 );`;

export class FlowerField {
  readonly mesh: THREE.Mesh;
  private readonly press = Array.from({ length: PRESS_POINTS }, () => new THREE.Vector4());
  private grid?: ClumpGrid;
  private readonly clumps = { value: null as THREE.Texture | null };
  private readonly band: { fadeIn: [number, number]; fadeOut: [number, number] };

  constructor(private readonly frame: GroundFrame, private readonly field: { cpu: GroundField; region: Rect; baseY: number }, private readonly height: number, private readonly look: FlowerLook, name = 'flowers') {
    const reach = look.reach ?? 20;
    this.band = { fadeIn: [0, 0], fadeOut: [reach * .75, reach] };
    const colors = look.colors.slice(0, 4);
    while (colors.length < 4) colors.push(colors[colors.length - 1] ?? 0xffffff);
    const uniforms = {
      uTime: frame.time, uWind: frame.wind, uClumps: this.clumps,
      uSize: { value: look.size ?? .1 }, uHeight: { value: height }, uBaseY: { value: field.baseY },
      uPress: { value: this.press }, uColors: { value: colors.map(h => new THREE.Color(h)) },
    };
    const material = groundMaterial(name, 'ground-flowers-v2', shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = FLOWER_VERTEX + shader.vertexShader;
      shader.vertexShader = edit(shader.vertexShader, '#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + FLOWER_PLACE, 'flower placement');
      shader.vertexShader = edit(shader.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = flowerWorld;', 'flower position');
      shader.fragmentShader = 'varying vec3 vFlowerColor;\n' + shader.fragmentShader;
      shader.fragmentShader = edit(shader.fragmentShader, '#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= vFlowerColor;', 'flower colour');
      shader.fragmentShader = edit(shader.fragmentShader, '#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal );\n\tnonPerturbedNormal = normal;', 'flower normal');
    }, { side: THREE.DoubleSide });
    const geometry = blossom();
    geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    frame.drive(this.mesh);
    frame.add(this);
    this.setQuality(frame.tier);
  }

  setQuality(tier: GroundTier) {
    this.grid?.dispose(); this.grid = undefined;
    this.mesh.visible = tier.blades > 0;
    if (!this.mesh.visible) return;
    const { cpu, region } = this.field, reach = this.band.fadeOut[1], r = cpu.rect, share = tier.decals, height = this.height;
    this.grid = new ClumpGrid({
      region: { x0: Math.max(r.x0, region.x0 - reach), z0: Math.max(r.z0, region.z0 - reach), x1: Math.min(r.x1, region.x1 + reach), z1: Math.min(r.z1, region.z1 + reach) },
      cell: .55, block: 6, salt: 211, capacity: Math.PI * reach * reach / (.55 * .55) * .3, top: height * 1.1,
      clump: (x, z, h1, h2) => h1 < cpu.sample(FLOWERS, x, z) * cpu.sample(DENSITY, x, z) * share ? height * cpu.sample(HEIGHT, x, z) * (.7 + .35 * h2) : 0,
      floor: () => this.field.baseY,
    });
    this.clumps.value = this.grid.texture;
    this.culled = false;
  }

  private culled = false;

  tick(t: GroundTick) {
    const grid = this.grid, geometry = this.mesh.geometry as THREE.InstancedBufferGeometry;
    if (!grid) { geometry.instanceCount = 0; return; }
    if (t.viewMoved || !this.culled) {
      const c = t.camera.position;
      geometry.instanceCount = grid.cull(c.x, c.z, t.frustum, this.band, 'fade', .4);
      if (grid.drawn) t.renderer.initTexture(grid.texture);
      this.culled = true;
    }
    pressPoints(t.bodies, this.press);
  }

  dispose() { this.grid?.dispose(); }
}
