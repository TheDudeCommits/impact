import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'colyseus';
import { ROSTER_PROTOCOL, ROSTER_REFRESH_MESSAGE, requireRosterProtocol } from '../src/game/rosterProtocol';
import { ArenaRoom, BotArenaRoom, DuelRoom, PrivateArenaRoom, PrivateDuelRoom } from '../src/server/ArenaRoom';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { RiftRoom } from '../src/server/moba/RiftRoom';
import { ObjectiveRoom } from '../src/server/objectives/ObjectiveRoom';
import { PartyRoom } from '../src/server/social/PartyRoom';
import { privateCodes } from '../src/server/privateCodes';
import { healthReport } from '../src/server/health';

afterEach(() => vi.restoreAllMocks());
const rooms = [ArenaRoom, BotArenaRoom, DuelRoom, PrivateArenaRoom, PrivateDuelRoom, SurvivalRoom, RiftRoom, ObjectiveRoom, PartyRoom];
const stale = [undefined, null, '', 1, 'old-roster', 'jump-roster-v19-eva01', { rosterProtocol: ROSTER_PROTOCOL }];
describe('the roster compatibility boundary', () => {
  it('advertises precisely the protocol accepted by the server', () => {
    expect(healthReport().rosterProtocol).toBe(ROSTER_PROTOCOL);
    expect(() => requireRosterProtocol(ROSTER_PROTOCOL)).not.toThrow();
    for (const version of stale) expect(() => requireRosterProtocol(version)).toThrow(ROSTER_REFRESH_MESSAGE);
  });
  for (const Room of rooms) describe(Room.name, () => {
    it.each(stale)('rejects stale creation before allocating a room or private code: %j', async rosterProtocol => {
      const room = new Room(), allocated = vi.spyOn(privateCodes, 'allocate');
      try {
        await expect(Promise.resolve().then(() => room.onCreate({ rosterProtocol }))).rejects.toThrow(ROSTER_REFRESH_MESSAGE);
        expect(allocated).not.toHaveBeenCalled();
      } finally { room.onDispose(); }
    });
    it('rejects missing or stale admission even with the asset gate disabled and an original fighter', () => {
      const room = new Room(), client = { sessionId: 'old-tab', send: vi.fn() } as unknown as Client;
      try {
        for (const rosterProtocol of stale) {
          const options = { rosterProtocol, assetGate: false, fighter: 'goku' as const };
          expect(() => room.onAuth(client, options)).toThrow(ROSTER_REFRESH_MESSAGE);
          expect(() => room.onJoin(client, options)).toThrow(ROSTER_REFRESH_MESSAGE);
        }
        expect(client.send).not.toHaveBeenCalled();
      } finally { room.onDispose(); }
    });
  });
});
