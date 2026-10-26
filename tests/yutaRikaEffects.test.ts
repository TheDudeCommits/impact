import * as THREE from 'three';
import { describe,expect,it,vi } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { YutaRika } from '../src/render/signature/YutaRika';
import type { Fighter } from '../src/render/Fighter';
import type { FighterId,PlayerState,CombatEvent } from '../src/game/types';
import type { Flight } from '../src/render/CombatEffects';
const YUTA='yuta' as FighterId;
function harness(){const scene=new THREE.Scene(),fx=new YutaRika(scene,{budget:1});const make=(id:string):Fighter=>({group:new THREE.Group(),handL:new THREE.Vector3(-.2,1.2,.1),handR:new THREE.Vector3(.2,1.2,.1),state:{id,fighter:id==='yuta'?YUTA:'goku',alive:true,action:'idle',actionSeq:2,actionTime:0,actionDuration:3.2}as PlayerState}as unknown as Fighter);const yuta=make('yuta'),foe=make('foe');foe.group.position.z=2;const fighters=new Map([['yuta',yuta],['foe',foe]]),flights=new Map<string,Flight>();const beam=scene.getObjectByName('yuta-pure-love-beams')as THREE.InstancedMesh;return{scene,fx,yuta,foe,fighters,flights,beam};}
const event=(patch:Partial<CombatEvent>={}):CombatEvent=>({id:1,kind:'confirm',fighter:YUTA,actorId:'yuta',targetId:'foe',actionSeq:2,slot:'ultimate',serverTime:10.576,...patch});
describe('Yuta manual Rika contract',()=>{
 it('cannot create damage or a beam while idle, awakening, or without a confirmed opener',()=>{const h=harness();try{for(const action of ['idle','awaken','ultimate']as const){Object.assign(h.yuta.state,{action,actionTime:.85});const before=JSON.stringify(h.yuta.state);h.fx.update(12.7,h.fighters,h.flights);expect(h.beam.count).toBe(0);expect(JSON.stringify(h.yuta.state)).toBe(before);}}finally{h.fx.dispose();}});
 it.each(['whiff','interrupt','new sequence','victim gone','reset'])('cancels confirmed presentation on%s',reason=>{const h=harness();try{Object.assign(h.yuta.state,{action:'ultimate',actionTime:2.7/3.2});h.fx.handle(event(),h.fighters);h.fx.update(12.7,h.fighters,h.flights);expect(h.beam.count).toBe(3);if(reason==='whiff')h.fx.handle(event({id:2,kind:'whiff'}),h.fighters);if(reason==='interrupt')h.yuta.state.action='hurt';if(reason==='new sequence')h.yuta.state.actionSeq=3;if(reason==='victim gone')h.foe.state.alive=false;if(reason==='reset')h.fx.reset();h.fx.update(12.71,h.fighters,h.flights);expect(h.beam.count).toBe(0);}finally{h.fx.dispose();}});
 it('keeps an authoritative lethal endpoint only through the short visual beam tail',()=>{const h=harness();try{Object.assign(h.yuta.state,{action:'ultimate',actionTime:2.7/3.2});h.fx.handle(event(),h.fighters);h.fx.handle(event({id:2,kind:'hit',contactIndex:2}),h.fighters);h.foe.state.alive=false;h.fx.handle(event({id:3,kind:'eliminated',actorId:'foe',fighter:'goku'}),h.fighters);h.fighters.delete('foe');h.fx.update(12.7,h.fighters,h.flights);expect(h.beam.count).toBe(3);h.yuta.state.actionTime=3.1/3.2;h.fx.update(13.1,h.fighters,h.flights);expect(h.beam.count).toBe(0);}finally{h.fx.dispose();}});
 it.each(['expiry','interruption','new cast','death','reset'])('manual awakening tail is bounded and cancels on %s',async reason=>{
  const h=harness();vi.spyOn(GLTFLoader.prototype,'loadAsync').mockResolvedValue({scene:new THREE.Group(),animations:[]}as unknown as GLTF);
  const visible=()=>h.scene.children.filter(o=>o.name==='yuta-rika-manual-manifestation'&&o.visible&&!o.userData.warming).length;
  try{await h.fx.load(['yuta']);Object.assign(h.yuta.state,{awakened:true,action:'idle'});h.fx.update(10,h.fighters,h.flights);expect(visible()).toBe(0);
   Object.assign(h.yuta.state,{action:'awaken',actionTime:.7/.9,actionDuration:.9});h.fx.update(10.7,h.fighters,h.flights);expect(visible()).toBe(1);
   h.yuta.state.action='idle';const before=JSON.stringify(h.yuta.state);h.fx.update(11.03,h.fighters,h.flights);expect(visible()).toBe(1);expect(h.beam.count).toBe(0);expect(JSON.stringify(h.yuta.state)).toBe(before);
   if(reason==='interruption')h.yuta.state.action='hurt';if(reason==='new cast')h.yuta.state.actionSeq=3;if(reason==='death')h.yuta.state.alive=false;if(reason==='reset')h.fx.reset();
   h.fx.update(reason==='expiry'?11.5:11.1,h.fighters,h.flights);expect(visible()).toBe(0);expect(h.beam.count).toBe(0);
   Object.assign(h.yuta.state,{alive:true,action:'idle'});h.fx.update(12,h.fighters,h.flights);expect(visible()).toBe(0);
  }finally{h.fx.dispose();vi.restoreAllMocks();}
 });
 it('loads no Rika asset for unrelated rooms and idempotently disposes owned effects',async()=>{const h=harness();await h.fx.load(['goku','naruto']);h.fx.dispose();h.fx.dispose();expect(h.scene.children).toHaveLength(0);});
});
