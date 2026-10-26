import { describe, expect, it } from 'vitest';
import type { GameSnapshot, PlayerState } from '../../game/types';
import { trainingPresentation } from './TrainingHud';
import type { ModeHudFrame } from './modeHud';

const frame = (self: Partial<PlayerState> = {}, extra: Partial<ModeHudFrame> = {}): ModeHudFrame => ({
  self: { id: 'me', alive: true, action: 'idle', ...self } as PlayerState,
  snapshot: {} as GameSnapshot,
  phase: 'active', input: 'keyboard', family: 'generic', now: 0, ...extra,
});

describe('Training signature-move presentation', () => {
  it('clears diagnostics only after the local ultimate confirms, including confirmation at time zero', () => {
    expect(trainingPresentation(frame({ action: 'ultimate' }))).toBeUndefined();
    expect(trainingPresentation(frame({ action: 'ultimate', confirmedAt: 0 }))).toBe('ultimate');
    expect(trainingPresentation(frame({ action: 'ultimate', confirmedAt: 1, whiffedAt: 2 }))).toBeUndefined();
    expect(trainingPresentation(frame({ action: 'idle', confirmedAt: 1 }))).toBeUndefined();
  });

  it('restores readings after the awakening entry, while the awakened form stays active', () => {
    expect(trainingPresentation(frame({ action: 'awaken' }))).toBe('awaken');
    expect(trainingPresentation(frame({ action: 'idle', awakened: true }))).toBeUndefined();
    expect(trainingPresentation(frame({ action: 'special', awakened: true }))).toBeUndefined();
  });

  it('keeps frame inspection, the open laboratory and inactive states readable', () => {
    const move = frame({ action: 'ultimate', confirmedAt: 1 });
    expect(trainingPresentation(move, true)).toBeUndefined();
    expect(trainingPresentation({ ...move, snapshot: { trainingLab: { frozen: true } } as GameSnapshot })).toBeUndefined();
    expect(trainingPresentation({ ...move, phase: 'over' })).toBeUndefined();
    expect(trainingPresentation({ ...move, phase: 'waiting' })).toBeUndefined();
    expect(trainingPresentation(frame({ action: 'awaken', alive: false }))).toBeUndefined();
    expect(trainingPresentation(move, false)).toBe('ultimate');
  });

  it('does not suppress diagnostics for an opponent\'s presentation', () => {
    const enemy = { id: 'dummy', alive: true, action: 'ultimate', confirmedAt: 1 } as PlayerState;
    expect(trainingPresentation(frame({}, { target: enemy, snapshot: { players: [enemy] } as GameSnapshot }))).toBeUndefined();
  });
});
