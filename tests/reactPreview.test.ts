import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { LANDED, LandedBlows } from '../src/game/landedBlows';
import { LAUNCH_LEAD, MOVES } from '../src/game/moves';
import { InputQueue } from '../src/server/InputQueue';
import { CombatTimeline } from '../src/render/CombatTimeline';
import type { AttackSlot, CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

const LAG = 6;
type Foe = (tick: number, server: ArenaSimulation) => Partial<PlayerInput> | undefined;
type Frame = { tick: number; action: string; x: number; y: number; z: number };

function bout(fighter: FighterId, slot: AttackSlot, foe: Foe, setup?: (server: ArenaSimulation) => void, ticks = 170, gap = 2) {
  const server = new ArenaSimulation({ roomMode: 'training', trainingBot: false });
  server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('foe', 'luffy', 'Foe', false, { x: 0, y: 0, z: gap });
  LANDED.reset();
  setup?.(server);
  const prediction = new Prediction(), queue = new InputQueue();
  let snapshot = server.snapshot(true, true);
  prediction.start('me', snapshot);
  const up: { at: number; input: PlayerInput }[] = [], down: { at: number; s: GameSnapshot }[] = [];
  const drawn: Frame[] = [], impacts: CombatEvent[] = [], served: CombatEvent[] = [];
  let maxCorrection = 0;
  try {
    for (let tick = 0; tick < ticks; tick++) {
      const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', lock: true, attack: tick === 30 ? slot : undefined };
      prediction.submit(input); up.push({ at: tick + LAG, input });
      while (up.length && up[0].at <= tick) queue.push(up.shift()!.input);
      const next = queue.take(); if (next) server.submitInput('me', next);
      server.submitInput('foe', { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI, ...foe(tick, server) });
      server.step(1 / 60, new Set(next ? [] : ['me']));
      if (tick % 2 === 0) { const s = server.snapshot(true, true); served.push(...s.events); down.push({ at: tick + LAG, s }); }
      while (down.length && down[0].at <= tick) {
        const before = prediction.diagnostics.position!;
        snapshot = down.shift()!.s; prediction.reconcile(snapshot);
        const after = prediction.diagnostics.position!;
        maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
      }
      impacts.push(...prediction.takeImpacts());
      const view = prediction.sampleRemote(1 / 60, snapshot.players.find(p => p.id === 'foe')!);
      drawn.push({ tick, action: view.action, x: view.x, y: view.y, z: view.z });
    }
  } finally { prediction.stop(); server.dispose(); }
  const serverHits = served.filter(e => e.kind === 'hit' && e.actorId === 'me' && e.targetId === 'foe');
  return { drawn, impacts, served, serverHits, maxCorrection };
}
const staggered = (seconds: number) => (server: ArenaSimulation) => { const a = server.actors.get('foe')!; a.reaction = 'stun'; a.stunUntil = server.serverTime + seconds; };
const CONTACT_TICK = 30 + Math.round(MOVES.naruto.heavy.contacts[0] * 60);

describe('the Rasengan preview', () => {
  it.each([8, 14, 20, 24])('never draws a body that ran off %i ticks after the press launched when the server did not hit it', lead => {
    const run = bout('naruto', 'heavy', tick => tick >= 30 + lead ? { moveZ: 1, yaw: 0 } : undefined);
    expect(run.impacts, 'nothing presented ahead of the server').toHaveLength(0);
    if (!run.serverHits.length) expect(run.drawn.filter(f => f.action === 'launched' || f.action === 'hurt'), 'no reaction drawn').toHaveLength(0);
    for (let i = 1; i < run.drawn.length; i++) expect(Math.hypot(run.drawn[i].x - run.drawn[i - 1].x, run.drawn[i].z - run.drawn[i - 1].z), `tick ${run.drawn[i].tick}`).toBeLessThan(.3);
  });

  it('holds a blow the local copy lands on a body on the move until the server lands it', () => {
    bout('naruto', 'heavy', tick => tick >= 30 + 8 ? { moveZ: 1, yaw: 0 } : undefined);
    const blow = LANDED.blow('me', 30, 'foe', 0);
    if (blow?.predicted) expect(blow.trusted).toBe(false);
  });

  it('never draws a guarding body launched: the local copy keeps the guard and blocks it too', () => {
    const run = bout('naruto', 'heavy', () => ({ guard: true }));
    expect(run.served.some(e => e.kind === 'blocked' && e.targetId === 'foe'), 'the server blocked it').toBe(true);
    expect(run.impacts).toHaveLength(0);
    expect(run.drawn.filter(f => f.action === 'launched'), 'launched frames drawn').toHaveLength(0);
    const blow = LANDED.blow('me', 30, 'foe', 0);
    expect(!!blow?.predicted, 'the local copy did not land it').toBe(false);
    expect(LANDED.guarded('me', 'foe', 'heavy', 0, 0), 'it had it guarded').toBe(true);
  });

  it('is drawn on a body held in a reaction, on the local copy\'s contact, once', () => {
    const run = bout('naruto', 'heavy', () => undefined, staggered(1.3));
    expect(run.impacts).toHaveLength(1);
    expect(run.serverHits).toHaveLength(1);
    const at = run.drawn.find(f => f.action === 'launched')!.tick;
    expect(at - CONTACT_TICK).toBeGreaterThanOrEqual(-1);
    expect(at - CONTACT_TICK).toBeLessThanOrEqual(5);
  });

  it('lets a preview the server turns away go over a quarter second instead of a frame', () => {
    const run = bout('naruto', 'heavy', () => undefined, server => {
      staggered(1.3)(server);
      const step = server.step.bind(server);
      server.step = (dt?: number, starved?: Set<string>) => { if (server.tick === CONTACT_TICK + 1) server.actors.get('foe')!.evadeUntil = server.serverTime + .6; return step(dt, starved); };
    });
    expect(run.impacts, 'previewed').toHaveLength(1);
    expect(run.serverHits, 'the server never landed it').toHaveLength(0);
    expect(run.served.some(e => e.kind === 'dodge' && e.targetId === 'foe')).toBe(true);
    const launched = run.drawn.filter(f => f.action === 'launched');
    expect(launched.length, 'drawn launched while it stood').toBeGreaterThan(0);
    const last = run.drawn.lastIndexOf(launched.at(-1)!);
    let worst = 0;
    for (let i = last + 1; i < run.drawn.length; i++) worst = Math.max(worst, Math.hypot(run.drawn[i].x - run.drawn[i - 1].x, run.drawn[i].y - run.drawn[i - 1].y, run.drawn[i].z - run.drawn[i - 1].z));
    expect(worst, 'the biggest step, metres').toBeLessThan(.2);
    expect(LANDED.refused(LANDED.blow('me', 30, 'foe', 0))).toBe(true);
  });
});

describe('a charge-in is answered when the server lands it', () => {
  it.each(['sasuke', 'kakashi', 'zoro', 'naruto'] as FighterId[])('%s\'s, on a body standing still: landed by the local copy, held for the server', fighter => {
    const run = bout(fighter, 'heavy', () => undefined);
    const blow = LANDED.blow('me', 30, 'foe', 0);
    expect(blow?.predicted, 'the local copy landed it').toBe(true);
    expect(blow!.trusted, 'and could not vouch for it').toBe(false);
    expect(run.serverHits.length, 'the server landed it').toBeGreaterThan(0);
    expect(LANDED.held(blow), 'held no longer once the server has').toBe(false);
  });
  it('on a body held in a stagger it is answered on the local copy\'s contact', () => {
    bout('sasuke', 'heavy', () => undefined, staggered(1.3));
    expect(LANDED.blow('me', 30, 'foe', 0)?.trusted).toBe(true);
  });
});

describe('the local copy keeps a remote guard', () => {
  it.each(['goku', 'zoro', 'vegeta'] as FighterId[])('%s strings lights into a held guard under WAN batching without a correction', fighter => {
    const light = (tick: number) => tick % 9 === 0 && tick >= 30 && tick < 120;
    const server = new ArenaSimulation({ roomMode: 'training', trainingBot: false });
    server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('foe', 'luffy', 'Foe', false, { x: 0, y: 0, z: 1.4 });
    const prediction = new Prediction(), queue = new InputQueue();
    prediction.start('me', server.snapshot(true, true));
    const up: { at: number; input: PlayerInput }[] = [], down: { at: number; s: GameSnapshot }[] = [];
    let maxCorrection = 0, blocked = 0;
    try {
      for (let tick = 0; tick < 200; tick++) {
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', lock: true, attack: light(tick) ? 'light' : undefined };
        prediction.submit(input); up.push({ at: tick + LAG, input });
        while (up.length && up[0].at <= tick) queue.push(up.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        server.submitInput('foe', { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI, guard: true });
        server.step(1 / 60, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) { const s = server.snapshot(true, true); blocked += s.events.filter(e => e.kind === 'blocked').length; down.push({ at: tick + LAG, s }); }
        while (down.length && down[0].at <= tick) {
          const before = prediction.diagnostics.position!; prediction.reconcile(down.shift()!.s); const after = prediction.diagnostics.position!;
          maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
        }
      }
      expect(blocked, 'the server blocked the string').toBeGreaterThan(0);
      expect(maxCorrection).toBeLessThan(.001);
    } finally { prediction.stop(); server.dispose(); }
  });
});

describe('the ledger holds what the local copy could not vouch for', () => {
  const hit = (props: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'hit', serverTime: 1, actorId: 'me', targetId: 'them', slot: 'light', actionSeq: 7, contactIndex: 0, ...props });
  it('until the server lands it, and not a blow it could', () => {
    const ledger = new LandedBlows();
    ledger.predict([hit({ id: 5 }), hit({ id: 6, actionSeq: 8, targetId: 'still' })], 'me', 20, undefined, target => target === 'still');
    const moving = ledger.blow('me', 7, 'them', 0)!, still = ledger.blow('me', 8, 'still', 0)!;
    expect([ledger.held(moving), ledger.held(still)]).toEqual([true, false]);
    ledger.authoritative({ serverTime: 1.1, events: [hit({ id: 50, serverTime: 1.05 })], players: [{ id: 'me', ackSeq: 21 }] } as unknown as GameSnapshot, 'me');
    expect(ledger.held(moving), 'landed by the server').toBe(false);
    ledger.predict([hit({ id: 7, actionSeq: 9 })], 'me', 30);
    expect(ledger.held(ledger.blow('me', 9, 'them', 0))).toBe(false);
  });
  it('names the prediction a presented blow answers', () => {
    const ledger = new LandedBlows();
    ledger.predict([hit({ id: 5, slot: 'heavy' })], 'me', 20);
    expect(ledger.predictedOn('them', 'heavy', 0)?.seq).toBe(7);
    expect(ledger.predictedOn('them', 'light', 0)).toBeUndefined();
  });
});

describe('the local fighter taken over by a reaction', () => {
  it.each(['heavy', 'light'] as AttackSlot[])('is drawn without a jump when a remote %s launches or staggers it', slot => {
    const server = new ArenaSimulation({ roomMode: 'training', trainingBot: false });
    server.addPlayer('me', 'vegeta', 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('foe', 'goku', 'Foe', false, { x: 0, y: 0, z: 1.5 });
    LANDED.reset();
    const prediction = new Prediction(), queue = new InputQueue(), timeline = new CombatTimeline({ delayMs: 60 });
    prediction.start('me', server.snapshot(true, true));
    const up: { at: number; input: PlayerInput }[] = [], down: { at: number; s: GameSnapshot }[] = [];
    let last: { x: number; y: number; z: number } | undefined, worst = 0, reacted = false, lift = 0;
    try {
      for (let tick = 0; tick < 150; tick++) {
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI };
        prediction.submit(input); up.push({ at: tick + LAG, input });
        while (up.length && up[0].at <= tick) queue.push(up.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        const strikes = slot === 'heavy' ? tick === 20 : tick >= 20 && tick <= 56 && tick % 9 === 2;
        server.submitInput('foe', { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'me', lock: true, attack: strikes ? slot : undefined });
        server.step(1 / 60, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) down.push({ at: tick + LAG, s: server.snapshot(true, true) });
        while (down.length && down[0].at <= tick) {
          const s = down.shift()!.s; prediction.reconcile(s); timeline.push(s, (tick / 60) * 1000);
          for (const e of s.events ?? []) if (e.kind === 'hit' && e.targetId === 'me' && e.lift) lift = Math.max(lift, e.lift);
        }
        const presented = timeline.sample((tick / 60) * 1000);
        const me = presented?.snapshot.players.find(p => p.id === 'me');
        if (!me) continue;
        const drawn = prediction.sample(1 / 60, me) ?? me;
        if (['launched', 'hurt', 'flinch', 'knockdown'].includes(me.action)) reacted = true;
        if (last) worst = Math.max(worst, Math.hypot(drawn.x - last.x, drawn.y - last.y, drawn.z - last.z));
        last = { x: drawn.x, y: drawn.y, z: drawn.z };
      }
      expect(reacted, 'the blow landed').toBe(true);
      expect(worst, 'the biggest step of the drawn body, metres').toBeLessThan(Math.max(.25, (1 + LAUNCH_LEAD) * lift / 60 + .08));
    } finally { prediction.stop(); server.dispose(); }
  });
});
