import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const ASUKA_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Progressive Edge',duration:.47,contacts:[.168],damage:20,range:3.55,radius:.76,stamina:11,cooldown:.43,stun:.34,knockback:3.5,lunge:3.6,style:'melee'},
 heavy:{name:'Cyclone Heel',duration:1,contacts:[.6],damage:65,range:3.5,radius:.91,stamina:29,cooldown:1.39,stun:.80,knockback:9,lunge:3.6,style:'melee',outcome:'launch'},
 special:{name:'A.T. Field Breaker',duration:1.1,contacts:[.638],damage:114,range:3.4,radius:1.04,stamina:35,cooldown:4.9,stun:.85,knockback:10,lunge:5.8,style:'melee',outcome:'knockdown'},
 ultimate:{name:'Nine Second Execution',duration:3.6,contacts:[.50,1.224,2.016,2.988],schedule:[35,48,61,220],damage:35,finisherDamage:185,range:3.55,radius:1.05,stamina:0,cooldown:24,stun:.9,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.8,close:5.0,style:'melee',guardBreak:true,confirm:{recovery:.6}},
};
export const ASUKA_COMBOS:ComboRow={lh:{name:'Crosscut Drive',range:3.45,radius:.85},llh:{name:'Rising EVA Heel',range:3.5,radius:.89},lllh:{name:'Armor Splitter',range:3.6,radius:.98},llls:{name:'Field Breach',range:3.5,radius:1.03},airHeavy:{name:'Falling Unit Two',range:3.5,radius:.94},airSpecial:{name:'Descending Edge',radius:3.7}};
export const ASUKA_AWAKENING={name:'Soul Synchronization',clip:'Soul Synchronization',duration:2.5,entryDuration:.9,swapAt:.432,beats:{chest:.207,resolve:.378,field:.594,ready:.747},manualOnly:true}as const;
export const ASUKA_CINEMATIC={opener:{clip:'Nine Second Execution',at:.14},cine:{from:.14,at:.83,windows:[[.14,.44,.34],[.44,.70,.56],[.70,1,.83]]}}as const;
export type AsukaStrikeSocket='RightHand'|'LeftHand'|'RightFoot';
export function asukaStrikeSocket(action:string,clip:string,sourceFraction=0,contactIndex?:number):AsukaStrikeSocket{
 if(clip==='Nine Second Execution'||action==='ultimate'&&!clip){
  const index=contactIndex??(sourceFraction<.24?0:sourceFraction<.44?1:sourceFraction<.70?2:3);
  return index===1?'RightFoot':index===2?'LeftHand':'RightHand';
 }
 if(['Cyclone Heel','Rush 2','Rising Eva Heel','Falling Unit Two'].includes(clip))return 'RightFoot';
 if(['A T Field Breaker','Rush 3','Field Breach'].includes(clip))return 'LeftHand';
 return action==='heavy'&&!clip?'RightFoot':action==='special'&&!clip?'LeftHand':'RightHand';
}
export function asukaAuthoredKick(clip:string,sourceFraction=0):boolean{
 return ['Cyclone Heel','Rush 2','Rising Eva Heel','Falling Unit Two'].includes(clip)||clip==='Nine Second Execution'&&sourceFraction>=.20&&sourceFraction<.43;
}
