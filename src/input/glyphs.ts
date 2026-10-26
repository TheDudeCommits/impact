import type { PadFamily } from './gamepad';
import { getBindings, keyName, MOVE_ACTIONS, pauseKey, type CombatAction } from './bindings';

export type PadControl = 'south' | 'east' | 'west' | 'north' | 'l1' | 'r1' | 'l2' | 'r2' | 'l3' | 'r3'
  | 'start' | 'select' | 'lstick' | 'rstick' | 'dpad' | 'up' | 'down' | 'left' | 'right';

const PLAYSTATION: Record<PadControl, string> = {
  south: '✕', east: '○', west: '□', north: '△', l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', l3: 'L3', r3: 'R3',
  start: 'OPTIONS', select: 'CREATE', lstick: 'L STICK', rstick: 'R STICK', dpad: 'D-PAD', up:'D ↑',down:'D ↓',left:'D ←',right:'D →',
};
const XBOX: Record<PadControl, string> = {
  south: 'A', east: 'B', west: 'X', north: 'Y', l1: 'LB', r1: 'RB', l2: 'LT', r2: 'RT', l3: 'LS', r3: 'RS',
  start: 'MENU', select: 'VIEW', lstick: 'L STICK', rstick: 'R STICK', dpad: 'D-PAD',up:'D ↑',down:'D ↓',left:'D ←',right:'D →',
};
const EITHER: Record<PadControl, string> = {
  south: 'A / ✕', east: 'B / ○', west: 'X / □', north: 'Y / △', l1: 'LB / L1', r1: 'RB / R1', l2: 'LT / L2', r2: 'RT / R2',
  l3: 'LS / L3', r3: 'RS / R3', start: 'MENU / OPTIONS', select: 'VIEW / CREATE', lstick: 'L STICK', rstick: 'R STICK', dpad: 'D-PAD',up:'D ↑',down:'D ↓',left:'D ←',right:'D →',
};
const NAMES: Record<PadFamily, Record<PadControl, string>> = { playstation: PLAYSTATION, xbox: XBOX, generic: EITHER };
const FACE = new Set<PadControl>(['south', 'east', 'west', 'north']);

export const padName = (family: PadFamily, control: PadControl) => NAMES[family][control];
export const BUTTON_CONTROLS:readonly PadControl[]=['south','east','west','north','l1','r1','l2','r2','select','start','l3','r3','up','down','left','right'];
export const actionControl=(action:CombatAction)=>BUTTON_CONTROLS[getBindings().controller[action==='awaken'?'ultimate':action]];
export const chordControls=():readonly [PadControl,PadControl]=>[actionControl('ultimate'),actionControl('area')];
export const actionKey=(action:CombatAction,family:PadFamily)=>action!=='awaken'?padKey(family,actionControl(action))
  :family==='generic'?`<kbd class="pad-key">${actionName('awaken',family)}</kbd>`:chordControls().map(control=>padKey(family,control)).join('+');
export const actionName=(action:CombatAction,family:PadFamily)=>{
  if(action!=='awaken')return padName(family,actionControl(action));
  const chord=(names:PadFamily)=>chordControls().map(control=>padName(names,control)).join('+');
  return family==='generic'?`${chord('xbox')} / ${chord('playstation')}`:chord(family);
};
export function keyboardCombatHints(){
  const map=getBindings().keyboard, key=(action:keyof typeof map)=>`<kbd>${keyName(map[action][0])}</kbd>`;
  return `<span class="control-item">${['forward','left','backward','right'].map(a=>key(a as keyof typeof map)).join('')} MOVE</span>`+(['jump','dash','guard','target'] as const).map(a=>`<span class="control-item">${key(a)} ${a==='target'?'LOCK ON':a.toUpperCase()}</span>`).join('')+`<span class="control-item"><kbd>${pauseKey()==='KeyP'?'P':'ESC'}</kbd> PAUSE</span>`;
}

export function padKey(family: PadFamily, control: PadControl) {
  const face = family === 'playstation' && FACE.has(control);
  return `<kbd class="pad-key${face ? ` ps-face ps-${control}` : ''}">${padName(family, control)}</kbd>`;
}

export function padCombatHints(family: PadFamily) {
  const item = (control: PadControl, label: string) => `<span class="control-item">${padKey(family, control)} ${label}</span>`;
  return [item('lstick', 'MOVE'), item(actionControl('jump'), 'JUMP'), item(actionControl('dash'), 'DASH'), item(actionControl('guard'), 'GUARD'),
    item(actionControl('target'), 'LOCK ON'), item('start', 'PAUSE')].join('');
}

export const MOVE_CONTROLS: readonly PadControl[] = ['west', 'north', 'r1', 'l2', 'r2'];
