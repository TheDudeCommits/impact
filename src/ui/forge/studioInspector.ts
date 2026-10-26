import type { AttackSlot, FighterId } from '../../game/types';
import { BUDGET_LIMIT, TUNE_LIMITS, kitPick, pickSource, type ForgeFx, type ForgeKit, type ForgeStatus, type TuneKey } from '../../engine/sim/forge';
import type { ArmoryEffectInfo } from '../../engine/client/forgeLive';
import { STUDIO_TARGETS, changed, lookOf, type StudioPart, type StudioTarget, type StudioTrial } from '../../engine/client/forgeStudio';
import { LazyPictures, SLOT_WORDS, button, el, facesOf, nameOf, slotKey, targetLabel } from './studioDom';
import { kitLabel, moveName, schoolOf, type ArmoryShelf } from './studioLibrary';

export interface InspectorView {
  body: FighterId;
  kit: ForgeKit;
  trial?: StudioTrial;
  target: StudioTarget;
  busy?: StudioTarget;
  canUndo: boolean;
  armory: ArmoryShelf;
  effect(id: string): ArmoryEffectInfo | undefined;
  problems: readonly string[];
  online: { ratio: number; on: boolean; fits: boolean; why?: string };
  trialRatio?: number;
}
export interface InspectorHooks {
  onTarget(target: StudioTarget): void;
  onTune(slot: AttackSlot, key: TuneKey, value: number, final: boolean): void;
  onStatus(slot: AttackSlot, status: ForgeStatus | undefined): void;
  onLook(target: StudioTarget, change: { setting?: [string, number]; scale?: number; hue?: number }, final: boolean): void;
  onOriginal(target: StudioTarget, part: StudioPart): void;
  onTry(): void;
  onAssign(): void;
  onUndo(): void;
  onName(name: string): void;
  onOnline(on: boolean): void;
  onFight(): void;
  onClose(): void;
  onCopy(): void;
  onLoad(code: string): void;
  onKeep(): void;
  onKept(): void;
}

const TUNES: readonly [TuneKey, string][] = [['power', 'Power'], ['reach', 'Reach'], ['speed', 'Speed']];
const STATUSES: readonly [string, string][] = [['', 'No status'], ['burn', 'Burn: 10/s for 3 s'], ['slow', 'Slow: 65% speed for 2.5 s'], ['freeze', 'Freeze: held 0.6 s']];
const percent = (value: number) => `${Math.round(value * 100)}%`;
const targetKey = (target: StudioTarget) => target === 'aura' ? 'AURA' : slotKey(target);
const targetWord = (target: StudioTarget) => target === 'aura' ? 'AURA' : SLOT_WORDS[target];

function slider(label: string, min: number, max: number, step: number, value: number, show: (value: number) => string, onInput: (value: number) => void, onChange: (value: number) => void, title = '') {
  const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), className: 'fs-range' });
  const out = el('output', { textContent: show(value) });
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => { out.textContent = show(Number(input.value)); onInput(Number(input.value)); });
  let pointer = false;
  input.addEventListener('pointerdown', () => { pointer = true; });
  input.addEventListener('change', () => { onChange(Number(input.value)); if (pointer) { pointer = false; input.blur(); } });
  const row = el('label', { className: 'fs-slider', ...(title ? { title } : {}) }, el('span', { textContent: label }), input, out);
  return { row, set(next: number) { if (document.activeElement !== input) { input.value = String(next); out.textContent = show(next); } } };
}

export class StudioInspector {
  readonly root: HTMLElement;
  private readonly pictures: LazyPictures;
  private readonly rows = new Map<StudioTarget, HTMLButtonElement>();
  private readonly name: HTMLInputElement;
  private readonly detail: HTMLElement;
  private readonly problems: HTMLUListElement;
  private readonly status: HTMLElement;
  private readonly tryButton: HTMLButtonElement;
  private readonly assignButton: HTMLButtonElement;
  private readonly undoButton: HTMLButtonElement;
  private readonly budgetBar: HTMLElement;
  private readonly budgetValue: HTMLElement;
  private readonly budgetNote: HTMLElement;
  private readonly online: HTMLInputElement;
  private readonly codeInput: HTMLInputElement;
  readonly keptList: HTMLUListElement;
  private signature = '';
  private setters: ((kit: ForgeKit) => void)[] = [];

  constructor(private readonly hooks: InspectorHooks, body: FighterId) {
    this.pictures = new LazyPictures(document.body);
    this.name = el('input', { type: 'text', maxLength: 24, spellcheck: false, className: 'fs-name-input', autocomplete: 'off' });
    this.name.setAttribute('aria-label', 'Name of the forged fighter');
    this.name.addEventListener('input', () => this.hooks.onName(this.name.value));
    const slots = el('div', { className: 'fs-slots', role: 'radiogroup' });
    slots.setAttribute('aria-label', 'Target');
    for (const target of STUDIO_TARGETS) {
      const row = el('button', { type: 'button', className: 'fs-slot', role: 'radio' });
      row.dataset.target = target;
      row.addEventListener('click', () => this.hooks.onTarget(target));
      this.rows.set(target, row); slots.append(row);
    }
    this.detail = el('div', { className: 'fs-detail' });
    this.problems = el('ul', { className: 'fs-problems' });
    this.status = el('p', { className: 'fs-status', role: 'status' });
    this.tryButton = button('TRY', () => this.hooks.onTry(), 'fs-try', 'Try it on the target (Space)');
    this.tryButton.append(el('kbd', { textContent: 'Space' }));
    this.assignButton = button('ASSIGN', () => this.hooks.onAssign(), 'fs-assign', 'Keep what is being tried (Enter)');
    this.assignButton.append(el('kbd', { textContent: 'Enter' }));
    this.undoButton = button('UNDO', () => this.hooks.onUndo(), 'fs-undo', 'Take back the last assignment (Ctrl+Z)');
    this.budgetBar = el('i');
    const limit = el('em', { title: `Private rooms allow ${percent(BUDGET_LIMIT)}` });
    limit.style.left = `${BUDGET_LIMIT / 1.6 * 100}%`;
    this.budgetValue = el('b', { className: 'fs-budget-value' });
    this.budgetNote = el('small', { className: 'fs-budget-note' });
    this.online = el('input', { type: 'checkbox', className: 'fs-online-box' });
    this.online.addEventListener('change', () => { this.hooks.onOnline(this.online.checked); this.online.blur(); });
    this.codeInput = el('input', { type: 'text', placeholder: 'Paste a JF1. code', spellcheck: false, className: 'fs-code', autocomplete: 'off' });
    this.codeInput.setAttribute('aria-label', 'Forge code');
    this.keptList = el('ul', { className: 'fs-kept' });
    const close = button('5', () => this.hooks.onClose(), 'fs-close', 'Close the studio (5 or Esc)');
    close.append(el('span', { textContent: '✕' }));
    close.setAttribute('aria-label', 'Close the studio (5 or Esc)');
    this.root = el('section', { className: 'fs-panel fs-inspector' },
      el('header', { className: 'fs-phead' }, el('b', { textContent: 'FORGE STUDIO' }), el('span', { className: 'fs-body', textContent: `${nameOf(body)}'s body` }),
        button('FIGHT', () => this.hooks.onFight(), 'fs-fight', 'Close the studio and put both fighters back on their marks'), close),
      el('div', { className: 'fs-ibody' },
        el('label', { className: 'fs-name' }, el('span', { textContent: 'NAME' }), this.name),
        slots, this.detail, this.problems,
        el('details', { className: 'fs-share' },
          el('summary', { textContent: 'SHARE & KEEP' }),
          el('div', { className: 'fs-share-row' }, button('COPY CODE', () => this.hooks.onCopy()), this.codeInput, button('LOAD', () => this.hooks.onLoad(this.codeInput.value))),
          el('div', { className: 'fs-share-row' }, button('SAVE TO ACCOUNT', () => this.hooks.onKeep()), button('MY FIGHTERS', () => this.hooks.onKept())),
          this.keptList),
        el('p', { className: 'fs-saved', textContent: 'Every assignment is saved for this body and is back the next time you train with it. 5 opens and closes the studio.' })),
      el('footer', { className: 'fs-ifoot' },
        el('div', { className: 'fs-actions' }, this.tryButton, this.assignButton, this.undoButton),
        this.status,
        el('div', { className: 'fs-budget', title: 'How strong the kept kit is against this body\'s own. Training plays any kit; private rooms allow 110%.' },
          el('span', { textContent: 'ONLINE' }), el('div', { className: 'fs-budget-bar' }, this.budgetBar, limit), this.budgetValue),
        el('label', { className: 'fs-online' }, this.online, el('span', { textContent: 'Use in private rooms' }), this.budgetNote)));
    this.root.setAttribute('aria-label', 'Forge studio');
  }

  get code() { return this.codeInput; }
  reveal(part: StudioPart) {
    const section = this.detail.querySelector(part === 'look' ? '.fs-original-look' : '.fs-original-move')?.closest<HTMLElement>('.fs-sec');
    section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  say(text: string) { this.status.textContent = text; }

  render(view: InspectorView) {
    if (document.activeElement !== this.name && this.name.value !== view.kit.name) this.name.value = view.kit.name;
    for (const target of STUDIO_TARGETS) this.paintRow(target, view);
    const pick = view.target === 'aura' ? undefined : kitPick(view.kit, view.target), fx = lookOf(view.kit, view.target);
    const source = pick && view.target !== 'aura' ? pickSource(view.target, pick) : undefined;
    const signature = [view.target, source ? `${source.fighter}:${source.slot}` : '', fx?.effect ?? '', view.trial?.target === view.target ? view.trial.item.kind : '',
      view.armory, fx && view.effect(fx.effect) ? 'info' : ''].join('|');
    if (signature !== this.signature) { this.signature = signature; this.buildDetail(view); }
    for (const set of this.setters) set(view.kit);
    this.problems.replaceChildren(...view.problems.map(text => el('li', { textContent: text })));
    const trying = !!view.trial;
    this.assignButton.disabled = false;
    this.assignButton.classList.toggle('fs-ready', trying);
    this.undoButton.disabled = !view.canUndo && !trying;
    const ratio = view.online.ratio;
    this.budgetBar.style.width = `${Math.min(100, (Number.isFinite(ratio) ? ratio : 0) / 1.6 * 100)}%`;
    this.root.classList.toggle('fs-over', !view.online.fits);
    this.budgetValue.textContent = Number.isFinite(ratio) ? `${percent(ratio)} / ${percent(BUDGET_LIMIT)}` : '—';
    if (this.online.checked !== view.online.on) this.online.checked = view.online.on;
    this.budgetNote.textContent = view.online.on ? view.online.fits ? 'on · fits' : 'on · over the limit: not sent' : view.online.fits ? 'off' : 'off · over the limit';
    this.budgetNote.title = (view.online.fits ? 'This kit fits private rooms.' : `${view.online.why ?? 'It is over the online limit'}: it plays here in Training only.`) + (view.trialRatio !== undefined && Number.isFinite(view.trialRatio) ? ` What is being tried: ${percent(view.trialRatio)}.` : '');
    this.budgetNote.classList.toggle('fs-warn', view.online.on && !view.online.fits);
  }

  private paintRow(target: StudioTarget, view: InspectorView) {
    const row = this.rows.get(target)!, kit = view.kit, fx = lookOf(kit, target), diff = changed(kit, target);
    const on = target === view.target, trying = view.trial?.target === target;
    row.classList.toggle('on', on); row.setAttribute('aria-checked', String(on));
    row.classList.toggle('fs-trying', trying); row.classList.toggle('fs-busy', view.busy === target);
    row.classList.toggle('fs-changed', diff.move || diff.look);
    const key = `${target}|${JSON.stringify(target === 'aura' ? kit.aura ?? null : kitPick(kit, target))}|${trying}|${view.armory}|${fx && view.effect(fx.effect) ? 1 : 0}`;
    if (row.dataset.painted === key) return;
    row.dataset.painted = key;
    const parts: (Node | string)[] = [el('kbd', { textContent: targetKey(target) })];
    let named = 'Aura';
    if (target !== 'aura') {
      const source = pickSource(target, kitPick(kit, target)), own = source.fighter === kit.body && source.slot === target;
      named = moveName(source.fighter, source.slot);
      parts.push(this.pictures.now(facesOf(source.fighter), 'fs-face'), el('span', { className: 'fs-slot-move' },
        el('b', { textContent: named }),
        el('small', { textContent: own ? `own ${SLOT_WORDS[target].toLowerCase()}` : source.fighter === kit.body ? `own ${slotKey(source.slot)} move` : `${nameOf(source.fighter)} · ${slotKey(source.slot)}` })));
    } else parts.push(el('i', { className: 'fs-face fs-aura-face' }), el('span', { className: 'fs-slot-move' }, el('b', { textContent: 'Aura' }), el('small', { textContent: 'what the body wears' })));
    const info = fx && view.effect(fx.effect);
    parts.push(fx
      ? el('span', { className: 'fs-slot-look', title: info?.label ?? fx.effect }, el('span', { className: 'fs-th' }, info?.thumb ? this.pictures.now([info.thumb], 'fs-thumb') : false, el('b', { className: 'fs-initial', textContent: (info?.label ?? fx.effect).charAt(0).toUpperCase() })))
      : el('span', { className: 'fs-slot-look fs-original', textContent: 'Original' }));
    parts.push(el('em', { className: 'fs-badge', textContent: trying ? 'TRYING' : '' }));
    if (info) (parts[parts.length - 2] as HTMLElement).style.setProperty('--accent', schoolOf(info.school).accent);
    row.replaceChildren(...parts);
    row.title = `${targetWord(target)} (${targetKey(target)}): select it, and what you try goes there`;
    row.setAttribute('aria-label', `${targetLabel(target)} · ${named}${fx ? ` · ${info?.label ?? fx.effect}` : ''}`);
  }

  private buildDetail(view: InspectorView) {
    this.setters = [];
    const target = view.target, kit = view.kit, out: (Node | string)[] = [];
    const trying = view.trial?.target === target;
    if (trying) out.push(el('p', { className: 'fs-trial', textContent: view.trial!.item.kind === 'move' ? 'Trying this move. ASSIGN (Enter) keeps it; anything else tried puts back what was kept.' : 'Trying this look. ASSIGN (Enter) keeps it; anything else tried puts back what was kept.' }));
    if (target !== 'aura') {
      const slot = target, pick = kitPick(kit, slot), source = pickSource(slot, pick), own = source.fighter === kit.body && source.slot === slot;
      out.push(el('div', { className: 'fs-sec' }, el('h4', { textContent: `${targetLabel(slot)} · MOVE` }), button('ORIGINAL', () => this.hooks.onOriginal(slot, 'move'), 'fs-original-move', `Put back ${nameOf(kit.body)}'s own ${SLOT_WORDS[slot].toLowerCase()}`)));
      (out[out.length - 1] as HTMLElement).querySelector('button')!.disabled = own && !pick.tune && !pick.status;
      out.push(el('div', { className: 'fs-card' }, this.pictures.now(facesOf(source.fighter), 'fs-face fs-big'),
        el('span', {}, el('b', { textContent: moveName(source.fighter, source.slot) }),
          el('small', { textContent: own ? `${nameOf(kit.body)}'s own ${SLOT_WORDS[slot].toLowerCase()}` : `${nameOf(source.fighter)}'s ${SLOT_WORDS[source.slot].toLowerCase()}` }))));
      for (const [key, label] of TUNES) {
        const [lo, hi] = TUNE_LIMITS[key];
        const control = slider(label, Math.round(lo * 100), Math.round(hi * 100), 5, Math.round((pick.tune?.[key] ?? 1) * 100), value => `${value}%`,
          value => this.hooks.onTune(slot, key, value / 100, false), value => this.hooks.onTune(slot, key, value / 100, true));
        this.setters.push(next => control.set(Math.round((kitPick(next, slot).tune?.[key] ?? 1) * 100)));
        out.push(control.row);
      }
      const status = el('select', { className: 'fs-status-pick' }, ...STATUSES.map(([value, textContent]) => el('option', { value, textContent })));
      status.setAttribute('aria-label', 'Status its finisher leaves');
      status.value = pick.status ?? '';
      status.addEventListener('change', () => { this.hooks.onStatus(slot, (status.value || undefined) as ForgeStatus | undefined); status.blur(); });
      this.setters.push(next => { if (document.activeElement !== status) status.value = kitPick(next, slot).status ?? ''; });
      out.push(el('label', { className: 'fs-slider fs-status-row' }, el('span', { textContent: 'Status' }), status));
    }
    const fx = lookOf(kit, target);
    out.push(el('div', { className: 'fs-sec' }, el('h4', { textContent: `${targetLabel(target)} · LOOK` }), button('ORIGINAL', () => this.hooks.onOriginal(target, 'look'), 'fs-original-look', target === 'aura' ? 'Wear no aura' : 'Back to the move\'s own effects')));
    (out[out.length - 1] as HTMLElement).querySelector('button')!.disabled = !fx;
    if (!fx) out.push(el('p', { className: 'fs-hint', textContent: view.armory === 'missing'
      ? 'Original look. The VFX Armory\'s effects come here once the game carries them.'
      : target === 'aura' ? 'No aura. Pick an effect in the VFX tab to wear one.' : 'Original look: the move\'s own effects. Pick one in the VFX tab to try it here.' }));
    else this.lookControls(view, target, fx, out);
    this.detail.replaceChildren(...out);
  }

  private lookControls(view: InspectorView, target: StudioTarget, fx: ForgeFx, out: (Node | string)[]) {
    const info = view.effect(fx.effect), school = info ? schoolOf(info.school) : undefined;
    const card = el('div', { className: 'fs-card fs-look-card' },
      el('span', { className: 'fs-th' }, info?.thumb ? this.pictures.now([info.thumb], 'fs-thumb') : el('i', { className: 'fs-swatch' }), el('b', { className: 'fs-initial', textContent: (info?.label ?? fx.effect).charAt(0).toUpperCase() })),
      el('span', {}, el('b', { textContent: info?.label ?? fx.effect }), el('small', { textContent: info ? [school?.label, kitLabel(info.kit), info.cast === 'zone' ? 'zone' : 'line'].filter(Boolean).join(' · ') : view.armory === 'missing' ? 'Armory effect: it plays once the game carries the VFX Armory' : 'Loading…' })));
    if (school) card.style.setProperty('--accent', school.accent);
    out.push(card);
    for (const essential of info?.essentials ?? []) {
      const current = (look: ForgeFx | undefined) => { const value = look?.settings?.[essential.key]; return typeof value === 'number' ? value : essential.value; };
      const digits = essential.step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(essential.step)));
      const control = slider(essential.label, essential.min, essential.max, essential.step, current(fx), value => value.toFixed(digits),
        value => this.hooks.onLook(target, { setting: [essential.key, value] }, false), value => this.hooks.onLook(target, { setting: [essential.key, value] }, true));
      this.setters.push(kit => control.set(current(lookOf(kit, target))));
      out.push(control.row);
    }
    const size = slider('Size', 25, 400, 5, Math.round((fx.scale ?? 1) * 100), value => `${value}%`,
      value => this.hooks.onLook(target, { scale: value / 100 }, false), value => this.hooks.onLook(target, { scale: value / 100 }, true));
    this.setters.push(kit => size.set(Math.round((lookOf(kit, target)?.scale ?? 1) * 100)));
    const hue = slider('Colour', -180, 180, 5, fx.hue ?? 0, value => `${value > 0 ? '+' : ''}${value}°`,
      value => this.hooks.onLook(target, { hue: value }, false), value => this.hooks.onLook(target, { hue: value }, true));
    hue.row.classList.add('fs-hue');
    this.setters.push(kit => hue.set(lookOf(kit, target)?.hue ?? 0));
    out.push(size.row, hue.row);
  }

  dispose() { this.pictures.dispose(); }
}
