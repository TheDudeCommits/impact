import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canFullScreen, enterFullScreen } from '../src/ui/fullScreen';

const iphone = { fullscreenEnabled: undefined, documentElement: {} } as unknown as Document;
function desktop() {
  const asked: unknown[] = [];
  return { asked, doc: { fullscreenEnabled: true, documentElement: { requestFullscreen: (o: unknown) => { asked.push(o); return Promise.resolve(); } } } as unknown as Document };
}

describe('full screen', () => {
  it('an iPhone has none: no switch, and asking rejects instead of throwing', async () => {
    expect(canFullScreen(iphone)).toBe(false);
    let threw = false, rejected = false;
    try { await enterFullScreen(iphone).catch(() => { rejected = true; }); } catch { threw = true; }
    expect({ threw, rejected }).toEqual({ threw: false, rejected: true });
  });
  it('a browser that has it goes full screen with its bar hidden', async () => {
    const { doc, asked } = desktop();
    expect(canFullScreen(doc)).toBe(true);
    await enterFullScreen(doc);
    expect(asked).toEqual([{ navigationUI: 'hide' }]);
  });
  it('SurvivalHud asks only through it', () => {
    const hud = readFileSync('src/ui/SurvivalHud.ts', 'utf8');
    expect(hud).not.toContain('requestFullscreen(');
    expect(hud).toMatch(/if \(!card \|\| row \|\| !canFullScreen\(\)\) return;/);
  });
});
