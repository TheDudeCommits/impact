import {afterEach,describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera,SMALL_FLOOR,smallFloor} from '../src/render/FollowCamera';
import {CAMERA_STYLES,CAMERA_VERSION,loadSettings,type CameraStyle,type Settings} from '../src/config';
import {CLOSE_SHOT,CLOSE_STYLE,GHOST_CLEAR,GHOST_FADE,GHOST_GONE,closeStyleFov,closeStyleGoal,closeStyleRig,ghostLensFade,ghostScale} from '../src/render/closeStyle';
import {STAGES,type StageId} from '../src/game/stages';
import {AWAKENING_ENTRY} from '../src/game/awakening';
import {CAMERA_STYLE_OPTIONS,homeOptions} from '../src/ui/HomePanels';
import {pauseMenu} from '../src/ui/PauseMenu';
import type {Fighter} from '../src/render/Fighter';
import type {PlayerState} from '../src/game/types';


const state=(id:string,x=0,z=0,over:Partial<PlayerState>={}):PlayerState=>({id,name:id,fighter:'goku',x,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0},...over});
const actor=(id:string,x=0,z=0,over:Partial<PlayerState>={})=>{const group=new THREE.Group();group.position.set(x,0,z);
  return {state:state(id,x,z,over),group,velocity:new THREE.Vector3()} as unknown as Fighter;};
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));

describe('settings: Close is the default, and the choice is saved like the others',()=>{
  const store=new Map<string,string>();
  const stub={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);},clear:()=>store.clear()};
  const saved=(value:unknown)=>{store.clear();if(value!==undefined)store.set('rift-settings',JSON.stringify(value));(globalThis as {localStorage?:unknown}).localStorage=stub;return loadSettings();};
  afterEach(()=>{delete (globalThis as {localStorage?:unknown}).localStorage;});
  it('offers exactly Classic (the default, recommended) and Close',()=>{
    expect([...CAMERA_STYLES]).toEqual(['classic','close']);
    expect(CAMERA_STYLE_OPTIONS.map(o=>o[0])).toEqual(['classic','close']);expect(CAMERA_STYLE_OPTIONS.map(o=>o[1])).toEqual(['Classic','Close']);
    expect(CAMERA_STYLE_OPTIONS.map(o=>o[2])).toEqual(['Recommended',undefined]);
  });
  it('a fresh player, and a save from before the setting, get Classic - and the Dynamic camera',()=>{
    for(const s of [saved(undefined),saved({}),saved({volume:.4,cameraMode:'free'}),saved({cameraMode:'lockon'})]){expect(s.cameraStyle).toBe('classic');}
    expect(saved(undefined).cameraMode).toBe('dynamic');
    expect(saved({cameraMode:'free'}).cameraMode).toBe('free');
    expect(saved(undefined).cameraVersion).toBe(CAMERA_VERSION);
  });
  it('a save holding Close from before 13 October - the default of its day - moves to Classic once; chosen since, Close stays',()=>{
    for(const older of [undefined,1,2,3])expect(saved({cameraStyle:'close',cameraVersion:older}).cameraStyle).toBe('classic');
    expect(saved({cameraStyle:'close',cameraVersion:CAMERA_VERSION}).cameraStyle).toBe('close');
    const s=saved({cameraStyle:'close',cameraMode:'arena',cameraVersion:3});expect([s.cameraMode,s.cameraStyle]).toEqual(['dynamic','classic']);
    s.cameraStyle='close';s.cameraMode='arena';stub.setItem('rift-settings',JSON.stringify(s));
    const again=loadSettings();expect([again.cameraMode,again.cameraStyle]).toEqual(['arena','close']);
  });
  it('Classic, once chosen, survives a reload and leaves every other setting alone',()=>{
    const s=saved({cameraStyle:'classic',cameraMode:'free',cameraVersion:CAMERA_VERSION,volume:.3,lockStyle:'brackets'});
    expect(s.cameraStyle).toBe('classic');expect(s.cameraMode).toBe('free');expect(s.volume).toBe(.3);expect(s.lockStyle).toBe('brackets');
  });
  it('the preview\'s name for the style, sparking, is read as close (and, from an older save, moves to Classic with it)',()=>{
    expect(saved({cameraStyle:'sparking',cameraVersion:CAMERA_VERSION}).cameraStyle).toBe('close');
    expect(saved({cameraStyle:'sparking'}).cameraStyle).toBe('classic');
    expect(saved({cameraStyle:'sparking',cameraMode:'lockon',cameraVersion:CAMERA_VERSION}).cameraMode).toBe('lockon');
  });
  it('is persisted the way the menu persists it (the whole settings object, JSON, under rift-settings)',()=>{
    const s=saved(undefined);
    s.cameraStyle='classic';stub.setItem('rift-settings',JSON.stringify(s));
    expect(loadSettings().cameraStyle).toBe('classic');
    const back:Settings=loadSettings();back.cameraStyle='close';stub.setItem('rift-settings',JSON.stringify(back));
    expect(loadSettings().cameraStyle).toBe('close');
  });
  it('anything else saved under it is Classic',()=>{
    for(const bad of ['sideways','',null,3,true,{},'CLOSE','Classic'])for(const version of [undefined,CAMERA_VERSION])expect(saved({cameraStyle:bad,cameraVersion:version}).cameraStyle).toBe('classic');
  });
  it('is in both settings menus as "Camera style": Classic (recommended) and Close, the saved one selected, and no other name',()=>{
    for(const style of CAMERA_STYLES){
      const settings={...saved(undefined),cameraStyle:style};
      for(const [markup,hook] of [[homeOptions(settings),'data-home-setting="cameraStyle"'],[pauseMenu(settings),'data-setting="cameraStyle"']] as const){
        expect(markup).toContain(hook);expect(markup).toMatch(/Camera style/i);
        const block=markup.match(new RegExp(`<ink-select[^>]*${hook}[^>]*>([\\s\\S]*?)</ink-select>`))![1];
        const options=[...block.matchAll(/<option value="([a-z]+)"[^>]*>([^<]*)<\/option>/g)].map(m=>[m[1],m[2],/selected/.test(m[0])]);
        expect(options.map(o=>o.slice(0,2))).toEqual([['classic','Classic'],['close','Close']]);
        expect(options.filter(o=>o[2]).map(o=>o[0])).toEqual([style]);
        expect(block).toMatch(/<option value="classic" data-tag="Recommended"/);expect(block).not.toMatch(/<option value="close" data-tag/);expect(markup).not.toMatch(/sparking/i);
      }
    }
  });
});

class Rig{
  camera=new THREE.PerspectiveCamera(50,16/9,.1,200);follow=new FollowCamera(this.camera);
  me:Fighter;foes:Fighter[];yaw=Math.PI;
  constructor(style:CameraStyle,distance=3,mode:'dynamic'|'lockon'|'free'='dynamic',cinematics=false,aspect=16/9){
    this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
    this.follow.mode=mode;this.follow.style=style;this.follow.cinematics=cinematics;
    this.me=actor('me',0,distance,{target:'foe'});this.foes=[actor('foe',0,0)];
  }
  step(frames=1,dt=1/60){for(let i=0;i<frames;i++){this.follow.update(dt,this.me,this.yaw,.02,[],0,this.foes[0],false);this.yaw=this.follow.inputYaw;}this.camera.updateMatrixWorld();}
  size(body:Fighter,height=1.75){const p=body.group.position,low=p.clone().project(this.camera),top=p.clone().setY(p.y+height).project(this.camera);return (top.y-low.y)/2;}
  ndc(body:Fighter,up=1){const p=body.group.position;return p.clone().setY(p.y+up).project(this.camera);}
  behind(){const p=this.camera.position,m=this.me.group.position;return Math.hypot(p.x-m.x,p.z-m.z);}
}
const covered=(camera:THREE.Camera,me:{x:number;z:number},foe:{x:number;z:number})=>{
  const L=camera.position,dP=Math.hypot(me.x-L.x,me.z-L.z),dF=Math.hypot(foe.x-L.x,foe.z-L.z);if(dP>=dF)return 0;
  const wP=Math.asin(Math.min(1,.38/dP)),wF=Math.asin(Math.min(1,.3/dF)),d=wrap(Math.atan2(me.x-L.x,me.z-L.z)-Math.atan2(foe.x-L.x,foe.z-L.z));
  return Math.max(0,Math.min(d+wP,wF)-Math.max(d-wP,-wF))/(2*wF);
};

describe('the Close camera: nearer, lower, narrower, the fighters bigger',()=>{
  it.each([1.6,3,6,10])('at %s m: a nearer, lower, narrower lens, and both fighters well over Classic\'s size',distance=>{
    const classic=new Rig('classic',distance),close=new Rig('close',distance);classic.step(300);close.step(300);
    expect(classic.follow.styleBlend).toBe(0);expect(close.follow.styleBlend).toBe(1);
    expect(classic.camera.fov).toBe(50);
    expect(close.camera.fov).toBeLessThan(46);expect(close.camera.fov).toBeGreaterThan(36);
    expect(close.camera.position.y).toBeLessThan(classic.camera.position.y-.25);
    expect(close.size(close.me)).toBeGreaterThan(classic.size(classic.me)*1.25);
    expect(close.size(close.foes[0],1.64)).toBeGreaterThan(classic.size(classic.foes[0],1.64)*1.15);
  });
  it('the player stays whole in the frame, under the health bars and above the bottom edge',()=>{
    for(const d of [1.6,2.2,3,5,8]){
      const r=new Rig('close',d);r.step(300);
      expect(r.ndc(r.me,1.75).y,`head at ${d} m`).toBeLessThan(.8);expect(r.ndc(r.me,0).y,`feet at ${d} m`).toBeGreaterThan(-.95);
      expect(Math.abs(r.ndc(r.me,.9).x),`player's side at ${d} m`).toBeLessThan(.75);
    }
  });
  it('the opponent is never lost: in the frame from any side, on the ground and in the air',()=>{
    for(const [bx,bz,y] of [[0,-4,0],[3,-3,0],[-3,-3,0],[4,0,0],[-4,0,0],[0,-5,4.5],[2,-6,7],[0,-12,0]]){
      const r=new Rig('close',3);r.foes[0].group.position.set(bx,y,bz+3);r.step(360);
      const feet=r.ndc(r.foes[0],0),head=r.ndc(r.foes[0],1.7);
      expect(Math.abs(head.x),`foe at ${bx},${bz},${y}`).toBeLessThan(.95);expect(head.y,`head ${bx},${bz},${y}`).toBeLessThan(.95);expect(Math.max(feet.y,head.y),`foe on screen ${bx},${bz},${y}`).toBeGreaterThan(-.95);
    }
  });
  it('in free mode the view turns with the input exactly as Classic\'s does',()=>{
    const a=new Rig('classic',3,'free'),b=new Rig('close',3,'free');a.step(30);b.step(30);
    const gap=()=>wrap(a.follow.movementYaw-b.follow.movementYaw);
    const from=gap();
    for(let i=0;i<400;i++){const turn=Math.sin(i/37)*.05;a.yaw+=turn;b.yaw+=turn;a.step();b.step();
      expect(b.follow.inputYaw).toBe(a.follow.inputYaw);expect(gap()).toBeCloseTo(from,9);}
  });
  it('movement stays camera-relative: the view basis is the heading the lens really looks along',()=>{
    const r=new Rig('close',3);const dir=new THREE.Vector3();
    for(let i=0;i<600;i++){
      if(i===200)r.foes[0].group.position.set(4,0,1);
      r.step();r.camera.getWorldDirection(dir);
      expect(Math.abs(wrap(r.follow.movementYaw-Math.atan2(dir.x,dir.z)))).toBeLessThan(1e-4);
    }
  });
  it('changing style mid-fight is a move, not a cut, both ways',()=>{
    const r=new Rig('classic');r.step(240);let last=r.camera.position.clone(),worst=0,blend=0;
    r.follow.style='close';
    for(let i=0;i<150;i++){r.step();worst=Math.max(worst,r.camera.position.distanceTo(last));last.copy(r.camera.position);expect(r.follow.styleBlend).toBeGreaterThanOrEqual(blend);blend=r.follow.styleBlend;}
    expect(blend).toBeGreaterThan(.99);expect(worst).toBeLessThan(.12);
    r.follow.style='classic';worst=0;
    for(let i=0;i<240;i++){r.step();worst=Math.max(worst,r.camera.position.distanceTo(last));last.copy(r.camera.position);}
    expect(worst).toBeLessThan(.12);expect(r.follow.styleBlend).toBe(0);expect(r.camera.fov).toBeCloseTo(50,1);
  });
  it('falls back to Classic where the view is the squad\'s (survival, objectives, the rift): the very same camera',()=>{
    const classic=new Rig('classic'),squad=new Rig('close');classic.follow.battlefield=squad.follow.battlefield=true;
    classic.step(300);squad.step(300);
    expect(squad.follow.styleBlend).toBe(0);expect(squad.camera.position.distanceTo(classic.camera.position)).toBe(0);expect(squad.camera.fov).toBe(classic.camera.fov);
  });
  it('and eases toward Classic when several fighters are on the player at once',()=>{
    const r=new Rig('close');
    const foes=[r.foes[0],actor('f1',3,2,{action:'light',target:'me'}),actor('f2',-3,2,{action:'light',target:'me'}),actor('f3',0,6,{action:'heavy',target:'me'})];
    r.foes[0].state.action='light';r.foes[0].state.target='me';
    r.follow.director.crowd=new Map<string,Fighter>([['me',r.me],...foes.map(f=>[f.state.id,f] as [string,Fighter])]);
    r.step(420);
    expect(r.follow.styleBlend).toBeLessThan(.5);
  });
  it('keeps inside the arena against its wall, as Classic does, and the player stays in the frame',()=>{
    const bounds={halfX:16,halfZ:16};
    for(const [x,z,fx,fz] of [[0,15.4,0,11.64],[15.4,0,11.64,0],[-15.2,-15.2,-11.52,-11.52]]){
      const lens:Record<string,THREE.Vector3>={};
      for(const style of ['classic','close'] as const){
        const r=new Rig(style);r.follow.stageBounds=bounds;r.me.group.position.set(x,0,z);r.foes[0].group.position.set(fx,0,fz);r.step(480);
        const p=r.camera.position;lens[style]=p.clone();
        expect(Math.max(Math.abs(p.x),Math.abs(p.z)),`${style} lens at ${x},${z}`).toBeLessThan(16.1);
        expect(Math.abs(r.ndc(r.me,.9).x),`${style} player's side at ${x},${z}`).toBeLessThan(.95);expect(r.ndc(r.me,0).y,`${style} feet at ${x},${z}`).toBeGreaterThan(-1);
      }
      expect(Math.max(Math.abs(lens.close.x),Math.abs(lens.close.z))).toBeLessThanOrEqual(Math.max(Math.abs(lens.classic.x),Math.abs(lens.classic.z))+.05);
    }
  });
  it('the weights: the style chosen, not the squad\'s, less with a crowd',()=>{
    expect(closeStyleGoal('classic',false,0)).toBe(0);expect(closeStyleGoal('close',true,0)).toBe(0);
    expect(closeStyleGoal('close',false,0)).toBe(1);expect(closeStyleGoal('close',false,1)).toBe(0);
    expect(closeStyleGoal('close',false,.45)).toBeGreaterThan(0);expect(closeStyleGoal('close',false,.45)).toBeLessThan(1);
    const size={boom:3,lift:.6,shoulder:1,focus:.9};closeStyleRig(size,0,.8);expect(size).toEqual({boom:3,lift:.6,shoulder:1,focus:.9});
    expect(closeStyleFov(50,0)).toBe(50);expect(closeStyleFov(54,1)).toBeCloseTo(CLOSE_STYLE.fov+4*CLOSE_STYLE.fovKeep,9);
  });
});

describe('the Close camera and the player\'s own body: the opponent stays in clear view',()=>{
  it('the player stands clearly to one side and low, and does not hide the opponent, at melee range, 3 m and across the arena',()=>{
    for(const d of [1.4,1.6,2.2,3,6,10]){
      const r=new Rig('close',d);r.step(360);
      const x=r.ndc(r.me,.9).x,foe=r.ndc(r.foes[0],1);
      expect(Math.abs(x),`player's side at ${d} m`).toBeGreaterThan(.4);expect(Math.abs(x)).toBeLessThan(.75);
      expect(Math.sign(foe.x)===Math.sign(x)&&Math.abs(foe.x)>Math.abs(x)-.3,`foe not behind the player at ${d} m`).toBe(false);
      expect(covered(r.camera,r.me.group.position,r.foes[0].group.position),`cover at ${d} m`).toBe(0);
      expect(r.ndc(r.me,.9).y,`low in the frame at ${d} m`).toBeLessThan(0);
    }
  });
  it.each([4/3,16/10,16/9,21/9])('and at any window shape (aspect %s): the fighter is never pushed out of the frame',aspect=>{
    for(const d of [1.6,3]){
      const r=new Rig('close',d,'dynamic',false,aspect);r.step(360);
      const x=Math.abs(r.ndc(r.me,.9).x);
      expect(x,`centre at ${d} m`).toBeLessThan(.72);expect(x).toBeGreaterThan(.3);
      expect(Math.abs(r.ndc(r.foes[0],1).x),`foe at ${d} m`).toBeLessThan(.95);
    }
  });
  it('and circling the opponent at melee range the body covers them no more often than Classic\'s does',()=>{
    const frac=(style:CameraStyle,mask:number,foe:Foe)=>{const rows=hold(style,[0,2],mask,4,foe);return rows.filter(r=>r.cover>.25).length/rows.length;};
    for(const [mask,foe] of [[LEFT,still],[RIGHT,still],[LEFT,orbit],[RIGHT,pace]] as [number,Foe][]){
      const closeFrac=frac('close',mask,foe),classicFrac=frac('classic',mask,foe);
      expect(closeFrac,`mask ${mask}`).toBeLessThanOrEqual(classicFrac+.02);expect(closeFrac).toBeLessThan(.12);
    }
  });
});

const SPEED=6.5,PUSH=1.25;
type Foe=(t:number)=>[number,number];
const still:Foe=()=>[0,0];
const orbit:Foe=t=>[5*Math.sin(.8*t),5*Math.cos(.8*t)-3];
const pace:Foe=t=>[0,-2-2*Math.sin(3*t)];
const dashBy:Foe=t=>{const u=Math.min(1,Math.max(0,(t-.8)/.5));return [2.5-5*u,-1-1.5*u];};
interface Frame{t:number;x:number;z:number;vx:number;vz:number;basis:number;view:number;cover:number;fx:number;fz:number}
function hold(style:CameraStyle,start:[number,number],mask:number,seconds:number,foeAt:Foe,settle=2,setup?:(r:Rig)=>void):Frame[]{
  const r=new Rig(style,3);r.me.group.position.set(start[0],0,start[1]);setup?.(r);
  const forward=(mask&1?1:0)-(mask&4?1:0),right=(mask&8?1:0)-(mask&2?1:0),mag=Math.max(1,Math.hypot(forward,right));
  const rows:Frame[]=[];let px=start[0],pz=start[1],dt=1/60;
  for(let i=0;i<Math.round((settle+seconds)*60);i++){
    const t=i*dt-settle,keys=t>=0?mask:0,basis=r.follow.movementBasis(keys);
    let vx=0,vz=0;
    if(keys){vx=(Math.sin(basis)*forward-Math.cos(basis)*right)/mag*SPEED;vz=(Math.cos(basis)*forward+Math.sin(basis)*right)/mag*SPEED;}
    const [fx,fz]=foeAt(t);px+=vx*dt;pz+=vz*dt;
    const dd=Math.hypot(px-fx,pz-fz);if(dd<PUSH&&dd>1e-6){px=fx+(px-fx)*PUSH/dd;pz=fz+(pz-fz)*PUSH/dd;}
    r.me.group.position.set(px,0,pz);r.me.state.x=px;r.me.state.z=pz;r.me.state.action=keys?'run':'idle';r.me.state.yaw=Math.atan2(fx-px,fz-pz);
    r.foes[0].group.position.set(fx,0,fz);r.foes[0].state.x=fx;r.foes[0].state.z=fz;
    r.step();
    if(t>=0)rows.push({t,x:px,z:pz,vx,vz,basis,view:r.follow.movementYaw,cover:covered(r.camera,{x:px,z:pz},{x:fx,z:fz}),fx,fz});
  }
  return rows;
}
function feel(rows:Frame[]){
  let lagSum=0,lagMax=0,stepMax=0,viewTurn=0,pathTurn=0;
  for(let i=1;i<rows.length;i++){
    const a=rows[i-1],b=rows[i],lag=Math.abs(wrap(b.basis-b.view));lagSum+=lag;lagMax=Math.max(lagMax,lag);
    stepMax=Math.max(stepMax,Math.abs(wrap(b.basis-a.basis)));viewTurn+=Math.abs(wrap(b.view-a.view));
    if(i>2&&Math.hypot(b.vx,b.vz)>1&&Math.hypot(a.vx,a.vz)>1)pathTurn+=Math.abs(wrap(Math.atan2(b.vx,b.vz)-Math.atan2(a.vx,a.vz)));
  }
  return {lagMean:lagSum/rows.length,lagMax,stepMax,viewTurn,pathTurn};
}
const FORWARD=1,LEFT=2,BACK=4,RIGHT=8;
const SCENARIOS:Record<string,{start:[number,number];mask:number;seconds:number;foe:Foe}>={
  'straight run at a still opponent':{start:[0,9],mask:FORWARD,seconds:2.2,foe:still},
  'strafe round a still opponent, left':{start:[0,4],mask:LEFT,seconds:4,foe:still},
  'strafe round a still opponent, right':{start:[0,4],mask:RIGHT,seconds:4,foe:still},
  'diagonal, forward and right':{start:[0,9],mask:FORWARD|RIGHT,seconds:2.4,foe:still},
  'diagonal, back and left':{start:[0,3],mask:BACK|LEFT,seconds:2.4,foe:still},
  'run away':{start:[0,3],mask:BACK,seconds:2,foe:still},
  'melee circle, left':{start:[0,2],mask:LEFT,seconds:4,foe:still},
  'melee circle, right':{start:[0,2],mask:RIGHT,seconds:4,foe:still},
  'run at an orbiting opponent':{start:[0,9],mask:FORWARD,seconds:4,foe:orbit},
  'strafe round an orbiting opponent':{start:[0,6],mask:LEFT,seconds:4,foe:orbit},
  'run at a pacing opponent':{start:[0,9],mask:FORWARD,seconds:4,foe:pace},
  'strafe round a pacing opponent':{start:[0,5],mask:RIGHT,seconds:4,foe:pace},
  'hold forward as the opponent dashes past':{start:[0,6],mask:FORWARD,seconds:3,foe:dashBy},
};

describe('steering in the Close style: a held direction is as solid as Classic\'s, and solider on the screen',()=>{
  const results=Object.fromEntries(Object.entries(SCENARIOS).map(([name,s])=>[name,{classic:feel(hold('classic',s.start,s.mask,s.seconds,s.foe)),close:feel(hold('close',s.start,s.mask,s.seconds,s.foe))}]));
  it.each(Object.keys(SCENARIOS))('%s',name=>{
    const {classic,close}=results[name];
    expect(close.lagMax,'worst lag of the run behind the view').toBeLessThan(.7);
    expect(close.lagMax).toBeLessThanOrEqual(classic.lagMax+.06);
    expect(close.lagMean).toBeLessThanOrEqual(classic.lagMean+.03);
    expect(close.stepMax,'largest step of the basis in one frame').toBeLessThan(.12);
    expect(close.pathTurn).toBeLessThan(close.viewTurn+1.2);
  });
  it('Classic leaves a held direction as far off the screen as 160 degrees in a fight - the thing the bound is for',()=>{
    expect(Math.max(...Object.values(results).map(r=>r.classic.lagMax))).toBeGreaterThan(2);
    expect(Math.max(...Object.values(results).map(r=>r.close.lagMax))).toBeLessThan(.7);
  });
  it('a player held up (running into the opponent while the camera has swung) gets the view over a few frames, not in one',()=>{
    const peek=(style:CameraStyle)=>{
      const r=new Rig(style,3);r.step(120);
      type Latch={autoTurn:number;autoShown:number;basisMask:number;blockedFor:number};
      const inner=r.follow as unknown as Latch;r.follow.movementBasis(FORWARD);inner.autoTurn=inner.autoShown=.4;r.me.state.action='run';
      let worst=0,last=r.follow.movementBasis(FORWARD);
      for(let i=0;i<40;i++){r.step();const b=r.follow.movementBasis(FORWARD);worst=Math.max(worst,Math.abs(wrap(b-last)));last=b;}
      return {worst,residual:Math.abs(inner.autoTurn)};
    };
    const classic=peek('classic'),close=peek('close');
    expect(classic.worst,'Classic hands it the view in one frame').toBeGreaterThan(.3);
    expect(close.worst).toBeLessThan(.06);expect(close.residual).toBeLessThan(.05);
  });
  it('the bound is tight but not a view-relative run: without an opponent framed the latch is whole, as in Classic',()=>{
    const swing=(style:CameraStyle)=>{
      const r=new Rig(style,3);r.foes[0].state.alive=false;r.step(120);r.follow.movementBasis(FORWARD);
      let lag=0;for(let i=0;i<120;i++){r.yaw+=.02;r.step();r.follow.movementBasis(FORWARD);lag=Math.max(lag,Math.abs(wrap(r.follow.movementBasis(FORWARD)-r.follow.movementYaw)));}
      return lag;
    };
    expect(swing('close')).toBeCloseTo(swing('classic'),6);
  });
});

describe('Classic\'s steering is exactly what it was',()=>{
  const GOLD:Record<string,number[]>={
    'strafe round an orbiting opponent':[-22.887, 4.135, 2.497, 2.631],
    'run at a pacing opponent':[-4.599, -16.48, 0.468, 3.204],
    'hold forward as the opponent dashes past':[0.978, -13.089, -0.572, -3.194],
    'melee circle, left':[-23.048, 7.548, 2.353, 2.622],
  };
  it.each(Object.keys(GOLD))('%s',name=>{
    const s=SCENARIOS[name],l=hold('classic',s.start,s.mask,s.seconds,s.foe).at(-1)!;
    expect([l.x,l.z,l.view,l.basis].map(v=>Number(v.toFixed(3)))).toEqual(GOLD[name]);
  });
});

describe('the awakening close-up (Close only): a low-angle upper-body shot, then back to the game',()=>{
  function film(style:CameraStyle){
    const r=new Rig(style,3,'dynamic',true);const crowd=new Map<string,Fighter>([['me',r.me],['foe',r.foes[0]]]);r.follow.director.crowd=crowd;
    const frames:{t:number;shot:boolean;y:number;reach:number;fov:number;yaw:number}[]=[];
    for(let i=0;i<260;i++){
      const t=(i-90)/60,awakening=t>=0&&t<AWAKENING_ENTRY;
      Object.assign(r.me.state,{action:awakening?'awaken':'idle',actionStarted:1,actionSeq:2,actionDuration:AWAKENING_ENTRY,actionTime:Math.max(0,t/AWAKENING_ENTRY),awakened:t>=0});
      r.follow.director.handle([],'me',id=>crowd.get(id));
      r.step();
      const p=r.camera.position,m=r.me.group.position;
      frames.push({t,shot:r.follow.director.phase==='awaken',y:p.y,reach:Math.hypot(p.x-m.x,p.z-m.z),fov:r.camera.fov,yaw:r.follow.movementYaw});
    }
    return {frames,seconds:frames.filter(f=>f.shot).length/60,r};
  }
  it('Classic\'s awakening shot is exactly what it was (the entry plus its 0.6 s hand-back) and never goes low',()=>{
    const {frames,seconds}=film('classic');
    expect(seconds).toBeGreaterThan(1.42);expect(seconds).toBeLessThan(1.56);
    expect(Math.min(...frames.filter(f=>f.shot).map(f=>f.y))).toBeGreaterThan(1.3);
  });
  it('Close\'s is about 1.35 s: low, in front, and back where the game left it',()=>{
    const {frames,seconds}=film('close');
    expect(seconds).toBeGreaterThan(1.2);expect(seconds).toBeLessThan(1.5);
    const shot=frames.filter(f=>f.shot),before=frames.filter(f=>f.t<-.1).at(-1)!,after=frames.at(-1)!;
    expect(Math.min(...shot.map(f=>f.y)),'a low angle: the lens under the chest').toBeLessThan(1);
    expect(Math.min(...shot.map(f=>f.y))).toBeGreaterThan(.25);
    expect(Math.abs(after.y-before.y)).toBeLessThan(.15);expect(Math.abs(after.reach-before.reach)).toBeLessThan(.35);
  });
  it('input is what it is today: the shot leaves the movement basis where Classic\'s awakening shot does',()=>{
    const drift=(style:CameraStyle)=>{const {frames}=film(style),basis=frames.filter(f=>f.t<-.1).at(-1)!.yaw;
      return Math.max(...frames.filter(f=>f.shot).map(f=>Math.abs(wrap(f.yaw-basis))));};
    expect(drift('close')).toBeLessThan(Math.max(drift('classic')*1.5,.03));
  });
  it('is the cinematic camera\'s: with that off there is no shot, in either style',()=>{
    for(const style of ['classic','close'] as const){
      const r=new Rig(style,3,'dynamic',false);const crowd=new Map<string,Fighter>([['me',r.me],['foe',r.foes[0]]]);r.follow.director.crowd=crowd;
      Object.assign(r.me.state,{action:'awaken',actionStarted:1,actionSeq:2,actionDuration:AWAKENING_ENTRY,actionTime:.2});
      for(let i=0;i<90;i++){r.follow.director.handle([],'me',id=>crowd.get(id));r.step();expect(r.follow.director.phase).not.toBe('awaken');}
    }
  });
  it('is tuned inside the window the owner asked for',()=>{
    expect(AWAKENING_ENTRY+CLOSE_SHOT.out).toBeGreaterThanOrEqual(1.2);expect(AWAKENING_ENTRY+CLOSE_SHOT.out).toBeLessThanOrEqual(1.5);
    expect(CLOSE_SHOT.low).toBeLessThan(0);
  });
});

describe('the poses a dash leaves fade near the Close lens, and only there',()=>{
  const dash=(style:CameraStyle,from:number)=>{
    const r=new Rig(style,from);r.step(240);
    const poses:{x:number;z:number;born:number}[]=[];let t=0,next=.03,last=r.me.group.position.z,near=Infinity,seen=1;
    for(let i=0;i<60;i++){
      t+=1/60;const m=r.me.group.position;
      if(t<=.4){m.z-=17/60;r.me.state.z=m.z;r.me.state.action='dash';}else r.me.state.action='idle';
      r.step(1);
      if(poses.length<3&&t<=.4&&t>=next&&last-m.z>.35){poses.push({x:m.x,z:m.z,born:t});next=t+.05;last=m.z;}
      const L=r.camera.position;
      for(const p of poses)if(t-p.born<=.24){
        const along=Math.hypot(L.x-p.x,L.z-p.z),vertical=Math.max(0,-L.y,L.y-1.9);
        const d=Math.max(0,Math.hypot(along,vertical)-.4);if(d<near){near=d;seen=ghostLensFade(d,1,r.follow.styleBlend);}
      }
    }
    return {near,seen,weight:r.follow.styleBlend};
  };
  it('the fade: Classic (weight 0) leaves every pose whole at any distance; Close takes one gone inside GHOST_GONE and none beyond GHOST_CLEAR',()=>{
    for(const d of [0,.2,1,2,3.4,8])expect(ghostLensFade(d,1,0)).toBe(1);
    expect(ghostLensFade(0,1,1)).toBe(0);expect(ghostLensFade(GHOST_GONE,1,1)).toBe(0);
    expect(ghostLensFade(GHOST_CLEAR,1,1)).toBe(1);expect(ghostLensFade(GHOST_CLEAR+5,1,1)).toBe(1);
    let was=0;for(let d=0;d<=6;d+=.05){const f=ghostLensFade(d,1,1);expect(f).toBeGreaterThanOrEqual(was-1e-9);was=f;}
    expect(ghostLensFade(0,1,.5)).toBeCloseTo(.5,6);
  });
  it('a taller body is faded from further off (it fills the lens from further off), a normal or unknown one by the base distances',()=>{
    expect(ghostScale()).toBe(1);expect(ghostScale(1.75)).toBe(1);expect(ghostScale(1.9)).toBe(1);
    expect(ghostScale(3.2)).toBeCloseTo(3.2/1.9,6);expect(ghostScale(9)).toBe(2);
    expect(ghostLensFade(GHOST_GONE*1.5,1.5,1)).toBe(0);expect(ghostLensFade(GHOST_GONE*1.5,1,1)).toBeGreaterThan(0);
  });
  it('the camera hands the shader its Close weight every frame: 0 in Classic, 1 in Close, and a move between, not a cut',()=>{
    const classic=new Rig('classic');classic.step(5);expect(GHOST_FADE.value.x).toBe(0);
    const close=new Rig('close');close.step(300);expect(GHOST_FADE.value.x).toBe(1);
    close.follow.style='classic';close.step(6);
    expect(GHOST_FADE.value.x).toBeGreaterThan(0);expect(GHOST_FADE.value.x).toBeLessThan(1);expect(GHOST_FADE.value.x).toBe(close.follow.styleBlend);
    close.step(300);expect(GHOST_FADE.value.x).toBe(0);
    expect(GHOST_FADE.value.y).toBe(GHOST_GONE);expect(GHOST_FADE.value.z).toBe(GHOST_CLEAR);
  });
  it('a dash at a far opponent: the Close lens meets its poses within the fade, and fades them; Classic\'s does not touch them',()=>{
    for(const from of [6,12,19]){
      const close=dash('close',from),classic=dash('classic',from);
      expect(close.weight,`Close at ${from} m`).toBe(1);expect(classic.weight).toBe(0);
      expect(close.near,`Close lens to the nearest pose, ${from} m`).toBeLessThan(GHOST_CLEAR);
      expect(close.seen,`what the fade leaves of it, ${from} m`).toBeLessThan(.7);
      expect(ghostLensFade(close.near,1,classic.weight),'Classic leaves it whole').toBe(1);
    }
  });
});

describe('small floors: room for the lens past the bounds, and the Classic look whatever the setting',()=>{
  const ids=Object.keys(STAGES) as StageId[],small=ids.filter(id=>smallFloor(STAGES[id]));
  const corner=(style:CameraStyle,bounds:{halfX:number;halfZ:number},gap:number,from:[number,number]=[0,0])=>{
    const r=new Rig(style,3);r.follow.stageBounds=bounds;r.me.group.position.set(from[0],0,from[1]);r.foes[0].group.position.set(from[0],0,from[1]-3);
    let px=from[0],pz=from[1],fx=from[0],fz=from[1]-3;const dt=1/60,cx=bounds.halfX-.45,cz=bounds.halfZ-.45,rows:{me:THREE.Vector3;foe:THREE.Vector3;out:number;pitch:number}[]=[];
    const dir=new THREE.Vector3();
    for(let i=0;i<330;i++){
      const keys=i>=90?BACK:0,basis=r.follow.movementBasis(keys);
      if(keys){px-=Math.sin(basis)*SPEED*dt;pz-=Math.cos(basis)*SPEED*dt;}
      px=THREE.MathUtils.clamp(px,-cx,cx);pz=THREE.MathUtils.clamp(pz,-cz,cz);
      const d=Math.hypot(px-fx,pz-fz);if(i>=90&&d>1e-6){const k=Math.min(1,dt*4);fx+=(px+(fx-px)/d*gap-fx)*k;fz+=(pz+(fz-pz)/d*gap-fz)*k;}
      r.me.group.position.set(px,0,pz);r.me.state.x=px;r.me.state.z=pz;r.me.state.action=keys?'run':'idle';r.me.state.yaw=Math.atan2(fx-px,fz-pz);
      r.foes[0].group.position.set(fx,0,fz);r.foes[0].state.x=fx;r.foes[0].state.z=fz;
      r.step();r.camera.getWorldDirection(dir);
      if(i>=90)rows.push({me:r.ndc(r.me,1),foe:r.ndc(r.foes[0],1),out:Math.max(Math.abs(r.camera.position.x)-bounds.halfX,Math.abs(r.camera.position.z)-bounds.halfZ),pitch:Math.asin(dir.y)});
    }
    return rows;
  };
  const inFrame=(p:THREE.Vector3)=>p.z<1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.95;
  it('small is read off the stage\'s own floor (its narrower side under 2 x SMALL_FLOOR across), not a list: the exam hall, the Galactic Arena, the tournament ring, Heavens Arena\'s ring and Enies Lobby\'s bridge',()=>{
    expect([...small].sort()).toEqual(['chunin-exam-room','enies-lobby','galactic-arena','heavens-arena','martial-arts-tournament']);
    for(const id of ids)expect(smallFloor(STAGES[id]),id).toBe(Math.min(STAGES[id].halfX,STAGES[id].halfZ)<SMALL_FLOOR);
    expect(smallFloor(undefined),'no stage known').toBe(false);
  });
  it.each([['close',2.6],['close',5],['classic',2.6],['classic',5]] as const)('backed into a corner of the tournament ring (%s, the opponent %s m off): both fighters stay in the frame, the lens no more than an enclosed hall\'s 1.4 m out',(style,gap)=>{
    const rows=corner(style,STAGES['martial-arts-tournament'],gap);
    expect(rows.filter(r=>!inFrame(r.me)).length,'frames with the player out of the frame').toBe(0);
    expect(rows.filter(r=>!inFrame(r.foe)).length,'frames with the opponent out of the frame').toBe(0);
    expect(Math.max(...rows.map(r=>r.out))).toBeGreaterThan(0);expect(Math.max(...rows.map(r=>r.out))).toBeLessThanOrEqual(1.4+1e-6);
  });
  it.each(small)('%s: the Close setting gets the Classic camera, frame for frame, and keeps its setting',id=>{
    const classic=new Rig('classic',3),close=new Rig('close',3);
    for(const r of [classic,close])r.follow.stageBounds=STAGES[id];
    for(let i=0;i<360;i++){
      const t=i/60,x=Math.sin(t*.9)*2.5,z=3+Math.cos(t*.7)*1.5;
      for(const r of [classic,close]){r.me.group.position.set(x,0,z);r.foes[0].group.position.set(-x*.5,0,-1);r.step();}
      expect(close.camera.position.equals(classic.camera.position),`lens at frame ${i}`).toBe(true);
      expect(close.camera.quaternion.equals(classic.camera.quaternion),`view at frame ${i}`).toBe(true);
      expect(close.camera.fov).toBe(classic.camera.fov);
    }
    expect(close.follow.style).toBe('close');expect(close.follow.styleBlend).toBe(0);
    expect((close.camera.userData.rig as {small:boolean}).small).toBe(true);
  });
  it.each(ids.filter(id=>!smallFloor(STAGES[id])))('%s has the room: Close stays Close',id=>{
    const r=new Rig('close',3);r.follow.stageBounds=STAGES[id];r.step(240);
    expect(r.follow.styleBlend).toBe(1);expect(r.camera.fov).toBeLessThan(46);
  });
  it('the next match on another floor takes that floor\'s camera at the cut, with no blend across it',()=>{
    const r=new Rig('close',3);r.follow.stageBounds=STAGES['martial-arts-tournament'];r.step(120);expect(r.follow.styleBlend).toBe(0);
    r.follow.stageBounds=STAGES['kami-lookout'];r.follow.reset();r.step(1);expect(r.follow.styleBlend).toBe(1);
  });
  it('steering is the style chosen, not the look: with Close set, a held key keeps its bounded latch on a small floor',()=>{
    const peek=(style:CameraStyle,id:StageId)=>{
      const r=new Rig(style,3);r.follow.stageBounds=STAGES[id];r.step(120);
      type Latch={autoTurn:number;autoShown:number;basisMask:number;blockedFor:number};
      const inner=r.follow as unknown as Latch;r.follow.movementBasis(FORWARD);inner.autoTurn=inner.autoShown=.4;r.me.state.action='run';
      let worst=0,last=r.follow.movementBasis(FORWARD);
      for(let i=0;i<40;i++){r.step();const b=r.follow.movementBasis(FORWARD);worst=Math.max(worst,Math.abs(wrap(b-last)));last=b;}
      return worst;
    };
    for(const id of small){expect(peek('close',id),id).toBeLessThan(.06);expect(peek('classic',id),id).toBeGreaterThan(.3);}
  });
  const PAST:readonly StageId[]=['kami-lookout','malevolent-shrine','null-realm','hueco-mundo','onigashima','valley-of-the-end','shiganshina'];
  it('a floor with room: the lens may stand 1.4 m past an edge that was looked at and found harmless, and stays inside any other',()=>{
    const roomy=ids.filter(id=>!smallFloor(STAGES[id])&&!STAGES[id].doubleSided&&STAGES[id].background===undefined);
    for(const id of PAST)expect(roomy,id).toContain(id);
    expect(roomy).toContain('chunin-final');expect(PAST).not.toContain('chunin-final');
    for(const id of roomy){
      const b=STAGES[id],rows=corner('close',b,2.6,[b.halfX-6,b.halfZ-6]),out=Math.max(...rows.map(r=>r.out));
      if(PAST.includes(id)){
        expect(out,`${id}: the lens stands past the edge`).toBeGreaterThan(.5);expect(out,id).toBeLessThanOrEqual(1.4+1e-6);
        expect(rows.filter(r=>!inFrame(r.me)).length,`${id}: frames with the player out of the frame`).toBe(0);
      }else{
        expect(out,`${id}: the lens reaches the bound`).toBeGreaterThan(-.5);expect(out,id).toBeLessThanOrEqual(0);
      }
    }
    const unknown=corner('close',{halfX:18,halfZ:45},2.6,[12,39]);
    expect(Math.max(...unknown.map(r=>r.out))).toBeLessThanOrEqual(0);
  });
});
