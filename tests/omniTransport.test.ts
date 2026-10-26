import {describe,it,expect} from 'vitest';
import {ArenaSimulation} from '../src/game/simulation';
import {Prediction} from '../src/game/prediction';
import {InputQueue} from '../src/server/InputQueue';
import {MOVES} from '../src/game/moves';
import type {FighterId,PlayerInput,GameSnapshot} from '../src/game/types';
const make=(fighter:FighterId='naruto')=>{const s=new ArenaSimulation({trainingBot:false});s.addPlayer('me',fighter,'Me',false,{x:0,y:0,z:0});return s;};
const directions=[[1,0],[-1,0],[0,1],[0,-1],[-1,1],[1,-1],[0,0]];
function exercise(fighter:FighterId,batch:number,stall:boolean|number=false,jump=false){
 const server=make(fighter),ideal=make(fighter),prediction=new Prediction(),queue=new InputQueue();
 prediction.start('me',server.snapshot(false,true));
 const upload:{tick:number;input:PlayerInput}[]=[],download:{tick:number;s:GameSnapshot}[]=[];
 let maxError=0,maxCorrection=0;
 try{for(let tick=0;tick<250;tick++){
  const [x,z]=directions[Math.min(directions.length-1,Math.floor(tick/25))];
  const input:PlayerInput={seq:tick,moveX:x,moveZ:z,yaw:0,jump:jump&&tick===55,jumpHeld:jump&&tick>=55&&tick<72};
  prediction.submit(input);ideal.submitInput('me',input);ideal.step();upload.push({tick:tick+9,input});
  if(tick%batch===0&&!(stall&&tick>=75&&tick<75+(typeof stall==='number'?stall:20)))while(upload.length&&upload[0].tick<=tick)expect(queue.push(upload.shift()!.input)).toBe(true);
  const accepted=queue.take();if(accepted)server.submitInput('me',accepted);
  server.step(1/60,new Set(accepted?[]:['me']));
  if(tick%2===0)download.push({tick:tick+9,s:server.snapshot(false,true)});
  while(download.length&&download[0].tick<=tick){
   const before=prediction.diagnostics.position!;prediction.reconcile(download.shift()!.s);const after=prediction.diagnostics.position!;
   maxCorrection=Math.max(maxCorrection,Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z));
  }
  const shown=prediction.sample(1/60,server.getPlayer('me')!)!,expected=ideal.getPlayer('me')!;
  maxError=Math.max(maxError,Math.hypot(shown.x-expected.x,shown.y-expected.y,shown.z-expected.z));
 }
 return {maxError,maxCorrection};
 }finally{prediction.stop();server.dispose();ideal.dispose();}
}
describe('ordered input under WAN batching',()=>{
 it.each(['ace','jotaro','vegeta','naruto'] as const)('%s keeps attack hitstop consistent with defender reaction rollback',fighter=>{
  const server=make(fighter),prediction=new Prediction(),queue=new InputQueue();
  server.addPlayer('foe','goku','Foe',false,{x:0,y:0,z:3});prediction.start('me',server.snapshot(true,true));
  const upload:{tick:number;input:PlayerInput}[]=[],download:{tick:number;s:GameSnapshot}[]=[];let maxCorrection=0;
  try{for(let tick=0;tick<360;tick++){
   const moveX=tick<30?0:tick<60?-1:tick<95?1:tick<130?0:tick<170?-1:tick<200?1:0;
   const input:PlayerInput={seq:tick,moveX,moveZ:0,yaw:0,attack:tick===40?'light':tick===150?'heavy':undefined,targetId:'foe'};
   prediction.submit(input);upload.push({tick:tick+9,input});
   while(upload.length&&upload[0].tick<=tick)queue.push(upload.shift()!.input);
   const next=queue.take();if(next)server.submitInput('me',next);server.step(1/60,new Set(next?[]:['me']));
   if(tick%2===0)download.push({tick:tick+9,s:server.snapshot(true,true)});
   while(download.length&&download[0].tick<=tick){
    const before=prediction.diagnostics.position!;prediction.reconcile(download.shift()!.s);const after=prediction.diagnostics.position!;
    maxCorrection=Math.max(maxCorrection,Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z));
   }
  }
  expect(maxCorrection).toBeLessThan(.001);
  }finally{prediction.stop();server.dispose();}
 });
 for(const fighter of Object.keys(MOVES) as FighterId[])it(`${fighter} preserves eight-way travel through 300ms RTT and command bursts`,()=>{
  for(const batch of [1,3,6,17]){const r=exercise(fighter,batch);expect(r.maxError).toBeLessThan(.001);expect(r.maxCorrection).toBeLessThan(.001);}
 });
 it.each([false,true])('a 333ms upload stall preserves reversals, release and jump=%s',jump=>{
  const r=exercise('naruto',3,true,jump);expect(r.maxError).toBeLessThan(.001);expect(r.maxCorrection).toBeLessThan(.001);
 });
 it('preserves consumed ground momentum across a 667ms upload gap',()=>{
  const r=exercise('ace',3,40);expect(r.maxError).toBeLessThan(.001);expect(r.maxCorrection).toBeLessThan(.001);
 });
 it('does not accumulate defender scaling or combo-break budgets across volley replays',()=>{
  const server=make('vegeta'),prediction=new Prediction(),queue=new InputQueue();
  server.addPlayer('foe','goku','Foe',false,{x:0,y:0,z:2});prediction.start('me',server.snapshot(true,true));
  const up:{at:number;input:PlayerInput}[]=[],down:{at:number;s:GameSnapshot}[]=[];let maxCorrection=0;
  try{for(let tick=0;tick<360;tick++){
   const input:PlayerInput={seq:tick,moveX:Math.floor(tick/45)%2?-.25:.25,moveZ:0,yaw:0,attack:tick%35===0?'light':undefined,targetId:'foe'};
   prediction.submit(input);up.push({at:tick+9,input});while(up.length&&up[0].at<=tick)queue.push(up.shift()!.input);
   const next=queue.take();if(next)server.submitInput('me',next);server.step(1/60,new Set(next?[]:['me']));
   if(tick%2===0)down.push({at:tick+9,s:server.snapshot(true,true)});
   while(down.length&&down[0].at<=tick){
    const before=prediction.diagnostics.position!;prediction.reconcile(down.shift()!.s);const after=prediction.diagnostics.position!;
    maxCorrection=Math.max(maxCorrection,Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z));
   }
  }
  expect(maxCorrection).toBeLessThan(.001);
  }finally{prediction.stop();server.dispose();}
 });
 it('ground input starvation does not suspend external shove or extend defensive expiry',()=>{
  const s=make(),a=s.actors.get('me')!;try{
   s.submitInput('me',{seq:0,moveX:1,moveZ:0,yaw:0});s.step();a.evadeUntil=s.serverTime+.1;
   for(let tick=0;tick<50;tick++)s.step(1/60,new Set(['me']));
   const x=a.state.x;a.kx=6;a.kz=0;a.knockbackDrag=3;
   s.step(1/60,new Set(['me']));expect(a.state.x).toBeGreaterThan(x+.02);
   expect(a.evadeUntil).toBeLessThan(s.serverTime);expect(a.state.guarding).toBe(false);
  }finally{s.dispose();}
 });
 it('does not acknowledge received commands before their simulation tick',()=>{
  const sim=make(),queue=new InputQueue();try{
   for(let seq=0;seq<6;seq++)queue.push({seq,moveX:1,moveZ:0,yaw:0});
   expect(sim.snapshot().players[0].ackSeq).toBe(-1);
   sim.submitInput('me',queue.take());sim.step();expect(sim.snapshot().players[0].ackSeq).toBe(0);expect(queue.length).toBe(5);
  }finally{sim.dispose();}
 });
 it('bounds queued time, rejects duplicate/invalid commands, and never accelerates playback',()=>{
  const queue=new InputQueue();for(let seq=0;seq<InputQueue.CAPACITY;seq++)expect(queue.push({seq,moveX:1,moveZ:0,yaw:0})).toBe(true);
  expect(queue.push({seq:60,moveX:1,moveZ:0,yaw:0})).toBe(false);expect(queue.push({seq:59,moveX:1,moveZ:0,yaw:0})).toBe(false);
  expect(queue.push({seq:61,moveX:NaN,moveZ:0,yaw:0})).toBe(false);
  for(let i=0;i<60;i++)expect(queue.take()?.seq).toBe(i);
  expect(queue.take()).toBeUndefined();
 });
 it('keeps a starved fighter vulnerable and releases unreleased state after bounded grace',()=>{
  const sim=make(),a=sim.actors.get('me')!;try{
   sim.submitInput('me',{seq:0,moveX:0,moveZ:0,yaw:0,attack:'heavy'});sim.step();
   const expiry=a.state.cooldowns.heavy,cast=a.cast!;a.evadeUntil=sim.serverTime+.1;
   for(let i=0;i<30;i++)sim.step(1/60,new Set(['me']));
   expect(a.cast===null||a.cast===cast).toBe(true);expect(cast.networkHold).toBeLessThanOrEqual(.35+1e-9);
   expect(sim.serverTime-cast.start).toBeGreaterThan(.5-.35-.02);
   expect(a.state.guarding).toBe(false);expect(a.dashUntil).toBe(0);
   expect(a.evadeUntil).toBeLessThan(sim.serverTime);expect(a.state.cooldowns.heavy).toBe(expiry);
   sim.addPlayer('foe','goku','Foe',false,{x:0,y:0,z:1.1});
   for(let i=0;i<20;i++){sim.submitInput('foe',{seq:i,moveX:0,moveZ:0,yaw:Math.PI,attack:i===0?'light':undefined});sim.step(1/60,new Set(['me']));}
   expect(a.state.hp).toBeLessThan(1000);expect(a.lastDamageAt).toBeGreaterThan(.5);
  }finally{sim.dispose();}
 });
});

describe('render-rate-independent local movement',()=>{
 it.each([60,90,120,144])('draws continuous travel at %iHz between input ticks',fps=>{
  const server=make(),prediction=new Prediction();prediction.start('me',server.snapshot(false,true));
  let accumulator=0,seq=0,previous:number|undefined,maxStepError=0;
  try{for(let frame=0;frame<fps*2;frame++){
   accumulator+=1/fps;
   while(accumulator>=1/60-1e-12){prediction.submit({seq:seq++,moveX:1,moveZ:0,yaw:0});accumulator-=1/60;}
   const shown=prediction.sample(1/fps,server.getPlayer('me')!,accumulator*60)!;
   if(previous!==undefined&&frame>fps/2)maxStepError=Math.max(maxStepError,Math.abs(shown.x-previous-7.5/fps));
   previous=shown.x;
  }
  expect(maxStepError).toBeLessThan(.00001);
  }finally{prediction.stop();server.dispose();}
 });
 it.each([false,true])('sparse packets cannot suspend a jump or ordinary fall (fall=%s)',fall=>{
  const sim=make(),a=sim.actors.get('me')!;let maximumHeight=0;if(fall){a.state.y=5;a.state.grounded=false;}
  try{for(let tick=0;tick<180;tick++){
   if(tick%20===0)sim.submitInput('me',{seq:tick,moveX:0,moveZ:0,yaw:0,jump:!fall&&tick===0,jumpHeld:true});
   sim.step(1/60,new Set(tick%20===0?[]:['me']));maximumHeight=Math.max(maximumHeight,a.state.y);
  }
  expect(maximumHeight).toBeGreaterThan(.2);expect(a.state.grounded).toBe(true);expect(a.state.y).toBe(0);
  expect(a.motionNetworkHold).toBeLessThanOrEqual(.35);
  }finally{sim.dispose();}
 });
});
