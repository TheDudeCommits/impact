import { FIGHTERS } from '../config';
import { AWAKENINGS } from '../game/awakening';
import { onLiquid, type LiquidFloor } from '../game/footing';
import type { StageId } from '../game/stages';
import type { FighterId, PlayerState } from '../game/types';
import type { AudioCue } from './cueTypes';

export type Surface = 'stone' | 'wood' | 'sand' | 'grass' | 'water' | 'snow' | 'metal';

export const FLOORS: Readonly<Record<StageId, Surface>> = {
  harbor: 'stone',
  'enies-lobby': 'stone',
  'chunin-final': 'grass',
  'martial-arts-tournament': 'stone',
  'galactic-arena': 'stone',
  'chunin-exam-room': 'wood',
  'kami-lookout': 'stone',
  'valley-of-the-end': 'water',
  'malevolent-shrine': 'water',
  shiganshina: 'stone',
  'hueco-mundo': 'sand',
  onigashima: 'stone',
  'null-realm': 'metal',
  shibuya: 'stone',
  'infinity-castle': 'wood',
  'rift-war': 'grass', 'blood-citadel': 'stone', 'hidden-leaf': 'stone',
  'rift-village': 'stone', 'rift-swords': 'grass', 'rift-fortress': 'stone', 'rift-eclipse': 'stone', 'rift-frost': 'snow',
  'rift-grove': 'grass', 'rift-wastes': 'sand', 'rift-harbor': 'wood',
  marineford: 'stone',
  'pains-crater': 'sand',
  'heavens-arena': 'stone',
};

export function surfaceAt(stage: StageId | undefined, liquid: LiquidFloor | undefined, y: number): Surface {
  const floor = stage ? FLOORS[stage] ?? 'stone' : 'stone';
  return floor === 'water' && liquid && !onLiquid(liquid, y) ? 'stone' : floor;
}

export const STEPS: Readonly<Record<Surface, { readonly takes: readonly [AudioCue, AudioCue]; readonly gain: number }>> = {
  stone: { takes: ['fx-step-stone-1', 'fx-step-stone-2'], gain: .13 },
  wood: { takes: ['fx-step-wood-1', 'fx-step-wood-2'], gain: .12 },
  sand: { takes: ['fx-step-sand-1', 'fx-step-sand-2'], gain: .1 },
  grass: { takes: ['fx-step-grass-1', 'fx-step-grass-2'], gain: .1 },
  water: { takes: ['fx-step-water-1', 'fx-step-water-2'], gain: .07 },
  snow: { takes: ['fx-step-snow-1', 'fx-step-snow-2'], gain: .1 },
  metal: { takes: ['fx-step-metal-1', 'fx-step-metal-2'], gain: .1 },
};

export function weightOf(fighter: FighterId, awakened = false): number {
  const height = FIGHTERS[fighter]?.height ?? 1.8, form = awakened ? AWAKENINGS[fighter]?.formScale ?? 1 : 1;
  const stands = height * (awakened && AWAKENINGS[fighter]?.kind !== 'summon' && AWAKENINGS[fighter]?.kind !== 'stand' ? Math.min(form, 2) : 1);
  return Math.max(0, Math.min(1, (stands - 1.55) / 1.45 + (BUILD[fighter] ?? 0)));
}
const BUILD: Readonly<Partial<Record<FighterId, number>>> = {
  blackbeard: .3, whitebeard: .3, akainu: .15, jinbe: .2, 'all-might': .15, broly: .2, 'alphonse-elric': .3, guts: .15, 'kaiju-no-8': .15, kenpachi: .1, escanor: .1, jiren: .15,
  'boa-hancock': -.3, enel: -.25, doflamingo: -.2, aokiji: -.1, kizaru: -.1, nami: -.05, 'nico-robin': -.05,
};
export const weightNow = (p: Pick<PlayerState, 'fighter' | 'awakened'>) => weightOf(p.fighter, !!p.awakened);

export const weightRate = (weight: number) => 1.08 - .36 * weight;
export const weightGain = (weight: number) => .88 + .6 * weight;
export const GIANT = .6;
