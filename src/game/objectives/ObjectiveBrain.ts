import type {DefenderOrder} from './defenderOrders';
import type {Difficulty} from '../social/custom';
import type {PlayerInput,PlayerState,StageId} from '../types';
import {MOVES} from '../moves';
import {STAGES} from '../stages';
import {OBJECTIVE_STAGE,type ObjectiveView} from './model';
import {VILLAGE,gateWaypoint} from './lastStand';
const ATTACKS=new Set(['light','heavy','special','ultimate']);
const distance=(a:PlayerState,b:PlayerState)=>Math.hypot(a.x-b.x,a.z-b.z);
export class ObjectiveBrain {
  private nextPress=0;private roll:number;private hits=0;private guardUntil=0;private reactedTo='';
  private target:string|undefined;private reconsiderAt=0;private nextDodge=0;
  constructor(readonly id:string,seed=1,private difficulty:Difficulty='normal'){this.roll=Math.max(1,seed);}
  private random(){this.roll=this.roll*16807%2147483647;return this.roll/2147483647;}
  command(players:readonly PlayerState[],view:ObjectiveView,now:number,stage:StageId=OBJECTIVE_STAGE[view.kind],order?:DefenderOrder|null):Omit<PlayerInput,'seq'>{
    const me=players.find(p=>p.id===this.id),input:Omit<PlayerInput,'seq'>={moveX:0,moveZ:0,yaw:me?.yaw??0};
    if(!me?.alive||view.phase!=='active')return input;
    const allies=players.filter(p=>p.id!==me.id&&p.alive&&p.team===me.team);
    if(view.kind==='last-stand'){
      const warning=view.village?.warnings?.find(w=>now-w.at>.18&&w.value>now&&w.value-now<.75&&Math.abs(me.y-w.y)<2.4&&Math.hypot(me.x-w.x,me.z-w.z)<w.radius+1);
      if(warning){
        const dx=me.x-warning.x,dz=me.z-warning.z,d=Math.hypot(dx,dz);
        const x=d>.1?dx/d:Math.sin(me.yaw+Math.PI/2),z=d>.1?dz/d:Math.cos(me.yaw+Math.PI/2);
        const dash=me.stamina>40&&warning.value-now<.4&&now>this.nextDodge;if(dash)this.nextDodge=now+2;
        return {...input,moveX:x,moveZ:z,dash};
      }
      const fallen=order?.role==='rescue'?players.find(p=>p.id===order.target):order!==undefined?undefined:view.seats.filter(s=>s.id!==this.id&&s.down).map(s=>players.find(p=>p.id===s.id)).filter((p):p is PlayerState=>!!p).sort((a,b)=>distance(a,me)-distance(b,me))[0];
      if(fallen){
        const rescuers=[me,...allies.filter(p=>view.seats.some(s=>s.id===p.id&&s.bot))].sort((a,b)=>distance(a,fallen)-distance(b,fallen)||a.id.localeCompare(b.id));
        if(order?.role==='rescue'||rescuers[0].id===me.id){const waypoint=gateWaypoint(me,fallen),at=waypoint??fallen,dx=at.x-me.x,dz=at.z-me.z,d=Math.hypot(dx,dz)||1,arrived=!waypoint&&d<=2;return {...input,moveX:arrived?0:dx/d,moveZ:arrived?0:dz/d,yaw:Math.atan2(dx,dz),guard:arrived};}
      }
    }
    const event=view.village?.emergency;
    const detour=order?.role!=='rescue'&&!(view.village?.pressure?.some(p=>p.level>=2))&&event?.phase==='active'&&((view.village?.hp??0)/(view.village?.maxHp??1)>.45)&&!view.seats.some(s=>s.down);
    if(detour&&event){
      const humans=view.seats.filter(s=>!s.bot).map(s=>players.find(p=>p.id===s.id)).filter((p):p is PlayerState=>!!p&&p.alive);
      const candidates=[me,...allies.filter(p=>view.seats.some(s=>s.id===p.id&&s.bot))].sort((a,b)=>Math.hypot(a.x-event.x,a.z-event.z)-Math.hypot(b.x-event.x,b.z-event.z)||a.id.localeCompare(b.id));
      const threat=players.some(p=>p.alive&&p.team!==me.team&&Math.hypot(p.x-event.x,p.z-event.z)<7);
      const carrier=players.find(p=>p.id===event.carrier&&p.alive);
      if(candidates[0]?.id===me.id&&!humans.some(p=>Math.hypot(p.x-event.x,p.z-event.z)<8)&&!threat&&!carrier){
        const at=gateWaypoint(me,event)??event,dx=at.x-me.x,dz=at.z-me.z,d=Math.hypot(dx,dz)||1;
        return {...input,moveX:d>2?dx/d:0,moveZ:d>2?dz/d:0,yaw:Math.atan2(dx,dz),guard:d<=2};
      }
    }
    const opponents=players.filter(p=>p.alive&&p.team!==me.team);
    const priority=(p:PlayerState)=>{
      if(order?.role==='intercept'&&p.id===order.target)return -1000;
      const home=Math.hypot(p.x-VILLAGE.x,p.z-VILLAGE.z);
      if(view.kind==='last-stand'){const role=view.village?.specialists?.find(s=>s.id===p.id);const urgency=role?.role==='sapper'&&role.charging?40:role?.role==='medic'?22:role?.role==='captain'?14:0;const objective=detour&&event&&Math.hypot(p.x-event.x,p.z-event.z)<8?15:0;return distance(p,me)+(home<15?-100:home*1.2)-urgency-objective;}
      const gap=distance(p,me),hurt=1-p.hp/p.maxHp;
      const occupied=allies.filter(a=>a.target===p.id&&distance(a,p)<9).length;
      const threatened=allies.some(a=>a.hp/a.maxHp<.4&&p.target===a.id&&distance(a,p)<8);
      return gap-(gap<15?hurt*12:0)-(threatened&&gap<18?12:0)+occupied*(hurt>.35?-3:2);
    };
    let enemy=opponents.find(p=>p.id===(ATTACKS.has(me.action)?me.target:this.target));
    if(!enemy||now>=this.reconsiderAt&&!ATTACKS.has(me.action)){
      enemy=opponents.sort((a,b)=>priority(a)-priority(b)||a.id.localeCompare(b.id))[0];this.target=enemy?.id;this.reconsiderAt=now+.7;
    }
    if(!enemy)return input;
    const waypoint=view.kind==='last-stand'?gateWaypoint(me,enemy):undefined;
    if(waypoint){const dx=waypoint.x-me.x,dz=waypoint.z-me.z,d=Math.hypot(dx,dz)||1;return {...input,moveX:dx/d,moveZ:dz/d,yaw:Math.atan2(dx,dz)};}
    const dx=enemy.x-me.x,dz=enemy.z-me.z,gap=Math.hypot(dx,dz),d=gap||1;
    input.yaw=Math.atan2(dx,dz);input.targetId=enemy.id;input.lock=true;
    if(view.kind==='bad-blood'&&me.team==='heroes'&&view.seats.some(s=>s.team==='heroes'&&s.reviveAt)&&allies.length===0&&d<12){
      const arena=STAGES[stage],edgeX=Math.abs(me.x)>arena.halfX-4,edgeZ=Math.abs(me.z)>arena.halfZ-4;
      const awayX=edgeX?-Math.sign(me.x):edgeZ?dz/d:-dx/d,awayZ=edgeZ?-Math.sign(me.z):edgeX?-dx/d:-dz/d;
      const dash=me.stamina>45&&d<5&&now>this.nextDodge;if(dash)this.nextDodge=now+2;
      return {...input,moveX:awayX,moveZ:awayZ,dash};
    }
    if(d>2.1){input.moveX=dx/d;input.moveZ=dz/d;}
    const threat=players.find(p=>p.alive&&p.team!==me.team&&p.target===me.id&&ATTACKS.has(p.action)&&distance(p,me)<5);
    const cue=threat?`${threat.id}:${threat.actionStarted}`:'';
    if(threat&&cue!==this.reactedTo&&threat.actionTime>.12&&threat.actionTime<.55){
      this.reactedTo=cue;
      if(me.stamina>32&&this.random()<(this.difficulty==='easy'?.35:.7)){
        if(['heavy','ultimate'].includes(threat.action)&&now>this.nextDodge){this.nextDodge=now+2;return {...input,moveX:-dz/d,moveZ:dx/d,dash:true};}
        this.guardUntil=now+.38;
      }
    }
    if(now<this.guardUntil)return {...input,moveX:0,moveZ:0,guard:true};
    if(me.stamina<24&&gap<5)return {...input,moveX:-dx/d,moveZ:-dz/d};
    if((me.awakening??0)>=100&&!me.awakened&&gap<10)input.awaken=true;
    if(now<this.nextPress||gap>15)return input;
    const moves=MOVES[me.fighter];
    if(me.ultimate>=100&&gap<10)input.attack='ultimate';
    else if(now>=me.cooldowns.special&&gap<Math.max(5,Math.min(14,moves.special.range))&&this.random()<.12)input.attack='special';
    else if(now>=me.cooldowns.heavy&&gap<Math.max(3,Math.min(10,moves.heavy.range))&&this.hits%4===3)input.attack='heavy';
    else if(gap<Math.max(2.8,Math.min(4,moves.light.range+.5)))input.attack='light';
    if(input.attack){this.hits++;this.nextPress=now+(this.difficulty==='easy'?.65:this.difficulty==='hard'?.18:.3)+this.random()*.12+(this.hits%3===0?.35:0);}
    return input;
  }
}
