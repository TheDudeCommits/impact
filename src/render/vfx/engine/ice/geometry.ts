// The crystal and the glacial core are adapted from the VFX Armory (MIT; notices in ./LICENSE.upstream.txt):
//  - `crystal` from ability-project-27 src/abilities/frostLance/FrostLanceGeometry.ts (itzmitto), itself adapted from
//    LinearAbilityExtThreeJS's ice snapshots (mohamedachrefelouafi);
//  - `glacialCore` from hand-cast-abilities src/assets/GlacialGeometry.js (mohamedachrefelouafi).
// Changes: both write into one merged buffer with a variant id per vertex, a barycentric for the cut edges (with the
// band diagonals hidden), outward face normals; the core is turned to stand on the crystal's unit space (nose up).
import * as THREE from 'three';

const TAU = Math.PI * 2;
/** The donors' deterministic sine hash (utils/math.js hash11). */
const hash11 = (p: number) => { const s = Math.sin(p * 127.1) * 43758.5453123; return s - Math.floor(s); };

/** The crystal batch's shapes, one draw: each instance picks one (the data vec4's z). */
export const CRYSTAL = Object.freeze({ spike: 0, blade: 1, rubble: 2, core: 3, column: 4 });
export type CrystalVariant = typeof CRYSTAL[keyof typeof CRYSTAL];

type P3 = readonly [number, number, number];

/** Triangles with flat normals, a barycentric per corner and a variant id, written once into a buffer. */
class Builder {
  readonly position: number[] = [];
  readonly normal: number[] = [];
  readonly bary: number[] = [];
  readonly variant: number[] = [];
  private v = 0;
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3();
  private n = new THREE.Vector3(); private m = new THREE.Vector3();
  use(variant: number) { this.v = variant; return this; }
  /** One triangle, wound to face away from `inside`. `hide` is a mask of corners (bit 0, 1, 2) whose opposite edges
   *  are no cut (a band's diagonal, the seams between rings): those edges get no hairline, so a crystal shows its
   *  facets running its length, as a real one does, rather than a mesh's grid. */
  tri(p: P3, q: P3, r: P3, inside: P3, hide = 0) {
    this.a.set(p[0], p[1], p[2]); this.b.set(q[0], q[1], q[2]); this.c.set(r[0], r[1], r[2]);
    this.n.subVectors(this.b, this.a).cross(this.m.subVectors(this.c, this.a));
    if (this.n.lengthSq() < 1e-14) return;
    this.n.normalize();
    this.m.copy(this.a).add(this.b).add(this.c).multiplyScalar(1 / 3).sub(this.c.set(inside[0], inside[1], inside[2]));
    let corners: P3[] = [p, q, r];
    let k = hide;
    // Flipped, the second and third corners trade places, and so do their bits.
    if (this.n.dot(this.m) < 0) { corners = [p, r, q]; this.n.negate(); k = (k & 1) | ((k & 2) << 1) | ((k & 4) >> 1); }
    for (let i = 0; i < 3; i++) {
      const at = corners[i];
      this.position.push(at[0], at[1], at[2]); this.normal.push(this.n.x, this.n.y, this.n.z);
      // A corner's own coordinate is 1 at it; a hidden edge's coordinate is 1 everywhere, so it never reaches 0.
      this.bary.push(i === 0 || k & 1 ? 1 : 0, i === 1 || k & 2 ? 1 : 0, i === 2 || k & 4 ? 1 : 0);
      this.variant.push(this.v);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normal, 3));
    g.setAttribute('aBary', new THREE.Float32BufferAttribute(this.bary, 3));
    g.setAttribute('aVariant', new THREE.Float32BufferAttribute(this.variant, 1));
    // Placed in world space per instance and never culled by its bounds.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }
}

const RING_HEIGHTS = [0, .22, .5, .75, .92];
const profileRadius = (t: number, taper: number) => taper + (1 - taper) * Math.pow(1 - t, 1.15);

/** A single ice crystal: a tapered, faceted, slightly bent prism (FrostLanceGeometry `createCrystalGeometry`).
 *  Unit space: the base ring on y = 0 with radius 0.5, the apex at y = 1, so an instance scales footprint and height
 *  apart and the shader reads local y as "how far up this crystal". */
function crystal(out: Builder, { seed = 1, sides = 6, taper = .13, roughness = .28, bend = .22 }) {
  const facets = Math.max(3, Math.round(sides)), tipRadius = Math.min(.9, Math.max(.01, taper));
  // One bend per crystal, so a field leans as a field rather than every spike curving the same way.
  const bendAngle = hash11(seed * 1.77) * TAU, bendX = Math.cos(bendAngle), bendZ = Math.sin(bendAngle);
  const axisOffset = (t: number) => bend * .5 * Math.pow(t, 1.6);
  // Angles jittered once and shared by every ring: the facets stay continuous edges up the crystal.
  const angles: number[] = [];
  for (let i = 0; i < facets; i++) angles.push((i / facets) * TAU + (hash11(seed * 3.13 + i * 7.7) - .5) * (TAU / facets) * .55 * roughness * 3);
  const rings = RING_HEIGHTS.map((t, ringIndex) => {
    const baseR = profileRadius(t, tipRadius) * .5, drift = axisOffset(t);
    const y = t + (hash11(seed * 5.9 + ringIndex * 2.3) - .5) * .06 * roughness * (t > 0 ? 1 : 0);
    return angles.map((angle, i) => {
      // Ragged toward the tip: round where it leaves the ground, torn where it broke.
      const wobble = 1 + (hash11(seed * 11.1 + ringIndex * 13.7 + i * 3.9) - .5) * roughness * 1.3 * (.35 + .65 * t);
      const r = Math.max(.002, baseR * wobble);
      return [Math.cos(angle) * r + bendX * drift, y, Math.sin(angle) * r + bendZ * drift] as const;
    });
  });
  // The apex a little off the axis: a chipped tip, not a cone's vertex.
  const apexDrift = axisOffset(1);
  const apex = [bendX * apexDrift + (hash11(seed * 17.3) - .5) * .09 * roughness, 1, bendZ * apexDrift + (hash11(seed * 19.7) - .5) * .09 * roughness] as const;
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const lower = rings[ring], upper = rings[ring + 1], t = (RING_HEIGHTS[ring] + RING_HEIGHTS[ring + 1]) / 2, d = axisOffset(t);
    const inside = [bendX * d, t, bendZ * d] as const;
    for (let i = 0; i < facets; i++) {
      const j = (i + 1) % facets;
      // Each facet is two triangles: the diagonal between them and the seams between rings are no cuts.
      out.tri(lower[i], lower[j], upper[i], inside, 1 | 4);
      out.tri(lower[j], upper[j], upper[i], inside, 2 | 1);
    }
  }
  const top = rings[rings.length - 1], base = rings[0], tipInside = [bendX * apexDrift, .9, bendZ * apexDrift] as const;
  for (let i = 0; i < facets; i++) {
    const j = (i + 1) % facets;
    out.tri(top[i], top[j], apex, tipInside);
    out.tri([0, 0, 0], base[j], base[i], [0, .3, 0]);
  }
}

/** The glacial core (GlacialGeometry `createGlacialCoreGeometry`): one big crystal with a needle nose, a wide girdle,
 *  a chipped rear and smaller crystals twinned onto its flanks; every ring turned half a step against the last, so
 *  the skin is an antiprism's triangles, a cut gem's crown. Stood on end here: the nose at y = 1, the rear at y = 0,
 *  the girdle's radius 0.5. */
function glacialCore(out: Builder, { sides = 7, jitter = .3, satellites = 3, seed = 3 }) {
  const n = Math.max(4, Math.round(sides));
  const PROFILE = [[.1, .2], [.27, .62], [.45, 1], [.65, .86], [.83, .52]];
  // Source frame: x along the axis (0 nose .. 1 rear), radius in (y, z). Turned below.
  const turn = (p: readonly number[]) => [p[1] * .5, 1 - p[0], p[2] * .5] as const;
  const rings = PROFILE.map(([x, r], ringIndex) => {
    const twist = (ringIndex % 2) * .5, ring: (readonly [number, number, number])[] = [];
    for (let i = 0; i < n; i++) {
      const a = ((i + twist) / n) * TAU + (hash11(seed * 3.1 + ringIndex * 7.7 + i * 2.3) - .5) * (Math.PI / n) * jitter;
      const rr = r * (1 + (hash11(seed * 13.7 + ringIndex * 5.1 + i * 2.9) - .5) * 2 * jitter * .45);
      const xx = x + (hash11(seed * 7.9 + ringIndex * 3.3 + i * 4.1) - .5) * .06 * jitter;
      ring.push(turn([xx, Math.cos(a) * rr, Math.sin(a) * rr]));
    }
    return ring;
  });
  const nose = turn([0, 0, 0]), rear = turn([1, (hash11(seed * 17.3) - .5) * .3 * jitter, (hash11(seed * 19.7) - .5) * .3 * jitter]), centre = turn([.5, 0, 0]);
  const fan = (apex: readonly [number, number, number], ring: readonly (readonly [number, number, number])[], inside: readonly [number, number, number]) => {
    for (let i = 0; i < ring.length; i++) out.tri(ring[i], ring[(i + 1) % ring.length], apex, inside);
  };
  fan(nose, rings[0], centre);
  for (let r = 0; r < rings.length - 1; r++) {
    const lower = rings[r], upper = rings[r + 1];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.tri(lower[i], lower[j], upper[i], centre); out.tri(lower[j], upper[j], upper[i], centre); }
  }
  fan(rear, rings[rings.length - 1], centre);
  // The satellites: smaller bipyramids rooted on the rear half, pointing back and out.
  const sats = Math.max(0, Math.min(4, Math.round(satellites)));
  const axis = new THREE.Vector3(), u = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), outward = new THREE.Vector3(), root = new THREE.Vector3(), p = new THREE.Vector3();
  for (let k = 0; k < sats; k++) {
    const h = seed * 23.1 + k * 11.7, rootT = .5 + hash11(h + 1.3) * .25, ang = (k / Math.max(sats, 1)) * TAU + hash11(h + 2.1) * 1.2, rootR = .75 - (rootT - .5) * 1.2;
    root.set(rootT, Math.cos(ang) * rootR * .85, Math.sin(ang) * rootR * .85);
    outward.set(0, Math.cos(ang), Math.sin(ang));
    axis.set(.55 + hash11(h + 3.7) * .35, 0, 0).addScaledVector(outward, .75).normalize();
    u.crossVectors(axis, up); if (u.lengthSq() < 1e-4) u.set(0, 0, 1); u.normalize(); v.crossVectors(axis, u).normalize();
    const length = .38 + hash11(h + 4.9) * .22, radius = .16 + hash11(h + 5.3) * .1, m = 5, girdleAt = length * .42, girdle: (readonly [number, number, number])[] = [];
    for (let i = 0; i < m; i++) {
      const a = (i / m) * TAU + (hash11(h + i * 3.1) - .5) * .5 * jitter, rr = radius * (1 + (hash11(h + i * 5.7) - .5) * 2 * jitter * .5);
      p.copy(root).addScaledVector(axis, girdleAt).addScaledVector(u, Math.cos(a) * rr).addScaledVector(v, Math.sin(a) * rr);
      girdle.push(turn([p.x, p.y, p.z]));
    }
    p.copy(root).addScaledVector(axis, length); const tip = turn([p.x, p.y, p.z]);
    p.copy(root).addScaledVector(axis, -length * .25); const foot = turn([p.x, p.y, p.z]);
    p.copy(root).addScaledVector(axis, girdleAt); const mid = turn([p.x, p.y, p.z]);
    fan(tip, girdle, mid); fan(foot, girdle, mid);
  }
}

/** A thin bipyramid on y (0 at the root, 1 at the point, girdle at .32): chips, feathers, rime needles. */
function shard(out: Builder, sides = 4) {
  const girdle: (readonly [number, number, number])[] = [];
  for (let i = 0; i < sides; i++) { const a = (i / sides) * TAU + .4; girdle.push([Math.cos(a) * .5, .32, Math.sin(a) * .5 * (i % 2 ? .62 : 1)]); }
  const tip = [0, 1, 0] as const, root = [0, 0, 0] as const, mid = [0, .32, 0] as const;
  for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; out.tri(girdle[i], girdle[j], tip, mid); out.tri(girdle[j], girdle[i], root, mid); }
}

/** Every crystal shape in one buffer (CRYSTAL names them). */
export function crystalGeometry() {
  const b = new Builder();
  crystal(b.use(CRYSTAL.spike), { seed: 7.3, sides: 6, taper: .12, roughness: .3, bend: .25 });
  crystal(b.use(CRYSTAL.blade), { seed: 29, sides: 7, taper: .2, roughness: .45, bend: .42 });
  // FrostLanceGeometry `createShardGeometry`: the ankle-high rubble round the spikes.
  crystal(b.use(CRYSTAL.rubble), { seed: 5 * 2.7 + 41, sides: 5, taper: .22, roughness: .55, bend: .35 });
  glacialCore(b.use(CRYSTAL.core), { sides: 7, jitter: .3, satellites: 3, seed: 3 });
  crystal(b.use(CRYSTAL.column), { seed: 51.7, sides: 7, taper: .72, roughness: .14, bend: .08 });
  return b.build();
}

/** The chips and feathers batch's one shape. */
export function shardGeometry() { const b = new Builder(); shard(b, 4); return b.build(); }

/** A unit quad on the floor (x and z in -1..1, facing up). */
export function floorQuad() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return g;
}

/** A unit quad facing the lens (x and y in -1..1), for billboards. */
export function cardQuad() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return g;
}
