import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { AIR_NORMAL_FIGHTERS, AIR_RUSH, AIR_RUSH_NAMES, airRushName, HITSTOP, JUST_GUARD_WINDOW, LAUNCH_KNOCKBACK, MOVES, RUSH, RUSH_AIR_STAGES, RUSH_SHAPE, RUSH_STAGES,
  RUSH_WINDOW } from '../src/game/moves';
import { rushMove } from '../src/game/awakening';
import { comboKeyFor } from '../src/game/combos';
import { KI_BLAST_VOLLEY, withMove } from './retiredMoves';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

const ROSTER = Object.keys(MOVES) as FighterId[];

function bout(fighter: FighterId = 'zoro', other: FighterId = 'goku', gap = 1.6, stage?: ConstructorParameters<typeof ArenaSimulation>[0]) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9, ...stage });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', other, 'B', false, { x: 0, y: 0, z: gap });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput> = {}) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, targetId: id === 'a' ? 'b' : 'a', ...more });
  const events: CombatEvent[] = [];
  const step = (seconds: number, each?: (frame: number) => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) { each?.(i); sim.step(); events.push(...sim.snapshot(true).events); }
  };
  const mine = (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind && e.actorId === 'a');
  input('a'); input('b');
  return { sim, input, step, events, mine, attacker: sim.actors.get('a')!, victim: sim.actors.get('b')! };
}
const mash = (fight: ReturnType<typeof bout>, seconds: number, every = 4) =>
  fight.step(seconds, i => { if (i % every === 0) fight.input('a', { attack: 'light' }); });

describe('the rush table', () => {
  it('gives every fighter three single-contact stages on the template, the last a finisher that lands like a heavy', () => {
    const template = [{ duration: .42, contact: .16 }, { duration: .45, contact: .17 }, { duration: .58, contact: .22 }];
    for (const fighter of ROSTER) {
      expect(RUSH[fighter], fighter).toHaveLength(RUSH_STAGES - 1);
      expect(rushMove(fighter, 0, false), `${fighter} stage 0`).toBe(MOVES[fighter].light);
      RUSH[fighter].forEach((stage, i) => {
        const at = `${fighter} stage ${i + 1}`;
        expect(stage.contacts, at).toHaveLength(1);
        expect(stage.style, at).toBe('melee');
        expect(stage.duration / template[i].duration, at).toBeGreaterThanOrEqual(.75);
        expect(stage.duration / template[i].duration, at).toBeLessThanOrEqual(1.3);
        expect(stage.contacts[0] / template[i].contact, at).toBeGreaterThanOrEqual(.75);
        expect(stage.contacts[0] / template[i].contact, at).toBeLessThanOrEqual(1.3);
        expect(stage.name.length, at).toBeGreaterThan(0);
        expect(stage.name.length, at).toBeLessThanOrEqual(20);
        expect(rushMove(fighter, i + 1, false), at).toBe(stage);
      });
      const [one, two, finish] = RUSH[fighter];
      expect(one.knockback, `${fighter}: the middle of the string keeps them in reach`).toBeLessThan(LAUNCH_KNOCKBACK);
      expect(two.knockback).toBeLessThan(LAUNCH_KNOCKBACK);
      const shape = RUSH_SHAPE[fighter];
      const ends = { launch: 'launch', juggle: 'hop', spike: 'groundBounce', carry: 'wallBounce', stagger: 'stagger', spin: 'spin' } as const;
      expect(finish.outcome, `${fighter}: the ${shape} string's finisher`).toBe(ends[shape]);
      if (shape === 'juggle') expect(two.outcome, `${fighter}: the pop`).toBe('hop');
      if (shape === 'launch' || shape === 'carry') expect(finish.finisherKnockback, `${fighter}: the finisher sends them off`).toBeGreaterThanOrEqual(LAUNCH_KNOCKBACK);
      expect(finish.hitstop, `${fighter}: and freezes like a heavy`).toBeGreaterThanOrEqual(HITSTOP.heavy);
    }
  });

  it('realises 1.1 to 1.7 times the fighter\'s own heavy, landed whole on a standing opponent', () => {
    for (const fighter of ROSTER) {
      const rush = bout(fighter);
      rush.step(4, i => { if (!rush.mine('hit').some(e => e.chain === RUSH_STAGES - 1) && i % 15 === 0) rush.input('a', { attack: 'light' }); });
      const hits = rush.mine('hit');
      const finish = hits.findIndex(e => e.chain === RUSH_STAGES - 1);
      expect(finish, `${fighter} lands the finisher`).toBeGreaterThan(0);
      expect([...new Set(hits.slice(0, finish + 1).map(e => e.chain))], `${fighter} lands every stage`).toEqual([0, 1, 2, 3]);
      const string = hits.slice(0, finish + 1).reduce((sum, e) => sum + e.damage!, 0);
      const heavy = bout(fighter);
      heavy.input('a', { attack: 'heavy' });
      heavy.step(2.5);
      const blow = heavy.mine('hit').reduce((sum, e) => sum + e.damage!, 0);
      expect(blow, `${fighter}'s heavy lands`).toBeGreaterThan(0);
      expect(string / blow, `${fighter}: the rush takes ${string} against the heavy's ${blow}`).toBeGreaterThanOrEqual(1.1);
      expect(string / blow, `${fighter}: the rush takes ${string} against the heavy's ${blow}`).toBeLessThanOrEqual(1.7);
    }
  });

  it('keeps Kurama\'s own names for the string, on the base timing', () => {
    const names = [1, 2, 3].map(stage => rushMove('naruto', stage, true).name);
    expect(names).toEqual(['Kurama Swipe', 'Tail Lash', 'Tailed Beast Slam']);
    for (const stage of [1, 2, 3]) {
      expect(rushMove('naruto', stage, true).contacts).toEqual(rushMove('naruto', stage, false).contacts);
      expect(rushMove('naruto', stage, true).duration).toBe(rushMove('naruto', stage, false).duration);
    }
    expect(rushMove('luffy', 2, true)).toBe(rushMove('luffy', 2, false));
  });
});

describe('advancing the string', () => {
  it('carries a light pressed into a landed stage on to the next, and says which one on every event', () => {
    const fight = bout('zoro');
    mash(fight, 2);
    const casts = fight.mine('cast');
    expect(casts.slice(0, 4).map(e => e.chain)).toEqual([0, 1, 2, 3]);
    expect(casts.slice(0, 4).map(e => e.move)).toEqual([MOVES.zoro.light.name, ...RUSH.zoro.map(stage => stage.name)]);
    expect(fight.mine('hit').slice(0, 4).map(e => e.chain)).toEqual([0, 1, 2, 3]);
    const seqs = casts.slice(0, 4).map(e => e.actionSeq);
    expect(new Set(seqs).size).toBe(4);
  });

  it('publishes the running stage on the fighter', () => {
    const fight = bout('goku');
    const stages = new Set<number>();
    fight.step(1.6, i => {
      if (i % 4 === 0) fight.input('a', { attack: 'light' });
      const p = fight.sim.getPlayer('a')!;
      if (p.action === 'light') stages.add(p.chain!);
    });
    expect([...stages]).toEqual([0, 1, 2, 3]);
  });

  it('lets a whiffed stage run its course, then carries on inside the window', () => {
    const fight = bout('zoro', 'goku', 14);
    fight.input('a', { attack: 'light' });
    fight.step(.2);
    fight.input('a', { attack: 'light' });
    const started = fight.sim.getPlayer('a')!.actionStarted;
    fight.step(MOVES.zoro.light.duration - .25);
    expect(fight.sim.getPlayer('a')!.actionStarted, 'the whiff is not cancelled').toBe(started);
    fight.step(.2);
    const casts = fight.mine('cast');
    expect(casts.map(e => e.chain)).toEqual([0, 1]);
    expect(casts[1].serverTime - casts[0].serverTime, 'the next stage waits for the whiff to finish')
      .toBeGreaterThanOrEqual(MOVES.zoro.light.duration - 1e-9);
    fight.step(RUSH.zoro[0].duration + .05);
    fight.input('a', { attack: 'light' });
    fight.step(.1);
    expect(fight.mine('cast').map(e => e.chain)).toEqual([0, 1, 2]);
  });

  it('starts the string again from the fighter\'s own light once the window lapses', () => {
    const fight = bout('zoro', 'goku', 14);
    fight.input('a', { attack: 'light' });
    fight.step(MOVES.zoro.light.duration + RUSH_WINDOW + .05);
    fight.input('a', { attack: 'light' });
    fight.step(.1);
    expect(fight.mine('cast').map(e => e.chain)).toEqual([0, 0]);
  });

  it('breaks the string on a dash or a guard', () => {
    for (const change of [{ dash: true }, { guard: true }]) {
      const fight = bout('zoro', 'goku', 14);
      fight.step(.5);
      fight.input('a', { attack: 'light' });
      fight.step(MOVES.zoro.light.duration + .02);
      fight.step(.1, () => fight.input('a', change));
      fight.step(.3);
      fight.input('a', { attack: 'light' });
      fight.step(.1);
      expect(fight.mine('cast').map(e => e.chain), JSON.stringify(change)).toEqual([0, 0]);
    }
  });

  it('never cuts the finisher short with a light, and starts over after it', () => {
    const fight = bout('zoro');
    fight.step(JUST_GUARD_WINDOW + .05, () => fight.input('b', { guard: true }));
    fight.step(3, i => { if (i % 4 === 0) fight.input('a', { attack: 'light' }); fight.input('b', { guard: true }); });
    const casts = fight.mine('cast');
    const finish = casts.findIndex(e => e.chain === 3);
    expect(finish).toBe(3);
    expect(fight.events.some(e => e.kind === 'blocked' && e.actorId === 'a'), 'the string was blocked').toBe(true);
    const next = casts[finish + 1];
    expect(next.chain, 'a fresh string').toBe(0);
    expect(next.serverTime - casts[finish].serverTime, 'the finisher plays out whole')
      .toBeGreaterThanOrEqual(RUSH.zoro[2].duration - 1e-9);
    expect(fight.mine('chase'), 'nobody to chase').toHaveLength(0);
    const launched = bout('zoro');
    let landedAt = -1;
    launched.step(3, i => {
      if (landedAt < 0 && launched.mine('hit').some(e => e.chain === 3)) landedAt = i;
      if (landedAt < 0 ? i % 4 === 0 : i - landedAt === 12) launched.input('a', { attack: 'light' });
    });
    const blow = launched.mine('hit').find(e => e.chain === 3)!;
    const [chase] = launched.mine('chase');
    expect(chase?.slot, 'the light is the chase').toBe('light');
    expect(chase.serverTime, 'after the finisher has landed').toBeGreaterThan(blow.serverTime);
    const air = launched.mine('cast').find(e => e.serverTime > chase.serverTime)!;
    expect(air.chain, 'a fresh string, in the air').toBe(0);
  });

  it('links every stage into the next with no gap in hitstun, for every fighter', () => {
    for (const fighter of ROSTER) {
      const fight = bout(fighter);
      let hits = 0, gap = false;
      fight.input('a', { attack: 'light' });
      for (let frame = 0; frame < 240 && hits < 4; frame++) {
        const before = fight.mine('hit').length;
        fight.sim.step(); fight.events.push(...fight.sim.snapshot(true).events);
        const landed = fight.mine('hit');
        if (landed.length > before) {
          hits = new Set(landed.map(e => e.chain)).size;
          if (!fight.mine('cast').some(e => e.chain === 3)) fight.input('a', { attack: 'light' });
        } else if (landed.length) {
          const stage = landed[landed.length - 1].chain!;
          const spent = landed.filter(e => e.chain === stage).length >= rushMove(fighter, stage, false).contacts.length;
          if (spent && stage < 3 && fight.sim.serverTime >= fight.victim.stunUntil) gap = true;
        }
      }
      expect(hits, `${fighter} lands all four stages`).toBe(4);
      expect(gap, `${fighter}'s target gets a turn inside the string`).toBe(false);
    }
  });

  it('launches on the finisher, sends the target away and freezes the pair like a heavy', () => {
    const fight = bout('zoro');
    let freeze = 0, at = 0;
    fight.step(3.5, i => {
      const finish = fight.mine('hit').find(e => e.chain === 3);
      if (!fight.mine('cast').some(e => e.chain === 3) && i % 4 === 0) fight.input('a', { attack: 'light' });
      if (finish && !freeze) { freeze = fight.attacker.hitstopUntil - fight.attacker.hitstopFrom; at = fight.sim.getPlayer('b')!.z; }
    });
    const finish = fight.mine('hit').find(e => e.chain === 3)!;
    expect(finish.reaction).toBe('launched');
    expect(freeze, 'held like a heavy, not a jab').toBeCloseTo(HITSTOP.heavy * .6, 3);
    const landed = fight.sim.getPlayer('b')!;
    expect(landed.grounded, 'and down by now').toBe(true);
    expect(landed.z - at, 'sent well away, not staggered on the spot').toBeGreaterThan(1.5);
  });

  it('splats the finisher\'s victim on a wall', () => {
    const sim = new ArenaSimulation({ trainingBot: false, stage: 'galactic-arena', seed: 9 });
    const { halfZ } = sim.bounds;
    sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: halfZ - 3.2 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: halfZ - 1.6 });
    const events: CombatEvent[] = [];
    let seq = 0;
    for (let i = 0; i < 240; i++) {
      const finished = events.some(e => e.kind === 'hit' && e.chain === 3);
      sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: !finished && i % 4 === 0 ? 'light' : undefined });
      sim.step(); events.push(...sim.snapshot(true).events);
    }
    expect(events.some(e => e.kind === 'hit' && e.chain === 3)).toBe(true);
    expect(events.some(e => e.kind === 'wall-splat' && e.actorId === 'b'), 'a wall stops the rush finisher').toBe(true);
  });
});

describe('cancelling out of a stage', () => {
  it('routes any landed stage into a heavy or a special', () => {
    for (const [stage, slot] of [[1, 'heavy'], [2, 'special'], [3, 'heavy']] as const) {
      const fight = bout('zoro');
      let cancelled = false, pressed = 0;
      fight.step(3, i => {
        const landed = fight.mine('hit').filter(e => e.slot === 'light').map(e => e.chain ?? 0);
        const reached = landed.includes(stage);
        if (i === 0 || (!reached && pressed <= stage && landed.includes(pressed - 1) && pressed < stage + 1)) { fight.input('a', { attack: 'light' }); pressed++; }
        if (reached && !cancelled) { fight.input('a', { attack: slot }); cancelled = true; }
      });
      const casts = fight.mine('cast');
      const from = casts.find(e => e.chain === stage)!, into = casts.find(e => e.slot === slot)!;
      expect(into, `stage ${stage} into ${slot}`).toBeDefined();
      expect(into.branch, `stage ${stage} into ${slot}: its ender`).toBe(comboKeyFor('zoro', slot, stage, false));
      expect(into.serverTime - from.serverTime, `stage ${stage} cancels into ${slot} before it would end`)
        .toBeLessThan(RUSH.zoro[stage - 1].duration);
    }
  });
});

describe('the breaker, with strings', () => {
  it('lets a whole string, a heavy and a special land without an escape', () => {
    const fight = bout('naruto');
    let phase = 0, second = false, at = 0;
    fight.step(4, i => {
      const hits = fight.mine('hit');
      if (i === 0) fight.input('a', { attack: 'light' });
      else if (!second && hits.some(e => e.chain === 0)) { fight.input('a', { attack: 'light' }); second = true; }
      else if (phase === 0 && hits.some(e => e.chain === 1)) { fight.input('a', { attack: 'heavy' }); phase = 1; }
      else if (phase === 1 && hits.some(e => e.slot === 'heavy')) { phase = 2; at = i; }
      else if (phase === 2 && i >= at + 12) { fight.input('a', { attack: 'special' }); phase = 3; }
    });
    const hits = fight.mine('hit');
    expect(fight.mine('cast').find(e => e.slot === 'heavy')?.branch, 'the launcher').toBe('llh');
    expect(hits.map(e => e.slot)).toEqual(['light', 'light', 'light', 'light', 'heavy', 'special']);
    expect(fight.events.filter(e => e.kind === 'break')).toHaveLength(0);
    expect(fight.victim.chainHits, 'string, heavy, special').toBe(3);
  });

  it('still escapes a string that opens as the sixth attack', () => {
    const fight = bout('goku');
    fight.victim.chainHits = 5; fight.victim.lastDamageAt = fight.sim.serverTime;
    mash(fight, 1);
    const breaks = fight.events.filter(e => e.kind === 'break');
    expect(breaks).toHaveLength(1);
    expect(breaks[0].actorId).toBe('b');
  });
});

describe('stage identity', () => {
  it('credits a late ki blast to the stage that threw it', () => withMove('vegeta', 'light', KI_BLAST_VOLLEY, () => {
    const fight = bout('vegeta', 'goku', 5);
    fight.input('a', { attack: 'light' });
    let pressed = false, lateBlastWhileStageOne = false, stageOneConnected = true;
    fight.step(1.2, () => {
      if (!pressed && fight.mine('hit').length === 1) { fight.input('a', { attack: 'light' }); pressed = true; }
      const cast = fight.attacker.cast;
      if (cast?.stage === 1 && fight.mine('hit').length === 2 && !lateBlastWhileStageOne) {
        lateBlastWhileStageOne = true;
        stageOneConnected = cast.connected;
      }
    });
    const hits = fight.mine('hit');
    expect(hits.map(e => e.chain)).toEqual([0, 0]);
    expect(lateBlastWhileStageOne, 'the second blast landed during stage 1').toBe(true);
    expect(stageOneConnected, 'and does not count as the punch connecting').toBe(false);
    const stageOneSeq = fight.mine('cast').find(e => e.chain === 1)!.actionSeq;
    expect(hits[1].actionSeq, 'nor carry the punch\'s input').not.toBe(stageOneSeq);
  }));
});

describe('in the air', () => {
  const aloft = (fighter: FighterId) => {
    const fight = bout(fighter);
    const hold = () => { for (const id of ['a', 'b']) { const actor = fight.sim.actors.get(id)!; actor.state.y = 5; actor.state.grounded = false; actor.vy = 0; } };
    hold();
    fight.step(3, i => { hold(); if (i % 4 === 0 && i < 150) fight.input('a', { attack: 'light' }); });
    return fight.mine('cast');
  };

  it('stops an airborne string at stage 2, and announces each fighter\'s own air string', () => {
    expect(AIR_NORMAL_FIGHTERS).toContain('naruto');
    const kicks = aloft('naruto');
    expect(kicks.slice(0, 4).map(e => e.chain)).toEqual([0, 1, 2, 0]);
    expect(kicks.slice(0, 3).map(e => e.move)).toEqual([...AIR_RUSH.naruto!]);
    expect(RUSH_AIR_STAGES).toBe(3);
    const named = AIR_NORMAL_FIGHTERS.flatMap(id => [1, 2].map(stage => airRushName(id, stage)));
    expect(new Set(named).size).toBe(named.length);
    for (const name of named) expect(AIR_RUSH_NAMES as readonly string[]).not.toContain(name);
    const swords = aloft('zoro');
    expect(swords.slice(0, 4).map(e => e.chain)).toEqual([0, 1, 2, 0]);
    expect(swords.slice(0, 3).map(e => e.move)).toEqual([...AIR_RUSH.zoro!]);
    expect(swords[1].move).not.toBe(RUSH.zoro[0].name);
  });
});

describe('rollback', () => {
  it.each(['zoro', 'vegeta', 'naruto', 'killua'] as FighterId[])('replays a mashed %s string under WAN batching without a correction', fighter => {
    const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
    server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('foe', 'goku', 'Foe', false, { x: 0, y: 0, z: 1.8 });
    const prediction = new Prediction(), queue = new InputQueue();
    prediction.start('me', server.snapshot(true, true));
    const upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
    let maxCorrection = 0, chains = new Set<number>();
    try {
      for (let tick = 0; tick < 300; tick++) {
        const input: PlayerInput = { seq: tick, moveX: tick > 200 && tick < 230 ? 1 : 0, moveZ: 0, yaw: 0, targetId: 'foe',
          attack: tick >= 20 && tick < 160 && tick % 5 === 0 ? 'light' : undefined };
        prediction.submit(input); upload.push({ tick: tick + 9, input });
        while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        server.step(1 / 60, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) {
          const snapshot = server.snapshot(true, true);
          for (const e of snapshot.events) if (e.kind === 'cast' && e.actorId === 'me' && e.chain !== undefined) chains.add(e.chain);
          download.push({ tick: tick + 9, s: snapshot });
        }
        while (download.length && download[0].tick <= tick) {
          const before = prediction.diagnostics.position!; prediction.reconcile(download.shift()!.s); const after = prediction.diagnostics.position!;
          maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
        }
      }
      expect([...chains].sort(), 'the server ran the whole string').toEqual([0, 1, 2, 3]);
      expect(maxCorrection).toBeLessThan(.001);
    } finally { prediction.stop(); server.dispose(); }
  });

  it('carries the stage through the checkpoint and draws the local copy\'s', () => {
    const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
    server.addPlayer('me', 'zoro', 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('foe', 'goku', 'Foe', false, { x: 0, y: 0, z: 1.6 });
    const prediction = new Prediction();
    prediction.start('me', server.snapshot(true, true));
    try {
      for (let tick = 0; tick < 60; tick++) prediction.submit({ seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', attack: tick % 4 === 0 ? 'light' : undefined });
      const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
      expect(shown.action).toBe('light');
      expect(shown.chain, 'the stage drawn is the one being predicted, not the server\'s').toBeGreaterThan(0);
    } finally { prediction.stop(); server.dispose(); }
  });
});
