import { isReleasedFighter } from '../../game/rosterAvailability';
import {DIFFICULTIES,PARTY_ARENAS,PARTY_MAX,PARTY_MODES,PARTY_ORDER,ROYALE_SEATS,modeBlocked,partyCapacity,startCheck,voteCounts,type PartyArena,type PartyMember,type PartyMode,type PartyView} from '../../game/social/party';
import {DURATIONS,type Difficulty} from '../../game/social/custom';
import type {PartyClient} from '../../social/PartyClient';
import {FIGHTERS} from '../../config';
import {STAGES} from '../../game/stages';
import type {FighterId,StageId} from '../../game/types';
import {HELD,mayPlay} from '../../game/economy/fighters';
import {factionOf,isBadBloodFighter,RULES} from '../../game/objectives/model';
import {account} from '../shop/account';
import {inPlayerTwo,inviteLink} from '../../boot/playerTwo';
import {fighterCaption,HOME_VOLUMES,mangaPortrait} from '../MangaHome';
import {MODES,type ModeId} from '../modes/catalogue';
import type {UiAction} from '../../input/gamepad';
import {SocialDialog} from './Dialog';
import {discordButton,openDiscord} from './discord';
import '../inkSelect';
import './party.css';

export const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const INFO:Record<PartyMode,ModeId>={'rift-war':'rift-war',duel:'duel',royale:'royale','bad-blood':'bad-blood','last-stand':'last-stand',survival:'arcade'};
const SEATS:Record<PartyMode,string>={'rift-war':'5 V 5 · BOTS FILL',duel:'1 V 1',royale:'2–12 PLAYERS','bad-blood':'3 V 3 · BOTS FILL','last-stand':'1–4 DEFENDERS',survival:'1–4 PLAYERS'};
const CROWD=5;
const FIXED:Partial<Record<PartyMode,{name:string;scene:string;tag:string}>>={
  'rift-war':{name:STAGES['rift-war'].name,scene:STAGES['rift-war'].scene,tag:'THREE LANES'},
  'last-stand':{name:STAGES['hidden-leaf'].name,scene:STAGES['hidden-leaf'].scene,tag:'FIXED'},
  survival:{name:'The Rift',scene:'A new world every act, dealt by the run',tag:'SET BY THE RUN'},
};
const DIFFICULTY_NAMES:Record<Difficulty,string>={easy:'EASY',normal:'NORMAL',hard:'HARD'};
const time=(s:number)=>s?`${s/60} MIN`:'NO LIMIT';
const spaced=(code:string)=>`${code.slice(0,3)} ${code.slice(3)}`;

export function welcomeMarkup({joining='',connecting=false,code=''}:{joining?:string;connecting?:boolean;code?:string}={}){
  const busy=connecting||!!joining;
  return `<button type="button" class="pt-close" data-social-close aria-label="Close party">×</button>
      <div class="pt-welcome"><div class="pt-ink" aria-hidden="true">仲間<span>BRING YOUR CREW</span></div>
      <div class="pt-start"><small class="pt-kicker">PARTY · ONE CREW, EVERY MODE</small><h2 id="pt-title">PLAY TOGETHER</h2>
        <p>Duel a friend, or bring the whole crew: choose the mode and the place together, ready up, and stay together match after match.</p>
        ${joining?`<div class="pt-joining" role="status"><b>JOINING PARTY</b><span>${spaced(joining)}</span></div>`:`<button type="button" class="pt-go" data-party-create data-focus="go"${busy?' disabled':''}><span>${connecting?'CONNECTING…':'CREATE PARTY'}<small>YOU GET A CODE TO SHARE</small></span><i aria-hidden="true">▶</i></button>
        <form class="pt-join"><label for="party-code">JOIN A FRIEND'S PARTY</label><div><input id="party-code" data-party-code data-focus="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6-DIGIT CODE" autocomplete="off" value="${escape(code)}" required><button type="submit" data-focus="join"${busy?' disabled':''}>JOIN</button></div></form>`}
        ${discordButton()}
        <p class="pt-notice" data-party-notice role="status" aria-live="polite"></p></div></div>`;
}
export function partySkeleton(){
  return `<button type="button" class="pt-close" data-social-close aria-label="Close party">×</button><header class="pt-head" data-region="head"></header><section class="pt-match" data-region="match" aria-label="The match"></section><section class="pt-party" aria-label="The party"><div class="pt-scroll"><div data-region="roster"></div><div data-region="you"></div>${discordButton(true)}</div><p class="pt-notice" data-party-notice role="status" aria-live="polite"></p><footer class="pt-actions" data-region="action"></footer></section>`;
}

export function leaderCalled(view:Pick<PartyView,'members'|'leader'>,fallback='The leader'){const name=view.members.find(m=>m.id===view.leader)?.name?.trim();return !name||name==='Fighter'?fallback:name;}
export class PartyUI extends SocialDialog {
  private message='';private messageAt=0;private preparing=false;private code='';private joining='';
  private menu='';
  private picked:Partial<Record<PartyMode,StageId>>={};
  private drawn=new Map<string,string>();
  private shape='';
  private seen?:PartyView;
  private deferred=false;
  beforeReady:()=>Promise<void>=async()=>{};
  onFighter=(_fighter:FighterId)=>{};
  constructor(root:HTMLElement,readonly client:PartyClient){
    super(root,'Party');
    this.element.className='party-sheet';this.element.removeAttribute('aria-label');this.element.setAttribute('aria-labelledby','pt-title');
    client.onChange=()=>{this.changed();this.render();this.badge();};client.onNotice=m=>this.notice(m);
    this.element.addEventListener('input',e=>{const input=e.target as HTMLInputElement;if(input.dataset.partyCode!==undefined){input.value=input.value.replace(/\D/g,'').slice(0,6);this.code=input.value;}});
    this.element.addEventListener('submit',e=>{e.preventDefault();void this.join(this.code);});
    this.element.addEventListener('change',e=>{const pick=e.target as HTMLElement&{value:string};if(pick.dataset.partyFighter!==undefined&&pick.value)this.chooseFighter(pick.value as FighterId);});
    this.element.addEventListener('click',e=>{this.wantPrimary=false;this.click(e);});
    this.element.addEventListener('keydown',()=>{this.wantPrimary=false;},true);
    this.element.addEventListener('keydown',e=>{if(e.key==='Escape'&&this.menu){e.preventDefault();e.stopPropagation();this.closeMenu(true);}});
    this.element.addEventListener('cancel',e=>{if(this.menu){e.preventDefault();this.closeMenu(true);}});
    this.element.addEventListener('focusin',()=>{if(this.deferred)this.render();});
    account.on(()=>{if(this.client.joined)this.client.profileChanged();this.drawn.delete('you');if(this.open)this.render();});
    const invite=new URLSearchParams(location.hash.slice(1)).get('party');
    if(invite&&/^\d{6}$/.test(invite)){this.code=invite;this.joining=invite;queueMicrotask(()=>{this.show();void this.join(invite,true);});}
  }
  private badge(){const b=document.querySelector<HTMLButtonElement>('#home-party');if(b)b.textContent=this.client.view?`PARTY · ${this.client.view.members.length}`:'PARTY';}
  private wantPrimary=false;
  override show(){const was=this.open;this.render();super.show();if(!was){this.wantPrimary=true;this.focusPrimary();}}
  override close(){this.closeMenu(false);super.close();}
  private focusPrimary(){requestAnimationFrame(()=>{const go=this.element.querySelector<HTMLElement>('[data-focus="go"]:not(:disabled)');if(go&&this.wantPrimary&&this.open){go.focus({preventScroll:true});this.wantPrimary=false;}});}
  private get leader(){return !!this.client.view&&this.client.view.leader===this.client.id;}

  notice(message:string){
    this.message=message;this.messageAt=performance.now();
    const el=this.element.querySelector<HTMLElement>('[data-party-notice]');if(!el)return;
    el.textContent=message;el.classList.remove('pt-fresh');void el.offsetWidth;el.classList.toggle('pt-fresh',!!message);
  }
  private async join(code:string,invited=false){
    if(!/^\d{6}$/.test(code)){this.notice('Enter the six-digit party code.');return;}
    this.joining=code;this.render();
    try{await this.client.connect(code);}finally{this.joining='';}
    if(invited&&location.hash.includes('party='))history.replaceState(null,'',location.pathname+location.search);
    if(!this.client.joined&&invited)this.notice(this.message||'That party is not open any more. Ask for a new invite.');
    this.wantPrimary=true;this.render();
  }
  private chooseFighter(fighter:FighterId){
    const own=this.client.view?.members.find(m=>m.id===this.client.id);if(!own||own.fighter===fighter||!FIGHTERS[fighter])return;
    this.onFighter(fighter);
  }
  private click(e:Event){
    const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b||b.disabled)return;
    const d=b.dataset,c=this.client;
    if(d.partyDiscord!==undefined){openDiscord();return;}
    if(d.partyMenu!==undefined){this.menu=this.menu===d.partyMenu?'':d.partyMenu;this.render();this.element.querySelector<HTMLElement>(this.menu?`[data-focus="menu-leader-${this.menu}"]`:`[data-focus="more-${d.partyMenu}"]`)?.focus({preventScroll:true});return;}
    if(d.partyCreate!==undefined)void c.connect().then(()=>{this.wantPrimary=true;this.render();});
    else if(d.partyLeave!==undefined){void c.leave();this.message='';this.menu='';}
    else if(d.partyReady!==undefined)void this.ready();
    else if(d.partyLaunch!==undefined)void this.launch();
    else if(d.partyReturn!==undefined)c.send('party-return');
    else if(d.partyMode)c.send('party-mode',d.partyMode);
    else if(d.partyArena){const view=c.view;if(!view)return;const arena=d.partyArena as PartyArena|'pick';
      if(view.rules.arena==='vote'&&arena!=='random'&&arena!=='vote'&&arena!=='pick'){c.send('party-vote',arena);return;}
      if(!this.leader)return;
      const named=arena==='pick'?(this.picked[view.mode]??(view.rules.arena!=='random'&&view.rules.arena!=='vote'?view.rules.arena:PARTY_ARENAS[view.mode][0])):arena;
      if(named!=='random'&&named!=='vote')this.picked[view.mode]=named as StageId;
      c.send('party-rules',{arena:named});}
    else if(d.partyRule){const value=d.value!,rule=d.partyRule;c.send('party-rules',{[rule]:rule==='difficulty'?value:rule==='fill'?value==='true':Number(value)});}
    else if(d.partyLeader){this.menu='';c.send('party-leader',d.partyLeader);}
    else if(d.partyKick){this.menu='';c.send('party-kick',d.partyKick);}
    else if(d.partyCopy!==undefined&&c.view){const url=new URL(location.href);url.hash='party='+c.view.code;const code=c.view.code;
      const copy=(link:string)=>navigator.clipboard.writeText(link);
      void (inPlayerTwo()?inviteLink({party:code},url.href).then(copy):copy(url.href)).then(()=>this.notice('Invite link copied. Send it to your friends.')).catch(()=>this.notice(`Share the party code ${spaced(code)}.`));}
  }
  private closeMenu(refocus:boolean){if(!this.menu)return;const id=this.menu;this.menu='';this.render();if(refocus)this.element.querySelector<HTMLElement>(`[data-focus="more-${id}"]`)?.focus({preventScroll:true});}
  override controller(action:UiAction){if(this.open&&action==='back'&&this.menu){this.closeMenu(true);return true;}return super.controller(action);}

  private async ready(){
    const view=this.client.view,own=view?.members.find(m=>m.id===this.client.id);if(!view||!own||this.preparing)return;
    if(own.ready){this.client.send('party-ready',false);return;}
    const key=JSON.stringify([view.mode,view.rules.players,own.fighter]);this.preparing=true;this.render();
    try{await this.beforeReady();const next=this.client.view,m=next?.members.find(m=>m.id===this.client.id);if(next&&m&&key===JSON.stringify([next.mode,next.rules.players,m.fighter]))this.client.send('party-ready',true);else this.notice('The party changed. Check the match and ready up again.');}
    catch{this.notice('Could not load your fighter. Press READY to retry.');}finally{this.preparing=false;this.render();}
  }
  private async launch(){
    if(this.preparing||!this.client.view)return;this.preparing=true;this.render();
    try{await this.beforeReady();if(this.leader&&!startCheck(this.client.view).reason)this.client.send('party-launch');}
    catch{this.notice('Could not load your fighter. Press START to retry.');}finally{this.preparing=false;this.render();}
  }

  private changed(){
    const prev=this.seen,next=this.client.view;this.seen=next?structuredClone(next):undefined;
    if(!prev||!next||prev.code!==next.code)return;
    const me=this.client.id,leader=leaderCalled(next),mine=next.leader===me&&prev.leader===me;
    const names=(list:PartyMember[])=>list.map(m=>m.name).join(', ');
    const joined=next.members.filter(m=>!prev.members.some(p=>p.id===m.id)),left=prev.members.filter(m=>!next.members.some(n=>n.id===m.id));
    let line='';
    if(prev.leader!==next.leader)line=next.leader===me?'You lead the party now: you choose the match and START it.':leader==='The leader'?'The party has a new leader.':`${leader} leads the party now.`;
    else if(joined.length)line=`${names(joined)} joined the party.`;
    else if(left.length)line=`${names(left)} left the party.`;
    else if(mine)return;
    else if(prev.mode!==next.mode)line=`${leader} chose ${PARTY_MODES[next.mode]}. Ready up again.`;
    else if(prev.rules.arena!==next.rules.arena){const a=next.rules.arena;line=a==='random'?`${leader} made the location random.`:a==='vote'?`${leader} opened a vote: tap the place you want.`:`${leader} chose ${STAGES[a].name}.`;}
    else if(prev.rules.players!==next.rules.players)line=`${leader} set ${next.rules.players} fighters. Ready up again.`;
    else if(prev.rules.difficulty!==next.rules.difficulty)line=`${leader} set the bots to ${DIFFICULTY_NAMES[next.rules.difficulty]}.`;
    else if(prev.rules.seconds!==next.rules.seconds)line=`${leader} set the time limit: ${time(next.rules.seconds).toLowerCase()}.`;
    else if(prev.rules.fill!==next.rules.fill)line=next.rules.fill?`${leader} brought bot allies to fill the squad.`:`${leader} set the squad to friends only.`;
    if(line)this.notice(line);
  }

  render(){
    const view=this.client.view;
    if(!view){this.menu='';this.welcome();return;}
    const shape='party';
    if(this.shape!==shape){this.shape=shape;this.drawn.clear();
      this.element.innerHTML=partySkeleton();
      this.notice(this.message);}
    this.element.dataset.role=this.leader?'leader':'member';this.element.dataset.mode=view.mode;
    this.patch('head',this.head(view));this.patch('match',this.match(view));this.patch('roster',this.roster(view));this.patch('you',this.you(view));this.patch('action',this.action(view));
    if(this.wantPrimary)this.focusPrimary();
    if(this.message&&performance.now()-this.messageAt>9000){this.message='';const el=this.element.querySelector('[data-party-notice]');if(el)el.textContent='';}
  }
  private patch(name:string,html:string){
    const el=this.element.querySelector<HTMLElement>(`[data-region="${name}"]`);if(!el||this.drawn.get(name)===html)return;
    if([...el.querySelectorAll<HTMLElement&{open?:boolean}>('ink-select')].some(s=>s.open)){this.deferred=true;setTimeout(()=>{if(this.deferred)this.render();},400);return;}
    if(name==='you')this.deferred=false;
    const active=el.contains(document.activeElement)?(document.activeElement as HTMLElement).closest<HTMLElement>('[data-focus]')?.dataset.focus:undefined;
    el.innerHTML=html;this.drawn.set(name,html);
    if(active)el.querySelector<HTMLElement>(`[data-focus="${active}"]`)?.focus({preventScroll:true});
  }

  private welcome(){
    this.shape='welcome';this.drawn.clear();
    const active=this.element.contains(document.activeElement)?(document.activeElement as HTMLElement).dataset.focus:undefined;
    this.element.dataset.role='guest';delete this.element.dataset.mode;
    this.element.innerHTML=welcomeMarkup({joining:this.joining,connecting:this.client.connecting,code:this.code});
    this.notice(this.message);if(this.wantPrimary)this.focusPrimary();
    if(active)this.element.querySelector<HTMLElement>(`[data-focus="${active}"]`)?.focus({preventScroll:true});
  }

  private head(view:PartyView){
    const open=Math.max(0,partyCapacity(view.mode,view.rules)-view.members.length),wide=open>0;
    return `<div class="pt-title"><small class="pt-kicker">PARTY OF ${view.members.length}</small><h2 id="pt-title">PLAY TOGETHER</h2></div>
      <div class="pt-invite${wide?' pt-open':''}"><span class="pt-code"><small>PARTY CODE</small><b>${spaced(view.code)}</b></span><button type="button" class="pt-copy" data-party-copy data-focus="copy">COPY INVITE</button>${wide?`<small class="pt-seats">${open} SEAT${open===1?'':'S'} OPEN</small>`:''}</div>
      ${this.client.online?'':'<span class="pt-offline" role="status">RECONNECTING…</span>'}`;
  }

  private match(view:PartyView){
    const lead=this.leader,editable=lead&&!view.launching&&view.members.every(m=>m.status==='home')&&this.client.online,info=MODES[INFO[view.mode]];
    const by=leaderCalled(view);
    const head=`<h3>THE MATCH <small>${lead?'YOU CHOOSE':`${escape(by)} CHOOSES`}</small></h3>`;
    if(!lead){
      const facts=this.facts(view).map(f=>`<span>${escape(f)}</span>`).join('');
      return `${head}<div class="pt-summary" style="--art:url('/assets/home/modes/${info.art}.webp')"><span class="pt-summary-art" aria-hidden="true"></span><div><small>MODE</small><b>${PARTY_MODES[view.mode]}</b><p>${escape(info.goal)}</p></div></div>
        <h4>LOCATION</h4>${this.where(view,false)}${facts?`<h4>RULES</h4><div class="pt-chips">${facts}</div>`:''}`;
    }
    const cards=PARTY_ORDER.map(mode=>{const blocked=view.mode===mode?undefined:modeBlocked(mode,view.members.length),art=MODES[INFO[mode]].art;
      return `<button type="button" class="pt-mode" role="radio" aria-checked="${view.mode===mode}" data-party-mode="${mode}" data-focus="mode-${mode}"${blocked||!editable?' disabled':''}><span class="pt-mode-art" style="background-image:url('/assets/home/modes/${art}.webp')" aria-hidden="true"></span><b>${PARTY_MODES[mode]}</b><small>${blocked??SEATS[mode]}</small></button>`;}).join('');
    return `${head}<div class="pt-modes" role="radiogroup" aria-label="Mode">${cards}</div><p class="pt-goal"><b>${PARTY_MODES[view.mode]}</b> ${escape(info.goal)}</p>
      <h4>LOCATION</h4>${this.where(view,editable)}${this.rules(view,editable)}`;
  }
  private facts(view:PartyView){
    if(view.mode==='rift-war')return ['5 HEROES V 5 VILLAINS · BOTS FILL','THREE LANES · RESPAWNS · DESTROY THE CORE'];
    if(view.mode==='royale')return [`${view.rules.players} FIGHTERS · BOTS FILL EMPTY SEATS`,`${DIFFICULTY_NAMES[view.rules.difficulty]} BOTS`,view.rules.seconds?`${time(view.rules.seconds)} TIME LIMIT`:'LAST FIGHTER STANDING'];
    if(view.mode==='bad-blood')return ['3 HEROES V 3 VILLAINS · BOTS FILL',`${DIFFICULTY_NAMES[view.rules.difficulty]} BOTS`];
    if(view.mode==='duel')return ['FIRST TO TWO ROUNDS','PLAY AGAIN FOR A RUNBACK'];
    if(view.mode==='last-stand')return ['UP TO 4 DEFENDERS',view.rules.fill?`BOTS FILL THE SQUAD · ${DIFFICULTY_NAMES[view.rules.difficulty]}`:'FRIENDS ONLY','ENDLESS WAVES'];
    return ['UP TO 4 PLAYERS','FALLEN FRIENDS CAN BE REVIVED'];
  }
  private where(view:PartyView,editable:boolean){
    const fixed=FIXED[view.mode];
    if(fixed)return `<div class="pt-stages pt-one"><div class="pt-stage pt-fixed" aria-pressed="true"><b>${escape(fixed.name.toUpperCase())}</b><small>${escape(fixed.scene)}</small><em>${fixed.tag}</em></div></div>`;
    const pool=PARTY_ARENAS[view.mode],arena=view.rules.arena,vote=arena==='vote',random=arena==='random',counts=vote?voteCounts(view):undefined,mine=view.votes[this.client.id];
    const lead=this.leader,stage=(id:StageId)=>{const on=vote?mine===id:arena===id,n=counts?.get(id)??0;
      const live=vote?view.members.some(m=>m.id===this.client.id&&m.status==='home')&&!view.launching&&this.client.online:editable;
      return `<button type="button" class="pt-stage${random?' pt-pool':''}" data-party-arena="${id}" data-focus="arena-${id}" aria-pressed="${on}"${live?'':' disabled'}${vote?` aria-label="Vote for ${escape(STAGES[id].name)}: ${n} vote${n===1?'':'s'}"`:''}><b>${escape(STAGES[id].name.toUpperCase())}</b><small>${escape(STAGES[id].scene)}</small>${vote?`<i class="pt-votes${n?'':' pt-none'}">${n}</i>`:''}</button>`;};
    if(!lead&&!vote){
      const name=random?'RANDOM':STAGES[arena].name.toUpperCase(),scene=random?(view.mode==='royale'?`One of ${pool.length} famous places, dealt at the start`:`One of ${pool.length} places, dealt at the start`):STAGES[arena].scene;
      return `<div class="pt-stages pt-one"><div class="pt-stage pt-chosen${random?' pt-random':''}" aria-pressed="true"><b>${escape(name)}</b><small>${escape(scene)}</small></div></div>`;
    }
    const how=lead?`<div class="pt-how" role="radiogroup" aria-label="How the place is chosen">${([['pick','PICK'],['random','RANDOM'],['vote','PARTY VOTE']] as const).map(([id,label])=>{const on=id==='pick'?!vote&&!random:arena===id;return `<button type="button" role="radio" aria-checked="${on}" data-party-arena="${id}" data-focus="how-${id}"${editable?'':' disabled'}>${label}</button>`;}).join('')}</div>`:'';
    const note=vote?`<p class="pt-note">${lead?'Everyone votes: tap a place. Most votes wins; a tie goes to the first in the list.':'Your leader opened a vote: tap the place you want.'}</p>`:random?'<p class="pt-note">Dealt at the start. Tap a place to pick it instead.</p>':'';
    return `${how}${note}<div class="pt-stages" role="group" aria-label="Places">${pool.map(stage).join('')}</div>`;
  }
  private rules(view:PartyView,editable:boolean){
    const row=(label:string,rule:string,values:readonly (string|number)[],on:string|number,name:(v:never)=>string,note='')=>`<div class="pt-option" role="radiogroup" aria-label="${label}"><b>${label}${note?`<small>${note}</small>`:''}</b><span>${values.map(v=>`<button type="button" role="radio" aria-checked="${v===on}" data-party-rule="${rule}" data-value="${v}" data-focus="rule-${rule}-${v}"${editable&&(rule!=='players'||Number(v)>=view.members.length)?'':' disabled'}>${name(v as never)}</button>`).join('')}</span></div>`;
    const bots=row('BOTS','difficulty',DIFFICULTIES,view.rules.difficulty,(d:Difficulty)=>DIFFICULTY_NAMES[d]);
    if(view.mode==='royale')return `<h4>RULES</h4>${row('FIGHTERS','players',ROYALE_SEATS,view.rules.players,(n:number)=>String(n),'BOTS FILL EMPTY SEATS')}${bots}${row('TIME LIMIT','seconds',[0,...DURATIONS],view.rules.seconds,(s:number)=>s?String(s/60)+'′':'NONE')}`;
    if(view.mode==='bad-blood')return `<h4>RULES</h4>${row('BOTS','difficulty',DIFFICULTIES,view.rules.difficulty,(d:Difficulty)=>DIFFICULTY_NAMES[d],'THEY FILL THE 3 V 3')}`;
    if(view.mode==='last-stand')return `<h4>RULES</h4>${row('ALLIES','fill',['false','true'],String(view.rules.fill),(v:string)=>v==='true'?'+ BOTS':'FRIENDS ONLY','EMPTY DEFENDER SEATS')}${view.rules.fill?row('BOTS','difficulty',DIFFICULTIES,view.rules.difficulty,(d:Difficulty)=>DIFFICULTY_NAMES[d]):''}`;
    return `<h4>RULES</h4><div class="pt-chips">${this.facts(view).map(f=>`<span>${escape(f)}</span>`).join('')}</div>`;
  }

  private roster(view:PartyView){
    const lead=this.leader,editable=lead&&!view.launching&&view.members.every(m=>m.status==='home')&&this.client.online,seats=partyCapacity(view.mode,view.rules),open=Math.max(0,seats-view.members.length);
    const state=(m:PartyMember)=>!m.connected?['RECONNECTING','away']:m.status==='playing'?['IN MATCH','away']:m.status==='travelling'?['JOINING…','away']:m.id===view.leader?['LEADER','lead']:m.ready?['READY','ready']:['NOT READY','wait'];
    const team=(m:PartyMember)=>(view.mode==='bad-blood'||view.mode==='rift-war')?(isBadBloodFighter(m.fighter)?` · ${factionOf(m.fighter)==='villains'?'VILLAINS':'HEROES'}`:' · NOT IN BAD BLOOD'):'';
    const cards=view.members.map(m=>{const [label,kind]=state(m),you=m.id===this.client.id,menu=lead&&!you,openMenu=menu&&this.menu===m.id;
      return `<li class="pt-member" data-state="${kind}"${you?' data-you':''}><span class="pt-face">${mangaPortrait(m.fighter)}</span><span class="pt-who"><b>${escape(m.name)}${you?' <i>YOU</i>':''}</b><small>${escape(FIGHTERS[m.fighter].name.toUpperCase())}${team(m)}</small></span><span class="pt-state">${label}</span>${menu?`<button type="button" class="pt-more" data-party-menu="${m.id}" data-focus="more-${m.id}" aria-haspopup="menu" aria-expanded="${openMenu}" aria-label="Options for ${escape(m.name)}"${editable?'':' disabled'}><i></i><i></i><i></i></button>${openMenu?`<span class="pt-menu" role="menu"><button type="button" role="menuitem" data-party-leader="${m.id}" data-focus="menu-leader-${m.id}"${m.connected?'':' disabled'}>MAKE LEADER</button><button type="button" role="menuitem" data-party-kick="${m.id}" data-focus="menu-kick-${m.id}">REMOVE FROM PARTY</button></span>`:''}`:''}</li>`;}).join('');
    const over=view.members.length>seats?`<li class="pt-seat pt-over">${view.members.length} PLAYERS · ${PARTY_MODES[view.mode]} SEATS ${seats}</li>`:'';
    return `<h3>THE PARTY <small${view.members.length>seats?' class="pt-warn"':''}>${view.members.length} / ${seats<PARTY_MAX?seats:PARTY_MAX}</small></h3><ul class="pt-roster"${view.members.length>=CROWD?' data-crowd':''}>${cards}${open?`<li class="pt-seat">+ ${open} OPEN SEAT${open===1?'':'S'}${view.mode==='royale'?' · BOTS FILL THE REST':''}</li>`:''}${over}</ul>`;
  }
  private you(view:PartyView){
    const own=view.members.find(m=>m.id===this.client.id);if(!own)return '';
    const home=own.status==='home'&&!view.launching,bb=view.mode==='bad-blood',owner=account.account;
    const face=(id:FighterId)=>{const locked=!mayPlay(id,owner),out=bb&&!isBadBloodFighter(id);
      return `<option value="${id}" data-face="${id}" data-short="${escape(fighterCaption(id))}"${locked?' data-lock disabled':out?' disabled':''}${id===own.fighter?' selected':''}>${escape(FIGHTERS[id].name)}${locked?' (locked)':''}</option>`;};
    const vol=(ids:readonly FighterId[])=>ids.filter(id=>isReleasedFighter(id)&&!HELD.has(id)&&FIGHTERS[id]).map(face).join('');
    const notes=[view.mode==='rift-war'?'Rift War: Heroes or Villains, five a side. Pick a fighter from your team.':'',bb?`Bad Blood: Heroes or Villains, three a side. Villains fight at ${RULES.villainMultiplier}× power.`:'',bb&&!isBadBloodFighter(own.fighter)?`${FIGHTERS[own.fighter].name} is not in Bad Blood: choose another fighter.`:'',!mayPlay(own.fighter,owner)?`${FIGHTERS[own.fighter].name} is locked: unlock them in ACCOUNT, or choose another.`:''].filter(Boolean);
    return `<div class="pt-you"><small>YOUR FIGHTER</small><ink-select layout="faces" data-party-fighter data-focus="fighter" label="Your fighter"${home?'':' disabled'}>${HOME_VOLUMES.map((ids,i)=>`<optgroup label="VOL.${i+1}">${vol(ids)}</optgroup>`).join('')}</ink-select>${notes.length?`<p class="pt-note${notes.length>1||!bb?' pt-warn':''}">${notes.map(escape).join(' ')}</p>`:''}</div>`;
  }
  private action(view:PartyView){
    const own=view.members.find(m=>m.id===this.client.id),online=this.client.online,leave='<button type="button" class="pt-leave" data-party-leave data-focus="leave">LEAVE PARTY</button>';
    if(!own)return leave;
    const go=(attr:string,label:string,sub:string,disabled:boolean,extra='')=>`<button type="button" class="pt-go${extra}" ${attr} data-focus="go"${disabled?' disabled':''}><span>${label}<small>${escape(sub)}</small></span><i aria-hidden="true">${extra===' pt-done'?'✓':'▶'}</i></button>`;
    if(this.leader){
      const check=startCheck(view),away=view.members.some(m=>m.status!=='home');
      if(away&&!view.launching)return go('data-party-return','CALL EVERYONE HOME',check.reason??'',!online)+leave;
      return go('data-party-launch',view.launching?'LAUNCHING…':this.preparing?'LOADING…':'START',view.launching?'EVERYONE IS ON THE WAY':check.reason??'EVERYONE IS READY',!!check.reason||!online||this.preparing||view.launching)+leave;
    }
    if(own.status!=='home')return go('data-party-ready','IN A MATCH','FINISH IT, OR LEAVE IT TO COME BACK',true)+leave;
    const leader=leaderCalled(view,'your leader');
    if(this.preparing)return go('data-party-ready','LOADING…','YOUR FIGHTER IS LOADING',true)+leave;
    return (own.ready?go('data-party-ready','UNREADY',`READY · ${leader} STARTS THE MATCH`,view.launching||!online,' pt-done'):go('data-party-ready','READY',`AS ${FIGHTERS[own.fighter].name}`,view.launching||!online))+leave;
  }
}
