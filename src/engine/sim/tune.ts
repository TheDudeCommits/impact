import type { MoveDefinition } from '../../game/moves';
import type { AttackSlot, FighterId } from '../../game/types';
import { capArea, onLook } from './areaDamage';

export const TUNE_LIMITS = { power: [0.8, 1.2], reach: [0.8, 1.2], speed: [0.85, 1.15] } as const;
export type TuneKey = keyof typeof TUNE_LIMITS;

export const FORGE_STATUSES = {
  burn: { kind: 'burn', seconds: 3, dps: 10 },
  slow: { kind: 'slow', seconds: 2.5, factor: .65 },
  freeze: { kind: 'freeze', seconds: .6 },
} as const satisfies Record<string, NonNullable<MoveDefinition['status']>>;
export type ForgeStatus = keyof typeof FORGE_STATUSES;

export interface ForgeFx {
  effect: string;
  settings?: Record<string, number | string | boolean>;
  scale?: number;
  hue?: number;
}
export interface SlotPick {
  from: FighterId;
  fromSlot?: AttackSlot;
  tune?: Partial<Record<TuneKey, number>>;
  status?: ForgeStatus;
  fx?: ForgeFx;
}
export const pickSource = (slot: AttackSlot, pick: SlotPick): { fighter: FighterId; slot: AttackSlot } => ({ fighter: pick.from, slot: pick.fromSlot ?? slot });

const clampTune = (key: TuneKey, value: number | undefined) => {
  const [lo, hi] = TUNE_LIMITS[key];
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : 1;
};
const round = (value: number, places = 3) => +value.toFixed(places);

export function tuneMove(source: MoveDefinition, pick: Pick<SlotPick, 'tune' | 'status' | 'fx'>): MoveDefinition {
  const power = clampTune('power', pick.tune?.power), reach = clampTune('reach', pick.tune?.reach), speed = clampTune('speed', pick.tune?.speed);
  const move = structuredClone(source) as MoveDefinition;
  if (move.area && pick.fx?.effect) onLook(move, pick.fx.effect);
  if (power !== 1) {
    move.damage = Math.round(move.damage * power);
    if (move.finisherDamage !== undefined) move.finisherDamage = Math.round(move.finisherDamage * power);
    if (move.schedule) move.schedule = move.schedule.map(each => Math.round(each * power));
  }
  if (reach !== 1) move.range = round(move.range * reach, 2);
  if (pick.status && FORGE_STATUSES[pick.status]) move.status = { ...FORGE_STATUSES[pick.status] };
  if (speed !== 1) {
    const time = (t: number) => round(t / speed);
    move.duration = time(move.duration);
    move.contacts = move.contacts.map(time);
    if (move.lungeDelay !== undefined) move.lungeDelay = time(move.lungeDelay);
    if (move.active !== undefined) move.active = time(move.active);
    if (move.teleport) move.teleport = { ...move.teleport, vanish: time(move.teleport.vanish), appear: time(move.teleport.appear) };
    if (move.confirm) move.confirm = { recovery: time(move.confirm.recovery) };
  }
  return move.area ? capArea(move) : move;
}
