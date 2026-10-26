import { FIGHTERS, type FighterDefinition } from '../../config';
import type { FighterId } from '../../game/types';
import { registerOverride, restoreOverride, type FighterPatch } from '../client/override';
import { packProblems, packRoster, type PackDefinition, type SlotOverride } from './pack';
import { activePack, setActivePack } from './active';

let branded: { title: string } | undefined;

export function presentationPatch(id: FighterId, slot: SlotOverride): FighterPatch {
  const { card } = slot, look = slot.look ?? {};
  const patch: FighterPatch = { name: card.name, series: card.series, color: card.color, moves: [...card.moves] };
  if (card.shortMoves) patch.shortMoves = [...card.shortMoves];
  if (card.portrait) patch.portrait = card.portrait;
  const fields = ['model', 'formModel', 'clips', 'rushClips', 'rushModel', 'extraModels', 'formExtraModels', 'openHandsModel',
    'normalization', 'formNormalization', 'height', 'outlineWidth'] as const satisfies readonly (keyof LookFields)[];
  for (const key of fields) {
    if (!(key in look)) continue;
    const value = look[key];
    (patch as Record<string, unknown>)[key] = value === null ? undefined : structuredClone(value);
  }
  if (look.clipsFrom === 'slot') {
    const own = FIGHTERS[id];
    patch.extraModels = [own.model, ...(own.extraModels ?? []), ...(look.extraModels ?? [])];
  }
  return patch;
}
type LookFields = Pick<FighterDefinition, 'model' | 'formModel' | 'clips' | 'rushClips' | 'rushModel' | 'extraModels' | 'formExtraModels'
  | 'openHandsModel' | 'normalization' | 'formNormalization' | 'height' | 'outlineWidth'>;

export function applyPack(pack: PackDefinition) {
  const { errors } = packProblems(pack);
  if (errors.length) throw new Error(`Pack "${pack.id}": ${errors.join(' ')}`);
  restorePack();
  try {
    for (const id of packRoster(pack)) registerOverride(id, presentationPatch(id, pack.slots[id]!));
  } catch (error) {
    for (const id of packRoster(pack)) restoreOverride(id);
    throw error;
  }
  setActivePack(pack);
  if (typeof document === 'object') {
    branded = { title: document.title };
    if (pack.branding?.title) document.title = pack.branding.title;
    document.documentElement.dataset.pack = pack.id;
    if (pack.branding?.accent) document.documentElement.style.setProperty('--pack-accent', pack.branding.accent);
  }
}

export function restorePack() {
  const active = activePack();
  if (!active) return;
  for (const id of packRoster(active)) restoreOverride(id);
  if (typeof document === 'object' && branded) {
    document.title = branded.title;
    delete document.documentElement.dataset.pack;
    document.documentElement.style.removeProperty('--pack-accent');
  }
  setActivePack(undefined); branded = undefined;
}
