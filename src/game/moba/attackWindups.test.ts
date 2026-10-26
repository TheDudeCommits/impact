import {afterEach,expect,it} from 'vitest';
import {RiftMatch} from './RiftMatch';
import {RIFT_RULES} from './model';
const games:RiftMatch[]=[];
afterEach(()=>games.splice(0).forEach(g=>g.dispose()));
function fixture(){const g=new RiftMatch({fillBots:false});games.push(g);g.add('h','goku','Hero');g.add('v','dio','Enemy');g.start();tick(g,3.05);const tower=g.view.structures.find(s=>s.team==='villains'&&s.lane==='mid'&&s.tier===1)!;g.sim.place('h',{x:tower.x,y:0,z:tower.z+5});return {g,tower,hero:g.sim.actors.get('h')!.state};}
function tick(g:RiftMatch,seconds:number){for(let i=0;i<Math.ceil(seconds*60);i++)g.step();}
it('announces a tower charge before damage and allows escape during the windup',()=>{
 const {g,tower,hero}=fixture(),hp=hero.hp;tick(g,.1);expect(tower.target).toBe('h');expect(tower.fireAt).toBeGreaterThan(g.sim.serverTime);expect(hero.hp).toBe(hp);
 g.sim.place('h',{x:tower.x,y:0,z:tower.z+RIFT_RULES.towerRange+3});tick(g,.7);expect(hero.hp).toBe(hp);expect(g.view.events.some(e=>e.kind==='bolt'&&e.targetId==='h')).toBe(false);
});
it('lands a charged shot after its telegraph, and destroying the source cancels it',()=>{
 const a=fixture(),b=fixture(),hp=a.hero.hp;tick(a.g,.1);tick(b.g,.1);b.tower.hp=0;
 tick(a.g,.6);tick(b.g,.6);expect(a.hero.hp).toBeLessThan(hp);expect(a.tower.fireAt).toBeUndefined();expect(b.hero.hp).toBe(hp);
});
