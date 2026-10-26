import { el } from '../kit';

let made = 0;
const SVG = 'http://www.w3.org/2000/svg';
export const star4 = (cx: number, cy: number, r: number, w: number) => {
  const p = (a: number, d: number) => [cx + d * Math.cos(a * Math.PI / 180), cy + d * Math.sin(a * Math.PI / 180)].map(v => v.toFixed(1)).join(' ');
  return `M${p(-90, r)}` + [-90, 0, 90, 180].map(a => `Q${p(a + 45, w)} ${p(a + 90, r)}`).join('') + 'Z';
};
const AT = { x: 152, y: 268 }, R = 33, PIPS = 46;

export class LevelStar {
  private host: SVGSVGElement | null = null; private g: SVGGElement | null = null; private loose: HTMLElement | null = null;
  private fill: SVGRectElement | null = null; private nums: SVGTextElement[] = []; private pips: SVGPathElement[] = [];
  private level = -1; private xp = -1; private lit = -1; private flash = '';
  constructor(private readonly combat: HTMLElement, private readonly zone: HTMLElement) {}

  private build(parent: SVGElement, x: number, y: number) {
    const id = `lsv${made++}`, s = star4(0, 0, R, R * .32);
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('class', 'ls-lvstar'); g.setAttribute('transform', `translate(${x} ${y})`);
    g.innerHTML = `<defs><clipPath id="${id}c"><path d="${s}"/></clipPath>`
      + `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset=".45" stop-color="#ffd76a"/><stop offset="1" stop-color="#b8861c"/></linearGradient>`
      + `<linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2240"/><stop offset="1" stop-color="#07080f"/></linearGradient>`
      + `<filter id="${id}f" filterUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="130"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
      + `<path d="${s}" transform="translate(3 3)" fill="#dc143c"/><path d="${s}" fill="url(#${id}i)"/>`
      + `<g clip-path="url(#${id}c)"><rect class="ls-lv-fill" x="-40" y="${R}" width="80" height="80" fill="url(#${id}g)"/></g>`
      + `<path d="${s}" fill="none" stroke="#fff" stroke-width="1.9" stroke-linejoin="round" filter="url(#${id}f)"/>`
      + `<text class="ls-lv-cap" y="-10" text-anchor="middle">LV</text>`
      + `<text class="ls-lv-num ls-lv-shade" x="1.6" y="10" text-anchor="middle"></text><text class="ls-lv-num" y="8.4" text-anchor="middle"></text>`
      + [0, 1, 2, 3].map(i => `<path class="ls-pip" d="${star4(-28 + i * 14, PIPS + Math.abs(i - 1.5) * -1, 6, 1.6)}"/>`).join('')
      + `<g transform="translate(28 ${PIPS - 1.5})"><rect class="ls-heal" x="-5.5" y="-5.5" width="11" height="11" transform="rotate(45)"/><path d="M-3.6 -1.1H-1.1V-3.6H1.1V-1.1H3.6V1.1H1.1V3.6H-1.1V1.1H-3.6Z" fill="#fff"/></g>`;
    parent.append(g);
    this.g = g; this.fill = g.querySelector('.ls-lv-fill'); this.nums = [...g.querySelectorAll<SVGTextElement>('.ls-lv-num')]; this.pips = [...g.querySelectorAll<SVGPathElement>('.ls-pip')];
    this.level = this.xp = this.lit = -1; this.flash = '';
  }

  private place() {
    const x = this.combat.querySelector<SVGSVGElement>('.hd-halo.hd-own svg.hl-x');
    if (x && (x !== this.host || !this.g?.isConnected)) { this.drop(); this.host = x; this.build(x, AT.x, AT.y); }
    else if (!x && !this.loose) {
      this.drop();
      this.loose = el('div', 'ls-lvstar-loose', this.zone);
      const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('viewBox', '-40 -40 80 96'); svg.setAttribute('overflow', 'visible');
      this.loose.append(svg); this.build(svg, 0, 0);
    }
  }
  private drop() { this.g?.remove(); this.loose?.remove(); this.g = null; this.loose = null; this.host = null; }

  set(level: number, xp: number, flash: '' | 'up' | 'heal') {
    this.place();
    if (!this.g) return;
    this.g.style.display = '';
    if (level !== this.level) { this.level = level; for (const n of this.nums) n.textContent = String(level); }
    const share = Math.round(Math.max(0, Math.min(1, xp)) * 100) / 100;
    if (share !== this.xp) { this.xp = share; this.fill!.setAttribute('y', (R - 2 * R * share).toFixed(1)); }
    const lit = level % 5;
    if (lit !== this.lit) { this.lit = lit; this.pips.forEach((p, i) => p.classList.toggle('on', i < lit)); }
    if (flash !== this.flash) { this.flash = flash; this.g.classList.toggle('up', flash === 'up'); this.g.classList.toggle('heal', flash === 'heal'); }
  }
  hide() { if (this.g) this.g.style.display = 'none'; }
  remove() { this.drop(); }
}
