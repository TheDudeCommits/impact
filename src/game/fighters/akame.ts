import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const AKAME_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Murasame Cut',duration:.44,contacts:[.168],damage:21,range:2.85,radius:.65,stamina:10,cooldown:.42,stun:.31,knockback:3.5,lunge:4.0,style:'melee'},
 heavy:{name:'Crimson Reversal',duration:1,contacts:[.56],damage:65,range:3.05,radius:.89,stamina:28,cooldown:1.36,stun:.77,knockback:8.5,lunge:3.8,style:'melee',outcome:'knockdown'},
 special:{name:'Night Raid Pierce',duration:1.1,contacts:[.66],damage:116,range:2.9,radius:.74,stamina:34,cooldown:4.75,stun:.8,knockback:9.5,lunge:10.1,style:'melee',outcome:'launch'},
 ultimate:{name:'Burial of the Empire',duration:3.5,contacts:[.56,1.68,2.87],schedule:[47,58,232],damage:47,finisherDamage:196,range:3.15,radius:1.04,stamina:0,cooldown:24,stun:.9,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.9,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.58}},
};
export const AKAME_COMBOS:ComboRow={lh:{name:'Crossing Murasame',range:2.95,radius:.79},llh:{name:'Rising Night Raid',range:2.9,radius:.78},lllh:{name:'Execution Breaker',range:3.1,radius:.94},llls:{name:'Assassin Pursuit',range:3.0,radius:.82},airHeavy:{name:'Falling Murasame',range:3.0,radius:.85},airSpecial:{name:'Scarlet Descent',radius:3.35}};
export const AKAME_CONTACTS={light:.46,heavy:.56,special:.60,ultimate:[.18,.48,.82],rush:[.46,.56,.60],combos:{lh:.56,llh:.46,lllh:.56,llls:.60,airHeavy:.46,airSpecial:.56}}as const;
export const AKAME_AWAKENING={name:'Little War Horn',clip:'Little War Horn',duration:2.4,entryDuration:.9,swapAt:.513,beats:{present:.18,palm:.351,reveal:.531,guard:.702},manualOnly:true}as const;
export function akameStrikeSide(_action:string,_elapsed=0,_clip?:string,_contactIndex?:number):'Right'{return 'Right';}
