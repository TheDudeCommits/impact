import {createRiftWarHud} from './RiftWarHud';
import type { HudLayoutId, ModeHudFactory } from './modeHud';
import { createDuelHud } from './DuelHud';
import { createRoyaleHud } from './RoyaleHud';
import { createTrainingHud } from './TrainingHud';
import { createArcadeHud } from './ArcadeHud';
import { createLastStandHud } from './LastStandHud';
import { createBadBloodHud } from './BadBloodHud';

export const MODE_HUDS: Readonly<Record<HudLayoutId, ModeHudFactory>> = {
  'rift-war':createRiftWarHud, duel: createDuelHud, royale: createRoyaleHud, training: createTrainingHud,
  arcade: createArcadeHud, 'last-stand': createLastStandHud, 'bad-blood': createBadBloodHud,
};
