import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
export const ENEL_MOVES: Record<CoreSlot,MoveDefinition>={
 light:{name:'Golden Staff',duration:.47,contacts:[.168],damage:20,range:2.95,radius:.8,stamina:9,cooldown:.47,stun:.30,knockback:3.2,lunge:3.6,style:'melee'},
 heavy:{name:'Thunder Pole',duration:.91,contacts:[.91*.58],damage:65,range:3.25,radius:1.05,stamina:26,cooldown:1.28,stun:.70,knockback:9,lunge:3.8,style:'melee',outcome:'knockdown'},
 special:{name:'El Thor',duration:1.30,contacts:[.75],damage:122,range:24,radius:1.2,stamina:31,cooldown:5.1,stun:.84,knockback:9,style:'beam'},
 ultimate:{name:'Raigo',duration:3.75,contacts:[.55,1.85,3.15],schedule:[40,30,272],damage:40,finisherDamage:210,range:3.3,radius:1.25,stamina:0,cooldown:23,stun:.7,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4,style:'melee',guardBreak:true,confirm:{recovery:.65}},
};
export const ENEL_COMBOS:ComboRow={
 lh:{name:'Staff Backcut',range:2.95,radius:.82},llh:{name:'Ascending Judgment',range:3.05,radius:.95},lllh:{name:'Thunder Downstroke',range:3.25,radius:1.05},llls:{name:'Volt Spear',range:3.2,radius:.9},airHeavy:{name:'Aerial Thunder Pole',range:3.2,radius:1},airSpecial:{name:'Sky Judgment',radius:3.2},
};
export const ENEL_CONTACTS={light:.42,heavy:.58,special:.75/1.30,ultimate:[.55/3.75,1.85/3.75,3.15/3.75],rush:[.58,.30,.42],combos:{lh:.42,llh:.40,lllh:.58,llls:.57,airHeavy:.58,airSpecial:.54}}as const;
export const ENEL_AWAKENING={name:'Mantra Ascendant',clip:'Mantra Ascendant',duration:1.633333,beats:{focus:.30,thunder:.54},manualOnly:true,formSwap:false}as const;
