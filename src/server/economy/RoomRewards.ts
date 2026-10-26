import { randomUUID } from 'node:crypto';
import type { GameSnapshot, PlayerInput } from '../../game/types';
import type { MatchReport } from '../../game/economy/earn';
import { objectiveOf } from '../../game/objectives/model';
import { sharedEconomy } from './api';
import type { RoomEconomy } from '../cluster/economyLink';
import type { SurvivalGame } from '../../survival/SurvivalGame';
import { RANKS } from '../../survival/bosses';

export class RoomRewards {
  matchId = randomUUID();
  private bindings = new Map<string, string>();
  private tokens = new Map<string, unknown>();
  private active = new Set<string>();
  private started: number | undefined;
  private done = false;
  private lastSet = 1;
  private loggedAt = -Infinity;
  private fieldSize = 0;
  private places = new Map<string, number>();
  constructor(private economy: () => RoomEconomy | undefined = sharedEconomy) {}
  bind(id: string, token: unknown, lateJoin = false) {
    if (this.started !== undefined && !lateJoin || this.bindings.has(id)) return;
    const account = this.economy()?.book.find(token);
    if (account && ![...this.bindings.values()].includes(account.pk)) { this.bindings.set(id, account.pk); this.tokens.set(id, token); }
  }
  private pk(id: string, original: string) { return this.economy()?.book.find(this.tokens.get(id))?.pk ?? original; }
  private complete(pk: string, report: import('../../game/economy/earn').Report) {
    try { return !!this.economy()?.complete(pk, report); }
    catch (error) { if (Date.now() - this.loggedAt > 10000) { console.error('[rewards] completion pending durable storage', error); this.loggedAt = Date.now(); } return false; }
  }
  next(set: number) {
    if (set === this.lastSet) return;
    this.lastSet = set; this.matchId = randomUUID(); this.started = undefined; this.done = false; this.active.clear(); this.places.clear(); this.fieldSize = 0;
  }
  survival(game: SurvivalGame, run: number) {
    this.next(run);
    if (game.phase !== 'lobby' && game.phase !== 'over') this.started ??= game.sim.serverTime;
    if (this.done || this.started === undefined || game.phase !== 'over') return;
    const economy = this.economy(); if (!economy) return;
    let completed = true;
    for (const [id, pk] of this.bindings) {
      const r = game.view(id).result;
      if (!r || r.probe || !this.active.has(id) || r.seconds < 10) continue;
      const log = r.bossLog ?? [];
      completed = this.complete(this.pk(id,pk), { id: this.matchId, mode: 'survival', coop: true, fighter: r.fighter,
        seconds: r.seconds, round: r.round, rank: Math.max(0, RANKS.indexOf(r.rank)), bosses: r.bosses,
        finishers: r.finishers ?? 0, sealed: !!r.sealed, score: r.score, kills: r.ownKills ?? r.kills,
        style: r.bestRank, sBosses: log.filter(b => b.rank === 'S').length,
        fastBoss: log.length ? Math.min(...log.map(b => b.seconds)) : undefined }) && completed;
    }
    this.done = completed;
  }
  leave(id: string) { this.bindings.delete(id); this.tokens.delete(id); this.active.delete(id); }
  input(id: string, input: PlayerInput) {
    if (this.started !== undefined && (Math.hypot(input.moveX, input.moveZ) > .1 || input.attack || input.guard || input.dash || input.jump)) this.active.add(id);
  }
  observe(snapshot: GameSnapshot) {
    const objective = objectiveOf(snapshot), set = snapshot.duel?.set ?? objective?.round ?? 1;
    this.next(set);
    if (snapshot.status === 'active' && this.started === undefined) { this.started = snapshot.serverTime; this.fieldSize = objective?.seats.length ?? snapshot.players.length; }
    if (!objective && !snapshot.duel && this.started !== undefined) for (const e of snapshot.events) {
      if (e.kind === 'eliminated' && e.targetId && !this.places.has(e.targetId)) this.places.set(e.targetId, Math.max(2, this.fieldSize - this.places.size));
    }
    if (this.done || this.started === undefined || snapshot.status !== 'finished') return;
    if (objective ? objective.phase !== 'over' : snapshot.roomMode !== 'match') return;
    const seconds = Math.max(0, snapshot.serverTime - this.started);
    const economy = this.economy(); if (!economy) return;
    let completed = true;
    for (const [id, pk] of this.bindings) {
      const p = snapshot.players.find(p => p.id === id), seat = objective?.seats.find(s => s.id === id);
      const contributed = (p?.damageDealt ?? 0) > 0 || (seat?.revives ?? 0) > 0 || (seat?.repairs ?? 0) > 0 || (seat?.assists ?? 0) > 0 || (seat?.rescues ?? 0) > 0 || (seat?.supplies ?? 0) > 0;
      if (!p || p.isBot || p.forge || seat?.bot || !this.active.has(id) && !contributed || seconds < 10) continue;
      const won = objective ? objective.winner === seat?.team : snapshot.winnerId === id;
      const practice = snapshot.lobby?.visibility === 'private' || objective?.access === 'host' || objective?.access === 'join';
      const report: MatchReport = { id: this.matchId, fighter: p.fighter, seconds: Math.floor(seconds),
        mode: objective?.kind ?? (snapshot.duel ? 'duel' : practice ? 'private' : snapshot.players.filter(q => q.id !== id).every(q => q.isBot) ? 'bots' : 'match'),
        practice, place: won ? 1 : objective || snapshot.duel ? 2 : this.places.get(id) ?? Math.max(2, this.fieldSize - this.places.size),
        players: this.fieldSize, kos: p.kills ?? 0,
        rounds: objective?.village ? Math.max(0, objective.village.wave - (objective.village.phase === 'assault' ? 1 : 0)) : snapshot.duel?.scores[id] ?? 0,
        revives: seat?.revives ?? 0, repairs: seat?.repairs ?? 0, bossDamage: seat?.bossDamage ?? 0,
        assists: seat?.assists ?? 0, rescues: seat?.rescues ?? 0, supplies: seat?.supplies ?? 0 };
      completed = this.complete(this.pk(id,pk), report) && completed;
    }
    this.done = completed;
  }
  forOwner<T extends GameSnapshot>(snapshot: T, id: string): T {
    const pk = this.bindings.get(id), c = pk ? this.economy()?.book.completions.get(`${this.matchId}:${this.pk(id,pk)}`) : undefined;
    return { ...snapshot, matchId: this.matchId, ...(c ? { reward: { report: c.report, settlement: c.settlement } } : {}) };
  }
}
