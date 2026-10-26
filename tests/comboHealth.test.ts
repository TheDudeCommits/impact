import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Client, FixedTimestepCallback, Room } from 'colyseus';
import { AWAKENING_PER_DAMAGE, COMBO_HP, COMBO_STAMINA, GROUND_HIT_BUDGET, GROUND_HIT_MOST, MAX_HP, MOVES, ULTIMATE_PER_DAMAGE } from '../src/game/moves';
import { ArenaSimulation } from '../src/game/simulation';
import { ArenaRoom, BotArenaRoom, DuelRoom, PrivateArenaRoom } from '../src/server/ArenaRoom';
import { ObjectiveRoom } from '../src/server/objectives/ObjectiveRoom';
import { RULES } from '../src/game/objectives/model';
import { LocalTraining } from '../src/network';
import { LocalRoyale } from '../src/game/LocalRoyale';
import { LocalDuel } from '../src/game/duel/LocalDuel';
import { LocalObjective } from '../src/game/objectives/LocalObjective';
import { SurvivalGame, PLAYER_ID } from '../src/survival/SurvivalGame';
import type { PlayerState } from '../src/game/types';

const TOKEN = '01234567-89ab-cdef-0123-456789abcdef';
afterEach(() => vi.restoreAllMocks());

const bars = (p: PlayerState) => ({ hp: p.hp, maxHp: p.maxHp, stamina: p.stamina, maxStamina: p.maxStamina });
const whole = (hp: number, stamina: number) => ({ hp, maxHp: hp, stamina, maxStamina: stamina });
function combo(players: PlayerState[], where: string) {
  expect(players.length, where).toBeGreaterThan(0);
  for (const p of players) expect(bars(p), `${where}: ${p.id}`).toEqual(whole(COMBO_HP, COMBO_STAMINA));
}

async function room<T extends ArenaRoom | ObjectiveRoom>(made: T, options: object) {
  let tick!: FixedTimestepCallback, frame = 0;
  const base = made as unknown as Room;
  vi.spyOn(base, 'setPrivate').mockResolvedValue(undefined); vi.spyOn(base, 'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(base, 'broadcast').mockImplementation(() => {}); vi.spyOn(base, 'lock').mockResolvedValue(undefined); vi.spyOn(base, 'unlock').mockResolvedValue(undefined);
  vi.spyOn(base, 'setFixedTimestep').mockImplementation((callback: FixedTimestepCallback) => { tick = callback; });
  await (made as unknown as { onCreate(options: unknown): Promise<void> }).onCreate({rosterProtocol:ROSTER_PROTOCOL,...options});
  const advance = (n = 1) => { for (let i = 0; i < n; i++) tick({ dt: 1 / 60, dtMs: 1000 / 60, tick: ++frame, subSteps: 1, subDt: 1 / 60, subDtMs: 1000 / 60 }); };
  const join = (id: string, more: object = {}) => {
    const c = { sessionId: id, send: vi.fn(), leave: vi.fn() } as unknown as Client;
    made.clients.push(c); made.onJoin(c, {rosterProtocol:ROSTER_PROTOCOL, fighter: 'goku', name: id, ...more } as never); return c;
  };
  return { room: made, advance, join };
}

describe('the combo-era health bar', () => {
  it('is half again MAX_HP, beside a stamina bar half again 150', () => {
    expect(COMBO_HP).toBe(MAX_HP * 1.5); expect(COMBO_HP).toBe(1500);
    expect(COMBO_STAMINA).toBe(225);
  });

  it('fills every arena room on the server: training, the public royale, a bot royale, a private room and a duel', async () => {
    const training = await room(new ArenaRoom(), { mode: 'training' });
    try { training.join('me'); combo(training.room.simulation.playerStates(), 'training'); } finally { training.room.onDispose(); }
    const royale = await room(new ArenaRoom(), { mode: 'match' });
    try { royale.join('a'); royale.join('b', { fighter: 'naruto' }); combo(royale.room.simulation.playerStates(), 'royale'); } finally { royale.room.onDispose(); }
    const bots = await room(new BotArenaRoom(), { players: 4 });
    try {
      bots.join('me');
      combo(bots.room.simulation.playerStates(), 'bot royale');
      for (let i = 0; i < 8 * 60 && bots.room.simulation.status === 'waiting'; i++) bots.advance();
      expect(bots.room.simulation.status).toBe('active');
      for (const p of bots.room.simulation.playerStates()) expect([p.hp, p.maxHp, p.maxStamina], `bot royale at the start: ${p.id}`).toEqual([COMBO_HP, COMBO_HP, COMBO_STAMINA]);
    } finally { bots.room.onDispose(); }
    const friends = await room(new PrivateArenaRoom(), { creationToken: TOKEN, players: 4 });
    try { const code = friends.room.snapshot().lobby!.code; friends.join('host', { code }); friends.join('guest', { code, fighter: 'luffy' }); combo(friends.room.simulation.playerStates(), 'private room'); }
    finally { friends.room.onDispose(); }
    const duel = await room(new DuelRoom(), { mode: 'match' });
    try { duel.join('a', { fighter: 'jotaro' }); duel.join('b', { fighter: 'dio' }); combo(duel.room.simulation.playerStates(), 'duel'); } finally { duel.room.onDispose(); }
  });

  it('stands a training fighter back up whole: after a defeat and after the practice reset', async () => {
    const training = await room(new ArenaRoom(), { mode: 'training' });
    try {
      const me = training.join('me'), sim = training.room.simulation;
      sim.damage('sparring-bot', 1e6, 'me', 'test');
      expect(sim.getPlayer('sparring-bot')!.alive).toBe(false);
      for (let i = 0; i < 6 * 60 && !sim.getPlayer('sparring-bot')!.alive; i++) training.advance();
      const back = sim.getPlayer('sparring-bot')!;
      expect([back.alive, back.hp, back.maxHp], 'respawned').toEqual([true, COMBO_HP, COMBO_HP]);
      sim.actors.get('me')!.state.hp = 1; sim.actors.get('me')!.state.stamina = 0;
      expect(sim.trainingCommand(me.sessionId, 'reset')).toBe(true);
      combo(sim.playerStates(), 'reset');
    } finally { training.room.onDispose(); }
  });

  it('fills the browser\'s own training, bot royale and duel, and a duel\'s second round', async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('levi', 'Tester');
      combo(practice.snapshot!.players, 'local training');
      practice.sim!.damage(LocalTraining.PLAYER, 400, 'sparring-bot', 'test');
      expect(practice.sim!.getPlayer(LocalTraining.PLAYER)!.hp).toBe(COMBO_HP - 400);
      practice.room!.send('training', 'reset');
      combo(practice.sim!.playerStates(), 'local training reset');
    } finally { await practice.leave(); }
    const royale = new LocalRoyale();
    try { await royale.connect('naruto', 'You', 6); combo(royale.snapshot!.players, 'local royale'); } finally { await royale.leave(); }
    const duel = new LocalDuel();
    try {
      await duel.connect('jotaro', 'You');
      combo(duel.snapshot!.players, 'local duel');
      let seq = 0;
      while (duel.snapshot!.status !== 'active' && seq < 600) duel.send({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 });
      duel.sim!.damage('duel-bot', 1e6, 'you', 'test');
      while (duel.snapshot!.duel!.round < 2 || duel.snapshot!.status !== 'active') { duel.send({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 }); if (seq > 1200) break; }
      expect(duel.snapshot!.duel!.round).toBe(2);
      combo(duel.snapshot!.players, 'local duel, round 2');
    } finally { await duel.leave(); }
  }, 60_000);

  it('reaches Bad Blood, on the server and in the browser, with the villains\' boost on top of it', async () => {
    const villain = whole(COMBO_HP * RULES.villainMultiplier, COMBO_STAMINA * RULES.villainMultiplier);
    expect(villain).toEqual(whole(1950, 292.5));
    const check = (players: PlayerState[], where: string) => {
      expect(players.filter(p => p.team === 'heroes')).toHaveLength(3); expect(players.filter(p => p.team === 'villains')).toHaveLength(3);
      for (const p of players) expect(bars(p), `${where}: ${p.id} (${p.team})`).toEqual(p.team === 'villains' ? villain : whole(COMBO_HP, COMBO_STAMINA));
    };
    const server = await room(new ObjectiveRoom(), { objective: 'bad-blood', access: 'host', creationToken: TOKEN });
    try {
      server.join('host', { objective: 'bad-blood', code: server.room.roomId.slice('objective-'.length) });
      expect(server.room.game.start()).toBe(true);
      check(server.room.game.sim.playerStates(), 'Bad Blood room');
    } finally { server.room.onDispose(); }
    const local = new LocalObjective();
    try {
      await local.connect('naruto', 'You', 'bad-blood', 'bots');
      check(local.match!.sim.playerStates(), 'local Bad Blood');
      const g = local.match!;
      for (let seq = 1; seq < 200 && g.view.phase !== 'active'; seq++) local.send({ seq, moveX: 0, moveZ: 0, yaw: 0 });
      expect(g.view.phase).toBe('active');
      g.sim.damage(local.id, 1e6, 'test', 'test'); local.send({ seq: 300, moveX: 0, moveZ: 0, yaw: 0 });
      expect(g.sim.getPlayer(local.id)!.alive).toBe(false);
      for (let seq = 301; seq < 301 + 5 * 60 && !g.sim.getPlayer(local.id)!.alive; seq++) local.send({ seq, moveX: 0, moveZ: 0, yaw: 0 });
      expect(g.sim.getPlayer(local.id)!.hp).toBe(COMBO_HP);
    } finally { await local.leave(); }
  }, 60_000);

  it('leaves Last Stand and Arcade survival at MAX_HP and 100 stamina', async () => {
    const old = whole(MAX_HP, 100);
    const server = await room(new ObjectiveRoom(), { objective: 'last-stand', access: 'host', creationToken: TOKEN });
    try {
      server.join('host', { objective: 'last-stand', code: server.room.roomId.slice('objective-'.length) });
      expect(bars(server.room.game.sim.getPlayer('host')!), 'Last Stand room').toEqual(old);
    } finally { server.room.onDispose(); }
    const local = new LocalObjective();
    try { await local.connect('naruto', 'You', 'last-stand', 'solo'); expect(bars(local.match!.sim.getPlayer(local.id)!), 'local Last Stand').toEqual(old); }
    finally { await local.leave(); }
    const run = new SurvivalGame({ fighter: 'zoro', seed: 5, quiet: true });
    try { expect(bars(run.sim.getPlayer(PLAYER_ID)!), 'Arcade survival').toEqual(old); } finally { run.sim.dispose(); }
    const plain = new ArenaSimulation({ roomMode: 'training', trainingBot: false });
    try { plain.addPlayer('a', 'goku', 'A'); expect(bars(plain.getPlayer('a')!)).toEqual(old); } finally { plain.dispose(); }
  }, 60_000);

  it('caps a stay on the floor at GROUND_HIT_BUDGET of the body\'s own bar, not of MAX_HP', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5, maxStamina: COMBO_STAMINA, maxHp: COMBO_HP });
    try {
      sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: 0 }); sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 1.5 });
      const b = sim.actors.get('b')!;
      b.reaction = 'knockdown'; b.stunUntil = sim.serverTime + 1.2; b.floorUntil = b.stunUntil + GROUND_HIT_MOST; b.floorHits = b.floorTaken = 0;
      b.state.action = 'knockdown'; b.state.actionStarted = sim.serverTime; b.state.actionDuration = 1.2;
      for (let i = 0; i < 30; i++) sim.strike('a', 'b', 'heavy', MOVES.zoro.heavy);
      expect(b.floorTaken).toBe(Math.round(GROUND_HIT_BUDGET * COMBO_HP));
      expect(b.state.hp).toBe(COMBO_HP - Math.round(GROUND_HIT_BUDGET * COMBO_HP));
    } finally { sim.dispose(); }
  });

  it('keeps the meters per point of damage: an ultimate after as many blows as before', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5, maxStamina: COMBO_STAMINA, maxHp: COMBO_HP });
    try {
      sim.addPlayer('a', 'zoro', 'A', false, { x: 0, y: 0, z: 0 }); sim.addPlayer('b', 'naruto', 'B', false, { x: 0, y: 0, z: 1.2 });
      sim.strike('a', 'b', 'light', MOVES.zoro.light);
      const hit = sim.drainEvents().find(e => e.kind === 'hit' && e.targetId === 'b')!;
      expect(hit.damage).toBeGreaterThan(0);
      expect(sim.getPlayer('a')!.ultimate).toBeCloseTo(hit.damage! * ULTIMATE_PER_DAMAGE, 6);
      expect(sim.getPlayer('b')!.awakening).toBeCloseTo(hit.damage! * AWAKENING_PER_DAMAGE, 6);
    } finally { sim.dispose(); }
  });
});
