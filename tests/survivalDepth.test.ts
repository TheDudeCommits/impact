import { describe, expect, it } from 'vitest';
import { DEPTH_RULES, MAX_DEPTH, clampDepth, depthMods, depthPay, openDepth } from '../src/survival/depth';
import { SurvivalGame } from '../src/survival/SurvivalGame';

describe('rift depth', () => {
  it('has a rule for every depth, and none at the surface', () => {
    expect(DEPTH_RULES.length).toBe(MAX_DEPTH);
    const surface = depthMods(0);
    expect(surface).toEqual({ hordeHp: 1, hordeDamage: 1, hordeSpeed: 1, crowd: 1, bossHp: 1, bossDamage: 1, heal: 1, elites: 0, eliteChance: 1, springs: true, sigPace: 1, roundHeal: true, doubleFrom: 99, awaken: .5 });
  });
  it('holds every rule down to the depth fought at', () => {
    const at7 = depthMods(7), at15 = depthMods(15);
    expect(at7.hordeDamage).toBeCloseTo(1.1); expect(at7.hordeHp).toBeCloseTo(1.15); expect(at7.springs).toBe(false); expect(at7.sigPace).toBe(1);
    expect(at15.hordeDamage).toBeCloseTo(1.1 * 1.15); expect(at15.bossDamage).toBeCloseTo(1.15 * 1.15); expect(at15.roundHeal).toBe(false); expect(at15.awaken).toBeCloseTo(2 / 3);
    expect(depthMods(99)).toEqual(at15);
  });
  it('opens one depth below each seal and pays more the deeper', () => {
    expect(openDepth(-1)).toBe(0); expect(openDepth(0)).toBe(1); expect(openDepth(14)).toBe(15); expect(openDepth(20)).toBe(15);
    expect(clampDepth(9, 3)).toBe(4); expect(clampDepth('9', 3)).toBe(0); expect(clampDepth(2.7, 3)).toBe(2);
    expect(depthPay(0)).toBe(1); expect(depthPay(10)).toBeCloseTo(2.5);
  });
  it('carries its depth into the run and its result', () => {
    const game = new SurvivalGame({ fighter: 'goku', seed: 5, depth: 7, god: true, slowMotion: false });
    expect(game.depth).toBe(7);
    expect(game.view().depth).toBe(7);
    game.dispose();
    expect(new SurvivalGame({ fighter: 'goku', seed: 5, depth: 99, slowMotion: false }).depth).toBe(MAX_DEPTH);
  });
});
