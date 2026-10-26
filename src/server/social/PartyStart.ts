export const PARTY_COUNTDOWN = 3;
export const PARTY_GRACE_SECONDS = 45;

export class PartyStart {
  readonly seats: number;
  private armed: boolean;
  constructor(raw: unknown, max: number, min = 1) {
    this.seats = typeof raw === 'number' && Number.isInteger(raw) && raw >= min && raw <= max ? raw : 0;
    this.armed = this.seats > 0;
  }
  get party() { return this.seats > 0; }
  get waiting() { return this.armed; }
  complete(present: number, dropped: number) { return this.armed && present >= this.seats && dropped === 0; }
  manual(now: number) { return !this.armed || now >= PARTY_GRACE_SECONDS; }
  left() { this.armed = false; }
  started() { this.armed = false; }
  view(now: number): { party?: true; autoStart?: boolean } { return this.seats ? { party: true, autoStart: !this.manual(now) } : {}; }
}
