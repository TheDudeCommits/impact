import { bossPortrait } from './bossArt';
import type { FighterId } from '../../game/types';
import { FIGHTERS } from '../../config';
import type { DealtBy, RunResult } from '../../survival/SurvivalGame';
import { CHALLENGES, MAX_MASTERY, masteryOf, rewardText, titleAt, type Settled } from '../../survival/progress';

const GROUPED = new Intl.NumberFormat('en-US');
const n = (x: number) => GROUPED.format(Math.round(x));
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export const SOURCES: readonly { key: keyof DealtBy; name: string; color: string }[] = [
  { key: 'blows', name: 'BLOWS', color: '#101d27' },
  { key: 'specials', name: 'SPECIALS', color: '#ee352a' },
  { key: 'ultimates', name: 'ULTIMATES', color: '#f0a020' },
  { key: 'techniques', name: 'TECHNIQUES', color: '#2f7fe0' },
  { key: 'team', name: 'FINISHERS', color: '#8a3ae0' },
];

export function shares(dealt: DealtBy | undefined) {
  if (!dealt) return [];
  const total = SOURCES.reduce((sum, s) => sum + (dealt[s.key] ?? 0), 0);
  if (total <= 0) return [];
  return SOURCES.map(s => ({ ...s, value: dealt[s.key] ?? 0, share: (dealt[s.key] ?? 0) / total })).filter(s => s.value > 0);
}

export function damageHtml(result: RunResult) {
  const parts = shares(result.dealtBy);
  if (!parts.length) return '';
  const bar = parts.map(p => `<i style="--w:${(p.share * 100).toFixed(2)}%;--c:${p.color}" title="${p.name}"></i>`).join('');
  const legend = parts.map(p => `<li><i style="--c:${p.color}"></i>${p.name} <b>${Math.round(p.share * 100)}%</b><small>${n(p.value)}</small></li>`).join('');
  return `<section class="sv-sum sv-sum-dmg"><h4>DAMAGE BY SOURCE</h4><div class="sv-sum-bar">${bar}</div><ul class="sv-sum-legend">${legend}</ul></section>`;
}

export function bossesHtml(result: RunResult) {
  const log = result.bossLog ?? [];
  if (!log.length) return `<section class="sv-sum sv-sum-bosses"><h4>BOSSES BEATEN</h4><p class="sv-sum-none">NONE FELL THIS RUN</p></section>`;
  const finished = log.filter(b => b.finished).length;
  const chips = log.map(b => `<figure class="sv-sum-boss${b.finished ? ' finished' : ''}" title="${esc(b.name)}"><span class="sv-sum-face"><img alt="" loading="lazy" src="${bossPortrait(b.id)}"></span>`
    + `<b class="sv-sum-rank">${b.rank}</b><figcaption>${esc(b.name.toUpperCase())}<small>${clock(b.seconds)}</small></figcaption>${b.finished ? '<em>FINISHED</em>' : ''}</figure>`).join('');
  return `<section class="sv-sum sv-sum-bosses"><h4>BOSSES BEATEN · ${log.length}${finished ? ` <span>${finished} FINISHED</span>` : ''}</h4><div class="sv-sum-row">${chips}</div></section>`;
}

export function progressHtml(fighter: FighterId, settled: Settled | undefined) {
  if (!settled) return '';
  const p = settled.progress, xp = p.mastery[fighter] ?? 0, now = masteryOf(xp), before = masteryOf(xp - settled.xp);
  const up = settled.to > settled.from;
  const from = up ? 0 : before.into / before.span, to = now.max ? 1 : now.into / now.span;
  const rewards = up ? Array.from({ length: settled.to - settled.from }, (_, i) => rewardText(settled.from + 1 + i)).filter(Boolean) : [];
  const done = settled.challenges.map(id => CHALLENGES.find(c => c.id === id)).filter(Boolean)
    .map(c => `<span class="sv-sum-chal" title="${esc(c!.line)}"><b>${esc(c!.name)}</b>+${c!.reward}</span>`).join('');
  return `<section class="sv-sum sv-sum-progress">`
    + `<div class="sv-sum-shards"><b>+${settled.shards + settled.bonus}</b><span>SHARDS</span><small>${n(p.shards)} TO SPEND</small></div>`
    + `<div class="sv-sum-mastery${up ? ' up' : ''}"><span>${esc(FIGHTERS[fighter].name.toUpperCase())} · MASTERY <b>LV ${now.level}${now.max ? ' · MAX' : ` / ${MAX_MASTERY}`}</b><small>+${settled.xp} XP</small></span>`
    + `<i class="sv-sum-xp" style="--from:${from.toFixed(3)};--to:${to.toFixed(3)}"><i></i></i>`
    + `<small class="sv-sum-title">${esc(titleAt(now.level))}</small>${rewards.map(r => `<em>LEVEL UP · ${esc(r)}</em>`).join('')}</div>`
    + (done ? `<div class="sv-sum-chals"><h4>CHALLENGES</h4>${done}</div>` : '')
    + `</section>`;
}
