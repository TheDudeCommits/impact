import { SIMULATION_HZ } from '../game/moves';
import type { CombatEvent, GameSnapshot, PlayerState } from '../game/types';
import {riftOf} from '../game/moba/model';
import {presentRift} from './moba/presentUnits';

export interface CombatFrame { snapshot: GameSnapshot; time: number; events: CombatEvent[] }
const TICK = 1 / SIMULATION_HZ;
const MAX_SNAPSHOTS = 64;
const EVENT_WINDOW = 4096;
const TIME_EPSILON = 1e-9;
const copyPlayer = (p: PlayerState): PlayerState => ({ ...p, cooldowns: { ...p.cooldowns } });
const copyEvent = (e: CombatEvent): CombatEvent => ({ ...e,
  origin: e.origin ? { ...e.origin } : undefined, endpoint: e.endpoint ? { ...e.endpoint } : undefined });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class CombatTimeline {
  delayMs: number;
  private snapshots: GameSnapshot[] = [];
  private receivedAtMs = 0;
  private visualTime: number | null = null;
  private pending: CombatEvent[] = [];
  private seen = new Set<number>();
  private highestEventId = 0;
  private landings = new Map<string,CombatEvent[]>();
  private offsetMs: number | null = null;
  private jitterMs = 0;

  constructor(options: { delayMs?: number } = {}) {
    this.delayMs = options.delayMs ?? 60;
    if (!Number.isFinite(this.delayMs) || this.delayMs < 0) throw new Error('Visual delay must be a nonnegative number');
  }

  get newest() { return this.snapshots.at(-1)?.serverTime; }

  reset() {
    this.snapshots.length = 0; this.pending.length = 0; this.seen.clear();
    this.receivedAtMs = 0; this.visualTime = null; this.highestEventId = 0;
    this.landings.clear();
    this.offsetMs = null; this.jitterMs = 0;
  }

  reanchor() { this.offsetMs = null; this.jitterMs = 0; }

  push(snapshot: GameSnapshot, receivedAtMs: number) {
    if (!Number.isFinite(snapshot.serverTime) || !Number.isFinite(receivedAtMs)) return;
    for (const event of snapshot.events) {
      if (!Number.isSafeInteger(event.id) || !Number.isFinite(event.serverTime)
        || event.id <= this.highestEventId - EVENT_WINDOW || this.seen.has(event.id)) continue;
      this.highestEventId = Math.max(this.highestEventId, event.id);
      this.seen.add(event.id); this.pending.push(copyEvent(event));
      if(event.kind==='land'&&event.origin){
        const anchors=this.landings.get(event.actorId)??[];
        anchors.push(copyEvent(event));anchors.sort((a,b)=>a.serverTime-b.serverTime);
        this.landings.set(event.actorId,anchors.slice(-4));
      }
    }
    for (const id of this.seen) if (id <= this.highestEventId - EVENT_WINDOW) this.seen.delete(id);
    this.pending.sort((a, b) => a.serverTime - b.serverTime || a.id - b.id);
    if (this.pending.length > EVENT_WINDOW) this.pending.length = EVENT_WINDOW;

    const newest = this.snapshots.at(-1);
    if (!newest || snapshot.serverTime > newest.serverTime) {
      this.receivedAtMs = receivedAtMs;
      const offset = receivedAtMs - snapshot.serverTime * 1000;
      if (this.offsetMs === null) this.offsetMs = offset;
      else {
        this.jitterMs = this.jitterMs * .94 + Math.abs(offset - this.offsetMs) * .06;
        this.offsetMs += (offset - this.offsetMs) * (offset < this.offsetMs ? .5 : .02);
      }
    }
    const copy = { ...snapshot, players: snapshot.players.map(copyPlayer), events: [] };
    const index = this.snapshots.findIndex(s => s.serverTime >= snapshot.serverTime);
    if (index < 0) this.snapshots.push(copy);
    else if (this.snapshots[index].serverTime === snapshot.serverTime) {
      if (snapshot.tick >= this.snapshots[index].tick) this.snapshots[index] = copy;
    } else this.snapshots.splice(index, 0, copy);
    if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots.splice(0, this.snapshots.length - MAX_SNAPSHOTS);
    for(const [id,anchors] of this.landings){
      const current=anchors.filter(a=>a.serverTime>=this.snapshots[0].serverTime);
      if(current.length)this.landings.set(id,current);else this.landings.delete(id);
    }
  }

  get drawnAt(): number | null { return this.visualTime; }

  sample(nowMs: number): CombatFrame | null {
    const newest = this.snapshots.at(-1);
    if (!newest || !Number.isFinite(nowMs)) return null;
    const desired = this.offsetMs === null
      ? newest.serverTime + Math.max(0, nowMs - this.receivedAtMs) / 1000 - this.delayMs / 1000
      : (nowMs - this.offsetMs - this.delayMs - 2 * this.jitterMs) / 1000;
    return this.at(desired);
  }

  at(desired: number): CombatFrame | null {
    const newest = this.snapshots.at(-1);
    if (!newest || !Number.isFinite(desired)) return null;
    const oldest = this.snapshots[0];
    const time = Math.min(newest.serverTime, Math.max(oldest.serverTime, this.visualTime ?? oldest.serverTime, desired));
    this.visualTime = time;
    let index = 0;
    while (index + 1 < this.snapshots.length && this.snapshots[index + 1].serverTime <= time + TIME_EPSILON) index++;
    const before = this.snapshots[index], after = this.snapshots[index + 1];
    const weight = after ? Math.max(0, (time - before.serverTime) / (after.serverTime - before.serverTime)) : 0;
    const laterPlayers = new Map(after?.players.map(p => [p.id, p]));
    const players = before.players.map(player => {
      const result = copyPlayer(player), next = laterPlayers.get(player.id);
      let frozen = player.actionFrozen ?? 0;
      if (next) {
        const teleport = (!player.alive && next.alive) || (before.status === 'waiting' && after?.status === 'active')
          || Math.hypot(next.x - player.x, next.y - player.y, next.z - player.z) > 10;
        if (!teleport) {
          result.x = lerp(player.x, next.x, weight); result.y = lerp(player.y, next.y, weight); result.z = lerp(player.z, next.z, weight);
          const landing=next.grounded?this.landings.get(player.id)?.find(e=>e.serverTime>before.serverTime&&e.serverTime<=after!.serverTime):undefined;
          if(landing?.origin){
            const landed=time+TIME_EPSILON>=landing.serverTime;
            const start=landed?landing.origin:player,end=landed?next:landing.origin;
            const startTime=landed?landing.serverTime:before.serverTime,endTime=landed?after!.serverTime:landing.serverTime;
            const phase=Math.max(0,Math.min(1,(time-startTime)/Math.max(TIME_EPSILON,endTime-startTime)));
            result.x=lerp(start.x,end.x,phase);result.y=lerp(start.y,end.y,phase);result.z=lerp(start.z,end.z,phase);
            result.grounded=landed;
          }
          const yawDelta = Math.atan2(Math.sin(next.yaw - player.yaw), Math.cos(next.yaw - player.yaw));
          result.yaw = player.yaw + yawDelta * weight;
        }
        if (next.actionStarted <= time + TIME_EPSILON && next.actionStarted >= player.actionStarted) {
          result.action = next.action; result.actionStarted = next.actionStarted;
          result.actionDuration = next.actionDuration; result.guarding = next.guarding;
          if (next.action === 'defeated') { result.alive = false; result.hp = 0; }
          if (next.actionStarted > player.actionStarted) frozen = 0;
        }
        const from = next.hitstopFrom ?? player.hitstopFrom, until = next.hitstopUntil ?? player.hitstopUntil;
        if (from !== undefined && until !== undefined) {
          result.hitstopFrom = from; result.hitstopUntil = until;
          result.hitstop = time >= from && time < until;
          const spent = Math.min(time, until) - Math.max(before.serverTime, from, result.actionStarted);
          if (spent > 0) frozen += Math.min(Math.max(0, (next.actionFrozen ?? 0) - frozen), Math.floor(spent / TICK + 1e-9) * TICK);
        }
      }
      result.actionFrozen = frozen;
      result.actionTime = result.actionDuration > 0
        ? Math.min(1, Math.max(0, (time - result.actionStarted - frozen) / result.actionDuration)) : 0;
      return result;
    });
    let ready = 0;
    while (ready < this.pending.length && this.pending[ready].serverTime <= time + TIME_EPSILON) ready++;
    const events = this.pending.splice(0, ready);
    const snapshot: GameSnapshot = { ...before, players, events, serverTime: time };
    const war=riftOf(before);if(war)Object.assign(snapshot,{rift:presentRift(war,riftOf(after),weight,time)});
    return { snapshot, time, events };
  }
}
