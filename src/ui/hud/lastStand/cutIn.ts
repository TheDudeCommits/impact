import { el } from '../kit';

export interface CutInCard {
  faces?: readonly string[];
  seal: string;
  kanji: string;
  shout: string; sub: string; tag: string; tagLine: string;
  boss?: boolean;
}
const SHOW_MS = 2900;

export class CutIn {
  readonly root: HTMLElement;
  private queue: CutInCard[] = [];
  private until = 0; private on = false;
  constructor(parent: HTMLElement) {
    this.root = el('div', 'ls-cutin', parent);
    this.root.setAttribute('aria-hidden', 'true'); this.root.hidden = true;
  }
  push(card: CutInCard) { if (this.queue.length < 3) this.queue.push(card); }
  tick(now: number) {
    if (this.on && now >= this.until) { this.on = false; this.root.hidden = true; this.root.classList.remove('on'); }
    if (!this.on && this.queue.length) this.show(this.queue.shift()!, now);
  }
  clear() { this.queue = []; this.on = false; this.root.hidden = true; this.root.classList.remove('on'); }

  private show(card: CutInCard, now: number) {
    this.on = true; this.until = now + SHOW_MS;
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    const lines = Array.from({ length: 40 }, (_, i) => { const a = (i * 8.7 + (i * 13) % 7) * Math.PI / 180, r0 = 70 + (i % 4) * 10;
      return `<line x1="${(170 + Math.cos(a) * r0).toFixed(0)}" y1="${(120 + Math.sin(a) * r0).toFixed(0)}" x2="${(170 + Math.cos(a) * 280).toFixed(0)}" y2="${(120 + Math.sin(a) * 280).toFixed(0)}" stroke-width="${1 + i % 3}" stroke-opacity="${(.06 + (i % 3) * .05).toFixed(2)}"/>`; }).join('');
    this.root.className = `ls-cutin${card.boss ? ' boss' : ''}`;
    this.root.innerHTML = `<div class="ls-ci-slab red"></div><div class="ls-ci-slab rim"></div><div class="ls-ci-slab ink"></div><span class="ls-ci-kanji">${esc(card.kanji)}</span>`
      + `<svg class="ls-ci-burst" viewBox="0 0 340 236">${lines}</svg>`
      + `<div class="ls-ci-seal"><b>${esc(card.seal)}</b></div>`
      + (card.faces?.length ? `<div class="ls-ci-facebox"><img class="ls-ci-face" alt="" decoding="async" draggable="false"></div>` : '')
      + `<div class="ls-ci-bubble"><svg class="ls-ci-balloon"><polygon/></svg><div class="ls-ci-words"><b>${esc(card.shout)}</b><small>${esc(card.sub)}</small></div></div>`
      + `<div class="ls-ci-tag"><b>${esc(card.tag)}</b><small>${esc(card.tagLine)}</small></div><div class="ls-ci-life"><i></i></div>`;
    const img = this.root.querySelector<HTMLImageElement>('.ls-ci-face');
    if (img && card.faces) {
      let at = 0;
      img.onerror = () => { at++; if (at < card.faces!.length) img.src = card.faces![at]; else img.parentElement?.remove(); };
      img.onload = () => this.root.classList.add('has-face');
      img.src = card.faces[0];
    }
    this.root.hidden = false;
    this.root.style.scale = String(Math.max(.58, Math.min(1.15, innerHeight / 1080)));
    const words = this.root.querySelector<HTMLElement>('.ls-ci-words')!, w = words.offsetWidth, h = words.offsetHeight, m = 18;
    const bubble = this.root.querySelector<HTMLElement>('.ls-ci-bubble')!; bubble.style.scale = w > 300 ? (300 / w).toFixed(3) : '';
    const svg = this.root.querySelector<SVGSVGElement>('.ls-ci-balloon')!;
    svg.setAttribute('viewBox', `0 0 ${w + 2 * m} ${h + 2 * m}`); svg.style.cssText = `left:${-m}px;top:${-m}px;width:${w + 2 * m}px;height:${h + 2 * m}px`;
    const cx = w / 2 + m, cy = h / 2 + m, ax = w / 2 * 1.14, ay = h / 2 * 1.3, pts: string[] = [];
    for (let i = 0; i < 28; i++) { const t = i / 28 * Math.PI * 2, k = i % 2 ? 1 : 1.1; pts.push(`${(cx + Math.cos(t) * ax * k).toFixed(1)},${(cy + Math.sin(t) * ay * k).toFixed(1)}`); }
    pts.splice(16, 1, `${(cx - ax * .95).toFixed(1)},${(cy + ay * 1.05).toFixed(1)}`, `${(cx - ax * 1.25).toFixed(1)},${(cy + ay * 1.35).toFixed(1)}`, `${(cx - ax * .8).toFixed(1)},${(cy + ay * .95).toFixed(1)}`);
    svg.querySelector('polygon')!.setAttribute('points', pts.join(' '));
    void this.root.offsetWidth;
    this.root.classList.add('on');
  }
}
