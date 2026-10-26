import { AWAKENED_MOVES, AWAKENINGS } from '../../game/awakening';
import { COMBO_KEYS, comboMove } from '../../game/combos';
import { AIR_RUSH, MOVES, RUSH, type MoveDefinition } from '../../game/moves';
import type { AttackSlot, FighterId } from '../../game/types';
import { ATTACK_SLOTS, simRegistry } from '../sim';
import { packProblems, packSlotMoves, type PackDefinition } from './pack';

interface Saved {
  moves?: Record<AttackSlot, MoveDefinition>;
  rush?: readonly MoveDefinition[];
  air?: { present: boolean; value: (typeof AIR_RUSH)[FighterId] };
  awakening?: string;
  awakened?: { present: boolean; value: (typeof AWAKENED_MOVES)[FighterId] };
  enders?: [MoveDefinition, string][];
}

export class PackSession {
  private readonly saved = new Map<FighterId, Saved>();
  private current?: PackDefinition;

  apply(pack: PackDefinition): { ok: true } | { ok: false; errors: string[] } {
    const { errors } = packProblems(pack);
    if (errors.length) return { ok: false, errors };
    this.restore();
    simRegistry();
    for (const [id, slot] of Object.entries(pack.slots) as [FighterId, NonNullable<PackDefinition['slots'][FighterId]>][]) {
      const saved: Saved = {};
      const moves = packSlotMoves(slot);
      if (moves) {
        saved.moves = { ...MOVES[id] };
        for (const each of ATTACK_SLOTS) { const move = moves[each]; if (move) MOVES[id][each] = move; }
        saved.awakened = { present: Object.hasOwn(AWAKENED_MOVES, id), value: AWAKENED_MOVES[id] };
        delete AWAKENED_MOVES[id];
      }
      const names = slot.names ?? {};
      if (Object.keys(names).length) {
        const shown = (name: string | undefined) => name === undefined ? name : names[name] ?? name;
        saved.rush = RUSH[id];
        (RUSH as Record<FighterId, readonly MoveDefinition[]>)[id] = RUSH[id].map(move => names[move.name] ? { ...move, name: names[move.name] } : move);
        saved.air = { present: Object.hasOwn(AIR_RUSH, id), value: AIR_RUSH[id] };
        const air = AIR_RUSH[id];
        if (air) AIR_RUSH[id] = [shown(air[0]), shown(air[1])!, shown(air[2])!];
        saved.awakening = AWAKENINGS[id].name;
        AWAKENINGS[id].name = shown(AWAKENINGS[id].name)!;
        const enders = new Set<MoveDefinition>();
        for (const key of COMBO_KEYS) for (const awake of [false, true]) { const ender = comboMove(id, key, awake); if (ender && names[ender.name]) enders.add(ender); }
        saved.enders = [...enders].map(ender => [ender, ender.name]);
        for (const ender of enders) ender.name = names[ender.name];
      }
      this.saved.set(id, saved);
    }
    this.current = pack;
    return { ok: true };
  }

  restore() {
    for (const [id, saved] of this.saved) {
      if (saved.moves) for (const each of ATTACK_SLOTS) MOVES[id][each] = saved.moves[each];
      if (saved.awakened) { if (saved.awakened.present) AWAKENED_MOVES[id] = saved.awakened.value; else delete AWAKENED_MOVES[id]; }
      if (saved.rush) (RUSH as Record<FighterId, readonly MoveDefinition[]>)[id] = saved.rush;
      if (saved.air) { if (saved.air.present) AIR_RUSH[id] = saved.air.value; else delete AIR_RUSH[id]; }
      if (saved.awakening !== undefined) AWAKENINGS[id].name = saved.awakening;
      for (const [ender, name] of saved.enders ?? []) ender.name = name;
    }
    this.saved.clear();
    this.current = undefined;
  }
  get pack() { return this.current; }
}
