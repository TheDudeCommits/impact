import { FinisherCuts } from './FinisherCuts';
import {castThreat} from './ThreatOutline';
import {ENEMIES} from '../survival/enemies';
import * as THREE from 'three';
import {setCameraCutaway,resetCameraCutaway,coverStage} from './CameraCutaway';
import {dampedVector} from './dampedSpring';
import {CameraDirector,bodyBulk,drawnBulk} from './CameraDirector';
import type {StageRoom} from './StageFade';
import {OcclusionFader} from './OcclusionFade';
import {loomTop} from './loomRegistry';
import {BODY_SIZE,LAUNCH_GRAVITY,MOVES,RUSH_STAGES} from '../game/moves';
import {CameraBrain,ShotGate,across,brainInput,playShape,subject,GROUP_BOOM,GROUP_FOV,GROUP_LIFT,PLAY_LENGTH,SIDE_LIFT,type PlayKind,type Subject} from './CameraBrain';
import {CameraFocus} from './CameraFocus';
import {SmartRig,type SmartInput,type SmartThreat} from './SmartCamera';
import type {Fighter} from './Fighter';
import type {CameraMode,CameraStyle} from '../config';
import {closeStyleGoal,closeStyleRig,closeStyleFov,CLOSE_STYLE,CLOSE_RATE,GHOST_FADE} from './closeStyle';
import type {ActionKind,AttackSlot,FighterId} from '../game/types';

const UP=new THREE.Vector3(0,1,0),ZERO=new THREE.Vector3();
const wrapped=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const blend=(rate:number,dt:number)=>1-Math.exp(-rate*dt);
const smooth=THREE.MathUtils.smoothstep;

type Rig={boom:number;lift:number;shoulder:number;focus:number};
const FOX:Readonly<Rig>={boom:8,lift:3.3,shoulder:2.2,focus:1.3},LARGE:Readonly<Rig>={boom:7.5,lift:3,shoulder:1.7,focus:1.7},NORMAL:Readonly<Rig>={boom:4.5,lift:1.65,shoulder:1.15,focus:1.05};
const PETITE:Readonly<Rig>={boom:4.5,lift:1.35,shoulder:1.05,focus:.55};
const LARGE_FORMS:ReadonlySet<FighterId>=new Set<FighterId>(['sasuke','kakashi','itachi','madara','gon']);
const LOCK_BOOM=-1.4,LOCK_LIFT=-1.11,LOCK_FOCUS=-.14,LOCK_SHOULDER=-.1,LOCK_AHEAD=1.6;
const FAR_BOOM=1.6,FAR_LIFT=.8,AIR_BOOM=1.3,AIR_LIFT=.25,AIR_FOCUS=1.05,AIR_NEAR=3,AIR_FAR=7;
const CLOSE_NEAR=1.25,CLOSE_FAR=2.6,CLOSE_BOOM=.7,CLOSE_LIFT=.25,CLOSE_IN=4,CLOSE_OUT=1.5;

const DRAWN_TOP=1.9,DRAWN_BACK=.6,DRAWN_EVERY=.25,BACK_MOST=3.5,DRAWN_RISE=.4,DRAWN_RATE=3,DRAWN_SAMPLES=160,SCALE_MOST=2.4;
const FORM_BOOM=.45,FORM_BACK=.3,FORM_LIFT=1.2,FORM_RISE=1.5,FORM_SIDE=.85,FORM_FOCUS=1,FORM_AHEAD=1.3;
const FOX_LOCK:Readonly<Rig>&{ahead:number}={boom:5.6,lift:.5,shoulder:2.5,focus:1.45,ahead:1.9},FOX_FOE=.3,FOX_RATE=2;
const FOE_ANGLE=.1,MAX_OFFSET=.8,ENGAGE_OFFSET=.2,ENGAGE_RANGE=3,ENGAGE_IN=6,ENGAGE_OUT=1.5;
const SWINGS:ReadonlySet<ActionKind>=new Set<ActionKind>(['light','heavy','special']);
const ASSIST_SPEED=2.6,ASSIST_ACCEL=9,ASSIST_GAIN=3.2,ASSIST_STEP=1/120;
const STRAIN_FROM=.45,STRAIN_TO=1.1,STRAIN_BOOM=1.4,STRAIN_LIFT=.7,STRAIN_IN=4,STRAIN_OUT=1.2;
const YIELD_AFTER=1,YIELD_OVER=.5;
const DEAD_ZONE=.45,FULL_ASSIST=.9;
const SOFT_NEAR=14,SOFT_FAR=22,HARD_NEAR=34,HARD_FAR=44;
const MELEE_COVER_ENTER=.2,MELEE_COVER_EXIT=.1;
const TORSO=.3,COVER_ENTER=.4,COVER_EXIT=.15,DODGE_SETTLE=.75,DODGE_STEP=.06,DODGE_MOST=.72,DODGE_WAIT=.12,DODGE_SPEED=1.6,DODGE_ACCEL=8,DODGE_GAIN=5,NEAR_DEPTH=.4;
const ALPHA_MOST=1.4;
const STAND_NEAR=.25,STAND_FAR=.7,STAND_SIDE=.75,STAND_RADIUS=.36,STAND_HEIGHT=2.15,STAND_HEAVY:Partial<Record<FighterId,boolean>>={jotaro:true,dio:false};
const FRAME_TOP=.62,MY_BOTTOM=.8,FOE_BOTTOM=.88,CARD_TOP=.43,CARD_LEFT=.06,CARD_EASE=.04,CROWN=1.95,TILT_UP=.45,TILT_DOWN=.3,PULL_MAX=4,LAND_HOLD=.35;
const WIDEN_MOST=12,WIDEN_SPEED=90,WIDEN_ACCEL=1500,WIDEN_GAIN=12;
function widenFor(height:number,reach:number,look:number,share:number){
  const above=Math.atan2(height,Math.max(reach,.3))-look;
  return above>0?THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.min(above,1.4))/share)):0;
}
const HEAD_PAD=.24,SOLE_PAD=.06,SPAN_JOINTS=['Head','LeftFoot','RightFoot','LeftToeBase','RightToeBase'] as const;
const MARKER_LIFT=74,MARKER_TOP=62;
const STAND_CROWN=.45,LOOM_BACK=.55,LOOM_LEFT=.6;
const LIE_SPAN=.45;
const LIE_AHEAD=1.3,LIE_MARGIN=.14,LIE_RATE=10;
const SPREAD_FROM=.45,SPREAD_FULL=.8;
const SIDE_SHARE=.9;
const LEAD=.3,RISE_RATE=20,LAUNCH_FALL=23*LAUNCH_GRAVITY;
const TILT_SPEED=1.2,TILT_ACCEL=7.5,TILT_GAIN=6,PULL_SPEED=12,PULL_ACCEL=90,PULL_GAIN=10,LET_GO=.4,SHARED=.95;
type Room=StageRoom;
const roomBox=new THREE.Box3();
export function roomOf(occluders:readonly THREE.Object3D[]):Room|undefined{
  let xLow:THREE.Box3|undefined,xHigh:THREE.Box3|undefined,zLow:THREE.Box3|undefined,zHigh:THREE.Box3|undefined;
  const lx=new THREE.Box3(),hx=new THREE.Box3(),lz=new THREE.Box3(),hz=new THREE.Box3();
  for(const object of occluders){
    const mesh=object as THREE.Mesh;
    if(!mesh.isMesh||(mesh as THREE.InstancedMesh).isInstancedMesh||!(mesh.geometry instanceof THREE.BoxGeometry)||mesh.name==='stage-landmark-occluder')continue;
    mesh.updateWorldMatrix(true,false);roomBox.setFromObject(mesh);
    const sx=roomBox.max.x-roomBox.min.x,sz=roomBox.max.z-roomBox.min.z,cx=(roomBox.max.x+roomBox.min.x)/2,cz=(roomBox.max.z+roomBox.min.z)/2;
    if(sx<=2.5&&sz>=6){
      if(!xLow||cx<(xLow.max.x+xLow.min.x)/2)xLow=lx.copy(roomBox);
      if(!xHigh||cx>(xHigh.max.x+xHigh.min.x)/2)xHigh=hx.copy(roomBox);
    }else if(sz<=2.5&&sx>=6){
      if(!zLow||cz<(zLow.max.z+zLow.min.z)/2)zLow=lz.copy(roomBox);
      if(!zHigh||cz>(zHigh.max.z+zHigh.min.z)/2)zHigh=hz.copy(roomBox);
    }
  }
  if(!xLow||!xHigh||!zLow||!zHigh||xLow===xHigh||zLow===zHigh)return undefined;
  const room={x0:xLow.max.x,x1:xHigh.min.x,z0:zLow.max.z,z1:zHigh.min.z};
  return room.x1-room.x0>2&&room.z1-room.z0>2?room:undefined;
}
type Follower={value:number;velocity:number};
type Capsule={x:number;z:number;low:number;high:number;radius:number;spread:number};
const capsule=():Capsule=>({x:0,z:0,low:0,high:0,radius:0,spread:0});
function approach(state:Follower,goal:number,dt:number,speed:number,accel:number,gain:number,shared?:Float64Array,count=0){
  let k=0;
  for(let left=dt;left>1e-9;left-=ASSIST_STEP,k++){
    const h=Math.min(ASSIST_STEP,left),error=goal-state.value,size=Math.abs(error);
    const wanted=Math.sign(error)*Math.min(speed,Math.sqrt(1.8*accel*size),gain*size);
    const limit=shared&&k<count?Math.min(accel,Math.sqrt(Math.max(0,(SHARED*ASSIST_ACCEL)**2-shared[k]*shared[k]))):accel;
    state.velocity+=THREE.MathUtils.clamp(wanted-state.velocity,-limit*h,limit*h);
    state.value+=state.velocity*h;
  }
  if(Math.abs(goal)<1e-7&&Math.abs(state.value)<1e-5&&Math.abs(state.velocity)<1e-4)state.value=state.velocity=0;
}

const KICK_PEAK=.2,KICK_OUT=55,KICK_BACK=16,KICK_TURN=.28,KICK_ROLL=.14,KICK_MIN_HOLD=.05;
const PUNCH=[0,2.2,3.4] as const,NOISE=.045;
const CALM_FROM=.3,CALM_FULL=.55,CALM_SHARE=.7,CALM_PUNCH=2;
export function hitTier(slot?:AttackSlot,chain?:number):0|1|2{
  if(slot==='ultimate'||(slot==='light'&&(chain??0)>=RUSH_STAGES-1))return 2;
  return slot==='heavy'||slot==='special'?1:0;
}

const DIRECTOR_TURN=.35,TURN_MEMORY=.5,VELOCITY_RATE=10,TELEPORT=2,SUBJECT_RANGE=14;
const SETTLED_SPEED=.12,SETTLED_AFTER=.3,BASIS_CATCH=3,BLOCKED_SPEED=.6,BLOCKED_AFTER=.3;
const RUNNING:ReadonlySet<ActionKind>=new Set<ActionKind>(['run','idle','dash']);
const BOUND_MARGIN=.25,BOUND_NEAREST=1.6,BOUND_AFTER=1.5;
const ENCLOSED_OUT=1.4;
export const SMALL_FLOOR=15;
export function smallFloor(bounds?:{halfX:number;halfZ:number}){return !!bounds&&Math.min(bounds.halfX,bounds.halfZ)<SMALL_FLOOR;}
const OPEN_EDGE:Readonly<Record<string,number>>={
  'valley-of-the-end':1.4,'null-realm':1.4,'hueco-mundo':1.4,onigashima:1.4,shiganshina:1.4,'malevolent-shrine':1.4,'kami-lookout':1.4,
};
const boundOut=(b:{halfX:number;halfZ:number;doubleSided?:boolean;background?:number;id?:string},squad=false)=>b.doubleSided||b.background!==undefined||smallFloor(b)?ENCLOSED_OUT:(b.id!==undefined&&!squad?OPEN_EDGE[b.id]:undefined)??-BOUND_MARGIN;
const EDGE_NEAR=.1,EDGE_CLEAR=1,EDGE_AIR_SHARE=1.2,EDGE_AIR_MAX=6,EDGE_RATE=16;
const SQUEEZE_MOST=.85,SQUEEZE_SIDE=1.3,SQUEEZE_AHEAD=.7,SQUEEZE_SOFT=.8,SQUEEZE_EARLY=.5,SQUEEZE_IN=14,SQUEEZE_OUT=1.2,SQUEEZE_RISE=8;
const SQUEEZE_CLASSIC=[.06,.3] as const;
const SQUEEZE_WIDEN=10;
const LEAD_SIDE=.8;
const ARENA={boom:.15,back:.5,lift:.25,side:.26,foe:.2,meleeLift:.45,meleeSide:1,apart:.15,
  near:1.8,far:4.2,inner:.3,behind:.2,show:.6,outer:1.15,flip:.2,hand:.5,sideTime:.6,sideRest:1.2,idle:.05,
  speed:3.6,fast:5.2,accel:11,fastAccel:24,gain:5,lead:.85,away:3,pan:2.4,panAccel:9,panFor:1.2,
  slideStep:.07,slideMost:1.85,slideEdge:.7,slideTight:.4,slideSoft:.8,slideSide:2.3,slideOver:.25,slideBack:.4,slideNear:.5,rise:.3,crop:.55,group:.25,pull:.3,sink:.45,strain:.25,tilt:.8} as const;
const COVER_AGAIN=2;
const SMART_ATTACK=.8,SMART_PRESS=.9,SMART_HIT=.6,SMART_HIT_FOR=2.5,SMART_NEAR=.22,SMART_FROM=7,SMART_RANGE=14,SMART_DOWN=.35,CHEST_SMART=1.05,SMART_PITCH=.2,HEIGHT_MOST=14,HEIGHT_DECAY=.25;
const AIR_FREE=.6,AIR_SHARE=.5;
const BIG_FROM=1.15,BIG_FULL=1.6,BIG_AIR_BOOM=3.4,BIG_AIR_LIFT=1.6,BIG_AIR_HIGH=3;
const FORM_DYN_BOOM=.6,FORM_DYN_FOV=4.5,FORM_DYN_FOV_MOST=6;
const ATTACKS:ReadonlySet<ActionKind>=new Set<ActionKind>(['light','heavy','special','ultimate']);
const REACTIONS:ReadonlySet<ActionKind>=new Set<ActionKind>(['flinch','hurt','launched','knockdown','getup','stun','splat']);
const plunging=(s:{action:ActionKind;branch?:string;grounded:boolean})=>s.action==='special'&&s.branch==='airSpecial'&&!s.grounded;

export function framingHeading(bearing:number,distance:number,shoulder:number,back:number,most=MAX_OFFSET,foe=FOE_ANGLE){
  const reach=shoulder*Math.cos(foe)+back*Math.sin(foe);
  const offset=foe+Math.asin(Math.min(reach/Math.max(distance,1e-3),Math.sin(most-foe)));
  return bearing+offset;
}

export class FollowCamera {
  battlefield = false;
  yaw=Math.PI;
  movementYaw=Math.PI;
  mode:CameraMode='free';
  style:CameraStyle='classic';
  styleBlend=0;
  private latchBlend=0;
  inputYaw=Math.PI;
  assist=0;
  private initialized=false;
  private subject='';
  private anchor=new THREE.Vector3();
  private focus=new THREE.Vector3();
  private desired=new THREE.Vector3();
  private right=new THREE.Vector3();
  private forward=new THREE.Vector3();
  private probe=new THREE.Vector3();
  private boom=4.5;
  private lift=1.65;
  private shoulder=1.15;
  private focusHeight=1.05;
  private size:Rig={boom:4.5,lift:1.65,shoulder:1.15,focus:1.05};
  private trauma=0;
  private age=0;
  private heading=Math.PI;
  private assistVelocity=0;
  private lastTurn=-Infinity;
  private lockBlend=0;
  private lockLook=0;
  private lockAhead=0;
  private far=0;
  private air=0;
  private airLanded=LAND_HOLD;
  private hold=0;
  private engage=0;
  private strain=0;
  private close=0;
  private dodge:Follower={value:0,velocity:0};
  private offAxis=0;
  private framingGoal=NaN;
  private coverMine=0;
  private room?:Room;private roomSource?:readonly THREE.Object3D[];
  private dodgeGoal=0;
  private dodgeWait=0;
  private awayFrom=0;
  private uncover=false;
  private meBox=capsule();
  private foeBox=capsule();
  private blockers:Capsule[]=[capsule(),capsule(),capsule(),capsule()];
  private blockerCount=0;
  private gatherSelf?:Fighter;
  private gatherFoe?:Fighter;
  private lensY=0;
  private lookPitch=0;
  private tanV=Math.tan(THREE.MathUtils.degToRad(25));
  private tanH=Math.tan(THREE.MathUtils.degToRad(25))*16/9;
  private rX0=0;private rX1=0;private rY0=0;private rY1=0;private rDepth=0;
  private tilt:Follower={value:0,velocity:0};
  private pull:Follower={value:0,velocity:0};
  private widen:Follower={value:0,velocity:0};
  private framed=0;
  private edgeRoom=0;
  private squeeze=0;private squeezeLift=0;
  private landed=LAND_HOLD;
  private turning=new Float64Array(32);
  private turnSteps=0;
  private riseFoe=0;private lastFoe=NaN;private lastBody?:Fighter;
  private down=0;private floorFoe=0;
  private spanX=new Float64Array(SPAN_JOINTS.length);private spanZ=new Float64Array(SPAN_JOINTS.length);
  private joint=new THREE.Vector3();private riseMe=0;private lastMe=NaN;private floorMe=0;
  private reachMe=0;private lowMe=0;private highMe=0;private reachFoe=0;private lowFoe=0;private highFoe=0;
  private reachMeLow=0;private lyingMe=0;
  private fromMe=0;private toMe=0;private fromFoe=0;private toFoe=0;
  private kick=new THREE.Vector3();
  private kickVelocity=new THREE.Vector3();
  private kickGoal=new THREE.Vector3();
  private kickHold=0;
  private punch=0;
  private punchGoal=0;
  private baseFov:number;
  private axis=new THREE.Vector3();
  readonly director=new CameraDirector();
  readonly cuts=new FinisherCuts();
  finisherCuts=false;
  readonly fader=new OcclusionFader();
  cinematics=false;
  readonly brain=new CameraBrain();
  private brainIn=brainInput();
  private subjects:Subject[]=[];
  private subjectCount=0;
  private dynBlend=0;
  inputPitch=.02;
  private travel=new THREE.Vector3();private lastRoot=new THREE.Vector3();private rooted=false;
  private turnMemory=0;
  private autoTurn=0;private autoShown=0;private basisMask=0;
  private play:PlayKind|null=null;private playT=0;private readonly shots=new ShotGate();private wasPlunging=false;
  private playSide=1;
  readonly focusHint={pending:'',share:0};
  readonly picker=new CameraFocus();
  extraSubjects?:ReadonlyMap<string,Pick<Fighter,'state'|'group'>>;
  stageBounds?:{halfX:number;halfZ:number;doubleSided?:boolean;background?:number;id?:string};
  private settledFor=0;private blockedFor=0;private focusOf='';private coverAt=Infinity;
  private arenaBlend=0;
  sole=false;
  private holdId='';private holding=0;private holdBearing=0;
  private away=0;private own=0;
  private basisFoe='';private awayBasis=0;private basisHeld=NaN;
  private arenaSide=1;private sideAt=-Infinity;private sideFrom=1;private sideEase=1;
  private bearingRate=0;private lastBearing=NaN;private urgent=0;
  private behindFor=0;private showing=false;private changedAt=-Infinity;
  private slideSide=0;private slideNow=0;private slideEase:Follower={value:0,velocity:0};private sliding=false;
  get aimYaw(){if(this.smartOn)return this.smartHeld?this.smart.foeBearing+this.smart.away:this.movementYaw;return this.arenaBlend>.5&&this.holding>.5?this.holdBearing+this.away:this.movementYaw;}
  readonly smart=new SmartRig();
  get smartOn(){return this.mode==='smart'&&!this.battlefield;}
  private smartWas=false;private smartHeld=false;private smartFoe='';
  private smartIn:SmartInput={dt:0,placed:true,me:{x:0,y:0,z:0,high:CROWN,lying:false,airborne:false,vx:0,vz:0,floor:0,scale:1},foe:undefined,sole:false,threats:[],threatCount:0,manual:0,manualTilt:0,aspect:16/9,bound:undefined,frozen:false};
  private smartFoeBody={id:'',x:0,y:0,z:0,high:CROWN,lying:false,airborne:false,vx:0,vz:0};
  private smartBound={halfX:0,halfZ:0,out:0};
  private smartThreats:SmartThreat[]=[];private smartThreatCount=0;
  private foeTravel=new THREE.Vector3();private foeLast=new THREE.Vector3();private foeTracked='';private smartFloor=0;
  private readonly smartPressed=new Map<string,number>();
  get blocked(){return this.blockedFor>=BLOCKED_AFTER;}
  private bodyFocus=new THREE.Vector3();
  private leadNow=new THREE.Vector3();
  aboveHead(ndc:THREE.Vector3,body:Fighter|undefined,height:number){
    if(!body||!(height>0))return;
    const crown=this.crown,head=body.model?.visible!==false?body.joints?.get('Head'):undefined;
    if(head){head.getWorldPosition(crown);crown.y+=HEAD_PAD;}
    else crown.copy(body.group.position).y+=CROWN*drawnBulk(body);
    crown.project(this.camera);
    if(!(crown.z<1)||!Number.isFinite(crown.y))return;
    ndc.set(crown.x,Math.min(crown.y+2*MARKER_LIFT/height,1-2*MARKER_TOP/height),crown.z);
  }
  private crown=new THREE.Vector3();
  private loomHigh=-Infinity;
  private cutFocus=new THREE.Vector3();
  private cutTarget=new THREE.Vector3();
  private cutTargeting=false;
  private foxness=0;
  private drawnScale=1;private drawnBack=0;private drawnScaleGoal=1;private drawnBackGoal=0;private drawnAt=-Infinity;private drawnOf='';
  private drawnTop=-Infinity;private drawnMin=Infinity;private drawnInverse=new THREE.Matrix4();private drawnCorner=new THREE.Vector3();
  private readonly rig={styleBlend:0,mode:'free' as CameraMode,assist:0,heading:0,shot:'none' as string,shotWeight:0,punch:0,kick:0,tilt:0,pull:0,widen:0,cover:0,dodge:0,engage:0,faded:0,fadeMost:0,fadeWindow:0,fadeTwinned:0,fadeRoom:0,stageFront:0,stageTarget:0,awaken:undefined as undefined|Readonly<CameraDirector['awakenFrame']>,
    brain:'idle' as string,yieldTo:0,group:0,side:1,play:'none' as string,fov:50,
    focus:'' as string,switching:0,bounded:0,covered:0,
    edge:0,small:false,
    squeeze:0,
    arena:0,hold:0,own:0,away:0};
  constructor(readonly camera:THREE.PerspectiveCamera){this.baseFov=camera.fov;camera.userData.rig=this.rig;
    this.rig.awaken=this.director.awakenFrame;}
  reset(){resetCameraCutaway();this.fader.stage.off();this.initialized=false;this.subject='';this.trauma=0;this.boom=4.5;this.lift=1.65;this.shoulder=1.15;this.focusHeight=1.05;
    this.assistVelocity=0;this.lastTurn=-Infinity;this.far=0;this.close=0;this.air=0;this.airLanded=LAND_HOLD;this.hold=0;this.framed=0;this.engage=0;this.strain=0;this.landed=LAND_HOLD;
    this.tilt.value=this.tilt.velocity=this.pull.value=this.pull.velocity=this.widen.value=this.widen.velocity=0;this.squeeze=this.squeezeLift=0;
    this.dodge.value=this.dodge.velocity=0;this.dodgeGoal=0;this.dodgeWait=0;this.uncover=false;this.foxness=0;this.framingGoal=NaN;this.fader.closeManual=0;
    this.kick.set(0,0,0);this.kickVelocity.set(0,0,0);this.kickGoal.set(0,0,0);this.kickHold=0;this.punch=0;this.punchGoal=0;this.director.reset();this.cuts.reset();
    this.brain.reset();this.subjectCount=0;this.rooted=false;this.travel.set(0,0,0);this.turnMemory=0;this.autoTurn=this.autoShown=0;this.play=null;this.playT=0;this.shots.reset();this.wasPlunging=false;
    this.settledFor=this.blockedFor=0;this.focusOf='';this.focusHint.pending='';this.focusHint.share=0;this.picker.reset();
    this.holdId='';this.holding=0;this.away=this.own=0;this.basisFoe='';this.awayBasis=0;this.basisHeld=NaN;this.arenaSide=this.sideFrom=this.sideEase=1;this.sideAt=-Infinity;this.bearingRate=0;this.lastBearing=NaN;this.urgent=0;this.slideSide=this.slideNow=0;this.slideEase.value=this.slideEase.velocity=0;this.sliding=false;this.behindFor=0;this.showing=false;this.changedAt=-Infinity;
    this.smart.reset();this.smartHeld=false;this.smartFoe='';this.foeTracked='';this.smartPressed.clear();this.smartHeights.clear();}
  impact(weight:number,direction?:THREE.Vector3,tier:0|1|2=0){
    if(this.smartOn)return;
    const calm=this.battlefield?0:this.dynBlend;
    if(calm>0&&Number.isFinite(weight))weight*=1-calm*(1-CALM_SHARE*smooth(weight,CALM_FROM,CALM_FULL));
    this.trauma=Math.min(.8,Math.max(this.trauma,weight));
    const w=THREE.MathUtils.clamp(Number.isFinite(weight)?weight:0,0,1);
    if(direction&&direction.lengthSq()>1e-8&&w>0){
      this.kickGoal.addScaledVector(direction,KICK_PEAK*Math.pow(w,1.5)/direction.length());
      const most=KICK_PEAK*1.2;if(this.kickGoal.lengthSq()>most*most)this.kickGoal.setLength(most);
      this.kickHold=Math.max(this.kickHold,KICK_MIN_HOLD);
    }
    if(tier>0)this.punchGoal=Math.max(this.punchGoal,THREE.MathUtils.lerp(PUNCH[tier],tier>1?CALM_PUNCH:0,calm));
  }
  holdFor(weight=0){
    const w=Math.min(1,Math.max(0,weight));
    this.trauma=Math.max(this.trauma,Math.min(.25,weight*.2)*(this.battlefield?1:this.smartOn?0:1-this.dynBlend));
    this.hold=Math.max(this.hold,.045+.1*w);this.kickHold=Math.max(this.kickHold,this.hold);
  }
  intro(seconds:number){this.director.intro(seconds);}
  cut(){this.initialized=false;}
  lookAlong(yaw:number){this.initialized=false;this.heading=this.yaw=this.movementYaw=this.inputYaw=yaw;this.smart.lookAlong(yaw);}
  victory(winner:Fighter,seconds:number){this.director.victory(winner,seconds);}
  movementBasis(mask:number){
    if(this.smartOn){
      if(mask!==this.basisMask||mask===0){this.basisMask=mask;this.autoTurn=0;}
      return this.movementYaw-this.autoTurn;
    }
    if(mask!==this.basisMask||mask===0){this.basisMask=mask;this.autoTurn=wrapped(this.heading-this.yaw);this.autoShown=0;
      this.basisFoe=this.arenaBlend>.5&&this.holding>.5?this.holdId:'';this.awayBasis=this.away;this.basisHeld=NaN;}
    if(this.basisFoe){
      if(this.basisFoe===this.holdId&&this.holding>0)this.basisHeld=this.holdBearing+this.awayBasis;
      if(Number.isFinite(this.basisHeld))return this.basisHeld;
    }
    return this.dynBlend>0?this.movementYaw-this.autoShown:this.movementYaw;
  }

  update(dt:number,self:Fighter,yaw:number,pitch:number,occluders:THREE.Object3D[],shake:number,opponent?:Fighter,locked=false){
    dt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.25);
    if(this.smartOn){this.updateSmart(dt,self,yaw,pitch,occluders,shake,opponent,locked);return;}
    if(this.smartWas){this.smartWas=false;this.smartHeld=false;this.initialized=false;}
    const position=self.group.position;
    const placed=!this.initialized||self.state.id!==this.subject||this.anchor.distanceToSquared(position)>100;
    const turned=this.initialized&&Math.abs(wrapped(yaw-this.inputYaw))>1e-6;
    const tilted=this.initialized&&Math.abs(pitch-this.inputPitch)>1e-6;
    const lockon=this.mode==='lockon',arena=this.mode==='arena'&&!this.battlefield,dynamic=this.mode==='dynamic'||this.mode==='arena',composed=lockon||dynamic;
    this.lockBlend=placed?(composed?1:0):this.lockBlend+((composed?1:0)-this.lockBlend)*blend(4,dt);
    if(!composed&&this.lockBlend<1e-3)this.lockBlend=0;
    this.dynBlend=placed?(dynamic?1:0):this.dynBlend+((dynamic?1:0)-this.dynBlend)*blend(4,dt);
    if(!dynamic&&this.dynBlend<1e-3)this.dynBlend=0;
    this.arenaBlend=placed?(arena?1:0):this.arenaBlend+((arena?1:0)-this.arenaBlend)*blend(4,dt);
    if(!arena&&this.arenaBlend<1e-3)this.arenaBlend=0;
    const latchGoal=arena?0:closeStyleGoal(this.style,this.battlefield,this.brain.group*this.dynBlend),styleGoal=smallFloor(this.stageBounds)?0:latchGoal*(1-smooth(this.squeeze,SQUEEZE_CLASSIC[0],SQUEEZE_CLASSIC[1]));
    this.styleBlend=placed?styleGoal:this.styleBlend+(styleGoal-this.styleBlend)*blend(CLOSE_RATE,dt);
    if(styleGoal===0&&this.styleBlend<1e-3)this.styleBlend=0;
    this.latchBlend=placed?latchGoal:this.latchBlend+(latchGoal-this.latchBlend)*blend(CLOSE_RATE,dt);
    if(latchGoal===0&&this.latchBlend<1e-3)this.latchBlend=0;
    GHOST_FADE.value.x=this.styleBlend;
    const foe=opponent?.state.alive?opponent:undefined;
    if(this.lockBlend>0){this.measure(self,drawnBulk(self),this.meBox);
      const loom=loomTop(self.state.id);this.loomHigh=loom>0?self.group.position.y+loom+STAND_CROWN:-Infinity;
      if(foe){this.measure(foe,drawnBulk(foe),this.foeBox);this.gather(self,foe);}else this.blockerCount=0;}
    if(lockon)this.steer(dt,placed,self,yaw,pitch,foe,locked);
    else if(dynamic){if(arena)this.steerArena(dt,placed,self,yaw,pitch,tilted,foe,locked);else this.steerDynamic(dt,placed,self,yaw,pitch,tilted,foe,locked);pitch=this.inputPitch;this.resample(dt,self);}
    else{this.heading=yaw;this.inputYaw=yaw;this.assistVelocity=0;this.assist=0;this.framed=0;this.strain-=this.strain*blend(STRAIN_OUT,dt);}
    if(!dynamic){this.inputPitch=pitch;this.turnMemory=0;}
    if(!arena){this.holding=0;this.holdId='';this.away=0;}
    this.cutTargeting=composed&&this.lockBlend>.5&&!!foe;
    if(foe)this.cutTarget.set(foe.group.position.x,foe.group.position.y+1.1,foe.group.position.z);
    if(placed){this.yaw=composed?this.heading:yaw;this.anchor.copy(position);this.autoShown=this.autoTurn;}
    else{
      this.yaw+=wrapped((composed?this.heading:yaw)-this.yaw)*blend(32,dt);
      this.autoShown+=(this.autoTurn-this.autoShown)*blend(32,dt);
      this.anchor.x=position.x;this.anchor.z=position.z;
      const rise=this.dynBlend>0&&Number.isFinite(this.floorMe)?position.y-this.floorMe:0;
      const climb=rise>AIR_FREE?position.y-(rise-AIR_FREE)*(1-AIR_SHARE)*(1-this.bigness())*this.dynBlend:position.y;
      this.anchor.y=THREE.MathUtils.lerp(this.anchor.y,climb,blend(24,dt));
    }
    if(this.dynBlend>0){
      let lx=this.brain.leadX*this.dynBlend,lz=this.brain.leadZ*this.dynBlend;
      const rx=-Math.cos(this.yaw),rz=Math.sin(this.yaw),across=lx*rx+lz*rz,side=Math.sign(this.shoulder)||1;
      const most=Math.max(0,LEAD_SIDE*this.boom*this.tanH-Math.abs(this.shoulder));
      if(across*side>most){const k=most/(across*side);lx*=k;lz*=k;}
      this.anchor.x+=lx;this.anchor.z+=lz;this.leadNow.set(lx,0,lz);
    }else this.leadNow.set(0,0,0);
    this.subject=self.state.id;
    const awakened=!!self.state.awakened;
    const fox=awakened&&self.state.fighter==='naruto';
    const large=awakened&&LARGE_FORMS.has(self.state.fighter)||!!BODY_SIZE[self.state.fighter];
    const bodyRig=self.state.fighter==='pikachu'?PETITE:NORMAL;
    const from=fox?FOX:large?LARGE:bodyRig,size=this.size;
    size.boom=from.boom;size.lift=from.lift;size.shoulder=from.shoulder;size.focus=from.focus;
    const alpha=placed?1:blend(7,dt);
    if(occluders!==this.roomSource){this.roomSource=occluders;this.room=roomOf(occluders);this.coverAt=this.age+COVER_AGAIN;this.rig.covered=coverStage(occluders);}
    else if(this.age>=this.coverAt){this.coverAt=Infinity;this.rig.covered+=coverStage(occluders);}
    if(this.lockBlend>0){
      const k=this.lockBlend;
      this.measureDrawn(dt,placed,self,size.boom/4.5);
      const scale=this.drawnScale,g=scale-1,back=this.drawnBack*FORM_BACK;
      const sb=1+g*FORM_BOOM,sl=1+g*FORM_LIFT,ss=1+g*FORM_SIDE,sf=1+g*FORM_FOCUS,sa=1+g*FORM_AHEAD;
      size.boom=THREE.MathUtils.lerp(size.boom,bodyRig.boom*sb+back,k);
      size.lift=THREE.MathUtils.lerp(size.lift,bodyRig.lift*sl+back*DRAWN_RISE+g*FORM_RISE,k);
      size.shoulder=THREE.MathUtils.lerp(size.shoulder,bodyRig.shoulder*ss,k);
      size.focus=THREE.MathUtils.lerp(size.focus,bodyRig.focus*sf,k);
      const apart=this.far*(1-this.arenaBlend*(1-ARENA.apart));
      const apartStrain=this.strain*(1-this.arenaBlend*(1-ARENA.strain));
      const standBoom=apart*FAR_BOOM+this.air*AIR_BOOM+apartStrain*STRAIN_BOOM+this.close*CLOSE_BOOM;
      const standLift=apart*FAR_LIFT-this.air*AIR_LIFT+apartStrain*STRAIN_LIFT+this.close*CLOSE_LIFT;
      size.boom+=k*(LOCK_BOOM+standBoom)*sb;
      size.lift+=k*(LOCK_LIFT+standLift)*sl;
      size.shoulder+=k*LOCK_SHOULDER*ss;
      size.focus+=k*(LOCK_FOCUS+this.air*AIR_FOCUS)*sf;
      this.lockLook=k;this.lockAhead=k*LOCK_AHEAD*sa;
      const foxShown=fox&&self.model?.visible===false;
      this.foxness=placed?(foxShown?1:0):this.foxness+((foxShown?1:0)-this.foxness)*blend(FOX_RATE,dt);
      if(this.foxness<1e-3)this.foxness=0;
      if(this.foxness>0){
        const w=this.foxness*k;
        size.boom=THREE.MathUtils.lerp(size.boom,FOX_LOCK.boom+standBoom*sb,w);
        size.lift=THREE.MathUtils.lerp(size.lift,FOX_LOCK.lift+standLift*sl,w);
        size.shoulder=THREE.MathUtils.lerp(size.shoulder,FOX_LOCK.shoulder,w);
        size.focus=THREE.MathUtils.lerp(size.focus,FOX_LOCK.focus+this.air*AIR_FOCUS*sf,w);
        this.lockAhead=THREE.MathUtils.lerp(this.lockAhead,k*FOX_LOCK.ahead,this.foxness);
      }
      if(this.dynBlend>0){
        const d=this.dynBlend,b=this.brain,a=this.arenaBlend;
        const high=Number.isFinite(this.floorMe)?smooth(self.group.position.y-this.floorMe,AIR_FREE,BIG_AIR_HIGH):0;
        const bigAir=this.bigness()*high*Math.max(1,scale-1);
        const boom=b.boom+a*(ARENA.boom+(this.style==='classic'?ARENA.back:0)-b.group*GROUP_BOOM*(1-ARENA.group));
        const lift=b.lift+a*(ARENA.lift+this.close*ARENA.meleeLift+(1-Math.abs(this.sideEase))*SIDE_LIFT-b.group*GROUP_LIFT*(1-ARENA.group)-(1-Math.abs(b.side))*SIDE_LIFT);
        size.boom+=d*(boom*sb+FORM_DYN_BOOM*Math.max(0,g)+BIG_AIR_BOOM*bigAir);size.lift+=d*(lift*sl+BIG_AIR_LIFT*bigAir);size.focus+=d*b.focus*sf;
        const own=size.shoulder*(1+(b.side-1)*d);
        size.shoulder=a>0?THREE.MathUtils.lerp(own,(size.shoulder+(ARENA.side-this.close*ARENA.meleeSide)*ss+this.slideEase.value)*this.sideEase,a):own;this.lockAhead+=d*b.ahead*sa;
      }
    }else{this.lockLook=0;this.lockAhead=0;this.foxness=0;}
    if(this.battlefield){size.boom+=1.5;size.lift+=.15;size.focus+=.3;}
    if(this.styleBlend>0)closeStyleRig(size,this.styleBlend,Math.tan(THREE.MathUtils.degToRad(this.baseFov)/2)*this.camera.aspect);
    this.boom=THREE.MathUtils.lerp(this.boom,size.boom,alpha);
    this.lift=THREE.MathUtils.lerp(this.lift,size.lift,alpha);
    this.shoulder=THREE.MathUtils.lerp(this.shoulder,size.shoulder,alpha);this.slideNow=THREE.MathUtils.lerp(this.slideNow,this.slideEase.value*this.arenaBlend,alpha);
    this.focusHeight=THREE.MathUtils.lerp(this.focusHeight,size.focus,alpha);
    this.forward.set(Math.sin(this.yaw),0,Math.cos(this.yaw));
    this.right.set(-Math.cos(this.yaw),0,Math.sin(this.yaw));
    this.focus.copy(this.anchor).addScaledVector(UP,this.focusHeight);
    const keep=1-(this.dynBlend>0&&!this.battlefield?this.squeezeFor(dt,placed,pitch):(this.squeeze=0)),boom=keep<1?this.boom*keep:this.boom,shoulder=keep<1?this.shoulder*Math.pow(keep,SQUEEZE_SIDE):this.shoulder;
    this.desired.copy(this.focus).addScaledVector(this.forward,-boom*Math.cos(pitch))
      .addScaledVector(this.right,shoulder).addScaledVector(UP,this.lift+Math.sin(pitch)*boom);
    this.camera.position.copy(this.desired);
    this.probe.copy(this.focus).addScaledVector(this.right,shoulder*.25);
    if(this.lockLook>0)this.probe.addScaledVector(this.right,shoulder*.75*this.lockLook).addScaledVector(this.forward,keep<1?this.lockAhead*(1-SQUEEZE_AHEAD*(1-keep)):this.lockAhead);
    this.rig.bounded=this.dynBlend>0?this.keepInside():0;
    this.desired.copy(this.camera.position);
    let edgeGoal=0;
    if(this.dynBlend>0&&this.stageBounds){
      const b=this.stageBounds,out=boundOut(b,this.battlefield);
      const clearance=Math.min(b.halfX+out-Math.abs(this.desired.x),b.halfZ+out-Math.abs(this.desired.z));
      edgeGoal=(1-smooth(clearance,EDGE_NEAR,EDGE_CLEAR))*this.dynBlend;
    }
    this.edgeRoom=placed?edgeGoal:this.edgeRoom+(edgeGoal-this.edgeRoom)*blend(EDGE_RATE,dt);
    if(this.edgeRoom<1e-4){this.edgeRoom=0;this.squeezeLift=0;}
    if(this.edgeRoom>0){
      const rise=Math.max(0,position.y-this.floorMe);
      const tight=this.edgeRoom;
      const climb=position.y-Math.max(0,rise-AIR_FREE)*(1-AIR_SHARE)*(1-this.bigness())*this.dynBlend;
      const lag=(climb-this.anchor.y)*tight;
      const reach=(position.x-this.desired.x)*this.forward.x+(position.z-this.desired.z)*this.forward.z;
      const compressed=Math.max(0,(NORMAL.boom+LOCK_BOOM)*(1+(CLOSE_STYLE.boom-1)*this.styleBlend)-reach);
      this.squeezeLift=placed||this.battlefield?compressed:this.squeezeLift+(compressed-this.squeezeLift)*blend(SQUEEZE_RISE,dt);
      const lift=Math.min(EDGE_AIR_MAX,this.squeezeLift*(1-this.arenaBlend*(1-ARENA.rise))+rise*EDGE_AIR_SHARE)*tight;
      this.desired.y+=lift+lag;this.camera.position.y+=lift+lag;this.probe.y+=lag;
    }
    if(this.lockBlend>0)this.frame(dt,placed,self,foe,fox?8/4.5:large?7.5/4.5:1);
    else{this.tilt.value=this.tilt.velocity=this.pull.value=this.pull.velocity=this.widen.value=this.widen.velocity=0;}
    this.rig.bounded+=this.dynBlend>0?this.keepInside():0;
    this.movementYaw=Math.atan2(this.probe.x-this.camera.position.x,this.probe.z-this.camera.position.z);
    this.camera.lookAt(this.probe);
    if(this.dynBlend>0)this.baseFov=THREE.MathUtils.lerp(this.baseFov,closeStyleFov(50+(this.brain.fov-50-this.arenaBlend*this.brain.group*GROUP_FOV*(1-ARENA.group)+Math.min(FORM_DYN_FOV_MOST,FORM_DYN_FOV*Math.max(0,this.drawnScale-1)))*this.dynBlend,this.styleBlend),placed?1:blend(3,dt));
    else this.baseFov=THREE.MathUtils.lerp(this.baseFov,closeStyleFov(50,this.styleBlend),placed?1:blend(10,dt));
    if(this.lockBlend>0){
      this.lensY=this.camera.position.y;
      this.lookPitch=Math.atan2(this.probe.y-this.camera.position.y,Math.hypot(this.probe.x-this.camera.position.x,this.probe.z-this.camera.position.z));
      this.tanV=Math.tan(THREE.MathUtils.degToRad(this.baseFov)/2);this.tanH=this.tanV*this.camera.aspect;
      this.rig.cover=foe&&this.framed>0?this.coverage(this.yaw,pitch):0;
      if(!(foe&&this.framed>0))this.coverMine=0;
    }else{this.rig.cover=0;this.coverMine=0;}
    this.director.enabled=this.cinematics;
    this.director.closeStyle=this.styleBlend>.5||(this.arenaBlend>.5&&this.style==='close');
    this.director.ceded=this.cuts.owns;
    const lens=this.baseFov+this.widen.value*this.lockBlend;
    let shot=this.director.apply(dt,this.camera,self,this.desired,this.probe,lens,occluders,drawnBulk(self),this.dynBlend>.5?this.turnMemory>DIRECTOR_TURN:turned,foe);
    this.cuts.enabled=this.cinematics&&this.finisherCuts;
    const filmed=this.cuts.apply(dt,this.camera,self,this.director.crowd,occluders,drawnBulk(self));
    if(filmed)shot=1;
    const at=this.dynBlend>0?this.bodyFocus.set(this.focus.x-this.leadNow.x,this.focus.y,this.focus.z-this.leadNow.z):this.focus;
    setCameraCutaway(this.camera.position,shot>0?this.cutFocus.lerpVectors(at,filmed?this.cuts.pivot:this.director.pivot,shot):at,position.y,fox?3.8:large?2.7:1.35,this.cutTargeting&&shot<.5?this.cutTarget:undefined);
    const scale=THREE.MathUtils.clamp(Number.isFinite(shake)?shake*2:0,0,2);
    const frozen=this.hold>0||!!self.state.hitstop;
    this.hold=Math.max(0,this.hold-dt);
    if(!frozen)this.punchGoal*=Math.exp(-8*dt);
    this.punch+=(this.punchGoal-this.punch)*blend(this.punch<this.punchGoal?35:14,dt);
    if(this.punchGoal<1e-3&&this.punch<1e-3)this.punch=this.punchGoal=0;
    const played=this.dynBlend>0?this.playShots(dt,self,shot):(this.director.cueCount=0);
    this.camera.fov=(shot>0?this.camera.fov:lens)-this.punch*scale+played;
    this.camera.updateProjectionMatrix();
    if(this.kickHold>0){this.kickHold=Math.max(0,this.kickHold-dt);dampedVector(this.kick,this.kickVelocity,this.kickGoal,KICK_OUT,dt);}
    else{this.kickGoal.set(0,0,0);dampedVector(this.kick,this.kickVelocity,ZERO,KICK_BACK,dt);}
    if(scale>0&&this.kick.lengthSq()>1e-10){
      const q=this.camera.quaternion;
      const across=this.kick.dot(this.axis.set(1,0,0).applyQuaternion(q)),up=this.kick.dot(this.axis.set(0,1,0).applyQuaternion(q)),along=this.kick.dot(this.axis.set(0,0,-1).applyQuaternion(q));
      this.camera.position.addScaledVector(this.kick,scale);
      this.camera.rotateY(-across*KICK_TURN*scale);this.camera.rotateX((up-along)*KICK_TURN*scale);this.camera.rotateZ(-across*KICK_ROLL*scale);
    }else if(this.kick.lengthSq()<=1e-10){this.kick.set(0,0,0);this.kickVelocity.set(0,0,0);}
    if(this.dynBlend>0&&shot<.5)this.rig.bounded+=this.keepInside(true);
    this.age+=dt;this.trauma=Math.max(0,this.trauma-dt*3);
    const amount=this.trauma*this.trauma*shake*NOISE;
    if(amount>1e-5){this.camera.rotateX(Math.sin(this.age*31)*amount);this.camera.rotateZ(Math.sin(this.age*27)*amount*.5);}
    this.camera.updateMatrixWorld();this.initialized=true;
    this.fader.shotVictim=this.director.shotVictim;this.fader.shotHidden=this.director.victimBehindCaster;
    this.fader.selfCover=this.coverMine*this.lockBlend;
    const groundedFoe=!!foe&&(foe.state.grounded||!!foe.state.hitstop&&Math.abs(this.foeBox.low-this.meBox.low)<.18&&Math.abs(foe.group.position.y-position.y)<.2);
    this.fader.closeManual=dynamic&&locked&&this.brain.mode==='duel'&&self.state.grounded&&groundedFoe&&SWINGS.has(self.state.action)&&shot===0&&this.director.kind==='none'&&!this.cuts.owns&&foe
      ?1-smooth(Math.hypot(foe.group.position.x-position.x,foe.group.position.z-position.z),CLOSE_FAR,ENGAGE_RANGE):0;
    this.fader.stage.room=this.room;
    this.fader.update(dt,this.camera,this.director.crowd,self,foe,this.director.focus);
    const rig=this.rig;rig.mode=this.mode;rig.assist=this.assist;rig.heading=this.heading;rig.shot=this.director.phase;rig.shotWeight=shot;rig.punch=this.punch*scale;rig.kick=this.kick.length()*scale;
    rig.tilt=this.tilt.value*this.lockBlend;rig.pull=this.pull.value*this.lockBlend;rig.widen=this.widen.value*this.lockBlend;rig.dodge=this.dodge.value;rig.engage=this.engage;rig.faded=this.fader.state.faded;rig.fadeMost=this.fader.state.most;rig.fadeWindow=this.fader.state.window;rig.fadeTwinned=this.fader.state.twinned;rig.fadeRoom=this.fader.state.room;rig.stageFront=this.fader.stage.state.front;rig.stageTarget=this.fader.stage.state.target;
    rig.brain=this.dynBlend>0?this.brain.mode:'off';rig.yieldTo=this.brain.yieldTo*this.dynBlend;rig.group=this.brain.group*this.dynBlend;rig.side=this.dynBlend>0?(this.arenaBlend>.5?this.sideEase:this.brain.side):1;rig.play=this.play??'none';rig.fov=this.baseFov;
    rig.focus=foe?.state.id??'';rig.styleBlend=this.styleBlend;rig.switching=this.brain.switching*this.dynBlend;rig.edge=this.edgeRoom;rig.small=smallFloor(this.stageBounds);rig.squeeze=this.squeeze;
    rig.arena=this.arenaBlend;rig.hold=this.holding*this.arenaBlend;rig.own=this.own;rig.away=this.away;
  }

  private updateSmart(dt:number,self:Fighter,yaw:number,pitch:number,occluders:THREE.Object3D[],shake:number,opponent?:Fighter,locked=false){
    const position=self.group.position;
    const placed=!this.initialized||!this.smartWas||self.state.id!==this.subject||this.anchor.distanceToSquared(position)>100;
    const manual=placed?0:wrapped(yaw-this.inputYaw),tilt=placed?0:pitch-this.inputPitch;
    this.smartWas=true;
    this.lockBlend=this.dynBlend=this.arenaBlend=this.styleBlend=this.latchBlend=0;GHOST_FADE.value.x=0;
    this.assist=0;this.framed=0;this.squeeze=this.squeezeLift=this.edgeRoom=0;this.holding=0;this.holdId='';this.away=0;
    this.turnMemory=this.turnMemory*Math.exp(-dt/TURN_MEMORY)+Math.abs(manual);
    const foe=opponent?.state.alive?opponent:undefined;
    this.trackVelocity(dt,placed,position);
    if(placed||self.state.grounded)this.smartFloor=position.y;
    if(foe){
      const p=foe.group.position;
      if(placed||foe.state.id!==this.foeTracked||!(dt>0)){this.foeTravel.set(0,0,0);this.foeTracked=foe.state.id;}
      else{const dx=p.x-this.foeLast.x,dz=p.z-this.foeLast.z;if(dx*dx+dz*dz>TELEPORT*TELEPORT)this.foeTravel.set(0,0,0);else{const k=blend(VELOCITY_RATE,dt);this.foeTravel.x+=(dx/dt-this.foeTravel.x)*k;this.foeTravel.z+=(dz/dt-this.foeTravel.z)*k;}}
      this.foeLast.copy(p);
    }else this.foeTracked='';
    this.smartThreatCount=0;this.gatherSelf=self;this.gatherFoe=foe;this.director.crowd?.forEach(this.weighThreat);this.gatherSelf=this.gatherFoe=undefined;
    const awakened=!!self.state.awakened,fox=awakened&&self.state.fighter==='naruto',large=awakened&&LARGE_FORMS.has(self.state.fighter)||!!BODY_SIZE[self.state.fighter];
    const scale=Math.max(drawnBulk(self),BODY_SIZE[self.state.fighter]??1);
    const frozen=this.hold>0||!!self.state.hitstop;
    const i=this.smartIn,me=i.me,s=self.state;
    i.dt=dt;i.placed=placed;i.manual=manual;i.manualTilt=tilt;i.aspect=this.camera.aspect;i.frozen=frozen;i.sole=this.sole||locked;i.latched=this.basisMask>0;
    me.x=position.x;me.y=position.y;me.z=position.z;me.vx=this.travel.x;me.vz=this.travel.z;me.floor=this.smartFloor;me.scale=scale;me.high=this.drawnHeight(self);
    me.lying=s.action==='knockdown'||s.action==='getup'||(s.action==='splat'&&!!s.grounded);me.airborne=!s.grounded;
    if(foe){
      const f=this.smartFoeBody,p=foe.group.position,fs=foe.state;
      f.id=fs.id;f.x=p.x;f.y=p.y;f.z=p.z;f.vx=this.foeTravel.x;f.vz=this.foeTravel.z;f.high=this.drawnHeight(foe);
      f.lying=fs.action==='knockdown'||fs.action==='getup'||(fs.action==='splat'&&!!fs.grounded);f.airborne=!fs.grounded;i.foe=f;
    }else i.foe=undefined;
    i.threats=this.smartThreats;i.threatCount=this.smartThreatCount;
    if(this.stageBounds){const b=this.smartBound;b.halfX=this.stageBounds.halfX;b.halfZ=this.stageBounds.halfZ;b.out=boundOut(this.stageBounds,false);i.bound=b;}else i.bound=undefined;
    const rig=this.smart;rig.update(i);
    this.smartFoe=foe?.state.id??'';this.smartHeld=!!foe&&rig.engaged>.5;
    this.camera.position.set(rig.lensX,rig.lensY,rig.lensZ);this.probe.set(rig.lookX,rig.lookY,rig.lookZ);
    this.desired.copy(this.camera.position);this.camera.lookAt(this.probe);
    const before=this.movementYaw;
    this.heading=this.yaw=rig.heading;this.inputYaw=rig.heading;
    this.inputPitch=SMART_PITCH;
    this.movementYaw=Math.atan2(this.probe.x-this.camera.position.x,this.probe.z-this.camera.position.z);
    if(this.basisMask>0&&!placed)this.autoTurn+=wrapped(this.movementYaw-before-manual);
    this.forward.set(Math.sin(this.movementYaw),0,Math.cos(this.movementYaw));this.right.set(-Math.cos(this.movementYaw),0,Math.sin(this.movementYaw));
    this.anchor.copy(position);this.subject=s.id;this.lastBody=foe;
    this.baseFov=rig.fov;
    this.focus.set(position.x,position.y+CHEST_SMART*scale,position.z);
    if(occluders!==this.roomSource){this.roomSource=occluders;this.room=roomOf(occluders);this.coverAt=this.age+COVER_AGAIN;this.rig.covered=coverStage(occluders);}
    else if(this.age>=this.coverAt){this.coverAt=Infinity;this.rig.covered+=coverStage(occluders);}
    this.cutTargeting=!!foe&&rig.engaged>.5;
    if(foe)this.cutTarget.set(foe.group.position.x,foe.group.position.y+1.1,foe.group.position.z);
    this.rig.cover=0;this.coverMine=0;
    this.director.enabled=this.cinematics;
    this.director.closeStyle=this.style==='close';
    this.director.ceded=this.cuts.owns;
    const lens=this.baseFov;
    let shot=this.director.apply(dt,this.camera,self,this.desired,this.probe,lens,occluders,drawnBulk(self),this.turnMemory>DIRECTOR_TURN,foe);
    this.cuts.enabled=this.cinematics&&this.finisherCuts;
    const filmed=this.cuts.apply(dt,this.camera,self,this.director.crowd,occluders,drawnBulk(self));
    if(filmed)shot=1;
    setCameraCutaway(this.camera.position,shot>0?this.cutFocus.lerpVectors(this.focus,filmed?this.cuts.pivot:this.director.pivot,shot):this.focus,position.y,fox?3.8:large?2.7:1.35,this.cutTargeting&&shot<.5?this.cutTarget:undefined);
    const amp=THREE.MathUtils.clamp(Number.isFinite(shake)?shake*2:0,0,2);
    this.hold=Math.max(0,this.hold-dt);
    if(!frozen)this.punchGoal*=Math.exp(-8*dt);
    this.punch+=(this.punchGoal-this.punch)*blend(this.punch<this.punchGoal?35:14,dt);
    if(this.punchGoal<1e-3&&this.punch<1e-3)this.punch=this.punchGoal=0;
    const played=this.playShots(dt,self,shot);
    this.camera.fov=(shot>0?this.camera.fov:lens)-this.punch*amp+played;
    this.camera.updateProjectionMatrix();
    if(this.kickHold>0){this.kickHold=Math.max(0,this.kickHold-dt);dampedVector(this.kick,this.kickVelocity,this.kickGoal,KICK_OUT,dt);}
    else{this.kickGoal.set(0,0,0);dampedVector(this.kick,this.kickVelocity,ZERO,KICK_BACK,dt);}
    if(amp>0&&this.kick.lengthSq()>1e-10){
      const q=this.camera.quaternion;
      const across=this.kick.dot(this.axis.set(1,0,0).applyQuaternion(q)),up=this.kick.dot(this.axis.set(0,1,0).applyQuaternion(q)),along=this.kick.dot(this.axis.set(0,0,-1).applyQuaternion(q));
      this.camera.position.addScaledVector(this.kick,amp);
      this.camera.rotateY(-across*KICK_TURN*amp);this.camera.rotateX((up-along)*KICK_TURN*amp);this.camera.rotateZ(-across*KICK_ROLL*amp);
    }else if(this.kick.lengthSq()<=1e-10){this.kick.set(0,0,0);this.kickVelocity.set(0,0,0);}
    this.age+=dt;this.trauma=Math.max(0,this.trauma-dt*3);
    const amount=this.trauma*this.trauma*shake*NOISE;
    if(amount>1e-5){this.camera.rotateX(Math.sin(this.age*31)*amount);this.camera.rotateZ(Math.sin(this.age*27)*amount*.5);}
    this.camera.updateMatrixWorld();this.initialized=true;
    this.fader.shotVictim=this.director.shotVictim;this.fader.shotHidden=this.director.victimBehindCaster;
    this.fader.selfCover=rig.selfCover;this.fader.closeManual=0;
    this.fader.stage.room=this.room;
    this.fader.update(dt,this.camera,this.director.crowd,self,foe,this.director.focus);
    const r=this.rig;r.mode=this.mode;r.assist=rig.engaged;r.heading=rig.heading;r.shot=this.director.phase;r.shotWeight=shot;r.punch=this.punch*amp;r.kick=this.kick.length()*amp;
    r.tilt=rig.state.tilt;r.pull=rig.state.dolly;r.widen=0;r.dodge=0;r.engage=0;r.faded=this.fader.state.faded;r.fadeMost=this.fader.state.most;r.fadeWindow=this.fader.state.window;r.fadeTwinned=this.fader.state.twinned;r.fadeRoom=this.fader.state.room;r.stageFront=this.fader.stage.state.front;r.stageTarget=this.fader.stage.state.target;
    r.brain='smart';r.yieldTo=0;r.group=rig.state.group;r.side=Math.sign(rig.shoulder)||1;r.play=this.play??'none';r.fov=this.baseFov;
    r.focus=foe?.state.id??'';r.styleBlend=0;r.switching=0;r.edge=0;r.small=smallFloor(this.stageBounds);r.squeeze=0;r.bounded=rig.state.bounded;
    r.arena=0;r.hold=rig.engaged;r.own=rig.state.phi;r.away=rig.away;
    (r as Record<string,unknown>).smart={dolly:rig.state.dolly,need:rig.state.need,squeeze:rig.state.bounded,hard:rig.state.hard,meHigh:me.high,foeHigh:i.foe?.high??0,lo:rig.state.lo,hi:rig.state.hi};
  }
  private drawnHeight(body:Fighter){
    const id=body.state.id,cached=this.smartHeights.get(id);
    if(cached&&this.age-cached.at<DRAWN_EVERY)return cached.high;
    const p=body.group.position,own=body.model?.visible!==false&&!!body.joints?.get('Head');
    let high:number;
    if(own){
      this.measure(body,drawnBulk(body),this.heightBox);high=this.heightBox.high-p.y;
    }else{
      this.meshTopY=-Infinity;body.group.updateWorldMatrix(true,true);body.group.traverseVisible(this.meshTop);
      high=Number.isFinite(this.meshTopY)?this.meshTopY-p.y:CROWN*drawnBulk(body);
    }
    high=THREE.MathUtils.clamp(Number.isFinite(high)?high:CROWN,.5,HEIGHT_MOST);
    if(cached){cached.high=Math.max(high,cached.high-HEIGHT_DECAY*(this.age-cached.at));cached.at=this.age;return cached.high;}
    this.smartHeights.set(id,{at:this.age,high});
    return high;
  }
  private heightBox=capsule();private meshTopY=-Infinity;private meshBox=new THREE.Box3();
  private readonly smartHeights=new Map<string,{at:number;high:number}>();
  private meshTop=(o:THREE.Object3D)=>{
    const m=o as THREE.SkinnedMesh;if(!m.isSkinnedMesh||!m.geometry)return;
    if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();
    this.meshBox.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);this.meshTopY=Math.max(this.meshTopY,this.meshBox.max.y);
  };
  private weighThreat=(body:Fighter)=>{
    const self=this.gatherSelf;
    if(!self||body===self||body===this.gatherFoe||!body.state.alive||!body.group.visible)return;
    if(self.state.team!==undefined&&body.state.team===self.state.team)return;
    const st=body.state,p=body.group.position,q=self.group.position,d=Math.hypot(p.x-q.x,p.z-q.z);
    if(d>SMART_RANGE)return;
    const attacking=ATTACKS.has(st.action)&&st.target===self.state.id&&d<(castThreat(st).move?.range??3)+3;
    if(attacking)this.smartPressed.set(st.id,this.age);
    const since=this.smartPressed.get(st.id),pressing=since===undefined?0:1-smooth(this.age-since,SMART_PRESS,SMART_PRESS*2);
    const hit=this.director.hitAgo(st.id);
    let w=SMART_ATTACK*pressing;
    if(hit<SMART_HIT_FOR)w=Math.max(w,SMART_HIT*(1-smooth(hit,SMART_HIT_FOR*.5,SMART_HIT_FOR)));
    w=Math.max(w,SMART_NEAR*(1-smooth(d,3,SMART_FROM)));
    w*=1-smooth(d,SMART_FROM,SMART_RANGE);
    const lying=st.action==='knockdown'||st.action==='getup'||(st.action==='splat'&&!!st.grounded);
    if(lying)w*=SMART_DOWN;
    if(w<.03)return;
    if(this.smartThreatCount>=this.smartThreats.length)this.smartThreats.push({id:'',x:0,y:0,z:0,high:CROWN,lying:false,airborne:false,weight:0});
    const t=this.smartThreats[this.smartThreatCount++];
    t.id=st.id;t.x=p.x;t.y=p.y;t.z=p.z;t.high=CROWN*drawnBulk(body);t.lying=lying;t.airborne=!st.grounded;t.weight=w;
  };

  private measureDrawn(dt:number,placed:boolean,self:Fighter,least:number){
    const other=!!self.state.awakened||self.model?.visible===false||!!BODY_SIZE[self.state.fighter],key=self.state.id;
    if(!other){this.drawnScaleGoal=least;this.drawnBackGoal=0;}
    else if(placed||key!==this.drawnOf||this.age-this.drawnAt>=DRAWN_EVERY){
      this.drawnAt=this.age;this.drawnOf=key;this.drawnTop=-Infinity;this.drawnMin=Infinity;
      self.group.updateWorldMatrix(true,false);this.drawnInverse.copy(self.group.matrixWorld).invert();
      self.group.traverseVisible(this.drawnMesh);
      this.drawnTop=Math.max(this.drawnTop,loomTop(key)||-Infinity);
      if(Number.isFinite(this.drawnTop)){
        this.drawnScaleGoal=THREE.MathUtils.clamp(this.drawnTop/DRAWN_TOP,least,Math.max(least,SCALE_MOST));
        this.drawnBackGoal=THREE.MathUtils.clamp(-this.drawnMin-DRAWN_BACK,0,BACK_MOST);
      }else{this.drawnScaleGoal=least;this.drawnBackGoal=0;}
    }
    if(placed||key!==this.subject){this.drawnScale=this.drawnScaleGoal;this.drawnBack=this.drawnBackGoal;}
    else{const k=blend(DRAWN_RATE,dt);this.drawnScale+=(this.drawnScaleGoal-this.drawnScale)*k;this.drawnBack+=(this.drawnBackGoal-this.drawnBack)*k;}
  }
  private drawnMesh=(object:THREE.Object3D)=>{
    const mesh=object as THREE.SkinnedMesh,position=mesh.geometry?.getAttribute('position');
    if(!mesh.isSkinnedMesh||!position||/-ink$|occlusion-warm/.test(mesh.name))return;
    const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    if(!material||(material.transparent&&material.opacity<.5)||material.userData?.ink||material.depthWrite===false)return;
    const stride=Math.max(1,Math.floor(position.count/DRAWN_SAMPLES));
    for(let i=0;i<position.count;i+=stride){
      mesh.getVertexPosition(i,this.drawnCorner);mesh.localToWorld(this.drawnCorner).applyMatrix4(this.drawnInverse);
      this.drawnTop=Math.max(this.drawnTop,this.drawnCorner.y);this.drawnMin=Math.min(this.drawnMin,this.drawnCorner.z);
    }
  };
  private styleMix(classic:number,close:number){return this.styleBlend>0?classic+(close-classic)*this.styleBlend:classic;}
  private frame(dt:number,placed:boolean,self:Fighter,opponent:Fighter|undefined,bulk:number){
    const eye=this.desired,probe=this.probe,f=this.forward;
    const pitch=Math.atan2(probe.y-eye.y,Math.hypot(probe.x-eye.x,probe.z-eye.z));
    const frameTop=this.styleMix(FRAME_TOP,CLOSE_STYLE.top),myBottom=this.styleMix(MY_BOTTOM,CLOSE_STYLE.myBottom)+this.arenaBlend*(this.air*ARENA.sink+this.squeeze*ARENA.crop),foeBottom=this.styleMix(FOE_BOTTOM,CLOSE_STYLE.foeBottom),cardTop=this.styleMix(CARD_TOP,CLOSE_STYLE.cardTop);
    let tiltGoal=0,pullGoal=0;
    const me=self.group.position;
    if(placed||!(dt>0)||opponent!==this.lastBody){this.lastFoe=NaN;this.riseFoe=0;this.lastBody=opponent;}
    if(placed||!(dt>0)){this.lastMe=NaN;this.riseMe=0;}
    if(placed||self.state.grounded)this.floorMe=me.y;
    if(dt>0){
      this.riseMe=Number.isFinite(this.lastMe)?this.riseMe+((me.y-this.lastMe)/dt-this.riseMe)*blend(RISE_RATE,dt):0;this.lastMe=me.y;
      if(opponent){const y=this.foeBox.high;this.riseFoe=Number.isFinite(this.lastFoe)?this.riseFoe+((y-this.lastFoe)/dt-this.riseFoe)*blend(RISE_RATE,dt):0;this.lastFoe=y;}
    }
    let weight=0,shareFoe=foeBottom;
    if(opponent){
      const them=opponent.group.position,s=opponent.state;
      if(s.grounded)this.floorFoe=them.y;
      const lying=s.action==='knockdown'||s.action==='getup'||(s.action==='splat'&&s.grounded)||(s.action==='launched'&&!s.grounded&&this.riseFoe<0&&them.y-this.floorFoe<LIE_AHEAD);
      this.down=placed?(lying?1:0):this.down+((lying?1:0)-this.down)*blend(LIE_RATE,dt);
      this.reachMe=(me.x-eye.x)*f.x+(me.z-eye.z)*f.z;this.reachFoe=(them.x-eye.x)*f.x+(them.z-eye.z)*f.z;
      weight=this.framed*smooth(this.reachFoe,2,3.5);
      if(weight>0){
        const tan=Math.tan(THREE.MathUtils.degToRad(this.baseFov)/2),up=Math.atan(frameTop*tan);
        const box=this.foeBox,side=(box.x-eye.x)*this.right.x+(box.z-eye.z)*this.right.z+box.spread,depth=Math.max(.5,(box.x-eye.x)*f.x+(box.z-eye.z)*f.z);
        const card=smooth(side/(depth*tan*this.camera.aspect),CARD_LEFT-CARD_EASE,CARD_LEFT+CARD_EASE);
        shareFoe=THREE.MathUtils.lerp(foeBottom,cardTop,card)-LIE_MARGIN*this.down;
        const downMe=Math.atan(myBottom*tan),downFoe=Math.atan(shareFoe*tan);
        this.lowMe=this.meBox.low-eye.y;this.highMe=this.meBox.high-eye.y;
        const mb=this.meBox;this.lyingMe=smooth(mb.spread,SPREAD_FROM,SPREAD_FULL)*(REACTIONS.has(self.state.action)?1:1-this.arenaBlend);
        this.reachMeLow=Math.max(.5,THREE.MathUtils.lerp(this.reachMe,(mb.x-eye.x)*f.x+(mb.z-eye.z)*f.z-mb.spread,this.lyingMe));
        if(Number.isFinite(this.loomHigh)){
          const yaw=self.state.yaw,sx=me.x-Math.sin(yaw)*LOOM_BACK+Math.cos(yaw)*LOOM_LEFT,sz=me.z-Math.cos(yaw)*LOOM_BACK-Math.sin(yaw)*LOOM_LEFT;
          const reach=Math.max(.5,(sx-eye.x)*f.x+(sz-eye.z)*f.z);
          this.highMe=Math.max(this.highMe,(this.loomHigh-eye.y)*Math.max(this.reachMe,.5)/reach);
        }
        const rise=this.riseFoe,drop=self.state.grounded?0:THREE.MathUtils.clamp(.5*LAUNCH_FALL*LEAD*LEAD-this.riseMe*LEAD,0,Math.max(0,me.y-this.floorMe));
        const lead=(rise<=0?0:rise<LAUNCH_FALL*LEAD?rise*rise/(2*LAUNCH_FALL):rise*LEAD-.5*LAUNCH_FALL*LEAD*LEAD)+drop;
        this.lowFoe=box.low-eye.y;this.highFoe=box.high-eye.y+lead;
        let back=0;const most=PULL_MAX*(1-this.arenaBlend*(1-ARENA.pull));
        if(!this.bounds(0,up,downMe,downFoe)){
          if(!this.bounds(most,up,downMe,downFoe))back=most;
          else{let lo=0,hi=most;for(let i=0;i<12;i++){const mid=(lo+hi)/2;if(this.bounds(mid,up,downMe,downFoe))hi=mid;else lo=mid;}back=hi;}
        }
        this.bounds(this.pull.value*this.lockBlend,up,downMe,downFoe);
        const lower=Math.max(this.fromMe,this.fromFoe),upper=Math.min(this.toMe,this.toFoe);
        const want=lower<=upper?THREE.MathUtils.clamp(pitch,lower,upper):THREE.MathUtils.clamp(THREE.MathUtils.clamp(pitch,this.fromFoe,this.toFoe),this.fromMe,this.toMe);
        tiltGoal=weight*THREE.MathUtils.clamp(want-pitch,-TILT_DOWN,TILT_UP);
        pullGoal=this.edgeRoom>0?0:weight*back;
      }
    }
    if(placed){this.tilt.value=tiltGoal;this.pull.value=pullGoal;this.tilt.velocity=this.pull.velocity=0;this.landed=LAND_HOLD;}
    else{
      if(tiltGoal!==0||pullGoal!==0)this.landed=0;else this.landed+=dt;
      if(this.landed>0&&this.landed<LAND_HOLD&&weight>0){tiltGoal=this.tilt.value;pullGoal=this.pull.value;}
      const now=pitch+this.tilt.value*this.lockBlend,meOut=weight>0&&(now>this.toMe+.01||now<this.fromMe-.01);
      const easeTilt=!meOut&&Math.abs(tiltGoal)<Math.abs(this.tilt.value)&&tiltGoal*this.tilt.value>=0?LET_GO:1,easePull=pullGoal<this.pull.value?LET_GO:1;
      approach(this.tilt,tiltGoal,dt,TILT_SPEED*easeTilt,TILT_ACCEL,TILT_GAIN*easeTilt,this.turning,this.turnSteps);
      if(this.arenaBlend>0&&(this.tilt.value<-TILT_DOWN||this.tilt.value>TILT_UP)){this.tilt.value=THREE.MathUtils.clamp(this.tilt.value,-TILT_DOWN,TILT_UP);this.tilt.velocity=0;}
      approach(this.pull,pullGoal,dt,PULL_SPEED*easePull,PULL_ACCEL,PULL_GAIN*easePull);
    }
    const k=this.lockBlend,tilt=this.tilt.value*k,pull=this.pull.value*k;
    if(tilt!==0||pull!==0){
      eye.addScaledVector(f,-pull);this.camera.position.copy(eye);
      probe.y=eye.y+Math.hypot(probe.x-eye.x,probe.z-eye.z)*Math.tan(pitch+tilt);
    }
    let widenGoal=0;
    if(weight>0){
      const floorShare=THREE.MathUtils.lerp(foeBottom,Math.min(foeBottom,shareFoe),this.down);
      const box=this.foeBox,bx=box.x-eye.x,bz=box.z-eye.z,ahead=bx*f.x+bz*f.z;
      const across=Math.abs(bx*this.right.x+bz*this.right.z)+box.radius+box.spread;
      const side=ahead>.3?THREE.MathUtils.radToDeg(2*Math.atan(across/ahead/(SIDE_SHARE*this.camera.aspect))):0;
      let sideMe=0;
      if(this.lyingMe>0){
        const mb=this.meBox,mx=mb.x-eye.x,mz=mb.z-eye.z,front=mx*f.x+mz*f.z;
        if(front>.3)sideMe=this.lyingMe*Math.max(0,THREE.MathUtils.radToDeg(2*Math.atan((Math.abs(mx*this.right.x+mz*this.right.z)+mb.radius+mb.spread)/front/(SIDE_SHARE*this.camera.aspect)))-this.baseFov);
      }
      const look=pitch+tilt,need=Math.max(side,
        widenFor(this.highFoe,this.reachFoe+pull,look,frameTop),widenFor(this.highMe,this.reachMe+pull,look,frameTop),
        widenFor(-this.lowFoe,this.reachFoe+pull,-look,floorShare),widenFor(-this.lowMe,this.reachMeLow+pull,-look,myBottom));
      widenGoal=weight*THREE.MathUtils.clamp(Math.max(need-this.baseFov,sideMe),0,WIDEN_MOST+SQUEEZE_WIDEN*this.squeeze);
    }
    if(placed){this.widen.value=widenGoal;this.widen.velocity=0;}
    else{const ease=widenGoal<this.widen.value?LET_GO:1;approach(this.widen,widenGoal,dt,WIDEN_SPEED*ease,WIDEN_ACCEL,WIDEN_GAIN*ease);}
  }
  private measure(body:Fighter,bulk:number,out:Capsule){
    const joints=body.joints,p=body.group.position;let low=Infinity,high=-Infinity;
    out.x=p.x;out.z=p.z;out.radius=TORSO*bulk;out.spread=0;
    if(joints&&body.model?.visible!==false){
      let seen=0;
      for(let i=0;i<SPAN_JOINTS.length;i++){
        const name=SPAN_JOINTS[i],bone=joints.get(name);if(!bone)continue;
        bone.getWorldPosition(this.joint);const pad=name==='Head'?HEAD_PAD*bulk:SOLE_PAD;
        low=Math.min(low,this.joint.y-pad);high=Math.max(high,this.joint.y+pad);
        if(name==='Head'){out.x=this.joint.x;out.z=this.joint.z;}
        this.spanX[seen]=this.joint.x;this.spanZ[seen++]=this.joint.z;
      }
      const hips=joints.get('Hips');
      if(hips&&joints.get('Head')){hips.getWorldPosition(this.joint);out.x=(out.x+this.joint.x)/2;out.z=(out.z+this.joint.z)/2;}
      else{out.x=p.x;out.z=p.z;}
      for(let i=0;i<seen;i++)out.spread=Math.max(out.spread,Math.hypot(this.spanX[i]-out.x,this.spanZ[i]-out.z));
    }
    if(!(high>=low)){low=p.y;high=p.y+CROWN*bulk;}
    else if(high-low<LIE_SPAN*bulk)high=low+LIE_SPAN*bulk;
    out.low=low;out.high=high;
  }
  private bounds(back:number,up:number,downMe:number,downFoe:number){
    this.fromMe=Math.atan2(this.highMe,this.reachMe+back)-up;this.toMe=Math.atan2(this.lowMe,this.reachMeLow+back)+downMe;
    this.fromFoe=Math.atan2(this.highFoe,this.reachFoe+back)-up;this.toFoe=Math.atan2(this.lowFoe,this.reachFoe+back)+downFoe;
    return Math.max(this.fromMe,this.fromFoe)<=Math.min(this.toMe,this.toFoe);
  }

  private steer(dt:number,placed:boolean,self:Fighter,yaw:number,pitch:number,foe:Fighter|undefined,locked:boolean){
    const turn=placed?0:wrapped(yaw-this.inputYaw);
    if(placed){this.heading=yaw;this.assistVelocity=0;}
    else if(Math.abs(turn)>1e-6){this.heading+=turn;this.lastTurn=this.age;}
    const position=self.group.position;
    let gain=0,base=NaN;
    if(foe){
      const at=foe.group.position,dx=at.x-position.x,dz=at.z-position.z,distance=Math.hypot(dx,dz);
      this.far+=(smooth(distance,7,16)-this.far)*blend(3,dt);
      const air=THREE.MathUtils.clamp((at.y-position.y-.3)/2.2,0,1)*(1-smooth(distance,AIR_NEAR,AIR_FAR));
      if(air>=this.air-1e-6)this.airLanded=0;else this.airLanded+=dt;
      if(air>this.air||this.airLanded>=LAND_HOLD)this.air+=(air-this.air)*blend(air>this.air?9:3,dt);
      const range=locked?1-smooth(distance,HARD_NEAR,HARD_FAR):1-smooth(distance,SOFT_NEAR,SOFT_FAR);
      this.framed=range;
      const close=range*(1-smooth(distance,CLOSE_NEAR,CLOSE_FAR));
      this.close=placed?close:this.close+(close-this.close)*blend(close>this.close?CLOSE_IN:CLOSE_OUT,dt);
      gain=range*smooth(distance,DEAD_ZONE,FULL_ASSIST)*smooth(this.age-this.lastTurn,YIELD_AFTER,YIELD_AFTER+YIELD_OVER);
      const swinging=SWINGS.has(self.state.action)&&distance<ENGAGE_RANGE;
      this.engage+=((swinging?1:0)-this.engage)*blend(swinging?ENGAGE_IN:ENGAGE_OUT,dt);
      if(distance>1e-3){const bearing=Math.atan2(dx,dz);base=framingHeading(bearing,distance,this.shoulder,this.boom*Math.cos(pitch),MAX_OFFSET+ENGAGE_OFFSET*this.engage,THREE.MathUtils.lerp(FOE_ANGLE,FOX_FOE,this.foxness));this.offAxis=base-bearing;}
    }else{this.far-=this.far*blend(3,dt);this.close-=this.close*blend(CLOSE_OUT,dt);this.air-=this.air*blend(5,dt);this.framed=0;this.engage-=this.engage*blend(ENGAGE_OUT,dt);}
    if(this.hold>0||self.state.hitstop)gain=0;
    if(foe&&Number.isFinite(base)){if(gain>0)this.clearView(dt,base,pitch);}
    else{this.dodgeGoal=0;approach(this.dodge,0,dt,DODGE_SPEED,DODGE_ACCEL,DODGE_GAIN);}
    const want=Number.isFinite(base)?base+this.dodge.value:this.heading;
    const before=this.assistVelocity;
    if(this.age-this.lastTurn<YIELD_AFTER)this.assistVelocity*=Math.exp(-25*dt);
    this.assist=gain;this.turnSteps=0;
    if(!placed){
      let last=before;
      let error=wrapped(want-this.heading);
      if(Math.abs(error)>2.6&&Math.abs(this.assistVelocity)>.2&&Math.sign(error)!==Math.sign(this.assistVelocity))error+=Math.sign(this.assistVelocity)*Math.PI*2;
      const strain=gain*smooth(Math.abs(error),STRAIN_FROM,STRAIN_TO);
      this.strain+=(strain-this.strain)*blend(strain>this.strain?STRAIN_IN:STRAIN_OUT,dt);
      for(let left=dt;left>1e-9;left-=ASSIST_STEP){
        const h=Math.min(ASSIST_STEP,left),size=Math.abs(error);
        const wanted=gain*Math.sign(error)*Math.min(ASSIST_SPEED,Math.sqrt(1.8*ASSIST_ACCEL*size),ASSIST_GAIN*size);
        this.assistVelocity+=THREE.MathUtils.clamp(wanted-this.assistVelocity,-ASSIST_ACCEL*h,ASSIST_ACCEL*h);
        if(this.turnSteps<this.turning.length)this.turning[this.turnSteps++]=Math.abs(this.assistVelocity-last)/h;
        last=this.assistVelocity;
        const step=this.assistVelocity*h;this.heading+=step;error-=step;
      }
    }
    else this.strain=0;
    this.inputYaw=this.heading;
  }

  private steerDynamic(dt:number,placed:boolean,self:Fighter,yaw:number,pitch:number,tilted:boolean,foe:Fighter|undefined,locked:boolean){
    const turn=placed?0:wrapped(yaw-this.inputYaw);
    if(placed){this.heading=yaw;this.brain.reset();this.autoTurn=this.autoShown=0;this.inputPitch=pitch;}
    else if(Math.abs(turn)>1e-6){this.heading+=turn;this.lastTurn=this.age;}
    this.turnMemory=this.turnMemory*Math.exp(-dt/TURN_MEMORY)+Math.abs(turn);
    const position=self.group.position;
    let bearing=NaN,closeMelee=false;
    if(foe){
      const at=foe.group.position,dx=at.x-position.x,dz=at.z-position.z,distance=Math.hypot(dx,dz);
      closeMelee=!!self.state.grounded&&!!foe.state.grounded&&distance<ENGAGE_RANGE;
      this.far+=(smooth(distance,7,16)-this.far)*blend(3,dt);
      const air=THREE.MathUtils.clamp((at.y-position.y-.3)/2.2,0,1)*(1-smooth(distance,AIR_NEAR,AIR_FAR));
      if(air>=this.air-1e-6)this.airLanded=0;else this.airLanded+=dt;
      if(air>this.air||this.airLanded>=LAND_HOLD)this.air+=(air-this.air)*blend(air>this.air?9:3,dt);
      const range=locked?1-smooth(distance,HARD_NEAR,HARD_FAR):1-smooth(distance,SOFT_NEAR,SOFT_FAR);
      this.framed=range;
      const close=range*(1-smooth(distance,CLOSE_NEAR,CLOSE_FAR));
      this.close=placed?close:this.close+(close-this.close)*blend(close>this.close?CLOSE_IN:CLOSE_OUT,dt);
      const swinging=SWINGS.has(self.state.action)&&distance<ENGAGE_RANGE;
      this.engage+=((swinging?1:0)-this.engage)*blend(swinging?ENGAGE_IN:ENGAGE_OUT,dt);
      if(distance>1e-3)bearing=Math.atan2(dx,dz);
    }else{this.far-=this.far*blend(3,dt);this.close-=this.close*blend(CLOSE_OUT,dt);this.air-=this.air*blend(5,dt);this.framed=0;this.engage-=this.engage*blend(ENGAGE_OUT,dt);}
    this.trackVelocity(dt,placed,position);
    const i=this.brainIn,s=self.state;
    i.dt=placed?0:dt;i.x=position.x;i.y=position.y;i.z=position.z;i.vx=this.travel.x;i.vz=this.travel.z;
    i.grounded=!!s.grounded;i.dashing=s.action==='dash';i.plunging=plunging(s);i.reacting=REACTIONS.has(s.action);i.basisHeld=this.basisMask>0;
    i.heading=this.heading;i.back=Math.max(.5,this.boom*Math.cos(pitch));i.shoulder=this.shoulder;i.tanH=this.tanH;
    if(this.squeeze>0){const keep=1-this.squeeze;i.lensBack=Math.max(.5,this.boom*keep*Math.cos(pitch));i.lensShoulder=this.shoulder*Math.pow(keep,SQUEEZE_SIDE);}else i.lensBack=i.lensShoulder=NaN;
    i.manual=turn;i.tilted=tilted;i.locked=locked;i.engage=this.engage;i.foe=THREE.MathUtils.lerp(FOE_ANGLE,FOX_FOE,this.foxness);
    i.pending=this.focusHint.pending;i.pendingShare=this.focusHint.share;i.floor=Number.isFinite(this.floorMe)?this.floorMe:position.y;i.form=this.foxness;
    const focusOf=foe?.state.id??'';if(focusOf!==this.focusOf){if(this.focusOf&&focusOf)this.dodgeGoal=0;this.focusOf=focusOf;}
    this.gatherSubjects(self,foe);
    const b=this.brain;b.think(i);
    const frozen=this.hold>0||!!s.hitstop;
    const closeDuel=closeMelee&&b.mode==='duel'&&this.director.kind==='none'&&!this.cuts.owns;
    let base=b.goal;
    if(foe&&Number.isFinite(base)&&Number.isFinite(bearing)){
      this.offAxis=wrapped(base-bearing);
      if(b.gain>0&&!frozen)this.clearView(dt,base,pitch,closeDuel);
    }
    else{this.dodgeGoal=0;approach(this.dodge,0,dt,DODGE_SPEED,DODGE_ACCEL,DODGE_GAIN);}
    this.framingGoal=base;
    const hidden=this.rig.cover;
    this.uncover=!!foe&&!frozen&&(hidden>MELEE_COVER_ENTER||(this.uncover&&hidden>MELEE_COVER_EXIT));
    if(this.uncover||this.dodgeGoal!==0||Math.abs(this.dodge.value)>.02)b.exact(this.uncover);
    let want=Number.isFinite(base)?base+this.dodge.value:NaN;
    if(closeDuel&&Math.abs(this.offAxis)<=ALPHA_MOST)want=base+THREE.MathUtils.clamp(this.dodge.value,-ALPHA_MOST-this.offAxis,ALPHA_MOST-this.offAxis);
    const before=this.heading;this.turnSteps=0;
    if(!placed){this.heading=b.steer(this.heading,want,dt,frozen,this.turning);this.turnSteps=b.traced;}
    if(this.basisMask>0)this.autoTurn+=this.heading-before;
    const strain=placed?0:b.gain*smooth(Number.isFinite(want)?Math.abs(b.past(wrapped(want-this.heading))):0,STRAIN_FROM,STRAIN_TO);
    this.strain=placed?0:this.strain+(strain-this.strain)*blend(strain>this.strain?STRAIN_IN:STRAIN_OUT,dt);
    this.assist=b.gain;
    this.inputYaw=this.heading;
    if(!placed)this.inputPitch=Number.isFinite(b.pitchGoal)?THREE.MathUtils.clamp(pitch+(b.pitchGoal-pitch)*blend(b.pitchRate,dt),-.28,.72):pitch;
  }
  private steerArena(dt:number,placed:boolean,self:Fighter,yaw:number,pitch:number,tilted:boolean,foe:Fighter|undefined,locked:boolean){
    const turn=placed?0:wrapped(yaw-this.inputYaw);
    if(placed){this.heading=yaw;this.brain.reset();this.autoTurn=this.autoShown=0;this.inputPitch=pitch;this.assistVelocity=0;this.away=this.awayBasis=0;this.urgent=0;this.bearingRate=0;this.lastBearing=NaN;this.sideFrom=this.sideEase=this.arenaSide;this.behindFor=0;this.showing=false;this.sideAt=-Infinity;}
    else if(Math.abs(turn)>1e-6){
      this.heading+=turn;
      if(Math.abs(turn)>ARENA.idle*dt){this.awayBasis+=turn;this.basisHeld+=turn;this.lastTurn=this.age;}
    }
    this.turnMemory=this.turnMemory*Math.exp(-dt/TURN_MEMORY)+Math.abs(turn);
    const position=self.group.position;
    let bearing=NaN,distance=0;
    if(foe){
      const at=foe.group.position,dx=at.x-position.x,dz=at.z-position.z;distance=Math.hypot(dx,dz);
      this.far+=(smooth(distance,7,16)-this.far)*blend(3,dt);
      const air=THREE.MathUtils.clamp((at.y-position.y-.3)/2.2,0,1)*(1-smooth(distance,AIR_NEAR,AIR_FAR));
      if(air>=this.air-1e-6)this.airLanded=0;else this.airLanded+=dt;
      if(air>this.air||this.airLanded>=LAND_HOLD)this.air+=(air-this.air)*blend(air>this.air?9:3,dt);
      const range=this.sole?1:locked?1-smooth(distance,HARD_NEAR,HARD_FAR):1-smooth(distance,SOFT_NEAR,SOFT_FAR);
      this.framed=range;
      const close=range*(1-smooth(distance,CLOSE_NEAR,CLOSE_FAR));
      this.close=placed?close:this.close+(close-this.close)*blend(close>this.close?CLOSE_IN:CLOSE_OUT,dt);
      const swinging=SWINGS.has(self.state.action)&&distance<ENGAGE_RANGE;
      this.engage+=((swinging?1:0)-this.engage)*blend(swinging?ENGAGE_IN:ENGAGE_OUT,dt);
      if(distance>=DEAD_ZONE)bearing=Math.atan2(dx,dz);
    }else{this.far-=this.far*blend(3,dt);this.close-=this.close*blend(CLOSE_OUT,dt);this.air-=this.air*blend(5,dt);this.framed=0;this.engage-=this.engage*blend(ENGAGE_OUT,dt);}
    this.trackVelocity(dt,placed,position);
    const i=this.brainIn,s=self.state;
    i.dt=placed?0:dt;i.x=position.x;i.y=position.y;i.z=position.z;i.vx=this.travel.x;i.vz=this.travel.z;
    i.grounded=!!s.grounded;i.dashing=s.action==='dash';i.plunging=plunging(s);i.reacting=REACTIONS.has(s.action);i.basisHeld=this.basisMask>0;
    i.heading=this.heading;i.back=Math.max(.5,this.boom*Math.cos(pitch));i.shoulder=this.shoulder;i.tanH=this.tanH;i.lensBack=i.lensShoulder=NaN;
    i.manual=turn;i.tilted=tilted;i.locked=locked||this.sole;i.engage=this.engage;i.foe=ARENA.foe;
    i.pending=this.focusHint.pending;i.pendingShare=this.focusHint.share;i.floor=Number.isFinite(this.floorMe)?this.floorMe:position.y;i.form=this.foxness;
    this.gatherSubjects(self,foe);
    const b=this.brain;b.think(i);b.settle();
    const frozen=this.hold>0||!!s.hitstop,id=foe?.state.id??'';
    if(id!==this.holdId){if(id&&this.holdId&&!placed)this.changedAt=this.age;this.holdId=id;this.lastBearing=NaN;this.bearingRate=0;this.behindFor=0;this.showing=false;}
    this.holding=foe?this.framed:0;
    if(Number.isFinite(bearing)){
      if(Number.isFinite(this.lastBearing)&&dt>0){const jump=wrapped(bearing-this.lastBearing);this.bearingRate=Math.abs(jump)<.6?this.bearingRate+(THREE.MathUtils.clamp(jump/dt,-ARENA.fast,ARENA.fast)-this.bearingRate)*blend(8,dt):0;}
      this.lastBearing=bearing;this.holdBearing=bearing;
    }else this.bearingRate=0;
    const held=foe&&Number.isFinite(bearing)?this.framed*smooth(distance,DEAD_ZONE,FULL_ASSIST):0;
    const mine=smooth(this.age-this.lastTurn,YIELD_AFTER,YIELD_AFTER+YIELD_OVER),before=this.heading;
    let error=0,gain=0,speed:number=ARENA.speed,accel:number=ARENA.accel,lead=0;
    this.turnSteps=0;
    if(held>0&&foe){
      const melee=1-smooth(distance,ARENA.near,ARENA.far),shoulder=Math.max(1e-3,Math.abs(this.shoulder)-this.slideNow),back=Math.max(.5,this.boom*Math.cos(pitch));
      const alpha=framingHeading(0,distance,shoulder,back,MAX_OFFSET+ENGAGE_OFFSET*this.engage,ARENA.foe);
      let own=placed?this.arenaSide*alpha:wrapped(this.heading-this.away-bearing);
      const way=Math.sign(own)||this.arenaSide;
      const hand=shoulder<ARENA.hand,wanted=Math.abs(own)>ARENA.flip?way:this.arenaSide;
      if(!placed&&!hand&&wanted!==this.arenaSide&&this.age-this.sideAt>=ARENA.sideRest){this.sideFrom=this.sideEase;this.arenaSide=wanted;this.sideAt=this.age;}
      const side=hand?wanted:this.arenaSide;
      this.behindFor=melee>0&&Math.abs(own)<ARENA.inner&&!frozen?this.behindFor+dt:0;
      this.showing=melee>0&&Math.abs(own)<(this.showing?ARENA.show:ARENA.inner)&&(this.showing||this.behindFor>=ARENA.behind);
      const lo=THREE.MathUtils.lerp(alpha,this.showing?Math.min(alpha,ARENA.show):0,melee),hi=THREE.MathUtils.lerp(alpha,Math.max(alpha,ARENA.outer),melee);
      own=side*THREE.MathUtils.clamp(side*own,lo,hi);
      if(this.stageBounds&&!this.battlefield)own=this.slideAlong(position,bearing,own,lo,hi,distance,back,shoulder);else{this.slideSide=0;this.sliding=false;}
      this.own=own;
      if(placed)this.heading=bearing+own;
      if(mine<1&&!placed)this.away=wrapped(this.heading-bearing-own);
      else{this.away-=this.away*blend(ARENA.away,dt);if(Math.abs(this.away)<1e-4)this.away=0;}
      if(this.basisMask===0)this.awayBasis=this.away;
      error=wrapped(bearing+own+this.away-this.heading);
      const x=across(foe.group.position.x,foe.group.position.z,position.x,position.z,this.heading,back,this.shoulder,this.tanH);
      this.urgent+=((Math.abs(x)<=1?0:1)-this.urgent)*blend(Math.abs(x)<=1?6:8,dt);
      speed=ARENA.speed+(ARENA.fast-ARENA.speed)*this.urgent;accel=ARENA.accel+(ARENA.fastAccel-ARENA.accel)*this.urgent;
      const pan=1-smooth(this.age-this.changedAt,ARENA.panFor*.5,ARENA.panFor);
      if(pan>0){speed=THREE.MathUtils.lerp(speed,Math.min(speed,ARENA.pan),pan);accel=THREE.MathUtils.lerp(accel,Math.min(accel,ARENA.panAccel),pan);}
      gain=held*mine;
      lead=melee<=0?ARENA.lead*this.bearingRate*held*mine:0;
    }else{
      this.urgent-=this.urgent*blend(6,dt);this.slideSide=0;this.sliding=false;this.behindFor=0;this.showing=false;
      if(!foe){
        this.away=this.own=0;if(this.basisMask===0)this.awayBasis=0;
        if(this.arenaSide!==1&&this.age-this.sideAt>=ARENA.sideRest){this.sideFrom=this.sideEase;this.arenaSide=1;this.sideAt=this.age;}
      }
    }
    this.sideEase=this.sideFrom+(this.arenaSide-this.sideFrom)*smooth(this.age-this.sideAt,0,ARENA.sideTime);
    if(placed){this.slideEase.value=this.slideSide;this.slideEase.velocity=0;}else approach(this.slideEase,this.slideSide,dt,3,14,6);
    if(this.age-this.lastTurn<YIELD_AFTER)this.assistVelocity*=Math.exp(-25*dt);
    if(!placed){
      for(let left=dt;left>1e-9;left-=ASSIST_STEP){
        const h=Math.min(ASSIST_STEP,left),size=Math.abs(error),last=this.assistVelocity;
        const wanted=frozen?0:gain*THREE.MathUtils.clamp(Math.sign(error)*Math.min(speed,Math.sqrt(1.8*accel*size),ARENA.gain*size)+lead,-speed,speed);
        this.assistVelocity+=THREE.MathUtils.clamp(wanted-this.assistVelocity,-accel*h,accel*h);
        if(this.turnSteps<this.turning.length)this.turning[this.turnSteps++]=Math.abs(this.assistVelocity-last)/h/accel*ARENA.tilt*SHARED*ASSIST_ACCEL;
        const step=this.assistVelocity*h;this.heading+=step;error-=step;
      }
    }
    if(this.basisMask>0)this.autoTurn+=this.heading-before;
    this.dodgeGoal=0;approach(this.dodge,0,dt,DODGE_SPEED,DODGE_ACCEL,DODGE_GAIN);
    this.offAxis=this.own;this.framingGoal=Number.isFinite(bearing)?bearing+this.own:NaN;
    const strain=placed?0:gain*smooth(Math.abs(error),STRAIN_FROM,STRAIN_TO);
    this.strain=placed?0:this.strain+(strain-this.strain)*blend(strain>this.strain?STRAIN_IN:STRAIN_OUT,dt);
    this.assist=held;
    this.inputYaw=this.heading;
    if(!placed)this.inputPitch=Number.isFinite(b.pitchGoal)?THREE.MathUtils.clamp(pitch+(b.pitchGoal-pitch)*blend(b.pitchRate,dt),-.28,.72):pitch;
  }
  private pastBound(p:THREE.Vector3,bearing:number,off:number,back:number,shoulder:number,spare=0){
    const b=this.stageBounds!,out=boundOut(b,this.battlefield)-ARENA.slideSoft-spare,h=bearing+off+this.away,sh=Math.sin(h),ch=Math.cos(h),s=shoulder*(Math.sign(off)||this.arenaSide);
    return Math.max(0,Math.abs(p.x-sh*back-ch*s)-(b.halfX+out),Math.abs(p.z-ch*back+sh*s)-(b.halfZ+out));
  }
  private shoulderAt(off:number,hi:number,gap:number,shoulder:number){
    const size=Math.abs(off),over=smooth(size,hi,hi+ARENA.slideOver);
    return over>0?shoulder+Math.max(0,Math.min(ARENA.slideSide,gap/2*Math.sin(Math.min(size,Math.PI/2)))-shoulder)*over:shoulder;
  }
  private slideAlong(p:THREE.Vector3,bearing:number,own:number,lo:number,hi:number,gap:number,back:number,shoulder:number){
    this.slideSide=0;
    let least=this.pastBound(p,bearing,own,back,shoulder,this.sliding?ARENA.slideBack:0);
    if(least<=0){this.sliding=false;return own;}
    this.sliding=true;least=this.pastBound(p,bearing,own,back,shoulder);
    const first=Math.sign(own)||this.arenaSide;
    const across=(off:number,s:number)=>Math.abs(off)<=Math.max(hi,Math.abs(own))?0:(gap*Math.sin(Math.abs(off))-s)/((back+gap*Math.cos(Math.abs(off)))*this.tanH);
    let best=own,side=shoulder,near=Infinity,nearOff=own,nearSide=shoulder,other=NaN,otherSide=shoulder;
    for(let k=1;k*ARENA.slideStep<=2*ARENA.slideMost+1e-9;k++)for(let way=1;way>=-1;way-=2){
      const off=own+way*first*k*ARENA.slideStep,size=Math.abs(off),same=Math.sign(off)===first;
      if(size>ARENA.slideMost||size<lo||(!same&&Number.isFinite(other)))continue;
      const s=this.shoulderAt(off,hi,gap,shoulder),at=across(off,s);
      if(at>ARENA.slideEdge)continue;
      const past=this.pastBound(p,bearing,off,back,s);
      if(past<=0){
        let out=off-way*first*ARENA.slideStep,inside=off;
        if(Math.sign(out)===Math.sign(inside))for(let n=0;n<8;n++){const mid=(out+inside)/2;if(this.pastBound(p,bearing,mid,back,this.shoulderAt(mid,hi,gap,shoulder))<=0)inside=mid;else out=mid;}
        if(same){this.slideSide=this.shoulderAt(inside,hi,gap,shoulder)-shoulder;return inside;}
        other=inside;otherSide=this.shoulderAt(inside,hi,gap,shoulder);continue;
      }
      if(same&&past<near){near=past;nearOff=off;nearSide=s;}
      if(past<least&&at<=ARENA.slideTight){least=past;best=off;side=s;}
    }
    if(near<=ARENA.slideNear){this.slideSide=nearSide-shoulder;return nearOff;}
    if(Number.isFinite(other)){this.slideSide=otherSide-shoulder;return other;}
    this.slideSide=side-shoulder;
    return best;
  }
  private bigness(){return Math.max(this.foxness,smooth(this.drawnScale,BIG_FROM,BIG_FULL));}
  private resample(dt:number,self:Fighter){
    if(this.basisMask===0){this.settledFor=this.blockedFor=0;return;}
    const s=self.state,speed=Math.hypot(this.travel.x,this.travel.z);
    this.blockedFor=s.grounded&&RUNNING.has(s.action)&&speed<BLOCKED_SPEED?this.blockedFor+dt:0;
    if(this.blockedFor>=BLOCKED_AFTER){
      if(this.latchBlend>0)this.autoTurn-=this.autoTurn*blend(CLOSE_STYLE.blockRate,dt);else this.autoTurn=this.autoShown=0;
      this.settledFor=0;return;
    }
    const framing=this.brain.mode==='duel'||this.brain.mode==='group';
    this.settledFor=framing&&Math.abs(this.arenaBlend>.5?this.assistVelocity:this.brain.velocity)<SETTLED_SPEED&&!this.brain.switchActive?this.settledFor+dt:0;
    if(this.settledFor>=SETTLED_AFTER){this.autoTurn-=this.autoTurn*blend(BASIS_CATCH,dt);if(Math.abs(this.autoTurn)<1e-4)this.autoTurn=0;}
    if(this.latchBlend>0&&framing){const over=Math.abs(this.autoTurn)-CLOSE_STYLE.latchMost;if(over>0)this.autoTurn-=Math.sign(this.autoTurn)*over*blend(CLOSE_STYLE.latchRate,dt);}
  }
  private squeezeFor(dt:number,placed:boolean,pitch:number){
    const b=this.stageBounds;if(!b)return this.squeeze=0;
    const out=boundOut(b,this.battlefield),hard=this.squeezeNeed(b.halfX+out,b.halfZ+out,pitch),soft=this.squeezeNeed(b.halfX+out-SQUEEZE_SOFT,b.halfZ+out-SQUEEZE_SOFT,pitch)*SQUEEZE_EARLY;
    const goal=Math.max(hard,soft)*this.dynBlend;
    this.squeeze=placed?goal:Math.max(hard*this.dynBlend,this.squeeze+(goal-this.squeeze)*blend(goal>this.squeeze?SQUEEZE_IN:SQUEEZE_OUT,dt));
    if(this.squeeze<1e-4)this.squeeze=0;
    return this.squeeze;
  }
  private squeezeNeed(hx:number,hz:number,pitch:number){
    const f=this.forward,r=this.right,o=this.focus,back=this.boom*Math.cos(pitch),side=this.shoulder;
    const inside=(keep:number)=>{const k=Math.pow(keep,SQUEEZE_SIDE);return Math.abs(o.x-f.x*back*keep+r.x*side*k)<=hx&&Math.abs(o.z-f.z*back*keep+r.z*side*k)<=hz;};
    if(inside(1))return 0;
    let lo=1-SQUEEZE_MOST,hi=1;if(!inside(lo))return SQUEEZE_MOST;
    for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(inside(mid))lo=mid;else hi=mid;}
    return 1-lo;
  }
  private keepInside(after=false){
    const b=this.stageBounds,eye=this.camera.position;if(!b)return 0;
    const out=boundOut(b,this.battlefield);
    const hx=b.halfX+out,hz=b.halfZ+out;
    if(Math.abs(eye.x)<=hx&&Math.abs(eye.z)<=hz)return 0;
    let ux:number,uy:number,uz:number,length:number;
    if(after){this.camera.getWorldDirection(this.axis);ux=this.axis.x;uy=this.axis.y;uz=this.axis.z;length=BOUND_AFTER+BOUND_NEAREST;}
    else{const dx=this.probe.x-eye.x,dy=this.probe.y-eye.y,dz=this.probe.z-eye.z;length=Math.hypot(dx,dy,dz);if(!(length>1e-6))return 0;ux=dx/length;uy=dy/length;uz=dz/length;}
    let need=0;
    if(eye.x>hx){if(ux<-1e-4)need=Math.max(need,(eye.x-hx)/-ux);else return 0;}
    else if(eye.x<-hx){if(ux>1e-4)need=Math.max(need,(-hx-eye.x)/ux);else return 0;}
    if(eye.z>hz){if(uz<-1e-4)need=Math.max(need,(eye.z-hz)/-uz);else return 0;}
    else if(eye.z<-hz){if(uz>1e-4)need=Math.max(need,(-hz-eye.z)/uz);else return 0;}
    const move=Math.min(need,Math.max(0,length-BOUND_NEAREST))*this.dynBlend;
    eye.x+=ux*move;eye.y+=uy*move;eye.z+=uz*move;
    return move;
  }
  private gatherSubjects(self:Fighter,foe:Fighter|undefined){
    this.subjectCount=0;
    if(foe)this.fillSubject(this.nextSubject(),foe,self,true);
    const crowd=this.director.crowd;
    this.gatherSelf=self;this.gatherFoe=foe;
    crowd?.forEach(this.gatherSubject);this.extraSubjects?.forEach(this.gatherSubject);
    this.gatherSelf=this.gatherFoe=undefined;
    this.brainIn.subjects=this.subjects;this.brainIn.count=this.subjectCount;
  }
  private gatherSubject=(body:Pick<Fighter,'state'|'group'>)=>{
    const self=this.gatherSelf;
    if(!self||body===self||body===this.gatherFoe||!body.state.alive||!body.group.visible)return;
    if(self.state.team!==undefined&&body.state.team===self.state.team)return;
    const p=body.group.position,q=self.group.position;
    if(Math.hypot(p.x-q.x,p.z-q.z)>SUBJECT_RANGE)return;
    this.fillSubject(this.nextSubject(),body,self,false);
  };
  private nextSubject(){
    if(this.subjectCount>=this.subjects.length)this.subjects.push(subject());
    return this.subjects[this.subjectCount++];
  }
  private fillSubject(out:Subject,body:Pick<Fighter,'state'|'group'>,self:Fighter,target:boolean){
    const s=body.state,p=body.group.position,q=self.group.position,enemy=s.enemy?ENEMIES[s.enemy]:undefined;
    const bulk=enemy?enemy.height/CROWN:bodyBulk(s),distance=Math.hypot(p.x-q.x,p.z-q.z);
    out.id=s.id;out.x=p.x;out.y=p.y;out.z=p.z;out.high=CROWN*bulk;out.radius=TORSO*bulk;out.target=target;
    const swing=ATTACKS.has(s.action);
    out.attacking=swing&&s.target===self.state.id&&distance<(castThreat(s).move?.range??3)+3;
    out.hitAgo=this.director.hitAgo(s.id);
    out.airborne=!s.grounded;out.lying=s.action==='knockdown'||s.action==='getup'||(s.action==='splat'&&s.grounded);out.launched=s.action==='launched';
  }
  private trackVelocity(dt:number,placed:boolean,p:THREE.Vector3){
    if(placed||!this.rooted){this.travel.set(0,0,0);this.lastRoot.copy(p);this.rooted=true;return;}
    if(!(dt>0))return;
    const dx=p.x-this.lastRoot.x,dz=p.z-this.lastRoot.z;this.lastRoot.copy(p);
    if(dx*dx+dz*dz>TELEPORT*TELEPORT){this.travel.set(0,0,0);return;}
    const k=blend(VELOCITY_RATE,dt);this.travel.x+=(dx/dt-this.travel.x)*k;this.travel.z+=(dz/dt-this.travel.z)*k;
  }
  private playShots(dt:number,self:Fighter,shot:number){
    const falling=plunging(self.state);
    if(this.wasPlunging&&!falling&&self.state.action==='special')this.cuePlay('smash',true,self);
    this.wasPlunging=falling;
    const director=this.director;
    for(let k=0;k<director.cueCount;k++)this.cuePlay(director.cues[k].kind,director.cues[k].ender,self);
    director.cueCount=0;
    if(!this.play)return 0;
    this.playT+=dt;
    if(this.playT>=PLAY_LENGTH[this.play]){this.play=null;return 0;}
    const s=playShape(this.play,this.playT),w=(1-shot)*(this.smartOn?0:this.dynBlend);
    if(!(w>0))return 0;
    this.camera.getWorldDirection(this.axis);
    this.camera.position.addScaledVector(this.axis,-s.back*w).addScaledVector(UP,s.up*w);
    if(s.tilt!==0)this.camera.rotateX(-s.tilt*w);
    if(s.turn!==0)this.camera.rotateY(-s.turn*this.playSide*w);
    return s.fov*w;
  }
  private cuePlay(kind:PlayKind,ender:boolean,self:Fighter){
    if(!this.cinematics||this.smartOn||this.dynBlend<.5)return;
    if(!this.shots.allow(this.age,self.state.action==='light',ender,this.director.kind!=='none'))return;
    this.play=kind;this.playT=0;
    const foe=this.lastBody;if(foe){const p=foe.group.position,c=this.camera.position;this.playSide=(p.x-c.x)*this.right.x+(p.z-c.z)*this.right.z>=0?1:-1;}
    const trauma=playShape(kind,0).trauma;if(trauma>0)this.trauma=Math.min(.8,Math.max(this.trauma,trauma));
  }

  private clearView(dt:number,base:number,pitch:number,closeMelee=false){
    this.dodgeWait=Math.max(0,this.dodgeWait-dt);
    if(closeMelee&&Math.abs(this.offAxis)<=ALPHA_MOST)this.dodgeGoal=THREE.MathUtils.clamp(this.dodgeGoal,
      Math.max(-DODGE_MOST,-ALPHA_MOST-this.offAxis),Math.min(DODGE_MOST,ALPHA_MOST-this.offAxis));
    const enter=closeMelee?MELEE_COVER_ENTER:COVER_ENTER,exit=closeMelee?MELEE_COVER_EXIT:COVER_EXIT;
    const current=closeMelee?this.coverage(this.yaw,pitch):0;
    const goal=base+this.dodgeGoal,goalCover=this.coverage(goal,pitch);
    if(goalCover>enter||(closeMelee&&current>enter&&goalCover>exit)){
      const way=this.dodgeGoal!==0?Math.sign(this.dodgeGoal):this.awayFrom>=0?1:-1;
      let found=false,best=this.dodgeGoal,least=closeMelee?goalCover*DODGE_SETTLE:Math.min(goalCover,enter*DODGE_SETTLE);
      for(let k=1;k*DODGE_STEP<=2*DODGE_MOST+1e-9&&!found;k++){
        for(let side=0;side<2&&!found;side++){
          const offset=this.dodgeGoal+(side?-way:way)*k*DODGE_STEP;
          if(!this.dodgeAllowed(offset))continue;
          const hidden=this.coverage(base+offset,pitch);
          if(hidden<exit){this.dodgeGoal=offset;found=true;}
          else if(hidden<least){least=hidden;best=offset;}
        }
      }
      if(!found)this.dodgeGoal=best;
      this.dodgeWait=DODGE_WAIT;
    }else if(this.dodgeGoal!==0&&this.dodgeWait<=0&&(!closeMelee||current<exit)&&this.coverage(this.heading,pitch)<exit){
      const back=this.dodgeGoal-Math.sign(this.dodgeGoal)*Math.min(DODGE_STEP,Math.abs(this.dodgeGoal));
      if(this.coverage(base+back,pitch)<exit){this.dodgeGoal=Math.abs(back)<1e-9?0:back;this.dodgeWait=DODGE_WAIT;}
    }
    approach(this.dodge,this.dodgeGoal,dt,DODGE_SPEED,DODGE_ACCEL,DODGE_GAIN);
  }
  private dodgeAllowed(offset:number){return Math.abs(offset)<=DODGE_MOST+1e-9&&Math.abs(this.offAxis+offset)<=ALPHA_MOST;}
  private gather(self:Fighter,foe:Fighter){
    this.blockerCount=0;
    const mine=this.nextBlocker();mine.x=this.meBox.x;mine.z=this.meBox.z;mine.low=this.meBox.low;mine.high=this.meBox.high;mine.radius=this.meBox.radius;
    const s=self.state,heavy=STAND_HEAVY[s.fighter];
    const ender=!!s.branch&&(s.action==='heavy'||s.action==='special');
    if(heavy!==undefined&&s.alive&&!s.awakened&&!ender&&(s.action==='special'||s.action==='ultimate'||(s.action==='heavy'&&heavy))){
      const p=self.group.position,q=foe.group.position,forward=THREE.MathUtils.clamp(Math.hypot(q.x-p.x,q.z-p.z)-1.35,STAND_NEAR,STAND_FAR);
      const stand=this.nextBlocker();stand.x=p.x+Math.sin(s.yaw)*forward-Math.cos(s.yaw)*STAND_SIDE;stand.z=p.z+Math.cos(s.yaw)*forward+Math.sin(s.yaw)*STAND_SIDE;
      stand.low=p.y;stand.high=p.y+STAND_HEIGHT;stand.radius=STAND_RADIUS;
    }
    const crowd=this.director.crowd;
    if(crowd&&crowd.size>2){this.gatherSelf=self;this.gatherFoe=foe;crowd.forEach(this.gatherOne);this.gatherSelf=this.gatherFoe=undefined;}
  }
  private gatherOne=(body:Fighter)=>{
    if(body===this.gatherSelf||body===this.gatherFoe||!body.state.alive||!body.group.visible)return;
    const p=body.group.position,bulk=bodyBulk(body.state),box=this.nextBlocker();
    box.x=p.x;box.z=p.z;box.low=p.y;box.high=p.y+CROWN*bulk;box.radius=TORSO*bulk;
  };
  private nextBlocker(){
    if(this.blockerCount>=this.blockers.length)this.blockers.push(capsule());
    return this.blockers[this.blockerCount++];
  }
  private coverage(heading:number,pitch:number){
    const sh=Math.sin(heading),ch=Math.cos(heading),back=this.boom*Math.cos(pitch)+this.pull.value*this.lockBlend,a=this.anchor;
    const ex=a.x-sh*back-ch*this.shoulder,ez=a.z-ch*back+sh*this.shoulder,ey=this.lensY;
    const cp=Math.cos(this.lookPitch),sp=Math.sin(this.lookPitch);
    this.coverMine=0;
    if(!this.rect(this.foeBox,ex,ey,ez,sh,ch,cp,sp))return 0;
    const x0=this.rX0,x1=this.rX1,y0=this.rY0,y1=this.rY1,depth=this.rDepth,area=(x1-x0)*(y1-y0);
    if(!(area>1e-9))return 0;
    let covered=0,biggest=0;
    for(let i=0;i<this.blockerCount;i++){
      if(!this.rect(this.blockers[i],ex,ey,ez,sh,ch,cp,sp)||this.rDepth>=depth)continue;
      const w=Math.min(x1,this.rX1)-Math.max(x0,this.rX0),h=Math.min(y1,this.rY1)-Math.max(y0,this.rY0);
      if(w<=0||h<=0)continue;
      covered+=w*h;
      if(i===0)this.coverMine=Math.min(1,w*h/area);
      if(w*h>biggest){biggest=w*h;this.awayFrom=(x0+x1)/2-(this.rX0+this.rX1)/2;}
    }
    return Math.min(1,covered/area);
  }
  private rect(box:Capsule,ex:number,ey:number,ez:number,sh:number,ch:number,cp:number,sp:number){
    const dx=box.x-ex,dz=box.z-ez,flat=dx*sh+dz*ch,across=dz*sh-dx*ch;
    const top=box.high-ey,low=box.low-ey,mid=(top+low)/2;
    const depth=flat*cp+mid*sp;if(depth<NEAR_DEPTH)return false;
    const dTop=Math.max(NEAR_DEPTH,flat*cp+top*sp),dLow=Math.max(NEAR_DEPTH,flat*cp+low*sp);
    const yTop=(top*cp-flat*sp)/(dTop*this.tanV),yLow=(low*cp-flat*sp)/(dLow*this.tanV);
    this.rX0=(across-box.radius)/(depth*this.tanH);this.rX1=(across+box.radius)/(depth*this.tanH);
    this.rY0=Math.min(yTop,yLow);this.rY1=Math.max(yTop,yLow);this.rDepth=depth;
    return true;
  }
}
