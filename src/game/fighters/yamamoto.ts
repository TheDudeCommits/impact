import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const YAMAMOTO_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Nadegiri',duration:.60,contacts:[.29],damage:25,range:3.0,radius:.79,stamina:12,cooldown:.60,stun:.35,knockback:3.5,lunge:4.1,style:'melee'},
 heavy:{name:'Ryujin Cleave',duration:.98,contacts:[.46],damage:65,range:3.1,radius:.87,stamina:29,cooldown:1.26,stun:.83,knockback:8.8,lunge:4.0,style:'melee',outcome:'knockdown'},
 special:{name:'Ryujin Jakka',duration:1.35,contacts:[.66],damage:113,range:27,radius:1.08,stamina:35,cooldown:5.0,stun:.87,knockback:8.3,speed:26,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Ennetsu Jigoku',duration:4,contacts:[.50,1.44,3.14],schedule:[44,76,228],damage:44,finisherDamage:212,range:3.1,radius:1.05,stamina:0,cooldown:24,stun:1.18,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.6,close:6,style:'melee',guardBreak:true,confirm:{recovery:.58}},
};
export const YAMAMOTO_COMBOS:ComboRow={lh:{name:'Commanders Reversal',range:3.05,radius:.87},llh:{name:'Rising Ember',range:3.0,radius:.88},lllh:{name:'Ashen Divider',range:3.2,radius:.92},llls:{name:'Cinder Reprisal',range:3.2,radius:1.02},airHeavy:{name:'Aerial Cleave',range:3.05,radius:.9},airSpecial:{name:'Falling Ember',radius:3.6}};
export const YAMAMOTO_CONTACTS={light:.435,heavy:.495,special:.58,ultimate:.125,rush1:.435,rush2:.53,rush3:.495,combos:{lh:.53,llh:.55,lllh:.495,llls:.58,airHeavy:.495,airSpecial:.58}}as const;
export const YAMAMOTO_AWAKENING={name:'ZANKA NO TACHI',clip:'Zanka no Tachi',duration:2.3,entryDuration:.9,beats:{lower:.20,compress:.42,release:.64,settle:.86},manualOnly:true,canonScope:'Bankai on the classic two-armed captain costume. Heat is presentation only; no passive burn or autonomous attacks.'}as const;
export const yamamotoStrikeJoint=()=> 'RightHand' as const;
export const YAMAMOTO_SWORD_SOCKET={"bone":"RightHand","tip":[0.14236698759756772,0.24956964307522972,0.9367059995696284],"heel":[9.150698868465312e-05,0.1336377974888034,0.15291268431425065],"grip":[-0.028225480932581704,0.10018940842495866,-0.007304677982070851]}as const;
