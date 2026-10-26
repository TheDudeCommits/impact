import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalArena } from '../src/survival/LocalArena';
import { PLAYER_ID } from '../src/survival/SurvivalGame';
import type { PlayerInput } from '../src/game/types';

vi.mock('../src/game/rapierCollision', () => ({ createRapierCollision: vi.fn(async () => undefined) }));
const arenas: LocalArena[] = [];
afterEach(async () => { for (const arena of arenas.splice(0)) await arena.leave(); vi.restoreAllMocks(); });
const input = (seq: number, extra: Partial<PlayerInput> = {}): PlayerInput => ({ seq, moveX: 0, moveZ: 0, yaw: 0, ...extra });

async function slowed() {
  const arena = new LocalArena(); arenas.push(arena);
  await arena.connect('goku', 'match', 'Tester', { seed: 4711 });
  const game = arena.game!;
  game.phase = 'fight'; game.roundState = 'interlude'; game.timeScale = .25;
  (game as unknown as { slowUntil: number }).slowUntil = game.sim.serverTime + 10;
  return { arena, game, tick: vi.spyOn(game, 'tick') };
}

describe('Arcade manual controls during slow motion', () => {
  it('keeps a tap until the next real tick, uses current movement/aim, and fires it once', async () => {
    const { arena, game, tick } = await slowed();
    arena.send(input(1, { attack: 'light', moveX: -1, yaw: -1 }));
    arena.send(input(2)); arena.send(input(3));
    expect(tick).not.toHaveBeenCalled();
    arena.send(input(4, { moveX: 1, yaw: 1, targetId: null }));
    expect(tick).toHaveBeenCalledWith(expect.objectContaining({ seq: 4, attack: 'light', moveX: 1, yaw: 1, targetId: null }));
    expect(game.sim.actors.get(PLAYER_ID)!.state.action).toBe('light');
    for (let seq = 5; seq <= 12; seq++) arena.send(input(seq));
    expect(tick.mock.calls.filter(([command]) => command.attack)).toHaveLength(1);
  });

  it.each(['jump', 'dash', 'awaken'] as const)('keeps a single %s edge across skipped simulation intervals', async action => {
    const { arena, tick } = await slowed();
    arena.send(input(1, { [action]: true }));
    for (let seq = 2; seq <= 8; seq++) arena.send(input(seq));
    expect(tick.mock.calls.filter(([command]) => command[action])).toHaveLength(1);
  });

  it('keeps only the latest attack choice, without banking a combo of delayed presses', async () => {
    const { arena, tick } = await slowed();
    arena.send(input(1, { attack: 'light' })); arena.send(input(2, { attack: 'heavy' }));
    for (let seq = 3; seq <= 8; seq++) arena.send(input(seq));
    expect(tick.mock.calls.map(([command]) => command.attack)).toEqual(['heavy', undefined]);
  });

  it.each(['pause', 'tree'] as const)('drops an unconsumed press at %s so resuming never attacks by itself', async boundary => {
    const { arena, game, tick } = await slowed();
    arena.send(input(1, { attack: 'light', jump: true, dash: true, awaken: true }));
    if (boundary === 'pause') { arena.paused = true; arena.paused = false; }
    if (boundary === 'tree') { arena.choose('tree:open'); expect(game.frozen).toBe(true); arena.choose('tree:close'); }
    game.timeScale = 1;
    arena.send(input(2));
    expect(tick.mock.calls.at(-1)?.[0]).toMatchObject({ seq: 2 });
    expect(tick.mock.calls.some(([command]) => command.attack || command.jump || command.dash || command.awaken)).toBe(false);
  });

  it('does not carry a pending press into a new run', async () => {
    const { arena } = await slowed();
    arena.send(input(1, { attack: 'light', jump: true }));
    await arena.leave(); await arena.connect('goku', 'match', 'Tester', { seed: 4711 });
    const tick = vi.spyOn(arena.game!, 'tick');
    arena.send(input(2));
    expect(tick).toHaveBeenCalledOnce();
    expect(tick.mock.calls[0][0].attack).toBeUndefined(); expect(tick.mock.calls[0][0].jump).not.toBe(true);
  });
});
