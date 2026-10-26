import type { AttackSlot, CombatEvent, FighterId } from '../../../game/types';
import type { Fighter } from '../../Fighter';
import { moveSource, presentationKit } from '../../../engine/client/forgeLive';
import { pickSource, type ForgeFx } from '../../../engine/sim/forge';


export const MOVE_SLOTS: readonly AttackSlot[] = ['light', 'heavy', 'special', 'ultimate', 'area'];

export function kitOwner(f: Fighter | undefined): { fighter: FighterId; forge?: string } | undefined {
  const state = f?.state;
  if (!state || state.enemy) return undefined;
  return { fighter: (f as Fighter & { bodyFighter?: FighterId }).bodyFighter ?? state.fighter, forge: state.forge };
}

export function bodySlotOf(owner: { fighter: FighterId; forge?: string }, event: CombatEvent): AttackSlot | undefined {
  if (!event.slot || event.branch !== undefined || (event.slot === 'light' && (event.chain ?? 0) > 0)) return undefined;
  if (!event.body || event.body === event.fighter) return event.slot;
  const kit = presentationKit(owner);
  if (!kit) return undefined;
  for (const slot of MOVE_SLOTS) {
    const pick = kit.slots[slot];
    if (!pick) continue;
    const source = pickSource(slot, pick);
    if (source.fighter === event.fighter && source.slot === event.slot) return slot;
  }
  return undefined;
}

export function eventFx(event: CombatEvent, fighters: ReadonlyMap<string, Fighter> | undefined): ForgeFx | undefined {
  const owner = kitOwner(fighters?.get(event.actorId));
  if (!owner) return undefined;
  const slot = bodySlotOf(owner, event);
  return slot ? presentationKit(owner)?.slots[slot]?.fx : undefined;
}

export function auraFx(f: Fighter | undefined): ForgeFx | undefined {
  const owner = kitOwner(f);
  return owner ? presentationKit(owner)?.aura : undefined;
}

export function* kitSlots(f: Fighter): Generator<{ key: string; fx: ForgeFx }> {
  const owner = kitOwner(f);
  const kit = owner ? presentationKit(owner) : undefined;
  if (!owner || !kit) return;
  for (const slot of MOVE_SLOTS) {
    const fx = kit.slots[slot]?.fx;
    if (!fx) continue;
    const source = moveSource(owner, slot);
    yield { key: source ? `${source.fighter}:${source.slot}` : `${owner.fighter}:${slot}`, fx };
  }
}
