import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const JOSUKE_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Diamond Jab',duration:.44,contacts:[.152],damage:21,range:2.8,radius:.82,stamina:9,cooldown:.44,stun:.31,knockback:3.1,lunge:3.5,style:'melee'},
 heavy:{name:'Restoration Hammer',duration:.92,contacts:[.48],damage:65,range:3.1,radius:.95,stamina:26,cooldown:1.24,stun:.75,knockback:9,lunge:3.8,style:'melee',outcome:'knockdown'},
 special:{name:'Dora Barrage',duration:1.5,contacts:[.43,.69,.93],damage:38,range:3.2,radius:1.0,stamina:32,cooldown:5.0,stun:.42,knockback:.5,finisherKnockback:1.5,lunge:4.2,style:'melee'},
 ultimate:{name:'Break and Restore',duration:3.5,contacts:[.52,.94,1.21,1.48,1.75,2.02,2.31,2.76],schedule:[18,18,18,18,18,18,18,535],damage:18,finisherDamage:164,range:3.2,radius:1.15,stamina:0,cooldown:23,stun:.5,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:4.2,style:'melee',guardBreak:true,confirm:{recovery:.65}},
};
export const JOSUKE_COMBOS:ComboRow={lh:{name:'Diamond Hook',range:3.1,radius:.9},llh:{name:'Rising Heart',range:3.0,radius:.9},lllh:{name:'Morioh Breaker',range:3.2,radius:1},llls:{name:'Dora Drive',range:3.2,radius:.9},airHeavy:{name:'Descending Diamond',range:3.1,radius:1},airSpecial:{name:'Restoration Crash',radius:3.1}};
export const JOSUKE_CONTACTS={light:.42,heavy:.48/.92,special:[.43/1.5,.69/1.5,.93/1.5],ultimate:[.52/3.5,.94/3.5,1.21/3.5,1.48/3.5,1.75/3.5,2.02/3.5,2.31/3.5,2.76/3.5],rush:[.42,.52,.48/.92],combos:{lh:.48/.92,llh:.52,lllh:.48/.92,llls:.42,airHeavy:.48/.92,airSpecial:.48/.92}}as const;
export const JOSUKE_AWAKENING={name:'Unbreakable Temper',clip:'Unbreakable Temper',duration:1.8,beats:{hairCheck:.24,glare:.48,challenge:.70,settle:.90},manualOnly:true,formSwap:false}as const;
