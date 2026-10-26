import { getBindings, keyName, pauseKey, type BindingAction, type CombatAction } from '../input/bindings';
import { actionControl, actionKey, padKey, type PadControl } from '../input/glyphs';
import type { PadFamily } from '../input/gamepad';
import './prompts.css';

export type PromptDevice = 'keyboard' | 'controller' | 'touch';
export type PromptAction = BindingAction | 'interact' | 'menu' | 'tree' | 'confirm' | 'back' | 'quick1' | 'quick2' | 'quick3' | 'quick4' | 'click';
export const PROMPT_ACTIONS: readonly PromptAction[] = ['forward', 'left', 'backward', 'right', 'jump', 'dash', 'guard', 'target', 'light', 'heavy', 'special', 'ultimate', 'area', 'awaken', 'interact', 'menu', 'tree', 'confirm', 'back', 'quick1', 'quick2', 'quick3', 'quick4', 'click'];
export interface PromptOptions {
  device?: PromptDevice;
  family?: PadFamily;
  hold?: boolean;
  detail?: string;
}

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const COMBAT = new Set<string>(['jump', 'dash', 'guard', 'target', 'light', 'heavy', 'special', 'ultimate', 'area', 'awaken']);
const UI_KEYS: Record<Exclude<PromptAction, BindingAction>, string> = {
  interact: 'KeyB', menu: 'KeyP', tree: 'KeyT', confirm: 'Enter', back: 'Escape',
  quick1: 'Digit1', quick2: 'Digit2', quick3: 'Digit3', quick4: 'Digit4', click: 'Click',
};
const UI_PAD: Record<Exclude<PromptAction, BindingAction>, PadControl | 'jump' | undefined> = {
  interact: 'jump', menu: 'start', tree: 'up', confirm: 'south', back: 'east',
  quick1: 'up', quick2: 'right', quick3: 'down', quick4: 'left', click: undefined,
};
const UI_NAMES: Record<string, string> = { Escape: 'Esc', KeyP: 'P', Enter: 'Enter', Click: 'Click', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', KeyB: 'B', KeyT: 'T' };
const TOUCH_NAMES: Partial<Record<PromptAction, string>> = {
  forward: 'STICK', left: 'STICK', backward: 'STICK', right: 'STICK', jump: 'JUMP', dash: 'DASH', guard: 'GUARD', target: 'LOCK',
  light: 'LIGHT', heavy: 'HEAVY', special: 'SPECIAL', ultimate: 'ULT', area: 'AREA', awaken: 'AWAKEN', interact: 'JUMP', menu: '❚❚', back: '×',
};

export function currentDevice(): { device: PromptDevice; family: PadFamily } {
  const root = typeof document === 'object' ? document.querySelector<HTMLElement>('#interface') : null;
  const device = root?.dataset.input === 'controller' ? 'controller' : root?.dataset.input === 'touch' ? 'touch' : 'keyboard';
  const family = (['playstation', 'xbox', 'generic'] as const).find(f => f === root?.dataset.pad) ?? 'generic';
  return { device, family };
}

export function padControlFor(action: PromptAction): PadControl | undefined {
  if (COMBAT.has(action)) return actionControl(action as CombatAction);
  if (action === 'forward' || action === 'left' || action === 'backward' || action === 'right') return 'lstick';
  const pad = UI_PAD[action as Exclude<PromptAction, BindingAction>];
  return pad === 'jump' ? actionControl('jump') : pad;
}
export function keyLabel(action: PromptAction): string {
  if (action in UI_KEYS) { const code = action === 'menu' ? pauseKey() : UI_KEYS[action as keyof typeof UI_KEYS]; return UI_NAMES[code] ?? keyName(code); }
  return keyName(getBindings().keyboard[action as BindingAction][0] ?? '?');
}

export function promptKey(action: PromptAction, options: PromptOptions = {}): string {
  const seen = options.device && options.family ? undefined : currentDevice();
  const device = options.device ?? seen!.device, family = options.family ?? seen?.family ?? 'generic';
  if (device === 'controller') { if (action === 'awaken') return actionKey('awaken', family); const control = padControlFor(action); return control ? padKey(family, control) : ''; }
  if (device === 'touch') return touchKey(action);
  return `<kbd>${escape(keyLabel(action))}</kbd>`;
}
export const touchLabel = (action: PromptAction): string | undefined => TOUCH_NAMES[action];
export function touchKey(action: PromptAction): string {
  const name = TOUCH_NAMES[action];
  return name ? `<kbd class="touch-key">${escape(name)}</kbd>` : '';
}

export function prompt(action: PromptAction, verb: string, options: PromptOptions = {}): string {
  const key = promptKey(action, options);
  return `<span class="ux-prompt"${key ? '' : ' data-keyless'}>${options.hold ? '<i>HOLD</i>' : ''}${key}<b>${escape(verb)}</b>${options.detail ? `<small>${escape(options.detail)}</small>` : ''}</span>`;
}

export function promptText(text: string, options: PromptOptions = {}): string {
  const touch = (options.device ?? currentDevice().device) === 'touch';
  return escape(text).replace(/\{([a-z0-9]+)\}/g, (whole, name: string) => (PROMPT_ACTIONS as readonly string[]).includes(name) ? promptKey(name as PromptAction, options) || (touch ? '' : whole) : whole);
}
