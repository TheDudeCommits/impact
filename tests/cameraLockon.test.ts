import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera,framingHeading} from '../src/render/FollowCamera';
import {setCameraCutaway,resetCameraCutaway} from '../src/render/CameraCutaway';
import type {Fighter} from '../src/render/Fighter';
import type {PlayerState} from '../src/game/types';


const state=(id:string,x=0,z=0):PlayerState=>({id,name:id,fighter:'zoro',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
const actor=(id:string,x=0,z=0)=>{const group=new THREE.Group();group.position.set(x,0,z);
  return {state:state(id,x,z),group,velocity:new THREE.Vector3()} as unknown as Fighter;};
const wrapped=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const DEG=180/Math.PI;

class Rig{
  camera=new THREE.PerspectiveCamera(50,16/9,.1,200);
  follow=new FollowCamera(this.camera);
  me=actor('me');foe=actor('foe',0,4);
  input=0;
  constructor(mode:'free'|'lockon'='lockon'){this.follow.mode=mode;}
  step(dt=1/60,turn=0,locked=false,foe:Fighter|undefined=this.foe){
    this.input+=turn;this.follow.update(dt,this.me,this.input,0,[],0,foe,locked);this.input=this.follow.inputYaw;
    this.camera.updateMatrixWorld();
  }
  ndc(body:Fighter,up=1){return body.group.position.clone().setY(body.group.position.y+up).project(this.camera);}
  aim(){return this.camera.getWorldDirection(new THREE.Vector3());}
}

const UP=new THREE.Vector3(0,1,0);
const blend=(rate:number,dt:number)=>1-Math.exp(-rate*dt);
class LegacyFollowCamera {
  yaw=Math.PI;
  movementYaw=Math.PI;
  private initialized=false;
  private subject='';
  private anchor=new THREE.Vector3();
  private focus=new THREE.Vector3();
  private desired=new THREE.Vector3();
  private right=new THREE.Vector3();
  private forward=new THREE.Vector3();
  private probe=new THREE.Vector3();
  private boom=4.5;
  private lift=1.65;
  private shoulder=1.15;
  private focusHeight=1.05;
  private trauma=0;
  private age=0;
  constructor(readonly camera:THREE.PerspectiveCamera){}
  reset(){resetCameraCutaway();this.initialized=false;this.subject='';this.trauma=0;this.boom=4.5;this.lift=1.65;this.shoulder=1.15;this.focusHeight=1.05;}
  impact(weight:number,_direction?:THREE.Vector3){this.trauma=Math.min(.8,Math.max(this.trauma,weight));}
  holdFor(weight=0){this.trauma=Math.max(this.trauma,Math.min(.25,weight*.2));}
  intro(_seconds:number){}
  cut(){this.initialized=false;}
  victory(_winner:Fighter,_seconds:number){}

  update(dt:number,self:Fighter,yaw:number,pitch:number,_occluders:THREE.Object3D[],shake:number,_opponent?:Fighter,_locked=false){
    dt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.25);
    const position=self.group.position;
    const placed=!this.initialized||self.state.id!==this.subject||this.anchor.distanceToSquared(position)>100;
    if(placed){this.yaw=yaw;this.anchor.copy(position);}
    else{
      this.yaw+=wrapped(yaw-this.yaw)*blend(32,dt);
      this.anchor.x=position.x;this.anchor.z=position.z;
      this.anchor.y=THREE.MathUtils.lerp(this.anchor.y,position.y,blend(24,dt));
    }
    this.subject=self.state.id;
    const awakened=!!self.state.awakened;
    const fox=awakened&&self.state.fighter==='naruto';
    const large=awakened&&['sasuke','kakashi'].includes(self.state.fighter);
    const size=fox?{boom:8,lift:3.3,shoulder:2.2,focus:1.3}:large?{boom:7.5,lift:3,shoulder:1.7,focus:1.7}:{boom:4.5,lift:1.65,shoulder:1.15,focus:1.05};
    const alpha=placed?1:blend(7,dt);
    this.boom=THREE.MathUtils.lerp(this.boom,size.boom,alpha);
    this.lift=THREE.MathUtils.lerp(this.lift,size.lift,alpha);
    this.shoulder=THREE.MathUtils.lerp(this.shoulder,size.shoulder,alpha);
    this.focusHeight=THREE.MathUtils.lerp(this.focusHeight,size.focus,alpha);
    this.forward.set(Math.sin(this.yaw),0,Math.cos(this.yaw));
    this.right.set(-Math.cos(this.yaw),0,Math.sin(this.yaw));
    this.focus.copy(this.anchor).addScaledVector(UP,this.focusHeight);
    this.desired.copy(this.focus).addScaledVector(this.forward,-this.boom*Math.cos(pitch))
      .addScaledVector(this.right,this.shoulder).addScaledVector(UP,this.lift+Math.sin(pitch)*this.boom);
    this.camera.position.copy(this.desired);
    setCameraCutaway(this.camera.position,this.focus,position.y,fox?3.8:large?2.7:1.35);
    this.probe.copy(this.focus).addScaledVector(this.right,this.shoulder*.25);
    this.movementYaw=Math.atan2(this.probe.x-this.camera.position.x,this.probe.z-this.camera.position.z);
    this.camera.lookAt(this.probe);
    this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,50,placed?1:blend(10,dt));
    this.camera.updateProjectionMatrix();
    this.age+=dt;this.trauma=Math.max(0,this.trauma-dt*3);
    const amount=this.trauma*this.trauma*shake*.025;
    if(amount>1e-5){this.camera.rotateX(Math.sin(this.age*31)*amount);this.camera.rotateZ(Math.sin(this.age*27)*amount*.5);}
    this.camera.updateMatrixWorld();this.initialized=true;
  }
}

describe('free mode is the approved orbit, unchanged',()=>{
  it('matches the pre-overhaul camera bit for bit through travel, turning, pitch, forms and targets',()=>{
    const legacyCamera=new THREE.PerspectiveCamera(50,16/9,.1,200),legacy=new LegacyFollowCamera(legacyCamera);
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
    expect(follow.mode).toBe('free');
    const me=actor('me'),foe=actor('foe',1,4),other=actor('other',-6,-2);
    let yaw=Math.PI,pitch=.02;
    for(let i=0;i<900;i++){
      const t=i/60;
      me.group.position.set(Math.sin(t*.9)*4,Math.max(0,Math.sin(t*2.1))*.8,Math.cos(t*.7)*5);
      foe.group.position.set(1+Math.sin(t*1.3)*3,0,4+Math.cos(t)*2);
      me.state.awakened=i>400&&i<600;me.state.fighter=i<500?'naruto':'luffy';
      yaw+=Math.sin(t*1.7)*.03;pitch=THREE.MathUtils.clamp(pitch+Math.cos(t*1.1)*.004,-.28,.72);
      const dt=i%97===0?.21:i%13===0?1/30:1/60;
      const opponent=i%200<100?foe:other,locked=i%300>150;
      if(i===700)legacy.cut(),follow.cut();
      legacy.update(dt,me,yaw,pitch,[],.5,opponent,locked);follow.update(dt,me,yaw,pitch,[],.5,opponent,locked);
      expect(camera.position.toArray()).toEqual(legacyCamera.position.toArray());
      expect(camera.quaternion.toArray()).toEqual(legacyCamera.quaternion.toArray());
      expect(camera.fov).toBe(legacyCamera.fov);
      expect(follow.movementYaw).toBe(legacy.movementYaw);
      expect(follow.yaw).toBe(legacy.yaw);
      expect(follow.inputYaw).toBe(yaw);
    }
  });
});

describe('lock-on framing',()=>{
  it.each([[3,0],[6,1.2],[12,-2.4],[20,2.9]])('holds an opponent %f m off right of centre, the player on the left third',(distance,bearing)=>{
    const rig=new Rig();
    rig.foe.group.position.set(Math.sin(bearing)*distance,0,Math.cos(bearing)*distance);
    for(let i=0;i<240;i++)rig.step(1/60,0,distance>14);
    const foe=rig.ndc(rig.foe),me=rig.ndc(rig.me);
    expect(foe.x,`opponent at ${foe.x.toFixed(2)}`).toBeGreaterThan(.02);
    expect(foe.x,`opponent at ${foe.x.toFixed(2)}`).toBeLessThan(.25);
    expect(me.x,`player at ${me.x.toFixed(2)}`).toBeGreaterThan(-.45);
    expect(me.x,`player at ${me.x.toFixed(2)}`).toBeLessThan(-.2);
    for(const body of [rig.me,rig.foe])for(const up of [.05,1.75]){const p=rig.ndc(body,up);expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);}
  });

  it('solves the heading from the rig itself',()=>{
    expect(framingHeading(0,1e6,1.05,3.1)).toBeCloseTo(.1,4);
    expect(framingHeading(0,.5,1.05,3.1)).toBeCloseTo(.8,6);
    expect(framingHeading(0,.5,1.05,3.1,1)).toBeCloseTo(1,6);
    expect(framingHeading(1,8,1.05,3.1)-1).toBeGreaterThan(framingHeading(1,16,1.05,3.1)-1);
    for(const d of [3,4,5]){const off=framingHeading(0,d,1.05,3.1)*DEG;expect(off).toBeGreaterThan(20);expect(off).toBeLessThan(35);}
  });

  it('lets the player turn at once, holds their view for a second, then eases back',()=>{
    const rig=new Rig();
    for(let i=0;i<240;i++)rig.step();
    const framed=rig.follow.inputYaw;
    for(let i=0;i<18;i++){const before=rig.follow.inputYaw;rig.step(1/60,.05);expect(rig.follow.inputYaw-before).toBeCloseTo(.05,9);}
    const left=rig.follow.inputYaw;
    expect(wrapped(left-framed)).toBeCloseTo(.9,6);
    for(let i=0;i<58;i++){rig.step();expect(Math.abs(wrapped(rig.follow.inputYaw-left))).toBeLessThan(1e-9);}
    let previous=rig.follow.inputYaw,speed=0,worstSpeed=0,worstAccel=0;
    for(let i=0;i<300;i++){
      rig.step();const now=rig.follow.inputYaw,v=wrapped(now-previous)*60;
      worstSpeed=Math.max(worstSpeed,Math.abs(v));worstAccel=Math.max(worstAccel,Math.abs(v-speed)*60);speed=v;previous=now;
    }
    expect(worstSpeed).toBeLessThanOrEqual(2.6+1e-9);
    expect(worstAccel).toBeLessThanOrEqual(9+1e-6);
    expect(Math.abs(wrapped(rig.follow.inputYaw-framed))*DEG,'back on the framing').toBeLessThan(.5);
  });

  it('swings to a new target within its limits, without overshoot, and never cuts',()=>{
    const rig=new Rig(),behind=actor('behind',-3,-5);
    for(let i=0;i<180;i++)rig.step();
    let aim=rig.aim(),worstAim=0,previous=rig.follow.inputYaw,speed=0,worstAccel=0,reversed=0,sign=0;
    for(let i=0;i<300;i++){
      rig.step(1/60,0,false,behind);
      const now=rig.aim();worstAim=Math.max(worstAim,now.angleTo(aim)*60*DEG);aim=now;
      const v=wrapped(rig.follow.inputYaw-previous)*60;previous=rig.follow.inputYaw;
      worstAccel=Math.max(worstAccel,Math.abs(v-speed)*60);speed=v;
      if(Math.abs(v)>.01){if(sign&&Math.sign(v)!==sign)reversed++;sign=Math.sign(v);}
    }
    expect(worstAim,'aim rate').toBeLessThan(2.6*DEG*1.02);
    expect(worstAccel).toBeLessThanOrEqual(9+1e-6);
    expect(reversed,'a swing that reverses is an oscillation').toBe(0);
    const target=framingHeading(Math.atan2(-3,-5),Math.hypot(3,5),1.05,3.1*Math.cos(0));
    expect(Math.abs(wrapped(rig.follow.inputYaw-target))*DEG).toBeLessThan(1.5);
  });

  it('holds still for an opponent inside the dead zone or straight overhead',()=>{
    const rig=new Rig();
    rig.foe.group.position.set(0,0,.4);
    for(let i=0;i<30;i++)rig.step();
    const held=rig.follow.inputYaw;
    for(let i=0;i<600;i++){
      const t=i/60;
      if(i<300)rig.foe.group.position.set(Math.sin(t*3)*.4,0,Math.cos(t*3)*.4);
      else rig.foe.group.position.set(Math.sin(t*5)*.4,2+Math.sin(t)*1.5,Math.cos(t*5)*.4);
      rig.step();
      expect(Math.abs(wrapped(rig.follow.inputYaw-held))).toBeLessThan(1e-9);
    }
  });

  it('maps movement to the heading on screen, before any shake',()=>{
    const rig=new Rig();
    for(let i=0;i<400;i++){
      const t=i/60;rig.foe.group.position.set(Math.sin(t*.8)*5,0,Math.cos(t*.8)*5);rig.step();
      const aim=rig.aim();
      expect(Math.abs(wrapped(rig.follow.movementYaw-Math.atan2(aim.x,aim.z)))).toBeLessThan(1e-9);
    }
    expect(rig.follow.assist).toBeGreaterThan(.99);
  });

  it('frames the auto-target only while it is near enough to be the fight; a Tab lock reaches further',()=>{
    const rig=new Rig();rig.foe.group.position.set(18,0,18);
    for(let i=0;i<60;i++)rig.step();
    expect(rig.follow.assist).toBe(0);
    rig.step(1/60,0,true);
    expect(rig.follow.assist).toBeGreaterThan(.99);
  });

  it('is the same shot at any frame rate',()=>{
    const run=(hz:number)=>{
      const rig=new Rig(),out:{eye:THREE.Vector3;aim:THREE.Vector3}[]=[];
      for(let i=0;i<=8*hz;i++){
        const t=i/hz;
        rig.me.group.position.set(Math.sin(t*1.9)*2.2,0,Math.cos(t*1.3)*2.4);
        rig.foe.group.position.set(Math.sin(t*1.1+2)*5,0,Math.cos(t*1.7+1)*5);
        rig.step(1/hz);
        if(i%(hz/2)===0&&t>=2)out.push({eye:rig.camera.position.clone(),aim:rig.aim()});
      }
      return out;
    };
    const reference=run(60);
    for(const hz of [30,20,10]){
      const got=run(hz);let eye=0,aim=0;
      for(let k=0;k<reference.length;k++){eye=Math.max(eye,got[k].eye.distanceTo(reference[k].eye));aim=Math.max(aim,got[k].aim.angleTo(reference[k].aim)*DEG);}
      expect(eye,`${hz} Hz eye`).toBeLessThan(1);expect(aim,`${hz} Hz aim`).toBeLessThan(10);
    }
  });

  it('moves between the two rigs when the setting changes, rather than cutting',()=>{
    const rig=new Rig('free');let eye=rig.camera.position.clone(),aim=rig.aim(),worstEye=0,worstAim=0;
    for(let i=0;i<360;i++){
      if(i===120)rig.follow.mode='lockon';if(i===240)rig.follow.mode='free';
      rig.step();
      if(i>0){worstEye=Math.max(worstEye,rig.camera.position.distanceTo(eye));worstAim=Math.max(worstAim,rig.aim().angleTo(aim)*60*DEG);}
      eye=rig.camera.position.clone();aim=rig.aim();
    }
    expect(worstEye).toBeLessThan(.15);expect(worstAim).toBeLessThan(160);
  });
});

describe('an airborne opponent stays in the frame',()=>{
  const S=THREE.MathUtils.smoothstep;
  const juggle=(t:number,rig:Rig)=>{
    const me=rig.me.group.position,foe=rig.foe.group.position;
    me.set(0,t<1.45?1.95*S(t,1.1,1.35):Math.max(0,1.95*(1-((t-1.45)/.55)**2)),1.6*S(t,1.1,1.35));
    foe.set(0,t<1?0:t<1.5?1.74*Math.sin(Math.PI/2*(t-1)/.5):t<1.6?1.74:t<2?1.74+1.16*Math.sin(Math.PI/2*(t-1.6)/.4):Math.max(0,2.9-.5*23*.68*(t-2)**2),1.3+1.7*S(t,1,1.5));
    rig.me.state.grounded=me.y<=1e-6;rig.foe.state.grounded=foe.y<=1e-6;
  };
  const rigged=(body:Fighter)=>{
    const joints=new Map<string,THREE.Bone>();
    for(const [name,y] of [['Head',1.62],['LeftFoot',.08],['RightFoot',.08],['LeftToeBase',.03],['RightToeBase',.03]] as const){const bone=new THREE.Bone();bone.position.y=y;bone.userData.rest=y;body.group.add(bone);joints.set(name,bone);}
    (body as unknown as {joints:Map<string,THREE.Bone>}).joints=joints;
    return (lift:number)=>{for(const bone of joints.values())bone.position.y=bone.userData.rest+lift;body.group.updateMatrixWorld(true);};
  };
  const play=(hz:number,lift=0)=>{
    const rig=new Rig(),out={head:-Infinity,foeFeet:Infinity,myHead:-Infinity,myFeet:Infinity,accel:0,pitch:[] as number[]};
    const pose=lift?rigged(rig.foe):undefined;
    let previous:THREE.Vector3|undefined,speed=0;
    for(let i=0;i<=3.5*hz;i++){
      juggle(i/hz,rig);
      const lifted=lift*THREE.MathUtils.clamp(rig.foe.group.position.y/1.2,0,1);pose?.(lifted);
      rig.step(1/hz);
      const aim=rig.aim();
      if(previous){const s=aim.angleTo(previous)*hz;if(i>2)out.accel=Math.max(out.accel,Math.abs(s-speed)*hz);speed=s;}
      previous=aim;out.pitch.push(Math.asin(aim.y));
      out.head=Math.max(out.head,rig.ndc(rig.foe,1.75+lifted).y);out.foeFeet=Math.min(out.foeFeet,rig.ndc(rig.foe,.04+lifted).y);
      out.myHead=Math.max(out.myHead,rig.ndc(rig.me,1.75).y);out.myFeet=Math.min(out.myFeet,rig.ndc(rig.me,.04).y);
    }
    return out;
  };

  it('holds a juggled body clear of the HUD with the player\'s feet in shot, within the assist\'s own limits',()=>{
    const shot=play(60);
    expect(shot.head,'the juggled head').toBeLessThan(.75);
    expect(shot.foeFeet).toBeGreaterThan(-.95);
    expect(shot.myHead).toBeLessThan(.95);expect(shot.myFeet,'the player\'s feet').toBeGreaterThan(-.95);
    expect(shot.accel).toBeLessThanOrEqual(9);
    const landed=Math.ceil(2.65*60),settling=shot.pitch.slice(landed);let turns=0,sign=0;
    for(let i=1;i<settling.length;i++){const d=settling[i]-settling[i-1];if(Math.abs(d)<1e-5)continue;if(sign&&Math.sign(d)!==sign)turns++;sign=Math.sign(d);}
    expect(turns,'a settle that changes its mind is a bob').toBe(0);
  });

  it('frames the pose, not the root: a body the launch clip throws a metre clear is held all the same',()=>{
    const shot=play(60,1);
    expect(shot.head,'the juggled head, a metre over its root').toBeLessThan(.75);
    expect(shot.myFeet).toBeGreaterThan(-.95);
    expect(shot.accel).toBeLessThanOrEqual(9);
  });

  it('is the same framing at any frame rate',()=>{
    for(const hz of [30,20]){const shot=play(hz);expect(shot.head,`${hz} Hz`).toBeLessThan(.75);expect(shot.myFeet,`${hz} Hz`).toBeGreaterThan(-.95);}
  });

  it('leaves a grounded pair in the composition it had, untilted and where it stood',()=>{
    for(const [x,z] of [[0,1.3],[.3,3],[1.2,6],[-2.4,12]]){
      const rig=new Rig();rig.foe.group.position.set(x,0,z);
      for(let i=0;i<240;i++){rig.step();const view=rig.camera.userData.rig as {tilt:number;pull:number};expect(view.tilt).toBe(0);expect(view.pull).toBe(0);}
    }
  });
});
