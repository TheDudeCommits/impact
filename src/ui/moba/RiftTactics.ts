import { mediaArt } from '../mediaArt';
import {FIGHTERS} from '../../config';
import type {GameSnapshot,PlayerState} from '../../game/types';
import {type RiftItemId,type RiftSeat,type RiftView} from '../../game/moba/model';
import {riftUnitName} from '../../game/moba/armyIdentity';
import {riftItem} from '../../game/moba/items';
import {itemState,canShop} from './presentation';
import {relicArt} from './RiftForge';
import {escapeRift as escape,riftIcon} from './icons';
export class RiftTactics {
 readonly target=document.createElement('section');
 readonly goal=document.createElement('button');
 planned:RiftItemId='spirit-blade';
 private targetKey='';private goalKey='';
 constructor(private hud:HTMLElement,open:(id:RiftItemId)=>void){
  this.target.className='rift-target-card';this.target.hidden=true;this.target.setAttribute('aria-label','Locked target');
  this.goal.className='rift-build-goal';this.goal.type='button';this.goal.addEventListener('click',()=>open(this.planned));
  hud.append(this.target);hud.querySelector('.rift-build')!.append(this.goal);
 }
 track(id:RiftItemId){this.planned=id;this.goalKey='';}
 update(snapshot:GameSnapshot,view:RiftView,seat:RiftSeat|undefined,player:PlayerState|undefined,targetId:string|null){
  if(!seat)return;
  const item=riftItem(this.planned)!;const state=itemState(seat,item),ready=!state.disabled,home=canShop(player,seat),owned=state.owned||state.upgraded;
  const label=owned?'EQUIPPED · PLAN NEXT':state.full?'SIX RELICS EQUIPPED':seat.level<(item.level??1)?`UNLOCKS AT LEVEL ${item.level}`:ready?home?'READY · OPEN SHOP':'READY · RETURN TO BASE':`${Math.max(0,Math.ceil(state.cost-seat.gold)).toLocaleString()} G TO GO`;
  const progress=Math.floor((owned?1:Math.min(1,seat.gold/Math.max(1,state.cost)))*100);const key=`${item.id}:${label}:${progress}`;
  if(key!==this.goalKey){this.goalKey=key;this.goal.dataset.ready=String(ready);this.goal.setAttribute('aria-label',`${item.name}. ${label}. Open relic atlas.`);this.goal.innerHTML=`<img src="${relicArt(item.id)}" alt=""><span><small>${owned?'EQUIPPED':'SAVING FOR'}</small><b>${escape(item.name)}</b><em>${label}</em></span><i style="transform:scaleX(${progress/100})"></i>`;}
  const unit=view.units.find(u=>u.id===targetId&&u.hp>0),structure=view.structures.find(s=>s.id===targetId&&s.hp>0&&!s.hidden),fighter=snapshot.players.find(p=>p.id===targetId&&p.alive),target=unit??structure??fighter;
  this.target.hidden=!target;if(!target){this.targetKey='';return;}
  const name=unit?riftUnitName(unit):structure?`${structure.team==='heroes'?'Dawn':'Eclipse'} ${structure.kind==='tower'?'Ward':structure.kind==='core'?'Nexus':structure.kind==='barracks'?'Barracks':'Guardian'}`:FIGHTERS[fighter!.fighter].name;
  const team=unit?.team??structure?.team??view.seats.find(s=>s.id===fighter?.id)?.team;
  const role=unit?unit.kind==='siege'?'SIEGE · RANGED':unit.kind==='ranged'?'CASTER · RANGED':unit.kind==='boss'?'WORLD BOSS':'FRONTLINE · MELEE':structure?structure.vulnerable?'DEFENSE · EXPOSED':'DEFENSE · SEALED':`FIGHTER · LEVEL ${view.seats.find(s=>s.id===fighter?.id)?.level??1}`;
  const identity=`${target.id}:${role}`;if(identity!==this.targetKey){this.targetKey=identity;this.target.innerHTML=`<div class="rift-target-mark">${fighter?`<img src="${mediaArt(FIGHTERS[fighter.fighter].portrait)}" alt="">`:riftIcon(structure?'ward':unit?.kind==='ranged'?'wind':'blade')}</div><div><small>LOCKED · ${escape(role)}</small><b>${escape(name)}</b><span class="rift-target-health"><i></i></span><em></em></div>`;}
  this.target.dataset.side=team===seat.team?'ally':'enemy';(this.target.querySelector('.rift-target-health i')as HTMLElement).style.transform=`scaleX(${Math.max(0,target.hp/target.maxHp)})`;this.target.querySelector('em')!.textContent=`${Math.ceil(target.hp).toLocaleString()} / ${Math.ceil(target.maxHp).toLocaleString()}`;
 }
 clear(){this.target.hidden=true;this.targetKey=this.goalKey='';this.planned='spirit-blade';}
}
