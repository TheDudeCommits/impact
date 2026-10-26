import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const USOPP_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: {name:'Kabuto Shot',duration:.47,contacts:[.168],damage:17,range:12,radius:.35,stamina:10,cooldown:.47,stun:.28,knockback:2.8,speed:34,style:'projectile',aimOnRelease:true},
  heavy: {name:'Impact Wolf',duration:1.01,contacts:[.56],damage:64,range:18,radius:.7,stamina:27,cooldown:1.4,stun:.7,knockback:8,speed:28,style:'projectile',outcome:'wallBounce',aimOnRelease:true},
  special: {name:'Firebird Star',duration:1.30,contacts:[.66],damage:118,range:28,radius:.9,stamina:34,cooldown:5.1,stun:.8,knockback:8.5,speed:26,style:'projectile',aimOnRelease:true},
  ultimate: {name:'Green Star Barrage',duration:3.72,contacts:[.54,1.54,3.12],schedule:[40,65,233],damage:40,finisherDamage:210,range:22,radius:1,stamina:0,cooldown:24,stun:1.2,finisherStun:2.3,knockback:0,finisherKnockback:16,style:'beam',guardBreak:true,confirm:{recovery:.54}},
};
export const USOPP_COMBOS: ComboRow = {
 lh:{name:'Bamboo Javelin',style:'projectile',speed:30,range:14,radius:.5,aimOnRelease:true,lunge:0},
 llh:{name:'Trampolia Star',style:'projectile',speed:27,range:12,radius:.65,aimOnRelease:true,lunge:0},
 lllh:{name:'Skull Bombgrass',style:'projectile',speed:27,range:15,radius:.7,aimOnRelease:true,lunge:0},
 llls:{name:'Sleepgrass Star',style:'projectile',speed:25,range:16,radius:.65,aimOnRelease:true,lunge:0},
 airHeavy:{name:'Aerial Kabuto',style:'projectile',speed:28,range:15,radius:.65,aimOnRelease:true,lunge:0},
 airSpecial:{name:'Green Star Landing',radius:3.4,lunge:0},
};
export const USOPP_CONTACTS = {
 light:.24/.58,heavy:.56/1.08,special:.66/1.30,
 ultimate:[.54/3.72,1.54/3.72,3.12/3.72],
 rush:[.26/.60,.32/.70,.30/.68],
 combos:{lh:.31/.72,llh:.37/.82,lllh:.49,llls:.57/1.12,airHeavy:.5,airSpecial:.5},
} as const;
export const USOPP_AWAKENING = {name:'OBSERVATION HAKI',kind:'aura',aura:[0xe6ffd0,0x89bf42],auraGlow:.12,clips:['Observation Haki'],swapAt:.47,manualOnly:true} as const;
export const USOPP_CINEMATIC = {
 opener:{clip:'Green Star Barrage',at:.54/3.72},
 cine:{from:.54/3.72,at:3.12/3.72,windows:[[.54/3.72,2.34/3.72,1.54/3.72],[2.34/3.72,1,3.12/3.72]]},
} as const;
