import type {ArenaSimulation} from '../simulation';
import type {PlayerInput,PlayerState} from '../types';
import type {EnemyDefinition,EnemyMove} from '../../survival/enemies';
import {gateWaypoint} from './lastStand';
import {SIEGE_PACING} from './siegePacing';
const REACTING=new Set(['hurt','launched','knockdown','stun','splat','dodge','dash']);
const ATTACKING=new Set(['light','heavy','special','ultimate']);

export class SiegeBrain {
  private readyAt:number;private nextShot=0;private attacks=0;
  private readonly melee:readonly EnemyMove[];private readonly ranged:readonly EnemyMove[];
  constructor(private id:string,private def:EnemyDefinition,now:number,private offset:number){this.readyAt=now+.6+offset*.5;this.melee=def.moves.filter(m=>(m.phase??0)===0&&m.style==='melee');this.ranged=def.moves.filter(m=>(m.phase??0)===0&&m.style==='projectile');}
  command(sim:ArenaSimulation,self:PlayerState,target:PlayerState,now:number,slow=1,shotAllowed=true):Omit<PlayerInput,'seq'>{
    const waypoint=gateWaypoint(self,target),at=waypoint??target,dx=at.x-self.x,dz=at.z-self.z,d=Math.hypot(dx,dz)||.001;
    const input:Omit<PlayerInput,'seq'>={moveX:0,moveZ:0,yaw:Math.atan2(dx,dz),targetId:target.id,lock:true};
    if(!self.alive||REACTING.has(self.action)||self.hitstop||ATTACKING.has(self.action))return input;
    if(waypoint)return {...input,moveX:dx/d*slow,moveZ:dz/d*slow};
    const ranged=this.def.brain==='gunner'&&d>4;
    const available=ranged?this.ranged:this.melee;
    const move:EnemyMove|undefined=available[this.attacks%Math.max(1,available.length)]??this.def.moves[0];
    if(!move)return input;
    const reach=ranged?Math.min(14,move.maxRange??move.range):Math.max(1.3,Math.min(move.range+.3+(target.girth??0),3.3));
    if(d>reach){
      let flank=!ranged&&!target.id.startsWith('village-')?Math.min(1,Math.max(0,(d-5)/4))*(this.offset<.5?-2:2):0;
      if(flank&&gateWaypoint(self,{x:at.x+dz/d*flank,z:at.z-dx/d*flank}))flank=0;
      const mx=dx+dz/d*flank,mz=dz-dx/d*flank,length=Math.hypot(mx,mz);
      input.moveX=mx/length*slow;input.moveZ=mz/length*slow;return input;
    }
    if(now>=this.readyAt&&now>=(self.cooldowns[move.slot]??0)&&(!ranged||shotAllowed&&now>=this.nextShot)){
      sim.setMove(this.id,move.slot,move);input.attack=move.slot;this.attacks++;
      this.readyAt=now+move.duration+(ranged?.75:this.def.role==='brute'?.5:.22)+this.offset*.22;
      if(ranged)this.nextShot=now+SIEGE_PACING.rifleRecovery+this.offset*2;
    }
    return input;
  }
}
