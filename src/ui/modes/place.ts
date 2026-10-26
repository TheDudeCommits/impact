import { STAGES } from '../../game/stages';
import { SMALL_ROYALE_STAGES } from '../../game/stages';
import { namedPlace, placeFits, placesFor } from '../../game/stageChoice';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const placePicture = (id: string, thumb = false) => `/assets/stages/previews/${id}${thumb ? '-thumb' : ''}.webp`;

export function placeRow(mode: string, way: string, saved: unknown, field?: number): string {
  const places = placesFor(mode, way);
  if (!places.length) return '';
  const named = namedPlace(saved, mode, way, field);
  const dealt = way === 'friends' ? 'Dealt when your room opens' : 'A different place each time';
  const tiles = places.map(id => {
    const stage = STAGES[id], fits = placeFits(id, field), on = id === named;
    return `<button type="button" class="ms-place-tile" data-ms-place="${id}" role="option" aria-selected="${on}" aria-label="${escape(stage.name)}: ${escape(stage.scene)}"${fits ? '' : ` disabled data-tag="UP TO ${SMALL_ROYALE_STAGES[id]}"`} style="background-image:url('${placePicture(id, true)}')"><span>${escape(stage.name)}</span></button>`;
  }).join('');
  return `<div class="ms-place" role="listbox" aria-label="Location"><button type="button" class="ms-place-tile ms-random" data-ms-place="" role="option" aria-selected="${!named}" aria-label="Random: ${dealt}"><span>RANDOM</span></button>${tiles}</div>`;
}

export function placeShown(mode: string, way: string, saved: unknown, field?: number) {
  const places = placesFor(mode, way);
  if (!places.length) return undefined;
  const named = namedPlace(saved, mode, way, field);
  return { id: named, at: named ? places.indexOf(named) + 2 : 1, of: places.length + 1,
    name: named ? STAGES[named].name : 'Random', scene: named ? STAGES[named].scene : way === 'friends' ? 'Dealt when your room opens' : 'A different place each time' };
}
