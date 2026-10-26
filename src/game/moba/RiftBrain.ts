import {MOVES} from '../moves';
import type {NavGrid} from '../botNav';
import type {PlayerInput,PlayerState} from '../types';
import {RIFT_BASES,RIFT_LENGTHS,lanePoint,laneProgress,riftClearShot} from './map';
import {RIFT_RULES,type RiftSeat,type RiftView} from './model';
type Target={id:string;x:number;z:number;hp:number;maxHp:number;radius?:number;kind?:string};
const gap=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
export class RiftBrain {
 private nextPress=0;private nextThink=0;private targetId:string|null=null;private guardUntil=0;private attacks=0;
 private route:number[]|null=null;private routeUntil=0;private routeX=0;private routeZ=0;
 private destination={x:0,z:0};
 constructor(readonly id:string,private offset=0,private nav?:NavGrid){}
 command(me:PlayerState,seat:RiftSeat,players:readonly PlayerState[],view:RiftView,now:number):Omit<PlayerInput,'seq'>{
  const input=this.decide(me,seat,players,view,now),nav=this.nav;
  if(!nav||!me.grounded||Math.hypot(input.moveX,input.moveZ)<.01)return input;
  const x=this.destination.x,z=this.destination.z;
  if(nav.clear(me.x,me.z,x,z)){this.route=null;return input;}
  if(!this.route||now>=this.routeUntil||Math.hypot(this.routeX-x,this.routeZ-z)>5){this.route=nav.path(me.x,me.z,x,z);this.routeUntil=now+.8;this.routeX=x;this.routeZ=z;}
  if(this.route?.length){const waypoint=nav.steer(this.route,me.x,me.z),dx=waypoint.x-me.x,dz=waypoint.z-me.z,d=Math.hypot(dx,dz);if(d>.15){input.moveX=dx/d;input.moveZ=dz/d;if(!input.targetId)input.yaw=Math.atan2(dx,dz);}}
  return input;
 }
 private decide(me:PlayerState,seat:RiftSeat,players:readonly PlayerState[],view:RiftView,now:number):Omit<PlayerInput,'seq'>{
  const input:Omit<PlayerInput,'seq'>={moveX:0,moveZ:0,yaw:me.yaw};this.destination.x=me.x;this.destination.z=me.z;if(!me.alive||seat.recallAt!==undefined)return input;
  const base=RIFT_BASES[seat.team];
  if(me.hp/me.maxHp<.24||gap(me,base)<9&&me.hp/me.maxHp<.88){this.destination.x=base.x;this.destination.z=base.z;const dx=base.x-me.x,dz=base.z-me.z,d=Math.hypot(dx,dz)||1;return {...input,moveX:d>3?dx/d:0,moveZ:d>3?dz/d:0,yaw:Math.atan2(dx,dz)};}
  let target:Target|undefined;
  if(now>=this.nextThink){
   this.nextThink=now+.2;let best=Infinity;
   for(const p of players){if(!p.alive||p.team===seat.team)continue;const d=gap(me,p),score=d-(1-p.hp/p.maxHp)*4;if(d<15&&score<best){best=score;target=p;}}
   for(const u of view.units){if(u.hp<=0||u.team===seat.team)continue;if(u.team==='neutral'&&(u.kind!=='camp'||!u.target||!players.some(p=>p.id===u.target&&p.alive&&p.team===seat.team)))continue;const d=gap(me,u),score=d+(u.hp<100?-4:2);if(d<13&&score<best){best=score;target=u;}}
   if(!target){for(const s of view.structures){if(s.team===seat.team||s.hp<=0||!s.vulnerable||(s.lane!==seat.lane&&s.lane!=='base'))continue;const d=gap(me,s);if(d>19)continue;const wave=view.units.some(u=>u.team===seat.team&&u.hp>0&&gap(u,s)<13);if((wave||s.kind==='barracks'||s.kind==='core')&&d<best){best=d;target=s;}}}
   if(!target){const boss=view.units.find(u=>u.kind==='boss'&&u.hp>0);if(boss&&gap(me,boss)<32&&me.hp/me.maxHp>.6){const allies=players.filter(p=>p.id!==me.id&&p.alive&&p.team===seat.team&&gap(p,boss)<25);if(allies.some(p=>p.target===boss.id||boss.hp<boss.maxHp*.98&&gap(p,boss)<12)||allies.length>=2&&view.structures.some(s=>s.team!==seat.team&&s.hp<=0&&s.kind==='tower'))target=boss;}}
   this.targetId=target?.id??null;
  }
  target??=players.find(p=>p.id===this.targetId&&p.alive&&p.team!==seat.team)??view.units.find(u=>u.id===this.targetId&&u.hp>0&&u.team!==seat.team)??view.structures.find(s=>s.id===this.targetId&&s.hp>0&&s.vulnerable);
  if(target){
   this.destination.x=target.x;this.destination.z=target.z;
   const dx=target.x-me.x,dz=target.z-me.z,d=Math.hypot(dx,dz)||1;input.yaw=Math.atan2(dx,dz);input.targetId=target.id;input.lock=true;
   const distance=Math.max(1.3,(target.radius??.45)+.8);
   if(d>distance){input.moveX=dx/d;input.moveZ=dz/d;}
   const attacking=players.find(p=>p.alive&&p.team!==seat.team&&p.target===me.id&&gap(me,p)<4&&['heavy','special','ultimate'].includes(p.action)&&p.actionTime>.15&&p.actionTime<.35);
   if(attacking&&now>this.guardUntil+.8)this.guardUntil=now+.3;
   if(now<this.guardUntil&&me.stamina>30)return {...input,moveX:0,moveZ:0,guard:true};
   if((me.awakening??0)>=100&&!me.awakened&&d<10)input.awaken=true;
   if(now>=this.nextPress&&riftClearShot(me,target)){const moves=MOVES[me.fighter];
    if(me.ultimate>=100&&d<9&&!target.kind)input.attack='ultimate';
    else if(now>=me.cooldowns.special&&d<Math.min(13,Math.max(4,moves.special.range))&&this.attacks%5===3)input.attack='special';
    else if(now>=me.cooldowns.heavy&&d<Math.max(3,(target.radius??.45)+1.6)&&this.attacks%4===2)input.attack='heavy';
    else if(d<Math.max(3,(target.radius??.45)+1.8))input.attack='light';
    if(input.attack){this.attacks++;this.nextPress=now+.3+(this.attacks%3)*.08;}
   }return input;
  }
  const direction=seat.team==='heroes'?1:-1,length=RIFT_LENGTHS[seat.lane];
  let progress=laneProgress(seat.lane,me)+direction*7;
  let tower:RiftView['structures'][number]|undefined,nearest=Infinity;
  for(const s of view.structures){if(s.team===seat.team||s.hp<=0||!s.vulnerable||s.lane!==seat.lane||s.kind!=='tower')continue;const d=gap(me,s);if(d<nearest){nearest=d;tower=s;}}
  if(tower&&nearest<23&&!view.units.some(u=>u.team===seat.team&&u.hp>0&&gap(u,tower)<RIFT_RULES.towerRange)){
   const hold=laneProgress(seat.lane,tower)-direction*17;progress=seat.team==='heroes'?Math.min(progress,hold):Math.max(progress,hold);
  }
  const at=lanePoint(seat.lane,Math.max(0,Math.min(length,progress)));at.x+=(this.offset%2?1:-1)*1.2;at.z+=(this.offset%2?1:-1)*1.2;
  this.destination.x=at.x;this.destination.z=at.z;
  const dx=at.x-me.x,dz=at.z-me.z,d=Math.hypot(dx,dz);if(d>.8){input.moveX=dx/d;input.moveZ=dz/d;input.yaw=Math.atan2(dx,dz);}return input;
 }
}
