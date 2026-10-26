import './cosmetics.css';
import * as THREE from 'three';
import { gameCosmetics, onScreen } from './index';

export interface EmoteWho { name: string; title?: string; fighter: string }
interface Live { el: HTMLElement; who: string; until: number; screen?: 'focus' | 'page' }
const ANGER = '<svg viewBox="0 0 100 100"><g fill="none" stroke-width="12" stroke-linecap="round"><path d="M40 10Q42 38 12 40"/><path d="M60 10Q58 38 88 40"/><path d="M40 90Q42 62 12 60"/><path d="M60 90Q58 62 88 60"/></g></svg>';
const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const EMOTES: Record<string, { ms: number; screen?: 'focus' | 'page'; html: (who: EmoteWho) => string }> = {
  'emote-interrobang': { ms: 1600, html: () => '<b class="cos-bang">!?</b>' },
  'emote-dots': { ms: 2200, html: () => '<b class="cos-dots"><i></i><i></i><i></i></b>' },
  'emote-sweat': { ms: 2000, html: () => '<b class="cos-sweat"><i></i></b>' },
  'emote-anger': { ms: 1800, html: () => `<b class="cos-anger">${ANGER}</b>` },
  'emote-sparkle': { ms: 1900, html: () => '<b class="cos-sparkle"><em>キラッ</em><i></i><i></i><i></i></b>' },
  'emote-menacing': { ms: 2600, html: () => '<b class="cos-menacing"><i>ゴ</i><i>ゴ</i><i>ゴ</i><i>ゴ</i><i>ゴ</i><i>ゴ</i></b>' },
  'emote-don': { ms: 1700, html: () => '<b class="cos-don">ドン!!</b>' },
  'emote-speed-lines': { ms: 1500, screen: 'focus', html: () => '<b class="cos-focus"></b>' },
  'emote-cover-page': { ms: 2900, screen: 'page', html: who => `<b class="cos-cover">
    <span class="cos-cover-mast"><strong>RIFT</strong><em>WEEKLY</em><small>No. ${new Date().getUTCMonth() * 4 + Math.ceil(new Date().getUTCDate() / 7)} · ${new Date().getUTCFullYear()}</small><u>300 墨</u></span>
    <span class="cos-cover-side">${escape(who.name.toUpperCase())}</span>
    <span class="cos-cover-foot"><em>${escape((who.title ?? 'A new chapter').toUpperCase())}</em><small>THE PAGE TURNS · A NEW CHAPTER INSIDE</small><i></i></span></b>` },
};
export const EMOTE_IDS = Object.keys(EMOTES);

const _head = new THREE.Vector3();

export class Emotes {
  private readonly layer: HTMLElement;
  private readonly live: Live[] = [];
  private frame = 0;
  constructor(parent: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'cos-layer'; this.layer.setAttribute('aria-hidden', 'true');
    parent.append(this.layer);
  }
  play(id: string, who: string, as: EmoteWho) {
    const emote = EMOTES[id];
    if (!emote) return;
    for (const old of this.live.filter(each => each.who === who)) old.until = 0;
    const el = document.createElement('div');
    el.className = `cos-emote${emote.screen ? ` cos-screen cos-${emote.screen}` : ''}`;
    el.style.setProperty('--ms', `${emote.ms}ms`);
    el.innerHTML = emote.html(as);
    this.layer.append(el);
    this.live.push({ el, who, until: performance.now() + emote.ms, screen: emote.screen });
    this.place();
    if (!this.frame) this.frame = requestAnimationFrame(this.step);
  }
  clear() { for (const live of this.live) live.el.remove(); this.live.length = 0; }
  private readonly step = () => {
    this.frame = 0;
    this.place();
    if (this.live.length) this.frame = requestAnimationFrame(this.step);
  };
  private place() {
    const now = performance.now(), layer = gameCosmetics();
    for (let i = this.live.length - 1; i >= 0; i--) {
      const live = this.live[i];
      if (now >= live.until) { live.el.remove(); this.live.splice(i, 1); continue; }
      const feet = layer?.where(live.who), height = layer?.heightOf(live.who) ?? 1.75;
      const at = feet ? onScreen(_head.set(feet.x, feet.y + height * 1.08, feet.z)) : undefined;
      if (live.screen === 'page') continue;
      if (live.screen === 'focus') { if (at) { live.el.style.setProperty('--x', `${at.x}px`); live.el.style.setProperty('--y', `${at.y + innerHeight * .12}px`); } continue; }
      live.el.style.visibility = at ? '' : 'hidden';
      if (at) live.el.style.transform = `translate3d(${Math.min(innerWidth - 90, Math.max(90, at.x)).toFixed(1)}px,${Math.min(innerHeight - 40, Math.max(170, at.y)).toFixed(1)}px,0)`;
    }
  }
}
