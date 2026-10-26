import type { CombatEvent, PlayerState } from '../game/types';
import { FIGHTER_QUIPS, type QuipMoment } from './quipCues';
import type { CueLayer } from './cueTypes';

export class QuipDirector {
  private lastTime = -Infinity;
  private lastSpoken = -Infinity;
  private spoken: Record<QuipMoment, number> = { resolve: -Infinity, advantage: -Infinity };
  private seen = new Set<number>();

  reset() {
    this.lastTime = this.lastSpoken = -Infinity;
    this.spoken = { resolve: -Infinity, advantage: -Infinity };
    this.seen.clear();
  }

  plan(event: CombatEvent, self: PlayerState, canSpeak: () => boolean): CueLayer | undefined {
    if (event.serverTime < this.lastTime - 2) this.reset();
    this.lastTime = Math.max(this.lastTime, event.serverTime);
    if (this.seen.has(event.id)) return;
    this.seen.add(event.id);
    if (this.seen.size > 64) this.seen.delete(this.seen.values().next().value!);
    if (!self.alive || self.hp <= 0 || event.serverTime - this.lastSpoken < 28) return;
    let moment: QuipMoment | undefined;
    if ((event.kind === 'guard-break' && event.actorId === self.id && event.targetId !== self.id)
      || (event.kind === 'poise-break' && event.targetId === self.id && event.actorId !== self.id)) moment = 'advantage';
    if (!moment || event.serverTime - this.spoken[moment] < 90 || !canSpeak()) return;
    const cue = FIGHTER_QUIPS[self.fighter][moment];
    if (!cue) return;
    this.lastSpoken = this.spoken[moment] = event.serverTime;
    return { cue, gain: .78, bus: 'voice', phase: 'impact', voicePriority: 0 };
  }
}
