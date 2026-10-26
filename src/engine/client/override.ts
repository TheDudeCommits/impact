import { FIGHTERS, type FighterDefinition } from '../../config';
import type { FighterId } from '../../game/types';

export type FighterPatch = { [K in keyof FighterDefinition]?: FighterDefinition[K] | undefined };

export const OVERRIDE_FIELDS = [
  'name', 'series', 'color', 'outlineWidth', 'moves', 'shortMoves', 'model', 'portrait', 'formModel', 'clips', 'rushClips',
  'rushModel', 'extraModels', 'formExtraModels', 'openHandsModel', 'normalization', 'formNormalization', 'height', 'rootMotion',
  'formClips', 'formShortMoves', 'formRootMotion',
] as const satisfies readonly (keyof FighterDefinition)[];
type Field = typeof OVERRIDE_FIELDS[number];
const FIELDS: ReadonlySet<string> = new Set(OVERRIDE_FIELDS);

const isText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const isTexts = (v: unknown, n?: number) => Array.isArray(v) && (n === undefined || v.length === n) && v.every(isText);
const isAsset = (v: unknown, ext: RegExp) => typeof v === 'string' && v.startsWith('/assets/') && ext.test(v);
const isPlacement = (v: unknown) => !!v && typeof v === 'object' && Number.isFinite((v as { scale: number }).scale) && (v as { scale: number }).scale > 0
  && Array.isArray((v as { position: unknown }).position) && (v as { position: unknown[] }).position.length === 3 && (v as { position: unknown[] }).position.every(Number.isFinite);
const CHECK: Readonly<Record<Field, { ok: (v: unknown) => boolean; what: string; optional?: true }>> = {
  name: { ok: v => isText(v) && (v as string).length <= 24, what: 'a name of 1-24 characters' },
  series: { ok: v => isText(v) && (v as string).length <= 40, what: 'a series of 1-40 characters' },
  color: { ok: v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v), what: 'a #rrggbb colour' },
  outlineWidth: { ok: v => typeof v === 'number' && v >= 0 && v <= .01, what: 'an ink width of 0-0.01' },
  moves: { ok: v => isTexts(v, 4) && (v as string[]).every(s => s.length <= 60), what: 'four move names' },
  shortMoves: { ok: v => isTexts(v, 4) && (v as string[]).every(s => s.length <= 24), what: 'four short move names', optional: true },
  model: { ok: v => isAsset(v, /\.glb$/i), what: 'a .glb under /assets/' },
  portrait: { ok: v => isAsset(v, /\.(webp|png|jpe?g)$/i), what: 'an image under /assets/' },
  formModel: { ok: v => isAsset(v, /\.glb$/i), what: 'a .glb under /assets/', optional: true },
  clips: { ok: v => isTexts(v), what: 'clip names', optional: true },
  rushClips: { ok: v => isTexts(v), what: 'clip names', optional: true },
  rushModel: { ok: v => isAsset(v, /\.glb$/i), what: 'a .glb under /assets/', optional: true },
  extraModels: { ok: v => Array.isArray(v) && v.every(each => isAsset(each, /\.glb$/i)), what: '.glb files under /assets/', optional: true },
  formExtraModels: { ok: v => Array.isArray(v) && v.every(each => isAsset(each, /\.glb$/i)), what: '.glb files under /assets/', optional: true },
  openHandsModel: { ok: v => isAsset(v, /\.glb$/i), what: 'a .glb under /assets/', optional: true },
  normalization: { ok: isPlacement, what: 'a { scale, position } placement', optional: true },
  formNormalization: { ok: isPlacement, what: 'a { scale, position } placement', optional: true },
  height: { ok: v => typeof v === 'number' && v > .3 && v < 6, what: 'a height of 0.3-6 m', optional: true },
  rootMotion: { ok: v => !!v && typeof v === 'object' && ['rise', 'drop', 'travel'].every(k => Number.isFinite((v as Record<string, number>)[k])), what: 'root motion caps { rise, drop, travel }', optional: true },
  formClips: { ok: v => isTexts(v), what: 'clip names', optional: true },
  formShortMoves: { ok: v => isTexts(v, 4) && (v as string[]).every(s => s.length <= 24), what: 'four short move names', optional: true },
  formRootMotion: { ok: v => !!v && typeof v === 'object' && ['rise', 'drop', 'travel'].every(k => Number.isFinite((v as Record<string, number>)[k])), what: 'root motion caps { rise, drop, travel }', optional: true },
};

export function overrideProblems(id: FighterId, patch: FighterPatch): string[] {
  const out: string[] = [];
  if (!Object.hasOwn(FIGHTERS, id)) return [`There is no fighter "${id}" to override.`];
  for (const [key, value] of Object.entries(patch)) {
    if (!FIELDS.has(key)) { out.push(`${id}.${key} is not a FIGHTERS field.`); continue; }
    const check = CHECK[key as Field];
    if (value === undefined) { if (!check.optional) out.push(`${id}.${key} can be replaced but not removed.`); continue; }
    if (!check.ok(value)) out.push(`${id}.${key} must be ${check.what}.`);
  }
  return out;
}

const originals = new Map<FighterId, Map<Field, { present: boolean; value: unknown }>>();
const copy = <T>(value: T): T => Array.isArray(value) ? [...value] as T : value && typeof value === 'object' ? structuredClone(value) : value;

export function registerOverride(id: FighterId, patch: FighterPatch): () => void {
  const problems = overrideProblems(id, patch);
  if (problems.length) throw new Error(problems.join(' '));
  const entry = FIGHTERS[id] as unknown as Record<string, unknown>;
  let saved = originals.get(id);
  if (!saved) originals.set(id, saved = new Map());
  for (const [key, value] of Object.entries(patch) as [Field, unknown][]) {
    if (!saved.has(key)) saved.set(key, { present: Object.hasOwn(entry, key), value: entry[key] });
    if (value === undefined) delete entry[key];
    else entry[key] = copy(value);
  }
  return () => restoreOverride(id);
}

export function restoreOverride(id: FighterId) {
  const saved = originals.get(id);
  if (!saved) return;
  const entry = FIGHTERS[id] as unknown as Record<string, unknown>;
  for (const [key, { present, value }] of saved) {
    if (present) entry[key] = value;
    else delete entry[key];
  }
  originals.delete(id);
}

export function restoreOverrides() { for (const id of [...originals.keys()]) restoreOverride(id); }
export const overriddenFighters = (): FighterId[] => [...originals.keys()];
