import { isReleasedFighter, isLaboratoryFighter } from '../../game/rosterAvailability';
import { BURN_TICK, FREEZE_IMMUNITY, type MoveDefinition } from '../../game/moves';
import { TIME_STOP_TOURS } from '../../game/timeStopBarrage';
import type { AttackSlot, CoreSlot, FighterId } from '../../game/types';
import { canonicalJson, sha256 } from './hash';
import { FIGHTER_IDS, simSpec } from './registry';
import { ATTACK_SLOTS, CORE_SLOTS } from './spec';
import { FORGE_STATUSES, pickSource, TUNE_LIMITS, tuneMove, type ForgeFx, type SlotPick, type TuneKey } from './tune';
import { moveProblems, type Problems } from './validate';
import { houseKit } from './houseKits';
import { areaTotal } from './areaDamage';

export { FORGE_STATUSES, pickSource, TUNE_LIMITS, tuneMove };
export type { ForgeFx, ForgeStatus, SlotPick, TuneKey } from './tune';

export const FORGE_VERSION = 1 as const;
export const BUDGET_LIMIT = 1.1;
const SLOT_WEIGHT: Record<AttackSlot, number> = { light: 1, heavy: 1, special: 1, ultimate: .5, area: 1 };

export type KitSlots = Record<CoreSlot, SlotPick> & { area?: SlotPick };
export interface ForgeKit {
  forge: typeof FORGE_VERSION;
  name: string;
  body: FighterId;
  slots: KitSlots;
  aura?: ForgeFx;
}
export interface ForgeCheck { sandbox?: boolean; availability?: 'released' | 'laboratory' }
export function houseForgeKit(body: FighterId): ForgeKit | undefined {
  const house = houseKit(body);
  if (!house) return undefined;
  const own = ownKit(body);
  return { ...own, slots: { ...own.slots, ...house.slots } as KitSlots, ...(house.aura ? { aura: house.aura } : {}) };
}

export const kitPick = (kit: Pick<ForgeKit, 'body' | 'slots'>, slot: AttackSlot): SlotPick => kit.slots[slot] ?? { from: kit.body };

const known: ReadonlySet<string> = new Set(FIGHTER_IDS);

export function ownKit(body: FighterId, name: string = body): ForgeKit {
  return { forge: FORGE_VERSION, name, body, slots: Object.fromEntries(ATTACK_SLOTS.map(slot => [slot, { from: body }])) as KitSlots };
}

export function tunedMove(slot: AttackSlot, pick: SlotPick): MoveDefinition {
  const from = pickSource(slot, pick), source = simSpec(from.fighter)?.kit.slots[from.slot];
  if (!source) throw new Error(`No ${from.slot} for "${pick.from}".`);
  return tuneMove(source, pick);
}

export function forgeMoves(kit: ForgeKit): Record<AttackSlot, MoveDefinition> {
  return Object.fromEntries(ATTACK_SLOTS.map(slot => {
    const pick = kitPick(kit, slot), move = tunedMove(slot, pick), tour = TIME_STOP_TOURS[pick.from];
    if ((pick.from !== kit.body || pickSource(slot, pick).slot !== slot) && move.timeStop && !move.timeStop.tour && tour) move.timeStop = { ...move.timeStop, tour };
    return [slot, move];
  })) as Record<AttackSlot, MoveDefinition>;
}

export function moveDamage(move: MoveDefinition): number {
  if (move.area) return areaTotal(move);
  if (move.schedule) return move.schedule.reduce((sum, each) => sum + each, 0);
  const n = move.contacts.length;
  return n > 1 ? move.damage * (n - 1) + (move.finisherDamage ?? move.damage) : (move.finisherDamage ?? move.damage);
}
export function statusValue(status: MoveDefinition['status']): number {
  if (!status) return 0;
  if (status.kind === 'burn') return Math.round((status.dps ?? 0) * BURN_TICK) * Math.floor(status.seconds / BURN_TICK);
  if (status.kind === 'slow') return (1 - (status.factor ?? 1)) * status.seconds * 45;
  return status.seconds * 65;
}
const statusPeriod = (status: NonNullable<MoveDefinition['status']>) => status.kind === 'freeze' ? status.seconds + FREEZE_IMMUNITY : status.seconds;
export function movePower(move: MoveDefinition): number {
  const cycle = Math.max(move.duration, move.cooldown, .2), reach = 1 + .5 * Math.min(1, Math.max(0, move.range) / 30);
  const status = move.status ? statusValue(move.status) / Math.max(cycle, statusPeriod(move.status)) : 0;
  return (moveDamage(move) / cycle + status) * reach;
}
export function kitPower(moves: Record<AttackSlot, MoveDefinition>): number {
  return ATTACK_SLOTS.reduce((sum, slot) => sum + movePower(moves[slot]) * SLOT_WEIGHT[slot], 0);
}
export function budget(kit: ForgeKit): number {
  const mine = forgeMoves(kit), own = forgeMoves(ownKit(kit.body));
  const core = (moves: Record<AttackSlot, MoveDefinition>) => CORE_SLOTS.reduce((sum, slot) => sum + movePower(moves[slot]) * SLOT_WEIGHT[slot], 0);
  return (core(mine) + (movePower(mine.area) - movePower(own.area)) * SLOT_WEIGHT.area) / core(own);
}

const FX_ID = /^[a-z0-9][a-z0-9_/-]{0,63}$/, FX_KEY = /^[A-Za-z0-9_]{1,40}$/;
function fxProblems(fx: unknown, at: string, error: (text: string) => void) {
  if (fx === undefined) return;
  const pick = fx as ForgeFx;
  if (!pick || typeof pick !== 'object' || typeof pick.effect !== 'string' || !FX_ID.test(pick.effect)) { error(`The ${at}'s effect isn't an Armory effect id.`); return; }
  const settings = pick.settings ?? {};
  if (typeof settings !== 'object' || Array.isArray(settings) || Object.keys(settings).length > 48) error(`The ${at}'s effect settings aren't a short list of values.`);
  else for (const [key, value] of Object.entries(settings))
    if (!FX_KEY.test(key) || !(typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 64))) error(`The ${at}'s effect setting "${key}" isn't a plain value.`);
  if (pick.scale !== undefined && !(typeof pick.scale === 'number' && pick.scale >= .25 && pick.scale <= 4)) error(`The ${at}'s effect size must stay within 25-400%.`);
  if (pick.hue !== undefined && !(typeof pick.hue === 'number' && pick.hue >= -180 && pick.hue <= 180)) error(`The ${at}'s effect hue must stay within -180..180 degrees.`);
}

export function forgeProblems(kit: ForgeKit, check: ForgeCheck = {}): Problems {
  const out: Problems = { errors: [], warnings: [] };
  const error = (text: string) => out.errors.push(text);
  if (!kit || kit.forge !== FORGE_VERSION) { error(`This isn't a Forge ${FORGE_VERSION} kit.`); return out; }
  if (typeof kit.name !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} .'!?-]{0,23}$/u.test(kit.name.trim())) error('Name it with 1-24 letters, digits, spaces or . \' ! ? -');
  if (!known.has(kit.body)) { error(`There is no body called "${kit.body}".`); return out; }
  const available = (id: FighterId) => !check.availability || isReleasedFighter(id) || check.availability === 'laboratory' && isLaboratoryFighter(id);
  if (!available(kit.body)) error('This fighter is not available.');
  for (const slot of ATTACK_SLOTS) {
    const pick = kit.slots?.[slot];
    if (slot === 'area' && pick === undefined) continue;
    if (!pick || !known.has(pick.from)) { error(`The ${slot} comes from nobody the game knows ("${pick?.from}").`); continue; }
    if (!available(pick.from)) error(`The ${slot}'s source fighter is not available.`);
    if (pick.fromSlot !== undefined && !(ATTACK_SLOTS as readonly string[]).includes(pick.fromSlot)) error(`The ${slot} takes "${pick.fromSlot}", which is not a move slot.`);
    if (pick.status !== undefined && !(pick.status in FORGE_STATUSES)) error(`The ${slot}'s status "${pick.status}" is not burn, slow or freeze.`);
    fxProblems(pick.fx, slot, error);
    for (const [key, value] of Object.entries(pick.tune ?? {})) {
      const limits = TUNE_LIMITS[key as TuneKey];
      if (!limits) error(`The ${slot}'s "${key}" isn't something a move can be tuned by.`);
      else if (typeof value !== 'number' || value < limits[0] || value > limits[1]) error(`The ${slot}'s ${key} must stay within ${Math.round(limits[0] * 100)}-${Math.round(limits[1] * 100)}%.`);
    }
  }
  fxProblems(kit.aura, 'aura', error);
  if (out.errors.length) return out;
  const moves = forgeMoves(kit);
  for (const slot of ATTACK_SLOTS) {
    moveProblems(moves[slot], slot, out);
    if (slot === 'area' && !moves[slot].area) error(`The area slot takes an area move; "${moves[slot].name}" isn't one.`);
    if (slot !== 'area' && moves[slot].area) error(`"${moves[slot].name}" is an area move: it only fits the area slot.`);
  }
  const ratio = check.sandbox ? 0 : budget(kit);
  if (ratio > BUDGET_LIMIT) error(`It is ${Math.round(ratio * 100)}% as strong as this body's own kit; the Forge allows ${Math.round(BUDGET_LIMIT * 100)}%. Tune its power down or pick lighter moves.`);
  return out;
}

const toBase64Url = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (code: string) => {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - code.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
};

export function encodeForge(kit: ForgeKit): string {
  const json = canonicalJson(kit);
  return `JF1.${toBase64Url(json)}.${sha256(json).slice(0, 8)}`;
}
export function decodeForge(code: string): ForgeKit {
  const [tag, body, check, ...rest] = code.trim().split('.');
  if (tag !== 'JF1' || !body || !check || rest.length) throw new Error("That isn't a Forge code (they start with JF1.).");
  let json: string;
  try { json = fromBase64Url(body); } catch { throw new Error("That Forge code is damaged: it can't be read."); }
  if (sha256(json).slice(0, 8) !== check) throw new Error('That Forge code is incomplete or mistyped.');
  const kit = JSON.parse(json) as ForgeKit;
  if (canonicalJson(kit) !== json) throw new Error('That Forge code was not made by the Forge.');
  return kit;
}
export const forgeHash = (kit: ForgeKit) => sha256(canonicalJson(kit));
