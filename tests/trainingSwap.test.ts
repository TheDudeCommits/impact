import { beforeEach, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { BODY_SIZE, MOVES } from '../src/game/moves';
import { HELD } from '../src/game/economy/fighters';
import { RELEASED_FIGHTERS, isReleasedFighter } from '../src/game/rosterAvailability';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';
import { LocalTraining } from '../src/network';
import { ForgeSession } from '../src/engine/client/forgeSession';
import * as Studio from '../src/engine/client/forgeStudio';
import { modePrefs, saveModePrefs, trainingRival } from '../src/ui/modes/prefs';
import { trialsFor } from '../src/ui/hud/trainingTrials';
import { SWAP_LAB, SWAP_LAPSE_MS, SwapLedger, randomFighter, stepFighter, swapMemory, swapRoster, swapSideOf } from '../src/ui/hud/trainingSwap';
import { hintsHtml, swapOrder } from '../src/ui/hud/TrainingSwapPicker';
import { HOME_VOLUMES } from '../src/ui/MangaHome';
import { readFileSync } from 'node:fs';
import { ObjectiveMatch } from '../src/game/objectives/ObjectiveMatch';
import { objectiveOf } from '../src/game/objectives/model';

type Room = ReturnType<typeof room>;
function room(self: FighterId = 'naruto', seed = 7) {
  const sim = new ArenaSimulation({ roomMode: 'training', seed });
  sim.addPlayer('you', self, 'You'); sim.trainingCommand('you', 'passive');
  let seq = 0;
  const events: CombatEvent[] = [];
  const tick = (input: Partial<PlayerInput> = {}) => {
    sim.submitInput('you', { seq: ++seq, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'sparring-bot', lock: true, ...input });
    sim.step();
    const made = sim.drainEvents(); events.push(...made);
    return made;
  };
  const run = (ticks: number, input: Partial<PlayerInput> = {}) => { for (let i = 0; i < ticks; i++) tick(input); };
  const lab = (name: string, value?: unknown) => sim.trainingCommand('you', { lab: name, value });
  const you = () => sim.getPlayer('you')!, bot = () => sim.getPlayer('sparring-bot')!;
  const inside = sim as unknown as { projectiles: unknown[]; areas: unknown[]; actors: Map<string, { cast: unknown; state: Record<string, unknown> }> };
  return { sim, tick, run, lab, you, bot, events, inside };
}
const facing = (from: { x: number; z: number }, to: { x: number; z: number }) => Math.atan2(to.x - from.x, to.z - from.z);
const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe("Training's switch: the room's rule", () => {
  it('changes the player where they stand: nobody moves, everyone is as RESET leaves them, each faces the other', () => {
    const r = room('naruto'); try {
      r.run(40, { moveX: 1 }); r.run(10);
      r.sim.damage('you', 120, 'sparring-bot', 'test'); r.sim.damage('sparring-bot', 200, 'you', 'test');
      r.sim.trainingCommand('you', 'awakening');
      const at = { you: { x: r.you().x, z: r.you().z }, bot: { x: r.bot().x, z: r.bot().z } }, dummy = r.bot().fighter;
      expect(Math.hypot(at.you.x, at.you.z - 3)).toBeGreaterThan(1);
      expect(r.you().hp).toBeLessThan(r.you().maxHp); expect(r.you().ultimate).toBe(100); expect(r.bot().damageTaken).toBeGreaterThan(0);

      expect(r.lab('swap-self', 'gojo')).toBe(true);
      const you = r.you(), bot = r.bot();
      expect(you.fighter).toBe('gojo'); expect(bot.fighter).toBe(dummy);
      expect(you.id).toBe('you'); expect(you.target).toBe('sparring-bot');
      expect(you.x).toBeCloseTo(at.you.x, 6); expect(you.z).toBeCloseTo(at.you.z, 6);
      expect(bot.x).toBeCloseTo(at.bot.x, 6); expect(bot.z).toBeCloseTo(at.bot.z, 6);
      for (const p of [you, bot]) {
        expect(p.hp).toBe(p.maxHp); expect(p.stamina).toBe(p.maxStamina); expect(p.ultimate).toBe(0); expect(p.awakening).toBe(0);
        expect(p.alive).toBe(true); expect(p.action).toBe('idle'); expect(p.guarding).toBe(false); expect(!!p.awakened).toBe(false);
        expect(p.damageDealt).toBe(0); expect(p.damageTaken).toBe(0);
        for (const slot of ['light', 'heavy', 'special', 'ultimate'] as const) expect(p.cooldowns[slot]).toBe(0);
      }
      expect(turn(you.yaw, facing(you, bot))).toBeLessThan(1e-6);
      expect(turn(bot.yaw, facing(bot, you))).toBeLessThan(1e-6);
      const respawns = r.sim.drainEvents().filter(e => e.kind === 'respawn');
      expect(respawns.map(e => e.actorId).sort()).toEqual(['sparring-bot', 'you']);
      const mine = respawns.find(e => e.actorId === 'you')!;
      expect(mine.origin!.x).toBeCloseTo(at.you.x, 6); expect(mine.origin!.z).toBeCloseTo(at.you.z, 6);
      r.sim.damage('sparring-bot', 50, 'you', 'test');
      expect(r.bot().hp).toBe(r.bot().maxHp - 50);
    } finally { r.sim.dispose(); }
  });

  it('changes the opponent where it stands, and keeps the behaviour the player had set for it', () => {
    const r = room('goku'); try {
      r.lab('behaviour', 'guard'); r.lab('speed', .5);
      r.run(60, { moveX: -1 });
      r.sim.trainingCommand('you', 'awakening');
      const at = { x: r.you().x, z: r.you().z }, dummy = { x: r.bot().x, z: r.bot().z };
      expect(r.lab('swap-opponent', 'zoro')).toBe(true);
      expect(r.bot().fighter).toBe('zoro'); expect(r.you().fighter).toBe('goku');
      expect(r.bot().x).toBeCloseTo(dummy.x, 6); expect(r.bot().z).toBeCloseTo(dummy.z, 6);
      expect(r.you().x).toBeCloseTo(at.x, 6); expect(r.you().z).toBeCloseTo(at.z, 6);
      expect(r.you().ultimate).toBe(0); expect(r.you().awakening).toBe(0);
      expect(r.sim.trainingLab.view()).toMatchObject({ behaviour: 'guard', speed: .5, frozen: false });
      expect(r.sim.snapshot().trainingBotMode).toBe('passive');
      r.run(12);
      expect(r.bot().guarding).toBe(true);
      r.sim.trainingCommand('you', 'awakening');
      expect(r.you().ultimate).toBe(100);
    } finally { r.sim.dispose(); }
  });

  it('keeps a dummy that fights back fighting back, and one that blocks after a hit waiting for the next hit', () => {
    const r = room('ichigo'); try {
      r.sim.trainingCommand('you', 'combat');
      expect(r.lab('swap-self', 'luffy')).toBe(true);
      expect(r.sim.snapshot().trainingBotMode).toBe('combat'); expect(r.sim.trainingLab.view().behaviour).toBe('combat');
      r.lab('behaviour', 'after-hit');
      r.sim.damage('sparring-bot', 30, 'you', 'test'); r.run(30);
      expect(r.bot().guarding).toBe(true);
      expect(r.lab('swap-opponent', 'sanji')).toBe(true);
      r.run(30); expect(r.bot().guarding).toBe(false);
      r.sim.damage('sparring-bot', 30, 'you', 'test'); r.run(30);
      expect(r.bot().guarding).toBe(true);
    } finally { r.sim.dispose(); }
  });

  it('takes the body size with the body', () => {
    const big = (Object.keys(BODY_SIZE) as FighterId[]).find(id => isReleasedFighter(id))!;
    const r = room('naruto'); try {
      expect(r.you().size).toBeUndefined();
      expect(r.lab('swap-self', big)).toBe(true); expect(r.you().size).toBe(BODY_SIZE[big]);
      expect(r.lab('swap-self', 'naruto')).toBe(true); expect(r.you().size).toBeUndefined(); expect('size' in r.you()).toBe(false);
      expect(r.lab('swap-opponent', big)).toBe(true); expect(r.bot().size).toBe(BODY_SIZE[big]);
    } finally { r.sim.dispose(); }
  });

  it('ends a move in the air: the shot the old body threw never lands', () => {
    const control = room('naruto'); let released = -1, landed = -1;
    try {
      for (let i = 1; i <= 140; i++) for (const e of control.tick({ attack: i === 5 ? 'special' : undefined })) {
        if (e.actorId !== 'you') continue;
        if (e.kind === 'release' && released < 0) released = i;
        if (e.kind === 'hit' && landed < 0) landed = i;
      }
      expect(released).toBeGreaterThan(5); expect(landed).toBeGreaterThan(released + 4);
      expect(control.bot().hp).toBeLessThan(control.bot().maxHp);
    } finally { control.sim.dispose(); }

    const r = room('naruto'); try {
      for (let i = 1; i <= released + 2; i++) r.tick({ attack: i === 5 ? 'special' : undefined });
      expect(r.inside.projectiles.length).toBeGreaterThan(0);
      expect(r.you().cooldowns.special).toBeGreaterThan(0);
      r.events.length = 0;
      expect(r.lab('swap-self', 'sasuke')).toBe(true);
      expect(r.inside.projectiles).toHaveLength(0); expect(r.inside.actors.get('you')!.cast).toBeNull();
      expect(r.you().action).toBe('idle'); expect(r.you().cooldowns.special).toBe(0);
      r.run(landed + 60);
      expect(r.events.filter(e => e.kind === 'hit' || e.kind === 'blocked')).toHaveLength(0);
      expect(r.bot().hp).toBe(r.bot().maxHp); expect(r.you().damageDealt).toBe(0);
      r.events.length = 0; r.tick({ attack: 'special' });
      const cast = r.events.find(e => e.kind === 'cast' && e.actorId === 'you');
      expect(cast?.fighter).toBe('sasuke'); expect(cast?.move).toBe(MOVES.sasuke.special.name);
    } finally { r.sim.dispose(); }
  });

  it('ends a wind-up and an area circle too, the opponent\'s as well as the player\'s', () => {
    const r = room('goku'); try {
      r.tick({ attack: 'heavy' }); r.run(4);
      expect(r.inside.actors.get('you')!.cast).not.toBeNull();
      expect(r.lab('swap-opponent', 'vegeta')).toBe(true);
      expect(r.inside.actors.get('you')!.cast).toBeNull(); expect(r.you().action).toBe('idle');
      r.tick({ attack: 'area', aim: { x: 0, z: 0 } }); r.run(34);
      expect(r.inside.areas.length).toBeGreaterThan(0);
      expect(r.lab('swap-self', 'gohan-beast')).toBe(true);
      expect(r.inside.areas).toHaveLength(0);
      r.events.length = 0; r.run(240);
      expect(r.events.filter(e => e.kind === 'hit')).toHaveLength(0);
      expect(r.bot().hp).toBe(r.bot().maxHp);
    } finally { r.sim.dispose(); }
  });

  it('ends an awakening: the form does not come with the player to the next body', () => {
    const r = room('naruto'); try {
      r.sim.trainingCommand('you', 'awakening');
      r.tick({ awaken: true });
      for (let i = 0; i < 240 && !r.you().awakened; i++) r.tick();
      expect(r.you().awakened).toBe(true); expect(r.you().awakenedUntil).toBeGreaterThan(r.sim.serverTime);
      expect(r.lab('swap-self', 'goku')).toBe(true);
      expect(!!r.you().awakened).toBe(false); expect(r.you().awakenedUntil).toBe(0); expect(r.you().awakening).toBe(0);
      r.run(30); expect(!!r.you().awakened).toBe(false); expect(r.you().action).toBe('idle');
      r.sim.trainingCommand('you', 'awakening'); r.tick({ awaken: true }); r.run(3);
      expect(r.lab('swap-self', 'vegeta')).toBe(true);
      r.run(240);
      expect(!!r.you().awakened).toBe(false); expect(r.you().fighter).toBe('vegeta');
      const dummy = r.inside.actors.get('sparring-bot')!.state; dummy.awakened = true; dummy.awakenedUntil = r.sim.serverTime + 20;
      expect(r.lab('swap-self', 'gojo')).toBe(true);
      expect(!!r.bot().awakened).toBe(false);
    } finally { r.sim.dispose(); }
  });

  it('off the ground the new body is where the old one was, and comes down from there', () => {
    const r = room('ichigo'); try {
      r.tick({ jump: true });
      for (let i = 0; i < 40 && r.you().y < .6; i++) r.tick({ jumpHeld: true });
      const at = { x: r.you().x, y: r.you().y, z: r.you().z };
      expect(at.y).toBeGreaterThan(.5); expect(r.you().grounded).toBe(false);
      expect(r.lab('swap-self', 'killua')).toBe(true);
      expect(r.you().x).toBeCloseTo(at.x, 6); expect(r.you().y).toBeCloseTo(at.y, 6); expect(r.you().z).toBeCloseTo(at.z, 6);
      expect(r.you().grounded).toBe(false);
      r.run(120);
      expect(r.you().grounded).toBe(true); expect(r.you().y).toBeLessThan(.05);
      expect(Math.hypot(r.you().x - at.x, r.you().z - at.z)).toBeLessThan(.2);
    } finally { r.sim.dispose(); }
  });

  it('a knocked-out player is back on their feet as the new fighter, where they fell', () => {
    const r = room('zoro'); try {
      r.run(30, { moveX: 1 });
      r.sim.damage('you', 99999, 'sparring-bot', 'test');
      expect(r.you().alive).toBe(false);
      const at = { x: r.you().x, z: r.you().z };
      expect(r.lab('swap-self', 'sanji')).toBe(true);
      expect(r.you().alive).toBe(true); expect(r.you().hp).toBe(r.you().maxHp); expect(r.you().fighter).toBe('sanji');
      expect(r.you().x).toBeCloseTo(at.x, 6); expect(r.you().z).toBeCloseTo(at.z, 6);
      r.run(200); expect(r.you().alive).toBe(true); expect(r.you().fighter).toBe('sanji');
    } finally { r.sim.dispose(); }
  });

  it('keeps the tapes: one being recorded is saved as STOP saves it, one playing goes on from its start', () => {
    const r = room('naruto'); try {
      r.lab('record');
      r.run(25, { moveX: 1 });
      expect(r.sim.trainingLab.view()).toMatchObject({ recording: true });
      expect(r.lab('swap-self', 'kakashi')).toBe(true);
      expect(r.sim.trainingLab.view()).toMatchObject({ recording: false, slots: [25, 0, 0] });
      r.lab('play');
      expect(r.sim.trainingLab.view().behaviour).toBe('playback');
      r.run(10); expect(r.sim.trainingLab.view().cursor).toBe(10);
      expect(r.lab('swap-opponent', 'sasuke')).toBe(true);
      expect(r.sim.trainingLab.view()).toMatchObject({ behaviour: 'playback', cursor: 0, slots: [25, 0, 0] });
      r.run(5); expect(r.sim.trainingLab.view().cursor).toBe(5);
    } finally { r.sim.dispose(); }
  });

  it('holds through a frozen clock and a drill: the room is as the player set it', () => {
    const r = room('goku'); try {
      r.lab('behaviour', 'punish'); r.lab('drill-move', 'special');
      r.lab('freeze', true);
      const tick = r.sim.tick;
      expect(r.lab('swap-self', 'luffy')).toBe(true);
      expect(r.you().fighter).toBe('luffy');
      r.run(20); expect(r.sim.tick).toBe(tick);
      expect(r.sim.trainingLab.view()).toMatchObject({ behaviour: 'punish', frozen: true, drill: { move: 'special', attempts: 0, successes: 0 } });
    } finally { r.sim.dispose(); }
  });

  it('what a body brought of its own goes with the body: a forged kit, an outfit', () => {
    const r = room('goku'); try {
      expect(r.sim.forge('you', { ...MOVES.goku }, 'abcdef0123456789')).toBe(true);
      r.inside.actors.get('you')!.state.outfit = 'goku-something';
      expect(r.you().forge).toBe('abcdef0123456789');
      expect(r.lab('swap-self', 'vegeta')).toBe(true);
      expect(r.you().forge).toBeUndefined(); expect(r.you().outfit).toBeUndefined();
      expect((r.inside.actors.get('you') as unknown as { forged?: unknown }).forged).toBeUndefined();
    } finally { r.sim.dispose(); }
  });

  it('takes every released fighter for the player, never a held one for the dummy, and nobody else', () => {
    const r = room('naruto'); try {
      for (const bad of ['pikachu', 'nobody', '', 7, null, undefined, { fighter: 'goku' }]) {
        expect(isReleasedFighter(bad)).toBe(false);
        expect(r.lab('swap-self', bad), String(bad)).toBe(false); expect(r.lab('swap-opponent', bad), String(bad)).toBe(false);
      }
      expect(r.you().fighter).toBe('naruto');
      for (const held of HELD) { expect(r.lab('swap-opponent', held)).toBe(false); if (isReleasedFighter(held)) expect(r.lab('swap-self', held)).toBe(true); }
      for (const id of RELEASED_FIGHTERS) {
        expect(r.lab('swap-self', id), id).toBe(true); expect(r.you().fighter).toBe(id);
        if (!HELD.has(id)) { expect(r.lab('swap-opponent', id), id).toBe(true); expect(r.bot().fighter).toBe(id); }
      }
      r.run(10);
      expect(r.lab('swap-opponent', r.you().fighter)).toBe(true);
    } finally { r.sim.dispose(); }
  });

  it('is a training room\'s alone: a match never changes a fighter, and only a player in the room may ask', () => {
    const match = new ArenaSimulation({ roomMode: 'match', seed: 3 }); try {
      match.addPlayer('you', 'naruto', 'You'); match.addPlayer('them', 'goku', 'Them'); match.startMatch();
      expect(match.trainingCommand('you', { lab: 'swap-self', value: 'gojo' })).toBe(false);
      expect(match.trainingCommand('you', { lab: 'swap-opponent', value: 'gojo' })).toBe(false);
      expect(match.swapFighter('you', 'gojo')).toBe(false);
      expect(match.getPlayer('you')!.fighter).toBe('naruto'); expect(match.getPlayer('them')!.fighter).toBe('goku');
    } finally { match.dispose(); }
    const r = room('naruto'); try {
      expect(r.sim.trainingCommand('stranger', { lab: 'swap-self', value: 'gojo' })).toBe(false);
      expect(r.sim.trainingCommand('sparring-bot', { lab: 'swap-self', value: 'gojo' })).toBe(false);
      expect(r.sim.swapFighter('nobody', 'gojo')).toBe(false);
      expect(r.you().fighter).toBe('naruto');
    } finally { r.sim.dispose(); }
    const alone = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 3 }); try {
      alone.addPlayer('you', 'naruto', 'You');
      expect(alone.trainingCommand('you', { lab: 'swap-opponent', value: 'gojo' })).toBe(false);
    } finally { alone.dispose(); }
  });

  it('in a room with a second player (a training room on the match server) each changes only their own fighter', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', seed: 5 }); try {
      sim.addPlayer('a', 'naruto', 'A'); sim.addPlayer('b', 'goku', 'B');
      const dummy = sim.getPlayer('sparring-bot')!.fighter;
      expect(sim.trainingCommand('a', { lab: 'swap-self', value: 'gojo' })).toBe(true);
      expect(sim.getPlayer('a')!.fighter).toBe('gojo'); expect(sim.getPlayer('b')!.fighter).toBe('goku'); expect(sim.getPlayer('sparring-bot')!.fighter).toBe(dummy);
      expect(sim.trainingCommand('b', { lab: 'swap-opponent', value: 'zoro' })).toBe(true);
      expect(sim.getPlayer('sparring-bot')!.fighter).toBe('zoro'); expect(sim.getPlayer('a')!.fighter).toBe('gojo'); expect(sim.getPlayer('b')!.fighter).toBe('goku');
      for (const id of ['a', 'b', 'sparring-bot']) expect(sim.getPlayer(id)!.hp).toBe(sim.getPlayer(id)!.maxHp);
    } finally { sim.dispose(); }
  });

  it("leaves the LABORATORY's own OPPONENT command as it was: positions reset", () => {
    const r = room('naruto'); try {
      r.run(40, { moveX: 1 });
      expect(Math.abs(r.you().x)).toBeGreaterThan(.5);
      expect(r.lab('opponent', 'goku')).toBe(true);
      expect(r.bot().fighter).toBe('goku'); expect(r.you().x).toBeCloseTo(0); expect(r.you().z).toBeCloseTo(3);
    } finally { r.sim.dispose(); }
  });
});

describe("Training's switch on this device (LocalTraining)", () => {
  const neutral = (seq: number): PlayerInput => ({ seq, moveX: 0, moveZ: 0, yaw: Math.PI });
  it('is one training command: the next snapshot has the new fighter where the old one stood', async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('levi', 'Tester');
      const me = () => practice.snapshot!.players.find(p => p.id === practice.id)!, dummy = () => practice.snapshot!.players.find(p => p.isBot)!;
      for (let i = 1; i <= 30; i++) practice.send({ ...neutral(i), moveX: 1 });
      const at = { x: me().x, z: me().z }, stage = practice.snapshot!.stage;
      practice.room!.send('training', { lab: SWAP_LAB.self, value: 'mikasa' });
      practice.send(neutral(31));
      expect(me().fighter).toBe('mikasa'); expect(Math.hypot(me().x - at.x, me().z - at.z)).toBeLessThan(.05);
      expect(practice.snapshot!.stage).toBe(stage); expect(practice.id).toBe(LocalTraining.PLAYER);
      practice.room!.send('training', { lab: SWAP_LAB.opponent, value: 'eren' });
      practice.send(neutral(32));
      expect(dummy().fighter).toBe('eren'); expect(dummy().id).toBe('sparring-bot'); expect(me().fighter).toBe('mikasa');
      practice.press('heavy'); practice.send(neutral(33));
      const cast = practice.snapshot!.events.find(e => e.kind === 'cast' && e.actorId === practice.id);
      expect(cast?.fighter).toBe('mikasa');
    } finally { await practice.leave(); }
  }, 60_000);

  it('takes the Forge studio to the new body: the old body\'s own moves back first, the studio open as it was, the dummy held as it was', async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('goku', 'Tester');
      const session = new ForgeSession(), own = MOVES.goku.special;
      const state = Studio.tryItem(Studio.startStudio('goku', Studio.defaultKitName('Goku')), 'special', { kind: 'move', from: 'naruto', fromSlot: 'special' });
      expect(session.apply(Studio.inPlay(state))).toEqual({ ok: true });
      expect(MOVES.goku.special).not.toBe(own);
      const made: { body: FighterId; carried: { open?: boolean; dummyWas?: string }; gokuSpecialWasOwn: boolean }[] = []; let disposed = 0;
      const studio = (carried: { open?: boolean; dummyWas?: string }, onDispose = () => {}) => ({ dispose: () => { disposed++; onDispose(); }, carried: { open: !!carried.open, dummyWas: carried.dummyWas } });
      const inside = practice as unknown as { forge?: ReturnType<typeof studio>; makeForge?: (body: FighterId, carried: { open?: boolean; dummyWas?: string }) => ReturnType<typeof studio> };
      inside.makeForge = (body, carried) => { made.push({ body, carried, gokuSpecialWasOwn: MOVES.goku.special === own }); return studio(carried); };
      inside.forge = studio({ open: true, dummyWas: 'combat' }, () => session.restore());

      practice.room!.send('training', 'reset'); practice.room!.send('training', { lab: SWAP_LAB.opponent, value: 'zoro' }); practice.room!.send('training', { lab: SWAP_LAB.self, value: 'nobody' });
      expect(disposed).toBe(0); expect(made).toHaveLength(0);

      practice.room!.send('training', { lab: SWAP_LAB.self, value: 'vegeta' });
      expect(disposed).toBe(1);
      expect(made).toEqual([{ body: 'vegeta', carried: { open: true, dummyWas: 'combat' }, gokuSpecialWasOwn: true }]);
      expect(MOVES.goku.special).toBe(own);
      expect(practice.sim!.getPlayer(LocalTraining.PLAYER)!.fighter).toBe('vegeta');
      inside.forge = studio({ open: false });
      practice.room!.send('training', { lab: SWAP_LAB.self, value: 'gojo' });
      expect(made[1]).toMatchObject({ body: 'gojo', carried: { open: false, dummyWas: undefined } });
    } finally { await practice.leave(); }
  }, 60_000);
});

describe("Training's switch: the move trials are the new fighter's", () => {
  it('every fighter has trials of their own, by their own moves\' names', () => {
    const goku = trialsFor('goku'), gojo = trialsFor('gojo');
    expect(goku.length).toBeGreaterThan(4); expect(gojo.length).toBeGreaterThan(4);
    expect(gojo.map(t => t.name)).not.toEqual(goku.map(t => t.name));
    expect(gojo.some(t => t.name === MOVES.gojo.special.name)).toBe(true);
  });
});

describe("Training's switch: who may be chosen, PREVIOUS / NEXT, RANDOM", () => {
  const roster = ['goku', 'luffy', 'naruto', 'ichigo', 'gojo'] as FighterId[];
  it('offers the player the whole roster and the dummy everyone but a held fighter', () => {
    expect(swapRoster('self', roster, new Set(['luffy'] as FighterId[]))).toEqual(roster);
    expect(swapRoster('opponent', roster, new Set(['luffy'] as FighterId[]))).toEqual(['goku', 'naruto', 'ichigo', 'gojo']);
  });
  it('steps round the roster in its own order', () => {
    expect(stepFighter(roster, 'goku', 1)).toBe('luffy'); expect(stepFighter(roster, 'luffy', -1)).toBe('goku');
    expect(stepFighter(roster, 'gojo', 1)).toBe('goku'); expect(stepFighter(roster, 'goku', -1)).toBe('gojo');
    expect(stepFighter(roster, 'zoro', 1)).toBe('goku'); expect(stepFighter(roster, 'zoro', -1)).toBe('gojo'); expect(stepFighter(roster, undefined, 1)).toBe('goku');
    expect(stepFighter([], 'goku', 1)).toBeUndefined();
    let at: FighterId = 'naruto'; const seen: FighterId[] = [];
    for (let i = 0; i < roster.length; i++) { at = stepFighter(roster, at, 1)!; seen.push(at); }
    expect(new Set(seen).size).toBe(roster.length); expect(at).toBe('naruto');
  });
  it('RANDOM deals somebody else, and never the fighter across the room', () => {
    for (let i = 0; i < 200; i++) {
      const dealt = randomFighter(roster, ['goku', 'gojo'], () => i / 200)!;
      expect(roster).toContain(dealt); expect(dealt).not.toBe('goku'); expect(dealt).not.toBe('gojo');
    }
    expect(randomFighter(roster, ['goku', 'gojo'], () => 0)).toBe('luffy'); expect(randomFighter(roster, ['goku', 'gojo'], () => .999)).toBe('ichigo');
    expect(randomFighter(['goku', 'gojo'] as FighterId[], ['goku', 'gojo'], () => 0)).toBe('gojo');
    expect(randomFighter(['goku'] as FighterId[], ['goku', undefined], () => 0)).toBeUndefined();
    expect(randomFighter(roster, [undefined, undefined], () => 0)).toBe('goku');
  });
  it('knows a switch among the training commands', () => {
    expect(swapSideOf({ lab: 'swap-self', value: 'goku' })).toBe('self'); expect(swapSideOf({ lab: 'swap-opponent', value: 'goku' })).toBe('opponent');
    expect(swapSideOf({ lab: 'opponent', value: 'goku' })).toBe('opponent');
    for (const other of ['reset', 'awakening', 'passive', { lab: 'behaviour', value: 'guard' }, null, undefined, 3]) expect(swapSideOf(other)).toBeUndefined();
  });
});

describe("Training's switch: the picker's roster and its foot line", () => {
  it('lists the home page\'s roster in the home page\'s order, every released fighter once', () => {
    const mine = swapOrder('self'), theirs = swapOrder('opponent');
    expect(mine).toEqual(HOME_VOLUMES.flat());
    expect([...mine].sort()).toEqual([...RELEASED_FIGHTERS].sort());
    expect(theirs).toEqual(mine.filter(id => !HELD.has(id)));
    expect(stepFighter(mine, HOME_VOLUMES[0].at(-1), 1)).toBe(HOME_VOLUMES[1][0]);
  });
  it('names this device\'s presses, and how to step without the picker', () => {
    const keys = hintsHtml('keyboard', 'generic', 'opponent');
    for (const word of ['MOVE', 'PICK', 'CLOSE', 'OPPONENT', 'IN THE FIGHT', '<kbd>9</kbd>', '<kbd>0</kbd>', '<kbd>=</kbd>', '<kbd>7</kbd>', '<kbd>Esc</kbd>']) expect(keys).toContain(word);
    expect(hintsHtml('keyboard', 'generic', 'self')).toContain('<kbd>6</kbd>');
    const pad = hintsHtml('controller', 'playstation', 'opponent');
    for (const word of ['CREATE', '✕', '○', '△', 'D ←', 'D ↑', 'PREVIOUS / NEXT FIGHTER']) expect(pad).toContain(word);
    expect(hintsHtml('controller', 'xbox', 'self')).toContain('VIEW');
    expect(hintsHtml('touch', 'generic', 'opponent')).toContain('TAP A FIGHTER');
  });
});

describe("Training's switch: the saved choice", () => {
  const store = new Map<string, string>();
  beforeEach(() => { store.clear(); (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => void store.set(k, String(v)), removeItem: k => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 }; });
  it('remembers the opponent as the mode sheet does (rift-mode-prefs, training.rival), and RANDOM as no choice', () => {
    saveModePrefs('training', { variant: 'offline', stage: 'martial-arts-tournament' as never });
    saveModePrefs('training', swapMemory('opponent', 'zoro', false)!);
    expect(trainingRival()).toBe('zoro');
    expect(JSON.parse(store.get('rift-mode-prefs')!).training).toMatchObject({ rival: 'zoro', variant: 'offline', stage: 'martial-arts-tournament' });
    saveModePrefs('training', swapMemory('opponent', 'gojo', true)!);
    expect(trainingRival()).toBeUndefined();
    expect(modePrefs('training')).toMatchObject({ variant: 'offline', stage: 'martial-arts-tournament' });
    expect(swapMemory('self', 'gojo', false)).toBeUndefined(); expect(swapMemory('self', 'gojo', true)).toBeUndefined();
  });
});

describe("Training's switch: the page's ledger", () => {
  it('a newer choice for a side overtakes one still loading; the other side waits on its own', () => {
    const ledger = new SwapLedger();
    const first = ledger.ask('self', 'gojo', 0), other = ledger.ask('opponent', 'zoro', 5), second = ledger.ask('self', 'luffy', 10);
    expect(ledger.current(first)).toBe(false); expect(ledger.current(second)).toBe(true); expect(ledger.current(other)).toBe(true);
    expect(ledger.pending('self')).toBe('luffy'); expect(ledger.pending('opponent')).toBe('zoro');
    expect(ledger.waiting()).toEqual(['luffy', 'zoro']);
    ledger.sent(first, 20); expect(first.sentAt).toBeUndefined();
    ledger.drop('self', first); expect(ledger.pending('self')).toBe('luffy');
    ledger.drop('self', second); expect(ledger.pending('self')).toBeUndefined(); expect(ledger.pending('opponent')).toBe('zoro');
  });
  it('reads the room\'s answer off its snapshots: settled when the fighter shows, never before it was asked', () => {
    const ledger = new SwapLedger();
    expect(ledger.observe({ self: 'goku', opponent: 'zoro' }, 0)).toEqual({ changed: [], settled: [], lapsed: [] });
    const ask = ledger.ask('self', 'gojo', 100);
    expect(ledger.observe({ self: 'goku', opponent: 'zoro' }, 150)).toEqual({ changed: [], settled: [], lapsed: [] });
    expect(ledger.pending('self')).toBe('gojo');
    ledger.sent(ask, 1900);
    expect(ledger.observe({ self: 'goku', opponent: 'zoro' }, 1905).settled).toHaveLength(0);
    const seen = ledger.observe({ self: 'gojo', opponent: 'zoro' }, 1920);
    expect(seen.changed).toEqual(['self']); expect(seen.settled).toEqual([ask]); expect(seen.lapsed).toEqual([]);
    expect(ledger.pending('self')).toBeUndefined(); expect(ledger.shown('self')).toBe('gojo');
    expect(ledger.observe({ self: 'gojo', opponent: 'zoro' }, 1940)).toEqual({ changed: [], settled: [], lapsed: [] });
  });
  it('says when a side is another fighter whoever asked, and lets go of an ask the room never answers', () => {
    const ledger = new SwapLedger();
    ledger.observe({ self: 'goku', opponent: 'zoro' }, 0);
    expect(ledger.observe({ self: 'goku', opponent: 'luffy' }, 10).changed).toEqual(['opponent']);
    const ask = ledger.ask('opponent', 'gojo', 20); ledger.sent(ask, 30);
    expect(ledger.observe({ self: 'goku', opponent: 'luffy' }, 30 + SWAP_LAPSE_MS)).toEqual({ changed: [], settled: [], lapsed: [] });
    expect(ledger.observe({ self: 'goku', opponent: 'luffy' }, 31 + SWAP_LAPSE_MS)).toEqual({ changed: [], settled: [], lapsed: [ask] });
    expect(ledger.pending('opponent')).toBeUndefined();
    ledger.ask('self', 'gojo', 40); ledger.reset();
    expect(ledger.pending('self')).toBeUndefined(); expect(ledger.shown('self')).toBeUndefined();
    expect(ledger.observe({ self: 'naruto', opponent: 'sasuke' }, 50).changed).toEqual([]);
  });
});

describe("Training's switch stays Training's", () => {
  it('an objective match runs on a training-mode simulation and its snapshots say so: the mode alone is not the practice room', () => {
    const match = new ObjectiveMatch('bad-blood');
    try {
      match.add('h0', 'goku', 'Hero', 'heroes');
      const snapshot = match.snapshot();
      expect(snapshot.roomMode).toBe('training');
      expect(objectiveOf(snapshot)).toBeTruthy();
      expect(snapshot.players.some(p => p.id === 'sparring-bot')).toBe(false);
    } finally { match.dispose(); }
  });

  it("the page keys the switch's watch, and what it lets go of with the fight on, on the practice room", () => {
    const main = readFileSync('src/main.ts', 'utf8');
    expect(main).toMatch(/const practiceRoom=\([^)]*\)=>snapshot\?\.roomMode==='training'&&!survival\(\)&&!objectiveOf\(snapshot\);/);
    expect(main).toMatch(/practiceRoom\(snapshot\)\)watchSwaps\(snapshot\)/);
    expect(main).toMatch(/if\(rebodied\)\{rebodied=false;if\(practiceRoom\(snapshot\)\)\{clearFlights\(\);/);
    expect(main).toMatch(/practiceRoom\(snapshot\)\)audio\.retain\(keep\)/);
    expect(main).toMatch(/!practiceRoom\(room\)[^;\n]*\)return;/);
    for (const line of main.split('\n').filter(text => /watchSwaps\(snapshot\)|clearFlights\(\);|audio\.retain\(keep\)/.test(text) && !/^function |^\s*\/\//.test(text)))
      expect(line, line.slice(0, 120)).not.toMatch(/roomMode===?'training'&&!survival\(\)\)/);
    expect(main).toMatch(/function resetSwaps\(\)\{[^\n]*trainingBench\.length=0;/);
    expect(main.match(/resetSwaps\(\);/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(main).toMatch(/function returnToLobby\([^)]*\)\{[^\n]*resetSwaps\(\);/);
  });
});
