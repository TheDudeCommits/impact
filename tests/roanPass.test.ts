import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ArenaSimulation } from '../src/game/simulation';
import { BIG_HITSTOP, BIG_LAUNCH_MOST, HITSTOP, MOVES, RUSH_STAGES } from '../src/game/moves';
import { isBigBlow } from '../src/game/bigBlow';
import { Fighter } from '../src/render/Fighter';
import { STAGE_LOOKS, lookFor } from '../src/render/look/stageLooks';
import { CameraBrain, brainInput, subject } from '../src/render/CameraBrain';
import { FinisherCuts } from '../src/render/FinisherCuts';
import type { CombatEvent, FighterId, PlayerInput } from '../src/game/types';


function bout(fighter: FighterId = 'naruto', other: FighterId = 'goku', gap = 1.6) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', other, 'B', false, { x: 0, y: 0, z: gap });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput> = {}) =>
    sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, targetId: id === 'a' ? 'b' : 'a', ...more });
  const events: CombatEvent[] = [];
  const holds: { victim: number; thrower: number; event: CombatEvent }[] = [];
  const step = (seconds: number, each?: (frame: number) => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      each?.(i); sim.step();
      for (const e of sim.snapshot(true).events) {
        events.push(e);
        if (e.kind === 'hit' && e.actorId === 'a') {
          const v = sim.actors.get('b')!, t = sim.actors.get('a')!;
          holds.push({ victim: v.hitstopUntil - v.hitstopFrom, thrower: t.hitstopUntil - t.hitstopFrom, event: e });
        }
      }
    }
  };
  input('a'); input('b');
  return { sim, input, step, events, holds };
}

describe('the big blows (game/bigBlow.ts)', () => {
  it('are the last blow of a special, an ultimate, an ender and a rush finisher - nothing else', () => {
    for (let stage = 0; stage < RUSH_STAGES - 1; stage++) expect(isBigBlow('light', undefined, stage, true), `rush stage ${stage}`).toBe(false);
    expect(isBigBlow('light', undefined, RUSH_STAGES - 1, true), 'the rush finisher').toBe(true);
    expect(isBigBlow('heavy', undefined, 0, true), 'a plain heavy').toBe(false);
    expect(isBigBlow('heavy', 'lllh', 0, true), 'an ender').toBe(true);
    expect(isBigBlow('special', undefined, 0, true), "a special's last blow").toBe(true);
    expect(isBigBlow('special', undefined, 0, false), "a special's earlier tick").toBe(false);
    expect(isBigBlow('ultimate', undefined, 0, true)).toBe(true);
    expect(isBigBlow(undefined, undefined, 0, true)).toBe(false);
  });

  it("hold the struck body longer and leave the thrower's hold as it was", () => {
    const fight = bout('naruto', 'goku', 3.8);
    fight.input('a', { attack: 'special' });
    fight.step(3);
    const big = fight.holds.find(h => h.event.slot === 'special');
    expect(big, 'the Rasenshuriken landed').toBeDefined();
    const move = MOVES.naruto.special, last = big!.event.contactIndex === undefined || big!.event.contactIndex >= move.contacts.length - 1;
    expect(last).toBe(true);
    expect(big!.victim).toBeGreaterThanOrEqual(Math.max(HITSTOP.special, BIG_HITSTOP.special * .75) - 1e-6);
    expect(big!.thrower).toBeLessThanOrEqual(HITSTOP.special * .6 + 1e-6);
  });

  it('keep a light that is not the finisher exactly as it was', () => {
    const fight = bout('naruto');
    fight.input('a', { attack: 'light' });
    fight.step(.8);
    const jab = fight.holds.find(h => h.event.slot === 'light' && (h.event.chain ?? 0) === 0);
    expect(jab).toBeDefined();
    expect(jab!.victim).toBeLessThanOrEqual(HITSTOP.light * 1.25 + 1e-6);
  });

  it('let a launch hold only a little longer, so every juggle is timed as it was', () => {
    expect(BIG_LAUNCH_MOST).toBeLessThanOrEqual(.05);
  });
});

describe('the strike (Fighter.animeWarp)', () => {
  const contacts = [.5], D = 1.1, hold = .05;
  it('lands every contact on its own time, never runs backwards and ends where the move ends', () => {
    let last = -1;
    for (let i = 0; i <= 1100; i++) {
      const t = i / 1000, w = Fighter.animeWarp(t, contacts, D, hold);
      expect(w, `t ${t}`).toBeGreaterThanOrEqual(last - 1e-9);
      last = w;
    }
    expect(Fighter.animeWarp(.5, contacts, D, hold)).toBeCloseTo(.5, 9);
    expect(Fighter.animeWarp(D, contacts, D, hold)).toBeCloseTo(D, 9);
    expect(Fighter.animeWarp(0, contacts, D, hold)).toBeCloseTo(0, 9);
  });
  it('drives the last of the strike in a frame or two, then holds the contact pose', () => {
    const before = Fighter.animeWarp(.5 - 2 / 60, contacts, D, hold);
    expect(.5 - before, 'most of the drive is left for the snap').toBeGreaterThan(.1);
    expect(Fighter.animeWarp(.5 + hold * .9, contacts, D, hold)).toBeCloseTo(.5, 9);
  });
  it('leaves a barrage tick with no room for a beat as it was', () => {
    const ticks = [.3, .36, .42, .48];
    for (const t of [.31, .37, .44]) expect(Fighter.animeWarp(t, ticks, .8, hold)).toBeCloseTo(t, 9);
  });
});

describe('the colour pass (look/roanPass.ts)', () => {
  it('lights the fighters more and leaves the tuned table as it was', () => {
    const before = JSON.stringify(STAGE_LOOKS['chunin-exam-room']);
    const look = lookFor('chunin-exam-room');
    expect(JSON.stringify(STAGE_LOOKS['chunin-exam-room']), 'the source table is not touched').toBe(before);
    expect(look.toon.key).toBeGreaterThanOrEqual(.9);
    expect(look.toon.clip?.[1]).toBeGreaterThan(.74);
    expect(look.toon.saturation).toBeGreaterThan(1);
  });
  it('keeps the floor under the fight off white on the bright stages, graded once and true to its value', () => {
    for (const stage of ['chunin-exam-room', 'kami-lookout', 'enies-lobby', 'martial-arts-tournament'] as const) {
      const ground = lookFor(stage).ground;
      expect(ground, stage).toBeDefined();
      expect(ground!.max, stage).toBeLessThanOrEqual(.8);
      expect(ground!.gain, stage).toBeGreaterThan(.5);
      expect(ground!.amount, stage).toBe(1);
    }
  });
  it('turns the training hall away from its single orange cast', () => {
    const tint = new THREE.Color(lookFor('chunin-exam-room').albedo!.tint), hsl = { h: 0, s: 0, l: 0 };
    tint.getHSL(hsl);
    expect(hsl.h * 360, 'a green-teal stone, not amber').toBeGreaterThan(90);
    expect(hsl.h * 360).toBeLessThan(220);
  });
});

describe('a one-on-one keeps the over-the-shoulder camera (side-on duels rolled back)', () => {
  it('holds the heading near the line to the opponent through a calm duel', () => {
    const brain = new CameraBrain();
    const i = brainInput(), foe = subject(); foe.id = 'b'; foe.target = true; foe.x = 0; foe.z = 4;
    Object.assign(i, { subjects: [foe], count: 1, dt: 1 / 60, heading: 0 });
    for (let f = 0; f < 240; f++) brain.think(i);
    expect(brain.mode).toBe('duel');
    expect(Math.abs(Math.atan2(Math.sin(brain.goal), Math.cos(brain.goal)))).toBeLessThan(.85);
    expect('sideOn' in brain).toBe(false);
  });
});

describe("an ultimate's cinema (FinisherCuts; the owner, 8 October 2026)", () => {
  const body = (id: string, fighter: FighterId, x: number, z: number) => {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    return { group, state: { id, fighter, alive: true, action: 'idle', actionTime: 0, actionDuration: 0, actionSeq: 1, actionStarted: 0, awakened: false, target: null as string | null, confirmedAt: undefined as number | undefined } } as unknown as Fighter;
  };
  const gameplay = (camera: THREE.PerspectiveCamera, at: THREE.Vector3) => {
    camera.position.set(at.x - .9, 2.3, at.z - 4.4); camera.up.set(0, 1, 0); camera.lookAt(at.x, 1.2, at.z + 2.2); camera.fov = 50; camera.updateMatrixWorld();
  };
  const play = (cuts: FinisherCuts, thrower: Fighter, crowd: Map<string, Fighter>, occluders: THREE.Object3D[] = []) => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), move = MOVES[thrower.state.fighter].ultimate, D = move.duration;
    Object.assign(thrower.state, { action: 'ultimate', actionDuration: D, target: 'b', confirmedAt: undefined });
    const frames: { t: number; on: boolean; kind: string; eye: THREE.Vector3; look: THREE.Vector3; bars: number; grade: number; given: THREE.Vector3 }[] = [];
    const end = Math.round((D + 1.6) * 60);
    for (let f = 0; f <= end; f++) {
      const t = f / 60;
      if (t >= D) thrower.state.action = 'idle';
      thrower.state.actionTime = Math.min(1, t / D);
      if (t >= move.contacts[0]) thrower.state.confirmedAt = 1;
      gameplay(camera, thrower.group.position);
      const given = camera.position.clone();
      const on = cuts.apply(1 / 60, camera, thrower, crowd, occluders);
      camera.updateMatrixWorld();
      frames.push({ t, on, kind: cuts.kind, eye: camera.position.clone(), look: camera.getWorldDirection(new THREE.Vector3()), bars: cuts.bars, grade: cuts.grade, given });
    }
    return frames;
  };
  it('films a hit-confirmed ultimate in one move from where the view is, holds the finisher and gives the view back', () => {
    const zoro = body('a', 'zoro', 0, 0), victim = body('b', 'goku', 0, 2.2), crowd = new Map([['a', zoro], ['b', victim]]);
    const cuts = new FinisherCuts(); cuts.enabled = true;
    const frames = play(cuts, zoro, crowd), move = MOVES.zoro.ultimate, last = move.contacts[move.contacts.length - 1];
    expect(frames.filter(f => f.t < move.contacts[0] - .01).every(f => !f.on)).toBe(true);
    const first = frames.findIndex(f => f.on);
    expect(frames[first].eye.distanceTo(frames[first].given)).toBeLessThan(1e-6);
    let most = 0, turn = 0;
    for (let i = first + 1; i < frames.length && frames[i].on; i++) {
      most = Math.max(most, frames[i].eye.distanceTo(frames[i - 1].eye));
      turn = Math.max(turn, frames[i].look.angleTo(frames[i - 1].look) * 60);
    }
    expect(most, 'metres a frame').toBeLessThan(.35);
    expect(turn, 'radians a second').toBeLessThan(7);
    const landed = frames.find(f => f.kind === 'hold')!;
    expect(landed.t).toBeLessThanOrEqual(last + 1e-6);
    expect(landed.eye.y).toBeLessThan(2);
    const kinds = [...new Set(frames.filter(f => f.on).map(f => f.kind))];
    expect(kinds).toEqual(['glide', 'hold', 'out']);
    const after = frames.filter(f => f.t > last && !f.on);
    expect(after.length).toBeGreaterThan(0);
    expect(after[0].t - last).toBeLessThan(1.25);
    for (const f of after) expect(f.eye.distanceTo(f.given)).toBeLessThan(1e-6);
  });
  it('frames it in thin bars and a grade punched on the confirm and on the finisher', () => {
    const killua = body('a', 'killua', 0, 0), victim = body('b', 'goku', 0, 2.2), crowd = new Map([['a', killua], ['b', victim]]);
    const cuts = new FinisherCuts(); cuts.enabled = true;
    const frames = play(cuts, killua, crowd), move = MOVES.killua.ultimate, last = move.contacts[move.contacts.length - 1];
    expect(Math.max(...frames.map(f => f.bars))).toBeGreaterThan(.99);
    const open = frames.find(f => f.grade > 0)!;
    expect(open.grade, 'the punch on the confirm').toBeGreaterThan(.9);
    const before = frames.filter(f => f.t > open.t + .5 && f.t < last - .02).map(f => f.grade), hit = frames.filter(f => f.t >= last && f.t < last + .1).map(f => f.grade);
    expect(Math.max(...hit), 'the punch on the finisher').toBeGreaterThan(Math.max(...before) + .2);
    expect(frames[frames.length - 1].bars).toBe(0);
    expect(frames[frames.length - 1].grade).toBe(0);
    expect(cuts.opened).toBe(1); expect(cuts.struck).toBe(1);
  });
  it('holds Nami, the target and the storm crown in the settled thunder shot', () => {
    for (const aspect of [16 / 9, 16 / 10]) {
      const nami = body('a', 'nami', 0, 0), victim = body('b', 'goku', 0, 2.5);
      const crowd = new Map([['a', nami], ['b', victim]]), camera = new THREE.PerspectiveCamera(50, aspect, .1, 200);
      const cuts = new FinisherCuts(); cuts.enabled = true;
      const move = MOVES.nami.ultimate, last = move.contacts.at(-1)!;
      Object.assign(nami.state, { action: 'ultimate', actionDuration: move.duration, target: 'b', confirmedAt: 1 });
      for (let frame = 0; frame <= Math.floor((last + .4) * 60); frame++) {
        const t = frame / 60; nami.state.actionTime = t / move.duration;
        gameplay(camera, nami.group.position); cuts.apply(1 / 60, camera, nami, crowd, []); camera.updateMatrixWorld();
        if (t < last - .08) continue;
        for (const [label, point] of [['Nami', new THREE.Vector3(0, 1.6, 0)], ['victim', new THREE.Vector3(0, 1.6, 2.5)], ['cloud crown', new THREE.Vector3(0, 3.5, 2.5)]] as const) {
          point.project(camera);
          expect(Math.abs(point.x), `${label} width at ${t}`).toBeLessThan(.85);
          expect(point.y, `${label} below HUD at ${t}`).toBeLessThan(.7);
          expect(point.y, `${label} above skill strip at ${t}`).toBeGreaterThan(-.65);
        }
      }
    }
  });
  it('keeps its path out of a wall: round the other side, nearer, or the view\'s own push-in', () => {
    const zoro = body('a', 'zoro', 0, 0), victim = body('b', 'goku', 0, 2.2), crowd = new Map([['a', zoro], ['b', victim]]);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(.4, 8, 30), new THREE.MeshBasicMaterial()); wall.position.set(-1.6, 4, 1); wall.updateMatrixWorld();
    const cuts = new FinisherCuts(); cuts.enabled = true;
    const frames = play(cuts, zoro, crowd, [wall]);
    const ray = new THREE.Raycaster();
    for (const f of frames.filter(g => g.on && g.kind !== 'out')) {
      expect(f.eye.x).toBeGreaterThan(-1.4);
      const to = new THREE.Vector3(0, 1.2, 1.4).sub(f.eye), length = to.length();
      ray.set(f.eye, to.normalize()); ray.far = length;
      expect(ray.intersectObject(wall).length).toBe(0);
    }
  });
  it("gives an opponent's ultimate that confirmed on the player the bars and the grade, but leaves the player's view alone", () => {
    const me = body('b', 'goku', 0, 2.2), them = body('a', 'sukuna', 0, 0), crowd = new Map([['a', them], ['b', me]]);
    const cuts = new FinisherCuts(); cuts.enabled = true;
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), move = MOVES.sukuna.ultimate;
    Object.assign(them.state, { action: 'ultimate', actionDuration: move.duration, actionTime: (move.contacts[0] + .3) / move.duration, target: 'b', confirmedAt: 1 });
    let bars = 0, filmed = false;
    for (let f = 0; f < 30; f++) { gameplay(camera, me.group.position); filmed ||= cuts.apply(1 / 60, camera, me, crowd, []); bars = cuts.bars; }
    expect(bars).toBeGreaterThan(.99);
    expect(cuts.openedKind).toBe('theirs');
    expect(filmed).toBe(false);
    const quiet = new FinisherCuts(); quiet.enabled = true; quiet.arena = false;
    for (let f = 0; f < 30; f++) quiet.apply(1 / 60, camera, me, crowd, []);
    expect(quiet.bars).toBe(0);
  });
  it('gives a charge (an ultimate with nothing to confirm) the bars from its cast, the camera left to the director', () => {
    const goku = body('a', 'goku', 0, 0), victim = body('b', 'zoro', 0, 6), crowd = new Map([['a', goku], ['b', victim]]);
    const cuts = new FinisherCuts(); cuts.enabled = true;
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), D = MOVES.goku.ultimate.duration;
    Object.assign(goku.state, { action: 'ultimate', actionDuration: D, actionTime: .2 / D, target: 'b' });
    let filmed = false;
    for (let f = 0; f < 30; f++) { gameplay(camera, goku.group.position); filmed ||= cuts.apply(1 / 60, camera, goku, crowd, []); }
    expect(cuts.bars).toBeGreaterThan(.99); expect(cuts.openedKind).toBe('charge'); expect(filmed).toBe(false);
  });
  it('does nothing when it is not turned on', () => {
    const cuts = new FinisherCuts(), zoro = body('a', 'zoro', 0, 0);
    Object.assign(zoro.state, { action: 'ultimate', actionDuration: 2.3, actionTime: .5, target: 'b', confirmedAt: 1 });
    expect(cuts.apply(1 / 60, new THREE.PerspectiveCamera(), zoro, new Map([['a', zoro], ['b', body('b', 'goku', 0, 2)]]), [])).toBe(false);
    expect(cuts.bars).toBe(0); expect(cuts.grade).toBe(0); expect(cuts.owns).toBe(false);
  });
});
