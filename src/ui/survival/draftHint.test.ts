import { describe, expect, it } from 'vitest';
import { draftHint } from '../SurvivalHud';

describe("the level-up draft's line under its cards (overnight UX, 9 October 2026)", () => {
  it('says TAP on a touch screen, never the keyboard\'s numbers', () => {
    expect(draftHint('touch', 3)).toBe('TAP A CARD TO TAKE IT');
    expect(draftHint('touch', 3)).not.toMatch(/PRESS|CLICK/);
  });
  it('keeps the keys with a keyboard', () => {
    expect(draftHint('keyboard', 3)).toBe('PRESS 1 · 2 · 3 OR CLICK A CARD');
  });
});
