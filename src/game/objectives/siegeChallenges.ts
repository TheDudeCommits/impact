export type SiegeChallengeKind = 'bulwark' | 'swift' | 'leaders' | 'rescue' | 'supplies';
export interface SiegeChallenge {
  wave:number;kind:SiegeChallengeKind;title:string;hint:string;reward:number;
  state:'preview'|'active'|'secured'|'missed';current:number;target:number;endsAt:number;
}
export function challengeFor(wave:number,seed:number,total:number,specialists:number):SiegeChallenge {
  const kinds:SiegeChallengeKind[]=['bulwark','swift','leaders'];
  const pick=((Math.imul(seed|0,31)^(Math.floor((wave-1)/2)*17))>>>0)%kinds.length;
  const kind=wave%2===0&&wave%10!==0?(wave%4===2?'rescue':'supplies'):kinds[pick];
  const target=kind==='leaders'?Math.max(1,Math.min(3,specialists)):kind==='bulwark'?600:kind==='swift'?Math.min(150,65+total*.65+(wave%3===0||wave%5===0?25:0)):1;
  const copy={
    bulwark:['HOLD THE LINE','Clear the wave with at most 600 village damage. Repairs do not erase damage.'],
    swift:['BREAK THEIR MOMENTUM',`Clear the wave within ${Math.ceil(target)} seconds.`],
    leaders:["CUT THE CHAIN",`Defeat ${target} specialist${target===1?'':'s'} or bosses within 90 seconds, then clear the wave.`],
    rescue:['NO ONE LEFT BEHIND','Clear the wave and secure the rescue wagon before the next assault.'],
    supplies:['TURN THE TIDE','Clear the wave and recover the convoy before the next assault.'],
  }[kind];
  return {wave,kind,title:copy[0],hint:copy[1],reward:Math.min(800,140+wave*15),state:'preview',current:0,target,endsAt:0};
}
export class SiegeChallenges {
  view?:SiegeChallenge;
  start(preview:SiegeChallenge,now:number){this.view={...preview,state:'active',current:0,endsAt:preview.kind==='swift'?now+preview.target:preview.kind==='leaders'?now+90:0};}
  damage(amount:number){if(this.view?.state==='active'&&this.view.kind==='bulwark')this.view.current+=Math.max(0,amount);}
  leader(now:number){this.tick(now);if(this.view?.state==='active'&&this.view.kind==='leaders')this.view.current=Math.min(this.view.target,this.view.current+1);}
  emergency(kind:'rescue'|'supplies',now?:number){if(now!==undefined)this.tick(now);if(this.view?.state==='active'&&this.view.kind===kind)this.view.current=1;}
  tick(now:number){
    const v=this.view;if(!v||v.state!=='active')return;
    if(v.kind==='swift')v.current=Math.min(v.target,Math.max(0,v.target-(v.endsAt-now)));
    const failedDamage=v.kind==='bulwark'&&v.current>v.target;
    const expired=v.endsAt>0&&now>v.endsAt;
    const failedClock=expired&&(v.kind==='swift'||v.kind==='leaders'&&v.current<v.target||v.kind==='rescue'||v.kind==='supplies');
    if(failedDamage||failedClock)v.state='missed';
  }
  finish(now:number,graceUntil=now):number {
    this.tick(now);const v=this.view;if(!v||v.state!=='active')return 0;
    if((v.kind==='rescue'||v.kind==='supplies')&&v.current<v.target&&graceUntil>now){v.endsAt=graceUntil;return 0;}
    const secured=v.kind==='bulwark'||v.kind==='swift'||v.current>=v.target;
    v.state=secured?'secured':'missed';return secured?v.reward:0;
  }
}
