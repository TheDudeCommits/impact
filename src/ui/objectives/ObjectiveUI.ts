import {FIGHTERS} from '../../config';
import {isReleasedFighter} from '../../game/rosterAvailability';
import type {FighterId,GameSnapshot,PlayerState} from '../../game/types';
import {objectiveOf,RULES,OBJECTIVE_NAMES,TEAM_NAMES,isObjectiveKind,factionOf,isBadBloodFighter,type ObjectiveKind,type ObjectiveView,type RolePreference,type ObjectiveAccess} from '../../game/objectives/model';
import {TRAP_THEMES} from '../../game/objectives/siegeTraps';
import {DEFENCES,VILLAGE,type DefenceId} from '../../game/objectives/lastStand';
import type {NetworkAccess} from '../../network';
import type {UiAction} from '../../input/gamepad';
import {mangaPortrait,HOME_ROSTER} from '../MangaHome';
import {nearest,type Direction} from '../spatialFocus';
import {inPlayerTwo,inviteLink} from '../../boot/playerTwo';
import './objectives.css';
import './objectivePresentation.css';
import './lastStandHud.css';
import './badBloodHud.css';
import {ObjectiveStatus} from './ObjectiveStatus';
import {FighterLevelHud} from './FighterLevelHud';
import {objectiveResults} from '../results/objectiveResults';
import {ACTIONS,boundTo} from '../../input/bindings';
import {promptKey} from '../prompts';
import {actionControl,padName} from '../../input/glyphs';
import type {PadFamily} from '../../input/gamepad';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const displayName=(s:{name:string;fighter:FighterId})=>s.name==='Fighter'?FIGHTERS[s.fighter].name:s.name;
const clock=(n:number)=>{const s=Math.floor(Math.max(0,n));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
const pct=(value:number,max:number)=>Math.max(0,Math.min(100,value/Math.max(1,max)*100));
export class ObjectiveUI {
  readonly setup=document.createElement('dialog');
  private shop=document.createElement('dialog');
  private shopPrompt=document.createElement('button');
  private panel=document.createElement('section');private hud=document.createElement('aside');private respawn=document.createElement('div');
  private status=new ObjectiveStatus(this.hud);private key='';private view?:ObjectiveView;private ownId='';private resultKey='';private returnFocus:HTMLElement|null=null;private editing=false;private digit=0;private snapshot?:GameSnapshot;private shopKey='';
  private watched?:PlayerState;private watchCount=0;private watchLine='';
  private levelHud=new FighterLevelHud();
  onStart=(_access:NetworkAccess)=>{};onCommand=(_action:'start'|'role'|'rematch',_role?:RolePreference)=>{};onLeave=()=>{};onResults=()=>{};onPause=()=>{};onShop=()=>{};onCustom=(_type:string,_value:unknown)=>{};
  private kind:ObjectiveKind='last-stand';private fighter:FighterId='naruto';private faction:'heroes'|'villains'='heroes';private code='';private shopNotice='';
  constructor(private root:HTMLElement){
    this.setup.className='objective-setup';this.setup.setAttribute('aria-label','Choose your operation');
    this.shop.className='objective-shop';this.shop.setAttribute('aria-label','Village quartermaster');
    this.panel.className='objective-scrim hidden';this.panel.setAttribute('role','dialog');this.panel.setAttribute('aria-modal','true');this.panel.setAttribute('aria-label','Team match');
    this.hud.className='objective-hud hidden';this.hud.setAttribute('aria-label','Team status');this.respawn.className='objective-respawn hidden';this.respawn.setAttribute('role','status');
    this.respawn.innerHTML='<div class="objective-return-dial"><strong></strong></div><div class="objective-return-copy"><b></b><span></span><small></small></div>';
    this.shopPrompt.className='objective-shop-prompt hidden';this.shopPrompt.textContent='QUARTERMASTER · OPEN SHOP';this.shopPrompt.onclick=()=>this.openShop();root.addEventListener('click',e=>{if((e.target as Element).closest('[data-objective-shop]')){this.openShop();}});
    root.append(this.setup,this.shop,this.panel,this.hud,this.respawn,this.shopPrompt,this.levelHud.root);
    this.setup.addEventListener('close',()=>{this.editing=false;this.returnFocus?.focus({preventScroll:true});});
    this.setup.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
      if(b.dataset.close!==undefined){this.setup.close();return;}
      this.code=this.setup.querySelector<HTMLInputElement>('input')?.value.trim()??this.code;
      if(b.dataset.faction){this.faction=b.dataset.faction as typeof this.faction;if(factionOf(this.fighter)!==this.faction)this.fighter=this.faction==='heroes'?'goku':'dio';this.drawSetup();return;}
      if(b.dataset.fighter){this.fighter=b.dataset.fighter as FighterId;const label=this.setup.querySelector('[data-selected-name]');if(label)label.textContent=FIGHTERS[this.fighter].name;this.setup.querySelectorAll('[data-fighter]').forEach(el=>el.setAttribute('aria-pressed',String((el as HTMLElement).dataset.fighter===this.fighter)));return;}
      if(b.dataset.access){const access=b.dataset.access as ObjectiveAccess;if(access==='join'&&!/^\d{6}$/.test(this.code)){this.error('Enter the 6-digit room code.');return;}this.error('');this.onStart({kind:'objective',objective:this.kind,access,role:this.kind==='bad-blood'?factionOf(this.fighter):'defenders',fighter:this.fighter,code:this.code});}
    });
    this.panel.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
      if(b.dataset.command)this.onCommand(b.dataset.command as 'start'|'rematch');if(b.dataset.fill!==undefined)this.onCustom('objective-fill',b.dataset.fill==='true');if(b.dataset.leave!==undefined)this.onLeave();
      if(b.dataset.copy!==undefined&&this.view?.code){const url=new URL(location.href);url.hash=new URLSearchParams({mode:this.view.kind,room:this.view.code}).toString();const copy=(link:string)=>navigator.clipboard.writeText(link);void (inPlayerTwo()?inviteLink({mode:this.view.kind,room:this.view.code},url.href).then(copy):copy(url.href)).then(()=>b.textContent='COPIED').catch(()=>{b.textContent=this.view!.code!;});}
    });
    this.shop.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('button');if(b?.dataset.close!==undefined)this.shop.close();if(b?.dataset.buy)this.onCustom('objective-buy',b.dataset.buy);});
    for(const surface of [this.panel,this.shop])surface.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const items=this.items(),i=items.indexOf(document.activeElement as HTMLElement);if(!items.length)return;if(e.shiftKey&&i<=0){items.at(-1)!.focus();e.preventDefault();}else if(!e.shiftKey&&i===items.length-1){items[0].focus();e.preventDefault();}});
    const invite=new URLSearchParams(location.hash.slice(1)),mode=invite.get('mode'),code=invite.get('room');if(isObjectiveKind(mode)&&code&&/^\d{6}$/.test(code))queueMicrotask(()=>this.open(mode,code));
  }
  open(kind:ObjectiveKind,code='',fighter:FighterId='naruto'){this.kind=kind;this.code=code;this.fighter=kind==='bad-blood'&&!isBadBloodFighter(fighter)?'goku':fighter;this.faction=factionOf(fighter);this.returnFocus=document.activeElement as HTMLElement;this.drawSetup();if(!this.setup.open)this.setup.showModal();this.setup.querySelector<HTMLElement>(code?'input':'[data-access]')?.focus();}
  private drawSetup(){
    const stand=this.kind==='last-stand';this.setup.dataset.mode=this.kind;
    this.setup.innerHTML=`<button class="objective-close" data-close aria-label="Close">×</button>
      <div class="objective-cover" style="background-image:url('/assets/ui/objectives/${this.kind}-deployment.webp')">
        <div class="objective-cover-copy"><small>${stand?'THE HIDDEN LEAF · ENDLESS DEFENCE':'THE FALLEN CITADEL · TEAM ELIMINATION'}</small><h2>${stand?'LAST<br>STAND':'BAD<br>BLOOD'}</h2><p>${stand?'Every gate has a last defender.':'Their power. Your fighting spirit.'}</p></div>
        <div class="objective-select"><div class="objective-select-heading"><span>YOUR FIGHTER</span><b data-selected-name>${escape(FIGHTERS[this.fighter].name)}</b></div>
        ${!stand?`<nav class="objective-roles" aria-label="Choose faction"><button data-faction="heroes" aria-pressed="${this.faction==='heroes'}">HEROES <span>${RULES.heroReviveSeconds}s RETURN</span></button><button data-faction="villains" aria-pressed="${this.faction==='villains'}">VILLAINS <span>${RULES.villainMultiplier}× POWER</span></button></nav>`:''}
        <div class="objective-picks" role="group" aria-label="Choose fighter">${HOME_ROSTER.filter(f=>isReleasedFighter(f)&&(stand||isBadBloodFighter(f)&&factionOf(f)===this.faction)).map(f=>`<button data-fighter="${f}" aria-label="${escape(FIGHTERS[f].name)}" aria-pressed="${f===this.fighter}"><span>${mangaPortrait(f)}</span><b>${escape(FIGHTERS[f].name)}</b></button>`).join('')}</div></div>
      </div>
      <div class="objective-setup-body"><small>OPERATION BRIEFING</small><h3>${stand?'HOLD THE LINE.':'CHOOSE YOUR SIDE.'}</h3><p>${stand?'Defend the village against an escalating siege. Fight together. Build your defences. Survive one more wave.':'Three Heroes against three empowered Villains. Eliminate the opposing team to win.'}</p>
      <ol class="objective-rules">${stand?'<li><b>1–4 DEFENDERS</b><span>Go alone, bring your friends or join a squad.</span></li><li><b>ONE SHARED WAR CHEST</b><span>Kills fund village defences. Your own damage and KOs level you up automatically; full health every 5 levels.</span></li><li><b>EVERY LIFE MATTERS</b><span>Stand beside a fallen ally to revive. Lose the village or the whole squad, and the stand ends.</span></li>':`<li><b>VILLAINS · ${RULES.villainMultiplier}× POWER</b><span>Boosted stats. One life.</span></li><li><b>HEROES · ${RULES.heroReviveSeconds}s RETURN</b><span>One automatic revival each. A team wipe still ends the match.</span></li>`}</ol>
      <div class="objective-options"><button class="deploy-primary" data-access="bots">PLAY NOW <span>Local match · no server needed</span><i>→</i></button><button data-access="quick">${stand?'FIND A SQUAD':'ONLINE MATCH'}<span>${stand?'Play with other defenders':'Match with other players'}</span></button><button data-access="host">HOST FRIENDS<span>Private room · share an invitation</span></button>${stand?'<button class="deploy-alone" data-access="solo">LONE DEFENDER <span>Just you. No second chance.</span></button>':''}</div>
      <div class="objective-join"><input aria-label="Team room code" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="6-DIGIT ROOM CODE" value="${escape(this.code)}"><button data-access="join">JOIN →</button></div><p class="objective-error" role="status"></p></div>`;
  }
  get setupOpen(){return this.setup.open;}
  closeSetup(){if(this.shop.open){this.shop.close();return true;}if(!this.setup.open)return false;this.setup.close();return true;}
  busy(on:boolean){this.setup.querySelectorAll<HTMLButtonElement>('[data-access]').forEach(b=>b.disabled=on);if(on)this.error('Preparing your match…');}
  error(message:string){const el=this.setup.querySelector('.objective-error');if(el)el.textContent=message;}
  get blocking(){return this.setup.open||this.shop.open||!this.panel.classList.contains('hidden');}
  finale=()=>false;
  get resultsOpen(){return this.view?.phase==='over'&&!this.panel.classList.contains('hidden');}
  reset(){this.levelHud.hide();this.setup.close();this.shop.close();this.panel.classList.add('hidden');this.hud.classList.add('hidden');this.respawn.classList.add('hidden');this.shopPrompt.classList.add('hidden');this.view=undefined;this.status.reset();this.key='';this.resultKey='';delete this.root.dataset.objective;}
  watching(player:PlayerState|undefined,count:number){this.watched=player;this.watchCount=count;}
  update(snapshot:GameSnapshot,id:string){
    const v=objectiveOf(snapshot);if(!v){if(this.view)this.reset();return;}this.view=v;this.snapshot=snapshot;this.ownId=id;
    if(this.root.dataset.hud&&v.phase==='active')delete this.root.dataset.objective;else this.root.dataset.objective=v.kind;this.levelHud.update(v,id,snapshot.serverTime);
    const self=snapshot.players.find(p=>p.id===id),seat=v.seats.find(s=>s.id===id),now=snapshot.serverTime,waiting=v.phase==='lobby'||v.phase==='countdown',ended=v.phase==='over',over=ended&&!this.finale();
    this.hud.classList.toggle('hidden',waiting||ended);this.panel.classList.toggle('hidden',!waiting&&!over);this.respawn.classList.toggle('hidden',waiting||ended||!!self?.alive);
    const nearShop=v.kind==='last-stand'&&v.phase==='active'&&!!self?.alive&&Math.hypot(self.x-VILLAGE.shop.x,self.z-VILLAGE.shop.z)<=VILLAGE.shop.radius&&Math.abs(self.y)<3;
    this.shopPrompt.classList.toggle('hidden',!nearShop);const shopLabel=`${this.root.dataset.input==='controller'?`[ ${padName((this.root.dataset.pad??'generic') as PadFamily,actionControl('jump'))} ] SHOP`:ACTIONS.some(a=>boundTo(a,'KeyB'))?'OPEN SHOP':'[ B ] SHOP'} · SHARED FUNDS`;if(this.shopPrompt.textContent!==shopLabel)this.shopPrompt.textContent=shopLabel;this.root.querySelector('[data-objective-shop]')?.classList.toggle('hidden',!nearShop);if(this.shop.open){if(!nearShop)this.shop.close();else this.drawShop();}
    if(!self?.alive){
      const rescue=seat?.rescue??0,seconds=Math.max(0,(seat?.reviveAt??now)-now),stand=v.kind==='last-stand';
      const text=(selector:string,value:string)=>{const el=this.respawn.querySelector(selector)!;if(el.textContent!==value)el.textContent=value;};
      this.respawn.style.setProperty('--return-progress',`${stand?rescue*100:seat?.reviveAt?Math.max(0,Math.min(1,1-seconds/RULES.heroReviveSeconds))*100:0}%`);
      this.respawn.dataset.state=stand?'rescue':seat?.reviveAt?'return':'out';
      text('strong',stand?`${Math.floor(rescue*100)}%`:seat?.reviveAt?seconds.toFixed(1):'×');
      text('b',stand?(rescue>0?'ALLY REVIVING YOU':'DOWN · ALLY NEEDED'):seat?.reviveAt?'FIGHTING SPIRIT':'ELIMINATED');
      text('span',stand?'An ally must stay beside you.':seat?.reviveAt?'Keep one Hero standing until your return.':'Your team is still fighting.');
      const watching=this.watched?`WATCHING ${escape(displayName(this.watched).toUpperCase())}${this.watchCount>1?` · <span class="ux-keys">${promptKey('target')}</span> NEXT`:''}`:'';
      if(watching!==this.watchLine){this.watchLine=watching;this.respawn.querySelector('small')!.innerHTML=watching;}
    }
    if(waiting||over){const key=JSON.stringify([v.phase,v.round,v.hostId,v.seats,v.winner,v.fillBots,v.party,v.autoStart]);if(key!==this.key){const focused=(document.activeElement as HTMLElement)?.dataset.focus;this.key=key;this.panel.classList.toggle('deploying',v.phase==='countdown');this.panel.innerHTML=over?objectiveResults(v,snapshot,id):v.phase==='countdown'?`<div class="operation-entry"><small>${OBJECTIVE_NAMES[v.kind]}</small><b data-countdown></b><span>${v.kind==='last-stand'?'Defend the village. Revive your allies. Repair at the shop inside the gate.':`Eliminate the other team. Heroes return once in ${RULES.heroReviveSeconds} seconds. A team wipe ends the match.`}</span></div>`:this.lobby(v,id);this.panel.querySelector<HTMLElement>(focused?`[data-focus="${focused}"]`:'button')?.focus({preventScroll:true});}
      const countdown=this.panel.querySelector('[data-countdown]');if(countdown){const clock=v.startsAt!==null?((n:number)=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`)(Math.max(1,Math.ceil(v.startsAt-now))):'';
        if(v.phase==='countdown'&&clock){const html=`DEPLOYING<em> · ${clock}</em>`;if(countdown.innerHTML!==html)countdown.innerHTML=html;}
        else{const text=clock?`${v.party?'YOUR PARTY IS IN':'GATHERING PLAYERS'} · ${clock}`:v.party&&v.autoStart?'DEPLOYS ONCE YOUR PARTY IS IN':'READY WHEN YOU ARE';if(countdown.textContent!==text)countdown.textContent=text;}}
      if(over&&this.resultKey!==`${v.kind}:${v.round}`){this.resultKey=`${v.kind}:${v.round}`;document.exitPointerLock?.();this.onResults();}return;}
    if(ended)return;
    this.status.update(v,snapshot,id);
  }
  private roster(v:ObjectiveView){const teams=v.kind==='last-stand'?['defenders'] as const:['heroes','villains'] as const;return `<div class="objective-rosters ${v.kind==='last-stand'?'single':''}">${teams.map(t=>`<div class="objective-team ${t}"><h3>${TEAM_NAMES[t]}</h3>${v.seats.filter(s=>s.team===t).map(s=>`<div class="objective-seat"><span class="objective-face">${mangaPortrait(s.fighter)}</span><div><b>${escape(displayName(s))}${s.id===this.ownId?' · YOU':''}</b><small>${displayName(s).toLowerCase()===FIGHTERS[s.fighter].name.toLowerCase()?'':FIGHTERS[s.fighter].name+' · '}${s.disconnected?'RECONNECTING':s.bot?'BOT':'PLAYER'}</small></div></div>`).join('')}${Array.from({length:Math.max(0,(t==='defenders'?4:3)-v.seats.filter(s=>s.team===t).length)},()=>'<div class="objective-seat empty">＋ OPEN SEAT</div>').join('')}</div>`).join('')}</div>`;}
  private lobby(v:ObjectiveView,id:string){const host=v.hostId===id;return `<div class="objective-sheet"><header><small>${v.party?'PARTY OPERATION':v.access==='host'?'PRIVATE OPERATION':'SQUAD ASSEMBLING'}</small><h2>${OBJECTIVE_NAMES[v.kind]}</h2><span>${v.kind==='last-stand'?'HOLD THE LEAF. SPEND TOGETHER. FALL TOGETHER.':'THREE HEROES. THREE VILLAINS. NO RETREAT.'}</span></header>${v.code&&v.access==='host'&&!v.party?`<div class="objective-room"><b>${v.code}</b><button data-copy data-focus="copy">COPY INVITE</button></div>`:''}${this.roster(v)}${host&&v.kind==='last-stand'&&v.phase==='lobby'&&!v.autoStart?`<div class="objective-roles"><button data-fill="false" aria-pressed="${!v.fillBots}">CURRENT SQUAD ONLY</button><button data-fill="true" aria-pressed="${v.fillBots}">FILL WITH BOTS</button></div>`:''}<div class="objective-countdown" data-countdown></div><p class="objective-error" data-notice role="status"></p><footer>${host&&v.phase==='lobby'&&!v.autoStart?'<button class="objective-primary" data-command="start" data-focus="start">DEPLOY SQUAD →</button>':''}<button data-leave data-focus="leave">RETURN HOME</button></footer></div>`;}
  private results(v:ObjectiveView,snapshot:GameSnapshot,id:string){
    const own=v.seats.find(s=>s.id===id),won=v.winner===own?.team,stand=v.kind==='last-stand';
    const reason=stand?v.reason:v.winner==='draw'?'Both teams fell at the same time.':`${TEAM_NAMES[v.winner==='heroes'?'villains':'heroes']} eliminated. ${TEAM_NAMES[v.winner??'draw']} win.`;
    const rows=v.seats.map(s=>({s,p:snapshot.players.find(p=>p.id===s.id)})).sort((a,b)=>(b.p?.damageDealt??0)-(a.p?.damageDealt??0));
    return `<div class="objective-sheet objective-result" data-result-mode="${v.kind}">
      <header class="objective-result-hero"><small>${OBJECTIVE_NAMES[v.kind]} · ${clock(v.endsAt-v.startedAt)}</small><h2>${stand?'THE LEAF<br>REMEMBERS.':v.winner==='draw'?'NO VICTOR.':won?'VICTORY.':'DEFEAT.'}</h2><div class="objective-result-stamp">${stand?`<small>LAST WAVE</small><b>${v.village?.wave??0}</b>`:`<small>THE WINNING SIDE</small><b>${TEAM_NAMES[v.winner??'draw']}</b>`}</div><p>${escape(reason)}</p></header>
      <div class="objective-result-body">${!stand?this.bloodResults(v,snapshot,id):`<div class="objective-result-squad">${rows.map(({s,p},i)=>`<article class="${s.team}${s.id===id?' is-you':''}"><div class="result-portrait">${mangaPortrait(s.fighter)}<span>${s.id===id?'YOU':s.bot?'BOT':TEAM_NAMES[s.team]}</span></div><b>${escape(displayName(s))}</b>${displayName(s).toLowerCase()===FIGHTERS[s.fighter].name.toLowerCase()?'':`<small>${FIGHTERS[s.fighter].name}</small>`}<strong>${(p?.damageDealt??0)>0&&i===0?'VANGUARD':s.revives>0?'LIFELINE':s.spent>0?'BUILDER':'DEFENDER'}</strong></article>`).join('')}</div>
      <div class="objective-contribution-heading"><b>THE SQUAD’S CONTRIBUTION</b><span>Ranked by damage dealt</span></div><div class="objective-table-wrap"><table class="objective-leaderboard"><thead><tr><th>FIGHTER</th><th>KOs</th><th>DAMAGE</th>${stand?'<th>LEVEL</th><th>BOSSES</th><th>REVIVES</th><th>RESCUES</th><th>SUPPLIES</th><th>EARNED</th><th>SPENT</th><th>REPAIRED</th>':'<th>TEAM</th>'}</tr></thead><tbody>${rows.map(({s,p},i)=>`<tr${s.id===id?' class="is-you"':''}><th><span>${String(i+1).padStart(2,'0')}</span>${escape(displayName(s))}</th><td>${p?.kills??0}</td><td>${Math.round(p?.damageDealt??0).toLocaleString()}</td>${stand?`<td>${s.progress?.level??1}</td><td>${s.bosses}</td><td>${s.revives}</td><td>${s.rescues??0}</td><td>${s.supplies??0}</td><td>${Math.round(s.points)}</td><td>${s.spent}</td><td>${Math.round(s.repairs)}</td>`:`<td>${TEAM_NAMES[s.team]}</td>`}</tr>`).join('')}</tbody></table></div>
      <div class="objective-run-total"><div><b>${v.village?.kills??0}</b><span>ENEMIES DEFEATED</span></div><div><b>${v.village?.bosses??0}</b><span>BOSSES BROKEN</span></div><div><b>${Math.round(v.village?.damageBlocked??0).toLocaleString()}</b><span>DAMAGE BLOCKED BY WARDS</span></div></div>`}
      <footer>${v.hostId===id?'<button class="objective-primary" data-command="rematch" data-focus="rematch">MAKE ANOTHER STAND →</button>':'<span>Waiting for host to rematch</span>'}<button data-leave>RETURN HOME</button></footer></div></div>`.replace('MAKE ANOTHER STAND',stand?'MAKE ANOTHER STAND':'RUN IT BACK');
  }
  private bloodResults(v:ObjectiveView,snapshot:GameSnapshot,id:string){
    return `<div class="blood-result-teams">${(['heroes','villains'] as const).map(team=>{
      const rows=v.seats.filter(s=>s.team===team).map(s=>({s,p:snapshot.players.find(p=>p.id===s.id)})).sort((a,b)=>(b.p?.kills??0)-(a.p?.kills??0)||(b.p?.damageDealt??0)-(a.p?.damageDealt??0));
      const damage=rows.reduce((n,r)=>n+(r.p?.damageDealt??0),0),winner=v.winner===team;
      return `<section class="blood-result-team ${team}${winner?' is-winner':''}"><header><div><small>${winner?'VICTORIOUS':v.winner==='draw'?'DRAW':'ELIMINATED'}</small><h3>${TEAM_NAMES[team]}</h3></div><span><b>${Math.round(damage).toLocaleString()}</b> TEAM DAMAGE</span></header>${rows.map(({s,p})=>{
        const state=p?.alive?'STANDING':s.reviveAt!==undefined?'RETURN INTERRUPTED':'ELIMINATED';
        const spirit=team==='heroes'?(s.revivesLeft>0?'Spirit unspent':s.reviveAt!==undefined?'Wiped before return':'Fighting spirit used'):`${RULES.villainMultiplier}× power`;
        const name=displayName(s);
        const identity=name.toLowerCase()===FIGHTERS[s.fighter].name.toLowerCase()?'':`<small>${escape(FIGHTERS[s.fighter].name)}</small>`;
        return `<article class="${s.id===id?'is-you':''}"><div class="result-portrait">${mangaPortrait(s.fighter)}<span>${s.id===id?'YOU':s.bot?'BOT':'PLAYER'}</span></div><div class="blood-result-player"><b>${escape(name)}</b>${identity}<span class="${p?.alive?'standing':'fallen'}">${state}</span><em>${spirit}</em></div><div class="blood-result-numbers"><b>${p?.kills??0}<small>KOs</small></b><b>${Math.round(p?.damageDealt??0).toLocaleString()}<small>DAMAGE</small></b></div></article>`;
      }).join('')}</section>`;
    }).join('')}</div>`;
  }
  openShop(){if(this.shopPrompt.classList.contains('hidden'))return;this.onShop();document.exitPointerLock?.();this.shopKey='';this.shopNotice='';this.drawShop();this.shop.showModal();}
  interact(){if(this.blocking||this.shopPrompt.classList.contains('hidden'))return false;this.openShop();return true;}
  private drawShop(){
    const v=this.view?.village;if(!v)return;
    const key=JSON.stringify([v.points,v.upgrades,v.hp>=v.maxHp,v.chapter?.id]);if(key===this.shopKey)return;this.shopKey=key;
    const focused=(document.activeElement as HTMLElement)?.dataset.buy;
    const trapColumn=['wire','purify','harpoon','discharge'].indexOf(v.chapter?.trap??'wire');
    this.shop.innerHTML=`<button class="objective-close" data-close aria-label="Close shop">×</button><header><small>HIDDEN LEAF · VILLAGE DEFENCES</small><h2>THE QUARTERMASTER</h2><p>${v.chapter?`${v.chapter.title} · ${TRAP_THEMES[v.chapter.trap].combo}`:'Hold the gates. Spend together.'}</p><div class="objective-wallet"><small>SHARED SQUAD FUNDS</small><b>◈ ${v.points.toLocaleString()}</b></div></header>
      <div class="objective-shop-items">${(Object.entries(DEFENCES) as [DefenceId,typeof DEFENCES[DefenceId]][]).map(([id,d],i)=>{const tier=v.upgrades[id],cost=Math.round(d.cost*(1+tier*.6)),maxed=!!d.max&&tier>=d.max,full=id==='repair'&&v.hp>=v.maxHp,disabled=maxed||v.points<cost||full;return `<button data-buy="${id}"${disabled?' disabled':''}><span class="defence-art${id==='traps'||id==='charges'?' chapter-trap-art':''}" style="background-position:${id==='traps'||id==='charges'?`${trapColumn/3*100}% ${id==='traps'?0:100}%`:`${Math.min(i,4)*25}% center`}"></span><span class="defence-details"><small>${d.max?`TIER ${tier} / ${d.max}`:'VILLAGE REPAIR'}</small><b>${id==='traps'&&v.chapter?TRAP_THEMES[v.chapter.trap].snare:id==='charges'&&v.chapter?TRAP_THEMES[v.chapter.trap].payload:d.name}</b><span>${d.description}</span><strong>${maxed?'FULLY UPGRADED':full?'VILLAGE AT FULL HEALTH':`◈ ${cost.toLocaleString()}`}</strong><em>${maxed||full?'READY':v.points<cost?`NEED ${(cost-v.points).toLocaleString()} MORE`:'PURCHASE →'}</em></span></button>`;}).join('')}</div>
      <footer><span data-shop-notice role="status">${escape(this.shopNotice)}</span><small>The siege continues while you shop.</small><button data-close>BACK TO THE FIGHT →</button></footer>`;
    if(focused)this.shop.querySelector<HTMLElement>(`[data-buy="${focused}"]:not(:disabled)`)?.focus();
  }
  focus(){const items=this.items();if(!items.includes(document.activeElement as HTMLElement))items[0]?.focus();}
  notice(message:string){if(this.shop.open)this.shopNotice=message;const el=this.shop.open?this.shop.querySelector('[data-shop-notice]'):this.panel.querySelector('[data-notice]');if(el)el.textContent=message;}
  private items(){return [...(this.shop.open?this.shop:this.setup.open?this.setup:this.panel).querySelectorAll<HTMLElement>('button,input,select')].filter(el=>el.getBoundingClientRect().width>0&&!(el as HTMLButtonElement).disabled);}
  controllerAction(action:UiAction){if(!this.blocking)return false;const items=this.items(),active=document.activeElement as HTMLElement;if(this.editing){const code=this.setup.querySelector<HTMLInputElement>('input')!,digits=code.value.padEnd(6,'0').split('');if(action==='back'||action==='confirm'){this.editing=false;return true;}if(action==='left'||action==='right')this.digit=(this.digit+(action==='right'?1:5))%6;else digits[this.digit]=String((Number(digits[this.digit])+(action==='next'?1:9))%10);code.value=digits.join('');code.setSelectionRange(this.digit,this.digit+1);return true;}if(action==='back'){if(!this.closeSetup())this.onPause();return true;}if(!items.includes(active)){items[0]?.focus();return true;}if(action==='confirm'){if(active instanceof HTMLInputElement){this.editing=true;this.digit=0;active.value=active.value.padEnd(6,'0');active.setSelectionRange(0,1);}else active.click();return true;}const direction=({previous:'up',next:'down',left:'left',right:'right'} as Record<string,Direction>)[action];if(!direction)return true;const i=nearest(active.getBoundingClientRect(),items.map(el=>el.getBoundingClientRect()),direction);if(i>=0)items[i].focus();return true;}
}
