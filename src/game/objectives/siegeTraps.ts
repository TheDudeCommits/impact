import type {ArenaSimulation} from '../simulation';
import type {PlayerState} from '../types';
import type {TrapTheme} from './siegeChapters';

export const TRAP_SITES=[{x:-17,z:10},{x:0,z:13},{x:17,z:10}] as const;
export interface TrapView {x:number;z:number;snaredAt:number;burstAt:number;burstUntil:number;readyAt:number;combo:boolean;}
export interface TrapLevels {traps:number;charges:number;}
export const TRAP_THEMES:Record<TrapTheme,{snare:string;payload:string;combo:string;color:number}>={
  wire:{snare:'Shinobi tripwire',payload:'Explosive tags',combo:'WIRE + BLAST',color:0xef754f},
  purify:{snare:'Binding seals',payload:'Purification braziers',combo:'BIND + PURIFY',color:0xbb9cff},
  harpoon:{snare:'Harpoon lines',payload:'Powder charges',combo:'PIN + VOLLEY',color:0xe2b66d},
  discharge:{snare:'Grounding cables',payload:'Discharge relays',combo:'GROUND + DISCHARGE',color:0x82d6e8},
};
const near=(p:PlayerState,site:{x:number;z:number})=>p.alive&&p.team==='horde'&&Math.abs(p.y)<2.5&&Math.hypot(p.x-site.x,p.z-site.z)<4.5;
export class SiegeTraps {
  readonly sites:TrapView[]=TRAP_SITES.map(s=>({...s,snaredAt:-100,burstAt:0,burstUntil:0,readyAt:0,combo:false}));
  private snared=new Map<string,number>();
  private nextSnare=[0,0,0];
  constructor(private sim:ArenaSimulation){}
  reset(){this.snared.clear();this.nextSnare.fill(0);for(const s of this.sites){s.snaredAt=-100;s.burstAt=0;s.burstUntil=0;s.readyAt=0;s.combo=false;}}
  slow(id:string,now:number,level:number){return (this.snared.get(id)??0)>now?Math.max(.4,1-.22*level):1;}
  volleyMultiplier(id:string,now:number){return (this.snared.get(id)??0)>now?1.5:1;}
  update(crowd:readonly PlayerState[],levels:TrapLevels,theme:TrapTheme,wave:number){
    const now=this.sim.serverTime;
    for(const [id,until] of this.snared)if(until<=now||!this.sim.actors.get(id)?.state.alive)this.snared.delete(id);
    for(const [i,site] of this.sites.entries()){
      const targets=crowd.filter(p=>near(p,site));
      if(levels.traps&&targets.length&&now>=this.nextSnare[i]){
        site.snaredAt=now;this.nextSnare[i]=now+5;
        for(const p of targets)this.snared.set(p.id,now+2+levels.traps*.5);
      }
      if(site.burstAt>0&&now>=site.burstAt){
        site.combo=targets.some(p=>(this.snared.get(p.id)??0)>now);
        for(const p of targets){
          const combo=(this.snared.get(p.id)??0)>now?1.65:1;
          this.sim.damage(p.id,(45+levels.charges*35)*(1+(wave-1)*.025)*combo,'village-defence',TRAP_THEMES[theme].payload);
        }
        site.burstAt=0;site.burstUntil=now+.45;site.readyAt=now+Math.max(4,8-levels.charges);
      }
      if(levels.charges&&targets.length&&!site.burstAt&&now>=site.readyAt)site.burstAt=now+.8;
    }
  }
  snapshot(){return this.sites.map(s=>({...s}));}
}
