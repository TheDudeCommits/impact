import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const KENPACHI_MOVES: Record<CoreSlot,MoveDefinition>={
 light:{name:'Reckless Cleave',duration:.47,contacts:[.168],damage:18,range:3.35,radius:.80,stamina:12,cooldown:.47,stun:.35,knockback:3.7,lunge:3.3,style:'melee'},
 heavy:{name:'Bloodthirst Sweep',duration:1.01,contacts:[.4988],damage:65,range:3.6,radius:.94,stamina:29,cooldown:1.47,stun:.72,knockback:9.2,lunge:4.0,style:'melee',outcome:'launch',lift:5.2},
 special:{name:'Relentless Advance',duration:1.18,contacts:[.6018],damage:121,range:3.4,radius:.91,stamina:34,cooldown:5.0,stun:.80,knockback:10.5,lunge:8.8,close:5.1,style:'melee',outcome:'wallBounce'},
 ultimate:{name:'Kendo: Ryodan',duration:3.6,contacts:[.60,2.79],schedule:[63,249],damage:63,finisherDamage:227,range:3.4,radius:1.02,stamina:0,cooldown:25,stun:1.30,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.5,close:6.0,style:'melee',guardBreak:true,confirm:{recovery:.60}},
};
export const KENPACHI_COMBOS:ComboRow={lh:{name:'Shoulder Reversal',range:3.4,radius:.84},llh:{name:'Captain Rising Cut',range:3.5,radius:.88},lllh:{name:'Jagged Execution',range:3.6,radius:.96},llls:{name:'Reiatsu Drive',range:3.45,radius:.91},airHeavy:{name:'Falling Reaver',range:3.4,radius:.90},airSpecial:{name:'Eleventh Division Crash',radius:3.5}};
export const KENPACHI_AWAKENING={name:'UNSEALED REIATSU',clip:'Unsealed Reiatsu',sourceDuration:2.0,swapAt:.69,beats:{reach:.26,pinch:.34,remove:.57,release:.76},manualOnly:true}as const;
