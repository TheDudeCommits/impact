import { describe, expect, it } from 'vitest';
import { SurvivalGame, MAX_PARTY, RESCUE_SECONDS, xpNeeded, partyScale } from '../src/survival/SurvivalGame';
import type { FighterId, PlayerInput } from '../src/game/types';

const seats = (n: number) => (['zoro', 'goku', 'ichigo', 'naruto', 'luffy'] as FighterId[]).slice(0, n).map((fighter, i) => ({ id: `p${i + 1}`, fighter, name: `P${i + 1}` }));
const idle = (seq: number): PlayerInput => ({ seq, moveX: 0, moveZ: 0, yaw: 0 });
function run(game: SurvivalGame, seconds: number, until?: () => boolean) {
  let seq = 0;
  for (let t = 0; t < seconds * 60; t++) {
    if (until?.()) return;
    if (game.phase === 'draft') { for (const hero of game.heroes.values()) if (hero.draft) game.choose(hero.draft.cards[0], hero.id); continue; }
    seq++;
    for (const hero of game.heroes.values()) game.submit(hero.id, idle(seq));
    game.step();
  }
}

describe('co-op survival', () => {
  it('asks more of a bigger party, and exactly what it always did of one fighter', () => {
    expect(Object.values(partyScale(1)).every(v => v === 1 || v === 0)).toBe(true);
    const wanted = (game: SurvivalGame, round: number) => { game.round = round; return (game as unknown as { crowdWanted(now: number): number }).crowdWanted(0); };
    const solo = new SurvivalGame({ heroes: seats(1), seed: 1, quiet: true }), four = new SurvivalGame({ heroes: seats(4), seed: 1, quiet: true });
    for (const round of [1, 5, 9, 13]) expect(wanted(four, round)).toBeGreaterThan(wanted(solo, round) * 1.5);
    const grunt = (game: SurvivalGame) => { const slot = (game as unknown as { spawnGrunt(t: number, at: object, e: boolean): number }).spawnGrunt(0, { x: 4, y: 0, z: 4 }, false); return { hp: game.horde.maxHp[slot], damage: game.horde.damageScale[slot] }; };
    const a = grunt(solo), b = grunt(four);
    expect(b.hp).toBeGreaterThan(a.hp);
    expect(b.damage).toBe(a.damage);
    solo.dispose(); four.dispose();
    expect(partyScale(4).boss).toBeGreaterThan(partyScale(4).elite);
    expect(partyScale(4).elite).toBeGreaterThan(partyScale(4).hp);
    const party = new SurvivalGame({ heroes: seats(4), seed: 1 });
    expect(party.xpNext(1)).toBe(Math.round(xpNeeded(1) * partyScale(4).xp));
    party.dispose();
  });

  it('seats up to four in a lobby that spawns nothing until the run begins', () => {
    const game = new SurvivalGame({ heroes: [], lobby: true, seed: 2 });
    for (const seat of seats(5)) game.addHero(seat);
    expect(game.heroes.size).toBe(MAX_PARTY);
    expect(game.phase).toBe('lobby');
    run(game, 8);
    expect(game.sim.playerStates().filter(p => p.enemy)).toHaveLength(0);
    expect(game.horde.alive).toBe(0);
    game.begin();
    expect(game.phase).toBe('intro');
    expect(game.addHero({ id: 'late', fighter: 'goku' })).toBe(false);
    run(game, 8);
    expect(game.phase).toBe('fight');
    expect(game.roundState).toBe('horde');
    expect(game.horde.alive).toBeGreaterThan(10);
    game.dispose();
  }, 30000);

  it('stops the run for the whole party while anyone is in the skill tree, until every one of them is ready', () => {
    const game = new SurvivalGame({ heroes: seats(2), seed: 3 });
    for (let t = 0; t < 60 * 8 && game.phase !== 'fight'; t++) { if (game.phase === 'travel') game.arrive(); else game.tick(idle(t + 1)); }
    expect(game.phase).toBe('fight');
    const [a, b] = [...game.heroes.keys()];
    game.choose('tree:open', a);
    expect(game.phase).toBe('draft');
    expect(game.view(b).upgrading).toEqual([game.heroes.get(a)!.name]);
    const time = game.sim.serverTime;
    for (let t = 0; t < 30; t++) game.tick(idle(1000 + t));
    expect(game.sim.serverTime).toBe(time);
    game.choose('tree:open', b);
    game.choose('tree:close', a);
    expect(game.phase).toBe('draft');
    game.choose('tree:close', b);
    expect(game.phase).toBe('fight');
    game.choose('tree:open', a);
    expect(game.phase).toBe('draft');
    game.closeTrees();
    expect(game.phase).toBe('fight');
    expect(game.view(a).treeOpen).toBe(false);
    game.dispose();
  }, 30000);

  it('splits the horde between fighters who stand apart', () => {
    const game = new SurvivalGame({ heroes: seats(4), seed: 3 });
    const corners = [[-14, -14], [14, -14], [-14, 14], [14, 14]];
    let i = 0;
    for (const hero of game.heroes.values()) { const [x, z] = corners[i++]; game.sim.place(hero.id, { x, y: 0, z }, 0); }
    run(game, 26);
    const targeted = new Set<number>();
    for (let slot = 0; slot < game.horde.capacity; slot++) if (game.horde.isAlive(slot) && game.horde.target[slot] >= 0) targeted.add(game.horde.target[slot]);
    expect(targeted.size).toBeGreaterThanOrEqual(3);
    game.dispose();
  }, 60000);

  it('lets an ally help a fallen fighter up, and ends only when everyone is down', () => {
    const game = new SurvivalGame({ heroes: seats(2), seed: 4, god: true });
    run(game, 5);
    const [a, b] = [...game.heroes.values()];
    const bodyA = game.sim.actors.get(a.id)!.state;
    game.sim.place(b.id, { x: bodyA.x + 12, y: 0, z: bodyA.z }, 0);
    game.sim.damage(b.id, 1e6, 'e0', 'Test');
    run(game, .2);
    expect(b.down).toBe(true);
    expect(game.phase).not.toBe('over');
    expect(game.view(b.id).party.find(member => member.id === b.id)!.down).toBe(true);
    const fallen = game.sim.actors.get(b.id)!.state;
    game.sim.place(a.id, { x: fallen.x + 1, y: 0, z: fallen.z }, 0);
    run(game, RESCUE_SECONDS + .4, () => !b.down);
    expect(b.down).toBe(false);
    const up = game.sim.actors.get(b.id)!.state;
    expect(up.alive).toBe(true);
    expect(up.hp).toBeGreaterThan(up.maxHp * .3);
    expect(game.view(a.id).feed.some(item => item.kind === 'rescued')).toBe(true);
    game.sim.damage(b.id, 1e6, 'e0', 'Test');
    game.sim.damage(a.id, 1e6, 'e0', 'Test');
    run(game, .2);
    expect(game.phase).toBe('over');
    expect(game.view(a.id).result?.party).toBe(2);
    expect(game.view(b.id).result?.fighter).toBe(b.fighter);
    game.dispose();
  }, 30000);

  it('deals every fighter a hand of their own, and waits for all of them', () => {
    const game = new SurvivalGame({ heroes: seats(3), seed: 5, god: true });
    const heroes = [...game.heroes.values()];
    for (const hero of heroes) hero.pending = 1;
    const director = game as unknown as { openDrafts(): boolean; enterPhase(phase: string): void };
    director.openDrafts(); director.enterPhase('draft');
    expect(game.phase).toBe('draft');
    expect(heroes.every(hero => hero.draft?.cards.length)).toBe(true);
    expect(game.view(heroes[0].id).draft).toEqual(heroes[0].draft);
    game.choose(heroes[0].draft!.cards[0], heroes[0].id);
    expect(heroes[0].picks).toHaveLength(1);
    expect(game.phase).toBe('draft');
    expect(game.view(heroes[1].id).choosing).toBe(2);
    game.autoChoose();
    expect(heroes.every(hero => hero.picks.length === 1)).toBe(true);
    expect(game.phase).not.toBe('draft');
    game.dispose();
  });

  it('carries on when a fighter leaves, and ends if the last one standing does', () => {
    const game = new SurvivalGame({ heroes: seats(3), seed: 6 });
    run(game, 12);
    const [a, b, c] = [...game.heroes.values()];
    game.removeHero(b.id);
    expect(game.heroes.size).toBe(2);
    expect(game.sim.actors.has(b.id)).toBe(false);
    run(game, 3);
    expect(game.sim.playerStates().filter(p => p.enemy && p.target === b.id)).toHaveLength(0);
    for (let slot = 0; slot < game.horde.capacity; slot++) if (game.horde.isAlive(slot)) expect(game.horde.target[slot]).toBeLessThan(game.heroes.size);
    game.sim.damage(c.id, 1e6, 'e0', 'Test');
    run(game, .2);
    expect(c.down).toBe(true);
    game.removeHero(a.id);
    expect(game.phase).toBe('over');
    game.dispose();
  }, 30000);

  it('takes a fighter in mid-run: held in a rift, untouched and still, until the round ends', () => {
    const game = new SurvivalGame({ heroes: [], lobby: true, seed: 7, hunt: false, god: true });
    for (const seat of seats(2)) game.addHero(seat);
    expect(game.dropIn({ id: 'late', fighter: 'luffy', name: 'Late' })).toBe(false);
    game.begin();
    const enemies = (game as unknown as { enemies: Map<string, { boss?: boolean; diedAt?: number; id: string }> }).enemies;
    const bossUp = () => [...enemies.values()].find(record => record.boss && record.diedAt === undefined);
    run(game, 20, () => game.phase === 'fight' && !!bossUp());
    expect(bossUp()).toBeDefined();
    const [a] = [...game.heroes.values()];
    a.points = 3; a.picks.push('iron-fist', 'iron-fist');
    expect(game.dropIn({ id: 'late', fighter: 'luffy', name: 'Late', unlocked: ['momentum', 'iron-fist'], bonus: 1 })).toBe(true);
    const late = game.heroes.get('late')!;
    expect(late.joining).toBe(true);
    expect(late.points).toBe(5 + 1);
    expect(late.unlocked).toEqual(['momentum']);
    expect(game.view('late').party[0]).toMatchObject({ id: 'late', joining: true });
    expect(game.view().feed.some(item => item.kind === 'challenger' && item.value === 0)).toBe(true);
    const body = game.sim.actors.get('late')!.state, at = { x: body.x, z: body.z };
    const move = game.sim.actors.get(a.id)!.state;
    game.sim.strike('probe', 'late', 'heavy', { name: 'Test', duration: .1, contacts: [0], damage: 300, range: 1, radius: 1, stamina: 0, cooldown: 0, stun: .3, knockback: 4, style: 'melee' }, { x: body.x, y: body.y + 1, z: body.z });
    for (let t = 0; t < 90; t++) { game.submit('late', { seq: 1000 + t, moveX: 1, moveZ: 0, yaw: 0 }); game.submit(a.id, idle(1000 + t)); game.step(); }
    expect(body.hp).toBe(body.maxHp);
    expect(Math.hypot(body.x - at.x, body.z - at.z)).toBeLessThan(.3);
    expect(move.alive).toBe(true);
    game.choose('tree:open', 'late');
    expect(game.phase).toBe('fight');
    game.choose('tree:close', 'late');
    for (let t = 0; t < 60 * 30 && late.joining; t++) {
      const boss = bossUp();
      if (boss && t % 30 === 0) game.sim.damage(boss.id, 1e7, a.id, 'Test');
      run(game, 1 / 60);
    }
    expect(late.joining).toBe(false);
    const out = game.view().feed.find(item => item.kind === 'challenger' && item.value === 1);
    expect(out?.sub).toBe('LATE');
    expect([...game.heroes.values()].filter(hero => hero.id !== 'late').every(hero => !hero.down)).toBe(true);
    game.dispose();
  }, 60000);

  it('lets a waiting fighter out to save the run when the rest of the party falls', () => {
    const game = new SurvivalGame({ heroes: seats(1), seed: 8 });
    run(game, 14, () => game.phase === 'fight' && game.roundState === 'horde');
    expect(game.dropIn({ id: 'late', fighter: 'goku', name: 'Late' })).toBe(true);
    const [a] = [...game.heroes.values()];
    game.sim.damage(a.id, 1e6, 'e0', 'Test');
    run(game, .2);
    expect(a.down).toBe(true);
    expect(game.phase).not.toBe('over');
    expect(game.heroes.get('late')!.joining).toBe(false);
    expect(game.view().feed.some(item => item.kind === 'challenger' && item.value === 1 && /SAVE THE RUN/.test(item.sub ?? ''))).toBe(true);
    game.dispose();
  }, 30000);

  it('takes a fighter who comes between rounds in at once, and nobody once the run is over or full', () => {
    const game = new SurvivalGame({ heroes: seats(3), seed: 9 });
    run(game, 3);
    expect(game.phase).toBe('intro');
    expect(game.dropIn({ id: 'late', fighter: 'luffy' })).toBe(true);
    expect(game.heroes.get('late')!.joining).toBe(false);
    expect(game.dropIn({ id: 'fifth', fighter: 'naruto' })).toBe(false);
    game.dispose();
  }, 30000);
});
