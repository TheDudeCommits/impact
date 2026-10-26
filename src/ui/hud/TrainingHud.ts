import { TrainingLabPanel } from './TrainingLabPanel';
import { swapOrder, swapPicker, TrainingSwapPicker } from './TrainingSwapPicker';
import { stepFighter, SWAP_LAB, SWAP_SIDES, type SwapRequest, type SwapSide } from './trainingSwap';
import { FIGHTERS } from '../../config';
import type { CombatEvent, FighterId, GameSnapshot } from '../../game/types';
import { ACTIONS, boundTo, COMBAT_ACTIONS, getBindings, isCapturingBinding } from '../../input/bindings';
import { actionControl, padKey } from '../../input/glyphs';
import { fighterCaption } from '../MangaHome';
import { setTrainingDummy, trainingDummy, type DummyMode } from '../modes/prefs';
import { prompt, promptKey, type PromptAction } from '../prompts';
import type { ModeHud, ModeHudFrame, ModeHudMount } from './modeHud';
import { attr, el, PromptWatch, setHtml, setText } from './mainHudKit';
import { InputDisplay, shownKey, stickSector } from './trainingInputs';
import { ComboTracker, DEFENCE_TRIALS, defenceTrialOf, SECTION_TITLES, TRIAL_SECTIONS, trialOf, trialsFor, type DefenceTrialId, type Trial, type TrialSection } from './trainingTrials';
import './trainingHud.css';
import './trainingHalo.css';

export function createTrainingHud(): ModeHud { return new TrainingHud(); }

export function trainingPresentation(frame: Pick<ModeHudFrame, 'self' | 'phase' | 'snapshot'>, inspecting = false) {
  const { self, phase, snapshot } = frame;
  if (phase !== 'active' || !self.alive || inspecting || snapshot.trainingLab?.frozen) return undefined;
  if (self.action === 'awaken') return 'awaken';
  if (self.action === 'ultimate' && self.confirmedAt !== undefined && self.whiffedAt === undefined) return 'ultimate';
  return undefined;
}

type Tool = 'dummy' | 'reset' | 'meters' | 'inputs';
const TOOLS: readonly { tool: Tool; key: PromptAction; verb: string }[] = [
  { tool: 'dummy', key: 'quick1', verb: 'DUMMY' }, { tool: 'reset', key: 'quick2', verb: 'RESET' },
  { tool: 'meters', key: 'quick3', verb: 'FILL METERS' }, { tool: 'inputs', key: 'quick4', verb: 'INPUTS' },
];
const TOOL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'], TOOL_NUMPAD = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'];
const DPAD = [12, 15, 13, 14];
const INPUTS_KEY = 'rift-training-inputs';
const DUMMY_WORDS: Readonly<Record<DummyMode, string>> = { passive: 'PASSIVE', combat: 'FIGHTING BACK' };
const SWING_MS: Readonly<Record<string, number>> = { light: 900, heavy: 1300, special: 2200, ultimate: 4000, area: 4000 };
const PENDING_MS = 1500;
const SWAP_KEYS: Readonly<Record<string, readonly [SwapSide, -1 | 0 | 1]>> = {
  Digit6: ['self', 0], Numpad6: ['self', 0], Digit7: ['opponent', 0], Numpad7: ['opponent', 0],
  Digit9: ['self', -1], Digit0: ['self', 1], Minus: ['opponent', -1], Equal: ['opponent', 1],
};
const SWAP_WORDS: Readonly<Record<SwapSide, string>> = { self: 'FIGHTER', opponent: 'OPPONENT' };
const SWAP_KEY_NAMES: Readonly<Record<SwapSide, readonly [open: string, previous: string, next: string]>> = { self: ['6', '9', '0'], opponent: ['7', '−', '='] };
const PAD_SWAP = 8;
const STEP_SETTLE_MS = 260;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const comboHtml = (hits: number, damage: number) => `<strong>${hits}</strong> <i>HIT${hits === 1 ? '' : 'S'}</i> <span class="sep">·</span> <strong>${Math.round(damage)}</strong> <i class="dmg">DMG</i>`;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { } };

class TrainingHud implements ModeHud {
  private root!: HTMLElement;
  private lab!: TrainingLabPanel;
  private bar!: HTMLElement;
  private readonly toolNodes = new Map<Tool, HTMLButtonElement>();
  private chip!: HTMLElement; private chipWord!: HTMLElement;
  private combo!: HTMLElement; private comboLast!: HTMLElement; private comboBest!: HTMLElement;
  private trialsNode!: HTMLElement; private trialsWho!: HTMLElement; private trialsCount!: HTMLElement;
  private readonly rows = new Map<string, HTMLElement>();
  private readonly sections = new Map<TrialSection, { node: HTMLElement; count: HTMLElement; total: number }>();
  private defence?: HTMLElement; private defenceCount?: HTMLElement;
  private readonly defenceRows = new Map<DefenceTrialId, HTMLElement>();
  private readonly defenceDone = new Set<DefenceTrialId>();
  private inputs!: InputDisplay;
  private readonly watch = new PromptWatch();
  private readonly tracker = new ComboTracker();
  private comboKey = '';
  private trials: Trial[] = [];
  private readonly done = new Set<string>();
  private fighter = '';
  private selfId = '';
  private device: Pick<ModeHudFrame, 'input' | 'family'> = { input: 'keyboard', family: 'generic' };
  private live = false;
  private shownDummy?: DummyMode;
  private labDrill = false;
  private pendingDummy?: DummyMode; private pendingAt = -Infinity;
  private inputsOn = read(INPUTS_KEY) === '1';
  private castSeq = -1; private castAir = false;
  private swing?: { seq: number; slot: string; at: number };
  private missed!: HTMLElement; private missedUntil = 0;
  private raf = 0;
  private readonly padHeld: boolean[] = [];
  private stickWas = -1;
  private picker!: TrainingSwapPicker;
  private readonly swapNodes = new Map<SwapSide, { group: HTMLElement; open: HTMLButtonElement; steps: readonly HTMLButtonElement[] }>();
  private pair: Partial<Record<SwapSide, FighterId>> = {};
  private readonly stepping: Partial<Record<SwapSide, { fighter: FighterId; timer: number }>> = {};
  private padChord = false;
  private swapWords = ''; private fitDue = 0;
  private readonly fitBar = () => {
    this.fitDue = 0;
    const bar = this.bar; if (!bar?.isConnected) return;
    attr(bar, 'rows', undefined);
    const at = bar.getBoundingClientRect(), own = this.root.querySelector('.fighter-meter.own')?.getBoundingClientRect(), foe = this.root.querySelector('.fighter-meter.foe')?.getBoundingClientRect();
    const beside = (plate?: DOMRect) => !!plate && plate.width > 0 && plate.bottom > at.top + 4 && plate.top < at.bottom - 4;
    const room = beside(own) && beside(foe) ? foe!.left - own!.right - 16 : (this.root.clientWidth || innerWidth) - 20;
    attr(bar, 'rows', bar.scrollWidth > room ? '2' : undefined);
  };
  private readonly wantFit = () => { if (!this.fitDue && typeof requestAnimationFrame === 'function') this.fitDue = requestAnimationFrame(this.fitBar); };

  private readonly onKey = (event: KeyboardEvent) => {
    if (swapPicker.open) return;
    if (event.repeat || isCapturingBinding() || (event.target as HTMLElement | null)?.matches?.('input,select,textarea')) return;
    let tool = TOOL_KEYS.indexOf(event.code); if (tool < 0) tool = TOOL_NUMPAD.indexOf(event.code);
    if (tool >= 0 && !ACTIONS.some(action => boundTo(action, event.code))) {
      if (!this.toolsLive()) return;
      event.preventDefault(); this.use(TOOLS[tool].tool); return;
    }
    const swap = SWAP_KEYS[event.code];
    if (swap && !event.ctrlKey && !event.metaKey && !event.altKey && !ACTIONS.some(action => boundTo(action, event.code))) {
      if (!this.toolsLive() || !this.pair[swap[0]]) return;
      event.preventDefault();
      if (swap[1]) this.step(swap[0], swap[1]); else this.picker.show(swap[0]);
      return;
    }
    if (this.inputsOn && this.toolsLive() && shownKey(event.code)) this.inputs.key(event.code);
  };
  private readonly onPickerKey = (event: KeyboardEvent) => { if (swapPicker.open && !isCapturingBinding()) this.picker.key(event); };
  private readonly onSwapOpen = (event: Event) => { const side = (event as CustomEvent<SwapSide>).detail; if (this.pair[side]) this.picker.show(side); };
  private readonly onMouse = (event: MouseEvent) => {
    const code = `Mouse${event.button}`;
    if (this.inputsOn && document.pointerLockElement && this.toolsLive() && shownKey(code)) this.inputs.key(code);
  };
  private readonly padLoop = () => {
    this.raf = requestAnimationFrame(this.padLoop);
    const pad = firstPad(); if (!pad) return;
    const live = this.toolsLive();
    const swap = !!pad.buttons[PAD_SWAP]?.pressed;
    if (swap && !this.padHeld[PAD_SWAP]) this.padChord = false;
    if (!swap && this.padHeld[PAD_SWAP] && !this.padChord) { if (swapPicker.open) this.picker.close(); else if (live && this.pair.self) this.picker.show('self'); }
    this.padHeld[PAD_SWAP] = swap;
    for (let i = 0; i < 4; i++) {
      const down = !!pad.buttons[DPAD[i]]?.pressed;
      if (down && !this.padHeld[DPAD[i]] && live) {
        if (!swap) this.use(TOOLS[i].tool);
        else { this.padChord = true; const side: SwapSide = i % 2 ? 'self' : 'opponent'; if (this.pair[side]) this.step(side, i === 1 || i === 2 ? 1 : -1); }
      }
      this.padHeld[DPAD[i]] = down;
    }
    const bindings = getBindings().controller;
    for (const action of COMBAT_ACTIONS) {
      if (action === 'awaken') continue;
      const index = bindings[action], button = pad.buttons[index];
      const down = !!button && (index === 6 || index === 7 ? button.value >= .55 : button.pressed);
      if (down && !this.padHeld[index] && live && this.inputsOn) this.inputs.pad(actionControl(action), this.device.family);
      this.padHeld[index] = down;
    }
    const sector = stickSector(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    if (sector !== this.stickWas && sector >= 0 && live && this.inputsOn) this.inputs.stick(sector);
    this.stickWas = sector;
  };

  mount(m: ModeHudMount) {
    this.root = m.root;this.lab=new TrainingLabPanel();
    this.bar = el('div', 'th-tools'); this.bar.setAttribute('role', 'toolbar'); this.bar.setAttribute('aria-label', 'Training tools');
    for (const { tool } of TOOLS) {
      const button = el('button', 'th-tool'); button.type = 'button'; button.dataset.tool = tool;
      button.addEventListener('click', () => this.use(tool));
      this.bar.append(button); this.toolNodes.set(tool, button);
    }
    for (const side of SWAP_SIDES) {
      const group = el('div', 'th-swap'); group.dataset.side = side; group.setAttribute('role', 'group'); group.setAttribute('aria-label', side === 'self' ? 'Your fighter' : 'Sparring opponent');
      const arrow = (direction: -1 | 1) => { const b = el('button', 'th-step', direction < 0 ? '‹' : '›'); b.type = 'button'; b.dataset.step = String(direction); b.addEventListener('click', () => { if (this.toolsLive()) this.step(side, direction); }); return b; };
      const open = el('button', 'th-tool th-swap-open'); open.type = 'button'; open.dataset.tool = side === 'self' ? 'fighter' : 'opponent';
      open.addEventListener('click', () => { if (this.pair[side] && this.live) this.picker.toggle(side); });
      const steps = [arrow(-1), arrow(1)];
      group.append(steps[0], open, steps[1]); group.hidden = true;
      if (side === 'self') this.bar.prepend(group); else this.bar.append(group);
      this.swapNodes.set(side, { group, open, steps });
    }
    this.picker = new TrainingSwapPicker({ pair: () => this.pair, pending: side => this.waiting(side), choose: (side, fighter, random) => this.choose(side, fighter, random) });
    this.root.append(this.picker.node);
    m.zone('2').append(this.bar);
    m.zone('8').append(this.lab.node);
    this.toolNodes.get('inputs')!.classList.toggle('on', this.inputsOn);
    this.chip = el('div', 'training-dummy'); this.chipWord = el('b');
    this.chip.append(el('small', '', 'DUMMY'), this.chipWord);
    this.combo = el('div', 'training-combo'); this.comboLast = el('b'); this.comboBest = el('b');
    this.combo.append(el('small', '', 'LAST COMBO'), this.comboLast, el('small', '', 'BEST'), this.comboBest);
    m.zone('3b').append(this.chip, this.combo);
    this.trialsNode = el('section', 'training-trials'); this.trialsNode.setAttribute('aria-label', 'Move trials');
    m.zone('8b').append(this.trialsNode);
    this.inputs = new InputDisplay(m.zone('5'));
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keydown', this.onPickerKey, true);
    window.addEventListener('resize', this.wantFit);
    window.addEventListener('mousedown', this.onMouse);
    this.root.addEventListener('training-swap-open', this.onSwapOpen);
    this.drawCombo();
  }

  update(f: ModeHudFrame) {
    const { snapshot: s, self, phase } = f;
    this.selfId = self.id; this.live = phase === 'active';
    if (self.fighter !== this.fighter) { if (this.fighter) { this.tracker.reset(); this.drawCombo(); this.swing = undefined; this.castSeq = -1; } this.buildTrials(self.fighter); }
    this.pair = { self: self.fighter, opponent: s.players.find(p => p.id !== self.id && p.isBot && !p.enemy)?.fighter };
    if (this.watch.changed(f)) { this.device = { input: f.input, family: f.family }; this.drawPrompts(); }
    this.drawSwaps();
    this.picker.update();
    if (swapPicker.open && !this.live) this.picker.close(false);
    if (f.input === 'controller' && !this.raf) this.raf = requestAnimationFrame(this.padLoop);
    else if (f.input !== 'controller' && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.drawDummy(s, f.now);
    this.lab.update(s);
    attr(this.root, 'trainingPresentation', trainingPresentation(f, this.lab.node.open));
    this.drawTool('dummy');
    if(s.trainingLab){const names:Record<string,string>={'guard':'ALWAYS BLOCK','after-hit':'BLOCK AFTER HIT','playback':'PLAYBACK','punish':'PUNISH DRILL'};const word=s.trainingLab.recording?'RECORDING DUMMY':names[s.trainingLab.behaviour];if(word){setText(this.chipWord,word);setHtml(this.toolNodes.get('dummy')!,prompt('quick1','DUMMY',{device:this.device.input,family:this.device.family,detail:word}));}}
    this.labDrill=s.trainingLab?.behaviour==='punish';this.drawDefence();
    this.inputs.visible = this.inputsOn && phase === 'active';
    if (this.swing && f.now - this.swing.at > (SWING_MS[this.swing.slot] ?? 1200)) this.miss();
    if (this.missedUntil && f.now > this.missedUntil) { this.missedUntil = 0; this.missed.hidden = true; }
  }
  private miss() {
    this.swing = undefined;
    if (!this.missed || this.trials.every(t => this.done.has(t.id))) return;
    this.missed.hidden = false; this.missed.classList.remove('flash'); void this.missed.offsetWidth; this.missed.classList.add('flash');
    this.missedUntil = performance.now() + 1800;
  }

  event(event: CombatEvent, snapshot: GameSnapshot) {
    const self = this.selfId;
    const defence = defenceTrialOf(event, self);
    if (defence) { this.tickDefence(defence); return; }
    if (event.actorId !== self) return;
    if (event.kind === 'cast') {
      const me = snapshot.players.find(p => p.id === self);
      this.castSeq = event.actionSeq ?? -1; this.castAir = !!me && !me.grounded;
      if (event.slot) this.swing = { seq: event.actionSeq ?? -1, slot: event.slot, at: performance.now() };
      return;
    }
    if ((event.kind === 'hit' || event.kind === 'blocked' || event.kind === 'just-guard' || event.kind === 'guard-break') && event.targetId && event.targetId !== self) this.swing = undefined;
    if (event.kind === 'whiff' && event.slot === 'ultimate') this.miss();
    if (event.kind === 'awaken') { this.tick('awaken'); return; }
    if (event.kind !== 'hit' || !event.targetId || event.targetId === self) return;
    this.tracker.hit(event.combo, event.damage ?? 0, event.serverTime);
    this.drawCombo();
    const air = event.actionSeq !== undefined && event.actionSeq === this.castSeq ? this.castAir : !snapshot.players.find(p => p.id === self)?.grounded;
    const id = trialOf(event, air);
    if (id) this.tick(id);
  }

  unmount() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keydown', this.onPickerKey, true);
    window.removeEventListener('resize', this.wantFit);
    if (this.fitDue) cancelAnimationFrame(this.fitDue); this.fitDue = 0;
    window.removeEventListener('mousedown', this.onMouse);
    this.root?.removeEventListener('training-swap-open', this.onSwapOpen);
    for (const side of SWAP_SIDES) { window.clearTimeout(this.stepping[side]?.timer); delete this.stepping[side]; }
    this.picker?.dispose();
    if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0;
    for (const node of [this.lab?.node, this.bar, this.chip, this.combo, this.trialsNode, this.inputs?.node]) node?.remove();
    if (this.root) { attr(this.root, 'trainingDummy', undefined); attr(this.root, 'trainingPresentation', undefined); }
  }

  private toolsLive() {
    return this.live && !swapPicker.open && !!this.root && !this.root.querySelector('.combat-hud.hidden')
      && !document.querySelector('.settings-scrim:not(.hidden), #results:not(.hidden), dialog[open]');
  }

  private waiting(side: SwapSide): FighterId | undefined {
    const asked = this.root?.dataset[side === 'self' ? 'swapSelf' : 'swapOpponent'];
    return this.stepping[side]?.fighter ?? (asked && asked in FIGHTERS ? asked as FighterId : undefined);
  }
  private choose(side: SwapSide, fighter: FighterId, random = false) {
    window.clearTimeout(this.stepping[side]?.timer); delete this.stepping[side];
    const detail: SwapRequest = { lab: SWAP_LAB[side], value: fighter, ...(random ? { random } : {}) };
    this.root.dispatchEvent(new CustomEvent('training-lab', { bubbles: true, detail }));
    const button = this.swapNodes.get(side)?.open;
    if (button) { button.classList.remove('fired'); void button.offsetWidth; button.classList.add('fired'); }
    this.drawSwaps();
  }
  private step(side: SwapSide, direction: -1 | 1) {
    const next = stepFighter(swapOrder(side), this.waiting(side) ?? this.pair[side], direction);
    if (!next) return;
    window.clearTimeout(this.stepping[side]?.timer);
    this.stepping[side] = { fighter: next, timer: window.setTimeout(() => { if (this.stepping[side]?.fighter === next) this.choose(side, next); }, STEP_SETTLE_MS) };
    this.drawSwaps();
  }
  private drawSwaps() {
    let words = '';
    for (const side of SWAP_SIDES) {
      const nodes = this.swapNodes.get(side); if (!nodes) continue;
      const now = this.pair[side], coming = this.waiting(side), loading = !!coming && coming !== now;
      if (nodes.group.hidden === !!now) nodes.group.hidden = !now;
      words += `${now}|${loading ? coming : ''}|`;
      if (!now) continue;
      attr(nodes.group, 'loading', loading ? '' : undefined);
      const { input, family } = this.device, names = SWAP_KEY_NAMES[side];
      const cap = input === 'controller' ? padKey(family, 'select') + (side === 'opponent' ? padKey(family, 'north') : '') : input === 'touch' ? '' : `<kbd>${names[0]}</kbd>`;
      const who = fighterCaption(loading ? coming! : now);
      setHtml(nodes.open, `<span class="ux-prompt"${cap ? '' : ' data-keyless'}>${cap}<b>${SWAP_WORDS[side]}</b><small>${loading ? '<i>LOADING</i> ' : ''}${escapeHtml(who)}</small></span>`);
      const label = `${side === 'self' ? 'Your fighter' : 'Sparring opponent'}: ${FIGHTERS[now]?.name ?? now}${loading ? `, loading ${FIGHTERS[coming!]?.name ?? coming}` : ''}. Open the roster`;
      if (nodes.open.getAttribute('aria-label') !== label) nodes.open.setAttribute('aria-label', label);
      nodes.steps.forEach(arrow => {
        const previous = arrow.dataset.step === '-1', title = `${previous ? 'Previous' : 'Next'} ${side === 'self' ? 'fighter' : 'opponent'}${input === 'keyboard' ? ` (${names[previous ? 1 : 2]})` : ''}`;
        if (arrow.title !== title) { arrow.title = title; arrow.setAttribute('aria-label', title); }
      });
    }
    words += `${this.device.input}|${this.device.family}`;
    if (words !== this.swapWords) { this.swapWords = words; this.wantFit(); }
  }
  private use(tool: Tool) {
    const button = this.toolNodes.get(tool);
    if (button) { button.classList.remove('fired'); void button.offsetWidth; button.classList.add('fired'); }
    if (tool === 'dummy') {
      const next: DummyMode = (this.shownDummy ?? trainingDummy()) === 'passive' ? 'combat' : 'passive';
      setTrainingDummy(next); this.command(next);
      this.pendingDummy = next; this.pendingAt = performance.now(); this.showDummy(next);
    } else if (tool === 'reset') this.command('reset');
    else if (tool === 'meters') this.command('awakening');
    else {
      this.inputsOn = !this.inputsOn; write(INPUTS_KEY, this.inputsOn ? '1' : '0');
      if (!this.inputsOn) this.inputs.clear();
      this.toolNodes.get('inputs')?.classList.toggle('on', this.inputsOn);
    }
  }
  private command(command: 'passive' | 'combat' | 'reset' | 'awakening') {
    this.root.querySelector<HTMLButtonElement>(`[data-training="${command}"]`)?.click();
  }
  private drawDummy(s: GameSnapshot, now: number) {
    if (this.pendingDummy && (s.trainingBotMode === this.pendingDummy || now - this.pendingAt > PENDING_MS)) this.pendingDummy = undefined;
    this.showDummy(this.pendingDummy ?? s.trainingBotMode ?? trainingDummy());
  }
  private showDummy(mode: DummyMode) {
    if (mode === this.shownDummy) return;
    this.shownDummy = mode;
    setText(this.chipWord, DUMMY_WORDS[mode]);
    attr(this.root, 'trainingDummy', mode);
    this.drawTool('dummy'); this.drawDefence();
  }
  private drawTool(tool: Tool) {
    const spec = TOOLS.find(t => t.tool === tool)!, button = this.toolNodes.get(tool)!;
    const detail = tool === 'dummy' ? DUMMY_WORDS[this.shownDummy ?? trainingDummy()] : undefined;
    setHtml(button, prompt(spec.key, spec.verb, { device: this.device.input, family: this.device.family, detail }));
  }
  private drawPrompts() {
    for (const { tool } of TOOLS) this.drawTool(tool);
    for (const trial of this.trials) { const keys = this.rows.get(trial.id)?.querySelector<HTMLElement>('.trial-keys'); if (keys) setHtml(keys, this.keysOf(trial.inputs)); }
    for (const trial of DEFENCE_TRIALS) { const keys = this.defenceRows.get(trial.id)?.querySelector<HTMLElement>('.trial-keys'); if (keys) setHtml(keys, this.defenceKeysOf(trial.keyed)); }
    this.drawDefence();
  }

  private drawCombo() {
    const t = this.tracker, key = `${t.hits}|${Math.round(t.damage)}|${t.bestHits}|${Math.round(t.bestDamage)}`;
    if (key === this.comboKey) return;
    this.comboKey = key;
    setHtml(this.comboLast, t.hits ? comboHtml(t.hits, t.damage) : '—');
    setHtml(this.comboBest, t.bestHits ? comboHtml(t.bestHits, t.bestDamage) : '—');
  }

  private keysOf(inputs: Trial['inputs']) {
    const device = { device: this.device.input, family: this.device.family };
    return inputs.map(press => promptKey(press, device)).join('<i>+</i>');
  }
  private buildTrials(fighter: FighterId) {
    this.fighter = fighter; this.trials = trialsFor(fighter); this.done.clear(); this.rows.clear(); this.sections.clear();
    const head = el('header'); this.trialsWho = el('span'); this.trialsCount = el('em');
    head.append(el('b', '', 'MOVE TRIALS'), this.trialsWho, this.trialsCount);
    this.missed = el('p', 'trial-missed', 'MISSED · GET IN RANGE'); this.missed.hidden = true; this.missed.setAttribute('role', 'status');
    head.append(this.missed);
    setText(this.trialsWho, FIGHTERS[fighter]?.name.toUpperCase() ?? '');
    const parts: HTMLElement[] = [head];
    for (const section of TRIAL_SECTIONS) {
      const rows = this.trials.filter(t => t.section === section);
      if (!rows.length) continue;
      const node = el('div', 'trial-section'); node.dataset.section = section;
      const title = el('h5'), count = el('small'); title.append(el('span', '', SECTION_TITLES[section]), count);
      const list = el('ol');
      for (const trial of rows) {
        const row = el('li'); row.dataset.trial = trial.id;
        const keys = el('span', 'trial-keys'); setHtml(keys, this.keysOf(trial.inputs));
        const name = el('span', 'trial-name'); name.textContent = trial.name;
        row.append(keys, name, el('i', 'trial-mark'));
        list.append(row); this.rows.set(trial.id, row);
      }
      node.append(title, list); parts.push(node);
      this.sections.set(section, { node, count, total: rows.length });
    }
    this.defenceRows.clear(); this.defenceDone.clear();
    const defence = el('div', 'trial-section trial-defence'); defence.dataset.section = 'defence';
    const title = el('h5'); this.defenceCount = el('small'); title.append(el('span', '', 'DEFENCE'), this.defenceCount);
    const list = el('ol');
    for (const trial of DEFENCE_TRIALS) {
      const row = el('li'); row.dataset.trial = trial.id;
      const keys = el('span', 'trial-keys'); setHtml(keys, this.defenceKeysOf(trial.keyed));
      const name = el('span', 'trial-name'); name.textContent = trial.name;
      row.append(keys, name, el('small', 'trial-how', trial.how.toUpperCase()), el('i', 'trial-mark'));
      list.append(row); this.defenceRows.set(trial.id, row);
    }
    defence.append(title, list); parts.push(defence); this.defence = defence;
    this.trialsNode.replaceChildren(...parts);
    this.drawTrials(); this.drawDefence();
  }
  private defenceKeysOf(keyed: boolean) {
    return keyed ? promptKey('guard', { device: this.device.input, family: this.device.family }) : '<i>—</i>';
  }
  private tickDefence(id: DefenceTrialId) {
    const row = this.defenceRows.get(id);
    if (!row || this.defenceDone.has(id)) return;
    this.defenceDone.add(id);
    row.classList.add('done'); row.classList.remove('landed'); void row.offsetWidth; row.classList.add('landed');
    this.drawDefence();
  }
  private drawDefence() {
    if (!this.defence || !this.defenceCount) return;
    const fighting = this.labDrill || (this.shownDummy ?? trainingDummy()) === 'combat', all = this.defenceDone.size === DEFENCE_TRIALS.length;
    this.defence.classList.toggle('open', fighting);
    this.defence.classList.toggle('complete', all);
    setHtml(this.defenceCount, fighting || all ? `${this.defenceDone.size}/${DEFENCE_TRIALS.length}` : `${promptKey('quick1', { device: this.device.input, family: this.device.family })} FIGHTING BACK`);
  }
  private tick(id: string) {
    if (this.done.has(id) || !this.rows.has(id)) return;
    this.done.add(id);
    const row = this.rows.get(id)!;
    row.classList.add('done'); row.classList.remove('landed'); void row.offsetWidth; row.classList.add('landed');
    this.drawTrials();
  }
  private drawTrials() {
    const next = this.trials.find(t => !this.done.has(t.id));
    for (const trial of this.trials) this.rows.get(trial.id)?.classList.toggle('next', trial === next);
    for (const [section, { node, count, total }] of this.sections) {
      let landed = 0; for (const trial of this.trials) if (trial.section === section && this.done.has(trial.id)) landed++;
      setText(count, `${landed}/${total}`);
      node.classList.toggle('open', next?.section === section);
      node.classList.toggle('complete', landed === total);
    }
    setText(this.trialsCount, next ? `${this.done.size} / ${this.trials.length}` : 'ALL LANDED');
    this.trialsNode.classList.toggle('complete', !next);
  }
}

function firstPad() {
  if (typeof navigator !== 'object' || typeof navigator.getGamepads !== 'function') return undefined;
  for (const pad of navigator.getGamepads()) if (pad?.connected && pad.mapping === 'standard') return pad;
  return undefined;
}
