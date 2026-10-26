import { describe, expect, it } from 'vitest';
import { MAX_TIPS, TIPS } from './Coach';
import { defenceBasics } from './defence';
import { GUARD_GUIDE } from '../guardGuide';
import { stripShown } from './HudPrompts';
import { MODE_ORDER } from './catalogue';

describe('the coach and the newcomer strip', () => {
  it('shows at most four tips per mode, from at most five, each with its own id', () => {
    expect(MAX_TIPS).toBe(4);
    for (const mode of MODE_ORDER) {
      const ids = TIPS[mode].map(t => t.id);
      expect(ids.length).toBeGreaterThan(0); expect(ids.length).toBeLessThanOrEqual(5); expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('teaches the Perfect Parry once the player has blocked, in the PARRY stream\'s words, until they land one', () => {
    for (const mode of ['duel', 'royale', 'training', 'bad-blood'] as const) expect(TIPS[mode].some(t => t.id === 'parry')).toBe(true);
    const tip = TIPS.duel.find(t => t.id === 'parry')!;
    const frame = (now: number) => ({ now, self: {}, snapshot: { players: [] } }) as never;
    expect(tip.fire(frame(1000), { activeAt: 0, targetPressed: false })).toBe(false);
    expect(tip.fire(frame(5000), { activeAt: 0, targetPressed: false, blockedAt: 1000 })).toBe(true);
    expect(tip.fire(frame(9000), { activeAt: 0, targetPressed: false, blockedAt: 1000 })).toBe(false);
    expect(tip.fire(frame(5000), { activeAt: 0, targetPressed: false, blockedAt: 1000, parried: true })).toBe(false);
    const words = tip.text(frame(5000), { activeAt: 0, targetPressed: false });
    expect(words).toMatchObject({ action: 'guard', verb: 'PERFECT PARRY' });
    expect(tip.done!(frame(5000), { activeAt: 0, targetPressed: false, parried: true })).toBe(true);
  });
  it('draws DEFENCE BASICS from the one source, the guard key on Block and Perfect Parry only', () => {
    const html = defenceBasics({ device: 'keyboard' });
    for (const g of GUARD_GUIDE) { expect(html).toContain(g.name.toUpperCase()); expect(html).toContain(g.line.replace(/'/g, '&#39;')); }
    expect(html.match(/<li>/g)).toHaveLength(GUARD_GUIDE.length);
    expect(html.match(/<kbd/g)).toHaveLength(2);
  });
  it('fires the ultimate tip only once the meter is full, and calls it done when thrown', () => {
    const tip = TIPS.duel.find(t => t.id === 'ultimate')!;
    const frame = (ultimate: number, action = 'idle') => ({ self: { ultimate, action }, snapshot: { players: [] }, now: 0 }) as never;
    const state = { activeAt: 0, targetPressed: false };
    expect(tip.fire(frame(99), state)).toBe(false); expect(tip.fire(frame(100), state)).toBe(true);
    expect(tip.done!(frame(0, 'ultimate'), state)).toBe(true);
  });
  it('waits six seconds before asking a player to lock on, and never once they have', () => {
    const tip = TIPS.royale.find(t => t.id === 'lock-on')!;
    expect(tip.fire({ now: 5000 } as never, { activeAt: 0, targetPressed: false })).toBe(false);
    expect(tip.fire({ now: 6500 } as never, { activeAt: 0, targetPressed: false })).toBe(true);
    expect(tip.fire({ now: 6500 } as never, { activeAt: 0, targetPressed: true })).toBe(false);
  });
  it("shows the controls strip for a newcomer's first minute, three matches running", () => {
    expect(stripShown(0, 10)).toBe(true); expect(stripShown(2, 59)).toBe(true);
    expect(stripShown(2, 61)).toBe(false); expect(stripShown(3, 0)).toBe(false);
  });
  it('never asks a duellist to switch target, and leaves the skill tree to its own chip', () => {
    expect(TIPS.duel.some(t => t.id === 'lock-on')).toBe(false);
    expect(TIPS.arcade.some(t => t.id === 'tree')).toBe(false);
  });
});
