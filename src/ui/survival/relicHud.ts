import { bossPortrait } from './bossArt';
import * as THREE from 'three';
import { RELIC_SLOTS, relicOf, type RelicDefinition } from '../../survival/relics';
import { ENEMIES } from '../../survival/enemies';
import type { FeedItem, RunView } from '../../survival/SurvivalGame';
import { onScreen } from '../../render/cosmetics/index';

export const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const relicBoss = (id: string) => (ENEMIES[id]?.name ?? id).toUpperCase();
export const relicArt = (id: string) => bossPortrait(id);
export function relicSeal(relic: RelicDefinition | undefined, extra = '') {
  const seal = document.createElement('span');
  seal.className = `sv-seal${extra ? ` ${extra}` : ''}`;
  const kanji = document.createElement('b');
  if (relic) { kanji.textContent = relic.kanji; seal.dataset.n = String([...relic.kanji].length); }
  seal.append(kanji);
  return seal;
}

const HOLD_MS = 950, FLY_MS = 560;
const CARD_MS = 4600, MAX_WAIT_MS = 6000;

export class RelicHud {
  private readonly slots: HTMLElement;
  private readonly card: HTMLElement;
  private key = '';
  private readonly arriving = new Set<string>();
  private reveals: FeedItem[] = [];
  private cardTimer = 0;
  private readonly timers = new Set<number>();

  constructor(private readonly root: HTMLElement) {
    this.slots = document.createElement('div');
    this.slots.className = 'sv-relics hidden'; this.slots.id = 'sv-relics'; this.slots.setAttribute('aria-label', 'Relics');
    this.card = document.createElement('div');
    this.card.className = 'sv-relic-card hidden'; this.card.id = 'sv-relic-card'; this.card.setAttribute('role', 'status'); this.card.setAttribute('aria-live', 'polite');
    const level = root.querySelector('.sv-level');
    if (level) level.after(this.slots); else root.append(this.slots);
    root.append(this.card);
  }

  reset() {
    this.key = ''; this.arriving.clear(); this.reveals = []; this.busyUntil = 0; this.dueAt.clear();
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear(); window.clearTimeout(this.cardTimer);
    this.slots.replaceChildren(); this.slots.classList.add('hidden');
    this.card.classList.add('hidden'); this.card.classList.remove('show');
    this.root.classList.remove('has-relics');
    this.root.querySelectorAll('.sv-relic-drop').forEach(drop => drop.remove());
  }

  feed(item: FeedItem, self?: string) {
    if (item.hero && self && item.hero !== self) return;
    if (item.kind === 'relic' && (item.sub === 'taken' || item.sub === 'waiting')) {
      if (item.sub === 'taken' && item.text) this.arriving.add(item.text);
      this.reveals.push(item);
      return;
    }
    if (item.hero && item.text && relicOf(item.text) && item.sub !== 'left') this.fired(item.text);
  }

  update(view: RunView, clear = true) {
    this.drawSlots(view.relics ?? [], view.relicCharge ?? []);
    const now = performance.now();
    for (let i = 0; i < this.reveals.length && !this.busy; i++) {
      const item = this.reveals[i];
      if (view.time < (item.value ?? item.at) && view.phase !== 'draft') continue;
      this.dueAt.set(item.id, this.dueAt.get(item.id) ?? now);
      if (!clear && now - this.dueAt.get(item.id)! < MAX_WAIT_MS && view.phase !== 'draft') continue;
      this.reveals.splice(i, 1); this.dueAt.delete(item.id);
      this.reveal(item, view);
      break;
    }
  }
  get busy() { return performance.now() < this.busyUntil; }
  private busyUntil = 0;
  private readonly dueAt = new Map<number, number>();

  private drawSlots(ids: readonly string[], charge: readonly number[]) {
    const shown = ids.length > 0;
    this.slots.classList.toggle('hidden', !shown);
    this.root.classList.toggle('has-relics', shown);
    const key = ids.map(id => this.arriving.has(id) ? `(${id})` : id).join(',');
    if (key !== this.key) {
      this.key = key;
      this.slots.replaceChildren();
      for (let i = 0; i < RELIC_SLOTS; i++) {
        const id = ids[i], relic = id && !this.arriving.has(id) ? relicOf(id) : undefined;
        const slot = document.createElement('div');
        slot.className = `sv-relic${relic ? '' : ' empty'}`;
        if (id) slot.dataset.id = id;
        const name = document.createElement('small');
        name.textContent = relic ? plain(relic.name) : 'RELIC';
        if (relic) slot.title = `${relic.name} · ${relic.text}`;
        slot.append(relicSeal(relic), name);
        this.slots.append(slot);
      }
    }
    this.slots.querySelectorAll<HTMLElement>('.sv-relic[data-id]').forEach(slot => {
      const at = ids.indexOf(slot.dataset.id ?? ''), value = at >= 0 ? charge[at] ?? 1 : 1;
      const was = Number(slot.style.getPropertyValue('--charge') || 1);
      if (Math.abs(was - value) > .004) slot.style.setProperty('--charge', value.toFixed(3));
      slot.classList.toggle('spent', value < .995);
    });
  }

  private fired(id: string) {
    const slot = this.slots.querySelector<HTMLElement>(`.sv-relic[data-id="${CSS.escape(id)}"]`);
    if (!slot || slot.classList.contains('empty')) return;
    slot.classList.remove('fired'); void slot.offsetWidth; slot.classList.add('fired');
  }

  private reveal(item: FeedItem, view: RunView) {
    const relic = relicOf(item.text);
    if (!relic) return;
    const taken = item.sub === 'taken';
    if (taken) this.showCard(relic, item.enemy ? `IN PLACE OF ${plain(relicOf(item.enemy)?.name ?? '')}` : undefined);
    if (!taken && view.phase === 'draft') return;
    if (item.x === undefined || item.z === undefined) { this.land(relic.id); return; }
    this.busyUntil = performance.now() + HOLD_MS + (taken ? FLY_MS : 400);
    const box = this.root.getBoundingClientRect();
    const at = onScreen(new THREE.Vector3(item.x, (item.y ?? 0) + 1.6, item.z));
    const x = at ? Math.max(90, Math.min(box.width - 90, at.x - box.left)) : box.width / 2, y = at ? Math.max(90, Math.min(box.height - 160, at.y - box.top)) : box.height * .42;
    const drop = document.createElement('div');
    drop.className = 'sv-relic-drop';
    drop.append(relicSeal(relic), Object.assign(document.createElement('i'), { className: 'sv-relic-splash' }));
    const name = document.createElement('small'); name.textContent = plain(relic.name); drop.append(name);
    this.root.append(drop);
    const size = drop.getBoundingClientRect(), x0 = x - size.width / 2, y0 = y - size.height / 2;
    drop.style.transform = `translate(${x0}px, ${y0}px)`;
    drop.classList.add('stamp');
    this.later(() => {
      if (!taken) { drop.classList.add('gone'); this.later(() => drop.remove(), 400); return; }
      const index = Math.max(0, (view.relics ?? []).indexOf(relic.id));
      const target = this.slots.children[index]?.querySelector('.sv-seal')?.getBoundingClientRect();
      const seal = drop.querySelector('.sv-seal')!.getBoundingClientRect();
      if (!target?.width || !seal.width) { this.land(relic.id); drop.remove(); return; }
      const ox = seal.left - box.left - x0 + seal.width / 2, oy = seal.top - box.top - y0 + seal.height / 2;
      const tx = target.left - box.left + target.width / 2 - ox, ty = target.top - box.top + target.height / 2 - oy;
      drop.classList.add('flying');
      drop.style.transformOrigin = `${ox}px ${oy}px`;
      drop.style.transition = `transform ${FLY_MS}ms cubic-bezier(.55,0,.25,1)`;
      drop.style.transform = `translate(${tx}px, ${ty}px) scale(${target.width / seal.width})`;
      this.later(() => { drop.remove(); this.land(relic.id); }, FLY_MS);
    }, HOLD_MS);
  }

  private land(id: string) {
    this.arriving.delete(id);
    this.key = '';
    this.later(() => {
      const slot = this.slots.querySelector<HTMLElement>(`.sv-relic[data-id="${CSS.escape(id)}"]`);
      if (slot) { slot.classList.remove('fresh'); void slot.offsetWidth; slot.classList.add('fresh'); }
    }, 40);
  }

  private showCard(relic: RelicDefinition, note?: string) {
    const card = this.card;
    card.replaceChildren();
    const art = document.createElement('span'); art.className = 'sv-relic-card-art';
    const img = document.createElement('img'); img.alt = ''; img.draggable = false; img.src = relicArt(relic.id);
    img.onerror = () => img.remove();
    art.append(img);
    const text = document.createElement('div');
    const kicker = document.createElement('em'); kicker.textContent = `RELIC · ${relicBoss(relic.id)}${note ? ` · ${note}` : ''}`;
    const name = document.createElement('strong'); name.textContent = plain(relic.name);
    const what = document.createElement('p'); what.textContent = relic.text;
    text.append(kicker, name, what);
    card.append(art, relicSeal(relic), text);
    card.classList.remove('hidden', 'show'); void card.offsetWidth; card.classList.add('show');
    window.clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => { card.classList.add('hidden'); card.classList.remove('show'); }, CARD_MS);
  }

  private later(run: () => void, ms: number) {
    const timer = window.setTimeout(() => { this.timers.delete(timer); run(); }, ms);
    this.timers.add(timer);
  }
}
