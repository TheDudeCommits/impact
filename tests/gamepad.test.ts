import { describe,it,expect } from 'vitest';
import { AWAKEN_CHORD,GamepadControls,radialDeadzone,type PadState } from '../src/input/gamepad';
function pad(pressed:number[]=[],axes=[0,0,0,0],value?:[number,number]):PadState {
  return {index:0,id:'Xbox Wireless Controller',mapping:'standard',connected:true,axes,
    buttons:Array.from({length:17},(_,i)=>({pressed:pressed.includes(i),value:value?.[0]===i?value[1]:pressed.includes(i)?1:0}))};
}
describe('standard controller combat edges and analog input',()=>{
  it('preserves analog speed after radial deadzones and clamps diagonal magnitude',()=>{
    expect(radialDeadzone(.1,.1)).toEqual([0,0]);
    const half=radialDeadzone(.59,0);expect(half[0]).toBeCloseTo(.5);
    const diagonal=radialDeadzone(1,1);expect(Math.hypot(...diagonal)).toBeCloseTo(1);
    expect(radialDeadzone(NaN,1)).toEqual([0,0]);
  });
  it('requires a fresh press on connection, activation, reset and reconnect',()=>{
    const input=new GamepadControls();
    expect(input.read(pad([2,7,9]),false).ui).toEqual([]);
    expect(input.read(pad([2,7,9]),true)).toMatchObject({attack:undefined,menu:false});
    expect(input.read(pad([2,7,9]),true).attack).toBeUndefined();
    input.read(pad(),true);expect(input.read(pad([2]),true).attack).toBe('light');
    expect(input.read(pad([2]),true).attack).toBeUndefined();
    input.reset();expect(input.read(pad([2]),true).attack).toBeUndefined();
    input.read(undefined,true);expect(input.read(pad([2]),true).attack).toBeUndefined();
  });
  it('maps all combat controls and trigger thresholds without repeats',()=>{
    const input=new GamepadControls();input.read(pad(),true);
    for(const [button,attack] of [[2,'light'],[3,'heavy'],[5,'special'],[6,'ultimate']] as const){
      input.read(pad(),true);expect(input.read(pad([button]),true).attack).toBe(attack);
      expect(input.read(pad([button]),true).attack).toBeUndefined();
    }
    input.read(pad(),true);
    expect(input.read(pad([0,1,4,11],[.59,-.59,.5,-.5]),true)).toMatchObject({jump:true,dash:true,guard:true,target:true});
    const held=input.read(pad([0,1,4,11]),true);expect(held).toMatchObject({jump:false,dash:false,guard:true,target:false});
    input.read(pad(),true);expect(input.read(pad([],undefined,[6,.54]),true).attack).toBeUndefined();
    expect(input.read(pad([],undefined,[6,.56]),true).attack).toBe('ultimate');
    input.read(pad(),true);expect(input.read(pad([],undefined,[7,.54]),true).area).toBeUndefined();
    expect(input.read(pad([],undefined,[7,.56]),true).area).toBe('press');
  });
  it('aims the area on R2 (cast as it comes up), throws the ultimate on L2, and awakens on both together',()=>{
    const input=new GamepadControls();input.read(pad(),true,0);
    const at=(pressed:number[],now:number)=>{const f=input.read(pad(pressed),true,now);return {attack:f.attack,area:f.area,awaken:f.awaken};};
    const none={attack:undefined,area:undefined,awaken:false};
    expect(at([7],10)).toEqual({...none,area:'press'});
    expect(at([7],200)).toEqual(none);
    expect(at([],300)).toEqual({...none,area:'release'});
    expect(at([6],400)).toEqual(none);
    expect(at([6],400+AWAKEN_CHORD)).toEqual({...none,attack:'ultimate'});
    at([],600);
    expect(at([7],700)).toEqual({...none,area:'press'});
    expect(at([6,7],750)).toEqual({...none,awaken:true,area:'cancel'});
    expect(at([],900)).toEqual(none);
    expect(at([6,7],1000)).toEqual({...none,awaken:true});
    expect(at([6,7],1300)).toEqual(none);
  });
  it('navigates menus with edges while combat is disabled',()=>{
    const input=new GamepadControls();input.read(pad(),false);
    expect(input.read(pad([0,13]),false).ui).toEqual(['confirm','next']);
    expect(input.read(pad([0,13]),false).ui).toEqual([]);
    input.read(pad(),false);expect(input.read(pad([1,9]),false)).toMatchObject({menu:true,ui:['back'],attack:undefined});
    expect(input.read(pad([1,9]),false).menu).toBe(false);
    input.read(pad(),false);expect(input.read(pad([],[0,-1,0,0]),false).ui).toEqual(['previous']);
  });
  it('ignores nonstandard layouts and disconnected devices instead of guessing buttons',()=>{
    const input=new GamepadControls();input.read(pad(),true);
    expect(input.read({...pad([7],[1,1,1,1]),mapping:''},true)).toMatchObject({forward:0,right:0,attack:undefined,guard:false});
    expect(input.read({...pad([7]),connected:false},true).attack).toBeUndefined();
  });
});
