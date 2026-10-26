import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { METEOR_COMBINATION, withMove } from './retiredMoves';
import type { PlayerInput } from '../src/game/types';

function wire(latencyTicks = 6) {
  const server = new ArenaSimulation({ trainingBot: false });
  server.addPlayer('me', 'zoro', 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('them', 'goku', 'Them', false, { x: 0, y: 0, z: 6 });
  const prediction = new Prediction();
  prediction.start('me', server.snapshot(false,true));
  let seq = 0;
  const queue: { at: number; input: PlayerInput }[] = [];
  let tick = 0;
  const press = (more: Partial<PlayerInput> = {}) => {
    const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...more };
    prediction.submit(input);
    queue.push({ at: tick + latencyTicks, input });
    return input;
  };
  const advance = () => {
    tick++;
    while (queue.length && queue[0].at <= tick) server.submitInput('me', queue.shift()!.input);
    server.step();
  };
  const deliver = () => prediction.reconcile(server.snapshot(false,true));
  return { server, prediction, press, advance, deliver };
}

describe('a handover survives a long frame', () => {
  it('carries the whole difference on the frame the server takes the body', () => {
    const { server, prediction, press, advance, deliver } = wire(8);
    for (let i = 0; i < 40; i++) { press({ moveZ: 1 }); advance(); if (i % 3 === 2) deliver(); }
    const authoritative = server.getPlayer('me')!;
    let shown = prediction.sample(1 / 60, authoritative)!;
    for (let i = 0; i < 40; i++) shown = prediction.sample(1 / 60, authoritative)!;
    const taken = prediction.sample(.2, { ...authoritative, action: 'hurt', z: shown.z - 1 })!;
    expect(Math.abs(taken.z - shown.z), 'the body stayed where it was drawn').toBeLessThan(.05);
  });
});

describe('the local copy collides where the server does', () => {
  it('does not roughen the drawn body when the pair touch', () => {
    const { server, prediction, press, advance, deliver } = wire(6);
    const them = server.actors.get('them')!;
    let theirSeq = 0;
    const drawn: number[] = [];
    for (let i = 0; i < 300; i++) {
      server.submitInput('them', { seq: theirSeq++, moveX: 0, moveZ: -1, yaw: Math.PI });
      press({ moveZ: 1 });
      advance();
      if (i % 2 === 1) deliver();
      drawn.push((prediction.sample(1 / 60, server.getPlayer('me')!) ?? server.getPlayer('me')!).z);
    }
    expect(Math.abs(them.state.z - server.getPlayer('me')!.z), 'the pair met').toBeLessThan(1.3);
    let worst = 0;
    for (let f = 2; f < drawn.length; f++) worst = Math.max(worst, Math.abs((drawn[f] - drawn[f - 1]) - (drawn[f - 1] - drawn[f - 2])) * 3600);
    expect(worst, `the drawn body's velocity jumped ${worst.toFixed(0)} m/s^2 in one frame`).toBeLessThan(400);
  });
});

describe('a change of stage drops the old walls', () => {
  it('stops colliding with the previous stage the moment the stage changes', () => {
    const wall = { move: () => ({ x: 0, y: 0, z: 0 }) };
    const { server, prediction, press, advance } = wire(6);
    prediction.setStage('harbor', wall);
    for (let i = 0; i < 12; i++) { press({ moveZ: 1 }); advance(); }
    expect(prediction.sample(1 / 60, server.getPlayer('me')!)!.z, 'held by the wall').toBeLessThan(.01);
    prediction.setStage('chunin-exam-room');
    for (let i = 0; i < 12; i++) { press({ moveZ: 1 }); advance(); }
    expect(prediction.sample(1 / 60, server.getPlayer('me')!)!.z, 'the harbour wall is gone').toBeGreaterThan(.2);
  });
});

describe('your own fighter answers the frame you press', () => {
  it('moves locally before the server has heard about it', () => {
    const { server, prediction, press, advance } = wire(8);
    for (let i = 0; i < 6; i++) { press({ moveZ: 1 }); advance(); }
    const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
    expect(shown, 'the local copy owns the body').not.toBeNull();
    expect(shown.z, 'it has already set off').toBeGreaterThan(0);
    expect(server.getPlayer('me')!.z, 'and the server has not seen a thing yet').toBe(0);
  });

  it('starts a swing on the press rather than a round trip later', () => {
    const { server, prediction, press, advance } = wire(8);
    press({ attack: 'light' });
    advance();
    const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
    expect(shown.action).toBe('light');
    expect(server.getPlayer('me')!.action, 'the server is still idle').toBe('idle');
    expect(prediction.takeCasts().some(event => event.kind === 'cast' && event.slot === 'light')).toBe(true);
  });

  it('stays with the server once it catches up', () => {
    const { server, prediction, press, advance, deliver } = wire(6);
    for (let i = 0; i < 90; i++) {
      press({ moveZ: 1, moveX: i > 45 ? 1 : 0 });
      advance();
      if (i % 3 === 2) deliver();
    }
    const local = prediction.sample(1 / 60, server.getPlayer('me')!)!;
    const authority = server.getPlayer('me')!;
    const ahead = Math.hypot(local.x - authority.x, local.z - authority.z);
    expect(ahead).toBeGreaterThan(0);
    expect(ahead, 'a prediction, not a different fight').toBeLessThan(1.5);
  });

  it('hands the body back the moment the server says it was hit', () => {
    const { server, prediction, press, advance, deliver } = wire(4);
    for (let i = 0; i < 10; i++) { press({ moveZ: 1 }); advance(); deliver(); }
    expect(prediction.sample(1 / 60, server.getPlayer('me')!)).not.toBeNull();
    const hurt = { ...server.getPlayer('me')!, action: 'knockdown' as const, hp: 640 };
    const shown = prediction.sample(1 / 60, hurt)!;
    expect(shown.action, 'the server decides what being hit looks like').toBe('knockdown');
    expect(shown.hp).toBe(640);
    expect(Math.hypot(shown.x - hurt.x, shown.z - hurt.z), 'and it is drawn where the server says, give or take the handover')
      .toBeLessThan(1.5);
    const dead = { ...server.getPlayer('me')!, alive: false };
    expect(prediction.sample(1 / 60, dead), 'a dead fighter is the server\u2019s outright').toBeNull();
  });

  it('does not teleport the body on the frame a hit takes it over, or on the way out', () => withMove('goku', 'heavy', METEOR_COMBINATION, () => {
    const server = new ArenaSimulation({ trainingBot: false });
    server.addPlayer('me', 'zoro', 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('them', 'goku', 'Them', false, { x: 0, y: 0, z: 1.2 });
    const prediction = new Prediction();
    prediction.start('me', server.snapshot(false,true));
    const queue: { at: number; input: PlayerInput }[] = [];
    const drawn: { x: number; z: number }[] = [];
    let seq = 0, tick = 0, reacted = false;
    for (let i = 0; i < 110; i++) {
      const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: 1, yaw: 0 };
      prediction.submit(input);
      queue.push({ at: tick + 9, input });
      tick++;
      while (queue.length && queue[0].at <= tick) server.submitInput('me', queue.shift()!.input);
      if (i === 20) server.submitInput('them', { seq: 0, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'me', attack: 'heavy' });
      server.step();
      if (i % 3 === 2) prediction.reconcile(server.snapshot(false,true));
      const authority = server.getPlayer('me')!;
      if (!authority.alive) break;
      reacted ||= ['hurt', 'flinch', 'launched', 'knockdown', 'getup', 'stun', 'splat'].includes(authority.action);
      const shown = prediction.sample(1 / 60, authority) ?? authority;
      drawn.push({ x: shown.x, z: shown.z });
    }
    expect(reacted, 'the hit actually landed').toBe(true);
    let worst = 0;
    for (let i = 1; i < drawn.length; i++) worst = Math.max(worst, Math.hypot(drawn[i].x - drawn[i - 1].x, drawn[i].z - drawn[i - 1].z));
    expect(worst, `the drawn body jumped ${(worst * 100).toFixed(0)} cm in one frame`).toBeLessThan(.4);
  }));

  it('keeps health and meter authoritative even while it owns the body', () => {
    const { server, prediction, press, advance, deliver } = wire(4);
    for (let i = 0; i < 8; i++) { press({ moveZ: 1 }); advance(); }
    deliver();
    const authority = { ...server.getPlayer('me')!, hp: 412, ultimate: 77 };
    const shown = prediction.sample(1 / 60, authority)!;
    expect(shown.hp).toBe(412);
    expect(shown.ultimate).toBe(77);
  });

  it('does not drop a swing for a snapshot that has not heard about it', () => {
    const { server, prediction, press, advance, deliver } = wire(10);
    press({ attack: 'light' });
    advance();
    expect(prediction.action, 'started locally').toBe('light');
    const stale = server.snapshot(false,true);
    const me = stale.players.find(p => p.id === 'me')!;
    me.ackSeq = 999;
    delete stale.prediction;
    prediction.reconcile(stale);
    expect(prediction.action, 'and kept').toBe('light');
    for (let i = 0; i < 150; i++) { press(); advance(); deliver(); }
    expect(['idle', 'run']).toContain(prediction.action);
  });

  it('is nothing at all until it is started, and nothing again once stopped', () => {
    const prediction = new Prediction();
    expect(prediction.enabled).toBe(false);
    const server = new ArenaSimulation({ trainingBot: false });
    server.addPlayer('me', 'zoro', 'Me');
    prediction.start('me', server.snapshot(false,true));
    expect(prediction.enabled).toBe(true);
    prediction.stop();
    expect(prediction.enabled).toBe(false);
    expect(prediction.sample(1 / 60, server.getPlayer('me')!)).toBeNull();
  });

  it('does not run a second copy of the sparring bot inside the client', () => {
    const server = new ArenaSimulation({ roomMode: 'training', trainingBot: true });
    server.addPlayer('me', 'zoro', 'Me', false, { x: 0, y: 0, z: 0 });
    server.startMatch();
    server.trainingCommand('me', 'passive');
    const prediction = new Prediction();
    prediction.start('me', server.snapshot(false,true));
    let seq = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) {
      const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: i < 300 ? 1 : -1, yaw: 0 };
      prediction.submit(input);
      server.submitInput('me', input);
      server.step();
      if (i % 3 === 2) prediction.reconcile(server.snapshot(false,true));
      const shown = prediction.sample(1 / 60, server.getPlayer('me')!);
      if (shown) seen.add(shown.action);
    }
    expect(server.getPlayer('me')!.hp, 'a passive bot does nothing').toBe(1000);
    for (const reaction of ['hurt', 'flinch', 'launched', 'knockdown', 'getup', 'stun', 'splat'])
      expect([...seen], `the client invented a ${reaction}`).not.toContain(reaction);
  });
});