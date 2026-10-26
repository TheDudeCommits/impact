import type { AttackSlot, CombatEvent, GameSnapshot } from './types';

export type LandedBlow = {
  attacker: string; seq: number; target: string; contact: number; slot?: AttackSlot;
  predicted: boolean;
  confirmed: boolean;
  rejected: boolean;
  delivered: boolean;
  tick: number;
  at: number;
  standsFor?: LandedBlow;
  trusted?: boolean;
  outcome?: CombatEvent['outcome'];
};
type Guarded = { target: string; slot?: AttackSlot; contact: number; at: number };

const PREDICTED_IDS = 1_000_000_000;
const KEPT = 24;
export const RESOLVE_TICKS = 10;
export const REPLAY_PAST = 3;
const SAME_BLOW = .3;
const PAIR_AHEAD = .25;

export class LandedBlows {
  local = '';
  clock = Infinity;
  private blows = new Map<string, LandedBlow[]>();
  private guards = new Map<string, Guarded[]>();
  private answered = new Set<number>();

  reset() { this.local = ''; this.clock = Infinity; this.blows.clear(); this.guards.clear(); this.answered.clear(); }

  predict(events: readonly CombatEvent[], local: string, tick: number, replayed?: number, trusted?: (target: string, at: number, event: CombatEvent) => boolean) {
    this.adopt(local);
    for (const event of events) {
      if (event.actorId !== local || !event.targetId) continue;
      if (event.kind === 'hit' && event.actionSeq !== undefined) {
        const blow = this.upsert(event);
        if (!blow.predicted) { blow.predicted = true; blow.tick = tick; blow.trusted = trusted ? trusted(event.targetId, event.serverTime, event) : undefined; }
      } else if (event.kind === 'blocked' || event.kind === 'guard-break') this.guard(event);
    }
    const own = replayed === undefined ? undefined : this.blows.get(local);
    if (own) for (const blow of own) {
      if (!blow.predicted || blow.confirmed || blow.rejected || blow.standsFor || blow.tick < replayed! || blow.tick > tick - REPLAY_PAST) continue;
      let again = false;
      for (const event of events) if (event.kind === 'hit' && event.actorId === local && event.targetId === blow.target && event.actionSeq === blow.seq && (event.contactIndex ?? 0) === blow.contact) { again = true; break; }
      if (again) continue;
      for (const event of events) if (event.kind === 'hit' && event.actorId === local && event.actionSeq !== undefined && event.actionSeq !== blow.seq && this.sameAs(blow, event)) {
        blow.standsFor = this.blow(local, event.actionSeq, event.targetId!, event.contactIndex ?? 0);
        break;
      }
      if (!blow.standsFor) blow.rejected = true;
    }
  }

  authoritative(snapshot: GameSnapshot, local: string) {
    this.adopt(local);
    this.serve(snapshot.events, false);
    let ack: number | undefined;
    for (const player of snapshot.players) if (player.id === local) ack = player.ackSeq;
    const own = this.blows.get(local);
    if (ack === undefined || !own) return;
    for (const blow of own) if (blow.predicted && !blow.confirmed && !blow.rejected && !blow.standsFor && ack >= blow.tick + RESOLVE_TICKS) blow.rejected = true;
  }

  deliver(events: readonly CombatEvent[]) { this.serve(events, true); }

  pair(target: string, slot: AttackSlot | undefined, contact: number | undefined) {
    let best: LandedBlow | undefined;
    for (const list of this.blows.values()) for (const blow of list) {
      if (blow.target !== target || blow.delivered || !blow.confirmed || blow.slot !== slot) continue;
      if (contact !== undefined && blow.contact !== contact) continue;
      if (blow.at > this.clock + PAIR_AHEAD) continue;
      if (!best || blow.at < best.at) best = blow;
    }
    if (best) best.delivered = true;
    return best;
  }

  blow(attacker: string, seq: number, target: string, contact: number) {
    const list = this.blows.get(attacker);
    if (!list) return undefined;
    for (let i = list.length - 1; i >= 0; i--) {
      const blow = list[i];
      if (blow.seq === seq && blow.target === target && blow.contact === contact) return blow;
    }
    return undefined;
  }

  landed(attacker: string, seq: number, target: string, since: number) {
    const list = this.blows.get(attacker);
    if (list) for (const blow of list) if (blow.seq === seq && blow.target === target && !this.refused(blow)) return true;
    const guards = this.guards.get(attacker);
    if (guards) for (const guard of guards) if (guard.target === target && guard.at >= since - 1e-6) return true;
    return false;
  }

  guarded(attacker: string, target: string, slot: AttackSlot | undefined, contact: number, since: number) {
    const list = this.guards.get(attacker);
    if (list) for (const guard of list) if (guard.target === target && guard.slot === slot && guard.contact === contact && guard.at >= since - 1e-6) return true;
    return false;
  }

  held(blow: LandedBlow | undefined) {
    return !!blow && blow.predicted && !blow.confirmed && blow.trusted === false && !blow.standsFor;
  }
  predictedOn(target: string, slot: AttackSlot | undefined, contact: number | undefined) {
    const list = this.blows.get(this.local);
    if (list) for (let i = list.length - 1; i >= 0; i--) {
      const blow = list[i];
      if (blow.target === target && blow.predicted && !blow.confirmed && !this.refused(blow) && blow.slot === slot && blow.contact === (contact ?? 0)) return blow;
    }
    return undefined;
  }
  refused(blow: LandedBlow | undefined) {
    for (let at = blow, n = 0; at && n < 8; at = at.standsFor, n++) if (at.rejected) return true;
    return false;
  }
  same(record: LandedBlow | undefined, blow: LandedBlow) {
    for (let at = record, n = 0; at && n < 8; at = at.standsFor, n++) if (at === blow) return true;
    return false;
  }

  private sameAs(blow: LandedBlow, event: CombatEvent) {
    return event.targetId === blow.target && event.slot === blow.slot && (event.contactIndex ?? 0) === blow.contact && Math.abs(event.serverTime - blow.at) <= SAME_BLOW;
  }
  private match(served: LandedBlow) {
    if (served.attacker !== this.local) return;
    let oldest: LandedBlow | undefined;
    for (const blow of this.blows.get(served.attacker) ?? []) {
      if (blow === served || !blow.predicted || blow.confirmed || blow.rejected || blow.standsFor || blow.seq === served.seq) continue;
      if (blow.target !== served.target || blow.slot !== served.slot || blow.contact !== served.contact || Math.abs(blow.at - served.at) > SAME_BLOW) continue;
      if (!oldest || blow.tick < oldest.tick) oldest = blow;
    }
    if (oldest) oldest.standsFor = served;
  }

  private adopt(local: string) { if (local !== this.local) { this.blows.clear(); this.guards.clear(); this.answered.clear(); this.local = local; } }

  private serve(events: readonly CombatEvent[], delivered: boolean) {
    for (const event of events) {
      if (!delivered && event.kind === 'whiff') { this.whiffed(event); continue; }
      if (!event.targetId || event.id >= PREDICTED_IDS) continue;
      if (event.kind === 'hit' && event.actionSeq !== undefined) {
        const blow = this.upsert(event);
        if (!blow.confirmed && !blow.predicted) this.match(blow);
        blow.confirmed = true; blow.rejected = false; blow.at = event.serverTime; blow.outcome = event.outcome ?? blow.outcome;
        if (delivered) blow.delivered = true;
        continue;
      }
      if (event.kind === 'blocked' || event.kind === 'guard-break') this.guard(event);
      if (!delivered && (event.kind === 'blocked' || event.kind === 'guard-break' || event.kind === 'dodge' || event.kind === 'just-guard')) this.turnedAway(event);
    }
  }

  private turnedAway(event: CombatEvent) {
    if (event.actorId !== this.local || this.answered.has(event.id)) return;
    this.answered.add(event.id);
    if (this.answered.size > 64) this.answered.delete(this.answered.values().next().value!);
    const contact = event.contactIndex ?? 0;
    let oldest: LandedBlow | undefined;
    for (const blow of this.blows.get(event.actorId) ?? []) {
      if (!blow.predicted || blow.confirmed || blow.rejected || blow.standsFor || blow.target !== event.targetId || blow.slot !== event.slot || blow.contact !== contact) continue;
      if (!oldest || blow.tick < oldest.tick) oldest = blow;
    }
    if (oldest) oldest.rejected = true;
  }

  private whiffed(event: CombatEvent) {
    if (event.actorId !== this.local || event.id >= PREDICTED_IDS || this.answered.has(event.id)) return;
    this.answered.add(event.id);
    if (this.answered.size > 64) this.answered.delete(this.answered.values().next().value!);
    for (const blow of this.blows.get(event.actorId) ?? []) {
      if (!blow.predicted || blow.confirmed || blow.rejected || blow.slot !== event.slot) continue;
      if (event.actionSeq !== undefined && blow.seq !== event.actionSeq) continue;
      blow.rejected = true;
    }
  }

  private upsert(event: CombatEvent) {
    const attacker = event.actorId, seq = event.actionSeq!, target = event.targetId!, contact = event.contactIndex ?? 0;
    const known = this.blow(attacker, seq, target, contact);
    if (known) return known;
    let list = this.blows.get(attacker);
    if (!list) { list = []; this.blows.set(attacker, list); }
    const blow: LandedBlow = { attacker, seq, target, contact, slot: event.slot, predicted: false, confirmed: false, rejected: false, delivered: false, tick: -1, at: event.serverTime, outcome: event.outcome };
    list.push(blow);
    if (list.length > KEPT) list.shift();
    return blow;
  }

  private guard(event: CombatEvent) {
    const contact = event.contactIndex ?? 0;
    let list = this.guards.get(event.actorId);
    if (!list) { list = []; this.guards.set(event.actorId, list); }
    for (const guard of list) if (guard.target === event.targetId && guard.slot === event.slot && guard.contact === contact && Math.abs(guard.at - event.serverTime) < 1e-6) return;
    list.push({ target: event.targetId!, slot: event.slot, contact, at: event.serverTime });
    if (list.length > KEPT) list.shift();
  }
}

export const LANDED = new LandedBlows();
