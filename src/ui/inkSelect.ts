import type { FighterId } from '../game/types';
import type { UiAction } from '../input/gamepad';
import { mangaPortrait } from './MangaHome';
import { nearest, type Direction } from './spatialFocus';
import './inkControls.css';

let uid = 0, current: InkSelect | null = null;
const POPOVER = typeof HTMLElement === 'function' && 'popover' in HTMLElement.prototype;
const PAD: Partial<Record<UiAction, Direction>> = { previous: 'up', next: 'down', left: 'left', right: 'right' };
const PRESSES = ['pointerdown', 'mousedown', 'touchstart'] as const;
const LOCK = '<svg viewBox="0 0 16 16"><path d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z"/></svg>';
const Base = (typeof HTMLElement === 'function' ? HTMLElement : class {}) as typeof HTMLElement;

export class InkSelect extends Base {
  static readonly observedAttributes = ['disabled'];
  private button?: HTMLButtonElement;
  private list?: HTMLElement;
  private index = -1;
  private typed = '';
  private typedAt = 0;
  private closing = false;
  private dismissing = false;
  private sizer?: ResizeObserver;

  connectedCallback() {
    const self = this as unknown as Record<string, unknown>;
    for (const key of ['value', 'disabled', 'selectedIndex']) if (Object.hasOwn(this, key)) { const v = self[key]; delete self[key]; self[key] = v; }
    if (!this.button) this.build();
  }
  disconnectedCallback() { if (current === this) current = null; for (const type of PRESSES) document.removeEventListener(type, this.onOutside, true); removeEventListener('scroll', this.onScroll, true); removeEventListener('resize', this.onResize); }
  attributeChangedCallback() { if (this.button) this.button.disabled = this.disabled; }

  get options() { return [...this.querySelectorAll<HTMLOptionElement>(':scope > option, :scope > optgroup > option')]; }
  get type() { return 'select-one'; }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(on: boolean) { this.toggleAttribute('disabled', !!on); }
  get selectedIndex() { const options = this.options; if (!options.length) return -1; if (this.index < 0 || this.index >= options.length) this.index = Math.max(0, options.findIndex(o => o.hasAttribute('selected'))); return this.index; }
  set selectedIndex(i: number) { if (i >= 0 && i < this.options.length) this.pick(i, false); }
  get value() { return this.options[this.selectedIndex]?.value ?? ''; }
  set value(value: string) { const i = this.options.findIndex(o => o.value === String(value)); if (i >= 0) this.pick(i, false); }
  get open() { return !!this.list?.classList.contains('open'); }
  override focus(options?: FocusOptions) { if (this.button) this.button.focus(options); else super.focus(options); }

  private get faces() { return this.getAttribute('layout') === 'faces'; }
  private get label() { return this.getAttribute('label') ?? this.dataset.label ?? ''; }

  private build() {
    const id = `ink-select-${++uid}`, label = this.getAttribute('label') ?? this.getAttribute('aria-label') ?? '';
    this.dataset.label = label; this.removeAttribute('aria-label');
    const button = this.button = document.createElement('button');
    button.type = 'button'; button.className = 'ink-pick-button'; button.disabled = this.disabled;
    button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', id);
    if (this.dataset.focus) button.dataset.focus = this.dataset.focus;
    const list = this.list = document.createElement('div');
    list.className = 'ink-pick-list'; list.id = id; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', label); list.tabIndex = -1;
    list.dataset.layout = this.faces ? 'faces' : 'list';
    let n = 0;
    const option = (o: HTMLOptionElement) => {
      const cell = document.createElement('div'), face = this.faces;
      cell.className = 'ink-pick-option'; cell.id = `${id}-${n}`; cell.dataset.index = String(n++); cell.tabIndex = -1;
      cell.setAttribute('role', 'option'); cell.setAttribute('aria-selected', 'false'); if (o.disabled) cell.setAttribute('aria-disabled', 'true');
      if (face) { const art = document.createElement('span'); art.className = 'ink-pick-art'; art.innerHTML = o.dataset.face ? mangaPortrait(o.dataset.face as FighterId, true) : '<b aria-hidden="true">?</b>'; cell.append(art);
        if (o.dataset.lock !== undefined) { const lock = document.createElement('i'); lock.className = 'ink-pick-lock'; lock.setAttribute('aria-hidden', 'true'); lock.innerHTML = LOCK; art.append(lock); } }
      const text = document.createElement('span'); text.className = 'ink-pick-text'; text.textContent = (face && o.dataset.short) || o.textContent?.trim() || o.value;
      cell.append(text); if (face) cell.setAttribute('aria-label', o.textContent?.trim() || o.value);
      if (o.dataset.tag && !face) { const tag = document.createElement('small'); tag.className = 'ink-pick-tag'; tag.textContent = o.dataset.tag; cell.append(tag); }
      if (o.dataset.sub && !face) { const sub = document.createElement('small'); sub.className = 'ink-pick-sub'; sub.textContent = o.dataset.sub; cell.classList.add('has-sub'); cell.append(sub); }
      return cell;
    };
    for (const child of [...this.children]) {
      if (child instanceof HTMLOptionElement) list.append(option(child));
      else if (child instanceof HTMLOptGroupElement) {
        const group = document.createElement('div'), head = document.createElement('b');
        group.className = 'ink-pick-group'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', child.label);
        head.className = 'ink-pick-head'; head.setAttribute('aria-hidden', 'true'); head.textContent = child.label;
        group.append(head, ...[...child.querySelectorAll('option')].map(option)); list.append(group);
      }
    }
    if (POPOVER) {
      list.popover = 'auto'; button.popoverTargetElement = list;
      list.addEventListener('beforetoggle', event => this.toggled((event as ToggleEvent).newState === 'open', true));
      list.addEventListener('toggle', event => { if ((event as ToggleEvent).newState === 'open') this.focusOption(this.selectedIndex); });
    }
    if (typeof ResizeObserver === 'function') this.sizer = new ResizeObserver(() => { if (!this.open || !list.offsetHeight) return; this.sizer!.unobserve(list); this.place(); });
    if (!POPOVER) {
      button.addEventListener('click', () => this.open ? this.hide() : this.show());
    }
    if (this.faces) for (const type of ['pointerenter', 'focus']) button.addEventListener(type, () => this.revealFaces(), { once: true });
    button.addEventListener('keydown', event => this.buttonKey(event));
    list.addEventListener('keydown', event => this.listKey(event));
    list.addEventListener('click', event => { event.preventDefault(); const cell = (event.target as Element).closest<HTMLElement>('.ink-pick-option'); if (cell && cell.getAttribute('aria-disabled') !== 'true') this.choose(Number(cell.dataset.index)); });
    list.addEventListener('pointermove', event => { const cell = (event.target as Element).closest<HTMLElement>('.ink-pick-option'); if (cell && document.activeElement !== cell && event.pointerType === 'mouse') cell.focus({ preventScroll: true }); });
    this.append(button, list);
    this.pick(this.selectedIndex, false);
  }

  private pick(i: number, user: boolean) {
    const options = this.options, changed = i !== this.index;
    if (i < 0 || i >= options.length) return;
    this.index = i;
    options.forEach((o, k) => o.toggleAttribute('selected', k === i));
    if (!this.button || !this.list) return;
    const o = options[i], text = (each: HTMLOptionElement) => each.textContent?.trim() || each.value;
    const paint = `${i}|${this.label}|${this.faces}|${options.map(each => `${each.value}\u0001${text(each)}\u0001${each.dataset.face ?? ''}`).join('\u0002')}`;
    if (paint === this.painted) { if (user && changed) this.announce(); return; }
    this.painted = paint;
    this.list.querySelectorAll('.ink-pick-option').forEach((cell, k) => cell.setAttribute('aria-selected', String(k === i)));
    this.button.innerHTML = `${this.faces ? `<span class="ink-pick-art" aria-hidden="true">${o.dataset.face ? mangaPortrait(o.dataset.face as FighterId) : '<b>?</b>'}</span>` : ''}<span class="ink-pick-value"><span class="ink-sr"></span><span class="ink-pick-shown"></span>${options.map(() => '<span class="ink-pick-size" aria-hidden="true"></span>').join('')}</span><i aria-hidden="true"></i>`;
    this.button.querySelector('.ink-sr')!.textContent = this.label ? `${this.label}: ` : '';
    this.button.querySelector('.ink-pick-shown')!.textContent = text(o);
    this.button.querySelectorAll('.ink-pick-size').forEach((each, k) => { each.textContent = text(options[k]); });
    if (user && changed) this.announce();
  }
  private announce() { this.dispatchEvent(new Event('input', { bubbles: true })); this.dispatchEvent(new Event('change', { bubbles: true })); }
  private painted = '';
  private choose(i: number) { this.hide(); this.pick(i, true); }

  show() {
    if (this.disabled || this.open || !this.list) return;
    if (POPOVER) { this.list.showPopover(); return; }
    this.toggled(true, false); this.focusOption(this.selectedIndex);
  }
  hide(refocus = true) {
    if (!this.open || !this.list) return;
    this.closing = true;
    try { if (POPOVER && this.list.matches(':popover-open')) this.list.hidePopover(); else this.toggled(false, false); } finally { this.closing = false; }
    if (refocus) this.button?.focus({ preventScroll: true });
  }
  private revealFaces() {
    for (const image of this.list?.querySelectorAll<SVGImageElement>('image[data-href]') ?? []) { image.setAttribute('href', image.getAttribute('data-href')!); image.removeAttribute('data-href'); }
  }
  private toggled(open: boolean, browser: boolean) {
    const list = this.list!, button = this.button!;
    if (open) {
      this.revealFaces();
      if (current && current !== this) current.hide(false);
      current = this; this.dismissing = false; this.place(); this.sizer?.observe(list); list.classList.add('open'); button.setAttribute('aria-expanded', 'true');
      addEventListener('scroll', this.onScroll, true); addEventListener('resize', this.onResize);
      for (const type of PRESSES) document.addEventListener(type, this.onOutside, true);
    } else {
      if (current === this) current = null;
      list.classList.remove('open'); button.setAttribute('aria-expanded', 'false'); this.sizer?.unobserve(list);
      removeEventListener('scroll', this.onScroll, true); removeEventListener('resize', this.onResize);
      for (const type of PRESSES) document.removeEventListener(type, this.onOutside, true);
      if (browser && !this.closing && this.dismissing) swallowClick();
      this.dismissing = false;
    }
  }
  private readonly onScroll = (event: Event) => { if (!this.list?.contains(event.target as Node)) this.hide(false); };
  private readonly onResize = () => this.hide(false);
  private readonly onOutside = (event: Event) => {
    if (this.contains(event.target as Node)) return;
    event.stopPropagation(); if (event.type !== 'pointerdown') return;
    this.dismissing = true; if (!POPOVER) { this.hide(false); swallowClick(); }
  };

  private place() {
    const list = this.list!, r = this.button!.getBoundingClientRect(), s = list.style, margin = 8, gap = 6;
    const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, room = vh - 2 * margin;
    if (this.faces) { const cols = Math.max(3, Math.min(6, Math.floor((vw - 2 * margin - 26) / 66))); s.setProperty('--ink-cols', String(cols)); }
    const natural = list.offsetHeight ? list.scrollHeight + 6 : 0, width = list.offsetWidth || (this.faces ? 6 * 66 + 26 : Math.max(r.width, 180));
    const below = vh - r.bottom - gap - margin, above = r.top - gap - margin;
    s.minWidth = `${Math.min(r.width, vw - 2 * margin)}px`; s.maxWidth = `${vw - 2 * margin}px`;
    const sheet = natural > Math.max(below, above) && (vw < 700 || vh < 600);
    list.classList.toggle('sheet', sheet);
    if (sheet) {
      s.maxHeight = `${room}px`; s.top = `${Math.max(margin, (vh - Math.min(natural, room)) / 2)}px`; s.bottom = 'auto';
      s.left = `${Math.max(margin, (vw - width) / 2)}px`; s.right = 'auto'; return;
    }
    const up = natural ? natural > below && above > below : below < 260 && above > below;
    s.maxHeight = `${Math.max(Math.min(140, room), up ? above : below)}px`;
    s.top = up ? 'auto' : `${r.bottom + gap}px`; s.bottom = up ? `${vh - r.top + gap}px` : 'auto';
    if (r.left + width > vw - margin) { s.left = 'auto'; s.right = `${Math.max(margin, vw - r.right)}px`; } else { s.left = `${Math.max(margin, r.left)}px`; s.right = 'auto'; }
  }

  private cells() { return [...this.list!.querySelectorAll<HTMLElement>('.ink-pick-option')]; }
  private focusOption(i: number) { this.reveal(this.cells()[Math.max(0, i)]); }
  private reveal(cell: HTMLElement | undefined) {
    const list = this.list; if (!cell || !list) return;
    cell.focus({ preventScroll: true });
    const top = cell.offsetTop - 6, bottom = cell.offsetTop + cell.offsetHeight + 6;
    if (top < list.scrollTop) list.scrollTop = top; else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }
  private activeIndex() { const cell = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>('.ink-pick-option'); return cell && this.list!.contains(cell) ? Number(cell.dataset.index) : this.selectedIndex; }
  private move(direction: Direction) {
    const cells = this.cells().filter(c => c.getAttribute('aria-disabled') !== 'true'), at = this.activeIndex(), from = this.cells()[at];
    if (!from) return;
    if (!this.faces) {
      if (direction === 'left' || direction === 'right') return;
      const k = cells.indexOf(from), next = cells[Math.max(0, Math.min(cells.length - 1, k + (direction === 'down' ? 1 : -1)))];
      this.reveal(next); return;
    }
    const to = nearest(from.getBoundingClientRect(), cells.map(c => c.getBoundingClientRect()), direction);
    if (to >= 0) this.reveal(cells[to]);
  }
  private edge(last: boolean) { const cells = this.cells().filter(c => c.getAttribute('aria-disabled') !== 'true'); this.reveal(last ? cells.at(-1) : cells[0]); }
  private seek(key: string) {
    const now = performance.now(); this.typed = (now - this.typedAt < 700 ? this.typed : '') + key.toLowerCase(); this.typedAt = now;
    const cells = this.cells(), at = this.activeIndex(), order = [...cells.slice(at + 1), ...cells.slice(0, at + 1)];
    const hit = order.find(c => (c.getAttribute('aria-label') ?? c.textContent ?? '').trim().toLowerCase().startsWith(this.typed)) ?? (this.typed.length > 1 ? undefined : order.find(c => (c.textContent ?? '').trim().toLowerCase().startsWith(key.toLowerCase())));
    this.reveal(hit);
  }

  private buttonKey(event: KeyboardEvent) {
    if (this.disabled || this.open) return;
    const k = event.key;
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'F4') { this.show(); }
    else if (k === 'Home' || k === 'End') { const options = this.options; let i = k === 'Home' ? 0 : options.length - 1; while (options[i]?.disabled) i += k === 'Home' ? 1 : -1; this.pick(i, true); }
    else return;
    event.preventDefault(); event.stopPropagation();
  }
  private listKey(event: KeyboardEvent) {
    const k = event.key;
    if (k === 'ArrowDown') this.move('down'); else if (k === 'ArrowUp') this.move('up');
    else if (k === 'ArrowLeft') this.move('left'); else if (k === 'ArrowRight') this.move('right');
    else if (k === 'Home' || k === 'PageUp') this.edge(false); else if (k === 'End' || k === 'PageDown') this.edge(true);
    else if (k === 'Enter' || k === ' ') this.choose(this.activeIndex());
    else if (k === 'Escape') this.hide();
    else if (k === 'Tab') { this.hide(); return; }
    else if (k.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) this.seek(k);
    else return;
    event.preventDefault(); event.stopPropagation();
  }
  controller(action: UiAction): boolean {
    if (!this.open) return false;
    const direction = PAD[action];
    if (direction) this.move(this.faces ? direction : direction === 'left' ? 'up' : direction === 'right' ? 'down' : direction);
    else if (action === 'confirm') this.choose(this.activeIndex());
    else if (action === 'back') this.hide();
    return true;
  }
}

function swallowClick() {
  const until = performance.now() + 450;
  const swallow = (event: Event) => { removeEventListener('click', swallow, true); if (performance.now() < until) { event.stopPropagation(); event.preventDefault(); } };
  addEventListener('click', swallow, true);
  setTimeout(() => removeEventListener('click', swallow, true), 460);
}

export function inkSelectController(action: UiAction) { return current?.isConnected ? current.controller(action) : false; }

if (typeof customElements === 'object' && !customElements.get('ink-select')) customElements.define('ink-select', InkSelect);
