import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, Room } from 'colyseus';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { ArenaRoom, PrivateArenaRoom } from '../src/server/ArenaRoom';
import { ArenaSimulation } from '../src/game/simulation';
import { Economy } from '../src/server/economy/api';
import { RoomRewards } from '../src/server/economy/RoomRewards';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import {
  encodeForge, forgeMoves, forgedMoveFor, forgedMoves, forgetForgeKits, ownKit, rememberForgeKits, shortForgeHash, type ForgeKit,
} from '../src/engine/sim';

afterEach(() => { vi.restoreAllMocks(); forgetForgeKits(); });
const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
const kit = (body: FighterId, special: FighterId, name = 'Flame Hero'): ForgeKit => ({ ...ownKit(body, name), slots: { ...ownKit(body).slots, special: { from: special } } });

async function room<T extends ArenaRoom>(made: T, options: object) {
  const base = made as unknown as Room;
  vi.spyOn(base, 'onMessage').mockImplementation((() => () => {}) as never);
  vi.spyOn(base, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(base, 'setMetadata').mockResolvedValue(undefined);
  const broadcast = vi.spyOn(base, 'broadcast').mockImplementation(() => {});
  vi.spyOn(base, 'lock').mockResolvedValue(undefined); vi.spyOn(base, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(base, 'setFixedTimestep').mockImplementation(() => {});
  await (made as unknown as { onCreate(options: unknown): Promise<void> }).onCreate({ rosterProtocol: ROSTER_PROTOCOL, ...options });
  const join = (id: string, options: object = {}) => {
    const c = { sessionId: id, leave: vi.fn(), sendBytes: vi.fn(), send: vi.fn() } as unknown as Client & { send: ReturnType<typeof vi.fn> };
    made.clients.push(c); made.onJoin(c, { rosterProtocol: ROSTER_PROTOCOL, fighter: 'endeavor', name: id, creationToken: TOKEN, ...options } as never);
    return c;
  };
  return { room: made, join, broadcast };
}

describe('forged fighters in private rooms', () => {
  it('puts a checked kit in play for its player, and sends every page each kit once', async () => {
    const forged = kit('endeavor', 'goku'), code = encodeForge(forged), hash = shortForgeHash(forged);
    const { room: r, join, broadcast } = await room(new PrivateArenaRoom(), { creationToken: TOKEN, players: 4 });
    join('host', { forge: code });
    expect(r.simulation.getPlayer('host')!.forge).toBe(hash);
    expect(broadcast).toHaveBeenCalledWith('forge-kits', { [hash]: code });
    const late = join('friend', { fighter: 'aokiji' });
    expect(late.send).toHaveBeenCalledWith('forge-kits', { [hash]: code });
    expect(r.simulation.getPlayer('friend')!.forge).toBeUndefined();
    expect(MOVES.endeavor.special.name).toBe('Hell Spider');
  });

  it("refuses a kit anywhere but a private room, in another body, past the budget or damaged", async () => {
    const forged = kit('endeavor', 'goku');
    const open = await room(new ArenaRoom(), { mode: 'match' });
    expect(() => open.join('a', { forge: encodeForge(forged) })).toThrow(/private rooms only/);
    const { join } = await room(new PrivateArenaRoom(), { creationToken: TOKEN, players: 4 });
    expect(() => join('b', { fighter: 'aokiji', forge: encodeForge(forged) })).toThrow(/body it was made for/);
    const greedy: ForgeKit = { ...forged, slots: { ...forged.slots, light: { from: 'naruto', tune: { power: 1.2 } }, heavy: { from: 'saitama', tune: { power: 1.2 } } } };
    expect(() => join('c', { forge: encodeForge({ ...greedy, slots: { ...greedy.slots, ultimate: { from: 'ace', tune: { power: 1.2 } } } }) })).toThrow(/can't play/);
    expect(() => join('d', { forge: 'JF1.garbage.00000000' })).toThrow();
    expect(() => join('e', { forge: 42 })).toThrow(/isn't a Forge code/);
    expect(() => join('f', { forge: encodeForge(kit('endeavor', 'goku', 'Official Admin')) })).toThrow(/name is not allowed/);
  });

  it('pays a forged fighter nothing for the match, and the same win unforged as before', () => {
    const settle = (forge: boolean) => {
      const e = new Economy({ dir: false }), sim = new ArenaSimulation({ roomMode: 'match' });
      try {
        const token = () => (e.hello(undefined) as unknown as { token: string }).token, a = token(), b = token(), r = new RoomRewards(() => e);
        sim.addPlayer('a', 'endeavor', 'A'); sim.addPlayer('b', 'goku', 'B');
        const forged = kit('endeavor', 'goku');
        if (forge) sim.forge('a', forgeMoves(forged), shortForgeHash(forged));
        r.bind('a', a); r.bind('b', b);
        sim.startMatch(); r.observe(sim.snapshot()); r.input('a', { seq: 1, moveX: 1, moveZ: 0, yaw: 0 });
        sim.serverTime = 35; sim.damage('b', 1e6, 'a', 'KO'); sim.step(); r.observe(sim.snapshot());
        return { reward: r.forOwner(sim.snapshot(), 'a').reward, balance: e.book.find(a)!.balance };
      } finally { sim.dispose(); e.close(); }
    };
    const plain = settle(false), forged = settle(true);
    expect(plain.reward?.settlement.total).toBeGreaterThan(0); expect(plain.balance).toBeGreaterThan(0);
    expect(forged.reward).toBeUndefined(); expect(forged.balance).toBe(0);
  });
});

describe('a forged fighter in the simulation', () => {
  const duel = (forge: boolean) => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 3 });
    sim.addPlayer('a', 'endeavor', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'aokiji', 'B', false, { x: 0, y: 0, z: 6 });
    const forged = kit('endeavor', 'goku');
    if (forge) expect(sim.forge('a', forgeMoves(forged), shortForgeHash(forged))).toBe(true);
    return sim;
  };
  it("throws the kit's moves for that player only, and keeps them out of the rollback checkpoint", () => {
    const sim = duel(true);
    for (let tick = 0; tick < 120; tick++) {
      sim.submitInput('a', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: tick === 2 ? 'special' : undefined });
      sim.step();
    }
    expect(sim.getPlayer('b')!.hp).toBeLessThan(sim.getPlayer('b')!.maxHp);
    const checkpoint = sim.predictionCheckpoint('a') as unknown as Record<string, unknown>;
    expect(checkpoint.forged).toBeUndefined();
    expect(JSON.stringify(checkpoint).length).toBeLessThan(JSON.stringify(sim.predictionCheckpoint('b')).length + 400);
    sim.trainingCommand('a', 'reset');
    expect(sim.getPlayer('a')!.forge).toBe(shortForgeHash(kit('endeavor', 'goku')));
    expect(sim.forge('a')).toBe(true); expect(sim.getPlayer('a')!.forge).toBeUndefined();
  });
  it('leaves an unforged duel exactly as it was', () => {
    const run = () => { const sim = duel(false); for (let tick = 0; tick < 200; tick++) { sim.submitInput('a', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: tick % 40 === 2 ? 'light' : undefined }); sim.step(); } return JSON.stringify(sim.snapshot(false, true)); };
    expect(run()).toBe(run());
  });
  it('lets no bot forge', () => {
    const sim = new ArenaSimulation({ roomMode: 'match', trainingBot: false, seed: 5 });
    sim.addPlayer('bot', 'endeavor', 'Bot', true);
    expect(sim.forge('bot', forgeMoves(kit('endeavor', 'goku')), 'x')).toBe(false);
  });
});

describe('every page plays a forged player by hash', () => {
  it('keeps only valid kits that hash to their names, and plays their slots', () => {
    const forged = kit('endeavor', 'goku'), hash = shortForgeHash(forged), code = encodeForge(forged);
    expect(rememberForgeKits({ [hash]: code, bogus: code, [`${hash.slice(0, 15)}0`]: code, other: 'JF1.x.y' })).toBe(1);
    expect(forgedMoves(hash)?.special.name).toBe('Kamehameha');
    const state = { fighter: 'endeavor' as FighterId, forge: hash, awakened: false };
    expect(forgedMoveFor({ ...state, action: 'special' })?.name).toBe('Kamehameha');
    expect(forgedMoveFor({ ...state, action: 'light', chain: 0 })?.name).toBe(MOVES.endeavor.light.name);
    expect(forgedMoveFor({ ...state, action: 'light', chain: 1 })).toBeUndefined();
    expect(forgedMoveFor({ ...state, action: 'run' })).toBeUndefined();
    expect(forgedMoveFor({ fighter: 'endeavor', action: 'special' })).toBeUndefined();
    expect(rememberForgeKits({ [hash]: code })).toBe(0);
  });
});
