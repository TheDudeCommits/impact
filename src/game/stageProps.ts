import type { StageId } from './stages';
import type { EnvironmentCollider } from './environmentLayout';

export const KIT_SIZE = {
  'br/house-a': [4.03, 12, 5.9], 'br/house-b': [12.19, 11, 5.34], 'br/house-c': [14.88, 13, 7.66],
  'br/rock-a': [4.8, 10.19, 4.64], 'br/rock-b': [5.03, 7.54, 3.98], 'br/rock-c': [3.92, 6.67, 4.61], 'br/rock-d': [1.55, 2.34, 1.73],
  'br/rock-formation-b': [8.17, 4.68, 4.88], 'br/stone-a': [1.38, .7, 1.52],
  'br/cart': [1.83, .97, 3.39], 'br/kenney-town-lantern': [.22, 1.56, .22], 'br/kenney-town-wall-broken': [.12, 1, 1],
  'br/kenney-town-cart-high': [.89, .86, 1.39],
  'br/meshy-stall': [3.34, 3.43, 3.26], 'br/meshy-well': [3.98, 4.33, 3.95], 'br/meshy-rubble': [6.39, 2.48, 6.43],
  'br/wall-column': [.9, 4.8, .95], 'br/podest': [7.32, .79, 5.11],
  'asian/torii': [6.6, 3.56, .68], 'br/stone-lamp': [.47, 1.04, .47], 'br/pot': [1.18, .87, 1.18],
  'br/kenney-pirate-cannon-mobile': [1.68, 1.38, 1.92], 'br/kenney-pirate-cannon': [1.4, 1.05, 1.92],
  'br/tree-place': [3.33, .42, 3.21],
  'harbor/crate': [1.08, .77, 1.31], 'harbor/barrel': [1.34, 1.23, 1.34], 'harbor/crate-bottles': [1.08, 1.06, 1.31],
  'shibuya/bus': [2.49, 2.84, 10.5], 'shibuya/taxi': [2.09, 1.68, 4.7], 'shibuya/police-car': [2.04, 1.77, 4.8],
  'shibuya/sedan': [2.04, 1.58, 4.8], 'shibuya/kei-truck': [1.73, 1.81, 3.4], 'shibuya/van': [1.77, 1.88, 4.7],
  'shibuya/vending': [1.1, 1.83, .37],
  'br/kenney-town-wall-wood-broken': [.12, 1, 1],
} as const satisfies Record<string, readonly [number, number, number]>;
export type KitPieceId = keyof typeof KIT_SIZE;

export interface StageProp {
  piece: KitPieceId | 'column' | 'stump' | 'block' | 'none';
  length?: number; radius?: number; size?: readonly [number, number, number];
  x: number; z: number; y?: number;
  rot?: number;
  scale?: number;
  tilt?: number; roll?: number;
  sy?: number;
  tint?: number;
  solid?: true | { halfX: number; halfY: number; halfZ: number; dx?: number; dz?: number; y?: number };
  fit?: number;
  height?: number;
  draw?: string;
}

const r = Math.PI / 180;
const WOOD = 0x9c8676;

const SHIGANSHINA_MASTS: readonly (readonly [number, number])[] = [[-18.6, -16.8], [25, -19], [15.6, 9.4], [-25.5, 5.5]];

const SHIGANSHINA: StageProp[] = [
  { piece: 'br/house-c', x: 10, z: -12, rot: 0, solid: { halfX: 7.25, halfY: 6.5, halfZ: 3, dx: .25, dz: -.5 } },
  { piece: 'br/house-b', x: -15, z: 8, rot: 90 * r, solid: { halfX: 2.5, halfY: 5.5, halfZ: 6 } },
  { piece: 'br/house-a', x: 16, z: 30, rot: 180 * r, solid: { halfX: 2, halfY: 6, halfZ: 2.5 } },
  { piece: 'br/rock-b', x: -6, z: -20, rot: 40 * r, scale: .55, tint: 0xb8ada0, solid: true, fit: .78 },
  { piece: 'br/rock-c', x: 30, z: -32, rot: 110 * r, scale: .5, tint: 0xb0a698, solid: true, fit: .78 },
  { piece: 'br/rock-d', x: -2.5, z: -24, rot: 10 * r, scale: .9, tint: 0xa89f92, solid: true, fit: .8 },
  { piece: 'br/rock-formation-b', x: -27, z: -23, rot: 200 * r, scale: .55, tint: 0xa8a090, solid: true, fit: .8 },
  { piece: 'br/meshy-stall', x: -32.4, z: 11, rot: 90 * r, solid: { halfX: 1.55, halfY: 1.1, halfZ: 1.6 } },
  { piece: 'br/meshy-stall', x: -32.4, z: 15.4, rot: 90 * r, solid: { halfX: 1.55, halfY: 1.1, halfZ: 1.6 } },
  { piece: 'br/meshy-stall', x: -26.5, z: 33.2, rot: 180 * r, solid: { halfX: 1.6, halfY: 1.1, halfZ: 1.55 } },
  { piece: 'br/meshy-stall', x: 30.4, z: 12, rot: -90 * r, solid: { halfX: 1.55, halfY: 1.1, halfZ: 1.6 } },
  { piece: 'br/meshy-rubble', x: 22, z: -25, rot: 30 * r, scale: .75, solid: { halfX: 1.5, halfY: .8, halfZ: 1.5 } },
  { piece: 'harbor/crate', tint: WOOD, x: -20, z: -4, rot: 12 * r, scale: 1.35, solid: true, fit: .95 },
  { piece: 'harbor/crate', tint: WOOD, x: -20.2, z: -2.2, rot: 40 * r, scale: 1.2, solid: true, fit: .95 },
  { piece: 'harbor/barrel', tint: WOOD, x: -21.6, z: -5.4, scale: .9, solid: true, fit: .75 },
  { piece: 'harbor/crate-bottles', tint: WOOD, x: 20, z: 4, rot: 20 * r, scale: 1.3, solid: true, fit: .95 },
  { piece: 'harbor/crate', tint: WOOD, x: 21.4, z: 5.8, rot: 5 * r, scale: 1.3, solid: true, fit: .95 },
  { piece: 'harbor/barrel', tint: WOOD, x: 18.6, z: 5.6, scale: .9, solid: true, fit: .75 },
  { piece: 'harbor/crate', tint: WOOD, x: 3, z: 19, rot: 15 * r, scale: 1.4, solid: true, fit: .95 },
  { piece: 'harbor/barrel', tint: WOOD, x: 4.6, z: 20.3, scale: .9, solid: true, fit: .75 },
  { piece: 'harbor/crate', tint: WOOD, x: -24, z: 29, rot: 35 * r, scale: 1.3, solid: true, fit: .95 },
  { piece: 'harbor/barrel', tint: WOOD, x: -22.4, z: 30, scale: .9, solid: true, fit: .75 },
  { piece: 'harbor/barrel', tint: WOOD, x: 31, z: -26, scale: .95, solid: true, fit: .75 },
  { piece: 'harbor/barrel', tint: WOOD, x: -33, z: 23, scale: .95, solid: true, fit: .75 },
  { piece: 'br/cart', x: 10, z: 17, rot: 35 * r, scale: 1.15, solid: true, fit: .8 },
  { piece: 'br/kenney-town-cart-high', x: -10, z: 31, rot: -70 * r, scale: 2.1, solid: true, fit: .85 },
  { piece: 'br/meshy-well', x: -12, z: -33, rot: 20 * r, solid: { halfX: 1.75, halfY: 2.15, halfZ: 1.75 } },
  { piece: 'br/kenney-town-wall-broken', x: 29, z: -16, rot: 15 * r, scale: 3, tint: 0xcfc6b6, solid: true, fit: 1 },
  { piece: 'br/kenney-town-wall-broken', x: -33.5, z: -6, rot: 92 * r, scale: 3, tint: 0xcfc6b6, solid: true, fit: 1 },
  ...[[-35, -35], [35, -35], [-35, 35], [35, 35]].map(([x, z]) => ({ piece: 'br/kenney-town-lantern' as const, x, z, scale: 2.7, solid: { halfX: .25, halfY: 2.1, halfZ: .25 } })),
  { piece: 'none', draw: 'barricade', x: -9.5, z: -15.5, rot: 0, length: 5.2, solid: { halfX: 2.7, halfY: .8, halfZ: .65 } },
  { piece: 'harbor/crate', tint: WOOD, x: -7.4, z: -13, rot: 10 * r, scale: 1.3, solid: true, fit: .95 },
  { piece: 'harbor/crate', tint: WOOD, x: -9.1, z: -12.7, rot: 40 * r, scale: 1.2, solid: true, fit: .95 },
  { piece: 'harbor/barrel', tint: WOOD, x: -11, z: -13.2, scale: .9, solid: true, fit: .75 },
  { piece: 'br/meshy-stall', x: -11.5, z: -9, rot: 90 * r, tint: 0x8aa6dc, solid: { halfX: 1.55, halfY: 1.1, halfZ: 1.6 } },
  { piece: 'none', draw: 'tower', x: -9, z: -26.5, solid: { halfX: 1.55, halfY: 4.2, halfZ: 1.55 } },
  { piece: 'br/meshy-rubble', x: 6.5, z: -21, rot: 75 * r, scale: .55, solid: { halfX: 1.2, halfY: .7, halfZ: 1.2 } },
  { piece: 'br/kenney-town-lantern', x: 9.5, z: -19.5, scale: 2.7, solid: { halfX: .25, halfY: 2.1, halfZ: .25 } },
  { piece: 'br/meshy-stall', x: 22.6, z: -8, rot: -90 * r, solid: { halfX: 1.55, halfY: 1.1, halfZ: 1.6 } },
  { piece: 'br/meshy-stall', x: 22.6, z: -4.3, rot: -90 * r, solid: { halfX: 1.55, halfY: 1.1, halfZ: 1.6 } },
  ...SHIGANSHINA_MASTS.map(([x, z]) => ({ piece: 'none' as const, draw: 'mast', x, z, solid: { halfX: .3, halfY: 5.5, halfZ: .3 } })),
];

const VALLEY: StageProp[] = [
  { piece: 'column', x: .2, z: -27, rot: 90 * r, length: 8, radius: .85, solid: { halfX: 4, halfY: .8, halfZ: .85 } },
  { piece: 'column', x: -4, z: 15.8, rot: 0, length: 7.6, radius: .85, solid: { halfX: .85, halfY: .8, halfZ: 3.8 } },
  { piece: 'stump', x: -9, z: -2, rot: 20 * r, length: 2.6, radius: .9, solid: { halfX: .85, halfY: 1.3, halfZ: .85 } },
  { piece: 'br/rock-c', x: 11, z: 3, rot: 70 * r, scale: .45, tint: 0xa88a72, solid: true, fit: .78 },
  { piece: 'br/rock-b', x: -2, z: -40, rot: 150 * r, scale: .5, tint: 0xa88a72, solid: true, fit: .78 },
  { piece: 'br/podest', x: 9, y: -.15, z: 31, rot: 25 * r, tilt: 10 * r, scale: .62, tint: 0xc8b8a4, solid: true, fit: .9, height: .85 },
];

const TORII_POSTS = [-2.7, -1.48, 1.48, 2.7];
export const SHRINE_RIBS: readonly (readonly [number, number])[] = [[19.5, -20.5], [25, -6], [24.5, 7], [-19.5, -20], [-25, -5], [-24, 8]];
export const SHRINE_TABLETS: readonly (readonly [number, number])[] = [[12.5, -26.5], [-12.5, -26.5]];
const SHRINE: StageProp[] = [
  { piece: 'asian/torii', x: 0, z: 33, scale: 2.4, tint: 0x8a2a24, solid: { halfX: .48, halfY: 3.36, halfZ: .48, dx: TORII_POSTS[0] * 2.4 } },
  ...TORII_POSTS.slice(1).map(dx => ({ piece: 'none' as const, x: 0, z: 33, solid: { halfX: .48, halfY: 3.36, halfZ: .48, dx: dx * 2.4 } })),
  ...[[-10, -18], [10, -18], [-10, 0], [10, 0], [-10, 18], [10, 18]].map(([x, z]) => ({ piece: 'br/stone-lamp' as const, x, z, scale: 2.4, tint: 0x9a8a84, solid: { halfX: .55, halfY: 1.25, halfZ: .55 } })),
  { piece: 'br/pot', x: -18, z: -26, scale: 1.9, tint: 0x6a5a58, solid: { halfX: 1.1, halfY: .85, halfZ: 1.1 } },
  { piece: 'br/pot', x: 18, z: -26, scale: 1.9, tint: 0x6a5a58, solid: { halfX: 1.1, halfY: .85, halfZ: 1.1 } },
  { piece: 'asian/torii', x: 0, z: -20, y: -.3, scale: 1.25, tint: 0x7a2420, solid: { halfX: .3, halfY: 1.8, halfZ: .3, dx: TORII_POSTS[0] * 1.25 } },
  ...TORII_POSTS.slice(1).map(dx => ({ piece: 'none' as const, x: 0, z: -20, solid: { halfX: .3, halfY: 1.8, halfZ: .3, dx: dx * 1.25 } })),
  ...SHRINE_RIBS.map(([x, z]) => ({ piece: 'none' as const, draw: 'rib', x, z, solid: { halfX: .6, halfY: 2.5, halfZ: .95 } })),
  ...SHRINE_TABLETS.map(([x, z]) => ({ piece: 'none' as const, draw: 'tablets', x, z, solid: { halfX: 1, halfY: 1.2, halfZ: .85 } })),
];

const KAMI: StageProp[] = [
  ...[[-28, 22], [28, 22], [-22, 34], [22, 34]].flatMap(([x, z], i) => [
    { piece: 'br/tree-place' as const, x, z, rot: i * .7, scale: 2.2, solid: { halfX: 3.3, halfY: .46, halfZ: 3.2 } },
    { piece: 'none' as const, x, z, rot: i * 1.9 + .4, solid: { halfX: .5, halfY: 1.6, halfZ: .5 } },
  ]),
  { piece: 'br/pot', x: 0, z: 36, scale: 2.1, tint: 0xf0e8dc, solid: { halfX: 1.2, halfY: .9, halfZ: 1.2 } },
  ...[[-30, 4], [30, 4], [-16, 29], [16, 29]].flatMap(([x, z]) => [
    { piece: 'none' as const, x, z, solid: { halfX: 1.6, halfY: .8, halfZ: 1.6 } },
    { piece: 'none' as const, x, z, solid: { halfX: .45, halfY: 8, halfZ: .45 } },
  ]),
  { piece: 'none', x: 0, z: 36, rot: 2.2, solid: { halfX: .4, halfY: 2, halfZ: .4 } },
];

const CHUNIN: StageProp[] = [
  ...[[-3.5, -33], [0, -34.5], [3.5, -33]].map(([x, z]) => ({ piece: 'br/wall-column' as const, x, z, scale: 1.25, sy: .42, tint: 0xa47a58, solid: { halfX: .6, halfY: 1.26, halfZ: .6 } })),
  { piece: 'br/rock-b', x: 31, z: 12, rot: .6, scale: .52, tint: 0xc0a080, solid: true, fit: .78 },
  { piece: 'br/rock-c', x: -32, z: -14, rot: 2.1, scale: .55, tint: 0xc0a080, solid: true, fit: .78 },
  { piece: 'br/rock-d', x: -18, z: 30, rot: 1.2, scale: 1.3, tint: 0xc0a080, solid: true, fit: .8 },
  { piece: 'br/rock-formation-b', x: 24, z: -30, rot: 4.1, scale: .5, tint: 0xc0a080, solid: true, fit: .8 },
  { piece: 'column', x: 34, z: 26, rot: 30 * r, length: 5.5, radius: .55, solid: { halfX: 2.6, halfY: .55, halfZ: 1.8 } },
];

const ENIES: StageProp[] = [
  { piece: 'harbor/crate', tint: WOOD, x: -.8, z: -18, rot: .2, scale: 1.4, solid: true, fit: .95 },
  { piece: 'harbor/crate', tint: WOOD, x: .9, z: -17.3, rot: -.3, scale: 1.3, solid: true, fit: .95 },
  { piece: 'harbor/barrel', tint: WOOD, x: .2, z: -19.9, scale: .95, solid: true, fit: .75 },
  { piece: 'harbor/crate-bottles', tint: WOOD, x: .5, z: 20, rot: .5, scale: 1.4, solid: true, fit: .95 },
  { piece: 'harbor/crate', tint: WOOD, x: -1.3, z: 21.2, rot: .1, scale: 1.3, solid: true, fit: .95 },
  { piece: 'br/kenney-pirate-cannon-mobile', x: -3.5, z: -34, rot: Math.PI, scale: 1.9, tint: 0xc8ccd8, solid: true, fit: .85 },
  { piece: 'br/kenney-pirate-cannon-mobile', x: 3.5, z: 34, rot: 0, scale: 1.9, tint: 0xc8ccd8, solid: true, fit: .85 },
  { piece: 'harbor/barrel', tint: WOOD, x: -5.6, z: -33, scale: .9, solid: true, fit: .75 },
  { piece: 'harbor/barrel', tint: WOOD, x: 5.6, z: 33, scale: .9, solid: true, fit: .75 },
];

const MARINEFORD: StageProp[] = [
  { piece: 'br/kenney-pirate-cannon-mobile', x: -8, z: -16.5, rot: 0, scale: 1.7, tint: 0xb0a084, solid: true, fit: .85 },
  { piece: 'br/kenney-pirate-cannon-mobile', x: 8, z: -16.5, rot: 0, scale: 1.7, tint: 0xb0a084, solid: true, fit: .85 },
  { piece: 'harbor/crate', tint: WOOD, x: -29, z: -24.5, rot: .3, scale: 1.4, solid: true, fit: .95 },
  { piece: 'harbor/crate', tint: WOOD, x: -27.4, z: -23.4, rot: -.2, scale: 1.25, solid: true, fit: .95 },
  { piece: 'harbor/barrel', tint: WOOD, x: -30.2, z: -22.6, scale: .95, solid: true, fit: .75 },
  { piece: 'harbor/crate-bottles', tint: WOOD, x: 29.5, z: -26, rot: .5, scale: 1.35, solid: true, fit: .95 },
  { piece: 'harbor/barrel', tint: WOOD, x: 27.8, z: -24.6, scale: .95, solid: true, fit: .75 },
  { piece: 'harbor/crate', tint: WOOD, x: 31, z: -24.2, rot: .1, scale: 1.3, solid: true, fit: .95 },
  { piece: 'br/meshy-rubble', x: -7.5, z: -31.5, rot: 40 * r, scale: .62, tint: 0xd8dce4, solid: { halfX: 1.25, halfY: .7, halfZ: 1.25 } },
  { piece: 'br/meshy-rubble', x: 16, z: -32.5, rot: 110 * r, scale: .55, tint: 0xd8dce4, solid: { halfX: 1.1, halfY: .65, halfZ: 1.1 } },
  { piece: 'none', draw: 'mast', x: -10, z: 31, rot: 0, length: 8.4, solid: { halfX: 4.2, halfY: .45, halfZ: .5 } },
  { piece: 'harbor/barrel', tint: 0x8fa0b4, x: 28.5, z: 30.5, y: -.25, tilt: .5, scale: 1, solid: true, fit: .75, height: .9 },
  { piece: 'harbor/barrel', tint: 0x8fa0b4, x: -29.5, z: 17.5, y: -.3, roll: .7, scale: 1, solid: true, fit: .75, height: .85 },
];
function run(x: number, z: number, yaw: number, length: number, width: number, height: number, n: number): StageProp[] {
  const ax = Math.sin(yaw), az = Math.cos(yaw), seg = length / n;
  const halfX = (width * Math.abs(az) + seg * Math.abs(ax)) / 2, halfZ = (width * Math.abs(ax) + seg * Math.abs(az)) / 2;
  return Array.from({ length: n }, (_, k) => {
    const s = -length / 2 + (k + .5) * seg;
    return { piece: 'none' as const, x: +(x + ax * s).toFixed(2), z: +(z + az * s).toFixed(2), solid: { halfX: +halfX.toFixed(2), halfY: height / 2, halfZ: +halfZ.toFixed(2) } };
  });
}
export const SHIBUYA_TREES: readonly (readonly [number, number])[] = [[36.5, 26], [23.5, 30], [37, 33], [15.5, 33.5]];
const SHIBUYA: StageProp[] = [
  { piece: 'shibuya/bus', x: -29.2, z: 29.2, rot: -45 * r, tint: 0xa8b4a0 }, ...run(-29.2, 29.2, -45 * r, 10.5, 2.49, 2.84, 3),
  { piece: 'shibuya/taxi', x: -13, z: 13.5, rot: 100 * r }, { piece: 'shibuya/sedan', x: -13.3, z: 13.2, y: 1.12, rot: 128 * r, tilt: -11 * r, roll: 13 * r },
  ...run(-13, 13.5, 114 * r, 4.8, 2.3, 3.2, 2),
  { piece: 'shibuya/sedan', x: -17.5, z: -11.5, y: 1.58, rot: 166 * r, roll: Math.PI, tint: 0xb0b0b8 }, ...run(-17.5, -11.5, 166 * r, 4.8, 2.04, 1.58, 2),
  { piece: 'shibuya/sedan', x: -24.5, z: -5.5, rot: 22 * r, tint: 0xc8c8d0 }, ...run(-24.5, -5.5, 22 * r, 4.8, 2.04, 1.58, 2),
  { piece: 'shibuya/taxi', x: -19.5, z: -17.8, rot: 300 * r }, ...run(-19.5, -17.8, 300 * r, 4.7, 2.09, 1.68, 2),
  { piece: 'shibuya/kei-truck', x: -27.6, z: -20.5, rot: 4 * r, solid: { halfX: 1, halfY: .9, halfZ: 1.75 } },
  { piece: 'shibuya/police-car', x: 15, z: -15.5, rot: 62 * r }, ...run(15, -15.5, 62 * r, 4.8, 2.04, 1.77, 2),
  { piece: 'shibuya/sedan', x: 18.5, z: -9, rot: 205 * r, tint: 0xd8d8e0 }, ...run(18.5, -9, 205 * r, 4.8, 2.04, 1.58, 2),
  { piece: 'shibuya/taxi', x: 21.9, z: 21.9, rot: 225 * r, tilt: -3 * r }, ...run(21.9, 21.9, 225 * r, 4.7, 2.09, 1.68, 2),
  { piece: 'shibuya/van', x: 8.5, z: 30.5, rot: 140 * r }, ...run(8.5, 30.5, 140 * r, 4.7, 1.77, 1.88, 2),
  { piece: 'shibuya/taxi', x: 30.5, z: 4.5, rot: 97 * r }, ...run(30.5, 4.5, 97 * r, 4.7, 2.09, 1.68, 2),
  { piece: 'shibuya/police-car', x: -9.5, z: 30.5, rot: 15 * r }, ...run(-9.5, 30.5, 15 * r, 4.8, 2.04, 1.77, 2),
  ...run(11, 9, 120 * r, 7, 3.2, 1.55, 3),
  { piece: 'br/meshy-rubble', x: -3.5, z: -29.5, rot: 40 * r, scale: .46, tint: 0x8a8c92, solid: { halfX: 1.25, halfY: .6, halfZ: 1.25 } },
  { piece: 'br/meshy-rubble', x: 31, z: -21.5, rot: 200 * r, scale: .42, tint: 0x8a8c92, solid: { halfX: 1.15, halfY: .55, halfZ: 1.15 } },
  { piece: 'shibuya/vending', x: 36.1, z: -29.6, rot: 0, solid: { halfX: .6, halfY: .92, halfZ: .3 } },
  { piece: 'shibuya/vending', x: 37.3, z: -29.6, rot: 0, solid: { halfX: .6, halfY: .92, halfZ: .3 } },
  { piece: 'shibuya/vending', x: -15.45, z: 32.4, rot: 90 * r, solid: { halfX: .3, halfY: .92, halfZ: .6 } },
  { piece: 'none', draw: 'train-car', x: 26.5, z: 36, solid: { halfX: 6.1, halfY: 2.05, halfZ: 1.45 } },
  { piece: 'none', draw: 'hachiko', x: 31.5, z: 28.5, solid: { halfX: .95, halfY: 1.15, halfZ: .95 } },
  ...SHIBUYA_TREES.map(([x, z]) => ({ piece: 'none' as const, draw: 'tree', x, z, solid: { halfX: .35, halfY: 3, halfZ: .35 } })),
];

export const CASTLE_PILLARS: readonly (readonly [number, number])[] = [[12, 12], [-12, 12], [12, -12], [-12, -12], [17, 0], [-17, 0], [0, 17], [0, -17]];
const CASTLE: StageProp[] = [
  ...CASTLE_PILLARS.map(([x, z]) => ({ piece: 'none' as const, draw: 'pillar', x, z, solid: { halfX: .65, halfY: 8, halfZ: .65 } })),
  ...CASTLE_PILLARS.map(([x, z]) => { const d = Math.hypot(x, z); return { piece: 'none' as const, draw: 'andon', x: +(x - x / d * 1.4).toFixed(2), z: +(z - z / d * 1.4).toFixed(2), solid: { halfX: .27, halfY: .55, halfZ: .27 } }; }),
  { piece: 'none', draw: 'fusuma', x: 0, z: 31, solid: { halfX: 3.95, halfY: 1.55, halfZ: .3 } },
  { piece: 'none', draw: 'fusuma', x: 0, z: -31, solid: { halfX: 3.95, halfY: 1.55, halfZ: .3 } },
  { piece: 'none', draw: 'fusuma', x: 31, z: 0, solid: { halfX: .3, halfY: 1.55, halfZ: 3.95 } },
  { piece: 'none', draw: 'fusuma', x: -31, z: 0, solid: { halfX: .3, halfY: 1.55, halfZ: 3.95 } },
  ...[-24, 24].flatMap(x => [
    { piece: 'none' as const, draw: 'dais', x, z: -26, solid: { halfX: 3.1, halfY: .3, halfZ: 2.6 } },
    { piece: 'none' as const, draw: 'byobu', x, z: -28.2, solid: { halfX: 3, halfY: 1.1, halfZ: .2, y: 1.7 } },
    ...[-2.4, 2.4].map(dx => ({ piece: 'none' as const, draw: 'andon', x: x + dx, z: -24.4, solid: { halfX: .27, halfY: .55, halfZ: .27, y: 1.15 } })),
  ]),
  ...[-1, 1].flatMap(side => [
    { piece: 'none' as const, draw: 'room', x: side * 31.7, z: 28.5, solid: { halfX: .22, halfY: 1.4, halfZ: 3.25 } },
    { piece: 'none' as const, draw: 'room', x: side * 28.5, z: 31.7, solid: { halfX: 3.25, halfY: 1.4, halfZ: .22 } },
    { piece: 'none' as const, draw: 'post', x: side * 25.3, z: 25.3, solid: { halfX: .2, halfY: 1.65, halfZ: .2 } },
    { piece: 'none' as const, draw: 'andon', x: side * 26.7, z: 26.7, solid: { halfX: .25, halfY: .5, halfZ: .25 } },
  ]),
];

const CRATER: StageProp[] = [
  { piece: 'br/kenney-town-wall-wood-broken', x: -26, z: -2, rot: 75 * r, scale: 3, tint: 0xb8a48c, solid: true, fit: 1 },
  { piece: 'br/kenney-town-wall-wood-broken', x: 27.5, z: 3.5, rot: -100 * r, scale: 3, tint: 0xb8a48c, solid: true, fit: 1 },
  { piece: 'br/kenney-town-cart-high', x: 10, z: -31, rot: 40 * r, scale: 2, tint: 0xc0aa90, solid: true, fit: .85 },
  { piece: 'br/meshy-rubble', x: -6, z: 25.5, rot: 30 * r, scale: .6, tint: 0xd0c0a8, solid: { halfX: 1.2, halfY: .7, halfZ: 1.2 } },
  { piece: 'br/meshy-rubble', x: 30, z: 24, rot: 120 * r, scale: .55, tint: 0xd0c0a8, solid: { halfX: 1.1, halfY: .65, halfZ: 1.1 } },
  { piece: 'br/meshy-rubble', x: -29, z: -30, rot: 200 * r, scale: .58, tint: 0xd0c0a8, solid: { halfX: 1.15, halfY: .65, halfZ: 1.15 } },
  ...([[22, -22], [-8, -27], [-31, 19], [33, -32], [-18, -33]] as const).map(([x, z]) =>
    ({ piece: 'none' as const, draw: 'receivers', x, z, solid: { halfX: .55, halfY: 1.6, halfZ: .55 } })),
];

export const STAGE_PROPS: Partial<Record<StageId, readonly StageProp[]>> = {
  shiganshina: SHIGANSHINA,
  'enies-lobby': ENIES,
  'chunin-final': CHUNIN,
  'kami-lookout': KAMI,
  'valley-of-the-end': VALLEY,
  'malevolent-shrine': SHRINE,
  marineford: MARINEFORD,
  shibuya: SHIBUYA,
  'infinity-castle': CASTLE,
  'pains-crater': CRATER,
};

export function propCollider(p: StageProp): EnvironmentCollider | undefined {
  if (!p.solid) return undefined;
  const scale = p.scale ?? 1;
  if (p.solid !== true || p.piece === 'column' || p.piece === 'stump' || p.piece === 'block' || p.piece === 'none') {
    if (p.solid === true) throw new Error(`${p.piece} needs its box`);
    const { halfX, halfY, halfZ, dx = 0, dz = 0, y } = p.solid;
    return { x: p.x + dx, y: y ?? (p.y ?? 0) + halfY, z: p.z + dz, halfX, halfY, halfZ };
  }
  const [w, h, d] = KIT_SIZE[p.piece];
  const fit = p.fit ?? 1, yaw = p.rot ?? 0;
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const halfX = (w * c + d * s) / 2 * scale * fit, halfZ = (w * s + d * c) / 2 * scale * fit;
  const lean = Math.max(Math.abs(p.tilt ?? 0), Math.abs(p.roll ?? 0));
  const height = p.height ?? h * scale * (lean ? Math.max(Math.cos(lean), .35) : 1);
  return { x: p.x, y: (p.y ?? 0) + height / 2, z: p.z, halfX, halfY: height / 2, halfZ };
}

export function propColliders(stage: StageId): EnvironmentCollider[] {
  return (STAGE_PROPS[stage] ?? []).map(propCollider).filter((c): c is EnvironmentCollider => !!c);
}
