import * as THREE from 'three';
import {AWAKENINGS,AWAKENING_ENTRY,awakeningSwapAt,moveFor} from '../game/awakening';
import {awakenBeat,AWAKEN_BLEND_IN,AWAKEN_ORBIT_SHARE} from './awakenBeat';
import {CLOSE_SHOT} from './closeStyle';
import {loomTop} from './loomRegistry';
import {MOVES,RUSH_STAGES} from '../game/moves';
import {HIT_FOR,type PlayKind} from './CameraBrain';
import {TIME_STOP_TOURS} from '../game/timeStopBarrage';
import {rollerAt,ROLLER_TIMING} from './signature/RoadRoller';
import type {Fighter} from './Fighter';
import type {CombatEvent,FighterId} from '../game/types';

export type ShotKind='none'|'intro'|'victory'|'ultimate'|'awaken'|'ko'|'impact'|'opener';

const wrapped=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const ease=(x:number)=>{const t=x<0?0:x>1?1:x;return t*t*t*(t*(t*6-15)+10);};
const blend=(rate:number,dt:number)=>1-Math.exp(-rate*dt);
const softMax=(a:number,b:number,k:number)=>(a+b+Math.sqrt((a-b)*(a-b)+k*k))/2;

const HERO_ANGLE=1.05,HERO_FROM=3.3,HERO_TO=2.7,HERO_EYE=-.45,HERO_LOOK=.25,HERO_FOV=42,HERO_IN=.58,HERO_OUT=.52,HERO_MIN=.8,HERO_MAX=1.45;
const OPENER_PUSH=.18,OPENER_NEAREST=2.4,OPENER_FOV=4,OPENER_IN=.2,OPENER_OUT=.28,OPENER_MOST=1.6;
const HERO_WIDE=1.55,HERO_HIGH=1.3;
type HeroFraming={angle:number;eye:number;from:number;to:number};
const HERO_FRAMINGS:readonly HeroFraming[]=[
  {angle:HERO_ANGLE,eye:HERO_EYE,from:HERO_FROM,to:HERO_TO},
  {angle:HERO_WIDE,eye:HERO_EYE,from:HERO_FROM,to:HERO_TO},
  {angle:HERO_ANGLE,eye:HERO_HIGH,from:HERO_FROM+.5,to:HERO_TO+.5},
];
const HERO_HOLD=.7,HERO_HOLD_LEAST=.35,RELEASE_BEHIND=.85,RELEASE_CLOSE=.25,RELEASE_R=1.9,RELEASE_EYE=.3,RELEASE_X=.3,RELEASE_FOV=52,RELEASE_FOV_MOST=68,RELEASE_REACH=4.5,RELEASE_REACH_CHARGE=6,RELEASE_TURN=.15,RELEASE_WIDEST=1.5,RELEASE_LINGER=.4,RELEASE_AHEAD=6,RELEASE_HOLD_LEAST=.4,RELEASE_TOP=.6,RELEASE_FEET=.45;
const AIM_SPEED=6.5;
const SWING_CLEAR=1.1;
const IMPACT_ANGLE=1.15,IMPACT_WIDE=1.6,IMPACT_R=3.4,IMPACT_EYE=.3,IMPACT_FOV=48,IMPACT_HOLD=.45,IMPACT_OUT=.6,IMPACT_IN=.3,IMPACT_CARRY=.9,IMPACT_RANGE=24;
const WORLD_UP=new THREE.Vector3(0,1,0);
const FIELD_R=3.6,FIELD_SPREAD=.85,FIELD_NEAREST=4.4,FIELD_EYE=.52,FIELD_TOWARD=.4,FIELD_EASE=5,FIELD_DRIFT=.1,FIELD_PUSH=.14,FIELD_FOV=48,FIELD_FOV_MOST=68,FIELD_REACH=13,FIELD_MARGIN=.84,TOUR_LINGER=.85,TOUR_SWING=.75,TOUR_HOLD_LEAST=.2;
const ROLLER_TOP=3.25,ROLLER_EASE=.45;
const CHARGE_FOV=56,CHARGE_FOV_MOST=62,CHARGE_TOP=.85,CHARGE_TOP_EDGE=.05,CHARGE_FOOT_EDGE=.12,CHARGE_REACH=8,CHARGE_ROOM=6,SWING_ROOM=.5;
const LENS_SPEED=24,SWING_LONGEST=1.4;
const OVERHEAD:Partial<Record<FighterId,{height:number;radius:number;power:number;from:number}>>={goku:{height:4.65,radius:2.3,power:.8,from:.14},ace:{height:3.6,radius:2.2,power:.7,from:.12}};
const BOMB={height:2.8,radius:2,power:.8,from:.14},NARUTO_BOMB=1.45;
const AWAKEN_ORBIT=1.1,AWAKEN_PUSH=.28,AWAKEN_FOV=5,AWAKEN_IN=.35,AWAKEN_OUT=.6;
const FRONT_AWAKEN:ReadonlySet<FighterId>=new Set<FighterId>(['deku','bakugo','all-might','akainu','denji','todoroki','endeavor','yoruichi','yuta','rukia','yuji','jinbe','enel','kizaru','yamato','hinata','gintoki','tsunade','jiraiya','nanami','josuke','blackbeard','hisoka','doflamingo','sakura','meliodas','escanor','tatsumaki','makima','kenpachi','minato','edward-elric','pain','yamamoto','byakuya','grimmjow','ken-kaneki','alphonse-elric','mikasa','esdeath','garou','pikachu','akame','might-guy','jolyne','shinji','netero','asuka','eren','kaiju-no-8','nico-robin','hiei','aokiji']);
const FRONT_AWAKEN_IN=.45,FRONT_AWAKEN_ANGLE=.75;
const AWAKEN_STEP=.1,AWAKEN_SEARCH=1.6,AWAKEN_ROOM=.9,AWAKEN_AIM=2.2;
const AWAKEN_AT_X=-.15,AWAKEN_AT_Y=.2,AWAKEN_TRACK=.09,AWAKEN_TRACK_MOST=3,AWAKEN_REACH=.9,AWAKEN_HEAD_SPEED=1.6,AWAKEN_FOV_MOST=64;
const AWAKEN_TOP=.52,AWAKEN_FLOOR=-.66,AWAKEN_CARDS=-.36,AWAKEN_CARD_EDGE=[-.08,.1] as const;
const AWAKEN_CROWN=.24,AWAKEN_CROWN_MOST=1.2,CROWN_HEIGHT=1.95,AWAKEN_SIZE_RATE=8,AWAKEN_SIZE_LIFT=.8,AWAKEN_SIZE_MOST=1.9,AWAKEN_GRACE=.25,AWAKEN_WIDEN_RATE=150,AWAKEN_FORM_LEAD=.3,AWAKEN_FORM_LAG=.08;
const AWAKEN_TALL=.22,AWAKEN_TALL_AT=.8,AWAKEN_EXCESS_RATE=8,AWAKEN_CATCH=2;
const AWAKEN_STAND_CROWN=.45;
const AWAKEN_STANDING=1.6;

function screenOf(point:THREE.Vector3,eye:THREE.Vector3,look:THREE.Vector3,tanV:number,tanH:number,out:{x:number;y:number}){
  let fx=look.x-eye.x,fy=look.y-eye.y,fz=look.z-eye.z;const fl=Math.hypot(fx,fy,fz);
  if(!(fl>1e-9))return false;fx/=fl;fy/=fl;fz/=fl;
  let rx=-fz,rz=fx;const rl=Math.hypot(rx,rz);
  if(!(rl>1e-9))return false;rx/=rl;rz/=rl;
  const dx=point.x-eye.x,dy=point.y-eye.y,dz=point.z-eye.z,depth=dx*fx+dy*fy+dz*fz;
  if(!(depth>1e-6))return false;
  out.x=(dx*rx+dz*rz)/depth/tanH;out.y=(-dx*rz*fy+dy*(rz*fx-rx*fz)+dz*rx*fy)/depth/tanV;
  return true;
}
export function aimAt(eye:THREE.Vector3,point:THREE.Vector3,x:number,y:number,tanV:number,tanH:number,out:THREE.Vector3){
  const dx=point.x-eye.x,dy=point.y-eye.y,dz=point.z-eye.z,d=Math.hypot(dx,dy,dz);
  if(!(d>1e-6))return out.copy(point);
  const a=x*tanH,b=y*tanV,n=Math.sqrt(1+a*a+b*b);
  const pitch=Math.asin(THREE.MathUtils.clamp(dy/d*n/Math.sqrt(1+b*b),-1,1))-Math.atan(b);
  const heading=Math.atan2(dx,dz)+Math.atan2(a,Math.cos(pitch)-b*Math.sin(pitch));
  return out.set(eye.x+Math.sin(heading)*Math.cos(pitch)*d,eye.y+Math.sin(pitch)*d,eye.z+Math.cos(heading)*Math.cos(pitch)*d);
}
const KO_PUSH=.4,KO_NEAREST=2.4,KO_FOV=6,KO_IN=.25,KO_HOLD=.35,KO_OUT=.35,KO_RANGE=18,KO_CLEAR=1.1,KO_FADE=1.2;
const INTRO_SWEEP=3.2,INTRO_FRONT=.35,INTRO_RADIUS=5,INTRO_FOV=46,INTRO_IN=1,INTRO_LEAVE=.45,INTRO_ABORT=.9;
const INTERRUPT=.4;
const STRING_GAP=.9;
const VICTORY_ANGLE=.55,VICTORY_RADIUS=3.6,VICTORY_EYE=-.35,VICTORY_FOV=44,VICTORY_IN=.9,VICTORY_OUT=1,VICTORY_CUT=14;
const VICTORY_FIT=['Head','LeftHand','RightHand'] as const,VICTORY_FILL=.78,VICTORY_FOV_MOST=66;
const VICTORY_ROOM=.85,VICTORY_TURNS=[-.3,-.55,.4,.8,1.2,1.6,2] as const;
const CLEARANCE=.35,MIN_REACH=1;
const BODY_RADIUS=.42,BODY_HEIGHT=1.85,CORPSE_RADIUS=.9,SIGHT_CLEAR=.1,LENS_CLEAR=.3,LIFT_FADE=1.5,PREDICT=.6,BLOCKED_GRACE=.15;
const SWING_SAMPLES=12;
const FIT_JOINTS=['Head','LeftFoot','RightFoot','LeftToeBase','RightToeBase'] as const;
const IMPACT_AHEAD=.35,IMPACT_AHEAD_MOST=2.2,IMPACT_ROOM=1,IMPACT_STEP=.15,IMPACT_SEARCH=1.8,IMPACT_DRAWN=10,IMPACT_FOV_MOST=64,IMPACT_FILL=.72;
const IMPACT_CONE=.22,IMPACT_THROW=2.5,IMPACT_PULL=16;
const IMPACT_EASE=.35,IMPACT_EASE_FLOOR=.35;
const TURN_STEP=.12,TURN_SEARCH=1.3,TURN_SPEED=2.5,TURN_REACH=8,TURN_ACCEL=10,TURN_GAIN=8;
const SWING=1.4,SWING_MOST=1.6;
const CARRY=.5;
const SHOT_STEP=1/30;

const CROWD_MOST=.12,RELEASE_SEARCH=2.45,RELEASE_ROOM=2.3,SUMMON_CLEAR=.55,SUMMON_STAND=1.3,SUMMON_STEP=.4,RESEARCH=.25;
const BYSTANDER_CLEAR=1.25;
const BAJRANG_AT=MOVES.luffy.ultimate.contacts[MOVES.luffy.ultimate.contacts.length-1];
const SUSANOO_BACK=.35,SUSANOO_HEIGHT=4.3,SUSANOO_RADIUS=1.35,SUSANOO_FOR=MOVES.sasuke.ultimate.duration;
const BAJRANG_FROM=MOVES.luffy.ultimate.contacts[0]+.3,BAJRANG_DRIVE=BAJRANG_AT-.24,BAJRANG_SMALL=.35,BAJRANG_BIG=2,BAJRANG_OVER=.08,BAJRANG_BODY=.75,BAJRANG_TALL=1.8;
const HELL_RADIUS=.8,HELL_HEIGHT=2.3;
const FOX_BODY=[.9,2.9] as const,FOX_RADIUS=1.35,FOX_TOP=3.1;
const CASTER_POINTS=480,CASTER_EVERY=.1,CASTER_CLEAR=1,CASTER_PUSH_MOST=3,CASTER_IN=20,CASTER_OUT=3,CASTER_SIGHT=.14,CASTER_HIDES=4;
const HIDDEN_LINES=[.6,1.1,1.62] as const,HIDDEN_HOLD=.35;
const IMPACT_TOP=2.8,IMPACT_UP=.21,IMPACT_ABOVE=.22,IMPACT_DOWN=.45,IMPACT_AIR=1.6;
type Summon={x:number;z:number;y0:number;y1:number;radius:number};
const summon=():Summon=>({x:0,z:0,y0:0,y1:0,radius:0});

export function bodyBulk(state:{fighter:FighterId;awakened?:boolean}){
  if(state.fighter==='eren')return state.awakened?3.4/1.7:1;
  if(state.fighter==='pikachu')return .5;
  if(!state.awakened)return 1;
  return state.fighter==='naruto'?8/4.5:state.fighter==='sasuke'||state.fighter==='kakashi'?7.5/4.5:1;
}
export function drawnBulk(body:{state:{fighter:FighterId;awakened?:boolean;alive?:boolean};model?:{visible:boolean}}){
  const s=body.state;
  if(!s.awakened&&body.model&&!body.model.visible&&s.alive!==false)return bodyBulk({fighter:s.fighter,awakened:true});
  return bodyBulk(s);
}
const reach2=(s:number,ax:number,ay:number,az:number,dx:number,dy:number,dz:number,x:number,z:number,y0:number,y1:number)=>{
  const px=ax+dx*s-x,pz=az+dz*s-z,py=ay+dy*s,above=py<y0?y0-py:py>y1?py-y1:0;
  return px*px+pz*pz+above*above;
};
export function sightClearance(a:THREE.Vector3,b:THREE.Vector3,x:number,z:number,y0:number,y1:number,enough=Infinity){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  const flat=dx*dx+dz*dz,s=flat>1e-12?THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/flat,0,1):0;
  const across=Math.hypot(a.x+dx*s-x,a.z+dz*s-z);
  if(across>=enough)return across;
  let lo=0,hi=1;
  for(let i=0;i<34;i++){
    const m1=lo+(hi-lo)/3,m2=hi-(hi-lo)/3;
    if(reach2(m1,a.x,a.y,a.z,dx,dy,dz,x,z,y0,y1)<reach2(m2,a.x,a.y,a.z,dx,dy,dz,x,z,y0,y1))hi=m2;else lo=m1;
  }
  return Math.sqrt(reach2((lo+hi)/2,a.x,a.y,a.z,dx,dy,dz,x,z,y0,y1));
}

export class CameraDirector {
  enabled=false;
  ceded=false;
  closeStyle=false;
  private closeUp=false;
  localId='';
  crowd?:ReadonlyMap<string,Fighter>;
  kind:ShotKind='none';
  weight=0;
  get phase():string{
    if(this.kind!=='ultimate')return this.kind;
    return this.t<this.aEnd?'close':this.toB<0||this.t<this.aEnd+this.toB?'swing':this.tour?'field':'release';
  }
  readonly pivot=new THREE.Vector3();
  get focus():readonly (Fighter|undefined)[]{
    this.focusList.fill(undefined);this.focusCount=0;
    if(this.kind==='none'||this.weight<=0)return this.focusList;
    this.putFocus(this.subject);
    if(this.kind==='ultimate'){this.putFocus(this.releaseVictim);this.putFocus(this.opponent);if(this.tour)this.crowd?.forEach(this.focusField);}
    else if(this.kind==='impact'||this.kind==='ko'||this.kind==='opener'){this.putFocus(this.caster);this.putFocus(this.opponent);}
    return this.focusList;
  }
  get shotVictim():Fighter|undefined{
    if(this.weight<=0)return undefined;
    if(this.kind==='impact')return this.subject;
    if(this.kind==='ultimate'&&this.t>=this.aEnd)return this.releaseVictim?.state.alive?this.releaseVictim:undefined;
    return undefined;
  }
  victimBehindCaster=false;
  private hiddenHold=0;
  private focusCount=0;
  private putFocus(body?:Fighter){if(body&&this.focusCount<this.focusList.length&&!this.focusList.includes(body))this.focusList[this.focusCount++]=body;}
  private focusField=(body:Fighter)=>{if(this.inField(body))this.putFocus(body);};
  private focusList:(Fighter|undefined)[]=[undefined,undefined,undefined,undefined,undefined,undefined];
  private caster?:Fighter;
  private t=0;
  private length=0;
  private leaving=-1;
  private leaveFrom=0;
  private leaveOver=.3;
  private subject?:Fighter;
  private side=1;
  private victoryTurn=0;
  private startAz=0;
  private startR=0;
  private startY=0;
  private opening=false;
  private pull=0;
  private firm=1;
  private carried=CARRY;
  private carryOver=CARRY;
  private impactCarry=CARRY;
  private introLeft=-1;
  private introSweep=0;
  private victim?:Fighter;
  private lastEvent=0;
  private lastAction='';
  private lastKey=NaN;
  private sinceReset=0;
  private bridge=false;
  private carryAz=0;
  private carryR=0;
  private carryY=0;
  private carryFov=0;
  private carryLook=new THREE.Vector3();
  private shownEye=new THREE.Vector3();
  private shownLook=new THREE.Vector3();
  private shownFov=50;
  private eye=new THREE.Vector3();
  private look=new THREE.Vector3();
  private fov=50;
  private scratch=new THREE.Vector3();
  private left=new THREE.Vector3();
  private right=new THREE.Vector3();
  private facing=0;
  private ray=new THREE.Raycaster();
  private hits:THREE.Intersection[]=[];
  private framing=0;
  private overhead=false;
  private release=0;
  private castAge=0;
  private blocked=0;
  private charge=new THREE.Vector3();
  private fitR=0;
  private fitPitch=0;
  private fitFov=CHARGE_FOV;
  private walls:readonly THREE.Object3D[]=[];
  private heroAz=0;
  private heroTurn=0;
  private into=HERO_IN;
  private out=HERO_OUT;
  private fit=1;
  private handBack=INTERRUPT;
  private planned=HERO_MAX;
  private aEnd=0;
  private toB=-1;
  private bUntil=0;
  private finish=0;
  private flight=0;
  private releaseVictim?:Fighter;
  private releaseAz=0;
  private releaseTurn=0;
  private heroEye=new THREE.Vector3();
  private heroLook=new THREE.Vector3();
  private heroFov=HERO_FOV;
  private point=new THREE.Vector3();
  private aspect=16/9;
  private fitSide=0;private fitYaw=0;private fitCount=0;private fitFrom=0;private fitTo=0;
  private fitEl=new Float64Array(8);private fitTop=new Float64Array(8);private fitBottom=new Float64Array(8);private fitSoft=new Uint8Array(8);
  private impactVictim?:Fighter;
  private tour=false;
  private stopAt=0;
  private stopRadius=0;
  private tourOrigin=new THREE.Vector3();
  private tourAnchored=false;
  private fieldCentre=new THREE.Vector3();
  private fieldUser=new THREE.Vector3();
  private fieldPlaced=false;
  private fieldAz=0;
  private fieldCount=0;
  private fieldSpread=0;
  private impactAz=0;
  private impactIn=0;
  private impactLead=0;
  private opponent?:Fighter;
  private sightFrom=new THREE.Vector3();
  private sightTo=new THREE.Vector3();
  private sightSubject?:Fighter;
  private sightAhead=0;
  private sightBlocked=false;
  private pushed=new THREE.Vector3();
  private nearFrom=new THREE.Vector3();
  private nearSkip?:Fighter;
  private nearHit=false;
  private lineX=0;
  private lineZ=0;
  private lineR=0;
  private lineReach=0;
  private lineVictim?:Fighter;
  private impactTurn=0;
  private impactGoal=0;
  private drawnOffset=new THREE.Vector3();
  private drawnPoint=new THREE.Vector3();
  private ahead=new THREE.Vector3();
  private impactFit=IMPACT_FOV;
  private victoryFit=VICTORY_FOV;
  private summons:Summon[]=[summon(),summon(),summon(),summon()];
  private summonCount=0;private summoner?:Fighter;
  private crowdA?:Fighter;private crowdB?:Fighter;private crowdWorst=0;
  private viewEye=new THREE.Vector3();private viewForward=new THREE.Vector3();private viewRight=new THREE.Vector3();private viewUp=new THREE.Vector3();
  private crowdTanV=1;private crowdTanH=1;
  private releaseGoalTurn=NaN;private releaseGoalSide=1;private releaseGoalReach=0;private probeReach=0;private releaseSearched=-Infinity;
  private caught:Fighter[]=[];private caughtCount=0;
  private probeEye=new THREE.Vector3();private probeLook=new THREE.Vector3();
  private drawn=new Float32Array(CASTER_POINTS*3);private drawnCount=0;private drawnClock=-Infinity;private drawnOf?:Fighter;
  private drawnTotal=0;private drawnStride=1;private drawnSeen=0;
  private clothPush=new THREE.Vector3();private clothGoal=new THREE.Vector3();private clothProbe=new THREE.Vector3();
  private impactFloor=0;private impactDownAt=-1;
  private awakenSwing=0;private awakenFree=false;
  private awakenBlockers=Array.from({length:16},()=>new THREE.Box3());
  private awakenBlockerCount=0;
  private awakenProbe=new THREE.Vector3();
  private awakenHit=new THREE.Vector3();
  private awakenKey=NaN;private awakenAway=0;private awakenClock=0;
  private awakenHead=new THREE.Vector3();private awakenPoint=new THREE.Vector3();private awakenCrown=new THREE.Vector3();private awakenBody=new THREE.Vector3();
  private awakenOwn=new THREE.Vector3();private awakenOwnFollow=new THREE.Vector3();private awakenOwnV=new THREE.Vector3();
  private awakenFormAt=new THREE.Vector3();private awakenFormFollow=new THREE.Vector3();private awakenFormV=new THREE.Vector3();private awakenFormSeen=false;
  private awakenBone?:THREE.Object3D;private awakenBoneOf?:THREE.Object3D;
  private awakenSize=1;private awakenIn=AWAKEN_IN;private awakenWide=0;private awakenForm=0;private awakenExcess=0;private awakenExcessGoal=0;
  private awakenCarryX=0;private awakenCarryY=0;private awakenBridge=false;
  private screen={x:0,y:0};
  readonly awakenFrame={x:0,y:0,head:new THREE.Vector3(),clock:0,form:0,size:1,widen:0};

  private hitBy=new Map<string,number>();private hitOn=new Map<string,number>();
  private historyPruneAt=0;
  get historyEntries(){return this.hitBy.size+this.hitOn.size;}
  readonly cues:{kind:PlayKind;ender:boolean}[]=[{kind:'launch',ender:false},{kind:'launch',ender:false},{kind:'launch',ender:false},{kind:'launch',ender:false}];
  cueCount=0;
  hitAgo(id:string){const at=this.hitBy.get(id);return at===undefined?Infinity:this.sinceReset-at;}
  private strungCount=0;private strungAt=-Infinity;
  strung(){return this.sinceReset-this.strungAt<STRING_GAP?this.strungCount:0;}
  strungAgo(){return this.sinceReset-this.strungAt;}
  private cue(kind:PlayKind,ender:boolean){if(this.cueCount<this.cues.length){const c=this.cues[this.cueCount++];c.kind=kind;c.ender=ender;}}
  reset(){this.historyPruneAt=0;this.hitBy.clear();this.hitOn.clear();this.strungCount=0;this.strungAt=-Infinity;this.cueCount=0;this.kind='none';this.weight=0;this.leaving=-1;this.pull=0;this.carried=this.carryOver=CARRY;this.subject=undefined;this.victim=undefined;this.impactVictim=undefined;this.releaseVictim=undefined;this.opponent=undefined;this.introLeft=-1;this.lastEvent=0;this.lastAction='';this.lastKey=NaN;this.sinceReset=0;this.bridge=false;this.carryAz=this.carryR=this.carryY=this.carryFov=0;this.carryLook.set(0,0,0);this.blocked=0;this.drawnCount=0;this.drawnOf=undefined;this.drawnClock=-Infinity;this.clothPush.set(0,0,0);}
  intro(seconds:number){
    if(!(seconds>0)){this.introLeft=-1;if(this.kind==='intro')this.cancel(INTRO_ABORT);return;}
    if(this.kind==='intro')return;
    this.introLeft=seconds;this.introSweep=Math.min(seconds,INTRO_SWEEP);
  }
  victory(winner:Fighter,seconds:number){
    if(!(seconds>0)){if(this.kind==='victory')this.cancel(.6);return;}
    this.start('victory',winner,seconds);
  }
  handle(events:readonly CombatEvent[],localId:string,lookup:(id:string)=>Fighter|undefined){
    this.localId=localId;
    for(const event of events){
      if(event.id<=this.lastEvent)continue;
      this.lastEvent=event.id;
      if(event.kind==='hit'&&localId&&event.targetId===localId&&event.actorId)this.hitBy.set(event.actorId,this.sinceReset);
      if(event.kind==='hit'&&localId&&event.actorId===localId&&event.targetId&&event.targetId!==localId){this.strungCount=this.sinceReset-this.strungAt<STRING_GAP?this.strungCount+1:1;this.strungAt=this.sinceReset;}
      if(!this.enabled||!localId)continue;
      if(event.kind==='hit'&&event.actorId===localId&&event.targetId&&event.targetId!==localId){
        this.hitOn.set(event.targetId,this.sinceReset);
        const ender=!!event.branch||event.slot==='heavy'||event.slot==='special'||(event.slot==='light'&&(event.chain??0)>=RUSH_STAGES-1);
        if(event.reaction==='knockdown'||event.outcome==='knockdown')this.cue('knockdown',ender);
        else if(event.reaction==='launched'&&(event.outcome===undefined||event.outcome==='launch'))this.cue('launch',ender);
      }
      if(event.kind==='wall-splat'&&event.actorId!==localId){const at=this.hitOn.get(event.actorId);if(at!==undefined&&this.sinceReset-at<1.5)this.cue('splat',true);}
      if(event.kind==='eliminated'&&event.actorId===localId&&event.targetId&&event.targetId!==localId)this.victim=lookup(event.targetId);
      if(event.kind==='hit'&&event.targetId===localId&&this.kind!=='none'&&this.kind!=='victory')this.cancel(INTERRUPT);
      if(event.kind==='hit'&&event.slot==='ultimate'&&event.actorId===localId&&event.targetId&&event.targetId!==localId){
        const caster=lookup(localId),move=moveFor(event.fighter??caster?.state.fighter??'goku','ultimate',!!caster?.state.awakened);
        if(event.contactIndex===undefined||event.contactIndex>=move.contacts.length-1)this.impactVictim=lookup(event.targetId);
      }
    }
  }
  cancel(over=.3){
    if(this.kind==='none'||this.leaving>=0)return;
    if(this.kind==='intro')this.introLeft=-1;
    if(this.kind==='ultimate'||this.kind==='impact')over=Math.max(over,this.handBack);
    if(this.kind==='opener')over=Math.min(over,OPENER_OUT);
    this.leaving=this.t;this.leaveFrom=this.weight;this.leaveOver=over;
  }

  apply(dt:number,camera:THREE.PerspectiveCamera,self:Fighter,eye:THREE.Vector3,look:THREE.Vector3,fov:number,occluders:readonly THREE.Object3D[],bulk:number,turned:boolean,opponent?:Fighter){
    if(this.sinceReset>=this.historyPruneAt){
      this.historyPruneAt=this.sinceReset+1;
      for(const [id,at] of this.hitBy)if(this.sinceReset-at>HIT_FOR)this.hitBy.delete(id);
      for(const [id,at] of this.hitOn)if(this.sinceReset-at>1.5)this.hitOn.delete(id);
    }
    this.sinceReset+=dt;this.walls=occluders;this.aspect=camera.aspect;this.opponent=opponent;this.caster=self;if(this.kind==='none'){this.victimBehindCaster=false;this.hiddenHold=0;}
    this.gameLook.copy(look);this.gameLens=fov;this.frameDt=dt;
    this.summonCount=0;
    const local=!!this.localId&&self.state.id===this.localId;
    if(local){
      const action=self.state.action,key=self.state.actionSeq??self.state.actionStarted;
      const fresh=(action!==this.lastAction||key!==this.lastKey)&&self.state.actionTime*self.state.actionDuration<.35;
      const confirms=action==='ultimate'&&!!MOVES[self.state.fighter].ultimate.confirm;
      const resumed=action==='awaken'&&this.kind==='awaken'&&this.leaving<0&&key===this.awakenKey;
      if(this.enabled&&fresh&&!resumed&&(action==='ultimate'||action==='awaken')&&self.state.alive)this.start(confirms?'opener':action,self,confirms?OPENER_MOST:0,eye,bulk,occluders);
      if(this.enabled&&confirms&&self.state.confirmedAt!==undefined&&this.cineKey!==key&&self.state.alive){this.cineKey=key;if(!this.ceded)this.start('ultimate',self,0,eye,bulk,occluders,undefined,true);}
      if(this.kind==='opener'&&(self.state.whiffedAt!==undefined||action!=='ultimate'))this.cancel(OPENER_OUT);
      this.lastAction=action;this.lastKey=key;
    }
    if(this.introLeft>0){
      this.introLeft-=dt;
      if(this.enabled&&this.introLeft<=this.introSweep&&this.introLeft>0&&this.kind==='none'){
        this.start('intro',self,this.introSweep,eye);this.t=this.introSweep-this.introLeft;
      }
      if(this.introLeft<=0)this.introLeft=-1;
    }
    if(this.impactVictim){
      const victim=this.impactVictim;this.impactVictim=undefined;
      const crowd=this.kind==='ultimate'&&this.tour&&this.fieldCount>1;
      if(this.enabled&&local&&!crowd&&!this.ceded&&(this.kind==='none'||this.kind==='ultimate')&&victim.group.position.distanceTo(self.group.position)<IMPACT_RANGE)this.start('impact',victim,0,eye,bodyBulk(victim.state),occluders,self);
    }
    if(this.victim){
      const victim=this.victim;this.victim=undefined;
      if(this.enabled&&!this.ceded&&(this.kind==='none'||this.kind==='intro'||this.kind==='ko')&&victim.group.position.distanceTo(self.group.position)<KO_RANGE)this.start('ko',victim,KO_IN+KO_HOLD+KO_OUT);
    }
    if(this.ceded&&(this.kind==='opener'||this.kind==='ultimate'||this.kind==='impact'||this.kind==='ko'))this.cancel(INTERRUPT);
    if(this.kind==='none'){this.weight=0;return 0;}
    if(this.kind==='victory'&&this.t===0){
      const facing=this.facing,from=Math.atan2(eye.x-this.pivot.x,eye.z-this.pivot.z);
      this.side=wrapped(from-facing)>=0?1:-1;
      this.opening=eye.distanceTo(this.pivot)>VICTORY_CUT;this.victoryTurn=0;
      if(this.subject&&!this.orbitClear(this.subject,this.side,eye)&&this.orbitClear(this.subject,-this.side,eye))this.side=-this.side;
      const winner=this.subject;
      if(winner&&this.walls.length&&this.orbitRoom(winner,this.side,0)<VICTORY_ROOM&&this.orbitRoom(winner,-this.side,0)<VICTORY_ROOM){
        let side=this.side,turn=0,most=-1;
        search:for(const t of VICTORY_TURNS)for(const s of [this.side,-this.side]){
          const room=this.orbitRoom(winner,s,t);
          if(room>=VICTORY_ROOM&&this.orbitClear(winner,s,eye,t)){side=s;turn=t;break search;}
          if(room>most){most=room;side=s;turn=t;}
        }
        this.side=side;this.victoryTurn=turn;
      }
    }
    if(!this.enabled||turned)this.cancel(INTERRUPT);
    const step=this.kind==='intro'?dt:Math.min(dt,SHOT_STEP);
    const subject=this.subject;
    if(this.kind==='awaken')this.awakenAway=self.state.action==='awaken'?0:this.awakenAway+dt;
    if(!subject||(this.kind!=='ko'&&this.kind!=='impact'&&!subject.state.alive)||(this.kind==='ultimate'&&self.state.action!=='ultimate')||(this.kind==='awaken'&&this.awakenAway>AWAKEN_GRACE&&this.t<AWAKENING_ENTRY-.1))this.cancel(INTERRUPT);
    this.t+=step;
    if((this.kind==='ultimate'||this.kind==='impact'||this.kind==='awaken')&&this.caster?.state.alive)this.sampleCaster(this.caster);else this.drawnCount=0;
    this.gameLook.copy(look);
    let w=this.script(subject??self,eye,fov,bulk,step);
    if(this.leaving>=0)w=Math.min(w,this.leaveFrom*(1-ease((this.t-this.leaving)/this.leaveOver)));
    const spent=this.t>=this.length||(this.leaving>=0&&(this.t-this.leaving>=this.leaveOver||w<=1e-6))||(w<=1e-6&&this.t>.05);
    const settled=this.pull<1e-3&&this.carried>=this.carryOver;
    if(spent&&settled){this.kind='none';this.weight=0;this.leaving=-1;return 0;}
    if(spent)w=0;
    if(w<=1e-6&&settled){this.weight=0;return 0;}
    this.weight=w;
    this.present(step,camera,subject??self,eye,look,fov,occluders,w);
    return w;
  }

  private start(kind:ShotKind,subject:Fighter,length:number,eye?:THREE.Vector3,bulk=1,occluders:readonly THREE.Object3D[]=[],caster?:Fighter,cine=false){
    if(kind==='ultimate'&&!(cine?this.cinematic(subject,eye,bulk,occluders):this.hero(subject,eye,bulk,occluders)))return;
    if(kind==='opener'&&eye&&occluders.length){
      this.setPivot(subject,bulk);
      const gx=eye.x-this.pivot.x,gz=eye.z-this.pivot.z,r=Math.hypot(gx,gz);
      if(r>1e-3&&this.clear(Math.atan2(gx,gz),r,occluders)<r-1e-3)return;
    }
    if(kind==='ultimate')this.cine=cine;
    if(kind==='impact'){this.impact(subject,caster,eye,bulk);}
    this.bridge=this.kind!=='none'&&this.weight>1e-3;
    this.kind=kind;this.subject=subject;this.t=0;this.leaving=-1;this.pull=0;this.firm=-1;this.blocked=0;
    this.opening=kind==='intro'&&this.sinceReset<.2;
    if(kind==='ultimate'||kind==='impact')return;
    this.length=length;
    this.setPivot(subject,kind==='victory'?bodyBulk(subject.state):bulk);
    const facing=this.facing=this.bodyFacing(subject);
    if(kind==='awaken'){
      this.closeUp=this.closeStyle;
      this.length=AWAKENING_ENTRY+(this.closeUp?CLOSE_SHOT.out:AWAKEN_OUT);
      const from=eye??this.scratch.set(this.pivot.x,this.pivot.y+1,this.pivot.z-4);
      this.startAz=Math.atan2(from.x-this.pivot.x,from.z-this.pivot.z);this.startR=Math.hypot(from.x-this.pivot.x,from.z-this.pivot.z);this.startY=from.y-this.pivot.y;
      this.side=wrapped(facing-this.startAz)>=0?1:-1;
      if(FRONT_AWAKEN.has(subject.state.fighter)){
        this.startAz=facing-this.side*FRONT_AWAKEN_ANGLE;
      }
      if(this.closeUp){this.startAz=facing-this.side*CLOSE_SHOT.angle;this.startR=CLOSE_SHOT.reach;this.startY=CLOSE_SHOT.low;}
      this.awakenSwing=0;this.awakenFree=false;
      this.sampleAwakenBlockers(subject);
      if((occluders.length||this.awakenBlockerCount)&&this.startR>1e-3){
        const want=this.startR*AWAKEN_ROOM,orbit=AWAKEN_ORBIT*AWAKEN_ORBIT_SHARE;
        const wallBlocked=occluders.length>0&&(this.clear(this.startAz,want,occluders)<want-1e-3||this.clear(this.startAz+this.side*orbit,want,occluders)<want-1e-3);
        const roomy=(az:number,side:number)=>{
          for(const u of [0,.5,1]){
            const bearing=az+side*orbit*u;
            if((occluders.length&&this.clear(bearing,want,occluders)<want-1e-3)||!this.awakenBodyClear(bearing,this.startR*1.5))return false;
          }
          return true;
        };
        if(!roomy(this.startAz,this.side)){
          let found=NaN;
          for(let k=1;k*AWAKEN_STEP<=AWAKEN_SEARCH+1e-9&&Number.isNaN(found);k++){
            for(const way of [this.side,-this.side]){
              const az=this.startAz+way*k*AWAKEN_STEP;
              if(roomy(az,wrapped(facing-az)>=0?1:-1)){found=az;break;}
            }
          }
          if(Number.isFinite(found)){this.awakenSwing=Math.abs(wrapped(found-this.startAz));this.startAz=found;this.side=wrapped(facing-found)>=0?1:-1;}
          this.awakenFree=wallBlocked;
        }
      }
      const st=subject.state;
      this.awakenKey=st.actionSeq??st.actionStarted;this.awakenAway=0;this.awakenSize=1;this.awakenBridge=false;this.awakenWide=0;
      this.awakenClock=st.action==='awaken'?st.actionTime*st.actionDuration:0;this.awakenForm=this.formShare(st);
      this.awakenBone=this.awakenBoneOf=undefined;this.drawnCount=0;this.drawnClock=-Infinity;
      this.drawnHeads(subject);this.awakenOwnFollow.copy(this.awakenOwn);this.awakenOwnV.set(0,0,0);this.awakenFormSeen=false;
      this.awakenExcess=this.awakenExcessGoal;this.awakenHead.copy(this.awakenPoint);this.awakenHead.y+=this.awakenExcess*.5;
      this.awakenIn=AWAKEN_BLEND_IN;
      const tan=Math.tan(THREE.MathUtils.degToRad(this.gameLens)/2),s=this.screen;
      const atX=this.closeUp?CLOSE_SHOT.atX:AWAKEN_AT_X,atY=this.closeUp?CLOSE_SHOT.atY:AWAKEN_AT_Y;
      if(eye&&screenOf(this.awakenHead,eye,this.gameLook,tan,tan*this.aspect,s))this.awakenIn=THREE.MathUtils.clamp(1.875*Math.hypot(atX-s.x,atY-AWAKEN_TALL*Math.min(1,this.awakenExcess/AWAKEN_TALL_AT)-s.y)/AWAKEN_HEAD_SPEED,AWAKEN_BLEND_IN,AWAKEN_IN);
      if(FRONT_AWAKEN.has(st.fighter))this.awakenIn=Math.max(this.awakenIn,FRONT_AWAKEN_IN);
      if(this.closeUp)this.awakenIn=Math.max(this.awakenIn,CLOSE_SHOT.in);
    }else if(kind==='opener'){
      this.side=1;
    }else if(kind==='intro'){
      this.side=1;
      if(!this.sweepClear(subject,1,eye)&&this.sweepClear(subject,-1,eye))this.side=-1;
    }
  }
  private hero(subject:Fighter,eye:THREE.Vector3|undefined,bulk:number,occluders:readonly THREE.Object3D[]){
    const state=subject.state,move=moveFor(state.fighter,'ultimate',!!state.awakened),elapsed=state.actionTime*state.actionDuration;
    const kept={length:this.length,planned:this.planned,side:this.side,framing:this.framing,overhead:this.overhead,release:this.release,finish:this.finish,flight:this.flight,castAge:this.castAge,facing:this.facing,releaseVictim:this.releaseVictim};
    this.overhead=move.style==='bomb';this.release=move.contacts[0]??HERO_MAX;this.finish=move.contacts[move.contacts.length-1]??this.release;this.castAge=elapsed;this.walls=occluders;
    this.tour=!!move.timeStop&&!!TIME_STOP_TOURS[state.fighter];this.stopAt=move.timeStop?move.contacts[move.timeStop.contact]:0;this.stopRadius=move.timeStop?.radius??0;
    this.tourAnchored=false;this.fieldPlaced=false;this.fieldCount=0;this.caughtCount=0;
    this.length=this.planned=THREE.MathUtils.clamp(this.release-elapsed-HERO_OUT,HERO_MIN,HERO_IN+HERO_HOLD);
    const victim=this.opponent?.state.alive?this.opponent:undefined,speed=move.speed??0;
    this.flight=victim&&speed>0&&(move.style==='projectile'||move.style==='bomb')?Math.min(3,victim.group.position.distanceTo(subject.group.position)/speed):0;
    this.setPivot(subject,bulk,'ultimate');
    const facing=this.facing=this.bodyFacing(subject);
    const from=eye?Math.atan2(eye.x-this.pivot.x,eye.z-this.pivot.z):facing+Math.PI;
    let side=Math.abs(wrapped(facing+HERO_ANGLE-from))<=Math.abs(wrapped(facing-HERO_ANGLE-from))?1:-1;
    const want=(this.overhead?CHARGE_ROOM:HERO_FROM)*bulk,near=this.clear(facing+side*HERO_ANGLE,want,occluders),far=this.clear(facing-side*HERO_ANGLE,want,occluders);
    if(near<want*.8&&far>near+.3)side=-side;
    this.releaseVictim=this.opponent?.state.alive?this.opponent:undefined;
    this.summonsFor(subject,elapsed+this.length*.5);
    let best=-1,bestSide=side,bestFor=0,wipe=-1,wipeSide=side,wipeScore=Infinity;
    for(let framing=0;framing<HERO_FRAMINGS.length;framing++)for(let k=0;k<2;k++){
      const s=k?-side:side,seen=this.seenFor(subject,framing,s,bulk);
      if(seen>=this.length){
        const clean=!eye||this.swingClear(subject,framing,s,bulk,eye);
        const room=this.overhead?this.clear(this.facing+s*HERO_FRAMINGS[framing].angle,want,occluders)+(clean?SWING_ROOM:0):clean?1:0;
        const crowded=this.heroCrowd(subject,framing,s,bulk);
        if(clean&&(!this.overhead||room>=want)&&crowded<=CROWD_MOST){this.aim(framing,s,subject,bulk,eye);return true;}
        const score=(clean&&(!this.overhead||room>=want)?0:2)-(this.overhead?Math.min(room,want)/Math.max(want,1e-3):0)+crowded*4;
        if(score<wipeScore){wipeScore=score;wipe=framing;wipeSide=s;}
      }
      if(seen>bestFor){bestFor=seen;best=framing;bestSide=s;}
    }
    if(wipe>=0){this.aim(wipe,wipeSide,subject,bulk,eye);return true;}
    if(best>=0&&bestFor>=HERO_MIN){this.length=this.planned=bestFor;this.aim(best,bestSide,subject,bulk,eye);return true;}
    Object.assign(this,kept);
    return false;
  }
  private cinematic(subject:Fighter,eye:THREE.Vector3|undefined,bulk:number,occluders:readonly THREE.Object3D[]){
    const state=subject.state,move=moveFor(state.fighter,'ultimate',!!state.awakened),elapsed=state.actionTime*state.actionDuration;
    this.walls=occluders;this.overhead=false;this.castAge=elapsed;this.release=elapsed;this.flight=0;
    this.finish=move.contacts[move.contacts.length-1]??elapsed;
    this.tour=!!move.timeStop&&!!TIME_STOP_TOURS[state.fighter];this.stopAt=move.timeStop?move.contacts[move.timeStop.contact]:0;this.stopRadius=move.timeStop?.radius??0;
    this.tourAnchored=false;this.fieldPlaced=false;this.fieldCount=0;this.caughtCount=0;
    this.setPivot(subject,bulk,'ultimate');
    const facing=this.facing=this.bodyFacing(subject);
    const from=eye?Math.atan2(eye.x-this.pivot.x,eye.z-this.pivot.z):facing+Math.PI;
    const held=state.target?this.crowd?.get(state.target):undefined;
    this.releaseVictim=held&&held!==subject&&held.state.alive?held:this.opponent?.state.alive?this.opponent:undefined;
    this.side=wrapped(from-facing)>=0?1:-1;this.framing=0;this.heroAz=from;this.heroTurn=0;
    this.releaseGoalTurn=NaN;this.releaseGoalSide=this.side;this.releaseSearched=-Infinity;this.swingLong=false;
    this.summonsFor(subject,elapsed);
    this.into=HERO_IN;
    if(eye&&!this.tour){this.releaseAz=this.releaseBearing(subject,bulk);this.releaseTurn=0;this.releasePose(subject,bulk);this.into=this.travel(HERO_IN,eye);}
    this.out=HERO_OUT;this.handBack=INTERRUPT;this.fit=1;
    this.aEnd=0;this.toB=this.into;this.planned=0;
    this.bUntil=Math.max(this.into+RELEASE_HOLD_LEAST,this.finish-elapsed+(this.tour?TOUR_LINGER:RELEASE_LINGER));
    this.length=this.bUntil+this.out;
    return true;
  }
  private aim(framing:number,side:number,subject:Fighter,bulk:number,eye?:THREE.Vector3){
    this.framing=framing;this.side=side;this.heroAz=this.facing+side*HERO_FRAMINGS[framing].angle;this.heroTurn=0;
    this.releaseGoalTurn=NaN;this.releaseGoalSide=side;this.swingLong=false;
    this.into=HERO_IN;this.out=HERO_OUT;this.handBack=INTERRUPT;
    if(this.overhead&&eye){this.heroPose(subject,HERO_IN,framing,this.heroAz,bulk);this.into=this.lensSwing(HERO_IN,eye);}
    else if(eye)this.into=HERO_IN*this.stretch(eye);
    const until=this.release-this.castAge;
    this.aEnd=Math.min(this.planned+this.into-HERO_IN,this.into+THREE.MathUtils.clamp(until-this.into-HERO_OUT,HERO_HOLD_LEAST,HERO_HOLD));
    if(this.tour)this.aEnd=Math.max(this.into+TOUR_HOLD_LEAST,Math.min(this.aEnd,until));
    this.planned=this.aEnd;this.fit=1;this.toB=-1;
    this.releaseVictim=this.opponent?.state.alive?this.opponent:undefined;
    this.bUntil=Math.max(this.aEnd+HERO_OUT+RELEASE_HOLD_LEAST,this.finish-this.castAge+this.flight+(this.tour?TOUR_LINGER:RELEASE_LINGER));
    this.length=this.bUntil+this.out;
  }
  private fieldPose(caster:Fighter,bulk:number,step:number,gameEye:THREE.Vector3){
    const c=caster.group.position,age=this.castAge+this.t;
    const anchoring=!this.tourAnchored&&age>=this.stopAt;
    if(anchoring){this.tourOrigin.copy(c);this.tourAnchored=true;}
    const origin=this.tourAnchored?this.tourOrigin:this.fieldFrom.copy(c);
    if(anchoring){this.caughtCount=0;this.gatherFor=caster;this.gatherOrigin=origin;this.crowd?.forEach(this.catchOne);}
    this.gatherFor=caster;this.gatherOrigin=origin;this.gatherX=c.x;this.gatherZ=c.z;this.gatherN=1;this.gatherCount=0;
    this.crowd?.forEach(this.fieldGather);
    const x=this.gatherX/this.gatherN,z=this.gatherZ/this.gatherN;
    this.gatherX=x;this.gatherZ=z;this.gatherSpread=Math.hypot(c.x-x,c.z-z);
    this.crowd?.forEach(this.fieldExtent);
    if(!this.fieldPlaced){
      this.fieldCentre.set(x,origin.y,z);this.fieldUser.copy(c);this.fieldSpread=this.gatherSpread;this.fieldPlaced=true;
      const from=Math.atan2(gameEye.x-x,gameEye.z-z);let best=Infinity;this.fieldAz=from;
      for(let k=0;k<12;k++){const az=from+Math.ceil(k/2)*(k%2?1:-1)*Math.PI/6,need=Math.max(FIELD_FOV,this.fieldFit(caster,az,this.fieldRadius(bulk,0),bulk))+Math.ceil(k/2)*1.5;if(need<best-1e-6){best=need;this.fieldAz=az;}}
    }
    else{const k=blend(FIELD_EASE,step);this.fieldCentre.x+=(x-this.fieldCentre.x)*k;this.fieldCentre.z+=(z-this.fieldCentre.z)*k;this.fieldCentre.y+=(origin.y-this.fieldCentre.y)*k;this.fieldUser.lerp(c,k);this.fieldSpread+=(this.gatherSpread-this.fieldSpread)*k;this.fieldAz+=FIELD_DRIFT*step*this.side;}
    this.fieldCount=this.gatherCount;
    let r=this.fieldRadius(bulk,age),fov=FIELD_FOV;
    for(let pass=0;pass<5;pass++){
      fov=Math.max(FIELD_FOV,this.fieldFit(caster,this.fieldAz,r,bulk));
      if(fov<=FIELD_FOV_MOST||r>=FIELD_REACH*bulk)break;
      r=Math.min(FIELD_REACH*bulk,r*Math.max(1.12,fov/FIELD_FOV_MOST));
    }
    this.fov=THREE.MathUtils.clamp(fov,FIELD_FOV,FIELD_FOV_MOST);
  }
  private fieldRadius(bulk:number,age:number){
    const push=1-FIELD_PUSH*THREE.MathUtils.clamp((age-this.stopAt)/Math.max(.1,this.finish-this.stopAt),0,1);
    return Math.max(FIELD_NEAREST,FIELD_R+FIELD_SPREAD*this.fieldSpread)*bulk*push;
  }
  private fieldFit(caster:Fighter,az:number,r:number,bulk:number){
    const f=this.fieldCentre,u=this.fieldUser;
    this.look.set(f.x+(u.x-f.x)*FIELD_TOWARD,f.y+1+(u.y-f.y)*FIELD_TOWARD,f.z+(u.z-f.z)*FIELD_TOWARD);
    this.eye.set(f.x+Math.sin(az)*r,f.y+FIELD_EYE*r,f.z+Math.cos(az)*r);
    this.holdForward.subVectors(this.look,this.eye).normalize();this.holdRight.crossVectors(this.holdForward,WORLD_UP).normalize();this.holdUp.crossVectors(this.holdRight,this.holdForward);
    this.holdNeed=0;
    this.holdBody(caster.group.position,1.9*bulk);this.crowd?.forEach(this.fieldHold);
    this.holdRoller(caster);
    return THREE.MathUtils.radToDeg(2*Math.atan(this.holdNeed/FIELD_MARGIN));
  }
  private holdRoller(caster:Fighter){
    if(caster.state.fighter!=='dio')return;
    const pose=rollerAt(this.castAge+this.t,this.finish);
    if(!pose||pose.since>=0)return;
    const v=this.releaseVictim?.state.alive?this.releaseVictim.group.position:this.fieldCentre;
    const k=THREE.MathUtils.smoothstep(pose.since,-ROLLER_TIMING.drop,-ROLLER_TIMING.drop+ROLLER_EASE);
    const top=1.9+(pose.height+ROLLER_TOP*pose.squash-1.9)*k;
    this.holdBody(v,Math.max(1.9,top));
  }
  private fieldFrom=new THREE.Vector3();private gatherFor?:Fighter;private gatherOrigin=this.fieldFrom;
  private gatherX=0;private gatherZ=0;private gatherN=0;private gatherCount=0;private gatherSpread=0;
  private holdNeed=0;private holdForward=new THREE.Vector3();private holdRight=new THREE.Vector3();private holdUp=new THREE.Vector3();private holdPoint=new THREE.Vector3();
  private inField(body:Fighter){
    const caster=this.gatherFor,p=body.group.position,q=body.state;
    if(!caster||body===caster||!q.alive||(caster.state.team!==undefined&&q.team===caster.state.team))return false;
    if(this.tourAnchored&&this.caughtCount)return this.caught.indexOf(body)>=0&&this.caught.indexOf(body)<this.caughtCount;
    return Math.hypot(p.x-this.gatherOrigin.x,p.z-this.gatherOrigin.z)<=this.stopRadius+.5;
  }
  private catchOne=(body:Fighter)=>{
    const caster=this.gatherFor,p=body.group.position,q=body.state;
    if(!caster||body===caster||!q.alive||(caster.state.team!==undefined&&q.team===caster.state.team))return;
    if(Math.hypot(p.x-this.gatherOrigin.x,p.z-this.gatherOrigin.z)>this.stopRadius+.5)return;
    if(this.caughtCount<this.caught.length)this.caught[this.caughtCount]=body;else this.caught.push(body);
    this.caughtCount++;
  };
  private fieldGather=(body:Fighter)=>{if(!this.inField(body))return;this.gatherX+=body.group.position.x;this.gatherZ+=body.group.position.z;this.gatherN++;this.gatherCount++;};
  private fieldExtent=(body:Fighter)=>{if(this.inField(body))this.gatherSpread=Math.max(this.gatherSpread,Math.hypot(body.group.position.x-this.gatherX,body.group.position.z-this.gatherZ));};
  private fieldHold=(body:Fighter)=>{if(this.inField(body))this.holdBody(body.group.position,1.9*bodyBulk(body.state));};
  private holdBody(p:THREE.Vector3,top:number){
    for(let k=0;k<2;k++){
      const v=this.holdPoint.set(p.x-this.eye.x,p.y+(k?top:0)-this.eye.y,p.z-this.eye.z),depth=v.dot(this.holdForward);
      if(depth<.3){this.holdNeed=Math.max(this.holdNeed,10);continue;}
      this.holdNeed=Math.max(this.holdNeed,Math.abs(v.dot(this.holdUp))/depth,Math.abs(v.dot(this.holdRight))/depth/this.aspect);
    }
  }
  private releaseBearing(caster:Fighter,bulk:number){
    const p=caster.group.position,victim=this.releaseVictim?.state.alive?this.releaseVictim:undefined,v=victim?.group.position;
    const bearing=v?Math.atan2(v.x-p.x,v.z-p.z):this.facing,d=v?Math.hypot(v.x-p.x,v.z-p.z):RELEASE_AHEAD;
    const behind=RELEASE_BEHIND+RELEASE_CLOSE*(1-THREE.MathUtils.smoothstep(d,1.5,4));
    const want=RELEASE_R*bulk+CLEARANCE;
    const fresh=!Number.isFinite(this.releaseGoalTurn);
    if(!fresh&&(this.t-this.releaseSearched<RESEARCH||this.releaseMiss(caster,bulk,bearing,this.releaseGoalSide,this.releaseGoalTurn,victim,want)===0)){
      if(this.t-this.releaseSearched>=RESEARCH)this.releaseGoalReach=this.probeReach;
      return bearing+this.releaseGoalSide*(Math.PI-this.releaseGoalTurn);
    }
    this.releaseSearched=this.t;
    let bestTurn=behind,bestSide=this.side,bestMiss=Infinity,bestReach=RELEASE_R*bulk;
    for(let k=0;k<(fresh?2:1);k++){
      const side=k?-this.side:this.side;
      for(let turn=behind;turn<=RELEASE_SEARCH+1e-6;turn+=RELEASE_TURN){
        const miss=this.releaseMiss(caster,bulk,bearing,side,turn,victim,want)+(k?.25:0)+(turn-behind)*.05;
        if(miss<bestMiss){bestMiss=miss;bestTurn=turn;bestSide=side;bestReach=this.probeReach;}
        if(miss<.3)break;
      }
      if(bestMiss<.3)break;
    }
    this.releaseGoalTurn=bestTurn;this.releaseGoalSide=bestSide;this.releaseGoalReach=bestReach;
    return bearing+bestSide*(Math.PI-bestTurn);
  }
  private turnRelease(caster:Fighter,bulk:number,step:number){
    const goal=this.releaseAz+wrapped(this.releaseBearing(caster,bulk)-this.releaseAz),speed=Math.min(TURN_SPEED,TURN_REACH/Math.max(RELEASE_R,1e-3));
    for(let left=step;left>1e-9;left-=1/120){
      const h=Math.min(1/120,left),error=goal-this.releaseAz,size=Math.abs(error);
      const wanted=Math.sign(error)*Math.min(speed,Math.sqrt(1.8*TURN_ACCEL*size),TURN_GAIN*size);
      this.releaseTurn+=THREE.MathUtils.clamp(wanted-this.releaseTurn,-TURN_ACCEL*h,TURN_ACCEL*h);
      this.releaseAz+=this.releaseTurn*h;
    }
  }
  private releasePose(caster:Fighter,bulk:number){
    const p=this.pivot,c=caster.group.position,victim=this.releaseVictim?.state.alive?this.releaseVictim:undefined;
    const far=this.point;
    if(victim){const v=victim.group.position;far.set(v.x,v.y+1.1*bodyBulk(victim.state),v.z);}
    else far.set(p.x+Math.sin(this.facing)*RELEASE_AHEAD,p.y,p.z+Math.cos(this.facing)*RELEASE_AHEAD);
    const radius=this.overhead?this.chargeSphere(caster,this.castAge+this.t,this.charge):0;
    const offset=-this.releaseGoalSide*Math.atan(RELEASE_X*Math.tan(THREE.MathUtils.degToRad(RELEASE_FOV)/2)*this.aspect);
    const most=Math.max(RELEASE_R*bulk,Math.min((this.overhead?RELEASE_REACH_CHARGE:RELEASE_REACH)*bulk,this.clear(this.releaseAz,(this.overhead?RELEASE_REACH_CHARGE:RELEASE_REACH)*bulk,this.walls)));
    let r=Math.max(RELEASE_R*bulk,this.summonCount?this.releaseGoalReach:0),yaw=0,pitch=0,fov=RELEASE_FOV,need=0;
    for(let pass=0;pass<4;pass++){
      this.eye.set(p.x+Math.sin(this.releaseAz)*r,p.y+RELEASE_EYE*bulk,p.z+Math.cos(this.releaseAz)*r);
      yaw=Math.atan2(far.x-this.eye.x,far.z-this.eye.z)+offset;
      this.fitCount=0;this.fitSide=0;this.fitYaw=yaw;
      if(caster.state.fighter!=='boa-hancock'){
        this.fitPoint(c.x,c.y+1.9*bulk,c.z,1,RELEASE_TOP,1,false);this.fitPoint(p.x,p.y,p.z,.8,RELEASE_TOP,1,false);
      }
      if(victim){const v=victim.group.position,vb=bodyBulk(victim.state);this.fitPoint(v.x,v.y+1.9*vb,v.z,.85,RELEASE_TOP,1,false);this.fitPoint(v.x,v.y,v.z,.85,1,RELEASE_FEET,false);}
      if(caster.state.fighter==='boa-hancock')for(const name of ['Head','LeftHand','RightHand','LeftFoot','RightFoot']){
        const joint=caster.drawnJoint(name);if(!joint)continue;
        joint.getWorldPosition(this.sightTo);
        this.fitPoint(this.sightTo.x,this.sightTo.y+.22*bulk,this.sightTo.z,.85,RELEASE_TOP,1,false);
      }
      if(caster.state.fighter==='nami'&&victim){
        const y=victim.group.position.y+3.6,x=Math.cos(yaw)*1.4,z=-Math.sin(yaw)*1.4;
        this.fitPoint(far.x,y,far.z,.85,RELEASE_TOP,1,false);
        this.fitPoint(far.x+x,y-.65,far.z+z,.92,RELEASE_TOP,1,false);
        this.fitPoint(far.x-x,y-.65,far.z-z,.92,RELEASE_TOP,1,false);
      }
      if(this.overhead){this.fitPoint(this.charge.x,this.charge.y,this.charge.z,.9,RELEASE_TOP,1,false);this.fitPoint(this.charge.x,this.charge.y+radius*CHARGE_TOP,this.charge.z,.9,RELEASE_TOP,1,true);}
      let lo=Math.tan(THREE.MathUtils.degToRad(20)),hi=Math.tan(THREE.MathUtils.degToRad(60));
      for(let i=0;i<14;i++){const mid=(lo+hi)/2;if(this.pitchRange(mid,false))hi=mid;else lo=mid;}
      need=hi;
      const tall=THREE.MathUtils.radToDeg(2*Math.atan(hi)),wide=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.min(this.fitSide,1.4))/this.aspect));
      fov=Math.max(tall,wide);
      if(fov<=RELEASE_FOV_MOST||r>=most-1e-6)break;
      r=Math.min(most,r*fov/RELEASE_FOV_MOST);
    }
    this.fov=THREE.MathUtils.clamp(fov,RELEASE_FOV,RELEASE_FOV_MOST);
    const half=Math.tan(THREE.MathUtils.degToRad(this.fov)/2);
    if(this.pitchRange(half,true))pitch=(this.fitFrom+this.fitTo)/2;
    else if(this.pitchRange(half,false))pitch=this.fitTo;
    else{this.pitchRange(need,false);pitch=(this.fitFrom+this.fitTo)/2;}
    const reach=Math.max(1,Math.hypot(far.x-this.eye.x,far.z-this.eye.z)*.6);
    this.look.set(this.eye.x+Math.sin(yaw)*Math.cos(pitch)*reach,this.eye.y+Math.sin(pitch)*reach,this.eye.z+Math.cos(yaw)*Math.cos(pitch)*reach);
  }
  private fitPoint(x:number,y:number,z:number,share:number,top:number,bottom:number,soft:boolean){
    const dx=x-this.eye.x,dz=z-this.eye.z,flat=Math.hypot(dx,dz),k=this.fitCount++;
    this.fitEl[k]=Math.atan2(y-this.eye.y,Math.max(flat,.3));this.fitTop[k]=top;this.fitBottom[k]=bottom;this.fitSoft[k]=soft?1:0;
    this.fitSide=Math.max(this.fitSide,Math.atan(Math.tan(Math.min(Math.abs(wrapped(Math.atan2(dx,dz)-this.fitYaw)),1.4))/share));
  }
  private pitchRange(half:number,soft:boolean){
    let from=-Infinity,to=Infinity;
    for(let k=0;k<this.fitCount;k++){
      if(!soft&&this.fitSoft[k])continue;
      const el=this.fitEl[k];
      from=Math.max(from,el-Math.atan(this.fitTop[k]*half));to=Math.min(to,el+Math.atan(this.fitBottom[k]*half));
    }
    this.fitFrom=from;this.fitTo=to;
    return from<=to;
  }
  private between(u:number){
    const p=this.pivot,azA=Math.atan2(this.heroEye.x-p.x,this.heroEye.z-p.z),azB=Math.atan2(this.eye.x-p.x,this.eye.z-p.z);
    const short=wrapped(azB-azA),turn=this.swingLong?short-Math.sign(short||1)*Math.PI*2:short;
    const az=azA+turn*u,r=THREE.MathUtils.lerp(Math.hypot(this.heroEye.x-p.x,this.heroEye.z-p.z),Math.hypot(this.eye.x-p.x,this.eye.z-p.z),u);
    const y=THREE.MathUtils.lerp(this.heroEye.y,this.eye.y,u);
    this.eye.set(p.x+Math.sin(az)*r,y,p.z+Math.cos(az)*r);
    this.look.lerpVectors(this.heroLook,this.look,u);this.fov=THREE.MathUtils.lerp(this.heroFov,this.fov,u);
  }
  private swingClearance(long:boolean){
    if(!this.crowd)return Infinity;
    const p=this.pivot,azA=Math.atan2(this.heroEye.x-p.x,this.heroEye.z-p.z),azB=Math.atan2(this.eye.x-p.x,this.eye.z-p.z),short=wrapped(azB-azA),turn=long?short-Math.sign(short||1)*Math.PI*2:short;
    const rA=Math.hypot(this.heroEye.x-p.x,this.heroEye.z-p.z),rB=Math.hypot(this.eye.x-p.x,this.eye.z-p.z);
    this.pathLeast=Infinity;
    for(let i=1;i<=SWING_SAMPLES;i++){
      const w=i/(SWING_SAMPLES+1),az=azA+turn*w,r=THREE.MathUtils.lerp(rA,rB,w);
      this.nearFrom.set(p.x+Math.sin(az)*r,THREE.MathUtils.lerp(this.heroEye.y,this.eye.y,w),p.z+Math.cos(az)*r);
      this.crowd.forEach(this.pathAir);
    }
    return this.pathLeast;
  }
  private pathLeast=Infinity;private swingLong=false;
  private cine=false;private cineKey:number=NaN;
  private gameLook=new THREE.Vector3();
  private gameLens=50;private frameDt=0;
  private pathAir=(body:Fighter)=>{
    if(body===this.subject||!body.state.alive||!body.group.visible)return;
    const q=body.group.position,bulk=drawnBulk(body),e=this.nearFrom;
    if(e.y>q.y+BODY_HEIGHT*bulk+LENS_CLEAR)return;
    this.pathLeast=Math.min(this.pathLeast,Math.hypot(e.x-q.x,e.z-q.z)-BODY_RADIUS*bulk);
  };
  private travel(base:number,other:THREE.Vector3){
    const p=this.pivot,angle=Math.abs(wrapped(Math.atan2(this.eye.x-p.x,this.eye.z-p.z)-Math.atan2(other.x-p.x,other.z-p.z)));
    return Math.max(this.lensSwing(base,other),Math.min(SWING_LONGEST,base*THREE.MathUtils.clamp(angle/SWING,1,SWING_MOST)));
  }
  private impact(victim:Fighter,caster:Fighter|undefined,eye:THREE.Vector3|undefined,bulk:number){
    this.setPivot(victim,bulk,'impact');
    const p=this.pivot,bridged=this.kind!=='none'&&this.weight>1e-3,from=bridged?this.shownEye:eye??this.scratch.set(p.x,p.y+1,p.z-4);
    const fromAz=Math.atan2(from.x-p.x,from.z-p.z),back=caster?Math.atan2(caster.group.position.x-p.x,caster.group.position.z-p.z):fromAz;
    this.impactFloor=caster?Math.min(caster.group.position.y,victim.group.position.y):victim.group.position.y;this.impactDownAt=-1;this.impactFlew=false;
    const side=wrapped(fromAz-back)>=0?1:-1,r=IMPACT_R*bulk,height=p.y+this.impactEye(bulk);
    this.impactAz=back+side*IMPACT_ANGLE;
    this.predictAhead(victim,caster);
    if(caster)this.summonsFor(caster,caster.state.actionTime*caster.state.actionDuration);
    let seen=NaN,best=Infinity;
    for(let k=0;k<4;k++){
      const az=back+(k<2?side:-side)*(k%2?IMPACT_WIDE:IMPACT_ANGLE);
      if(!this.seesFrom(az,r,height,victim,bulk))continue;
      this.probeEye.set(p.x+Math.sin(az)*r,height,p.z+Math.cos(az)*r);
      const crowd=this.inSummon(this.probeEye)?1:this.crowdCover(this.probeEye,p,IMPACT_FOV,victim);
      const roomy=this.roomAt(az,r)>=r*IMPACT_ROOM;
      if(roomy&&crowd<=CROWD_MOST){seen=az;break;}
      const score=crowd+(roomy?0:.3)+k*.01;
      if(score<best){best=score;seen=az;}
    }
    if(Number.isFinite(seen))this.impactAz=seen;
    this.impactGoal=this.impactAz;this.impactTurn=0;this.drawnOffset.set(0,0,0);this.impactFit=IMPACT_FOV;
    this.eye.set(p.x+Math.sin(this.impactAz)*r,height,p.z+Math.cos(this.impactAz)*r);
    const swing=this.travel(IMPACT_IN,from);
    this.impactIn=bridged?0:swing;this.impactCarry=bridged?Math.max(IMPACT_CARRY,swing):CARRY;
    this.impactLead=bridged?this.impactCarry:this.impactIn;this.out=IMPACT_OUT;
    this.length=this.impactHold()+IMPACT_OUT;
  }
  private stretch(other:THREE.Vector3){
    return THREE.MathUtils.clamp(Math.abs(wrapped(this.heroAz-Math.atan2(other.x-this.pivot.x,other.z-this.pivot.z)))/SWING,1,SWING_MOST);
  }
  private lensSwing(base:number,other:THREE.Vector3){
    const p=this.pivot,rA=Math.hypot(other.x-p.x,other.z-p.z),rB=Math.hypot(this.eye.x-p.x,this.eye.z-p.z);
    const angle=Math.abs(wrapped(Math.atan2(this.eye.x-p.x,this.eye.z-p.z)-Math.atan2(other.x-p.x,other.z-p.z)));
    return THREE.MathUtils.clamp(1.875*Math.hypot(angle*Math.max(rA,rB),rB-rA,this.eye.y-other.y)/LENS_SPEED,base,SWING_LONGEST);
  }
  private swingClear(subject:Fighter,framing:number,side:number,bulk:number,from:THREE.Vector3){
    const p=this.pivot;
    this.heroPose(subject,HERO_IN,framing,this.facing+side*HERO_FRAMINGS[framing].angle,bulk);
    return this.swingSees(subject,bulk,from,Math.atan2(this.eye.x-p.x,this.eye.z-p.z),Math.hypot(this.eye.x-p.x,this.eye.z-p.z),this.eye.y);
  }
  private swingSees(subject:Fighter,bulk:number,from:THREE.Vector3,az:number,r:number,height:number){
    const p=this.pivot,azG=Math.atan2(from.x-p.x,from.z-p.z),rG=Math.hypot(from.x-p.x,from.z-p.z);
    for(let i=1;i<=SWING_SAMPLES;i++){
      const w=i/(SWING_SAMPLES+1),a=azG+wrapped(az-azG)*w,reach=THREE.MathUtils.lerp(rG,r,w),y=THREE.MathUtils.lerp(from.y,height,w);
      if(!this.seesFrom(a,reach,y,subject,bulk))return false;
      this.nearFrom.set(p.x+Math.sin(a)*reach,y,p.z+Math.cos(a)*reach);
      if(this.lensNearBody(subject))return false;
    }
    return true;
  }
  private lensNearBody(subject:Fighter){
    if(!this.crowd)return false;
    this.nearSkip=subject;this.nearHit=false;this.crowd.forEach(this.bodyNear);this.nearSkip=undefined;
    return this.nearHit;
  }
  private bodyNear=(body:Fighter)=>{
    if(this.nearHit||body===this.nearSkip||!body.state.alive||!body.group.visible)return;
    const q=body.group.position,bulk=bodyBulk(body.state),e=this.nearFrom;
    if(e.y<q.y+BODY_HEIGHT*bulk+LENS_CLEAR&&Math.hypot(e.x-q.x,e.z-q.z)<BODY_RADIUS*bulk+LENS_CLEAR)this.nearHit=true;
  };
  private seenFor(subject:Fighter,framing:number,side:number,bulk:number){
    const samples=6;
    for(let i=0;i<=samples;i++){
      const t=this.length*(.2+.8*i/samples);
      this.heroPose(subject,t,framing,this.facing+side*HERO_FRAMINGS[framing].angle,bulk);
      if(!this.sees(this.eye,subject,bulk,t))return i===0?0:this.length*(.2+.8*(i-1)/samples);
    }
    return Infinity;
  }
  private heroPose(subject:Fighter,t:number,framing:number,az:number,bulk:number){
    const f=HERO_FRAMINGS[framing],p=this.pivot,eyeY=p.y+f.eye*bulk;
    if(this.overhead){
      const radius=this.chargeSphere(subject,this.castAge+t,this.charge);
      this.fitCharge(az,eyeY,HERO_FROM*bulk,subject.group.position.y-.1,this.charge.y+radius*CHARGE_TOP+.15,this.clear(az,CHARGE_REACH,this.walls));
      const r=this.fitR;
      this.eye.set(p.x+Math.sin(az)*r,eyeY,p.z+Math.cos(az)*r);
      this.look.set(p.x,eyeY+r*Math.tan(this.fitPitch),p.z);this.fov=this.fitFov;
      return;
    }
    const r=THREE.MathUtils.lerp(f.from,f.to,ease(t/this.planned))*bulk;
    this.eye.set(p.x+Math.sin(az)*r,eyeY,p.z+Math.cos(az)*r);
    this.look.copy(p).y+=HERO_LOOK*bulk;this.fov=HERO_FOV;
  }
  private turnHero(subject:Fighter,bulk:number,step:number,front:number){
    const p=this.pivot,r=Math.hypot(this.eye.x-p.x,this.eye.z-p.z),height=this.eye.y,here=this.heroAz;
    let goal=here;
    if(this.seesFrom(here,r,height,subject,bulk)){
      this.blocked=0;
      const want=wrapped(front-here),way=Math.sign(want),span=Math.abs(want);goal=here+want;
      for(let k=1;(k-1)*TURN_STEP<span;k++){
        const o=Math.min(k*TURN_STEP,span);
        if(!this.seesFrom(here+way*o,r,height,subject,bulk)){goal=here+way*Math.max(0,(k-1)*TURN_STEP);break;}
      }
    }else{
      const way=wrapped(front-here)<0?-1:1;let found=false;
      for(let k=1;k*TURN_STEP<=TURN_SEARCH&&!found;k++){
        if(this.seesFrom(here+way*k*TURN_STEP,r,height,subject,bulk)){goal=here+way*k*TURN_STEP;found=true;}
        else if(this.seesFrom(here-way*k*TURN_STEP,r,height,subject,bulk)){goal=here-way*k*TURN_STEP;found=true;}
      }
      if(found)this.blocked=0;else{this.blocked+=step;goal=here+wrapped(front-here);}
    }
    if(this.blocked>BLOCKED_GRACE)this.cancel(INTERRUPT);
    const speed=Math.min(TURN_SPEED,TURN_REACH/Math.max(r,1e-3));
    for(let left=step;left>1e-9;left-=1/120){
      const h=Math.min(1/120,left),error=goal-this.heroAz,size=Math.abs(error);
      const wanted=Math.sign(error)*Math.min(speed,Math.sqrt(1.8*TURN_ACCEL*size),TURN_GAIN*size);
      this.heroTurn+=THREE.MathUtils.clamp(wanted-this.heroTurn,-TURN_ACCEL*h,TURN_ACCEL*h);
      this.heroAz+=this.heroTurn*h;
    }
    return this.heroAz!==here;
  }
  private impactEye(bulk:number){return Math.min(IMPACT_EYE*bulk,this.impactFloor+IMPACT_TOP*Math.max(1,bulk)-this.pivot.y);}
  private impactHold(){
    const down=this.impactDownAt>=0?this.impactDownAt:Infinity;
    return Math.max(this.impactLead+IMPACT_HOLD,Math.min(down,this.impactLead+IMPACT_AIR)+IMPACT_DOWN);
  }
  private impactFlew=false;
  private predictAhead(body:Fighter,thrower?:Fighter){
    this.ahead.copy(this.pivot);
    const v=body.velocity;
    if(v)this.scratch.set(v.x,0,v.z).multiplyScalar(IMPACT_AHEAD);else this.scratch.set(0,0,0);
    if(thrower&&this.scratch.lengthSq()<.25){
      const t=thrower.group.position,p=body.group.position;this.scratch.set(p.x-t.x,0,p.z-t.z);
      if(this.scratch.lengthSq()>1e-6)this.scratch.setLength(IMPACT_THROW);
    }
    if(this.scratch.lengthSq()>IMPACT_AHEAD_MOST*IMPACT_AHEAD_MOST)this.scratch.setLength(IMPACT_AHEAD_MOST);
    const reach=this.scratch.length();
    if(reach>1e-4&&this.walls.length){
      this.ray.set(this.pivot,this.scratch.divideScalar(reach));this.ray.far=reach+CLEARANCE;
      this.hits.length=0;this.ray.intersectObjects(this.walls as THREE.Object3D[],true,this.hits);
      this.ahead.addScaledVector(this.scratch,this.hits.length?Math.max(0,this.hits[0].distance-CLEARANCE):reach);
    }else this.ahead.add(this.scratch);
  }
  private roomAt(az:number,want:number){
    return Math.min(this.clear(az,want,this.walls,this.ahead),this.clear(az-IMPACT_CONE,want,this.walls,this.ahead),this.clear(az+IMPACT_CONE,want,this.walls,this.ahead));
  }
  private followDrawn(subject:Fighter,step:number){
    const drawn=subject as unknown as {visualCenter?:(out:THREE.Vector3)=>THREE.Vector3};
    if(typeof drawn.visualCenter!=='function')return;
    drawn.visualCenter(this.drawnPoint).sub(this.pivot);
    if(this.drawnPoint.lengthSq()>4)this.drawnPoint.setLength(2);
    this.drawnOffset.lerp(this.drawnPoint,blend(IMPACT_DRAWN,step));
    this.pivot.add(this.drawnOffset);
  }
  private turnImpact(subject:Fighter,bulk:number,step:number){
    const r=IMPACT_R*bulk,want=r*IMPACT_ROOM,height=this.pivot.y+this.impactEye(bulk);
    if(this.walls.length){
      this.predictAhead(subject);
      if(this.roomAt(this.impactGoal,r)<want){
        const way=this.impactTurn<0?-1:1;let found=false,best=-1,roomiest=this.impactGoal;
        for(let k=1;k*IMPACT_STEP<=IMPACT_SEARCH&&!found;k++)for(let side=0;side<2&&!found;side++){
          const az=this.impactGoal+(side?-way:way)*k*IMPACT_STEP,room=this.roomAt(az,r);
          if(room>=want&&this.seesFrom(az,r,height,subject,bulk)){this.impactGoal=az;found=true;}
          else if(room>best){best=room;roomiest=az;}
        }
        if(!found)this.impactGoal=roomiest;
      }
    }
    const ease=IMPACT_EASE_FLOOR+(1-IMPACT_EASE_FLOOR)*THREE.MathUtils.smoothstep(this.t,0,IMPACT_EASE),accel=TURN_ACCEL*ease;
    const speed=Math.min(TURN_SPEED,TURN_REACH/Math.max(r,1e-3));
    for(let left=step;left>1e-9;left-=1/120){
      const h=Math.min(1/120,left),error=this.impactGoal-this.impactAz,size=Math.abs(error);
      const wanted=Math.sign(error)*Math.min(speed,Math.sqrt(1.8*accel*size),TURN_GAIN*size);
      this.impactTurn+=THREE.MathUtils.clamp(wanted-this.impactTurn,-accel*h,accel*h);
      this.impactAz+=this.impactTurn*h;
    }
  }
  private fieldFor(body:Fighter,eye:THREE.Vector3,look:THREE.Vector3){
    const lx=look.x-eye.x,ly=look.y-eye.y,lz=look.z-eye.z,ll=Math.hypot(lx,ly,lz)||1,joints=body.joints,p=body.group.position;
    let most=0,found=false;
    for(let i=0;i<FIT_JOINTS.length;i++){
      const bone=joints?.get(FIT_JOINTS[i]);if(!bone)continue;
      bone.getWorldPosition(this.drawnPoint);if(i===0)this.drawnPoint.y+=.24*bodyBulk(body.state);
      most=Math.max(most,this.offLook(eye,lx,ly,lz,ll));found=true;
    }
    if(!found){
      this.drawnPoint.copy(p);most=this.offLook(eye,lx,ly,lz,ll);
      this.drawnPoint.y+=1.9*bodyBulk(body.state);most=Math.max(most,this.offLook(eye,lx,ly,lz,ll));
    }
    return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.min(most,1.4))/IMPACT_FILL)),IMPACT_FOV,IMPACT_FOV_MOST);
  }
  private victoryField(body:Fighter,eye:THREE.Vector3,look:THREE.Vector3){
    const lx=look.x-eye.x,ly=look.y-eye.y,lz=look.z-eye.z,ll=Math.hypot(lx,ly,lz)||1,joints=body.joints,bulk=bodyBulk(body.state);
    let most=0;
    for(let i=0;i<VICTORY_FIT.length;i++){
      const bone=joints?.get(VICTORY_FIT[i]);if(!bone)continue;
      bone.getWorldPosition(this.drawnPoint);this.drawnPoint.y+=(i===0?.24:.1)*bulk;
      most=Math.max(most,this.offLook(eye,lx,ly,lz,ll));
    }
    return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.min(most,1.4))/VICTORY_FILL)),VICTORY_FOV,VICTORY_FOV_MOST);
  }
  private offLook(eye:THREE.Vector3,lx:number,ly:number,lz:number,ll:number){
    const dx=this.drawnPoint.x-eye.x,dy=this.drawnPoint.y-eye.y,dz=this.drawnPoint.z-eye.z,d=Math.hypot(dx,dy,dz)||1;
    return Math.acos(THREE.MathUtils.clamp((dx*lx+dy*ly+dz*lz)/(d*ll),-1,1));
  }
  private seesFrom(az:number,r:number,height:number,subject:Fighter,bulk:number){
    const p=this.pivot;this.scratch.set(p.x+Math.sin(az)*r,height,p.z+Math.cos(az)*r);
    return this.sees(this.scratch,subject,bulk,0);
  }
  private chargeSphere(subject:Fighter,age:number,out:THREE.Vector3){
    const state=subject.state,p=subject.group.position,charge=THREE.MathUtils.clamp(age/Math.max(this.release,1e-3),0,1);
    if(state.fighter==='naruto'){
      const size=NARUTO_BOMB*(.14+.86*Math.pow(charge,.8));
      if(typeof subject.chargePosition==='function')subject.chargePosition(out);else out.set(p.x,p.y+2.1,p.z);
      if(!state.awakened)out.y+=size+.1;
      return size;
    }
    const at=OVERHEAD[state.fighter]??BOMB;out.set(p.x,p.y+at.height,p.z);
    return at.radius*(at.from+(1-at.from)*Math.pow(charge,at.power));
  }
  private fitCharge(az:number,eyeY:number,nearest:number,feet:number,top:number,room:number){
    const p=this.pivot,c=this.charge,ux=Math.sin(az),uz=Math.cos(az),share=1-CHARGE_TOP_EDGE-CHARGE_FOOT_EDGE,usable=THREE.MathUtils.degToRad(CHARGE_FOV)*share;
    let lo=.5,hi=CHARGE_REACH;
    for(let i=0;i<18;i++){
      const mid=(lo+hi)/2,toCharge=Math.hypot(p.x+ux*mid-c.x,p.z+uz*mid-c.z);
      if(Math.atan2(top-eyeY,toCharge)-Math.atan2(feet-eyeY,mid)>usable)lo=mid;else hi=mid;
    }
    const r=Math.max(MIN_REACH,Math.min(CHARGE_REACH,softMax(nearest,hi,.8),room)),toCharge=Math.hypot(p.x+ux*r-c.x,p.z+uz*r-c.z);
    const up=Math.atan2(top-eyeY,toCharge),down=Math.atan2(feet-eyeY,r);
    const fov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg((up-down)/share),CHARGE_FOV,CHARGE_FOV_MOST),half=THREE.MathUtils.degToRad(fov)/2;
    const lowest=up-half+2*half*CHARGE_TOP_EDGE,highest=down+half-2*half*CHARGE_FOOT_EDGE;
    this.fitR=r;this.fitFov=fov;this.fitPitch=lowest<=highest?(lowest+highest)/2:highest;
  }
  private sees(eye:THREE.Vector3,subject:Fighter,bulk:number,ahead:number){
    const crowd=this.crowd,bodies=!!crowd&&crowd.size>1;
    if(!bodies&&!this.summonCount)return true;
    const p=subject.group.position;
    this.sightFrom.copy(eye);this.sightSubject=subject;this.sightAhead=Math.min(ahead,PREDICT);this.sightBlocked=false;
    this.sightTo.set(p.x,p.y+1.1*bulk,p.z);if(bodies)crowd!.forEach(this.blocks);if(!this.sightBlocked)this.sightBlocked=this.summonBlocks();
    if(!this.sightBlocked){this.sightTo.set(p.x,p.y+1.62*bulk,p.z);if(bodies)crowd!.forEach(this.blocks);if(!this.sightBlocked)this.sightBlocked=this.summonBlocks();}
    this.sightSubject=undefined;
    return !this.sightBlocked;
  }
  private blocks=(body:Fighter)=>{
    if(this.sightBlocked||body===this.sightSubject||!body.state.alive||!body.group.visible)return;
    const p=body.group.position,v=body.velocity,ahead=this.sightAhead,bulk=drawnBulk(body),radius=BODY_RADIUS*bulk;
    const x=p.x+(v?v.x*ahead:0),z=p.z+(v?v.z*ahead:0);
    if(sightClearance(this.sightFrom,this.sightTo,x,z,p.y+radius,p.y+BODY_HEIGHT*bulk-radius,radius+SIGHT_CLEAR)<radius+SIGHT_CLEAR)this.sightBlocked=true;
  };
  private orbitClear(winner:Fighter,side:number,from:THREE.Vector3,turn=this.victoryTurn){
    const size=bodyBulk(winner.state),r=VICTORY_RADIUS*size,height=this.pivot.y+VICTORY_EYE*size;
    for(let i=0;i<=4;i++){
      const az=this.facing+side*(VICTORY_ANGLE+turn+.6*i/4);
      this.scratch.set(this.pivot.x+Math.sin(az)*r,height,this.pivot.z+Math.cos(az)*r);
      if(!this.sees(this.scratch,winner,size,0))return false;
    }
    return this.opening||this.swingSees(winner,size,from,this.facing+side*(VICTORY_ANGLE+turn),r,height);
  }
  private orbitRoom(winner:Fighter,side:number,turn:number){
    const r=VICTORY_RADIUS*bodyBulk(winner.state);let room=1;
    for(let i=0;i<=4;i++)room=Math.min(room,this.clear(this.facing+side*(VICTORY_ANGLE+turn+.6*i/4),r,this.walls)/r);
    return room;
  }
  private sweepClear(player:Fighter,side:number,from?:THREE.Vector3){
    for(let i=0;i<=4;i++){
      const u=i/4,az=this.facing+side*(INTRO_FRONT+.3*u),r=INTRO_RADIUS-.8*u;
      this.scratch.set(this.pivot.x+Math.sin(az)*r,this.pivot.y+.15,this.pivot.z+Math.cos(az)*r);
      if(!this.sees(this.scratch,player,1,0))return false;
    }
    return this.opening||!from||this.swingSees(player,1,from,this.facing+side*INTRO_FRONT,INTRO_RADIUS,this.pivot.y+.15);
  }
  private setPivot(subject:Fighter,bulk:number,kind=this.kind){
    const p=subject.group.position;
    this.pivot.set(p.x,p.y+(kind==='ko'?.9:kind==='awaken'?1.2:1.1)*(kind==='awaken'?(subject.state.fighter==='pikachu'?.5:1):bulk),p.z);
  }
  private drawnHeads(subject:Fighter){
    const p=subject.group.position,own=subject.joints?.get('Head'),point=this.awakenPoint;
    if(own)own.getWorldPosition(this.awakenOwn);else this.awakenOwn.set(p.x,p.y+1.62,p.z);
    point.copy(this.awakenOwn);
    if(this.awakenForm>0){
      if(this.awakenBoneOf!==subject.group){
        this.awakenBone=undefined;this.awakenBoneOf=subject.group;
        const def=AWAKENINGS[subject.state.fighter];
        if(def?.kind==='form'&&def.formTint===undefined&&subject.model){this.findUnder=subject.model;subject.group.traverse(this.findHead);this.findUnder=undefined;}
      }
      if(this.awakenBone){
        this.awakenBone.getWorldPosition(this.awakenFormAt);this.awakenFormAt.y=Math.max(this.awakenFormAt.y,this.awakenOwn.y);
        point.lerp(this.awakenFormAt,this.awakenForm);
      }
    }
    let top=point.y+AWAKEN_CROWN;const most=Math.max(point.y,p.y+AWAKEN_STANDING)+AWAKEN_CROWN_MOST;
    const loom=loomTop(subject.state.id);
    if(loom>0)top=Math.max(top,Math.min(p.y+loom+AWAKEN_STAND_CROWN,most));
    this.awakenCrown.set(point.x,top,point.z);
    this.awakenExcessGoal=Math.max(0,top-point.y-AWAKEN_CROWN);
  }
  private findUnder?:THREE.Object3D;
  private findHead=(object:THREE.Object3D)=>{
    if(this.awakenBone||!(object as THREE.Bone).isBone||!/^head$/i.test(object.name))return;
    for(let o:THREE.Object3D|null=object;o;o=o.parent)if(o===this.findUnder)return;
    this.awakenBone=object;
  };
  private formShare(state:{fighter:FighterId;awakened?:boolean}){
    if(!state.awakened)return 0;
    const swap=awakeningSwapAt(state.fighter);
    return THREE.MathUtils.smoothstep(this.awakenClock,swap-AWAKEN_FORM_LEAD,swap+AWAKEN_FORM_LAG);
  }
  private followHead(subject:Fighter){
    this.drawnHeads(subject);
    const dt=Math.min(this.frameDt,.1);
    this.spring(this.awakenOwnFollow,this.awakenOwnV,this.awakenOwn,dt);
    const x=this.awakenHead.copy(this.awakenOwnFollow);
    if(this.awakenForm>0&&this.awakenBone){
      if(!this.awakenFormSeen){this.awakenFormSeen=true;this.awakenFormFollow.copy(this.awakenFormAt);this.awakenFormV.set(0,0,0);}
      else this.spring(this.awakenFormFollow,this.awakenFormV,this.awakenFormAt,dt);
      x.lerp(this.awakenFormFollow,this.awakenForm);
    }
    this.awakenExcess+=(this.awakenExcessGoal-this.awakenExcess)*blend(AWAKEN_EXCESS_RATE,dt);
    x.y+=this.awakenExcess*.5;
    const p=subject.group.position,dx=x.x-p.x,dz=x.z-p.z,d=Math.hypot(dx,dz),reach=AWAKEN_REACH*Math.max(1,this.awakenSize,1+(bodyBulk(subject.state)-1)*this.awakenForm);
    if(d>reach){x.x=p.x+dx/d*reach;x.z=p.z+dz/d*reach;}
    this.awakenCrown.x=x.x;this.awakenCrown.z=x.z;
  }
  private spring(x:THREE.Vector3,v:THREE.Vector3,goal:THREE.Vector3,dt:number){
    if(x.distanceToSquared(goal)>4){x.copy(goal);v.set(0,0,0);return;}
    const k=1/AWAKEN_TRACK;
    for(let left=dt;left>1e-9;left-=1/120){
      const h=Math.min(1/120,left);
      v.x+=(k*k*(goal.x-x.x)-2*k*v.x)*h;v.y+=(k*k*(goal.y-x.y)-2*k*v.y)*h;v.z+=(k*k*(goal.z-x.z)-2*k*v.z)*h;
      const speed=v.length();if(speed>AWAKEN_TRACK_MOST)v.multiplyScalar(AWAKEN_TRACK_MOST/speed);
      x.addScaledVector(v,h);
    }
  }
  private crownSize(subject:Fighter){
    return THREE.MathUtils.clamp((this.awakenCrown.y-subject.group.position.y)/CROWN_HEIGHT,1,AWAKEN_SIZE_MOST);
  }
  private frameHead(subject:Fighter,aspect:number,gameEye:THREE.Vector3,gameLook:THREE.Vector3,gameFov:number,lens:number,w:number){
    const head=this.awakenHead,s=this.screen,tanG=Math.tan(THREE.MathUtils.degToRad(gameFov)/2);
    const seen=screenOf(head,gameEye,gameLook,tanG,tanG*aspect,s)&&Math.abs(s.x)<2.5&&Math.abs(s.y)<2.5;
    const atX=this.closeUp?CLOSE_SHOT.atX:AWAKEN_AT_X;
    const at=(this.closeUp?CLOSE_SHOT.atY:AWAKEN_AT_Y)-AWAKEN_TALL*Math.min(1,this.awakenExcess/AWAKEN_TALL_AT);
    let x=seen?s.x+(atX-s.x)*w:atX,y=seen?s.y+(at-s.y)*w:at;
    if(this.awakenBridge){
      this.awakenBridge=false;this.awakenCarryX=this.awakenCarryY=0;
      const tanS=Math.tan(THREE.MathUtils.degToRad(this.shownFov)/2);
      if(screenOf(head,this.shownEye,this.shownLook,tanS,tanS*aspect,s)&&Math.abs(s.x)<2.5&&Math.abs(s.y)<2.5){this.awakenCarryX=s.x-x;this.awakenCarryY=s.y-y;}
    }
    if(this.carried<this.carryOver){const keep=1-ease(this.carried/this.carryOver);x+=this.awakenCarryX*keep;y+=this.awakenCarryY*keep;}
    let tanV=Math.tan(THREE.MathUtils.degToRad(lens)/2);
    aimAt(this.eye,head,x,y,tanV,tanV*aspect,this.look);
    const p=subject.group.position;this.awakenBody.set(p.x,p.y+(subject.state.fighter==='pikachu'?.10:this.closeUp?CLOSE_SHOT.hold:1),p.z);
    let top=AWAKEN_TOP,floorGame=Infinity;
    if(screenOf(this.awakenCrown,gameEye,gameLook,tanG,tanG*aspect,s))top=Math.max(AWAKEN_TOP,THREE.MathUtils.lerp(s.y,AWAKEN_TOP,w));
    if(screenOf(this.awakenBody,gameEye,gameLook,tanG,tanG*aspect,s))floorGame=s.y;
    let grow=1;
    if(y<top-.02&&screenOf(this.awakenCrown,this.eye,this.look,tanV,tanV*aspect,s)&&s.y>top)grow=(s.y-y)/(top-y);
    if(screenOf(this.awakenBody,this.eye,this.look,tanV,tanV*aspect,s)){
      let floor=this.closeUp?CLOSE_SHOT.floor:THREE.MathUtils.lerp(AWAKEN_FLOOR,AWAKEN_CARDS,THREE.MathUtils.smoothstep(s.x,AWAKEN_CARD_EDGE[0],AWAKEN_CARD_EDGE[1]));
      if(Number.isFinite(floorGame))floor=Math.min(floor,THREE.MathUtils.lerp(floorGame,floor,w));
      if(y>floor+.02&&s.y<floor)grow=Math.max(grow,(y-s.y)/(y-floor));
    }
    const wide=grow>1?THREE.MathUtils.radToDeg(2*Math.atan(Math.min(tanV*grow,Math.tan(THREE.MathUtils.degToRad(AWAKEN_FOV_MOST)/2)))):lens;
    const move=AWAKEN_WIDEN_RATE*Math.min(this.frameDt,.1);
    this.awakenWide=THREE.MathUtils.clamp(Math.max(0,wide-lens),this.awakenWide-move,this.awakenWide+move);
    const widen=this.awakenWide*THREE.MathUtils.smoothstep(w,0,.25);
    if(widen>1e-6){lens+=widen;tanV=Math.tan(THREE.MathUtils.degToRad(lens)/2);aimAt(this.eye,head,x,y,tanV,tanV*aspect,this.look);}
    if(!seen)this.look.lerpVectors(gameLook,this.look,w);
    const f=this.awakenFrame;f.x=x;f.y=y;f.head.copy(head);f.clock=this.awakenClock;f.form=this.awakenForm;f.widen=widen;
    return lens;
  }
  private bodyFacing(subject:Fighter){
    const joints=subject.joints;let x=0,z=0;
    if(joints)for(const [l,r] of [['LeftUpLeg','RightUpLeg'],['LeftArm','RightArm']] as const){
      const a=joints.get(l),b=joints.get(r);if(!a||!b)continue;
      a.getWorldPosition(this.left);b.getWorldPosition(this.right);
      x+=this.right.z-this.left.z;z+=this.left.x-this.right.x;
    }
    return x*x+z*z>1e-6?Math.atan2(x,z):subject.group.rotation.y;
  }
  private clear(az:number,want:number,occluders:readonly THREE.Object3D[],from:THREE.Vector3=this.pivot){
    if(!occluders.length)return want;
    this.scratch.set(Math.sin(az),0,Math.cos(az));
    this.ray.set(from,this.scratch);this.ray.far=want+CLEARANCE;
    this.hits.length=0;this.ray.intersectObjects(occluders as THREE.Object3D[],true,this.hits);
    return this.hits.length?Math.max(0,this.hits[0].distance-CLEARANCE):want;
  }
  private pastBodies(victim:Fighter,gx:number,gz:number,r:number,reach:number){
    if(!this.crowd||r<1e-3)return reach;
    this.lineX=gx/r;this.lineZ=gz/r;this.lineR=r;this.lineReach=reach;this.lineVictim=victim;
    this.crowd.forEach(this.onLine);this.lineVictim=undefined;
    return this.lineReach;
  }
  private onLine=(body:Fighter)=>{
    if(body===this.lineVictim||!body.state.alive||!body.group.visible)return;
    const p=this.pivot,q=body.group.position,bx=q.x-p.x,bz=q.z-p.z,along=bx*this.lineX+bz*this.lineZ;
    if(along<=0)return;
    const off=Math.abs(bx*this.lineZ-bz*this.lineX),inner=BODY_RADIUS*bodyBulk(body.state)+KO_CLEAR,outer=inner+KO_FADE;
    if(off>=outer)return;
    const stop=Math.min(this.lineR,along+Math.sqrt(Math.max(0,inner*inner-off*off))),weight=1-THREE.MathUtils.smoothstep(off,inner,outer);
    this.lineReach=Math.max(this.lineReach,THREE.MathUtils.lerp(this.lineReach,stop,weight));
  };
  private keepOut=(body:Fighter)=>{
    if(!body.group.visible)return;
    const p=body.group.position,alive=body.state.alive,bulk=drawnBulk(body),e=this.pushed;
    const radius=(alive?BODY_RADIUS*bulk:CORPSE_RADIUS)+LENS_CLEAR,top=(alive?p.y+BODY_HEIGHT*bulk:p.y+.3+CORPSE_RADIUS)+LENS_CLEAR;
    if(e.y>=top)return;
    const d=Math.hypot(e.x-p.x,e.z-p.z);if(d>=radius+LIFT_FADE)return;
    e.y+=(top-e.y)*(1-THREE.MathUtils.smoothstep(d,radius,radius+LIFT_FADE));
  };

  private summonsFor(caster:Fighter|undefined,age:number){
    this.summonCount=0;this.summoner=caster;
    if(!caster)return;
    const s=caster.state;
    if(s.action!=='ultimate'||!s.alive)return;
    const p=caster.group.position,fx=Math.sin(s.yaw),fz=Math.cos(s.yaw);
    if(s.awakened){
      if(s.fighter==='naruto')for(const back of FOX_BODY){const v=this.nextSummon();v.x=p.x-fx*back;v.z=p.z-fz*back;v.y0=p.y+FOX_RADIUS;v.y1=p.y+FOX_TOP-FOX_RADIUS;v.radius=FOX_RADIUS;}
      if(s.fighter==='luffy')this.bajrangFist(s,age,p);
      return;
    }
    if(s.fighter==='sasuke'&&age<SUSANOO_FOR){
      const v=this.nextSummon();v.x=p.x-fx*SUSANOO_BACK;v.z=p.z-fz*SUSANOO_BACK;v.y0=p.y+SUSANOO_RADIUS;v.y1=p.y+SUSANOO_HEIGHT-SUSANOO_RADIUS;v.radius=SUSANOO_RADIUS;
    }else if(s.fighter==='sanji'){
      const v=this.nextSummon();v.x=p.x;v.z=p.z;v.y0=p.y+HELL_RADIUS;v.y1=p.y+HELL_HEIGHT-HELL_RADIUS;v.radius=HELL_RADIUS;
    }else if(s.fighter==='luffy')this.bajrangFist(s,age,p);
  }
  private bajrangFist(s:{confirmedAt?:number},age:number,from:THREE.Vector3){
    const t=this.releaseVictim?.state.alive?this.releaseVictim.group.position:undefined;
    if(s.confirmedAt===undefined||!t||age<BAJRANG_FROM||age>=BAJRANG_AT)return;
    const size=BAJRANG_SMALL+(BAJRANG_BIG-BAJRANG_SMALL)*THREE.MathUtils.smoothstep(age,BAJRANG_FROM,BAJRANG_DRIVE-.05);
    let ax=from.x-t.x,az=from.z-t.z;const l=Math.hypot(ax,az)||1;ax/=l;az/=l;
    const v=this.nextSummon();v.radius=size*BAJRANG_BODY;v.x=t.x+ax*v.radius*.6;v.z=t.z+az*v.radius*.6;
    v.y0=t.y+1.9+BAJRANG_OVER+v.radius;v.y1=v.y0+size*BAJRANG_TALL;
  }
  private nextSummon(){return this.summons[Math.min(this.summonCount++,this.summons.length-1)];}
  private sampleAwakenBlockers(subject:Fighter){
    this.awakenBlockerCount=0;
    const take=(body:Fighter)=>{
      if(body===subject||!body.state.alive||this.awakenBlockerCount>=this.awakenBlockers.length||body.group.position.distanceToSquared(subject.group.position)>225)return;
      const box=this.awakenBlockers[this.awakenBlockerCount];box.makeEmpty();
      body.group.updateWorldMatrix(true,true);
      let total=0,seen=0,taken=0;
      body.group.traverseVisible(o=>{const m=this.drawable(o);if(m)total+=m.geometry.getAttribute('position').count;});
      const stride=Math.max(1,Math.ceil(total/128));
      body.group.traverseVisible(o=>{
        const m=this.drawable(o);if(!m)return;
        const count=m.geometry.getAttribute('position').count;
        for(let i=(stride-seen%stride)%stride;i<count&&taken<128;i+=stride){m.getVertexPosition(i,this.awakenProbe);m.localToWorld(this.awakenProbe);box.expandByPoint(this.awakenProbe);taken++;}
        seen+=count;
      });
      if(box.isEmpty()){
        const p=body.group.position,b=drawnBulk(body);
        box.min.set(p.x-BODY_RADIUS*b,p.y,p.z-BODY_RADIUS*b);box.max.set(p.x+BODY_RADIUS*b,p.y+BODY_HEIGHT*b,p.z+BODY_RADIUS*b);
      }
      box.expandByScalar(.18);box.min.y=-Infinity;box.max.y=Infinity;
      this.awakenBlockerCount++;
    };
    if(this.opponent)take(this.opponent);
    if(this.crowd)this.crowd.forEach(body=>{if(body!==this.opponent)take(body);});
  }
  private awakenBodyClear(az:number,reach:number){
    this.awakenProbe.set(Math.sin(az),0,Math.cos(az));
    this.ray.ray.set(this.pivot,this.awakenProbe);
    for(let i=0;i<this.awakenBlockerCount;i++){
      const hit=this.ray.ray.intersectBox(this.awakenBlockers[i],this.awakenHit);
      if(hit&&hit.distanceToSquared(this.pivot)<reach*reach)return false;
    }
    return true;
  }
  private sampleCaster(caster:Fighter){
    if(caster===this.drawnOf&&this.sinceReset-this.drawnClock<CASTER_EVERY)return;
    this.drawnOf=caster;this.drawnClock=this.sinceReset;
    caster.group.updateWorldMatrix(true,true);
    this.drawnTotal=0;this.drawnSeen=0;this.drawnCount=0;
    caster.group.traverseVisible(this.countDrawn);
    this.drawnStride=Math.max(1,Math.ceil(this.drawnTotal/CASTER_POINTS));
    caster.group.traverseVisible(this.takeDrawn);
  }
  private drawable(object:THREE.Object3D){
    const mesh=object as THREE.Mesh;
    if(!mesh.isMesh||!mesh.geometry?.getAttribute('position')||/-ink$|occlusion-warm|contact-shadow/.test(mesh.name))return undefined;
    const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    if(!material||material.visible===false||material.userData?.ink||material.depthWrite===false||(material.transparent&&material.opacity<.6))return undefined;
    return mesh;
  }
  private countDrawn=(object:THREE.Object3D)=>{const mesh=this.drawable(object);if(mesh)this.drawnTotal+=mesh.geometry.getAttribute('position').count;};
  private takeDrawn=(object:THREE.Object3D)=>{
    const mesh=this.drawable(object);if(!mesh)return;
    const count=mesh.geometry.getAttribute('position').count,v=this.clothProbe;
    for(let i=(this.drawnStride-this.drawnSeen%this.drawnStride)%this.drawnStride;i<count&&this.drawnCount<CASTER_POINTS;i+=this.drawnStride){
      mesh.getVertexPosition(i,v);mesh.localToWorld(v);
      const k=this.drawnCount++*3;this.drawn[k]=v.x;this.drawn[k+1]=v.y;this.drawn[k+2]=v.z;
    }
    this.drawnSeen+=count;
  };
  private casterGap(e:THREE.Vector3){
    let least=Infinity;
    for(let i=0;i<this.drawnCount;i++){const k=i*3,dx=this.drawn[k]-e.x,dy=this.drawn[k+1]-e.y,dz=this.drawn[k+2]-e.z;least=Math.min(least,dx*dx+dy*dy+dz*dz);}
    return Math.sqrt(least);
  }
  private casterHides(a:THREE.Vector3,b:THREE.Vector3){
    const lx=b.x-a.x,ly=b.y-a.y,lz=b.z-a.z,ll=lx*lx+ly*ly+lz*lz;
    if(!(ll>1e-8))return false;
    let near=0;const r2=CASTER_SIGHT*CASTER_SIGHT;
    for(let i=0;i<this.drawnCount;i++){
      const k=i*3,px=this.drawn[k]-a.x,py=this.drawn[k+1]-a.y,pz=this.drawn[k+2]-a.z,u=(px*lx+py*ly+pz*lz)/ll;
      if(u<=0||u>=1)continue;
      const qx=px-lx*u,qy=py-ly*u,qz=pz-lz*u;
      if(qx*qx+qy*qy+qz*qz<r2&&++near>CASTER_HIDES)return true;
    }
    return false;
  }
  private inSummon(eye:THREE.Vector3,clear=SUMMON_CLEAR){
    for(let i=0;i<this.summonCount;i++){
      const v=this.summons[i],reach=v.radius+clear,below=eye.y<v.y0?v.y0-eye.y:eye.y>v.y1?eye.y-v.y1:0;
      if(Math.hypot(eye.x-v.x,eye.z-v.z,below)<reach)return true;
    }
    return false;
  }
  private summonBlocks(){
    if(this.sightSubject===this.summoner)return false;
    for(let i=0;i<this.summonCount;i++){
      const v=this.summons[i];
      if(sightClearance(this.sightFrom,this.sightTo,v.x,v.z,v.y0,v.y1,v.radius)<v.radius)return true;
    }
    return false;
  }
  private bystanderGap(eye:THREE.Vector3,a?:Fighter,b?:Fighter){
    this.gapEye.copy(eye);this.gapA=a;this.gapB=b;this.gapNear=Infinity;
    this.crowd?.forEach(this.gapOne);
    return this.gapNear;
  }
  private gapEye=new THREE.Vector3();private gapA?:Fighter;private gapB?:Fighter;private gapNear=Infinity;
  private gapOne=(body:Fighter)=>{
    if(body===this.gapA||body===this.gapB||!body.state.alive)return;
    const p=body.group.position;this.gapNear=Math.min(this.gapNear,Math.hypot(p.x-this.gapEye.x,p.z-this.gapEye.z));
  };
  private crowdCover(eye:THREE.Vector3,look:THREE.Vector3,fov:number,a?:Fighter,b?:Fighter){
    if(!this.crowd)return 0;
    this.viewEye.copy(eye);this.viewForward.subVectors(look,eye);
    if(this.viewForward.lengthSq()<1e-8)return 0;
    this.viewForward.normalize();this.viewRight.crossVectors(this.viewForward,WORLD_UP);
    if(this.viewRight.lengthSq()<1e-8)return 0;
    this.viewRight.normalize();this.viewUp.crossVectors(this.viewRight,this.viewForward);
    this.crowdTanV=Math.tan(THREE.MathUtils.degToRad(fov)/2);this.crowdTanH=this.crowdTanV*this.aspect;
    this.crowdA=a;this.crowdB=b;this.crowdWorst=0;
    this.crowd.forEach(this.crowdOne);
    this.crowdA=this.crowdB=undefined;
    return this.crowdWorst;
  }
  private crowdOne=(body:Fighter)=>{
    if(body===this.crowdA||body===this.crowdB||!body.state.alive||!body.group.visible)return;
    const p=body.group.position,bulk=drawnBulk(body),radius=BODY_RADIUS*bulk,f=this.viewForward,r=this.viewRight,u=this.viewUp;
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,front=0;
    for(let k=0;k<2;k++){
      const dx=p.x-this.viewEye.x,dy=p.y+(k?BODY_HEIGHT*bulk:0)-this.viewEye.y,dz=p.z-this.viewEye.z,z=dx*f.x+dy*f.y+dz*f.z;
      if(z<.15)continue;
      front++;
      const x=(dx*r.x+dy*r.y+dz*r.z)/(z*this.crowdTanH),y=(dx*u.x+dy*u.y+dz*u.z)/(z*this.crowdTanV),px=radius/(z*this.crowdTanH),py=radius/(z*this.crowdTanV);
      x0=Math.min(x0,x-px);x1=Math.max(x1,x+px);y0=Math.min(y0,y-py);y1=Math.max(y1,y+py);
    }
    if(front===1&&Math.hypot(p.x-this.viewEye.x,p.z-this.viewEye.z)<radius+LENS_CLEAR){this.crowdWorst=Math.max(this.crowdWorst,.5);return;}
    if(!front)return;
    const w=Math.min(x1,1)-Math.max(x0,-1),h=Math.min(y1,1)-Math.max(y0,-1);
    if(w>0&&h>0)this.crowdWorst=Math.max(this.crowdWorst,w*h/4);
  };
  private heroCrowd(subject:Fighter,framing:number,side:number,bulk:number){
    let worst=0;
    for(let k=0;k<2;k++){
      this.heroPose(subject,k?this.length:HERO_IN*.5,framing,this.facing+side*HERO_FRAMINGS[framing].angle,bulk);
      if(this.inSummon(this.eye))return 1;
      worst=Math.max(worst,this.crowdCover(this.eye,this.look,this.fov,subject));
    }
    return worst;
  }
  private releaseMiss(caster:Fighter,bulk:number,bearing:number,side:number,turn:number,victim:Fighter|undefined,wantRoom:number){
    const p=caster.group.position,az=bearing+side*(Math.PI-turn);
    let r=RELEASE_R*bulk;
    this.probeEye.set(p.x+Math.sin(az)*r,p.y+(1.1+RELEASE_EYE)*bulk,p.z+Math.cos(az)*r);
    while(this.inSummon(this.probeEye,SUMMON_STAND)&&r<RELEASE_REACH*bulk){r+=SUMMON_STEP;this.probeEye.set(p.x+Math.sin(az)*r,this.probeEye.y,p.z+Math.cos(az)*r);}
    this.probeReach=r;
    if(this.inSummon(this.probeEye))return 10;
    let miss=0;
    if(victim){
      const v=victim.group.position,vb=bodyBulk(victim.state);
      if(!this.sees(this.probeEye,victim,vb,0))miss+=4;
      this.probeLook.set(v.x,v.y+1.1*vb,v.z);
      const room=Math.hypot(this.probeEye.x-v.x,this.probeEye.z-v.z);
      if(room<RELEASE_ROOM*vb)miss+=1+(RELEASE_ROOM*vb-room);
    }else this.probeLook.set(p.x+Math.sin(bearing)*RELEASE_AHEAD,p.y+1.1*bulk,p.z+Math.cos(bearing)*RELEASE_AHEAD);
    if(!this.sees(this.probeEye,caster,bulk,0))miss+=2;
    if(this.drawnCount&&caster===this.drawnOf){
      if(victim){
        const v=victim.group.position,vb=bodyBulk(victim.state);
        this.sightTo.set(v.x,v.y+1.1*vb,v.z);const chest=this.casterHides(this.probeEye,this.sightTo);
        this.sightTo.set(v.x,v.y+1.62*vb,v.z);if(chest||this.casterHides(this.probeEye,this.sightTo))miss+=3;
      }
    }
    const crowded=this.crowdCover(this.probeEye,this.probeLook,RELEASE_FOV,caster,victim);
    if(crowded>CROWD_MOST)miss+=1+crowded;
    const gap=this.bystanderGap(this.probeEye,caster,victim);
    if(gap<BYSTANDER_CLEAR)miss+=.5+BYSTANDER_CLEAR-gap;
    if(miss===0&&this.walls.length&&this.clear(az,wantRoom,this.walls)<wantRoom-1e-3)miss+=.5;
    return miss;
  }
  private script(subject:Fighter,gameEye:THREE.Vector3,gameFov:number,bulk:number,step:number){
    this.facing+=wrapped(this.bodyFacing(subject)-this.facing)*blend(6,step);
    const t=this.t,facing=this.facing;
    const size=this.kind==='victory'||this.kind==='impact'?bodyBulk(subject.state):bulk;
    if(this.kind!=='awaken')this.setPivot(subject,size);
    else{const p=subject.group.position;this.pivot.set(p.x,p.y+1.2,p.z);}
    const at=(az:number,r:number,y:number)=>this.eye.set(this.pivot.x+Math.sin(az)*r,this.pivot.y+y,this.pivot.z+Math.cos(az)*r);
    const inOut=(inner:number,outer:number)=>Math.min(inner>0?ease(t/inner):1,1-ease((t-(this.length-outer))/outer));
    switch(this.kind){
      case 'ultimate':{
        const aimed=subject.state.target?this.crowd?.get(subject.state.target):undefined;
        if(aimed&&aimed!==subject&&aimed.state.alive&&aimed!==this.releaseVictim){this.releaseVictim=aimed;this.releaseSearched=-Infinity;}
        this.summonsFor(subject,this.castAge+t);
        if(this.cine){
          if(this.tour)this.fieldPose(subject,bulk,step,gameEye);
          else{this.turnRelease(subject,bulk,step);this.releasePose(subject,bulk);}
          this.handBack=this.travel(INTERRUPT,gameEye);
          if(t<this.length-this.out){this.out=this.travel(HERO_OUT,gameEye);this.length=this.bUntil+this.out;}
          return inOut(this.into,this.out);
        }
        this.heroPose(subject,t,this.framing,this.heroAz,bulk);
        if(t<this.aEnd&&this.turnHero(subject,bulk,step,facing+this.side*HERO_FRAMINGS[this.framing].angle))this.heroPose(subject,t,this.framing,this.heroAz,bulk);
        if(t>this.aEnd){
          this.heroEye.copy(this.eye);this.heroLook.copy(this.look);this.heroFov=this.fov;
          if(this.tour)this.fieldPose(subject,bulk,step,gameEye);
          else{
          if(this.toB<0){this.releaseAz=this.releaseBearing(subject,bulk);this.releaseTurn=0;}
          else this.turnRelease(subject,bulk,step);
          this.releasePose(subject,bulk);
          }
          if(this.toB<0){
            const orbit=Math.abs(wrapped(Math.atan2(this.eye.x-this.pivot.x,this.eye.z-this.pivot.z)-Math.atan2(this.heroEye.x-this.pivot.x,this.heroEye.z-this.pivot.z)));
            const shortAir=this.swingClearance(false);
            this.swingLong=!this.tour&&shortAir<SWING_CLEAR&&Math.PI*2-orbit<=orbit*1.4+.6&&this.swingClearance(true)>shortAir+.2;
            const turn=Math.abs(wrapped(Math.atan2(this.look.x-this.eye.x,this.look.z-this.eye.z)-Math.atan2(this.heroLook.x-this.heroEye.x,this.heroLook.z-this.heroEye.z)));
            this.toB=this.tour?Math.min(TOUR_SWING,Math.max(HERO_OUT,1.875*turn/AIM_SPEED)):Math.min(SWING_LONGEST,Math.max(this.travel(HERO_OUT,this.heroEye),1.875*turn/AIM_SPEED));
            if(this.swingLong)this.toB=Math.min(SWING_LONGEST,this.toB*(Math.PI*2-orbit)/Math.max(orbit,.3));
          }
          const u=ease((t-this.aEnd)/this.toB);
          if(u<1)this.between(u);
        }
        this.handBack=this.travel(INTERRUPT,gameEye);
        if(t<this.length-this.out){this.out=this.travel(HERO_OUT,gameEye);this.length=Math.max(this.bUntil,this.aEnd+Math.max(this.toB,HERO_OUT)+RELEASE_HOLD_LEAST)+this.out;}
        return inOut(this.into,this.out);
      }
      case 'impact':{
        this.summonsFor(this.caster,this.caster?this.caster.state.actionTime*this.caster.state.actionDuration:0);
        this.followDrawn(subject,step);this.turnImpact(subject,size,step);
        const eyeY=this.impactEye(size),reach=Math.max(IMPACT_R*size,Math.max(0,-eyeY)/Math.tan(IMPACT_UP+IMPACT_ABOVE));
        at(this.impactAz,reach,eyeY);
        this.look.copy(this.pivot);this.look.y=Math.min(this.look.y,this.eye.y+reach*Math.tan(IMPACT_UP));this.fov=IMPACT_FOV;
        const vs=subject.state;if(!vs.grounded)this.impactFlew=true;
        if(this.impactDownAt<0&&(this.impactFlew?vs.grounded:this.t>=this.impactLead))this.impactDownAt=this.t;
        this.handBack=this.travel(INTERRUPT,gameEye);
        if(t<this.length-this.out){this.out=this.travel(IMPACT_OUT,gameEye);this.length=this.impactHold()+this.out;}
        return inOut(this.impactIn,this.out);
      }
      case 'awaken':{
        const st=subject.state,swap=awakeningSwapAt(st.fighter);
        this.awakenClock=st.action==='awaken'?THREE.MathUtils.clamp(st.actionTime*st.actionDuration,this.awakenClock,this.awakenClock+step*AWAKEN_CATCH):this.awakenClock+step;
        const beat=awakenBeat(this.awakenClock,swap);
        this.awakenForm=this.formShare(st);
        this.followHead(subject);
        this.awakenSize+=(this.crownSize(subject)-this.awakenSize)*blend(AWAKEN_SIZE_RATE,step);
        const size=this.awakenFrame.size=Math.min(AWAKEN_SIZE_MOST,Math.max(this.awakenSize,1+(bodyBulk(st)-1)*this.awakenForm));
        if(this.closeUp){
          const c=CLOSE_SHOT;
          at(this.startAz+this.side*c.orbit*beat.orbit/AWAKEN_ORBIT_SHARE,this.startR*(1-beat.push*c.push)*size,this.startY*(1-beat.drop*.5)+(size-1)*AWAKEN_SIZE_LIFT);
          this.look.copy(this.pivot).y+=.3;this.fov=c.fov-AWAKEN_FOV*beat.fov*c.zoom+beat.widen;
          return inOut(Math.max(c.in,this.awakenIn,1.875*AWAKEN_AIM*this.awakenSwing/AIM_SPEED),c.out);
        }
        at(this.startAz+this.side*AWAKEN_ORBIT*beat.orbit,this.startR*(1-beat.push)*size,this.startY*(1-beat.drop)+(size-1)*AWAKEN_SIZE_LIFT);
        this.look.copy(this.pivot).y+=.3;this.fov=gameFov-AWAKEN_FOV*beat.fov+beat.widen;
        return inOut(Math.max(Math.min(AWAKEN_IN,beat.in),this.awakenIn,1.875*AWAKEN_AIM*this.awakenSwing/AIM_SPEED),AWAKEN_OUT);
      }
      case 'opener':{
        const g=this.scratch.subVectors(gameEye,this.pivot),r=Math.hypot(g.x,g.z),gy=g.y;
        const want=r>OPENER_NEAREST?Math.max(OPENER_NEAREST,r*(1-OPENER_PUSH)):r,reach=this.pastBodies(subject,g.x,g.z,r,want);
        at(Math.atan2(g.x,g.z),reach,gy*(r>1e-3?reach/r:1));
        this.look.copy(this.gameLook);this.fov=gameFov-OPENER_FOV;
        return inOut(OPENER_IN,OPENER_OUT);
      }
      case 'ko':{
        const g=this.scratch.subVectors(gameEye,this.pivot),r=Math.hypot(g.x,g.z),gy=g.y;
        const reach=this.pastBodies(subject,g.x,g.z,r,Math.max(Math.min(KO_NEAREST,r),r*(1-KO_PUSH)));
        at(Math.atan2(g.x,g.z),reach,gy*.8);
        this.look.copy(this.pivot);this.fov=gameFov-KO_FOV;
        return inOut(KO_IN,KO_OUT);
      }
      case 'intro':{
        const u=t/this.length;
        at(facing+this.side*(INTRO_FRONT+.3*u),INTRO_RADIUS-.8*u,.15);
        this.look.copy(this.pivot).y+=.1;this.fov=INTRO_FOV;
        const leave=1-ease((u-(1-INTRO_LEAVE))/INTRO_LEAVE);
        return Math.min(this.opening?1:ease(t/INTRO_IN),leave);
      }
      case 'victory':{
        const u=t/this.length;
        at(facing+this.side*(VICTORY_ANGLE+this.victoryTurn+.6*u),VICTORY_RADIUS*size,VICTORY_EYE*size);
        this.look.copy(this.pivot).y+=.2;this.fov=VICTORY_FOV;
        return inOut(this.opening?0:VICTORY_IN,VICTORY_OUT);
      }
      default:return 0;
    }
  }

  private present(dt:number,camera:THREE.PerspectiveCamera,subject:Fighter,gameEye:THREE.Vector3,gameLook:THREE.Vector3,gameFov:number,occluders:readonly THREE.Object3D[],w:number){
    const p=this.pivot,g=this.scratch.subVectors(gameEye,p);
    const azG=Math.atan2(g.x,g.z),rG=Math.hypot(g.x,g.z),yG=g.y;
    const azS=Math.atan2(this.eye.x-p.x,this.eye.z-p.z),rS=Math.hypot(this.eye.x-p.x,this.eye.z-p.z),yS=this.eye.y-p.y;
    let az=azG+wrapped(azS-azG)*w,r=THREE.MathUtils.lerp(rG,rS,w),y=THREE.MathUtils.lerp(yG,yS,w);
    this.look.lerpVectors(gameLook,this.look,w);
    let lens=THREE.MathUtils.lerp(gameFov,this.fov,w);
    if(this.bridge){
      this.bridge=false;this.carried=0;this.carryOver=this.kind==='impact'?this.impactCarry:CARRY;
      this.carryAz=wrapped(Math.atan2(this.shownEye.x-p.x,this.shownEye.z-p.z)-az);
      this.carryR=Math.hypot(this.shownEye.x-p.x,this.shownEye.z-p.z)-r;this.carryY=this.shownEye.y-p.y-y;
      this.carryLook.subVectors(this.shownLook,this.look);this.carryFov=this.shownFov-lens;
      this.awakenBridge=this.kind==='awaken';
    }else this.carried=Math.min(this.carryOver,this.carried+dt);
    if(this.carried<this.carryOver){
      const keep=1-ease(this.carried/this.carryOver);
      az+=this.carryAz*keep;r+=this.carryR*keep;y+=this.carryY*keep;this.look.addScaledVector(this.carryLook,keep);lens+=this.carryFov*keep;
    }
    this.eye.set(p.x+Math.sin(az)*r,p.y+y,p.z+Math.cos(az)*r);
    this.clothGoal.set(0,0,0);
    if(this.drawnCount&&this.caster){
      const c=this.caster.group.position,e=this.clothProbe.copy(this.eye);
      let dx=e.x-c.x,dz=e.z-c.z;const l=Math.hypot(dx,dz);
      if(l>1e-3){dx/=l;dz/=l;}else{dx=Math.sin(az);dz=Math.cos(az);}
      for(let k=0;k<5;k++){const gap=this.casterGap(e);if(gap>=CASTER_CLEAR)break;const out=CASTER_CLEAR-gap+.02;e.x+=dx*out;e.z+=dz*out;}
      this.clothGoal.subVectors(e,this.eye);
      if(this.clothGoal.lengthSq()>CASTER_PUSH_MOST*CASTER_PUSH_MOST)this.clothGoal.setLength(CASTER_PUSH_MOST);
    }
    this.clothPush.lerp(this.clothGoal,blend(this.clothGoal.lengthSq()>this.clothPush.lengthSq()?CASTER_IN:CASTER_OUT,dt));
    if(this.clothGoal.lengthSq()===0&&this.clothPush.lengthSq()<1e-8)this.clothPush.set(0,0,0);
    this.eye.addScaledVector(this.clothPush,w);
    if(this.kind==='awaken'&&this.awakenFree)this.pull=0;
    else if(occluders.length){
      const back=this.scratch.subVectors(gameEye,p),gameReach=back.length();
      if(gameReach>1e-3){
        this.ray.set(p,back.divideScalar(gameReach));this.ray.far=gameReach;
        this.hits.length=0;this.ray.intersectObjects(occluders as THREE.Object3D[],true,this.hits);
        const clear=this.hits.length?0:1;
        this.firm=this.firm<0?clear:this.firm+(clear-this.firm)*blend(6,dt);
      }else if(this.firm<0)this.firm=1;
      const span=this.scratch.subVectors(this.eye,p),length=span.length();
      if(length>1e-3){
        this.ray.set(p,span.divideScalar(length));this.ray.far=length+CLEARANCE;
        this.hits.length=0;this.ray.intersectObjects(occluders as THREE.Object3D[],true,this.hits);
        const allowed=this.hits.length?Math.max(MIN_REACH,this.hits[0].distance-CLEARANCE):length,want=Math.max(0,length-allowed);
        this.pull=want>this.pull?(this.kind==='impact'?this.pull+(want-this.pull)*blend(IMPACT_PULL,dt):want):this.pull+(want-this.pull)*blend(8,dt);
        const kept=Math.max(Math.min(MIN_REACH,length),length-Math.max(w,this.firm)*this.pull);
        this.eye.copy(p).addScaledVector(span,kept);
      }
    }
    if(this.crowd){this.pushed.copy(this.eye);this.crowd.forEach(this.keepOut);this.eye.lerp(this.pushed,w);}
    for(let i=0;i<this.summonCount;i++){
      const v=this.summons[i],dx=this.eye.x-v.x,dz=this.eye.z-v.z,flat=Math.hypot(dx,dz),reach=v.radius+SUMMON_CLEAR;
      if(flat>=reach||this.eye.y>v.y1+reach||this.eye.y<v.y0-reach)continue;
      const out=(reach-flat)*w;
      if(flat>1e-4){this.eye.x+=dx/flat*out;this.eye.z+=dz/flat*out;}
    }
    this.eye.y=Math.max(this.eye.y,(this.kind==='impact'?this.impactFloor:subject.group.position.y)+.25);
    if(this.kind==='awaken')lens=this.frameHead(subject,camera.aspect,gameEye,gameLook,gameFov,lens,w);
    if(this.kind==='impact'){this.impactFit=this.fieldFor(subject,this.eye,this.look);lens=Math.max(lens,THREE.MathUtils.lerp(gameFov,this.impactFit,w));}
    if(this.kind==='victory'){this.victoryFit+=(this.victoryField(subject,this.eye,this.look)-this.victoryFit)*blend(4,dt);lens=Math.max(lens,THREE.MathUtils.lerp(gameFov,this.victoryFit,w));}else this.victoryFit=VICTORY_FOV;
    camera.position.copy(this.eye);camera.lookAt(this.look);camera.fov=lens;
    this.shownEye.copy(this.eye);this.shownLook.copy(this.look);this.shownFov=lens;
    const victim=this.shotVictim;let hidden=false;
    if(victim&&this.drawnCount&&victim!==this.caster){
      const v=victim.group.position,vb=bodyBulk(victim.state);
      for(const up of HIDDEN_LINES){this.sightTo.set(v.x,v.y+up*vb,v.z);if(this.casterHides(this.eye,this.sightTo)){hidden=true;break;}}
    }
    this.hiddenHold=hidden?HIDDEN_HOLD:victim?Math.max(0,this.hiddenHold-dt):0;
    this.victimBehindCaster=this.hiddenHold>0;
  }
}
