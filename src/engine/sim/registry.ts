import { AWAKENINGS, moveFor, rushMove } from '../../game/awakening';
import { COMBO_KEYS, comboMove } from '../../game/combos';
import { AIR_RUSH, BODY_SIZE, CONTACT_GAP, JUMP_SCALE, MOVES, RUSH, RUSH_SHAPE, type MoveDefinition } from '../../game/moves';
import { factionOf } from '../../game/objectives/model';
import { LABORATORY_FIGHTERS, RELEASED_FIGHTERS } from '../../game/rosterAvailability';
import { FIGHTER_SERIES } from '../../game/stages';
import { TIME_STOP_TOURS } from '../../game/timeStopBarrage';
import type { AttackSlot, FighterId } from '../../game/types';
import type { ComboKey } from '../../game/combos';
import { bodyTypeOf, elementKitsOf } from './archetypes';
import { ATTACK_SLOTS, SPEC_VERSION, type KitSpec, type SimFighterSpec } from './spec';
import { canonicalJson, specHash } from './hash';

export const FIGHTER_IDS: readonly FighterId[] = Object.freeze(Object.keys(MOVES) as FighterId[]);

const released: ReadonlySet<string> = new Set(RELEASED_FIGHTERS), laboratory: ReadonlySet<string> = new Set(LABORATORY_FIGHTERS);
function snapshot<T>(value: T): T {
  const copy = structuredClone(value);
  const freeze = (each: unknown) => { if (each && typeof each === 'object' && !Object.isFrozen(each)) { Object.freeze(each); for (const inner of Object.values(each)) freeze(inner); } };
  freeze(copy);
  return copy;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

function kitOf(id: FighterId): KitSpec {
  const slots = Object.fromEntries(ATTACK_SLOTS.map(slot => [slot, MOVES[id][slot]])) as Record<AttackSlot, MoveDefinition>;
  const rush = RUSH[id];
  const combos: Partial<Record<ComboKey, MoveDefinition>> = {}, awakenedCombos: Partial<Record<ComboKey, MoveDefinition>> = {};
  for (const key of COMBO_KEYS) {
    const base = comboMove(id, key), awakened = comboMove(id, key, true);
    if (base) combos[key] = base;
    if (awakened && !same(awakened, base)) awakenedCombos[key] = awakened;
  }
  const awakenedSlots: Partial<Record<AttackSlot, MoveDefinition>> = {};
  for (const slot of ATTACK_SLOTS) { const move = moveFor(id, slot, true); if (!same(move, slots[slot])) awakenedSlots[slot] = move; }
  const awakenedRush = rush.map((move, i) => { const awakened = rushMove(id, i + 1, true); return same(awakened, move) ? null : awakened; });
  return {
    slots, rush, rushShape: RUSH_SHAPE[id], ...(AIR_RUSH[id] ? { airRush: AIR_RUSH[id] } : {}), combos,
    awakening: AWAKENINGS[id],
    awakened: { slots: awakenedSlots, rush: awakenedRush.some(Boolean) ? awakenedRush : [], combos: awakenedCombos },
    ...(TIME_STOP_TOURS[id] ? { timeStopTour: TIME_STOP_TOURS[id] } : {}),
  };
}

export function deriveSimSpec(id: FighterId): SimFighterSpec {
  if (!MOVES[id]) throw new Error(`No fighter "${id}" in the tables.`);
  return snapshot({
    spec: SPEC_VERSION, id, pack: 'jump' as const, series: FIGHTER_SERIES[id], faction: factionOf(id),
    availability: { released: released.has(id), laboratory: laboratory.has(id) },
    archetype: { body: bodyTypeOf(id)!, elements: [...elementKitsOf(id)] },
    body: { contactGap: CONTACT_GAP[id], bodySize: BODY_SIZE[id] ?? 1, jumpScale: JUMP_SCALE[id] ?? 1 },
    kit: kitOf(id),
  });
}

let cache: ReadonlyMap<FighterId, SimFighterSpec> | undefined;
export function simRegistry(): ReadonlyMap<FighterId, SimFighterSpec> {
  return cache ??= new Map(FIGHTER_IDS.map(id => [id, deriveSimSpec(id)]));
}
export const simSpec = (id: FighterId) => simRegistry().get(id);
export const simSpecHash = (id: FighterId) => specHash(simRegistry().get(id));
