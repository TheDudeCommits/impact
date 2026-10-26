import {FIGHTERS} from '../../config';
import {mangaPortrait} from '../MangaHome';
import type {GameSnapshot} from '../../game/types';
import {RIFT_LANES,RIFT_LANE_NAMES,type RiftSeat,type RiftView} from '../../game/moba/model';
import {warfrontAt,WARFRONTS} from '../../game/moba/warfront';
import {Fill,Text} from '../hud/kit';
import {RiftMinimap} from './RiftMinimap';
import {escapeRift as escape,riftClock} from './icons';

export class RiftBattleMap {
  private map=new RiftMinimap(384);
  private text=new Map<string,Text>();
  private lanes=new Map<string,string>();
  private rosterKey='';
  private allies=new Map<string,{state:Text;score:Text;hp:Fill}>();
  constructor(readonly dialog:HTMLDialogElement){
    dialog.className='rift-battle-map';dialog.setAttribute('aria-label','Battle map');
    dialog.innerHTML=`<header><span>RIFT WAR / FIELD NOTES</span><h2>BATTLE MAP</h2><p>Escort your wave. Break the wards in order. Destroy the enemy core.</p><button type="button" class="rift-close" data-close-map aria-label="Close battle map">×</button></header>
      <div class="rift-battle-layout"><section class="rift-battle-overview"><div class="rift-battle-canvas"></div><p class="rift-map-legend"><span>● DAWN</span><span>● ECLIPSE</span><span>◎ YOU</span></p><small>Only scouted enemies are shown.</small><div class="rift-battle-front"><b data-report="front"></b><span data-report="next"></span></div></section>
      <section class="rift-battle-orders"><h3>CHOOSE YOUR PUSH</h3><p>Select a lane to rally an ally.</p>${RIFT_LANES.map(l=>`<button type="button" class="rift-lane-order" data-ping="${l}"><span><b>${RIFT_LANE_NAMES[l]}</b><small data-lane-status></small></span><span class="rift-route" data-lane-route></span><em data-lane-pressure></em></button>`).join('')}<div class="rift-battle-build"><h3>YOUR BUILD <small data-report="score"></small></h3><div class="rift-items" data-rift="items" aria-label="Your equipped relics"></div><button type="button" class="rift-map-forge" data-shop>OPEN RELIC SHOP →</button></div></section></div>
      <section class="rift-battle-team"><h3>YOUR TEAM</h3><div data-report-team></div></section><footer><span>Movement and attacks are disabled while this map is open.</span><b>The battle continues.</b></footer>`;
    dialog.querySelector('.rift-battle-canvas')!.append(this.map.canvas);
    for(const node of dialog.querySelectorAll<HTMLElement>('[data-report]'))this.text.set(node.dataset.report!,new Text(node));
  }
  update(snapshot:GameSnapshot,view:RiftView,seat:RiftSeat,now:number){
    if(!this.dialog.open)return;
    this.map.update(snapshot,view,seat.id,now);
    const elapsed=snapshot.serverTime-view.startedAt,front=warfrontAt(elapsed),next=WARFRONTS[front.tier+1];
    this.text.get('front')!.set(`${front.name.toUpperCase()} · WAVE ${view.wave}`);
    this.text.get('next')!.set(`Next wave ${Math.max(0,Math.ceil(view.nextWaveAt-snapshot.serverTime))}s${next?` · ${next.name} in ${riftClock(next.at-elapsed)}`:' · Elite siege columns'}`);
    this.text.get('score')!.set(`${seat.kills} K / ${seat.deaths} D / ${seat.assists} A`);
    for(const lane of RIFT_LANES){
      const button=this.dialog.querySelector<HTMLButtonElement>(`[data-ping="${lane}"]`)!;
      const defenses=view.structures.filter(s=>s.team!==seat.team&&s.lane===lane&&(s.kind==='tower'||s.kind==='barracks')).sort((a,b)=>a.tier-b.tier);
      const route=defenses.map(s=>({label:s.kind==='barracks'?'BARRACKS':s.tier===1?'OUTER':'INNER',state:s.hp<=0?'broken':s.vulnerable?'next':'sealed'}));
      let allies=0,enemies=0;for(const u of view.units)if(u.lane===lane&&u.hp>0&&u.team!=='neutral'){if(u.team===seat.team)allies++;else enemies++;}
      const key=JSON.stringify([route,allies,enemies,seat.lane]);if(this.lanes.get(lane)===key)continue;this.lanes.set(lane,key);
      button.setAttribute('aria-pressed',String(lane===seat.lane));
      button.querySelector('[data-lane-status]')!.textContent=lane===seat.lane?'YOUR LANE':'RALLY HERE →';
      button.querySelector('[data-lane-route]')!.innerHTML=route.map(s=>`<span data-state="${s.state}" title="${s.label}: ${s.state==='next'?'exposed':s.state}"><i>${s.state==='broken'?'✓':s.state==='next'?'◆':'◇'}</i>${s.label}<small>${s.state==='next'?'EXPOSED':s.state.toUpperCase()}</small></span>`).join('');
      button.querySelector('[data-lane-pressure]')!.textContent=`${allies} allied troops · ${enemies} enemies in sight`;
      button.setAttribute('aria-label',`${RIFT_LANE_NAMES[lane]}. ${lane===seat.lane?'Your lane. ':''}${allies} allied troops, ${enemies} enemies in sight. Rally here.`);
    }
    const team=view.seats.filter(s=>s.team===seat.team),key=team.map(s=>`${s.id}:${s.fighter}`).join('|');
    if(key!==this.rosterKey){this.rosterKey=key;this.allies.clear();const root=this.dialog.querySelector('[data-report-team]')!;
      root.innerHTML=team.map(s=>`<article data-ally="${escape(s.id)}"><span class="rift-report-face">${mangaPortrait(s.fighter)}</span><div><b>${escape(FIGHTERS[s.fighter].name)}${s.id===seat.id?' · YOU':''}</b><span class="rift-report-hp"><i></i></span><small></small></div><em></em></article>`).join('');
      [...root.children].forEach((row,i)=>this.allies.set(team[i].id,{state:new Text(row.querySelector('small')!),score:new Text(row.querySelector('em')!),hp:new Fill(row.querySelector('.rift-report-hp i')!)}));
    }
    for(const ally of team){const row=this.allies.get(ally.id)!,p=snapshot.players.find(p=>p.id===ally.id);row.hp.set(p?.alive?p.hp/p.maxHp:0);row.score.set(`${ally.kills} / ${ally.deaths} / ${ally.assists}`);row.state.set(ally.disconnected?'RECONNECTING':ally.respawnAt?`RETURNS IN ${Math.max(0,Math.ceil(ally.respawnAt-snapshot.serverTime))}s`:ally.recallAt?'RETURNING TO BASE':`LV ${ally.level} · ${RIFT_LANE_NAMES[ally.lane]}`);}
  }
  clear(){this.lanes.clear();this.rosterKey='';this.allies.clear();}
}
