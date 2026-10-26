import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
export const SAKURA_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Chakra Straight',duration:.45,contacts:[.168],damage:20,range:2.2,radius:.67,stamina:10,cooldown:.43,stun:.31,knockback:3.2,lunge:4.3,style:'melee'},
 heavy:{name:'Cherry Blossom Clash',duration:1,contacts:[.6],damage:65,range:2.6,radius:.96,stamina:28,cooldown:1.32,stun:.78,knockback:8.9,lunge:3.8,style:'melee',outcome:'knockdown'},
 special:{name:'Blossom Rush',duration:.92,contacts:[.4968],damage:118,range:2.55,radius:.91,stamina:32,cooldown:4.7,stun:.8,knockback:9.8,lunge:9.4,style:'melee',outcome:'launch'},
 ultimate:{name:'Cherry Blossom Hurricane',duration:3.35,contacts:[.5695,1.34,2.747],schedule:[53,50,233],damage:53,finisherDamage:184,range:2.8,radius:1.08,stamina:0,cooldown:23.5,stun:.86,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.2,close:5.2,style:'melee',guardBreak:true,confirm:{recovery:.57}},
};
export const SAKURA_COMBOS:ComboRow={lh:{name:'Bloom Backfist',range:2.35,radius:.77},llh:{name:'Rising Blossom',range:2.45,radius:.83},lllh:{name:'Shattering Blossom',range:2.65,radius:.95},llls:{name:'Chakra Drive',range:2.55,radius:.9},airHeavy:{name:'Aerial Blossom',range:2.65,radius:.93},airSpecial:{name:'Blossom Descent',radius:3.4}};
export const SAKURA_CONTACTS={light:.46,heavy:.62,special:.54,ultimate:[.17,.4,.82],rush:[.46,.46,.54],combos:{lh:.46,llh:.54,lllh:.62,llls:.46,airHeavy:.62,airSpecial:.62}}as const;
export const SAKURA_AWAKENING={name:'Strength of a Hundred',clip:'Strength of a Hundred',duration:2.2,entryDuration:.9,swapAt:.504,beats:{glove:.20,clasp:.378,release:.504,resolve:.648},manualOnly:true}as const;
export type SakuraStrikeSide='Right'|'Left'|'Both';
export function sakuraStrikeSide(action:string,elapsed=0,clip?:string,contactIndex?:number):SakuraStrikeSide{
 if(action==='ultimate'&&(!clip||clip==='Cherry Blossom Hurricane')){
  const i=contactIndex===undefined?(elapsed<.955?0:elapsed<1.94?1:2):Math.max(0,Math.min(2,Math.floor(contactIndex)));
  return i===0?'Right':i===1?'Left':'Both';
 }
 return clip==='Rush 1'||clip==='Bloom Backfist'?'Left':'Right';
}
