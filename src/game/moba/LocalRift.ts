import {requireReleasedFighter} from '../rosterAvailability';
import type {FighterId,GameSnapshot,PlayerInput} from '../types';
import {RIFT_STAGE} from './model';
import {snapshotFor} from './vision';
import {RiftMatch} from './RiftMatch';
export class LocalRift {
  readonly local=true;
  room:{send(type:string,payload?:unknown):void}|null=null;
  snapshot:GameSnapshot|null=null;
  receivedAt=0;
  predictionReady=false;
  paused=false;
  match:RiftMatch|null=null;
  onSnapshot:(snapshot:GameSnapshot)=>void=()=>{};
  onControlReset:()=>void=()=>{};
  onDisconnect:(message:string)=>void=()=>{};
  onNotice:(message:string)=>void=()=>{};
  private generation=0;
  get id(){return this.match?'local-rift-fighter':'';}
  async connect(fighter:FighterId,name:string,round=1){
    requireReleasedFighter(fighter);
    await this.leave();const generation=this.generation,{createRapierCollision}=await import('../rapierCollision'),collision=await createRapierCollision(RIFT_STAGE);
    if(generation!==this.generation){collision.dispose?.();return;}
    this.match=new RiftMatch({collision,seed:Math.random()*0x7fffffff|0||1,access:'bots',round});
    this.match.add(this.id,fighter,name);this.match.start();this.paused=false;
    this.room={send:(type,payload)=>{let error:unknown;if(type==='rift-buy')error=this.match?.buy(this.id,payload);else if(type==='rift-buyback')error=this.match?.buyback(this.id);else if(type==='rift-recall')error=this.match?.recall(this.id);else if(type==='rift-ping')error=this.match?.ping(this.id,payload);if(typeof error==='string')this.onNotice(error);this.publish();}};
    this.predictionReady=true;this.publish();
  }
  startPrivateMatch(){}
  send(input:PlayerInput){if(!this.match||this.paused)return;this.match.submit(this.id,input);this.match.step(1/60);this.publish();}
  private publish(){if(!this.match)return;this.snapshot=snapshotFor(this.match.snapshot(true),this.id);this.receivedAt=performance.now();this.onSnapshot(this.snapshot);}
  async leave(){this.generation++;this.match?.dispose();this.match=null;this.room=null;this.snapshot=null;this.receivedAt=0;this.predictionReady=false;this.paused=false;}
}
