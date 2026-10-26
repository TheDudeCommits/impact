import type {Client,Room,SeatReservation} from '@colyseus/sdk';
import type {FighterId} from '../game/types';
export async function joinRiftPublic(client:Client,endpoint:string,options:{rosterProtocol:string;fighter:FighterId;riftProtocol:number;[key:string]:unknown}):Promise<Room>{
 const response=await fetch(endpoint.replace(/^ws/,'http').replace(/\/$/,'')+'/rift-war/reserve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rosterProtocol:options.rosterProtocol,fighter:options.fighter,riftProtocol:options.riftProtocol,name:options.name,account:options.account,assetGate:options.assetGate}),signal:AbortSignal.timeout(10000)});
 let data:unknown;try{data=await response.json();}catch{throw new Error('Could not reach Rift War matchmaking. Try again.');}
 if(!response.ok)throw new Error(data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:'Could not reserve a Rift War seat. Try again.');
 const ticket=data as Partial<SeatReservation>|null;
 if(!ticket||typeof ticket.sessionId!=='string'||ticket.name!=='rift_war'||typeof ticket.roomId!=='string'||!/^rift-\d{6}$/.test(ticket.roomId))throw new Error('Invalid Rift War reservation. Refresh and try again.');
 return client.consumeSeatReservation(ticket as SeatReservation);
}
