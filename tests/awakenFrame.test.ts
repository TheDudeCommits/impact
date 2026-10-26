import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera} from '../src/render/FollowCamera';
import {aimAt} from '../src/render/CameraDirector';
import {setLoomTop,clearLoomTops} from '../src/render/loomRegistry';
import {AWAKENING_ENTRY,AWAKENING_SWAP} from '../src/game/awakening';
import type {Fighter} from '../src/render/Fighter';
import type {PlayerState} from '../src/game/types';


const state=(id:string,x=0,z=0):PlayerState=>({id,name:id,fighter:'zoro',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:100,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
type Body=Fighter&{head:THREE.Bone;skin:THREE.Bone;form?:THREE.Group;formHead?:THREE.Bone};
function slab(height:number,parent:THREE.Object3D){
  const geometry=new THREE.BoxGeometry(.5,1,.35);geometry.translate(0,.5,0);
  const n=geometry.attributes.position.count,weights=new Float32Array(n*4);for(let i=0;i<n;i++)weights[i*4]=1;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(n*4),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const bone=new THREE.Bone();parent.add(bone);
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());parent.add(mesh);
  parent.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton([bone]));bone.scale.y=height;
  return bone;
}
function body(id:string,x=0,z=0,headAt=1.5,formHead?:number):Body{
  const group=new THREE.Group();group.position.set(x,0,z);group.name=`fighter-${id}`;
  const model=new THREE.Group();group.add(model);
  const head=new THREE.Bone();head.name='Head';head.position.set(0,headAt,0);model.add(head);
  const out={state:state(id,x,z),group,model,joints:new Map([['Head',head]]),velocity:new THREE.Vector3(),head,skin:slab(headAt+.24,model)} as unknown as Body;
  if(formHead!==undefined){
    const form=new THREE.Group();form.visible=false;group.add(form);
    const top=new THREE.Bone();top.name='Head';top.position.set(0,formHead,0);form.add(top);slab(formHead+.24,form);
    out.form=form;out.formHead=top;
  }
  group.updateMatrixWorld(true);
  return out;
}
const HUD=[[-1,.63,1,1],[.065,-1,1,-.435],[-1,-1,-.09,-.79]];
const safe=(p:THREE.Vector3)=>p.z<1&&Math.abs(p.x)<=.95&&Math.abs(p.y)<=.95&&!HUD.some(b=>p.x>=b[0]&&p.x<=b[2]&&p.y>=b[1]&&p.y<=b[3]);
type Frame={head:THREE.Vector3;body:THREE.Vector3;crown:THREE.Vector3;weight:number;fov:number;eye:THREE.Vector3;movementYaw:number;watched:THREE.Vector3[]};
function run({cinematics=true,mode='lockon' as 'lockon'|'free',frames=150,at=30,me=body('me'),occluders=[] as THREE.Object3D[],pose=(_i:number,_me:Body)=>{},watch=[] as THREE.Vector3[]}={}){
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
  follow.mode=mode;follow.cinematics=cinematics;
  const foe=body('foe',.6,3.2),map=new Map<string,Fighter>([['me',me],['foe',foe]]);follow.director.crowd=map;
  const out:Frame[]=[];let input=0;
  for(let i=0;i<frames;i++){
    const s=me.state,el=(i-at)/60;
    if(i<at||el>=AWAKENING_ENTRY){s.action='idle';if(i>=at)s.awakened=true;}
    else{s.action='awaken';s.actionStarted=7;s.actionDuration=AWAKENING_ENTRY;s.actionTime=el/AWAKENING_ENTRY;s.awakened=true;}
    const u=i<at?0:Math.min(1,el/AWAKENING_SWAP),burst=el-AWAKENING_SWAP;
    me.head.position.y=1.5-.34*Math.sin(Math.PI/2*u)+(burst>0?.3*THREE.MathUtils.smootherstep(burst,0,.2)*Math.exp(-Math.max(0,burst-.2)/.2):0);
    me.skin.scale.y=me.head.position.y+.24;
    pose(i,me);me.group.updateMatrixWorld(true);
    follow.director.handle([],'me',id=>map.get(id));
    follow.update(1/60,me,input,0,occluders,0,foe,true);input=follow.inputYaw;camera.updateMatrixWorld();
    const shown=me.form?.visible&&me.formHead?me.formHead:me.head;
    const head=shown.getWorldPosition(new THREE.Vector3());
    out.push({head:head.clone().project(camera),crown:head.clone().setY(head.y+.24).project(camera),body:me.group.position.clone().setY(1).project(camera),
      weight:follow.director.weight,fov:camera.fov,eye:camera.position.clone(),movementYaw:follow.movementYaw,watched:watch.map(w=>w.clone().add(me.group.position).project(camera))});
  }
  return out;
}
const jump=(frames:Frame[])=>{let most=0;for(let i=1;i<frames.length;i++)most=Math.max(most,Math.hypot(frames[i].head.x-frames[i-1].head.x,frames[i].head.y-frames[i-1].head.y));return most;};

describe('CAM5: the awakening framed on the head',()=>{
  it('aims a lens to put a point exactly where it is asked on the screen',()=>{
    const camera=new THREE.PerspectiveCamera(47,16/9,.1,100),look=new THREE.Vector3(),rng=(a:number,b:number)=>a+Math.random()*(b-a);
    for(let k=0;k<200;k++){
      const eye=new THREE.Vector3(rng(-5,5),rng(.3,3),rng(-5,5)),point=new THREE.Vector3(rng(-5,5),rng(0,3),rng(-5,5));
      if(eye.distanceTo(point)<1||Math.abs(point.y-eye.y)>.57*eye.distanceTo(point))continue;
      const x=rng(-.8,.8),y=rng(-.7,.7),tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2);
      aimAt(eye,point,x,y,tanV,tanV*camera.aspect,look);
      camera.position.copy(eye);camera.lookAt(look);camera.updateMatrixWorld();camera.updateProjectionMatrix();
      const p=point.clone().project(camera);
      expect(p.x).toBeCloseTo(x,6);expect(p.y).toBeCloseTo(y,6);
    }
  });

  it('holds the head and the body inside the safe box, and never jumps them',()=>{
    for(const mode of ['lockon','free'] as const){
      const frames=run({mode}),plain=run({mode,cinematics:false});
      const shot=frames.filter(f=>f.weight>0);
      expect(shot.length/60,`${mode}: the entry and the hand-back`).toBeGreaterThan(1.2);
      for(const [i,f] of frames.entries()){
        expect(safe(f.head),`${mode} frame ${i}: head ${f.head.x.toFixed(2)},${f.head.y.toFixed(2)}`).toBe(true);
        expect(safe(f.body),`${mode} frame ${i}: body ${f.body.x.toFixed(2)},${f.body.y.toFixed(2)}`).toBe(true);
        expect(f.crown.y,`${mode} frame ${i}: the crown under the bars`).toBeLessThan(.63);
        expect(f.movementYaw).toBe(plain[i].movementYaw);
      }
      expect(jump(frames),`${mode}: the head's largest move in a frame`).toBeLessThan(.05);
      for(const f of frames.filter(f=>f.weight===1)){expect(Math.abs(f.head.x+.15)).toBeLessThan(.08);expect(Math.abs(f.head.y-.2)).toBeLessThan(.18);}
    }
  });

  it('keeps MODELS2\'s beat: zoomed in through the gather, thrown wide on the burst, handed back after',()=>{
    const frames=run(),swap=30+Math.round(AWAKENING_SWAP*60);
    expect(frames[swap-2].fov).toBeLessThan(frames[29].fov-6);
    expect(Math.max(...frames.slice(swap,swap+8).map(f=>f.fov))).toBeGreaterThan(frames[swap-2].fov+6);
    expect(frames[30+Math.round((AWAKENING_ENTRY+.62)*60)].weight).toBe(0);
    for(let i=swap;i<swap+10;i++)expect(Math.abs(frames[i].fov-frames[i-1].fov),`frame ${i}`).toBeLessThan(5.5);
  });

  it('carries on through the predicted entry dropping out for a few frames, with one blend and one kick',()=>{
    const pose=(i:number,me:Body)=>{if(i>=34&&i<40){me.state.action='idle';me.state.actionStarted=5.5;}};
    const frames=run({pose}),clean=run();
    for(let i=31;i<30+Math.round(AWAKENING_ENTRY*60);i++)expect(frames[i].weight,`frame ${i}`).toBeGreaterThanOrEqual(frames[i-1].weight-1e-9);
    const kicks=frames.slice(31).filter((f,i)=>f.fov-frames[30+i].fov>1.2).length;
    expect(kicks,'one kick, rising over a few frames').toBeLessThanOrEqual(6);
    expect(jump(frames)).toBeLessThan(.05);
    const refused=run({pose:(i,me)=>{if(i>=34){me.state.action='idle';me.state.actionStarted=5.5;}}});
    expect(refused[34+Math.round(.25*60)+30].weight).toBeLessThan(refused[34+Math.round(.25*60)].weight);
    expect(Math.max(...clean.map(f=>f.weight))).toBe(1);
  });

  it('frames a form standing in for the body by its own head, crown under the bars',()=>{
    const me=body('me',0,0,1.5,1.62),swap=30+Math.round(AWAKENING_SWAP*60);me.state.fighter='luffy';
    const pose=(i:number,m:Body)=>{const on=i>=swap;(m.model as THREE.Object3D).visible=!on;m.form!.visible=on;};
    const frames=run({me,pose});
    for(const [i,f] of frames.entries()){
      expect(safe(f.head),`frame ${i}: head ${f.head.x.toFixed(2)},${f.head.y.toFixed(2)}`).toBe(true);
      if(f.weight===1)expect(f.crown.y,`frame ${i}`).toBeLessThan(.63);
    }
    expect(jump(frames.slice(0,swap))).toBeLessThan(.055);
    expect(jump(frames.slice(swap))).toBeLessThan(.05);
  });

  it('holds a looming Stand\'s crown in the frame with its user',()=>{
    setLoomTop('me',2.3);
    try{
      const frames=run({pose:(_i,m)=>{m.state.fighter='jotaro';},watch:[new THREE.Vector3(0,2.75,0)]});
      for(const [i,f] of frames.entries()){
        expect(f.watched[0].y,`frame ${i}: the Stand's crown under the bars`).toBeLessThan(.63);
        expect(safe(f.head),`frame ${i}`).toBe(true);
      }
    }finally{clearLoomTops();}
  });

  it('frames the head from a clear bearing beside a wall (training\'s reset)',()=>{
    const material=new THREE.MeshBasicMaterial(),wall=new THREE.Mesh(new THREE.BoxGeometry(24,14,1),material);
    wall.position.set(0,7,-1);wall.updateMatrixWorld(true);
    const frames=run({occluders:[wall]});
    for(const [i,f] of frames.entries())expect(safe(f.head),`frame ${i}: head ${f.head.x.toFixed(2)},${f.head.y.toFixed(2)}`).toBe(true);
    expect(jump(frames)).toBeLessThan(.06);
    material.dispose();wall.geometry.dispose();
  });

  it('does nothing at all with cinematics off',()=>{
    const off=run({cinematics:false,mode:'free'});
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),bare=new FollowCamera(camera),me=body('me'),foe=body('foe',.6,3.2);
    for(let i=0;i<off.length;i++){
      const s=me.state,el=(i-30)/60;
      if(i<30||el>=AWAKENING_ENTRY)s.action='idle';else{s.action='awaken';s.actionStarted=7;s.actionDuration=AWAKENING_ENTRY;s.actionTime=el/AWAKENING_ENTRY;}
      bare.update(1/60,me,0,0,[],0,foe,true);
      expect(off[i].eye.toArray()).toEqual(camera.position.toArray());
    }
  });
});
