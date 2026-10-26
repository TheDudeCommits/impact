import {expect,it} from 'vitest';
import {Prediction} from '../prediction';
import type {PlayerInput} from '../types';
import {RiftMatch} from './RiftMatch';
import {RiftPredictionTargets} from './RiftPredictionTargets';
import {RIFT_RULES} from './model';
import {snapshotFor} from './vision';

it('keeps online compact-target lunge prediction aligned through unacknowledged-input replay',()=>{
 const game=new RiftMatch({fillBots:false}),prediction=new Prediction(),targets=new RiftPredictionTargets();
 try {
  game.add('me','luffy','Me');game.add('enemy','dio','Enemy');game.start();for(let i=0;i<490;i++)game.step();
  const unit=game.view.units.find(u=>u.team==='villains'&&u.lane==='mid')!;
  Object.assign(game.locate(unit.id)!,{x:0,z:3.5});game.sim.place('me',{x:0,y:0,z:0});game.freeze({x:0,y:0,z:3.5},6,5,'me');
  const snapshot=()=>snapshotFor({...game.snapshot(),prediction:{me:game.sim.predictionCheckpoint('me')!}},'me');
  let frame=snapshot();targets.update(frame,'me');prediction.start('me',frame);prediction.setExternalTargets(targets,{magnet:RIFT_RULES.aimMagnet});
  const pending:PlayerInput[]=[];
  for(let seq=1;seq<=7;seq++){
   const input:PlayerInput={seq,moveX:0,moveZ:0,yaw:0,attack:seq===1?'light':undefined,targetId:unit.id,lock:true};
   prediction.submit(input);if(seq<=4){game.submit('me',input);game.step();}else pending.push(input);
  }
  frame=snapshot();targets.update(frame,'me');prediction.setExternalTargets(targets,{magnet:RIFT_RULES.aimMagnet});prediction.reconcile(frame);
  expect(prediction.diagnostics.pending).toEqual([5,6,7]);
  for(const input of pending){game.submit('me',input);game.step();}
  const authority=game.sim.actors.get('me')!.state,predicted=prediction.diagnostics.position!;
  expect(prediction.action).toBe('light');expect(authority.z).toBeGreaterThan(.2);
  expect(Math.hypot(authority.x-predicted.x,authority.z-predicted.z)).toBeLessThan(.001);
  expect(prediction.sample(1/60,authority)!.hp).toBe(authority.hp);
 }finally{prediction.stop();targets.clear();game.dispose();}
});
