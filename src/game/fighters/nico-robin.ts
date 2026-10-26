import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const NICO_ROBIN_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Dos Fleur',duration:.46,contacts:[.168],damage:21,range:2.7,radius:.70,stamina:10,cooldown:.43,stun:.32,knockback:3.4,lunge:2.8,style:'melee'},
 heavy:{name:'Cuatro Fleur Clutch',duration:1,contacts:[.571],damage:65,range:3.0,radius:.91,stamina:29,cooldown:1.39,stun:.82,knockback:7.7,lunge:2.6,style:'melee',outcome:'knockdown'},
 special:{name:'Gigantesco Mano',duration:1.18,contacts:[.6844],damage:116,range:20,radius:1.06,stamina:35,cooldown:4.9,stun:.8,knockback:10,speed:23,style:'projectile'},
 ultimate:{name:'Gran Jacuzzi Clutch',duration:3.75,contacts:[.52,1.6125,3.075],schedule:[35,66,238],damage:35,finisherDamage:220,range:3.15,radius:1.08,stamina:0,cooldown:24,stun:.92,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:3.6,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.60}},
};
export const NICO_ROBIN_COMBOS:ComboRow={lh:{name:'Tres Fleur Twist',range:2.9,radius:.84},llh:{name:'Seis Fleur Rise',range:2.85,radius:.87},lllh:{name:'Ocho Fleur Hold',range:3.05,radius:.98},llls:{name:'Mil Fleur Push',range:3.15,radius:1.0},airHeavy:{name:'Aerial Fleur',range:2.95,radius:.92},airSpecial:{name:'Fleur Descent',radius:3.5}};
export const NICO_ROBIN_AWAKENING={name:'Gigante Fleur',clip:'Gigante Fleur',sourceDuration:2.3,entryDuration:.9,release:.486,manualOnly:true,kind:'aura'}as const;
export function nicoRobinClutch(clip?:string):boolean{return !!clip&&/Clutch|Twist|Hold/.test(clip);}
