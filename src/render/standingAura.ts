import { AWAKENINGS } from '../game/awakening';
import type { FighterId } from '../game/types';
import { awakenedPower } from './awakenedPower';


export function standingAura(fighter: FighterId): number | undefined {
  const power = awakenedPower(fighter);
  return power.shell ? power.glow : undefined;
}

const saturation = (hex: number) => { const r = hex >> 16 & 255, g = hex >> 8 & 255, b = hex & 255, max = Math.max(r, g, b); return max ? (max - Math.min(r, g, b)) / max : 0; };
const shade = (hex: number, k: number) => Math.round((hex >> 16 & 255) * k) << 16 | Math.round((hex >> 8 & 255) * k) << 8 | Math.round((hex & 255) * k);
const shells = new Map<number, readonly [number, number]>();
export function standingColours(fighter: FighterId, aura: readonly [number, number]): readonly [number, number] {
  const power = awakenedPower(fighter);
  if (power.colours) return power.colours;
  if (!power.shell || AWAKENINGS[fighter].flames) return aura;
  const key = aura[0] * 0x1000000 + aura[1];
  let colours = shells.get(key);
  if (!colours) { const pale = saturation(aura[0]) < .3 && saturation(aura[1]) >= saturation(aura[0]) + .1; shells.set(key, colours = pale ? [aura[1], shade(aura[1], .5)] : aura); }
  return colours;
}

export const PHYSICAL_PRESENCE: ReadonlySet<FighterId> = new Set((Object.keys(AWAKENINGS) as FighterId[]).filter(id => awakenedPower(id).physical));
