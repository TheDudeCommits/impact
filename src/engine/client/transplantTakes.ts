import type * as THREE from 'three';
import { FIGHTERS } from '../../config';
import { AWAKENINGS, moveFor } from '../../game/awakening';
import { MOVES, type MoveDefinition } from '../../game/moves';
import type { AttackSlot, CoreSlot, FighterId, PlayerState } from '../../game/types';
import { Fighter, OWN_BODY_ULTIMATE, clipMotionTable } from '../../render/Fighter';
import { isCharacterMotion } from '../../render/characterMotion';
import { findClipIn } from '../../render/clipMatch';
import { GOKU_MELEE_CONTACTS, GOKU_TRANSMISSION } from '../../render/gokuMeleeContact';
import { BAJRANG_TAKE } from '../../render/luffy/bajrang';
import { forgedMoveFor } from '../sim/forgedKits';
import { CORE_SLOTS } from '../sim/spec';
import { retarget, rigOf, type Fitted, type Rig } from './retarget';
import { areaAnimBorrowed, borrowedAction, forged, type Borrowed } from './transplant';
import { areaAnimOf } from '../sim/areaMoves';

export interface Transplanted {
  readonly clip: THREE.AnimationClip;
  readonly phase: string;
  readonly move: MoveDefinition;
  readonly slot: AttackSlot;
  readonly pacedState?: PlayerState;
  paced(state: PlayerState): PlayerState;
}

interface Take { readonly clip: THREE.AnimationClip; readonly rig: Rig; readonly linear: boolean }
interface SlotTakes { readonly open: Take; readonly cine?: Take; readonly form?: Take }
type Takes = Record<CoreSlot, SlotTakes>;

export function takeOf(from: FighterId, fromSlot: AttackSlot): { fighter: FighterId; slot: CoreSlot } {
  if (fromSlot !== 'area') return { fighter: from, slot: fromSlot };
  const anim = areaAnimOf(from, MOVES[from]?.area);
  return { fighter: anim.fighter, slot: anim.slot };
}
export const takeSlotOf = (from: FighterId, fromSlot: AttackSlot): CoreSlot => takeOf(from, fromSlot).slot;

const REFERENCE = ['_Idle', 'Idle', 'goku-ready', '02-STANCE', 'stance', 'idle'];
const referenceOf = (clips: readonly THREE.AnimationClip[]) => findClipIn(clips, REFERENCE);
const rigFor = (scene: THREE.Object3D, clips: readonly THREE.AnimationClip[]) => rigOf(scene, referenceOf(clips));

const standing = (fighter: FighterId): PlayerState => ({ id: `transplant-${fighter}`, name: 'Transplant', fighter, x: 0, y: -1000, z: 0, yaw: 0, hp: 1, maxHp: 1,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 1, actionTime: 0, target: null, alive: true, isBot: true, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

const formThrowsUltimate = (id: FighterId) => !!FIGHTERS[id].formModel && id !== 'naruto' && !OWN_BODY_ULTIMATE.has(id) && AWAKENINGS[id].formTint === undefined;
const linearTake = (id: FighterId, slot: AttackSlot, clip: THREE.AnimationClip) => isCharacterMotion(clip)
  || (id === 'naruto' && /^(Naruto|Kurama)\s*(light|heavy|special|ultimate)$/i.test(clip.name))
  || (id === 'goku' && slot === 'heavy' && clip.name === GOKU_MELEE_CONTACTS[GOKU_TRANSMISSION].clip);

const takes = new Map<FighterId, Takes>();
export function readTakes(body: Fighter, id: FighterId): Takes {
  const known = takes.get(id);
  if (known) return known;
  const out = takesOff(body, id);
  takes.set(id, out);
  return out;
}
export const setTakes = (id: FighterId, from: Takes) => { if (!takes.has(id)) takes.set(id, from); };
const ownTakes = new WeakMap<Fighter, Takes>();
function takesOff(body: Fighter, id: FighterId): Takes {
  const state = standing(id), out = {} as Takes;
  const take = (on: Fighter, slot: AttackSlot, patch: Partial<PlayerState> = {}): Take => {
    const read = on.take({ ...state, action: slot, ...patch });
    return { clip: read.clip!, rig: rigFor(read.scene, read.clips), linear: linearTake(id, slot, read.clip!) };
  };
  for (const slot of CORE_SLOTS) {
    const open = take(body, slot);
    if (slot !== 'ultimate') { out[slot] = { open }; continue; }
    const cine = take(body, slot, { confirmedAt: 0 }), form = formThrowsUltimate(id) ? body.take(state).form : undefined;
    out[slot] = { open, ...(cine.clip !== open.clip ? { cine } : {}), ...(form ? { form: take(form, slot, { confirmedAt: 0 }) } : {}) };
  }
  return out;
}
export const knownTakes = (id: FighterId) => takes.get(id);

const fitted = new WeakMap<THREE.AnimationClip, WeakMap<Rig, Fitted>>();
const said = new Set<string>();
const report = new Map<string, { ok: boolean; reason?: string; pinned?: number }>();
export const fitReport = () => Object.fromEntries(report);
export function fit(take: Take, rig: Rig, label: string): Fitted {
  let byRig = fitted.get(take.clip);
  if (!byRig) fitted.set(take.clip, byRig = new WeakMap());
  let result = byRig.get(rig);
  if (!result) {
    result = take.rig === rig ? { clip: take.clip, stray: 0, pinned: 0 } : retarget(take.rig, take.clip, rig);
    if (result.clip) clipMotionTable(result.clip);
    else if (!said.has(label)) { said.add(label); console.info(`Transplant: ${label} keeps the body's own take: ${result.reason}.`); }
    report.set(label, result.clip ? { ok: true, pinned: +result.pinned.toFixed(3) } : { ok: false, reason: result.reason });
    byRig.set(rig, result);
  }
  return result;
}

function takeNow(slot: SlotTakes, from: FighterId, fromSlot: AttackSlot, state: PlayerState, move: MoveDefinition): { take: Take; phase: string } {
  if (fromSlot !== 'ultimate') return { take: slot.open, phase: '' };
  const confirmed = state.confirmedAt !== undefined, elapsed = state.actionTime * state.actionDuration;
  if (slot.form && (move.confirm ? confirmed : elapsed >= (from === 'luffy' ? BAJRANG_TAKE.swap : .48))) return { take: slot.form, phase: '-form' };
  if (confirmed && slot.cine) return { take: slot.cine, phase: '-cine' };
  return { take: slot.open, phase: '' };
}

class Swap implements Transplanted {
  clip!: THREE.AnimationClip;
  phase = '';
  move!: MoveDefinition;
  slot!: AttackSlot;
  from!: FighterId;
  fromSlot!: AttackSlot;
  linear = false;
  pacedState?: PlayerState;
  paced(state: PlayerState) {
    return this.pacedState = { ...state, fighter: this.from, action: this.linear ? 'idle' : this.fromSlot, chain: this.fromSlot === 'light' ? 0 : undefined, branch: undefined };
  }
}
const swaps = new WeakMap<Fighter, Swap>();
const bodyRigs = new WeakMap<Fighter, Rig>();
let request: ((body: FighterId, from: FighterId, fromSlot: AttackSlot) => void) | undefined;
export const onTakeWanted = (wanted: typeof request) => { request = wanted; };

export function transplantFor(body: Fighter, state: PlayerState): Transplanted | undefined {
  const borrowed = forged(state) ? borrowedAction(state) : areaAnimBorrowed(state);
  if (!borrowed || (!state.grounded && (borrowed.slot === 'light' || borrowed.slot === 'heavy'))) return undefined;
  let own: SlotTakes | undefined;
  const source = takeOf(borrowed.fighter, borrowed.fromSlot), slot = source.slot;
  if (source.fighter === state.fighter) {
    let mine = ownTakes.get(body);
    if (!mine) ownTakes.set(body, mine = takesOff(body, state.fighter));
    own = mine[slot];
  } else own = takes.get(source.fighter)?.[slot];
  if (!own) { request?.(state.fighter, source.fighter, slot); return undefined; }
  const move = movePlayed(state, borrowed), now = takeNow(own, source.fighter, state.action === 'area' ? 'area' : borrowed.fromSlot, state, move);
  let rig = bodyRigs.get(body);
  if (!rig) { const read = body.take({ ...state, action: 'idle' }); bodyRigs.set(body, rig = rigFor(read.scene, read.clips)); }
  const result = fit(now.take, rig, `${borrowed.fighter}'s ${slot}${now.phase} on ${state.fighter}`);
  if (!result.clip) return undefined;
  let swap = swaps.get(body);
  if (!swap) swaps.set(body, swap = new Swap());
  swap.clip = result.clip; swap.phase = now.phase; swap.move = move; swap.slot = borrowed.slot; swap.from = borrowed.fighter; swap.fromSlot = borrowed.fromSlot;
  swap.linear = now.take.linear;
  return swap;
}
function movePlayed(state: PlayerState, borrowed: Borrowed): MoveDefinition {
  return forgedMoveFor(state) ?? moveFor(state.fighter, borrowed.slot, !!state.awakened);
}

export function fitAhead(from: FighterId, fromSlot: AttackSlot, bodies: readonly Fighter[], donor: (id: FighterId) => Fighter | undefined): boolean {
  const source = takeOf(from, fromSlot);
  if (source.fighter !== from) return fitAhead(source.fighter, source.slot, bodies, donor);
  let own = takes.get(from);
  if (!own) {
    const made = donor(from);
    if (!made) return false;
    try { own = readTakes(made, from); } finally { made.dispose(); }
  }
  const at = source.slot, slot = own[at];
  if (!slot) return false;
  const phases = fromSlot === 'area' ? [slot.open] : [slot.open, slot.cine, slot.form];
  for (const body of bodies) {
    const read = body.take({ ...standing(body.state.fighter), action: 'idle' }), rig = rigFor(read.scene, read.clips);
    bodyRigs.set(body, rig);
    for (const take of phases) if (take) fit(take, rig, `${from}'s ${at} on ${body.state.fighter}`);
    const form = read.form;
    if (form) { const formRead = form.take({ ...standing(body.state.fighter), action: 'idle' }), formRig = rigFor(formRead.scene, formRead.clips); for (const take of phases) if (take) fit(take, formRig, `${from}'s ${at} on ${body.state.fighter}'s form`); }
  }
  return true;
}

export function installTakes() { Fighter.transplant = transplantFor; }
export function resetTakes() { takes.clear(); said.clear(); }
