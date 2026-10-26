import type { AttackSlot, FighterId } from '../game/types';
import type { AudioCue } from './cueTypes';

export interface Signature {
  readonly what: string;
  readonly cast?: readonly (readonly [cue: AudioCue, gain: number, when: 'contact' | 'vanish' | 'appear' | number, rate?: number])[];
  readonly hit?: readonly (readonly [cue: AudioCue, gain: number])[];
  readonly base?: true;
}

const KAMEHAMEHA = 'ki gathered between two hands: a hum that pulses, each pulse quicker and higher than the last, sparks crowding in as it tightens';
const DIABLE = 'a leg spun until it burns: a whirr that climbs turn after turn and catches with a flare; and where the kick lands, the hiss of scorched air';
const DISMANTLE = 'a cut with no blade: two thin slices a twentieth of a second apart, cold and dry';
const GEAR = 'the gear firing: a burst of gas and the cable paying out, a thin whir that climbs as the reel spins up';

export const SIGNATURES: Readonly<Partial<Record<FighterId, Partial<Record<AttackSlot, Signature>>>>> = {
  goku: {
    heavy: { what: 'Instant Transmission\'s snap - a quick high note falling, a breath, the same note rising - as he vanishes, and again where he is', cast: [['fx-sig-goku-it', .42, 'vanish'], ['fx-sig-goku-it', .36, 'appear', 1.1]] },
    special: { what: KAMEHAMEHA, cast: [['fx-sig-kame-charge', .4, 'contact']] },
  },
  vegeta: {
    special: { what: 'the Galick Gun charging: rougher than a Saiyan\'s blue, a saw-edged growl that buzzes as it climbs', cast: [['fx-sig-vegeta-galick', .44, 'contact']] },
    ultimate: { what: 'Final Flash: electricity tearing wider and wider between his hands, then the flash - a crack and a wide roar', cast: [['fx-sig-vegeta-flash', .46, 'contact']] },
  },
  sanji: {
    special: { what: DIABLE, cast: [['fx-sig-sanji-diable', .42, 'contact']], hit: [['fx-sig-sanji-sear', .4]] },
    ultimate: { what: DIABLE, cast: [['fx-sig-sanji-diable', .42, 'contact']], hit: [['fx-sig-sanji-sear', .44]] },
  },
  ace: { special: { what: 'Hiken, the Fire Fist: a deep whoomp as the column of fire leaves his arm, and a jet\'s roar behind it', cast: [['fx-sig-ace-hiken', .46, 'contact']] } },
  'goku-black': { special: { what: KAMEHAMEHA + ' (his, darker: played slower)', cast: [['fx-sig-kame-charge', .38, 'contact', .86]] } },
  sukuna: {
    heavy: { what: DISMANTLE, cast: [['fx-sig-sukuna-dismantle', .38, 'contact']], hit: [['fx-sig-sukuna-dismantle', .42]] },
    special: { what: DISMANTLE, cast: [['fx-sig-sukuna-dismantle', .4, 'contact']], hit: [['fx-sig-sukuna-dismantle', .44]] },
  },
  levi: { special: { what: GEAR, cast: [['fx-sig-odm', .42, .05]] }, ultimate: { what: GEAR, cast: [['fx-sig-odm', .4, .05]] } },
  mikasa: { special: { what: GEAR, cast: [['fx-sig-odm', .42, .05, 1.06]] }, ultimate: { what: GEAR, cast: [['fx-sig-odm', .4, .05, 1.06]] } },
  eren: { special: { what: GEAR, cast: [['fx-sig-odm', .42, .05, .96]], base: true }, ultimate: { what: GEAR, cast: [['fx-sig-odm', .4, .05, .96]], base: true } },
  gon: { ultimate: { what: 'Jajanken, first comes rock: aura drawn into one fist - a hum swelling under a heavy double beat, like a heart, that comes quicker each time', cast: [['fx-sig-gon-jajanken', .44, 'contact']] } },
};

export function signatureCues(fighter: FighterId): AudioCue[] {
  const rows = Object.values(SIGNATURES[fighter] ?? {});
  return [...new Set(rows.flatMap(row => [...(row.cast ?? []), ...(row.hit ?? [])].map(([cue]) => cue)))];
}
