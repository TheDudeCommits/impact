import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const AOKIJI_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Ice Saber',duration:.46,contacts:[.168],damage:20,range:2.85,radius:.78,stamina:11,cooldown:.46,stun:.34,knockback:3.4,lunge:4.4,style:'melee'},
 heavy:{name:'Frozen Heel',duration:.89,contacts:[.37],damage:65,range:2.8,radius:.86,stamina:27,cooldown:1.24,stun:.8,knockback:8.4,lunge:4.6,style:'melee',outcome:'launch'},
 special:{name:'Pheasant Beak',duration:1.45,contacts:[.7],damage:110,range:27,radius:1.08,stamina:34,cooldown:4.9,stun:.85,knockback:8.0,speed:27,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Ice Age',duration:3.9,contacts:[.46,1.4,3.0],schedule:[50,60,238],damage:50,finisherDamage:200,range:3.1,radius:1.1,stamina:0,cooldown:24,stun:1.2,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.8,close:6,style:'melee',guardBreak:true,confirm:{recovery:.57}},
};
export const AOKIJI_COMBOS:ComboRow={lh:{name:'Ice Partisan',range:2.9,radius:.86},llh:{name:'Polar Rise',range:2.8,radius:.84},lllh:{name:'Glacial Cleave',range:3.05,radius:.91},llls:{name:'Pheasant Followup',range:3.15,radius:1.0},airHeavy:{name:'Aerial Saber',range:2.95,radius:.9},airSpecial:{name:'Glacial Descent',radius:3.5}};
export const AOKIJI_CONTACTS={light:19/32,heavy:12/36,special:44/80,ultimate:(.8*19/32)/3.9,rush1:19/32,rush2:12/36,rush3:8/32,combos:{lh:22/43,llh:12/36,lllh:8/32,llls:44/80,airHeavy:8/32,airSpecial:18/41}}as const;
export const AOKIJI_CLIPS={light:'Ice Saber',heavy:'Frozen Heel',special:'Pheasant Beak',ultimate:'Ice Age',awaken:'Cold Justice',idle:'_Idle',walk:'Walk',run:'Run',guard:'Block',victory:'Aokiji Victory'}as const;
export const AOKIJI_AWAKENING={name:'COLD JUSTICE',clip:'Cold Justice',duration:1.95,entryDuration:.9,beats:{mask:.31,release:.58,settle:.8},manualOnly:true,canonScope:'Gameplay concentration using own sleep-mask and saber acting; no invented canonical fruit awakening.'}as const;
export const AOKIJI_CINEMATIC={opener:{clip:'Ice Age',at:(.8*19/32)/3.9},cine:{from:(.8*19/32)/3.9,at:(2.3+1.6*18/41)/3.9,windows:[[(.8*19/32)/3.9,2.3/3.9,(1+.95*12/36)/3.9],[2.3/3.9,1,(2.3+1.6*18/41)/3.9]]}}as const;
export type AokijiArmVariant='Open'|'Closed';
const SABER=Object.freeze({left:'Open',right:'Closed',saber:true}as const),KICK=Object.freeze({left:'Open',right:'Closed',saber:false}as const),CAST=Object.freeze({left:'Open',right:'Open',saber:false}as const);
export function aokijiMeshState(action:string,elapsed=0,clip?:string):Readonly<{left:AokijiArmVariant;right:AokijiArmVariant;saber:boolean}>{
 if(clip==='Glacial Descent'||clip==='Pheasant Followup'||action==='special'||action==='ultimate'&&elapsed>=2.15)return CAST;
 if(aokijiStrikeJoint(action,elapsed,clip)==='LeftFoot')return KICK;
 return SABER;
}
export function aokijiStrikeJoint(action:string,elapsed=0,clip?:string):'LeftFoot'|'RightHand'{
 if(clip==='Frozen Heel'||clip==='Rush 2'||clip==='Polar Rise'||action==='heavy'&&!clip||action==='ultimate'&&elapsed>=.9&&elapsed<2.15)return 'LeftFoot';
 return 'RightHand';
}

export const AOKIJI_SABER_SOCKET={bone:'RHand_Weapon1_040',jointAlias:'AokijiSaber',base:[-4.6583154555968065e-08, -0.029348600081278597, 0.06094278752389837] as const,tip:[-2.359993817035999e-07, 2.8975778887385673e-08, 2.280358785851126] as const}as const;
