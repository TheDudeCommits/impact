import type { Report } from './earn';

export interface Mission { id: string; text: string; goal: number; pay: number; count: (report: Report, fresh: { fighter: boolean }) => number }

const DAILY_PAY = 40, WEEKLY_PAY = 150;
export const ALL_DAILY_BONUS = 60;
const daily = (id: string, text: string, goal: number, count: Mission['count']): Mission => ({ id: `d-${id}`, text, goal, pay: DAILY_PAY, count });
const weekly = (id: string, text: string, goal: number, count: Mission['count']): Mission => ({ id: `w-${id}`, text, goal, pay: WEEKLY_PAY, count });

const knockouts = (r: Report) => r.mode === 'survival' ? r.bosses : r.kos;
const won = (r: Report) => r.mode === 'survival' ? r.sealed || r.rank >= 4 : r.place === 1;
const podium = (r: Report) => r.mode === 'survival' ? r.rank >= 3 : r.mode === 'duel' || r.mode === 'last-stand' || r.mode === 'bad-blood' ? r.place === 1 : r.place <= 3;

export const DAILY: readonly Mission[] = [
  daily('play-3', 'Play three matches', 3, () => 1),
  daily('play-5', 'Play five matches', 5, () => 1),
  daily('minutes-20', 'Fight for twenty minutes', 20, r => r.seconds / 60),
  daily('fighters-2', 'Play two different fighters', 2, (_r, fresh) => fresh.fighter ? 1 : 0),
  daily('kos-5', 'Five knockouts (fighters or bosses)', 5, knockouts),
  daily('top-3', 'Finish in the top three', 1, r => podium(r) ? 1 : 0),
  daily('win-1', 'Win a match', 1, r => won(r) ? 1 : 0),
];
export const WEEKLY: readonly Mission[] = [
  weekly('play-20', 'Play twenty matches', 20, () => 1),
  weekly('wins-3', 'Win three matches', 3, r => won(r) ? 1 : 0),
  weekly('hours-2', 'Fight for two hours', 120, r => r.seconds / 60),
  weekly('kos-40', 'Forty knockouts (fighters or bosses)', 40, knockouts),
  weekly('top-3-6', 'Finish in the top three six times', 6, r => podium(r) ? 1 : 0),
];

export function pick(pool: readonly Mission[], key: string): Mission[] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const left = [...pool], out: Mission[] = [];
  while (out.length < 3 && left.length) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; out.push(left.splice(h % left.length, 1)[0]); }
  return out;
}
export const dailyMissions = (day: string) => pick(DAILY, `day:${day}`);
export const weeklyMissions = (week: string) => pick(WEEKLY, `week:${week}`);
