import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const HIEI_MOVES: Record<CoreSlot, MoveDefinition> = {
 light:{name:'Shadow Draw',duration:.42,contacts:[.152],damage:21,range:2.65,radius:.66,stamina:9,cooldown:.42,stun:.29,knockback:2.7,lunge:4.3,style:'melee'},
 heavy:{name:'Sword of the Darkness Flame',duration:.94,contacts:[.5452],damage:65,range:2.9,radius:.78,stamina:25,cooldown:1.36,stun:.68,knockback:8.5,lunge:4.7,style:'melee',outcome:'launch',lift:5.1},
 special:{name:'Afterimage Sever',duration:1.08,contacts:[.6372],damage:113,range:2.85,radius:.74,stamina:31,cooldown:4.7,stun:.74,knockback:9,lunge:10.7,close:5.4,style:'melee',outcome:'wallBounce'},
 ultimate:{name:'Dragon of the Darkness Flame',duration:3.4,contacts:[.476,1.734,2.686],schedule:[43,57,238],damage:43,finisherDamage:204,range:2.9,radius:.92,stamina:0,cooldown:24,stun:1.18,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:6.3,close:6.0,style:'melee',guardBreak:true,confirm:{recovery:.52}},
};
export const HIEI_COMBOS: ComboRow={
 lh:{name:'Reverse Shadow',range:2.7,radius:.72},llh:{name:'Rising Darkness',range:2.8,radius:.76},lllh:{name:'Demon Crosscut',range:2.9,radius:.80},llls:{name:'Vanishing Edge',range:2.85,radius:.75},airHeavy:{name:'Falling Shadow',range:2.9,radius:.78},airSpecial:{name:'Darkness Landing',radius:3.1},
};
export const HIEI_AWAKENING={name:'JAGAN: DRAGON ABSORPTION',clip:'Dragon Absorption',sourceDuration:1.9,swapAt:.549,beats:{seal:.22,unbinding:.44,absorption:.61,settle:.83},manualOnly:true} as const;
