import type { MoveDefinition } from '../../game/moves';
import strikeData from './areaStrikes.json';
import lookData from './areaLooks.json';

export const AREA_STRIKES = strikeData as Readonly<Record<string, readonly number[]>>;
export const AREA_LOOKS = lookData as Readonly<Record<string, readonly string[]>>;

export const AREA_DAMAGE_CEILING = 240;
export const AREA_BULLSEYE = .25;
export const AREA_RIM = .5;

export function areaFalloff(distance: number, radius: number): number {
  const u = radius > 0 ? Math.max(0, distance) / radius : 0;
  if (u <= AREA_BULLSEYE) return 1;
  return Math.max(AREA_RIM, 1 - (1 - AREA_RIM) * (u - AREA_BULLSEYE) / (1 - AREA_BULLSEYE));
}
export const isBullseye = (distance: number, radius: number) => distance <= radius * AREA_BULLSEYE;

export const lookLead = (effect: string | undefined): number => (effect ? AREA_STRIKES[effect]?.[0] : undefined) ?? 0;
export function lookStrikes(effect: string | undefined): number[] {
  const at = effect ? AREA_STRIKES[effect] : undefined;
  return at?.length ? at.map(t => +(t - at[0]).toFixed(2)) : [0];
}

export const pinnedSchedule = (move: MoveDefinition): boolean => move.area?.hits !== undefined || move.area?.interval !== undefined;
export function strikeOffsets(move: MoveDefinition): number[] {
  const area = move.area;
  if (!area) return [0];
  if (area.strikes?.length) return [...area.strikes];
  const hits = Math.max(1, area.hits ?? 1), every = area.interval ?? .2;
  return Array.from({ length: hits }, (_, k) => +(k * every).toFixed(3));
}
export function areaTotal(move: MoveDefinition): number {
  const n = strikeOffsets(move).length;
  return move.damage * (n - 1) + (move.finisherDamage ?? move.damage);
}

function lay(move: MoveDefinition, total: number, n: number) {
  const each = Math.max(1, Math.round(total / n));
  move.damage = each;
  if (n > 1) move.finisherDamage = Math.max(1, total - each * (n - 1)); else delete move.finisherDamage;
}
export function capArea(move: MoveDefinition): MoveDefinition {
  const total = areaTotal(move);
  if (!move.area || total <= AREA_DAMAGE_CEILING) return move;
  if (pinnedSchedule(move)) {
    const k = AREA_DAMAGE_CEILING / total;
    move.damage = Math.max(1, Math.floor(move.damage * k));
    if (move.finisherDamage !== undefined) move.finisherDamage = Math.max(1, Math.floor(move.finisherDamage * k));
  } else lay(move, AREA_DAMAGE_CEILING, strikeOffsets(move).length);
  return move;
}

export function onLook(move: MoveDefinition, effect: string | undefined): MoveDefinition {
  const area = move.area;
  if (!area) return move;
  const total = areaTotal(move);
  if (effect) area.fx = effect; else delete area.fx;
  if (!pinnedSchedule(move)) {
    const at = lookStrikes(effect);
    if (at.length > 1) area.strikes = at; else delete area.strikes;
    lay(move, total, at.length);
  } else delete area.strikes;
  return capArea(move);
}
