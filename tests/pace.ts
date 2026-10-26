import { newAccount, settle, type Account } from '../src/game/economy/account';
import { levelOf, type MatchReport, type Report, type SurvivalReport } from '../src/game/economy/earn';

type Match = Omit<SurvivalReport, 'id'> | Omit<MatchReport, 'id'>;
export const regularDay = (d: number): Match[] => [
  { mode: 'match', fighter: 'goku', seconds: 240, place: 4, players: 8, kos: 1 },
  { mode: 'bots', fighter: 'naruto', seconds: 240, place: 3, players: 8, kos: 2 },
  { mode: 'duel', fighter: 'zoro', seconds: 300, place: d % 2 ? 1 : 2, players: 2, kos: 2, rounds: 2 },
  { mode: 'last-stand', fighter: 'luffy', seconds: 600, place: d % 2 ? 2 : 1, players: 4, kos: 4, rounds: 6, revives: 1, assists: 2, rescues: 1, supplies: 1, repairs: 400, bossDamage: 600 },
  { mode: 'bad-blood', fighter: 'sasuke', seconds: 420, place: d % 2 ? 1 : 2, players: 6, kos: 3, assists: 2 },
  { mode: 'survival', coop: true, fighter: 'goku', seconds: 900, round: 5, rank: 3, bosses: 4, finishers: 1, kills: 700, style: 2, score: 400000, revives: 1 },
];
export const PLAYERS = {
  casual: (d: number) => regularDay(d).slice(0, 3),
  regular: regularDay,
  keen: (d: number) => [...regularDay(d), ...regularDay(d + 1)],
} as const;

export interface PaceDay { day: number; level: number; xp: number; earned: number; balance: number; paidToday: number }
export function play(days: number, who: (d: number) => Match[] = regularDay, start = Date.UTC(2026, 9, 12, 9)): { account: Account; days: PaceDay[] } {
  const account = newAccount('pace', start), out: PaceDay[] = [];
  let n = 0;
  for (let d = 0; d < days; d++) {
    const before = account.earned;
    who(d).forEach((match, i) => { settle(account, { ...match, id: `pace-${d}-${i}-${n++}` } as Report, start + d * 86_400_000 + i * 900_000, true); });
    out.push({ day: d + 1, level: levelOf(account.xp).level, xp: account.xp, earned: account.earned, balance: account.balance, paidToday: account.earned - before });
  }
  return { account, days: out };
}
export const dayOfLevel = (days: readonly PaceDay[], level: number) => days.find(each => each.level >= level)?.day ?? Infinity;
export const dayOfSumi = (days: readonly PaceDay[], sumi: number) => days.find(each => each.earned >= sumi)?.day ?? Infinity;
