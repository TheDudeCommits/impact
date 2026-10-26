import * as THREE from 'three';
import {RIFT_RULES,type RiftUnit} from '../../game/moba/model';
import {GS,GF} from '../../survival/horde/Horde';
import {HordeFrame,HordeFrames} from '../../survival/horde/frame';
import type {GruntRenderer,CrowdPose} from '../horde/GruntRenderer';
import type {ThreatInk} from '../ThreatOutline';
import {riftGruntKind} from '../../game/moba/armyIdentity';

class PresentedArmies extends HordeFrames {
 readonly frame=new HordeFrame();
 override around(){return {a:this.frame,b:this.frame,alpha:1};}
}
interface Body {serial:number;hp:number;hitAt:number;deadAt:number;born:number;seen:number;unit:RiftUnit;pose:CrowdPose}
const REVEAL=.22,FOG_FADE=.2,DEATH_HOLD=2.1,DEATH_FADE=.65;
export function riftAttackPose(kind:RiftUnit['kind'],age:number){
 const windup=kind==='boss'?.75:kind==='siege'?.6:kind==='ranged'?.45:.3,recovery=kind==='siege'||kind==='boss'?.5:.36;
 if(age<0||age>=windup+recovery)return;
 return {clip:kind==='ranged'||kind==='siege'?'roar':'slash',progress:age<windup?age/windup*.46:.46+(age-windup)/recovery*.54};
}
export class RiftArmies {
 readonly root=new THREE.Group();
 private readonly frames=new PresentedArmies();
 private readonly serials=new Map<string,Body>();
 private readonly glows=new Map<number,ThreatInk>();
 private readonly poses=new Map<number,CrowdPose>();
 private nextSerial=1;private lastTime=-Infinity;
 constructor(private readonly crowd:GruntRenderer){this.root.name='Rift armies · shared anime crowd';}
 load(){return this.crowd.loadRift();}
 update(units:readonly RiftUnit[],time:number,dt:number,camera:THREE.Camera,threats:ReadonlyMap<string,ThreatInk>){
  if(time<this.lastTime)this.clear();this.lastTime=time;this.crowd.useRiftModels(true);
  const f=this.frames.frame;f.time=time;f.n=0;this.glows.clear();this.poses.clear();
  const write=(body:Body,visible:boolean)=>{
   if(f.n>=RIFT_RULES.unitCap)return;const u=body.unit,dead=u.hp<=0||u.state==='dead',n=f.n++,age=time-u.attackAt;
   const attack=u.state==='attack'&&u.attackAt>0?riftAttackPose(u.kind,age):undefined;
   const pose=body.pose;
   if(visible){pose.clip=dead?'die':u.state==='hurt'?'hit':attack?.clip;pose.progress=dead?Math.min(1,(time-body.deadAt)/1.05):u.state==='hurt'?Math.min(1,(time-body.hitAt)/.3):attack?.progress;pose.key=dead?'dead':u.state==='hurt'?`hurt:${body.hitAt}`:`attack:${u.attackAt}`;}
   else if(dead){pose.clip='die';pose.progress=Math.min(1,(time-body.deadAt)/1.05);pose.key='dead';}
   pose.visibility=dead?Math.max(0,1-(time-body.deadAt-DEATH_HOLD)/DEATH_FADE):Math.min(1,(time-body.born)/REVEAL)*(visible?1:Math.max(0,1-(time-body.seen)/FOG_FADE));
   this.poses.set(body.serial,pose);
   f.serial[n]=body.serial;f.kind[n]=riftGruntKind(u);f.x[n]=u.x;f.y[n]=u.y;f.z[n]=u.z;f.yaw[n]=u.yaw;
   f.state[n]=dead?GS.DEAD:u.state==='hurt'?GS.FLINCH:attack?GS.ATTACK:GS.MOVE;
   f.move[n]=u.team==='heroes'&&u.kind==='melee'?1:0;f.flags[n]=u.empowered?GF.ELITE:0;f.hp[n]=u.hp/u.maxHp;
   f.phase[n]=dead?time-body.deadAt:attack?age:u.state==='hurt'&&Number.isFinite(body.hitAt)?time-body.hitAt:0;f.span[n]=dead?1.2:.7;f.hit[n]=time-body.hitAt;
   const glow=visible?threats.get(u.id):undefined;if(glow)this.glows.set(body.serial,glow);
  };
  for(const u of units){
   if(f.n>=RIFT_RULES.unitCap)break;
   let body=this.serials.get(u.id);
   if(!body){body={serial:this.nextSerial++,hp:u.hp,hitAt:-60,deadAt:time,born:time-REVEAL*.1,seen:time,unit:{...u},pose:{visibility:0}};this.serials.set(u.id,body);}
   if(u.hp<body.hp){body.hitAt=time;if(u.hp<=0)body.deadAt=time;}
   body.hp=u.hp;body.seen=time;Object.assign(body.unit,u);write(body,true);
  }
  for(const [id,body]of this.serials){
   if(body.seen===time)continue;
   const dead=body.hp<=0;
   if(dead?time-body.deadAt>DEATH_HOLD+DEATH_FADE:time-body.seen>FOG_FADE){this.serials.delete(id);continue;}
   write(body,false);
  }
  this.crowd.pageInk=false;this.crowd.threats=this.glows;this.crowd.poses=this.poses;this.crowd.update(this.frames,time,dt,camera);
 }
 clear(){this.frames.frame.n=0;this.serials.clear();this.glows.clear();this.poses.clear();this.nextSerial=1;this.lastTime=-Infinity;this.crowd.poses=undefined;this.crowd.pageInk=true;this.crowd.clear();this.crowd.useRiftModels(false);}
 dispose(){this.clear();this.root.removeFromParent();}
}
