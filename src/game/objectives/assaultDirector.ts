import type {PlayerState} from '../types';
export interface DirectorView {state:'advance'|'surge'|'rally';lane:number;until:number}
const laneOf=(x:number)=>x<-9?0:x>9?2:1;
export class AssaultDirector {
  readonly view:DirectorView={state:'advance',lane:1,until:0};
  private lastAt=0;private nextSample=0;private pressure=0;private kills=0;private village=1;
  private health=new Map<string,number>();private recentKills=0;
  update(now:number,squad:readonly PlayerState[],village:number,kills:number){
    if(now<this.nextSample)return;this.nextSample=now+.5;
    const dt=Math.min(30,Math.max(0,now-this.lastAt));this.lastAt=now;
    this.pressure*=Math.exp(-dt/7);this.recentKills*=Math.exp(-dt/5);
    this.recentKills+=Math.max(0,kills-this.kills);this.kills=kills;
    let hp=0,down=0;
    for(const p of squad){const share=p.alive?p.hp/p.maxHp:0,old=this.health.get(p.id)??share;this.pressure+=Math.max(0,old-share)/Math.max(1,squad.length)*2;this.health.set(p.id,share);hp+=share;if(!p.alive)down++;}
    for(const id of this.health.keys())if(!squad.some(p=>p.id===id))this.health.delete(id);
    this.pressure+=Math.max(0,this.village-village)*4;this.village=village;
    hp/=Math.max(1,squad.length);
    if(now<this.view.until)return;
    const stressed=down>0||hp<.38||this.pressure>.22;
    const next=stressed&&this.view.state!=='rally'?'rally':!stressed&&hp>.65&&this.recentKills>=4?'surge':'advance';
    this.view.state=next;this.view.until=now+(next==='rally'?6:next==='surge'?7:5);
    const lanePower=[0,0,0];for(const p of squad)if(p.alive)lanePower[laneOf(p.x)]+=p.hp/p.maxHp;
    const order=[0,1,2].sort((a,b)=>(next==='rally'?lanePower[b]-lanePower[a]:lanePower[a]-lanePower[b])||((a+Math.floor(now/7))%3-(b+Math.floor(now/7))%3));
    this.view.lane=order[0];
  }
  get gap(){return this.view.state==='surge'?.78:this.view.state==='rally'?1.25:.85;}
  get batch(){return this.view.state==='surge'?6:this.view.state==='rally'?2:4;}
  index(pending:readonly {lane:number;kind:string}[],boss:string|null){
    if(pending[0]?.kind===boss)return 0;
    const stop=pending.findIndex(p=>p.kind===boss),window=stop<0?9:Math.min(9,stop);
    const i=pending.slice(0,window).findIndex(p=>p.lane===this.view.lane);return i<0?0:i;
  }
}
