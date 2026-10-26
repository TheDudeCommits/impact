import type { MoveDefinition, SlotMoves } from '../../game/moves';
import type { AttackSlot, FighterId } from '../../game/types';
import { CORE_SLOTS, FIGHTER_IDS, forgeMoves, forgeProblems, moveProblems, type ForgeKit, type Problems } from '../sim';

export const PACK_ENGINE = 1 as const;

export const PACK_MODES = ['duel', 'royale', 'training', 'arcade', 'last-stand', 'bad-blood', 'rift-war'] as const;
export type PackMode = typeof PACK_MODES[number];

type Four = readonly [string, string, string, string];
export interface CardOverride {
  name: string;
  series: string;
  color: string;
  portrait?: string;
  moves: Four;
  shortMoves?: Four;
}
export interface LookOverride {
  model?: string;
  formModel?: string | null;
  clips?: readonly string[];
  rushClips?: readonly string[];
  rushModel?: string | null;
  extraModels?: readonly string[] | null;
  formExtraModels?: readonly string[] | null;
  openHandsModel?: string | null;
  normalization?: { scale: number; position: readonly [number, number, number] } | null;
  formNormalization?: { scale: number; position: readonly [number, number, number] } | null;
  height?: number;
  outlineWidth?: number;
  clipsFrom?: 'slot';
}
export type PackKit = ForgeKit | { moves: Readonly<SlotMoves> };

export interface ArtOverride { bust?: string; portrait?: string; poster?: string; moves?: string }

export interface SlotOverride {
  card: CardOverride;
  look?: LookOverride;
  art?: ArtOverride;
  kit?: PackKit;
  names?: Readonly<Record<string, string>>;
  quiet?: boolean;
}

export interface PackDefinition {
  id: string;
  name: string;
  engine: typeof PACK_ENGINE;
  slots: Readonly<Partial<Record<FighterId, SlotOverride>>>;
  branding?: { title?: string; accent?: string; tagline?: string };
  modes?: readonly PackMode[];
}

const known: ReadonlySet<string> = new Set(FIGHTER_IDS);
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/, COLOUR = /^#[0-9a-f]{6}$/i, ASSET = /^\/assets\/[^\s?#]+$/;
const isName = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

export function definePack<const P extends PackDefinition>(pack: P): Readonly<P> {
  const freeze = (value: unknown) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const inner of Object.values(value)) freeze(inner); }
  };
  freeze(pack);
  return pack;
}

export const packRoster = (pack: PackDefinition): FighterId[] => (Object.keys(pack.slots) as FighterId[]).filter(id => !!pack.slots[id]);

export function packFiles(pack: PackDefinition): string[] {
  const out = new Set<string>();
  for (const slot of Object.values(pack.slots)) {
    if (!slot) continue;
    const look = slot.look ?? {};
    for (const url of [slot.card.portrait, look.model, look.formModel, look.rushModel, look.openHandsModel, ...(look.extraModels ?? []),
      ...(look.formExtraModels ?? []), ...Object.values(slot.art ?? {})]) if (url) out.add(url);
  }
  return [...out].sort();
}

export const packPlays = (pack: PackDefinition, mode: PackMode) => !pack.modes || pack.modes.includes(mode);

export function packSlotMoves(slot: SlotOverride): SlotMoves | undefined {
  const kit = slot.kit;
  if (!kit) return undefined;
  const moves: SlotMoves = 'moves' in kit ? structuredClone(kit.moves) as SlotMoves : forgeMoves(kit);
  CORE_SLOTS.forEach((each, i) => { moves[each] = { ...moves[each], name: slot.card.moves[i] }; });
  return moves;
}

export function packProblems(pack: PackDefinition): Problems {
  const out: Problems = { errors: [], warnings: [] };
  const error = (text: string) => out.errors.push(text);
  if (!pack || typeof pack !== 'object') { error('This is not a pack.'); return out; }
  if (pack.engine !== PACK_ENGINE) error(`It is written for engine ${pack.engine}; this is engine ${PACK_ENGINE}.`);
  if (typeof pack.id !== 'string' || !ID.test(pack.id)) error(`id "${pack.id}" must be 1-32 lower-case letters, digits and dashes.`);
  if (!isName(pack.name, 40)) error('It needs a name of 1-40 characters.');
  if (pack.branding?.accent !== undefined && !COLOUR.test(pack.branding.accent)) error('branding.accent must be a #rrggbb colour.');
  for (const mode of pack.modes ?? []) if (!(PACK_MODES as readonly string[]).includes(mode)) error(`mode "${mode}" is not one of ${PACK_MODES.join(', ')}.`);
  if (pack.modes && !pack.modes.length) error('modes is empty: the pack would play nowhere.');
  const ids = Object.keys(pack.slots ?? {});
  if (!ids.length) error('It has no slots.');
  const names = new Map<string, string>();
  for (const id of ids) {
    const at = (text: string) => error(`${id}: ${text}`), slot = pack.slots[id as FighterId], before = out.errors.length;
    if (!known.has(id)) { at('the game has no such fighter to be a slot.'); continue; }
    if (!slot) continue;
    const card = slot.card;
    if (!card) { at('has no card.'); continue; }
    if (!isName(card.name, 24)) at('card.name must be 1-24 characters.');
    else if (names.has(card.name.toLowerCase())) at(`card.name "${card.name}" is ${names.get(card.name.toLowerCase())}'s too.`);
    else names.set(card.name.toLowerCase(), id);
    if (!isName(card.series, 40)) at('card.series must be 1-40 characters.');
    if (!COLOUR.test(card.color ?? '')) at(`card.color "${card.color}" is not a #rrggbb colour.`);
    if (card.portrait !== undefined && !(ASSET.test(card.portrait) && /\.(webp|png|jpe?g)$/i.test(card.portrait))) at(`card.portrait "${card.portrait}" is not an image under /assets/.`);
    for (const key of ['moves', 'shortMoves'] as const) {
      const list = card[key];
      if (list === undefined && key === 'shortMoves') continue;
      if (!Array.isArray(list) || list.length !== 4 || !list.every(each => isName(each, key === 'moves' ? 60 : 24))) at(`card.${key} must be four names (${key === 'moves' ? 60 : 24} characters at most).`);
    }
    const look = slot.look ?? {};
    for (const key of ['model', 'formModel', 'rushModel', 'openHandsModel'] as const) {
      const v = look[key];
      if (v !== undefined && v !== null && !(ASSET.test(v) && /\.glb$/i.test(v))) at(`look.${key} "${v}" is not a .glb under /assets/.`);
    }
    if (look.model === null as unknown) at('look.model can be replaced but not removed.');
    for (const key of ['extraModels', 'formExtraModels'] as const) {
      const v = look[key];
      if (v !== undefined && v !== null && !(Array.isArray(v) && v.every(each => ASSET.test(each) && /\.glb$/i.test(each)))) at(`look.${key} must be .glb files under /assets/.`);
    }
    for (const key of ['normalization', 'formNormalization'] as const) {
      const v = look[key];
      if (v !== undefined && v !== null && !(v.scale > 0 && Number.isFinite(v.scale) && v.position?.length === 3 && v.position.every(Number.isFinite))) at(`look.${key} must be { scale > 0, position [x, y, z] }.`);
    }
    if (look.height !== undefined && !(look.height > .3 && look.height < 6)) at('look.height must be 0.3-6 m.');
    if (look.outlineWidth !== undefined && !(look.outlineWidth >= 0 && look.outlineWidth <= .01)) at('look.outlineWidth must be 0-0.01.');
    if (look.clipsFrom !== undefined && look.clipsFrom !== 'slot') at(`look.clipsFrom "${look.clipsFrom}" is not 'slot'.`);
    if (look.clipsFrom === 'slot' && !look.model) at("look.clipsFrom 'slot' lends the slot's clips to a new model: it needs look.model.");
    for (const key of ['clips', 'rushClips'] as const) if (look[key] !== undefined && !(Array.isArray(look[key]) && look[key]!.every(each => isName(each, 80)))) at(`look.${key} must be clip names.`);
    for (const [from, to] of Object.entries(slot.names ?? {})) if (!isName(from, 80) || !isName(to, 60)) at(`names["${from}"] must map a name to a name of 1-60 characters.`);
    for (const [kind, url] of Object.entries(slot.art ?? {})) {
      if (!['bust', 'portrait', 'poster', 'moves'].includes(kind)) at(`art.${kind} is not one of bust, portrait, poster, moves.`);
      else if (!(ASSET.test(url ?? '') && /\.(webp|png|jpe?g)$/i.test(url ?? ''))) at(`art.${kind} "${url}" is not an image under /assets/.`);
    }
    const kit = slot.kit;
    if (kit && 'moves' in kit) {
      for (const each of CORE_SLOTS) moveProblems(kit.moves?.[each], `${id}.kit.moves.${each}`, out);
      if (kit.moves?.area !== undefined) moveProblems(kit.moves.area, `${id}.kit.moves.area`, out);
    } else if (kit) {
      if (kit.body !== id) at(`kit.body is "${kit.body}": a slot's kit fights in the slot's own body.`);
      const forged = forgeProblems(kit);
      for (const text of forged.errors) at(`kit: ${text}`);
      for (const text of forged.warnings) out.warnings.push(`${id}: kit: ${text}`);
    }
    if (kit && out.errors.length === before) {
      const moves = packSlotMoves(slot)!;
      for (const each of CORE_SLOTS) moveProblems(moves[each], `${id}.${each}`, out);
      if (moves.area) moveProblems(moves.area, `${id}.area`, out);
    }
  }
  return out;
}
