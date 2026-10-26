import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { InputQueue } from '../src/server/InputQueue';
import { AWAKENED_MOVES, moveFor, rushMove } from '../src/game/awakening';
import { damageScale, MOVES, RUSH_SHAPE, RUSH_STAGES, STAMINA_OVERDRAW, meleeReach } from '../src/game/moves';
import type { AttackSlot, CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

const ROSTER = Object.keys(MOVES) as FighterId[];
const RASENSHURIKEN = 'Wind Style: Rasenshuriken';
const LIGHT = { first: [.12, .24], whole: [.34, .6] }, HEAVY = { first: [.26, .5], whole: [.66, 1.02] }, SPECIAL = { first: [.5, .8], whole: [1.2, 2.34] };
const within = (value: number, [lo, hi]: number[], what: string) => {
  expect(value, what).toBeGreaterThanOrEqual(lo - 1e-9);
  expect(value, what).toBeLessThanOrEqual(hi + 1e-9);
};

describe('every non-ultimate move is on the round-3d pace', () => {
  it.each(ROSTER)('%s: lights, rush stages, heavy and special, base and awakened', fighter => {
    for (const awakened of [false, true]) {
      const form = awakened ? 'awakened ' : '';
      const light = moveFor(fighter, 'light', awakened);
      if (fighter === 'naruto') { within(light.contacts[0], [.1, .18], `${form}naruto barrage`); within(light.duration, [.5, .65], `${form}naruto barrage`); }
      else { within(light.contacts[0], LIGHT.first, `${form}${fighter} light`); within(light.duration, LIGHT.whole, `${form}${fighter} light`); }
      for (let stage = 1; stage < RUSH_STAGES; stage++) {
        const m = rushMove(fighter, stage, awakened);
        within(m.contacts[0], [.12, .28], `${form}${fighter} stage ${stage}`);
        within(m.duration, [.33, .73], `${form}${fighter} stage ${stage}`);
      }
      const heavy = moveFor(fighter, 'heavy', awakened), special = moveFor(fighter, 'special', awakened);
      within(heavy.contacts[0], HEAVY.first, `${form}${fighter} heavy`);
      within(heavy.duration, HEAVY.whole, `${form}${fighter} heavy`);
      if (special.name !== RASENSHURIKEN) {
        within(special.contacts[0], SPECIAL.first, `${form}${fighter} special`);
        within(special.duration, SPECIAL.whole, `${form}${fighter} special`);
      }
      expect(heavy.contacts[0], `${form}${fighter}: heavy later than light`).toBeGreaterThan(light.contacts[0]);
      expect(heavy.duration, `${form}${fighter}: heavy longer than light`).toBeGreaterThan(light.duration);
      expect(heavy.damage, `${form}${fighter}: heavy harder than light`).toBeGreaterThan(light.damage);
      if (special.name !== RASENSHURIKEN) expect(special.contacts[0], `${form}${fighter}: special after the heavy's blow`).toBeGreaterThan(heavy.contacts[0]);
      for (const [slot, m] of [['light', light], ['heavy', heavy], ['special', special]] as const) {
        m.contacts.forEach((c, i) => { expect(c, `${fighter} ${slot}`).toBeGreaterThan(i ? m.contacts[i - 1] : 0); });
        expect(m.duration - m.contacts[m.contacts.length - 1], `${form}${fighter} ${slot} end lag`).toBeGreaterThan(.15);
      }
    }
  });

  it('cools the lights in their own length, the heavies in a second or so, the specials in four and a half', () => {
    for (const fighter of ROSTER) {
      const { light, heavy, special } = MOVES[fighter];
      expect(light.cooldown, fighter).toBeLessThanOrEqual(light.duration + .03);
      within(heavy.cooldown, [.95, 1.3], `${fighter} heavy cooldown`);
      if (special.name !== RASENSHURIKEN) within(special.cooldown, [4.2, 4.7], `${fighter} special cooldown`);
    }
  });

  it('leaves the Rasenshuriken exactly as the owner approved it', () => {
    expect(MOVES.naruto.special).toMatchObject({ name: RASENSHURIKEN, duration: 1.35, contacts: [.5], damage: 125, cooldown: 5.5, stamina: 28, speed: 24, style: 'projectile' });
  });

  it('re-times only what the awakened forms re-time: Kurama\'s fang, on its clip\'s share, and the Attack Titan, another body on its own clock', () => {
    const retimed: string[] = [];
    for (const [fighter, slots] of Object.entries(AWAKENED_MOVES)) for (const [slot, change] of Object.entries(slots ?? {}))
      if (slot !== 'ultimate' && (change?.duration !== undefined || change?.contacts !== undefined)) retimed.push(`${fighter} ${slot}`);
    expect(retimed.sort()).toEqual(['eren area', 'eren heavy', 'eren light', 'eren special', 'naruto heavy']);
    expect(moveFor('eren', 'light', true)).toMatchObject({ name: 'Titan Fist', duration: .44, contacts: [.168] });
    expect(moveFor('eren', 'special', true)).toMatchObject({ name: 'Hardened Fist', duration: 1.25, contacts: [.725] });
    expect(moveFor('eren', 'light', false)).toMatchObject({ duration: MOVES.levi.light.duration, contacts: MOVES.levi.light.contacts });
    const fang = moveFor('naruto', 'heavy', true);
    expect(fang.contacts[0] / fang.duration).toBeCloseTo(.49 / 1.04, 2);
  });
});

function bout(fighter: FighterId, stamina?: number) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 9 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'goku', 'B', false, { x: 0, y: 0, z: 1.6 });
  let seq = 0;
  const events: CombatEvent[] = [];
  const mine = (kind: CombatEvent['kind']) => events.filter(e => e.kind === kind && e.actorId === 'a');
  const run = (seconds: number, press: (tick: number) => Partial<PlayerInput> | undefined) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      if (stamina !== undefined) sim.actors.get('a')!.state.stamina = Math.min(sim.actors.get('a')!.state.stamina, stamina);
      const more = press(i);
      if (more) sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', ...more });
      sim.step(); events.push(...sim.snapshot(true).events);
    }
  };
  return { sim, run, mine };
}

const REELS = (fighter: FighterId) => RUSH_SHAPE[fighter] === 'stagger' || RUSH_SHAPE[fighter] === 'spin';
function mashThenTime(fight: ReturnType<typeof bout>) {
  let landed = -1;
  return (i: number): Partial<PlayerInput> | undefined => {
    if (landed < 0 && fight.mine('hit').some(e => e.chain === RUSH_STAGES - 1)) landed = i;
    if (landed < 0) return i % 4 === 0 ? { attack: 'light' } : undefined;
    return i - landed >= 12 && (i - landed - 12) % 15 === 0 ? { attack: 'light' } : undefined;
  };
}

describe('strings and chases at the new pace', () => {
  it.each(ROSTER.filter(f => !REELS(f)))('%s: a mashed string lands every stage, a timed light chases the launch and the air string connects', fighter => {
    const fight = bout(fighter);
    fight.run(3.4, mashThenTime(fight));
    const hits = fight.mine('hit'), finisher = hits.find(e => e.chain === RUSH_STAGES - 1);
    expect(finisher?.reaction, `${fighter}: the finisher sends them off the floor`).toBe('launched');
    expect([...new Set(hits.filter(e => e.serverTime <= finisher!.serverTime).map(e => e.chain))]).toEqual([0, 1, 2, 3]);
    const [chase] = fight.mine('chase');
    expect(chase?.slot, `${fighter}: the light is the chase`).toBe('light');
    expect(hits.filter(e => e.serverTime > chase.serverTime).length, `${fighter}: the air string lands`).toBeGreaterThan(0);
  });
  it.each(ROSTER.filter(REELS))('%s: a mashed string lands every stage and leaves them reeling, and the heavy out of it lands', fighter => {
    const fight = bout(fighter);
    let heavyAt = -1;
    fight.run(2.4, i => {
      const finisher = fight.mine('hit').find(e => e.chain === RUSH_STAGES - 1);
      if (finisher && heavyAt < 0) { heavyAt = i; return { attack: 'heavy' }; }
      return heavyAt < 0 && i % 4 === 0 ? { attack: 'light' } : undefined;
    });
    const hits = fight.mine('hit'), finisher = hits.find(e => e.chain === RUSH_STAGES - 1)!;
    expect([...new Set(hits.filter(e => e.serverTime <= finisher.serverTime).map(e => e.chain))]).toEqual([0, 1, 2, 3]);
    expect(finisher.reaction, `${fighter}: standing`).toBe('hurt');
    expect(finisher.outcome, `${fighter}: reeling`).toBe(RUSH_SHAPE[fighter]);
    expect(fight.mine('chase'), `${fighter}: nothing to chase`).toEqual([]);
    const heavy = hits.find(e => e.slot === 'heavy');
    expect(heavy, `${fighter}: the heavy cancelled out of the finisher lands`).toBeDefined();
    expect(fight.sim.getPlayer('b')!.hp).toBeLessThan(1000 - hits.filter(e => e.slot === 'light').reduce((s, e) => s + e.damage!, 0));
  });
});

describe('each fighter plays at a tempo of their own', () => {
  const light = (f: FighterId) => MOVES[f].light, heavy = (f: FighterId) => MOVES[f].heavy;
  const single = ROSTER.filter(f => f !== 'naruto');
  it('gives the quick fighters the quickest, lightest lights and strings, and the heavy ones the slowest and hardest', () => {
    for (const f of ['killua', 'sanji'] as FighterId[]) {
      expect(light(f).contacts[0], `${f}: quick`).toBeLessThanOrEqual(Math.min(...single.filter(o => o !== 'killua' && o !== 'sanji').map(o => light(o).contacts[0])) - .01);
      expect(light(f).damage, `${f}: light`).toBeLessThanOrEqual(Math.min(...single.filter(o => o !== 'killua' && o !== 'sanji').map(o => light(o).damage)) - 1);
      expect(rushMove(f, 3, false).contacts[0], `${f}: a quick string`).toBeLessThan(rushMove('goku', 3, false).contacts[0]);
    }
    for (const f of ['guts', 'jotaro'] as FighterId[]) {
      expect(light(f).contacts[0], `${f}: heavy`).toBeGreaterThanOrEqual(.19);
      expect(light(f).damage, `${f}: hard`).toBeGreaterThanOrEqual(23);
      expect(rushMove(f, 3, false).contacts[0], `${f}: a slow string`).toBeGreaterThan(rushMove('goku', 3, false).contacts[0]);
    }
    expect(heavy('luffy').damage).toBeGreaterThan(heavy('goku').damage + 10);
    const gatling = MOVES.luffy.special, fists = gatling.contacts.map((_, i) => Math.round((i === gatling.contacts.length - 1 ? gatling.finisherDamage! : gatling.damage) * damageScale(i + 1)));
    expect(fists.reduce((a, b) => a + b, 0)).toBeGreaterThan(MOVES.goku.special.damage);
    expect(heavy('guts').damage).toBeGreaterThan(heavy('luffy').damage);
    expect(heavy('guts').contacts[0]).toBeGreaterThanOrEqual(Math.max(...ROSTER.map(f => heavy(f).contacts[0])));
  });
  it('keeps weapon reach beyond unarmed Goku and his contact tempo in the middle', () => {
    const reach = (f: FighterId) => meleeReach(f, 'light', light(f));
    for (const f of ['zoro', 'law', 'mihawk', 'nami'] as FighterId[])
      expect(reach(f), `${f}: weapon reach`).toBeGreaterThan(reach('goku'));
    const contacts = single.map(f => light(f).contacts[0]).sort((a, b) => a - b);
    expect(light('goku').contacts[0]).toBeGreaterThanOrEqual(contacts[3]);
    expect(light('goku').contacts[0]).toBeLessThanOrEqual(contacts[contacts.length - 4]);
  });
  it('spreads the pace and the damage across the roster', () => {
    const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
    expect(spread(single.map(f => light(f).contacts[0])), 'lights, first contact').toBeGreaterThanOrEqual(.1);
    expect(spread(ROSTER.map(f => heavy(f).contacts[0])), 'heavies, first contact').toBeGreaterThanOrEqual(.2);
    expect(spread(single.map(f => light(f).damage)), 'lights, damage').toBeGreaterThanOrEqual(10);
    expect(spread(ROSTER.map(f => heavy(f).damage)), 'heavies, damage').toBeGreaterThanOrEqual(18);
    expect(spread(ROSTER.map(f => MOVES[f].special.damage * MOVES[f].special.contacts.length)), 'specials, damage').toBeGreaterThanOrEqual(20);
    expect(ROSTER.filter(f => heavy(f).outcome === 'launch').length).toBeLessThanOrEqual(4);
    expect(new Set(ROSTER.map(f => heavy(f).outcome ?? 'none')).size).toBeGreaterThanOrEqual(6);
    expect(new Set(ROSTER.map(f => RUSH_SHAPE[f])).size).toBe(6);
  });
});

describe('stamina gates the dash, the guard and the heavy, never a string, a chase or a special', () => {
  it('is switched on', () => expect(STAMINA_OVERDRAW).toBe(true));
  it.each(['zoro', 'goku', 'naruto', 'guts'] as FighterId[])('%s: on an empty bar the string, its chase and the special still come out', fighter => {
    const fight = bout(fighter, 0);
    fight.run(3.4, mashThenTime(fight));
    expect(fight.mine('rejected').filter(e => e.reason === 'stamina'), 'nothing refused').toEqual([]);
    expect(fight.mine('hit').some(e => e.chain === RUSH_STAGES - 1), 'the finisher landed').toBe(true);
    expect(fight.mine('chase'), 'and was chased').toHaveLength(1);
    const special = bout(fighter, 0);
    special.run(.1, i => i === 0 ? { attack: 'special' } : undefined);
    expect(special.mine('cast').map(e => e.slot), 'the special on an empty bar').toEqual(['special']);
    expect(special.sim.getPlayer('a')!.stamina, 'spending what there was').toBe(0);
  });
  it('still refuses a heavy the bar cannot pay for', () => {
    const fight = bout('zoro', 5);
    fight.run(.1, i => i === 0 ? { attack: 'heavy' } : undefined);
    expect(fight.mine('rejected').map(e => [e.slot, e.reason])).toEqual([['heavy', 'stamina']]);
    expect(fight.mine('cast')).toEqual([]);
  });
});

function wan(fighter: FighterId, press: (tick: number, local: ArenaSimulation) => Partial<PlayerInput> | undefined, ticks: number, gap = 1.6, stamina?: number) {
  const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
  server.addPlayer('me', fighter, 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('foe', 'goku', 'Foe', false, { x: 0, y: 0, z: gap });
  const prediction = new Prediction(), queue = new InputQueue();
  prediction.start('me', server.snapshot(true, true));
  const local = () => (prediction as unknown as { sim: ArenaSimulation }).sim;
  const upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
  const kinds = new Set<string>();
  let worst = 0;
  try {
    for (let tick = 0; tick < ticks; tick++) {
      if (stamina !== undefined) { server.actors.get('me')!.state.stamina = Math.min(server.actors.get('me')!.state.stamina, stamina); local().actors.get('me')!.state.stamina = Math.min(local().actors.get('me')!.state.stamina, stamina); }
      const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', ...press(tick, local()) };
      prediction.submit(input); upload.push({ tick: tick + 9, input });
      while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
      const next = queue.take(); if (next) server.submitInput('me', next);
      server.step(1 / 60, new Set(next ? [] : ['me']));
      if (tick % 2 === 0) {
        const snapshot = server.snapshot(true, true);
        for (const e of snapshot.events) if (e.actorId === 'me') kinds.add(`${e.kind}:${e.slot ?? ''}`);
        download.push({ tick: tick + 9, s: snapshot });
      }
      while (download.length && download[0].tick <= tick) {
        const before = prediction.diagnostics.position!; prediction.reconcile(download.shift()!.s); const after = prediction.diagnostics.position!;
        worst = Math.max(worst, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
      }
    }
  } finally { prediction.stop(); server.dispose(); }
  return { worst, kinds };
}

describe('rollback at the new pace', () => {
  it.each([['goku', 3.2], ['naruto', 4.2], ['zoro', 3.6], ['kakashi', 1.2]] as [FighterId, number][])(
    '%s replays its re-timed heavy from %s m under WAN batching without a correction', (fighter, gap) => {
      const { worst, kinds } = wan(fighter, tick => tick === 5 ? { attack: 'heavy' as AttackSlot } : undefined, 150, gap);
      expect(kinds.has('hit:heavy'), 'the heavy landed on the server').toBe(true);
      expect(worst).toBeLessThan(.001);
    });

  it.each(ROSTER)('%s replays a string and its chase thrown on an empty bar without a correction', fighter => {
    const reels = REELS(fighter);
    let finisher = -1;
    const { worst, kinds } = wan(fighter, (tick, local) => {
      const s = local.actors.get('me')!.state;
      if (finisher < 0 && s.action === 'light' && s.chain === 3) finisher = tick;
      return finisher < 0 ? (tick % 4 === 0 ? { attack: 'light' as AttackSlot } : undefined)
        : tick === finisher + 30 || tick === finisher + 45 ? { attack: reels ? 'heavy' as AttackSlot : 'light' as AttackSlot } : undefined;
    }, 280, 1.6, 0);
    if (reels) expect(kinds.has('hit:light'), 'the string landed on the server').toBe(true);
    else expect(kinds.has('chase:light'), 'the server chased on the light').toBe(true);
    expect([...kinds].some(k => k === 'rejected:light'), 'and refused nothing').toBe(false);
    expect(worst).toBeLessThan(.001);
  });
  it.each([['jotaro', 'heavy', 3], ['law', 'heavy', 1.6], ['kakashi', 'heavy', 1.6], ['ichigo', 'heavy', 1.6], ['sanji', 'heavy', 1.4], ['luffy', 'heavy', 1.6]] as [FighterId, AttackSlot, number][])(
    '%s replays its %s\'s outcome without a correction', (fighter, slot, gap) => {
      const { worst, kinds } = wan(fighter, tick => tick === 5 ? { attack: slot } : undefined, 150, gap);
      expect(kinds.has(`hit:${slot}`), 'it landed on the server').toBe(true);
      expect(worst).toBeLessThan(.001);
    });
});
