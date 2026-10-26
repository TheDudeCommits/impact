import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera} from '../src/render/FollowCamera';
import type {Fighter} from '../src/render/Fighter';
import type {ActionKind,FighterId,PlayerState} from '../src/game/types';


const state=(id:string,fighter:FighterId='zoro'):PlayerState=>({id,name:id,fighter,x:0,y:0,z:0,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
const actor=(id:string,x=0,z=0,fighter:FighterId='zoro')=>{const group=new THREE.Group();group.position.set(x,0,z);
  return {state:state(id,fighter),group,velocity:new THREE.Vector3()} as unknown as Fighter;};
const wrapped=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const DEG=180/Math.PI;

class Rig{
  camera=new THREE.PerspectiveCamera(50,16/9,.1,200);
  follow=new FollowCamera(this.camera);
  me:Fighter;foe:Fighter;input=0;
  constructor(me=actor('me'),foe=actor('foe',0,3),others:Fighter[]=[]){
    this.me=me;this.foe=foe;this.follow.mode='lockon';
    if(others.length)this.follow.director.crowd=new Map([me,foe,...others].map(b=>[b.state.id,b]));
  }
  step(dt=1/60,locked=true){this.follow.update(dt,this.me,this.input,0,[],0,this.foe,locked);this.input=this.follow.inputYaw;this.camera.updateMatrixWorld();}
  ndc(body:Fighter,up:number){return body.group.position.clone().setY(body.group.position.y+up).project(this.camera);}
  offAxis(){const a=this.camera.getWorldDirection(new THREE.Vector3()),m=this.me.group.position,f=this.foe.group.position;
    return Math.abs(wrapped(Math.atan2(a.x,a.z)-Math.atan2(f.x-m.x,f.z-m.z)))*DEG;}
  height(){return (this.ndc(this.me,1.75).y-this.ndc(this.me,.04).y)/2;}
  hidden(others:Fighter[]){
    const box=(b:Fighter)=>{const p=b.group.position,c=p.clone().setY(p.y+.975).applyMatrix4(this.camera.matrixWorldInverse),depth=-c.z;
      const tanH=Math.tan(25*Math.PI/180)*this.camera.aspect,x=c.x/(depth*tanH),half=.3/(depth*tanH);
      const top=this.ndc(b,1.95).y,low=this.ndc(b,0).y;return {x0:x-half,x1:x+half,y0:Math.min(top,low),y1:Math.max(top,low),depth};};
    const v=box(this.foe);let covered=0;
    for(const o of others){const b=box(o);if(b.depth<=.3||b.depth>=v.depth)continue;
      const w=Math.min(v.x1,b.x1)-Math.max(v.x0,b.x0),h=Math.min(v.y1,b.y1)-Math.max(v.y0,b.y0);if(w>0&&h>0)covered+=w*h;}
    return Math.min(1,covered/((v.x1-v.x0)*(v.y1-v.y0)));
  }
}
const swing=(body:Fighter,action:ActionKind)=>{body.state.action=action;};

describe('the line between the fighters runs off the view',()=>{
  it('20-35 degrees at fighting range, further as they close, and further still while the player swings',()=>{
    const at=(d:number,action:ActionKind='idle')=>{const r=new Rig(actor('me'),actor('foe',0,d));swing(r.me,action);for(let i=0;i<300;i++)r.step();return r.offAxis();};
    for(const d of [3,4,5]){const off=at(d);expect(off,`${d} m`).toBeGreaterThan(20);expect(off,`${d} m`).toBeLessThan(35);}
    for(const d of [1.1,1.5,2])expect(at(d),`${d} m`).toBeGreaterThan(40);
    for(const d of [1.1,1.5]){const off=at(d,'light');expect(off,`${d} m, swinging`).toBeGreaterThan(50);expect(off).toBeLessThan(60);}
  });

  it('steers at the 1.1 m the pushboxes hold two fighters apart, where round one held still',()=>{
    const r=new Rig(actor('me'),actor('foe',0,1.1));
    for(let i=0;i<120;i++)r.step();
    let previous=r.follow.inputYaw,speed=0,worstSpeed=0,worstAccel=0,hiddenFrames=0;
    for(let i=0;i<600;i++){
      const t=i/60;r.foe.group.position.set(Math.sin(t*.9)*1.1,0,Math.cos(t*.9)*1.1);r.step();
      const v=wrapped(r.follow.inputYaw-previous)*60;previous=r.follow.inputYaw;
      worstSpeed=Math.max(worstSpeed,Math.abs(v));worstAccel=Math.max(worstAccel,Math.abs(v-speed)*60);speed=v;
      if(r.hidden([r.me])>.4)hiddenFrames++;
      expect(r.offAxis(),`frame ${i}`).toBeGreaterThan(25);
    }
    expect(hiddenFrames,'the victim behind the player\'s back').toBe(0);
    expect(worstSpeed).toBeLessThanOrEqual(2.6+1e-9);expect(worstAccel).toBeLessThanOrEqual(9+1e-6);
  });
});

describe('the lens comes in over the shoulder',()=>{
  it('draws the player at 55-65% of the frame at fighting range, crown under the HUD bars',()=>{
    for(const d of [1.3,2.5,4]){
      const r=new Rig(actor('me'),actor('foe',.4,d));for(let i=0;i<240;i++)r.step();
      const [least,most]=d<2?[.42,.52]:[.55,.65];
      expect(r.height(),`${d} m`).toBeGreaterThan(least);expect(r.height(),`${d} m`).toBeLessThan(most);
      expect(r.ndc(r.me,1.95).y).toBeLessThan(.64);expect(r.ndc(r.me,0).y).toBeGreaterThan(-.8);
      expect(r.ndc(r.foe,1.95).y).toBeLessThan(.64);
      const foe=r.ndc(r.foe,1);if(foe.x>.1)expect(r.ndc(r.foe,0).y,`${d} m: the opponent's feet over the cards`).toBeGreaterThan(-.45);
      expect(foe.x,'the opponent right of the player').toBeGreaterThan(r.ndc(r.me,1).x+.25);
    }
  });

  it('eases out as the pair separate, as round one did',()=>{
    const at=(d:number)=>{const r=new Rig(actor('me'),actor('foe',0,d));for(let i=0;i<400;i++)r.step();return r.height();};
    expect(at(12)).toBeLessThan(at(4)-.05);expect(at(20)).toBeLessThan(at(12));
  });
});

describe('whatever hides the victim is looked past',()=>{
  it('turns away from a third body standing in front of the opponent, and settles without hunting',()=>{
    const place=()=>{const me=actor('me'),foe=actor('foe',0,4),by=actor('by',-.95,2.05);return {me,foe,by};};
    const blind=(()=>{const {me,foe,by}=place(),r=new Rig(me,foe);for(let i=0;i<300;i++)r.step();return r.hidden([me,by]);})();
    expect(blind,'the composed framing, with nobody looking').toBeGreaterThan(.4);
    const {me,foe,by}=place(),r=new Rig(me,foe,[by]);
    let previous=NaN,speed=0,worstSpeed=0,worstAccel=0,turns=0,sign=0;
    for(let i=0;i<300;i++){
      r.step();
      if(Number.isFinite(previous)){const v=wrapped(r.follow.inputYaw-previous)*60;worstSpeed=Math.max(worstSpeed,Math.abs(v));if(i>1)worstAccel=Math.max(worstAccel,Math.abs(v-speed)*60);speed=v;
        if(Math.abs(v)>.01){if(sign&&Math.sign(v)!==sign)turns++;sign=Math.sign(v);}}
      previous=r.follow.inputYaw;
    }
    expect(r.hidden([me,by]),'looked past').toBeLessThan(.2);
    expect((r.camera.userData.rig as {cover:number}).cover,'the camera\'s own measure agrees').toBeLessThan(.2);
    expect(Math.abs(r.ndc(foe,1).x)).toBeLessThan(.8);
    expect(worstSpeed).toBeLessThanOrEqual(2.6+1e-9);expect(worstAccel).toBeLessThanOrEqual(9+1e-6);
    expect(turns,'a turn that reverses is hunting').toBe(0);
  });

  it('lets the turn go once the body has moved away, a step at a time',()=>{
    const me=actor('me'),foe=actor('foe',0,4),by=actor('by',-.95,2.05),r=new Rig(me,foe,[by]);
    for(let i=0;i<240;i++)r.step();
    const dodged=Math.abs((r.camera.userData.rig as {dodge:number}).dodge);
    expect(dodged).toBeGreaterThan(.05);
    by.group.position.set(-6,0,-4);
    let previous=r.follow.inputYaw,sign=0,turns=0;
    for(let i=0;i<300;i++){r.step();const v=wrapped(r.follow.inputYaw-previous);previous=r.follow.inputYaw;if(Math.abs(v)>1e-5){if(sign&&Math.sign(v)!==sign)turns++;sign=Math.sign(v);}}
    expect(Math.abs((r.camera.userData.rig as {dodge:number}).dodge)).toBeLessThan(1e-6);
    expect(turns,'letting go is one move back').toBeLessThanOrEqual(1);
  });

  it('looks past the player\'s own Stand while it fights',()=>{
    const run=(fighter:FighterId)=>{
      const me=actor('me',0,0,fighter),foe=actor('foe',0,1.2),r=new Rig(me,foe,[]);me.state.yaw=.5;swing(me,'special');
      for(let i=0;i<300;i++)r.step();
      const stand=actor('stand'),forward=THREE.MathUtils.clamp(1.2-1.35,.25,.7),yaw=me.state.yaw;
      stand.group.position.set(Math.sin(yaw)*forward-Math.cos(yaw)*.75,0,Math.cos(yaw)*forward+Math.sin(yaw)*.75);
      return r.hidden([me,stand]);
    };
    expect(run('zoro'),'the composed framing, measured against the Stand').toBeGreaterThan(.4);
    expect(run('jotaro'),'the victim behind the Stand').toBeLessThan(.2);
  });

  it('holds still for a body straight overhead, and never counts the victim behind the lens',()=>{
    const r=new Rig(actor('me'),actor('foe',0,.2),[actor('by',5,5)]);r.foe.group.position.y=2.5;
    for(let i=0;i<60;i++)r.step();
    const held=r.follow.inputYaw;
    for(let i=0;i<120;i++){r.step();expect(Math.abs(wrapped(r.follow.inputYaw-held))).toBeLessThan(1e-9);}
  });
});

describe('a launch keeps both bodies in the frame',()=>{
  it('widens for what the tilt and pull have not caught, and gives it back after the landing',()=>{
    const r=new Rig(actor('me'),actor('foe',0,1.5));
    for(let i=0;i<120;i++)r.step();
    let widest=0,crown=-Infinity,feet=Infinity;
    for(let i=0;i<240;i++){
      const t=i/60;r.foe.group.position.y=t<1.2?Math.max(0,2.5*Math.sin(Math.PI*t/1.2)):0;r.foe.state.grounded=r.foe.group.position.y<=1e-6;
      r.step();widest=Math.max(widest,r.camera.fov);
      crown=Math.max(crown,r.ndc(r.foe,1.95).y);feet=Math.min(feet,r.ndc(r.me,.04).y);
    }
    expect(widest,'widened').toBeGreaterThan(51);expect(widest).toBeLessThanOrEqual(62+1e-6);
    expect(crown,'the launched head').toBeLessThan(.75);expect(feet,'the player\'s feet').toBeGreaterThan(-.95);
    for(let i=0;i<120;i++)r.step();
    expect(r.camera.fov,'back to the lens it had').toBeCloseTo(50,3);
  });
});
