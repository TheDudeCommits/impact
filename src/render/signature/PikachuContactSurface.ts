import * as THREE from 'three';
import type {Fighter} from '../Fighter';

type Surface={bone:THREE.Bone;points:THREE.Vector3[]};
const surfaces=new WeakMap<THREE.Object3D,Map<string,Surface>>();
const sample=new THREE.Vector3(),inverse=new THREE.Matrix4();
const directions:THREE.Vector3[]=[];
for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push(new THREE.Vector3(x,y,z).normalize());

function surface(model:THREE.Object3D,joint:string):Surface|undefined{
 let entries=surfaces.get(model);if(!entries){entries=new Map();surfaces.set(model,entries);}
 const cached=entries.get(joint);if(cached)return cached;
 const mesh=model.getObjectByName('pikachu_body');if(!(mesh instanceof THREE.SkinnedMesh))return;
 const bone=mesh.skeleton.bones.find(b=>b.name===joint);if(!bone)return;
 mesh.updateWorldMatrix(true,false);mesh.skeleton.update();inverse.copy(bone.matrixWorld).invert();
 const attributes=mesh.geometry.attributes,indices=attributes.skinIndex,weights=attributes.skinWeight;
 const cloud:THREE.Vector3[]=[];
 for(let i=0;i<attributes.position.count;i++){
  let weight=0;for(let k=0;k<4;k++)if(mesh.skeleton.bones[indices.getComponent(i,k)]===bone)weight+=weights.getComponent(i,k);
  if(weight<.9999)continue;
  cloud.push(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));
 }
 if(!cloud.length)return;
 const points:THREE.Vector3[]=[];
 for(const direction of directions){let best=cloud[0],dot=-Infinity;for(const p of cloud){const value=p.dot(direction);if(value>dot){best=p;dot=value;}}if(!points.includes(best))points.push(best);}
 const result={bone,points};entries.set(joint,result);return result;
}

export function pikachuLowStrikeJoint(clip:string,index=0):'Head'|'PikachuTail3'|undefined {
 switch(clip){
  case 'Quick Attack':case 'Rush 1':return 'Head';
  case 'Volt Tackle':return index===1?'PikachuTail3':'Head';
  case 'Iron Tail':case 'Tail Feint':case 'Iron Tail Breaker':case 'Falling Iron Tail':return 'PikachuTail3';
  default:return undefined;
 }
}
export function pikachuAuthoredChargeStep(clip:string,sourceSeconds:number):boolean {
 if(!Number.isFinite(sourceSeconds))return false;
 return (clip==='Quick Attack'||clip==='Rush 1')?sourceSeconds>=.045&&sourceSeconds<=.483334
  :clip==='Volt Tackle'&&sourceSeconds>=.26&&sourceSeconds<=.78;
}

export function pikachuStrikeSurfaces(f:Fighter,clip:string,index:number,visit:(point:THREE.Vector3)=>void):boolean{
 const joint=pikachuLowStrikeJoint(clip,index);if(!joint)return false;
 const s=surface(f.model,joint);if(!s)return false;
 for(const p of s.points)visit(sample.copy(p).applyMatrix4(s.bone.matrixWorld));
 return true;
}
