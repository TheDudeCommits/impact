import { el } from '../kit';

let made = 0;
const PIL = { w: '47 63 67 63 69 204 45 204', e: '173 63 193 63 195 204 171 204' };
const KAS = 'M0 22 Q120 40 240 22 L234 42 Q120 56 6 42 Z', CAP = 'M0 22 Q120 40 240 22 L239 28 Q120 46 1 28 Z';
const SHIM = 'M20 52 H220 V63 H20 Z', PLQ = 'M102 63 H138 V100 H102 Z', NUKI = 'M10 104 H230 V117 H10 Z';
const BASE = 'M41 196 H73 V212 H41 Z M167 196 H199 V212 H167 Z';
const LEAF = 'M0 -12 C -9 -6, -9 6, 0 12 C 9 6, 9 -6, 0 -12 Z';
const poly = (p: string) => `M${p.replace(/(\S+) (\S+)/g, '$1 $2 L').replace(/ L$/, '')}Z`;
const ALL = [KAS, SHIM, PLQ, NUKI, poly(PIL.w), poly(PIL.e), BASE].join(' ');
const TOP = 60, PILLAR = 147, HALF = 124, NUKI_HALF = 112;

function parts(id: string, pal: 'v' | 'g') {
  const leaf = pal === 'v' ? '#ffd76a' : '#8d8d8d';
  return `<path d="${KAS}" fill="url(#${id}${pal}b)"/><path d="${CAP}" fill="${pal === 'v' ? '#17141c' : '#2b2b30'}"/><path d="${SHIM}" fill="url(#${id}${pal}b)"/>`
    + `<path d="${PLQ}" fill="#14121a"/><rect x="105" y="66" width="30" height="31" fill="none" stroke="${leaf}" stroke-width="1.8"/>`
    + `<g transform="translate(120 82) rotate(-25)"><path d="${LEAF}" fill="${leaf}" stroke="#0a0c15" stroke-width="1"/><path d="M0 -10V10" stroke="#0a0c15"/></g>`;
}
function grad(id: string, pal: 'v' | 'g') {
  const [hi, mid, lo, dark] = pal === 'v' ? ['#ff8a62', '#e3412a', '#b02e1c', '#9c2617'] : ['#c9c9c9', '#9a9a9a', '#6f6f6f', '#5e5e5e'];
  return `<linearGradient id="${id}${pal}p" x1="0" x2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".14" stop-color="${mid}"/><stop offset=".6" stop-color="${mid}"/><stop offset=".61" stop-color="${lo}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`
    + `<linearGradient id="${id}${pal}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal === 'v' ? '#ff6a46' : '#b5b5b5'}"/><stop offset=".55" stop-color="${mid}"/><stop offset=".56" stop-color="${lo}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`;
}

export class ToriiGauge {
  readonly root: HTMLElement;
  private readonly west: SVGRectElement; private readonly east: SVGRectElement;
  private readonly gateL: SVGRectElement; private readonly gateR: SVGRectElement;
  private readonly nukiL: SVGRectElement; private readonly nukiR: SVGRectElement;
  private shown = [-1, -1, -1];
  constructor(parent: HTMLElement) {
    const id = `lst${made++}`;
    this.root = el('div', 'ls-torii', parent);
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `<svg viewBox="-8 0 260 226" overflow="visible"><defs>${grad(id, 'v')}${grad(id, 'g')}`
      + `<clipPath id="${id}cw"><rect data-c="w" x="38" y="${TOP}" width="38" height="0"/></clipPath><clipPath id="${id}ce"><rect data-c="e" x="164" y="${TOP}" width="38" height="0"/></clipPath>`
      + `<clipPath id="${id}cg"><rect data-c="gl" x="-8" y="8" width="0" height="64"/><rect data-c="gr" x="248" y="8" width="0" height="64"/></clipPath>`
      + `<clipPath id="${id}cn"><rect data-c="nl" x="8" y="100" width="0" height="20"/><rect data-c="nr" x="232" y="100" width="0" height="20"/></clipPath></defs>`
      + `<path d="${ALL}" transform="translate(6 6)" fill="#0a0c15" fill-opacity=".85"/><path d="${ALL}" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>`
      + parts(id, 'v') + `<path d="${NUKI}" fill="url(#${id}vb)"/><polygon points="${PIL.w}" fill="url(#${id}vp)"/><polygon points="${PIL.e}" fill="url(#${id}vp)"/>`
      + `<g clip-path="url(#${id}cg)">${parts(id, 'g')}</g><path d="${NUKI}" fill="url(#${id}gb)" clip-path="url(#${id}cn)"/>`
      + `<polygon points="${PIL.w}" fill="url(#${id}gp)" clip-path="url(#${id}cw)"/><polygon points="${PIL.e}" fill="url(#${id}gp)" clip-path="url(#${id}ce)"/>`
      + `<path d="${KAS} ${SHIM} ${NUKI} ${PLQ}" fill="none" stroke="#0a0c15" stroke-width="3" stroke-linejoin="round"/><polygon points="${PIL.w}" fill="none" stroke="#0a0c15" stroke-width="3"/>`
      + `<polygon points="${PIL.e}" fill="none" stroke="#0a0c15" stroke-width="3"/><path d="${BASE}" fill="#14121a" stroke="#0a0c15" stroke-width="2.5"/></svg>`;
    const r = (k: string) => this.root.querySelector<SVGRectElement>(`[data-c="${k}"]`)!;
    this.west = r('w'); this.east = r('e'); this.gateL = r('gl'); this.gateR = r('gr'); this.nukiL = r('nl'); this.nukiR = r('nr');
  }
  set(west: number, gate: number, east: number) {
    const q = (v: number) => Math.round(Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1)) * 200) / 200;
    const [w, g, e] = [q(west), q(gate), q(east)];
    if (w !== this.shown[0]) { this.shown[0] = w; this.west.setAttribute('height', (PILLAR * (1 - w)).toFixed(1)); this.nukiL.setAttribute('width', (NUKI_HALF * (1 - w)).toFixed(1)); }
    if (e !== this.shown[2]) { this.shown[2] = e; this.east.setAttribute('height', (PILLAR * (1 - e)).toFixed(1)); const n = NUKI_HALF * (1 - e); this.nukiR.setAttribute('x', (232 - n).toFixed(1)); this.nukiR.setAttribute('width', n.toFixed(1)); }
    if (g !== this.shown[1]) { this.shown[1] = g; const lost = HALF * (1 - g), span = lost > 0 ? (lost + 8).toFixed(1) : '0'; this.gateL.setAttribute('width', span); this.gateR.setAttribute('x', (240 - lost).toFixed(1)); this.gateR.setAttribute('width', span); }
  }
}
