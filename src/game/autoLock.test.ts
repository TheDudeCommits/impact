import { describe, expect, it } from 'vitest';
import { AutoLock } from './autoLock';
import { Targeting } from './Targeting';

const player = (id: string, over: Record<string, unknown> = {}) => ({ id, alive: true, x: 0, y: 0, z: 0, ...over });
const duel = (round: number, phase = 'playing', over: Record<string, unknown> = {}) => ({ roomMode: 'match', status: 'active', serverTime: 10, events: [],
  players: [player('me'), player('them', { z: 4 })], duel: { set: 1, round, firstTo: 2, scores: {}, phase, nextRoundAt: null, roundWinner: null, winner: null, runback: [] }, ...over }) as never;
const training = (over: Record<string, unknown> = {}) => ({ roomMode: 'training', status: 'active', serverTime: 10, events: [], players: [player('me'), player('sparring-bot', { z: 3, isBot: true })], ...over }) as never;
const royale = (players: number) => ({ roomMode: 'match', status: 'active', serverTime: 10, events: [], players: Array.from({ length: players }, (_, i) => player(i ? `bot-${i}` : 'me', { z: i })) }) as never;

describe('a 1v1 fight starts locked onto the opponent', () => {
  it('locks a Duel round and Training onto the one opponent, unless the lock is on already', () => {
    const auto = new AutoLock();
    expect(auto.want(duel(1), 'me', 1, false)).toBe('them');
    expect(auto.want(duel(1), 'me', 1, true)).toBeUndefined();
    expect(auto.want(training(), 'me', 1, false)).toBe('sparring-bot');
  });
  it('waits for the fight: not before it is on, not between a Duel\'s rounds', () => {
    const auto = new AutoLock();
    expect(auto.want(duel(1, 'playing', { status: 'waiting' }), 'me', 1, false)).toBeUndefined();
    expect(auto.want(duel(1, 'interval'), 'me', 1, false)).toBeUndefined();
    expect(auto.want(duel(1, 'complete'), 'me', 1, false)).toBeUndefined();
  });
  it('keeps a lock the player let go of off for the rest of the round, and locks the next round again', () => {
    const auto = new AutoLock();
    auto.decline(duel(1), 1);
    expect(auto.want(duel(1), 'me', 1, false)).toBeUndefined();
    expect(auto.want(duel(2), 'me', 1, false)).toBe('them');
    auto.decline(training(), 1);
    expect(auto.want(training(), 'me', 1, false)).toBeUndefined();
    expect(auto.want(training(), 'me', 2, false)).toBe('sparring-bot');
  });
  it('leaves the royale alone - its last two included - and never locks a teammate, an enemy of the horde or the dead', () => {
    const auto = new AutoLock();
    expect(auto.want(royale(6), 'me', 1, false)).toBeUndefined();
    expect(auto.want(royale(2), 'me', 1, false)).toBeUndefined();
    expect(AutoLock.rival(duel(1, 'playing', { players: [player('me', { team: 'a' }), player('mate', { team: 'a' }), player('them', { team: 'b' })] }), 'me')).toBe('them');
    expect(AutoLock.rival(duel(1, 'playing', { players: [player('me'), player('oni', { enemy: 'oni' }), player('them')] }), 'me')).toBe('them');
    expect(auto.want(duel(1, 'playing', { players: [player('me'), player('them', { alive: false })] }), 'me', 1, false)).toBeUndefined();
    expect(auto.want(duel(1, 'playing', { players: [player('me', { alive: false }), player('them')] }), 'me', 1, false)).toBeUndefined();
  });
  it('locks as Tab does: Targeting holds the lock, and Tab on the only opponent lets it go', () => {
    const targeting = new Targeting(), s = duel(1) as unknown as { players: never[] };
    targeting.lockOn('them');
    expect(targeting.locked).toBe(true); expect(targeting.id).toBe('them');
    expect(targeting.update(s.players, s.players[0], [], 10)).toBe('them');
    targeting.cycle(s.players, s.players[0]);
    expect(targeting.locked).toBe(false);
  });
});
