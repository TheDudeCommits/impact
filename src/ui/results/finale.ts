import type { FighterId, GameSnapshot, PlayerState } from '../../game/types';
import { objectiveOf } from '../../game/objectives/model';
import { riftOf } from '../../game/moba/model';
import { prompt } from '../prompts';
import './finale.css';

export const FINALE = {
  least: 4,
  most: 5.5,
  lineAt: 1.9,
  after: .3,
  line: 2.8,
  beat: 1.6,
  guard: .8,
};

export interface FinaleEnd { key: string; winner: boolean; line?: number }

export function finaleSeconds(end: Pick<FinaleEnd, 'winner' | 'line'>): number {
  if (!end.winner) return FINALE.beat;
  const line = end.line !== undefined && Number.isFinite(end.line) && end.line > 0 ? end.line : FINALE.line;
  return Math.min(FINALE.most, Math.max(FINALE.least, FINALE.lineAt + line + FINALE.after));
}

export function finaleWinner(snapshot: GameSnapshot): PlayerState | undefined {
  const named = snapshot.players.find(p => p.id === snapshot.winnerId);
  if (named?.alive) return named;
  const team = objectiveOf(snapshot)?.winner ?? riftOf(snapshot)?.winner;
  if (!team || team === 'draw' || team === 'horde') return undefined;
  return snapshot.players.find(p => p.alive && !p.enemy && p.team === team);
}

export function finaleMine(snapshot: GameSnapshot, selfId: string): boolean {
  const team = objectiveOf(snapshot)?.winner ?? riftOf(snapshot)?.winner;
  if (team) return team === snapshot.players.find(p => p.id === selfId)?.team;
  return !!selfId && snapshot.winnerId === selfId;
}

export function finaleStateOf(snapshot: GameSnapshot | undefined, drawn: (id: string) => boolean, line: (fighter: FighterId) => number | undefined): { end?: FinaleEnd; running: boolean } {
  if (!snapshot) return { running: false };
  const operation = objectiveOf(snapshot), war = riftOf(snapshot), phase = operation?.phase ?? war?.phase;
  let key: string | undefined;
  if (operation) key = phase === 'over' ? `operation:${operation.kind}:${operation.round}:${operation.endsAt}` : undefined;
  else if (war) key = phase === 'over' ? `rift:${war.round}:${war.endsAt}` : undefined;
  else if (snapshot.roomMode === 'match' && snapshot.status === 'finished' && (!snapshot.duel || snapshot.duel.phase === 'complete')) key = `match:${snapshot.matchId ?? ''}:${snapshot.duel?.set ?? 0}:${snapshot.winnerId ?? '-'}`;
  const running = operation || war ? phase === 'active' : snapshot.roomMode === 'match' && snapshot.status === 'active';
  if (!key) return { running };
  const winner = finaleWinner(snapshot), shown = !!winner && drawn(winner.id);
  return { end: { key, winner: shown, line: shown ? line(winner!.fighter) : undefined }, running: false };
}

export class Finale {
  private key: string | null = null;
  private at = 0;
  private seconds = 0;
  private skipped = false;
  private live = false;
  observe(end: FinaleEnd | undefined, running: boolean, now: number) {
    if (!end) { this.key = null; this.skipped = false; if (running) this.live = true; return; }
    if (end.key === this.key) return;
    this.key = end.key; this.at = now; this.skipped = false;
    this.seconds = this.live ? finaleSeconds(end) : 0;
    this.live = false;
  }
  get ended() { return this.key !== null; }
  done(now: number) { return this.key === null || this.skipped || now - this.at >= this.seconds; }
  holding(now: number) { return !this.done(now); }
  left(now: number) { return this.holding(now) ? this.seconds - (now - this.at) : 0; }
  elapsed(now: number) { return this.holding(now) ? now - this.at : 0; }
  skip(now: number, force = false) {
    if (!this.holding(now) || (!force && now - this.at < FINALE.guard)) return false;
    this.skipped = true; return true;
  }
  reset() { this.key = null; this.skipped = false; this.live = false; }
}

export class FinaleSkip {
  readonly element = document.createElement('div');
  private shown = false;
  private device = '';
  constructor(parent: HTMLElement, onSkip: () => void) {
    this.element.className = 'finale-skip';
    this.element.hidden = true;
    this.element.addEventListener('click', event => { event.stopPropagation(); onSkip(); });
    parent.append(this.element);
  }
  update(holding: boolean, elapsed: number) {
    const show = holding && elapsed >= FINALE.guard;
    if (show) {
      const root = document.querySelector<HTMLElement>('#interface'), device = `${root?.dataset.input ?? ''}:${root?.dataset.pad ?? ''}`;
      if (device !== this.device || !this.shown) { this.device = device; this.element.innerHTML = prompt('confirm', 'SKIP'); }
    }
    if (show === this.shown) return;
    this.shown = show; this.element.hidden = !show;
  }
}
