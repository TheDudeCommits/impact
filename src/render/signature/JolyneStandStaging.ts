import {Vector3,type Object3D,type Camera} from 'three';
export const JOLYNE_STAND_STAGING={flankRadians:-.66,idleSide:.92,idleBack:.12,idleLift:.035,ownerWindow:.12,maxFlank:2.5,turnSpeed:2.2,viewHysteresis:.22,scoreHysteresis:.08}as const;
const ANGLES=[-2.5,-2.2,-1.9,-1.6,1.6,1.9,2.2,2.5]as const;
const CANDIDATES=ANGLES.map(angle=>({angle,c:Math.cos(angle),s:Math.sin(angle)}));
type Envelope={x0:number;y0:number;x1:number;y1:number};
const JOINTS=['Hips','Spine2','Head','LeftArm','RightArm','LeftUpLeg','RightUpLeg']as const;
const bodyPoints=JOINTS.map(()=>new Vector3()),ownerPoints=JOINTS.map(()=>new Vector3()),targetPoints=JOINTS.map(()=>new Vector3());
const projected=new Vector3(),sample=new Vector3();
const standBox:Envelope={x0:0,y0:0,x1:0,y1:0},ownerBox={...standBox},targetBox={...standBox};
function points(joints:ReadonlyMap<string,Object3D>,out:Vector3[]):void{
 const fallback=joints.get('Spine')!;for(let i=0;i<JOINTS.length;i++)(joints.get(JOINTS[i])??fallback).getWorldPosition(out[i]);
}
function envelope(points:readonly Vector3[],camera:Camera,out:Envelope,pivot?:Vector3,c=1,s=0):void{
 out.x0=out.y0=Infinity;out.x1=out.y1=-Infinity;
 for(let i=0;i<points.length;i++){
  sample.copy(points[i]);if(pivot){const x=sample.x-pivot.x,z=sample.z-pivot.z;sample.x=pivot.x+x*c+z*s;sample.z=pivot.z-x*s+z*c;}
  const radius=i===2?.17:i>4?.27:.23,e=camera.matrixWorld.elements;
  for(let sign=-1;sign<=1;sign+=2){
   projected.set(sample.x+sign*radius*e[0],sample.y+sign*radius*e[1],sample.z+sign*radius*e[2]).project(camera);
   out.x0=Math.min(out.x0,projected.x);out.x1=Math.max(out.x1,projected.x);
   projected.set(sample.x+sign*radius*e[4],sample.y+sign*radius*e[5],sample.z+sign*radius*e[6]).project(camera);
   out.y0=Math.min(out.y0,projected.y);out.y1=Math.max(out.y1,projected.y);
  }
 }
}
function overlap(a:Envelope,b:Envelope):number{return Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0))/Math.max(1e-6,(a.x1-a.x0)*(a.y1-a.y0));}
export function jolyneInitialFlank(owner:Vector3,target:Vector3,camera:Camera):number{
 const dx=target.x-owner.x,dz=target.z-owner.z,side=(camera.position.x-owner.x)*dz-(camera.position.z-owner.z)*dx;
 return side>=0?-2.2:2.2;
}
export function jolyneViewFlank(body:ReadonlyMap<string,Object3D>,owner:ReadonlyMap<string,Object3D>,target:ReadonlyMap<string,Object3D>,contact:Vector3,camera:Camera,current:number):number{
 points(body,bodyPoints);points(owner,ownerPoints);points(target,targetPoints);
 envelope(ownerPoints,camera,ownerBox);envelope(targetPoints,camera,targetBox);
 const score=(c:number,s:number)=>{envelope(bodyPoints,camera,standBox,contact,c,s);const separation=Math.min(Math.abs((standBox.x0+standBox.x1-ownerBox.x0-ownerBox.x1)*.5),Math.abs((standBox.x0+standBox.x1-targetBox.x0-targetBox.x1)*.5));return -2*overlap(standBox,ownerBox)-overlap(standBox,targetBox)+separation*2;};
 let best=current,bestScore=score(Math.cos(current),Math.sin(current))+JOLYNE_STAND_STAGING.scoreHysteresis;
 for(const p of CANDIDATES){if(p.angle*current<0)continue;const value=score(p.c,p.s);if(value>bestScore){best=p.angle;bestScore=value;}}
 return best;
}
export function jolyneFlankAroundContact(group:Object3D,contact:Vector3,weight=1,flank:number=JOLYNE_STAND_STAGING.flankRadians):void{
 const angle=Math.max(-JOLYNE_STAND_STAGING.maxFlank,Math.min(JOLYNE_STAND_STAGING.maxFlank,flank))*Math.max(0,Math.min(1,weight)),c=Math.cos(angle),s=Math.sin(angle),x=group.position.x-contact.x,z=group.position.z-contact.z;
 group.position.x=contact.x+x*c+z*s;group.position.z=contact.z-x*s+z*c;
 group.rotation.y+=angle;group.updateMatrixWorld(true);
}
