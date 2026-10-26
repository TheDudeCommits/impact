import * as THREE from 'three';
import type {Fighter} from './Fighter';
import {FLIGHTS} from './CombatEffects';
import {MOVES,WHIFF_RECOVERY} from '../game/moves';
import {comboMove} from '../game/combos';
import {fireFistMaterial,fireTongueMaterial} from './vfx/FireFistMaterial';
import {fireFistGeometry} from './vfx/FireFistGeometry';
import {VfxKit} from './vfx/VfxKit';
import type {Element} from './vfx/palette';
import {GiantFists} from './signature/GiantFist';
import {bodyCenter} from './signature/body';
import {SIGNATURE,involvesLocal,gradeOnce,gradeLocal,GRADE} from './signature/context';
import {GatlingFists} from './signature/GatlingFists';
import {AWAKENING_ENTRY,awakeningSwapAt} from '../game/awakening';
import {BLACK,FIRE,flamePalette,flameSpriteGeometry,flameSpriteMaterial} from './signature/FlameSprites';
import {GlowBatch,GLOW,STAR,RING} from './signature/GlowBatch';
import {LightVolumes} from './signature/LightVolumes';
import {beats} from './signature/ultimateClock';
import {BAJRANG_TAKE,bajrangOut} from './luffy/bajrang';
import {armoryDraws} from './vfx/armory/drawn';

const GATLING_MOVE=MOVES.luffy.special;
const BAJRANG_MOVE=MOVES.luffy.ultimate,BAJRANG=BAJRANG_MOVE.contacts[BAJRANG_MOVE.contacts.length-1],BAJRANG_OPEN=BAJRANG_MOVE.contacts[0];
const GATLING_PHANTOM={lead:.07,rate:72,life:.12,hawk:.2,dawn:.38,hawkArm:.055,dawnArm:.09,spread:.55,dawnSpread:.8,ahead:7};
const BAJRANG_FIST={from:.3,drive:.24,small:.35,big:2,over:.08,toward:.6,gone:.6,rise:.32};
const BAJRANG_SPRING=.22;
const BLAZE:Element={spike:0xffe2a0,rim:0xff5a12,light:0xff7a2a,ink:0x1a0602};
const ELEPHANT=comboMove('luffy','lh'),RED_ROC=comboMove('luffy','airSpecial');
const G5_ENDER={lh:comboMove('luffy','lh',true),llh:comboMove('luffy','llh',true),lllh:comboMove('luffy','lllh',true),llls:comboMove('luffy','llls',true),airHeavy:comboMove('luffy','airHeavy',true)};
const HAKI_FIST:Element={spike:0xffd8c8,rim:0xc01a12,light:0xff5a3a,ink:0x0a0204};
const HAOSHOKU:Element={spike:0xffe2e2,rim:0xd0102a,light:0xff2a3a,ink:0x060002};
const NIKA:Element={spike:0xffffff,rim:0xffd98a,light:0xfff2d6,ink:0x120a04};
const BOLT:Element={spike:0xf2fbff,rim:0x5aa8ff,light:0x9fd0ff,ink:0x0c1426};
const BOLT_GLOW=new THREE.Color(.55,.8,1.6);
const hash=(x:number)=>{const v=Math.sin(x*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
const FORWARD=new THREE.Vector3(0,0,1);
const MOUTON_RELEASE=MOVES.sanji.special.contacts[0];
const HIKEN_RELEASE=MOVES.ace.special.contacts[0];
const KAGERO_RELEASE=MOVES.ace.heavy.contacts[0],KAGERO_LINGER=.32;
const HELL=MOVES.sanji.ultimate;
const BURST={hawk:{size:1,life:.45},mouton:{size:1.25,life:.5},kagero:{size:.95,life:.42},hiken:{size:1.7,life:.62},kick:{size:.8,life:.34},blaze:{size:1.8,life:1}} as const;
type Fire=keyof typeof BURST;
const FLAME={glare:new THREE.Color(1.6,.62,.12),halo:new THREE.Color(.9,.3,.05),light:new THREE.Color(1.25,.55,.16),ember:new THREE.Color(2.2,.9,.2),mugetsu:new THREE.Color(.45,.05,.6)};

export class LuffyEffects {
  private flameGeometry=flameSpriteGeometry();
  private steamGeometry=new THREE.SphereGeometry(1,10,7);
  private flameMaterial=flameSpriteMaterial();
  private steamMaterial=new THREE.ShaderMaterial({name:'GearSteam',toneMapped:false,
    vertexShader:'varying vec3 vN;void main(){vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec3 vN;void main(){float k=dot(normalize(vN),normalize(vec3(.3,.85,.4)));vec3 c=k>.35?vec3(1.,.97,.93):k>-.2?vec3(.8,.75,.74):vec3(.56,.5,.53);gl_FragColor=vec4(c,1.);}'});
  private steamInkMaterial=new THREE.ShaderMaterial({name:'GearSteamInk',side:THREE.BackSide,toneMapped:false,
    vertexShader:'void main(){vec4 clip=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);vec2 d=(projectionMatrix*vec4(normalize(normalMatrix*mat3(instanceMatrix)*normal),0.)).xy;float l=length(d);if(l>1e-5)clip.xy+=d/l*.0045*clip.w;clip.z+=.0004*clip.w;gl_Position=clip;}',
    fragmentShader:'void main(){gl_FragColor=vec4(.03,.02,.03,1.);}'});
  private mistMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,uniforms:{clock:{value:0}},vertexShader:'varying vec2 uvp;void main(){uvp=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 uvp;uniform float clock;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec2 p=uvp;float n=noise(p*4.0+vec2(clock*.7,-clock*1.3))*.65+noise(p*9.0-clock*.5)*.35;float alpha=smoothstep(.25,.7,n)*(1.0-smoothstep(.3,1.0,length(p)));gl_FragColor=vec4(mix(vec3(.01,.005,.025),vec3(.22,.12,.3),n*.4),alpha*.68);}`});
  private mistGeometry=new THREE.PlaneGeometry(1,1);
  private mist=new THREE.InstancedMesh(this.mistGeometry,this.mistMaterial,192);
  private flames=new THREE.InstancedMesh(this.flameGeometry,this.flameMaterial,768);
  private wakeGeometry=new THREE.PlaneGeometry(1,1);
  private wakeMaterial=fireTongueMaterial();
  private wake=new THREE.InstancedMesh(this.wakeGeometry,this.wakeMaterial,384);
  private steam=new THREE.InstancedMesh(this.steamGeometry,this.steamMaterial,768);
  private steamInk=new THREE.InstancedMesh(this.steamGeometry,this.steamInkMaterial,768);
  private glows=new GlowBatch(96,'fire-glow',true);
  private lights=new LightVolumes(6,'fire-light');
  private transform=new THREE.Object3D();
  private forward=new THREE.Vector3();
  private lean=new THREE.Vector3();
  private offset=new THREE.Vector3();
  private at=new THREE.Vector3();
  private color=new THREE.Color();
  private up=new THREE.Vector3(0,1,0);
  private foot=new THREE.Vector3();
  private knee=new THREE.Vector3();
  private arm=new THREE.Vector3();private aim=new THREE.Vector3();private goal=new THREE.Vector3();private shoulder=new THREE.Vector3();
  private side=new THREE.Vector3();private across=new THREE.Vector3();private tip=new THREE.Vector3();
  private fistGeometry=fireFistGeometry();
  private fireFist=fireFistMaterial();
  private hawkFists:THREE.Mesh[]=[];
  private hawkCount=0;
  private bursts=Array.from({length:10},()=>({position:new THREE.Vector3(),born:-9,size:1,life:.45,column:false}));
  private fires=new Map<string,{position:THREE.Vector3;from:THREE.Vector3;seen:number;born:number;kind:Fire;burst?:boolean}>();
  private kicked=new Map<string,number>();private flared=new Map<string,number>();
  private burstNext=0;
  private bajrangFists:GiantFists;
  private landed=new Set<number>();
  private gatlingFists:GatlingFists;
  private gatlingShown=new Map<string,{cast:number;contact:number}>();
  private g5Landed=new Map<string,number>();
  private clouds=new Map<string,{born:number;size:number;key:number;at:THREE.Vector3}>();
  private burst(id:string,born:number,size:number,key:number,at?:THREE.Vector3){
    let cloud=this.clouds.get(id);if(cloud?.key===key)return;
    if(!cloud){cloud={born,size,key,at:new THREE.Vector3()};this.clouds.set(id,cloud);}
    cloud.born=born;cloud.size=size;cloud.key=key;if(at)cloud.at.copy(at);
  }
  private nextSteam=0;
  private rocs=new Map<string,{cast:number;at:THREE.Vector3;since:number}>();
  private elephants=new Map<string,number>();
  private sprung=new Set<number>();
  private gripped=new Set<number>();
  private kit:VfxKit;
  private nextPuff=0;
  constructor(scene:THREE.Scene){for(const mesh of [this.flames,this.steam,this.mist,this.wake]){mesh.count=0;mesh.setColorAt(0,new THREE.Color(0xffffff));mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}this.flames.name='red-hawk-fire';this.steam.name='luffy-cloud';this.steamInk.instanceMatrix=this.steam.instanceMatrix;this.steamInk.count=0;this.steamInk.frustumCulled=false;this.steamInk.name='luffy-cloud-ink';scene.add(this.steamInk);this.wake.name='hiken-fire-wake';scene.add(this.glows.mesh,this.lights.mesh);
    for(let i=0;i<4;i++){const fist=new THREE.Mesh(this.fistGeometry,this.fireFist);fist.name='red-hawk-fist';fist.frustumCulled=false;fist.renderOrder=3;fist.visible=i===0;if(i===0){fist.position.set(0,-50,0);fist.scale.setScalar(.001);}scene.add(fist);this.hawkFists.push(fist);}
    this.bajrangFists=new GiantFists(scene,2,this.fistGeometry);this.gatlingFists=new GatlingFists(scene,this.fistGeometry,48);this.kit=VfxKit.for(scene);}
  private hawkFist(at:THREE.Vector3,aim:THREE.Vector3,size:number){if(this.hawkCount>=this.hawkFists.length||size<.01)return;const fist=this.hawkFists[this.hawkCount++];fist.visible=true;fist.position.copy(at);fist.quaternion.setFromUnitVectors(FORWARD,aim);fist.scale.setScalar(size);}
  private blaze(at:THREE.Vector3,time:number,kind:Fire,column=false){const b=this.bursts[this.burstNext];this.burstNext=(this.burstNext+1)%this.bursts.length;b.position.copy(at);b.born=time;b.size=BURST[kind].size;b.life=BURST[kind].life;b.column=column;}
  private flame(index:number,heat:number,seed:number,palette=FIRE){this.transform.updateMatrix();this.flames.setMatrixAt(index,this.transform.matrix);this.flames.setColorAt(index,this.color.setRGB(heat,seed%1,flamePalette(palette)));}
  update(time:number,fighters:ReadonlyMap<string,Fighter>,density:number){
    let flame=0,steam=0,mist=0,wake=0;this.mistMaterial.uniforms.clock.value=time;this.wakeMaterial.uniforms.uTime.value=time;this.flameMaterial.uniforms.uTime.value=time;
    this.glows.begin(time);this.lights.begin();this.bajrangFists.begin(time);this.gatlingFists.begin(time);this.hawkCount=0;this.fireFist.uniforms.uTime.value=time;
    const flicker=.85+.15*Math.sin(time*23)*Math.sin(time*9.7);
    for(const fighter of fighters.values()){
      const s=fighter.state;if(!s.alive)continue;
      if(s.fighter==='ichigo'&&s.action==='ultimate'){
        const t=s.actionTime*s.actionDuration,landed=s.confirmedAt!==undefined,open=MOVES.ichigo.ultimate.contacts[0];
        const birth=t<open+.6?open+.02:s.actionDuration-.54,age=landed?t-birth:-1;
        if(age>=0&&age<.78){const strength=THREE.MathUtils.smoothstep(age,0,.14)*(1-THREE.MathUtils.smoothstep(age,.42,.78));
          for(let i=0;i<16&&mist<192;i++){const a=i*2.4+age*3,r=.28+age*.3;this.transform.position.copy(fighter.group.position).add(this.offset.set(Math.cos(a)*r,.1+(i%6)*.33+age*.45,Math.sin(a)*r));this.transform.rotation.set(0,s.yaw+(i%2)*.5,(i%3-1)*.3);this.transform.scale.set((.7+(i%3)*.13)*strength,(1.1+(i%4)*.16)*strength,1);this.transform.updateMatrix();this.mist.setMatrixAt(mist++,this.transform.matrix);}
        }
        continue;
      }
      if(s.fighter==='sanji'){
        const t=s.actionTime*s.actionDuration,ultimate=s.action==='ultimate';
        if(s.action==='special'&&!s.branch||ultimate){
          const contact=ultimate?MOVES.sanji.ultimate.contacts[MOVES.sanji.ultimate.contacts.length-1]:MOUTON_RELEASE;const clearContact=1-.72*THREE.MathUtils.smoothstep(t,contact-.2,contact-.08)*(1-THREE.MathUtils.smoothstep(t,contact+.12,contact+.3));
          const thrown=ultimate?1:1-.8*THREE.MathUtils.smoothstep(t,contact,contact+.35);
          const strength=THREE.MathUtils.smoothstep(t,.1,ultimate?.65:.4)*(1-THREE.MathUtils.smoothstep(t,s.actionDuration-.55,s.actionDuration))*clearContact*thrown;
          fighter.bones.get('rightfoot')?.getWorldPosition(this.foot);fighter.bones.get('rightleg')?.getWorldPosition(this.knee);this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));
          this.lean.copy(this.forward).multiplyScalar(-.6).add(this.up).normalize();
          const count=Math.round((ultimate?48:30)*density);
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*2.4+i*.618)%1,a=i*2.399+time*2;
            if(ultimate&&i%3!==0)this.transform.position.copy(fighter.group.position).addScaledVector(this.forward,-.25).add(this.offset.set(Math.cos(a)*.28,.15+(i%9)*.19+phase*.3,Math.sin(a)*.28));
            else this.transform.position.copy(this.foot).lerp(this.knee,(i%7)/7).add(this.offset.set(Math.cos(a)*.085,phase*.16,Math.sin(a)*.085));
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean);this.transform.scale.setScalar((1-phase)*strength*(ultimate?1.15:1.0));this.flame(flame++,1-phase*.8,i*.618);
          }
          if(strength>.02){this.at.copy(this.foot).lerp(this.knee,.4);this.glows.add(this.at,.55*strength,FLAME.halo,.45*strength*flicker,GLOW,0);this.lights.add(this.at,2.6,FLAME.light,.4*strength*flicker);}
        }
        if(s.action==='special'&&!s.branch&&t>.04&&t<MOUTON_RELEASE+.08){
          const whirl=THREE.MathUtils.smoothstep(t,.04,.3)*(1-THREE.MathUtils.smoothstep(t,MOUTON_RELEASE-.03,MOUTON_RELEASE+.08));
          const count=Math.round(30*density);
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*3.1+i*.618)%1,a=i*2.399963+time*11,r=.42+.16*Math.sin(i*1.7)+phase*.12;
            this.transform.position.copy(fighter.group.position).add(this.offset.set(Math.cos(a)*r,.06+phase*(.35+.5*whirl),Math.sin(a)*r));
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean.set(-Math.sin(a)*.5,1,Math.cos(a)*.5).normalize());
            this.transform.scale.setScalar((1-phase)*whirl*(.75+.35*(i%3)/2));this.flame(flame++,1-phase*.85,i*.618);
          }
          if(whirl>.02){this.at.copy(fighter.group.position);this.at.y+=.3;this.glows.add(this.at,1.1*whirl,FLAME.halo,.35*whirl*flicker,GLOW,0);this.lights.add(this.at,3.4,FLAME.light,.55*whirl*flicker);}
        }
        if(ultimate&&s.confirmedAt!==undefined){
          const drawn=beats(s,HELL);
          for(let k=1;k<drawn;k++){
            if(t<HELL.contacts[k]||t>HELL.contacts[k]+.1)continue;
            const key=Math.round(s.actionStarted*1000)*16+k;if(this.kicked.get(s.id)===key)continue;this.kicked.set(s.id,key);
            const victim=s.target?fighters.get(s.target):undefined;
            if(victim)bodyCenter(victim,this.at);else this.at.copy(fighter.group.position).addScaledVector(this.forward,1.3).addScaledVector(this.up,1.1);
            const last=k===HELL.contacts.length-1;
            this.blaze(this.at,time,last?'blaze':'kick',last);
            if(last){
              const floor=victim?victim.group.position.y:fighter.group.position.y;
              this.kit.ring(this.at.x,floor+.05,this.at.z,.6,5.2,time,.55,0xfff0c8,FLAME.ember.getHex(),.14,'flat');
              this.kit.streaks(this.at.x,this.at.y,this.at.z,BLAZE,this.kit.n(22,8),14,.04,time,this.up,.9);
              this.kit.groundImpact(this.at.x,floor,this.at.z,0,1,0,3,time,BLAZE,floor);
            }else this.kit.streaks(this.at.x,this.at.y,this.at.z,BLAZE,this.kit.n(6+k*2,3),8+k*1.5,.025,time,this.forward,.7);
          }
        }
        continue;
      }
      if(s.fighter==='ace'){
        const t=s.actionTime*s.actionDuration;this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));
        if(s.action==='special'&&!s.branch&&t>.12&&t<HIKEN_RELEASE+.1){
          const strength=THREE.MathUtils.smoothstep(t,.08,.45)*(1-THREE.MathUtils.smoothstep(t,HIKEN_RELEASE-.06,HIKEN_RELEASE+.08));
          const count=Math.round(48*density);this.lean.copy(this.forward).multiplyScalar(-.8).add(this.up).normalize();
          bodyCenter(fighter,this.shoulder);this.shoulder.y+=.45;
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*3.4+i*.618)%1,angle=i*2.4+time*7,trail=phase*.55,along=i%4===0?(i*.37)%1:0;
            this.transform.position.copy(fighter.handR).lerp(this.shoulder,along*.8).addScaledVector(this.forward,-trail);this.transform.position.y+=Math.sin(angle)*.12+phase*.25;this.transform.position.x+=Math.cos(angle)*.12;
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean);
            const size=(1-phase)*strength*(1-along*.4);this.transform.scale.setScalar(size*(i%3===0?1.6:1.15));this.flame(flame++,1-phase*.7,i*.618);
          }
          if(strength>.02){this.glows.add(fighter.handR,.9*strength,FLAME.halo,.55*strength*flicker,GLOW,0);this.lights.add(fighter.handR,4,FLAME.light,.65*strength*flicker);}
          if(t>=HIKEN_RELEASE){const key=Math.round(s.actionStarted*1000)*2+1;if(this.flared.get(s.id)!==key){this.flared.set(s.id,key);
            this.kit.ring(fighter.handR.x,fighter.handR.y,fighter.handR.z,.25,2.6,time,.26,0xfff0c8,BLAZE.rim,.12,'plane',this.forward.x,0,this.forward.z);
            this.kit.streaks(fighter.handR.x,fighter.handR.y,fighter.handR.z,BLAZE,this.kit.n(16,6),13,.035,time,this.forward,.9);}}
        }
        if(s.action==='heavy'&&!s.branch&&t>.04&&t<KAGERO_RELEASE+.12){
          const gather=THREE.MathUtils.smoothstep(t,.04,KAGERO_RELEASE-.02)*(1-THREE.MathUtils.smoothstep(t,KAGERO_RELEASE+.02,KAGERO_RELEASE+.12));
          this.at.copy(fighter.handR).lerp(fighter.handL,.5);
          const count=Math.round(28*density);this.lean.copy(this.forward).multiplyScalar(-.5).add(this.up).normalize();
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*3.6+i*.618)%1,a=i*2.399963+time*6,hand=i%2?fighter.handR:fighter.handL;
            this.transform.position.copy(hand).add(this.offset.set(Math.cos(a)*.09,phase*.22,Math.sin(a)*.09));
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean);this.transform.scale.setScalar((1-phase)*gather*1.05);this.flame(flame++,1-phase*.7,i*.618);
          }
          if(gather>.02){this.glows.add(this.at,.8*gather,FLAME.halo,.55*gather*flicker,GLOW,0);this.lights.add(this.at,3.4,FLAME.light,.65*gather*flicker);}
          if(t>=KAGERO_RELEASE){const key=Math.round(s.actionStarted*1000)*2;if(this.flared.get(s.id)!==key){this.flared.set(s.id,key);
            this.kit.ring(this.at.x,this.at.y,this.at.z,.2,2,time,.24,0xfff0c8,BLAZE.rim,.12,'plane',this.forward.x,0,this.forward.z);
            this.kit.streaks(this.at.x,this.at.y,this.at.z,BLAZE,this.kit.n(14,5),12,.03,time,this.forward,.9);}}
        }
        if(s.action==='ultimate'&&t>.3&&t<s.actionDuration-.4){
          const gather=THREE.MathUtils.smoothstep(t,.3,1.2)*(1-THREE.MathUtils.smoothstep(t,MOVES.ace.ultimate.contacts[0],MOVES.ace.ultimate.contacts[0]+.4));
          const count=Math.round(40*density);
          for(let i=0;i<count&&flame<768;i++){
            const phase=(time*2.6+i*.618)%1,a=i*2.399+time*1.6;
            if(i%2===0)this.transform.position.copy(fighter.handR).add(this.offset.set(Math.cos(a)*.12,phase*.5,Math.sin(a)*.12));
            else this.transform.position.copy(fighter.group.position).add(this.offset.set(Math.cos(a)*.34,.1+(i%9)*.2+phase*.35,Math.sin(a)*.34));
            this.transform.quaternion.setFromUnitVectors(this.up,this.lean.set(Math.cos(a)*.15,1,Math.sin(a)*.15).normalize());this.transform.scale.setScalar((1-phase)*gather*(i%2===0?1.5:1));this.flame(flame++,1-phase*.75,i*.618);
          }
        }
        continue;
      }
      if(s.fighter!=='luffy')continue;
      const t=s.actionTime*s.actionDuration;this.forward.set(Math.sin(s.yaw),0,Math.cos(s.yaw));
      if(s.action==='heavy'&&s.branch==='lh'&&!s.awakened)this.elephantGun(fighter,t,time,fighters);
      if(s.awakened&&s.branch&&(s.action==='heavy'||s.action==='special'))this.g5Ender(fighter,t,time,fighters);
      flame=this.redRoc(fighter,t,time,flame,density);
      if(s.action==='special'&&!s.branch){
        gradeLocal(s.id,s.actionStarted,GRADE.getsuga,.35,GATLING_MOVE.contacts[GATLING_MOVE.contacts.length-1]+.4,fighter.group.position,s.id,s.target??undefined);
        this.gatling(fighter,t,time,fighters);
      }
      if(s.action==='ultimate'&&s.confirmedAt!==undefined)gradeOnce(s.id,s.actionStarted,GRADE.getsuga,.5,Math.max(.3,BAJRANG+.6-t),s.id,s.target??undefined);
      steam=this.nikaClouds(fighter,t,time,steam);
      if(s.action==='ultimate')this.bajrang(fighter,t,time,fighters);
    }
    for(const [flightKey,flight] of FLIGHTS){
      if(armoryDraws(flight.fighter,flight.slot,flight.branch,flight.actorId))continue;
      if(flight.fighter==='ace'&&flight.slot==='ultimate'){
        const age=Math.max(0,time-flight.since+MOVES.ace.ultimate.contacts[0]);
        const grown=THREE.MathUtils.smoothstep(age,.2,1.4),count=Math.round(84*density);
        for(let i=0;i<count&&flame<768;i++){
          const phase=(time*1.9+i*.618)%1,a=i*2.399963+time*.9,b=i*1.7;
          const r=2.15*grown;
          this.forward.set(Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b));
          this.transform.position.copy(flight.position).addScaledVector(this.forward,r+phase*.5);
          if(flight.released)this.transform.position.addScaledVector(flight.heading,-phase*2.2*(i%3));
          this.transform.quaternion.setFromUnitVectors(this.up,this.lean.copy(this.forward).addScaledVector(this.up,.4).normalize());
          this.transform.scale.setScalar((1-phase*.6)*grown*(i%3===0?3.2:2.3));this.flame(flame++,.52-phase*.3,i*.618);
        }
        this.lights.add(flight.position,9*grown,FLAME.light,.5*grown*flicker);
        const embers=Math.round(24*density);
        for(let i=0;i<embers;i++){const phase=(time*.7+i*.618)%1,a=i*2.399963+time*.3,b=Math.sin(i*1.9)*.9;this.at.set(Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)).multiplyScalar(2.2*grown*(1.05+phase*1.1)).add(flight.position);this.at.y+=phase*1.6;this.glows.add(this.at,.07+.05*(i%3),FLAME.ember,(1-phase)*grown,GLOW,.5);}
        continue;
      }
      const ender=flight.branch!==undefined;
      const kagero=flight.fighter==='ace'&&flight.slot==='heavy'&&!ender;
      if(!flight.released||flight.slot!=='special'&&!ender&&!kagero)continue;
      if(flight.fighter==='luffy'){this.boltFlight(flight.position,flight.heading,time,flicker);continue;}
      if(flight.fighter!=='sanji'&&flight.fighter!=='ace')continue;
      const ace=flight.fighter==='ace'&&!ender&&!kagero,mouton=flight.fighter==='sanji'&&!ender;
      const age=Math.max(0,time-flight.since),count=Math.round((ace?72:mouton?56:34)*density);
      const head=Math.min(1,age/.08);
      if(mouton||ace||kagero){
        let fire=this.fires.get(flightKey);
        if(!fire){fire={position:new THREE.Vector3(),from:flight.position.clone(),seen:time,born:time,kind:mouton?'mouton':ace?'hiken':'kagero'};this.fires.set(flightKey,fire);}
        fire.position.copy(flight.position);fire.seen=time;
        if(kagero)continue;
      }
      this.glows.add(flight.position,(ace?1.5:mouton?1.15:.75)*head,FLAME.halo,(ace?.55:.45)*head*flicker,GLOW,0);
      this.lights.add(flight.position,ace?5.5:mouton?4.5:3.2,FLAME.light,(ace?.75:.6)*head*flicker);
      if(ace){
        for(let i=0;i<count&&wake<384;i++){
          const phase=(time*2.1+i*.618)%1,angle=i*2.4,spread=.2+phase*.38;
          this.transform.position.copy(flight.position).addScaledVector(flight.heading,-.75-phase*Math.min(3.4,.6+age*14));
          this.transform.position.y+=Math.sin(angle)*spread+phase*.12;
          this.transform.position.x+=Math.cos(angle)*spread*flight.heading.z;
          this.transform.position.z-=Math.cos(angle)*spread*flight.heading.x;
          this.forward.copy(flight.heading).negate().addScaledVector(this.up,.15).normalize();
          this.transform.quaternion.setFromUnitVectors(this.up,this.forward);
          this.transform.rotateY(angle);
          const taper=(1-phase*.62)*head;
          this.transform.scale.set(.52*taper,(1.1+(i%3)*.2)*taper,1);
          this.transform.updateMatrix();this.wake.setMatrixAt(wake,this.transform.matrix);
          this.color.setRGB((i*.381966)%1,0,0);this.wake.setColorAt(wake++,this.color);
        }
        continue;
      }
      this.lean.copy(flight.heading).multiplyScalar(-1).addScaledVector(this.up,.35).normalize();
      for(let i=0;i<count&&flame<768;i++){
        const phase=(time*3.4+i*.618)%1,angle=i*2.4+time*9;
        const trail=phase*(mouton?Math.min(2.2,.3+age*16):1.1),spread=mouton?.55+phase*.3:.34+phase*.12;
        this.transform.position.copy(flight.position).addScaledVector(flight.heading,-trail);
        this.transform.position.y+=Math.sin(angle)*spread*.5+phase*.12;
        this.transform.position.x+=Math.cos(angle)*spread*flight.heading.z;this.transform.position.z-=Math.cos(angle)*spread*flight.heading.x;
        this.transform.quaternion.setFromUnitVectors(this.up,this.lean);
        const size=(1-phase*.7)*head*(mouton?1.85:1.25);this.transform.scale.setScalar(size*(i%3===0?1.3:1));this.flame(flame++,1-phase*.75,i*.618);
      }
    }
    for(const [key,fire] of this.fires){
      const gone=time-fire.seen;
      if(gone>1e-4&&!fire.burst){fire.burst=true;const kind=BURST[fire.kind];this.blaze(fire.position,time,fire.kind);
        this.kit.streaks(fire.position.x,fire.position.y,fire.position.z,BLAZE,this.kit.n(Math.round(10+kind.size*6),4),9+kind.size*3,.03,time);
        this.kit.ring(fire.position.x,fire.position.y,fire.position.z,.3*kind.size,2.4*kind.size,time,.3,0xfff0c8,BLAZE.rim,.12);}
      if(fire.kind==='kagero'){
        const head=gone<=1e-4?Math.min(1,(time-fire.born)/.06):1-THREE.MathUtils.smoothstep(gone,.05,KAGERO_LINGER);
        if(head>.01){this.aim.copy(fire.position).sub(fire.from).setY(0);if(this.aim.lengthSq()<1e-6)this.aim.set(0,0,1);this.aim.normalize();this.goal.copy(this.aim);
          this.kagero(fire.from,fire.position,this.goal,time-fire.born,head,time,density,flicker,flame);flame=Math.min(768,flame+this.jetDrawn);}
      }
      if(gone>1e-4&&(fire.kind!=='kagero'||gone>KAGERO_LINGER))this.fires.delete(key);
    }
    for(const b of this.bursts){const age=time-b.born;if(age<0||age>b.life)continue;const k=1-age/b.life,grow=age*.45/b.life;
      for(let i=0,n=Math.round((b.size>1.5?40:28)*Math.max(.6,density));i<n&&flame<768;i++){const a=i*2.399,tilt=Math.sin(i*1.7)*1.2,r=(.3+grow*6)*b.size*(.6+.4*((i*.37)%1));this.offset.set(Math.cos(a)*Math.cos(tilt),Math.sin(tilt)*.7+.3,Math.sin(a)*Math.cos(tilt));this.transform.position.copy(b.position).addScaledVector(this.offset,r);this.transform.quaternion.setFromUnitVectors(this.up,this.offset.normalize());this.transform.scale.setScalar(2.6*k*Math.sqrt(b.size));this.flame(flame++,.4+.6*k,i*.29);}
      if(b.column)for(let i=0,n=Math.round(22*Math.max(.6,density));i<n&&flame<768;i++){const phase=(time*2.2+i*.618)%1,a=i*2.399+time*3,r=(.35+.25*Math.sin(i*1.3))*b.size*.5;this.transform.position.copy(b.position).add(this.offset.set(Math.cos(a)*r,-.9+(i/n)*3.4*Math.min(1,age*4)+phase*.4,Math.sin(a)*r));this.transform.quaternion.identity();this.transform.scale.setScalar((1.8+.8*(1-i/n))*k*(1-phase*.5));this.flame(flame++,.9-phase*.5,i*.41);}
      const glare=Math.min(1,1.25/b.size);
      this.glows.add(b.position,2.2*Math.min(b.size,1.3)*(1+grow*2),FLAME.glare,k*glare,STAR,.2,7);this.glows.add(b.position,(1.5+grow*9)*Math.min(b.size,1.3),FLAME.halo,.8*k*glare,RING,.05,3,.5);this.lights.add(b.position,7*Math.sqrt(b.size),FLAME.light,1.4*k*glare);}
    for(let i=this.hawkCount;i<this.hawkFists.length;i++)if(i||this.hawkFists[0].position.y>-40)this.hawkFists[i].visible=false;
    this.bajrangFists.end();this.gatlingFists.end();
    this.mist.count=mist;this.mist.instanceMatrix.needsUpdate=true;this.flames.count=flame;this.steam.count=steam;this.steamInk.count=steam;this.flames.instanceMatrix.needsUpdate=true;this.steam.instanceMatrix.needsUpdate=true;if(this.steam.instanceColor)this.steam.instanceColor.needsUpdate=true;if(this.flames.instanceColor)this.flames.instanceColor.needsUpdate=true;
    this.wake.count=wake;this.wake.instanceMatrix.needsUpdate=true;if(this.wake.instanceColor)this.wake.instanceColor.needsUpdate=true;
    this.glows.end();this.lights.end();
  }
  private jetDrawn=0;
  private kagero(from:THREE.Vector3,headAt:THREE.Vector3,heading:THREE.Vector3,age:number,head:number,time:number,density:number,flicker:number,slot:number){
    this.aim.copy(headAt).sub(from);const length=this.aim.length();this.jetDrawn=0;
    if(length<1e-3)return;this.aim.divideScalar(length);
    const side=this.arm.set(heading.z,0,-heading.x),root=THREE.MathUtils.smoothstep(age,.12,.38);
    this.lean.copy(heading).multiplyScalar(-.7).addScaledVector(this.up,.6).normalize();
    for(let i=0,n=Math.round(64*density);i<n&&slot+this.jetDrawn<768;i++){
      const phase=(time*4.2+i*.618)%1,u=((i*.381966)+phase*.35)%1;
      if(u<root*.8)continue;
      const a=i*2.399963+time*7,wide=(.12+.75*u)*(.75+.45*Math.sin(i*1.3+time*5));
      this.transform.position.copy(from).addScaledVector(this.aim,u*length).addScaledVector(side,Math.cos(a)*wide*.6);this.transform.position.y+=Math.sin(a)*wide*.45+phase*.18;
      this.transform.quaternion.setFromUnitVectors(this.up,this.lean);
      this.transform.scale.setScalar((.55+1.2*u)*head*(1-phase*.55)*(i%3===0?1.25:1));this.flame(slot+this.jetDrawn++,1-phase*.6-u*.2,i*.618);
    }
    this.glows.add(headAt,1.3*head,FLAME.halo,.55*head*flicker,GLOW,0);this.lights.add(headAt,4.5,FLAME.light,.75*head*flicker);
    this.at.copy(from).addScaledVector(this.aim,length*.5);this.glows.add(this.at,1.6*head*(1-root*.6),FLAME.halo,.35*head*flicker,GLOW,0);
  }
  private elephantGun(f:Fighter,t:number,time:number,fighters:ReadonlyMap<string,Fighter>){
    const s=f.state,move=ELEPHANT;if(!move)return;
    const c=move.contacts[0],from=c-.2,until=c+.3;
    if(t<from||t>until)return;
    const foe=s.target?fighters.get(s.target):undefined;
    if(foe&&foe.state.alive&&foe.group.position.distanceTo(f.group.position)<move.range+1.5)this.goal.copy(foe.group.position).addScaledVector(this.up,1.15);
    else this.goal.copy(f.group.position).addScaledVector(this.forward,move.range).addScaledVector(this.up,1.2);
    const drive=THREE.MathUtils.smoothstep(t,from,c),back=THREE.MathUtils.smoothstep(t,c+.1,until);
    const size=.62*(.45+.55*drive)*(1-.55*back);
    this.aim.copy(this.goal).sub(f.handR);if(this.aim.lengthSq()<1e-4)this.aim.copy(this.forward);this.aim.normalize();
    this.at.copy(f.handR).lerp(this.offset.copy(this.goal).addScaledVector(this.aim,-size*.7),drive*(1-back*.85));
    bodyCenter(f,this.shoulder);this.shoulder.y+=.45;
    this.bajrangFists.show(s.id,this.at,this.aim,size,this.shoulder,t>=c?1-THREE.MathUtils.smoothstep(t,c+.02,c+.22):0);
    this.lights.add(this.at,2+size*2,FLAME.light,.35+.4*drive);
    const key=Math.round(s.actionStarted*1000);
    if(t>=c&&this.elephants.get(s.id)!==key){this.elephants.set(s.id,key);this.kit.ring(this.goal.x,this.goal.y,this.goal.z,.4,3.4,time,.3,0xffffff,HAKI_FIST.rim,.12,'plane',this.aim.x,0,this.aim.z);this.kit.streaks(this.goal.x,this.goal.y,this.goal.z,HAKI_FIST,this.kit.n(14,5),13,.035,time,this.aim,.9);}
  }
  private redRoc(f:Fighter,t:number,time:number,flame:number,density:number){
    const s=f.state,move=RED_ROC;
    let held=this.rocs.get(s.id);
    if(move&&s.action==='special'&&s.branch==='airSpecial'&&s.grounded&&t>=move.contacts[0]){
      const cast=s.actionSeq??Math.round(s.actionStarted*10);
      if(!held||held.cast!==cast){
        held=held??{cast,at:new THREE.Vector3(),since:time};held.cast=cast;held.since=time;held.at.copy(f.group.position).addScaledVector(this.forward,.6);this.rocs.set(s.id,held);
        this.blaze(this.at.copy(held.at).addScaledVector(this.up,.5),time+.1,'hawk');
      }
    }
    if(!held)return flame;
    const age=time-held.since;if(age<0||age>.32)return flame;
    const fall=THREE.MathUtils.smoothstep(age,0,.1),fade=1-THREE.MathUtils.smoothstep(age,.18,.32);
    this.at.copy(held.at).addScaledVector(this.up,2.6-2.1*fall);this.aim.set(0,-1,0);
    this.hawkFist(this.at,this.aim,.9*fade);
    this.glows.add(this.at,1.6*fade,FLAME.halo,.6*fade,GLOW,.0001);this.lights.add(this.at,6,FLAME.light,1.2*fade);
    for(let i=0,n=Math.round(24*density);i<n&&flame<768;i++){const phase=(time*3.4+i*.618)%1,a=i*2.4+time*9;this.transform.position.copy(this.at).add(this.offset.set(Math.cos(a)*.45,.4+phase*.9,Math.sin(a)*.45));this.transform.quaternion.identity();this.transform.scale.setScalar((1-phase*.7)*fade*2);this.flame(flame++,1-phase*.75,i*.618);}
    return flame;
  }
  private bajrang(f:Fighter,t:number,time:number,fighters:ReadonlyMap<string,Fighter>){
    const s=f.state;
    const cast=Math.round(s.actionStarted*1000)+7,local=involvesLocal(s.id,s.target??undefined);
    const victim=s.target?fighters.get(s.target):undefined;
    if(t>=BAJRANG_OPEN&&t<BAJRANG_OPEN+.5&&(s.confirmedAt!==undefined||s.whiffedAt!==undefined)&&!this.gripped.has(cast)){
      this.gripped.add(cast);if(this.gripped.size>32)this.gripped.delete(this.gripped.values().next().value!);
      const hand=f.handR;
      bodyCenter(f,this.shoulder);this.aim.subVectors(hand,this.shoulder);if(this.aim.lengthSq()<1e-6)this.aim.copy(this.forward);this.aim.normalize();
      if(s.confirmedAt!==undefined&&victim){
        bodyCenter(victim,this.at);this.at.lerp(hand,.5);
        this.kit.ring(this.at.x,this.at.y,this.at.z,.15,1.7,time,.24,0xffffff,NIKA.rim,.1,'plane',this.aim.x,this.aim.y,this.aim.z);
        this.kit.streaks(this.at.x,this.at.y,this.at.z,NIKA,this.kit.n(12,4),11,.03,time,this.aim,.85);
        if(local)SIGNATURE.screen?.speedLines?.(.7);
      }else this.kit.puff(hand.x,hand.y,hand.z,-this.aim.x*1.2,.4,-this.aim.z*1.2,.5,time,.25,.45);
    }
    if(s.confirmedAt===undefined)return;
    if(t>=BAJRANG_OPEN+BAJRANG_SPRING&&t<BAJRANG_OPEN+BAJRANG_SPRING+.5&&!this.sprung.has(cast)){
      this.sprung.add(cast);if(this.sprung.size>32)this.sprung.delete(this.sprung.values().next().value!);
      const p=f.group.position,born=time-(t-BAJRANG_OPEN-BAJRANG_SPRING);
      this.kit.ring(p.x,p.y+.05,p.z,.5,3,born,.42,0xffffff,NIKA.rim,.16,'flat');
      this.kit.ring(p.x,p.y+.9,p.z,.4,2.2,born,.3,0xffffff,NIKA.rim,.1);
      this.kit.dustRing(p.x,p.y,p.z,22,1.4,7,1.2,born,.9);
      this.goal.copy(p);this.burst(s.id+':bajrang',born,1.2,cast,this.goal);
      if(local)SIGNATURE.screen?.speedLines?.(.6);
    }
    const from=BAJRANG_OPEN+BAJRANG_FIST.from,drive=BAJRANG-BAJRANG_FIST.drive,after=t-BAJRANG;
    if(t<from||after>BAJRANG_FIST.gone)return;
    const foe=victim;
    if(foe)this.goal.copy(foe.group.position);else this.goal.copy(f.group.position).addScaledVector(this.forward,2.6);
    this.tip.subVectors(f.group.position,this.goal);this.tip.y=0;const apart=this.tip.length();
    if(apart>.05)this.goal.addScaledVector(this.tip,Math.min(BAJRANG_FIST.toward,apart*.4)/apart);
    const floor=this.goal.y,push=Math.pow(THREE.MathUtils.clamp((t-drive)/BAJRANG_FIST.drive,0,1),2);
    const inflate=THREE.MathUtils.smoothstep(t,from,drive-.05),throb=1+.04*Math.sin(t*9.5)*(1-push);
    const size=(BAJRANG_FIST.small+(BAJRANG_FIST.big-BAJRANG_FIST.small)*inflate)*throb*(after>.12?1-THREE.MathUtils.smoothstep(after,.12,BAJRANG_FIST.gone)*.85:1);
    this.aim.set(-this.tip.x,0,-this.tip.z);if(this.aim.lengthSq()<1e-6)this.aim.copy(this.forward);this.aim.normalize().multiplyScalar(.5*(1-(after>=0?1:push))).add(this.side.set(0,-.86,0)).normalize();
    const crown=floor+1.9*(foe?.state.size??1),knuckles=.82*size,hung=crown+BAJRANG_FIST.over,struck=floor+.45;
    const risen=THREE.MathUtils.smoothstep(t,from,from+BAJRANG_FIST.rise),gripAt=floor+1.1*(foe?.state.size??1);
    this.offset.set(this.goal.x,gripAt+(hung-gripAt)*risen+(struck-hung)*(after>=0?1:push),this.goal.z);
    if(after>.12)this.offset.y+=THREE.MathUtils.smoothstep(after,.12,BAJRANG_FIST.gone)*2.5;
    this.at.copy(this.offset).addScaledVector(this.aim,-knuckles);
    bodyCenter(f,this.shoulder);this.shoulder.y+=.45;
    const squash=after>=0?1-THREE.MathUtils.smoothstep(after,.06,.32):0;
    this.bajrangFists.show(s.id,this.at,this.aim,size,this.shoulder,squash);
    this.lights.add(this.at,4+size*2,FLAME.light,.4+.6*push);
    const mine=involvesLocal(s.id,s.target??undefined);
    if(after<0&&Math.floor(time*24)!==Math.floor((time-.017)*24)){
      this.tip.copy(this.at).addScaledVector(this.aim,knuckles);
      this.offset.copy(this.at).addScaledVector(this.aim,-size*1.1);
      this.kit.crackle(this.offset,this.tip,size*.62,HAOSHOKU,this.kit.n(5,2),time);
    }
    if(push>0&&after<0&&mine)SIGNATURE.screen?.speedLines?.(1);
    const key=Math.round(s.actionStarted*1000);
    if(after>=0&&!this.landed.has(key)){this.landed.add(key);if(this.landed.size>32)this.landed.delete(this.landed.values().next().value!);
      this.kit.groundImpact(this.goal.x,floor,this.goal.z,0,1,0,3,time,HAKI_FIST,floor);
      this.kit.ring(this.goal.x,floor+.06,this.goal.z,.8,9,time,.55,0xffffff,HAOSHOKU.rim,.14,'flat');
      this.kit.ring(this.goal.x,floor+1.1,this.goal.z,.6,7,time,.42,0xffffff,HAKI_FIST.rim,.1);
      this.kit.dustRing(this.goal.x,floor,this.goal.z,30,2.2,8,1.5,time,1.1);
      this.kit.streaks(this.goal.x,floor+.6,this.goal.z,HAOSHOKU,this.kit.n(26,8),16,.05,time,this.up,.9);
      this.burst(s.id+':bajrang',time,2.4,key,this.goal);
      if(mine){SIGNATURE.screen?.impactFrame?.(1);SIGNATURE.screen?.chromaticPulse?.(1);}}
    if(after>=0&&after<.32){const k=1-after/.32;this.tip.set(this.goal.x,floor+1,this.goal.z);this.glows.add(this.tip,3*(1+after*3),FLAME.glare,k,STAR,.22,11);this.glows.add(this.tip,2.4+after*16,FLAME.halo,.8*k,RING,.05,5,.55);this.lights.add(this.tip,9,FLAME.light,1.6*k);}
  }
  private gatling(f:Fighter,t:number,time:number,fighters:ReadonlyMap<string,Fighter>){
    const s=f.state,c=GATLING_MOVE.contacts,first=c[0],last=c[c.length-1],P=GATLING_PHANTOM;
    if(t<first-P.lead||t>last+P.life)return;
    const dawn=!!s.awakened,size=dawn?P.dawn:P.hawk,thick=dawn?P.dawnArm:P.hawkArm,spread=dawn?P.dawnSpread:P.spread;
    const foe=s.target?fighters.get(s.target):undefined,aimed=!!foe&&foe.state.alive&&foe.group.position.distanceTo(f.group.position)<GATLING_MOVE.range+1;
    if(aimed)bodyCenter(foe!,this.goal);else this.goal.copy(f.group.position).addScaledVector(this.forward,P.ahead).addScaledVector(this.up,1.15);
    bodyCenter(f,this.shoulder);this.shoulder.y+=.4;
    this.aim.subVectors(this.goal,this.shoulder);const span=this.aim.length();if(span<.3)return;this.aim.divideScalar(span);
    this.side.crossVectors(this.aim,this.up);if(this.side.lengthSq()<1e-6)this.side.set(1,0,0);this.side.normalize();
    this.across.crossVectors(this.side,this.aim).normalize();
    const start=first-P.lead,stop=last-.03,seed=(Math.round(s.actionStarted*997)%9973)*.731;
    const k0=Math.max(0,Math.ceil((t-P.life-start)*P.rate)),k1=Math.floor((Math.min(t,stop)-start)*P.rate);
    for(let k=k0;k<=k1;k++){
      const born=start+k/P.rate,p=(t-born)/P.life;if(p<0||p>1)continue;
      const r1=hash(seed+k*3.17),r2=hash(seed+k*7.73),r3=hash(seed+k*13.39),side=k%2===0?1:-1;
      const reach=p<.42?1-Math.pow(1-p/.42,3):p<.56?1:1-THREE.MathUtils.smoothstep(p,.56,1);
      this.at.copy(this.shoulder).addScaledVector(this.side,side*.2).addScaledVector(this.across,(r3-.5)*.14);
      this.offset.copy(this.goal).addScaledVector(this.side,(r1*2-1)*spread).addScaledVector(this.across,(r2*2-1)*spread*.8).addScaledVector(this.aim,-(dawn?.42:.22));
      this.tip.lerpVectors(this.at,this.offset,reach);
      this.gatlingFists.add(this.at,this.tip,size*(.85+.3*r2),thick,.25+.35*reach);
    }
    const cast=Math.round(s.actionStarted*1000);let shown=this.gatlingShown.get(s.id);
    if(!shown||shown.cast!==cast){shown={cast,contact:-1};this.gatlingShown.set(s.id,shown);}
    const mine=involvesLocal(s.id,s.target??undefined);
    while(shown.contact+1<c.length&&t>=c[shown.contact+1]){
      const i=++shown.contact,final=i===c.length-1;
      if(!aimed)continue;
      this.offset.copy(this.goal).addScaledVector(this.aim,-.3);
      this.kit.ring(this.offset.x,this.offset.y,this.offset.z,.12,final?2.6:dawn?1.4:.9,time,final?.32:.16,0xffffff,HAKI_FIST.rim,.1,'plane',this.aim.x,this.aim.y,this.aim.z);
      if(final){this.kit.streaks(this.offset.x,this.offset.y,this.offset.z,HAKI_FIST,this.kit.n(14,5),13,.035,time,this.aim,.9);if(mine)SIGNATURE.screen?.impactFrame?.(.6);}
      else this.kit.puff(this.offset.x,this.offset.y,this.offset.z,this.aim.x*1.5,.5,this.aim.z*1.5,dawn?.75:.5,time,.25,.5);
    }
    if(t>=first-P.lead&&t<last&&mine)SIGNATURE.screen?.speedLines?.(.55);
  }
  private nikaClouds(f:Fighter,t:number,time:number,steam:number){
    const s=f.state;
    let key=-1,size=0,at=0;
    if(s.action==='awaken'){key=Math.round(s.actionStarted*1000);size=1;at=awakeningSwapAt('luffy');}
    else if(s.action==='ultimate'&&!s.awakened){
      const out=bajrangOut(s,WHIFF_RECOVERY);
      if(t<out-.06){key=Math.round(s.actionStarted*1000)+1;size=.85;at=Math.max(0,BAJRANG_TAKE.swap-.04);}else{key=Math.round(s.actionStarted*1000)+2;size=.6;at=out-.06;}
    }
    if(key>=0&&t>=at)this.burst(s.id,time-(t-at),size,key);
    for(const id of [s.id,s.id+':bajrang']){
      const cloud=this.clouds.get(id);if(!cloud)continue;
      const own=id===s.id,age=time-cloud.born,life=own?1.1:1;if(age<0)continue;if(age>life){this.clouds.delete(id);continue;}
      const envelope=THREE.MathUtils.smoothstep(age,0,.08)*(1-THREE.MathUtils.smoothstep(age,life*.4,life)),k=cloud.size;
      const grow=1-Math.pow(1-Math.min(1,age/(life*.75)),2);
      if(own)this.offset.copy(f.group.position);else this.offset.copy(cloud.at);
      const ring=own?(k>=1?7:5):9,rising=own&&k>=1?3:0;
      for(let c=0;c<ring+rising&&steam<764;c++){
        const up=c>=ring,a=up?c*2.1:c/ring*Math.PI*2+hash(c+k)*.5;
        const r=up?.3:.45+grow*(own?1.7:4.2)*Math.min(1.3,k);
        const y=up?1.55+grow*1.3+(c-ring)*.2:(own?.35:.22)+grow*(own?.6:.35);
        const size=(.2+.08*hash(c*1.7+k))*envelope*Math.sqrt(k)*(up?.85:1);
        this.tip.set(Math.cos(a)*r,y,Math.sin(a)*r).add(this.offset);this.side.set(-Math.sin(a),0,Math.cos(a));
        for(let lobe=0;lobe<4;lobe++){
          const side=lobe===1?1:lobe===2?-1:0,top=lobe===3?1:0;
          this.transform.position.copy(this.tip).addScaledVector(this.side,side*size*.9).addScaledVector(this.up,(side?.15:top*.55)*size);
          this.transform.quaternion.identity();this.transform.scale.setScalar(size*(lobe===0?1:.68));
          this.transform.updateMatrix();this.steam.setMatrixAt(steam,this.transform.matrix);this.steam.setColorAt(steam++,this.color.set(0xffffff));
        }
      }
    }
    return steam;
  }
  private g5Ender(f:Fighter,t:number,time:number,fighters:ReadonlyMap<string,Fighter>){
    const s=f.state,key=s.branch as keyof typeof G5_ENDER,move=G5_ENDER[key];if(!move)return;
    const c=move.contacts[0],cast=s.actionSeq??Math.round(s.actionStarted*10);
    const foe=s.target?fighters.get(s.target):undefined;
    if(foe&&foe.state.alive&&foe.group.position.distanceTo(f.group.position)<4)bodyCenter(foe,this.goal);
    else this.goal.copy(f.group.position).addScaledVector(this.forward,1.4).addScaledVector(this.up,1.05);
    if(key==='lh'&&t<c+.05&&time>=this.nextSteam){this.nextSteam=time+.035;bodyCenter(f,this.at);
      this.kit.smoke(this.at.x-this.forward.x*.5,this.at.y-.2,this.at.z-this.forward.z*.5,-this.forward.x*1.5,.4,-this.forward.z*1.5,.9,time,.45,0xffffff,0xd8dcf0);}
    if(key==='llls'&&t>.05&&t<c+.04){
      this.tip.copy(f.handR).addScaledVector(this.up,.9);
      if(Math.floor(time*40)!==Math.floor((time-.017)*40))this.kit.crackle(f.handR,this.tip,.1,BOLT,this.kit.n(3,1),time);
      this.glows.add(f.handR,.7,BOLT_GLOW,.6,GLOW,0);this.lights.add(f.handR,3,BOLT_GLOW,.6);
    }
    if(t<c||this.g5Landed.get(s.id)===cast)return;
    this.g5Landed.set(s.id,cast);
    const floor=f.group.position.y;
    if(key==='lh'){
      this.kit.ring(this.goal.x,this.goal.y,this.goal.z,.3,3,time,.3,0xffffff,NIKA.rim,.12,'plane',this.forward.x,0,this.forward.z);
      this.kit.streaks(this.goal.x,this.goal.y,this.goal.z,NIKA,this.kit.n(12,4),12,.03,time,this.forward,.9);
      this.burst(s.id+':bajrang',time,.7,cast,this.goal);
    }else if(key==='llh'){
      this.kit.ring(this.goal.x,this.goal.y,this.goal.z,.3,2.6,time,.28,0xffffff,NIKA.rim,.12);
      this.kit.streaks(this.goal.x,this.goal.y,this.goal.z,NIKA,this.kit.n(12,4),11,.03,time,this.up,.7);
    }else if(key==='lllh'){
      this.kit.groundImpact(this.goal.x,floor,this.goal.z,0,1,0,3,time,NIKA,floor);
      this.kit.ring(this.goal.x,floor+.06,this.goal.z,.6,5,time,.45,0xffffff,NIKA.rim,.14,'flat');
    }else if(key==='airHeavy'){
      this.kit.groundImpact(this.goal.x,floor,this.goal.z,0,1,0,3,time,NIKA,floor);
      this.kit.debris.burst(this.kit.n(14,4),this.goal.x,floor,this.goal.z,0,1,0,8,.95,.14,floor,2.6);
      this.kit.ring(this.goal.x,floor+.06,this.goal.z,.5,4.2,time,.4,0xffffff,NIKA.rim,.14,'flat');
    }
  }
  private boltFlight(at:THREE.Vector3,heading:THREE.Vector3,time:number,flicker:number){
    this.tip.copy(at).addScaledVector(heading,-1.5);
    if(Math.floor(time*60)%2===0)this.kit.crackle(this.tip,at,.09,BOLT,this.kit.n(4,2),time);
    this.glows.add(at,1,BOLT_GLOW,.7*flicker,GLOW,0);this.lights.add(at,4,BOLT_GLOW,.8*flicker);
  }
  reset(){this.rocs.clear();this.elephants.clear();this.fires.clear();this.kicked.clear();this.flared.clear();this.flames.count=0;this.steam.count=0;this.steamInk.count=0;this.mist.count=0;this.wake.count=0;this.bajrangFists.reset();this.gatlingFists.reset();this.gatlingShown.clear();this.g5Landed.clear();this.clouds.clear();this.landed.clear();this.sprung.clear();this.gripped.clear();for(const b of this.bursts)b.born=-9;for(let i=1;i<this.hawkFists.length;i++)this.hawkFists[i].visible=false;this.glows.begin(0);this.glows.end();this.lights.begin();this.lights.end();}
  dispose(){for(const m of [this.flames,this.steam,this.mist,this.wake]){m.removeFromParent();m.dispose();}this.mistGeometry.dispose();this.mistMaterial.dispose();this.flameGeometry.dispose();this.steamGeometry.dispose();this.flameMaterial.dispose();this.steamMaterial.dispose();this.steamInkMaterial.dispose();this.steamInk.removeFromParent();this.steamInk.dispose();this.wakeGeometry.dispose();this.wakeMaterial.dispose();this.glows.dispose();this.lights.dispose();this.bajrangFists.dispose();this.gatlingFists.dispose();for(const f of this.hawkFists)f.removeFromParent();this.fistGeometry.dispose();this.fireFist.dispose();}
}
