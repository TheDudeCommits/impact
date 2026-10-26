import * as THREE from 'three';
import type {Fighter} from './Fighter';
import {MOVES} from '../game/moves';
import {comboMove,COMBO_KEYS,type ComboKey} from '../game/combos';
import type {MoveDefinition} from '../game/moves';
const ENDER_MOVES:(MoveDefinition|undefined|null)[]=[];
function enderMove(key:ComboKey,awakened:boolean){const i=COMBO_KEYS.indexOf(key)*2+(awakened?1:0);let move=ENDER_MOVES[i];if(move===undefined){move=comboMove('guts',key,awakened)??null;ENDER_MOVES[i]=move;}return move??undefined;}
import {beats} from './signature/ultimateClock';
import {BoltBatch} from './signature/BoltBatch';
import {GlowBatch,GLOW,STAR,RING} from './signature/GlowBatch';
import {LightVolumes} from './signature/LightVolumes';
import {BLOOD,FIRE,flamePalette,flameSpriteGeometry,flameSpriteMaterial} from './signature/FlameSprites';
import {slashWaveMaterial,applySlashStyle,SLASH} from './signature/SlashWave';
import {Crescents,crescentGeometry,DARK,type CrescentStyle} from './signature/Crescent';
import {FloorGashes} from './signature/FloorGash';
import {FLIGHTS} from './CombatEffects';
import {VfxKit} from './vfx/VfxKit';
import type {Element} from './vfx/palette';

const WAVE:CrescentStyle={mode:DARK,edge:new THREE.Color(2.6,.5,.2),body:new THREE.Color(.035,.02,.016),glow:new THREE.Color(1.3,.2,.08),light:new THREE.Color(1.2,.3,.12)};
const WAVE_SIZE=1.7,WAVE_ARC=1.05,WAVE_LEAN=.1,WAVE_FADE=.24;
const WAVE_GLOW=new THREE.Color(.7,.12,.05),WAVE_CUT=new THREE.Color(2.2,.45,.16);
const SHELL_HOT=new THREE.Color(3,1.4,.4),BLAST_GLARE=new THREE.Color(2.4,1.2,.35),BLAST_HALO=new THREE.Color(1.1,.32,.06);
const BLAST_SECONDS=.75,BLAST_FLAMES=36;
const IRON:Element={spike:0xffe2b8,rim:0xff5a1a,light:0xff7a2a,ink:0x140806};

const CANNON_RELEASE=MOVES.guts.special.contacts[0];
const FLASH_SECONDS=.14;
const SMOKE_SECONDS=1.1;
const PUFFS=14;
const SMEAR_SECONDS=.2;
const SMEARS=6;
const COLOR={muzzle:new THREE.Color(2.4,1.3,.35),spark:new THREE.Color(2.2,1.1,.3),light:new THREE.Color(1.4,.7,.25),blood:new THREE.Color(.7,.03,.02),eye:new THREE.Color(3,.25,.15),aura:new THREE.Color(.8,.05,.03)};
type Smear={mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;actorId:string;since:number;active:boolean;key:number};

export class GutsEffects {
  private flashGeometry=new THREE.ConeGeometry(.09,.55,6);
  private flashMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true,opacity:.92,depthWrite:false,blending:THREE.AdditiveBlending});
  private smokeGeometry=new THREE.SphereGeometry(1,8,6);
  private smokeMaterial=new THREE.MeshToonMaterial({color:0x3a3634,transparent:true,opacity:.62,depthWrite:false});
  private flashes=new THREE.InstancedMesh(this.flashGeometry,this.flashMaterial,6*4);
  private smoke=new THREE.InstancedMesh(this.smokeGeometry,this.smokeMaterial,PUFFS*6);
  private auraGeometry=flameSpriteGeometry();
  private auraMaterial=flameSpriteMaterial();
  private aura=new THREE.InstancedMesh(this.auraGeometry,this.auraMaterial,160+BLAST_FLAMES*3);
  private sparks=new BoltBatch(160,'cannon-arm-sparks');
  private glows=new GlowBatch(24,'cannon-arm-glow',true);
  private lights=new LightVolumes(3,'guts-light');
  private smearGeometry=new THREE.PlaneGeometry(1,1);
  private smears:Smear[]=[];
  private crescents:Crescents;
  private gashes:FloorGashes;
  private waves=new Map<string,{from:THREE.Vector3;at:THREE.Vector3;heading:THREE.Vector3;floor:number;seen:number;born:number;seed:number}>();
  private shells=new Map<string,{at:THREE.Vector3;seen:number;nextPuff:number}>();
  private blasts=Array.from({length:4},()=>({at:new THREE.Vector3(),born:-9,floor:0}));private blastNext=0;
  private kit:VfxKit;
  private dir=new THREE.Vector3();private tilt=new THREE.Vector3();private cross=new THREE.Vector3();private center=new THREE.Vector3();private tip=new THREE.Vector3();
  private basis=new THREE.Matrix4();private q=new THREE.Quaternion();
  private fired=new Map<string,number>();
  private seenContact=new Map<string,number>();
  private landings=new Map<string,{cast:number;at:number}>();
  private transform=new THREE.Object3D();
  private muzzle=new THREE.Vector3();
  private heading=new THREE.Vector3();
  private forearm=new THREE.Vector3();
  private a=new THREE.Vector3();private b=new THREE.Vector3();private side=new THREE.Vector3();private across=new THREE.Vector3();
  private color=new THREE.Color();
  private smokeTint=new THREE.Color(0x6a5a4a);
  private up=new THREE.Vector3(0,1,0);
  constructor(scene:THREE.Scene){
    for(const mesh of [this.flashes,this.smoke,this.aura]){mesh.count=0;mesh.setColorAt(0,new THREE.Color(0xffffff));mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(mesh);}
    this.flashes.name='cannon-arm-flash';this.smoke.name='cannon-arm-smoke';this.aura.name='berserker-aura';
    scene.add(this.sparks.mesh,this.glows.mesh,this.lights.mesh);
    this.crescents=new Crescents(scene,crescentGeometry(WAVE_ARC,.3,.6),4,'cleave-wave');this.gashes=new FloorGashes(scene,4,'cleave-cut');this.kit=VfxKit.for(scene);
    for(let i=0;i<SMEARS;i++){const mesh=new THREE.Mesh(this.smearGeometry,slashWaveMaterial());mesh.name='dragonslayer-smear';mesh.frustumCulled=false;mesh.renderOrder=4;applySlashStyle(mesh.material,SLASH.dragonslayer,i*17,1.15,.3);scene.add(mesh);
      mesh.scale.setScalar(.001);mesh.position.set(0,-50,0);mesh.onAfterRender=()=>{if(!smear.active)mesh.visible=false;};
      const smear:Smear={mesh,actorId:'',since:0,active:false,key:-1};this.smears.push(smear);}
  }
  update(time:number,fighters:ReadonlyMap<string,Fighter>,density:number){
    let flash=0,puffs=0,aura=0;this.auraMaterial.uniforms.uTime.value=time;
    this.sparks.begin();this.glows.begin(time);this.lights.begin();
    for(const [id,fighter] of fighters){
      const s=fighter.state;
      if(s.fighter!=='guts'||!s.alive)continue;
      const elapsed=s.actionTime*s.actionDuration;
      const ender=s.branch&&(s.action==='heavy'||s.action==='special')?enderMove(s.branch,!!s.awakened):undefined;
      if(s.action==='light'||s.action==='heavy'||s.action==='ultimate'||ender){
        const swing=ender??MOVES.guts[s.action as 'light'|'heavy'|'ultimate'];
        const contacts=swing.contacts,drawn=ender?contacts.length:beats(s,swing);
        for(let k=0;k<drawn;k++){
          if(elapsed<contacts[k]||elapsed>contacts[k]+.1||s.branch==='airSpecial'&&ender&&!s.grounded)continue;
          const key=Math.round(s.actionStarted*1000)*16+k;if(this.seenContact.get(id)===key)continue;this.seenContact.set(id,key);
          const smear=this.smears.find(m=>!m.active)??this.smears.reduce((x,y)=>x.since<=y.since?x:y);
          smear.active=true;smear.actorId=id;smear.since=time;smear.key=k;smear.mesh.visible=true;
          applySlashStyle(smear.mesh.material,SLASH.dragonslayer,key,1.15,s.action==='light'?.24:.34);
          smear.mesh.position.copy(fighter.group.position).add(this.a.set(Math.sin(s.yaw)*1.2,1.05,Math.cos(s.yaw)*1.2));
          smear.mesh.rotation.set(0,s.yaw,(k%2?-.6:.6)+(s.action==='heavy'||ender?1.2:0)+(s.branch==='airHeavy'||s.branch==='airSpecial'||s.branch==='lllh'?.35:0));smear.mesh.scale.setScalar(s.action==='light'?2.4:ender?3.3:3);
        }
      }
      if(s.awakened){
        const count=Math.round(22*Math.max(.35,density));
        for(let i=0;i<count&&aura<160;i++){
          const phase=(time*1.3+i*.618)%1,a=i*2.399+time*.8,r=.28+.1*Math.sin(i*1.7);
          this.transform.position.copy(fighter.group.position).add(this.a.set(Math.cos(a)*r,.2+(i%8)*.2+phase*.5,Math.sin(a)*r));
          this.transform.quaternion.setFromUnitVectors(this.up,this.b.set(Math.cos(a)*.2,1,Math.sin(a)*.2).normalize());
          this.transform.scale.setScalar((1-phase)*(1.6+.4*(i%3)));this.transform.updateMatrix();this.aura.setMatrixAt(aura,this.transform.matrix);
          this.aura.setColorAt(aura++,this.color.setRGB(1-phase*.6,(i*.137)%1,flamePalette(BLOOD)));
        }
        const head=fighter.joints.get('Head');
        if(head){head.getWorldPosition(this.a);this.b.set(Math.sin(s.yaw),0,Math.cos(s.yaw));this.a.addScaledVector(this.b,.13).addScaledVector(this.up,.03);
          const side=this.b.set(Math.cos(s.yaw),0,-Math.sin(s.yaw));const burn=.8+.2*Math.sin(time*13);
          for(const sign of [-1,1]){this.muzzle.copy(this.a).addScaledVector(side,sign*.045);this.glows.add(this.muzzle,.07,COLOR.eye,burn,GLOW,.35);}}
        this.a.copy(fighter.group.position).addScaledVector(this.up,1);this.lights.add(this.a,2.6,COLOR.aura,.3);
      }
      let age=elapsed-CANNON_RELEASE;
      if(s.branch==='airSpecial'&&s.action==='special'){
        const smash=enderMove('airSpecial',!!s.awakened),cast=s.actionSeq??Math.round(s.actionStarted*10);
        let held=this.landings.get(id);
        if(smash&&s.grounded&&elapsed>=smash.contacts[0]&&held?.cast!==cast){held=held??{cast,at:0};held.cast=cast;held.at=time;this.landings.set(id,held);}
        if(!held||held.cast!==cast)continue;
        age=time-held.at;
      }else if(s.action!=='special'||s.branch)continue;
      if(age<0||age>SMOKE_SECONDS)continue;
      const elbow=fighter.joints.get('LeftForeArm');
      this.muzzle.copy(fighter.handL);
      if(elbow){elbow.getWorldPosition(this.forearm);this.heading.copy(this.muzzle).sub(this.forearm);}
      if(!elbow||this.heading.lengthSq()<1e-6)this.heading.set(Math.sin(s.yaw),0,Math.cos(s.yaw));
      if(s.branch==='airSpecial')this.heading.set(Math.sin(s.yaw)*.5,-1,Math.cos(s.yaw)*.5);
      this.heading.normalize();this.muzzle.addScaledVector(this.heading,.16);
      const shot=Math.round(s.actionStarted*1000);
      if(age<FLASH_SECONDS&&this.fired.get(id)!==shot){this.fired.set(id,shot);
        this.kit.ring(this.muzzle.x,this.muzzle.y,this.muzzle.z,.2,2.2,time,.28,0xfff2d8,IRON.rim,.12,'plane',this.heading.x,this.heading.y,this.heading.z);
        this.kit.dustRing(fighter.group.position.x,fighter.group.position.y,fighter.group.position.z,this.kit.n(10,4),.5,3.2,.55,time,.6);}
      if(age<FLASH_SECONDS&&flash<this.flashes.instanceMatrix.count-4){
        const strength=1-age/FLASH_SECONDS;
        for(let i=0;i<4;i++){
          const spin=i*Math.PI/2+time*9;
          this.transform.position.copy(this.muzzle).addScaledVector(this.heading,.22*strength);
          this.transform.quaternion.setFromUnitVectors(this.up,this.heading);
          this.transform.rotateY(spin);this.transform.rotateX((i%2?1:-1)*.55);
          this.transform.scale.set(strength*(i===0?1.6:.9),strength*(i===0?1.7:1.1),strength*(i===0?1.6:.9));
          this.transform.updateMatrix();this.flashes.setMatrixAt(flash,this.transform.matrix);
          this.color.setRGB(i===0?2.2:1.8,i===0?1.9:.8,i===0?1.2:.2);this.flashes.setColorAt(flash++,this.color);
        }
        this.a.copy(this.muzzle).addScaledVector(this.heading,.25);
        this.glows.add(this.a,1.1*strength,COLOR.muzzle,strength,STAR,.25,3);
        this.glows.add(this.a,.9*strength,COLOR.muzzle,.6*strength,GLOW,.15);
        this.lights.add(this.a,5,COLOR.light,1.1*strength);
        this.side.crossVectors(this.heading,this.up);if(this.side.lengthSq()<1e-6)this.side.set(1,0,0);this.side.normalize();this.across.crossVectors(this.heading,this.side);
        for(let i=0;i<Math.round(14*density);i++){const t=(age/FLASH_SECONDS+i*.071)%1,a=i*2.399,spread=.4*t;
          this.a.copy(this.muzzle).addScaledVector(this.heading,.3+t*2.2).addScaledVector(this.side,Math.cos(a)*spread).addScaledVector(this.across,Math.sin(a)*spread);
          this.b.copy(this.a).addScaledVector(this.heading,-.3);
          this.sparks.segment(this.b,this.a,.018,COLOR.spark,strength*(1-t*.5),.4);}
      }
      const count=Math.round(PUFFS*density);
      for(let i=0;i<count&&puffs<this.smoke.instanceMatrix.count;i++){
        const born=(i/PUFFS)*.28,life=age-born;
        if(life<0)continue;
        const t=life/(SMOKE_SECONDS-born),phi=i*2.399963,drift=.12+(i%5)*.05;
        this.transform.position.copy(this.muzzle).addScaledVector(this.heading,.1+life*(.9-i%3*.2)-t*t*.6);
        this.transform.position.x+=Math.cos(phi)*drift*t;this.transform.position.z+=Math.sin(phi)*drift*t;
        this.transform.position.y+=life*.55+(i%3)*.03;
        const size=(.05+t*.34)*(1-t*.35);
        this.transform.quaternion.identity();this.transform.scale.setScalar(size);
        this.transform.updateMatrix();this.smoke.setMatrixAt(puffs,this.transform.matrix);
        this.color.setScalar(.22+.5*(1-t)).lerp(this.smokeTint,i%4===0?.5:0);
        this.smoke.setColorAt(puffs++,this.color);
      }
    }
    aura=this.flights(time,density,aura);
    for(const smear of this.smears){
      if(!smear.active)continue;
      const age=time-smear.since;
      if(age>SMEAR_SECONDS||!fighters.has(smear.actorId)){smear.active=false;smear.mesh.visible=false;continue;}
      smear.mesh.material.uniforms.uFade.value=1-THREE.MathUtils.smoothstep(age,.05,SMEAR_SECONDS);smear.mesh.material.uniforms.uClock.value=time;
    }
    this.flashes.count=flash;this.smoke.count=puffs;this.aura.count=aura;
    this.flashes.instanceMatrix.needsUpdate=true;this.smoke.instanceMatrix.needsUpdate=true;this.aura.instanceMatrix.needsUpdate=true;
    if(this.flashes.instanceColor)this.flashes.instanceColor.needsUpdate=true;
    if(this.smoke.instanceColor)this.smoke.instanceColor.needsUpdate=true;
    if(this.aura.instanceColor)this.aura.instanceColor.needsUpdate=true;
    this.sparks.end();this.glows.end();this.lights.end();
  }
  private flights(time:number,density:number,aura:number){
    this.crescents.begin();this.gashes.begin();
    for(const [key,flight] of FLIGHTS){
      if(flight.fighter!=='guts'||flight.branch!==undefined||!flight.released)continue;
      if(flight.slot==='heavy'){
        let wave=this.waves.get(key);
        if(!wave){wave={from:flight.position.clone(),at:new THREE.Vector3(),heading:new THREE.Vector3(),floor:flight.position.y-1.05,seen:time,born:time,seed:this.waves.size*7+Math.round(time*13)};this.waves.set(key,wave);}
        wave.at.copy(flight.position);wave.heading.copy(flight.heading);wave.seen=time;
      }else if(flight.slot==='special'){
        let shell=this.shells.get(key);
        if(!shell){shell={at:new THREE.Vector3(),seen:time,nextPuff:0};this.shells.set(key,shell);}
        shell.at.copy(flight.position);shell.seen=time;
      }
    }
    for(const [key,wave] of this.waves){
      const after=time-wave.seen,fade=after<=1e-4?1:1-THREE.MathUtils.smoothstep(after,0,WAVE_FADE);
      if(fade<=.01){this.waves.delete(key);continue;}
      const grow=.4+.6*THREE.MathUtils.smoothstep(time-wave.born,0,.1),size=WAVE_SIZE*grow*(after>1e-4?1+after*1.4:1);
      this.dir.copy(wave.heading).setY(0);if(this.dir.lengthSq()<1e-6)this.dir.set(0,0,1);this.dir.normalize();
      this.cross.crossVectors(this.dir,this.tilt.set(0,1,0)).normalize();
      this.tilt.set(0,Math.cos(WAVE_LEAN),0).addScaledVector(this.cross,Math.sin(WAVE_LEAN));
      this.cross.crossVectors(this.dir,this.tilt);
      this.basis.makeBasis(this.dir,this.tilt,this.cross);this.q.setFromRotationMatrix(this.basis);
      this.center.copy(wave.at).addScaledVector(this.dir,-size*.6);this.center.y=wave.floor+size*Math.sin(WAVE_ARC)*Math.cos(WAVE_LEAN)-.08;
      this.crescents.add(this.center,this.q,size,size,size*.9,WAVE,fade,wave.seed,time,1+.15*Math.sin(time*31),.05);
      this.tip.copy(this.center).addScaledVector(this.dir,size*Math.cos(WAVE_ARC)).addScaledVector(this.tilt,-size*Math.sin(WAVE_ARC));this.tip.y=wave.floor;
      this.a.copy(wave.from);this.a.y=wave.floor;
      this.gashes.add(this.a,this.tip,.22*grow,fade*.9,WAVE_CUT,wave.seed);
      this.glows.add(this.center,size*.9,WAVE_GLOW,.34*fade,GLOW,0);
      this.lights.add(this.center,3.4,COLOR.light,.5*fade);
      if(after<=1e-4&&Math.floor(time*24)!==Math.floor((time-1/60)*24)){
        this.kit.dustSpray(this.tip.x,wave.floor,this.tip.z,-this.dir.x,-this.dir.z,this.kit.n(4,2),3.5,.32,time,.4,1.1);
        this.kit.debris.burst(this.kit.n(2,1),this.tip.x,wave.floor,this.tip.z,0,1,0,4.5,.7,.07,wave.floor,1.1);
      }
    }
    for(const [key,shell] of this.shells){
      if(shell.seen<time-1e-4){this.shells.delete(key);this.blast(shell.at,time);continue;}
      this.glows.add(shell.at,.5,SHELL_HOT,.9,GLOW,.35);this.glows.add(shell.at,1.1,BLAST_HALO,.35,GLOW,0);
      if(time>=shell.nextPuff){shell.nextPuff=time+.03;this.kit.smoke(shell.at.x,shell.at.y,shell.at.z,(Math.random()-.5)*.6,.5,(Math.random()-.5)*.6,.42,time,.55,0x8a7a6a,0x3a3430);}
    }
    for(const b of this.blasts){
      const age=time-b.born;if(age<0||age>BLAST_SECONDS)continue;
      const k=1-age/BLAST_SECONDS,open=THREE.MathUtils.smoothstep(age,0,.12);
      for(let i=0,n=Math.round(BLAST_FLAMES*Math.max(.5,density));i<n&&aura<this.aura.instanceMatrix.count;i++){
        const a=i*2.399963,tilt=Math.sin(i*1.7)*1.1,r=(.25+open*1.5)*(.55+.45*((i*.37)%1));
        this.b.set(Math.cos(a)*Math.cos(tilt),Math.sin(tilt)*.6+.45,Math.sin(a)*Math.cos(tilt)).normalize();
        this.transform.position.copy(b.at).addScaledVector(this.b,r);this.transform.position.y+=age*1.2;
        this.transform.quaternion.setFromUnitVectors(this.up,this.b);this.transform.scale.setScalar((2.2+.8*(i%3))*k*(.4+.6*open));
        this.transform.updateMatrix();this.aura.setMatrixAt(aura,this.transform.matrix);
        this.aura.setColorAt(aura++,this.color.setRGB(.25+.75*k,(i*.137)%1,flamePalette(FIRE)));
      }
      this.glows.add(b.at,2.4*(1+age*2),BLAST_GLARE,k,STAR,.2,5);this.glows.add(b.at,1.6+age*9,BLAST_HALO,.8*k,RING,.05,3,.5);
      this.lights.add(b.at,7,COLOR.light,1.4*k);
    }
    this.crescents.end();this.gashes.end();
    return aura;
  }
  private blast(at:THREE.Vector3,time:number){
    const b=this.blasts[this.blastNext];this.blastNext=(this.blastNext+1)%this.blasts.length;b.at.copy(at);b.born=time;
    const floor=at.y-1.05;b.floor=floor;
    this.kit.groundImpact(at.x,floor,at.z,0,1,0,3,time,IRON,floor);
    this.kit.ring(at.x,at.y,at.z,.4,4.2,time,.4,0xfff2d8,IRON.rim,.14);
    this.kit.streaks(at.x,at.y,at.z,IRON,this.kit.n(18,6),13,.035,time,this.up,.85);
    for(let i=0,n=this.kit.n(8,3);i<n;i++){const a=i*2.399963;this.kit.smoke(at.x+Math.cos(a)*.4,at.y,at.z+Math.sin(a)*.4,Math.cos(a)*1.4,1.6+(i%3)*.5,Math.sin(a)*1.4,.9+(i%3)*.25,time+i*.02,1.1,0x6a5e54,0x241f1c);}
    this.kit.debris.burst(this.kit.n(8,3),at.x,floor,at.z,0,1,0,7,.9,.1,floor,1.4);
  }
  reset(){this.landings.clear();this.waves.clear();this.shells.clear();this.fired.clear();for(const b of this.blasts)b.born=-9;this.crescents.begin();this.crescents.end();this.gashes.begin();this.gashes.end();this.flashes.count=0;this.smoke.count=0;this.aura.count=0;this.seenContact.clear();for(const s of this.smears){s.active=false;s.mesh.visible=false;}this.sparks.begin();this.sparks.end();this.glows.begin(0);this.glows.end();this.lights.begin();this.lights.end();}
  dispose(){this.crescents.dispose();this.gashes.dispose();this.kit.release();for(const m of [this.flashes,this.smoke,this.aura]){m.removeFromParent();m.dispose();}this.flashGeometry.dispose();this.flashMaterial.dispose();this.smokeGeometry.dispose();this.smokeMaterial.dispose();this.auraGeometry.dispose();this.auraMaterial.dispose();this.sparks.dispose();this.glows.dispose();this.lights.dispose();for(const s of this.smears){s.mesh.removeFromParent();s.mesh.material.dispose();}this.smearGeometry.dispose();}
}
