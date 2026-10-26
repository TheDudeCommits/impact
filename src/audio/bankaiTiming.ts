import { awakeningSwapAt } from '../game/awakening';

const swap = awakeningSwapAt('ichigo');
const burstAfterKai = .08;
export const BANKAI = {
  kai: swap - burstAfterKai,
  kaiInLine: .54,
  burstAfterKai,
};
