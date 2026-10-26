import * as THREE from 'three';
import { GROUND_NOISE } from './glsl';
import { edit, groundMaterial, withLookHead } from './toon';
import type { GroundFrame } from './frame';
import { DENSITY, SPARE, type GroundField, type Rect, type TerrainField } from './mask';
import { PALETTES, type GrassLook } from './grass';
import { DETAIL_TILE, detailTexture } from './detail';

export interface CoverLook {
  opacity?: number;
  specks?: readonly number[];
  speckle?: number;
  earth?: number;
  opaque?: boolean;
}

const COVER_VERTEX = `
uniform float uWarmth;
varying vec3 vCoverWorld;
varying float vCoverDrift;
varying float vCoverValue;
${GROUND_NOISE}`;
const COVER_FRAGMENT = `
uniform sampler2D uMask;
uniform vec4 uMaskRect;
uniform vec3 uRoot;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform float uOpacity;
uniform vec3 uSpecks[ 4 ];
uniform float uSpeckle;
uniform vec3 uEarth;
uniform float uEarthOn;
uniform sampler2D uDetail;
varying vec3 vCoverWorld;
varying float vCoverDrift;
varying float vCoverValue;
float coverHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }`;

export class GroundCover {
  readonly mesh: THREE.Mesh;

  constructor(frame: GroundFrame, field: GroundField, texture: THREE.Texture, terrain: TerrainField | number, grass: GrassLook, look: CoverLook = {}, name = 'grass cover', cell = typeof terrain === 'number' ? 2.5 : 1.5) {
    const geometry = coverGeometry(field, terrain, cell, look.earth !== undefined ? SPARE : DENSITY);
    const r = field.rect;
    const specks = (look.specks ?? [0xffffff]).slice(0, 4);
    while (specks.length < 4) specks.push(specks[specks.length - 1]);
    const uniforms = {
      uMask: { value: texture }, uMaskRect: { value: new THREE.Vector4(r.x0, r.z0, 1 / (r.x1 - r.x0), 1 / (r.z1 - r.z0)) },
      uRoot: { value: new THREE.Color(grass.root) }, uCool: { value: new THREE.Color(grass.cool) }, uWarm: { value: new THREE.Color(grass.warm) },
      uWarmth: { value: grass.warmth ?? .5 }, uOpacity: { value: look.opacity ?? 1 },
      uSpecks: { value: specks.map(h => new THREE.Color(h)) }, uSpeckle: { value: look.speckle ?? 0 },
      uEarth: { value: new THREE.Color(look.earth ?? 0) }, uEarthOn: { value: look.earth !== undefined ? 1 : 0 },
      uDetail: { value: detailTexture() },
    };
    if (import.meta.env?.DEV) PALETTES.add(uniforms);
    const opaque = !!look.opaque && look.earth !== undefined;
    const material = groundMaterial(name, opaque ? 'ground-cover-v2-opaque' : 'ground-cover-v2', shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = COVER_VERTEX + shader.vertexShader;
      shader.vertexShader = edit(shader.vertexShader, '#include <project_vertex>', 'vCoverWorld = ( modelMatrix * vec4( transformed, 1. ) ).xyz;\nvCoverDrift = .3 + .6 * smoothstep( uWarmth - .22, uWarmth + .22, groundFbm( vCoverWorld.xz * .055 + 3.7 ) );\nvCoverValue = groundPatchValue( vCoverWorld.xz );\n#include <project_vertex>', 'cover world');
      shader.fragmentShader = COVER_FRAGMENT + shader.fragmentShader;
      shader.fragmentShader = edit(shader.fragmentShader, '#include <color_fragment>', `#include <color_fragment>
	{
		vec2 p = vCoverWorld.xz;
		vec4 mask = texture2D( uMask, ( p - uMaskRect.xy ) * uMaskRect.zw );
		// The small-scale detail, four smooth noises in one read (detail.ts).
		vec4 detail = texture2D( uDetail, p / ${DETAIL_TILE.toFixed(1)} );
		// Warmer than the blades' own mix: what is seen of a field from a few
		// metres off is its sunlit tips, and the cool half alone read teal.
		vec3 green = mix( uCool, uWarm, vCoverDrift );
		// Broken by clumps and the shade between them, and the field's darker
		// patches, never one flat sheet; a tenth of the colour taken back.
		float clumps = detail.r * .6 + detail.g * .4;
		vec3 colour = mix( uRoot, green, .45 + clumps * .4 ) * ( .84 + detail.a * .2 ) * vCoverValue;
		colour = mix( vec3( dot( colour, vec3( .2126, .7152, .0722 ) ) ), colour, .9 );
		// Specks of flowers on a fine world grid, one in many cells.
		vec2 cell = floor( p * 3. );
		float speckHash = coverHash( cell );
		float speck = step( 1. - uSpeckle * mask.b, speckHash ) * step( length( fract( p * 3. ) - .5 - ( vec2( fract( speckHash * 13.7 ), fract( speckHash * 7.3 ) ) - .5 ) * .5 ), .09 );
		colour = mix( colour, uSpecks[ int( fract( speckHash * 31.1 ) * 3.99 ) ], speck );
		// The grass's edge feathered and broken, never a ruled line.
		float grows = smoothstep( .08, .5, mask.r + ( detail.b - .5 ) * .35 );
		if ( uEarthOn > .5 ) {
			// Bare earth: trodden flat, darker in its hollows, a scatter of pale grit
			// (worked out only where some of it shows).
			if ( grows < .999 ) {
				float lumps = detail.a * .6 + detail.g * .4;
				vec3 earth = uEarth * ( .74 + .42 * lumps );
				vec2 grit = floor( p * 7. );
				float gritHash = coverHash( grit + 11. );
				earth = mix( earth, uEarth * 1.3, step( .975, gritHash ) * step( length( fract( p * 7. ) - .5 ), .16 ) );
				// Where the grass gives out, its roots darken the earth's edge.
				earth = mix( earth, uRoot * .9, smoothstep( .0, .6, grows ) * ( 1. - grows ) * .9 );
				colour = mix( earth, colour, grows );
			}
			diffuseColor.a = smoothstep( .02, .5, mask.a ) * uOpacity;
		} else diffuseColor.a = grows * uOpacity;
		diffuseColor.rgb = colour;
	}`, 'cover colour');
    }, opaque ? { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 } : { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = opaque ? 1 : -2;
    frame.drive(this.mesh);
  }
}

export function coverGeometry(field: GroundField, terrain: TerrainField | number, cell: number, channel: typeof DENSITY | typeof SPARE = DENSITY) {
  const r: Rect = field.rect;
  const nx = Math.max(1, Math.round((r.x1 - r.x0) / cell)), nz = Math.max(1, Math.round((r.z1 - r.z0) / cell));
  const sx = (r.x1 - r.x0) / nx, sz = (r.z1 - r.z0) / nz;
  const height = (x: number, z: number) => typeof terrain === 'number' ? terrain : terrain.sample(x, z);
  const grows = (x: number, z: number) => field.sample(channel, x, z) > .01;
  const index = new Map<number, number>(), position: number[] = [], indices: number[] = [];
  const vertex = (i: number, j: number) => {
    const key = j * (nx + 1) + i;
    let v = index.get(key);
    if (v === undefined) {
      const x = r.x0 + i * sx, z = r.z0 + j * sz;
      v = position.length / 3; index.set(key, v);
      position.push(x, height(x, z) + .015, z);
    }
    return v;
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = r.x0 + i * sx, z = r.z0 + j * sz;
    if (!grows(x + sx / 2, z + sz / 2) && !grows(x, z) && !grows(x + sx, z) && !grows(x, z + sz) && !grows(x + sx, z + sz)) continue;
    const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i + 1, j + 1), d = vertex(i, j + 1);
    indices.push(a, d, c, a, c, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  const normal = new Float32Array(position.length);
  for (let k = 1; k < normal.length; k += 3) normal[k] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setIndex(indices);
  if (typeof terrain !== 'number') g.computeVertexNormals();
  g.computeBoundingSphere();
  return withLookHead(g);
}
