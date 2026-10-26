import type {BufferGeometry} from 'three';

export function preserveMinatoPaintedFolds(fighter:string,meshName:string,geometry:BufferGeometry):void{
  if(fighter!=='minato'||meshName!=='body_minato')return;
  const look=geometry.getAttribute('lookHead');
  if(!look||look.itemSize<3)return;
  for(let i=0;i<look.count;i++)look.setZ(i,0);
  look.needsUpdate=true;
}
