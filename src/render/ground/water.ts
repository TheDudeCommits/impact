import * as THREE from 'three';
import { GROUND_NOISE } from './glsl';
import { edit, groundMaterial, withLookHead } from './toon';
import type { GroundFrame, GroundTick } from './frame';
import type { GroundTier } from './quality';
import { DENSITY, GroundField, SPARE, type Rect } from './mask';
import { WaveField, type Impulse } from './waves';
import { addShaderPatch } from '../look/shaderPatch';

export interface WaterLook {
  crest: number; foam: number;
  deep?: number; shallow?: number;
  map?: THREE.Texture | null; tile?: number; flow?: [number, number]; mapAmount?: number;
}

const WATER_DEV = { paused: false, extra: 0, cell: 0, live: new Set<WaterSurface>() };
if (import.meta.env?.DEV && typeof window === 'object') (window as unknown as { __water?: unknown }).__water = {
  sim: (on: boolean) => { WATER_DEV.paused = !on; }, extra: (n: number) => { WATER_DEV.extra = n; },
  cell: (cell: number) => { WATER_DEV.cell = cell; for (const w of WATER_DEV.live) w.regrid(); },
  state: () => [...WATER_DEV.live].map(w => w.state()),
};

export interface WaterPlan {
  name: string;
  rect?: Rect; level: number;
  sim: Rect;
  open?: readonly [boolean, boolean, boolean?, boolean?];
  walls: (field: GroundField) => void;
  wallTexel?: number;
  look: WaterLook;
  source?: THREE.Mesh;
  speed?: number; damping?: number;
  slope?: number;
  sources?: { x: number; z: number; radius: number; depth: number; every: number }[];
}

const WATER_VERTEX = `
uniform sampler2D uWaves;
uniform vec4 uSimRect;
uniform float uWaveOn;
uniform float uWaveLift;
varying vec3 vWaterWorld;`;

const WATER_FRAGMENT = `
uniform sampler2D uWaves;
uniform sampler2D uWalls;
uniform vec4 uSimRect;
uniform vec2 uWaveTexel;
uniform float uWaveOn;
uniform float uWaveSlope;
uniform vec3 uCrest;
uniform vec3 uFoam;
uniform float uWaterTime;
varying vec3 vWaterWorld;
${GROUND_NOISE}
float waterH( vec2 uv ) { return texture2D( uWaves, uv ).r; }
float waterRaise, waterLower, waterTrough, waterRing, waterFoam;
vec3 waterTone( vec3 c, vec3 light ) {
	c = mix( c, uCrest * light, waterRaise );
	c *= 1. - waterLower;
	c = mix( c, c * .3, waterTrough );
	c = mix( c, uCrest * light * 1.1, waterRing );
	return mix( c, uFoam * light, waterFoam );
}`;

const WATER_BODY = `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec2 uWaterFlow;
uniform float uWaterTile;
uniform float uMapAmount;
uniform sampler2D uWaterMap;
uniform float uWaterMapOn;`;

const WATER_MARKS = `
	// Inside the field, tested here per pixel: a place's own flat surface is a
	// few big triangles, its corners far outside the field.
	vec2 waterRel = ( vWaterWorld.xz - uSimRect.xy ) / uSimRect.zw;
	float waterInside = step( 0., waterRel.x ) * step( waterRel.x, 1. ) * step( 0., waterRel.y ) * step( waterRel.y, 1. );
	vec2 waterUv = clamp( waterRel, 0., 1. );
	float waterOn = uWaveOn * waterInside;
	float waterHere = waterOn * waterH( waterUv );
	// (Out of any branch: a derivative needs its neighbours to have run it.)
	float waterStep = max( fwidth( waterHere ), 1e-5 );
	vec2 waterSlope = vec2( 0. );
	waterRaise = 0.; waterLower = 0.; waterTrough = 0.; waterRing = 0.; waterFoam = 0.;
	if ( waterOn > .5 ) {
		waterSlope = vec2( waterH( waterUv + vec2( uWaveTexel.x, 0. ) ) - waterH( waterUv - vec2( uWaveTexel.x, 0. ) ),
			waterH( waterUv + vec2( 0., uWaveTexel.y ) ) - waterH( waterUv - vec2( 0., uWaveTexel.y ) ) ) / ( 2. * uWaveTexel * uSimRect.zw );
		// Only where the surface moves: a flat river draws no line.
		float moving = smoothstep( .04, .2, length( waterSlope ) * 6. );
		float near = 1. - smoothstep( 1.2, 2.4, abs( waterHere - .005 ) / waterStep );
		float high = 1. - smoothstep( 1.2, 2.4, abs( waterHere - .024 ) / waterStep );
		waterRing = max( near, high ) * moving * .95;
		waterTrough = ( 1. - smoothstep( 1.2, 2.4, abs( waterHere + .006 ) / waterStep ) ) * moving * .8;
		waterRaise = smoothstep( .004, .06, waterHere ) * .35;
		waterLower = smoothstep( .002, .04, - waterHere ) * .3;
	}
	{
		vec2 p = vWaterWorld.xz;
		float breakUp = groundNoise( p * 3.1 + uWaterTime * .35 ) * .6 + groundNoise( p * 7.7 - uWaterTime * .5 ) * .4;
		float crestFoam = smoothstep( .08, .13, waterHere ) * smoothstep( .35, .6, breakUp );
		// The banks' band (worked out once, into the mask's alpha).
		float shore = waterInside > .5 ? texture2D( uWalls, waterUv ).a : 0.;
		float shoreFoam = shore * smoothstep( .3, .55, breakUp + sin( uWaterTime * 1.3 + p.x * .7 + p.y * .5 ) * .12 );
		waterFoam = max( crestFoam, shoreFoam ) * .92;
	}`;

const WATER_OWN_BODY = `
	{
		vec2 p = vWaterWorld.xz;
		float paint = .5;
		if ( uWaterMapOn > .5 ) {
			vec3 a = texture2D( uWaterMap, p / uWaterTile + uWaterFlow * uWaterTime ).rgb, b = texture2D( uWaterMap, p / uWaterTile * 1.31 + vec2( .37, .11 ) + uWaterFlow * uWaterTime * 1.7 ).rgb;
			paint = dot( mix( a, b, .45 ), vec3( .2126, .7152, .0722 ) );
		}
		float ripple = groundNoise( p * .9 + uWaterFlow * uWaterTime * 6. ) * .5 + groundNoise( p * 2.3 - uWaterFlow * uWaterTime * 9. ) * .5;
		diffuseColor.rgb = mix( uDeep, uShallow, clamp( mix( ripple, paint * 1.6, uMapAmount ), 0., 1. ) );
	}`;

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  readonly walls: THREE.DataTexture;
  waves?: WaveField;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly tier: { sim: boolean; cell: number; rate: number };
  private sourceClock: number[] = [];
  private readonly wakes = new Map<string, { x: number; z: number }>();
  private renderer?: THREE.WebGLRenderer;
  private unsupported = false;

  constructor(private readonly frame: GroundFrame, readonly plan: WaterPlan) {
    const mask = new GroundField(plan.sim, plan.wallTexel ?? .25);
    plan.walls(mask);
    const wall = (x: number, z: number) => mask.sample(DENSITY, x, z);
    mask.map(SPARE, (_, x, z) => Math.max(wall(x + .7, z), wall(x - .7, z), wall(x, z + .7), wall(x, z - .7)) * (1 - wall(x, z)));
    this.walls = new THREE.DataTexture(mask.bytes(), mask.width, mask.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.walls.minFilter = this.walls.magFilter = THREE.LinearFilter; this.walls.needsUpdate = true; this.walls.name = `${plan.name} banks`;
    const s = plan.sim, look = plan.look;
    this.tier = { ...frame.tier.water };
    this.uniforms = {
      uWaves: { value: null }, uWalls: { value: this.walls },
      uSimRect: { value: new THREE.Vector4(s.x0, s.z0, s.x1 - s.x0, s.z1 - s.z0) },
      uWaveTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
      uWaveOn: { value: 0 }, uWaveLift: { value: .8 }, uWaveSlope: { value: plan.slope ?? 6 },
      uCrest: { value: new THREE.Color(look.crest) }, uFoam: { value: new THREE.Color(look.foam) },
      uWaterTime: frame.time,
    };
    const source = plan.source;
    if (source) {
      for (const material of Array.isArray(source.material) ? source.material : [source.material]) addShaderPatch(material, 'ground-water-waves-v1', shader => this.patch(shader, false));
      this.mesh = source;
    } else {
      if (!plan.rect) throw new Error(`${plan.name}: a water surface of its own needs its rect`);
      Object.assign(this.uniforms, {
        uDeep: { value: new THREE.Color(look.deep ?? 0x1c3048) }, uShallow: { value: new THREE.Color(look.shallow ?? 0x3e6c88) },
        uWaterFlow: { value: new THREE.Vector2(...(look.flow ?? [0, 0])) }, uWaterTile: { value: look.tile ?? 6 },
        uMapAmount: { value: look.mapAmount ?? .6 }, uWaterMap: { value: look.map ?? this.walls }, uWaterMapOn: { value: look.map ? 1 : 0 },
      });
      const material = groundMaterial(`${plan.name} surface`, 'ground-water-v2', shader => this.patch(shader, true));
      this.mesh = new THREE.Mesh(waterGeometry(plan.rect, plan.sim, plan.level, meshCell(frame.tier.water)), material);
      this.mesh.name = plan.name; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true;
    }
    frame.drive(this.mesh);
    frame.add(this);
    this.setQuality(frame.tier);
    if (import.meta.env?.DEV) WATER_DEV.live.add(this);
  }

  state() {
    const w = this.waves;
    return { name: this.plan.name, sim: !!w, cell: w ? this.tier.cell : null, rate: w ? this.tier.rate : null, field: w ? [w.width, w.height] : null, vertices: this.mesh.geometry.getAttribute('position').count, own: !!this.plan.source };
  }

  private patch(shader: THREE.WebGLProgramParametersWithUniforms, body: boolean) {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = WATER_VERTEX + shader.vertexShader;
    shader.vertexShader = edit(shader.vertexShader, '#include <begin_vertex>', `#include <begin_vertex>
	{
		vWaterWorld = ( modelMatrix * vec4( transformed, 1. ) ).xyz;
		vec2 suv = ( vWaterWorld.xz - uSimRect.xy ) / uSimRect.zw;
		// A grid of its own is lifted by the waves (a place's own flat surface
		// has its corners outside the field: the waves are drawn on it).
		float inside = step( 0., suv.x ) * step( suv.x, 1. ) * step( 0., suv.y ) * step( suv.y, 1. );
		float lift = uWaveOn * inside * texture2D( uWaves, clamp( suv, 0., 1. ) ).r * uWaveLift;
		transformed.y += lift; vWaterWorld.y += lift;
	}`, 'water lift');
    shader.fragmentShader = WATER_FRAGMENT + (body ? WATER_BODY : '') + shader.fragmentShader;
    shader.fragmentShader = edit(shader.fragmentShader, '#include <color_fragment>', `#include <color_fragment>
${body ? WATER_OWN_BODY : ''}
${WATER_MARKS}
	diffuseColor.rgb = waterTone( diffuseColor.rgb, vec3( 1. ) );`, 'water colour');
    shader.fragmentShader = edit(shader.fragmentShader, '#include <lights_fragment_maps>', `totalEmissiveRadiance = waterTone( totalEmissiveRadiance, max( emissive, vec3( .3 ) ) );
#include <lights_fragment_maps>`, 'water glow');
    shader.fragmentShader = edit(shader.fragmentShader, '#include <normal_fragment_begin>', `#include <normal_fragment_begin>
	{
		vec3 waterN = normalize( vec3( - waterSlope.x * uWaveSlope, 1., - waterSlope.y * uWaveSlope ) );
		normal = normalize( ( viewMatrix * vec4( waterN, 0. ) ).xyz );
		nonPerturbedNormal = normal;
	}`, 'water normal');
  }

  setQuality(tier: GroundTier) {
    const want = this.unsupported ? { ...tier.water, sim: false } : tier.water;
    const changed = !!this.waves !== want.sim || (this.waves && Math.abs(this.tier.cell - want.cell) > 1e-6);
    Object.assign(this.tier, want);
    if (!changed) return;
    this.waves?.dispose(); this.waves = undefined;
    if (want.sim) {
      this.waves = new WaveField(this.plan.sim, this.walls, { cell: want.cell, rate: want.rate, speed: this.plan.speed ?? 3.2, damping: this.plan.damping ?? .45, open: this.plan.open });
      this.uniforms.uWaveTexel.value.copy(this.waves.texel);
    }
    this.uniforms.uWaveOn.value = this.waves ? 1 : 0;
    this.uniforms.uWaves.value = this.waves?.state.value ?? null;
    this.regrid();
  }

  regrid() {
    if (this.plan.source || !this.plan.rect) return;
    const geometry = waterGeometry(this.plan.rect, this.plan.sim, this.plan.level, WATER_DEV.cell || meshCell(this.waves ? this.tier : { sim: false, cell: 0 }));
    this.mesh.geometry.dispose(); this.mesh.geometry = geometry;
  }

  push(p: Impulse) { this.waves?.push(p); }

  tick(t: GroundTick) {
    if (!this.renderer) {
      this.renderer = t.renderer;
      if (!t.renderer.extensions.has('EXT_color_buffer_float') && !t.renderer.extensions.has('EXT_color_buffer_half_float')) {
        this.waves?.dispose(); this.waves = undefined; this.uniforms.uWaveOn.value = 0; this.uniforms.uWaves.value = null; this.unsupported = true; this.regrid();
      }
    }
    const waves = this.waves;
    if (!waves) return;
    const level = this.plan.level;
    for (const b of t.bodies) {
      if (Math.abs(b.y - level) > .3) { this.wakes.delete(b.id); continue; }
      const speed = Math.hypot(b.vx, b.vz), last = this.wakes.get(b.id);
      if (speed > .4 && last && Math.hypot(b.x - last.x, b.z - last.z) > .35) {
        waves.push({ x: b.x, z: b.z, radius: .45, depth: Math.min(.006, .0015 + speed * .0006) });
        last.x = b.x; last.z = b.z;
      } else if (!last) this.wakes.set(b.id, { x: b.x, z: b.z });
    }
    (this.plan.sources ?? []).forEach((s, i) => {
      this.sourceClock[i] = (this.sourceClock[i] ?? Math.random() * s.every) - t.dt;
      if (this.sourceClock[i] > 0) return;
      this.sourceClock[i] = s.every * (.6 + Math.random() * .8);
      const a = Math.random() * Math.PI * 2, r = Math.random() * s.radius;
      waves.push({ x: s.x + Math.cos(a) * r, z: s.z + Math.sin(a) * r, radius: .5 + Math.random() * .6, depth: s.depth * (.6 + Math.random() * .7) });
    });
    if (!WATER_DEV.paused) {
      waves.step(t.renderer, t.dt);
      for (let i = 0; i < WATER_DEV.extra; i++) waves.step(t.renderer, 1 / this.tier.rate);
    }
    this.uniforms.uWaves.value = waves.state.value;
  }

  dispose() { this.waves?.dispose(); this.walls.dispose(); WATER_DEV.live.delete(this); }
}

export function meshCell(water: { sim: boolean; cell: number }) { return water.sim ? Math.max(.25, water.cell * 1.4) : 2; }

export function waterGeometry(rect: Rect, sim: Rect, level: number, cell: number) {
  const axis = (a0: number, a1: number, s0: number, s1: number) => {
    const out: number[] = [];
    const coarse = cell * 4;
    for (let v = a0; v < s0 - 1e-6; v = Math.min(s0, v + coarse)) out.push(v);
    for (let v = Math.max(a0, s0); v < Math.min(a1, s1) - 1e-6; v += cell) out.push(v);
    for (let v = Math.min(a1, s1); v < a1 - 1e-6; v = Math.min(a1, v + coarse)) out.push(v);
    out.push(a1);
    return out;
  };
  const xs = axis(rect.x0, rect.x1, sim.x0, sim.x1), zs = axis(rect.z0, rect.z1, sim.z0, sim.z1);
  const position = new Float32Array(xs.length * zs.length * 3), index: number[] = [];
  let k = 0;
  for (const z of zs) for (const x of xs) { position[k++] = x; position[k++] = level; position[k++] = z; }
  for (let j = 0; j + 1 < zs.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
    const a = j * xs.length + i, b = a + 1, c = a + xs.length, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  const normal = new Float32Array(position.length);
  for (let i = 1; i < normal.length; i += 3) normal[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return withLookHead(g);
}

export function wallsFromModel(field: GroundField, triangles: Iterable<readonly [number, number, number, number, number, number, number, number, number]>, level: number, above = .15) {
  const r = field.rect, sx = (r.x1 - r.x0) / field.width, sz = (r.z1 - r.z0) / field.height;
  for (const [ax, ay, az, bx, by, bz, cx, cy, cz] of triangles) {
    if (Math.max(ay, by, cy) < level + above) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - r.x0) / sx)), i1 = Math.min(field.width - 1, Math.floor((Math.max(ax, bx, cx) - r.x0) / sx));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - r.z0) / sz)), j1 = Math.min(field.height - 1, Math.floor((Math.max(az, bz, cz) - r.z0) / sz));
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    if (Math.abs(d) < 1e-12) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = r.x0 + (i + .5) * sx, z = r.z0 + (j + .5) * sz;
      const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      if (w0 * ay + w1 * by + w2 * cy > level + above) field.data[(j * field.width + i) * 4 + DENSITY] = 1;
    }
  }
  return field;
}
