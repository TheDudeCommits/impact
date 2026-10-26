import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { SurvivalRoom } from '../src/server/SurvivalRoom';
import { mountEconomy } from '../src/server/economy/api';
import { decode, type CoopFrame } from '../src/survival/coopNet';
import { ITEMS, wornOf } from '../src/game/economy/catalog';
import type { Account } from '../src/game/economy/account';

afterEach(() => vi.restoreAllMocks());
type Mock = Client & { frames: CoopFrame[] };
const client = (sessionId: string) => {
  const frames: CoopFrame[] = [];
  return { sessionId, frames, send: vi.fn(), sendBytes: vi.fn((_type: string, bytes: Uint8Array) => frames.push(decode(bytes))) } as unknown as Mock;
};

describe('the economy in a co-op run', () => {
  it('shows the party what each account wears, and lets only an emote on the wheel through', async () => {
    const economy = mountEconomy({ use: () => undefined, post: () => undefined }, { dir: false, adminToken: 'owner' });
    const room = new SurvivalRoom(); let tick!: FixedTimestepCallback, frame = 0;
    vi.spyOn(room, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(room, 'setMetadata').mockResolvedValue(undefined);
    vi.spyOn(room, 'broadcast').mockImplementation(() => {}); vi.spyOn(room, 'lock').mockResolvedValue(undefined); vi.spyOn(room, 'unlock').mockResolvedValue(undefined);
    vi.spyOn(room, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
    await room.onCreate({rosterProtocol:ROSTER_PROTOCOL, creationToken: '01234567-89ab-cdef-0123-456789abcdef' });
    const code = room.roomId.replace('coop-', '');
    const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
    const join = (id: string) => { const c = client(id); room.clients.push(c); room.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, code, fighter: 'zoro', name: id }); return c; };
    try {
      const hello = economy.hello(undefined) as unknown as { token: string; account: Account };
      for (const item of ['skin-negative', 'aura-embers', 'emote-don']) economy.grant('Bearer owner', hello.account.pk, 0, item);
      economy.wear(hello.token, 'skin', 'skin-negative'); economy.wear(hello.token, 'aura', 'aura-embers'); economy.wear(hello.token, 'emote', 'emote-don');
      const host = join('host'), guest = join('guest');
      const dress = (room as unknown as { dress(c: Client, token: unknown): void }).dress.bind(room);
      const emote = (room as unknown as { emote(c: Client, place: unknown): void }).emote.bind(room);
      dress(host, 'not a token');
      dress(host, hello.token);
      advance(2);
      const seen = guest.frames[guest.frames.length - 1].survival.party.find(member => member.id === 'host');
      expect(wornOf(seen?.look)).toEqual({ skin: 'skin-negative', aura: 'aura-embers' });
      expect(guest.frames[guest.frames.length - 1].survival.party.find(member => member.id === 'guest')?.look).toBeUndefined();
      room.start(host); advance(3);
      emote(host, ITEMS.findIndex(item => item.id === 'emote-menacing'));
      emote(host, ITEMS.findIndex(item => item.id === 'emote-don'));
      emote(host, ITEMS.findIndex(item => item.id === 'emote-don'));
      emote(guest, ITEMS.findIndex(item => item.id === 'emote-don'));
      advance(2);
      const feed = guest.frames[guest.frames.length - 1].survival.feed.filter(item => item.kind === 'emote');
      expect(feed.map(item => [item.hero, ITEMS[item.value!]?.id])).toEqual([['host', 'emote-don']]);
    } finally { room.onDispose(); economy.close(); }
  });
});
