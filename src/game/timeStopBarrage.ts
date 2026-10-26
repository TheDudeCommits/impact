import type { MoveDefinition } from './moves';
import type { FighterId, Vec3 } from './types';


export interface TourStyle {
  strike: number;
  blink: number;
  glide: boolean;
  cycle: boolean;
  lead: number;
  follow: number;
  domain?: boolean;
}
export const TIME_STOP_TOURS: Partial<Record<FighterId, TourStyle>> = {
  jotaro: { strike: 1.75, blink: .16, glide: true, cycle: false, lead: .03, follow: .04 },
  dio: { strike: 1.75, blink: .16, glide: true, cycle: false, lead: .03, follow: .04 },
  gojo: { strike: 1.2, blink: .05, glide: false, cycle: true, lead: .1, follow: .06, domain: true },
  sukuna: { strike: 2.4, blink: .16, glide: true, cycle: false, lead: .03, follow: .04, domain: true },
};
export interface TimeStopTour {
  at: number;
  from: Vec3;
  order?: string[];
  visited?: number;
  struck?: (Vec3 | null)[];
  visit: number;
  moveFrom?: Vec3;
  moveTo?: Vec3;
  teleport?: boolean;
  done?: boolean;
}
export const TOUR_SETTLE = .1;
export const BARRAGE_GAP = .26;
export const REVISIT_TURN = 2.05;

export function tourContacts(move: MoveDefinition): { first: number; last: number } | null {
  const stop = move.timeStop;
  if (!stop) return null;
  const first = stop.contact + 1, last = move.contacts.length - 2;
  return last >= first ? { first, last } : null;
}

export function tourBlows(move: MoveDefinition) {
  const blows = tourContacts(move);
  return blows ? blows.last - blows.first + 1 : 0;
}

export function barrageWindow(move: MoveDefinition): { start: number; end: number } | null {
  const blows = tourContacts(move);
  if (!blows) return null;
  const times = move.contacts.slice(blows.first, blows.last + 1);
  for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > BARRAGE_GAP) return null;
  return { start: times[0], end: times[times.length - 1] };
}

export function visitCount(move: MoveDefinition, style: TourStyle, visited: number) {
  const blows = tourBlows(move);
  if (visited <= 0 || !blows) return 0;
  return style.cycle ? blows : Math.min(visited, blows);
}

export function visitRange(move: MoveDefinition, k: number, visits: number): [number, number] {
  const blows = tourContacts(move)!, count = blows.last - blows.first + 1;
  const base = Math.floor(count / visits), longer = visits - count % visits;
  const start = k * base + Math.max(0, k - longer), size = base + (k >= longer ? 1 : 0);
  return [blows.first + start, blows.first + start + size - 1];
}

export function visitOf(move: MoveDefinition, contact: number, visits: number) {
  const blows = tourContacts(move);
  if (!blows || visits <= 0 || contact < blows.first || contact > blows.last) return -1;
  for (let k = 0; k < visits; k++) if (contact <= visitRange(move, k, visits)[1]) return k;
  return visits - 1;
}

export function blinkWindow(move: MoveDefinition, k: number, visits: number, style: TourStyle): [number, number] {
  const [first] = visitRange(move, k, visits);
  const end = move.contacts[first] - style.lead;
  const free = k === 0 ? move.contacts[move.timeStop!.contact] + TOUR_SETTLE : move.contacts[visitRange(move, k - 1, visits)[1]] + style.follow;
  return [Math.max(free, end - style.blink), Math.max(free, end)];
}

export function visitVictim(move: MoveDefinition, style: TourStyle, k: number, visited: number) {
  if (!style.cycle) return k;
  const visits = visitCount(move, style, visited);
  return ((visited - 1 - (visits - 1 - k)) % visited + visited) % visited;
}

export function priorVisits(move: MoveDefinition, style: TourStyle, k: number, visited: number) {
  const victim = visitVictim(move, style, k, visited);
  let n = 0;
  for (let j = 0; j < k; j++) if (visitVictim(move, style, j, visited) === victim) n++;
  return n;
}

export function planTour(from: { x: number; z: number }, facing: { x: number; z: number },
  victims: readonly { id: string; x: number; z: number }[], locked: string | null | undefined, blows: number) {
  if (!victims.length) return { order: [] as string[], visited: 0 };
  const before = (a: string, b: string) => a < b;
  let primary = victims.find(v => v.id === locked);
  if (!primary) {
    let best = -Infinity;
    for (const v of victims) {
      const dx = v.x - from.x, dz = v.z - from.z, d = Math.hypot(dx, dz) || 1e-6;
      const along = (dx * facing.x + dz * facing.z) / d;
      const score = (along > .5 ? 100 : 0) + along * 10 - d;
      if (score > best + 1e-9 || (Math.abs(score - best) <= 1e-9 && primary && before(v.id, primary.id))) { best = score; primary = v; }
    }
  }
  const rest = victims.filter(v => v !== primary);
  const chain: string[] = [];
  let at: { x: number; z: number } = from;
  while (rest.length) {
    let pick = 0, near = Infinity;
    for (let i = 0; i < rest.length; i++) {
      const d = Math.hypot(rest[i].x - at.x, rest[i].z - at.z);
      if (d < near - 1e-9 || (Math.abs(d - near) <= 1e-9 && before(rest[i].id, rest[pick].id))) { near = d; pick = i; }
    }
    const [next] = rest.splice(pick, 1);
    chain.push(next.id); at = next;
  }
  const room = Math.max(1, blows) - 1;
  const order = [...chain.slice(0, room), primary!.id, ...chain.slice(room)];
  return { order, visited: Math.min(order.length, Math.max(1, blows)) };
}
