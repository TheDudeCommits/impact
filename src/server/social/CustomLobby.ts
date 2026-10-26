import type {Client,Room} from 'colyseus';
import {ARENAS,customRules,defaultRules,type CustomLobby as View,type CustomMode} from '../../game/social/custom';
import type {StageId} from '../../game/types';
export class CustomLobby {
  readonly view:View;
  constructor(room:Room,mode:CustomMode,raw:unknown,private host:()=>string|null,private editable:()=>boolean){
    this.view={mode,rules:customRules(mode,raw),votes:{}};
    room.onMessage('custom-rules',(client,data:unknown)=>{
      if(!this.editable()||client.sessionId!==this.host()){client.send('notice',{message:'Only the host can change rules before the countdown.'});return;}
      const next=customRules(mode,data,this.view.rules);
      next.players=this.view.rules.players;this.view.rules=next;
    });
    room.onMessage('arena-vote',(client,data:unknown)=>this.vote(client,data));
  }
  vote(client:Client,data:unknown){if(this.editable()&&this.view.rules.arena==='vote'&&ARENAS[this.view.mode].includes(data as StageId))this.view.votes[client.sessionId]=data as StageId;}
  remove(id:string){delete this.view.votes[id];}
  snapshot():View{return {...this.view,rules:{...this.view.rules},votes:{...this.view.votes}};}
}
