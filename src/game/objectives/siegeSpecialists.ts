import type {ArenaSimulation} from '../simulation';
import type {PlayerInput,PlayerState} from '../types';
import {ENEMIES,type EnemyDefinition} from '../../survival/enemies';
import {specialistMove} from './specialistMoves';
export type SpecialistRole='captain'|'medic'|'sapper';
export interface SpecialistView {id:string;role:SpecialistRole;charging:number;started:number;target?:string;linked:string[];pulse:number;charges:number}
const gap=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const ordinary=(p:PlayerState)=>ENEMIES[p.enemy??'']?.role!=='boss';
const busy=new Set(['hurt','launched','knockdown','stun','splat','dodge','dash','light','heavy','special','ultimate']);
interface Specialist {view:SpecialistView;ready:number;hp:number}
export const SPECIALIST_NAMES={captain:'Shield captain',medic:'Field medic',sapper:'Demolition raider'};
export class SiegeSpecialists {
  private units=new Map<string,Specialist>();private protected=new Map<string,number>();
  constructor(private sim:ArenaSimulation){}
  register(id:string,role:SpecialistRole){const p=this.sim.actors.get(id)!.state;this.units.set(id,{view:{id,role,charging:0,started:0,linked:[],pulse:0,charges:role==='medic'?3:99},ready:this.sim.serverTime+2,hp:p.hp});}
  role(id:string){return this.units.get(id)?.view.role;}
  get view(){return [...this.units.values()].map(u=>({...u.view,linked:[...u.view.linked]}));}
  update(crowd:readonly PlayerState[]){
    for(const [id,base] of this.protected)this.sim.setMods(id,{damageIn:base});this.protected.clear();
    const now=this.sim.serverTime;
    for(const [id,u] of this.units){
      const p=this.sim.actors.get(id)?.state;
      if(!p?.alive){this.units.delete(id);continue;}
      if(u.view.role==='captain')u.view.linked=[];
      if(u.view.role!=='captain'||busy.has(p.action)||p.hitstop||p.timeStopped)continue;
      for(const ally of crowd)if(ally.id!==id&&ally.alive&&!this.units.has(ally.id)&&ordinary(ally)&&gap(p,ally)<6&&Math.abs(p.y-ally.y)<3){
        if(!this.protected.has(ally.id)){const base=this.sim.mods(ally.id).damageIn;this.protected.set(ally.id,base);this.sim.setMods(ally.id,{damageIn:base*.65});}u.view.linked.push(ally.id);
      }
      u.view.pulse=now;
    }
  }
  command(p:PlayerState,def:EnemyDefinition,target:PlayerState,crowd:readonly PlayerState[]):Omit<PlayerInput,'seq'>|undefined{
    const u=this.units.get(p.id);if(!u||u.view.role==='captain')return;
    const now=this.sim.serverTime,v=u.view,neutral={moveX:0,moveZ:0,yaw:p.yaw};
    if(v.charging){
      const channel=this.sim.actors.get(p.id)?.cast;
      if(p.hp<u.hp-.01||p.timeStopped||!channel||channel.move.name!==(v.role==='medic'?'Mending seal':'Breach charge')){v.charging=0;u.ready=now+3;return;}
      u.hp=p.hp;
      if(now>=v.charging){
        if(v.role==='medic'){
          const allies=crowd.filter(a=>a.alive&&a.id!==p.id&&gap(a,p)<7&&!this.units.has(a.id)&&ordinary(a)).slice(0,5);
          for(const a of allies)this.sim.heal(a.id,Math.min(90,a.maxHp*.18));v.linked=allies.map(a=>a.id);v.charges--;
        }else{const post=this.sim.actors.get(v.target??'')?.state;if(post?.alive&&gap(post,p)<4.5)this.sim.strike(p.id,post.id,'heavy',{name:'Breach charge',damage:330,duration:.1,contacts:[0],range:4,radius:1,stamina:0,cooldown:0,stun:0,knockback:0,style:'melee',hitstop:0});}
        v.pulse=now;v.charging=0;u.ready=now+(v.role==='medic'?10:8);
      }
      return neutral;
    }
    if(now<u.ready||busy.has(p.action)||p.hitstop||p.timeStopped||!v.charges)return;
    const injured=crowd.filter(a=>a.id!==p.id&&a.alive&&a.hp<a.maxHp*.8&&!this.units.has(a.id)&&ordinary(a));
    if(v.role==='medic'&&!injured.some(a=>gap(a,p)<7))return;
    if(v.role==='sapper'&&(!target.id.startsWith('village-')||gap(p,target)>3.5))return;
    const duration=v.role==='medic'?1.65:2.35;
    const move=specialistMove(def,v.role==='medic');
    this.sim.setMove(p.id,'special',move);v.started=now;v.charging=now+duration;v.target=target.id;u.hp=p.hp;
    return {...neutral,yaw:Math.atan2(target.x-p.x,target.z-p.z),attack:'special',targetId:target.id};
  }
}
