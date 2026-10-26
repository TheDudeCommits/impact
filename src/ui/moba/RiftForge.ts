import {RIFT_ITEMS,riftItem,itemAncestors,ownedComponent,type RiftItem} from '../../game/moba/items';
import {RIFT_TEAM_NAMES,type RiftSeat,type RiftItemId} from '../../game/moba/model';
import {pulse} from '../hud/kit';
import {itemState} from './presentation';
import {escapeRift as escape,riftIcon} from './icons';
const ART:Record<RiftItemId,string>={
 'spirit-blade':'burning-blade','soul-fang':'bloodlust','void-edge':'rending-cut','blood-moon':'soul-harvest',sunbreaker:'limit-break','eclipse-fang':'executioner',
 'vital-seal':'tough-body','iron-ward':'ki-armor','titan-heart':'berserker-armor','guardian-oath':'guardian','dawn-oath':'awakened-soul','aegis-of-dawn':'counter-art',worldheart:'undying-will',
 'swift-sandals':'fleet-foot','focus-charm':'focus','storm-step':'flash-step','sage-scroll':'ki-surge','rift-compass':'ultimate-rush','shadow-tread':'afterimage','storm-crown':'god-speed','infinite-script':'limitless',
};
export const relicArt=(id:RiftItemId)=>`/assets/survival/cards/${ART[id]}.webp`;
const PATHS=[{id:'power',name:'BREAKTHROUGH',tag:'Make every hit matter',number:'01'}, {id:'guard',name:'UNBREAKABLE',tag:'Turn defense into defiance',number:'02'}, {id:'tempo',name:'AFTERIMAGE',tag:'Dictate the next exchange',number:'03'}] as const;
const stage=(item:RiftItem)=>item.level?2:item.component?1:0;
const rank=(item:RiftItem)=>item.level?'III':item.component?'II':'I';

export class RiftForge {
 onTrack=(_id:RiftItemId)=>{};
 private tracked:RiftItemId='spirit-blade';
 inspect(id:RiftItemId){this.selected=id;this.armedUntil=0;this.cancel();this.detailKey='';if(this.built){this.renderDetail();this.updateNodes();}}
 private selected:RiftItemId='spirit-blade';private seat?:RiftSeat;private available=false;
 private built=false;private detailKey='';private inventory='';private holding=0;private raf=0;private holdId?:RiftItemId;
 private nodeKeys=new Map<string,string>();
 private copy(selector:string,value:string){const node=this.root.querySelector(selector);if(node&&node.textContent!==value)node.textContent=value;}
 private armedUntil=0;private suppressClick=false;
 constructor(private root:HTMLDialogElement,private buy:(id:RiftItemId)=>void){
  root.addEventListener('click',event=>{
   const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
   if(button.dataset.inspect)this.inspect(button.dataset.inspect as RiftItemId);
   if(button.hasAttribute('data-track-relic')){this.tracked=this.selected;this.onTrack(this.selected);this.detailKey='';this.renderDetail();}
   if(button.hasAttribute('data-forge-confirm')){
    if(this.suppressClick){this.suppressClick=false;return;}
    if(event.detail>0)return;
    if(performance.now()<this.armedUntil)this.commit();else{this.armedUntil=performance.now()+4000;this.confirmLabel('CONFIRM FORGE');}
   }
  });
  root.addEventListener('pointerdown',event=>{
   const button=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-forge-confirm]');
   if(!button||button.disabled||event.button!==0)return;
   this.cancel();this.holding=performance.now();this.holdId=this.selected;button.setPointerCapture?.(event.pointerId);
   const frame=()=>{if(!this.holding)return;const p=Math.min(1,(performance.now()-this.holding)/650);button.style.setProperty('--hold',String(p));if(p>=1){this.suppressClick=true;this.commit();}else this.raf=requestAnimationFrame(frame);};
   this.raf=requestAnimationFrame(frame);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture','close'])root.addEventListener(type,()=>this.cancel());
 }
 update(seat:RiftSeat,available:boolean){
  this.seat=seat;this.available=available;if(!this.built)this.build();
  this.copy('[data-atlas-wallet]',Math.floor(seat.gold).toLocaleString());
  this.copy('[data-atlas-faction]',`${RIFT_TEAM_NAMES[seat.team]} · RELIC ATLAS`);
  this.copy('[data-atlas-state]',available?'AT BASE · PURCHASES AVAILABLE':'BROWSE YOUR BUILD · RETURN TO BASE TO BUY');
  const inventory=seat.inventory.join(':');let forged:RiftItemId|undefined;
  if(inventory!==this.inventory){const previous=this.inventory.split(':'),initial=this.inventory==='unmounted';this.inventory=inventory;for(const id of seat.inventory)if(!previous.includes(id)){if(!initial)forged=id;const node=this.root.querySelector<HTMLElement>(`[data-inspect="${id}"].rift-atlas-node`);if(node){pulse(node,'forged');}}this.root.querySelector('[data-atlas-build]')!.innerHTML=Array.from({length:6},(_,i)=>{const item=riftItem(seat.inventory[i]);return item?`<button data-inspect="${item.id}" title="${escape(item.name)}"><img src="${relicArt(item.id)}" alt="${escape(item.name)}"><i>${rank(item)}</i></button>`:'<span aria-label="Empty relic slot">+</span>';}).join('');}
  this.updateNodes();this.renderDetail();if(forged)this.notice(`FORGED · ${riftItem(forged)!.name}`);
 }
 private build(){
  this.built=true;this.inventory='unmounted';
  this.root.innerHTML=`<button class="rift-close" data-close-forge aria-label="Close the relic atlas">×</button>
   <header class="rift-atlas-head"><div><span data-atlas-faction></span><h2>WRITE YOUR LEGEND<span>.</span></h2><p>Choose your path. Forge your turning point.</p></div><div class="rift-atlas-wallet">${riftIcon('coin')}<strong data-atlas-wallet></strong><span>GOLD</span></div></header>
   <div class="rift-atlas-toolbar"><span data-atlas-state></span><span>I · FOUNDATION <i>→</i> II · EVOLUTION <i>→</i> III · MYTHIC / LV 8</span></div>
   <div class="rift-atlas-layout"><div class="rift-atlas-map" aria-label="Relic progression paths">${PATHS.map(path=>{
    const items=RIFT_ITEMS.filter(i=>i.path===path.id),positions=new Map<string,{x:number;y:number}>();
    for(const level of [0,1,2]){const row=items.filter(i=>stage(i)===level);if(level===2)row.sort((a,b)=>(positions.get(a.component!)?.x??0)-(positions.get(b.component!)?.x??0));row.forEach((item,i)=>positions.set(item.id,{x:(i+1)*300/(row.length+1),y:60+level*155}));}
    return `<section class="rift-atlas-path" data-path="${path.id}"><header><span>${path.number} / ${path.tag}</span><h3>${path.name}</h3></header><div class="rift-atlas-graph"><svg viewBox="0 0 300 435" preserveAspectRatio="none" aria-hidden="true">${items.filter(i=>i.component).map(item=>{const a=positions.get(item.component!)!,b=positions.get(item.id)!;return `<path data-link="${item.id}" d="M${a.x} ${a.y+34} V${(a.y+b.y)/2} H${b.x} V${b.y-35}"/>`;}).join('')}</svg>${items.map(item=>{const at=positions.get(item.id)!;return `<button type="button" class="rift-atlas-node" data-inspect="${item.id}" data-rank="${stage(item)}" style="left:${at.x/3}%;top:${at.y}px" aria-label="Inspect ${escape(item.name)}"><span class="rift-atlas-sigil"><img src="${relicArt(item.id)}" alt="" loading="lazy"><i>${rank(item)}</i><em aria-hidden="true">✓</em></span><b>${escape(item.name)}</b><small data-price></small></button>`;}).join('')}</div></section>`;
   }).join('')}</div><aside class="rift-atlas-detail" aria-label="Selected relic"></aside></div>
   <footer class="rift-atlas-foot"><div><span>YOUR BUILD <b>6 RELICS</b></span><div data-atlas-build></div></div><p>All powers reward your manual attacks and defenses.<br><b>The battle continues while you forge.</b></p><button type="button" class="rift-map-shortcut" data-map>BATTLE MAP</button><button type="button" class="rift-primary" data-close-forge>BACK TO BATTLE <span>↗</span></button></footer>`;
 }
 private updateNodes(){
  if(!this.seat)return;
  for(const item of RIFT_ITEMS){const state=itemState(this.seat,item),node=this.root.querySelector<HTMLElement>(`[data-inspect="${item.id}"].rift-atlas-node`)!;
   const kind=state.owned?'owned':state.upgraded?'evolved':!state.disabled&&this.available?'ready':'locked',selected=this.selected===item.id,price=state.owned?'EQUIPPED':state.upgraded?'EVOLVED':item.level&&this.seat.level<item.level?`LEVEL ${item.level}`:`${state.cost.toLocaleString()} G`,linked=state.owned||state.upgraded||!!ownedComponent(this.seat,item),key=`${kind}:${selected}:${price}:${linked}`;
   if(this.nodeKeys.get(item.id)===key)continue;this.nodeKeys.set(item.id,key);
   node.dataset.state=kind;node.setAttribute('aria-pressed',String(selected));node.querySelector('[data-price]')!.textContent=price;
   const line=this.root.querySelector<HTMLElement>(`[data-link="${item.id}"]`);if(line)line.dataset.active=String(linked);
  }
 }
 private renderDetail(){
  const seat=this.seat;if(!seat)return;const item=riftItem(this.selected)!,state=itemState(seat,item);
  const key=[item.id,this.inventory,seat.level,this.available].join(':');
  if(key!==this.detailKey){
   this.cancel();this.detailKey=key;this.armedUntil=0;
   const component=ownedComponent(seat,item),before=component?riftItem(component):undefined;
   const trail=[...itemAncestors(item).reverse().map(id=>riftItem(id)!.name),item.name];
   this.root.querySelector('.rift-atlas-detail')!.innerHTML=`<div class="rift-atlas-art" data-path="${item.path}"><img src="${relicArt(item.id)}" alt=""><span>${item.level?'MYTHIC RELIC':item.component?'EVOLVED RELIC':'FOUNDATION'}</span><i>${rank(item)}</i></div>
    <div class="rift-atlas-copy"><small>${trail.map(escape).join(' / ')}</small><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p>${item.trigger?`<div class="rift-atlas-trigger"><b>YOUR PLAY. YOUR POWER.</b><p>${escape(item.trigger)}</p></div>`:''}
    ${before?`<div class="rift-atlas-replace"><span>REPLACES ${escape(before.name.toUpperCase())}</span><p>${escape(before.description)}</p><b>${before.cost} G invested · credited in full</b></div>`:`<div class="rift-atlas-replace"><span>${item.level?'MYTHIC · REQUIRES LEVEL 8':item.component?'BUY DIRECTLY OR EVOLVE A FOUNDATION':'THE FIRST STEP OF YOUR PATH'}</span><p>${item.level?'A play-defining power spike earned during this match.':item.component?'Your owned component reduces the price and frees its slot.':'Your gold stays invested when this relic evolves.'}</p></div>`}
    <div class="rift-atlas-price"><span>${state.owned?'OWNED':'FORGE COST'}</span><b>${state.owned?'✓':state.cost.toLocaleString()}<small>${state.owned?'':'G'}</small></b></div>
    <button type="button" data-forge-confirm data-buy="${item.id}"><i></i><span data-confirm-label>HOLD TO FORGE</span></button><small class="rift-atlas-help">Hold for a moment · keyboard / controller: confirm twice</small><button type="button" class="rift-track-relic" data-track-relic aria-pressed="${this.tracked===item.id}">${this.tracked===item.id?'TRACKED ON YOUR HUD':'TRACK AS NEXT UPGRADE'} <span>↗</span></button><p data-atlas-feedback role="status" aria-live="polite"></p></div>`;
  }
  const button=this.root.querySelector<HTMLButtonElement>('[data-forge-confirm]')!;const disabled=!this.available||state.disabled;if(button.disabled!==disabled)button.disabled=disabled;
  if(button.disabled){this.cancel();this.confirmLabel(state.owned?'RELIC EQUIPPED':state.upgraded?'ALREADY EVOLVED':!this.available?'RECALL TO THE FOUNTAIN':state.label);}
  else if(!this.holding&&performance.now()>=this.armedUntil)this.confirmLabel('HOLD TO FORGE');
 }
 private confirmLabel(label:string){this.copy('[data-confirm-label]',label);}
 private commit(){
  const seat=this.seat,item=riftItem(this.selected)!;if(!seat||!this.available||itemState(seat,item).disabled||this.holdId&&this.holdId!==item.id){this.cancel();return;}
  this.cancel();this.armedUntil=0;this.buy(item.id);
 }
 cancel(){const held=this.holding>0;this.holding=0;this.holdId=undefined;cancelAnimationFrame(this.raf);if(held)this.root.querySelector<HTMLElement>('[data-forge-confirm]')?.style.setProperty('--hold','0');}
 notice(message:string){this.copy('[data-atlas-feedback]',message);}
 reset(){this.cancel();this.detailKey='';this.armedUntil=0;this.suppressClick=false;}
 clear(){this.reset();this.nodeKeys.clear();this.tracked=this.selected='spirit-blade';this.seat=undefined;this.inventory='unmounted';}
}
