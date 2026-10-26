import {requireReleasedFighter} from '../rosterAvailability';
import type {FighterId,GameSnapshot,PlayerInput,StageId} from '../types';
import {placeForStart} from '../stageChoice';
import {ObjectiveMatch} from './ObjectiveMatch';
import {OBJECTIVE_STAGE,type ObjectiveKind} from './model';
import {DeviceMatch} from '../economy/device';

export class LocalObjective {
  readonly local=true;
  room:{send(type:string,payload?:unknown):void}|null=null;
  snapshot:GameSnapshot|null=null;receivedAt=0;predictionReady=false;paused=false;
  match:ObjectiveMatch|null=null;
  onSnapshot=(_snapshot:GameSnapshot)=>{};onControlReset=()=>{};onDisconnect=(_reason:string)=>{};onNotice=(_message:string)=>{};
  private generation=0;
  private rewards=new DeviceMatch();
  get id(){return this.match?'local-defender':'';}
  async connect(fighter:FighterId,name:string,kind:ObjectiveKind,access:'solo'|'bots',round=1,place?:StageId){
    requireReleasedFighter(fighter);
    await this.leave();const generation=this.generation;
    const stage=kind==='bad-blood'?placeForStart(place,'bad-blood','offline')??OBJECTIVE_STAGE[kind]:OBJECTIVE_STAGE[kind];
    const {createRapierCollision}=await import('../rapierCollision'),collision=await createRapierCollision(stage);
    if(generation!==this.generation){collision.dispose?.();return;}
    const match=new ObjectiveMatch(kind,collision,Math.floor(Math.random()*2147483646)+1,access,round);
    if(match.sim.stage!==stage)match.sim.setStage(stage);
    this.match=match;match.add(this.id,fighter,name);match.start();
    this.room={send:(type,payload)=>{if(type==='objective-buy'){const error=match.buy(this.id,payload);if(error)this.onNotice(error);this.publish();}}};
    this.predictionReady=true;this.publish();
  }
  send(input:PlayerInput){if(!this.match)return false;if(!this.paused){this.match.submit(this.id,input);this.rewards.input(input);this.match.step(1/60);this.publish();}return true;}
  private publish(){if(!this.match)return;this.snapshot=this.match.snapshot(true);this.receivedAt=performance.now();this.rewards.observe(this.snapshot,this.id);this.onSnapshot(this.snapshot);}
  startPrivateMatch(){}
  async leave(){this.generation++;this.match?.dispose();this.match=null;this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.paused=false;this.rewards.reset();}
}
