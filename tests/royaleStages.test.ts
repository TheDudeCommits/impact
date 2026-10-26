import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback } from 'colyseus';
import { ArenaRoom, BotArenaRoom, PrivateArenaRoom } from '../src/server/ArenaRoom';
import { ROYALE_STAGES, RoyaleDeck, royalePool, type StageId } from '../src/game/stages';
import type { FighterId, GameSnapshot } from '../src/game/types';

const client = (sessionId: string) => ({ sessionId, send: vi.fn() } as unknown as Client);
afterEach(() => vi.restoreAllMocks());

async function room(created: ArenaRoom, options: Record<string, unknown>) {
  let tick!: FixedTimestepCallback, frame = 0;
  vi.spyOn(created, 'setPrivate').mockResolvedValue(undefined);
  vi.spyOn(created, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(created, 'broadcast').mockImplementation(() => {});
  vi.spyOn(created, 'lock').mockResolvedValue(undefined);
  vi.spyOn(created, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(created, 'setFixedTimestep').mockImplementation(callback => { tick = callback; });
  await created.onCreate({rosterProtocol:ROSTER_PROTOCOL,...options});
  const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
  const join = (id: string, fighter: FighterId = 'goku', more: Record<string, unknown> = {}) => {
    const c = client(id); created.clients.push(c); created.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter, name: id, ...more }); return c;
  };
  const firstStage = (c: Client) => {
    const call = (c.send as unknown as ReturnType<typeof vi.fn>).mock.calls.find(([kind]) => kind === 'snapshot');
    return (call?.[1] as GameSnapshot | undefined)?.stage;
  };
  const untilActive = (seconds: number) => { for (let i = 0; i < seconds * 60 && created.simulation.status === 'waiting'; i++) advance(); };
  return { room: created, advance, join, firstStage, untilActive };
}

describe('a match is dealt its stage once', () => {
  it('deals a public room one of the famous places on creation, and keeps it through the kickoff', async () => {
    const { room: r, join, firstStage, untilActive } = await room(new ArenaRoom(), { mode: 'match' });
    try {
      const dealt = r.simulation.stage;
      expect(ROYALE_STAGES).toContain(dealt);
      const solo = join('solo', 'zoro');
      expect(firstStage(solo), 'the first snapshot names the stage fought on').toBe(dealt);
      untilActive(30);
      expect(r.simulation.status).toBe('active');
      expect(r.simulation.snapshot().players.some(p => p.isBot), 'bots filled the field').toBe(true);
      expect(r.simulation.stage, 'and nobody was moved anywhere').toBe(dealt);
    } finally { r.onDispose(); }
  });

  it('puts a bot royale on its final stage before its player\'s first snapshot', async () => {
    for (const size of [6, 12]) {
      const { room: r, join, firstStage, untilActive } = await room(new BotArenaRoom(), { players: size });
      try {
        const owner = join('owner', 'naruto');
        const first = firstStage(owner)!;
        expect(first).not.toBe('harbor');
        expect(first).toBe(r.simulation.stage);
        untilActive(10);
        expect(r.simulation.status).toBe('active');
        expect(r.simulation.stage, 'the countdown and the fight on the stage first sent').toBe(first);
      } finally { r.onDispose(); }
    }
  });

  it('does not deal the same place twice running', async () => {
    let previous: StageId | undefined;
    for (let i = 0; i < 8; i++) {
      const { room: r } = await room(new ArenaRoom(), { mode: 'match' });
      try {
        expect(r.simulation.stage).not.toBe(previous);
        previous = r.simulation.stage;
      } finally { r.onDispose(); }
    }
  });

  it('starts a private room on the arena its host named - never the harbour, which is out of the royale', async () => {
    const { room: named } = await room(new PrivateArenaRoom(), { creationToken: crypto.randomUUID(), players: 4, rules: { arena: 'shiganshina' } });
    try { expect(named.simulation.stage).toBe('shiganshina'); } finally { named.onDispose(); }
    const { room: forged } = await room(new PrivateArenaRoom(), { creationToken: crypto.randomUUID(), players: 4, rules: { arena: 'harbor' } });
    try { expect(ROYALE_STAGES).toContain(forged.simulation.stage); } finally { forged.onDispose(); }
  });

  it('deals every famous place once before any comes up again', async () => {
    const deck = new RoyaleDeck();
    let n = 0;
    const pick = (pool: readonly StageId[]) => pool[(n++ * 7) % pool.length];
    for (let cycle = 0; cycle < 3; cycle++) {
      const dealt = ROYALE_STAGES.map(() => deck.deal(pick));
      expect(new Set(dealt).size, dealt.join(' ')).toBe(ROYALE_STAGES.length);
    }
    const seen = new Set<StageId>();
    for (let i = 0; i < ROYALE_STAGES.length * 2; i++) {
      const { room: r } = await room(new ArenaRoom(), { mode: 'match' });
      try { seen.add(r.simulation.stage); } finally { r.onDispose(); }
    }
    expect([...seen].sort()).toEqual([...ROYALE_STAGES].sort());
  });

  it('may deal a small bot royale one of the smaller rings, never a big one', async () => {
    const small = new Set<StageId>();
    for (let i = 0; i < royalePool(4).length * 2; i++) {
      const { room: r, join } = await room(new BotArenaRoom(), { players: 4 });
      try { join('owner', 'naruto'); small.add(r.simulation.stage); } finally { r.onDispose(); }
    }
    expect([...small].some(s => s === 'galactic-arena' || s === 'martial-arts-tournament' || s === 'null-realm'), [...small].join(' ')).toBe(true);
    for (let i = 0; i < 12; i++) {
      const { room: r } = await room(new BotArenaRoom(), { players: 12 });
      try { expect(ROYALE_STAGES).toContain(r.simulation.stage); } finally { r.onDispose(); }
    }
  });

  it('keeps a voting room on its dealt place when nobody voted', async () => {
    const creationToken = crypto.randomUUID();
    const { room: r, join, advance, untilActive } = await room(new PrivateArenaRoom(), { creationToken, players: 4, rules: { arena: 'vote' } });
    try {
      const dealt = r.simulation.stage;
      expect(ROYALE_STAGES).toContain(dealt);
      const host = join('host', 'goku', { creationToken }); join('guest', 'luffy', { creationToken });
      r.requestPrivateStart(host);
      advance();
      untilActive(10);
      expect(r.simulation.status).toBe('active');
      expect(r.simulation.stage).toBe(dealt);
    } finally { r.onDispose(); }
  });
});
