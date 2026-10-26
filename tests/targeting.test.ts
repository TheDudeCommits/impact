import {describe,it,expect} from 'vitest';
import {Targeting} from '../src/game/Targeting';
import {FollowCamera} from '../src/render/FollowCamera';
import * as T from 'three';
import type {PlayerState,CombatEvent} from '../src/game/types';
import type {Fighter} from '../src/render/Fighter';
const p=(id:string,x=0,z=0,extras:Partial<PlayerState>={}):PlayerState=>({id,name:id,fighter:'goku',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:100,action:'idle',actionStarted:0,actionTime:0,actionDuration:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,cooldowns:{light:0,heavy:0,special:0,ultimate:0},...extras});
describe('automatic and deliberate target locks',()=>{
 it('acquires nearest live enemy and follows a substantially nearer opponent',()=>{const a=new Targeting(),self=p('self'),near=p('near',0,4),far=p('far',0,9);expect(a.update([self,far,near],self,[],0)).toBe('near');far.z=1;expect(a.update([self,far,near],self,[],1)).toBe('far');far.alive=false;expect(a.update([self,far,near],self,[],2)).toBe('near');});
 it('prioritizes a threat targeting the player and returns to proximity afterward',()=>{const a=new Targeting(),self=p('self'),near=p('near',0,3),attacker=p('attacker',5,0,{action:'special',target:'self'});expect(a.update([self,near,attacker],self,[],0)).toBe('attacker');attacker.action='idle';expect(a.update([self,near,attacker],self,[],1)).toBe('near');const hit:CombatEvent={id:1,kind:'hit',actorId:'attacker',targetId:'self',serverTime:1};expect(a.update([self,near,attacker],self,[hit],1)).toBe('attacker');expect(a.update([self,near,attacker],self,[hit],4.1)).toBe('near');});
 it('Tab locks onto what is in front, cycles across the screen and round again (round 4b: no release mid-cycle)',()=>{
  const a=new Targeting(),self=p('self'),near=p('near',0,3),far=p('far',9,0),list=[self,near,far];
  a.update(list,self,[],0);
  expect(a.cycle(list,self)).toBe('near');expect(a.locked).toBe(true);
  expect(a.update(list,self,[],1),'a hard lock does not drift').toBe('near');
  expect(a.cycle(list,self),'the next one across').toBe('far');
  expect(a.update(list,self,[],1.5)).toBe('far');
  expect(a.cycle(list,self),'round again').toBe('near');
  expect(a.locked,'never a release in the middle of Tabbing').toBe(true);
  a.release();
  expect(a.update(list,self,[],2)).toBe('near');
  a.cycle(list,self);a.cycle(list,self);
  expect(a.locked).toBe(true);far.alive=false;
  expect(a.update(list,self,[],3),'a lock does not survive its fighter').toBe('near');
  expect(a.locked).toBe(false);
  a.reset();expect(a.cycle([self],self)).toBeNull();
 });
 it('will not spin the camera round for someone hitting you from behind',()=>{
  const a=new Targeting(),self=p('self'),ahead=p('ahead',0,6),behind=p('behind',0,-5);
  const hit:CombatEvent={id:1,kind:'hit',actorId:'behind',targetId:'self',serverTime:1};
  expect(a.update([self,ahead,behind],self,[hit],1),'worth knowing about, not worth turning for').toBe('ahead');
  a.reset();
  expect(a.update([self,ahead,behind],self,[{...hit,id:2}],1,0)).toBe('ahead');
 });
 it('is not taken off an engaged opponent by a chip from across the arena',()=>{
  const a=new Targeting(),self=p('self'),near=p('near',0,1.5),sniper=p('sniper',0,30),close=p('close',3,2);
  expect(a.update([self,near,sniper,close],self,[],0)).toBe('near');
  const far:CombatEvent={id:1,kind:'hit',actorId:'sniper',targetId:'self',serverTime:1};
  expect(a.update([self,near,sniper,close],self,[far],1),'reported by the marker, not adopted').toBe('near');
  const nearby:CombatEvent={id:2,kind:'hit',actorId:'close',targetId:'self',serverTime:1.5};
  expect(a.update([self,near,sniper,close],self,[nearby],1.5)).toBe('close');
 });
 it('ignores small distance jitter, out-of-range fighters and self',()=>{const a=new Targeting(),self=p('self'),left=p('left',0,4),right=p('right',0,4.2),away=p('away',0,80);expect(a.update([self,left,right,away],self,[],0)).toBe('left');right.z=3.8;expect(a.update([self,left,right,away],self,[],1)).toBe('left');a.reset();expect(a.update([self,away],self,[],2)).toBeNull();});
});

const actor=(s:PlayerState)=>{const group=new T.Group();group.position.set(s.x,s.y,s.z);return {state:s,group,velocity:new T.Vector3()} as unknown as Fighter;};
describe('player-owned camera through combat',()=>{
 it('keeps aim and distance unchanged for moving, airborne or transformed targets',()=>{
  const camera=new T.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
  const self=actor(p('self')),foe=actor(p('foe',0,4));
  follow.update(1/60,self,0,0,[],0,foe,true);
  const position=camera.position.clone(),aim=camera.quaternion.clone(),fov=camera.fov;
  for(let i=0;i<300;i++){
   foe.group.position.set(Math.sin(i*.1)*20,Math.sin(i*.07)*3,Math.cos(i*.1)*20);
   foe.state.fighter='naruto';foe.state.awakened=i>50;
   self.state.action=(['idle','light','heavy','special','ultimate'] as const)[i%5];
   follow.update(1/60,self,0,0,[],0,foe,i%2===0);
   expect(camera.position.distanceTo(position)).toBeLessThan(.00001);
   expect(camera.quaternion.angleTo(aim)).toBeLessThan(.00001);
   expect(camera.fov).toBe(fov);
  }
 });
 it('tracks the presented player exactly during translation and hitstop corrections',()=>{
  const camera=new T.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),self=actor(p('self'));
  follow.update(1/60,self,0,0,[],0);
  const offset=camera.position.clone().sub(self.group.position);
  for(let i=0;i<120;i++){
   self.group.position.x+=Math.sin(i*.2)*.1;self.group.position.z+=.1;
   self.state.hitstop=i%7===0;
   follow.update(1/60,self,0,0,[],0);
   expect(camera.position.clone().sub(self.group.position).distanceTo(offset)).toBeLessThan(.001);
  }
 });
 it('answers manual orbit promptly and never drifts after the input stops',()=>{
  const camera=new T.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),self=actor(p('self'));
  follow.update(1/60,self,0,0,[],0);
  let previous=0;
  for(let i=0;i<30;i++){
   follow.update(1/60,self,Math.PI/2,0,[],0);
   expect(follow.yaw).toBeGreaterThanOrEqual(previous);expect(follow.yaw).toBeLessThanOrEqual(Math.PI/2);
   if(i===5)expect(follow.yaw).toBeGreaterThan(1.5);
   previous=follow.yaw;
  }
  expect(follow.yaw).toBeCloseTo(Math.PI/2,5);
 });
 it('scales smoothly for the player form and resets to the correct spawn view',()=>{
  const camera=new T.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),self=actor(p('self',0,0,{fighter:'naruto'}));
  follow.update(1/60,self,0,0,[],0);const base=camera.position.length();
  self.state.awakened=true;
  for(let i=0;i<180;i++)follow.update(1/60,self,0,0,[],0);
  expect(camera.position.length()).toBeGreaterThan(base+3);
  self.state.awakened=false;follow.reset();follow.update(1/60,self,0,0,[],0);
  expect(camera.position.length()).toBeCloseTo(base,5);
 });
 it('keeps cosmetic hit shake out of the movement basis and honors the setting',()=>{
  const measure=(amount:number,setting:number)=>{
   const camera=new T.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),self=actor(p('self'));
   follow.update(1/60,self,0,0,[],0);const aim=camera.quaternion.clone(),basis=follow.movementYaw;
   follow.impact(amount);let peak=0;
   for(let i=0;i<20;i++){follow.update(1/60,self,0,0,[],setting);peak=Math.max(peak,camera.quaternion.angleTo(aim));expect(follow.movementYaw).toBe(basis);}
   return peak;
  };
  const heavy=measure(.8,1);expect(heavy).toBeGreaterThan(measure(.28,1)*2);
  expect(measure(.8,.5)).toBeCloseTo(heavy*.5,4);expect(measure(.8,0)).toBeLessThan(.000001);
 });
});
