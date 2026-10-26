import { describe, expect, it } from 'vitest';
import { PLACE_RULES, PlaceRules, type PlaceHost } from '../src/survival/placeRules';
import { LOCATIONS, dungeonFor } from '../src/survival/locations';
import { SurvivalGame } from '../src/survival/SurvivalGame';
import type { Vec3 } from '../src/game/types';

function host(fighters: Vec3[], swords: Vec3[] = []) {
  let now = 0, seed = 7;
  const strikes: { at: Vec3; lands: number; radius: number; damage: number; name: string; element: string; look?: string }[] = [];
  const h: PlaceHost & { tick(seconds: number): void } = {
    now: () => now,
    random: () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; },
    bounds: () => ({ halfX: 34, halfZ: 34 }),
    fighters: () => fighters,
    swords: () => swords,
    clear: at => at,
    strike: (at, lands, radius, damage, name, element, look) => { strikes.push({ at, lands, radius, damage, name, element, look }); },
    tick: seconds => { now += seconds; },
  };
  return { h, strikes };
}
const run = (rules: PlaceRules, h: { tick(seconds: number): void }, seconds: number, round = 3) => {
  for (let t = 0; t < seconds * 60; t++) { h.tick(1 / 60); rules.step(true, round); }
};

describe('places that fight back', () => {
  it('gives three places a rule of their own, named on their chapter cards', () => {
    expect(Object.keys(PLACE_RULES).sort()).toEqual(['ashen-wastes', 'burning-village', 'hill-of-swords']);
    for (const id of Object.keys(PLACE_RULES)) expect(LOCATIONS.some(place => place.id === id), id).toBe(true);
  });

  it('opens vents in the ash near the fighters, and sets off only those near one, in turn', () => {
    const { h, strikes } = host([{ x: 0, y: 0, z: 0 }]);
    const rules = new PlaceRules(h);
    rules.begin('ashen-wastes');
    run(rules, h, 6);
    expect(strikes.length).toBe(0);
    run(rules, h, 60);
    expect(rules.vents.length).toBeGreaterThan(3);
    expect(rules.vents.length).toBeLessThanOrEqual(7);
    for (const vent of rules.vents) expect(Math.hypot(vent.x, vent.z)).toBeLessThan(12);
    expect(strikes.length).toBeGreaterThan(15);
    expect(strikes.every(strike => strike.look === 'vent' && strike.element === 'fire')).toBe(true);
    const recent = strikes.slice(-4).map(strike => `${strike.at.x},${strike.at.z}`);
    expect(new Set(recent).size).toBeGreaterThan(1);
  });

  it('brings lightning down on the blade nearest a fighter, or near them when none is', () => {
    const blade = { x: 4, y: 0, z: 1 }, far = { x: 30, y: 0, z: 30 };
    const { h, strikes } = host([{ x: 0, y: 0, z: 0 }], [blade, far]);
    const rules = new PlaceRules(h);
    rules.begin('hill-of-swords');
    run(rules, h, 20);
    expect(strikes.length).toBeGreaterThan(1);
    expect(strikes.every(strike => strike.at.x === blade.x && strike.at.z === blade.z && strike.look === 'zeus')).toBe(true);
    const open = host([{ x: 0, y: 0, z: 0 }]);
    const sky = new PlaceRules(open.h);
    sky.begin('hill-of-swords');
    run(sky, open.h, 20);
    expect(open.strikes.length).toBeGreaterThan(1);
    for (const strike of open.strikes) expect(Math.hypot(strike.at.x, strike.at.z)).toBeLessThanOrEqual(8.01);
  });

  it('drops burning beams near the fighters in the Village, and nothing where a place has no rule', () => {
    const { h, strikes } = host([{ x: 0, y: 0, z: 0 }]);
    const rules = new PlaceRules(h);
    rules.begin('burning-village');
    run(rules, h, 20);
    expect(strikes.length).toBeGreaterThan(2);
    for (const strike of strikes) { expect(strike.look).toBe('lance'); expect(Math.hypot(strike.at.x, strike.at.z)).toBeGreaterThanOrEqual(2.49); }
    const quiet = host([{ x: 0, y: 0, z: 0 }]);
    const none = new PlaceRules(quiet.h);
    none.begin('the-eclipse');
    run(none, quiet.h, 20);
    expect(quiet.strikes.length).toBe(0);
    const held = host([{ x: 0, y: 0, z: 0 }]);
    const waiting = new PlaceRules(held.h);
    waiting.begin('burning-village');
    for (let t = 0; t < 60 * 20; t++) { held.h.tick(1 / 60); waiting.step(false, 3); }
    expect(held.strikes.length).toBe(0);
  });

  it('carries the vents in a run fought in the Wastes, and warns of each eruption', () => {
    const seed = [...Array(400).keys()].map(i => 40000 + i).find(n => dungeonFor(n, 1).location.id === 'ashen-wastes')!;
    const game = new SurvivalGame({ fighter: 'goku', seed, god: true, slowMotion: false });
    const idle = (() => { let seq = 0; return () => ({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 }); })();
    let vents = 0, warned = 0;
    for (let t = 0; t < 60 * 40; t++) {
      if (game.phase === 'draft') { game.choose(game.view().draft?.cards[0]); continue; }
      game.tick(idle());
      const view = game.view();
      vents = Math.max(vents, view.vents?.length ?? 0);
      warned = Math.max(warned, view.feed.filter(item => item.kind === 'hazard' && item.sub === 'vent').length);
    }
    expect(vents).toBeGreaterThan(0);
    expect(warned).toBeGreaterThan(0);
    game.dispose();
  }, 120000);
});
