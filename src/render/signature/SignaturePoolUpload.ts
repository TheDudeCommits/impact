import type {BufferAttribute,InstancedMesh} from 'three';

export class SignaturePoolUpload {
 private drawn=false;
 private readonly attributes:BufferAttribute[];
 private readonly ranges:{start:number;count:number}[];
 constructor(private readonly mesh:InstancedMesh,tint?:BufferAttribute){
  this.attributes=tint?[mesh.instanceMatrix,tint]:[mesh.instanceMatrix];
  this.ranges=this.attributes.map(()=>({start:0,count:0}));
  mesh.onAfterRender=()=>{this.drawn=true;};
 }
 end(count:number):boolean{
  this.mesh.count=count;this.mesh.visible=count>0||!this.drawn;
  if(count===0)return false;
  for(let i=0;i<this.attributes.length;i++){
   const attribute=this.attributes[i],range=this.ranges[i];
   range.start=0;range.count=count*attribute.itemSize;
   attribute.clearUpdateRanges();attribute.updateRanges.push(range);attribute.needsUpdate=true;
  }
  return true;
 }
}
