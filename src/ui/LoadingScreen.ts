import { FIGHTERS } from '../config';
import { mediaArt } from './mediaArt';
import { AWAKENINGS, AWAKENING_SECONDS, moveFor } from '../game/awakening';
import { ULTIMATE_COST, type MoveDefinition } from '../game/moves';
import type { AttackSlot, FighterId } from '../game/types';
import { RULES } from '../game/objectives/model';
import { keyNames } from '../input/bindings';
import { HOME_FIGHTERS, fighterArt, mangaPortrait } from './MangaHome';
import { packArt } from '../engine/packs/active';
import { guardTips } from './guardGuide';
import { currentDevice, promptKey, touchKey } from './prompts';


export type LoadingMode = 'duel' | 'bots' | 'players' | 'private' | 'party' | 'training' | 'arcade' | 'bad-blood' | 'last-stand' | 'rift-war';
export type LoadingStep = 'prepare' | 'connect' | 'room' | 'assets' | 'warm';

const MODE_TITLE: Record<LoadingMode, [string, string]> = {
  'rift-war':['RIFT WAR','THREE LANES. ONE CORE.'],
  duel: ['DUEL', 'ONE FIGHTER. ONE RIVAL.'], bots: ['BATTLE ROYALE', 'BOTS'], players: ['BATTLE ROYALE', 'ONLINE'], private: ['BATTLE ROYALE', 'PRIVATE ROOM'], party: ['BATTLE ROYALE', 'PARTY MATCH'],
  training: ['TRAINING GROUND', 'NO STAKES'], arcade: ['ARCADE SURVIVAL', 'THE RIFT'], 'bad-blood': ['BAD BLOOD', 'HEROES VS VILLAINS'], 'last-stand': ['LAST STAND', 'DEFEND THE HIDDEN LEAF'],
};
export const loadingTitle = (mode: LoadingMode): readonly [string, string] => MODE_TITLE[mode];
const STEP_SPAN: Record<LoadingStep, [number, number]> = { prepare: [0, .08], connect: [.08, .16], room: [.16, .22], assets: [.22, .84], warm: [.84, .97] };
const STEP_LABEL: Record<LoadingStep, string> = { prepare: 'READYING YOUR FIGHTER', connect: 'CONNECTING TO THE ARENA', room: 'ENTERING THE ROOM', assets: 'SUMMONING FIGHTERS', warm: 'PREPARING THE FIGHT' };
const TIP_SECONDS = 6.5;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const key = (action: Parameters<typeof keyNames>[0]) => {
  const { device, family } = currentDevice();
  return device === 'touch' ? touchKey(action) : device === 'controller' ? promptKey(action, { device, family }) : `<kbd>${escape(keyNames(action))}</kbd>`;
};

function moveLine(move: MoveDefinition) {
  const what = { melee: 'close combat', beam: 'a beam', projectile: 'a ranged attack', bomb: 'an area blast', field: 'area control' }[move.style];
  const extra = [move.close ? 'closes the distance' : '', move.contacts.length > 1 ? 'hits more than once' : '', move.guardBreak ? 'breaks guard' : '', move.timeStop ? 'stops time' : ''].filter(Boolean);
  return extra.length ? `${what} that ${extra.join(', ').replace(/, ([^,]*)$/, ' and $1')}` : what;
}

function tipsFor(fighter: FighterId, mode: LoadingMode) {
  const name = FIGHTERS[fighter].name.toUpperCase(), awakening = AWAKENINGS[fighter];
  const slots: [AttackSlot, Parameters<typeof keyNames>[0]][] = [['light', 'light'], ['heavy', 'heavy'], ['special', 'special']];
  const tips = slots.map(([slot, action]) => { const move = moveFor(fighter, slot, false); return `${key(action)} ${name} · <b>${escape(move.name.toUpperCase())}</b> - ${moveLine(move)}.`; });
  const ultimate = moveFor(fighter, 'ultimate', false);
  tips.push(`${key('ultimate')} <b>${escape(ultimate.name.toUpperCase())}</b> spends a full ultimate meter (${ULTIMATE_COST}). The meter fills with every blow you land.`);
  const area = moveFor(fighter, 'area', false);
  tips.push(`${key('area')} <b>${escape(area.name.toUpperCase())}</b>: hold to place the circle, let go to cast. It lands once the circle fills, so lead a fighter on the move.`);
  tips.push(`${key('awaken')} <b>${escape(awakening.name.toUpperCase())}</b>: ${name} transforms for ${AWAKENING_SECONDS} seconds. The awakening meter fills as you take hits - blocked ones fill it too, more slowly.`);
  const rules = [
    ...guardTips(key('guard')),
    `An ordinary move cannot finish a fighter who is guarding. An ultimate can.`,
    `Launched? Press ${key('jump')} or ${key('dash')} in the air to recover onto your feet. It costs stamina.`,
    `${key('target')} locks on, and switches to the next fighter.`,
  ];
  if (mode === 'bots' || mode === 'players' || mode === 'private' || mode === 'party') rules.unshift(`One life each, last one standing. Stay in the action: fighters who hide get hunted.`);
  if (mode === 'rift-war') rules.unshift('Push with your wave. Towers prefer grunts until you attack an enemy fighter under their protection.','Recall to your fountain to heal and buy equipment. Movement or damage cancels the channel.');
  if (mode === 'duel') rules.unshift('A straight 1v1. Best of three: win two rounds to take the set. Run it back with the same rival.');
  if (mode === 'last-stand') rules.unshift('Defend the village and keep one ally standing. Stand beside a fallen teammate to revive them.', 'Your squad shares its points. Visit the quartermaster inside the gate to repair and upgrade the village.');
  if (mode === 'bad-blood') rules.unshift(`Villains have ${RULES.villainMultiplier}× combat stats. Each Hero returns once after ${RULES.heroReviveSeconds} seconds—but a whole team down together loses immediately.`);
  const shuffle = <T>(list: T[]) => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  return [...shuffle(tips), ...shuffle(rules)];
}

const artFor = (mode: LoadingMode) => `/assets/home/modes/${mode === 'bots' ? 'players' : mode === 'party' ? 'private' : mode}.webp`;
const heroFor = (fighter: FighterId) => packArt(fighter, 'portrait') ?? ((HOME_FIGHTERS as readonly FighterId[]).includes(fighter) ? fighterArt(fighter) : mediaArt(`/assets/home/portraits/${fighter}.webp`));
const warm = new Map<string, HTMLImageElement>();
export function preloadLoadingArt(mode: LoadingMode, fighter: FighterId) {
  for (const src of [artFor(mode), heroFor(fighter)]) {
    if (warm.has(src)) continue;
    const img = new Image(); img.decoding = 'async'; img.src = src; warm.set(src, img);
  }
}

const filesOf = (fighter: FighterId) => { const d = FIGHTERS[fighter]; return [d.model, d.rushModel, ...(d.extraModels ?? []), d.formModel].filter((u): u is string => !!u); };
const pathOf = (url: string) => { try { return new URL(url, location.href).pathname; } catch { return url; } };
const sizes = new Map<string, Promise<number>>();
const sizeOf = (url: string) => {
  let size = sizes.get(url);
  if (!size) { size = fetch(url, { method: 'HEAD' }).then(r => Number(r.headers.get('content-length')) || 0, () => 0); sizes.set(url, size); }
  return size;
};

export class LoadingScreen {
  private readonly root: HTMLElement;
  private tips: string[] = [];
  private tip = 0;
  private timer = 0;
  private poll = 0;
  private step: LoadingStep = 'prepare';
  private shown = 0;
  private roster: { fighter: FighterId; self: boolean; element: HTMLElement }[] = [];
  private loaded: (fighter: FighterId) => boolean = () => false;
  private stageReady: () => boolean = () => false;
  private visible = false;
  private fighter: FighterId = 'naruto';
  private stepAt = 0;
  private bytes = 0;
  private observer?: PerformanceObserver;
  private expected = new Map<string, number>();
  private arrived = new Map<string, number>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('section');
    this.root.className = 'match-loading';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-label', 'Loading the match');
    this.root.innerHTML = `<div class="ml-lines" aria-hidden="true"></div>
      <figure class="ml-panel" aria-hidden="true"><img class="ml-panel-art" alt=""></figure>
      <div class="ml-hero" aria-hidden="true"><img class="ml-hero-art" alt=""></div>
      <header class="ml-title"><p class="ml-kicker"></p><h2 class="ml-mode"></h2><p class="ml-stage"></p></header>
      <div class="ml-band">
        <aside class="ml-tip"><b class="ml-tip-tag">TIP</b><p class="ml-tip-text"></p></aside>
        <ol class="ml-roster" aria-label="Fighters in this room"></ol>
        <div class="ml-progress"><span class="ml-step"></span><div class="ml-bar"><i></i></div><span class="ml-pct">0%</span></div>
      </div>`;
    parent.append(this.root);
  }

  get open() { return this.visible; }

  show(fighter: FighterId, mode: LoadingMode, players?: number) {
    clearInterval(this.timer); clearInterval(this.poll);
    const [title, kicker] = MODE_TITLE[mode];
    const $ = <T extends HTMLElement>(selector: string) => this.root.querySelector<T>(selector)!;
    $('.ml-kicker').textContent = players && mode === 'bots' ? `${kicker} · ${players} FIGHTERS` : kicker;
    $('.ml-mode').textContent = title;
    $('.ml-stage').textContent = '';
    const picture = (img: HTMLImageElement, src: string) => {
      img.classList.remove('ml-ready'); img.onload = () => img.classList.add('ml-ready');
      img.src = src; if (img.complete && img.naturalWidth) img.classList.add('ml-ready');
    };
    picture($<HTMLImageElement>('.ml-panel-art'), artFor(mode));
    const full = (HOME_FIGHTERS as readonly FighterId[]).includes(fighter);
    picture($<HTMLImageElement>('.ml-hero-art'), heroFor(fighter));
    $('.ml-hero').classList.toggle('portrait', !full);
    this.root.dataset.fighter = fighter; this.fighter = fighter;
    this.bytes = 0; this.observer?.disconnect(); this.expected.clear(); this.arrived.clear();
    try {
      this.observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          this.bytes += entry.transferSize || 0;
          const path = pathOf(entry.name);
          if (this.expected.has(path)) this.arrived.set(path, entry.encodedBodySize || entry.transferSize || this.expected.get(path) || 0);
        }
      });
      this.observer.observe({ type: 'resource' });
    } catch { this.observer = undefined; }
    this.roster = []; $('.ml-roster').innerHTML = '';
    this.tips = tipsFor(fighter, mode); this.tip = -1; this.nextTip();
    this.timer = window.setInterval(() => this.nextTip(), TIP_SECONDS * 1000);
    this.poll = window.setInterval(() => this.refresh(), 200);
    this.step = 'prepare'; this.stepAt = performance.now(); this.shown = 0; this.setBar(0);
    this.root.hidden = false; this.visible = true;
    requestAnimationFrame(() => this.root.classList.add('on'));
    this.refresh();
  }

  progress(step: LoadingStep) { if (!this.visible) return; if (step !== this.step) this.stepAt = performance.now(); this.step = step; this.refresh(); }

  room(stage: string | undefined, fighters: { fighter: FighterId; self: boolean }[], loaded: (fighter: FighterId) => boolean, stageReady: () => boolean) {
    if (!this.visible) return;
    if (stage) this.root.querySelector('.ml-stage')!.textContent = stage.toUpperCase();
    this.loaded = loaded; this.stageReady = stageReady;
    const list = this.root.querySelector('.ml-roster')!;
    const ordered = [...fighters].sort((a, b) => Number(b.self) - Number(a.self));
    if (ordered.map(f => f.fighter).join() !== this.roster.map(f => f.fighter).join()) {
      list.innerHTML = '';
      this.roster = ordered.map(({ fighter, self }) => {
        const element = document.createElement('li');
        element.className = 'ml-fighter' + (self ? ' self' : '');
        element.title = FIGHTERS[fighter].name;
        element.innerHTML = mangaPortrait(fighter);
        list.append(element);
        return { fighter, self, element };
      });
      for (const fighter of new Set(ordered.map(f => f.fighter))) for (const url of filesOf(fighter)) {
        const path = pathOf(url);
        if (this.expected.has(path)) continue;
        this.expected.set(path, 0);
        void sizeOf(url).then(size => { if (this.expected.has(path)) this.expected.set(path, size); });
      }
    }
    this.refresh();
  }

  done() {
    if (!this.visible) return;
    this.setBar(1); this.root.querySelector('.ml-step')!.textContent = 'FIGHT';
    this.visible = false; clearInterval(this.timer); clearInterval(this.poll); this.observer?.disconnect();
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!this.visible) this.close(380); }));
  }

  hide() { if (this.visible) this.close(0); }

  private close(delay: number) {
    this.visible = false;
    clearInterval(this.timer); clearInterval(this.poll); this.observer?.disconnect();
    this.root.classList.remove('on');
    window.setTimeout(() => { if (!this.visible) this.root.hidden = true; }, delay);
  }

  private nextTip() {
    if (!this.tips.length) return;
    this.tip = (this.tip + 1) % this.tips.length;
    const text = this.root.querySelector<HTMLElement>('.ml-tip-text')!;
    text.classList.remove('in');
    window.setTimeout(() => { text.innerHTML = this.tips[this.tip]; text.classList.add('in'); }, this.tip === 0 && !text.innerHTML ? 0 : 220);
  }

  private refresh() {
    if (!this.visible) return;
    const [from, to] = STEP_SPAN[this.step];
    let fraction = from + (to - from) * .85 * (1 - Math.exp(-(performance.now() - this.stepAt) / 9000));
    let label = this.step === 'prepare' ? `READYING ${FIGHTERS[this.fighter].name.toUpperCase()}` : STEP_LABEL[this.step];
    let weighed: [number, number] | undefined;
    if (this.step === 'assets' && this.roster.length) {
      const distinct = [...new Set(this.roster.map(f => f.fighter))];
      let need = 0, have = 0, known = true;
      for (const fighter of distinct) for (const url of filesOf(fighter)) {
        const path = pathOf(url), size = this.expected.get(path) ?? 0;
        if (!size) { known = false; continue; }
        need += size; have += this.loaded(fighter) ? size : Math.min(size, this.arrived.get(path) ?? 0);
      }
      const done = distinct.filter(f => this.loaded(f)).length + (this.stageReady() ? 1 : 0);
      const share = known && need > 0 ? .9 * have / need + (this.stageReady() ? .1 : 0) : done / (distinct.length + 1);
      fraction = Math.max(fraction, from + (to - from) * Math.min(1, share));
      label = `${distinct.length} FIGHTER${distinct.length === 1 ? '' : 'S'} + ARENA`;
      if (known && need > 0) weighed = [have, need];
    }
    const mb = this.bytes / 1048576, size = (bytes: number) => { const m = bytes / 1048576; return m.toFixed(m < 10 ? 1 : 0); };
    this.root.querySelector('.ml-step')!.textContent = weighed ? `${label} · ${size(weighed[0])} / ${size(weighed[1])} MB` : mb >= .5 ? `${label} · ${mb.toFixed(mb < 10 ? 1 : 0)} MB` : label;
    for (const each of this.roster) each.element.classList.toggle('ready', this.loaded(each.fighter));
    this.setBar(Math.max(this.shown, fraction));
  }

  private setBar(fraction: number) {
    this.shown = fraction;
    this.root.style.setProperty('--ml-progress', String(fraction));
    this.root.querySelector('.ml-pct')!.textContent = `${Math.round(fraction * 100)}%`;
  }
}
