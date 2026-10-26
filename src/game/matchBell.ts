import type { GameSnapshot } from './types';

export class MatchBell {
  private from = '';
  rang(snapshot: Pick<GameSnapshot, 'roomMode' | 'status' | 'duel'>): boolean {
    if (snapshot.roomMode !== 'match' || snapshot.duel) { this.from = ''; return false; }
    const rang = snapshot.status === 'active' && this.from === 'waiting';
    this.from = snapshot.status;
    return rang;
  }
  reset() { this.from = ''; }
}
