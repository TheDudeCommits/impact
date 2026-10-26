import { ARENAS, DUEL_ARENAS } from './social/custom';
import { SMALL_ROYALE_STAGES, type StageId } from './stages';

export type StageChoice = 'random' | StageId;
export const DEFAULT_CHOICE: StageChoice = 'random';

const PLACES: Readonly<Record<string, readonly StageId[]>> = {
  duel: DUEL_ARENAS,
  training: DUEL_ARENAS,
  royale: ARENAS.royale,
  'bad-blood': ARENAS['bad-blood'],
};

export function placesFor(mode: string, way: string): readonly StageId[] {
  return way === 'offline' || way === 'friends' ? PLACES[mode] ?? [] : [];
}

export function placeFits(stage: StageId, field?: number): boolean {
  return field === undefined || field <= (SMALL_ROYALE_STAGES[stage] ?? Infinity);
}

export function namedPlace(saved: unknown, mode: string, way: string, field?: number): StageId | undefined {
  return typeof saved === 'string' && placesFor(mode, way).includes(saved as StageId) && placeFits(saved as StageId, field) ? saved as StageId : undefined;
}

export function dealPlace(pool: readonly StageId[], previous?: StageId, rnd: () => number = Math.random): StageId {
  const choices = pool.filter(stage => stage !== previous), from = choices.length ? choices : pool;
  return from[Math.min(from.length - 1, Math.floor(rnd() * from.length))];
}

const automated = () => typeof navigator === 'object' && navigator !== null && (navigator as { webdriver?: boolean }).webdriver === true;

let lastDealt: StageId | undefined;
export function placeForStart(named: StageId | undefined, mode: string, way: string, field?: number, driven = automated()): StageId | undefined {
  const pool = placesFor(mode, way).filter(stage => placeFits(stage, field));
  if (named && pool.includes(named)) return named;
  if (!pool.length || mode === 'royale' || driven) return undefined;
  return lastDealt = dealPlace(pool, lastDealt);
}
export const forgetDeal = () => { lastDealt = undefined; };

export function royaleRules(named: StageId | undefined, players?: number): { arena: StageId; players?: number } | undefined {
  const arena = placeForStart(named, 'royale', 'friends', players);
  return arena ? players === undefined ? { arena } : { arena, players } : undefined;
}
