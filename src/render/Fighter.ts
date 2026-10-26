import { forgedMoveFor } from '../engine/sim/forgedKits';
import { DREAM_IMPACT } from './dreamFlag';
import { passWhileHidden } from './hiddenMatrices';
import { areaAnimOf } from '../engine/sim/areaMoves';
import {pikachuStrikeSurfaces,pikachuLowStrikeJoint,pikachuAuthoredChargeStep} from './signature/PikachuContactSurface';
import {asukaAuthoredKick} from '../game/fighters/asuka';
import { preservePainCloakSurface } from './look/painShell';
import { mightGuyAuthoredKick,mightGuyAuthoredRushStep,mightGuyHandState } from '../game/fighters/might-guy';
import { pikachuExpression } from '../game/fighters/pikachu';
import { mikasaAuthoredContactCarry } from '../game/fighters/mikasa';
import { alphonseAuthoredKick,alphonseAuthoredGround,alphonseAuthoredShoulderStep } from '../game/fighters/alphonse-elric';
import { garouAuthoredContactStep } from './signature/GarouContactStep';
import { garouStrikeSurface } from './signature/GarouStrikeSurface';
import { applyGarouCosmicLook } from './signature/GarouCosmicLook';
import { kanekiAuthoredJabStep } from './signature/KanekiRinkaku';
import { preserveMinatoPaintedFolds } from './look/minatoCreases';
import { edwardBladeVisible } from '../game/fighters/edward-elric';
import { edwardAuthoredKick, edwardAuthoredGround } from './signature/EdwardAlchemy';
import { tatsumakiAuthoredHover } from './signature/TatsumakiPsychic';
import { TatsumakiFlight } from './signature/TatsumakiFlight';
import { escanorRhittaVisible } from '../game/fighters/escanor';
import { aokijiMeshState, aokijiStrikeJoint } from '../game/fighters/aokiji';
import { doflamingoAuthoredKick } from './signature/DoflamingoStrings';
import { blackbeardAuthoredKick } from './signature/BlackbeardEmperor';
import { tsunadeAuthoredKick } from '../game/fighters/tsunade';
import { HINATA_CINEMATIC } from '../game/fighters/hinata';
import { KIZARU_CINEMATIC, kizaruHandVariants, kizaruAuthoredKick } from '../game/fighters/kizaru';
import { YAMATO_CINEMATIC } from '../game/fighters/yamato';
import { jinbeHandVariants } from '../game/fighters/jinbe';
import { akainuArmVariants, AKAINU_CINEMATIC } from '../game/fighters/akainu';
import { RELEASED_FIGHTERS } from '../game/rosterAvailability';
import { rosterPrefetch } from '../loading/rosterPrefetch';
import {PriorityQueue} from '../loading/PriorityQueue';
import * as THREE from 'three';
import { addShaderPatch } from './look/shaderPatch';
import { applyAuthoredInk, applyHitFlash, applyInkShell, applyLimbSmear, applyToonShading, headWeights, limbWeights, toonKind } from './look/toonShading';
import { applyThreatInk, threatInk } from './ThreatOutline';
import { SHADOW_SIDE_FIGHTERS, fixShadowSide } from './look/shadowSide';
import { HAND_SCALE } from './look/proportions';
import { HAND_GRIP, gripPlan } from './look/grip';
import { HANDS, HandLayer } from './look/hands';
import { handRow } from './look/handTable';
import { characterClips, isCharacterMotion, mirrorClip, mirrorSource, sceneJoints, strikeFraction } from './characterMotion';
import { appendClips, clipKey, findClipIn, joinClips } from './clipMatch';
import { clipMapFor, type BodyClipMap } from '../engine/client/clips';
import { FIGHTER_SOCKETS, placeSocket, socketAsk, type SocketAsk, type SocketKind } from '../engine/client/sockets';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { ClipPool, shareClips } from './clipShare';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { disposeSkeletons, shareSkeletons } from './sharedSkeletons';
import { releaseTextures } from './sharedTextures';
import { FIGHTERS } from '../config';
import { resolveSkeleton } from './skeleton';
import { DEFAULT_IDLE, IDLE_PROFILES } from './idle/profile';
import { IdleRig, hashSeed } from './idle/life';
import { Ragdoll, ragdollsReady } from './Ragdoll';
import { COMBO_KEYS, COMBO_SLOT, comboMove, hasCombos, type ComboKey } from '../game/combos';
import { comboClip, comboFormClip, type ComboClip } from './comboClips';
import { LAUNCH_GRAVITY, MOVES, OUTCOME_LIFT, PUSH_RADIUS, RUSH_STAGES, WHIFF_RECOVERY, meleeReach, type MoveDefinition, type Outcome } from '../game/moves';
import { FALL_GRAVITY, jumpArc } from '../game/moves';
import { AWAKENINGS, AWAKENING_ENTRY, AWAKENING_SWAP, awakeningSwapAt, moveFor as awakenedMoveFor, rushMove as authoredRushMove } from '../game/awakening';
import { standingAura } from './standingAura';
import { OUTFITS, outfitFor, type OutfitDef } from '../game/economy/outfits';
import { LANDED, type LandedBlow } from '../game/landedBlows';
import { GOKU_MELEE_CONTACTS, GOKU_TRANSMISSION } from './gokuMeleeContact';
import { installOcclusionFade } from './OcclusionFade';
import contactFrames from '../game/data/contactFrames.json';
import locomotion from '../game/data/locomotion.json';
import { SecondaryMotion } from './SecondaryMotion';
import { G5_FLOAT, bindFormExtras, floatBob, floatLanding, floatTarget } from './luffy/gearFive';
import { aheadLoader } from '../loading/modelFiles';
import { closedFist, openHandName } from './luffy/openHands';
import { BAJRANG_GRAB, BAJRANG_TAKE, bajrangGrab, bajrangOut } from './luffy/bajrang';
import { SHAMBLES_TAKE } from './law/shambles';
import type { Transplanted } from '../engine/client/transplantTakes';
import type { AttackSlot, FighterId, PlayerState, ReactionKind } from '../game/types';

const isGoku=(state:PlayerState)=>state.fighter==='goku';
const AIM_YAW=THREE.MathUtils.degToRad(52),AIM_PITCH=THREE.MathUtils.degToRad(24);
const FORWARD=new THREE.Vector3(0,0,1);
const INK_DEPTH_BIAS=.035;
const ROOT_RETURN_RATE=5,ROOT_RETURN_MAX=.4;
const PLUNGE_SLAM=.06;
const ROOT_CLAMPED=['light','heavy','special','ultimate'];
const JUMP_ROOT={travel:.5,rise:.06,drop:.14};
const GUARD_ROOT={travel:.3,rise:1,drop:1};
const REACTION_ROOT={travel:.55,rise:.35,drop:Infinity};
const DRAWN_GAP=.85;
const GARMENT:Partial<Record<FighterId,FighterId>>={};
const DRAWN_GAP_ARMED:Partial<Record<FighterId,number>>={toji:1.17,rengoku:1.2,akame:1.1,esdeath:1.2,mikasa:1.15,byakuya:1.3,yamamoto:1.35,kenpachi:1.35,escanor:2,nanami:1.15,gintoki:1.1,yamato:1.3,denji:1.05,nami:1.05,mihawk:1.25,guts:1.25,zoro:1.15,ichigo:1.15,law:1.2,sasuke:.95,kakashi:.95,kaido:1.3,whitebeard:1.35,shanks:1.15,roger:1.15,
  griffith:1.15,tanjiro:1.1,levi:1.1,aizen:1.15,
  eren:1.1};
const ROOM_PULL=.3,ROOM_PULL_RATE=2.5;
const DREAM_STEP={lead:.42,gap:.52,rise:.16,hold:.12,out:.28} as const;
const OWN_STEPS=new Set<FighterId>(['shinji','might-guy','ken-kaneki','garou','mikasa','alphonse-elric','pikachu','jolyne']);
const REACHING_LIGHTS=new Set<FighterId>(['luffy']);
const ROOM_KNEE=.08;
const softCap=(travel:number,cap:number)=>travel<=cap-ROOM_KNEE?travel:cap-ROOM_KNEE+ROOM_KNEE*Math.tanh((travel-cap+ROOM_KNEE)/ROOM_KNEE);
type Approach={chargeIn?:number;dashThrough?:boolean};
const CHARGE_ROOM=.1,THROUGH_LEAD=.25;
const ROOM_RELEASE=5;
const OPPONENT_MATCH=1.2;
const UNCAPPED={travel:Infinity,rise:Infinity,drop:Infinity};
const JUMP_GRAVITY=23;
const softLimit=(distance:number,cap:number)=>Number.isFinite(cap)?cap>1e-6?cap*Math.tanh(distance/cap):0:distance;
const _rootWorld=new THREE.Vector3(),_rootShift=new THREE.Vector3(),_rootLead=new THREE.Vector3(),_rootOther=new THREE.Vector3();
const _centerTop=new THREE.Vector3(),_rootRaw=new THREE.Vector3(),_rootBasis=new THREE.Vector3();
const FOX_CLEAR:[number,number]=[2.4,3];
const SHOULDERS=['LeftShoulder','RightShoulder'],UPPER_ARMS=['LeftArm','RightArm'],HAND_SIDES=['Right','Left'] as const;
const softTo=(v:number,limit:number)=>limit*Math.tanh(v/limit);
const tipAxis=(h:THREE.Vector3,out:THREE.Vector3)=>out.set(h.z,0,-h.x).normalize();
const TWIST_SHARE=[.2,.25,.3,.25],LEAN_TIP=[.1,.3,.3,.3],FOLD_LAUNCH=[0,.3,.35,.35];
const shareTotals=(shares:number[])=>shares.map((_,n)=>shares.slice(0,n+1).reduce((a,b)=>a+b,0)||1);
const TWIST_TOTAL=shareTotals(TWIST_SHARE),TIP_TOTAL=shareTotals(LEAN_TIP),FOLD_TOTAL=shareTotals(FOLD_LAUNCH);
const _holdForward=new THREE.Vector3(),_holdPoint=new THREE.Vector3(),_holdSide=new THREE.Vector3();
const _rubberTarget=new THREE.Vector3(),_rubberElbow=new THREE.Vector3(),_rubberWrist=new THREE.Vector3(),_rubberAlong=new THREE.Vector3(),_rubberToward=new THREE.Vector3(),_rubberDir=new THREE.Vector3(),_rubberAxis=new THREE.Vector3(),_rubberPelvis=new THREE.Vector3(),_rubberBack=new THREE.Vector3();
const _rubberTurn=new THREE.Quaternion(),_rubberLocal=new THREE.Vector3();
const _grabForward=new THREE.Vector3();
const _hitShove=new THREE.Vector3(),_hitLean=new THREE.Vector3(),_hitWhip=new THREE.Vector3(),_hitFling=new THREE.Vector3(),_hitAxisD=new THREE.Vector3(),_hitAxis=new THREE.Vector3(),_hitAxisB=new THREE.Vector3(),_hitAxisC=new THREE.Vector3(),_hitFrom=new THREE.Vector3(),_hitTo=new THREE.Vector3();
const _torsoA=new THREE.Vector3(),_torsoB=new THREE.Vector3(),_torsoH=new THREE.Vector3(),_strikeP=new THREE.Vector3(),_strikeQ=new THREE.Vector3(),_strikeTip=new THREE.Vector3();
const _touchDir=new THREE.Vector3(),_touchPoint=new THREE.Vector3(),_pushWant=new THREE.Vector3(),_pushStep=new THREE.Vector3();
const CONTACT={a:new THREE.Vector3(),b:new THREE.Vector3(),radius:0,head:new THREE.Vector3(),headRadius:0,hasHead:false,hx:0,hz:0,
  deepest:0,point:new THREE.Vector3(),enter:new Float64Array(768),exit:new Float64Array(768),count:0,runs:0};
const _cq=new THREE.Vector3(),_cu=new THREE.Vector3();
const _cullCentre=new THREE.Vector3(),_cullInverse=new THREE.Matrix4(),_cullBox=new THREE.Box3(),_viewSphere=new THREE.Sphere();
const CULL_PAD=1.5,CULL_REACH=1;
function beginContact(a:THREE.Vector3,b:THREE.Vector3,radius:number,head:THREE.Vector3|undefined,headRadius:number,hx:number,hz:number){
  const c=CONTACT;c.a.copy(a);c.b.copy(b);c.radius=radius;c.hasHead=!!head;if(head)c.head.copy(head);c.headRadius=headRadius;
  c.hx=hx;c.hz=hz;c.deepest=-TOUCH_REACH;c.count=0;c.runs=0;
}
function contactStretch(A:number,B:number,C:number){
  const c=CONTACT;
  if(A<1e-9||c.count>=c.enter.length)return;
  const disc=B*B-A*C;if(disc<=0)return;
  const root=Math.sqrt(disc),exit=(B+root)/A;if(exit<=0)return;
  c.enter[c.count]=(B-root)/A;c.exit[c.count]=exit;c.count++;
}
function contactSurface(p:THREE.Vector3,push=true){
  const c=CONTACT;
  _cu.subVectors(c.b,c.a);const long=_cu.lengthSq();
  const s=long>1e-9?THREE.MathUtils.clamp(_cq.subVectors(p,c.a).dot(_cu)/long,0,1):0;
  _cq.copy(c.a).addScaledVector(_cu,s);_cq.subVectors(p,_cq);
  const inside=c.radius-_cq.length();
  if(inside>c.deepest){c.deepest=inside;c.point.copy(p);}
  if(push){
    if(long>1e-9)_cu.multiplyScalar(1/Math.sqrt(long));else _cu.set(0,1,0);
    const qu=_cq.dot(_cu),hu=c.hx*_cu.x+c.hz*_cu.z;
    const qx=_cq.x-qu*_cu.x,qy=_cq.y-qu*_cu.y,qz=_cq.z-qu*_cu.z,hx=c.hx-hu*_cu.x,hy=-hu*_cu.y,hz=c.hz-hu*_cu.z;
    contactStretch(hx*hx+hy*hy+hz*hz,qx*hx+qy*hy+qz*hz,qx*qx+qy*qy+qz*qz-(c.radius*c.radius-qu*qu));
  }
  if(c.hasHead){
    _cq.subVectors(p,c.head);
    const within=c.headRadius-_cq.length();
    if(within>c.deepest){c.deepest=within;c.point.copy(p);}
    if(push)contactStretch(1,_cq.x*c.hx+_cq.z*c.hz,_cq.lengthSq()-c.headRadius*c.headRadius);
  }
}
function endContact(){
  const c=CONTACT,n=c.count,enter=c.enter,exit=c.exit;
  for(let i=1;i<n;i++){const e=enter[i],x=exit[i];let j=i-1;while(j>=0&&enter[j]>e){enter[j+1]=enter[j];exit[j+1]=exit[j];j--;}enter[j+1]=e;exit[j+1]=x;}
  let runs=0;
  for(let i=0;i<n;i++){
    if(runs>0&&enter[i]<=exit[runs-1]+1e-4){if(exit[i]>exit[runs-1])exit[runs-1]=exit[i];continue;}
    enter[runs]=enter[i];exit[runs]=exit[i];runs++;
  }
  c.runs=runs;
  return runs>0&&enter[0]<=1e-4?exit[0]:0;
}
function contactRun(t:number){
  for(let i=0;i<GUARD.runs;i++)if(t>GUARD.enter[i]+1e-5&&t<GUARD.exit[i]-1e-5)return i;
  return -1;
}
function guardContact(){
  const c=CONTACT;GUARD.hx=c.hx;GUARD.hz=c.hz;GUARD.runs=c.runs;
  for(let i=0;i<c.runs;i++){GUARD.enter[i]=c.enter[i];GUARD.exit[i]=c.exit[i];}
}
const STRIKE_LEGS=[['RightFoot','RightToeBase','RightLeg'],['LeftFoot','LeftToeBase','LeftLeg']] as const,BLADE_STEP=.07;
const BLADE_FORTE=.6,BLADE_FORTE_MOST=.75,BLADE_FROM=.08,BLADE_MIN=.45;
const BLADE_BONE=/^(?!.*sheath)(blade|sword|katana|weapon)/i;
const MOUTH_BLADE:Partial<Record<FighterId,{bone:string;at:[number,number,number];turn:[number,number,number,number]}>>={
  zoro:{bone:'bladea2_joint_07',at:[-.008,-.08,.095],turn:[-.6807,-.7081,-.1388,.1265]}};
const _mouthM=new THREE.Matrix4(),_mouthW=new THREE.Matrix4(),_mouthP=new THREE.Vector3(),_mouthQ=new THREE.Quaternion(),_mouthS=new THREE.Vector3();
const GUARD={hx:0,hz:0,enter:new Float64Array(768),exit:new Float64Array(768),runs:0};
const _aimTarget=new THREE.Vector3(),_aimOrigin=new THREE.Vector3(),_aimDirection=new THREE.Vector3();
const _aimSwing=new THREE.Quaternion(),_aimShare=new THREE.Quaternion(),_aimWorld=new THREE.Quaternion();
const _aimGroup=new THREE.Quaternion(),_aimInverse=new THREE.Quaternion(),_aimParent=new THREE.Quaternion();
const _aimParentInverse=new THREE.Quaternion(),_aimLocal=new THREE.Quaternion();
const _leanAxis=new THREE.Vector3(),_leanWorld=new THREE.Quaternion(),_leanShare=new THREE.Quaternion();
const _leanParent=new THREE.Quaternion(),_leanParentInverse=new THREE.Quaternion(),_leanLocal=new THREE.Quaternion();
const _leanPoint=new THREE.Vector3(),_step=new THREE.Vector3(),_foldAxis=new THREE.Vector3();
const _flightSide=new THREE.Vector3(),_flightHeading=new THREE.Vector3(),_flightBody=new THREE.Vector3(),_flightPoint=new THREE.Vector3();
const _handForward=new THREE.Vector3();
let contactFalloff:THREE.DataTexture|undefined;
function contactShadowFalloff(){
  if(contactFalloff)return contactFalloff;
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const d=Math.hypot((x+.5)/size-.5,(y+.5)/size-.5)*2,t=Math.max(0,Math.min(1,1-d));
    const v=Math.round(255*t*t*(3-2*t)),i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  contactFalloff=new THREE.DataTexture(data,size,size);contactFalloff.needsUpdate=true;
  return contactFalloff;
}
const _chargeA=new THREE.Vector3(),_chargeB=new THREE.Vector3(),_chargeC=new THREE.Vector3();
const _blendTarget2=new THREE.Vector3();
const ROOT_TRAVEL_WEIGHT=.32;
const _ikA=new THREE.Vector3(),_ikB=new THREE.Vector3(),_ikC=new THREE.Vector3(),_ikT=new THREE.Vector3();
const _ikAB=new THREE.Vector3(),_ikAC=new THREE.Vector3(),_ikAT=new THREE.Vector3(),_ikBA=new THREE.Vector3(),_ikBC=new THREE.Vector3();
const _ikAxis=new THREE.Vector3(),_ikTurn=new THREE.Quaternion(),_ikFoot=new THREE.Quaternion(),_ikAnkle=new THREE.Vector3();
const _blendTarget=new THREE.Quaternion(),_strideFrom=new THREE.Quaternion(),_strideBack=new THREE.Quaternion();
const UP=new THREE.Vector3(0,1,0);
const LEAN_SHARE=[.22,.3,.28,.2];
export const BANK={share:.3,most:THREE.MathUtils.degToRad(5),ease:14};
const HELD_SLACK=.25;
const VICTORY=['Toji Victory','Crocodile Victory','Usopp Victory','Robin Victory','Kaiju Resolve','Eren Victory','Titan Victory','Asuka Victory','Gratitude','Synchronization Stable','Jolyne Victory','Guy Victory','Edward Victory','Minato Victory','Kenpachi Victory','Makima Victory','Tatsumaki Victory','Escanor Victory','Meliodas Victory','Hiei Victory','Sakura Victory','Aokiji Victory','Doflamingo Victory','Hisoka Victory','Blackbeard Victory','Tsunade Victory','Jiraiya Victory','Hinata Victory','Gintoki Victory','Kizaru Victory','Yamato Victory','Jinbe Victory','Enel Victory','Rukia Victory','Yuta Victory','Yuji Victory','Todoroki Victory','Endeavor Victory','Yoruichi Victory','Captain Commander','victory_lp','victory','Naruto pose','_Idle','Idle','goku-ready','stance'];
const VICTORY_ENTRY='victory_in';
const FOLD_LOW=1.12,FOLD_HIGH=1.48;
export const DREAM_HURTS={'dream back':'DZ recoil back','dream fold':'DZ recoil fold','dream spin L':'DZ recoil spin L','dream spin R':'DZ recoil spin R'} as const;
export const DREAM_FLINCH='DZ flinch';
const BORROWED_TAKES=new Set<string>([...Object.keys(DREAM_HURTS),'dream flinch','abdomen']);
export function dreamHurt(stage:number,side:number):keyof typeof DREAM_HURTS{
  const turn=((stage%3)+3)%3;
  return turn===0?'dream fold':turn===1?'dream back':side>0?'dream spin L':'dream spin R';
}
const DREAM_STAGES=['DZ Rush 1','DZ Rush 2','DZ Rush 3'] as const;
const dreamRows=new WeakMap<ComboClip,Map<string,ComboClip>>();
function dreamRow(own:ComboClip,name:string){let rows=dreamRows.get(own);if(!rows)dreamRows.set(own,rows=new Map());let row=rows.get(name);if(!row)rows.set(name,row={...own,clip:name});return row;}
const TAKE_SHAPE:Record<keyof typeof DREAM_HURTS,{fold:number;lean:number;hunch:number}>={
  'dream back':{fold:0,lean:1,hunch:0},'dream fold':{fold:1,lean:.3,hunch:1},'dream spin L':{fold:.3,lean:.7,hunch:0},'dream spin R':{fold:.3,lean:.7,hunch:0},
};
const TAKE_EASE=.06;
const DRIVE={lean:.32,hold:.1,rate:4} as const;
const TAKE_PLANT=.12;
const STRIKE_PLANT={full:.03,reach:.1,ease:.08} as const;
const TAKE_RELEASE=.7;
const DZ_TAKE_CLIPS=new Set<string>([...Object.values(DREAM_HURTS),DREAM_FLINCH]);
const TAKE_TURN={most:.5,in:14,out:5} as const;
const FOLD_SHARE=[.08,.24,.34,.34];
const CONTACT_FRACTION=contactFrames as Partial<Record<FighterId,Partial<Record<AttackSlot,number>>>>;
const CONTACT_BY_KEY=contactFrames as Partial<Record<FighterId,Record<string,number|undefined>>>;
const ATTACK_SLOTS=new Set<string>(['light','heavy','special','ultimate','area']);
const areaAnim=(state:PlayerState)=>areaAnimOf(state.fighter,forgedMoveFor(state)??MOVES[state.fighter]?.area);
const RUSH_DEFAULT_FRACTION=.4;
const RUSH_STRIKE=/punch|kick|air attack|strike|slash|attack_|jab|hook|knee|elbow|grounded-(cross|meteor)/i;
const RUSH_NEVER=/idle|run|walk|dash|jump|block|guard|hit|hurt|die|down|slam|stun|shake|shock|blown|victory|lose|opening|flagget|pose|home|ready|stance|fall|spin|charge/i;
const RUSH_SMOOTH=THREE.MathUtils.degToRad(32);
const FORM_NAMED_RUSH:ReadonlySet<FighterId>=new Set<FighterId>(['griffith','broly','deku','rukia','tsunade','jiraiya','sakura','hiei','meliodas','escanor','kenpachi','minato','grimmjow','ken-kaneki','garou','akame','might-guy','asuka','eren']);
export type AirStage={clip?:string;tuck:boolean;from?:number;to?:number;contact?:number;span?:number};
export const FORM_AIR_STRING_CLIPS:Partial<Record<FighterId,readonly [AirStage,AirStage,AirStage]>>={
  eren:[{clip:"Rebel Uppercut",tuck:false,from:0,to:0.8,contact:0.54,span:0.8},{clip:"Defiant Hook",tuck:true,from:0,to:0.7,contact:0.5,span:0.7},{clip:"Freedom Hammer",tuck:false,from:0,to:1,contact:0.58,span:1}],
};
const air=(clip:string,tuck:boolean,from?:number,to?:number,contact?:number,span?:number):AirStage=>({clip,tuck,...(from!==undefined?{from,to,contact,span}:{})});
export const AIR_STRING_CLIPS:Partial<Record<FighterId,readonly [AirStage,AirStage,AirStage]>>={
  toji:[air("Assassin Rising Edge",false,0,0.82,0.45,0.82),air("Blindside Cut",false,0,0.7,0.5238095238095238,0.7),air("No Escape",false,0,0.95,0.5238095238095238,0.95)],
  crocodile:[air("Desert Girasole",false,0,0.9333333333333333,0.5,0.9333333333333333),air("Golden Hook",false,0,1.0,0.5,1.0),air("Desert Encierro",false,0,1.3,0.5,1.3)],
  usopp:[air("Trampolia Star",true,0,0.82,0.45121951219512196,0.82),air("Aerial Kabuto",true,0,0.92,0.5,0.92),air("Skull Bombgrass",false,0,1,0.49,1)],
  sakura:[air("Rising Blossom",true,0,0.72,0.54,0.72),air("Bloom Backfist",true,0,0.65,0.46,0.65),air("Shattering Blossom",true,0,0.98,0.62,0.98)],
  meliodas:[air("Rising Dragon",true,0,0.716667,0.51,0.716667),air("Dragon Reversal",true,0,0.633333,0.5816326530612245,0.633333),air("Wrath Cleaver",true,0,0.916667,0.6,0.916667)],
  escanor:[air("Rising Pride",true,0,0.800000011920929,0.56,0.800000011920929),air("Royal Reversal",true,0,0.699999988079071,0.53,0.699999988079071),air("Sunlit Divider",true,0,1,0.56,1)],
  tatsumaki:[air("Psychic Flick",false,0,0.52,0.4807692307692307,0.52),air("Vector Reversal",false,0,0.72,0.4305555555555556,0.72),air("Aerial Repulse",false,0,0.86,0.5,0.86)],
  makima:[air("Come Here",true,0,0.7666666666666667,0.53,0.7666666666666667),air("Stay Down",true,0,0.6666666666666666,0.59,0.6666666666666666),air("Submission",true,0,0.9666666666666667,0.5833333333333333,0.9666666666666667)],
  kenpachi:[air("Captain Rising Cut",false,0,0.83,0.4489,0.83),air("Shoulder Reversal",true,0,0.68,0.4,0.68),air("Jagged Execution",false,0,1.03,0.4,1.03)],
  minato:[air("Rising Spiral",true,0,0.75,0.5,0.75),air("Crossing Mark",true,0,0.6,0.44,0.6),air("Spiral Descent",true,0,1.0,0.56,1.0)],
  'nico-robin':[air("Seis Fleur Rise",false,0,0.8166666666666667,0.52,0.8166666666666667),air("Tres Fleur Twist",true,0,0.6833333333333333,0.56,0.6833333333333333),air("Ocho Fleur Hold",false,0,0.9333333333333333,0.56,0.9333333333333333)],
  'kaiju-no-8':[air("Fortitude Uppercut",false,0,0.8666666746139526,0.54,0.8666666746139526),air("Armored Hook",true,0,0.7333333492279053,0.5,0.7333333492279053),air("Reactor Hammer",false,0,1.05,0.58,1.05)],
  asuka:[air("Rush 1",false,0,0.6000000238418579,0.46,0.6000000238418579),air("Rush 2",true,0,0.7833333611488342,0.56,0.7833333611488342),air("Rush 3",false,0,0.8666666746139526,0.58,0.8666666746139526)],
  netero:[air("Rising Palm",false,0,0.7833333333333333,0.54,0.7833333333333333),air("Prayer Reversal",true,0,0.7166666666666667,0.54,0.7166666666666667),air("Temple Breaker",false,0,0.9833333333333333,0.58,0.9833333333333333)],
  rengoku:[air("Rising Ember",false,0,56/60,28/56,56/60),air("Flame Reversal",true,0,49/60,23/49,49/60),air("Blazing Divider",false,0,67/60,34/67,67/60)],
  shinji:[air("Pylon Breaker",false,0,0.8666666746139526,0.51,0.8666666746139526),air("Axial Counter",true,0,0.6333333253860474,0.43,0.6333333253860474),air("Core Drive",false,0,0.949999988079071,0.43,0.949999988079071)],
  jolyne:[air("String Uppercut",true,0,0.7333333333333333,0.52,0.7333333333333333),air("Cross Stitch",true,0,0.8666666666666667,0.537037037037037,0.8666666666666667),air("Prison Break",true,0,1,0.537037037037037,1)],
  'might-guy':[air("Leaf Straight",false,0,0.5,0.48,0.5),air("Leaf Rising Wind",false,0,0.7833333611488342,0.4615384615384615,0.7833333611488342),air("Descending Fang",false,0,0.9333333373069763,0.4893617021276596,0.9333333373069763)],
  akame:[air("Rising Night Raid",false,0,0.7833333611488342,0.46,0.7833333611488342),air("Crossing Murasame",false,0,0.7166666666666667,0.56,0.7166666666666667),air("Scarlet Descent",false,0,1,0.56,1)],
  pikachu:[air("Quick Attack",false,0,0.48333333333333334,0.45833333333333337,0.48333333333333334),air("Tail Feint",false,0,0.7166666666666667,0.4444444444444445,0.7166666666666667),air("Falling Iron Tail",false,0,0.9,0.5,0.9)],
  garou:[air("Flowing Redirection",true,0,0.7333333333333333,0.5377358490566037,0.7333333333333333),air("Hunter Cross",true,0,0.85,0.4464285714285714,0.85),air("Whirlwind Break",true,0,1,0.49107142857142855,1)],
  esdeath:[air("Imperial Ascent",false,0,0.7833333611488342,0.49,0.7833333611488342),air("Cold Riposte",true,0,0.6333333333333333,0.44,0.6333333333333333),air("Execution Point",false,0,0.9166666865348816,0.44,0.9166666865348816)],
  mikasa:[air("Vaulting Blade",true,0,0.75,0.52,0.75),air("Reverse Reap",true,0,0.6499999761581421,0.5,0.6499999761581421),air("Steel Scissor",true,0,0.8999999761581421,0.56,0.8999999761581421)],
  'alphonse-elric':[air("Armored Straight",true,0,0.6166666666666667,0.48387096774193544,0.6166666666666667),air("Steel Backhand",true,0,0.8333333333333334,0.4523809523809524,0.8333333333333334),air("Iron Heel",false,0,1.0166666666666666,0.5196078431372549,1.0166666666666666)],
  'ken-kaneki':[air("Rinkaku Hook",true,0,0.7166666666666667,0.5462962962962963,0.7166666666666667),air("Predator Cross",true,0,0.8666666666666667,0.5462962962962963,0.8666666666666667),air("Fourfold Rend",true,0,1.0166666666666666,0.5,1.0166666666666666)],
  grimmjow:[air("Rising Talon",false,0,0.7666666666666667,0.48,0.7666666666666667),air("Panther Reversal",true,0,0.6166666746139526,0.43,0.6166666746139526),air("Predator Breaker",false,0,0.8833333333333333,0.43,0.8833333333333333)],
  byakuya:[air("Rising Senbonzakura",true,0,0.7666666666666667,0.44,0.7666666666666667),air("Crossing Petals",true,0,0.7,0.55,0.7),air("Petal Descent",true,0,0.9666666666666667,0.54,0.9666666666666667)],
  yamamoto:[air("Rising Ember",true,0,0.7833333611488342,0.55,0.7833333611488342),air("Commanders Reversal",true,0,0.699999988079071,0.53,0.699999988079071),air("Ashen Divider",true,0,0.9833333492279053,0.495,0.9833333492279053)],
  pain:[air("Receiver Sweep",true,0,0.7166666666666667,0.57,0.7166666666666667),air("Divine Rejection",true,0,0.8333333333333334,0.5446428571428571,0.8333333333333334),air("Black Rod Verdict",true,0,0.9833333333333333,0.57,0.9833333333333333)],
  'edward-elric':[air("Automail Jab",true,0,0.54,0.48148148148148145,0.54),air("Automail Backfist",true,0,0.76,0.4342105263157895,0.76),air("Automail Heel",false,0,0.92,0.5,0.92)],
  hiei:[air("Rising Darkness",false,0,0.7,0.51,0.7),air("Reverse Shadow",true,0,0.58,0.45,0.58),air("Demon Crosscut",false,0,0.88,0.58,0.88)],
  aokiji:[air("Polar Rise",false,0,1.2,0.3333333333333333,1.2),air("Ice Saber",true,0,1.0666666666666667,0.59375,1.0666666666666667),air("Glacial Cleave",true,0,1.0666666666666667,0.25,1.0666666666666667)],
  doflamingo:[air("Five Color Strings",true,0,0.54,0.48148148148148145,0.54),air("Puppet Reversal",true,0,0.72,0.4166666666666667,0.72),air("Sky String Heel",false,0,0.94,0.4893617021276596,0.94)],
  hisoka:[air("Rising Joker",true,0,0.72,0.5,0.72),air("Falling Card",true,0,0.82,0.44,0.82),air("Elastic Breaker",true,0,0.9,0.5957446808510639,0.9)],
  blackbeard:[air("Yami Jab",true,0,0.56,0.4285714285714285,0.56),air("Dark Backfist",true,0,0.72,0.4166666666666667,0.72),air("Emperor Heel",false,0,0.94,0.4893617021276596,0.94)],
  nanami:[air("Seven Three Rise",true,0,0.7333333333333333,0.55,0.7333333333333333),air("Cross Ratio",true,0,0.6333333333333333,0.53,0.6333333333333333),air("Critical Cleave",true,0,0.8666666666666667,0.56,0.8666666666666667)],
  josuke:[air("Rising Heart",true,0,0.733333,0.52,0.733333),air("Diamond Hook",true,0,0.616667,0.5217391304347826,0.616667),air("Morioh Breaker",true,0,0.883333,0.5217391304347826,0.883333)],
  tsunade:[air("Rising Strength",false,0,0.72,0.54,0.72),air("Rib Breaker",true,0,0.65,0.46,0.65),air("Crushing Heel",false,0,0.96,0.6,0.96)],
  jiraiya:[air("Mountain Palm",false,0,0.74,0.5,0.74),air("Sannin Backhand",true,0,0.64,0.5,0.64),air("Rasengan Drive",false,0,0.88,0.58,0.88)],
  hinata:[air('Rising Gentle Palm',true,0,.7,.52,.7),air('Tenketsu Backpalm',true,0,.6,.54,.6),air('Eight Trigrams Sweep',true,0,47/60,.54,47/60)],
  gintoki:[air('Rising Bokken',true,0,.766667,.52,.766667),air('Sash Crosscut',true,0,.616667,.4444444444444444,.616667),air('Kabukicho Splitter',true,0,.9,.6021505376344086,.9)],
  kizaru:[air('Rising Ray',false,0,43/60,17/30,43/60),air('Photon Roundhouse',false,0,.65,16/29,.65),air('Flash Heel Drop',false,0,50/60,23.5/43,50/60)],
  yamato:[air('Takeru Sweep',true,0,.58,.24/.58,.58),air('Oni Backhand',true,0,.72,.31/.72,.72),air('Ogre Descent',false,0,.92,.5,.92)],
  jinbe:[air('Sharkskin Rise',true,0,28/30,9/28,28/30),air('Tide Uppercut',true,0,1,9/30,1),air('Ocean Hammer',true,0,1.3,16/39,1.3)],
  enel:[air('Ascending Judgment',true,0,.966667,.4,.966667),air('Staff Backcut',true,0,.733333,.42,.733333),air('Thunder Downstroke',true,0,1.1,.58,1.1)],
  rukia: [air("Snow Rising Cut",false,0,0.72,0.54255,0.72),air("Snow Reverse Cut",true,0,0.6,0.5,0.6),air("White Moon Descent",false,0,0.8,0.5,0.8)],
  yuta: [air("Rising Resolve",false,0,0.7,0.48,0.7),air("Return Cut",true,0,0.6,0.48,0.6),air("Falling Resolve",false,0,0.8166666666666667,0.56,0.8166666666666667)],
  yuji:[air('Rising Soul',true,0,0.716667,0.52,0.716667),air('Liver Hook',true,0,0.6,0.48,0.6),air('Elbow Breaker',true,0,0.783333,0.55,0.783333)],
  todoroki:[air('Ice Fang',true,0,.76,.55,.76),air('Frost Backfist',true,0,.6,.49,.6),air('Flame Hammer',true,0,.94,.57,.94)],
  endeavor:[air('Jet Uppercut',true,0,.78,.53,.78),air('Flame Backfist',true,0,.63,.46,.63),air('Fire Hammer',true,0,.89,.54,.89)],
  yoruichi:[air('Rising Flash',false),air('Hakuda Elbow',true),air('Thunder Heel',false)],
  'all-might':[air('Hero Uppercut',true,0,.75,.52,.75),air('Hero Backfist',true,0,.72,.48,.72),air('Aerial Hammer',true,0,.85,.54,.85)],
  bakugo:[air('Rising Detonation',true,0,44/60,.54,44/60),air('Blast Cross',true,0,35/60,.46,35/60),air('Aerial Detonation',true,0,47/60,.52,47/60)],
  deku:[air('Rising Smash',true,0,.72,.51,.72),air('Cowling Cross',true,0,.55,.46,.55),air('Shoot Style Aerial',false,0,.82,.53,.82)],
  broly:[air('Gigantic Rising Fist',true,0,.75,.52,.75),air('Crushing Backfist',true,0,19/30,.48,19/30),air('Gigantic Hammer',true,0,49/60,.54,49/60)],
  denji:[air('Saw Rising Cut',false,0,43/60,.55,43/60),air('Saw Backcut',true,0,.6,.478,.6),air('Saw Downstroke',false,0,47/60,.553,47/60)],
  akainu:[air('Eruption Uppercut',false,0,20/30,8/20,20/30),air('Magma Backfist',true,0,23/30,8/23,23/30),air('Molten Descent',false,0,1,10/30,1)],
  'boa-hancock':[air('Empress Rising Heel',false,0,23/30,13/23,23/30),air('Perfume Air Kick',false,0,25/30,.48,25/30),air('Empress Heel Drop',false,0,1,1/3,1)],
  nami:[air('Staff Rising Cut',false,0,.6,11/18,.6),air('Staff Backcut',true,0,17/30,9/17,17/30),air('Staff Downstroke',false,0,.6,11/18,.6)],
  mihawk:[air('Yoru Rising Cut',false,0,.4,.5,.4),air('Yoru Backcut',true,0,.6,7.5/18,.6),air('Yoru Downstroke',false,0,.6,11/18,.6)],
  goku:[air('goku-grounded-meteor',false,0,.667,.42,.667),air('goku-grounded-cross',true),air('Rising Axe',false,2,2.9,.5,6.042)],
  vegeta:[air('Rush 2',true,0,.967,.3,.967),air('Ki Volley',true),air('Rush 3',false)],
  naruto:[air('air Attack 01',false),air('air Attack 02',false),air('Rush 3',false)],
  luffy:[air('Punch 02',false,0,1,.37,1),air('Punch 01',true),air('Slam Headbutt',false,.3,1.15,.75,6.042)],
  sanji:[air('Rush 2',false,0,.967,.3,.967),air('Punch 01',false),air('Rush 1',false)],
  kakashi:[air('Rush 2',false,0,.967,.28,.967),air('Rush 1',false),air('Rush 3',false)],
  sasuke:[air('Slash Palm',true,.25,1.05,.46,5.542),air('Rush 2',true),air('Rush 3',false)],
  zoro:[air('Zoro Air',false,.45,1.05,.68,5.042),air('Cut Plunge',true,.45,1.3,.53,6.542),air('Rush 3',false)],
  jotaro:[air('Rush 2',true,0,1.067,.31,1.067),air('Rush 1',true),air('Hammer Dive',false,2.85,3.55,.7,6.542)],
  ichigo:[air('skill_3_2',false,0,.458,.2,.458),air('attack_1_1',true),air('attack_1',true)],
  ace:[air('Punch 01',false,.25,1,.36,1.333),air('Rush 2',true),air('Body Dive',false,2.4,2.95,.67,6.542)],
  law:[air('Punch 01',false,0,1.167,.23,1.167),air('Rush 2',true),air('Cut Plunge',false,2.85,3.5,.72,6.542)],
  gojo:[air('Punch 01',false,.05,.75,.39,1),air('Rush 2',false),air('Axe Dive',false,2.8,3.45,.72,6.542)],
  dio:[air('Straight Spear',true,.8,1.9,.62,5.542),air('Rush 1',true),air('Rush 2',false)],
  guts:[air('Guts Air',false,1,1.8,.8,5.042),air('Crossbow Uppercut',false,3.6,4.9,.55,6.042),air('Guts Air',false,2.2,3.1,.72,5.042)],
  killua:[air('Rush 2',false,0,.967,.28,.967),air('Rush 1',true),air('Rush 3',false,.15,.8,.54,1.3)],
};
const TUCK_AT=.6,TUCK_EASE=.07;
const ATTACK_TURN_MIN=.12,ATTACK_TURN_RATE=13,ATTACK_TURN_FRAMES=[3,5] as const;
const STAND_COMMAND:Partial<Record<FighterId,string>>={josuke:'Josuke Command',jotaro:'Stand Command',dio:'Stand Command'};
const clipRoughness=new WeakMap<THREE.AnimationClip,number>();
const PALE_CROWN=new Set<FighterId>(['gojo']);
const STRIKE_DRAW=.45,STRIKE_SETTLE=.74,STRIKE_DRAWN=.56,STRIKE_COILED=.7,RECOVERY_FLOOR=.6;
const STRIKE_DRIVE=1.6;
const STRING_FLOOR=.14;
const MOTION_SAMPLES=240;
const MOTION_EVEN=.9;
const MOTION_SKIP=/finger|thumb|index|middle|ring|pinky|toe|eye|jaw|hair|cloth|skirt|coat|tail|weapon|sword|prop|bandana|scarf|belt|pouch/i;
const motionTables=new WeakMap<THREE.AnimationClip,Float32Array>();
const clipSamplers=new WeakMap<THREE.AnimationClip,{name:string;property:string;interpolant:THREE.Interpolant}[]>();
export function clipMotionTable(clip:THREE.AnimationClip):Float32Array{
  let table=motionTables.get(clip);
  if(table)return table;
  table=new Float32Array(MOTION_SAMPLES+1);
  const a=new THREE.Quaternion(),b=new THREE.Quaternion();
  for(const track of clip.tracks){
    if(!(track instanceof THREE.QuaternionKeyframeTrack)||MOTION_SKIP.test(track.name)||track.times.length<2)continue;
    const interpolant=(track as unknown as {createInterpolant(result?:unknown):{evaluate(t:number):ArrayLike<number>}}).createInterpolant();
    for(let i=0;i<=MOTION_SAMPLES;i++){
      const values=interpolant.evaluate(clip.duration*i/MOTION_SAMPLES);
      b.set(values[0],values[1],values[2],values[3]);
      if(i>0)table[i]=Math.max(table[i],a.angleTo(b));
      a.copy(b);
    }
  }
  for(let i=1;i<=MOTION_SAMPLES;i++)table[i]+=table[i-1];
  const total=table[MOTION_SAMPLES];
  for(let i=0;i<=MOTION_SAMPLES;i++)table[i]=(total>1e-6?table[i]/total:i/MOTION_SAMPLES)*MOTION_EVEN+(i/MOTION_SAMPLES)*(1-MOTION_EVEN);
  for(let i=1;i<=MOTION_SAMPLES;i++)table[i]=Math.max(table[i],table[i-1]+1e-6);
  const top=table[MOTION_SAMPLES];
  for(let i=0;i<=MOTION_SAMPLES;i++)table[i]/=top;
  motionTables.set(clip,table);
  return table;
}
export const motionTableBuilt=(clip:THREE.AnimationClip)=>motionTables.has(clip);
export function motionAt(table:Float32Array,fraction:number){
  const x=THREE.MathUtils.clamp(fraction,0,1)*MOTION_SAMPLES,i=Math.min(MOTION_SAMPLES-1,Math.floor(x)),f=x-i;
  return table[i]+(table[i+1]-table[i])*f;
}
export function clipAtMotion(table:Float32Array,motion:number){
  const m=THREE.MathUtils.clamp(motion,0,1);
  let lo=0,hi=MOTION_SAMPLES;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(table[mid]<=m)lo=mid;else hi=mid;}
  const span=table[hi]-table[lo];
  return (lo+(span>1e-12?THREE.MathUtils.clamp((m-table[lo])/span,0,1):0))/MOTION_SAMPLES;
}
const PACE_BAND:[number,number]=[.6,1.4];
const SKIP_SHAPE=1.3;
const STRUCK_BLEND=.1,STRUCK_ROOT=.14;
const REACT_IN=.1;
const REACT_PHASE:[number,number]=[.06,.12];
const DASH_ENTRY:[number,number]=[.08,.12],DASH_ENTRY_SHARE=.5;
const AIM_RATE=8.7;
const LOOP_BLEND=.07;
const REPLANT_CARRY=.5;
const STRIDE_FLOOR_RELAX=.25;
const ENTRY_STEP=THREE.MathUtils.degToRad(25),ENTRY_MAX=.14;
const LAUNCH_ENTRY_MAX=.2;
const SHAPE_FULL=.7,SHAPE_NONE=1.1;
const PACE_TAIL_MAX=2.2;
const MOVE_CLOCK_GAIN=12,MOVE_TICK=1/60,MOVE_CLOCK_BAND=2/60;
const FREEZE_EARLY=.04,FREEZE_LATE=.08;
const FOLLOW_EASE=.05,FOLLOW_MIN=1,FOLLOW_MAX=3;
const KAME_PUSH=.3375;
const DASH_RATE=2.5;
const DASH_CLIP_END:Partial<Record<FighterId,number>>={luffy:.47,ace:.55};
const PACE_CREEP=.14;
type UltimateClips={opener?:{clip:string;at:number};formOpener?:{clip:string;at:number};cine?:{from:number;at:number;windows?:[number,number,number?][]};release?:number;
  formOnly?:true};
const SLOT_CLIP_BEFORE:Partial<Record<FighterId,Record<string,{clip:string;contact?:number}>>>={
  sanji:{'Mouton Shot Spin':{clip:'Diable Jambe Mouton Shot',contact:.4557},'Hell Memories Blaze':{clip:'Hell Memories'}},
  ace:{'Kagero Blast':{clip:'Kagero',contact:.866},'Hiken Fire Fist':{clip:'Hiken',contact:.72}},
  guts:{'Cannon Arm Recoil':{clip:'Cannon Arm',contact:.5}},
};
const ULTIMATE_CLIPS:Partial<Record<FighterId,UltimateClips>>={
  toji:{"opener":{"clip":"Sorcerer Killer","at":0.1375},"cine":{"from":0.1375,"at":0.825,"windows":[[0.1375,0.375,0.2875],[0.375,0.55,0.4625],[0.55,0.73125,0.6375],[0.73125,1,0.825]]}},
  crocodile:{"opener":{"clip":"Ground Death","at":0.0829268292682927},"cine":{"from":0.0829268292682927,"at":0.7560975609756099,"windows":[[0.0829268292682927,0.5609756097560976,0.3609756097560976],[0.5609756097560976,1,0.7560975609756099]]}},
  usopp:{"opener":{"clip":"Green Star Barrage","at":0.14516129032258066},"cine":{"from":0.14516129032258066,"at":0.8387096774193549,"windows":[[0.14516129032258066,0.629032258064516,0.4139784946236559],[0.629032258064516,1,0.8387096774193549]]}},
  sakura:{"opener":{"clip":"Cherry Blossom Hurricane","at":0.17},"cine":{"from":0.17,"at":0.82,"windows":[[0.17,0.58,0.4],[0.58,1,0.82]]}},
  meliodas:{"opener":{"clip":"Hell Buster","at":0.14857142857142858},"formOpener":{"clip":"Hell Buster","at":0.14857142857142858},"cine":{"from":0.14857142857142858,"at":0.7857142857142857,"windows":[[0.14857142857142858,0.4385714285714285,0.33714285714285713],[0.4385714285714285,0.6628571428571428,0.5399999999999999],[0.6628571428571428,1,0.7857142857142857]]}},
  escanor:{"opener":{"clip":"Divine Sword Escanor","at":0.12},"cine":{"from":0.12,"at":0.7625,"windows":[[0.12,0.5,0.34],[0.5,1,0.7625]]},"formOpener":{"clip":"Divine Sword Escanor","at":0.12}},
  tatsumaki:{"opener":{"clip":"Terrible Tornado","at":0.12755102040816327},"cine":{"from":0.12755102040816327,"at":0.8010204081632654,"windows":[[0.12755102040816327,0.5357142857142857,0.39540816326530615],[0.5357142857142857,1,0.8010204081632654]]}},
  makima:{"opener":{"clip":"Absolute Control","at":0.16338028169014085},"formOpener":{"clip":"Absolute Control","at":0.16338028169014085},"cine":{"from":0.16338028169014085,"at":0.7943661971830985,"windows":[[0.16338028169014085,0.4605633802816902,0.34929577464788736],[0.4605633802816902,0.6830985915492958,0.571830985915493],[0.6830985915492958,1,0.7943661971830985]]}},
  kenpachi:{"opener":{"clip":"Kendo Ryodan","at":0.235},"cine":{"from":0.235,"at":0.775,"windows":[[0.235,1,0.775]]}},
  minato:{"opener":{"clip":"Yellow Flash Tempest","at":0.21},"cine":{"from":0.21,"at":0.8,"windows":[[0.21,0.63,0.47],[0.63,1,0.8]]}},
  'nico-robin':{"opener":{"clip":"Gran Jacuzzi Clutch","at":0.14},"cine":{"from":0.14,"at":0.82,"windows":[[0.14,0.625,0.43],[0.625,1,0.82]]}},
  'kaiju-no-8':{"opener":{"clip":"Maximum Output","at":0.18},"cine":{"from":0.18,"at":0.81,"windows":[[0.18,0.56,0.415],[0.56,1,0.81]]}},
  eren:{"formOnly":true,"formOpener":{"clip":"Advancing Rage","at":0.13333333333333333},"cine":{"from":0.13333333333333333,"at":0.8238095238095238,"windows":[[0.13333333333333333,0.43,0.3285714285714285],[0.43,0.69,0.5523809523809523],[0.69,1,0.8238095238095238]]}},
  asuka:{opener:{clip:"Nine Second Execution",at:.14},cine:{from:.14,at:.83,windows:[[.14,.44,.34],[.44,.70,.56],[.70,1,.83]]}},
  netero:{"opener":{"clip":"Ninety-Ninth Hand","at":0.13},"cine":{"from":0.13,"at":0.84,"windows":[[0.13,0.4,0.34],[0.4,0.53,0.46],[0.53,0.72,0.6],[0.72,1,0.84]]}},
  rengoku:{opener:{clip:"Ninth Form Rengoku",at:.55/4.2},cine:{from:.55/4.2,at:3.5/4.2,windows:[[.55/4.2,.47,89/252],[.47,.71,149/252],[.71,1,3.5/4.2]]}},
  shinji:{"opener":{"clip":"A.T. Field Rupture","at":0.17},"cine":{"from":0.17,"at":0.81,"windows":[[0.17,1,0.81]]}},
  jolyne:{"opener":{"clip":"Stone Ocean","at":0.125},"cine":{"from":0.125,"at":0.795,"windows":[[0.125,0.27875,0.2375],[0.27875,0.36125,0.32],[0.36125,0.44375,0.4025],[0.44375,0.52625,0.485],[0.52625,0.6125,0.5675],[0.6125,0.7262500000000001,0.6575],[0.7262500000000001,1,0.795]]}},
  'might-guy':{"opener":{"clip":"Night Guy","at":0.12562814070351758},"cine":{"from":0.12562814070351758,"at":0.7839195979899498,"windows":[[0.12562814070351758,0.49748743718592964,0.37185929648241206],[0.49748743718592964,1,0.7839195979899498]]},"formOpener":{"clip":"Night Guy","at":0.12562814070351758}},
  akame:{"opener":{"clip":"Burial of the Empire","at":0.18},"cine":{"from":0.18,"at":0.82,"windows":[[0.18,0.65,0.48],[0.65,1,0.82]]}},
  pikachu:{"opener":{"clip":"Volt Tackle","at":0.12371134020618557},"cine":{"from":0.12371134020618557,"at":0.7938144329896908,"windows":[[0.12371134020618557,0.5025773195876289,0.36597938144329895],[0.5025773195876289,1,0.7938144329896908]]}},
  garou:{"opener":{"clip":"Monster Calamity Rush","at":0.11640211640211641},"formOpener":{"clip":"Monster Calamity Rush","at":0.11640211640211641},"cine":{"from":0.11640211640211641,"at":0.798941798941799,"windows":[[0.11640211640211641,0.3531746031746032,0.2751322751322752],[0.3531746031746032,0.5105820105820106,0.4312169312169312],[0.5105820105820106,0.6944444444444444,0.58994708994709],[0.6944444444444444,1,0.798941798941799]]}},
  esdeath:{"opener":{"clip":"Mahapadma","at":0.18},"cine":{"from":0.18,"at":0.8,"windows":[[0.18,1,0.8]]}},
  mikasa:{"opener":{"clip":"Ackerman Execution","at":0.13},"cine":{"from":0.13,"at":0.805,"windows":[[0.13,0.3625,0.295],[0.3625,0.515,0.445],[0.515,0.7,0.6],[0.7,1,0.805]]}},
  'alphonse-elric':{"opener":{"clip":"Soulbound Bastion","at":0.1409090909090909},"cine":{"from":0.1409090909090909,"at":0.8090909090909091,"windows":[[0.1409090909090909,0.5,0.40454545454545454],[0.5,1,0.8090909090909091]]}},
  'ken-kaneki':{"opener":{"clip":"One-Eyed Requiem","at":0.13333333333333333},"formOpener":{"clip":"One-Eyed Requiem","at":0.13333333333333333},"cine":{"from":0.13333333333333333,"at":0.8053333333333333,"windows":[[0.13333333333333333,0.42000000000000004,0.32],[0.42000000000000004,0.6626666666666667,0.52],[0.6626666666666667,1,0.8053333333333333]]}},
  grimmjow:{"opener":{"clip":"Desgarron","at":0.19},"cine":{"from":0.19,"at":0.64,"windows":[[0.19,1,0.64]]},"formOpener":{"clip":"Desgarron","at":0.19}},
  byakuya:{"opener":{"clip":"Shukei Hakuteiken","at":0.18},"cine":{"from":0.18,"at":0.8,"windows":[[0.18,0.635,0.47],[0.635,1,0.8]]}},
  yamamoto:{"opener":{"clip":"Ennetsu Jigoku","at":0.125},"cine":{"from":0.125,"at":0.785,"windows":[[0.125,0.5,0.36],[0.5,1,0.785]]}},
  pain:{"opener":{"clip":"Chibaku Tensei","at":0.14210526315789476},"formOpener":{"clip":"Chibaku Tensei","at":0.14210526315789476},"cine":{"from":0.14210526315789476,"at":0.8105263157894738,"windows":[[0.14210526315789476,0.4565789473684211,0.36052631578947375],[0.4565789473684211,0.6815789473684211,0.5526315789473685],[0.6815789473684211,1,0.8105263157894738]]}},
  'edward-elric':{"opener":{"clip":"Fullmetal Transmutation","at":0.13725490196078433},"cine":{"from":0.13725490196078433,"at":0.8088235294117646,"windows":[[0.13725490196078433,0.5269607843137255,0.3995098039215686],[0.5269607843137255,1,0.8088235294117646]]}},
  hiei:{"opener":{"clip":"Darkness Dragon","at":0.14},"cine":{"from":0.14,"at":0.79,"windows":[[0.14,0.65,0.51],[0.65,1,0.79]]}},
  aokiji:{"opener":{"clip":"Ice Age","at":0.1217948717948718},"cine":{"from":0.1217948717948718,"at":0.7698561601000625,"windows":[[0.1217948717948718,0.5897435897435898,0.33760683760683763],[0.5897435897435898,1,0.7698561601000625]]}},
  doflamingo:{"opener":{"clip":"God Thread","at":0.1443298969072165},"cine":{"from":0.1443298969072165,"at":0.8195876288659795,"windows":[[0.1443298969072165,0.58,0.4123711340206186],[0.58,1,0.8195876288659795]]}},
  hisoka:{"opener":{"clip":"Bungee Gum Encore","at":0.1611111111111111},"cine":{"from":0.1611111111111111,"at":0.8027777777777778,"windows":[[0.1611111111111111,0.28888888888888886,0.24166666666666667],[0.28888888888888886,0.3833333333333333,0.3361111111111111],[0.3833333333333333,0.47777777777777775,0.4305555555555556],[0.47777777777777775,0.5722222222222222,0.5249999999999999],[0.5722222222222222,0.6597222222222222,0.6194444444444445],[0.6597222222222222,0.7513888888888889,0.7],[0.7513888888888889,1,0.8027777777777778]]}},
  blackbeard:{"opener":{"clip":"Liberation Worldbreaker","at":0.1326530612244898},"cine":{"from":0.1326530612244898,"at":0.8290816326530612,"windows":[[0.1326530612244898,0.58,0.3903061224489796],[0.58,1,0.8290816326530612]]}},
  nanami:{opener:{clip:"Overtime Critical Point",at:.45/3.8},cine:{from:.45/3.8,at:3.1/3.8,windows:[[.45/3.8,.43,1.2/3.8],[.43,.67,2.05/3.8],[.67,1,3.1/3.8]]}},
  josuke:{"opener":{"clip":"Break and Restore","at":0.14857142857142858},"cine":{"from":0.14857142857142858,"at":0.7885714285714285,"windows":[[0.14857142857142858,0.30714285714285716,0.26857142857142857],[0.30714285714285716,0.3842857142857143,0.3457142857142857],[0.3842857142857143,0.4614285714285714,0.4228571428571429],[0.4614285714285714,0.5385714285714286,0.5],[0.5385714285714286,0.6185714285714285,0.5771428571428572],[0.6185714285714285,0.7242857142857142,0.66],[0.7242857142857142,1,0.7885714285714285]]}},
  tsunade:{"opener":{"clip":"Paradise Pure Land","at":0.17},"cine":{"from":0.17,"at":0.8,"windows":[[0.17,0.55,0.39],[0.55,1,0.8]]}},
  jiraiya:{"opener":{"clip":"Sage Art Goemon","at":0.16},"cine":{"from":0.16,"at":0.8,"windows":[[0.16,0.66,0.56],[0.66,1,0.8]]}},
  hinata:{...HINATA_CINEMATIC,cine:{...HINATA_CINEMATIC.cine,windows:HINATA_CINEMATIC.cine.windows.map(w=>[...w] as [number,number,number])}},
  gintoki:{"opener":{"clip":"Shiroyasha Rampage","at":0.14857142857142858},"cine":{"from":0.14857142857142858,"at":0.7942857142857143,"windows":[[0.14857142857142858,0.4514285714285714,0.3485714285714286],[0.4514285714285714,0.6742857142857143,0.5542857142857143],[0.6742857142857143,1,0.7942857142857143]]}},
  kizaru:{...KIZARU_CINEMATIC,cine:{...KIZARU_CINEMATIC.cine,windows:KIZARU_CINEMATIC.cine.windows.map(w=>[...w] as [number,number,number])}},
  yamato:{...YAMATO_CINEMATIC,cine:{...YAMATO_CINEMATIC.cine,windows:YAMATO_CINEMATIC.cine.windows.map(w=>[...w] as [number,number,number])}},
  jinbe:{opener:{clip:'Vagabond Drill',at:(.8*21/26)/3.9},cine:{from:(.8*21/26)/3.9,at:(2.6+1.3*26/55)/3.9,windows:[[(.8*21/26)/3.9,2.6/3.9,(1+1.4*41/58)/3.9],[2.6/3.9,1,(2.6+1.3*26/55)/3.9]]}},
  enel:{opener:{clip:'Raigo',at:.55/3.75},cine:{from:.55/3.75,at:.84,windows:[[.55/3.75,2.5/3.75,1.85/3.75],[2.5/3.75,1,.84]]}},
  rukia: {"opener":{"clip":"White Haze","at":0.17142857142857146},"cine":{"from":0.17142857142857146,"at":0.8063492063492064,"windows":[[0.17142857142857146,0.6095238095238095,0.5015873015873016],[0.6095238095238095,1,0.8063492063492064]]}},
  yuta: {"opener":{"clip":"Pure Love","at":0.18},"cine":{"from":0.18,"at":0.81,"windows":[[0.18,0.61,0.45],[0.61,1,0.81]]}},
  yuji:{"opener": {"clip": "Eightfold Black Flash", "at": 0.1264705882352941}, "cine": {"from": 0.1264705882352941, "at": 0.8058823529411766, "windows": [[0.1264705882352941, 0.275, 0.22941176470588237], [0.275, 0.3661764705882353, 0.3205882352941177], [0.3661764705882353, 0.4573529411764706, 0.4117647058823529], [0.4573529411764706, 0.5485294117647059, 0.5029411764705882], [0.5485294117647059, 0.6426470588235295, 0.5941176470588235], [0.6426470588235295, 0.748529411764706, 0.6911764705882354], [0.748529411764706, 1, 0.8058823529411766]]}},
  todoroki:{opener:{clip:'Great Glacial Aegir',at:.155},cine:{from:.155,at:.81,windows:[[.155,.58,.46],[.58,1,.81]]}},
  endeavor:{opener:{clip:'Prominence Burn',at:.13},cine:{from:.13,at:.78,windows:[[.13,.58,.43],[.58,1,.78]]}},
  yoruichi:{opener:{clip:'Raijin Opener',at:.5},cine:{from:0,at:.78,windows:[[0,.445,.35],[.445,.66,.54],[.66,1,.78]]}},
  'all-might':{opener:{clip:'United States of Smash',at:.15},cine:{from:.15,at:.8,windows:[[.15,.51,.39],[.51,1,.8]]}},
  bakugo:{opener:{clip:'Howitzer Impact',at:.16},cine:{from:.16,at:.78,windows:[[.16,.60,.48],[.60,1,.78]]}},
  deku:{opener:{clip:'Detroit Smash Overdrive',at:.19},cine:{from:.19,at:.79,windows:[[.19,.62,.5],[.62,1,.79]]}},
  broly:{opener:{clip:'Gigantic Roar',at:.148},cine:{from:.148,at:.77,windows:[[.148,.5,.39],[.5,1,.77]]}},
  denji:{opener:{clip:'Devils Engine',at:.48/2.8},cine:{from:.48/2.8,at:2.2/2.8,windows:[[.48/2.8,1.18/2.8,1/2.8],[1.18/2.8,1.7/2.8,1.4/2.8],[1.7/2.8,1,2.2/2.8]]}},
  akainu: {...AKAINU_CINEMATIC,cine:{...AKAINU_CINEMATIC.cine,windows:AKAINU_CINEMATIC.cine.windows.map(w=>[...w] as [number,number,number])}},
  'boa-hancock':{opener:{clip:'Empress Opener',at:12/34},cine:{from:0,at:45/84,windows:[[0,1,45/84]]}},
  nami:{opener:{clip:'Thunderbolt Tempo',at:18/81},cine:{from:18/81,at:58/81,windows:[[18/81,1,58/81]]}},
  mihawk:{opener:{clip:'I Wont Hold Back',at:24/92},cine:{from:24/92,at:60/92,windows:[[24/92,1,60/92]]}},
  zoro:{opener:{clip:'Lions Song',at:.2435},cine:{from:0,at:.5085}},
  ichigo:{opener:{clip:'Getsuga Tensho',at:.3824},cine:{from:0,at:.596}},
  kakashi:{opener:{clip:'Lightning Blade',at:.6143},cine:{from:.25,at:.6291}},
  sanji:{opener:{clip:'Hell Memories Open',at:0.6452},cine:{from:0.1271,at:0.7398,windows:[[0.1271,0.2739,0.2259],[0.2739,0.3671,0.3106],[0.3671,0.5506,0.4235],[0.5506,1,0.7398]]}},
  luffy:{opener:BAJRANG_TAKE.open,formOpener:BAJRANG_TAKE.open,cine:BAJRANG_TAKE.cine},
  law:{opener:SHAMBLES_TAKE.open,cine:SHAMBLES_TAKE.cine},
  guts:{opener:{clip:'Cleave',at:.533},cine:{from:.2593,at:.7346,windows:[[.2593,.3704,.321],[.3951,.4938,.4321],[.4938,.5926,.5432],[.6173,1,.7346]]}},
  vegeta:{release:.5417},
  sasuke:{release:.6667},
  goku:{release:.653},
  naruto:{release:.5965},
  ace:{release:.652},
  'golden-frieza':{release:.58},
  'gohan-beast':{release:.76},
};
const OPENER_TAIL=WHIFF_RECOVERY+.12;
const CINE_BUILT=.55,CINE_DRIVE=.2;
const OPENER_FASTEST=2.2;
const ULTIMATE_AS_THROWN=new Map<string,MoveDefinition>();
function ultimateMove(fighter:FighterId,awakened:boolean):MoveDefinition{
  const key=fighter+(awakened?'!':'');
  let move=ULTIMATE_AS_THROWN.get(key);
  if(!move){move=awakenedMoveFor(fighter,'ultimate',awakened);ULTIMATE_AS_THROWN.set(key,move);}
  return move;
}
const FORM_CONTACT:Partial<Record<FighterId,Partial<Record<AttackSlot,number>>>>={eren:{light:.5,heavy:.54,special:.58,ultimate:.13333333333333333},asuka:{light:.46,heavy:.56,special:.58,ultimate:.14},'might-guy':{"light":0.48,"heavy":0.5212765957446809,"special":0.5441176470588235,"ultimate":0.12562814070351758},akame:{"light":0.46,"heavy":0.56,"special":0.6,"ultimate":0.18},garou:{"light":0.4464285714285714,"heavy":0.5377358490566037,"special":0.49107142857142855,"ultimate":0.11640211640211641},'ken-kaneki':{light:.46666666666666673,heavy:.5462962962962963,special:.5,ultimate:.13333333333333333},grimmjow:{light:.43,heavy:.48,special:.62,ultimate:.19},kaido:{light:.286,heavy:.194,special:.3},
  aizen:{special:.412}};
const FORM_CONTACT_BY_KEY:Partial<Record<FighterId,Record<string,number|undefined>>>={eren:{'Rush 1':.5,'Rush 2':.5,'Rush 3':.54}};
const FORM_STRING_WINDOWS:Partial<Record<FighterId,Partial<Record<AttackSlot,[number,number,number?][]>>>>={kaido:{ultimate:[[0,.32,.187],[.32,1,.556]]},
  eren:{ultimate:[[0,.23,.13333333333333333],[.23,.43,.3285714285714285],[.43,.69,.5523809523809523],[.69,1,.8238095238095238]]}};
const OWN_BODY_ULTIMATE:ReadonlySet<FighterId>=new Set<FighterId>(['toji','crocodile','usopp','rengoku','nico-robin','kaiju-no-8','eren','asuka','netero','shinji','akame','pikachu','garou','esdeath','mikasa','alphonse-elric','ken-kaneki','byakuya','yamamoto','pain','sukuna','aizen','gon','griffith','sung-jinwoo','golden-frieza','tsunade','sakura','meliodas','escanor','minato']);
const WHEEL_VIEW=THREE.MathUtils.degToRad(32),WHEEL_NOTCH=.32;
const _wheelAxis=new THREE.Vector3(),_wheelEye=new THREE.Vector3(),_wheelCross=new THREE.Vector3(),_wheelCentre=new THREE.Vector3();
const _wheelTip=new THREE.Quaternion(),_wheelParent=new THREE.Quaternion(),_wheelSpin=new THREE.Quaternion();
const WHEEL_HITS:ReadonlySet<string>=new Set(['hurt','flinch','launched','knockdown','stun']);
const STRING_WINDOWS:Partial<Record<FighterId,Partial<Record<AttackSlot,[number,number,number?][]>>>>={
  toji:{"ultimate":[[0,0.2125,0.1375],[0.2125,0.375,0.2875],[0.375,0.55,0.4625],[0.55,0.73125,0.6375],[0.73125,1,0.825]]},
  crocodile:{"ultimate":[[0,0.19512195121951223,0.0829268292682927],[0.19512195121951223,0.5609756097560976,0.3609756097560976],[0.5609756097560976,1,0.7560975609756099]]},
  usopp:{"ultimate":[[0,0.26881720430107525,0.14516129032258066],[0.26881720430107525,0.629032258064516,0.4139784946236559],[0.629032258064516,1,0.8387096774193549]],"special":[[0,1,0.5076923076923077]]},
  sakura:{"ultimate":[[0,0.285,0.17],[0.285,0.58,0.4],[0.58,1,0.82]]},
  meliodas:{"ultimate":[[0,0.24285714285714285,0.14857142857142858],[0.24285714285714285,0.4385714285714285,0.33714285714285713],[0.4385714285714285,0.6628571428571428,0.5399999999999999],[0.6628571428571428,1,0.7857142857142857]]},
  escanor:{"ultimate":[[0,0.23,0.12],[0.23,0.55,0.34],[0.55,1,0.7625]]},
  tatsumaki:{"ultimate":[[0,0.26,0.12755102040816327],[0.26,0.5357142857142857,0.39540816326530615],[0.5357142857142857,1,0.8010204081632654]]},
  makima:{"ultimate":[[0,0.2563380281690141,0.16338028169014085],[0.2563380281690141,0.4605633802816902,0.34929577464788736],[0.4605633802816902,0.6830985915492958,0.571830985915493],[0.6830985915492958,1,0.7943661971830985]]},
  kenpachi:{"ultimate":[[0,0.37,0.235],[0.37,1,0.775]]},
  minato:{"ultimate":[[0,0.34,0.21],[0.34,0.635,0.47],[0.635,1,0.8]]},
  'nico-robin':{ultimate:[[0,0.285,0.14],[0.285,0.625,0.43],[0.625,1,0.82]]},
  'kaiju-no-8':{ultimate:[[0,.29,.18],[.29,.56,.415],[.56,1,.81]]},
  eren:{ultimate:[[0,.356,.181],[.356,.457,.406],[.457,.558,.507],[.558,.658,.608],[.658,.759,.709],[.759,.86,.81],[.86,1,.915]]},
  asuka:{ultimate:[[0,.24,.14],[.24,.44,.34],[.44,.70,.56],[.70,1,.83]]},
  netero:{ultimate:[[0,0.23,0.13],[0.23,0.4,0.34],[0.4,0.53,0.46],[0.53,0.72,0.6],[0.72,1,0.84]]},
  rengoku:{ultimate:[[0,.24,.55/4.2],[.24,.47,89/252],[.47,.71,149/252],[.71,1,3.5/4.2]]},
  shinji:{ultimate:[[0,0.3,0.17],[0.3,1,0.81]]},
  jolyne:{"ultimate":[[0,0.18125,0.125],[0.18125,0.27875,0.2375],[0.27875,0.36125,0.32],[0.36125,0.44375,0.4025],[0.44375,0.52625,0.485],[0.52625,0.6125,0.5675],[0.6125,0.7262500000000001,0.6575],[0.7262500000000001,1,0.795]],"special":[[0,0.3918918918918919,0.2972972972972973],[0.3918918918918919,0.5844594594594594,0.48648648648648646],[0.5844594594594594,1,0.6824324324324325]]},
  'might-guy':{ultimate:[[0,0.3,0.12562814070351758],[0.3,0.55,0.37185929648241206],[0.55,1,0.7839195979899498]]},
  akame:{ultimate:[[0,0.33,0.18],[0.33,0.65,0.48],[0.65,1,0.82]]},
  pikachu:{ultimate:[[0,0.24484536082474226,0.12371134020618557],[0.12371134020618557,0.5025773195876289,0.36597938144329895],[0.5025773195876289,1,0.7938144329896908]]},
  garou:{ultimate:[[0,0.19576719576719578,0.11640211640211641],[0.19576719576719578,0.3531746031746032,0.2751322751322752],[0.3531746031746032,0.5105820105820106,0.4312169312169312],[0.5105820105820106,0.6944444444444444,0.58994708994709],[0.6944444444444444,1,0.798941798941799]]},
  esdeath:{ultimate:[[0,0.31,0.18],[0.31,1,0.8]]},
  mikasa:{ultimate:[[0,0.2125,0.13],[0.2125,0.37,0.295],[0.37,0.5225,0.445],[0.5225,0.7025,0.6],[0.7025,1,0.805]]},
  'alphonse-elric':{ultimate:[[0,.27,0.1409090909090909],[.27,.60,0.40454545454545454],[.60,1,0.8090909090909091]]},
  'ken-kaneki':{ultimate:[[0,0.22666666666666668,0.13333333333333333],[0.22666666666666668,0.42000000000000004,0.32],[0.42000000000000004,0.6626666666666667,0.52],[0.6626666666666667,1,0.8053333333333333]]},
  grimmjow:{ultimate:[[0,0.3,0.19],[0.3,1,0.64]]},
  byakuya:{"ultimate":[[0,0.325,0.18],[0.325,0.635,0.47],[0.635,1,0.8]]},
  yamamoto:{ultimate:[[0,.2425,.125],[.2425,.5725,.36],[.5725,1,.785]]},
  pain:{"ultimate":[[0,0.25131578947368427,0.14210526315789476],[0.25131578947368427,0.4565789473684211,0.36052631578947375],[0.4565789473684211,0.6815789473684211,0.5526315789473685],[0.6815789473684211,1,0.8105263157894738]]},
  'edward-elric':{"ultimate":[[0,0.26838235294117646,0.13725490196078433],[0.26838235294117646,0.5269607843137255,0.3995098039215686],[0.5269607843137255,1,0.8088235294117646]]},
  hiei:{"ultimate":[[0,0.3,0.14],[0.3,0.65,0.51],[0.65,1,0.79]]},
  aokiji:{"ultimate":[[0,0.25641025641025644,0.1217948717948718],[0.25641025641025644,0.5897435897435898,0.33760683760683763],[0.5897435897435898,1,0.7698561601000625]]},
  doflamingo:{"ultimate":[[0,0.25,0.1443298969072165],[0.25,0.58,0.4123711340206186],[0.58,1,0.8195876288659795]]},
  hisoka:{"ultimate":[[0,0.2013888888888889,0.1611111111111111],[0.2013888888888889,0.28888888888888886,0.24166666666666667],[0.28888888888888886,0.3833333333333333,0.3361111111111111],[0.3833333333333333,0.47777777777777775,0.4305555555555556],[0.47777777777777775,0.5722222222222222,0.5249999999999999],[0.5722222222222222,0.6597222222222222,0.6194444444444445],[0.6597222222222222,0.7513888888888889,0.7],[0.7513888888888889,1,0.8027777777777778]]},
  blackbeard:{"ultimate":[[0,0.25,0.1326530612244898],[0.25,0.58,0.3903061224489796],[0.58,1,0.8290816326530612]]},
  nanami:{ultimate:[[0,.22,.45/3.8],[.22,.43,1.2/3.8],[.43,.67,2.05/3.8],[.67,1,3.1/3.8]]},
  josuke:{"ultimate":[[0,0.20857142857142857,0.14857142857142858],[0.20857142857142857,0.30714285714285716,0.26857142857142857],[0.30714285714285716,0.3842857142857143,0.3457142857142857],[0.3842857142857143,0.4614285714285714,0.4228571428571429],[0.4614285714285714,0.5385714285714286,0.5],[0.5385714285714286,0.6185714285714285,0.5771428571428572],[0.6185714285714285,0.7242857142857142,0.66],[0.7242857142857142,1,0.7885714285714285]],"special":[[0,0.373333,0.286667],[0.373333,0.54,0.46],[0.54,1,0.62]]},
  tsunade:{ultimate:[[0,0.28,0.17],[0.28,0.55,0.39],[0.55,1,0.8]]},
  jiraiya:{ultimate:[[0,0.28,0.16],[0.28,0.66,0.56],[0.66,1,0.8]]},
  hinata:{ultimate:[[0,.17,.10],[.17,.34,.244444],[.34,.48,.383333],[.48,.62,.527778],[.62,.79,.688889],[.79,1,.861111]]},
  gintoki:{ultimate:[[0,0.24857142857142858,0.14857142857142858],[0.24857142857142858,0.4514285714285714,0.3485714285714286],[0.4514285714285714,0.6742857142857143,0.5542857142857143],[0.6742857142857143,1,0.7942857142857143]]},
  kizaru:{ultimate:[[0,.66/3.45,.39/3.45],[.66/3.45,1.62/3.45,1.32/3.45],[1.62/3.45,2.3/3.45,1.92/3.45],[2.3/3.45,1,2.74/3.45]]},
  yamato:{ultimate:[[0,.26,.54/3.72],[.26,.57,1.54/3.72],[.57,1,3.12/3.72]]},
  jinbe:{ultimate:[[0,.8/3.9,(.8*21/26)/3.9],[.8/3.9,2.6/3.9,(1+1.4*41/58)/3.9],[2.6/3.9,1,(2.6+1.3*26/55)/3.9]]},
  enel:{ultimate:[[0,.32,.55/3.75],[.32,2.5/3.75,1.85/3.75],[2.5/3.75,1,.84]]},
  rukia: {"ultimate":[[0,0.27301587301587305,0.17142857142857146],[0.27301587301587305,0.6095238095238095,0.5015873015873016],[0.6095238095238095,1,0.8063492063492064]]},
  yuta: {"ultimate":[[0,0.3,0.18],[0.3,0.61,0.45],[0.61,1,0.81]]},
  yuji:{"ultimate":[[0,0.17794117647058824,0.1264705882352941],[0.17794117647058824,0.275,0.22941176470588237],[0.275,0.3661764705882353,0.3205882352941177],[0.3661764705882353,0.4573529411764706,0.4117647058823529],[0.4573529411764706,0.5485294117647059,0.5029411764705882],[0.5485294117647059,0.6426470588235295,0.5941176470588235],[0.6426470588235295,0.748529411764706,0.6911764705882354],[0.748529411764706,1,0.8058823529411766]]},
  todoroki:{ultimate:[[0,.3,.155],[.3,.58,.46],[.58,1,.81]]},
  endeavor:{ultimate:[[0,.27,.13],[.27,.58,.43],[.58,1,.78]]},
  yoruichi:{ultimate:[[0,.24,.14],[.24,.445,.35],[.445,.66,.54],[.66,1,.78]]},
  'all-might':{ultimate:[[0,.27,.15],[.27,.51,.39],[.51,1,.8]]},
  bakugo:{ultimate:[[0,.30,.16],[.30,.60,.48],[.60,1,.78]]},
  deku:{ultimate:[[0,.35,.19],[.35,.62,.5],[.62,1,.79]]},
  broly:{ultimate:[[0,.25,.148],[.25,.5,.39],[.5,1,.77]]},
  denji:{ultimate:[[0,.72/2.8,.48/2.8],[.72/2.8,1.18/2.8,1/2.8],[1.18/2.8,1.7/2.8,1.4/2.8],[1.7/2.8,1,2.2/2.8]]},
  akainu:{ultimate:[[0,.82/3.95,.44/3.95],[.82/3.95,2.55/3.95,1.51/3.95],[2.55/3.95,1,3.15/3.95]]},
  'boa-hancock':{heavy:[[0,20/55,12/55],[20/55,35/55,27/55],[35/55,1,42/55]]},
  nami:{ultimate:[[0,38/81,18/81],[38/81,1,58/81]]},
  mihawk:{ultimate:[[0,42/92,24/92],[42/92,1,60/92]]},
  naruto:{light:[[.095,.155,.133],[.30,.53,.40],[.535,.66,.56]]},
  killua:{ultimate:[[0,.14,.10],[.14,.20,.17],[.20,.26,.23],[.26,.32,.29],[.32,.38,.35],[.38,.44,.41],[.44,1,.56]]},
  guts:{ultimate:[[0,.2346,.1852],[.2593,.3704,.321],[.3951,.4938,.4321],[.4938,.5926,.5432],[.6173,1,.7346]]},
  griffith:{ultimate:[[0,.23,.157],[.23,1,.651]]},
  meruem:{special:[[0,.5,.456],[.5,1,.615]],ultimate:[[0,.21,.134],[.21,.5,.37],[.5,1,.625]]},
  'goku-black':{ultimate:[[0,.29,.26],[.29,.55,.45],[.55,1,.776]]},
  jiren:{ultimate:[[0,.286,.095],[.286,1,.667]]},
  saitama:{ultimate:[[0,.218,.196],[.218,1,.694]]},
  akaza:{heavy:[[0,.27,.166],[.27,.46,.372],[.46,.97,.772]],ultimate:[[0,.375,.15],[.375,1,.563]]},
  itachi:{ultimate:[[0,.188,.047],[.188,.206,.197],[.206,.225,.216],[.225,.243,.234],[.243,.262,.252],[.262,.28,.271],[.28,1,.301]]},
  madara:{ultimate:[[0,.209,.133],[.209,1,.428]]},
  tanjiro:{ultimate:[[0,.5,.31],[.5,.62,.56],[.62,1,.794]]},
  levi:{ultimate:[[0,.356,.181],[.356,.457,.406],[.457,.558,.507],[.558,.658,.608],[.658,.759,.709],[.759,.86,.81],[.86,1,.915]]},
  'sung-jinwoo':{ultimate:[[0,.154,.106],[.154,.236,.195],[.236,.318,.277],[.318,.4,.359],[.4,1,.433]]},
  sukuna:{ultimate:[[0,.3,.16],[.3,.37,.335],[.37,.44,.405],[.44,.51,.475],[.51,.57,.54],[.57,1,.79]]},
  gon:{ultimate:[[0,.2414,.106],[.2414,1,.624]]},
};
const CHARGE_TREMOR=.022,CHARGE_BREATH=.016;
const HOLD_STILL=THREE.MathUtils.degToRad(50),HOLD_MOVING=THREE.MathUtils.degToRad(100);
const HOLD_IN:[number,number]=[.04,.16],HOLD_RISE=10,HOLD_FALL=16;
const HOLD_CLEAR=.15;
const HOLD_BREATH={rate:.9,spine:.05,shoulder:.045,head:.03,dip:.008};
const HOLD_SWAY={rate:.42,shift:.032,roll:.035};
const HOLD_PUMP={rate:1.9,arm:.1,skew:.35};
const HOLD_SHAKE={rates:[7.1,11.3] as [number,number],arm:.036,chest:.02,head:.014};
const HOLD_AFTER={breath:1.4,sway:.8};
const TAIL_AFTER=.06,TAIL_BLEND=.35;
const TAIL_ROOT_RATE=3.5;
const ROOT_FALL_RATE=7,ROOT_FALL_FROM=.25;
const READY_BLEND=.55;
const HIT_RISE=.08,HIT_SETTLE=.14,HIT_SWING=2*Math.PI*1.3,HIT_LIFE=.75;
const LIMB_LAG=.035,LIMB_RISE=.13;
const RUBBER={out:.08,hold:.045,settle:.05,swing:2*Math.PI*5.5,min:2,max:5.2,pull:.25,squash:.05,aim:THREE.MathUtils.degToRad(55),surface:.2,release:.14};
const RUBBER_KNUCKLES=.1;
const RUBBER_HANDS:Record<string,[string,number][]>={'light0':[['Right',1]],'light2':[['Right',1]],'light3':[['Right',1]],
  'heavy0':[['Right',1],['Left',1]],
  'ender-llh':[['Right',1]]};
const BAZOOKA={out:.035,hold:.07,back:4.2,rise:[.05,.22] as const,shake:.025,rate:17,apart:.13};
const PISTOL={out:.045,back:2.4,rise:[0,.05] as const,shake:.015,rate:17};
const _bazookaSide=new THREE.Vector3(),_bazookaFacing=new THREE.Vector3(),_bazookaTarget=new THREE.Vector3(),_bazookaShoulder=new THREE.Vector3();
const GATLING={out:.045,hold:.02,back:.065,aim:THREE.MathUtils.degToRad(80),ahead:6,min:.35};
const BAJRANG_LEAP={rise:2.6,drop:.3,travel:2.4};
const HIT_REACT={headYaw:.42,headWhip:.37,twist:.4,lean:.3,arms:.35,dip:.052};
const HIT_LIMIT={headYaw:.65,headWhip:.55,twist:.6,lean:.45,arms:.6,dip:.09};
const HIT_HEAVY:[number,number]=[1,2],HIT_HOLD=.09,HIT_SLOW=.9,HIT_WIDER=.45,HIP_SHOVE=.06,HIP_SHOVE_MOST=.17,HIP_RISE=.06,HEAD_LAG=.065;
const HIT_RING=6;
const LAUNCH_SPIN=1,LAUNCH_SPUN=.8,LAND_BOUNCE=.028,LAND_BOUNCE_MOST=.3,LAND_TIME=.42,LAND_ROLL=.55;
const LAUNCH_FLAIL={arms:.32,legs:.2,rate:2.2} as const;
const FLOOR_BOUNCE_SPEED=1.8,FLOOR_BOUNCE_PER=.04,FLOOR_BOUNCE_MOST=4,FLOOR_BOUNCE_ROLL=.5,FLOOR_FLINCH=.4;
const STEP_SPEED=.9,SKID_SPEED=3.5,STEP_REACH=.15,STEP_TIME=.15,STEP_LIFT=.07,STEP_LEAD=.06,STEP_IN=.04,STEP_FADE=.12;
const STEP_SETTLE=.05,STEP_GATHER=2;
const STEPPING_REACTIONS=new Set<string>(['hurt','flinch','stun']);
const HIT_SCALE={finisher:1.8,heavy:1.4,big:1.5,guarded:.35};
const TORSO_RADIUS:Record<FighterId,number>={toji:.18,crocodile:.24,usopp:.15,rengoku:.17,'nico-robin':.16,'kaiju-no-8':.22,eren:.15,asuka:.25,netero:.15,shinji:.22,jolyne:.16,'might-guy':.17,akame:.14,pikachu:.18,garou:.18,esdeath:.15,mikasa:.15,'alphonse-elric':.22,'ken-kaneki':.16,grimmjow:.16,byakuya:.16,yamamoto:.17,pain:.17,'edward-elric':.15,minato:.16,kenpachi:.21,makima:.15,tatsumaki:.12,escanor:.22,meliodas:.15,sakura:.15,hiei:.15,aokiji:.18,doflamingo:.20,hisoka:.17,blackbeard:.32,nanami:.17,josuke:.17,tsunade:.16,jiraiya:.18,hinata:.14,gintoki:.17,kizaru:.17,yamato:.2,jinbe:.32,enel:.17,'all-might':.23,bakugo:.16,deku:.15,yuta:0.16,rukia:0.13,yuji:.17,todoroki:.17,endeavor:.25,yoruichi:.155,broly:.24,denji:.16,akainu:.25,'boa-hancock':.16,nami:.155,mihawk:.19,zoro:.178,jotaro:.159,ichigo:.136,kakashi:.17,sasuke:.154,sanji:.135,vegeta:.152,goku:.142,
  luffy:.133,naruto:.173,ace:.136,law:.164,gojo:.146,dio:.159,guts:.188,killua:.136,
  kaido:.33,whitebeard:.205,shanks:.145,roger:.175,aizen:.15,sukuna:.15,griffith:.145,meruem:.15,'goku-black':.142,jiren:.205,'golden-frieza':.13,'gohan-beast':.15,saitama:.145,akaza:.14,itachi:.14,madara:.15,tanjiro:.13,levi:.13,'sung-jinwoo':.14,gon:.12};
const HEAD_RADIUS=.12,HEAD_LIFT=.08,CONTACT_REACH=3.6,CONTACT_MARGIN=.015;
const PUSH_RISE=16,PUSH_FALL=.45,PUSH_MOST=.3,PUSH_MOST_ARMED=.5,PUSH_MOST_HOLD=1,PUSH_AFTER=.3;
const TOUCH_BEFORE=.12,TOUCH_AFTER=.2,TOUCH_MERGE=.4,TOUCH_REACH=.04;
const PUSH_KEEP=.45,WITHDRAW=.1;
const PUSH_SELL=DREAM_IMPACT?.14:.055,PUSH_SELL_MOST=DREAM_IMPACT?.3:.13,SELL_RISE=.045,SELL_SETTLE=DREAM_IMPACT?.3:.16;
const PUSH_SELL_STRING=.055,SELL_SETTLE_STRING=.16;
const DREAM_STAND=1.55;
const UNTOUCHED=new Set<string>(['dash','defeated']);
const LAUNCH_RISE=.09,LAUNCH_SETTLE=.2,LAUNCH_LAND=Math.PI/2;
const LAUNCH_SIDE=.2,LAUNCH_DONE=.8,LAUNCH_HOLD=.12,LAUNCH_HAND=.18;
const FLOOR_GUARD=.35,FLOOR_GUARD_RATE=8,FLOOR_GUARD_LET_GO=1.2;
const FLOOR_GUARD_FRESH={within:.15,rate:1.5} as const;
const LAUNCH_LET_GO=.12,LAUNCH_UNWIND=.3;
const LAUNCH_CATCH=.12;
const LAUNCH_STALE=.5;
const LAUNCH_RISE_GUESS=6.5;
const LAUNCH={hips:.35,fold:.95,head:.5,arms:.7,legs:.6,knees:.8,trail:.35};
type Cadence={step:number;speed:number;steps:number;duration:number;phase?:number};
const CADENCE=locomotion as Partial<Record<string,Partial<Record<'run'|'walk'|'dash',Cadence>>>>;
const clean=clipKey;
export { VICTORY, VICTORY_ENTRY, FORM_NAMED_RUSH, STAND_COMMAND, SLOT_CLIP_BEFORE, ULTIMATE_CLIPS, OWN_BODY_ULTIMATE, AWAKEN_TAKE, AWAKEN_FORM_TAKE };
const CARRIED=/weapon|equipment-held|^Gintoki_LakeToya|^awaken-on|wings/i;
const HELD=/weapon.*hand|equipment-held/i;
const FEATURE=/face|eye|hair|weapon|equipment/i;
const SHADOW_LIFT:Partial<Record<FighterId,number>>={zoro:.05,luffy:.05};
const FLOOR_PATCH=(lift:number)=>`
  float peak=max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b);
  diffuseColor.rgb*=peak>1e-4?(${lift.toFixed(4)}+(1.0-${lift.toFixed(4)})*peak)/peak:1.0;`;
const REACTION_ACTIONS=new Set<string>(['hurt','flinch','launched','knockdown','getup','stun','splat']);
const STANDING_REACTIONS=new Set<string>(['hurt','flinch','stun','guard']);
const STANCE_ACTIONS=new Set<string>(['idle','guard']);

const GUARD_STRIDE=new Set<FighterId>(['jotaro','sanji','luffy','law','ace']);
const LAND_FLOOR=3,LAND_PER_SPEED=.026,LAND_RANGE:[number,number]=[.03,.15];
const LAND_FALL=.06,LAND_RISE=.3;
const ROCKED_HURT=.85,ROCKED_REEL=.45;
const REACTION_SNAP=.03,REACTION_HOLD=.055,REACTION_PEAK=.2;
const STUN_HOLD={rate:.15,release:.8,hunch:.42,after:.06,inRate:9,outRate:12} as const;
const REACTION_LEAD=.35;
const AIR_LOOP:[number,number,number]=[.45,.95,1.6];
const FLIGHT_SPREAD:Partial<Record<FighterId,readonly [number,number]>>={goku:[.3,.78]};
const LAUNCH_NO_TURN:ReadonlySet<FighterId>=new Set<FighterId>(['yamamoto']);
const FLIGHT_RATE=2;
const STANDING_RISE=new Set<FighterId>(Object.keys(FIGHTERS) as FighterId[]);
const AWAKEN_TAKE:Partial<Record<FighterId,string>>={sasuke:'Sasuke awaken',kakashi:'Kakashi awaken',killua:'Killua awaken',guts:'Guts awaken',
  jotaro:'Jotaro awaken',
  ichigo:'Ichigo awaken',
  dio:'DIO awaken',
  saitama:'Saitama awaken'};
const AWAKEN_FORM_TAKE:Partial<Record<FighterId,string>>={eren:'Attack Titan Emergence',deku:'Vigilante Resolve',broly:'Unbound Fury',guts:'Guts awaken'};
const AWAKEN_TAKE_DRIVE:Partial<Record<FighterId,number>>={ichigo:.1};
function awakenTakeTime(t:number,swap:number,drive:number){
  const from=AWAKENING_SWAP-drive,at=swap-drive;
  return t>=at?t-at+from:t*from/Math.max(1e-3,at);
}
const LAND_HOLD=.012;
const PLANT_BAND=.45,RELEASE_BAND=1.4;
const PLANT_IN=42,PLANT_OUT=16,PLANT_OUT_STRIKE=60;
const PLANT_LIMIT:[number,number]=[8.5,13];
const STEP_AUDIBLE=1.4,STEP_GAP=.18;
const LEG_REACH=.97;
const TARGET_STRIDE=1.35,CADENCE_RANGE:[number,number]=[.7,2.2];
const STRIDE_SCALE:Partial<Record<FighterId,number>>={goku:1.27};
const GAIT_RANGE:[number,number]=[1.6,6];
const VELOCITY_WINDOW=.07;
type Leg={hip:THREE.Bone;knee:THREE.Bone;ankle:THREE.Bone;upper:number;lower:number;
  planted:boolean;anchor:THREE.Vector3;plantYaw:number;weight:number;low:number;high:number;stepped:number;
  soles:{mesh:THREE.SkinnedMesh;index:number}[]};
type PoseNode={node:THREE.Object3D;samplePosition:THREE.Vector3;sampleRotation:THREE.Quaternion;sampleScale:THREE.Vector3;fromPosition:THREE.Vector3;fromRotation:THREE.Quaternion;fromScale:THREE.Vector3;blendPosition:THREE.Vector3;blendRotation:THREE.Quaternion;blendScale:THREE.Vector3;
  prevPosition:THREE.Vector3;prevRotation:THREE.Quaternion;
  sourceSpin:THREE.Vector3;sourceDrift:THREE.Vector3;
  crossTarget:THREE.Quaternion};
export type ImpactDetail={chain?:number;fromBehind?:boolean;reaction?:ReactionKind;
  outcome?:Outcome;
  lift?:number;
  big?:boolean;
  tint?:number;
  downed?:boolean};
const BIG_FLASH=.24,BIG_SHAKE=.034,BIG_HOLD_MAX=.6;
const HIT_SHAKE=[.016,.04] as const,HIT_SHAKE_TIME=[.09,.16] as const;
const REEL_LINGER=.35,REEL_RATE=.35;
const REEL_ACTIONS=new Set<PlayerState['action']>(['hurt','flinch']);
const DREAM_FLASH_RED=new THREE.Color(1,.3,.24);
const DREAM_FLASH={big:.22,finisher:.18,light:.14,bigAmount:.6,amount:.32,redden:9,flat:.5,flatLight:.28} as const;
const HIT_SHAKE_DELAY=1/30;
const IMPACT_POSE={spine:[.14,.12,.12],neck:.16,head:.22,arm:.55,in:1/30,out:.14} as const;
const LIGHT_IMPACT={share:.5,in:.05,hold:.08,tall:1.85} as const;
const IMPACT_POSE_SCALE=DREAM_IMPACT?1.15:1;
const KNOCK_BEND=1.45;
const _impactAxis=new THREE.Vector3(),_impactLocal=new THREE.Vector3(),_impactParent=new THREE.Quaternion(),_impactTurn=new THREE.Quaternion();
const BIG_SNAP=1/60;
export type AnimStyle='twos'|'snap'|'classic';
const STEP_RATE=30;
const ANIME_DRIVE=.13,ANIME_DRIVE_SHARE=.42,ANIME_SNAP=.034,ANIME_HOLD=DREAM_IMPACT?{light:.034,heavy:.034,big:.034}:{light:.034,heavy:.05,big:.067},ANIME_MIN=.1;
const SMEAR_LEAD=.11,SMEAR_TAIL=DREAM_IMPACT?.05:.035,SMEAR_SPEED=3.5,SMEAR_SECONDS=DREAM_IMPACT?.068:.045,SMEAR_MOST=DREAM_IMPACT?1.05:.8,SMEAR_REACH=.62,SMEAR_REACH_ARMED=1.1;
const SMEAR_MOST_FOOT=DREAM_IMPACT?.4:SMEAR_MOST,SMEAR_REACH_FOOT=DREAM_IMPACT?.45:SMEAR_REACH;
const SMEAR_FOOT_LIFT=.25;
const SMEAR_LIMBS=['RightArm','LeftArm','RightUpLeg','LeftUpLeg'] as const;
const heldHand=(name:string)=>{if(!HELD.test(name))return -1;const side=name.replace(/hand/gi,'');return /(^|[^a-z])(r|right)([^a-z]|$)/i.test(side)?0:/(^|[^a-z])(l|left)([^a-z]|$)/i.test(side)?1:-1;};
const _smearVel=new THREE.Vector3(),_smearRoot=new THREE.Vector3(),_smearCarry=new THREE.Vector3(),_smearSocket=new THREE.Vector3();
type Touch={from:Fighter;seq:number;index:number;at:number;slot:AttackSlot;ring:number;claimed:boolean;hx:number;hz:number;withdrawn?:boolean};
export type TouchMark={serial:number;victim:string;attacker:string;fighter:FighterId;slot:AttackSlot;chain:number;damage:number;
  x:number;y:number;z:number;hx:number;hz:number;guarded:boolean;seq?:number;index?:number};
export type TransitionKind='attack'|'motion'|'reaction'|'struck'|'loop';
const SPIN_CARRY=THREE.MathUtils.degToRad(15)*60,DRIFT_CARRY=6;
const FLIP_STEP=THREE.MathUtils.degToRad(45);


const _spin=new THREE.Quaternion(),_spinInverse=new THREE.Quaternion(),_turn=new THREE.Vector3();
function rotationVector(q:THREE.Quaternion,out:THREE.Vector3){
  let x=q.x,y=q.y,z=q.z,w=q.w;
  if(w<0){x=-x;y=-y;z=-z;w=-w;}
  const s=Math.sqrt(x*x+y*y+z*z);
  if(s<1e-9)return out.set(2*x,2*y,2*z);
  return out.set(x,y,z).multiplyScalar(2*Math.atan2(s,w)/s);
}
function fromRotationVector(v:THREE.Vector3,out:THREE.Quaternion){
  const angle=v.length();
  if(angle<1e-9)return out.set(v.x*.5,v.y*.5,v.z*.5,1).normalize();
  const s=Math.sin(angle*.5)/angle;
  return out.set(v.x*s,v.y*s,v.z*s,Math.cos(angle*.5));
}
const toonGradient=new THREE.DataTexture(new Uint8Array([110,155,203,255]),4,1,THREE.RedFormat);
toonGradient.minFilter=toonGradient.magFilter=THREE.NearestFilter;
toonGradient.generateMipmaps=false;toonGradient.colorSpace=THREE.NoColorSpace;toonGradient.needsUpdate=true;
export function bindClips(scene:THREE.Object3D,clips:THREE.AnimationClip[],label=''){
  const names:string[]=[];scene.traverse(o=>{if((o as THREE.Bone).isBone)names.push(o.name);});
  const hips=resolveSkeleton(names).get('Hips');
  const rest=hips?scene.getObjectByName(hips)?.position.length()??0:0;
  const out:THREE.AnimationClip[]=[];
  for(const clip of clips){
    let units=true;
    const tracks=clip.tracks.filter(track=>{
      const parsed=THREE.PropertyBinding.parseTrackName(track.name);
      if(!['position','quaternion','scale'].includes(parsed.propertyName))return false;
      if(!THREE.PropertyBinding.findNode(scene,parsed.nodeName))return false;
      if(parsed.propertyName==='position'&&parsed.nodeName===hips&&rest>1e-4){
        const length=Math.hypot(track.values[0],track.values[1],track.values[2]);
        if(length>rest*100||length<rest/100&&length>1e-6)units=false;
      }
      return true;
    });
    const kept=units?tracks:tracks.filter(track=>!track.name.endsWith('.position'));
    if(!units)console.warn(`${label}: ${clip.name} carries its root in other units; its translations were dropped`);
    if(!kept.length){console.warn(`${label}: ${clip.name} binds to nothing on the body and was skipped`);continue;}
    out.push(new THREE.AnimationClip(clip.name,clip.duration,kept));
  }
  return out;
}
const REACTION_CLIP=/hit 01|adapted_hit|slammed|shake|stun|electric_shock|down_end|down_lp|blownback|knockback-air|ground-impact|abdomen-fold|beam-pressure|die fall|jump spin|jump_spin/i;
const OWN_MOTION=/^(_idle|idle|00-idle|goku-ready|02-stance|stance|run|adapted_run|dash|adapted_dash)$/i;
const RIGID_STRETCH=.03;
const rigidClips=new WeakMap<THREE.AnimationClip,THREE.AnimationClip>();
function rigidReactions(clips:THREE.AnimationClip[],joints:Map<string,THREE.Bone>):THREE.AnimationClip[]{
  const rest=new Map<string,THREE.Vector3>();
  for(const [name,bone] of joints)if(name!=='Hips'&&bone.position.length()>.02)rest.set(bone.name,bone.position);
  const limb=(track:THREE.KeyframeTrack)=>track.name.endsWith('.position')?rest.get(THREE.PropertyBinding.parseTrackName(track.name).nodeName):undefined;
  const stretches=(clip:THREE.AnimationClip)=>clip.tracks.some(track=>{
    const at=limb(track);if(!at)return false;
    const length=at.length(),v=track.values;
    for(let i=0;i+2<v.length;i+=3)if(Math.abs(Math.hypot(v[i],v[i+1],v[i+2])/length-1)>RIGID_STRETCH)return true;
    return false;
  });
  if(clips.some(clip=>OWN_MOTION.test(clip.name)&&stretches(clip)))return clips;
  let changed=false;
  const out=clips.map(clip=>{
    if(!REACTION_CLIP.test(clip.name))return clip;
    let rigid=rigidClips.get(clip);
    if(!rigid){
      rigid=stretches(clip)?new THREE.AnimationClip(clip.name,clip.duration,clip.tracks.map(track=>{
        const at=limb(track);
        return at?new THREE.VectorKeyframeTrack(track.name,[0],[at.x,at.y,at.z]):track;
      })):clip;
      rigidClips.set(clip,rigid);
    }
    if(rigid!==clip)changed=true;
    return rigid;
  });
  return changed?out:clips;
}
const warmState=(fighter:FighterId):PlayerState=>({id:'warm-'+fighter,name:'Warmup',fighter,x:1000,y:0,z:1000,yaw:0,hp:1000,maxHp:1000,stamina:100,ultimate:100,action:'idle',actionStarted:0,actionDuration:0,actionTime:0,target:null,alive:true,isBot:false,grounded:true,guarding:false,cooldowns:{light:0,heavy:0,special:0,ultimate:0}});
export class FighterLibrary {
  private sources=new Map<FighterId,GLTF>();
  private warmFighters:Fighter[]=[];
  private forms=new Map<FighterId,GLTF>();
  private rush=new Map<FighterId,THREE.AnimationClip[]>();
  private loaded=new Set<FighterId>();
  private queue=new PriorityQueue<FighterId>(3);
  private used=new Map<FighterId,number>();
  background(on:boolean){this.queue.setBackground(on);}
  has(id:FighterId){return this.loaded.has(id);}
  get loadedCount(){return this.loaded.size;}
  ensure(ids:readonly FighterId[],onProgress:(label:string)=>void=()=>{},priority=1){
    if(priority>0)for(const id of ids)this.used.set(id,performance.now());
    return Promise.all([...new Set(ids)].map(id=>this.queue.request(id,async()=>{
      const definition=FIGHTERS[id];
      onProgress(`Loading ${definition.name}`);
      const loader=aheadLoader(new GLTFLoader(),[this.sources.has(id)?undefined:definition.model,this.rush.has(id)?undefined:definition.rushModel,...(definition.extraModels??[]),IDLE_PROFILES[id]?.model,this.forms.has(id)?undefined:definition.formModel,...(definition.formExtraModels??[]),definition.openHandsModel]);
      let source=this.sources.get(id);
      if(!source){source=await loader.loadAsync(definition.model);this.sources.set(id,source);}
      if(definition.rushModel&&!this.rush.has(id)){
        try{this.rush.set(id,bindClips(source.scene,(await loader.loadAsync(definition.rushModel)).animations,definition.name));}
        catch(error){console.warn(`${definition.name}: rush clips unavailable; using the body's own clips`,error);}
      }
      for(const url of [...(definition.extraModels??[]),IDLE_PROFILES[id]?.model]){
        if(!url)continue;
        try{
          const clips=bindClips(source.scene,(await loader.loadAsync(url)).animations,definition.name);
          source.animations=joinClips(source.animations,clips);
        }catch(error){console.warn(`${definition.name}: extra clips unavailable (${url})`,error);}
      }
      if(definition.formModel&&!this.forms.has(id))this.forms.set(id,await loader.loadAsync(definition.formModel));
      await bindFormExtras(loader,definition,source,this.forms.get(id),bindClips);
      {const pool=new ClipPool(),form=this.forms.get(id);shareClips(source.animations,pool);shareClips(this.rush.get(id),pool);if(form)shareClips(form.animations,pool);}
      if(id!=='luffy')for(const gltf of [source,this.forms.get(id)])if(gltf)(gltf as {parser?:unknown}).parser=undefined;
      this.loaded.add(id);onProgress(`Fighters ${this.loaded.size}/${Object.keys(FIGHTERS).length} ready`);
    },priority))).then(()=>{});
  }
  async load(onProgress:(label:string)=>void,preferred?:FighterId){
    if(preferred)await this.ensure([preferred],onProgress);
    await this.ensure(rosterPrefetch<FighterId>(RELEASED_FIGHTERS,preferred),onProgress,0);
  }
  releaseGpu(keep:ReadonlySet<FighterId>){
    const released:FighterId[]=[];
    for(const id of this.loaded){
      if(keep.has(id))continue;
      for(const root of [this.sources.get(id)?.scene,this.forms.get(id)?.scene])root?.traverse(o=>{
        const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
        mesh.geometry.dispose();
        for(const material of [mesh.material].flat())for(const value of Object.values(material))if((value as THREE.Texture|null)?.isTexture)(value as THREE.Texture).dispose();
      });
      released.push(id);
    }
    return released;
  }
  evict(keep:ReadonlySet<FighterId>,most:number){
    const spare=[...this.loaded].filter(id=>!keep.has(id)).sort((a,b)=>(this.used.get(a)??0)-(this.used.get(b)??0));
    while(this.loaded.size>most&&spare.length){
      const id=spare.shift()!;
      for(const root of [this.sources.get(id)?.scene,this.forms.get(id)?.scene])if(root)releaseTextures(root);
      this.sources.delete(id);this.forms.delete(id);this.rush.delete(id);this.loaded.delete(id);this.queue.completed.delete(id);
    }
  }
  warmup(scene:THREE.Scene,ids:readonly FighterId[]=[...this.loaded]){
    for(const fighter of ids){const f=this.create(warmState(fighter));this.warmFighters.push(f);scene.add(f.group);f.group.traverse(o=>o.visible=true);}
    return new Map(this.warmFighters.map(f=>[f.state.id,f]));
  }
  prepare(id:FighterId):THREE.Object3D[]{
    if(!this.loaded.has(id))return [];
    this.create(warmState(id)).dispose();
    return [this.sources.get(id)?.scene,this.forms.get(id)?.scene].filter((root):root is THREE.Group=>!!root);
  }
  hideWarmup(){for(const f of this.warmFighters){f.group.visible=false;f.group.removeFromParent();}}
  disposeWarmup(){for(const f of this.warmFighters)f.dispose();this.warmFighters=[];}
  private outfitBodies=new Map<string,{source:GLTF;rush?:THREE.AnimationClip[]}|'loading'|'failed'>();
  outfitReady(outfit:string|undefined,fighter:FighterId):string|undefined{
    const def=outfitFor(outfit,fighter);
    if(!def||!outfit)return undefined;
    if(!def.model)return outfit;
    const body=this.outfitBodies.get(outfit);
    if(body===undefined){this.outfitBodies.set(outfit,'loading');void this.loadOutfit(outfit,def);return undefined;}
    return typeof body==='object'?outfit:undefined;
  }
  private async loadOutfit(id:string,def:OutfitDef){
    const loader=new GLTFLoader();
    try{
      const source=await loader.loadAsync(def.model!);
      let rush:THREE.AnimationClip[]|undefined;
      if(def.rush)try{rush=bindClips(source.scene,(await loader.loadAsync(def.rush)).animations,id);}catch(error){console.warn(`outfit ${id}: rush clips unavailable (${def.rush})`,error);}
      for(const url of FIGHTERS[def.fighter].extraModels??[]){
        if(!/-(enders|fmoves|fanim)\d*\.glb$/.test(url))continue;
        try{const clips=bindClips(source.scene,(await loader.loadAsync(url)).animations,id),names=new Set(clips.map(c=>c.name));source.animations=[...source.animations.filter(c=>!names.has(c.name)),...clips];}
        catch(error){console.warn(`outfit ${id}: ender clips unavailable (${url})`,error);}
      }
      this.outfitBodies.set(id,{source,rush});
    }catch(error){console.warn(`outfit ${id}: its body did not load (${def.model}); the fighter's own is drawn`,error);this.outfitBodies.set(id,'failed');}
  }
  create(state:PlayerState,outfit?:string){
    const body=outfit?this.outfitBodies.get(outfit):undefined,own=typeof body==='object'?body:undefined;
    const source=own?.source??this.sources.get(state.fighter);
    if(!source)throw new Error(`${state.fighter} model is not loaded`);
    const fighter=new Fighter(state,source,false,own?own.rush:this.rush.get(state.fighter),outfit);
    Fighter.borrowAhead?.(source.scene,source.animations,state.fighter);
    const form=this.forms.get(state.fighter);
    if(form)fighter.attachForm(form);
    fighter.prepareRush();
    installOcclusionFade(fighter);
    return fighter;
  }
}

export class Fighter {
  static animStyle:AnimStyle='classic';
  static transplant?:(body:Fighter,state:PlayerState)=>Transplanted|undefined;
  static borrowedHurt?:(scene:THREE.Object3D,clips:readonly THREE.AnimationClip[],key:string,fighter:FighterId)=>THREE.AnimationClip|undefined;
  static borrowAhead?:(scene:THREE.Object3D,clips:readonly THREE.AnimationClip[],fighter:FighterId)=>void;
  private borrowedSeen?:WeakSet<THREE.AnimationClip>;
  private swap?:Transplanted;
  take(state:PlayerState){return {scene:this.source.scene,clips:this.clips,clip:this.groundedMelee(state)?.clip??this.clipFor(state),form:this.gear4};}
  static stepTick=0;
  static beginFrame(nowMs:number){Fighter.stepTick=Math.floor(nowMs*STEP_RATE/1000);}
  private stepNodes?:THREE.Object3D[];private stepPose?:Float32Array;private stepAt=-1;private stepEpoch=-1;
  readonly group=new THREE.Group();
  readonly model:THREE.Object3D;
  readonly mixer:THREE.AnimationMixer;
  readonly bones=new Map<string,THREE.Bone>();
  readonly clips:THREE.AnimationClip[];
  readonly handR=new THREE.Vector3();
  readonly handL=new THREE.Vector3();
  state:PlayerState;
  private active?:THREE.AnimationAction;
  private gear4?:Fighter;
  private carriedVelocity?:THREE.Vector3;
  private formReveal=0;
  private formEye={value:new THREE.Vector3(0,1000,0)};
  private formOpacity={value:1};
  private haki={value:0};
  private laughFace?:THREE.Object3D;private plainFace?:THREE.Object3D;
  private openHands:THREE.Object3D[]=[];private fists:THREE.Object3D[]=[];
  private openSides:('L'|'R')[]=[];
  private floating=false;private formLift=0;private formLiftDrawn=0;private formLandedAt=-9;private formWasGrounded=true;private floatClock=0;private floatPhase=0;
  private floatOffset=0;
  private awaken={value:0};
  targetDistance=Infinity;
  targetPoint?:THREE.Vector3;
  cameraPoint?:THREE.Vector3;
  private formMaterials:THREE.Material[]=[];
  private risenAt=-9;
  attachForm(source:GLTF){
    const look=AWAKENINGS[this.state.fighter];
    const worn=look.formTint!==undefined,names=new Set(COMBO_KEYS.map(key=>comboClip(this.state.fighter,key)?.clip).filter((name):name is string=>!!name));
    const carried=worn?this.clips.filter(c=>names.has(c.name)&&!source.animations.some(a=>a.name===c.name)):[];
    this.gear4=new Fighter({...this.state,x:0,y:0,z:0,yaw:0},source,true,carried.length?bindClips(source.scene,carried,`${this.state.fighter} form`):undefined);
    this.gear4.owner=this;
    this.group.add(this.gear4.group);
    this.gear4.group.visible=false;
    const formRoot=this.gear4.group,update=formRoot.updateMatrixWorld;
    formRoot.updateMatrixWorld=function(this:THREE.Object3D,force?:boolean){if(this.visible)update.call(this,force);};
    this.gear4.group.scale.setScalar(look.formScale??1);
    this.gear4.group.position.z=look.formForward??0;
    if(this.state.fighter==='naruto'){
      for(const body of [this,this.gear4])body.model.traverse(object=>{
        const mesh=object as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;
        const fox=body===this.gear4;
        if(fox&&!mesh.geometry.hasAttribute('foxTailWeight')){
          const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
          const tail=new Float32Array(indices.count);
          for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++)if(/^Tail/i.test(mesh.skeleton.bones[indices.getComponent(i,j)]?.name??''))tail[i]+=weights.getComponent(i,j);
          mesh.geometry.setAttribute('foxTailWeight',new THREE.BufferAttribute(tail,1));
        }
        const materials=Array.isArray(mesh.material)?[...mesh.material]:[mesh.material];
        if(mesh.castShadow){
          mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
          mesh.customDistanceMaterial=new THREE.MeshDistanceMaterial();
          for(const shadow of [mesh.customDepthMaterial,mesh.customDistanceMaterial]){
            shadow.onBeforeCompile=shader=>{
              shader.uniforms.uFormShadowOpacity=body.formOpacity;
              shader.fragmentShader='uniform float uFormShadowOpacity;\n'+shader.fragmentShader;
              shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>','diffuseColor.a*=uFormShadowOpacity;\n#include <alphahash_fragment>');
            };
            shadow.customProgramCacheKey=()=> 'naruto-reveal-shadow-v1';
          }
          materials.push(mesh.customDepthMaterial,mesh.customDistanceMaterial);
          body.outlineMaterials.push(mesh.customDepthMaterial,mesh.customDistanceMaterial);
        }
        for(const material of materials){
          material.alphaHash=true;material.needsUpdate=true;
          if(!fox)continue;
          const compile=material.onBeforeCompile,cache=material.customProgramCacheKey();
          material.onBeforeCompile=(shader,renderer)=>{
            compile.call(material,shader,renderer);shader.uniforms.uFoxEye=this.formEye;
            shader.vertexShader='attribute float foxTailWeight;uniform vec3 uFoxEye;varying float vFoxTail;varying float vFoxDistance;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvFoxTail=foxTailWeight;vFoxDistance=distance((modelMatrix*vec4(transformed,1.)).xyz,uFoxEye);');
            shader.fragmentShader='varying float vFoxTail;varying float vFoxDistance;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>','diffuseColor.a*=mix(1.,smoothstep('+FOX_CLEAR[0].toFixed(2)+','+FOX_CLEAR[1].toFixed(2)+',vFoxDistance),vFoxTail);\n#include <alphahash_fragment>');
          };
          material.customProgramCacheKey=()=>cache+'-fox-tail-clearance-v3';
        }
      });
    }
    if(look.formTint===undefined){
      this.formHover=this.gear4.restHover();
      this.gear4.group.position.y=-this.formHover;
    }
    if(look.formTint!==undefined){
      const tint=new THREE.Color(look.formTint);
      this.gear4.model.traverse(o=>{
        const mesh=o as THREE.Mesh;
        if(!mesh.isMesh)return;
        mesh.castShadow=false;
        for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
          const m=material as THREE.MeshToonMaterial;
          if(m.userData.ink){m.visible=false;continue;}
          m.color.copy(tint);m.map=null;m.emissive.copy(tint).multiplyScalar(.25);
          m.transparent=true;m.opacity=look.formOpacity??.6;m.depthWrite=false;
          m.forceSinglePass=true;
          this.formMaterials.push(m);
        }
      });
    }
  }
  private restHover(){
    const clip=this.active?.getClip();
    if(!clip||!this.active)return 0;
    const frames=Math.max(8,Math.ceil(clip.duration*30));
    let lowest=Infinity;
    for(let i=0;i<=frames;i++){
      this.active.time=clip.duration*(i/frames);
      this.mixer.update(0);
      this.group.updateMatrixWorld(true);
      lowest=Math.min(lowest,this.lowestSupport());
    }
    this.active.time=0;this.mixer.update(0);this.group.updateMatrixWorld(true);
    if(!Number.isFinite(lowest))return 0;
    return lowest-this.group.getWorldPosition(this.fallback).y;
  }
  private floatForm(dt:number,real:number,state:PlayerState,elapsed:number){
    const form=this.gear4!;
    if(state.grounded&&!this.formWasGrounded)this.formLandedAt=this.floatClock;
    this.formWasGrounded=state.grounded;this.floatClock+=real;
    const arriving=state.action==='awaken'?THREE.MathUtils.smoothstep(elapsed,awakeningSwapAt(state.fighter),AWAKENING_ENTRY):1;
    this.formLift+=(floatTarget(state)*arriving-this.formLift)*(1-Math.exp(-real*G5_FLOAT.ease));
    const lift=this.formLift+floatBob(this.floatClock,this.floatPhase)*Math.min(1,this.formLift/G5_FLOAT.striking)-floatLanding(this.floatClock-this.formLandedAt);
    this.formLiftDrawn=lift;
    if(dt>0){
      let target=-this.formHover+lift;
      if(state.grounded&&!REACTION_ACTIONS.has(state.action)){
        form.group.position.y=this.floatOffset;form.group.updateMatrixWorld(true);
        const lowest=form.lowestSupport();
        if(Number.isFinite(lowest))target=Math.max(target,this.floatOffset+this.group.position.y+lift-lowest);
      }
      this.floatOffset+=THREE.MathUtils.clamp((target-this.floatOffset)*(1-Math.exp(-dt*10)),-1.5*dt,3*dt);
    }
    form.group.position.y=this.floatOffset;
  }
  get formOffset(){return this.gear4?.group.position.y;}
  formSole(){
    if(!this.gear4||!this.gear4.group.visible)return undefined;
    this.gear4.group.updateMatrixWorld(true);
    const lowest=this.gear4.lowestSupport();
    return Number.isFinite(lowest)?lowest-this.group.getWorldPosition(this.fallback).y:undefined;
  }
  private actionKey='';
  private readonly source:GLTF;
  private rushPlan?:{ground:(THREE.AnimationClip|undefined)[];air:(THREE.AnimationClip|undefined)[]};
  private rushAuthored=new Set<THREE.AnimationClip>();
  private rushMoves:MoveDefinition[]=[];
  private rushFractions=new Map<THREE.AnimationClip,number>();
  private lastSeq?:number;
  private lastStage=0;
  private hitFreeze=0;
  private hitFlash=0;
  readonly flash={value:new THREE.Vector4(1,1,1,0)};
  readonly flashFlat={value:0};
  readonly smear={point:{value:new THREE.Vector4(0,0,0,.6)},motion:{value:new THREE.Vector4(0,1,0,0)},limb:{value:new THREE.Vector4(1,0,0,0)}};
  private smearLimbs?:THREE.Vector3[];private smearPrev?:THREE.Vector3[];private smearPrevRoot=new THREE.Vector3();private smearSeen=false;private smearAt=0;
  private stepRepeat=false;
  private flashTotal=.12;private flashBig=false;private readonly flashTint=new THREE.Color(1,1,1);
  private bigLeft=0;private bigSnap=false;private bigHx=0;private bigHz=0;private bigStopSeen=false;
  private bigKnock=false;
  private shakeLeft=0;private shakeTotal=1;private shakeSize=0;private shakeHx=0;private shakeHz=0;
  private impactWeight=0;
  private impactLight=false;
  private lightHeld=0;
  private impactApplied=new Map<THREE.Object3D,{base:THREE.Quaternion;written:THREE.Quaternion}>();
  private readonly shakeDrawn=new THREE.Vector3();
  private hitSlot?:AttackSlot;
  private hitStyle?:string;
  private hitContactIndex?:number;
  private landingStarted?:number;
  private landingDuration?:number;
  private strikeContact=false;
  private poseNodes:PoseNode[]=[];
  private poseByNode=new Map<THREE.Object3D,PoseNode>();
  private poseSamplers=new Map<THREE.AnimationClip,{node:THREE.Object3D;property:string;interpolant:THREE.Interpolant}[]>();
  private blendTime=0;
  private ragdoll?:Ragdoll;
  private deathSettle=0;
  private deathClock=0;
  private stopDip=0;
  private lastWorld=new THREE.Vector3();
  private lastWorldAt=-1;
  private deathVelocity=new THREE.Vector3();
  private heldPins:{node:THREE.Object3D;position:THREE.Vector3}[]=[];
  readonly joints=new Map<string,THREE.Bone>();
  private blendDuration=0;
  private rootBlendDuration=0;
  private rootBlendTime=0;
  private rootGrip=1;
  private rootClamped=false;
  private rootFromClamped=false;
  private rootDrawnLast=new THREE.Vector3();
  private rootDrawnFrom=new THREE.Vector3();
  private previousAction='idle';
  private actionEpoch=0;
  private previousPhase='';
  private reactionEpoch=0;
  private blendedEpoch=-1;
  private reactionClock=0;
  private blowAt=-Infinity;
  private airClock=0;
  private airTurn=0;
  private standingRise=false;
  private airStep=0;
  private lastStarted=-1;
  private lastProgress=0;
  private drawnEpoch=-1;
  private drawnProgress=0;
  private moveClock=0;
  private clockAction='';
  private clockSeq?:number;
  private clockStage=0;
  private clockStarted=-1;
  private clockTime=0;
  private clockSeconds=0;
  private clockLag=0;
  private clockHeldAt=-Infinity;
  private readonly drawn={} as PlayerState;
  private freezeSeen=0;
  private freezeHonoured=false;
  private previousPosition=new THREE.Vector3();
  private motionWindow:{x:number;y:number;z:number;gap:number}[]=[];
  private motionSpan=0;
  private motionPending=0;
  private locomotionSpeed=0;
  private travelled=0;
  private stride=0;
  private strideClock=0;
  private legNodes?:Set<THREE.Object3D>;
  private jumpAge=0;
  private falling=false;
  private fallFrom=0;
  private fallAt=0;
  private supportVertices:{mesh:THREE.SkinnedMesh;index:number}[]=[];
  private pelvis?:THREE.Bone;
  private secondary?:SecondaryMotion;
  private rootBone?:THREE.Bone;
  private rootReference=new THREE.Vector3();
  private rootSiblings:THREE.Bone[]=[];
  private rootChain=new Set<THREE.Object3D>();
  private rootOffset=0;
  private aimWeight=0;
  private neckBone?:THREE.Bone;
  private headBone?:THREE.Bone;
  impact(recipient=true,slot?:AttackSlot,style?:string,contactIndex?:number,direction?:THREE.Vector3,damage?:number,height?:number,detail?:ImpactDetail,paired?:LandedBlow|null){
    const finisher=slot==='light'&&(detail?.chain??0)>=RUSH_STAGES-1;
    this.hitFreeze=recipient?(finisher?.1:.07):(finisher?.07:.05);
    this.struck=true;
    const blow=!recipient||detail?.reaction===undefined?undefined:paired===undefined?LANDED.pair(this.state.id,slot,contactIndex):paired??undefined;
    const ahead=recipient&&!blow&&paired===undefined&&detail?.reaction!==undefined?LANDED.predictedOn(this.state.id,slot,contactIndex):undefined;
    if(recipient&&ahead){
      let touch:Touch|undefined;
      for(const t of this.touches)if(!t.withdrawn&&t.seq===ahead.seq&&t.index===ahead.contact&&t.from.state.id===ahead.attacker){touch=t;break;}
      const ring=this.takeBlow(slot,style,contactIndex,direction,damage,height,detail,finisher,touch);
      const from=touch?undefined:Fighter.bodyOf(ahead.attacker);
      if(from){this.touches.push({from,seq:ahead.seq,index:ahead.contact,at:this.reactTime,slot:slot??'heavy',ring,claimed:false,hx:direction?.x??0,hz:direction?.z??0});if(this.touches.length>6)this.touches.shift();}
    }else if(recipient){
      this.takeBlow(slot,style,contactIndex,direction,damage,height,blow?.outcome&&detail&&!detail.outcome?{...detail,outcome:blow.outcome}:detail,finisher,this.claimTouch(slot,contactIndex,direction,blow));
    }else{
      this.strikeContact=true;
      const drive=DREAM_IMPACT&&!OWN_STEPS.has(this.state.fighter)&&!this.armed&&!this.blades?.length;
      if(direction){_leanAxis.copy(direction).setY(0);if(_leanAxis.lengthSq()>1e-6)this.recoil.copy(_leanAxis.normalize()).multiplyScalar(drive?DRIVE.lean:-.07);}
      this.drove=drive;this.driving=drive?DRIVE.hold:0;
    }
    if(this.gear4?.group.visible&&AWAKENINGS[this.state.fighter].kind==='form')this.gear4.impact(recipient,slot,style,contactIndex,direction,damage,height,detail,blow??null);
  }
  private takeBlow(slot:AttackSlot|undefined,style:string|undefined,contactIndex:number|undefined,direction:THREE.Vector3|undefined,damage:number|undefined,height:number|undefined,detail:ImpactDetail|undefined,finisher:boolean,confirms?:Touch,touched=false){
    this.hitByTouch=touched;
    if(!confirms){this.reactionEpoch++;this.reactionClock=0;this.blowAt=this.reactTime;
      const guarded=!detail?.reaction&&(this.state.action==='guard'||!!this.state.guarding);
      if(!guarded){
        this.flashBig=!!detail?.big;this.flashTotal=this.hitFlash=DREAM_IMPACT?(this.flashBig?DREAM_FLASH.big:finisher?DREAM_FLASH.finisher:DREAM_FLASH.light):this.flashBig?BIG_FLASH:finisher?.17:.12;
        {const worth=THREE.MathUtils.clamp(((damage??40)*(finisher?1.4:1)-20)/120,0,1),flat=direction?Math.hypot(direction.x,direction.z):0;
          this.shakeTotal=this.shakeLeft=THREE.MathUtils.lerp(HIT_SHAKE_TIME[0],HIT_SHAKE_TIME[1],worth)+HIT_SHAKE_DELAY;this.shakeSize=THREE.MathUtils.lerp(HIT_SHAKE[0],HIT_SHAKE[1],worth);
          if(flat>1e-4){this.shakeHx=direction!.x/flat;this.shakeHz=direction!.z/flat;}else{this.shakeHx=-Math.sin(this.facing);this.shakeHz=-Math.cos(this.facing);}}
        if(DREAM_IMPACT)this.flashTint.copy(DREAM_FLASH_RED);else if(this.flashBig&&detail?.tint!==undefined)this.flashTint.setHex(detail.tint);else this.flashTint.setRGB(.62,.94,1);
      }
    }
    if(detail?.big){
      this.bigLeft=BIG_HOLD_MAX;if(!confirms)this.bigSnap=true;
      const flat=direction?Math.hypot(direction.x,direction.z):0;
      if(flat>1e-4){this.bigHx=direction!.x/flat;this.bigHz=direction!.z/flat;}else{this.bigHx=-Math.sin(this.facing);this.bigHz=-Math.cos(this.facing);}
      this.bigKnock=detail.outcome==='knockdown'||detail.reaction==='knockdown'||detail.outcome==='groundBounce';
    }
    this.hitSlot=slot;this.hitStyle=style;this.hitContactIndex=contactIndex;
    this.landingStarted=undefined;this.landingDuration=undefined;
    this.hitDamage=(damage??40)*(finisher?1.35:1);
    this.hitBehind=!!detail?.fromBehind;
    let ring=-1;
    if(direction){
      const force=THREE.MathUtils.clamp((damage??40)/260*(finisher?1.4:1),.12,1);
      const rise=direction.lengthSq()>1e-6?direction.y/direction.length():0;
      const facing=this.facing;
      _leanAxis.copy(direction).setY(0);
      if(_leanAxis.lengthSq()>1e-6){
        _leanAxis.normalize();
        this.hitBehind=detail?.fromBehind??_leanAxis.x*Math.sin(facing)+_leanAxis.z*Math.cos(facing)>.2;
        this.recoil.copy(_leanAxis).multiplyScalar(.30*force);
        this.hitTwist=THREE.MathUtils.clamp(
          (_leanAxis.x*Math.cos(facing)-_leanAxis.z*Math.sin(facing))*.42*force*(this.hitBehind?-1:1),-.28,.28);
      }
      this.hitHeight=height??1.2;
      const high=THREE.MathUtils.clamp((this.hitHeight-FOLD_LOW)/(FOLD_HIGH-FOLD_LOW),0,1);
      this.hitFold=THREE.MathUtils.clamp((THREE.MathUtils.lerp(.36,-.30,high)-rise*.24)*force*(this.hitBehind?-1:1),-.34,.34);
      if(_leanAxis.lengthSq()>1e-6){
        const across=_leanAxis.x*Math.cos(facing)-_leanAxis.z*Math.sin(facing);
        const stage=detail?.chain??this.hitCount;
        const side=Math.abs(across)>.35?Math.sign(across):stage%2===0?1:-1;
        if(DREAM_IMPACT&&!confirms)this.hurtTake=Fighter.dreamTakes&&!this.hitBehind?dreamHurt(stage,side):undefined;
        const guarded=this.state.action==='guard'&&!detail?.reaction;
        const worth=THREE.MathUtils.clamp(.6+(damage??40)/160,.7,1.8);
        const scale=worth*(guarded?HIT_SCALE.guarded:finisher?HIT_SCALE.finisher:slot==='heavy'?HIT_SCALE.heavy:slot==='special'||slot==='ultimate'?HIT_SCALE.big:1)
          *(detail?.downed?FLOOR_FLINCH:1)
          *(DREAM_IMPACT&&!detail?.downed&&detail?.reaction!=='launched'&&detail?.reaction!=='knockdown'?DREAM_STAND:1);
        const standing=DREAM_IMPACT&&!detail?.downed&&detail?.reaction!=='launched'&&detail?.reaction!=='knockdown'?DREAM_STAND:1;
        const heavy=guarded?0:THREE.MathUtils.smoothstep(scale/standing,HIT_HEAVY[0],HIT_HEAVY[1]);
        const held=confirms?this.hits[confirms.ring]:undefined;
        if(held&&held.at===confirms!.at){
          ring=confirms!.ring;
          if(scale>held.scale){held.scale=scale;held.heavy=Math.max(held.heavy,heavy);}
          this.hitHeavy=Math.max(this.hitHeavy,held.heavy);
        }else{
          this.hitHeavy=heavy;
          ring=this.hitCursor;
          const lead=detail?.big?HIT_RISE*(1+.3*heavy):0;
          this.hits[this.hitCursor]={at:this.reactTime-lead,hx:_leanAxis.x,hz:_leanAxis.z,side,scale,heavy,gone:Infinity,stand:standing};
          this.hitCursor=(this.hitCursor+1)%HIT_RING;this.hitCount++;
        }
        const sell=Math.min(PUSH_SELL_MOST,DREAM_IMPACT?THREE.MathUtils.lerp(PUSH_SELL_STRING*scale/standing,PUSH_SELL*scale,heavy):PUSH_SELL*scale);
        const settle=DREAM_IMPACT?THREE.MathUtils.lerp(SELL_SETTLE_STRING,SELL_SETTLE,heavy):SELL_SETTLE;
        if(!confirms){this.sellAt=this.reactTime;this.sellAmount=sell;this.sellSettle=settle;this.sellDir.set(_leanAxis.x,0,_leanAxis.z);this.sellGone=Infinity;}
        else if(this.reactTime-this.sellAt<=SELL_RISE&&sell>this.sellAmount){this.sellAmount=sell;this.sellSettle=Math.max(this.sellSettle,settle);}
        if(detail?.reaction==='launched')this.startLaunch(detail,slot,finisher,_leanAxis.x,_leanAxis.z,across,side);
        if(detail?.downed){
          this.landedAt=this.reactTime;this.landRoll=FLOOR_BOUNCE_ROLL;this.launchHeading.set(_leanAxis.x,0,_leanAxis.z);
          this.launchSide=_leanAxis.x*Math.sin(facing)+_leanAxis.z*Math.cos(facing)>LAUNCH_SIDE?-1:1;
          this.landSpeed=Math.min(FLOOR_BOUNCE_MOST,FLOOR_BOUNCE_SPEED+(damage??0)*FLOOR_BOUNCE_PER);
        }
      }
    }
    if(detail?.reaction==='launched'&&this.launchAt!==this.reactTime){const facing=this.facing;this.startLaunch(detail,slot,finisher,-Math.sin(facing),-Math.cos(facing),0,1);}
    return ring;
  }
  private startLaunch(detail:ImpactDetail|undefined,slot:AttackSlot|undefined,finisher:boolean,hx:number,hz:number,across:number,side:number){
    const again=this.launchWeight>0&&this.launchAt>=0&&!this.state.grounded&&this.state.action==='launched';
    this.launchCarry=again?this.launchPitch:0;this.spinCarry=again?this.lastSpin:0;
    for(let i=0;i<4;i++)this.launchHeld[i]=again?this.launchLast[i]:0;
    if(!again){this.launchHeading.set(hx,0,hz);const facing=this.facing;this.launchSide=Math.sin(facing)*hx+Math.cos(facing)*hz>LAUNCH_SIDE*Math.hypot(hx,hz)?-1:1;}
    this.launchAt=this.reactTime;this.launchRise=0;this.launchFrom=NaN;this.launchArc=0;
    const outcome=detail?.outcome,short=!!outcome&&outcome!=='launch'&&outcome!=='stagger'&&outcome!=='spin';
    this.launchGuess=outcome&&outcome!=='stagger'&&outcome!=='spin'&&outcome!=='dizzy'?OUTCOME_LIFT[outcome]:LAUNCH_RISE_GUESS;
    this.launchLed=!!detail?.lift;if(detail?.lift)this.launchGuess=detail.lift;
    this.launchTurns=!short&&this.state.grounded&&(finisher||slot==='heavy'||slot==='special'||slot==='ultimate')&&!(FLIGHT_SPREAD[this.state.fighter]&&!this.isForm)&&!LAUNCH_NO_TURN.has(this.state.fighter)?1:0;
    this.launchSpin=this.launchTurns&&(slot==='special'||slot==='ultimate'||Math.abs(across)>.5)?LAUNCH_SPIN*side:0;
  }
  private claimTouch(slot:AttackSlot|undefined,contactIndex:number|undefined,direction:THREE.Vector3|undefined,blow?:LandedBlow){
    let best:Touch|undefined;
    if(blow){
      for(const touch of this.touches)if(!touch.claimed&&touch.seq===blow.seq&&touch.index===blow.contact&&touch.from.state.id===blow.attacker){best=touch;break;}
      if(!best)for(const touch of this.touches)if(!touch.claimed&&touch.from.state.id===blow.attacker&&LANDED.same(LANDED.blow(blow.attacker,touch.seq,this.state.id,touch.index),blow)){best=touch;break;}
    }else for(const touch of this.touches){
      if(touch.claimed||this.reactTime-touch.at>TOUCH_MERGE||touch.slot!==slot)continue;
      if(contactIndex!==undefined&&touch.index!==contactIndex)continue;
      if(direction){const flat=Math.hypot(direction.x,direction.z);if(flat>1e-3&&(direction.x*touch.hx+direction.z*touch.hz)/flat<.2)continue;}
      if(!best||touch.at>best.at)best=touch;
    }
    if(best)best.claimed=true;
    return best;
  }
  private withdrawRejected(){
    for(const touch of this.touches){
      if(touch.claimed||touch.withdrawn||!LANDED.refused(LANDED.blow(touch.from.state.id,touch.seq,this.state.id,touch.index)))continue;
      this.withdraw(touch);
      const form=this.drawnBody();
      if(form!==this)for(const inner of form.touches)if(!inner.withdrawn&&inner.from===touch.from&&inner.seq===touch.seq&&inner.index===touch.index)form.withdraw(inner);
    }
  }
  private withdraw(touch:Touch){
    touch.withdrawn=touch.claimed=true;
    const held=this.hits[touch.ring];
    if(held&&held.at===touch.at&&held.gone===Infinity)held.gone=this.reactTime;
    if(this.sellAt===touch.at&&this.sellGone===Infinity)this.sellGone=this.reactTime;
  }
  private static letGo(t:number){return t<=0?1:1-THREE.MathUtils.smoothstep(t,0,WITHDRAW);}
  private static bodyOf(id:string){for(const body of Fighter.drawn)if(body.state.id===id)return body;return undefined;}
  private static sellEnvelope(t:number,settle=SELL_SETTLE){
    if(t<=0)return 0;
    if(t<SELL_RISE){const u=t/SELL_RISE;return u*u*(3-2*u);}
    return Math.exp(-(t-SELL_RISE)/settle);
  }
  private started=false;
  private posed=false;
  private outlineMaterials:THREE.Material[]=[];
  readonly threatInk=threatInk();
  private rightBone?:THREE.Bone;
  private leftBone?:THREE.Bone;
  private rightReach?:THREE.Vector3;
  private leftReach?:THREE.Vector3;
  private blades?:{bone:THREE.Object3D;tip:THREE.Vector3}[];
  private leanChain:THREE.Bone[]=[];
  private bodyJoints?:Set<THREE.Object3D>;
  private legs:Leg[]=[];
  private legPresentation=new Map<THREE.Bone,THREE.Quaternion>();
  private legLength=0;
  readonly steps:{x:number;y:number;z:number;speed:number}[]=[];
  private serverTime=0;
  private walkClip?:THREE.AnimationClip;
  private runClip?:THREE.AnimationClip;
  private gait=0;
  private gaitBlend=0;
  private strideClip?:THREE.AnimationClip;
  private strideWalking?:boolean;
  private strideWeight=0;
  private legPhase=0;
  private legMask?:Set<THREE.Object3D>;
  private recoil=new THREE.Vector3();
  private hitFold=0;
  private stunHunch=0;
  private hitHeavy=0;
  private hitTwist=0;
  private hitHeight=1.2;
  private hitByTouch=false;
  private hitDamage=40;
  private hitBehind=false;
  private hurtTake?:string;
  private takeOn?:keyof typeof DREAM_HURTS;
  private takeFold=1;
  private takeLean=1;
  private driving=0;
  private drove=false;
  private takeHunch=1;
  private takeTurn=0;
  private owner?:Fighter;
  private get facing(){return this.group.rotation.y+(this.owner?.group.rotation.y??0);}
  private readonly isForm:boolean;
  private landDip=0;
  private landPeak=0;
  private landAge=0;
  private landHeld=false;
  private sinceGrounded=0;
  private loopAction:THREE.AnimationAction|null=null;
  private loopTime=0;
  private aimYaw=0;
  private aimPitch=0;
  private strideFloor=Infinity;
  private chargeHold=0;
  private chargeWanted=0;
  private animSpeed=0;
  private holdJoints?:Set<THREE.Object3D>;
  private stillFor=0;
  private stillHeld=false;
  private holdWeight=0;
  private holdCharge=1;
  private holdClock=0;
  private hits:{at:number;hx:number;hz:number;side:number;scale:number;heavy:number;gone:number;stand?:number}[]=[];
  private hitCursor=0;
  private hitCount=0;
  private reactTime=0;
  private reactAhead=0;
  private touches:Touch[]=[];
  readonly push=new THREE.Vector3();
  private pushDrawn=new THREE.Vector3();
  private pushBudget=0;
  private sellAt=-10;
  private sellAmount=0;
  private sellSettle=SELL_SETTLE;
  private sellNow=0;
  private sellDir=new THREE.Vector3();
  private plantLower=0;
  private plantRaise=0;
  private sellGone=Infinity;
  private knuckles?:(THREE.Object3D|undefined)[];
  static contact=true;
  static readonly touchLog:TouchMark[]=[];
  private static touchSerial=0;
  private hipShove=new THREE.Vector3();
  private shoveAnkles=[new THREE.Vector3(),new THREE.Vector3()];
  private legAnkles=[new THREE.Vector3(),new THREE.Vector3()];
  private launchSpin=0;
  private landedAt=-1;
  private landSpeed=0;
  private landRoll=1;
  private wasLaunched=false;
  private launchFall=0;
  private staggerWeight=0;
  private staggerAt=[new THREE.Vector3(),new THREE.Vector3()];
  private staggerFrom=[new THREE.Vector3(),new THREE.Vector3()];
  private staggerSwing=[-1,-1];
  private staggerTarget=[new THREE.Vector3(),new THREE.Vector3()];
  private staggerRoot=new THREE.Vector3(NaN,NaN,NaN);
  private staggerGathered=0;
  private staggerVelocity=new THREE.Vector3();
  private launchAt=-1;
  private launchHeading=new THREE.Vector3();
  private launchRise=0;
  private launchWeight=0;
  private launchFrom=NaN;
  private launchTurns=0;
  private launchArc=0;
  private launchSide=1;
  private launchLand=NaN;private launchDrawn=NaN;
  private bounceDrawn=0;private clipUnder=0;
  private handAt=-1;private handHold=0;
  private thrown(state:PlayerState){
    return state.alive&&!this.ragdoll&&(state.action==='launched'||state.action==='knockdown'||state.action==='getup'&&!this.standingRise)&&state.y>=this.groundY-.05;
  }
  private launchCarry=0;
  private launchGuess=LAUNCH_RISE_GUESS;
  private launchLed=false;
  private spinCarry=0;
  private readonly launchLast=[0,0,0,0];
  private readonly launchHeld=[0,0,0,0];
  private lastSpin=0;
  private rubberSpan=0;
  private rubberLine=[new THREE.Vector3(),new THREE.Vector3()];
  private rubberLocked=[false,false];
  private rubberOffset=[new THREE.Vector3(),new THREE.Vector3()];
  private rubberGive=new THREE.Vector3();
  private rubberGiven=0;
  private rubberEpoch=-1;
  private rubberRelease=-1;
  private launchPitch=0;
  private tailWeight=0;
  private tailSince=0;
  private tailTime=0;
  private idleClip?:THREE.AnimationClip;
  private idleRig?:IdleRig;
  private roomAhead=Infinity;
  private capDrawn=Infinity;
  private capEpoch=-1;
  private fallEpoch=-1;
  private rootFalling=false;
  private roomBody=Infinity;
  private formHover=0;
  private formFloat=0;
  private formSink=0;
  private soleGap=0;
  private support=0;
  private fallSpeed=0;
  private wasGrounded=true;
  private previousY=0;
  private previousVelocity=new THREE.Vector3();
  readonly velocity=new THREE.Vector3();
  private leanRoll=0;
  private leanTilt=new THREE.Vector3();
  private hipYaw=0;
  private runBearing=0;
  private turnRate=0;
  private turnFrom=0;private turnAge=0;private turnOver=0;private turnMove=-1;
  private attackTurn(state:PlayerState,diff:number,real:number){
    if(!ATTACK_SLOTS.has(state.action)){this.turnMove=-1;return undefined;}
    if(state.actionStarted!==this.turnMove){
      this.turnMove=state.actionStarted;this.turnAge=0;
      this.turnOver=Math.abs(diff)<ATTACK_TURN_MIN?0:THREE.MathUtils.clamp(Math.abs(diff)/ATTACK_TURN_RATE,ATTACK_TURN_FRAMES[0]/60,ATTACK_TURN_FRAMES[1]/60);
      this.turnFrom=this.group.rotation.y;
    }
    if(this.turnAge>=this.turnOver)return undefined;
    this.turnAge=Math.min(this.turnOver,this.turnAge+real);
    const toward=Math.atan2(Math.sin(state.yaw-this.turnFrom),Math.cos(state.yaw-this.turnFrom)),k=THREE.MathUtils.smoothstep(this.turnAge/this.turnOver,0,1);
    const want=this.turnFrom+toward*k;
    return Math.atan2(Math.sin(want-this.group.rotation.y),Math.cos(want-this.group.rotation.y));
  }
  private reverseBlend=0;
  private walking=false;
  private victoryHeld=false;
  private struck=false;
  dynamics=true;
  private fallback=new THREE.Vector3();
  private groundY=0;
  private heldWeapons:THREE.Object3D[]=[];
  private pikachuPatches:THREE.Object3D[]=[];
  private mightGuyBodies:THREE.Object3D[]=[];
  private aokijiMeshes=new Map<string,THREE.Object3D>();
  private lawSheath:THREE.Object3D[]=[];
  private awakenOn:THREE.Object3D[]=[];
  outfitId?:string;
  readonly bodyFighter:FighterId;
  private outfit?:OutfitDef;
  private crownAlways={value:0};
  private irisAlways={value:0};
  private awakenOff:THREE.Object3D[]=[];
  private standHands:THREE.Mesh[]=[];
  stand=false;
  private faceExpressions:{weights:number[];index:number;value:number}[]=[];
  private awakenTuck:{weights:number[];index:number}[]=[];
  private scaledHands:THREE.Bone[]=[];private handScale=1;
  private grips:{bone:THREE.Bone;target:THREE.Quaternion}[]=[];
  private hands?:HandLayer;
  constructor(state:PlayerState,source:GLTF,form=false,rush?:THREE.AnimationClip[],outfit?:string){
    this.outfitId=outfit;this.bodyFighter=state.fighter;this.outfit=form?undefined:outfitFor(outfit,state.fighter);
    this.crownAlways.value=this.outfit?.variant?.always?1:0;this.irisAlways.value=this.outfit?.variant?.ssjHair?1:0;
    this.isForm=form;this.state=state;this.source=source;this.group.name=`fighter-${state.id}`;this.model=clone(source.scene);shareSkeletons(this.model);this.group.add(this.model);
    passWhileHidden(this.group);
    this.clips=source.animations;this.mixer=new THREE.AnimationMixer(this.model);
    const remove:THREE.Object3D[]=[];
    const boneNames:string[]=[];
    this.model.traverse(o=>{if((o as THREE.Bone).isBone){this.bones.set(clean(o.name),o as THREE.Bone);boneNames.push(o.name);}if((o as THREE.Camera).isCamera||(o as THREE.Light).isLight||/icosphere/i.test(o.name))remove.push(o);});
    for(const [canonical,actual] of resolveSkeleton(boneNames)){
      const found=this.bones.get(clean(actual));
      if(found)this.joints.set(canonical,found);
    }
    if(state.fighter==='aokiji'){
      const saber=this.model.getObjectByName('RHand_Weapon1_040');if(saber)this.joints.set('AokijiSaber',saber as THREE.Bone);
      for(const name of ['Aokiji_Closed_Left','Aokiji_Open_Left','Aokiji_Closed_Right','Aokiji_Open_Right','Aokiji_Ice_Saber']){const mesh=this.model.getObjectByName(name);if(mesh)this.aokijiMeshes.set(name,mesh);}
    }
    if(state.fighter==='might-guy')this.model.traverse(o=>{if(/^might_guy_hands_(open|fists|spread|thumb)$/.test(o.name))this.mightGuyBodies.push(o);});
    if(state.fighter==='pikachu')this.model.traverse(o=>{if(/^pikachu_(eyes|mouth|cheeks)_/.test(o.name))this.pikachuPatches.push(o);});
    this.clips=characterClips(this.model,source.animations,state.fighter,this.joints,form);
    this.clips=appendClips(this.clips,rush);
    if(!form&&state.fighter!=='pikachu')this.clips=rigidReactions(this.clips,this.joints);
    this.clipMap=Fighter.clipMaps?clipMapFor(state.fighter,form,this.clips):undefined;
    remove.forEach(o=>o.removeFromParent());
    const profile=form?undefined:IDLE_PROFILES[state.fighter]??DEFAULT_IDLE,named=(name?:string)=>name?this.clips.find(c=>c.name===name):undefined;
    const idle=this.clip('stance');
    if(profile)this.idleRig=new IdleRig(profile,this.joints,named(profile.clip)??this.clipFor({...state,action:'idle'}),(profile.fidgets??[]).map(named).filter((clip):clip is THREE.AnimationClip=>!!clip),hashSeed(state.id+':'+state.fighter),named(profile.ready));
    {const row=HANDS.on&&!this.outfit?.model?handRow(state.fighter):undefined;if(row){const hands=new HandLayer(row,form,this.joints,this.model,idle);if(hands.rigs.length)this.hands=hands;}}
    if(idle){this.active=this.mixer.clipAction(idle);this.active.play();this.mixer.update(0);}
    const animated=new Set<THREE.Object3D>();
    for(const clip of this.clips)for(const track of clip.tracks){const parsed=THREE.PropertyBinding.parseTrackName(track.name);const node=this.nodeNamed(parsed.nodeName);if(node&&node!==this.model)animated.add(node as THREE.Object3D);}
    for(const node of animated)this.addPoseNode(node);
    if(this.hands)for(const bone of this.hands.bones)if(!this.poseByNode.has(bone))this.addPoseNode(bone);
    this.previousPosition.set(state.x,state.y,state.z);
    this.model.updateMatrixWorld(true);
    this.model.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)(o as THREE.SkinnedMesh).computeBoundingBox();});
    this.selectAkainuArms(state);this.selectJinbeHands(state);this.selectKizaruHands(state);this.selectAokijiMeshes(state);this.selectEscanorRhitta(state);this.selectEdwardBlade(state);this.selectPikachuFace(state);this.selectMightGuyBody(state);
    const box=Fighter.silhouette(this.model);const size=box.getSize(new THREE.Vector3());const height=(this.outfit?.model?this.outfit.height:undefined)??FIGHTERS[state.fighter].height??1.7;
    const normalization=form?FIGHTERS[state.fighter].formNormalization:this.outfit?.model?this.outfit.normalization:FIGHTERS[state.fighter].normalization;
    if(normalization){
      this.model.scale.setScalar(normalization.scale);this.model.position.fromArray(normalization.position);
    }else{
      const scale=height/Math.max(.01,size.y);this.model.scale.multiplyScalar(scale);this.model.position.y-=box.min.y*scale;
      this.model.position.x-=((box.min.x+box.max.x)/2)*scale;this.model.position.z-=((box.min.z+box.max.z)/2)*scale;
    }
    this.model.updateMatrixWorld(true);
    const garment=state.fighter==='ichigo'&&[...this.bones.keys()].some(name=>name.startsWith('detailbone'))?'mugetsu':GARMENT[state.fighter]??state.fighter;
    if(state.fighter!=='pikachu')this.secondary=new SecondaryMotion(this.model,garment);
    this.model.traverse(o=>{if((o as THREE.Mesh).isMesh&&/star-pointing-hand|star_closed_Right/.test(o.name))this.standHands.push(o as THREE.Mesh);});
    this.model.traverse(o=>{if(o.name.includes('equipment-held'))this.heldWeapons.push(o);});
    if(state.fighter==='law')this.model.traverse(o=>{if(/^weapon_kikoku_sheath/.test(o.name))this.lawSheath.push(o);});
    this.model.traverse(o=>{
      if(!(o as THREE.Mesh).isMesh)return;
      if(o.name.startsWith('awaken-on'))this.awakenOn.push(o);
      else if(o.name.startsWith('awaken-off'))this.awakenOff.push(o);
    });
    for(const mesh of this.awakenOn)mesh.visible=!!this.outfit?.variant?.ssjHair;
    for(const mesh of this.awakenOff)mesh.visible=!this.outfit?.variant?.ssjHair;
    this.model.traverse(o=>{const m=o as THREE.Mesh;const index=m.isMesh?m.morphTargetDictionary?.['awaken-tuck']:undefined;if(index!==undefined&&m.morphTargetInfluences)this.awakenTuck.push({weights:m.morphTargetInfluences,index});});
    const meshes:THREE.Mesh[]=[];this.model.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
    if(state.fighter==='luffy'&&form){
      this.laughFace=meshes.find(m=>m.name==='g5-laugh'||m.geometry?.name==='g5-laugh'||m.parent?.name==='g5-laugh');
      const json=(this.source as GLTF&{parser?:{json?:{nodes?:{name?:string;mesh?:number}[];meshes?:{name?:string}[]}}}).parser?.json;
      const node=json?.nodes?.find((n:{name?:string;mesh?:number})=>n.mesh!==undefined&&/^face_normal/.test(json.meshes?.[n.mesh]?.name??''))?.name;
      this.plainFace=node?this.model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(node)):undefined;
      if(this.laughFace)this.laughFace.visible=false;
    }
    if(state.fighter==='luffy'&&!this.outfit){
      for(const side of ['L','R'] as const){const open=this.model.getObjectByName(openHandName(form?'luffy-g5':'luffy',side)),fist=closedFist(this.source,this.model,side);if(open&&fist){this.openHands.push(open);this.fists.push(fist);this.openSides.push(side);}}
      this.floating=form&&this.clips.some(c=>c.name===G5_FLOAT.idle);
      for(let i=0;i<state.id.length;i++)this.floatPhase=(this.floatPhase*31+state.id.charCodeAt(i))%997;
    }
    {
      this.pelvis=this.joints.get('Hips')??this.bones.get(state.fighter==='goku'?'defpelvis':'hips');
      this.rootBone=this.pelvis;
      if(this.rootBone){this.model.updateMatrixWorld(true);this.group.worldToLocal(this.rootBone.getWorldPosition(this.rootReference));
        this.rootSiblings=(this.rootBone.parent?.children??[]).filter(child=>child!==this.rootBone&&(child as THREE.Bone).isBone) as THREE.Bone[];
        this.rootChain.add(this.rootBone);for(const sibling of this.rootSiblings)this.rootChain.add(sibling);
        for(let node=this.rootBone.parent;node&&node!==this.model;node=node.parent)if(this.poseByNode.has(node))this.rootChain.add(node);}
      for(const mesh of meshes){
        if(state.fighter==='might-guy'&&mesh.name!=='might_guy_hands_open')continue;
        const skinned=mesh as THREE.SkinnedMesh;if(!skinned.isSkinnedMesh)continue;
        const positions=skinned.geometry.attributes.position,indices=skinned.geometry.attributes.skinIndex,weights=skinned.geometry.attributes.skinWeight;
        const feet=new Map<number,number[]>();
        for(let i=0;i<positions.count;i++)for(let j=0;j<4;j++){const bone=indices.getComponent(i,j);if(weights.getComponent(i,j)>.2&&/^(def(foot|toe)|(left|right)(foot|toebase))/.test(clean(skinned.skeleton.bones[bone].name))){if(!feet.has(bone))feet.set(bone,[]);feet.get(bone)!.push(i);}}
        const selected=new Set<number>();
        for(const vertices of feet.values())for(let direction=0;direction<48;direction++){
          const y=1-2*(direction+.5)/48,r=Math.sqrt(1-y*y),phi=direction*2.399963229728653,axis=new THREE.Vector3(Math.cos(phi)*r,y,Math.sin(phi)*r);
          let best=-Infinity,index=vertices[0];for(const v of vertices){const distance=axis.x*positions.getX(v)+axis.y*positions.getY(v)+axis.z*positions.getZ(v);if(distance>best){best=distance;index=v;}}selected.add(index);
        }
        for(const index of selected)this.supportVertices.push({mesh:skinned,index});
      }
    }
    if(state.fighter==='goku')for(const mesh of meshes){
      if(!mesh.morphTargetDictionary||!mesh.morphTargetInfluences)continue;
      for(const [name,value] of Object.entries({'Upper eye down L':.4,'Upper eye down R':.4,'Lower eye up L':.1,'Lower eye up R':.1})){
        const index=mesh.morphTargetDictionary[name];
        if(index!==undefined)this.faceExpressions.push({weights:mesh.morphTargetInfluences,index,value});
      }
    }
    const authoredOutline=meshes.some(mesh=>/outline/i.test(mesh.name));
    const inkWidth=FIGHTERS[state.fighter].outlineWidth;
    const headJoint=this.joints.get('Head'),smearRoots=SMEAR_LIMBS.map(name=>this.joints.get(name));
    for(const mesh of meshes){
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
      const skin=mesh as THREE.SkinnedMesh;
      if(!mesh.geometry.hasAttribute('lookHead'))mesh.geometry.setAttribute('lookHead',headWeights(mesh.geometry,skin.isSkinnedMesh?skin.skeleton:undefined,headJoint));
      preserveMinatoPaintedFolds(state.fighter,mesh.name,mesh.geometry);
      if(!mesh.geometry.hasAttribute('smearLimb'))mesh.geometry.setAttribute('smearLimb',limbWeights(mesh,smearRoots,heldHand(mesh.name+' '+(mesh.geometry.name??''))));
      if(state.fighter==='luffy'&&skin.isSkinnedMesh&&!skin.geometry.hasAttribute('hakiWeight')){
        const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,a=new Float32Array(ids.count);
        for(let i=0;i<a.length;i++)for(let j=0;j<4;j++)if(/^(right|left)(forearm|hand)/.test(clean(skin.skeleton.bones[ids.getComponent(i,j)].name)))a[i]+=weights.getComponent(i,j);
        skin.geometry.setAttribute('hakiWeight',new THREE.BufferAttribute(a,1));
      }
      const hairTint=this.outfit?.variant?.hair??AWAKENINGS[state.fighter].hair;
      if(hairTint!==undefined&&skin.isSkinnedMesh&&!skin.geometry.hasAttribute('crownWeight')){
        const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,positions=skin.geometry.attributes.position;
        const resolvedHead=this.joints.get('Head');
        const head=resolvedHead?skin.skeleton.bones.indexOf(resolvedHead as THREE.Bone):-1;
        const headIndex=head>=0?head:skin.skeleton.bones.findIndex(b=>/^(def)?head$/.test(clean(b.name)));
        const crown=new Float32Array(ids.count);
        if(headIndex>=0){
          const joint=new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(skin.skeleton.boneInverses[headIndex]).invert());
          for(let i=0;i<crown.length;i++){
            if(positions.getY(i)<joint.y+.03)continue;
            for(let j=0;j<4;j++)if(ids.getComponent(i,j)===headIndex)crown[i]+=weights.getComponent(i,j);
          }
        }
        skin.geometry.setAttribute('crownWeight',new THREE.BufferAttribute(crown,1));
      }
      const lift=SHADOW_LIFT[state.fighter]&&!FEATURE.test(mesh.name)?SHADOW_LIFT[state.fighter]!:0;
      const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const materials=originals.map(material=>{
        const src=material as THREE.MeshStandardMaterial;
        if(/outline/i.test(mesh.name)){const outline=new THREE.MeshBasicMaterial({color:0x0d1b26,side:src.side});applyAuthoredInk(outline);applyThreatInk(outline,this.threatInk,false);this.outlineMaterials.push(outline);return outline;}
        const mat=new THREE.MeshToonMaterial({map:src.map??null,color:src.color??new THREE.Color(1,1,1),gradientMap:toonGradient,normalMap:src.normalMap??null,normalScale:src.normalScale??new THREE.Vector2(1,1),normalMapType:src.normalMapType??THREE.TangentSpaceNormalMap,bumpMap:src.bumpMap??null,bumpScale:src.bumpScale??1,aoMap:src.aoMap??null,aoMapIntensity:src.aoMapIntensity??1,side:src.side,alphaTest:src.alphaTest||0,transparent:src.transparent,opacity:src.opacity});
        mat.name=material.name;
        if(this.outfit?.variant?.ssjHair&&this.outfit.variant.hair!==undefined&&/ssj-hair/i.test(material.name)){
          const hue=new THREE.Color(this.outfit.variant.hair);
          addShaderPatch(mat,'outfit-ssj-hair-v1',shader=>{shader.uniforms.uSsjHue={value:hue};shader.fragmentShader='uniform vec3 uSsjHue;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{float l=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=uSsjHue*clamp(l*1.3,0.0,1.35);}');});
        }
        if(state.fighter==='vegeta'){mat.emissive=src.color.clone();mat.emissiveMap=src.map??null;mat.emissiveIntensity=.2;}
        if(/^glow_/.test(src.name??'')){mat.emissive=((src as THREE.MeshStandardMaterial).emissive??src.color).clone();mat.emissiveIntensity=1.6;mat.emissiveMap=(src as THREE.MeshStandardMaterial).emissiveMap??null;}
        const baseHair=AWAKENINGS[state.fighter].baseHair;
        if(baseHair!==undefined&&/hair/i.test(material.name??'')){
          const hue=new THREE.Color(baseHair);
          addShaderPatch(mat,'base-hair-v1',shader=>{shader.uniforms.uAwaken=this.awaken;shader.uniforms.uBaseHair={value:hue};
            shader.fragmentShader='uniform float uAwaken;uniform vec3 uBaseHair;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n{float l=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=mix(diffuseColor.rgb,uBaseHair*(.35+.9*l),1.0-clamp(uAwaken,0.0,1.0));}');});
        }
        if(hairTint!==undefined&&skin.isSkinnedMesh){
          const gold=new THREE.Color(hairTint),pale=PALE_CROWN.has(state.fighter);
          addShaderPatch(mat,pale?'pale-crown-v1':'saiyan-crown-v2',shader=>{shader.uniforms.uAwaken=this.awaken;shader.uniforms.uCrownAlways=this.crownAlways;shader.uniforms.uIrisAlways=this.irisAlways;shader.uniforms.uGold={value:gold};
            shader.vertexShader='attribute float crownWeight;varying float vCrown;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCrown=crownWeight;');
            shader.fragmentShader='uniform float uAwaken;uniform float uCrownAlways;uniform float uIrisAlways;uniform vec3 uGold;varying float vCrown;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat dark='+(pale?'1.0':'1.0-smoothstep(.10,.32,dot(diffuseColor.rgb,vec3(.299,.587,.114)))')+';\n'+(pale?'':'float iris=(1.0-smoothstep(.5,.8,diffuseColor.a))*clamp(vCrown,0.0,1.0);\ndark*=1.0-iris;\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.02,.58,.46),iris*max(uAwaken,uIrisAlways));\n')+'diffuseColor.rgb=mix(diffuseColor.rgb,uGold,clamp(vCrown,0.0,1.0)*dark*max(uAwaken,uCrownAlways));');});
        }
        if(state.fighter==='luffy'&&skin.isSkinnedMesh){
          addShaderPatch(mat,`luffy-haki-v3-${lift}`,shader=>{shader.uniforms.uHaki=this.haki;shader.vertexShader='attribute float hakiWeight;varying float vHaki;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHaki=hakiWeight;');shader.fragmentShader='uniform float uHaki;varying float vHaki;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(max(diffuseColor.rgb,vec3(.027)),vec3(.035,.009,.013),smoothstep(.1,.85,vHaki)*uHaki);'+FLOOR_PATCH(lift));});
        }else if(lift>0){
          addShaderPatch(mat,`garment-floor-v1-${lift}`,shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>'+FLOOR_PATCH(lift));});
        }
        applyToonShading(mat,toonKind(mesh.name,material.name));
        applyHitFlash(mat,this.flash,this.flashFlat);
        applyGarouCosmicLook(mat,state.fighter,this.isForm);
        applyLimbSmear(mat,this.smear);
        this.outlineMaterials.push(mat);return mat;
      });
      mesh.material=Array.isArray(mesh.material)?materials:materials[0];
      if(SHADOW_SIDE_FIGHTERS.has(state.fighter))fixShadowSide(mesh);
      const translucentShell=mesh.name.startsWith('awaken-on')&&originals.some(m=>(m as THREE.Material).transparent&&(m as THREE.Material).opacity<1);
      if(translucentShell){for(const m of materials)m.depthWrite=false;mesh.castShadow=false;}
      if(!authoredOutline&&inkWidth>0&&!translucentShell){
        const outline=new THREE.MeshToonMaterial({color:0x081621,side:THREE.BackSide,depthWrite:false});
        outline.userData.ink=true;
        const inkBody=materials.length===1?materials[0] as THREE.MeshToonMaterial:undefined;
        if(inkBody?.isMeshToonMaterial&&inkBody.map)outline.map=inkBody.map;
        applyInkShell(outline,inkWidth/.003,INK_DEPTH_BIAS);preservePainCloakSurface(outline,state.fighter,mesh.name);applyThreatInk(outline,this.threatInk);applyLimbSmear(outline,this.smear);
        const shell=(mesh as THREE.SkinnedMesh).isSkinnedMesh?new THREE.SkinnedMesh(mesh.geometry,outline):new THREE.Mesh(mesh.geometry,outline);
        shell.name=mesh.name+'-ink';shell.frustumCulled=false;shell.matrixAutoUpdate=false;shell.matrix.identity();shell.castShadow=false;shell.receiveShadow=false;
        shell.morphTargetInfluences=mesh.morphTargetInfluences;shell.morphTargetDictionary=mesh.morphTargetDictionary;
        if((shell as unknown as THREE.SkinnedMesh).isSkinnedMesh){const skinned=mesh as THREE.SkinnedMesh;(shell as unknown as THREE.SkinnedMesh).bind(skinned.skeleton,skinned.bindMatrix);(shell as unknown as THREE.SkinnedMesh).bindMode=skinned.bindMode;}
        mesh.add(shell);this.outlineMaterials.push(outline);
      }
    }
    this.group.updateMatrixWorld(true);
    {const unit=this.group.matrixWorld.getMaxScaleOnAxis()||1,hips=new THREE.Vector3(),centre=new THREE.Vector3();
      for(const mesh of meshes){
        const skin=mesh as THREE.SkinnedMesh;if(!skin.isSkinnedMesh)continue;
        if(!skin.boundingBox)skin.computeBoundingBox();
        const box=_cullBox.copy(skin.boundingBox!);if(box.isEmpty())continue;
        const anchor=skin.skeleton.bones.find(bone=>!!bone&&/hips|pelvis/i.test(bone.name))??this.pelvis??skin.skeleton.bones.find(Boolean);if(!anchor)continue;
        box.getCenter(centre).applyMatrix4(skin.matrixWorld);
        const reach=box.getSize(hips).length()/2*skin.matrixWorld.getMaxScaleOnAxis();
        anchor.getWorldPosition(hips);
        const radius=((centre.distanceTo(hips)+reach)*CULL_PAD+CULL_REACH)/unit;
        const sphere=new THREE.Sphere(skin.worldToLocal(hips.clone()),radius*unit/skin.matrixWorld.getMaxScaleOnAxis());
        const shells=skin.children.filter(child=>(child as THREE.SkinnedMesh).isSkinnedMesh&&child.name.endsWith('-ink')) as THREE.SkinnedMesh[];
        for(const each of [skin,...shells]){each.boundingSphere=sphere;each.frustumCulled=true;}
        this.culled.push({mesh:skin,sphere,anchor,radius});
      }
    }
    const bone=(patterns:string[],canonical?:string)=>(canonical?this.joints.get(canonical):undefined)
      ??patterns.map(pattern=>this.bones.get(pattern)).find(Boolean)
      ??patterns.map(pattern=>[...this.bones.entries()].find(([name])=>name.endsWith(pattern))?.[1]).find(Boolean);
    this.rightBone=bone(['righthand','handr','rhand'],'RightHand');this.leftBone=bone(['lefthand','handl','lhand'],'LeftHand');
    this.neckBone=bone(['neck','defneck'],'Neck');this.headBone=bone(['head','defhead'],'Head');
    {const g=form?undefined:HAND_GRIP[state.fighter],hand=g?this.joints.get(`${g.side}Hand`):undefined;if(g&&hand)this.grips=gripPlan(hand,g.curl,g.thumb,this.joints.get('Hips'));}
    {const k=form?undefined:HAND_SCALE[state.fighter];if(k!==undefined&&k!==1){this.handScale=k;this.scaledHands=[this.joints.get('LeftHand'),this.joints.get('RightHand')].filter((b):b is THREE.Bone=>!!b);}}
    this.leanChain=[bone(['hips','defpelvis']),bone(['spine','defspine001']),bone(['spine1','defspine002']),bone(['spine2','defspine003'])]
      .filter((joint):joint is THREE.Bone=>!!joint);
    this.model.updateMatrixWorld(true);
    for(const side of ['left','right']as const){
      const Side=side==='left'?'Left':'Right';
      const hip=bone([side+'upleg','defthigh'+side[0]],Side+'UpLeg'),knee=bone([side+'leg','defcalf'+side[0]],Side+'Leg'),ankle=bone([side+'foot','deffoot'+side[0]],Side+'Foot');
      if(!hip||!knee||!ankle||knee===hip||ankle===knee)continue;
      const a=hip.getWorldPosition(new THREE.Vector3()),b=knee.getWorldPosition(new THREE.Vector3()),c=ankle.getWorldPosition(new THREE.Vector3());
      const upper=a.distanceTo(b),lower=b.distanceTo(c);
      if(upper<.05||lower<.05)continue;
      const footBones=new Set<THREE.Object3D>();ankle.traverse(node=>footBones.add(node));
      const soles=this.supportVertices.filter(({mesh,index})=>{
        const weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex;
        let influence=0;
        for(let j=0;j<4;j++)if(footBones.has(mesh.skeleton.bones[indices.getComponent(index,j)]))influence+=weights.getComponent(index,j);
        return influence>.35;
      });
      this.legs.push({hip,knee,ankle,upper,lower,planted:false,anchor:new THREE.Vector3(),plantYaw:state.yaw,weight:0,low:0,high:.2,stepped:-10,soles});
      this.legLength=Math.max(this.legLength,upper+lower);
    }
    if(this.legs.length!==2)this.legs.length=0;
    this.walkClip=this.clip('walk');
    this.findHeldEquipment(this.clip('ready'));
    this.runClip=this.clipFor({...state,action:'run'});
    const carriesArms=(joint?:THREE.Bone)=>{let node:THREE.Object3D|null=joint??null;while(node){if(node===this.neckBone)return true;node=node.parent;}return false;};
    if(carriesArms(this.rightBone)||carriesArms(this.leftBone))this.neckBone=undefined;
    for(const [hand,store] of [[this.rightBone,'right'],[this.leftBone,'left']] as const){
      if(!hand)continue;
      const inverse=new THREE.Matrix4().copy(hand.matrixWorld).invert();
      const palm=hand.getWorldPosition(new THREE.Vector3());
      let best:THREE.Vector3|undefined,reach=0;
      for(const mesh of meshes){
        const skin=mesh as THREE.SkinnedMesh;
        if(!skin.isSkinnedMesh)continue;
        const named=HELD.test(mesh.name)||HELD.test(skin.geometry?.name??'');
        const carried=new Set<number>();
        skin.skeleton.bones.forEach((joint,at)=>{
          for(let node:THREE.Object3D|null=joint;node;node=node.parent)if(node===hand){carried.add(at);break;}
        });
        if(!carried.size)continue;
        const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,positions=skin.geometry.attributes.position;
        const local=new THREE.Vector3(),world=new THREE.Vector3();
        for(let i=0;i<positions.count;i++){
          let held=0;
          for(let j=0;j<4;j++)if(carried.has(ids.getComponent(i,j)))held+=weights.getComponent(i,j);
          if(held<.92&&!named)continue;
          skin.getVertexPosition(i,world).applyMatrix4(skin.matrixWorld);
          local.copy(world).applyMatrix4(inverse);
          const distance=world.distanceTo(palm);
          if(distance>reach&&distance<(named?2.8:1.25)){reach=distance;best=local.clone();}
        }
      }
      if(best&&reach>.32)(store==='right'?this.rightReach=best:this.leftReach=best);
    }
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(.62,24),new THREE.MeshBasicMaterial({color:0x172a32,transparent:true,opacity:.3,depthWrite:false,alphaMap:contactShadowFalloff()}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;shadow.name='contact-shadow';this.group.add(shadow);this.contactShadow=shadow;
    this.group.position.set(state.x,state.y,state.z);this.group.rotation.y=state.yaw;
    if(!form)Fighter.drawn.add(this);
    const own=named(profile?.clip);
    if(own&&own!==idle){this.active?.stop();this.active=this.mixer.clipAction(own);this.active.play();this.mixer.update(0);}
  }
  private static readonly drawn=new Set<Fighter>();
  visualCenter(out:THREE.Vector3):THREE.Vector3{
    if(this.gear4?.group.visible&&!this.model.visible&&!this.worn)return this.gear4.visualCenter(out);
    const hips=this.pelvis,top=this.joints.get('Neck')??this.joints.get('Spine2')??this.headBone;
    if(!hips)return out.copy(this.group.position).addScaledVector(UP,1.1);
    hips.getWorldPosition(out);
    return top?out.lerp(top.getWorldPosition(_centerTop),.5):out;
  }
  restCenter(out:THREE.Vector3):THREE.Vector3{return this.visualCenter(out).sub(this.push);}
  private drawnBody():Fighter{return this.gear4&&this.gear4.group.visible&&!this.model.visible?this.gear4:this;}
  get shownBody():Fighter{return this.drawnBody();}
  get displayedClipName():string|undefined{return this.shownBody.active?.getClip().name;}
  get displayedClipTime():number{return this.shownBody.active?.time??0;}
  get displayedOpponent():Fighter|undefined{return this.opponentBody();}
  drawnJoint(name:string){return this.drawnBody().joints.get(name)??this.joints.get(name);}
  private get worn(){return AWAKENINGS[this.state.fighter].formTint!==undefined;}
  private opponentBody():Fighter|undefined{
    const point=this.targetPoint??this.owner?.targetPoint;
    if(!point)return undefined;
    const self=this.owner??this;
    let best:Fighter|undefined,nearest=OPPONENT_MATCH*OPPONENT_MATCH;
    for(const other of Fighter.drawn){
      if(other===self)continue;
      const dx=other.group.position.x-point.x,dz=other.group.position.z-point.z,d=dx*dx+dz*dz;
      if(d<nearest){nearest=d;best=other;}
    }
    return best;
  }
  static readonly REACTIONS:Record<string,string[]>={
    flinch:['shake','electric_shock','Hit 01','Hit','Hurt'],
    splat:['slammed','ultimate-ground-impact','Hit 01','Hit','Hurt'],
    hurt:['Hit 01','Hit','Hurt'],
    launched:['slammed','blownback','ultimate-knockback-air','Jump Fall','Hit 01','Hit'],
    knockdown:['down_lp','down_end','ultimate-ground-impact','Die fall','Hit 01'],
    getup:['down_end','blownback_end','_Idle','Idle'],
    stun:['stun','shake','Hit 01','Hit'],
    defeated:['slammed','Die fall','ultimate-ground-impact','Hit 01'],
    downed:['down_lp','down_end','slammed'],
  };
  static readonly CLIP_RULES:Readonly<Record<string,(fighter:FighterId,form:boolean)=>readonly string[]>>={
    stance:fighter=>fighter==='goku'?['02-STANCE','stance','idle']:['_Idle','Idle'],
    ready:fighter=>fighter==='goku'?['goku-ready','02-STANCE','stance','idle']:['_Idle','Idle'],
    rest:()=>['_Idle','Idle'],
    walk:()=>['Walk'],
    rise:fighter=>fighter==='goku'?['adapted_jump']:['jump'],
    fall:fighter=>fighter==='goku'?['adapted_jump_fall']:['Jump Fall'],
    spin:fighter=>fighter==='goku'?['adapted_jump_spin']:['Jump spin'],
    hit:fighter=>fighter==='goku'?['adapted_hit']:['Hit 01'],
    stagger:()=>['shake'],
    daze:()=>['stun','shake'],
    knockback:()=>['ultimate-knockback-air','slammed','blownback','Jump Fall'],
    'ground impact':()=>['ultimate-ground-impact'],
    abdomen:()=>['heavy-abdomen-fold'],
    pressure:()=>['beam-pressure-recovery'],
    ...Object.fromEntries(Object.entries(Fighter.REACTIONS).map(([name,patterns])=>[`reaction ${name}`,()=>patterns])),
    opener:(fighter,form)=>{const opener=form?ULTIMATE_CLIPS[fighter]?.formOpener:ULTIMATE_CLIPS[fighter]?.opener;return opener?[opener.clip]:[];},
    command:(fighter,form)=>!form&&STAND_COMMAND[fighter]?[STAND_COMMAND[fighter]!]:[],
    'float idle':(fighter,form)=>fighter==='luffy'&&form?[G5_FLOAT.idle]:[],
    'float run':(fighter,form)=>fighter==='luffy'&&form?[G5_FLOAT.run]:[],
    'float guard':(fighter,form)=>fighter==='luffy'&&form?[G5_FLOAT.guard]:[],
    ...Object.fromEntries(GOKU_MELEE_CONTACTS.map((entry,i)=>[`melee ${i}`,(fighter:FighterId)=>fighter==='goku'?[entry.clip]:[]])),
    'adapted light':fighter=>fighter==='goku'?['adapted_light']:[],
    'adapted heavy':fighter=>fighter==='goku'?['adapted_heavy']:[],
    ...Object.fromEntries(Object.entries(DREAM_HURTS).map(([key,name])=>[key,()=>[name]])),
    'dream flinch':()=>[DREAM_FLINCH],
    ...Object.fromEntries(DREAM_STAGES.map((name,i)=>[`dream rush ${i+1}`,()=>[name]])),
    ...Object.fromEntries(COMBO_KEYS.map(key=>[`dream ender ${key}`,(fighter:FighterId,form:boolean)=>{const own=form?undefined:comboClip(fighter,key);return own?[`DZ ${own.clip}`]:[];}])),
  };
  static readonly MAP_ACTIONS:readonly PlayerState['action'][]=['idle','run','dash','jump','guard','light','heavy','special','ultimate','awaken','victory','flinch','hurt','stun','splat','launched','knockdown','getup','defeated'];
  private kizaruHands?: THREE.Object3D[];
  private selectMightGuyBody(state:PlayerState){
    if(state.fighter!=='might-guy')return;
    const selected='might_guy_hands_'+mightGuyHandState(this.active?.getClip().name??'_Idle',this.isForm);
    for(const mesh of this.mightGuyBodies)mesh.visible=mesh.name===selected;
  }
  private selectPikachuFace(state:PlayerState){
    if(state.fighter!=='pikachu')return;
    const expression=pikachuExpression(this.active?.getClip().name??'_Idle',this.active?.time??0);
    for(const mesh of this.pikachuPatches)mesh.visible=mesh.name===`pikachu_eyes_${expression.eyes}`||mesh.name===`pikachu_mouth_${expression.mouth}`||mesh.name===`pikachu_cheeks_${expression.cheeks}`;
  }
  private selectAokijiMeshes(state:PlayerState){
    if(state.fighter!=='aokiji')return;
    const variant=aokijiMeshState(state.action,this.active?.time??0,this.active?.getClip().name);
    for(const [name,mesh] of this.aokijiMeshes)mesh.visible=name==='Aokiji_Ice_Saber'?variant.saber:name===`Aokiji_${variant.left}_Left`||name===`Aokiji_${variant.right}_Right`;
  }
  private selectKizaruHands(state:PlayerState) {
    if(state.fighter!=='kizaru')return;
    if(!this.kizaruHands){
      this.kizaruHands=[];
      this.model.traverse(object=>{if(/^Kizaru_Hand_(Left|Right)_(Open|Beads|Point)$/.test(object.name))this.kizaruHands!.push(object);});
    }
    const [left,right]=kizaruHandVariants(state.action,this.active?.time??0,this.active?.getClip().name);
    for(const mesh of this.kizaruHands)mesh.visible=mesh.name===`Kizaru_Hand_Left_${left}`||mesh.name===`Kizaru_Hand_Right_${right}`;
  }
  private jinbeHands?: THREE.Object3D[];
  private selectJinbeHands(state:PlayerState) {
    if(state.fighter!=='jinbe')return;
    if(!this.jinbeHands){
      this.jinbeHands=[];
      this.model.traverse(object=>{if(/^Jinbe_(Closed|Open)_(Left|Right)$/.test(object.name))this.jinbeHands!.push(object);});
    }
    const clip=this.active?.getClip().name,[left,right]=state.action==='light'&&clip==='Karate Palm'?['Closed','Closed']:jinbeHandVariants(state.action,state.actionTime*state.actionDuration,clip);
    for(const mesh of this.jinbeHands)mesh.visible=mesh.name===`Jinbe_${left}_Left`||mesh.name===`Jinbe_${right}_Right`;
  }
  private akainuArms?: THREE.Object3D[];
  private selectAkainuArms(state:PlayerState){
    if(state.fighter!=='akainu')return;
    if(!this.akainuArms){this.akainuArms=[];this.model.traverse(o=>{if(/^Akainu_(Normal|Magma|Hound)_(Left|Right)$/.test(o.name))this.akainuArms!.push(o);});}
    const [left,right]=akainuArmVariants(state.action,state.actionTime*state.actionDuration,!!state.awakened,this.active?.getClip().name);
    for(const mesh of this.akainuArms)mesh.visible=mesh.name===`Akainu_${left}_Left`||mesh.name===`Akainu_${right}_Right`;
  }
  private static silhouette(model:THREE.Object3D){
    const box=new THREE.Box3(),one=new THREE.Box3();
    model.traverse(o=>{
      const mesh=o as THREE.Mesh;
      if(!mesh.isMesh||(!mesh.visible&&/^(Akainu_|Jinbe_|Kizaru_Hand_)/.test(mesh.name))||CARRIED.test(mesh.name)||CARRIED.test(mesh.geometry?.name??''))return;
      box.union(one.setFromObject(mesh));
    });
    return box.isEmpty()?new THREE.Box3().setFromObject(model):box;
  }
  auraColours():readonly [number,number]{return this.outfit?.variant?.aura??AWAKENINGS[this.state.fighter].aura;}
  private outfitAura?:THREE.Color;
  private auraColor(){if(!this.outfit?.variant?.aura)return Fighter.auraColor(this.state.fighter);return this.outfitAura??=new THREE.Color(this.outfit.variant.aura[0]);}
  private static readonly AURA=new Map<FighterId,THREE.Color>();
  static auraColor(fighter:FighterId){
    let colour=Fighter.AURA.get(fighter);
    if(!colour){colour=new THREE.Color(AWAKENINGS[fighter].aura[0]);Fighter.AURA.set(fighter,colour);}
    return colour;
  }
  private findClip(patterns:string[]){return findClipIn(this.clips,patterns);}
  private clipMap?:BodyClipMap;
  static clipMaps=true;
  static dreamTakes=true;
  private mapped(key:string){const map=this.clipMap?.clips;if(!map||!(key in map))return undefined;const name=map[key];return name?this.clips.find(c=>c.name===name)??null:null;}
  private clip(key:string){
    const mapped=this.mapped(key),own=mapped!==undefined?mapped??undefined:this.findClip([...Fighter.CLIP_RULES[key]?.(this.state.fighter,this.isForm)??[]]);
    if(own||this.isForm||!Fighter.borrowedHurt||!BORROWED_TAKES.has(key)||!DREAM_IMPACT||!Fighter.dreamTakes)return own;
    const borrowed=Fighter.borrowedHurt(this.source.scene,this.clips,key,this.state.fighter);
    if(borrowed&&!(this.borrowedSeen??=new WeakSet()).has(borrowed)){this.borrowedSeen.add(borrowed);this.ensurePoseNodes(borrowed);}
    return borrowed;
  }
  private mappedClip(state:PlayerState,map:Readonly<Record<string,string|null>>){
    const named=(key:string)=>{const name=map[key];return name?this.clips.find(c=>c.name===name):undefined;};
    if(!state.grounded&&(state.action==='light'||state.action==='heavy')&&!(state.awakened&&state.fighter==='jotaro'))return named(`air ${state.action}`)??this.clips[0];
    const own=named(state.action),authored=own?.name===`Authored ${state.fighter} ${state.action}`;
    if(state.action==='jump'&&this.falling&&!authored){const fall=this.fallClip();if(fall)return fall;}
    if(state.action==='run'&&this.walking&&this.walkClip&&!this.blended&&!authored)return this.walkClip;
    return own??this.clips[0];
  }
  ruledClips(){
    const map=this.clipMap,plan=this.rushPlan,authored=[...this.rushAuthored],air=this.airClips,enders=[...this.enderClips],falling=this.falling,walking=this.walking;
    this.clipMap=undefined;this.rushPlan=undefined;this.rushAuthored.clear();this.airClips=[];this.enderClips.clear();this.falling=false;this.walking=false;
    const out:Record<string,string|null>={},name=(clip?:THREE.AnimationClip)=>clip?.name??null,fighter=this.state.fighter;
    try{
      const drawn=(action:PlayerState['action'],grounded:boolean)=>name(this.ruledClip({...this.state,action,grounded,y:grounded?0:1,awakened:false,branch:undefined,chain:0,confirmedAt:undefined}));
      for(const action of Fighter.MAP_ACTIONS)out[action]=drawn(action,true);
      for(const action of ['light','heavy'] as const)out[`air ${action}`]=drawn(action,false);
      const rush=this.planRush();
      rush.ground.forEach((clip,i)=>{out[clip&&this.rushAuthored.has(clip)?`rush ${i+1}`:`rush fill ${i+1}`]=name(clip);});
      if(this.usesAuthoredAirString){
        rush.air.forEach((clip,i)=>{out[`rush air ${i+1}`]=name(clip);});
        this.airStages(fighter)?.forEach((_,i)=>{out[`air ${i}`]=name(this.airStageClip(i));});
      }
      const takes=Fighter.dreamTakes;Fighter.dreamTakes=false;this.enderClips.clear();
      try{for(const key of COMBO_KEYS)if((this.isForm&&comboFormClip(fighter,key))||comboClip(fighter,key))out[`ender ${key}`]=name(this.enderClip({...this.state,action:COMBO_SLOT[key],branch:key})?.clip);}
      finally{Fighter.dreamTakes=takes;this.enderClips.clear();}
      for(const [key,rule] of Object.entries(Fighter.CLIP_RULES)){const patterns=rule(fighter,this.isForm);if(patterns.length)out[key]=name(this.findClip([...patterns]));}
    }finally{
      this.clipMap=map;this.rushPlan=plan;this.rushAuthored.clear();for(const clip of authored)this.rushAuthored.add(clip);
      this.airClips=air;this.enderClips.clear();for(const [key,found] of enders)this.enderClips.set(key,found);this.falling=falling;this.walking=walking;
    }
    return out;
  }
  private addPoseNode(node:THREE.Object3D){
    const pose:PoseNode={node,samplePosition:node.position.clone(),sampleRotation:node.quaternion.clone(),sampleScale:node.scale.clone(),fromPosition:node.position.clone(),fromRotation:node.quaternion.clone(),fromScale:node.scale.clone(),blendPosition:node.position.clone(),blendRotation:node.quaternion.clone(),blendScale:node.scale.clone(),
      prevPosition:node.position.clone(),prevRotation:node.quaternion.clone(),sourceSpin:new THREE.Vector3(),sourceDrift:new THREE.Vector3(),crossTarget:new THREE.Quaternion(0,0,0,0)};
    this.poseNodes.push(pose);this.poseByNode.set(node,pose);
  }
  private ensurePoseNodes(clip:THREE.AnimationClip){
    for(const track of clip.tracks){
      const node=this.nodeNamed(THREE.PropertyBinding.parseTrackName(track.name).nodeName);
      if(node&&node!==this.model&&!this.poseByNode.has(node))this.addPoseNode(node);
    }
  }
  private rushStage(state:PlayerState){return state.action==='light'?THREE.MathUtils.clamp(Math.floor(state.chain??0),0,RUSH_STAGES-1):0;}
  private rushMove(state:PlayerState){
    const stage=this.rushStage(state);
    if(!stage)return undefined;
    const authored=authoredRushMove(state.fighter,stage,!!state.awakened);
    let move=this.rushMoves[stage];
    if(!move||move.name!==authored.name){move={...authored,contacts:[authored.contacts[0]]};this.rushMoves[stage]=move;}
    move.duration=state.actionDuration>0?state.actionDuration:authored.duration;
    move.contacts[0]=authored.contacts[0]*move.duration/authored.duration;
    return move;
  }
  private moveFor(state:PlayerState):MoveDefinition{
    if(this.swap&&state===this.swap.pacedState)return this.swap.move;
    const forged=Fighter.ender(state)?undefined:forgedMoveFor(state);if(forged)return forged;
    if(state.action==='ultimate')return ultimateMove(state.fighter,!!state.awakened);
    const ender=Fighter.ender(state);if(ender){const move=comboMove(state.fighter,ender,!!state.awakened);if(move)return move;}
    return this.rushMove(state)??MOVES[state.fighter][state.action as AttackSlot];
  }
  prepareRush(){this.rushPlan??=this.planRush();this.prepareMoves();this.gear4?.prepareRush();}
  private prepareMoves(){
    const clips=new Set<THREE.AnimationClip>(),state=this.state;
    const add=(clip?:THREE.AnimationClip)=>{if(clip)clips.add(clip);};
    for(const action of ['light','heavy','special','ultimate'] as const)for(const grounded of [true,false])add(this.clipFor({...state,action,chain:0,grounded}));
    for(const clip of [...this.rushPlan?.ground??[],...this.rushPlan?.air??[]])add(clip);
    if(state.fighter==='goku')GOKU_MELEE_CONTACTS.forEach((_,i)=>add(this.clip(`melee ${i}`)));
    if(hasCombos(state.fighter))for(const key of COMBO_KEYS)add(this.enderClip({...state,action:COMBO_SLOT[key],branch:key,chain:0})?.clip);
    for(const clip of clips){clipMotionTable(clip);this.samplersFor(clip);this.mixer.clipAction(clip);}
    for(let stage=1;stage<RUSH_STAGES;stage++)for(const grounded of [true,false]){
      const staged={...state,action:'light' as const,chain:stage,grounded},clip=this.clipFor(staged);
      if(clip){if(!clips.has(clip)){clipMotionTable(clip);this.samplersFor(clip);this.mixer.clipAction(clip);}this.rushFraction(clip,stage,staged);}
    }
    for(const name of Object.keys(Fighter.REACTIONS)){const clip=this.clip(`reaction ${name}`);if(clip){this.samplersFor(clip);this.mixer.clipAction(clip);}}
    for(const key of [...Object.keys(DREAM_HURTS),'dream flinch']){const clip=this.clip(key);if(clip){this.samplersFor(clip);this.mixer.clipAction(clip);}}
    {const getup=this.clip('reaction getup');if(getup)clipMotionTable(getup);}
    for(const clip of this.idleRig?.clips??[]){this.samplersFor(clip);this.mixer.clipAction(clip);}
  }
  private planRush(){
    const base:PlayerState={...this.state,action:'light',chain:0,grounded:true};
    const slots=(['light','heavy','special','ultimate'] as const).map(action=>this.clipFor({...base,action}));
    const goku=this.state.fighter==='goku'?this.clip('melee 0'):undefined;
    const light=goku??slots[0];
    let steel=this.armed||this.heldWeapons.length>0;
    this.model.traverse(o=>{if((o as THREE.Mesh).isMesh&&/weapon|kunai|knife|sword|blade/i.test(o.name))steel=true;});
    const nodesOf=(clip:THREE.AnimationClip)=>new Set(clip.tracks.map(t=>THREE.PropertyBinding.parseTrackName(t.name).nodeName));
    const lightNodes=light?nodesOf(light):new Set<string>();
    const keyed=(clip:THREE.AnimationClip)=>{
      if(!steel||!lightNodes.size)return true;
      const nodes=nodesOf(clip);let shared=0;for(const node of lightNodes)if(nodes.has(node))shared++;
      return shared>=lightNodes.size*.9;
    };
    const map=this.clipMap?.clips;
    const pool=map?[]:this.clips.filter(c=>c!==light&&!slots.includes(c)&&RUSH_STRIKE.test(c.name)&&!RUSH_NEVER.test(c.name)&&c.duration>=.25&&c.duration<=4.5&&keyed(c)&&this.roughness(c)<=RUSH_SMOOTH);
    const lightMove=MOVES[this.state.fighter].light;
    const single=lightMove.contacts.length===1||lightMove.style!=='melee';
    const mirror=!this.armed&&!this.isForm&&single&&light
      ?mirrorClip(this.source.scene,light,sceneJoints(this.source.scene,resolveSkeleton)):undefined;
    if(mirror)this.ensurePoseNodes(mirror);
    const prefer:(RegExp|'mirror')[][]=[
      ['mirror',/jab|cross|punch 0?2/i,/punch/i,/strike|slash|attack_|grounded-cross/i,/kick/i,/air attack/i],
      [/punch 0?2|hook|grounded-cross/i,/kick 0?1|air attack 0?2/i,/punch/i,/kick/i,/strike|slash|attack_/i,/air attack/i,'mirror'],
      [/meteor|kick 0?2|air attack 0?3/i,/kick/i,/air attack/i,/strike|slash|attack_/i,/punch/i,'mirror'],
    ];
    const authored=FIGHTERS[this.state.fighter].rushClips;
    const ground:(THREE.AnimationClip|undefined)[]=[],used=new Set<THREE.AnimationClip>();
    for(let stage=1;stage<RUSH_STAGES;stage++){
      const pattern=this.isForm&&!FORM_NAMED_RUSH.has(this.state.fighter)?undefined:authored?.[stage-1];
      const named=map?this.mapped(`rush ${stage}`)??undefined:pattern?this.findClip([pattern]):undefined;
      if(!map&&pattern&&!named&&!Fighter.warnedRush.has(this.state.fighter+pattern)){
        Fighter.warnedRush.add(this.state.fighter+pattern);
        console.warn(`${FIGHTERS[this.state.fighter].name}: rush stage ${stage} clip "${pattern}" not found; using the body's own clips`);
      }
      if(named){used.add(named);this.rushAuthored.add(named);}
      ground.push(named);
    }
    for(let stage=1;stage<RUSH_STAGES;stage++){
      if(ground[stage-1])continue;
      if(map){const fill=map[`rush fill ${stage}`];ground[stage-1]=fill?this.clips.find(c=>c.name===fill)??(mirror?.name===fill?mirror:undefined):undefined;continue;}
      let chosen:THREE.AnimationClip|undefined;
      for(const want of prefer[Math.min(stage,prefer.length)-1]){
        const found=want==='mirror'?mirror:pool.find(c=>!used.has(c)&&want.test(c.name));
        if(found&&!used.has(found)){chosen=found;break;}
      }
      const before=stage>1?ground[stage-2]:light;
      chosen??=[mirror,light,...pool].find(c=>c&&c!==before)??pool[0]??mirror??light;
      if(chosen)used.add(chosen);
      ground[stage-1]=chosen;
    }
    const own=this.airStages(this.state.fighter);
    const air=!this.usesAuthoredAirString?[]:map?[1,2,3].map(n=>this.mapped(`rush air ${n}`)??undefined):own?[this.airStageClip(1),this.airStageClip(2),undefined]
      :[2,3,1].map(n=>{const clip=this.findClip([`air Attack 0${n}`]);return clip&&this.roughness(clip)<=RUSH_SMOOTH?clip:undefined;});
    return {ground,air};
  }
  private static warnedRush=new Set<string>();
  private roughness(clip:THREE.AnimationClip){
    let worst=clipRoughness.get(clip);
    if(worst!==undefined)return worst;
    worst=0;
    const body=this.bodyJointSet,a=new THREE.Quaternion(),b=new THREE.Quaternion();
    for(const track of this.samplersFor(clip)){
      if(track.property!=='quaternion'||!body.has(track.node)||/finger|thumb|index|middle|ring|pinky|toe|eye|jaw/i.test(track.node.name))continue;
      a.fromArray(track.interpolant.evaluate(0) as unknown as number[]);
      for(let t=1/60;t<=clip.duration+1e-6;t+=1/60){b.fromArray(track.interpolant.evaluate(Math.min(t,clip.duration)) as unknown as number[]);worst=Math.max(worst,a.angleTo(b));a.copy(b);}
    }
    clipRoughness.set(clip,worst);
    return worst;
  }
  private rushFraction(clip:THREE.AnimationClip|undefined,stage:number,state:PlayerState){
    if(!clip)return RUSH_DEFAULT_FRACTION;
    const cached=this.rushFractions.get(clip);
    if(cached!==undefined)return cached;
    const formKeys=this.isForm?FORM_CONTACT_BY_KEY[state.fighter]:undefined,table=formKeys?{...CONTACT_BY_KEY[state.fighter],...formKeys}:CONTACT_BY_KEY[state.fighter],source=mirrorSource(clip)??clip;
    const light=MOVES[state.fighter].light;
    const goku=GOKU_MELEE_CONTACTS.find(entry=>entry.clip===source.name);
    const lightClip=state.fighter==='goku'?undefined:this.clipFor({...state,action:'light',chain:0,grounded:true});
    const authoredAt=this.rushAuthored.has(clip)?(this.rushPlan?.ground.indexOf(clip)??-1)+1:0;
    const fraction=table?.[clip.name]??table?.[source.name]
      ??(this.rushAuthored.has(clip)?table?.[`rush${authoredAt||stage}`]:undefined)
      ??goku?.peak
      ??(source===lightClip?CONTACT_FRACTION[state.fighter]?.light??light.contacts[0]/light.duration:undefined)
      ??strikeFraction(this.source.scene,source,sceneJoints(this.source.scene,resolveSkeleton))
      ??RUSH_DEFAULT_FRACTION;
    this.rushFractions.set(clip,fraction);
    return fraction;
  }
  private fallClip(){return this.clip('fall');}
  private reeling(state:PlayerState,real:number):PlayerState{
    this.reelClock+=real;
    this.reelHolding=false;
    if(REEL_ACTIONS.has(state.action)&&state.alive&&state.grounded){
      const reel=this.reel?.started===state.actionStarted&&this.reel.action===state.action?this.reel:(this.reel={action:state.action,started:state.actionStarted,duration:state.actionDuration,elapsed:0,ended:-1});
      reel.duration=state.actionDuration;reel.ended=-1;
      return state;
    }
    const reel=this.reel;
    if(!reel)return state;
    if(state.action!=='idle'||!state.grounded||!state.alive||this.locomotionSpeed>.3||!(reel.duration>0)){this.reel=undefined;return state;}
    if(reel.ended<0){reel.ended=this.reelClock;reel.elapsed=this.lastSince;}
    const lingered=this.reelClock-reel.ended;
    if(lingered>REEL_LINGER){this.reel=undefined;return state;}
    this.reelHolding=true;
    return {...state,action:reel.action,actionStarted:reel.started,actionDuration:reel.duration,actionTime:(reel.elapsed+lingered*REEL_RATE)/reel.duration};
  }
  private reel?:{action:PlayerState['action'];started:number;duration:number;elapsed:number;ended:number};
  private reelClock=0;
  private reelHolding=false;private lastSince=0;
  private timeToGround(state:PlayerState){
    const vy=Math.min(0,this.velocity.y),height=Math.max(0,state.y-this.groundY),g=JUMP_GRAVITY*FALL_GRAVITY;
    return (vy+Math.sqrt(vy*vy+2*g*height))/g;
  }
  private segmentOf(state:PlayerState){
    const found=this.enderClip(state),own=found?.own;
    if(own&&own.from!==undefined&&own.to!==undefined&&this.active?.getClip()===found.clip)return {from:own.from,to:own.to,contact:own.contact};
    if(state.action!=='light'||state.grounded||!this.usesAuthoredAirString)return undefined;
    const stage=this.rushStage(state),airStage=this.airStages(state.fighter)?.[stage];
    if(airStage?.from===undefined||airStage.to===undefined||this.active?.getClip()!==this.airStageClip(stage))return undefined;
    return {from:airStage.from,to:airStage.to,contact:airStage.contact};
  }
  private get usesAuthoredAirString(){return !this.isForm||this.state.fighter==='eren'||this.state.fighter==='asuka'||this.state.fighter==='minato'||this.state.fighter==='grimmjow'||this.state.fighter==='ken-kaneki'||this.state.fighter==='garou'||this.state.fighter==='akame'||this.state.fighter==='might-guy';}
  private airClips:(THREE.AnimationClip|null|undefined)[]=[];
  private airStageClip(stage:number){
    if(!this.usesAuthoredAirString)return undefined;
    let found=this.airClips[stage];
    if(found===undefined){
      const mapped=this.mapped(`air ${stage}`),own=this.airStages(this.state.fighter)?.[stage],name=mapped===undefined?own?.clip:undefined;
      const clip=name?this.clips.find(c=>c.name===name)??this.clips.find(c=>clean(c.name)===clean(name)):undefined;
      found=mapped!==undefined?mapped:clip&&(own!.span===undefined||Math.abs(clip.duration-own!.span)<.03)?clip:null;
      this.airClips[stage]=found;
    }
    return found??undefined;
  }
  private plungeLanded=-1;private plungeEpoch=-1;
  private plunge(state:PlayerState,t:number,at:number){
    if(Fighter.ender(state)!=='airSpecial')return t;
    if(this.plungeEpoch!==this.actionEpoch){this.plungeEpoch=this.actionEpoch;this.plungeLanded=-1;}
    const hold=at*.9;
    if(!state.grounded){this.plungeLanded=-1;return Math.min(t,hold);}
    if(this.plungeLanded<0)this.plungeLanded=t;
    const landed=this.plungeLanded;
    if(landed<=hold)return t;
    const slam=Math.min(.5*(1-landed),PLUNGE_SLAM/Math.max(.05,state.actionDuration||1)),since=t-landed;
    return since<slam?hold+since/slam*(at-hold):at+(since-slam)/Math.max(1e-3,1-landed-slam)*(1-at);
  }
  static ender(state:PlayerState){return state.branch&&(state.action==='heavy'||state.action==='special')?state.branch:undefined;}
  private enderClips=new Map<ComboKey,{clip:THREE.AnimationClip;own:ComboClip}|null>();
  private enderClip(state:PlayerState){
    const ender=Fighter.ender(state);
    if(!ender)return undefined;
    let found=this.enderClips.get(ender);
    if(found===undefined){
      found=null;
      if(DREAM_IMPACT&&Fighter.dreamTakes&&!this.isForm){
        const own=comboClip(state.fighter,ender),dream=own?this.clip(`dream ender ${ender}`):undefined;
        if(own&&dream&&(own.span===undefined||Math.abs(dream.duration-own.span)<.03))found={clip:dream,own:dreamRow(own,dream.name)};
      }
      const mapped=this.mapped(`ender ${ender}`);
      for(const own of found?[]:[this.isForm?comboFormClip(state.fighter,ender):undefined,comboClip(state.fighter,ender)]){
        if(!own)continue;
        const clip=mapped!==undefined?(mapped&&(mapped.name===own.clip||clean(mapped.name)===clean(own.clip))?mapped:undefined):this.clips.find(c=>c.name===own.clip)??this.clips.find(c=>clean(c.name)===clean(own.clip));
        if(clip&&(own.span===undefined||Math.abs(clip.duration-own.span)<.03)){found={clip,own};break;}
      }
      this.enderClips.set(ender,found);
    }
    return found??undefined;
  }
  slotClip(state:PlayerState,names:readonly string[]=this.slotClips(state.fighter)?.slice(1)??[]){
    if(this.swap)return false;
    if(!Fighter.ender(state))return true;
    const own=this.enderClip(state)?.clip;
    return !own||names.includes(own.name);
  }
  private slotClips(fighter:FighterId){const definition=FIGHTERS[fighter];return this.isForm?definition.formClips??definition.clips:definition.clips;}
  private airStages(fighter:FighterId){return (this.isForm?FORM_AIR_STRING_CLIPS[fighter]:undefined)??AIR_STRING_CLIPS[fighter];}
  private clipFor(state:PlayerState):THREE.AnimationClip|undefined{
    if(this.swap&&state===this.state)return this.swap.clip;
    if(state.action==='area'){const anim=areaAnim(state);return (anim.clip&&anim.fighter===state.fighter?this.findClip([anim.clip]):undefined)??this.clipFor({...state,action:anim.slot});}
    if(state.action==='victory'&&!this.victoryHeld){const entry=this.clips.find(c=>c.name===VICTORY_ENTRY);if(entry)return entry;}
    if(state.action==='ultimate'&&state.confirmedAt===undefined){
      const clip=this.clip('opener');
      if(clip)return clip;
    }
    const command=state.action==='light'&&state.grounded&&!this.stand&&!this.isForm&&(!state.awakened||state.fighter==='josuke')?STAND_COMMAND[state.fighter]:undefined;
    if(command){const clip=this.clip('command');if(clip)return clip;}
    const ender=this.enderClip(state);
    if(ender)return ender.clip;
    const stage=this.rushStage(state);
    if(stage){
      this.rushPlan??=this.planRush();
      const clip=(!state.grounded&&this.rushPlan.air[stage-1])||this.rushPlan.ground[stage-1];
      if(clip&&DREAM_IMPACT&&Fighter.dreamTakes&&state.grounded&&clip===this.rushPlan.ground[stage-1]){
        const dream=this.clip(`dream rush ${stage}`);
        if(dream){this.rushAuthored.add(dream);return dream;}
      }
      if(clip)return clip;
    }
    if(this.floating&&(state.action==='idle'||state.action==='run'||state.action==='guard')){const clip=this.clip(`float ${state.action}`);if(clip)return clip;}
    if(state.action==='idle'&&this.idleRig?.loop){const clip=this.idleRig.clip();if(clip)return clip;}
    if(this.clipMap)return this.mappedClip(state,this.clipMap.clips);
    return this.ruledClip(state);
  }
  private ruledClip(state:PlayerState){
    const airNormal=!this.isForm&&!state.grounded&&(state.action==='light'||state.action==='heavy');
    if(state.fighter==='naruto'&&ATTACK_SLOTS.has(state.action)&&!airNormal){
      const authored=this.findClip([`${this.isForm?'Kurama':'Naruto'} ${state.action}`]);
      if(authored)return authored;
    }
    if(state.action==='light'&&!state.grounded&&!(state.awakened&&state.fighter==='jotaro')){const opener=this.airStageClip(0);if(opener)return opener;}
    const authoredMotion=this.clips.find(c=>c.name===`Authored ${state.fighter} ${state.action}`);
    if(authoredMotion)return authoredMotion;
    if(state.action==='jump'&&this.falling){const fall=this.fallClip();if(fall)return fall;}
    if(state.action==='awaken'){
      const own=this.isForm?AWAKEN_FORM_TAKE[state.fighter]:AWAKEN_TAKE[state.fighter];
      const clip=this.findClip([...(own?[own]:[]),...(AWAKENINGS[state.fighter].clips??[]),'_Idle','Idle','stance']);
      if(clip)return clip;
    }
    if(state.action==='run'&&this.walking&&this.walkClip&&!this.blended)return this.walkClip;
    const reaction=Fighter.REACTIONS[state.action];
    if(reaction){const clip=this.findClip(reaction);if(clip)return clip;}
    if(!state.grounded&&(state.action==='light'||state.action==='heavy')&&!(state.awakened&&state.fighter==='jotaro')){
      const own=state.action==='light'&&this.usesAuthoredAirString?this.airStages(state.fighter):undefined;
      const air=own?this.airStageClip(0):this.findClip([state.action==='light'?'air Attack 01':'air Attack 02','air Attack']);
      if(air)return air;
    }
    const isGoku=state.fighter==='goku';
    const authored=this.slotClips(state.fighter);
    if(authored){const slot=['light','heavy','special','ultimate'].indexOf(state.action);const name=slot>=0?authored[slot]:(state.action==='victory'?this.findClip(state.fighter==='all-might'?['Symbol of Peace',...VICTORY]:VICTORY)?.name:undefined)??({idle:'_Idle',run:'Run',dash:'Dash',jump:'jump',guard:'Block',hurt:'Hit 01',defeated:'Die fall'}as Record<string,string>)[state.action];const before=name?SLOT_CLIP_BEFORE[state.fighter]?.[name]:undefined;return this.findClip(before?[name!,before.clip]:[name??'_Idle'])??this.clips[0];}
    if(state.fighter==='luffy'){const names:Record<string,string[]>={idle:['_Idle'],victory:VICTORY,run:['Run'],dash:['Dash'],jump:['jump'],guard:['Block'],light:['Gum-Gum Pistol'],heavy:['Gum-Gum Bazooka'],special:['Hawk Gatling','Punch 01'],ultimate:['Bajrang Gun','_Idle'],hurt:['Hit 01'],defeated:['Die fall']};return this.findClip(names[state.action]??['_Idle'])??this.clips[0];}
    if(isGoku&&['dash','jump','guard','light','heavy','hurt'].includes(state.action)){const adapted=this.findClip(['adapted_'+(state.action==='hurt'?'hit':state.action)]);if(adapted)return adapted;}
    const table:Record<string,string[]>={idle:isGoku?['goku-ready','02-STANCE','stance','idle']:['_Idle','Idle'],victory:VICTORY,run:['Run','Walk'],dash:['Dash','Run'],jump:['jump','Jump Fall'],guard:['Block','Guard','02-STANCE'],light:['Punch 01','Punch','Light'],heavy:isGoku?['Meteor','Kick 01','Punch 03']:['Rasengan Attack'],special:isGoku?['03-KAMEHAMEHA','Kamehameha']:['Rasengan Ready','Rasengan charge'],ultimate:isGoku?['Spirit Bomb','Ultimate','01-OSSU']:['Rasengan charge Bushin','Rasengan charge'],hurt:['Hit 01','Hit','Hurt'],defeated:['Die fall','Fall','Defeated']};
    return this.findClip(table[state.action]??table.idle)??this.findClip(table.idle)??this.clips[0];
  }
  private contactCurve(state:PlayerState,clip=this.active?.getClip()){
    const area=state.action==='area'?areaAnim(state):undefined,slot=(area?.clip&&area.fighter===state.fighter?'area':area?area.slot:state.action) as AttackSlot;
    const segment=this.segmentOf(state);
    if(segment){
      const move=this.moveFor(state),at=move.contacts[0]/Math.max(.01,state.actionDuration),t=THREE.MathUtils.clamp(state.actionTime,0,1);
      const fraction=segment.contact??at,held=this.plunge(state,t,at);
      return held<=at?held/Math.max(.001,at)*fraction:fraction+(held-at)/Math.max(.001,1-at)*(1-fraction);
    }
    if(!state.actionDuration||!ATTACK_SLOTS.has(state.action))return null;
    const stage=this.rushStage(state);
    if(slot==='ultimate'&&clip&&!isCharacterMotion(clip)){const laid=this.ultimateCurve(state,clip);if(laid!==undefined)return laid;}
    if(slot==='ultimate'&&clip&&isCharacterMotion(clip)&&state.confirmedAt===undefined){
      const move=this.moveFor(state);
      if(move.confirm)return Math.min(THREE.MathUtils.clamp(state.actionTime,0,1),(move.contacts[0]+.1)/state.actionDuration);
    }
    if(!stage&&clip&&(isCharacterMotion(clip)||state.fighter==='naruto'&&/^(Naruto|Kurama)\s*(light|heavy|special|ultimate)$/i.test(clip.name)))return THREE.MathUtils.clamp(state.actionTime,0,1);
    const move=this.moveFor(state);
    const melee=move.style==='melee';
    if(move.contacts.length>1){
      if(melee)return this.stringCurve(state,move);
      const clip=this.active?.getClip();
      return clip?clipAtMotion(clipMotionTable(clip),THREE.MathUtils.clamp(state.actionTime,0,1)):null;
    }
    const at=move.contacts[0]/state.actionDuration;
    if(at<=.02||at>=.98)return null;
    const ender=Fighter.ender(state),own=this.enderClip(state);
    const earlier=clip?Object.values(SLOT_CLIP_BEFORE[state.fighter]??{}).find(b=>b.clip===clip.name):undefined;
    const fraction=stage?this.rushFraction(clip,stage,state):own&&clip===own.clip?own.own.contact??at:(this.isForm?FORM_CONTACT[state.fighter]?.[slot]:undefined)??(earlier?earlier.contact??at:undefined)??CONTACT_FRACTION[state.fighter]?.[slot]??at;
    const t=this.plunge(state,THREE.MathUtils.clamp(state.actionTime,0,1),at);
    if(!clip)return melee?Fighter.strike(t,at,fraction):null;
    const natural=fraction*clip.duration/(at*state.actionDuration);
    if(area&&!area.full){
      if(t<=at){const wound=Fighter.windUp(t,at,fraction,state.actionDuration,clip,natural);this.chargeWanted=wound.hold;return wound.progress;}
      this.chargeWanted=0;
      return fraction+(1-fraction)*.12*THREE.MathUtils.smoothstep((t-at)/Math.max(.001,1-at),0,1);
    }
    const anchoredRelease=!ender&&(state.fighter==='ace'&&slot==='special'||!!move.aimOnRelease);
    if(!melee&&!anchoredRelease&&natural>=PACE_BAND[0]&&natural<=PACE_BAND[1])return clipAtMotion(clipMotionTable(clip),t);
    if(t<=at){
      const wound=Fighter.windUp(t,at,fraction,state.actionDuration,clip,natural);
      this.chargeWanted=wound.hold;
      return wound.progress;
    }
    this.chargeWanted=0;
    const probe=Math.max(0,at-1/(60*state.actionDuration));
    const before=Fighter.windUp(probe,at,fraction,state.actionDuration,clip,natural).progress;
    const tau=(t-at)*state.actionDuration,left=(1-at)*state.actionDuration,gap=at-probe;
    const stopped=Math.abs(this.clockHeldAt-at*state.actionDuration)<=FREEZE_LATE;
    if((1-fraction)*clip.duration<=left*FOLLOW_MIN)
      return Fighter.followThrough(tau,left,fraction,clip.duration,stopped?0:gap>1e-6?(fraction-before)/(gap*state.actionDuration):FOLLOW_MIN/clip.duration);
    const table=clipMotionTable(clip),contact=motionAt(table,fraction);
    const arrival=stopped?0:gap>1e-6?(contact-motionAt(table,before))/(gap*state.actionDuration):FOLLOW_MIN/clip.duration;
    return clipAtMotion(table,Fighter.followThrough(tau,left,contact,clip.duration,arrival));
  }
  private ultimatePlan(fighter:FighterId):UltimateClips|undefined{const plan=ULTIMATE_CLIPS[fighter];return plan?.formOnly&&!this.isForm?undefined:plan;}
  private ultimateCurve(state:PlayerState,clip:THREE.AnimationClip):number|undefined{
    const plan=this.ultimatePlan(state.fighter),move=this.moveFor(state);
    if(!plan||!state.actionDuration)return undefined;
    const D=state.actionDuration,t=THREE.MathUtils.clamp(state.actionTime,0,1)*D,L=Math.max(1e-3,clip.duration);
    const c0=move.contacts[0],last=move.contacts[move.contacts.length-1];
    if(plan.release!==undefined){
      this.chargeWanted=0;
      const table=clipMotionTable(clip),r=motionAt(table,plan.release),from=Math.max(0,r-PACE_BAND[1]*c0/L);
      if(t<=c0)return clipAtMotion(table,from+(r-from)*(c0>1e-3?t/c0:1));
      return Math.min(.999,clipAtMotion(table,r+(1-r)*(t-c0)/Math.max(1e-3,D-c0)));
    }
    const confirmed=state.confirmedAt!==undefined,opener=this.isForm?plan.formOpener:plan.opener;
    if(!confirmed&&opener){
      if(clip.name!==opener.clip)return undefined;
      const span=c0+OPENER_TAIL,u=Math.min(1,t/span),at=c0/span,f=opener.at;
      const table=clipMotionTable(clip),mF=motionAt(table,f),mStart=Math.max(0,mF-OPENER_FASTEST*c0/L);
      const wound=(v:number)=>{const w=THREE.MathUtils.clamp(v/at,0,1),k=1-CINE_DRIVE;return clipAtMotion(table,mStart+(mF-mStart)*(w<k?CINE_BUILT*w/k:CINE_BUILT+(1-CINE_BUILT)*Math.pow((w-k)/CINE_DRIVE,1.6)));};
      this.chargeWanted=0;
      if(u<=at)return wound(u);
      const probe=Math.max(0,at-1/(60*span)),before=wound(probe);
      const tau=(u-at)*span,left=(1-at)*span,gap=at-probe;
      return Math.min(.999,Fighter.followThrough(tau,left,f,L,gap>1e-6?(f-before)/(gap*span):FOLLOW_MIN/L));
    }
    const cine=plan.cine;
    if(!cine)return undefined;
    this.chargeWanted=0;
    if(cine.windows){
      const blows=move.contacts.length-1,w=cine.windows;
      if(w.length!==blows)return undefined;
      const edges=(k:number)=>k<=0?c0:k>=blows?D:(move.contacts[k]+move.contacts[k+1])/2;
      let k=0;while(k<blows-1&&t>=edges(k+1))k++;
      const from=edges(k),to=edges(k+1),span=Math.max(1e-3,to-from),u=THREE.MathUtils.clamp((t-from)/span,0,1);
      const [start,end,blow]=w[k],at=THREE.MathUtils.clamp((move.contacts[k+1]-from)/span,.08,.92),share=end-start;
      const fraction=blow!==undefined?THREE.MathUtils.clamp((blow-start)/Math.max(1e-3,share),.08,.92):at;
      return Math.min(.999,start+share*(u<=at?fraction*(u/at):fraction+(1-fraction)*(u-at)/(1-at)));
    }
    const table=clipMotionTable(clip),mFrom=motionAt(table,cine.from),mAt=motionAt(table,cine.at);
    const gather=(time:number)=>{
      const u=THREE.MathUtils.clamp((time-c0)/Math.max(1e-3,last-c0),0,1),k=1-CINE_DRIVE;
      const g=u<k?CINE_BUILT*u/k:CINE_BUILT+(1-CINE_BUILT)*Math.pow((u-k)/CINE_DRIVE,1.6);
      return clipAtMotion(table,mFrom+(mAt-mFrom)*g);
    };
    if(t<=last)return gather(t);
    const probe=Math.max(c0,last-1/60),arrival=(gather(last)-gather(probe))/Math.max(1e-3,last-probe);
    return Math.min(.999,Fighter.followThrough(t-last,Math.max(1e-3,D-last),gather(last),L,arrival));
  }
  private static windUp(t:number,at:number,fraction:number,D:number,clip:THREE.AnimationClip,natural:number){
    const table=natural>=PACE_BAND[0]?clipMotionTable(clip):null;
    const c=table?motionAt(table,fraction):fraction;
    if(!table||c*clip.duration/(at*D)<PACE_BAND[0])return Fighter.pace(t,at,fraction,D,clip.duration);
    const paced=Fighter.pace(t,at,c,D,clip.duration);
    return {progress:clipAtMotion(table,paced.progress),hold:paced.hold};
  }
  static animeWarp(t:number,contacts:readonly number[],D:number,hold:number){
    for(let k=0;k<contacts.length;k++){
      const c=contacts[k],L=k===0?0:(contacts[k-1]+c)/2,R=k===contacts.length-1?D:(c+contacts[k+1])/2;
      if(t<L||t>R)continue;
      if(c-L<ANIME_MIN||R-c<ANIME_MIN)return t;
      const drive=Math.min(ANIME_DRIVE,ANIME_DRIVE_SHARE*(c-L)),snap=Math.min(ANIME_SNAP,drive*.6),held=Math.min(hold,(R-c)*.4);
      if(t<=c-snap)return L+(t-L)*(c-drive-L)/Math.max(1e-4,c-snap-L);
      if(t<=c)return c-drive+(t-(c-snap))*drive/Math.max(1e-4,snap);
      if(t<=c+held)return c;
      return c+(t-c-held)*(R-c)/Math.max(1e-4,R-c-held);
    }
    return t;
  }
  private static followThrough(tau:number,T:number,c:number,L:number,arrival:number){
    const left=1-c;
    if(left<=1e-6||L<=1e-6)return Math.min(1,c);
    const slowest=FOLLOW_MIN/L,fastest=FOLLOW_MAX/L;
    const start=THREE.MathUtils.clamp(Number.isFinite(arrival)?arrival:slowest,0,fastest);
    const ease=FOLLOW_EASE*(1-Math.exp(-Math.max(0,T)/FOLLOW_EASE));
    const cruise=THREE.MathUtils.clamp(T-ease>1e-6?(left-start*ease)/(T-ease):slowest,slowest,fastest);
    const played=cruise*tau+(start-cruise)*FOLLOW_EASE*(1-Math.exp(-Math.max(0,tau)/FOLLOW_EASE));
    return Math.min(1,c+Math.max(0,Math.min(left,played)));
  }

  private static pace(t:number,at:number,c:number,D:number,L:number):{progress:number;hold:number}{
    const Tc=at*D,natural=c*L/Tc;
    if(natural>=PACE_BAND[0]&&natural<=PACE_BAND[1])return {progress:Fighter.strike(t,at,c,THREE.MathUtils.smoothstep(natural,SHAPE_FULL,SHAPE_NONE)),hold:0};
    if(natural>PACE_BAND[1]){
      const s0=Math.max(0,c-PACE_BAND[1]*Tc/L);
      const e1=Math.min(1,c+PACE_TAIL_MAX*(D-Tc)/L);
      if(t<=at){const u=at>1e-4?t/at:1;return {progress:s0+(c-s0)*Math.pow(u,SKIP_SHAPE),hold:0};}
      const u=at<1-1e-4?(t-at)/(1-at):1;
      return {progress:Math.min(e1,c+Math.max((e1-c)*u*(2-u),RECOVERY_FLOOR*(t-at)*(e1-c))),hold:0};
    }
    if(t<=at){
      const u=t*D;
      const driveSec=THREE.MathUtils.clamp((1-STRIKE_COILED)*c*L/1.15,.06,.24*Tc);
      const drawSec=THREE.MathUtils.clamp(STRIKE_DRAWN*c*L/.75,.06,.42*Tc);
      const settleSec=Math.max(0,Tc-drawSec-driveSec);
      const settleContent=Math.min(c*.5,PACE_CREEP*settleSec/D);
      const drawContent=Math.max(0,c-(1-STRIKE_COILED)*c-settleContent);
      const hold=THREE.MathUtils.smoothstep(settleSec,.25,.6);
      if(u<drawSec){const v=u/drawSec;return {progress:drawContent*v*v*(3-2*v),hold:0};}
      if(u<drawSec+settleSec){
        const v=(u-drawSec)/Math.max(1e-4,settleSec);
        return {progress:drawContent+settleContent*v,hold:hold*Math.sin(v*Math.PI)};
      }
      const v=THREE.MathUtils.clamp((u-drawSec-settleSec)/Math.max(1e-4,driveSec),0,1);
      return {progress:drawContent+settleContent+(1-STRIKE_COILED)*c*Math.pow(v,STRIKE_DRIVE),hold:0};
    }
    const u=at<1-1e-4?(t-at)/(1-at):1;
    return {progress:Math.min(1,c+Math.max((1-c)*u*(2-u),RECOVERY_FLOOR*(t-at),(t-at)*D/L)),hold:0};
  }

  private static strike(t:number,at:number,fraction:number,soft=0){
    if(t<=at){
      const u=at>1e-4?t/at:1;
      if(soft>=1)return fraction*u;
      const shaped=Fighter.strikeShape(u,fraction);
      return soft>0?THREE.MathUtils.lerp(shaped,fraction*u,soft):shaped;
    }
    const u=at<1-1e-4?(t-at)/(1-at):1;
    return Math.min(1,fraction+Math.max((1-fraction)*u*(2-u),RECOVERY_FLOOR*(t-at)));
  }
  private static strikeShape(u:number,fraction:number){
    {
      if(u<=STRIKE_DRAW){const v=u/STRIKE_DRAW;return fraction*STRIKE_DRAWN*v*v*(3-2*v);}
      if(u<=STRIKE_SETTLE){
        const v=(u-STRIKE_DRAW)/(STRIKE_SETTLE-STRIKE_DRAW);
        return fraction*(STRIKE_DRAWN+(STRIKE_COILED-STRIKE_DRAWN)*v*v*(3-2*v));
      }
      const v=(u-STRIKE_SETTLE)/(1-STRIKE_SETTLE);
      return fraction*(STRIKE_COILED+(1-STRIKE_COILED)*Math.pow(v,STRIKE_DRIVE));
    }
  }

  private stringCurve(state:PlayerState,move:MoveDefinition){
    const contacts=move.contacts,count=contacts.length;
    const elapsed=THREE.MathUtils.clamp(state.actionTime,0,1)*state.actionDuration;
    const edges=[0,...contacts.slice(1).map((c,i)=>(c+contacts[i])/2),state.actionDuration];
    let phase=0;
    while(phase<count-1&&elapsed>=edges[phase+1])phase++;
    const from=edges[phase],to=edges[phase+1],span=Math.max(1e-3,to-from);
    const windows=(this.isForm?FORM_STRING_WINDOWS[state.fighter]?.[state.action as AttackSlot]:undefined)??STRING_WINDOWS[state.fighter]?.[state.action as AttackSlot];
    const window=windows&&windows.length===count?windows[phase]:undefined;
    const base=window?window[0]:phase/count,share=window?window[1]-window[0]:1/count;
    const t=THREE.MathUtils.clamp((elapsed-from)/span,0,1);
    if(span<STRING_FLOOR)return base+share*t;
    const at=THREE.MathUtils.clamp((contacts[phase]-from)/span,.08,.92);
    if(!window)return base+share*Fighter.strike(t,at,at);
    const fraction=window[2]!==undefined?THREE.MathUtils.clamp((window[2]-window[0])/share,.08,.92):at;
    return base+share*(t<=at?fraction*(t/at):fraction+(1-fraction)*(t-at)/(1-at));
  }

  private groundedMelee(state:PlayerState){
    if(state.fighter!=='goku'||(state.action!=='light'&&state.action!=='heavy')||this.rushStage(state)||Fighter.ender(state))return;
    if(state.action==='light'&&!state.grounded&&this.airStageClip(0))return;
    if(state.action==='heavy'){const clip=this.clip(`melee ${GOKU_TRANSMISSION}`);if(clip)return {clip,phase:GOKU_TRANSMISSION,progress:THREE.MathUtils.clamp(state.actionTime,0,.999),contact:MOVES.goku.heavy.contacts[0],elapsed:state.actionTime*state.actionDuration};}
    const move=MOVES.goku[state.action],elapsed=state.actionTime*state.actionDuration;
    const boundaries=[0,...move.contacts.slice(1).map((contact,i)=>(contact+move.contacts[i])/2),move.duration];
    const phase=Math.min(move.contacts.length-1,boundaries.slice(1).filter(end=>elapsed>=end).length);
    const measured=GOKU_MELEE_CONTACTS[phase];
    const clip=this.clip(`melee ${phase}`);
    if(!clip)return;
    const contact=move.contacts[phase],start=boundaries[phase],end=boundaries[phase+1];
    const peak=measured.peak;
    const punch=phase<2;
    const holdEnd=Math.min(end-.025,contact+(punch?.025:.075));
    let progress:number;
    if(elapsed<=contact){
      const u=THREE.MathUtils.clamp((elapsed-start)/Math.max(.001,contact-start),0,1);
      const table=clipMotionTable(clip);
      progress=clipAtMotion(table,motionAt(table,peak)*Math.pow(u,1.15));
    }else{
      const recoveryEnd=punch?Math.min(end,holdEnd+.08):end;
      progress=elapsed<=holdEnd?peak:peak+Math.min(1,(elapsed-holdEnd)/(recoveryEnd-holdEnd))*(1-peak);
    }
    return {clip,phase,progress,contact,elapsed};
  }
  private stepMoveClock(state:PlayerState,real:number,finite:boolean,recoil:boolean){
    const duration=state.actionDuration;
    Object.assign(this.drawn,state);
    const seconds=state.actionTime*duration;
    if(this.hitFreeze>this.freezeSeen+1e-6){
      let honoured=true;
      if(this.strikeContact){
        honoured=false;
        if(ATTACK_SLOTS.has(state.action)&&duration>0){
          const at=this.moveClock;
          for(const contact of this.moveFor(state).contacts)
            if(at>=contact-FREEZE_EARLY&&at<=contact+FREEZE_LATE&&!(this.clockHeldAt>=contact-FREEZE_EARLY&&this.clockHeldAt<=at+1e-6)){honoured=true;break;}
        }
      }
      this.freezeHonoured=honoured;
    }
    const stage=this.rushStage(state),seq=ATTACK_SLOTS.has(state.action)?state.actionSeq:undefined;
    const fresh=!finite||recoil||!(duration>0)||state.action!==this.clockAction||stage!==this.clockStage||seq!==this.clockSeq
      ||state.actionTime<this.clockTime-.25||(state.actionStarted>this.clockStarted+1e-6&&state.actionTime<.1);
    const ticks=(seconds-this.clockSeconds)/MOVE_TICK;
    this.clockAction=state.action;this.clockStage=stage;this.clockSeq=seq;this.clockTime=state.actionTime;this.clockStarted=state.actionStarted;this.clockSeconds=seconds;
    const previous=this.moveClock;
    if(fresh){this.moveClock=seconds;this.clockLag=0;this.clockHeldAt=state.hitstop?seconds:-Infinity;}
    else if(state.hitstop||state.timeStopped){
      if(state.hitstop)this.clockHeldAt=this.moveClock;
      const target=seconds-this.clockLag;
      if(this.moveClock<target)this.moveClock=Math.min(target,this.moveClock+real);
    }else if(this.hitFreeze>0&&this.freezeHonoured){
      this.clockLag=Math.max(0,seconds-this.moveClock);
    }else{
      this.clockLag*=Math.exp(-MOVE_CLOCK_GAIN*real);
      const target=seconds-this.clockLag,free=this.moveClock+real;
      const quantised=ticks>-1e-6&&ticks<3.5&&Math.abs(ticks-Math.round(ticks))<1e-3;
      this.moveClock=quantised&&real>0&&real<3*MOVE_TICK&&Math.abs(target-free)<=MOVE_CLOCK_BAND
        ?target+(free-target)*Math.exp(-MOVE_CLOCK_GAIN*real):target;
    }
    if(!fresh)this.moveClock=Math.max(this.moveClock,previous);
    if(duration>0){this.moveClock=Math.min(this.moveClock,duration);this.drawn.actionTime=this.moveClock/duration;}
    if(duration>0&&!recoil&&Fighter.animStyle!=='classic'&&state.action!=='ultimate'&&ATTACK_SLOTS.has(state.action)){
      const move=this.moveFor(state);
      if(move.style==='melee'){
        const big=!!Fighter.ender(state)||state.action==='special'||this.rushStage(state)>=RUSH_STAGES-1;
        this.drawn.actionTime=Fighter.animeWarp(this.moveClock,move.contacts,duration,big?ANIME_HOLD.big:state.action==='heavy'?ANIME_HOLD.heavy:ANIME_HOLD.light)/duration;
      }
    }
    return this.drawn;
  }
  static transitions:Record<TransitionKind,'inertial'|'frozen'>={attack:'inertial',motion:'frozen',reaction:'frozen',struck:'frozen',loop:'frozen'};
  private blendMode:'inertial'|'frozen'='frozen';
  private blendKind:TransitionKind='motion';
  private lastBlendDt=0;
  private get transitioning(){return this.blendTime<this.blendDuration;}
  private startPoseBlend(duration:number,rootDuration=duration,kind:TransitionKind='motion'){
    this.blendMode=Fighter.transitions[kind];this.blendKind=kind;
    this.rootFromClamped=this.rootClamped;this.rootDrawnFrom.copy(this.rootDrawnLast);
    this.blendDuration=duration;this.blendTime=0;
    this.rootBlendDuration=rootDuration;this.rootBlendTime=0;
    const rate=this.blendMode==='inertial'&&this.lastBlendDt>1e-4?1/this.lastBlendDt:0;
    const legs=this.strideNodes();
    for(const pose of this.poseNodes){
      pose.fromPosition.copy(pose.blendPosition);pose.fromRotation.copy(pose.blendRotation);pose.fromScale.copy(pose.blendScale);
      const carry=legs.has(pose.node)||this.rootChain.has(pose.node)?0:rate;
      rotationVector(_spin.copy(pose.blendRotation).multiply(_spinInverse.copy(pose.prevRotation).invert()),pose.sourceSpin);
      if(pose.sourceSpin.lengthSq()>FLIP_STEP*FLIP_STEP)pose.sourceSpin.set(0,0,0);
      pose.sourceSpin.multiplyScalar(carry).clampLength(0,SPIN_CARRY);
      pose.sourceDrift.subVectors(pose.blendPosition,pose.prevPosition).multiplyScalar(carry).clampLength(0,DRIFT_CARRY);
      pose.crossTarget.set(0,0,0,0);
    }
  }
  private static crossfade(pose:PoseNode,weight:number){
    const from=pose.fromRotation,target=pose.sampleRotation,last=pose.crossTarget;
    const unset=last.x===0&&last.y===0&&last.z===0&&last.w===0;
    const toward=unset?from:last;
    const s=target.x*toward.x+target.y*toward.y+target.z*toward.z+target.w*toward.w<0?-1:1;
    last.set(target.x*s,target.y*s,target.z*s,target.w*s);
    const cos=from.x*last.x+from.y*last.y+from.z*last.z+from.w*last.w;
    if(cos>=0){pose.node.quaternion.slerpQuaternions(from,target,weight);return;}
    const theta=Math.acos(Math.max(-1,cos)),sin=Math.sin(theta);
    if(sin<1e-6){pose.node.quaternion.copy(weight<.5?from:last);return;}
    const a=Math.sin((1-weight)*theta)/sin,b=Math.sin(weight*theta)/sin;
    pose.node.quaternion.set(from.x*a+last.x*b,from.y*a+last.y*b,from.z*a+last.z*b,from.w*a+last.w*b).normalize();
  }
  private restoreSampledPose(){
    for(const pose of this.poseNodes){pose.node.position.copy(pose.samplePosition);pose.node.quaternion.copy(pose.sampleRotation);pose.node.scale.copy(pose.sampleScale);}
  }
  private applyPoseBlend(dt:number){
    this.blendTime+=dt;this.rootBlendTime+=dt;
    const linear=this.blendDuration>0?Math.min(1,this.blendTime/this.blendDuration):1;
    const weight=linear*linear*(3-2*linear);
    const rootLinear=this.rootBlendDuration>0?Math.min(1,this.rootBlendTime/this.rootBlendDuration):1;
    const rootWeight=rootLinear*rootLinear*(3-2*rootLinear);
    const inertial=this.blendMode==='inertial';
    const carried=inertial&&linear<1?(linear-2*linear*linear+linear*linear*linear)*this.blendDuration:0;
    const rootCarried=inertial&&rootLinear<1?(rootLinear-2*rootLinear*rootLinear+rootLinear*rootLinear*rootLinear)*this.rootBlendDuration:0;
    for(const pose of this.poseNodes){
      pose.prevPosition.copy(pose.blendPosition);pose.prevRotation.copy(pose.blendRotation);
      pose.samplePosition.copy(pose.node.position);pose.sampleRotation.copy(pose.node.quaternion);pose.sampleScale.copy(pose.node.scale);
      const travels=this.rootChain.has(pose.node);
      const positional=travels?rootWeight:weight;
      if(positional<1)pose.node.position.lerpVectors(pose.fromPosition,pose.samplePosition,positional);
      if(weight<1){Fighter.crossfade(pose,weight);pose.node.scale.lerpVectors(pose.fromScale,pose.sampleScale,weight);}
      if(carried>0)pose.node.quaternion.premultiply(fromRotationVector(_turn.copy(pose.sourceSpin).multiplyScalar(carried),_spin));
      const drift=travels?rootCarried:carried;
      if(drift>0)pose.node.position.addScaledVector(pose.sourceDrift,drift);
      pose.blendPosition.copy(pose.node.position);pose.blendRotation.copy(pose.node.quaternion);pose.blendScale.copy(pose.node.scale);
    }
    this.rootGrip=rootWeight;
    if(dt>0){
      this.holdJoints??=new Set([...this.joints].filter(([name])=>!/hand|forearm|toe/i.test(name)).map(([,bone])=>bone as THREE.Object3D));
      let fastest=0;
      for(const pose of this.poseNodes)if(this.holdJoints.has(pose.node))fastest=Math.max(fastest,pose.prevRotation.angleTo(pose.blendRotation));
      this.animSpeed=fastest/dt;
    }
    this.lastBlendDt=dt;
  }
  private samplersFor(clip:THREE.AnimationClip){
    let tracks=this.poseSamplers.get(clip);
    if(!tracks){
      let shared=clipSamplers.get(clip);
      if(!shared){
        shared=[];
        for(const track of clip.tracks){
          const parsed=THREE.PropertyBinding.parseTrackName(track.name);
          if(!['position','quaternion','scale'].includes(parsed.propertyName))continue;
          const factory=track as THREE.KeyframeTrack&{createInterpolant():THREE.Interpolant};
          shared.push({name:parsed.nodeName,property:parsed.propertyName,interpolant:factory.createInterpolant()});
        }
        clipSamplers.set(clip,shared);
      }
      tracks=[];
      for(const sampler of shared){const node=this.nodeNamed(sampler.name);if(node)tracks.push({node,property:sampler.property,interpolant:sampler.interpolant});}
      this.poseSamplers.set(clip,tracks);
    }
    return tracks;
  }
  private nodesByName?:Map<string,THREE.Object3D>;
  private nodeNamed(name:string){
    if(!this.nodesByName){
      const map=new Map<string,THREE.Object3D>([[this.model.name,this.model]]);
      this.model.traverse(node=>{if(node!==this.model&&!map.has(node.name))map.set(node.name,node);});
      this.nodesByName=map;
    }
    return this.nodesByName.get(name);
  }

  private poseDistance(clip:THREE.AnimationClip,at=0){
    let total=0,count=0,travel=0,widest=0;
    for(const track of this.samplersFor(clip)){
      const pose=this.poseByNode.get(track.node);
      if(track.property==='position'){
        if(track.node!==this.rootBone)continue;
        _blendTarget2.fromArray(track.interpolant.evaluate(at) as unknown as number[]);
        travel=_blendTarget2.distanceTo(pose?.blendPosition??(track.node as THREE.Object3D).position);
        continue;
      }
      if(track.property!=='quaternion')continue;
      if(!this.bodyJointSet.has(track.node as THREE.Object3D))continue;
      _blendTarget.fromArray(track.interpolant.evaluate(at) as unknown as number[]);
      const angle=_blendTarget.angleTo(pose?.blendRotation??(track.node as THREE.Object3D).quaternion);
      total+=angle;widest=Math.max(widest,angle);
      count++;
    }
    this.poseGapMax=widest;
    return (count?total/count:0)+travel*ROOT_TRAVEL_WEIGHT;
  }
  private poseGapMax=0;
  private get bodyJointSet(){
    if(!this.bodyJoints){this.bodyJoints=new Set<THREE.Object3D>();for(const bone of this.joints.values())this.bodyJoints.add(bone);}
    return this.bodyJoints;
  }

  private get cadenceKey(){return (this.isForm?`${this.state.fighter}-form`:this.state.fighter) as FighterId;}
  private gaitTime(clip:THREE.AnimationClip,which:'run'|'walk'){
    const cadence=CADENCE[this.cadenceKey]?.[which];
    const step=cadence&&cadence.step>0?cadence.step:clip.duration/2;
    const at=(this.gait+(cadence?.phase??0))*step;
    return ((at%clip.duration)+clip.duration)%clip.duration;
  }
  private get blended(){return this.state.action==='run'&&!!this.walkClip&&!!this.runClip&&this.walkClip!==this.runClip;}
  private strideNodes(){
    if(!this.legNodes){
      const set=new Set<THREE.Object3D>();
      for(const leg of this.legs)leg.hip.traverse(node=>set.add(node));
      this.legNodes=set;
    }
    return this.legNodes;
  }
  private settleTail(dt:number,state:PlayerState){
    const active=this.active;
    if(!active||!(state.action==='heavy'||state.action==='special'||state.action==='ultimate')||!state.actionDuration){this.tailWeight=0;this.tailSince=0;return;}
    this.idleClip=this.idleRig?.stance()??this.idleClip??this.clipFor({...state,action:'idle'});
    const idle=this.idleClip,clip=active.getClip();
    if(!idle||idle===clip)return;
    const move=this.moveFor(state),elapsed=state.actionTime*state.actionDuration,last=move.contacts[move.contacts.length-1]??0;
    const spent=elapsed>last+.1&&active.time>=clip.duration*.995&&(this.tailSince>0||state.actionDuration-elapsed>TAIL_AFTER+TAIL_BLEND*.5);
    if(dt>0){
      this.tailSince=spent?this.tailSince+dt:0;
      this.tailTime+=dt;
    }
    const want=THREE.MathUtils.smoothstep(this.tailSince,TAIL_AFTER,TAIL_AFTER+TAIL_BLEND);
    this.tailWeight=spent?Math.max(this.tailWeight,want):0;
    if(this.tailWeight<1e-3)return;
    if(this.tailSince<=dt)this.tailTime=0;
    const at=this.tailTime%idle.duration,mix=this.tailWeight;
    for(const track of this.samplersFor(idle)){
      const value=track.interpolant.evaluate(at);
      if(track.property==='quaternion'){_blendTarget.fromArray(value as unknown as number[]);track.node.quaternion.slerp(_blendTarget,mix);}
      else if(track.property==='position'){_leanPoint.fromArray(value as unknown as number[]);track.node.position.lerp(_leanPoint,mix);}
    }
  }
  private sampleActivePose(){
    if(!this.active)return;
    const clip=this.active.getClip();
    const tracks=this.samplersFor(clip);
    for(const track of tracks){const value=track.interpolant.evaluate(this.active.time);if(track.property==='position')track.node.position.fromArray(value);else if(track.property==='quaternion')track.node.quaternion.fromArray(value);else track.node.scale.fromArray(value);}
    if(this.stride>.004&&this.runClip&&clip!==this.runClip&&this.legs.length){
      const cadence=CADENCE[this.cadenceKey]?.run;
      const step=cadence&&cadence.step>0?cadence.step:this.runClip.duration/2;
      const at=(((this.strideClock*step)%this.runClip.duration)+this.runClip.duration)%this.runClip.duration;
      const nodes=this.strideNodes(),mix=this.stride;
      for(const track of this.samplersFor(this.runClip)){
        if(!nodes.has(track.node as THREE.Object3D))continue;
        const value=track.interpolant.evaluate(at);
        if(track.property==='quaternion'){
          _blendTarget.fromArray(value as unknown as number[]);
          (track.node as THREE.Object3D).quaternion.slerp(_blendTarget,mix);
        }else if(track.property==='position'){
          _leanPoint.fromArray(value as unknown as number[]);
          (track.node as THREE.Object3D).position.lerp(_leanPoint,mix);
        }
      }
    }
    if(!this.blended||this.gaitBlend>=.998||clip!==this.runClip)return;
    const walk=this.walkClip!,at=this.gaitTime(walk,'walk'),mix=1-this.gaitBlend;
    for(const track of this.samplersFor(walk)){
      const value=track.interpolant.evaluate(at);
      if(track.property==='quaternion'){
        _blendTarget.fromArray(value as unknown as number[]);
        (track.node as THREE.Object3D).quaternion.slerp(_blendTarget,mix);
      }else if(track.property==='position'){
        _leanPoint.fromArray(value as unknown as number[]);
        (track.node as THREE.Object3D).position.lerp(_leanPoint,mix);
      }
    }
  }
  private guardStride(dt:number,state:PlayerState,runSign:number){
    if(state.fighter==='pikachu')return;
    if(!this.dynamics||!this.legs.length)return;
    const moving=this.locomotionSpeed>(this.strideWeight>.02?.3:.4);
    const wanted=GUARD_STRIDE.has(state.fighter)&&state.action==='guard'&&state.grounded&&moving&&!this.floating?1:0;
    this.strideWeight+=(wanted-this.strideWeight)*(1-Math.exp(-dt*24));
    if(this.strideWeight<.004)return;
    const walking=this.walking&&!!this.walkClip;
    if(this.strideWalking!==walking){this.strideWalking=walking;this.strideClip=this.clipFor({...state,action:'run'});}
    const clip=this.strideClip;
    if(!clip||!/run|walk|dash/i.test(clip.name))return;
    if(!this.legMask){this.legMask=new Set<THREE.Object3D>();for(const leg of this.legs)leg.hip.traverse(node=>this.legMask!.add(node));}
    const cadence=CADENCE[this.cadenceKey]?.[walking?'walk':'run'];
    const stride=TARGET_STRIDE*(this.legLength||.85)*(STRIDE_SCALE[this.state.fighter]??1);
    const speed=Math.max(.5,this.locomotionSpeed);
    const rate=(cadence&&cadence.step>0&&stride>0
      ?THREE.MathUtils.clamp(cadence.step*speed/stride,CADENCE_RANGE[0],CADENCE_RANGE[1])
      :THREE.MathUtils.clamp(speed/(walking?3.2:7.5),.65,1.25)*1.05)*runSign;
    this.legPhase=((this.legPhase+dt*rate)%clip.duration+clip.duration)%clip.duration;
    const spine=this.leanChain[1];
    for(const track of this.samplersFor(clip)){
      if(track.property!=='quaternion')continue;
      const pelvis=track.node===this.pelvis&&!!spine;
      if(!pelvis&&!this.legMask.has(track.node))continue;
      _blendTarget.fromArray(track.interpolant.evaluate(this.legPhase) as unknown as number[]);
      if(!pelvis){track.node.quaternion.slerp(_blendTarget,this.strideWeight);continue;}
      _strideFrom.copy(track.node.quaternion);
      track.node.quaternion.slerp(_blendTarget,this.strideWeight);
      spine.quaternion.premultiply(_strideBack.copy(track.node.quaternion).invert().multiply(_strideFrom));
    }
  }

  private airTuck(real:number,state:PlayerState){
    if(state.fighter==='pikachu')return;
    const own=this.usesAuthoredAirString?this.airStages(state.fighter):undefined;
    const stage=this.rushStage(state);
    const wanted=own&&state.action==='light'&&!state.grounded&&stage<own.length&&own[stage].tuck?1:0;
    this.tuckWeight+=THREE.MathUtils.clamp(wanted-this.tuckWeight,-real/TUCK_EASE,real/TUCK_EASE);
    if(this.tuckWeight<.004||!this.dynamics||!this.legs.length)return;
    const clip=this.clip('rise');
    if(!clip)return;
    if(!this.legMask){this.legMask=new Set<THREE.Object3D>();for(const leg of this.legs)leg.hip.traverse(node=>this.legMask!.add(node));}
    const at=clip.duration*TUCK_AT,w=this.tuckWeight*this.tuckWeight*(3-2*this.tuckWeight);
    for(const track of this.samplersFor(clip)){
      if(track.property!=='quaternion'||!this.legMask.has(track.node))continue;
      _blendTarget.fromArray(track.interpolant.evaluate(at) as unknown as number[]);
      track.node.quaternion.slerp(_blendTarget,w);
    }
  }
  private tuckWeight=0;
  private tatsumakiFlight(dt:number,state:PlayerState){
    if(state.fighter!=='tatsumaki'||this.isForm||!this.dynamics)return;
    const pose=(this.flight??=new TatsumakiFlight()).update(dt,this.locomotionSpeed,state.alive?state.action:'idle');
    this.secondary?.hang(1-pose.stream);
    const hips=this.joints.get('Hips');
    if(pose.weight<.002||!hips?.parent)return;
    this.model.updateMatrixWorld(true);
    const v=Math.hypot(this.velocity.x,this.velocity.z);
    const hx=v>.5?this.velocity.x/v:Math.sin(this.facing),hz=v>.5?this.velocity.z/v:Math.cos(this.facing);
    const travelSide=_flightSide.set(hz,0,-hx),heading=_flightHeading.set(hx,0,hz),side=_flightBody.set(Math.cos(this.facing),0,-Math.sin(this.facing));
    if(Math.abs(pose.bob)>1e-5){hips.getWorldPosition(_flightPoint);_flightPoint.y+=pose.bob;hips.position.copy(hips.parent.worldToLocal(_flightPoint));}
    _leanWorld.setFromAxisAngle(travelSide,pose.lean);
    if(Math.abs(pose.roll)>1e-5)_leanWorld.premultiply(_leanShare.setFromAxisAngle(heading,pose.roll));
    this.leanBone(hips,_leanWorld);
    hips.updateMatrixWorld(true);
    for(const [i,Side] of (['Left','Right']as const).entries()){
      const thigh=this.joints.get(`${Side}UpLeg`),knee=this.joints.get(`${Side}Leg`);
      if(thigh)this.leanBone(thigh,_leanWorld.setFromAxisAngle(side,pose.thigh[i]));
      if(knee)this.leanBone(knee,_leanWorld.setFromAxisAngle(side,pose.knee[i]));
      const arm=this.joints.get(`${Side}Arm`);
      if(arm&&Math.abs(pose.arms)>1e-5)this.leanBone(arm,_leanWorld.setFromAxisAngle(side,pose.arms));
    }
    if(pose.lift>1e-4){if(this.neckBone)this.leanBone(this.neckBone,_leanWorld.setFromAxisAngle(travelSide,-pose.lift*.4));if(this.headBone)this.leanBone(this.headBone,_leanWorld.setFromAxisAngle(travelSide,-pose.lift*.6));}
  }
  private flight?:TatsumakiFlight;
  private culled:{mesh:THREE.SkinnedMesh;sphere:THREE.Sphere;anchor:THREE.Object3D;radius:number}[]=[];
  private contactShadow!:THREE.Mesh<THREE.CircleGeometry,THREE.MeshBasicMaterial>;
  private zoroHeld?:THREE.Object3D[];
  unseen=false;
  private wasUnseen=false;
  private wake(){
    this.wasUnseen=false;
    this.secondary?.reset();
    for(const leg of this.legs)leg.planted=false;
  }
  inView(frustum:THREE.Frustum,eye:THREE.Vector3){
    const p=this.group.position;
    if(p.distanceToSquared(eye)<100)return true;
    let reach=1.5;for(const entry of this.culled)reach=Math.max(reach,entry.radius);
    _viewSphere.center.set(p.x,p.y+1,p.z);_viewSphere.radius=reach*(this.group.scale.x||1)+2;
    return frustum.intersectsSphere(_viewSphere);
  }
  private cullBounds(){
    if(!this.culled.length)return;
    this.group.updateWorldMatrix(true,false);
    const unit=this.group.matrixWorld.getMaxScaleOnAxis()||1;
    let anchor:THREE.Object3D|undefined;
    for(const entry of this.culled){
      if(entry.anchor!==anchor){anchor=entry.anchor;anchor.getWorldPosition(_cullCentre);}
      entry.mesh.updateWorldMatrix(true,false);
      const matrix=entry.mesh.matrixWorld;
      entry.sphere.center.copy(_cullCentre).applyMatrix4(_cullInverse.copy(matrix).invert());
      entry.sphere.radius=entry.radius*unit/(matrix.getMaxScaleOnAxis()||1);
    }
  }
  private lowestSupport(){
    let lowest=Infinity;const p=this.fallback;
    for(const {mesh,index}of this.supportVertices)lowest=Math.min(lowest,mesh.getVertexPosition(index,p).applyMatrix4(mesh.matrixWorld).y);
    return lowest;
  }
  private supportTransition(dt:number,state:PlayerState,real=dt){
    if(!this.pelvis||!this.pelvis.parent||!this.dynamics||this.isForm)return;
    this.group.updateMatrixWorld(true);
    const p=this.fallback,lowest=this.lowestSupport();
    if(!Number.isFinite(lowest))return;
    if(this.authoredHover(state)){this.support=0;this.soleGap=lowest-this.groundY;return;}
    const slack=this.groundY+.006-lowest;
    const rising=state.action==='getup'&&this.standingRise;
    const eligible=state.grounded&&state.alive&&!this.ragdoll&&(!REACTION_ACTIONS.has(state.action)||rising);
    const standing=(STANCE_ACTIONS.has(state.action)||rising)&&this.strideWeight<.02;
    if(dt>0)this.strideFloor=Math.min(lowest,this.strideFloor+STRIDE_FLOOR_RELAX*dt);
    const floating=this.strideWeight>.5&&eligible?Math.max(-.4,Math.min(0,this.groundY+.006-this.strideFloor)):0;
    if(this.thrown(state)){
      const under=Math.max(slack+this.bounceDrawn,this.clipUnder);
      const fresh=state.action==='launched'&&state.actionTime*state.actionDuration<FLOOR_GUARD_FRESH.within;
      if(real>0)this.support=under>this.support?Math.min(under,FLOOR_GUARD,this.support+(fresh?FLOOR_GUARD_FRESH.rate:FLOOR_GUARD_RATE)*real):Math.max(Math.max(0,under),this.support-FLOOR_GUARD_LET_GO*(state.grounded?1:3)*real);
      this.soleGap=lowest+this.support-this.groundY;
      if(Math.abs(this.support)<1e-4)return;
      this.pelvis.getWorldPosition(p);p.y+=this.support;this.pelvis.position.copy(this.pelvis.parent.worldToLocal(p));
      this.pelvis.updateMatrix();
      this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
      return;
    }
    const wanted=!eligible?0:slack>0?Math.min(slack,.25):slack>-.4&&standing?slack:floating;
    const upRate=this.sinceGrounded<LAND_RISE?4:.6;
    if(dt>0)this.support+=THREE.MathUtils.clamp((wanted-this.support)*(1-Math.exp(-dt*(this.sinceGrounded<LAND_RISE?40:22))),-.6*dt,upRate*dt);
    this.soleGap=lowest+this.support-this.groundY;
    if(Math.abs(this.support)<1e-4)return;
    this.pelvis.getWorldPosition(p);p.y+=this.support;this.pelvis.position.copy(this.pelvis.parent.worldToLocal(p));
    this.pelvis.updateMatrix();
    this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
  }
  private stagger(clip:THREE.AnimationClip,elapsed:number){return this.recoilClock(clip,elapsed)/clip.duration;}
  private recoilClock(clip:THREE.AnimationClip,elapsed:number){
    const weight=THREE.MathUtils.clamp(this.hitDamage/80,.6,1.6);
    const peak=Math.min(REACTION_PEAK,clip.duration*.3);
    const hold=REACTION_HOLD*weight;
    if(elapsed<=REACT_IN){const u=1-Math.max(0,elapsed)/REACT_IN;return peak*(1-u*u*u);}
    const rate=DZ_TAKE_CLIPS.has(clip.name)?TAKE_RELEASE:1/weight;
    return elapsed<=REACT_IN+hold?peak:Math.min(clip.duration,peak+(elapsed-REACT_IN-hold)*rate);
  }

  private stepAirClock(state:PlayerState,real:number){
    this.airStep=0;
    if(state.action!=='launched'&&!(state.action==='knockdown'&&!state.grounded)){this.airClock=0;this.airTurn=0;return;}
    if(state.grounded)return;
    this.airStep=state.timeStopped?0:real;
    this.airClock+=this.airStep;
  }
  private reactionSince(elapsed:number){
    if(this.reelHolding)return elapsed;
    const blow=this.reactTime+this.reactAhead-this.blowAt;
    return blow>=0&&blow<=elapsed+REACTION_LEAD?Math.max(elapsed,blow):elapsed;
  }
  private reaction(state:PlayerState){
    this.takeOn=undefined;
    const elapsed=state.actionTime*state.actionDuration;
    const since=this.reactionSince(elapsed);
    this.lastSince=since;
    if(state.action==='flinch'||state.action==='stun'||state.action==='splat'){
      const clip=(DREAM_IMPACT&&Fighter.dreamTakes&&state.action==='flinch'?this.clip('dream flinch'):undefined)??this.clip(`reaction ${state.action}`);
      if(clip)return {clip,phase:'struck-'+state.action,progress:this.stagger(clip,since)};
    }
    if(state.action==='defeated'){
      const fall=this.clip('reaction defeated');
      if(fall&&elapsed<fall.duration)
        return {clip:fall,phase:'dying',progress:THREE.MathUtils.clamp(elapsed/fall.duration,0,.999)};
      const floor=this.clip('reaction downed');
      if(floor)return {clip:floor,phase:'dead',progress:0};
      if(fall)return {clip:fall,phase:'dead',progress:.999};
    }
    if(state.action==='getup'&&this.standingRise&&STANDING_RISE.has(state.fighter)){
      const stance=this.idleRig?.stance()??this.clip('rest');
      if(stance)return {clip:stance,phase:'getup-standing',progress:THREE.MathUtils.clamp(elapsed/stance.duration,0,.999)};
    }
    if(state.action==='getup'){
      const clip=this.clip('reaction getup');
      if(clip&&state.actionDuration>0)return {clip,phase:'getup',progress:Math.min(.999,clipAtMotion(clipMotionTable(clip),THREE.MathUtils.clamp(elapsed/state.actionDuration,0,1)))};
    }
    if(state.action!=='hurt'&&state.action!=='launched'&&state.action!=='knockdown')return;
    const abdomenNow=this.hitByTouch&&!!this.active&&this.active.getClip().name==='heavy-abdomen-fold';
    const taken=DREAM_IMPACT&&state.action==='hurt'&&!!this.hurtTake&&this.hitStyle!=='beam'&&!!this.clip(this.hurtTake);
    if(!taken&&(abdomenNow||this.hitStyle==='melee'&&!this.hitBehind&&(this.hitHeight<FOLD_LOW||(this.hitSlot==='heavy'&&this.hitContactIndex===2)))){
      const abdomen=this.clip('abdomen');
      if(abdomen&&(state.action==='hurt'&&state.grounded||state.action==='launched'&&this.airClock<abdomen.duration))
        return {clip:abdomen,phase:'abdomen-fold',progress:THREE.MathUtils.clamp((since+.025)/abdomen.duration,0,1)};
    }
    const falling=state.action==='knockdown'&&!state.grounded&&this.airClock>0;
    const knockback=state.action==='launched'||falling||this.hitSlot==='ultimate'?this.clip('knockback'):undefined;
    if(knockback){
      if(!state.grounded){
        const played=this.airClock/knockback.duration;
        const spread=this.isForm?undefined:FLIGHT_SPREAD[state.fighter];
        if(spread&&knockback.name==='ultimate-knockback-air'){
          if(played<=spread[0])return {clip:knockback,phase:'knockback-air',progress:played};
          if(this.airStep>0)this.airTurn=Math.min(1,this.airTurn+Math.min((1-this.airTurn)*this.airStep/Math.max(this.airStep,this.timeToGround(state)),
            FLIGHT_RATE*this.airStep/((spread[1]-spread[0])*knockback.duration)));
          return {clip:knockback,phase:'knockback-air',progress:THREE.MathUtils.lerp(spread[0],spread[1],this.airTurn)};
        }
        if(played<=1)return {clip:knockback,phase:'knockback-air',progress:played};
        const spin=this.clip('spin');
        if(spin&&spin!==knockback){
          if(this.airStep>0)this.airTurn=Math.min(1,this.airTurn+(1-this.airTurn)*this.airStep/Math.max(this.airStep,this.timeToGround(state)));
          const sourceSeconds=THREE.MathUtils.lerp(16/24,2/24,this.airTurn);
          return {clip:spin,phase:'tumble',progress:sourceSeconds/spin.duration};
        }
        const progress=AIR_LOOP[0]+(AIR_LOOP[1]-AIR_LOOP[0])*(1-Math.abs(((played-1)/AIR_LOOP[2])%2-1));
        return {clip:knockback,phase:'knockback-air',progress};
      }
      const groundImpact=this.clip('ground impact');
      if(groundImpact&&this.reactionClock>.1){
        this.landingStarted??=elapsed;
        this.landingDuration??=Math.min(groundImpact.duration,Math.max(.08,state.actionDuration-elapsed));
        return {clip:groundImpact,phase:'knockdown-recovery',progress:THREE.MathUtils.clamp((elapsed-this.landingStarted)/this.landingDuration,0,1)};
      }
    }
    if(state.action==='knockdown'&&state.grounded){
      const floor=this.clip('reaction knockdown');
      if(floor)return {clip:floor,phase:'downed',
        progress:THREE.MathUtils.clamp(elapsed/Math.max(.35,floor.duration),0,.999)};
    }
    if(this.hitSlot==='ultimate'&&this.reactionClock>.45){
      if(state.grounded)this.landingStarted??=elapsed;
      const groundImpact=this.clip('ground impact');
      if(groundImpact&&this.landingStarted!==undefined){
        return {clip:groundImpact,phase:'ground-impact',progress:THREE.MathUtils.clamp((elapsed-this.landingStarted)/groundImpact.duration,0,1)};
      }
      const landing=this.clip('fall');
      if(landing){
        const progress=this.landingStarted===undefined?.35:.5+.5*THREE.MathUtils.clamp((elapsed-this.landingStarted)/.15,0,1);
        return {clip:landing,phase:'landing',progress};
      }
    }
    if(this.hitBehind&&state.action==='hurt'&&this.hitStyle!=='beam'){
      const stagger=this.clip('stagger');
      if(stagger)return {clip:stagger,phase:'struck-behind',progress:this.stagger(stagger,since)};
    }
    const own=this.clip('hit');
    if(!own)return;
    const take=DREAM_IMPACT&&state.action==='hurt'&&this.hurtTake&&this.hitStyle!=='beam'?this.clip(this.hurtTake):undefined;
    const clip=take??own;
    if(take)this.takeOn=this.hurtTake as keyof typeof DREAM_HURTS;
    if(this.hitStyle==='beam'){
      const pressure=this.clip('pressure');
      if(pressure){
        const release=Math.max(.1,state.actionDuration-.18);
        let sourceSeconds:number;
        if(!state.grounded){
          sourceSeconds=Math.min(.25,elapsed);
        }else{
          this.landingStarted??=elapsed;
          const recoveryStart=Math.max(release,this.landingStarted);
          if(elapsed<recoveryStart){
            const brace=THREE.MathUtils.clamp((elapsed-this.landingStarted)/Math.max(.001,recoveryStart-this.landingStarted),0,1);
            sourceSeconds=THREE.MathUtils.lerp(.25,.94,brace);
          }else{
            const recover=THREE.MathUtils.clamp((elapsed-recoveryStart)/Math.max(.001,state.actionDuration-recoveryStart),0,1);
            sourceSeconds=THREE.MathUtils.lerp(.94,1.12,recover);
          }
        }
        return {clip:pressure,phase:'beam-pressure',progress:sourceSeconds/pressure.duration};
      }
      const release=Math.max(.1,state.actionDuration-.18);
      const sourceFrame=elapsed<.075?4*THREE.MathUtils.clamp(elapsed/.075,0,1)
        :elapsed<release?4+Math.sin((elapsed-.075)*24)*.45
        :THREE.MathUtils.lerp(4,21,THREE.MathUtils.clamp((elapsed-release)/.18,0,1));
      return {clip,phase:'beam-strain',progress:sourceFrame/21};
    }
    const seconds=this.recoilClock(clip,since);
    if(state.actionDuration>=ROCKED_HURT){
      const reel=Math.min(ROCKED_REEL,clip.duration*.7);
      if(since<reel)return {clip,phase:'rocked',progress:Math.min(.999,seconds/clip.duration)};
      const daze=this.clip('daze');
      if(daze&&daze!==clip)return {clip:daze,phase:'rocked-daze',progress:THREE.MathUtils.clamp((since-reel)/daze.duration,0,.999)};
    }
    return {clip,phase:take?'recoil-'+this.hurtTake:'recoil',progress:Math.min(.999,seconds/clip.duration)};
  }
  update(dt:number,state:PlayerState,interpolated=false,real=dt){
    if(DREAM_IMPACT)state=this.reeling(state,real);
    this.swap=Fighter.transplant?.(this,state);
    if(state.fighter==='zoro'){if(!this.zoroHeld){const held:THREE.Object3D[]=[];this.model.traverse(o=>{if(/Original_BVO_(left|mouth)/.test(o.name))held.push(o);});this.zoroHeld=held;}const lion=state.action==='heavy'&&this.slotClip(state,['Lions Song']);for(const o of this.zoroHeld)o.visible=!lion;}
    if(this.awakenOn.length||this.awakenOff.length){
      const transformed=(this.swapped(state)&&state.fighter!=='ace')||!!this.outfit?.variant?.ssjHair;
      for(const mesh of this.awakenOn)mesh.visible=transformed;
      for(const mesh of this.awakenOff)mesh.visible=!transformed;
    }
    if(this.awakenTuck.length){const tuck=this.swapped(state)||this.outfit?.variant?.ssjHair?1:0;for(const t of this.awakenTuck)t.weights[t.index]=tuck;}
    if(this.heldWeapons.length){const away=['heavy','special','ultimate'].includes(state.action)&&this.slotClip(state);for(const weapon of this.heldWeapons)weapon.visible=!away;}
    if(this.lawSheath.length){const gamma=state.action==='special'&&this.slotClip(state,['Gamma Knife'])||state.action==='ultimate';for(const sheath of this.lawSheath)sheath.visible=!gamma;}
    if(this.laughFace){const laugh=state.action==='awaken'||(state.action==='ultimate'&&!state.awakened&&state.actionTime*state.actionDuration<BAJRANG_TAKE.laugh);this.laughFace.visible=laugh;if(this.plainFace)this.plainFace.visible=!laugh;}
    if(this.openHands.length){
      const palms=state.action==='heavy'&&!Fighter.ender(state)&&state.grounded&&!this.swap;
      const grab=state.action==='ultimate'&&!this.swap&&bajrangGrab(state,this.moveFor(state).contacts[0]).open;
      for(let i=0;i<this.openHands.length;i++){const open=palms||grab&&this.openSides[i]==='R';this.openHands[i].visible=open;this.fists[i].visible=!open;}
    }
    this.state=state;const actionSeconds=state.actionTime*state.actionDuration;this.haki.value=state.fighter==='luffy'&&state.action==='special'&&!Fighter.ender(state)&&!this.swap?THREE.MathUtils.smoothstep(actionSeconds,.1,.25)*(1-THREE.MathUtils.smoothstep(actionSeconds,state.actionDuration-.3,state.actionDuration)):0; const target=new THREE.Vector3(state.x,state.y,state.z);
    const delta=_step.set(state.x-this.previousPosition.x,state.y-this.previousPosition.y,state.z-this.previousPosition.z);
    const displacement=Math.hypot(delta.x,delta.z);
    this.previousVelocity.copy(this.velocity);
    const moved=dt>0&&displacement<2;
    this.travelled=moved?displacement:0;
    if(moved){
      this.motionPending+=real;
      if(delta.lengthSq()>1e-12){
        this.motionWindow.push({x:delta.x,y:delta.y,z:delta.z,gap:this.motionPending});
        this.motionSpan+=this.motionPending;this.motionPending=0;
        while(this.motionWindow.length>1&&this.motionSpan-this.motionWindow[0].gap>=VELOCITY_WINDOW)this.motionSpan-=this.motionWindow.shift()!.gap;
      }
      let x=0,y=0,z=0;
      for(const sample of this.motionWindow){x+=sample.x;y+=sample.y;z+=sample.z;}
      const span=this.motionSpan+Math.max(0,this.motionPending-this.motionSpan/Math.max(1,this.motionWindow.length));
      this.velocity.set(x/span,y/span,z/span);
    }else{this.motionWindow.length=0;this.motionSpan=0;this.motionPending=0;this.velocity.set(0,0,0);}
    if(this.carriedVelocity){this.velocity.copy(this.carriedVelocity);this.travelled=Math.hypot(this.velocity.x,this.velocity.z)*real;}
    const speed=Math.hypot(this.velocity.x,this.velocity.z);
    this.locomotionSpeed=THREE.MathUtils.lerp(this.locomotionSpeed,speed,1-Math.exp(-dt*24));
    this.walking=this.locomotionSpeed<(this.walking?3.6:2.8);
    if(state.grounded&&!this.wasGrounded&&!REACTION_ACTIONS.has(state.action)){
      const impact=Math.max(0,-this.fallSpeed);
      this.landPeak=impact>LAND_FLOOR?THREE.MathUtils.clamp((impact-LAND_FLOOR)*LAND_PER_SPEED,LAND_RANGE[0],LAND_RANGE[1]):0;
      this.landAge=0;this.landHeld=this.landPeak>0;
    }
    if(!state.grounded){this.landHeld=false;this.landPeak=0;}
    this.sinceGrounded=state.grounded?this.sinceGrounded+real:0;
    if(this.landHeld){
      if(this.landAge>0||this.soleGap<.02)this.landAge+=dt;
      if(this.landAge>=LAND_RISE)this.landHeld=false;
    }
    this.landDip=this.landPeak*(this.landHeld
      ?THREE.MathUtils.smoothstep(this.landAge,0,LAND_FALL)*(1-THREE.MathUtils.smoothstep(this.landAge,LAND_FALL,LAND_RISE)):0);
    this.fallSpeed=moved?delta.y/dt:0;
    this.wasGrounded=state.grounded;
    this.previousPosition.copy(target);
    if(state.action==='jump'){
      if(this.previousAction!=='jump'){this.jumpAge=0;this.falling=false;}
      else{
        this.jumpAge+=dt;
        const arc=jumpArc(state.fighter),blind=this.isForm&&!this.carriedVelocity;
        if(!this.falling&&(blind?this.jumpAge>arc.rise+.08:this.velocity.y<-.25)&&this.fallClip()){
          this.falling=true;this.fallAt=this.jumpAge;this.fallFrom=this.isForm?Math.max(.08,arc.air-this.jumpAge):Math.max(.08,this.timeToGround(state));}
      }
    }else{this.jumpAge=0;this.falling=false;}
    if(state.grounded||!this.started)this.groundY=state.y;
    this.group.position.sub(this.shakeDrawn);this.shakeDrawn.set(0,0,0);
    const placed=!this.started||this.group.position.distanceToSquared(target)>100;
    if(placed)this.push.set(0,0,0);
    if(this.ragdoll){ }
    else if(interpolated||placed){this.group.position.copy(target).add(this.push);this.started=true;}
    else this.group.position.sub(this.pushDrawn).lerp(target,1-Math.exp(-dt*19)).add(this.push);
    if(!this.ragdoll)this.pushDrawn.copy(this.push);
    if(!this.ragdoll){
      if(this.lastWorldAt>0&&real>0)this.deathVelocity.copy(this.group.position).sub(this.lastWorld).divideScalar(real);
      this.lastWorld.copy(this.group.position);this.lastWorldAt=1;
    }
    if(!this.ragdoll&&this.bigHolding(state)){const k=(Math.floor(performance.now()*.03)&1?1:-1)*BIG_SHAKE;this.shakeDrawn.set(this.bigHx*k,0,this.bigHz*k);this.group.position.add(this.shakeDrawn);}
    else if(DREAM_IMPACT&&!this.ragdoll&&!!state.hitstop&&this.shakeLeft>0&&this.shakeTotal-this.shakeLeft>=HIT_SHAKE_DELAY){const live=this.shakeTotal-HIT_SHAKE_DELAY,k=(Math.floor((this.shakeTotal-this.shakeLeft-HIT_SHAKE_DELAY)*30)&1?-1:1)*this.shakeSize*Math.min(1,this.shakeLeft/live);this.shakeDrawn.set(this.shakeHx*k,0,this.shakeHz*k);this.group.position.add(this.shakeDrawn);}
    {const spin=DREAM_IMPACT&&state.action==='hurt'&&state.grounded?this.takeOn:undefined,want=spin==='dream spin L'?TAKE_TURN.most:spin==='dream spin R'?-TAKE_TURN.most:0;
      this.takeTurn+=(want-this.takeTurn)*(1-Math.exp(-real*(Math.abs(want)>Math.abs(this.takeTurn)?TAKE_TURN.in:TAKE_TURN.out)));
      if(Math.abs(this.takeTurn)<1e-4&&!want)this.takeTurn=0;}
    const diff=Math.atan2(Math.sin(state.yaw+this.takeTurn-this.group.rotation.y),Math.cos(state.yaw+this.takeTurn-this.group.rotation.y));
    const snapping=ROOT_CLAMPED.includes(state.action)||REACTION_ACTIONS.has(state.action);
    const maxRate=snapping?28:state.grounded?22:18;
    const eased=placed?undefined:this.attackTurn(state,diff,real);
    const step=placed?diff:eased!==undefined?eased:interpolated?THREE.MathUtils.clamp(diff,-maxRate*real,maxRate*real):diff*(1-Math.exp(-dt*22));
    this.group.rotation.y+=step;
    this.turnRate=real>0?step/real:0;
    const visualYaw=this.group.rotation.y;
    const finite=['light','heavy','special','ultimate','awaken','hurt','flinch','launched','knockdown','getup','stun','dash','defeated'].includes(state.action);
    this.stepAirClock(state,real);
    this.reactAhead=state.timeStopped||this.bigHolding(state)?0:real;
    if(state.action==='getup'&&this.previousAction!=='getup')this.standingRise=this.previousAction==='stun'&&state.grounded;
    const recoil=this.reaction(state);
    const drawn=this.stepMoveClock(state,real,finite,!!recoil);
    const melee=this.swap?undefined:this.groundedMelee(drawn);
    const combo=!melee&&!this.swap&&state.action==='heavy'&&isGoku(state)&&!Fighter.ender(state)?Math.min(2,Math.floor(drawn.actionTime*3)):-1;
    const phase=recoil?'-'+recoil.phase:melee?'-'+melee.phase:combo>=0?'-'+combo
      :this.swap?this.swap.phase:state.action==='ultimate'&&state.confirmedAt!==undefined&&(ULTIMATE_CLIPS[state.fighter]?.formOnly?this.ultimatePlan(state.fighter)?.formOpener:ULTIMATE_CLIPS[state.fighter]?.opener)?'-cine':'';
    const attackSeq=ATTACK_SLOTS.has(state.action)?state.actionSeq:undefined,stage=this.rushStage(state);
    if(finite){
      if(state.action!==this.previousAction||phase!==this.previousPhase
        ||state.actionTime<this.lastProgress-.25
        ||(state.actionStarted>this.lastStarted+1e-6&&(state.actionTime<.1||REACTION_ACTIONS.has(state.action)))
        ||attackSeq!==undefined&&this.lastSeq!==undefined&&attackSeq!==this.lastSeq
        ||stage!==this.lastStage)this.actionEpoch++;
      this.lastStarted=state.actionStarted;this.lastProgress=state.actionTime;
    }
    this.lastSeq=attackSeq;this.lastStage=stage;
    this.previousPhase=phase;
    this.reactionClock+=state.timeStopped||state.hitstop?0:real;
    this.idleRig?.step(state.timeStopped||state.hitstop?0:real,state.action,state.grounded,state.alive,this.locomotionSpeed,this.targetDistance);
    if(state.action!=='victory')this.victoryHeld=false;
    else if(!this.victoryHeld&&this.active?.getClip().name===VICTORY_ENTRY&&this.active.time>=this.active.getClip().duration-1e-3)this.victoryHeld=true;
    const key=state.action+(finite?this.actionEpoch:'')+(this.victoryHeld?'-held':'')+phase+(state.action==='run'&&this.walking&&this.walkClip&&!this.blended?'-walk':'')+(state.action==='jump'&&this.falling?'-fall':'')+(state.action==='idle'?this.idleRig?.key??'':'');
    if(key!==this.actionKey){
      const stanceSwitch=state.action==='idle'&&this.previousAction==='idle'&&key.endsWith('-ready')!==this.actionKey.endsWith('-ready');
      this.actionKey=key;this.struck=false;let clip=recoil?.clip??melee?.clip??this.clipFor(state);if(combo>=0){clip=this.clip(combo===2?'adapted heavy':'adapted light')??clip;}
      if(clip){
        const reacting=REACTION_ACTIONS.has(state.action);
        const again=reacting&&this.started&&this.transitioning&&this.blendKind==='struck'&&clip===this.active?.getClip()&&this.blendedEpoch===this.reactionEpoch;
        const struck=reacting&&(this.blendedEpoch!==this.reactionEpoch||again);
        const opensAt=finite&&ATTACK_SLOTS.has(state.action)&&!recoil&&!melee&&combo<0?(this.contactCurve(this.swap?this.swap.paced({...state,actionTime:0}):{...state,actionTime:0},clip)??0)*clip.duration:0;
        let duration=reacting?struck?(this.bigSnap?BIG_SNAP:STRUCK_BLEND):THREE.MathUtils.clamp(this.poseDistance(clip)*.2,REACT_PHASE[0],REACT_PHASE[1])
          :melee?Math.max(0,Math.min(.11,melee.contact-melee.elapsed-.035)):state.action==='idle'?.24:state.action==='guard'?.08:.11;
        if(struck&&!this.bigSnap&&state.action==='launched'&&this.posed){this.poseDistance(clip);duration=Math.max(duration,Math.min(LAUNCH_ENTRY_MAX,this.poseGapMax*1.5/(ENTRY_STEP*60)));}
        if(reacting)this.blendedEpoch=this.reactionEpoch;
        if(struck)this.bigSnap=false;
        if(this.posed&&!reacting&&!melee){
          duration*=THREE.MathUtils.clamp(this.poseDistance(clip,opensAt)/.34,.5,1.5);
          if(finite&&ATTACK_SLOTS.has(state.action))duration=Math.max(duration,Math.min(ENTRY_MAX,this.poseGapMax*1.5/(ENTRY_STEP*60)));
          if(state.action==='dash')duration=Math.max(duration,Math.min(DASH_ENTRY[1],this.poseGapMax*1.5/(ENTRY_STEP*60)),DASH_ENTRY[0]);
        }
        if(!reacting&&state.actionDuration>0)duration=Math.min(duration,state.actionDuration*(state.action==='dash'?DASH_ENTRY_SHARE:.2));
        if(!struck&&duration>0)duration=Math.max(duration,Math.min(.1,2.5*real));
        if(stanceSwitch)duration=READY_BLEND;
        const carried=this.rootClamped&&!struck?_rootLead.subVectors(this.rootDrawnLast,this.rootReference).length()*(this.group.getWorldScale(_rootShift).x||1):0;
        const rootDuration=struck?Math.max(duration,STRUCK_ROOT):Math.max(duration,Math.min(ROOT_RETURN_MAX,1.5*carried/ROOT_RETURN_RATE));
        this.startPoseBlend(this.started?duration:0,this.started?rootDuration:0,
          struck?'struck':reacting?'reaction':ATTACK_SLOTS.has(state.action)||ATTACK_SLOTS.has(this.previousAction)?'attack'
            :REACTION_ACTIONS.has(this.previousAction)?'reaction':'motion');
        this.posed=true;
        this.restoreSampledPose();
        this.mixer.stopAllAction();
        const next=this.mixer.clipAction(clip).reset().setEffectiveWeight(1).play();
        const once=finite||clip.name===VICTORY_ENTRY;
        next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;next.timeScale=finite?0:1;
        if(clip===this.runClip)next.time=this.gaitTime(clip,'run');
        if(clip===this.idleClip&&this.tailWeight>.01)next.time=this.tailTime%clip.duration;
        this.tailWeight=0;this.tailSince=0;
        this.active=next;
      }
    }else if(this.started&&REACTION_ACTIONS.has(state.action)&&this.blendedEpoch!==this.reactionEpoch){
      this.blendedEpoch=this.reactionEpoch;
      this.startPoseBlend(this.bigSnap?BIG_SNAP:STRUCK_BLEND,STRUCK_ROOT,'struck');this.bigSnap=false;
    }
    this.restoreSampledPose();
    let runSign=1,wantHip=0;
    if(state.action==='guard'&&this.locomotionSpeed>.4){
      if(Math.hypot(this.velocity.x,this.velocity.z)>1e-3)this.runBearing=Math.atan2(this.velocity.x,this.velocity.z);
      const facing=this.facing,relative=Math.atan2(Math.sin(this.runBearing-facing),Math.cos(this.runBearing-facing));
      const reversing=this.reverseBlend>.5?Math.abs(relative)>1.9:Math.abs(relative)>2.35;
      this.reverseBlend+=((reversing?1:0)-this.reverseBlend)*(1-Math.exp(-dt*11));
      const ahead=THREE.MathUtils.clamp(relative,-.95,.95);
      const behind=Math.atan2(Math.sin(relative+Math.PI),Math.cos(relative+Math.PI))*.5;
      wantHip=ahead+Math.atan2(Math.sin(behind-ahead),Math.cos(behind-ahead))*this.reverseBlend;
      if(this.reverseBlend>.5)runSign=-1;
    }else this.reverseBlend=0;
    if(!snapping)wantHip=THREE.MathUtils.clamp(wantHip+THREE.MathUtils.clamp(-this.turnRate*.05,-.42,.42),-.95,.95);
    this.hipYaw+=(wantHip-this.hipYaw)*(1-Math.exp(-dt*9));
    {
      const stride=TARGET_STRIDE*(this.legLength||.85)*(STRIDE_SCALE[this.state.fighter]??1);
      this.strideClock+=this.travelled/Math.max(.2,stride);
      const attacking=ATTACK_SLOTS.has(state.action)&&state.actionDuration>0;
      const kicking=state.fighter==='pikachu'||this.authoredKick(state)||this.authoredFloorStrike(state)||this.authoredHover(state)||this.authoredStep(state);
      const move=attacking?this.moveFor(state):undefined;
      const past=move?drawn.actionTime*drawn.actionDuration-move.contacts[move.contacts.length-1]:0;
      const walking=attacking&&(state.action==='special'||state.action==='ultimate')&&state.grounded&&!kicking&&!(Fighter.ender(state)&&move?.style==='melee');
      const want=attacking&&state.grounded&&!this.floating&&((move?.style==='melee'&&!kicking)||walking)
        ?THREE.MathUtils.clamp((this.locomotionSpeed-1.1)/2.4,0,1)*(walking?1:(1-THREE.MathUtils.smoothstep(past,0,.12)))*.62:0;
      this.stride=kicking?0:this.stride+(want-this.stride)*(1-Math.exp(-dt*(want>this.stride?16:9)));
    }
    if(this.active&&state.action==='run'&&(this.floating||this.authoredHover(state))){
      this.active.timeScale=1;
      if(this.authoredHover(state))this.gaitBlend=THREE.MathUtils.lerp(this.gaitBlend,
        THREE.MathUtils.smoothstep(this.locomotionSpeed,GAIT_RANGE[0],GAIT_RANGE[1]),1-Math.exp(-dt*9));
    }
    if(this.active&&state.action==='run'&&!this.floating&&!this.authoredHover(state)){
      const stride=TARGET_STRIDE*(this.legLength||.85)*(STRIDE_SCALE[this.state.fighter]??1);
      const speed=Math.max(.5,this.locomotionSpeed);
      this.gaitBlend=this.blended?THREE.MathUtils.lerp(this.gaitBlend,
        THREE.MathUtils.smoothstep(this.locomotionSpeed,GAIT_RANGE[0],GAIT_RANGE[1]),1-Math.exp(-dt*9)):1;
      if(this.blended&&this.gaitBlend<.995){
        const step=CADENCE[this.cadenceKey]?.run?.step??this.runClip!.duration/2;
        const rate=THREE.MathUtils.clamp(step*speed/Math.max(.2,stride),step*2.2,CADENCE_RANGE[1]);
        this.gait+=runSign*rate*real/step;
        this.active.timeScale=0;
        this.active.time=this.gaitTime(this.runClip!,'run');
      }else{
        const runStep=CADENCE[this.cadenceKey]?.run?.step;
        if(runStep)this.gait=this.active.time/runStep;
        const walking=this.walking&&!!this.walkClip;
        const cadence=CADENCE[this.cadenceKey]?.[walking?'walk':'run'];
        this.active.timeScale=(cadence&&cadence.step>0&&stride>0
          ?THREE.MathUtils.clamp(cadence.step*speed/stride,CADENCE_RANGE[0],CADENCE_RANGE[1])
          :THREE.MathUtils.clamp(speed/(walking?3.2:7.5),.65,1.25)*1.05)*runSign;
      }
    }
    if(this.active&&state.action==='jump'){
      const clip=this.active.getClip();
      this.active.timeScale=0;
      if(this.falling){
        const gone=this.isForm?(this.jumpAge-this.fallAt)/this.fallFrom:1-this.timeToGround(state)/this.fallFrom;
        this.active.time=clip.duration*THREE.MathUtils.clamp(gone,0,1);
      }else{const u=Math.min(1,this.jumpAge/jumpArc(state.fighter).rise);this.active.time=clip.duration*.72*(1-(1-u)*(1-u));}
    }
    if(melee&&melee.elapsed>=melee.contact-Math.min(.035,real))this.blendDuration=0;
    const holding=this.hitFreeze>0&&this.freezeHonoured&&!recoil;
    if(this.strikeContact&&this.active&&melee&&holding)this.active.time=this.active.getClip().duration*GOKU_MELEE_CONTACTS[melee.phase].peak;
    this.strikeContact=false;
    this.hitFreeze=Math.max(0,this.hitFreeze-real);this.hitFlash=Math.max(0,this.hitFlash-real);this.freezeSeen=this.hitFreeze;
    this.shakeLeft=Math.max(0,this.shakeLeft-real);
    if(this.bigLeft>0){this.bigLeft=Math.max(0,this.bigLeft-real);if(state.hitstop)this.bigStopSeen=true;else if(this.bigStopSeen){this.bigLeft=0;this.bigStopSeen=false;}}else this.bigStopSeen=false;
    this.awaken.value=THREE.MathUtils.lerp(this.awaken.value,this.swapped(state)?1:0,1-Math.exp(-dt*(state.action==='awaken'?24:7)));
    {
      const rim=this.auraColor(),glow=this.awaken.value*(standingAura(state.fighter)??0)*.12,
        base=state.fighter==='vegeta'?.2:0;
      for(const m of this.outlineMaterials)if(m instanceof THREE.MeshToonMaterial&&!m.userData.ink)m.emissive.setRGB(base+rim.r*glow,base+rim.g*glow,base+rim.b*glow);
    }
    {
      const f=this.flashTotal>0?this.hitFlash/this.flashTotal:0,knee=this.flashBig?.7:.72;
      const amount=f>0?(this.flashBig?(DREAM_IMPACT?DREAM_FLASH.bigAmount:.9):DREAM_IMPACT?DREAM_FLASH.amount:.6)*(f>knee?1:Math.pow(f/knee,this.flashBig?1.15:1.6)):0;
      const toward=DREAM_IMPACT?Math.min(1,(1-f)*DREAM_FLASH.redden):this.flashBig?Math.min(1,(1-f)*2.2):.6+.4*(1-f),peak=DREAM_IMPACT?(this.flashBig?1.1:1):this.flashBig?1.25+.4*f:1.05,t=this.flashTint;
      this.flash.value.set(THREE.MathUtils.lerp(1,t.r,toward)*peak,THREE.MathUtils.lerp(1,t.g,toward)*peak,THREE.MathUtils.lerp(1,t.b,toward)*peak,amount);
      this.flashFlat.value=DREAM_IMPACT?this.flashBig?DREAM_FLASH.flat:DREAM_FLASH.flatLight:0;
    }
    if(this.active&&finite){let progress=recoil?.progress??melee?.progress??(combo<0?this.contactCurve(this.swap?this.swap.paced(drawn):drawn):null)??Math.min(.999,Math.max(0,drawn.actionTime));if(state.fighter==='goku'&&state.action==='special'&&!Fighter.ender(state)&&!this.swap&&!isCharacterMotion(this.active.getClip())){
        const t=drawn.actionTime*drawn.actionDuration,contact=MOVES.goku.special.contacts[0],charge=t/contact;
        const table=clipMotionTable(this.active.getClip());
        const push=Math.max(.55,1-KAME_PUSH/contact);
        const from=charge<push?.32:charge<1?.51:.68,to=charge<push?.51:charge<1?.68:.84;
        const u=THREE.MathUtils.clamp(charge<push?charge/push:charge<1?(charge-push)/(1-push):(t-contact)/(state.actionDuration-contact),0,1);
        progress=clipAtMotion(table,THREE.MathUtils.lerp(motionAt(table,from),motionAt(table,to),u));
      }
      const drive=state.action==='awaken'&&!this.isForm?AWAKEN_TAKE_DRIVE[state.fighter]:undefined;
      if(drive!==undefined&&this.active.getClip().name===AWAKEN_TAKE[state.fighter])
        progress=Math.min(.999,awakenTakeTime(drawn.actionTime*drawn.actionDuration,awakeningSwapAt(state.fighter),drive)/this.active.getClip().duration);
      if(combo>=0)progress=(progress*3)%1;
      else if(!recoil){
        if(this.drawnEpoch!==this.actionEpoch){this.drawnEpoch=this.actionEpoch;this.drawnProgress=0;}
        progress=Math.max(progress,this.drawnProgress);this.drawnProgress=progress;
      }
      if(state.action==='dash'&&drawn.actionDuration>0){const clip=this.active.getClip(),end=Math.min(clip.duration,this.isForm?clip.duration:DASH_CLIP_END[state.fighter]??clip.duration);progress=Math.min(progress,.999*Math.min(end/clip.duration,drawn.actionTime*DASH_RATE*drawn.actionDuration/clip.duration));}
      if(state.action==='dash'&&state.dashKind==='back')progress=1-progress;
      const segment=this.segmentOf(state);
      this.active.time=segment?segment.from+(segment.to-segment.from)*progress:this.active.getClip().duration*progress;}
    this.secondary?.unswing();
    this.mixer.update(state.timeStopped||state.hitstop?0:real);
    if(this.active){
      const clip=this.active.getClip(),time=this.active.time;
      if(this.active===this.loopAction&&/run|walk|dash/i.test(clip.name)&&time<this.loopTime-clip.duration*.5&&!this.transitioning)this.startPoseBlend(LOOP_BLEND,LOOP_BLEND,'loop');
      this.loopAction=this.active;this.loopTime=time;
    }
    this.sampleActivePose();
    this.selectAkainuArms(drawn);this.selectJinbeHands(drawn);this.selectKizaruHands(drawn);this.selectAokijiMeshes(drawn);this.selectEscanorRhitta(drawn);this.selectEdwardBlade(drawn);this.selectPikachuFace(drawn);this.selectMightGuyBody(drawn);
    this.settleTail(state.timeStopped||state.hitstop?0:real,drawn);
    this.guardStride(state.timeStopped||state.hitstop?0:real,state,runSign);
    this.airTuck(real,state);
    this.tatsumakiFlight(state.timeStopped||state.hitstop?0:real,state);
    if(this.hands&&this.active&&!this.stand&&!this.unseen&&HANDS.on)this.hands.apply(this.active.getClip(),drawn,real);
    this.applyPoseBlend(real);
    this.pinHeldEquipment();
    this.turnWheel(state.timeStopped||state.hitstop?0:real,state);
    this.limitRootMotion(drawn,dt);
    this.driveRagdoll(state,real);
    const finger=this.standHands.length>0&&state.action==='heavy'&&this.slotClip(state,['Star Finger']);for(const hand of this.standHands){const pointing=hand.name==='star-pointing-hand';hand.visible=pointing?finger:!finger;if(pointing&&hand.morphTargetInfluences){const t=state.actionTime*state.actionDuration,c=MOVES.jotaro.heavy.contacts[0],d=state.actionDuration; hand.morphTargetInfluences[0]=THREE.MathUtils.smoothstep(t,c-.01,c+.5*(d-c))*(1-THREE.MathUtils.smoothstep(t,c+.75*(d-c),d));}}
    this.previousAction=state.action;
    for(const expression of this.faceExpressions)expression.weights[expression.index]=expression.value;
    for(const hand of this.scaledHands)hand.scale.setScalar(this.handScale);
    for(const grip of this.grips)grip.bone.quaternion.copy(grip.target);
    if(!ATTACK_SLOTS.has(state.action))this.chargeWanted=0;
    this.chargeHold+=(this.chargeWanted-this.chargeHold)*(1-Math.exp(-dt*9));
    this.chargeWanted=0;
    this.group.updateMatrixWorld(true);
    if(this.unseen){this.wasUnseen=true;this.serverTime+=state.timeStopped||state.hitstop?0:dt;}
    else{
      if(this.wasUnseen)this.wake();
      this.bodyDynamics(state.timeStopped||state.hitstop?0:dt,drawn,real);
      this.holdLife(state.timeStopped||state.hitstop?0:dt,drawn,real);
      if(this.dynamics)this.idleRig?.apply(this.facing);
      this.hitReact(state.timeStopped||this.bigHolding(state)?0:real,state);
      this.impactPose(state,real);
      this.rubberLimbs(drawn,state.timeStopped?0:real);
      this.group.updateMatrixWorld(true);
      this.footPlanting(state.timeStopped||state.hitstop?0:dt,state);
      this.aimHead(state.timeStopped||state.hitstop?0:dt,state);
      this.supportTransition(state.timeStopped||state.hitstop?0:dt,state,real);
      this.group.updateMatrixWorld(true);
      this.stabilizeLegs(state.timeStopped||state.hitstop?0:real,state,placed);
      this.floorFeet(state,state.timeStopped||state.hitstop?0:real);
      for(const leg of this.legs)for(const bone of [leg.hip,leg.knee,leg.ankle]){
        let previous=this.legPresentation.get(bone);
        if(!previous){previous=new THREE.Quaternion();this.legPresentation.set(bone,previous);}
        previous.copy(bone.quaternion);
      }
      this.mouthBlade();
      this.secondary?.update(state.timeStopped||state.hitstop?0:dt);
      this.stepPoseHold(state);
    }
    this.updateSmear(state,real);
    this.contactPush(real,state);
    const shadow=this.contactShadow;
    shadow.position.y=this.groundY-state.y+.012;
    shadow.material.opacity=.3/(1+(Math.max(0,state.y-this.groundY)+this.formLift)*.7);
    const forward=_handForward.set(Math.sin(visualYaw),0,Math.cos(visualYaw));
    this.fallback.copy(this.group.position).addScaledVector(forward,.55).addScaledVector(UP,1.15);
    if(this.rightBone)this.rightBone.getWorldPosition(this.handR);else this.handR.copy(this.fallback);
    if(this.leftBone)this.leftBone.getWorldPosition(this.handL);else this.handL.copy(this.fallback);
    {const hands=FIGHTER_SOCKETS[state.fighter]?.hands;if(hands){for(const [side,hand]of [['right',this.handR],['left',this.handL]]as const){const knuckle=this.bones.get(side+hands.toward);if(knuckle)hand.lerp(knuckle.getWorldPosition(this.fallback),hands.by);}}}
    if(this.gear4){
      const elapsed=state.actionTime*state.actionDuration;
      const transformed=this.swapped(state);
      const worn=AWAKENINGS[state.fighter].formTint!==undefined;
      const hitConfirm=!!MOVES[state.fighter].ultimate.confirm;
      const fromStart=state.fighter==='luffy'?elapsed>=BAJRANG_TAKE.swap:hitConfirm?state.confirmedAt!==undefined:elapsed>=.48;
      const until=state.fighter==='luffy'?bajrangOut(state,WHIFF_RECOVERY):state.actionDuration-.23;
      let show=transformed||(state.fighter!=='naruto'&&!OWN_BODY_ULTIMATE.has(state.fighter)&&!worn&&!state.awakened&&state.action==='ultimate'&&!this.swap
        &&fromStart&&elapsed<until);
      this.model.visible=!show||worn;this.gear4.group.visible=show;
      if(!show)this.formLift=this.floatOffset=0;
      if(state.fighter==='naruto'){
        if(this.cameraPoint)this.formEye.value.copy(this.cameraPoint);
        const swap=awakeningSwapAt(state.fighter);
        const goal=state.awakened?(state.action==='awaken'?THREE.MathUtils.smoothstep(elapsed,swap,Math.min(AWAKENING_ENTRY,swap+.4)):1):0;
        this.formReveal+=THREE.MathUtils.clamp(goal-this.formReveal,-real*6,real*6);
        if(!state.awakened&&ATTACK_SLOTS.has(state.action))this.formReveal=0;
        show=this.formReveal>.001;this.gear4.group.visible=show;this.model.visible=this.formReveal<.999;
        this.formOpacity.value=1-this.formReveal;this.gear4.formOpacity.value=this.formReveal;
        for(const material of this.outlineMaterials)material.opacity=1-this.formReveal;
        for(const material of this.gear4.outlineMaterials)material.opacity=this.formReveal;
      }
      if(show){
        this.gear4.targetDistance=this.targetDistance;this.gear4.cameraPoint=this.cameraPoint;
        this.gear4.carriedVelocity=(this.gear4.carriedVelocity??new THREE.Vector3()).copy(this.velocity).divideScalar(this.gear4.group.scale.x);
        this.gear4.unseen=this.unseen;
        this.gear4.update(dt,{...state,x:0,y:this.gear4.floating?this.floatOffset:0,z:AWAKENINGS[state.fighter].formForward??0,yaw:0},true,real);
        this.gear4.contactShadow.visible=false;
        if(!worn){
          const y=this.gear4.group.position.y;
          if(this.gear4.floating)this.floatForm(dt,real,state,elapsed);
          else if(state.grounded&&!REACTION_ACTIONS.has(state.action)){
            this.gear4.group.updateMatrixWorld(true);
            const lowest=this.gear4.lowestSupport();
            if(Number.isFinite(lowest)&&dt>0){
              const sink=this.group.position.y-lowest;
              this.formSink=Math.min(this.formSink+dt*.5,sink);
              this.formFloat=Math.min(this.formFloat+dt*.5,-sink);
              const standing=STANCE_ACTIONS.has(state.action)&&this.gear4.strideWeight<.02;
              const delta=this.formSink>0?Math.min(this.formSink,.25):standing&&this.formFloat>0?-Math.min(this.formFloat,.25):0;
              const target=THREE.MathUtils.clamp(y+delta,-this.formHover-.9,-this.formHover+.4);
              this.gear4.group.position.y+=THREE.MathUtils.clamp((target-y)*(1-Math.exp(-dt*22)),-.6*dt,.6*dt);
            }
          }else if(dt>0){
            this.formSink=this.formFloat=Infinity;
            let rest=-this.formHover;
            if(this.thrown(state)){
              this.gear4.group.updateMatrixWorld(true);
              const lowest=this.gear4.lowestSupport();
              if(Number.isFinite(lowest))rest+=THREE.MathUtils.clamp(this.groundY+.006-(lowest-(y-rest)),0,FLOOR_GUARD);
            }
            this.gear4.group.position.y+=rest>y?Math.min(rest-y,FLOOR_GUARD_RATE*dt):(rest-y)*(1-Math.exp(-dt*6));
          }
        }
        if(!worn&&(FIGHTER_SOCKETS[state.fighter]?.formHands!=='awakened'||state.awakened)){this.handR.copy(this.gear4.handR);this.handL.copy(this.gear4.handL);}
        if(worn&&this.formMaterials.length){
          const base=AWAKENINGS[state.fighter].formOpacity??.6;
          const reach=AWAKENINGS[state.fighter].formScale??1;
          if(state.action==='awaken')this.risenAt=this.serverTime;
          const rising=(state.fighter==='itachi'||state.fighter==='madara')&&this.serverTime-this.risenAt<2;
          const near=this.cameraPoint?THREE.MathUtils.smoothstep(this.cameraPoint.distanceTo(this.group.position),rising?.8:.75*reach,rising?2.2:1.6*reach):1;
          for(const material of this.formMaterials)(material as THREE.MeshToonMaterial).opacity=base*near;
          this.gear4.group.visible=near>.08;
        }
      }
    }
    this.cullBounds();
  }

  private wheel?:{bone:THREE.Bone;rest:THREE.Quaternion;turn:number;goal:number;was:string}|null;
  private turnWheel(step:number,state:PlayerState){
    if(this.wheel===undefined){
      const bone=this.model.getObjectByName('Wheel') as THREE.Bone|undefined,rest=(this.source.scene.getObjectByName('Wheel') as THREE.Bone|undefined)?.quaternion;
      this.wheel=bone&&rest?{bone,rest:rest.clone(),turn:0,goal:0,was:state.action}:null;
    }
    const wheel=this.wheel;
    if(!wheel)return;
    if(WHEEL_HITS.has(state.action)&&!WHEEL_HITS.has(wheel.was))wheel.goal+=Math.PI/4;
    wheel.was=state.action;
    wheel.turn+=(wheel.goal-wheel.turn)*(step>0?1-Math.exp(-step/(WHEEL_NOTCH/3)):0);
    const bone=wheel.bone;
    bone.quaternion.copy(wheel.rest).multiply(_wheelSpin.setFromAxisAngle(_wheelAxis.set(0,1,0),wheel.turn));
    bone.updateMatrixWorld(true);
    const goal=_wheelTip.identity();
    if(this.cameraPoint){
      bone.getWorldPosition(_wheelCentre);
      _wheelAxis.set(0,1,0).applyQuaternion(bone.getWorldQuaternion(_wheelParent)).normalize();
      _wheelEye.copy(this.cameraPoint).sub(_wheelCentre).normalize();
      if(_wheelAxis.dot(_wheelEye)<0)_wheelAxis.negate();
      const seen=Math.acos(THREE.MathUtils.clamp(_wheelAxis.dot(_wheelEye),-1,1)),most=Math.PI/2-WHEEL_VIEW;
      if(seen>most&&_wheelCross.crossVectors(_wheelAxis,_wheelEye).lengthSq()>1e-8)goal.setFromAxisAngle(_wheelCross.normalize(),seen-most);
    }
    const parent=bone.parent;
    if(parent){parent.getWorldQuaternion(_wheelParent);bone.quaternion.premultiply(_wheelParent).premultiply(goal).premultiply(_wheelParent.invert());}
  }
  private swapped(state:PlayerState){
    if(!state.awakened)return false;
    return state.action!=='awaken'||state.actionTime*state.actionDuration>=awakeningSwapAt(state.fighter);
  }
  private static AIM_STATES=['idle','run','dash','guard','walk'];
  private limitRootMotion(state:PlayerState,dt=0){
    const root=this.rootBone;
    this.rootOffset=0;

    const airborne=state.action==='jump'&&!state.grounded;
    const guarding=state.action==='guard'&&!this.isForm;
    const reacting=REACTION_ACTIONS.has(state.action);
    const attacking=ROOT_CLAMPED.includes(state.action);
    const alphonseShoulderCarry=state.fighter==='alphonse-elric'&&state.grounded&&attacking&&alphonseAuthoredShoulderStep(this.active?.getClip().name??'',this.active?.time??0);
    const mikasaContactCarry=state.grounded&&attacking&&this.mikasaCarry(state);
    const garouContactCarry=state.fighter==='garou'&&state.grounded&&attacking?garouAuthoredContactStep(this.active?.getClip().name,this.active?.time??0,this.isForm):0;
    const pikachuChargeCarry=state.fighter==='pikachu'&&state.grounded&&attacking&&pikachuAuthoredChargeStep(this.active?.getClip().name??'',this.active?.time??0);
    const shinjiPylonStep=state.fighter==='shinji'&&state.grounded&&attacking&&this.active?.getClip().name==='Pylon Breaker'&&(this.active?.time??0)>.02&&(this.active?.time??0)<.85;
    const shinjiRushStep=state.fighter==='shinji'&&state.grounded&&attacking&&this.active?.getClip().name==='Rush 1'&&(this.active?.time??0)>.005&&(this.active?.time??0)<.463;
    const guyRushStep=state.fighter==='might-guy'&&state.grounded&&attacking&&mightGuyAuthoredRushStep(this.active?.getClip().name??'',this.active?.time??0);
    const nativeJabStep=state.fighter==='ken-kaneki'&&state.grounded&&attacking&&kanekiAuthoredJabStep(this.active?.getClip().name??'',this.active?.time??0);
    const dreamStep=DREAM_IMPACT&&state.grounded&&attacking&&!this.isForm&&state.action==='light'&&!OWN_STEPS.has(state.fighter)&&!REACHING_LIGHTS.has(state.fighter)?this.dreamStepIn(state):0;
    this.rootClamped=false;
    const caps=guarding?GUARD_ROOT:airborne?JUMP_ROOT:reacting?REACTION_ROOT:this.isForm&&state.fighter==='luffy'&&state.action==='ultimate'?BAJRANG_LEAP:this.isForm&&state.fighter==='naruto'?{rise:.6,drop:.35,travel:.65}:(this.isForm?FIGHTERS[state.fighter].formRootMotion:undefined)??FIGHTERS[state.fighter].rootMotion??UNCAPPED;
    if(!root||!root.parent||!(guarding||airborne||attacking||reacting)){this.roomBody=Infinity;this.fallEpoch=-1;return;}
    this.group.updateMatrixWorld(true);
    const local=this.group.worldToLocal(root.getWorldPosition(_rootWorld));
    _rootRaw.copy(local);
    const grip=this.rootFromClamped?this.rootGrip:1;
    if(grip<1){const g=Math.max(grip,1e-3);local.addScaledVector(this.rootDrawnFrom,-(1-g)).divideScalar(g);}
    const sideways=local.x-this.rootReference.x,up=local.y-this.rootReference.y,forward=local.z-this.rootReference.z;
    const flat=Math.hypot(sideways,forward);
    this.rootOffset=Math.max(flat,Math.abs(up));
    const stepTravel=shinjiPylonStep?.315:shinjiRushStep?.55:guyRushStep?.565:pikachuChargeCarry?.65:garouContactCarry?garouContactCarry+.015:alphonseShoulderCarry?.75:mikasaContactCarry?.60:nativeJabStep?.34:0;
    const flatScale=flat>1e-4?(stepTravel?Math.min(flat,stepTravel):softLimit(flat,caps.travel))/flat:1;
    const ceiling=up>=0?caps.rise:caps.drop;
    const nativeFloor=(state.fighter==='sakura'||(state.fighter==='edward-elric'||state.fighter==='alphonse-elric')&&this.authoredFloorStrike(state))&&state.grounded&&attacking&&!reacting&&up<0;
    const nativeGuySupport=state.fighter==='might-guy'&&state.grounded&&attacking&&(guyRushStep||this.authoredKick(state));
    const upScale=!guarding&&Math.abs(up)>1e-4?(nativeFloor||nativeGuySupport||shinjiRushStep||shinjiPylonStep||this.authoredHover(state)?Math.min(Math.abs(up),ceiling):softLimit(Math.abs(up),ceiling))/Math.abs(up):1;
    let ahead=Infinity,body=Infinity,lead=0;
    const scale=this.group.getWorldScale(_rootLead).x||1;
    const approach=attacking?this.moveFor(state) as MoveDefinition&Approach:undefined;
    const elapsed=state.actionTime*state.actionDuration;
    const through=!!approach?.dashThrough&&elapsed>=(approach.contacts[0]??0)-THROUGH_LEAD;
    if(!airborne&&!through){
      const point=this.targetPoint??this.owner?.targetPoint;
      if(point&&!reacting)ahead=this.group.worldToLocal(_rootOther.copy(point)).z-PUSH_RADIUS*2/scale;
      const other=this.opponentBody();
      if(other){
        const to=this.group.worldToLocal(other.restCenter(_rootOther));
        const stepGap=shinjiPylonStep?.70:shinjiRushStep?.70:guyRushStep?.65:pikachuChargeCarry?.57:garouContactCarry?.65:alphonseShoulderCarry?.40:mikasaContactCarry?.56:nativeJabStep?.72:dreamStep>0?DREAM_STEP.gap:0;
        const reach=(stepGap||(attacking&&this.armed&&!this.isForm?DRAWN_GAP_ARMED[state.fighter]??DRAWN_GAP:DRAWN_GAP))/scale;
        const across=(to.x-(this.rootReference.x+sideways*flatScale))/reach;
        if(Math.abs(across)<1&&to.z>this.rootReference.z)body=to.z-this.rootReference.z-reach*Math.sqrt(1-across*across*across*across);
        const top=this.joints.get('Neck')??this.joints.get('Spine2')??this.headBone;
        if(top)lead=Math.max(0,(this.group.worldToLocal(top.getWorldPosition(_rootLead)).z-_rootRaw.z)*.5);
      }
    }
    let forwardScaled=forward*flatScale+dreamStep/scale;
    if(!Number.isFinite(this.roomAhead))this.roomAhead=ahead;
    else if(!Number.isFinite(ahead))this.roomAhead=dt>0?Fighter.released(this.roomAhead,dt):this.roomAhead;
    else if(dt>0)this.roomAhead+=THREE.MathUtils.clamp((ahead-this.roomAhead)*(1-Math.exp(-dt*14)),-20*dt,5*dt);
    if(!Number.isFinite(this.roomBody))this.roomBody=Number.isFinite(body)?Math.max(body,forwardScaled+lead+ROOM_KNEE):body;
    else if(!Number.isFinite(body))this.roomBody=dt>0?Fighter.released(this.roomBody,dt):this.roomBody;
    else if(dt>0)this.roomBody+=THREE.MathUtils.clamp((body-this.roomBody)*(1-Math.exp(-dt*14)),-ROOM_PULL_RATE/scale*dt,5*dt);
    if(pikachuChargeCarry&&Number.isFinite(body))this.roomBody=Math.min(this.roomBody,body);
    const stepLead=shinjiPylonStep?.315:shinjiRushStep?.55:guyRushStep?.565:pikachuChargeCarry?.68:garouContactCarry?garouContactCarry+.015:alphonseShoulderCarry?.74:mikasaContactCarry?.60:nativeJabStep?.38:dreamStep>0?Math.max(.12,dreamStep+.04):.12;
    let roomCap=Math.min(Number.isFinite(this.roomAhead)?Math.max(stepLead,this.roomAhead):Infinity,Math.max(-ROOM_PULL/scale,this.roomBody-lead));
    if(approach?.chargeIn&&!through)roomCap=Math.min(roomCap,CHARGE_ROOM/scale);
    if(this.capEpoch!==this.actionEpoch||!(dt>0)){if(this.capEpoch!==this.actionEpoch)this.capDrawn=roomCap;this.capEpoch=this.actionEpoch;}
    else this.capDrawn=roomCap>this.capDrawn?Fighter.released(this.capDrawn,dt):roomCap;
    roomCap=Math.min(roomCap,this.capDrawn);
    if(forwardScaled>roomCap-ROOM_KNEE)forwardScaled=softCap(forwardScaled,roomCap);
    const settling=this.tailWeight>1e-3&&dt>0;
    const sameMove=this.fallEpoch===this.actionEpoch;
    this.fallEpoch=this.actionEpoch;
    if(!attacking||!sameMove)this.rootFalling=false;
    else if(this.rootDrawnLast.y-this.rootReference.y>ROOT_FALL_FROM/scale)this.rootFalling=true;
    const fall=this.rootFalling&&dt>0?ROOT_FALL_RATE*dt/scale:Infinity;
    const landing=this.rootReference.y+up*upScale<this.rootDrawnLast.y-fall;
    if(!landing&&this.rootDrawnLast.y-this.rootReference.y<=ROOT_FALL_FROM/scale)this.rootFalling=false;
    if(!settling&&!landing&&Math.abs(flatScale-1)<1e-4&&Math.abs(upScale-1)<1e-4&&Math.abs(forwardScaled-forward)<1e-4){this.rootDrawnLast.copy(_rootRaw);return;}
    local.set(this.rootReference.x+sideways*flatScale,this.rootReference.y+up*upScale,this.rootReference.z+forwardScaled);
    if(grip<1)local.lerpVectors(this.rootDrawnFrom,local,grip);
    if(local.y<this.rootDrawnLast.y-fall)local.y=this.rootDrawnLast.y-fall;
    if(settling){
      const step=_rootLead.subVectors(local,this.rootDrawnLast),most=TAIL_ROOT_RATE*dt/scale;
      if(step.length()>most)local.copy(this.rootDrawnLast).add(step.setLength(most));
    }
    this.rootDrawnLast.copy(local);
    const before=_rootShift.copy(root.position);
    root.position.copy(root.parent.worldToLocal(this.group.localToWorld(local)));
    this.rootClamped=true;
    before.subVectors(root.position,before);
    for(const sibling of this.rootSiblings)sibling.position.add(before);
    const rootPose=this.poseByNode.get(root);
    if(rootPose){
      const drawnRoot=this.rootDrawnLast;
      _rootBasis.set(drawnRoot.x,drawnRoot.y,drawnRoot.z);
      root.parent.worldToLocal(this.group.localToWorld(_rootBasis));
      _rootShift.subVectors(_rootBasis,rootPose.blendPosition);
      rootPose.blendPosition.copy(_rootBasis);
      for(const sibling of this.rootSiblings){const pose=this.poseByNode.get(sibling);if(pose)pose.blendPosition.add(_rootShift);}
    }
  }

  private static released(room:number,dt:number){const open=room+ROOM_RELEASE*dt;return open>4?Infinity:open;}
  private leanBone(bone:THREE.Bone,world:THREE.Quaternion){
    if(!bone.parent)return;
    bone.parent.getWorldQuaternion(_leanParent);
    _leanParentInverse.copy(_leanParent).invert();
    _leanLocal.copy(_leanParentInverse).multiply(world).multiply(_leanParent).multiply(bone.quaternion);
    bone.quaternion.copy(_leanLocal);
    bone.updateMatrix();
    bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld,bone.matrix);
  }

  private solveLeg(leg:Leg,target:THREE.Vector3,weight:number){
    const {hip,knee,ankle,upper,lower}=leg;
    if(!hip.parent||!knee.parent)return;
    hip.getWorldPosition(_ikA);knee.getWorldPosition(_ikB);ankle.getWorldPosition(_ikC);
    _ikT.copy(target);
    const span=upper+lower;
    _ikAT.subVectors(_ikT,_ikA);
    const reach=_ikAT.length();
    if(reach<1e-4)return;
    const wanted=THREE.MathUtils.clamp(reach,Math.abs(upper-lower)+1e-3,span*.999);
    if(wanted!==reach)_ikT.copy(_ikA).addScaledVector(_ikAT,wanted/reach);
    _ikAB.subVectors(_ikB,_ikA);_ikAC.subVectors(_ikC,_ikA);_ikAT.subVectors(_ikT,_ikA);
    _ikBA.subVectors(_ikA,_ikB);_ikBC.subVectors(_ikC,_ikB);
    _ikAxis.crossVectors(_ikAC,_ikAB);
    if(_ikAxis.lengthSq()<1e-8){
      _ikAxis.set(1,0,0).applyQuaternion(hip.getWorldQuaternion(_ikFoot));
      _ikAxis.crossVectors(_ikAC,_ikAxis);
      if(_ikAxis.lengthSq()<1e-8)return;
    }
    _ikAxis.normalize();
    const cosine=(a:number,b:number,c:number)=>Math.acos(THREE.MathUtils.clamp((a*a+b*b-c*c)/(2*a*b),-1,1));
    const hipNow=_ikAC.angleTo(_ikAB),kneeNow=_ikBA.angleTo(_ikBC);
    const hipWant=cosine(upper,wanted,lower),kneeWant=cosine(upper,lower,wanted);
    this.leanBone(hip,_ikTurn.setFromAxisAngle(_ikAxis,(hipWant-hipNow)*weight));
    hip.updateMatrixWorld(true);
    this.leanBone(knee,_ikTurn.setFromAxisAngle(_ikAxis,(kneeWant-kneeNow)*weight));
    knee.updateMatrixWorld(true);
    hip.getWorldPosition(_ikA);ankle.getWorldPosition(_ikC);
    _ikAC.subVectors(_ikC,_ikA);_ikAT.subVectors(_ikT,_ikA);
    if(_ikAC.lengthSq()>1e-8&&_ikAT.lengthSq()>1e-8){
      _ikAxis.crossVectors(_ikAC,_ikAT);
      if(_ikAxis.lengthSq()>1e-10){
        _ikAxis.normalize();
        this.leanBone(hip,_ikTurn.setFromAxisAngle(_ikAxis,_ikAC.angleTo(_ikAT)*weight));
        hip.updateMatrixWorld(true);
      }
    }
  }

  private footPlanting(dt:number,state:PlayerState){
    this.serverTime+=dt;
    if(this.state.fighter==='pikachu'||!this.legs.length||!this.dynamics)return;
    const kicking=this.authoredKick(state)||this.authoredFloorStrike(state)||this.authoredHover(state)||this.authoredStep(state);
    const pivot=1-THREE.MathUtils.smoothstep(Math.abs(this.turnRate),4,12);
    const eligible=state.grounded&&state.alive&&!REACTION_ACTIONS.has(state.action)&&state.action!=='jump'&&!kicking&&pivot>.05&&!this.floating;
    for(const leg of this.legs){
      leg.ankle.getWorldPosition(_ikAnkle);
      const height=_ikAnkle.y-this.groundY;
      leg.low+=(height-leg.low)*(height<leg.low?.5:1-Math.exp(-dt*1.1));
      leg.high+=(height-leg.high)*(height>leg.high?.5:1-Math.exp(-dt*1.1));
      const scale=(this.legLength||.85)/.85;
      const lift=THREE.MathUtils.clamp((leg.high-leg.low)*PLANT_BAND,.05*scale,.2*scale);
      if(!eligible)leg.planted=false;
      else if(!leg.planted&&height<=leg.low+lift){
        leg.planted=true;leg.anchor.set(_ikAnkle.x,0,_ikAnkle.z);leg.plantYaw=this.group.rotation.y;
        if(this.locomotionSpeed>STEP_AUDIBLE&&this.serverTime-leg.stepped>STEP_GAP){
          leg.stepped=this.serverTime;
          this.steps.push({x:_ikAnkle.x,y:this.groundY,z:_ikAnkle.z,speed:this.locomotionSpeed});
          if(this.steps.length>4)this.steps.shift();
        }
      }
      else if(leg.planted&&height>leg.low+lift*RELEASE_BAND)leg.planted=false;
      if(leg.planted){
        leg.hip.getWorldPosition(_ikA);
        const gap=Math.hypot(_ikA.x-leg.anchor.x,_ikA.y-_ikAnkle.y,_ikA.z-leg.anchor.z);
        const twist=Math.abs(Math.atan2(Math.sin(this.group.rotation.y-leg.plantYaw),Math.cos(this.group.rotation.y-leg.plantYaw)));
        if(gap>(leg.upper+leg.lower)*LEG_REACH||twist>Math.PI/3)leg.planted=false;
      }
      const carry=pivot*THREE.MathUtils.clamp(this.locomotionSpeed/.9,0,1)
        *(1-THREE.MathUtils.smoothstep(this.locomotionSpeed,PLANT_LIMIT[0],PLANT_LIMIT[1]));
      const wanted=leg.planted?carry:0;
      const release=ATTACK_SLOTS.has(state.action)?PLANT_OUT_STRIKE:PLANT_OUT;
      leg.weight+=(wanted-leg.weight)*(1-Math.exp(-dt*(wanted>leg.weight?PLANT_IN:release)));
      const weight=Math.max(leg.weight,Math.min(1,this.landDip/LAND_HOLD));
      if(weight<.004)continue;
      const held=leg.weight>.004;
      _ikT.set(held?leg.anchor.x:_ikAnkle.x,_ikAnkle.y+this.landDip,held?leg.anchor.z:_ikAnkle.z);
      leg.ankle.getWorldQuaternion(_ikFoot);
      this.solveLeg(leg,_ikT,weight);
      if(leg.ankle.parent){
        leg.ankle.parent.getWorldQuaternion(_leanParent);
        leg.ankle.quaternion.copy(_leanParentInverse.copy(_leanParent).invert()).multiply(_ikFoot);
        leg.ankle.updateMatrixWorld(true);
      }
    }
  }

  private stabilizeLegs(dt:number,state:PlayerState,placed:boolean){
    if(state.fighter==='pikachu')return;
    if(!this.dynamics||placed||!state.grounded||this.authoredHover(state)||!['idle','run'].includes(state.action))return;
    for(const leg of this.legs)for(const bone of [leg.hip,leg.knee,leg.ankle]){
      const previous=this.legPresentation.get(bone);
      if(!previous)continue;
      const angle=previous.angleTo(bone.quaternion),budget=THREE.MathUtils.degToRad(state.action==='idle'&&!this.isForm?480:1440)*dt;
      if(angle>budget&&angle>1e-6){_blendTarget.copy(bone.quaternion);bone.quaternion.slerpQuaternions(previous,_blendTarget,budget/angle);}
    }
    this.group.updateMatrixWorld(true);
  }

  private floorFeet(state:PlayerState,real=0){
    if(state.fighter==='pikachu')return;
    const planted=DREAM_IMPACT&&!!this.takeOn&&state.action==='hurt';
    const fresh=state.action==='launched'&&state.actionTime*state.actionDuration<FLOOR_GUARD_FRESH.within;
    const standing=['idle','run','guard'].includes(state.action)||state.action==='getup'&&this.standingRise;
    const swinging=DREAM_IMPACT&&state.grounded&&state.action==='light'&&!this.isForm;
    if(real>0){
      this.plantRaise=THREE.MathUtils.clamp(this.plantRaise+(swinging||standing?real:-real)/STRIKE_PLANT.ease,0,1);
      this.plantLower=THREE.MathUtils.clamp(this.plantLower+(swinging?real:-real)/STRIKE_PLANT.ease,0,1);
    }
    const striking=!planted&&!fresh&&state.grounded&&(swinging||this.plantLower>1e-3||!standing&&this.plantRaise>1e-3);
    if(!this.dynamics||!state.alive||!state.grounded&&!fresh||this.isForm||this.authoredHover(state)
      ||!standing&&!planted&&!fresh&&!striking)return;
    for(const [i,leg] of this.legs.entries()){
      if(planted&&this.staggerWeight>1e-3&&(this.staggerSwing[i]??-1)>=0)continue;
      let goal=this.groundY+.006;
      for(let pass=0;pass<2;pass++){
        let lowest=Infinity;
        for(const {mesh,index}of leg.soles)lowest=Math.min(lowest,mesh.getVertexPosition(index,this.fallback).applyMatrix4(mesh.matrixWorld).y);
        let correction=goal-lowest;
        if(striking&&pass===0&&correction<=.4){
          correction*=correction<0?THREE.MathUtils.clamp((STRIKE_PLANT.reach+correction)/(STRIKE_PLANT.reach-STRIKE_PLANT.full),0,1)*this.plantLower:standing?1:this.plantRaise;
          goal=lowest+correction;
        }
        if(striking?Math.abs(correction)<=.004||correction>.4:planted?Math.abs(correction)<=.004||correction<-TAKE_PLANT:correction<=.001||correction>.4)break;
        leg.ankle.getWorldPosition(_ikAnkle);_ikAnkle.y+=correction;
        leg.ankle.getWorldQuaternion(_ikFoot);
        this.solveLeg(leg,_ikAnkle,1);
        if(leg.ankle.parent){
          leg.ankle.parent.getWorldQuaternion(_leanParent);
          leg.ankle.quaternion.copy(_leanParentInverse.copy(_leanParent).invert()).multiply(_ikFoot);
          leg.ankle.updateMatrixWorld(true);
        }
      }
    }
    this.soleGap=this.lowestSupport()-this.groundY;
  }

  private bodyDynamics(dt:number,state:PlayerState,real=dt){
    if(state.fighter==='pikachu')return;
    if(!this.leanChain.length||!this.dynamics)return;
    const reacting=REACTION_ACTIONS.has(state.action);
    const attacking=state.action==='light'||state.action==='heavy'||state.action==='special'||state.action==='ultimate';
    const flat=Math.hypot(this.velocity.x,this.velocity.z);
    if(dt>0){
      const slower=reacting?1+HIT_SLOW*this.hitHeavy:1;
      this.driving=Math.max(0,this.driving-dt);
      this.recoil.multiplyScalar(Math.exp(-dt*(reacting?7:this.driving>0?0:this.drove&&attacking?DRIVE.rate:13)/slower));
      const stunned=DREAM_IMPACT&&state.action==='hurt'&&state.grounded&&state.actionDuration<ROCKED_HURT&&state.actionTime<STUN_HOLD.release;
      const settle=Math.exp(-dt*(reacting?6:11)/slower*(stunned?STUN_HOLD.rate:1));
      this.hitFold*=settle;this.hitTwist*=settle;
      const hunched=stunned&&(state.actionTime*state.actionDuration>=STUN_HOLD.after||this.stunHunch>.05)?STUN_HOLD.hunch:0;
      this.stunHunch+=(hunched-this.stunHunch)*(1-Math.exp(-dt*(hunched>this.stunHunch?STUN_HOLD.inRate:STUN_HOLD.outRate)));
      if(this.stunHunch<1e-4&&!hunched)this.stunHunch=0;
      _leanAxis.copy(this.recoil).negate();
      if(reacting&&flat>.6){
        _leanPoint.set(this.velocity.x,0,this.velocity.z).normalize();
        _leanAxis.addScaledVector(_leanPoint,Math.min(.18,flat*.02));
      }
      if(!reacting&&state.grounded){
        _leanPoint.set(this.velocity.x-this.previousVelocity.x,0,this.velocity.z-this.previousVelocity.z);
        if(flat>.5){const along=(_leanPoint.x*this.velocity.x+_leanPoint.z*this.velocity.z)/(flat*flat);_leanPoint.set(this.velocity.x*along,0,this.velocity.z*along);}
        const rate=_leanPoint.length()/Math.max(dt,1e-4);
        if(rate>1)_leanAxis.addScaledVector(_leanPoint.normalize(),THREE.MathUtils.clamp(rate*.0022,0,.1));
        const before=Math.hypot(this.previousVelocity.x,this.previousVelocity.z);
        const braking=(before-flat)/Math.max(dt,1e-4);
        if(braking>6&&flat<3)this.stopDip=Math.max(this.stopDip,Math.min(.045,braking*.0035));
      }
      this.stopDip*=Math.exp(-dt*9);
      if(attacking&&!this.struck){
        const move=this.moveFor(state);
        const last=move.contacts[move.contacts.length-1],elapsed=state.actionTime*state.actionDuration;
        if(elapsed>last+.04){
          _leanPoint.set(Math.sin(this.facing),0,Math.cos(this.facing));
          _leanAxis.addScaledVector(_leanPoint,.08*THREE.MathUtils.smoothstep(elapsed,last+.04,last+.22));
        }
      }
      this.leanTilt.lerp(_leanAxis,1-Math.exp(-dt*(reacting?26:11)));
      if(this.leanTilt.length()>.34)this.leanTilt.setLength(.34);
      let wantRoll=0;
      const before=Math.hypot(this.previousVelocity.x,this.previousVelocity.z);
      if(!reacting&&state.grounded&&flat>1&&before>1){
        const bend=Math.atan2(this.previousVelocity.x*this.velocity.z-this.previousVelocity.z*this.velocity.x,this.previousVelocity.x*this.velocity.x+this.previousVelocity.z*this.velocity.z)/Math.max(real,1e-4);
        wantRoll=THREE.MathUtils.clamp(BANK.share*Math.atan(flat*bend/9.8),-BANK.most,BANK.most);
      }
      this.leanRoll+=(wantRoll-this.leanRoll)*(1-Math.exp(-dt*BANK.ease));
    }
    const tilt=this.leanTilt.length();
    const tremor=this.chargeHold>.01?this.chargeHold*(CHARGE_TREMOR*(Math.sin(this.serverTime*61)*.6+Math.sin(this.serverTime*97+1.3)*.4)
      +CHARGE_BREATH*Math.sin(this.serverTime*7.5)):0;
    if(tilt<1e-4&&Math.abs(this.leanRoll)<1e-4&&Math.abs(this.hipYaw)<1e-3&&this.landDip<1e-3&&this.stopDip<1e-3
      &&Math.abs(this.hitFold)<1e-4&&Math.abs(this.hitTwist)<1e-4&&this.stunHunch<1e-4&&Math.abs(tremor)<1e-5)return;
    const room=Math.max(0,.52-tilt),fold=Math.min(room,Math.sign(this.hitFold)*Math.min(Math.abs(this.hitFold),room)*this.takeFold+this.stunHunch*this.takeHunch);
    const facing=this.facing,lateral=_foldAxis.set(Math.cos(facing),0,-Math.sin(facing));
    const shares=LEAN_SHARE.slice(0,this.leanChain.length);
    const total=shares.reduce((sum,share)=>sum+share,0)||1;
    const folds=FOLD_SHARE.slice(0,this.leanChain.length);
    const foldTotal=folds.reduce((sum,share)=>sum+share,0)||1;
    const forward=_leanPoint.set(Math.sin(facing),0,Math.cos(facing));
    for(let i=0;i<this.leanChain.length;i++){
      const share=shares[i]/total;
      _leanWorld.identity();
      if(tilt>1e-4){
        _leanAxis.set(-this.leanTilt.z,0,this.leanTilt.x).normalize();
        _leanWorld.multiply(_leanShare.setFromAxisAngle(_leanAxis,tilt*share*this.takeLean));
      }
      if(Math.abs(this.leanRoll)>1e-4&&i>0)_leanWorld.multiply(_leanShare.setFromAxisAngle(forward,this.leanRoll*shares[i]/Math.max(1e-6,total-shares[0])));
      if(Math.abs(fold)>1e-4)_leanWorld.multiply(_leanShare.setFromAxisAngle(lateral,fold*folds[i]/foldTotal));
      if(Math.abs(tremor)>1e-5)_leanWorld.multiply(_leanShare.setFromAxisAngle(lateral,tremor*folds[i]/foldTotal));
      if(Math.abs(this.hitTwist)>1e-4)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,this.hitTwist*(i===0?.6:.14)));
      if(Math.abs(this.hipYaw)>1e-3){
        const yaw=i===0?this.hipYaw:-this.hipYaw*.55/Math.max(1,this.leanChain.length-1);
        _leanWorld.multiply(_leanShare.setFromAxisAngle(UP,yaw));
      }
      this.leanBone(this.leanChain[i],_leanWorld);
    }
    if(this.headBone&&this.aimWeight<.5&&(Math.abs(fold)>1e-4||Math.abs(this.hitTwist)>1e-4)){
      _leanWorld.identity();
      if(Math.abs(fold)>1e-4)_leanWorld.multiply(_leanShare.setFromAxisAngle(lateral,fold*.5));
      if(Math.abs(this.hitTwist)>1e-4)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,this.hitTwist*.75));
      this.leanBone(this.headBone,_leanWorld);
    }
    const dip=(state.fighter==='might-guy'||state.fighter==='shinji')&&this.authoredStep(state)?0:this.landDip+this.stopDip;
    if(dip>1e-3&&this.pelvis&&this.pelvis.parent){
      this.pelvis.getWorldPosition(_leanPoint);
      _leanPoint.y-=dip;
      this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_leanPoint));
      this.pelvis.updateMatrix();
      this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
    }
  }

  private holdLife(dt:number,state:PlayerState,real=dt){
    if(state.fighter==='pikachu')return;
    const slot=state.action;
    const casting=this.dynamics&&state.alive&&(slot==='heavy'||slot==='special'||slot==='ultimate')&&state.actionDuration>0;
    if(dt>0){
      let want=0,charge=this.holdCharge;
      if(casting){
        if(this.animSpeed<HOLD_STILL)this.stillHeld=true;else if(this.animSpeed>HOLD_MOVING)this.stillHeld=false;
        this.stillFor=this.stillHeld?this.stillFor+dt:0;
        const move=this.moveFor(state),elapsed=state.actionTime*state.actionDuration,last=move.contacts[move.contacts.length-1]??0;
        const still=THREE.MathUtils.smoothstep(this.stillFor,HOLD_IN[0],HOLD_IN[1]);
        if(elapsed<last){
          want=Math.max(still,this.chargeHold)*(1-THREE.MathUtils.smoothstep(elapsed,last-HOLD_CLEAR-.15,last-HOLD_CLEAR));
          charge=1;
        }else{
          want=still*THREE.MathUtils.smoothstep(elapsed,last+.12,last+.35)*(1-this.tailWeight);
          charge=0;
        }
        want*=1-THREE.MathUtils.smoothstep(elapsed,state.actionDuration-.22,state.actionDuration-.04);
      }else{this.stillFor=0;this.stillHeld=false;}
      this.holdWeight+=(want-this.holdWeight)*(1-Math.exp(-dt*(want>this.holdWeight?HOLD_RISE:HOLD_FALL)));
      if(this.holdWeight<.05)this.holdCharge=charge;
      if(this.holdWeight>1e-3)this.holdClock+=dt;
    }
    this.secondary?.aura(casting?this.holdWeight*this.holdCharge:0);
    const weight=this.holdWeight;
    if(weight<1e-3||!this.leanChain.length)return;
    const charge=this.holdCharge,t=this.holdClock,tau=Math.PI*2;
    const size=slot==='ultimate'?1:slot==='special'?.85:.6;
    const facing=this.facing,lateral=_foldAxis.set(Math.cos(facing),0,-Math.sin(facing));
    const forward=_holdForward.set(Math.sin(facing),0,Math.cos(facing));
    const breath=Math.sin(t*HOLD_BREATH.rate*(charge?1:1.2)*tau)*weight*size*(charge+(1-charge)*HOLD_AFTER.breath);
    const sway=Math.sin(t*HOLD_SWAY.rate*tau+.7)*weight*size*(charge+(1-charge)*HOLD_AFTER.sway);
    const pumpPhase=t*HOLD_PUMP.rate*tau;
    const pump=Math.sin(pumpPhase+HOLD_PUMP.skew*Math.sin(pumpPhase))*weight*size*charge;
    const drawable=THREE.MathUtils.smoothstep(real>1e-4?1/real:60,28,48);
    const shake=(Math.sin(t*HOLD_SHAKE.rates[0]*tau)*.6+Math.sin(t*HOLD_SHAKE.rates[1]*tau+1.7)*.4)*weight*size*charge*drawable;
    const chain=this.leanChain,top=chain.length-1;
    for(let i=0;i<chain.length;i++){
      _leanWorld.identity();
      const share=i===0?0:1/Math.max(1,top);
      _leanWorld.multiply(_leanShare.setFromAxisAngle(lateral,-breath*HOLD_BREATH.spine*share));
      _leanWorld.multiply(_leanShare.setFromAxisAngle(forward,sway*HOLD_SWAY.roll*(i===0?1:-1.25*share)));
      if(i===top)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,shake*HOLD_SHAKE.chest));
      this.leanBone(chain[i],_leanWorld);
    }
    const chest=chain[top];
    chest.getWorldPosition(_holdPoint);
    for(const name of SHOULDERS){
      const bone=this.joints.get(name);if(!bone)continue;
      const side=Math.sign(bone.getWorldPosition(_holdSide).sub(_holdPoint).dot(lateral))||1;
      this.leanBone(bone,_leanWorld.setFromAxisAngle(forward,Math.max(0,breath)*HOLD_BREATH.shoulder*side));
    }
    if(charge>0)for(const name of UPPER_ARMS){
      const bone=this.joints.get(name);if(!bone)continue;
      this.leanBone(bone,_leanWorld.setFromAxisAngle(lateral,-pump*HOLD_PUMP.arm-shake*HOLD_SHAKE.arm));
    }
    if(this.headBone)this.leanBone(this.headBone,_leanWorld.setFromAxisAngle(lateral,-breath*HOLD_BREATH.head+shake*HOLD_SHAKE.head));
    if(this.pelvis&&this.pelvis.parent){
      this.pelvis.getWorldPosition(_holdPoint);
      _holdPoint.addScaledVector(lateral,sway*HOLD_SWAY.shift);
      _holdPoint.y-=(.5+.5*breath/Math.max(1e-3,weight*size))*HOLD_BREATH.dip*weight*size;
      this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_holdPoint));
      this.pelvis.updateMatrix();
      this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
    }
  }

  private updateSmear(state:PlayerState,real:number){
    const motion=this.smear.motion.value,point=this.smear.point.value;
    if(state.fighter==='toji'||state.fighter==='kaiju-no-8'||state.fighter==='garou'||state.fighter==='eren'&&this.isForm){motion.w=0;this.smearSeen=false;return;}
    if(this.stepRepeat)return;
    let on=false;
    const now=performance.now()/1000;
    if(Fighter.animStyle!=='classic'&&ATTACK_SLOTS.has(state.action)&&state.actionDuration>0&&!state.timeStopped&&real>0&&!this.unseen&&this.moveFor(state).style==='melee'){
      const move=this.moveFor(state),t=this.drawn.actionTime*this.drawn.actionDuration;
      let k=0;for(let i=1;i<move.contacts.length;i++)if(Math.abs(move.contacts[i]-t)<Math.abs(move.contacts[k]-t))k=i;
      const c=move.contacts[k];
      if(t>c-SMEAR_LEAD&&t<c+SMEAR_TAIL){
        const limbs=this.smearLimbs??=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
        const prev=this.smearPrev??=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
        if(this.rightReach&&this.rightBone)limbs[0].copy(this.rightReach).applyMatrix4(this.rightBone.matrixWorld);else if(this.rightBone)this.rightBone.getWorldPosition(limbs[0]);
        if(this.leftBone)this.leftBone.getWorldPosition(limbs[1]);
        this.joints.get('RightFoot')?.getWorldPosition(limbs[2]);this.joints.get('LeftFoot')?.getWorldPosition(limbs[3]);
        this.group.getWorldPosition(_smearRoot);
        if(this.smearSeen){
          const gap=Math.max(now-this.smearAt,1/120);let best=-1,speed=SMEAR_SPEED;
          _smearCarry.subVectors(_smearRoot,this.smearPrevRoot);
          const fx=Math.sin(this.facing),fz=Math.cos(this.facing),socketed=DREAM_IMPACT&&this.meleeContactPoint(k,_smearSocket);let bestScore=SMEAR_SPEED,nearest=Infinity;
          for(let i=0;i<4;i++){
            if(i>=2&&limbs[i].y-_smearRoot.y<SMEAR_FOOT_LIFT)continue;
            _smearVel.subVectors(limbs[i],prev[i]).sub(_smearCarry);const v=_smearVel.length()/gap;
            if(socketed){const d=limbs[i].distanceToSquared(_smearSocket);if(v>SMEAR_SPEED&&d<nearest){nearest=d;speed=v;best=i;}continue;}
            const ahead=v>1e-4?(_smearVel.x*fx+_smearVel.z*fz)/(v*gap):0,score=DREAM_IMPACT?v*(.34+.66*Math.max(0,ahead)):v;
            if(score>bestScore){bestScore=score;speed=v;best=i;}
          }
          if(socketed&&nearest>.36)best=-1;
          if(best>=0){
            on=true;_smearVel.subVectors(limbs[best],prev[best]).sub(_smearCarry).normalize();
            motion.set(_smearVel.x,_smearVel.y,_smearVel.z,Math.min(best>=2?SMEAR_MOST_FOOT:SMEAR_MOST,speed*SMEAR_SECONDS));
            point.set(limbs[best].x,limbs[best].y,limbs[best].z,best===0&&this.armed?SMEAR_REACH_ARMED:best>=2?SMEAR_REACH_FOOT:SMEAR_REACH);
            this.smear.limb.value.set(best===0?1:0,best===1?1:0,best===2?1:0,best===3?1:0);
          }
        }
        for(let i=0;i<4;i++)prev[i].copy(limbs[i]);
        this.smearPrevRoot.copy(_smearRoot);
        this.smearSeen=true;this.smearAt=now;
      }else this.smearSeen=false;
    }else this.smearSeen=false;
    if(!on)motion.w=0;
  }
  private stepPoseHold(state:PlayerState){
    const stepped=Fighter.animStyle==='twos'&&(ATTACK_SLOTS.has(state.action)||REACTION_ACTIONS.has(state.action)||state.action==='awaken');
    this.stepRepeat=false;
    if(!stepped){this.stepAt=-1;return;}
    if(!this.stepNodes){const nodes:THREE.Object3D[]=[];this.model.traverse(o=>{if((o as THREE.Bone).isBone)nodes.push(o);});this.stepNodes=nodes;this.stepPose=new Float32Array(nodes.length*10);}
    const nodes=this.stepNodes,pose=this.stepPose!;
    if(this.stepAt!==Fighter.stepTick||this.stepEpoch!==this.actionEpoch){
      this.stepAt=Fighter.stepTick;this.stepEpoch=this.actionEpoch;
      for(let i=0,o=0;i<nodes.length;i++,o+=10){const n=nodes[i];n.position.toArray(pose,o);n.quaternion.toArray(pose,o+3);n.scale.toArray(pose,o+7);}
      return;
    }
    for(let i=0,o=0;i<nodes.length;i++,o+=10){const n=nodes[i];n.position.fromArray(pose,o);n.quaternion.fromArray(pose,o+3);n.scale.fromArray(pose,o+7);}
    this.group.updateMatrixWorld(true);this.stepRepeat=true;
  }
  private dreamStepIn(state:PlayerState){
    const move=this.moveFor(state),contact=move?.contacts?.[0];
    if(!move||!(contact!==undefined&&contact>0))return 0;
    const t=state.actionTime*state.actionDuration;
    const k=t<=contact?THREE.MathUtils.smoothstep(t,Math.max(0,contact-DREAM_STEP.rise),contact):1-THREE.MathUtils.smoothstep(t,contact+DREAM_STEP.hold,contact+DREAM_STEP.hold+DREAM_STEP.out);
    return DREAM_STEP.lead*k;
  }
  private bigHolding(state:PlayerState){return this.bigLeft>0&&!!state.hitstop;}
  private impactPose(state:PlayerState,real:number){
    for(const [bone,turned] of this.impactApplied)if(bone.quaternion.angleTo(turned.written)<1e-6)bone.quaternion.copy(turned.base);
    this.impactApplied.clear();
    const big=this.bigHolding(state);
    if(DREAM_IMPACT&&state.hitstop&&state.grounded&&state.action==='hurt'&&this.hitFlash>0)this.lightHeld=LIGHT_IMPACT.hold;else this.lightHeld=Math.max(0,this.lightHeld-real);
    const light=!big&&DREAM_IMPACT&&state.grounded&&state.action==='hurt'&&(!!state.hitstop&&this.hitFlash>0||this.lightHeld>0);
    if(big)this.impactLight=false;else if(light)this.impactLight=true;
    const want=big?1:light?LIGHT_IMPACT.share*Math.min(1,LIGHT_IMPACT.tall/(FIGHTERS[state.fighter]?.height??LIGHT_IMPACT.tall)):0;
    const rise=this.impactLight?Math.max(want,.05)/LIGHT_IMPACT.in:1/IMPACT_POSE.in;
    this.impactWeight=THREE.MathUtils.clamp(this.impactWeight+(want>this.impactWeight?Math.min(want-this.impactWeight,real*rise):-Math.min(this.impactWeight-want,real/IMPACT_POSE.out)),0,1);
    if(this.impactWeight<=1e-3||!this.dynamics||this.isForm)return;
    const w=this.impactWeight*this.impactWeight*(3-2*this.impactWeight);
    if(this.impactLight)_impactAxis.set(this.shakeHz,0,-this.shakeHx);else _impactAxis.set(this.bigHz,0,-this.bigHx);
    const turn=(name:string,angle:number)=>{
      const bone=this.joints.get(name);if(!bone?.parent)return;
      bone.parent.getWorldQuaternion(_impactParent);
      _impactLocal.copy(_impactAxis).applyQuaternion(_impactParent.invert()).normalize();
      const base=bone.quaternion.clone();
      bone.quaternion.premultiply(_impactTurn.setFromAxisAngle(_impactLocal,angle*w));
      this.impactApplied.set(bone,{base,written:bone.quaternion.clone()});
    };
    const knock=DREAM_IMPACT&&this.bigKnock;
    const way=knock?-1:this.takeOn?(TAKE_SHAPE[this.takeOn].fold>=.5?-1:1):this.hitFold>.02?-1:1;
    const bend=way*IMPACT_POSE_SCALE*(knock?KNOCK_BEND:1);
    turn('Spine',IMPACT_POSE.spine[0]*bend);turn('Spine1',IMPACT_POSE.spine[1]*bend);turn('Spine2',IMPACT_POSE.spine[2]*bend);
    turn('Neck',IMPACT_POSE.neck*bend);turn('Head',IMPACT_POSE.head*bend);
    turn('LeftArm',IMPACT_POSE.arm);turn('RightArm',IMPACT_POSE.arm);
  }
  private flail(phase:number,amount:number){
    if(!DREAM_IMPACT||this.launchWeight<=0||this.launchAt<0)return 0;
    const t=this.reactTime-this.launchAt,k=THREE.MathUtils.smoothstep(t,.06,.22)*(1-THREE.MathUtils.smoothstep(this.launchArc,.45,.75))*this.launchWeight;
    return k>1e-4?Math.sin(t*LAUNCH_FLAIL.rate*Math.PI*2+phase)*amount*k:0;
  }
  private static hitEnvelope(t:number,rise=HIT_RISE,settle=HIT_SETTLE,hold=0,swing=HIT_SWING){
    if(t<=0)return 0;
    if(t<rise)return .5-.5*Math.cos(Math.PI*t/rise);
    const u=t-rise-hold;
    if(u<=0)return 1;
    return Math.exp(-u/settle)*(Math.cos(swing*u)+Math.sin(swing*u)/(swing*settle));
  }
  private static rubberRecoil(w:number){return Math.exp(-w/RUBBER.settle)*(Math.cos(RUBBER.swing*w)+Math.sin(RUBBER.swing*w)/(RUBBER.swing*RUBBER.settle));}
  private hitReact(real:number,state:PlayerState){
    this.reactTime+=real;this.reactAhead=0;this.bounceDrawn=0;
    {const shape=this.takeOn?TAKE_SHAPE[this.takeOn]:undefined,ease=1-Math.exp(-real/TAKE_EASE);
      this.takeFold+=((shape?.fold??1)-this.takeFold)*ease;this.takeLean+=((shape?.lean??1)-this.takeLean)*ease;this.takeHunch+=((shape?.hunch??1)-this.takeHunch)*ease;}
    this.clipUnder=0;
    if(this.thrown(state)&&this.dynamics&&this.pelvis){this.group.updateMatrixWorld(true);const lowest=this.lowestSupport();if(Number.isFinite(lowest))this.clipUnder=Math.max(0,this.groundY+.006-lowest);}
    this.sellNow=this.sellAmount*Fighter.sellEnvelope(this.reactTime-this.sellAt,this.sellSettle)*Fighter.letGo(this.reactTime-this.sellGone);
    if(!this.dynamics||!this.leanChain.length){this.launchWeight=0;return;}
    let twist=0,headYaw=0,dip=0,heaviest=0;
    const lean=_hitLean.set(0,0,0),whip=_hitWhip.set(0,0,0),shove=_hitShove.set(0,0,0),fling=_hitFling.set(0,0,0);
    for(const hit of this.hits){
      const t=this.reactTime-hit.at,h=hit.heavy;
      const rise=HIT_RISE*(1+.3*h),settle=HIT_SETTLE*(1+HIT_SLOW*h),hold=HIT_HOLD*h,swing=HIT_SWING*(1-.45*h);
      const scale=hit.scale*Fighter.letGo(this.reactTime-hit.gone);
      if(t>HIT_LIFE+hold+(settle-HIT_SETTLE)*5||scale<=0)continue;
      const e=Fighter.hitEnvelope(t,rise,settle,hold,swing)*scale;
      const late=THREE.MathUtils.smoothstep(h,.3,.6),eh=late>0?Fighter.hitEnvelope(t-HEAD_LAG*late,rise*(1+.5*late),settle,hold,swing)*scale:e;
      twist+=hit.side*e*HIT_REACT.twist*((1+((hit.stand??1)-1)*h)/(hit.stand??1));headYaw+=hit.side*eh*HIT_REACT.headYaw;
      const stand=hit.stand??1,chest=(1+(stand-1)*h)/stand;
      lean.x+=hit.hx*e*HIT_REACT.lean*chest;lean.z+=hit.hz*e*HIT_REACT.lean*chest;
      whip.x+=hit.hx*eh*HIT_REACT.headWhip;whip.z+=hit.hz*eh*HIT_REACT.headWhip;
      dip+=Math.max(0,e)*chest*HIT_REACT.dip;
      const limb=Fighter.hitEnvelope(t-LIMB_LAG,LIMB_RISE,settle,hold,swing)*scale*HIT_REACT.arms;
      fling.x+=hit.hx*limb;fling.z+=hit.hz*limb;
      const push=Fighter.hitEnvelope(t,HIP_RISE,settle,hold,swing)*scale*chest*h*HIP_SHOVE;
      shove.x+=hit.hx*push;shove.z+=hit.hz*push;
      heaviest=Math.max(heaviest,h);
    }
    const wide=1+HIT_WIDER*heaviest;
    twist=softTo(twist,HIT_LIMIT.twist*wide);headYaw=softTo(headYaw,HIT_LIMIT.headYaw);dip=softTo(dip,HIT_LIMIT.dip*wide);
    if(this.takeLean<.999)lean.multiplyScalar(this.takeLean);
    let leanAmount=lean.length(),whipAmount=whip.length(),flingAmount=fling.length();
    if(flingAmount>1e-6){flingAmount=softTo(flingAmount,HIT_LIMIT.arms*wide);fling.setLength(flingAmount);}
    if(leanAmount>1e-6)lean.multiplyScalar(softTo(leanAmount,HIT_LIMIT.lean*wide)/leanAmount);
    if(whipAmount>1e-6)whip.multiplyScalar(softTo(whipAmount,HIT_LIMIT.headWhip)/whipAmount);
    const shoveAmount=shove.length();
    if(shoveAmount>1e-6)shove.multiplyScalar(softTo(shoveAmount,HIP_SHOVE_MOST)/shoveAmount);
    const flying=state.action==='launched'||state.action==='knockdown'&&!state.grounded;
    if(flying&&!this.wasLaunched&&this.launchAt>=0&&(this.launchArc>=1||this.reactTime-this.launchAt>LAUNCH_STALE)){const facing=this.facing;this.startLaunch(undefined,undefined,false,-Math.sin(facing),-Math.cos(facing),0,1);}
    const launched=flying&&this.launchAt>=0;
    this.launchWeight=launched?1:Math.max(0,this.launchWeight-real/.12);
    if(launched&&real>0)this.launchFall=Math.max(0,-this.velocity.y);
    if(this.wasLaunched&&!launched&&state.grounded&&this.launchAt>=0&&REACTION_ACTIONS.has(state.action)){this.landedAt=this.reactTime;this.landSpeed=this.launchFall;this.landRoll=1;}
    if(launched)this.landedAt=-1;
    if(launched)this.handAt=-1;else if(this.wasLaunched&&this.launchAt>=0){this.handAt=this.reactTime;this.handHold=state.action==='knockdown'?LAUNCH_HOLD:0;}
    const hand=this.handAt>=0?1-THREE.MathUtils.smoothstep(this.reactTime-this.handAt,this.handHold,this.handHold+LAUNCH_HAND):0;
    if(hand<=0)this.handAt=-1;
    this.wasLaunched=launched;
    let bounce=0,roll=0;
    if(this.landedAt>=0){
      const t=this.reactTime-this.landedAt;
      if(t<LAND_TIME&&REACTION_ACTIONS.has(state.action)){
        const u=t/LAND_TIME,height=Math.min(LAND_BOUNCE_MOST,this.landSpeed*LAND_BOUNCE);
        bounce=height*Math.sin(Math.PI*u)*(1-.35*u);roll=LAND_ROLL*this.landRoll*this.launchSide*Math.min(1,height/LAND_BOUNCE_MOST+.35)*Math.sin(Math.PI*u)*Math.sin(Math.PI*u*.5+Math.PI*.5);
      }else this.landedAt=-1;
    }
    let jack=0,headLag=0,tumble=0,trail=0,limbs=0,spin=0;
    if((this.launchWeight>0||hand>0)&&this.launchAt>=0&&this.pelvis){
      const t=this.reactTime-this.launchAt;
      jack=Fighter.hitEnvelope(t,LAUNCH_RISE,LAUNCH_SETTLE);
      headLag=Fighter.hitEnvelope(t-.04,LAUNCH_RISE,LAUNCH_SETTLE);
      limbs=Fighter.hitEnvelope(t-LIMB_LAG,LIMB_RISE+.04,LAUNCH_SETTLE);
      const held=Math.exp(-t/LAUNCH_LET_GO);
      jack=Math.max(jack,this.launchHeld[0]*held);headLag=Math.max(headLag,this.launchHeld[1]*held);limbs=Math.max(limbs,this.launchHeld[2]*held);
      if(real>0){
        this.launchRise=Math.max(this.launchRise,this.velocity.y);
        const flight=2*(this.launchLed?this.launchGuess:Math.max(this.launchRise,this.launchGuess))/(JUMP_GRAVITY*LAUNCH_GRAVITY);
        this.launchArc=Math.min(1,this.launchArc+real/flight);
        const top=this.launchLed?this.launchGuess:this.launchRise;
        if(top>2&&this.velocity.y<0){const fall=Math.min(1,.5-.5*this.velocity.y/top);if(fall>this.launchArc)this.launchArc+=(fall-this.launchArc)*Math.min(1,real/LAUNCH_CATCH);}
      }
      const arc=this.launchArc;
      trail=Math.max(THREE.MathUtils.smoothstep(t,.05,.2),this.launchHeld[3]*held)*(1-THREE.MathUtils.smoothstep(arc,.7,1));
      if(launched){
        const neck=this.joints.get('Neck')??this.joints.get('Spine2')??this.headBone;
        if(neck){
          this.pelvis.getWorldPosition(_hitFrom);neck.getWorldPosition(_hitTo).sub(_hitFrom);
          const pitch=Math.atan2(_hitTo.x*this.launchHeading.x+_hitTo.z*this.launchHeading.z,_hitTo.y);
          if(!Number.isFinite(this.launchFrom))this.launchFrom=pitch+this.launchCarry;
          const lie=this.launchSide*LAUNCH_LAND;
          const land=lie+Math.PI*2*(this.launchCarry?Math.round((this.launchFrom-lie)/(Math.PI*2)):this.launchTurns);
          const done=Math.min(1,arc/LAUNCH_DONE);
          const path=this.launchFrom+(land-this.launchFrom)*done*(1.35-.35*done);
          this.launchLand=land;this.launchDrawn=path;
          const short=THREE.MathUtils.euclideanModulo(path-pitch+Math.PI,Math.PI*2)-Math.PI;
          this.launchPitch=short*(this.launchCarry?1:THREE.MathUtils.smoothstep(t,0,.08));
        }
      }
      else if(hand>0&&Number.isFinite(this.launchLand)){
        const neck=this.joints.get('Neck')??this.joints.get('Spine2')??this.headBone;
        if(neck){
          this.pelvis.getWorldPosition(_hitFrom);neck.getWorldPosition(_hitTo).sub(_hitFrom);
          const pitch=Math.atan2(_hitTo.x*this.launchHeading.x+_hitTo.z*this.launchHeading.z,_hitTo.y);
          const short=THREE.MathUtils.euclideanModulo(this.launchLand-this.launchDrawn+Math.PI,Math.PI*2)-Math.PI;
          const want=this.launchDrawn+(this.handHold>0?short*THREE.MathUtils.smoothstep(this.reactTime-this.handAt,0,this.handHold):0);
          this.launchPitch+=THREE.MathUtils.euclideanModulo(want-pitch-this.launchPitch+Math.PI,Math.PI*2)-Math.PI;
        }
      }
      tumble=launched?this.launchPitch:this.launchPitch*hand;
      if(this.launchSpin){
        const a=THREE.MathUtils.smoothstep(this.launchArc,.08,LAUNCH_SPUN);
        spin=THREE.MathUtils.euclideanModulo(this.launchSpin*Math.PI*2*a*THREE.MathUtils.smoothstep(t,.06,.2)+Math.PI,Math.PI*2)-Math.PI;
      }
      if(this.spinCarry)spin+=this.spinCarry*(1-THREE.MathUtils.smoothstep(t,0,LAUNCH_UNWIND));
      this.launchLast[0]=jack;this.launchLast[1]=headLag;this.launchLast[2]=limbs;this.launchLast[3]=trail;this.lastSpin=spin;
      const w=this.launchWeight;jack*=w;headLag*=w;tumble*=launched?w:1;trail*=w;limbs*=w;spin*=w;
    }
    const hasLaunch=Math.abs(jack)+Math.abs(tumble)+Math.abs(trail)+Math.abs(limbs)+Math.abs(spin)+Math.abs(roll)>1e-4;
    const root=this.group.position;
    if(real>0&&Number.isFinite(this.staggerRoot.x)){this.staggerVelocity.set(root.x-this.staggerRoot.x,0,root.z-this.staggerRoot.z).divideScalar(real);if(this.staggerVelocity.lengthSq()>900)this.staggerVelocity.set(0,0,0);}
    if(real>0)this.staggerRoot.copy(root);
    const travel=Math.hypot(this.staggerVelocity.x,this.staggerVelocity.z);
    const stepping=state.grounded&&STEPPING_REACTIONS.has(state.action)&&this.legs.length>0&&travel<SKID_SPEED&&travel>(this.staggerWeight>0?STEP_SPEED*.8:STEP_SPEED);
    if(Math.abs(twist)<1e-4&&leanAmount<1e-4&&whipAmount<1e-4&&flingAmount<1e-4&&Math.abs(dip)<1e-4&&shoveAmount<1e-4&&!hasLaunch&&bounce<1e-4&&!stepping&&this.staggerWeight<1e-3){this.staggerWeight=0;return;}
    for(let i=0;i<this.legs.length&&i<this.legAnkles.length;i++)this.legs[i].ankle.getWorldPosition(this.legAnkles[i]);
    const chain=this.leanChain,top=chain.length-1;
    const twistTotal=TWIST_TOTAL[top],tipTotal=TIP_TOTAL[top],foldTotal=FOLD_TOTAL[top];
    const launchAxis=hasLaunch?tipAxis(this.launchHeading,_hitAxisB):undefined;
    leanAmount=lean.length();
    const leanAxis=leanAmount>1e-6?tipAxis(lean,_hitAxis):undefined;
    for(let i=0;i<chain.length;i++){
      _leanWorld.identity();
      if(Math.abs(twist)>1e-5)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,twist*TWIST_SHARE[i]/twistTotal));
      if(leanAxis)_leanWorld.multiply(_leanShare.setFromAxisAngle(leanAxis,leanAmount*LEAN_TIP[i]/tipTotal));
      if(launchAxis){
        if(i===0){
          _leanWorld.multiply(_leanShare.setFromAxisAngle(launchAxis,jack*LAUNCH.hips+tumble+roll));
          if(Math.abs(spin)>1e-5)_leanWorld.multiply(_leanShare.setFromAxisAngle(this.launchHeading,spin));
        }
        else _leanWorld.multiply(_leanShare.setFromAxisAngle(launchAxis,-jack*LAUNCH.fold*FOLD_LAUNCH[i]/foldTotal));
      }
      this.leanBone(chain[i],_leanWorld);
    }
    if(this.headBone){
      _leanWorld.identity();
      if(Math.abs(headYaw)>1e-5)_leanWorld.multiply(_leanShare.setFromAxisAngle(UP,headYaw));
      whipAmount=whip.length();
      if(whipAmount>1e-6)_leanWorld.multiply(_leanShare.setFromAxisAngle(tipAxis(whip,_hitAxisC),whipAmount));
      if(launchAxis)_leanWorld.multiply(_leanShare.setFromAxisAngle(launchAxis,headLag*LAUNCH.head));
      this.leanBone(this.headBone,_leanWorld);
    }
    const flingAxis=flingAmount>1e-4?tipAxis(fling,_hitAxisD):undefined;
    if(flingAxis||hasLaunch){
      for(const name of UPPER_ARMS){
        const bone=this.joints.get(name);if(!bone)continue;
        _leanWorld.identity();
        if(flingAxis)_leanWorld.multiply(_leanShare.setFromAxisAngle(flingAxis,flingAmount));
        if(launchAxis)_leanWorld.multiply(_leanShare.setFromAxisAngle(launchAxis,(limbs+trail*LAUNCH.trail/LAUNCH.arms)*LAUNCH.arms+this.flail(name==='LeftArm'?0:2.1,LAUNCH_FLAIL.arms)));
        this.leanBone(bone,_leanWorld);
      }
    }
    if(launchAxis)for(const leg of this.legs){
      this.leanBone(leg.hip,_leanWorld.setFromAxisAngle(launchAxis,limbs*LAUNCH.legs+trail*.25+this.flail(leg===this.legs[0]?1.0:3.6,LAUNCH_FLAIL.legs)));
      this.leanBone(leg.knee,_leanWorld.setFromAxisAngle(launchAxis,-(limbs+trail*.4)*LAUNCH.knees));
    }
    const standing=state.grounded&&bounce<=1e-4&&this.legs.length>0&&STANDING_REACTIONS.has(state.action);
    if(!standing)shove.set(0,0,0);
    this.staggerSteps(real,stepping,state);
    const moved=(dip>1e-4||shove.lengthSq()>1e-8||bounce>1e-4)&&!!this.pelvis&&!!this.pelvis.parent&&!launched;
    const planted=!launched&&state.grounded&&bounce<=1e-4&&this.legs.length>0&&(standing&&moved||this.staggerWeight>1e-3);
    if(planted)for(let i=0;i<this.legs.length&&i<this.shoveAnkles.length;i++)this.shoveAnkles[i].copy(this.legAnkles[i]).lerp(this.staggerTarget[i],this.staggerWeight);
    if(moved&&this.pelvis&&this.pelvis.parent){
      this.pelvis.getWorldPosition(_leanPoint);
      _leanPoint.x+=shove.x;_leanPoint.z+=shove.z;_leanPoint.y+=bounce-dip-shove.length()*.35;this.bounceDrawn=bounce;
      this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_leanPoint));
      this.pelvis.updateMatrix();
      this.pelvis.matrixWorld.multiplyMatrices(this.pelvis.parent.matrixWorld,this.pelvis.matrix);
    }
    if(planted&&this.pelvis){
      this.pelvis.updateMatrixWorld(true);
      for(let i=0;i<this.legs.length&&i<this.shoveAnkles.length;i++)this.solveLeg(this.legs[i],this.shoveAnkles[i],1);
    }
    this.hipShove.copy(shove);
  }

  private contactPush(real:number,state:PlayerState){
    if(this.isForm)return;
    if(real>0)this.withdrawRejected();
    const want=_pushWant.set(0,0,0);
    let most=PUSH_MOST,lead=-1;
    GUARD.runs=0;
    if(Fighter.contact&&this.dynamics&&state.alive&&!this.ragdoll&&!state.timeStopped){
      const body=this.drawnBody(),hips=body.pelvis,top=body.joints.get('Neck')??body.joints.get('Spine2')??body.headBone;
      if(hips&&top){
        const scale=body===this?1:AWAKENINGS[state.fighter].formScale??1;
        _torsoA.setFromMatrixPosition(hips.matrixWorld).sub(this.push);
        _torsoB.setFromMatrixPosition(top.matrixWorld).sub(this.push);
        const head=body.headBone?_torsoH.setFromMatrixPosition(body.headBone.matrixWorld).sub(this.push):undefined;
        if(head)head.y+=HEAD_LIFT*scale;
        const radius=TORSO_RADIUS[state.fighter]*scale,headRadius=HEAD_RADIUS*scale;
        for(const other of Fighter.drawn){
          const s=other.state;
          const dashing=s.action==='dash';
          if(other===this||!s.alive||!(ATTACK_SLOTS.has(s.action)||dashing)||!(s.actionDuration>0))continue;
          if(s.team!==undefined&&s.team===state.team)continue;
          const dx=_torsoA.x-other.group.position.x,dz=_torsoA.z-other.group.position.z,flat=Math.hypot(dx,dz);
          if(flat>CONTACT_REACH*Math.max(1,scale))continue;
          const move=dashing?undefined:other.moveFor(s) as MoveDefinition&Approach;
          if(move&&(move.style!=='melee'||move.dashThrough))continue;
          const steel=!!move&&(move.spacing!==undefined||Fighter.aroundContact(move,s.actionTime*s.actionDuration));
          const hx=flat>1e-3?dx/flat:Math.sin(other.group.rotation.y),hz=flat>1e-3?dz/flat:Math.cos(other.group.rotation.y);
          const striker=other.drawnBody();
          beginContact(_torsoA,_torsoB,radius,head,headRadius,hx,hz);
          striker.strikeSurfaces(steel,!!move&&move.spacing!==undefined);
          if(move&&striker.pikachuLowStrikeIndex()!==undefined)for(const side of HAND_SIDES){
            const knee=body.joints.get(side+'Leg'),ankle=body.joints.get(side+'Foot');if(!knee||!ankle)continue;
            CONTACT.a.setFromMatrixPosition(knee.matrixWorld).sub(this.push);CONTACT.b.setFromMatrixPosition(ankle.matrixWorld).sub(this.push);CONTACT.radius=.085*scale;CONTACT.hasHead=false;
            striker.strikeSurfaces(steel,!!move&&move.spacing!==undefined);
          }
          const needed=endContact();
          if(move&&!UNTOUCHED.has(state.action))this.touchFrom(other,move,hx,hz,radius);
          if(!this.pushedBy(other,dashing))continue;
          if((striker.armed||!!striker.blades?.length)&&CONTACT.runs>0)most=move?.spacing!==undefined?PUSH_MOST_HOLD:PUSH_MOST_ARMED;
          if(CONTACT.runs>0&&needed>lead){lead=needed;guardContact();}
          if(needed<=0)continue;
          want.x+=hx*(needed+CONTACT_MARGIN);want.z+=hz*(needed+CONTACT_MARGIN);
        }
      }
    }
    const sell=this.sellNow;
    if(sell>1e-4&&Fighter.contact&&!state.timeStopped){want.x+=this.sellDir.x*sell;want.z+=this.sellDir.z*sell;}
    const length=want.length();
    if(length>most)want.multiplyScalar(most/length);
    if(real>0)this.pushBudget=PUSH_RISE*real;
    if(want.lengthSq()>=this.push.lengthSq()){
      const step=_pushStep.subVectors(want,this.push),need=step.length();
      const take=Math.min(need,this.pushBudget);this.pushBudget-=take;
      if(need>1e-9)this.push.addScaledVector(step,take/need);
    }else if(real>0){
      const step=_pushStep.subVectors(want,this.push),need=step.length(),held=this.push.length();
      const away=held>1e-6?Math.max(0,(this.velocity.x*this.push.x+this.velocity.z*this.push.z)/held):0;
      if(need>1e-6)this.push.addScaledVector(step,Math.min(1,(PUSH_FALL+.5*away)*real/need));
      if(GUARD.runs>0){
        const now=this.push.x*GUARD.hx+this.push.z*GUARD.hz,into=contactRun(now);
        if(into>=0){const clear=Math.max(now,Math.min(GUARD.exit[into],most));this.push.x+=GUARD.hx*(clear-now);this.push.z+=GUARD.hz*(clear-now);}
      }
    }
    if(!this.ragdoll){
      const moved=_pushStep.subVectors(this.push,this.pushDrawn);
      if(moved.lengthSq()>1e-12){this.group.position.add(moved);this.pushDrawn.copy(this.push);this.group.updateMatrixWorld(true);}
    }
  }
  static settleContacts(){for(const body of Fighter.drawn)body.contactPush(0,body.state);}
  private pushedBy(other:Fighter,dashing:boolean){
    if(dashing)return this.targetOf(other);
    const s=other.state,seq=s.actionSeq??-1;
    for(const touch of this.touches)if(touch.from===other&&!touch.withdrawn&&(touch.seq===seq||this.reactTime-touch.at<=PUSH_KEEP))return true;
    return LANDED.landed(s.id,seq,this.state.id,s.actionStarted);
  }
  private targetOf(other:Fighter){
    const point=other.targetPoint;
    return !!point&&Math.hypot(point.x-this.group.position.x+this.push.x,point.z-this.group.position.z+this.push.z)<=OPPONENT_MATCH;
  }
  private static aroundContact(move:MoveDefinition,elapsed:number){
    for(const contact of move.contacts)if(elapsed>=contact-TOUCH_BEFORE&&elapsed<=contact+PUSH_AFTER)return true;
    return false;
  }
  private touchFrom(other:Fighter,move:MoveDefinition,hx:number,hz:number,radius:number){
    const s=other.state,elapsed=s.actionTime*s.actionDuration,seq=s.actionSeq??-1,slot=s.action as AttackSlot;
    const arrived=CONTACT.deepest>-TOUCH_REACH;
    for(let index=0;index<move.contacts.length;index++){
      const off=elapsed-move.contacts[index];
      if(off>TOUCH_AFTER||off<(arrived?-TOUCH_BEFORE:0))continue;
      const blow=LANDED.blow(s.id,seq,this.state.id,index);
      let answered=false;
      for(const touch of this.touches)if(touch.from===other&&(touch.seq===seq&&touch.index===index||!!blow&&LANDED.same(LANDED.blow(s.id,touch.seq,this.state.id,touch.index),blow))){answered=true;break;}
      if(answered)continue;
      if(blow?LANDED.refused(blow)||blow.delivered||LANDED.held(blow):!LANDED.guarded(s.id,this.state.id,slot,index,s.actionStarted))continue;
      const point=arrived?CONTACT.point:_touchPoint.copy(_torsoA).lerp(_torsoB,.6);
      if(!arrived){point.x-=hx*radius;point.z-=hz*radius;}
      this.answerTouch(other,move,index,seq,slot,hx,hz,point,!blow);
    }
  }
  private answerTouch(other:Fighter,move:MoveDefinition,index:number,seq:number,slot:AttackSlot,hx:number,hz:number,point:THREE.Vector3,guarded:boolean){
    const s=other.state,chain=slot==='light'?other.rushStage(s):0;
    const finisher=slot==='light'&&chain>=RUSH_STAGES-1;
    const damage=move.schedule?.[index]??(index===move.contacts.length-1&&move.finisherDamage!==undefined?move.finisherDamage:move.damage);
    let ring=-1;
    if(!guarded){
      _touchDir.set(hx,0,hz);
      const height=point.y-this.group.position.y;
      this.hitFreeze=Math.max(this.hitFreeze,finisher?.1:.07);
      ring=this.takeBlow(slot,'melee',index,_touchDir,damage,height,{chain},finisher,undefined,true);
      const form=this.drawnBody();
      if(form!==this){const inner=form.takeBlow(slot,'melee',index,_touchDir,damage,height,{chain},finisher,undefined,true);
        form.touches.push({from:other,seq,index,at:form.reactTime,slot,ring:inner,claimed:false,hx,hz});if(form.touches.length>6)form.touches.shift();}
    }
    this.touches.push({from:other,seq,index,at:this.reactTime,slot,ring,claimed:guarded,hx,hz});
    if(this.touches.length>6)this.touches.shift();
    Fighter.touchLog.push({serial:++Fighter.touchSerial,victim:this.state.id,attacker:s.id,fighter:s.fighter,slot,chain,damage,
      x:point.x,y:point.y,z:point.z,hx,hz,guarded,seq,index});
    if(Fighter.touchLog.length>16)Fighter.touchLog.shift();
  }
  private pikachuLowStrikeIndex():number|undefined {
    if(this.state.fighter!=='pikachu'||!ATTACK_SLOTS.has(this.state.action))return undefined;
    const clip=this.active?.getClip().name??'',time=this.active?.time??0,index=time>2?2:time>.8?1:0;
    return pikachuLowStrikeJoint(clip,index)?index:undefined;
  }
  private tojiBladeMarkers?: { base: THREE.Object3D; tip: THREE.Object3D } | null;
  private strikeSurfaces(steel=true,whole=false){
    if(garouStrikeSurface(this.state.fighter,this.state.action,this.active?.getClip().name,this.active?.time??0,this.isForm,this.joints,contactSurface))return;
    const lowStrike=this.pikachuLowStrikeIndex();
    if(lowStrike!==undefined&&pikachuStrikeSurfaces(this,this.active?.getClip().name??'',lowStrike,contactSurface))return;
    this.knuckles??=HAND_SIDES.map(side=>this.bones.get(`${side.toLowerCase()}handmiddle1`)??this.bones.get(`${side.toLowerCase()}handindex1`));
    for(let side=0;side<2;side++){
      const name=HAND_SIDES[side],hand=this.joints.get(name+'Hand'),elbow=this.joints.get(name+'ForeArm');
      if(hand){
        _strikeP.setFromMatrixPosition(hand.matrixWorld);
        const knuckle=this.knuckles[side];
        if(knuckle)_strikeP.lerp(_strikeQ.setFromMatrixPosition(knuckle.matrixWorld),1.3);
        else if(elbow){
          _strikeTip.subVectors(_strikeP,_strikeQ.setFromMatrixPosition(elbow.matrixWorld));
          const l=_strikeTip.length();if(l>1e-4)_strikeP.addScaledVector(_strikeTip,.08/l);
        }
        contactSurface(_strikeP);
      }
      if(elbow)contactSurface(_strikeP.setFromMatrixPosition(elbow.matrixWorld));
      for(const joint of STRIKE_LEGS[side]){const bone=this.joints.get(joint);if(bone)contactSurface(_strikeP.setFromMatrixPosition(bone.matrixWorld));}
    }
    if(this.state.fighter==='toji'){
      if(this.tojiBladeMarkers===undefined){
        const base=this.model.getObjectByName('TojiBladeBase'),tip=this.model.getObjectByName('TojiBladeTip');
        this.tojiBladeMarkers=base&&tip?{base,tip}:null;
      }
      if(this.tojiBladeMarkers){
        this.tojiBladeMarkers.base.getWorldPosition(_strikeQ);
        this.tojiBladeMarkers.tip.getWorldPosition(_strikeTip);
        this.bladeSurfaces(steel,whole);
        return;
      }
    }
    if(this.state.fighter!=='grimmjow'&&(this.heldWeapons.length===0||this.heldWeapons[0].visible)){
      for(let side=0;side<2;side++){
        const reach=side?this.leftReach:this.rightReach,bone=side?this.leftBone:this.rightBone;
        if(!reach||!bone)continue;
        _strikeTip.copy(reach).applyMatrix4(bone.matrixWorld);_strikeQ.setFromMatrixPosition(bone.matrixWorld);
        this.bladeSurfaces(steel,whole);
      }
      this.blades??=this.findBlades();
      for(const blade of this.blades){
        if(!blade.bone.visible)continue;
        _strikeTip.copy(blade.tip).applyMatrix4(blade.bone.matrixWorld);_strikeQ.setFromMatrixPosition(blade.bone.matrixWorld);
        this.bladeSurfaces(steel,whole);
      }
    }
  }
  private bladeSurfaces(steel:boolean,whole:boolean){
    const length=_strikeTip.distanceTo(_strikeQ),forte=whole?1:Math.min(BLADE_FORTE,BLADE_FORTE_MOST/Math.max(length,1e-3));
    const n=THREE.MathUtils.clamp(Math.ceil(length*(1-BLADE_FROM)/BLADE_STEP)+1,4,40);
    for(let i=0;i<n;i++){const u=BLADE_FROM+(1-BLADE_FROM)*i/(n-1);contactSurface(_strikeP.lerpVectors(_strikeQ,_strikeTip,u),steel&&u<=forte);}
  }
  private mouthBladeBone?:THREE.Object3D|null;
  private mouthBlade(){
    const m=MOUTH_BLADE[this.state.fighter];
    if(!m||this.isForm||!this.headBone)return;
    if(this.mouthBladeBone===undefined)this.mouthBladeBone=this.model.getObjectByName(m.bone)??null;
    const bone=this.mouthBladeBone;
    if(!bone?.parent)return;
    this.headBone.updateMatrixWorld(true);
    _mouthM.compose(_mouthP.fromArray(m.at),_mouthQ.fromArray(m.turn),_mouthS.set(1,1,1));
    _mouthW.multiplyMatrices(this.headBone.matrixWorld,_mouthM);
    bone.parent.updateMatrixWorld(true);
    _mouthW.premultiply(_mouthM.copy(bone.parent.matrixWorld).invert());
    _mouthW.decompose(bone.position,bone.quaternion,bone.scale);
    bone.updateMatrixWorld(true);
  }
  private findBlades(){
    const out:{bone:THREE.Object3D;tip:THREE.Vector3}[]=[];
    const covered=(bone:THREE.Object3D)=>{for(let node:THREE.Object3D|null=bone;node;node=node.parent)if(node===this.rightBone&&this.rightReach||node===this.leftBone&&this.leftReach)return true;return false;};
    const reach=new Map<THREE.Object3D,{tip:THREE.Vector3;length:number}>();
    const world=new THREE.Vector3(),origin=new THREE.Vector3(),inverse=new THREE.Matrix4();
    this.model.updateMatrixWorld(true);
    this.model.traverse(object=>{
      const skin=object as THREE.SkinnedMesh;
      if(!skin.isSkinnedMesh)return;
      const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight,positions=skin.geometry.attributes.position;
      if(!ids||!weights)return;
      for(let i=0;i<positions.count;i+=2){
        let heaviest=0,at=-1;
        for(let j=0;j<4;j++){const w=weights.getComponent(i,j);if(w>heaviest){heaviest=w;at=ids.getComponent(i,j);}}
        const bone=skin.skeleton.bones[at];
        if(!bone||!BLADE_BONE.test(bone.name)||covered(bone))continue;
        skin.getVertexPosition(i,world).applyMatrix4(skin.matrixWorld);
        const distance=world.distanceTo(bone.getWorldPosition(origin));
        let entry=reach.get(bone);
        if(!entry){entry={tip:new THREE.Vector3(),length:0};reach.set(bone,entry);}
        if(distance>entry.length&&distance<2.8){entry.length=distance;entry.tip.copy(world).applyMatrix4(inverse.copy(bone.matrixWorld).invert());}
      }
    });
    for(const [bone,entry] of reach)if(entry.length>BLADE_MIN)out.push({bone,tip:entry.tip});
    return out;
  }

  private staggerSteps(real:number,stepping:boolean,state:PlayerState){
    const n=Math.min(this.legs.length,2);
    if(this.staggerWeight<=0&&!stepping){this.staggerSwing[0]=this.staggerSwing[1]=-1;return;}
    if(this.staggerWeight<=0){for(let i=0;i<n;i++){this.staggerAt[i].copy(this.legAnkles[i]);this.staggerSwing[i]=-1;}this.staggerGathered=0;}
    if(stepping)this.staggerGathered=0;
    const vx=this.staggerVelocity.x,vz=this.staggerVelocity.z;
    let far=-1,most=0,swinging=false;
    for(let i=0;i<n;i++){
      if(this.staggerSwing[i]>=0){swinging=true;continue;}
      const d=Math.hypot(this.staggerAt[i].x-this.legAnkles[i].x,this.staggerAt[i].z-this.legAnkles[i].z);
      if(d>most){most=d;far=i;}
    }
    const gather=!stepping&&this.staggerGathered<STEP_GATHER&&most>STEP_SETTLE;
    if(!swinging&&far>=0&&(stepping&&most>STEP_REACH||gather)){
      this.staggerSwing[far]=0;this.staggerFrom[far].copy(this.staggerAt[far]);swinging=true;
      if(!stepping)this.staggerGathered++;
    }
    const holding=stepping||swinging||gather;
    this.staggerWeight=THREE.MathUtils.clamp(this.staggerWeight+(holding?real/STEP_IN:-real/STEP_FADE),0,1);
    for(let i=0;i<n;i++){
      const target=this.staggerTarget[i],clip=this.legAnkles[i];
      if(this.staggerSwing[i]<0){target.set(this.staggerAt[i].x,clip.y,this.staggerAt[i].z);continue;}
      this.staggerSwing[i]+=real;
      const u=Math.min(1,this.staggerSwing[i]/STEP_TIME),e=u*u*(3-2*u);
      target.set(clip.x+vx*STEP_LEAD*(1-e),clip.y,clip.z+vz*STEP_LEAD*(1-e));
      target.x=this.staggerFrom[i].x+(target.x-this.staggerFrom[i].x)*e;target.z=this.staggerFrom[i].z+(target.z-this.staggerFrom[i].z)*e;
      target.y+=STEP_LIFT*Math.sin(Math.PI*u);
      if(u>=1){
        this.staggerAt[i].copy(target);this.staggerSwing[i]=-1;
        const speed=Math.hypot(vx,vz);
        if(speed>STEP_AUDIBLE){this.steps.push({x:target.x,y:this.groundY,z:target.z,speed});if(this.steps.length>4)this.steps.shift();}
      }
    }
    if(state.action==='guard'||!state.grounded)this.staggerWeight=0;
  }

  private releaseRubber(real:number){
    if(this.rubberRelease<0)return;
    this.rubberRelease+=real;
    const x=1-THREE.MathUtils.smoothstep(this.rubberRelease,0,RUBBER.release);
    if(this.rubberRelease>RUBBER.release){this.rubberRelease=-1;return;}
    this.group.updateMatrixWorld(true);
    if(this.pelvis?.parent&&this.rubberGive.lengthSq()>1e-8){
      this.pelvis.getWorldPosition(_rubberPelvis).addScaledVector(this.rubberGive,x);
      this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_rubberPelvis));
      this.pelvis.updateMatrixWorld(true);
    }
    for(let which=0;which<2;which++){
      const hand=this.joints.get(HAND_SIDES[which]+'Hand'),offset=this.rubberOffset[which];
      if(!hand?.parent||offset.lengthSq()<1e-8)continue;
      hand.getWorldPosition(_rubberWrist).addScaledVector(offset,x);
      hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(_rubberWrist)));
      hand.updateMatrixWorld(true);
    }
  }
  private bazookaBack(elapsed:number,plan:[string,number][],real:number,wound:{back:number;rise:readonly [number,number];shake:number;rate:number}=BAZOOKA){
    const grow=THREE.MathUtils.smoothstep(elapsed,wound.rise[0],wound.rise[1]);
    if(grow<1e-3){this.releaseRubber(real);return;}
    this.group.updateMatrixWorld(true);
    _bazookaFacing.set(Math.sin(this.facing),0,Math.cos(this.facing));
    this.rubberEpoch=this.actionEpoch;this.rubberRelease=-1;this.rubberGive.set(0,0,0);
    const held=THREE.MathUtils.smoothstep(elapsed,wound.rise[1]-.04,wound.rise[1]+.04);
    for(const [side] of plan){
      const fore=this.joints.get(side+'ForeArm'),hand=this.joints.get(side+'Hand'),which=side==='Right'?0:1;
      if(!fore||!hand?.parent)continue;
      const elbow=fore.getWorldPosition(_rubberElbow),wrist=hand.getWorldPosition(_rubberWrist);
      const forearm=elbow.distanceTo(wrist);if(forearm<1e-3)continue;
      const along=_rubberAlong.subVectors(wrist,elbow).divideScalar(forearm);
      const backward=THREE.MathUtils.clamp(-along.dot(_bazookaFacing)*1.4,0,1);
      const shake=Math.sin(elapsed*wound.rate*2*Math.PI+which*1.9)*wound.shake*held;
      const extend=(grow*wound.back*forearm+shake)*backward;
      wrist.addScaledVector(along,extend);
      this.rubberOffset[which].copy(along).multiplyScalar(extend);
      hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(wrist)));
      hand.updateMatrixWorld(true);
      this.rubberSpan=Math.max(this.rubberSpan,fore.getWorldPosition(_rubberElbow).distanceTo(wrist)/forearm);
    }
  }
  private gatlingStretch(state:PlayerState){
    const move=this.moveFor(state),contacts=move.contacts,elapsed=state.actionTime*state.actionDuration;
    this.group.updateMatrixWorld(true);
    const other=this.opponentBody(),surface=other?TORSO_RADIUS[other.state.fighter]+RUBBER_KNUCKLES:RUBBER.surface;
    const target=other?other.restCenter(_rubberTarget):this.targetPoint?_rubberTarget.copy(this.targetPoint).addScaledVector(UP,-.2)
      :_rubberTarget.set(Math.sin(this.facing),0,Math.cos(this.facing)).multiplyScalar(GATLING.ahead).add(this.group.position).addScaledVector(UP,1.2);
    for(let which=0;which<2;which++){
      let reach=0;
      for(let i=which;i<contacts.length;i+=2){
        const u=elapsed-(contacts[i]-GATLING.out);
        if(u<0)break;
        if(u<GATLING.out){const v=u/GATLING.out;reach=1-(1-v)*(1-v)*(1-v);break;}
        if(u<GATLING.out+GATLING.hold){reach=1;break;}
        if(u<GATLING.out+GATLING.hold+GATLING.back){const v=(u-GATLING.out-GATLING.hold)/GATLING.back;reach=1-v*v*(3-2*v);break;}
      }
      if(reach<1e-3)continue;
      const side=HAND_SIDES[which],fore=this.joints.get(side+'ForeArm'),hand=this.joints.get(side+'Hand');
      if(!fore||!hand?.parent)continue;
      const elbow=fore.getWorldPosition(_rubberElbow),wrist=hand.getWorldPosition(_rubberWrist);
      const forearm=elbow.distanceTo(wrist);if(forearm<1e-3)continue;
      const along=_rubberAlong.subVectors(wrist,elbow).divideScalar(forearm);
      const toward=_rubberToward.subVectors(target,wrist),distance=toward.length();
      if(distance>1e-3)toward.divideScalar(distance);else toward.copy(along);
      const angle=Math.min(GATLING.aim,along.angleTo(toward)),axis=_rubberAxis.crossVectors(along,toward);
      if(axis.lengthSq()<1e-10)axis.copy(UP);
      const dir=angle>1e-4?_rubberDir.copy(along).applyQuaternion(_rubberTurn.setFromAxisAngle(axis.normalize(),angle)):_rubberDir.copy(along);
      wrist.addScaledVector(dir,THREE.MathUtils.clamp(distance-surface,GATLING.min,move.range)*reach);
      hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(wrist)));
      hand.updateMatrixWorld(true);
      this.rubberSpan=Math.max(this.rubberSpan,fore.getWorldPosition(elbow).distanceTo(wrist)/forearm);
    }
  }
  private grabAt=new THREE.Vector3();private grabSurface=0;private grabCast=-1;private grabHeld=false;
  private bajrangGrabStretch(state:PlayerState){
    const move=this.moveFor(state),phase=bajrangGrab(state,move.contacts[0]),G=BAJRANG_GRAB;
    if(this.grabCast!==state.actionStarted){this.grabCast=state.actionStarted;this.grabHeld=false;}
    if(phase.reach===undefined&&(phase.back===undefined||phase.back>.4))return;
    this.group.updateMatrixWorld(true);
    const fore=this.joints.get('RightForeArm'),hand=this.joints.get('RightHand');
    if(!fore||!hand?.parent)return;
    const elbow=fore.getWorldPosition(_rubberElbow),wrist=hand.getWorldPosition(_rubberWrist);
    const forearm=elbow.distanceTo(wrist);if(forearm<1e-3)return;
    const along=_rubberAlong.subVectors(wrist,elbow).divideScalar(forearm);
    if(phase.follow||!this.grabHeld){
      const other=this.opponentBody();
      if(other){other.restCenter(this.grabAt);this.grabSurface=TORSO_RADIUS[other.state.fighter]??RUBBER.surface;}
      else if(this.targetPoint??this.owner?.targetPoint){this.grabAt.copy((this.targetPoint??this.owner!.targetPoint)!).addScaledVector(UP,-.2);this.grabSurface=RUBBER.surface;}
      else{this.group.getWorldPosition(this.grabAt).addScaledVector(this.group.getWorldDirection(_grabForward).setY(0).normalize(),G.ahead).addScaledVector(UP,1.2);this.grabSurface=0;}
      this.grabHeld=true;
    }
    const toward=_rubberToward.subVectors(this.grabAt,wrist),distance=toward.length();
    if(distance>1e-3)toward.divideScalar(distance);else toward.copy(along);
    const angle=Math.min(G.aim,along.angleTo(toward)),axis=_rubberAxis.crossVectors(along,toward);
    if(axis.lengthSq()<1e-10)axis.copy(UP);
    const dir=angle>1e-4?_rubberDir.copy(along).applyQuaternion(_rubberTurn.setFromAxisAngle(axis.normalize(),angle)):_rubberDir.copy(along);
    const facing=this.group.getWorldDirection(_grabForward).setY(0).normalize();
    const ahead=THREE.MathUtils.smoothstep(along.dot(facing),-.1,.6);
    const full=THREE.MathUtils.clamp(distance-this.grabSurface+G.grip,G.min,move.range);
    let extend=full*(phase.reach!==undefined?phase.reach*ahead:Fighter.rubberRecoil(phase.back!));
    if(extend<0)extend=-RUBBER.squash*Math.tanh(-extend/RUBBER.squash);
    wrist.addScaledVector(dir,extend);
    hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(wrist)));
    hand.updateMatrixWorld(true);
    this.rubberSpan=Math.max(this.rubberSpan,fore.getWorldPosition(elbow).distanceTo(wrist)/forearm);
  }
  private rubberKey(state:PlayerState){
    const ender=Fighter.ender(state);
    return ender?'ender-'+ender:state.action+this.rushStage(state);
  }
  private rubberLimbs(state:PlayerState,real=0){
    this.rubberSpan=0;
    if(state.fighter!=='luffy'||!this.dynamics)return;
    if(this.swap){this.releaseRubber(real);return;}
    const gatling=state.action==='special'&&!Fighter.ender(state)&&state.actionDuration>0;
    const stretching=!gatling&&ATTACK_SLOTS.has(state.action)&&!!RUBBER_HANDS[this.rubberKey(state)];
    if(this.rubberEpoch>=0&&(!stretching||this.rubberEpoch!==this.actionEpoch)){this.rubberEpoch=-1;this.rubberRelease=0;}
    if(!stretching){this.releaseRubber(real);}
    if(gatling){this.gatlingStretch(state);return;}
    if(state.action==='ultimate'){this.bajrangGrabStretch(state);return;}
    const elapsed=state.actionTime*state.actionDuration;
    const plan=ATTACK_SLOTS.has(state.action)?RUBBER_HANDS[this.rubberKey(state)]:undefined;
    if(!plan||!state.actionDuration)return;
    const move=this.moveFor(state),contact=move.contacts[0];
    const bazooka=state.action==='heavy'&&!Fighter.ender(state)&&state.grounded;
    const stage=state.action==='light'?this.rushStage(state):-1;
    const pistol=!this.isForm&&!Fighter.ender(state)&&(stage===0&&state.grounded||stage===3);
    const wound=bazooka?BAZOOKA:pistol?PISTOL:undefined;
    const OUT=wound?wound.out:RUBBER.out,HOLD=bazooka?BAZOOKA.hold:RUBBER.hold;
    const u=elapsed-(contact-OUT);
    if(wound&&u<=0){this.rubberLocked[0]=this.rubberLocked[1]=false;this.rubberGiven=0;this.bazookaBack(elapsed,plan,real,wound);return;}
    if(u<=0||u>OUT+HOLD+.4){this.rubberLocked[0]=this.rubberLocked[1]=false;this.rubberGiven=0;this.releaseRubber(real);return;}
    this.rubberEpoch=this.actionEpoch;this.rubberRelease=-1;this.rubberGive.set(0,0,0);this.rubberOffset[0].set(0,0,0);this.rubberOffset[1].set(0,0,0);
    let reach:number;
    if(u<OUT){const v=u/OUT;reach=1-(1-v)*(1-v)*(1-v);}
    else if(u<OUT+HOLD)reach=1;
    else reach=Fighter.rubberRecoil(u-OUT-HOLD);
    this.group.updateMatrixWorld(true);
    const other=this.opponentBody(),surface=other?TORSO_RADIUS[other.state.fighter]+RUBBER_KNUCKLES:RUBBER.surface;
    const target=other?other.restCenter(_rubberTarget):this.targetPoint?_rubberTarget.copy(this.targetPoint).addScaledVector(UP,-.2)
      :_rubberTarget.set(Math.sin(this.facing),0,Math.cos(this.facing)).multiplyScalar(3).add(this.group.position).addScaledVector(UP,1.2);
    const mirrored=!!this.active&&!!mirrorSource(this.active.getClip());
    if(wound)_bazookaFacing.set(Math.sin(this.facing),0,Math.cos(this.facing));
    if(bazooka){
      const r=this.joints.get('RightArm'),l=this.joints.get('LeftArm');
      if(r&&l){r.getWorldPosition(_bazookaSide);l.getWorldPosition(_bazookaShoulder);_bazookaSide.sub(_bazookaShoulder).setY(0);if(_bazookaSide.lengthSq()>1e-8)_bazookaSide.normalize();}
    }
    let first=true;
    for(const [side,share] of plan){
      const name=mirrored?(side==='Right'?'Left':'Right'):side;
      const fore=this.joints.get(name+'ForeArm'),hand=this.joints.get(name+'Hand');
      if(!fore||!hand||!hand.parent)continue;
      const elbow=fore.getWorldPosition(_rubberElbow),wrist=hand.getWorldPosition(_rubberWrist);
      const forearm=elbow.distanceTo(wrist);if(forearm<1e-3)continue;
      const along=_rubberAlong.subVectors(wrist,elbow).divideScalar(forearm);
      const aim=bazooka?_bazookaTarget.copy(target).addScaledVector(_bazookaSide,(name==='Right'?.5:-.5)*BAZOOKA.apart):target;
      const toward=_rubberToward.subVectors(aim,wrist);
      const distance=toward.length();
      if(distance>1e-3)toward.divideScalar(distance);else toward.copy(along);
      const out=u<OUT,which=name==='Right'?0:1;
      let dir:THREE.Vector3;
      if(out||!this.rubberLocked[which]){
        const angle=Math.min(RUBBER.aim,along.angleTo(toward))*Math.max(0,Math.min(1,reach));
        dir=angle>1e-4?_rubberDir.copy(along).applyQuaternion(_rubberTurn.setFromAxisAngle(_rubberAxis.crossVectors(along,toward).normalize(),angle)):_rubberDir.copy(along);
        this.rubberLine[which].copy(dir);this.rubberLocked[which]=!out&&(!wound||along.dot(_bazookaFacing)>.2);
      }else dir=_rubberDir.copy(this.rubberLine[which]);
      const gap=Math.max(0,distance-surface);
      let length=THREE.MathUtils.clamp(gap,RUBBER.min*forearm,RUBBER.max*forearm);
      if(first&&length>gap&&this.pelvis?.parent){
        const lean=u<RUBBER.out?THREE.MathUtils.smoothstep(u/RUBBER.out,0,1):reach;
        const want=Math.min(RUBBER.pull,length-gap)*Math.max(0,Math.min(1,lean)),rate=RUBBER.pull/RUBBER.out*real;
        this.rubberGiven+=THREE.MathUtils.clamp(want-this.rubberGiven,-rate,rate);
        const give=this.rubberGiven;
        this.rubberGive.copy(_rubberBack.set(dir.x,0,dir.z).normalize()).multiplyScalar(-give);
        this.pelvis.getWorldPosition(_rubberPelvis).add(this.rubberGive);
        this.pelvis.position.copy(this.pelvis.parent.worldToLocal(_rubberPelvis));
        this.pelvis.updateMatrixWorld(true);
        length=Math.min(length,gap+Math.min(RUBBER.pull,length-gap));
        hand.getWorldPosition(wrist);
      }
      first=false;
      const ahead=wound?along.dot(_bazookaFacing):1;
      let extend=length*reach*share*(wound?THREE.MathUtils.smoothstep(ahead,-.15,.55):1);
      if(extend<0)extend=-RUBBER.squash*Math.tanh(-extend/RUBBER.squash);
      wrist.addScaledVector(dir,extend);
      this.rubberOffset[which].copy(dir).multiplyScalar(extend);
      if(wound&&ahead<0&&u<OUT+HOLD){const back=wound.back*forearm*THREE.MathUtils.clamp(-ahead*1.4,0,1);wrist.addScaledVector(along,back);this.rubberOffset[which].addScaledVector(along,back);}
      hand.position.copy(hand.parent.worldToLocal(_rubberLocal.copy(wrist)));
      hand.updateMatrixWorld(true);
      this.rubberSpan=Math.max(this.rubberSpan,fore.getWorldPosition(elbow).distanceTo(wrist)/forearm);
    }
  }

  private aimHead(dt:number,state:PlayerState){
    if(state.fighter==='pikachu')return;
    const head=this.headBone;
    if(!head)return;
    const wanted=this.targetPoint&&state.alive&&Fighter.AIM_STATES.includes(state.action)?1:0;
    this.aimWeight=dt>0?THREE.MathUtils.lerp(this.aimWeight,wanted,1-Math.exp(-dt*7)):this.aimWeight;
    if(this.aimWeight<.002||!this.targetPoint)return;
    const local=this.group.worldToLocal(_aimTarget.copy(this.targetPoint));
    const origin=this.group.worldToLocal(head.getWorldPosition(_aimOrigin));
    const direction=local.sub(origin);
    if(direction.lengthSq()<1e-6)return;
    direction.normalize();
    const wantYaw=THREE.MathUtils.clamp(Math.atan2(direction.x,direction.z),-AIM_YAW,AIM_YAW);
    const wantPitch=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(direction.y,-1,1)),-AIM_PITCH,AIM_PITCH);
    const most=AIM_RATE*Math.max(dt,0);
    this.aimYaw+=THREE.MathUtils.clamp((wantYaw-this.aimYaw)*(1-Math.exp(-dt*14)),-most,most);
    this.aimPitch+=THREE.MathUtils.clamp((wantPitch-this.aimPitch)*(1-Math.exp(-dt*14)),-most,most);
    const yaw=this.aimYaw,pitch=this.aimPitch;
    _aimDirection.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
    _aimSwing.setFromUnitVectors(FORWARD,_aimDirection);
    const groupQuaternion=this.group.getWorldQuaternion(_aimGroup);
    for(const [bone,share] of (this.neckBone?[[this.neckBone,.35],[head,.65]]:[[head,1]]) as readonly (readonly [THREE.Bone|undefined,number])[]){
      if(!bone||!bone.parent)continue;
      _aimShare.identity().slerp(_aimSwing,share*this.aimWeight);
      _aimWorld.copy(groupQuaternion).multiply(_aimShare).multiply(_aimInverse.copy(groupQuaternion).invert());
      bone.parent.getWorldQuaternion(_aimParent);
      _aimParentInverse.copy(_aimParent).invert();
      _aimLocal.copy(_aimParentInverse).multiply(_aimWorld).multiply(_aimParent).multiply(bone.quaternion);
      bone.quaternion.copy(_aimLocal);
      bone.updateMatrix();
      bone.matrixWorld.multiplyMatrices(bone.parent.matrixWorld,bone.matrix);
    }
  }
  private findHeldEquipment(idle:THREE.AnimationClip|undefined){
    if(!idle)return;
    const hands=[this.joints.get('LeftHand'),this.joints.get('RightHand')].filter(Boolean) as THREE.Object3D[];
    if(!hands.length)return;
    const carried=new Set<THREE.Object3D>();
    for(const hand of hands)hand.traverse(node=>{if(node!==hand)carried.add(node);});
    if(!carried.size)return;
    const skinned=new Set<THREE.Object3D>();
    this.model.traverse(object=>{
      const skin=object as THREE.SkinnedMesh;
      if(!skin.isSkinnedMesh)return;
      const ids=skin.geometry.attributes.skinIndex,weights=skin.geometry.attributes.skinWeight;
      if(!ids||!weights)return;
      for(let i=0;i<ids.count;i++)for(let j=0;j<4;j++){
        if(weights.getComponent(i,j)<=.1)continue;
        const bone=skin.skeleton.bones[ids.getComponent(i,j)];
        if(bone&&carried.has(bone))skinned.add(bone);
      }
    });
    for(const track of this.samplersFor(idle)){
      if(track.property!=='position'||!skinned.has(track.node))continue;
      const value=track.interpolant.evaluate(0) as unknown as number[];
      this.heldPins.push({node:track.node,position:new THREE.Vector3(value[0],value[1],value[2])});
    }
  }
  private pinHeldEquipment(){
    for(const pin of this.heldPins){
      if(this.state.fighter==='byakuya'&&this.state.action==='awaken'&&pin.node.name==='Sword')continue;
      if(pin.node.position.distanceToSquared(pin.position)>HELD_SLACK*HELD_SLACK)pin.node.position.copy(pin.position);
    }
  }

  private driveRagdoll(state:PlayerState,real:number){
    const dying=state.action==='defeated'||!state.alive;
    if(!dying){
      if(this.ragdoll){this.ragdoll.dispose();this.ragdoll=undefined;this.lastWorldAt=-1;}
      this.deathSettle=0;this.deathClock=0;
      return;
    }
    if(!this.ragdoll){
      if(!ragdollsReady())return;
      this.group.updateMatrixWorld(true);
      const floor=state.grounded?this.group.position.y:0;
      const doll=new Ragdoll(this.joints,this.deathVelocity,floor);
      if(!doll.built){doll.dispose();return;}
      this.ragdoll=doll;
    }
    const step=state.timeStopped||state.hitstop?0:real;
    this.ragdoll.update(step);
    this.deathClock+=step;
    if(this.deathClock>1.2&&this.ragdoll.restless()<.6||this.deathClock>4)this.deathSettle=Math.min(1,this.deathSettle+step/.7);
    if(this.deathSettle>0){
      const downed=this.clip('reaction downed');
      if(downed){
        const weight=this.deathSettle*this.deathSettle*(3-2*this.deathSettle);
        for(const track of this.samplersFor(downed)){
          if(track.property!=='quaternion'||track.node===this.rootBone||!this.bodyJointSet.has(track.node as THREE.Object3D))continue;
          _blendTarget.fromArray(track.interpolant.evaluate(0) as unknown as number[]);
          (track.node as THREE.Object3D).quaternion.slerp(_blendTarget,weight);
        }
      }
    }
  }
  get settledDead(){return this.deathSettle;}

  motionEvidence(){const relative=(b:THREE.Object3D|undefined)=>b?this.group.worldToLocal(b.getWorldPosition(new THREE.Vector3())).toArray():null;return {model:this.isForm?FIGHTERS[this.state.fighter].formModel:this.outfit?.model??FIGHTERS[this.state.fighter].model,modelVisible:this.model.visible,formVisible:this.gear4?.group.visible??false,formClip:this.gear4?.active?.getClip().name,formClipTime:this.gear4?.active?.time,formSpeed:this.gear4?.locomotionSpeed,formLift:Number(this.formLiftDrawn.toFixed(3)),formHover:this.gear4?Number(this.formHover.toFixed(3)):undefined,formOffset:this.gear4?Number(this.gear4.group.position.y.toFixed(3)):undefined,formSole:this.gear4?.group.visible?Number((this.formSole()??NaN).toFixed(3)):undefined,action:this.state.action,elapsed:this.state.actionTime*this.state.actionDuration,duration:this.state.actionDuration,clip:this.active?.getClip().name,clipTime:this.active?.time,clipRate:this.active?.timeScale,soleGap:Number(this.soleGap.toFixed(4)),springBones:this.secondary?.boneCount??0,springSwing:this.secondary?.swingDegrees??0,aim:Number(this.aimWeight.toFixed(3)),rootOffset:Number(this.rootOffset.toFixed(3)),hold:Number(this.chargeHold.toFixed(3)),life:Number(this.holdWeight.toFixed(3)),rubber:Number(this.rubberSpan.toFixed(3)),handR:relative(this.rightBone),head:relative(this.headBone),drawn:[Number(this.group.position.x.toFixed(3)),Number(this.group.position.z.toFixed(3))],blend:this.blendDuration>0?Number(Math.min(1,this.blendTime/this.blendDuration).toFixed(3)):undefined};}
  private authoredHover(state:PlayerState):boolean {return state.fighter==='tatsumaki'&&tatsumakiAuthoredHover(this.active?.getClip().name);}
  private authoredFloorStrike(state:PlayerState):boolean {
    if(!state.grounded||!ATTACK_SLOTS.has(state.action))return false;
    if(state.fighter==='alphonse-elric')return alphonseAuthoredGround(this.active?.getClip().name??'',this.active?.time??0);
    if(state.fighter==='edward-elric')return edwardAuthoredGround(this.active?.getClip().name);
    if(state.fighter!=='sakura')return false;
    const clip=this.active?.getClip().name;
    return clip==='Cherry Blossom Clash'||clip==='Shattering Blossom'||clip==='Aerial Blossom'||clip==='Blossom Descent'||clip==='Cherry Blossom Hurricane';
  }
  private authoredStep(state:PlayerState):boolean {
    if(!state.grounded||!ATTACK_SLOTS.has(state.action))return false;
    if(state.fighter==='shinji')return (this.active?.getClip().name==='Rush 1'&&(this.active?.time??0)>.005&&(this.active?.time??0)<.463)||(this.active?.getClip().name==='Pylon Breaker'&&(this.active?.time??0)>.02&&(this.active?.time??0)<.85);
    if(state.fighter==='might-guy')return mightGuyAuthoredRushStep(this.active?.getClip().name??'',this.active?.time??0);
    if(state.fighter==='garou')return garouAuthoredContactStep(this.active?.getClip().name,this.active?.time??0,this.isForm)>0;
    if(state.fighter==='alphonse-elric')return alphonseAuthoredShoulderStep(this.active?.getClip().name??'',this.active?.time??0);
    if(state.fighter==='ken-kaneki')return kanekiAuthoredJabStep(this.active?.getClip().name??'',this.active?.time??0);
    return this.mikasaCarry(state);
  }
  private static readonly MIKASA_STRIDE_TAKES:ReadonlySet<string>=new Set(['Scout Slash','Rush 1','Rush 3','Crossed Blades']);
  private static readonly stepped=new WeakMap<THREE.AnimationClip,boolean>();
  private mikasaCarry(state:PlayerState):boolean{
    const clip=this.active?.getClip();
    if(state.fighter!=='mikasa'||!clip||!(mikasaAuthoredContactCarry(clip.name,this.active?.time??0)>0))return false;
    return !Fighter.MIKASA_STRIDE_TAKES.has(clip.name)||this.stepsItself(clip);
  }
  private stepsItself(clip:THREE.AnimationClip):boolean{
    let stepped=Fighter.stepped.get(clip);
    if(stepped===undefined){
      const values=this.rootBone?clip.tracks.find(track=>track.name===`${this.rootBone!.name}.position`)?.values:undefined;
      let ahead=0;
      if(values)for(let i=0;i<values.length;i+=3)ahead=Math.max(ahead,values[i+2]-values[2]);
      Fighter.stepped.set(clip,stepped=ahead>.3);
    }
    return stepped;
  }
  private authoredKick(state:PlayerState):boolean {
    if(!ATTACK_SLOTS.has(state.action))return false;
    if(state.fighter==='sanji')return true;
    if(state.fighter==='asuka'){const clip=this.active?.getClip();return !!clip&&asukaAuthoredKick(clip.name,(this.active?.time??0)/Math.max(1e-6,clip.duration));}
    if(state.fighter==='might-guy')return mightGuyAuthoredKick(this.active?.getClip().name??'');
    if(state.fighter==='alphonse-elric')return alphonseAuthoredKick(this.active?.getClip().name??'');
    if(state.fighter==='edward-elric')return edwardAuthoredKick(this.active?.getClip().name);
    if(state.fighter==='aokiji')return aokijiStrikeJoint(state.action,this.active?.time,this.active?.getClip().name)==='LeftFoot';
    if(state.fighter==='doflamingo')return doflamingoAuthoredKick(this.active?.getClip().name);
    if(state.fighter==='blackbeard')return blackbeardAuthoredKick(this.active?.getClip().name,this.outfitId??state.outfit,this.active?.time??0);
    if(state.fighter==='tsunade')return tsunadeAuthoredKick(state.action,this.active?.time??0,this.active?.getClip().name);
    if(state.fighter==='kizaru')return kizaruAuthoredKick(this.active?.getClip().name,this.active?.time??0);
    if(state.fighter==='deku'){const clip=this.active?.getClip().name;return clip==='St Louis Smash'||clip==='Rush 3'||clip==='Manchester Smash'||clip==='Shoot Style Aerial';}
    if(state.fighter!=='yoruichi')return false;
    const clip=this.active?.getClip().name;
    return clip==='Flash Heel'||clip==='Aerial Flash Heel'||clip==='Rush 3'||clip==='Thunder Heel';
  }
  standSource?:Fighter;
  private edwardBlade?:THREE.Object3D;
  private selectEdwardBlade(state:PlayerState){
    if(state.fighter!=='edward-elric')return;
    this.edwardBlade??=this.model.getObjectByName('edward_automail_blade');
    if(this.edwardBlade)this.edwardBlade.visible=edwardBladeVisible(this.active?.getClip().name??'_Idle',this.active?.time??0,state.awakened);
  }
  private escanorRhitta?:THREE.Object3D;
  private selectEscanorRhitta(state:PlayerState){
    if(state.fighter!=='escanor')return;
    this.escanorRhitta??=this.model.getObjectByName('Escanor_Rhitta');
    if(this.escanorRhitta)this.escanorRhitta.visible=escanorRhittaVisible(state.action,state.action==='awaken'?state.actionTime*state.actionDuration:this.active?.time??0,this.active?.getClip().name);
  }
  private socketAsk?:SocketAsk;
  private socket(kind:SocketKind,out:THREE.Vector3,index?:number){
    if(!FIGHTER_SOCKETS[this.state.fighter])return false;
    const ask=this.socketAsk??=socketAsk(this,()=>this.moveFor(this.state).contacts,Fighter.ender);
    const shown=this.shownBody,active=this.active,drawn=shown.active;
    ask.shown=shown;ask.state=this.state;ask.index=index;ask.form=this.isForm;ask.shownForm=shown.isForm;
    ask.clip=active?.getClip().name;ask.time=active?.time;ask.phase=active?active.time/active.getClip().duration:0;
    ask.shownClip=drawn?.getClip().name;ask.shownTime=drawn?.time??0;ask.shownPhase=(drawn?.time??0)/Math.max(1e-6,drawn?.getClip().duration??1);
    ask.elapsed=this.state.actionTime*this.state.actionDuration;ask.formBody=this.gear4?.group.visible?this.gear4:undefined;
    ask.head=this.headBone;ask.rightHand=this.rightBone;
    return placeSocket(kind,ask,out);
  }
  chargePosition(out:THREE.Vector3):THREE.Vector3{return this.socket('charge',out)?out:out.copy(this.handR);}
  strikePoint(out:THREE.Vector3):THREE.Vector3{
    if(this.socket('strike',out))return out;
    if(this.rightReach&&this.rightBone)return out.copy(this.rightReach).applyMatrix4(this.rightBone.matrixWorld);
    return out.copy(this.handR);
  }
  get armed(){return !FIGHTER_SOCKETS[this.state.fighter]?.unarmed&&!!this.rightReach;}
  meleeContactPoint(index:number,out:THREE.Vector3){return this.socket('contact',out,index);}
  dispose(){
    Fighter.drawn.delete(this);
    this.ragdoll?.dispose();this.ragdoll=undefined;
    this.gear4?.dispose();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);this.group.removeFromParent();
    disposeSkeletons(this.model);
    for(const m of this.outlineMaterials)m.dispose();
    const shadow=this.group.getObjectByName('contact-shadow') as THREE.Mesh<THREE.CircleGeometry,THREE.MeshBasicMaterial>;
    shadow.geometry.dispose();shadow.material.dispose();
  }
}
