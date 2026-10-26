import * as T from'three';import{describe,expect,it}from'vitest';import type{CombatEvent,FighterId,PlayerState}from'../src/game/types';import type{Fighter}from'../src/render/Fighter';import type{Flight}from'../src/render/CombatEffects';import{ErenTitan,EREN_TITAN_LIMITS}from'../src/render/signature/ErenTitan';import{MoveStage}from'../src/render/signature/MoveStage';
function actor(id:string,patch:Partial<PlayerState>={}):Fighter{const group=new T.Group(),joints=new Map<string,T.Bone>();for(const n of['LeftHand','RightHand','Hips']){const b=new T.Bone();b.name=n;b.position.set(n==='LeftHand'?-.3:n==='RightHand'?.3:0,n==='Hips'?.8:1.2,.3);group.add(b);joints.set(n,b);}group.updateMatrixWorld(true);return{group,joints,state:{id,fighter:'eren' as FighterId,alive:true,action:'idle',actionTime:0,actionDuration:4.2,actionSeq:2,...patch}as PlayerState}as unknown as Fighter;}
const ev=(p:Partial<CombatEvent>={}):CombatEvent=>({id:1,kind:'hit',fighter:'eren' as FighterId,actorId:'a',targetId:'b',actionSeq:2,slot:'ultimate',contactIndex:3,serverTime:10,...p});
function setup(p:Partial<PlayerState>={},budget=1){const scene=new T.Scene(),fx=new ErenTitan(scene,{budget}),a=actor('a',p),b=actor('b',{fighter:'goku'}),fighters=new Map([['a',a],['b',b]]),flights=new Map<string,Flight>(),mesh=(n:string)=>scene.getObjectByName('eren-titan-'+n)as T.InstancedMesh;return{scene,fx,a,b,fighters,flights,mesh};}
describe('bounded manual Attack Titan presentation',()=>{
 it('keeps idle and awakened idle clear with no gameplay writes',()=>{for(const awakened of[false,true]){const h=setup({awakened});try{const before=JSON.stringify(h.a.state);h.fx.update(10,h.fighters,h.flights);for(const n of['lightning','steam','hardening','pressure'])expect(h.mesh(n).count).toBe(0);expect(JSON.stringify(h.a.state)).toBe(before);}finally{h.fx.dispose();}}});
 it('stages entry lightning and steam only inside deliberate awakening',()=>{const h=setup({action:'awaken',actionTime:.72});try{h.fx.update(10,h.fighters,h.flights);expect(h.mesh('lightning').count).toBeGreaterThan(0);expect(h.mesh('steam').count).toBeGreaterThan(0);h.a.state.action='hurt';h.fx.update(10.1,h.fighters,h.flights);expect(h.mesh('steam').count).toBe(0);expect(h.mesh('lightning').count).toBe(0);}finally{h.fx.dispose();}});
 it('uses authoritative endpoints and deduplicates accepted hits',()=>{const h=setup({action:'ultimate',actionTime:.85,awakened:true});try{const hit=ev({endpoint:{x:7,y:2,z:-4}});h.fx.handle(hit,h.fighters);h.fx.handle(hit,h.fighters);h.fx.update(10,h.fighters,h.flights);
  expect(h.mesh('hardening').count).toBe(6+18);const m=new T.Matrix4();h.mesh('hardening').getMatrixAt(6,m);expect(new T.Vector3().setFromMatrixPosition(m).toArray()).toEqual([7,2,-4]);h.fx.update(11,h.fighters,h.flights);expect(h.mesh('hardening').count).toBe(6);}finally{h.fx.dispose();}});
 it.each(['whiff','interrupt','new action','death','reset'])('retires effects on %s',why=>{const h=setup({action:'ultimate',actionTime:.85,awakened:true});try{h.fx.handle(ev(),h.fighters);if(why==='whiff')h.fx.handle(ev({id:2,kind:'whiff'}),h.fighters);if(why==='interrupt')h.a.state.action='hurt';if(why==='new action')h.a.state.actionSeq=3;if(why==='death')h.a.state.alive=false;if(why==='reset')h.fx.reset();h.fx.update(10.1,h.fighters,h.flights);
  expect(h.mesh('hardening').count).toBe(why==='interrupt'||why==='death'?0:6);expect(h.mesh('pressure').count).toBe(0);}finally{h.fx.dispose();}});
 it('reduces distant/low-budget entry detail and bounds all room pools',()=>{const hi=setup({action:'awaken',actionTime:.72}),lo=setup({action:'awaken',actionTime:.72},.3);try{hi.fx.update(10,hi.fighters,hi.flights);lo.fx.update(10,lo.fighters,lo.flights);expect(hi.mesh('steam').count).toBeGreaterThan(lo.mesh('steam').count);for(let i=0;i<80;i++)hi.fighters.set('crowd'+i,actor('crowd'+i,{action:'awaken',actionTime:.72}));hi.fx.update(10,hi.fighters,hi.flights);for(const[name,key]of[['lightning','lightning'],['steam','steam'],['hardening','shards'],['pressure','pressure']]as const)expect(hi.mesh(name).count).toBeLessThanOrEqual(EREN_TITAN_LIMITS[key]);}finally{hi.fx.dispose();lo.fx.dispose();}expect(hi.scene.children).toHaveLength(0);});
 it('draws the Scout\'s blows with the shared stage alone: none of the Titan\'s lightning, steam or hardening on a blade\'s cut',()=>{
  const h=setup({action:'ultimate',actionTime:1.5/2.2,actionDuration:2.2}),stage=MoveStage.for(h.scene,{budget:1});
  try{
   const hit=ev({contactIndex:6,endpoint:{x:2,y:1.2,z:3}});h.fx.handle(ev({id:9,kind:'confirm',contactIndex:0,serverTime:9}),h.fighters);h.fx.handle(hit,h.fighters);h.fx.handle(hit,h.fighters);h.fx.update(10.02,h.fighters,h.flights);
   for(const n of['lightning','steam','hardening','pressure'])expect(h.mesh(n).count,n).toBe(0);
   expect(stage.counts.bolts,'his cuts').toBeGreaterThan(40);expect(stage.counts.shots,'the blast, the air broken, the floor shaken and scarred').toBe(4);
   h.fx.reset();h.a.state.awakened=true;h.a.state.actionDuration=4.2;h.fx.handle(ev({id:3,contactIndex:3,serverTime:12}),h.fighters);h.fx.update(12,h.fighters,h.flights);
   expect(h.mesh('hardening').count).toBeGreaterThan(0);
  }finally{h.fx.dispose();stage.release();}
 });
 it('lights both blades through a cut and leaves two cuts in the air as it is thrown, whether or not it lands',()=>{
  const h=setup({action:'light',actionTime:.2,actionDuration:.42,chain:0}),stage=MoveStage.for(h.scene,{budget:1});
  try{
   h.fx.update(10,h.fighters,h.flights);const lit=stage.counts.bolts;expect(lit,'a stroke and its heart down each blade').toBe(4);
   h.a.state.actionTime=.5;h.fx.update(10.05,h.fighters,h.flights);h.fx.update(10.08,h.fighters,h.flights);expect(stage.counts.bolts,'the pair of cuts').toBeGreaterThan(lit+16);
   h.a.state.whiffedAt=10.1;h.fx.update(10.5,h.fighters,h.flights);expect(stage.counts.bolts).toBe(0);
  }finally{h.fx.dispose();stage.release();}
 });
 it('draws the Thunder Spear on its flight once it is fired, and never for the Titan',()=>{
  const h=setup(),stage=MoveStage.for(h.scene,{budget:1}),flight:Flight={fighter:'eren' as FighterId,slot:'heavy',actorId:'a',position:new T.Vector3(0,1.2,4),heading:new T.Vector3(0,0,1),released:false,since:10};h.flights.set('a:heavy',flight);
  try{
   h.fx.update(10,h.fighters,h.flights);expect(stage.counts.bolts).toBe(0);
   flight.released=true;h.fx.update(10.1,h.fighters,h.flights);expect(stage.counts.bolts,'the shaft, its heart and the fire behind it').toBe(5);expect(stage.counts.glows).toBe(2);expect(stage.counts.lights).toBe(1);
   flight.awakened=true;h.fx.update(10.2,h.fighters,h.flights);expect(stage.counts.bolts).toBe(0);
  }finally{h.fx.dispose();stage.release();}
 });
});
