import { afterEach, describe, expect, it } from 'vitest';
import { asleep, wakeOnReturn } from '../src/audio/wake';

describe('an audio context that stopped playing', () => {
  const g = globalThis as unknown as Record<string, unknown>, saved = { add: g.addEventListener, document: g.document };
  afterEach(() => { g.addEventListener = saved.add; g.document = saved.document; });
  function page() {
    const win = new EventTarget(), doc = Object.assign(new EventTarget(), { hidden: false });
    g.addEventListener = win.addEventListener.bind(win); g.document = doc;
    const ctx = { state: 'running' as string, resumes: 0, resume() { this.resumes++; return Promise.resolve(); } };
    return { win, doc, ctx };
  }
  it("is asleep when suspended or interrupted, not when running or closed", () => {
    expect(['suspended', 'interrupted', 'running', 'closed'].map(state => asleep({ state } as never))).toEqual([true, true, false, false]);
    expect(asleep(undefined)).toBe(false);
  });
  it('is asked to play again by the next touch or key, and when the page is shown', () => {
    const { win, doc, ctx } = page(); let live = true;
    wakeOnReturn(() => ctx as never, () => live);
    win.dispatchEvent(new Event('pointerdown')); expect(ctx.resumes, 'running: left alone').toBe(0);
    ctx.state = 'interrupted';
    win.dispatchEvent(new Event('pointerdown')); expect(ctx.resumes).toBe(1);
    win.dispatchEvent(new Event('keydown')); expect(ctx.resumes).toBe(2);
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); expect(ctx.resumes, 'not while hidden').toBe(2);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); expect(ctx.resumes).toBe(3);
    ctx.state = 'closed'; win.dispatchEvent(new Event('pointerdown')); expect(ctx.resumes, 'a closed one is gone').toBe(3);
    ctx.state = 'suspended'; live = false; win.dispatchEvent(new Event('pointerdown')); expect(ctx.resumes, 'a disposed owner asks nothing').toBe(3);
  });
});
