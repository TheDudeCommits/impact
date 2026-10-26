import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';

export const MIGHT_GUY_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Leaf Straight',duration:.44,contacts:[.168],damage:21,range:2.7,radius:.78,stamina:11,cooldown:.44,stun:.35,knockback:4,lunge:4.8,style:'melee'},
 heavy:{name:'Leaf Whirlwind',duration:.94,contacts:[.49],damage:65,range:2.95,radius:.98,stamina:27,cooldown:1.2,stun:.82,knockback:9,lunge:4.8,style:'melee',outcome:'knockdown'},
 special:{name:'Daytime Tiger',duration:1.36,contacts:[.74],damage:118,range:29,radius:1.08,stamina:35,cooldown:5,stun:.88,knockback:10,speed:30,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Night Guy',duration:3.98,contacts:[.50,1.48,3.12],schedule:[49,80,217],damage:49,finisherDamage:202,range:3.1,radius:1.05,stamina:0,cooldown:24,stun:1.1,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:6,close:6,style:'melee',guardBreak:true,confirm:{recovery:.58}},
};
export const MIGHT_GUY_COMBOS:ComboRow={lh:{name:'Leaf Rising Wind',range:2.95,radius:.92},llh:{name:'Dynamic Entry',range:3.05,radius:1},lllh:{name:'Youthful Hurricane',range:3.15,radius:1.06},llls:{name:'Morning Peacock',range:3.3,radius:1.15},airHeavy:{name:'Descending Fang',range:3,radius:1},airSpecial:{name:'Evening Elephant',radius:3.6}};
export const MIGHT_GUY_AWAKENING={name:'GATE OF DEATH',clip:'Gate of Death',duration:1.9,entryDuration:.9,beats:{heart:.18,resolve:.38,release:.62,stance:.84},manualOnly:true,canonScope:'Native Eight Gates body; authored fist-to-heart, clenched release and runner stance. Red steam is visual only; no passive damage.'}as const;
export function mightGuyAuthoredKick(clip:string):boolean{return ['Leaf Whirlwind','Leaf Rising Wind','Dynamic Entry','Youthful Hurricane','Descending Fang','Night Guy'].includes(clip);}
export function mightGuyAuthoredRushStep(clip:string,sourceSeconds:number):boolean{return clip==='Rush 1'&&Number.isFinite(sourceSeconds)&&sourceSeconds>=0&&sourceSeconds<=.50001;}
export function mightGuyHandState(clip:string,gateBody=false):'fists'|'open'|'spread'|'thumb'{return clip==='Guy Victory'&&!gateBody?'thumb':clip==='Daytime Tiger'||clip==='Morning Peacock'?'spread':clip==='_Idle'||clip==='Block'?'open':'fists';}
export function mightGuyStrikeJoint(clip:string,contactIndex=0):'RightHand'|'LeftHand'|'RightToeBase'|'LeftToeBase'|'BothHands'{
 if(clip==='Daytime Tiger')return 'BothHands';
 if(clip==='Rush 2'||clip==='Morning Peacock')return 'LeftHand';
 if(clip==='Leaf Rising Wind'||clip==='Youthful Hurricane')return 'LeftToeBase';
 if(clip==='Leaf Whirlwind'||clip==='Dynamic Entry'||clip==='Descending Fang')return 'RightToeBase';
 if(clip==='Night Guy')return contactIndex>=2?'RightToeBase':contactIndex===1?'LeftHand':'RightHand';
 return 'RightHand';
}
