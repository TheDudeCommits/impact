import {MathUtils,Vector3,type Object3D} from 'three';

type ContactSample=readonly[seconds:number,x:number,y:number,z:number];
const CONTACTS:Readonly<Record<string,readonly ContactSample[]>>={
  'ORA Rush': [
    [0.440990995716, -0.12971624739, 0.342292303336, 0.834862517354],
    [0.721621629354, 0.13073615382, 0.34066186931, 0.833895523736],
    [1.01227478562, -0.0895127091039, 0.315227435884, 0.882215658804],
  ],
  'Stone Ocean': [
    [0.5, -0.129716276085, 0.342292301498, 0.834862507673],
    [0.95, 0.13073617518, 0.340661870774, 0.833895510959],
    [1.28, -0.12971624739, 0.342292303336, 0.834862517354],
    [1.61, 0.13073615382, 0.34066186931, 0.833895523736],
    [1.94, -0.12971624739, 0.342292303336, 0.834862517354],
    [2.27, 0.13035123936, 0.340894161529, 0.833558171367],
    [2.63, -0.12971624739, 0.342292303336, 0.834862517354],
    [3.18, 0.0906264226611, 0.314948646306, 0.881990045945],
  ],
};
const hipsWorld=new Vector3(),rootWorld=new Vector3();
export const JOLYNE_REFERENCE_ENTRY=.22;
export const JOLYNE_REFERENCE_RETURN=.32;

export function jolyneContactReference(group:Object3D,hips:Object3D|undefined,clip:string|undefined,seconds:number,contact:Vector3,out:Vector3):boolean{
 const samples=clip?CONTACTS[clip]:undefined;if(!samples||!hips||!Number.isFinite(seconds))return false;
 const cx=contact.x,cy=contact.y,cz=contact.z;
 let a=samples[0],b=a,u=0,nearest=Infinity,offset=0;
 for(let i=0;i<samples.length;i++){const delta=seconds-samples[i][0];if(Math.abs(delta)<nearest){nearest=Math.abs(delta);offset=delta;}}
 for(let i=1;i<samples.length;i++){b=samples[i];if(seconds<=b[0]){u=MathUtils.smoothstep(seconds,a[0],b[0]);break;}a=b;}
 out.set(MathUtils.lerp(a[1],b[1],u),MathUtils.lerp(a[2],b[2],u),MathUtils.lerp(a[3],b[3],u));
 out.applyMatrix4(group.matrixWorld);rootWorld.setFromMatrixPosition(group.matrixWorld);
 hips.getWorldPosition(hipsWorld);out.add(hipsWorld.sub(rootWorld));
 const residual=Math.hypot(out.x-cx,out.z-cz);
 const correction=MathUtils.smoothstep(offset,-.008,-.002)*(1-MathUtils.smoothstep(offset,.035,.10))*(1-MathUtils.smoothstep(residual,.04,.09));
 out.set(out.x+(cx-out.x)*correction,out.y+(cy-out.y)*correction,out.z+(cz-out.z)*correction);
 return true;
}
