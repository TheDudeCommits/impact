import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Economy } from '../src/server/economy/api';
import { Book } from '../src/server/economy/book';
import { DEVICE_LIMITS } from '../src/server/economy/deviceReports';
import { deviceId } from '../src/game/economy/device';
import { PAY, payFor, plausible, underCap, type MatchReport, type Report, type SurvivalReport } from '../src/game/economy/earn';
import type { Account, Settlement } from '../src/game/economy/account';

const clock = (start = Date.UTC(2026, 9, 8, 12)) => { let at = start; const now = () => at; now.pass = (seconds: number) => { at += seconds * 1000; }; return now; };
type Answer = { account: Account; token?: string; settlement?: Settlement };
const guest = (e: Economy) => e.hello(undefined) as unknown as Answer & { token: string };
const duel = (over: Partial<MatchReport> = {}): MatchReport => ({ id: deviceId(), mode: 'duel', fighter: 'naruto', seconds: 120, place: 1, players: 2, kos: 2, ...over });
const royale = (over: Partial<MatchReport> = {}): MatchReport => ({ id: deviceId(), mode: 'bots', fighter: 'goku', seconds: 240, place: 1, players: 8, kos: 4, ...over });
const sealed = (over: Partial<SurvivalReport> = {}): SurvivalReport => ({ id: deviceId(), mode: 'survival', fighter: 'zoro', seconds: 1500, round: 14, rank: 6, bosses: 14, finishers: 6, sealed: true, score: 9e6, kills: 4000, style: 4, ...over });
function refusal(call: () => unknown): { message: string; status: number } {
  try { call(); } catch (error) { return { message: (error as Error).message, status: (error as { status?: number }).status ?? 500 }; }
  throw new Error('It was paid.');
}
const sum = (lines: { amount: number }[]) => lines.reduce((n, line) => n + line.amount, 0);
const labels = (report: Report) => new Set(payFor(report).map(line => line.label));

describe('on-device matches: paid from their reports, within caps', () => {
  it('pays a versus match at the practice rate and settles each id once, whatever is sent again', () => {
    const now = clock(), e = new Economy({ dir: false, now }); try {
      const a = guest(e); now.pass(3600);
      const record = vi.spyOn(e.book, 'record');
      const report = duel({ practice: false }), paid = e.report(a.token, report) as Answer;
      expect(paid.settlement!.lines.filter(line => labels(report).has(line.label))).toEqual([{ label: 'Best-of-three set completed', amount: 4 }, { label: 'Set victory', amount: 6 }, { label: '2 knockouts', amount: 1 }]);
      expect(paid.account.balance).toBe(paid.settlement!.total); expect(e.book.accounts.get(a.account.pk)!.balance).toBe(paid.settlement!.total);
      expect(record).toHaveBeenCalledWith('earn', expect.objectContaining({ pk: a.account.pk }), expect.objectContaining({ why: `device:duel:${report.id}`, amount: paid.settlement!.total }));
      const kept = e.book.completions.get(`${report.id}:${a.account.pk}`)!;
      expect((kept.report as MatchReport).practice).toBe(true); expect(kept.settlement).toEqual(paid.settlement);
      const again = e.report(a.token, { ...report, kos: 40, seconds: 900, place: 1 }) as Answer;
      expect(again.settlement).toEqual(paid.settlement); expect(again.account.balance).toBe(paid.settlement!.total); expect(record).toHaveBeenCalledTimes(1);
      now.pass(600);
      const field = royale(), bots = e.report(a.token, field) as Answer;
      expect(sum(bots.settlement!.lines.filter(line => labels(field).has(line.label)))).toBe(sum(payFor({ ...field, mode: 'match' })) * PAY.practice);
    } finally { e.close(); }
  });

  it('pays only the modes a device plays, held to the rules, and leaves server ids as they were', () => {
    const now = clock(), e = new Economy({ dir: false, now }); try {
      const a = guest(e); now.pass(3600);
      expect(refusal(() => e.report(a.token, royale({ mode: 'match' })))).toEqual({ message: 'That match is not played on a device.', status: 400 });
      expect(refusal(() => e.report(a.token, royale({ mode: 'private' }))).status).toBe(400);
      expect(refusal(() => e.report(a.token, duel({ seconds: 30 })))).toEqual({ message: 'A match that short earns nothing.', status: 400 });
      expect(refusal(() => e.report(a.token, sealed({ seconds: 60 })))).toEqual({ message: 'A run that short earns nothing.', status: 400 });
      const run = sealed({ coop: true, revives: 9 }), paid = e.report(a.token, run) as Answer;
      expect(e.book.completions.get(`${run.id}:${a.account.pk}`)!.report).toMatchObject({ coop: false, revives: 0 });
      expect(paid.settlement!.lines.some(line => /Friends/.test(line.label))).toBe(false);
      expect(refusal(() => e.report(a.token, { ...duel(), id: 'room-match-0001' })).message).toMatch(/No completed server match/);
      const room = e.complete(a.account.pk, { ...duel(), id: 'room-match-0001' })!;
      expect((e.report(a.token, { ...duel(), id: 'room-match-0001', kos: 99 }) as Answer).settlement).toEqual(room.settlement);
      expect(room.settlement.lines.find(line => line.label === 'Best-of-three set completed')?.amount).toBe(8);
    } finally { e.close(); }
  });

  it('holds reports to the wall clock: the time since the last, and since the account opened for the first', () => {
    const now = clock(), e = new Economy({ dir: false, now }); try {
      const a = guest(e);
      expect(refusal(() => e.report(a.token, royale({ seconds: 300 })))).toEqual({ message: 'That result is too long for the time since your last one.', status: 429 });
      expect((e.report(a.token, royale({ seconds: DEVICE_LIMITS.first })) as Answer).settlement!.total).toBeGreaterThan(0);
      expect(refusal(() => e.report(a.token, royale({ seconds: 60 }))).status).toBe(429);
      now.pass(50);
      expect(refusal(() => e.report(a.token, royale({ seconds: 61 }))).status).toBe(429);
      expect((e.report(a.token, royale({ seconds: 60 })) as Answer).settlement).toBeDefined();
      const later = royale({ seconds: 200 });
      expect(refusal(() => e.report(a.token, later)).status).toBe(429);
      now.pass(170);
      expect((e.report(a.token, later) as Answer).settlement).toBeDefined();
      const b = guest(e); now.pass(3 * 3600);
      expect((e.report(b.token, sealed({ seconds: 3 * 3600 })) as Answer).settlement).toBeDefined();
    } finally { e.close(); }
  });

  it('pays at most twenty an hour, answering a settled id all the same', () => {
    const now = clock(), e = new Economy({ dir: false, now }); try {
      const a = guest(e); now.pass(3600);
      const first = duel({ seconds: 60 }), paid = e.report(a.token, first) as Answer; now.pass(60);
      for (let i = 1; i < DEVICE_LIMITS.perHour; i++) { e.report(a.token, duel({ seconds: 60 })); now.pass(60); }
      expect(refusal(() => e.report(a.token, duel({ seconds: 60 })))).toEqual({ message: 'That is more than 20 matches on this device in an hour.', status: 429 });
      expect((e.report(a.token, first) as Answer).settlement).toEqual(paid.settlement);
      now.pass(3600 - DEVICE_LIMITS.perHour * 60 + 1);
      expect((e.report(a.token, duel({ seconds: 60 })) as Answer).settlement).toBeDefined();
    } finally { e.close(); }
  });

  it("stops at the day's cap with nothing past it - pay or experience - and still counts and pays missions", () => {
    const now = clock(), e = new Economy({ dir: false, now }); try {
      const a = guest(e); now.pass(7200);
      const asked = sum(payFor(sealed()));
      expect(asked).toBeGreaterThan(PAY.dailyCap / 2); expect(asked).toBeLessThan(PAY.dailyCap);
      const one = (e.report(a.token, sealed()) as Answer).settlement!; now.pass(1500);
      expect(one.capped).toBe(false);
      const two = (e.report(a.token, sealed()) as Answer).settlement!; now.pass(1500);
      expect(two.capped).toBe(true);
      const ownLabels = labels(sealed());
      expect(sum(two.lines.filter(line => ownLabels.has(line.label)))).toBeCloseTo(PAY.dailyCap - asked, -1);
      const before = structuredClone(e.book.accounts.get(a.account.pk)!);
      const three = (e.report(a.token, sealed()) as Answer).settlement!, after = e.book.accounts.get(a.account.pk)!;
      expect(three.capped).toBe(true);
      expect(three.lines.filter(line => ownLabels.has(line.label))).toEqual([]);
      expect(three.xp).toBe(three.missions.length * 10);
      expect(after.day.played).toBe(before.day.played + 1);
      expect(after.week.progress).not.toEqual(before.week.progress);
      expect(three.total).toBe(sum(three.lines));
      expect(underCap(50, 400, 0)).toBe(0); expect(underCap(50, 180, 0)).toBe(20);
      const room = e.complete(a.account.pk, { ...sealed(), id: 'room-run-000001' })!;
      expect(sum(room.settlement.lines.filter(line => ownLabels.has(line.label)))).toBeCloseTo(asked * PAY.past, -1);
    } finally { e.close(); }
  });

  it('holds unverified reports to their length: knockouts, and Last Stand waves', () => {
    const fast = plausible(royale({ seconds: 60, kos: 30, players: 4 })), duelled = plausible(duel({ seconds: 600, kos: 9 }));
    const waves = plausible({ id: deviceId(), mode: 'last-stand', fighter: 'naruto', seconds: 100, place: 2, players: 4, kos: 9, rounds: 60 });
    if ('refused' in fast || 'refused' in duelled || 'refused' in waves) throw new Error('refused');
    expect((fast.report as MatchReport).kos).toBe(3); expect((duelled.report as MatchReport).kos).toBe(3); expect((waves.report as MatchReport).rounds).toBe(11);
    const room = plausible({ ...royale({ seconds: 60, kos: 30 }), mode: 'match' }, true);
    expect('report' in room && (room.report as MatchReport).kos).toBe(30);
  });

  it('refuses for later when the book cannot be kept', () => {
    const dir = mkdtempSync(join(tmpdir(), 'device-unkept-'));
    try {
      writeFileSync(join(dir, 'a-file'), 'x');
      const now = clock(), e = new Economy({ dir: join(dir, 'a-file', 'economy'), now }), a = guest(e); now.pass(3600);
      expect(refusal(() => e.report(a.token, duel()))).toEqual({ message: 'Results cannot be kept just now.', status: 429 });
      e.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('on-device completions in the book: written as a room completion is, replayed by the v26 code', () => {
  it('writes the same line a room completion writes, replays it after a crash and after a clean stop, and answers it again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'device-ledger-'));
    let first: Economy | undefined, replayed: Economy | undefined, reopened: Economy | undefined;
    try {
      const now = clock();
      first = new Economy({ dir, now }); const a = guest(first); now.pass(3600);
      const device: Report[] = [duel(), sealed({ seconds: 1200 })];
      const paid = device.map(report => { const answer = (first!.report(a.token, report) as Answer).settlement!; now.pass(1500); return answer; });
      const room = first.complete(a.account.pk, { ...duel(), id: 'room-duel-000001' })!;
      const balance = first.book.accounts.get(a.account.pk)!.balance;
      const lines = readFileSync(join(dir, 'ledger.jsonl'), 'utf8').split('\n').filter(Boolean).map(raw => JSON.parse(raw) as Record<string, unknown> & { completion?: Record<string, unknown>; after?: Record<string, unknown> });
      const ours = lines.filter(line => String(line.why).startsWith('device:')), theirs = lines.find(line => String(line.why).startsWith('verified:'))!;
      expect(ours.map(line => line.why)).toEqual([`device:duel:${device[0].id}`, `device:survival:${device[1].id}`]);
      for (const line of ours) {
        expect(line.t).toBe('earn'); expect(Object.keys(line).sort()).toEqual(Object.keys(theirs).sort());
        expect(Object.keys(line.completion!).sort()).toEqual(Object.keys(theirs.completion!).sort());
        expect(Object.keys(line.after!).sort()).toEqual(Object.keys(theirs.after!).sort());
      }
      replayed = new Economy({ dir, now });
      const book = new Book(dir);
      for (const [i, report] of device.entries()) {
        for (const each of [replayed.book, book]) expect(each.completions.get(`${report.id}:${a.account.pk}`)!.settlement).toEqual(paid[i]);
        expect((replayed.report(a.token, { ...report, seconds: 61 }) as Answer).settlement).toEqual(paid[i]);
      }
      expect(book.completions.get(`room-duel-000001:${a.account.pk}`)!.settlement).toEqual(room.settlement);
      expect(replayed.book.accounts.get(a.account.pk)!.balance).toBe(balance); expect(book.accounts.get(a.account.pk)!.balance).toBe(balance);
      book.close();
      expect(refusal(() => replayed!.report(a.token, duel({ seconds: 3000 }))).status).toBe(429);
      replayed.close(); replayed = undefined;
      reopened = new Economy({ dir, now });
      expect(reopened.book.completions.get(`${device[1].id}:${a.account.pk}`)!.settlement).toEqual(paid[1]);
      expect(reopened.book.accounts.get(a.account.pk)!.balance).toBe(balance);
    } finally { reopened?.close(); replayed?.close(); first?.close(); rmSync(dir, { recursive: true, force: true }); }
  });
});
