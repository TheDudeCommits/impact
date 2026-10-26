const DRAWN = new Set<string>();
const FX = new Set<string>(), FX_ANY = new Set<string>();

export function armoryDraws(fighter: string | undefined, slot: string | undefined, branch?: string, player?: string): boolean {
  if (branch !== undefined || fighter === undefined || slot === undefined || (DRAWN.size === 0 && FX.size === 0)) return false;
  const key = `${fighter}:${slot}`;
  return DRAWN.has(key) || (player !== undefined ? FX.has(`${player}|${key}`) : FX_ANY.has(key));
}

export function fxDraws(fighter: string | undefined, slot: string | undefined, branch?: string, player?: string): boolean {
  if (FX.size === 0 || branch !== undefined || fighter === undefined || slot === undefined) return false;
  return player !== undefined ? FX.has(`${player}|${fighter}:${slot}`) : FX_ANY.has(`${fighter}:${slot}`);
}
export function setFxDrawn(keys: Iterable<{ readonly player: string; readonly key: string }>) {
  FX.clear(); FX_ANY.clear();
  for (const { player, key } of keys) { FX.add(`${player}|${key}`); FX_ANY.add(key); }
}

const ONLY = new Set<string>();
export function markArmoryOnly(fighter: string) { ONLY.add(fighter); }

export function signatureCovers(fighter: string, slot?: string, branch?: string) {
  return slot === undefined || !ONLY.has(fighter) || armoryDraws(fighter, slot, branch);
}

export function markArmoryDrawn(fighter: string, slots: Iterable<string>) { for (const slot of slots) DRAWN.add(`${fighter}:${slot}`); }
export function clearArmoryDrawn(fighter: string) {
  for (const set of [DRAWN, HIT]) for (const key of [...set]) if (key.startsWith(`${fighter}:`)) set.delete(key);
}

const HIT = new Set<string>();
export function markArmoryHit(fighter: string, slots: Iterable<string>) { for (const slot of slots) HIT.add(`${fighter}:${slot}`); }
export function flightKept(fighter: string | undefined, slot: string | undefined, branch?: string, player?: string): boolean {
  if (HIT.size === 0 || branch !== undefined || fighter === undefined || slot === undefined) return false;
  const key = `${fighter}:${slot}`;
  return HIT.has(key) && !fxDraws(fighter, slot, branch, player);
}
