import * as T from 'three';
import type {Fighter} from '../Fighter';

type Actor=Pick<Fighter,'state'|'group'>;
type Receiver=Pick<Fighter,'state'|'group'|'model'|'shownBody'|'drawnJoint'>;
type Surface={mesh:T.SkinnedMesh;indices:number[];world:T.Vector3[]};
type Anchor={mesh:T.SkinnedMesh;index:number};
type Selection={target:object;seq:number;clip:string;anchors:Anchor[]};
const surfaces=new WeakMap<object,Surface|undefined>(),selections=new WeakMap<object,Selection>();
const torso=/^(Hips|Spine\d*|Chest|UpperChest|Neck)$/i;
const center=new T.Vector3(),wanted=new T.Vector3(),direction=new T.Vector3(),side=new T.Vector3(),up=new T.Vector3(0,1,0);

function surface(receiver:Receiver):Surface|undefined{
 const body=receiver.shownBody??receiver;
 if(surfaces.has(body))return surfaces.get(body);
 let best:{mesh:T.SkinnedMesh;ids:number[]}|undefined;
 body.model?.traverse(o=>{
  if(!(o instanceof T.SkinnedMesh)||!o.visible)return;
  const joints=o.geometry.getAttribute('skinIndex'),weights=o.geometry.getAttribute('skinWeight');if(!joints||!weights)return;
  const included=o.skeleton.bones.map(b=>torso.test(b.name)),ids:number[]=[];
  for(let i=0;i<joints.count;i++){let weight=0;for(let j=0;j<4;j++)if(included[joints.getComponent(i,j)])weight+=weights.getComponent(i,j);if(weight>=.65)ids.push(i);}
  if(ids.length>(best?.ids.length??0))best={mesh:o,ids};
 });
 if(!best){surfaces.set(body,undefined);return;}
 const selected:number[]=[],position=best.mesh.geometry.getAttribute('position'),points=best.ids.map(i=>new T.Vector3().fromBufferAttribute(position,i)),distances=new Float64Array(points.length).fill(Infinity);
 let next=0;for(let n=0;n<Math.min(64,points.length);n++){selected.push(best.ids[next]);let farthest=-1,index=0;for(let i=0;i<points.length;i++){distances[i]=Math.min(distances[i],points[i].distanceToSquared(points[next]));if(distances[i]>farthest){farthest=distances[i];index=i;}}next=index;}
 const result={mesh:best.mesh,indices:selected,world:selected.map(()=>new T.Vector3())};surfaces.set(body,result);return result;
}
function choose(source:Surface,desired:T.Vector3,chosen:Anchor[],parity:number):Anchor{
 let score=Infinity,index=source.indices[0];
 for(let i=0;i<source.indices.length;i++){if(chosen.some((a,j)=>j%2===parity&&a.index===source.indices[i]))continue;const d=source.world[i].distanceToSquared(desired);if(d<score){score=d;index=source.indices[i];}}
 return{mesh:source.mesh,index};
}
export function nicoRobinReceiverArm(actor:Actor,receiver:Receiver|undefined,clip:string,index:number,root:T.Vector3,end:T.Vector3):boolean{
 if(!receiver?.state.alive)return false;
 direction.subVectors(receiver.group.position,actor.group.position);direction.y=0;
 const distance=direction.length();if(distance<.20||distance>2.70)return false;
 direction.multiplyScalar(1/distance);side.crossVectors(up,direction);
 if(direction.x*Math.sin(actor.state.yaw)+direction.z*Math.cos(actor.state.yaw)<.30)return false;
 const source=surface(receiver);if(!source)return false;
 const body=receiver.shownBody??receiver,seq=actor.state.actionSeq??-1;let selection=selections.get(actor);
 if(!selection||selection.target!==body||selection.seq!==seq||selection.clip!==clip){
  for(let i=0;i<source.indices.length;i++)source.mesh.getVertexPosition(source.indices[i],source.world[i]).applyMatrix4(source.mesh.matrixWorld);
  const chest=receiver.drawnJoint?.('Spine2')??receiver.drawnJoint?.('Chest')??receiver.drawnJoint?.('Spine1');
  if(chest)chest.getWorldPosition(center);else center.copy(receiver.group.position).addScaledVector(up,1.18);
  const anchors:Anchor[]=[];
  for(let i=0;i<4;i++){
   const sign=i%2===0?1:-1,row=Math.floor(i/2);
   wanted.copy(center).addScaledVector(side,sign*.22).addScaledVector(up,-.43+row*.06).addScaledVector(direction,-.28);anchors.push(choose(source,wanted,anchors,0));
   wanted.copy(center).addScaledVector(side,i===0?0:sign*(row?.17:.12)).addScaledVector(up,.14+row*.15).addScaledVector(direction,-.28);anchors.push(choose(source,wanted,anchors,1));
  }
  selection={target:body,seq,clip,anchors};selections.set(actor,selection);
 }
 const a=selection.anchors[(index%4)*2],b=selection.anchors[(index%4)*2+1];
 a.mesh.getVertexPosition(a.index,root).applyMatrix4(a.mesh.matrixWorld);
 b.mesh.getVertexPosition(b.index,end).applyMatrix4(b.mesh.matrixWorld);
 root.addScaledVector(direction,-.012);
 return true;
}
