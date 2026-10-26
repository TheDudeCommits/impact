import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const GAROU_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Water Stream',duration:.47,contacts:[.168],damage:21,range:2.25,radius:.78,stamina:9,cooldown:.47,stun:.35,knockback:3.2,lunge:12.5,style:'melee'},
 heavy:{name:'Rock Smashing Palm',duration:1.01,contacts:[.57],damage:65,range:2.6,radius:.96,stamina:27,cooldown:1.78,stun:.82,knockback:8.3,lunge:3.7,style:'melee',outcome:'stagger',spacing:1.14},
 special:{name:'Whirlwind Slash',duration:1.12,contacts:[.548],damage:105,range:3.1,radius:1.14,stamina:33,cooldown:5.5,stun:.96,knockback:8.8,lunge:7.4,style:'melee',guardBreak:true},
 ultimate:{name:'Monster Calamity Rush',duration:3.78,contacts:[.44,1.04,1.63,2.23,3.02],schedule:[22,41,56,90,186],damage:22,finisherDamage:202,range:2.8,radius:1.04,stamina:0,cooldown:26,stun:.76,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.7,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.7}},
};
export const GAROU_COMBOS:ComboRow={lh:{name:'Flowing Redirection',range:2.55,radius:.96},llh:{name:'Hunter Cross',range:2.6,radius:1.0},lllh:{name:'Whirlwind Break',range:3.0,radius:1.1},llls:{name:'Monster Lunge',range:3.1,radius:1.1},airHeavy:{name:'Descending Palm',range:2.7,radius:1.08},airSpecial:{name:'Cyclone Break',radius:3.1}};
export const GAROU_CONTACTS={light:.25/.56,heavy:.57/1.06,special:.55/1.12,ultimate:[.44,1.04,1.63,2.23,3.02].map(t=>t/3.78),rush:[.25/.56,.57/1.06,.55/1.12],combos:{lh:.57/1.06,llh:.25/.56,lllh:.55/1.12,llls:.55/1.12,airHeavy:.57/1.06,airSpecial:.55/1.12}}as const;
export const GAROU_AWAKENING={name:'Cosmic Fear',clip:'Cosmic Fear',duration:2.4,beats:{gather:.23,resolve:.43,reveal:.61,stance:.79},manualOnly:true,formSwap:true}as const;
