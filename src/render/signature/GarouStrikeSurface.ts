import * as THREE from 'three';
import { garouStrikeJoint } from './GarouWaterStream';
import { garouSurfacePoint } from './GarouContactSurface';
const point = new THREE.Vector3();
const contacts = [.44, 1.04, 1.63, 2.23, 3.02] as const;
const clips = new Set(['Water Stream','Rock Smashing Palm','Whirlwind Slash','Monster Calamity Rush','Rush 1','Rush 2','Rush 3','Flowing Redirection','Hunter Cross','Whirlwind Break','Monster Lunge','Descending Palm','Cyclone Break']);
export function garouStrikeSurface(
  fighter:string, action:string, clip:string|undefined, sourceSeconds:number,
  cosmic:boolean, joints:ReadonlyMap<string,THREE.Object3D>,
  submit:(point:THREE.Vector3)=>void,
):boolean {
  if(fighter!=='garou'||!clip||!clips.has(clip)||!Number.isFinite(sourceSeconds)
    ||!['light','heavy','special','ultimate'].includes(action))return false;
  let index=0;
  if(action==='ultimate'&&clip==='Monster Calamity Rush'){
    let distance=Infinity;
    for(let i=0;i<contacts.length;i++){const d=Math.abs(sourceSeconds-contacts[i]);if(d<distance){index=i;distance=d;}}
  }
  const hand=joints.get(garouStrikeJoint(action,clip,index));
  if(!hand)return false;
  garouSurfacePoint(hand,cosmic,action,clip,index,point);
  submit(point);
  return true;
}
