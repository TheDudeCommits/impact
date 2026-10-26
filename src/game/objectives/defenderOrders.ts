import type { PlayerState } from '../types';
import type { ObjectiveView } from './model';
import { gateWaypoint } from './lastStand';

export interface DefenderOrder { role: 'rescue' | 'intercept'; target: string; lane?: number }
const gap = (a: PlayerState, b: PlayerState) => Math.hypot(a.x - b.x, a.z - b.z);
function route(a: PlayerState, b: PlayerState) {
  let at: { x: number; z: number } = a, length = 0;
  for (let leg = 0; leg < 4; leg++) {
    const next = gateWaypoint(at, b);
    if (!next) break;
    length += Math.hypot(next.x - at.x, next.z - at.z); at = next;
  }
  return length + Math.hypot(b.x - at.x, b.z - at.z);
}
export function defenderOrders(players: readonly PlayerState[], view: ObjectiveView, previous: ReadonlyMap<string, DefenderOrder> = new Map()): Map<string, DefenderOrder> {
  const orders = new Map<string, DefenderOrder>();
  if (view.kind !== 'last-stand' || view.phase !== 'active') return orders;
  const byId = new Map(players.map(p => [p.id, p]));
  const bots = view.seats.filter(s => s.bot && !s.down && !s.disconnected).map(s => byId.get(s.id)).filter((p): p is PlayerState => !!p?.alive);
  const available = new Set(bots.map(p => p.id));
  const fallen = view.seats.filter(s => s.down).sort((a, b) => b.rescue - a.rescue || a.id.localeCompare(b.id));
  for (const seat of fallen) {
    const target = byId.get(seat.id); if (!target) continue;
    const humanHelping = view.seats.some(s => !s.bot && !s.disconnected && s.id !== seat.id && byId.get(s.id)?.alive && Math.abs(byId.get(s.id)!.y - target.y) < 2 && gap(byId.get(s.id)!, target) < 2.8);
    if (humanHelping) continue;
    let rescuer: PlayerState | undefined, best = Infinity;
    for (const bot of bots) if (available.has(bot.id)) {
      const old = previous.get(bot.id), cost = route(bot, target) - (old?.role === 'rescue' && old.target === target.id ? 6 : 0);
      if (cost < best || cost === best && bot.id.localeCompare(rescuer!.id) < 0) { rescuer = bot; best = cost; }
    }
    if (rescuer) { orders.set(rescuer.id, { role: 'rescue', target: target.id }); available.delete(rescuer.id); }
    if (available.size <= 1 && bots.length > 1) break;
  }
  const covered = new Map<string, number>();
  const laneCovered = new Map<number, number>();
  const targetLane = new Map<string, number>();
  for (const lane of view.village?.pressure ?? []) for (const id of lane.targets) targetLane.set(id, lane.lane);
  const humanTargets = view.seats.filter(s => !s.bot).map(s => byId.get(s.id)).filter((p): p is PlayerState => !!p?.alive);
  for (const p of humanTargets) {
    const target = p.target ? byId.get(p.target) : undefined;
    if (target?.alive && gap(p, target) < 12) {
      covered.set(target.id, (covered.get(target.id) ?? 0) + 1);
      const lane = targetLane.get(target.id); if (lane !== undefined) laneCovered.set(lane, (laneCovered.get(lane) ?? 0) + 1);
    }
  }
  const targets = (view.village?.pressure ?? []).flatMap(lane => lane.targets.map(id => ({ lane, p: byId.get(id) }))).filter((t): t is typeof t & { p: PlayerState } => !!t.p?.alive);
  const specialists = new Map(view.village?.specialists?.map(s => [s.id, s]) ?? []);
  for (const bot of bots.filter(p => available.has(p.id)).sort((a, b) => a.id.localeCompare(b.id))) {
    let target: typeof targets[number] | undefined, best = -Infinity;
    const old = previous.get(bot.id);
    for (const candidate of targets) {
      const specialist = specialists.get(candidate.p.id);
      const score = candidate.lane.level * 45 - route(bot, candidate.p) - (covered.get(candidate.p.id) ?? 0) * 30 - (laneCovered.get(candidate.lane.lane) ?? 0) * 40
        + (specialist?.role === 'sapper' ? specialist.charging ? 50 : 25 : 0)
        + (old?.role === 'intercept' && old.target === candidate.p.id ? 8 : 0);
      if (score > best || score === best && candidate.p.id.localeCompare(target!.p.id) < 0) { target = candidate; best = score; }
    }
    if (target) { orders.set(bot.id, { role: 'intercept', target: target.p.id, lane: target.lane.lane }); covered.set(target.p.id, (covered.get(target.p.id) ?? 0) + 1); laneCovered.set(target.lane.lane, (laneCovered.get(target.lane.lane) ?? 0) + 1); }
  }
  return orders;
}
