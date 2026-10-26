import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const PIKACHU_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Quick Attack',duration:.48,contacts:[.22],damage:22,range:2.55,radius:.7,stamina:10,cooldown:.48,stun:.31,knockback:3,lunge:6.2,style:'melee'},
 heavy:{name:'Iron Tail',duration:.9,contacts:[.48],damage:64,range:2.9,radius:.92,stamina:26,cooldown:1.2,stun:.8,knockback:8,lunge:4.7,style:'melee',outcome:'knockdown'},
 special:{name:'Thunderbolt',duration:1.25,contacts:[.68],damage:112,range:28,radius:.92,stamina:34,cooldown:4.8,stun:.82,knockback:9,speed:31,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Volt Tackle',duration:3.88,contacts:[.48,1.42,3.08],schedule:[46,79,222],damage:46,finisherDamage:208,range:2.95,radius:1.04,stamina:0,cooldown:24,stun:1.08,finisherStun:1.32,knockback:0,finisherKnockback:13,lunge:6.3,close:6,style:'melee',guardBreak:true,confirm:{recovery:.53}},
};
export const PIKACHU_COMBOS:ComboRow={lh:{name:'Tail Feint',range:2.8,radius:.85},llh:{name:'Rising Spark',range:2.65,radius:.84},lllh:{name:'Iron Tail Breaker',range:2.95,radius:.98},llls:{name:'Volt Burst',range:2.85,radius:1},airHeavy:{name:'Falling Iron Tail',range:2.9,radius:.94},airSpecial:{name:'Thunder Dive',radius:3.4}};
export const PIKACHU_AWAKENING={name:'THUNDER CHARGE',clip:'Thunder Charge',duration:1.8,entryDuration:.9,beats:{crouch:.18,cheeks:.4,rod:.63,brace:.84},manualOnly:true,canonScope:'Authored electric charge in the original Pikachu body, not an invented evolution or passive electrical damage.'}as const;
export const PIKACHU_NONHUMAN=true;
export const PIKACHU_CHEEK_SOCKET={left:[.0589478266,-.1389853273,.1267130518],right:[.0589437803,.1389807624,.1267153701]}as const;
export const PIKACHU_FRONT_SOCKET=[-.0189423155485966,-.0000011333612989772313,.18388342433451477]as const;
export function pikachuStrikeJoint(clip:string,contactIndex=0):'Head'|'LeftHand'|'RightHand'|'PikachuTailTip'{
 if(clip==='Volt Tackle')return contactIndex===1?'PikachuTailTip':'Head';
 if(clip==='Iron Tail'||clip==='Tail Feint'||clip==='Iron Tail Breaker'||clip==='Falling Iron Tail')return 'PikachuTailTip';
 if(clip==='Rush 2')return 'LeftHand';
 if(clip==='Rush 3'||clip==='Rising Spark')return 'RightHand';
 return 'Head';
}
export function pikachuAuthoredGround(clip:string):boolean{return clip!=='jump'&&clip!=='Jump Fall'&&clip!=='Jump spin'&&clip!=='Falling Iron Tail'&&clip!=='Thunder Dive';}
export function pikachuExpression(clip:string,sourceTime:number):{eyes:'normal'|'focused'|'closed';mouth:'smile'|'open';cheeks:'red'|'charged'}{
 if(clip==='Thunder Charge')return sourceTime<.94?{eyes:'closed',mouth:'smile',cheeks:sourceTime>.35?'charged':'red'}:{eyes:'focused',mouth:'open',cheeks:'charged'};
 const electric=clip==='Thunderbolt'||clip==='Volt Burst'||clip==='Thunder Dive'||clip==='Volt Tackle';
 const attack=electric||clip==='Quick Attack'||clip.includes('Tail')||clip.startsWith('Rush ')||clip==='Rising Spark';
 if(attack)return {eyes:'focused',mouth:electric?'open':'smile',cheeks:electric?'charged':'red'};
 if(clip==='stun'||clip==='Die fall'||clip==='down_end')return {eyes:'closed',mouth:'open',cheeks:'red'};
 return {eyes:'normal',mouth:'smile',cheeks:'red'};
}
