import type {GameSnapshot} from '../../game/types';
import {RULES,type ObjectiveView} from '../../game/objectives/model';
import {ENEMIES} from '../../survival/enemies';
import {mangaPortrait} from '../MangaHome';

const percent=(a:number,b:number)=>`${Math.max(0,Math.min(100,a/Math.max(1,b)*100))}%`;
export class ObjectiveStatus {
  private roster='';
  private fields=new Map<string,HTMLElement>();
  private faces=new Map<string,{root:HTMLElement;hp:HTMLElement;state:HTMLElement}>();
  private announcement='';private announceUntil=0;
  constructor(private root:HTMLElement){}
  private text(key:string,value:string){const el=this.fields.get(key);if(el&&el.textContent!==value)el.textContent=value;}
  reset(){this.roster='';this.announcement='';this.announceUntil=0;this.root.classList.remove('under-attack');this.faces.clear();this.fields.clear();}
  update(v:ObjectiveView,snapshot:GameSnapshot,ownId:string){
    const key=[v.kind,v.round,ownId,...v.seats.map(s=>s.id+':'+s.fighter)].join('|');
    if(key!==this.roster){
      this.roster=key;this.faces.clear();this.fields.clear();
      const team=(name:string)=>v.seats.filter(s=>s.team===name).map(s=>`<div class="objective-mini${s.id===ownId?' is-you':''}" data-seat="${s.id}"><span>${mangaPortrait(s.fighter)}</span><i></i><b></b></div>`).join('');
      this.root.innerHTML=v.kind==='last-stand'?`<div class="objective-hud-heading"><b data-stat="chapter">VILLAGE DEFENCE</b><span data-stat="wave"></span></div><div class="objective-village-hp" role="meter" aria-label="Village health" aria-valuemin="0" data-stat="village-meter"><i data-stat="village-bar"></i></div><div class="objective-hud-meta"><span data-stat="hp"></span><b data-stat="funds"></b></div><div class="objective-lanes" aria-label="Enemy approaches"><span>WEST <b data-stat="west"></b></span><span>GATE <b data-stat="gate"></b></span><span>EAST <b data-stat="east"></b></span></div><div class="objective-team-strip">${team('defenders')}<span data-stat="incoming"></span></div><div class="objective-boss-strip hidden" data-stat="boss"><b data-stat="boss-name"></b><span data-stat="boss-health"></span><i data-stat="boss-bar"></i></div><div class="objective-director" data-stat="director"></div><div class="objective-emergency hidden" data-stat="emergency"><small data-stat="event-label"></small><b data-stat="event-title"></b><span data-stat="event-detail"></span><i><em data-stat="event-progress"></em></i></div><div class="objective-alert" data-stat="alert" role="status"></div>`:`<div class="objective-hud-heading"><b>BAD BLOOD</b><span data-stat="clock"></span></div><div class="objective-versus"><div class="blood-side heroes"><small>HEROES <b data-stat="heroes-count"></b></small><div class="objective-team-strip">${team('heroes')}</div></div><strong>VS</strong><div class="blood-side villains"><small>VILLAINS <b data-stat="villains-count"></b></small><div class="objective-team-strip">${team('villains')}</div></div></div><div class="blood-allegiance" data-stat="allegiance"></div><div class="objective-alert" data-stat="alert" role="status"></div>`;
      this.root.querySelectorAll<HTMLElement>('[data-stat]').forEach(el=>this.fields.set(el.dataset.stat!,el));
      this.root.querySelectorAll<HTMLElement>('[data-seat]').forEach(el=>this.faces.set(el.dataset.seat!,{root:el,hp:el.querySelector('i')!,state:el.querySelector('b')!}));
      for(const seat of v.seats){const face=this.faces.get(seat.id);if(face)face.root.title=seat.name+(seat.id===ownId?' · YOU':'');}
    }
    const now=snapshot.serverTime;
    for(const seat of v.seats){
      const p=snapshot.players.find(p=>p.id===seat.id),face=this.faces.get(seat.id);if(!face)continue;
      face.root.classList.toggle('fallen',!p?.alive);face.root.classList.toggle('returning',!!seat.reviveAt);
      face.hp.style.width=percent(p?.hp??0,p?.maxHp??1);
      const label=seat.reviveAt?Math.max(1,Math.ceil(seat.reviveAt-now))+'s':seat.down?(v.kind==='last-stand'?'✚':'×'):v.kind==='bad-blood'&&seat.team==='heroes'&&seat.revivesLeft?'↻':'';
      if(face.state.textContent!==label)face.state.textContent=label;
    }
    if(v.village){
      const city=v.village,preparing=city.phase==='preparation',attack=city.underAttackUntil>now;
      this.text('chapter',city.chapter?`CHAPTER ${city.chapter.number} · VILLAGE DEFENCE`:'VILLAGE DEFENCE');
      this.text('wave',`WAVE ${preparing?city.wave+1:city.wave}`);this.text('hp',`${Math.ceil(city.hp).toLocaleString()} / ${city.maxHp.toLocaleString()}`);this.text('funds',`◈ ${city.points.toLocaleString()} SHARED`);
      this.fields.get('village-bar')!.style.width=percent(city.hp,city.maxHp);
      this.fields.get('village-meter')!.setAttribute('aria-valuenow',String(Math.ceil(city.hp)));this.fields.get('village-meter')!.setAttribute('aria-valuemax',String(city.maxHp));
      this.root.classList.toggle('under-attack',attack);
      this.text('incoming',preparing?`NEXT WAVE · ${Math.max(0,Math.ceil(city.nextWaveAt-now))}s`:`${city.remaining} REMAINING`);
      ['west','gate','east'].forEach((k,i)=>this.text(k,preparing&&city.plan?`→ ${city.plan.lanes[i]}`:String(city.lanes?.[i]??0)));
      const boss=city.bossActor?snapshot.players.find(p=>p.id===city.bossActor&&p.alive):undefined;
      this.fields.get('boss')!.classList.toggle('hidden',!boss);
      if(boss){this.text('boss-name',boss.name);this.text('boss-health',`${['I','II','III'][city.bossPhase??0]} · ${Math.ceil(boss.hp).toLocaleString()} HP`);this.fields.get('boss-bar')!.style.width=percent(boss.hp,boss.maxHp);}
      const director=city.director;this.text('director',!preparing&&director?director.state==='surge'?`ASSAULT SURGE · ${['WEST','GATE','EAST'][director.lane]}`:director.state==='rally'?'RALLY WINDOW · RESCUE & REGROUP':'':'' );
      const event=city.emergency,show=!!event&&event.endsAt>now;
      this.fields.get('emergency')!.classList.toggle('hidden',!show);
      if(show&&event){const carrier=snapshot.players.find(p=>p.id===event.carrier&&p.alive),done=event.phase!=='active';
        this.text('event-label',done?event.phase==='secured'?`SECURED · +${event.reward} SHARED`:'OPPORTUNITY MISSED':`OPTIONAL · ${Math.max(0,Math.ceil(event.endsAt-now))}s · ◈ ${event.reward}`);
        this.text('event-title',event.kind==='rescue'?'EVACUATE THE WAGON':'RAID THE SUPPLY CONVOY');
        this.text('event-detail',done?'':carrier?'Defeat the marked carrier':`${event.x<0?'WEST':'EAST'} ROAD · ${event.contested?'Clear nearby enemies':event.helpers.length?'Securing…':'Stand by the '+(event.kind==='rescue'?'wagon':'cargo')}`);
        this.fields.get('event-progress')!.style.width=percent(event.progress,1);
      }
      const target=snapshot.players.find(p=>p.id===ownId)?.target;
      const specialist=city.specialists?.find(s=>s.id===target);
      const counter=specialist?.role==='captain'?'SHIELD CAPTAIN · STAGGER TO BREAK THE WARD':specialist?.role==='medic'?'FIELD MEDIC · INTERRUPT THE HEAL':specialist?.role==='sapper'?'DEMOLITION RAIDER · STOP THE BREACH':'';
      const notice=`${city.wave}:${city.phase}:${boss?.id??''}:${city.bossPhase??0}`;
      if(notice!==this.announcement){this.announcement=notice;this.announceUntil=now+4;}
      this.text('alert',attack?`${city.structures?.filter(s=>s.hitAt>now-2.5).sort((a,b)=>b.hitAt-a.hitAt)[0]?.name.toUpperCase()??'VILLAGE'} UNDER ATTACK`:counter?counter:preparing&&city.wave>0&&now<this.announceUntil?`WAVE ${city.wave} CLEARED · REGROUP & REPAIR`:preparing&&city.plan?`${city.chapter?.title??city.plan.title} · ${city.chapter?ENEMIES[city.chapter.commander]?.name+' AT WAVE '+city.chapter.lastWave:city.plan.hint}`:now<this.announceUntil?(preparing?'REGROUP · REPAIR · REARM':boss?(city.bossPhase===2?'DESPERATION · STAY TOGETHER':city.bossPhase===1?'BOSS ENRAGED · WATCH THE WIND-UP':'BOSS AT THE GATES'):city.plan?.title??`WAVE ${city.wave} · HOLD THE LINE`):'');
    }else{
      this.root.classList.remove('under-attack');
      const s=Math.floor(Math.max(0,now-v.startedAt));this.text('clock',`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`);
      const returning=v.seats.filter(s=>s.reviveAt),heroes=snapshot.players.filter(p=>p.team==='heroes'&&p.alive).length;
      const villains=snapshot.players.filter(p=>p.team==='villains'&&p.alive).length,own=v.seats.find(s=>s.id===ownId);
      this.text('heroes-count',`${heroes} / 3`);this.text('villains-count',`${villains} / 3`);
      this.text('allegiance',own?.team==='heroes'?`YOU: HEROES · ${own.revivesLeft?'1 RETURN READY':own.reviveAt?'RETURNING':'RETURN USED'}`:`YOU: VILLAINS · ${RULES.villainMultiplier}× POWER`);
      this.text('alert',returning.length&&heroes===1?`LAST HERO STANDING · RETURN IN ${Math.max(1,Math.ceil(Math.min(...returning.map(s=>s.reviveAt!))-now))}s`:returning.length?`${returning.length===1?'A HERO IS':'HEROES ARE'} RETURNING · KEEP ONE STANDING`:'');
    }
  }
}
