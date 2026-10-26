import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera} from '../src/render/FollowCamera';
import {OcclusionFader,installOcclusionFade,isOcclusionTwin,occlusionTwins} from '../src/render/OcclusionFade';
import type {Fighter} from '../src/render/Fighter';
import type {PlayerState} from '../src/game/types';


const state=(id:string,x=0,z=0):PlayerState=>({id,name:id,fighter:'zoro',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
const actor=(id:string,x=0,z=0)=>{
  const group=new THREE.Group();group.position.set(x,0,z);
  group.add(new THREE.Mesh(new THREE.BoxGeometry(.5,1.8,.3),new THREE.MeshToonMaterial()));
  group.add(new THREE.Mesh(new THREE.BoxGeometry(.5,1.8,.3),new THREE.ShaderMaterial()));
  const body={state:state(id,x,z),group,velocity:new THREE.Vector3()} as unknown as Fighter;
  installOcclusionFade(body);return body;
};
const fadeOf=(body:Fighter)=>{
  const material=occlusionTwins(body)[0].twin;
  const shader={uniforms:{} as Record<string,{value:unknown}>,vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'} as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  return (shader.uniforms.uOccFade.value as THREE.Vector2).clone();
};
const drawn=(body:Fighter)=>(body.group.children[0] as THREE.Mesh).material as THREE.Material;

function scene(){
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),fader=new OcclusionFader();
  camera.position.set(.8,1.6,-3.2);camera.lookAt(.3,1.1,5);camera.updateMatrixWorld();
  const me=actor('me'),foe=actor('foe',.3,6),by=actor('by',.4,3),crowd=new Map([['me',me],['foe',foe],['by',by]]);
  const step=(frames=1)=>{for(let i=0;i<frames;i++)fader.update(1/60,camera,crowd,me,foe,[]);};
  return {camera,fader,me,foe,by,step};
}

describe('occlusion fading',()=>{
  it('gives every built-in material a fighter draws with a dithered twin, and leaves custom shaders alone',()=>{
    const body=actor('a');
    const [toon,custom]=body.group.children.map(c=>(c as THREE.Mesh).material as THREE.Material);
    const made=occlusionTwins(body);
    expect(made.length).toBe(1);
    expect(made[0].original).toBe(toon);
    expect(isOcclusionTwin(made[0].twin)).toBe(true);
    expect(made.some(t=>t.original===custom)).toBe(false);
    expect(toon.customProgramCacheKey()).not.toContain('occlusion');
    expect(made[0].twin.customProgramCacheKey()).toContain('occlusion-fade');
    const shader={uniforms:{},vertexShader:'void main(){\n#include <project_vertex>\n}',fragmentShader:'void main(){\n#include <clipping_planes_fragment>\n}'} as unknown as THREE.WebGLProgramParametersWithUniforms;
    made[0].twin.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain('vOccWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    expect(shader.fragmentShader).toContain('if ( occlusionDropped() ) discard;');
    installOcclusionFade(body);
    expect(occlusionTwins(body).length).toBe(1);
  });

  it('gives a warm-up fighter hidden proxies drawn with the twins, so the load-time compile links them',()=>{
    const warm=actor('warm-zoro');
    const proxies:THREE.Mesh[]=[];warm.group.traverse(o=>{if(o.name.endsWith('-occlusion-warm'))proxies.push(o as THREE.Mesh);});
    expect(proxies.length).toBe(1);
    expect(proxies[0].visible).toBe(false);
    expect(isOcclusionTwin(proxies[0].material as THREE.Material)).toBe(true);
    const real=actor('zoro-1');let none=0;real.group.traverse(o=>{if(o.name.endsWith('-occlusion-warm'))none++;});
    expect(none).toBe(0);
  });

  it('fades a bystander standing between the lens and the target, and eases them back once they step away',()=>{
    const {me,foe,by,step}=scene();
    expect(isOcclusionTwin(drawn(by)),'drawn with its own materials until it has to fade').toBe(false);
    step(90);
    expect(fadeOf(by).x,'the bystander in the way').toBeGreaterThan(.75);
    expect(isOcclusionTwin(drawn(by)),'and with its twins while it does').toBe(true);
    expect(fadeOf(foe).x,'never the target').toBe(0);
    expect(isOcclusionTwin(drawn(foe))).toBe(false);
    expect(fadeOf(me).x,'never the player').toBe(0);
    by.group.position.set(-6,0,-3);
    step(1);
    const after=fadeOf(by).x;
    expect(after).toBeGreaterThan(.6);
    step(120);
    expect(fadeOf(by).x).toBe(0);
    expect(isOcclusionTwin(drawn(by)),'its own materials back').toBe(false);
  });

  it('fades by frames, never a pop: no step bigger than a sixth of the range',()=>{
    const {by,step}=scene();
    let last=fadeOf(by).x,worst=0;
    for(let i=0;i<120;i++){step(1);const now=fadeOf(by).x;worst=Math.max(worst,Math.abs(now-last));last=now;}
    expect(worst).toBeLessThan(.17);
  });

  it('thins the player\'s own body only where it passes in front of the target',()=>{
    const {me,step}=scene();
    step(30);
    expect(fadeOf(me).y,'beside the target on screen: no window').toBe(0);
    expect(isOcclusionTwin(drawn(me))).toBe(false);
    me.group.position.set(.6,0,0);
    step(30);
    expect(fadeOf(me).y,'a window over the target').toBeGreaterThan(.5);
    expect(fadeOf(me).x,'never the whole body').toBe(0);
    expect(isOcclusionTwin(drawn(me))).toBe(true);
  });

  it('never moves the lens: the fade only changes what is drawn',()=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
    follow.mode='lockon';
    const me=actor('me'),foe=actor('foe',.6,5),by=actor('by',.3,2.5);
    follow.director.crowd=new Map([['me',me],['foe',foe],['by',by]]);
    let input=0;
    for(let i=0;i<60;i++){follow.update(1/60,me,input,0,[],0,foe,true);input=follow.inputYaw;}
    const position=camera.position.clone(),quaternion=camera.quaternion.clone(),fov=camera.fov;
    for(let i=0;i<30;i++)follow.fader.update(1/60,camera,follow.director.crowd,me,foe,[by]);
    expect(camera.position.equals(position)).toBe(true);expect(camera.quaternion.equals(quaternion)).toBe(true);expect(camera.fov).toBe(fov);
  });

  it('fades nobody without a crowd to judge',()=>{
    const fader=new OcclusionFader(),camera=new THREE.PerspectiveCamera(50,16/9,.1,200);
    const me=actor('m'),by=actor('b',0,-2);
    camera.position.set(0,1.5,-4);camera.lookAt(0,1,0);camera.updateMatrixWorld();
    for(let i=0;i<30;i++)fader.update(1/60,camera,undefined,me,undefined,[]);
    expect(fadeOf(by).x).toBe(0);expect(fader.state.faded).toBe(0);
  });
});

describe('Law\'s awakened ROOM round the lens',()=>{
  it('keeps the dome\'s faces toward the lens clear: part of the way from outside, most of it from inside',()=>{
    const group=new THREE.Group(),room=new THREE.Mesh(new THREE.SphereGeometry(1.2,16,12),new THREE.MeshToonMaterial({transparent:true,opacity:.4,side:THREE.DoubleSide}));
    room.name='awaken-on-0';room.position.y=1.2;group.add(room);
    const law={state:{...state('law'),fighter:'law'},group,velocity:new THREE.Vector3()} as unknown as Fighter;
    installOcclusionFade(law);group.updateMatrixWorld(true);
    const material=room.material as THREE.Material;
    expect(material.customProgramCacheKey()).toContain('occlusion-room');
    expect(occlusionTwins(law).length,'a translucent shell has no dithered twin').toBe(0);
    const inside=()=>{const shader={uniforms:{} as Record<string,{value:number}>,vertexShader:'',fragmentShader:'#include <opaque_fragment>'} as unknown as THREE.WebGLProgramParametersWithUniforms;material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);return (shader.uniforms.uOccInside as {value:number}).value;};
    const fader=new OcclusionFader(),camera=new THREE.PerspectiveCamera(50,16/9,.1,200),crowd=new Map([['law',law]]);
    camera.position.set(0,1.6,-4);camera.lookAt(0,1.2,0);
    for(let i=0;i<90;i++)fader.update(1/60,camera,crowd,law,undefined,[]);
    expect(inside()).toBeGreaterThan(.55);expect(inside()).toBeLessThan(.65);
    camera.position.set(.2,1.3,-.3);camera.lookAt(0,1.2,3);
    for(let i=0;i<90;i++)fader.update(1/60,camera,crowd,law,undefined,[]);
    expect(inside()).toBeGreaterThan(.95);
    room.visible=false;
    for(let i=0;i<120;i++)fader.update(1/60,camera,crowd,law,undefined,[]);
    expect(inside()).toBe(0);
  });
});

describe('the lock-on rig sized by the body as drawn',()=>{
  const form=(behind:number,fighter:'luffy'|'naruto'='luffy')=>{
    const group=new THREE.Group(),geometry=new THREE.BoxGeometry(2,3,behind+1);geometry.translate(0,1.5,.5-behind/2);
    const count=geometry.getAttribute('position').count,weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const bone=new THREE.Bone(),mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshToonMaterial());mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));group.add(mesh);
    const model=new THREE.Group();model.visible=false;group.add(model);
    return {state:{...state('me'),fighter,awakened:true},group,model,velocity:new THREE.Vector3()} as unknown as Fighter;
  };
  const settle=(self:Fighter)=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),foe=actor('foe',0,7);
    follow.mode='lockon';let input=0;
    for(let i=0;i<240;i++){self.group.updateMatrixWorld(true);follow.update(1/60,self,input,0,[],0,foe,true);input=follow.inputYaw;}
    return camera.position.clone();
  };
  it('stands back and up over a form that reaches far behind its root, and not over one that does not',()=>{
    const long=settle(form(8.5)),short=settle(form(.4));
    expect(-long.z,'metres behind the root').toBeGreaterThan(-short.z+.6);
    expect(-long.z,'but not behind all of it').toBeLessThan(-short.z+1.5);
    expect(long.y,'up to look over it').toBeGreaterThan(short.y+.3);
  });
});

describe('Kurama\'s lock-on',()=>{
  const fox=()=>{
    const group=new THREE.Group(),geometry=new THREE.BoxGeometry(2,2.2,9);geometry.translate(0,1.1,-3.2);
    const count=geometry.getAttribute('position').count,weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const bone=new THREE.Bone(),mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshToonMaterial());mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));group.add(mesh);
    const model=new THREE.Group();model.visible=false;group.add(model);
    return {state:{...state('me'),fighter:'naruto',awakened:true},group,model,velocity:new THREE.Vector3()} as unknown as Fighter;
  };
  const settle=(self:Fighter,frames=240)=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),foe=actor('foe',0,4);
    follow.mode='lockon';let input=0;
    for(let i=0;i<frames;i++){self.group.updateMatrixWorld(true);follow.update(1/60,self,input,0,[],0,foe,true);input=follow.inputYaw;}
    camera.updateMatrixWorld();
    return {camera,foe};
  };
  it('films the fox from the height of its back, out past its flank, with the opponent right of centre',()=>{
    const {camera,foe}=settle(fox());
    expect(camera.position.y,'down at its back, not over its haunches').toBeLessThan(2.8);
    expect(camera.position.y).toBeGreaterThan(1.4);
    expect(Math.abs(camera.position.x),'past its flank').toBeGreaterThan(1.8);
    const feet=new THREE.Vector3(0,0,4).project(camera),crown=new THREE.Vector3(0,1.8,4).project(camera);
    expect(feet.x).toBeGreaterThan(0);expect(feet.x).toBeLessThan(.7);
    expect(feet.y).toBeGreaterThan(-.8);expect(crown.y).toBeLessThan(.62);
    const head=new THREE.Vector3(0,.55,1.5).project(camera);
    expect(Math.abs(head.x)).toBeLessThan(1);expect(Math.abs(head.y)).toBeLessThan(1);expect(head.x).toBeLessThan(feet.x);
    void foe;
  });
  it('eases in and out with the form, never a cut',()=>{
    const self=fox(),camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),foe=actor('foe',0,4);
    follow.mode='lockon';let input=0;const last=new THREE.Vector3(),aim=new THREE.Vector3(),lastAim=new THREE.Vector3();let worst=0,turn=0,heading=0;
    const model=(self as unknown as {model:THREE.Object3D}).model;
    for(let i=0;i<360;i++){
      model.visible=!(i>=90&&i<210);self.state.awakened=i>=90&&i<210;
      self.group.updateMatrixWorld(true);follow.update(1/60,self,input,0,[],0,foe,true);
      if(i>0){worst=Math.max(worst,camera.position.distanceTo(last));heading=Math.max(heading,Math.abs(Math.atan2(Math.sin(follow.inputYaw-input),Math.cos(follow.inputYaw-input)))*60*180/Math.PI);}
      input=follow.inputYaw;
      camera.getWorldDirection(aim);if(i>0)turn=Math.max(turn,aim.angleTo(lastAim)*60*180/Math.PI);lastAim.copy(aim);
      last.copy(camera.position);
    }
    expect(worst,'metres in one frame').toBeLessThan(.35);
    expect(heading,'the heading, deg/s').toBeLessThanOrEqual(151);
    expect(turn,'the aim, deg/s').toBeLessThan(200);
  });
});


describe('moderate-overlap manual duel window',()=>{
  it('preserves the local silhouette at moderate coverage without changing crowd or body fade',()=>{
    const {fader,me,foe,by,step}=scene();me.group.position.x=.6;
    fader.selfCover=.357;fader.closeManual=1;step(90);
    expect(fadeOf(me).y).toBeCloseTo(.15,5);expect(fadeOf(me).x).toBe(0);
    expect(fadeOf(by).x).toBeGreaterThan(.75);expect(fadeOf(foe).x).toBe(0);
    fader.closeManual=0;step(90);
    expect(fadeOf(me).y).toBeGreaterThan(.7);
  });
  it('smoothly restores the original strong window for a genuinely hidden target',()=>{
    const {fader,me,step}=scene();me.group.position.x=.6;fader.closeManual=1;
    const values:number[]=[];
    for(const coverage of [.45,.46,.50,.55,.60,.64,.65,.85]){
      fader.selfCover=coverage;step(90);values.push(fadeOf(me).y);
    }
    expect(values[0]).toBeCloseTo(.15,5);expect(values.at(-1)).toBeCloseTo(.8,5);
    for(let i=1;i<values.length;i++)expect(values[i]).toBeGreaterThanOrEqual(values[i-1]);
    expect(values[1]-values[0]).toBeLessThan(.01);
    expect(values[6]-values[5]).toBeLessThan(.01);
    expect(values[3]).toBeCloseTo(.475,4);
  });
  it('fades the scope out without a threshold jump at close-range exit',()=>{
    const {fader,me,step}=scene();me.group.position.x=.6;fader.selfCover=.4;
    fader.closeManual=1;step(90);expect(fadeOf(me).y).toBeCloseTo(.15,5);
    fader.closeManual=.5;step(90);expect(fadeOf(me).y).toBeCloseTo(.475,5);
    fader.closeManual=0;step(90);expect(fadeOf(me).y).toBeCloseTo(.8,5);
  });
  it('does not cap an authored victim window even if an old scope value is supplied',()=>{
    const {fader,me,foe,step}=scene();me.group.position.x=.6;
    fader.selfCover=.3;fader.closeManual=1;fader.shotVictim=foe;fader.shotHidden=true;step(90);
    expect(fadeOf(me).y).toBeCloseTo(.72,5);
  });
  it('keeps near-lens shader clearance independent of the limited window',()=>{
    const {camera,fader,me,step}=scene();me.group.position.x=.6;fader.selfCover=.3;fader.closeManual=1;
    camera.position.set(.6,1.5,-.3);camera.lookAt(.3,1.1,5);step(90);
    const row=occlusionTwins(me)[0],shader={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <clipping_planes_fragment>'} as unknown as THREE.WebGLProgramParametersWithUniforms;
    row.twin.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
    expect(isOcclusionTwin(drawn(me))).toBe(true);
    expect((shader.uniforms.uOccNear.value as THREE.Vector2).toArray()).toEqual([.3,.75]);
    expect(shader.fragmentShader).toContain('1.0 - smoothstep( uOccNear.x, uOccNear.y, distance( vOccWorld, uOccEye ) )');
    expect(fadeOf(me).x).toBe(0);expect(fadeOf(me).y).toBeLessThanOrEqual(.15);
  });
});
