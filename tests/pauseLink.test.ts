import { describe, expect, it } from 'vitest';
import { PauseLink, PAUSE_RETRY_MS } from '../src/game/pauseLink';
import { CombatTimeline } from '../src/render/CombatTimeline';
import type { GameSnapshot, PauseView } from '../src/game/types';

const view = (pause: PauseView) => ({ pause });

describe('PauseLink', () => {
  it('asks once, holds its commands until the room answers, and says PAUSED only once the room is frozen', () => {
    const link = new PauseLink();
    expect(link.update(true, 0), 'no word from the room yet: nothing to ask').toBeUndefined();
    link.observe(view({ paused: false, pausable: true, ack: 0 }));
    expect(link.holding).toBe(false);
    expect(link.update(true, 10)).toEqual({ type: 'pause', n: 1 });
    expect(link.update(true, 20), 'asked once').toBeUndefined();
    expect(link.holding).toBe(true);
    expect(link.state).toBe('pausing');
    link.observe(view({ paused: false, pausable: true, ack: 0 }));
    expect(link.holding).toBe(true);
    link.observe(view({ paused: false, pausing: true, pausable: true, ack: 1 }));
    expect(link.state).toBe('pausing');
    link.observe(view({ paused: true, pausable: true, ack: 1 }));
    expect(link.state).toBe('paused');
    expect(link.update(true, 30)).toBeUndefined();
  });

  it('lets go at once on RESUME: the commands follow the request down the same ordered link', () => {
    const link = new PauseLink();
    link.observe(view({ paused: true, pausable: true, ack: 3 }));
    expect(link.update(false, 0), 'frozen by the room on its own (a dropped link): the page asks it back').toEqual({ type: 'resume', n: 4 });
    expect(link.holding).toBe(false);
    expect(link.state).toBe('live');
    link.observe(view({ paused: true, pausable: true, ack: 0 }));
    expect(link.holding).toBe(false);
    expect(link.update(false, 10)).toBeUndefined();
  });

  it('never asks a room with two humans, and lets go when the room refuses or lets go itself', () => {
    const link = new PauseLink();
    link.observe(view({ paused: false, pausable: false, ack: 0 }));
    expect(link.update(true, 0)).toBeUndefined();
    expect(link.holding).toBe(false);
    link.observe(view({ paused: false, pausable: true, ack: 0 }));
    expect(link.update(true, 0)?.type).toBe('pause');
    link.observe(view({ paused: false, pausable: false, ack: 1 }));
    expect(link.holding).toBe(false);
    expect(link.update(true, 10)).toBeUndefined();
    link.observe(view({ paused: false, pausable: true, ack: 1 }));
    expect(link.update(true, 20)?.type).toBe('pause');
    link.observe(view({ paused: true, pausable: true, ack: 2 }));
    link.observe(view({ paused: false, pausable: false, ack: 2 }));
    expect(link.holding).toBe(false);
    expect(link.update(true, 30)).toBeUndefined();
  });

  it('asks again when a request goes unanswered, and starts its serials again in a new room', () => {
    const link = new PauseLink();
    link.observe(view({ paused: false, pausable: true, ack: 0 }));
    expect(link.update(true, 0)).toEqual({ type: 'pause', n: 1 });
    expect(link.update(true, PAUSE_RETRY_MS - 1)).toBeUndefined();
    expect(link.update(true, PAUSE_RETRY_MS)).toEqual({ type: 'pause', n: 2 });
    link.reset();
    expect(link.holding).toBe(false);
    link.observe(view({ paused: false, pausable: true, ack: 0 }));
    expect(link.update(true, 0)).toEqual({ type: 'pause', n: 1 });
  });

  it('flips quickly without losing track: pause then resume before either is heard', () => {
    const link = new PauseLink();
    link.observe(view({ paused: false, pausable: true, ack: 0 }));
    expect(link.update(true, 0)?.type).toBe('pause');
    expect(link.update(false, 5)).toEqual({ type: 'resume', n: 2 });
    expect(link.holding).toBe(false);
    link.observe(view({ paused: false, pausing: true, pausable: true, ack: 1 }));
    expect(link.holding, 'the room heard the pause but not yet the resume').toBe(false);
    link.observe(view({ paused: false, pausable: true, ack: 2 }));
    expect(link.holding).toBe(false);
    expect(link.update(false, 10)).toBeUndefined();
  });
});

describe('the timeline across a pause', () => {
  const at = (serverTime: number, tick: number): GameSnapshot => ({ stage: 'harbor', players: [], events: [], serverTime, roomMode: 'match', status: 'active', winnerId: null, tick });
  it('learns its clock afresh when the room thaws, instead of pinning it to the newest snapshot for seconds', () => {
    const run = (reanchor: boolean) => {
      const timeline = new CombatTimeline({ delayMs: 60 });
      let wall = 1000, time = 10, tick = 600;
      for (let i = 0; i < 60; i++) { timeline.push(at(time, tick), wall); wall += 1000 / 30; time += 1 / 30; tick += 2; timeline.sample(wall); }
      for (let i = 0; i < 80; i++) { wall += 250; timeline.push(at(time - 1 / 30, tick - 2), wall); timeline.sample(wall); }
      if (reanchor) timeline.reanchor();
      for (let i = 0; i < 30; i++) { timeline.push(at(time, tick), wall); timeline.sample(wall); wall += 1000 / 30; time += 1 / 30; tick += 2; }
      return (timeline.newest! - timeline.sample(wall)!.time) * 1000;
    };
    const fresh = run(true), stale = run(false);
    expect(fresh, 'an interpolation delay behind, as before the pause').toBeGreaterThan(20);
    expect(fresh).toBeLessThan(120);
    expect(stale, 'without it the world is drawn far behind').toBeGreaterThan(400);
  });
});
