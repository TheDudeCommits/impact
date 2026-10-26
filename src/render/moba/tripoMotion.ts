import * as THREE from 'three';
import type {MotionLibrary} from '../horde/motion';
const ALIASES:Record<string,string>={Hip:'Hips',Waist:'Spine02',Spine01:'Spine01',Spine02:'Spine',NeckTwist01:'neck',Head:'Head',FacialBone:'headfront',L_Clavicle:'LeftShoulder',L_Upperarm:'LeftArm',L_Forearm:'LeftForeArm',L_Hand:'LeftHand',R_Clavicle:'RightShoulder',R_Upperarm:'RightArm',R_Forearm:'RightForeArm',R_Hand:'RightHand',L_Thigh:'LeftUpLeg',L_Calf:'LeftLeg',L_Foot:'LeftFoot',L_ToeBase:'LeftToeBase',R_Thigh:'RightUpLeg',R_Calf:'RightLeg',R_Foot:'RightFoot',R_ToeBase:'RightToeBase'};
export function tripoClips(root:THREE.Object3D,native:readonly THREE.AnimationClip[],source:MotionLibrary):THREE.AnimationClip[]{
 const objects:THREE.Object3D[]=[];root.traverse(o=>objects.push(o));
 for(const o of objects){const alias=ALIASES[o.name];if(alias)o.name=alias;}
 root.updateMatrixWorld(true);
 const head=root.getObjectByName('Head');if(!head)throw new Error('Tripo troop has no head joint');
 const end=new THREE.Bone();end.name='head_end';end.position.copy(head.worldToLocal(head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,.12,0))));head.add(end);
 const clips=new Map(native.map(clip=>[clip.name.toLowerCase().split(':').at(-1)!,clip]));
 for(const required of ['idle','walk','run','slash','shoot','hurt','fall'])if(!clips.has(required))throw new Error(`Tripo troop is missing ${required} animation`);
 return source.animations.map(template=>{
  const name=template.name,selected=name.startsWith('walk')?'walk':name.startsWith('run')?'run':name==='idle'?'idle':/die|knockdown|getup/.test(name)?'fall':/hit|flinch/.test(name)?'hurt':/cast|shoot|roar/.test(name)?'shoot':'slash';
  const clip=clips.get(selected)!,reverse=name==='getup';
  const arms=(track:THREE.KeyframeTrack)=>/^(L_|R_)(Clavicle|Upperarm|Forearm|Hand|Finger)/.test(track.name);
  const sourceTracks=selected==='shoot'?[...clips.get('idle')!.tracks.filter(t=>!arms(t)).map(track=>({track,duration:clips.get('idle')!.duration})),...clip.tracks.filter(arms).map(track=>({track,duration:clip.duration}))]:clip.tracks.map(track=>({track,duration:clip.duration}));
  const tracks=sourceTracks.map(({track,duration:sourceDuration})=>{
   const dot=track.name.lastIndexOf('.'),bone=track.name.slice(0,dot),path=track.name.slice(dot),renamed=(ALIASES[bone]??bone)+path;
   const copy=track.clone();copy.name=renamed;const size=track.getValueSize(),duration=Math.max(.01,sourceDuration);
   for(let i=0;i<copy.times.length;i++)copy.times[i]=track.times[i]/duration*template.duration;
   if(reverse){for(let i=0;i<copy.times.length;i++){copy.times[i]=template.duration-track.times[track.times.length-1-i]/duration*template.duration;for(let j=0;j<size;j++)copy.values[i*size+j]=track.values[(track.times.length-1-i)*size+j];}}
   return copy;
  });
  return new THREE.AnimationClip(name,template.duration,tracks);
 });
}
