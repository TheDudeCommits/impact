import type { FighterId } from '../../game/types';
import { KINDS, released, type Item } from '../../game/economy/catalog';
import { OUTFITS } from '../../game/economy/outfits';
import { fighterArt, mangaPortrait } from '../MangaHome';

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function itemArt(item: Item, fighter: FighterId): string {
  const glyph = item.kind === 'title' ? `<b class="shop-title-plate"><u>${escape(item.name)}</u></b>` : `<b>${escape(item.glyph ?? KINDS[item.kind].one[0])}</b>`;
  const waiting = released(item) ? '' : ' waiting';
  if (item.kind === 'outfit' && OUTFITS[item.id]?.model) return `<span class="shop-art k-outfit is-body${waiting}" data-art="${item.id}"><img class="shop-art-body" src="/assets/economy/outfits/${item.id}.webp" alt="" loading="lazy" decoding="async"><i></i>${glyph}</span>`;
  if (item.kind === 'fighter' && item.fighter) return `<span class="shop-art k-fighter${waiting}" data-art="${item.id}"><span class="shop-art-face">${mangaPortrait(item.fighter)}</span><i></i>${glyph}</span>`;
  const face = item.kind === 'skin' ? fighter : item.kind === 'outfit' ? item.fighter : undefined;
  return `<span class="shop-art k-${item.kind}${waiting}" data-art="${item.id}">${face ? `<span class="shop-art-face">${mangaPortrait(face)}</span>` : ''}<i></i>${glyph}</span>`;
}

export const fighterPage = (fighter: FighterId) => `<img class="shop-page-art" src="${fighterArt(fighter)}" alt="" decoding="async">`;
