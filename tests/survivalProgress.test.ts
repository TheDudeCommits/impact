import { describe, expect, it } from 'vitest';
import { SurvivalGame, PLAYER_ID, type RunResult } from '../src/survival/SurvivalGame';
import { AURAS, CHALLENGES, MASTERY_XP, UNLOCKS, auraOf, buy, emptyProgress, masteryOf, settle, shardsFor, startPointsAt, titleAt } from '../src/survival/progress';
import { SKILL_TREE, TREE_NODE, botPick, lockOf } from '../src/survival/skillTree';
import { UPGRADES, offer, runStats } from '../src/survival/upgrades';
import { nodeInfo } from '../src/survival/skillText';
import { LOCATIONS } from '../src/survival/locations';
import { shares } from '../src/ui/survival/runSummary';

const run = (over: Partial<RunResult> = {}): RunResult => ({
  fighter: 'zoro', round: 6, wave: 6, rank: 'E', act: 0, score: 250000, kills: 400, seconds: 420, level: 12,
  bestRank: 3, bestCombo: 40, damageDealt: 90000, damageTaken: 3000, bosses: 2, picks: ['iron-fist'],
  finishers: 1, teamUltimates: 0, dealtBy: { blows: 50000, specials: 20000, ultimates: 15000, techniques: 4000, team: 1000 },
  bossLog: [{ id: 'jabra', name: 'Jabra', rank: 'F', finished: true, seconds: 64 }, { id: 'grimmjow', name: 'Grimmjow', rank: 'E', finished: false, seconds: 91 }],
  places: ['burning-village', 'hill-of-swords'], breaks: 0, flawless: 0, cursed: 0, loop: 0, ...over });

describe('rift progress: what a run leaves behind', () => {
  it('a run pays shards and mastery, fills the codex and completes challenges once', () => {
    const first = settle(emptyProgress(), run());
    expect(first.shards).toBe(shardsFor(run()));
    expect(first.shards).toBeGreaterThan(10);
    expect(first.challenges).toEqual(expect.arrayContaining(['first-blood', 'finisher']));
    expect(first.challenges).not.toContain('breaker');
    expect(first.progress.shards).toBe(first.shards + first.bonus);
    expect(first.progress.codex.jabra).toEqual({ beaten: 1, finished: 1, fastest: 64 });
    expect(first.progress.codex.grimmjow.finished).toBe(0);
    expect(first.progress.places).toEqual(['burning-village', 'hill-of-swords']);
    expect(first.progress.runs).toBe(1);
    expect(first.record).toBe(true);
    const second = settle(first.progress, run({ bossLog: [{ id: 'jabra', name: 'Jabra', rank: 'F', finished: false, seconds: 50 }], score: 1000 }));
    expect(second.challenges).toEqual([]);
    expect(second.bonus).toBe(0);
    expect(second.progress.codex.jabra).toEqual({ beaten: 2, finished: 1, fastest: 50 });
    expect(second.record).toBe(false);
    expect(second.progress.best.score).toBe(250000);
    expect(first.progress.runs).toBe(1);
  });

  it('mastery levels a fighter, and the levels give titles, auras and skill points', () => {
    expect(masteryOf(0).level).toBe(1);
    expect(masteryOf(MASTERY_XP[1]).level).toBe(2);
    expect(masteryOf(MASTERY_XP[MASTERY_XP.length - 1] + 999)).toMatchObject({ level: 10, max: true });
    expect(titleAt(1)).toBe('NEWCOMER');
    expect(titleAt(2)).toBe('RIFT WALKER');
    expect(titleAt(10)).toBe('RIFT LEGEND');
    expect(startPointsAt(3)).toBe(0);
    expect(startPointsAt(4)).toBe(1);
    expect(startPointsAt(10)).toBe(2);
    let p = emptyProgress();
    p.mastery.zoro = MASTERY_XP[2];
    p.aura.zoro = 'blood';
    expect(auraOf(p, 'zoro')).toBe('rift');
    p = { ...p, aura: { zoro: 'ki' } };
    expect(auraOf(p, 'zoro')).toBe('ki');
    expect(AURAS.ki.level).toBeLessThanOrEqual(3);
    const settled = settle(emptyProgress(), run({ round: 14, seconds: 1100, bossLog: Array.from({ length: 7 }, (_, i) => ({ id: `b${i}`, name: 'B', rank: 'F' as const, finished: false, seconds: 30 })) }));
    expect(settled.to).toBeGreaterThan(settled.from);
  });

  it('the place and boss challenges read the whole profile', () => {
    const p = emptyProgress();
    p.places = LOCATIONS.slice(1).map(l => l.id);
    const settled = settle(p, run({ places: [LOCATIONS[0].id], bossLog: [] }));
    expect(settled.challenges).toContain('wanderer');
    expect(CHALLENGES.every(c => c.reward > 0)).toBe(true);
    expect(new Set(CHALLENGES.map(c => c.id)).size).toBe(CHALLENGES.length);
  });

  it('shards buy the nodes the tree keeps shut, once each', () => {
    expect(UNLOCKS.map(u => u.node)).toEqual(['momentum', 'overflow', 'second-wind']);
    const poor = emptyProgress();
    expect(buy(poor, 'momentum')).toBeUndefined();
    const rich = { ...emptyProgress(), shards: 100 };
    const after = buy(rich, 'momentum')!;
    expect(after.shards).toBe(100 - UNLOCKS[0].cost);
    expect(after.unlocked).toEqual(['momentum']);
    expect(buy(after, 'momentum')).toBeUndefined();
    expect(buy(rich, 'iron-fist')).toBeUndefined();
  });

  it('a shut node cannot be learned or dealt until it is bought', () => {
    const three = ['iron-fist', 'iron-fist', 'keen-eye'];
    expect(lockOf(three, 'momentum')).toMatch(/shards/);
    expect(lockOf(three, 'momentum', ['momentum'])).toBeUndefined();
    expect(nodeInfo(TREE_NODE.get('momentum')!, three).requires[0]).toMatchObject({ met: false });
    const picks: string[] = [];
    for (let i = 0; i < 60; i++) { const id = botPick(picks); if (!id) break; expect(TREE_NODE.get(id)?.unlock).toBeUndefined(); picks.push(id); }
    let rolls = 0;
    const random = () => (rolls = (rolls * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 200; i++) for (const id of offer([], random)) expect(UPGRADES.find(u => u.id === id)?.bought).toBeFalsy();
    const dealt = new Set<string>();
    for (let i = 0; i < 400; i++) for (const id of offer([], random, false, 0, ['momentum', 'overflow', 'second-wind'])) dealt.add(id);
    expect(dealt.has('momentum') || dealt.has('overflow') || dealt.has('second-wind')).toBe(true);
    for (const node of SKILL_TREE.filter(n => n.unlock)) expect(UPGRADES.find(u => u.id === node.id)?.bought).toBe(true);
  });

  it('the new nodes do what they say', () => {
    expect(runStats(['momentum']).momentum).toBeCloseTo(.04);
    expect(runStats(['momentum', 'momentum']).momentum).toBeCloseTo(.06);
    expect(runStats(['overflow']).overflow).toBe(8);
    expect(runStats(['second-wind']).secondWind).toBeCloseTo(.35);
  });

  it('a fighter brings their progress into the run: bought nodes and mastery points', () => {
    const game = new SurvivalGame({ fighter: 'zoro', seed: 3, quiet: true, unlocked: ['momentum', 'iron-fist', 'nonsense'], bonus: 9 });
    const hero = game.heroes.get(PLAYER_ID)!;
    expect(hero.unlocked).toEqual(['momentum']);
    expect(hero.points).toBe(2);
    for (const id of ['iron-fist', 'iron-fist', 'keen-eye']) { hero.points++; expect(game.learn(hero, id)).toBe(true); }
    expect(game.learn(hero, 'momentum')).toBe(true);
    expect(game.learn(hero, 'overflow')).toBe(false);
  });

  it('Second Wind catches a fall once a round', () => {
    const game = new SurvivalGame({ fighter: 'zoro', seed: 5, quiet: true, picks: ['second-wind'], unlocked: ['second-wind'] });
    const idle = (() => { let seq = 0; return () => ({ seq: ++seq, moveX: 0, moveZ: 0, yaw: 0 }); })();
    for (let t = 0; t < 400 && game.phase !== 'fight'; t++) game.tick(idle());
    expect(game.phase).toBe('fight');
    const body = game.sim.actors.get(PLAYER_ID)!.state;
    body.hp = body.maxHp * .2;
    game.tick(idle());
    expect(body.hp).toBeGreaterThan(body.maxHp * .5);
    expect(game.view().feed.some(item => item.kind === 'second-wind')).toBe(true);
    body.hp = body.maxHp * .2;
    game.tick(idle());
    expect(body.hp).toBeLessThan(body.maxHp * .25);
  });

  it('a probe earns nothing; the summary splits damage by source', () => {
    const game = new SurvivalGame({ fighter: 'zoro', seed: 5, quiet: true, god: true });
    expect((game as unknown as { resultFor(hero: unknown): RunResult }).resultFor(game.heroes.get(PLAYER_ID)).probe).toBe(true);
    const parts = shares(run().dealtBy);
    expect(parts.map(p => p.key)).toEqual(['blows', 'specials', 'ultimates', 'techniques', 'team']);
    expect(parts.reduce((sum, p) => sum + p.share, 0)).toBeCloseTo(1);
    expect(shares({ blows: 0, specials: 0, ultimates: 0, techniques: 0, team: 0 })).toEqual([]);
  });
});
