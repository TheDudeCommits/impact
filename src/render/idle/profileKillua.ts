import type { FighterId } from '../../game/types';
import type { IdleProfile } from './profile';

export const PROFILE_KILLUA: Partial<Record<FighterId, IdleProfile>> = {
  killua: { clip: 'Idle Pockets', fidgets: ['Killua idle fidget'], stance: 'relaxed', breath: 1.3, sway: 1.8, gaze: 1.2, dip: 3.5 },
};
