export const INPUT_HZ = 60;
export const STALL_SECONDS = .5;
export const MAX_CATCH_UP = 20;

export function catchUp(backlog: number, elapsed: number, rate = 1) {
  const tick = 1 / INPUT_HZ;
  const ceiling = (elapsed > STALL_SECONDS ? 1 : MAX_CATCH_UP) * tick;
  let left = Math.min(backlog + elapsed * Math.max(0, Math.min(1, rate)), ceiling);
  let steps = 0;
  while (left >= tick && steps < MAX_CATCH_UP) { left -= tick; steps++; }
  return { steps, backlog: left };
}
