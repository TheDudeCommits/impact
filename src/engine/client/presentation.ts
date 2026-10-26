import { FIGHTERS, type FighterDefinition } from '../../config';
import { elementFor, type Element } from '../../render/vfx/palette';
import type { AttackSlot, FighterId } from '../../game/types';
import { ATTACK_SLOTS, CORE_SLOTS, simRegistry, specHash, type Problems, type SimFighterSpec } from '../sim';

export interface CardSpec {
  name: string;
  series: string;
  color: string;
  portrait: string;
  moves: readonly string[];
  shortMoves?: readonly string[];
}
export type LookSpec = Omit<FighterDefinition, 'name' | 'series' | 'color' | 'portrait' | 'moves' | 'shortMoves'>;
export interface PaletteSpec { slots: Record<AttackSlot, Element>; awakened: Record<AttackSlot, Element> }

export interface FighterSpec extends SimFighterSpec { card: CardSpec; look: LookSpec; palette: PaletteSpec }

export function deriveSpec(sim: SimFighterSpec): FighterSpec {
  const definition = FIGHTERS[sim.id];
  if (!definition) throw new Error(`No FIGHTERS entry for "${sim.id}".`);
  const { name, series, color, portrait, moves, shortMoves, ...look } = structuredClone(definition);
  const palette: PaletteSpec = {
    slots: Object.fromEntries(ATTACK_SLOTS.map(slot => [slot, elementFor(sim.id, slot)])) as Record<AttackSlot, Element>,
    awakened: Object.fromEntries(ATTACK_SLOTS.map(slot => [slot, elementFor(sim.id, slot, true)])) as Record<AttackSlot, Element>,
  };
  return { ...sim, card: { name, series, color, portrait, moves, ...(shortMoves ? { shortMoves } : {}) }, look, palette };
}

let cache: ReadonlyMap<FighterId, FighterSpec> | undefined;
export function registry(): ReadonlyMap<FighterId, FighterSpec> {
  return cache ??= new Map([...simRegistry()].map(([id, sim]) => [id, deriveSpec(sim)]));
}
export const spec = (id: FighterId) => registry().get(id);
export const fullSpecHash = (id: FighterId) => specHash(registry().get(id));

export function presentationProblems(spec: FighterSpec): Problems {
  const out: Problems = { errors: [], warnings: [] };
  const error = (text: string) => out.errors.push(text), warn = (text: string) => out.warnings.push(text);
  if (!spec.card.name?.trim()) error('card.name is empty');
  if (!/^#[0-9a-f]{6}$/i.test(spec.card.color)) error(`card.color "${spec.card.color}" is not a #rrggbb colour`);
  if (!spec.card.portrait?.startsWith('/assets/')) error(`card.portrait "${spec.card.portrait}" is not under /assets/`);
  if (!/\.glb$/i.test(spec.look.model)) error(`look.model "${spec.look.model}" is not a .glb`);
  if (spec.card.moves.length !== CORE_SLOTS.length) error(`card.moves has ${spec.card.moves.length} names for ${CORE_SLOTS.length} slots`);
  CORE_SLOTS.forEach((slot, i) => {
    const shown = spec.card.moves[i], runs = spec.kit.slots[slot].name;
    if (shown !== undefined && !runs.toLowerCase().includes(shown.toLowerCase())) warn(`card.moves[${i}] says "${shown}" but the ${slot} the simulation runs is "${runs}"`);
  });
  if (spec.card.series !== spec.series) warn(`card.series "${spec.card.series}" differs from the server's "${spec.series}"`);
  return out;
}
