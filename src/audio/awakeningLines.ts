import { awakeningSwapAt } from '../game/awakening';
import type { FighterId } from '../game/types';
import type { AudioCue } from './cueTypes';

export interface AwakeningLine {
  cue: AudioCue;
  form: string;
  burst: number;
  line: number;
  words: readonly number[];
  named: number;
}

export const AFTER_BURST = .26;

const after = (fighter: FighterId, cue: AudioCue, form: string, words: readonly number[], named: number, wait = AFTER_BURST): AwakeningLine => {
  const burst = awakeningSwapAt(fighter);
  return { cue, form, burst, line: Math.round((burst + wait) * 1000) / 1000, words, named };
};

export const AWAKENING_LINES: Partial<Record<FighterId, AwakeningLine>> = {
  'all-might': after('all-might','vo-all-might-embers','One For All: Embers',[.46],0,.15),
  bakugo: after('bakugo','vo-bakugo-cluster-ready','Cluster',[0],0,.06),
  deku: after('deku','vo-deku-full-power','Vigilante: Full Cowling',[0],0,.12),
  denji: after('denji','vo-denji-overdrive','Ripcord Overdrive',[0],0),
  akainu: after('akainu','vo-akainu-magma','Absolute Justice',[0],0),
  'boa-hancock': after('boa-hancock','vo-boa-hancock-empress','Pirate Empress',[0],0),
  nami: after('nami','vo-nami-weatheria','Weatheria: Weather Mastery',[.01],0),
  mihawk: after('mihawk','vo-mihawk-surpass-me','Hawk-Eye Focus',[0,.85],1),
  zoro: after('zoro', 'vo-zoro-asura', 'Asura', [0, .38, 1.22], 2),
  luffy: after('luffy', 'vo-luffy-saiko-chiten', 'Gear 5', [.02, 1.47, 1.96, 2.28], 2),
  kakashi: after('kakashi', 'vo-kakashi-mangekyo', 'Susanoo', [.03], 0),
  dio: after('dio', 'vo-dio-saiko-ni-high', 'Za Warudo', [.02, .7, 1.31, 1.87, 2.27], 1),
  killua: after('killua', 'vo-killua-denko-sekka', 'Godspeed', [.01, .67], 0, AFTER_BURST + .2),
  gon: after('gon', 'vo-gon-arittake', 'Adult Gon', [.01, .58, 1.4, 1.88, 2.25, 2.82, 3.05, 3.82, 4.35], 7),
  law: after('law', 'vo-law-nigerarenee', 'Awakened Room', [.02], 0),
  sanji: after('sanji', 'vo-sanji-diable-jambe', 'Ifrit Jambe', [.01], 0),
  sasuke: after('sasuke', 'vo-sasuke-susanoo', 'Susanoo', [.02], 0),
  itachi: after('itachi', 'vo-itachi-uchiha-power', 'Susanoo', [.05, 2.21], 0),
  tanjiro: after('tanjiro', 'vo-tanjiro-zenshuchu', 'Sun Breathing', [.03], 0),
  jotaro: after('jotaro', 'vo-jotaro-sabaku', 'The World', [.05, 1.31, 1.93], 2),
  ace: after('ace', 'vo-ace-hiken-no-ace', 'Flame Emperor', [.01], 0),
  'gohan-beast': after('gohan-beast', 'vo-gohan-beast-kono-chikara', 'Beast', [.01, .1, .49, .66, 1.35, 1.52], 2),
  gojo: after('gojo', 'vo-gojo-saikyo', 'Six Eyes', [.01], 0),
  shanks: after('shanks', 'vo-shanks-senso-owarase', 'Haoshoku Haki', [.02, 1.38], 0, AFTER_BURST + .2),
  roger: after('roger', 'vo-roger-kaizoku-o', 'King of the Pirates', [.01, 1.11], 0),
  'sung-jinwoo': after('sung-jinwoo', 'vo-sung-jinwoo-tsuyoku', 'Shadow Monarch', [.05, .59, .82, 1.09, 1.76], 1),
};
