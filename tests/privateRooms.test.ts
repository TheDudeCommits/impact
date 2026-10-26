import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { describe,it,expect,vi,afterEach } from 'vitest';
import type { Client,FixedTimestepCallback } from 'colyseus';
import { PrivateArenaRoom } from '../src/server/ArenaRoom';
import { PrivateCodes,PRIVATE_WAIT_SECONDS,privateCodes } from '../src/server/privateCodes';
import { COMBO_HP } from '../src/game/moves';
const client=(sessionId:string)=>({sessionId,send:vi.fn()} as unknown as Client);
afterEach(()=>vi.restoreAllMocks());
async function fixture(players?:number){
  const room=new PrivateArenaRoom();let tick!:FixedTimestepCallback,frame=0;
  vi.spyOn(room,'setPrivate').mockResolvedValue(undefined);vi.spyOn(room,'setMetadata').mockResolvedValue(undefined);
  vi.spyOn(room,'broadcast').mockImplementation(()=>{});vi.spyOn(room,'lock').mockResolvedValue(undefined);
  vi.spyOn(room,'setFixedTimestep').mockImplementation(callback=>{tick=callback;});
  await room.onCreate({rosterProtocol:ROSTER_PROTOCOL,mode:'training',creationToken:'01234567-89ab-cdef-0123-456789abcdef',...(players?{players}:{})});
  const advance=(n=1)=>{for(let i=0;i<n;i++)tick({dt:1/60,dtMs:1000/60,tick:++frame,subSteps:1,subDt:1/60,subDtMs:1000/60});};
  const join=(id:string)=>{const c=client(id);room.clients.push(c);room.onJoin(c,{rosterProtocol:ROSTER_PROTOCOL,code:room.snapshot().lobby!.code});return c;};
  return {room,advance,join};
}
describe('private room lifecycle',()=>{
  it('keeps codes six digits, retries collisions and releases disposed codes',()=>{
    const sequence=['000012','000012','000013'];const codes=new PrivateCodes(()=>sequence.shift()!);
    expect(codes.allocate()).toBe('000012');expect(codes.allocate()).toBe('000013');codes.release('000012');expect(codes.has('000012')).toBe(false);
    const exhausted=new PrivateCodes(()=>'999999');exhausted.allocate();expect(()=>exhausted.allocate()).toThrow('busy');
  });
  it('forces private match mode and waits for the host with two or more entrants',async()=>{
    const {room,join,advance}=await fixture();
    try{
      expect(()=>room.onAuth(client('intruder'),{rosterProtocol:ROSTER_PROTOCOL,creationToken:'ffffffff-ffff-ffff-ffff-ffffffffffff'})).toThrow('room code');
      expect(()=>room.onAuth(client('intruder'),{rosterProtocol:ROSTER_PROTOCOL,code:'invalid'})).toThrow('room code');
      const host=join('host');room.requestPrivateStart(host);expect(room.snapshot().lobby?.startsAt).toBeNull();
      const guest=join('guest');advance(16*60);expect(room.simulation.status).toBe('waiting');
      expect(room.setPrivate).toHaveBeenCalledWith(true);expect(room.simulation.roomMode).toBe('match');
      room.requestPrivateStart(guest);expect(room.snapshot().lobby?.startsAt).toBeNull();
      room.requestPrivateStart(host);expect(room.snapshot().lobby?.startsAt).not.toBeNull();
      advance(3*60+1);expect(room.simulation.status).toBe('active');expect(room.snapshot().lobby?.expiresAt).toBeNull();
      expect(room.simulation.snapshot().players.every(p=>p.hp===COMBO_HP&&p.alive)).toBe(true);
    }finally{room.onDispose();}
  });
  it('transfers hosting after consented leave and cleans its code on disposal',async()=>{
    const {room,join}=await fixture();const code=room.snapshot().lobby!.code!;
    try{const host=join('host');join('guest');room.onLeave(host);expect(room.snapshot().lobby?.hostId).toBe('guest');expect(privateCodes.has(code)).toBe(true);}
    finally{room.onDispose();}expect(privateCodes.has(code)).toBe(false);
  });
  it('expires an unstarted lobby after fifteen minutes',async()=>{
    const {room,join,advance}=await fixture();
    try{join('host');const disconnect=vi.spyOn(room,'disconnect').mockResolvedValue(undefined);room.simulation.serverTime=PRIVATE_WAIT_SECONDS;advance();expect(disconnect).toHaveBeenCalledWith(4004);}
    finally{room.onDispose();}
  });
  it('seats the fighters its host asked for, and fills the empty seats with bots at kickoff',async()=>{
    for(const [asked,seats,bots] of [[4,4,2],[2,2,0],[8,8,6],[12,12,10],[5,12,0]] as const){
      const {room,join,advance}=await fixture(asked);
      try{
        expect(room.maxClients,`${asked} fighters`).toBe(seats);
        expect(room.snapshot().lobby?.size).toBe(asked===5?undefined:asked);
        const host=join('host');join('guest');
        expect(room.simulation.snapshot().players.filter(p=>p.isBot)).toHaveLength(0);
        room.requestPrivateStart(host);advance(3*60+1);
        expect(room.simulation.status).toBe('active');
        expect(room.simulation.snapshot().players.filter(p=>p.isBot),`${asked} fighters`).toHaveLength(bots);
      }finally{room.onDispose();}
    }
  });
});
