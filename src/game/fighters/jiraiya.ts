import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

export const JIRAIYA_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name:'Kabuki Palm', duration:.44, contacts:[.168], damage:21, range:2.3, radius:.7,
    stamina:10, cooldown:.44, stun:.32, knockback:3.8, lunge:3.3, style:'melee' },
  heavy: { name:'Sannin Rasengan', duration:1, contacts:[.58], damage:65, range:2.65, radius:.85,
    stamina:26, cooldown:1.53, stun:.8, knockback:8.4, lunge:4.8, style:'melee', outcome:'launch', lift:5.6 },
  special: { name:'Fire Style: Flame Bomb', duration:1.15, contacts:[.69], damage:116, range:26, radius:1.05,
    stamina:34, cooldown:4.8, stun:.8, knockback:8.5, speed:27, style:'projectile', aimOnRelease:true },
  ultimate: { name:'Sage Art: Goemon', duration:3.25, contacts:[.52,1.82,2.6], schedule:[53,55,228],
    damage:53, finisherDamage:184, range:2.85, radius:.95, stamina:0, cooldown:24,
    stun:1.25, finisherStun:2.3, knockback:0, finisherKnockback:16, lunge:5.4, close:5.4,
    style:'melee', guardBreak:true, confirm:{recovery:.48} },
};
export const JIRAIYA_COMBOS: ComboRow = {
  lh:{name:'Sannin Backhand',range:2.4,radius:.75},
  llh:{name:'Mountain Palm',range:2.5,radius:.8},
  lllh:{name:'Rasengan Drive',range:2.65,radius:.85},
  llls:{name:'Flame Palm',range:2.6,radius:.85},
  airHeavy:{name:'Falling Toad Palm',range:2.5,radius:.85},
  airSpecial:{name:'Sage Landing',radius:3.2},
};
export const JIRAIYA_AWAKEN_BEATS = Object.freeze({still:.16,seal:.36,release:.576,settle:.81});
export const JIRAIYA_MOUTH_OFFSET = Object.freeze({forward:.14,up:.055});
export function jiraiyaStrikeJoint(slot:string,branch?:string,contactIndex=0):'LeftHand'|'RightHand'|'Head'{
  if(branch==='lh'||branch==='lllh'||branch==='airSpecial')return'RightHand';
  if(branch==='llh'||branch==='airHeavy')return'LeftHand';
  if(branch==='llls')return'Head';
  if(slot==='special'||slot==='ultimate'&&contactIndex>0)return'Head';
  return slot==='light'||slot==='ultimate'?'LeftHand':'RightHand';
}
export type JiraiyaStrikeSocket='LeftHand'|'RightHand'|'Mouth';
const LEFT_PALM_CLIPS=new Set(['Kabuki Palm','Mountain Palm','Falling Toad Palm','Rush 2']);
const MOUTH_CLIPS=new Set(['Flame Bomb','Flame Palm']);
export function jiraiyaStrikeSocket(action:string,displayedClipTime=0,clip?:string,contactIndex?:number):JiraiyaStrikeSocket{
  if(action==='ultimate'&&(!clip||clip==='Sage Art Goemon')){
    const index=contactIndex===undefined?(displayedClipTime<(.52+1.82)/2?0:displayedClipTime<(1.82+2.6)/2?1:2):Math.max(0,Math.min(2,Math.floor(contactIndex)));
    return index===0?'LeftHand':'Mouth';
  }
  if(clip&&MOUTH_CLIPS.has(clip))return'Mouth';
  if(clip&&LEFT_PALM_CLIPS.has(clip))return'LeftHand';
  if(clip)return'RightHand';
  return action==='special'?'Mouth':action==='light'?'LeftHand':'RightHand';
}
