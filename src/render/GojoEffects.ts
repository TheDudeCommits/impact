import * as THREE from 'three';
import {FLIGHTS, chargeWasCancelled} from './CombatEffects';
import {MOVES, RUSH} from '../game/moves';
import {moveFor} from '../game/awakening';
import {comboMove,type ComboKey} from '../game/combos';
import type {CombatEvent} from '../game/types';
import type {Fighter} from './Fighter';
import {BoltBatch} from './signature/BoltBatch';
import {GlowBatch,GLOW,RING,STAR} from './signature/GlowBatch';
import {LightVolumes} from './signature/LightVolumes';
import {LightningPainter,type BoltStyle} from './signature/Lightning';
import {EnergySpheres,SPHERES} from './signature/EnergySphere';
import {InfiniteVoid} from './signature/Domain';
import {FloorGashes} from './signature/FloorGash';
import {SIGNATURE,involvesLocal,gradeLocal,GRADE} from './signature/context';
import {castAge} from './signature/castClock';
import {landed,whiffGone} from './signature/ultimateClock';
import {VfxKit} from './vfx/VfxKit';
import {ghostTint,type Element} from './vfx/palette';

type Charge={event:CombatEvent;release:number;tone?:Tone};
type Tone='blue'|'red'|'purple';
const ENDER_TONE:Partial<Record<ComboKey,Tone>>={lh:'red',airHeavy:'red',airSpecial:'purple'};
const HOLLOW=comboMove('gojo','airSpecial');
type Purple={event:CombatEvent;from:THREE.Vector3;floor:number;burst?:boolean;hold?:number;releasedAt?:number;drawn?:number};
const BLUE=new THREE.Color(.25,1.05,2.4),BLUE_DEEP=new THREE.Color(.02,.1,.35),RED=new THREE.Color(2.6,.32,.28),RED_DEEP=new THREE.Color(.3,.02,.02),PURPLE=new THREE.Color(1.3,.45,2.8),PALE=new THREE.Color(1.6,1.4,2.6),PURPLE_HALO=new THREE.Color(.45,.1,.8),TRENCH=new THREE.Color(1.6,.5,2.6);
const LIGHT={blue:new THREE.Color(.3,.9,1.6),red:new THREE.Color(1.5,.35,.3),purple:new THREE.Color(.9,.45,1.7),void:new THREE.Color(.45,.6,1.5)};
const VIOLET:Element={spike:0xf2d6ff,rim:0xb04bff,light:0xc070ff,ink:0x12041f};
const SCARLET:Element={spike:0xffd0c8,rim:0xff3020,light:0xff5030,ink:0x1a0404};
const PURPLE_RADIUS=1.25,PURPLE_SPEED=30;
const RED_CONTACT=RUSH.gojo[2].contacts[0];
const BLINK_STEP=.5,STRIKE_REACH=2.4,BLACK_FLASH=.36;
const PALE_SPARK:Element={spike:0xffffff,rim:0x7fe6ff,light:0x9fe8ff,ink:0x061426};
const BLACK_SPARK:Element={spike:0xff5a4a,rim:0x9a0014,light:0xff2030,ink:0x000000};
const CRIMSON=new THREE.Color(2.4,.12,.16),EMBER=new THREE.Color(.9,.02,.06);
const UP=new THREE.Vector3(0,1,0);
export class GojoEffects{
  private streaks=new BoltBatch(1400,'gojo-cursed-energy');
  private glows=new GlowBatch(160,'gojo-cursed-glow');
  private halos=new GlowBatch(32,'gojo-cursed-halo',true);
  private lights=new LightVolumes(6,'gojo-light');
  private painter=new LightningPainter(this.streaks,64);
  private spheres:EnergySpheres;
  private domain:InfiniteVoid;
  private trench:FloorGashes;
  private kit:VfxKit;
  private charges:Charge[]=[];
  private purples:Purple[]=[];
  private graded=new Set<number>();
  private seen=new Set<number>();
  private a=new THREE.Vector3();private b=new THREE.Vector3();private c=new THREE.Vector3();private side=new THREE.Vector3();private dir=new THREE.Vector3();
  private blueAt=new THREE.Vector3();private redAt=new THREE.Vector3();
  private style:BoltStyle={width:.05,color:PURPLE,levels:4,jag:.3,branches:1,branchLength:.4,taper:.4,core:.25};
  private nextRock=0;
  private anchors=new Map<string,{key:number;at:THREE.Vector3}>();
  private blues:{event:CombatEvent;at:THREE.Vector3;release:number}[]=[];
  private hollows=new Map<string,{cast:number;at:THREE.Vector3;since:number}>();
  private enderAt=new THREE.Vector3();
  private lastAt=new Map<string,THREE.Vector3>();
  private fired=new Map<string,{key:number;contact:number}>();
  private flashes=Array.from({length:4},()=>({at:new THREE.Vector3(),born:-Infinity,seed:0}));
  private flashNext=0;
  private black:BoltStyle={width:.05,color:CRIMSON,levels:4,jag:.42,branches:2,branchLength:.5,taper:.35,core:.3};
  constructor(private scene:THREE.Scene){
    scene.add(this.streaks.mesh,this.glows.mesh,this.halos.mesh,this.lights.mesh);
    this.spheres=new EnergySpheres(scene,8,'gojo-technique-sphere');
    this.domain=new InfiniteVoid(scene);
    this.trench=new FloorGashes(scene,4,'hollow-purple-trench');
    this.kit=VfxKit.for(scene);
  }
  handle(events:readonly CombatEvent[]){
    for(const event of events){
      if(this.seen.has(event.id))continue;this.seen.add(event.id);
      if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!);
      if(event.kind!=='cast'||event.fighter!=='gojo'||!event.slot||(event.slot!=='heavy'&&event.slot!=='special'))continue;
      if(event.branch){
        const move=comboMove('gojo',event.branch);
        if(event.branch==='llh'&&move?.style==='field'&&event.endpoint){this.blues.push({event,at:new THREE.Vector3(event.endpoint.x,event.endpoint.y,event.endpoint.z),release:move.contacts[0]});if(this.blues.length>6)this.blues.shift();}
        if(move?.style==='projectile'){this.charges.push({event,release:move.contacts[0],tone:ENDER_TONE[event.branch]??'blue'});if(this.charges.length>16)this.charges.shift();}
        continue;
      }
      this.charges.push({event,release:MOVES.gojo[event.slot].contacts[0]});
      if(this.charges.length>16)this.charges.shift();
      if(event.slot==='special'&&event.origin&&event.endpoint){this.purples.push({event,from:new THREE.Vector3(event.origin.x,event.origin.y,event.origin.z),floor:event.origin.y-1.05});if(this.purples.length>6)this.purples.shift();}
    }
  }
  private well(center:THREE.Vector3,size:number,color:THREE.Color,deep:THREE.Color,light:THREE.Color,time:number,power:number,outward:boolean,count:number,seed:number,sphere?:typeof SPHERES.blue){
    if(power<.02)return;
    if(sphere)this.spheres.add(center,size*power,sphere,time,seed);
    this.glows.add(center,size*1.35,color,power,RING,.06,seed,.8);
    this.halos.add(center,size*2.6,deep,.55*power,GLOW,.0001);
    for(let i=0;i<count;i++){
      const phase=(time*(outward?1.6:1.2)+i*.618)%1,a=i*2.399+time*(outward?-2:3),tilt=Math.sin(i*1.37)*1.1;
      const travel=outward?phase:1-phase,r=size*(1.1+2.8*travel);
      this.a.set(Math.cos(a)*Math.cos(tilt),Math.sin(tilt),Math.sin(a)*Math.cos(tilt));
      this.b.copy(this.a).multiplyScalar(r).add(center);this.c.copy(this.a).multiplyScalar(r+size*(.35+.5*phase)*(outward?-1:1)).add(center);
      this.streaks.segment(this.b,this.c,.016+.014*phase,color,(.4+.6*Math.sin(Math.PI*phase))*power,.3);
    }
    this.lights.add(center,size*10,light,.6*power);
  }
  private enders(time:number,fighters:ReadonlyMap<string,Fighter>,d:number){
    for(let i=this.blues.length-1;i>=0;i--){
      const b=this.blues[i],age=time-b.event.serverTime;
      if(age>b.release+.55){this.blues.splice(i,1);continue;}
      if(age<b.release-.25)continue;
      const k=THREE.MathUtils.smoothstep(age,b.release-.25,b.release)*(1-THREE.MathUtils.smoothstep(age,b.release+.3,b.release+.55));
      this.enderAt.copy(b.at);this.well(this.enderAt,.55+.25*k,BLUE,BLUE_DEEP,LIGHT.blue,time,k,false,Math.round(28*d),b.event.id%97,SPHERES.blue);
    }
    const move=HOLLOW;
    for(const [id,f] of fighters){
      const s=f.state;
      if(s.fighter!=='gojo')continue;
      let held=this.hollows.get(id);
      if(move&&s.alive&&s.action==='special'&&s.branch==='airSpecial'&&s.grounded&&s.actionTime*s.actionDuration>=move.contacts[0]){
        const cast=s.actionSeq??Math.round(s.actionStarted*10);
        if(!held||held.cast!==cast){held=held??{cast,at:new THREE.Vector3(),since:time};held.cast=cast;held.since=time;held.at.copy(f.group.position);this.hollows.set(id,held);}
      }
      if(!held)continue;
      const age=time-held.since;if(age<0||age>.55)continue;
      const k=THREE.MathUtils.smoothstep(age,0,.06)*(1-THREE.MathUtils.smoothstep(age,.3,.55)),R=1.1*(.6+.4*k);
      this.enderAt.copy(held.at);this.enderAt.y+=R*.55;
      this.well(this.enderAt,R,PURPLE,BLUE_DEEP,LIGHT.purple,time,k,true,Math.round(30*d),7,SPHERES.purple);
      this.halos.add(this.enderAt,R*1.8,PURPLE_HALO,.6*k,GLOW,.0001);
    }
  }
  private tone(tone:Tone,center:THREE.Vector3,size:number,time:number,power:number,count:number,seed:number){
    if(tone==='red')this.well(center,size,RED,RED_DEEP,LIGHT.red,time,power,true,count,seed,SPHERES.red);
    else if(tone==='purple')this.well(center,size*1.15,PURPLE,BLUE_DEEP,LIGHT.purple,time,power,false,count,seed,SPHERES.purple);
    else this.well(center,size,BLUE,BLUE_DEEP,LIGHT.blue,time,power,false,count,seed,SPHERES.blue);
  }
  update(time:number,dt:number,fighters:ReadonlyMap<string,Fighter>,density:number){
    this.streaks.begin();this.glows.begin(time);this.halos.begin(time);this.lights.begin();this.spheres.begin();this.domain.begin();this.trench.begin();
    const d=Math.max(.35,density);
    for(let i=this.charges.length-1;i>=0;i--){
      const c=this.charges[i],actor=fighters.get(c.event.actorId),age=time-c.event.serverTime;
      if(age>c.release+.1||age<-.1||chargeWasCancelled(c.event,c.release,actor?.state,time)||!actor){this.charges.splice(i,1);continue;}
      const charge=THREE.MathUtils.clamp(age/c.release,0,1),salt=c.event.id%97;
      if(c.tone){this.tone(c.tone,actor.handR,.1+charge*.16,time,THREE.MathUtils.smoothstep(charge,0,.2),Math.round(18*d),salt);continue;}
      if(c.event.slot==='heavy')this.well(actor.handR,.12+charge*.2,BLUE,BLUE_DEEP,LIGHT.blue,time,THREE.MathUtils.smoothstep(charge,0,.2),false,Math.round(24*d),salt,SPHERES.blue);
      else{
        const merge=THREE.MathUtils.smoothstep(charge,.5,.88),grow=THREE.MathUtils.smoothstep(charge,0,.22);
        this.blueAt.copy(actor.handL).lerp(actor.handR,merge);this.redAt.copy(actor.handR);
        this.side.set(Math.cos(actor.state.yaw),0,-Math.sin(actor.state.yaw)).multiplyScalar(.34*(1-merge));
        this.blueAt.add(this.side);this.redAt.sub(this.side);this.blueAt.y+=.12*(1-merge);this.redAt.y+=.12*(1-merge);
        if(merge<.98){this.well(this.blueAt,.24+.08*charge,BLUE,BLUE_DEEP,LIGHT.blue,time,grow*(1-merge),false,Math.round(16*d),salt,SPHERES.blue);this.well(this.redAt,.24+.08*charge,RED,RED_DEEP,LIGHT.red,time,grow*(1-merge),true,Math.round(16*d),salt+3,SPHERES.red);}
        if(merge>.02){this.well(actor.handR,.22+.3*merge,PURPLE,BLUE_DEEP,LIGHT.purple,time,merge,false,Math.round(20*d),salt+5,SPHERES.purple);this.halos.add(actor.handR,.9*merge,PURPLE_HALO,.6*merge,GLOW,.0001);}
        if(merge>.05&&merge<.95){this.style.width=.03*merge+.01;this.style.color=PURPLE;this.style.intensity=merge;this.style.branches=1;this.painter.bolt(this.blueAt,this.redAt,Math.floor(time*30)*7+salt,this.style);}
      }
    }
    this.purple(time,fighters,d);
    this.enders(time,fighters,d);
    for(const flight of FLIGHTS.values()){
      if(flight.fighter!=='gojo'||!flight.released)continue;
      if(flight.branch){this.tone(ENDER_TONE[flight.branch]??'blue',flight.position,.3,time,Math.min(1,Math.max(0,time-flight.since)/.08),Math.round(20*d),11);continue;}
      if(flight.slot!=='heavy')continue;
      const age=Math.max(0,time-flight.since),head=Math.min(1,age/.08);
      this.well(flight.position,.36,BLUE,BLUE_DEEP,LIGHT.blue,time,head,false,Math.round(26*d),7,SPHERES.blue);
      this.side.crossVectors(flight.heading,UP).normalize();
      for(let i=0;i<Math.round(10*d);i++){const phase=(time*3.2+i*.618)%1,a=i*2.4+time*11;this.b.copy(flight.position).addScaledVector(flight.heading,-phase*1.6).addScaledVector(this.side,Math.cos(a)*.2).addScaledVector(UP,Math.sin(a)*.2);this.c.copy(this.b).addScaledVector(flight.heading,-.35);this.streaks.segment(this.b,this.c,.02,BLUE,(1-phase)*head,.3);}
    }
    for(const [id,fighter] of fighters){
      const s=fighter.state;
      if(s.fighter!=='gojo')continue;
      const elapsed=s.actionTime*s.actionDuration;
      if(s.alive&&s.action==='light'&&(s.chain??0)>=3){
        const form=THREE.MathUtils.smoothstep(elapsed,.02,RED_CONTACT-.04),after=elapsed-RED_CONTACT;
        if(after<0)this.well(fighter.handR,.1+.14*form,RED,RED_DEEP,LIGHT.red,time,form,true,Math.round(14*d),5,SPHERES.red);
        else if(after<.3){const k=1-after/.3;this.spheres.add(fighter.handR,(.24+after*4)*k,SPHERES.red,time,5,k);this.glows.add(fighter.handR,1.2+after*6,RED,k,RING,.05,9,.6);this.glows.add(fighter.handR,1+after*2,RED,k,STAR,.2,Math.floor(time*30));this.lights.add(fighter.handR,5,LIGHT.red,1.2*k);
          if(after<dt*1.5)this.kit.streaks(fighter.handR.x,fighter.handR.y,fighter.handR.z,SCARLET,this.kit.n(12,4),11,.028,time,this.dir.set(Math.sin(s.yaw),0,Math.cos(s.yaw)),.8);}
      }
      const move=moveFor('gojo','ultimate',!!s.awakened),stop=move.timeStop!,from=move.contacts[stop.contact],to=Math.min(from+stop.duration,whiffGone(s)),finisher=move.contacts[move.contacts.length-1];
      const open=s.alive&&s.action==='ultimate'&&elapsed>=from-.05&&elapsed<to;
      const touring=s.alive&&landed(s)&&elapsed>=from&&elapsed<finisher+.3;
      this.blink(id,fighter,touring,time);
      if(touring)this.strikes(id,fighter,fighters,move,elapsed,time);
      if(!open)continue;
      const inside=elapsed-from,left=to-elapsed;
      const grow=inside<0?.02:1-Math.pow(1-THREE.MathUtils.clamp(inside/.35,0,1),3),close=THREE.MathUtils.smoothstep(left,0,.28);
      let anchor=this.anchors.get(id);if(!anchor){anchor={key:NaN,at:new THREE.Vector3()};this.anchors.set(id,anchor);}
      if(anchor.key!==s.actionStarted){anchor.key=s.actionStarted;anchor.at.set(s.x,s.y,s.z);}
      const at=anchor.at;
      this.a.set(at.x,at.y+1,at.z);
      this.domain.show(id,this.a,at.y,stop.radius,Math.max(.02,grow*close),time,.6+.4*close);
      const key=Math.round(s.actionStarted*1000);
      if(!this.graded.has(key)&&inside>=0&&landed(s)){this.graded.add(key);if(this.graded.size>32)this.graded.delete(this.graded.values().next().value!);if(involvesLocal(id,s.target??undefined)){SIGNATURE.screen?.techniqueGrade?.(GRADE.void,.45,Math.max(.2,to-elapsed));SIGNATURE.screen?.impactFrame?.(.6);}}
      if(inside<.3){const k=1-Math.max(0,inside)/.3;this.glows.add(this.a,1.5+Math.max(0,inside)*20,PALE,.9*k,RING,.04,3,.7);this.halos.add(this.a,3,PURPLE_HALO,k,GLOW,.0001);}
      const n=Math.round(56*d),fade=grow*close;
      for(let i=0;i<n;i++){
        const phase=(time*.35+i*.618)%1,a=i*2.399,r=stop.radius*(1-phase)*.95,h=.2+(i%7)*.45;
        this.b.set(at.x+Math.cos(a)*r,at.y+h+Math.sin(time+i)*.15,at.z+Math.sin(a)*r);this.c.copy(this.a).sub(this.b).normalize().multiplyScalar(.3+.5*phase).add(this.b);
        this.streaks.segment(this.b,this.c,.02+.012*(i%3),i%4===0?PALE:i%4===1?BLUE:PURPLE,fade*(.5+.5*phase),.4);
      }
      this.lights.add(this.a,stop.radius*1.1,LIGHT.void,.45*fade);
    }
    for(const flash of this.flashes){const age=time-flash.born;if(!(age>=0&&age<BLACK_FLASH))continue;const k=1-age/BLACK_FLASH;
      this.glows.add(flash.at,1.6+age*5,CRIMSON,.9*k,STAR,.22,flash.seed+Math.floor(age*30));this.halos.add(flash.at,2.4,EMBER,.7*k,GLOW,.0001);this.lights.add(flash.at,7,LIGHT.red,1.3*k);
      const bolts=Math.round(6*d);for(let i=0;i<bolts;i++){const a=i*2.4+flash.seed,tilt=Math.sin(i*1.7+flash.seed)*.9,reach=1.1+.9*((i*.618)%1);
        this.b.set(flash.at.x+Math.cos(a)*Math.cos(tilt)*reach,flash.at.y+Math.sin(tilt)*reach,flash.at.z+Math.sin(a)*Math.cos(tilt)*reach);
        this.black.width=.05*k+.012;this.black.intensity=k;this.painter.bolt(flash.at,this.b,Math.floor(time*24)*11+i+flash.seed,this.black);}}
    this.domain.end();
    this.painter.sparksUpdate(dt,PALE);
    this.streaks.end();this.glows.end();this.halos.end();this.lights.end();this.spheres.end();this.trench.end();
  }
  private purple(time:number,fighters:ReadonlyMap<string,Fighter>,d:number){
    const move=MOVES.gojo.special,release=move.contacts[0];
    for(let i=this.purples.length-1;i>=0;i--){
      const p=this.purples[i],e=p.event,actor=fighters.get(e.actorId),age=castAge(p,time,actor,release),span=Math.hypot(e.endpoint!.x-p.from.x,e.endpoint!.z-p.from.z),travel=span/PURPLE_SPEED;
      if(age>release+travel+.45||(age<release&&chargeWasCancelled(e,release,actor?.state,time))){this.purples.splice(i,1);continue;}
      gradeLocal(e.actorId,e.id,GRADE.void,.5,release+.9,actor?.group.position,e.actorId,actor?.state.target??undefined);
      if(age<release){if(actor){p.from.copy(actor.handR);p.floor=actor.group.position.y;}continue;}
      const flying=age-release,t=Math.min(1,flying/Math.max(.05,travel));
      this.dir.set(e.endpoint!.x-p.from.x,0,e.endpoint!.z-p.from.z);if(this.dir.lengthSq()<1e-6)this.dir.set(0,0,1);this.dir.normalize();
      const radius=PURPLE_RADIUS*(.4+.6*THREE.MathUtils.smoothstep(flying,0,.14)),end=Math.max(0,flying-travel),fade=1-THREE.MathUtils.smoothstep(end,.05,.3);
      this.a.copy(p.from).addScaledVector(this.dir,span*t);this.a.y=Math.max(p.from.y,p.floor+radius*.8);
      if(fade>.01){
        this.spheres.add(this.a,radius*(1+end*1.6),SPHERES.purple,time,e.id,fade);
        this.halos.add(this.a,radius*2.6,PURPLE_HALO,.7*fade,GLOW,.0001);
        this.glows.add(this.a,radius*1.18,PURPLE,.8*fade,RING,.05,e.id,.86);
        this.lights.add(this.a,radius*6,LIGHT.purple,1.1*fade);
        this.b.copy(p.from);
        const trail=fade*(1-THREE.MathUtils.smoothstep(flying,travel*.6,travel+.35));
        this.streaks.segment(this.b,this.a,radius*.55*trail,PURPLE,.85*trail,.18);
        this.streaks.segment(this.b,this.a,radius*.2*trail,PALE,.7*trail,.4);
        const bolts=Math.round(5*d);
        for(let k=0;k<bolts;k++){const u=(k+.5)/bolts;this.c.copy(this.b).lerp(this.a,u*.92);this.side.copy(this.c).addScaledVector(this.dir,Math.max(.6,span*t*.12));this.style.width=.035*trail;this.style.color=k%2?PURPLE:PALE;this.style.intensity=trail;this.style.branches=1;this.painter.bolt(this.c,this.side,Math.floor(time*30)*13+k,this.style);}
        this.c.set(p.from.x,p.floor,p.from.z);this.side.set(this.a.x,p.floor,this.a.z);
        this.trench.add(this.c,this.side,.55,trail,TRENCH,e.id);
        if(time>=this.nextRock&&end<=0){this.nextRock=time+.05;this.kit.debris.burst(this.kit.n(3,1),this.a.x,p.floor,this.a.z,0,1,0,6,.9,.13,p.floor,1.4);this.kit.puff(this.a.x,p.floor+.3,this.a.z,(Math.random()-.5)*3,1.2,(Math.random()-.5)*3,1.1,time,.6,.55);}
      }
      if(end>0&&!p.burst){p.burst=true;this.kit.groundImpact(this.a.x,p.floor,this.a.z,0,1,0,3,time,VIOLET,p.floor);this.kit.streaks(this.a.x,this.a.y,this.a.z,VIOLET,this.kit.n(18,5),14,.035,time);}
      if(end>0&&end<.35){const k=1-end/.35;this.glows.add(this.a,radius*(2+end*8),PURPLE,k,STAR,.2,e.id);this.glows.add(this.a,radius*(1.5+end*10),PALE,.8*k,RING,.04,e.id,.8);}
    }
  }
  private blink(id:string,fighter:Fighter,touring:boolean,time:number){
    let last=this.lastAt.get(id);if(!last){last=fighter.group.position.clone();this.lastAt.set(id,last);}
    const p=fighter.group.position;
    if(touring&&last.distanceToSquared(p)>BLINK_STEP*BLINK_STEP){
      this.dir.copy(last).sub(p);this.kit.ghosts.spawn(fighter,ghostTint('gojo'),time,.34,.85,this.dir);
      const y=p.y+1.05;
      this.kit.ring(p.x,y,p.z,.3,2.2,time,.26,0xffffff,0x7fe6ff,.1);
      this.kit.streaks(p.x,y,p.z,PALE_SPARK,this.kit.n(8,3),8,.02,time);
      this.kit.pulse(p.x,y,p.z,0x7fe6ff,2.2,6,time,.22);
    }
    last.copy(p);
  }
  private strikes(id:string,fighter:Fighter,fighters:ReadonlyMap<string,Fighter>,move:{contacts:number[]},elapsed:number,time:number){
    const s=fighter.state,last=move.contacts.length-1;
    let fired=this.fired.get(id);if(!fired){fired={key:NaN,contact:0};this.fired.set(id,fired);}
    if(fired.key!==s.actionStarted){fired.key=s.actionStarted;fired.contact=0;}
    let due=fired.contact;while(due<last&&elapsed>=move.contacts[due+1])due++;
    if(due===fired.contact)return;
    fired.contact=due;
    const fx=Math.sin(s.yaw),fz=Math.cos(s.yaw);let victim:Fighter|undefined,best=-Infinity;
    for(const [other,body] of fighters){const q=body.state;if(other===id||!q.alive||other.startsWith('warm-'))continue;
      const dx=q.x-s.x,dz=q.z-s.z,dist=Math.hypot(dx,dz);if(dist>STRIKE_REACH||dist<1e-3)continue;const along=(dx*fx+dz*fz)/dist;if(along<.5)continue;
      if(along*2-dist>best){best=along*2-dist;victim=body;}}
    if(!victim)return;
    const v=victim.group.position;this.c.set(v.x,v.y+1.1,v.z);
    if(due<last){
      this.kit.ring(this.c.x,this.c.y,this.c.z,.2,1.6,time,.22,0xffffff,0x7fe6ff,.1);
      this.kit.streaks(this.c.x,this.c.y,this.c.z,PALE_SPARK,this.kit.n(10,4),10,.022,time,this.dir.set(fx,0,fz),.6);
      this.kit.pulse(this.c.x,this.c.y,this.c.z,0x9fe8ff,2.4,6,time,.2);
      return;
    }
    const flash=this.flashes[this.flashNext++%this.flashes.length];flash.at.copy(this.c);flash.born=time;flash.seed=(Math.round(s.actionStarted*997)%89)+7;
    this.kit.ring(this.c.x,this.c.y,this.c.z,.4,3.4,time,.36,0xffffff,0xff2030,.12);
    this.kit.streaks(this.c.x,this.c.y,this.c.z,BLACK_SPARK,this.kit.n(22,6),15,.032,time,this.dir.set(fx,0,fz),.5);
    this.kit.pulse(this.c.x,this.c.y,this.c.z,0xff2030,4.5,9,time,.4);
    if(involvesLocal(id,victim.state.id))SIGNATURE.screen?.impactFrame?.(.9);
  }
  reset(){this.blues=[];this.hollows.clear();this.anchors.clear();this.lastAt.clear();this.fired.clear();for(const flash of this.flashes)flash.born=-Infinity;this.charges=[];this.purples=[];this.seen.clear();this.graded.clear();this.domain.reset();this.painter.clearSparks();this.streaks.begin();this.glows.begin(0);this.halos.begin(0);this.lights.begin();this.spheres.begin();this.trench.begin();this.streaks.end();this.glows.end();this.halos.end();this.lights.end();this.spheres.end();this.trench.end();}
  dispose(){this.reset();this.streaks.dispose();this.glows.dispose();this.halos.dispose();this.lights.dispose();this.spheres.dispose();this.domain.dispose();this.trench.dispose();}
}
