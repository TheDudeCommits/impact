import type { FighterId } from '../../game/types';
import { mangaPortrait } from '../MangaHome';
import './kit.css';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (parent?.dataset.zone) node.dataset.wp3 = '';
  parent?.append(node);
  return node;
}

export class PromptLane {
  private critical: boolean | undefined;
  constructor(readonly zone: HTMLElement) {}
  setCritical(on: boolean) { if (on !== this.critical) { this.critical = on; this.zone.toggleAttribute('data-critical', on); } }
  coachShowing(): boolean {
    for (const child of this.zone.children) {
      const node = child as HTMLElement;
      if (!node.classList.contains('coach-tip') || node.hidden) continue;
      const style = getComputedStyle(node);
      if (style.display !== 'none' && style.visibility !== 'hidden' && +style.opacity > .05) return true;
    }
    return false;
  }
  clear() { this.critical = undefined; this.zone.removeAttribute('data-critical'); }
}

export class Text {
  private value: string | undefined;
  constructor(readonly node: HTMLElement) {}
  set(value: string) { if (value !== this.value) { this.value = value; this.node.textContent = value; } }
}
export class Markup {
  private value: string | undefined;
  constructor(readonly node: HTMLElement) {}
  set(value: string) { if (value !== this.value) { this.value = value; this.node.innerHTML = value; } }
}
export class Fill {
  private value = -1;
  constructor(readonly node: HTMLElement, private readonly step = .002) {}
  set(share: number) {
    const v = Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
    if (Math.abs(v - this.value) < this.step && !(v === 0 && this.value !== 0) && !(v === 1 && this.value !== 1)) return;
    this.value = v; this.node.style.transform = `scaleX(${v.toFixed(4)})`;
  }
}
export class Flag {
  private value: boolean | undefined;
  constructor(readonly node: HTMLElement, private readonly name = 'hidden') {}
  set(on: boolean) { if (on !== this.value) { this.value = on; this.node.classList.toggle(this.name, on); } }
  get on() { return !!this.value; }
}
export class Data {
  private value: string | undefined;
  constructor(readonly node: HTMLElement, private readonly key: string) {}
  set(value: string) { if (value !== this.value) { this.value = value; this.node.dataset[this.key] = value; } }
}

export class Face {
  private fighter = '';
  constructor(readonly node: HTMLElement) {}
  set(fighter: FighterId) { if (fighter !== this.fighter) { this.fighter = fighter; this.node.innerHTML = mangaPortrait(fighter); } }
  clear() { if (this.fighter) { this.fighter = ''; this.node.replaceChildren(); } }
}

export function pulse(node: HTMLElement, key: string) { node.dataset[key] = node.dataset[key] === 'a' ? 'b' : 'a'; }

export const grouped = new Intl.NumberFormat('en-US');
export const clockOf = (seconds: number) => { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export class Plaque {
  readonly root: HTMLElement;
  readonly lead: Text; readonly accent: Text; readonly sub: Text;
  constructor(parent: HTMLElement, className = '') {
    this.root = el('div', `hk-plaque ${className}`.trim(), parent);
    const line = el('strong', '', this.root);
    this.lead = new Text(el('span', '', line)); this.accent = new Text(el('em', '', line));
    this.sub = new Text(el('small', '', this.root));
  }
}

export class WideBar {
  readonly root: HTMLElement;
  readonly label: Text; readonly value: Text; readonly tag: Text;
  private readonly fill: Fill; private readonly echo: Fill;
  private share = -1; private echoShare = 1; private at = 0; private struckAt = 0;
  constructor(parent: HTMLElement, className = '') {
    this.root = el('div', `hk-wide ${className}`.trim(), parent);
    const head = el('div', 'hk-wide-head', this.root);
    this.label = new Text(el('b', '', head)); this.tag = new Text(el('small', '', head)); this.value = new Text(el('span', '', head));
    const track = el('i', 'hk-wide-track', this.root);
    this.echo = new Fill(el('i', 'hk-wide-echo', track)); this.fill = new Fill(el('i', 'hk-wide-fill', track));
  }
  set(share: number, now: number) {
    if (this.share >= 0 && share < this.share - .0005 && now - this.struckAt > 420) { this.struckAt = now; pulse(this.root, 'struck'); }
    if (share > this.echoShare || this.share < 0) this.echoShare = share;
    const dt = this.at ? Math.min(.25, (now - this.at) / 1000) : 0; this.at = now;
    this.echoShare += (share - this.echoShare) * Math.min(1, dt * 2.2);
    this.share = share; this.fill.set(share); this.echo.set(Math.max(share, this.echoShare));
  }
}

export class MiniPlate {
  readonly root: HTMLElement;
  readonly face: Face; readonly name: Text; readonly state: Text; readonly hp: Fill;
  readonly down: Flag; readonly reviving: Flag; readonly gone: Flag; readonly you: Flag;
  constructor(parent: HTMLElement, className = '') {
    this.root = el('div', `hk-mini ${className}`.trim(), parent);
    this.face = new Face(el('span', 'hk-mini-face', this.root));
    const body = el('div', 'hk-mini-body', this.root);
    this.name = new Text(el('b', '', body));
    const track = el('i', 'hk-mini-track', body);
    this.hp = new Fill(el('i', '', track));
    this.state = new Text(el('small', '', body));
    this.down = new Flag(this.root, 'is-down'); this.reviving = new Flag(this.root, 'is-reviving'); this.gone = new Flag(this.root, 'is-gone'); this.you = new Flag(this.root, 'is-you');
  }
}
