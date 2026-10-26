import type { GroundPlan } from '../build';
import { SandPrints } from '../sand';
import { GROUND_TIERS } from '../quality';

export const HUECO_GROUND: GroundPlan = {
  sand(c) {
    const prints = new SandPrints(c.frame, {
      name: 'hueco sand', rect: { x0: -40, z0: -40, x1: 40, z1: 40 }, level: 0,
      life: 30, shade: .45,
    }, GROUND_TIERS.high.prints);
    c.group.add(prints.mesh);
    c.own(prints);
  },
};
