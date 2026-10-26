import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const ESCANOR_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Rhitta Cleave',duration:.47,contacts:[.168],damage:21,range:3.35,radius:.83,stamina:13,cooldown:.49,stun:.38,knockback:4,lunge:3.8,style:'melee'},
 heavy:{name:'Pride Divider',duration:1,contacts:[.50],damage:65,range:3.5,radius:.94,stamina:30,cooldown:1.32,stun:.90,knockback:9.5,lunge:3.5,style:'melee',outcome:'knockdown'},
 special:{name:'Cruel Sun',duration:1.50,contacts:[.82],damage:113,range:25,radius:1.12,stamina:36,cooldown:5.4,stun:.92,knockback:8,speed:23,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Divine Sword Escanor',duration:4,contacts:[.48,1.36,3.05],schedule:[54,62,232],damage:54,finisherDamage:192,range:3.0,radius:1.15,stamina:0,cooldown:25,stun:1.15,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.4,close:6,style:'melee',guardBreak:true,confirm:{recovery:.60}},
};
export const ESCANOR_COMBOS:ComboRow={lh:{name:'Royal Reversal',range:3.4,radius:.87},llh:{name:'Rising Pride',range:3.3,radius:.90},lllh:{name:'Sunlit Divider',range:3.6,radius:1.0},llls:{name:'Solar Reprisal',range:3.3,radius:1.05},airHeavy:{name:'Aerial Rhitta',range:3.4,radius:.95},airSpecial:{name:'Falling Sun',radius:3.5}};
export const ESCANOR_AWAKENING={name:'HIGH NOON',clip:'High Noon',duration:2.2,entryDuration:.9,beats:{settle:.18,release:.40,stand:.60,finish:.82},manualOnly:true,baseModel:'/assets/fighters/escanor-sk1.glb',model:'/assets/fighters/escanor-high-noon1.glb',height:2.255,canonScope:'Sunshine peak physique, same shirtless costume; geometry/rig expansion and animation authored, not misrepresented as a supplied native The One rig.'}as const;
export function escanorStrikeJoint(action:string,elapsed=0,clip?:string):'RightHand'|'LeftHand'{
 if(clip==='Solar Reprisal'||clip==='Falling Sun'||action==='special'&&!clip||clip==='Cruel Sun'||action==='ultimate'&&elapsed>=.95&&elapsed<1.95)return 'LeftHand';
 return 'RightHand';
}
export function escanorRhittaVisible(action:string,elapsed=0,clip?:string):boolean{
 return action!=='ultimate'&&clip!=='Divine Sword Escanor'&&!(action==='awaken'&&elapsed>=.27);
}

export const ESCANOR_RHITTA_EDGE={
 base:{top:[-0.8500388978774396, 0.16583132893242625, 0.5140099807462228] as const,middle:[-1.2594474436429695, 0.11134906260745692, 0.09161822295851585] as const,bottom:[-1.0174653198805856, 0.104948681341265, 0.008154711150978766] as const},
 form:{top:[-0.9350428001379281, 0.18241449757968153, 0.5654110621294681] as const,middle:[-1.3853920516480702, 0.12248404713387084, 0.10078005689498837] as const,bottom:[-1.119211752879012, 0.11544364566334675, 0.008970211765553904] as const},
}as const;
