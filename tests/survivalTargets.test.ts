import {describe,it,expect} from 'vitest';
import {SurvivalTargets} from '../src/survival/SurvivalTargets';
import {HordeFrame} from '../src/survival/horde/frame';
import {GS, toMoveDefinition} from '../src/survival/horde/Horde';
import {GRUNTS} from '../src/survival/horde/kinds';
import {Targeting} from '../src/game/Targeting';
import {CameraFocus} from '../src/render/CameraFocus';
import {castThreat,ThreatOutline} from '../src/render/ThreatOutline';
import type {PlayerState} from '../src/game/types';
const player=(id:string,team?:string)=>({id,name:id,fighter:'goku',x:0,y:0,z:0,yaw:0,hp:1000,maxHp:1000,alive:true,team,action:'idle',grounded:true} as PlayerState);
function swarm(n=3){const frame=new HordeFrame();frame.n=n;for(let i=0;i<n;i++){frame.serial[i]=i+1;frame.kind[i]=0;frame.state[i]=GS.MOVE;frame.hp[i]=1;frame.x[i]=i*2;frame.z[i]=5;}return frame;}
describe('compact Arcade enemies using the shared camera and target system',()=>{
 it('cycles grunts and bosses without locking teammates, releases, and drops dead locks',()=>{
  const adapter=new SurvivalTargets(),aim=new Targeting(),me=player('me','party'),ally=player('ally','party'),boss=player('boss','enemies');boss.z=8;
  const frame=swarm(),players=adapter.update([me,ally,boss],frame,me),seen=new Set<string|null>();
  for(let i=0;i<4;i++)seen.add(aim.cycle(players,me,0,i*.1));
  expect(seen).toEqual(new Set(['boss','g1','g2','g3']));expect(aim.locked).toBe(true);
  aim.release();expect(aim.locked).toBe(false);
  aim.cycle(players,me);const locked=aim.id!;if(locked==='boss')boss.alive=false;else frame.state[Number(locked.slice(1))-1]=GS.DEAD;
  aim.update(adapter.update([me,ally,boss],frame,me),me,[],1);expect(aim.locked).toBe(false);expect(aim.id).not.toBe(locked);
 });
 it('uses actual compact attacks for focus and does not invent a co-op target behind the attacker',()=>{
  const adapter=new SurvivalTargets(),focus=new CameraFocus(),me=player('me'),frame=swarm(1);frame.state[0]=GS.ATTACK;frame.z[0]=3;frame.yaw[0]=Math.PI;frame.span[0]=GRUNTS[0].moves[0].duration;frame.phase[0]=.1;
  const states=adapter.update([me],frame,me),grunt=states[1];
  const threat=castThreat(grunt);expect(threat.move).toEqual(toMoveDefinition(GRUNTS[0].moves[0]));expect(threat.elapsed).toBeCloseTo(.1);expect(grunt.target).toBe(me.id);
  expect(focus.update(1/60,states,me,0,[],null,null)).toBe('g1');
  frame.yaw[0]=0;expect(adapter.update([me],frame,me)[1].target).toBeNull();
 });
 it('bounds long-run proxy storage and framing while retaining all switchable targets',()=>{
  const adapter=new SurvivalTargets(),frame=swarm(320),me=player('me');for(let i=0;i<320;i++){frame.x[i]=(i%16)-8;frame.z[i]=Math.floor(i/16)+1;}
  for(let wave=0;wave<100;wave++){for(let i=0;i<320;i++)frame.serial[i]=wave*320+i+1;adapter.update([me],frame,me);}
  expect(adapter.players).toHaveLength(321);expect(adapter.crowd.size).toBe(24);expect(adapter.capacity).toBeLessThanOrEqual(640);
  expect(adapter.crowd.values().next().value!.group.parent).toBeNull();
  frame.n=0;adapter.update([me],frame,me);expect(adapter.bodies.size).toBe(0);expect(adapter.crowd.size).toBe(0);
  adapter.clear();expect(adapter.capacity).toBe(0);expect(adapter.players).toHaveLength(0);
 });
 it('keeps surviving bodies stable when packed frame indices change',()=>{
  const a=new SurvivalTargets(),f=swarm(2),me=player('me');a.update([me],f,me);const first=a.body('g1')!,second=a.body('g2')!;
  f.n=1;f.serial[0]=2;a.update([me],f,me);expect(a.body('g2')).toBe(second);expect(first.state.alive).toBe(false);
  f.serial[0]=3;a.update([me],f,me);expect(a.body('g3')).toBe(first);expect(second.state.alive).toBe(false);
 });
 it('shares the same glow and keeps a fading target out of the recycled pool',()=>{
  const a=new SurvivalTargets(),f=swarm(2),me=player('me'),glow=new ThreatOutline();a.update([me],f,me);
  const first=a.body('g1')!,second=a.body('g2')!;
  glow.update(.1,first);expect(a.glows.get(1)).toBe(first.threatInk);expect(a.glows.get(1)!.mix.value).toBe(1);
  glow.update(.05,second);expect(first.threatInk.mix.value).toBeGreaterThan(0);expect(second.threatInk.mix.value).toBeGreaterThan(0);
  f.n=1;f.serial[0]=3;a.update([me],f,me);expect(a.body('g3')).not.toBe(first);expect(a.body('g3')).not.toBe(second);
  expect(a.glows.has(1)).toBe(false);expect(a.glows.get(3)!.mix.value).toBe(0);
  for(let i=0;i<4;i++)glow.update(.1,undefined);
  f.serial[0]=4;a.update([me],f,me);expect(a.body('g4')).toBe(first);expect(a.glows.get(4)!.mix.value).toBe(0);
  a.clear();expect(a.glows.size).toBe(0);
 });
 it('excludes spawning, dead and distant grunts' ,()=>{const a=new SurvivalTargets(),f=swarm(3),me=player('me');f.state[0]=GS.SPAWN;f.hp[1]=0;f.x[2]=70;expect(a.update([me],f,me)).toEqual([me]);});
});
