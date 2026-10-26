import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const JOLYNE_MOVES: Record<CoreSlot, MoveDefinition> = {
 light: {name:'String Knuckle',duration:.47,contacts:[.168],damage:20,range:2.85,radius:.82,stamina:9,cooldown:.42,stun:.32,knockback:3.2,lunge:3.8,style:'melee'},
 heavy: {name:'Thread Reel',duration:1.01,contacts:[.58],damage:65,range:3.35,radius:.92,stamina:25,cooldown:1.26,stun:.74,knockback:-4.5,lunge:3.6,style:'melee'},
 special: {name:'ORA Rush',duration:1.48,contacts:[.44,.72,1.01],damage:39,range:3.15,radius:.98,stamina:32,cooldown:5.2,stun:.42,knockback:.7,finisherKnockback:1.5,lunge:4.0,style:'melee'},
 ultimate: {name:'Stone Ocean',duration:4,contacts:[.5,.95,1.28,1.61,1.94,2.27,2.63,3.18],schedule:[20,24,28,35,43,56,70,292],damage:20,finisherDamage:150,range:3.2,radius:1.1,stamina:0,cooldown:24,stun:.51,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.1,style:'melee',guardBreak:true,confirm:{recovery:.68}},
};
export const JOLYNE_COMBOS: ComboRow = {
 lh:{name:'String Uppercut',range:3.05,radius:.9},
 llh:{name:'Cross Stitch',range:3.1,radius:.93},
 lllh:{name:'Prison Break',range:3.2,radius:1},
 llls:{name:'Thread Chase',range:3.25,radius:.94},
 airHeavy:{name:'Descending Stone',range:3.1,radius:.96},
 airSpecial:{name:'Ocean Crash',radius:3.1},
};
export const JOLYNE_CONTACTS={light:.27/.58,heavy:.58/1.08,special:[.44/1.48,.72/1.48,1.01/1.48],ultimate:[.5/4,.95/4,1.28/4,1.61/4,1.94/4,2.27/4,2.63/4,3.18/4],rush:[.27/.58,.52,.58/1.08],combos:{lh:.52,llh:.58/1.08,lllh:.58/1.08,llls:.27/.58,airHeavy:.58/1.08,airSpecial:.58/1.08}} as const;
export const JOLYNE_AWAKENING={name:'Unbound Resolve',clip:'Unbound Resolve',sourceDuration:2.3,runtimeDuration:.9,beats:{unravel:.23,wind:.44,resolve:.64,guard:.82},manualOnly:true,formSwap:false} as const;
