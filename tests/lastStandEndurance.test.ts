import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {powerBudget} from '../src/render/powerBudget';
import {nextScale} from '../src/render/ResolutionGovernor';
import {FrameGate} from '../src/render/frameClock';
import {spatialInstances} from '../src/render/objectives/ObjectiveScenery';
import {siegeAttackTime,siegePhase} from '../src/render/horde/siegeMotion';

describe('Last Stand endurance budgets',()=>{
 it('keeps integrated GPUs below the default MSAA/shadow/pixel load without changing the frame target',()=>{
  const q={quality:'high' as const};const air=powerBudget(q,false,true),desktop=powerBudget(q,true,true);
  expect(air.fps).toBe(60);expect(air.gpuBudget).toBe(8.5);expect(air.pixelCap).toBe(1);expect(air.samples).toBe(0);expect(air.bloom).toBe(false);expect(air.shadowSize).toBe(1024);
  expect(desktop.samples).toBe(4);expect(desktop.bloom).toBe(true);expect(desktop.pixelCap).toBe(1.5);
  expect(powerBudget({...q,powerMode:'full'},false,true)).toEqual(desktop);
  expect(powerBudget(q,false,false)).toEqual(desktop);
 });
 it('paces cooler mode evenly on 60 and 120 Hz displays and can return to 60',()=>{
  for(const hz of [60,120]){const gate=new FrameGate();let previous=0;const frames:number[]=[];
   for(let i=1;i<=hz*4;i++){const now=i*1000/hz;if(gate.draw(now,previous,30)){previous=now;if(i>hz)frames.push(now);}}
   expect(frames.length).toBe(90);for(let i=1;i<frames.length;i++)expect(frames[i]-frames[i-1]).toBeCloseTo(1000/30,6);
   let count=0;for(let i=hz*4+1;i<=hz*5;i++){const now=i*1000/hz;if(gate.draw(now,previous,60)){previous=now;count++;}}expect(count).toBe(60);
  }
 });
 it('does not mistake a deliberate 30 FPS limit for GPU overload in browsers without GPU timers',()=>{
  expect(nextScale({scale:.85,sinceDown:10,timed:false,frameMs:1000/30,samples:Array(40).fill(1000/30)})).toBe(.9);
  expect(nextScale({scale:1,sinceDown:10,timed:true,budgetMs:8.5,samples:Array(40).fill(10)})).toBeCloseTo(.95);
 });
 it('partitions buildings without moving or dropping any placement across negative coordinates',()=>{
  const matrices=[-81,-33,-32,-.1,0,31.9,32,81].map(x=>new THREE.Matrix4().makeTranslation(x,0,-x));
  const groups=spatialInstances(matrices);expect(groups.size).toBeGreaterThan(3);
  const all=[...groups.values()].flat();expect(all.length).toBe(matrices.length);expect(new Set(all)).toEqual(new Set(matrices));
  for(const group of groups.values())for(const m of group)expect(matrices).toContain(m);
 });
 it('aligns the hammer and claw with the real hit while preserving start, end and monotonic recovery',()=>{
  for(const [clip,at]of [['hammer',1.5/1.8],['claw',.59/1.2],['combo',.69/1.6]] as const){
   expect(siegeAttackTime(clip,0,1.4,.72,2.2)).toBe(0);expect(siegeAttackTime(clip,.72,1.4,.72,2.2)).toBeCloseTo(at*2.2);
   expect(siegeAttackTime(clip,1.4,1.4,.72,2.2)).toBeCloseTo(2.2);
   let last=0;for(let i=0;i<=84;i++){const t=siegeAttackTime(clip,i/60,1.4,.72,2.2);expect(t).toBeGreaterThanOrEqual(last);last=t;}
  }
  expect(siegeAttackTime('native clip',.5,1,.4,3)).toBe(1.5);
  expect(siegePhase('siege-1')).toBe(siegePhase('siege-1'));expect(siegePhase('siege-1')).not.toBe(siegePhase('siege-2'));
 });
});
