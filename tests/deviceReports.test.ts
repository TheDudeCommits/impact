import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalRoyale } from '../src/game/LocalRoyale';
import { LocalDuel } from '../src/game/duel/LocalDuel';
import { LocalObjective } from '../src/game/objectives/LocalObjective';
import { objectiveOf } from '../src/game/objectives/model';
import { LocalArena } from '../src/survival/LocalArena';
import type { RunResult } from '../src/survival/SurvivalGame';
import { DEVICE_MODES, DeviceRun, deviceReports, deviceRunReport, isDeviceId } from '../src/game/economy/device';
import { plausible, type MatchReport, type Report, type SurvivalReport } from '../src/game/economy/earn';

vi.mock('../src/game/rapierCollision', () => ({ createRapierCollision: vi.fn(async () => undefined) }));
const sent: Report[] = [];
let begun = 0;
beforeEach(() => { sent.length = 0; begun = 0; deviceReports.send = report => { sent.push(report); }; deviceReports.begin = () => { begun++; }; });
afterEach(() => { vi.unstubAllGlobals(); });
afterAll(() => { deviceReports.send = () => {}; deviceReports.begin = () => {}; });
function valid(report: Report) {
  expect(isDeviceId(report.id)).toBe(true); expect(report.id).toMatch(/^local-[0-9a-f]{32}$/); expect(DEVICE_MODES).toContain(report.mode);
  const checked = plausible(report, false);
  if ('refused' in checked) throw new Error(checked.refused);
  expect(checked.report).toMatchObject(Object.fromEntries(Object.entries(report).filter(([, value]) => value !== undefined)));
}

describe('on-device reports', () => {
  it('the royale against bots: once, at the human\'s knockout, with their place - and nothing for a match not played', async () => {
    for (const played of [true, false]) {
      sent.length = 0;
      const local = new LocalRoyale(); try {
        await local.connect('naruto', 'You', 6);
        let seq = 0; const step = (moveX = 0) => local.send({ seq: ++seq, moveX, moveZ: 0, yaw: 0 });
        for (let i = 0; i < 190; i++) step();
        expect(local.snapshot!.status).toBe('active'); expect(begun).toBeGreaterThan(0);
        if (played) step(1);
        local.sim!.serverTime += 61; local.sim!.damage('bot-1', 1e6, played ? 'you' : 'bot-3', 'KO'); step();
        expect(sent).toHaveLength(0);
        local.sim!.damage('you', 1e6, 'bot-2', 'KO'); step();
        for (let i = 0; i < 60; i++) step();
        if (!played) { expect(sent).toHaveLength(0); continue; }
        expect(sent).toHaveLength(1);
        const report = sent[0] as MatchReport;
        expect(report).toMatchObject({ mode: 'bots', practice: true, fighter: 'naruto', players: 6, place: 5, kos: 1 });
        expect(report.seconds).toBeGreaterThanOrEqual(61); valid(report);
      } finally { await local.leave(); }
    }
  }, 60000);

  it('the royale won: first place at the end', async () => {
    const local = new LocalRoyale(); try {
      await local.connect('goku', 'You', 4);
      let seq = 0; const step = (moveX = 0) => local.send({ seq: ++seq, moveX, moveZ: 0, yaw: 0 });
      for (let i = 0; i < 190; i++) step();
      step(1); local.sim!.serverTime += 90;
      for (const p of local.snapshot!.players) if (p.isBot) local.sim!.damage(p.id, 1e6, 'you', 'KO');
      step(); expect(local.snapshot!.winnerId).toBe('you');
      expect(sent).toHaveLength(1); expect(sent[0]).toMatchObject({ mode: 'bots', place: 1, players: 4, kos: 3 }); valid(sent[0]);
    } finally { await local.leave(); }
  }, 60000);

  it('the duel against a bot: once per completed set, the runback a set of its own', async () => {
    const duel = new LocalDuel(); try {
      await duel.connect('jotaro', 'You');
      let seq = 0; const step = (moveX = 0) => duel.send({ seq: ++seq, moveX, moveZ: 0, yaw: 0 });
      const set = () => {
        for (let i = 0; i < 185; i++) step();
        expect(duel.snapshot!.status).toBe('active'); step(1);
        duel.sim!.serverTime += 40; duel.sim!.damage('duel-bot', 1e6, 'you', 'KO'); step();
        expect(duel.snapshot!.status).toBe('waiting');
        for (let i = 0; i < 185; i++) step();
        duel.sim!.serverTime += 40; duel.sim!.damage('duel-bot', 1e6, 'you', 'KO'); step();
        expect(duel.snapshot!.duel?.phase).toBe('complete');
      };
      set(); for (let i = 0; i < 120; i++) step();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ mode: 'duel', practice: true, fighter: 'jotaro', place: 1, players: 2, kos: 2, rounds: 2 }); valid(sent[0]);
      duel.room!.send('duel-runback'); for (let i = 0; i < 125; i++) step();
      expect(duel.snapshot!.duel?.set).toBe(2); expect(sent).toHaveLength(1);
      set();
      expect(sent).toHaveLength(2); expect(sent[1].id).not.toBe(sent[0].id); valid(sent[1]);
    } finally { await duel.leave(); }
  }, 60000);

  it.each(['last-stand', 'bad-blood'] as const)('%s with bots: once, when the operation is over', async kind => {
    const room = new LocalObjective(); try {
      await room.connect('naruto', 'You', kind, 'bots');
      let seq = 0; const step = (moveX = 0) => room.send({ seq: ++seq, moveX, moveZ: 0, yaw: 0 });
      for (let i = 0; i < 200; i++) step();
      expect(objectiveOf(room.snapshot)?.phase).toBe('active'); step(1);
      const match = room.match!, view = objectiveOf(room.snapshot)!;
      match.sim.serverTime += 75;
      const own = view.seats.find(s => s.id === room.id)!.team;
      for (const seat of view.seats) if (kind === 'last-stand' || seat.team !== own) match.sim.damage(seat.id, 1e6, kind === 'last-stand' ? 'qa' : room.id, 'Out');
      for (let i = 0; i < 30 && objectiveOf(room.snapshot)?.phase !== 'over'; i++) step();
      expect(objectiveOf(room.snapshot)?.phase).toBe('over');
      for (let i = 0; i < 30; i++) step();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ mode: kind, practice: true, fighter: 'naruto', players: view.seats.length, place: kind === 'bad-blood' ? 1 : 2 });
      expect(sent[0].seconds).toBeGreaterThanOrEqual(75); valid(sent[0]);
    } finally { await room.leave(); }
  }, 60000);

  it('a solo run: alone, its result as the server\'s RoomRewards reads one; nothing for a probe or a run started with a test flag', () => {
    const result: RunResult = { fighter: 'zoro', round: 14, wave: 14, rank: 'A', act: 4, score: 1234567.4, kills: 900, ownKills: 880, seconds: 1100.6, level: 12, bestRank: 4, bestCombo: 40,
      damageDealt: 90000, damageTaken: 9000, bosses: 14, picks: [], finishers: 5, party: 1,
      bossLog: [{ id: 'a', name: 'A', rank: 'S', finished: true, seconds: 41 }, { id: 'b', name: 'B', rank: 'C', finished: false, seconds: 18.5 }] };
    const report = deviceRunReport(result)!;
    expect(report).toMatchObject({ mode: 'survival', coop: false, fighter: 'zoro', seconds: 1100, round: 14, rank: 5, bosses: 14, finishers: 5, sealed: false, score: 1234567, kills: 880, style: 4, sBosses: 1, fastBoss: 18.5 });
    valid(report);
    expect(deviceRunReport({ ...result, probe: true })).toBeUndefined();
    const runs: SurvivalReport[] = [], run = new DeviceRun(r => { runs.push(r); });
    run.observe('intro', () => undefined); run.input({ seq: 1, moveX: 1, moveZ: 0, yaw: 0 }); run.observe('fight', () => undefined);
    expect(run.observe('over', () => result)).toMatchObject({ mode: 'survival' }); run.observe('over', () => result);
    expect(runs).toHaveLength(1);
    const idle = new DeviceRun(r => { runs.push(r); }); idle.observe('intro', () => undefined); idle.observe('over', () => result);
    vi.stubGlobal('location', { search: '?autopilot' });
    const pilot = new DeviceRun(r => { runs.push(r); }); pilot.observe('intro', () => undefined); pilot.input({ seq: 1, moveX: 1, moveZ: 0, yaw: 0 }); pilot.observe('over', () => result);
    expect(runs).toHaveLength(1);
  });

  it('LocalArena reports its run when it ends', async () => {
    const arena = new LocalArena(); arena.prepare = vi.fn(async () => {});
    try {
      await arena.connect('naruto', 'match', 'Tester', { seed: 4711 });
      let seq = 0; const step = (moveX = 0) => arena.send({ seq: ++seq, moveX, moveZ: 0, yaw: 0 });
      for (let i = 0; i < 30; i++) step(1);
      expect(begun).toBe(1);
      const game = arena.game!;
      for (const hero of game.heroes.values()) { hero.stats.revives = 0; game.sim.damage(hero.id, 1e6, hero.id, 'Test'); }
      for (let i = 0; i < 3000 && game.phase !== 'over'; i++) step();
      expect(game.phase).toBe('over');
      for (let i = 0; i < 30; i++) step();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ mode: 'survival', coop: false, fighter: 'naruto' });
      expect(plausible(sent[0], false)).toEqual({ refused: 'A run that short earns nothing.' });
    } finally { await arena.leave(); }
  }, 60000);
});
