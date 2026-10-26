import * as THREE from 'three';
import { STAGE_PROPS } from '../../../game/stageProps';
import { modelTriangles, type GroundContext, type GroundPlan } from '../build';
import { circle, DENSITY, FLOWERS, GroundField, HEIGHT, paintTriangles, valueNoise } from '../mask';

const LAWN = /^grass_Mat$/;
const isLawn = (mesh: THREE.Mesh) => LAWN.test((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name);
const SOIL = /RG Ground Mat/;
const isSoil = (mesh: THREE.Mesh) => SOIL.test((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name);

export const KAMI_CORNERS = { inner: 42, outer: 55.2, half: .4 };

export const KAMI_GROUND: GroundPlan = {
  wind: { heading: .9, strength: .2, gusts: 3.5 },
  grass: [{
    name: 'kami lawns',
    rect: { x0: -56, z0: -56, x1: 56, z1: 56 }, texel: .5,
    floor: { keep: mesh => isLawn(mesh) || /^chao_Mat$/.test((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name), texel: .5, up: .8, fallback: 0 },
    look: { height: .34, root: 0x2a5a2e, cool: 0x46a85a, warm: 0x8cc44c, tip: 0xb8d86a, warmth: .5, width: .045 },
    cover: { specks: [0xffffff, 0xffe27a, 0xffb8d8], speckle: .05, opacity: .96 },
    flowers: false,
    paint: paintLawns,
  }, {
    name: 'kami beds',
    rect: { x0: -56, z0: -56, x1: 56, z1: 56 }, texel: .25,
    floor: { keep: isSoil, source: 'root', texel: .25, up: .5, fallback: .3 },
    look: { height: .32, root: 0x2a5a2e, cool: 0x46a85a, warm: 0x8cc44c, tip: 0xb8d86a, warmth: .5, width: .045 },
    cover: { opacity: .9 },
    flowers: false,
    paint(field: GroundField, c: GroundContext) {
      paintTriangles(field, DENSITY, modelTriangles(c.root, isSoil), 1);
      for (const bed of kamiBeds()) field.paint(DENSITY, circle(bed.x, bed.z, bed.radius * 1.2), 1, 'min', .6);
      field.fill(HEIGHT, 1);
    },
  }],
};

function paintLawns(field: GroundField, c: GroundContext) {
  paintTriangles(field, DENSITY, modelTriangles(c.model, isLawn), 1);
  const ragged = valueNoise(93), tall = valueNoise(94), bloom = valueNoise(95);
  const { inner, outer, half } = KAMI_CORNERS;
  field.map(DENSITY, (v, x, z) => Math.max(v, cornerLawn(x, z, inner, outer, half, ragged)));
  field.map(HEIGHT, (_, x, z) => .8 + .4 * tall(x * .15, z * .15));
  field.map(FLOWERS, (_, x, z) => bloom(x * .2, z * .2) > .64 ? 1 : 0);
}

export function cornerLawn(x: number, z: number, inner: number, outer: number, half: number, ragged: (x: number, z: number) => number) {
  const r = Math.hypot(x, z);
  if (r < inner - 3 || r > outer + .5) return 0;
  const quarter = Math.PI / 2, d = ((Math.atan2(z, x) - Math.PI / 4) % quarter + quarter) % quarter, off = Math.min(d, quarter - d);
  const n = ragged(x * .18, z * .18);
  const radial = smooth(inner - 1.5 + n * 3, inner + .5 + n * 3, r) * (1 - smooth(outer - .6, outer, r));
  const angular = 1 - smooth(half - .08 + n * .12, half + .06 + n * .12, off);
  return radial * angular;
}

function smooth(a: number, b: number, x: number) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

export function kamiBeds() {
  const beds: { x: number; z: number; radius: number }[] = [];
  for (const p of STAGE_PROPS['kami-lookout'] ?? []) if (p.piece === 'br/tree-place') beds.push({ x: p.x, z: p.z, radius: 1.45 * (p.scale ?? 1) * .62 });
  for (let i = 0; i < 44; i++) {
    const a = i / 44 * Math.PI * 2, x = Math.sin(a) * 50, z = Math.cos(a) * 50;
    if (z < -20 && Math.abs(x) < 34) continue;
    if (i % 4 === 2) beds.push({ x, z, radius: 1.45 * 1.6 * .62 });
  }
  return beds;
}
