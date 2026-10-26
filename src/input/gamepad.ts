import type { AttackSlot } from '../game/types';
import { getBindings } from './bindings';

export type InputMode = 'keyboard' | 'controller' | 'touch';
export type PadFamily = 'playstation' | 'xbox' | 'generic';
export type UiAction = 'confirm' | 'back' | 'next' | 'previous' | 'left' | 'right' | 'extra';
export interface PadState {
  index: number; id: string; mapping: string; connected: boolean;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}
export interface PadFrame {
  forward: number; right: number; lookX: number; lookY: number; guard: boolean;
  attack?: AttackSlot; jump: boolean; jumpHeld: boolean; dash: boolean; awaken: boolean; target: boolean; menu: boolean;
  ui: UiAction[]; active: boolean; label: string; family: PadFamily; interact?: boolean;
  area?: 'press' | 'release' | 'cancel';
  guardPressed?: boolean;
}
const neutral = (): PadFrame => ({ attack:undefined, forward:0, right:0, lookX:0, lookY:0, guard:false, jump:false, jumpHeld:false, dash:false, awaken:false, target:false, menu:false, ui:[], active:false, label:'', family:'generic' });
export const AWAKEN_CHORD = 100;
export function padFamily(id: string): PadFamily {
  if (/playstation|dualsense|dualshock|054c|^wireless controller/i.test(id)) return 'playstation';
  if (/xbox|xinput|045e/i.test(id)) return 'xbox';
  return 'generic';
}
export function padLabel(id: string) {
  if (/dualsense edge|0df2/i.test(id)) return 'DualSense Edge';
  if (/dualsense|0ce6/i.test(id)) return 'DualSense';
  if (/dualshock|05c4|09cc/i.test(id)) return 'DualShock 4';
  const family = padFamily(id);
  return family === 'playstation' ? 'PlayStation' : family === 'xbox' ? 'Xbox' : 'Controller';
}
const REPEAT_AFTER = 380, REPEAT_EVERY = 110;
export function radialDeadzone(x: number, y: number, deadzone = .18): [number, number] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
  const length = Math.hypot(x, y);
  if (length <= deadzone) return [0, 0];
  const scale = Math.min(1, (length-deadzone)/(1-deadzone))/length;
  return [x*scale,y*scale];
}
export class GamepadControls {
  private identity = '';
  private previous: boolean[] = [];
  private previousUi = [false,false,false,false];
  private heldSince = [0,0,0,0];
  private repeatedAt = [0,0,0,0];
  private lastEnabled = false;
  private resetPending = true;
  private ultimateAt?: number;
  private areaAt?: number;
  private aiming = false;
  private areaLetGo?: number;
  reset() { this.resetPending=true; this.ultimateAt=this.areaAt=this.areaLetGo=undefined; this.aiming=false; }
  read(pad: PadState | undefined, enabled: boolean, now?: number): PadFrame {
    const frame=neutral();
    if (!pad?.connected || pad.mapping !== 'standard') { this.identity='';this.previous=[];this.resetPending=true;return frame; }
    frame.label=padLabel(pad.id);frame.family=padFamily(pad.id);
    const buttons=pad.buttons.map((b,i)=>i===6||i===7?b.value>=.55:b.pressed||b.value>=.6);
    const [right,vertical]=radialDeadzone(pad.axes[0]??0,pad.axes[1]??0);
    const [lookX,lookY]=radialDeadzone(pad.axes[2]??0,pad.axes[3]??0,.15);
    const ui=[!!buttons[12]||vertical<-.65,!!buttons[13]||vertical>.65,!!buttons[14]||right<-.65,!!buttons[15]||right>.65];
    const identity=`${pad.index}:${pad.id}`;
    const arrived=this.resetPending||identity!==this.identity;
    const baseline=arrived||this.lastEnabled!==enabled;
    if(baseline){this.previous=buttons;this.previousUi=ui;this.heldSince=ui.map(v=>v?Infinity:0);this.identity=identity;this.lastEnabled=enabled;this.resetPending=false;}
    const edge=(i:number)=>!!buttons[i]&&!this.previous[i];
    frame.active=Math.hypot(right,vertical)>.05||Math.hypot(lookX,lookY)>.05||buttons.some((v,i)=>v&&(!this.previous[i]||arrived));
    frame.menu=edge(9);
    if(enabled){
      if(edge(8))frame.interact=true;
      const b=getBindings().controller;
      frame.forward=-vertical;frame.right=right;frame.lookX=lookX;frame.lookY=lookY;frame.guard=!!buttons[b.guard]&&!baseline;
      frame.jump=edge(b.jump);frame.jumpHeld=!!buttons[b.jump]&&!baseline;frame.dash=edge(b.dash);frame.target=edge(b.target);
      frame.guardPressed=edge(b.guard);
      if(edge(b.light))frame.attack='light';else if(edge(b.heavy))frame.attack='heavy';else if(edge(b.special))frame.attack='special';
      this.chord(frame,edge(b.ultimate),!!buttons[b.ultimate],edge(b.area),!!buttons[b.area],!!this.previous[b.area]&&!buttons[b.area],now);
    }else{
      if(edge(0))frame.ui.push('confirm');if(edge(1))frame.ui.push('back');if(edge(3))frame.ui.push('extra');
      const actions:UiAction[]=['previous','next','left','right'];
      ui.forEach((value,i)=>{
        if(value&&!this.previousUi[i]){frame.ui.push(actions[i]);this.heldSince[i]=this.repeatedAt[i]=now??0;}
        else if(value&&now!==undefined&&now-this.heldSince[i]>=REPEAT_AFTER&&now-this.repeatedAt[i]>=REPEAT_EVERY){frame.ui.push(actions[i]);this.repeatedAt[i]=now;}
      });
    }
    this.previous=buttons;this.previousUi=ui;return frame;
  }
  private chord(frame: PadFrame, ultDown: boolean, ultHeld: boolean, areaDown: boolean, areaHeld: boolean, areaUp: boolean, now?: number) {
    const t = now ?? 0, window = now === undefined ? 0 : AWAKEN_CHORD;
    const awaken = () => {
      frame.awaken = true; if (this.aiming) frame.area = 'cancel';
      this.ultimateAt = this.areaAt = this.areaLetGo = undefined; this.aiming = false;
    };
    if (ultDown && areaDown) return awaken();
    if (ultDown && this.areaAt !== undefined && t - this.areaAt <= window) return awaken();
    if (areaDown && this.ultimateAt !== undefined && t - this.ultimateAt <= window) return awaken();
    if (ultDown) this.ultimateAt = t;
    if (areaDown) { this.areaAt = t; this.areaLetGo = undefined; this.aiming = true; frame.area = 'press'; }
    if (this.ultimateAt !== undefined && !frame.attack && (!ultHeld || t - this.ultimateAt >= window)) { frame.attack = 'ultimate'; this.ultimateAt = undefined; }
    if (areaUp && this.aiming) this.areaLetGo = t;
    if (this.areaLetGo !== undefined && (this.areaAt === undefined || t - this.areaAt >= window)) { frame.area = 'release'; this.aiming = false; this.areaAt = this.areaLetGo = undefined; }
    if (!areaHeld && !this.aiming) this.areaAt = undefined;
  }
}
