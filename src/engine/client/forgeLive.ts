import type { AttackSlot, FighterId } from '../../game/types';
import { FORGE_VERSION, kitPick, pickSource, type ForgeFx, type ForgeKit, type KitSlots, type SlotPick } from '../sim/forge';
import { forgedKit } from '../sim/forgedKits';
import { authoredSource, houseKit, housePick, ownPick } from '../sim/houseKits';
import { ATTACK_SLOTS } from '../sim/spec';


const active = new Map<FighterId, ForgeKit>();
const listeners = new Set<(body: FighterId, kit: ForgeKit | undefined) => void>();

export function setActiveKit(kit: ForgeKit | undefined, body: FighterId | undefined = kit?.body) {
  if (!body) return;
  if (kit) active.set(body, kit); else active.delete(body);
  for (const listener of listeners) listener(body, kit);
}
export const activeKit = (body: FighterId) => active.get(body);
export function onKitChange(listener: (body: FighterId, kit: ForgeKit | undefined) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export function playerKit(state: { fighter: FighterId; forge?: string }): ForgeKit | undefined {
  return state.forge ? forgedKit(state.forge) : active.get(state.fighter);
}

const merged = new WeakMap<ForgeKit, ForgeKit>(), houseOnly = new Map<FighterId, ForgeKit>();
function overHouse(fighter: FighterId, own: ForgeKit | undefined): ForgeKit {
  const house = houseKit(fighter)!;
  const slots = {} as KitSlots;
  for (const slot of ATTACK_SLOTS) {
    const pick: SlotPick = own ? kitPick(own, slot) : { from: fighter };
    const kept = housePick(fighter, slot);
    const from = ownPick(fighter, slot, pick) ? authoredSource(fighter, slot) : authoredSource(pick.from, pickSource(slot, pick).slot);
    const fx = pick.fx ?? (ownPick(fighter, slot, pick) ? kept?.fx : undefined);
    slots[slot] = { ...pick, from: from.fighter, ...(from.slot !== slot ? { fromSlot: from.slot } : { fromSlot: undefined }), ...(fx ? { fx } : { fx: undefined }) };
    if (slots[slot]!.fromSlot === undefined) delete slots[slot]!.fromSlot;
    if (slots[slot]!.fx === undefined) delete slots[slot]!.fx;
  }
  const aura = own?.aura ?? house.aura;
  return { forge: FORGE_VERSION, name: own?.name ?? fighter, body: own?.body ?? fighter, slots, ...(aura ? { aura } : {}) };
}

export function presentationKit(state: { fighter: FighterId; forge?: string }): ForgeKit | undefined {
  const own = playerKit(state);
  if (!houseKit(state.fighter)) return own;
  if (!own) { let kit = houseOnly.get(state.fighter); if (!kit) houseOnly.set(state.fighter, kit = overHouse(state.fighter, undefined)); return kit; }
  let kit = merged.get(own);
  if (!kit) merged.set(own, kit = overHouse(state.fighter, own));
  return kit;
}
export function moveSource(state: { fighter: FighterId; forge?: string }, slot: AttackSlot): { fighter: FighterId; slot: AttackSlot } | undefined {
  const kit = presentationKit(state);
  if (!kit) return undefined;
  const source = pickSource(slot, kitPick(kit, slot));
  return source.fighter === state.fighter && source.slot === slot ? undefined : source;
}
export function slotFx(state: { fighter: FighterId; forge?: string }, slot: AttackSlot | 'body'): ForgeFx | undefined {
  const kit = presentationKit(state);
  return slot === 'body' ? kit?.aura : kit?.slots[slot]?.fx;
}


export interface TransplantRuntime {
  prepare(body: FighterId, from: FighterId, fromSlot: AttackSlot): Promise<void>;
  prefetch?(from: FighterId): void;
}
export interface ArmoryEssential { key: string; label: string; min: number; max: number; step: number; value: number }
export interface ArmoryEffectInfo {
  id: string;
  label: string;
  school: string;
  kit?: string;
  cast: 'line' | 'zone';
  thumb: string;
  essentials: readonly ArmoryEssential[];
}
export interface ArmoryRuntime {
  effects(): readonly ArmoryEffectInfo[];
  prepare(id: string): Promise<void>;
  preview(playerId: string, fx: ForgeFx): void;
}

let transplant: TransplantRuntime | undefined, armory: ArmoryRuntime | undefined;
export const registerTransplant = (runtime: TransplantRuntime) => { transplant = runtime; };
export const registerArmory = (runtime: ArmoryRuntime) => { armory = runtime; };
export const transplantRuntime = () => transplant;
export const armoryRuntime = () => armory;
