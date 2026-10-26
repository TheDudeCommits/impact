import { MOVES } from './moves';
import type { ThreatSource } from '../render/ThreatOutline';
import type { AttackSlot, CombatEvent, PlayerState } from './types';

const ATTACKS = new Set(['light', 'heavy', 'special', 'ultimate']);
const LOCK_RANGE = 60;
const RUN_GAP = 2.5;
const STICKINESS = 1.6;
const THREAT_NEAR = 6, THREAT_RATIO = 1.6;

export class Targeting {
  id: string | null = null;
  locked = false;
  private lastEvent = 0;
  private threat?: { id: string; until: number };
  reset() { this.id = null; this.locked = false; this.lastEvent = 0; this.threat = undefined; this.run = undefined; }

  private choices(players: PlayerState[], self: PlayerState) {
    return players.filter(p => p.id !== self.id && p.alive && (self.team === undefined || p.team !== self.team) && this.distance(p, self) <= LOCK_RANGE)
      .sort((a, b) => this.distance(a, self) - this.distance(b, self) || a.id.localeCompare(b.id));
  }
  private distance(a: PlayerState, b: PlayerState) { return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }
  private offAxis(p: PlayerState, self: PlayerState, yaw: number) {
    const bearing = Math.atan2(p.x - self.x, p.z - self.z);
    return Math.atan2(Math.sin(bearing - yaw), Math.cos(bearing - yaw));
  }

  private run?: { members: Set<string>; visited: Set<string>; origin: string | null; last: number };

  cycle(players: PlayerState[], self: PlayerState, yaw = self.yaw, now = performance.now() / 1000) {
    const off = (p: PlayerState) => Math.abs(this.offAxis(p, self, yaw));
    const near = this.choices(players, self);
    const lock = this.locked ? this.id : null;
    if (lock && near.length === 1 && near[0].id === lock) { this.locked = false; this.run = undefined; return this.id; }
    let run = this.run;
    if (!lock || !run || !run.members.has(lock)) {
      run = this.run = { members: new Set(), visited: new Set(), origin: lock, last: now };
      if (lock) run.members.add(lock);
    }
    else if (now - run.last > RUN_GAP) run.origin = lock;
    for (const p of near) run.members.add(p.id);
    run.last = now;
    const live = new Set(near.map(p => p.id));
    for (const id of run.members) if (!live.has(id)) { run.members.delete(id); run.visited.delete(id); }
    const members = run.members, visited = run.visited, origin = run.origin;
    const pick = () => near.filter(p => members.has(p.id) && !visited.has(p.id) && p.id !== lock)
      .sort((a, b) => Number(a.id === origin) - Number(b.id === origin) || off(a) - off(b) || a.id.localeCompare(b.id))[0];
    let next = pick();
    if (!next && lock) { visited.clear(); next = pick(); }
    if (!next) { if (!lock) this.locked = false; return this.id; }
    this.locked = true;
    visited.add(next.id);
    this.id = next.id;
    return this.id;
  }

  release() { this.locked = false; }
  lockOn(id: string) { this.id = id; this.locked = true; this.run = undefined; }

  update(players: PlayerState[], self: PlayerState, events: CombatEvent[], now: number, yaw = self.yaw) {
    const choices = this.choices(players, self);
    const current = choices.find(p => p.id === this.id);
    for (const e of events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (e.targetId !== self.id || !['hit', 'blocked', 'guard-break'].includes(e.kind)) continue;
      const attacker = choices.find(p => p.id === e.actorId);
      if (!attacker) continue;
      const engaged = current && current.id !== attacker.id
        && this.distance(attacker, self) > Math.max(THREAT_NEAR, this.distance(current, self) * THREAT_RATIO);
      if (engaged) continue;
      if (this.threat?.id === attacker.id && this.threat.until > e.serverTime) continue;
      this.threat = { id: attacker.id, until: e.serverTime + 3 };
    }
    if (this.locked) {
      if (current) return this.id;
      this.locked = false;
    }
    const recent = this.threat && this.threat.until > now ? choices.find(p => p.id === this.threat!.id) : undefined;
    const committed=ATTACKS.has(self.action)&&choices.find(p=>p.id===self.target);
    if(committed){this.id=committed.id;return this.id;}
    const attacking = choices.find(p => p.target === self.id && ATTACKS.has(p.action)
      && this.distance(p, self) < ((p as PlayerState & ThreatSource).viewMove?.range ?? MOVES[p.fighter][p.action as AttackSlot].range) + 3
      && (!current||this.distance(p,self)<=Math.max(THREAT_NEAR,this.distance(current,self)*THREAT_RATIO)));
    const priority = [recent, attacking].find(p => p && Math.abs(this.offAxis(p, self, yaw)) < 1.9);
    if (priority) { this.id = priority.id; return this.id; }
    const score=(p:PlayerState)=>this.distance(p,self)+Math.max(0,Math.abs(this.offAxis(p,self,yaw))-.65)*4;
    const nearest = choices.reduce<PlayerState|undefined>((best,p)=>!best||score(p)<score(best)?p:best,undefined);
    this.id = current && nearest && score(current) <= score(nearest) + STICKINESS
      ? current.id : nearest?.id ?? null;
    return this.id;
  }
}
