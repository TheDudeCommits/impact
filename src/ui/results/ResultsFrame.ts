import type { FighterId } from '../../game/types';
import { firstPicture } from '../hud/protos/proto';
import './resultsFrame.css';

export interface ResultsAction { label: string; sub?: string; attrs: string; disabled?: boolean }
export type ResultsTone = 'win' | 'loss' | 'draw';
export interface ResultsModel {
  mast: string;
  where: string;
  fighter: FighterId;
  fighterName: string;
  kicker: string;
  outcome: string;
  line?: string;
  key: { value: string; label: string };
  stats: readonly [string, string][];
  details?: { summary: string; html: string };
  won?: boolean;
  tone?: ResultsTone;
  kanji?: string;
  again: ResultsAction;
  home: string;
  training: string;
  extras?: readonly ResultsAction[];
}
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const button = (a: ResultsAction, cls = '', key = '', pad = '') => `<button type="button" class="${cls}" ${a.attrs}${key && key.length === 1 ? ` data-key="${key.toLowerCase()}"` : ''}${a.disabled ? ' disabled' : ''}><span>${escape(a.label)}</span>${a.sub ? `<small>${escape(a.sub)}</small>` : ''}${key ? `<kbd aria-hidden="true"${pad ? ` data-pad="${pad}"` : ''}>${key}</kbd>` : ''}</button>`;

export const MISSING_BUSTS = new Set<string>();
export const bustPicture = (fighter: FighterId) => firstPicture(fighter, false, MISSING_BUSTS);
const PORTRAIT = /\/assets\/home\/portraits\//;
const CRACK = `<svg class="results-crack" viewBox="0 0 620 700" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="miter"><path d="M330 0 L300 160 L360 250 L290 380 L340 470 L300 700"/><path d="M300 160 L190 210 L120 190"/><path d="M290 380 L420 420 L520 400"/></g><path d="M330 0 L300 160 L360 250 L290 380 L340 470 L300 700" fill="none" stroke="#0a0c15" stroke-width="2"/></svg>`;
const fit = (text: string, letters: number) => {
  const length = [...text].reduce((n, c) => n + (c === ' ' ? .45 : /[I1.,:'!·]/.test(c) ? .55 : /[MW]/.test(c) ? 1.25 : 1), 0), lines = length > 14 && text.includes(' ') ? 2 : 1;
  return Math.min(1, letters / Math.max(1, length / lines + (lines - 1))).toFixed(3);
};

export function resultsFrame(m: ResultsModel): string {
  const tone: ResultsTone = m.tone ?? (m.won ? 'win' : 'loss'), kanji = m.kanji ?? (tone === 'win' ? '勝' : tone === 'draw' ? '分' : '敗');
  const art = bustPicture(m.fighter);
  return `<div class="results-frame is-${tone === 'win' ? 'victory' : tone === 'draw' ? 'draw' : 'defeat'}" style="--t:${fit(m.outcome, 7.1)};--k:${fit(m.key.value, 5)}">
   <div class="results-stage">
    <span class="results-kanji" aria-hidden="true">${escape(kanji)}</span>
    <i class="results-band is-ink" aria-hidden="true"></i><i class="results-band is-red" aria-hidden="true"></i>
    <div class="results-bust" aria-hidden="true"><img src="${art}" alt="" data-results-bust="${m.fighter}"${PORTRAIT.test(art) ? ' data-fallback' : ''} decoding="async" draggable="false">${tone === 'loss' ? CRACK : ''}</div>
    <header class="results-masthead"><span>${escape(m.mast)}</span><b>${escape(m.where)}</b></header>
    <div class="results-ride">
      <div class="results-headline"><small>${escape(m.kicker)}</small><h2 id="results-title">${escape(m.outcome)}</h2>${m.line ? `<p class="results-line">${escape(m.line)}</p>` : ''}</div>
      <div class="results-stats" aria-label="Your results"><p class="results-key"><strong>${escape(m.key.value)}</strong><span>${escape(m.key.label)}</span></p>${m.stats.map(([value, label]) => `<div><strong>${escape(value)}</strong><span>${escape(label)}</span></div>`).join('')}</div>
    </div>
    <div class="results-rewards" data-results-rewards aria-live="polite"></div>
    ${m.details ? `<details class="results-standings"><summary>${escape(m.details.summary)} <span aria-hidden="true">+</span></summary><div class="results-fold match-results">${m.details.html}</div></details>` : ''}
    <footer class="results-actions">
      ${button(m.again, 'results-again', 'ENTER', 'south')}
      ${button({ label: 'CHANGE MODE', sub: 'BACK TO THE SHEET', attrs: 'data-results="change"' }, '', 'C')}
      ${button({ label: 'TRAINING', sub: `PRACTISE ${m.fighterName.toUpperCase()}`, attrs: m.training }, '', 'T')}
      ${(m.extras ?? []).map(extra => button(extra)).join('')}
      ${button({ label: 'HOME', attrs: m.home }, '', 'ESC', 'east')}
    </footer>
   </div>
  </div>`;
}

export const clock = (seconds: number) => { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
