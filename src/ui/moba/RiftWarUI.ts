import { mediaArt } from '../mediaArt';
import {FIGHTERS} from '../../config';
import type {GameSnapshot,PlayerState} from '../../game/types';
import {riftOf,buybackCost,RIFT_LANE_NAMES,RIFT_RULES,RIFT_TEAM_NAMES,type RiftView,type RiftSeat,type RiftLane,type RiftItemId} from '../../game/moba/model';
import {riftItem,levelThreshold} from '../../game/moba/items';
import type {UiAction} from '../../input/gamepad';
import {nearest,type Direction} from '../spatialFocus';
import {RiftMinimap} from './RiftMinimap';
import {riftIcon,escapeRift as escape,riftClock as clock} from './icons';
import {canStartRift,riftResultAction,canShop,nextObjective,inventoryNames} from './presentation';
import {RiftForge,relicArt} from './RiftForge';
import {warfrontAt} from '../../game/moba/warfront';
import './riftWar.css';
import './riftAtlas.css';
import {RiftTactics} from './RiftTactics';
import './riftTactics.css';
import {RiftBattleMap} from './RiftBattleMap';
import {Fill} from '../hud/kit';
import {currentDevice,keyLabel} from '../prompts';
import {padName} from '../../input/glyphs';
import {ACTIONS,boundTo} from '../../input/bindings';

const pct=(n:number,d:number)=>Math.max(0,Math.min(100,n/Math.max(1,d)*100));
const teamName=(v:string)=>v==='heroes'?'DAWN':'ECLIPSE';
export class RiftWarUI {
  onCustom=(_type:string,_payload:unknown)=>{};
  onLeave=()=>{};onPause=()=>{};
  readonly hud=document.createElement('aside');
  private panel=document.createElement('section');
  private shop=document.createElement('dialog');
  private map=new RiftMinimap();
  private battle=document.createElement('dialog');
  private battleMap=new RiftBattleMap(this.battle);
  private bars=new Map<string,Fill>();
  private forge=new RiftForge(this.shop,id=>this.onCustom('rift-buy',id));
  private view?:RiftView;private snapshot?:GameSnapshot;private ownId='';
  private last=-Infinity;private buildKey='unmounted';private panelKey='';private eventId=-1;
  private noticeText='';private noticeUntil=0;private previousLevel=0;private previousFront=-1;private panelNotice='';
  private text=new Map<string,string>();private nodes=new Map<string,HTMLElement>();
  private restoreFocus:HTMLElement|null=null;private disposed=false;
  private tactics:RiftTactics;
  constructor(private root:HTMLElement){
    this.hud.className='rift-hud';this.hud.hidden=true;this.hud.setAttribute('aria-label','Rift War battle status');
    this.hud.innerHTML=`<div class="rift-scoreboard" aria-label="Team kills and core health"><div data-side="heroes"><small>DAWN</small><b data-rift="heroes-kills">0</b><span class="rift-core-track"><i data-rift="heroes-core"></i></span><em>CORE <span data-rift="heroes-core-label">100%</span></em></div><div class="rift-match-clock"><small>RIFT WAR</small><b data-rift="clock">0:00</b></div><div data-side="villains"><small>ECLIPSE</small><b data-rift="villains-kills">0</b><span class="rift-core-track"><i data-rift="villains-core"></i></span><em>CORE <span data-rift="villains-core-label">100%</span></em></div></div>
      <div class="rift-personal"><div class="rift-progress"><strong data-rift="level">LV 1</strong><span class="rift-xp" role="progressbar" aria-label="Experience toward next level" aria-valuemin="0" aria-valuemax="100"><i data-rift="xp"></i></span><span class="rift-boon" data-rift="boon" hidden></span></div><div class="rift-objective"><strong data-rift="objective"></strong><span data-rift="objective-detail"></span></div></div>
      <div class="rift-map-block"><button type="button" class="rift-map-label" data-map>BATTLE MAP <span>↗</span></button><div class="rift-map-frame"></div><span class="rift-map-lane" data-rift="lane"></span></div>
      <div class="rift-build"><div class="rift-actions"><button type="button" data-shop>${riftIcon('shop')}<span><small>RELIC SHOP</small><b data-rift="gold">550 G</b></span><em data-rift="forge-hint"></em></button><button type="button" data-recall>${riftIcon('recall')}<span><b>RETURN</b><small>TO BASE</small></span></button></div></div>
      <div class="rift-status" data-rift="status" role="status" aria-live="polite"></div><div class="rift-life" data-rift="life" hidden></div>`;
    this.hud.querySelector('.rift-map-frame')!.append(this.map.canvas);
    this.tactics=new RiftTactics(this.hud,id=>this.openShop(id));this.forge.onTrack=id=>{this.tactics.track(id);this.notice(`TRACKING · ${riftItem(id)!.name}`);};
    for(const scope of [this.hud,this.battle])for(const node of scope.querySelectorAll<HTMLElement>('[data-rift]'))this.nodes.set(node.dataset.rift!,node);
    for(const name of ['xp','heroes-core','villains-core'])this.bars.set(name,new Fill(this.nodes.get(name)!));
    this.battle.addEventListener('cancel',event=>{event.preventDefault();this.closeMap();});
    this.battle.addEventListener('close',()=>this.restorePreviousFocus());
    this.panel.className='rift-panel';this.panel.hidden=true;this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-modal','true');
    this.shop.className='rift-forge';this.shop.setAttribute('aria-label','Relic forge');
    this.shop.addEventListener('cancel',event=>{event.preventDefault();this.closeShop();});
    this.shop.addEventListener('close',()=>this.restorePreviousFocus());
    const click=(event:Event)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;
      if(button.hasAttribute('data-map'))this.openMap();
      if(button.hasAttribute('data-close-map'))this.closeMap();
      if(button.hasAttribute('data-shop')){if(this.battle.open)this.closeMap();this.openShop(button.dataset.shop as RiftItemId||undefined);}
      if(button.hasAttribute('data-recall')){if(this.shop.open)this.closeShop();this.onCustom('rift-recall',{});}
      if(button.hasAttribute('data-buyback')){if(this.shop.open)this.closeShop();this.onCustom('rift-buyback',{});}
      if(button.dataset.ping){this.ping(button.dataset.ping as RiftLane);if(this.shop.open)this.closeShop();if(this.battle.open)this.closeMap();}
      if(button.hasAttribute('data-close-forge'))this.closeShop();

      if(button.hasAttribute('data-start'))this.onCustom('rift-start',{fillBots:(this.panel.querySelector('[data-fill]') as HTMLInputElement|null)?.checked??true});
      if(button.hasAttribute('data-rematch'))this.onCustom('rift-rematch',{});
      if(button.hasAttribute('data-requeue'))this.onCustom('rift-requeue',{});
      if(button.hasAttribute('data-leave'))this.onLeave();
    };
    this.battle.addEventListener('click',click);this.hud.addEventListener('click',click);this.panel.addEventListener('click',click);this.shop.addEventListener('click',click);
    this.map.canvas.addEventListener('click',()=>this.openMap());
    this.root.append(this.hud,this.panel,this.shop,this.battle);
  }
  finale=()=>false;
  get blocking(){return this.shop.open||this.battle.open||!!this.view&&this.view.phase!=='active';}
  get setupOpen(){return false;}
  get shopOpen(){return this.shop.open;}
  closeSetup(){if(this.battle.open){this.closeMap();return true;}if(this.shop.open){this.closeShop();return true;}return false;}
  busy(_on:boolean){}
  error(message:string){this.notice(message);}
  private set(name:string,value:string){if(this.text.get(name)===value)return;this.text.set(name,value);const el=this.nodes.get(name);if(el)el.textContent=value;}
  update(snapshot:GameSnapshot|undefined,id:string,targetId:string|null=null){
    const view=riftOf(snapshot);
    if(!view||!snapshot){if(this.view)this.reset();return;}
    const now=performance.now(),changed=this.view?.phase!==view.phase||this.view?.round!==view.round||this.ownId!==id;
    if(this.snapshot&&snapshot.serverTime<this.snapshot.serverTime){this.eventId=-1;this.previousLevel=0;}
    this.snapshot=snapshot;this.view=view;this.ownId=id;
    if(!changed&&now-this.last<80)return;this.last=now;
    this.root.dataset.riftActive=view.phase==='active'?'true':'false';
    this.hud.hidden=view.phase==='lobby'||view.phase==='over';this.panel.hidden=view.phase==='active'||view.phase==='over'&&this.finale();
    const seat=view.seats.find(s=>s.id===id),player=snapshot.players.find(p=>p.id===id);
    this.drawPanel(view,seat,snapshot.serverTime);
    if(view.phase!=='active'){if(this.shop.open)this.closeShop();if(this.battle.open)this.closeMap();return;}
    if(!this.shop.open&&!this.battle.open){this.map.update(snapshot,view,id,now);this.tactics.update(snapshot,view,seat,player,targetId);}
    this.set('clock',clock(snapshot.serverTime-view.startedAt));
    const front=warfrontAt(snapshot.serverTime-view.startedAt);
    if(this.previousFront>=0&&front.tier>this.previousFront)this.notice(`${front.name.toUpperCase()} · ${front.hint}`);this.previousFront=front.tier;
    for(const team of ['heroes','villains'] as const){
      this.set(`${team}-kills`,String(view.seats.filter(s=>s.team===team).reduce((n,s)=>n+s.kills,0)));
      const core=view.structures.find(s=>s.team===team&&s.kind==='core'),node=this.nodes.get(`${team}-core`)!;
      this.bars.get(`${team}-core`)!.set(core?pct(core.hp,core.maxHp)/100:1);this.set(`${team}-core-label`,core?.hidden?'?':`${Math.ceil(core?pct(core.hp,core.maxHp):100)}%`);node.parentElement!.dataset.unscouted=String(!!core?.hidden);const title=core?.hidden?`${teamName(team)} CORE · OUT OF SIGHT`:`${teamName(team)} CORE · ${Math.ceil(core?.hp??0)} HEALTH`;if(node.parentElement!.title!==title)node.parentElement!.title=title;
    }
    const objective=nextObjective(view,seat,snapshot.serverTime,player);this.set('objective',objective.title);this.set('objective-detail',objective.detail);this.nodes.get('objective')!.parentElement!.dataset.tone=objective.tone??'';
    if(seat){
      this.set('gold',`${Math.floor(seat.gold).toLocaleString()} G`);this.set('level',`LV ${seat.level}`);this.set('lane',`${RIFT_LANE_NAMES[seat.lane]} · YOUR LANE`);
      const from=levelThreshold(seat.level),to=levelThreshold(seat.level+1);const xp=seat.level>=18?1:pct(seat.xp-from,to-from)/100;this.bars.get('xp')!.set(xp);this.nodes.get('xp')!.parentElement!.setAttribute('aria-valuenow',String(Math.floor(xp*100)));
      const device=currentDevice();
      const shopHint=device.device==='touch'?(canShop(player,seat)?'BUY AT BASE':'BROWSE'):device.device==='controller'?`${padName(device.family,'select')} · SHOP`:ACTIONS.some(action=>boundTo(action,'KeyB'))?'CLICK TO BROWSE':`${keyLabel('interact')} · SHOP`;
      this.set('forge-hint',shopHint);
      if(seat.level>this.previousLevel&&this.previousLevel>0){this.notice(`LEVEL ${seat.level} · More health and stronger attacks`);const strip=this.nodes.get('level')!.parentElement!;strip.dataset.earned=strip.dataset.earned==='a'?'b':'a';}this.previousLevel=seat.level;
      this.set('boon',seat.boon?.name??'');this.nodes.get('boon')!.hidden=!seat.boon;this.drawBuild(seat);this.battleMap.update(snapshot,view,seat,now);this.drawLife(seat,player,snapshot.serverTime);
      const recall=this.hud.querySelector<HTMLButtonElement>('[data-recall]')!;recall.disabled=!player?.alive||seat.recallAt!==undefined;recall.setAttribute('aria-label',seat.recallAt?'Recalling to base':'Recall to base. Movement or damage cancels the channel.');
    }
    if(this.shop.open)this.drawShop(seat,player);
    for(const event of view.events){if(event.id<=this.eventId)continue;this.eventId=event.id;
      if(event.kind==='tower'||event.kind==='barracks'||event.kind==='core'||event.kind==='boss')this.notice(event.text??`${event.team?teamName(event.team)+' · ':''}${event.kind.toUpperCase()} ${event.kind==='boss'?'DEFEATED':'DESTROYED'}`);
      else if(event.kind==='rune'&&event.actorId===id)this.notice(event.text==='haste'?'HASTE · 22s of faster movement + fighting energy':'RECOVERY · Health restored + full stamina');
      else if(event.kind==='purchase'&&event.actorId===id)this.notice(event.text?`RELIC FORGED · ${event.text}`:'RELIC EQUIPPED');
      else if(event.kind==='ping'&&event.team===seat?.team)this.notice(`${event.lane?RIFT_LANE_NAMES[event.lane]:'LANE'} RALLY · An ally is rotating`);
    }
    const status=this.nodes.get('status')!;status.hidden=now>this.noticeUntil;this.set('status',this.noticeText);
  }
  private drawBuild(seat:RiftSeat){
    const key=seat.inventory.join(':');if(key===this.buildKey)return;this.buildKey=key;
    const root=this.nodes.get('items')!;root.innerHTML=Array.from({length:6},(_,i)=>{const item=riftItem(seat.inventory[i]);return item?`<button type="button" data-shop="${item.id}" class="is-equipped" title="${escape(item.name+' · '+item.description)}" aria-label="${escape(item.name+'. '+item.description)}" data-path="${item.path}">${`<img src="${relicArt(item.id)}" alt="">`}</button>`:`<button type="button" data-shop aria-label="Empty relic slot ${i+1}. Open the forge." title="Empty relic slot"><span>+</span></button>`;}).join('');
  }
  private drawLife(seat:RiftSeat,player:PlayerState|undefined,time:number){
    const life=this.nodes.get('life')!;
    if(seat.recallAt!==undefined){
      const seconds=Math.max(0,seat.recallAt-time),progress=1-seconds/RIFT_RULES.recallSeconds;
      if(life.dataset.state!=='recall'){life.dataset.state='recall';life.innerHTML='<small>RETURNING TO THE FOUNTAIN</small><b data-life-clock></b><span class="rift-channel"><i></i></span><span>Move or take damage to cancel</span>';}
      life.hidden=false;life.querySelector('[data-life-clock]')!.textContent=`${seconds.toFixed(1)}s`;(life.querySelector('.rift-channel i') as HTMLElement).style.transform=`scaleX(${progress})`;
    }else if(!player?.alive&&seat.respawnAt!==undefined){
      if(life.dataset.state!=='down'){life.dataset.state='down';life.innerHTML=`<small>THE WAR IS NOT OVER</small><b data-life-clock></b><span>Return to ${teamName(seat.team)} · prepare your next build</span><div class="rift-death-actions"><button type="button" data-shop>${riftIcon('shop')} FORGE</button><button type="button" data-buyback>${riftIcon('recall')}<span data-buyback-label>BUYBACK</span></button></div><span class="rift-buyback-note">Buyback returns you now. Your next respawn takes longer.</span>`;}
      life.hidden=false;life.querySelector('[data-life-clock]')!.textContent=String(Math.max(0,Math.ceil(seat.respawnAt-time)));
      const cost=buybackCost(seat),cooldown=Math.max(0,Math.ceil((seat.buybackAt??0)-time)),button=life.querySelector<HTMLButtonElement>('[data-buyback]')!;
      button.disabled=cooldown>0||seat.gold<cost;button.querySelector('[data-buyback-label]')!.textContent=cooldown?`BUYBACK · ${clock(cooldown)}`:seat.gold<cost?`BUYBACK · NEED ${cost-Math.floor(seat.gold)} G`:`BUYBACK · ${cost} G`;
    }else{life.hidden=true;life.dataset.state='';}
  }
  private drawPanel(view:RiftView,seat:RiftSeat|undefined,time:number){
    if(view.phase==='active'){this.panelKey='';this.panelNotice='';return;}
    const isOver=view.phase==='over',host=view.hostId===this.ownId,seconds=view.startsAt===null?0:Math.max(0,Math.ceil(view.startsAt-time));
    const key=JSON.stringify([view.phase,view.round,view.winner,view.reason,view.code,view.seats.map(s=>[s.id,s.fighter,s.disconnected,s.kills,s.deaths,s.assists,s.lastHits,s.structures,s.earned]),host,seconds]);if(key===this.panelKey)return;this.panelKey=key;
    const resultAction=riftResultAction(view,this.ownId),win=seat?.team===view.winner,headline=isOver?(win?'VICTORY':'DEFEAT'):view.phase==='countdown'?'THE RIFT OPENS':'ASSEMBLE YOUR SIDE';
    this.panel.setAttribute('aria-label',isOver?'Rift War results':'Rift War match lobby');this.panel.dataset.result=isOver?(win?'victory':'defeat'):'';
    this.panel.innerHTML=`<div class="rift-panel-page"><header><span>VALLEY OF THE END · 5 v 5</span><h1>${headline}</h1><p>${isOver?escape(view.reason||'The opposing core has fallen.'):view.phase==='countdown'?`The battle begins in ${seconds}.`:'Three lanes. Two armies. One core to break.'}</p><p class="rift-panel-notice" data-panel-notice role="status" aria-live="polite" ${this.panelNotice?'':'hidden'}>${escape(this.panelNotice)}</p>${view.code&&!view.party?`<div class="rift-room-code">ROOM <b>${escape(view.code)}</b></div>`:''}</header><div class="rift-rosters">${(['heroes','villains'] as const).map(team=>`<section data-side="${team}"><h2>${RIFT_TEAM_NAMES[team]}</h2>${view.seats.filter(s=>s.team===team).map(s=>`<article class="${s.id===this.ownId?'is-you':''}"><img src="${mediaArt(FIGHTERS[s.fighter].portrait)}" alt="" loading="eager"><div><strong>${escape(s.name==='Fighter'?FIGHTERS[s.fighter].name:s.name)}</strong><small>${escape(FIGHTERS[s.fighter].name)} · ${s.disconnected?'RECONNECTING':s.id===this.ownId?'YOU':s.bot?'BOT':s.laneKnown===false?'UNSCOUTED':RIFT_LANE_NAMES[s.lane]}</small></div>${isOver?`<b title="Kills / deaths / assists">${s.kills}<i>/</i>${s.deaths}<i>/</i>${s.assists}</b>`:''}</article>`).join('')}${!isOver?Array.from({length:Math.max(0,5-view.seats.filter(s=>s.team===team).length)},()=>'<div class="rift-open-seat">OPEN SLOT <span>Ally arriving…</span></div>').join(''):''}</section>`).join('')}</div>${isOver&&seat?`<div class="rift-contributions"><span><b>${seat.lastHits}</b> LAST HITS</span><span><b>${seat.structures}</b> STRUCTURES</span><span><b>${Math.round(seat.earned).toLocaleString()}</b> GOLD EARNED</span><span><b>${seat.level}</b> FINAL LEVEL</span></div><p class="rift-final-build">${escape(inventoryNames(seat).join(' · ')||'No relics equipped')}</p>`:''}<footer>${isOver?`<button type="button" class="rift-primary" ${resultAction.command==='rift-requeue'?'data-requeue':'data-rematch'} ${resultAction.enabled?'':'disabled'}>${resultAction.label} <span>→</span></button><button type="button" data-leave>RETURN HOME</button>`:canStartRift(view,this.ownId)?`<label><input type="checkbox" data-fill ${view.fillBots?'checked':''}> FILL OPEN SEATS WITH BOTS</label><button type="button" class="rift-primary" data-start>OPEN THE RIFT →</button><button type="button" data-leave>LEAVE</button>`:`<p>${view.phase==='countdown'?`${seconds} · GET READY`:view.autoStart?'Your party deploys together when everyone is ready.':view.access==='quick'?`Finding allies${seconds?` · battle begins in ${seconds}s`:''}. Open seats are filled by bots.`:'Waiting for the host to open the rift.'}</p><button type="button" data-leave>LEAVE</button>`}</footer></div>`;
  }
  interact(explicit=false){if(!this.view||this.view.phase!=='active'||this.shop.open||this.battle.open)return false;const seat=this.view.seats.find(s=>s.id===this.ownId),player=this.snapshot?.players.find(p=>p.id===this.ownId);if(!explicit&&!canShop(player,seat))return false;this.openShop();return true;}
  openShop(inspect?:RiftItemId){if(this.disposed||!this.view||this.view.phase!=='active'||this.shop.open)return;if(this.battle.open)this.closeMap();this.restoreFocus=document.activeElement as HTMLElement;if(inspect)this.forge.inspect(inspect);this.drawShop(this.view.seats.find(s=>s.id===this.ownId),this.snapshot?.players.find(p=>p.id===this.ownId));document.exitPointerLock?.();this.shop.showModal();}
  private closeShop(){this.forge.reset();this.shop.close();}
  private restorePreviousFocus(){if(this.shop.open||this.battle.open)return;this.restoreFocus?.focus();this.restoreFocus=null;}
  private openMap(){if(this.disposed||!this.view||!this.snapshot||this.view.phase!=='active'||this.battle.open)return;if(this.shop.open)this.closeShop();this.restoreFocus=document.activeElement as HTMLElement;document.exitPointerLock?.();this.battle.showModal();const seat=this.view.seats.find(s=>s.id===this.ownId);if(seat)this.battleMap.update(this.snapshot,this.view,seat,performance.now());}
  private closeMap(){this.battle.close();}
  private drawShop(seat:RiftSeat|undefined,player:PlayerState|undefined){if(seat)this.forge.update(seat,canShop(player,seat));}
  notice(message:string){this.noticeText=message;this.noticeUntil=performance.now()+4200;this.set('status',message);this.forge.notice(message);const el=this.shop.querySelector('[data-shop-message]');if(el)el.textContent=message;if(this.view&&this.view.phase!=='active'){this.panelNotice=message;const panel=this.panel.querySelector<HTMLElement>('[data-panel-notice]');if(panel){panel.textContent=message;panel.hidden=false;}}}
  private ping(lane:RiftLane){if(this.view?.phase==='active')this.onCustom('rift-ping',lane);}
  controllerAction(action:UiAction){
    if(!this.blocking)return false;if(action==='back'){if(this.battle.open)this.closeMap();else if(this.shop.open)this.closeShop();else this.onPause();return true;}
    const scope=this.battle.open?this.battle:this.shop.open?this.shop:this.panel,items=[...scope.querySelectorAll<HTMLElement>('button:not(:disabled),input')].filter(el=>el.getBoundingClientRect().width>0),active=document.activeElement as HTMLElement;
    if(!items.includes(active)){items[0]?.focus();return true;}if(action==='confirm'){active.click();return true;}
    const direction=({previous:'up',next:'down',left:'left',right:'right'} as Record<string,Direction>)[action];if(direction){const i=nearest(active.getBoundingClientRect(),items.map(el=>el.getBoundingClientRect()),direction);if(i>=0)items[i].focus();}return true;
  }
  reset(){if(this.battle.open)this.closeMap();if(this.shop.open)this.closeShop();this.hud.hidden=this.panel.hidden=true;this.view=undefined;this.snapshot=undefined;this.ownId='';this.panelKey='';this.buildKey='unmounted';this.last=-Infinity;this.eventId=-1;this.previousLevel=0;this.previousFront=-1;this.panelNotice='';this.noticeText='';this.noticeUntil=0;this.text.clear();delete this.root.dataset.riftActive;}
  clear(){this.reset();this.tactics.clear();this.forge.clear();this.battleMap.clear();}
  dispose(){this.reset();this.disposed=true;this.hud.remove();this.panel.remove();this.shop.remove();this.battle.remove();}
}
