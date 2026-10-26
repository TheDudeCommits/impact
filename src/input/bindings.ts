export const ACTIONS = ['forward','left','backward','right','jump','dash','guard','target','light','heavy','special','ultimate','area','awaken'] as const;
export type BindingAction = typeof ACTIONS[number];
export type CombatAction = Exclude<BindingAction,'forward'|'left'|'backward'|'right'>;
export const COMBAT_ACTIONS = ACTIONS.slice(4) as readonly CombatAction[];
export type PadAction = Exclude<CombatAction,'awaken'>;
export const PAD_ACTIONS = COMBAT_ACTIONS.filter(a=>a!=='awaken') as readonly PadAction[];
export const MOVE_ACTIONS = ['light','heavy','special','ultimate','area','awaken'] as const;
export const ACTION_LABELS: Record<BindingAction,string> = {forward:'Forward',left:'Left',backward:'Back',right:'Right',jump:'Jump / fly',dash:'Dash',guard:'Guard',target:'Lock / switch',light:'Light attack',heavy:'Heavy attack',special:'Special',ultimate:'Ultimate',area:'Area (hold to aim)',awaken:'Awaken'};
export interface Bindings { keyboard: Record<BindingAction,string[]>; controller: Record<PadAction,number> }
export const DEFAULT_BINDINGS: Bindings = {
  keyboard:{forward:['KeyW'],left:['KeyA'],backward:['KeyS'],right:['KeyD'],jump:['Space'],dash:['ShiftLeft'],guard:['KeyF'],target:['Tab'],light:['KeyJ','Mouse0'],heavy:['KeyK','Mouse2'],special:['KeyQ'],ultimate:['KeyR'],area:['KeyG'],awaken:['KeyE']},
  controller:{jump:0,dash:1,guard:4,target:11,light:2,heavy:3,special:5,ultimate:6,area:7},
};
export const BINDINGS_KEY='jump-bindings-v1';
export const BINDINGS_EVENT='jump-bindings-change';
export const PAD_BUTTONS=[0,1,2,3,4,5,6,7,10,11,12,13,14,15] as const;
const copy=():Bindings=>structuredClone(DEFAULT_BINDINGS);
export const normalizeKey=(code:string)=>code==='ShiftRight'?'ShiftLeft':code==='ControlRight'?'ControlLeft':code==='AltRight'?'AltLeft':code;
export const validKey=(code:string)=>/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Space|Tab|ShiftLeft|ControlLeft|AltLeft|CapsLock|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Enter|Backspace|Insert|Delete|Home|End|PageUp|PageDown|Mouse[0-4])$/.test(code);
export function parseBindings(raw:string|null):Bindings {
  const result=copy();if(!raw)return result;
  try{
    const value=JSON.parse(raw),keys=new Set<string>(),buttons=new Set<number>();
    if(value.keyboard&&typeof value.keyboard==='object'&&!('area' in value.keyboard)){
      const taken=new Set(Object.values(value.keyboard).flat());
      const free=['KeyG','KeyT','KeyV','KeyC','KeyX','KeyZ','KeyB','KeyH','KeyY'].find(k=>!taken.has(k));
      if(free)value.keyboard={...value.keyboard,area:[free]};
    }
    if(ACTIONS.every(a=>Array.isArray(value.keyboard?.[a])&&value.keyboard[a].length===DEFAULT_BINDINGS.keyboard[a].length&&value.keyboard[a].every((k:unknown)=>typeof k==='string'&&validKey(k)&&!keys.has(k)&&!!keys.add(k))))result.keyboard=value.keyboard;
    if(PAD_ACTIONS.every(a=>PAD_BUTTONS.includes(value.controller?.[a])&&!buttons.has(value.controller[a])&&!!buttons.add(value.controller[a])))result.controller=Object.fromEntries(PAD_ACTIONS.map(a=>[a,value.controller[a]])) as Record<PadAction,number>;
  }catch{ }
  return result;
}
let current:Bindings|undefined;
export function getBindings():Bindings {if(!current){let raw=null;try{raw=globalThis.localStorage?.getItem(BINDINGS_KEY)??null;}catch{}current=parseBindings(raw);}return current;}
let capturing=false;
export const isCapturingBinding=()=>capturing;
export function setBindingCapture(value:boolean){capturing=value;changed(false);}
function changed(save=true){if(save)try{localStorage.setItem(BINDINGS_KEY,JSON.stringify(getBindings()));}catch{}if(typeof window!=='undefined')window.dispatchEvent(new Event(BINDINGS_EVENT));}
export function bindKey(action:BindingAction,index:number,code:string){
  code=normalizeKey(code);if(!validKey(code))return false;
  const map=getBindings().keyboard;if(index<0||index>=map[action].length)return false;
  const previous=map[action][index];
  for(const other of ACTIONS)map[other]=map[other].map(key=>key===code?previous:key);
  map[action][index]=code;changed();return true;
}
export function bindPad(action:CombatAction,button:number){
  if(action==='awaken'||!PAD_BUTTONS.includes(button as typeof PAD_BUTTONS[number]))return false;
  const map=getBindings().controller,previous=map[action];
  for(const other of PAD_ACTIONS)if(map[other]===button)map[other]=previous;
  map[action]=button;changed();return true;
}
export function resetBindings(device:'keyboard'|'controller'){const defaults=copy();if(device==='keyboard')getBindings().keyboard=defaults.keyboard;else getBindings().controller=defaults.controller;changed();}
export const boundTo=(action:BindingAction,code:string)=>getBindings().keyboard[action].includes(normalizeKey(code));
export const pauseKey=()=>ACTIONS.some(action=>boundTo(action,'KeyP'))?'Escape':'KeyP';
export const heldBinding=(action:BindingAction,keys:ReadonlySet<string>)=>getBindings().keyboard[action].some(code=>keys.has(code)||['ShiftLeft','ControlLeft','AltLeft'].includes(code)&&keys.has(code.replace('Left','Right')));
export const keyName=(code:string)=>({Space:'Space',ShiftLeft:'Shift',ControlLeft:'Ctrl',AltLeft:'Alt',CapsLock:'Caps',Backquote:'`',Minus:'−',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backspace:'⌫',PageUp:'PgUp',PageDown:'PgDn',Mouse0:'Mouse 1',Mouse1:'Mouse 3',Mouse2:'Mouse 2',Mouse3:'Mouse 4',Mouse4:'Mouse 5'}[code]??code.replace(/^Key|^Digit/,'').replace('Numpad','Num '));
export const keyNames=(action:BindingAction)=>getBindings().keyboard[action].map(keyName).join(' / ');
