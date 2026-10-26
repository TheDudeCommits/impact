import { MOVES, type MoveDefinition } from '../src/game/moves';
import type { AttackSlot, FighterId } from '../src/game/types';

export const METEOR_COMBINATION: MoveDefinition = { name: 'Meteor Combination', duration: 1.33, contacts: [0.38, 0.56, 0.83], damage: 26, range: 1.4, radius: 0.3, stamina: 22, cooldown: 1.55, stun: 0.2, finisherStun: 0.8, knockback: 7, finisherKnockback: 11, lunge: 4, style: 'melee' };
export const KI_BLAST_VOLLEY: MoveDefinition = { name: 'Ki-blast Volley', duration: 0.58, contacts: [0.11, 0.24], damage: 16, range: 16, radius: .2, stamina: 9, cooldown: 0.56, stun: .15, knockback: 1, speed: 35, style: 'projectile' };

export function withMove<T>(fighter: FighterId, slot: AttackSlot, move: MoveDefinition, body: () => T): T {
  const shipped = MOVES[fighter][slot];
  MOVES[fighter][slot] = move;
  try {
    const result = body();
    if (result instanceof Promise) return result.finally(() => { MOVES[fighter][slot] = shipped; }) as T;
    MOVES[fighter][slot] = shipped;
    return result;
  } catch (error) { MOVES[fighter][slot] = shipped; throw error; }
}
