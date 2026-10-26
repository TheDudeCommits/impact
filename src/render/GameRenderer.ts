import * as THREE from 'three';
import { DREAM_IMPACT } from './dreamFlag';
import { VfxKit } from './vfx/VfxKit';
import { LIQUID_FLOORS } from '../game/footing';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import type { Settings } from '../config';
import { STAGES, type StageDefinition, type StageId } from '../game/stages';
import { previewStage } from './look/preview';
import { lookFor, type LookPreset } from './look/stageLooks';
import { animeFinishOn, setAnimeFinish } from './look/sparkingLook';
import { focusUniforms, LookBloomPass, LookFinalPass } from './look/LookPost';
import { SkyDome } from './look/SkyDome';
import { Atmosphere } from './look/Atmosphere';
import { StageLife } from './look/StageLife';
import { frameUniforms, setToonLook, setToonResolution } from './look/toonShading';
import { setCloudTime, setCookieLook } from './look/lightCookie';
import { setAlbedoLook, setRoomDim, windowGlow } from './look/stageMaterials';
import { liftFightersUnderGrade } from './look/gradeReadability';
import { ResolutionGovernor } from './ResolutionGovernor';
import {powerBudget} from './powerBudget';
import {materialTextures,showCasters,warmTextures} from './textureWarmup';
import { compileShadowPrograms, introspectPrograms } from './programWarmup';
import {setTextureCap,textureCapFor} from './textureCap';
import { installSkinnedBounds } from './skinnedBounds';
import { skipHiddenChildren } from './hiddenMatrices';
import { EmptyInstances } from './emptyInstances';
import { loadInkImpacts } from './vfx/SparkField';

const SHADOW_HALF = { high: 18, medium: 18, low: 15 } as const;
const MSAA = { high: 4, medium: 2, low: 0 } as const;
export type BlurKeep={visualCenter(out:THREE.Vector3):THREE.Vector3;state?:{size?:number}};

export class GameRenderer {
  readonly scene=new THREE.Scene();
  readonly emptyInstances=new EmptyInstances(this.scene);
  readonly camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.08,340);
  readonly renderer:THREE.WebGLRenderer;
  readonly composer:EffectComposer;
  readonly bloomPass:LookBloomPass;
  readonly finalPass:LookFinalPass;
  readonly hemi:THREE.HemisphereLight;
  readonly sun:THREE.DirectionalLight;
  readonly fill:THREE.DirectionalLight;
  readonly sky:SkyDome;
  readonly atmosphere:Atmosphere;
  readonly life:StageLife;
  readonly frameTimes:number[]=[];
  look:LookPreset=lookFor('harbor');
  stage:StageId='harbor';
  readonly governor:ResolutionGovernor;
  contextLost=false;
  holdResolution=false;
  private pixelCap=1;
  private hordeWorkload=false;
  private budgetKey='';
  private budgetStrong=false;
  setHordeWorkload(horde:boolean){if(this.hordeWorkload===horde)return;this.hordeWorkload=horde;this.applySettings(this.settings);}
  private readonly pmrem:THREE.PMREMGenerator;
  private environment?:THREE.WebGLRenderTarget;
  private time=0;
  constructor(parent:HTMLElement,private settings:Settings){
    this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});
    this.governor=new ResolutionGovernor(this.renderer.getContext() as WebGL2RenderingContext);
    installSkinnedBounds();
    skipHiddenChildren(this.scene);
    loadInkImpacts();
    this.renderer.domElement.id='game-canvas';this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label','Three-dimensional fighting arena');parent.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost',()=>{this.contextLost=true;});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.contextLost=false;this.governor.restored();this.refreshEnvironment();});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.debug.checkShaderErrors=!!import.meta.env?.DEV;
    this.renderer.info.autoReset=false;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.scene.background=new THREE.Color(0x7facce);this.scene.fog=new THREE.Fog(0x7facce,90,400);
    this.hemi=new THREE.HemisphereLight(0xd7eaff,0x324c70,.85);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xfff0d6,2.7);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.bias=-.0002;this.sun.shadow.normalBias=.025;this.sun.shadow.radius=1.4;this.scene.add(this.sun,this.sun.target);
    this.fill=new THREE.DirectionalLight(0x8bbbff,.3);this.scene.add(this.fill);
    this.sky=new SkyDome(this.scene);
    this.atmosphere=new Atmosphere(this.scene);
    this.life=new StageLife(this.scene,this.sky,this.renderer.domElement);
    this.pmrem=new THREE.PMREMGenerator(this.renderer);
    const packed=this.renderer.extensions.has('EXT_color_buffer_float');
    const target=new THREE.WebGLRenderTarget(innerWidth*this.renderer.getPixelRatio(),innerHeight*this.renderer.getPixelRatio(),packed?{type:THREE.UnsignedInt101111Type,format:THREE.RGBFormat,samples:MSAA[settings.quality]}:{type:THREE.HalfFloatType,samples:MSAA[settings.quality]});
    target.texture.name='EffectComposer.rt1';
    target.depthTexture=new THREE.DepthTexture(target.width,target.height);
    this.composer=new EffectComposer(this.renderer,target);
    this.composer.renderTarget2.depthTexture??=new THREE.DepthTexture(target.width,target.height);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.bloomPass=new LookBloomPass();this.composer.addPass(this.bloomPass);
    this.finalPass=new LookFinalPass();this.finalPass.bloom=this.bloomPass;
    this.finalPass.beforeRender=()=>this.focusFinish();this.composer.addPass(this.finalPass);
    this.camera.position.set(3.2,3.6,15);this.camera.lookAt(0,1,-1);
    window.addEventListener('resize',()=>this.resize());this.applySettings(settings);
    this.applyLook(this.look,STAGES.harbor);
    if(import.meta.env?.DEV)this.installProbe();
  }
  async loadSky(){this.refreshEnvironment();}
  applyStage(requested:StageDefinition){
    const stage=STAGES[previewStage(requested.id)];
    this.camera.far=stage.cameraFar;this.camera.updateProjectionMatrix();
    this.stage=stage.id;
    this.applyLook(lookFor(stage.id),stage);
    VfxKit.setLiquid(this.scene,LIQUID_FLOORS[stage.id]);
    this.refreshEnvironment();
  }
  private readonly paneGlow=new THREE.Color(0,0,0);
  private readonly keyDir=new THREE.Vector3(0,1,0);
  private readonly shadowRight=new THREE.Vector3(1,0,0);
  private readonly shadowUp=new THREE.Vector3(0,0,1);
  private applyLook(look:LookPreset,stage:StageDefinition){
    this.look=look;
    const fog=this.scene.fog as THREE.Fog;
    fog.near=look.fog.near??stage.fog[0];fog.far=Math.min(look.fog.far??stage.fog[1],stage.cameraFar);fog.color.setHex(look.fog.color);
    this.fogBase.copy(fog.color);
    (this.scene.background as THREE.Color).copy(fog.color);
    this.hemi.color.setHex(look.hemi.sky);this.hemi.groundColor.setHex(look.hemi.ground);this.hemi.intensity=look.hemi.intensity;
    this.sun.color.setHex(look.key.color);this.sun.intensity=look.key.intensity;
    this.keyDir.set(...look.key.dir).normalize();
    this.shadowRight.crossVectors(THREE.Object3D.DEFAULT_UP,this.keyDir);
    if(this.shadowRight.lengthSq()<1e-6)this.shadowRight.set(1,0,0);
    this.shadowRight.normalize();this.shadowUp.crossVectors(this.keyDir,this.shadowRight).normalize();
    this.fill.color.setHex(look.fill.color);this.fill.intensity=look.fill.intensity;this.fill.position.set(...look.fill.dir).multiplyScalar(40);
    this.scene.environmentIntensity=look.ibl;
    setToonLook(look);setCookieLook(look);setAlbedoLook(look);
    this.paneGlow.setHex(look.key.color).multiplyScalar(look.cookie?look.cookie.glow??2.4:0);
    this.sky.setLook(look,fog.color);
    this.atmosphere.setLook(look);
    this.life.setStage(stage.id,look);
    this.finalPass.setGrade(look);
    const b=this.bloomPass.bloom;b.threshold=look.bloom.threshold;b.knee=look.bloom.knee;b.radius=look.bloom.radius;b.strength=look.bloom.strength;
  }
  private refreshEnvironment(){
    this.sky.disc=false;
    const next=this.pmrem.fromScene(this.sky.envScene,0,.1,100,{size:128});
    this.sky.disc=true;
    this.environment?.dispose();this.environment=next;
    this.scene.environment=next.texture;
  }
  async compileScene(root:THREE.Object3D=this.scene){
    const previous=this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.composer.renderTarget1);
    let ready:Promise<unknown>;
    try{ready=this.renderer.compileAsync(root,this.camera,this.scene);this.compileShadows(root);}
    finally{this.renderer.setRenderTarget(previous);}
    await ready;
    introspectPrograms(this.renderer);
  }
  private compileShadows(root:THREE.Object3D){
    const whole=root===this.scene,keeper=whole||!this.shadowKeeper?new THREE.MeshDepthMaterial():this.shadowKeeper;
    try{compileShadowPrograms(this.renderer,root,this.scene,this.camera,keeper);}
    catch(error){console.warn('shadow programs not compiled',error);}
    if(keeper!==this.shadowKeeper){this.shadowKeeper?.dispose();this.shadowKeeper=keeper;}
  }
  private shadowKeeper?:THREE.MeshDepthMaterial;
  uploadTextures(root:THREE.Object3D=this.scene,extra:readonly THREE.Texture[]=[]){
    for(const texture of new Set([...materialTextures(root),...extra]))this.uploadTexture(texture);
  }
  uploadTexturesOverFrames(current:()=>boolean,extra:readonly THREE.Texture[]=[]){return warmTextures(new Set([...materialTextures(this.scene),...extra]),texture=>this.uploadTexture(texture),current);}
  private uploadTexture(texture:THREE.Texture){try{this.renderer.initTexture(texture);}catch{ }}
  warmDraw(roots:readonly THREE.Object3D[],whole:readonly THREE.Object3D[]=[]){
    const previous=this.renderer.getRenderTarget();
    let warm:ReturnType<typeof showCasters>|undefined;
    try{
      warm=showCasters(roots,this.scene,whole);
      for(const skeleton of warm.skeletons){skeleton.computeBoneTexture();if(skeleton.boneTexture)this.uploadTexture(skeleton.boneTexture);}
      if(!warm.casters&&!warm.unculled.length)return;
      const target=this.warmTarget??=this.composer.renderTarget1.clone();
      target.samples=0;target.setSize(16,16);
      this.renderer.setRenderTarget(target);this.renderer.render(this.scene,this.camera);
    }catch(error){console.warn('warm draw failed',error);}
    finally{this.renderer.setRenderTarget(previous);warm?.restore();}
  }
  private warmTarget?:THREE.WebGLRenderTarget;
  resize(){const w=innerWidth,h=innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer.setSize(w,h);setToonResolution(h*this.renderer.getPixelRatio());}
  applySettings(settings:Settings){
    this.settings=settings;const q=settings.quality;
    setTextureCap(textureCapFor(q));
    const budget=powerBudget(settings,this.governor.relaxed,this.hordeWorkload),cap=budget.pixelCap;
    this.budgetStrong=this.governor.relaxed;
    const key=`${q}:${settings.powerMode??'auto'}:${this.hordeWorkload}:${this.budgetStrong}`;
    if(key!==this.budgetKey){this.governor.reset();this.budgetKey=key;this.pendingRatio=0;}
    this.governor.budgetMs=budget.gpuBudget;this.governor.frameMs=1000/budget.fps;
    this.pixelCap=Math.min(devicePixelRatio,cap);
    this.governor.floor=this.pixelCap>1?Math.max(.6,1/this.pixelCap):.75;
    this.renderer.setPixelRatio(this.pixelCap*this.governor.scale);this.composer.setPixelRatio(this.pixelCap*this.governor.scale);
    const size=budget.shadowSize;
    if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}
    const half=SHADOW_HALF[q],cam=this.sun.shadow.camera;
    Object.assign(cam,{left:-half,right:half,top:half,bottom:-half,near:.5,far:150});cam.updateProjectionMatrix();
    const samples=budget.samples;
    for(const target of [this.composer.renderTarget1,this.composer.renderTarget2])if(target.samples!==samples){target.samples=samples;target.dispose();}
    this.bloomPass.enabled=budget.bloom;
    this.bloomPass.bloom.active=q==='high'?5:4;
    this.atmosphere.setQuality(q,settings.effects);
    this.life.setQuality(q,settings.effects);
    this.resize();
  }
  private readonly focus=new THREE.Vector3();
  private focusAt=-1;
  private readonly finishPoint=new THREE.Vector3();private readonly finishCrown=new THREE.Vector3();
  private focusFinish(){
    const cam=this.camera,u=focusUniforms,p=this.finishPoint,h=this.finishCrown;
    u.uClip.value.set(cam.near,cam.far);
    let near=Infinity,far=0,cx=0,cz=0,count=0,spread=0;
    for(const o of this.scene.children){
      if(!o.visible||!o.name.startsWith('fighter-'))continue;
      const size=o.scale.y||1;
      p.copy(o.position);p.y+=size;p.applyMatrix4(cam.matrixWorldInverse);const z=-p.z;
      if(z<cam.near||z>60)continue;
      p.copy(o.position).project(cam);h.copy(o.position);h.y+=1.9*size;h.project(cam);
      if(Math.abs(p.x)>1.25||p.y>1.3||h.y<-1.3)continue;
      near=Math.min(near,z);far=Math.max(far,z);
      if(count<2){if(count)spread=Math.hypot(o.position.x-cx,o.position.z-cz);cx=(cx*count+o.position.x)/(count+1);cz=(cz*count+o.position.z)/(count+1);count++;}
    }
    if(near===Infinity){
      if(this.focusAt>=0){p.copy(this.focus).applyMatrix4(cam.matrixWorldInverse);near=far=Math.max(1,-p.z);}else near=far=8;
    }
    if(!count&&this.focusAt>=0){cx=this.focus.x;cz=this.focus.z;}
    const pool=Math.max(2.5,spread*.5+2);u.uPool.value.set(cx,cz,pool,pool+7);
    const tanY=Math.tan(THREE.MathUtils.degToRad(cam.fov)/2)/cam.zoom;u.uProj.value.set(tanY*cam.aspect,tanY);
    u.uViewToWorld.value.copy(cam.matrixWorld);u.uUpView.value.set(0,1,0).transformDirection(cam.matrixWorldInverse);
    const n=Math.max(.3,near-.8),f=far+1.2,start=f*1.05+1;
    u.uFocus.value.set(n,start,start+Math.max(6,f*1.4),n*.4);
  }
  setFocus(point:{x:number;y:number;z:number}){this.focus.set(point.x,point.y,point.z);this.focusAt=this.time;}
  private readonly shadowCenter=new THREE.Vector3();
  private readonly scratch=new THREE.Vector3();
  private updateShadow(){
    const c=this.shadowCenter,half=SHADOW_HALF[this.settings.quality];
    const forward=this.camera.getWorldDirection(this.scratch);forward.y=0;
    if(forward.lengthSq()<1e-6)forward.set(0,0,-1);forward.normalize();
    if(this.focusAt>=0&&this.time-this.focusAt<.5&&this.focus.distanceToSquared(this.camera.position)<half*half*.5)c.copy(this.focus);
    else c.copy(this.camera.position).addScaledVector(forward,6).setY(0);
    c.addScaledVector(forward,half*.33);
    const texel=2*half/this.sun.shadow.mapSize.x;
    const x=Math.round(c.dot(this.shadowRight)/texel)*texel,y=Math.round(c.dot(this.shadowUp)/texel)*texel,z=c.dot(this.keyDir);
    c.copy(this.shadowRight).multiplyScalar(x).addScaledVector(this.shadowUp,y).addScaledVector(this.keyDir,z);
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.keyDir,70);
  }
  private blurLevel=0;private blurHold=0;private readonly blurPoint=new THREE.Vector3();private blurKeep:BlurKeep[]=[];
  private readonly blurCentre=new THREE.Vector3();private readonly blurEdge=new THREE.Vector3();private readonly blurRight=new THREE.Vector3();
  private punchLevel=0;private speedLevel=0;private speedFeed=0;private cinemaFeed=0;
  private chromaPx=0;private chromaFrames=0;
  private impactFrames=0;private impactHold=0;private impactMix=0;private lastImpact=-10;private impactSeed=0;
  private techLevel=0;private techStrength=0;private techLeft=0;
  private techLocal=0;private techLocalTarget=0;private techReach=4;private readonly techFocus=new THREE.Vector3();
  private readonly techColor=new THREE.Color(1,1,1);private readonly techTarget=new THREE.Color(1,1,1);
  private stopLevel=0;private stopFeed=0;private stopAt=-10;private probeStop=0;
  private readonly actionPoint=new THREE.Vector3();
  private actionPointSet=false;
  punch(amount:number){
    if(this.reducedMotion)return;
    const now=performance.now();
    if(now-this.lastPunch<75)return;
    this.lastPunch=now;
    this.punchLevel=Math.min(.55,Math.max(this.punchLevel,amount));
  }
  impactFrame(strength:number,at?:THREE.Vector3,hold=0){
    if(this.reducedMotion||!(strength>0))return;
    if(this.time-this.lastImpact<.4)return;
    this.lastImpact=this.time;
    const s=Math.min(1,strength);
    this.impactFrames=s>.5?2:1;this.impactMix=.9+.1*s;this.impactHold=Math.max(this.impactHold,hold);
    this.impactSeed=Math.floor(Math.random()*1000);
    if(at){this.actionPoint.copy(at);this.actionPointSet=true;}else this.actionPointSet=false;
  }
  extendImpact(hold:number){
    const since=this.time-this.lastImpact;
    if(!(hold>0)||since>.15||this.reducedMotion)return;
    this.impactHold=Math.max(this.impactHold,hold-since);
  }
  chromaticPulse(amount:number){
    if(this.reducedMotion||!(amount>=.9))return;
    this.chromaPx=2*Math.min(1,amount);this.chromaFrames=Math.max(this.chromaFrames,amount>=1?2:1);
  }
  cinemaGrade(amount:number){this.cinemaFeed=Math.max(this.cinemaFeed,THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1));}
  speedLines(amount:number){if(this.reducedMotion)return;this.speedFeed=Math.max(this.speedFeed,Math.min(1,amount));}
  techniqueGrade(color:number,strength:number,seconds:number,at?:{x:number;y:number;z:number},reach=4){
    if(!(strength>0)||!(seconds>0))return;
    const s=Math.min(1,strength);
    if(s>=this.techStrength*.8||this.techLevel<.05){
      if(at&&(this.techLocalTarget>0||this.techLevel<.05)){this.techLocalTarget=1;this.techFocus.set(at.x,at.y+1.1,at.z);this.techReach=reach;}
      else if(!at)this.techLocalTarget=0;
      this.techTarget.setHex(color);
      const t=this.techTarget,l=.2126*t.r+.7152*t.g+.0722*t.b;
      t.multiplyScalar(1/Math.max(l,Math.max(t.r,t.g,t.b)/3,1e-4));
      if(this.techLevel<.05)this.techColor.copy(t);
      this.techStrength=s;
    }
    this.techLeft=Math.max(this.techLeft,seconds);
  }
  impactBlur(strength:number,at:{x:number;y:number;z:number},keep:BlurKeep[]=[]){
    if(this.reducedMotion||!(strength>0))return;
    this.blurLevel=Math.max(this.blurLevel,Math.min(1,strength)*(DREAM_IMPACT?.5:1));this.blurHold=.05;
    this.blurPoint.set(at.x,at.y,at.z);this.blurKeep=keep.slice(0,2);
  }
  timeStop(amount:number){this.stopFeed=THREE.MathUtils.clamp(amount,0,1);this.stopAt=this.time;}
  powerDim(amount:number){
    if(this.dimAt!==this.time){this.dimFeed=0;this.dimAt=this.time;}
    this.dimFeed=Math.max(this.dimFeed,THREE.MathUtils.clamp(amount,0,1));
  }
  private dimFeed=0;private dimAt=-1;private dimLevel=0;private dimShown=0;
  private readonly fogBase=new THREE.Color();private readonly fogNight=new THREE.Color(0x05081a);
  private placeTechFocus(u:typeof this.finalPass.uniforms){
    u.uTechLocal.value=0;
    if(this.techLocal<.002)return;
    this.projected.copy(this.techFocus).applyMatrix4(this.camera.matrixWorldInverse);
    const depth=-this.projected.z;
    if(depth<.3)return;
    this.projected.copy(this.techFocus).project(this.camera);
    u.uTechLocal.value=this.techLocal;
    u.uTechFocus.value.set(this.projected.x*.5+.5,this.projected.y*.5+.5);
    u.uTechRadius.value=THREE.MathUtils.clamp(this.techReach/(depth*2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)),.1,.32);
  }
  private lastPunch=0;
  private reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly projected=new THREE.Vector3();
  private updatePost(dt:number){
    const u=this.finalPass.uniforms,f=frameUniforms;
    u.uTime.value=this.time;
    u.uSeed.value=Math.floor(this.time*20)%997;
    u.uPunch.value=this.punchLevel;u.uChroma.value=this.chromaFrames>0?this.chromaPx:0;
    u.uCinema.value=this.cinemaFeed>.002?this.cinemaFeed:0;this.cinemaFeed=0;
    this.speedLevel=Math.max(this.speedLevel*Math.exp(-dt*(DREAM_IMPACT?13:7)),this.speedFeed);this.speedFeed=0;
    u.uSpeed.value=this.speedLevel>.01?this.speedLevel:0;
    const step=Math.min(dt,.1),holding=this.techLeft>0;
    this.techLeft=Math.max(0,this.techLeft-step);
    const techTarget=holding?this.techStrength:0;
    this.techLevel+=(techTarget-this.techLevel)*(1-Math.exp(-step*(techTarget>this.techLevel?18:5)));
    if(!holding&&this.techLevel<.004){this.techLevel=0;this.techStrength=0;}
    this.techColor.lerp(this.techTarget,1-Math.exp(-step*10));
    this.techLocal+=(this.techLocalTarget-this.techLocal)*(1-Math.exp(-step*12));
    if(this.techLevel===0){this.techLocal=this.techLocalTarget=0;}
    if(this.probeStop>0)this.timeStop(this.probeStop);
    const stopTarget=this.time-this.stopAt<.3?this.stopFeed:0;
    this.stopLevel+=(stopTarget-this.stopLevel)*(1-Math.exp(-step*25));
    if(stopTarget===0&&this.stopLevel<.004)this.stopLevel=0;
    const impact=this.impactFrames>0||this.impactHold>0;
    u.uTech.value=this.techLevel;u.uTechColor.value.copy(this.techColor);
    this.placeTechFocus(u);
    u.uStop.value=impact?0:this.stopLevel;
    const fighterTech=this.techLevel*(1-.7*this.techLocal);
    f.uLookTech.value=fighterTech;f.uLookTechColor.value.copy(this.techColor);
    setCloudTime(this.time);
    liftFightersUnderGrade(fighterTech,this.techColor);
    const dimTarget=this.time-this.dimAt<.25?this.dimFeed:0;
    this.dimLevel+=(dimTarget-this.dimLevel)*(1-Math.exp(-step*(dimTarget>this.dimLevel?9:2.4)));
    if(dimTarget===0&&this.dimLevel<.003)this.dimLevel=0;
    if(this.dimLevel>0||this.dimShown>0){
      setRoomDim(this.dimLevel);this.sky.dim(this.dimLevel);
      (this.scene.fog as THREE.Fog).color.copy(this.fogBase).lerp(this.fogNight,.75*this.dimLevel);
      this.dimShown=this.dimLevel;
    }
    windowGlow.uPaneGlow.value.copy(this.paneGlow).multiplyScalar((1-.65*this.techLevel)*(1-.8*this.dimLevel));
    f.uLookSilhouette.value=impact?1:this.stopLevel;f.uLookSilhouetteRim.value=impact?0:1;
    const center=u.uCenter.value;
    if(this.focusAt>=0){this.projected.copy(this.focus).setY(this.focus.y+1.2).project(this.camera);
      if(this.projected.z<1)center.set(THREE.MathUtils.clamp(this.projected.x*.5+.5,.3,.7),THREE.MathUtils.clamp(this.projected.y*.5+.5,.3,.7));else center.set(.5,.5);
    }else center.set(.5,.5);
    if(impact){
      if(this.actionPointSet){this.projected.copy(this.actionPoint).project(this.camera);u.uImpactCenter.value.set(this.projected.x*.5+.5,this.projected.y*.5+.5);}
      else u.uImpactCenter.value.copy(center);
      u.uImpact.value=this.impactMix;
      u.uSeed.value=this.impactSeed;
    }else u.uImpact.value=0;
    u.uBlur.value=impact?0:this.blurLevel;
    if(u.uBlur.value>0){
      this.projected.copy(this.blurPoint).project(this.camera);
      u.uBlurCenter.value.set(this.projected.x*.5+.5,this.projected.y*.5+.5);
      const aspect=u.uResolution.value.y/Math.max(1,u.uResolution.value.x);
      this.blurRight.setFromMatrixColumn(this.camera.matrixWorld,0);
      for(let i=0;i<2;i++){
        const k=u.uBlurKeep.value[i],body=this.blurKeep[i];k.set(0,0,0,0);
        if(!body)continue;
        const size=body.state?.size??1,centre=body.visualCenter(this.blurCentre);
        this.blurEdge.copy(centre).addScaledVector(this.camera.up,1.4*size).project(this.camera);
        this.projected.copy(centre).project(this.camera);
        if(this.projected.z>1||this.blurEdge.z>1)continue;
        const ry=Math.max(.04,Math.abs(this.blurEdge.y-this.projected.y)*.5);
        k.set(this.projected.x*.5+.5,this.projected.y*.5+.5,ry*.78*aspect,ry);
      }
    }
  }
  private decayPost(dt:number){
    this.punchLevel*=Math.exp(-dt*9);if(this.punchLevel<.003)this.punchLevel=0;
    this.chromaFrames=Math.max(0,this.chromaFrames-1);
    this.impactFrames=Math.max(0,this.impactFrames-1);this.impactHold=Math.max(0,this.impactHold-dt);
    if(this.blurHold>0)this.blurHold-=dt;else{this.blurLevel*=Math.exp(-dt*26);if(this.blurLevel<.01){this.blurLevel=0;this.blurKeep=[];}}
  }
  render(dt:number){
    if(this.budgetStrong!==this.governor.relaxed)this.applySettings(this.settings);
    if(this.pendingRatio){const ratio=this.pendingRatio;this.pendingRatio=0;this.renderer.setPixelRatio(ratio);this.composer.setPixelRatio(ratio);this.resize();}
    this.frameTimes.push(dt*1000);if(this.frameTimes.length>600)this.frameTimes.shift();
    this.time+=Math.min(dt,.1);
    this.updateShadow();
    this.sky.update(this.time,Math.min(dt,.1));
    this.atmosphere.update(this.time,this.camera);
    this.life.update(this.time,Math.min(dt,.1),this.camera,this.dimLevel,this.focus);
    this.updatePost(dt);
    this.renderer.info.reset();
    const timing=this.gpuTimer?.begin();
    if(!timing)this.governor.begin();
    this.emptyInstances.hold();
    try{if(this.probePose)this.renderProbe(dt);else this.composer.render(dt);}
    finally{this.emptyInstances.release();}
    if(timing)this.gpuTimer!.end();else this.governor.end();
    this.decayPost(Math.min(dt,.1));
    if(this.governor.update(performance.now(),this.holdResolution))this.pendingRatio=this.pixelCap*this.governor.scale;
  }
  private pendingRatio=0;
  private gpuTimer?:{begin:()=>boolean;end:()=>void;samples:number[]};
  private startGpuTimer(frames:number){
    const gl=this.renderer.getContext() as WebGL2RenderingContext,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if(!ext)return false;
    const pending:WebGLQuery[]=[],samples:number[]=[];
    this.gpuTimer={samples,begin:()=>{
      for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;if(!gl.getParameter(ext.GPU_DISJOINT_EXT))samples.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);}
      if(samples.length+pending.length>=frames)return false;
      const q=gl.createQuery()!;gl.beginQuery(ext.TIME_ELAPSED_EXT,q);pending.push(q);return true;
    },end:()=>gl.endQuery(ext.TIME_ELAPSED_EXT)};
    return true;
  }
  perf(){const n=this.frameTimes.length;if(this.perfTimes.length<n)this.perfTimes=new Float64Array(n);const frames=this.perfTimes.subarray(0,n);for(let i=0;i<n;i++)frames[i]=this.frameTimes[i];frames.sort();let sum=0;for(let i=0;i<n;i++)sum+=frames[i];const avg=sum/Math.max(1,n);return {fps:1000/avg,p95:frames[Math.floor(n*.95)]??0,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,samples:n,resolution:this.governor.scale,pixelRatio:this.renderer.getPixelRatio()};}
  private perfTimes=new Float64Array(600);
  private probePose?:{position:THREE.Vector3;target:THREE.Vector3};
  private readonly savedPosition=new THREE.Vector3();private readonly savedQuaternion=new THREE.Quaternion();
  private renderProbe(dt:number){
    const pose=this.probePose!;
    this.savedPosition.copy(this.camera.position);this.savedQuaternion.copy(this.camera.quaternion);
    this.camera.position.copy(pose.position);this.camera.lookAt(pose.target);this.camera.updateMatrixWorld();
    this.composer.render(dt);
    this.camera.position.copy(this.savedPosition);this.camera.quaternion.copy(this.savedQuaternion);this.camera.updateMatrixWorld();
  }
  private installProbe(){
    Object.defineProperty(window,'__look',{configurable:true,value:{
      view:(position:number[],target:number[])=>{this.probePose={position:new THREE.Vector3(...position),target:new THREE.Vector3(...target)};},
      release:()=>{this.probePose=undefined;},
      finish:(on:boolean)=>{setAnimeFinish(on);this.applyLook(lookFor(this.stage),STAGES[this.stage]);return animeFinishOn();},
      quality:(quality:Settings['quality'])=>{this.applySettings({...this.settings,quality});return quality;},
      impact:(s:number,hold=0)=>{this.lastImpact=-10;this.impactFrame(s);this.impactHold=hold;},
      blur:(s:number)=>this.impactBlur(s,this.focus),
      speed:(s:number)=>this.speedLines(s),chroma:(s:number)=>this.chromaticPulse(s),punch:(s:number)=>{this.lastPunch=0;this.punch(s);},
      technique:(color:number,strength:number,seconds:number)=>this.techniqueGrade(color,strength,seconds),
      stop:(amount:number)=>{this.probeStop=amount;if(!(amount>0))this.timeStop(0);},
      gpu:(frames=120)=>this.startGpuTimer(frames),
      tune:(o:{samples?:number;pixelRatio?:number;bloom?:boolean;half?:boolean;sky?:boolean;air?:boolean;life?:boolean;shadows?:boolean})=>{
        if(o.samples!==undefined)for(const t of [this.composer.renderTarget1,this.composer.renderTarget2]){t.samples=o.samples;t.dispose();}
        if(o.pixelRatio!==undefined){this.renderer.setPixelRatio(o.pixelRatio);this.composer.setPixelRatio(o.pixelRatio);this.resize();}
        if(o.bloom!==undefined)this.bloomPass.enabled=o.bloom;
        if(o.half!==undefined)for(const t of [this.composer.renderTarget1,this.composer.renderTarget2]){t.texture.type=o.half?THREE.HalfFloatType:THREE.UnsignedInt101111Type;t.texture.format=o.half?THREE.RGBAFormat:THREE.RGBFormat;t.dispose();}
        if(o.sky!==undefined)this.sky.mesh.visible=o.sky;
        if(o.air!==undefined)this.atmosphere.group.visible=o.air;
        if(o.life!==undefined)this.life.enabled=o.life;
        if(o.shadows!==undefined)this.sun.castShadow=o.shadows;
      },
      bench:(frames=30)=>{
        const gl=this.renderer.getContext(),times:number[]=[];
        for(let i=0;i<frames;i++){const t0=performance.now();this.composer.render(1/60);gl.finish();times.push(performance.now()-t0);}
        times.sort((a,b)=>a-b);return {median:times[times.length>>1],p10:times[Math.floor(times.length*.1)],p90:times[Math.floor(times.length*.9)]};
      },
      gpuResult:()=>{const s=(this.gpuTimer?.samples??[]).slice().sort((a,b)=>a-b);return s.length?{frames:s.length,mean:s.reduce((a,b)=>a+b,0)/s.length,median:s[s.length>>1],p95:s[Math.floor(s.length*.95)]}:null;},
      state:()=>({stage:this.stage,samples:this.composer.renderTarget2.samples,bloom:this.bloomPass.enabled,shadow:this.sun.shadow.camera.right,environment:!!this.scene.environment}),
      post:()=>{const u=this.finalPass.uniforms;return {impact:u.uImpact.value,chroma:u.uChroma.value,punch:u.uPunch.value,cinema:u.uCinema.value,tech:u.uTech.value,stop:u.uStop.value,silhouette:frameUniforms.uLookSilhouette.value};},
    }});
  }
}
