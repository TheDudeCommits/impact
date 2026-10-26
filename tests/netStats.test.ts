import { describe, expect, it } from 'vitest';
import { NetStats } from '../src/server/netStats';

describe('the server says how it is doing', () => {
  it('stays quiet while nobody is connected, and prints one line when somebody is', () => {
    const stats = new NetStats();
    expect(stats.line(60), 'an idle server has nothing to say').toBeUndefined();
    stats.census = () => ({ rooms: 2, players: 7 });
    for (let i = 0; i < 100; i++) stats.onTick(1.5);
    stats.onTick(41);
    for (let i = 0; i < 50; i++) stats.onSnapshots(2.5);
    stats.onOwed(5); stats.onOwed(1); stats.onWrittenOff(30);
    const line = stats.line(60)!;
    expect(line).toMatch(/^\[net\] 60 s · 2 rooms 7 players · tick avg 1\.9 p99 \d+(\.\d+)? max 41\.0 ms \(101\)/);
    expect(line).toContain('snapshots avg 2.5');
    expect(line).toContain('late steps 1, written off 30');
    expect(line).toMatch(/rss \d+ MB heap \d+ MB$/);
    expect(stats.line(60)).toMatch(/tick avg 0\.0 p99 0\.0 max 0\.0 ms \(0\)/);
  });

  it('reports a ceiling for the 99th percentile that is never above the worst tick', () => {
    const stats = new NetStats();
    for (let i = 0; i < 1000; i++) stats.onTick(i < 985 ? 1 : 20);
    expect(stats.tick.quantile(.5)).toBe(1);
    expect(stats.tick.quantile(.99)).toBeGreaterThanOrEqual(16.7);
    expect(stats.tick.quantile(.99)).toBeLessThanOrEqual(20);
    expect(stats.tick.quantile(1)).toBe(20);
  });

  it('prints through the sink it is given, on the interval it is given, and stops', async () => {
    const stats = new NetStats();
    stats.census = () => ({ rooms: 1, players: 1 });
    const lines: string[] = [];
    stats.start(.05, line => lines.push(line));
    stats.onTick(2);
    await new Promise(resolve => setTimeout(resolve, 130));
    stats.stop();
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]).toMatch(/^\[net\] 0\.05 s/);
    const printed = lines.length;
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(lines.length).toBe(printed);
  });

  it('is off with NET_LOG_SECONDS=0', () => {
    const stats = new NetStats();
    stats.start(0, () => { throw new Error('should not print'); });
    stats.stop();
  });
});
