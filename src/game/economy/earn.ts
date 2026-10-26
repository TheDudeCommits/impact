import { FINAL_ROUND } from '../../survival/locations';

export interface SurvivalReport {
  id: string;
  mode: 'survival';
  coop?: boolean;
  fighter: string;
  seconds: number;
  round: number; rank: number;
  bosses: number; finishers: number;
  sealed?: boolean;
  score: number; kills: number;
  style: number;
  revives?: number;
  sBosses?: number; fastBoss?: number;
}
export interface MatchReport {
  id: string;
  mode: 'match' | 'bots' | 'private' | 'duel' | 'last-stand' | 'bad-blood';
  practice?: boolean; rounds?: number; revives?: number; repairs?: number; bossDamage?: number; assists?: number; rescues?: number; supplies?: number;
  fighter: string;
  seconds: number;
  place: number; players: number; kos: number;
}
export type Report = SurvivalReport | MatchReport;
export interface PayLine { label: string; amount: number }

export const PAY = {
  survival: { run: 5, round: 1.5, boss: 2, finisher: 2, rank: [0, 0, 3, 6, 10, 18, 30], seal: 60, revive: 2, revives: 6 },
  match: { played: 8, place: [20, 12, 8], topHalf: 4, ko: 2, kos: 10 },
  practice: .5,
  firstOfDay: 25,
  dailyCap: 200, past: .2,
  streak: [10, 15, 20, 25, 30, 40, 60],
  level: (level: number) => 40 + 5 * level,
  xp: 15,
} as const;
export const MIN_SECONDS = { survival: 90, match: 60 } as const;

export const roundsCleared = (report: SurvivalReport) => Math.max(0, report.sealed ? report.round : report.round - 1);

export function plausible(raw: Report, verified = false): { report: Report } | { refused: string } {
  const int = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  if (typeof raw?.id !== 'string' || !/^[A-Za-z0-9_-]{6,48}$/.test(raw.id)) return { refused: 'That result has no name.' };
  const fighter = String(raw.fighter ?? '').slice(0, 24), seconds = int(raw.seconds, 3 * 3600);
  if (raw.mode === 'survival') {
    if (!verified && seconds < MIN_SECONDS.survival) return { refused: 'A run that short earns nothing.' };
    const round = Math.max(1, Math.min(int(raw.round, 99), verified ? 99 : Math.floor(seconds / 40) + 1));
    const bosses = Math.min(int(raw.bosses, 200), round * 2 + 1), sealed = !!raw.sealed && round >= FINAL_ROUND;
    return { report: { id: raw.id, mode: 'survival', coop: !!raw.coop, fighter, seconds, round, rank: Math.min(int(raw.rank, 6), Math.floor((round - 1) / 2)), bosses,
      finishers: Math.min(int(raw.finishers, 200), bosses), sealed, score: int(raw.score, 1e9), kills: Math.min(int(raw.kills, 1e6), seconds * 12), style: int(raw.style, 6),
      revives: raw.coop ? int(raw.revives, 40) : 0, sBosses: Math.min(int(raw.sBosses, 20), round >= 13 ? bosses : 0), fastBoss: raw.fastBoss ? Math.max(3, Number(raw.fastBoss) || 0) : undefined } };
  }
  if (raw.mode === 'match' || raw.mode === 'bots' || raw.mode === 'private' || raw.mode === 'duel' || raw.mode === 'last-stand' || raw.mode === 'bad-blood') {
    if (!verified && seconds < MIN_SECONDS.match) return { refused: 'A match that short earns nothing.' };
    const players = Math.max(2, int(raw.players, 12));
    const kos = verified ? int(raw.kos, 1000000) : Math.min(int(raw.kos, 40), players * 3, Math.floor(seconds / 5), raw.mode === 'bots' ? players - 1 : raw.mode === 'duel' ? 3 : 40);
    const rounds = verified || raw.mode !== 'last-stand' ? int(raw.rounds, 100) : Math.min(int(raw.rounds, 100), Math.floor(seconds / 10) + 1);
    return { report: { id: raw.id, mode: raw.mode, fighter, seconds, players, practice: !!raw.practice, rounds, revives: int(raw.revives, 20), repairs: int(raw.repairs, 100000), bossDamage: int(raw.bossDamage, 1e7), assists: int(raw.assists, 1000), rescues: int(raw.rescues, 20), supplies: int(raw.supplies, 20), place: Math.max(1, Math.min(players, int(raw.place, 12) || players)), kos } };
  }
  return { refused: 'That is not a match this game plays.' };
}

export function payFor(report: Report): PayLine[] {
  const lines: PayLine[] = [], add = (label: string, amount: number) => { if (amount > 0) lines.push({ label, amount }); };
  if (report.mode === 'survival') {
    const p = PAY.survival, cleared = roundsCleared(report);
    add('Run fought', p.run);
    add(`${cleared} round${cleared === 1 ? '' : 's'} cleared`, cleared * p.round);
    add(`${report.bosses} boss${report.bosses === 1 ? '' : 'es'} beaten`, report.bosses * p.boss);
    add(`${report.finishers} finisher${report.finishers === 1 ? '' : 's'}`, report.finishers * p.finisher);
    add(`Rank ${'FEDCBAS'[report.rank]} reached`, p.rank[report.rank]);
    if (report.sealed) add('The rift sealed', p.seal);
    if (report.revives) add('Friends stood back up', Math.min(p.revives, report.revives * p.revive));
    return lines;
  }
  if (report.mode === 'duel' || report.mode === 'last-stand' || report.mode === 'bad-blood') {
    const k = report.practice ? PAY.practice : 1;
    add(report.mode === 'duel' ? 'Best-of-three set completed' : report.mode === 'last-stand' ? 'Village defence completed' : 'Team battle completed', 8 * k);
    if (report.place === 1) add(report.mode === 'duel' ? 'Set victory' : 'Team victory', 12 * k);
    if (report.mode === 'last-stand') add(`${report.rounds ?? 0} waves cleared`, Math.min(30, (report.rounds ?? 0) * 2));
    add(`${report.kos} knockouts`, Math.min(10, report.kos) * k);
    add(`${report.revives ?? 0} teammate rescue${report.revives === 1 ? '' : 's'}`, Math.min(12, (report.revives ?? 0) * 3));
    add(`${report.repairs ?? 0} village health repaired`, Math.min(12, Math.floor((report.repairs ?? 0) / 200)));
    add(`${report.bossDamage ?? 0} boss damage`, Math.min(15, Math.floor((report.bossDamage ?? 0) / 200)));
    add(`${report.assists ?? 0} teamwork assists`, Math.min(10, report.assists ?? 0) * k);
    add(`${report.rescues ?? 0} civilian rescues`, Math.min(8, (report.rescues ?? 0) * 4));
    add(`${report.supplies ?? 0} supply recoveries`, Math.min(8, (report.supplies ?? 0) * 4));
    return lines;
  }
  const p = PAY.match, k = report.mode === 'match' ? 1 : PAY.practice;
  add(report.mode === 'match' ? 'Match played' : report.mode === 'bots' ? 'Match against bots' : 'Private match', p.played * k);
  const placed = report.place <= p.place.length ? p.place[report.place - 1] : report.place <= Math.ceil(report.players / 2) ? p.topHalf : 0;
  add(report.place === 1 ? 'Won' : `Placed ${report.place} of ${report.players}`, placed * k);
  add(`${report.kos} knockout${report.kos === 1 ? '' : 's'}`, Math.min(p.kos, report.kos * p.ko) * k);
  return lines;
}

export function underCap(amount: number, paidToday: number, past: number = PAY.past): number {
  const whole = Math.max(0, Math.min(amount, PAY.dailyCap - paidToday));
  return whole + (amount - whole) * past;
}

export const MAX_LEVEL = 60;
export const LEVEL_FLAT = { from: 14, xp: 360 } as const;
export const xpAt = (level: number): number => level <= LEVEL_FLAT.from ? 60 * (level - 1) + 12 * (level - 1) ** 2 : xpAt(LEVEL_FLAT.from) + LEVEL_FLAT.xp * (level - LEVEL_FLAT.from);
export function levelOf(xp: number) {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpAt(level + 1)) level++;
  const from = xpAt(level), to = level < MAX_LEVEL ? xpAt(level + 1) : from;
  return { level, into: xp - from, span: Math.max(1, to - from), max: level >= MAX_LEVEL };
}

export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export function weekOf(ms: number) {
  const d = new Date(ms); d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return `${d.getUTCFullYear()}-W${String(1 + Math.round(((d.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
}
