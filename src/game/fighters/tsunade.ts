import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const TSUNADE_MOVES: Record<CoreSlot, MoveDefinition> = {
 light: {name:'Chakra Fist',duration:.44,contacts:[.168],damage:21,range:2.25,radius:.68,stamina:10,cooldown:.44,stun:.32,knockback:3.3,lunge:4.2,style:'melee'},
 heavy: {name:'Heavenly Foot',duration:1,contacts:[.6],damage:65,range:2.65,radius:.94,stamina:27,cooldown:1.38,stun:.78,knockback:8.8,lunge:3.8,style:'melee',outcome:'knockdown'},
 special: {name:'Monstrous Strength',duration:1,contacts:[.55],damage:120,range:2.6,radius:.96,stamina:32,cooldown:4.8,stun:.8,knockback:10,lunge:9.2,style:'melee',outcome:'wallBounce'},
 ultimate: {name:'Paradise Pure Land',duration:3.2,contacts:[.544,1.248,2.56],schedule:[46,43,250],damage:46,finisherDamage:198,range:2.85,radius:1.1,stamina:0,cooldown:23,stun:.82,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.1,close:5.1,style:'melee',guardBreak:true,confirm:{recovery:.56}},
};
export const TSUNADE_COMBOS: ComboRow = {
 lh:{name:'Rib Breaker',range:2.35,radius:.78},llh:{name:'Rising Strength',range:2.45,radius:.84},lllh:{name:'Crushing Heel',range:2.7,radius:.94},llls:{name:'Chakra Rupture',range:2.65,radius:.98},airHeavy:{name:'Falling Heel',range:2.65,radius:.94},airSpecial:{name:'Ground Splitter',radius:3.4},
};
export const TSUNADE_CONTACTS = {light:.46,heavy:.6,special:.55,ultimate:[.17,.39,.8],rush:[.46,.46,.54],combos:{lh:.46,llh:.54,lllh:.6,llls:.55,airHeavy:.6,airSpecial:.55}} as const;
export const TSUNADE_AWAKENING = {name:'Hundred Healings',clip:'Hundred Healings',duration:2.1,swapAt:.504,beats:{seal:.342,release:.504},manualOnly:true} as const;

export type TsunadeStrikeSocket='RightHand'|'LeftHand'|'RightFoot';
const HEEL_CLIPS=new Set(['Heavenly Foot','Crushing Heel','Falling Heel']);
export function tsunadeStrikeSocket(action:string,elapsed=0,clip?:string,contactIndex?:number):TsunadeStrikeSocket{
 if(action==='ultimate'&&(!clip||clip==='Paradise Pure Land')){
  const index=contactIndex===undefined?(elapsed<.896?0:elapsed<1.76?1:2):Math.max(0,Math.min(2,Math.floor(contactIndex)));
  return index===0?'RightHand':index===1?'LeftHand':'RightFoot';
 }
 if(clip&&HEEL_CLIPS.has(clip))return 'RightFoot';
 if(clip==='Rush 1'||clip==='Rib Breaker')return 'LeftHand';
 if(clip)return 'RightHand';
 return action==='heavy'?'RightFoot':'RightHand';
}
export function tsunadeAuthoredKick(action:string,elapsed=0,clip?:string):boolean{
 return clip?HEEL_CLIPS.has(clip)||action==='ultimate'&&clip==='Paradise Pure Land'&&elapsed>=1.6:action==='heavy'||action==='ultimate'&&elapsed>=1.6;
}
