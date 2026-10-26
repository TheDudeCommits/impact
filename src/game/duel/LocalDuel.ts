import { isReleasedFighter, requireReleasedFighter } from '../rosterAvailability';
import {DuelSet} from './DuelSet';
import {ArenaSimulation} from '../simulation';
import {COMBO_HP,COMBO_STAMINA,MOVES,SIMULATION_HZ} from '../moves';
import {HELD} from '../economy/fighters';
import type {FighterId,GameSnapshot,PlayerInput,StageId} from '../types';
import {placeForStart} from '../stageChoice';
import {DeviceMatch} from '../economy/device';

export class LocalDuel {
  readonly local=true;
  set=new DuelSet();
  room:{send(type:string,payload?:unknown):void}|null=null;
  sim:ArenaSimulation|null=null;
  snapshot:GameSnapshot|null=null;
  receivedAt=0;predictionReady=false;paused=false;
  onSnapshot=(_snapshot:GameSnapshot)=>{};
  onControlReset=()=>{};
  onDisconnect=(_reason:string)=>{};
  onNotice=(_message:string)=>{};
  private startsAt=3;
  private rewards=new DeviceMatch();
  get id(){return this.sim?'you':'';}
  async connect(fighter:FighterId,name:string,rival?:FighterId,place?:StageId){
    requireReleasedFighter(fighter);
    if (rival !== undefined) requireReleasedFighter(rival);
    await this.leave();this.set=new DuelSet();
    const {createRapierCollision}=await import('../rapierCollision');
    const stage=placeForStart(place,'duel','offline')??'martial-arts-tournament';
    const sim=new ArenaSimulation({roomMode:'match',stage,collision:await createRapierCollision(stage),maxStamina:COMBO_STAMINA,maxHp:COMBO_HP});
    sim.addPlayer('you',fighter,name);
    const roster=(Object.keys(MOVES) as FighterId[]).filter(id=>id!==fighter&&isReleasedFighter(id)&&!HELD.has(id));
    const foe=rival&&isReleasedFighter(rival)&&!HELD.has(rival)?rival:fighter==='jotaro'?'dio':fighter==='dio'?'jotaro':sim.pick(roster);
    sim.addPlayer('duel-bot',foe,'Rival',true);
    this.sim=sim;this.startsAt=sim.serverTime+3;
    this.room={send:type=>{if(type==='duel-runback'){this.set.request(this.sim!,'you');this.onControlReset();this.publish();}}};this.predictionReady=true;this.publish();
  }
  send(input:PlayerInput){
    const sim=this.sim;if(!sim)return false;
    if(!this.paused){sim.submitInput('you',input);this.rewards.input(input);sim.step(1/SIMULATION_HZ);if(sim.status==='waiting'&&sim.serverTime>=this.startsAt)sim.startMatch();}
    this.set.step(sim);this.publish();return true;
  }
  private publish(){
    if(!this.sim)return;
    const snapshot=this.sim.snapshot(true);
    snapshot.lobby={duel:true,visibility:'public',hostId:null,canStart:false,startsAt:snapshot.status==='waiting'?this.startsAt:null,expiresAt:null,size:2};
    this.set.snapshot(snapshot);this.snapshot=snapshot;this.receivedAt=performance.now();this.rewards.observe(snapshot,'you');this.onSnapshot(snapshot);
  }
  startPrivateMatch(){}
  async leave(){this.sim?.dispose();this.sim=null;this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.paused=false;this.rewards.reset();}
}
