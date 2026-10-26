import type { FighterId } from '../game/types';
import type { AudioCue } from './cueTypes';
import { powerCues } from './powerSound';
import { familyCues } from './sfxFamilies';
import { signatureCues } from './sfxSignatures';

export const byNeed = (cue: string) => /^fx-(aura|enter|el|sig)-/.test(cue);

export function fighterCues(fighter: FighterId): AudioCue[] { return [...new Set([...powerCues(fighter), ...familyCues(fighter), ...signatureCues(fighter)])].filter(byNeed); }
