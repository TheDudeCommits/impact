import type { FighterId } from '../../game/types';
import type { IdleProfile } from './profile';

export const PROFILES_SHOP: Partial<Record<FighterId, IdleProfile>> = {
  gon: { model: '/assets/fighters/gon-idle1.glb', clip: 'Gon idle', fidgets: ['Gon idle fidget'], stance: 'guard', breath: 1.1, sway: .5, gaze: 1 },
  'sung-jinwoo': { model: '/assets/fighters/sung-jinwoo-idle1.glb', clip: 'Sung Jinwoo idle', fidgets: ['Sung Jinwoo idle fidget'], stance: 'relaxed', breath: .8, sway: .5, gaze: .8, dip: 2.4, ready: 'Sung Jinwoo ready' },
  madara: { model: '/assets/fighters/madara-idle1.glb', clip: 'Madara idle', fidgets: ['Madara idle fidget'], stance: 'relaxed', breath: .9, sway: .4, gaze: .7, dip: 2.4 },
  itachi: { model: '/assets/fighters/itachi-idle1.glb', clip: 'Itachi idle', fidgets: ['Itachi idle fidget'], stance: 'relaxed', breath: .8, sway: .4, gaze: .9, dip: 2.2 },
  sukuna: { model: '/assets/fighters/sukuna-idle1.glb', clip: 'Sukuna idle', fidgets: ['Sukuna idle fidget'], stance: 'relaxed', breath: 1, sway: .8, gaze: 1, dip: 2.6 },
  'gohan-beast': { model: '/assets/fighters/gohan-beast-idle1.glb', clip: 'Gohan Beast idle', fidgets: ['Gohan Beast idle fidget'], stance: 'guard', breath: 1.3, sway: .5, gaze: 1 },
  akaza: { model: '/assets/fighters/akaza-idle2.glb', clip: 'Akaza idle', fidgets: ['Akaza idle fidget'], stance: 'guard', breath: 1.1, sway: .5, gaze: 1 },
  saitama: { model: '/assets/fighters/saitama-idle1.glb', clip: 'Saitama idle', fidgets: ['Saitama idle fidget'], stance: 'relaxed', breath: .7, sway: .6, gaze: .5, dip: 2 },
  meruem: { model: '/assets/fighters/meruem-idle2.glb', clip: 'Meruem idle', fidgets: ['Meruem idle fidget'], stance: 'relaxed', breath: .9, sway: .3, gaze: .9, dip: 2 },
  griffith: { model: '/assets/fighters/griffith-idle1.glb', clip: 'Griffith idle', fidgets: ['Griffith idle fidget'], stance: 'weapon', breath: .8, sway: .4, gaze: .9, dip: 2, fidgetEvery: [9, 15] },
  kaido: { stance: 'weapon', breath: 1.1, sway: .5, gaze: .7, dip: 2.2 },
  whitebeard: { stance: 'weapon', breath: 1.1, sway: .5, gaze: .7, dip: 2.2, fidgets: ['idlehome_a'], fidgetEvery: [9, 16] },
  shanks: { stance: 'weapon', breath: .9, sway: .5, gaze: .9, dip: 2.2, fidgets: ['idlehome_a'], fidgetEvery: [8, 14] },
  roger: { stance: 'weapon', breath: 1, sway: .5, gaze: .8, dip: 2.2 },
  aizen: { stance: 'weapon', breath: .7, sway: .4, gaze: .7, dip: 1.8 },
  'goku-black': { stance: 'guard', breath: 1, sway: .5, gaze: .9, dip: 2 },
  jiren: { stance: 'guard', breath: .8, sway: .3, gaze: .7, dip: 1.8 },
  'golden-frieza': { stance: 'relaxed', breath: .8, sway: .5, gaze: .9, dip: 1.8 },
  tanjiro: { stance: 'weapon', breath: 1, sway: .5, gaze: .8, dip: 2.2 },
  levi: { stance: 'weapon', breath: 1, sway: .5, gaze: .8, dip: 2.2 },
};
