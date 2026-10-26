import type {CombatAudio} from './CombatAudio';
import type {GameSnapshot} from '../game/types';
import {warfrontAt} from '../game/moba/warfront';
import {riftOf} from '../game/moba/model';

export class RiftAudio {
  private key='';private lastEvent=0;private lastTime=-Infinity;private nextWard=0;private front=-1;
  constructor(private audio:Pick<CombatAudio,'cue'>){}
  reset(){this.key='';this.lastEvent=0;this.lastTime=-Infinity;this.nextWard=0;this.front=-1;}
  update(snapshot:GameSnapshot,ownId:string){
    const war=riftOf(snapshot),self=snapshot.players.find(p=>p.id===ownId);
    if(!war||!self)return;
    const key=`${war.code??'offline'}:${war.round}:${ownId}`,now=snapshot.serverTime;
    if(this.key!==key||now<this.lastTime){this.reset();this.key=key;}
    this.lastTime=now;
    if(war.phase==='lobby'||war.phase==='countdown')return;
    const at={x:self.x,y:self.y+1,z:self.z};let played=0;
    const front=warfrontAt(now-war.startedAt).tier;if(this.front>=0&&front>this.front){this.audio.cue('ground',at,.22,.8,'rift-escalation',1);played++;}this.front=front;
    for(const event of war.events){
      if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;
      if(event.hidden||now-event.at>1.2||played>=2)continue;
      const own=event.actorId===ownId;
      if(own&&(event.kind==='purchase'||event.kind==='level'||event.kind==='rune')){
        this.audio.cue('energy-tail',at,event.kind==='level'?.24:.17,event.kind==='level'?1.35:1.6,'rift-progress',1);played++;
      }else if(own&&(event.kind==='recall'||event.kind==='buyback')){
        this.audio.cue('charge-chakra',at,.18,1.35,'rift-return',1);played++;
      }else if(event.kind==='tower'||event.kind==='barracks'||event.kind==='core'||event.kind==='boss'){
        this.audio.cue(event.team===self.team?'energy-tail':'ground',at,.26,event.team===self.team?1.05:.7,'rift-objective',2);played++;
      }else if(event.kind==='bolt'&&event.targetId===ownId&&now>=this.nextWard&&war.structures.some(s=>s.id===event.actorId&&(s.kind==='tower'||s.kind==='guardian'))){
        this.nextWard=now+1;this.audio.cue('crack',at,.12,.8,'rift-ward',1);played++;
      }
    }
  }
}
