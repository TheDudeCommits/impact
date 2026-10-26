import * as THREE from 'three';
import type {Fighter} from '../Fighter';

export const ASUKA_SURFACE_TRIANGLES=Object.freeze({
 node:'body_asuka_eva02',
 base:{vertices:16333,rightHeel:[9069,9068,9078] as const,leftPalm:[15051,15055,15969] as const},
 sync:{vertices:16245,rightHeel:[8981,8980,8990] as const,leftPalm:[14963,14967,15881] as const},
});
type SurfaceSpec=typeof ASUKA_SURFACE_TRIANGLES.base|typeof ASUKA_SURFACE_TRIANGLES.sync;
const meshes=new WeakMap<object,{mesh:THREE.SkinnedMesh;spec:SurfaceSpec}>();
const sample=new THREE.Vector3();
export function asukaSurfacePoint(f:Pick<Fighter,'shownBody'>,surface:'rightHeel'|'leftPalm',out:THREE.Vector3):boolean{
 const body=f.shownBody;let entry=meshes.get(body);
 if(!entry){
  const node=body.model?.getObjectByName(ASUKA_SURFACE_TRIANGLES.node);
  node?.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh))return;const count=o.geometry.attributes.position.count;
   const spec=count===ASUKA_SURFACE_TRIANGLES.base.vertices?ASUKA_SURFACE_TRIANGLES.base:count===ASUKA_SURFACE_TRIANGLES.sync.vertices?ASUKA_SURFACE_TRIANGLES.sync:undefined;
   if(spec)entry={mesh:o,spec};
  });
  if(!entry)return false;meshes.set(body,entry);
 }
 out.set(0,0,0);
 for(const index of entry.spec[surface]){entry.mesh.getVertexPosition(index,sample);out.add(sample);}
 out.multiplyScalar(1/3).applyMatrix4(entry.mesh.matrixWorld);return true;
}
