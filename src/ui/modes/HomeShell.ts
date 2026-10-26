import type { FighterId, RoomMode } from '../../game/types';
import { FIGHTERS } from '../../config';
import { isLaboratoryPreviewFighter } from '../../fighterLab';
import type { NetworkAccess } from '../../network';
import { isObjectiveKind } from '../../game/objectives/model';
import type { UiAction } from '../../input/gamepad';
import type { HomeMode } from '../MangaHome';
import type { Hud } from '../Hud';
import { readInvite } from '../roomInvite';
import { MODES, MODE_OF_HOME, type ModeId, type VariantId } from './catalogue';
import { ModeSheet } from './ModeSheet';
import { GameMenu } from '../menu/GameMenu';
import { ResultsShell } from '../results/ResultsShell';
import { WaitingDock } from './WaitingDock';
import { Coach } from './Coach';
import { HudPrompts } from './HudPrompts';
import { LookHint } from './LookHint';
import { explainerSeen, modePrefs, setTrainingDummy, trainingDummy } from './prefs';
import './homeShell.css';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const PROGRESS = /^(ARENA READY|Loading|Preparing|Summoning|Connecting|Entering|Readying)/i;

export class HomeShell {
  readonly sheet: ModeSheet;
  readonly menu: GameMenu;
  readonly results: ResultsShell;
  private started?: { mode: ModeId; variant: VariantId };
  private invited?: { mode: ModeId; code: string };
  private readonly root: HTMLElement;
  private readonly dock: WaitingDock;
  private line?: HTMLElement;
  private sub?: HTMLElement;
  private shown?: string;
  private lastLabel = '';

  constructor(private readonly hud: Hud, private readonly deps: { story?: () => void } = {}) {
    this.root = document.querySelector<HTMLElement>('#interface')!;
    this.sheet = new ModeSheet({
      root: this.root,
      fighter: () => hud.selected,
      name: () => hud.playerName(),
      setName: name => { const input = this.root.querySelector<HTMLInputElement>('#player-name'); if (input) { input.value = name; input.dispatchEvent(new Event('change')); } },
      busy: () => !!this.root.querySelector<HTMLButtonElement>('#home-play')?.disabled,
      start: (fighter: FighterId, mode: RoomMode, access?: NetworkAccess) => { this.started = this.sheet.pending && { mode: this.sheet.pending.mode, variant: this.sheet.pending.variant }; this.invited = undefined; hud.onPreviewStop(); void hud.onStart(fighter, mode, hud.playerName(), access); this.refresh(); },
      changeFighter: () => { this.root.querySelector<HTMLElement>('.home-fighter[aria-pressed="true"]')?.focus(); },
      story: deps.story,
    });
    this.menu = new GameMenu(this.root, hud.modes);
    this.menu.variant = () => this.started && this.started.mode === hud.modes.layout ? this.started.variant : undefined;
    this.results = new ResultsShell(this.root, hud);
    this.results.started = () => this.started;
    this.results.openSheet = mode => this.sheet.show(mode);
    const dock = this.dock = new WaitingDock(this.root, () => hud.onLeave(), () => hud.onFightBot()), coach = new Coach(this.root), prompts = new HudPrompts(this.root), look = new LookHint(this.root);
    hud.modes.listeners.push({ frame: (f, layout) => prompts.frame(f, layout), clear: () => prompts.clear() }, { frame: (f, layout) => look.frame(f, layout), clear: () => look.clear() });
    hud.modes.listeners.push({ frame: (f, layout) => dock.frame(f, layout), clear: () => dock.clear() }, { frame: (f, layout) => coach.frame(f, layout), event: (e, s, layout) => coach.event(e, s, layout), clear: () => coach.clear() });
    this.home();
    this.invites();
    this.failures();
    hud.modes.onLayout = layout => { this.results.reset(); if (layout === 'training') { hud.onTraining('reset'); hud.onTraining(trainingDummy()); } };
    const notify = hud.notify.bind(hud);
    hud.notify = (text: string, duration?: number) => { if (/^Match started in /i.test(text)) return; notify(text, duration); };
    this.root.addEventListener('click', event => { const b = (event.target as HTMLElement).closest<HTMLElement>('[data-training="passive"],[data-training="combat"]'); if (b) setTrainingDummy(b.dataset.training as 'passive' | 'combat'); });
  }

  selected(): { card: HomeMode; mode: ModeId; variant?: VariantId } {
    const card = (this.root.querySelector<HTMLElement>('.home-mode[aria-pressed="true"]')?.dataset.mode ?? 'bots') as HomeMode;
    return { card, ...MODE_OF_HOME[card] };
  }
  play(variant?: VariantId) {
    if (isLaboratoryPreviewFighter(this.hud.selected)) {
      this.hud.onPreviewStop(); this.hud.onLaboratoryReview(this.hud.selected); return;
    }
    const { mode, variant: cardVariant } = this.selected();
    this.hud.onPreviewStop();
    if (this.invited?.mode === mode && (!variant || variant === 'friends')) { this.showInvite(); return; }
    this.sheet.show(mode, { variant: variant ?? cardVariant });
  }
  private showInvite() {
    const { mode, code } = this.invited!;
    this.sheet.show(mode, { variant: 'friends', code, invited: true, status: `YOU'RE INVITED · ${MODES[mode].name} · ${code}. Choose your fighter, then JOIN.` });
  }
  back(source: 'keyboard' | 'controller' = 'keyboard') {
    if (this.sheet.open) { this.sheet.back(); return true; }
    if (this.closeTree()) return true;
    if (this.menu.open && this.menu.current !== 'home' && source === 'keyboard') { this.menu.home(); return true; }
    const arcade = this.root.querySelector<HTMLElement>('#sv-results:not(.hidden)');
    if (arcade && !this.menu.open) { arcade.querySelector<HTMLElement>('#sv-leave')?.click(); return true; }
    return false;
  }
  controller(action: UiAction) {
    if (!this.hud.settingsOpen && this.dock.controller(action)) return true;
    if (this.results.swallow(action)) return true;
    if (action === 'back') {
      if (this.closeTree()) return true;
      if (this.menu.open && this.menu.current !== 'home') { this.menu.home(); return true; }
    }
    return this.sheet.controller(action);
  }
  get dockChoice() { return this.dock.padChoice; }
  private closeTree() {
    const tree = this.root.querySelector<HTMLElement>('#sv-tree:not(.hidden)');
    if (!tree) return false;
    this.root.querySelector<HTMLElement>('#sv-tree-ready')?.click();
    return true;
  }

  private home() {
    const play = this.root.querySelector<HTMLButtonElement>('#home-play');
    const heading = this.root.querySelector<HTMLElement>('.home-heading');
    if (!play || !heading) return;
    play.onclick = () => { if (!play.disabled) this.play(); };
    for (const word of this.root.querySelectorAll<HTMLButtonElement>('[data-variant]')) word.onclick = event => {
      event.stopPropagation();
      const card = word.closest<HTMLElement>('[data-panel]')?.querySelector<HTMLButtonElement>('[data-mode]');
      if (card && card.getAttribute('aria-pressed') !== 'true') card.click();
      if (!play.disabled) this.play(word.dataset.variant as VariantId);
    };
    const join = this.root.querySelector<HTMLButtonElement>('#choose-join');
    if (join) join.onclick = () => this.sheet.show('royale', { variant: 'friends' });
    this.line = document.createElement('div');
    this.line.className = 'home-mode-line';
    heading.before(this.line);
    this.sub = document.createElement('small');
    this.sub.className = 'home-play-sub';
    play.append(this.sub);
    this.line.addEventListener('click', event => { if ((event.target as HTMLElement).closest('[data-howto]')) { this.hud.onPreviewStop(); this.sheet.show(this.selected().mode, { showPanels: true }); } });
    const cards = this.root.querySelectorAll<HTMLElement>('.home-mode');
    for (const card of cards) {
      card.addEventListener('pointerenter', () => this.describe(card.dataset.mode as HomeMode));
      card.addEventListener('focus', () => this.describe(card.dataset.mode as HomeMode));
      card.addEventListener('pointerleave', () => this.describe());
      card.addEventListener('blur', () => this.describe());
    }
    this.root.querySelector('.manga-home')?.addEventListener('click', () => queueMicrotask(() => this.refresh()));
    const lobby = this.root.querySelector<HTMLElement>('.lobby');
    const atHome = () => document.documentElement.classList.toggle('at-home', !!lobby && !lobby.classList.contains('hidden'));
    atHome();
    if (lobby) new MutationObserver(() => { atHome(); if (!lobby.classList.contains('hidden')) this.refresh(); }).observe(lobby, { attributes: true, attributeFilter: ['class'] });
    this.refresh();
  }
  private describe(card?: HomeMode) {
    if (isLaboratoryPreviewFighter(this.hud.selected) && !card) {
      if (this.line && this.shown !== 'laboratory') {
        this.shown = 'laboratory'; this.line.title = 'Review this fighter in offline Training.';
        this.line.classList.remove('previewing');
        this.line.innerHTML = '<b>FIGHTER LABORATORY</b><em>Try the new fighter</em><i>OFFLINE TRAINING</i><i>IN REVIEW</i>';
      }
      return;
    }
    const selected = this.selected().card, id = card ?? selected, mode = MODES[MODE_OF_HOME[id].mode];
    const preview = MODE_OF_HOME[id].mode !== MODE_OF_HOME[selected].mode;
    const key = `${id}|${preview}`;
    if (!this.line || this.shown === key) return;
    this.shown = key;
    this.line.title = mode.goal;
    this.line.classList.toggle('previewing', preview);
    this.line.innerHTML = `${preview ? '<span class="home-mode-preview">PREVIEW</span>' : ''}<b>${escape(mode.name)}</b><em>${escape(mode.tagline)}</em>${[mode.facts.players, mode.facts.length, mode.facts.lives].map(f => `<i>${escape(f)}</i>`).join('')}${preview ? '' : '<button type="button" data-howto>ⓘ HOW TO PLAY</button>'}`;
  }
  refresh() {
    const play = this.root.querySelector<HTMLButtonElement>('#home-play');
    if (!play) return;
    const label = play.querySelector('span');
    if (isLaboratoryPreviewFighter(this.hud.selected)) {
      if (label) label.textContent = 'TEST FIGHTER';
      this.lastLabel = 'OFFLINE TRAINING · PREVIEW';
      if (this.sub) this.sub.textContent = this.lastLabel;
      play.setAttribute('aria-label', `Review ${FIGHTERS[this.hud.selected].name} in offline Training`);
      this.shown = undefined; this.describe(); return;
    }
    if (label && label.textContent !== 'PLAY') label.textContent = 'PLAY';
    const { mode, variant: cardVariant } = this.selected(), info = MODES[mode];
    const variant = this.sheet.variantFor(mode, cardVariant), prefs = modePrefs(mode);
    const way = info.variants[variant]!.label + (mode === 'royale' && variant === 'offline' ? ` · ${prefs.fighters ?? 8}` : '');
    const text = `${info.name} · ${explainerSeen(mode) ? way : 'FIRST TIME'}`;
    if (this.sub && text !== this.lastLabel) { this.lastLabel = text; this.sub.textContent = text; }
    play.setAttribute('aria-label', `Play ${info.name}, ${info.variants[variant]!.label}, as ${FIGHTERS[this.hud.selected]?.name ?? this.hud.selected}`);
    this.shown = undefined; this.describe();
  }

  private invites() {
    const invite = readInvite(location.href);
    const hash = new URLSearchParams(location.hash.slice(1)), objective = hash.get('mode'), code = hash.get('room');
    const open = (mode: ModeId, room: string) => queueMicrotask(() => {
      (this.root.querySelector('#home-dialog') as HTMLDialogElement | null)?.close();
      this.hud.objectives.closeSetup();
      const card = this.root.querySelector<HTMLButtonElement>(`[data-mode="${mode === 'royale' ? 'bots' : mode}"]`);
      if (card && card.getAttribute('aria-pressed') !== 'true') card.click();
      this.invited = { mode, code: room };
      this.showInvite();
    });
    if (invite) open(invite.kind === 'duel' ? 'duel' : invite.kind === 'coop' ? 'arcade' : 'royale', invite.code);
    else if ((isObjectiveKind(objective)||objective==='rift-war') && code && /^\d{6}$/.test(code)) open(objective, code);
  }

  private failures() {
    const label = this.root.querySelector<HTMLElement>('#load-label'), menu = this.root.querySelector<HTMLElement>('.lobby');
    if (!label || !menu) return;
    new MutationObserver(() => {
      const pending = this.sheet.pending;
      if (!pending || performance.now() - pending.at > 120000) { this.sheet.pending = undefined; return; }
      if (menu.classList.contains('hidden')) return;
      const text = label.textContent?.trim() ?? '';
      if (!text || PROGRESS.test(text)) return;
      this.sheet.pending = undefined;
      this.sheet.show(pending.mode, { variant: pending.variant, status: /try again/i.test(text) ? text : `${text.replace(/\.$/, '')}. Try again, or choose another way to play.` });
    }).observe(label, { childList: true, characterData: true, subtree: true });
    new MutationObserver(() => { if (menu.classList.contains('hidden')) this.sheet.pending = undefined; }).observe(menu, { attributes: true, attributeFilter: ['class'] });
  }
}
