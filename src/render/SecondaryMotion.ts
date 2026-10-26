import * as THREE from 'three';
import type { FighterId } from '../game/types';
import { LegCapsules, type GarmentCollide } from './look/garmentCollide';
import { HemDrape } from './look/hemDrape';


export interface SpringProfile {
  stiffness:number;
  drag:number;
  gravity:number;
  maxAngle:number;
  tipLoose?:number;
  spread?:number;
  authored?:number;
  soft?:number;
  trail?:number;
  flutter?:number;
  chains?:{match:RegExp;profile:Partial<Omit<SpringProfile,'chains'>>}[];
  legs?:GarmentCollide;
  hang?:number;
  droop?:number;
  off?:boolean;
  bones?:RegExp;
}
const SOFT=.6;
const FLUTTER_SPEED=7.5,FLUTTER_HZ=2.6;

const DEFAULT_PROFILE:SpringProfile={stiffness:16,drag:.86,gravity:3,maxAngle:34};

export const SPRING_PROFILES:Partial<Record<FighterId|'mugetsu',Partial<SpringProfile>>>={
  crocodile:{authored:1,chains:[{match:/.*/,profile:{off:true}}]},
  sakura:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  meliodas:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  escanor:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  tatsumaki:{stiffness:34,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03},
  makima:{stiffness:34,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03},
  kenpachi:{stiffness:32,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03},
  minato:{stiffness:34,drag:.7,gravity:1.4,maxAngle:7,tipLoose:.4,spread:.12,authored:.94,trail:.02,flutter:.03,bones:/^(Left|Right)Coat(Back|Front|Side)[12]$/,chains:[
    {match:/Coat(Back|Front|Side)[12]$/,profile:{stiffness:28,drag:.62,gravity:2.4,maxAngle:14,tipLoose:.7,spread:.2,hang:.35,trail:.05,flutter:.14,legs:{thigh:.13,shin:.11,floor:.015},droop:80}},
  ]},
  broly:{stiffness:30,drag:.7,gravity:1.6,maxAngle:8,tipLoose:.5,spread:.1,trail:.02,flutter:.02,bones:/^Pelt_\d+_\d+$/,chains:[
    {match:/^Pelt_/,profile:{stiffness:24,drag:.6,gravity:2.6,maxAngle:14,tipLoose:.6,spread:.35,hang:.8,trail:.03,flutter:.06,legs:{thigh:.2,shin:.14,floor:.02},droop:34}},
  ]},
  deku:{stiffness:30,drag:.7,gravity:1.6,maxAngle:8,tipLoose:.5,spread:.1,trail:.02,flutter:.02,bones:/^Cape_\d_\d$/,chains:[
    {match:/^Cape_/,profile:{stiffness:24,drag:.6,gravity:2.6,maxAngle:16,tipLoose:.6,spread:.2,hang:.8,trail:.05,flutter:.1,legs:{thigh:.13,shin:.11,floor:.015},droop:35}},
  ]},
  'nico-robin':{stiffness:40,drag:.9,gravity:0,maxAngle:.015,tipLoose:0,spread:0,authored:.99,trail:0,flutter:0},
  'kaiju-no-8':{stiffness:45,drag:.88,gravity:0,maxAngle:.02,tipLoose:0,spread:0,authored:.99,trail:0,flutter:0},
  eren:{stiffness:42,drag:.86,gravity:.02,maxAngle:.03,tipLoose:.01,spread:0,authored:.98,trail:0,flutter:0},
  asuka:{stiffness:48,drag:.86,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  netero:{stiffness:38,drag:.83,gravity:.04,maxAngle:.04,tipLoose:.02,spread:.01,authored:.95,trail:.01,flutter:0},
  shinji:{stiffness:48,drag:.86,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  jolyne:{stiffness:48,drag:.86,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  'might-guy':{stiffness:48,drag:.86,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  akame:{stiffness:30,drag:.8,gravity:1.5,maxAngle:14,tipLoose:.5,spread:.12,authored:0,trail:.02,flutter:.02,bones:/^head0(0[4-9]|[1-7]\d)$/},
  pikachu:{stiffness:60,drag:1,gravity:0,maxAngle:0,tipLoose:0,spread:0,authored:1,trail:0,flutter:0},
  garou:{stiffness:42,drag:.82,gravity:1,maxAngle:4,tipLoose:.18,spread:.04,authored:.98,trail:.01,flutter:0},
  esdeath:{stiffness:30,drag:.8,gravity:1.5,maxAngle:14,tipLoose:.5,spread:.12,authored:0,trail:.02,flutter:.02,bones:/^(head00\d_|Strand_\d_\d$)/,chains:[
    {match:/^head00[357]_1\d$/,profile:{stiffness:32,maxAngle:12,hang:.6,droop:40}},
    {match:/^head007_[LR]/,profile:{off:true}},
    {match:/^Strand_/,profile:{stiffness:22,drag:.66,gravity:2.2,maxAngle:22,tipLoose:.75,spread:.35,hang:.6,trail:.04,flutter:.1,droop:40}},
  ]},
  mikasa:{stiffness:42,drag:.78,gravity:1.2,maxAngle:6,tipLoose:.30,spread:.08,authored:.95,trail:.02,flutter:.01},
  'alphonse-elric':{stiffness:42,drag:.78,gravity:1.2,maxAngle:8,tipLoose:.30,spread:.08,authored:.9,trail:.02,flutter:.01},
  'ken-kaneki':{stiffness:38,drag:.76,gravity:.8,maxAngle:5,tipLoose:.30,spread:.08,authored:.98,trail:.02,flutter:.01},
  grimmjow:{stiffness:35,drag:.74,gravity:1.1,maxAngle:7,tipLoose:.36,spread:.1,authored:.95,trail:.03,flutter:.02},
  byakuya:{stiffness:38,drag:.72,gravity:1.2,maxAngle:6,tipLoose:.35,spread:.1,authored:.95,trail:.02,flutter:.02},
  rengoku:{stiffness:44,drag:.84,gravity:.8,maxAngle:3,tipLoose:.12,spread:.03,authored:1,trail:.01,flutter:0},
  yamamoto:{stiffness:38,drag:.72,gravity:1.2,maxAngle:6,tipLoose:.35,spread:.1,authored:.95,trail:.02,flutter:.02},
  pain:{stiffness:38,drag:.72,gravity:1.2,maxAngle:6,tipLoose:.35,spread:.1,authored:.95,trail:.02,flutter:.02},
  'edward-elric':{stiffness:38,drag:.72,gravity:1.2,maxAngle:6,tipLoose:.35,spread:.1,authored:.95,trail:.02,flutter:.02},
  hiei:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  aokiji:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  doflamingo:{stiffness:32,drag:.65,gravity:2.4,maxAngle:10,tipLoose:.6,spread:.22,authored:.82,trail:.04,flutter:.07},
  blackbeard:{stiffness:32,drag:.65,gravity:2.4,maxAngle:12,tipLoose:.6,spread:.25,authored:.8,trail:.05,flutter:.08},
  jiraiya:{stiffness:44,drag:.48,gravity:1.8,maxAngle:12,chains:[{match:/^Hemline_/,profile:{off:true}}]},
  ichigo:{stiffness:42,drag:.8,gravity:3,maxAngle:32,chains:[
    {match:/^Detail_CLOTH_Bone/,profile:{off:true}},
    {match:/Dangai_Coat/,profile:{stiffness:22,drag:.72,gravity:2.8,maxAngle:12,tipLoose:1.25,spread:.2,hang:.75,legs:{thigh:.12,shin:.15,floor:.015},droop:62}},
    {match:/Dangai_Hair/,profile:{stiffness:44,drag:.42,gravity:1.6,maxAngle:9,tipLoose:.8,spread:.2,hang:.35,droop:105}},
    {match:/Dangai_Sash/,profile:{stiffness:26,drag:.66,gravity:2.6,maxAngle:28,tipLoose:.7,spread:.25}},
  ]},
  mugetsu:{stiffness:38,drag:.81,gravity:3.2,maxAngle:32},
  sanji:{stiffness:20,drag:.4,gravity:2.6,maxAngle:28,trail:.1},
  naruto:{stiffness:11,drag:.55,gravity:6,maxAngle:80,trail:.16,tipLoose:.7,spread:.15,droop:95,flutter:.3,chains:[
    {match:/^hair_|^acce\d|_sleeve$|^Detail_CLOTH_ponytail01$/,profile:{off:true}},
    {match:/_wear$/,profile:{stiffness:28,drag:.6,gravity:2,maxAngle:10,trail:.06,flutter:.1,droop:180}},
  ]},
  kakashi:{stiffness:40,drag:.4,gravity:1.5,maxAngle:8,trail:.04},
  jotaro:{stiffness:40,drag:.85,gravity:3,maxAngle:22,trail:.3},
  dio:{stiffness:40,drag:.65,gravity:2,maxAngle:12,trail:.02},
  law:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  mihawk:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  akainu:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  kizaru:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  yamato:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  jinbe:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.3,bones:/^([clr]_(coat|arm)|[lr]i_coat)0\d_\d+$/,chains:[
    {match:/^(coat_root|[lr]_coat_kata|([clr]|[lr]i)_coat_end)_/,profile:{off:true}},
    {match:/^([clr]_(coat|arm)|[lr]i_coat)01_/,profile:{stiffness:24,drag:.58,gravity:2.6,maxAngle:20,tipLoose:.6,spread:.5,authored:.5,hang:.4,trail:.09,flutter:.3,legs:{thigh:.2,shin:.12,floor:.02}}},
    {match:/^([clr]_(coat|arm)|[lr]i_coat)02_/,profile:{stiffness:24,drag:.58,gravity:2.6,maxAngle:20,tipLoose:.6,spread:.5,authored:.5,trail:.09,flutter:.3}},
  ]},
  'boa-hancock':{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  nami:{stiffness:32,drag:.65,gravity:2.4,maxAngle:14,tipLoose:.6,spread:.25,authored:.5,trail:.05,flutter:.12},
  gojo:{stiffness:40,drag:.4,gravity:1.6,maxAngle:11,trail:.03},
  guts:{stiffness:12,drag:.4,gravity:2.6,maxAngle:18,tipLoose:.6,spread:.25,authored:.5,trail:.06,flutter:.15},
  meruem:{stiffness:12,drag:.65,gravity:1,maxAngle:12,tipLoose:.6,trail:.2},
  kaido:{stiffness:28,drag:.58,gravity:2.4,maxAngle:18,tipLoose:.6,spread:.25,authored:.7,bones:/^[clr]_coat0\d_\d+$/,chains:[
    {match:/^(coat_root|[lr]_coat_kata)_/,profile:{off:true}},
    {match:/^[clr]_coat0\d_/,profile:{stiffness:22,drag:.55,gravity:2.8,maxAngle:18,tipLoose:.6,spread:.25,authored:.5,hang:.5,trail:.07,flutter:.12,legs:{thigh:.3,shin:.13,floor:.02}}},
  ]},
  aizen:{stiffness:28,drag:.58,gravity:2.4,maxAngle:18,tipLoose:.6,spread:.25,authored:.7},
  whitebeard:{stiffness:24,drag:.4,gravity:2.4,maxAngle:18,tipLoose:.6,spread:.25,authored:.7,trail:.12},
  tanjiro:{stiffness:20,drag:.55,gravity:2.6,maxAngle:20,tipLoose:.65,spread:.25,trail:.07,flutter:.14,bones:/^Bone_(Skirt|Hair)\d+_\d+$/,chains:[
    {match:/^Bone_Skirt(19|2[0-2])_/,profile:{off:true}},
    {match:/^Bone_Skirt/,profile:{maxAngle:30,trail:.12,hang:.3,legs:{thigh:.11,shin:.09,floor:.015}}},
    {match:/^Bone_Hair/,profile:{stiffness:40,drag:.4,gravity:1.6,maxAngle:12,tipLoose:.8,spread:.15,trail:.03,flutter:.05}},
  ]},
  shanks:{stiffness:28,drag:.6,gravity:2.6,maxAngle:16,tipLoose:.6,spread:.25,authored:.45,hang:.5,trail:.06,flutter:.14,bones:/^[CFLR]_Cort0\d_\d+$/,legs:{thigh:.12,shin:.1,floor:.015}},
  roger:{stiffness:55,drag:.4,gravity:2.4,maxAngle:18,tipLoose:.6,spread:.25,authored:.35,trail:.02,flutter:.15},
  levi:{stiffness:55,drag:.4,gravity:2.6,maxAngle:18,tipLoose:.6,spread:.25,authored:.25,trail:.02,flutter:.2},
  saitama:{stiffness:40,drag:.4,gravity:3,maxAngle:10,authored:.5,trail:.06,flutter:.2},
  zoro:{stiffness:12,drag:.4,gravity:3,maxAngle:24,trail:.09,flutter:.12},
  luffy:{stiffness:24,drag:.4,gravity:3,maxAngle:24,trail:.12},
  'goku-black':{stiffness:40,drag:.4,gravity:3,maxAngle:8,trail:.02},
  griffith:{chains:[
    {match:/^Detail_CLOTH_griffith_hem_[0-5]_\d$/,profile:{off:true}},
    {match:/^Detail_CLOTH_griffith(-femto)?_hem_/,profile:{legs:{thigh:.1,shin:.085,floor:.015,foot:.12}}},
    {match:/^Detail_CLOTH_griffith_hair_/,profile:{stiffness:26,drag:.5,gravity:2.2,maxAngle:16,tipLoose:.75,spread:.2,trail:.08,flutter:.12,droop:80}},
    {match:/^Detail_CLOTH_griffith_lock/,profile:{stiffness:30,drag:.5,gravity:2.2,maxAngle:20,tipLoose:.7,spread:.15,trail:.06,flutter:.1,droop:80}},
  ]},
};

const DYNAMIC=/^detail_(cloth|bone)|(^|_)(hem|wear|sleeve|skirt|coat|cape|scarf|ribbon|tassel|cloth|hair)(_|$)|^acce|_suso_|_tie_/i;
const EXCLUDED=/equipment|cigarette|prop|weapon|katana|sword|zangetsu|kunai/i;

export function isDynamicBoneName(name:string){
  return DYNAMIC.test(name)&&!EXCLUDED.test(name);
}

const MIN_ARM=.02;
const COLLIDE_MOST=Math.cos(THREE.MathUtils.degToRad(100));

interface SpringNode {
  bone:THREE.Bone;
  parent:THREE.Object3D;
  axis:THREE.Vector3;
  length:number;
  authored:THREE.Quaternion;
  written:THREE.Quaternion;
  clip:THREE.Quaternion;
  tail:THREE.Vector3;
  previous:THREE.Vector3;
  stiff:number;
  rest:THREE.Quaternion;
  goal:THREE.Vector3;
  own:SpringProfile;
  hang:number;
  hangAxis:THREE.Vector3;
}

const _head=new THREE.Vector3();
const _scratch=new THREE.Vector3();
const _scale=new THREE.Vector3();
const _rest=new THREE.Vector3();
const _authored=new THREE.Vector3();
const _rootQ=new THREE.Quaternion();
const _target=new THREE.Vector3();
const _next=new THREE.Vector3();
const _delta=new THREE.Vector3();
const _direction=new THREE.Vector3();
const _side=new THREE.Vector3();
const _world=new THREE.Quaternion();
const _parent=new THREE.Quaternion();
const _inverse=new THREE.Quaternion();
const _swing=new THREE.Quaternion();
const _local=new THREE.Quaternion();
const DOWN=new THREE.Vector3(0,-1,0);
const _auraAxis=new THREE.Vector3(),_auraTurn=new THREE.Quaternion(),_auraRest=new THREE.Vector3();
const UP=new THREE.Vector3(0,1,0);
const AURA_LIFT=.55,AURA_FLUTTER=.3,AURA_RATES:[number,number]=[1.1,2.9];

export class SecondaryMotion {
  private nodes:SpringNode[]=[];
  private profile:SpringProfile;
  private root:THREE.Object3D;
  private anchor=new THREE.Vector3();
  private settled=false;
  private swing=0;
  private shortest=Infinity;
  private auraStrength=0;
  private auraClock=0;
  private speed=0;
  private heading=new THREE.Vector3(0,0,1);
  private flutterClock=0;
  private drape?:HemDrape;

  constructor(root:THREE.Object3D,fighter:FighterId|'mugetsu'){
    this.root=root;
    this.profile={...DEFAULT_PROFILE,...SPRING_PROFILES[fighter]};
    this.drape=HemDrape.find(root);
    if(this.drape)this.profile={...this.profile,...this.drape.spec.profile};
    const bones:THREE.Bone[]=[];
    const own=this.profile.bones;
    root.traverse(o=>{if((o as THREE.Bone).isBone&&(isDynamicBoneName(o.name)||!!own?.test(o.name)&&!EXCLUDED.test(o.name)))bones.push(o as THREE.Bone);});
    bones.sort((a,b)=>depth(a)-depth(b));
    root.updateMatrixWorld(true);
    const head=new THREE.Vector3(),tail=new THREE.Vector3(),rotation=new THREE.Quaternion();
    for(const bone of bones){
      const parent=bone.parent;
      if(!parent)continue;
      const child=bone.children.find(c=>(c as THREE.Bone).isBone);
      bone.getWorldPosition(head);
      if(child)child.getWorldPosition(tail);
      else{
        parent.getWorldPosition(tail);
        tail.sub(head).multiplyScalar(-.6).add(head);
      }
      const length=head.distanceTo(tail);
      if(!(length>=MIN_ARM))continue;
      bone.getWorldQuaternion(rotation);
      const hangAxis=tail.clone().sub(head).divideScalar(length).applyQuaternion(root.getWorldQuaternion(_rootQ).invert());
      const chain=this.profile.chains?.find(c=>c.match.test(bone.name));
      if(chain?.profile.off)continue;
      const axis=(this.profile.chains?tail.clone():tail).sub(head).divideScalar(length).applyQuaternion(rotation.invert());
      this.nodes.push({bone,parent,axis,length,authored:bone.quaternion.clone(),clip:bone.quaternion.clone(),
        written:new THREE.Quaternion(NaN,NaN,NaN,NaN),tail:new THREE.Vector3(),previous:new THREE.Vector3(),stiff:1,rest:bone.quaternion.clone(),goal:new THREE.Vector3(),
        own:chain?{...this.profile,...chain.profile}:this.profile,hang:0,hangAxis});
      this.shortest=Math.min(this.shortest,length);
    }
    if(this.nodes.some(node=>(node.own.tipLoose??1)!==1||(node.own.spread??0)!==0)){
      const sprung=new Set(this.nodes.map(node=>node.bone));
      const rootOf=(bone:THREE.Object3D)=>{let top=bone,steps=0;for(let at=bone.parent;at&&sprung.has(at as THREE.Bone);at=at.parent){top=at;steps++;}return {top,steps};};
      const deepest=new Map<THREE.Object3D,number>();
      for(const node of this.nodes){const {top,steps}=rootOf(node.bone);deepest.set(top,Math.max(deepest.get(top)??0,steps));}
      for(const node of this.nodes){
        const {top,steps}=rootOf(node.bone),span=deepest.get(top)??0;
        const grade=span>0?steps/span:0,{tipLoose=1,spread=0}=node.own;
        node.stiff=THREE.MathUtils.lerp(1,tipLoose,grade)*(1+spread*(hash(top.name)*2-1));
      }
    }
    {const sprung=new Set(this.nodes.map(node=>node.bone as THREE.Object3D));for(const node of this.nodes)if(node.own.hang&&!sprung.has(node.parent))node.hang=node.own.hang;}
    if(this.nodes.some(node=>node.own.legs)){
      const spec=this.nodes.find(node=>node.own.legs)!.own.legs!;
      const capsules=new LegCapsules(root,spec);
      if(capsules.ok)this.capsules=capsules;
    }
  }
  private capsules?:LegCapsules;
  private readonly rootQuat=new THREE.Quaternion();

  get boneCount(){return this.nodes.length;}
  get minArm(){return this.shortest;}
  get swingDegrees(){return this.swing;}

  reset(){this.settled=false;}
  unswing(){for(const node of this.nodes)node.bone.quaternion.copy(node.clip);}
  aura(strength:number){this.auraStrength=THREE.MathUtils.clamp(strength,0,1);}
  hang(share:number){if(this.drape)this.drape.hangScale=THREE.MathUtils.clamp(share,0,1);}

  update(dt:number){
    if(!this.nodes.length)return;
    this.drape?.before();
    const kept=this.profile.authored??1;
    for(const node of this.nodes)if(!node.bone.quaternion.equals(node.written)){
      node.clip.copy(node.bone.quaternion);
      if(kept<1)node.authored.copy(node.rest).slerp(node.bone.quaternion,kept);
      else node.authored.copy(node.bone.quaternion);
    }
    this.root.getWorldPosition(_scratch);
    this.root.getWorldQuaternion(this.rootQuat);
    if(this.settled&&_scratch.distanceToSquared(this.anchor)>4)this.settled=false;
    if(this.settled&&dt>0&&this.profile.flutter){
      _delta.subVectors(_scratch,this.anchor).setY(0);
      const moved=_delta.length(),ease=1-Math.exp(-dt*10);
      this.speed+=(moved/dt-this.speed)*ease;
      if(moved>1e-5)this.heading.lerp(_delta.divideScalar(moved),ease).normalize();
    }
    this.anchor.copy(_scratch);
    if(!this.settled){this.place();return;}
    this.capsules?.update();
    const clamped=Math.min(Math.max(dt,0),1/20);
    const steps=clamped>0?Math.max(1,Math.ceil(clamped*45)):1;
    for(let i=0;i<steps;i++)this.solve(clamped/steps);
  }

  private place(){
    for(const node of this.nodes){
      this.resolve(node);
      node.tail.copy(_head).addScaledVector(_rest,node.length);
      node.previous.copy(node.tail);
      node.goal.copy(node.tail);
    }
    this.settled=true;
    this.speed=0;
  }

  private resolve(node:SpringNode){
    const bone=node.bone;
    bone.matrix.compose(bone.position,node.authored,bone.scale);
    bone.matrixWorld.multiplyMatrices(node.parent.matrixWorld,bone.matrix);
    bone.matrixWorld.decompose(_head,_world,_scale);
    _rest.copy(node.axis).applyQuaternion(_world).normalize();
    _authored.copy(_rest);
    if(node.hang>0)_rest.lerp(_scratch.copy(node.hangAxis).applyQuaternion(this.rootQuat),node.hang).normalize();
  }

  private solve(dt:number){
    const base=this.profile;
    let {stiffness,drag,gravity,maxAngle,trail}=base;
    const flutter=base.flutter??0;
    let limit=Math.cos(THREE.MathUtils.degToRad(maxAngle));
    let soft=THREE.MathUtils.clamp(base.soft??SOFT,0,1);
    let air=trail===undefined?0:1-Math.pow(1-THREE.MathUtils.clamp(trail,0,1),dt*60);
    const wave=flutter>0?flutter*Math.min(1.5,this.speed/FLUTTER_SPEED):0;
    if(dt>0&&wave>0)this.flutterClock+=dt*FLUTTER_HZ*(.6+.4*Math.min(2,this.speed/FLUTTER_SPEED));
    let keep=Math.pow(drag,dt*60);
    let pull=stiffness*dt;
    const aura=this.auraStrength;let cone=THREE.MathUtils.degToRad(maxAngle),knee=cone*soft;
    if(dt>0)this.auraClock+=dt;
    let widest=1,index=0,current:SpringProfile=base,droop=base.droop!==undefined?Math.cos(THREE.MathUtils.degToRad(base.droop)):-2;
    for(const node of this.nodes){
      if(node.own!==current){
        current=node.own;({stiffness,drag,gravity,maxAngle,trail}=current);
        limit=Math.cos(THREE.MathUtils.degToRad(maxAngle));keep=Math.pow(drag,dt*60);pull=stiffness*dt;cone=THREE.MathUtils.degToRad(maxAngle);
        soft=THREE.MathUtils.clamp(current.soft??SOFT,0,1);knee=cone*soft;air=trail===undefined?0:1-Math.pow(1-THREE.MathUtils.clamp(trail,0,1),dt*60);
        droop=current.droop!==undefined?Math.cos(THREE.MathUtils.degToRad(current.droop)):-2;
      }
      this.resolve(node);
      if(dt>0){
        _auraRest.copy(_rest);
        if(aura>1e-3){
          const c=this.auraClock*Math.PI*2,phase=index*.9;
          _auraAxis.crossVectors(_rest,UP);
          const across=_auraAxis.length();
          if(across>1e-3)_auraRest.applyQuaternion(_auraTurn.setFromAxisAngle(_auraAxis.divideScalar(across),aura*AURA_LIFT*cone));
          _auraAxis.set(Math.cos(c*AURA_RATES[0]+phase),0,Math.sin(c*AURA_RATES[0]+phase));
          _auraRest.applyQuaternion(_auraTurn.setFromAxisAngle(_auraAxis,aura*AURA_FLUTTER*cone*Math.sin(c*AURA_RATES[1]+phase*1.7)));
        }
        if(wave>1e-4){
          _auraAxis.crossVectors(_auraRest,this.heading);
          const across=_auraAxis.length();
          if(across>1e-3)_auraRest.applyQuaternion(_auraTurn.setFromAxisAngle(_auraAxis.divideScalar(across),wave*cone*Math.sin(this.flutterClock*Math.PI*2-index*.8)));
        }
        _target.copy(_head).addScaledVector(_auraRest,node.length);
        _next.copy(node.tail);
        if(trail===undefined){
          _next.addScaledVector(_delta.subVectors(node.tail,node.previous),keep)
            .addScaledVector(_scratch.subVectors(_target,node.tail),Math.min(1,pull*node.stiff));
        }else{
          _side.subVectors(_target,node.goal);
          _next.addScaledVector(_delta.subVectors(node.tail,node.previous),Math.max(0,keep-air)).addScaledVector(_side,1-keep);
          _next.addScaledVector(_scratch.subVectors(_target,_next),Math.min(1,pull*node.stiff));
        }
        node.goal.copy(_target);
        _next.addScaledVector(DOWN,gravity*dt*dt);

        node.previous.copy(node.tail);
        node.tail.copy(_next);
      }
      _direction.subVectors(node.tail,_head);
      const length=_direction.length();
      if(length>1e-6)_direction.divideScalar(length);else _direction.copy(_rest);
      const alignment=_direction.dot(_rest);
      const held=dt===0&&!!node.own.legs;
      if(!held&&soft<1&&alignment<Math.cos(knee)){
        const angle=Math.acos(THREE.MathUtils.clamp(alignment,-1,1)),room=Math.max(1e-6,cone-knee);
        const eased=knee+room*Math.tanh((angle-knee)/room);
        _side.copy(_direction).addScaledVector(_rest,-alignment);
        const spread=_side.length();
        if(spread>1e-6)_direction.copy(_rest).multiplyScalar(Math.cos(eased)).addScaledVector(_side.divideScalar(spread),Math.sin(eased)).normalize();
        else _direction.copy(_rest);
      }else if(!held&&alignment<limit){
        _side.copy(_direction).addScaledVector(_rest,-alignment);
        const spread=_side.length();
        if(spread>1e-6)_direction.copy(_rest).multiplyScalar(limit)
          .addScaledVector(_side.divideScalar(spread),Math.sqrt(Math.max(0,1-limit*limit))).normalize();
        else _direction.copy(_rest);
      }
      widest=Math.min(widest,_direction.dot(_rest));
      if(dt>0&&-_direction.y<droop){
        _side.set(_direction.x,0,_direction.z);const flat=_side.length();
        if(flat>1e-6)_direction.copy(DOWN).multiplyScalar(droop).addScaledVector(_side.divideScalar(flat),Math.sqrt(1-droop*droop));
      }
      if(dt>0&&this.capsules&&node.own.legs){
        _next.copy(_head).addScaledVector(_direction,node.length);
        _target.copy(_next);
        if(this.capsules.pushLink(_head,_next,node.length)){
          node.previous.add(_scratch.subVectors(_next,_target));
          _next.sub(_head).divideScalar(node.length);
          const along=_next.dot(_rest);
          if(along<COLLIDE_MOST){_side.copy(_next).addScaledVector(_rest,-along);const s=_side.length();if(s>1e-6)_next.copy(_rest).multiplyScalar(COLLIDE_MOST).addScaledVector(_side.divideScalar(s),Math.sqrt(1-COLLIDE_MOST*COLLIDE_MOST));}
          if(_next.lengthSq()>1e-10)_direction.copy(_next).normalize();
        }
      }
      if(!Number.isFinite(_direction.x)||!Number.isFinite(_direction.y)||!Number.isFinite(_direction.z)){
        _direction.copy(_rest);node.previous.copy(_head).addScaledVector(_rest,node.length);
      }
      this.drape?.collide(node.bone,_head,_direction);
      node.tail.copy(_head).addScaledVector(_direction,node.length);
      _swing.setFromUnitVectors(_authored,_direction);
      node.parent.matrixWorld.decompose(_scratch,_parent,_scale);
      _inverse.copy(_parent).invert();
      _local.copy(_inverse).multiply(_swing).multiply(_parent).multiply(node.authored);
      node.bone.quaternion.copy(_local);
      node.written.copy(_local);
      node.bone.updateMatrix();
      node.bone.matrixWorld.multiplyMatrices(node.parent.matrixWorld,node.bone.matrix);
      index++;
    }
    this.swing=THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(widest,-1,1)));
  }
}

function depth(bone:THREE.Object3D){let d=0,o:THREE.Object3D|null=bone;while(o){d++;o=o.parent;}return d;}
function hash(name:string){let h=2166136261;for(let i=0;i<name.length;i++){h^=name.charCodeAt(i);h=Math.imul(h,16777619);}return ((h>>>0)%10007)/10006;}
