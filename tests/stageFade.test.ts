import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {installCameraCutaway} from '../src/render/CameraCutaway';
import {FollowCamera,roomOf} from '../src/render/FollowCamera';
import {hallWalls} from './knockbackScenes';
import {OcclusionFader,installOcclusionFade} from '../src/render/OcclusionFade';
import {stageFadeUniforms as U,STAGE_FADE_FRAGMENT,STAGE_FADE_VERTEX} from '../src/render/StageFade';
import type {Fighter} from '../src/render/Fighter';
import type {PlayerState} from '../src/game/types';


const state=(id:string,x=0,z=0,y=0):PlayerState=>({id,name:id,fighter:'zoro',x,y,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
const actor=(id:string,x=0,z=0)=>{
  const group=new THREE.Group();group.position.set(x,0,z);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(.5,1.8,.3),new THREE.MeshToonMaterial()));
  const body={state:state(id,x,z),group,velocity:new THREE.Vector3()} as unknown as Fighter;
  installOcclusionFade(body);return body;
};
function scene(apart=6){
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,300),fader=new OcclusionFader();
  camera.position.set(.8,1.6,-3.2);camera.lookAt(.3,1.1,apart);camera.updateMatrixWorld();
  const me=actor('me'),foe=actor('foe',.3,apart),crowd=new Map([['me',me],['foe',foe]]);
  const step=(frames=1,target:Fighter|undefined=foe)=>{for(let i=0;i<frames;i++)fader.update(1/60,camera,crowd,me,target,[]);};
  return {camera,fader,me,foe,step};
}

describe('the stage fade',()=>{
  it('rides in the cutaway\'s own program: one patch, its uniforms, a new key',()=>{
    const material=new THREE.MeshStandardMaterial();
    installCameraCutaway(material);
    expect(material.customProgramCacheKey()).toContain('player-cutaway-v3');
    const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'void main(){\n#include <project_vertex>\n}',fragmentShader:'void main(){\n#include <opaque_fragment>\n}'};
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
    for(const name of ['uStageOn','uStageFloor','uStageFront','uStageBoxA','uStageDepthA','uStageBoxB','uStageDepthB'])expect(shader.uniforms[name],name).toBe((U as Record<string,unknown>)[name]);
    expect(shader.vertexShader).toContain('vStageClip=gl_Position.xyw;');
    expect(shader.vertexShader.indexOf('vStageClip=gl_Position.xyw;'),'after the position is projected').toBeGreaterThan(shader.vertexShader.indexOf('#include <project_vertex>'));
    expect(shader.fragmentShader).toContain('float stageDrop(vec3 world)');
    expect(shader.fragmentShader).toContain('if(stageDrop(vCutWorld)>cutDither)discard;');
    expect(shader.fragmentShader).toContain('world.y<=uStageFloor+.035');
    expect(shader.fragmentShader.indexOf('stageDrop(vCutWorld)')).toBeLessThan(shader.fragmentShader.indexOf('#include <opaque_fragment>'));
    material.dispose();
  });

  it('uses no word GLSL ES reserves: a stage program that fails to compile draws none of the stage',()=>{
    const reserved=['half','fixed','input','output','long','short','double','unsigned','superp','sizeof','cast','namespace','using','public','static','extern','external','interface','class','union','enum','typedef','template','this','packed','goto','inline','noinline','volatile','asm','hvec2','hvec3','hvec4','dvec2','dvec3','dvec4','fvec2','fvec3','fvec4','filter','common','partition','active','resource','buffer','shared'];
    for(const source of [STAGE_FADE_FRAGMENT,STAGE_FADE_VERTEX]){
      const words=new Set(source.replace(/\/\/.*$/gm,'').match(/[A-Za-z_][A-Za-z0-9_]*/g)??[]);
      for(const word of reserved)expect(words.has(word),word).toBe(false);
    }
  });

  it('clears what stands nearer the lens than the fight, over the player and over the target',()=>{
    const {camera,fader,me,step}=scene();
    step(60);
    expect(U.uStageOn.value).toBe(1);
    const depth=new THREE.Vector3(0,1,0).applyMatrix4(camera.matrixWorldInverse).z*-1;
    const [gone,kept]=U.uStageFront.value.toArray();
    expect(kept,'in front of the player').toBeLessThan(depth-.3);
    expect(kept,'but not far in front').toBeGreaterThan(depth-1.2);
    expect(gone).toBeCloseTo(kept-.9,5);
    const a=U.uStageBoxA.value,da=U.uStageDepthA.value;
    const at=new THREE.Vector3(0,1,0).project(camera);
    expect(at.x).toBeGreaterThan(a.x);expect(at.x).toBeLessThan(a.z);expect(at.y).toBeGreaterThan(a.y);expect(at.y).toBeLessThan(a.w);
    expect(da.z).toBe(1);expect(da.y).toBeLessThan(depth);expect(da.y).toBeGreaterThan(depth-.5);
    const b=U.uStageBoxB.value,db=U.uStageDepthB.value,them=new THREE.Vector3(.3,1,6).project(camera);
    expect(db.z).toBeGreaterThan(.99);
    expect(them.x).toBeGreaterThan(b.x);expect(them.x).toBeLessThan(b.z);
    expect(db.y).toBeGreaterThan(kept+4);
    expect(fader.stage.state.target).toBeGreaterThan(.99);
    void me;
  });

  it('opens the target\'s window by frames when the target changes, and not for a target beyond the fight',()=>{
    const {camera,fader,me,foe,step}=scene();
    step(60);
    const other=actor('other',-2,7);
    fader.update(1/60,camera,new Map([['me',me],['foe',foe],['other',other]]),me,other,[]);
    expect(U.uStageDepthB.value.z,'a new target: from nothing').toBeLessThan(.2);
    const far=scene(22);far.step(90);
    expect(U.uStageDepthB.value.z,'22 m off is not the fight').toBe(0);
    const mid=scene(12);mid.step(90);
    expect(U.uStageDepthB.value.z).toBeGreaterThan(.3);expect(U.uStageDepthB.value.z).toBeLessThan(.8);
  });

  it('keeps the floor the player left under a jump',()=>{
    const {me,step}=scene();
    step(10);expect(U.uStageFloor.value).toBe(0);
    me.state.grounded=false;me.group.position.y=2.4;step(10);
    expect(U.uStageFloor.value,'the ground, not the feet in the air').toBe(0);
    me.state.grounded=true;step(1);
    expect(U.uStageFloor.value,'standing on something higher').toBeCloseTo(2.4,6);
  });

  it('eases the front plane rather than jumping it when a nearer subject appears',()=>{
    const {foe,step}=scene();
    step(60);
    const before=U.uStageFront.value.y;
    foe.group.position.set(.5,0,-1.4);step(1);
    const first=before-U.uStageFront.value.y;
    step(60);
    const all=before-U.uStageFront.value.y;
    expect(all,'the plane comes forward of the nearer body').toBeGreaterThan(1);
    expect(first,'a frame of it, not all of it').toBeLessThan(all*.2);
  });

  it('finds the room an enclosed stage\'s camera walls make, and none in the town',()=>{
    const room=roomOf(hallWalls())!;
    expect(room).toBeDefined();
    expect(room.x0).toBeGreaterThan(-6.6);expect(room.x0).toBeLessThan(-5.8);expect(room.x1).toBeCloseTo(-room.x0,6);
    expect(room.z0).toBeGreaterThan(-7.1);expect(room.z0).toBeLessThan(-6.3);expect(room.z1).toBeCloseTo(-room.z0,6);
    expect(roomOf([])).toBeUndefined();
    const town=new THREE.InstancedMesh(new THREE.BoxGeometry(1,14,20),new THREE.MeshBasicMaterial(),4);
    expect(roomOf([town]),'the town\'s occluders are its instanced buildings').toBeUndefined();
  });

  it('cuts a room\'s wall by the front plane only where the lens stands behind it',()=>{
    const material=new THREE.MeshStandardMaterial();installCameraCutaway(material);
    const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'void main(){\n#include <project_vertex>\n}',fragmentShader:'void main(){\n#include <opaque_fragment>\n}'};
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms,{} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toContain('world.x<uStageRoom.x+W&&uStageEye.x>uStageRoom.x');
    expect(shader.uniforms.uStageRoom).toBe(U.uStageRoom);expect(shader.uniforms.uStageEye).toBe(U.uStageEye);
    const {fader,step}=scene();
    fader.stage.room={x0:-6,x1:6,z0:-7,z1:7};step(2);
    expect(U.uStageRoom.value.toArray()).toEqual([-6,-7,6,7]);
    fader.stage.room=undefined;step(2);
    expect(U.uStageRoom.value.x,'none: an empty box').toBeGreaterThan(U.uStageRoom.value.z);
    material.dispose();
  });

  it('is off when the camera resets, and never moves the lens',()=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
    follow.mode='lockon';
    const me=actor('me'),foe=actor('foe',.6,5);
    follow.director.crowd=new Map([['me',me],['foe',foe]]);
    let input=0;
    for(let i=0;i<60;i++){follow.update(1/60,me,input,0,[],0,foe,true);input=follow.inputYaw;}
    expect(U.uStageOn.value).toBe(1);
    const position=camera.position.clone(),quaternion=camera.quaternion.clone();
    for(let i=0;i<30;i++)follow.fader.update(1/60,camera,follow.director.crowd,me,foe,[]);
    expect(camera.position.equals(position)).toBe(true);expect(camera.quaternion.equals(quaternion)).toBe(true);
    follow.reset();
    expect(U.uStageOn.value).toBe(0);expect(U.uStageDepthA.value.z).toBe(0);expect(U.uStageDepthB.value.z).toBe(0);
  });
});
