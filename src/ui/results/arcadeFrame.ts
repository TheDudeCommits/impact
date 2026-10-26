import { FIGHTERS } from '../../config';
import type { FighterId } from '../../game/types';
import { resultsFrame } from './ResultsFrame';

const text = (root: ParentNode, selector: string) => root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
const html = (root: ParentNode, selector: string) => root.querySelector(selector)?.innerHTML ?? '';

export function arcadeFrame(panel: HTMLElement, fighter: FighterId): string {
  const cells = [...panel.querySelectorAll('#sv-results-grid > div')].map(cell => [cell.querySelector('b')?.textContent ?? '', cell.querySelector('span')?.textContent ?? ''] as [string, string]);
  const cell = (label: RegExp) => cells.find(([, name]) => label.test(name));
  const kos = cell(/KOs|KNOCKOUTS/i), survived = cell(/SURVIVED/i), bosses = cell(/BOSSES/i), style = cell(/STYLE/i);
  const stats: [string, string][] = [kos ?? ['0', 'KNOCKOUTS'], survived ?? ['0:00', 'SURVIVED'], bosses ?? ['0', 'BOSSES']].map(([value, label]) => [value, label]);
  const record = panel.querySelector('#sv-record:not(.hidden)')?.textContent?.trim();
  const breakdown = `${style ? `<p class="results-line">BEST STYLE · <b>${style[0]}</b></p>` : ''}${html(panel, '#sv-results-bosses')}${html(panel, '#sv-results-summary')}<div class="sv-result-extra">${html(panel, '#sv-result-extra')}</div>${html(panel, '#sv-result-damage')}<div class="sv-results-picks">${html(panel, '#sv-results-picks')}</div>`;
  const again = panel.querySelector<HTMLButtonElement>('#sv-retry');
  const againLabel = (again?.firstChild?.textContent ?? 'PLAY AGAIN').replace(/[↻\s]+$/, '').trim() || 'PLAY AGAIN';
  return resultsFrame({
    mast: 'ARCADE SURVIVAL', where: text(panel, '#sv-result-chapter'),
    fighter, fighterName: FIGHTERS[fighter]?.name ?? '',
    kicker: text(panel, '#sv-results-kicker').replace(/^ARCADE SURVIVAL( · )?/, '') || (FIGHTERS[fighter]?.name ?? '').toUpperCase(),
    outcome: text(panel, '#sv-results-title') || 'CHAPTER CLOSED',
    line: [text(panel, '#sv-results-sub'), record].filter(Boolean).join(' · '),
    key: { value: text(panel, '#sv-result-score') || '0', label: 'FINAL SCORE' },
    stats, won: panel.classList.contains('victory') || panel.classList.contains('sealed'),
    kanji: panel.classList.contains('victory') ? '勝' : panel.classList.contains('sealed') ? '封' : '終',
    details: { summary: 'RUN BREAKDOWN', html: breakdown },
    again: { label: againLabel, sub: againLabel === 'PLAY AGAIN' ? 'A NEW RUN' : undefined, attrs: 'data-sv-press="#sv-retry"', disabled: !!again?.disabled },
    training: 'data-results="training"', home: 'data-sv-press="#sv-leave"',
    extras: [{ label: 'SHARE CARD', attrs: 'data-sv-press="#sv-share"' }, { label: 'RIFT PROFILE', attrs: 'data-sv-press="#sv-profile-open"' }],
  });
}
