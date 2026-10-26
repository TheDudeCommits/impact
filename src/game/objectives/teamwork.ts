import type { CombatEvent, PlayerState } from '../types';

export class Teamwork {
  private hits = new Map<string, Map<string, number>>();
  update(events: readonly CombatEvent[], players: readonly PlayerState[], now: number, award: (id: string) => void) {
    const byId = new Map(players.map(p => [p.id, p]));
    for (const e of events) {
      if (!e.targetId) continue;
      const actor = byId.get(e.actorId), target = byId.get(e.targetId);
      if (e.kind === 'hit' && actor && target && actor.team !== target.team && (e.damage ?? 0) > 0) {
        const hits = this.hits.get(e.targetId) ?? new Map<string, number>(); hits.set(e.actorId, now); this.hits.set(e.targetId, hits);
      }
      if (e.kind === 'eliminated') {
        for (const [id, at] of this.hits.get(e.targetId) ?? []) {
          if (id !== e.actorId && now - at <= 10 && byId.get(id)?.team === actor?.team) award(id);
        }
        this.hits.delete(e.targetId);
      }
    }
    for (const [target, hits] of this.hits) {
      for (const [id, at] of hits) if (now - at > 10) hits.delete(id);
      if (!hits.size || !byId.has(target)) this.hits.delete(target);
    }
  }
}
