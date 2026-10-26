import { ROSTER_PROTOCOL, ROSTER_REFRESH_MESSAGE } from '../../game/rosterProtocol';
import { isReleasedFighter } from '../../game/rosterAvailability';
import { ARENAS_FULL_MESSAGE, isArenasFull } from '../../game/arenasFull';
import {matchMaker} from 'colyseus';
import {randomUUID} from 'node:crypto';
import {MOVES} from '../../game/moves';
import type {FighterId} from '../../game/types';
import {factionOf} from '../../game/objectives/model';
import {RIFT_PROTOCOL,type RiftTeam} from '../../game/moba/model';
import {lockedOut} from '../../game/economy/fighters';
import {sharedEconomy} from '../economy/api';
import {remoteEconomy} from '../cluster/economyLink';
import type {RiftRoom} from './RiftRoom';
type Listing=Awaited<ReturnType<typeof matchMaker.createRoom>>;
export interface PublicRiftOptions {rosterProtocol:string;access:'quick';fighter:FighterId;riftProtocol:number;name?:string;account?:string;assetGate?:boolean;}
export class RiftQueueError extends Error {constructor(message:string,readonly status=400){super(message);}}
export function publicRiftOptions(raw:unknown):PublicRiftOptions {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new RiftQueueError('Choose a fighter for Rift War.');
 const o=raw as Record<string,unknown>;
 if(o.rosterProtocol!==ROSTER_PROTOCOL)throw new RiftQueueError(ROSTER_REFRESH_MESSAGE,409);
 if(o.riftProtocol!==RIFT_PROTOCOL)throw new RiftQueueError('Refresh Impact to load Rift War.');
 if(typeof o.fighter!=='string'||!isReleasedFighter(o.fighter))throw new RiftQueueError('Choose an available fighter.');
 if(o.account!==undefined&&(typeof o.account!=='string'||o.account.length>256))throw new RiftQueueError('Reload your account before joining.');
 if(o.name!==undefined&&(typeof o.name!=='string'||o.name.length>80))throw new RiftQueueError('Choose a shorter player name.');
 if(o.assetGate!==undefined&&typeof o.assetGate!=='boolean')throw new RiftQueueError('Refresh Impact to join.');
 const options:PublicRiftOptions={rosterProtocol:ROSTER_PROTOCOL,access:'quick',fighter:o.fighter as FighterId,riftProtocol:RIFT_PROTOCOL};
 if(typeof o.account==='string')options.account=o.account;
 if(typeof o.name==='string')options.name=o.name;
 if(typeof o.assetGate==='boolean')options.assetGate=o.assetGate;
 const locked=lockedOut(options.fighter,sharedEconomy()?.book.find(options.account));if(locked)throw new RiftQueueError(locked,403);
 return options;
}
export async function retireFailedRiftReservation(room:RiftRoom,sessionId:string){
 const native=room as unknown as {
  _reservedSeats?:Record<string,[unknown,unknown,boolean?,boolean?]>;
  _reservedSeatTimeouts?:Record<string,unknown>;
  _listing?:Parameters<typeof matchMaker.driver.update>[0];
  resetAutoDisposeTimeout?:(seconds?:number)=>void;
 };
 if(!native._reservedSeats||!native._reservedSeatTimeouts||!native._listing||!native.resetAutoDisposeTimeout)return;
 const seat=native._reservedSeats[sessionId];
 if(!seat||seat[2]!==false||seat[3]===true||native._reservedSeatTimeouts[sessionId]||room.game.seats.has(sessionId)||room.clients.some(c=>c.sessionId===sessionId))return;
 delete native._reservedSeats[sessionId];
 native.resetAutoDisposeTimeout.call(room,1);
 const occupied=new Set([...room.clients.map(c=>c.sessionId),...Object.keys(native._reservedSeats)]);
 await matchMaker.driver.update(native._listing,{$set:{clients:occupied.size}});
 await room.setMatchmaking({maxClients:room.maxClients});
}
export class PublicRiftMatchmaker {
 private tail:Promise<unknown>=Promise.resolve();private waiting=0;
 private readonly pending=new Map<string,Map<string,RiftTeam>>();
 async reserve(raw:unknown){
  const remote=remoteEconomy();if(remote)await remote.learn((raw as {account?:unknown}|null)?.account);
  const options=publicRiftOptions(raw);
  if(this.waiting>=128)throw new RiftQueueError('Matchmaking is busy. Try again in a moment.',429);
  this.waiting++;
  const result=this.tail.then(()=>this.allocate(options));this.tail=result.then(()=>undefined,()=>undefined);
  try{return await result;}finally{this.waiting--;}
 }
 private local(id:string){const room=matchMaker.getLocalRoomById(id) as RiftRoom|undefined;return room?.game?room:undefined;}
 private retire(){
  for(const [roomId,seats] of this.pending){const room=this.local(roomId);if(!room){this.pending.delete(roomId);continue;}
   for(const id of seats.keys())if(room.game.seats.has(id)||!room.hasReservedSeat(id))seats.delete(id);
   if(!seats.size)this.pending.delete(roomId);
  }
 }
 private counts(room:RiftRoom){const n={heroes:0,villains:0};for(const seat of room.game.seats.values())n[seat.team]++;
  for(const [id,team] of this.pending.get(room.roomId)??[])if(!room.game.seats.has(id))n[team]++;return n;}
 private async allocate(options:PublicRiftOptions){
  await new Promise<void>(resolve=>setImmediate(resolve));
  this.retire();const team=factionOf(options.fighter),other=team==='heroes'?'villains':'heroes';
  const listings=await matchMaker.query({name:'rift_war',private:false,locked:false});
  const candidates=listings.flatMap(listing=>{const room=this.local(listing.roomId);if(!room||room.game.view.access!=='quick'||room.game.view.phase!=='lobby'||room.locked)return [];
   const count=this.counts(room);return count[team]<5&&count.heroes+count.villains<10?[{listing,room,count}]:[];});
  candidates.sort((a,b)=>b.count[other]-a.count[other]||(b.count.heroes+b.count.villains)-(a.count.heroes+a.count.villains));
  for(const candidate of candidates.slice(0,16))try{return await this.assign(candidate.listing,options,team);}catch{ }
  if(this.pending.size>=256)throw new RiftQueueError('Matchmaking is busy. Try again shortly.',429);
  const listing=await matchMaker.createRoom('rift_war',options);
  try{return await this.assign(listing,options,team);}catch(error){
   const room=this.local(listing.roomId);
   if(room&&room.game.seats.size===0&&room.clients.length===0)await room.disconnect().catch(()=>{});
   throw error;
  }
 }
 private async assign(listing:Listing,options:PublicRiftOptions,team:RiftTeam){
  const room=this.local(listing.roomId);if(!room||room.game.view.phase!=='lobby'||room.locked||this.counts(room)[team]>=5)throw new RiftQueueError('That war is filling. Try again.',503);
  const sessionId=randomUUID();let ticket:Awaited<ReturnType<typeof matchMaker.reserveSeatFor>>;
  try{ticket=await matchMaker.reserveSeatFor(listing,options,{sessionId});}catch(error){
   await retireFailedRiftReservation(room,sessionId).catch(()=>{});throw error;
  }
  let reservations=this.pending.get(listing.roomId);if(!reservations)this.pending.set(listing.roomId,reservations=new Map());
  reservations.set(ticket.sessionId,team);return ticket;
 }
}
interface Request {body?:unknown;on(event:string,listener:(chunk?:Buffer)=>void):unknown;}
interface Response {statusCode:number;setHeader(key:string,value:string):unknown;end(body?:string):unknown;}
interface App {post(path:string,handler:(req:Request,res:Response)=>void):unknown;options(path:string,handler:(req:Request,res:Response)=>void):unknown;}
async function readBody(req:Request):Promise<unknown>{
 if(req.body!==undefined)return req.body;
 return new Promise((resolve,reject)=>{const chunks:Buffer[]=[];let bytes=0,settled=false;
  const timer=setTimeout(()=>finish(new RiftQueueError('Matchmaking request timed out.',408)),5000);timer.unref?.();
  const finish=(error?:Error,value?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
  req.on('data',chunk=>{if(settled||!chunk)return;bytes+=chunk.length;if(bytes>4096){finish(new RiftQueueError('That matchmaking request is too large.',413));return;}chunks.push(chunk);});
  req.on('end',()=>{if(settled)return;try{finish(undefined,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{finish(new RiftQueueError('Send a valid matchmaking request.'));}});
  req.on('error',()=>finish(new RiftQueueError('The matchmaking request broke off.')));
 });
}
export function mountPublicRiftMatchmaker(app:App,allocator=new PublicRiftMatchmaker()){
 const headers=(res:Response)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','content-type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Cache-Control','no-store');};
 app.options('/rift-war/reserve',(_req,res)=>{headers(res);res.statusCode=204;res.end();});
 app.post('/rift-war/reserve',(req,res)=>{headers(res);res.setHeader('Content-Type','application/json');void readBody(req).then(raw=>allocator.reserve(raw)).then(ticket=>{res.statusCode=200;res.end(JSON.stringify(ticket));}).catch((error:unknown)=>{res.statusCode=error instanceof RiftQueueError?error.status:503;res.end(JSON.stringify({error:error instanceof RiftQueueError?error.message:isArenasFull(error)?ARENAS_FULL_MESSAGE:'Could not reserve a Rift War seat. Try again.'}));});});
}
