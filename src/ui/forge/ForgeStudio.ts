import './forge.css';
import type { AttackSlot, FighterId, GameSnapshot } from '../../game/types';
import { BUDGET_LIMIT, budget, decodeForge, encodeForge, forgeProblems, kitPick, pickSource, type ForgeKit, type ForgeStatus, type TuneKey } from '../../engine/sim/forge';
import { ForgeSession } from '../../engine/client/forgeSession';
import {
  activeKit, armoryRuntime, registerArmory, registerTransplant, transplantRuntime, type ArmoryEffectInfo, type ArmoryRuntime,
} from '../../engine/client/forgeLive';
import { forgeDraftKey, forgeOnline, setForgeOnline } from '../../engine/client/forgeJoin';
import { keptForged, removeForged, saveForged, shareLink, sharedForged, type KeptFighter } from '../../engine/client/forgeAccount';
import * as Studio from '../../engine/client/forgeStudio';
import type { StudioItem, StudioPart, StudioState, StudioTarget } from '../../engine/client/forgeStudio';
import { ACTIONS as FIGHT_ACTIONS, boundTo, isCapturingBinding } from '../../input/bindings';
import { StudioLibrary, itemKey, moveName, type ArmoryShelf } from './studioLibrary';
import { StudioInspector } from './studioInspector';
import { SLOT_WORDS, el, nameOf, slotKey, typing } from './studioDom';

export interface StudioHost {
  body: FighterId;
  playerId: string;
  dummyId: string;
  open?: boolean;
  dummyWas?: string;
  command(command: 'reset' | 'awakening' | 'passive' | 'combat' | { lab: 'behaviour'; value: string }): void;
  press(slot: AttackSlot): void;
  snapshot(): GameSnapshot | null;
  paused(): boolean;
}

const SPINNER_AFTER = 150;
const DUMMY_BACK = new Set(['combat', 'guard', 'after-hit']);
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} .'!?-]{0,23}$/u;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const frames = (count: number) => new Promise<void>(resolve => { let n = 0; const step = () => (++n >= count ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); });
const targetName = (target: StudioTarget) => target === 'aura' ? 'the aura' : `${slotKey(target)} (${SLOT_WORDS[target].toLowerCase()})`;

export class ForgeStudio {
  private state: StudioState;
  private readonly session = new ForgeSession();
  private ui?: { library: StudioLibrary; inspector: StudioInspector };
  private message = '';
  private readonly root: HTMLElement;
  private readonly openTab: HTMLButtonElement;
  private readonly defaultName: string;
  private target: StudioTarget = 'special';
  private open = false;
  private tries = 0;
  private busy?: { target: StudioTarget; key: string };
  private armory?: ArmoryRuntime;
  private effects: readonly ArmoryEffectInfo[] = [];
  private effectById = new Map<string, ArmoryEffectInfo>();
  private effectsKey = '';
  private shelf: ArmoryShelf = 'missing';
  private poll = 0;
  private dummyWas?: string;
  private disposed = false;

  constructor(private readonly host: StudioHost) {
    this.defaultName = Studio.defaultKitName(nameOf(host.body));
    this.state = Studio.startStudio(host.body, this.defaultName, this.draft());
    this.openTab = el('button', { type: 'button', className: 'fs-open-tab', title: 'Forge Studio (5): try any move and any effect on this body' },
      el('kbd', { textContent: '5' }), el('span', { textContent: 'FORGE' }));
    this.openTab.addEventListener('click', () => this.toggle(true));
    this.root = el('div', { className: 'forge-studio fs-closed' }, this.openTab);
    this.root.addEventListener('click', event => { const control = (event.target as HTMLElement).closest?.('button, summary'); if (control && event.detail > 0) (control as HTMLElement).blur(); });
    document.body.append(this.root);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('resize', this.fit);
    this.applyInPlay();
    this.checkRuntimes();
    this.render();
    this.say(Studio.isOwnKit(this.state.assigned) ? `Click a move or an effect to try it on ${nameOf(host.body)}. Enter keeps it.` : `${this.state.assigned.name} is back in play, as you kept it.`);
    if (typeof navigator === 'object' && navigator.webdriver) this.testHook();
    const shared = typeof location === 'object' ? new URLSearchParams(location.search).get('kit') : null;
    if (shared && /^[0-9a-f]{16}$/.test(shared)) void this.openShared(shared);
    if (host.open) this.toggle(true);
    if (this.open && host.dummyWas && !this.dummyWas) this.dummyWas = host.dummyWas;
  }
  get carried(): { open: boolean; dummyWas?: string } { return { open: this.open, dummyWas: this.dummyWas }; }


  private panels() {
    if (this.ui) return this.ui;
    const body = this.host.body;
    const library = new StudioLibrary({ onTry: item => void this.tryItem(item), onTab: () => this.checkRuntimes(), onWarm: item => this.warm(item), onSeen: id => transplantRuntime()?.prefetch?.(id) }, body);
    const inspector = new StudioInspector({
      onTarget: target => this.setTarget(target),
      onTune: (slot, key, value, final) => this.tune(slot, key, value, final),
      onStatus: (slot, status) => this.setStatus(slot, status),
      onLook: (target, change, final) => this.look(target, change, final),
      onOriginal: (target, part) => this.original(target, part),
      onTry: () => this.tryCursor(),
      onAssign: () => this.assign(),
      onUndo: () => this.undo(),
      onName: name => this.rename(name),
      onOnline: on => this.setOnline(on),
      onFight: () => { this.toggle(false); this.host.command('reset'); },
      onClose: () => this.toggle(false),
      onCopy: () => void this.copy(),
      onLoad: code => this.load(code),
      onKeep: () => void this.keep(),
      onKept: () => void this.listKept(),
    }, body);
    this.root.prepend(library.root, inspector.root);
    this.ui = { library, inspector };
    library.setEffects(this.effects, this.shelf);
    inspector.say(this.message);
    void this.root.offsetWidth;
    return this.ui;
  }

  toggle(open: boolean) {
    if (open === this.open || this.disposed) return;
    this.open = open;
    if (open) this.panels();
    this.root.classList.toggle('fs-closed', !open);
    document.body.classList.toggle('forge-studio-open', open);
    clearInterval(this.poll);
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock?.();
      this.fit();
      this.holdDummy();
      this.checkRuntimes();
      this.poll = window.setInterval(() => this.checkRuntimes(), 1000);
    } else this.releaseDummy();
    this.render();
  }
  private readonly fit = () => {
    if (!this.ui) return;
    const bar = document.querySelector('.combat-hud .move-bar')?.getBoundingClientRect(), panel = this.ui.inspector.root;
    const top = panel.getBoundingClientRect().top, lift = bar && bar.height ? Math.round(innerHeight - bar.top + 10) : 0;
    if (lift && bar!.right > innerWidth - panel.offsetWidth - 24 && innerHeight - lift - top >= 440) this.root.style.setProperty('--fs-cards', `${lift}px`);
    else this.root.style.removeProperty('--fs-cards');
  };
  private holdDummy() {
    const now = this.dummyBehaviour();
    if (!now || now === 'passive') return;
    this.dummyWas = now;
    this.host.command('passive');
  }
  private releaseDummy() {
    const was = this.dummyWas;
    this.dummyWas = undefined;
    if (!was || !DUMMY_BACK.has(was) || this.dummyBehaviour() !== 'passive') return;
    this.host.command(was === 'combat' ? 'combat' : { lab: 'behaviour', value: was });
  }
  private dummyBehaviour(): string | undefined {
    const snapshot = this.host.snapshot();
    return snapshot?.trainingLab?.behaviour ?? snapshot?.trainingBotMode;
  }

  private readonly onKey = (event: KeyboardEvent) => {
    if (this.disposed || isCapturingBinding() || this.host.paused()) return;
    const stop = () => { event.preventDefault(); event.stopPropagation(); };
    if (typing(event.target)) {
      if (event.code === 'Escape' && this.root.contains(event.target as Node)) { stop(); (event.target as HTMLElement).blur(); }
      return;
    }
    const modified = event.ctrlKey || event.metaKey || event.altKey;
    if ((event.code === 'Digit5' || event.code === 'Numpad5') && !modified) {
      if (FIGHT_ACTIONS.some(action => boundTo(action, event.code))) return;
      stop();
      if (!event.repeat) this.toggle(!this.open);
      return;
    }
    if (!this.open) return;
    if (event.code === 'KeyZ' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) { stop(); if (!event.repeat) this.undo(); return; }
    if (modified) return;
    const onSlider = !!(event.target as HTMLElement | null)?.closest?.('input[type=range]');
    switch (event.code) {
      case 'Escape': stop(); this.toggle(false); return;
      case 'ArrowUp': case 'ArrowDown': if (onSlider) return; stop(); this.ui?.library.move(event.code === 'ArrowDown' ? 1 : -1); return;
      case 'ArrowLeft': case 'ArrowRight': if (onSlider) return; stop(); this.ui?.library.jump(event.code === 'ArrowRight' ? 1 : -1); return;
      case 'Space': stop(); if (!event.repeat) this.tryCursor(); return;
      case 'Enter': case 'NumpadEnter': stop(); if (!event.repeat) this.assign(); return;
      case 'Slash': stop(); this.ui?.library.focusSearch(); return;
    }
  };


  private checkRuntimes() {
    if (this.disposed) return;
    const armory = armoryRuntime();
    let list: readonly ArmoryEffectInfo[] = [];
    if (armory) { try { list = armory.effects() ?? []; } catch (error) { console.warn('[forge] the Armory runtime could not list its effects', error); } }
    const key = `${list.length}:${list[0]?.id ?? ''}:${list[list.length - 1]?.id ?? ''}`;
    const shelf: ArmoryShelf = !armory ? 'missing' : list.length ? 'ready' : 'loading';
    const fresh = armory !== this.armory;
    if (!fresh && key === this.effectsKey && shelf === this.shelf) return;
    this.armory = armory;
    this.effects = list; this.effectsKey = key; this.shelf = shelf;
    this.effectById = new Map(list.map(info => [info.id, info]));
    this.ui?.library.setEffects(list, shelf);
    if (fresh && armory) this.prepareLooks();
    this.render();
  }
  private prepareLooks() {
    const kit = Studio.inPlay(this.state);
    for (const target of Studio.STUDIO_TARGETS) {
      const fx = Studio.lookOf(kit, target);
      if (fx) this.armory?.prepare(fx.effect).catch(error => console.warn(`[forge] ${fx.effect} could not be loaded`, error));
    }
  }


  private setTarget(target: StudioTarget) {
    if (target === this.target) return;
    this.target = target;
    if (this.state.trial && this.state.trial.target !== target) { this.tries++; this.state = Studio.dropTrial(this.state); this.applyInPlay(); }
    this.render();
    this.say(`${targetName(target)} is the target: what you try goes there.`);
  }

  private readonly warmed = new Set<string>();
  private warm(item: StudioItem) {
    const key = item.kind === 'move' ? `m:${item.from}:${item.fromSlot}` : `f:${item.effect}`;
    if (this.warmed.has(key)) return;
    this.warmed.add(key);
    const ready = item.kind === 'move' ? transplantRuntime()?.prepare(this.host.body, item.from, item.fromSlot) : this.armory?.prepare(item.effect);
    ready?.catch(() => this.warmed.delete(key));
  }
  private async tryItem(item: StudioItem) {
    if (this.disposed) return;
    const target = Studio.targetFor(this.target, item);
    this.target = target;
    this.state = Studio.tryItem(this.state, target, item);
    this.applyInPlay();
    const token = ++this.tries;
    this.render();
    this.say(`Trying ${this.describe(item)} on ${targetName(target)}. Enter keeps it.`);
    const ready = item.kind === 'move' ? transplantRuntime()?.prepare(this.host.body, item.from, item.fromSlot) : this.armory?.prepare(item.effect);
    if (item.kind === 'fx') this.ui?.inspector.reveal('look');
    if (await this.ready(token, target, itemKey(item), ready)) await this.play(target, token);
  }
  private tryCursor() {
    const item = this.ui?.library.cursorItem();
    if (item) void this.tryItem(item); else void this.play(this.target);
  }
  private async ready(token: number, target: StudioTarget, key: string, ready: Promise<void> | undefined) {
    if (ready) {
      const spin = window.setTimeout(() => { if (token === this.tries) { this.busy = { target, key }; this.render(); } }, SPINNER_AFTER);
      try { await ready; } catch (error) { console.warn('[forge] not ready', error); }
      clearTimeout(spin);
      if (this.busy?.key === key) { this.busy = undefined; this.render(); }
    }
    return token === this.tries && !this.disposed;
  }
  private async play(target: StudioTarget, token = ++this.tries) {
    if (this.disposed) return;
    this.host.command('reset');
    if (target === 'aura') {
      const fx = Studio.lookOf(Studio.inPlay(this.state), target), armory = this.armory;
      if (!fx || !armory) return;
      await frames(2);
      if (token !== this.tries || this.disposed) return;
      try { armory.preview(this.host.playerId, fx); } catch (error) { console.warn(`[forge] ${fx.effect} could not be previewed`, error); }
      return;
    }
    if (target === 'ultimate') this.host.command('awakening');
    this.host.press(target);
  }

  private assign() {
    const trial = this.state.trial;
    if (trial) {
      this.state = Studio.assignTrial(this.state);
      this.committed(`Kept: ${this.describe(trial.item)} on ${targetName(trial.target)}. Saved.`);
      return;
    }
    const item = this.ui?.library.cursorItem();
    if (!item) { this.say('Pick something in the library first: click it, or move to it with the arrow keys.'); return; }
    void this.tryItem(item);
    if (this.state.trial) this.assign();
  }
  private original(target: StudioTarget, part: StudioPart) {
    this.state = Studio.original(this.state, target, part);
    this.committed(part === 'move' ? `${targetName(target)} throws ${nameOf(this.host.body)}'s own move again.` : `${targetName(target)} wears its own look again.`);
    if (target !== 'aura') void this.play(target);
  }
  private undo() {
    if (!this.state.history.length && !this.state.trial) { this.say('Nothing to undo.'); return; }
    this.tries++;
    this.state = Studio.undo(this.state);
    this.committed('Undone: the kit is as it was before the last assignment.');
  }


  private tune(slot: AttackSlot, key: TuneKey, value: number, final: boolean) {
    this.state = Studio.edit(this.state, slot, Studio.withTune(slot, key, value), `tune:${slot}:${key}`);
    this.edited(slot, final);
  }
  private setStatus(slot: AttackSlot, status: ForgeStatus | undefined) {
    this.state = Studio.edit(this.state, slot, Studio.withStatus(slot, status));
    this.edited(slot, true);
  }
  private look(target: StudioTarget, change: { setting?: [string, number]; scale?: number; hue?: number }, final: boolean) {
    const edit = change.setting ? Studio.lookSetting(...change.setting) : change.scale !== undefined ? Studio.lookScale(change.scale) : Studio.lookHue(change.hue ?? 0);
    const key = change.setting ? `look:${target}:${change.setting[0]}` : `look:${target}:${change.scale !== undefined ? 'scale' : 'hue'}`;
    this.state = Studio.edit(this.state, target, Studio.withLook(target, edit), key);
    this.edited(target, final);
  }
  private rename(name: string) {
    this.state = Studio.edit(this.state, 'name', Studio.withName(name), 'name');
    this.applyInPlay(); this.save(); this.render();
  }
  private edited(target: StudioTarget, final: boolean) {
    this.applyInPlay(); this.save(); this.render();
    if (final) void this.play(target);
  }
  private setOnline(on: boolean) {
    setForgeOnline(this.host.body, on);
    this.render();
    const online = this.online();
    this.say(on ? online.fits ? `${this.state.assigned.name} goes with you into private rooms.` : `Turned on, but ${online.why}: private rooms get ${nameOf(this.host.body)}'s own kit until it fits.` : `Private rooms get ${nameOf(this.host.body)}'s own kit.`);
  }


  private playable(kit: ForgeKit): ForgeKit { return NAME.test(kit.name.trim()) ? kit : { ...kit, name: this.defaultName }; }
  private applyInPlay() {
    const kit = this.playable(Studio.inPlay(this.state));
    if (Studio.isOwnKit(kit)) { this.session.restore(); return; }
    const result = this.session.apply(kit);
    if (!result.ok) this.say(result.errors[0]);
  }
  private save() {
    const kit = this.playable(this.state.assigned);
    try {
      if (Studio.isOwnKit(kit) && kit.name.trim() === this.defaultName) localStorage.removeItem(forgeDraftKey(this.host.body));
      else localStorage.setItem(forgeDraftKey(this.host.body), encodeForge(kit));
    } catch { }
  }
  private committed(message: string) { this.applyInPlay(); this.save(); this.render(); this.say(message); }
  private draft(): ForgeKit | undefined {
    try {
      const code = localStorage.getItem(forgeDraftKey(this.host.body));
      const kit = code ? decodeForge(code) : undefined;
      return kit && kit.body === this.host.body && !forgeProblems(kit, { sandbox: true, availability: import.meta.env?.MODE === 'fighter-lab' ? 'laboratory' : 'released' }).errors.length ? kit : undefined;
    } catch { return undefined; }
  }
  private online(): { ratio: number; on: boolean; fits: boolean; why?: string } {
    const kit = this.playable(this.state.assigned);
    let ratio = NaN;
    try { ratio = budget(kit); } catch { }
    const errors = forgeProblems(kit, { availability: 'released' }).errors;
    const why = ratio > BUDGET_LIMIT ? `it is ${percent(ratio)} as strong as ${nameOf(this.host.body)}'s own kit (private rooms allow ${percent(BUDGET_LIMIT)})` : errors[0];
    return { ratio, on: forgeOnline(this.host.body), fits: !errors.length, why };
  }


  private render() {
    if (this.disposed) return;
    const kit = Studio.inPlay(this.state), trial = this.state.trial;
    this.openTab.classList.toggle('fs-forged', !Studio.isOwnKit(kit));
    if (!this.ui) return;
    let trialRatio: number | undefined;
    if (trial) { try { trialRatio = budget(this.playable(trial.kit)); } catch { trialRatio = undefined; } }
    const problems = forgeProblems(kit, { sandbox: true, availability: import.meta.env?.MODE === 'fighter-lab' ? 'laboratory' : 'released' });
    this.ui.library.setTarget(this.target);
    this.ui.inspector.render({
      body: this.host.body, kit, trial, target: this.target, busy: this.busy?.target, canUndo: this.state.history.length > 0, armory: this.shelf,
      effect: id => this.effectById.get(id), problems: [...problems.errors, ...problems.warnings], online: this.online(), trialRatio,
    });
    this.ui.library.setMarks(this.marks(), trial ? itemKey(trial.item) : undefined, this.busy?.key);
  }
  private marks() {
    const kit = this.state.assigned, marks = new Map<string, string>();
    const add = (key: string, mark: string) => marks.set(key, marks.has(key) ? `${marks.get(key)} ${mark}` : mark);
    for (const target of Studio.STUDIO_TARGETS) {
      if (target !== 'aura') { const source = pickSource(target, kitPick(kit, target)); add(`m:${source.fighter}:${source.slot}`, slotKey(target)); }
      const fx = Studio.lookOf(kit, target);
      if (fx) add(`f:${fx.effect}`, target === 'aura' ? 'AURA' : slotKey(target));
    }
    return marks;
  }
  private describe(item: StudioItem) {
    return item.kind === 'move' ? `${moveName(item.from, item.fromSlot)} (${nameOf(item.from)}'s ${slotKey(item.fromSlot)})` : this.effectById.get(item.effect)?.label ?? item.effect;
  }
  private say(text: string) { this.message = text; this.ui?.inspector.say(text); }


  private async copy() {
    const code = encodeForge(this.playable(this.state.assigned));
    try { await navigator.clipboard.writeText(code); this.say('Code copied. Anyone can load it in this body\'s Forge.'); }
    catch { const box = this.panels().inspector.code; box.value = code; box.select(); this.say('The code is in the box: copy it from there.'); }
  }
  private load(code: string) {
    try {
      const kit = decodeForge(code);
      if (kit.body !== this.host.body) { this.say(`That kit is for ${nameOf(kit.body)}'s body: start Training as ${nameOf(kit.body)} to load it.`); return; }
      const { errors } = forgeProblems(kit, { sandbox: true, availability: import.meta.env?.MODE === 'fighter-lab' ? 'laboratory' : 'released' });
      if (errors.length) { this.say(errors[0]); return; }
      this.tries++;
      this.state = Studio.loadKit(this.state, kit);
      if (this.ui) this.ui.inspector.code.value = '';
      this.committed(`Loaded ${kit.name}. Saved; Ctrl+Z takes it back.`);
    } catch (error) { this.say((error as Error).message); }
  }
  private async keep() {
    try {
      const kept = await saveForged(encodeForge(this.playable(this.state.assigned))), link = shareLink(kept.hash);
      try { await navigator.clipboard.writeText(link); this.say(`${kept.name} is kept on your account. Share link copied.`); }
      catch { this.panels().inspector.code.value = link; this.say(`${kept.name} is kept on your account. Its share link is in the box.`); }
    } catch (error) { this.say((error as Error).message); }
  }
  private async listKept() {
    try { this.showKept(await keptForged()); } catch (error) { this.say((error as Error).message); }
  }
  private showKept(kept: KeptFighter[]) {
    const act = (text: string, action: () => void, disabled = false) => { const b = el('button', { type: 'button', textContent: text, disabled }); b.addEventListener('click', action); return b; };
    this.panels().inspector.keptList.replaceChildren(...kept.map(fighter => el('li', {},
      el('span', { textContent: `${fighter.name} · ${nameOf(fighter.body)}` }),
      act('LOAD', () => this.load(fighter.code), fighter.body !== this.host.body),
      act('LINK', () => { void navigator.clipboard.writeText(shareLink(fighter.hash)).then(() => this.say('Share link copied.'), () => { this.panels().inspector.code.value = shareLink(fighter.hash); this.say('The share link is in the box.'); }); }),
      act('REMOVE', () => { void removeForged(fighter.hash).then(rest => { this.showKept(rest); this.say(`${fighter.name} is removed.`); }, (error: Error) => this.say(error.message)); }))));
    if (!kept.length) this.say('No forged fighters kept on this account yet.');
  }
  private async openShared(hash: string) {
    try {
      const shared = await sharedForged(hash);
      if (this.disposed) return;
      this.toggle(true);
      if (shared.body !== this.host.body) { this.say(`That shared fighter is for ${nameOf(shared.body)}'s body: start Training as ${nameOf(shared.body)} to try it.`); return; }
      this.load(shared.code);
      this.say(`Loaded ${shared.name} from a share link. Saved; Ctrl+Z takes it back.`);
    } catch (error) { this.say((error as Error).message); }
  }

  private testHook() {
    (window as unknown as { __forgeStudio?: unknown }).__forgeStudio = {
      registerArmory, registerTransplant, armoryRuntime, transplantRuntime,
      state: () => this.state, target: () => this.target, isOpen: () => this.open, kit: () => activeKit(this.host.body),
    };
  }

  dispose() {
    this.disposed = true;
    this.tries++;
    clearInterval(this.poll);
    this.session.restore();
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('resize', this.fit);
    document.body.classList.remove('forge-studio-open');
    this.ui?.library.dispose(); this.ui?.inspector.dispose();
    this.root.remove();
    const hook = window as unknown as { __forgeStudio?: unknown };
    if (hook.__forgeStudio) delete hook.__forgeStudio;
  }
}
