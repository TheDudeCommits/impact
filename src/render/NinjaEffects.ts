import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {shareSkeletons} from './sharedSkeletons';
import type {CombatEvent} from '../game/types';
import {MOVES} from '../game/moves';
import type {Fighter} from './Fighter';
import {chargeWasCancelled,BIJUDAMA,bigBall} from './CombatEffects';
import {comboMove} from '../game/combos';
import {OPENER_FEED} from './signature/ultimateClock';
import {ElectricKit,LIGHTNING} from './signature/ElectricKit';
import {struckBody,FIZZLE_REACH} from './signature/struck';
import {GLOW,RING,SWIRL} from './signature/GlowBatch';
import {BLACK,flamePalette,flameSpriteGeometry,flameSpriteMaterial} from './signature/FlameSprites';
import {signatureWarmup} from './signature/warm';
import {GhostShell} from './signature/GhostShell';
import {SusanooLooms,SUSANOO_ASSET} from './signature/SusanooShell';
import {gradeOnce,gradeLocal,GRADE} from './signature/context';
import {castAge} from './signature/castClock';
import {bodyCenter} from './signature/body';
import {FIRE} from './signature/FlameSprites';
import {VfxKit} from './vfx/VfxKit';
import {SPRITE} from './vfx/SparkField';
import {RUSH} from '../game/moves';
import {armoryDraws} from './vfx/armory/drawn';

export const NINJA_ASSETS=[SUSANOO_ASSET] as const;
type Echo={root:THREE.Group;model:THREE.Object3D;mixer:THREE.AnimationMixer;materials:(THREE.MeshBasicMaterial|THREE.MeshToonMaterial)[];bones:Map<string,THREE.Bone>;action?:THREE.AnimationAction;shell?:GhostShell};
type Clone={root:THREE.Group;mixer:THREE.AnimationMixer;busy:boolean;owner?:string;side:number;born:number;until:number;stage:number;poofed:boolean;appeared:boolean};
type Vortex={mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;busy:boolean};
type Cast={event:CombatEvent;echo?:Echo;vortex?:Vortex;ended?:number;strikeAt?:number;trail:string;hold?:number;releasedAt?:number;drawn?:number;confirmed?:boolean;whiffed?:number};
const INDRA_RELEASE=.6667;
const clean=(n:string)=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
const BALL_REACH=.3;
const salt=(id:string)=>{let h=7;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))%9973;return h;};
const INDRA={glow:new THREE.Color(.62,.2,2.1),light:new THREE.Color(.8,.38,1.6)};
const RASEN={shell:new THREE.Color(.34,.86,2.3),ring:new THREE.Color(.55,1.05,2.2),halo:new THREE.Color(.05,.32,1.0),light:new THREE.Color(.45,.85,1.7)};
const PLANETARY=comboMove('naruto','airSpecial'),BIG_BALL=comboMove('naruto','lllh');
const CLONE_SHELL={body:new THREE.Color(.05,.34,1.8),rim:0xd8f4ff,ink:0x020818};
const CLONE_STAGES:Record<number,number>={1:1,2:2};
const SMOKE=0xf4f6fa,SMOKE_SHADE=0xbfc6d4;
const KURAMA_FLAME=.85;
const BIJU={rim:new THREE.Color(.75,.4,2.2),dark:new THREE.Color(.18,.05,.34),white:new THREE.Color(1.6,1.5,2.2),light:new THREE.Color(.7,.4,1.4)};
const vortexMaterial=()=>new THREE.ShaderMaterial({name:'KamuiVortex',transparent:true,depthWrite:false,toneMapped:false,
  blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneMinusSrcAlphaFactor,
  uniforms:{age:{value:0},opacity:{value:0}},
  vertexShader:'varying vec2 p;void main(){p=position.xy/1.35;vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);float s=length(modelMatrix[0].xyz);mv.xy+=position.xy*s;gl_Position=projectionMatrix*mv;}',
  fragmentShader:`varying vec2 p;uniform float age;uniform float opacity;void main(){float r=length(p);if(r>=1.)discard;float a=atan(p.y,p.x);float lr=log(max(r,.02));
    float arms=pow(.5+.5*sin(a*3.+lr*6.-age*9.),3.);float fine=pow(.5+.5*sin(a*5.+lr*10.-age*14.+1.3),8.);
    float hole=1.-smoothstep(.1,.3,r);float horizon=exp(-pow((r-.29)/.045,2.));float fade=1.-smoothstep(.6,1.,r);
    vec3 col=(vec3(.42,.2,.78)*arms*1.3+vec3(1.,.85,1.5)*fine*.7)*fade+vec3(1.9,1.4,2.8)*horizon;
    float alpha=hole*.96+arms*fade*.45;gl_FragColor=vec4(col*(1.-hole)*opacity,alpha*opacity);}`});
export class NinjaEffects{
  private warmEchoes:Echo[]=[];
  private casts:Cast[]=[];
  private seen=new Set<number>();
  private kit:ElectricKit;
  private flameGeometry=flameSpriteGeometry();
  private flameMaterial=flameSpriteMaterial();
  private flames=new THREE.InstancedMesh(this.flameGeometry,this.flameMaterial,1000);
  private vortexGeometry=new THREE.PlaneGeometry(2.7,2.7);
  private vortices:Vortex[]=[];
  private transform=new THREE.Object3D();
  private a=new THREE.Vector3();private b=new THREE.Vector3();private center=new THREE.Vector3();private tail=new THREE.Vector3();
  private planets=new Map<string,{cast:number;at:THREE.Vector3;since:number}>();
  private p1=new THREE.Vector3();private p2=new THREE.Vector3();private p3=new THREE.Vector3();private axis=new THREE.Vector3();private u=new THREE.Vector3();private v=new THREE.Vector3();
  private tint=new THREE.Color();private flameCount=0;
  private vfx:VfxKit;
  private clones:Clone[]=[];
  private rasen:{event:CombatEvent;hitAt?:number}[]=[];
  private cloneSeen=new Map<string,number>();
  private tails=new WeakMap<Fighter,THREE.Bone[][]>();
  private tailRoot=new WeakMap<Fighter,THREE.Object3D>();
  readonly susanoos:SusanooLooms;
  private warm:ReturnType<typeof signatureWarmup>;
  constructor(private scene:THREE.Scene){
    this.kit=new ElectricKit(scene,'ninja-lightning-and-bow',3000);this.susanoos=new SusanooLooms(scene);
    this.vfx=VfxKit.for(scene);
    this.warm=signatureWarmup(scene);
    this.flames.count=0;this.flames.setColorAt(0,new THREE.Color(0,0,flamePalette(BLACK)));this.flames.frustumCulled=false;this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.flames.name='amaterasu-black-flames';scene.add(this.flames);
    for(let i=0;i<2;i++){const mesh=new THREE.Mesh(this.vortexGeometry,vortexMaterial());mesh.name='kamui-spatial-vortex';mesh.frustumCulled=false;mesh.renderOrder=3;mesh.scale.setScalar(.001);scene.add(mesh);this.vortices.push({mesh,busy:false});}
  }
  load(fighters:Iterable<string>){return this.susanoos.load(fighters);}
  warmup(actor:Fighter){this.warmEchoes.push(this.lightningClone(actor));for(const e of this.warmEchoes)e.root.visible=false;}
  private echo(model:THREE.Object3D,clips:THREE.AnimationClip[],color:number,opacity:number,clip:string,body?:number):Echo{
    const root=new THREE.Group(),copy=clone(model),materials:(THREE.MeshBasicMaterial|THREE.MeshToonMaterial)[]=[],bones=new Map<string,THREE.Bone>();shareSkeletons(copy);root.add(copy);this.scene.add(root);
    copy.traverse(o=>{if((o as THREE.Bone).isBone)bones.set(clean(o.name),o as THREE.Bone);if(!(o as THREE.Mesh).isMesh)return;const mesh=o as THREE.Mesh;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;if(/ink|shadow|equipment-held/i.test(mesh.name)){mesh.visible=false;return;}const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];const tinted=source.map(m=>{const src=m as THREE.MeshToonMaterial;const mat=body!==undefined||clip==='Indras Arrow'?new THREE.MeshToonMaterial({color:body??0x552697,transparent:true,opacity:.68,depthWrite:true,side:THREE.FrontSide}):new THREE.MeshBasicMaterial({map:src.map??null,color:new THREE.Color(color).lerp(new THREE.Color(0xffffff),.65),transparent:true,opacity,depthWrite:false,toneMapped:false,side:THREE.FrontSide});materials.push(mat);return mat;});mesh.material=Array.isArray(mesh.material)?tinted:tinted[0];});
    const mixer=new THREE.AnimationMixer(copy),take=clips.find(c=>clean(c.name).replace(/00[0-9]$/,'')===clean(clip)),action=take?mixer.clipAction(take).play():undefined;return{root,model:copy,mixer,materials,bones,action};
  }
  private lightningClone(actor:Fighter):Echo{
    const root=new THREE.Group(),copy=clone(actor.model),bones=new Map<string,THREE.Bone>();root.add(copy);this.scene.add(root);root.name='lightning-clone';
    copy.traverse(o=>{if((o as THREE.Bone).isBone)bones.set(clean(o.name),o as THREE.Bone);const m=o as THREE.Mesh;if(!m.isMesh)return;m.castShadow=m.receiveShadow=false;m.frustumCulled=false;if(/shadow|equipment-held/i.test(m.name))m.visible=false;});
    const shell=new GhostShell(copy,CLONE_SHELL.body,CLONE_SHELL.rim,.62,CLONE_SHELL.ink,2.2);shell.enabled=true;
    const mixer=new THREE.AnimationMixer(copy),take=actor.clips.find(c=>clean(c.name).replace(/00[0-9]$/,'')===clean('Run')),action=take?mixer.clipAction(take).play():undefined;
    return{root,model:copy,mixer,materials:[],bones,action,shell};
  }
  handle(events:CombatEvent[],fighters:ReadonlyMap<string,Fighter>){for(const event of events){if(this.seen.has(event.id))continue;this.seen.add(event.id);if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!);
    if(event.kind==='cast'&&event.fighter==='naruto'&&event.slot==='special'&&!event.branch&&event.origin&&event.endpoint&&!fighters.get(event.actorId)?.state.awakened){this.rasen.push({event});if(this.rasen.length>6)this.rasen.shift();}
    if(event.kind==='hit'&&event.fighter==='naruto'&&event.slot==='special'&&!event.branch)for(const r of this.rasen)if(r.event.actorId===event.actorId&&r.hitAt===undefined&&event.serverTime>r.event.serverTime)r.hitAt=event.serverTime;
    if(event.kind==='cast'&&event.origin&&event.endpoint&&event.slot&&(event.fighter==='kakashi'||event.fighter==='sasuke')){
      const cast:Cast={event,trail:'cast:'+event.id};const actor=fighters.get(event.actorId);
      if(event.fighter==='kakashi'&&event.slot==='ultimate')gradeOnce(event.actorId,event.id,GRADE.void,.5,MOVES.kakashi.ultimate.contacts[0]+OPENER_FEED,event.actorId,actor?.state.target??undefined);
      if(event.fighter==='kakashi'&&event.slot==='ultimate')gradeOnce(event.actorId,event.id,GRADE.void,.5,2.6,event.actorId,actor?.state.target??undefined);
      if(event.fighter==='kakashi'&&event.slot==='special'&&!event.branch)gradeLocal(event.actorId,event.id,GRADE.ki,.35,MOVES.kakashi.special.duration*.78,actor?.group.position,event.actorId,actor?.state.target??undefined);
      if(event.fighter==='kakashi'&&event.slot==='special'&&!event.branch&&actor)cast.echo=this.lightningClone(actor);
      if(event.fighter==='kakashi'&&event.slot==='ultimate'){const vortex=this.vortices.find(v=>!v.busy)??this.vortices[0];vortex.busy=true;cast.vortex=vortex;}
      this.casts.push(cast);if(this.casts.length>32)this.remove(this.casts.shift()!);
    }
    if(['hit','blocked','guard-break'].includes(event.kind))for(const c of this.casts)if(c.event.actorId===event.actorId&&c.event.slot===event.slot&&event.serverTime>c.event.serverTime&&((event.slot==='special'&&event.fighter==='kakashi'&&!c.event.branch)||(event.slot==='ultimate'&&event.fighter==='sasuke')))c.ended=event.serverTime;
  }}
  private planetary(id:string,f:Fighter,t:number,time:number){
    const s=f.state,kit=this.kit;
    const move=s.action==='special'&&s.branch==='airSpecial'?PLANETARY:undefined;
    let held=this.planets.get(id);
    if(move&&s.grounded&&t>=move.contacts[0]){
      const cast=s.actionSeq??Math.round(s.actionStarted*10);
      if(!held||held.cast!==cast){held=held??{cast,at:new THREE.Vector3(),since:time};held.cast=cast;held.since=time;held.at.copy(f.group.position);this.planets.set(id,held);}
    }
    if(!held)return;
    const age=time-held.since;
    if(age<0||age>.55)return;
    const grow=THREE.MathUtils.smoothstep(age,0,.08)*(1-THREE.MathUtils.smoothstep(age,.32,.55)),key=salt(id);
    const R=.85*grow,c=this.center.copy(held.at);c.y+=R*.75;
    kit.glows.add(c,R*2.2,RASEN.shell,1,SWIRL,1/2.2,key);
    kit.halos.add(c,R*4,RASEN.halo,.8*grow,GLOW,.05);
    for(let r=0;r<3;r++)this.windRing(c,R*(1.25+r*.18),1.1+r*1.9+time*.7*(r%2?1:-1),time*(19+r*5)*(r%2?-1:1),R*.075,.95);
    kit.glows.add(c,R*(2.6+age*2),RASEN.ring,.7*grow,RING,.07,key,.7);
    for(let i=0;i<3;i++){const a=time*7+i*2.094,o=this.a.set(Math.cos(a)*R*1.9,Math.sin(a*1.3)*R*.3+R*.2,Math.sin(a)*R*1.9).add(c);kit.glows.add(o,R*.55,RASEN.shell,.95,SWIRL,1/2.2,key+i+1);kit.halos.add(o,R*.9,RASEN.halo,.5*grow,GLOW,.05);}
    kit.lights.add(c,4.5*grow,RASEN.light,1.1*grow);
  }
  private near(fighters:ReadonlyMap<string,Fighter>,actorId:string,at:THREE.Vector3,reach:number){for(const f of fighters.values())if(f.state.id!==actorId&&f.state.alive&&f.group.position.distanceTo(at)<reach)return true;return false;}
  private palm(f:Fighter,out:THREE.Vector3){
    const hand=f.joints.get('RightHand'),index=f.bones.get('righthandindex1'),pinky=f.bones.get('righthandpinky1'),middle=f.bones.get('righthandmiddle1');
    if(!hand||!index||!pinky||!middle)return f.chargePosition(out);
    hand.getWorldPosition(out);middle.getWorldPosition(this.p1).sub(out).normalize();
    index.getWorldPosition(this.p2).sub(pinky.getWorldPosition(this.p3));this.p2.cross(this.p1).normalize();
    return out.addScaledVector(this.p1,.07).addScaledVector(this.p2,.14);
  }
  private windRing(center:THREE.Vector3,radius:number,tilt:number,spin:number,width:number,intensity:number){
    this.axis.set(Math.sin(tilt)*Math.cos(tilt*1.7),Math.cos(tilt),Math.sin(tilt)*Math.sin(tilt*1.7)).normalize();
    this.u.set(0,1,0).cross(this.axis);if(this.u.lengthSq()<1e-4)this.u.set(1,0,0);this.u.normalize();this.v.crossVectors(this.axis,this.u);
    const steps=12,arc=Math.PI*1.35;
    for(let i=0;i<steps;i++){
      const t0=spin+i/steps*arc,t1=spin+(i+1)/steps*arc,fade=Math.sin(Math.PI*(i+.5)/steps);
      this.a.copy(center).addScaledVector(this.u,Math.cos(t0)*radius).addScaledVector(this.v,Math.sin(t0)*radius);
      this.b.copy(center).addScaledVector(this.u,Math.cos(t1)*radius).addScaledVector(this.v,Math.sin(t1)*radius);
      this.kit.bolts.segment(this.a,this.b,width*(.4+.6*fade),RASEN.ring,intensity*fade,.28);
    }
  }
  private poof(at:THREE.Vector3,time:number){
    const sp=this.vfx.dust.spec,n=this.vfx.n(6,3);
    for(let i=0;i<n;i++){const a=i*2.399,r=.2+.15*((i*.37)%1);
      sp.reset(SPRITE.puff,time,.26+.1*((i*.53)%1)).pos(at.x+Math.cos(a)*r,at.y+(i%3)*.5-.3,at.z+Math.sin(a)*r).velocity(Math.cos(a)*1.6,.6+(i%2)*.5,Math.sin(a)*1.6);
      sp.drag=5;sp.gravity=-.6;sp.sized(.14,.36,.45).hot(SMOKE,1).cool(SMOKE_SHADE,.5);this.vfx.dust.emit();}
  }
  private clonesFor(f:Fighter){
    let n=0;for(const c of this.clones)if(c.owner===f.state.id)n++;
    for(;n<2;n++){const root=new THREE.Group(),copy=clone(f.model);root.name='shadow-clone';root.add(copy);root.visible=false;this.scene.add(root);
      copy.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;m.frustumCulled=false;m.castShadow=false;if(/shadow|equipment-held/i.test(m.name))m.visible=false;});
      this.clones.push({root,mixer:new THREE.AnimationMixer(copy),busy:false,owner:f.state.id,side:0,born:0,until:0,stage:0,poofed:true,appeared:true});}
  }
  private shadowClones(f:Fighter,time:number,dt:number){
    const s=f.state,stage=s.action==='light'&&!s.awakened?(s.chain??0):0,want=CLONE_STAGES[stage]??0;
    if(want>0){
      const key=s.actionStarted*8+stage;
      if(this.cloneSeen.get(f.state.id)!==key){this.cloneSeen.set(f.state.id,key);
        const move=RUSH.naruto[stage-1],take=f.clips.find(c=>clean(c.name)===clean('Rush '+stage))??f.clips.find(c=>clean(c.name)===clean('Rush 1'));
        let placed=0;
        for(const c of this.clones){if(c.owner!==f.state.id||placed>=want)continue;
          const kept=c.busy&&!c.poofed;
          c.busy=true;c.poofed=false;c.appeared=kept;c.stage=stage;c.side=want===1?1:(placed===0?1:-1);c.born=time;c.until=time+move.duration+.05;
          c.mixer.stopAllAction();if(take){const action=c.mixer.clipAction(take);action.reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.timeScale=take.duration/Math.max(.2,move.duration);action.play();}
          placed++;
        }
      }
    }
    for(const c of this.clones){
      if(c.owner!==f.state.id||!c.busy)continue;
      const yaw=s.yaw,side=c.side*.9;
      c.root.position.set(f.group.position.x+Math.cos(yaw)*side-Math.sin(yaw)*.15,f.group.position.y,f.group.position.z-Math.sin(yaw)*side-Math.cos(yaw)*.15);
      c.root.rotation.set(0,f.group.rotation.y,0);c.root.scale.copy(f.group.scale);
      if(!c.appeared){c.appeared=true;this.b.copy(c.root.position);this.b.y+=1;this.poof(this.b,time);}
      c.root.visible=time>=c.born&&time<c.until&&s.alive;
      if(c.root.visible)c.mixer.update(dt);
      if(time>=c.until||!s.alive){this.b.copy(c.root.position);this.b.y+=1;if(!c.poofed)this.poof(this.b,time);c.poofed=true;c.busy=false;c.root.visible=false;}
    }
  }
  private kuramaTails(f:Fighter,time:number,density:number){
    let tails=this.tails.get(f);
    if(!tails){
      const found=new Map<number,{seg:number;bone:THREE.Bone}[]>();let root:THREE.Object3D|undefined;
      f.group.traverse(o=>{const m=/^Tail(\d)(\d)(_end)?/.exec(o.name);if(!(o as THREE.Bone).isBone||!m)return;const tail=+m[1],seg=+m[2]+(m[3]?1:0);if(!found.has(tail))found.set(tail,[]);found.get(tail)!.push({seg,bone:o as THREE.Bone});if(!root){let r:THREE.Object3D=o;while(r.parent&&r.parent!==f.group)r=r.parent;root=r;}});
      if(found.size<9)return;
      tails=[...found.keys()].sort().map(k=>found.get(k)!.sort((a,b)=>a.seg-b.seg).map(x=>x.bone));
      this.tails.set(f,tails);if(root)this.tailRoot.set(f,root);
    }
    const first=tails[0][0];for(let p:THREE.Object3D|null=first;p;p=p.parent)if(!p.visible)return;
    this.tailRoot.get(f)?.updateWorldMatrix(true,true);
    const per=Math.max(2,Math.round(4*density)),scale=f.group.scale.x;
    for(let t=0;t<tails.length;t++){const chain=tails[t];
      for(let k=0;k<per&&this.flameCount<1000;k++){
        const u=(k+.5)/per*(chain.length-1),i=Math.min(chain.length-2,Math.floor(u)),w=u-i,phase=(time*2.2+t*.37+k*.618)%1;
        this.p1.setFromMatrixPosition(chain[i].matrixWorld);this.p2.setFromMatrixPosition(chain[i+1].matrixWorld);
        this.center.copy(this.p1).lerp(this.p2,w);this.axis.copy(this.p2).sub(this.p1).normalize();
        this.u.set(0,1,0).addScaledVector(this.axis,.6).normalize();
        this.transform.position.copy(this.center).addScaledVector(this.u,.25*scale*phase);
        this.transform.quaternion.setFromUnitVectors(this.v.set(0,1,0),this.u);
        const grow=(1-phase*.6)*(1.3-.5*(u/(chain.length-1)))*KURAMA_FLAME;
        this.transform.scale.set(2*grow*scale,1.7*grow*scale,1);this.transform.updateMatrix();
        this.flames.setMatrixAt(this.flameCount,this.transform.matrix);this.flames.setColorAt(this.flameCount++,this.tint.setRGB(.95-phase*.55,(t*.29+k*.137)%1,flamePalette(FIRE)));
      }
    }
  }
  update(time:number,dt:number,fighters:ReadonlyMap<string,Fighter>,density:number){
    const kit=this.kit;kit.begin(time,density);this.flameCount=0;this.flameMaterial.uniforms.uTime.value=time;
    for(const [id,f] of fighters){
      const s=f.state;
      if(s.fighter==='naruto'){this.clonesFor(f);this.shadowClones(f,time,dt);if(s.awakened&&s.alive)this.kuramaTails(f,time,kit.density);}
      if(!s.alive){kit.forget(id);continue;}
      const t=s.actionTime*s.actionDuration,key=salt(id);
      if((s.fighter==='kakashi'||s.fighter==='sasuke')&&(s.action==='heavy'&&!s.branch||(s.fighter==='kakashi'&&s.action==='ultimate'))){
        const ultimate=s.action==='ultimate',move=MOVES[s.fighter][s.action],contact=move.contacts[0];
        const strength=THREE.MathUtils.smoothstep(t,0,.2)*(1-THREE.MathUtils.smoothstep(t,s.actionDuration-.3,s.actionDuration));
        const hand=s.fighter==='sasuke'?f.handL:f.handR,floor=s.grounded?f.group.position.y:NaN;
        const near=1-Math.min(1,Math.abs(t-contact)/.14);
        kit.ball(hand,strength*(ultimate?1.3:1)*(1+.25*near),key,floor,LIGHTNING.glow,LIGHTNING.light,BALL_REACH);
        kit.trail(id,hand,strength*THREE.MathUtils.smoothstep(t,.18,.32)*(1-THREE.MathUtils.smoothstep(t,contact+.08,contact+.25)),key);
        if(near>0&&t>=contact-.03){
          const struck=struckBody(f,fighters);
          if(struck){bodyCenter(struck,this.center);kit.arc(hand,this.center,kit.tick*5+key,.03*near+.01,LIGHTNING.glow,near,2,3,.3);kit.flash(this.center,near*(ultimate?1.2:.9),key+3);}
          else kit.flash(hand,near*.6,key+3,FIZZLE_REACH);
        }
      }else if(s.fighter==='kakashi'&&s.action==='special'&&!s.branch){
        const release=MOVES.kakashi.special.contacts[0],floor=s.grounded?f.group.position.y:NaN;
        const strength=THREE.MathUtils.smoothstep(t,0,.22)*(1-THREE.MathUtils.smoothstep(t,release+.02,release+.2));
        kit.ball(f.handR,strength*(.7+.5*THREE.MathUtils.smoothstep(t,.2,release)),key,floor);
        kit.trail(id,f.handR,strength*.8,key);
        if(Math.abs(t-release)<.08)kit.flash(f.handR,1-Math.abs(t-release)/.08,key+3);
      }else kit.forget(id);
      const bigBallMove=s.branch==='lllh'?BIG_BALL:undefined;
      if(s.fighter==='naruto'&&!s.awakened&&s.action==='heavy'&&(!s.branch||bigBallMove)){
        const release=bigBallMove?bigBallMove.contacts[0]:MOVES.naruto.heavy.contacts[0];
        const radius=bigBallMove?bigBall(t,release):(.035+THREE.MathUtils.smoothstep(t,.06,.48)*.18)*(1-THREE.MathUtils.smoothstep(t,release+.10,release+.38));
        if(radius>.012){
          this.palm(f,this.center);const grown=Math.min(1,radius/.2);
          kit.glows.add(this.center,radius*2.2,RASEN.shell,1,SWIRL,1/2.2,key);
          kit.halos.add(this.center,radius*4.6,RASEN.halo,.75,GLOW,.05);
          for(let r=0;r<3;r++)this.windRing(this.center,radius*(1.28+r*.16),1.1+r*1.9+time*.7*(r%2?1:-1),time*(19+r*5)*(r%2?-1:1),radius*.075,.95);
          kit.lights.add(this.center,2.6*grown,RASEN.light,.8*grown);
          const grind=1-Math.min(1,Math.abs(t-release-.04)/.16);
          if(grind>0){kit.glows.add(this.center,radius*(2.2+1.2*grind),RASEN.ring,.7*grind,RING,.07,key,.7);kit.halos.add(this.center,radius*4.5,RASEN.halo,.5*grind,GLOW,.05);}
        }
      }
      if(s.fighter==='naruto'&&!s.awakened)this.planetary(id,f,t,time);
      if(s.fighter==='naruto'&&!s.awakened&&s.action==='ultimate'){
        const release=MOVES.naruto.ultimate.contacts[0];
        if(t<release+.05){
          const charge=THREE.MathUtils.clamp(t/release,0,1),size=BIJUDAMA.held*(.14+.86*Math.pow(charge,.8));
          this.center.copy(f.handR).lerp(f.handL,.5);this.center.y+=size+.1;
          const n=Math.round(26*kit.density);
          for(let i=0;i<n;i++){
            const phase=(time*1.25+i*.618)%1,a=i*2.399+time*1.9,tilt=Math.sin(i*1.37)*.9,r=size*(1.05+2.4*(1-phase));
            this.a.set(Math.cos(a)*Math.cos(tilt),Math.sin(tilt),Math.sin(a)*Math.cos(tilt)).multiplyScalar(r).add(this.center);
            this.b.copy(this.a).sub(this.center).multiplyScalar(-.16).add(this.a);
            kit.bolts.segment(this.a,this.b,.022+.02*phase,i%2?BIJU.white:BIJU.dark,.35+.65*phase,i%2?.4:.05);
          }
          kit.glows.add(this.center,size*1.25,BIJU.rim,.85*THREE.MathUtils.smoothstep(charge,.05,.3),RING,.035,key,.8);
          kit.lights.add(this.center,size*3.2,BIJU.light,.55*charge);
        }
      }
    }
    for(let i=this.casts.length-1;i>=0;i--){const c=this.casts[i],e=c.event,move=MOVES[e.fighter!][e.slot!],actor=fighters.get(e.actorId),age=castAge(c,time,actor,move.contacts[0]);const travel=move.range/(move.speed??20),limit=move.style==='projectile'?Math.max(move.duration,move.contacts[0]+travel):move.duration;
      if(age>limit+.2||(!c.ended&&age<move.contacts[0]&&chargeWasCancelled(e,move.contacts[0],actor?.state,time))){this.remove(c);this.casts.splice(i,1);continue;}
      const ult=e.slot==='ultimate',finish=move.contacts[move.contacts.length-1];
      if(ult&&actor?.state.action==='ultimate'&&actor.state.confirmedAt!==undefined&&!c.confirmed){c.confirmed=true;if(e.fighter==='kakashi')gradeOnce(e.actorId,-e.id,GRADE.void,.5,Math.max(.3,move.duration-age),e.actorId,actor.state.target??undefined);}
      if(ult&&!c.confirmed&&age>move.contacts[0]&&(actor?.state.action!=='ultimate'||actor.state.whiffedAt!==undefined))c.whiffed??=age;
      const gone=c.whiffed===undefined?1:1-THREE.MathUtils.smoothstep(age-c.whiffed,0,.25);
      if(c.vortex){const mesh=c.vortex.mesh;
        if(actor){const strength=gone*THREE.MathUtils.smoothstep(age,.05,move.contacts[0])*(1-THREE.MathUtils.smoothstep(age,finish+.1,finish+.6));mesh.visible=strength>.01;const yaw=actor.state.yaw;
          mesh.position.copy(actor.group.position).add(this.a.set(Math.sin(yaw)*.3+Math.cos(yaw)*1.1,1.25,Math.cos(yaw)*.3-Math.sin(yaw)*1.1));mesh.material.uniforms.age.value=age;mesh.material.uniforms.opacity.value=strength;mesh.scale.setScalar(.25+strength*.38);
          if(c.confirmed&&age>move.contacts[0]+.1&&age<finish+.15){for(let k=0;k<8;k++){const a=k*Math.PI/4;this.a.copy(mesh.position).add(this.b.set(Math.cos(a)*.9*Math.cos(yaw),Math.sin(a)*.9,-Math.cos(a)*.9*Math.sin(yaw)));this.b.copy(this.a).lerp(mesh.position,.7);kit.arc(this.a,this.b,kit.tick*5+k,.02*strength,INDRA.glow,.8*strength,0,2,.18);}}}
        else mesh.visible=false;
      }
      if(e.fighter==='sasuke'&&e.slot==='special'&&!e.branch&&age>=move.contacts[0]&&!armoryDraws('sasuke','special',undefined,e.actorId)){
        const fade=1-THREE.MathUtils.smoothstep(age,move.duration-.6,move.duration);const ignite=THREE.MathUtils.smoothstep(age,move.contacts[0],move.contacts[0]+.25);const count=Math.round(130*kit.density);this.center.set(e.endpoint!.x,(actor?.state.grounded?actor.group.position.y:0)+.0,e.endpoint!.z);
        for(let j=0;j<count&&this.flameCount<1000;j++){const a=j*2.4,r=Math.sqrt((j+.5)/count)*move.radius*(.35+.65*ignite),phase=(time*(1.1+(j%3)*.25)+j*.618)%1;
          const grow=(1-phase*.4)*fade,tall=(1.5+phase*(1.4+(j%5)*.3))*grow;
          this.transform.position.copy(this.center).add(this.a.set(Math.cos(a)*r,tall*.25*.92+.02,Math.sin(a)*r));
          this.transform.quaternion.setFromAxisAngle(this.b.set(Math.cos(a+1.6),0,Math.sin(a+1.6)),Math.sin(time*2.3+j)*.14);
          this.transform.scale.set((1.6+.5*(j%3))*grow,tall,1);this.transform.updateMatrix();
          this.flames.setMatrixAt(this.flameCount,this.transform.matrix);this.flames.setColorAt(this.flameCount++,this.tint.setRGB(1-phase*.6,(j*.137)%1,flamePalette(BLACK)));}
      }
      if(c.echo){const echo=c.echo;echo.root.visible=age>=0&&(e.fighter==='sasuke'||!c.ended);echo.mixer.update(dt*(e.fighter==='kakashi'?2.4:1));
        if(e.fighter==='kakashi'){
          const phase=THREE.MathUtils.clamp((age-move.contacts[0])/travel,0,1);echo.root.position.set(e.origin!.x,e.origin!.y-1,e.origin!.z).lerp(this.a.set(e.endpoint!.x,e.endpoint!.y-1,e.endpoint!.z),phase);echo.root.rotation.y=Math.atan2(e.endpoint!.x-e.origin!.x,e.endpoint!.z-e.origin!.z);echo.root.visible=age>=move.contacts[0]&&(!c.ended||time-c.ended<.18);
          if(!c.strikeAt&&this.near(fighters,e.actorId,echo.root.position,2.5)){const clip=actor?.clips.find(a=>clean(a.name)==='lightningblade');if(clip){echo.mixer.stopAllAction();echo.action=echo.mixer.clipAction(clip).play();echo.action.time=.42;echo.action.clampWhenFinished=true;echo.action.setLoop(THREE.LoopOnce,1);c.strikeAt=time;}}
          if(echo.shell)echo.shell.opacity=.62*(c.ended?1-THREE.MathUtils.smoothstep(time-c.ended,0,.18):THREE.MathUtils.smoothstep(age,move.contacts[0],move.contacts[0]+.08));
          const hand=echo.bones.get('righthand');echo.root.updateMatrixWorld(true);
          if(hand)hand.getWorldPosition(this.center);else{this.center.copy(echo.root.position);this.center.y+=1;}
          const live=echo.root.visible?(c.ended?1-THREE.MathUtils.smoothstep(time-c.ended,0,.18):1):0;
          kit.ball(this.center,.9*live,salt(e.actorId)+11,echo.root.position.y);kit.trail(c.trail,this.center,live,salt(e.actorId)+13);
        }else if(actor){
          const yaw=actor.state.yaw;echo.root.position.copy(actor.group.position).add(this.a.set(-Math.sin(yaw)*.75,0,-Math.cos(yaw)*.75));echo.root.rotation.y=yaw;echo.root.scale.setScalar(1.2);if(echo.action){const L=echo.action.getClip().duration,c0=move.contacts[0],from=Math.max(0,INDRA_RELEASE-1.4*c0/L),u=age<=c0?from+(INDRA_RELEASE-from)*Math.max(0,age)/c0:INDRA_RELEASE+(1-INDRA_RELEASE)*Math.min(1,(age-c0)/Math.max(.1,move.duration-c0));echo.action.time=Math.min(L-.001,u*L);}echo.mixer.update(0);echo.root.updateMatrixWorld(true);const strength=gone*THREE.MathUtils.smoothstep(age,0,.3)*(1-THREE.MathUtils.smoothstep(age,move.duration-.5,move.duration));for(const m of echo.materials)m.opacity=.68*strength;
          const hand=echo.bones.get('lefthand');if(hand){hand.getWorldPosition(this.center);
            for(let j=0;j<14;j++){const a=-Math.PI/2+j/14*Math.PI,b=a+Math.PI/14;this.a.copy(this.center).add(this.p1.set(Math.sin(yaw)*Math.cos(a)*.6,Math.sin(a)*1.45,Math.cos(yaw)*Math.cos(a)*.6));this.b.copy(this.center).add(this.p1.set(Math.sin(yaw)*Math.cos(b)*.6,Math.sin(b)*1.45,Math.cos(yaw)*Math.cos(b)*.6));kit.arc(this.a,this.b,kit.tick+j*7,.045*strength,INDRA.glow,strength,j%4===0?1:0,2,.12);}
            const draw=echo.bones.get('righthand');if(draw&&age<move.contacts[0]){draw.getWorldPosition(this.b);for(const sign of [-1,1]){this.a.copy(this.center).y+=sign*1.45;kit.arc(this.a,this.b,kit.tick+sign*3,.014*strength,INDRA.glow,.9*strength,0,1,.05);}
              const nock=THREE.MathUtils.smoothstep(age,move.contacts[0]*.3,move.contacts[0]*.9);kit.arc(this.b,this.center,kit.tick*3+1,.05*nock,INDRA.glow,nock,2,3,.1);kit.ball(this.b,.8*nock,salt(e.actorId)+21,NaN,INDRA.glow,INDRA.light,.8);}
          }
        }
      }
      if(e.fighter==='sasuke'&&ult&&actor&&this.susanoos.hand(actor,'L',this.center)){
        const strength=gone*THREE.MathUtils.smoothstep(age,0,.3)*(1-THREE.MathUtils.smoothstep(age,move.duration-.5,move.duration)),yaw=actor.state.yaw,size=this.susanoos.heightOf(actor)/4.6;
        for(let j=0;j<14;j++){const a=-Math.PI/2+j/14*Math.PI,b=a+Math.PI/14;this.a.copy(this.center).add(this.p1.set(Math.sin(yaw)*Math.cos(a)*.95*size,Math.sin(a)*2.1*size,Math.cos(yaw)*Math.cos(a)*.95*size));this.b.copy(this.center).add(this.p1.set(Math.sin(yaw)*Math.cos(b)*.95*size,Math.sin(b)*2.1*size,Math.cos(yaw)*Math.cos(b)*.95*size));kit.arc(this.a,this.b,kit.tick+j*7,.06*strength*size,INDRA.glow,strength,j%4===0?1:0,2,.12);}
        if(age<move.contacts[0]&&this.susanoos.hand(actor,'R',this.b)){for(const sign of [-1,1]){this.a.copy(this.center).y+=sign*2.1*size;kit.arc(this.a,this.b,kit.tick+sign*3,.018*strength,INDRA.glow,.9*strength,0,1,.05);}
          const nock=THREE.MathUtils.smoothstep(age,move.contacts[0]*.3,move.contacts[0]*.9);kit.arc(this.b,this.center,kit.tick*3+1,.06*nock,INDRA.glow,nock,2,3,.1);kit.ball(this.b,.9*nock,salt(e.actorId)+21,NaN,INDRA.glow,INDRA.light,.8);}
      }
      if(e.fighter==='sasuke'&&e.slot==='ultimate'&&age>=move.contacts[0]&&!c.ended&&actor){
        const yaw=actor.state.yaw,phase=THREE.MathUtils.clamp((age-move.contacts[0])/travel,0,1);this.center.set(e.origin!.x,e.origin!.y,e.origin!.z).lerp(this.a.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z),phase);
        this.tail.copy(this.center).add(this.a.set(-Math.sin(yaw)*2.4,0,-Math.cos(yaw)*2.4));
        kit.arc(this.tail,this.center,kit.tick*7+2,.11,INDRA.glow,1,3,4,.08);
        kit.arc(this.tail,this.center,kit.tick*11+5,.05,INDRA.glow,.9,2,4,.22);
        kit.ball(this.center,1.5,salt(e.actorId)+31,NaN,INDRA.glow,INDRA.light,.9);kit.trail(c.trail,this.center,1,salt(e.actorId)+33,INDRA.glow);
      }
      if(e.fighter==='sasuke'&&ult&&c.confirmed&&actor&&age<finish+.1){const foe=actor.state.target?fighters.get(actor.state.target):undefined;
        if(foe){const k=THREE.MathUtils.smoothstep(age,move.contacts[0],move.contacts[0]+.15);this.center.copy(foe.group.position);this.center.y+=1.1;
          for(let j=0;j<6;j++){const a=j*1.047+time*3;this.a.copy(this.center).add(this.b.set(Math.cos(a)*1.1,Math.sin(a*1.3)*.9,Math.sin(a)*1.1));kit.arc(this.a,this.center,kit.tick*13+j,.035*k,INDRA.glow,.9*k,1,2,.14);}
          kit.ball(this.center,1.1*k,salt(e.actorId)+41,NaN,INDRA.glow,INDRA.light,.7);}}
    }
    for(let i=this.rasen.length-1;i>=0;i--){const r=this.rasen[i],e=r.event,move=MOVES.naruto.special,age=time-e.serverTime-move.contacts[0],span=Math.hypot(e.endpoint!.x-e.origin!.x,e.endpoint!.z-e.origin!.z),travel=span/(move.speed??24);
      if(age>travel+.5||(r.hitAt!==undefined&&time-r.hitAt>.4)){this.rasen.splice(i,1);continue;}
      if(age<0)continue;
      const k=r.hitAt!==undefined?1-(time-r.hitAt)/.4:1,t=Math.min(1,age/Math.max(.05,travel));
      this.center.set(e.origin!.x,e.origin!.y,e.origin!.z).lerp(this.a.set(e.endpoint!.x,e.endpoint!.y,e.endpoint!.z),t);
      kit.lights.add(this.center,4.5,RASEN.light,.9*k);
      this.tail.copy(this.center);this.tail.y=(fighters.get(e.actorId)?.group.position.y??this.center.y-1.3)+.2;kit.lights.add(this.tail,3,RASEN.light,.6*k);}
    for(let i=this.clones.length-1;i>=0;i--){const c=this.clones[i];if(c.owner&&!fighters.has(c.owner)){c.mixer.stopAllAction();c.root.removeFromParent();this.clones.splice(i,1);}}
    this.susanoos.update(time,dt,fighters,kit);
    kit.end();
    this.flames.count=this.flameCount;this.flames.instanceMatrix.needsUpdate=true;if(this.flames.instanceColor)this.flames.instanceColor.needsUpdate=true;
    for(const v of this.vortices)if(!v.busy)v.mesh.visible=false;
  }
  private remove(c:Cast){if(c.vortex){c.vortex.busy=false;c.vortex.mesh.visible=false;}if(c.echo){c.echo.shell?.dispose();c.echo.root.removeFromParent();c.echo.mixer.stopAllAction();c.echo.mixer.uncacheRoot(c.echo.model);for(const m of c.echo.materials)m.dispose();}this.kit.forget(c.trail);}
  reset(){for(const c of this.casts)this.remove(c);this.casts=[];this.rasen=[];this.planets.clear();this.seen.clear();this.cloneSeen.clear();for(const c of this.clones){c.mixer.stopAllAction();c.root.removeFromParent();}this.clones=[];this.flames.count=0;this.kit.reset();for(const v of this.vortices){v.busy=false;v.mesh.visible=false;}this.susanoos.reset();}
  dispose(){this.reset();this.susanoos.dispose();for(const echo of this.warmEchoes)this.remove({event:{}as CombatEvent,echo,trail:''});this.warmEchoes=[];this.flames.removeFromParent();this.flames.dispose();this.flameGeometry.dispose();this.flameMaterial.dispose();this.kit.dispose();this.warm.dispose();for(const v of this.vortices){v.mesh.removeFromParent();v.mesh.material.dispose();}this.vortexGeometry.dispose();}
}
