import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {CrowdGroup,HiddenPoseClock,jointInAncestor} from '../src/render/horde/poseBudget';

describe('horde pose budget',()=>{
 it('matches world-space root correction under rotated, scaled and animated ancestors without visiting siblings',()=>{
  const scene=new THREE.Group(),group=new CrowdGroup(),model=new THREE.Group(),armature=new THREE.Group(),hips=new THREE.Bone(),sibling=new THREE.Bone();
  scene.add(group);group.add(model);model.add(armature);armature.add(hips,sibling);
  scene.position.set(8,-2,5);scene.rotation.set(.1,.3,-.2);scene.scale.set(1.5,.7,2);
  group.position.set(-4,2,9);group.rotation.y=1.2;model.scale.setScalar(.018);model.rotation.y=Math.PI;model.position.set(.3,-.08,-.4);armature.rotation.x=-Math.PI/2;
  for(let i=0;i<60;i++){
   hips.position.set(Math.sin(i)*3,89+i*.01,Math.cos(i)*9);hips.rotation.y=i*.02;
   scene.updateMatrixWorld(true);const exact=group.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
   const visit=vi.spyOn(sibling,'updateMatrixWorld');const result=jointInAncestor(hips,group,new THREE.Vector3());
   expect(result.distanceTo(exact)).toBeLessThan(1e-10);expect(visit).not.toHaveBeenCalled();visit.mockRestore();
  }
 });
 it('leaves explicit world-space queries valid while hidden and resumes the entire hierarchy on re-entry',()=>{
  const root=new THREE.Group(),group=new CrowdGroup(),bone=new THREE.Bone();root.add(group);group.add(bone);root.updateMatrixWorld(true);
  group.visible=false;group.position.x=7;bone.position.y=2;const visit=vi.spyOn(bone,'updateMatrixWorld');root.updateMatrixWorld(true);expect(visit).not.toHaveBeenCalled();
  expect(bone.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([7,2,0]);
  bone.position.y=3;group.visible=true;root.updateMatrixWorld(true);expect(visit).toHaveBeenCalled();expect(bone.matrixWorld.elements[13]).toBe(3);
 });
 it('always advances visible poses and catches up hidden poses without losing elapsed time',()=>{
  const clock=new HiddenPoseClock();let elapsed=0,updates=0;
  for(let i=0;i<120;i++){const step=clock.step(1/60,false,'run');if(step!==undefined){elapsed+=step;updates++;}}
  expect(updates).toBeLessThanOrEqual(9);elapsed+=clock.step(1/60,true,'run')!;expect(elapsed).toBeCloseTo(121/60,10);
  for(let i=0;i<60;i++)expect(clock.step(1/60,true,'run')).toBeCloseTo(1/60,10);
  clock.step(.02,false,'run');expect(clock.step(.01,false,'hit')).toBeCloseTo(.03,10);
 });
});
