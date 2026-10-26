import {describe,it,expect} from 'vitest';
import {Packr,unpack} from 'msgpackr';
import {ArenaSimulation} from '../src/game/simulation';
import {MOVES} from '../src/game/moves';
import {Prediction} from '../src/game/prediction';
import type {FighterId,GameSnapshot,PlayerInput} from '../src/game/types';
import {KI_BLAST_VOLLEY,withMove} from './retiredMoves';

const wire=<T>(value:T):T=>unpack(new Packr({useRecords:false}).pack(value)) as T;
function arena(fighter:FighterId){
  const sim=new ArenaSimulation({trainingBot:false,seed:7});
  sim.addPlayer('me',fighter,'Me',false,{x:0,y:0,z:0});
  return sim;
}
const local=(prediction:Prediction)=>(prediction as unknown as {sim:ArenaSimulation}).sim;

describe('owner rollback across released attacks',()=>{
  it('charges a restored Vegeta volley as one cast toward the breaker',()=>withMove('vegeta','light',KI_BLAST_VOLLEY,()=>{
    const server=arena('vegeta'),prediction=new Prediction();
    server.addPlayer('foe','goku','Foe',false,{x:0,y:0,z:8});
    prediction.start('me',wire(server.snapshot(false,true)));
    try{
      for(let seq=0;seq<=60;seq++){
        const input:PlayerInput={seq,moveX:0,moveZ:0,yaw:0,targetId:'foe',attack:seq===0?'light':undefined};
        prediction.submit(input);server.submitInput('me',input);server.step();
        if(seq===17){
          const snapshot=wire<GameSnapshot>(server.snapshot(false,true));
          expect(snapshot.prediction!.me.shots).toHaveLength(2);
          prediction.reconcile(snapshot);
        }
      }
      const authoritative=server.actors.get('foe')!,predicted=local(prediction).actors.get('foe')!;
      expect(authoritative.state.hp).toBe(969);
      expect(predicted.state.hp).toBe(authoritative.state.hp);
      expect(authoritative.chainHits).toBe(1);
      expect(predicted.chainHits).toBe(authoritative.chainHits);
    }finally{prediction.stop();server.dispose();}
  }));

  it.each([17,36,38])('preserves map groups across wire restore at volley tick %i',tick=>withMove('vegeta','light',KI_BLAST_VOLLEY,()=>{
    const source=arena('vegeta'),restored=arena('vegeta');
    try{
      for(let seq=0;seq<=tick;seq++){
        source.submitInput('me',{seq,moveX:0,moveZ:0,yaw:0,attack:seq===0||seq===37?'light':undefined});
        source.step();
      }
      const checkpoint=wire(source.predictionCheckpoint('me')!);
      expect(checkpoint.shots.length).toBeGreaterThan(0);
      if(tick===17){
        expect(checkpoint.shots).toHaveLength(2);
        expect(checkpoint.shots.every(shot=>shot.openedGroup===checkpoint.cast!.openedGroup)).toBe(true);
      }else if(tick===36){
        expect(checkpoint.cast).toBeNull();
      }else{
        expect(checkpoint.cast).not.toBeNull();
        expect(checkpoint.shots[0].openedGroup).not.toBe(checkpoint.cast!.openedGroup);
      }
      restored.restorePrediction('me',checkpoint);
      const after=restored.predictionCheckpoint('me')!;
      expect(after.cast?.openedGroup).toBe(checkpoint.cast?.openedGroup);
      expect(after.shots.map(shot=>shot.openedGroup)).toEqual(checkpoint.shots.map(shot=>shot.openedGroup));
      expect(after.shots.map(shot=>shot.opened)).toEqual(checkpoint.shots.map(shot=>shot.opened));
    }finally{source.dispose();restored.dispose();}
  }));
});

describe('completed attack playback under batched acknowledgments',()=>{
  it.each([3,6])('keeps a moving airborne fighter out of run with batches of %i',batch=>{
    const server=arena('naruto'),prediction=new Prediction();
    prediction.start('me',wire(server.snapshot(false,true)));
    const queue:PlayerInput[]=[];
    let completionChecked=false;
    const drawnDone=10+Math.ceil(MOVES.naruto.light.duration*60);
    try{
      for(let seq=0;seq<100;seq++){
        const input:PlayerInput={seq,moveX:1,moveZ:0,yaw:0,jump:seq===0,jumpHeld:seq<10,attack:seq===10?'light':undefined};
        prediction.submit(input);queue.push(input);
        if(seq%batch===batch-1)while(queue.length&&queue[0].seq<=seq-6)server.submitInput('me',queue.shift()!);
        server.step();
        if(seq%2===1)prediction.reconcile(wire(server.snapshot(false,true)));
        const shown=prediction.sample(1/60,server.getPlayer('me')!)!;
        if(!shown.grounded)expect(shown.action).not.toBe('run');
        if(seq===drawnDone){
          expect(prediction.action).toBe('light');
          expect(shown.grounded).toBe(false);
          expect(shown.y).toBeGreaterThan(1);
          expect(shown.action).toBe('jump');
          completionChecked=true;
        }
      }
      expect(completionChecked).toBe(true);
    }finally{prediction.stop();server.dispose();}
  });
});
