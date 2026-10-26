import {afterEach,describe,expect,it,vi} from 'vitest';
import {ArenaSimulation} from '../simulation';
import {ENEMIES,kitOf} from '../../survival/enemies';
import {BossRain} from './bossRain';
const worlds:ArenaSimulation[]=[];
afterEach(()=>worlds.splice(0).forEach(sim=>sim.dispose()));
function setup(){
  const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false,stage:'hidden-leaf'});worlds.push(sim);
  sim.addPlayer('hero','goku','Hero',false,{x:0,y:0,z:0});sim.setTeam('hero','defenders');
  const def=ENEMIES.kizaru,move=def.moves.find(m=>m.rain)!;
  sim.addCombatant('boss',{enemy:def.id,name:def.name,team:'horde',kit:kitOf(def),maxHp:def.hp,spawn:{x:20,y:0,z:0}});
  sim.status='active';sim.serverTime=10;sim.actors.get('boss')!.state.target='hero';
  const hero=sim.actors.get('hero')!.state,rain=new BossRain(sim,()=>[hero],()=>.5);
  const event={id:1,kind:'cast' as const,serverTime:10,actorId:'boss',move:move.name};
  rain.consume([event]);
  const tick=()=>{rain.update();sim.step(1/60);sim.drainEvents();};
  const until=(time:number)=>{while(sim.serverTime<time)tick();};
  return {sim,hero,rain,event,move,tick,until};
}
describe('Last Stand boss rain',()=>{
  it('warns before landing, uses the combat kernel once per target, and deals no early damage',()=>{
    const {sim,hero,rain,move,until,tick}=setup(),strike=vi.spyOn(sim,'strike');
    until(10+move.rain!.start!+.03);const first=rain.warnings[0];expect(first.kind).toBe('hazard');expect(first.value-first.at).toBeCloseTo(move.rain!.lead);expect(first).toMatchObject({x:0,z:0,radius:move.rain!.radius});
    until(first.value-.01);expect(hero.hp).toBe(1000);expect(strike).not.toHaveBeenCalled();
    tick();tick();expect(hero.hp).toBeLessThan(1000);expect(strike).toHaveBeenCalledTimes(1);expect(strike.mock.calls[0].slice(0,3)).toEqual(['boss','hero','heavy']);
  });
  it('lets a player leave the visible strike radius before the impact',()=>{
    const {sim,hero,rain,move,until,tick}=setup();until(10+move.rain!.start!+.03);const first=rain.warnings[0];
    sim.place('hero',{x:first.radius+2,y:0,z:0});until(first.value);tick();expect(hero.hp).toBe(1000);
  });
  it('stops new drops after boss death and expires warning history',()=>{
    const {sim,rain,event,until}=setup();rain.consume([event]);until(10.55);const count=rain.warnings.length;expect(count).toBeGreaterThan(0);
    sim.damage('boss',1e6,'hero','Test');until(10.7);expect(rain.warnings.length).toBe(count);
    until(14);expect(rain.warnings).toHaveLength(0);
  });
  it('does not restart a rain when an already consumed cast is repeated',()=>{
    const {sim,hero,rain,event,move,tick}=setup();hero.hp=hero.maxHp=100000;
    const warnings=new Set<number>();let repeated=false;
    while(sim.serverTime<15){
      if(!repeated&&sim.serverTime>11){rain.consume([event]);repeated=true;}
      tick();for(const w of rain.warnings)warnings.add(w.id);
    }
    expect(warnings.size).toBe(move.rain!.count);
  });
});
