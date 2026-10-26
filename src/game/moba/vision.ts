import {MOVES} from '../moves';
import type {CombatEvent,PlayerState,Vec3} from '../types';
import {RIFT_BASES,RIFT_BOSS} from './map';
import {RIFT_RULES,type RiftEvent,type RiftSeat,type RiftSnapshot,type RiftStructure,type RiftTeam,type RiftUnit} from './model';
export interface VisionCircle {x:number;z:number;radius:number}
export const VISION_RADIUS={fighter:24,creep:16,tower:22,fountain:26} as const;
export function visibleAt(circles:readonly VisionCircle[],at:{x:number;z:number}):boolean {
 for(const c of circles){const dx=c.x-at.x,dz=c.z-at.z;if(dx*dx+dz*dz<=c.radius*c.radius)return true;}return false;
}
export function canSeeFrom(team:RiftTeam,at:{x:number;z:number},players:Iterable<PlayerState>,units:Iterable<RiftUnit>,structures:Iterable<RiftStructure>):boolean {
 const close=(source:{x:number;z:number},radius:number)=>{const dx=source.x-at.x,dz=source.z-at.z;return dx*dx+dz*dz<=radius*radius;};
 if(close(RIFT_BASES[team],VISION_RADIUS.fountain))return true;
 for(const p of players)if(p.alive&&p.team===team&&close(p,VISION_RADIUS.fighter))return true;
 for(const u of units)if(u.hp>0&&u.team===team&&close(u,VISION_RADIUS.creep))return true;
 for(const s of structures)if(s.hp>0&&s.team===team&&s.kind!=='barracks'&&close(s,VISION_RADIUS.tower))return true;
 return false;
}
export function teamVision(snapshot:RiftSnapshot,team:RiftTeam):VisionCircle[]{
 const circles:VisionCircle[]=[{...RIFT_BASES[team],radius:VISION_RADIUS.fountain}];
 for(const p of snapshot.players)if(p.alive&&p.team===team)circles.push({x:p.x,z:p.z,radius:VISION_RADIUS.fighter});
 for(const u of snapshot.rift.units)if(u.hp>0&&u.team===team&&circles.length<RIFT_RULES.unitCap+6)circles.push({x:u.x,z:u.z,radius:VISION_RADIUS.creep});
 for(const s of snapshot.rift.structures)if(s.hp>0&&s.team===team&&s.kind!=='barracks')circles.push({x:s.x,z:s.z,radius:VISION_RADIUS.tower});
 return circles;
}
export function visibleBeam(circles:readonly VisionCircle[],a:Vec3,b:Vec3):{origin:Vec3;endpoint:Vec3}|undefined {
 const dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;if(length2<1e-8)return;
 let first=Infinity,last=-Infinity;
 for(const c of circles){const x=a.x-c.x,z=a.z-c.z,p=x*dx+z*dz,disc=p*p-length2*(x*x+z*z-c.radius*c.radius);if(disc<0)continue;
  const root=Math.sqrt(disc),enter=Math.max(0,(-p-root)/length2),leave=Math.min(1,(-p+root)/length2);if(leave<=enter)continue;first=Math.min(first,enter);last=Math.max(last,leave);
 }
 if(last<=first)return;const at=(t:number)=>({x:a.x+dx*t,y:a.y+(b.y-a.y)*t,z:a.z+dz*t});return {origin:at(first),endpoint:at(last)};
}
const publicSeat=(seat:RiftSeat,seen:boolean):RiftSeat=>({...seat,lane:'mid',laneKnown:false,gold:0,earned:0,xp:0,healing:0,lastHits:0,boon:undefined,inventory:seen?[...seat.inventory]:[],recallAt:seen?seat.recallAt:undefined,hasteUntil:seen?seat.hasteUntil:undefined,buybackAt:undefined});
export function snapshotFor(snapshot:RiftSnapshot,id:string):RiftSnapshot {
 const seat=snapshot.rift.seats.find(s=>s.id===id),team=seat?.team??'heroes';
 if(seat&&snapshot.rift.phase!=='active')return {...snapshot,prediction:snapshot.prediction?.[id]?{[id]:snapshot.prediction[id]}:undefined};
 const circles=seat?teamVision(snapshot,team):[],seen=(at:{x:number;z:number})=>visibleAt(circles,at);
 const players=snapshot.players.filter(p=>!!seat&&(p.team===team||seen(p))),units=snapshot.rift.units.filter(u=>!!seat&&(u.team===team||seen(u)));
 const known=new Set([...players.map(p=>p.id),...units.map(u=>u.id),...snapshot.rift.structures.map(s=>s.id)]);
 const playerIds=new Set(players.map(p=>p.id));
 const visiblePoint=(at:Vec3|undefined)=>at&&seen(at)?{...at}:undefined;
 const events:CombatEvent[]=[];
 for(const event of snapshot.events){
  const friendlyCast=(event.kind==='cast'||event.kind==='release')&&snapshot.players.some(p=>p.id===event.actorId&&p.team===team)&&!!seat;
  const beam=!friendlyCast&&event.kind==='release'&&event.origin&&event.endpoint&&event.fighter&&event.slot&&MOVES[event.fighter][event.slot]?.style==='beam'?visibleBeam(circles,event.origin,event.endpoint):undefined;
  const origin=friendlyCast&&event.origin?{...event.origin}:beam?.origin??visiblePoint(event.origin),endpoint=friendlyCast&&event.endpoint?{...event.endpoint}:beam?.endpoint??visiblePoint(event.endpoint);
  if(!origin&&!endpoint&&!playerIds.has(event.actorId)&&!(event.targetId&&playerIds.has(event.targetId)))continue;
  events.push({...event,origin,endpoint,targetId:event.targetId&&known.has(event.targetId)?event.targetId:undefined});
 }
 const riftEvents:RiftEvent[]=[];
 for(const event of snapshot.rift.events){
  if(event.kind==='wave'||event.kind==='tower'||event.kind==='barracks'||event.kind==='core'||event.kind==='boss'||event.kind==='buyback')riftEvents.push({...event});
  else if(event.kind==='ping'){if(event.team===team&&seat)riftEvents.push({...event});}
  else if(seen(event))riftEvents.push({...event,targetId:event.targetId&&known.has(event.targetId)?event.targetId:undefined});
  else if(event.team===team&&seat)riftEvents.push({...event,x:0,z:0,hidden:true});
  else if(event.kind==='kill')riftEvents.push({...event,x:0,z:0,hidden:true});
 }
 const bossKnown=!!seat&&seen(RIFT_BOSS);
 return {...snapshot,players:players.map(p=>({...p,target:p.target&&known.has(p.target)?p.target:null})),events,
  reactions:snapshot.reactions?Object.fromEntries(Object.entries(snapshot.reactions).filter(([key])=>playerIds.has(key))):undefined,
  prediction:snapshot.prediction?.[id]?{[id]:snapshot.prediction[id]}:undefined,
  rift:{...snapshot.rift,vision:{team,circles},bossKnown,bossRespawnAt:bossKnown?snapshot.rift.bossRespawnAt:0,
   seats:snapshot.rift.seats.map(s=>s.team===team&&seat?{...s,inventory:[...s.inventory]}:publicSeat(s,playerIds.has(s.id))),
   units:units.map(u=>({...u,target:u.target&&known.has(u.target)?u.target:null})),
   structures:snapshot.rift.structures.map(s=>s.team===team&&seat||seen(s)||s.hp<=0?{...s,target:s.target&&known.has(s.target)?s.target:null}:{...s,hp:s.maxHp,target:null,attackAt:0,fireAt:undefined,hidden:true}),
   runes:snapshot.rift.runes.map(r=>seen(r)?{...r}:{...r,available:false,respawnAt:0,hidden:true}),events:riftEvents,
  }};
}
