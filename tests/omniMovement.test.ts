import {describe,it,expect} from 'vitest';
import {ArenaSimulation} from '../src/game/simulation';
import {Prediction} from '../src/game/prediction';
import {MOVES} from '../src/game/moves';
import type {FighterId,PlayerInput} from '../src/game/types';

function arena(fighter:FighterId='naruto'){
 const sim=new ArenaSimulation({trainingBot:false});
 sim.addPlayer('me',fighter,'Me',false,{x:0,y:0,z:0});
 return sim;
}

describe('roster-wide camera-relative travel',()=>{
 for(const fighter of Object.keys(MOVES) as FighterId[])it(`${fighter} has equal speed in eight directions regardless of aim`,()=>{
  const distances:number[]=[];
  for(let direction=0;direction<8;direction++){
   const sim=arena(fighter),angle=direction*Math.PI/4;
   for(let seq=0;seq<45;seq++){sim.submitInput('me',{seq,moveX:Math.sin(angle),moveZ:Math.cos(angle),yaw:0});sim.step();}
   const p=sim.getPlayer('me')!;distances.push(Math.hypot(p.x,p.z));
   expect(Math.atan2(Math.sin(p.yaw-angle),Math.cos(p.yaw-angle))).toBeCloseTo(0,5);
   sim.dispose();
  }
  expect(Math.max(...distances)-Math.min(...distances)).toBeLessThan(.001);
 });

 it('replays the actual unacknowledged direction changes from the acknowledged velocity',()=>{
  const server=arena(),ideal=arena(),prediction=new Prediction();
  prediction.start('me',server.snapshot(false,true));
  const commands:PlayerInput[]=Array.from({length:24},(_,seq)=>({seq,moveX:seq<10?0:seq<18?1:-1,moveZ:seq<10?1:0,yaw:0}));
  for(const c of commands){prediction.submit(c);ideal.submitInput('me',c);ideal.step();}
  for(const c of commands.slice(0,12)){server.submitInput('me',c);server.step();}
  prediction.reconcile(server.snapshot(false,true));
  const shown=prediction.sample(1,server.getPlayer('me')!)!,wanted=ideal.getPlayer('me')!;
  expect(Math.hypot(shown.x-wanted.x,shown.z-wanted.z)).toBeLessThan(.001);
  prediction.stop();server.dispose();ideal.dispose();
 });
});
