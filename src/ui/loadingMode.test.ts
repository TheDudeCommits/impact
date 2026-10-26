import { describe, expect, it } from 'vitest';
import type { NetworkAccess } from '../network';
import { loadingTitle } from './LoadingScreen';
import { loadingModeFor } from './loadingMode';

const party = (mode: 'duel' | 'royale' | 'bad-blood' | 'last-stand' | 'survival' | 'rift-war') => ({ kind: 'party', travel: { mode, reservation: {} } }) as unknown as NetworkAccess;

describe('the loading page for each way into a match (overnight UX, 8 October 2026)', () => {
  it("a party's Battle Royale is a PARTY MATCH, never PRIVATE ROOM", () => {
    expect(loadingModeFor(party('royale'), 'match')).toBe('party');
    expect(loadingTitle('party')).toEqual(['BATTLE ROYALE', 'PARTY MATCH']);
    expect(loadingTitle(loadingModeFor(party('royale'), 'match')).join(' ')).not.toMatch(/PRIVATE/);
  });
  it("a party's other modes show those modes' own pages", () => {
    expect(loadingModeFor(party('duel'), 'match')).toBe('duel');
    expect(loadingModeFor(party('rift-war'), 'match')).toBe('rift-war');
    expect(loadingModeFor(party('bad-blood'), 'match')).toBe('bad-blood');
    expect(loadingModeFor(party('last-stand'), 'match')).toBe('last-stand');
    expect(loadingModeFor(party('survival'), 'match', true)).toBe('arcade');
  });
  it('every other way keeps its page', () => {
    expect(loadingModeFor({ kind: 'create-private', players: 8 }, 'match')).toBe('private');
    expect(loadingModeFor({ kind: 'join-private', code: '123456' }, 'match')).toBe('private');
    expect(loadingModeFor({ kind: 'bots', players: 8 }, 'match')).toBe('bots');
    expect(loadingModeFor({ kind: 'public' }, 'match')).toBe('players');
    expect(loadingModeFor(undefined, 'training')).toBe('training');
    expect(loadingModeFor({ kind: 'duel', access: 'bot' }, 'match')).toBe('duel');
    expect(loadingModeFor({ kind: 'rift-war', access: 'quick' }, 'match')).toBe('rift-war');
    expect(loadingModeFor({ kind: 'survival' }, 'match', true)).toBe('arcade');
    expect(loadingModeFor({ kind: 'coop-join', code: '', quick: true }, 'match', true)).toBe('arcade');
    expect(loadingModeFor({ kind: 'objective', objective: 'last-stand', access: 'bots' }, 'match')).toBe('last-stand');
    expect(loadingModeFor({ kind: 'objective', objective: 'bad-blood', access: 'quick' }, 'match')).toBe('bad-blood');
  });
  it('the private room still says PRIVATE ROOM', () => {
    expect(loadingTitle('private')).toEqual(['BATTLE ROYALE', 'PRIVATE ROOM']);
  });
});
