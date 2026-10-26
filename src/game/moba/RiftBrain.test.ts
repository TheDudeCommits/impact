import {afterEach,describe,expect,it} from 'vitest';
import {RiftMatch} from './RiftMatch';
import {RiftBrain} from './RiftBrain';
const games:RiftMatch[]=[];afterEach(()=>games.splice(0).forEach(g=>g.dispose()));
const advance=(g:RiftMatch,seconds:number)=>{for(let i=0;i<seconds*60;i++)g.step();};
function battle(){const g=new RiftMatch({fillBots:false});games.push(g);g.add('me','naruto','Me');g.add('ally','ace','Ally');g.add('enemy','dio','Enemy');g.start();advance(g,3.1);return g;}
describe('Rift neutral objective decisions',()=>{
 it('answers a camp attacking an ally using real manual commands, rather than ignoring its attacks',()=>{
  const g=battle();advance(g,15.1);const camp=g.view.units.find(u=>u.kind==='camp')!;g.sim.place('me',{x:camp.x,y:0,z:camp.z-2});advance(g,.1);
  const me=g.sim.actors.get('me')!.state,seat=g.seats.get('me')!,brain=new RiftBrain('me'),players=[...g.sim.actors.values()].map(a=>a.state),hp=camp.hp;
  const command=brain.command(me,seat,players,g.view,g.sim.serverTime);expect(command.targetId).toBe(camp.id);expect(command.attack).toBe('light');g.sim.command('me',command);advance(g,1.1);expect(camp.hp).toBeLessThan(hp);
 });
 it('helps an ally contest the boss but does not open a lone low-health boss dive',()=>{
  const g=battle();advance(g,151);const boss=g.view.units.find(u=>u.kind==='boss')!;g.sim.place('me',{x:boss.x,y:0,z:boss.z+18});g.sim.place('ally',{x:boss.x,y:0,z:boss.z+3});
  const me=g.sim.actors.get('me')!.state,ally=g.sim.actors.get('ally')!.state,seat=g.seats.get('me')!,players=[...g.sim.actors.values()].map(a=>a.state);ally.target=boss.id;
  expect(new RiftBrain('me').command(me,seat,players,g.view,g.sim.serverTime).targetId).toBe(boss.id);
  ally.target=null;g.sim.place('ally',{x:-66,y:0,z:66});me.hp=me.maxHp*.5;
  expect(new RiftBrain('me').command(me,seat,players,g.view,g.sim.serverTime).targetId).not.toBe(boss.id);
 });
});
