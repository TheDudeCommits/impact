import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const ALPHONSE_ELRIC_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Armored Straight',duration:.47,contacts:[.168],damage:21,range:2.85,radius:.88,stamina:13,cooldown:.47,stun:.39,knockback:4,lunge:4.2,style:'melee'},
 heavy:{name:'Iron Shoulder',duration:1,contacts:[.6],damage:65,range:3.05,radius:1.03,stamina:30,cooldown:1.21,stun:.90,knockback:9,lunge:5,style:'melee',outcome:'knockdown'},
 special:{name:'Seismic Palm',duration:1.5,contacts:[.85],damage:117,range:26,radius:1.15,stamina:36,cooldown:5.2,stun:.9,knockback:10,speed:25,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Soulbound Bastion',duration:4.4,contacts:[.60,1.78,3.56],schedule:[48,75,224],damage:48,finisherDamage:204,range:3.15,radius:1.15,stamina:0,cooldown:24,stun:1.15,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.2,close:6,style:'melee',guardBreak:true,confirm:{recovery:.64}},
};
export const ALPHONSE_ELRIC_COMBOS:ComboRow={lh:{name:'Steel Backhand',range:3,radius:.97},llh:{name:'Armored Rising Fist',range:3,radius:1},lllh:{name:'Hammering Elbow',range:3.15,radius:1.08},llls:{name:'Foundation Breaker',range:3.2,radius:1.12},airHeavy:{name:'Iron Heel',range:3.05,radius:1.03},airSpecial:{name:'Bulwark Descent',radius:3.7}};
export const ALPHONSE_ELRIC_AWAKENING={name:'SOULBOUND PROMISE',clip:'Soulbound Promise',duration:2,entryDuration:.9,beats:{heart:.20,protect:.40,clap:.63,brace:.84},manualOnly:true,canonScope:'Authored protective resolve and clap-alchemy preparation in the original armor; no new body or autonomous construct.'}as const;
export function alphonseAuthoredKick(clip:string):boolean{return clip==='Iron Heel';}
export function alphonseAuthoredShoulderStep(clip:string,sourceSeconds:number):boolean{return clip==='Iron Shoulder'&&Number.isFinite(sourceSeconds)&&sourceSeconds>=0&&sourceSeconds<=68/60+1e-5;}
export function alphonseAuthoredGround(clip:string,time:number):boolean{return clip==='Seismic Palm'||clip==='Foundation Breaker'||clip==='Bulwark Descent'||clip==='Soulbound Bastion'&&time>=2.45;}
export function alphonseStrikeJoint(clip:string,contactIndex=0):'RightHand'|'LeftHand'|'LeftArm'|'RightForeArm'|'RightToeBase'|'BothHands'{
 if(clip==='Iron Shoulder')return 'LeftArm';
 if(clip==='Rush 2'||clip==='Armored Rising Fist')return 'LeftHand';
 if(clip==='Hammering Elbow')return 'RightForeArm';
 if(clip==='Iron Heel')return 'RightToeBase';
 if(clip==='Seismic Palm'||clip==='Foundation Breaker'||clip==='Bulwark Descent')return 'BothHands';
 if(clip==='Soulbound Bastion')return contactIndex>=2?'BothHands':contactIndex===1?'LeftHand':'RightHand';
 return 'RightHand';
}
