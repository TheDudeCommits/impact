const CONTACT:Readonly<Record<string,number>>={claw:.59/1.2,slash:.59/1.2,combo:.69/1.6,hammer:1.5/1.8,uppercut:.7/1.2,kick:.5/1.2};
export function siegeAttackTime(clip:string,elapsed:number,duration:number,contact:number,length:number){
  const at=CONTACT[clip];
  const t=Math.max(0,Math.min(duration,elapsed));
  if(at===undefined||contact<=0||contact>=duration)return t/Math.max(.05,duration)*length;
  const hit=at*length;
  return t<=contact?t/contact*hit:hit+(t-contact)/(duration-contact)*(length-hit);
}
export function siegePhase(id:string){let hash=2166136261;for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);return (hash>>>0)/4294967296;}
