import { describe, expect, it } from 'vitest';
import { CAREER_SHOWN } from '../../game/social/career';
import { careerLabel } from './CareerUI';

describe("the career's mode names (overnight UX, 8 October 2026)", () => {
  it('uses the one vocabulary of the cards and sheets, not the retired card names', () => {
    const shown = CAREER_SHOWN.map(careerLabel);
    expect(shown).toEqual(['Duel', 'Battle Royale · Online', 'Battle Royale · Bots', 'Battle Royale · Friends', 'Arcade Survival · Solo', 'Arcade Survival · Co-op', 'Last Stand', 'Bad Blood', 'Rift War']);
    for (const label of shown) expect(label).not.toMatch(/BR vs|Private Royale|Co-op Survival/);
  });
});
