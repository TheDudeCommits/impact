import { comboMove, type ComboKey } from '../game/combos';
import { awakeningSwapAt, moveFor, rushMove } from '../game/awakening';
import { activeWindow, type MoveDefinition } from '../game/moves';
import { barrageWindow } from '../game/timeStopBarrage';
import type { AttackSlot, CombatEvent, FighterId } from '../game/types';
import type { AudioCue, CueLayer } from './cueTypes';
import SFX_LENGTHS_JSON from './data/sfxDurations.json';
import { SFX_PEAKS } from './sfxCues';
import { BANKAI } from './bankaiTiming';
import { planVoice } from './voicePlan';
import { POWER_SOUNDS, arrivesHeard, powerVoice } from './powerSound';
import { FAMILIES, familyOf, type FamilySound } from './sfxFamilies';
import { SIGNATURES } from './sfxSignatures';

export function planSfx(event: CombatEvent, awakened = false): CueLayer[] {
  const fighter = event.fighter, slot = event.slot;
  switch (event.kind) {
    case 'cast': return fighter && slot ? castLayers(context(event, fighter, slot, awakened)) : [];
    case 'release': return fighter && slot ? slot === 'area' ? areaRelease(event, fighter, awakened) : releaseLayers(context(event, fighter, slot, awakened)) : [];
    case 'impact': return fighter && slot === 'area' ? areaStrike(event, fighter, awakened) : [];
    case 'confirm': return fighter && slot ? confirmLayers(context(event, fighter, slot, awakened)) : [];
    case 'hit': return impactLayers(event, awakened);
    case 'guard-break': return [
      { cue: 'fx-guard-shatter', gain: .74, phase: 'impact' },
      ...impactLayers(event, awakened).map(layer => ({ ...layer, gain: round(layer.gain * .5) }))];
    case 'blocked': return blockedLayers(event, awakened);
    case 'just-guard': return parryLayers(event, awakened);
    case 'vanish': return [{ cue: 'fx-vanish', gain: .55, phase: 'release' }];
    case 'chase': return [{ cue: 'fx-chase', gain: .55, phase: 'release' }];
    case 'dodge': return [{ cue: pick(FAMILY.kick, seedOf(event)), gain: .3, rate: 1.12, phase: 'release' }];
    case 'tech': return [{ cue: 'fx-tech', gain: .45, phase: 'release' }];
    case 'land': return [{ cue: 'fx-land-heavy', gain: .62, phase: 'impact' }];
    case 'wall-splat': return [{ cue: 'fx-wall-splat', gain: .75, phase: 'impact' }];
    case 'ground-bounce': return [{ cue: 'fx-ground-bounce', gain: .66, phase: 'impact' }];
    case 'break': return [{ cue: 'fx-combo-break', gain: .62, phase: 'impact' }];
    case 'projectile-clash': return clashLayers(event);
    case 'awaken': return fighter ? awakenLayers(fighter) : [];
    case 'awaken-end': return [{ cue: 'fx-awaken-end', gain: .42, phase: 'release' }];
    default: return [];
  }
}


export const FAMILY = {
  jab: ['fx-swing-jab-1', 'fx-swing-jab-2', 'fx-swing-jab-3', 'fx-swing-jab-4'],
  kick: ['fx-swing-kick-1', 'fx-swing-kick-2', 'fx-swing-kick-3'],
  heavy: ['fx-swing-heavy-1', 'fx-swing-heavy-2'],
  hitLight: ['fx-hit-light-1', 'fx-hit-light-2', 'fx-hit-light-3', 'fx-hit-light-4'],
  hitHeavy: ['fx-hit-heavy-1', 'fx-hit-heavy-2', 'fx-hit-heavy-3'],
  hitKick: ['fx-hit-kick-1', 'fx-hit-kick-2', 'fx-hit-kick-3'],
  finisher: ['fx-hit-finisher-1', 'fx-hit-finisher-2'],
  barrage: ['fx-hit-barrage-1', 'fx-hit-barrage-2', 'fx-hit-barrage-3', 'fx-hit-barrage-4'],
  katana: ['fx-slash-katana-1', 'fx-slash-katana-2', 'fx-slash-katana-3'],
  cleaver: ['fx-slash-cleaver-1', 'fx-slash-cleaver-2'],
  nodachi: ['fx-slash-nodachi-1', 'fx-slash-nodachi-2'],
  dragonslayer: ['fx-slash-dragonslayer-1', 'fx-slash-dragonslayer-2'],
  kunai: ['fx-slash-kunai-1', 'fx-slash-kunai-2'],
  claw: ['fx-claw-1', 'fx-claw-2'],
  cut: ['fx-cut-1', 'fx-cut-2', 'fx-cut-3'],
  cutHeavy: ['fx-cut-heavy-1', 'fx-cut-heavy-2'],
  kiBlast: ['fx-ki-blast-1', 'fx-ki-blast-2', 'fx-ki-blast-3'],
  explosion: ['fx-explosion-1', 'fx-explosion-2'],
  energyHit: ['fx-energy-hit-1', 'fx-energy-hit-2'],
  fireWhoosh: ['fx-fire-whoosh-1', 'fx-fire-whoosh-2'],
  burn: ['fx-burn-tick-1', 'fx-burn-tick-2'],
  zap: ['fx-zap-1', 'fx-zap-2', 'fx-zap-3'],
  knifeThrow: ['fx-knife-throw-1', 'fx-knife-throw-2'],
  knifeHit: ['fx-knife-hit-1', 'fx-knife-hit-2'],
  stretch: ['fx-stretch-1', 'fx-stretch-2'],
  snap: ['fx-snap-1', 'fx-snap-2'],
  armour: ['fx-armour-1', 'fx-armour-2'],
  beastSwipe: ['fx-beast-swipe-1', 'fx-beast-swipe-2'],
  block: ['fx-block-1', 'fx-block-2'],
  poof: ['fx-poof-1', 'fx-poof-2'],
  zip: ['fx-zip-1', 'fx-zip-2'],
} as const satisfies Record<string, readonly AudioCue[]>;
type Family = readonly AudioCue[];


type Blow = 'fist' | 'kick' | 'axe' | 'blade' | 'rubber' | 'stand' | 'beast';
const BLADE: Partial<Record<FighterId, Family>> = {
  toji:FAMILY.kunai,
  crocodile:FAMILY.kunai,
  sakura:FAMILY.jab,
  meliodas:FAMILY.katana,
  escanor:FAMILY.cleaver,
  tatsumaki:FAMILY.jab,
  makima:FAMILY.jab,
  kenpachi:FAMILY.cleaver,
  minato:FAMILY.jab,
  'nico-robin':FAMILY.hitLight,
  'kaiju-no-8':FAMILY.armour,
  eren:FAMILY.katana,
  asuka:FAMILY.armour,
  netero:FAMILY.jab,
  shinji:FAMILY.armour,
  jolyne:FAMILY.jab,
  'might-guy':FAMILY.jab,
  akame:FAMILY.katana,
  pikachu:FAMILY.jab,
  garou:FAMILY.jab,
  esdeath:FAMILY.kunai,
  mikasa:FAMILY.katana,
  'alphonse-elric':FAMILY.armour,
  'ken-kaneki':FAMILY.beastSwipe,
  grimmjow:FAMILY.jab,
  byakuya:FAMILY.katana,
  rengoku:FAMILY.katana,
  yamamoto:FAMILY.katana,
  pain:FAMILY.kunai,
  'edward-elric':FAMILY.jab,
  hiei:FAMILY.katana,
  aokiji:FAMILY.katana,
  doflamingo:FAMILY.kunai,
  hisoka:FAMILY.kunai,
  rukia:FAMILY.katana,
  yuta:FAMILY.katana,
  denji: ['fx-denji-saw-1','fx-denji-saw-2'],
  mihawk: FAMILY.dragonslayer,
  zoro: FAMILY.katana, sasuke: FAMILY.katana, ichigo: FAMILY.cleaver, law: FAMILY.nodachi,
  guts: FAMILY.dragonslayer, kakashi: FAMILY.kunai, killua: FAMILY.claw,
  whitebeard: FAMILY.dragonslayer, shanks: FAMILY.katana, roger: FAMILY.katana,
  aizen: FAMILY.katana, sukuna: FAMILY.katana, griffith: FAMILY.katana,
  itachi: FAMILY.kunai,
  tanjiro: FAMILY.katana, levi: FAMILY.katana, 'sung-jinwoo': FAMILY.kunai,
};
const FORM_BLADE: Partial<Record<FighterId, Family>> = { eren: FAMILY.armour };
const FORM_STAGES: Partial<Record<FighterId, readonly [Blow, Blow, Blow, Blow]>> = { eren: ['fist', 'fist', 'fist', 'fist'] };
const bladeOf = (c: Ctx): Family | undefined => (c.awakened ? FORM_BLADE[c.fighter] : undefined) ?? BLADE[c.fighter];
const STAGES: Record<FighterId, readonly [Blow, Blow, Blow, Blow]> = {
  toji:['blade','kick','blade','blade'],
  usopp:['fist','fist','kick','fist'],
  crocodile:['blade','blade','fist','blade'],
  sakura:["fist","fist","fist","fist"],
  meliodas:['blade','blade','fist','blade'],
  escanor:['axe','axe','fist','fist'],
  tatsumaki:['fist','fist','fist','fist'],
  makima:['fist','fist','fist','fist'],
  kenpachi:['blade','blade','blade','blade'],
  minato:['blade','fist','blade','fist'],
  'nico-robin':['fist','fist','fist','fist'],
  'kaiju-no-8':['fist','fist','fist','fist'],
  eren:['blade','blade','kick','blade'],
  asuka:['blade','fist','fist','blade'],
  netero:['fist','fist','fist','fist'],
  shinji:['fist','fist','fist','fist'],
  jolyne:['stand','stand','stand','stand'],
  'might-guy':['fist','kick','fist','kick'],
  akame:['blade','blade','blade','blade'],
  pikachu:['fist','kick','fist','fist'],
  garou:['fist','fist','fist','fist'],
  esdeath:['blade','blade','fist','blade'],
  mikasa:['blade','blade','blade','blade'],
  'alphonse-elric':['fist','fist','fist','fist'],
  'ken-kaneki':['fist','beast','beast','beast'],
  grimmjow:['fist','beast','fist','beast'],
  byakuya:['blade','blade','blade','blade'],
  rengoku:['blade','blade','blade','blade'],
  yamamoto:['blade','blade','blade','blade'],
  pain:['blade','blade','fist','blade'],
  'edward-elric':['fist','blade','fist','fist'],
  hiei:["blade","blade","blade","blade"],
  aokiji:['blade','kick','fist','fist'],
  doflamingo:['blade','kick','blade','blade'],
  hisoka:['blade','blade','blade','fist'],
  blackbeard:['fist','fist','fist','fist'],
  nanami:['blade','blade','blade','blade'],josuke:['stand','stand','stand','stand'],
  tsunade:['fist','fist','fist','kick'],jiraiya:['fist','fist','fist','fist'],
  hinata:['fist','fist','fist','fist'],gintoki:['axe','axe','axe','axe'],
  kizaru:['kick','kick','kick','kick'],yamato:['axe','axe','axe','axe'],
  jinbe:['fist','fist','fist','fist'],enel:['axe','axe','axe','axe'],
  rukia:['blade','blade','blade','blade'],
  yuta:['blade','blade','blade','blade'],
  yuji:['fist','fist','fist','fist'],
  todoroki:['fist','fist','fist','fist'],endeavor:['fist','fist','fist','fist'],yoruichi:['fist','fist','fist','fist'],
  'all-might': ['fist','fist','fist','axe'],
  bakugo: ['fist','fist','fist','fist'],
  deku: ['fist','kick','fist','fist'],
  broly: ['fist','fist','fist','fist'],
  denji: ['blade','blade','blade','blade'],
  akainu: ['fist','fist','fist','axe'],
  'boa-hancock': ['kick', 'kick', 'kick', 'kick'],
  nami: ['axe','axe','axe','axe'],
  mihawk: ['blade','blade','blade','blade'],
  goku: ['fist', 'fist', 'fist', 'axe'],
  vegeta: ['fist', 'kick', 'fist', 'axe'],
  naruto: ['fist', 'fist', 'fist', 'kick'],
  sasuke: ['blade', 'blade', 'blade', 'kick'],
  kakashi: ['blade', 'blade', 'kick', 'kick'],
  luffy: ['rubber', 'kick', 'rubber', 'rubber'],
  zoro: ['blade', 'blade', 'blade', 'blade'],
  sanji: ['kick', 'kick', 'kick', 'kick'],
  ace: ['fist', 'fist', 'fist', 'fist'],
  law: ['blade', 'blade', 'blade', 'blade'],
  jotaro: ['stand', 'stand', 'stand', 'stand'],
  dio: ['stand', 'stand', 'kick', 'kick'],
  ichigo: ['blade', 'blade', 'blade', 'blade'],
  gojo: ['fist', 'fist', 'kick', 'fist'],
  guts: ['blade', 'blade', 'blade', 'blade'],
  killua: ['blade', 'blade', 'kick', 'kick'],
  kaido: ['axe', 'axe', 'axe', 'axe'],
  whitebeard: ['blade', 'blade', 'blade', 'fist'],
  shanks: ['blade', 'blade', 'blade', 'blade'],
  roger: ['blade', 'blade', 'blade', 'blade'],
  aizen: ['fist', 'fist', 'blade', 'fist'],
  sukuna: ['blade', 'blade', 'blade', 'fist'],
  griffith: ['blade', 'blade', 'blade', 'blade'],
  meruem: ['beast', 'fist', 'kick', 'beast'],
  'goku-black': ['fist', 'fist', 'kick', 'kick'],
  jiren: ['fist', 'fist', 'fist', 'kick'],
  'golden-frieza': ['fist', 'beast', 'fist', 'beast'],
  'gohan-beast': ['fist', 'fist', 'kick', 'fist'],
  saitama: ['fist', 'fist', 'fist', 'kick'],
  akaza: ['fist', 'fist', 'kick', 'kick'],
  itachi: ['blade', 'blade', 'kick', 'fist'],
  madara: ['axe', 'fist', 'kick', 'fist'],
  tanjiro: ['blade', 'blade', 'blade', 'blade'],
  levi: ['blade', 'blade', 'kick', 'blade'],
  'sung-jinwoo': ['blade', 'blade', 'kick', 'fist'],
  gon: ['fist', 'fist', 'kick', 'fist'],
};
const AIR_KICKS = new Set(['Air Knee', 'Air Kick', 'Air Smash', 'Falling Kick']);
export const AIR_BLOWS: Readonly<Record<string, string>> = {
  'Rising Saw':'blade','Aerial Reverse Rake':'blade','Descending Crosscut':'blade',
  'Eruption Uppercut':'fist','Aerial Magma Backfist':'fist','Molten Descent':'axe',
  'Empress Rising Heel': 'kick', 'Perfume Air Kick': 'kick', 'Empress Heel Drop': 'kick',
  'Rising Clima-Tact': 'axe', 'Aerial Staff Backcut': 'axe', 'Descending Clima-Tact': 'axe',
  'Rising Yoru': 'blade', 'Aerial Backcut': 'blade', 'Descending Black Blade': 'blade',
  'Uzumaki Strike': 'kick', 'Rendan Knee': 'kick', 'Naruto Rendan': 'kick',
  'Afterimage Strike': 'fist', 'Meteor Crash': 'fist',
  'Galick Palm': 'fist', 'Sledgehammer': 'axe',
  'Gum-Gum Bullet': 'rubber', 'Gum-Gum Jet Pistol': 'rubber',
  'Flanchet Shot': 'kick', 'Party Table Kick Course': 'kick',
  'Star Breaker': 'stand', 'Ora Ora Rush': 'stand',
  'Weak! Weak!': 'stand', 'Muda Kick': 'kick',
  'Flying Kick': 'kick', 'Aerial Elbow': 'fist', 'Two-Fisted Slam': 'rubber', 'Côtelette': 'kick',
  'Flying Side Kick': 'kick', 'Snap Kick': 'kick', 'Somersault Kick': 'kick',
  'Aerial Slash': 'blade', 'Falling Cut': 'blade', 'Heel Drop': 'kick', 'Spinning Cut': 'kick',
  'Twin Blade Cut': 'blade', 'Overhead Cross Cut': 'blade', 'Leaping Cut': 'blade',
  'Jumping Hook': 'stand', 'Diving Straight': 'stand',
  'Aerial Cut': 'blade', 'Backhand Cut': 'blade', 'Overhead Cut': 'blade',
  'Leaping Punch': 'fist', 'Hooking Punch': 'fist', 'Diving Fist': 'fist',
  'Jumping Cut': 'blade', 'Kikoku Sweep': 'blade', 'Kikoku Drop': 'blade',
  'Flying Punch': 'fist', 'High Kick': 'kick', 'Diving Strike': 'fist',
  'Crushing Straight': 'stand',
  'Aerial Cleave': 'axe', 'Rising Swing': 'axe', 'Falling Chop': 'axe',
  'Whip Kick': 'kick', 'Claw Swipe': 'fist', 'Flip Kick': 'kick',
};

interface Ctx {
  event: CombatEvent; fighter: FighterId; slot: AttackSlot; stage: number;
  move: MoveDefinition; awakened: boolean; seed: number; air: boolean;
}

function context(event: CombatEvent, fighter: FighterId, slot: AttackSlot, awakened: boolean): Ctx {
  const stage = slot === 'light' ? event.chain ?? 0 : 0;
  const ender = event.branch ? comboMove(fighter, event.branch, awakened) : undefined;
  const move = ender ?? (slot === 'light' && stage > 0 ? rushMove(fighter, stage, awakened) : moveFor(fighter, slot, awakened));
  return { event, fighter, slot, stage, move, awakened, seed: seedOf(event), air: AIR_KICKS.has(event.move ?? '') };
}


function castLayers(c: Ctx): CueLayer[] {
  if (c.event.branch === 'airSpecial') return [{ cue: pick(FAMILY.heavy, c.seed), gain: .46, delay: .08, phase: 'cast', rate: .82 }];
  const special = c.event.branch ? ENDER_CASTS[c.fighter]?.[c.event.branch] : SIGNATURE_CASTS[c.fighter]?.[c.slot];
  if (c.slot === 'area' && !special) return areaCast(c);
  const layers = special ? special(c) : c.move.style === 'melee' ? meleeSwings(c) : energyCast(c);
  return [...layers, ...awakenedCast(c), ...familyCast(c, layers), ...signatureCast(c), ...ultimateOpener(c)];
}

const hugeOn = (c: Ctx, gain = .4) => onBeat('fx-swing-huge', gain, c0(c) + .02);
const ULTIMATE_OPENERS: Partial<Record<FighterId, (c: Ctx) => CueLayer[]>> = {
  bakugo: c => [onBeat('fx-fire-burst', .32, Math.max(.06, c0(c) - .12)), hugeOn(c, .36)],
  broly: c => [bed('fx-ki-charge-big', .2, 0, c0(c)), hugeOn(c, .46)],
  deku: c => [bed('fx-electric-bed', .12, 0, c0(c)), hugeOn(c, .38), onBeat('fx-wind-blast', .26, c0(c) + .03)],
  'all-might': c => [hugeOn(c, .38), onBeat('fx-wind-blast', .26, c0(c) + .03)],
  crocodile: c => [onBeat('fx-wind-blast', .34, c0(c)), hugeOn(c, .26)],
  denji: c => [onBeat('fx-denji-rev', .34, Math.max(.06, c0(c) - .15)), hugeOn(c, .3)],
  hisoka: c => [hugeOn(c, .34)],
  'nico-robin': c => [onBeat('fx-stretch-2', .26, Math.max(.06, c0(c) - .06)), onBeat('fx-snap-2', .3, c0(c)), hugeOn(c, .3)],
  ...Object.fromEntries((['asuka', 'might-guy', 'tatsumaki', 'garou', 'jolyne', 'gintoki', 'minato', 'kaiju-no-8', 'esdeath', 'akame', 'netero',
    'toji', 'doflamingo', 'grimmjow', 'shinji', 'makima', 'kenpachi'] as const).map(id => [id, (c: Ctx) => [hugeOn(c)]])),
};
function ultimateOpener(c: Ctx): CueLayer[] { return c.slot === 'ultimate' && !c.event.branch ? ULTIMATE_OPENERS[c.fighter]?.(c) ?? [] : []; }

const signatureOf = (c: Ctx) => { const row = c.event.branch ? undefined : SIGNATURES[c.fighter]?.[c.slot]; return row?.base && c.awakened ? undefined : row; };
function signatureCast(c: Ctx): CueLayer[] {
  const signature = signatureOf(c), jump = teleportOf(c.move);
  return (signature?.cast ?? []).map(([cue, gain, when, rate = 1]) =>
    onBeat(cue, gain, when === 'contact' ? c0(c) ?? 0 : when === 'vanish' ? jump?.vanish ?? 0 : when === 'appear' ? jump?.appear ?? 0 : when, 'cast', rate));
}
function signatureHit(c: Ctx, final: boolean): CueLayer[] {
  const signature = final ? signatureOf(c) : undefined;
  return (signature?.hit ?? []).map(([cue, gain]) => ({ cue, gain, rate: wobble(c.seed, .04), phase: 'impact' as const }));
}


const FAMILY_OVER = { cast: .8, hit: .75, tail: .8 };

const takeOf = (sound: FamilySound, seed: number): AudioCue => typeof sound.cue === 'string' ? sound.cue : pick(sound.cue, seed);
function onTheBeat(sounds: readonly FamilySound[], seed: number, time: number, phase: CueLayer['phase'], level = 1): CueLayer[] {
  return sounds.map((sound, i) => onBeat(takeOf(sound, seed + i), sound.gain * level, time + (sound.after ?? 0), phase, sound.rate ?? 1));
}
function fromNow(sounds: readonly FamilySound[], seed: number, level = 1, after = 0): CueLayer[] {
  return sounds.map((sound, i) => {
    const delay = round(after + (sound.after ?? 0));
    return { cue: takeOf(sound, seed + i), gain: round(sound.gain * level), rate: round((sound.rate ?? 1) * wobble(seed + i * 13, .05)), ...(delay > 0 ? { delay } : {}), phase: 'impact' as const };
  });
}
const strikeVoiced = (index: number, count: number) => count <= 3 || index === 0 || index >= count - 1 || index % 2 === 0;

function familyCast(c: Ctx, own: readonly CueLayer[]): CueLayer[] {
  if (c.slot === 'light' || c.slot === 'area' || c.event.branch) return [];
  const family = familyOf(c.fighter, c.slot, c.awakened);
  if (!family) return [];
  const sounds = FAMILIES[family], first = c0(c) ?? 0;
  const layers = [...onTheBeat(sounds.cast, c.seed, first, 'cast', FAMILY_OVER.cast),
    ...(c.move.style !== 'melee' ? onTheBeat(sounds.rush, c.seed + 5, first + .05, 'cast', FAMILY_OVER.cast) : [])];
  return layers.filter((layer, i) => !own.some(mine => mine.cue === layer.cue) && layers.findIndex(other => other.cue === layer.cue) === i);
}

function familyHit(c: Ctx, index: number, final: boolean, own: readonly CueLayer[]): CueLayer[] {
  if (c.slot === 'light' || c.slot === 'area' || c.event.branch) return [];
  const family = familyOf(c.fighter, c.slot, c.awakened);
  if (!family || !strikeVoiced(index, c.move.contacts.length)) return [];
  if (c.slot === 'ultimate' && c.move.confirm && index > 0 && !final) return [];
  const sounds = FAMILIES[family];
  const layers = [...fromNow(sounds.hit, c.seed, FAMILY_OVER.hit * (final ? 1 : .6)),
    ...(final && c.slot !== 'heavy' ? fromNow(sounds.tail, c.seed + 3, FAMILY_OVER.tail, .14) : [])];
  return layers.filter(layer => !own.some(mine => mine.cue === layer.cue));
}

function areaCast(c: Ctx): CueLayer[] {
  const family = familyOf(c.fighter, 'area', c.awakened), release = c0(c) ?? 0;
  const gather = family ? FAMILIES[family].cast : [];
  return [...(gather.length ? [] : [bed('fx-ki-charge', .17, 0, release)]), ...onTheBeat(gather, c.seed, release, 'cast')];
}

function areaRelease(event: CombatEvent, fighter: FighterId, awakened = false): CueLayer[] {
  const family = familyOf(fighter, 'area', awakened);
  if (!family) return [];
  const telegraph = Math.max(.1, (event.due ?? event.serverTime + .75) - event.serverTime);
  return onTheBeat(FAMILIES[family].rush, seedOf(event), telegraph, 'release', .9);
}

function areaStrike(event: CombatEvent, fighter: FighterId, awakened = false): CueLayer[] {
  const family = familyOf(fighter, 'area', awakened);
  const index = event.contactIndex ?? 0, count = Math.max(1, event.strikes ?? 1), last = index >= count - 1;
  if (!family || !strikeVoiced(index, count)) return [];
  const sounds = FAMILIES[family], seed = seedOf(event);
  return [...fromNow(sounds.hit, seed, count > 1 && !last ? .7 : 1), ...(last ? fromNow(sounds.tail, seed + 3, 1, .14) : []), ...floorBlow(sounds.weight)];
}
function floorBlow(weight: number): CueLayer[] {
  return weight > 0 ? [{ cue: 'fx-land-heavy', gain: round(.56 * weight), rate: .8, phase: 'impact' }, { cue: 'crack', gain: round(.3 * weight), rate: .55, phase: 'impact' }]
    : [{ cue: 'fx-land-heavy', gain: .2, rate: .8, phase: 'impact' }];
}

function areaBlow(c: Ctx): CueLayer[] {
  const family = familyOf(c.fighter, 'area', c.awakened);
  return !family || family === 'ki' ? [{ cue: pick(FAMILY.energyHit, c.seed), gain: .55, rate: wobble(c.seed, .05) }]
    : [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .44, rate: wobble(c.seed, .06) }];
}

function meleeSwings(c: Ctx): CueLayer[] {
  const blow = blowOf(c), heavy = c.slot !== 'light' || c.stage === 3;
  const layers: CueLayer[] = [];
  c.move.contacts.forEach((time, i) => {
    if(c.slot==='ultimate'&&c.move.confirm&&!c.event.branch&&i>(c.move.timeStop?.contact??0))return;
    const last = i === c.move.contacts.length - 1;
    layers.push(...swing(c, blow, time, heavy && last, i));
  });
  if (c.slot === 'light') {
    if (c.fighter === 'naruto' && !c.awakened && (c.stage === 1 || c.stage === 2)) {
      layers.push({ cue: pick(FAMILY.poof, c.seed), gain: .34, phase: 'cast' });
      if (c.stage === 2) layers.push({ cue: pick(FAMILY.poof, c.seed, 1), gain: .28, delay: .06, phase: 'cast' });
    }
    if (c.stage === 3 && c.fighter === 'zoro') layers.push(onBeat('fx-wind-blast', .34, c.move.contacts[0] + .04));
    if (c.stage === 3 && c.fighter === 'gojo') layers.push(bed('fx-purple-charge', .16, .02, c.move.contacts[0]));
    if (c.stage === 3 && c.fighter === 'law') layers.push({ cue: 'fx-shambles', gain: .4, delay: .05, phase: 'cast' });
    if (c.stage === 3 && c.fighter === 'ichigo') layers.push(onBeat('fx-getsuga', .32, c.move.contacts[0]));
    if (c.stage === 3 && c.fighter === 'kakashi') layers.push(onBeat(pick(FAMILY.zap, c.seed), .3, c.move.contacts[0]));
  }
  return layers;
}

function blowOf(c: Ctx): Blow {
  if (c.fighter === 'naruto' && c.awakened) return 'beast';
  if (c.air) return 'kick';
  const air = AIR_BLOWS[c.event.move ?? ''] as Blow | undefined;
  if (air) return air;
  if (c.slot === 'light') return ((c.awakened ? FORM_STAGES[c.fighter] : undefined) ?? STAGES[c.fighter])[Math.min(3, c.stage)];
  if (bladeOf(c)) return 'blade';
  if (c.fighter === 'sanji') return 'kick';
  if (c.fighter === 'luffy') return 'rubber';
  if (c.fighter === 'jotaro' || c.fighter === 'dio') return 'stand';
  return 'axe';
}

function swing(c: Ctx, blow: Blow, time: number, weight: boolean, index: number): CueLayer[] {
  const seed = c.seed + index * 7, rate = wobble(seed, .04);
  switch (blow) {
    case 'fist': case 'stand':
      return [onBeat(weight ? pick(FAMILY.heavy, seed) : pick(FAMILY.jab, seed, index), weight ? .5 : .44, time, 'cast', rate)];
    case 'axe':
      return [onBeat(pick(FAMILY.heavy, seed, index), .52, time, 'cast', rate)];
    case 'kick':
      return [onBeat(weight ? pick(FAMILY.heavy, seed) : pick(FAMILY.kick, seed, index), weight ? .52 : .46, time, 'cast', rate)];
    case 'beast':
      return [onBeat(pick(FAMILY.beastSwipe, seed, index), .55, time, 'cast', rate * (weight ? .9 : 1))];
    case 'rubber':
      return [
        onBeat(pick(FAMILY.stretch, seed), weight ? .4 : .34, Math.max(.06, time - .09), 'cast', weight ? .8 : 1),
        onBeat(weight ? pick(FAMILY.heavy, seed) : pick(FAMILY.jab, seed, index), weight ? .46 : .4, time, 'cast', rate),
        onBeat(pick(FAMILY.snap, seed), .3, time + .06, 'cast', wobble(seed, .06))];
    case 'blade': {
      const family = bladeOf(c) ?? FAMILY.katana;
      const big = family === FAMILY.dragonslayer;
      const layers = [onBeat(pick(family, seed, index), big ? .6 : .46, time, 'cast', rate * (weight && big ? .9 : 1))];
      if (c.fighter === 'zoro') layers.push(onBeat(pick(family, seed, index + 1), .34, time + .018, 'cast', rate * 1.04));
      if (c.fighter === 'zoro' && (weight || c.awakened)) layers.push(onBeat(pick(family, seed, index + 2), .3, time + .034, 'cast', rate * .96));
      if (c.fighter === 'killua') layers.push(onBeat(pick(FAMILY.zap, seed), .14, time));
      if (weight && !big && c.fighter !== 'killua' && c.fighter !== 'kakashi') layers.push(onBeat(pick(FAMILY.heavy, seed), .3, time, 'cast', .92));
      return layers;
    }
  }
}

function energyCast(c: Ctx): CueLayer[] {
  const first = c.move.contacts[0];
  const big = c.slot === 'ultimate';
  const own = familyOf(c.fighter, c.slot, c.awakened), gathers = !!own && FAMILIES[own].cast.length > 0 && !FAMILIES[own].explodes;
  const layers: CueLayer[] = gathers ? [] : [bed(big ? 'fx-ki-charge-big' : 'fx-ki-charge', big ? .22 : .17, 0, first)];
  if (c.move.style === 'projectile') c.move.contacts.forEach((time, i) => layers.push(onBeat(pick(FAMILY.kiBlast, c.seed, i), .48, time)));
  if (c.move.style === 'bomb') layers.push(onBeat('fx-ki-launch', .55, first), onBeat('fx-swing-huge', .36, first + .05));
  if (c.move.style === 'field' && (!own || own === 'fire' || own === 'magma')) layers.push(onBeat('fx-fire-ignite', .4, first));
  return layers;
}

function awakenedCast(c: Ctx): CueLayer[] {
  if (!c.awakened) return [];
  const first = c.move.contacts[0] ?? 0;
  switch (c.fighter) {
    case 'luffy': return [{ cue: pick(FAMILY.poof, c.seed), gain: .2, phase: 'cast' }];
    case 'guts': return [{ cue: pick(FAMILY.armour, c.seed), gain: .32, phase: 'cast' }];
    case 'killua': return [onBeat(pick(FAMILY.zap, c.seed, 1), .2, first)];
    case 'gojo': return [onBeat(pick(FAMILY.zap, c.seed, 2), .13, first), onBeat(pick(FAMILY.zip, c.seed), .2, Math.max(.05, first - .05))];
    case 'law': return c.slot === 'ultimate' ? [] : [{ cue: 'fx-shambles', gain: .22, phase: 'cast' }];
    case 'sanji': case 'ace':
      return c.move.style === 'melee' ? [onBeat(pick(FAMILY.fireWhoosh, c.seed), .24, first)] : [];
    case 'sasuke': case 'kakashi':
      return c.move.style === 'melee' ? [onBeat(pick(FAMILY.heavy, c.seed, 1), .26, first, 'cast', .78)] : [];
    case 'goku': case 'vegeta': case 'ichigo': case 'zoro':
      return c.move.style === 'melee' && c.slot !== 'ultimate' ? [onBeat(pick(FAMILY.heavy, c.seed, 1), .2, first, 'cast', .86)] : [];
    default: return [];
  }
}


type Plan = (c: Ctx) => CueLayer[];
const c0 = (c: Ctx) => c.move.contacts[0];
const last = (c: Ctx) => c.move.contacts[c.move.contacts.length - 1];

function timeStop(c: Ctx, extra: CueLayer[] = []): CueLayer[] {
  const stop = c.move.timeStop!, at = c.move.contacts[stop.contact], resume = at + stop.duration;
  const layers: CueLayer[] = [onBeat('fx-timestop', .55, at)];
  for (let tick = at + .55; tick < resume - .35; tick += 1) layers.push({ cue: 'fx-timestop-tick', gain: .3, delay: round(tick), phase: 'cast' });
  const window = barrageWindow(c.move);
  if (window) layers.push(...barrageBed(window.start, window.end, .38));
  layers.push(onBeat('fx-timestop-resume', .6, resume), ...extra);
  return layers;
}
function timeStopCinematic(c: Ctx, extra: CueLayer[] = []): CueLayer[] {
  return timeStop(c, extra).slice(1);
}

function barrageBed(start: number, end: number, gain: number): CueLayer[] {
  const layers: CueLayer[] = [], length = sfxLength('fx-barrage') - .1;
  for (let from = Math.max(0, start - .05); from < end; from += length - .15) {
    const duration = Math.min(length, end + .12 - from);
    if (duration < .15) break;
    layers.push({ cue: 'fx-barrage', gain, delay: round(from), duration: round(duration), phase: 'cast' });
  }
  return layers;
}

const SIGNATURE_CASTS: Partial<Record<FighterId, Partial<Record<AttackSlot, Plan>>>> = {
  toji:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.18,c0(c))],special:c=>[onBeat('fx-dash',.13,.08),...meleeSwings(c),onBeat('fx-slash-kunai-1',.20,c0(c))],ultimate:c=>meleeSwings(c)},
  usopp:{light:c=>[onBeat('fx-stretch-1',.32,Math.max(.04,c0(c)-.05)),onBeat('fx-snap-1',.42,c0(c)),...(c.stage===3?[onBeat(pick(FAMILY.heavy,c.seed),.34,c0(c)+.02)]:[])],heavy:c=>[onBeat('fx-stretch-2',.26,c0(c)),onBeat('fx-wind-blast',.3,c0(c))],special:c=>[onBeat('fx-snap-1',.12,c0(c)),onBeat('fx-fire-whoosh-1',.19,c0(c))],ultimate:c=>[onBeat('fx-stretch-2',.3,c0(c)-.06),onBeat('fx-snap-2',.4,c0(c)),onBeat('fx-swing-huge',.34,c0(c)+.03)]},
  crocodile:{light:c=>meleeSwings(c),heavy:c=>[onBeat('fx-wind-blast',.18,c0(c)),onBeat('fx-cut-2',.14,c0(c))],special:c=>[held('fx-wind-swirl',.13,.06,c0(c)),onBeat('fx-wind-blast',.19,c0(c))],ultimate:c=>[held('fx-wind-swirl',.11,.08,c0(c))]},
  sakura:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-land-heavy',.2,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-hit-heavy-1',.22,c0(c))],ultimate:c=>meleeSwings(c)},
  meliodas:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.2,c0(c))],special:c=>[onBeat('fx-fire-burst',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  escanor:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-swing-huge',.2,c0(c))],special:c=>[onBeat('fx-fire-burst',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  tatsumaki:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.2,c0(c))],special:c=>[onBeat('fx-wind-blast',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  makima:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-energy-hit-1',.18,c0(c))],special:c=>[onBeat('fx-counter-shock',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  kenpachi:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.22,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-dash',.18,.08)],ultimate:c=>meleeSwings(c)},
  minato:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),held('fx-wind-swirl',.15,.08,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-dash',.22,.08)],ultimate:c=>meleeSwings(c)},
  'nico-robin':{light:c=>[...meleeSwings(c),onBeat('fx-stretch-1',.08,c0(c))],heavy:c=>[onBeat('fx-stretch-2',.12,c0(c)),onBeat('fx-snap-1',.12,c0(c))],special:c=>[onBeat('fx-wind-blast',.16,c0(c))],ultimate:c=>[onBeat('fx-stretch-1',.11,c0(c))]},
  'kaiju-no-8':{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-beast-swipe-1',.12,c0(c)),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.32,c0(c))],ultimate:c=>meleeSwings(c)},
  eren:{light:c=>meleeSwings(c),
    heavy:c=>c.awakened?[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))]:[onBeat(pick(FAMILY.zip,c.seed),.42,c0(c)-.02),onBeat(pick(FAMILY.kiBlast,c.seed),.3,c0(c))],
    special:c=>c.awakened?[onBeat('fx-wind-blast',.18,c0(c))]:[onBeat('fx-dash',.16,.08),onBeat(pick(FAMILY.zip,c.seed),.4,c0(c)*.3),onBeat(pick(FAMILY.zip,c.seed,1),.36,c0(c)*.6),onBeat('fx-swing-huge',.46,c0(c)-.02),onBeat(pick(FAMILY.katana,c.seed),.42,c0(c))],
    ultimate:c=>c.awakened?meleeSwings(c):[onBeat(pick(FAMILY.katana,c.seed),.46,c0(c))]},
  asuka:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[onBeat('fx-ki-blast-2',.2,c0(c))],ultimate:c=>meleeSwings(c)},
  netero:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[onBeat('fx-ki-blast-2',.2,c0(c))],ultimate:c=>meleeSwings(c)},
  shinji:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[onBeat('fx-ki-blast-2',.2,c0(c))],ultimate:c=>meleeSwings(c)},
  jolyne:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-dash',.10,c0(c))],special:c=>meleeSwings(c),ultimate:c=>meleeSwings(c)},
  'might-guy':{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-dash',.12,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.18,c0(c))],ultimate:c=>meleeSwings(c)},
  akame:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-sword-ring',.10,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-dash',.10,c0(c))],ultimate:c=>meleeSwings(c)},
  pikachu:{light:c=>[...meleeSwings(c),onBeat('fx-dash',.08,c0(c))],heavy:c=>[...meleeSwings(c),onBeat('fx-sword-ring',.10,c0(c))],special:c=>[held('fx-electric-bed',.08,0,c0(c)),onBeat('fx-lightning',.20,c0(c))],ultimate:c=>meleeSwings(c)},
  garou:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.10,c0(c))],special:c=>[...meleeSwings(c),held('fx-wind-swirl',.09,0,c0(c))],ultimate:c=>meleeSwings(c)},
  esdeath:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-guard-shatter',.12,c0(c))],special:c=>[held('fx-wind-swirl',.09,0,c0(c)),onBeat('fx-wind-blast',.20,c0(c))],ultimate:c=>meleeSwings(c)},
  mikasa:{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-wind-swirl',.07,.12,c0(c)),onBeat('fx-slash-kunai-1',.19,c0(c))],ultimate:c=>meleeSwings(c)},
  'alphonse-elric':{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[onBeat('fx-armour-1',.12,.3),held('fx-gather',.10,.2,c0(c)),onBeat('fx-ground-bounce',.19,c0(c))],ultimate:c=>meleeSwings(c)},
  'ken-kaneki':{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>meleeSwings(c),ultimate:c=>meleeSwings(c)},
  grimmjow:{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-gather',.13,.05,c0(c)),onBeat('fx-ki-launch',.21,c0(c))],ultimate:c=>meleeSwings(c)},
  byakuya:{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-wind-swirl',.10,.04,c0(c)),onBeat('fx-wind-blast',.18,c0(c))],ultimate:c=>meleeSwings(c)},
  rengoku:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-1',.20,c0(c))],special:c=>[held('fx-fire-bed',.12,.08,c0(c)),onBeat('fx-fire-burst',.24,c0(c))],area:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-1',.18,c0(c))],ultimate:c=>meleeSwings(c)},
  yamamoto:{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-fire-bed',.13,.08,c0(c)),onBeat('fx-fire-burst',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  pain:{light:c=>meleeSwings(c),heavy:c=>[held('fx-gather',.12,.08,c0(c)),onBeat('fx-wind-blast',.23,c0(c))],special:c=>[held('fx-gather',.14,.08,c0(c)),onBeat('fx-wind-swirl',.22,c0(c))],ultimate:c=>meleeSwings(c)},
  'edward-elric':{light:c=>meleeSwings(c),heavy:c=>meleeSwings(c),special:c=>[held('fx-gather',.13,.08,c0(c)),onBeat('fx-land-heavy',.24,c0(c))],ultimate:c=>meleeSwings(c)},
  hiei:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-1',.2,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-cut-2',.22,c0(c))],ultimate:c=>meleeSwings(c)},
  aokiji:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-guard-shatter',.2,c0(c))],special:c=>[onBeat('fx-wind-blast',.25,c0(c))],ultimate:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))]},
  doflamingo:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-cut-2',.2,c0(c))],special:c=>[onBeat('fx-knife-throw-2',.24,c0(c)),onBeat('fx-cut-2',.18,c0(c))],ultimate:c=>[...meleeSwings(c),onBeat('fx-stretch-2',.12,c0(c))]},
  hisoka:{heavy:c=>[...meleeSwings(c),onBeat('fx-snap-1',.21,c0(c))],special:c=>[onBeat('fx-knife-throw-2',.27,c0(c))],ultimate:c=>[...meleeSwings(c),onBeat('fx-stretch-2',.12,c0(c))]},
  blackbeard:{light:c=>meleeSwings(c),heavy:c=>[...meleeSwings(c),onBeat('fx-counter-shock',.22,c0(c))],special:c=>[bed('fx-gather',.12,.04,c0(c)),onBeat('fx-room',.25,c0(c))],ultimate:c=>[...meleeSwings(c),onBeat('fx-room',.15,c0(c))]},
  tsunade:{heavy:c=>[...meleeSwings(c),onBeat('fx-hit-finisher-1',.22,c0(c))],special:c=>[...meleeSwings(c),onBeat('fx-energy-hit-1',.19,c0(c))]},
  jiraiya:{heavy:c=>[bed('fx-gather',.12,.03,c0(c)),onBeat('fx-energy-hit-1',.22,c0(c))],special:c=>[bed('fx-fire-bed',.11,.16,c0(c)),onBeat('fx-fire-whoosh-2',.24,c0(c))]},
  hinata:{heavy:c=>[...meleeSwings(c),onBeat('fx-energy-hit-1',.14,c0(c))],special:c=>[bed('fx-gather',.12,.03,c0(c)),onBeat('fx-wind-blast',.24,c0(c))]},
  gintoki:{heavy:c=>meleeSwings(c),special:c=>[...meleeSwings(c),onBeat('fx-swing-huge',.2,c0(c))]},
  kizaru:{heavy:c=>[...meleeSwings(c),onBeat('fx-energy-hit-2',.17,c0(c))],special:c=>[bed('fx-ki-charge',.12,.03,c0(c)),onBeat('fx-ki-launch',.28,c0(c))]},
  yamato:{heavy:c=>[...meleeSwings(c),onBeat('fx-haki',.19,c0(c))],special:c=>[bed('fx-gather',.12,.04,c0(c)),onBeat('fx-wind-blast',.32,c0(c))]},
  rukia:{heavy:c=>[...meleeSwings(c),onBeat('fx-guard-shatter',.18,c0(c))],special:c=>[bed('fx-wind-swirl',.12,0,c0(c)),onBeat('fx-wind-blast',.28,c0(c))]},
  yuta:{special:c=>[bed('fx-gather',.12,0,c0(c)),onBeat('fx-energy-hit-2',.23,c0(c))]},
  yuji:{heavy:c=>[...meleeSwings(c),onBeat('fx-energy-hit-1',.16,c0(c))],special:c=>[bed('fx-gather',.12,.05,c0(c)),onBeat('fx-swing-heavy-2',.27,c0(c))]},
  todoroki:{heavy:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-1',.28,c0(c))],special:c=>[bed('fx-wind-swirl',.18,0,c0(c)),onBeat('fx-guard-shatter',.3,c0(c))]},
  jinbe:{heavy:c=>[...meleeSwings(c),onBeat('fx-wind-swirl',.19,c0(c))],special:c=>[bed('fx-gather',.11,.03,c0(c)),onBeat('fx-swing-heavy-2',.26,c0(c))]},
  enel:{heavy:c=>[...meleeSwings(c),onBeat('fx-electric-bed',.16,c0(c))],special:c=>[bed('fx-electric-bed',.13,.04,c0(c)),onBeat('fx-lightning',.48,c0(c))]},
  endeavor:{heavy:c=>[...meleeSwings(c),onBeat('fx-fire-whoosh-2',.3,c0(c))],special:c=>[bed('fx-fire-bed',.14,0,c0(c)),onBeat('fx-fire-whoosh-1',.3,c0(c))]},
  yoruichi:{heavy:c=>[...meleeSwings(c),onBeat('fx-electric-bed',.16,c0(c))],special:c=>[bed('fx-electric-bed',.14,.05,c0(c)),onBeat('fx-dash',.28,c0(c))]},
  'all-might':{light:meleeSwings,heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.14,c0(c))],special:c=>[onBeat('fx-swing-heavy-2',.32,c0(c)),onBeat('fx-wind-blast',.42,c0(c))],ultimate:c=>[onBeat('fx-swing-heavy-2',.3,c0(c))]},
  bakugo:{light:c=>[...meleeSwings(c),onBeat('fx-fire-burst',.14,c0(c))],heavy:c=>[...meleeSwings(c),onBeat('fx-fire-burst',.32,c0(c))],special:c=>[onBeat('fx-fire-burst',.3,c0(c)),onBeat('fx-wind-blast',.22,c0(c))],ultimate:c=>[onBeat('fx-swing-heavy-2',.25,c0(c))]},
  deku:{heavy:c=>[...meleeSwings(c),onBeat('fx-wind-blast',.15,c0(c))],special:c=>[onBeat('fx-wind-blast',.32,c0(c))],ultimate:c=>[onBeat('fx-swing-heavy-2',.25,c0(c))]},
  broly:{heavy:c=>[...meleeSwings(c),onBeat('fx-land-heavy',.24,c0(c))],special:c=>[bed('fx-ki-charge',.16,.05,c0(c)),onBeat('fx-ki-launch',.42,c0(c))],ultimate:c=>[onBeat('fx-swing-heavy-2',.3,c0(c))]},
  denji:{heavy:c=>[onBeat('fx-denji-saw-2',.38,c0(c))],special:c=>[onBeat('fx-denji-rev',.34,c0(c)),onBeat('fx-denji-saw-1',.25,c0(c))],ultimate:c=>[onBeat('fx-denji-saw-2',.38,c0(c))]},
  akainu:{heavy:c=>[...meleeSwings(c),onBeat('fx-fire-burst',.25,c0(c))],special:c=>[bed('fx-fire-roar',.12,.15,c0(c)),onBeat('fx-fire-burst',.45,c0(c))],ultimate:c=>[onBeat('fx-fire-burst',.32,c0(c))]},
  'boa-hancock': {
    light: c => c.move.style === 'melee' ? meleeSwings(c) : [onBeat('fx-zip-1', .5, c0(c), 'cast', 1.3)],
    heavy: c => meleeSwings(c),
    special: c => [bed('fx-wind-swirl', .12, 0, c0(c), 1.25), onBeat('fx-zip-2', .42, c0(c), 'cast', 1.25)],
    ultimate: c => [onBeat(pick(FAMILY.kick, c.seed), .5, c0(c))],
  },
  nami: {
    special: c => [bed('fx-wind-swirl', .2, .08, c0(c)), onBeat('fx-wind-blast', .42, c0(c))],
    ultimate: c => [bed('fx-electric-bed', .2, .05, c0(c)), onBeat('fx-lightning', .5, c0(c))],
  },
  mihawk: {
    heavy: c => [...meleeSwings(c),onBeat('fx-sword-ring',.16,c0(c)+.035)],
    special: c => [{cue:'fx-sword-ring',gain:.18,phase:'cast'},onBeat(pick(FAMILY.dragonslayer,c.seed),.55,c0(c)),onBeat('fx-slash-wave',.58,c0(c)+.025)],
    ultimate: c => [onBeat(pick(FAMILY.dragonslayer,c.seed),.6,c0(c),'cast',.91),onBeat('fx-slash-wave',.38,c0(c)+.02,'cast',.92)],
  },
  goku: {
    heavy: c => {
      const blink = teleportOf(c.move);
      if (!blink) return meleeSwings(c);
      return [onBeat(pick(FAMILY.zip, c.seed), .42, blink.vanish, 'cast', .92), onBeat('fx-vanish', .46, blink.appear),
        onBeat(pick(FAMILY.heavy, c.seed), .54, c0(c)), onBeat(pick(FAMILY.kick, c.seed), .3, c0(c) - .01, 'cast', .9)];
    },
    special: c => [bed('fx-ki-charge', .15, 0, c0(c))],
    ultimate: c => [bed('fx-ki-charge-big', .22, 0, c0(c)), bed('fx-gather', .16, 0, c0(c)),
      onBeat('fx-ki-launch', .55, c0(c)), onBeat('fx-swing-huge', .38, c0(c) + .1)],
  },
  vegeta: {
    light: c => c.move.style !== 'melee' ? energyCast(c)
      : c.stage === 0 && !c.air ? [...meleeSwings(c), onBeat(pick(FAMILY.zap, c.seed), .16, c0(c))] : meleeSwings(c),
    heavy: c => [bed('fx-ki-charge', .16, 0, c0(c)), onBeat('fx-ki-launch', .52, c0(c))],
    special: c => [bed('fx-ki-charge', .18, 0, c0(c))],
    ultimate: c => [bed('fx-ki-charge-big', .22, 0, c0(c))],
  },
  naruto: {
    heavy: c => c.awakened
      ? [onBeat(pick(FAMILY.beastSwipe, c.seed), .6, c0(c), 'cast', .86)]
      : [bed('fx-rasengan', .3, .06, c0(c) + .06), onBeat(pick(FAMILY.heavy, c.seed), .36, c0(c))],
    special: c => c.awakened
      ? [bed('fx-ki-charge', .16, 0, c0(c)), onBeat('fx-ki-launch', .5, c0(c))]
      : [bed('fx-rasengan', .14, .05, c0(c)), onBeat('fx-wind-blast', .3, c0(c) + .05)],
    ultimate: c => [bed('fx-ki-charge-big', .24, 0, c0(c)), onBeat('fx-ki-launch', .55, c0(c)), onBeat('fx-swing-huge', .34, c0(c) + .06),
      ...(c.awakened ? [{ cue: 'fx-beast-roar' as const, gain: .42, phase: 'cast' as const }] : [])],
  },
  sasuke: {
    heavy: c => [{ cue: pick(FAMILY.zap, c.seed), gain: .3, phase: 'cast' }, bed('fx-chidori', .26, .02, c0(c))],
    special: c => [onBeat('fx-fire-ignite', .42, c0(c), 'cast', .7),
      { cue: 'fx-black-flame', gain: .34, delay: c0(c), duration: round(c.move.duration - c0(c)), loop: true, phase: 'cast' }],
    ultimate: c => [...(c.awakened ? [] : [{ cue: 'fx-susanoo' as const, gain: .42, phase: 'cast' as const }]),
      bed('fx-electric-bed', .2, .1, c0(c)), onBeat('fx-lightning', .6, c0(c)), onBeat('fx-slash-wave', .35, c0(c) + .02)],
  },
  kakashi: {
    heavy: c => [{ cue: pick(FAMILY.zap, c.seed), gain: .3, phase: 'cast' }, bed('fx-chidori', .26, .02, c0(c))],
    special: c => [bed('fx-chidori', .28, 0, c0(c)), onBeat(pick(FAMILY.poof, c.seed), .34, c0(c)),
      onBeat(pick(FAMILY.zip, c.seed), .38, c0(c) + .05), onBeat(pick(FAMILY.zap, c.seed), .3, c0(c) + .06)],
    ultimate: c => [{ cue: 'fx-kamui', gain: .45, delay: .05, phase: 'cast' }, bed('fx-chidori', .3, .02, c0(c)),
      onBeat(pick(FAMILY.kunai, c.seed), .46, c0(c))],
  },
  luffy: {
    heavy: c => [onBeat(pick(FAMILY.stretch, c.seed), .4, c0(c) - .12, 'cast', .82),
      onBeat(pick(FAMILY.heavy, c.seed), .5, c0(c)), onBeat(pick(FAMILY.snap, c.seed), .34, c0(c) + .07)],
    special: c => [{ cue: 'fx-haki', gain: .4, delay: .08, phase: 'cast' }, ...barrageBed(c0(c), last(c), .3),
      onBeat(pick(FAMILY.stretch, c.seed), .32, c0(c) - .06, 'cast', 1.15),
      ...c.move.contacts.slice(0, -1).map((time, i) => onBeat(pick(FAMILY.snap, c.seed, i), .2, time, 'cast', 1.2)),
      onBeat(pick(FAMILY.heavy, c.seed), .46, last(c))],
    ultimate: c => [onBeat(pick(FAMILY.stretch, c.seed), .4, c0(c) - .1, 'cast', .7), onBeat('fx-swing-huge', .5, c0(c))],
  },
  zoro: {
    light: c => c.stage === 0 && !c.air ? [...meleeSwings(c), onBeat('fx-sword-ring', .2, c0(c) + .05)] : meleeSwings(c),
    heavy: c => [{ cue: 'fx-draw', gain: .36, delay: round(Math.max(0, c0(c) - .42)), phase: 'cast' },
      onBeat(pick(FAMILY.zip, c.seed), .4, c0(c) - .08), onBeat(pick(FAMILY.katana, c.seed), .52, c0(c)),
      onBeat(pick(FAMILY.katana, c.seed, 1), .36, c0(c) + .02), { cue: 'fx-sheathe', gain: .5, delay: round(c0(c) + .38), phase: 'cast' }],
    special: c => [bed('fx-wind-swirl', .24, .05, c0(c)), onBeat('fx-slash-wave', .55, c0(c)),
      onBeat(pick(FAMILY.katana, c.seed), .36, c0(c) - .02)],
    ultimate: c => [{ cue: 'fx-sword-ring', gain: .3, delay: round(Math.max(0, c0(c) - .35)), phase: 'cast' },
      onBeat(pick(FAMILY.katana, c.seed), .46, c0(c)), onBeat(pick(FAMILY.katana, c.seed, 1), .4, c0(c) + .02),
      onBeat(pick(FAMILY.katana, c.seed, 2), .36, c0(c) + .04), onBeat('fx-swing-huge', .3, c0(c))],
  },
  sanji: {
    heavy: c => [onBeat(pick(FAMILY.heavy, c.seed), .54, c0(c)), onBeat(pick(FAMILY.kick, c.seed), .3, c0(c) - .02, 'cast', .9)],
    special: c => [{ cue: 'fx-fire-ignite', gain: .46, delay: .1, phase: 'cast' }, bed('fx-fire-bed', .2, .4, c0(c)),
      onBeat(pick(FAMILY.kick, c.seed), .42, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .5, c0(c) + .03)],
    ultimate: c => [{ cue: 'fx-fire-ignite', gain: .5, delay: .06, phase: 'cast' }, bed('fx-fire-bed', .26, .1, c0(c)),
      onBeat(pick(FAMILY.heavy, c.seed), .5, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .4, c0(c))],
  },
  ace: {
    light: c => c.stage === 0 ? [...meleeSwings(c), onBeat('fx-embers', .38, c0(c) + .1)]
      : [...meleeSwings(c), onBeat(pick(FAMILY.fireWhoosh, c.seed), .26, c0(c))],
    heavy: c => [{ cue: 'fx-fire-ignite', gain: .36, delay: round(Math.max(0, c0(c) - .3)), phase: 'cast' },
      onBeat('fx-fire-roar', .46, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .5, c0(c) + .02)],
    special: c => [{ cue: 'fx-fire-ignite', gain: .42, delay: .12, phase: 'cast' }, bed('fx-fire-bed', .22, .12, c0(c)),
      onBeat('fx-fire-roar', .56, c0(c) + .05)],
    ultimate: c => [bed('fx-fire-bed', .24, 0, c0(c)), bed('fx-gather', .1, .3, c0(c)),
      { cue: 'fx-fire-ignite', gain: .42, delay: .3, phase: 'cast' }, onBeat('fx-fire-roar', .58, c0(c) + .06),
      onBeat('fx-swing-huge', .36, c0(c) + .1)],
  },
  law: {
    heavy: c => [onBeat(pick(FAMILY.zip, c.seed), .38, c0(c) - .2), onBeat(pick(FAMILY.nodachi, c.seed), .5, c0(c))],
    special: c => [{ cue: 'fx-room', gain: .4, phase: 'cast' }, bed('fx-electric-bed', .14, .1, c0(c)),
      onBeat(pick(FAMILY.zip, c.seed), .34, c0(c) - .06)],
    ultimate: c => [{ cue: 'fx-room', gain: .5, phase: 'cast' }, onBeat('fx-shambles', .46, c0(c) - .08),
      bed('fx-electric-bed', .2, .15, c0(c))],
  },
  jotaro: {
    heavy: c => [{ cue: 'fx-stand', gain: .34, phase: 'cast' }, onBeat(pick(FAMILY.zip, c.seed), .44, c0(c) + .02)],
    special: c => [{ cue: 'fx-stand', gain: .34, phase: 'cast' }, ...barrageBed(Math.min(.8, c0(c)), last(c) + .3, .36)],
    ultimate: c => [{ cue: 'fx-stand', gain: .3, phase: 'cast' }, timeStop(c)[0]],
  },
  dio: {
    heavy: c => [onBeat(pick(FAMILY.knifeThrow, c.seed), .46, c0(c)), onBeat(pick(FAMILY.knifeThrow, c.seed, 1), .34, c0(c) + .03, 'cast', 1.06)],
    special: c => [{ cue: 'fx-stand', gain: .34, phase: 'cast' }, ...barrageBed(Math.min(.8, c0(c)), last(c) + .3, .36)],
    ultimate: c => [{ cue: 'fx-stand', gain: .3, phase: 'cast' }, timeStop(c)[0]],
  },
  ichigo: {
    heavy: c => [onBeat(pick(FAMILY.zip, c.seed), .42, c0(c) - .2), onBeat(pick(FAMILY.cleaver, c.seed), .52, c0(c)),
      onBeat(pick(FAMILY.heavy, c.seed), .3, c0(c), 'cast', .9)],
    special: c => [bed('fx-ki-charge', .16, .05, c0(c), .8), { cue: 'fx-sword-ring', gain: .2, delay: .05, phase: 'cast' },
      onBeat('fx-getsuga', .6, c0(c))],
    ultimate: c => [bed('fx-ki-charge-big', .2, .05, c0(c), .8), { cue: 'fx-mugetsu', gain: .62, delay: round(Math.max(0, c0(c) - .32)), phase: 'cast' }],
  },
  gojo: {
    heavy: c => [bed('fx-purple-charge', .14, 0, c0(c), .8), onBeat(pick(FAMILY.zip, c.seed), .36, c0(c) + .02)],
    special: c => [bed('fx-purple-charge', .24, 0, c0(c))],
    ultimate: c => [onBeat('fx-domain', .7, c.move.contacts[c.move.timeStop!.contact])],
  },
  guts: {
    heavy: c => [...meleeSwings(c), onBeat('fx-slash-wave', .44, c0(c) + .02), onBeat('fx-ground-bounce', .26, c0(c) + .03)],
    special: c => [{ cue: 'fx-cannon-prep', gain: .46, delay: .1, phase: 'cast' }, onBeat('fx-cannon', .72, c0(c))],
    ultimate: c => [{ cue: pick(FAMILY.armour, c.seed), gain: .44, delay: .06, phase: 'cast' },
      { cue: pick(FAMILY.armour, c.seed, 1), gain: .34, delay: .22, phase: 'cast' },
      onBeat(pick(FAMILY.dragonslayer, c.seed), .48, c0(c), 'cast', wobble(c.seed, .05))],
  },
  killua: {
    heavy: c => [bed('fx-electric-bed', .2, 0, c0(c) - .12), onBeat('fx-lightning', .5, c0(c) - .1), onBeat(pick(FAMILY.claw, c.seed), .3, c0(c))],
    special: c => [bed('fx-electric-bed', .22, .08, c0(c)), onBeat('fx-lightning', .56, c0(c))],
    ultimate: c => [bed('fx-electric-bed', .16, .1, c0(c) + .05), onBeat(pick(FAMILY.zip, c.seed), .3, c0(c), 'cast', wobble(c.seed, .06))],
  },
  kaido: {
    special: c => [onBeat('fx-swing-huge', .5, c0(c) - .05), onBeat('fx-wind-blast', .52, c0(c))],
    ultimate: c => [{ cue: 'fx-haki', gain: .44, phase: 'cast' }, onBeat('fx-swing-huge', .5, c0(c))],
  },
  whitebeard: {
    special: c => [onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c) - .03), onBeat('fx-explosion-huge', .44, c0(c) + .02)],
    ultimate: c => [{ cue: 'fx-gather', gain: .34, phase: 'cast' }, onBeat('fx-land-heavy', .52, c0(c))],
  },
  shanks: {
    special: c => [{ cue: 'fx-haki', gain: .52, phase: 'cast' }, onBeat('fx-guard-break', .3, c0(c))],
    ultimate: c => [{ cue: 'fx-haki', gain: .4, phase: 'cast' }, onBeat('fx-draw', .36, Math.max(.05, c0(c) - .2)), onBeat('fx-slash-wave', .5, c0(c))],
  },
  roger: {
    special: c => [{ cue: 'fx-haki', gain: .4, phase: 'cast' }, onBeat('fx-cannon', .6, c0(c)), onBeat('fx-lightning', .3, c0(c) + .02)],
    ultimate: c => [{ cue: 'fx-haki', gain: .44, phase: 'cast' }, onBeat('fx-sword-ring', .4, Math.max(.05, c0(c) - .25)), onBeat('fx-swing-huge', .46, c0(c))],
  },
  aizen: {
    special: c => [{ cue: 'fx-gather', gain: .4, phase: 'cast' }, onBeat('fx-knife-throw-1', .5, c0(c)), onBeat('fx-zap-2', .36, c0(c) + .02)],
    ultimate: c => [{ cue: 'fx-domain', gain: .38, phase: 'cast' }, onBeat('fx-room', .5, c0(c))],
  },
  sukuna: {
    special: c => [onBeat('fx-swing-huge', .4, c0(c) - .04), onBeat('fx-slash-wave', .5, c0(c)), onBeat(pick(FAMILY.katana, c.seed), .4, c0(c) + .03)],
    ultimate: c => [{ cue: 'fx-fire-ignite', gain: .36, phase: 'cast' }, onBeat(pick(FAMILY.katana, c.seed), .46, c0(c))],
  },
  griffith: {
    special: c => [onBeat(pick(FAMILY.heavy, c.seed), .44, c0(c) - .04, 'cast', .85), onBeat(pick(FAMILY.zip, c.seed), .38, c0(c))],
    ultimate: c => [{ cue: 'fx-domain', gain: .32, phase: 'cast' }, onBeat(pick(FAMILY.katana, c.seed), .46, c0(c))],
  },
  meruem: {
    special: c => [bed('fx-ki-charge', .18, 0, c0(c)), onBeat(pick(FAMILY.kiBlast, c.seed), .46, c0(c))],
    ultimate: c => [{ cue: 'fx-gather', gain: .3, phase: 'cast' }, onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c))],
  },
  'goku-black': {
    heavy: c => {
      const blink = teleportOf(c.move);
      if (!blink) return meleeSwings(c);
      return [onBeat(pick(FAMILY.zip, c.seed), .42, blink.vanish, 'cast', .92), onBeat('fx-vanish', .46, blink.appear),
        { cue: 'fx-purple-charge', gain: .2, delay: round(blink.appear), phase: 'cast' },
        onBeat('fx-slash-wave', .5, c0(c)), onBeat(pick(FAMILY.zap, c.seed), .3, c0(c) + .02)];
    },
    ultimate: c => [onBeat(pick(FAMILY.kick, c.seed), .46, c0(c)), onBeat(pick(FAMILY.heavy, c.seed), .3, c0(c) - .02)],
  },
  jiren: {
    ultimate: c => [onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c) - .02), onBeat(pick(FAMILY.jab, c.seed), .36, c0(c) - .05)],
  },
  'golden-frieza': {
    light: c => [...meleeSwings(c), ...(c.stage % 2 ? [] : [onBeat(pick(FAMILY.zap, c.seed), .24, c0(c))])],
    special: c => [bed('fx-ki-charge', .15, 0, c0(c)), ...Array.from({ length: 6 }, (_, i) => onBeat(pick(FAMILY.zap, c.seed, i), .3, c0(c) + i * .065)),
      onBeat(pick(FAMILY.kiBlast, c.seed), .3, c0(c))],
  },
  'gohan-beast': {
    ultimate: c => [bed('fx-ki-charge', .2, 0, c0(c))],
  },
  akaza: {
    heavy: c => [...barrageBed(Math.max(0, c0(c) - .3), c0(c), .3), onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c))],
    special: c => [onBeat('fx-swing-huge', .44, c0(c) - .04), onBeat(pick(FAMILY.jab, c.seed), .42, c0(c)), onBeat('fx-wind-blast', .3, c0(c) + .02)],
    ultimate: c => [onBeat(pick(FAMILY.jab, c.seed), .46, c0(c))],
  },
  saitama: {
    heavy: c => [bed('fx-wind-swirl', .14, .05, c0(c))],
    ultimate: c => [onBeat(pick(FAMILY.jab, c.seed), .46, c0(c))],
    special: c => [...barrageBed(c0(c) - .05, last(c) + .15, .34), onBeat(pick(FAMILY.heavy, c.seed), .46, last(c))],
  },
  itachi: {
    heavy: c => {
      const blink = teleportOf(c.move);
      if (!blink) return meleeSwings(c);
      return [onBeat(pick(FAMILY.poof, c.seed), .4, blink.vanish), onBeat(pick(FAMILY.zip, c.seed), .36, blink.vanish + .02, 'cast', .92),
        onBeat('fx-vanish', .46, blink.appear), onBeat(pick(FAMILY.kick, c.seed), .32, c0(c) - .01, 'cast', .9)];
    },
    special: c => [onBeat('fx-fire-ignite', .42, c0(c), 'cast', .7),
      { cue: 'fx-black-flame', gain: .34, delay: c0(c), duration: round(c.move.duration - c0(c)), loop: true, phase: 'cast' }],
    ultimate: c => [onBeat(pick(FAMILY.kunai, c.seed), .46, c0(c))],
  },
  madara: {
    special: c => [bed('fx-fire-bed', .22, Math.max(0, c0(c) - .15), last(c)), onBeat('fx-fire-roar', .5, c0(c))],
    ultimate: c => [onBeat(pick(FAMILY.heavy, c.seed), .46, c0(c))],
  },
  tanjiro: {
    heavy: c => [onBeat(pick(FAMILY.katana, c.seed), .44, c0(c) - .02), onBeat(pick(FAMILY.zip, c.seed), .34, c0(c))],
    ultimate: c => [onBeat(pick(FAMILY.katana, c.seed), .46, c0(c))],
  },
  levi: {
    heavy: c => [onBeat(pick(FAMILY.zip, c.seed), .42, c0(c) - .02), onBeat(pick(FAMILY.kiBlast, c.seed), .3, c0(c))],
    special: c => [onBeat(pick(FAMILY.zip, c.seed), .4, c0(c) * .3), onBeat(pick(FAMILY.zip, c.seed, 1), .36, c0(c) * .6),
      onBeat('fx-swing-huge', .46, c0(c) - .02), onBeat(pick(FAMILY.katana, c.seed), .42, c0(c))],
    ultimate: c => [onBeat(pick(FAMILY.katana, c.seed), .46, c0(c))],
  },
  'sung-jinwoo': {
    special: c => [{ cue: 'fx-gather', gain: .3, phase: 'cast' }, ...c.move.contacts.map((time, i) => onBeat('fx-land-heavy', .5 + i * .06, time))],
    ultimate: c => [onBeat(pick(FAMILY.kunai, c.seed), .46, c0(c))],
  },
  gon: {
    special: c => [{ cue: 'fx-gather', gain: .3, phase: 'cast' }, onBeat(pick(FAMILY.kiBlast, c.seed), .5, c0(c))],
    ultimate: c => [onBeat(pick(FAMILY.jab, c.seed), .46, c0(c))],
  },
};


function confirmLayers(c: Ctx): CueLayer[] {
  if (!c.move.confirm || c.slot !== 'ultimate') return [];
  const plan = SIGNATURE_CONFIRMS[c.fighter];
  const layers = plan ? plan(c) : cinematicSwings(c);
  const age = c.event.castAge ?? c0(c), out: CueLayer[] = [];
  for (const layer of layers) {
    const moved = cinematicLayer(layer, age);
    if (moved) out.push(moved);
  }
  return out;
}
function cinematicLayer(layer: CueLayer, age: number): CueLayer | undefined {
  const at = (layer.delay ?? 0) - age, end = layer.duration === undefined ? undefined : at + layer.duration;
  if (at < -.03 && !(layer.loop && end !== undefined && end > .15)) return undefined;
  const delay = Math.max(0, at);
  const { delay: _delay, duration, ...rest } = layer;
  return { ...rest, ...(delay > 0 ? { delay: round(delay) } : {}), ...(duration !== undefined ? { duration: round(end! - delay) } : {}),
    phase: layer.phase === 'charge' ? 'cast' : layer.phase };
}
function cinematicSwings(c: Ctx): CueLayer[] {
  const blow = blowOf(c), layers: CueLayer[] = [];
  c.move.contacts.forEach((time, i) => { if (i > 0) layers.push(...swing(c, blow, time, i === c.move.contacts.length - 1, i)); });
  return layers;
}
const held = (cue: AudioCue, gain: number, from: number, to: number, rate = 1): CueLayer =>
  ({ ...bed(cue, gain, from, to, rate), phase: 'cast' });
const middle = (c: Ctx) => c.move.contacts.slice(1, -1);

const SIGNATURE_CONFIRMS: Partial<Record<FighterId, Plan>> = {
  toji:c=>[onBeat('fx-slash-kunai-1',.14,c.move.contacts[1]),onBeat('fx-dash',.12,c.move.contacts[2]),onBeat('fx-cut-2',.18,c.move.contacts[3]),onBeat('fx-hit-finisher-1',.25,last(c))],
  usopp:c=>[onBeat('fx-snap-2',.14,c.move.contacts[1]),onBeat('fx-wind-blast',.19,last(c)),onBeat('fx-hit-finisher-1',.23,last(c))],
  crocodile:c=>[held('fx-wind-swirl',.14,c0(c),last(c)),onBeat('fx-land-heavy',.22,last(c)),onBeat('fx-hit-finisher-1',.21,last(c))],
  sakura:c=>[onBeat('fx-hit-heavy-1',.22,c.move.contacts[1]),held('fx-gather',.1,c.move.contacts[1],last(c)),onBeat('fx-land-heavy',.28,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  meliodas:c=>[onBeat('fx-cut-2',.22,c.move.contacts[1]),onBeat('fx-fire-whoosh-1',.2,c.move.contacts[2]),onBeat('fx-fire-burst',.26,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  escanor:c=>[onBeat('fx-energy-hit-1',.22,c.move.contacts[1]),onBeat('fx-fire-burst',.26,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  tatsumaki:c=>[onBeat('fx-wind-blast',.22,c.move.contacts[1]),held('fx-gather',.1,c.move.contacts[1],last(c)),onBeat('fx-land-heavy',.26,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  makima:c=>[onBeat('fx-energy-hit-1',.18,c.move.contacts[1]),onBeat('fx-gather',.14,c.move.contacts[2]),onBeat('fx-counter-shock',.26,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  kenpachi:c=>[held('fx-gather',.13,c0(c),last(c)),onBeat('fx-swing-huge',.27,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  minato:c=>[onBeat('fx-dash',.20,c.move.contacts[1]),held('fx-wind-swirl',.14,c.move.contacts[1],last(c)),onBeat('fx-energy-hit-1',.28,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))],
  'nico-robin':c=>[onBeat('fx-stretch-2',.14,c.move.contacts[1]),onBeat('fx-snap-2',.20,last(c)),onBeat('fx-hit-finisher-1',.19,last(c))],
  'kaiju-no-8':c=>[onBeat('fx-wind-blast',.18,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))],
  eren:c=>c.awakened?[onBeat('fx-wind-blast',.18,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))]
    :[...Array.from({length:8},(_,i)=>onBeat(pick(FAMILY.katana,c.seed,i),.3,c0(c)+.2+i*.14)),onBeat('fx-swing-huge',.46,last(c)-.05),onBeat(pick(FAMILY.cutHeavy,c.seed),.55,last(c))],
  asuka:c=>[onBeat('fx-wind-blast',.16,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  netero:c=>[onBeat('fx-wind-blast',.16,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  shinji:c=>[onBeat('fx-wind-blast',.16,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  jolyne:c=>[onBeat('fx-energy-hit-1',.14,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  'might-guy':c=>[onBeat('fx-dash',.16,c.move.contacts[1]),onBeat('fx-hit-finisher-1',.25,last(c))],
  akame:c=>[onBeat('fx-dash',.12,c.move.contacts[1]),onBeat('fx-sword-ring',.14,last(c)),onBeat('fx-hit-finisher-1',.22,last(c))],
  pikachu:c=>[onBeat('fx-sword-ring',.12,c.move.contacts[1]),held('fx-electric-bed',.08,2.34,last(c)),onBeat('fx-lightning',.20,last(c)),onBeat('fx-hit-finisher-1',.23,last(c))],
  garou:c=>[onBeat('fx-dash',.12,c.move.contacts[1]),onBeat('fx-snap-1',.13,c.move.contacts[2]),onBeat('fx-snap-2',.14,c.move.contacts[3]),onBeat('fx-wind-blast',.19,last(c)),onBeat('fx-hit-finisher-1',.23,last(c))],
  esdeath:c=>[held('fx-wind-swirl',.09,c.move.contacts[0],last(c)),onBeat('fx-guard-shatter',.23,last(c)),onBeat('fx-sword-ring',.15,last(c))],
  mikasa:c=>[...c.move.contacts.slice(1,-1).map(t=>onBeat('fx-slash-kunai-1',.16,t)),onBeat('fx-sword-ring',.17,last(c)),onBeat('fx-hit-finisher-1',.26,last(c))],
  'alphonse-elric':c=>[onBeat('fx-armour-2',.14,c.move.contacts[1]),onBeat('fx-ground-bounce',.23,last(c)),onBeat('fx-hit-finisher-1',.26,last(c))],
  'ken-kaneki':c=>[onBeat('fx-beast-swipe-1',.19,c.move.contacts[1]),onBeat('fx-beast-swipe-2',.20,c.move.contacts[2]),onBeat('fx-wind-blast',.16,last(c)),onBeat('fx-hit-finisher-1',.27,last(c))],
  grimmjow:c=>[held('fx-gather',.12,c0(c)+.1,last(c)),onBeat('fx-wind-blast',.22,last(c)),onBeat('fx-energy-hit-2',.24,last(c)),onBeat('fx-hit-finisher-1',.24,last(c))],
  byakuya:c=>[onBeat('fx-slash-kunai-1',.18,c.move.contacts[1]),held('fx-wind-swirl',.08,1.7,last(c)),onBeat('fx-energy-hit-1',.20,last(c)),onBeat('fx-hit-finisher-1',.26,last(c))],
  rengoku:c=>[onBeat('fx-slash-kunai-1',.18,c.move.contacts[1]),onBeat('fx-fire-whoosh-1',.22,c.move.contacts[2]),held('fx-fire-bed',.10,c.move.contacts[2],last(c)),onBeat('fx-fire-burst',.29,last(c)),onBeat('fx-hit-finisher-1',.30,last(c))],
  yamamoto:c=>[onBeat('fx-slash-kunai-1',.19,c.move.contacts[1]),held('fx-fire-bed',.10,1.6,last(c)),onBeat('fx-fire-burst',.27,last(c)),onBeat('fx-hit-finisher-1',.30,last(c))],
  pain:c=>[held('fx-gather',.1,1.0,last(c)),onBeat('fx-land-heavy',.26,last(c)),onBeat('fx-hit-finisher-1',.3,last(c))],
  'edward-elric':c=>[onBeat('fx-slash-kunai-1',.20,c.move.contacts[1]),held('fx-electric-bed',.08,2.35,last(c)),onBeat('fx-land-heavy',.28,last(c)),onBeat('fx-hit-finisher-1',.32,last(c))],
  hiei:c=>[onBeat('fx-fire-burst',.22,c.move.contacts[1]),held('fx-gather',.1,c.move.contacts[1],last(c)),onBeat('fx-wind-blast',.28,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  aokiji:c=>[onBeat('fx-guard-shatter',.2,c.move.contacts[1]),held('fx-gather',.10,c.move.contacts[1],last(c)),onBeat('fx-wind-blast',.27,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  doflamingo:c=>[onBeat('fx-cut-2',.22,c.move.contacts[1]),held('fx-stretch-2',.12,c.move.contacts[1],last(c)),onBeat('fx-snap-2',.22,last(c)),onBeat('fx-hit-finisher-1',.28,last(c))],
  hisoka:c=>[...c.move.contacts.slice(1,-1).map((t,i)=>onBeat(i%2?'fx-snap-1':'fx-cut-2',.14,t)),onBeat('fx-stretch-2',.15,c.move.contacts[6]),onBeat('fx-snap-2',.23,last(c)),onBeat('fx-hit-finisher-1',.25,last(c))],
  blackbeard:c=>[onBeat('fx-counter-shock',.24,c.move.contacts[1]),held('fx-gather',.1,c.move.contacts[1],last(c)),onBeat('fx-guard-shatter',.27,last(c)),onBeat('fx-land-heavy',.3,last(c))],
  tsunade:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-hit-finisher-1',.2,t)),onBeat('fx-wind-blast',.28,last(c))],
  jiraiya:c=>[bed('fx-fire-bed',.11,c.move.contacts[1],last(c)),onBeat('fx-fire-ignite',.18,c.move.contacts[1]),onBeat('fx-fire-roar',.28,last(c))],
  hinata:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-energy-hit-1',.13,t)),onBeat('fx-wind-blast',.24,last(c))],
  gintoki:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-swing-huge',.15,t)),onBeat('fx-hit-finisher-1',.28,last(c))],
  kizaru:c=>[onBeat('fx-ki-launch',.19,c.move.contacts[1]),onBeat('fx-ki-launch',.19,c.move.contacts[2]),held('fx-beam-big',.24,last(c),last(c)+.2),onBeat('fx-energy-hit-2',.3,last(c))],
  yamato:c=>[onBeat('fx-swing-huge',.25,c.move.contacts[1]),held('fx-haki',.13,c.move.contacts[1],last(c)),onBeat('fx-counter-shock',.3,last(c)),onBeat('fx-land-heavy',.32,last(c))],
  rukia:c=>[bed('fx-wind-swirl',.13,c.move.contacts[1],last(c)),onBeat('fx-guard-shatter',.24,c.move.contacts[1]),onBeat('fx-wind-blast',.32,last(c))],
  yuta:c=>[bed('fx-gather',.14,c.move.contacts[1],last(c)),held('fx-beam-big',.28,last(c),last(c)+.3),onBeat('fx-energy-hit-2',.25,last(c))],
  yuji:c=>[...c.move.contacts.slice(1).map(t=>onBeat('fx-energy-hit-1',.16,t)),onBeat('fx-hit-finisher-1',.28,last(c))],
  todoroki:c=>[onBeat('fx-fire-burst',.22,c.move.contacts[1]),bed('fx-wind-swirl',.17,c.move.contacts[1],last(c)),onBeat('fx-guard-shatter',.32,last(c)),onBeat('fx-wind-blast',.3,last(c))],
  jinbe:c=>[held('fx-wind-swirl',.14,c.move.contacts[1],last(c)),onBeat('fx-hit-finisher-1',.3,last(c))],
  enel:c=>[held('fx-electric-bed',.15,c.move.contacts[1],last(c)),onBeat('fx-lightning',.55,last(c)),onBeat('fx-counter-shock',.25,last(c))],
  endeavor:c=>[onBeat('fx-fire-ignite',.24,c.move.contacts[1]),bed('fx-fire-bed',.18,c.move.contacts[1],last(c)),onBeat('fx-fire-roar',.32,last(c)),onBeat('fx-fire-burst',.3,last(c))],
  yoruichi:c=>[onBeat('fx-electric-bed',.17,c.move.contacts[1]),onBeat('fx-dash',.23,c.move.contacts[2]),onBeat('fx-counter-shock',.3,last(c))],
  'all-might':c=>[onBeat('fx-swing-heavy-2',.28,c.move.contacts[1]),held('fx-wind-swirl',.22,c0(c)+.7,last(c)),onBeat('fx-wind-blast',.52,last(c)),onBeat('fx-land-heavy',.4,last(c))],
  bakugo:c=>[held('fx-wind-swirl',.18,c0(c)+.15,last(c)),onBeat('fx-fire-burst',.28,c.move.contacts[1]),onBeat('fx-fire-burst',.55,last(c)),onBeat('fx-land-heavy',.35,last(c))],
  deku:c=>[onBeat('fx-land-heavy',.2,c.move.contacts[1]),onBeat('fx-wind-blast',.38,last(c)),onBeat('fx-land-heavy',.35,last(c))],
  broly:c=>[onBeat('fx-land-heavy',.36,c.move.contacts[1]),bed('fx-ki-charge',.18,1.96,last(c)),onBeat('fx-ki-launch',.48,last(c)),onBeat('fx-wind-blast',.32,last(c))],
  denji:c=>c.move.contacts.slice(1).map((time,i)=>onBeat(i===2?'fx-denji-rev':'fx-denji-saw-2',i===2?.42:.34,time)),
  akainu:c=>[onBeat('fx-fire-burst',.4,c.move.contacts[1]),onBeat('fx-fire-burst',.6,last(c)),onBeat('fx-land-heavy',.45,last(c))],
  'boa-hancock': c => [held('fx-haki', .12, c0(c) + .15, last(c), .9), onBeat(pick(FAMILY.kick, c.seed, 1), .58, last(c)), onBeat('fx-guard-shatter', .45, last(c) + .025)],
  nami: c => [held('fx-wind-swirl', .14, c0(c), last(c)), held('fx-electric-bed', .19, c0(c) + .1, last(c)), onBeat('fx-lightning', .62, last(c))],
  mihawk:c=>[onBeat(pick(FAMILY.dragonslayer,c.seed,1),.6,last(c),'cast',.91),onBeat('fx-slash-wave',.63,last(c)+.02,'cast',.92)],
  vegeta: c => [held('fx-beam-big', .5, c0(c) + .45, last(c) + .25)],
  ichigo: c => [held('fx-ki-charge-big', .16, c0(c) + .1, last(c), .7), onBeat(pick(FAMILY.cleaver, c.seed), .5, last(c)),
    onBeat('fx-swing-huge', .46, last(c) + .02), onBeat('fx-getsuga', .4, last(c) + .03)],
  kakashi: c => [held('fx-chidori', .24, c0(c) + .1, last(c)), ...middle(c).map((time, i) => onBeat(pick(FAMILY.zap, c.seed, i), .4, time)),
    { cue: 'fx-kamui', gain: .5, delay: round(last(c) - .45), phase: 'cast' }, onBeat('fx-lightning', .5, last(c))],
  sasuke: c => [held('fx-electric-bed', .2, c0(c) + .1, last(c)), ...middle(c).map((time, i) => onBeat(pick(FAMILY.zap, c.seed, i), .42, time)),
    onBeat('fx-lightning', .62, last(c) - .02)],
  sanji: c => [held('fx-fire-bed', .24, c0(c) + .1, last(c)),
    ...middle(c).flatMap((time, i) => [onBeat(pick(FAMILY.kick, c.seed, i), .46, time), onBeat(pick(FAMILY.fireWhoosh, c.seed, i), .3, time)]),
    onBeat(pick(FAMILY.heavy, c.seed), .52, last(c)), onBeat('fx-fire-roar', .56, last(c) + .02)],
  luffy: c => [{ cue: 'fx-poof-1', gain: .4, delay: round(c0(c) + .05), phase: 'cast' },
    { cue: 'fx-gear4-inflate', gain: .46, delay: round(Math.max(c0(c) + .3, last(c) - 1.5)), phase: 'cast' },
    held('fx-electric-bed', .16, c0(c) + .4, last(c) - .05),
    onBeat(pick(FAMILY.stretch, c.seed), .42, last(c) - .22, 'cast', .6), onBeat('fx-swing-huge', .62, last(c)),
    onBeat('fx-explosion-huge', .55, last(c) + .02), { cue: 'fx-poof-2', gain: .32, delay: round(last(c) + .35), phase: 'cast' }],
  zoro: c => [{ cue: 'fx-asura', gain: .45, delay: round(c0(c) + .05), phase: 'cast' }, ...middle(c).flatMap((time, i) => swing(c, 'blade', time, true, i + 1)),
    onBeat('fx-swing-huge', .4, last(c)), onBeat(pick(FAMILY.katana, c.seed), .5, last(c)), onBeat(pick(FAMILY.katana, c.seed, 1), .42, last(c) + .02),
    onBeat(pick(FAMILY.katana, c.seed, 2), .38, last(c) + .04), { cue: 'fx-sheathe', gain: .46, delay: round(last(c) + .45), phase: 'cast' }],
  law: c => [held('fx-electric-bed', .24, c0(c) + .1, last(c)), ...middle(c).map((time, i) => onBeat(pick(FAMILY.zap, c.seed, i), .42, time)),
    onBeat('fx-lightning', .48, last(c) - .02)],
  guts: c => [...middle(c).map((time, i) => onBeat(pick(FAMILY.dragonslayer, c.seed, i + 1), .48, time, 'cast', wobble(c.seed + i + 1, .05))),
    onBeat('fx-swing-huge', .5, last(c)), onBeat(pick(FAMILY.dragonslayer, c.seed, 1), .45, last(c), 'cast', .86)],
  killua: c => [held('fx-electric-bed', .16, c0(c) + .05, last(c)),
    ...c.move.contacts.slice(1).map((time, i, rest) => onBeat(pick(FAMILY.zip, c.seed, i + 1), i === rest.length - 1 ? .45 : .22, time, 'cast', wobble(c.seed + i + 1, .06))),
    onBeat('fx-lightning', .4, last(c) + .02)],
  jotaro: c => timeStopCinematic(c, [onBeat(pick(FAMILY.heavy, c.seed), .5, last(c)),
    onBeat('fx-explosion-1', .46, last(c))]),
  dio: c => timeStopCinematic(c, [onBeat('fx-swing-huge', .55, last(c) - .02), onBeat('fx-road-roller', .58, last(c))]),
  gojo: c => {
    const stop = c.move.timeStop!, close = c.move.contacts[stop.contact] + stop.duration;
    const tour = c.move.contacts.slice(stop.contact + 1, -1);
    return [onBeat('fx-blue', .42, close),
      ...tour.map((time, i) => onBeat(pick(FAMILY.zip, c.seed, i), .26, time - .1, 'cast', wobble(c.seed + i, .05))),
      onBeat(pick(FAMILY.heavy, c.seed), .5, last(c))];
  },
  kaido: c => [held('fx-electric-bed', .24, c0(c) + .1, last(c)), onBeat('fx-lightning', .58, last(c) - .04),
    onBeat('fx-swing-huge', .5, last(c) - .05), onBeat('fx-explosion-huge', .52, last(c) + .02)],
  whitebeard: c => [...middle(c).map((time, i) => onBeat(pick(FAMILY.explosion, c.seed, i), .4, time)),
    onBeat('fx-land-heavy', .5, last(c) - .02), onBeat('fx-explosion-huge', .62, last(c))],
  shanks: c => [onBeat('fx-swing-huge', .46, last(c) - .05), onBeat('fx-slash-wave', .6, last(c)), onBeat('fx-lightning', .42, last(c) + .02)],
  roger: c => [onBeat('fx-swing-huge', .5, last(c) - .05), onBeat('fx-slash-wave', .62, last(c)), onBeat('fx-lightning', .46, last(c) + .02),
    onBeat('fx-explosion-huge', .4, last(c) + .06)],
  aizen: c => [held('fx-electric-bed', .2, c0(c) + .1, last(c)), onBeat('fx-black-flash', .55, last(c)), onBeat('fx-explosion-huge', .42, last(c) + .04)],
  sukuna: c => [held('fx-fire-bed', .22, c0(c) + .1, last(c)), onBeat('fx-fire-roar', .5, last(c) - .08), onBeat('fx-fire-burst', .55, last(c)),
    onBeat('fx-explosion-huge', .45, last(c) + .05)],
  griffith: c => [held('fx-electric-bed', .2, c0(c) + .1, last(c)), onBeat('fx-swing-huge', .5, last(c) - .05), onBeat('fx-black-flash', .56, last(c)),
    onBeat('fx-explosion-huge', .42, last(c) + .05)],
  meruem: c => [...middle(c).map((time, i) => onBeat(pick(FAMILY.hitHeavy, c.seed, i), .46, time)), onBeat('fx-swing-huge', .46, last(c) - .06),
    onBeat('fx-land-heavy', .55, last(c)), onBeat('fx-explosion-huge', .5, last(c) + .03),
    onBeat('fx-ki-launch', .44, last(c)), onBeat('fx-wind-blast', .4, last(c) + .03)],
  'goku-black': c => [held('fx-purple-charge', .24, c0(c) + .1, last(c)), onBeat('fx-swing-huge', .5, last(c) - .05), onBeat('fx-slash-wave', .6, last(c)),
    onBeat('fx-explosion-huge', .45, last(c) + .05)],
  jiren: c => [held('fx-ki-charge-big', .22, c0(c) + .1, last(c)), onBeat('fx-swing-huge', .5, last(c) - .06), onBeat(pick(FAMILY.finisher, c.seed), .55, last(c)),
    onBeat('fx-explosion-huge', .5, last(c) + .04)],
  'gohan-beast': c => [held('fx-beam-big', .42, c0(c) + .3, last(c) + .1), held('fx-wind-swirl', .18, c0(c) + .3, last(c)),
    onBeat('fx-explosion-huge', .46, last(c) + .02)],
  akaza: c => [onBeat('fx-swing-huge', .5, last(c) - .06), onBeat(pick(FAMILY.finisher, c.seed), .6, last(c)), onBeat('fx-explosion-huge', .55, last(c) + .03)],
  saitama: c => [held('fx-wind-swirl', .2, c0(c) + .25, last(c)), onBeat('fx-swing-huge', .52, last(c) - .06), onBeat(pick(FAMILY.finisher, c.seed), .6, last(c)),
    onBeat('fx-explosion-huge', .58, last(c) + .03)],
  madara: c => [held('fx-ki-charge-big', .2, c0(c) + .1, last(c), .5), onBeat('fx-swing-huge', .4, last(c) - .1), onBeat('fx-explosion-huge', .64, last(c)),
    onBeat('fx-land-heavy', .5, last(c) + .02),
    onBeat('fx-explosion-2', .4, last(c)), onBeat('fx-fire-burst', .44, last(c) + .02)],
  tanjiro: c => [held('fx-fire-bed', .24, c0(c) + .1, last(c)), onBeat('fx-fire-roar', .5, last(c) - .05), onBeat(pick(FAMILY.katana, c.seed), .5, last(c)),
    onBeat('fx-explosion-huge', .42, last(c) + .04)],
  levi: c => [...Array.from({ length: 8 }, (_, i) => onBeat(pick(FAMILY.katana, c.seed, i), .3, c0(c) + .2 + i * .14)), onBeat('fx-swing-huge', .46, last(c) - .05),
    onBeat(pick(FAMILY.cutHeavy, c.seed), .55, last(c))],
  'sung-jinwoo': c => [held('fx-ki-charge-big', .16, c0(c) + .1, last(c), .6), onBeat('fx-swing-huge', .46, last(c) - .05), onBeat('fx-black-flash', .54, last(c)),
    onBeat('fx-explosion-huge', .4, last(c) + .05)],
  gon: c => [held('fx-ki-charge-big', .2, c0(c) + .1, last(c), .5), onBeat('fx-swing-huge', .5, last(c) - .06), onBeat(pick(FAMILY.finisher, c.seed), .6, last(c)),
    onBeat('fx-explosion-huge', .58, last(c) + .03),
    onBeat('fx-explosion-2', .42, last(c) + .01), onBeat('fx-land-heavy', .5, last(c) + .02)],
  itachi: c => [held('fx-ki-charge-big', .16, c0(c) + .1, last(c), .6), onBeat('fx-swing-huge', .44, last(c) - .05), onBeat('fx-black-flash', .54, last(c)),
    onBeat('fx-explosion-huge', .42, last(c) + .05)],
};


const swung = (extra: (c: Ctx) => CueLayer[]) => (c: Ctx) => [...meleeSwings(c), ...extra(c)];
const slingshot = (c: Ctx): CueLayer[] => [onBeat('fx-stretch-2', .3, Math.max(.04, c0(c) - .06)), onBeat('fx-snap-2', .38, c0(c)), onBeat(pick(FAMILY.kiBlast, c.seed), .4, c0(c) + .01)];
const bloom = swung(c => [onBeat('fx-stretch-1', .24, Math.max(.04, c0(c) - .05)), onBeat('fx-snap-1', .22, c0(c) + .02)]);
const ENDER_CASTS: Partial<Record<FighterId, Partial<Record<ComboKey, (c: Ctx) => CueLayer[]>>>> = {
  usopp: { lh: slingshot, llh: slingshot, lllh: slingshot, llls: slingshot, airHeavy: slingshot },
  'boa-hancock': { llls: c => [onBeat('fx-zip-2', .44, c0(c), 'cast', 1.2), onBeat(pick(FAMILY.kiBlast, c.seed), .4, c0(c) + .01)] },
  'nico-robin': { lh: bloom, llh: bloom, lllh: bloom, llls: bloom },
  akaza: { llls: c => [bed('fx-wind-swirl', .2, .1, c0(c)), onBeat('fx-swing-huge', .42, c0(c) - .04), onBeat(pick(FAMILY.explosion, c.seed), .44, c0(c))] },
  goku: {
    lh: swung(c => [bed('fx-ki-charge', .14, 0, c0(c)), onBeat('fx-ki-launch', .38, c0(c))]),
    llls: c => [bed('fx-gather', .16, 0, c0(c)), onBeat('fx-sword-ring', .42, c0(c)), onBeat('fx-wind-blast', .26, c0(c) + .02)],
  },
  vegeta: {
    llh: c => [bed('fx-ki-charge', .15, 0, c0(c)), onBeat(pick(FAMILY.explosion, c.seed), .52, c0(c))],
    llls: c => [bed('fx-ki-charge', .16, 0, c0(c)), ...[-.15, -.1, -.05, 0].map((dt, i) => onBeat(pick(FAMILY.kiBlast, c.seed, i), i === 3 ? .5 : .36, Math.max(.04, c0(c) + dt)))],
  },
  naruto: {
    lh: c => c.awakened ? meleeSwings(c) : [...meleeSwings(c), onBeat('fx-wind-blast', .3, c0(c))],
    lllh: c => c.awakened ? meleeSwings(c) : [bed('fx-rasengan', .3, 0, c0(c) + .1), ...meleeSwings(c)],
    llls: c => c.awakened ? [onBeat('fx-beast-roar', .62, c0(c))] : [bed('fx-rasengan', .2, 0, c0(c)), onBeat('fx-wind-blast', .4, c0(c))],
    airHeavy: c => c.awakened ? meleeSwings(c) : [onBeat(pick(FAMILY.poof, c.seed), .26, .02), ...meleeSwings(c)],
  },
  luffy: {
    lh: swung(c => [onBeat('fx-gear4-inflate', .3, Math.max(.06, c0(c) - .12))]),
    llh: c => [...meleeSwings(c), ...[-.12, -.08, -.04].map((dt, i) => onBeat(pick(FAMILY.jab, c.seed, i), .3, Math.max(.04, c0(c) + dt)))],
  },
  sanji: {
    airHeavy: swung(c => [onBeat('fx-wind-swirl', .2, Math.max(.05, c0(c) - .1))]),
  },
  kakashi: {
    lh: c => [bed('fx-wind-swirl', .18, 0, c0(c)), onBeat('fx-swing-huge', .44, c0(c)), onBeat('fx-wind-blast', .3, c0(c) + .03)],
    lllh: c => [onBeat('fx-land-heavy', .5, c0(c)), onBeat('fx-ground-bounce', .34, c0(c) + .04)],
    llls: c => [onBeat(pick(FAMILY.poof, c.seed), .3, Math.max(.05, c0(c) - .1)), onBeat('fx-land-heavy', .34, c0(c)), onBeat('fx-beast-bite', .44, c0(c) + .03)],
    airHeavy: c => [bed('fx-chidori', .24, 0, c0(c)), onBeat('fx-lightning', .42, c0(c))],
  },
  sasuke: {
    lh: swung(c => [bed('fx-chidori', .3, 0, c0(c) + .08)]),
    llh: swung(c => [bed('fx-chidori', .26, 0, c0(c) + .06)]),
    lllh: c => [onBeat('fx-fire-ignite', .32, Math.max(.05, c0(c) - .08)), onBeat('fx-fire-roar', .5, c0(c))],
    llls: c => [bed('fx-electric-bed', .28, 0, c0(c) + .1), onBeat('fx-chidori-hit', .46, c0(c)), onBeat(pick(FAMILY.zap, c.seed), .3, c0(c) + .03)],
    airHeavy: c => [bed('fx-chidori', .22, 0, c0(c)), ...[-.04, 0, .04].map((dt, i) => onBeat(pick(FAMILY.zap, c.seed, i), .3, Math.max(.04, c0(c) + dt)))],
  },
  zoro: {
    llh: swung(c => [bed('fx-wind-swirl', .24, 0, c0(c) + .1)]),
    airHeavy: swung(c => [onBeat('fx-fire-ignite', .3, c0(c) + .03)]),
  },
  jotaro: {
    llh: c => [...barrageBed(Math.max(0, c0(c) - .25), c0(c), .32), ...meleeSwings(c)],
    llls: c => [bed('fx-wind-swirl', .3, 0, c0(c) + .1), onBeat('fx-stand', .3, .02)],
  },
  ichigo: {
    llls: c => c.awakened ? meleeSwings(c) : [bed('fx-ki-charge', .18, 0, c0(c)), onBeat('fx-ki-launch', .5, c0(c)), onBeat('fx-black-flame', .24, c0(c) + .02)],
  },
  ace: {
    lh: c => [onBeat('fx-fire-ignite', .26, Math.max(.04, c0(c) - .08)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .4, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed, 1), .3, c0(c) + .06)],
    llh: swung(c => [onBeat('fx-fire-roar', .34, c0(c))]),
    lllh: c => [bed('fx-fire-bed', .16, 0, c0(c)), onBeat(pick(FAMILY.fireWhoosh, c.seed), .46, c0(c)), onBeat('fx-fire-burst', .3, c0(c) + .04)],
    llls: c => [onBeat('fx-embers', .3, Math.max(.05, c0(c) - .15)), onBeat('fx-fire-burst', .5, c0(c))],
    airHeavy: c => [onBeat('fx-fire-roar', .5, c0(c))],
  },
  law: {
    lh: c => [onBeat('fx-room', .4, .02), onBeat('fx-shambles', .48, c0(c))],
    lllh: swung(c => [onBeat('fx-counter-shock', .42, c0(c) + .02)]),
    llls: swung(c => [onBeat('fx-room', .3, .02), onBeat(pick(FAMILY.snap, c.seed), .3, c0(c) + .03)]),
  },
  gojo: {
    lh: swung(c => [onBeat('fx-black-flash', .54, c0(c))]),
    llh: c => [bed('fx-gather', .2, 0, c0(c)), onBeat('fx-blue', .54, c0(c))],
    llls: c => [bed('fx-gather', .18, 0, c0(c) + .2), onBeat('fx-blue', .3, c0(c), 'cast', .7)],
  },
  dio: {
    lh: c => [onBeat(pick(FAMILY.zip, c.seed), .4, c0(c)), onBeat(pick(FAMILY.snap, c.seed), .28, c0(c) + .02)],
    lllh: c => [onBeat('fx-vanish', .36, .04), onBeat('fx-stand', .3, Math.max(.06, c0(c) - .1)), ...meleeSwings(c)],
    llls: swung(c => [onBeat('fx-steam', .4, c0(c) + .02)]),
  },
  guts: {
    lh: c => [onBeat(pick(FAMILY.armour, c.seed), .28, .04), ...[-.08, -.04, 0].map((dt, i) => onBeat(pick(FAMILY.knifeThrow, c.seed, i), .36, Math.max(.06, c0(c) + dt)))],
    llh: swung(c => [onBeat(pick(FAMILY.armour, c.seed), .3, c0(c))]),
    llls: c => [onBeat('fx-fire-ignite', .26, .04), onBeat(pick(FAMILY.explosion, c.seed), .54, c0(c))],
  },
  killua: {
    lh: c => [onBeat(pick(FAMILY.zip, c.seed), .4, Math.max(.05, c0(c) - .05)), onBeat(pick(FAMILY.heavy, c.seed), .4, c0(c))],
    llh: swung(c => [onBeat(pick(FAMILY.zip, c.seed), .3, Math.max(.04, c0(c) - .06)), onBeat(pick(FAMILY.zap, c.seed), .28, c0(c))]),
  },
};

const landed = (cue: AudioCue, gain: number, delay = 0): CueLayer => ({ cue, gain, ...(delay > 0 ? { delay } : {}), phase: 'impact' });
const ENDER_LANDS: Partial<Record<FighterId, (c: Ctx) => CueLayer[]>> = {
  goku: () => [landed('fx-ki-launch', .5), landed('fx-explosion-huge', .42, .04)],
  vegeta: () => [landed('fx-explosion-huge', .6)],
  naruto: c => c.awakened ? [landed('fx-explosion-huge', .54)] : [landed('fx-rasengan-hit', .6)],
  luffy: () => [landed('fx-fire-burst', .5), landed(FAMILY.hitHeavy[0], .4, .02)],
  sanji: () => [landed('fx-fire-burst', .46)],
  kakashi: c => [landed('fx-lightning', .54), landed(pick(FAMILY.zap, c.seed), .3, .03)],
  sasuke: () => [landed('fx-lightning', .62), landed(FAMILY.explosion[0], .36, .05)],
  zoro: () => [landed('fx-slash-wave', .54)],
  jotaro: c => [landed(pick(FAMILY.barrage, c.seed), .44), landed(pick(FAMILY.barrage, c.seed, 1), .36, .06)],
  ichigo: () => [landed('fx-getsuga', .56)],
  ace: () => [landed('fx-fire-roar', .58)],
  law: () => [landed('fx-counter-shock', .5)],
  gojo: () => [landed('fx-purple', .5)],
  dio: c => [landed(pick(FAMILY.knifeHit, c.seed), .42), landed(pick(FAMILY.knifeHit, c.seed, 1), .36, .05)],
  guts: () => [landed('fx-cannon', .58)],
  killua: c => [landed('fx-lightning', .5), landed(pick(FAMILY.zap, c.seed), .3, .03)],
};

function elementLanding(c: Ctx): CueLayer[] {
  const family = familyOf(c.fighter, 'special', c.awakened);
  return family ? fromNow(FAMILIES[family].hit, c.seed, .7) : [];
}

function releaseLayers(c: Ctx): CueLayer[] {
  if (c.event.branch === 'airSpecial') return [{ cue: 'fx-land-heavy', gain: .7, phase: 'impact' }, { cue: 'fx-ground-bounce', gain: .5, delay: .03, phase: 'impact', rate: .8 },
    ...(ENDER_LANDS[c.fighter]?.(c) ?? elementLanding(c))];
  if (c.move.style !== 'beam') return [];
  if (c.move.confirm && c.slot === 'ultimate') {
    if ((c.event.contactIndex ?? 0) !== 0) return [];
    const burst = activeWindow(c.move) + c.move.confirm.recovery + .05;
    return c.fighter === 'ichigo' ? [] : [{ cue: 'fx-beam-big', gain: .54, duration: round(burst), phase: 'release' }];
  }
  const length = Math.max(.4, c.move.duration - c0(c));
  switch (c.fighter) {
    case 'goku': return [{ cue: 'fx-beam', gain: .36, duration: round(length + .25), phase: 'release' }];
    case 'vegeta': return c.slot === 'ultimate'
      ? [{ cue: 'fx-beam-big', gain: .54, duration: round(length + .2), phase: 'release' }]
      : [{ cue: 'fx-beam', gain: .5, duration: round(length + .25), phase: 'release' }];
    case 'gojo': return [{ cue: 'fx-purple', gain: .62, phase: 'release' }];
    case 'saitama': return [{ cue: 'fx-wind-blast', gain: .62, phase: 'release' }, { cue: 'fx-wind-swirl', gain: .3, delay: .05, phase: 'release' }];
    case 'ichigo': return [];
    default: return [{ cue: c.slot === 'ultimate' ? 'fx-beam-big' : 'fx-beam', gain: .5, duration: round(length + .2), phase: 'release' }];
  }
}


function impactLayers(event: CombatEvent, awakened: boolean): CueLayer[] {
  const fighter = event.fighter, slot = event.slot, seed = seedOf(event);
  if (!fighter || !slot) {
    const heavy = slot === 'heavy' || slot === 'special' || slot === 'ultimate';
    return [{ cue: pick(heavy ? FAMILY.hitHeavy : FAMILY.hitLight, seed), gain: heavy ? .7 : .6, rate: wobble(seed, .04), phase: 'impact' }];
  }
  const c = context(event, fighter, slot, awakened);
  const index = event.contactIndex ?? 0, final = index >= c.move.contacts.length - 1;
  const special = event.branch ? undefined : SIGNATURE_IMPACTS[fighter]?.[slot];
  const opened = !special && slot === 'ultimate' && !!c.move.confirm && !final;
  const layers = special ? special(c, index, final)
    : slot === 'area' ? areaBlow(c)
    : opened && index === 0 ? catchBlow(c)
    : opened && c.move.style !== 'melee' ? [{ cue: pick(FAMILY.energyHit, seed, index), gain: .46, rate: wobble(seed + index, .06) }]
    : c.move.style === 'melee' ? meleeImpact(c, index, final) : energyImpact(c);
  return [...layers, ...awakenedImpact(c), ...familyHit(c, index, final, layers), ...signatureHit(c, final), ...sentUp(event, c)].map(layer => ({ ...layer, phase: 'impact' as const }));
}

function sentUp(event: CombatEvent, c: Ctx): CueLayer[] {
  return event.reaction === 'launched' ? [{ cue: pick(FAMILY.heavy, c.seed, 1), gain: .2, rate: 1.22, delay: .02 }] : [];
}

function catchBlow(c: Ctx): CueLayer[] {
  return c.move.style === 'melee'
    ? [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .66, rate: wobble(c.seed, .04) }, { cue: pick(FAMILY.energyHit, c.seed), gain: .34 }]
    : [{ cue: pick(FAMILY.explosion, c.seed), gain: .44 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .3 }];
}

type Weight = 'light' | 'tick' | 'heavy' | 'finisher';
function weightOf(c: Ctx, final: boolean): Weight {
  if (c.slot === 'light') return c.stage === 3 ? 'finisher' : 'light';
  if (!final) return c.slot === 'heavy' ? 'light' : 'tick';
  return c.slot === 'heavy' && c.move.contacts.length === 1 ? 'heavy' : 'finisher';
}

function meleeImpact(c: Ctx, index: number, final: boolean): CueLayer[] {
  const weight = weightOf(c, final), seed = c.seed, rate = wobble(seed, .05);
  const blow = blowOf(c), heavy = weight === 'heavy' || weight === 'finisher';
  const layers: CueLayer[] = [];
  if (weight === 'tick') {
    layers.push({ cue: pick(FAMILY.barrage, seed, index), gain: .5, rate: wobble(seed + index, .08) });
    if (blow === 'blade') layers.push({ cue: pick(FAMILY.cut, seed, index), gain: .3, rate: 1.1 });
    return layers;
  }
  switch (blow) {
    case 'blade': {
      const great = c.fighter === 'guts', small = c.fighter === 'kakashi' || c.fighter === 'killua' || c.fighter === 'itachi';
      if (great || heavy) layers.push({ cue: pick(FAMILY.cutHeavy, seed), gain: great && !heavy ? .62 : .72, rate: round(rate * (great ? .92 : 1)) });
      else layers.push({ cue: pick(FAMILY.cut, seed, index), gain: small ? .52 : .62, rate: round(rate * (small ? 1.14 : 1)) });
      if (heavy && !small) layers.push({ cue: 'fx-sword-ring', gain: .16, delay: .02, rate: wobble(seed, .06) });
      if (weight === 'finisher' && great) layers.push({ cue: 'fx-land-heavy', gain: .42, delay: .02 });
      break;
    }
    case 'kick':
      layers.push({ cue: pick(FAMILY.hitKick, seed, index), gain: heavy ? .7 : .62, rate: heavy ? round(rate * .94) : rate });
      if (weight === 'finisher') layers.push({ cue: pick(FAMILY.finisher, seed), gain: .5 });
      else if (heavy) layers.push({ cue: pick(FAMILY.hitHeavy, seed), gain: .42 });
      break;
    case 'beast':
      layers.push({ cue: pick(FAMILY.hitHeavy, seed, index), gain: .62, rate: round(rate * .9) });
      if (heavy) layers.push({ cue: 'fx-beast-bite', gain: .5 });
      break;
    case 'rubber':
      layers.push({ cue: heavy ? pick(FAMILY.hitHeavy, seed) : pick(FAMILY.hitLight, seed, index), gain: heavy ? .7 : .62, rate });
      layers.push({ cue: pick(FAMILY.snap, seed, 1), gain: .22, delay: .02, rate: wobble(seed, .08) });
      if (weight === 'finisher') layers.push({ cue: pick(FAMILY.finisher, seed), gain: .45 });
      break;
    case 'stand':
      layers.push({ cue: heavy ? pick(FAMILY.hitHeavy, seed) : pick(FAMILY.hitLight, seed, index), gain: heavy ? .72 : .64, rate });
      if (!heavy) layers.push({ cue: pick(FAMILY.hitHeavy, seed), gain: .3, rate: 1.08 });
      if (weight === 'finisher') layers.push({ cue: pick(FAMILY.finisher, seed), gain: .5 });
      break;
    default:
      if (weight === 'finisher') layers.push({ cue: pick(FAMILY.finisher, seed), gain: .72, rate: round(rate * .96) });
      else if (weight === 'heavy' || blow === 'axe') layers.push({ cue: pick(FAMILY.hitHeavy, seed, index), gain: .72, rate });
      else layers.push({ cue: pick(FAMILY.hitLight, seed, index), gain: .64, rate });
  }
  if (c.slot === 'light' && c.stage === 3) {
    if (c.fighter === 'gojo') layers.push({ cue: 'fx-red', gain: .52 });
    if (c.fighter === 'killua' || c.fighter === 'kakashi') layers.push({ cue: pick(FAMILY.zap, seed), gain: .36 });
    if (c.fighter === 'ace') layers.push({ cue: 'fx-fire-burst', gain: .4 });
    if (c.fighter === 'ichigo') layers.push({ cue: pick(FAMILY.energyHit, seed), gain: .38 });
  }
  if (c.fighter === 'ace' && c.slot === 'light' && c.stage < 3) layers.push({ cue: pick(FAMILY.burn, seed), gain: .26 });
  return layers;
}

function energyImpact(c: Ctx): CueLayer[] {
  if (c.slot === 'ultimate') return [{ cue: 'fx-explosion-huge', gain: .8 }];
  if (c.event.branch === 'airSpecial') return [{ cue: pick(FAMILY.explosion, c.seed), gain: .66 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .3 }];
  const family = familyOf(c.fighter, c.slot, c.awakened);
  if (family && !FAMILIES[family].explodes) return c.slot === 'special' || c.event.branch
    ? [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .8, rate: wobble(c.seed, .05) }, { cue: 'fx-land-heavy', gain: .3, rate: .7 },
      ...(c.event.branch ? [{ cue: pick(FAMILY.finisher, c.seed), gain: .55 }] : [])]
    : [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .54, rate: wobble(c.seed, .05) }];
  if (c.slot === 'special') return [{ cue: pick(FAMILY.explosion, c.seed), gain: .66 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .3 }];
  if (c.slot === 'heavy') return [{ cue: pick(FAMILY.explosion, c.seed), gain: .6 }];
  return [{ cue: pick(FAMILY.energyHit, c.seed), gain: .55, rate: wobble(c.seed, .05) }];
}

function awakenedImpact(c: Ctx): CueLayer[] {
  if (!c.awakened) return [];
  switch (c.fighter) {
    case 'killua': return [{ cue: pick(FAMILY.zap, c.seed, 2), gain: .24 }];
    case 'sanji': case 'ace': return c.move.style === 'melee' ? [{ cue: pick(FAMILY.burn, c.seed), gain: .24 }] : [];
    case 'luffy': return c.move.style === 'melee' ? [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .32, rate: .86 }] : [];
    case 'guts': return [{ cue: pick(FAMILY.armour, c.seed, 1), gain: .2 }];
    case 'gojo': return c.slot === 'light' ? [{ cue: pick(FAMILY.zap, c.seed), gain: .12 }] : [];
    default: return c.move.style === 'melee' && c.slot !== 'ultimate' ? [{ cue: pick(FAMILY.hitHeavy, c.seed, 2), gain: .22, rate: .88 }] : [];
  }
}

type ImpactPlan = (c: Ctx, index: number, final: boolean) => CueLayer[];
const detonation = (seed: number): CueLayer[] => [{ cue: 'fx-explosion-huge', gain: .72 }, { cue: pick(FAMILY.finisher, seed), gain: .45 }];
function volley(c: Ctx, layers: CueLayer[]): CueLayer[] {
  const k = c.event.id % 4, delay = round(k * .011);
  return layers.map((layer, i) => ({ ...layer, rate: round((layer.rate ?? 1) * wobble(c.seed + i, .05)), ...(delay ? { delay: round((layer.delay ?? 0) + delay) } : {}) }));
}
const resumeBlow = (c: Ctx): CueLayer[] => volley(c, [
  { cue: pick(FAMILY.finisher, c.event.id), gain: .64 }, { cue: pick(FAMILY.hitHeavy, c.event.id), gain: .42, rate: .92 }]);
const barrageTick = (c: Ctx, index: number): CueLayer[] => [{ cue: pick(FAMILY.barrage, c.seed, index), gain: .44, rate: wobble(c.seed + index, .08) }];
const confirmBlow = (opener: (c: Ctx) => CueLayer[], tick: (c: Ctx, index: number) => CueLayer[], finisher: (c: Ctx) => CueLayer[]): ImpactPlan =>
  (c, index, final) => final || !c.move.confirm ? finisher(c) : index === 0 ? opener(c) : tick(c, index);

const SIGNATURE_IMPACTS: Partial<Record<FighterId, Partial<Record<AttackSlot, ImpactPlan>>>> = {
  'all-might':{heavy:meleeImpact,special:()=>[{cue:'fx-wind-blast',gain:.46},{cue:'fx-hit-heavy-1',gain:.62},{cue:'fx-hit-finisher-1',gain:.36},{cue:'fx-land-heavy',gain:.34,rate:.7}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),...(final?[{cue:'fx-wind-blast' as const,gain:.38}]:[])]},
  bakugo:{heavy:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-fire-burst',gain:.18}],special:()=>[{cue:'fx-fire-burst',gain:.3},{cue:'fx-wind-blast',gain:.17}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),...(final?[{cue:'fx-fire-burst' as const,gain:.38}]:[])]},
  deku:{heavy:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-wind-blast',gain:.16}],special:()=>[{cue:'fx-wind-blast',gain:.46},{cue:'fx-hit-heavy-1',gain:.6},{cue:'fx-hit-finisher-1',gain:.36},{cue:'fx-land-heavy',gain:.34,rate:.7}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),...(final?[{cue:'fx-wind-blast' as const,gain:.34}]:[])]},
  broly:{special:()=>[{cue:'fx-ki-launch',gain:.28},{cue:'fx-land-heavy',gain:.2}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),...(final?[{cue:'fx-wind-blast' as const,gain:.4}]:[])]},
  denji:{special:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-denji-saw-2',gain:.24}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-denji-saw-1',gain:final?.3:.18}]},
  akainu:{heavy:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-fire-burst',gain:.2}],special:()=>[{cue:'fx-fire-burst',gain:.5},{cue:'fx-land-heavy',gain:.25}],ultimate:(c,i,final)=>[...meleeImpact(c,i,final),{cue:'fx-fire-burst',gain:final?.52:.2}]},
  'boa-hancock': {
    light: (c, index, final) => c.move.style === 'melee' ? meleeImpact(c, index, final) : [{ cue: 'fx-energy-hit-1', gain: .24, rate: 1.3 }],
    heavy: (c, index, final) => [...meleeImpact(c, index, final), { cue: 'fx-guard-shatter', gain: final ? .3 : .12, rate: 1.1 }],
    special: () => [{ cue: 'fx-energy-hit-2', gain: .38, rate: 1.25 }, { cue: 'fx-guard-shatter', gain: .22 }, { cue: 'fx-land-heavy', gain: .3, rate: .7 }],
    ultimate: (c, index, final) => [...meleeImpact(c, index, final), { cue: 'fx-guard-shatter', gain: final ? .55 : .18 }],
  },
  nami: {
    special: c => [{ cue: 'fx-wind-blast', gain: .5 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .62, rate: .94 }, { cue: 'fx-land-heavy', gain: .32, rate: .7 }],
    ultimate: (_c, _index, final) => [{ cue: 'fx-lightning', gain: final ? .7 : .3 }, ...(final ? [{ cue: 'fx-land-heavy' as const, gain: .36, rate: .7 }] : [])],
  },
  mihawk: {
    special:c=>[{cue:pick(FAMILY.cutHeavy,c.seed),gain:.68},{cue:'fx-wind-blast',gain:.25}],
    ultimate:(c,index,final)=>[{cue:pick(FAMILY.cutHeavy,c.seed,index),gain:final?.76:.6},{cue:pick(FAMILY.finisher,c.seed,index),gain:final?.35:.18}],
  },
  goku: {
    heavy: (c, index, final) => teleportOf(c.move)
      ? [{ cue: pick(FAMILY.hitKick, c.seed), gain: .7, rate: .94 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .45 }, { cue: pick(FAMILY.finisher, c.seed), gain: .38 }]
      : meleeImpact(c, index, final),
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .6 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .3 }],
    ultimate: c => detonation(c.seed),
  },
  vegeta: {
    light: (c, index, final) => c.move.style !== 'melee' ? energyImpact(c)
      : c.stage === 0 && !c.air ? [...meleeImpact(c, index, final), { cue: pick(FAMILY.kiBlast, c.seed), gain: .3, rate: 1.25 }] : meleeImpact(c, index, final),
    heavy: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .64 }],
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .64 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .6 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .36 }],
      (c, index) => [{ cue: pick(FAMILY.energyHit, c.seed, index), gain: .46, rate: wobble(c.seed + index, .06) }], c => detonation(c.seed)),
  },
  naruto: {
    heavy: c => c.awakened ? [{ cue: 'fx-beast-bite', gain: .7 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .5, rate: .9 }]
      : [{ cue: 'fx-rasengan-hit', gain: .78 }],
    special: c => c.awakened ? [{ cue: pick(FAMILY.explosion, c.seed), gain: .62 }]
      : [{ cue: 'fx-rasengan-hit', gain: .5, rate: 1.1 }, { cue: pick(FAMILY.explosion, c.seed), gain: .36 }],
    ultimate: c => detonation(c.seed),
  },
  sasuke: {
    heavy: () => [{ cue: 'fx-chidori-hit', gain: .8 }],
    special: (c, index) => [{ cue: pick(FAMILY.burn, c.seed, index), gain: .42 }],
    ultimate: confirmBlow(c => [{ cue: 'fx-chidori-hit', gain: .6 }, { cue: pick(FAMILY.explosion, c.seed), gain: .4 }],
      (c, index) => [{ cue: pick(FAMILY.zap, c.seed, index), gain: .42 }, { cue: pick(FAMILY.energyHit, c.seed, index), gain: .32 }],
      () => [{ cue: 'fx-explosion-huge', gain: .68 }, { cue: 'fx-lightning', gain: .44 }]),
  },
  kakashi: {
    heavy: () => [{ cue: 'fx-chidori-hit', gain: .8 }],
    special: () => [{ cue: 'fx-chidori-hit', gain: .72 }],
    ultimate: confirmBlow(() => [{ cue: 'fx-chidori-hit', gain: .74 }],
      (c, index) => [{ cue: pick(FAMILY.zap, c.seed, index), gain: .44 }, { cue: pick(FAMILY.energyHit, c.seed, index), gain: .3 }],
      () => [{ cue: 'fx-chidori-hit', gain: .82 }, { cue: 'fx-lightning', gain: .4 }]),
  },
  luffy: {
    special: c => [{ cue: 'fx-fire-burst', gain: .7 }, { cue: pick(FAMILY.explosion, c.seed), gain: .34 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .66, rate: .86 }, { cue: pick(FAMILY.snap, c.seed), gain: .26, delay: .02 }],
      c => [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .5 }],
      c => [{ cue: 'fx-explosion-huge', gain: .72 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .62, rate: .8 }]),
  },
  zoro: {
    special: c => [{ cue: pick(FAMILY.cutHeavy, c.seed), gain: .6 }, { cue: 'fx-wind-blast', gain: .36 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.cutHeavy, c.seed), gain: .66 }, { cue: pick(FAMILY.cut, c.seed, 1), gain: .4, delay: .03 }],
      (c, index) => [{ cue: pick(FAMILY.cutHeavy, c.seed, index), gain: .56 }, { cue: pick(FAMILY.cut, c.seed, index + 1), gain: .34, delay: .025 }],
      () => [{ cue: 'fx-nine-cuts', gain: .86 }]),
  },
  sanji: {
    special: () => [{ cue: 'fx-fire-burst', gain: .74 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.hitKick, c.seed), gain: .66, rate: .92 }, { cue: pick(FAMILY.burn, c.seed), gain: .34 }],
      (c, index) => [{ cue: pick(FAMILY.hitKick, c.seed, index), gain: .58 }, { cue: pick(FAMILY.burn, c.seed, index), gain: .3 }],
      c => [{ cue: 'fx-fire-burst', gain: .66 }, { cue: pick(FAMILY.explosion, c.seed), gain: .55 }, { cue: pick(FAMILY.hitKick, c.seed), gain: .5, rate: .9 }]),
  },
  ace: {
    heavy: () => [{ cue: 'fx-fire-burst', gain: .72 }],
    special: c => [{ cue: 'fx-fire-burst', gain: .7 }, { cue: pick(FAMILY.explosion, c.seed), gain: .34 }],
    ultimate: () => [{ cue: 'fx-explosion-huge', gain: .72 }, { cue: 'fx-fire-roar', gain: .38 }],
  },
  law: {
    heavy: c => [{ cue: pick(FAMILY.cutHeavy, c.seed), gain: .66 }],
    special: () => [{ cue: 'fx-gamma', gain: .72 }, { cue: 'fx-hit-heavy-1', gain: .34 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.hitHeavy, c.seed), gain: .56 }, { cue: pick(FAMILY.zap, c.seed), gain: .4 }],
      (c, index) => [{ cue: pick(FAMILY.zap, c.seed, index), gain: .46 }, { cue: pick(FAMILY.energyHit, c.seed, index), gain: .3 }],
      () => [{ cue: 'fx-counter-shock', gain: .86 }]),
  },
  jotaro: {
    heavy: c => [{ cue: pick(FAMILY.hitKick, c.seed), gain: .6, rate: 1.1 }, { cue: pick(FAMILY.knifeHit, c.seed), gain: .3 }],
    special: (c, index, final) => final ? [{ cue: pick(FAMILY.finisher, c.seed), gain: .78 }] : barrageTick(c, index),
    ultimate: (c, index, final) => final ? resumeBlow(c) : barrageTick(c, index),
  },
  dio: {
    heavy: c => [{ cue: pick(FAMILY.knifeHit, c.seed), gain: .58 }, { cue: pick(FAMILY.knifeHit, c.seed, 1), gain: .44, delay: .035, rate: 1.06 },
      { cue: pick(FAMILY.knifeHit, c.seed), gain: .38, delay: .07, rate: .95 }],
    special: (c, index, final) => final ? [{ cue: pick(FAMILY.finisher, c.seed), gain: .78 }] : barrageTick(c, index),
    ultimate: (c, index, final) => final ? resumeBlow(c) : barrageTick(c, index),
  },
  ichigo: {
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .6 }, { cue: pick(FAMILY.cutHeavy, c.seed), gain: .45 }],
    ultimate: confirmBlow(c => [{ cue: pick(FAMILY.energyHit, c.seed), gain: .58 }, { cue: pick(FAMILY.explosion, c.seed), gain: .4 }],
      (c, index) => [{ cue: pick(FAMILY.energyHit, c.seed, index), gain: .44, rate: .8 }],
      c => [{ cue: 'fx-explosion-huge', gain: .76 }, { cue: pick(FAMILY.cutHeavy, c.seed), gain: .42 }]),
  },
  gojo: {
    heavy: () => [{ cue: 'fx-blue', gain: .74 }],
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .66 }],
    ultimate: (c, index, final) => final ? volley(c, [{ cue: 'fx-black-flash', gain: .66 }])
      : [{ cue: pick(FAMILY.hitHeavy, c.seed, index), gain: .55 }, { cue: pick(FAMILY.energyHit, c.seed, index), gain: .24 }],
  },
  guts: {
    special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .66 }],
    ultimate: (c, index, final) => final ? [{ cue: pick(FAMILY.cutHeavy, c.seed), gain: .72 }, { cue: 'fx-explosion-huge', gain: .52 }, { cue: 'fx-land-heavy', gain: .5 }]
      : [{ cue: pick(FAMILY.cutHeavy, c.seed, index), gain: .58, rate: wobble(c.seed + index, .05) }],
  },
  killua: {
    heavy: c => [{ cue: 'fx-chidori-hit', gain: .66 }, { cue: pick(FAMILY.zap, c.seed), gain: .3 }],
    special: c => [{ cue: 'fx-chidori-hit', gain: .62 }, { cue: pick(FAMILY.zap, c.seed), gain: .34 }],
    ultimate: (c, index, final) => final ? [{ cue: 'fx-lightning', gain: .66 }, { cue: pick(FAMILY.finisher, c.seed), gain: .56 }, { cue: 'fx-explosion-huge', gain: .4 }]
      : [{ cue: pick(FAMILY.zap, c.seed, index), gain: .32 }, { cue: pick(FAMILY.barrage, c.seed, index), gain: .36 }],
  },
  itachi: {
    heavy: (c, index, final) => teleportOf(c.move)
      ? [{ cue: pick(FAMILY.hitKick, c.seed), gain: .7, rate: .94 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .45 }, { cue: pick(FAMILY.finisher, c.seed), gain: .38 }]
      : meleeImpact(c, index, final),
    special: (c, index) => [{ cue: pick(FAMILY.burn, c.seed, index), gain: .42 }],
  },
  madara: { special: (c, index) => [{ cue: pick(FAMILY.burn, c.seed, index), gain: .44 }] },
  'sung-jinwoo': { special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .5 }, { cue: pick(FAMILY.hitHeavy, c.seed), gain: .3, rate: .9 }] },
  gon: { special: c => [{ cue: pick(FAMILY.explosion, c.seed), gain: .46 }, { cue: pick(FAMILY.energyHit, c.seed), gain: .34 }] },
};


function guarded(event: CombatEvent, awakened: boolean) {
  const fighter = event.fighter, slot = event.slot, form = awakened && !!fighter && !!FORM_STAGES[fighter];
  const move = fighter && slot ? (slot === 'light' && (event.chain ?? 0) > 0 ? rushMove(fighter, event.chain!, form) : moveFor(fighter, slot, form)) : undefined;
  const blade = fighter ? (form ? FORM_BLADE[fighter] : undefined) ?? BLADE[fighter] : undefined;
  return { move, bladed: !!blade && move?.style === 'melee' && fighter !== 'killua' };
}
function blockedLayers(event: CombatEvent, awakened = false): CueLayer[] {
  const seed = seedOf(event), fighter = event.fighter, slot = event.slot, { move, bladed } = guarded(event, awakened);
  const energy = !!move && move.style !== 'melee';
  const heavy = slot === 'heavy' || slot === 'special' || slot === 'ultimate' || slot === 'light' && (event.chain ?? 0) >= 3;
  const weight = slot === 'ultimate' ? .82 : slot === 'special' ? .76 : .66;
  const thud: CueLayer = heavy ? { cue: 'fx-block-heavy', gain: weight, rate: wobble(seed, .04), phase: 'impact' }
    : bladed ? { cue: 'fx-block-blade', gain: .56, rate: wobble(seed, .05), phase: 'impact' } : { cue: pick(FAMILY.block, seed), gain: .6, rate: wobble(seed, .05), phase: 'impact' };
  return [thud,
    ...(heavy && bladed ? [{ cue: 'fx-block-blade' as const, gain: .34, rate: wobble(seed, .05), phase: 'impact' as const }] : []),
    ...(energy ? [{ cue: pick(FAMILY.energyHit, seed), gain: .26, phase: 'impact' as const }] : [])];
}

function parryLayers(event: CombatEvent, awakened = false): CueLayer[] {
  const seed = seedOf(event), { bladed } = guarded(event, awakened);
  const turned: CueLayer = event.reason === 'deflect' ? { cue: pick(FAMILY.energyHit, seed), gain: .3, rate: 1.15, phase: 'impact' }
    : bladed ? { cue: 'fx-sword-ring', gain: .28, rate: 1.16, delay: .015, phase: 'impact' }
    : { cue: pick(FAMILY.snap, seed), gain: .24, rate: 1.1, delay: .01, phase: 'impact' };
  return [{ cue: 'fx-parry', gain: .76, rate: wobble(seed, .02), phase: 'impact' }, { cue: 'fx-just-guard', gain: .34, phase: 'impact' }, turned];
}

function clashLayers(event: CombatEvent): CueLayer[] {
  const seed = seedOf(event), family = event.fighter && event.slot ? familyOf(event.fighter, event.slot) : null;
  return [{ cue: 'fx-clash', gain: .72, phase: 'impact' }, { cue: pick(FAMILY.explosion, seed), gain: .3, rate: 1.12, delay: .02, phase: 'impact' },
    ...(family ? fromNow(FAMILIES[family].hit.slice(0, 1), seed, .7) : [])];
}

function awakenLayers(fighter: FighterId): CueLayer[] {
  const own = ownAwakening(fighter);
  return [...own, ...powerEntrance(fighter, own)];
}

function powerEntrance(fighter: FighterId, own: readonly CueLayer[]): CueLayer[] {
  const voice = powerVoice(fighter);
  if (!voice || !arrivesHeard(fighter)) return [];
  const sound = POWER_SOUNDS[voice.kind], swap = awakeningSwapAt(fighter), level = voice.level * (spokenOver(fighter) ? sound.underALine : 1);
  return sound.entrance.filter(([cue]) => !own.some(layer => layer.cue === cue))
    .map(([cue, gain, after = 0]) => onBeat(cue, gain * level, swap + after, 'release'));
}

export const powerArrival = (fighter: FighterId): CueLayer[] => powerEntrance(fighter, ownAwakening(fighter));

function ownAwakening(fighter: FighterId): CueLayer[] {
  const swap = awakeningSwapAt(fighter);
  const add = (cue: AudioCue, gain: number, delay = 0): CueLayer => ({ cue, gain, ...(delay ? { delay: round(delay) } : {}), phase: 'release' });
  const on = (cue: AudioCue, gain: number, time: number, rate = 1) => onBeat(cue, gain, time, 'release', rate);
  const held = (cue: AudioCue, gain: number, from: number, to: number, rate = 1): CueLayer => ({ ...bed(cue, gain, from, to, rate), phase: 'release' });
  const base: CueLayer[] = [{ cue: 'fx-awaken', gain: spokenOver(fighter) ? .4 : .5, phase: 'release' }, ...burst(fighter)];
  switch (fighter) {
    case 'naruto': return [...base, add('fx-beast-roar', .5, .5)];
    case 'luffy': return [...base, add('fx-gear4-inflate', .36), add('fx-poof-1', .46, .34), add('fx-poof-2', .36, .48), add('fx-gear4-bounce', .42, .62)];
    case 'goku': case 'vegeta': return superSaiyan(fighter);
    case 'jotaro': case 'dio': return [...base, add('fx-stand', .5, .1), on('fx-haki', .46, swap + .06)];
    case 'sasuke': case 'kakashi': case 'itachi': return [...base, add('fx-susanoo', .52, .2), held('fx-purple-charge', .3, swap, swap + .9)];
    case 'madara': return [...base, add('fx-susanoo', .52, .2), on('fx-land-heavy', .5, swap + .3)];
    case 'rukia': return [held('fx-wind-swirl',.13,.08,swap),on('fx-guard-shatter',.2,swap)];
    case 'yuta': return [held('fx-gather',.12,.08,swap),on('fx-energy-hit-2',.19,swap)];
    case 'todoroki': return [held('fx-wind-swirl',.13,.08,swap),on('fx-guard-shatter',.2,swap),on('fx-fire-ignite',.15,swap)];
    case 'jinbe': return [held('fx-wind-swirl',.12,.08,swap),on('fx-gather',.18,swap)];
    case 'sakura': return [held('fx-gather',.08,.08,swap),on('fx-energy-hit-1',.16,swap)];
    case 'meliodas': return [held('fx-gather',.08,.08,swap),on('fx-fire-burst',.16,swap)];
    case 'escanor': return [held('fx-gather',.08,.08,swap),on('fx-fire-burst',.16,swap)];
    case 'tatsumaki': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.16,swap)];
    case 'makima': return [held('fx-gather',.07,.08,swap),on('fx-energy-hit-1',.14,swap)];
    case 'kenpachi': return [held('fx-gather',.09,.08,swap),on('fx-haki',.17,swap)];
    case 'minato': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.16,swap)];
    case 'nico-robin': return [held('fx-gather',.06,.12,swap),on('fx-stretch-1',.12,swap),on('fx-wind-blast',.12,swap)];
    case 'kaiju-no-8': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.18,swap),on('fx-snap-2',.10,swap)];
    case 'eren': return [on('fx-snap-2',.1,swap*.52),held('fx-gather',.07,.12,swap),on('fx-lightning',.2,swap),on('fx-wind-blast',.18,swap),on('fx-land-heavy',.16,swap+.18,.8)];
    case 'asuka': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.17,swap),on('fx-snap-2',.10,swap)];
    case 'netero': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.17,swap),on('fx-snap-2',.10,swap)];
    case 'shinji': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.17,swap),on('fx-snap-2',.10,swap)];
    case 'jolyne': return [held('fx-gather',.07,.12,swap),on('fx-energy-hit-1',.14,swap),on('fx-snap-2',.10,swap)];
    case 'might-guy': return [held('fx-gather',.07,.12,swap),on('fx-wind-blast',.16,swap),on('fx-snap-2',.12,swap)];
    case 'akame': return [held('fx-gather',.06,.18,swap),on('fx-sword-ring',.13,swap),on('fx-snap-2',.10,swap)];
    case 'pikachu': return [held('fx-electric-bed',.07,.20,swap),on('fx-lightning',.15,swap)];
    case 'garou': return [held('fx-gather',.07,.12,swap),on('fx-snap-2',.11,.387),on('fx-wind-blast',.16,swap)];
    case 'esdeath': return [on('fx-sword-ring',.10,.513),on('fx-wind-blast',.14,swap)];
    case 'mikasa': return [on('fx-sword-ring',.12,.378),on('fx-wind-blast',.13,swap)];
    case 'alphonse-elric': return [on('fx-armour-1',.1,.18),on('fx-armour-2',.12,.567),on('fx-energy-hit-1',.14,swap)];
    case 'ken-kaneki': return [held('fx-gather',.08,.08,swap),on('fx-snap-1',.12,.324),on('fx-energy-hit-1',.14,swap)];
    case 'grimmjow': return [held('fx-gather',.10,.08,swap),on('fx-energy-hit-1',.18,swap)];
    case 'byakuya': return [held('fx-wind-swirl',.08,.08,swap),on('fx-sword-ring',.14,swap)];
    case 'toji': return [on('fx-slash-kunai-1',.12,.12),held('fx-gather',.06,.08,swap),on('fx-wind-blast',.14,swap)];
    case 'usopp': return [held('fx-gather',.07,.08,swap),on('fx-haki',.16,swap),on('fx-snap-1',.08,swap)];
    case 'crocodile': return [held('fx-wind-swirl',.13,.08,swap),on('fx-wind-blast',.19,swap),on('fx-land-heavy',.10,swap)];
    case 'rengoku': return [held('fx-fire-bed',.10,.08,swap),on('fx-fire-ignite',.20,swap)];
    case 'yamamoto': return [held('fx-fire-bed',.09,.08,swap),on('fx-fire-ignite',.16,swap)];
    case 'pain': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.16,swap)];
    case 'edward-elric': return [held('fx-gather',.08,.08,swap),on('fx-energy-hit-1',.16,swap)];
    case 'hiei': return [held('fx-gather',.08,.08,swap),on('fx-fire-burst',.16,swap)];
    case 'aokiji': return [held('fx-gather',.08,.08,swap),on('fx-wind-blast',.13,swap)];
    case 'doflamingo': return [held('fx-gather',.08,.08,swap),on('fx-stretch-2',.13,swap)];
    case 'hisoka': return [held('fx-gather',.08,.08,swap),on('fx-snap-2',.14,swap)];
    case 'blackbeard': return [held('fx-gather',.09,.08,swap),on('fx-energy-hit-1',.18,swap)];
    case 'nanami': return [held('fx-gather',.08,.08,swap),on('fx-sword-ring',.14,swap)];
    case 'josuke': return [held('fx-gather',.09,.08,swap),on('fx-energy-hit-1',.18,swap)];
    case 'tsunade': return [held('fx-gather',.10,.08,swap),on('fx-energy-hit-1',.19,swap)];
    case 'jiraiya': return [held('fx-gather',.10,.08,swap),on('fx-wind-blast',.19,swap)];
    case 'hinata': return [held('fx-gather',.12,.08,swap),on('fx-energy-hit-1',.18,swap)];
    case 'gintoki': return [held('fx-gather',.08,.08,swap),on('fx-swing-huge',.15,swap)];
    case 'kizaru': return [held('fx-gather',.1,.08,swap),on('fx-energy-hit-2',.19,swap)];
    case 'yamato': return [held('fx-haki',.13,.08,swap),on('fx-counter-shock',.23,swap)];
    case 'enel': return [held('fx-electric-bed',.12,.08,swap),on('fx-counter-shock',.22,swap)];
    case 'endeavor': return [held('fx-fire-bed',.12,.08,swap),on('fx-fire-ignite',.26,swap),on('fx-fire-roar',.21,swap)];
    case 'yoruichi': return [held('fx-electric-bed',.13,.08,swap),on('fx-counter-shock',.23,swap)];
    case 'yuji': return [held('fx-gather',.12,.08,swap),on('fx-energy-hit-1',.2,swap)];
    case 'all-might': return [held('fx-wind-swirl',.14,.12,swap),on('fx-wind-blast',.3,swap),on('fx-land-heavy',.16,swap)];
    case 'bakugo': return [held('fx-fire-roar',.1,.12,swap),on('fx-fire-burst',.3,swap),on('fx-wind-blast',.17,swap)];
    case 'deku': return [held('fx-lightning',.09,.12,swap),on('fx-wind-blast',.2,swap)];
    case 'broly': return [held('fx-ki-charge',.1,0,swap),on('fx-swing-huge',.19,swap),on('fx-land-heavy',.2,swap)];
    case 'denji': return [on('fx-denji-ignition',.4,.63)];
    case 'akainu': return [held('fx-fire-roar',.14,.08,.7),on('fx-fire-burst',.35,.38),on('fx-land-heavy',.22,.38)];
    case 'mihawk': return [...base,on('fx-sword-ring',.42,swap+.02),on('fx-slash-wave',.23,swap+.08)];
    case 'nami': return [...base, held('fx-wind-swirl', .24, 0, .9), held('fx-electric-bed', .11, .15, swap), on('fx-wind-blast', .22, swap)];
    case 'boa-hancock': return [...base, held('fx-haki', .18, .08, swap + .3), on('fx-guard-shatter', .17, swap, 1.3)];
    case 'zoro': return [...base, add('fx-asura', .5, .1), on('fx-sword-ring', .34, swap + .04), on('fx-haki', .4, swap + .08)];
    case 'ichigo': return [
      { ...bed('fx-wind-swirl', .2, 0, BANKAI.kai + BANKAI.burstAfterKai), phase: 'release' },
      { ...onBeat('fx-awaken', .38, BANKAI.kai + BANKAI.burstAfterKai, 'release'), phase: 'release' },
      { ...onBeat('fx-bankai', .45, BANKAI.kai + BANKAI.burstAfterKai, 'release'), phase: 'release' }];
    case 'sanji': return [...base, add('fx-fire-ignite', .5, .35), add('fx-fire-roar', .34, .45), on('fx-fire-whoosh-2', .44, swap + .04)];
    case 'ace': return [...base, add('fx-fire-roar', .52, .4), on('fx-fire-whoosh-1', .44, swap + .02), on('fx-embers', .34, swap + .2)];
    case 'tanjiro': return [...base, on('fx-fire-ignite', .44, swap), add('fx-fire-roar', .44, .4), on('fx-fire-whoosh-1', .42, swap + .04)];
    case 'law': return [...base, add('fx-room', .54, .3), on('fx-shambles', .34, swap + .1)];
    case 'gojo': return [...base, add('fx-blue', .4), held('fx-purple-charge', .26, swap, swap + .8)];
    case 'guts': return [...base, add('fx-armour-1', .24, .5), add('fx-armour-2', .2, .72), on('fx-beast-roar', .46, swap + .2)];
    case 'killua': return [...base, add('fx-lightning', .44, .42), add('fx-zap-2', .26, .6), held('fx-electric-bed', .16, swap, swap + .8)];
    case 'kaido': return [...base, on('fx-beast-roar', .5, swap + .1), on('fx-lightning', .34, swap + .02)];
    case 'whitebeard': return [...base, on('fx-guard-shatter', .5, swap + .02), on('fx-land-heavy', .5, swap + .04)];
    case 'shanks': return [...base, on('fx-haki', .56, swap + .02), on('fx-guard-break', .3, swap + .06)];
    case 'roger': return [...base, on('fx-haki', .56, swap + .02), on('fx-lightning', .34, swap + .04)];
    case 'aizen': return [...base, add('fx-domain', .44)];
    case 'sukuna': return [...base, on('fx-black-flash', .36, swap + .12), on('fx-fire-ignite', .3, swap + .16)];
    case 'griffith': return [...base, add('fx-domain', .42), on('fx-black-flash', .46, swap + .04)];
    case 'meruem': return [...base, on('fx-beast-roar', .44, swap + .1), on('fx-black-flash', .34, swap + .04)];
    case 'goku-black': return [...base, on('fx-zap-3', .22, swap + .4)];
    case 'gohan-beast': return [...base, on('fx-beast-roar', .44, swap + .1), held('fx-electric-bed', .18, swap, swap + 1), on('fx-zap-1', .24, swap + .06), on('fx-zap-3', .2, swap + .3)];
    case 'jiren': return [...base, add('fx-ki-charge-big', .34), on('fx-explosion-huge', .34, swap + .1)];
    case 'golden-frieza': return [...base, on('fx-black-flash', .44, swap + .04), on('fx-stand', .36, swap + .1)];
    case 'saitama': return [...base, on('fx-land-heavy', .5, swap + .06)];
    case 'akaza': return [...base, add('fx-ki-charge-big', .3), on('fx-zap-2', .24, swap + .14)];
    case 'levi': return [...base, on('fx-sword-ring', .3, swap + .5), on('fx-zip-1', .26, swap + .56)];
    case 'sung-jinwoo': return [...base, add('fx-domain', .4), on('fx-black-flash', .46, swap + .04), held('fx-purple-charge', .24, swap, swap + .9)];
    case 'gon': return [...base, add('fx-ki-charge-big', .34), on('fx-beast-roar', .46, swap + .1)];
    default: return base;
  }
}

function spokenOver(fighter: FighterId) {
  const swap = awakeningSwapAt(fighter);
  return planVoice({ id: 0, kind: 'awaken', serverTime: 0, actorId: '', fighter }).some(l => (l.delay ?? 0) < swap - .1);
}

function burst(fighter: FighterId): CueLayer[] {
  const swap = awakeningSwapAt(fighter);
  if (spokenOver(fighter)) return [
    onBeat('fx-swing-huge', .34, swap, 'release'),
    { ...bed('fx-purple-charge', .4, swap, swap + .6), phase: 'release' },
    onBeat('fx-zap-1', .3, swap, 'release'),
    onBeat('fx-zap-2', .22, swap + .12, 'release'),
  ];
  return [
    { ...bed('fx-gather', .2, 0, swap), phase: 'release' },
    onBeat('fx-chase', .32, swap, 'release'),
    onBeat('fx-ki-launch', .42, swap, 'release'),
    onBeat('fx-wind-blast', .46, swap + .02, 'release'),
  ];
}

function superSaiyan(fighter: FighterId): CueLayer[] {
  const burst = awakeningSwapAt(fighter);
  return [
    { cue: 'fx-awaken', gain: .5, phase: 'release' },
    { cue: 'fx-fire-whoosh-1', gain: .34, phase: 'release' },
    { ...bed('fx-ki-charge', .34, 0, burst + .05), phase: 'release' },
    { ...bed('fx-gather', .22, 0, burst), phase: 'release' },
    onBeat('fx-chase', .4, burst, 'release'),
    onBeat('fx-wind-blast', .52, burst, 'release'),
    onBeat('fx-ki-launch', .36, burst, 'release'),
    onBeat('fx-lightning', .3, burst, 'release'),
    { cue: 'fx-fire-roar', gain: .3, delay: burst, phase: 'release' },
    { ...bed('fx-electric-bed', .18, burst, burst + 1.1), phase: 'release' },
    onBeat('fx-zap-1', .28, burst + .04, 'release'),
    onBeat('fx-zap-3', .24, burst + .16, 'release'),
    onBeat('fx-zap-1', .16, burst + .5, 'release', 1.12),
    onBeat('fx-zap-2', .12, burst + .9, 'release'),
  ];
}


function teleportOf(move: MoveDefinition) {
  return (move as MoveDefinition & { teleport?: { vanish: number; appear: number } }).teleport;
}

const SFX_LENGTHS = SFX_LENGTHS_JSON as Record<string, number>;
function sfxLength(cue: AudioCue) { return SFX_LENGTHS[cue as string] ?? 1; }

function round(value: number) { return Math.round(value * 1000) / 1000; }

function onBeat(cue: AudioCue, gain: number, time: number, phase: CueLayer['phase'] = 'cast', rate = 1, lead = .012): CueLayer {
  const peak = SFX_PEAKS[cue] ?? 0, due = time - lead;
  if (due > 0 && peak / rate > due) rate = Math.min(rate * ONBEAT_HURRY, peak / due);
  const delay = Math.max(0, due - peak / rate);
  return { cue, gain: round(gain), ...(delay > 0 ? { delay: round(delay) } : {}), ...(rate !== 1 ? { rate: round(rate) } : {}), phase };
}

const ONBEAT_HURRY = 1.2;

function bed(cue: AudioCue, gain: number, from: number, to: number, rate = 1): CueLayer {
  const start = Math.max(0, from);
  return { cue, gain, ...(start > 0 ? { delay: round(start) } : {}), duration: round(Math.max(.12, to - start)), loop: true,
    ...(rate !== 1 ? { rate } : {}), phase: 'charge' };
}

function seedOf(event: CombatEvent) {
  let h = 2166136261;
  for (const x of [event.id, event.contactIndex ?? 0, event.chain ?? 0]) {
    h ^= (x | 0) + 0x9e3779b9;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
function pick<T>(family: readonly T[], seed: number, offset = 0): T { return family[(seed + offset) % family.length]; }
function wobble(seed: number, spread: number) { return round(1 + (((seed >>> 7) % 1001) / 1000 - .5) * 2 * spread); }
