import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { CHIP, GUARD_REAR_COST, JUST_GUARD_ADVANTAGE, JUST_GUARD_METER, JUST_GUARD_WINDOW, MOVES, PARRY_FREEZE, PARRY_LOCKOUT,
  PARRY_REACH, PARRY_REARM, PARRY_STAMINA } from '../src/game/moves';
import type { AttackSlot, CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';


const TICK = 1 / 60;
const ticks = (seconds: number) => Math.round(seconds / TICK);
type Actorish = { cast: unknown; stunUntil: number; vanishedAt: number; guardAt: number; parryLockUntil: number; counterUntil: number; botSkill: number };

function bout(attacker: FighterId, defender: FighterId = 'goku', gap = 1.6, seed = 9, defenderFirst = false) {
  const sim = new ArenaSimulation({ trainingBot: false, seed });
  if (defenderFirst) sim.addPlayer('b', defender, 'B', false, { x: 0, y: 0, z: gap });
  sim.addPlayer('a', attacker, 'A', false, { x: 0, y: 0, z: 0 });
  if (!defenderFirst) sim.addPlayer('b', defender, 'B', false, { x: 0, y: 0, z: gap });
  let seq = 0;
  const events: CombatEvent[] = [];
  const input = (id: 'a' | 'b', more: Partial<PlayerInput> = {}) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, targetId: id === 'a' ? 'b' : 'a', ...more });
  const step = (n: number, each?: (i: number) => void) => {
    for (let i = 0; i < n; i++) { each?.(i); sim.step(); events.push(...sim.snapshot(true).events); }
  };
  const actor = (id: 'a' | 'b') => sim.actors.get(id) as unknown as Actorish;
  const state = (id: 'a' | 'b') => sim.actors.get(id)!.state;
  const on = (kind: CombatEvent['kind'], target = 'b') => events.filter(e => e.kind === kind && e.targetId === target);
  input('a'); input('b'); step(20);
  return { sim, input, step, events, actor, state, on };
}

function contactTick(attacker: FighterId, slot: AttackSlot, defender: FighterId = 'goku', gap = 1.6) {
  const dry = bout(attacker, defender, gap);
  dry.state('a').ultimate = 100;
  dry.input('a', { attack: slot });
  let at = -1;
  dry.step(300, i => {
    dry.input('b', { guard: true });
    if (at < 0 && dry.events.some(e => e.targetId === 'b' && ['blocked', 'guard-break', 'just-guard', 'hit'].includes(e.kind))) at = i - 1;
  });
  dry.sim.dispose();
  return at;
}

function parryAt(attacker: FighterId, slot: AttackSlot, lead: number, defender: FighterId = 'goku', gap = 1.6) {
  const contact = contactTick(attacker, slot, defender, gap);
  const fight = bout(attacker, defender, gap);
  fight.state('a').ultimate = 100;
  fight.input('a', { attack: slot });
  const press = contact - ticks(lead);
  fight.step(contact + 4, i => fight.input('b', { guard: i >= press }));
  return fight;
}

describe('the Perfect Parry window', () => {
  it('opens on a fresh press and is JUST_GUARD_WINDOW long', () => {
    expect(contactTick('zoro', 'heavy')).toBeGreaterThan(ticks(JUST_GUARD_WINDOW) + 3);
    const inside = parryAt('zoro', 'heavy', JUST_GUARD_WINDOW - 2 * TICK);
    expect(inside.on('just-guard'), 'pressed inside the window').toHaveLength(1);
    const early = parryAt('zoro', 'heavy', JUST_GUARD_WINDOW + 3 * TICK);
    expect(early.on('just-guard'), 'pressed before it').toHaveLength(0);
    expect(early.on('blocked'), 'is a block').toHaveLength(1);
    const late = parryAt('zoro', 'heavy', -2 * TICK);
    expect(late.on('just-guard'), 'after the blow').toHaveLength(0);
    expect(late.on('hit'), 'lands').toHaveLength(1);
  });

  it('needs the button up for PARRY_REARM first: a quick re-press is only a guard', () => {
    const contact = contactTick('zoro', 'heavy');
    for (const [up, parries] of [[PARRY_REARM - 3 * TICK, false], [PARRY_REARM + TICK, true]] as const) {
      const fight = bout('zoro');
      fight.step(ticks(JUST_GUARD_WINDOW + PARRY_LOCKOUT) + 6, () => { fight.input('a'); fight.input('b', { guard: true }); });
      fight.input('a', { attack: 'heavy' });
      const press = contact - ticks(JUST_GUARD_WINDOW * .5), release = press - ticks(up);
      fight.step(contact + 4, i => fight.input('b', { guard: i < release || i >= press }));
      expect(fight.on('just-guard').length > 0, `up for ${up.toFixed(3)} s`).toBe(parries);
      expect(fight.on('just-guard').length + fight.on('blocked').length, 'and it is guarded either way').toBe(1);
    }
  });

  it('locks a whiffed window out for PARRY_LOCKOUT, and not a moment longer', () => {
    const contact = contactTick('zoro', 'light');
    for (const [gapAfterWhiff, parries] of [[PARRY_LOCKOUT * .6, false], [PARRY_LOCKOUT + .05, true]] as const) {
      const fight = bout('zoro');
      const tap = ticks(.12), pressAt = ticks(JUST_GUARD_WINDOW + gapAfterWhiff), swingAt = pressAt + ticks(JUST_GUARD_WINDOW * .5) - contact;
      fight.step(swingAt + contact + 4, i => {
        if (i === swingAt) fight.input('a', { attack: 'light' });
        fight.input('b', { guard: i < tap || i >= pressAt });
      });
      expect(fight.on('just-guard').length > 0, `pressed ${gapAfterWhiff.toFixed(2)} s after the whiffed window closed`).toBe(parries);
      expect(fight.on('blocked').length + fight.on('just-guard').length, 'and the guard still blocks').toBe(1);
    }
  });

  it('never re-arms for a guard that is held', () => {
    const fight = bout('goku', 'goku');
    let parries = 0, blocks = 0;
    for (let i = 0; i < 600; i++) {
      fight.input('a', { attack: i >= ticks(JUST_GUARD_WINDOW) + 2 ? 'light' : undefined }); fight.input('b', { guard: true });
      fight.sim.step();
      for (const e of fight.sim.snapshot(true).events) { if (e.kind === 'blocked') blocks++; if (e.kind === 'just-guard') parries++; }
    }
    expect(blocks).toBeGreaterThan(5);
    expect(parries, 'at most the first press, which really was a press').toBeLessThanOrEqual(1);
  });

  it('turns mashing into a losing strategy and rewards a read (a seeded human model)', () => {
    let seed = 11;
    const rnd = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
    const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
    const contact = MOVES.zoro.light.contacts[0];
    const play = (strategy: 'read' | 'mash' | 'fish') => {
      const fight = bout('zoro', 'naruto');
      let next = 1, plan = Infinity, swings = 0;
      fight.step(60 * 50, i => {
        const t = i * TICK;
        const a = fight.actor('a'), b = fight.actor('b');
        b.vanishedAt = fight.sim.serverTime - .65;
        if (i % 30 === 0 && !a.cast && t > next - .5) { fight.sim.place('a', { x: 0, y: 0, z: 0 }); fight.sim.place('b', { x: 0, y: 0, z: 1.6 }, Math.PI); }
        let attack: AttackSlot | undefined;
        if (t >= next && !a.cast && fight.sim.serverTime >= a.stunUntil) {
          attack = 'light'; swings++; next = t + 1.1 + rnd() * .9;
          plan = t + contact - (JUST_GUARD_WINDOW * .5 + gauss() * .03);
        }
        const guard = strategy === 'read' ? t >= plan && t < plan + .35 : strategy === 'mash' ? (t * 10) % 1 < .5 : t % .3 < .15;
        fight.input('a', { attack }); fight.input('b', { guard });
      });
      const parried = fight.events.filter(e => e.kind === 'just-guard' && e.targetId === 'b').length;
      fight.sim.dispose();
      return parried / swings;
    };
    const read = play('read'), mash = play('mash'), fish = play('fish');
    expect(read, 'a read parries nearly every jab').toBeGreaterThan(.85);
    expect(mash, 'mashing parries none').toBe(0);
    expect(fish, 'fishing with taps parries a few').toBeLessThan(.25);
  });
});

describe('what a Perfect Parry is worth', () => {
  it('takes nothing, gives back guard and meter, freezes both bodies, and staggers the thrower', () => {
    const contact = contactTick('zoro', 'light');
    const fight = bout('zoro');
    const b = fight.state('b');
    b.stamina = 50;
    fight.input('a', { attack: 'light' });
    let before = 0;
    fight.step(contact + 1, i => { if (!fight.on('just-guard').length) before = b.stamina; fight.input('b', { guard: i >= contact - ticks(.08) }); });
    const [parry] = fight.on('just-guard');
    expect(parry, 'parried').toBeDefined();
    expect(b.hp).toBe(1000);
    expect(b.stamina - before, 'the guard given back').toBeCloseTo(PARRY_STAMINA, 5);
    expect(b.ultimate).toBe(JUST_GUARD_METER);
    const snap = fight.sim.snapshot();
    for (const id of ['a', 'b']) {
      const p = snap.players.find(q => q.id === id)!;
      expect(p.hitstopUntil! - p.hitstopFrom!, `${id} frozen`).toBeCloseTo(PARRY_FREEZE, 2);
    }
    const a = fight.actor('a');
    expect(a.cast, 'the swing is over').toBeNull();
    expect(a.stunUntil - fight.sim.serverTime, 'reeling for the stagger').toBeCloseTo(JUST_GUARD_ADVANTAGE, 2);
    fight.step(ticks(PARRY_FREEZE));
    expect(a.stunUntil - fight.sim.serverTime, 'and still, after the freeze').toBeCloseTo(JUST_GUARD_ADVANTAGE, 1);
    expect(fight.sim.getPlayer('a')!.action).toBe('hurt');
  });

  const punish = (defender: FighterId, slot: AttackSlot, delay: number, presses = 1, attacker: FighterId = 'zoro', every = .22) => {
    const contact = contactTick(attacker, 'light', defender);
    const fight = bout(attacker, defender);
    const a = fight.actor('a');
    let swung = false, parriedAt = -1, pressed = 0;
    fight.input('a', { attack: 'light' });
    fight.step(contact + 150, i => {
      swung ||= !!a.cast;
      fight.input('a', { guard: swung });
      if (parriedAt < 0 && fight.events.some(e => e.kind === 'just-guard')) parriedAt = i;
      const press = parriedAt >= 0 && pressed < presses && i - parriedAt >= ticks(delay) + pressed * ticks(every);
      if (press) pressed++;
      const p = fight.state('b'), q = fight.state('a');
      fight.input('b', { guard: i >= contact - ticks(JUST_GUARD_WINDOW * .5), attack: press ? slot : undefined, yaw: Math.atan2(q.x - p.x, q.z - p.z) });
    });
    const answer = fight.events.filter(e => e.actorId === 'b' && e.targetId === 'a' && ['hit', 'blocked', 'just-guard', 'guard-break'].includes(e.kind));
    fight.sim.dispose();
    return { parried: parriedAt >= 0, answer };
  };

  it('is a guaranteed heavy for every fighter on the roster - pressed through the freeze, or a third of a second late', () => {
    for (const defender of Object.keys(MOVES) as FighterId[]) {
      for (const delay of [0, .3]) {
        const { parried, answer } = punish(defender, 'heavy', delay);
        expect(parried, `${defender} parries`).toBe(true);
        expect(answer[0]?.kind, `${defender}'s heavy pressed ${delay} s after the parry`).toBe('hit');
      }
    }
  });

  it('is a guaranteed light string for every fighter on the roster, every stage of it', () => {
    for (const defender of Object.keys(MOVES) as FighterId[]) {
      const { answer } = punish(defender, 'light', .2, 8, 'zoro', .1);
      const stages = new Set(answer.filter(e => e.kind === 'hit').map(e => e.chain));
      expect(answer[0]?.kind, `${defender}'s string opens on a hit`).toBe('hit');
      expect(stages.size, `${defender}'s string lands every stage: ${answer.map(e => e.kind + (e.chain ?? '')).join(' ')}`).toBe(4);
      const finisher = answer.findIndex(e => e.kind === 'hit' && e.chain === 3);
      expect(answer.slice(0, finisher + 1).every(e => e.kind === 'hit'), `${defender}: nothing guarded before the finisher`).toBe(true);
    }
  });

  it('beats a guard-breaking blow that breaks a held guard: the high-skill answer to a red move', () => {
    for (const [attacker, slot] of [['law', 'special'], ['shanks', 'special'], ['ace', 'special']] as const) {
      const held = parryAt(attacker, slot, JUST_GUARD_WINDOW + .2);
      expect(held.on('guard-break'), `${attacker}'s ${slot} breaks a held guard`).toHaveLength(1);
      const parried = parryAt(attacker, slot, JUST_GUARD_WINDOW * .5);
      expect(parried.on('just-guard'), `and is parried on the beat`).toHaveLength(1);
      expect(parried.on('guard-break')).toHaveLength(0);
      expect(parried.sim.getPlayer('b')!.hp).toBe(1000);
    }
  });

  it('is never an ultimate: a guard-breaking one breaks the guard, a blockable one is only blocked', () => {
    const zoro = parryAt('zoro', 'ultimate', JUST_GUARD_WINDOW * .5);
    expect(zoro.on('just-guard'), 'Trichiliocosm is dodged, not parried').toHaveLength(0);
    expect(zoro.on('guard-break')).toHaveLength(1);
    const goku = parryAt('goku', 'ultimate', JUST_GUARD_WINDOW * .5, 'zoro', 6);
    expect(goku.on('just-guard'), 'the Spirit Bomb').toHaveLength(0);
    expect(goku.on('blocked'), 'is held off, at a price').toHaveLength(1);
  });
});

describe('a parried shot', () => {
  it('is destroyed; its thrower reels only from point blank', () => {
    const far = parryAt('ace', 'special', JUST_GUARD_WINDOW * .5, 'goku', 12);
    const [deflect] = far.on('just-guard');
    expect(deflect?.reason, 'destroyed').toBe('deflect');
    expect(far.sim.serverTime < far.actor('a').stunUntil, 'Ace is not staggered').toBe(false);
    far.step(120);
    expect(far.on('hit'), 'and nothing lands later').toHaveLength(0);
    expect(far.sim.getPlayer('b')!.hp).toBe(1000);
    const near = parryAt('ace', 'special', JUST_GUARD_WINDOW * .5, 'goku', PARRY_REACH - 1.5);
    expect(near.on('just-guard')[0]?.reason).toBeUndefined();
    expect(near.sim.serverTime < near.actor('a').stunUntil, 'from point blank, Ace reels').toBe(true);
  });

  it('cuts a beam off at the guard', () => {
    const beam = parryAt('gojo', 'special', JUST_GUARD_WINDOW * .5, 'goku', 10);
    expect(beam.on('just-guard')).toHaveLength(1);
    expect(beam.actor('a').cast, 'Hollow Purple is over').toBeNull();
    beam.step(90);
    expect(beam.sim.getPlayer('b')!.hp).toBe(1000);
  });
});

describe('the guard', () => {
  it('covers every side, charges GUARD_REAR_COST more from behind, and never parries from behind', () => {
    const cost = (yaw: number, lead: number | 'held') => {
      const contact = contactTick('zoro', 'light');
      const fight = bout('zoro');
      if (lead === 'held') fight.step(ticks(JUST_GUARD_WINDOW) + 2, () => { fight.input('a'); fight.input('b', { guard: true, yaw }); });
      const before = fight.sim.getPlayer('b')!.stamina;
      fight.input('a', { attack: 'light' });
      fight.step(contact + 2, i => fight.input('b', { guard: lead === 'held' || i >= contact - ticks(lead), yaw }));
      return { fight, spent: before - fight.sim.getPlayer('b')!.stamina };
    };
    const front = cost(Math.PI, 'held'), back = cost(0, 'held'), backBeat = cost(0, JUST_GUARD_WINDOW * .5);
    expect(front.fight.on('blocked')).toHaveLength(1);
    expect(back.fight.on('blocked'), 'blocked from behind').toHaveLength(1);
    expect(back.spent / front.spent).toBeCloseTo(GUARD_REAR_COST, 1);
    expect(backBeat.fight.on('just-guard'), 'no parry from behind').toHaveLength(0);
    expect(backBeat.fight.on('blocked')).toHaveLength(1);
    expect(front.fight.sim.getPlayer('b')!.hp).toBe(1000 - Math.max(1, Math.round(MOVES.zoro.light.damage * CHIP.light)));
  });

  it('holds through the blockstun: a second blow inside it is blocked with the button already let go', () => {
    const fight = bout('zoro', 'goku', 1.5);
    fight.step(30, () => fight.input('b', { guard: true }));
    fight.input('a', { attack: 'heavy' });
    for (let i = 0; i < 90 && !fight.on('blocked').length; i++) fight.step(1, () => fight.input('b', { guard: true }));
    expect(fight.on('blocked')).toHaveLength(1);
    const jab = MOVES.goku.light, from = { x: 0, y: 1, z: 0 };
    const at = fight.on('blocked')[0].serverTime;
    const strikeAt = (t: number) => { while (fight.sim.serverTime < t) fight.step(1, () => fight.input('b', { guard: false })); fight.sim.strike('a', 'b', 'light', jab, from); fight.step(1); };
    strikeAt(at + .12);
    strikeAt(at + .7);
    const answered = fight.events.filter(e => e.targetId === 'b' && ['hit', 'blocked'].includes(e.kind)).map(e => e.kind);
    expect(answered, 'held; inside the blockstun with the button up; and then the guard really is down').toEqual(['blocked', 'blocked', 'hit']);
  });

  it('empties under pressure: two light strings and a heavy no longer break a full guard, a third string does', () => {
    const fight = bout('zoro', 'goku', 1.5);
    const string = () => {
      for (let k = 0; k < 4; k++) { fight.input('a', { attack: 'light' }); fight.step(13, () => fight.input('b', { guard: true })); }
      fight.step(50, () => fight.input('b', { guard: true }));
      fight.sim.place('a', { x: 0, y: 0, z: 0 }); fight.sim.place('b', { x: 0, y: 0, z: 1.5 }, Math.PI);
    };
    fight.step(10, () => fight.input('b', { guard: true }));
    string(); string();
    fight.input('a', { attack: 'heavy' }); fight.step(70, () => fight.input('b', { guard: true }));
    expect(fight.on('guard-break'), 'two strings and a heavy held').toHaveLength(0);
    expect(fight.sim.getPlayer('b')!.stamina).toBeLessThan(40);
    string(); string();
    expect(fight.on('guard-break').length, 'and the guard opens').toBeGreaterThan(0);
  });
});

describe('the parry under prediction', () => {
  it('agrees, through a laggy wire, with the server about every parry field', () => {
    const server = new ArenaSimulation({ trainingBot: false, seed: 5 });
    server.addPlayer('me', 'goku', 'Me', false, { x: 0, y: 0, z: 1.6 });
    server.addPlayer('foe', 'zoro', 'Foe', false, { x: 0, y: 0, z: 0 });
    const prediction = new Prediction(), queue = new InputQueue();
    prediction.start('me', server.snapshot(true, true));
    const lag = 6, upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
    const swing = 80, guardAt = swing + ticks(MOVES.zoro.light.contacts[0] - JUST_GUARD_WINDOW * .5) - lag - 3;
    const fields = ['guardAt', 'guardHeld', 'guardReleasedAt', 'parryCaught', 'parryLockUntil', 'counterUntil', 'parriedUntil'] as const;
    let parried = false, cast = false;
    try {
      for (let tick = 0; tick < 200; tick++) {
        const guard = tick >= 4 && tick < 9 || tick >= guardAt && tick < guardAt + 40;
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'foe', guard, attack: tick === guardAt + 22 ? 'heavy' : undefined };
        prediction.submit(input); upload.push({ tick: tick + lag, input });
        while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        server.submitInput('foe', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'me', attack: tick === swing ? 'light' : undefined });
        server.step(TICK, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) download.push({ tick: tick + lag, s: server.snapshot(true, true) });
        while (download.length && download[0].tick <= tick) {
          const snapshot = download.shift()!.s;
          parried ||= snapshot.events.some(e => e.kind === 'just-guard' && e.targetId === 'me');
          cast ||= snapshot.events.some(e => e.kind === 'cast' && e.actorId === 'me' && e.slot === 'heavy');
          for (const key of fields) expect(key in snapshot.prediction!.me, `${key} rides the checkpoint`).toBe(true);
          prediction.reconcile(snapshot);
        }
      }
      expect(parried, 'the server parried it').toBe(true);
      expect(cast, 'and the punish went out with the guard still held').toBe(true);
      expect(server.getPlayer('foe')!.hp, 'and landed').toBeLessThan(1000);
      const local = (prediction as unknown as { sim: ArenaSimulation }).sim.actors.get('me')! as unknown as Record<string, unknown>;
      const truth = server.actors.get('me')! as unknown as Record<string, unknown>;
      for (const key of fields) expect(local[key], key).toEqual(truth[key]);
      expect('parriedUntil' in server.snapshot().reactions!.foe).toBe(true);
    } finally { prediction.stop(); server.dispose(); }
  });
});

describe('the parry on screen', () => {
  it('draws the local fighter\'s vanish with the parry: held where it was until the presented clock reaches it', () => {
    const server = new ArenaSimulation({ trainingBot: false, seed: 5 });
    server.addPlayer('me', 'goku', 'Me', false, { x: 0, y: 0, z: 1.6 });
    server.addPlayer('foe', 'zoro', 'Foe', false, { x: 0, y: 0, z: 0 });
    const prediction = new Prediction(), queue = new InputQueue();
    prediction.start('me', server.snapshot(true, true));
    const lag = 6, delay = .1, upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
    const swing = 30, guardAt = swing + ticks(MOVES.zoro.light.contacts[0] - JUST_GUARD_WINDOW * .5) - lag - 3;
    let held = false, snapped = false, vanishAt = Infinity, endpoint: { x: number; z: number } | undefined;
    try {
      for (let tick = 0; tick < 120; tick++) {
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'foe', guard: tick >= guardAt && tick < guardAt + 30 };
        prediction.submit(input); upload.push({ tick: tick + lag, input });
        while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        server.submitInput('foe', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'me', attack: tick === swing ? 'light' : undefined });
        server.step(TICK, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) download.push({ tick: tick + lag, s: server.snapshot(true, true) });
        while (download.length && download[0].tick <= tick) {
          const snapshot = download.shift()!.s;
          prediction.visualTime = snapshot.serverTime - delay;
          const vanish = snapshot.events.find(e => e.kind === 'vanish' && e.actorId === 'me');
          if (vanish) { vanishAt = vanish.serverTime; endpoint = vanish.endpoint; }
          prediction.reconcile(snapshot);
        }
        const now = server.serverTime - delay - lag * TICK;
        prediction.visualTime = now;
        const shown = prediction.sample(TICK, server.getPlayer('me')!)!;
        if (endpoint && shown) {
          const there = Math.hypot(shown.x - endpoint.x, shown.z - endpoint.z) < .3;
          if (now < vanishAt && !there) held = true;
          if (now >= vanishAt && there) snapped = true;
        }
      }
      expect(Number.isFinite(vanishAt), 'the parry vanished').toBe(true);
      expect(held, 'drawn where it stood until the parry is presented').toBe(true);
      expect(snapped, 'and at the vanish once it is').toBe(true);
    } finally { prediction.stop(); server.dispose(); }
  });
});

describe('bots guard like people', () => {
  const spar = (skill: number, seed: number, slot: AttackSlot = 'light', attacker: FighterId = 'zoro') => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed });
    sim.addPlayer('me', attacker, 'Me', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('bot', 'goku', 'Bot', true, { x: 0, y: 0, z: 2 });
    const bot = sim.actors.get('bot') as unknown as Actorish & { reaction: unknown; state: { x: number; z: number } };
    bot.botSkill = skill;
    let seq = 0, next = 1;
    const tally = { contacts: 0, parried: 0, blocked: 0 };
    for (let i = 0; i < 60 * 60; i++) {
      const me = sim.getPlayer('me')!, b = bot.state, t = i * TICK;
      const d = Math.hypot(b.x - me.x, b.z - me.z);
      const free = !bot.cast && !bot.reaction && sim.serverTime >= bot.stunUntil;
      const attack = t >= next && d < 2.6 && free && sim.serverTime > (me.cooldowns[slot] ?? 0) ? slot : undefined;
      if (attack) next = t + 1.6 + (i * 7919 % 90) / 100;
      sim.submitInput('me', { seq: seq++, moveX: d > 2 ? (b.x - me.x) / d : 0, moveZ: d > 2 ? (b.z - me.z) / d : 0,
        yaw: Math.atan2(b.x - me.x, b.z - me.z), targetId: 'bot', attack });
      sim.step();
      for (const e of sim.snapshot(true).events) if (e.actorId === 'me' && e.targetId === 'bot' && (e.chain ?? 0) === 0 && (e.contactIndex ?? 0) === 0
        && ['hit', 'blocked', 'just-guard', 'guard-break'].includes(e.kind)) {
        tally.contacts++;
        if (e.kind === 'just-guard') tally.parried++;
        if (e.kind === 'blocked') tally.blocked++;
      }
    }
    sim.dispose();
    return tally;
  };
  const sum = (skill: number, slot: AttackSlot, attackers: FighterId[], seeds: number[]) => attackers.flatMap(f => seeds.map(seed => spar(skill, seed, slot, f)))
    .reduce((a, b) => ({ contacts: a.contacts + b.contacts, parried: a.parried + b.parried, blocked: a.blocked + b.blocked }));
  const rate = (t: { contacts: number; parried: number }) => t.parried / t.contacts;

  it('never parry a jab on sight - nobody can - and still block some of them', () => {
    for (const [name, skill] of [['easy', .1], ['normal', .5], ['hard', .95]] as const) {
      const jabs = sum(skill, 'light', ['zoro', 'naruto'], [3, 8, 13]);
      expect(jabs.contacts, name).toBeGreaterThan(50);
      expect(rate(jabs), `${name}: ${jabs.parried} of ${jabs.contacts} jabs parried`).toBeLessThanOrEqual(.03);
      if (skill > .3) expect(jabs.blocked / jabs.contacts, `${name}: ${jabs.blocked} of ${jabs.contacts} blocked`).toBeGreaterThan(.08);
    }
  });

  it('parry a heavy at a person\'s rate by difficulty, never every one, and block some of them', () => {
    const easy = sum(.1, 'heavy', ['zoro', 'ichigo'], [3, 8, 13]), normal = sum(.5, 'heavy', ['zoro', 'ichigo'], [3, 8, 13]),
      hard = sum(.95, 'heavy', ['zoro', 'ichigo'], [3, 8, 13]);
    const line = `easy ${easy.parried}/${easy.contacts}, normal ${normal.parried}/${normal.contacts}, hard ${hard.parried}/${hard.contacts}`;
    expect(hard.parried, line).toBeGreaterThan(normal.parried);
    expect(normal.parried, line).toBeGreaterThan(easy.parried);
    expect(rate(hard), line).toBeGreaterThan(.05);
    expect(rate(hard), line).toBeLessThan(.25);
    expect(rate(normal), line).toBeLessThan(.15);
    expect(rate(easy), line).toBeLessThan(.05);
    expect(normal.blocked / normal.contacts, 'a normal bot blocks some of the time').toBeGreaterThan(.08);
    expect(hard.blocked / hard.contacts, 'and a hard one').toBeGreaterThan(.08);
  });

  it('parry only on purpose: a block or a turtle raised close to a blow is a block', () => {
    for (const timed of [false, true]) {
      const sim = new ArenaSimulation({ trainingBot: false, seed: 4 });
      sim.addPlayer('me', 'zoro', 'Me', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('bot', 'goku', 'Bot', true, { x: 0, y: 0, z: 1.6 });
      sim.place('bot', { x: 0, y: 0, z: 1.6 }, Math.PI);
      const bot = sim.actors.get('bot') as unknown as Actorish & { nextBotThink: number; botGuardFrom?: number; botGuardUntil?: number; botTimed?: boolean; state: { stamina: number } };
      let seq = 0;
      const events: CombatEvent[] = [];
      const contact = contactTick('zoro', 'heavy');
      const me = sim.actors.get('me') as unknown as { cast: { id: number; nextContact: number } | null };
      for (let i = 0; i < contact + 6; i++) {
        bot.nextBotThink = Infinity;
        if (i === 0) { bot.botGuardFrom = sim.serverTime + TICK * (contact - ticks(.22)); bot.botGuardUntil = bot.botGuardFrom + .6; bot.botTimed = timed; }
        sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'bot', attack: i === 0 ? 'heavy' : undefined });
        sim.step();
        if (me.cast) (bot as unknown as { botRead: string }).botRead = `me:${me.cast.id}:${me.cast.nextContact}`;
        events.push(...sim.snapshot(true).events.filter(e => e.targetId === 'bot'));
      }
      sim.dispose();
      expect(events.map(e => e.kind).filter(k => ['hit', 'blocked', 'just-guard', 'guard-break'].includes(k)), timed ? 'timed' : 'untimed')
        .toEqual([timed ? 'just-guard' : 'blocked']);
    }
  });
});

describe('parry for people (the owner, 10 October 2026)', () => {
  const HEAVIES: FighterId[] = ['zoro', 'goku', 'naruto', 'luffy', 'guts', 'ichigo', 'law', 'kakashi', 'sasuke', 'vegeta'];

  it('parries a heavy pressed on sight of its swing, and any blow pressed just before it lands', () => {
    let onSight = 0, early = 0;
    for (const f of HEAVIES) {
      const contact = contactTick(f, 'heavy'), lead = (contact - ticks(.29)) * TICK;
      expect(lead, `${f}'s heavy`).toBeGreaterThan(0);
      if (lead > .16) early++;
      if (lead <= JUST_GUARD_WINDOW) { onSight++; expect(parryAt(f, 'heavy', lead).on('just-guard'), `${f}'s heavy pressed on sight, ${lead.toFixed(2)} s before it lands`).toHaveLength(1); }
      for (const slot of ['light', 'heavy'] as AttackSlot[]) {
        const fight = parryAt(f, slot, 2 * TICK);
        expect(fight.on('just-guard'), `${f}'s ${slot} pressed two ticks before it lands`).toHaveLength(1);
      }
    }
    expect(onSight, 'most heavies parried on sight').toBeGreaterThanOrEqual(HEAVIES.length - 2);
    expect(early, 'which the old window turned into blocks').toBeGreaterThan(2);
  });

  it('gives a person who presses on sight most heavies offline, and most specials online (a seeded human model)', () => {
    let seed = 7;
    const rnd = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
    const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
    const model = (loop: number, first = false, slot: AttackSlot = 'heavy') => {
      let parried = 0, blows = 0;
      for (const f of HEAVIES) {
        const contact = contactTick(f, slot);
        if (contact < 0) continue;
        for (let k = 0; k < 12; k++) {
          const press = Math.round((loop + Math.min(.45, Math.max(.15, .24 + .045 * gauss()))) / TICK);
          const fight = bout(f, 'goku', 1.6, 9, first);
          fight.input('a', { attack: slot });
          fight.step(contact + 4, i => fight.input('b', { guard: i >= press && i < press + ticks(.35) }));
          blows++; if (fight.on('just-guard').length) parried++;
          fight.sim.dispose();
        }
      }
      return parried / blows;
    };
    expect(model(.05), 'heavies offline').toBeGreaterThan(.6);
    expect(model(.235, true, 'special'), 'specials online, a 100 ms round trip').toBeGreaterThan(.4);
  });

  it('still fails a press that reaches the fight after the blow, and leaves a whiffed tap open', () => {
    const late = parryAt('zoro', 'heavy', -.1);
    expect(late.on('just-guard')).toHaveLength(0);
    expect(late.on('hit'), 'the blow lands').toHaveLength(1);
    const contact = contactTick('zoro', 'heavy');
    const tap = bout('zoro');
    tap.input('a', { attack: 'heavy' });
    const pressAt = contact - ticks(JUST_GUARD_WINDOW + .05);
    tap.step(contact + 4, i => tap.input('b', { guard: i >= pressAt && i < pressAt + ticks(.12) }));
    expect(tap.on('just-guard')).toHaveLength(0);
    expect(tap.on('hit'), 'the blow lands').toHaveLength(1);
    expect(tap.sim.serverTime < tap.actor('a').stunUntil, 'the attacker does not reel').toBe(false);
    expect(tap.actor('b').parryLockUntil - tap.sim.serverTime, 'and the next parry waits').toBeGreaterThan(PARRY_LOCKOUT - .3);
  });
});
