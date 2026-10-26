import type { CombatEvent } from '../game/types';
import type { CueLayer } from './cueTypes';
import { planBodyEffort, planReaction, planVoice, type VoiceScene } from './voicePlan';
import { planSfx } from './sfxPlan';

export { AUDIO_CUES, BASE_CUES, cueDuration, type AudioCue, type CueLayer } from './cueTypes';

export function planCombatAudio(event: CombatEvent, awakened = false, scene?: VoiceScene): CueLayer[] {
  if (event.body && event.fighter && event.body !== event.fighter)
    return [...planSfx(event, false).filter(layer => layer.bus !== 'voice'), ...planBodyEffort(event, event.body), ...planReaction(event, scene)];
  return [...planSfx(event, awakened), ...planVoice(event, awakened, scene)];
}
