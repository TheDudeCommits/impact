import { afterEach,describe,it,expect,vi } from 'vitest';
import { Input } from '../src/input';
import { bindKey, resetBindings } from '../src/input/bindings';
import { ArenaSimulation } from '../src/game/simulation';
import type { PadState } from '../src/input/gamepad';
function fixture(){
  const win=new EventTarget(),canvas=Object.assign(new EventTarget(),{requestPointerLock:vi.fn()});
  const doc=Object.assign(new EventTarget(),{hidden:false,pointerLockElement:canvas});
  let pads:PadState[]=[];
  vi.stubGlobal('window',win);vi.stubGlobal('document',doc);vi.stubGlobal('navigator',{getGamepads:()=>pads});
  const input=new Input(canvas as unknown as HTMLCanvasElement);
  const emit=(target:EventTarget,type:string,properties:Record<string,unknown>={})=>target.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),properties));
  const pad=(buttons:number[]=[],axes=[0,0,0,0])=>{pads=[{index:0,id:'Xbox',mapping:'standard',connected:true,axes,buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),value:buttons.includes(i)?1:0}))}];};
  input.enabled=true;input.update(1/60);
  return {input,win,canvas,doc,emit,pad,disconnect:()=>{pads=[];}};
}
afterEach(()=>vi.unstubAllGlobals());
describe('browser input command integration',()=>{
  it('preserves side and backward dash classification while Naruto faces ordinary running',()=>{
    for(const [key,kind,seconds]of [['KeyS','back',.16],['KeyD','side',.18],['KeyW','forward',.22]]as const){
      const {input,win,emit}=fixture();input.yaw=0;
      const sim=new ArenaSimulation({trainingBot:false,seed:5});
      try{
        sim.addPlayer('n','naruto','Naruto',false,{x:0,y:0,z:0});
        for(let i=0;i<60;i++){sim.submitInput('n',input.command(null));sim.step();}
        emit(win,'keydown',{code:key,repeat:false});emit(win,'keydown',{code:'ShiftLeft',repeat:false});
        sim.submitInput('n',input.command(null));sim.step();
        const actor=sim.actors.get('n')!;
        expect(actor.dashKind).toBe(kind);expect(actor.dashSeconds).toBeCloseTo(seconds);
        if(kind==='side')expect(actor.evadeUntil).toBeLessThanOrEqual(sim.serverTime);
      }finally{sim.dispose();}
    }
  });
  it('keeps travel separate from view aim without rotating the camera input basis',()=>{
    const {input,win,emit}=fixture();input.yaw=.7;
    emit(win,'keydown',{code:'KeyD',repeat:false});
    const a=input.command('opponent'),b=input.command('opponent');
    expect(a.yaw).toBeCloseTo(.7);expect(b.moveX).toBeCloseTo(a.moveX);expect(input.yaw).toBe(.7);
    emit(win,'keydown',{code:'KeyF',repeat:false});expect(input.command('opponent').yaw).toBe(.7);
    emit(win,'keyup',{code:'KeyF'});emit(win,'keydown',{code:'KeyK',repeat:false});expect(input.command('opponent')).toMatchObject({yaw:.7,attack:'heavy'});
    expect(input.command('opponent').yaw).toBe(.7);
  });
  it('supports J and K in addition to mouse buttons, consumes action edges once and suppresses key repeat',()=>{
    const {input,win,canvas,emit}=fixture();
    for(const [code,attack] of [['KeyJ','light'],['KeyK','heavy'],['KeyQ','special'],['KeyR','ultimate']]){
      emit(win,'keydown',{code,repeat:false});expect(input.command(null).attack).toBe(attack);expect(input.command(null).attack).toBeUndefined();
      emit(win,'keydown',{code,repeat:true});expect(input.command(null).attack).toBeUndefined();emit(win,'keyup',{code});
    }
    emit(canvas,'mousedown',{button:0});expect(input.command(null).attack).toBe('light');
    emit(canvas,'mousedown',{button:2});expect(input.command(null).attack).toBe('heavy');
    emit(win,'keydown',{code:'KeyW',repeat:false});emit(win,'keydown',{code:'KeyD',repeat:false});const move=input.command(null);expect(Math.hypot(move.moveX,move.moveZ)).toBeCloseTo(1);
  });
  it('aims the area slot while G is held and casts it at the reticle as G comes up; F puts the aim away',()=>{
    const {input,win,emit}=fixture();
    emit(win,'keydown',{code:'KeyG',repeat:false});expect(input.aim.active).toBe(true);expect(input.aim.view.source).toBe('keyboard');
    input.aim.follow({x:0,z:0},0,{x:3,z:4},14,4,true);
    expect(input.command(null).attack,'nothing is thrown while aiming').toBeUndefined();
    emit(win,'keyup',{code:'KeyG'});
    expect(input.command(null)).toMatchObject({attack:'area',aim:{x:3,z:4}});expect(input.command(null).attack).toBeUndefined();
    emit(win,'keydown',{code:'KeyG',repeat:false});input.aim.follow({x:0,z:0},0,undefined,14,4,true);
    emit(win,'keydown',{code:'KeyF',repeat:false});expect(input.aim.active).toBe(false);
    emit(win,'keyup',{code:'KeyG'});expect(input.command(null).attack).toBeUndefined();
  });
  it('closes menus with Escape even while an input field has focus and ignores repeats',()=>{
    const {input,win,emit}=fixture();Object.assign(win,{matches:()=>true});const menu=vi.fn();input.onMenu=menu;
    emit(win,'keydown',{code:'Escape',repeat:false});emit(win,'keydown',{code:'Escape',repeat:true});expect(menu).toHaveBeenCalledTimes(1);
    expect(menu).toHaveBeenLastCalledWith('keyboard','back');
    emit(win,'keydown',{code:'KeyP',repeat:false});expect(menu).toHaveBeenCalledTimes(1);
    emit(win,'keydown',{code:'KeyJ',repeat:false});expect(input.command(null).attack).toBeUndefined();
  });
  it('pauses on P, once per press, and on Esc when a binding has taken P',()=>{
    const {input,win,emit}=fixture();const menu=vi.fn();input.onMenu=menu;
    emit(win,'keydown',{code:'KeyP',repeat:false});emit(win,'keydown',{code:'KeyP',repeat:true});
    expect(menu).toHaveBeenCalledTimes(1);expect(menu).toHaveBeenLastCalledWith('keyboard','pause');
    try{
      expect(bindKey('guard',0,'KeyP')).toBe(true);
      emit(win,'keydown',{code:'Escape',repeat:false});expect(menu).toHaveBeenLastCalledWith('keyboard','menu');
      emit(win,'keydown',{code:'KeyP',repeat:false});expect(menu).toHaveBeenCalledTimes(2);
    }finally{resetBindings('keyboard');}
  });
  it('uses dt-based controller camera rotation and preserves analog movement magnitude',()=>{
    const a=fixture();a.pad();a.input.update(0);a.pad([],[.59,0,.75,-.6]);const yaw=a.input.yaw,pitch=a.input.pitch;
    for(let i=0;i<30;i++)a.input.update(1/30);const deltaYaw=a.input.yaw-yaw,deltaPitch=a.input.pitch-pitch;
    expect(Math.hypot(a.input.command(null).moveX,a.input.command(null).moveZ)).toBeCloseTo(.5);
    const b=fixture();b.pad();b.input.update(0);b.pad([],[.59,0,.75,-.6]);
    for(let i=0;i<60;i++)b.input.update(1/60);
    expect(b.input.yaw-yaw).toBeCloseTo(deltaYaw,10);expect(b.input.pitch-pitch).toBeCloseTo(deltaPitch,10);expect(b.input.mode).toBe('controller');
  });
  it('clears controller controls on disconnect and never moves a blurred window',()=>{
    const {input,win,pad,emit,disconnect}=fixture();pad();input.update(0);pad([4],[0,-1,0,0]);input.update(1/60);
    expect(input.command(null).guard).toBe(true);expect(Math.abs(input.command(null).moveZ)).toBeGreaterThan(.9);
    emit(win,'blur');input.update(1/60);expect(input.command(null)).toMatchObject({moveX:0,moveZ:0,guard:false});
    emit(win,'focus');input.update(1/60);disconnect();input.update(1/60);expect(input.command(null)).toMatchObject({moveX:0,moveZ:0,guard:false});expect(input.mode).toBe('keyboard');
  });
});
