import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@colyseus/sdk';
import { ArenaSimulation } from '../src/game/simulation';
import { Network } from '../src/network';

const sdk = vi.hoisted(() => ({ join: vi.fn(), create: vi.fn(), joinById: vi.fn() }));
vi.mock('@colyseus/sdk', () => ({ Client: class { joinOrCreate = sdk.join; create = sdk.create; joinById = sdk.joinById; } }));
function room(id: string) {
  const messages = new Map<string, (value: any) => void>();
  const hooks: Record<string, (...args: any[]) => void> = {};
  const fake = {
    sessionId: id, reconnection: { minUptime: 5000, enabled: true }, connection: { isOpen: true },
    onMessage: (name: string, handler: (value: any) => void) => messages.set(name, handler),
    onDrop: (handler: (...args: any[]) => void) => hooks.drop = handler,
    onReconnect: (handler: (...args: any[]) => void) => hooks.reconnect = handler,
    onLeave: (handler: (...args: any[]) => void) => hooks.leave = handler,
    onError: (handler: (...args: any[]) => void) => hooks.error = handler,
    send: vi.fn(), leave: vi.fn().mockResolvedValue(4000),
  };
  return { fake, typed: fake as unknown as Room, messages, hooks };
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('browser network lifecycle with SDK callbacks, no connections', () => {
  it('keeps dropped sessions in place until a fresh recovered snapshot, then clears terminal state', async () => {
    vi.stubGlobal('location', { protocol: 'http:', hostname: 'localhost' });
    const remote = room('a'), network = new Network(), disconnected = vi.fn();
    network.onDisconnect = disconnected; sdk.join.mockResolvedValueOnce(remote.typed);
    await network.connect('goku', 'match', 'Fighter');
    expect(remote.fake.reconnection.minUptime).toBe(0);
    const sim = new ArenaSimulation(); sim.addPlayer('a'); const snapshot = sim.snapshot();
    remote.messages.get('snapshot')!(snapshot);
    remote.hooks.error(1006, 'Temporary transport error'); remote.hooks.drop();
    expect(disconnected).not.toHaveBeenCalled(); expect(network.id).toBe('a'); expect(network.snapshot).toBe(snapshot);
    expect(network.receivedAt).toBe(-Infinity);
    remote.hooks.reconnect(); expect(network.receivedAt).toBe(-Infinity);
    remote.messages.get('snapshot')!(snapshot); expect(Number.isFinite(network.receivedAt)).toBe(true);
    remote.fake.connection.isOpen = false; remote.hooks.leave(4003);
    expect(disconnected).toHaveBeenCalledTimes(1); expect(network.room).toBeNull(); expect(network.snapshot).toBeNull();
    await network.leave(); expect(remote.fake.leave).not.toHaveBeenCalled(); sim.dispose();
  });

  it('ignores snapshots and close events from an old room after joining a new one', async () => {
    vi.stubGlobal('location', { protocol: 'http:', hostname: 'localhost' });
    const old = room('old'), next = room('new'), network = new Network(), disconnected = vi.fn(), seen = vi.fn();
    network.onDisconnect = disconnected; network.onSnapshot = seen;
    sdk.join.mockResolvedValueOnce(old.typed).mockResolvedValueOnce(next.typed);
    await network.connect('goku', 'match', 'First'); await network.leave();
    expect(old.fake.leave).toHaveBeenCalledTimes(1);
    await network.connect('naruto', 'training', 'Next');
    old.messages.get('snapshot')!({ players: [], events: [] }); old.hooks.leave(4000);
    expect(seen).not.toHaveBeenCalled(); expect(disconnected).not.toHaveBeenCalled();
    expect(network.id).toBe('new'); expect(network.snapshot).toBeNull(); await network.leave();
  });

  it('leaves a late abandoned reconnection without touching the newly selected fighter', async () => {
    const old = room('abandoned'), next = room('current'), network = new Network('https://test.invalid');
    const disconnected = vi.fn(); network.onDisconnect = disconnected;
    sdk.join.mockResolvedValueOnce(old.typed).mockResolvedValueOnce(next.typed);
    await network.connect('goku', 'training', 'First');
    old.fake.connection.isOpen = false; old.hooks.drop();
    await network.leave();
    expect(old.fake.reconnection.enabled).toBe(false);
    await network.connect('naruto', 'training', 'Next');
    old.fake.connection.isOpen = true; old.hooks.reconnect();
    await Promise.resolve();
    expect(old.fake.leave).toHaveBeenCalledTimes(1);
    old.hooks.leave(4000);
    expect(network.id).toBe('current'); expect(disconnected).not.toHaveBeenCalled();
    await network.leave();
  });
});


describe('private network connection routing',()=>{
  it('uses explicit create or six-digit join without falling back to public matchmaking',async()=>{
    const remote=room('host'),guest=room('guest'),network=new Network('http://test.invalid');
    sdk.create.mockResolvedValueOnce(remote.typed);
    await network.connect('goku','training','Host',{kind:'create-private'});
    expect(sdk.create).toHaveBeenCalledWith('private_arena',expect.objectContaining({fighter:'goku',mode:'match',name:'Host',creationToken:expect.any(String)}));
    network.startPrivateMatch();expect(remote.fake.send).toHaveBeenCalledWith('start-private-match');
    await network.leave();sdk.joinById.mockResolvedValueOnce(guest.typed);
    await network.connect('naruto','match','Guest',{kind:'join-private',code:' 001234 '});
    expect(sdk.joinById).toHaveBeenCalledWith('private-001234',expect.objectContaining({assetGate:true,fighter:'naruto',mode:'match',name:'Guest',code:'001234'}));
    expect(sdk.join).not.toHaveBeenCalled();await network.leave();
  });
  it('rejects malformed and unavailable codes with actionable errors',async()=>{
    const network=new Network('http://test.invalid');
    await expect(network.connect('goku','match','Guest',{kind:'join-private',code:'bad'})).rejects.toThrow('6-digit');
    expect(sdk.joinById).not.toHaveBeenCalled();
    sdk.joinById.mockRejectedValueOnce(new Error('room locked'));
    await expect(network.connect('goku','match','Guest',{kind:'join-private',code:'123456'})).rejects.toThrow('full, started, or expired');
    expect(network.room).toBeNull();expect(sdk.join).not.toHaveBeenCalled();
  });
});

describe('prediction transport ownership',()=>{
 it('blocks offline commands and waits for the explicit queue reset after reconnect',async()=>{
  const remote=room('me'),network=new Network('http://test.invalid'),reset=vi.fn();sdk.join.mockResolvedValueOnce(remote.typed);network.onControlReset=reset;
  await network.connect('naruto','training','Me');
  const sim=new ArenaSimulation({trainingBot:false});sim.addPlayer('me','naruto');const snapshot=sim.snapshot(false,true);
  try{
   remote.messages.get('snapshot')!(snapshot);expect(network.predictionReady).toBe(true);
   expect(network.send({seq:1,moveX:1,moveZ:0,yaw:0})).toBe(true);
   remote.fake.connection.isOpen=false;remote.hooks.drop();expect(reset).toHaveBeenCalledTimes(1);
   for(let seq=2;seq<122;seq++)expect(network.send({seq,moveX:1,moveZ:0,yaw:0,attack:'heavy'})).toBe(false);
   remote.fake.connection.isOpen=true;remote.hooks.reconnect();expect(remote.fake.send).toHaveBeenCalledWith('resync-input');
   remote.messages.get('snapshot')!(snapshot);expect(network.predictionReady).toBe(false);
   expect(network.send({seq:122,moveX:0,moveZ:0,yaw:0})).toBe(false);
   remote.messages.get('input-resync')!(snapshot);expect(network.predictionReady).toBe(true);
   expect(network.send({seq:123,moveX:0,moveZ:0,yaw:0})).toBe(true);
   expect(remote.fake.send.mock.calls.filter(c=>c[0]==='input')).toHaveLength(2);
  }finally{sim.dispose();await network.leave();}
 });
 it('resynchronizes rejected history once and ignores unrelated snapshots until the reset arrives',async()=>{
  const remote=room('me'),network=new Network('http://test.invalid'),reset=vi.fn();sdk.join.mockResolvedValueOnce(remote.typed);network.onControlReset=reset;
  await network.connect('naruto','training','Me');
  try{
   remote.messages.get('snapshot')!({players:[],events:[]});
   for(let i=0;i<4;i++)remote.messages.get('input-rejected')!({reason:'excess'});
   expect(reset).toHaveBeenCalledTimes(1);expect(network.predictionReady).toBe(false);
   expect(remote.fake.send.mock.calls.filter(c=>c[0]==='resync-input')).toHaveLength(1);
   remote.messages.get('snapshot')!({players:[],events:[]});expect(network.predictionReady).toBe(false);
   remote.messages.get('input-resync')!({players:[],events:[]});expect(network.predictionReady).toBe(true);
  }finally{await network.leave();}
 });
});
