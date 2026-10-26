import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const KANEKI_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Ghoul Knuckle',duration:.47,contacts:[.168],damage:20,range:2.25,radius:.77,stamina:10,cooldown:.47,stun:.35,knockback:3.4,lunge:11.5,style:'melee'},
 heavy:{name:'Rinkaku Reap',duration:1.01,contacts:[.59],damage:65,range:3.6,radius:1.12,stamina:28,cooldown:1.87,stun:.85,knockback:7.8,lunge:2.6,style:'melee',outcome:'stagger'},
 special:{name:'Fourfold Pierce',duration:1.24,contacts:[.62],damage:108,range:3.9,radius:1.18,stamina:34,cooldown:5.6,stun:1.02,knockback:8.4,lunge:5.2,style:'melee',guardBreak:true},
 ultimate:{name:'One-Eyed Requiem',duration:3.75,contacts:[.50,1.20,1.95,3.02],schedule:[24,57,84,199],damage:24,finisherDamage:218,range:2.8,radius:1.03,stamina:0,cooldown:26,stun:.8,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.4,close:5.1,style:'melee',guardBreak:true,confirm:{recovery:.7}},
};
export const KANEKI_COMBOS:ComboRow={lh:{name:'Rinkaku Hook',range:3.5,radius:1.0},llh:{name:'Predator Cross',range:3.5,radius:1.05},lllh:{name:'Fourfold Rend',range:3.8,radius:1.12},llls:{name:'Predator Lunge',range:3.8,radius:1.10},airHeavy:{name:'Rinkaku Descent',range:3.4,radius:1.1},airSpecial:{name:'Crimson Break',radius:3.3}};
export const KANEKI_CONTACTS={light:.28/.60,heavy:.59/1.08,special:.62/1.24,ultimate:[.50,1.20,1.95,3.02].map(t=>t/3.75),rush:[.28/.60,.59/1.08,.62/1.24],combos:{lh:.59/1.08,llh:.59/1.08,lllh:.62/1.24,llls:.62/1.24,airHeavy:.59/1.08,airSpecial:.62/1.24}}as const;
export const KANEKI_AWAKENING={name:'Kakugan Unbound',clip:'Kakugan Unbound',duration:2.3,beats:{handRise:.21,fingerCrack:.36,eyeReveal:.47,rinkakuFlare:.70},manualOnly:true,formSwap:true}as const;
