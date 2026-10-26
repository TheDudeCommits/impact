import type { FighterId } from '../../game/types';

export type HandShape = 'relaxed' | 'fist' | 'grip' | 'palm' | 'claw';
export type HandPose = HandShape | 'held' | 'own';
export type HandKind = 'idle' | 'guard' | 'run' | 'dash' | 'jump' | 'light1' | 'light2' | 'light3' | 'light4' | 'heavy' | 'special' | 'ultimate' | 'area' | 'hit' | 'launched' | 'down' | 'getup';
export type HandKey = HandKind | 'light' | 'stand' | 'move' | 'blow' | 'cast' | 'struck' | 'all';
export type HandSide = HandPose | Partial<Record<HandKey, HandPose>>;
export interface HandRow { L?: HandSide; R?: HandSide; both?: HandSide; form?: { L?: HandSide; R?: HandSide; both?: HandSide } }

const HELD = 'held' as const;
export const HAND_ROWS: Partial<Record<FighterId, HandRow>> = {
  deku: {},
  'all-might': { both: { heavy: 'palm' } },
  bakugo: { both: { blow: 'claw', cast: 'claw' } },
  todoroki: { both: { heavy: 'palm', cast: 'palm' } },
  endeavor: { both: { special: 'claw', ultimate: 'claw' } },
  pain: { L: { guard: 'palm', light: 'relaxed', heavy: 'palm', cast: 'palm' }, R: HELD },
  minato: { L: { heavy: 'claw', area: 'claw' }, R: HELD },
  jiraiya: { L: { stand: 'palm', light: 'palm', heavy: 'relaxed', cast: 'palm' }, R: 'own', form: { both: { stand: 'palm', light: 'palm', cast: 'palm', move: 'fist' }, L: { heavy: 'relaxed' }, R: { heavy: 'claw' } } },
  sakura: {},
  hinata: { both: { stand: 'palm', blow: 'palm', cast: 'palm' } },
  tsunade: {},
  doflamingo: { both: { all: 'claw', struck: 'relaxed' } },
  blackbeard: { both: { idle: 'fist', ultimate: 'claw' } },
  'nico-robin': { both: { guard: 'palm', blow: 'palm', cast: 'palm' } },
  yuji: { both: { special: 'palm' } },
  nanami: { R: HELD },
  yuta: { L: { special: 'relaxed', ultimate: 'palm', area: 'palm' }, R: HELD },
  toji: { R: HELD },
  yoruichi: { both: { light: 'palm' } },
  kenpachi: { L: { blow: 'claw', cast: 'claw' }, R: HELD },
  yamamoto: { L: { run: 'fist' }, R: HELD },
  grimmjow: { both: { blow: 'claw', cast: 'claw', special: 'palm' } },
  byakuya: { R: HELD },
  rukia: { L: { area: 'palm' }, R: HELD },
  hisoka: {},
  netero: { both: { stand: 'palm', light: 'palm', cast: 'palm' } },
  mikasa: { both: HELD },
  eren: {},
  gintoki: { R: HELD },
  hiei: { L: { run: 'fist' }, R: HELD },
  akame: { R: HELD },
  esdeath: { L: { cast: 'palm' }, R: HELD },
  asuka: { L: { guard: 'palm', special: 'claw' }, R: HELD },
  shinji: { both: { cast: 'palm' } },
  jolyne: { L: { idle: 'claw' } },
  josuke: {},
  'ken-kaneki': { both: { blow: 'claw', special: 'claw', area: 'claw', ultimate: 'relaxed' } },
  escanor: { L: { special: 'claw', area: 'claw' }, R: { ultimate: 'palm', all: HELD } },
  meliodas: { L: HELD },
  'alphonse-elric': { both: { special: 'palm', area: 'palm' }, L: { idle: 'fist' } },
  'edward-elric': { both: { special: 'palm', area: 'palm' } },
  tatsumaki: { both: { guard: 'palm', blow: 'claw', cast: 'claw' } },
  garou: { both: { stand: 'palm', blow: 'palm', special: 'palm', area: 'claw' } },
  'kaiju-no-8': {},
  rengoku: { L: { light: 'relaxed' }, R: HELD },
  makima: { both: 'relaxed', R: { guard: 'palm' } },
  broly: { both: { special: 'claw', area: 'claw' } },
  denji: { both: 'own' },
};

export const NO_FINGERS: readonly FighterId[] = ['akainu', 'aokiji', 'boa-hancock', 'crocodile', 'enel', 'jinbe', 'kizaru', 'mihawk', 'nami', 'usopp', 'yamato', 'might-guy'];

export const handRow = (fighter: FighterId): HandRow | undefined => HAND_ROWS[fighter];
