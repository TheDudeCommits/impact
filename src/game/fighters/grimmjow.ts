import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const GRIMMJOW_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Panther Cross',duration:.44,contacts:[.152],damage:21,range:2.4,radius:.70,stamina:10,cooldown:.44,stun:.31,knockback:3.4,lunge:4.1,style:'melee'},
 heavy:{name:'Feral Rake',duration:.92,contacts:[.4416],damage:65,range:2.65,radius:.83,stamina:25,cooldown:1.41,stun:.74,knockback:8.4,lunge:4.4,style:'melee',outcome:'launch',lift:5.4},
 special:{name:'Gran Rey Cero',duration:1.30,contacts:[.806],damage:123,range:29,radius:1.04,stamina:35,cooldown:5.2,stun:.85,knockback:10.2,speed:31,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Desgarron',duration:3.75,contacts:[.57,2.65],schedule:[71,241],damage:71,finisherDamage:219,range:2.85,radius:1.02,stamina:0,cooldown:25,stun:1.3,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:6.4,close:6.1,style:'melee',guardBreak:true,confirm:{recovery:.53}},
};
export const GRIMMJOW_COMBOS:ComboRow={
 lh:{name:'Panther Reversal',range:2.45,radius:.73},
 llh:{name:'Rising Talon',range:2.6,radius:.81},
 lllh:{name:'Predator Breaker',range:2.65,radius:.83},
 llls:{name:'Cero Pursuit',range:2.8,radius:.91},
 airHeavy:{name:'Aerial Rake',range:2.6,radius:.83},
 airSpecial:{name:'Panther Crash',radius:3.1},
};
export const GRIMMJOW_AWAKENING={name:'PANTERA',clip:'Pantera Release',sourceDuration:2.05,swapAt:.657,beats:{draw:.15,scrape:.35,pressure:.59,release:.73,settle:.90},manualOnly:true}as const;
const LEFT_CLIPS=new Set(['Feral Rake','Rush 1','Rush 3','Panther Reversal','Rising Talon','Aerial Rake']);
export function grimmjowStrikeJoint(action:string,clip?:string,contactIndex=0):'LeftHand'|'RightHand'{
 if(action==='ultimate'&&contactIndex>0)return'RightHand';
 return clip&&LEFT_CLIPS.has(clip)||!clip&&action==='heavy'?'LeftHand':'RightHand';
}
