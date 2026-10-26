import {afterEach,describe,expect,it} from 'vitest';
import {ObjectiveMatch} from './ObjectiveMatch';
import {ENEMIES,kitOf} from '../../survival/enemies';
import {SiegeBrain} from './SiegeBrain';
import {VillageStructures,villageCollision} from './villageStructures';
import {ArenaSimulation} from '../simulation';
import {createRapierCollision} from '../rapierCollision';
import {Prediction} from '../prediction';
const clean:{dispose():void}[]=[];afterEach(()=>clean.splice(0).forEach(s=>s.dispose()));
const step=(g:ObjectiveMatch,n:number)=>{for(let i=0;i<n*60;i++)g.step();};
describe('Last Stand real siege contacts',()=>{
 it('melee soldiers approach opposite shoulders, then commit to close-range hits',()=>{
  for(const offset of [.1,.9]){
   const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false});clean.push(sim);sim.status='active';
   sim.addPlayer('hero','goku','Hero',false,{x:0,y:0,z:0});sim.setMaxHp('hero',100000);sim.setTeam('hero','defenders');
   const def=ENEMIES.marine;sim.addCombatant('flanker',{enemy:def.id,team:'horde',kit:kitOf(def),maxHp:500,spawn:{x:0,y:0,z:-10}});
   const own=sim.actors.get('flanker')!.state,target=sim.actors.get('hero')!.state,brain=new SiegeBrain(own.id,def,0,offset);
   const approach=brain.command(sim,own,target,0);expect(approach.moveX*(offset<.5?-1:1)).toBeGreaterThan(0);expect(approach.moveZ).toBeGreaterThan(.9);
   let hits=0;for(let i=0;i<12*60;i++){sim.command(own.id,brain.command(sim,own,target,sim.serverTime));sim.step(1/60);hits+=sim.drainEvents().filter(e=>e.kind==='hit'&&e.targetId==='hero').length;}
   expect(hits).toBeGreaterThanOrEqual(3);
  }
 });
 it('online prediction agrees with authority while running into a barricade',()=>{
  const g=new ObjectiveMatch('last-stand',undefined,4,'solo');clean.push(g);g.add('me','naruto','Me');g.start();step(g,3.4);g.sim.place('me',{x:-17,y:0,z:12});
  const prediction=new Prediction();prediction.start('me',g.snapshot(),villageCollision());
  try{for(let seq=1;seq<=100;seq++){const input={seq,moveX:0,moveZ:1,yaw:0};prediction.submit(input);g.submit('me',input);g.step();const own=g.sim.actors.get('me')!.state;expect(prediction.sample(1/60,own)!.z).toBeCloseTo(own.z,5);}}finally{prediction.stop();}
 });
 it('lands repeated authored melee contacts on a physical barricade, with no proximity damage',()=>{
  const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,respawn:false,stage:'hidden-leaf',collision:villageCollision()});clean.push(sim);sim.status='active';
  const structures=new VillageStructures(sim),target=sim.actors.get('village-west')!.state,def=ENEMIES.marine;
  sim.addCombatant('raider',{enemy:def.id,team:'horde',kit:kitOf(def),maxHp:500,spawn:{x:target.x,y:0,z:target.z-2.8},armour:false});
  const body=sim.actors.get('raider')!.state,brain=new SiegeBrain('raider',def,0,.2);let casts=0,hits=0;
  for(let i=0;i<10*60;i++){sim.command('raider',brain.command(sim,body,target,sim.serverTime));sim.step(1/60);const events=sim.drainEvents();casts+=events.filter(e=>e.actorId==='raider'&&e.kind==='cast').length;hits+=events.filter(e=>e.targetId===target.id&&e.kind==='hit').length;structures.sync(events);}
  expect(casts).toBeGreaterThanOrEqual(4);expect(hits).toBeGreaterThanOrEqual(4);expect(target.hp).toBeLessThan(3900);expect(target.x).toBeCloseTo(-17);expect(target.z).toBeCloseTo(16);
  const hp=structures.hp;for(let i=0;i<3*60;i++){sim.command('raider',{moveX:0,moveZ:0,yaw:0});sim.step(1/60);}structures.sync();expect(structures.hp).toBe(hp);
 });
 it('unopposed raiders navigate to village constructs and damage them with actual hit events',async()=>{
  const g=new ObjectiveMatch('last-stand',await createRapierCollision('hidden-leaf'),9,'solo');clean.push(g);g.add('me','naruto','Me');g.start();step(g,3.1);g.sim.place('me',{x:38,y:0,z:40});
  let landed=0;for(let i=0;i<90*60&&g.view.phase!=='over';i++){g.step();landed+=g.snapshot(true).events.filter(e=>e.kind==='hit'&&e.targetId?.startsWith('village-')).length;}
  expect(landed).toBeGreaterThan(5);expect(g.siege!.view.hp).toBeLessThan(12000);expect(g.siege!.view.structures.some(s=>s.hitAt>0)).toBe(true);
 },30_000);
 it('an idle player takes repeated attacks instead of being circled indefinitely',()=>{
  const g=new ObjectiveMatch('last-stand',undefined,4,'solo');clean.push(g);g.add('me','naruto','Me');g.start();step(g,3.1);g.sim.place('me',{x:0,y:0,z:-13});
  let hits=0;for(let i=0;i<50*60&&g.view.phase!=='over';i++){g.step();hits+=g.snapshot(true).events.filter(e=>e.kind==='hit'&&e.targetId==='me').length;}
  expect(hits).toBeGreaterThanOrEqual(6);expect(g.sim.actors.get('me')!.state.hp).toBeLessThan(650);
 });
 it('shares repairs and reinforcements across damageable constructs without granting fighter upgrades',()=>{
  const g=new ObjectiveMatch('last-stand',undefined,8,'solo');clean.push(g);g.add('me','naruto','Me');g.start();step(g,3.1);g.sim.place('me',{x:-11,y:0,z:24});
  g.sim.damage('village-west',99999,'test','test');g.step();expect(g.siege!.view.hp).toBe(8000);g.siege!.view.points=1000;
  expect(g.buy('me','repair')).toBeUndefined();expect(g.siege!.view.hp).toBe(10400);expect(g.sim.actors.get('village-west')!.state.alive).toBe(true);
  expect(g.buy('me','walls')).toBeUndefined();expect(g.siege!.view.hp).toBe(13400);expect(g.siege!.view.maxHp).toBe(15000);expect(g.sim.actors.get('me')!.state.maxHp).toBe(1000);expect(g.siege!.view.points).toBe(50);
  const snap=g.snapshot();snap.objective.village!.structures[0].hp=5;expect(g.siege!.view.structures[0].hp).not.toBe(5);
 });
});
