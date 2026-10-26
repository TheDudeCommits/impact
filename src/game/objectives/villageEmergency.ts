import type {PlayerState} from '../types';
export interface EmergencyView {id:number;kind:'rescue'|'supplies';phase:'active'|'secured'|'missed';x:number;z:number;endsAt:number;progress:number;reward:number;carrier?:string;contested:boolean;helpers:string[]}
export class VillageEmergency {
  view:EmergencyView|undefined;private lastAt=0;private lastWave=0;
  begin(wave:number,now:number,side:number){
    if(wave<2||wave%2||wave%10===0||this.lastWave===wave||this.view?.phase==='active')return;
    this.lastWave=wave;this.lastAt=now;
    this.view={id:wave,kind:wave%4===2?'rescue':'supplies',phase:'active',x:side===0?-23:23,z:-5,endsAt:now+55,progress:0,reward:400+wave*35,contested:false,helpers:[]};
  }
  carrier(id:string){if(this.view?.kind==='supplies'&&this.view.phase==='active'&&!this.view.carrier)this.view.carrier=id;}
  endWave(wave:number,now:number){const e=this.view;if(e?.id===wave&&e.phase==='active'){e.phase='missed';e.endsAt=now+5;}}
  update(now:number,defenders:readonly PlayerState[],enemies:readonly PlayerState[],carrier:PlayerState|undefined):{points:number;helpers:string[]}|undefined{
    const dt=Math.min(.1,Math.max(0,now-this.lastAt));this.lastAt=now;
    const e=this.view;if(!e||e.phase!=='active')return;
    if(now>=e.endsAt){e.phase='missed';e.endsAt=now+5;return;}
    if(e.kind==='supplies'){
      if(!e.carrier)return;
      if(carrier){e.x=carrier.x;e.z=carrier.z;}
      if(carrier?.alive){e.progress=0;e.helpers=[];return;}
    }
    e.contested=enemies.some(p=>p.alive&&Math.hypot(p.x-e.x,p.z-e.z)<5&&Math.abs(p.y)<3);
    e.helpers=defenders.filter(p=>p.alive&&Math.hypot(p.x-e.x,p.z-e.z)<3.5&&Math.abs(p.y)<2).map(p=>p.id);
    e.progress=e.helpers.length&&!e.contested?Math.min(1,e.progress+dt/(e.kind==='rescue'?4:3)):Math.max(0,e.progress-dt*.12);
    if(e.progress<1)return;
    e.phase='secured';e.endsAt=now+6;return {points:e.reward,helpers:[...e.helpers]};
  }
}
