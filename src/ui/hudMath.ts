import type { PlayerState } from '../game/types';

export interface MarkerPlacement { x: number; y: number; offscreen: boolean; angle: number }
export function placeMarker(x: number, y: number, inFront: boolean, width: number, height: number, margin = 60): MarkerPlacement {
  const cx = width / 2, cy = height / 2;
  let dx = x - cx, dy = y - cy;
  if (!inFront) { dx = -dx; dy = -dy; if (dx === 0 && dy === 0) dy = 1; }
  const limitX = Math.max(1, cx - margin), limitY = Math.max(1, cy - margin);
  const angle = Math.atan2(dy, dx);
  if (inFront && Math.abs(dx) <= limitX && Math.abs(dy) <= limitY) return { x, y, offscreen: false, angle };
  const scale = Math.min(dx ? limitX / Math.abs(dx) : Infinity, dy ? limitY / Math.abs(dy) : Infinity);
  return { x: cx + dx * scale, y: cy + dy * scale, offscreen: true, angle };
}

export function rankPlayers(players: PlayerState[], winnerId: string | null, fallen: string[]): PlayerState[] {
  const order = new Map(fallen.map((id, i) => [id, i] as const));
  const key = (p: PlayerState) => {
    if (p.id === winnerId) return 0;
    if (p.alive) return 1;
    const index = order.get(p.id);
    return index === undefined ? 2 + fallen.length : 2 + (fallen.length - 1 - index);
  };
  return [...players].sort((a, b) => key(a) - key(b)
    || (b.damageDealt ?? 0) - (a.damageDealt ?? 0)
    || (b.kills ?? 0) - (a.kills ?? 0)
    || a.name.localeCompare(b.name));
}

export function resultTitle(selfId: string, alive: boolean, winnerId: string | null): string {
  return winnerId === selfId ? 'LAST FIGHTER STANDING' : alive ? 'MATCH COMPLETE' : 'ELIMINATED';
}
