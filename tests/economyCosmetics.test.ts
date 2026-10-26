import { describe, expect, it } from 'vitest';
import { ITEMS, released, type ItemKind } from '../src/game/economy/catalog';
import { SKIN } from '../src/render/cosmetics/skins';
import { AURA_IDS, FORM_IDS } from '../src/render/cosmetics/auras';
import { KILL_IDS } from '../src/render/cosmetics/kills';
import { BANNER_IDS } from '../src/ui/survival/banners';
import { OUTFITS } from '../src/game/economy/outfits';
import { FIGHTERS } from '../src/config';
import { HOME_FIGHTERS_2 } from '../src/ui/MangaHome';
import { TRAIL_IDS } from '../src/render/cosmetics/trails';
import { KNOCKOUT_IDS } from '../src/render/cosmetics/knockouts';
import { ENTRANCE_IDS, STAMP_IDS, entranceHtml, stampHtml } from '../src/render/cosmetics/pages';
import { EMOTE_IDS } from '../src/render/cosmetics/emotes';

const DRAWN: Partial<Record<ItemKind, readonly string[]>> = {
  skin: Object.keys(SKIN), aura: AURA_IDS, trail: TRAIL_IDS, ko: KNOCKOUT_IDS, entrance: ENTRANCE_IDS, stamp: STAMP_IDS, emote: EMOTE_IDS,
  kill: KILL_IDS, banner: BANNER_IDS, form: FORM_IDS, outfit: Object.keys(OUTFITS),
  fighter: HOME_FIGHTERS_2.filter(id => FIGHTERS[id]).map(id => `fighter-${id}`),
};

describe('the economy: what is sold is drawn', () => {
  it('draws everything out - on sale, on the road, retired and still worn - and offers nothing it cannot draw', () => {
    for (const item of ITEMS.filter(released)) {
      if (item.kind === 'title') continue;
      expect(DRAWN[item.kind], `${item.kind} has no drawer`).toBeTruthy();
      expect(DRAWN[item.kind], item.id).toContain(item.id);
    }
    for (const [kind, ids] of Object.entries(DRAWN)) for (const id of ids!) expect(ITEMS.find(each => each.id === id)?.kind, id).toBe(kind);
  });
  it('dresses each outfit on the fighter its item names, and only them', () => {
    for (const item of ITEMS.filter(each => each.kind === 'outfit')) { expect(item.fighter, item.id).toBeTruthy(); expect(OUTFITS[item.id]?.fighter, item.id).toBe(item.fighter); }
    for (const [id, outfit] of Object.entries(OUTFITS)) expect(outfit.model || outfit.variant, id).toBeTruthy();
  });
  it('letters an entrance page and a seal, and nothing for what is not one', () => {
    const page = entranceHtml('entrance-night', { fighter: 'zoro', name: 'Mihawk <3', title: 'God Hand', level: 12 });
    expect(page).toContain('e-night'); expect(page).toContain('MIHAWK &lt;3'); expect(page).toContain('GOD HAND'); expect(page).toContain('LV 12');
    expect(stampHtml('stamp-the-end')).toContain('完'); expect(stampHtml(undefined)).toBe(''); expect(stampHtml('skin-negative')).toBe('');
  });
});
