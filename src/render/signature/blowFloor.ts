import type { Fighter } from '../Fighter';
import { SIGNATURE } from './context';


const STAND = .01;
const KEPT = 32, kx = new Float32Array(KEPT), ky = new Float32Array(KEPT), kz = new Float32Array(KEPT), kf = new Float32Array(KEPT), kt = new Float64Array(KEPT).fill(-Infinity);
let cursor = 0;

export function floorProbe(x: number, y: number, z: number): number | undefined {
  const ask = SIGNATURE.floor;
  if (!ask || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return undefined;
  const now = performance.now();
  for (let i = 0; i < KEPT; i++) if (now - kt[i] < 1000 && Math.abs(kx[i] - x) < .02 && Math.abs(kz[i] - z) < .02 && Math.abs(ky[i] - y) < .02) return kf[i];
  const found = ask(x, y, z);
  if (found === undefined || !Number.isFinite(found)) return undefined;
  const i = cursor++ % KEPT; kx[i] = x; ky[i] = y; kz[i] = z; kf[i] = found + STAND; kt[i] = now;
  return kf[i];
}

export function floorUnder(x: number, y: number, z: number): number { return floorProbe(x, y, z) ?? y; }

export function blowFloor(actor: Fighter | undefined, target: Fighter | undefined, fallback: number): number {
  const believed = target && target.state.grounded !== false ? target.group.position.y
    : actor && actor.state.grounded !== false ? actor.group.position.y
    : Math.min(actor?.group.position.y ?? fallback, target?.group.position.y ?? fallback);
  const under = (target ?? actor)?.group.position;
  return under ? floorUnder(under.x, believed, under.z) : believed;
}
