import type { GameSnapshot } from './types';

export class AutoLock {
  private declined = '';

  static round(snapshot: GameSnapshot | null | undefined, session: number): string {
    if (!snapshot || snapshot.status !== 'active') return '';
    if (snapshot.duel) return snapshot.duel.phase === 'playing' ? `${session}:duel:${snapshot.duel.set}:${snapshot.duel.round}` : '';
    return snapshot.roomMode === 'training' ? `${session}:training` : '';
  }

  static rival(snapshot: GameSnapshot, selfId: string): string | undefined {
    const self = snapshot.players.find(p => p.id === selfId);
    if (!self?.alive) return undefined;
    let rival: string | undefined;
    for (const p of snapshot.players) {
      if (p.id === selfId || !p.alive || p.enemy || (self.team !== undefined && p.team === self.team)) continue;
      if (rival) return undefined;
      rival = p.id;
    }
    return rival;
  }

  want(snapshot: GameSnapshot | null | undefined, selfId: string, session: number, locked: boolean): string | undefined {
    if (locked || !snapshot || !selfId) return undefined;
    const round = AutoLock.round(snapshot, session);
    if (!round || round === this.declined) return undefined;
    return AutoLock.rival(snapshot, selfId);
  }

  decline(snapshot: GameSnapshot | null | undefined, session: number) { this.declined = AutoLock.round(snapshot, session); }

  reset() { this.declined = ''; }
}
