import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const NANAMI_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Wrapped Cleaver',duration:.44,contacts:[.168],damage:20,range:2.55,radius:.62,stamina:10,cooldown:.46,stun:.31,knockback:3.1,lunge:4.3,style:'melee'},
 heavy:{name:'Ratio Strike',duration:.9,contacts:[.504],damage:65,range:2.9,radius:.76,stamina:27,cooldown:1.17,stun:.78,knockback:8.6,lunge:4.7,style:'melee',outcome:'wallBounce'},
 special:{name:'Collapse',duration:71/60,contacts:[71/60*.59],damage:112,range:3.3,radius:1.05,stamina:33,cooldown:4.5,stun:.85,knockback:9.2,lunge:4.2,style:'melee',guardBreak:true,outcome:'groundBounce'},
 ultimate:{name:'Overtime Critical Point',duration:3.8,contacts:[.45,1.2,2.05,3.1],schedule:[37,45,55,242],damage:37,finisherDamage:189,range:2.9,radius:.95,stamina:0,cooldown:24,stun:1.1,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:6,style:'melee',guardBreak:true,confirm:{recovery:.6}},
};
export const NANAMI_COMBOS:ComboRow={lh:{name:'Cross Ratio',range:2.6,radius:.7},llh:{name:'Seven Three Rise',range:2.65,radius:.76},lllh:{name:'Critical Cleave',range:2.9,radius:.82},llls:{name:'Structural Collapse',range:3.15,radius:1},airHeavy:{name:'Aerial Ratio',range:2.85,radius:.86},airSpecial:{name:'Overtime Descent',radius:3.2}};
export const NANAMI_AWAKENING={name:'OVERTIME',clip:'Overtime Release',duration:1.7,entryDuration:.9,beats:{tie:.18,release:.378,settle:.603},manualOnly:true,canonScope:'Overtime binding-vow release and deliberate tie gesture; same canonical body, no invented transformation.'}as const;
