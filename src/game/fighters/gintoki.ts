import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
export const GINTOKI_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Lake Toya Cut',duration:.47,contacts:[.168],damage:23,range:2.95,radius:.80,stamina:9,cooldown:.47,stun:.32,knockback:3.2,lunge:3.7,style:'melee'},
 heavy:{name:'Yorozuya Reversal',duration:.93,contacts:[.56],damage:65,range:3.1,radius:.95,stamina:26,cooldown:1.21,stun:.70,knockback:9,lunge:4.0,style:'melee',outcome:'knockdown'},
 special:{name:'Silver Soul Drive',duration:1.24,contacts:[.66],damage:120,range:3.1,radius:.82,stamina:31,cooldown:4.9,stun:.83,knockback:10,lunge:9.5,style:'melee',outcome:'wallBounce'},
 ultimate:{name:'Shiroyasha Rampage',duration:3.5,contacts:[.52,1.22,1.94,2.78],schedule:[35,35,35,266],damage:35,finisherDamage:185,range:3.1,radius:1.05,stamina:0,cooldown:23,stun:.62,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.6,style:'melee',guardBreak:true,confirm:{recovery:.65}},
};
export const GINTOKI_COMBOS:ComboRow={
 lh:{name:'Sash Crosscut',range:2.95,radius:.84},llh:{name:'Rising Bokken',range:3,radius:.9},lllh:{name:'Kabukicho Splitter',range:3.1,radius:1.0},llls:{name:'Silver Drive',range:3.2,radius:.84},airHeavy:{name:'Falling Oak',range:3.0,radius:.95},airSpecial:{name:'Yorozuya Landing',radius:3.1},
};
export const GINTOKI_CONTACTS={light:.24/.54,heavy:.56/.93,special:.66/1.24,ultimate:[.52/3.5,1.22/3.5,1.94/3.5,2.78/3.5],rush:[.24/.54,.52,.56/.93],combos:{lh:.24/.54,llh:.52,lllh:.56/.93,llls:.66/1.24,airHeavy:.56/.93,airSpecial:.56/.93}}as const;
export const GINTOKI_AWAKENING={name:'White Yaksha Resolve',clip:'White Yaksha Resolve',duration:1.8,beats:{shoulder:.23,resolve:.46,draw:.69},manualOnly:true,formSwap:false}as const;
