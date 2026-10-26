import { FIGHTERS } from '../config';
import { mediaArt } from './mediaArt';
import type { FighterId } from '../game/types';
import { HOME_ROSTER, fighterArt, mangaPortrait } from './MangaHome';
import { brushStroke, inkSplats } from './inkSplat';
import './vsSplash.css';

export type VsSide = { fighter: FighterId; name: string; tag?: string };
export type VsPlay = { left: VsSide; rights: VsSide[]; stage?: string; seconds?: number };
export type VsBeat = 'panels' | 'stamp' | 'cut' | 'fight' | 'fight-slam';
export const VS_BEATS = { panels: 0, stamp: .4, fight: 0, fightSlam: .26 } as const;

export const VS_IN = .62, VS_OUT = .36, VS_WHOLE = 2.45, VS_HOLD_MIN = .3;
export const FIGHT_SECONDS = .92;
const DECODE_WAIT = 320;
const SKIP_FADE = 150;

const SEAMS = {
  duel: { wide: [.58, 0, .42, 1], tall: [0, .56, 1, .44] },
  crowd: { wide: [.47, 0, .33, 1], tall: [0, .38, 1, .3] },
} as const;

export function vsLayout(rivals: number, width: number, height: number) {
  const tall = height > width * 1.05, crowd = rivals > 1, [ax, ay, bx, by] = SEAMS[crowd ? 'crowd' : 'duel'][tall ? 'tall' : 'wide'];
  const x0 = ax * width, y0 = ay * height, x1 = bx * width, y1 = by * height;
  const cols = !crowd ? 1 : rivals <= 3 ? rivals : rivals === 4 ? 2 : rivals <= 6 ? 3 : tall && rivals === 9 ? 3 : 4;
  return { tall, crowd, seam: [ax, ay, bx, by] as const, cols, rows: Math.max(1, Math.ceil(rivals / cols)),
    x: (x0 + x1) / 2, y: (y0 + y1) / 2, angle: Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI, length: Math.hypot(x1 - x0, y1 - y0),
    lean: tall ? 0 : Math.atan2((ax - bx) * width, height) * 180 / Math.PI };
}
export function vsTimeline(seconds = VS_WHOLE) { const hold = Math.max(VS_HOLD_MIN, seconds - VS_IN - VS_OUT); return { hold, whole: VS_IN + hold + VS_OUT }; }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fullLength = (id: FighterId) => (HOME_ROSTER as readonly FighterId[]).includes(id);
export const vsArt = (id: FighterId) => fullLength(id) ? fighterArt(id) : mediaArt(`/assets/home/portraits/${id}.webp`);
const FACE_AT: Partial<Record<FighterId, number>> = {
  goku: .11, naruto: .1, luffy: .11, zoro: .075, sanji: .08, vegeta: .24, kakashi: .11, sasuke: .11,
  jotaro: .12, ichigo: .1, ace: .125, law: .125, gojo: .115, dio: .1, guts: .18, killua: .18,
  kaido: .17, whitebeard: .17, shanks: .11, roger: .11, aizen: .11, sukuna: .12,
  griffith: .125, meruem: .145, 'goku-black': .17, jiren: .13, 'golden-frieza': .15,
  'gohan-beast': .24, saitama: .13, akaza: .12, itachi: .12, madara: .155,
  tanjiro: .13, levi: .12, 'sung-jinwoo': .13, gon: .2,
};
const FACE_X: Partial<Record<FighterId,number>> = {
  kaido:48, whitebeard:44, shanks:50, roger:54, aizen:59, sukuna:48,
  griffith:43, meruem:41, 'goku-black':49, jiren:54, 'golden-frieza':51,
  'gohan-beast':48, saitama:38, akaza:53, itachi:45, madara:55,
  tanjiro:53, levi:49, 'sung-jinwoo':50, gon:50,
};
const face = (id: FighterId) => `${FACE_AT[id] ? `;--face-at:${FACE_AT[id]}` : ''}${FACE_X[id] ? `;--art-anchor:${FACE_X[id]}%` : ''}`;
function inks(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255];
  const mix = (to: number[], k: number) => `rgb(${c.map((v, i) => Math.round(v + (to[i] - v) * k)).join(',')})`;
  return `--tint:${hex};--wash:${mix([255, 250, 238], .64)};--deep:${mix([10, 8, 12], .5)}`;
}

export class VsSplash {
  readonly element: HTMLElement;
  private show: HTMLElement;
  private card: HTMLElement;
  private finish?: () => void;
  private fought?: () => void;
  private timer = 0;
  private fightTimer = 0;
  onBeat?: (beat: VsBeat) => void;
  private splashBeats: number[] = [];
  private fightBeats: number[] = [];
  private run = 0;
  private rivals = 0;
  constructor(parent: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'vs-splash';
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
    this.element.innerHTML = `<div class="vs-show"></div><div class="vs-fight"><div class="vs-fight-lines"></div><svg class="vs-fight-brush" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="${brushStroke(3, .62)}"/></svg><b class="vs-fight-word">FIGHT!</b></div>`;
    this.show = this.element.querySelector<HTMLElement>('.vs-show')!;
    this.card = this.element.querySelector<HTMLElement>('.vs-fight')!;
    this.show.addEventListener('pointerdown', () => this.skip());
    addEventListener('resize', () => { if (this.open) this.layout(); }, { passive: true });
    parent.append(this.element);
  }
  get open() { return !!this.finish; }
  preload(fighters: readonly FighterId[]) { for (const id of new Set(fighters)) { const img = new Image(); img.decoding = 'async'; img.src = vsArt(id); } }
  play(opts: VsPlay): Promise<void> {
    this.end();
    const run = ++this.run, { hold, whole } = vsTimeline(opts.seconds);
    const rivals = opts.rights.slice(0, 11), crowd = rivals.length > 1;
    this.rivals = rivals.length;
    const splats = inkSplats();
    this.show.className = `vs-show ${crowd ? 'vs-crowd' : 'vs-duel'}`;
    this.show.style.setProperty('--hold', `${hold}s`);
    this.show.innerHTML = `<div class="vs-stage">
      ${this.panel(opts.left, 'vs-left')}
      ${crowd ? `<div class="vs-grid">${rivals.map((r, i) => this.cell(r, i)).join('')}</div>` : rivals.length ? this.panel(rivals[0], 'vs-right') : this.unknown()}
      <svg class="vs-seam" viewBox="0 0 1000 200" preserveAspectRatio="none"><path d="${brushStroke(11, .8)}"/></svg>
      <div class="vs-mark"><svg viewBox="-50 -50 100 100"><path d="${splats[3]}"/></svg><b>VS</b></div>
      ${opts.stage ? `<div class="vs-stage-name"><span>STAGE</span>${esc(opts.stage)}</div>` : ''}
    </div><div class="vs-cut"></div><div class="vs-flash"></div>`;
    this.layout();
    const art = [...this.show.querySelectorAll<HTMLImageElement>('img')];
    for (const img of art) img.addEventListener('error', () => {
      const fighter = img.dataset.fighter as FighterId, span = document.createElement('span');
      span.className = `${img.className} vs-fallback`; span.innerHTML = mangaPortrait(fighter); img.replaceWith(span);
    }, { once: true });
    this.element.hidden = false;
    const done = new Promise<void>(resolve => { this.finish = resolve; });
    const start = () => {
      if (run !== this.run || !this.finish) return;
      this.show.classList.add('vs-go');
      this.timer = window.setTimeout(() => this.end(), whole * 1000);
      this.beat(this.splashBeats, VS_BEATS.panels, 'panels'); this.beat(this.splashBeats, VS_BEATS.stamp, 'stamp');
      this.beat(this.splashBeats, VS_IN + hold, 'cut');
    };
    void Promise.race([Promise.all(art.map(img => img.decode().catch(() => undefined))), new Promise(r => setTimeout(r, DECODE_WAIT))]).then(start);
    return done;
  }
  fight(): Promise<void> {
    this.endFight();
    this.card.classList.remove('vs-on');
    void this.card.offsetWidth;
    this.card.classList.add('vs-on');
    this.element.hidden = false;
    this.beat(this.fightBeats, VS_BEATS.fight, 'fight'); this.beat(this.fightBeats, VS_BEATS.fightSlam, 'fight-slam');
    return new Promise<void>(resolve => { this.fought = resolve; this.fightTimer = window.setTimeout(() => this.endFight(), FIGHT_SECONDS * 1000); });
  }
  skip() {
    if (this.fought) this.endFight();
    if (!this.finish) return;
    if (!this.show.classList.contains('vs-go')) { this.end(); return; }
    if (this.show.classList.contains('vs-skip')) return;
    clearTimeout(this.timer);
    for (const t of this.splashBeats.splice(0)) clearTimeout(t);
    this.show.classList.add('vs-skip');
    this.timer = window.setTimeout(() => this.end(), SKIP_FADE);
  }
  private beat(list: number[], at: number, beat: VsBeat) { list.push(window.setTimeout(() => this.onBeat?.(beat), at * 1000)); }
  private end() {
    clearTimeout(this.timer);
    for (const t of this.splashBeats.splice(0)) clearTimeout(t);
    this.run++;
    const finish = this.finish; this.finish = undefined;
    this.show.className = 'vs-show'; this.show.innerHTML = '';
    if (!this.fought) this.element.hidden = true;
    finish?.();
  }
  private endFight() {
    clearTimeout(this.fightTimer);
    for (const t of this.fightBeats.splice(0)) clearTimeout(t);
    this.card.classList.remove('vs-on');
    const fought = this.fought; this.fought = undefined;
    if (!this.finish) this.element.hidden = true;
    fought?.();
  }
  private layout() {
    const l = vsLayout(this.rivals, innerWidth, innerHeight), s = this.show.style;
    this.show.classList.toggle('vs-tall', l.tall);
    const [ax, ay, bx, by] = l.seam.map(v => `${v * 100}%`);
    s.setProperty('--ax', ax); s.setProperty('--ay', ay); s.setProperty('--bx', bx); s.setProperty('--by', by);
    s.setProperty('--seam-x', `${l.x}px`); s.setProperty('--seam-y', `${l.y}px`);
    s.setProperty('--seam-angle', `${l.angle}deg`); s.setProperty('--seam-length', `${l.length}px`);
    s.setProperty('--lean', `${l.lean}deg`); s.setProperty('--cols', String(l.cols)); s.setProperty('--rows', String(l.rows));
  }
  private art(side: VsSide) {
    return `<img class="vs-art" alt="" decoding="async" draggable="false" data-fighter="${side.fighter}" src="${vsArt(side.fighter)}">`;
  }
  private label(side: VsSide, cls: string) {
    const long = side.name.length > 10 ? ' vs-long' : '';
    return `<div class="${cls}${long}">${side.tag ? `<small>${esc(side.tag)}</small>` : ''}<strong>${esc(side.name)}</strong></div>`;
  }
  private panel(side: VsSide, cls: string) {
    const kind = fullLength(side.fighter) ? 'vs-full' : 'vs-bust';
    return `<section class="vs-panel ${cls} ${kind}" style="${inks(FIGHTERS[side.fighter].color)}${face(side.fighter)}"><div class="vs-lines"></div>${this.art(side)}<div class="vs-tone"></div>${this.label(side, 'vs-name')}</section>`;
  }
  private cell(side: VsSide, i: number) {
    const kind = fullLength(side.fighter) ? 'vs-full' : 'vs-bust';
    return `<section class="vs-cell ${kind}" style="${inks(FIGHTERS[side.fighter].color)}${face(side.fighter)};--i:${i}"><div class="vs-lines"></div>${this.art(side)}<div class="vs-tone"></div>${this.label(side, 'vs-cell-name')}</section>`;
  }
  private unknown() {
    return `<section class="vs-panel vs-right vs-unknown" style="--tint:#2a2b30;--wash:#3b3c42;--deep:#0b0c0e"><div class="vs-lines"></div><b class="vs-unknown-mark">?</b><div class="vs-tone"></div><div class="vs-name"><small>WAITING</small><strong>RIVALS INCOMING</strong></div></section>`;
  }
}
