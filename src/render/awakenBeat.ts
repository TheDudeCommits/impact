import { AWAKENING_ENTRY } from '../game/awakening';

export function awakenBeat(t: number, swap: number) {
  const ease = (u: number) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
  const out = (u: number) => { u = Math.min(1, Math.max(0, u)); return 1 - (1 - u) * (1 - u); };
  const settle = ease((t - swap) / Math.max(.05, AWAKENING_ENTRY - swap));
  const kick = t < swap ? 0 : Math.exp(-Math.max(0, t - swap - AWAKEN_KICK_RISE * .5) / AWAKEN_KICK_DECAY) * ease((t - swap) / AWAKEN_KICK_RISE);
  if (t < swap) {
    const u = out(t / swap);
    return { orbit: AWAKEN_ORBIT_SHARE * .8 * u, push: AWAKEN_GATHER_PUSH * u, drop: AWAKEN_GATHER_DROP * u, fov: AWAKEN_ZOOM * u, widen: 0, in: AWAKEN_BLEND_IN };
  }
  return {
    in: AWAKEN_BLEND_IN,
    orbit: AWAKEN_ORBIT_SHARE * (.8 + .2 * settle),
    push: AWAKEN_SETTLE_PUSH * settle + AWAKEN_GATHER_PUSH * (1 - ease((t - swap) / .08)) * (1 - settle) - AWAKEN_KICK_BACK * kick,
    drop: AWAKEN_GATHER_DROP * (1 - .4 * settle),
    fov: AWAKEN_ZOOM * (1 - kick) * (1 - .5 * settle) + .5 * settle,
    widen: AWAKEN_KICK_FOV * kick,
  };
}
export const AWAKEN_BLEND_IN = .18;
export const AWAKEN_GATHER_PUSH = .14, AWAKEN_GATHER_DROP = .3, AWAKEN_ZOOM = 2.4;
export const AWAKEN_ORBIT_SHARE = .4;
export const AWAKEN_SETTLE_PUSH = .06;
export const AWAKEN_KICK_BACK = .16, AWAKEN_KICK_FOV = 9, AWAKEN_KICK_DECAY = .13, AWAKEN_KICK_RISE = .1;
