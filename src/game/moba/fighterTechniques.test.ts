import { isReleasedFighter } from '../rosterAvailability';
import {expect,it} from 'vitest';
import {RiftMatch} from './RiftMatch';
import {snapshotFor} from './vision';
import {MOVES} from '../moves';
import {factionOf} from '../objectives/model';
import type {FighterId,CombatEvent,AttackSlot} from '../types';
it.each((Object.keys(MOVES) as FighterId[]).filter(isReleasedFighter))('%s preserves its real technique events in Rift War',fighter=>{
 for(const slot of ['special','ultimate'] as AttackSlot[]){
  const g=new RiftMatch({fillBots:false});try{
   g.add('caster',fighter,'Caster');g.add('foe',factionOf(fighter)==='heroes'?'dio':'goku','Opponent');g.start();for(let i=0;i<185;i++)g.step();
   g.sim.place('caster',{x:0,y:0,z:0});g.sim.place('foe',{x:0,y:0,z:3});const state=g.sim.actors.get('caster')!.state;state.ultimate=100;state.stamina=state.maxStamina??225;
   expect(g.submit('caster',{seq:1,moveX:0,moveZ:0,yaw:0,attack:slot,targetId:'foe'})).toBe(true);
   const raw:CombatEvent[]=[],filtered:CombatEvent[]=[];
   for(let i=0;i<Math.ceil((MOVES[fighter][slot].duration+2)*60);i++){
    g.step();const snapshot=g.snapshot();raw.push(...snapshot.events.filter(e=>e.actorId==='caster'&&(e.kind==='cast'||e.kind==='release')));filtered.push(...snapshotFor(snapshot,'caster').events.filter(e=>e.actorId==='caster'&&(e.kind==='cast'||e.kind==='release')));
   }
   expect(raw.length,`${fighter} ${slot} never cast`).toBeGreaterThan(0);
   expect(filtered.map(e=>({id:e.id,origin:e.origin,endpoint:e.endpoint}))).toEqual(raw.map(e=>({id:e.id,origin:e.origin,endpoint:e.endpoint})));
   expect(Number.isFinite(state.x)&&Number.isFinite(state.hp)).toBe(true);
  }finally{g.dispose();}
 }
});
