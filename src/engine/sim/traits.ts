import { AIR_NORMAL_FIGHTERS } from '../../game/moves';
import type { AttackSlot, FighterId } from '../../game/types';

export interface BodyTraits {
  driveMelee?: true;
  lockNearMeleeLunge?: true;
  quietMeleeRelease?: true;
  airNormals?: true;
  awakenedOwnMoves?: true;
  groundedOpeners?: 'all' | readonly AttackSlot[];
}

const DRIVE_MELEE: readonly FighterId[] = ['tsunade', 'gintoki', 'kakashi', 'sasuke', 'zoro', 'ichigo', 'sanji', 'denji', 'akainu', 'yoruichi', 'yuji'];

const TRAITS: Partial<Record<FighterId, BodyTraits>> = {};
const add = (ids: readonly FighterId[], traits: BodyTraits) => { for (const id of ids) TRAITS[id] = { ...TRAITS[id], ...traits }; };
add(DRIVE_MELEE, { driveMelee: true });
add(AIR_NORMAL_FIGHTERS, { airNormals: true });
add(['goku'], { lockNearMeleeLunge: true, groundedOpeners: 'all' });
add(['goku', 'naruto'], { quietMeleeRelease: true });
add(['jotaro'], { awakenedOwnMoves: true });
add(['dio'], { groundedOpeners: ['heavy'] });
for (const traits of Object.values(TRAITS)) Object.freeze(traits);

const NONE: BodyTraits = Object.freeze({});
export const traitsOf = (id: FighterId): BodyTraits => TRAITS[id] ?? NONE;
export const BODY_TRAITS: Readonly<Partial<Record<FighterId, BodyTraits>>> = TRAITS;
