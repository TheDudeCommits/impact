import { mediaArt } from '../mediaArt';
import { isReleasedFighter } from '../../game/rosterAvailability';
import { bossPortrait } from './bossArt';
import type { FighterId } from '../../game/types';
import { FIGHTERS } from '../../config';
import { BOSSES, RANKS } from '../../survival/bosses';
import { ENEMIES } from '../../survival/enemies';
import { AURAS, CHALLENGES, MAX_MASTERY, UNLOCKS, aurasAt, auraOf, masteryOf, rewardText, startPointsAt, titleAt, type AuraId } from '../../survival/progress';
import { buyNode, loadProgress, wearAura } from '../../survival/progressStore';
import { TREE_NODE, BRANCHES } from '../../survival/skillTree';
import { rankText } from '../../survival/skillText';
import { upgrade } from '../../survival/upgrades';

type Page = 'fighters' | 'unlocks' | 'challenges' | 'bosses';
const PAGES: readonly { id: Page; name: string }[] = [
  { id: 'fighters', name: 'FIGHTERS' }, { id: 'unlocks', name: 'UNLOCKS' }, { id: 'challenges', name: 'CHALLENGES' }, { id: 'bosses', name: 'BOSS RECORD' },
];
const GROUPED = new Intl.NumberFormat('en-US');
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export class RiftProfile {
  readonly element: HTMLElement;
  private page: Page = 'fighters';
  private fighter?: FighterId;
  onAura: (fighter: FighterId, colour: number) => void = () => {};
  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'sv-profile hidden';
    this.element.id = 'sv-profile';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-label', 'Rift profile');
    parent.append(this.element);
    this.element.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!target) { if (event.target === this.element) this.close(); return; }
      const act = target.dataset.act!;
      if (act === 'close') this.close();
      else if (act === 'page') { this.page = target.dataset.page as Page; this.draw(); }
      else if (act === 'buy') { if (buyNode(target.dataset.node!)) this.draw(); else target.classList.add('refused'); }
      else if (act === 'aura') {
        const fighter = target.dataset.fighter as FighterId, aura = target.dataset.aura as AuraId;
        wearAura(fighter, aura); this.onAura(fighter, AURAS[auraOf(loadProgress(), fighter)].color); this.draw();
      }
    });
  }
  get open() { return !this.element.classList.contains('hidden'); }
  show(fighter?: FighterId, page: Page = 'fighters') {
    this.fighter = fighter; this.page = page;
    this.draw();
    this.element.classList.remove('hidden');
    window.setTimeout(() => this.element.querySelector<HTMLElement>('.sv-prof-tabs button.on')?.focus(), 30);
  }
  close() { this.element.classList.add('hidden'); this.onClose(); }
  onClose: () => void = () => {};
  step(dx: number) {
    const buttons = [...this.element.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[at < 0 ? 0 : (at + dx + buttons.length) % buttons.length]?.focus();
  }
  turn(dx: number) {
    const i = PAGES.findIndex(p => p.id === this.page);
    this.page = PAGES[(i + dx + PAGES.length) % PAGES.length].id;
    this.draw();
    this.element.querySelector<HTMLElement>('.sv-prof-tabs button.on')?.focus();
  }
  press() { (document.activeElement as HTMLElement | null)?.closest('.sv-profile') && (document.activeElement as HTMLElement).click(); }

  private draw() {
    const p = loadProgress();
    const tabs = PAGES.map(each => `<button type="button" data-act="page" data-page="${each.id}" class="${each.id === this.page ? 'on' : ''}">${each.name}</button>`).join('');
    const body = this.page === 'fighters' ? this.fighters() : this.page === 'unlocks' ? this.unlocks() : this.page === 'challenges' ? this.challenges() : this.bosses();
    this.element.innerHTML = `<div class="sv-prof-card"><header class="sv-prof-head"><div><span class="sv-label">ARCADE SURVIVAL</span><h2>RIFT PROFILE</h2></div>`
      + `<dl><div><dt>SHARDS</dt><dd class="shards">◆ ${GROUPED.format(p.shards)}</dd></div><div><dt>RUNS</dt><dd>${p.runs}</dd></div><div><dt>BEST</dt><dd>${p.best.score ? `ROUND ${p.best.round} · ${GROUPED.format(p.best.score)}` : '—'}</dd></div></dl>`
      + `<button type="button" class="sv-prof-close" data-act="close" aria-label="Close">✕</button></header>`
      + `<nav class="sv-prof-tabs">${tabs}</nav><div class="sv-prof-body ${this.page}">${body}</div>`
      + `<footer class="sv-prof-foot">Every run pays shards: its score, its bosses, its finishers, how far it went. Shards buy new skill-tree nodes.</footer></div>`;
  }

  private fighters() {
    const p = loadProgress();
    const ids = (Object.keys(FIGHTERS) as FighterId[]).filter(isReleasedFighter).sort((a, b) => (a === this.fighter ? -1 : b === this.fighter ? 1 : (p.mastery[b] ?? 0) - (p.mastery[a] ?? 0)));
    return ids.map(id => {
      const m = masteryOf(p.mastery[id]), wear = auraOf(p, id), open = aurasAt(m.level);
      const next = m.max ? 'MASTERED' : `NEXT · ${rewardText(m.level + 1) || `LEVEL ${m.level + 1}`}`;
      const auras = (Object.keys(AURAS) as AuraId[]).map(aura => {
        const has = open.includes(aura);
        return `<button type="button" class="sv-prof-aura${aura === wear ? ' on' : ''}" style="--c:${hex(AURAS[aura].color)}" data-act="aura" data-fighter="${id}" data-aura="${aura}" ${has ? '' : 'disabled'} title="${AURAS[aura].name}${has ? '' : ` · LEVEL ${AURAS[aura].level}`}">${has ? '' : AURAS[aura].level}</button>`;
      }).join('');
      const bonus = startPointsAt(m.level);
      return `<article class="sv-prof-fighter${id === this.fighter ? ' current' : ''}" style="--aura:${hex(AURAS[wear].color)}"><img alt="" loading="lazy" src="${esc(mediaArt(FIGHTERS[id].portrait))}">`
        + `<div><strong>${esc(FIGHTERS[id].name.toUpperCase())}</strong><small class="title">${esc(titleAt(m.level))}</small>`
        + `<span class="lv">LV <b>${m.level}</b>/${MAX_MASTERY}${bonus ? ` · +${bonus} POINT${bonus > 1 ? 'S' : ''} A RUN` : ''}</span><i class="sv-prof-xp"><i style="--to:${(m.max ? 1 : m.into / m.span).toFixed(3)}"></i></i>`
        + `<small class="next">${esc(next)}</small><div class="sv-prof-auras">${auras}</div></div></article>`;
    }).join('');
  }

  private unlocks() {
    const p = loadProgress();
    return UNLOCKS.map(({ node, cost }) => {
      const def = upgrade(node), tree = TREE_NODE.get(node)!, branch = BRANCHES.find(b => b.id === tree.branch)!;
      const owned = p.unlocked.includes(node), short = cost - p.shards;
      const action = owned ? '<span class="owned">UNLOCKED · IN YOUR TREE</span>'
        : short > 0 ? `<button type="button" disabled>◆ ${cost} · ${short} MORE</button>`
        : `<button type="button" class="buy" data-act="buy" data-node="${node}">UNLOCK · ◆ ${cost}</button>`;
      return `<article class="sv-prof-unlock${owned ? ' owned' : ''}"><span class="sv-prof-node"><img alt="" src="/assets/survival/cards/${node}.webp" onerror="this.remove()"><b>${def.kanji}</b></span>`
        + `<div><small>${branch.name} · ${branch.kanji}</small><strong>${esc(def.name.toUpperCase())}</strong><p>${esc(rankText(node, 1))}</p>${action}</div></article>`;
    }).join('');
  }

  private challenges() {
    const p = loadProgress();
    const done = CHALLENGES.filter(c => p.challenges.includes(c.id)).length;
    return `<p class="sv-prof-count">${done} / ${CHALLENGES.length} DONE</p>` + CHALLENGES.map(c => {
      const has = p.challenges.includes(c.id);
      return `<article class="sv-prof-chal${has ? ' done' : ''}"><i>${has ? '✓' : ''}</i><div><strong>${esc(c.name)}</strong><small>${esc(c.line)}</small></div><b>◆ ${c.reward}</b></article>`;
    }).join('');
  }

  private bosses() {
    const p = loadProgress();
    const met = BOSSES.filter(b => p.codex[b.id]).length;
    let html = `<p class="sv-prof-count">${met} / ${BOSSES.length} BEATEN</p>`;
    for (const rank of [...RANKS].reverse()) {
      const of = BOSSES.filter(b => b.rank === rank);
      if (!of.length) continue;
      html += `<section class="sv-prof-rank"><h4>RANK ${rank}</h4><div>` + of.map(b => {
        const c = p.codex[b.id], name = ENEMIES[b.id]?.name ?? b.id;
        return `<figure class="sv-prof-boss${c ? ' beaten' : ''}"><span><img alt="" loading="lazy" src="${bossPortrait(b.id)}"></span>`
          + `<figcaption><strong>${c ? esc(name.toUpperCase()) : '? ? ?'}</strong><small>${c ? `×${c.beaten} BEATEN${c.finished ? ` · ×${c.finished} FINISHED` : ''}${c.fastest ? ` · BEST ${clock(c.fastest)}` : ''}` : esc(b.universe)}</small></figcaption></figure>`;
      }).join('') + `</div></section>`;
    }
    return html;
  }
}
