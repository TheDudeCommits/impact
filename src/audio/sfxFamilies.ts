import type { FighterId } from '../game/types';
import type { AudioCue } from './cueTypes';

export type Family =
  | 'fire' | 'ice' | 'water' | 'lightning' | 'wind' | 'stone' | 'sand' | 'light' | 'dark' | 'steel' | 'string' | 'plant' | 'blast'
  | 'psychic' | 'blood' | 'petal' | 'acid' | 'gravity' | 'sonic' | 'beast'
  | 'ki' | 'quake' | 'magma' | 'haki' | 'elastic' | 'knives' | 'void' | 'flash' | 'saw';

export interface FamilySound { readonly cue: AudioCue | readonly AudioCue[]; readonly gain: number; readonly rate?: number; readonly after?: number }
export interface FamilyLayers {
  readonly cast: readonly FamilySound[]; readonly rush: readonly FamilySound[]; readonly hit: readonly FamilySound[]; readonly tail: readonly FamilySound[];
  readonly weight: number;
  readonly explodes?: boolean;
}

const one = (cue: AudioCue | readonly AudioCue[], gain: number, rate?: number, after?: number): FamilySound => ({ cue, gain, ...(rate !== undefined ? { rate } : {}), ...(after !== undefined ? { after } : {}) });
const WHOOSH = ['fx-fire-whoosh-1', 'fx-fire-whoosh-2'] as const, ZAP = ['fx-zap-1', 'fx-zap-2', 'fx-zap-3'] as const, ZIP = ['fx-zip-1', 'fx-zip-2'] as const;
const BLAST = ['fx-explosion-1', 'fx-explosion-2'] as const, ENERGY = ['fx-energy-hit-1', 'fx-energy-hit-2'] as const, KI = ['fx-ki-blast-1', 'fx-ki-blast-2', 'fx-ki-blast-3'] as const;
const CUT = ['fx-cut-heavy-1', 'fx-cut-heavy-2'] as const, SWIPE = ['fx-beast-swipe-1', 'fx-beast-swipe-2'] as const, THROW = ['fx-knife-throw-1', 'fx-knife-throw-2'] as const;
const STUCK = ['fx-knife-hit-1', 'fx-knife-hit-2'] as const, STRETCH = ['fx-stretch-1', 'fx-stretch-2'] as const, SNAP = ['fx-snap-1', 'fx-snap-2'] as const, HEAVY = ['fx-swing-heavy-1', 'fx-swing-heavy-2'] as const;

export const FAMILIES: Readonly<Record<Family, FamilyLayers>> = {
  fire: { cast: [one('fx-fire-ignite', .4)], rush: [one(WHOOSH, .42)], hit: [one('fx-fire-burst', .5)], tail: [one('fx-embers', .26)], weight: .6, explodes: true },
  lightning: { cast: [one(ZIP, .26), one(ZAP, .22)], rush: [one(ZAP, .34)], hit: [one('fx-lightning', .44), one(ZAP, .24, 1, .05)], tail: [one(ZAP, .16, 1.1, .12)], weight: .6, explodes: true },
  wind: { cast: [one(HEAVY, .34, .85)], rush: [one('fx-wind-blast', .5)], hit: [one('fx-wind-blast', .46, 1.2)], tail: [], weight: .45 },
  steel: { cast: [one('fx-draw', .3)], rush: [one('fx-slash-wave', .4)], hit: [one(CUT, .5), one('fx-sword-ring', .16, 1, .02)], tail: [], weight: .35 },
  blast: { cast: [], rush: [one('fx-ki-launch', .36)], hit: [one(BLAST, .6)], tail: [one('fx-embers', .2)], weight: 1, explodes: true },
  beast: { cast: [one(SWIPE, .44)], rush: [one('fx-beast-roar', .34)], hit: [one('fx-beast-bite', .5)], tail: [], weight: .35 },
  ki: { cast: [], rush: [one(KI, .4)], hit: [one(ENERGY, .46)], tail: [], weight: .6, explodes: true },
  elastic: { cast: [one(STRETCH, .36)], rush: [], hit: [one(SNAP, .36)], tail: [], weight: .35 },
  knives: { cast: [one(THROW, .4)], rush: [one(THROW, .34, 1.1)], hit: [one(STUCK, .56)], tail: [], weight: .3 },
  haki: { cast: [one('fx-haki', .4)], rush: [], hit: [one('fx-enter-haki', .44)], tail: [], weight: .6 },
  ice: { cast: [one('fx-el-ice-cast', .42)], rush: [one('fx-el-ice-rush', .4)], hit: [one('fx-el-ice-hit', .56)], tail: [one('fx-el-ice-tail', .28)], weight: .5 },
  water: { cast: [one('fx-el-water-cast', .44)], rush: [one('fx-el-water-rush', .42)], hit: [one('fx-el-water-hit', .68)], tail: [one('fx-el-water-tail', .28)], weight: .5 },
  stone: { cast: [one('fx-el-stone-cast', .46)], rush: [one('fx-el-stone-cast', .34, 1.25)], hit: [one('fx-el-stone-hit', .66)], tail: [one('fx-el-stone-tail', .34)], weight: 1 },
  sand: { cast: [one('fx-el-sand-cast', .44)], rush: [one('fx-el-sand-rush', .42)], hit: [one('fx-el-sand-hit', .8)], tail: [one('fx-el-sand-tail', .3)], weight: .5 },
  light: { cast: [one('fx-el-light-cast', .4)], rush: [one('fx-el-light-rush', .42)], hit: [one('fx-el-light-hit', .74)], tail: [one('fx-el-light-tail', .26)], weight: .45, explodes: true },
  dark: { cast: [one('fx-el-dark-cast', .46)], rush: [one('fx-el-dark-cast', .3, 1.3)], hit: [one('fx-el-dark-hit', .5)], tail: [], weight: .6 },
  string: { cast: [one('fx-el-string-cast', .42)], rush: [one('fx-el-string-rush', .4)], hit: [one('fx-el-string-hit', .72)], tail: [], weight: .3 },
  plant: { cast: [one('fx-el-plant-cast', .44)], rush: [one('fx-el-plant-cast', .3, 1.3)], hit: [one('fx-el-plant-hit', .76)], tail: [], weight: .35 },
  psychic: { cast: [one('fx-el-psy-cast', .42)], rush: [one('fx-el-psy-cast', .3, 1.2)], hit: [one('fx-el-psy-hit', .58)], tail: [], weight: .5 },
  blood: { cast: [one('fx-el-blood-rush', .36, .85)], rush: [one('fx-el-blood-rush', .4)], hit: [one('fx-el-blood-hit', .7)], tail: [], weight: .2 },
  petal: { cast: [one('fx-el-petal-cast', .5)], rush: [one('fx-el-petal-rush', .5)], hit: [one('fx-el-petal-hit', .8)], tail: [one('fx-el-petal-cast', .24, .8)], weight: 0 },
  acid: { cast: [one('fx-el-acid-cast', .42)], rush: [one('fx-el-acid-cast', .3, 1.2)], hit: [one('fx-el-acid-hit', .58)], tail: [], weight: .2 },
  gravity: { cast: [one('fx-el-grav-cast', .46)], rush: [], hit: [one('fx-el-grav-hit', .52)], tail: [], weight: 1 },
  sonic: { cast: [one('fx-el-sonic-cast', .42)], rush: [], hit: [one('fx-el-sonic-hit', .64)], tail: [], weight: .35 },
  quake: { cast: [one('fx-el-stone-cast', .46)], rush: [], hit: [one('fx-guard-shatter', .4), one('fx-el-stone-hit', .56)], tail: [one('fx-el-stone-tail', .3)], weight: 1 },
  magma: { cast: [one('fx-fire-ignite', .36), one('fx-el-stone-cast', .34)], rush: [one(WHOOSH, .4)], hit: [one('fx-fire-burst', .46), one('fx-el-stone-hit', .46)], tail: [one('fx-embers', .24)], weight: 1, explodes: true },
  flash: { cast: [one('fx-el-dark-cast', .4)], rush: [], hit: [one('fx-black-flash', .46), one('fx-el-dark-hit', .36)], tail: [], weight: .6 },
  saw: { cast: [one('fx-denji-rev', .36)], rush: [], hit: [one(['fx-denji-saw-1', 'fx-denji-saw-2'], .56)], tail: [], weight: .35 },
  void: { cast: [one('fx-blue', .4)], rush: [], hit: [one('fx-el-grav-hit', .5)], tail: [], weight: .8 },
};

type F = Family | null;
export const MOVE_FAMILY: Readonly<Record<FighterId, readonly [heavy: F, special: F, ultimate: F, area: Family]>> = {
  luffy: [null, null, null, 'blast'],
  zoro: [null, null, null, 'wind'],
  sanji: [null, 'fire', 'fire', 'fire'],
  ace: ['fire', 'fire', 'fire', 'fire'],
  law: [null, null, null, 'psychic'],
  nami: [null, 'wind', 'lightning', 'lightning'],
  mihawk: ['steel', 'steel', 'steel', 'steel'],
  'boa-hancock': ['stone', 'light', 'stone', 'light'],
  kaido: [null, 'wind', 'lightning', 'fire'],
  whitebeard: ['steel', 'quake', 'quake', 'water'],
  shanks: ['steel', 'haki', 'haki', 'haki'],
  roger: ['haki', 'haki', 'haki', 'haki'],
  crocodile: ['sand', 'sand', 'sand', 'sand'],
  usopp: ['plant', 'fire', 'plant', 'plant'],
  'nico-robin': ['petal', 'petal', 'petal', 'petal'],
  aokiji: ['ice', 'ice', 'ice', 'ice'],
  doflamingo: ['string', 'string', 'string', 'string'],
  blackbeard: ['quake', 'dark', 'quake', 'dark'],
  kizaru: ['light', 'light', 'light', 'light'],
  yamato: [null, 'wind', 'lightning', 'ice'],
  jinbe: ['water', 'water', 'water', 'water'],
  enel: ['lightning', 'lightning', 'lightning', 'lightning'],
  akainu: ['magma', 'magma', 'magma', 'magma'],
  naruto: [null, null, null, 'wind'],
  sasuke: [null, null, 'lightning', 'fire'],
  kakashi: [null, null, null, 'water'],
  itachi: ['psychic', null, 'psychic', 'fire'],
  madara: [null, 'fire', 'stone', 'fire'],
  minato: ['wind', 'light', 'light', 'wind'],
  sakura: ['stone', null, 'stone', 'stone'],
  tsunade: ['stone', 'stone', 'stone', 'acid'],
  jiraiya: ['wind', 'fire', 'fire', 'acid'],
  hinata: ['ki', 'wind', 'beast', 'ki'],
  pain: ['gravity', 'gravity', 'gravity', 'gravity'],
  'might-guy': ['wind', 'wind', 'blast', 'wind'],
  ichigo: ['steel', null, null, 'steel'],
  aizen: ['psychic', 'ki', 'dark', 'lightning'],
  byakuya: ['petal', 'petal', 'petal', 'petal'],
  kenpachi: ['steel', 'steel', 'steel', 'steel'],
  grimmjow: ['beast', 'ki', 'beast', 'knives'],
  yamamoto: ['fire', 'fire', 'magma', 'fire'],
  rukia: ['ice', 'ice', 'ice', 'fire'],
  yoruichi: [null, 'lightning', 'lightning', 'lightning'],
  gojo: [null, null, null, 'void'],
  sukuna: ['steel', 'steel', 'steel', 'fire'],
  yuji: ['dark', 'blood', 'flash', 'flash'],
  yuta: ['steel', 'sonic', 'dark', 'dark'],
  nanami: ['steel', 'stone', 'steel', 'steel'],
  toji: ['steel', 'steel', 'steel', 'steel'],
  gon: ['ki', 'ki', 'ki', 'ki'],
  killua: [null, null, null, 'lightning'],
  hisoka: ['elastic', 'knives', 'elastic', 'petal'],
  netero: [null, 'light', 'light', 'light'],
  meruem: ['beast', 'ki', 'ki', 'light'],
  goku: [null, null, null, 'ki'],
  vegeta: [null, null, null, 'ki'],
  broly: [null, 'ki', 'ki', 'ki'],
  'goku-black': ['ki', 'ki', 'ki', 'light'],
  jiren: ['ki', 'ki', 'ki', 'ki'],
  'golden-frieza': [null, 'ki', 'ki', 'ki'],
  'gohan-beast': [null, 'ki', 'ki', 'ki'],
  deku: ['wind', 'wind', 'wind', 'stone'],
  bakugo: ['blast', 'blast', 'blast', 'blast'],
  todoroki: ['fire', 'ice', 'ice', 'blast'],
  endeavor: ['fire', 'fire', 'fire', 'fire'],
  'all-might': ['wind', 'wind', 'wind', 'wind'],
  tanjiro: ['steel', 'water', 'fire', 'water'],
  rengoku: ['fire', 'fire', 'fire', 'fire'],
  akaza: [null, 'wind', 'blast', 'ice'],
  saitama: [null, null, 'blast', 'stone'],
  tatsumaki: ['psychic', 'stone', 'wind', 'wind'],
  garou: ['water', 'wind', null, 'wind'],
  eren: ['blast', 'steel', 'steel', 'steel'],
  levi: ['blast', 'steel', 'steel', 'steel'],
  mikasa: ['steel', 'steel', 'steel', 'steel'],
  meliodas: ['dark', 'fire', 'dark', 'steel'],
  escanor: ['fire', 'fire', 'light', 'light'],
  denji: [null, null, null, 'saw'],
  makima: ['psychic', 'psychic', 'psychic', 'gravity'],
  asuka: [null, 'light', null, 'beast'],
  shinji: [null, 'light', 'light', 'light'],
  akame: ['steel', 'steel', 'steel', 'steel'],
  esdeath: ['ice', 'ice', 'ice', 'ice'],
  'edward-elric': ['steel', 'stone', 'stone', 'stone'],
  'alphonse-elric': [null, 'stone', 'stone', 'light'],
  jotaro: [null, null, null, 'stone'],
  dio: [null, null, null, 'knives'],
  jolyne: ['string', null, 'string', 'string'],
  josuke: [null, null, 'light', 'knives'],
  guts: [null, null, null, 'knives'],
  griffith: ['steel', 'steel', 'dark', 'wind'],
  'sung-jinwoo': ['steel', 'psychic', 'dark', 'dark'],
  'ken-kaneki': ['blood', 'blood', 'blood', 'blood'],
  hiei: ['fire', 'steel', 'fire', 'fire'],
  'kaiju-no-8': [null, 'blast', 'blast', 'stone'],
  gintoki: [null, null, null, 'blast'],
  pikachu: [null, 'lightning', 'lightning', 'lightning'],
};

const FORM_FAMILY: Readonly<Partial<Record<FighterId, readonly [heavy: F, special: F, ultimate: F, area: Family]>>> = {
  eren: [null, null, 'stone', 'stone'],
};
const SLOT = { heavy: 0, special: 1, ultimate: 2, area: 3 } as const;
export function familyOf(fighter: FighterId, slot: string, awakened = false): Family | null {
  const row = (awakened ? FORM_FAMILY[fighter] : undefined) ?? MOVE_FAMILY[fighter], index = SLOT[slot as keyof typeof SLOT];
  return row && index !== undefined ? row[index] : null;
}

const cuesOf = (family: Family): AudioCue[] => {
  const layers = FAMILIES[family];
  return [...layers.cast, ...layers.rush, ...layers.hit, ...layers.tail].flatMap(sound => typeof sound.cue === 'string' ? [sound.cue] : [...sound.cue]);
};
export function familyCues(fighter: FighterId): AudioCue[] {
  const row = [...MOVE_FAMILY[fighter] ?? [], ...FORM_FAMILY[fighter] ?? []];
  return row ? [...new Set(row.filter((f): f is Family => !!f).flatMap(cuesOf))] : [];
}
