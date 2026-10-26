import { isLaboratoryFighter, type LaboratoryFighterId } from './game/rosterAvailability';
import { OUTFITS } from './game/economy/outfits';
import type { FighterId } from './game/types';

export function laboratoryFighter(): FighterId | undefined {
  if (import.meta.env?.MODE !== 'fighter-lab' || typeof location !== 'object') return undefined;
  const asked = new URLSearchParams(location.search).getAll('fighter-lab');
  return asked.length === 1 && isLaboratoryFighter(asked[0]) ? asked[0] : undefined;
}

export function isLaboratoryPreviewFighter(value: unknown): value is LaboratoryFighterId {
  return import.meta.env?.MODE === 'fighter-lab' && isLaboratoryFighter(value);
}

export function selectLaboratoryFighter(value: unknown): value is LaboratoryFighterId {
  if(import.meta.env?.MODE !== 'fighter-lab')return false;
  if (!isLaboratoryPreviewFighter(value) || typeof location !== 'object' || typeof history !== 'object') return false;
  const url = new URL(location.href);
  url.searchParams.delete('fighter-lab');
  url.searchParams.set('fighter-lab', value);
  history.replaceState(history.state, '', url);
  return true;
}

export function laboratoryOutfit(fighter: FighterId): string | undefined {
  if (import.meta.env?.MODE !== 'fighter-lab' || laboratoryFighter() !== fighter || typeof location !== 'object') return undefined;
  const asked = new URLSearchParams(location.search).getAll('outfit-lab');
  if (asked.length !== 1) return undefined;
  const outfit = Object.hasOwn(OUTFITS, asked[0]) ? OUTFITS[asked[0]] : undefined;
  return outfit?.laboratory && outfit.fighter === fighter ? asked[0] : undefined;
}
