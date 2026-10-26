import type {FighterId,StageId} from '../types';
import {ARENAS,DUEL_ARENAS,DURATIONS,type CustomRules,type Difficulty} from './custom';
import {factionOf,isBadBloodFighter,type RolePreference} from '../objectives/model';

export type PartyMode='duel'|'royale'|'bad-blood'|'last-stand'|'survival'|'rift-war';
export const PARTY_MODES:Record<PartyMode,string>={'rift-war':'RIFT WAR',duel:'DUEL',royale:'BATTLE ROYALE','bad-blood':'BAD BLOOD','last-stand':'LAST STAND',survival:'CO-OP SURVIVAL'};
export const PARTY_ORDER:readonly PartyMode[]=['duel','royale','bad-blood','last-stand','survival','rift-war'];
export const PARTY_MAX=12;
export const PARTY_ARENAS:Record<PartyMode,readonly StageId[]>={'rift-war':[],duel:DUEL_ARENAS,royale:ARENAS.royale,'bad-blood':ARENAS['bad-blood'],'last-stand':[],survival:[]};
export const ROYALE_SEATS=[4,8,12] as const;
export type PartyArena='random'|'vote'|StageId;
export interface PartyRules {arena:PartyArena;difficulty:Difficulty;seconds:number;players:number;fill:boolean;}
export const DIFFICULTIES:readonly Difficulty[]=['easy','normal','hard'];
export const HOME_ARENA:Partial<Record<PartyMode,StageId>>={duel:'martial-arts-tournament','bad-blood':'blood-citadel'};
export function defaultPartyRules(mode:PartyMode,keep?:Pick<PartyRules,'difficulty'>):PartyRules{
  return {arena:HOME_ARENA[mode]??'random',difficulty:keep?.difficulty??'normal',seconds:0,players:mode==='royale'?8:partyCapacity(mode,{players:8}),fill:false};
}
export function partyRules(mode:PartyMode,raw:unknown,base:PartyRules=defaultPartyRules(mode)):PartyRules{
  const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{},pool=PARTY_ARENAS[mode];
  const arena=pool.length>1&&(r.arena==='random'||r.arena==='vote')||typeof r.arena==='string'&&pool.includes(r.arena as StageId)?r.arena as PartyArena:base.arena;
  const bots=mode==='royale'||mode==='bad-blood'||mode==='last-stand';
  return {arena,
    difficulty:bots&&typeof r.difficulty==='string'&&DIFFICULTIES.includes(r.difficulty as Difficulty)?r.difficulty as Difficulty:base.difficulty,
    seconds:mode!=='royale'?0:r.seconds===0||DURATIONS.includes(r.seconds as never)?r.seconds as number:base.seconds,
    players:mode!=='royale'?partyCapacity(mode,base):(ROYALE_SEATS as readonly unknown[]).includes(r.players)?r.players as number:base.players,
    fill:mode!=='last-stand'?false:typeof r.fill==='boolean'?r.fill:base.fill};
}
export const partyCapacity=(mode:PartyMode,rules:{players:number})=>mode==='royale'?rules.players:mode==='duel'?2:mode==='bad-blood'?6:mode==='rift-war'?10:4;
export const modeSeats=(mode:PartyMode)=>mode==='royale'?ROYALE_SEATS.at(-1)!:partyCapacity(mode,{players:0});
export interface PartyMember {id:string;name:string;fighter:FighterId;ready:boolean;connected:boolean;status:'home'|'travelling'|'playing';role:RolePreference;}
export interface PartyView {code:string;leader:string;mode:PartyMode;members:PartyMember[];rules:PartyRules;votes:Record<string,StageId>;launching:boolean;}
export const isPartyMode=(v:unknown):v is PartyMode=>typeof v==='string'&&Object.hasOwn(PARTY_MODES,v);

export function modeBlocked(mode:PartyMode,count:number):string|undefined{
  if(mode==='duel'&&count!==2)return count<2?'NEEDS 2 PLAYERS':'1 V 1 ONLY';
  if(count>modeSeats(mode))return `UP TO ${modeSeats(mode)} PLAYERS`;
  return undefined;
}
export function voteCounts(view:Pick<PartyView,'mode'|'votes'|'members'>){
  const counts=new Map<StageId,number>(),pool=PARTY_ARENAS[view.mode];
  for(const m of view.members){const stage=view.votes[m.id];if(stage&&pool.includes(stage))counts.set(stage,(counts.get(stage)??0)+1);}
  return counts;
}
export function launchArena(view:Pick<PartyView,'mode'|'rules'|'votes'|'members'>,pick:(pool:readonly StageId[])=>StageId):StageId|'auto'{
  const pool=PARTY_ARENAS[view.mode];if(!pool.length)return 'auto';
  let arena=view.rules.arena;
  if(arena==='vote'){const counts=voteCounts(view);arena=[...pool].sort((a,b)=>(counts.get(b)??0)-(counts.get(a)??0)).find(s=>counts.has(s))??'random';}
  if(arena==='random')return view.mode==='royale'?'auto':pick(pool);
  return pool.includes(arena)?arena:'auto';
}
export const roomRules=(rules:PartyRules,arena:StageId|'auto'):CustomRules=>({arena,difficulty:rules.difficulty,seconds:rules.seconds,goal:120,players:rules.players});

export interface StartCheck {
  reason?:string;
  waiting:PartyMember[];
}
export function startCheck(view:PartyView):StartCheck{
  const others=view.members.filter(m=>m.id!==view.leader),count=view.members.length,first=(list:PartyMember[])=>list.map(m=>m.name).join(', ');
  if(view.launching)return {reason:'Launching…',waiting:[]};
  const away=view.members.filter(m=>m.status!=='home');
  if(away.length)return {reason:`${first(away)} ${away.length>1?'are':'is'} still in a match`,waiting:away};
  const dropped=view.members.filter(m=>!m.connected);
  if(dropped.length)return {reason:`Waiting for ${first(dropped)} to reconnect`,waiting:dropped};
  if(view.mode==='duel'&&count!==2)return {reason:count<2?'Invite a friend to duel':'A Duel is 1 v 1: choose another mode',waiting:[]};
  if(view.mode==='royale'&&count<2)return {reason:'Invite a friend, or choose a team mode',waiting:[]};
  const seats=partyCapacity(view.mode,view.rules);
  const field=view.mode==='royale'?ROYALE_SEATS.filter(n=>n>=count):[];
  if(count>seats)return {reason:field.length?`${seats} seats for ${count} players: choose ${field.join(' or ')} fighters`:`${seats} seats for ${count} players: choose another mode`,waiting:[]};
  if(view.mode==='rift-war'){for(const side of ['heroes','villains'] as const)if(view.members.filter(m=>factionOf(m.fighter)===side).length>5)return {reason:`Five ${side} at most: swap a fighter`,waiting:[]};}
  if(view.mode==='bad-blood'){
    const outside=view.members.filter(m=>!isBadBloodFighter(m.fighter));
    if(outside.length)return {reason:`${first(outside)}: choose a Bad Blood fighter`,waiting:outside};
    for(const side of ['heroes','villains'] as const)if(view.members.filter(m=>factionOf(m.fighter)===side).length>3)return {reason:`Three ${side} at most: swap a fighter`,waiting:[]};
  }
  const unready=others.filter(m=>!m.ready);
  if(unready.length)return {reason:`Waiting for ${first(unready)}`,waiting:unready};
  return {waiting:[]};
}
