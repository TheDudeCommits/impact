import './cosmetics.css';
import { FIGHTERS } from '../../config';
import type { FighterId } from '../../game/types';
import { posePoster } from '../../ui/HomePreview';

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export interface Who { fighter: FighterId; name: string; title?: string; level: number }
export const ENTRANCE_MS = 1500;
const ENTRANCES: Record<string, string> = { 'entrance-paper': 'paper', 'entrance-newsprint': 'newsprint', 'entrance-night': 'night', 'entrance-gold-foil': 'gold', 'entrance-double-spread': 'spread' };
export const isEntrance = (id: string | undefined) => !!id && id in ENTRANCES;
export const ENTRANCE_IDS = Object.keys(ENTRANCES);

export function entranceHtml(id: string, who: Who): string {
  const variant = ENTRANCES[id] ?? 'paper', name = who.name.trim() || 'Fighter';
  return `<div class="cos-entrance e-${variant}" style="--hold:${ENTRANCE_MS}ms" aria-hidden="true">
    <i class="cos-entrance-page"></i>
    <i class="cos-entrance-band top"></i><i class="cos-entrance-band bottom"></i>
    <span class="cos-entrance-art"><img src="${posePoster(who.fighter)}" alt="" draggable="false"></span>
    <span class="cos-entrance-text">
      <small>LV ${who.level}${variant === 'spread' ? ' · A NEW CHAPTER BEGINS' : ''}</small>
      <strong${name.length > 12 ? ' class="long"' : ''}>${escape(name.toUpperCase())}</strong>
      ${who.title ? `<em>「${escape(who.title.toUpperCase())}」</em>` : ''}
      <b>${escape(FIGHTERS[who.fighter].name.toUpperCase())}</b>
    </span>
  </div>`;
}

const STAMPS: Record<string, { glyph: string; kind: string; line: string }> = {
  'stamp-the-end': { glyph: '完', kind: 'round', line: 'THE END' },
  'stamp-heavens-judgment': { glyph: '天誅', kind: 'gold', line: "HEAVEN'S JUDGMENT" },
  'stamp-one-blow': { glyph: '一撃必殺', kind: 'tall', line: 'ONE BLOW' },
};
export const STAMP_IDS = Object.keys(STAMPS);
export function stampHtml(id: string | undefined): string {
  const stamp = id ? STAMPS[id] : undefined;
  return stamp ? `<b class="cos-stamp s-${stamp.kind}" aria-hidden="true"><span>${stamp.glyph}</span><small>${stamp.line}</small></b>` : '';
}
