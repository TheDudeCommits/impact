import type { MoveDefinition } from '../../game/moves';
import type { TourStyle } from '../../game/timeStopBarrage';
import type { AttackSlot, FighterId } from '../../game/types';
import { pickSource, tuneMove, type ForgeFx, type SlotPick } from './tune';
import data from './houseKits.json';

export interface HouseKit { slots?: Partial<Record<AttackSlot, SlotPick>>; aura?: ForgeFx; why?: string }

export const HOUSE_KITS: Readonly<Partial<Record<FighterId, HouseKit>>> = data as Partial<Record<FighterId, HouseKit>>;
export const houseKit = (fighter: FighterId): HouseKit | undefined => HOUSE_KITS[fighter];
export const housePick = (fighter: FighterId, slot: AttackSlot): SlotPick | undefined => HOUSE_KITS[fighter]?.slots?.[slot];
export const ownPick = (fighter: FighterId, slot: AttackSlot, pick: SlotPick) => { const from = pickSource(slot, pick); return from.fighter === fighter && from.slot === slot; };
export function authoredSource(fighter: FighterId, slot: AttackSlot): { fighter: FighterId; slot: AttackSlot } {
  const pick = housePick(fighter, slot);
  return pick && !ownPick(fighter, slot, pick) ? pickSource(slot, pick) : { fighter, slot };
}

export function applyHouseKits(moves: Record<FighterId, Record<AttackSlot, MoveDefinition>>, tours: Partial<Record<FighterId, TourStyle>> = {},
  kits: Readonly<Partial<Record<FighterId, HouseKit>>> = HOUSE_KITS): string[] {
  const authored = new Map<FighterId, Record<AttackSlot, MoveDefinition>>();
  for (const id of Object.keys(moves) as FighterId[]) authored.set(id, { ...moves[id] });
  const changed: string[] = [];
  for (const [id, house] of Object.entries(kits) as [FighterId, HouseKit][]) {
    if (!moves[id] || !house?.slots) continue;
    for (const [slot, pick] of Object.entries(house.slots) as [AttackSlot, SlotPick][]) {
      const from = pick ? pickSource(slot, pick) : undefined, source = from ? authored.get(from.fighter)?.[from.slot] : undefined;
      if (!from || !source || !(slot in moves[id])) continue;
      const move = tuneMove(source, pick);
      const tour = tours[from.fighter];
      if (move.timeStop && !move.timeStop.tour && tour && (from.fighter !== id || from.slot !== slot)) move.timeStop = { ...move.timeStop, tour };
      moves[id][slot] = move;
      changed.push(`${id}.${slot}`);
    }
  }
  return changed;
}
