import type { GameSnapshot, PlayerState } from '../../game/types';
import { rankPlayers } from '../hudMath';

export class FallOrder {
  private order: string[] = [];
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  observe(snapshot: GameSnapshot) {
    if (snapshot.roomMode === 'training') return;
    if (snapshot.status === 'waiting') { this.reset(); return; }
    if (this.startedAt === null) this.startedAt = snapshot.serverTime;
    if (snapshot.status === 'finished' && this.endedAt === null) this.endedAt = snapshot.serverTime;
    for (const p of snapshot.players) if (!p.alive && !p.enemy && !this.order.includes(p.id)) this.order.push(p.id);
  }
  reset() { this.order.length = 0; this.startedAt = null; this.endedAt = null; }
  get fallen(): readonly string[] { return this.order; }
  place(players: readonly PlayerState[], winnerId: string | null, self: string) {
    const order = [...this.order, ...players.filter(p => !p.alive && !p.enemy && !this.order.includes(p.id)).map(p => p.id)];
    const ranked = rankPlayers([...players], winnerId, order), at = ranked.findIndex(p => p.id === self);
    return at < 0 ? undefined : at + 1;
  }
  seconds(now: number) { return this.startedAt === null ? 0 : Math.max(0, (this.endedAt ?? now) - this.startedAt); }
}
export const FALLS = new FallOrder();
