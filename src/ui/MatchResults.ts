import {FIGHTERS} from '../config';
import type {GameSnapshot,PlayerState} from '../game/types';
import {STAGES} from '../game/stages';
import {mangaPortrait} from './MangaHome';
import {rankPlayers} from './hudMath';
import {resultsFrame,clock} from './results/ResultsFrame';
import {FALLS} from './results/placement';
import './matchPresentation.css';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const number=(n=0)=>Math.max(0,Math.round(n)).toLocaleString('en-US');
const AGAIN:Record<string,string>={'FIND NEXT DUEL':'A NEW OPPONENT','DUEL AGAIN':'THE SAME BOT RIVAL','NEW FRIEND DUEL':'A NEW FRIEND ROOM','NEW PRIVATE ROOM':'A NEW PRIVATE ROOM','PLAY AGAIN':'SAME SETTINGS'};
export function standingNames(p:Pick<PlayerState,'name'|'fighter'|'isBot'>):[string,string]{
  const fighter=FIGHTERS[p.fighter]?.name??p.fighter,name=(p.name??'').trim();
  if(p.isBot&&(!name||name.toLowerCase()===p.fighter.replaceAll('-',' ')||name===fighter))return [fighter,'BOT'];
  if(!p.isBot&&(!name||name==='Fighter'))return [fighter,'PLAYER'];
  return [name,`${fighter}${p.isBot?' · BOT':''}`];
}
export function matchResults(snapshot:GameSnapshot,self:PlayerState,fallen:string[],againLabel:string,roomGone=false){
  const ranked=rankPlayers(snapshot.players,snapshot.winnerId,fallen),place=ranked.findIndex(p=>p.id===self.id)+1;
  const winner=ranked.find(p=>p.id===snapshot.winnerId),won=winner?.id===self.id,duel=!!snapshot.lobby?.duel;
  const name=(p:PlayerState)=>p.isBot||p.name==='Fighter'?FIGHTERS[p.fighter].name:p.name;
  const stage=STAGES[snapshot.stage]?.name??'THE ARENA',time=snapshot.duel?.startedAt!=null?snapshot.serverTime-snapshot.duel.startedAt:FALLS.seconds(snapshot.serverTime);
  const rivalLeft=duel&&won&&snapshot.players.length<2&&(snapshot.duel?.scores[self.id]??0)<(snapshot.duel?.firstTo??2);
  const others=snapshot.players.filter(p=>p.id!==self.id),humans=others.filter(p=>!p.isBot).length;
  const way=snapshot.lobby?.visibility==='private'?(duel?'FRIEND':'PRIVATE ROOM'):others.length&&!humans&&!rivalLeft?(duel?'VS BOT':'VS BOTS'):'ONLINE';
  const outcome=won?'VICTORY':duel?'DEFEAT':self.alive?'MATCH OVER':'KNOCKED OUT';
  const runback=duel&&!!snapshot.duel&&!roomGone;
  const line=rivalLeft?'Your rival left the duel.':won?(duel?'You won the best-of-three set.':'Last fighter standing.'):winner?(duel?`${name(winner)} won the best-of-three set.`:`Winner: ${name(winner)}${winner.isBot?' (bot)':''}.`):'';
  const standings=`<div class="results-table-scroll"><table class="results-table"><thead><tr><th scope="col">#</th><th scope="col">FIGHTER</th><th scope="col">KOs</th><th scope="col">DEALT</th><th scope="col">TAKEN</th></tr></thead><tbody id="results-rows">${ranked.map((p,i)=>`<tr class="${p.id===self.id?'you ':''}${p.id===snapshot.winnerId?'winner':''}"><td class="place">${i+1}</td><td class="who"><span class="standings-portrait">${mangaPortrait(p.fighter)}</span><div><strong>${escape(standingNames(p)[0])}${p.id===self.id?' · YOU':''}</strong><small>${escape(standingNames(p)[1])}</small></div></td><td class="num">${number(p.kills)}</td><td class="num">${number(p.damageDealt)}</td><td class="num">${number(p.damageTaken)}</td></tr>`).join('')}</tbody></table></div>`;
  return resultsFrame({
    mast:`${duel?'DUEL':'BATTLE ROYALE'} · ${way}`,where:`${stage.toUpperCase()}${time?` · ${clock(time)}`:''}`,
    fighter:self.fighter,fighterName:FIGHTERS[self.fighter].name,kicker:self.name&&self.name!=='Fighter'?`${self.name} · ${FIGHTERS[self.fighter].name.toUpperCase()}`:FIGHTERS[self.fighter].name.toUpperCase(),
    outcome,line,won,kanji:won?'勝':outcome==='MATCH OVER'?'終':'敗',
    key:duel?{value:snapshot.duel?`${snapshot.duel.scores[self.id]??0}–${Math.max(0,...Object.entries(snapshot.duel.scores).filter(([id])=>id!==self.id).map(([,n])=>n))}`:won?'1–0':'0–1',label:'ROUNDS WON'}:{value:`#${place}`,label:`OF ${ranked.length} FIGHTERS`},
    stats:[[number(self.kills),'KOs'],[number(self.damageDealt),'DAMAGE DEALT'],[number(self.damageTaken),'DAMAGE TAKEN']],
    details:{summary:duel?'THE FIGHT':'FULL STANDINGS',html:standings},
    again:{label:runback?'RUN IT BACK':'PLAY AGAIN',sub:runback?(snapshot.duel!.runback.includes(self.id)?'WAITING FOR YOUR RIVAL':'SAME RIVAL · NO RELOAD'):AGAIN[againLabel]??'SAME SETTINGS',attrs:'id="results-again"',disabled:!roomGone&&!!snapshot.duel?.runback.includes(self.id)},
    training:'id="results-practice"',home:'id="results-leave"',
  });
}
