import type { FighterId } from '../../game/types';
import type { IdleProfile } from './profile';

export const PROFILES_B: Partial<Record<FighterId, IdleProfile>> = {
  luffy: { model: '/assets/fighters/luffy-idleb1.glb', clip: 'Idle B', fidgets: ['Idle B hat'], stance: 'guard', bounce: 0, sway: .5 },
  zoro: { model: '/assets/fighters/zoro-idleb1.glb', clip: 'Idle B', stance: 'weapon', sway: .7 },
  sanji: { model: '/assets/fighters/sanji-idleb1.glb', clip: 'Idle B', fidgets: ['Idle B smoke'], stance: 'relaxed', sway: .35, gaze: .8 },
  ace: { clip: 'pl_ace_topw01_idlehome_a', stance: 'relaxed', ready: '_Idle' },
  law: { clip: 'pl_law_winn01_victory_lp', stance: 'weapon', sway: .7, breath: 1.2, dip: 2.5, ready: '_Idle' },
  dio: { model: '/assets/fighters/dio-idleb1.glb', clip: 'Idle B', fidgets: ['Idle B wry'], stance: 'stand', breath: .9, sway: .5, gaze: .6 },
  guts: { model: '/assets/fighters/guts-idleb1.glb', clip: '_Idle', fidgets: ['Idle B heave'], stance: 'weapon', breath: 1.5, dip: 2 },
};
