import type { AttackSlot, FighterId } from '../../game/types';
import { canonicalJson } from '../sim/hash';
import { ATTACK_SLOTS } from '../sim/spec';
import { FORGE_VERSION, kitPick, ownKit, type ForgeFx, type ForgeKit, type SlotPick } from '../sim/forge';

export type StudioTarget = AttackSlot | 'aura';
export const STUDIO_TARGETS: readonly StudioTarget[] = [...ATTACK_SLOTS, 'aura'];
export type StudioItem = { kind: 'move'; from: FighterId; fromSlot: AttackSlot } | { kind: 'fx'; effect: string };
export type StudioPart = 'move' | 'look';

export interface StudioTrial {
  readonly target: StudioTarget;
  readonly item: StudioItem;
  readonly kit: ForgeKit;
}
export interface StudioState {
  readonly body: FighterId;
  readonly assigned: ForgeKit;
  readonly trial?: StudioTrial;
  readonly history: readonly ForgeKit[];
  readonly merging?: string;
}

export const STUDIO_HISTORY = 100;
export const defaultKitName = (cardName: string) => `${cardName} Forged`.slice(0, 24).trim();

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

export function startStudio(body: FighterId, name: string, draft?: ForgeKit): StudioState {
  return { body, assigned: draft && draft.body === body ? draft : ownKit(body, name), history: [] };
}

export const inPlay = (state: StudioState): ForgeKit => state.trial?.kit ?? state.assigned;

export const fits = (target: StudioTarget, item: StudioItem): boolean => item.kind === 'fx' || (target === 'area') === (item.fromSlot === 'area');
export function targetFor(target: StudioTarget, item: StudioItem): StudioTarget {
  if (item.kind !== 'move') return target;
  if (item.fromSlot === 'area') return 'area';
  return target === 'aura' || target === 'area' ? item.fromSlot : target;
}

export function withItem(kit: ForgeKit, target: StudioTarget, item: StudioItem): ForgeKit {
  const at = targetFor(target, item);
  if (at === 'aura') return item.kind === 'fx' ? { ...kit, aura: { effect: item.effect } } : kit;
  const pick = kitPick(kit, at);
  const next: SlotPick = item.kind === 'move'
    ? { from: item.from, ...(item.fromSlot !== at ? { fromSlot: item.fromSlot } : {}), ...(pick.fx ? { fx: pick.fx } : {}) }
    : { ...pick, fx: { effect: item.effect } };
  return { ...kit, slots: { ...kit.slots, [at]: next } };
}

export function withOriginal(kit: ForgeKit, target: StudioTarget, part: StudioPart): ForgeKit {
  if (target === 'aura') { if (part !== 'look' || !kit.aura) return kit; const { aura: _aura, ...rest } = kit; return rest; }
  const pick = kitPick(kit, target);
  if (part === 'move' && !changed(kit, target).move) return kit;
  if (part === 'move') return { ...kit, slots: { ...kit.slots, [target]: { from: kit.body, ...(pick.fx ? { fx: pick.fx } : {}) } } };
  if (!pick.fx) return kit;
  const { fx: _fx, ...rest } = pick;
  return { ...kit, slots: { ...kit.slots, [target]: rest } };
}

export const lookOf = (kit: ForgeKit, target: StudioTarget): ForgeFx | undefined => target === 'aura' ? kit.aura : kitPick(kit, target).fx;
export function changed(kit: ForgeKit, target: StudioTarget): { move: boolean; look: boolean } {
  if (target === 'aura') return { move: false, look: !!kit.aura };
  const pick = kitPick(kit, target);
  return { move: pick.from !== kit.body || (pick.fromSlot !== undefined && pick.fromSlot !== target) || !!pick.tune || !!pick.status, look: !!pick.fx };
}
export const isOwnKit = (kit: ForgeKit) => STUDIO_TARGETS.every(target => { const each = changed(kit, target); return !each.move && !each.look; });

function commit(state: StudioState, kit: ForgeKit, merge?: string): StudioState {
  if (same(kit, state.assigned)) return { ...state, merging: merge };
  const merged = merge !== undefined && merge === state.merging;
  const history = merged ? state.history : [...state.history, state.assigned].slice(-STUDIO_HISTORY);
  return { ...state, assigned: kit, history, merging: merge };
}

export function tryItem(state: StudioState, target: StudioTarget, item: StudioItem): StudioState {
  const at = targetFor(target, item);
  return { ...state, trial: { target: at, item, kit: withItem(state.assigned, at, item) }, merging: undefined };
}
export const dropTrial = (state: StudioState): StudioState => state.trial ? { ...state, trial: undefined, merging: undefined } : state;
export function assignTrial(state: StudioState): StudioState {
  if (!state.trial) return state;
  return { ...commit(state, state.trial.kit), trial: undefined, merging: undefined };
}
export const assignItem = (state: StudioState, target: StudioTarget, item: StudioItem) => assignTrial(tryItem(state, target, item));
export function original(state: StudioState, target: StudioTarget, part: StudioPart): StudioState {
  const base = state.trial?.target === target ? dropTrial(state) : state;
  const kept = commit(base, withOriginal(base.assigned, target, part));
  return { ...kept, trial: kept.trial && { ...kept.trial, kit: withOriginal(kept.trial.kit, target, part) }, merging: undefined };
}
export function undo(state: StudioState): StudioState {
  if (!state.history.length) return dropTrial(state);
  return { ...state, assigned: state.history[state.history.length - 1], history: state.history.slice(0, -1), trial: undefined, merging: undefined };
}
export function loadKit(state: StudioState, kit: ForgeKit): StudioState {
  if (kit.forge !== FORGE_VERSION || kit.body !== state.body) return state;
  return { ...commit(dropTrial(state), kit), merging: undefined };
}

export function edit(state: StudioState, target: StudioTarget | 'name', change: (kit: ForgeKit) => ForgeKit, merge?: string): StudioState {
  if (state.trial && state.trial.target === target) return { ...state, trial: { ...state.trial, kit: change(state.trial.kit) }, merging: undefined };
  const kept = commit(state, change(state.assigned), merge);
  return state.trial ? { ...kept, trial: { ...state.trial, kit: change(state.trial.kit) } } : kept;
}


export const withTune = (slot: AttackSlot, key: 'power' | 'reach' | 'speed', value: number) => (kit: ForgeKit): ForgeKit => {
  const pick = kitPick(kit, slot), tune = { ...pick.tune, [key]: value };
  if (Math.abs(value - 1) < 1e-9) delete tune[key];
  const { tune: _tune, ...rest } = pick;
  return { ...kit, slots: { ...kit.slots, [slot]: Object.keys(tune).length ? { ...rest, tune } : rest } };
};
export const withStatus = (slot: AttackSlot, status: SlotPick['status']) => (kit: ForgeKit): ForgeKit => {
  const { status: _status, ...rest } = kitPick(kit, slot);
  return { ...kit, slots: { ...kit.slots, [slot]: status ? { ...rest, status } : rest } };
};
export const withLook = (target: StudioTarget, change: (fx: ForgeFx) => ForgeFx) => (kit: ForgeKit): ForgeKit => {
  const fx = lookOf(kit, target);
  if (!fx) return kit;
  return target === 'aura' ? { ...kit, aura: change(fx) } : { ...kit, slots: { ...kit.slots, [target]: { ...kitPick(kit, target), fx: change(fx) } } };
};
export const lookSetting = (key: string, value: number | string | boolean) => (fx: ForgeFx): ForgeFx => ({ ...fx, settings: { ...fx.settings, [key]: value } });
export const lookScale = (scale: number) => (fx: ForgeFx): ForgeFx => { const { scale: _scale, ...rest } = fx; return Math.abs(scale - 1) < 1e-9 ? rest : { ...rest, scale }; };
export const lookHue = (hue: number) => (fx: ForgeFx): ForgeFx => { const { hue: _hue, ...rest } = fx; return hue === 0 ? rest : { ...rest, hue }; };
export const withName = (name: string) => (kit: ForgeKit): ForgeKit => ({ ...kit, name });
