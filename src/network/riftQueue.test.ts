import { ROSTER_PROTOCOL } from '../game/rosterProtocol';
import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Client} from '@colyseus/sdk';
import {joinRiftPublic} from './riftQueue';
const options={rosterProtocol:ROSTER_PROTOCOL,fighter:'goku' as const,riftProtocol:1,access:'quick'},ticket={name:'rift_war',roomId:'rift-123456',sessionId:'session',processId:'process'};
afterEach(()=>vi.unstubAllGlobals());
function fixture(data:unknown=ticket,ok=true){vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok,json:async()=>data}));return {consumeSeatReservation:vi.fn().mockResolvedValue('joined'),joinOrCreate:vi.fn(),create:vi.fn()};}
describe('Rift authoritative public reservation',()=>{
 it('consumes the assigned faction seat with only known request fields',async()=>{const c=fixture();expect(await joinRiftPublic(c as unknown as Client,'wss://example.test/',{...options,party:10,gold:9000,account:'credential',name:'Name',assetGate:true})).toBe('joined');expect(c.consumeSeatReservation).toHaveBeenCalledWith(ticket);const [url,init]=vi.mocked(fetch).mock.calls[0];expect(url).toBe('https://example.test/rift-war/reserve');expect(init?.method).toBe('POST');expect(JSON.parse(init?.body as string)).toEqual({rosterProtocol:ROSTER_PROTOCOL,fighter:'goku',riftProtocol:1,account:'credential',name:'Name',assetGate:true});expect(c.create).not.toHaveBeenCalled();});
 it('preserves actionable server account and protocol errors without creating another room',async()=>{const c=fixture({error:'Fighter is locked: unlock them in Account to play here.'},false);await expect(joinRiftPublic(c as unknown as Client,'https://example.test',options)).rejects.toThrow('unlock');expect(c.consumeSeatReservation).not.toHaveBeenCalled();expect(c.joinOrCreate).not.toHaveBeenCalled();});
 it('fails clearly when reservation support is unavailable instead of falling back to racy creation',async()=>{const c=fixture(null,false);await expect(joinRiftPublic(c as unknown as Client,'https://example.test',options)).rejects.toThrow('reserve');expect(c.create).not.toHaveBeenCalled();});
 it.each([null,{}, {...ticket,name:'private_arena'}, {...ticket,roomId:'wrong'}, {...ticket,sessionId:1}])('rejects malformed or wrong-mode reservations',async(data)=>{const c=fixture(data);await expect(joinRiftPublic(c as unknown as Client,'https://example.test',options)).rejects.toThrow('reservation');expect(c.consumeSeatReservation).not.toHaveBeenCalled();});
});
