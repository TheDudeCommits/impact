import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { MOVES, RUSH_STAGES } from '../src/game/moves';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

const ROSTER = Object.keys(MOVES) as FighterId[];

describe('a mashed string in the simulation', () => {
  it('goes from stage to stage without a tick of idle, hit or miss, at any mashing rate, for all sixteen', () => {
    for (const fighter of ROSTER) for (const gap of [1.6, 14]) for (const every of [4, 8, 13, 20]) {
      const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
      sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: gap });
      const events: CombatEvent[] = [];
      const actions: string[] = [];
      let seq = 0;
      for (let tick = 0; tick < 240 && !events.some(e => e.kind === 'cast' && e.actorId === 'a' && e.chain === RUSH_STAGES - 1); tick++) {
        sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: tick % every === 0 ? 'light' : undefined });
        sim.step(); events.push(...sim.snapshot(true).events);
        actions.push(sim.getPlayer('a')!.action);
      }
      const casts = events.filter(e => e.kind === 'cast' && e.actorId === 'a').map(e => e.chain);
      expect(casts, `${fighter} ${gap} m every ${every}`).toEqual([0, 1, 2, 3]);
      expect(actions.filter(a => a !== 'light'), `${fighter} ${gap} m every ${every}: idle between stages`).toEqual([]);
      sim.dispose();
    }
  });
});

function pipeline(fighter: FighterId, delay: number, press: (tick: number) => boolean, meddle?: (server: ArenaSimulation, tick: number) => void) {
  const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
  server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('foe', 'goku', 'Foe', false, { x: 0, y: 0, z: 1.6 });
  const prediction = new Prediction(), queue = new InputQueue();
  prediction.start('me', server.snapshot(true, true));
  const up: { tick: number; input: PlayerInput }[] = [], down: { tick: number; s: GameSnapshot }[] = [];
  const frames: { tick: number; drawn: string; drawnTime: number; local: string; chain?: number }[] = [];
  const serverEvents: CombatEvent[] = [];
  const local = () => (prediction as unknown as { sim: ArenaSimulation }).sim;
  for (let tick = 0; tick < 170; tick++) {
    const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', attack: press(tick) ? 'light' : undefined };
    prediction.submit(input); up.push({ tick: tick + delay, input });
    while (up.length && up[0].tick <= tick) queue.push(up.shift()!.input);
    const next = queue.take(); if (next) server.submitInput('me', next);
    meddle?.(server, tick);
    server.step(1 / 60, new Set(next ? [] : ['me']));
    if (tick % 2 === 0) { const snapshot = server.snapshot(true, true); serverEvents.push(...snapshot.events); down.push({ tick: tick + delay, s: snapshot }); }
    while (down.length && down[0].tick <= tick) prediction.reconcile(down.shift()!.s);
    const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
    frames.push({ tick, drawn: shown.action, drawnTime: shown.actionTime, local: local().actors.get('me')!.state.action, chain: shown.chain });
  }
  prediction.stop(); server.dispose();
  return { frames, serverEvents };
}

describe('a mashed string as the client draws it', () => {
  it('holds a swing the server started late on its last frame instead of dropping to idle while it is still thrown', () => {
    for (const delay of [15, 18]) {
      let foe = 1e6;
      const run = pipeline('luffy', delay, tick => tick === 0 || tick === 4,
        (server, tick) => { if (tick === 16) server.submitInput('foe', { seq: foe++, moveX: 1, moveZ: 0, yaw: Math.PI, dash: true }); });
      const serverHits = run.serverEvents.filter(e => e.kind === 'hit' && e.actorId === 'me');
      expect(serverHits, 'the server saw the stage miss').toHaveLength(0);
      const idleWhileThrown = run.frames.filter(f => f.drawn === 'idle' && f.local === 'light');
      expect(idleWhileThrown.map(f => f.tick), `delay ${delay}: idle drawn while the swing still runs`).toEqual([]);
      for (let i = 1; i < run.frames.length; i++) {
        const [a, b] = [run.frames[i - 1], run.frames[i]];
        if (a.drawn === 'light' && b.drawn === 'light' && a.chain === b.chain && b.drawnTime < a.drawnTime - 1e-9 && b.drawnTime > .05) {
          throw new Error(`delay ${delay}: stage ${b.chain} rewound at tick ${b.tick}`);
        }
      }
    }
  });

  it('never draws the idle stance between two stages of Luffy\'s mashed string when the server sees a stage miss', () => {
    for (const shoveAt of [34, 40, 46]) {
      const run = pipeline('luffy', 12, tick => tick % 13 === 0 && tick < 120,
        (server, tick) => { if (tick === shoveAt) { const foe = server.actors.get('foe')!; foe.state.x += 3.5; } });
      const stages = run.frames.map(f => f.drawn === 'light' ? `light#${f.chain}` : f.drawn);
      const first = stages.indexOf('light#0'), last = stages.lastIndexOf('light#3');
      expect(first).toBeGreaterThanOrEqual(0);
      if (last > first) {
        const between = stages.slice(first, last).filter(s => s === 'idle' || s === 'run');
        expect(between, `shoved at ${shoveAt}: idle between stages`).toEqual([]);
      }
      const idleWhileThrown = run.frames.filter(f => f.drawn === 'idle' && f.local === 'light');
      expect(idleWhileThrown.map(f => f.tick), `shoved at ${shoveAt}`).toEqual([]);
    }
  });
});
