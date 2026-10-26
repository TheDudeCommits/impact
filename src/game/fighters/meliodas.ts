import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const MELIODAS_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Dragon Handle',duration:.43,contacts:[.152],damage:22,range:2.55,radius:.8,stamina:9,cooldown:.44,stun:.31,knockback:3.2,lunge:3.9,style:'melee'},
 heavy:{name:'Full Counter Return',duration:.98,contacts:[.57],damage:65,range:2.85,radius:.92,stamina:25,cooldown:1.39,stun:.8,knockback:8.4,lunge:3.2,style:'melee',outcome:'stagger'},
 special:{name:'Enchant Hellblaze',duration:1.2,contacts:[.56],damage:112,range:23,radius:.90,stamina:34,cooldown:5.2,stun:.9,knockback:9.0,speed:25,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Hell Buster',duration:3.5,contacts:[.52,1.18,1.89,2.75],schedule:[40,65,80,171],damage:40,finisherDamage:170,range:2.9,radius:1.1,stamina:0,cooldown:25,stun:.8,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.5,close:5.3,style:'melee',guardBreak:true,confirm:{recovery:.67}},
};
export const MELIODAS_COMBOS:ComboRow={lh:{name:'Dragon Reversal',range:2.8,radius:.9},llh:{name:'Rising Dragon',range:2.8,radius:.9},lllh:{name:'Wrath Cleaver',range:3.0,radius:1.05},llls:{name:'Hellblaze Drive',range:3.0,radius:1.05},airHeavy:{name:'Falling Wrath',range:2.8,radius:.95},airSpecial:{name:'Demon Landing',radius:3.15}};
export const MELIODAS_CONTACTS={light:.44,heavy:.57/.98,special:.56/1.2,ultimate:[.52,1.18,1.89,2.75].map(t=>t/3.5),rush:[.44,.51,.57/.98],combos:{lh:.57/.98,llh:.51,lllh:.6,llls:.56/1.2,airHeavy:.6,airSpecial:.6}}as const;
export const MELIODAS_AWAKENING={name:'Assault Mode',clip:'The Dragon Awakens',duration:1.9,swapAt:.50,beats:{forehead:.18,mark:.40,release:.60,guard:.80},manualOnly:true,formSwap:true}as const;
