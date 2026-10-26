import type { VfxKit } from '../vfx/VfxKit';
import { MARK } from '../vfx/GroundMarks';
import type { Element } from '../vfx/palette';

export const CHARCOAL = 0x3e3a38, CHARCOAL_SHADE = 0x0e0c0c;

export function crater(k: VfxKit, x: number, floor: number, z: number, big: boolean, born: number, el?: Element) {
  const n = k.n(big ? 7 : 4, 2), reach = big ? 4.5 : 3;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + Math.random() * .5, v = reach * .5 * (.6 + Math.random() * .6);
    k.smoke(x + Math.cos(a) * .3, floor + .25, z + Math.sin(a) * .3, Math.cos(a) * v, .25 + Math.random() * .3, Math.sin(a) * v,
      (big ? .9 : .65) * (.8 + Math.random() * .4), born + Math.random() * .04, .6 + Math.random() * .25, CHARCOAL, CHARCOAL_SHADE);
  }
  k.ring(x, floor + .05, z, .4, big ? 5 : 3, born, big ? .45 : .34, 0xffffff, el?.rim ?? 0x8a8078, .18, 'flat');
  if (k.quality !== 'low') k.marks.mark(MARK.crack, x, floor, z, 0, 1, 0, big ? 3.2 : 1.9, born, big ? 3 : 2.2, el?.light ?? 0xffc873, el ? .5 : 0);
}
