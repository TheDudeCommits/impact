import {RIFT_BASES} from '../../game/moba/map';
import {RIFT_RULES,RIFT_LANE_NAMES,type RiftSeat,type RiftView} from '../../game/moba/model';
import {RIFT_ITEMS,itemPrice,riftItem,ownedComponent,alreadyEvolved,type RiftItem} from '../../game/moba/items';
import type {PlayerState} from '../../game/types';
export function canStartRift(view:RiftView,ownId:string){return view.phase==='lobby'&&view.hostId===ownId&&view.access==='host'&&!view.autoStart;}
export function riftResultAction(view:RiftView,ownId:string){const publicQueue=view.access==='quick',host=view.hostId===ownId;return {command:publicQueue?'rift-requeue':'rift-rematch',label:publicQueue?'FIND NEXT WAR':host?'RUN IT BACK':'WAITING FOR HOST',enabled:view.phase==='over'&&(publicQueue||host)};}
export function canShop(player:PlayerState|undefined,seat:RiftSeat|undefined){if(!player||!seat)return false;const b=RIFT_BASES[seat.team];return !player.alive||Math.hypot(player.x-b.x,player.z-b.z)<=RIFT_RULES.shopRadius;}
export function itemState(seat:RiftSeat,item:RiftItem){
  const owned=seat.inventory.includes(item.id),upgraded=alreadyEvolved(seat,item);
  const full=seat.inventory.length>=6&&!ownedComponent(seat,item),cost=itemPrice(seat,item);
  return {cost,owned,upgraded,full,disabled:owned||upgraded||full||seat.gold<cost||seat.level<(item.level??1),label:owned?'EQUIPPED':upgraded?'UPGRADED':full?'BUILD FULL':seat.level<(item.level??1)?`UNLOCKS AT LEVEL ${item.level}`:seat.gold<cost?`${Math.ceil(cost-seat.gold)} MORE GOLD`:'PURCHASE'};
}
export function itemGlyph(item:RiftItem){return item.path==='guard'?'ward':item.path==='power'?'blade':'wind';}
export function wardPressure(view:RiftView,seat:RiftSeat|undefined,player:PlayerState|undefined){
  if(!seat||!player?.alive)return;
  let tower:RiftView['structures'][number]|undefined,distance=Infinity;
  for(const s of view.structures){
    if(s.hidden||s.hp<=0||s.team===seat.team||(s.kind!=='tower'&&s.kind!=='guardian'))continue;
    const d=Math.hypot(s.x-player.x,s.z-player.z);if(d>RIFT_RULES.towerRange+4)continue;
    if(!tower||(s.target===player.id&&tower.target!==player.id)||(s.target===player.id)===(tower.target===player.id)&&d<distance){tower=s;distance=d;}
  }
  if(!tower)return;
  const wave=view.units.some(u=>u.hp>0&&u.team===seat.team&&Math.hypot(u.x-tower!.x,u.z-tower!.z)<15);
  return {tower,targeting:tower.target===player.id,fortified:!wave};
}
export function nextObjective(view:RiftView,seat:RiftSeat|undefined,now:number,player?:PlayerState):{title:string;detail:string;tone?:'danger'|'caution'}{
  if(!seat)return {title:'Choose your lane',detail:'Fight with your wave. Break the opposing core.'};
  const ward=wardPressure(view,seat,player);
  if(ward?.targeting)return {title:'WARD TARGETING YOU',detail:'Leave its range. Repeated shots hit harder; your wave can take the fire.',tone:'danger'};
  const ownCore=view.structures.find(s=>s.team===seat.team&&s.kind==='core');
  if(ownCore&&ownCore.hp<ownCore.maxHp*.5)return {title:'Your core needs you',detail:'Return to base and stop the breach.',tone:'danger'};
  const enemy=seat.team==='heroes'?'villains':'heroes',core=view.structures.find(s=>s.team===enemy&&s.kind==='core');
  if(core?.vulnerable)return {title:'Their core is exposed',detail:'Push with your team. Finish the war.'};
  if(ward&&!ward.tower.vulnerable)return {title:'DEFENSE SEALED',detail:ward.tower.kind==='guardian'?'Break the barracks in one lane to expose these guardians.':'Destroy the outer ward in this lane to expose this defense.',tone:'caution'};
  if(ward?.fortified)return {title:'WAIT FOR YOUR WAVE',detail:'Without nearby allied grunts, your attacks deal only 18% damage.',tone:'caution'};
  if(view.buffs[seat.team]>now)return {title:'Rift Ascendancy is yours',detail:`Empowered waves · ${Math.ceil(view.buffs[seat.team]-now)}s to break a lane.`};
  if(view.units.some(u=>u.kind==='boss'&&u.hp>0))return {title:'Rift Guardian has awakened',detail:'Rally in the river jungle for a team siege blessing.'};
  if(now-view.startedAt<60&&seat.inventory.length===0&&seat.gold>=400&&canShop(player,seat))return {title:'Visit the relic shop',detail:`${Math.floor(seat.gold)} gold ready · buy your first upgrade before you push.`};
  const lane=RIFT_LANE_NAMES[seat.lane];
  if(view.wave===0)return {title:`${lane} WAVE · ${Math.max(0,Math.ceil(view.nextWaveAt-now))}s TO DEPLOY`,detail:'Follow your allied grunts. Last hits earn gold; nearby defeats grant experience.'};
  const tower=view.structures.find(s=>s.team===enemy&&s.lane===seat.lane&&s.vulnerable&&s.hp>0);
  return {title:tower?`${lane} · ${tower.kind==='barracks'?'BREAK THE BARRACKS':tower.tier===1?'BREAK THE OUTER WARD':'BREAK THE INNER WARD'}`:'Rotate and create an opening',detail:tower?`Next wave in ${Math.max(0,Math.ceil(view.nextWaveAt-now))}s · let your grunts draw tower fire.`:'Ping a lane to call an ally. Recall to buy a stronger build.'};
}
export const inventoryNames=(seat:RiftSeat)=>seat.inventory.map(id=>riftItem(id)?.name??id);
