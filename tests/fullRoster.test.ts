import { PINNED_RELEASED } from './rosterPin';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import {describe,it,expect} from 'vitest';
import {ArenaSimulation} from '../src/game/simulation';
import {MOVES,damageScale} from '../src/game/moves';
import {FIGHTERS} from '../src/config';
import type {FighterId,PlayerInput} from '../src/game/types';
const realised=(move:{damage:number;finisherDamage?:number;contacts:number[];schedule?:readonly number[]},n:number,finisherAt=move.contacts.length)=>{let sum=0;for(let i=1;i<=n;i++)sum+=Math.round((move.schedule?.[i-1]??(i===finisherAt?move.finisherDamage??move.damage:move.damage))*damageScale(i));return sum;};
function fixture(fighter:FighterId){const sim=new ArenaSimulation({trainingBot:false});sim.addPlayer('a',fighter,'A',false,{x:0,y:0,z:0});sim.addPlayer('b','goku','B',false,{x:0,y:0,z:3});sim.addPlayer('far','naruto','C',false,{x:12,y:0,z:3});let seq=0;const input=(id:string,more:Partial<PlayerInput>)=>sim.submitInput(id,{seq:seq++,moveX:0,moveZ:0,yaw:0,...more});const step=(seconds:number,held?:()=>void)=>{for(let i=0;i<Math.round(seconds*60);i++){held?.();sim.step();}};return{sim,input,step};}
describe('complete roster authority',()=>{
 it('admits twelve clients across the released roster (the shop\'s twenty among them) with distinct kits',()=>{const sim=new ArenaSimulation({roomMode:'match',trainingBot:false});const roster=RELEASED_FIGHTERS;expect(roster).toHaveLength(PINNED_RELEASED);for(let i=0;i<12;i++)expect(sim.addPlayer('p'+i,roster[i%roster.length]).fighter).toBe(roster[i%roster.length]);expect(sim.startMatch()).toBe(true);for(const id of roster)expect(new Set(Object.values(MOVES[id]).filter(m=>!m.area).map(m=>m.name)).size).toBe(4);});
 const stopTest=(fighter:'jotaro'|'dio')=>{const{sim,input,step}=fixture(fighter);sim.actors.get('a')!.state.ultimate=100;
  const world=MOVES[fighter].ultimate,stop=world.timeStop!,stopAt=world.contacts[stop.contact],first=world.contacts[stop.contact+1],resumes=stopAt+stop.duration;
  input('a',{attack:'ultimate',targetId:'b'});step((stopAt+first)/2);const frozen=sim.getPlayer('b')!;
  expect(frozen.timeStopped).toBe(true);expect(frozen.hp,'nothing is paid before the clock stops').toBe(1000);expect(sim.getPlayer('far')!.timeStopped).toBeFalsy();
  expect(frozen.heldBy,'the stop is the opener, and it holds whoever it caught').toBe('a');
  const farFrom=sim.getPlayer('far')!.x;
  step(resumes-.15-(stopAt+first)/2,()=>{input('b',{moveX:1,attack:'light'});input('far',{moveX:1});});
  expect(sim.getPlayer('b')!.x).toBe(frozen.x);expect(sim.getPlayer('b')!.z).toBe(frozen.z);expect(sim.getPlayer('b')!.actionTime).toBe(frozen.actionTime);
  expect(sim.getPlayer('far')!.x,'the far one keeps moving').toBeGreaterThan(farFrom+4);
  expect(sim.getPlayer('b')!.hp,'the barrage has been landing').toBeLessThan(1000);
  step(.4);expect(sim.getPlayer('b')!.timeStopped).toBe(false);expect(sim.getPlayer('b')!.heldBy,'the finisher lets them go').toBeUndefined();step(3);
  const blows=world.contacts.length-1;
  expect(sim.getPlayer('b')!.hp,'and finishes').toBe(1000-realised(world,blows,blows));};
 it('freezes nearby opponents without early damage and restores movement after the finisher',()=>stopTest('jotaro'));
 it('stops time for DIO the same way, and the road roller finisher lands as it resumes',()=>stopTest('dio'));
 it('opens Infinite Void on contact 0: Gojo freezes a nearby opponent, the far one keeps moving, and the Black Flash lands once time resumes',()=>{const{sim,input,step}=fixture('gojo');sim.actors.get('a')!.state.ultimate=100;const void_=MOVES.gojo.ultimate,stop=void_.timeStop!;expect(stop.contact).toBe(0);input('a',{attack:'ultimate',targetId:'b'});step(void_.contacts[0]+.1);const frozen=sim.getPlayer('b')!;expect(frozen.timeStopped).toBe(true);expect(frozen.hp,'the Void itself does no damage').toBe(1000);expect(sim.getPlayer('far')!.timeStopped).toBeFalsy();step(1,()=>{input('b',{moveX:1,attack:'light'});input('far',{moveX:1});});expect(sim.getPlayer('b')!.x).toBe(frozen.x);expect(sim.getPlayer('b')!.z).toBe(frozen.z);expect(sim.getPlayer('far')!.x).toBeGreaterThan(13);step(stop.duration);expect(sim.getPlayer('b')!.timeStopped).toBe(false);step(void_.duration);
  const strikes=void_.contacts.length-1;
  expect(sim.getPlayer('b')!.hp,'every strike and the Black Flash landed').toBe(1000-realised(void_,strikes,strikes));});
 it('does not freeze through an occluding wall',()=>{const{sim,input,step}=fixture('jotaro');Object.assign(sim,{collision:{move:(_id:unknown,_p:unknown,d:unknown)=>d,raycast:(from:{x:number;y:number;z:number})=>({...from,z:1})}});sim.actors.get('a')!.state.ultimate=100;input('a',{attack:'ultimate'});step(1);expect(sim.getPlayer('b')!.timeStopped).toBeFalsy();});
 it('keeps Amaterasu at the cast target position when the enemy runs away',()=>{const{sim,input,step}=fixture('sasuke');input('a',{attack:'special',targetId:'b'});
  const burns=MOVES.sasuke.special.contacts;step((burns[0]+burns[1])/2);const first=sim.getPlayer('b')!.hp;expect(first).toBe(1000-MOVES.sasuke.special.damage);Object.assign(sim.actors.get('b')!.state,{x:10});step(3);expect(sim.getPlayer('b')!.hp).toBe(first);const releases=sim.snapshot().events.filter(e=>e.kind==='release'&&e.actorId==='a');expect(releases.length).toBe(5);expect(releases.every(e=>e.endpoint?.x===0&&e.endpoint.z===3)).toBe(true);});
 it('keeps an ultimate running through anything but another ultimate',()=>{
  const run=(slot:'light'|'special'|'ultimate')=>{
   const sim=new ArenaSimulation({trainingBot:false});
   sim.addPlayer('a','goku','A',false,{x:0,y:0,z:0});
   sim.addPlayer('b','sasuke','B',false,{x:0,y:0,z:1.6});
   sim.actors.get('a')!.state.ultimate=100;
   sim.actors.get('b')!.state.ultimate=100;
   sim.submitInput('a',{seq:1,moveX:0,moveZ:0,yaw:0,attack:'ultimate',targetId:'b'});
   sim.step();
   sim.submitInput('b',{seq:1,moveX:0,moveZ:0,yaw:Math.PI,attack:slot,targetId:'a'});
   let landed=false;
   for(let i=0;i<180&&!landed;i++){sim.step();landed=sim.getPlayer('a')!.hp<1000;}
   sim.step();
   return {landed,action:sim.getPlayer('a')!.action};
  };
  const armoured=run('light');
  expect(armoured.landed).toBe(true);
  expect(armoured.action).toBe('ultimate');
  const traded=run('special');
  expect(traded.landed).toBe(true);
  expect(traded.action).toBe('ultimate');
  const broken=run('ultimate');
  expect(broken.landed).toBe(true);
  expect(broken.action).not.toBe('ultimate');
 });
 it('lands the full eight-hit ORA sequence and only launches on its finisher',()=>{const{sim,input,step}=fixture('jotaro');Object.assign(sim.actors.get('b')!.state,{z:2});input('a',{attack:'special',targetId:'b'});const ora=MOVES.jotaro.special;
  const landed=()=>sim.snapshot().events.filter(e=>e.kind==='hit'&&e.actorId==='a').length;
  for(let i=0;i<240&&landed()<7;i++)step(1/60);expect(landed()).toBe(7);expect(sim.getPlayer('b')!.hp).toBe(1000-realised(ora,7));const before=sim.getPlayer('b')!.z;step(ora.duration);expect(sim.getPlayer('b')!.hp).toBe(1000-realised(ora,8));
  const singles=(Object.keys(MOVES) as FighterId[]).map(f=>MOVES[f].special).filter(m=>m.contacts.length===1&&m.name!=='Wind Style: Rasenshuriken').map(m=>m.damage);
  expect(realised(ora,8),`ORA realises ${realised(ora,8)} cold`).toBeGreaterThanOrEqual(Math.min(...singles)-3);
  expect(realised(ora,8)).toBeLessThanOrEqual(Math.max(...singles));expect(sim.getPlayer('b')!.z).toBeGreaterThan(before);expect(sim.snapshot().events.filter(e=>e.kind==='hit'&&e.actorId==='a')).toHaveLength(8);});
 it('spawns Indra’s Arrow at the summoned bow height',()=>{const{sim,input,step}=fixture('sasuke');sim.actors.get('a')!.state.ultimate=100;input('a',{attack:'ultimate',targetId:'b'});step(.1);const cast=sim.snapshot().events.find(e=>e.kind==='cast'&&e.actorId==='a')!;expect(cast.origin!.y).toBeCloseTo(2.94,2);expect(cast.origin!.x).toBeCloseTo(.54,2);});

 it('drives the Lightning Blade in as the opener, and Kamui finishes the victim it holds',()=>{const{sim,input,step}=fixture('kakashi');sim.actors.get('a')!.state.ultimate=100;Object.assign(sim.actors.get('b')!.state,{z:3.6});const kamui=MOVES.kakashi.ultimate;input('a',{attack:'ultimate',targetId:'b'});step(kamui.contacts[0]-.35);expect(sim.getPlayer('a')!.z,'charged where he stands').toBeCloseTo(0,1);expect(sim.getPlayer('b')!.hp).toBe(1000);step(.45);expect(sim.getPlayer('a')!.z,'and driven in').toBeGreaterThan(1.5);expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);expect(sim.getPlayer('b')!.heldBy).toBe('a');step(kamui.duration);expect(sim.getPlayer('b')!.hp).toBe(1000-realised(kamui,kamui.contacts.length));});

});
