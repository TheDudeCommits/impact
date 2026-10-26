import type { Hud } from '../Hud';
import { MODES, type ModeId, type VariantId } from '../modes/catalogue';
import { arcadeFrame } from './arcadeFrame';
import { MISSING_BUSTS, bustPicture } from './ResultsFrame';
import type { FighterId } from '../../game/types';
import { attributeChanged } from '../panelFlags';

export class ResultsShell {
  private pay = '';
  private payAt = 0;
  private copying = 0;
  private openedAt = -Infinity;
  private open = false;
  started: () => { mode: ModeId; variant: VariantId } | undefined = () => undefined;
  openSheet: (mode: ModeId) => void = () => {};

  constructor(private readonly root: HTMLElement, private readonly hud: Hud) {
    root.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLElement>('[data-results]');
      if (!b || !b.closest('.results-frame, #sv-results')) return;
      const mode = hud.modes.layout;
      if (b.dataset.results === 'change') { hud.onLeave(); if (mode) queueMicrotask(() => this.openSheet(mode)); }
      else if (b.dataset.results === 'training') hud.onPractice();
    });
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement && node.classList.contains('shop-toast')) this.watchToast(node);
    }).observe(root, { childList: true });
    const cards = new MutationObserver(records => { if (records.some(record => record.type !== 'attributes' || attributeChanged(record))) this.fill(); });
    for (const holder of root.querySelectorAll('#results, .objective-scrim, #sv-results')) cards.observe(holder, { childList: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    const arcade = root.querySelector<HTMLElement>('#sv-results'), spread = arcade?.querySelector<HTMLElement>('.sv-results-card');
    if (arcade && spread) {
      const redraw = () => this.arcade(arcade, spread);
      new MutationObserver(redraw).observe(arcade, { attributes: true, attributeFilter: ['class'] });
      new MutationObserver(redraw).observe(spread, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
      arcade.addEventListener('click', event => {
        const b = (event.target as HTMLElement).closest<HTMLElement>('[data-sv-press]');
        if (b && !(b as HTMLButtonElement).disabled) root.querySelector<HTMLElement>(b.dataset.svPress!)?.click();
      });
    }
    const guard = (event: KeyboardEvent) => {
      if ((event.code === 'Enter' && event.type === 'keydown') || (event.code === 'Space' && event.type === 'keyup')) {
        if (this.justOpened() && (event.target as HTMLElement)?.closest?.('.results-frame, #sv-results')) { event.preventDefault(); event.stopImmediatePropagation(); }
      }
    };
    window.addEventListener('keydown', guard, true); window.addEventListener('keyup', guard, true);
    window.addEventListener('keydown', event => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || hud.settingsOpen || document.querySelector('dialog[open]')) return;
      const card = this.openCard();
      if (!card) return;
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (event.code === 'Escape' && this.closeFold()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const key = /^Key([CT])$/.exec(event.code)?.[1]?.toLowerCase();
      const b = key && !typing ? card.querySelector<HTMLButtonElement>(`.results-actions [data-key="${key}"]`) : undefined;
      if (!b || b.disabled) return;
      event.preventDefault(); event.stopImmediatePropagation(); b.click();
    }, true);
    root.addEventListener('error', event => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.resultsBust) return;
      const src = img.getAttribute('src') ?? '';
      MISSING_BUSTS.add(src);
      const next = bustPicture(img.dataset.resultsBust as FighterId);
      if (next && next !== src) { img.toggleAttribute('data-fallback', next.includes('/assets/home/portraits/')); img.src = next; }
    }, true);
  }
  private openCard() { return [...this.root.querySelectorAll<HTMLElement>('#results:not(.hidden) .results-frame, .objective-scrim:not(.hidden) .results-frame, #sv-results:not(.hidden) .results-frame')].find(card => card.getClientRects().length > 0); }
  private closeFold() {
    const fold = this.openCard()?.querySelector<HTMLDetailsElement>('details[open]');
    if (!fold) return false;
    fold.open = false; fold.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    return true;
  }
  private arcadeKey = '';
  private arcadeOpen = false;
  private arcade(panel: HTMLElement, spread: HTMLElement) {
    const open = !panel.classList.contains('hidden');
    if (!open) { this.arcadeOpen = false; this.arcadeKey = ''; return; }
    const fighter = this.hud.modes.frame?.self.fighter ?? this.hud.selected;
    const markup = arcadeFrame(panel, fighter);
    if (markup === this.arcadeKey) return;
    this.arcadeKey = markup;
    let host = panel.querySelector<HTMLElement>(':scope > .ux-sv-frame');
    if (!host) { host = document.createElement('div'); host.className = 'ux-sv-frame'; panel.prepend(host); }
    const expanded = host.querySelector<HTMLDetailsElement>('details')?.open ?? false;
    host.innerHTML = markup;
    if (expanded) host.querySelector('details')?.setAttribute('open', '');
    panel.classList.add('ux-framed');
    const pay = spread.querySelector<HTMLElement>('#sv-results-pay');
    const slot = host.querySelector<HTMLElement>('[data-results-rewards]');
    if (slot && pay && !pay.classList.contains('hidden') && pay.innerHTML.trim()) slot.innerHTML = pay.innerHTML;
    if (!this.arcadeOpen) {
      this.arcadeOpen = true;
      const again = host.querySelector<HTMLButtonElement>('.results-again');
      window.setTimeout(() => (again && !again.disabled ? again : host!.querySelector<HTMLElement>('[data-sv-press="#sv-leave"]'))?.focus({ preventScroll: true }), 450);
    }
    this.fill();
  }
  justOpened(ms = 1000) { return performance.now() - this.openedAt < ms; }
  swallow(action: string) { return (action === 'confirm' && this.visibleCard() && this.justOpened()) || (action === 'back' && this.closeFold()); }
  private visibleCard() { return !!this.root.querySelector('#results:not(.hidden) .results-frame, .objective-scrim:not(.hidden) .results-frame, #sv-results:not(.hidden)'); }
  reset() { this.pay = ''; this.payAt = 0; }

  private watchToast(toast: HTMLElement) {
    window.clearInterval(this.copying);
    const copy = () => { if (!toast.isConnected) { window.clearInterval(this.copying); return; } if (toast.innerHTML.trim()) { this.pay = toast.innerHTML; this.payAt = performance.now(); this.fill(); } };
    copy(); this.copying = window.setInterval(copy, 400);
  }
  private fill() {
    const open = this.visibleCard(), was = this.open;
    if (open && !this.open) this.openedAt = performance.now();
    this.open = open;
    const pay = this.hud.modes.layout === 'duel' ? this.pay.replace(/Placed 2 of 2/g, 'Lost the duel') : this.pay;
    for (const card of this.root.querySelectorAll<HTMLElement>('.results-frame')) {
      if (!card.dataset.drawn) { card.dataset.drawn = ''; if (was && open && !this.justOpened(600)) card.classList.add('is-settled'); }
      const slot = card.querySelector<HTMLElement>('[data-results-rewards]');
      if (slot && pay && slot.innerHTML !== pay) slot.innerHTML = pay;
      const started = this.started(), mast = card.querySelector<HTMLElement>('.results-masthead span'), layout = this.hud.modes.layout;
      if (mast && started && started.mode === layout) {
        const text = `${MODES[started.mode].name} · ${MODES[started.mode].variants[started.variant]?.label ?? ''}`;
        if (mast.textContent !== text) mast.textContent = text;
      }
    }
  }
}
