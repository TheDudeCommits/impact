import type { RunResult } from '../../survival/SurvivalGame';
import { RANKS } from '../../survival/bosses';
import type { MatchReport, SurvivalReport, Report } from '../../game/economy/earn';

export function resultId() {
  try { return crypto.randomUUID().replace(/-/g, ''); }
  catch { return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')).join(''); }
}

export function survivalReport(result: RunResult): SurvivalReport | undefined {
  if (result.probe) return undefined;
  const log = result.bossLog ?? [];
  return { id: resultId(), mode: 'survival', coop: (result.party ?? 1) > 1, fighter: result.fighter, seconds: Math.round(result.seconds), round: result.round, rank: Math.max(0, RANKS.indexOf(result.rank)),
    bosses: result.bosses, finishers: result.finishers ?? log.filter(boss => boss.finished).length, sealed: !!result.sealed, score: Math.round(result.score), kills: result.ownKills ?? result.kills, style: result.bestRank,
    sBosses: log.filter(boss => boss.rank === 'S').length, fastBoss: log.length ? Math.min(...log.map(boss => boss.seconds)) : undefined };
}

export interface MatchSight {
  matchId?: string; reward?: {report: Report};
  status: 'waiting' | 'active' | 'finished'; roomMode: string; winnerId: string | null;
  lobby?: { visibility?: string };
  players: { id: string; fighter: string; alive: boolean; isBot: boolean; kills?: number }[];
}

export class MatchWatcher {
  constructor(private readonly placeOf?: (sight: MatchSight, self: string) => number | undefined) {}
  private paid = new Set<string>();
  private began = 0;
  private fought = false;
  private told = false;

  look(sight: MatchSight | undefined, self: string, seconds: number): Report | undefined {
    if (sight?.matchId) {
      const report = sight.reward?.report;
      if (!report || this.paid.has(report.id)) return undefined;
      this.paid.add(report.id); if(this.paid.size>64)this.paid.delete(this.paid.values().next().value!);
      return report;
    }
    if (!sight || sight.status === 'waiting' || sight.roomMode !== 'match') { this.began = 0; this.fought = false; this.told = false; return undefined; }
    const me = sight.players.find(player => player.id === self);
    if (!me) return undefined;
    if (sight.status === 'active') {
      if (!this.began) this.began = seconds;
      if (me.alive) this.fought = true;
    }
    if (this.told || !this.fought || (me.alive && sight.status !== 'finished')) return undefined;
    this.told = true;
    const standing = sight.players.filter(player => player.alive).length;
    const place = this.placeOf?.(sight, self) ?? (sight.winnerId === me.id ? 1 : me.alive ? Math.max(2, standing) : standing + 1);
    const others = sight.players.filter(player => player.id !== self);
    return { id: resultId(), mode: sight.lobby?.visibility === 'private' ? 'private' : others.length && others.every(player => player.isBot) ? 'bots' : 'match', fighter: me.fighter,
      seconds: Math.round(seconds - this.began), place, players: sight.players.length, kos: me.kills ?? 0 };
  }
}
