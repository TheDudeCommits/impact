import { describe, expect, it } from 'vitest';
import { LAG_HIDE_MS, LAG_SHOW_MS, LinkQuality, STALL_MS, STALL_NOTE_AGE_MS, STALL_NOTE_MS } from './linkQuality';

describe('the link to the match server', () => {
  it('says nothing while the link is good', () => {
    const link = new LinkQuality();
    for (let t = 0; t < 10_000; t += 33) link.heard(t);
    for (let t = 0; t < 10_000; t += 2000) { link.pong(link.ping(t), t + 24); }
    expect(link.rtt).toBeCloseTo(24, 0);
    expect(link.note(10_000)).toBeUndefined();
    expect(link.view(10_000)).toMatchObject({ rtt: 24, stalls: 0, longestStall: 0, pings: 5, pongs: 5 });
  });

  it('smooths the round trip and keeps the floor', () => {
    const link = new LinkQuality();
    for (const rtt of [200, 210, 190, 400, 205, 200]) link.pong(link.ping(1000), 1000 + rtt);
    expect(link.rtt).toBeGreaterThan(195);
    expect(link.rtt).toBeLessThan(260);
    expect(link.best).toBe(190);
    expect(link.jitter).toBeGreaterThan(0);
  });

  it('puts the round trip in the HUD past LAG_SHOW_MS and takes it down only below LAG_HIDE_MS', () => {
    const link = new LinkQuality();
    link.pong(0, LAG_SHOW_MS - 1);
    expect(link.note(1)).toBeUndefined();
    link.pong(0, LAG_SHOW_MS + 60);
    link.pong(0, LAG_SHOW_MS + 60);
    link.pong(0, LAG_SHOW_MS + 60);
    expect(link.note(2)).toMatch(/^LAG · \d+ MS$/);
    const link2 = new LinkQuality();
    for (let i = 0; i < 12; i++) link2.pong(0, LAG_SHOW_MS + 50);
    expect(link2.note(1)).toBe(`LAG · ${LAG_SHOW_MS + 50} MS`);
    const far = new LinkQuality();
    for (let i = 0; i < 12; i++) far.pong(0, 230);
    expect(far.note(1)).toBeUndefined();
    for (let i = 0; i < 12; i++) link2.pong(0, (LAG_SHOW_MS + LAG_HIDE_MS) / 2);
    expect(link2.note(2), 'between the lines: still showing').toMatch(/^LAG/);
    for (let i = 0; i < 24; i++) link2.pong(0, 60);
    expect(link2.note(3), 'below the lower line: gone').toBeUndefined();
  });

  it('calls a long silence between snapshots a stall, and says so for ten seconds', () => {
    const link = new LinkQuality();
    for (let t = 0; t < 1000; t += 33) link.heard(t);
    link.heard(1000);
    link.heard(1000 + STALL_MS - 1);
    expect(link.view(2000).stalls, 'just under the line is not a stall').toBe(0);
    const at = 1000 + STALL_MS - 1 + STALL_NOTE_MS + 100;
    link.heard(at);
    expect(link.view(at).stalls).toBe(1);
    expect(link.note(at + 1)).toMatch(/^UNSTABLE CONNECTION · 0\.\d S STALL$/);
    expect(link.note(at + STALL_NOTE_AGE_MS + 1), 'ten seconds on, the note goes').toBeUndefined();
    expect(link.view(at + STALL_NOTE_AGE_MS + 1).longestStall, 'the evidence keeps it for thirty').toBeGreaterThan(STALL_NOTE_MS);
  });

  it('ignores a pong that is not an echo', () => {
    const link = new LinkQuality();
    for (const junk of [undefined, null, 'x', NaN, Infinity, 1e9]) link.pong(junk, 500);
    link.pong(1000, 500);
    expect(link.pongs).toBe(0);
    expect(link.rtt).toBeNaN();
  });

  it('starts over', () => {
    const link = new LinkQuality();
    link.pong(0, 300); link.heard(0); link.heard(900);
    link.reset();
    expect(link.view(1000)).toMatchObject({ rtt: null, stalls: 0, pongs: 0 });
  });
});
