import type { FighterId } from '../../game/types';
import type { IdleProfile } from './profile';

export const PROFILES_A: Partial<Record<FighterId, IdleProfile>> = {
  naruto: { model: '/assets/fighters/naruto-idle2.glb', clip: 'Naruto idle', fidgets: ['Naruto idle fidget'], stance: 'guard', breath: 1, sway: .6, gaze: 1 },
  kakashi: { model: '/assets/fighters/kakashi-idle1.glb', clip: 'Kakashi idle', fidgets: ['Kakashi idle fidget'], stance: 'relaxed', breath: 1, sway: .8, gaze: 1, dip: 2.8 },
  sasuke: { model: '/assets/fighters/sasuke-idle1.glb', clip: 'Sasuke idle', fidgets: ['Sasuke idle fidget'], stance: 'weapon', breath: 1.2, sway: .9, gaze: .8, dip: 3.8 },
  goku: { model: '/assets/fighters/goku-idle1.glb', clip: 'Goku idle', fidgets: ['Goku idle fidget'], stance: 'guard', breath: 1, sway: .6, gaze: 1, ready: 'goku-ready' },
  vegeta: { model: '/assets/fighters/vegeta-idle1.glb', clip: 'Vegeta idle', fidgets: ['Vegeta idle fidget'], stance: 'relaxed', breath: 1.3, sway: .8, gaze: .7, dip: 3 },
  ichigo: { model: '/assets/fighters/ichigo-idle1.glb', clip: 'Ichigo idle', fidgets: ['Ichigo idle fidget'], stance: 'weapon', breath: 1, sway: .7, gaze: 1, dip: 3 },
  gojo: { model: '/assets/fighters/gojo-idle1.glb', clip: 'Gojo idle', fidgets: ['Gojo idle fidget'], stance: 'relaxed', breath: .9, sway: .8, gaze: 1, dip: 2.8 },
  jotaro: { model: '/assets/fighters/jotaro-idle1.glb', clip: 'Jotaro idle', fidgets: ['Jotaro idle fidget'], stance: 'relaxed', breath: .9, sway: .5, gaze: .6, dip: 2.6 },
};
