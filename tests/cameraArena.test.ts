import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera} from '../src/render/FollowCamera';
import {STAGES} from '../src/game/stages';
import {CAMERA_OPTIONS} from '../src/ui/HomePanels';
import type {CameraMode,CameraStyle} from '../src/config';
import type {Fighter} from '../src/render/Fighter';
import type {PlayerState} from '../src/game/types';


const state=(id:string,x=0,z=0,over:Partial<PlayerState>={}):PlayerState=>({id,name:id,fighter:'goku',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0},...over});
const actor=(id:string,x=0,z=0,over:Partial<PlayerState>={})=>{const group=new THREE.Group();group.position.set(x,0,z);
  return {state:state(id,x,z,over),group,velocity:new THREE.Vector3()} as unknown as Fighter;};
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a)),DEG=180/Math.PI;
type Bounds={halfX:number;halfZ:number;doubleSided?:boolean;background?:number;id?:string};
type RigState={squeeze:number;edge:number;arena:number;hold:number;own:number;away:number;side:number;fov:number};
class Rig{
  camera=new THREE.PerspectiveCamera(50,16/9,.1,200);follow=new FollowCamera(this.camera);
  me:Fighter;foe:Fighter;yaw:number;
  constructor(me:[number,number],foe:[number,number],bounds?:Bounds,mode:CameraMode='arena',style:CameraStyle='close'){
    this.follow.mode=mode;this.follow.style=style;this.follow.stageBounds=bounds;this.follow.sole=true;
    this.me=actor('me',me[0],me[1],{target:'foe'});this.foe=actor('foe',foe[0],foe[1]);this.yaw=Math.atan2(foe[0]-me[0],foe[1]-me[1]);
  }
  step(frames=1,turn=0,each?:(frame:number)=>void,foe:Fighter|null=this.foe){
    for(let i=0;i<frames;i++){each?.(i);this.yaw+=turn;this.follow.update(1/60,this.me,this.yaw,.02,[],.5,foe??undefined,false);this.yaw=this.follow.inputYaw;}
    this.camera.updateMatrixWorld();
  }
  put(body:Fighter,x:number,z:number){body.group.position.set(x,0,z);body.state.x=x;body.state.z=z;}
  get rig(){return this.camera.userData.rig as RigState;}
  get line(){const a=this.me.group.position,b=this.foe.group.position;return Math.atan2(b.x-a.x,b.z-a.z);}
  seen(body:Fighter){const p=body.group.position,at=(up:number)=>p.clone().setY(p.y+up).project(this.camera),low=at(0),mid=at(1),top=at(1.83);
    return {x:.5+mid.x/2,top:.5-top.y/2,feet:.5-low.y/2,tall:(top.y-low.y)/2,inside:[low,mid,top].every(v=>v.z<1&&Math.abs(v.x)<=1&&Math.abs(v.y)<=1)};}
  lens(){const c=this.camera.position,p=this.me.group.position,aim=this.camera.getWorldDirection(new THREE.Vector3());
    return {away:Math.hypot(c.x-p.x,c.z-p.z),up:c.y-p.y,down:-Math.asin(aim.y)*DEG,yaw:Math.atan2(aim.x,aim.z)};}
  out(b:Bounds){const p=this.camera.position;return Math.max(Math.abs(p.x)-b.halfX,Math.abs(p.z)-b.halfZ);}
}
const HALL=STAGES['chunin-exam-room'],RING=STAGES['martial-arts-tournament'],KAMI=STAGES['kami-lookout'];
const W=1,A=2;

describe('the frame: what was read off Sparking! Zero and Jump Force',()=>{
  it('standing apart: half the frame tall, a quarter to a third in from the side, from the crown looking down; the opponent across the middle',()=>{
    for(const style of ['close','classic'] as const){
      const r=new Rig([0,3],[0,-3],undefined,'arena',style);r.step(240);
      const me=r.seen(r.me),foe=r.seen(r.foe),lens=r.lens();
      if(style==='close'){expect(me.tall).toBeGreaterThan(.46);expect(me.tall).toBeLessThan(.53);}
      else{expect(me.tall).toBeGreaterThan(.40);expect(me.tall).toBeLessThan(.47);}
      expect(me.x).toBeGreaterThan(.25);expect(me.x).toBeLessThan(.36);
      expect(me.top).toBeGreaterThan(.26);expect(me.top).toBeLessThan(.40);expect(me.feet).toBeGreaterThan(.76);expect(me.feet).toBeLessThan(.86);
      expect(foe.x).toBeGreaterThan(.56);expect(foe.x).toBeLessThan(.70);expect(me.inside&&foe.inside).toBe(true);
      expect(lens.up).toBeGreaterThan(1.7);expect(lens.up).toBeLessThan(2.3);expect(lens.down).toBeGreaterThan(7);expect(lens.down).toBeLessThan(13);
      expect(r.camera.fov).toBeCloseTo(50,1);
    }
  });
  it('the Close style there is the nearer of the two, not the Close lens (42 degrees from chest height)',()=>{
    const close=new Rig([0,3],[0,-3]),classic=new Rig([0,3],[0,-3],undefined,'arena','classic');close.step(240);classic.step(240);
    expect(close.seen(close.me).tall).toBeGreaterThan(classic.seen(classic.me).tall+.03);
    expect(close.camera.fov).toBeCloseTo(classic.camera.fov,3);expect(close.lens().up).toBeGreaterThan(1.7);
  });
  it('at arm\'s length the pair is what the frame is centred on, from higher up, both whole',()=>{
    const r=new Rig([0,.65],[0,-.65]);r.step(300);
    const me=r.seen(r.me),foe=r.seen(r.foe),lens=r.lens();
    expect((me.x+foe.x)/2).toBeGreaterThan(.42);expect((me.x+foe.x)/2).toBeLessThan(.58);
    expect(me.tall).toBeGreaterThan(.34);expect(me.tall).toBeLessThan(.47);expect(me.inside&&foe.inside).toBe(true);
    expect(lens.up).toBeGreaterThan(2.1);expect(lens.down).toBeGreaterThan(11);expect(lens.down).toBeLessThan(19);
  });
  it('an opponent far off does not shrink the player to hold them',()=>{
    const r=new Rig([0,15],[0,-15]);r.step(300);
    expect(r.seen(r.me).tall).toBeGreaterThan(.40);expect(r.seen(r.foe).inside).toBe(true);
  });
});

describe('the hold: the opponent stays in the frame',()=>{
  it('the only opponent there is, is held at any distance; one of several only while near enough to be the fight',()=>{
    const sole=new Rig([0,25],[0,-25],KAMI);sole.step(120);
    expect(sole.rig.hold).toBeCloseTo(1,3);expect(sole.seen(sole.foe).inside).toBe(true);
    const one=new Rig([0,25],[0,-25],KAMI);one.follow.sole=false;one.step(120);
    expect(one.rig.hold).toBe(0);
  });
  it('at range the composition follows the line: a circling pair is held where it was put',()=>{
    const r=new Rig([0,3],[0,-3]);r.step(180);
    const at=r.seen(r.foe).x;let worst=0;
    r.step(240,0,i=>{const a=Math.PI+(i+1)/60*Math.PI/3;r.put(r.foe,Math.sin(a)*6,3+Math.cos(a)*6);const x=r.seen(r.foe).x;if(i>30)worst=Math.max(worst,Math.abs(x-at));});
    expect(worst).toBeLessThan(.09);expect(r.seen(r.me).inside).toBe(true);
  });
  it('at arm\'s length the lens rests while the opponent moves about in the frame',()=>{
    const swung=(size:number)=>{
      const r=new Rig([0,.65],[0,-.65]);r.step(300);
      let turned=0,fight=0,last=r.lens().yaw,line=r.line,out=0;
      r.step(240,0,i=>{const a=Math.PI+Math.sin((i+1)/60*2.1/size)*size;r.put(r.foe,Math.sin(a)*1.3,.65+Math.cos(a)*1.3);
        const yaw=r.lens().yaw;turned+=Math.abs(wrap(yaw-last));last=yaw;fight+=Math.abs(wrap(r.line-line));line=r.line;if(!r.seen(r.foe).inside)out++;});
      return {turned:turned*DEG,fight:fight*DEG,out};
    };
    const inside=swung(.28);
    expect(inside.fight).toBeGreaterThan(250);expect(inside.turned).toBeLessThan(2);expect(inside.out).toBe(0);
    const past=swung(.7);
    expect(past.fight).toBeGreaterThan(250);expect(past.turned).toBeLessThan(past.fight*.5);expect(past.out).toBe(0);
  });
  it('an opponent who is suddenly behind is back in the frame within half a second, and the turn is never a whip',()=>{
    const r=new Rig([0,3],[0,-3]);r.step(180);
    r.put(r.foe,0,9);
    let seenAt=-1,fastest=0,last=r.lens().yaw;
    r.step(90,0,i=>{const yaw=r.lens().yaw;fastest=Math.max(fastest,Math.abs(wrap(yaw-last))*60);last=yaw;if(seenAt<0&&r.seen(r.foe).inside)seenAt=i;});
    expect(seenAt).toBeGreaterThanOrEqual(0);expect(seenAt).toBeLessThan(36);expect(fastest*DEG).toBeLessThan(400);
  });
});

describe('the control: the keys and the aim are read against the line to the opponent held',()=>{
  it('W is at the opponent - exactly - wherever the lens stands, and so is what the simulation aims by',()=>{
    for(const [me,foe] of [[[0,3],[0,-3]],[[0,.65],[0,-.65]],[[4,-2],[-5,6]]] as [[number,number],[number,number]][]){
      const r=new Rig(me,foe);r.step(240);
      expect(Math.abs(wrap(r.follow.movementYaw-r.line))*DEG).toBeGreaterThan(15);
      expect(Math.abs(wrap(r.follow.movementBasis(W)-r.line))).toBeLessThan(1e-6);
      expect(Math.abs(wrap(r.follow.aimYaw-r.line))).toBeLessThan(1e-6);
    }
  });
  it('a direction held circles or closes with the opponent: the basis follows the line, not the lens',()=>{
    const r=new Rig([0,.65],[0,-.65]);r.step(300);r.follow.movementBasis(A);
    r.step(120,0,i=>{const a=Math.PI+(i+1)/60;r.put(r.foe,Math.sin(a)*1.3,.65+Math.cos(a)*1.3);r.follow.movementBasis(A);});
    expect(Math.abs(wrap(r.follow.movementBasis(A)-r.line))).toBeLessThan(.05);
  });
  it('the player\'s own turn of the view steers the run and the aim, one for one',()=>{
    const r=new Rig([0,3],[0,-3]);r.step(240);r.follow.movementBasis(W);
    r.step(30,.01,()=>{r.follow.movementBasis(W);});
    expect(wrap(r.follow.movementBasis(W)-r.line)).toBeCloseTo(.3,2);expect(wrap(r.follow.aimYaw-r.line)).toBeCloseTo(.3,2);
  });
  it('and the camera coming back to its composition afterwards does not: a run in progress keeps its direction',()=>{
    const r=new Rig([0,3],[0,-3]);r.step(240);r.follow.movementBasis(W);
    r.step(30,.01,()=>{r.follow.movementBasis(W);});
    const held=r.follow.movementBasis(W),looked=r.lens().yaw;
    r.step(300,0,()=>{r.follow.movementBasis(W);});
    expect(Math.abs(wrap(r.lens().yaw-looked))).toBeGreaterThan(.25);expect(Math.abs(r.rig.away)).toBeLessThan(.01);
    expect(Math.abs(wrap(r.follow.movementBasis(W)-held))).toBeLessThan(1e-6);
    r.follow.movementBasis(0);expect(Math.abs(wrap(r.follow.movementBasis(W)-r.line))).toBeLessThan(.01);
  });
  it('a hand resting on the mouse is not a look away: the hold keeps following, and W is still at the opponent',()=>{
    const r=new Rig([0,3],[0,-3]);r.step(180);
    const at=r.seen(r.foe).x;
    r.step(240,0,i=>{r.yaw+=Math.sin(i*.9)*.0006;const a=Math.PI+(i+1)/60*Math.PI/3;r.put(r.foe,Math.sin(a)*6,3+Math.cos(a)*6);});
    expect(Math.abs(r.seen(r.foe).x-at)).toBeLessThan(.1);expect(Math.abs(r.rig.away)).toBeLessThan(.02);
    expect(Math.abs(wrap(r.follow.movementBasis(W)-r.line))).toBeLessThan(.02);
  });
  it('a change of who is held does not bend a run already in progress; a new press is against the new one',()=>{
    const r=new Rig([0,3],[0,-3]);r.follow.sole=false;const other=actor('other',6,3);r.step(240);r.follow.movementBasis(W);
    const held=r.follow.movementBasis(W);
    r.step(90,0,()=>{r.follow.movementBasis(W);},other);
    expect(Math.abs(wrap(r.follow.movementBasis(W)-held))).toBeLessThan(1e-6);
    r.follow.movementBasis(0);expect(Math.abs(wrap(r.follow.movementBasis(W)-Math.PI/2))).toBeLessThan(.02);
  });
  it('with nobody held the keys are read against the view, as they always were',()=>{
    const r=new Rig([0,3],[0,-3]);r.step(120,0,undefined,null);
    expect(r.rig.hold).toBe(0);expect(r.follow.movementBasis(W)).toBeCloseTo(r.follow.movementYaw,9);expect(r.follow.aimYaw).toBeCloseTo(r.follow.movementYaw,9);
  });
});

describe('the wall: the lens turns along it, and never looks down from above',()=>{
  it('back to a wall with the opponent across the room: turned along it, as far and as high as it was',()=>{
    for(const stage of [HALL,RING,KAMI]){
      const z=stage.halfZ-.6,r=new Rig([0,z],[0,z-4],stage);r.step(300);
      const me=r.seen(r.me),foe=r.seen(r.foe),lens=r.lens();
      expect(me.inside&&foe.inside).toBe(true);expect(me.tall).toBeGreaterThan(.42);expect(me.tall).toBeLessThan(.6);
      expect(lens.down).toBeLessThan(14);expect(lens.up).toBeLessThan(2.4);expect(r.camera.fov).toBeLessThan(54);
      expect(Math.abs(r.rig.own)*DEG).toBeGreaterThan(35);expect(r.rig.squeeze).toBeLessThan(.05);expect(r.out(stage)).toBeLessThan(1.45);
    }
  });
  it('in a corner: the shot is from the side of both, whole, at a fighter\'s height',()=>{
    for(const stage of [HALL,RING,KAMI]){
      const x=stage.halfX-.7,z=stage.halfZ-.7,r=new Rig([x,z],[x-2.8,z-2.8],stage);r.step(360);
      const me=r.seen(r.me),foe=r.seen(r.foe),lens=r.lens();
      expect(me.inside&&foe.inside).toBe(true);expect(me.tall).toBeGreaterThan(.36);expect(me.tall).toBeLessThan(.62);expect(foe.tall).toBeGreaterThan(.3);
      expect(lens.down).toBeLessThan(22);expect(lens.up).toBeLessThan(2.7);expect(r.camera.fov).toBeLessThan(57);
      expect(Math.abs(r.rig.own)*DEG).toBeGreaterThan(60);expect(r.out(stage)).toBeLessThan(1.45);
    }
  });
  it('a wall never turns a direction held: the basis is the line to the opponent there too',()=>{
    const z=HALL.halfZ-.6,r=new Rig([0,z],[0,z-4],HALL);r.step(300);
    expect(Math.abs(wrap(r.follow.movementBasis(W)-r.line))).toBeLessThan(1e-6);
  });
});

describe('the rest',()=>{
  it('a cut is composed: the first frame has the opponent across the middle already, and nothing turns after it',()=>{
    const r=new Rig([0,3],[0,-3]);r.follow.lookAlong(r.yaw);r.step(1);
    const first=r.lens().yaw,foe=r.seen(r.foe);
    expect(foe.inside).toBe(true);expect(foe.x).toBeGreaterThan(.55);expect(foe.x).toBeLessThan(.72);
    r.step(180);expect(Math.abs(wrap(r.lens().yaw-first))*DEG).toBeLessThan(4);
  });
  it('is offered in both menus beside the default, Dynamic, which alone is marked recommended (the owner, 13 October 2026)',()=>{
    expect(CAMERA_OPTIONS.map(o=>o[1])).toEqual(['Dynamic','Stable','Arena','Lock-on','Free']);
    expect(CAMERA_OPTIONS.map(o=>o[0])).toEqual(['dynamic','smart','arena','lockon','free']);expect(CAMERA_OPTIONS.map(o=>o[2])).toEqual(['Recommended','New',undefined,undefined,undefined]);
  });
  it('where the view is the squad\'s it is the dynamic camera, and in every other mode none of it is on',()=>{
    const squad=new Rig([0,3],[0,-3]);squad.follow.battlefield=true;squad.step(120);
    expect(squad.rig.arena).toBe(0);expect(squad.follow.aimYaw).toBeCloseTo(squad.follow.movementYaw,9);
    for(const mode of ['dynamic','lockon','free'] as const){
      const r=new Rig([0,3],[0,-3],undefined,mode);r.step(120);
      expect(r.rig.arena).toBe(0);expect(r.rig.hold).toBe(0);expect(r.follow.aimYaw).toBeCloseTo(r.follow.movementYaw,9);
      if(mode!=='dynamic')expect(r.follow.movementBasis(W)).toBeCloseTo(r.follow.movementYaw,9);
    }
  });
});
