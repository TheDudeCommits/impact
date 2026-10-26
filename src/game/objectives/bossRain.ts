import type {ArenaSimulation} from '../simulation';
import type {CombatEvent,PlayerState} from '../types';
import type {MoveDefinition} from '../moves';
import {ENEMIES,type EnemyMove} from '../../survival/enemies';

export interface SiegeWarning {
  id:number;at:number;kind:'hazard';enemy:string;actor:string;text:string;
  x:number;y:number;z:number;radius:number;value:number;
}
interface RainCast {source:string;enemy:string;move:EnemyMove;left:number;next:number}
interface Strike {warning:SiegeWarning;move:MoveDefinition}

export class BossRain {
  readonly warnings:SiegeWarning[]=[];
  private casts=new Map<string,RainCast>();
  private strikes:Strike[]=[];
  private serial=0;
  private seen=0;
  constructor(private sim:ArenaSimulation,private defenders:()=>PlayerState[],private random:()=>number){}

  consume(events:readonly CombatEvent[]){
    for(const event of events){
      if(event.id<=this.seen)continue;this.seen=event.id;
      if(event.kind!=='cast')continue;
      const p=this.sim.actors.get(event.actorId)?.state;
      const move=p?.enemy?ENEMIES[p.enemy]?.moves.find(m=>m.name===event.move):undefined;
      if(!p?.alive||!p.enemy||!move?.rain)continue;
      this.casts.set(p.id,{source:p.id,enemy:p.enemy,move,left:move.rain.count,next:this.sim.serverTime+(move.rain.start??.2)});
    }
  }

  update(){
    const now=this.sim.serverTime,heroes=this.defenders().filter(p=>p.alive),bounds=this.sim.bounds;
    for(const [id,cast] of this.casts){
      const source=this.sim.actors.get(id)?.state;
      if(!source?.alive||!heroes.length){this.casts.delete(id);continue;}
      const target=heroes.find(p=>p.id===source.target)??heroes.reduce((a,b)=>Math.hypot(a.x-source.x,a.z-source.z)<Math.hypot(b.x-source.x,b.z-source.z)?a:b);
      const rain=cast.move.rain!;
      while(cast.left>0&&now>=cast.next){
        const first=cast.left===rain.count;cast.left--;cast.next+=rain.every;
        if(this.strikes.length>=32)continue;
        const radius=first?0:rain.spread*Math.sqrt(this.random()),angle=this.random()*Math.PI*2;
        const warning:SiegeWarning={id:++this.serial,at:now,kind:'hazard',enemy:cast.enemy,actor:id,text:cast.move.element??'steel',
          x:Math.max(-bounds.halfX+1,Math.min(bounds.halfX-1,target.x+Math.sin(angle)*radius)),
          y:target.grounded?target.y:source.y,
          z:Math.max(-bounds.halfZ+1,Math.min(bounds.halfZ-1,target.z+Math.cos(angle)*radius)),radius:rain.radius,value:now+rain.lead};
        this.warnings.push(warning);
        this.strikes.push({warning,move:{name:cast.move.name,duration:.1,contacts:[0],damage:rain.damage,range:1,radius:rain.radius,stamina:0,cooldown:0,stun:.5,knockback:rain.knockback??6,style:'bomb',hitstop:0}});
      }
      if(cast.left===0)this.casts.delete(id);
    }
    for(let i=this.strikes.length-1;i>=0;i--){
      const strike=this.strikes[i],w=strike.warning;if(now<w.value)continue;
      this.strikes.splice(i,1);
      for(const p of heroes)if(Math.hypot(p.x-w.x,p.z-w.z)<=w.radius+.35&&Math.abs(p.y-w.y)<=2.4){
        this.sim.strike(w.actor,p.id,'heavy',strike.move,{x:w.x,y:w.y+.4,z:w.z});
      }
    }
    while(this.warnings.length&&this.warnings[0].value<now-1)this.warnings.shift();
  }
}
