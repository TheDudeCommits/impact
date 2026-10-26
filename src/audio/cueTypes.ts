import CUE_DURATIONS from './data/cueDurations.json';
import CUE_ONSETS from './data/cueOnsets.json';
import VOICE_DURATIONS from './data/voiceDurations.json';
import SFX_DURATIONS from './data/sfxDurations.json';
import { VOICE_CUES } from './voiceCues';
import { SFX_CUES } from './sfxCues';

export const BASE_CUES = {
  'jotaro-world':'jotaro-world.wav','zoro-phoenix':'zoro-phoenix.wav',
  'jotaro-star':'jotaro-star.wav',
  'vegeta-galick':'vegeta-galick.wav',
  'kakashi-resolve':'kakashi-resolve.wav',
  'zoro-onigiri':'zoro-onigiri.wav','zoro-world':'zoro-world.wav',
  'ichigo-mugetsu':'ichigo-mugetsu.wav','ichigo-zangetsu':'ichigo-zangetsu.wav','ichigo-bankai':'ichigo-bankai.wav',
  'swing-a': 'swing-a.wav', 'swing-b': 'swing-b.wav', cloth: 'cloth.wav',
  'body-a': 'body-a.wav', 'body-b': 'body-b.wav', crack: 'crack.wav', ground: 'ground.wav',
  'charge-chakra': 'charge-chakra.wav', 'release-ki': 'release-ki.wav',
  'energy-tail': 'energy-tail.wav', bomb: 'bomb.wav',
  'goku-kamehameha-full': 'goku-kamehameha-full.wav',
  'luffy-pistol':'luffy-pistol.wav', 'luffy-bazooka':'luffy-bazooka.wav', 'luffy-king-kong':'luffy-king-kong.wav',
  'goku-spirit': 'goku-spirit.wav', 'naruto-rasengan': 'naruto-rasengan.wav',
  'naruto-rasenshuriken': 'naruto-rasenshuriken.wav',
  'kurama-link':'kurama-link.wav','kurama-taunt':'kurama-taunt.wav',
  'kurama-growl':'kurama-growl.wav','kurama-bite':'kurama-bite.wav',
  'ace-hotarubi':'ace-hotarubi.wav','ace-kagero':'ace-kagero.wav',
  'law-shambles':'law-shambles.wav','law-gamma-knife':'law-gamma-knife.wav','law-counter-shock':'law-counter-shock.wav','law-injection-shot':'law-injection-shot.wav',
  'gojo-ao':'gojo-ao.wav','gojo-aka':'gojo-aka.wav','gojo-murasaki':'gojo-murasaki.wav','gojo-muryokusho':'gojo-muryokusho.wav',
  'dio-muda':'dio-muda.wav','dio-muda-muda':'dio-muda-muda.wav','dio-za-warudo':'dio-za-warudo.wav','dio-road-roller':'dio-road-roller.wav',
  'guts-scream':'guts-scream.wav',
  'killua-narukami':'killua-narukami.wav','killua-shippu':'killua-shippu.wav',
} as const;
export const AUDIO_CUES = { ...BASE_CUES, ...VOICE_CUES, ...SFX_CUES } as const;
export type AudioCue = keyof typeof AUDIO_CUES;
export interface CueLayer {
  cue: AudioCue; voicePriority?:number; bus?: 'sfx' | 'voice'; gain: number; delay?: number; rate?: number;
  loop?: boolean; duration?: number; phase?: 'charge' | 'cast' | 'release' | 'impact';
  speaker?: string; url?: string; yields?: 'self' | 'all';
}

export function cueDuration(cue:AudioCue){
  const durations={...CUE_DURATIONS,...VOICE_DURATIONS,...SFX_DURATIONS} as Record<string,number>;
  return durations[cue]-Math.max(0,((CUE_ONSETS as Record<string,number>)[cue]??0)-.015);
}
