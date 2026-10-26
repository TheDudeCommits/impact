import { describe, expect, it } from 'vitest';
import { MoveSheet, moveSheetOf, moveSheetsFor } from '../src/ui/moveSheet';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';

function harness() {
  const applied: string[] = [], waiting = new Map<string, () => void>();
  const sheet = new MoveSheet(s => applied.push(s), s => new Promise<void>(done => waiting.set(s, done)));
  const finish = async (s: string) => { waiting.get(s)?.(); await new Promise(r => setTimeout(r, 0)); };
  return { sheet, applied, waiting, finish };
}

describe('the move cards never go blank', () => {
  it('knows which sheets a fighter can need: only Naruto and Eren, whose forms throw kits of their own, transform their cards', () => {
    for (const id of Object.keys(FIGHTERS) as FighterId[]) {
      expect(moveSheetOf(id, false)).toBe(id);
      expect(moveSheetsFor(id)).toEqual(id === 'naruto' ? ['naruto', 'naruto-kurama'] : id === 'eren' ? ['eren', 'eren-titan'] : [id]);
    }
    expect(moveSheetOf('naruto', true)).toBe('naruto-kurama');
    expect(moveSheetOf('eren', true)).toBe('eren-titan');
  });

  it('keeps the old art until the new sheet has decoded, then swaps', async () => {
    const { sheet, applied, finish } = harness();
    sheet.now('naruto');
    expect(applied).toEqual(['naruto']);
    await finish('naruto');
    sheet.want('naruto-kurama');
    expect(sheet.shown).toBe('naruto');expect(applied).toEqual(['naruto']);
    await finish('naruto-kurama');
    expect(sheet.shown).toBe('naruto-kurama');expect(applied).toEqual(['naruto', 'naruto-kurama']);
  });

  it('swaps at once for a sheet warmed as the match started', async () => {
    const { sheet, applied, finish } = harness();
    sheet.now('naruto');sheet.warm('naruto-kurama');
    await finish('naruto');await finish('naruto-kurama');
    sheet.want('naruto-kurama');
    expect(applied, 'the form\'s cards on the frame it arrives').toEqual(['naruto', 'naruto-kurama']);
    sheet.want('naruto');
    expect(applied, 'and back as it ends').toEqual(['naruto', 'naruto-kurama', 'naruto']);
  });

  it('drops a decode that is no longer wanted', async () => {
    const { sheet, applied, finish } = harness();
    sheet.now('naruto');await finish('naruto');
    sheet.want('naruto-kurama');sheet.want('naruto');
    await finish('naruto-kurama');
    expect(sheet.shown).toBe('naruto');expect(applied).toEqual(['naruto']);
  });

  it('puts a new match\'s sheet on at once rather than keeping the last match\'s', () => {
    const { sheet, applied } = harness();
    sheet.now('naruto');sheet.now('guts');
    expect(sheet.shown).toBe('guts');expect(applied).toEqual(['naruto', 'guts']);
  });
});
