import {afterEach,describe,it,expect,vi} from 'vitest';
import {LocalArena} from '../src/survival/LocalArena';
import {dungeonFor} from '../src/survival/locations';
import {createRapierCollision} from '../src/game/rapierCollision';
type LoadedCollision=Awaited<ReturnType<typeof createRapierCollision>>;

vi.mock('../src/game/rapierCollision',()=>({createRapierCollision:vi.fn(async()=>undefined)}));
afterEach(()=>{vi.restoreAllMocks();vi.mocked(createRapierCollision).mockReset().mockResolvedValue(undefined as unknown as LoadedCollision);});

describe('Arcade chapter asset readiness',()=>{
  it('releases a late collision world instead of recreating a match after cancelled initial loading',async()=>{
    const dispose=vi.fn();vi.mocked(createRapierCollision).mockResolvedValue({dispose} as unknown as LoadedCollision);
    const arena=new LocalArena();let ready!:()=>void;
    arena.prepare=()=>new Promise<void>(resolve=>{ready=resolve;});
    const connecting=arena.connect('naruto','match','Tester');
    await vi.waitFor(()=>expect(ready).toBeDefined());await arena.leave();ready();await connecting;
    expect(dispose).toHaveBeenCalledOnce();expect(arena.game).toBeNull();expect(arena.room).toBeNull();
  });
  it('releases collision resources when the concurrent asset preparation fails',async()=>{
    const dispose=vi.fn();vi.mocked(createRapierCollision).mockResolvedValue({dispose} as unknown as LoadedCollision);
    const arena=new LocalArena();arena.prepare=()=>{throw new Error('asset unavailable');};
    await expect(arena.connect('naruto','match','Tester')).rejects.toThrow('asset unavailable');
    expect(dispose).toHaveBeenCalledOnce();expect(arena.game).toBeNull();
  });
  it('prepares the seeded first stage and holds travel until the actual destination is ready',async()=>{
    const arena=new LocalArena();arena.prepare=vi.fn(async()=>{});
    try{
      await arena.connect('naruto','match','Tester',{seed:4711,wave:20});
      expect(arena.prepare).toHaveBeenCalledWith(20,[],dungeonFor(4711,20).location.stage);
      const game=arena.game!,round=game.wave+1;
      game.phase='travel';game.travelTo='rift-harbor';
      let ready!:()=>void;arena.prepare=vi.fn(()=>new Promise<void>(resolve=>{ready=resolve;}));
      const time=game.sim.serverTime;
      arena.send({seq:1,moveX:0,moveZ:0,yaw:0});
      await vi.waitFor(()=>expect(arena.prepare).toHaveBeenCalledWith(round,[],'rift-harbor'));
      expect(game.phase).toBe('travel');expect(game.sim.serverTime).toBe(time);
      ready();await vi.waitFor(()=>expect(game.sim.stage).toBe('rift-harbor'));
      expect(game.phase).toBe('intro');
    }finally{await arena.leave();}
  });
  it.each(['resolve','reject'] as const)('does not arrive after leaving while destination assets %s',async result=>{
    const arena=new LocalArena();
    await arena.connect('naruto','match','Tester',{seed:4711,wave:20});
    const game=arena.game!;game.phase='travel';game.travelTo='rift-harbor';
    const dispose=vi.fn();vi.mocked(createRapierCollision).mockResolvedValue({dispose} as unknown as LoadedCollision);
    const arrive=vi.spyOn(game,'arrive');let ready!:()=>void;
    const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
    arena.prepare=vi.fn(()=>new Promise<void>((resolve,reject)=>{ready=result==='resolve'?resolve:()=>reject(new Error('asset unavailable'));}));
    arena.send({seq:1,moveX:0,moveZ:0,yaw:0});
    await vi.waitFor(()=>expect(arena.prepare).toHaveBeenCalledOnce());
    await arena.leave();ready();await new Promise(resolve=>setTimeout(resolve,0));
    expect(arrive).not.toHaveBeenCalled();expect(arena.game).toBeNull();expect(dispose).toHaveBeenCalledOnce();warning.mockRestore();
  });
});
