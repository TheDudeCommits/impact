import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const EREN_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Steel Slash',duration:.42,contacts:[.15],damage:16,range:2.6,radius:.55,stamina:8,cooldown:.4,stun:.23,knockback:3,lunge:5,style:'melee',reach:.978},
 heavy:{name:'Thunder Spear',duration:.95,contacts:[.42],damage:54,range:20,radius:1.1,stamina:24,cooldown:1.25,stun:.7,knockback:5,speed:38,style:'projectile',outcome:'hop'},
 special:{name:'ODM Lunge',duration:1.3,contacts:[.62],damage:106,range:3,radius:.8,stamina:30,cooldown:4.5,stun:1,knockback:6,lunge:9,guardBreak:true,style:'melee',chargeIn:2.8,dashThrough:true,outcome:'spin',reach:1.263},
 ultimate:{name:'Wings of Freedom',duration:2.2,contacts:[.42,.7,.82,.94,1.06,1.18,1.5],schedule:[41,14,14,14,14,14,363],damage:41,finisherDamage:85,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:15,close:7,guardBreak:true,style:'melee',confirm:{recovery:.5},reach:1.085},
};
export const EREN_RUSH={names:['Turning Cut','Cadet Kick','Skyward Cut'],damage:[16,17,38],tempo:1,shape:'launch'}as const;
export const EREN_TITAN_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Titan Fist',duration:.44,contacts:[.168],damage:20,range:2.65,radius:.71,stamina:10,cooldown:.44,stun:.32,knockback:3,lunge:7,style:'melee'},
 heavy:{name:'Titan Uppercut',duration:58/60,contacts:[58/60*.54],damage:65,range:2.8,radius:.84,stamina:26,cooldown:1.35,stun:.76,knockback:7.8,lunge:5.2,style:'melee',outcome:'launch',lift:4.7},
 special:{name:'Hardened Fist',duration:1.25,contacts:[.725],damage:110,range:2.85,radius:.93,stamina:34,cooldown:4.8,stun:.83,knockback:9.6,lunge:8.5,close:5.6,style:'melee',outcome:'wallBounce'},
 ultimate:{name:'Titan Rampage',duration:4.2,contacts:[.56,1.38,2.32,3.46],schedule:[34,52,78,212],damage:34,finisherDamage:198,range:2.85,radius:1.02,stamina:0,cooldown:24,stun:1.14,finisherStun:1.4,knockback:0,finisherKnockback:14,lunge:6.3,close:6,style:'melee',guardBreak:true,confirm:{recovery:.6}},
};
export const EREN_TITAN_RUSH={names:['Left Hook','Right Cross','Titan Haymaker'],damage:[24,34,48],tempo:1,shape:'carry'}as const;
export const EREN_TITAN_AREA={element:'earth',name:'The Rumbling',damage:224,radius:4.4,outcome:'knockdown',knockback:10,area:{telegraph:.85,look:'burst',anim:{clip:'Freedom Hammer'},voice:'vo-eren-rumbling',ja:'地鳴らし'}}as const;
export const EREN_TITAN_AREA_LOOK='tectonic';
export const EREN_TITAN_AREA_FX={effect:EREN_TITAN_AREA_LOOK,settings:{colorMagma:'#4a3a2c',colorEmber:'#d8b48a',colorHot:'#fff1dc'}}as const;
const T=.44/.46,titan=(name:string,duration:number,contact:number,damage:number,own:Partial<MoveDefinition>)=>({name,duration:+(duration*T).toFixed(3),contacts:[+(contact*T).toFixed(3)],damage,...own});
export const EREN_COMBOS:ComboRow={
 lh:{name:'Crossing Steel',damage:41},llh:{name:'Launching Cut',damage:36},lllh:{name:'Low Sweep',damage:58},llls:{name:'Blinding Cut',damage:49},airHeavy:{name:'Falling Steel',damage:43},airSpecial:{name:'Gas Burst',damage:63,radius:3.4},
 awakened:{lh:titan('Crushing Hook',.7,.28,46,{range:2.7,radius:.77}),llh:titan('Titan Launcher',.72,.27,40,{range:2.75,radius:.83}),lllh:titan('Hammer Fist',.86,.36,64,{range:2.85,radius:.91}),llls:titan('Staggering Blow',.9,.36,54,{range:2.9,radius:.96}),airHeavy:titan('Falling Fist',.62,.24,48,{range:2.8,radius:.91}),airSpecial:titan('Titan Stomp',.8,.22,70,{radius:3.35})},
};
export const EREN_AWAKENING={name:'ATTACK TITAN',clip:'Freedom Awakens',duration:2.4,entryDuration:.9,beats:{handBite:.34,release:.66,settle:.91},formRevealFraction:.66,formClip:'Attack Titan Emergence',manualOnly:true,canonScope:'The Scout bites his hand and an arena-scaled 3.4 m Attack Titan body stands in his place. Only a manual awakening transforms; the Scout throws his own ultimate. No autonomous Titan attacks or passive steam damage.'}as const;

const LEFT_BLADE:ReadonlySet<string>=new Set(['Thunder Spear','Rush 2']);
const WINGS=[.181,.406,.507,.608,.709,.81,.915]as const,WINGS_LEFT:ReadonlySet<number>=new Set([1,2,3]);
export function erenBlade(clip:string,contactIndex?:number,sourceFraction=0):'LeftBlade'|'RightBlade'{
 if(clip==='Wings of Freedom'){let i=contactIndex;if(i===undefined){i=0;for(let k=1;k<WINGS.length;k++)if(sourceFraction>=(WINGS[k-1]+WINGS[k])/2)i=k;}return WINGS_LEFT.has(i)?'LeftBlade':'RightBlade';}
 return LEFT_BLADE.has(clip)?'LeftBlade':'RightBlade';
}
export function erenTitanFist(clip:string,contactIndex?:number,sourceFraction=0):'LeftHand'|'RightHand'{
 if(clip==='Advancing Rage'){const i=contactIndex??(sourceFraction<.23095238?0:sourceFraction<.44047619?1:sourceFraction<.68809524?2:3);return i===1?'LeftHand':'RightHand';}
 return clip==='Rising Rebellion'||clip==='Rush 1'||clip==='Rush 3'||clip==='Defiant Hook'||clip==='Rebel Uppercut'?'LeftHand':'RightHand';
}
export const EREN_SWORD_SOCKETS={"LeftBlade":{"bone":"LeftBlade","tip":[33.65466,3.18469,87.54656],"heel":[8.7906,1.23818,17.50709],"grip":[0,0,0]},"RightBlade":{"bone":"RightBlade","tip":[-47.60257,0.95873,80.87184],"heel":[-8.50958,1.39698,17.63353],"grip":[0,0,0]}} as const;
export const EREN_TITAN_KNUCKLES={"RightHand":[0.2155471577541368,0.0018955800906720888,-0.031404760125644415],"LeftHand":[0.20236690727864254,-0.023208751399481645,0.0354517831779454]} as const;
