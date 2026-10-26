import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
export const JINBE_MOVES: Record<CoreSlot, MoveDefinition> = {
 light:{name:'Karate Palm',duration:.44,contacts:[.168],damage:21,range:2.6,radius:.74,stamina:11,cooldown:.44,stun:.32,knockback:3.5,lunge:4.2,style:'melee'},
 heavy:{name:'Five Thousand Brick Fist',duration:.93,contacts:[.41],damage:65,range:3.0,radius:.94,stamina:28,cooldown:1.21,stun:.75,knockback:8.8,lunge:4.8,style:'melee',outcome:'wallBounce'},
 special:{name:'Water Shot',duration:1.35,contacts:[.64],damage:116,range:25,radius:1.05,stamina:33,cooldown:4.55,stun:.8,knockback:8.4,speed:28,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Vagabond Drill',duration:3.9,contacts:[.42,1.99,3.215],schedule:[44,64,241],damage:44,finisherDamage:212,range:3.1,radius:1.16,stamina:0,cooldown:24,stun:1.25,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:6,style:'melee',guardBreak:true,confirm:{recovery:.57}},
};
export const JINBE_COMBOS:ComboRow={lh:{name:'Tide Uppercut',range:2.7,radius:.85},llh:{name:'Sharkskin Rise',range:2.7,radius:.85},lllh:{name:'Ocean Hammer',range:2.9,radius:.96},llls:{name:'Water Pulse',range:3.1,radius:1},airHeavy:{name:'Aerial Brick Fist',range:2.9,radius:.95},airSpecial:{name:'Ocean Landing',radius:3.6}};
export const JINBE_AWAKENING={name:'HEART OF THE SEA',clip:'Heart of the Sea',duration:44/30,entryDuration:.9,beats:{crossedGuard:.225,release:.46,settle:.72},manualOnly:true,canonScope:'Gameplay Fish-Man Karate focus state, not an invented canonical transformation.'}as const;
export type JinbeHandVariant='Closed'|'Open';
export type JinbeStrikeSide='Left'|'Right'|'Both';
export function jinbeStrikeSide(action:string,elapsed=0,clip?:string):JinbeStrikeSide{
 if(clip==='Ocean Landing'||action==='ultimate'&&elapsed>=.8&&elapsed<2.6)return 'Both';
 if(clip==='Rush 2'||clip==='Tide Uppercut'||clip==='Sharkskin Rise')return 'Right';
 return 'Left';
}
const CLOSED=Object.freeze(['Closed','Closed'] as const),LEFT_OPEN=Object.freeze(['Open','Closed'] as const),BOTH_OPEN=Object.freeze(['Open','Open'] as const);
export function jinbeHandVariants(action:string,elapsed:number,clip?:string):readonly[JinbeHandVariant,JinbeHandVariant]{
 if(action==='awaken')return elapsed>=.18&&elapsed<.67?BOTH_OPEN:CLOSED;
 if(action==='light')return jinbeStrikeSide(action,elapsed,clip)==='Left'&&clip!=='Rush 3'&&clip!=='Ocean Hammer'?LEFT_OPEN:CLOSED;
 if(action==='special'||clip==='Water Pulse')return elapsed>=.15?LEFT_OPEN:CLOSED;
 if(action==='ultimate')return elapsed>=2.6?LEFT_OPEN:CLOSED;
 return CLOSED;
}
