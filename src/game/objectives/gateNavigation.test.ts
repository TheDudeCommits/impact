import {afterEach,describe,expect,it} from 'vitest';
import {createRapierCollision} from '../rapierCollision';
import {ArenaSimulation} from '../simulation';
import {ENEMIES,kitOf} from '../../survival/enemies';
import {ObjectiveMatch} from './ObjectiveMatch';
import {ObjectiveBrain} from './ObjectiveBrain';
import {SiegeBrain} from './SiegeBrain';
import {gateWaypoint} from './lastStand';

const clean:{dispose():void}[]=[];
afterEach(()=>clean.splice(0).forEach(world=>world.dispose()));
const corners=[
 {name:'east field',x:9.86,z:18.54,targetZ:24},
 {name:'west field',x:-9.86,z:18.54,targetZ:24},
 {name:'east village',x:9.86,z:21.46,targetZ:12},
 {name:'west village',x:-9.86,z:21.46,targetZ:12},
];

describe('Last Stand gate-post navigation',()=>{
 it.each(corners)('rescues an ally across the gate from $name',async({x,z,targetZ})=>{
  const match=new ObjectiveMatch('last-stand',await createRapierCollision('hidden-leaf'),1,'host');clean.push(match);
  match.add('helper','vegeta','Helper','defenders');match.add('fallen','naruto','Fallen','defenders');match.start();
  for(let tick=0;tick<192;tick++)match.step();
  match.siege!.view.nextWaveAt=match.sim.serverTime+60;
  match.sim.place('helper',{x,y:0,z});match.sim.place('fallen',{x:Math.sign(x)*12,y:0,z:targetZ});
  match.sim.damage('fallen',99999,'test','test');match.step();
  const brain=new ObjectiveBrain('helper'),fallen=match.sim.actors.get('fallen')!.state;
  for(let tick=0;tick<20*60&&!fallen.alive;tick++){
   match.sim.command('helper',brain.command(match.sim.playerStates(),match.snapshot().objective,match.sim.serverTime,'hidden-leaf',{role:'rescue',target:'fallen'}));
   match.step();
  }
  expect(fallen.alive).toBe(true);expect(match.seats.get('helper')!.revives).toBe(1);
 });

 it.each(corners)('intercepts an enemy across the gate from $name',async({x,z,targetZ})=>{
  const match=new ObjectiveMatch('last-stand',await createRapierCollision('hidden-leaf'),1,'host');clean.push(match);
  match.add('helper','goku','Helper','defenders');match.add('target','naruto','Target','defenders');match.start();
  for(let tick=0;tick<192;tick++)match.step();
  match.siege!.view.nextWaveAt=match.sim.serverTime+60;
  match.sim.place('helper',{x,y:0,z});match.sim.place('target',{x:Math.sign(x)*12,y:0,z:targetZ});
  match.sim.setTeam('target','horde');
  const brain=new ObjectiveBrain('helper'),target=match.sim.actors.get('target')!.state,initialHp=target.hp;
  for(let tick=0;tick<12*60&&target.hp===initialHp;tick++){
   match.sim.command('helper',brain.command(match.sim.playerStates(),match.snapshot().objective,match.sim.serverTime,'hidden-leaf',{role:'intercept',target:'target',lane:1}));
   match.step();
  }
  expect(target.hp).toBeLessThan(initialHp);
 });

 it.each(corners.flatMap(corner=>[.1,.9].map(offset=>({...corner,offset}))))('lets a raider reach and hit a defender across the gate from $name (shoulder $offset)',async({x,z,targetZ,offset})=>{
  const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false,stage:'hidden-leaf',collision:await createRapierCollision('hidden-leaf')});clean.push(sim);sim.status='active';
  sim.addPlayer('defender','goku','Defender',false,{x:Math.sign(x)*12,y:0,z:targetZ});sim.setTeam('defender','defenders');
  const def=ENEMIES.marine;
  sim.addCombatant('raider',{enemy:def.id,team:'horde',kit:kitOf(def),maxHp:500,spawn:{x,y:0,z}});
  const self=sim.actors.get('raider')!.state,target=sim.actors.get('defender')!.state,brain=new SiegeBrain(self.id,def,0,offset),initialHp=target.hp;
  const trail:unknown[]=[];
  for(let tick=0;tick<12*60&&target.hp===initialHp;tick++){
   sim.command(self.id,brain.command(sim,self,target,sim.serverTime));sim.step(1/60);sim.drainEvents();
   if(tick%60===0)trail.push({x:self.x,z:self.z,action:self.action,waypoint:gateWaypoint(self,target)});
  }
  expect(target.hp,JSON.stringify(trail)).toBeLessThan(initialHp);
 });

 it('keeps clear crossings and same-side open approaches direct',()=>{
  for(const [from,to] of [
   [{x:0,z:12},{x:0,z:26}], [{x:6,z:26},{x:-6,z:12}],
   [{x:-15,z:10},{x:15,z:10}], [{x:-4,z:25},{x:4,z:25}],
  ])expect(gateWaypoint(from,to)).toBeUndefined();
 });
});
