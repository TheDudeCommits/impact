import {describe,it,expect} from 'vitest';
import {ArenaSimulation} from '../src/game/simulation';
import {Prediction} from '../src/game/prediction';
import {MOVES,meleeReach} from '../src/game/moves';
import {moveFor} from '../src/game/awakening';
import {InputQueue} from '../src/server/InputQueue';
import type {CombatEvent,GameSnapshot,PlayerInput} from '../src/game/types';

function arena(){
 const s=new ArenaSimulation({roomMode:'training',trainingBot:false});
 s.addPlayer('me','naruto','Naruto',false,{x:0,y:0,z:0});
 s.addPlayer('foe','goku','Goku',false,{x:0,y:0,z:2});return s;
}
const hold=(s:ArenaSimulation,seconds:number)=>{const a=s.actors.get('foe')!;a.reaction='stun';a.stunUntil=s.serverTime+seconds;};
const RASENGAN=MOVES.naruto.heavy,CONTACT=RASENGAN.contacts[0],CONTACT_TICK=Math.round(CONTACT*60),STRUCK=1000-RASENGAN.damage;
describe('Rasengan charge and contact',()=>{
 it('keeps the measured energy reach scoped to grounded base Rasengan',()=>{
  expect(meleeReach('naruto','heavy',MOVES.naruto.heavy)).toBeCloseTo(1.5);
  expect(meleeReach('naruto','heavy',MOVES.naruto.heavy,false)).toBeCloseTo(1.3);
  expect(meleeReach('naruto','heavy',moveFor('naruto','heavy',true))).toBeCloseTo(1.3);
 });
 it('forms in place, then approaches an unlocked opponent without passing through',()=>{
  const s=arena();try{
   for(let tick=0;tick<70;tick++){
    s.submitInput('me',{seq:tick,moveX:0,moveZ:0,yaw:0,attack:tick===0?'heavy':undefined});s.step();
    const p=s.getPlayer('me')!,foe=s.getPlayer('foe')!;
    if(tick<Math.floor(RASENGAN.lungeDelay!*60))expect(Math.hypot(p.x,p.z)).toBeLessThan(.001);
    expect(p.z).toBeLessThan(foe.z);
   }
   expect(s.getPlayer('foe')!.hp).toBe(STRUCK);
   expect(s.getPlayer('me')!.z).toBeGreaterThan(.1);
  }finally{s.dispose();}
 });
 it('gives held lateral input immediate full movement during formation',()=>{
  const s=arena();try{
   for(let tick=0;tick<30;tick++){s.submitInput('me',{seq:tick,moveX:1,moveZ:0,yaw:0,attack:tick===0?'heavy':undefined});s.step();}
   expect(s.getPlayer('me')!.x).toBeGreaterThan(3.4);
   expect(Math.abs(s.getPlayer('me')!.z)).toBeLessThan(.001);
  }finally{s.dispose();}
 });
 it.each([3.8,4.2,4.3])('connects the extended energy sphere through its active frames from %sm',gap=>{
  const s=arena();s.actors.get('foe')!.state.z=gap;let hitAt=0;
  try{for(let tick=0;tick<100;tick++){
   s.submitInput('me',{seq:tick,moveX:0,moveZ:0,yaw:0,attack:tick===0?'heavy':undefined});s.step();
   if(s.getPlayer('foe')!.hp<1000&&!hitAt)hitAt=tick/60;
  }
  expect(s.getPlayer('foe')!.hp).toBe(STRUCK);expect(hitAt).toBeGreaterThanOrEqual(CONTACT);expect(hitAt).toBeLessThanOrEqual(CONTACT+.18);
  }finally{s.dispose();}
 });
 it('yields Rasengan follow-through to held movement and never chases after active frames',()=>{
  const s=arena();s.actors.get('foe')!.state.z=4.3;
  try{
   const held=CONTACT_TICK+1;
   for(let tick=0;tick<held;tick++){s.submitInput('me',{seq:tick,moveX:0,moveZ:0,yaw:0,attack:tick===0?'heavy':undefined});s.step();}
   const before={...s.getPlayer('me')!};
   for(let tick=held;tick<held+15;tick++){s.submitInput('me',{seq:tick,moveX:1,moveZ:0,yaw:0});s.step();}
   expect(s.getPlayer('me')!.x-before.x).toBeGreaterThan(1.5);
   expect(s.getPlayer('me')!.z-before.z).toBeLessThan(.001);
   expect(s.getPlayer('foe')!.hp).toBe(1000);
   const settledZ=s.getPlayer('me')!.z;
   for(let tick=held+15;tick<held+53;tick++){s.submitInput('me',{seq:tick,moveX:0,moveZ:0,yaw:0});s.step();}
   expect(s.getPlayer('me')!.z).toBeCloseTo(settledZ,5);
  }finally{s.dispose();}
 });
 it('presents one contact on extension through 300ms RTT while health stays authoritative',()=>{
  const server=arena(),prediction=new Prediction(),queue=new InputQueue();hold(server,1.3);
  let snapshot=server.snapshot(true,true);prediction.start('me',snapshot);
  const up:{at:number;input:PlayerInput}[]=[],down:{at:number;s:GameSnapshot}[]=[];
  const shown:{tick:number;action:string;y:number;hp:number;time:number}[]=[],impacts:CombatEvent[]=[];
  let contactTick=-1,confirmed=false;
  try{for(let tick=0;tick<300;tick++){
   const input:PlayerInput={seq:tick,moveX:0,moveZ:0,yaw:0,attack:tick===30?'heavy':undefined};
   prediction.submit(input);up.push({at:tick+9,input});
   while(up.length&&up[0].at<=tick)queue.push(up.shift()!.input);
   const next=queue.take();if(next)server.submitInput('me',next);
   server.step(1/60,new Set(next?[]:['me']));
   if(tick%2===0)down.push({at:tick+9,s:server.snapshot(true,true)});
   while(down.length&&down[0].at<=tick){snapshot=down.shift()!.s;prediction.reconcile(snapshot);}
   const events=prediction.takeImpacts();impacts.push(...events);
   const foe=snapshot.players.find(p=>p.id==='foe')!,view=prediction.sampleRemote(1/60,foe);
   if(events.length){contactTick=tick;expect(foe.hp).toBe(1000);expect(view.hp).toBe(1000);expect(['launched','hurt','flinch']).toContain(view.action);}
   for(const e of snapshot.events)if(e.kind==='hit'&&e.actorId==='me'){expect(prediction.impactWasPresented(e)).toBe(true);confirmed=true;}
   if(contactTick>=0)shown.push({tick,action:view.action,y:view.y,hp:view.hp,time:view.actionTime});
  }
  expect(impacts).toHaveLength(1);expect(contactTick-30).toBeGreaterThanOrEqual(CONTACT_TICK-1);expect(contactTick-30).toBeLessThanOrEqual(CONTACT_TICK+5);
  expect(confirmed).toBe(true);
  expect(shown.at(-1)!.action).toBe('idle');expect(shown.at(-1)!.hp).toBe(STRUCK);
  for(let i=1;i<shown.length;i++)if(shown[i].action===shown[i-1].action)expect(shown[i].time).toBeGreaterThanOrEqual(shown[i-1].time-.001);
  }finally{prediction.stop();server.dispose();}
 });
 it('does not expose opponent input or cast buffers in public reaction state',()=>{
  const s=arena();try{const r=s.snapshot(false,true).reactions!.foe;
   expect(r).not.toHaveProperty('input');expect(r).not.toHaveProperty('cast');expect(r).not.toHaveProperty('bufferedAttack');
  }finally{s.dispose();}
 });
 it.each([0,.5,1])('keeps both defender interpolation endpoints continuous after an empty replay (alpha=%s)',alpha=>{
  const server=arena(),prediction=new Prediction();hold(server,1.3);prediction.start('me',server.snapshot(true,true));
  try{
   for(let tick=0;tick<68;tick++){
    const input:PlayerInput={seq:tick,moveX:0,moveZ:0,yaw:0,attack:tick===0?'heavy':undefined};
    server.submitInput('me',input);server.step();prediction.submit(input);prediction.takeImpacts();
   }
   const foe=server.getPlayer('foe')!,before=prediction.sampleRemote(0,foe,alpha);
   for(let tick=0;tick<5;tick++)server.step();
   prediction.reconcile(server.snapshot(true,true));
   const after=prediction.sampleRemote(0,server.getPlayer('foe')!,alpha);
   expect(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)).toBeLessThan(.00001);
  }finally{prediction.stop();server.dispose();}
 });
 it('does not repeat an impact already presented from authority during a render stall',()=>{
  const server=arena(),prediction=new Prediction();hold(server,1.3);prediction.start('me',server.snapshot(true,true));
  try{
   for(let tick=0;tick<70;tick++){
    const input:PlayerInput={seq:tick,moveX:0,moveZ:0,yaw:0,attack:tick===0?'heavy':undefined};
    server.submitInput('me',input);server.step();prediction.submit(input);
   }
   const hits=server.snapshot(true,true).events.filter(e=>e.kind==='hit');expect(hits).toHaveLength(1);
   prediction.markAuthoritativeImpacts(hits);expect(prediction.takeImpacts()).toHaveLength(0);
  }finally{prediction.stop();server.dispose();}
 });
});
