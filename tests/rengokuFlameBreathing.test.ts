import { describe, expect, it } from 'vitest';
import * as T from 'three';
import type { CombatEvent, PlayerState } from '../src/game/types';
import type { Flight } from '../src/render/CombatEffects';
import type { Fighter } from '../src/render/Fighter';
import { RengokuFlameBreathing } from '../src/render/signature/RengokuFlameBreathing';
function setup(budget=1) {
 const scene=new T.Scene(),fx=new RengokuFlameBreathing(scene,{budget}),group=new T.Group(),hand=new T.Object3D();
 hand.position.set(.2,1.1,.2);group.add(hand);group.updateMatrixWorld(true);
 const fighter={group,state:{id:'r',fighter:'rengoku',alive:true,action:'idle',actionTime:0,actionDuration:4.2,actionSeq:1,yaw:0} as PlayerState,
  drawnJoint:()=>hand,strikePoint:(p:T.Vector3)=>p.set(.2,1.1,1.2)} as unknown as Fighter;
 const fighters=new Map([['r',fighter]]),flights=new Map();
 const count=(name:string)=>(scene.getObjectByName('rengoku-'+name) as T.InstancedMesh).count;
 const own=()=>scene.children.filter(o=>o.name.startsWith('rengoku-')) as T.InstancedMesh[];
 return {scene,fx,fighter,fighters,flights,count,own};
}
const hit=(patch:Partial<CombatEvent>={}):CombatEvent=>({id:1,kind:'hit',actorId:'r',targetId:'foe',fighter:'rengoku',slot:'ultimate',contactIndex:3,actionSeq:1,serverTime:10,endpoint:{x:.2,y:1.1,z:1.2},...patch});
describe('Rengoku manual flame presentation',()=>{
 it('does no work while idle, including awakening buff idle, and never edits combat state',()=>{
  const h=setup();h.fighter.state.awakened=true;const before=JSON.stringify(h.fighter.state);
  h.fx.update(10,h.fighters,h.flights);expect(h.own().every(o=>o.count===0)).toBe(true);
  expect(JSON.stringify(h.fighter.state)).toBe(before);h.fx.dispose();
 });
 it('does not dirty GPU buffers during repeated empty updates',()=>{
  const h=setup();for(let i=0;i<60;i++)h.fx.update(i/60,h.fighters,h.flights);
  for(const mesh of h.own()){expect(mesh.instanceMatrix.version).toBe(0);expect(((mesh.geometry.getAttribute('flameTint') ?? mesh.geometry.getAttribute('tigerTint')) as T.InstancedBufferAttribute).version).toBe(0);}h.fx.dispose();
 });
 it('draws only released projectile flights, at the server flight position',()=>{
  const h=setup(),flight={fighter:'rengoku',slot:'special',released:false,position:new T.Vector3(3,2,4),heading:new T.Vector3(0,0,1)}as Flight;
  h.flights.set('f',flight);h.fx.update(10,h.fighters,h.flights);expect(h.count('breathing-crescents')).toBe(0);
  flight.released=true;h.fx.update(10.1,h.fighters,h.flights);expect(h.count('breathing-crescents')).toBe(4);
  const matrix=new T.Matrix4();(h.scene.getObjectByName('rengoku-breathing-crescents') as T.InstancedMesh).getMatrixAt(0,matrix);
  expect(new T.Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([3,2,4]);h.flights.clear();h.fx.update(11,h.fighters,h.flights);expect(h.count('breathing-crescents')).toBe(0);h.fx.dispose();
 });
 it('requires the confirmed fourth contact for the winding finisher and ignores duplicate delivery',()=>{
  const h=setup();h.fx.handle(hit({kind:'confirm'}),h.fighters);h.fx.update(10.1,h.fighters,h.flights);expect(h.count('blade-flames')).toBe(0);
  h.fx.handle(hit(),h.fighters);h.fx.update(10.1,h.fighters,h.flights);expect(h.count('blade-flames')).toBe(16);
  h.fx.handle(hit(),h.fighters);h.fx.update(10.1,h.fighters,h.flights);expect(h.count('blade-flames')).toBe(16);
  h.fx.update(10.7,h.fighters,h.flights);expect(h.count('blade-flames')).toBe(0);h.fx.dispose();
 });
 it.each(['whiff','respawn','eliminated','rejected'] as const)('cancels retained flames on %s',kind=>{
  const h=setup();h.fx.handle(hit(),h.fighters);h.fx.handle(hit({id:2,kind}),h.fighters);h.fx.update(10.1,h.fighters,h.flights);
  expect(h.count('blade-flames')).toBe(0);h.fx.dispose();
 });
 it('drops stale attacks and leaves aimed area effects to their own system',()=>{
  const h=setup();h.fx.handle(hit({slot:'area'}),h.fighters);h.fx.update(10.1,h.fighters,h.flights);expect(h.count('blade-flames')).toBe(0);
  h.fx.handle(hit({id:2}),h.fighters);h.fighter.state.actionSeq=2;h.fx.update(10.1,h.fighters,h.flights);expect(h.count('blade-flames')).toBe(0);h.fx.dispose();
 });
 it('scales detail and bounds overdraw even when many attackers confirm simultaneously',()=>{
  const h=setup(.3);for(let i=0;i<100;i++)h.fx.handle(hit({id:i+10}),h.fighters);h.fx.update(10.1,h.fighters,h.flights);
  expect(h.count('blade-flames')).toBeLessThanOrEqual(144);expect(h.count('breathing-crescents')).toBeLessThanOrEqual(72);expect(h.count('embers')).toBeLessThanOrEqual(96);
  h.fx.reset();expect(h.own().every(o=>o.count===0)).toBe(true);h.fx.dispose();h.fx.dispose();expect(h.scene.children).toHaveLength(0);
 });
 it('emits a finite resolve crest during the manual awakening but clears it after entry',()=>{
  const h=setup();Object.assign(h.fighter.state,{action:'awaken',actionTime:.7,actionDuration:.9});h.fx.update(10,h.fighters,h.flights);expect(h.count('resolve-crest')).toBe(7);
  h.fighter.state.action='idle';h.fx.update(11,h.fighters,h.flights);expect(h.count('resolve-crest')).toBe(0);h.fx.dispose();
 });
});
