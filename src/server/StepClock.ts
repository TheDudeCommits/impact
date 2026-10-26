export class StepClock {
  static readonly PER_CALLBACK = 4;
  static readonly MAX_OWED_SECONDS = .5;
  private last: number | undefined;
  private banked = 0;
  dropped = 0;
  constructor(readonly hz: number) {}

  advance(now: number) {
    if (this.last !== undefined && now > this.last) this.banked += (now - this.last) * this.hz / 1000;
    this.last = now;
    const cap = StepClock.MAX_OWED_SECONDS * this.hz;
    if (this.banked > cap) { this.dropped += this.banked - cap; this.banked = cap; }
  }

  get owed() { return Math.floor(this.banked + 1e-6); }

  take() {
    if (this.banked + 1e-6 < 1) return false;
    this.banked -= 1;
    return true;
  }
}
