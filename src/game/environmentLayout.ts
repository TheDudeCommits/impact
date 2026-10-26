import { STAGES, type StageId } from './stages';
import { propBox, riftLayout } from './riftLayouts';
import { propColliders } from './stageProps';
import { RIFT_SOLIDS } from './moba/map';
export interface EnvironmentCollider { x: number; y: number; z: number; halfX: number; halfY: number; halfZ: number }
export type BuildingAsset = 'building-grand' | 'building-shop' | 'building-courtyard' | 'dojo' | 'pagoda' | 'wall-tall';
export interface BuildingPlacement { asset: BuildingAsset; x: number; y: number; z: number; scale: number; rotation: number; shadow?: boolean; backdrop?: boolean }
export const BUILDING_DIMENSIONS: Record<BuildingAsset, readonly [number, number, number]> = {
  'building-grand': [22.45761, 11.10541, 11.85914], 'building-shop': [12.91167, 7.12321, 6.69445],
  'building-courtyard': [14.05077, 6.09409, 9.98164], dojo: [29.99207, 13.28396, 43.59772], pagoda: [10.12751, 15.64664, 10.12373], 'wall-tall': [4.00003, 8.12145, 5.97524],
};
export const AUTHORED_BUILDINGS: readonly BuildingPlacement[] = [
  ...[-1, 1].flatMap(side => [-3, -5.4, -7.8, -10.2, -12.6, -15, -17.4, -19.8].map(z => ({ asset: 'wall-tall' as const, x: side * 8.6, y: 0, z, scale: .6, rotation: -side * Math.PI / 2, shadow: true }))),
  { asset: 'building-shop', x: -14, y: 0, z: -4, scale: 1.12, rotation: Math.PI / 2, shadow: true },
  { asset: 'building-shop', x: 14, y: 0, z: -4, scale: 1.12, rotation: -Math.PI / 2, shadow: true },
  { asset: 'building-grand', x: -18, y: 0, z: -17, scale: .86, rotation: Math.PI / 2, shadow: true },
  { asset: 'building-courtyard', x: 17, y: 0, z: -18, scale: 1.13, rotation: -Math.PI / 2, shadow: true },
  { asset: 'building-courtyard', x: -20, y: 0, z: 27, scale: .94, rotation: Math.PI / 2, shadow: true },
  { asset: 'building-shop', x: 21, y: 0, z: 29, scale: 1.1, rotation: -Math.PI / 2, shadow: true },
  { asset: 'building-grand', x: -42, y: 0, z: 16, scale: 1.05, rotation: Math.PI / 2 },
  { asset: 'building-grand', x: 45, y: 0, z: 20, scale: .93, rotation: -Math.PI / 2 },
  { asset: 'dojo', x: -55, y: 0, z: 49, scale: .65, rotation: Math.PI / 2 },
  { asset: 'dojo', x: 54, y: 0, z: 51, scale: .65, rotation: -Math.PI / 2 },
  { asset: 'building-shop', x: -20, y: 0, z: 57, scale: 1.05, rotation: Math.PI },
  { asset: 'building-courtyard', x: 21, y: 0, z: 57, scale: 1.12, rotation: Math.PI },
  { asset: 'pagoda', x: 0, y: 0, z: 70, scale: 1.05, rotation: Math.PI },
  { asset: 'building-shop', x: -62, y: 0, z: -50, scale: .66, rotation: .06 },
  { asset: 'building-courtyard', x: -34, y: 0, z: -51, scale: .67, rotation: 0 },
  { asset: 'building-courtyard', x: 38, y: 0, z: -52, scale: .67, rotation: -.08 },
  { asset: 'building-shop', x: 65, y: 0, z: -53, scale: .68, rotation: 0 },
  { asset: 'building-courtyard', x: -59, y: 2.372757, z: -65, scale: 1.08, rotation: 0 },
  { asset: 'building-shop', x: -40, y: 2.372757, z: -64, scale: 1.02, rotation: -.06 },
  { asset: 'building-courtyard', x: -10, y: 2.372757, z: -64, scale: .96, rotation: 0 },
  { asset: 'building-courtyard', x: 27, y: 2.372757, z: -65, scale: 1.10, rotation: .04 },
  { asset: 'building-shop', x: 61, y: 2.372757, z: -65, scale: 1.12, rotation: 0 },
  { asset: 'building-courtyard', x: -59, y: 4.745514, z: -77, scale: 1.04, rotation: .02 },
  { asset: 'pagoda', x: -40, y: 4.745514, z: -77, scale: .80, rotation: .04 },
  { asset: 'building-courtyard', x: -7, y: 4.745514, z: -77, scale: 1.15, rotation: 0 },
  { asset: 'building-shop', x: 26, y: 4.745514, z: -78, scale: 1.15, rotation: -.04 },
  { asset: 'building-courtyard', x: 61, y: 4.745514, z: -78, scale: 1.08, rotation: 0 },
  { asset: 'building-courtyard', x: -61, y: 7.118271, z: -90, scale: 1.04, rotation: .02, backdrop: true },
  { asset: 'building-courtyard', x: -33, y: 7.118271, z: -90, scale: 1.0, rotation: -.04, backdrop: true },
  { asset: 'building-courtyard', x: -7, y: 7.118271, z: -89, scale: 1.24, rotation: 0, backdrop: true },
  { asset: 'pagoda', x: -15, y: 7.118271, z: -96, scale: .98, rotation: .04, backdrop: true },
  { asset: 'building-courtyard', x: 26, y: 7.118271, z: -91, scale: 1.15, rotation: -.04, backdrop: true },
  { asset: 'pagoda', x: 32, y: 7.118271, z: -97, scale: .82, rotation: 0, backdrop: true },
  { asset: 'building-shop', x: 61, y: 7.118271, z: -92, scale: 1.15, rotation: 0, backdrop: true },
];
export const BACKDROP_CASTLE = {
  x: -53, y: 4, z: -110, height: 30, rotation: -Math.PI * 2 / 3,
  sourceDimensions: [71.039772, 65.315533, 64.621643] as const,
} as const;
export const PODIUM_DIMENSIONS = [7.32380, .790919, 5.10513] as const;
export const CITY_TERRACES = [
  { x: -49, z: -82, columns: 6, rows: 9, layers: 3, baseY: 0, backdrop: false },
  { x: -4, z: -82, columns: 5, rows: 9, layers: 3, baseY: 0, backdrop: false },
  { x: 29, z: -83, columns: 4, rows: 9, layers: 3, baseY: 0, backdrop: false },
  { x: 61, z: -83, columns: 3, rows: 9, layers: 3, baseY: 0, backdrop: false },
  { x: -49, z: -82, columns: 6, rows: 7, layers: 3, baseY: 2.372757, backdrop: false },
  { x: -4, z: -82, columns: 4, rows: 7, layers: 3, baseY: 2.372757, backdrop: false },
  { x: 29, z: -83, columns: 3, rows: 7, layers: 3, baseY: 2.372757, backdrop: false },
  { x: 61, z: -83, columns: 2, rows: 7, layers: 3, baseY: 2.372757, backdrop: false },
  { x: -49, z: -92, columns: 6, rows: 3, layers: 3, baseY: 4.745514, backdrop: true },
  { x: -4, z: -92, columns: 4, rows: 3, layers: 3, baseY: 4.745514, backdrop: true },
  { x: 29, z: -93, columns: 3, rows: 3, layers: 3, baseY: 4.745514, backdrop: true },
  { x: 61, z: -93, columns: 2, rows: 3, layers: 3, baseY: 4.745514, backdrop: true },
].map(t => ({ ...t, width: t.columns * PODIUM_DIMENSIONS[0], height: t.layers * PODIUM_DIMENSIONS[1], depth: t.rows * PODIUM_DIMENSIONS[2] }));
export const GARDEN_TREES = [
  { x: -28, y: 2.372757, z: -65, scale: .64, backdrop: false },
  { x: 13, y: 2.372757, z: -66, scale: .62, backdrop: false },
  { x: -29, y: 7.118271, z: -94, scale: .76, backdrop: true },
  { x: 9, y: 7.118271, z: -94, scale: .72, backdrop: true },
].map(tree => ({ ...tree, rotation: tree.x * .17 }));
export const STONE_ARCH = { x: 0, y: 0, z: -52, scale: .65, rotation: Math.PI / 2 };
export const HARBOR_BRIDGES = [-27, 27].map(x => ({ x, z: -35, scale: .85 }));
export const BRIDGE_DECK_PROFILE = [[0, 3.212], [2.14, 3.098], [4.28, 2.766], [6.42, 2.236], [8.56, 1.552], [10.67, .778], [12.66165, 0]] as const;
export const BRIDGE_DECK_HALF_WIDTH = 2;
export const BRIDGE_DECK_THICKNESS = .13514;
export function bridgeDeckHeight(distance: number, scale: number): number {
  const sourceDistance = Math.min(12.66165, Math.abs(distance) / scale);
  for (let i = 1; i < BRIDGE_DECK_PROFILE.length; i++) {
    const a = BRIDGE_DECK_PROFILE[i - 1], b = BRIDGE_DECK_PROFILE[i];
    if (sourceDistance <= b[0]) return (a[1] + (b[1] - a[1]) * (sourceDistance - a[0]) / (b[0] - a[0])) * scale;
  }
  return 0;
}
export const TORII = { x: 4.5, y: 2.372757, z: -63, scale: 2.0, rotation: 0 };
export const SAKURA_TREES = [
  { x: -31, z: -22, scale: .64 }, { x: 36, z: -20, scale: .65 },
  { x: -34, z: 36, scale: .67 }, { x: 34, z: 42, scale: .64 },
  { x: -17, z: -56, scale: .54 }, { x: 29, z: -58, scale: .52 },
].map(tree => ({ ...tree, rotation: tree.x * .13 }));
export const QUAY_FLANKS = [-1, 1].flatMap(side => [-16, 8, 36, 63].map(z => ({ x: side * 77, z, length: 25, height: 2.5, depth: 3 })));
export const QUAY_ROCKS = [-1, 1].flatMap(side => Array.from({ length: 7 }, (_, i) => ({
  asset: i % 2 ? 'rocks-a' as const : 'rocks-b' as const, x: side * (46 + i * 4), y: -.15,
  z: -23.5 + Math.sin(i * 2) * 1.2, scale: 1.1 + (i % 3) * .3, rotation: i * .73 })));
export const HARBOR_CHESTS = [-1, 1].map(side => ({ x: side * 14, z: 20, scale: 1.15, rotation: side * .22 }));
export const HARBOR_DOCKS = [-15, -8, 7, 15].map(x => ({ x, y: -1.1, z: -30.1, width: 3.6, height: 1.3, depth: 4.2 }));
export const PROP_CLUSTERS = [
  [-7.8, 8, -1], [7.8, 8, 1], [-8, -21, -1], [8, -21, 1],
  [-15, 24, -1], [15, 29, 1], [-7.8, -25.6, -1], [8.3, -25.5, 1],
  [-37, 19, -1], [38, 20, 1], [-40, -22, -1], [43, -22, 1],
] as const;
function rotatedHalfExtents(width: number, depth: number, rotation: number): [number, number] {
  const c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation));
  return [(width * c + depth * s) / 2, (width * s + depth * c) / 2];
}
function rotated(x: number, z: number, rotation: number): [number, number] {
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return [x * c + z * s, -x * s + z * c];
}
interface Body { x: readonly [number, number]; z: readonly [number, number] }
export const BUILDING_BODIES: Record<BuildingAsset, Body> = {
  'building-grand': { x: [-10.49, 10.72], z: [-5.29, 5.30] },
  'building-shop': { x: [-5.51, 5.51], z: [-2.07, 1.99] },
  'building-courtyard': { x: [-5.68, 5.47], z: [-4.43, 3.85] },
  dojo: { x: [-13.21, 12.32], z: [-17.54, 17.54] },
  pagoda: { x: [-4.10, 4.10], z: [-3.95, 4.31] },
  'wall-tall': { x: [-2, 2], z: [-1.70, 1.70] },
};
export const ROCK_BODIES: Record<'rocks-a' | 'rocks-b', Body & { height: number }> = {
  'rocks-a': { x: [-2.30, 2.21], z: [-1.56, 1.91], height: 2.9 },
  'rocks-b': { x: [-1.62, 1.88], z: [-1.66, 2.08], height: 3.65 },
};
const TREE_TRUNK = { x: -.93, z: -2.6, radius: .3 } as const;
function bodyCollider(body: Body, x: number, y: number, z: number, height: number, scale: number, rotation: number, fit = 1): EnvironmentCollider {
  const [ox, oz] = rotated((body.x[0] + body.x[1]) / 2 * scale, (body.z[0] + body.z[1]) / 2 * scale, rotation);
  const [halfX, halfZ] = rotatedHalfExtents((body.x[1] - body.x[0]) * scale * fit, (body.z[1] - body.z[0]) * scale * fit, rotation);
  return { x: x + ox, y: y + height * scale / 2, z: z + oz, halfX, halfY: height * scale / 2, halfZ };
}
function trunkCollider(x: number, y: number, z: number, scale: number, rotation: number): EnvironmentCollider {
  const [ox, oz] = rotated(TREE_TRUNK.x * scale, TREE_TRUNK.z * scale, rotation);
  return { x: x + ox, y: y + 2 * scale, z: z + oz, halfX: TREE_TRUNK.radius * scale, halfY: 2 * scale, halfZ: TREE_TRUNK.radius * scale };
}
const RAIL_HEADROOM = 2.3;
const bridgeRailColliders: EnvironmentCollider[] = HARBOR_BRIDGES.flatMap(bridge => {
  const count = 48, span = 25.3233 * bridge.scale, length = span / count;
  return Array.from({ length: count }, (_, i) => {
    const distance = -span / 2 + (i + .5) * length;
    const height = Math.max(.03, bridgeDeckHeight(distance, bridge.scale));
    const top = height + 1.3, bottom = height < RAIL_HEADROOM ? 0 : height;
    return [-1, 1].map(side => ({ x: bridge.x + side * 2.2 * bridge.scale, y: (top + bottom) / 2,
      z: bridge.z + distance, halfX: .13, halfY: (top - bottom) / 2, halfZ: length / 2 + .003 }));
  }).flat();
});
export const ENVIRONMENT_COLLIDERS: readonly EnvironmentCollider[] = Object.freeze([
  ...AUTHORED_BUILDINGS.filter(b => !b.backdrop).map(({ asset, x, y, z, scale, rotation }) =>
    bodyCollider(BUILDING_BODIES[asset], x, y, z, BUILDING_DIMENSIONS[asset][1], scale, rotation)),
  ...CITY_TERRACES.filter(t => !t.backdrop).map(({ x, z, width, depth, height, baseY }) => ({ x, z, y: baseY + height / 2, halfX: width / 2, halfY: height / 2, halfZ: depth / 2 })),
  ...bridgeRailColliders,
  ...[-2.7, -1.48, 1.48, 2.7].map(dx => ({ x: TORII.x + dx * TORII.scale, y: TORII.y + 2.8, z: TORII.z, halfX: .2 * TORII.scale, halfY: 2.8, halfZ: .2 * TORII.scale })),
  ...SAKURA_TREES.map(({ x, z, scale, rotation }) => trunkCollider(x, 0, z, scale, rotation)),
  ...GARDEN_TREES.filter(t => !t.backdrop).map(({ x, y, z, scale, rotation }) => trunkCollider(x, y, z, scale, rotation)),
  ...PROP_CLUSTERS.map(([x, z, side]) => ({ x: x + side * 1.3, y: .9, z: z + .2, halfX: 2, halfY: .9, halfZ: 1.45 })),
  ...QUAY_FLANKS.map(({ x, z, length, height, depth }) => ({ x, y: height / 2, z, halfX: depth * 2.4 / 2.8 / 2, halfY: height / 2, halfZ: length / 2 })),
  ...QUAY_ROCKS.map(({ asset, x, y, z, scale, rotation }) => bodyCollider(ROCK_BODIES[asset], x, y, z, ROCK_BODIES[asset].height, scale, rotation, .85)),
  ...HARBOR_CHESTS.map(({ x, z, scale, rotation }) => bodyCollider({ x: [-.64, .64], z: [-.64, .64] }, x, 0, z, 1.15, scale, rotation)),
  ...HARBOR_DOCKS.map(({ x, y, z, width, height, depth }) => ({ x, y: y + height / 2, z, halfX: width / 2, halfY: height / 2, halfZ: depth / 2 })),
  ...[-1, 1].map(side => ({ x: side * 16, y: .55, z: -12.75, halfX: .12, halfY: .55, halfZ: 7.5 })),
  ...[-56, 0, 56].flatMap((x, i) => [-28, -42].map(z => {
    const halfY = z === -28 && i === 1 ? .18 : .6;
    return { x, y: halfY, z, halfX: i === 1 ? 22 : 24, halfY, halfZ: .7 };
  })),
  ...[-27, 27].flatMap(x => [-5, 5].map(dx => ({ x: x + dx, y: .62, z: -35, halfX: .35, halfY: .62, halfZ: 7 }))),
]);

function riftLandmarks(stage: StageId): EnvironmentCollider[] {
  return riftLayout(stage).props.filter(p => p.solid).map(propBox);
}

export const STAGE_LANDMARKS: Record<StageId, readonly EnvironmentCollider[]> = {
  'rift-war': RIFT_SOLIDS,
  'blood-citadel': [],
  'hidden-leaf': [
    {x:0,y:12.2,z:20,halfX:9.5,halfY:1,halfZ:1.7},
    {x:-8.7,y:6,z:20,halfX:.7,halfY:6,halfZ:1.5}, {x:8.7,y:6,z:20,halfX:.7,halfY:6,halfZ:1.5},
    {x:-24,y:4,z:20,halfX:16,halfY:4,halfZ:1}, {x:24,y:4,z:20,halfX:16,halfY:4,halfZ:1},
    {x:-11,y:3.75,z:33,halfX:6,halfY:3.75,halfZ:4},
    {x:-11,y:.6,z:27,halfX:2.5,halfY:.6,halfZ:.75},
  ],
  harbor: [],
  'enies-lobby': propColliders('enies-lobby'),
  'chunin-final': [
    { x: 33.9, y: 10, z: 32.3, halfX: 4.15, halfY: 10, halfZ: 4.0 },
    { x: -40.8, y: 10, z: -40.45, halfX: 3.65, halfY: 10, halfZ: 2.75 },
    { x: -40.7, y: 10, z: 31.8, halfX: 3.0, halfY: 10, halfZ: 4.5 },
    { x: 34.3, y: 10, z: -40.7, halfX: 4.25, halfY: 10, halfZ: 3.25 },
    ...propColliders('chunin-final'),
  ],
  'martial-arts-tournament': [],
  'galactic-arena': [],
  'kami-lookout': [
    { x: 0, y: 10.5, z: -23.5, halfX: 17.5, halfY: 10.5, halfZ: 4.5 },
    { x: 0, y: 7, z: -29.5, halfX: 5.5, halfY: 7, halfZ: 1.5 },
    { x: 0, y: 5, z: -17.5, halfX: 5, halfY: 5, halfZ: 1.5 },
    { x: 0, y: 3.4, z: -10.75, halfX: 2.75, halfY: 3.4, halfZ: 5.25 },
    { x: -12.9, y: 7.5, z: -36, halfX: 6.1, halfY: 7.5, halfZ: 3 },
    { x: 12.75, y: 7.5, z: -36, halfX: 6.25, halfY: 7.5, halfZ: 3 },
    ...[-22, 22].flatMap(x => [-28.75, -19.25].flatMap(z => [
      { x, y: .8, z, halfX: 1.6, halfY: .8, halfZ: 1.6 },
      { x, y: 8, z, halfX: .45, halfY: 8, halfZ: .45 },
    ])),
    { x: -10.75, y: 2.85, z: -15.5, halfX: 5.75, halfY: 2.85, halfZ: 1 },
    { x: 10.5, y: 2.85, z: -15.5, halfX: 6, halfY: 2.85, halfZ: 1 },
    { x: -37.75, y: 3.6, z: 36.5, halfX: 1.75, halfY: 3.6, halfZ: 1.5 },
    { x: 37.75, y: 3.6, z: 36.5, halfX: 1.75, halfY: 3.6, halfZ: 1.5 },
    { x: 38, y: 3.6, z: -37, halfX: 1.5, halfY: 3.6, halfZ: 1.5 },
    { x: -38.25, y: 3.6, z: -36.5, halfX: 1.75, halfY: 3.6, halfZ: 1.5 },
    { x: -10.25, y: 5.75, z: 34.75, halfX: .6, halfY: 5.75, halfZ: .6 },
    { x: 10.25, y: 5.75, z: 34.75, halfX: .6, halfY: 5.75, halfZ: .6 },
    ...propColliders('kami-lookout'),
  ],
  'valley-of-the-end': [
    { x: -6, y: 1.45, z: -21.75, halfX: 2.1, halfY: 1.45, halfZ: 1.9 },
    { x: 6.9, y: 1.2, z: -9, halfX: 1.7, halfY: 1.2, halfZ: 1.7 },
    { x: -8, y: 1.45, z: 8, halfX: 2.2, halfY: 1.45, halfZ: 2.6 },
    { x: 6.1, y: 1.25, z: 22.1, halfX: 2.1, halfY: 1.25, halfZ: 2 },
    { x: 13.5, y: 1, z: 37, halfX: 1.6, halfY: 1, halfZ: 1.5 },
    { x: -13.6, y: 1.1, z: -36.9, halfX: 1.6, halfY: 1.1, halfZ: 1.6 },
    { x: 12.5, y: .9, z: -31, halfX: 1.3, halfY: .9, halfZ: 1.3 },
    { x: -12.5, y: .95, z: 30, halfX: 1.5, halfY: .95, halfZ: 1.5 },
    ...propColliders('valley-of-the-end'),
  ],
  'malevolent-shrine': [
    { x: 7, y: 11, z: -34, halfX: 6.5, halfY: 11, halfZ: 3 },
    { x: -7.25, y: 11, z: -32.5, halfX: 5.25, halfY: 11, halfZ: 3 },
    { x: 3.25, y: 1.9, z: -29.5, halfX: 4.75, halfY: 1.9, halfZ: 1.5 },
    { x: -5.25, y: 1.3, z: -28.5, halfX: 1.75, halfY: 1.3, halfZ: 1 },
    { x: -14.5, y: 4.1, z: -34.75, halfX: 1.5, halfY: 4.1, halfZ: 1.25 },
    { x: 13.25, y: 8.4, z: -39.5, halfX: 2.75, halfY: 8.4, halfZ: 1.5 },
    { x: -13.25, y: 2.9, z: -40.75, halfX: .75, halfY: 2.9, halfZ: .75 },
    { x: 10.75, y: 2.2, z: -11.5, halfX: 7.75, halfY: 2.2, halfZ: 1.5 },
    { x: 12.25, y: 2.2, z: -8.5, halfX: 7.75, halfY: 2.2, halfZ: 1.5 },
    { x: 12.75, y: 2.1, z: -5.5, halfX: 6.75, halfY: 2.1, halfZ: 1.5 },
    { x: 14, y: 1.2, z: -3.25, halfX: 5, halfY: 1.2, halfZ: .75 },
    { x: -13.25, y: 2.1, z: 2.5, halfX: 6.75, halfY: 2.1, halfZ: 1.5 },
    { x: -11.75, y: 2.2, z: 5.5, halfX: 8.25, halfY: 2.2, halfZ: 1.5 },
    { x: -11.25, y: 2.2, z: 8.5, halfX: 8.75, halfY: 2.2, halfZ: 1.5 },
    { x: 30.75, y: 1.85, z: 16, halfX: 3.75, halfY: 1.85, halfZ: 1.5 },
    { x: 31.25, y: 1.9, z: 19, halfX: 4.25, halfY: 1.9, halfZ: 1.5 },
    { x: 31.25, y: 2.1, z: 22, halfX: 3.25, halfY: 2.1, halfZ: 1.5 },
    { x: 30.5, y: 2.1, z: 25, halfX: 3.5, halfY: 2.1, halfZ: 1.5 },
    { x: 29.5, y: 2.1, z: 28, halfX: 4.5, halfY: 2.1, halfZ: 1.5 },
    { x: -28.75, y: 2.05, z: 16.5, halfX: 2.25, halfY: 2.05, halfZ: 1.5 },
    { x: -30.75, y: 2.05, z: 19.5, halfX: 4.25, halfY: 2.05, halfZ: 1.5 },
    { x: -31.75, y: 2.1, z: 22.5, halfX: 2.75, halfY: 2.1, halfZ: 1.5 },
    { x: -31.25, y: 1.8, z: 25.5, halfX: 3.25, halfY: 1.8, halfZ: 1.5 },
    { x: -30.5, y: 1.8, z: 28.5, halfX: 4, halfY: 1.8, halfZ: 1.5 },
    { x: -30.75, y: 1.1, z: 30.75, halfX: 2.75, halfY: 1.1, halfZ: .75 },
    ...propColliders('malevolent-shrine'),
  ],
  shiganshina: [
    { x: 15.25, y: 1, z: -9.1, halfX: 1.75, halfY: 1, halfZ: .4 },
    ...propColliders('shiganshina'),
  ],
  'hueco-mundo': [],
  onigashima: [],
  'null-realm': [],
  'chunin-exam-room': [],
  'rift-village': riftLandmarks('rift-village'),
  'rift-swords': riftLandmarks('rift-swords'),
  'rift-fortress': riftLandmarks('rift-fortress'),
  'rift-eclipse': riftLandmarks('rift-eclipse'),
  'rift-frost': riftLandmarks('rift-frost'),
  'rift-grove': riftLandmarks('rift-grove'),
  'rift-wastes': riftLandmarks('rift-wastes'),
  'rift-harbor': riftLandmarks('rift-harbor'),
  marineford: [
    { x: -27, y: .6, z: -32.6, halfX: 5, halfY: .6, halfZ: 5 },
    { x: -27, y: 1.8, z: -32.6, halfX: 4.2, halfY: .6, halfZ: 4.2 },
    { x: -27, y: 11.4, z: -32.6, halfX: 3.5, halfY: 9, halfZ: 3.5 },
    { x: -27, y: 20.9, z: -32.6, halfX: 5.2, halfY: .6, halfZ: 5.2 },
    ...([[-36.5, -27.5, -8.47], [-20, -11.5, -13.31], [11.5, 20, -13.31], [27.5, 36.5, -8.47]] as const).map(([x0, x1, z]) =>
      ({ x: (x0 + x1) / 2, y: .65, z, halfX: (x1 - x0) / 2, halfY: .65, halfZ: .78 })),
    ...([[-14.74, 8.33, 2.2, 1.87, 2.09], [15.81, 6.95, 1.9, 1.88, 1.95], [-4.57, 18.87, 1.36, 1.65, 1.85], [20.79, 23.93, 2.18, 1.59, 2.05],
      [-24.36, 26.75, 1.72, 1.93, 2.06], [6.3, 33.01, 1.9, 1.38, 1.86], [-34.19, 4.54, 1.23, 1.58, 1.89], [32.78, 12.82, 1.23, 1.81, 1.95]] as const)
      .map(([x, z, halfX, halfZ, top]) => ({ x, y: top / 2, z, halfX, halfY: top / 2, halfZ })),
    ...propColliders('marineford'),
  ],
  shibuya: [
    { x: -37.25, y: 19, z: -36.5, halfX: .75, halfY: 19, halfZ: 1.5 },
    { x: -35.75, y: 19, z: -37.25, halfX: .75, halfY: 19, halfZ: .75 },
    { x: 34, y: 23, z: -36.5, halfX: 4, halfY: 23, halfZ: 1.5 },
    { x: 36.5, y: 23, z: -32.5, halfX: 1.5, halfY: 23, halfZ: 2.5 },
    { x: 33.75, y: 23, z: -33.75, halfX: 1.25, halfY: 23, halfZ: 1.25 },
    { x: -37, y: 15, z: 34, halfX: 1, halfY: 15, halfZ: 4 },
    { x: -33, y: 15, z: 37, halfX: 3, halfY: 15, halfZ: 1 },
    { x: -34.5, y: 15, z: 34.5, halfX: 1.5, halfY: 15, halfZ: 1.5 },
    { x: -18, y: 2.6, z: 33, halfX: 2.25, halfY: 2.6, halfZ: 1.75 },
    { x: -24.2, y: 1.3, z: 31.6, halfX: .22, halfY: 1.3, halfZ: .22 },
    { x: -22.4, y: .5, z: 30.2, halfX: 1, halfY: .5, halfZ: .15 },
    { x: -13.9, y: .5, z: 34.6, halfX: .3, halfY: .5, halfZ: 1 },
    { x: -20.6, y: .5, z: 36.6, halfX: 1, halfY: .5, halfZ: .2 },
    { x: 17, y: 1.6, z: -33, halfX: 1.5, halfY: 1.6, halfZ: 2.6 },
    ...[-25.2, 25.2].flatMap(x => [-25.2, 25.2].map(z => ({ x, y: 3.1, z, halfX: .25, halfY: 3.1, halfZ: .25 }))),
    ...[[-29.5, -14], [-29.5, 14], [29.5, -14], [29.5, 14], [-14, -29.5], [14, -29.5], [-14, 29.5]].map(([x, z]) => ({ x, y: 4.1, z, halfX: .2, halfY: 4.1, halfZ: .2 })),
    ...propColliders('shibuya'),
  ],
  'infinity-castle': propColliders('infinity-castle'),
  'pains-crater': [
    ...([[-12.47, -9.47, 1.83, 1.77, 1.52], [13.28, 10.66, 1.75, 1.71, 1.59], [4.61, -16.57, 1.99, 1.72, 1.47], [-15.54, 12.49, 1.95, 1.87, 1.36],
      [32.19, -15.19, 2.38, 2.11, 2.22], [-33.06, -16.96, 2.01, 2.15, 2.09], [19.94, 32.36, 1.5, 1.99, 2.06], [-22.66, 30.89, 2.15, 1.52, 2.18],
      [.87, 32.61, 2.95, 2.32, 2.09], [-35.85, 5.79, 1.71, 2.66, 2.01]] as const)
      .map(([x, z, halfX, halfZ, top]) => ({ x, y: top / 2, z, halfX, halfY: top / 2, halfZ })),
    ...propColliders('pains-crater'),
  ],
  'heavens-arena': [...propColliders('heavens-arena')],
};

export interface StageColliders {
  floor: readonly EnvironmentCollider[];
  walls: readonly EnvironmentCollider[];
  landmarks: readonly EnvironmentCollider[];
}

export function stageColliders(stage: StageId): StageColliders {
  const { halfX, halfZ } = STAGES[stage];
  if (stage === 'harbor') {
    return {
      floor: [
        { x: 0, y: -.5, z: 26, halfX, halfY: .5, halfZ: 54 },
        { x: 0, y: -.5, z: -61, halfX, halfY: .5, halfZ: 19 },
        ...HARBOR_BRIDGES.map(bridge => ({ x: bridge.x, y: -.5, z: bridge.z, halfX: 5, halfY: .5, halfZ: 7 })),
      ],
      walls: [
        { x: -halfX - 1, y: 5, z: 0, halfX: 1, halfY: 5, halfZ: halfX + 2 }, { x: halfX + 1, y: 5, z: 0, halfX: 1, halfY: 5, halfZ: halfX + 2 },
        { x: 0, y: 5, z: -halfZ - 1, halfX: halfZ + 2, halfY: 5, halfZ: 1 }, { x: 0, y: 5, z: halfZ + 1, halfX: halfZ + 2, halfY: 5, halfZ: 1 },
      ],
      landmarks: ENVIRONMENT_COLLIDERS,
    };
  }
  return {
    floor: [{ x: 0, y: -.5, z: 0, halfX: halfX + 6, halfY: .5, halfZ: halfZ + 6 }],
    walls: [
      { x: -halfX - 1, y: 6, z: 0, halfX: 1, halfY: 6, halfZ: halfZ + 2 }, { x: halfX + 1, y: 6, z: 0, halfX: 1, halfY: 6, halfZ: halfZ + 2 },
      { x: 0, y: 6, z: -halfZ - 1, halfX: halfX + 2, halfY: 6, halfZ: 1 }, { x: 0, y: 6, z: halfZ + 1, halfX: halfX + 2, halfY: 6, halfZ: 1 },
    ],
    landmarks: STAGE_LANDMARKS[stage],
  };
}
