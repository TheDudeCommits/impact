import type { ArenaSimulation } from '../simulation';
import type { GameSnapshot } from '../types';

export interface DuelView {
  set: number; round: number; firstTo: 2; scores: Record<string, number>;
  phase: 'playing' | 'interval' | 'complete'; nextRoundAt: number | null;
  roundWinner: string | null; winner: string | null; runback: string[]; startedAt?: number | null;
}
export class DuelSet {
  readonly view: DuelView = { set: 1, round: 1, firstTo: 2, scores: {}, phase: 'playing', nextRoundAt: null, roundWinner: null, winner: null, runback: [] };
  startedAt: number | null = null;
  private totals = new Map<string, { kills: number; damageDealt: number; damageTaken: number }>();
  private tally(sim: ArenaSimulation) {
    for (const p of sim.playerStates()) {
      const total = this.totals.get(p.id) ?? { kills: 0, damageDealt: 0, damageTaken: 0 };
      total.kills += p.kills ?? 0; total.damageDealt += p.damageDealt ?? 0; total.damageTaken += p.damageTaken ?? 0; this.totals.set(p.id, total);
    }
  }
  step(sim: ArenaSimulation) {
    const v = this.view;
    if (v.phase === 'complete') return;
    if (v.phase === 'interval') {
      if (sim.serverTime >= (v.nextRoundAt ?? Infinity)) {
        sim.status = 'waiting'; sim.startMatch(); v.phase = 'playing'; v.nextRoundAt = null;
      }
      return;
    }
    if (sim.status === 'active') { this.startedAt ??= sim.serverTime; v.startedAt = this.startedAt; }
    if (sim.status !== 'finished' || this.startedAt === null) return;
    this.tally(sim);
    v.roundWinner = sim.winnerId;
    if (sim.winnerId) v.scores[sim.winnerId] = (v.scores[sim.winnerId] ?? 0) + 1;
    if (sim.winnerId && v.scores[sim.winnerId] >= 2) { v.phase = 'complete'; v.winner = sim.winnerId; }
    else { v.phase = 'interval'; v.nextRoundAt = sim.serverTime + 3; v.round++; }
  }
  forfeit(sim: ArenaSimulation, winner: string | null) {
    if (this.startedAt === null || this.view.phase === 'complete') return;
    if (this.view.phase === 'playing') this.tally(sim);
    this.view.phase = 'complete'; this.view.winner = winner; this.view.nextRoundAt = null;
    sim.status = 'finished'; sim.winnerId = winner;
  }
  request(sim: ArenaSimulation, id: string): boolean {
    if (this.view.phase !== 'complete' || !sim.actors.has(id) || sim.actors.size !== 2) return false;
    if (!this.view.runback.includes(id)) this.view.runback.push(id);
    if (sim.playerStates().some(p => !p.isBot && !this.view.runback.includes(p.id))) return false;
    Object.assign(this.view, { set: this.view.set + 1, round: 1, scores: {}, phase: 'interval', nextRoundAt: sim.serverTime + 2, winner: null, roundWinner: null, runback: [] });
    this.startedAt = null; this.view.startedAt = null; this.totals.clear(); return true;
  }
  snapshot(snapshot: GameSnapshot): GameSnapshot {
    const v = this.view;
    snapshot.duel = { ...v, scores: { ...v.scores }, runback: [...v.runback] };
    if (v.phase === 'interval') { snapshot.status = 'waiting'; if (snapshot.lobby) snapshot.lobby.startsAt = v.nextRoundAt; }
    if (v.phase === 'complete' && this.totals.size) snapshot.players = snapshot.players.map(p => ({ ...p, ...(this.totals.get(p.id) ?? {}) }));
    return snapshot;
  }
}
