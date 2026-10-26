import { WHIFF_RECOVERY, type MoveDefinition } from '../../game/moves';
import type { PlayerState } from '../../game/types';

export const landed = (s: PlayerState) => s.action === 'ultimate' && s.confirmedAt !== undefined;
export const whiffEnd = (s: PlayerState) => s.whiffedAt === undefined ? Infinity : s.whiffedAt - s.actionStarted - (s.actionFrozen ?? 0) + WHIFF_RECOVERY;
export const ultimateEnd = (s: PlayerState) => Math.min(s.actionDuration, whiffEnd(s));
export const beats = (s: PlayerState, move: Pick<MoveDefinition, 'contacts' | 'confirm'>) =>
  s.action === 'ultimate' && move.confirm && s.confirmedAt === undefined ? Math.min(1, move.contacts.length) : move.contacts.length;
export const WHIFF_CLEAR = .15;
export const whiffAt = (s: PlayerState) => s.whiffedAt === undefined ? Infinity : s.whiffedAt - s.actionStarted - (s.actionFrozen ?? 0);
export const whiffGone = (s: PlayerState) => whiffAt(s) + WHIFF_CLEAR;
export const OPENER_FEED = .15;
export const undecided = (s: PlayerState) => s.action === 'ultimate' && s.confirmedAt === undefined && s.whiffedAt === undefined;
