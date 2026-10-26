import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const BYAKUYA_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Senbonzakura',duration:.43,contacts:[.152],damage:20,range:2.75,radius:.69,stamina:10,cooldown:.41,stun:.31,knockback:3.4,lunge:3.3,style:'melee'},
 heavy:{name:'Senkei Cross',duration:59/60,contacts:[59/60*.55],damage:65,range:3.05,radius:.95,stamina:28,cooldown:1.38,stun:.76,knockback:8.3,lunge:3.5,style:'melee',outcome:'knockdown'},
 special:{name:'Scatter',duration:1.05,contacts:[.567],damage:114,range:19,radius:1.1,stamina:34,cooldown:4.75,stun:.79,knockback:8.7,speed:24,style:'projectile'},
 ultimate:{name:'Shukei Hakuteiken',duration:3.5,contacts:[.56,1.645,2.8],schedule:[40,57,241],damage:40,finisherDamage:210,range:3.2,radius:1.12,stamina:0,cooldown:24,stun:.9,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.5,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.58}},
};
export const BYAKUYA_COMBOS:ComboRow={lh:{name:'Crossing Petals',range:2.95,radius:.84},llh:{name:'Rising Senbonzakura',range:2.9,radius:.85},lllh:{name:'Senkei Breaker',range:3.1,radius:1.0},llls:{name:'Petal Pursuit',range:3.2,radius:1.05},airHeavy:{name:'Falling Senbonzakura',range:3.0,radius:.95},airSpecial:{name:'Petal Descent',radius:3.5}};
export const BYAKUYA_CONTACTS={light:.44,heavy:.55,special:.54,ultimate:[.18,.47,.8],rush:[.44,.55,.44],combos:{lh:.55,llh:.44,lllh:.55,llls:.54,airHeavy:.44,airSpecial:.54}}as const;
export const BYAKUYA_AWAKENING={name:'Senbonzakura Kageyoshi',clip:'Senbonzakura Kageyoshi',duration:2.3,entryDuration:.9,beats:{hold:.162,release:.288,drop:.504,resolve:.792},manualOnly:true,form:'aura'}as const;
export type ByakuyaStrikeSide='Right'|'Left';
export function byakuyaStrikeSide(action:string,elapsed=0,clip?:string,contactIndex?:number):ByakuyaStrikeSide{
 if(action==='ultimate'&&(!clip||clip==='Shukei Hakuteiken')){
  const index=contactIndex===undefined?(elapsed<1.1375?0:elapsed<2.2225?1:2):Math.max(0,Math.min(2,Math.floor(contactIndex)));
  return index===1?'Left':'Right';
 }
 if(clip)return ['Scatter','Petal Pursuit','Petal Descent'].includes(clip)?'Left':'Right';
 return action==='special'?'Left':'Right';
}
