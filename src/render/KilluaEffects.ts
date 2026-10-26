import * as THREE from 'three';
import type {CombatEvent} from '../game/types';
import {MOVES,type MoveDefinition} from '../game/moves';
import {comboMove} from '../game/combos';
import type {Fighter} from './Fighter';
import {FLIGHTS, chargeWasCancelled} from './CombatEffects';
import {ElectricKit} from './signature/ElectricKit';
import {GLOW} from './signature/GlowBatch';
import {castAge} from './signature/castClock';
import {beats,ultimateEnd} from './signature/ultimateClock';
import {bodyCenter} from './signature/body';
import {struckBody,FIZZLE_REACH} from './signature/struck';

const clean=(n:string)=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
const noise=(n:number)=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
const salt=(id:string)=>{let h=11;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))%9973;return h;};
const KILLUA={glow:new THREE.Color(.5,.85,2.5),deep:new THREE.Color(.22,.5,2.2),light:new THREE.Color(.55,.8,1.7),halo:new THREE.Color(.12,.3,1.0)};
type Cast={event:CombatEvent;move:MoveDefinition;ended?:number;trail:string;flight:string;hold?:number;releasedAt?:number;drawn?:number};
export class KilluaEffects{
  private kit:ElectricKit;
  private casts:Cast[]=[];
  private seen=new Set<number>();
  private a=new THREE.Vector3();private b=new THREE.Vector3();private c=new THREE.Vector3();
  private joints=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  constructor(scene:THREE.Scene){this.kit=new ElectricKit(scene,'killua-lightning',1800);}
  handle(events:CombatEvent[]){
    for(const event of events){
      if(this.seen.has(event.id))continue;this.seen.add(event.id);if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!);
      const ender=event.kind==='cast'&&event.fighter==='killua'&&event.branch?comboMove('killua',event.branch):undefined;
      const thrown=event.kind==='cast'&&event.fighter==='killua'&&event.origin&&event.endpoint?(event.branch?ender?.style==='projectile'?ender:undefined:event.slot==='special'?MOVES.killua.special:undefined):undefined;
      if(thrown){this.casts.push({event,move:thrown,trail:'narukami:'+event.id,flight:`${event.id}:0`});if(this.casts.length>16)this.kit.forget(this.casts.shift()!.trail);}
      if(['hit','blocked','guard-break'].includes(event.kind))for(const c of this.casts)if(c.event.actorId===event.actorId&&event.slot===c.event.slot&&event.fighter==='killua'&&event.serverTime>c.event.serverTime&&!c.ended)c.ended=event.serverTime;
    }
  }
  private joint(fighter:Fighter,canonical:string,spelled:string,out:THREE.Vector3){
    const bone=fighter.joints.get(canonical)??fighter.bones.get(clean(spelled));
    if(bone)bone.getWorldPosition(out);else out.copy(fighter.group.position).add(this.c.set(0,.9,0));
    return out;
  }
  update(time:number,fighters:ReadonlyMap<string,Fighter>,density:number){
    const kit=this.kit;kit.begin(time,density);
    for(const [id,f] of fighters){
      const s=f.state;if(!s.alive||s.fighter!=='killua'){kit.forget(id);continue;}
      const t=s.actionTime*s.actionDuration,key=salt(id),floor=s.grounded?f.group.position.y:NaN;
      if(s.action==='heavy'&&!s.branch){
        const move=MOVES.killua.heavy,contact=move.contacts[0];
        const gather=THREE.MathUtils.smoothstep(t,0,contact*.55)*(1-THREE.MathUtils.smoothstep(t,contact*.8,contact));
        const strike=THREE.MathUtils.smoothstep(t,contact-.12,contact-.02)*(1-THREE.MathUtils.smoothstep(t,contact+.28,s.actionDuration));
        if(gather>.02){kit.ball(f.handR,gather*.75,key,floor,KILLUA.glow,KILLUA.light,.5);kit.ball(f.handL,gather*.6,key+2,NaN,KILLUA.glow,KILLUA.light,.45);kit.arc(f.handL,f.handR,kit.tick*3+key,.028*gather,KILLUA.deep,gather,1,3,.3);}
        if(strike>.02){kit.ball(f.handR,(.9+.4*strike)*strike,key+1,floor,KILLUA.glow,KILLUA.light,.34);kit.trail(id,f.handR,strike,key,KILLUA.glow);}
        const drop=1-Math.min(1,Math.abs(t-contact+.02)/.1);
        if(drop>0){this.a.copy(f.handR);this.a.y+=6;this.a.x+=Math.sin(key)*.8;this.a.z+=Math.cos(key)*.8;kit.arc(this.a,f.handR,kit.tick*13+key,.07*drop+.02,KILLUA.glow,drop,3,4,.2);
          const struck=t>=contact-.03?struckBody(f,fighters):undefined;
          if(struck){bodyCenter(struck,this.b);kit.arc(f.handR,this.b,kit.tick*17+key,.05*drop+.015,KILLUA.glow,drop,2,3,.25);kit.flash(this.b,drop,key+9,1.1,KILLUA.glow);}
          else kit.flash(f.handR,drop*.7,key+9,FIZZLE_REACH,KILLUA.glow);}
      }
      if(s.action==='special'&&!s.branch){
        const release=MOVES.killua.special.contacts[0];
        const seal=THREE.MathUtils.smoothstep(t,.08,release*.6)*(1-THREE.MathUtils.smoothstep(t,release,release+.12));
        if(seal>.02){kit.ball(f.handR,seal*.85,key,floor,KILLUA.glow,KILLUA.light,.5);kit.ball(f.handL,seal*.85,key+3,NaN,KILLUA.glow,KILLUA.light,.5);kit.arc(f.handL,f.handR,kit.tick*5+key,.03*seal,KILLUA.deep,seal,2,3,.32);}
      }
      if(s.action==='ultimate'){
        const move=MOVES.killua.ultimate,end=ultimateEnd(s);let near=0;
        for(let i=0,n=beats(s,move);i<n;i++)near=Math.max(near,1-Math.min(1,Math.abs(t-move.contacts[i])/.14));
        const live=THREE.MathUtils.smoothstep(t,.15,.6)*(1-THREE.MathUtils.smoothstep(t,end-.5,end));
        const power=(.5+.6*near)*live;
        kit.ball(f.handR,power,key,floor,KILLUA.glow,KILLUA.light,.34);kit.ball(f.handL,power*.8,key+5,NaN,KILLUA.glow,KILLUA.light,.3);
        kit.trail(id,f.handR,live,key,KILLUA.glow);
        if(near>.55){const struck=struckBody(f,fighters),k=(near-.55)/.45*live;
          if(struck){bodyCenter(struck,this.b);kit.flash(this.b,k,key+7,1,KILLUA.glow);}
          else kit.flash(f.handR,k*.7,key+7,FIZZLE_REACH,KILLUA.glow);}
      }else if(s.action!=='heavy'||s.branch)kit.forget(id);
      if(s.awakened){
        const left=(s.awakenedUntil??0)-time;const strength=THREE.MathUtils.clamp(left,0,1);
        if(strength>.02){
          const J=this.joints;
          this.joint(f,'Head','head',J[0]);this.joint(f,'Spine1','spine1',J[1]);this.joint(f,'Hips','hips',J[2]);
          this.joint(f,'LeftHand','lefthand',J[3]);this.joint(f,'RightHand','righthand',J[4]);
          this.joint(f,'LeftForeArm','leftforearm',J[5]);this.joint(f,'RightForeArm','rightforearm',J[6]);
          this.joint(f,'LeftLeg','leftleg',J[7]);this.joint(f,'RightLeg','rightleg',J[8]);
          const tick=Math.floor(time*8);const arcs=Math.round(7*kit.density);
          for(let i=0;i<arcs;i++){
            const from=Math.floor(noise(tick*3.1+i*1.3+key)*J.length),to=Math.floor(noise(tick*5.7+i*2.9+key)*J.length);
            if(from===to||noise(tick*1.9+i*.7)<.35)continue;
            kit.arc(J[from],J[to],kit.tick*7+i,.02*strength,i%2?KILLUA.glow:KILLUA.deep,strength,1,3,.3);
          }
          this.a.copy(J[0]).y+=.12;
          for(let ray=0;ray<8;ray++){
            const angle=ray*.785+tick*.5,r=.14+noise(tick*2.3+ray)*.16;
            this.b.copy(this.a).add(this.c.set(Math.cos(angle)*r,.1+noise(tick+ray*1.1)*.22,Math.sin(angle)*r));
            kit.arc(this.a,this.b,kit.tick*3+ray,.014*strength,KILLUA.glow,.9*strength,0,2,.35);
          }
          kit.halos.add(J[1],.9,KILLUA.halo,.35*strength*(.7+.3*noise(kit.tick)),GLOW,.02);
          kit.lights.add(J[1],Math.min(2.6,J[1].y-f.group.position.y-.4),KILLUA.light,.35*strength*(.6+.4*noise(kit.tick*1.7)));
          if(kit.ticked&&noise(kit.tick*.37+key)>.6)kit.painter.emit(J[Math.floor(noise(kit.tick)*9)],2,2.2,kit.tick,.009,.3,.8);
        }
      }
    }
    for(let i=this.casts.length-1;i>=0;i--){
      const c=this.casts[i],e=c.event,move=c.move,actor=fighters.get(e.actorId),age=castAge(c,time,actor,move.contacts[0]);
      const travel=move.range/(move.speed??20),limit=Math.max(move.duration,move.contacts[0]+travel);
      if(age>limit+.2||(c.ended&&time-c.ended>.15)||(!c.ended&&age<move.contacts[0]&&chargeWasCancelled(e,move.contacts[0],actor?.state,time))){kit.forget(c.trail);this.casts.splice(i,1);continue;}
      const flight=FLIGHTS.get(c.flight);
      if(!flight?.released)continue;
      const fade=c.ended?1-(time-c.ended)/.15:1;
      kit.ball(flight.position,(1.15+.2*Math.sin(time*41))*fade,salt(e.actorId)+17,NaN,KILLUA.glow,KILLUA.light,.75);
      this.a.copy(flight.position).addScaledVector(flight.heading,-1.6*fade);
      kit.arc(this.a,flight.position,kit.tick*9+1,.05*fade,KILLUA.deep,fade,2,4,.24);
      for(const side of [-1,1]){this.b.copy(flight.position).addScaledVector(flight.heading,-.7).add(this.c.set(-flight.heading.z*side*.4,.18,flight.heading.x*side*.4));kit.arc(this.b,flight.position,kit.tick*9+side*3,.025*fade,KILLUA.glow,.9*fade,1,3,.3);}
      kit.trail(c.trail,flight.position,fade,salt(e.actorId)+19,KILLUA.glow);
    }
    kit.end();
  }
  reset(){this.casts=[];this.seen.clear();this.kit.reset();}
  dispose(){this.reset();this.kit.dispose();}
}
