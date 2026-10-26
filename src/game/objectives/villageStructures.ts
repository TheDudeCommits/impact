import type {ArenaSimulation} from '../simulation';
import type {CollisionWorld,CombatEvent,PlayerState} from '../types';
import {MOVES} from '../moves';

export const VILLAGE_STRUCTURES=[
  {id:'village-west',name:'West barricade',x:-17,z:16},
  {id:'village-east',name:'East barricade',x:17,z:16},
  {id:'village-keep',name:'Village guardhouse',x:0,z:29},
] as const;
export interface VillageStructure {id:string;name:string;x:number;z:number;hp:number;maxHp:number;hitAt:number;}
export const isVillageStructure=(id:string)=>id.startsWith('village-')&&VILLAGE_STRUCTURES.some(s=>s.id===id);

export function villageCollision(base?:CollisionWorld):CollisionWorld{return {
  move:(id,p,d)=>isVillageStructure(id)?{x:0,y:0,z:0,grounded:true}:base?.move(id,p,d)??{...d,y:Math.max(-p.y,d.y),grounded:p.y+d.y<=0},
  ...(base?.raycast?{raycast:(a,b)=>base.raycast!(a,b)}:{}),
  remove:id=>base?.remove?.(id),dispose:()=>base?.dispose?.(),
};}

export class VillageStructures {
  readonly view:VillageStructure[];
  constructor(private sim:ArenaSimulation){
    this.view=VILLAGE_STRUCTURES.map(s=>({...s,hp:4000,maxHp:4000,hitAt:-100}));
    for(const s of this.view)sim.addCombatant(s.id,{name:s.name,enemy:s.id,team:'defenders',kit:MOVES.ace,maxHp:s.maxHp,spawn:{x:s.x,y:0,z:s.z},size:1.5,girth:1.45,anchored:true,armour:true,breaker:false,poise:1e9,mods:{stunIn:0,knockbackIn:0,meterGain:0,awakenGain:0}});
  }
  living():PlayerState[]{return this.view.map(s=>this.sim.actors.get(s.id)!.state).filter(s=>s.alive);}
  sync(events:readonly CombatEvent[]=[],now=this.sim.serverTime){
    for(const s of this.view){const p=this.sim.actors.get(s.id)!.state;s.hp=p.hp;s.maxHp=p.maxHp;if(events.some(e=>e.targetId===s.id&&e.kind==='hit'))s.hitAt=now;}
  }
  repair(amount:number){
    let restored=0;
    for(const s of [...this.view].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)){
      const p=this.sim.actors.get(s.id)!.state,add=Math.min(amount,p.maxHp-p.hp);if(add<=0)continue;
      if(!p.alive)this.sim.revive(s.id,add);else this.sim.heal(s.id,add);
      this.sim.actors.get(s.id)!.evadeUntil=-Infinity;
      amount-=add;restored+=add;if(amount<=0)break;
    }
    this.sync();return restored;
  }
  reinforce(){for(const s of this.view){const p=this.sim.actors.get(s.id)!.state,old=p.hp,maximum=p.maxHp+1000;this.sim.setMaxHp(s.id,maximum);p.hp=old;if(!p.alive)this.sim.revive(s.id,1000);else this.sim.heal(s.id,1000);this.sim.actors.get(s.id)!.evadeUntil=-Infinity;}this.sync();}
  seals(tier:number){for(const s of this.view)this.sim.setMods(s.id,{damageIn:1-tier*.12});}
  get hp(){return this.view.reduce((n,s)=>n+s.hp,0);}
  get maxHp(){return this.view.reduce((n,s)=>n+s.maxHp,0);}
}
