import { FIGHTERS, type HudSkin } from '../../../config';
import { pulseClass } from '../../pulse';
import { AWAKENINGS, AWAKENING_COST, AWAKENING_SECONDS } from '../../../game/awakening';
import { ULTIMATE_COST } from '../../../game/moves';
import type { FighterId, PlayerState } from '../../../game/types';
import { mangaPortrait } from '../../MangaHome';
import { packArt } from '../../../engine/packs/active';
import { mediaArt } from '../../mediaArt';

export type Side = 'own' | 'foe';
export type ProtoId = Exclude<HudSkin, 'inked'>;
export interface ProtoSkin {
  id: ProtoId;
  portrait: 'bust' | 'ink';
  plate(side: Side): string;
  clock(): string;
}

export const txt = (name: string, cls = '', tag = 'b') => `<${tag} class="hd-txt ${cls}" data-hd="${name}"></${tag}>`;
export const picture = (kind: 'bust' | 'ink', cls = '') => kind === 'bust'
  ? `<img class="hd-bust ${cls}" data-hd-bust alt="" decoding="async" draggable="false">`
  : `<span class="hd-ink ${cls}" data-hd-ink></span>`;
export const plateRoot = (id: ProtoId, side: Side, inner: string, style = '') => `<span class="hd-skin hd-${id} hd-${side}"${style ? ` style="${style}"` : ''} aria-hidden="true">${inner}</span>`;

const BASE_BUST_FORMS: ReadonlySet<FighterId> = new Set(['itachi']);
export const bust = (fighter: FighterId, form: boolean) => mediaArt(`/assets/hud/busts/${fighter}${form && !BASE_BUST_FORMS.has(fighter) ? '-form' : ''}.webp`);
const portrait = (fighter: string) => mediaArt(`/assets/home/portraits/${fighter}.webp`);
export const pictures = (fighter: FighterId, form: boolean) => { const own = packArt(fighter, 'bust'); return own ? [own] : [...new Set([bust(fighter, form), bust(fighter, false)]), portrait(fighter)]; };
const NO_BUST = new Set<string>();
export const firstPicture = (fighter: FighterId, form: boolean, missing: ReadonlySet<string> = NO_BUST) => pictures(fighter, form).find(url => !missing.has(url))!;

const hsl = (hex: string) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l] as const;
};
const css = (h: number, s: number, l: number) => `hsl(${h.toFixed(0)} ${(s * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`;
export function tones(hex: string) {
  const [h, s0, l0] = hsl(/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ff753b');
  const grey = s0 < .18 || (l0 > .85 && s0 < .7), hue = grey ? 215 : h, s = grey ? .35 : Math.max(.62, s0);
  return {
    accent: css(hue, s, Math.min(.72, Math.max(.6, l0))),
    flood: css(hue, Math.min(.92, s + .08), Math.min(.62, Math.max(.52, l0))),
    shade: css(hue, Math.min(.92, s + .08), Math.min(.62, Math.max(.52, l0)) * .74),
    deep: css(hue, Math.min(.9, s), .26),
  };
}
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

type Last = { hp: number; st: number; ult: number; awk: number; flags: Record<string, boolean>; texts: Record<string, string> };
const fresh = (): Last => ({ hp: -1, st: -1, ult: -1, awk: -1, flags: {}, texts: {} });

class Plate {
  private readonly texts = new Map<string, HTMLElement[]>();
  private readonly busts: HTMLImageElement[]; private readonly inks: HTMLElement[];
  private readonly bars = new Map<string, (HTMLElement | SVGElement)[]>();
  private last = fresh(); private key = ''; fighter = ''; private form = false;
  constructor(readonly el: HTMLElement) {
    for (const node of el.querySelectorAll<HTMLElement>('[data-hd]')) {
      const list = this.texts.get(node.dataset.hd!) ?? []; list.push(node); this.texts.set(node.dataset.hd!, list);
    }
    for (const node of el.querySelectorAll<HTMLElement | SVGElement>('[data-hd-bar]')) {
      const list = this.bars.get(node.dataset.hdBar!) ?? []; list.push(node); this.bars.set(node.dataset.hdBar!, list);
    }
    this.busts = [...el.querySelectorAll<HTMLImageElement>('img[data-hd-bust]')];
    this.inks = [...el.querySelectorAll<HTMLElement>('[data-hd-ink]')];
    for (const img of this.busts) {
      img.addEventListener('error', () => {
        const src = img.getAttribute('src') ?? '';
        if (src === portrait(this.fighter)) return;
        NO_BUST.add(src); this.picture(img);
      });
      img.addEventListener('load', () => img.style.removeProperty('visibility'));
    }
  }
  reset() { this.key = ''; }
  private picture(img: HTMLImageElement) {
    const url = firstPicture(this.fighter as FighterId, this.form);
    img.toggleAttribute('data-fallback', url === portrait(this.fighter)); img.src = url;
  }
  show(fighter: FighterId, form: boolean) {
    const key = `${fighter}:${form}`;
    if (this.key === key) return;
    const sameFighter = this.fighter === fighter;
    this.key = key; this.fighter = fighter; this.form = form;
    for (const img of this.busts) this.picture(img);
    if (!sameFighter) {
      for (const ink of this.inks) ink.innerHTML = mangaPortrait(fighter);
      const def = FIGHTERS[fighter], tone = tones(def?.color ?? '#ff753b'), aura = AWAKENINGS[fighter]?.aura ?? [0xffffff, 0x9fefff];
      const s = this.el.style;
      s.setProperty('--accent', tone.accent); s.setProperty('--flood', tone.flood); s.setProperty('--shade', tone.shade); s.setProperty('--deep', tone.deep);
      s.setProperty('--aura1', hex(aura[0])); s.setProperty('--aura2', hex(aura[1]));
      this.el.dataset.fighter = fighter;
      this.setText('name', (def?.name ?? fighter).toUpperCase());
      this.setText('series', (def?.series ?? '').toUpperCase());
      this.setText('form', (AWAKENINGS[fighter]?.name ?? 'AWAKENED').toUpperCase());
      const name = def?.name ?? fighter;
      if (name.length > 14) this.el.dataset.name = 'longest'; else if (name.length > 12) this.el.dataset.name = 'longer'; else if (name.length > 8) this.el.dataset.name = 'long'; else delete this.el.dataset.name;
      this.last = fresh();
      this.el.classList.add('hd-snap');
    }
  }
  update(p: PlayerState, now: number) {
    const L = this.last, max = Math.max(1, p.maxHp);
    if (L.hp >= 0) this.el.classList.remove('hd-snap');
    const hp = Math.max(0, Math.min(1, p.hp / max));
    if (L.hp >= 0) this.trend('hp', hp - L.hp, .04);
    if (Math.abs(hp - L.hp) > .0005) {
      if (L.hp >= 0 && hp < L.hp - .002) { this.pulse('hd-hit'); if (L.hp - hp >= .08) this.pulse('hd-crit'); }
      this.level('hp', hp.toFixed(4)); L.hp = hp;
    }
    this.setText('hp', String(Math.max(0, Math.ceil(p.hp)))); this.setText('hpmax', String(p.maxHp));
    this.flag('hd-low', p.hp > 0 && hp < .25); this.flag('hd-down', p.hp <= 0);
    const st = Math.max(0, Math.min(1, p.stamina / (p.maxStamina ?? 100)));
    if (L.st >= 0) this.trend('st', st - L.st, .1);
    if (Math.abs(st - L.st) > .002) { this.level('st', st.toFixed(3)); L.st = st; }
    this.flag('hd-tired', st < .25);
    const ult = Math.max(0, Math.min(1, (p.ultimate ?? 0) / ULTIMATE_COST));
    if (L.ult >= 0) this.trend('ult', ult - L.ult, .04);
    if (Math.abs(ult - L.ult) > .002) { this.level('ult', ult.toFixed(3)); L.ult = ult; }
    this.setText('ult', String(Math.floor(ult * 100)));
    if (this.flag('hd-ult', ult >= .999) && ult >= .999) this.pulse('hd-ult-on');
    const awake = !!p.awakened, left = Math.max(0, (p.awakenedUntil ?? 0) - now);
    const awk = awake ? Math.min(1, left / AWAKENING_SECONDS) : Math.max(0, Math.min(1, (p.awakening ?? 0) / AWAKENING_COST));
    if (L.awk >= 0) this.trend('awk', awk - L.awk, .04);
    if (Math.abs(awk - L.awk) > .002) { this.level('awk', awk.toFixed(3)); L.awk = awk; }
    this.setText('awk', awake ? String(Math.ceil(left)) : String(Math.floor(awk * 100)));
    this.setText('awkunit', awake ? 's' : '%');
    if (this.flag('hd-awk', !awake && awk >= .999) && !awake && awk >= .999) this.pulse('hd-awk-on');
    if (this.flag('hd-awake', awake) && awake) this.pulse('hd-awake-on');
  }
  private level(bar: string, value: string) { for (const node of this.bars.get(bar) ?? [this.el]) node.style.setProperty(`--${bar}`, value); }
  private trend(bar: string, delta: number, big: number) {
    const now = typeof performance === 'object' ? performance.now() : 0;
    if (delta > 1e-4) { this.flag(`hd-${bar}-down`, false); this.flag(`hd-${bar}-up`, true); this.movedAt[bar] = now; if (delta >= big) this.pulse(`hd-${bar}-gain`); }
    else if (delta < -1e-4) { this.flag(`hd-${bar}-up`, false); this.flag(`hd-${bar}-down`, true); this.movedAt[bar] = now; if (-delta >= big) this.pulse(`hd-${bar}-drop`); }
    else if (now - (this.movedAt[bar] ?? 0) > 280) { this.flag(`hd-${bar}-up`, false); this.flag(`hd-${bar}-down`, false); }
  }
  private readonly movedAt: Record<string, number> = {};
  flag(name: string, on: boolean) {
    if (this.last.flags[name] === on) return false;
    this.last.flags[name] = on; this.el.classList.toggle(name, on); return true;
  }
  setText(name: string, value: string) {
    if (this.last.texts[name] === value) return;
    this.last.texts[name] = value;
    for (const node of this.texts.get(name) ?? []) node.textContent = value;
  }
  pulse(name: string, el: Element = this.el) { pulseClass(el, name); }
}

const INTRO_AFTER_MS = 480;
export const plateSwapped = (shown: string, now: string, introDue: boolean) => !introDue && !!shown && shown !== now;

export class ProtoHud {
  private readonly plates = new Map<ProtoId, { own: Plate; foe: Plate; clock: HTMLElement | null; time: HTMLElement | null }>();
  private foeId: string | null = null; private introDue = false; private enteredAt = 0;
  private shownTime: string | null = null;
  constructor(private readonly root: HTMLElement, ids: readonly ProtoId[]) {
    for (const id of ids) {
      const own = root.querySelector<HTMLElement>(`.fighter-meter.own .hd-${id}`), foe = root.querySelector<HTMLElement>(`.fighter-meter.foe .hd-${id}`);
      if (!own || !foe) continue;
      const clock = root.querySelector<HTMLElement>(`.hd-clock.hd-${id}`);
      this.plates.set(id, { own: new Plate(own), foe: new Plate(foe), clock, time: clock?.querySelector<HTMLElement>('[data-hd-time]') ?? null });
    }
  }
  get active(): ProtoId | undefined { const skin = this.root.dataset.skin as ProtoId; return this.plates.has(skin) ? skin : undefined; }
  enter(fighter: FighterId) {
    for (const set of this.plates.values()) { set.own.reset(); set.foe.reset(); set.own.show(fighter, false); }
    this.foeId = null; this.introDue = true; this.enteredAt = typeof performance === 'object' ? performance.now() : 0; this.shownTime = null;
  }
  update(self: PlayerState, target: PlayerState | undefined, serverTime: number, clock: number | null, inView = true) {
    const id = this.active; if (!id) return;
    const set = this.plates.get(id)!;
    if (this.introDue && inView && (typeof performance !== 'object' || performance.now() - this.enteredAt > INTRO_AFTER_MS)) {
      this.introDue = false; set.own.pulse('hd-intro'); set.foe.pulse('hd-intro');
    }
    const swapped = plateSwapped(set.own.fighter, self.fighter, this.introDue);
    set.own.show(self.fighter, !!self.awakened && !!FIGHTERS[self.fighter]?.formModel);
    if (swapped) set.own.pulse('hd-intro');
    set.own.update(self, serverTime);
    if (target) {
      const same = target.id === this.foeId && plateSwapped(set.foe.fighter, target.fighter, this.introDue);
      if (target.id !== this.foeId) { const first = this.foeId === null; this.foeId = target.id; set.foe.reset(); if (!first) set.foe.pulse('hd-intro'); }
      set.foe.show(target.fighter, !!target.awakened && !!FIGHTERS[target.fighter]?.formModel);
      if (same) set.foe.pulse('hd-intro');
      set.foe.update(target, serverTime);
    }
    const shown = clock === null ? '' : `${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, '0')}`;
    if (shown !== this.shownTime && set.time && set.clock) { this.shownTime = shown; set.time.textContent = shown; set.clock.classList.toggle('hd-timed', !!shown); }
  }
  refresh() { for (const set of this.plates.values()) { set.own.reset(); set.foe.reset(); } this.shownTime = null; this.foeId = null; }
}
