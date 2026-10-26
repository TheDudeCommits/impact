import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ArenaSimulation } from '../src/game/simulation';
import { DuelSet } from '../src/game/duel/DuelSet';
import { LocalDuel } from '../src/game/duel/LocalDuel';
import { LocalRoyale } from '../src/game/LocalRoyale';
import { MatchBell } from '../src/game/matchBell';
import { ObjectiveMatch } from '../src/game/objectives/ObjectiveMatch';
import { LANES } from '../src/game/objectives/lastStand';
import { RiftMatch } from '../src/game/moba/RiftMatch';
import { Targeting } from '../src/game/Targeting';
import { DUEL_ARENAS } from '../src/game/social/custom';
import { STAGES, royalePool, type StageId } from '../src/game/stages';
import { FollowCamera } from '../src/render/FollowCamera';
import type { CameraMode, CameraStyle } from '../src/config';
import type { Fighter } from '../src/render/Fighter';
import type { FighterId, PlayerInput, PlayerState } from '../src/game/types';


const DEG = 180 / Math.PI, FEW = 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
type Stood = Pick<PlayerState, 'id' | 'x' | 'z' | 'yaw' | 'alive' | 'team'>;
const opponents = (me: Stood, all: readonly Stood[]) => all.filter(p => p.id !== me.id && p.alive && (me.team === undefined || p.team !== me.team));
function closest<T extends Stood>(me: Stood, all: readonly T[]): T | undefined {
  const foes = opponents(me, all) as T[], gap = (p: Stood) => Math.hypot(p.x - me.x, p.z - me.z), nearest = Math.min(...foes.map(gap));
  const off = (p: Stood) => Math.abs(wrap(me.yaw - Math.atan2(p.x - me.x, p.z - me.z)));
  return foes.filter(p => gap(p) <= nearest + .01).sort((a, b) => off(a) - off(b))[0];
}
const offClosest = (me: Stood, all: readonly Stood[]) => { const foe = closest(me, all)!; return Math.abs(wrap(me.yaw - Math.atan2(foe.x - me.x, foe.z - me.z))) * DEG; };
const worst = (all: readonly Stood[]) => Math.max(...all.map(p => offClosest(p, all)));
const CAST: FighterId[] = ['goku', 'naruto', 'luffy', 'zoro', 'ichigo', 'sasuke', 'vegeta', 'gojo', 'sukuna', 'tanjiro', 'killua', 'jotaro'];
const neutral = (seq: number): PlayerInput => ({ seq, moveX: 0, moveZ: 0, yaw: 0 });
const RING = DUEL_ARENAS.find(stage => STAGES[stage].duelAxis === undefined)!;

function room(stage: StageId | undefined, field: number, seed: number, bots = true) {
  const sim = new ArenaSimulation({ roomMode: 'match', stage, seed });
  for (let k = 0; k < field; k++) sim.addPlayer(`seat-${k}`, CAST[k % CAST.length], `Seat ${k}`, bots && k > 0);
  return sim;
}

describe('the room seats every fighter facing the closest opponent', () => {
  it('a Duel: both seats look at each other on every place a Duel is fought, whatever way the ring was turned', () => {
    const turned = new Set<number>(), ends = new Map<StageId, Set<number>>();
    for (const stage of ['martial-arts-tournament', ...DUEL_ARENAS] as StageId[]) for (let seed = 1; seed <= 16; seed++) {
      const sim = room(stage, 2, seed, false);
      expect(sim.startMatch()).toBe(true);
      const [a, b] = sim.playerStates();
      expect(worst([a, b]), `${stage}, seed ${seed}`).toBeLessThan(.01);
      expect(Math.abs(wrap(a.yaw - b.yaw - Math.PI)) * DEG, `${stage}, seed ${seed}`).toBeLessThan(.01);
      if (stage === RING) turned.add(Math.round(a.yaw * DEG / 30));
      const axis = STAGES[stage].duelAxis;
      if (axis !== undefined) {
        expect(Math.abs(Math.sin(wrap(a.yaw - axis))) * DEG, `${stage}, seed ${seed}: along the axis`).toBeLessThan(.01);
        expect(Math.abs(Math.sin(Math.atan2(a.x, a.z) - axis)) * Math.hypot(a.x, a.z), `${stage}, seed ${seed}: on the axis`).toBeLessThan(.01);
        ends.set(stage, (ends.get(stage) ?? new Set()).add(Math.round(Math.cos(Math.atan2(a.x, a.z) - axis))));
      }
    }
    expect(turned.size).toBeGreaterThan(6);
    for (const [stage, seen] of ends) expect(seen.size, stage).toBe(2);
  });

  it('a Duel, every round: the set reseats the two for each round and they face each other again', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const sim = room(RING, 2, seed, false), set = new DuelSet(), seats: string[] = [];
      expect(sim.startMatch()).toBe(true);
      for (let round = 1; round <= 3; round++) {
        expect(sim.status).toBe('active'); expect(set.view.round).toBe(round);
        const all = sim.playerStates();
        expect(worst(all), `seed ${seed}, round ${round}`).toBeLessThan(.01);
        seats.push(all.map(p => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(' '));
        set.step(sim);
        const [loser, winner] = round === 2 ? ['seat-0', 'seat-1'] : ['seat-1', 'seat-0'];
        sim.damage(loser, 1e6, winner, 'KO');
        for (let i = 0; i < 1200 && set.view.phase === 'playing'; i++) { sim.step(1 / 60); set.step(sim); }
        if (round === 3) break;
        expect(set.view.phase).toBe('interval');
        for (let i = 0; i < 1200 && set.view.phase === 'interval'; i++) { sim.step(1 / 60); set.step(sim); }
      }
      expect(set.view.phase).toBe('complete');
      expect(new Set(seats).size, `seed ${seed}: the rounds were dealt different seats`).toBeGreaterThan(1);
    }
  });

  it('a royale: every seat of every field, on every place it is dealt', () => {
    for (const field of [4, 6, 8, 10, 12]) for (const stage of [undefined, ...royalePool(field)]) for (let seed = 1; seed <= 4; seed++) {
      const sim = room(stage, field, seed);
      expect(sim.startMatch()).toBe(true);
      const all = sim.playerStates();
      expect(all).toHaveLength(field);
      expect(worst(all), `${field} on ${stage ?? 'the harbour'}, seed ${seed}`).toBeLessThan(.01);
      for (const p of all) expect(sim.actors.get(p.id)!.input.yaw).toBe(p.yaw);
    }
  });

  it('team-mates are not who is faced, and with nobody to face the seat keeps its heading', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const sim = room('kami-lookout', 4, seed, false);
      sim.setTeam('seat-0', 'red'); sim.setTeam('seat-1', 'red'); sim.setTeam('seat-2', 'blue'); sim.setTeam('seat-3', 'blue');
      expect(sim.startMatch()).toBe(true);
      const all = sim.playerStates();
      for (const p of all) expect(closest(p, all)!.team, `seed ${seed}`).not.toBe(p.team);
      expect(worst(all), `seed ${seed}`).toBeLessThan(.01);
    }
    const alone = room('kami-lookout', 2, 3, false);
    alone.setTeam('seat-0', 'red'); alone.setTeam('seat-1', 'red');
    expect(alone.startMatch()).toBe(true);
    for (const p of alone.playerStates()) expect(p.yaw).toBe(Math.PI);
  });

  it('the offline Duel, as the page plays it: at the bell of each round', async () => {
    const duel = new LocalDuel();
    try {
      await duel.connect('goku', 'You', 'naruto', 'martial-arts-tournament');
      let seq = 0;
      const bell = () => { for (let i = 0; i < 900 && duel.snapshot!.status !== 'active'; i++) duel.send(neutral(++seq)); return duel.snapshot!; };
      const first = bell();
      expect(first.duel).toMatchObject({ round: 1, phase: 'playing' });
      expect(worst(first.players)).toBeLessThan(.01);
      duel.sim!.damage('duel-bot', 1e6, 'you', 'KO');
      for (let i = 0; i < 900 && duel.snapshot!.duel!.phase !== 'interval'; i++) duel.send(neutral(++seq));
      expect(duel.snapshot!.status).toBe('waiting');
      const second = bell();
      expect(second.duel).toMatchObject({ round: 2, phase: 'playing' });
      expect(worst(second.players)).toBeLessThan(.01);
    } finally { await duel.leave(); }
  }, 60_000);

  it('the offline royale, as the page plays it: at its bell', async () => {
    const royale = new LocalRoyale();
    try {
      await royale.connect('naruto', 'You', 8);
      expect(royale.snapshot!.status).toBe('waiting');
      let seq = 0;
      for (let i = 0; i < 900 && royale.snapshot!.status !== 'active'; i++) royale.send(neutral(++seq));
      const bell = royale.snapshot!;
      expect(bell.status).toBe('active'); expect(bell.players).toHaveLength(8);
      expect(worst(bell.players)).toBeLessThan(.01);
    } finally { await royale.leave(); }
  }, 60_000);
});

describe('the modes that seat their own fighters', () => {
  const matches: { dispose(): void }[] = [];
  afterEach(() => matches.splice(0).forEach(match => match.dispose()));

  it('Training: the lab stands the player and the sparring partner face to face (the reset the page sends as it enters)', () => {
    const sim = new ArenaSimulation({ roomMode: 'training', stage: 'chunin-exam-room', seed: 7 });
    sim.addPlayer('you', 'goku', 'You');
    expect(sim.trainingCommand('you', 'reset')).toBe(true);
    const all = sim.playerStates();
    expect(all).toHaveLength(2);
    expect(worst(all)).toBeLessThan(.01);
    expect(Math.hypot(all[0].x - all[1].x, all[0].z - all[1].z)).toBeCloseTo(3);
  });

  it('Bad Blood: each side looks across at the other, every fighter at the one opposite', () => {
    const match = new ObjectiveMatch('bad-blood'); matches.push(match);
    for (let i = 0; i < 3; i++) { match.add(`h${i}`, (['goku', 'naruto', 'luffy'] as const)[i], 'Hero', 'heroes'); match.add(`v${i}`, 'dio', 'Villain', 'villains'); }
    match.start();
    for (let i = 0; i < 600 && match.view.phase !== 'active'; i++) match.step();
    expect(match.view.phase).toBe('active');
    const all = match.sim.playerStates();
    expect(all).toHaveLength(6);
    expect(worst(all)).toBeLessThan(FEW);
  });

  it('Rift War: each fighter looks down the map at the other base, where the closest opponent is', () => {
    const match = new RiftMatch({ seed: 41, fillBots: false }); matches.push(match as unknown as { dispose(): void });
    for (let i = 0; i < 5; i++) { match.add(`h${i}`, (['naruto', 'goku', 'luffy', 'ichigo', 'ace'] as const)[i], 'Hero'); match.add(`v${i}`, 'dio', 'Villain'); }
    match.start();
    for (let i = 0; i < 600 && match.view.phase !== 'active'; i++) match.step();
    expect(match.view.phase).toBe('active');
    const all = match.sim.playerStates();
    expect(all).toHaveLength(10);
    expect(worst(all)).toBeLessThan(FEW);
  });

  it('Last Stand: nobody stands against the defenders yet, and they look down the roads the horde comes up', () => {
    const match = new ObjectiveMatch('last-stand', undefined, 3, 'host'); matches.push(match);
    for (let i = 0; i < 4; i++) match.add(`h${i}`, 'goku', 'Defender');
    match.start();
    for (let i = 0; i < 600 && match.view.phase !== 'active'; i++) match.step();
    const all = match.sim.playerStates(), defenders = all.filter(p => !p.enemy);
    expect(defenders).toHaveLength(4);
    for (const p of defenders) {
      expect(opponents(p, all)).toHaveLength(0);
      expect(Math.abs(wrap(p.yaw - Math.atan2(LANES[1].x - p.x, LANES[1].z - p.z))) * DEG).toBeLessThan(6);
      expect(wrap(p.yaw - Math.atan2(LANES[0].x - p.x, LANES[0].z - p.z)) * wrap(p.yaw - Math.atan2(LANES[2].x - p.x, LANES[2].z - p.z))).toBeLessThan(0);
    }
  });
});

describe('the bell the page hears', () => {
  const snapshot = (status: 'waiting' | 'active' | 'finished', roomMode: 'match' | 'training' = 'match', duel = false) =>
    ({ roomMode, status, duel: duel ? ({ set: 1, round: 1, phase: 'playing' } as never) : undefined });

  it('rings once, on the first snapshot of the fight after one of the waiting room', () => {
    const bell = new MatchBell();
    expect([snapshot('waiting'), snapshot('waiting'), snapshot('active'), snapshot('active'), snapshot('finished')].map(s => bell.rang(s))).toEqual([false, false, true, false, false]);
  });
  it('does not ring for a fight this page joined already under way, nor in a room that is not a match', () => {
    const bell = new MatchBell();
    expect(bell.rang(snapshot('active'))).toBe(false);
    expect([snapshot('waiting', 'training'), snapshot('active', 'training')].map(s => bell.rang(s))).toEqual([false, false]);
  });
  it('leaves a Duel to its own round start, and forgets a room that was left', () => {
    const bell = new MatchBell();
    expect([snapshot('waiting', 'match', true), snapshot('active', 'match', true)].map(s => bell.rang(s))).toEqual([false, false]);
    expect(bell.rang(snapshot('waiting'))).toBe(false);
    bell.reset();
    expect(bell.rang(snapshot('active'))).toBe(false);
    expect([snapshot('waiting'), snapshot('active', 'match', true), snapshot('active')].map(s => bell.rang(s))).toEqual([false, false, false]);
  });
});

const body = (s: PlayerState) => { const b = { state: { ...s }, group: new THREE.Group(), velocity: new THREE.Vector3() } as unknown as Fighter; b.group.position.set(s.x, s.y, s.z); return b; };
const person = (id: string, x: number, z: number, yaw: number): PlayerState => ({ id, name: id, fighter: 'goku', x, y: 0, z, yaw, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
  action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
function film(players: PlayerState[], id: string, opts: { mode?: CameraMode; style?: CameraStyle; seconds?: number; before?: number } = {}) {
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera), bodies = new Map(players.map(p => [p.id, body(p)]));
  const me = players.find(p => p.id === id)!, mine = bodies.get(id)!, foe = closest(me, players), targeting = new Targeting();
  const set = () => { follow.mode = opts.mode ?? 'dynamic'; follow.style = opts.style ?? 'close'; follow.cinematics = true; follow.battlefield = false; };
  const waiting = body({ ...me, x: me.x + 30, z: me.z - 30 });
  let yaw = opts.before ?? me.yaw + 2.2, pitch = .02;
  for (let i = 0; i < 60; i++) { set(); follow.update(1 / 60, waiting, yaw, pitch, [], .5); yaw = follow.inputYaw; pitch = follow.inputPitch; }
  yaw = me.yaw; follow.reset(); follow.lookAlong(yaw);
  const held = { movementYaw: follow.movementYaw, inputYaw: follow.inputYaw, basis: follow.movementBasis(0) };
  const aim = new THREE.Vector3(), v = new THREE.Vector3();
  const frames: { heading: number; inFrame: boolean; behind: number; about: string | null }[] = [];
  for (let i = 0; i < Math.round((opts.seconds ?? 3) * 60); i++) {
    const nominee = targeting.update(players, me, [], i / 60, yaw);
    const about = follow.mode === 'dynamic' ? follow.picker.update(1 / 60, players, me, follow.movementYaw, [], null, nominee) : nominee;
    set(); follow.movementBasis(0);
    follow.update(1 / 60, mine, yaw, pitch, [], .5, about ? bodies.get(about) : undefined, false);
    yaw = follow.inputYaw; pitch = follow.inputPitch; camera.updateMatrixWorld(); camera.getWorldDirection(aim);
    const at = foe ? v.set(foe.x, 1.05, foe.z).project(camera) : undefined;
    frames.push({ heading: Math.atan2(aim.x, aim.z), inFrame: !!at && at.z < 1 && Math.abs(at.x) < 1 && Math.abs(at.y) < 1, about,
      behind: (camera.position.x - me.x) * Math.sin(me.yaw) + (camera.position.z - me.z) * Math.cos(me.yaw) });
  }
  const turned = frames.reduce((sum, f, i) => i ? sum + Math.abs(wrap(f.heading - frames[i - 1].heading)) * DEG : 0, 0);
  return { held, frames, first: frames[0], last: frames.at(-1)!, turned, foe, me };
}

describe('the lens starts behind the player, looking the way they face', () => {
  it('holds the heading it is handed at once, before a frame is laid: what asks the camera first is answered with it', () => {
    for (const yaw of [0, 1.1, -2.6, Math.PI]) {
      const { held } = film([person('me', 4, -3, yaw), person('foe', 4 + Math.sin(yaw) * 18, -3 + Math.cos(yaw) * 18, yaw + Math.PI)], 'me', { before: yaw + 2.5 });
      expect(wrap(held.movementYaw - yaw)).toBeCloseTo(0, 9); expect(wrap(held.inputYaw - yaw)).toBeCloseTo(0, 9); expect(wrap(held.basis - yaw)).toBeCloseTo(0, 9);
    }
  });

  for (const mode of ['dynamic', 'lockon', 'free'] as const) for (const style of ['close', 'classic'] as const)
    it(`${mode}, ${style}: the first frame looks along the fighter's facing from behind them, the opponent they face in it`, () => {
      for (const yaw of [0, .9, 2.4, -1.7, Math.PI]) {
        const players = [person('me', -2, 5, yaw), person('foe', -2 + Math.sin(yaw) * 18, 5 + Math.cos(yaw) * 18, yaw + Math.PI)], where = `facing ${Math.round(yaw * DEG)}`;
        const { first } = film(players, 'me', { mode, style, seconds: .1 });
        expect(Math.abs(wrap(first.heading - yaw)) * DEG, where).toBeLessThan(mode === 'free' ? 20 : FEW);
        expect(first.behind, where).toBeLessThan(-1.5);
        expect(first.inFrame, where).toBe(true);
        const fresh = film(players, 'me', { mode, style, seconds: .1, before: yaw }).first;
        expect(wrap(first.heading - fresh.heading), where).toBeCloseTo(0, 6); expect(first.behind, where).toBeCloseTo(fresh.behind, 6);
      }
    });

  it('a Duel dealt by the room: from both seats the opponent is in the first frame and stays there, the lens all but still', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const sim = room('martial-arts-tournament', 2, seed, false);
      expect(sim.startMatch()).toBe(true);
      const players = sim.playerStates();
      for (const p of players) {
        const shot = film(players, p.id);
        expect(Math.abs(wrap(shot.first.heading - Math.atan2(shot.foe!.x - p.x, shot.foe!.z - p.z))) * DEG, `seed ${seed}, ${p.id}`).toBeLessThan(FEW);
        expect(shot.frames.every(f => f.inFrame), `seed ${seed}, ${p.id}`).toBe(true);
        expect(shot.turned, `seed ${seed}, ${p.id}`).toBeLessThan(25);
      }
    }
  });

  it('a royale dealt by the room: from every seat the closest opponent is in the first frame, and the shot stays theirs', () => {
    for (const [stage, field] of [['kami-lookout', 8], ['kami-lookout', 12], [undefined, 12], ['valley-of-the-end', 6]] as const) for (let seed = 1; seed <= 3; seed++) {
      const sim = room(stage, field, seed, false);
      expect(sim.startMatch()).toBe(true);
      const players = sim.playerStates();
      for (const p of players) {
        const shot = film(players, p.id), where = `${field} on ${stage ?? 'the harbour'}, seed ${seed}, ${p.id}`;
        expect(shot.first.inFrame, where).toBe(true);
        expect(shot.frames.every(f => f.inFrame), where).toBe(true);
        expect(shot.frames.every(f => f.about === null || f.about === shot.foe!.id), where).toBe(true);
        expect(shot.turned, where).toBeLessThan(40);
      }
    }
  }, 30000);
});
