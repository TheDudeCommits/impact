import { settle, type Account } from '../../game/economy/account';
import { plausible, type Report } from '../../game/economy/earn';
import { DEVICE_MODES, isDeviceId } from '../../game/economy/device';
import type { Book } from './book';
import type { Completion } from './completions';

export const DEVICE_LIMITS = {
  perHour: 20,
  slack: 1.2,
  first: 120,
} as const;

export type DeviceOutcome = { completion: Completion; account: Account } | { refused: string; status: 400 | 429 };

export class DeviceReports {
  private paid?: Map<string, number[]>;
  constructor(private readonly book: Book) {}

  private times(pk: string): number[] {
    if (!this.paid) {
      this.paid = new Map();
      for (const c of this.book.completions.values()) if (isDeviceId(c.matchId)) { const list = this.paid.get(c.pk) ?? []; list.push(c.completedAt); this.paid.set(c.pk, list); }
      for (const list of this.paid.values()) list.sort((a, b) => a - b);
    }
    return this.paid.get(pk) ?? [];
  }

  settle(account: Account, raw: Report, now: number): DeviceOutcome {
    const key = `${raw.id}:${account.pk}`, known = this.book.completions.get(key);
    if (known) return { completion: known, account };
    const checked = plausible(raw, false);
    if ('refused' in checked) return { refused: checked.refused, status: 400 };
    if (!DEVICE_MODES.includes(checked.report.mode)) return { refused: 'That match is not played on a device.', status: 400 };
    const report: Report = checked.report.mode === 'survival' ? { ...checked.report, coop: false, revives: 0 } : { ...checked.report, practice: true };
    const times = this.times(account.pk), hour = now - 3600_000;
    if (times.filter(at => at > hour).length >= DEVICE_LIMITS.perHour) return { refused: `That is more than ${DEVICE_LIMITS.perHour} matches on this device in an hour.`, status: 429 };
    const last = times.length ? times[times.length - 1] : undefined, since = last ?? (Number.isFinite(account.created) ? account.created : now);
    const allowed = Math.max(0, now - since) / 1000 * DEVICE_LIMITS.slack + (last === undefined ? DEVICE_LIMITS.first : 0);
    if (report.seconds > allowed) return { refused: 'That result is too long for the time since your last one.', status: 429 };
    const next = structuredClone(account), settlement = settle(next, report, now, false, 0);
    if (settlement.refused) return { refused: settlement.refused, status: 400 };
    const completion: Completion = { matchId: report.id, pk: account.pk, completedAt: now, report, settlement };
    this.book.record('earn', next, { amount: settlement.total, why: `device:${report.mode}:${report.id}`, completion });
    this.book.accounts.set(account.pk, next); this.book.completions.set(key, completion);
    this.paid!.set(account.pk, [...times.filter(at => at > hour), now]);
    return { completion, account: next };
  }
}
