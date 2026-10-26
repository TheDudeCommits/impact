import { TOJI_COMBOS } from './fighters/toji';
import { CROCODILE_COMBOS } from './fighters/crocodile';
import { USOPP_COMBOS } from './fighters/usopp';
import { NICO_ROBIN_COMBOS } from './fighters/nico-robin';
import { RENGOKU_COMBOS } from './fighters/rengoku';
import { KAIJU_COMBOS } from './fighters/kaiju-no-8';
import { EREN_COMBOS } from './fighters/eren';
import { ASUKA_COMBOS } from './fighters/asuka';
import { NETERO_COMBOS } from './fighters/netero';
import { SHINJI_COMBOS } from './fighters/shinji';
import { JOLYNE_COMBOS } from './fighters/jolyne';
import { MIGHT_GUY_COMBOS } from './fighters/might-guy';
import { AKAME_COMBOS } from './fighters/akame';
import { PIKACHU_COMBOS } from './fighters/pikachu';
import { GAROU_COMBOS } from './fighters/garou';
import { ESDEATH_COMBOS } from './fighters/esdeath';
import { MIKASA_COMBOS } from './fighters/mikasa';
import { ALPHONSE_ELRIC_COMBOS } from './fighters/alphonse-elric';
import { KANEKI_COMBOS } from './fighters/kaneki';
import { GRIMMJOW_COMBOS } from './fighters/grimmjow';
import { BYAKUYA_COMBOS } from './fighters/byakuya';
import { YAMAMOTO_COMBOS } from './fighters/yamamoto';
import { PAIN_COMBOS } from './fighters/pain';
import { EDWARD_ELRIC_COMBOS } from './fighters/edward-elric';
import { MINATO_COMBOS } from './fighters/minato';
import { KENPACHI_COMBOS } from './fighters/kenpachi';
import { MAKIMA_COMBOS } from './fighters/makima';
import { TATSUMAKI_COMBOS } from './fighters/tatsumaki';
import { ESCANOR_COMBOS } from './fighters/escanor';
import { MELIODAS_COMBOS } from './fighters/meliodas';
import { HIEI_COMBOS } from './fighters/hiei';
import { SAKURA_COMBOS } from './fighters/sakura';
import { AOKIJI_COMBOS } from './fighters/aokiji';
import { DOFLAMINGO_COMBOS } from './fighters/doflamingo';
import { HISOKA_COMBOS } from './fighters/hisoka';
import { BLACKBEARD_COMBOS } from './fighters/blackbeard';
import { NANAMI_COMBOS } from './fighters/nanami';
import { JOSUKE_COMBOS } from './fighters/josuke';
import { TSUNADE_COMBOS } from './fighters/tsunade';
import { JIRAIYA_COMBOS } from './fighters/jiraiya';
import { HINATA_COMBOS } from './fighters/hinata';
import { GINTOKI_COMBOS } from './fighters/gintoki';
import { KIZARU_COMBOS } from './fighters/kizaru';
import { YAMATO_COMBOS } from './fighters/yamato';
import { JINBE_COMBOS } from './fighters/jinbe';
import { ENEL_COMBOS } from './fighters/enel';
import { RUKIA_COMBOS } from './fighters/rukia';
import { YUTA_COMBOS } from './fighters/yuta';
import { YUJI_COMBOS } from './fighters/yuji';
import { TODOROKI_COMBOS } from './fighters/todoroki';
import { ENDEAVOR_COMBOS } from './fighters/endeavor';
import { YORUICHI_COMBOS } from './fighters/yoruichi';
import { ALL_MIGHT_COMBOS } from './fighters/all-might';
import { BAKUGO_COMBOS } from './fighters/bakugo';
import { DEKU_COMBOS } from './fighters/deku';
import { BROLY_COMBOS } from './fighters/broly';
import { DENJI_COMBOS } from './fighters/denji';
import { AKAINU_COMBOS } from './fighters/akainu';
import { MIHAWK_COMBOS } from './fighters/mihawk';
import { BOA_HANCOCK_COMBOS } from './fighters/boa-hancock';
import { NAMI_COMBOS } from './fighters/nami';
import type { AttackSlot, FighterId } from './types';
import { HITSTOP, MOVES, type MoveDefinition, type Outcome } from './moves';
import { SHOP_COMBOS } from './combosShop';
import { VOL1_COMBOS } from './combosVol1';

export type ComboEnder = { name: string } & Partial<MoveDefinition>;
export type ComboRow = Record<ComboKey, ComboEnder> & { awakened?: Partial<Record<ComboKey, ComboEnder>> };

export type ComboKey = 'lh' | 'llh' | 'lllh' | 'llls' | 'airHeavy' | 'airSpecial';
export const COMBO_KEYS: readonly ComboKey[] = ['lh', 'llh', 'lllh', 'llls', 'airHeavy', 'airSpecial'];
export const COMBO_INPUTS: Record<ComboKey, readonly ('jump' | AttackSlot)[]> = {
  lh: ['light', 'heavy'], llh: ['light', 'light', 'heavy'], lllh: ['light', 'light', 'light', 'heavy'],
  llls: ['light', 'light', 'light', 'special'], airHeavy: ['jump', 'heavy'], airSpecial: ['jump', 'special'],
};
export const COMBO_ROLES: Record<ComboKey, string> = {
  lh: 'Blowback', llh: 'Launcher', lllh: 'Knockdown', llls: 'Stun', airHeavy: 'Air strike', airSpecial: 'Ground smash',
};
export const COMBO_SLOT: Record<ComboKey, 'heavy' | 'special'> = {
  lh: 'heavy', llh: 'heavy', lllh: 'heavy', llls: 'special', airHeavy: 'heavy', airSpecial: 'special',
};

const TEMPLATE: Record<ComboKey, MoveDefinition> = {
  lh: { name: '', duration: .7, contacts: [.28], damage: 46, range: 2.5, radius: .8, stamina: 16, cooldown: 1.2, stun: .55,
    knockback: 7.5, style: 'melee', lunge: 6, outcome: 'wallBounce', hitstop: HITSTOP.heavy },
  llh: { name: '', duration: .72, contacts: [.27], damage: 40, range: 2.4, radius: .85, stamina: 16, cooldown: 1.2, stun: .6,
    knockback: 1.6, style: 'melee', lunge: 5, outcome: 'launch', lift: 8.6, hitstop: HITSTOP.heavy },
  lllh: { name: '', duration: .86, contacts: [.36], damage: 64, range: 2.6, radius: .9, stamina: 20, cooldown: 1.4, stun: .8,
    knockback: 6, style: 'melee', lunge: 6, outcome: 'knockdown', hitstop: HITSTOP.heavy },
  llls: { name: '', duration: .9, contacts: [.36], damage: 54, range: 2.6, radius: 1, stamina: 24, cooldown: 4, stun: .9,
    knockback: 1.2, style: 'melee', lunge: 5, outcome: 'dizzy', hitstop: HITSTOP.heavy },
  airHeavy: { name: '', duration: .62, contacts: [.24], damage: 48, range: 2.4, radius: .95, stamina: 16, cooldown: 1, stun: .6,
    knockback: 3, style: 'melee', lunge: 3, outcome: 'groundBounce', hitstop: HITSTOP.heavy, fling: true },
  airSpecial: { name: '', duration: .8, contacts: [.22], damage: 70, range: 0, radius: 3.4, stamina: 24, cooldown: 4, stun: .7,
    knockback: 7, style: 'field', plunge: 30, outcome: 'knockdown', hitstop: HITSTOP.heavy },
};

const ROWS: Partial<Record<FighterId, ComboRow>> = { toji:TOJI_COMBOS,crocodile:CROCODILE_COMBOS,usopp:USOPP_COMBOS,rengoku:RENGOKU_COMBOS,sakura:SAKURA_COMBOS,meliodas:MELIODAS_COMBOS,escanor:ESCANOR_COMBOS,tatsumaki:TATSUMAKI_COMBOS,makima:MAKIMA_COMBOS,kenpachi:KENPACHI_COMBOS,minato:MINATO_COMBOS,'nico-robin':NICO_ROBIN_COMBOS,'kaiju-no-8':KAIJU_COMBOS,eren:EREN_COMBOS,asuka:ASUKA_COMBOS,netero:NETERO_COMBOS,shinji:SHINJI_COMBOS,jolyne:JOLYNE_COMBOS,'might-guy':MIGHT_GUY_COMBOS,akame:AKAME_COMBOS,pikachu:PIKACHU_COMBOS,garou:GAROU_COMBOS,esdeath:ESDEATH_COMBOS,mikasa:MIKASA_COMBOS,'alphonse-elric':ALPHONSE_ELRIC_COMBOS,'ken-kaneki':KANEKI_COMBOS,grimmjow:GRIMMJOW_COMBOS,byakuya:BYAKUYA_COMBOS,yamamoto:YAMAMOTO_COMBOS,pain:PAIN_COMBOS,'edward-elric':EDWARD_ELRIC_COMBOS,hiei:HIEI_COMBOS,aokiji:AOKIJI_COMBOS,doflamingo:DOFLAMINGO_COMBOS,hisoka:HISOKA_COMBOS,blackbeard:BLACKBEARD_COMBOS,nanami:NANAMI_COMBOS,josuke:JOSUKE_COMBOS,tsunade:TSUNADE_COMBOS,jiraiya:JIRAIYA_COMBOS,hinata:HINATA_COMBOS,gintoki:GINTOKI_COMBOS,kizaru:KIZARU_COMBOS,yamato:YAMATO_COMBOS, jinbe:JINBE_COMBOS,enel:ENEL_COMBOS, yuta: YUTA_COMBOS, rukia: RUKIA_COMBOS, yuji:YUJI_COMBOS, todoroki: TODOROKI_COMBOS, endeavor: ENDEAVOR_COMBOS, yoruichi: YORUICHI_COMBOS, 'all-might': ALL_MIGHT_COMBOS, bakugo: BAKUGO_COMBOS, deku: DEKU_COMBOS, ...SHOP_COMBOS, ...VOL1_COMBOS, broly: BROLY_COMBOS, denji: DENJI_COMBOS, akainu: AKAINU_COMBOS, mihawk: MIHAWK_COMBOS, nami: NAMI_COMBOS, 'boa-hancock': BOA_HANCOCK_COMBOS };

const cache = new Map<string, MoveDefinition>();
function tempo(fighter: FighterId) { return Math.min(1.3, Math.max(.85, MOVES[fighter].light.duration / .46)); }
export function hasCombos(fighter: FighterId) { return !!ROWS[fighter]; }
export function comboMove(fighter: FighterId, key: ComboKey, awakened = false): MoveDefinition | undefined {
  const base = ROWS[fighter]?.[key]; if (!base) return undefined;
  const form = awakened ? ROWS[fighter]?.awakened?.[key] : undefined, row = form ? { ...base, ...form } : base;
  const id = `${fighter}:${key}:${form ? 1 : 0}`; const known = cache.get(id); if (known) return known;
  const t = TEMPLATE[key], k = tempo(fighter);
  const move: MoveDefinition = { ...t, duration: +(t.duration * k).toFixed(3), contacts: t.contacts.map(c => +(c * k).toFixed(3)), ...row, ender: true };
  cache.set(id, move);
  return move;
}

export function comboKeyFor(fighter: FighterId, slot: AttackSlot, stage: number, airborne: boolean): ComboKey | undefined {
  if (!ROWS[fighter] || (slot !== 'heavy' && slot !== 'special')) return undefined;
  if (airborne) return slot === 'heavy' ? 'airHeavy' : 'airSpecial';
  if (slot === 'heavy') return stage === 0 ? 'lh' : stage === 1 ? 'llh' : stage === 2 ? 'lllh' : undefined;
  return stage === 2 ? 'llls' : undefined;
}

export const OUTCOME_WORDS: Partial<Record<Outcome, string>> = {
  launch: 'Launches', knockdown: 'Knocks down', dizzy: 'Stuns', wallBounce: 'Blows back', groundBounce: 'Spikes', hop: 'Pops up',
  stagger: 'Staggers', spin: 'Spins out', crumple: 'Crumples',
};
