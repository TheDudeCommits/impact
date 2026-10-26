import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const RENGOKU_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'First Form: Unknowing Fire',duration:.47,contacts:[.168],damage:19,range:2.65,radius:.62,stamina:9,cooldown:.47,stun:.32,knockback:3.2,lunge:4.2,style:'melee'},
 heavy:{name:'Second Form: Rising Scorching Sun',duration:1,contacts:[.58],damage:65,range:2.85,radius:.79,stamina:24,cooldown:1.43,stun:.78,knockback:7.8,lunge:3.6,style:'melee',outcome:'launch',lift:5.6},
 special:{name:'Fourth Form: Blooming Flame Arc',duration:1.38,contacts:[.66],damage:111,range:26,radius:.88,stamina:33,cooldown:4.8,stun:.80,knockback:9,speed:29,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Ninth Form: Rengoku',duration:4.20,contacts:[.55,1.48,2.48,3.50],schedule:[41,57,73,188],damage:41,finisherDamage:167,range:2.95,radius:.90,stamina:0,cooldown:25,stun:1.35,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:5.9,style:'melee',guardBreak:true,confirm:{recovery:.60}},
};
export const RENGOKU_COMBOS:ComboRow={
 lh:{name:'Flame Reversal',range:2.7,radius:.67},
 llh:{name:'Rising Ember',range:2.8,radius:.79},
 lllh:{name:'Blazing Divider',range:2.85,radius:.73},
 llls:{name:'Flame Pursuit',range:2.9,radius:.86},
 airHeavy:{name:'Aerial Flame Cut',range:2.75,radius:.77},
 airSpecial:{name:'Falling Flame',radius:3},
};
export const RENGOKU_CONTACTS={light:18/37,heavy:35/66,special:40/83,ultimate:[33/252,89/252,149/252,210/252],area:43/85,rush:[17/35,20/42,28/55],combos:{lh:23/49,llh:28/56,lllh:34/67,llls:36/71,airHeavy:26/53,airSpecial:31/62}}as const;
export const RENGOKU_AWAKENING={name:'SET YOUR HEART ABLAZE',clip:'Set Your Heart Ablaze',sourceDuration:1.80,runtimeDuration:.90,crest:73/108,sameBody:true,manualOnly:true}as const;
export const RENGOKU_BLADE={base:'RengokuBladeBase',tip:'RengokuBladeTip'}as const;
