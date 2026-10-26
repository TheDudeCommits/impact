import * as THREE from 'three';
import type { SpringProfile } from '../SecondaryMotion';


export interface HemSpec {
  profile:Partial<SpringProfile>;
  hang:number;
  legRadius:number;
  clearance:number;
  maxPush:number;
  maxLift:number;
  extra?:[number,number,number][];
}

const DEFAULT_SPEC:HemSpec={profile:{},hang:.8,legRadius:.075,clearance:.02,maxPush:70,maxLift:80};

export const HEM_SPECS:Record<string,Partial<HemSpec>>={
  itachi:{profile:{stiffness:16,drag:.45,gravity:3,maxAngle:24,tipLoose:.7,spread:.2,trail:.08,flutter:.1},hang:.85,legRadius:.075,clearance:.02},
  griffith:{profile:{stiffness:12,drag:.4,gravity:3,maxAngle:24,tipLoose:.65,spread:.4,trail:.1,flutter:.2},hang:.9,legRadius:.16,clearance:.05,maxPush:60,maxLift:65},
  sasuke:{profile:{stiffness:16,drag:.45,gravity:3,maxAngle:24,tipLoose:.7,spread:.2,trail:.08,flutter:.12,chains:[{match:/^Detail_CLOTH_sasuke_hem_/,profile:{}}]},hang:.85,legRadius:.1,clearance:.02,extra:[[0,.2,1],[0,.3,1]]},
  'sung-jinwoo':{profile:{stiffness:14,drag:.45,gravity:3,maxAngle:26,tipLoose:.65,spread:.3,trail:.1,flutter:.18,chains:[{match:/^Detail_CLOTH_sung-jinwoo_hem_/,profile:{legs:{thigh:.1,shin:.08,floor:.015}}}]},hang:.85,legRadius:.1,clearance:.03,maxPush:60,maxLift:70},
  madara:{profile:{stiffness:18,drag:.5,gravity:3,maxAngle:22,tipLoose:.75,spread:.15,trail:.06,flutter:.05,chains:[{match:/^Detail_CLOTH_madara_hem_/,profile:{}}]},hang:.8,legRadius:.11,clearance:.02},
  'sukuna-heian':{profile:{stiffness:18,drag:.5,gravity:2.6,maxAngle:22,tipLoose:.7,spread:.25,trail:.07,flutter:.15,chains:[{match:/^Detail_CLOTH_sukuna-heian_hem_/,profile:{}}]},hang:.3,legRadius:.15,clearance:.02,maxLift:85},
  'griffith-femto':{profile:{stiffness:14,drag:.45,gravity:3,maxAngle:22,tipLoose:.7,spread:.08,trail:.09,flutter:.1},hang:.9,legRadius:.085,clearance:.025,maxPush:40,maxLift:60},
  gintoki:{profile:{stiffness:26,drag:.6,gravity:2.6,maxAngle:14,tipLoose:.65,spread:.25,trail:.05,flutter:.08,chains:[{match:/^Detail_CLOTH_gintoki_hem_/,profile:{legs:{thigh:.065,shin:.055,floor:.015},droop:100}}]},hang:.92,legRadius:.06,clearance:.012,maxPush:55,maxLift:60},
  pain:{profile:{stiffness:20,drag:.5,gravity:3.2,maxAngle:16,tipLoose:.6,spread:.12,trail:.06,flutter:.08,chains:[{match:/^Detail_CLOTH_pain_hem_/,profile:{legs:{thigh:.075,shin:.06,floor:.015},droop:100}}]},hang:.9,legRadius:.07,clearance:.015},
  'edward-elric':{profile:{stiffness:16,drag:.45,gravity:3,maxAngle:22,tipLoose:.65,spread:.25,trail:.08,flutter:.14,chains:[{match:/^Detail_CLOTH_edward-elric_hem_/,profile:{legs:{thigh:.1,shin:.12,floor:.015,foot:.12},droop:100}}]},hang:.88,legRadius:.1,clearance:.03,maxPush:90,maxLift:85,extra:[[1,.5,1.1],[1,.8,1.4],[1,1,1.7],[2,.5,1.5],[2,1,1.2]]},
  tatsumaki:{profile:{stiffness:22,drag:.55,gravity:2.6,maxAngle:16,tipLoose:.6,spread:.25,trail:.06,flutter:.12,chains:[{match:/^Detail_CLOTH_tatsumaki_hem_/,profile:{legs:{thigh:.065,shin:.05,floor:.015},droop:100}}]},hang:.9,legRadius:.055,clearance:.012,maxPush:55,maxLift:60},
};

const LEGS=[['LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase'],['RightUpLeg','RightLeg','RightFoot','RightToeBase']] as const;
const SAMPLES:[number,number,number][]=[[0,.45,1],[0,.75,.95],[0,1,.9],[1,.35,.8],[1,.7,.72],[1,1,.68],[2,.5,.6],[2,1,.5]];
const TOP=.2,TOP_MIN=.12;

interface Link {
  bone:THREE.Bone;
  rest:THREE.Quaternion;
  axis:THREE.Vector3;
  reach:number;
  length:number;
  chain:Chain;
}

interface Chain {
  links:Link[];
  reach:number;
  out:THREE.Vector3;
  half:number;
  outWorld:THREE.Vector3;
}

const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_hipsQ=new THREE.Quaternion(),_hipsInv=new THREE.Quaternion();
const _hang=new THREE.Quaternion(),_turn=new THREE.Quaternion();
const _v=new THREE.Vector3(),_v2=new THREE.Vector3(),_d=new THREE.Vector3(),_n=new THREE.Vector3(),_side=new THREE.Vector3();
const _head=new THREE.Vector3(),_down=new THREE.Vector3();
const WORLD_DOWN=new THREE.Vector3(0,-1,0);
const CHAIN=/^Detail_CLOTH_([A-Za-z0-9-]+)_hem_(\d+)_(\d+)$/;

export class HemDrape {
  readonly garment:string;
  readonly spec:HemSpec;
  hangScale=1;
  private chains:Chain[]=[];
  private links=new Map<THREE.Bone,Link>();
  private hips:THREE.Object3D;
  private legs:THREE.Bone[][]=[];
  private down=new THREE.Vector3();
  private points:THREE.Vector3[]=[];
  private radii:number[]=[];
  private count=0;
  private samples:[number,number,number][]=SAMPLES;
  private axis=new THREE.Vector3(0,-1,0);

  static find(root:THREE.Object3D):HemDrape|undefined{
    const found:{bone:THREE.Bone;garment:string;sector:number;level:number}[]=[];
    root.traverse(o=>{
      const m=(o as THREE.Bone).isBone?CHAIN.exec(o.name):null;
      if(m)found.push({bone:o as THREE.Bone,garment:m[1],sector:Number(m[2]),level:Number(m[3])});
    });
    if(!found.length)return undefined;
    const legs:THREE.Bone[][]=[];
    for(const names of LEGS){
      const leg:THREE.Bone[]=[];
      for(const name of names){
        let bone:THREE.Bone|undefined;
        root.traverse(o=>{if(!bone&&(o as THREE.Bone).isBone&&(o.name===name||o.name.endsWith(name)))bone=o as THREE.Bone;});
        if(bone)leg.push(bone);
      }
      if(leg.length>=3)legs.push(leg);
    }
    root.updateMatrixWorld(true);
    for(const leg of legs){
      const twist=leg[0].children.find(c=>(c as THREE.Bone).isBone&&/thigh.?twist/i.test(c.name)) as THREE.Bone|undefined;
      if(twist&&twist.getWorldPosition(_v).y>leg[0].getWorldPosition(_v2).y)leg[0]=twist;
    }
    return new HemDrape(root,found,legs);
  }

  private constructor(root:THREE.Object3D,found:{bone:THREE.Bone;garment:string;sector:number;level:number}[],legs:THREE.Bone[][]){
    this.garment=found[0].garment;
    this.spec={...DEFAULT_SPEC,...HEM_SPECS[this.garment],profile:{...HEM_SPECS[this.garment]?.profile}};
    this.legs=legs;
    root.updateMatrixWorld(true);
    const sectors=new Map<number,THREE.Bone[]>();
    for(const f of found.sort((a,b)=>a.level-b.level)){
      if(!sectors.has(f.sector))sectors.set(f.sector,[]);
      sectors.get(f.sector)!.push(f.bone);
    }
    const first=found.find(f=>f.level===0)!.bone;
    this.hips=first.parent!;
    this.hips.getWorldQuaternion(_hipsQ);
    _hipsInv.copy(_hipsQ).invert();
    const hipsAt=this.hips.getWorldPosition(new THREE.Vector3());
    const down=new THREE.Vector3();
    const heads:{chain:Chain;angle:number;radius:number}[]=[];
    for(const bones of sectors.values()){
      const chain:Chain={links:[],reach:0,out:new THREE.Vector3(),half:.1,outWorld:new THREE.Vector3()};
      const ends:THREE.Vector3[]=bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
      const last=bones[bones.length-1];
      const end=last.children.find(c=>(c as THREE.Bone).isBone);
      const tip=end?end.getWorldPosition(new THREE.Vector3()):ends[ends.length-1].clone().add(ends[ends.length-1].clone().sub(ends[0]).multiplyScalar(.5/Math.max(1,bones.length-1)));
      ends.push(tip);
      let reach=0;
      for(let i=bones.length-1;i>=0;i--){
        const length=ends[i].distanceTo(ends[i+1]);
        reach+=length;
        const axis=ends[i+1].clone().sub(ends[i]).normalize().applyQuaternion(bones[i].getWorldQuaternion(new THREE.Quaternion()).invert());
        chain.links.unshift({bone:bones[i],rest:bones[i].quaternion.clone(),axis,reach,length,chain});
      }
      chain.reach=reach;
      for(const link of chain.links)this.links.set(link.bone,link);
      down.add(_v.subVectors(tip,ends[0]).normalize());
      _v.subVectors(ends[0],hipsAt).setY(0);
      const radius=Math.max(.05,_v2.subVectors(tip,hipsAt).setY(0).length());
      chain.out.copy(_v.lengthSq()>1e-8?_v.normalize():_v.set(0,0,-1)).applyQuaternion(_hipsInv);
      heads.push({chain,angle:Math.atan2(chain.out.x,chain.out.z),radius});
      this.chains.push(chain);
    }
    this.down.copy(down.lengthSq()>1e-8?down.normalize():WORLD_DOWN).applyQuaternion(_hipsInv);
    heads.sort((a,b)=>a.angle-b.angle);
    for(let i=0;i<heads.length;i++){
      const here=heads[i];
      let gap=Math.PI*2;
      for(const j of [i-1,i+1]){
        if(heads.length<2)break;
        const other=heads[(j+heads.length)%heads.length];
        let d=Math.abs(other.angle-here.angle);
        if(d>Math.PI)d=Math.PI*2-d;
        if(d>1e-4)gap=Math.min(gap,d);
      }
      here.chain.half=Math.max(.04,Math.min(.25,here.radius*Math.min(gap,Math.PI/2)*.5));
    }
    this.samples=this.spec.extra?[...SAMPLES,...this.spec.extra]:SAMPLES;
    const per=this.legs.length*this.samples.length;
    for(let i=0;i<per;i++){this.points.push(new THREE.Vector3());this.radii.push(0);}
  }

  before(){
    for(const leg of this.legs)leg[leg.length-1].updateWorldMatrix(true,false);
    this.hips.updateWorldMatrix(true,false);
    this.readLegs();
    this.hips.matrixWorld.decompose(_v,_hipsQ,_v2);
    _hipsInv.copy(_hipsQ).invert();
    _down.copy(this.down).applyQuaternion(_hipsQ);
    const upright=THREE.MathUtils.smoothstep(_down.dot(WORLD_DOWN),.3,.75);
    _turn.setFromUnitVectors(_down,WORLD_DOWN);
    _hang.slerpQuaternions(_q.identity(),_turn,this.spec.hang*this.hangScale*upright);
    this.axis.copy(_down).applyQuaternion(_hang);
    for(const chain of this.chains){
      chain.outWorld.copy(chain.out).applyQuaternion(_hipsQ).applyQuaternion(_hang);
      const root=chain.links[0];
      _q.copy(_hang).multiply(_hipsQ).multiply(root.rest);
      _d.copy(root.axis).applyQuaternion(_q);
      _head.copy(root.bone.position).applyMatrix4(this.hips.matrixWorld);
      const push=this.pushAngle(_head,_d,root.length,root.reach,chain);
      if(push>0){
        _side.crossVectors(_d,_n).normalize();
        _q.premultiply(_turn.setFromAxisAngle(_side,push));
        _d.copy(root.axis).applyQuaternion(_q);
        _v.copy(_d);
        if(this.capLift(_v))_q.premultiply(_turn.setFromUnitVectors(_d,_v));
      }
      root.bone.quaternion.copy(_q2.copy(_hipsInv).multiply(_q));
    }
  }

  collide(bone:THREE.Bone,head:THREE.Vector3,direction:THREE.Vector3){
    const link=this.links.get(bone);
    if(!link)return;
    const push=this.pushAngle(head,direction,link.length,link.reach,link.chain);
    if(push>0){
      _side.crossVectors(direction,_n).normalize();
      direction.applyAxisAngle(_side,push).normalize();
    }
    this.capLift(direction);
  }

  private capLift(direction:THREE.Vector3){
    const limit=THREE.MathUtils.degToRad(this.spec.maxLift),dot=THREE.MathUtils.clamp(direction.dot(this.axis),-1,1);
    if(Math.acos(dot)<=limit)return false;
    _v2.copy(direction).addScaledVector(this.axis,-dot);
    const across=_v2.length();
    if(across<1e-6)return false;
    direction.copy(this.axis).multiplyScalar(Math.cos(limit)).addScaledVector(_v2.divideScalar(across),Math.sin(limit)).normalize();
    return true;
  }

  private readLegs(){
    let k=0;
    const thigh=this.spec.legRadius;
    for(const leg of this.legs){
      for(const [segment,fraction,share] of this.samples){
        const a=leg[Math.min(segment,leg.length-1)],b=leg[Math.min(segment+1,leg.length-1)];
        _v.setFromMatrixPosition(a.matrixWorld);
        _v2.setFromMatrixPosition(b.matrixWorld);
        this.points[k].copy(_v).lerp(_v2,a===b?0:fraction);
        this.radii[k]=thigh*share;
        k++;
      }
    }
    this.count=k;
  }

  private pushAngle(head:THREE.Vector3,direction:THREE.Vector3,span:number,reach:number,chain:Chain){
    _n.copy(chain.outWorld).addScaledVector(direction,-chain.outWorld.dot(direction));
    const nl=_n.length();
    if(nl<1e-3)return 0;
    _n.divideScalar(nl);
    _side.crossVectors(direction,_n);
    const clearance=this.spec.clearance;
    const top=Math.max(TOP_MIN,TOP*chain.reach)-(chain.reach-reach);
    let best=0;
    for(let i=0;i<this.count;i++){
      const p=this.points[i],r=this.radii[i];
      _v.subVectors(p,head);
      const along=_v.dot(direction);
      if(along<Math.max(.03,top)||along>span+r)continue;
      if(Math.abs(_v.dot(_side))>chain.half+r)continue;
      const need=_v.dot(_n)+r+clearance;
      if(need<=0)continue;
      best=Math.max(best,Math.atan2(need,along));
    }
    return Math.min(best,THREE.MathUtils.degToRad(this.spec.maxPush));
  }
}
