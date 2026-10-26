import { LETTERBOX } from '../render/FinisherCuts';

export class Letterbox {
  private readonly top: HTMLDivElement;
  private readonly bottom: HTMLDivElement;
  private shown = -1;
  constructor(parent: HTMLElement) {
    const bar = (edge: 'top' | 'bottom') => {
      const el = document.createElement('div');
      el.className = `cine-bar cine-bar-${edge}`;
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, { position: 'fixed', left: '0', right: '0', [edge]: '0', height: `${(LETTERBOX * 100).toFixed(2)}vh`, zIndex: '0', pointerEvents: 'none',
        background: '#08070a', transformOrigin: edge === 'top' ? '50% 0' : '50% 100%', transform: 'scaleY(0)', willChange: 'transform', display: 'none' });
      parent.prepend(el);
      return el;
    };
    this.bottom = bar('bottom'); this.top = bar('top');
  }
  set(amount: number) {
    const a = Math.round(Math.max(0, Math.min(1, amount)) * 1000) / 1000;
    if (a === this.shown) return;
    this.shown = a;
    for (const el of [this.top, this.bottom]) { el.style.transform = `scaleY(${a})`; el.style.display = a > 0 ? 'block' : 'none'; }
  }
}
