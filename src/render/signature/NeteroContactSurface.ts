import * as THREE from 'three';
import {neteroStrikeJoint} from '../../game/fighters/netero';
export const NETERO_SKIN_CONTACTS=Object.freeze({RightHand:711,LeftHand:17749,RightForeArm:824});
const bodies=new WeakMap<THREE.Object3D,THREE.SkinnedMesh|null>();
export function neteroSurfacePoint(model:THREE.Object3D,action:string,clip:string|undefined,out:THREE.Vector3):boolean{
 let mesh=bodies.get(model);
 if(mesh===undefined){const candidate=model.getObjectByName('body_netero');mesh=candidate instanceof THREE.SkinnedMesh?candidate:null;bodies.set(model,mesh);}
 if(!mesh)return false;
 mesh.getVertexPosition(NETERO_SKIN_CONTACTS[neteroStrikeJoint(action,clip)],out).applyMatrix4(mesh.matrixWorld);return true;
}
