import { isReleasedFighter } from '../rosterAvailability';
import { ITEMS, released } from './catalog';
import { owns, type Owner } from './account';
import type { FighterId } from '../types';

export const LOCKED: ReadonlyMap<FighterId, string> = new Map(ITEMS
  .filter(each => each.kind === 'fighter' && released(each) && each.fighter)
  .map(each => [each.fighter!, each.id] as const));

export const HELD: ReadonlySet<FighterId> = new Set(ITEMS
  .filter(each => each.kind === 'fighter' && !released(each) && each.fighter)
  .map(each => each.fighter!));

export const mayPlay = (fighter: FighterId, owner: Owner | undefined) => {
  if (!isReleasedFighter(fighter) || HELD.has(fighter)) return false;
  const unlock = LOCKED.get(fighter);
  return !unlock || owns(owner, unlock);
};

export function lockedOut(fighter: FighterId, owner: Owner | undefined): string | undefined {
  if (!isReleasedFighter(fighter)) return 'This fighter is not available.';
  if (mayPlay(fighter, owner)) return undefined;
  if (HELD.has(fighter)) return `${ITEMS.find(each => each.kind === 'fighter' && each.fighter === fighter)?.name ?? fighter} is not out yet. The Training Ground is open to every fighter.`;
  const name = ITEMS.find(each => each.id === LOCKED.get(fighter))?.name ?? fighter;
  return `${name} is locked: unlock them in Account to play here. The Training Ground is open to every fighter.`;
}
