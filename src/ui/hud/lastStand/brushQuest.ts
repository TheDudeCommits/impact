import { el, Text } from '../kit';

let made = 0;
const ZHENG: readonly [number, number, number, number][] = [[14, 22, 54, 22], [34, 22, 34, 74], [34, 48, 50, 48], [16, 44, 16, 74], [8, 74, 60, 74]];
export function tallyStrokes(target: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < Math.min(20, Math.max(0, Math.floor(target))); i++) { const s = ZHENG[i % 5], dx = Math.floor(i / 5) * 64; out.push([s[0] + dx, s[1], s[2] + dx, s[3]]); }
  return out;
}
const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

export interface QuestView {
  key: string; title: string;
  line: string;
  state: 'preview' | 'active' | 'secured' | 'missed';
  ring?: number;
  centre: string;
  tally?: { target: number; done: number };
  reward: string;
  urgent: boolean;
}

export class BrushQuest {
  readonly root: HTMLElement;
  private readonly arc: SVGPathElement; private readonly centre: SVGTextElement;
  private readonly title: SVGTextElement[]; private readonly line: Text; private readonly reward: SVGTextElement;
  private readonly tally: SVGGElement; private readonly stamp: SVGGElement;
  private shown = ''; private tallyKey = '';
  constructor(parent: HTMLElement, className = '') {
    const id = `lsq${made++}`;
    this.root = el('div', `ls-quest ${className}`.trim(), parent);
    this.root.innerHTML = `<svg viewBox="0 0 260 76" overflow="visible"><defs>`
      + `<filter id="${id}a" filterUnits="userSpaceOnUse" x="-10" y="-10" width="290" height="100"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="6"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter>`
      + `<filter id="${id}b" filterUnits="userSpaceOnUse" x="-10" y="-10" width="290" height="100"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></defs>`
      + `<circle cx="38" cy="38" r="33" class="ls-enso-bg"/><path d="${arcPath(38, 38, 27, -82, 276)}" class="ls-enso-track"/>`
      + `<path class="ls-enso" filter="url(#${id}a)"/><text class="ls-clock" x="38" y="44" text-anchor="middle"></text>`
      + `<text class="ls-q-shadow" x="84" y="22"></text><text class="ls-q-title" x="82.5" y="20.5"></text>`
      + `<g class="ls-tally" transform="translate(84 40) scale(.44)" filter="url(#${id}b)"></g>`
      + `<text class="ls-reward" x="252" y="72" text-anchor="end"></text>`
      + `<g class="ls-stamp" transform="translate(216 44) rotate(-8)"><rect x="-26" y="-13" width="52" height="26"/><text y="6" text-anchor="middle"></text></g></svg><small class="ls-q-line"></small>`;
    this.arc = this.root.querySelector('.ls-enso')!; this.centre = this.root.querySelector('.ls-clock')!;
    this.title = [this.root.querySelector('.ls-q-shadow')!, this.root.querySelector('.ls-q-title')!];
    this.line = new Text(this.root.querySelector('.ls-q-line')!); this.reward = this.root.querySelector('.ls-reward')!;
    this.tally = this.root.querySelector('.ls-tally')!; this.stamp = this.root.querySelector('.ls-stamp')!;
  }
  hide() { this.root.hidden = true; this.shown = ''; }
  set(q: QuestView) {
    this.root.hidden = false;
    const ring = q.ring === undefined ? -1 : Math.round(Math.max(0, Math.min(1, q.ring)) * 180) / 180;
    const key = `${q.key}|${q.state}|${ring}|${q.centre}|${q.tally?.done}|${q.urgent}|${q.line}`;
    if (key === this.shown) return;
    this.shown = key;
    this.root.dataset.state = q.state;
    this.root.classList.toggle('urgent', q.urgent);
    if (this.title[1].textContent !== q.title) {
      for (const t of this.title) { t.textContent = q.title; t.removeAttribute('textLength'); t.removeAttribute('lengthAdjust'); }
      const room = 252 - 84, used = this.title[1].getComputedTextLength?.() ?? 0;
      if (used > room) for (const t of this.title) { t.setAttribute('textLength', String(room)); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    }
    if (this.reward.textContent !== q.reward) this.reward.textContent = q.reward;
    this.line.set(q.line);
    this.arc.setAttribute('d', ring < 0 ? '' : ring <= .002 ? '' : arcPath(38, 38, 27, -82, -82 + 358 * ring));
    if (this.centre.textContent !== q.centre) this.centre.textContent = q.centre;
    const tallyKey = q.tally ? `${q.tally.target}` : '';
    if (tallyKey !== this.tallyKey) {
      this.tallyKey = tallyKey;
      this.tally.innerHTML = q.tally ? tallyStrokes(q.tally.target).map(([x0, y0, x1, y1]) => `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`).join('') : '';
    }
    if (q.tally) [...this.tally.children].forEach((s, i) => s.classList.toggle('on', i < q.tally!.done));
    const stamp = q.state === 'secured' ? '達成' : q.state === 'missed' ? '失敗' : '';
    this.stamp.style.display = stamp ? '' : 'none';
    const text = this.stamp.querySelector('text')!; if (text.textContent !== stamp) text.textContent = stamp;
  }
}
