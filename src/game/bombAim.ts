import type { Vec3 } from './types';

export const BOMB_LEAD = 4.5, BOMB_LEAD_SHARE = .5, BOMB_DRIFT = 6;
export const BOMB_HOME = 12;
export const BOMB_COMMIT = .3;

export function bombLead(from: Vec3, at: Vec3, vx: number, vz: number, speed: number, out: Vec3, share = BOMB_LEAD_SHARE, most = BOMB_LEAD) {
  let lx = 0, lz = 0, t = 0;
  for (let pass = 0; pass < 3; pass++) {
    t = Math.hypot(at.x + lx - from.x, at.y - from.y, at.z + lz - from.z) / Math.max(1, speed);
    lx = vx * t * share; lz = vz * t * share;
    const lead = Math.hypot(lx, lz);
    if (lead > most) { lx *= most / lead; lz *= most / lead; }
  }
  out.x = at.x + lx; out.y = at.y; out.z = at.z + lz;
  return t;
}

export function homeWant(at: { x: number; z: number }, vx: number, vz: number, left: number, out: { x: number; z: number }) {
  let lx = vx * left * BOMB_LEAD_SHARE, lz = vz * left * BOMB_LEAD_SHARE;
  const lead = Math.hypot(lx, lz);
  if (lead > BOMB_LEAD) { lx *= BOMB_LEAD / lead; lz *= BOMB_LEAD / lead; }
  out.x = at.x + lx; out.z = at.z + lz;
  return out;
}

export function inRange(point: { x: number; z: number }, centre: { x: number; z: number }, range: number) {
  const dx = point.x - centre.x, dz = point.z - centre.z, flat = Math.hypot(dx, dz);
  if (flat > range) { point.x = centre.x + dx * range / flat; point.z = centre.z + dz * range / flat; }
}

export function homeStep(end: Vec3, want: { x: number; z: number }, rate: number, dt: number, aimed: { x: number; z: number }, most = BOMB_DRIFT) {
  let dx = want.x - end.x, dz = want.z - end.z;
  const gap = Math.hypot(dx, dz), step = rate * dt;
  if (gap > step) { dx *= step / gap; dz *= step / gap; }
  let x = end.x + dx, z = end.z + dz;
  const ox = x - aimed.x, oz = z - aimed.z, off = Math.hypot(ox, oz);
  if (off > most) { x = aimed.x + ox * most / off; z = aimed.z + oz * most / off; }
  end.x = x; end.z = z;
}
