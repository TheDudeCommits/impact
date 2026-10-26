import { awakeningSwapAt } from '../game/awakening';

const burst = awakeningSwapAt('goku');
export const SUPER_SAIYAN = {
  burst,
  line: Math.round((burst + .26) * 1000) / 1000,
  son: 2.08,
  goku: 2.89,
};

const vegetaBurst = awakeningSwapAt('vegeta');
export const SUPER_VEGETA = {
  burst: vegetaBurst,
  line: Math.round((vegetaBurst + .26) * 1000) / 1000,
  ore: .01,
  super: 1.04,
  vegeta: 1.92,
};
