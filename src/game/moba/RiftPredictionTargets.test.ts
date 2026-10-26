import {afterEach,describe,expect,it} from 'vitest';
import {ArenaSimulation} from '../simulation';
import {RiftMatch} from './RiftMatch';
import {RiftPredictionTargets} from './RiftPredictionTargets';
import {snapshotFor} from './vision';
import {RIFT_RULES} from './model';
const clean:(()=>void)[]=[];afterEach(()=>clean.splice(0).forEach(fn=>fn()));
function battle(){const game=new RiftMatch({fillBots:false});clean.push(()=>game.dispose());game.add('me','luffy','Me');game.add('enemy','dio','Enemy');game.start();for(let i=0;i<490;i++)game.step();return game;}
describe('Rift owner prediction target geometry',()=>{
 it('matches a real manual lunge before contact without inventing enemy damage',()=>{
  const game=battle(),unit=game.view.units.find(u=>u.team==='villains'&&u.lane==='mid')!;Object.assign(game.locate(unit.id)!,{x:0,z:3.5});game.sim.place('me',{x:0,y:0,z:0});game.freeze({x:0,y:0,z:3.5},6,5,'me');
  const snapshot=snapshotFor(game.snapshot(),'me'),adapter=new RiftPredictionTargets();adapter.update(snapshot,'me');const before=JSON.stringify(snapshot);
  const prediction=new ArenaSimulation({stage:'rift-war',roomMode:'training',trainingBot:false});clean.push(()=>prediction.dispose());prediction.addPlayer('me','luffy','Me',false,{x:0,y:0,z:0});Object.assign(prediction.actors.get('me')!.state,structuredClone(snapshot.players.find(p=>p.id==='me')!));prediction.serverTime=game.sim.serverTime;prediction.restorePrediction('me',game.sim.predictionCheckpoint('me')!);prediction.external=adapter;prediction.assist={magnet:RIFT_RULES.aimMagnet};
  for(let i=0;i<7;i++){const input={seq:i+1,moveX:0,moveZ:0,yaw:0,attack:i===0?'light' as const:undefined,targetId:unit.id,lock:true};prediction.submitInput('me',input);game.submit('me',input);prediction.step();game.step();const a=game.sim.actors.get('me')!.state,b=prediction.actors.get('me')!.state;expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeLessThan(.001);}
  expect(prediction.actors.get('me')!.cast?.externalAim).toBe(unit.id);expect(prediction.actors.get('me')!.state.damageDealt).toBe(0);expect(JSON.stringify(snapshot)).toBe(before);
 });
 it('rejects friendly and hidden geometry and preserves locked-defense vulnerability',()=>{
  const game=battle(),adapter=new RiftPredictionTargets(),snapshot=snapshotFor(game.snapshot(),'me');adapter.update(snapshot,'me');
  const ally=snapshot.rift.units.find(u=>u.team==='heroes')!;expect(adapter.hostile('me',adapter.locate(ally.id)!)).toBe(false);
  const enemy=game.view.units.find(u=>u.team==='villains')!;expect(adapter.locate(enemy.id)).toBeUndefined();
  const tower=game.view.structures.find(s=>s.team==='villains'&&s.tier===2)!;game.sim.place('me',{x:tower.x,y:0,z:tower.z+6});adapter.update(snapshotFor(game.snapshot(),'me'),'me');expect(adapter.locate(tower.id)).toMatchObject({vulnerable:false});expect(adapter.hostile('me',adapter.locate(tower.id)!)).toBe(true);expect(adapter.receive()).toBeNull();
  game.sim.place('me',{x:-66,y:0,z:66});adapter.update(snapshotFor(game.snapshot(),'me'),'me');expect(adapter.locate(tower.id)).toBeUndefined();
  adapter.clear();expect(adapter.size).toBe(0);
 });
 it('keeps authored and empowered army heights identical to authority across updates',()=>{
  const game=battle(),adapter=new RiftPredictionTargets();
  const verify=()=>{const snapshot=snapshotFor(game.snapshot(),'me');adapter.update(snapshot,'me');for(const unit of snapshot.rift.units)if(unit.hp>0)expect(adapter.locate(unit.id)?.height,unit.id).toBe(game.locate(unit.id)?.height);for(const structure of snapshot.rift.structures)if(structure.hp>0&&!structure.hidden)expect(adapter.locate(structure.id)?.height,structure.id).toBe(game.locate(structure.id)?.height);};
  verify();game.view.buffs.heroes=game.sim.serverTime+30;game.step();expect(game.view.units.some(u=>u.team==='heroes'&&u.empowered)).toBe(true);verify();
 });
 it('reuses visible bodies and removes dead bodies without mutating snapshots',()=>{
  const game=battle(),adapter=new RiftPredictionTargets(),snapshot=snapshotFor(game.snapshot(),'me');adapter.update(snapshot,'me');const unit=snapshot.rift.units[0],body=adapter.locate(unit.id)!;
  adapter.update(snapshot,'me');expect(adapter.locate(unit.id)).toBe(body);unit.hp=0;adapter.update(snapshot,'me');expect(adapter.locate(unit.id)).toBeUndefined();expect(adapter.size).toBeLessThanOrEqual(120);
 });
});
