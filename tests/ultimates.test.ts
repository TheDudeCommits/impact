import { describe, expect, it } from 'vitest';
import { Packr, unpack } from 'msgpackr';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { moveFor } from '../src/game/awakening';
import { activeWindow, damageScale, JUST_GUARD_WINDOW, MOVES, WHIFF_RECOVERY, type MoveDefinition } from '../src/game/moves';
import { barrageWindow } from '../src/game/timeStopBarrage';
import type { CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

const wire = <T>(value: T): T => unpack(new Packr({ useRecords: false }).pack(value)) as T;
const ROSTER = Object.keys(MOVES) as FighterId[];
const CONFIRM = ROSTER.filter(f => MOVES[f].ultimate.confirm);
const AREA = ROSTER.filter(f => !MOVES[f].ultimate.confirm);
const STOPS = CONFIRM.filter(f => MOVES[f].ultimate.timeStop);
const DT = 1 / 60;

function realised(move: MoveDefinition) {
  const first = move.timeStop ? move.timeStop.contact + 1 : 0, last = move.contacts.length - 1;
  let sum = 0;
  for (let i = first, n = 1; i <= last; i++, n++) sum += Math.max(1, Math.round((move.schedule?.[i] ?? (i === last ? move.finisherDamage ?? move.damage : move.damage)) * damageScale(n)));
  return sum;
}

function duel(fighter: FighterId, gap = 2, opts: { behind?: boolean; third?: { fighter: FighterId; x: number; z: number }; seed?: number } = {}) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: opts.seed ?? 3 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', fighter === 'goku' ? 'vegeta' : 'goku', 'B', false, { x: 0, y: 0, z: opts.behind ? -gap : gap });
  if (opts.third) sim.addPlayer('c', opts.third.fighter, 'C', false, { x: opts.third.x, y: 0, z: opts.third.z });
  sim.actors.get('a')!.state.ultimate = 100;
  const seq: Record<string, number> = { a: 0, b: 0, c: 0 };
  const events: CombatEvent[] = [];
  const tick = (inputs: Record<string, Partial<PlayerInput>> = {}) => {
    for (const [id, more] of Object.entries(inputs)) sim.submitInput(id, { seq: seq[id]++, moveX: 0, moveZ: 0, yaw: id === 'a' ? 0 : Math.PI, ...more });
    sim.step(DT);
    events.push(...sim.drainEvents());
  };
  const press = (more: Partial<PlayerInput> = {}) => tick({ a: { attack: 'ultimate', targetId: opts.behind ? null : 'b', ...more } });
  const run = (seconds: number, inputs: () => Record<string, Partial<PlayerInput>> = () => ({})) => { for (let i = 0; i < Math.round(seconds / DT); i++) tick(inputs()); };
  const cast = () => events.find(e => e.kind === 'cast' && e.actorId === 'a' && e.slot === 'ultimate')!;
  const of = (kind: string, actorId = 'a') => events.filter(e => e.kind === kind && e.actorId === actorId);
  return { sim, tick, press, run, events, cast, of, hp: (id: string) => sim.getPlayer(id)!.hp };
}

describe('the opener lands within about half a second of the press', () => {
  it.each(CONFIRM)('%s', fighter => {
    const { press, run, events, cast, sim } = duel(fighter);
    const move = MOVES[fighter].ultimate;
    press(); run(1.2);
    const at = cast().serverTime;
    if (move.timeStop) {
      const stop = events.find(e => e.kind === 'release' && e.actorId === 'a' && e.contactIndex === move.timeStop!.contact)!;
      expect(stop.serverTime - at).toBeGreaterThanOrEqual(.35);
      expect(stop.serverTime - at).toBeLessThanOrEqual(fighter === 'gojo' || fighter === 'sukuna' ? .7 : .6);
    } else {
      const first = events.find(e => e.kind === 'hit' && e.actorId === 'a' && e.targetId === 'b')!;
      expect(first, 'it lands').toBeDefined();
      expect(first.serverTime - at, `${move.name} lands ${(first.serverTime - at).toFixed(3)} s after the press`).toBeGreaterThanOrEqual(.35);
      expect(first.serverTime - at).toBeLessThanOrEqual(.6);
    }
    const confirm = events.find(e => e.kind === 'confirm' && e.actorId === 'a')!;
    expect(confirm, 'and confirms').toBeDefined();
    expect(confirm.targetId).toBe('b');
    expect(confirm.serverTime - at, 'decided as soon as it has landed').toBeLessThanOrEqual(.7);
    sim.dispose();
  });

  it('every one of them is shorter than it was, by a second and more', () => {
    const before: Partial<Record<FighterId, number>> = { zoro: 4.9, jotaro: 4.8, ichigo: 5.2, kakashi: 3.7, sasuke: 4.5, sanji: 4.4, vegeta: 4.8, goku: 4.9,
      luffy: 7.8, naruto: 2.85, ace: 4.6, law: 4.4, gojo: 4.8, dio: 4.8, guts: 4.8, killua: 4.4,
      kaido: 4.6, whitebeard: 4.6, shanks: 4.4, roger: 4.4, aizen: 4.4, sukuna: 4.4, griffith: 4.4, meruem: 4.4, 'goku-black': 4.4, jiren: 4.4, 'golden-frieza': 4.4, 'gohan-beast': 4.4, saitama: 4.4, akaza: 4.4, itachi: 4.4, madara: 4.4, tanjiro: 4.4, levi: 4.4, 'sung-jinwoo': 4.4, gon: 4.4 };
    for (const f of Object.keys(before) as FighterId[]) expect(MOVES[f].ultimate.duration, f).toBeLessThanOrEqual(before[f]! - .8);
    for (const f of CONFIRM) expect(MOVES[f].ultimate.duration, f).toBeLessThanOrEqual(f === 'dio' ? 3.55 : 3.3);
  });
});

describe('confirmed: the victim is held and the cinematic plays out on them', () => {
  it.each(CONFIRM)('%s', fighter => {
    const { press, run, events, of, hp, sim } = duel(fighter);
    const move = MOVES[fighter].ultimate;
    press();
    let guard = 0;
    while (!of('confirm').length && guard++ < 90) run(DT);
    expect(of('confirm')).toHaveLength(1);
    expect(sim.getPlayer('b')!.heldBy).toBe('a');
    expect(sim.getPlayer('a')!.confirmedAt).toBe(of('confirm')[0].serverTime);
    const pinned = sim.getPlayer('b')!;
    const finisherAt = () => events.find(e => e.kind === 'hit' && e.actorId === 'a' && e.targetId === 'b' && e.contactIndex === move.contacts.length - 1);
    let ticks = 0;
    while (!finisherAt() && ticks++ < 60 * 5) {
      run(DT, () => ({ b: { moveX: 1, moveZ: -1, dash: ticks % 7 === 0, jump: ticks % 11 === 0, attack: ticks % 5 === 0 ? 'light' : undefined } }));
      if (finisherAt()) break;
      const b = sim.getPlayer('b')!;
      expect(b.heldBy, `held at tick ${ticks}`).toBe('a');
      if (move.timeStop && !b.timeStopped) continue;
      expect(Math.hypot(b.x - pinned.x, b.z - pinned.z), 'pinned where the opener caught them').toBeLessThan(1e-6);
      if (!move.timeStop) expect(['light', 'heavy', 'special', 'ultimate', 'dash', 'run', 'idle', 'jump', 'guard']).not.toContain(b.action);
    }
    expect(finisherAt(), 'the finisher lands').toBeDefined();
    expect(sim.getPlayer('b')!.heldBy, 'and lets them go').toBeUndefined();
    expect(of('cast', 'b'), 'the victim never got a move out').toHaveLength(0);
    expect(1000 - hp('b'), 'every contact of the move landed').toBe(realised(move));
    run(move.duration);
    expect(sim.getPlayer('a')!.action).not.toBe('ultimate');
    expect(sim.getPlayer('a')!.confirmedAt, 'the mark goes with the cast').toBeUndefined();
    expect(of('whiff')).toHaveLength(0);
    sim.dispose();
  });

  it('a held guard does not stop the confirm: the opener breaks it', () => {
    for (const fighter of CONFIRM.filter(f => !MOVES[f].ultimate.timeStop)) {
      const { tick, press, run, of, sim } = duel(fighter);
      for (let i = 0; i < 20; i++) tick({ b: { guard: true } });
      press();
      run(1.2, () => ({ b: { guard: true } }));
      expect(of('guard-break').length + of('hit').length, fighter).toBeGreaterThan(0);
      expect(of('confirm'), `${fighter}: confirmed through the guard`).toHaveLength(1);
      sim.dispose();
    }
  });

  it('a guard pressed on the beat does not parry an ultimate: the opener breaks it and the cinematic holds them', () => {
    const { tick, press, run, of, events, sim } = duel('sanji', 1.6);
    const move = MOVES.sanji.ultimate;
    press();
    const waitFor = Math.round((move.contacts[0] - JUST_GUARD_WINDOW * .5) / DT) - 1;
    for (let i = 0; i < waitFor; i++) tick();
    run(1, () => ({ b: { guard: true } }));
    expect(events.some(e => e.kind === 'just-guard' && e.targetId === 'b'), 'no parry').toBe(false);
    expect(of('guard-break'), 'the guard is broken').toHaveLength(1);
    expect(of('confirm'), 'and the cinematic plays').toHaveLength(1);
    expect(sim.getPlayer('b')!.heldBy).toBe('a');
    sim.dispose();
  });

  it('holds everyone the opener caught - a beam through two bodies holds both, the target first', () => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
    sim.addPlayer('a', 'vegeta', 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 6 });
    sim.addPlayer('c', 'naruto', 'C', false, { x: .3, y: 0, z: 3 });
    sim.actors.get('a')!.state.ultimate = 100;
    const events: CombatEvent[] = [];
    for (let i = 0; i < 60 * 4; i++) {
      sim.submitInput('a', { seq: i, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, attack: i === 0 ? 'ultimate' : undefined });
      sim.step(DT); events.push(...sim.drainEvents());
      if (events.some(e => e.kind === 'confirm')) {
        if (!events.some(e => e.kind === 'hit' && e.contactIndex === MOVES.vegeta.ultimate.contacts.length - 1)) {
          expect(sim.getPlayer('b')!.heldBy).toBe('a'); expect(sim.getPlayer('c')!.heldBy).toBe('a');
        }
      }
    }
    expect(events.find(e => e.kind === 'confirm')!.targetId, 'the camera frames the target').toBe('b');
    expect(1000 - sim.getPlayer('b')!.hp).toBe(realised(MOVES.vegeta.ultimate));
    expect(1000 - sim.getPlayer('c')!.hp).toBe(realised(MOVES.vegeta.ultimate));
    sim.dispose();
  });

  it('a victim caught closer than the pushbox is eased out to it, not held inside the thrower', () => {
    const { press, run, of, sim } = duel('law', 2);
    press();
    let guard = 0;
    while (!of('confirm').length && guard++ < 90) run(DT);
    const a = sim.getPlayer('a')!, b = sim.getPlayer('b')!;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(1.1);
    sim.dispose();
  });
});

describe('whiffed: a short recovery, no cinematic, the bar spent', () => {
  it.each(CONFIRM)('%s', fighter => {
    const { press, run, events, cast, of, hp, sim } = duel(fighter, 14, { behind: true });
    const move = MOVES[fighter].ultimate;
    press();
    let ended: number | undefined;
    for (let i = 0; i < 60 * 4 && ended === undefined; i++) { run(DT); if (sim.getPlayer('a')!.action !== 'ultimate') ended = sim.serverTime; }
    const at = cast().serverTime, whiff = of('whiff');
    expect(whiff, 'announced once').toHaveLength(1);
    expect(of('confirm')).toHaveLength(0);
    expect(hp('b')).toBe(1000);
    const flight = move.style === 'projectile' ? move.range / (move.speed ?? 20) : 0;
    const decided = move.contacts[0] + (move.style === 'melee' && !move.timeStop ? activeWindow(move) : 0) + flight;
    expect(whiff[0].serverTime - at).toBeLessThanOrEqual(decided + .05);
    expect(ended! - whiff[0].serverTime).toBeCloseTo(move.confirm?.recovery ?? WHIFF_RECOVERY, 1);
    expect(ended! - at, `${move.name} ends ${(ended! - at).toFixed(2)} s after the press`).toBeLessThan(1.5);
    expect(events.filter(e => e.kind === 'release' && e.actorId === 'a' && e.serverTime > whiff[0].serverTime)).toHaveLength(0);
    expect(sim.getPlayer('a')!.ultimate, 'the bar stays spent').toBe(0);
    run(DT);
    expect(sim.getPlayer('a')!.whiffedAt, 'the mark goes with the cast').toBeUndefined();
    sim.dispose();
  });

  it('the recovery is a punish window: no attack and no dash comes out of it', () => {
    const { press, run, of, sim } = duel('killua', 14, { behind: true });
    press();
    run(MOVES.killua.ultimate.contacts[0] + .15);
    expect(of('whiff')).toHaveLength(1);
    run(.2, () => ({ a: { attack: 'light', dash: true } }));
    expect(sim.getPlayer('a')!.action, 'still recovering').toBe('ultimate');
    expect(of('cast').filter(e => e.slot !== 'ultimate')).toHaveLength(0);
    sim.dispose();
  });

  it('a victim who turns and runs on the press escapes an opener that steps in', () => {
    for (const fighter of ['sanji', 'killua'] as FighterId[]) {
      const { press, run, of, hp, sim } = duel(fighter, 2.2);
      press();
      run(2, () => ({ b: { moveZ: 1, yaw: 0 } }));
      expect(of('whiff'), fighter).toHaveLength(1);
      expect(hp('b'), fighter).toBe(1000);
      sim.dispose();
    }
  });

  it('the lunging openers reach the five metres the old ultimates did', () => {
    for (const fighter of ['kakashi', 'sanji', 'zoro', 'luffy', 'guts'] as FighterId[]) {
      const { press, run, of, hp, sim } = duel(fighter, 5);
      press(); run(1);
      expect(of('confirm'), fighter).toHaveLength(1);
      expect(hp('b'), fighter).toBeLessThan(1000);
      sim.dispose();
    }
  });

  it('a time stop that catches nobody is a whiff', () => {
    for (const fighter of STOPS) {
      const { press, run, of, sim } = duel(fighter, 14, { behind: true });
      press(); run(2);
      expect(of('whiff'), fighter).toHaveLength(1);
      expect(sim.getPlayer('b')!.timeStopped).toBeFalsy();
      sim.dispose();
    }
  });
});

describe('third parties cannot interrupt or join a cinematic', () => {
  it.each(['zoro', 'vegeta', 'luffy', 'guts'] as FighterId[])('%s: a bystander\'s blows pass through the thrower and the victim until the finisher', fighter => {
    const { press, run, of, hp, sim, events } = duel(fighter, 2, { third: { fighter: 'ichigo', x: 1.4, z: 1 } });
    press();
    let guard = 0;
    while (!of('confirm').length && guard++ < 90) run(DT);
    expect(of('confirm')).toHaveLength(1);
    const beforeB = hp('b'), beforeA = hp('a');
    const finisher = () => events.some(e => e.kind === 'hit' && e.actorId === 'a' && e.contactIndex === MOVES[fighter].ultimate.contacts.length - 1);
    let n = 0;
    while (!finisher() && n++ < 60 * 4) run(DT, () => ({ c: { attack: n % 20 < 10 ? 'light' : 'heavy', targetId: n % 40 < 20 ? 'b' : 'a', yaw: Math.PI } }));
    expect(events.filter(e => e.kind === 'hit' && e.actorId === 'c'), 'nothing the bystander threw landed').toHaveLength(0);
    expect(hp('a')).toBe(beforeA);
    expect(1000 - hp('b')).toBe(realised(MOVES[fighter].ultimate));
    expect(beforeB).toBeLessThan(1000);
    sim.dispose();
  });

  it('nor does another ultimate: a Final Flash through the pair passes through both, and whiffs', () => {
    const { press, run, of, hp, sim } = duel('sanji', 2, { third: { fighter: 'vegeta', x: 7, z: 1 } });
    sim.actors.get('c')!.state.ultimate = 100;
    press();
    let guard = 0;
    while (!of('confirm').length && guard++ < 90) run(DT);
    expect(of('confirm')).toHaveLength(1);
    const hpA = hp('a');
    run(DT, () => ({ c: { attack: 'ultimate', targetId: 'a', lock: true, yaw: -Math.PI / 2 } }));
    run(2.5);
    expect(of('cast', 'c').filter(e => e.slot === 'ultimate'), 'the Final Flash went off').toHaveLength(1);
    expect(hp('a'), 'the thrower was never hit').toBe(hpA);
    expect(1000 - hp('b'), 'the victim took the cinematic and nothing else').toBe(realised(MOVES.sanji.ultimate));
    expect(of('whiff', 'c'), 'and the bystander\'s ultimate found nobody it could hold').toHaveLength(1);
    sim.dispose();
  });

  it('and the thrower is back within reach for the recovery', () => {
    const { press, run, of, hp, sim, events } = duel('law', 2, { third: { fighter: 'ichigo', x: -1.3, z: -.4 } });
    press();
    const move = MOVES.law.ultimate;
    let n = 0;
    while (!events.some(e => e.kind === 'hit' && e.actorId === 'a' && e.contactIndex === move.contacts.length - 1) && n++ < 60 * 4) run(DT);
    expect(of('confirm')).toHaveLength(1);
    const hpA = hp('a');
    run(.4, () => ({ c: { attack: 'light', targetId: 'a', yaw: Math.atan2(1.3, .4) } }));
    expect(hp('a'), 'hit in the recovery').toBeLessThan(hpA);
    sim.dispose();
  });

  it('a time stop\'s frozen victims are its own: a bystander outside the stop cannot touch them', () => {
    for (const fighter of STOPS) {
      const { press, run, of, hp, sim, events } = duel(fighter, 2, { third: { fighter: 'vegeta', x: 0, z: 14 } });
      press();
      run(MOVES[fighter].ultimate.contacts[0] + .1);
      expect(sim.getPlayer('b')!.timeStopped, fighter).toBe(true);
      expect(sim.getPlayer('c')!.timeStopped, fighter).toBeFalsy();
      run(1.2, () => ({ c: { attack: 'heavy', targetId: 'b', yaw: Math.PI } }));
      expect(events.filter(e => e.kind === 'hit' && e.actorId === 'c'), fighter).toHaveLength(0);
      run(3);
      const move = MOVES[fighter].ultimate, finisher = of('hit').find(e => e.targetId === 'b' && e.contactIndex === move.contacts.length - 1)!;
      expect(finisher, fighter).toBeDefined();
      expect(events.filter(e => e.kind === 'hit' && e.actorId === 'c' && e.serverTime <= finisher.serverTime), fighter).toHaveLength(0);
      expect(of('hit').filter(e => e.targetId === 'b').reduce((sum, e) => sum + (e.damage ?? 0), 0), fighter).toBe(realised(move));
      expect(of('confirm'), fighter).toHaveLength(1);
      sim.dispose();
    }
  });
});

describe('time stops keep their tour of every frozen victim', () => {
  it.each(STOPS.flatMap(f => [[f, false], [f, true]] as [FighterId, boolean][]))('%s (awakened %s): three caught, all three held, all three hit, the finisher on the target', (fighter, awakened) => {
    const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
    sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
    for (const [id, x, z] of [['b', 0, 2], ['c', 2.5, 1.5], ['d', -2.8, -1]] as const) sim.addPlayer(id, 'goku', id, false, { x, y: 0, z });
    const a = sim.actors.get('a')!;
    a.state.ultimate = 100;
    if (awakened) { a.state.awakened = true; a.state.awakenedUntil = 1e9; }
    const move = moveFor(fighter, 'ultimate', awakened), events: CombatEvent[] = [];
    let heldSeen = 0;
    for (let i = 0; i < 60 * 6; i++) {
      sim.submitInput('a', { seq: i, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: i === 0 ? 'ultimate' : undefined });
      sim.step(DT); events.push(...sim.drainEvents());
      if (['b', 'c', 'd'].every(id => sim.getPlayer(id)!.heldBy === 'a')) heldSeen++;
    }
    expect(heldSeen, 'all three held through the tour').toBeGreaterThan(30);
    for (const id of ['b', 'c', 'd']) expect(sim.getPlayer(id)!.hp, id).toBeLessThan(1000);
    const last = events.filter(e => e.kind === 'hit' && e.actorId === 'a' && e.contactIndex === move.contacts.length - 1);
    expect(last.map(e => e.targetId).at(-1), 'the finisher ends on the target').toBe('b');
    expect(events.find(e => e.kind === 'confirm')!.targetId).toBe('b');
    const window = barrageWindow(move);
    if (fighter !== 'gojo') expect(window, 'still one barrage for the ORA/MUDA loop').not.toBeNull();
    for (const id of ['b', 'c', 'd']) expect(sim.getPlayer(id)!.heldBy).toBeUndefined();
    sim.dispose();
  });
});

describe('the area ultimates hit everyone in the blast, sooner', () => {
  it.each(AREA)('%s', fighter => {
    const move = MOVES[fighter].ultimate;
    expect(move.style).toBe('bomb');
    const sim = new ArenaSimulation({ trainingBot: false, seed: 4 });
    sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 5 });
    sim.addPlayer('c', 'sanji', 'C', false, { x: 1.2, y: 0, z: 6 });
    sim.actors.get('a')!.state.ultimate = 100;
    const events: CombatEvent[] = [];
    for (let i = 0; i < 60 * 4; i++) {
      sim.submitInput('a', { seq: i, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: i === 0 ? 'ultimate' : undefined });
      sim.step(DT); events.push(...sim.drainEvents());
    }
    const cast = events.find(e => e.kind === 'cast')!, first = events.find(e => e.kind === 'hit')!;
    expect(first.serverTime - cast.serverTime, `first damage ${(first.serverTime - cast.serverTime).toFixed(2)} s after the press`).toBeLessThan(1.8);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    expect(sim.getPlayer('c')!.hp, 'everyone in the blast').toBeLessThan(1000);
    expect(events.some(e => e.kind === 'confirm' || e.kind === 'whiff')).toBe(false);
    sim.dispose();
  });
});

describe('deterministic, predicted and rolled back like everything else', () => {
  const scenario = (fighter: FighterId, gap: number, behind = false) => {
    const { press, run, sim } = duel(fighter, gap, { behind, third: { fighter: 'naruto', x: 3, z: -2 } });
    press(); run(4, () => ({ c: { attack: 'light', targetId: 'b' } }));
    const out = JSON.stringify(sim.snapshot().players);
    sim.dispose();
    return out;
  };
  it('the same inputs replay to the same state, landed and whiffed', () => {
    for (const fighter of ['zoro', 'sasuke', 'gojo', 'vegeta'] as FighterId[]) {
      expect(scenario(fighter, 2)).toBe(scenario(fighter, 2));
      expect(scenario(fighter, 14, true)).toBe(scenario(fighter, 14, true));
    }
  });

  it.each([['zoro', 2, false], ['sasuke', 6, false], ['jotaro', 2, false], ['luffy', 2, false], ['law', 14, true], ['sasuke', 14, true]] as [FighterId, number, boolean][])(
    '%s at %s m (behind %s): a rollback replay across the wire predicts what the server plays', (fighter, gap, behind) => {
      const server = duel(fighter, gap, { behind }).sim, prediction = new Prediction();
      prediction.start('a', wire(server.snapshot(false, true)));
      const local = (prediction as unknown as { sim: ArenaSimulation }).sim;
      const inbox: { at: number; snapshot: GameSnapshot }[] = [], queue: PlayerInput[] = [];
      const serverEvents: CombatEvent[] = [];
      let localConfirm = false, localWhiff = false, worst = 0;
      try {
        for (let seq = 0; seq < 60 * 4; seq++) {
          const input: PlayerInput = { seq, moveX: 0, moveZ: 0, yaw: 0, targetId: behind ? null : 'b', attack: seq === 0 ? 'ultimate' : undefined };
          prediction.submit(input); queue.push(input);
          while (queue.length && queue[0].seq <= seq - 3) server.submitInput('a', queue.shift()!);
          server.step(); serverEvents.push(...server.drainEvents());
          if (seq % 2 === 0) inbox.push({ at: seq + 4, snapshot: wire<GameSnapshot>(server.snapshot(false, true)) });
          while (inbox.length && inbox[0].at <= seq) prediction.reconcile(inbox.shift()!.snapshot);
          const mine = local.actors.get('a')!;
          localConfirm ||= !!mine.cast && (mine.cast as unknown as { cine?: unknown }).cine !== undefined;
          localWhiff ||= !!mine.cast && (mine.cast as unknown as { whiff?: number }).whiff !== undefined;
          if (seq > 20 && queue.length === 0) {
            const s = server.getPlayer('a')!, p = local.getPlayer('a')!;
            worst = Math.max(worst, Math.hypot(s.x - p.x, s.z - p.z));
          }
        }
        while (queue.length) server.submitInput('a', queue.shift()!);
        for (let i = 0; i < 8; i++) { server.step(); serverEvents.push(...server.drainEvents()); }
        prediction.reconcile(wire<GameSnapshot>(server.snapshot(false, true)));
        const confirmed = serverEvents.some(e => e.kind === 'confirm'), whiffed = serverEvents.some(e => e.kind === 'whiff');
        expect(confirmed, 'the server decides one way').not.toBe(whiffed);
        expect(localConfirm, 'the prediction confirmed as the server did').toBe(confirmed);
        expect(localWhiff).toBe(whiffed);
        expect(confirmed).toBe(!behind);
        if (confirmed) expect(1000 - server.getPlayer('b')!.hp).toBe(realised(MOVES[fighter].ultimate));
        expect(local.getPlayer('b')!.hp).toBe(server.getPlayer('b')!.hp);
        expect(worst, 'the predicted thrower never strays from the authoritative one').toBeLessThan(.02);
      } finally { prediction.stop(); server.dispose(); }
    });

  it('a checkpoint taken mid-cinematic carries the cinematic across the wire', () => {
    for (const fighter of ['kakashi', 'dio', 'sasuke'] as FighterId[]) {
      const source = duel(fighter), copy = duel(fighter);
      source.press(); copy.press();
      let guard = 0;
      while (!source.of('confirm').length && guard++ < 90) { source.run(DT); copy.run(DT); }
      source.run(.1); copy.run(.1);
      const checkpoint = wire(source.sim.predictionCheckpoint('a')!);
      expect((checkpoint.cast as unknown as { cine?: { ids: string[] } }).cine!.ids[0]).toBe('b');
      const snapshot = wire(source.sim.snapshot(false, true));
      for (const p of snapshot.players) Object.assign(copy.sim.actors.get(p.id)!.state, p, { cooldowns: { ...p.cooldowns } });
      for (const [id, reaction] of Object.entries(snapshot.reactions ?? {})) if (id !== 'a') Object.assign(copy.sim.actors.get(id)!, reaction);
      copy.sim.restorePrediction('a', checkpoint);
      copy.sim.serverTime = source.sim.serverTime;
      source.run(3); copy.run(3);
      expect(copy.hp('b'), fighter).toBe(source.hp('b'));
      expect(1000 - source.hp('b'), fighter).toBe(realised(MOVES[fighter].ultimate));
      source.sim.dispose(); copy.sim.dispose();
    }
  });
});

describe('a hold nobody holds is let go', () => {
  it('the thrower defeated mid-cinematic: the victim is let go on the next tick and soon on their feet', () => {
    const { press, run, of, sim } = duel('guts');
    press();
    let guard = 0;
    while (!of('confirm').length && guard++ < 90) run(DT);
    run(.2);
    expect(sim.getPlayer('b')!.heldBy).toBe('a');
    sim.damage('a', 5000, 'ring', 'ring');
    run(DT * 2);
    expect(sim.getPlayer('b')!.heldBy).toBeUndefined();
    run(.6, () => ({ b: { moveX: 1 } }));
    expect(['run', 'idle']).toContain(sim.getPlayer('b')!.action);
    sim.dispose();
  });

  it('the victim going down mid-cinematic ends their hold, and the thrower plays the move out', () => {
    const { sim, press, run, of } = duel('killua');
    sim.actors.get('b')!.state.hp = 60;
    press(); run(3);
    expect(of('confirm')).toHaveLength(1);
    expect(sim.getPlayer('b')!.alive).toBe(false);
    expect(sim.getPlayer('b')!.heldBy).toBeUndefined();
    expect(sim.getPlayer('a')!.action).not.toBe('ultimate');
    sim.dispose();
  });

  it('the practice room reset lets go too, keeping the respawn\'s protection', () => {
    const { press, run, of, sim } = duel('zoro');
    press();
    let guard = 0;
    while (!of('confirm').length && guard++ < 90) run(DT);
    sim.trainingCommand('a', 'reset');
    run(DT * 2);
    expect(sim.getPlayer('b')!.heldBy).toBeUndefined();
    expect(sim.actors.get('b')!.evadeUntil).toBeGreaterThan(sim.serverTime + 1);
    sim.dispose();
  });
});

describe('arcade survival\'s sides throw their ultimates as they always did', () => {
  it('a fighter on a side: every contact through the ordinary sweep, no hold, no whiff cut', () => {
    const { sim, press, run, of } = duel('zoro');
    sim.setTeam('a', 'party');
    press(); run(3.5);
    expect(of('confirm')).toHaveLength(0);
    expect(of('whiff')).toHaveLength(0);
    expect(sim.getPlayer('b')!.heldBy).toBeUndefined();
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    sim.dispose();
  });
});
