import * as THREE from 'three';
import { propColliders } from '../../../game/stageProps';
import type { GroundPlan } from '../build';
import { box, circle, DENSITY, FLOWERS, type GroundField, HEIGHT, path, SPARE, spawnSeats, valueNoise } from '../mask';
import { CHUNIN_OWN_TREES, treeRing } from '../../stages/chuninFinal';

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const CHUNIN_PATHS: readonly (readonly (readonly [number, number])[])[] = [
  [[1, -74], [2, -46], [-3, -36], [4, -24], [9, -10], [8, 4], [12, 20], [9, 40], [14, 74]],
  [[-74, -14], [-48, -12], [-30, -6], [-16, -9], [-4, -12], [9, -10]],
];

export const CHUNIN_GROUND: GroundPlan = {
  wind: { heading: 2.3, strength: .2, gusts: 3 },
  grass: [{
    name: 'chunin field',
    rect: { x0: -76, z0: -76, x1: 76, z1: 76 }, texel: .5,
    floor: .051,
    look: { height: .44, root: 0x24634a, cool: 0x349a6c, warm: 0x70be58, tip: 0xb0c848, warmth: .55, width: .05 },
    cover: { specks: [0xfff4d6, 0xffe27a, 0xf4b6de], speckle: .05, earth: 0x766a5c, opaque: true },
    flowers: { colors: [0xfff6dc, 0xffe066, 0xf0a6d4, 0xffffff], size: .09, reach: 18 },
    litter: { colors: [0xa88c56, 0xb48c4a, 0x868a4c, 0xa8704a], size: .22, reach: 24, where: chuninLitter() },
    paint(field) {
      const noise = valueNoise(51), fine = valueNoise(52), tall = valueNoise(53), bloom = valueNoise(54), wobble = valueNoise(55);
      field.paint(DENSITY, circle(0, 0, 75), 1, 'set', 3);
      field.paint(SPARE, circle(0, 0, 77.6), 1, 'set', .5);
      field.fill(HEIGHT, 1);
      field.map(DENSITY, (v, x, z) => v * smooth(.26, .37, noise(x * .05, z * .05) * .75 + fine(x * .23, z * .23) * .25));
      for (const track of CHUNIN_PATHS) {
        const line = path(track, 1);
        field.map(DENSITY, (v, x, z) => {
          const d = line.sd(x, z) - (1.1 + 1.1 * wobble(x * .08, z * .08));
          return v * smooth(-.2, 1.8, d + (fine(x * .9, z * .9) - .5) * .9);
        });
        field.map(HEIGHT, (v, x, z) => v * (.55 + .45 * smooth(0, 3.5, line.sd(x, z) - 1.2)));
      }
      field.map(HEIGHT, (v, x, z) => v * (.78 + .3 * smooth(18, 62, Math.hypot(x, z))) * (.85 + .25 * tall(x * .09 + 9, z * .09)));
      field.map(FLOWERS, (_, x, z) => smooth(.52, .72, bloom(x * .06 + 31, z * .06)));
      for (const c of propColliders('chunin-final')) field.paint(DENSITY, box(c.x, c.z, c.halfX + .25, c.halfZ + .25), 0, 'min', .7);
      field.paint(DENSITY, circle(0, -33.5, 5.5), .1, 'min', 3);
      for (const [x, z] of spawnSeats('chunin-final')) field.paint(DENSITY, circle(x, z, 1.6), .15, 'min', 1.8);
    },
  }],
  finish(c) {
    c.model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !FLOOR_TILES.test((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name)) return;
      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      if (b.max.y - b.min.y < .3) mesh.visible = false;
    });
  },
};

export function chuninLitter() {
  const trees = [...CHUNIN_OWN_TREES.map(([x, z]) => ({ x, z })), ...treeRing().map(t => ({ x: t.x, z: t.z }))];
  const tracks = CHUNIN_PATHS.map(track => path(track, 1)), drift = valueNoise(57);
  return (x: number, z: number, field: GroundField) => {
    let under = 0;
    for (const t of trees) { const d = Math.hypot(x - t.x, z - t.z); if (d < 9) under = Math.max(under, 1 - smooth(2.5, 9, d)); }
    let edge = 0;
    for (const line of tracks) { const d = line.sd(x, z); edge = Math.max(edge, Math.exp(-((d - 1.4) ** 2) / 1.2)); }
    const earth = 1 - field.sample(DENSITY, x, z);
    const here = Math.max(under * .85, edge * .8, earth * .6, .03);
    return here * (.4 + 1.2 * smooth(.25, .75, drift(x * .14, z * .14)));
  };
}

export const FLOOR_TILES = /^Material\.0(4[3-9]|5\d|6\d)$/;
