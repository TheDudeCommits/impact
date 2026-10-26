import type {CombatEvent,PlayerState} from '../types';
import type {RiftSeat,RiftItemId} from './model';
export interface RelicReward {heal:number;stamina:number;ultimate:number;awakening:number;surge:boolean;name:string}
export class RelicEffects {
 private readonly cooldowns=new Map<string,number>();
 readonly surgeUntil=new Map<string,number>();
 observe(event:CombatEvent,seat:RiftSeat,player:PlayerState,now:number):RelicReward|undefined {
  if(!player.alive)return;
  const hit=event.kind==='hit'&&event.actorId===seat.id&&(event.damage??0)>0;
  const parry=event.kind==='just-guard'&&event.targetId===seat.id;
  if(!hit&&!parry)return;
  const reward:RelicReward={heal:0,stamina:0,ultimate:0,awakening:0,surge:false,name:''};
  const take=(id:RiftItemId,seconds:number,name:string,apply:()=>void)=>{
   if(!seat.inventory.includes(id))return;const key=`${seat.id}:${id}`;if(now<(this.cooldowns.get(key)??0))return;
   this.cooldowns.set(key,now+seconds);apply();reward.name=reward.name?`${reward.name} + ${name}`:name;
  };
  if(parry)take('aegis-of-dawn',4,'PERFECT AEGIS',()=>{reward.heal+=150;reward.stamina+=18;});
  if(hit){
   if(event.slot==='heavy'||event.slot==='special'){
    take('sunbreaker',4,'SUNBREAK',()=>{reward.ultimate+=8;});
    take('storm-crown',5,'STORM SURGE',()=>{reward.surge=true;this.surgeUntil.set(seat.id,now+3);});
   }
   if((event.combo??0)>=4)take('eclipse-fang',6,'COMBO HARVEST',()=>{reward.heal+=100;});
   if(player.hp/player.maxHp<.35)take('worldheart',6,'LAST STAND',()=>{reward.heal+=120;});
   if(event.slot==='special')take('infinite-script',5,'SECOND VERSE',()=>{reward.stamina+=22;reward.awakening+=8;});
  }
  return reward.name?reward:undefined;
 }
 clear(){this.cooldowns.clear();this.surgeUntil.clear();}
}
