import * as T from 'three';
import type {Fighter} from '../Fighter';
import {shinjiStrikeJoint} from '../../game/fighters/shinji';

export const SHINJI_SURFACE_VERTICES=Object.freeze({rightFist:26068,leftFist:25477,leftPalm:25502,mesh:'Shinji_EVA01_NativeSkin'});
const meshes=new WeakMap<object,T.SkinnedMesh>();
const other=new T.Vector3();
function skin(f:Pick<Fighter,'shownBody'>){
 const body=f.shownBody;let mesh=meshes.get(body);
 if(!mesh){const node=body.model.getObjectByName(SHINJI_SURFACE_VERTICES.mesh);if(!(node instanceof T.SkinnedMesh))return;mesh=node;meshes.set(body,mesh);}
 return mesh;
}
export function shinjiSurfacePoint(f:Pick<Fighter,'shownBody'>,surface:'rightFist'|'leftFist'|'leftPalm',out:T.Vector3):boolean{
 const mesh=skin(f);if(!mesh)return false;mesh.getVertexPosition(SHINJI_SURFACE_VERTICES[surface],out);out.applyMatrix4(mesh.matrixWorld);return true;
}
export function shinjiStrikePoint(f:Pick<Fighter,'shownBody'|'state'>,out:T.Vector3,clip?:string,contactIndex=0):boolean{
 const side=shinjiStrikeJoint(f.state.action,clip,contactIndex);
 if(side==='BothHands'){
  if(!shinjiSurfacePoint(f,'leftFist',out)||!shinjiSurfacePoint(f,'rightFist',other))return false;out.add(other).multiplyScalar(.5);return true;
 }
 const palm=clip==='A.T. Repulsion'||clip==='Absolute Rejection'||!clip&&f.state.action==='special';
 return shinjiSurfacePoint(f,side==='RightHand'?'rightFist':palm?'leftPalm':'leftFist',out);
}
