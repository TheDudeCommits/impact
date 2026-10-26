import type { FighterId } from './types';

export const RELEASED_FIGHTERS = [
  'goku', 'naruto', 'luffy', 'zoro', 'sanji', 'vegeta', 'kakashi', 'sasuke',
  'jotaro', 'ichigo', 'ace', 'law', 'gojo', 'dio', 'guts', 'killua',
  'kaido', 'whitebeard', 'shanks', 'roger', 'aizen', 'sukuna', 'griffith', 'meruem',
  'goku-black', 'jiren', 'golden-frieza', 'gohan-beast', 'saitama', 'akaza', 'itachi', 'madara',
  'tanjiro', 'levi', 'sung-jinwoo', 'gon', 'mihawk', 'nami', 'boa-hancock', 'denji', 'akainu',
  'broly', 'deku', 'bakugo', 'all-might', 'todoroki', 'endeavor', 'yuta', 'yoruichi', 'yuji', 'rukia', 'kizaru', 'enel', 'yamato', 'jinbe', 'hinata', 'gintoki', 'tsunade', 'nanami', 'josuke', 'jiraiya', 'blackbeard', 'hisoka', 'doflamingo', 'aokiji', 'hiei', 'sakura', 'meliodas', 'escanor',
  'tatsumaki', 'makima', 'kenpachi',
  'minato', 'edward-elric', 'pain',
  'yamamoto', 'byakuya', 'grimmjow',
  'alphonse-elric', 'ken-kaneki', 'esdeath',
  'mikasa', 'netero',
  'akame', 'might-guy', 'nico-robin',
  'asuka', 'jolyne', 'eren', 'shinji',
  'garou', 'kaiju-no-8', 'rengoku',
  'usopp', 'crocodile', 'toji',
] as const satisfies readonly FighterId[];
const released: ReadonlySet<string> = new Set(RELEASED_FIGHTERS);

const REVIEW_ROSTER = ['toji','crocodile','usopp','mihawk', 'nami', 'boa-hancock', 'denji', 'akainu', 'broly', 'deku', 'bakugo', 'all-might', 'endeavor', 'todoroki', 'yoruichi', 'yuji', 'yuta', 'rukia', 'jinbe', 'enel', 'kizaru', 'yamato', 'hinata', 'gintoki', 'tsunade', 'jiraiya', 'nanami', 'josuke', 'blackbeard', 'hisoka', 'sakura', 'hiei', 'doflamingo', 'aokiji', 'meliodas', 'escanor', 'tatsumaki', 'makima', 'kenpachi', 'minato', 'edward-elric', 'pain', 'yamamoto', 'byakuya', 'grimmjow', 'ken-kaneki', 'alphonse-elric', 'mikasa', 'esdeath', 'garou', 'akame', 'might-guy', 'jolyne', 'shinji', 'netero', 'asuka', 'eren', 'kaiju-no-8', 'nico-robin', 'rengoku'] as const satisfies readonly FighterId[];
export const LABORATORY_FIGHTERS = REVIEW_ROSTER.filter(id => !released.has(id));
export type LaboratoryFighterId = typeof LABORATORY_FIGHTERS[number];
const laboratory: ReadonlySet<string> = new Set(LABORATORY_FIGHTERS);
export function isReleasedFighter(value: unknown): value is FighterId {
  return typeof value === 'string' && released.has(value);
}
export function isLaboratoryFighter(value: unknown): value is LaboratoryFighterId {
  return typeof value === 'string' && laboratory.has(value);
}
export function requireReleasedFighter(value: unknown): asserts value is FighterId {
  if (!isReleasedFighter(value)) throw new Error('This fighter is not available.');
}
