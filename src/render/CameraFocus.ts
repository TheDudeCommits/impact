import { castThreat, THREAT_UNBLOCKABLE, type ThreatRead } from './ThreatOutline';
import type { CombatEvent, PlayerState } from '../game/types';

export const FOCUS_RANGE = 22, KEEP_RANGE = 26;
export const W_ATTACK = 1, W_UNBLOCKABLE = .3, W_IMMINENT = .35, W_HIT = .7, HIT_HOLD = 3, W_FINISH = .5,
  W_STRING = 1.6, W_LAUNCHED = .9, LAUNCHED_FOR = 1.4, W_NEAR = .6, W_VIEW = .3, W_NOMINEE = .08, W_DOWN = -.25, ATTACK_REACH = 3;
export const BEHIND_FROM = 1.6, BEHIND_FULL = 2.4;
export const STICK = .35, DWELL = .35, DWELL_BACK = .8, PINGPONG = 3, REST = 1.2, URGENT_DWELL = .08, ATTACK_HOLD = .9, ATTACK_FADE = .6, UNSEEN = .8;

const smooth = (x: number, a: number, b: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrapped = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ATTACKS: ReadonlySet<string> = new Set(['light', 'heavy', 'special', 'ultimate']);
const LYING: ReadonlySet<string> = new Set(['knockdown', 'getup']);

export class CameraFocus {
  id: string | null = null;
  pending: string | null = null; pendingShare = 0;
  changedAt = -Infinity; from: string | null = null;
  urgent = false;
  readonly scores = new Map<string, number>();
  private pruneAt = 0;
  private clock = 0; private dwell = 0; private dwellFor: string | null = null;
  private left = new Map<string, number>();
  private hitBy = new Map<string, number>(); private hitOn = new Map<string, number>(); private lastEvent = 0;
  private attackAt = new Map<string, number>();
  private read: ThreatRead = { level: 0, until: Infinity, elapsed: 0, move: undefined };

  reset() {
    this.id = null; this.pending = null; this.pendingShare = 0; this.changedAt = -Infinity; this.from = null; this.urgent = false;
    this.scores.clear(); this.clock = 0; this.pruneAt = 0; this.dwell = 0; this.dwellFor = null; this.left.clear(); this.hitBy.clear(); this.hitOn.clear(); this.lastEvent = 0; this.attackAt.clear();
  }

  update(dt: number, players: readonly PlayerState[], self: PlayerState, viewYaw: number, events: readonly CombatEvent[], lock: string | null, nominee: string | null = null) {
    dt = Math.max(0, Math.min(.25, Number.isFinite(dt) ? dt : 0));
    this.clock += dt;
    const now = this.clock;
    if(now>=this.pruneAt){
      this.pruneAt=now+1;
      this.prune(this.left,now-PINGPONG);this.prune(this.hitBy,now-HIT_HOLD);
      this.prune(this.hitOn,now-LAUNCHED_FOR);this.prune(this.attackAt,now-ATTACK_HOLD-ATTACK_FADE);
    }
    for (const e of events) {
      if (!(e.id > this.lastEvent)) continue;
      this.lastEvent = e.id;
      if ((e.kind === 'hit' || e.kind === 'blocked' || e.kind === 'guard-break') && e.targetId === self.id && e.actorId && e.actorId !== self.id) this.hitBy.set(e.actorId, now);
      if (e.kind === 'hit' && e.actorId === self.id && e.targetId && e.targetId !== self.id) this.hitOn.set(e.targetId, now);
    }
    this.scores.clear();
    let best: string | null = null, bestScore = -Infinity, currentScore = -Infinity, currentHere = false, currentAttacking = false;
    let urgentBest: string | null = null, urgentScore = -Infinity, urgentRed = false;
    for (const p of players) {
      if (p.id === self.id || !p.alive || (self.team !== undefined && p.team === self.team)) continue;
      const d = Math.hypot(p.x - self.x, p.z - self.z), mine = p.id === this.id;
      if (d > (mine ? KEEP_RANGE : FOCUS_RANGE)) continue;
      const t = castThreat(p, this.read);
      const reach = (t.move?.range ?? 3) + ATTACK_REACH;
      const attacking = t.level > 0 && p.target === self.id && d < reach;
      const imminent = attacking ? 1 - smooth(t.until, .12, .45) : 0;
      if (attacking) this.attackAt.set(p.id, now);
      const since = this.attackAt.get(p.id), pressing = since === undefined ? 0 : 1 - smooth(now - since, ATTACK_HOLD, ATTACK_HOLD + ATTACK_FADE);
      const off = Math.abs(wrapped(Math.atan2(p.x - self.x, p.z - self.z) - viewYaw));
      let score = W_NEAR * (1 - smooth(d, 2, 14)) + W_VIEW * (1 - smooth(off, .45, 1.9));
      const behind = 1 - .5 * smooth(off, BEHIND_FROM, BEHIND_FULL);
      score += behind * (W_ATTACK * pressing + (attacking ? (t.level === THREAT_UNBLOCKABLE ? W_UNBLOCKABLE : 0) + W_IMMINENT * imminent : 0));
      const hit = this.hitBy.get(p.id);
      if (hit !== undefined) score += behind * W_HIT * (1 - smooth(now - hit, HIT_HOLD - 1.5, HIT_HOLD));
      if (p.maxHp > 0) score += W_FINISH * (1 - smooth(p.hp / p.maxHp, .15, .35)) * (1 - smooth(d, 5, 12));
      if (ATTACKS.has(self.action) && self.target === p.id) score += W_STRING;
      const on = this.hitOn.get(p.id);
      if (on !== undefined && now - on < LAUNCHED_FOR && !p.grounded) score += W_LAUNCHED;
      if (p.id === nominee) score += W_NOMINEE;
      if (LYING.has(p.action) && !attacking) score += W_DOWN;
      this.scores.set(p.id, score);
      if (mine) { currentHere = true; currentScore = score + STICK; currentAttacking = pressing > .5; }
      else {
        if (score > bestScore) { bestScore = score; best = p.id; }
        if (attacking && off > UNSEEN && (imminent > .5 || t.level === THREAT_UNBLOCKABLE) && score > urgentScore) { urgentScore = score; urgentBest = p.id; urgentRed = t.level === THREAT_UNBLOCKABLE; }
      }
    }
    if (lock) { this.take(lock, now, false); this.pending = null; this.pendingShare = 0; this.dwell = 0; this.dwellFor = null; return this.id; }
    if (!currentHere) {
      if (best !== this.id) this.take(best, now, false);
      this.pending = null; this.pendingShare = 0; this.dwell = 0; this.dwellFor = null;
      return this.id;
    }
    const stringing = ATTACKS.has(self.action) && self.target === this.id;
    const urgent = urgentBest !== null && !currentAttacking && (stringing ? urgentRed : urgentScore > currentScore - STICK);
    const challenger = urgent ? urgentBest : best;
    const ahead = challenger !== null && (urgent || bestScore > currentScore);
    if (ahead) {
      if (challenger !== this.dwellFor) { this.dwellFor = challenger; this.dwell = 0; }
      this.dwell += dt;
      const back = this.left.get(challenger!), returning = back !== undefined && now - back < PINGPONG;
      const need = urgent ? URGENT_DWELL : returning ? DWELL_BACK : DWELL;
      this.pending = challenger; this.pendingShare = Math.min(1, this.dwell / need);
      if (this.dwell >= need && (urgent || now - this.changedAt >= REST)) { this.take(challenger, now, urgent); this.pending = null; this.pendingShare = 0; this.dwell = 0; this.dwellFor = null; }
    } else {
      this.dwell = Math.max(0, this.dwell - 2 * dt);
      if (this.dwell === 0) { this.dwellFor = null; this.pending = null; this.pendingShare = 0; }
      else this.pendingShare = Math.min(1, this.dwell / DWELL);
    }
    return this.id;
  }

  private prune(map:Map<string,number>,before:number){for(const [id,time] of map)if(time<before)map.delete(id);}
  get historyEntries(){return this.left.size+this.hitBy.size+this.hitOn.size+this.attackAt.size;}
  private take(id: string | null, now: number, urgent: boolean) {
    if (id === this.id) return;
    if (this.id) this.left.set(this.id, now);
    this.from = this.id; this.id = id; this.changedAt = now; this.urgent = urgent;
  }
}
