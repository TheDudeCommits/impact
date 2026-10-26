import { AWAKENINGS } from '../game/awakening';
import { OWN_ENTRANCES } from '../game/powerUp';
import type { FighterId } from '../game/types';
import { awakenedPower, type AwakenedPower } from '../render/awakenedPower';
import type { AudioCue } from './cueTypes';

export type PowerSound = 'flame' | 'haki' | 'reiatsu' | 'chakra' | 'cursed' | 'nen' | 'arcs' | 'steam' | 'frost';

interface Voice {
  readonly loop: AudioCue;
  readonly entry: number; readonly hold: number;
  readonly entrance: readonly (readonly [AudioCue, number, number?])[];
  readonly underALine: number;
}
export const POWER_SOUNDS: Readonly<Record<PowerSound, Voice>> = {
  flame: { loop: 'fx-aura-burn', entry: .3, hold: .13, entrance: [], underALine: 1 },
  haki: { loop: 'fx-aura-haki', entry: .32, hold: .16, entrance: [['fx-enter-haki', .5]], underALine: .6 },
  reiatsu: { loop: 'fx-aura-reiatsu', entry: .32, hold: .15, entrance: [['fx-enter-reiatsu', .5]], underALine: .6 },
  chakra: { loop: 'fx-aura-chakra', entry: .28, hold: .12, entrance: [['fx-enter-chakra', .46]], underALine: .6 },
  cursed: { loop: 'fx-aura-cursed', entry: .32, hold: .15, entrance: [['fx-enter-cursed', .44]], underALine: .6 },
  nen: { loop: 'fx-aura-nen', entry: .28, hold: .11, entrance: [['fx-enter-nen', .46]], underALine: .6 },
  arcs: { loop: 'fx-electric-bed', entry: .24, hold: .11, entrance: [['fx-lightning', .34], ['fx-zap-2', .2, .1]], underALine: .3 },
  steam: { loop: 'fx-aura-steam', entry: .22, hold: .09, entrance: [['fx-steam', .4]], underALine: .5 },
  frost: { loop: 'fx-aura-frost', entry: .24, hold: .1, entrance: [['fx-enter-frost', .42]], underALine: .5 },
};

const THIN = { level: .6, rate: 1.1 };
const ROUND_A_BLADE = .55;

export interface PowerVoice {
  readonly kind: PowerSound;
  readonly stands: boolean;
  readonly level: number; readonly rate: number;
}

const OWN_LAYER: Readonly<Partial<Record<FighterId, PowerSound>>> = { killua: 'arcs', pikachu: 'arcs' };

const voice = (kind: PowerSound, stands = true, level = 1, rate = 1): PowerVoice => ({ kind, stands, level, rate });

export function heard(power: AwakenedPower): PowerVoice | undefined {
  if (power.physical) return undefined;
  const mote = power.motes?.[0];
  switch (power.kind) {
    case 'ki': return voice('flame');
    case 'haki': return power.conqueror ? voice('haki') : voice('haki', true, THIN.level, THIN.rate);
    case 'reiatsu': return voice('reiatsu', !!power.shell);
    case 'chakra': return mote === 'steam' ? voice('steam') : voice('chakra', !!power.shell);
    case 'cursed': return voice('cursed', !!power.shell);
    case 'nen': return voice('nen', !!power.shell);
    case 'plain': break;
  }
  switch (power.shell) {
    case 'flame': return voice('flame');
    case 'curse': case 'haze': return voice('cursed');
    case 'smoke': return voice(mote === 'steam' ? 'steam' : 'reiatsu');
    case 'cloak': return voice('chakra');
    case 'shroud': return voice('nen');
    case undefined: break;
  }
  if (power.arcs !== undefined) return voice('arcs');
  if (mote === 'frost') return voice('frost');
  if (mote === 'steam') return voice('steam');
  if (mote === 'flame' || mote === 'ember') return voice('flame', true, ROUND_A_BLADE);
  return undefined;
}

const voices = new Map<FighterId, PowerVoice | undefined>();
export function powerVoice(fighter: FighterId): PowerVoice | undefined {
  if (!AWAKENINGS[fighter]) return undefined;
  if (!voices.has(fighter)) { const own = OWN_LAYER[fighter]; voices.set(fighter, own ? voice(own) : heard(awakenedPower(fighter))); }
  return voices.get(fighter);
}

const OWN_ARRIVAL: ReadonlySet<FighterId> = new Set<FighterId>(['ichigo']);
export const arrivesHeard = (fighter: FighterId) => !OWN_ENTRANCES.has(fighter) && !OWN_ARRIVAL.has(fighter) && !!powerVoice(fighter);

export function powerCues(fighter: FighterId): AudioCue[] {
  const v = powerVoice(fighter);
  if (!v) return [];
  const sound = POWER_SOUNDS[v.kind];
  return [sound.loop, ...sound.entrance.map(([cue]) => cue)];
}
