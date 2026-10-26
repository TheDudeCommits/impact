import { LANDED } from '../../game/landedBlows';
import type { Fighter } from '../Fighter';

export function struckBody(f: Fighter, fighters: ReadonlyMap<string, Fighter>): Fighter | undefined {
  const s = f.state;
  if (!s.target || s.actionSeq === undefined) return undefined;
  const victim = fighters.get(s.target);
  return victim?.state.alive && LANDED.landed(s.id, s.actionSeq, s.target, s.actionStarted) ? victim : undefined;
}
export const FIZZLE_REACH = .32;
