import {riftOf} from '../moba/model';
import type {FighterId,GameSnapshot} from '../types';
import {MOVES} from '../moves';
import {objectiveOf} from '../objectives/model';
import type {RunResult} from '../../survival/SurvivalGame';
export type CareerMode='duel'|'royale'|'bots'|'private'|'boss-hunt'|'rift-control'|'last-stand'|'bad-blood'|'survival'|'coop'|'rift-war';
export const CAREER_MODES:Record<CareerMode,string>={'rift-war':'Rift War',duel:'Duel',royale:'BR vs Players',bots:'BR vs Bots',private:'Private Royale','boss-hunt':'Boss Hunt','rift-control':'Rift Control','last-stand':'Last Stand','bad-blood':'Bad Blood',survival:'Arcade Survival',coop:'Co-op Survival'};
export const CAREER_SHOWN:readonly CareerMode[]=['duel','royale','bots','private','survival','coop','last-stand','bad-blood','rift-war'];
export interface CareerMatch {id:string;at:number;mode:CareerMode;fighter:FighterId;outcome:'win'|'loss'|'draw'|'left';kills:number;damage:number;seconds:number;bosses:number;capture:number;score:number;round:number;}
export interface CareerTotals {matches:number;wins:number;losses:number;draws:number;left:number;kills:number;damage:number;seconds:number;bosses:number;capture:number;}
export interface Career {version:1;since:number;totals:CareerTotals;modes:Partial<Record<CareerMode,CareerTotals>>;fighters:Partial<Record<FighterId,CareerTotals>>;recent:CareerMatch[];seen:string[];title:string;}
export const emptyTotals=():CareerTotals=>({matches:0,wins:0,losses:0,draws:0,left:0,kills:0,damage:0,seconds:0,bosses:0,capture:0});
export const newCareer=(now=Date.now()):Career=>({version:1,since:now,totals:emptyTotals(),modes:{},fighters:{},recent:[],seen:[],title:'newcomer'});
const number=(n:unknown,max=1e12)=>typeof n==='number'&&Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
export function readCareer(text:string|null):Career{
  try{const c=JSON.parse(text??'null');if(c?.version!==1||!Array.isArray(c.recent)||!Array.isArray(c.seen))return newCareer();
    const clean=(v:Record<string,unknown>)=>Object.fromEntries(Object.keys(emptyTotals()).map(k=>[k,number(v?.[k])])) as unknown as CareerTotals;
    return {version:1,since:number(c.since,1e15)||Date.now(),totals:clean(c.totals),modes:Object.fromEntries(Object.entries(c.modes??{}).filter(([k])=>Object.hasOwn(CAREER_MODES,k)).map(([k,v])=>[k,clean(v as never)])),fighters:Object.fromEntries(Object.entries(c.fighters??{}).filter(([k])=>Object.hasOwn(MOVES,k)).map(([k,v])=>[k,clean(v as never)])),recent:c.recent.filter(validMatch).slice(0,30),seen:c.seen.filter((v:unknown)=>typeof v==='string'&&v.length<180).slice(-256),title:typeof c.title==='string'?c.title:'newcomer'};
  }catch{return newCareer();}
}
function validMatch(m:CareerMatch){return m&&typeof m.id==='string'&&m.id.length<180&&Object.hasOwn(CAREER_MODES,m.mode)&&Object.hasOwn(MOVES,m.fighter)&&['win','loss','draw','left'].includes(m.outcome)&&['at','kills','damage','seconds','bosses','capture','score','round'].every(k=>Number.isFinite((m as unknown as Record<string,number>)[k])&&(m as unknown as Record<string,number>)[k]>=0);}
export function recordCareer(c:Career,match:CareerMatch){
  if(!validMatch(match)||c.seen.includes(match.id))return false;
  const m={...match,kills:number(match.kills,100000),damage:number(match.damage,1e8),seconds:number(match.seconds,86400),bosses:number(match.bosses,10000),capture:number(match.capture,3600),score:number(match.score,1e9),round:number(match.round,10000)};
  for(const totals of [c.totals,c.modes[m.mode]??=emptyTotals(),c.fighters[m.fighter]??=emptyTotals()]){
    totals.matches++;totals[m.outcome==='win'?'wins':m.outcome==='loss'?'losses':m.outcome==='draw'?'draws':'left']++;
    for(const k of ['kills','damage','seconds','bosses','capture'] as const)totals[k]+=m[k];
  }
  c.seen.push(m.id);c.seen=c.seen.slice(-256);c.recent.unshift(m);c.recent=c.recent.slice(0,30);return true;
}
export const CAREER_TITLES=[
  {id:'newcomer',name:'New Challenger',goal:0,stat:'matches'},
  {id:'regular',name:'Arena Regular',goal:10,stat:'matches'},
  {id:'winner',name:'Victory Author',goal:10,stat:'wins'},
  {id:'hunter',name:'Boss Breaker',goal:10,stat:'bosses'},
  {id:'keeper',name:'Rift Keeper',goal:300,stat:'capture'},
  {id:'legend',name:'Manga Legend',goal:100,stat:'wins'},
] as const;
export const titleUnlocked=(c:Career,id:string)=>CAREER_TITLES.some(t=>t.id===id&&c.totals[t.stat]>=t.goal);
const KEY='jump.career.v1';
function deviceStorage(){try{return typeof localStorage==='undefined'?undefined:localStorage;}catch{return undefined;}}
export class CareerTracker {
  data:Career;
  saved=true;
  private session='';private mode:CareerMode='bots';private first:number|undefined;private last?:GameSnapshot;private own='';private round=0;private finished=false;
  constructor(private storage:Pick<Storage,'getItem'|'setItem'>|undefined=deviceStorage()){try{this.data=readCareer(storage?.getItem(KEY)??null);}catch{this.data=newCareer();this.saved=false;}}
  reload(){if(!this.storage)return;try{const saved=this.storage.getItem(KEY);if(saved)this.data=readCareer(saved);}catch{this.saved=false;}}
  save(){try{this.storage?.setItem(KEY,JSON.stringify(this.data));this.saved=!!this.storage;}catch{this.saved=false;}}
  title(id:string){if(titleUnlocked(this.data,id)){this.data.title=id;this.save();}}
  start(mode:CareerMode){this.session=globalThis.crypto.randomUUID();this.mode=mode;this.first=undefined;this.last=undefined;this.round=0;this.finished=false;}
  observe(snapshot:GameSnapshot,id:string){
    if(!this.session||this.mode==='survival'||this.mode==='coop')return;const v=objectiveOf(snapshot),round=v?.round??riftOf(snapshot)?.round??snapshot.duel?.set??0;
    if(round!==this.round){this.round=round;this.first=undefined;this.finished=false;}
    this.last=snapshot;this.own=id;if(snapshot.status==='active')this.first??=snapshot.serverTime;
    if(snapshot.status==='finished'||!v&&!riftOf(snapshot)&&!snapshot.duel&&snapshot.status==='active'&&snapshot.players.find(p=>p.id===id)?.alive===false)this.finish();
  }
  private add(m:Omit<CareerMatch,'id'|'at'>){
    this.reload();if(recordCareer(this.data,{...m,id:this.session+':'+this.round,at:Date.now()}))this.save();this.finished=true;
  }
  private finish(left=false){
    const s=this.last,p=s?.players.find(p=>p.id===this.own);if(!s||!p||this.finished||this.first===undefined)return;const v=objectiveOf(s),seat=v?.seats.find(p=>p.id===this.own);
    const war=riftOf(s),warSeat=war?.seats.find(seat=>seat.id===this.own);
    const won=war?war.winner===warSeat?.team:v?v.winner===seat?.team:s.winnerId===p.id,draw=war?war.phase==='over'&&war.winner===null:v?v.winner==='draw':s.status==='finished'&&s.winnerId===null;
    this.add({mode:this.mode,fighter:p.fighter,outcome:left?'left':won?'win':draw?'draw':'loss',kills:p.kills??0,damage:Math.round(p.damageDealt??0),seconds:Math.max(0,s.serverTime-this.first),bosses:seat?.bosses??0,capture:0,score:v?.village?.points??0,round:this.round});
  }
  survival(result:RunResult|undefined,run=0){
    if(!this.session||!result||result.probe||!['survival','coop'].includes(this.mode))return;if(this.round!==run){this.round=run;this.finished=false;}if(this.finished)return;
    this.add({mode:this.mode,fighter:result.fighter,outcome:result.victory?'win':'loss',kills:result.party?result.ownKills??0:result.kills,damage:result.damageDealt,seconds:result.seconds,bosses:result.bosses,capture:0,score:result.score,round:result.round});
  }
  leave(){this.finish(true);this.session='';}
}
