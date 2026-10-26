import type {ArenaSimulation} from '../simulation';

export interface FighterProgress {
  level:number; xp:number; next:number; total:number; leveledAt:number; healedAt:number;
}
type Record = {view:FighterProgress; damage:number; kills:number; baseHp:number; baseStamina:number};
export const levelCost=(level:number)=>240+(level-1)*60;
export class FighterLevels {
  private records=new Map<string,Record>();
  constructor(private sim:ArenaSimulation){}
  register(id:string){
    const p=this.sim.actors.get(id)!.state;
    this.records.set(id,{view:{level:1,xp:0,next:levelCost(1),total:0,leveledAt:-1,healedAt:-1},damage:p.damageDealt??0,kills:p.kills??0,baseHp:p.maxHp,baseStamina:p.maxStamina??100});
  }
  remove(id:string){this.records.delete(id);}
  view(id:string){const p=this.records.get(id)?.view;return p?{...p}:undefined;}
  update(){
    for(const [id,r] of this.records){
      const p=this.sim.actors.get(id)?.state;if(!p)continue;
      const damage=p.damageDealt??0,kills=p.kills??0;
      const earned=Math.max(0,damage-r.damage)*.1+Math.max(0,kills-r.kills)*20;
      r.damage=damage;r.kills=kills;if(!earned)continue;
      const v=r.view,before=v.level;v.xp+=earned;v.total+=earned;
      while(v.xp>=v.next){v.xp-=v.next;v.level++;v.next=levelCost(v.level);}
      if(v.level===before)continue;
      v.leveledAt=this.sim.serverTime;
      const gain=v.level-1,alive=p.alive;
      this.sim.setMaxHp(id,r.baseHp*(1+gain*.08));
      if(!alive)p.hp=0;
      const staminaShare=p.stamina/(p.maxStamina??r.baseStamina);
      p.maxStamina=r.baseStamina*(1+gain*.05);p.stamina=p.maxStamina*staminaShare;
      this.sim.setMods(id,{damageOut:1+gain*.08,speed:1+Math.min(.5,gain*.015),cooldown:1/(1+gain*.04),staminaRecovery:1+gain*.05,meterGain:1+gain*.03,awakenGain:1+gain*.03});
      if(alive&&Math.floor(v.level/5)>Math.floor(before/5)){this.sim.heal(id,p.maxHp);v.healedAt=this.sim.serverTime;}
    }
  }
}
