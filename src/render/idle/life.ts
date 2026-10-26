import * as THREE from 'three';
import type { IdleProfile } from './profile';


export const LIFE_IN=.55,LIFE_OUT=.15;
const LIFE_DELAY=.12;
const BREATH={rest:.24,winded:.5,spine:.022,shoulder:.03,head:.012,dip:.004,windedGain:.9};
const EXERTION={moving:.22,attack:.3,recover:7};
const ALERT=.35;
const SWAY={shift:.018,drop:.022,counter:.8,fore:.006,rates:[.13,.071] as const};
const GAZE={drift:[.02,.012] as const,every:[3.5,8] as const,yaw:.16,pitch:.06,look:.35,hold:[.6,1.6] as const,settle:.55};
const ARMS:Record<NonNullable<IdleProfile['stance']>,number>={guard:.03,relaxed:.012,weapon:.008,stand:.01};
const BOUNCE={depth:.014,rate:1.7};
const FIDGET={every:[7,13] as const,first:4.5,exit:.3};
const READY={near:6,far:8.5,after:4,hold:1.2};
const EXCHANGE=new Set(['light','heavy','special','ultimate','guard','dash','hurt','flinch','launched','knockdown','getup','stun','splat']);

export function hashSeed(text:string){
  let h=0x811c9dc5;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}
  return h>>>0;
}
function random(state:{s:number}){
  state.s=(state.s+0x6d2b79f5)|0;
  let t=state.s;
  t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
}
export function noise(seed:number,t:number){
  const i=Math.floor(t),f=t-i,u=f*f*f*(f*(f*6-15)+10);
  const a=lattice(seed,i),b=lattice(seed,i+1);
  return a+(b-a)*u;
}
function lattice(seed:number,i:number){
  let h=Math.imul(seed^Math.imul(i,0x27d4eb2d),0x165667b1);
  h^=h>>>15;h=Math.imul(h,0x85ebca6b);h^=h>>>13;
  return ((h>>>0)/4294967295)*2-1;
}
const ease=(u:number)=>{u=THREE.MathUtils.clamp(u,0,1);return u*u*(3-2*u);};

export interface LifeInput{
  idle:boolean;
  moving:boolean;
  attacked:boolean;
  speed:number;
  alert?:boolean;
}

export class IdleLife{
  weight=0;
  exertion=0;
  private keyed=0;
  private progress=0;
  private delay=0;
  private clock=0;
  private breathPhase=0;
  private readonly seed:number;
  private readonly rng:{s:number};
  private glanceAt=-1;
  private glanceYaw=0;
  private glancePitch=0;
  private glanceHold=0;
  private nextGlance:number;
  breath=0;
  dip=BREATH.dip;
  shift=0;
  drop=0;
  fore=0;
  bounce=0;
  headYaw=0;
  headPitch=0;
  arms=0;
  constructor(readonly profile:IdleProfile={},seed=1){
    this.seed=seed>>>0||1;
    this.rng={s:this.seed};
    this.nextGlance=GAZE.every[0]+random(this.rng)*(GAZE.every[1]-GAZE.every[0]);
  }
  step(dt:number,input:LifeInput){
    if(!(dt>0))return;
    if(input.moving)this.exertion=Math.min(1,this.exertion+EXERTION.moving*dt);
    if(input.attacked)this.exertion=Math.min(1,this.exertion+EXERTION.attack);
    if(input.idle)this.exertion*=Math.exp(-dt/EXERTION.recover);
    const settled=input.idle&&input.speed<.35;
    this.delay=settled?this.delay+dt:0;
    const wanted=settled&&this.delay>=LIFE_DELAY;
    this.progress=THREE.MathUtils.clamp(this.progress+(wanted?dt/LIFE_IN:-dt/LIFE_OUT),0,1);
    this.weight=ease(this.progress);
    this.clock+=dt;
    const p=this.profile,t=this.clock,tau=Math.PI*2;
    this.keyed+=((input.alert?ALERT:0)-this.keyed)*(1-Math.exp(-dt/1.5));
    const winded=Math.max(this.exertion,this.keyed);
    const rate=THREE.MathUtils.lerp(BREATH.rest,BREATH.winded,winded);
    this.breathPhase=(this.breathPhase+rate*dt*tau)%tau;
    const b=Math.sin(this.breathPhase+.35*Math.sin(this.breathPhase));
    this.breath=b*(p.breath??1)*(1+BREATH.windedGain*winded);
    const sway=p.sway??1;
    const swing=Math.sin(t*SWAY.rates[0]*tau+this.seed%7)*.7+noise(this.seed^0x9e37,t*.09)*.3;
    this.shift=swing*SWAY.shift*sway;
    this.drop=swing*SWAY.drop*sway;
    this.fore=(Math.sin(t*SWAY.rates[1]*tau+1.3)*.6+noise(this.seed^0x51f1,t*.13)*.4)*SWAY.fore*sway;
    this.dip=(p.dip??1)*BREATH.dip;
    const bounce=p.bounce??0;
    this.bounce=bounce>0?(.5-.5*Math.cos(t*BOUNCE.rate*tau))*BOUNCE.depth*bounce:0;
    this.arms=(ARMS[p.stance??'relaxed']??ARMS.relaxed)*(b*.6+swing*.4);
    const gaze=p.gaze??1;
    let yaw=noise(this.seed^0x2c1b,t*.23)*GAZE.drift[0],pitch=noise(this.seed^0x7a3d,t*.19)*GAZE.drift[1];
    if(this.glanceAt<0&&t>=this.nextGlance&&this.weight>.9){
      this.glanceAt=t;
      this.glanceYaw=(random(this.rng)<.5?-1:1)*(.45+.55*random(this.rng))*GAZE.yaw;
      this.glancePitch=(random(this.rng)*2-1)*GAZE.pitch;
      this.glanceHold=GAZE.hold[0]+random(this.rng)*(GAZE.hold[1]-GAZE.hold[0]);
    }
    if(this.glanceAt>=0){
      const age=t-this.glanceAt,out=GAZE.look+this.glanceHold;
      const g=age<GAZE.look?ease(age/GAZE.look):age<out?1:1-ease((age-out)/GAZE.settle);
      yaw+=this.glanceYaw*g;pitch+=this.glancePitch*g;
      if(age>=out+GAZE.settle){
        this.glanceAt=-1;
        this.nextGlance=t+GAZE.every[0]+random(this.rng)*(GAZE.every[1]-GAZE.every[0]);
      }
    }
    if(this.weight<.9&&this.glanceAt<0)this.nextGlance=Math.max(this.nextGlance,t+GAZE.every[0]);
    this.headYaw=yaw*gaze;this.headPitch=pitch*gaze;
  }
}

export class IdleDirector{
  active=-1;
  count=0;
  private standing=0;
  private remaining=0;
  private due:number;
  private readonly rng:{s:number};
  constructor(private readonly durations:readonly number[],private readonly every:readonly [number,number]=FIDGET.every,seed=1){
    this.rng={s:(seed^0x5bd1e995)>>>0||1};
    this.due=this.wait(FIDGET.first);
  }
  private wait(least=0){return Math.max(least,this.every[0]+random(this.rng)*(this.every[1]-this.every[0]));}
  step(dt:number,idle:boolean,settled:boolean){
    if(!idle){
      if(this.active>=0||this.standing>0){this.active=-1;this.standing=0;this.due=this.wait(FIDGET.first);}
      return this.active;
    }
    if(!(dt>0)||!this.durations.length)return this.active;
    this.standing+=dt;
    if(this.active>=0){
      this.remaining-=dt;
      if(this.remaining<=0){this.active=-1;this.standing=0;this.due=this.wait();}
    }else if(settled&&this.standing>=this.due){
      this.active=Math.floor(random(this.rng)*this.durations.length)%this.durations.length;
      this.remaining=Math.max(.2,this.durations[this.active]-FIDGET.exit);
      this.count++;
    }
    return this.active;
  }
}

const _q=new THREE.Quaternion(),_parent=new THREE.Quaternion(),_parentInverse=new THREE.Quaternion();
const _forward=new THREE.Vector3(),_lateral=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0);
const _point=new THREE.Vector3(),_ankles=[new THREE.Vector3(),new THREE.Vector3()],_feet=[new THREE.Quaternion(),new THREE.Quaternion()];
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_c=new THREE.Vector3(),_t=new THREE.Vector3();
const _ab=new THREE.Vector3(),_ac=new THREE.Vector3(),_at=new THREE.Vector3(),_ba=new THREE.Vector3(),_bc=new THREE.Vector3(),_axis=new THREE.Vector3(),_bend=new THREE.Vector3();
const STRAIGHT_KNEE=.035;
function turn(bone:THREE.Object3D,axis:THREE.Vector3,angle:number){
  if(!bone.parent||Math.abs(angle)<1e-7)return;
  bone.parent.getWorldQuaternion(_parent);
  _parentInverse.copy(_parent).invert();
  _q.setFromAxisAngle(axis,angle);
  bone.quaternion.premultiply(_parentInverse.multiply(_q).multiply(_parent));
  bone.updateMatrix();
  bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld,bone.matrix);
}
type Leg={hip:THREE.Object3D;knee:THREE.Object3D;ankle:THREE.Object3D;upper:number;lower:number};
function plant(leg:Leg,target:THREE.Vector3,footWorld:THREE.Quaternion,lateral:THREE.Vector3){
  const {hip,knee,ankle,upper,lower}=leg;
  hip.getWorldPosition(_a);knee.getWorldPosition(_b);ankle.getWorldPosition(_c);
  _at.subVectors(target,_a);
  const reach=_at.length();
  if(reach<1e-4)return;
  const wanted=THREE.MathUtils.clamp(reach,Math.abs(upper-lower)+1e-3,(upper+lower)*.999);
  _t.copy(_a).addScaledVector(_at,wanted/reach);
  _ab.subVectors(_b,_a);_ac.subVectors(_c,_a);_ba.subVectors(_a,_b);_bc.subVectors(_c,_b);
  _axis.crossVectors(_ac,_ab);
  _bend.copy(lateral).addScaledVector(_ac,-lateral.dot(_ac)/Math.max(1e-9,_ac.lengthSq()));
  if(_bend.lengthSq()>1e-12)_axis.addScaledVector(_bend.normalize(),-STRAIGHT_KNEE*_ac.length()*_ab.length());
  if(_axis.lengthSq()<1e-10)return;
  _axis.normalize();
  const cosine=(x:number,y:number,z:number)=>Math.acos(THREE.MathUtils.clamp((x*x+y*y-z*z)/(2*x*y),-1,1));
  turn(hip,_axis,cosine(upper,wanted,lower)-_ac.angleTo(_ab));
  turn(knee,_axis,cosine(upper,lower,wanted)-_ba.angleTo(_bc));
  hip.getWorldPosition(_a);ankle.getWorldPosition(_c);
  _ac.subVectors(_c,_a);_at.subVectors(_t,_a);
  _axis.crossVectors(_ac,_at);
  if(_axis.lengthSq()>1e-12){const angle=_ac.angleTo(_at);_axis.normalize();turn(hip,_axis,angle);}
  if(ankle.parent){
    ankle.parent.getWorldQuaternion(_parent);
    ankle.quaternion.copy(_parent.invert()).multiply(footWorld);
    ankle.updateMatrix();
    ankle.matrixWorld.multiplyMatrices(ankle.parent.matrixWorld,ankle.matrix);
  }
}

export class IdleRig{
  readonly life:IdleLife;
  readonly director:IdleDirector;
  private readonly spine:THREE.Object3D[];
  private readonly hips?:THREE.Object3D;
  private readonly neck?:THREE.Object3D;
  private readonly head?:THREE.Object3D;
  private readonly shoulders:THREE.Object3D[];
  private readonly arms:THREE.Object3D[];
  private readonly legs:Leg[]=[];
  private wasAttacking=false;
  private keyText='';
  private keyFor=-2;
  private readyOn=false;
  private readyHeld=Infinity;
  private sinceExchange=Infinity;
  private sinceNear=Infinity;
  constructor(readonly profile:IdleProfile,joints:Map<string,THREE.Object3D>,readonly loop?:THREE.AnimationClip,readonly fidgets:readonly THREE.AnimationClip[]=[],seed=1,readonly ready?:THREE.AnimationClip){
    this.life=new IdleLife(profile,seed);
    this.director=new IdleDirector(fidgets.map(clip=>clip.duration),profile.fidgetEvery,seed);
    this.hips=joints.get('Hips');
    this.spine=['Spine','Spine1','Spine2'].map(name=>joints.get(name)).filter((bone):bone is THREE.Object3D=>!!bone);
    this.head=joints.get('Head');
    const neck=joints.get('Neck'),hands=[joints.get('LeftHand'),joints.get('RightHand')];
    const under=(child:THREE.Object3D|undefined,parent:THREE.Object3D)=>{for(let node=child?.parent;node;node=node.parent)if(node===parent)return true;return false;};
    this.neck=neck&&!hands.some(hand=>under(hand,neck))?neck:undefined;
    this.shoulders=['LeftShoulder','RightShoulder'].map(name=>joints.get(name)).filter((bone):bone is THREE.Object3D=>!!bone);
    this.arms=['LeftArm','RightArm'].map(name=>joints.get(name)).filter((bone):bone is THREE.Object3D=>!!bone);
    for(const side of ['Left','Right']){
      const hip=joints.get(side+'UpLeg'),knee=joints.get(side+'Leg'),ankle=joints.get(side+'Foot');
      if(hip&&knee&&ankle&&knee!==hip&&ankle!==knee)this.legs.push({hip,knee,ankle,upper:0,lower:0});
    }
    if(this.legs.length!==2)this.legs.length=0;
  }
  private scale=0;
  private measure(){
    let total=0;
    for(const leg of this.legs){
      leg.upper=leg.hip.getWorldPosition(_a).distanceTo(leg.knee.getWorldPosition(_b));
      leg.lower=_b.distanceTo(leg.ankle.getWorldPosition(_c));
      total=Math.max(total,leg.upper+leg.lower);
    }
    if(this.legs.some(leg=>leg.upper<1e-3||leg.lower<1e-3))this.legs.length=0;
    this.scale=total>.2?THREE.MathUtils.clamp(total/.85,.6,1.6):1;
  }
  get clips(){return [this.loop,this.ready,...this.fidgets].filter((clip):clip is THREE.AnimationClip=>!!clip);}
  get readied(){return this.readyOn&&!!this.ready;}
  stance(){return this.readied?this.ready:this.loop;}
  clip(){return this.readied?this.ready:this.director.active>=0?this.fidgets[this.director.active]:this.loop;}
  get key(){
    const at=this.readied?-3:this.director.active<0?-1:this.director.count;
    if(at!==this.keyFor){this.keyFor=at;this.keyText=at===-3?'-ready':at<0?'':`-fidget${this.director.active}.${at}`;}
    return this.keyText;
  }
  step(dt:number,action:string,grounded:boolean,alive:boolean,speed:number,distance=Infinity){
    const idle=action==='idle'&&grounded&&alive;
    const attacking=action==='light'||action==='heavy'||action==='special'||action==='ultimate';
    this.life.step(dt,{idle,moving:action==='run'||action==='dash'||action==='jump',attacked:attacking&&!this.wasAttacking,speed,alert:alive&&distance<READY.far});
    if(dt>0)this.wasAttacking=attacking;
    if(this.ready&&dt>0){
      this.sinceExchange=EXCHANGE.has(action)?0:this.sinceExchange+dt;
      this.sinceNear=distance<(this.readyOn?READY.far:READY.near)?0:this.sinceNear+dt;
      this.readyHeld+=dt;
      const wanted=alive&&Math.min(this.sinceNear,this.sinceExchange)<(this.readyOn?READY.after:1e-6);
      if(wanted!==this.readyOn&&this.readyHeld>=READY.hold){this.readyOn=wanted;this.readyHeld=0;}
    }
    this.director.step(dt,idle&&speed<.35&&!this.readied,this.life.weight>.98);
  }
  apply(facing:number){
    const life=this.life,w=life.weight,hips=this.hips,parent=hips?.parent;
    if(w<1e-3||!hips||!parent)return;
    if(!this.scale)this.measure();
    const scale=this.scale;
    _forward.set(Math.sin(facing),0,Math.cos(facing));
    _lateral.set(Math.cos(facing),0,-Math.sin(facing));
    for(let i=0;i<this.legs.length;i++){this.legs[i].ankle.getWorldPosition(_ankles[i]);this.legs[i].ankle.getWorldQuaternion(_feet[i]);}
    hips.getWorldPosition(_point);
    _point.addScaledVector(_lateral,life.shift*w*scale).addScaledVector(_forward,life.fore*w*scale);
    _point.y-=(life.bounce+Math.max(0,.5+.5*life.breath)*life.dip)*w*scale;
    hips.position.copy(parent.worldToLocal(_point));
    hips.updateMatrixWorld(true);
    turn(hips,_forward,life.drop*w);
    const n=this.spine.length;
    for(let i=0;i<n;i++){
      const share=(i+1)/(n*(n+1)/2);
      turn(this.spine[i],_forward,-life.drop*SWAY.counter*w*share);
      turn(this.spine[i],_lateral,-life.breath*BREATH.spine*w*share);
    }
    if(this.spine.length)this.spine[n-1].getWorldPosition(_point);
    for(const bone of this.shoulders){
      bone.getWorldPosition(_a);
      const side=Math.sign(_a.sub(_point).dot(_lateral))||1;
      turn(bone,_forward,(.5+.5*life.breath)*BREATH.shoulder*side*w);
    }
    for(const bone of this.arms)turn(bone,_lateral,-life.arms*w);
    const head=this.head;
    if(head){
      turn(head,_lateral,(life.breath*BREATH.head+life.headPitch)*w*(this.neck?.6:1));
      turn(head,_up,life.headYaw*w*(this.neck?.6:1));
      if(this.neck){turn(this.neck,_lateral,life.headPitch*.4*w);turn(this.neck,_up,life.headYaw*.4*w);}
    }
    for(let i=0;i<this.legs.length;i++)plant(this.legs[i],_ankles[i],_feet[i],_lateral);
  }
}
