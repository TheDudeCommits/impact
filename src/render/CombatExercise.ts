import type { GameSnapshot, PlayerInput } from '../game/types';
import {MOVES} from '../game/moves';

export class CombatExercise {
  constructor(private contactExercise=false){}
  private started=0;
  private sent=new Set<string>();
  private finish?:()=>void;
  get active(){return Boolean(this.finish);}
  start(sendTraining:(command:string)=>void):Promise<void>{
    this.finish?.();this.sent.clear();this.started=performance.now();
    sendTraining('passive');sendTraining('reset');sendTraining('awakening');
    return new Promise(resolve=>{this.finish=resolve;});
  }
  command(input:PlayerInput,snapshot:GameSnapshot,selfId:string):PlayerInput{
    if(!this.finish)return input;
    const age=(performance.now()-this.started)/1000;
    if(age>=22){this.finish();this.finish=undefined;return input;}
    const self=snapshot.players.find(p=>p.id===selfId),foe=snapshot.players.find(p=>p.isBot);
    if(!self||!foe||snapshot.roomMode!=='training')return input;
    const dx=foe.x-self.x,dz=foe.z-self.z,distance=Math.hypot(dx,dz);
    const result:PlayerInput={seq:input.seq,moveX:0,moveZ:0,yaw:Math.atan2(dx,dz),targetId:foe.id};
    if(age>.2&&age<.9&&distance>1.55){result.moveX=dx/Math.max(1,distance);result.moveZ=dz/Math.max(1,distance);}
    if(['kakashi','sasuke','zoro','ichigo'].includes(self.fighter)&&age>2.55&&age<2.95){result.moveX=-dx/Math.max(1,distance);result.moveZ=-dz/Math.max(1,distance);}
    if(self.fighter==='luffy'&&age>4.8&&age<5.6&&distance>3.6){result.moveX=dx/Math.max(1,distance);result.moveZ=dz/Math.max(1,distance);}
    if(['sanji','jotaro'].includes(self.fighter)&&((age>4.8&&age<5.6)||(age>8.7&&age<10))&&distance>1.35){result.moveX=dx/Math.max(1,distance);result.moveZ=dz/Math.max(1,distance);}
    if(this.contactExercise&&['idle','run'].includes(self.action)){
      const next=age>2.25&&age<2.95?'heavy':age>4.8&&age<5.95?'special':age>8.5&&age<10.25?'ultimate':undefined;
      if(next&&MOVES[self.fighter][next].style==='melee'&&distance>1.3){result.moveX=dx/Math.max(1,distance);result.moveZ=dz/Math.max(1,distance);}
    }
    if(age>4.65&&age<4.95)result.guard=true;
    const cues=[['light',1.8],['heavy',3.0],['dash',5.05],['special',6.0],['ultimate',10.3],['light',18.5]] as const;
    for(const [action,time]of cues){const cue=action+'-'+time;if(age>=time&&!this.sent.has(cue)){this.sent.add(cue);if(action==='dash'){result.dash=true;result.moveX=-dx/Math.max(1,distance);result.moveZ=-dz/Math.max(1,distance);}else result.attack=action;}}
    return result;
  }
}
