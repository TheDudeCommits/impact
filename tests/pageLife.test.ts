import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reloadWhenRestored } from '../src/boot/pageLife';

function page() {
  const heard: Record<string, ((event: Event) => void)[]> = {}; let reloads = 0;
  const p = { addEventListener: (type: string, fn: (event: Event) => void) => { (heard[type] ??= []).push(fn); }, location: { reload: () => { reloads++; } } };
  reloadWhenRestored(p as unknown as Window);
  const show = (persisted: boolean) => { for (const fn of heard.pageshow ?? []) fn({ type: 'pageshow', persisted } as unknown as Event); };
  return { show, reloads: () => reloads };
}

describe('a page back from the back/forward cache', () => {
  it('is loaded again', () => { const p = page(); p.show(true); expect(p.reloads()).toBe(1); });
  it('a first load (pageshow, not persisted) is left alone', () => { const p = page(); p.show(false); expect(p.reloads()).toBe(0); });
  it('main.ts installs it beside the pagehide that disposes', () => {
    const main = readFileSync('src/main.ts', 'utf8');
    const at = main.indexOf('reloadWhenRestored(window);'), hide = main.indexOf("window.addEventListener('pagehide'");
    expect(at).toBeGreaterThan(0); expect(hide - at).toBeLessThan(400);
  });
  it('the hand-over never runs the game where it holds the page (so no reload loop there)', () => {
    const handover = readFileSync('src/boot/handover.ts', 'utf8');
    expect(handover).toContain(`script-src 'none'`);
    expect(handover).not.toMatch(/pageshow|reload\(/);
  });
});
