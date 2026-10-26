import { ROSTER_PROTOCOL } from '../../game/rosterProtocol';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { FixedTimestepCallback, Room } from 'colyseus';
import { PrivateArenaRoom, PrivateDuelRoom, ArenaRoom } from '../ArenaRoom';
import { ObjectiveRoom } from '../objectives/ObjectiveRoom';
import { ARENAS, DUEL_ARENAS } from '../../game/social/custom';
import { OBJECTIVE_STAGE } from '../../game/objectives/model';
import { placesFor, royaleRules } from '../../game/stageChoice';
import { STAGES, type StageId } from '../../game/stages';

const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
afterEach(() => vi.restoreAllMocks());

async function room(make: () => ArenaRoom | ObjectiveRoom, options: Record<string, unknown>) {
  const r = make(), rm = r as unknown as Room; let step!: FixedTimestepCallback;
  vi.spyOn(rm, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(rm, 'setMetadata').mockResolvedValue(undefined); vi.spyOn(rm, 'broadcast').mockImplementation(() => {});
  vi.spyOn(rm, 'lock').mockResolvedValue(undefined); vi.spyOn(rm, 'setFixedTimestep').mockImplementation(fn => { step = fn; });
  vi.spyOn(rm, 'onMessage').mockImplementation((() => () => {}) as never);
  await r.onCreate({ rosterProtocol: ROSTER_PROTOCOL, creationToken: TOKEN, ...options } as never);
  void step;
  const stage = (): StageId => r instanceof ObjectiveRoom ? r.game.sim.stage : r.snapshot().stage as StageId;
  return { stage, dispose: () => { void (r as { onDispose?: () => void }).onDispose?.(); } };
}

describe("a friends' room is created on the host's place", () => {
  it("a private Duel opens on the `stage` it was created with (any of the Duel's places), as a party's launch sends it", async () => {
    for (const stage of ['galactic-arena', 'valley-of-the-end', 'chunin-exam-room'] as StageId[]) {
      const r = await room(() => new PrivateDuelRoom(), { mode: 'match', stage });
      try { expect(r.stage(), stage).toBe(stage); } finally { r.dispose(); }
    }
  });
  it('a private Duel with no place - or one the server does not know - opens the tournament ring, as before the choice', async () => {
    for (const options of [{ mode: 'match' }, { mode: 'match', stage: 'not-a-stage' }, { mode: 'match', stage: 'harbor' }]) {
      const r = await room(() => new PrivateDuelRoom(), options);
      try { expect(r.stage(), JSON.stringify(options)).toBe('martial-arts-tournament'); } finally { r.dispose(); }
    }
  });
  it('every place the sheet offers a Duel host is one the room accepts as it is', () => {
    for (const stage of placesFor('duel', 'friends')) expect(DUEL_ARENAS).toContain(stage);
  });
  it('a private royale opens on the `rules.arena` the page sends (the places its custom lobby allows)', async () => {
    for (const stage of ['kami-lookout', 'shiganshina', 'onigashima'] as StageId[]) {
      const rules = royaleRules(stage, 4);
      const r = await room(() => new PrivateArenaRoom(), { mode: 'match', players: 4, rules });
      try { expect(r.stage(), stage).toBe(stage); } finally { r.dispose(); }
    }
  });
  it("a private royale given no place (RANDOM) deals one of the royale's own, as before", async () => {
    for (let i = 0; i < 6; i++) {
      const r = await room(() => new PrivateArenaRoom(), { mode: 'match', players: 8 });
      try { expect(ARENAS.royale, `dealt ${r.stage()}`).toContain(r.stage()); expect(STAGES[r.stage()]).toBeDefined(); } finally { r.dispose(); }
    }
  });
  it('a private royale refuses a place outside its list, and deals instead', async () => {
    const r = await room(() => new PrivateArenaRoom(), { mode: 'match', players: 8, rules: { arena: 'blood-citadel' } });
    try { expect(ARENAS.royale).toContain(r.stage()); } finally { r.dispose(); }
  });
  it("a Bad Blood room opens on the host's `rules.arena`; Last Stand's village stays fixed", async () => {
    for (const stage of placesFor('bad-blood', 'friends')) {
      const r = await room(() => new ObjectiveRoom(), { objective: 'bad-blood', access: 'host', rules: { arena: stage } });
      try { expect(r.stage(), stage).toBe(stage); } finally { r.dispose(); }
    }
    const none = await room(() => new ObjectiveRoom(), { objective: 'bad-blood', access: 'host' });
    try { expect(none.stage()).toBe(OBJECTIVE_STAGE['bad-blood']); } finally { none.dispose(); }
    const village = await room(() => new ObjectiveRoom(), { objective: 'last-stand', access: 'host', rules: { arena: 'kami-lookout' } });
    try { expect(village.stage()).toBe(OBJECTIVE_STAGE['last-stand']); } finally { village.dispose(); }
  });
});
