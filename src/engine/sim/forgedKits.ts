import { AWAKENED_MOVES } from '../../game/awakening';
import type { MoveDefinition } from '../../game/moves';
import type { ActionKind, AttackSlot, FighterId } from '../../game/types';
import { decodeForge, forgeHash, forgeMoves, forgeProblems, type ForgeKit } from './forge';

export const FORGE_HASH_LENGTH = 16;
export const shortForgeHash = (kit: ForgeKit) => forgeHash(kit).slice(0, FORGE_HASH_LENGTH);

const kits = new Map<string, Record<AttackSlot, MoveDefinition>>(), wholeKits = new Map<string, ForgeKit>();
const SLOTS: ReadonlySet<string> = new Set(['light', 'heavy', 'special', 'ultimate', 'area']);

export function rememberForgeKits(codes: unknown): number {
  if (!codes || typeof codes !== 'object') return 0;
  let added = 0;
  for (const [hash, code] of Object.entries(codes as Record<string, unknown>)) {
    if (kits.has(hash) || typeof code !== 'string' || code.length > 4096) continue;
    try {
      const kit = decodeForge(code);
      if (shortForgeHash(kit) !== hash || forgeProblems(kit).errors.length) continue;
      kits.set(hash, forgeMoves(kit)); wholeKits.set(hash, kit); added++;
    } catch { }
  }
  return added;
}
export const forgedMoves = (hash: string | undefined) => hash ? kits.get(hash) : undefined;
export const forgedKit = (hash: string | undefined) => hash ? wholeKits.get(hash) : undefined;
export const forgetForgeKits = () => { kits.clear(); wholeKits.clear(); };

export function awakenedForged(moves: Record<AttackSlot, MoveDefinition>, fighter: FighterId, slot: AttackSlot, awakened: boolean): MoveDefinition {
  const base = moves[slot], change = awakened ? AWAKENED_MOVES[fighter]?.[slot] : undefined;
  return change ? { ...base, ...change } : base;
}
export function forgedMoveFor(state: { fighter: FighterId; forge?: string; action: ActionKind; chain?: number; awakened?: boolean }): MoveDefinition | undefined {
  const moves = forgedMoves(state.forge);
  if (!moves || !SLOTS.has(state.action) || (state.action === 'light' && (state.chain ?? 0) > 0)) return undefined;
  return awakenedForged(moves, state.fighter, state.action as AttackSlot, !!state.awakened);
}
