import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const ESDEATH_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Noble Impale',duration:.43,contacts:[.152],damage:19,range:2.55,radius:.57,stamina:9,cooldown:.43,stun:.30,knockback:3.1,lunge:3.9,style:'melee'},
 heavy:{name:'Glacial Reversal',duration:.94,contacts:[.4606],damage:62,range:2.75,radius:.78,stamina:24,cooldown:1.40,stun:.76,knockback:7.8,lunge:3.5,style:'melee',outcome:'launch',lift:5.6},
 special:{name:'Ice Lance',duration:1.24,contacts:[.7564],damage:114,range:28,radius:.86,stamina:33,cooldown:4.9,stun:.82,knockback:9.2,speed:30,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Mahapadma',duration:3.90,contacts:[.58,2.89],schedule:[59,254],damage:59,finisherDamage:231,range:2.9,radius:.95,stamina:0,cooldown:25,stun:1.35,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:5.9,style:'melee',guardBreak:true,confirm:{recovery:.52}},
};
export const ESDEATH_COMBOS:ComboRow={
 lh:{name:'Cold Riposte',range:2.6,radius:.64},
 llh:{name:'Imperial Ascent',range:2.7,radius:.77},
 lllh:{name:'Execution Point',range:2.8,radius:.66},
 llls:{name:'Frozen Pursuit',range:2.8,radius:.83},
 airHeavy:{name:'Frost Aerial',range:2.65,radius:.76},
 airSpecial:{name:'Winter Guillotine',radius:3.0},
};
export const ESDEATH_CONTACTS={light:.44,heavy:.46,special:.61,ultimate:[.18,.80],rush:[.44,.44,.49],combos:{lh:.44,llh:.49,lllh:.44,llls:.61,airHeavy:.49,airSpecial:.53}}as const;
export const ESDEATH_AWAKENING={name:"DEMON'S EXTRACT",clip:"Demon's Extract",sourceDuration:2.30,runtimeDuration:.9,beats:{mark:.31,cap:.57,coronation:.76,settle:.91},sameBody:true,manualOnly:true}as const;
export function esdeathStrikeJoint(action:string,clip?:string):'LeftHand'|'RightHand'{if(clip)return clip==='Ice Lance'||clip==='Frozen Pursuit'?'LeftHand':'RightHand';return action==='special'?'LeftHand':'RightHand';}

export const ESDEATH_RAPIER_TIP=[0.018809661860686555,0.9308132923244248,0.02438467202563288]as const;
