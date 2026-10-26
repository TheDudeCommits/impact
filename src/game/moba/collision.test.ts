import {afterEach,describe,expect,it} from 'vitest';
import {ArenaSimulation} from '../simulation';
import {Prediction} from '../prediction';
import {createRapierCollision} from '../rapierCollision';
import {stageColliders} from '../environmentLayout';
import {NavGrid} from '../botNav';
import {RiftMatch} from './RiftMatch';
import {RiftBrain} from './RiftBrain';
import {RIFT_FOOTPRINTS,RIFT_SOLIDS,laneProgress} from './map';
const cleanup:(()=>void)[]=[];afterEach(()=>cleanup.splice(0).forEach(fn=>fn()));
const pad=RIFT_FOOTPRINTS.find(p=>p.id==='rift-heroes-mid-tower-1')!;
describe('Rift structure footprints agree with navigation and prediction',()=>{
 it('shares 24 persistent low plinths and keeps every spawn clear',async()=>{
  expect(stageColliders('rift-war').landmarks).toEqual(RIFT_SOLIDS);
  const collision=await createRapierCollision('rift-war'),game=new RiftMatch({collision});cleanup.push(()=>game.dispose());
  game.add('me','naruto','Me');game.start();
  for(const a of game.sim.actors.values())expect(collision.penetration(a.state),a.state.id).toBeLessThan(.005);
  for(const p of RIFT_FOOTPRINTS){expect(p.halfY*2).toBe(.5);expect(NavGrid.for('rift-war').walkable(p.x,p.z),p.id).toBe(false);}
 });
 it('stops walking through a shrine, permits walking around, and does not snag the capsule',async()=>{
  const collision=await createRapierCollision('rift-war'),sim=new ArenaSimulation({stage:'rift-war',roomMode:'training',trainingBot:false,collision});cleanup.push(()=>sim.dispose());
  sim.addPlayer('me','naruto','Me',false,{x:pad.x,y:0,z:pad.z-5});const p=sim.actors.get('me')!.state;let seq=0;
  const walk=(x:number,z:number,n:number)=>{for(let i=0;i<n;i++){sim.submitInput('me',{seq:++seq,moveX:x,moveZ:z,yaw:Math.atan2(x,z)});sim.step();expect(collision.penetration(p)).toBeLessThan(.005);}};
  walk(0,1,120);expect(p.z).toBeLessThan(pad.z-pad.halfZ-.4);expect(p.y).toBeLessThan(.1);
  walk(1,0,60);walk(0,1,120);expect(p.z).toBeGreaterThan(pad.z+3);
 });
 it('uses the same solid shrine for local prediction and authority',async()=>{
  const authority=await createRapierCollision('rift-war'),local=await createRapierCollision('rift-war');
  const sim=new ArenaSimulation({stage:'rift-war',roomMode:'training',trainingBot:false,collision:authority}),prediction=new Prediction();cleanup.push(()=>sim.dispose(),()=>prediction.stop());
  sim.addPlayer('me','naruto','Me',false,{x:pad.x,y:0,z:pad.z-5});prediction.start('me',sim.snapshot(false,true),local);
  for(let i=0;i<180;i++){const input={seq:i+1,moveX:0,moveZ:1,yaw:0};prediction.submit(input);sim.submitInput('me',input);sim.step();if(i%3===2)prediction.reconcile(sim.snapshot(false,true));const actual=sim.getPlayer('me')!,shown=prediction.sample(1/60,actual)!;expect(Math.hypot(shown.x-actual.x,shown.z-actual.z)).toBeLessThan(.05);}
  expect(sim.getPlayer('me')!.z).toBeLessThan(pad.z-pad.halfZ-.4);
 });
 it('allows a fighter already above a ruined plinth to clear it in the shared collision world',async()=>{
  const collision=await createRapierCollision('rift-war');cleanup.push(()=>collision.dispose?.());
  const delta=collision.move('airborne',{x:pad.x,y:1,z:pad.z-5},{x:0,y:0,z:10});expect(delta.z).toBeGreaterThan(9.9);
 });
 it('routes a lane bot around an allied plinth without teleporting or standing still',async()=>{
  const collision=await createRapierCollision('rift-war'),game=new RiftMatch({collision,fillBots:false});cleanup.push(()=>game.dispose());game.add('me','naruto','Me');game.add('enemy','dio','Enemy');game.start();for(let i=0;i<181;i++)game.step();
  game.sim.place('me',{x:pad.x-6,y:0,z:pad.z+6});const me=game.sim.actors.get('me')!.state,seat=game.seats.get('me')!,brain=new RiftBrain('me',0,NavGrid.for('rift-war')),start=laneProgress('mid',me);
  for(let i=0;i<480;i++){game.sim.command('me',brain.command(me,seat,[me],game.view,game.sim.serverTime));game.step();expect(collision.penetration(me)).toBeLessThan(.005);}
  expect(laneProgress('mid',me)-start).toBeGreaterThan(22);
 });
 it.each(['naruto','goku','luffy','levi'] as const)('%s can hit each tall defense with a grounded manual light attack',async fighter=>{
  for(const kind of ['tower','guardian','barracks','core'] as const){
   const collision=await createRapierCollision('rift-war'),game=new RiftMatch({collision,fillBots:false});cleanup.push(()=>game.dispose());game.add('me',fighter,'Me');game.add('enemy','dio','Enemy');game.start();for(let i=0;i<181;i++)game.step();
   const target=game.view.structures.find(s=>s.team==='villains'&&s.kind===kind)!;target.vulnerable=true;game.sim.place('me',{x:target.x-target.radius-.65,y:0,z:target.z},Math.PI/2);const hp=target.hp;
   game.submit('me',{seq:1,moveX:0,moveZ:0,yaw:Math.PI/2,targetId:target.id,lock:true,attack:'light'});for(let i=0;i<70;i++)game.step();
   expect(target.hp,`${fighter} against ${kind}`).toBeLessThan(hp);expect(collision.penetration(game.sim.getPlayer('me')!)).toBeLessThan(.005);
  }
 });
 it('still lets a manual lock and attack damage the tower outside its solid pad',async()=>{
  const collision=await createRapierCollision('rift-war'),game=new RiftMatch({collision,fillBots:false});cleanup.push(()=>game.dispose());game.add('me','luffy','Me');game.add('enemy','dio','Enemy');game.start();for(let i=0;i<181;i++)game.step();
  const tower=game.view.structures.find(s=>s.id==='rift-villains-mid-tower-1')!;game.sim.place('me',{x:tower.x,y:0,z:tower.z-3});const hp=tower.hp;
  game.submit('me',{seq:1,moveX:0,moveZ:0,yaw:0,targetId:tower.id,lock:true,attack:'special'});for(let i=0;i<220;i++)game.step();
  expect(tower.hp).toBeLessThan(hp);expect(collision.penetration(game.sim.getPlayer('me')!)).toBeLessThan(.005);
 });
});
