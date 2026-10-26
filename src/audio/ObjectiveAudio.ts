import type {CombatAudio} from './CombatAudio';
import {LINES,VOICE_OF,PITCH,type Family} from './survivalBank';
import {objectiveOf} from '../game/objectives/model';
import type {GameSnapshot} from '../game/types';

const families=[...new Set(Object.values(LINES).flatMap(line=>Object.values(line)))];
const sample=(family:Family,i=0)=>`/assets/audio/survival/${family}-${1+i%3}.m4a`;
export class ObjectiveAudio {
  private round='';private lastEvent=0;private wave=0;private spent=0;private hp=0;private alive=true;private nextVoice=0;private nextAlarm=0;
  private bossCue='';
  private siegePhase='';
  constructor(private audio:CombatAudio){}
  reset(){this.round='';this.bossCue='';this.siegePhase='';this.lastEvent=0;this.nextVoice=this.nextAlarm=0;}
  preload(){this.audio.preload(families.flatMap(f=>[0,1,2].map(i=>sample(f,i))).concat('/assets/audio/survival/stomp-1.m4a'));}
  update(snapshot:GameSnapshot,ownId:string){
    const v=objectiveOf(snapshot),self=snapshot.players.find(p=>p.id===ownId);if(!v||!self)return;
    const key=`${v.code}:${v.round}`,now=snapshot.serverTime,seat=v.seats.find(s=>s.id===ownId),at={x:self.x,y:self.y+1,z:self.z};
    if(key!==this.round){this.round=key;this.siegePhase='';this.bossCue='';this.lastEvent=0;this.wave=0;this.spent=seat?.spent??0;this.hp=v.village?.hp??0;this.alive=self.alive;}
    if(v.phase!=='active')return;
    if(v.village){
      if(this.siegePhase==='assault'&&v.village.phase==='preparation')this.audio.cue('energy-tail',at,.25,1.25,'wave-clear',2);
      this.siegePhase=v.village.phase;
      const boss=v.village.bossActor?`${v.village.bossActor}:${v.village.bossPhase??0}`:'';
      if(boss&&boss!==this.bossCue){this.bossCue=boss;this.audio.cue('ground',at,.35,.65,'boss-phase',2);this.audio.sample('/assets/audio/survival/stomp-1.m4a',at,.35,.6,'boss-phase',2,.18);}
      if(!boss)this.bossCue='';
      if(v.village.wave>this.wave){this.wave=v.village.wave;this.audio.sample('/assets/audio/survival/stomp-1.m4a',at,.45,.72,'mission',2);}
      if(v.village.hp<this.hp&&now>=this.nextAlarm){this.nextAlarm=now+4;this.audio.cue('ground',at,.27,.65,'village-warning',2);}
      this.hp=v.village.hp;
      if((seat?.spent??0)>this.spent){this.spent=seat!.spent;this.audio.cue('energy-tail',at,.2,1.6,'purchase',2);}
      for(const e of snapshot.events){
        if(e.id<=this.lastEvent)continue;this.lastEvent=e.id;
        const p=snapshot.players.find(p=>p.id===(e.kind==='eliminated'?e.targetId:e.actorId));
        if(!p?.enemy||now<this.nextVoice||Math.hypot(p.x-self.x,p.z-self.z)>24)continue;
        if(e.kind!=='cast'&&e.kind!=='eliminated')continue;
        const family=LINES[VOICE_OF[p.enemy]??'man'][e.kind==='cast'?'swing':'die'];
        this.audio.sample(sample(family,e.id),{x:p.x,y:p.y+1.3,z:p.z},.34,PITCH[p.enemy]??1,p.id,0);this.nextVoice=now+.35;
      }
    }
    if(!this.alive&&self.alive){this.audio.cue('charge-chakra',at,.2,1.35,'return',2);this.audio.cue('energy-tail',at,.2,1.5,'return',2,.12);}
    this.alive=self.alive;
  }
}
