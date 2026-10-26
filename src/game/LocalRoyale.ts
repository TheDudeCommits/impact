import { isReleasedFighter, requireReleasedFighter } from './rosterAvailability';
import { ArenaSimulation } from './simulation';
import { COMBO_HP, COMBO_STAMINA, KO_HEAL, SIMULATION_HZ } from './moves';
import { RoyaleDeck, type StageId } from './stages';
import { placeForStart } from './stageChoice';
import { draftBots } from './matchmaking';
import type { FighterId, GameSnapshot, PlayerInput } from './types';
import { DeviceMatch } from './economy/device';

export class LocalRoyale {
  readonly local=true;
  room:{send(type:string,payload?:unknown):void}|null=null;
  sim:ArenaSimulation|null=null;
  snapshot:GameSnapshot|null=null;
  receivedAt=0;predictionReady=false;paused=false;
  onSnapshot=(_snapshot:GameSnapshot)=>{};
  onControlReset=()=>{};
  onDisconnect=(_reason:string)=>{};
  onNotice=(_message:string)=>{};
  private startsAt=3;
  private stages=new RoyaleDeck();
  private rewards=new DeviceMatch();
  get id(){return this.sim?'you':'';}
  async connect(fighter:FighterId,name:string,players=8,place?:StageId,field?:readonly FighterId[]){
    requireReleasedFighter(fighter);
    await this.leave();
    const {createRapierCollision}=await import('./rapierCollision');
    const sim=new ArenaSimulation({roomMode:'match',maxStamina:COMBO_STAMINA,maxHp:COMBO_HP,koHeal:KO_HEAL}), size=[4,6,8,10,12].includes(players)?players:8;
    const stage=placeForStart(place,'royale','offline',size)??this.stages.deal(pool=>sim.pick(pool),size);
    try {sim.setStage(stage,await createRapierCollision(stage));} catch(error){sim.dispose();throw error;}
    sim.addPlayer('you',fighter,name);
    const drafted=field&&field.length>=size-1&&field.every(isReleasedFighter)?field.slice(0,size-1):draftBots([fighter],size-1,items=>sim.shuffle(items));
    for(const [i,foe] of drafted.entries())sim.addPlayer(`bot-${i+1}`,foe,foe.replaceAll('-',' '),true);
    this.sim=sim;this.startsAt=sim.serverTime+3;this.room={send:()=>{}};this.predictionReady=true;this.publish();
  }
  send(input:PlayerInput){
    const sim=this.sim;if(!sim)return false;
    if(!this.paused){sim.submitInput('you',input);this.rewards.input(input);sim.step(1/SIMULATION_HZ);if(sim.status==='waiting'&&sim.serverTime>=this.startsAt)sim.startMatch();}
    this.publish();return true;
  }
  private publish(){
    if(!this.sim)return;
    const snapshot=this.sim.snapshot(true);
    snapshot.lobby={visibility:'public',hostId:null,canStart:false,startsAt:snapshot.status==='waiting'?this.startsAt:null,expiresAt:null,size:snapshot.players.length};
    this.snapshot=snapshot;this.receivedAt=performance.now();this.rewards.observe(snapshot,'you');this.onSnapshot(snapshot);
  }
  startPrivateMatch(){}
  async leave(){this.sim?.dispose();this.sim=null;this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.paused=false;this.rewards.reset();}
}
