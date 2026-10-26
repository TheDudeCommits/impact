import * as T from 'three';
import {describe,expect,it} from 'vitest';
import type {CombatEvent,PlayerState} from '../src/game/types';
import type {Fighter} from '../src/render/Fighter';
import {SignaturePoolUpload} from '../src/render/signature/SignaturePoolUpload';
import {MightGuyGates} from '../src/render/signature/MightGuyGates';
import {NicoRobinFleur} from '../src/render/signature/NicoRobinFleur';
import {ErenTitan} from '../src/render/signature/ErenTitan';

const rows=[['might-guy',MightGuyGates],['nico-robin',NicoRobinFleur],['eren',ErenTitan]]as const;
function attributes(mesh:T.InstancedMesh){return[mesh.instanceMatrix,...Object.values(mesh.geometry.attributes).filter(a=>(a as T.InstancedBufferAttribute).isInstancedBufferAttribute)]as T.BufferAttribute[];}
function rendered(mesh:T.InstancedMesh){(mesh.onAfterRender as()=>void)();for(const a of attributes(mesh))a.clearUpdateRanges();}
describe('bounded signature pool upload lifecycle',()=>{
 it.each(rows)('%s preserves warmup, stops idle uploads and restores active ranges', (id,Class)=>{
  const scene=new T.Scene(),fx=new Class(scene,{budget:1}),group=new T.Group();
  const actor={group,model:group,joints:new Map(),bones:new Map(),clips:[],handL:new T.Vector3(),handR:new T.Vector3(),
   state:{id:'actor',fighter:id,alive:true,action:'idle',actionTime:.5,actionDuration:1,actionSeq:1,yaw:0,...(id==='eren'?{awakened:true,awakenedUntil:1e9}:{})}as PlayerState,
   strikePoint:(out:T.Vector3)=>out.set(0,1,0),drawnJoint:()=>undefined,displayedClipName:undefined}as unknown as Fighter;
  Object.assign(actor,{shownBody:actor});const fighters=new Map([['actor',actor]]),flights=new Map();
  const update=(time:number)=>fx.update(time,fighters,flights);
  const hit=(id:number,time:number)=>fx.handle({id,kind:'hit',fighter:actor.state.fighter,actorId:'actor',slot:'light',actionSeq:actor.state.actionSeq,serverTime:time,endpoint:{x:1,y:1,z:1}}as CombatEvent,fighters);
  try{
   const meshes=scene.children.filter(o=>(o as T.InstancedMesh).isInstancedMesh&&!o.name.startsWith('stage-'))as T.InstancedMesh[];
   update(0);for(const m of meshes){expect(m.count).toBe(0);expect(m.visible).toBe(true);for(const a of attributes(m))expect(a.version).toBe(0);rendered(m);}
   update(1);for(const m of meshes){expect(m.visible).toBe(false);for(const a of attributes(m))expect(a.version).toBe(0);}
   for(const time of[10,20]){
    actor.state.action='light';actor.state.actionSeq!++;hit(time,time);update(time+.1);
    expect(meshes.some(m=>m.count>0)).toBe(true);
    for(const m of meshes){expect(m.visible).toBe(m.count>0);if(m.count>0)for(const a of attributes(m))expect(a.updateRanges).toEqual([{start:0,count:m.count*a.itemSize}]);rendered(m);}
    const versions=meshes.map(m=>attributes(m).map(a=>a.version));actor.state.action='idle';update(time+2);
    for(let i=0;i<meshes.length;i++){expect(meshes[i].count).toBe(0);expect(meshes[i].visible).toBe(false);expect(attributes(meshes[i]).map(a=>a.version)).toEqual(versions[i]);}
   }
   fx.reset();expect(meshes.every(m=>m.count===0&&!m.visible)).toBe(true);
  }finally{fx.dispose();}expect(scene.children).toHaveLength(0);
 });
 it('reuses upload records while shrinking and regrowing the occupied prefix',()=>{
  const g=new T.PlaneGeometry(),m=new T.MeshBasicMaterial(),mesh=new T.InstancedMesh(g,m,8),tint=new T.InstancedBufferAttribute(new Float32Array(32),4),upload=new SignaturePoolUpload(mesh,tint);
  try{upload.end(6);const matrixRange=mesh.instanceMatrix.updateRanges[0],tintRange=tint.updateRanges[0];mesh.instanceMatrix.clearUpdateRanges();tint.clearUpdateRanges();
   for(const count of[2,8,1]){upload.end(count);expect(mesh.instanceMatrix.updateRanges).toEqual([{start:0,count:count*16}]);expect(tint.updateRanges).toEqual([{start:0,count:count*4}]);expect(mesh.instanceMatrix.updateRanges[0]).toBe(matrixRange);expect(tint.updateRanges[0]).toBe(tintRange);mesh.instanceMatrix.clearUpdateRanges();tint.clearUpdateRanges();}
  }finally{mesh.dispose();g.dispose();m.dispose();}
 });
});
