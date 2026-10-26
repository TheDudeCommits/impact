import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { ArenaSimulation } from '../src/game/simulation';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import {
  ATTACK_SLOTS, BUDGET_LIMIT, FIGHTER_IDS, budget, decodeForge, encodeForge, forgeHash, forgeMoves, forgeProblems, ownKit,
  simSpec, tunedMove, pickSource, type ForgeKit,
} from '../src/engine/sim';
import { forgetForgeKits, rememberForgeKits, shortForgeHash } from '../src/engine/sim/forgedKits';
import {
  ForgeSession, activeKit, armoryRuntime, moveSource, onKitChange, playerKit, presentationKit, registerArmory, registerTransplant, slotFx,
} from '../src/engine/client';

const kit = (body: FighterId, picks: Partial<Record<'light' | 'heavy' | 'special' | 'ultimate', ForgeKit['slots']['light']>>, name = 'Test Forge'): ForgeKit =>
  ({ ...ownKit(body, name), slots: { ...ownKit(body).slots, ...picks } });

describe('the Fighter Forge', () => {
  it("gives every body its own kit at exactly its own power, and finds nothing wrong with it", () => {
    for (const id of FIGHTER_IDS) {
      const own = ownKit(id, 'Own Kit');
      expect(budget(own), id).toBeCloseTo(1, 10);
      expect(forgeProblems(own), id).toEqual({ errors: [], warnings: [] });
      for (const slot of ATTACK_SLOTS) expect(forgeMoves(own)[slot], `${id} ${slot}`).toEqual(simSpec(id)!.kit.slots[slot]);
    }
  });

  it('tunes a borrowed move within its limits: power its damage, reach its range, speed its whole timing', () => {
    const hiken = simSpec('ace')!.kit.slots.special;
    const strong = tunedMove('special', { from: 'ace', tune: { power: 1.2, reach: .8, speed: 1.15 } });
    expect(strong.damage).toBe(Math.round(hiken.damage * 1.2));
    expect(strong.range).toBeCloseTo(hiken.range * .8, 2);
    expect(strong.duration).toBeCloseTo(hiken.duration / 1.15, 3);
    strong.contacts.forEach((at, i) => expect(at).toBeCloseTo(hiken.contacts[i] / 1.15, 3));
    expect(strong.cooldown).toBe(hiken.cooldown);
    expect(tunedMove('special', { from: 'ace', tune: { power: 9 } }).damage).toBe(Math.round(hiken.damage * 1.2));
    expect(forgeProblems(kit('endeavor', { special: { from: 'ace', tune: { power: 9 } } })).errors).toEqual([expect.stringMatching(/power must stay within 80-120%/)]);
    expect(simSpec('ace')!.kit.slots.special.damage).toBe(hiken.damage);
  });

  it("holds a forged kit to its body's power: the strongest moves in the game need tuning down", () => {
    const strongest = (slot: 'light' | 'heavy' | 'special' | 'ultimate') => FIGHTER_IDS.map(id => ({ id, power: budget(kit('endeavor', { [slot]: { from: id } })) }))
      .sort((a, b) => b.power - a.power)[0].id;
    const greedy = kit('endeavor', { light: { from: strongest('light') }, heavy: { from: strongest('heavy') }, special: { from: strongest('special') }, ultimate: { from: strongest('ultimate') } });
    expect(budget(greedy)).toBeGreaterThan(BUDGET_LIMIT);
    expect(forgeProblems(greedy).errors.join(' ')).toMatch(/as strong as this body's own kit/);
    const humble = kit('endeavor', { special: { from: 'ace', tune: { power: .8 } } });
    expect(budget(humble)).toBeLessThan(BUDGET_LIMIT);
    expect(forgeProblems(humble).errors).toEqual([]);
  });

  it('shares a kit as a code that survives the trip and refuses a damaged one', () => {
    const forged = kit('aokiji', { special: { from: 'todoroki', tune: { reach: 1.1 } } }, 'Glacier Admiral');
    const code = encodeForge(forged);
    expect(code).toMatch(/^JF1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    expect(decodeForge(code)).toEqual(forged);
    expect(forgeHash(decodeForge(code))).toBe(forgeHash(forged));
    const [tag, body, check] = code.split('.');
    expect(() => decodeForge(`${tag}.${body.slice(0, -2)}AA.${check}`)).toThrow(/incomplete or mistyped/);
    expect(() => decodeForge(`XX.${body}.${check}`)).toThrow(/isn't a Forge code/);
    expect(() => decodeForge('JF1.!!!.00000000')).toThrow();
    expect(forgeProblems({ ...forged, name: '<script>' }).errors[0]).toMatch(/^Name it with/);
    expect(forgeProblems({ ...forged, body: 'nobody' as FighterId }).errors[0]).toMatch(/no body called "nobody"/);
  });

  it('puts a kit in play and gives the body back exactly its own moves', () => {
    const own = { ...MOVES.endeavor }, session = new ForgeSession();
    expect(session.apply(kit('endeavor', { special: { from: 'goku' } }))).toEqual({ ok: true });
    expect(MOVES.endeavor.special.name).toBe('Kamehameha');
    expect(session.apply(kit('endeavor', { special: { from: 'goku', tune: { power: 99 } } }))).toMatchObject({ ok: false });
    expect(MOVES.endeavor.special.name).toBe('Kamehameha');
    session.apply(kit('aokiji', { heavy: { from: 'zoro' } }));
    expect(MOVES.endeavor).toEqual(own); expect(MOVES.aokiji.heavy.name).toBe(MOVES.zoro.heavy.name);
    session.restore();
    for (const slot of ATTACK_SLOTS) expect(MOVES.endeavor[slot]).toBe(own[slot]);
    expect(MOVES.aokiji.heavy.name).toBe('Frozen Heel');
  });

  it("plays the borrowed move in Training: Endeavor throws Goku's Kamehameha", () => {
    const session = new ForgeSession();
    try {
      session.apply(kit('endeavor', { special: { from: 'goku' } }));
      const sim = new ArenaSimulation({ trainingBot: false, seed: 7 });
      sim.addPlayer('a', 'endeavor', 'A', false, { x: 0, y: 0, z: 0 });
      sim.addPlayer('b', 'aokiji', 'B', false, { x: 0, y: 0, z: 6 });
      let seq = 0;
      const casts: { fighter?: string; slot?: string }[] = [];
      for (let tick = 0; tick < 150; tick++) {
        sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, attack: tick === 2 ? 'special' : undefined, targetId: 'b' });
        sim.step();
        for (const event of sim.snapshot(true).events ?? []) if (event.kind === 'cast' || event.kind === 'release') casts.push(event as { fighter?: string; slot?: string });
      }
      expect(casts.some(event => event.fighter === 'endeavor' && event.slot === 'special')).toBe(true);
      expect(sim.getPlayer('b')!.hp).toBeLessThan(sim.getPlayer('b')!.maxHp);
    } finally { session.restore(); }
  });

  it('brings the studio to every offline Training as a lazy chunk, opens it for ?forge, and keeps it out of the match server', () => {
    const join = fs.readFileSync('src/engine/client/forgeJoin.ts', 'utf8'), network = fs.readFileSync('src/network.ts', 'utf8');
    expect(join).toMatch(/export const forgeWanted = \(\) => typeof location === 'object' && new URLSearchParams\(location\.search\)\.has\('forge'\);/);
    expect(network).toMatch(/import \{ forgeJoinOption, forgeWanted \} from '\.\/engine\/client\/forgeJoin'/);
    expect(network).toMatch(/if \(typeof document === 'object'\) void import\('\.\/ui\/forge\/ForgeStudio'\)/);
    expect(network).toMatch(/open: forgeWanted\(\)/);
    expect(network).not.toMatch(/^import .*ui\/forge/m);
    for (const dir of ['src/game', 'src/server', 'src/survival']) {
      const files = (fs.readdirSync(dir, { recursive: true }) as string[]).filter(name => /\.ts$/.test(name));
      for (const name of files) expect(fs.readFileSync(`${dir}/${name}`, 'utf8'), `${dir}/${name}`).not.toMatch(/ui\/forge|forgeSession|engine\/client/);
    }
  });
});

describe('Forge kit v2', () => {
  const hiken = { effect: 'titan_firefist', settings: { size: 1.2, glow: true }, scale: 1.1, hue: 0 };

  it("takes any of a fighter's four moves into any slot: Ace's Dai Enkai Entei on Endeavor's Q", () => {
    const forged = kit('endeavor', { special: { from: 'ace', fromSlot: 'ultimate' } });
    expect(pickSource('special', forged.slots.special)).toEqual({ fighter: 'ace', slot: 'ultimate' });
    expect(forgeMoves(forged).special).toEqual(simSpec('ace')!.kit.slots.ultimate);
    expect(forgeProblems({ ...forged, slots: { ...forged.slots, light: { from: 'goku', fromSlot: 'kick' as never } } }).errors.join(' ')).toMatch(/not a move slot/);
  });

  it('holds kits to the budget online and lets any kit play in the Training sandbox', () => {
    const strongest = (slot: typeof ATTACK_SLOTS[number]) => FIGHTER_IDS.map(id => ({ id, power: budget(kit('endeavor', { [slot]: { from: id } })) })).sort((a, b) => b.power - a.power)[0].id;
    const greedy = kit('endeavor', Object.fromEntries(ATTACK_SLOTS.map(slot => [slot, { from: strongest(slot) }])));
    expect(forgeProblems(greedy).errors.join(' ')).toMatch(/as strong as this body's own kit/);
    expect(forgeProblems(greedy, { sandbox: true }).errors).toEqual([]);
    expect(forgeProblems(kit('endeavor', { light: { from: 'goku', tune: { power: 9 } } }), { sandbox: true }).errors.join(' ')).toMatch(/power must stay within/);
  });

  it('carries Armory effects per slot and an aura, checked for shape and never changing the moves', () => {
    const plain = kit('ace', { special: { from: 'ace' } }), worn: ForgeKit = { ...kit('ace', { special: { from: 'ace', fx: hiken } }), aura: { effect: 'ext_aura_fire' } };
    expect(forgeProblems(worn).errors).toEqual([]);
    expect(forgeMoves(worn)).toEqual(forgeMoves(plain));
    expect(decodeForge(encodeForge(worn))).toEqual(worn);
    const bad = (fx: unknown) => forgeProblems({ ...worn, slots: { ...worn.slots, heavy: { from: 'ace', fx: fx as never } } }).errors.join(' ');
    expect(bad({ effect: '<img>' })).toMatch(/isn't an Armory effect id/);
    expect(bad({ effect: 'ki_wave', settings: { x: { y: 1 } } })).toMatch(/isn't a plain value/);
    expect(bad({ effect: 'ki_wave', scale: 9 })).toMatch(/25-400%/);
    expect(forgeProblems({ ...worn, aura: { effect: 'x', hue: 999 } }).errors.join(' ')).toMatch(/hue/);
  });

  it('publishes the kit in play for the page: offline from the session, online by hash', () => {
    const session = new ForgeSession(), forged: ForgeKit = { ...kit('endeavor', { special: { from: 'ace', fromSlot: 'ultimate', fx: hiken } }), aura: { effect: 'ext_aura_fire' } };
    const seen: string[] = [], off = onKitChange(body => seen.push(body));
    try {
      expect(session.apply(forged)).toEqual({ ok: true });
      expect(activeKit('endeavor')).toBe(forged);
      expect(playerKit({ fighter: 'endeavor' })).toBe(forged);
      expect(presentationKit({ fighter: 'endeavor' })?.slots.special).toEqual(forged.slots.special);
      expect(moveSource({ fighter: 'endeavor' }, 'special')).toEqual({ fighter: 'ace', slot: 'ultimate' });
      expect(moveSource({ fighter: 'endeavor' }, 'heavy')).toBeUndefined();
      expect(slotFx({ fighter: 'endeavor' }, 'special')).toEqual(hiken);
      expect(slotFx({ fighter: 'endeavor' }, 'body')).toEqual({ effect: 'ext_aura_fire' });
      session.restore();
      expect(playerKit({ fighter: 'endeavor' })).toBeUndefined();
      expect(seen).toEqual(['endeavor', 'endeavor']);
      const hash = shortForgeHash(forged);
      const aceSpecial = { from: 'ace' as FighterId, fx: hiken }, online: ForgeKit = { ...forged, slots: { ...forged.slots, special: aceSpecial } };
      rememberForgeKits({ [hash]: encodeForge(online) });
      expect(playerKit({ fighter: 'endeavor', forge: hash })).toBeUndefined();
      const name = shortForgeHash(online);
      rememberForgeKits({ [name]: encodeForge(online) });
      expect(moveSource({ fighter: 'endeavor', forge: name }, 'special')).toEqual({ fighter: 'ace', slot: 'special' });
      expect(slotFx({ fighter: 'endeavor', forge: name }, 'special')).toEqual(hiken);
    } finally { off(); session.restore(); forgetForgeKits(); }
  });

  it('lets the transplant and the Armory runtimes register, and works without them', () => {
    expect(typeof registerTransplant).toBe('function'); expect(typeof registerArmory).toBe('function');
    const before = armoryRuntime();
    const runtime = { effects: () => [], prepare: async () => {}, preview: () => {} };
    registerArmory(runtime); expect(armoryRuntime()).toBe(runtime);
    if (before) registerArmory(before);
  });
});
