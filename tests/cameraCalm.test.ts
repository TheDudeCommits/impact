import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera,hitTier} from '../src/render/FollowCamera';
import {STAGES} from '../src/game/stages';
import type {CameraStyle} from '../src/config';
import type {Fighter} from '../src/render/Fighter';
import type {PlayerState} from '../src/game/types';


const state=(id:string,x=0,z=0,over:Partial<PlayerState>={}):PlayerState=>({id,name:id,fighter:'goku',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0},...over});
const actor=(id:string,x=0,z=0,over:Partial<PlayerState>={})=>{const group=new THREE.Group();group.position.set(x,0,z);
  return {state:state(id,x,z,over),group,velocity:new THREE.Vector3()} as unknown as Fighter;};
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
type RigState={squeeze:number;edge:number;bounded:number;kick:number;punch:number};
class Rig{
  camera=new THREE.PerspectiveCamera(50,16/9,.1,200);follow=new FollowCamera(this.camera);
  me:Fighter;foe:Fighter;yaw:number;shake=.5;
  constructor(style:CameraStyle,me:[number,number],foe:[number,number],bounds?:{halfX:number;halfZ:number;doubleSided?:boolean;background?:number}){
    this.follow.mode='dynamic';this.follow.style=style;this.follow.stageBounds=bounds;
    this.me=actor('me',me[0],me[1],{target:'foe'});this.foe=actor('foe',foe[0],foe[1]);this.yaw=Math.atan2(foe[0]-me[0],foe[1]-me[1]);
  }
  step(frames=1,turn=0,foe:Fighter|undefined=this.foe){for(let i=0;i<frames;i++){this.yaw+=turn;this.follow.update(1/60,this.me,this.yaw,.02,[],this.shake,foe,false);this.yaw=this.follow.inputYaw;}this.camera.updateMatrixWorld();}
  place(x:number,z:number){this.me.group.position.set(x,0,z);this.me.state.x=x;this.me.state.z=z;}
  get rig(){return this.camera.userData.rig as RigState;}
  ndc(body:Fighter,up:number){const p=body.group.position;return p.clone().setY(p.y+up).project(this.camera);}
  mine(){const low=this.ndc(this.me,.03),mid=this.ndc(this.me,1),top=this.ndc(this.me,1.83),inside=(v:THREE.Vector3)=>v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1;
    return {whole:inside(low)&&inside(mid)&&inside(top),height:(top.y-low.y)/2,x:mid.x};}
  out(b:{halfX:number;halfZ:number}){const p=this.camera.position;return Math.max(Math.abs(p.x)-b.halfX,Math.abs(p.z)-b.halfZ);}
}
const HALL=STAGES['chunin-exam-room'],RING=STAGES['martial-arts-tournament'],GALACTIC=STAGES['galactic-arena'],BRIDGE=STAGES['enies-lobby'],VALLEY=STAGES['valley-of-the-end'],OPEN={halfX:16,halfZ:16};

describe('calm: the lens does not move for an ordinary hit, or for nothing',()=>{
  const struck=(mode:'dynamic'|'lockon'|'free',damage:number,slot:'light'|'heavy'|'special'|'ultimate',chain=0)=>{
    const run=(hit:boolean)=>{
      const r=new Rig('classic',[0,3],[0,0]);r.follow.mode=mode;r.step(240);
      if(hit){r.follow.impact(Math.min(1,.2+damage/460),new THREE.Vector3(-1,0,-.3),hitTier(slot,chain));r.follow.holdFor(Math.min(1,damage/240));}
      const out:{p:THREE.Vector3;q:THREE.Quaternion;fov:number;yaw:number}[]=[];
      for(let i=0;i<60;i++){r.step();out.push({p:r.camera.position.clone(),q:r.camera.quaternion.clone(),fov:r.camera.fov,yaw:r.follow.movementYaw});}
      return out;
    };
    const still=run(false),hit=run(true);let move=0,turn=0,punch=0,basis=0;
    for(let i=0;i<still.length;i++){move=Math.max(move,hit[i].p.distanceTo(still[i].p));turn=Math.max(turn,hit[i].q.angleTo(still[i].q)*180/Math.PI);punch=Math.max(punch,still[i].fov-hit[i].fov);basis=Math.max(basis,Math.abs(wrap(hit[i].yaw-still[i].yaw)));}
    return {move,turn,punch,basis};
  };
  it('a jab and a heavy leave the dynamic lens where it is; a special, a finisher and an ultimate move it, less than they did',()=>{
    for(const [damage,slot] of [[30,'light'],[42,'light'],[60,'heavy'],[90,'heavy']] as const){
      const r=struck('dynamic',damage,slot);
      expect(r.move,`${slot} ${damage}: lens`).toBeLessThan(.01);expect(r.turn,`${slot} ${damage}: aim`).toBeLessThan(.15);expect(r.punch,`${slot} ${damage}: field`).toBeLessThan(.05);
    }
    const special=struck('dynamic',150,'special'),finisher=struck('dynamic',80,'light',3),ultimate=struck('dynamic',290,'ultimate');
    expect(special.move).toBeGreaterThan(.01);expect(special.punch).toBeLessThan(.05);
    expect(finisher.punch).toBeGreaterThan(1);expect(finisher.punch).toBeLessThan(2.1);
    expect(ultimate.punch).toBeGreaterThan(1.5);expect(ultimate.punch).toBeLessThan(2.1);expect(ultimate.move).toBeGreaterThan(.05);
    const before=struck('lockon',290,'ultimate');
    expect(ultimate.move).toBeLessThan(before.move*.75);expect(ultimate.punch).toBeLessThan(before.punch*.7);
    expect(struck('lockon',42,'light').move,'lock-on still kicks on a jab').toBeGreaterThan(.01);
    for(const r of [special,finisher,ultimate])expect(r.basis).toBeLessThan(1e-4);
  });
  it('where the view is the squad\'s (Arcade Survival, the objectives, the rift) the impact camera is what it was',()=>{
    const squad=(on:boolean)=>{const r=new Rig('classic',[0,3],[0,0]);r.follow.battlefield=on;r.step(240);const p=r.camera.position.clone();
      r.follow.impact(Math.min(1,.2+42/460),new THREE.Vector3(-1,0,0),0);r.follow.holdFor(.2);let move=0;for(let i=0;i<30;i++){r.step();move=Math.max(move,r.camera.position.distanceTo(p));}return move;};
    expect(squad(true)).toBeGreaterThan(.01);expect(squad(false)).toBeLessThan(.004);
  });
  it('a duel at rest is at rest: ten seconds, not a millimetre, at arm\'s length and across the room',()=>{
    for(const style of ['close','classic'] as const)for(const d of [1.2,3,7]){
      const r=new Rig(style,[0,d],[0,0]);r.step(600);
      const p=r.camera.position.clone(),q=r.camera.quaternion.clone(),fov=r.camera.fov;let move=0,turn=0,field=0;
      for(let i=0;i<600;i++){r.step();move=Math.max(move,r.camera.position.distanceTo(p));turn=Math.max(turn,r.camera.quaternion.angleTo(q));field=Math.max(field,Math.abs(r.camera.fov-fov));}
      expect(move,`${style} ${d} m: lens`).toBeLessThan(1e-3);expect(turn,`${style} ${d} m: aim`).toBeLessThan(1e-4);expect(field).toBeLessThan(1e-3);
    }
  });
  it('a run with nobody near never carries the player\'s own fighter out of the frame, either way, in either style',()=>{
    for(const style of ['close','classic'] as const)for(const way of [1,-1]){
      const r=new Rig(style,[0,0],[0,-40]);r.foe.state.alive=false;r.step(60,0,undefined);
      let worst=0,x=0;
      for(let i=0;i<240;i++){x+=way*7.5/60;r.place(x,0);r.me.state.action='run';r.step(1,0,undefined);const m=r.mine();expect(m.whole,`${style} ${way} frame ${i}`).toBe(true);worst=Math.max(worst,Math.abs(m.x));}
      expect(worst,`${style} ${way}`).toBeLessThan(.9);
    }
  });
});

describe('tight spaces: against a wall and in a corner the player\'s fighter stays whole in the frame',()=>{
  const ROOMS:[string,{halfX:number;halfZ:number;doubleSided?:boolean;background?:number},number][]=[['the exam hall',HALL,1.4],['the tournament ring',RING,1.4],['the Galactic Arena',GALACTIC,1.4],['Enies Lobby\'s bridge',BRIDGE,1.4],['the Valley of the End',VALLEY,1.4],['Kami\'s Lookout',STAGES['kami-lookout'],1.4],['the Null Realm',STAGES['null-realm'],1.4],['a floor with room nobody has looked past the edge of',OPEN,-.25]];
  it.each(ROOMS)('%s: back to the wall and backed into the corner, either style, the opponent near and far',(_name,b,out)=>{
    for(const style of ['close','classic'] as const)for(const gap of [1.3,3,6]){
      for(const [mx,mz,fx,fz] of [[0,b.halfZ-.5,0,b.halfZ-.5-gap],[b.halfX-.5,b.halfZ-.5,b.halfX-.5-gap*.71,b.halfZ-.5-gap*.71]] as const){
        const r=new Rig(style,[mx,mz],[fx,fz],b);r.step(420);
        const m=r.mine(),why=`${style}, opponent ${gap} m off, player at ${mx},${mz}`;
        expect(m.whole,`${why}: whole in the frame`).toBe(true);
        expect(m.height,`${why}: height`).toBeLessThan(.78);if(out>0)expect(m.height,`${why}: height`).toBeGreaterThan(.16);
        expect(r.out(b),`${why}: the lens no further out than the stage allows`).toBeLessThanOrEqual(out+1e-6);
        expect(r.rig.squeeze,`${why}: squeezed`).toBeGreaterThan(.1);
        expect(Math.abs(wrap(r.follow.movementYaw-r.follow.yaw)),`${why}: the view is the heading`).toBeLessThan(1e-6);
      }
    }
  });
  it('the player turns the view right round in a corner: taken 1:1, the fighter in the frame all the way, the lens never jumping',()=>{
    for(const style of ['close','classic'] as const)for(const b of [HALL,RING]){
      const r=new Rig(style,[b.halfX-.6,b.halfZ-.6],[b.halfX-3,b.halfZ-3.4],b);r.step(240);
      const last=new THREE.Vector3().copy(r.camera.position),step=new THREE.Vector3(),was=new THREE.Vector3();let jump=0,first=true;
      for(let i=0;i<420;i++){
        const before=r.follow.movementYaw;r.step(1,.015);
        const turned=wrap(r.follow.inputYaw-before);expect(Math.abs(turned),`${style} frame ${i}`).toBeGreaterThan(.004);
        expect(r.mine().whole,`${style} frame ${i}: whole in the frame`).toBe(true);
        expect(r.out(b)).toBeLessThanOrEqual(1.4+1e-6);
        step.subVectors(r.camera.position,last);last.copy(r.camera.position);
        if(!first)jump=Math.max(jump,step.distanceTo(was));was.copy(step);first=false;
      }
      expect(jump,`${style}: the biggest change of the lens's motion in a frame, metres`).toBeLessThan(.06);
    }
  });
  it('in fast, out slow: at the wall the lens is inside on the very frame, and stepping away it eases out over a second and more',()=>{
    const r=new Rig('classic',[0,0],[0,-4],OPEN);r.step(240);
    expect(r.rig.squeeze).toBe(0);
    let z=0,last=0;
    for(let i=0;i<200;i++){z=Math.min(OPEN.halfZ-.5,z+6.5/60);r.place(0,z);r.foe.group.position.set(0,0,z-4);r.step();expect(r.out(OPEN),`frame ${i}`).toBeLessThanOrEqual(-.25+1e-6);expect(r.rig.squeeze).toBeGreaterThanOrEqual(last-1e-9);last=r.rig.squeeze;}
    expect(last).toBeGreaterThan(.5);
    const far=new Rig('classic',[0,OPEN.halfZ-.5],[0,OPEN.halfZ-4.5],OPEN);far.step(240);
    const from=far.rig.squeeze;let z2=OPEN.halfZ-.5;
    for(let i=0;i<30;i++){z2-=6.5/60;far.place(0,z2);far.foe.group.position.set(0,0,z2-4);far.step();}
    expect(far.rig.squeeze).toBeGreaterThan(from*.5);
    for(let i=0;i<240;i++)far.step();
    expect(far.rig.squeeze).toBeLessThan(.02);
  });
  it('the Close style fades to Classic as the bound squeezes the rig, on a floor with room as on a small one, and comes back',()=>{
    const b=STAGES['valley-of-the-end'],r=new Rig('close',[0,0],[0,-4],b);r.step(240);
    expect(r.follow.styleBlend).toBeGreaterThan(.99);
    r.place(b.halfX-.5,0);r.foe.group.position.set(b.halfX-4.5,0,0);r.follow.cut();r.step(420);
    expect(r.rig.squeeze).toBeGreaterThan(.3);expect(r.follow.styleBlend).toBeLessThan(.05);
    const m=r.mine();expect(m.whole).toBe(true);expect(m.height).toBeGreaterThan(.3);expect(m.height).toBeLessThan(.62);
    let last=r.follow.styleBlend,step=0,x=b.halfX-.5;
    for(let i=0;i<720;i++){x=Math.max(0,x-6.5/60);r.place(x,0);r.foe.group.position.set(x-4,0,0);r.step();step=Math.max(step,Math.abs(r.follow.styleBlend-last));last=r.follow.styleBlend;}
    expect(r.follow.styleBlend).toBeGreaterThan(.99);expect(step,'the most the style moves in a frame').toBeLessThan(.03);
  });
  it('lock-on and free never squeeze, nor does a mode whose view is the squad\'s: their lens is the one it was',()=>{
    for(const mode of ['lockon','free'] as const){const r=new Rig('classic',[0,HALL.halfZ-.5],[0,HALL.halfZ-3.5],HALL);r.follow.mode=mode;r.step(240);expect(r.rig.squeeze,mode).toBe(0);}
    const squad=new Rig('classic',[0,HALL.halfZ-.5],[0,HALL.halfZ-3.5],HALL);squad.follow.battlefield=true;squad.step(240);expect(squad.rig.squeeze).toBe(0);
    const nullRealm=STAGES['null-realm'],arcade=new Rig('classic',[0,nullRealm.halfZ-.5],[0,nullRealm.halfZ-3.5],nullRealm);arcade.follow.battlefield=true;arcade.step(240);
    expect(arcade.out(nullRealm)).toBeLessThanOrEqual(-.25+1e-6);expect(arcade.rig.squeeze).toBe(0);
    const duel=new Rig('classic',[0,nullRealm.halfZ-.5],[0,nullRealm.halfZ-3.5],nullRealm);duel.step(240);expect(duel.out(nullRealm)).toBeGreaterThan(.5);
  });
});

describe('control: a wall never turns a held direction',()=>{
  it('the same run with and without the stage\'s bounds: the view and the heading the keys are read against are the same, frame for frame',()=>{
    for(const style of ['close','classic'] as const){
      const walled=new Rig(style,[5.6,-5],[-3,0],HALL),open=new Rig(style,[5.6,-5],[-3,0]);
      for(const r of [walled,open])r.step(180);
      let squeezed=0,worstView=0,worstBasis=0;
      for(let i=0;i<300;i++){
        const z=Math.min(HALL.halfZ-.6,-5+i*6.5/60);
        for(const r of [walled,open]){r.follow.movementBasis(1);r.place(5.6,z);r.me.state.action='run';r.step();}
        squeezed=Math.max(squeezed,walled.rig.squeeze);
        worstView=Math.max(worstView,Math.abs(wrap(walled.follow.movementYaw-open.follow.movementYaw)));
        worstBasis=Math.max(worstBasis,Math.abs(wrap(walled.follow.movementBasis(1)-open.follow.movementBasis(1))));
      }
      expect(squeezed,`${style}: the wall did squeeze the lens`).toBeGreaterThan(.3);
      expect(worstView,`${style}: the view`).toBeLessThan(.06);expect(worstBasis,`${style}: the basis`).toBeLessThan(.06);
    }
  });
});
