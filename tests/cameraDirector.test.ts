import {describe,expect,it} from 'vitest';
import { AWAKENING_SWAP } from '../src/game/awakening';
import * as THREE from 'three';
import {FollowCamera} from '../src/render/FollowCamera';
import {sightClearance} from '../src/render/CameraDirector';
import type {Fighter} from '../src/render/Fighter';
import type {CombatEvent,PlayerState} from '../src/game/types';
import {MOVES,WHIFF_RECOVERY} from '../src/game/moves';


const state=(id:string,x=0,z=0):PlayerState=>({id,name:id,fighter:'zoro',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:100,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
const actor=(id:string,x=0,z=0)=>{const group=new THREE.Group();group.position.set(x,0,z);
  return {state:state(id,x,z),group,velocity:new THREE.Vector3()} as unknown as Fighter;};
const DEG=180/Math.PI;
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

type Frame={eye:THREE.Vector3;aim:THREE.Vector3;fov:number;movementYaw:number;inputYaw:number;weight:number};
function run(cinematics:boolean,frames:number,script:(i:number,rig:{follow:FollowCamera;me:Fighter;foe:Fighter;events:CombatEvent[]})=>void,occluders:THREE.Object3D[]=[],mode:'free'|'lockon'='lockon'){
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
  follow.mode=mode;follow.cinematics=cinematics;
  const me=actor('me'),foe=actor('foe',.6,3.2),rig={follow,me,foe,events:[] as CombatEvent[]};
  const bodies=new Map([['me',me],['foe',foe]]);
  let input=0;const out:Frame[]=[];
  for(let i=0;i<frames;i++){
    rig.events.length=0;script(i,rig);
    follow.director.handle(rig.events,'me',id=>bodies.get(id));
    follow.update(1/60,me,input,0,occluders,0,foe,false);input=follow.inputYaw;
    camera.updateMatrixWorld();
    out.push({eye:camera.position.clone(),aim:camera.getWorldDirection(new THREE.Vector3()),fov:camera.fov,movementYaw:follow.movementYaw,inputYaw:follow.inputYaw,weight:follow.director.weight});
  }
  return out;
}
const cast=(me:Fighter,i:number,at:number,action:'ultimate'|'awaken'='ultimate',duration=4.9)=>{
  const s=me.state;
  if(i<at){s.action='idle';return;}
  const elapsed=(i-at)/60;
  if(elapsed<duration){s.action=action;s.actionSeq=7;s.actionDuration=duration;s.actionTime=elapsed/duration;}else s.action='idle';
};
const worstStep=(frames:Frame[])=>{let eye=0,aim=0;for(let i=1;i<frames.length;i++){eye=Math.max(eye,frames[i].eye.distanceTo(frames[i-1].eye));aim=Math.max(aim,frames[i].aim.angleTo(frames[i-1].aim)*60*DEG);}return {eye,aim};};

type Beat={phase:string;weight:number;eye:THREE.Vector3;aim:THREE.Vector3;fov:number;movementYaw:number;inputYaw:number;myHead:THREE.Vector3;myChest:THREE.Vector3;foeChest:THREE.Vector3;foeHead:THREE.Vector3;foeFeet:THREE.Vector3;toMe:number;toFoe:number};
function sequence(cinematics:boolean,frames:number,script:(i:number,rig:{me:Fighter;foe:Fighter;events:CombatEvent[]})=>void){
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
  follow.mode='lockon';follow.cinematics=cinematics;
  const me=actor('me'),foe=actor('foe',.6,3.2),rig={me,foe,events:[] as CombatEvent[]},bodies=new Map([['me',me],['foe',foe]]);
  let input=0;const out:Beat[]=[];
  const at=(body:Fighter,up:number)=>body.group.position.clone().setY(body.group.position.y+up).project(camera);
  for(let i=0;i<frames;i++){
    rig.events.length=0;script(i,rig);
    follow.director.handle(rig.events,'me',id=>bodies.get(id));
    follow.update(1/60,me,input,0,[],0,foe,false);input=follow.inputYaw;camera.updateMatrixWorld();
    out.push({phase:follow.director.phase,weight:follow.director.weight,eye:camera.position.clone(),aim:camera.getWorldDirection(new THREE.Vector3()),fov:camera.fov,
      movementYaw:follow.movementYaw,inputYaw:follow.inputYaw,myHead:at(me,1.9),myChest:at(me,1.1),foeChest:at(foe,1.1),foeHead:at(foe,1.9),foeFeet:at(foe,0),
      toMe:camera.position.distanceTo(me.group.position),toFoe:camera.position.distanceTo(foe.group.position)});
  }
  return out;
}
const on=(p:THREE.Vector3)=>Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1;

const ZORO=MOVES.zoro.ultimate,OPEN=ZORO.contacts[0],FINISH=ZORO.contacts[ZORO.contacts.length-1];
const confirmAt=120+Math.round(OPEN*60),impactAt=120+Math.round(FINISH*60);
const confirmCast=(me:Fighter,i:number,landed:boolean)=>{
  const s=me.state,elapsed=(i-120)/60,end=landed?ZORO.duration:OPEN+WHIFF_RECOVERY;
  if(i<120||elapsed>=end){s.action='idle';s.confirmedAt=s.whiffedAt=undefined;return;}
  s.action='ultimate';s.actionSeq=7;s.actionDuration=ZORO.duration;s.actionTime=elapsed/ZORO.duration;
  if(i>=confirmAt){if(landed)s.confirmedAt=OPEN;else s.whiffedAt=OPEN;}
};
const confirmed=({hit=true,struck=true,landed=true}:{hit?:boolean;struck?:boolean;landed?:boolean}={})=>(i:number,rig:{me:Fighter;foe:Fighter;events:CombatEvent[]})=>{
  confirmCast(rig.me,i,landed);
  if(landed&&hit&&i===impactAt)rig.events.push({id:1,kind:'hit',serverTime:0,actorId:'me',targetId:'foe',slot:'ultimate',fighter:'zoro',damage:255,contactIndex:ZORO.contacts.length-1});
  if(landed&&hit&&struck&&i>impactAt){const k=Math.min(1,(i-impactAt)/36);rig.foe.group.position.set(.6+.6*k,0,3.2+5*(1-(1-k)**2));}
};
const flat=(from:THREE.Vector3,to:THREE.Vector3)=>Math.atan2(to.x-from.x,to.z-from.z);

describe('a hit-confirm ultimate: the opener pushed in, the cinematic on the confirm',()=>{
  it('watches the opener from the gameplay shot pushed in - no close-up - and leaves the keys alone',()=>{
    const beats=sequence(true,560,confirmed()),plain=sequence(false,560,confirmed()),me=new THREE.Vector3(0,0,0);
    expect(beats[121].phase,'from the cast frame').toBe('opener');expect(beats[121].weight).toBeGreaterThan(0);
    expect(beats.map(b=>b.phase),'no close-up').not.toContain('close');
    const opener=beats.map((b,i)=>({b,i})).filter(({b,i})=>i<confirmAt&&b.phase==='opener'&&b.weight===1);
    expect(opener.length/60,'pushed in before the opener is out').toBeGreaterThan(.15);
    for(const {b,i} of opener){
      expect(Math.abs(wrap(flat(me,b.eye)-flat(me,plain[i].eye))),'on the gameplay line').toBeLessThan(.02);
      expect(b.toMe,'pushed in').toBeLessThan(plain[i].toMe-.2);
      expect(b.fov).toBeCloseTo(plain[i].fov-4,6);
      expect(on(b.myChest)&&on(b.foeChest),'caster and victim both in the frame').toBe(true);
    }
    for(let i=0;i<560;i++){expect(beats[i].movementYaw).toBe(plain[i].movementYaw);expect(beats[i].inputYaw).toBe(plain[i].inputYaw);}
  });

  it('swings into the release shot on the confirm and holds it over the shoulder through the blows',()=>{
    const beats=sequence(true,560,confirmed()),release=beats.filter(b=>b.phase==='release'&&b.weight===1);
    expect(['swing','release'],'the cinematic, on the confirm').toContain(beats[confirmAt+1].phase);
    expect(release.length/60,'the release shot, to the finisher').toBeGreaterThan(.5);
    expect(beats[impactAt-1].phase).toBe('release');expect(beats[impactAt-1].weight).toBe(1);
    for(const b of release){
      expect(b.eye.z,'behind the caster').toBeLessThan(0);
      expect(on(b.myHead)&&on(b.myChest)&&on(b.foeChest)&&on(b.foeHead)&&on(b.foeFeet),'caster and victim both in the frame').toBe(true);
      expect(Math.abs(b.foeChest.x-b.myChest.x)).toBeGreaterThan(.4);
      expect(b.myHead.y,'the caster\'s head under the health bars').toBeLessThan(.64);
      expect(b.foeFeet.y,'the victim\'s feet over the skill cards').toBeGreaterThan(-.5);
      expect(b.foeHead.y).toBeLessThan(.64);
    }
  });

  it('carries onto the victim at the finisher, follows them a beat, then hands back to the gameplay shot',()=>{
    const beats=sequence(true,560,confirmed()),plain=sequence(false,560,confirmed());
    const impact=beats.slice(impactAt).filter(b=>b.phase==='impact');
    expect(beats[impactAt].phase).toBe('impact');
    const held=impact.filter(b=>b.weight===1&&Math.abs(b.foeChest.x)<.2&&Math.abs(b.foeChest.y)<.4&&b.toFoe<b.toMe);
    expect(held.length/60).toBeGreaterThanOrEqual(.3);
    for(const b of impact)expect(on(b.foeChest),'the victim never leaves the frame').toBe(true);
    const back=beats.findIndex((b,i)=>i>impactAt&&b.phase==='none');
    expect(back).toBeGreaterThan(impactAt);expect((back-impactAt)/60).toBeLessThan(3);
    for(let i=back;i<560;i++)expect(beats[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);
    const {eye,aim}=worstStep(beats);
    expect(eye,'every change of shot is a move, not a cut').toBeLessThan(.45);
    expect(aim).toBeLessThan(450);
  });

  it('lets the push-in go at once on a whiff: no cinematic, the gameplay shot within OPENER_OUT',()=>{
    const beats=sequence(true,400,confirmed({landed:false})),plain=sequence(false,400,confirmed({landed:false}));
    for(const phase of ['close','swing','release','impact'])expect(beats.map(b=>b.phase),phase).not.toContain(phase);
    expect(beats[confirmAt-1].phase).toBe('opener');expect(beats[confirmAt-1].weight).toBe(1);
    const back=beats.findIndex((b,i)=>i>=confirmAt&&b.weight===0);
    expect((back-confirmAt)/60,'the quick return').toBeLessThan(.3);
    for(let i=back;i<400;i++){expect(beats[i].weight).toBe(0);expect(beats[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);}
    expect(worstStep(beats).eye).toBeLessThan(.45);expect(worstStep(beats).aim).toBeLessThan(450);
    for(let i=0;i<400;i++){expect(beats[i].movementYaw).toBe(plain[i].movementYaw);expect(beats[i].inputYaw).toBe(plain[i].inputYaw);}
  });

  it('hands back RELEASE_LINGER after the finisher when there is no impact to carry to',()=>{
    const beats=sequence(true,560,confirmed({hit:false})),plain=sequence(false,560,confirmed({hit:false}));
    expect(beats[impactAt].phase).toBe('release');
    const back=beats.findIndex((b,i)=>i>120&&b.phase==='none');
    expect((back-impactAt)/60).toBeGreaterThan(.4);expect((back-impactAt)/60).toBeLessThan(2);
    for(let i=back;i<560;i++)expect(beats[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);
    expect(worstStep(beats).eye).toBeLessThan(.45);expect(worstStep(beats).aim).toBeLessThan(450);
  });

  it('lets the push-in go on a hit on the player in the opener, and still plays the cinematic the armoured move lands',()=>{
    const at=135,beats=sequence(true,560,(i,rig)=>{confirmed()(i,rig);for(const e of rig.events)e.id+=10;if(i===at)rig.events.push({id:9,kind:'hit',serverTime:0,actorId:'foe',targetId:'me',damage:40});});
    expect(beats[at-1].weight).toBeGreaterThan(.9);
    expect(beats[at+1].phase).toBe('opener');expect(beats[at+6].weight,'letting go').toBeLessThan(beats[at-1].weight-.2);
    expect(['swing','release']).toContain(beats[confirmAt+1].phase);
    expect(beats[impactAt].phase).toBe('impact');
    expect(worstStep(beats).eye).toBeLessThan(.45);expect(worstStep(beats).aim).toBeLessThan(450);
  });

  it('is cancelled by a hit on the player in the cinematic\'s shots, without a cut',()=>{
    for(const at of [confirmAt+50,impactAt+20]){
      const beats=sequence(true,560,(i,rig)=>{confirmed()(i,rig);if(i===at)rig.events.push({id:9,kind:'hit',serverTime:0,actorId:'foe',targetId:'me',damage:40});});
      expect(beats[at-1].weight,`on screen before the hit at ${at}`).toBeGreaterThan(.9);
      const gone=beats.findIndex((b,i)=>i>=at&&b.weight===0);
      expect((gone-at)/60,`gone after the hit at ${at}`).toBeLessThan(1.5);
      for(let i=gone;i<560;i++)expect(beats[i].phase).toBe('none');
      expect(worstStep(beats).eye).toBeLessThan(.45);expect(worstStep(beats).aim).toBeLessThan(450);
    }
  });
});

describe('an area ultimate is three shots',()=>{
  const SPIRIT=MOVES.goku.ultimate,release=SPIRIT.contacts[0],lands=120+Math.round((release+3.25/(SPIRIT.speed??22))*60);
  const bomb=(hit:boolean)=>(i:number,rig:{me:Fighter;foe:Fighter;events:CombatEvent[]})=>{
    rig.me.state.fighter='goku';cast(rig.me,i,120,'ultimate',SPIRIT.duration);
    if(hit&&i===lands)rig.events.push({id:1,kind:'hit',serverTime:0,actorId:'me',targetId:'foe',slot:'ultimate',fighter:'goku',damage:285});
    if(hit&&i>lands){const k=Math.min(1,(i-lands)/36);rig.foe.group.position.set(.6+.6*k,0,3.2+5*(1-(1-k)**2));}
  };
  it('opens on the close-up of the charge, swings to the release, and carries onto the victim at the blast',()=>{
    const beats=sequence(true,480,bomb(true)),plain=sequence(false,480,bomb(true));
    expect(beats[121].phase).toBe('close');expect(beats[121].weight).toBeGreaterThan(0);
    const phases=beats.map(b=>b.phase),first=(p:string)=>phases.indexOf(p);
    expect(first('close')).toBeLessThan(first('release'));expect(first('release')).toBeLessThan(first('impact'));
    expect(beats.filter(b=>b.phase==='close'&&b.weight===1).length/60,'the close-up holds').toBeGreaterThanOrEqual(.3);
    expect(beats[lands].phase).toBe('impact');
    const back=beats.findIndex((b,i)=>i>lands&&b.phase==='none');
    expect((back-lands)/60).toBeLessThan(3);
    for(let i=back;i<480;i++)expect(beats[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);
    const {eye,aim}=worstStep(beats);expect(eye).toBeLessThan(.45);expect(aim).toBeLessThan(450);
    for(let i=0;i<480;i++){expect(beats[i].movementYaw).toBe(plain[i].movementYaw);expect(beats[i].inputYaw).toBe(plain[i].inputYaw);}
  });

  it('hands back RELEASE_LINGER after the bomb was due when it lands on nobody',()=>{
    const beats=sequence(true,480,bomb(false)),plain=sequence(false,480,bomb(false));
    const back=beats.findIndex((b,i)=>i>121&&b.phase==='none');
    expect((back-lands)/60).toBeGreaterThan(.2);expect((back-lands)/60).toBeLessThan(2);
    for(let i=back;i<480;i++)expect(beats[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);
  });
});

describe('the ultimate hero shot',()=>{
  const ultimate=(i:number,rig:{me:Fighter})=>{rig.me.state.fighter='goku';cast(rig.me,i,120,'ultimate',MOVES.goku.ultimate.duration);};

  it('never moves the keys: movementYaw and the input heading are the gameplay rig\'s',()=>{
    const shot=run(true,300,ultimate),plain=run(false,300,ultimate);
    for(let i=0;i<300;i++){expect(shot[i].movementYaw).toBe(plain[i].movementYaw);expect(shot[i].inputYaw).toBe(plain[i].inputYaw);}
  });

  it('ends early, without a cut, when the player is hit',()=>{
    const shot=run(true,300,(i,rig)=>{ultimate(i,rig);if(i===160)rig.events.push({id:1,kind:'hit',serverTime:0,actorId:'foe',targetId:'me',damage:40});});
    expect(shot[159].weight).toBeGreaterThan(.9);
    expect(shot[161].weight,'letting go at once').toBeLessThan(shot[159].weight);
    const gone=shot.findIndex((f,i)=>i>=160&&f.weight===0);
    expect((gone-160)/60,'gone within the hand-back').toBeLessThan(1.45);
    expect(worstStep(shot).eye).toBeLessThan(.45);expect(worstStep(shot).aim).toBeLessThan(450);
  });

  it('lets go when the player turns the view',()=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
    follow.mode='lockon';follow.cinematics=true;follow.director.localId='me';
    const me=actor('me'),foe=actor('foe',0,3);let input=0;me.state.fighter='goku';
    for(let i=0;i<200;i++){cast(me,i,60,'ultimate',MOVES.goku.ultimate.duration);if(i>=90&&i<95)input+=.02;follow.update(1/60,me,input,0,[],0,foe);input=follow.inputYaw;}
    expect(follow.director.kind).toBe('none');
  });

  it('stays out of the walls',()=>{
    const material=new THREE.MeshBasicMaterial(),wall=new THREE.Mesh(new THREE.BoxGeometry(12,12,1),material);
    wall.position.set(0,6,2.4);wall.updateMatrixWorld(true);
    const shot=run(true,300,ultimate,[wall]);
    for(const frame of shot.slice(121,200))expect(frame.eye.z,'lens inside the wall').toBeLessThan(1.9);
    expect(Math.max(...shot.map(f=>f.weight))).toBe(1);
    expect(worstStep(shot).eye).toBeLessThan(.6);
    material.dispose();wall.geometry.dispose();
  });
});

describe('a shot that starts with the gameplay lens behind a wall',()=>{
  it('takes over the frame gradually instead of snapping onto the wall',()=>{
    const material=new THREE.MeshBasicMaterial(),wall=new THREE.Mesh(new THREE.BoxGeometry(12,12,1),material);
    wall.position.set(0,6,-.9);wall.updateMatrixWorld(true);
    const ult=(i:number,rig:{me:Fighter;foe:Fighter;events:CombatEvent[]})=>confirmed()(i,rig);
    const shot=run(true,400,ult,[wall]),plain=run(false,400,ult,[wall]);
    expect(plain[119].eye.z,'the gameplay lens really is behind the wall').toBeLessThan(-1.4);
    for(let i=118;i<confirmAt;i++)expect(shot[i].weight,`no push-in through the wall, frame ${i}`).toBe(0);
    for(let i=confirmAt-2;i<confirmAt+3;i++)expect(shot[i].eye.distanceTo(plain[i].eye),`frame ${i}`).toBeLessThan(.1);
    expect(Math.max(...shot.map(f=>f.weight))).toBe(1);
    expect(worstStep(shot).eye).toBeLessThan(.45);
    material.dispose();wall.geometry.dispose();
  });
});

describe('the awakening, the KO and the round',()=>{
  it('orbits the transforming fighter and hands back after the entry',()=>{
    const shot=run(true,240,(i,rig)=>cast(rig.me,i,60,'awaken',.9)),plain=run(false,240,(i,rig)=>cast(rig.me,i,60,'awaken',.9));
    const az=(f:Frame)=>Math.atan2(f.eye.x,f.eye.z)*DEG;
    const swap=60+Math.round(AWAKENING_SWAP*60);
    expect(shot[swap-2].fov).toBeLessThan(plain[swap-2].fov-6);
    expect(shot[swap+3].fov).toBeGreaterThan(shot[swap-2].fov+3);
    expect(Math.abs(az(shot[60+54])-az(plain[60+54]))).toBeGreaterThan(15);
    expect(shot[60+54].eye.distanceTo(new THREE.Vector3(0,1.2,0))).toBeLessThan(plain[60+54].eye.distanceTo(new THREE.Vector3(0,1.2,0)));
    for(let i=60+92;i<240;i++)expect(shot[i].weight).toBe(0);
    expect(worstStep(shot).eye).toBeLessThan(.45);expect(worstStep(shot).aim).toBeLessThan(450);
    for(let i=0;i<240;i++)expect(shot[i].movementYaw).toBe(plain[i].movementYaw);
  });

  it('transforms from a clear bearing beside a wall, never pinned over the head (round 3e)',()=>{
    const material=new THREE.MeshBasicMaterial(),wall=new THREE.Mesh(new THREE.BoxGeometry(24,14,1),material);
    wall.position.set(0,7,-1);wall.updateMatrixWorld(true);
    const script=(i:number,rig:{me:Fighter})=>cast(rig.me,i,60,'awaken',.9);
    const shot=run(true,240,script,[wall]),plain=run(false,240,script,[wall]);
    const chest=new THREE.Vector3(0,1.2,0);
    expect(plain[59].eye.z,'the gameplay lens stands behind the wall').toBeLessThan(-.5);
    for(let i=60+30;i<60+54;i++){
      expect(shot[i].eye.distanceTo(chest),`frame ${i}: not pinned`).toBeGreaterThan(2);
      expect(shot[i].eye.z,`frame ${i}: on the room's side`).toBeGreaterThan(-.45);
    }
    const swap=60+Math.round(AWAKENING_SWAP*60);
    expect(shot[swap+3].fov).toBeGreaterThan(shot[swap-2].fov+2);
    expect(worstStep(shot).eye).toBeLessThan(.6);expect(worstStep(shot).aim).toBeLessThan(450);
    for(let i=0;i<240;i++)expect(shot[i].movementYaw).toBe(plain[i].movementYaw);
    material.dispose();wall.geometry.dispose();
  });

  it('pushes toward the victim of the player\'s KO, then eases back',()=>{
    const ko=(i:number,rig:{events:CombatEvent[]})=>{if(i===100)rig.events.push({id:5,kind:'eliminated',serverTime:0,actorId:'me',targetId:'foe'});};
    const shot=run(true,240,ko),plain=run(false,240,ko),victim=new THREE.Vector3(.6,.9,3.2);
    const closest=Math.min(...shot.slice(100,170).map(f=>f.eye.distanceTo(victim)));
    expect(closest).toBeLessThan(plain[130].eye.distanceTo(victim)*.8);
    for(let i=100+60;i<240;i++)expect(shot[i].weight).toBe(0);
    expect(worstStep(shot).eye).toBeLessThan(.4);
  });

  it('sweeps the countdown and lands on the gameplay shot as it ends',()=>{
    const intro=(i:number,rig:{follow:FollowCamera})=>{if(i===60)rig.follow.intro(3);};
    const shot=run(true,420,intro),plain=run(false,420,intro);
    expect(Math.max(...shot.map(f=>f.weight))).toBe(1);
    for(let i=60+180;i<420;i++){expect(shot[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);expect(shot[i].aim.angleTo(plain[i].aim)).toBeLessThan(1e-9);}
    expect(worstStep(shot).eye).toBeLessThan(.45);expect(worstStep(shot).aim).toBeLessThan(450);
  });

  it('can have the countdown cut short, and eases back rather than cutting',()=>{
    const shot=run(true,420,(i,rig)=>{if(i===60)rig.follow.intro(3);if(i===150)rig.follow.intro(0);}),plain=run(false,420,()=>{});
    expect(worstStep(shot).eye).toBeLessThan(.45);expect(worstStep(shot).aim).toBeLessThan(450);
    expect(shot[150+60].eye.distanceTo(plain[150+60].eye)).toBeLessThan(1e-9);
  });

  it('orbits the winner low, keeps them framed, stays inside the room and hands back',()=>{
    const material=new THREE.MeshBasicMaterial(),walls=[2.4,-2.4].map(x=>{
      const wall=new THREE.Mesh(new THREE.BoxGeometry(1,12,30),material);wall.position.set(x+Math.sign(x)*.5,6,3);wall.updateMatrixWorld(true);return wall;});
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);follow.cinematics=true;
    const me=actor('me'),winner=actor('foe',0,3);winner.group.rotation.y=Math.PI;
    for(let i=0;i<120;i++)follow.update(1/60,me,0,0,walls,0,winner,true);
    follow.victory(winner,4);
    let previous=camera.position.clone(),worst=0;
    for(let i=0;i<420;i++){
      follow.update(1/60,me,0,0,walls,0,winner,true);camera.updateMatrixWorld();
      worst=Math.max(worst,camera.position.distanceTo(previous));previous=camera.position.clone();
      expect(Math.abs(camera.position.x),'inside the room').toBeLessThan(2.4);
      if(follow.director.weight>.99){
        const chest=winner.group.position.clone().setY(1.1).project(camera);
        expect(Math.abs(chest.x)).toBeLessThan(.9);expect(Math.abs(chest.y)).toBeLessThan(.9);
        expect(camera.position.y,'low').toBeLessThan(1.1);
      }
      if(i===60)expect(follow.director.weight).toBe(1);
    }
    expect(worst).toBeLessThan(.6);
    expect(follow.director.weight,'handed back after the window').toBe(0);
    material.dispose();walls.forEach(w=>w.geometry.dispose());
  });

  it('films a winner facing a wall from the room, at the orbit\'s distance, not from a metre over their shoulder (the finale)',()=>{
    const material=new THREE.MeshBasicMaterial(),edge=new THREE.Mesh(new THREE.BoxGeometry(60,12,1),material);
    edge.position.set(0,6,3+1.2+.5);edge.updateMatrixWorld(true);
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);follow.cinematics=true;
    const me=actor('me',-3,0),winner=actor('foe',0,3);winner.group.rotation.y=0;
    for(let i=0;i<120;i++)follow.update(1/60,me,0,0,[edge],0,winner,true);
    follow.victory(winner,6);
    let previous=camera.position.clone(),worst=0,held=0;
    for(let i=0;i<300;i++){
      follow.update(1/60,me,0,0,[edge],0,winner,true);camera.updateMatrixWorld();
      worst=Math.max(worst,camera.position.distanceTo(previous));previous=camera.position.clone();
      expect(camera.position.z,'inside the ring').toBeLessThan(4.2);
      if(follow.director.weight>.99){
        held++;
        const flat=Math.hypot(camera.position.x-winner.group.position.x,camera.position.z-winner.group.position.z);
        expect(flat,'at the orbit\'s distance').toBeGreaterThan(3);
        const chest=winner.group.position.clone().setY(1.1).project(camera);
        expect(Math.abs(chest.x)).toBeLessThan(.9);expect(Math.abs(chest.y)).toBeLessThan(.9);
      }
    }
    expect(held).toBeGreaterThan(120);
    expect(worst).toBeLessThan(.6);
    material.dispose();edge.geometry.dispose();
  });

  it('does nothing at all with cinematics off',()=>{
    const script=(i:number,rig:{me:Fighter;follow:FollowCamera;events:CombatEvent[]})=>{cast(rig.me,i,40);if(i===10)rig.follow.intro(2);
      if(i===200)rig.events.push({id:9,kind:'eliminated',serverTime:0,actorId:'me',targetId:'foe'});};
    const free=run(false,300,script,[],'free');
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),bare=new FollowCamera(camera),me=actor('me'),foe=actor('foe',.6,3.2);
    for(let i=0;i<300;i++){cast(me,i,40);bare.update(1/60,me,0,0,[],0,foe,false);expect(free[i].eye.toArray()).toEqual(camera.position.toArray());expect(free[i].weight).toBe(0);}
  });

  it('carries a shot that starts over another instead of cutting to it',()=>{
    const shot=run(true,300,(i,rig)=>{if(i<120)cast(rig.me,i,60,'awaken',.9);else cast(rig.me,i,120);});
    expect(shot.slice(60,200).some(f=>f.weight===1)).toBe(true);
    expect(worstStep(shot).eye).toBeLessThan(.45);expect(worstStep(shot).aim).toBeLessThan(450);
  });
});

function crowded(frames:number,bodies:Fighter[],script:(i:number,follow:FollowCamera,events:CombatEvent[])=>void,{crowd=true,cinematics=true,pitch=0,look}:{crowd?:boolean;cinematics?:boolean;pitch?:number;look?:(i:number,camera:THREE.PerspectiveCamera,follow:FollowCamera)=>void}={}){
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
  follow.mode='lockon';follow.cinematics=cinematics;
  const [me,foe]=bodies,map=new Map(bodies.map(b=>[b.state.id,b]));if(crowd)follow.director.crowd=map;
  let input=0;const out:Frame[]=[];
  for(let i=0;i<frames;i++){
    const events:CombatEvent[]=[];script(i,follow,events);
    follow.director.handle(events,'me',id=>map.get(id));
    follow.update(1/60,me,input,pitch,[],0,foe,false);input=follow.inputYaw;camera.updateMatrixWorld();
    look?.(i,camera,follow);
    out.push({eye:camera.position.clone(),aim:camera.getWorldDirection(new THREE.Vector3()),fov:camera.fov,movementYaw:follow.movementYaw,inputYaw:follow.inputYaw,weight:follow.director.weight});
  }
  return out;
}
const sightMargin=(eye:THREE.Vector3,me:Fighter,others:Fighter[])=>{
  const p=me.group.position;let worst=Infinity;
  for(const at of [1.1,1.62])for(const o of others){const q=o.group.position;worst=Math.min(worst,sightClearance(eye,new THREE.Vector3(p.x,p.y+at,p.z),q.x,q.z,q.y+.42,q.y+1.43)-.42);}
  return worst;
};
const lensMargin=(eye:THREE.Vector3,bodies:Fighter[])=>{
  let worst=Infinity;
  for(const b of bodies){
    const p=b.group.position,alive=b.state.alive,y0=alive?p.y+.42:p.y+.3,y1=alive?p.y+1.43:p.y+.3,y=Math.min(Math.max(eye.y,y0),y1);
    worst=Math.min(worst,Math.hypot(eye.x-p.x,eye.y-y,eye.z-p.z)-(alive?.42:.9));
  }
  return worst;
};

describe('the hero shot keeps the caster in sight',()=>{
  it('swings to where the opponent is not in the way',()=>{
    const me=actor('me'),foe=actor('foe',-1.13,.65),script=(i:number)=>cast(me,i,120,'ultimate',MOVES.goku.ultimate.duration);me.state.fighter='goku';
    const now=crowded(300,[me,foe],script),before=crowded(300,[me,foe],script,{crowd:false}),plain=crowded(300,[me,foe],script,{cinematics:false});
    const hidden=(frames:Frame[])=>frames.filter(f=>f.weight>.5&&sightMargin(f.eye,me,[foe])<0).length;
    expect(hidden(before),'the old shot, through the opponent').toBeGreaterThan(20);
    expect(hidden(now)).toBe(0);
    expect(Math.max(...now.map(f=>f.weight))).toBe(1);
    const {eye,aim}=worstStep(now);expect(eye).toBeLessThan(.45);expect(aim).toBeLessThan(450);
    for(let i=0;i<300;i++){expect(now[i].movementYaw).toBe(plain[i].movementYaw);expect(now[i].inputYaw).toBe(plain[i].inputYaw);}
  });

  it('keeps them in sight while the clip turns the body toward the opponent',()=>{
    const me=actor('me'),foe=actor('foe',0,1.8);
    me.state.fighter='goku';
    const now=crowded(300,[me,foe],i=>{cast(me,i,120,'ultimate',MOVES.goku.ultimate.duration);me.group.rotation.y=1.6*THREE.MathUtils.clamp((i-120)/60,0,1);});
    expect(now.filter(f=>f.weight>.5&&sightMargin(f.eye,me,[foe])<0).length).toBe(0);
    expect(Math.max(...now.map(f=>f.weight))).toBe(1);
    const {eye,aim}=worstStep(now);expect(eye).toBeLessThan(.45);expect(aim).toBeLessThan(450);
  });

  it('is not taken at all when every side is blocked, leaving the gameplay shot untouched',()=>{
    const me=actor('me'),ring=Array.from({length:8},(_,k)=>actor(`ring${k}`,Math.sin(k*Math.PI/4)*1.1,Math.cos(k*Math.PI/4)*1.1));
    me.state.fighter='goku';const script=(i:number)=>cast(me,i,120,'ultimate',MOVES.goku.ultimate.duration);
    const now=crowded(300,[me,...ring],script),plain=crowded(300,[me,...ring],script,{cinematics:false});
    for(let i=0;i<300;i++){expect(now[i].weight).toBe(0);expect(now[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);}
  });
});

describe('an ultimate charged overhead is framed with its charge',()=>{
  it('holds Goku and the Spirit Bomb in the frame, craning back as it grows, then the bomb with the victim',()=>{
    const me=actor('me'),foe=actor('foe',.6,3.2);me.state.fighter='goku';foe.state.fighter='jotaro';
    const SPIRIT=MOVES.goku.ultimate,at=SPIRIT.contacts[0],release=120+Math.round(at*60),script=(i:number)=>cast(me,i,120,'ultimate',SPIRIT.duration),reach:number[]=[];let close=0,held=0;
    const now=crowded(560,[me,foe],script,{look:(i,camera,follow)=>{
      if(follow.director.weight<1)return;
      const radius=2.3*(.14+.86*Math.min(1,(i-120)/60/at)**.8),phase=follow.director.phase;
      const points=phase==='close'?[[.04,'feet'],[1.75,'head'],[4.65,'the charge'],[4.65+.85*radius,'the top of the charge']] as const:phase==='release'?[[1.75,'head'],[4.65,'the charge']] as const:[];
      for(const [y,what] of points){
        const p=new THREE.Vector3(0,y,0).project(camera);
        expect(Math.abs(p.y),`${what} (${phase})`).toBeLessThan(.95);expect(Math.abs(p.x),what).toBeLessThan(.95);
      }
      if(phase==='close'){close++;reach.push(camera.position.distanceTo(new THREE.Vector3(0,1.1,0)));}
      if(phase==='release'){held++;const v=new THREE.Vector3(.6,1.1,3.2).project(camera);expect(Math.abs(v.x),'the victim').toBeLessThan(.95);expect(Math.abs(v.y),'the victim').toBeLessThan(.95);}
    }});
    const plain=crowded(560,[me,foe],script,{cinematics:false});
    expect(close/60,'the close-up').toBeGreaterThanOrEqual(.3);
    expect(held/60,'the release shot, to the release and on').toBeGreaterThan(.3);
    expect(reach[reach.length-1],'standing back as the charge grows').toBeGreaterThan(reach[0]+.2);
    expect(now[release-30].weight,'on the charge half a second before the release').toBe(1);
    const back=now.findIndex((f,i)=>i>release&&f.weight===0);
    expect(back).toBeGreaterThan(release);
    for(let i=back;i<560;i++){expect(now[i].weight).toBe(0);expect(now[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);}
    const {eye,aim}=worstStep(now);expect(eye).toBeLessThan(.45);expect(aim).toBeLessThan(450);
    for(let i=0;i<560;i++)expect(now[i].movementYaw).toBe(plain[i].movementYaw);
  });

  it('frames Ace\'s sun the same way',()=>{
    const me=actor('me'),foe=actor('foe',.6,3.2);me.state.fighter='ace';let close=0,held=0;
    const SUN=MOVES.ace.ultimate,at=SUN.contacts[0];
    crowded(460,[me,foe],i=>cast(me,i,120,'ultimate',SUN.duration),{look:(i,camera,follow)=>{
      if(follow.director.weight<1)return;
      const radius=2.2*(.12+.88*Math.min(1,(i-120)/60/at)**.7),phase=follow.director.phase;
      if(phase==='close'){close++;for(const y of [.04,3.6,3.6+.85*radius])expect(Math.abs(new THREE.Vector3(0,y,0).project(camera).y)).toBeLessThan(.95);}
      if(phase==='release'){held++;for(const y of [1.75,3.6])expect(Math.abs(new THREE.Vector3(0,y,0).project(camera).y)).toBeLessThan(.95);}
    }});
    expect(close/60).toBeGreaterThanOrEqual(.2);expect(held/60).toBeGreaterThan(.3);
  });

  it('never takes the close-up for an ultimate thrown from the hands or the blade: those are hit-confirm, and open on the push-in',()=>{
    for(const fighter of ['zoro','vegeta','luffy','law'] as const){
      const me=actor('me'),foe=actor('foe',.6,3.2);me.state.fighter=fighter;const phases=new Set<string>();
      crowded(300,[me,foe],i=>cast(me,i,120,'ultimate',MOVES[fighter].ultimate.duration),{look:(_i,_camera,follow)=>{if(follow.director.weight>0)phases.add(follow.director.phase);}});
      expect([...phases],fighter).toContain('opener');expect([...phases],fighter).not.toContain('close');
    }
  });
});

describe('no shot films from inside a body',()=>{
  it('sweeps the countdown round the side the opponent is not standing on',()=>{
    const me=actor('me'),foe=actor('foe',0,4.5),script=(i:number,follow:FollowCamera)=>{if(i===30)follow.intro(3.5);};
    const now=crowded(420,[me,foe],script),before=crowded(420,[me,foe],script,{crowd:false}),plain=crowded(420,[me,foe],script,{cinematics:false});
    const inside=(frames:Frame[])=>Math.min(...frames.filter(f=>f.weight>0).map(f=>lensMargin(f.eye,[me,foe])));
    expect(inside(before),'the old sweep, through the opponent').toBeLessThan(0);
    expect(inside(now)).toBeGreaterThan(.2);
    for(let i=30+210;i<420;i++)expect(now[i].eye.distanceTo(plain[i].eye)).toBeLessThan(1e-9);
    const {eye,aim}=worstStep(now);expect(eye).toBeLessThan(.45);expect(aim).toBeLessThan(450);
  });

  it('orbits the winner round the side nobody is standing on, and over a body lying in the way',()=>{
    const victory=(i:number,follow:FollowCamera,me:Fighter)=>{if(i===100)follow.victory(me,6);};
    for(const [x,z,down] of [[-2.3,2.7,false],[-3.3,.8,true]] as const){
      const me=actor('me'),other=actor('other',x,z);other.state.alive=!down;
      const now=crowded(520,[me,other],(i,f)=>victory(i,f,me)),before=crowded(520,[me,other],(i,f)=>victory(i,f,me),{crowd:false});
      const inside=(frames:Frame[])=>Math.min(...frames.filter(f=>f.weight>0).map(f=>lensMargin(f.eye,[me,other])));
      expect(inside(before),`the old orbit, through the ${down?'body':'bystander'}`).toBeLessThan(0);
      expect(inside(now)).toBeGreaterThan(0);
      expect(Math.max(...now.map(f=>f.weight))).toBe(1);
      const {eye,aim}=worstStep(now);expect(eye).toBeLessThan(.45);expect(aim).toBeLessThan(450);
    }
  });

  it('stops the KO push short of anybody standing on the line to the victim',()=>{
    const ko=(i:number,events:CombatEvent[],victim:Fighter)=>{if(i===100){events.push({id:5,kind:'eliminated',serverTime:0,actorId:'me',targetId:'foe'});victim.state.alive=false;}};
    const me0=actor('me'),foe0=actor('foe',0,5),alone=crowded(200,[me0,foe0],(i,_f,e)=>ko(i,e,foe0),{pitch:-.25});
    const end=alone.reduce((a,b)=>b.weight>a.weight?b:a).eye;
    const run=(crowd:boolean)=>{const me=actor('me'),foe=actor('foe',0,5),by=actor('by',end.x,end.z);return {me,foe,by,frames:crowded(200,[me,foe,by],(i,_f,e)=>ko(i,e,foe),{crowd,pitch:-.25})};};
    const now=run(true),before=run(false);
    const inside=(r:ReturnType<typeof run>)=>Math.min(...r.frames.filter(f=>f.weight>0).map(f=>lensMargin(f.eye,[r.by])));
    expect(inside(before),'the old push, into the bystander').toBeLessThan(0);
    expect(inside(now)).toBeGreaterThan(0);
    expect(worstStep(now.frames).eye).toBeLessThan(.6);
  });
});

describe('the victory shot holds the winner\'s raised hands (iteration fifteen)', () => {
  it('widens only as far as the head and both hands need, between its own field and the cap', async () => {
    const { CameraDirector } = await import('../src/render/CameraDirector');
    const THREE = await import('three');
    const director = new CameraDirector() as unknown as { victoryField(body: unknown, eye: InstanceType<typeof THREE.Vector3>, look: InstanceType<typeof THREE.Vector3>): number };
    const joints = new Map<string, InstanceType<typeof THREE.Object3D>>();
    for (const [name, y, x] of [['Head', 1.6, 0], ['LeftHand', 2.25, .15], ['RightHand', 1, -.35]] as const) { const o = new THREE.Object3D(); o.position.set(x, y, 0); o.updateMatrixWorld(); joints.set(name, o); }
    const body = { joints, state: { fighter: 'goku', awakened: false }, group: new THREE.Group() };
    const look = new THREE.Vector3(0, 1.3, 0);
    expect(director.victoryField(body, new THREE.Vector3(0, .75, 3.6), look)).toBe(44);
    const close = director.victoryField(body, new THREE.Vector3(0, .75, 1.5), look);
    expect(close).toBeGreaterThan(50);
    expect(close).toBeLessThanOrEqual(66);
  });
});
