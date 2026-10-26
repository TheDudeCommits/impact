import {FIGHTERS} from '../config';
import {STAGES} from '../game/stages';
import type {GameSnapshot, PlayerState} from '../game/types';
import {VsSplash, type VsSide} from './VsSplash';
import './matchPresentation.css';

const INTRO_SECONDS = 2.7, SLACK = .3, SHORTEST = 1.1, REPLAY_WINDOW = 350;

export class MatchIntro {
  readonly element:HTMLElement;
  readonly splash:VsSplash;
  private seen='';
  private roster='';
  private until=0;
  private shownAt=0;
  private plays=0;
  private owed='';
  constructor(parent:HTMLElement){
    this.splash=new VsSplash(parent);
    this.element=document.createElement('section');this.element.className='match-intro hidden';
    this.element.setAttribute('role','dialog');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-label','Match introduction');
    this.element.innerHTML='<p class="intro-summary"></p><button type="button" class="intro-skip" data-skip-intro>SKIP INTRO <span aria-hidden="true">↗</span></button>';
    parent.append(this.element);
    this.element.addEventListener('click',()=>this.close());
    this.element.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();this.element.querySelector<HTMLButtonElement>('button')?.focus();}});
  }
  get open(){return !this.element.classList.contains('hidden');}
  reset(){this.close();this.splash.skip();this.seen='';this.roster='';this.owed='';}
  close(){
    const focused=this.element.contains(document.activeElement);if(!this.element.classList.contains('hidden'))this.element.classList.add('hidden');if(focused)(document.activeElement as HTMLElement)?.blur();
    if(this.splash.open)this.splash.skip();
  }
  skip(){if(!this.open)return false;this.close();return true;}
  update(snapshot:GameSnapshot|null,selfId:string,enabled:boolean){
    if(snapshot?.duel?.phase==='interval'){this.close();this.owed=`duel-${snapshot.duel.set}-${snapshot.duel.round}`;return;}
    if(this.owed&&snapshot?.roomMode==='match'&&snapshot.status==='active'){this.owed='';this.close();if(enabled)void this.splash.fight();return;}
    const starts=snapshot?.lobby?.startsAt;
    if(!enabled||!snapshot||snapshot.roomMode!=='match'||snapshot.status!=='waiting'||starts==null||starts-snapshot.serverTime<.15){this.close();return;}
    const self=snapshot.players.find(p=>p.id===selfId);if(!self)return;
    const key=String(starts);
    if(key!==this.seen){
      this.seen=key;this.owed=key;this.roster='';
      const left=starts-snapshot.serverTime;
      if(left<SHORTEST)return;
      this.until=performance.now()+(Math.min(INTRO_SECONDS,left-SLACK)+.8)*1000;this.element.classList.remove('hidden');document.exitPointerLock?.();
    }
    if(!this.open)return;
    const now=performance.now();
    if(now>=this.until){this.close();return;}
    const opponents=snapshot.players.filter(p=>p.id!==selfId);
    const roster=snapshot.players.map(p=>p.id+p.fighter+p.name).join('|')+snapshot.stage;
    if(roster===this.roster)return;
    const first=!this.roster;this.roster=roster;
    const stage=STAGES[snapshot.stage]?.name;
    const side=(p:PlayerState,own=false):VsSide=>({fighter:p.fighter,name:FIGHTERS[p.fighter].name,tag:own?`YOU · ${p.name}`:p.isBot?'CHALLENGER':p.name});
    this.element.querySelector('.intro-summary')!.textContent=`${FIGHTERS[self.fighter].name} versus ${opponents.length?opponents.map(p=>FIGHTERS[p.fighter].name).join(', '):'rivals still arriving'}${stage?`, ${stage}`:''}. ${snapshot.players.length} fighter${snapshot.players.length===1?'':'s'} ready.`;
    if(first||now-this.shownAt<REPLAY_WINDOW){
      if(first)this.shownAt=now;
      const play=++this.plays,seconds=Math.min(INTRO_SECONDS,starts-snapshot.serverTime-SLACK);
      void this.splash.play({left:side(self,true),rights:opponents.slice(0,11).map(p=>side(p)),stage,seconds}).then(()=>{if(play===this.plays)this.close();});
    }
    this.element.querySelector<HTMLButtonElement>('button')!.focus({preventScroll:true});
  }
}
