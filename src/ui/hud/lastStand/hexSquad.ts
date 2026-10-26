import type { FighterId } from '../../../game/types';
import { el, Flag } from '../kit';
import { pictures } from '../protos/proto';

let made = 0;
const C = 48, R = 44, RI = 36;
const corner = (r: number, i: number): [number, number] => { const t = (-90 + 60 * i) * Math.PI / 180; return [C + r * Math.cos(t), C + 2 + r * Math.sin(t)]; };
const hex = (r: number) => `M${[0, 1, 2, 3, 4, 5].map(i => corner(r, i).map(v => v.toFixed(1)).join(' ')).join('L')}Z`;
const BUST = { cx: 226, cy: 204, crop: 190, size: 512 }, PORTRAIT = { cx: 320, cy: 250, crop: 300, size: 640 };
export const ROAD_KANJI = ['西', '森', '東'] as const;

export interface AllyTile {
  fighter: FighterId;
  share: number;
  down: boolean; reviving: boolean; gone: boolean;
  returning?: number;
  road: string;
  hot: boolean;
}

class Tile {
  readonly root: HTMLElement;
  private readonly image: SVGImageElement; private readonly lit: SVGLineElement[] = [];
  private readonly road: SVGTextElement; private readonly roadBox: SVGRectElement; private readonly badge: SVGGElement;
  private readonly count: SVGTextElement;
  private readonly down: Flag; private readonly reviving: Flag; private readonly gone: Flag; private readonly low: Flag;
  private fighter = ''; private share = -1; private roadText = '\u0000'; private hot: boolean | undefined; private seconds = -1;
  private ends: [number, number, number, number][] = [];
  private readonly grey: string; private greyed: boolean | undefined;
  constructor(parent: HTMLElement) {
    const id = `lsh${made++}`;
    this.grey = `url(#${id}d)`;
    this.root = el('div', 'ls-ally', parent);
    let blades = '';
    for (let i = 0; i < 6; i++) {
      const [x0, y0] = corner(R, i), [x1, y1] = corner(R, i + 1), g = .13;
      const a = [x0 + (x1 - x0) * g, y0 + (y1 - y0) * g, x1 - (x1 - x0) * g, y1 - (y1 - y0) * g] as [number, number, number, number];
      this.ends.push(a);
      blades += `<line x1="${a[0]}" y1="${a[1]}" x2="${a[2]}" y2="${a[3]}" class="ls-blade-track"/>`;
    }
    this.root.innerHTML = `<svg viewBox="0 0 96 106" overflow="visible"><defs><clipPath id="${id}c"><path d="${hex(RI)}"/></clipPath>`
      + `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#0a0c15" stop-opacity="0"/><stop offset="1" stop-color="#0a0c15" stop-opacity=".75"/></linearGradient>`
      + `<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d2547"/><stop offset="1" stop-color="#0a0c18"/></linearGradient>`
      + `<filter id="${id}d"><feColorMatrix type="saturate" values="0"/></filter><filter id="${id}g" filterUnits="userSpaceOnUse" x="-20" y="-20" width="136" height="146"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
      + `<path d="${hex(R + 1)}" transform="translate(4.5 4.5)" fill="#dc143c"/><path d="${hex(R + 1)}" fill="#0a0c15"/>`
      + `<g clip-path="url(#${id}c)"><rect width="96" height="106" fill="url(#${id}b)"/><image class="ls-face" preserveAspectRatio="none"/><rect width="96" height="106" fill="url(#${id}s)"/><rect class="ls-tint" width="96" height="106"/></g>`
      + `<path d="${hex(RI + .5)}" fill="none" stroke="#fff" stroke-width="2.2"/>${blades}<g class="ls-blades" filter="url(#${id}g)"></g>`
      + `<path d="M${corner(R, 5)[0] + 4} ${corner(R, 5)[1] + 6}L${corner(R, 0)[0] - 6} ${corner(R, 0)[1] + 5}" stroke="#fff" stroke-opacity=".7" stroke-width="1.4"/>`
      + `<path class="ls-crack" d="M30 16 L40 36 L34 46 L50 60 L46 78 M60 22 L56 38 L66 50" fill="none"/>`
      + `<g class="ls-plus" transform="translate(70 26)"><circle r="10"/><path d="M-5 -1.5H-1.5V-5H1.5V-1.5H5V1.5H1.5V5H-1.5V1.5H-5Z"/></g>`
      + `<text class="ls-count" x="${C}" y="${C + 9}" text-anchor="middle"></text>`
      + `<g class="ls-road" transform="translate(${C} ${C + 48})"><rect x="-10" y="-10" width="20" height="20" transform="rotate(45)"/><text y="4.2" text-anchor="middle"></text></g></svg>`;
    this.image = this.root.querySelector('image')!;
    const group = this.root.querySelector('.ls-blades')!;
    for (const a of this.ends) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(a[0])); line.setAttribute('y1', String(a[1])); line.setAttribute('x2', String(a[0])); line.setAttribute('y2', String(a[1]));
      group.append(line); this.lit.push(line);
    }
    this.badge = this.root.querySelector('.ls-road')!; this.roadBox = this.badge.querySelector('rect')!; this.road = this.badge.querySelector('text')!;
    this.count = this.root.querySelector('.ls-count')!;
    this.down = new Flag(this.root, 'is-down'); this.reviving = new Flag(this.root, 'is-reviving'); this.gone = new Flag(this.root, 'is-gone'); this.low = new Flag(this.root, 'low');
    this.image.addEventListener('error', () => this.fallback());
  }
  private face(url: string, frame: typeof BUST) {
    const s = 2 * RI * 1.12 / frame.crop;
    this.image.setAttribute('href', url);
    this.image.setAttribute('x', (C - frame.cx * s).toFixed(1)); this.image.setAttribute('y', (C + 5 - frame.cy * s).toFixed(1));
    this.image.setAttribute('width', (frame.size * s).toFixed(1)); this.image.setAttribute('height', (frame.size * s).toFixed(1));
  }
  private fallback() {
    const list = pictures(this.fighter as FighterId, false), at = list.indexOf(this.image.getAttribute('href') ?? '');
    const next = list[at + 1];
    if (next) this.face(next, next.includes('/portraits/') ? PORTRAIT : BUST);
  }
  set(a: AllyTile) {
    if (a.fighter !== this.fighter) { this.fighter = a.fighter; const url = pictures(a.fighter, false)[0]; this.face(url, url.includes('/portraits/') ? PORTRAIT : BUST); this.root.title = a.fighter; }
    this.down.set(a.down && !a.reviving); this.reviving.set(a.reviving); this.gone.set(a.gone);
    if (a.down !== this.greyed) { this.greyed = a.down; if (a.down) this.image.setAttribute('filter', this.grey); else this.image.removeAttribute('filter'); }
    const share = Math.round(Math.max(0, Math.min(1, a.share)) * 120) / 120;
    if (share !== this.share) {
      this.share = share; const lit = share * 6;
      this.lit.forEach((line, i) => { const f = Math.max(0, Math.min(1, lit - i)), e = this.ends[i];
        line.setAttribute('x2', (e[0] + (e[2] - e[0]) * f).toFixed(1)); line.setAttribute('y2', (e[1] + (e[3] - e[1]) * f).toFixed(1)); line.style.display = f > 0 ? '' : 'none'; });
    }
    this.low.set(!a.down && !a.reviving && share < .34);
    if (a.road !== this.roadText) { this.roadText = a.road; this.road.textContent = a.road; this.badge.style.display = a.road ? '' : 'none'; }
    if (a.hot !== this.hot) { this.hot = a.hot; this.roadBox.classList.toggle('hot', a.hot); }
    const count = a.returning !== undefined ? Math.max(1, Math.ceil(a.returning)) : a.gone ? -2 : -1;
    if (count !== this.seconds) { this.seconds = count; this.count.textContent = count === -2 ? '…' : count < 0 ? '' : String(count); }
  }
}

export class HexSquad {
  readonly root: HTMLElement;
  private tiles: Tile[] = [];
  constructor(parent: HTMLElement) { this.root = el('div', 'ls-squad', parent); }
  roster(count: number) {
    if (count === this.tiles.length) return;
    this.root.replaceChildren(); this.tiles = [];
    for (let i = 0; i < count; i++) this.tiles.push(new Tile(this.root));
  }
  set(i: number, a: AllyTile) { this.tiles[i]?.set(a); }
}
