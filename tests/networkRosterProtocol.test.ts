import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Network, joinFailure, type NetworkAccess } from '../src/network';
import { PartyClient } from '../src/social/PartyClient';
import { ROSTER_PROTOCOL, ROSTER_REFRESH_MESSAGE } from '../src/game/rosterProtocol';

const sdk = vi.hoisted(() => ({ join: vi.fn(), create: vi.fn(), joinById: vi.fn(), consume: vi.fn() }));
vi.mock('@colyseus/sdk', () => ({ Client: class { joinOrCreate = sdk.join; create = sdk.create; joinById = sdk.joinById; consumeSeatReservation = sdk.consume; } }));
vi.mock('../src/ui/shop/account', () => ({ account: { open: vi.fn().mockResolvedValue(undefined), secret: () => undefined } }));
const ticket = { name: 'rift_war', roomId: 'rift-123456', sessionId: 'seat', processId: 'server' };
function room() {
  return { sessionId: 'seat', reconnection: { enabled: true }, connection: { isOpen: true }, send: vi.fn(),
    onMessage: vi.fn(), onDrop: vi.fn(), onReconnect: vi.fn(), onLeave: vi.fn(), onError: vi.fn(), leave: vi.fn().mockResolvedValue(4000) };
}
beforeEach(() => {
  vi.stubGlobal('location', { protocol: 'http:', hostname: 'localhost' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ticket }));
  for (const fn of Object.values(sdk)) fn.mockReset().mockImplementation(async () => room());
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const accesses: NetworkAccess[] = [
  { kind: 'public' }, { kind: 'bots', players: 4 }, { kind: 'create-private' }, { kind: 'join-private', code: '123456' },
  { kind: 'duel', access: 'online' }, { kind: 'duel', access: 'host' }, { kind: 'duel', access: 'join', code: '123456' },
  { kind: 'coop-create' }, { kind: 'coop-join', code: '', quick: true }, { kind: 'coop-join', code: '123456' },
  ...(['quick', 'host', 'join'] as const).map(access => ({ kind: 'rift-war' as const, access, code: '123456' })),
  ...(['bad-blood', 'last-stand'] as const).flatMap(objective => (['quick', 'host', 'join', 'bots'] as const).map(access => ({ kind: 'objective' as const, objective, access, code: '123456' }))),
];
describe('browser roster handshake', () => {
  it.each(accesses)('carries the version through $kind $access $objective', async access => {
    const network = new Network('http://match.test');
    try {
      await network.connect('nami', 'match', 'Roster test', access);
      const calls = [...sdk.join.mock.calls, ...sdk.create.mock.calls, ...sdk.joinById.mock.calls];
      if (access.kind === 'rift-war' && access.access === 'quick') {
        expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({ rosterProtocol: ROSTER_PROTOCOL, fighter: 'nami' });
        expect(sdk.consume).toHaveBeenCalledWith(ticket);
      } else {
        expect(calls).toHaveLength(1);
        expect(calls[0][1]).toMatchObject({ rosterProtocol: ROSTER_PROTOCOL, fighter: 'nami' });
      }
    } finally { await network.leave(); }
  });
  it.each(accesses)('keeps the server refresh instruction through $kind $access error wrapping', async access => {
    for (const fn of Object.values(sdk)) fn.mockRejectedValue(new Error(ROSTER_REFRESH_MESSAGE));
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: ROSTER_REFRESH_MESSAGE }) } as Response);
    await expect(new Network('http://match.test').connect('goku', 'match', 'Old page', access)).rejects.toThrow(ROSTER_REFRESH_MESSAGE);
    expect(joinFailure({ message: ROSTER_REFRESH_MESSAGE, code: 503 })).toBe(ROSTER_REFRESH_MESSAGE);
  });
  it('sends the version when creating, joining and updating a social party', async () => {
    const party = new PartyClient(() => ({ fighter: 'nami', name: 'Navigator' }));
    await party.connect();
    expect(sdk.create).toHaveBeenCalledWith('party', expect.objectContaining({ rosterProtocol: ROSTER_PROTOCOL }));
    const created = await sdk.create.mock.results[0].value;
    party.profileChanged();
    expect(created.send).toHaveBeenCalledWith('party-profile', expect.objectContaining({ rosterProtocol: ROSTER_PROTOCOL }));
    await party.leave();
    await party.connect('123456');
    expect(sdk.joinById).toHaveBeenCalledWith('party-123456', expect.objectContaining({ rosterProtocol: ROSTER_PROTOCOL }));
    await party.leave();
  });
});
