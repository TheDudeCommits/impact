export const RANKS = [
  { letter: 'D', word: 'DULL', at: 0, score: 1 },
  { letter: 'C', word: 'CRISP', at: 90, score: 1.2 },
  { letter: 'B', word: 'BRUTAL', at: 200, score: 1.45 },
  { letter: 'A', word: 'AWAKENED', at: 340, score: 1.75 },
  { letter: 'S', word: 'SAVAGE', at: 520, score: 2.1 },
  { letter: 'SS', word: 'SUPREME', at: 740, score: 2.5 },
  { letter: 'SSS', word: 'SHŌNEN LEGEND', at: 1000, score: 3 },
] as const;
const CAP = 1250;
const PASSIVE_RATE = 24;
const CHAIN_FLOOR = [[400, 520], [150, 340], [60, 200], [20, 90]] as const;
const CHAIN_GAP = 3;

export type StyleAction = 'light' | 'heavy' | 'special' | 'ultimate' | 'orbital' | 'proc';

export class StyleMeter {
  points = 0;
  worth = 1;
  best = 0;
  private recent: StyleAction[] = [];
  private lastGain = -10;
  private lastHurt = -10;
  private lastOwn = -99;
  private kills: number[] = [];
  private chain = 0;
  private chainAt = -99;

  get rank() { let i = 0; while (i + 1 < RANKS.length && this.points >= RANKS[i + 1].at) i++; return i; }
  get multiplier() { return RANKS[this.rank].score; }
  get fill() {
    const i = this.rank, from = RANKS[i].at, to = i + 1 < RANKS.length ? RANKS[i + 1].at : CAP;
    return Math.max(0, Math.min(1, (this.points - from) / (to - from)));
  }

  private passive = PASSIVE_RATE;
  private passiveAt = 0;

  private gain(amount: number, now: number) {
    this.points = Math.min(CAP, this.points + amount * this.worth);
    this.lastGain = now;
    this.best = Math.max(this.best, this.rank);
  }
  private trickle(amount: number, now: number) {
    this.passive = Math.min(PASSIVE_RATE, this.passive + (now - this.passiveAt) * PASSIVE_RATE);
    this.passiveAt = now;
    const take = Math.min(this.passive, amount);
    this.passive -= take;
    this.points = Math.min(CAP, this.points + take * this.worth);
    this.best = Math.max(this.best, this.rank);
  }

  hit(action: StyleAction, now: number, airborne: boolean, launch: boolean, crit: boolean) {
    if (action === 'orbital' || action === 'proc') { this.trickle(.6, now); return; }
    this.lastOwn = now;
    const base = { light: 5, heavy: 9, special: 12, ultimate: 10 }[action];
    const fresh = this.recent.includes(action) ? (this.recent[this.recent.length - 1] === action ? .55 : .8) : 1.6;
    this.recent.push(action); if (this.recent.length > 2) this.recent.shift();
    this.gain(base * fresh + (airborne ? 6 : 0) + (launch ? 5 : 0) + (crit ? 3 : 0), now);
  }
  kill(now: number, elite = false, passive = false) {
    if (now - this.chainAt > CHAIN_GAP) this.chain = 0;
    this.chain++; this.chainAt = now;
    if (passive) { this.trickle(elite ? 10 : 3, now); this.hold(now); return; }
    this.lastOwn = now;
    this.kills = this.kills.filter(t => now - t < .6); this.kills.push(now);
    this.gain(10 + Math.min(6, this.kills.length - 1) * 8 + (elite ? 30 : 0), now);
  }
  bonus(amount: number, now: number) { this.gain(amount, now); }
  earned(amount: number, now: number) { if (now - this.lastOwn < 6) this.gain(amount, now); else this.trickle(amount * .1, now); }
  hurt(damage: number, now = 0, chip = false, maxHp = 1000) {
    if (chip && damage < maxHp * .06) return;
    if (now - this.lastHurt < 1) return;
    this.lastHurt = now;
    const i = this.rank;
    const weight = chip ? Math.min(.25, damage / 240 + .04) : Math.min(1, damage / 80 + .15);
    const drop = Math.max(24, (RANKS[Math.min(RANKS.length - 1, i + 1)].at - RANKS[Math.max(0, i - 1)].at) * .75) * weight;
    this.points = Math.max(0, this.points - drop);
  }
  update(dt: number, now: number) {
    if (now - this.lastGain >= 1.1) this.points = Math.max(0, this.points - dt * (9 + this.points * .055));
    this.hold(now);
  }
  private hold(now: number) {
    if (now - this.chainAt > CHAIN_GAP) return;
    const floor = CHAIN_FLOOR.find(([n]) => this.chain >= n)?.[1] ?? 0;
    if (this.points < floor) { this.points = floor; this.best = Math.max(this.best, this.rank); }
  }
}
