import * as THREE from 'three';

export interface GarmentCollide {
  thigh:number;
  shin:number;
  floor:number;
  foot?:number;
}

const _closest=new THREE.Vector3(),_away=new THREE.Vector3(),_segment=new THREE.Vector3();

export class LegCapsules {
  private readonly joints:THREE.Object3D[][]=[];
  private readonly radii:number[]=[];
  private readonly from:THREE.Vector3[]=[];
  private readonly to:THREE.Vector3[]=[];
  private readonly feet:THREE.Object3D[]=[];
  private readonly sole:number;
  private floorY=-Infinity;
  private readonly foot=new THREE.Vector3();
  readonly ok:boolean;

  constructor(private readonly root:THREE.Object3D,private readonly spec:GarmentCollide){
    const named=(name:string)=>{let found:THREE.Object3D|undefined;root.traverse(o=>{if(!found&&o.name===name)found=o;});return found;};
    for(const side of ['Left','Right']){
      const hip=named(`${side}UpLeg`),knee=named(`${side}Leg`),ankle=named(`${side}Foot`);
      if(!hip||!knee||!ankle)continue;
      this.joints.push([hip,knee],[knee,ankle]);this.radii.push(spec.thigh,spec.shin);
      this.feet.push(ankle);
    }
    this.ok=this.joints.length===4;
    if(spec.foot)for(const ankle of this.feet){
      const toe=ankle.children.find(child=>/toebase$/i.test(child.name));
      if(toe){this.joints.push([ankle,toe]);this.radii.push(spec.foot);}
    }
    for(let i=0;i<this.joints.length;i++){this.from.push(new THREE.Vector3());this.to.push(new THREE.Vector3());}
    root.updateMatrixWorld(true);
    const base=new THREE.Vector3();root.getWorldPosition(base);
    let lowest=Infinity;for(const f of this.feet)lowest=Math.min(lowest,f.getWorldPosition(this.foot).y-base.y);
    this.sole=Number.isFinite(lowest)?Math.max(0,lowest):0;
  }

  update(){
    if(!this.ok)return;
    for(let i=0;i<this.joints.length;i++){this.joints[i][0].getWorldPosition(this.from[i]);this.joints[i][1].getWorldPosition(this.to[i]);}
    let lowest=Infinity;for(const f of this.feet)lowest=Math.min(lowest,f.getWorldPosition(this.foot).y);
    this.floorY=Math.min(lowest-this.sole,this.root.getWorldPosition(this.foot).y)+this.spec.floor;
  }

  pushLink(head:THREE.Vector3,tail:THREE.Vector3,length:number){
    if(!this.ok)return false;
    let moved=false;
    for(let pass=0;pass<3;pass++){
      let any=false;
      for(let i=0;i<this.joints.length;i++){
        const a=this.from[i],r=this.radii[i];
        _segment.subVectors(this.to[i],a);
        const span=_segment.lengthSq();
        const t=span>1e-9?THREE.MathUtils.clamp(_away.subVectors(tail,a).dot(_segment)/span,0,1):0;
        _closest.copy(a).addScaledVector(_segment,t);
        _away.subVectors(tail,_closest);
        const d=_away.length();
        if(d>=r)continue;
        if(d>1e-5)_away.divideScalar(d);else{_away.set(head.x-_closest.x,0,head.z-_closest.z);if(_away.lengthSq()<1e-8)_away.set(1,0,0);_away.normalize();}
        tail.copy(_closest).addScaledVector(_away,r);
        any=true;
      }
      if(!any)break;
      moved=true;
      _away.subVectors(tail,head);const reach=_away.length();
      if(reach>1e-6)tail.copy(head).addScaledVector(_away,length/reach);
    }
    if(tail.y<this.floorY){
      const rise=THREE.MathUtils.clamp((this.floorY-head.y)/length,-1,.95);
      _away.set(tail.x-head.x,0,tail.z-head.z);
      if(_away.lengthSq()<1e-10)_away.set(1,0,0);
      _away.normalize().multiplyScalar(Math.sqrt(1-rise*rise)*length);
      tail.set(head.x+_away.x,head.y+rise*length,head.z+_away.z);
      moved=true;
    }
    return moved;
  }
}
