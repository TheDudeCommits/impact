import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const TOJI_MOVES: Record<CoreSlot, MoveDefinition> = {
 light:{name:'Inverted Edge',duration:.47,contacts:[.168],damage:20,range:2.65,radius:.68,stamina:10,cooldown:.47,stun:.34,knockback:3.3,lunge:5.4,style:'melee'},
 heavy:{name:'Hunter Reversal',duration:1,contacts:[.55],damage:65,range:2.85,radius:.82,stamina:27,cooldown:1.38,stun:.79,knockback:8.4,lunge:5.1,style:'melee',outcome:'stagger'},
 special:{name:'Vanishing Fang',duration:1.20,contacts:[.60],damage:116,range:3.0,radius:.78,stamina:33,cooldown:5.0,stun:.87,knockback:10,lunge:8.8,close:4.8,style:'melee',guardBreak:true,outcome:'wallBounce'},
 ultimate:{name:'Sorcerer Killer',duration:3.27,contacts:[.55,1.048,1.565,2.065,2.565],schedule:[36,43,48,55,212],damage:36,finisherDamage:146,range:2.9,radius:.90,stamina:0,cooldown:25,stun:1.15,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.6,close:5.8,style:'melee',guardBreak:true,confirm:{recovery:.65}},
};
export const TOJI_COMBOS: ComboRow = {
 lh:{name:'Blindside Cut',range:2.8,radius:.78},
 llh:{name:'Assassin Rising Edge',range:2.8,radius:.81},
 lllh:{name:'No Escape',range:2.9,radius:.87},
 llls:{name:'Predator Pursuit',range:3.0,radius:.83},
 airHeavy:{name:'Falling Spear',range:2.85,radius:.85},
 airSpecial:{name:'Silent Descent',radius:3.2},
};
export const TOJI_CONTACTS = {
 light:.27/.60,heavy:.55/1.05,special:.60/1.20,
 ultimate:[.55,1.15,1.85,2.55,3.30].map(t=>t/4),
 rush:[.45,.55/1.05,.5],
 combos:{lh:.55/1.05,llh:.45,lllh:.55/1.05,llls:.5,airHeavy:.55/1.05,airSpecial:.5},
} as const;
export const TOJI_AWAKENING = {
 name:'HEAVENLY RESTRICTION',clip:'Heavenly Restriction',sourceDuration:2.2,entryDuration:.9,
 beats:{release:.18,focus:.40,stance:.65,settle:.83},manualOnly:true,formSwap:false,
 canonScope:'Physical focus and assassin stance on the same native body; Heavenly Restriction is innate, not a conjured domain, cursed-energy form or passive attack.',
} as const;
export const TOJI_CINEMATIC = {
 opener:{clip:'Sorcerer Killer',at:.55/4},
 cine:{from:.55/4,at:3.30/4,windows:[[.55/4,1.50/4,1.15/4],[1.50/4,2.20/4,1.85/4],[2.20/4,2.925/4,2.55/4],[2.925/4,1,3.30/4]]},
} as const;
