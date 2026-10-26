import { ROSTER_PROTOCOL } from '../../game/rosterProtocol';
import {describe,it,expect,vi,afterEach} from 'vitest';
import type {Client,FixedTimestepCallback} from 'colyseus';
import {ObjectiveRoom} from './ObjectiveRoom';
import {OBJECTIVE_PROTOCOL,type ObjectiveKind,type ObjectiveSnapshot} from '../../game/objectives/model';
import {privateCodes,PRIVATE_WAIT_SECONDS} from '../privateCodes';
const TOKEN='01234567-89ab-cdef-0123-456789abcdef';
const client=(sessionId:string)=>({sessionId,send:vi.fn()} as unknown as Client);
afterEach(()=>vi.restoreAllMocks());
async function fixture(kind:ObjectiveKind='last-stand',access='host'){
 const room=new ObjectiveRoom();let tick!:FixedTimestepCallback;const handlers=new Map<string,(c:Client,p?:unknown)=>void>();
 vi.spyOn(room,'setPrivate').mockResolvedValue(undefined);vi.spyOn(room,'setMetadata').mockResolvedValue(undefined);vi.spyOn(room,'broadcast').mockImplementation(()=>{});vi.spyOn(room,'lock').mockResolvedValue(undefined);vi.spyOn(room,'unlock').mockResolvedValue(undefined);vi.spyOn(room,'setFixedTimestep').mockImplementation(fn=>{tick=fn;});
 vi.spyOn(room,'onMessage').mockImplementation(((type:string,handler:(c:Client,p?:unknown)=>void)=>{handlers.set(type,handler);return ()=>{};}) as never);
 await room.onCreate({rosterProtocol:ROSTER_PROTOCOL,objective:kind,access,creationToken:TOKEN});const code=room.roomId.slice('objective-'.length);
 const join=(id:string)=>{const c=client(id);room.onJoin(c,{rosterProtocol:ROSTER_PROTOCOL,objective:kind,fighter:'goku',code,name:id});room.clients.push(c);return c;};
 const advance=(seconds:number)=>{for(let i=0;i<seconds*60;i++)tick({dt:1/60,dtMs:1000/60,tick:i,subSteps:1,subDt:1/60,subDtMs:1000/60});};
 return {room,join,advance,code,send:(c:Client,type:string,p?:unknown)=>handlers.get(type)?.(c,p),handlers};
}
describe('objective room boundaries',()=>{
 it('asks stale rendered clients to refresh before joining the new stage',async()=>{const f=await fixture('bad-blood');try{const options={objective:'bad-blood',fighter:'goku',code:f.code,assetGate:true};expect(()=>f.room.onAuth(client('old'),{rosterProtocol:ROSTER_PROTOCOL,...options})).toThrow('Refresh Impact');expect(()=>f.room.onAuth(client('previous'),{rosterProtocol:ROSTER_PROTOCOL,...options,objectiveProtocol:OBJECTIVE_PROTOCOL-1})).toThrow('Refresh Impact');expect(()=>f.room.onAuth(client('current'),{rosterProtocol:ROSTER_PROTOCOL,...options,objectiveProtocol:OBJECTIVE_PROTOCOL})).not.toThrow();}finally{f.room.onDispose();}});

 it.each(['last-stand','bad-blood'] as const)('recovers a burst after a connection stall in %s without flooding rejections',async kind=>{
  const f=await fixture(kind);try{const host=f.join('host');expect(f.room.maxMessagesPerSecond).toBe(320);
   for(let i=0;i<160;i++)f.send(host,'input',{});
   expect(vi.mocked(host.send).mock.calls.filter(c=>c[0]==='input-rejected')).toHaveLength(1);
   f.send(host,'resync-input');expect(vi.mocked(host.send).mock.calls.some(c=>c[0]==='input-resync')).toBe(true);
   f.send(host,'input',{});expect(vi.mocked(host.send).mock.calls.filter(c=>c[0]==='input-rejected')).toHaveLength(2);
   f.room.onReconnect(host);f.send(host,'input',{});expect(vi.mocked(host.send).mock.calls.filter(c=>c[0]==='input-rejected')).toHaveLength(3);
  }finally{f.room.onDispose();}
 });
 it('requires a matching private code and mode and preserves shop ownership checks',async()=>{const f=await fixture();try{expect(()=>f.room.onAuth(client('bad'),{rosterProtocol:ROSTER_PROTOCOL,objective:'last-stand',code:'x'})).toThrow('room code');expect(()=>f.room.onAuth(client('bad'),{rosterProtocol:ROSTER_PROTOCOL,objective:'bad-blood',code:f.code})).toThrow('other game mode');expect(()=>f.room.onAuth(client('bad'),{rosterProtocol:ROSTER_PROTOCOL,objective:'last-stand',code:f.code,fighter:'kaido'})).toThrow();f.join('host');expect(f.room.setPrivate).toHaveBeenCalledWith(true);}finally{f.room.onDispose();}expect(privateCodes.has(f.code)).toBe(false);});
 it('lets only the host start and gives no training, score, health, or victory messages to clients',async()=>{const f=await fixture();try{const host=f.join('host'),guest=f.join('guest');f.send(guest,'objective-start');expect(f.room.game.view.phase).toBe('lobby');for(const cheat of ['training','score','damage','win'])expect(f.handlers.has(cheat)).toBe(false);f.send(host,'objective-start');f.advance(3.2);expect(f.room.game.view.phase).toBe('active');expect(f.room.game.seats.size).toBe(2);expect(()=>f.join('late')).toThrow('already started');expect(f.room.lock).toHaveBeenCalled();}finally{f.room.onDispose();}});
 it('clears the old round on rematch, keeps humans and roles, and sends fresh owner checkpoints',async()=>{const f=await fixture();try{const host=f.join('host'),guest=f.join('guest');f.send(host,'objective-start');f.advance(3.2);f.room.game.sim.damage('host',99999,'test','test');f.room.game.sim.damage('guest',99999,'test','test');f.advance(.1);expect(f.room.game.view.phase).toBe('over');f.send(guest,'objective-rematch');expect(f.room.game.view.round).toBe(1);f.send(host,'objective-rematch');expect(f.room.game.view.round).toBe(2);expect(f.room.game.view.phase).toBe('lobby');expect(f.room.game.seats.size).toBe(2);expect(f.room.game.seats.get('host')?.team).toBe('defenders');expect(f.room.game.sim.actors.get('host')?.state.hp).toBe(1000);expect(f.room.game.sim.serverTime).toBe(0);expect(f.room.unlock).toHaveBeenCalled();const packet=[...vi.mocked(host.send).mock.calls].reverse().find(c=>c[0]==='input-resync')?.[1] as ObjectiveSnapshot;expect(packet.objective.round).toBe(2);expect(packet.prediction?.host).toBeDefined();}finally{f.room.onDispose();}});
 it('matches quick players by mode, automatically fills, hands over host and expires old lobbies',async()=>{const quick=await fixture('bad-blood','quick');try{const a=quick.join('a');quick.join('b');quick.advance(12.2);expect(quick.room.game.seats.size).toBe(6);expect(quick.room.game.view.phase).toBe('countdown');quick.room.onLeave(a);expect(quick.room.game.view.hostId).toBe('b');expect(quick.room.game.seats.get('a')?.bot).toBe(true);}finally{quick.room.onDispose();}const f=await fixture();try{f.join('a');const close=vi.spyOn(f.room,'disconnect').mockResolvedValue(undefined);f.room.game.sim.serverTime=PRIVATE_WAIT_SECONDS;f.advance(.02);expect(close).toHaveBeenCalledWith(4004);}finally{f.room.onDispose();}});
});
