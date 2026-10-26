import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {FollowCamera,hitTier} from '../src/render/FollowCamera';
import type {Fighter} from '../src/render/Fighter';
import type {PlayerState} from '../src/game/types';


const state=(id:string,z=0):PlayerState=>({id,name:id,fighter:'zoro',x:0,y:0,z,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:0,
  action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,
  cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
const actor=(id:string,z=0)=>{const group=new THREE.Group();group.position.set(0,0,z);
  return {state:state(id,z),group,velocity:new THREE.Vector3()} as unknown as Fighter;};
const DEG=180/Math.PI;
const weight=(damage:number)=>Math.min(1,.2+damage/460);

function struck(damage:number,slot:'light'|'heavy'|'special'|'ultimate',direction:THREE.Vector3,shake=.5,frames=90){
  const run=(hit:boolean)=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),me=actor('me'),foe=actor('foe',2.5);
    for(let i=0;i<60;i++)follow.update(1/60,me,0,0,[],shake,foe,true);
    if(hit){follow.impact(weight(damage),direction,hitTier(slot));follow.holdFor(Math.min(1,damage/240));}
    const out:{position:THREE.Vector3;quaternion:THREE.Quaternion;fov:number;movementYaw:number;aim:THREE.Vector3}[]=[];
    for(let i=0;i<frames;i++){follow.update(1/60,me,0,0,[],shake,foe,true);out.push({position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov,movementYaw:follow.movementYaw,aim:camera.getWorldDirection(new THREE.Vector3())});}
    return {out,camera};
  };
  const still=run(false),hit=run(true);
  let move=0,turn=0,punch=0,settle=0;
  for(let i=0;i<frames;i++){
    const m=hit.out[i].position.distanceTo(still.out[i].position),t=hit.out[i].quaternion.angleTo(still.out[i].quaternion)*DEG,p=still.out[i].fov-hit.out[i].fov;
    move=Math.max(move,m);turn=Math.max(turn,t);punch=Math.max(punch,p);
    if(m>.005||t>.1||p>.1)settle=(i+1)/60;
  }
  return {move,turn,punch,settle,still:still.out,hit:hit.out};
}
const away=new THREE.Vector3(0,0,1),across=new THREE.Vector3(-1,0,0);

describe('the impact camera',()=>{
  it('makes every tier perceptible and the big ones bigger',()=>{
    const light=struck(32,'light',across),heavy=struck(90,'heavy',across),special=struck(140,'special',across),ultimate=struck(290,'ultimate',across);
    expect(light.turn,'light').toBeGreaterThan(.3);
    expect(heavy.turn,'heavy').toBeGreaterThan(.6);
    expect(heavy.move,'heavy').toBeGreaterThan(.03);
    expect(light.turn).toBeLessThan(heavy.turn);expect(heavy.turn).toBeLessThan(special.turn);expect(special.turn).toBeLessThan(ultimate.turn);
    expect(ultimate.turn,'an ultimate is a jolt, not an earthquake').toBeLessThan(4);
    expect(ultimate.move).toBeLessThan(.25);
    for(const tier of [light,heavy,special,ultimate])expect(tier.settle).toBeLessThan(.9);
  });

  it('dips the view for a blow driven straight away from the lens',()=>{
    const heavy=struck(90,'heavy',away);
    expect(heavy.turn).toBeGreaterThan(.35);
  });

  it('throws the lens the way the blow travelled',()=>{
    const {hit,still}=struck(90,'heavy',across);
    const right=new THREE.Vector3(1,0,0).applyQuaternion(still[6].quaternion);
    expect(hit[6].position.clone().sub(still[6].position).dot(right)).toBeGreaterThan(.02);
    expect(hit[6].aim.clone().sub(still[6].aim).dot(right),'turned after the blow').toBeGreaterThan(0);
  });

  it('punches in only for a heavy, special, finisher or ultimate, and holds it through the freeze',()=>{
    expect(struck(32,'light',away).punch).toBeLessThan(1e-9);
    const heavy=struck(90,'heavy',away),ultimate=struck(290,'ultimate',away);
    expect(heavy.punch).toBeGreaterThan(1.5);expect(heavy.punch).toBeLessThan(3);
    expect(ultimate.punch).toBeGreaterThan(heavy.punch);expect(ultimate.punch).toBeLessThan(4.5);
    const fov=heavy.hit.map(f=>f.fov);
    expect(fov[4]).toBeLessThanOrEqual(fov[2]+1e-9);
    expect(hitTier('light',3),'the rush finisher').toBe(2);expect(hitTier('light',1)).toBe(0);expect(hitTier('special')).toBe(1);
  });

  it('holds a string of heavies in rather than pumping the lens',()=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),me=actor('me'),foe=actor('foe',2);
    let deepest=0,shallowestAfterFirst=Infinity;
    for(let i=0;i<180;i++){
      if(i>=30&&i%12===0){follow.impact(weight(90),away,1);follow.holdFor(90/240);}
      follow.update(1/60,me,0,0,[],.5,foe,true);
      deepest=Math.max(deepest,50-camera.fov);
      if(i>40&&i<150)shallowestAfterFirst=Math.min(shallowestAfterFirst,50-camera.fov);
    }
    expect(deepest).toBeLessThan(2.3);
    expect(shallowestAfterFirst,'the lens sprang back out between two heavies').toBeGreaterThan(1.2);
  });

  it('is off at shake 0, and never moves the movement basis',()=>{
    const off=struck(290,'ultimate',across,0);
    expect(off.move).toBe(0);expect(off.turn).toBeLessThan(1e-4);expect(off.punch).toBe(0);
    const on=struck(290,'ultimate',across,1);
    for(let i=0;i<on.hit.length;i++)expect(on.hit[i].movementYaw).toBe(on.still[i].movementYaw);
  });
});
