import { MOVES, PLAYER_RADIUS } from '../../game/moves';

const MOVE = MOVES.law.ultimate, SWAP = MOVE.teleport!;
export const SHAMBLES = {
  at: SWAP.appear,
  room: SWAP.reach + PLAYER_RADIUS,
  open: .28,
  hold: .05,
  jump: .9,
  close: .32, ward: 2.6,
  cube: .46, fall: .34, life: 1.1,
} as const;

export function shamblesHidden(elapsed: number) {
  return elapsed >= SHAMBLES.at && elapsed < SHAMBLES.at + SHAMBLES.hold;
}

export function cubeAt(age: number): { height: number; scale: number; opacity: number } | undefined {
  if (age < 0 || age > SHAMBLES.life) return undefined;
  const rest = SHAMBLES.cube / 2, from = 1.05;
  let height: number;
  if (age < SHAMBLES.fall) { const u = age / SHAMBLES.fall; height = from + (rest - from) * u * u; }
  else { const u = Math.min(1, (age - SHAMBLES.fall) / .16); height = rest + .09 * Math.sin(Math.PI * u); }
  const scale = Math.min(1, age / .06);
  const opacity = age < SHAMBLES.life - .4 ? 1 : Math.max(0, (SHAMBLES.life - age) / .4);
  return { height, scale, opacity };
}

export const SHAMBLES_TAKE = {
  open: { clip: 'Shambles', at: .4091 },
  cine: { from: .3, at: .7912 },
} as const;
