import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import type { CombatEvent, GameSnapshot, PlayerState } from '../src/game/types';
import { CombatTimeline } from '../src/render/CombatTimeline';

function player(id = 'a', changes: Partial<PlayerState> = {}): PlayerState {
  return { id, name: id, fighter: 'goku', x: 0, y: 0, z: 0, yaw: 0,
    hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0, alive: true, isBot: false,
    action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null,
    guarding: false, grounded: true, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...changes };
}
function snapshot(time: number, players = [player()], events: CombatEvent[] = []): GameSnapshot {
  return { serverTime: time, tick: Math.round(time * 60), players, events, roomMode: 'match', stage: 'harbor',
    status: 'active', winnerId: null };
}
const hit = (id: number, serverTime: number): CombatEvent => ({ id, serverTime, kind: 'hit', actorId: 'a', targetId: 'b', slot: 'light', damage: 36 });

describe('shared buffered combat timeline', () => {
  it('meets an authoritative landing between snapshots and stays grounded after its one-shot event',()=>{
    const timeline=new CombatTimeline();
    const victim=player('b',{action:'hurt',actionStarted:.5,actionDuration:1.1,grounded:false,y:.2,z:3});
    timeline.push(snapshot(1,[victim]),1000);
    const landing:CombatEvent={id:1,kind:'land',actorId:'b',slot:'ultimate',serverTime:1.016,origin:{x:0,y:.025,z:3.1}};
    timeline.push(snapshot(1.05,[{...victim,y:0,z:3.2,grounded:true}],[landing]),1050);
    const before=timeline.sample(1075)!;expect(before.snapshot.players[0].grounded).toBe(false);expect(before.events).toHaveLength(0);
    const contact=timeline.sample(1076)!;expect(contact.events).toHaveLength(1);
    expect(contact.snapshot.players[0]).toMatchObject({grounded:true});
    expect(contact.snapshot.players[0].y).toBeCloseTo(.025,8);expect(contact.snapshot.players[0].z).toBeCloseTo(3.1,8);
    const settled=timeline.sample(1085)!;expect(settled.events).toHaveLength(0);
    expect(settled.snapshot.players[0].grounded).toBe(true);expect(settled.snapshot.players[0].y).toBeLessThan(.025);
  });
  it('crosses a real simulated contact with its attack pose and hit event together under variable arrivals', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false });
    sim.addPlayer('a', 'goku', 'Attacker', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'naruto', 'Victim', false, { x: 0, y: 0, z: 1.2 });
    const packets = [sim.snapshot(true)];
    sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'light' });
    for (let step = 1; step <= 18; step++) { sim.step(); if (step % 3 === 0) packets.push(sim.snapshot(true)); }
    const contact = packets.flatMap(p => p.events).find(e => e.kind === 'hit')!;
    const cast = packets.flatMap(p => p.events).find(e => e.kind === 'cast')!;
    expect(contact).toBeDefined();
    const timeline = new CombatTimeline(), arrivals = [1000, 1054, 1097, 1159, 1208, 1252, 1304];
    let packet = 0, lastTime = -Infinity, crossed = false, hitCount = 0;
    for (let now = 1000; now <= 1370; now++) {
      while (packet < packets.length && now >= arrivals[packet]) { timeline.push(packets[packet], arrivals[packet]); packet++; }
      const frame = timeline.sample(now)!;
      expect(frame.time).toBeGreaterThanOrEqual(lastTime);
      const impacts = frame.events.filter(e => e.kind === 'hit'); hitCount += impacts.length;
      if (!crossed && frame.time >= contact.serverTime - 1e-9) {
        expect(lastTime).toBeLessThan(contact.serverTime);
        expect(impacts.map(e => e.id)).toEqual([contact.id]);
        const attacker = frame.snapshot.players.find(p => p.id === 'a')!;
        expect(attacker.action).toBe('light');
        expect(attacker.actionStarted).toBeGreaterThanOrEqual(cast.serverTime);
        expect(attacker.actionTime * attacker.actionDuration)
          .toBeCloseTo(frame.time - attacker.actionStarted, 10);
        expect(attacker.actionTime * attacker.actionDuration).toBeGreaterThanOrEqual(MOVES.goku.light.contacts[0]);
        crossed = true;
      } else expect(impacts).toHaveLength(0);
      lastTime = frame.time;
    }
    expect(crossed).toBe(true); expect(hitCount).toBe(1); sim.dispose();
  });

  it('puts the impact freeze where it landed, whatever tick the broadcast fell on', () => {
    const FRAME = 1 / 60;
    const runs = [0, 1, 2, 3, 4, 5].map(phase => {
      const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false });
      sim.addPlayer('a', 'goku', 'Attacker', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'naruto', 'Victim', false, { x: 0, y: 0, z: 1.2 });
      const packets: { snapshot: GameSnapshot; atMs: number }[] = [];
      const broadcast = () => packets.push({ snapshot: sim.snapshot(true), atMs: Math.round(sim.serverTime * 1000) });
      broadcast();
      for (let tick = 1; tick <= 60 + phase; tick++) {
        if (tick === phase + 1) sim.submitInput('a', { seq: 1, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: 'light' });
        sim.step();
        if (tick % 3 === 0) broadcast();
      }
      const contact = packets.flatMap(p => p.snapshot.events).find(e => e.kind === 'hit')!;
      expect(contact).toBeDefined();
      const timeline = new CombatTimeline();
      let sent = 0;
      const frozen: number[] = [];
      for (let nowMs = 0; nowMs <= 1100; nowMs += 1000 * FRAME) {
        while (sent < packets.length && nowMs >= packets[sent].atMs) { timeline.push(packets[sent].snapshot, packets[sent].atMs); sent++; }
        const sample = timeline.sample(nowMs)?.snapshot.players.find(p => p.id === 'b');
        if (sample?.hitstop) frozen.push(timeline.sample(nowMs)!.time);
      }
      const victim = packets.at(-1)!.snapshot.players.find(p => p.id === 'b')!;
      return { contact, frozen, window: victim.hitstopUntil! - victim.hitstopFrom!, sim };
    });
    const windows = runs.map(r => r.window);
    for (const run of runs) {
      expect(run.frozen.length, 'the freeze is rendered at all').toBeGreaterThan(0);
      expect(run.frozen[0] - run.contact.serverTime, 'and it starts when the blow landed')
        .toBeLessThan(FRAME + 1e-9);
      expect(run.frozen[0]).toBeGreaterThanOrEqual(run.contact.serverTime);
      expect(run.window, 'the same blow weighs the same however it was broadcast').toBeCloseTo(windows[0], 10);
      run.sim.dispose();
    }
    const counts = runs.map(r => r.frozen.length);
    expect(Math.max(...counts) - Math.min(...counts), 'and lasts the same number of frames').toBeLessThanOrEqual(1);
  });

  it('keeps the visual clock moving at real speed through jittery arrivals', () => {
    const timeline = new CombatTimeline();
    const arrivals = [1000, 1054, 1097, 1159, 1208, 1252, 1304];
    const packets = arrivals.map((_, k) => snapshot(1 + .05 * k, [player('a', { x: k })]));
    let sent = 0, last: number | null = null;
    const advances: number[] = [];
    for (let nowMs = 1000; nowMs <= 1320; nowMs += 1000 / 60) {
      while (sent < packets.length && nowMs >= arrivals[sent]) { timeline.push(packets[sent], arrivals[sent]); sent++; }
      const frame = timeline.sample(nowMs)!;
      if (last !== null && nowMs > 1080) advances.push(frame.time - last);
      last = frame.time;
    }
    expect(advances.length).toBeGreaterThan(10);
    expect(Math.min(...advances), 'no stall').toBeGreaterThan(.7 / 60);
    expect(Math.max(...advances), 'and no catch-up sprint').toBeLessThan(1.3 / 60);
  });

  it('switches repeated hurt and same-slot casts at their new timestamps, never on early packet receipt', () => {
    const timeline = new CombatTimeline();
    timeline.push(snapshot(1, [player('b', { action: 'hurt', actionStarted: .9, actionDuration: .4 })]), 1000);
    timeline.push(snapshot(1.05, [player('b', { action: 'hurt', actionStarted: 1.025, actionDuration: .3 })], [hit(1, 1.025)]), 1050);
    expect(timeline.sample(1084)!.snapshot.players[0].actionStarted).toBe(.9);
    const repeated = timeline.sample(1085)!;
    expect(repeated.snapshot.players[0].actionStarted).toBe(1.025);
    expect(repeated.snapshot.players[0].actionTime).toBeCloseTo(0);
    expect(repeated.events.map(e => e.id)).toEqual([1]);
    timeline.reset();
    timeline.push(snapshot(2, [player('a', { action: 'special', actionStarted: .5, actionDuration: 1.65 })]), 2000);
    timeline.push(snapshot(2.05, [player('a', { action: 'special', actionStarted: 2.025, actionDuration: 1.65 })]), 2050);
    expect(timeline.sample(2084)!.snapshot.players[0].actionStarted).toBe(.5);
    expect(timeline.sample(2086)!.snapshot.players[0].actionStarted).toBe(2.025);
  });

  it('sorts and deduplicates repeated contacts, and admits a late unseen event once without rewinding', () => {
    const timeline = new CombatTimeline();
    timeline.push(snapshot(1), 1000);
    timeline.push(snapshot(1.05, [player()], [hit(3, 1.04), hit(1, 1.01), hit(2, 1.02)]), 1050);
    timeline.push(snapshot(1.05, [player()], [hit(1, 1.01), hit(2, 1.02)]), 1060);
    expect(timeline.sample(1075)!.events.map(e => e.id)).toEqual([1]);
    expect(timeline.sample(1085)!.events.map(e => e.id)).toEqual([2]);
    const latest = timeline.sample(1120)!;
    expect(latest.events.map(e => e.id)).toEqual([3]);
    timeline.push(snapshot(1.03, [player()], [hit(2, 1.02), hit(4, 1.025)]), 1130);
    const late = timeline.sample(1130)!;
    expect(late.time).toBe(latest.time); expect(late.events.map(e => e.id)).toEqual([4]);
    expect(timeline.sample(1131)!.events).toHaveLength(0);
  });

  it('uses the same floating-point boundary for a hit event and its newly started hurt pose', () => {
    const timeline = new CombatTimeline();
    timeline.push(snapshot(1, [player('b')]), 1000);
    timeline.push(snapshot(1.05, [player('b', { action: 'hurt', actionStarted: 1.025, actionDuration: .3 })], [hit(1, 1.025)]), 1050);
    const frame = timeline.sample(1085 - 1e-7)!;
    expect(frame.events.map(e => e.id)).toEqual([1]);
    expect(frame.snapshot.players[0].action).toBe('hurt');
    expect(frame.snapshot.players[0].actionTime).toBe(0);
  });

  it('interpolates position and shortest yaw, owns its data, and freezes at the last confirmed snapshot on a drop', () => {
    const timeline = new CombatTimeline();
    const old = snapshot(1, [player('a', { x: 0, yaw: 179 * Math.PI / 180 })]);
    const next = snapshot(1.05, [player('a', { x: 2, y: 1, z: 4, yaw: -179 * Math.PI / 180 })]);
    timeline.push(old, 1000); timeline.push(next, 1050);
    next.players[0].x = 999;
    const middle = timeline.sample(1085)!;
    expect(middle.snapshot.players[0].x).toBeCloseTo(1);
    expect(middle.snapshot.players[0].y).toBeCloseTo(.5);
    expect(middle.snapshot.players[0].z).toBeCloseTo(2);
    expect(Math.abs(middle.snapshot.players[0].yaw)).toBeCloseTo(Math.PI);
    middle.snapshot.players[0].cooldowns.light = 999;
    expect(timeline.sample(1085)!.snapshot.players[0].cooldowns.light).toBe(0);
    const frozen = timeline.sample(9000)!;
    expect(frozen.time).toBe(1.05); expect(frozen.snapshot.players[0].x).toBe(2);
  });

  it('keeps joins, departures and finished membership at snapshot boundaries without resurrecting removed actors', () => {
    const timeline = new CombatTimeline();
    timeline.push(snapshot(1, [player('a'), player('b')]), 1000);
    const terminal = snapshot(1.05, [player('b'), player('c')], [{ id: 1, kind: 'winner', serverTime: 1.05, actorId: 'b' }]);
    terminal.status = 'finished'; terminal.winnerId = 'b'; timeline.push(terminal, 1050);
    expect(timeline.sample(1085)!.snapshot.players.map(p => p.id)).toEqual(['a', 'b']);
    const finished = timeline.sample(1111)!;
    expect(finished.snapshot.players.map(p => p.id)).toEqual(['b', 'c']);
    expect(finished.snapshot.status).toBe('finished'); expect(finished.events[0].kind).toBe('winner');
    timeline.push(snapshot(1.025, [player('a'), player('b')]), 1120);
    expect(timeline.sample(1120)!.snapshot.players.map(p => p.id)).toEqual(['b', 'c']);
  });

  it('uses an honest first baseline and clears room history and event IDs on reset', () => {
    const timeline = new CombatTimeline();
    expect(timeline.sample(0)).toBeNull();
    timeline.push(snapshot(30, [player()], [hit(1, 29.99)]), 100);
    const first = timeline.sample(100)!;
    expect(first.time).toBe(30); expect(first.events.map(e => e.id)).toEqual([1]);
    expect(timeline.sample(101)!.events).toHaveLength(0);
    timeline.push(snapshot(30.05, [player()], [hit(2, 30.05)]), 150);
    timeline.reset(); expect(timeline.sample(160)).toBeNull();
    timeline.push(snapshot(0, [player('new')], [hit(1, 0)]), 200);
    const fresh = timeline.sample(200)!;
    expect(fresh.time).toBe(0); expect(fresh.snapshot.players[0].id).toBe('new');
    expect(fresh.events.map(e => e.id)).toEqual([1]);
  });
});
