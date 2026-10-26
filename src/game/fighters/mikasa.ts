import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const MIKASA_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Scout Slash',duration:.44,contacts:[.168],damage:21,range:2.8,radius:.73,stamina:10,cooldown:.44,stun:.33,knockback:3,lunge:7,style:'melee'},
 heavy:{name:'Crossed Blades',duration:.90,contacts:[.504],damage:65,range:2.95,radius:.82,stamina:26,cooldown:1.28,stun:.72,knockback:8.4,lunge:4.5,style:'melee',outcome:'launch',lift:4.6},
 special:{name:'ODM Crosscut',duration:1.18,contacts:[.7198],damage:112,range:2.95,radius:.85,stamina:33,cooldown:4.9,stun:.82,knockback:9.2,lunge:10.3,close:5.6,style:'melee',outcome:'wallBounce'},
 ultimate:{name:'Ackerman Execution',duration:4,contacts:[.52,1.18,1.78,2.40,3.22],schedule:[31,43,52,67,200],damage:31,finisherDamage:166,range:3,radius:.95,stamina:0,cooldown:24,stun:1.18,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:6.1,close:6,style:'melee',guardBreak:true,confirm:{recovery:.54}},
};
export const MIKASA_COMBOS:ComboRow={lh:{name:'Reverse Reap',range:2.85,radius:.77},llh:{name:'Vaulting Blade',range:2.9,radius:.80},lllh:{name:'Steel Scissor',range:3,radius:.86},llls:{name:'Gas Reversal',range:3,radius:.87},airHeavy:{name:'Aerial Crosscut',range:2.95,radius:.86},airSpecial:{name:'Wings Descent',radius:3.3}};
export const MIKASA_CONTACTS={light:.50,heavy:.56,special:.61,ultimate:.13,rush1:.50,rush2:.50,rush3:.56,combos:{lh:.50,llh:.46,lllh:.56,llls:.61,airHeavy:.56,airSpecial:.56}}as const;
export const MIKASA_AWAKENING={name:'ACKERMAN RESOLVE',clip:'Ackerman Resolve',duration:2.1,entryDuration:.9,beats:{resolve:.18,guard:.42,release:.66,settle:.84},manualOnly:true,canonScope:'A deliberate human combat focus, not an invented transformation. No passive cable hits or automated ODM attacks.'}as const;
export const MIKASA_CINEMATIC={opener:{clip:'Ackerman Execution',at:.13},cine:{from:.13,at:.805,windows:[[.13,.3625,.295],[.3625,.515,.445],[.515,.70,.60],[.70,1,.805]]}}as const;
const MIKASA_CARRY_CLIPS:Readonly<Record<string,readonly[number,number]>>={
 'Scout Slash':[.5,.5],'Rush 1':[.45,.5],'Rush 2':[.55,.5],
 'Crossed Blades':[.9,.56],'Rush 3':[44/60,.56],'ODM Crosscut':[71/60,.61],
 'Reverse Reap':[.65,.5],'Vaulting Blade':[.75,.54],'Steel Scissor':[.9,.56],
 'Gas Reversal':[67/60,.61],'Aerial Crosscut':[58/60,.56],'Wings Descent':[1.1,.56],
 'Ackerman Execution':[4,.13],
};
export function mikasaAuthoredContactCarry(clip:string,sourceSeconds:number):number{
 const spec=MIKASA_CARRY_CLIPS[clip];if(!spec||!Number.isFinite(sourceSeconds))return 0;
 const t=sourceSeconds/spec[0],ultimate=clip==='Ackerman Execution';
 const begin=ultimate?.035:.12,peak=spec[1],holdEnd=peak+(ultimate?.018:.09),end=ultimate?.22:.94;
 if(t<=begin||t>=end)return 0;
 const u=t<peak?(t-begin)/(peak-begin):t<=holdEnd?1:(end-t)/(end-holdEnd);
 return .5*u*u*(3-2*u);
}
export function mikasaStrikeJoint(clip:string,contactIndex?:number,sourceFraction=0):'LeftHand'|'RightHand'{
 if(clip==='Ackerman Execution'){const i=contactIndex??(sourceFraction<.2125?0:sourceFraction<.37?1:sourceFraction<.5225?2:sourceFraction<.7025?3:4);return i===1||i===3?'LeftHand':'RightHand';}
 return ['Rush 1','Reverse Reap','Vaulting Blade'].includes(clip)?'LeftHand':'RightHand';
}
export const MIKASA_SWORD_SOCKETS={"LeftHand":{"bone":"LeftHand","tip":[0.8823710825169648,0.1735783405040289,0.3109186623114209],"heel":[0.20511266558011884,0.08660696868174668,0.016791239416393603],"grip":[0.018689007755886614,0.0576192943149806,-0.037398356398436146]},"RightHand":{"bone":"RightHand","tip":[-0.8904994647678068,0.1681997442396257,0.29150832920813574],"heel":[-0.18900306610358245,0.09577272492244193,0.0561125179086035],"grip":[-0.013091842990192781,0.060995229349816715,-0.023739542296774774]}} as const;
