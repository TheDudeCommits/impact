import type { FighterId } from '../game/types';
import { loadGlyphs, paintLine, paintSeal, type SealText } from '../render/area/StampPainter';
import { sealColour } from '../render/AreaTelegraph';

const CSS = `
.area-banner{position:absolute;left:50%;top:15.5%;transform:translateX(-50%);display:flex;align-items:center;gap:clamp(8px,1.1vw,16px);pointer-events:none;z-index:30;opacity:0}
.area-banner canvas.seal{width:clamp(58px,6.4vw,104px);height:clamp(58px,6.4vw,104px);filter:drop-shadow(3px 3px 0 #0b0606)}
.area-banner .names{display:flex;flex-direction:column;align-items:flex-start;line-height:1}
.area-banner canvas.ja{height:clamp(22px,2.4vw,40px);width:auto;filter:drop-shadow(2px 2px 0 #f4eddb)}
.area-banner .en{font:italic 900 clamp(20px,2.8vw,40px)/1 'Barlow Condensed','Arial Narrow',Impact,sans-serif;color:var(--ink,#101d27);letter-spacing:-.01em;
  text-shadow:2px 2px #f4eddb,-2px -2px #f4eddb,-2px 2px #f4eddb,2px -2px #f4eddb;text-transform:uppercase}
.area-banner.show{animation:area-banner-in 1.6s cubic-bezier(.2,.9,.25,1) forwards}
.area-banner.show canvas.seal{animation:area-seal-slam .32s cubic-bezier(.3,1.6,.5,1) both}
@keyframes area-banner-in{0%{opacity:0;transform:translateX(-50%) scale(1.25)}9%{opacity:1;transform:translateX(-50%) scale(.97)}16%{transform:translateX(-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translateX(-50%) scale(1)}}
@keyframes area-seal-slam{0%{transform:scale(1.9) rotate(-18deg);opacity:0}60%{transform:scale(.9) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0)}}
@media (max-width:720px){.area-banner{top:12%}}`;

export class AreaBanner {
  private readonly root = document.createElement('div');
  private readonly seal = document.createElement('canvas');
  private readonly ja = document.createElement('canvas');
  private readonly en = document.createElement('div');
  private shown = '';

  constructor(parent: HTMLElement = document.body) {
    if (!document.getElementById('area-banner-css')) { const style = document.createElement('style'); style.id = 'area-banner-css'; style.textContent = CSS; document.head.append(style); }
    this.root.className = 'area-banner'; this.root.setAttribute('aria-live', 'polite');
    this.seal.className = 'seal'; this.seal.width = this.seal.height = 208;
    this.ja.className = 'ja'; this.ja.height = 80;
    this.en.className = 'en';
    const names = document.createElement('div'); names.className = 'names'; names.append(this.ja, this.en);
    this.root.append(this.seal, names);
    parent.append(this.root);
    void loadGlyphs();
  }

  async show(fighter: FighterId, text: SealText) {
    const key = `${fighter}|${text.en}|${performance.now()}`;
    this.shown = key;
    await loadGlyphs();
    if (this.shown !== key) return;
    const ctx = this.seal.getContext('2d');
    if (ctx) paintSeal(ctx, text, { mask: false, colour: sealColour(fighter) });
    this.paintJa(text.ja);
    this.en.textContent = text.en;
    this.root.setAttribute('aria-label', `${text.ja} ${text.en}`);
    this.root.classList.remove('show'); void this.root.offsetWidth; this.root.classList.add('show');
  }

  private paintJa(ja: string) { paintLine(this.ja, ja, '#101d27'); }

  hide() { this.shown = ''; this.root.classList.remove('show'); }
  dispose() { this.root.remove(); }
}
