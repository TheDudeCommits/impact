import { isReleasedFighter } from './rosterAvailability';
import { MOVES } from './moves';
import { HELD } from './economy/fighters';
import type { FighterId } from './types';

const ROSTER = (Object.keys(MOVES) as FighterId[]).filter(f => isReleasedFighter(f) && !HELD.has(f));

export function draftBots(taken: readonly FighterId[], count: number, shuffle: <T>(items: readonly T[]) => T[]): FighterId[] {
  const pool = ROSTER.filter(f => !taken.includes(f));
  const deck = pool.length ? pool : ROSTER;
  const draft: FighterId[] = [];
  while (draft.length < count) draft.push(...shuffle(deck));
  return draft.slice(0, count);
}

