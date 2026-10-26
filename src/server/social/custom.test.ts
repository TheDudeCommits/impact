import { ROSTER_PROTOCOL } from '../../game/rosterProtocol';
import {describe,it,expect,vi,afterEach} from 'vitest';
import type {Client,FixedTimestepCallback} from 'colyseus';
import {PrivateArenaRoom} from '../ArenaRoom';
import {OBJECTIVE_PROTOCOL} from '../../game/objectives/model';
import {ObjectiveRoom} from '../objectives/ObjectiveRoom';
import {assetSignature} from '../../game/social/assets';
import {customOf} from '../../game/social/custom';
const TOKEN='01234567-89ab-cdef-0123-456789abcdef';
afterEach(()=>vi.restoreAllMocks());
async function fixture(objective=false){
 const room=objective?new ObjectiveRoom():new PrivateArenaRoom();let step!:FixedTimestepCallback;const handlers=new Map<string,(c:Client,p?:unknown)=>void>();
 vi.spyOn(room,'setPrivate').mockResolvedValue(undefined);vi.spyOn(room,'setMetadata').mockResolvedValue(undefined);vi.spyOn(room,'broadcast').mockImplementation(()=>{});vi.spyOn(room,'lock').mockResolvedValue(undefined);vi.spyOn(room,'setFixedTimestep').mockImplementation(fn=>{step=fn;});
 vi.spyOn(room,'onMessage').mockImplementation(((type:string,handler:(c:Client,p?:unknown)=>void)=>{handlers.set(type,handler);return ()=>{};}) as never);
 await room.onCreate({rosterProtocol:ROSTER_PROTOCOL,creationToken:TOKEN,players:4,objective:'last-stand',access:'host'} as never);
 const join=(id:string)=>{const c={sessionId:id,send:vi.fn(),leave:vi.fn()} as unknown as Client;room.onJoin(c,{rosterProtocol:ROSTER_PROTOCOL,creationToken:TOKEN,objective:'last-stand',fighter:'goku',assetGate:true,objectiveProtocol:OBJECTIVE_PROTOCOL} as never);room.clients.push(c);return c;};
 const snapshot=()=>room instanceof ObjectiveRoom?room.game.snapshot():room.snapshot();
 const advance=(seconds:number)=>{for(let i=0;i<seconds*60;i++)step({dt:1/60,dtMs:1000/60,tick:i,subSteps:1,subDt:1/60,subDtMs:1000/60});};
 return {room,join,snapshot,advance,send:(c:Client,type:string,p?:unknown)=>handlers.get(type)?.(c,p)};
}
describe('custom rooms and streamed asset readiness',()=>{
 it('allows only host changes and member votes, then locks rules at kickoff',async()=>{const f=await fixture();try{const h=f.join('h'),g=f.join('g');f.send(g,'custom-rules',{arena:'onigashima',seconds:180});expect(customOf(f.snapshot())?.rules.seconds).toBe(0);f.send(h,'custom-rules',{arena:'vote',difficulty:'hard',seconds:180});f.send(g,'arena-vote','onigashima');f.send(h,'start-private-match');f.advance(4);expect(f.snapshot().stage).toBe('onigashima');expect(f.snapshot().status).toBe('waiting');expect(f.snapshot().players).toHaveLength(4);f.send(h,'custom-rules',{seconds:600});expect(customOf(f.snapshot())?.rules.seconds).toBe(180);f.send(h,'assets-ready','stale');f.send(g,'assets-ready',assetSignature(f.snapshot()));f.advance(1);expect(f.snapshot().status).toBe('waiting');f.send(h,'assets-ready',assetSignature(f.snapshot()));f.advance(.1);expect(f.snapshot().status).toBe('active');expect([...((f.room as PrivateArenaRoom).simulation.actors.values())].filter(a=>a.state.isBot).every(a=>a.botSkill===.95)).toBe(true);}finally{f.room.onDispose();}});
 it('keeps Last Stand village fixed and uses the asset barrier with the same asset barrier',async()=>{const f=await fixture(true);try{const h=f.join('h'),g=f.join('g');f.send(h,'custom-rules',{arena:'chunin-final',goal:60,seconds:180});f.send(g,'assign-team',{id:'h',role:'azure'});expect((f.room as ObjectiveRoom).game.seats.get('h')?.team).toBe('defenders');f.send(h,'assign-team',{id:'g',role:'ember'});expect((f.room as ObjectiveRoom).game.seats.get('g')?.team).toBe('defenders');f.send(h,'objective-start');f.advance(5);expect(f.snapshot().status).toBe('waiting');expect(f.snapshot().stage).toBe('hidden-leaf');for(const c of [h,g])f.send(c,'assets-ready',assetSignature(f.snapshot()));f.advance(3.2);expect(f.snapshot().status).toBe('active');const game=(f.room as ObjectiveRoom).game;expect(game.view.village?.hp).toBe(12000);expect(game.view.endsAt).toBe(0);}finally{f.room.onDispose();}});
 it('ends a timed royale fairly and publishes the timer',async()=>{const f=await fixture();try{const h=f.join('h'),g=f.join('g');f.send(h,'custom-rules',{seconds:180});f.send(h,'start-private-match');f.advance(4);for(const c of [h,g])f.send(c,'assets-ready',assetSignature(f.snapshot()));f.advance(.1);const sim=(f.room as PrivateArenaRoom).simulation;const end=customOf(f.snapshot())!.endsAt!;sim.actors.get('h')!.state.hp=900;sim.actors.get('g')!.state.hp=500;for(const p of sim.actors.values())if(p.state.isBot)p.state.hp=100;sim.serverTime=end;f.advance(.03);expect(sim.status).toBe('finished');expect(sim.winnerId).toBe('h');}finally{f.room.onDispose();}});
});
