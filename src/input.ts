import type { AttackSlot, PlayerInput } from './game/types';
import { GamepadControls, type InputMode, type PadFamily, type UiAction } from './input/gamepad';
import { Rumble, type Actuator, type Pulse } from './input/rumble';
import { ACTIONS, BINDINGS_EVENT, boundTo, heldBinding, isCapturingBinding, pauseKey, type BindingAction } from './input/bindings';
export type MenuVia='menu'|'back'|'pause';
import { touchFirst } from './input/device';
import { AreaAim, type AimPoint } from './input/areaAim';
export type { InputMode, PadFamily, UiAction } from './input/gamepad';
export const TOUCH_LOOK = 1.6;
export type TouchAction = 'light' | 'heavy' | 'special' | 'ultimate' | 'jump' | 'dash' | 'awaken' | 'target';
export const AIM_MOUSE = .035, AIM_STICK = 17;

export class Input {
  keys = new Set<string>();
  yaw = Math.PI;
  pitch = 0.02;
  sensitivity = 1;
  enabled = false;
  arrowsLook = false;
  mode: InputMode = touchFirst() ? 'touch' : 'keyboard';
  controllerLabel = '';
  family: PadFamily = 'generic';
  readonly rumble = new Rumble();
  readonly aim = new AreaAim();
  private aimPoint?: AimPoint;
  private actuator?: Actuator;
  private seq=0;
  private attack?:AttackSlot;
  private jump=false;
  private dash=false;
  private awaken=false;
  private pad = new GamepadControls();
  private padForward=0;
  private padRight=0;
  private padGuard=false;
  private padJumpHeld=false;
  private touchForward=0;
  private touchRight=0;
  private touchGuard=false;
  private touchJumpHeld=false;
  private touchedAt=-Infinity;
  private pointerType='mouse';
  private selectedPad:number|null=null;
  private wasEnabled=false;
  private focused=true;
  onMenu=(_source:'keyboard'|'controller',_via:MenuVia='menu')=>{};
  onTarget=()=>{};
  onInteract=(_explicit=false)=>false;
  onModeChange=(_mode:InputMode)=>{};
  onUiAction=(_action:UiAction)=>{};
  constructor(readonly canvas:HTMLCanvasElement) {
    window.addEventListener(BINDINGS_EVENT,()=>this.clear());
    window.addEventListener('keydown',e=>{
      if(isCapturingBinding())return;
      if (e.code==='Escape') { if(!e.repeat){this.useMode('keyboard');this.onMenu('keyboard',pauseKey()==='Escape'?'menu':'back');}return; }
      if ((e.target as HTMLElement | null)?.matches?.('input,select,textarea')) return;
      if (e.code==='KeyP'&&pauseKey()==='KeyP') { e.preventDefault(); if(!e.repeat){this.useMode('keyboard');this.onMenu('keyboard','pause');}return; }
      if (e.isTrusted&&this.mode==='touch') this.useMode('keyboard');
      if (!this.enabled) return;
      if(e.code==='KeyB'&&!e.repeat&&!ACTIONS.some(action=>boundTo(action,e.code))&&this.onInteract(true)){e.preventDefault();this.clear();return;}
      if (ACTIONS.some(action=>boundTo(action,e.code))||e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code);this.useMode('keyboard');
      if(e.repeat)return;
      this.press(e.code);
    });
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);if(boundTo('area',e.code))this.releaseAim('keyboard');});
    window.addEventListener('mouseup',e=>{this.keys.delete(`Mouse${e.button}`);if(boundTo('area',`Mouse${e.button}`))this.releaseAim('keyboard');});
    for(const type of ['touchstart','touchend'])window.addEventListener(type,()=>{this.touchedAt=performance.now();},{capture:true,passive:true});
    window.addEventListener('pointerdown',e=>{this.pointerType=e.pointerType||'mouse';},{capture:true,passive:true});
    document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==canvas)this.clear();});
    window.addEventListener('blur',()=>{this.focused=false;this.clear();this.rumble.stop(this.actuator);});
    window.addEventListener('focus',()=>{this.focused=true;this.clear();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();this.rumble.stop(this.actuator);}});
    window.addEventListener('gamepaddisconnected',e=>{if(e.gamepad.index===this.selectedPad){this.clear();this.rumble.stop(this.actuator);this.actuator=undefined;this.selectedPad=null;this.controllerLabel='';this.useMode(touchFirst()?'touch':'keyboard');}});
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('mousedown',e=>{
      if(!this.enabled||isCapturingBinding()||this.fromTouch())return;
      this.useMode('keyboard');
      if(document.pointerLockElement!==canvas){try{(canvas.requestPointerLock() as unknown as Promise<void>|undefined)?.catch?.(()=>{});}catch{ }return;}
      this.keys.add(`Mouse${e.button}`);this.press(`Mouse${e.button}`);
    });
    document.addEventListener('mousemove',e=>{
      if(!this.enabled||document.pointerLockElement!==canvas)return;
      if(e.movementX||e.movementY)this.useMode('keyboard');
      if(this.aim.active&&this.aim.view.source==='keyboard'){this.aim.nudge(e.movementX*AIM_MOUSE*this.sensitivity,-e.movementY*AIM_MOUSE*this.sensitivity,this.yaw);return;}
      this.yaw-=e.movementX*0.0023*this.sensitivity;
      this.pitch=Math.max(-0.28,Math.min(0.72,this.pitch+e.movementY*0.0018*this.sensitivity));
    });
  }
  private press(code:string){
    if(boundTo('jump',code))this.jump=true;
    if(boundTo('dash',code))this.dash=true;
    for(const slot of ['light','heavy','special','ultimate'] as const)if(boundTo(slot,code))this.attack=slot;
    if(boundTo('awaken',code))this.awaken=true;
    if(boundTo('area',code))this.aim.begin('keyboard');
    else if(boundTo('guard',code)&&this.aim.active)this.aim.cancel();
    if(boundTo('target',code))this.onTarget();
  }
  useMode(mode:InputMode){if(this.mode!==mode){this.mode=mode;this.onModeChange(mode);}}
  private fromTouch(){return this.pointerType!=='mouse'||performance.now()-this.touchedAt<1000;}
  private releaseAim(source:'keyboard'|'pad'|'touch'){
    if(!this.aim.active||this.aim.view.source!==source)return;
    const point=this.aim.release();
    if(point&&this.enabled){this.attack='area';this.aimPoint=point;}
  }
  touchAim(phase:'start'|'move'|'end'|'cancel',right=0,forward=0){
    this.touchedAt=performance.now();this.useMode('touch');
    if(!this.enabled||isCapturingBinding()){this.aim.cancel();return;}
    if(phase==='start')this.aim.begin('touch');
    else if(phase==='move'){if(this.aim.view.source==='touch')this.aim.place(right,forward);}
    else if(phase==='end')this.releaseAim('touch');
    else if(this.aim.view.source==='touch')this.aim.cancel();
  }
  clear(){this.aim.cancel();this.aimPoint=undefined;this.keys.clear();this.attack=undefined;this.jump=false;this.dash=false;this.awaken=false;this.padForward=0;this.padRight=0;this.padGuard=false;this.padJumpHeld=false;this.touchForward=0;this.touchRight=0;this.touchGuard=false;this.touchJumpHeld=false;this.pad.reset();}
  touchHold(forward:number,right:number,guard:boolean,jumpHeld:boolean){this.touchForward=forward;this.touchRight=right;this.touchGuard=guard;this.touchJumpHeld=jumpHeld;}
  touchPress(action:TouchAction){
    this.touchedAt=performance.now();this.useMode('touch');
    if(!this.enabled||isCapturingBinding())return;
    if(action==='jump'&&this.onInteract()){this.clear();return;}
    if(action==='jump')this.jump=true;else if(action==='dash')this.dash=true;else if(action==='awaken')this.awaken=true;else if(action==='target')this.onTarget();else this.attack=action;
  }
  touchLook(dx:number,dy:number){
    if(!this.enabled||!Number.isFinite(dx)||!Number.isFinite(dy))return;
    this.yaw-=dx*0.0023*TOUCH_LOOK*this.sensitivity;
    this.pitch=Math.max(-0.28,Math.min(0.72,this.pitch+dy*0.0018*TOUCH_LOOK*this.sensitivity));
  }
  update(dt:number){
    if(isCapturingBinding()){this.clear();return;}
    if(this.wasEnabled!==this.enabled){this.clear();this.wasEnabled=this.enabled;}
    const pads=typeof navigator.getGamepads==='function'?Array.from(navigator.getGamepads()):[];
    const current=pads.find(p=>p?.connected&&p.mapping==='standard'&&p.index===this.selectedPad)??pads.find(p=>p?.connected&&p.mapping==='standard');
    if(!current&&this.selectedPad!==null){this.clear();this.actuator=undefined;this.selectedPad=null;this.controllerLabel='';this.useMode(touchFirst()?'touch':'keyboard');}
    if(current){this.selectedPad=current.index;this.actuator=(current as {vibrationActuator?:Actuator|null}).vibrationActuator??undefined;}
    const frame=this.pad.read(current??undefined,this.enabled&&!document.hidden&&this.focused,performance.now());
    this.controllerLabel=frame.label;
    if(document.hidden||!this.focused)return;
    if(frame.label&&frame.family!==this.family){this.family=frame.family;if(this.mode==='controller')this.onModeChange('controller');}
    if(frame.active)this.useMode('controller');
    if(this.mode==='controller')this.rumble.flush(performance.now(),this.actuator);
    this.padForward=frame.forward;this.padRight=frame.right;this.padGuard=frame.guard;
    if(frame.menu){this.clear();this.onMenu('controller');return;}
    for(const action of frame.ui)this.onUiAction(action);
    if(!this.enabled)return;
    if((frame.interact||frame.jump)&&this.onInteract(!!frame.interact)){this.clear();return;}
    if(frame.attack)this.attack=frame.attack;
    this.padJumpHeld=frame.jumpHeld;this.jump ||= frame.jump;this.dash ||= frame.dash;this.awaken ||= frame.awaken;
    if(frame.target)this.onTarget();
    if(frame.area==='press')this.aim.begin('pad');
    else if(frame.area==='release')this.releaseAim('pad');
    else if(frame.area==='cancel'&&this.aim.view.source==='pad')this.aim.cancel();
    if(frame.guardPressed&&this.aim.active)this.aim.cancel();
    const seconds=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));
    if(this.aim.active&&this.aim.view.source==='pad'){this.aim.nudge(frame.lookX*AIM_STICK*seconds*this.sensitivity,-frame.lookY*AIM_STICK*seconds*this.sensitivity,this.yaw);return;}
    this.yaw-=frame.lookX*2.7*seconds*this.sensitivity;
    this.pitch=Math.max(-.28,Math.min(.72,this.pitch+frame.lookY*1.75*seconds*this.sensitivity));
  }
  feel(pulse:Pulse){if(this.mode==='controller'&&this.focused&&this.actuator?.playEffect)this.rumble.add(pulse);}
  command(targetId:string|null,viewYaw=this.yaw):PlayerInput {
    const arrows=!this.arrowsLook;
    const held=(action:BindingAction)=>heldBinding(action,this.keys);
    const forward=Number(held('forward')||arrows&&this.keys.has('ArrowUp'))-Number(held('backward')||arrows&&this.keys.has('ArrowDown'))+this.padForward+this.touchForward;
    const right=Number(held('right')||arrows&&this.keys.has('ArrowRight'))-Number(held('left')||arrows&&this.keys.has('ArrowLeft'))+this.padRight+this.touchRight;
    const magnitude=Math.max(1,Math.hypot(forward,right));
    const moveX=(Math.sin(viewYaw)*forward-Math.cos(viewYaw)*right)/magnitude;
    const moveZ=(Math.cos(viewYaw)*forward+Math.sin(viewYaw)*right)/magnitude;
    const command:PlayerInput={seq:++this.seq,moveX,moveZ,yaw:viewYaw,guard:held('guard')||this.padGuard||this.touchGuard,targetId};
    if(this.attack)command.attack=this.attack;
    if(this.attack==='area'&&this.aimPoint)command.aim={x:+this.aimPoint.x.toFixed(2),z:+this.aimPoint.z.toFixed(2)};
    if(this.jump)command.jump=true;
    if(held('jump')||this.padJumpHeld||this.touchJumpHeld)command.jumpHeld=true;
    if(this.dash)command.dash=true;
    if(this.awaken)command.awaken=true;
    this.attack=undefined;this.aimPoint=undefined;this.jump=false;this.dash=false;this.awaken=false;
    return command;
  }
}
