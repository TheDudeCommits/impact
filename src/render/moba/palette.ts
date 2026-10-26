import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const RIFT_INK={heroes:0x69d9c3,villains:0xef7562,neutral:0xe8c27c,stone:0x9c988b,ink:0x222c2c,ivory:0xe8dfc7};
export type RiftSide='heroes'|'villains';
export const RIFT_TEAM_LABEL:Record<RiftSide,string>={heroes:'DAWN ALLIANCE',villains:'ECLIPSE LEGION'};
export const RIFT_BASE_LABEL:Record<RiftSide,string>={heroes:'DAWN SHRINE',villains:'ECLIPSE KEEP'};

export function mergeParts(parts:THREE.BufferGeometry[]){
  const flat=parts.map(g=>g.index?g.toNonIndexed():g);
  const geometry=mergeGeometries(flat)!;
  for(const g of new Set([...flat,...parts]))g.dispose();
  return geometry;
}

export function laneRibbon(points:readonly {x:number;z:number}[],width:number,y=.01){
  const positions:number[]=[],uv:number[]=[];let distance=0;
  for(let i=0;i+1<points.length;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
    if(len<.001)continue;
    const nx=-dz/len*width/2,nz=dx/len*width/2;
    for(const [x,z,u,v] of [[a.x+nx,a.z+nz,0,distance],[b.x-nx,b.z-nz,width,distance+len],[a.x-nx,a.z-nz,width,distance],[a.x+nx,a.z+nz,0,distance],[b.x+nx,b.z+nz,0,distance+len],[b.x-nx,b.z-nz,width,distance+len]]){positions.push(x,y,z);uv.push(u/5,v/5);}
    distance+=len;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}

export function pointNearPath(x:number,z:number,points:readonly {x:number;z:number}[],distance:number){
  const limit=distance*distance;
  for(let i=0;i+1<points.length;i++){
    const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;
    const t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l)):0;
    if((x-a.x-dx*t)**2+(z-a.z-dz*t)**2<limit)return true;
  }
  return false;
}
