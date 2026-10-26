import type { FighterId } from '../../../game/types';
import rollout from '../../../engine/vfx/rollout.json';

let built: unknown, devServer = false;
try { built = import.meta.env.VITE_ARMORY; devServer = import.meta.env.DEV === true; } catch { built = undefined; devServer = false; }

export const ARMORY_BUILD: boolean = built === 'on' || built === '1' || built === 'true';
export const ARMORY_ENABLED: boolean = ARMORY_BUILD || devServer;
export const ARMORY_RUNTIME = true;

const lists = rollout as { live?: string[]; fighters: string[] };
export const ROLLOUT: readonly FighterId[] = Object.freeze([...lists.fighters] as FighterId[]);
export const LIVE: readonly FighterId[] = Object.freeze([...(lists.live ?? [])] as FighterId[]);
export const CAST: readonly FighterId[] = Object.freeze([...new Set([...LIVE, ...ROLLOUT])]);

export function armoryRollout(search: string = typeof location === 'object' && location ? location.search : '', dev: boolean = devServer, build: boolean = ARMORY_BUILD): ReadonlySet<FighterId> {
  let on = build, off = false;
  if (dev) {
    let asked: string | null = null;
    try { asked = new URLSearchParams(search).get('armory'); } catch { asked = null; }
    if (asked === 'on') on = true; else if (asked === 'off') { on = false; off = true; }
  }
  return new Set(off ? [] : on ? CAST : LIVE);
}
