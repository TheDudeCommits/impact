import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera} from '../src/render/FollowCamera';
import {jumpArc,jumpGravity} from '../src/game/moves';
import type {Fighter} from '../src/render/Fighter';
import type {FighterId,PlayerState} from '../src/game/types';

function actor(id:string,fighter:FighterId,z=0){
  const group=new THREE.Group();group.position.z=z;
  const state={id,name:id,fighter,x:0,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
    action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
    cooldowns:{light:0,heavy:0,special:0,ultimate:0}} as PlayerState;
  return {state,group,velocity:new THREE.Vector3()} as unknown as Fighter;
}
function trajectory(fighter:FighterId){
  let y=0,vy=jumpArc(fighter).speed;const heights=[0];
  while(heights.length<180){vy-=23/60*jumpGravity(vy,false);y+=vy/60;heights.push(Math.max(0,y));if(y<=0)break;}
  return (t:number)=>{const tick=Math.max(0,t*60),i=Math.floor(tick);return THREE.MathUtils.lerp(heights[i]??0,heights[i+1]??0,tick-i);};
}
function watch(fighter:FighterId,mode:'dynamic'|'lockon',hz:number,distance:number,armed=false,bounded=false,diagonal=false){
  const me=actor('me',fighter),foe=actor('foe','goku',distance);
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);follow.mode=mode;
  if(bounded){me.group.position.z=-6.5;foe.group.position.z=-6.5+distance;follow.stageBounds={halfX:6.5,halfZ:7,doubleSided:true};}
  if(diagonal){me.group.position.set(-2.39,0,6.43);foe.group.position.set(0,0,0);}
  let yaw=diagonal?Math.atan2(2.39,-6.43):0,pitch=.02;const step=()=>{me.group.updateMatrixWorld(true);foe.group.updateMatrixWorld(true);follow.update(1/hz,me,yaw,pitch,[],0,foe,true);yaw=follow.inputYaw;pitch=follow.inputPitch;camera.updateMatrixWorld();};
  for(let i=0;i<hz*2;i++)step();
  const model=new THREE.Group(),weapon=new THREE.Mesh(new THREE.BoxGeometry(.08,2.4,.08),new THREE.MeshBasicMaterial());
  weapon.name='weapon_r_hand_test';weapon.position.set(0,1.7,.3);model.add(weapon);me.group.add(model);
  if(armed)(me as unknown as {model:THREE.Group}).model=model;else weapon.visible=false;
  const at=trajectory(fighter),point=new THREE.Vector3();let crown=-Infinity,feet=Infinity,foeCrown=-Infinity,foeFeet=Infinity,blade=-Infinity,fovRate=0,previousFov=camera.fov;let highestAt=0,lowestAt=0;
  for(let i=0;i<hz*3;i++){
    const t=i/hz,y=at(t);me.group.position.y=y;me.state.y=y;me.state.grounded=y<=0;me.state.action=y>0?'jump':'idle';
    weapon.rotation.z=y>0&&t>.25&&t<.8?0:Math.PI/2;
    step();
    const project=(body:Fighter,up:number)=>point.copy(body.group.position).add(new THREE.Vector3(0,up,0)).project(camera).y;
    if(project(me,1.95)>crown)highestAt=t;crown=Math.max(crown,project(me,1.95));if(project(me,.03)<feet)lowestAt=t;feet=Math.min(feet,project(me,.03));foeCrown=Math.max(foeCrown,project(foe,1.95));foeFeet=Math.min(foeFeet,project(foe,.03));
    if(armed&&y>0){weapon.localToWorld(point.set(0,1.2,0));blade=Math.max(blade,point.project(camera).y);}
    fovRate=Math.max(fovRate,Math.abs(camera.fov-previousFov)*hz);previousFov=camera.fov;
  }
  return {crown,feet,foeCrown,foeFeet,blade,fovRate,highestAt,lowestAt};
}

describe('the local player jumps above a grounded lock target',()=>{
  it.each(['dynamic','lockon'] as const)('%s retains both full bodies throughout the current fast jump',mode=>{
    for(const fighter of ['mihawk','goku'] as const)for(const distance of [3,7])for(const hz of [30,60,120]){
      const r=watch(fighter,mode,hz,distance);const why=`${fighter}, ${distance}m, ${hz}Hz ${JSON.stringify(r)}`;
      expect(r.crown,why).toBeLessThan(.95);expect(r.feet,why).toBeGreaterThan(-.98);
      expect(r.foeCrown,why).toBeLessThan(.95);expect(r.foeFeet,why).toBeGreaterThan(-.98);
      expect(r.fovRate,why).toBeLessThanOrEqual(91);
    }
  });
  it('keeps both bodies visible when the Training room boundary shortens the boom',()=>{
    for(const distance of [3,7])for(const hz of [30,60,120]){const r=watch('mihawk','dynamic',hz,distance,false,true);expect(r.crown,JSON.stringify(r)).toBeLessThan(.95);expect(r.feet,JSON.stringify(r)).toBeGreaterThan(-.98);expect(r.foeFeet).toBeGreaterThan(-.98);
      expect(r.fovRate).toBeLessThanOrEqual(95);}
  });
  it('handles a diagonal jump where the lens only just touches the Training wall',()=>{
    for(const hz of [30,60,120]){const r=watch('mihawk','dynamic',hz,7,true,true,true);expect(r.crown,JSON.stringify(r)).toBeLessThan(.95);expect(r.blade,JSON.stringify(r)).toBeLessThan(.96);expect(r.feet,JSON.stringify(r)).toBeGreaterThan(-.98);expect(r.foeFeet).toBeGreaterThan(-.98);
      expect(r.fovRate).toBeLessThanOrEqual(95);}
  });
  it('includes a raised held blade in the dynamic airborne silhouette',()=>{
    for(const bounded of [false,true])for(const hz of [30,60,120]){const r=watch('mihawk','dynamic',hz,7,true,bounded);expect(r.blade,JSON.stringify(r)).toBeLessThan(.96);expect(r.foeFeet).toBeGreaterThan(-.98);}
  });
});
