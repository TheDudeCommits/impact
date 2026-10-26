import type { AttackSlot } from '../../game/types';
import type { MoveDefinition } from '../../game/moves';
import { decodeForge, forgeMoves, forgeProblems } from '../../engine/sim/forge';
import { shortForgeHash } from '../../engine/sim/forgedKits';
import { refusedName } from '../displayName';

export interface RoomKit { hash: string; code: string; moves: Record<AttackSlot, MoveDefinition> }

export function roomKit(forge: unknown, fighter: unknown, privateRoom: boolean): RoomKit {
  if (!privateRoom) throw new Error('Forged fighters play in private rooms only.');
  if (typeof forge !== 'string' || forge.length > 4096) throw new Error("That isn't a Forge code.");
  const kit = decodeForge(forge), { errors } = forgeProblems(kit, { availability: 'released' });
  if (errors.length) throw new Error(`That forged fighter can't play: ${errors[0]}`);
  if (kit.body !== fighter) throw new Error('A forged fighter plays in the body it was made for.');
  if (refusedName(kit.name.trim())) throw new Error("That forged fighter's name is not allowed.");
  return { hash: shortForgeHash(kit), code: forge, moves: forgeMoves(kit) };
}
