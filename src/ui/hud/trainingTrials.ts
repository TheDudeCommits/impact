import { AWAKENINGS, moveFor, rushMove } from '../../game/awakening';
import { COMBO_INPUTS, comboMove, hasCombos, type ComboKey } from '../../game/combos';
import { AIR_NORMAL_FIGHTERS, AIR_RUSH, airRushName, RUSH_AIR_STAGES, RUSH_STAGES } from '../../game/moves';
import type { AttackSlot, CombatEvent, FighterId } from '../../game/types';
import { GUARD_GUIDE } from '../guardGuide';

export type TrialPress = 'jump' | AttackSlot | 'awaken';
export type TrialSection = 'string' | 'enders' | 'air' | 'specials';
export const TRIAL_SECTIONS: readonly TrialSection[] = ['string', 'enders', 'air', 'specials'];
export const SECTION_TITLES: Readonly<Record<TrialSection, string>> = { string: 'THE STRING', enders: 'ENDERS', air: 'IN THE AIR', specials: 'SPECIAL MOVES' };
export interface Trial { id: string; section: TrialSection; inputs: readonly TrialPress[]; name: string }

const MINOR = new Set(['of', 'the', 'no', 'a', 'an', 'and', 'to', 'in']);
const titled = (name: string) => name !== name.toUpperCase() ? name
  : name.toLowerCase().replace(/\p{L}+/gu, (word, at: number) => at > 0 && MINOR.has(word) ? word : word[0].toUpperCase() + word.slice(1));
const lights = (n: number): TrialPress[] => Array(n).fill('light');

export function trialsFor(id: FighterId): Trial[] {
  const out: Trial[] = [], combos = hasCombos(id);
  for (let stage = 0; stage < RUSH_STAGES; stage++) out.push({ id: `string-${stage}`, section: 'string', inputs: lights(stage + 1), name: rushMove(id, stage, false).name });
  const ender = (key: ComboKey, section: TrialSection) => { const move = comboMove(id, key); if (move) out.push({ id: key, section, inputs: COMBO_INPUTS[key], name: move.name }); };
  if (combos) for (const key of ['lh', 'llh', 'lllh', 'llls'] as const) ender(key, 'enders');
  const own = AIR_RUSH[id];
  if (own) for (let stage = 0; stage < RUSH_AIR_STAGES; stage++)
    out.push({ id: `air-${stage}`, section: 'air', inputs: ['jump', ...lights(stage + 1)], name: own[stage] ?? rushMove(id, stage, false).name });
  else out.push({ id: 'air-0', section: 'air', inputs: ['jump', 'light'], name: (AIR_NORMAL_FIGHTERS.includes(id) ? airRushName(id, 0) : undefined) ?? rushMove(id, 0, false).name });
  if (combos) { ender('airHeavy', 'air'); ender('airSpecial', 'air'); }
  for (const slot of ['heavy', 'special', 'area', 'ultimate'] as const) out.push({ id: slot, section: 'specials', inputs: [slot], name: moveFor(id, slot, false).name });
  out.push({ id: 'awaken', section: 'specials', inputs: ['awaken'], name: titled(AWAKENINGS[id].name) });
  return out;
}

export function trialOf(event: CombatEvent, air: boolean): string | undefined {
  if (event.kind === 'awaken') return 'awaken';
  if (event.kind !== 'hit') return undefined;
  if (event.branch) return event.branch;
  if (event.slot === 'light') return event.chain === undefined ? undefined : `${air ? 'air' : 'string'}-${event.chain}`;
  if (event.slot === 'heavy' || event.slot === 'special' || event.slot === 'area' || event.slot === 'ultimate') return event.slot;
  return undefined;
}

export type DefenceTrialId = 'block' | 'parry' | 'break';
const DEFENCE_ID: Readonly<Record<(typeof GUARD_GUIDE)[number]['name'], DefenceTrialId>> = { Block: 'block', 'Perfect Parry': 'parry', 'Guard Break': 'break' };
export const DEFENCE_TRIALS: readonly { id: DefenceTrialId; name: string; how: string; keyed: boolean }[] =
  GUARD_GUIDE.map(g => ({ id: DEFENCE_ID[g.name], name: g.name, how: g.how, keyed: DEFENCE_ID[g.name] !== 'break' }));
export function defenceTrialOf(event: CombatEvent, self: string): DefenceTrialId | undefined {
  if (!self) return undefined;
  if (event.kind === 'blocked' && event.targetId === self) return 'block';
  if (event.kind === 'just-guard' && event.targetId === self) return 'parry';
  if (event.kind === 'guard-break' && event.actorId === self && event.targetId && event.targetId !== self) return 'break';
  return undefined;
}

export const STRING_GRACE = 1.5;
export class ComboTracker {
  hits = 0; damage = 0;
  bestHits = 0; bestDamage = 0;
  private at = -Infinity;
  hit(combo: number | undefined, damage: number, now: number) {
    if (combo === undefined) {
      if (now - this.at <= STRING_GRACE && this.hits) this.damage += damage;
    } else {
      if (combo <= 1) { this.hits = 1; this.damage = damage; }
      else { this.hits = Math.max(combo, this.hits); this.damage += damage; }
    }
    this.at = now;
    if (this.hits > this.bestHits || (this.hits === this.bestHits && this.damage > this.bestDamage)) { this.bestHits = this.hits; this.bestDamage = this.damage; }
  }
  reset() { this.hits = this.damage = this.bestHits = this.bestDamage = 0; this.at = -Infinity; }
}
