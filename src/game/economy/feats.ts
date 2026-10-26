import type { AccountStats } from './account';
import { levelOf } from './earn';

export interface Feat { id: string; name: string; text: string; pay: number; done: (stats: AccountStats, xp: number) => boolean }

export const FEATS: readonly Feat[] = [
  { id: 'first-run', name: 'Through the Rift', text: 'Finish a run or a match.', pay: 50, done: s => s.runs + s.matches >= 1 },
  { id: 'rank-c', name: 'Third Volume', text: 'Reach rank C in a run.', pay: 80, done: s => s.bestRank >= 3 },
  { id: 'rank-b', name: 'Serialised', text: 'Reach rank B in a run.', pay: 150, done: s => s.bestRank >= 4 },
  { id: 'rank-a', name: 'Front Cover', text: 'Reach rank A in a run.', pay: 250, done: s => s.bestRank >= 5 },
  { id: 's-rank', name: 'God Slayer', text: 'Beat a boss of rank S.', pay: 300, done: s => s.sBosses >= 1 },
  { id: 'seal', name: 'The Seal', text: 'Seal the rift.', pay: 500, done: s => s.seals >= 1 },
  { id: 'seal-3', name: 'Three Seals', text: 'Seal the rift three times.', pay: 400, done: s => s.seals >= 3 },
  { id: 'author', name: 'Author', text: 'Seal the rift with five different fighters.', pay: 500, done: s => s.sealedWith.length >= 5 },
  { id: 'finishers-25', name: 'The Last Word', text: 'Land twenty-five finishers.', pay: 200, done: s => s.finishers >= 25 },
  { id: 'bosses-100', name: 'A Hundred Pages', text: 'Beat a hundred bosses.', pay: 300, done: s => s.bosses >= 100 },
  { id: 'rounds-100', name: 'Long Runner', text: 'Clear a hundred rounds.', pay: 200, done: s => s.rounds >= 100 },
  { id: 'style-sss', name: 'Shōnen Legend', text: 'Reach style SSS.', pay: 150, done: s => s.bestStyle >= 6 },
  { id: 'fast-boss', name: 'One Page', text: 'Beat a boss in under twenty seconds.', pay: 100, done: s => s.fastBoss > 0 && s.fastBoss < 20 },
  { id: 'wins-1', name: 'First Blood', text: 'Win a match.', pay: 50, done: s => s.wins >= 1 },
  { id: 'wins-10', name: 'Ten Wins', text: 'Win ten matches.', pay: 200, done: s => s.wins >= 10 },
  { id: 'streak-7', name: 'A Week Running', text: 'Play seven days in a row.', pay: 150, done: s => s.bestStreak >= 7 },
  { id: 'level-40', name: 'Forty Volumes', text: 'Reach account level 40.', pay: 300, done: (_s, xp) => levelOf(xp).level >= 40 },
];
export const FEAT = new Map(FEATS.map(each => [each.id, each] as const));
