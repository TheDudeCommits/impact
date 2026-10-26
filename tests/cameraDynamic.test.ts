import {afterEach,describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {CameraBrain,ShotGate,across,brainInput,calmInner,calmOuter,framing,playShape,subject,
  CALM_GAIN,CROSS_ACCEL,CROSS_SPEED,FOE_ANGLE,FOV_LEAST,FOV_MOST,JERK,MAX_SPEED,PLAY_LENGTH,SHOT_GAP,SPEED,STEP,
  YIELD_BACK,YIELD_HOLD,type BrainInput,type Subject} from '../src/render/CameraBrain';
import {FollowCamera} from '../src/render/FollowCamera';
import {CAMERA_VERSION,loadSettings} from '../src/config';
import {ViewKeys,movementMask} from '../src/render/viewKeys';
import {bindKey,resetBindings} from '../src/input/bindings';
import type {Fighter} from '../src/render/Fighter';
import type {CombatEvent,PlayerState} from '../src/game/types';


const wrapped=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const DEG=180/Math.PI;
const window=(d:number,back:number)=>{const own=framing(0,d,1.05,back);return {inner:calmInner(d,own),outer:calmOuter(d)};};
const state=(id:string,x=0,z=0):PlayerState=>({id,name:id,fighter:'zoro',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
const actor=(id:string,x=0,z=0)=>{const group=new THREE.Group();group.position.set(x,0,z);
  return {state:state(id,x,z),group,velocity:new THREE.Vector3()} as unknown as Fighter;};

class Bench{
  brain=new CameraBrain();input:BrainInput=brainInput();subjects:Subject[]=[];heading=0;
  constructor(){this.input.subjects=this.subjects;}
  add(x:number,z:number,fill:Partial<Subject>={}){const s=Object.assign(subject(),{id:`s${this.subjects.length}`,x,z},fill);this.subjects.push(s);this.input.count=this.subjects.length;return s;}
  step(dt=1/60,turn=0){
    this.heading+=turn;
    Object.assign(this.input,{dt,heading:this.heading,manual:turn,shoulder:1.05*this.brain.side});
    this.brain.think(this.input);
    this.heading=this.brain.steer(this.heading,this.brain.goal,dt);
    return this.heading;
  }
  x(s:Subject){const i=this.input;return across(s.x,s.z,i.x,i.z,this.heading,i.back,1.05*this.brain.side,i.tanH);}
}

describe('settings: the dynamic camera is the default, and a save holding an old default moves to it once',()=>{
  const store=new Map<string,string>();
  const stub={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);},clear:()=>store.clear()};
  const saved=(value:unknown)=>{store.clear();if(value!==undefined)store.set('rift-settings',JSON.stringify(value));(globalThis as {localStorage?:unknown}).localStorage=stub;return loadSettings();};
  afterEach(()=>{delete (globalThis as {localStorage?:unknown}).localStorage;});
  it('a fresh player gets the dynamic camera',()=>{
    expect(saved(undefined).cameraMode).toBe('dynamic');
    expect(saved(undefined).cameraVersion).toBe(CAMERA_VERSION);
    expect(CAMERA_VERSION).toBe(4);
  });
  it('a save holding the first default (lock-on, before round 4) moves to it, once',()=>{
    expect(saved({cameraMode:'lockon'}).cameraMode).toBe('dynamic');
    expect(saved({cameraMode:'lockon',cameraVersion:1}).cameraMode).toBe('dynamic');
    expect(saved({cameraMode:'lockon',cameraVersion:2}).cameraMode).toBe('lockon');
    expect(saved({cameraMode:'lockon',cameraVersion:3}).cameraMode).toBe('lockon');
    expect(saved({cameraMode:'lockon',cameraVersion:CAMERA_VERSION}).cameraMode).toBe('lockon');
  });
  it('a save holding launch day\'s default (arena) moves to it, once; chosen since, arena stays',()=>{
    expect(saved({cameraMode:'arena'}).cameraMode).toBe('dynamic');
    expect(saved({cameraMode:'arena',cameraVersion:3}).cameraMode).toBe('dynamic');
    expect(saved({cameraMode:'arena',cameraVersion:CAMERA_VERSION}).cameraMode).toBe('arena');
  });
  it('dynamic stays dynamic whenever it was saved, free stays free, and nonsense is the default',()=>{
    for(const version of [undefined,2,3,CAMERA_VERSION]){
      expect(saved({cameraMode:'dynamic',cameraVersion:version}).cameraMode).toBe('dynamic');
      expect(saved({cameraMode:'free',cameraVersion:version}).cameraMode).toBe('free');
    }
    expect(saved({cameraMode:'sideways'}).cameraMode).toBe('dynamic');
  });
});

describe('the brain: a duel',()=>{
  it('frames one opponent from over the shoulder, right of centre and in the frame',()=>{
    const b=new Bench();const foe=b.add(0,4,{target:true});
    for(let i=0;i<180;i++)b.step();
    const want=framing(0,4,1.05,b.input.back);
    expect(window(4,b.input.back).inner).toBe(0);
    expect(Math.abs(wrapped(b.heading-want))).toBeLessThan(.01);
    const x=b.x(foe);expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(.6);
    expect(b.brain.mode).toBe('duel');
    for(let i=0;i<240;i++)b.step();
    const rest=b.heading;for(let i=0;i<600;i++)b.step();
    expect(Math.abs(b.heading-rest)).toBeLessThan(1e-4);
  });
  it('holds still while the opponent moves about inside the window, and at arm\'s length the window is wide',()=>{
    const b=new Bench();const foe=b.add(0,1.1,{target:true});
    for(let i=0;i<240;i++)b.step();
    const w=window(1.1,b.input.back);expect((w.inner+w.outer)*DEG).toBeGreaterThan(45);
    const own=framing(0,1.1,1.05,b.input.back),mid=b.heading-own-(w.outer-w.inner)/2;
    for(let i=0;i<120;i++){foe.x=1.1*Math.sin(mid);foe.z=1.1*Math.cos(mid);b.step();}
    const rest=b.heading;let moved=0;
    for(let i=0;i<600;i++){const a=mid+(w.inner+w.outer)/3*Math.sin(i/40);foe.x=1.1*Math.sin(a);foe.z=1.1*Math.cos(a);b.step();moved=Math.max(moved,Math.abs(b.heading-rest));}
    expect(moved*DEG).toBeLessThan(.5);
    for(const d of [2.8,3,7,14]){const far=window(d,b.input.back);expect(far.inner+far.outer).toBe(0);}
  });
  it('follows a circling opponent from the window\'s edge at their own rate instead of trailing further and further',()=>{
    const b=new Bench();const foe=b.add(0,4,{target:true});
    let worst=0,fastest=0;
    for(let i=0;i<360;i++){
      const a=i/60;foe.x=4*Math.sin(a);foe.z=4*Math.cos(a);
      const before=b.heading;b.step();
      if(i>120){worst=Math.max(worst,Math.abs(wrapped(b.heading-framing(a,4,1.05*b.brain.side,b.input.back))));fastest=Math.max(fastest,Math.abs(b.heading-before)*60);}
    }
    const w=window(4,b.input.back);
    expect(worst).toBeLessThan(Math.max(w.inner,w.outer)+.15/CALM_GAIN+.02);expect(worst*DEG).toBeLessThan(7);
    expect(fastest).toBeLessThan(1.1);
  });
  it('swings round a cross-up calmly: speed, acceleration and jerk all limited, the opponent back in the frame',()=>{
    const b=new Bench();const foe=b.add(.6,3,{target:true});
    for(let i=0;i<120;i++)b.step();
    const trace=new Float64Array(8);let worst=0,accel=0,lastAccel=NaN,jerk=0,back=-1;
    for(let i=0;i<240;i++){
      const u=Math.min(1,i/12);foe.x=.6+(-1.2)*u;foe.z=3+(-6)*u;
      Object.assign(b.input,{dt:1/60,heading:b.heading,manual:0,shoulder:1.05*b.brain.side});b.brain.think(b.input);
      const before=b.heading;b.heading=b.brain.steer(b.heading,b.brain.goal,1/60,false,trace);
      worst=Math.max(worst,Math.abs(wrapped(b.heading-before))*60);
      for(let k=0;k<b.brain.traced;k++){accel=Math.max(accel,trace[k]);if(Number.isFinite(lastAccel))jerk=Math.max(jerk,Math.abs(trace[k]-lastAccel)/STEP);lastAccel=trace[k];}
      if(back<0&&i>12&&Math.abs(b.x(foe))<=.9)back=i/60;
    }
    expect(worst).toBeLessThanOrEqual(CROSS_SPEED+1e-6);
    expect(worst*DEG).toBeLessThan(400);
    expect(accel).toBeLessThanOrEqual(CROSS_ACCEL+1e-6);
    expect(jerk).toBeLessThanOrEqual(JERK*1.0001);
    expect(back,'the opponent back in the frame').toBeGreaterThan(0);
    expect(back).toBeLessThan(1.8);
  });
  it('takes the other shoulder when it is much the shorter way round, crossing over eased',()=>{
    const b=new Bench();const foe=b.add(-1,4,{target:true});
    for(let i=0;i<120;i++)b.step();
    expect(b.brain.side).toBe(1);
    let biggest=0,last=b.brain.side;
    for(let i=0;i<180;i++){foe.x=-1+5*Math.min(1,i/10);b.step();biggest=Math.max(biggest,Math.abs(b.brain.side-last));last=b.brain.side;}
    expect(b.brain.side).toBeLessThan(-.99);
    expect(biggest).toBeLessThan(.12);
    expect(b.x(foe)).toBeLessThan(0);
    const c=new Bench();const walker=c.add(-1,4,{target:true});
    for(let i=0;i<120;i++)c.step();
    for(let i=0;i<240;i++){walker.x=-1+5*Math.min(1,i/120);c.step();}
    expect(c.brain.side).toBe(1);
  });
  it('turns toward the side a target passing through the player comes out on, never the long way round',()=>{
    for(const side of [1,-1]){
      const b=new Bench();const foe=b.add(-side*1.2,2.2,{target:true});
      for(let i=0;i<60;i++)b.step(1/21);
      const start=b.heading;let wrong=0,back=-1;
      const path:[number,number][]=[[-side*.4,.6],[side*.6,-1.5],[side*.9,-3.3],[side*1.2,-3.8],[side*1.5,-4.2],[side*2,-5],[side*2.6,-5.2],[side*3.2,-5.5],[side*3.8,-5.8]];
      for(let k=0;k<40;k++){const [x,z]=path[Math.min(k,path.length-1)];foe.x=x;foe.z=z;b.step(1/21);
        const turned=wrapped(b.heading-start);if(turned*side<0)wrong=Math.max(wrong,Math.abs(turned));
        if(back<0&&k>2&&Math.abs(b.x(foe))<=.95)back=k/21;}
      expect(wrong*DEG,'turned the long way').toBeLessThan(2);
      expect(back,'back in the frame').toBeGreaterThan(0);
      expect(back).toBeLessThan(1.3);
    }
  });
  it('holds still with the opponent on top of the player, and turns no faster than MAX_SPEED with anything fed forward',()=>{
    const b=new Bench();const foe=b.add(0,.2,{target:true});
    const start=b.heading;for(let i=0;i<60;i++)b.step();
    expect(Math.abs(wrapped(b.heading-start))).toBeLessThan(.05);
    let worst=0;
    for(let i=0;i<120;i++){const a=i*.3;foe.x=2*Math.sin(a);foe.z=2*Math.cos(a);const before=b.heading;b.step();worst=Math.max(worst,Math.abs(wrapped(b.heading-before))*60);}
    expect(worst).toBeLessThanOrEqual(MAX_SPEED);
  });
});

describe('the brain: a group',()=>{
  it('stands back for threats off the duel heading quickly and gives it back slowly, and turns to hold more of them',()=>{
    const b=new Bench();b.add(0,4,{target:true});
    for(let i=0;i<120;i++)b.step();
    const duel=b.heading;
    const left=b.add(4,2,{attacking:true}),right=b.add(-3.5,1,{attacking:true});
    let took=-1;
    for(let i=0;i<120;i++){b.step();if(took<0&&b.brain.group>.5)took=i/60;}
    expect(b.brain.mode).toBe('group');
    expect(took).toBeGreaterThan(0);expect(took).toBeLessThan(.5);
    const held=[left,right].filter(s=>Math.abs(b.x(s))<=1).length;
    expect(held,'threats in the frame').toBeGreaterThanOrEqual(1);
    expect(b.brain.boom).toBeGreaterThan(1.5);
    left.x=left.z=right.x=right.z=40;
    for(let i=0;i<30;i++)b.step();
    expect(b.brain.group).toBeGreaterThan(.5);
    for(let i=0;i<600;i++)b.step();
    expect(b.brain.group).toBeLessThan(.05);
    expect(Math.abs(wrapped(b.heading-duel))).toBeLessThan(.05);
  });
  it('frames the heaviest threat when there is no target yet',()=>{
    const b=new Bench();b.add(3,3,{attacking:true});b.add(-6,2,{hitAgo:.5});
    for(let i=0;i<120;i++)b.step();
    expect(b.brain.mode).toBe('group');
    expect(Math.abs(b.x(b.subjects[0]))).toBeLessThan(.8);
  });
  it('counts attackers and recent hitters, not a bystander far off',()=>{
    const b=new Bench();const t=b.add(0,4,{target:true}),near=b.add(2,1,{attacking:true}),hit=b.add(-2,2,{hitAgo:1}),far=b.add(11,0,{});
    b.step();
    expect(t.weight).toBeCloseTo(1,5);
    expect(near.weight).toBeGreaterThan(.8);expect(hit.weight).toBeGreaterThan(.5);expect(far.weight).toBeLessThan(.05);
  });
});

describe('the brain: exploring',()=>{
  const run=(b:Bench,seconds:number,vx:number,vz:number,held=true)=>{
    const h:number[]=[];Object.assign(b.input,{vx,vz,basisHeld:held});
    for(let i=0;i<seconds*60;i++){b.step();h.push(b.heading);}
    return h;
  };
  it('never brings the view round behind a run by itself: a strafe, a diagonal, a run at the lens, on the keys or a stick',()=>{
    for(const [vx,vz,held] of [[-7.5,0,true],[-5.3,5.3,true],[0,-7.5,true],[-7.5,0,false],[0,7.5,true]] as const){
      const b=new Bench();const h=run(b,6,vx,vz,held);
      expect(Math.max(...h.map(Math.abs)),`run ${vx},${vz}`).toBe(0);
      expect(b.brain.mode).toBe('explore');expect(b.brain.gain).toBe(0);
    }
  });
  it('looks ahead of the run without turning: a reach along the look and a carry across it',()=>{
    const b=new Bench();run(b,1.5,0,7.5);
    expect(b.brain.ahead).toBeGreaterThan(1);
    expect(Math.hypot(b.brain.leadX,b.brain.leadZ)).toBeLessThan(.05);
    const c=new Bench();Object.assign(c.input,{vx:-7.5,vz:0,basisHeld:false});for(let i=0;i<60;i++)c.step();
    const lx=c.brain.leadX,lz=c.brain.leadZ;
    expect(Math.hypot(lx,lz)).toBeGreaterThan(.5);
    expect(Math.abs(lx*Math.sin(c.heading)+lz*Math.cos(c.heading))).toBeLessThan(1e-6);
  });
  it('widens a little at speed and for a dash, never outside its limits',()=>{
    const b=new Bench();Object.assign(b.input,{vx:0,vz:24,dashing:true});
    for(let i=0;i<60;i++)b.step();
    expect(b.brain.fov).toBeGreaterThan(52);expect(b.brain.fov).toBeLessThanOrEqual(FOV_MOST);
    const c=new Bench();c.step();expect(c.brain.fov).toBeGreaterThanOrEqual(FOV_LEAST);
  });
  it('levels a pitch left alone, and leaves one just tilted',()=>{
    const b=new Bench();b.input.tilted=true;b.step();b.input.tilted=false;
    for(let i=0;i<60;i++)b.step();
    expect(b.brain.pitchGoal).toBeNaN();
    for(let i=0;i<120;i++)b.step();
    expect(b.brain.pitchGoal).toBeCloseTo(.02,5);expect(b.brain.pitchRate).toBeGreaterThan(0);
  });
});

describe('the brain: up and down',()=>{
  it('lifts for a juggled target, raises the lens over a ground smash, and stands back for a body on the floor',()=>{
    const b=new Bench();const foe=b.add(0,3,{target:true});
    for(let i=0;i<60;i++)b.step();
    const rest={lift:b.brain.lift,boom:b.brain.boom,focus:b.brain.focus};
    Object.assign(foe,{launched:true,airborne:true});for(let i=0;i<60;i++)b.step();
    expect(b.brain.lift).toBeGreaterThan(rest.lift+.2);
    Object.assign(foe,{launched:false,airborne:false,lying:true});for(let i=0;i<120;i++)b.step();
    expect(b.brain.boom).toBeGreaterThan(rest.boom+.3);
    Object.assign(foe,{lying:false});b.input.plunging=true;for(let i=0;i<60;i++)b.step();
    expect(b.brain.lift).toBeGreaterThan(rest.lift+.8);expect(b.brain.focus).toBeLessThan(rest.focus-.2);
    b.input.plunging=false;for(let i=0;i<240;i++)b.step();
    expect(Math.abs(b.brain.lift-rest.lift)).toBeLessThan(.05);expect(Math.abs(b.brain.boom-rest.boom)).toBeLessThan(.05);
  });
});

describe('the brain: the player turning',()=>{
  it('lands 1:1, yields at once, holds off, then blends back over about a second without a snap',()=>{
    const b=new Bench();const foe=b.add(0,4,{target:true});
    for(let i=0;i<120;i++)b.step();
    const settled=b.heading;
    for(let i=0;i<30;i++){const before=b.heading;b.step(1/60,2.09/60);expect(b.brain.yieldTo).toBeGreaterThan(.95);expect(Math.abs(b.heading-before-2.09/60)).toBeLessThan(.004);}
    const turned=b.heading;
    expect(turned-settled).toBeGreaterThan(1);
    let fastest=0;const at:number[]=[];
    for(let i=0;i<180;i++){const before=b.heading;b.step();fastest=Math.max(fastest,Math.abs(wrapped(b.heading-before))*60);at.push(b.brain.yieldTo);}
    expect(at[Math.round(YIELD_HOLD*60*.8)],'still holding off').toBeGreaterThan(.9);
    expect(at[Math.round((YIELD_HOLD+YIELD_BACK)*60)+2],'back').toBeLessThan(.02);
    expect(fastest).toBeLessThan(SPEED*.9);
    expect(Math.abs(wrapped(b.heading-settled))).toBeLessThan(.05);
    const x=b.x(foe);expect(x).toBeGreaterThan(0);expect(x).toBeLessThan(.6);
  });
  it('a look to one side that leaves the opponent in the window is left where the player put it',()=>{
    const b=new Bench();b.add(0,1.1,{target:true});
    for(let i=0;i<240;i++)b.step();
    const own=framing(0,1.1,1.05,b.input.back),w=window(1.1,b.input.back);
    expect(w.inner+w.outer).toBeGreaterThan(.5);expect(Math.abs(b.heading-(own-w.inner))).toBeLessThan(.02);
    for(let i=0;i<20;i++)b.step(1/60,.35/20);
    const put=b.heading;
    for(let i=0;i<300;i++)b.step();
    expect(Math.abs(b.heading-put)).toBeLessThan(.002);
  });
  it('keeps a target about to leave the frame inside its edge while the player aims',()=>{
    const b=new Bench();const foe=b.add(0,4,{target:true});
    for(let i=0;i<120;i++)b.step();
    while(b.x(foe)>-.82)b.step(1/60,-.02);
    for(let i=0;i<10;i++)b.step();
    expect(b.brain.yieldTo).toBeGreaterThan(.9);
    expect(b.x(foe)).toBeGreaterThan(-.86);
  });
});

describe('the gameplay shots are rationed',()=>{
  it('never two within SHOT_GAP, never mid-string unless the ender, never over an authored shot',()=>{
    const gate=new ShotGate();
    expect(gate.allow(10,false,false,false)).toBe(true);
    expect(gate.allow(10+SHOT_GAP*.9,false,true,false)).toBe(false);
    expect(gate.allow(10+SHOT_GAP+.01,true,false,false)).toBe(false);
    expect(gate.allow(10+SHOT_GAP+.02,true,true,true)).toBe(false);
    expect(gate.allow(10+SHOT_GAP+.03,true,true,false)).toBe(true);
  });
  it('each one rises, holds and lets go inside its length',()=>{
    for(const kind of ['launch','knockdown','splat','smash'] as const){
      expect(playShape(kind,-.01).w).toBe(0);expect(playShape(kind,PLAY_LENGTH[kind]).w).toBe(0);
      let peak=0,last=0,step=0;
      for(let t=0;t<PLAY_LENGTH[kind];t+=1/120){const w=playShape(kind,t).w;peak=Math.max(peak,w);step=Math.max(step,Math.abs(w-last));last=w;}
      expect(peak).toBeCloseTo(1,5);expect(step).toBeLessThan(.25);
    }
  });
});

class Rig{
  camera=new THREE.PerspectiveCamera(50,16/9,.1,200);
  follow=new FollowCamera(this.camera);
  me=actor('me');foe=actor('foe',0,4);
  yaw=0;pitch=.02;
  constructor(mode:'dynamic'|'lockon'|'free'='dynamic'){this.follow.mode=mode;}
  step(dt=1/60,turn=0,foe:Fighter|null=this.foe,locked=false){
    this.yaw+=turn;this.follow.update(dt,this.me,this.yaw,this.pitch,[],0,foe??undefined,locked);this.yaw=this.follow.inputYaw;this.pitch=this.follow.inputPitch;
    this.camera.updateMatrixWorld();
  }
  move(dx:number,dz:number){this.me.group.position.x+=dx;this.me.group.position.z+=dz;this.me.state.x=this.me.group.position.x;this.me.state.z=this.me.group.position.z;}
}

describe('FollowCamera, dynamic',()=>{
  it('expires retired cinematic and crowd-hit histories across endless waves',()=>{
    const r=new Rig();r.follow.cinematics=true;
    for(let i=0;i<5000;i++){
      const id=`wave-${i}`;
      r.follow.director.handle([{id:i*2+1,kind:'hit',actorId:id,targetId:'me'},{id:i*2+2,kind:'hit',actorId:'me',targetId:id}] as CombatEvent[],'me',()=>undefined);
      r.step(.25);
    }
    expect(r.follow.director.historyEntries).toBeLessThan(40);
    expect(r.follow.director.hitAgo('wave-4999')).toBeLessThan(1);
    for(let i=0;i<30;i++)r.step(.25);
    expect(r.follow.director.historyEntries).toBe(0);
    expect(r.follow.director.hitAgo('wave-0')).toBe(Infinity);
    r.follow.reset();r.step(.25);
    expect(r.follow.director.historyEntries).toBe(0);
  });
  it('frames Last Stand enemies from the separate horde renderer and excludes allied bodies',()=>{
    const r=new Rig();r.follow.battlefield=true;r.me.state.team='defenders';r.foe.state.team='horde';
    const left=actor('grunt-left',4,2),right=actor('grunt-right',-3.5,1),ally=actor('ally',0,2);
    for(const enemy of [left,right])Object.assign(enemy.state,{enemy:'marine',team:'horde',action:'light',move:'Bayonet Thrust',target:'me',actionDuration:1.23,actionTime:.1});
    ally.state.team='defenders';
    r.follow.director.crowd=new Map([[r.me.state.id,r.me],[r.foe.state.id,r.foe],[ally.state.id,ally]]);
    r.follow.extraSubjects=new Map([[left.state.id,left],[right.state.id,right]]);
    for(let i=0;i<180;i++)r.step();
    expect(r.camera.userData.rig.brain).toBe('group');
    left.state.team=right.state.team='defenders';
    for(let i=0;i<240;i++)r.step();
    expect(r.camera.userData.rig.brain).toBe('duel');
  });
  it('looks along the heading: the movement heading is the view, look-ahead and all',()=>{
    const r=new Rig();
    for(let i=0;i<120;i++)r.step();
    expect(Math.abs(wrapped(r.follow.movementYaw-r.follow.inputYaw))).toBeLessThan(.02);
    const n=new Rig();
    for(let i=0;i<90;i++){n.move(-7.5/60,0);n.step(1/60,0,null);}
    expect(Math.abs(wrapped(n.follow.movementYaw-n.follow.inputYaw))).toBeLessThan(.02);
  });
  it('holds a run on its basis while the camera turns by itself, follows the player\'s own turning, and hands over on a change of keys',()=>{
    const r=new Rig();
    for(let i=0;i<30;i++)r.step(1/60,0,null);
    const first=r.follow.movementBasis(8),view0=r.follow.movementYaw;
    for(let i=0;i<240;i++){r.move(-7.5/60*Math.cos(first),7.5/60*Math.sin(first));r.step(1/60,0,null);expect(Math.abs(wrapped(r.follow.movementBasis(8)-first))).toBeLessThan(1e-6);}
    expect(Math.abs(wrapped(r.follow.movementYaw-view0))).toBeLessThan(1e-6);
    const turner=r.foe,spin=(i:number)=>{const a=view0+i*1.2/60;turner.group.position.set(r.me.group.position.x+6*Math.sin(a),0,r.me.group.position.z+6*Math.cos(a));};
    for(let i=0;i<150;i++){spin(i);r.move(-7.5/60*Math.cos(first),7.5/60*Math.sin(first));r.step(1/60,0,turner);if(i>45)expect(Math.abs(wrapped(r.follow.movementBasis(8)-first))).toBeLessThan(1e-6);}
    expect(Math.abs(wrapped(r.follow.movementYaw-view0))).toBeGreaterThan(.8);
    r.step(1/60,.2,null);
    for(let i=0;i<12;i++)r.step(1/60,0,null);
    expect(Math.abs(wrapped(r.follow.movementBasis(8)-first-.2))).toBeLessThan(.01);
    expect(Math.abs(wrapped(r.follow.movementBasis(9)-r.follow.movementYaw))).toBeLessThan(1e-9);
    const l=new Rig('lockon');l.step();expect(l.follow.movementBasis(8)).toBe(l.follow.movementYaw);
  });
  it('a nudge of the view leaves a cinematic on screen; a real turn hands it back',()=>{
    for(const [mode,turn,stays] of [['dynamic',.05,true],['dynamic',.8,false],['lockon',.05,false]] as const){
      const r=new Rig(mode);r.follow.cinematics=true;
      r.step();r.follow.intro(3);
      for(let i=0;i<30;i++)r.step();
      expect(r.follow.director.kind).toBe('intro');
      r.step(1/60,turn);
      for(let i=0;i<40;i++)r.step();
      expect(r.follow.director.kind==='intro',`${mode} ${turn}`).toBe(stays);
    }
  });
  it('switches mode mid-fight as a move, never a cut',()=>{
    const r=new Rig();
    for(let i=0;i<120;i++)r.step();
    const q=new THREE.Quaternion();let worst=0;
    for(const mode of ['lockon','dynamic','free','dynamic'] as const){
      r.follow.mode=mode;
      for(let i=0;i<90;i++){q.copy(r.camera.quaternion);r.step();worst=Math.max(worst,q.angleTo(r.camera.quaternion)*DEG);}
    }
    expect(worst).toBeLessThan(3);
  });
  it('plays a launch from under it, looking up after the body, only with cinematics on, after the movement heading is taken',()=>{
    for(const cinematics of [true,false]){
      const r=new Rig();r.follow.cinematics=cinematics;
      for(let i=0;i<300;i++)r.step();
      const cue=(r.follow.director as unknown as {cue:(k:string,e:boolean)=>void});cue.cue('launch',true);
      const movement=r.follow.movementYaw,dir=new THREE.Vector3();let dropped=0,looked=0;const y0=r.camera.position.y,p0=r.camera.getWorldDirection(dir).y;
      for(let i=0;i<20;i++){r.step();dropped=Math.max(dropped,y0-r.camera.position.y);looked=Math.max(looked,r.camera.getWorldDirection(dir).y-p0);expect(Math.abs(wrapped(r.follow.movementYaw-movement))).toBeLessThan(1e-6);}
      if(cinematics){expect(dropped).toBeGreaterThan(.06);expect(dropped).toBeLessThan(.16);expect(looked).toBeGreaterThan(.02);expect(looked).toBeLessThan(.07);}else{expect(dropped).toBeLessThan(.02);expect(looked).toBeLessThan(.01);}
    }
  });
  it('stays finite whatever the clock and wherever the opponent',()=>{
    const r=new Rig();
    for(const [x,y,z] of [[0,0,0],[0,3.5,0],[0,0,1e-9],[40,0,0]] as const){
      const foe=actor('foe',x,z);foe.group.position.y=y;
      for(const dt of [1/60,0,1e-6,.25,3,NaN]){
        r.follow.impact(1,new THREE.Vector3(0,0,0),2);r.follow.holdFor(1);
        r.step(dt,0,foe,true);
        for(const v of [...r.camera.position.toArray(),...r.camera.quaternion.toArray(),r.camera.fov,r.follow.movementYaw,r.follow.inputYaw,r.follow.inputPitch])
          expect(Number.isFinite(v),`foe at ${x},${y},${z} dt ${dt}`).toBe(true);
      }
    }
  });
});

describe('the main game\'s view keys',()=>{
  afterEach(()=>resetBindings('keyboard'));
  const keys=(...codes:string[])=>new Set(codes);
  it('O and P turn the view, easing in and stopping when let go',()=>{
    const v=new ViewKeys(),input={keys:keys('KeyO'),yaw:0,sensitivity:1};
    for(let i=0;i<30;i++)v.steer(1/60,input);
    expect(input.yaw).toBeGreaterThan(1);
    const held=input.yaw;input.keys=keys();v.steer(1/60,input);
    expect(input.yaw).toBe(held);
    input.keys=keys('BracketLeft');for(let i=0;i<30;i++)v.steer(1/60,input);
    expect(input.yaw).toBeLessThan(held-1);
  });
  it('I swings to the target and U turns the view round, eased and never past ~400 deg/s; the run keeps its view through a swing and comes round to the new one after',()=>{
    const v=new ViewKeys(),input={keys:keys('KeyI','KeyW'),yaw:0,sensitivity:1};
    let last=0,peak=0;
    v.steer(1/60,input,{x:0,z:0},{x:4,z:0},input.yaw,movementMask(input.keys));
    for(let i=0;i<30;i++){v.steer(1/60,input,{x:0,z:0},{x:4,z:0},input.yaw,1);peak=Math.max(peak,Math.abs(input.yaw-last)*60);last=input.yaw;
      if(Math.abs(wrapped(input.yaw-Math.PI/2))>1e-3)expect(v.movementBasis(input.yaw,1)).toBe(0);}
    expect(Math.abs(wrapped(input.yaw-Math.PI/2))).toBeLessThan(1e-6);
    expect(peak*DEG).toBeLessThan(410);
    for(let i=0;i<40;i++)v.steer(1/60,input,{x:0,z:0},{x:4,z:0},input.yaw,1);
    expect(Math.abs(wrapped(v.movementBasis(input.yaw,1)-input.yaw))).toBeLessThan(.02);
    expect(v.movementBasis(input.yaw,0)).toBe(input.yaw);
    input.keys=keys();v.steer(1/60,input);input.keys=keys('KeyU');last=input.yaw;peak=0;
    for(let i=0;i<60;i++){v.steer(1/60,input);peak=Math.max(peak,Math.abs(input.yaw-last)*60);last=input.yaw;}
    expect(Math.abs(wrapped(input.yaw+Math.PI/2))).toBeLessThan(1e-6);
    expect(peak*DEG).toBeLessThan(410);expect(peak*DEG).toBeGreaterThan(300);
  });
  it('drops a swing\'s kept view at once for a player held up',()=>{
    const v=new ViewKeys(),input={keys:keys('KeyU','KeyW'),yaw:0,sensitivity:1};
    v.steer(1/60,input,undefined,undefined,0,1);
    for(let i=0;i<10;i++)v.steer(1/60,input,undefined,undefined,input.yaw,1);
    expect(v.movementBasis(input.yaw,1)).toBe(0);
    v.steer(1/60,input,undefined,undefined,input.yaw,1,true);
    expect(v.movementBasis(input.yaw,1)).toBe(input.yaw);
  });
  it('leaves a key bound to an action alone',()=>{
    bindKey('special',0,'KeyO');
    const v=new ViewKeys(),input={keys:keys('KeyO'),yaw:0,sensitivity:1};
    for(let i=0;i<30;i++)v.steer(1/60,input);
    expect(input.yaw).toBe(0);
  });
  it('reads the movement keys as a mask, the arrows only where they move the fighter',()=>{
    expect(movementMask(keys())).toBe(0);
    expect(movementMask(keys('KeyW'))).toBe(1);
    expect(movementMask(keys('KeyW','KeyD'))).toBe(9);
    expect(movementMask(keys('ArrowLeft'))).toBe(2);
    expect(movementMask(keys('ArrowLeft'),false)).toBe(0);
  });
});
