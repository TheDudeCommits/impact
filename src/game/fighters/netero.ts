import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const NETERO_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Gratitude Palm',duration:.44,contacts:[.168],damage:19,range:2.15,radius:.66,stamina:10,cooldown:.41,stun:.30,knockback:3.2,lunge:5.4,style:'melee'},
 heavy:{name:'Heart Elbow',duration:58/60,contacts:[58/60*.58],damage:65,range:2.2,radius:.76,stamina:27,cooldown:1.32,stun:.73,knockback:8.2,lunge:5.8,style:'melee',outcome:'knockdown'},
 special:{name:'First Hand',duration:74/60,contacts:[74/60*.52],damage:110,range:18,radius:.9,stamina:33,cooldown:4.8,stun:.83,knockback:9,speed:23,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Hyakushiki: 99th Hand',duration:4.1,contacts:[.533,1.394,1.886,2.46,3.444],schedule:[26,40,47,70,216],damage:26,finisherDamage:186,range:2.2,radius:.8,stamina:0,cooldown:24,stun:.8,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:6.0,close:4.2,style:'melee',guardBreak:true,confirm:{recovery:.52}},
};
export const NETERO_COMBOS:ComboRow={lh:{name:'Prayer Reversal',range:2.2,radius:.73},llh:{name:'Rising Palm',range:2.2,radius:.75},lllh:{name:'Temple Breaker',range:2.25,radius:.83},llls:{name:'Grateful Reprisal',range:2.25,radius:.9},airHeavy:{name:'Aerial Palm',range:2.2,radius:.8},airSpecial:{name:'Descending Prayer',radius:3.15}};
export const NETERO_CLIPS={light:'Gratitude Palm',heavy:'Heart Elbow',special:'First Hand',ultimate:'Ninety-Ninth Hand',awaken:'Prayer Beyond Sound',idle:'_Idle',walk:'Walk',run:'Run',guard:'Block',victory:'Gratitude'}as const;
export const NETERO_CONTACTS={light:.54,heavy:.58,special:.52,ultimate:[.13,.34,.46,.60,.84],rush:[.54,.54,.58],combos:{lh:.54,llh:.54,lllh:.58,llls:.52,airHeavy:.54,airSpecial:.52}}as const;
export const NETERO_AWAKENING={name:'Prayer Beyond Sound',clip:'Prayer Beyond Sound',duration:2.4,entryDuration:.9,beats:{prayer:.198,quiet:.423,manifest:.585,unfurl:.765},manualOnly:true,form:'aura',canonScope:'Planted gratitude prayer; golden Bodhisattva fan is visible only during entry and owner-commanded attacks. No idle attacks or passive damage.'}as const;
export function neteroStrikeJoint(action:string,clip?:string){
 if(['Heart Elbow','Rush 3','Temple Breaker'].includes(clip??'')||!clip&&action==='heavy')return 'RightForeArm';
 return ['Rush 2','Prayer Reversal','Aerial Palm'].includes(clip??'')?'LeftHand':'RightHand';
}
