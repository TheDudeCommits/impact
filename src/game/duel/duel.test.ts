import { ROSTER_PROTOCOL } from '../rosterProtocol';
import {describe,it,expect,vi,afterEach} from 'vitest';
import type {Client,FixedTimestepCallback} from 'colyseus';
import {DuelRoom,PrivateDuelRoom} from '../../server/ArenaRoom';
import {assetSignature} from '../social/assets';
import {LocalDuel} from './LocalDuel';
import {readInvite,inviteUrl} from '../../ui/roomInvite';
const token='01234567-89ab-cdef-0123-456789abcdef';
afterEach(()=>vi.restoreAllMocks());
async function fixture(privateRoom=false){
 const room=privateRoom?new PrivateDuelRoom():new DuelRoom();let tick!:FixedTimestepCallback;
 const handlers=new Map<string,(c:Client,data:unknown)=>void>();
 vi.spyOn(room,'onMessage').mockImplementation(((type:string,fn:(c:Client,data:unknown)=>void)=>{handlers.set(type,fn);return ()=>{};}) as never);
 vi.spyOn(room,'setPrivate').mockResolvedValue(undefined);vi.spyOn(room,'setMetadata').mockResolvedValue(undefined);
 vi.spyOn(room,'broadcast').mockImplementation(()=>{});vi.spyOn(room,'lock').mockResolvedValue(undefined);vi.spyOn(room,'unlock').mockResolvedValue(undefined);
 vi.spyOn(room,'setFixedTimestep').mockImplementation(fn=>{tick=fn;});
 await room.onCreate({rosterProtocol:ROSTER_PROTOCOL,mode:'training',players:12,creationToken:token});
 const advance=(seconds=1/60)=>{for(let i=0;i<Math.ceil(seconds*60);i++)tick({dt:1/60,dtMs:1000/60,tick:i,subSteps:1,subDt:1/60,subDtMs:1000/60});};
 const join=(id:string,assetGate=false)=>{const c={sessionId:id,send:vi.fn(),leave:vi.fn()} as unknown as Client;room.onJoin(c,{rosterProtocol:ROSTER_PROTOCOL,fighter:id==='a'?'jotaro':'dio',code:room.snapshot().lobby?.code,assetGate});room.clients.push(c);return c;};
 const leave=(c:Client)=>{room.clients.splice(room.clients.indexOf(c),1);room.onLeave(c);};
 return {room,advance,join,leave,send:(c:Client,type:string,data:unknown)=>handlers.get(type)!(c,data)};
}
describe('Duel authority',()=>{
 it('waits indefinitely for a real rival, caps at two, rejects extra clients and starts with zero bots',async()=>{const f=await fixture();try{
  f.join('a');f.advance(30);expect(f.room.simulation.status).toBe('waiting');expect(f.room.botCount()).toBe(0);expect(f.room.maxClients).toBe(2);
  f.join('b');expect(()=>f.join('third')).toThrow('full');f.advance(7);expect(f.room.simulation.status).toBe('active');
  expect(f.room.snapshot().players.map(p=>p.fighter)).toEqual(['jotaro','dio']);expect(f.room.botCount()).toBe(0);
  expect(()=>f.join('late')).toThrow('started');
 }finally{f.room.onDispose();}});
 it('requires both exact asset acknowledgements, then gives a fresh countdown; departure resets pairing',async()=>{const f=await fixture();try{
  const a=f.join('a',true),b=f.join('b',true);f.advance(9);expect(f.room.simulation.status).toBe('waiting');
  f.send(a,'assets-ready',assetSignature(f.room.snapshot()));f.advance(2);expect(f.room.simulation.status).toBe('waiting');
  f.send(b,'assets-ready',assetSignature(f.room.snapshot()));f.advance(.1);expect(f.room.snapshot().lobby!.startsAt!-f.room.simulation.serverTime).toBeGreaterThan(2.8);
  f.leave(b);f.advance(6);expect(f.room.snapshot().lobby?.startsAt).toBeNull();expect(f.room.simulation.status).toBe('waiting');
  const c=f.join('c',true),sig=assetSignature(f.room.snapshot());f.send(a,'assets-ready',sig);f.send(c,'assets-ready',sig);f.advance(7);expect(f.room.simulation.status).toBe('active');
  f.leave(c);expect(f.room.simulation.winnerId).toBe('a');expect(f.room.simulation.status).toBe('finished');
 }finally{f.room.onDispose();}});
 it('keeps friend rooms private, enforces code and host start, with no field-size overrides',async()=>{const f=await fixture(true);try{
  expect(f.room.setPrivate).toHaveBeenCalledWith(true);expect(f.room.maxClients).toBe(2);expect(f.room.roomId).toMatch(/^duel-\d{6}$/);
  expect(()=>f.room.onAuth({sessionId:'x'} as Client,{rosterProtocol:ROSTER_PROTOCOL,code:'wrong'})).toThrow('room code');
  const a=f.join('a'),b=f.join('b');f.room.requestPrivateStart(b);f.advance(10);expect(f.room.simulation.status).toBe('waiting');
  f.room.requestPrivateStart(a);f.advance(7);expect(f.room.simulation.status).toBe('active');expect(f.room.botCount()).toBe(0);
 }finally{f.room.onDispose();}});
 it('uses distinct invite links without changing existing private/co-op links',()=>{for(const kind of ['duel','private','coop'] as const)expect(readInvite(inviteUrl({kind,code:'123456'},'https://impact.dude.work'))).toEqual({kind,code:'123456'});});
});
describe('local Bot Duel',()=>{
 it('runs the shared bot combat, pauses locally, plays first to two, retains the rival on runback and cleans up',async()=>{const duel=new LocalDuel();try{
  await duel.connect('jotaro','You');let seq=0;const step=()=>duel.send({seq:++seq,moveX:0,moveZ:0,yaw:0});
  expect(duel.snapshot!.players.map(p=>p.fighter)).toEqual(['jotaro','dio']);for(let i=0;i<185;i++)step();expect(duel.snapshot!.status).toBe('active');
  duel.paused=true;const held=duel.snapshot!.serverTime;step();expect(duel.snapshot!.serverTime).toBe(held);duel.paused=false;
  for(let i=0;i<1800;i++)step();expect(duel.snapshot!.players.find(p=>p.id==='you')!.damageTaken).toBeGreaterThan(0);
  duel.sim!.damage('duel-bot',1e6,'you','Test knockout');step();expect(duel.snapshot!.status).toBe('waiting');expect(duel.snapshot!.duel?.scores.you).toBe(1);
  for(let i=0;i<185;i++)step();expect(duel.snapshot!.status).toBe('active');
  duel.sim!.damage('duel-bot',1e6,'you','Second knockout');step();expect(duel.snapshot!.status).toBe('finished');expect(duel.snapshot!.duel?.scores.you).toBe(2);
  for(let i=0;i<600;i++)step();expect(duel.snapshot!.players.find(p=>p.id==='duel-bot')!.alive).toBe(false);
  const simulation=duel.sim;duel.room!.send('duel-runback');for(let i=0;i<125;i++)step();expect(duel.sim).toBe(simulation);expect(duel.snapshot!.duel?.set).toBe(2);expect(duel.snapshot!.status).toBe('active');expect(duel.snapshot!.duel?.scores).toEqual({});
 }finally{await duel.leave();}expect(duel.room).toBeNull();expect(duel.sim).toBeNull();});
});
