import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const TATSUMAKI_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Psychic Flick',duration:.44,contacts:[.168],damage:20,range:2.85,radius:.83,stamina:11,cooldown:.44,stun:.34,knockback:3.4,lunge:4.3,style:'melee'},
 heavy:{name:'Gravity Crush',duration:.98,contacts:[.54],damage:65,range:2.95,radius:1.05,stamina:28,cooldown:1.2,stun:.82,knockback:8.2,lunge:4.4,style:'melee',outcome:'knockdown'},
 special:{name:'Debris Cannon',duration:1.28,contacts:[.61],damage:115,range:28,radius:1.08,stamina:35,cooldown:4.9,stun:.82,knockback:8.8,speed:28,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Terrible Tornado',duration:3.92,contacts:[.5,1.55,3.14],schedule:[39,74,237],damage:39,finisherDamage:222,range:3.05,radius:1.12,stamina:0,cooldown:24,stun:1.1,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.5,close:6,style:'melee',guardBreak:true,confirm:{recovery:.56}},
};
export const TATSUMAKI_COMBOS:ComboRow={
 lh:{name:'Vector Reversal',range:2.9,radius:.9},
 llh:{name:'Psychic Uplift',range:2.9,radius:.92},
 lllh:{name:'Pressure Collapse',range:3.1,radius:1.03},
 llls:{name:'Spiral Compression',range:3.15,radius:1.05},
 airHeavy:{name:'Aerial Repulse',range:2.95,radius:.96},
 airSpecial:{name:'Meteor Descent',radius:3.5},
};
export const TATSUMAKI_AWAKENING={name:'UNRESTRAINED ESPER',clip:'Unrestrained Esper',duration:1.8,entryDuration:.9,beats:{gather:.28,levitate:.5,release:.76},manualOnly:true,canonScope:'Gameplay concentration of her established psychic power; no invented canonical transformation.'}as const;
