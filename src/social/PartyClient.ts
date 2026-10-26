import { ROSTER_PROTOCOL } from '../game/rosterProtocol';
import {RIFT_PROTOCOL} from '../game/moba/model';
import {OBJECTIVE_PROTOCOL} from '../game/objectives/model';
import {Client,type Room,type SeatReservation} from '@colyseus/sdk';
import type {FighterId} from '../game/types';
import type {PartyView,PartyMode} from '../game/social/party';
import {COOP_LINK,SURVIVAL_PROTOCOL} from '../survival/coopNet';
import {carried} from '../survival/progressStore';
import {joinFailure} from '../network';
export interface PartyTravel {id:string;mode:PartyMode;reservation:SeatReservation;}
export class PartyClient {
  room:Room|null=null;view?:PartyView;connecting=false;online=true;
  onChange=()=>{};onNotice=(_message:string)=>{};onTravel=async(_travel:PartyTravel):Promise<boolean>=>false;private travelId='';private travelState:'loading'|'playing'|'failed'='loading';onReturn=()=>{};
  constructor(private profile:()=>{fighter:FighterId;name:string}){}
  get id(){return this.room?.sessionId??'';}
  get joined(){return !!this.room;}
  private identity(){const p=this.profile();return {...p,rosterProtocol:ROSTER_PROTOCOL,riftProtocol:RIFT_PROTOCOL,objectiveProtocol:OBJECTIVE_PROTOCOL,survivalProtocol:SURVIVAL_PROTOCOL,account:COOP_LINK.token,...carried(p.fighter)};}
  async connect(code?:string){
    if(this.connecting||this.room)return;this.connecting=true;this.onChange();
    try{const url=import.meta.env.VITE_MATCH_SERVER||`${location.protocol==='https:'?'https':'http'}://${location.hostname}:2567`,client=new Client(url);
      if(code&&!/^\d{6}$/.test(code))throw new Error('Enter the six-digit party code.');
      const room=code?await client.joinById('party-'+code,{...this.identity(),code}):await client.create('party',{...this.identity(),creationToken:crypto.randomUUID()});
      this.room=room;this.online=true;room.reconnection.minUptime=0;
      room.onMessage('party',(view:PartyView)=>{if(this.room===room){this.view=view;this.onChange();}});
      room.onMessage('party-travel',async(travel:PartyTravel)=>{if(this.room!==room)return;if(this.travelId===travel.id){if(this.travelState==='playing')this.send('party-arrived',travel.id);return;}this.travelId=travel.id;this.travelState='loading';let joined=false;try{joined=await this.onTravel(travel);}catch{}if(this.room!==room||this.travelId!==travel.id)return;this.travelState=joined?'playing':'failed';this.send(joined?'party-arrived':'party-failed',travel.id);});
      room.onMessage('party-return',({message}:{message:string})=>{if(this.room===room){this.travelId='';this.onReturn();this.onNotice(message);}});
      room.onMessage('notice',({message}:{message:string})=>this.onNotice(message));
      room.onDrop(()=>{this.online=false;this.onChange();});room.onReconnect(()=>{this.online=true;room.send('party-sync');if(this.travelId&&this.travelState!=='loading')this.send(this.travelState==='playing'?'party-arrived':'party-failed',this.travelId);this.onChange();});
      room.onLeave(()=>{if(this.room===room){this.room=null;this.view=undefined;this.onChange();this.onNotice('You left the party.');}});
      room.onError(()=>{this.onNotice('Party connection interrupted. Reconnecting…');});room.send('party-sync');
    }catch(e){const message=e instanceof Error?e.message:'';this.onNotice(joinFailure(e)??(code&&/not found|no rooms? found|locked/i.test(message)?'No party is open with that code. Check it, or ask for a new invite.':message||'Could not connect to the party.'));}
    finally{this.connecting=false;this.onChange();}
  }
  send(type:string,value?:unknown){if(this.online&&this.room?.connection.isOpen)this.room.send(type,value);}
  profileChanged(){this.send('party-profile',this.identity());}
  async leave(){const room=this.room;this.room=null;this.view=undefined;this.travelId='';if(room){room.reconnection.enabled=false;room.reconnection.enqueuedMessages=[];if(room.connection.isOpen)await room.leave();}this.onChange();}
}
