import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera} from '../src/render/FollowCamera';
import {ArenaSimulation} from '../src/game/simulation';
import type {Fighter} from '../src/render/Fighter';
import type {AttackSlot,FighterId,PlayerState} from '../src/game/types';
import {SCENES,playScene,type KnockbackScene} from './knockbackScenes';


const REACTING=new Set(['hurt','flinch','launched','knockdown','getup','stun','splat']);
const DEG=180/Math.PI;
const clear=(v:THREE.Vector3)=>v.z<1&&Math.abs(v.x)<=.98&&v.y<=.62&&v.y>=-.8&&!(v.x>=.06&&v.y<=-.43);
const inFrame=(v:THREE.Vector3)=>v.z<1&&Math.abs(v.x)<=1&&Math.abs(v.y)<=1;

async function watch(s:KnockbackScene,cinematics:boolean){
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
  follow.mode='dynamic';follow.cinematics=cinematics;
  let frames=0,readable=0,run=0,worst=0,turn=0,finite=true;
  const aim=new THREE.Vector3(),last=new THREE.Vector3(),c=new THREE.Vector3(),h=new THREE.Vector3(),f=new THREE.Vector3();
  await playScene(s,follow,({i,sentAt,foe,foeBody})=>{
    for(const v of [...camera.position.toArray(),...camera.quaternion.toArray(),camera.fov,follow.movementYaw,follow.inputYaw])if(!Number.isFinite(v))finite=false;
    camera.getWorldDirection(aim);
    if(i>1)turn=Math.max(turn,aim.angleTo(last)*DEG*60);
    last.copy(aim);
    if(sentAt<0||!foe.alive||!REACTING.has(foe.action))return;
    const p=foeBody.group.position;c.set(p.x,p.y+1.1,p.z);h.set(p.x,p.y+1.9,p.z);f.set(p.x,p.y+.05,p.z);
    frames++;
    if(clear(c.project(camera))&&inFrame(h.project(camera))&&inFrame(f.project(camera))){readable++;run=0;}else{run+=1/60;worst=Math.max(worst,run);}
  },(_i,_f,_b,last)=>last);
  return {frames,readable:readable/Math.max(1,frames),worst,turn,finite};
}

describe('dynamic: the victim stays readable through the knockback',()=>{
  it.each([['heavy launch',false],['dash-through',false],['rush into the wall',false],['melee ultimate',true],['spirit bomb',true]] as const)(
    '%s (cinematics %s): chest clear of the HUD, crown and soles in the frame, never a cut',async(name,cinematics)=>{
      const r=await watch(SCENES.find(s=>s.name===name)!,cinematics);
      expect(r.finite).toBe(true);
      expect(r.frames).toBeGreaterThan(30);
      expect(r.readable,`readable ${(r.readable*100).toFixed(0)}%`).toBeGreaterThanOrEqual(.97);
      expect(r.worst).toBeLessThan(.1);
      expect(r.turn,'the aim\'s fastest turn, deg/s').toBeLessThan(400);
    },60_000);
});

const actor=(s:PlayerState)=>({state:s,group:new THREE.Group(),velocity:new THREE.Vector3()} as unknown as Fighter);
type Drive=(i:number,gap:number)=>{moveX:number;moveZ:number;attack?:AttackSlot;dash?:boolean};
function fight(me:FighterId,foe:FighterId,drive:Drive,gap=4.5,seed=17017){
  const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,seed});
  sim.addPlayer('me',me,'Me',false,{x:0,y:0,z:0});sim.addPlayer('foe',foe,'Foe',true,{x:0,y:0,z:gap});sim.startMatch();
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);follow.mode='dynamic';
  const meBody=actor(sim.getPlayer('me')!),foeBody=actor(sim.getPlayer('foe')!);
  let yaw=0,seq=0,turn=0,both=0,frames=0;const aim=new THREE.Vector3(),last=new THREE.Vector3(),v=new THREE.Vector3();
  const on=(p:{x:number;y:number;z:number})=>{v.set(p.x,p.y+1,p.z).project(camera);return v.z<1&&Math.abs(v.x)<=1&&Math.abs(v.y)<=1;};
  for(let i=0;i<900;i++){
    const a=sim.getPlayer('me')!,b=sim.getPlayer('foe')!,gapNow=Math.hypot(b.x-a.x,b.z-a.z);
    const d=drive(i,gapNow);
    sim.submitInput('me',{seq:seq++,moveX:d.moveX,moveZ:d.moveZ,yaw:follow.movementYaw,targetId:'foe',attack:d.attack,dash:d.dash});
    sim.step();sim.snapshot(true);
    const m=sim.getPlayer('me')!,t=sim.getPlayer('foe')!;if(!m.alive||!t.alive)break;
    Object.assign(meBody.state,m);Object.assign(foeBody.state,t);meBody.group.position.set(m.x,m.y,m.z);foeBody.group.position.set(t.x,t.y,t.z);
    follow.update(1/60,meBody,yaw,.02,[],0,foeBody,false);yaw=follow.inputYaw;camera.updateMatrixWorld();
    camera.getWorldDirection(aim);if(i>1)turn=Math.max(turn,aim.angleTo(last)*DEG*60);last.copy(aim);
    if(i<120)continue;
    frames++;if(on(m)&&on(t))both++;
  }
  return {turn,both:both/Math.max(1,frames)};
}

describe('dynamic: fights against the bot',()=>{
  it.each([
    ['circle-strafe','sasuke','naruto',((i:number)=>({moveX:1,moveZ:Math.sin(i/50)*.4,attack:i%55===0?'heavy':undefined})) as Drive],
    ['in-and-out','ichigo','luffy',((i:number)=>({moveX:0,moveZ:Math.cos(i/45)>0?1:-1,attack:i%48===0?'light':undefined,dash:i%90===0})) as Drive],
    ['cross-ups','goku','vegeta',((i:number,gap:number)=>({moveX:i%120<60?1:-1,moveZ:gap>1.6?1:.2,attack:i%30===0?'light':undefined,dash:i%60===10})) as Drive],
  ] as const)('%s: both bodies in the frame, the aim never past 400 deg/s',(name,me,foe,drive)=>{
    const r=fight(me,foe,drive,4.5,17017);
    expect(r.turn).toBeLessThan(400);
    expect(r.both,`both on ${(r.both*100).toFixed(0)}%`).toBeGreaterThanOrEqual(.95);
  },60_000);
});
