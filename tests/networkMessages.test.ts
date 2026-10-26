import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@colyseus/sdk';
import { Network, closeMessage, joinFailure } from '../src/network';

const sdk = vi.hoisted(() => ({ join: vi.fn(), create: vi.fn(), joinById: vi.fn() }));
vi.mock('@colyseus/sdk', () => ({ Client: class { joinOrCreate = sdk.join; create = sdk.create; joinById = sdk.joinById; } }));
function room(id: string) {
  const hooks: Record<string, (...args: any[]) => void> = {};
  const fake = {
    sessionId: id, reconnection: { minUptime: 5000, enabled: true }, connection: { isOpen: true },
    onMessage: () => {}, onDrop: (h: () => void) => hooks.drop = h, onReconnect: (h: () => void) => hooks.reconnect = h,
    onLeave: (h: (code: number) => void) => hooks.leave = h, onError: (h: (code: number, message?: string) => void) => hooks.error = h,
    send: vi.fn(), leave: vi.fn().mockResolvedValue(4000),
  };
  return { typed: fake as unknown as Room, hooks };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('what a closed room says', () => {
  it('names a server restart, an expired room and a slow load; anything else is a lost connection', () => {
    expect(closeMessage(4001)).toBe('The server was updated. Press PLAY to jump back in.');
    expect(closeMessage(4004)).toMatch(/expired.*PLAY/);
    expect(closeMessage(4008)).toMatch(/Loading took too long.*PLAY/);
    for (const code of [1000, 4000, 4002, 4003, 1006]) expect(closeMessage(code)).toBe('Lost connection to the match. Press PLAY to find a new one.');
    for (const code of [1000, 4001, 4002, 4003, 4004, 4008]) expect(closeMessage(code)).not.toMatch(/\d{4}/);
  });
  it('goes home with the shutdown message, not the SDK\'s last raw error', async () => {
    vi.stubGlobal('location', { protocol: 'http:', hostname: 'localhost' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const remote = room('a'), network = new Network(), disconnected = vi.fn();
    network.onDisconnect = disconnected; sdk.join.mockResolvedValueOnce(remote.typed);
    await network.connect('goku', 'match', 'Fighter');
    remote.hooks.error(524, 'seat reservation expired.'); remote.hooks.leave(4001);
    expect(disconnected).toHaveBeenCalledWith('The server was updated. Press PLAY to jump back in.', 4001);
    expect(warn).toHaveBeenCalled(); warn.mockRestore();
  });
});

describe('a join the match server cannot answer', () => {
  const restarting = 'The servers are restarting. Try again in a minute.';
  it('reads a fetch failure in any browser, a proxy 5xx or a shutdown as a restart', () => {
    for (const message of ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'fetch failed']) expect(joinFailure(Object.assign(new Error(message), { code: undefined }), true)).toBe(restarting);
    for (const code of [502, 503, 504]) expect(joinFailure(Object.assign(new Error(''), { code }), true)).toBe(restarting);
    expect(joinFailure(Object.assign(new Error('Bad Gateway'), { code: 0 }), true)).toBe(restarting);
    expect(joinFailure(Object.assign(new Error('no processId available to create room duel_arena'), { code: 523 }), true)).toBe(restarting);
    expect(joinFailure(Object.assign(new Error(''), { code: 1006 }), true)).toBe(restarting);
  });
  it('says offline when the browser is', () => expect(joinFailure(new Error('Failed to fetch'), false)).toMatch(/offline/));
  it("leaves a room's own refusals alone", () => {
    for (const message of ['This Duel is full.', 'Create a private room from the lobby.', 'room locked', 'Enter the six-digit Duel code.']) expect(joinFailure(Object.assign(new Error(message), { code: 523 }), true)).toBeUndefined();
    expect(joinFailure(undefined)).toBeUndefined(); expect(joinFailure('Failed to fetch')).toBeUndefined();
  });
  it('turns a restarting server into plain words, even for a Duel code', async () => {
    vi.stubGlobal('location', { protocol: 'http:', hostname: 'localhost' });
    sdk.join.mockRejectedValueOnce(Object.assign(new Error('Failed to fetch'), { code: undefined }));
    await expect(new Network().connect('goku', 'match', 'Fighter', { kind: 'duel', access: 'online' })).rejects.toThrow(/restarting|offline/);
    sdk.joinById.mockRejectedValueOnce(Object.assign(new Error('Service Unavailable'), { code: 503 }));
    await expect(new Network().connect('goku', 'match', 'Fighter', { kind: 'duel', access: 'join', code: '123456' })).rejects.toThrow(restarting);
  });
});
