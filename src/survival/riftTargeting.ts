export interface RiftCandidate { id: string; x: number; y: number; z: number; radius: number; boss: boolean; elite: boolean;
  dist?: number }

const GRUNT_RANGE = 14, BOSS_RANGE = 30;
const HOLD = .9;

const INTRODUCTION = 3.2;

export const riftBoss: { current: RiftCandidate | undefined } = { current: undefined };

export class RiftTargeting {
  id: string | null = null;
  private hard = false;
  private introId: string | null = null;
  private introUntil = 0;
  private readonly met = new Set<string>();
  get locked() { return this.hard || this.introId !== null; }
  set locked(value: boolean) { this.hard = value; }
  reset() { this.id = null; this.hard = false; this.introId = null; this.met.clear(); riftBoss.current = undefined; }

  private score(c: RiftCandidate, self: { x: number; z: number }, fx: number, fz: number) {
    const dx = c.x - self.x, dz = c.z - self.z, d = Math.hypot(dx, dz);
    if (d > (c.boss ? BOSS_RANGE : GRUNT_RANGE)) return Infinity;
    const reach = Math.max(0, d - c.radius);
    const facing = (1 - (d > 1e-4 ? (dx * fx + dz * fz) / d : 1)) * .55;
    const far = Math.max(0, reach - 3.5) * .6;
    return reach + facing + far - (c.boss ? 1.4 : c.elite ? .5 : 0);
  }

  update(self: { x: number; z: number; yaw: number }, candidates: readonly RiftCandidate[], yaw = self.yaw): string | null {
    let boss: RiftCandidate | undefined;
    for (const c of candidates) {
      c.dist = Math.hypot(c.x - self.x, c.z - self.z);
      if (c.boss && c.dist <= BOSS_RANGE && (!boss || c.dist < boss.dist!)) boss = c;
    }
    const id = this.pick(self, candidates, yaw);
    const target = id ? candidates.find(c => c.id === id) : undefined;
    riftBoss.current = target?.boss ? target : boss;
    return id;
  }

  private pick(self: { x: number; z: number; yaw: number }, candidates: readonly RiftCandidate[], yaw: number): string | null {
    const now = performance.now() / 1000;
    for (const c of candidates) {
      if (!c.boss || this.met.has(c.id)) continue;
      this.met.add(c.id);
      if (!this.hard && Math.hypot(c.x - self.x, c.z - self.z) <= BOSS_RANGE) { this.introId = c.id; this.introUntil = now + INTRODUCTION; }
    }
    if (this.introId) {
      if (now < this.introUntil && candidates.some(c => c.id === this.introId)) return this.id = this.introId;
      this.introId = null;
    }
    const current = candidates.find(c => c.id === this.id);
    if (this.hard) {
      if (current?.boss || current?.elite) return this.id;
      this.hard = false;
    }
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let best: RiftCandidate | undefined, bestScore = Infinity;
    for (const c of candidates) {
      const s = this.score(c, self, fx, fz);
      if (s < bestScore) { bestScore = s; best = c; }
    }
    if (current && best && current !== best && this.score(current, self, fx, fz) <= bestScore + HOLD) return this.id;
    this.id = best?.id ?? null;
    return this.id;
  }

  shift(self: { x: number; z: number }, candidates: readonly RiftCandidate[], yaw: number, dir: -1 | 1) {
    if (!this.hard) return false;
    const bearing = (c: RiftCandidate) => { const b = Math.atan2(c.x - self.x, c.z - self.z); return Math.atan2(Math.sin(b - yaw), Math.cos(b - yaw)); };
    const current = candidates.find(c => c.id === this.id), from = current ? bearing(current) : 0;
    let best: RiftCandidate | undefined, gap = Infinity;
    for (const c of candidates) {
      if (c.id === this.id || !(c.boss || c.elite) || Math.hypot(c.x - self.x, c.z - self.z) > BOSS_RANGE) continue;
      const turn = (from - bearing(c)) * dir;
      if (turn > .02 && turn < gap) { gap = turn; best = c; }
    }
    if (!best) return false;
    this.introId = null; this.id = best.id;
    return true;
  }

  cycle(self: { x: number; z: number; yaw: number }, candidates: readonly RiftCandidate[], yaw = self.yaw) {
    const bearing = (c: RiftCandidate) => { const b = Math.atan2(c.x - self.x, c.z - self.z); return Math.atan2(Math.sin(b - yaw), Math.cos(b - yaw)); };
    const bosses = candidates.filter(c => c.boss && Math.hypot(c.x - self.x, c.z - self.z) <= BOSS_RANGE).sort((a, b) => bearing(a) - bearing(b));
    if (!bosses.length) { this.hard = false; return false; }
    this.introId = null;
    if (!this.hard) {
      this.hard = true;
      this.id = bosses.reduce((best, c) => Math.abs(bearing(c)) < Math.abs(bearing(best)) ? c : best).id;
      return true;
    }
    const next = bosses.findIndex(c => c.id === this.id) + 1;
    if (next >= bosses.length) { this.hard = false; return true; }
    this.id = bosses[next].id;
    return true;
  }
}
