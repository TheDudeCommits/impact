import './engine/packs/boot';
import {errorReports,reportStartFailure} from './boot/errorReports';
import './boot/playerTwoLink';
import './boot/playerTwoJoin';
import {activePack,activePackRoster,packHas,packRefuses} from './engine/packs/active';
import { laboratoryFighter, laboratoryOutfit, isLaboratoryPreviewFighter } from './fighterLab';
import {LocalRift} from './game/moba/LocalRift';
import {RiftTargets} from './game/moba/RiftTargets';
import {RiftAssets} from './game/moba/RiftAssets';
import {RiftPredictionTargets} from './game/moba/RiftPredictionTargets';
import {riftOf,RIFT_RULES} from './game/moba/model';
import {RiftField} from './render/moba/RiftField';
import {RiftWarUI} from './ui/moba/RiftWarUI';
import {refreshAssetVersions} from './loading/assetVersions';
import {beforeStart,recover,restoreSelection,watchMatch} from './loading/staleBuild';
import {modePrefs,namedPlaceFor,saveModePrefs} from './ui/modes/prefs';
import {SwapLedger,SWAP_LAB,swapMemory,swapSideOf,type SwapSide} from './ui/hud/trainingSwap';
import {swapPicker} from './ui/hud/TrainingSwapPicker';
import {loneNotice,loneQueue} from './ui/modes/loneQueue';
import {ObjectiveAudio} from './audio/ObjectiveAudio';
import {RiftAudio} from './audio/RiftAudio';
import './render/meshopt';
import {textureSharing} from './render/sharedTextures';
import {CAREER_MODES,CareerTracker,type CareerMode} from './game/social/career';
import {presence as playerTwoPresence} from './boot/playerTwo';
import {inkSelectController} from './ui/inkSelect';
import {CareerUI} from './ui/social/CareerUI';
import {PartyClient} from './social/PartyClient';
import {PartyUI} from './ui/social/PartyUI';
import {assetSignature} from './game/social/assets';
import './ui/social/social.css';
import {objectiveOf} from './game/objectives/model';
import {LocalObjective} from './game/objectives/LocalObjective';
import {villageCollision} from './game/objectives/villageStructures';
import {ObjectiveField} from './ui/objectives/ObjectiveField';
import { Startup } from './loading/Startup';
import { backgroundRoster as backgroundRosterPolicy, readSignals, thinLine } from './loading/backgroundPolicy';
import { BugReport } from './ui/BugReport';
import './ui/homeTools.css';
import { HOME_VOICES, HOME_VOICE_SECONDS, HomeVoice } from './audio/HomeVoice';
import {SwordStandEffects} from './render/SwordStandEffects';
import './ui/fonts.css';
import './ui/style.css';
import './ui/manga.css';
import './ui/combat-hud.css';
import './ui/approved-hud.css';
import './ui/home.css';
import './ui/survival.css';
import './ui/controller.css';
import './ui/coop.css';
import './ui/rift.css';
import * as THREE from 'three';
import {FIGHTERS,loadSettings} from './config';
import {Input} from './input';
import {pulseFor} from './input/rumble';
import {INPUT_HZ} from './game/catchUp';
import {InputClock} from './game/inputClock';
import {FrameGate,frameSteps} from './render/frameClock';
import {LocalDuel} from './game/duel/LocalDuel';
import {LocalRoyale} from './game/LocalRoyale';
import {MatchBell} from './game/matchBell';
import {Network,LocalTraining} from './network';
import {DamageNumbers} from './ui/DamageNumbers';
import {MangaImpact} from './ui/MangaImpact';
import {MusicPanel} from './ui/MusicPanel';
import {Hud} from './ui/Hud';
import {Finale,FinaleSkip,finaleMine,finaleStateOf,finaleWinner} from './ui/results/finale';
import {GameRenderer} from './render/GameRenderer';
import {ArenaEnvironment} from './render/ArenaEnvironment';
import {StageEnvironment} from './render/StageEnvironment';
import {preloadRiftAssets} from './render/rift/RiftStage';
import {isRiftStage} from './game/riftLayouts';
import {STAGES,type StageId} from './game/stages';
import {FighterLibrary,Fighter} from './render/Fighter';
import {FollowCamera,hitTier} from './render/FollowCamera';
import {NinjaEffects} from './render/NinjaEffects';
import {KilluaEffects} from './render/KilluaEffects';
import {LuffyEffects} from './render/LuffyEffects';
import {LawEffects} from './render/LawEffects';
import {EmperorEffects} from './render/EmperorEffects';
import {GojoEffects} from './render/GojoEffects';
import {GutsEffects} from './render/GutsEffects';
import {SIGNATURE} from './render/signature/context';
import {SpiritBombEffects} from './render/signature/SpiritBomb';
import {AwakeningEffects} from './render/AwakeningEffects';
import { ClashEffects } from './render/ClashEffects';
import {CombatEffects,screenWorth} from './render/CombatEffects';
import {AreaTelegraph,areaMoveOf,areaReady,sealTextOf} from './render/AreaTelegraph';
import {prefetchRoomFx,retainRoomEffects,stamp,warmEffekseer,warmEnabled,warmRoomAssets,warmRoomSound,warmRoots} from './loading/matchWarmup';
import {LIBRARY_STRONG,TRAINING_BENCH,TRAINING_BENCH_STRONG} from './loading/retention';
import {AreaBanner} from './ui/AreaBanner';
import {borrowedEvent,effectDonors,installTransplant,presentEvents,presentFighters,presentPlayers,presentSnapshot,slotNames,steadyBodies,transplantKey} from './engine/client/transplant';
import {installBorrowedHurts} from './engine/client/borrowedHurts';
import {bodyCentre} from './render/vfx/VfxKit';
import {bigBlowOf,cinematicBlowOf} from './render/bigBlowEvent';
import {Letterbox} from './ui/Letterbox';
import {VsSplash,type VsBeat} from './ui/VsSplash';
import {HomeShell} from './ui/modes/HomeShell';
import {mountFirstVisit} from './ui/firstVisit';
import {CutIn,cutInSide,awakeningCutIn,cutInKey,type ScreenBox} from './ui/CutIn';
import {bodyBulk} from './render/CameraDirector';
import {roanEnabled} from './render/look/roanPass';
import {elementFor} from './render/vfx/palette';
import type {ComboKey} from './game/combos';
import {StrikeTrails} from './render/StrikeTrails';
import {CombatExercise} from './render/CombatExercise';
import {CombatTimeline} from './render/CombatTimeline';
import {installGameplayRecorder} from './render/GameplayRecorder';
import {CombatAudio} from './audio/CombatAudio';
import {MOVES,BIG_HITSTOP} from './game/moves';
import {moveFor,AWAKENINGS} from './game/awakening';
import {rushMove} from './game/awakening';
import {Targeting} from './game/Targeting';
import {AutoLock} from './game/autoLock';
import {Prediction} from './game/prediction';
import type {CollisionWorld} from './game/types';
import type {AttackSlot,CombatEvent,FighterId,GameSnapshot,PlayerState} from './game/types';
import {LocalArena} from './survival/LocalArena';
import {EnemyHorde} from './render/EnemyHorde';
import {SurvivalFx} from './render/SurvivalFx';
import {EnemyTechniques} from './render/EnemyTechniques';
import {SurvivalHud} from './ui/SurvivalHud';
import {isProc,isQuiet,type RunView} from './survival/SurvivalGame';
import {Autopilot} from './survival/autopilot';
import {ENEMIES} from './survival/enemies';
import {GruntRenderer} from './render/horde/GruntRenderer';
import {Gore} from './render/horde/Gore';
import type {HordeFrames} from './survival/horde/frame';
import {GRUNTS} from './survival/horde/kinds';
import {DEATH,type HordeEvent} from './survival/horde/Horde';
import {SurvivalTargets} from './survival/SurvivalTargets';
import {ViewKeys,movementMask} from './render/viewKeys';
import {squadSubject} from './ui/objectives/spectator';
import {RiftIntro} from './ui/RiftIntro';
import {LoadingScreen,type LoadingMode} from './ui/LoadingScreen';
import {loadingModeFor} from './ui/loadingMode';
import './ui/loading.css';
import {LINES,PITCH,VOICE_OF,everyTake,take,type Family} from './audio/survivalBank';
import {bossLine,type BossMoment} from './audio/bossVoices';
import {RIFT_SCORE} from './audio/musicTracks';
import {lockedStart,playerOutfit} from './ui/shop/boot';
import {hudView} from './ui/hud/hudView';
import {PauseLink} from './game/pauseLink';
import './ui/hud/inked.css';
import './ui/hud/protos/proto.css';
import './ui/hud/protos/halo.css';
import './ui/hud/protos/haloModes.css';
import {TouchControls} from './input/touch';
import {phone} from './input/device';
import {autoQuality,gpuName,QualityWatch,stepDown} from './render/qualityTier';
import {emote,onEmoteVoice} from './ui/shop/boot';
import {connectArmorySound} from './render/vfx/armory/soundOut';
import {installPanelFlags} from './ui/panelFlags';
import {reloadIfNotRestored,reloadWhenRestored} from './boot/pageLife';

const root=document.querySelector<HTMLElement>('#app')!;
const settings=loadSettings(),view=new GameRenderer(root,settings);
if(autoQuality(settings,gpuName(view.renderer.getContext())))view.applySettings(settings);
const hud=new Hud(root,settings),input=new Input(view.renderer.domElement),online=new Network();
let fighterLabEntry:import('./ui/FighterLaboratory').FighterLaboratory|undefined;
let fighterLabRequest=0;
async function showFighterLaboratory(fighter:FighterId){
  if(import.meta.env.MODE!=='fighter-lab')return;
  if(!isLaboratoryPreviewFighter(fighter))return;
  const request=++fighterLabRequest;
  const {FighterLaboratory}=await import('./ui/FighterLaboratory');
  if(request!==fighterLabRequest||started)return;
  fighterLabEntry??=new FighterLaboratory(root,fighter,async candidate=>{await hud.onStart(candidate,'training',hud.playerName());return started;});
  fighterLabEntry.show(fighter);
}
hud.onLaboratoryReview=fighter=>{void showFighterLaboratory(fighter);};
const animOverride=((v:string|null)=>v==='twos'||v==='snap'||v==='classic'?v:undefined)(new URLSearchParams(location.search).get('anim'));
Fighter.animStyle=animOverride??settings.animStyle;
const arcade=new LocalArena();
const practice=new LocalTraining();
const duel=new LocalDuel();
const royale=new LocalRoyale();
const localObjective=new LocalObjective(),localRift=new LocalRift();
let network:Network|LocalArena|LocalTraining|LocalObjective|LocalDuel|LocalRoyale|LocalRift=online;
const coop=()=>network===online&&online.coop;
const survival=()=>network===arcade||coop();
const runView=():RunView|undefined=>network===arcade?arcade.view:online.run;
hud.modes.runView=runView;
hud.modes.local=()=>network===practice||network===duel||network===royale||network===arcade||network===localObjective||network===localRift;
const pauseLink=new PauseLink();let fightShown=false,roomFrozen=false,hudCovered=false,drawnSize=0;
const localNetwork=()=>network===royale?royale:network===duel?duel:network===arcade?arcade:network===practice?practice:network===localObjective?localObjective:network===localRift?localRift:undefined;
hud.modes.paused=()=>network===online?pauseLink.state==='paused':!!localNetwork()?.paused;
hud.modes.pausable=()=>network===online?pauseLink.pausable||pauseLink.holding:!!localNetwork();
const isBoss=(id:string)=>network===arcade?!!arcade.game?.isBoss(id):!!online.run?.marked.bosses.includes(id);
const isChampion=(id:string)=>network===arcade?!!arcade.game?.isChampion(id):!!online.run?.marked.champions.includes(id);
const rivalIds=():readonly string[]=>network===arcade?arcade.game?.rivals()??[]:online.run?.marked.rivals??[];
const runScale=()=>network===arcade?arcade.game?.timeScale??1:1;
const horde=new EnemyHorde(view.scene),grunts=new GruntRenderer(view.scene),survivalFx=new SurvivalFx(view.scene),survivalHud=new SurvivalHud(root.querySelector('#interface')??root);
const riftIntro=new RiftIntro(root);
const shell=new HomeShell(hud,{story:()=>{riftIntro.preload();void riftIntro.play();}});
mountFirstVisit();
const loadingScreen=new LoadingScreen(root);
{const here={x:0,y:0,z:0};riftIntro.sound={impact:()=>{audio.cue('bomb',here,.55,.7,'intro',2);audio.cue('ground',here,.5,.6,'intro',2,.05);},roar:()=>audio.sample(take('beast-roar'),here,.8,.62,'intro',2),stamp:()=>audio.cue('crack',here,.35,1.25,'intro',1)};}
const hordeFrames=():HordeFrames|undefined=>network===arcade?arcade.hordeFrames:online.hordeFrames;
const gore=new Gore(view.scene),gruntFocus=new THREE.Vector3();
grunts.onDeath=(x,y,z,kind,death,cut,dx,dz)=>gore.death(x,y,z,kind,death,cut,dx,dz,performance.now()/1000);
survivalFx.screen=view;
const techniques=new EnemyTechniques(view.scene);techniques.screen=view;
techniques.bodyOf=id=>{const body=horde.body(id);return body?{x:body.group.position.x,y:body.group.position.y,z:body.group.position.z,height:body.def.height}:undefined;};
const ONLINE_DELAY=60,LOCAL_DELAY=1000/60;
let localClock=0;
let lastEntrance=0,lastRoar=0;
const objectiveField=new ObjectiveField(view.scene,root);
const riftField=new RiftField(view.scene,grunts),riftUI=new RiftWarUI(root.querySelector<HTMLElement>('#interface')??root);
const environment=new ArenaEnvironment(view.scene),stages=new StageEnvironment(view.scene),library=new FighterLibrary(),camera=new FollowCamera(view.camera),effects=new CombatEffects(view.scene),fighters=new Map<string,Fighter>();
if(import.meta.env.DEV)(window as unknown as {__filmReset?:()=>void}).__filmReset=()=>{input.yaw=network.snapshot?.players.find(p=>p.id===network.id)?.yaw??input.yaw;camera.reset();camera.lookAlong(input.yaw);};
const areaFx=new AreaTelegraph(view.scene,{small:typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches});
areaFx.onSlam=(at,actorId,local)=>{audio.cue('fx-land-heavy',at,local?.5:.32,.62,actorId,1);};
let areaBanner:AreaBanner|undefined,areaBannerShown={key:'',at:-Infinity};
const showAreaBanner=(body:FighterId,move:string,mover:FighterId)=>{const key=`${body}|${move}`,now=performance.now();if(key===areaBannerShown.key&&now-areaBannerShown.at<900)return;areaBannerShown={key,at:now};
  void (areaBanner??=new AreaBanner(document.getElementById('action-message')?.parentElement??document.body)).show(body,sealTextOf(body,move,mover));};
const floorAt=(x:number,z:number,near:number)=>{const hit=localCollision?.raycast?.({x,y:Math.max(near,0)+12,z},{x,y:-20,z});return hit&&hit.y>-19.9?hit.y:0;};
SIGNATURE.floor=(x,y,z)=>{try{const top=y+.5,hit=localCollision?.raycast?.({x,y:top,z},{x,y:y-6,z});return hit&&hit.y<top-.001&&hit.y>y-5.999?hit.y:undefined;}catch{return undefined;}};
const hiddenRiftBodies=new Map<string,Fighter>();
function clearFighters(){for(const body of [...fighters.values(),...hiddenRiftBodies.values()])body.dispose();fighters.clear();hiddenRiftBodies.clear();}
const timeline=new CombatTimeline(),luffyEffects=new LuffyEffects(view.scene),ninjaEffects=new NinjaEffects(view.scene),swordStandEffects=new SwordStandEffects(view.scene),strikeTrails=new StrikeTrails(view.scene);
const awakeningEffects=new AwakeningEffects(view.scene);
camera.director.crowd=fighters;
const killuaEffects=new KilluaEffects(view.scene);
const lawEffects=new LawEffects(view.scene);
const emperorEffects=new EmperorEffects(view.scene);
const gojoEffects=new GojoEffects(view.scene);
const spiritBombEffects=new SpiritBombEffects(view.scene);
const gutsEffects=new GutsEffects(view.scene);
const clashEffects=new ClashEffects(view.scene);
const targeting=new Targeting();
const autoLock=new AutoLock();
hudView.camera=view.camera;hudView.locked=()=>targeting.locked;
const survivalTargets=new SurvivalTargets(),riftTargets=new RiftTargets(),riftAssets=new RiftAssets(),riftPredictionTargets=new RiftPredictionTargets();
installTransplant({ensure:ids=>library.ensure(ids),donor:state=>library.has(state.fighter)?library.create(state):undefined,bodies:()=>fighters.values(),effects:donors=>{const room=network.snapshot?riftAssets.ids(network.snapshot):[hud.selected],ids=[...new Set([...room,...(network.snapshot?effectDonors(network.snapshot.players,room):[]),...donors,...benched()])];emperorEffects.load(ids);return Promise.all([ninjaEffects.load(ids),swordStandEffects.load(ids),effects.load(ids)]).then(()=>{});},compile:()=>view.compileScene()});
void installBorrowedHurts();
riftField.glows=riftTargets.glows;
grunts.threats=survivalTargets.glows;
const targetPlayers=(snapshot:GameSnapshot)=>{const self=snapshot.players.find(p=>p.id===network.id);return riftOf(snapshot)&&self?riftTargets.update(snapshot,self):survival()&&self?survivalTargets.update(snapshot.players,hordeFrames()?.around(snapshot.serverTime)?.b,self):snapshot.players;};
const gruntPosition=(id:string,out:THREE.Vector3)=>{const at=grunts.centre(id,out);if(at)at.y-=(grunts.heightOf(id)??1.8)*.55;return at;};
const viewKeys=new ViewKeys();
const prediction=new Prediction();prediction.requireCollision=true;
let localCollision:CollisionWorld|undefined,localCollisionStage:StageId|null=null;
let collisionGeneration=0;
const PREDICTED_EVENT_BASE=1_000_000_000;
const predictedCasts=new Map<string,number>();
const castKey=(event:CombatEvent)=>`${event.slot}:${event.actionSeq??''}`;
const predictedVisuals:CombatEvent[]=[];
let predictedImpactId=2_000_000_000;
let started=false,targetId:string|null=null,previous=performance.now(),lastHud=0,lastEvent=0;
let shownSelf:PlayerState|undefined;
let stageShown:StageId|null=null,stageWanted:StageId|null=null;
let keepPlace:StageId|null=null;
const occluders=()=>stages.occluders;
function ensureLocalCollision(stage:StageId){
  if(localCollisionStage===stage)return;
  localCollisionStage=stage;
  const generation=++collisionGeneration;
  localCollision=undefined;prediction.setStage(stage);
  void import('./render/Ragdoll').then(({prepareRagdolls})=>prepareRagdolls()).catch(error=>console.warn('Ragdolls unavailable',error));
  void import('./game/rapierCollision').then(({createRapierCollision})=>createRapierCollision(stage)).then(collision=>{
    if(localCollisionStage!==stage||generation!==collisionGeneration){collision.dispose?.();return;}
    localCollision=stage==='hidden-leaf'?villageCollision(collision):collision;prediction.setStage(stage,localCollision);
  }).catch(error=>{if(generation!==collisionGeneration)return;console.warn('Local collision failed',stage,error);prediction.setStage(stage);});
}
function wantStage(stage:StageId){
  if(!started&&stage==='harbor'&&keepPlace&&keepPlace===stageShown){stageWanted=null;return;}
  if(!started&&stage==='harbor'){stageWanted=stageShown=null;stages.releaseAll();view.applyStage(STAGES.harbor);return;}
  if(stage===stageWanted)return;
  stageWanted=stage;
  ensureLocalCollision(stage);
  const definition=STAGES[stage];
  if(stage!=='harbor')hud.notify(`${definition.name.toUpperCase()} — ${definition.scene.toUpperCase()}`,1.8);
  void stages.show(stage).then(()=>{
    if(stageWanted!==stage)return;
    view.applyStage(definition);
    stageShown=stage;
  }).catch(error=>{
    console.warn('Stage failed to load',stage,error);
    if(stageWanted!==stage||stage==='harbor')return;
    stageWanted='harbor';
    void stages.show('harbor').then(()=>{if(stageWanted==='harbor'){view.applyStage(STAGES.harbor);stageShown='harbor';}}).catch(fallback=>console.warn('Harbour stand-in failed',fallback));
  });
}
input.sensitivity=settings.sensitivity;input.rumble.scale=settings.vibration;hud.busy(true);const exercise=new CombatExercise(new URLSearchParams(location.search).has('contact-exercise'));installGameplayRecorder(view.renderer.domElement,async()=>{if(network.snapshot?.roomMode!=='training')throw new Error('Enter training first');await exercise.start(command=>network.room?.send('training',command));},()=>audio.captureOutput(music.captureElements()),()=>({...fighters.get(network.id)?.motionEvidence(),performance:view.perf(),player:shownSelf?{x:shownSelf.x,y:shownSelf.y,z:shownSelf.z,yaw:shownSelf.yaw,actionSeq:shownSelf.actionSeq}:undefined,view:{position:view.camera.position.toArray(),yaw:camera.yaw,movementYaw:camera.movementYaw},roster:network.snapshot?.players.map(p=>({id:p.id,fighter:p.fighter,action:p.action,hp:p.hp}))}));
const damageNumbers=new DamageNumbers(root),manga=new MangaImpact(root);
const letterbox=new Letterbox(root);
const vsSplash=new VsSplash(document.querySelector<HTMLElement>('#interface')??root);
let vsPending=false;
manga.bodies=(id,out)=>{const f=fighters.get(id);if(!f)return false;bodyCentre(f,out);return true;};
const MARKER_HIT_DIM=.35;
let markerFade=1,markerHoldUntil=0;const numberAnchor=new THREE.Vector3();
effects.settings=settings;manga.density=settings.effects;effects.screen=view;SIGNATURE.screen=view;
const marker=new THREE.Vector3(),audio=new CombatAudio({byRoom:true}),musicPanel=new MusicPanel(root),music=musicPanel.music;
connectArmorySound(audio);
const FIGHT_LINE='/assets/audio/survival/announcer-fight.m4a';
const VICTORY_LINE='/assets/audio/survival/announcer-victory.m4a',FLAWLESS_LINE='/assets/audio/survival/announcer-flawless.m4a';
const onVsBeat=(beat:VsBeat)=>{
  if(beat==='panels'){audio.ui('fx-swing-huge',.3,.16);audio.ui('fx-land-heavy',.26,.19,1.12);audio.ui('fx-land-heavy',.22,.29,1.2);}
  else if(beat==='stamp')audio.ui('fx-hit-finisher-1',.4,.1);
  else if(beat==='cut'){audio.ui('fx-slash-katana-2',.4,.02);audio.ui('fx-sword-ring',.12,.06,1.1);}
  else if(beat==='fight'){audio.ui('fx-zip-2',.28,.05);audio.announce(FIGHT_LINE,.95,.08);audio.bell();}
  else audio.ui('fx-hit-finisher-2',.46);
};
vsSplash.onBeat=onVsBeat;hud.introSplash.onBeat=onVsBeat;
let heardCinema=0;
const cutIn=new CutIn(document.querySelector<HTMLElement>('#interface')??root);
cutIn.onShow=()=>{audio.ui('fx-zip-2',.22);audio.ui('fx-sword-ring',.22,.05,1.06);};
const cutInSeen=new Map<string,string>();
const carded=()=>!survival()&&!objectiveOf(network.snapshot)&&!riftOf(network.snapshot);
const practiceRoom=(snapshot:GameSnapshot|null|undefined)=>snapshot?.roomMode==='training'&&!survival()&&!objectiveOf(snapshot);
const boxPoint=new THREE.Vector3(),boxRight=new THREE.Vector3();
function screenBox(f:Fighter):ScreenBox|undefined{
  const cam=view.camera,p=f.group.position,size=Math.max(f.state.size??1,bodyBulk(f.state)),w=innerWidth,h=innerHeight;
  boxRight.setFromMatrixColumn(cam.matrixWorld,0).setY(0).normalize();
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(const up of [0,1.05,2.05])for(const across of [-.5,.5]){
    boxPoint.set(p.x+boxRight.x*across*size,p.y+up*size,p.z+boxRight.z*across*size).project(cam);
    if(!(boxPoint.z<1))continue;
    const x=(boxPoint.x*.5+.5)*w,y=(.5-boxPoint.y*.5)*h;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return left<=right?{left,top,right,bottom}:undefined;
}
function cutIns(snapshot:GameSnapshot){
  if(!carded())return;
  for(const p of snapshot.players){
    const key=cutInKey(p);
    if(cutInSeen.get(p.id)===key)continue;
    const awakening=awakeningCutIn(p,network.id),side=awakening?'mine':cutInSide(p,network.id);
    if(!side)continue;
    cutInSeen.set(p.id,key);
    const avoid:ScreenBox[]=[];
    for(const id of new Set([p.id,p.target,network.id])){const body=id?fighters.get(id):undefined,box=body?screenBox(body):undefined;if(box)avoid.push(box);}
    cutIn.show(p.fighter,awakening?AWAKENINGS[p.fighter].name:slotNames(p,'ultimate')?.name??moveFor(p.fighter,'ultimate',!!p.awakened).name,side,avoid);
  }
}
const objectiveAudio=new ObjectiveAudio(audio),riftAudio=new RiftAudio(audio);
audio.setMix({master:settings.volume,sfx:settings.sfxVolume,voice:settings.voiceVolume});music.setVolume(settings.volume*settings.musicVolume);
const homeVoice=new HomeVoice(root);homeVoice.setMix(settings.volume,settings.voiceVolume);
const startup=new Startup();startup.started=0;
const career=new CareerTracker(),careerUI=new CareerUI(root,career);
const party=new PartyClient(()=>({fighter:hud.selected,name:hud.playerName()})),partyUI=new PartyUI(root,party);
let startEpoch=0;
hud.onParty=()=>{homeVoice.stop();party.profileChanged();partyUI.show();};hud.onCareer=()=>{homeVoice.stop();careerUI.show();};
hud.onCustom=(type,value)=>network.room?.send(type,value);hud.objectives.onCustom=hud.onCustom;
partyUI.beforeReady=()=>prepareSelection(hud.selected);
partyUI.onFighter=fighter=>{const home=root.querySelector<HTMLElement>('.manga-home'),button=home?.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${fighter}"]`);if(!button)return;
  const volume=button.closest<HTMLElement>('.home-volume')?.dataset.volume;if(volume)home!.querySelector<HTMLButtonElement>(`[data-volume-tab="${volume}"]`)?.click();button.click();};
party.onReturn=()=>{returnToLobby();partyUI.show();};
party.onTravel=async travel=>{partyUI.close();returnToLobby(false);await hud.onStart(hud.selected,'match',hud.playerName(),{kind:'party',travel});return started;};

Object.defineProperty(window,'jumpLoading',{get:()=>startup.snapshot()});
let reportCapture:((image:string)=>void)|undefined;
const bugReport=new BugReport(root,()=>({fighter:hud.selected,mode:started?(survival()?'survival':network.snapshot?.roomMode??'match'):'home',connection:(!started?'not connected':network.predictionReady?'connected':'reconnecting')+(started&&network===online?online.link.summary(performance.now()):''),input:input.mode,performance:view.perf(),loading:startup.snapshot()}),()=>new Promise<string>((resolve,reject)=>{
  const timer=setTimeout(()=>{reportCapture=undefined;reject(new Error('No arena frame'));},3000);
  reportCapture=image=>{clearTimeout(timer);resolve(image);};
}));
errorReports.lend({enabled:()=>settings.errorReports!==false,screen:()=>started?(survival()?'survival':network.snapshot?.roomMode??'match'):'home',names:()=>[hud.playerName()]});
errorReports.watchCanvas(view.renderer.domElement);
hud.onReportBug=()=>{homeVoice.stop();document.exitPointerLock?.();input.clear();bugReport.show();};
let combatSpeaking=false,homeSpeaking=false;
audio.onVoiceActivity=active=>{combatSpeaking=active;music.duck(combatSpeaking||homeSpeaking);};
homeVoice.onActivity=active=>{homeSpeaking=active;music.duck(combatSpeaking||homeSpeaking);};
hud.onFighterPreview=(fighter,immediate)=>homeVoice.preview(fighter,immediate);
hud.onPreviewStop=()=>homeVoice.stop();
musicPanel.onClose=()=>{musicPanel.setEnabled(false);hud.setMusicEnabled(false);};
hud.onMusicToggle=enabled=>{hud.setMusicEnabled(enabled);musicPanel.setEnabled(enabled);};
hud.onFighterSelect=fighter=>{music.setContext(fighter,undefined,'lobby');party.profileChanged();void library.ensure([fighter]).catch(()=>{});};
let homeMusicActivated=false;
const activateHomeMusic=()=>{if(homeMusicActivated||!settings.musicEnabled)return;homeMusicActivated=true;music.setContext(hud.selected,undefined,'lobby');musicPanel.setEnabled(true);};
window.addEventListener('pointerdown',activateHomeMusic,{once:true});
window.addEventListener('keydown',activateHomeMusic,{once:true});
let musicContext='';
input.onTarget=()=>{const s=network.snapshot,p=s?.players.find(p=>p.id===network.id);if(!s||!p)return;
  if(!p.alive&&(objectiveOf(s)||riftOf(s))){switchSquadSubject(p,s,1);return;}
  targetId=targeting.cycle(targetPlayers(s),p,input.yaw);if(!targeting.locked)autoLock.decline(s,startEpoch);hud.notify(targeting.locked?'LOCKED ON':'LOCK RELEASED',.7);};input.onMenu=(source,via='menu')=>{if(source==='controller')hud.focusBy('pad'); if(swapPicker.open){swapPicker.close();return;}if(via==='pause'){if(started||hud.settingsOpen)hud.toggleSettings();return;}if(fighterLabEntry?.open){fighterLabEntry.close();return;}if(finale.holding(seconds())&&!hud.settingsOpen){skipFinale();return;}if(vsSplash.open){vsSplash.skip();return;}if(!hud.settingsOpen&&riftOf(network.snapshot)&&riftUI.controllerAction('back'))return;if(shell.back(source))return;if(partyUI.open){partyUI.close();return;}if(careerUI.open){careerUI.close();return;}if(hud.objectives.closeSetup())return;if(bugReport.open){bugReport.dialog.close();return;}if(hud.skipIntro())return;if(hud.resultsOpen&&!hud.settingsOpen){hud.onLeave();return;}if((via==='menu'||hud.settingsOpen)&&(started||hud.settingsOpen||(source==='controller'&&hud.homeVisible)))hud.toggleSettings();};
input.onModeChange=mode=>{hud.setInputMode(mode,input.controllerLabel,input.family);survivalHud.setInputMode(mode,input.family);};
const touch=new TouchControls(input,root);touch.onEmote=emote;if(input.mode==='touch')input.onModeChange('touch');
onEmoteVoice(hero=>{audio.say('taunt',hero);});
const qualityWatch=new QualityWatch();
input.onInteract=explicit=>{if(riftOf(network.snapshot))return riftUI.interact(explicit);return hud.objectives.interact();};
input.onUiAction=action=>{hud.focusBy('pad');if(fighterLabEntry?.controller(action))return;if(finale.holding(seconds())&&!hud.settingsOpen){if(action==='confirm')skipFinale();return;}if(inkSelectController(action))return;if(swapPicker.controller(action))return;if(vsSplash.open&&(action==='confirm'||action==='back')){vsSplash.skip();return;}if(shell.controller(action))return;if(partyUI.controller(action)||careerUI.controller(action))return;if(bugReport.controller(action))return;if(riftIntro.open){riftIntro.skip();return;}if(!hud.settingsOpen&&riftOf(network.snapshot)&&riftUI.controllerAction(action))return;if(!hud.settingsOpen&&survival()&&survivalHud.controller(action))return;hud.controllerAction(action);};
hud.onPrivateStart=()=>network.startPrivateMatch();
for(const each of [online,arcade,practice,duel,royale,localObjective,localRift])each.onNotice=message=>{if(riftOf(network.snapshot))riftUI.notice(message);else hud.notify(message);};
riftUI.onCustom=(type,payload)=>{if(type==='rift-requeue'||type==='rift-rematch'&&network===localRift)hud.onPlayAgain();else network.room?.send(type,payload);};
riftUI.onLeave=()=>hud.onLeave();riftUI.onPause=()=>hud.toggleSettings();
localRift.onDisconnect=message=>{returnToLobby();hud.error(message);};
hud.onTraining=command=>{const side=swapSideOf(command),value=side?(command as {value?:unknown}).value:undefined;
  if(side&&typeof value==='string'&&value in FIGHTERS&&((command as {lab:string}).lab!=='opponent'||network===practice)){void switchTraining(side,value as FighterId,!!(command as {random?:boolean}).random);return;}
  network.room?.send('training',command);};
hud.onResume=()=>{input.clear();if(settings.musicEnabled&&started)music.resume();};
const finale=new Finale(),seconds=()=>performance.now()/1000;
let finaleSelf='';
const skipFinale=(force=false)=>finale.skip(seconds(),force);
const finaleSkip=new FinaleSkip(root.querySelector<HTMLElement>('#interface')??root,()=>skipFinale());
hud.finale=hud.objectives.finale=riftUI.finale=()=>finale.holding(seconds());
const lineSeconds=(fighter:FighterId)=>{const url=HOME_VOICES[fighter];return audio.winSeconds(fighter)??(url?audio.sampleSeconds(url):undefined)??HOME_VOICE_SECONDS[fighter];};
window.addEventListener('keydown',event=>{if((event.code==='Enter'||event.code==='NumpadEnter')&&!event.repeat&&!hud.settingsOpen&&finale.holding(seconds())){event.preventDefault();skipFinale();}},true);
window.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'&&!hud.settingsOpen&&finale.holding(seconds()))skipFinale();},true);
hud.objectives.onCommand=(action,role)=>{if(network===localObjective){if(action==='rematch')hud.onPlayAgain();return;}online.objectiveCommand(action,role);};
localObjective.onNotice=message=>hud.objectives.notice(message);localObjective.onDisconnect=message=>{returnToLobby();hud.error(message);};
let lastMatchStart:Parameters<typeof hud.onStart>|undefined;
hud.onPlayAgain=()=>{if(network.snapshot?.duel?.phase==='complete'&&network.snapshot.players.length===2){network.room?.send('duel-runback');return;}if(party.joined){returnToLobby();partyUI.show();partyUI.notice('Ready up with your party for the next match.');return;}if(!lastMatchStart)return;const [fighter,mode,name,access]=lastMatchStart;
  const rival=access?.kind==='duel'&&access.access==='bot'?duel.snapshot?.players.find(p=>p.isBot)?.fighter:undefined;
  const nextAccess=rival&&access?.kind==='duel'?{...access,rival}:access?.kind==='duel'&&(access.access==='host'||access.access==='join')?{kind:'duel' as const,access:'host' as const,place:access.access==='host'?access.place:undefined}:access?.kind==='create-private'||access?.kind==='join-private'?{kind:'create-private' as const,players:network.snapshot?.lobby?.size??8,place:access.kind==='create-private'?access.place:undefined}:access;returnToLobby();void hud.onStart(fighter,mode,name,nextAccess);};
hud.onPractice=()=>{const fighter=lastMatchStart?.[0]??hud.selected,name=lastMatchStart?.[2]??'Fighter';returnToLobby();void hud.onStart(fighter,'training',name);};
function playLocally(local:NonNullable<ReturnType<typeof loneQueue>>){const [fighter,mode,name]=lastMatchStart!;loneNotice();keepPlace=local.kind==='bots'?local.place??null:null;try{returnToLobby();}finally{keepPlace=null;}void hud.onStart(fighter,mode,name,local);}
hud.onFightBot=()=>{const [fighter,,name,access]=lastMatchStart??[hud.selected,'match',hud.playerName(),undefined],rival=(access?.kind==='duel'?access.rival:undefined)??modePrefs('duel').rival;returnToLobby();void hud.onStart(fighter,'match',name,{kind:'duel',access:'bot',rival,place:namedPlaceFor('duel','offline')});};
hud.onSettings=s=>{Fighter.animStyle=animOverride??s.animStyle;input.sensitivity=s.sensitivity;input.rumble.scale=s.vibration;effects.density=s.effects;manga.density=s.effects;view.applySettings(s);audio.setMix({master:s.volume,sfx:s.sfxVolume,voice:s.voiceVolume});homeVoice.setMix(s.volume,s.voiceVolume);music.setVolume(s.volume*s.musicVolume);};
hud.onStart=async(fighter,mode,name,access)=>{{const refused=activePack()&&packRefuses(mode,access as {kind:string});if(refused){hud.error(refused);return;}}if(party.joined&&access?.kind!=='party'){partyUI.show();partyUI.notice(party.view?.leader===party.id?'You lead a party: choose the match here and START it together.':'You are in a party: READY here, and your leader starts the match.');return;}const laboratory=mode==='training'&&(!access||access.kind==='public')&&fighter===laboratoryFighter()?fighter:undefined;const epoch=++startEpoch;if(!laboratory&&lockedStart(fighter,mode==='training'))return;fighterLabEntry?.close();homeVoice.stop();
  let openAudio=()=>{};if(thinLine()&&!(access?.kind==='survival'||access?.kind==='coop-create'||access?.kind==='coop-join'||access?.kind==='party'&&access.travel.mode==='survival'))audio.holdFetches(new Promise<void>(open=>{openAudio=open;}),60_000);
  void audio.unlock().then(()=>audio.preload([FIGHT_LINE,VICTORY_LINE,FLAWLESS_LINE])).catch(console.warn);try{hud.busy(true);
    const riftRun=access?.kind==='rift-war'&&access.access==='bots';
    const arcadeRun=access?.kind==='survival',coopRun=access?.kind==='coop-create'||access?.kind==='coop-join'||access?.kind==='party'&&access.travel.mode==='survival';
    let firstWorld:Promise<void>=Promise.resolve(),story:Promise<void>=Promise.resolve();
    const objectiveRun=access?.kind==='objective'&&(access.access==='bots'||access.access==='solo');
    const royaleRun=access?.kind==='bots';
    const duelRun=access?.kind==='duel'&&access.access==='bot';
    const practiceRun=mode==='training'&&(!access||access.kind==='public')&&LocalTraining.wanted();
    const loadingMode:LoadingMode=loadingModeFor(access,mode,arcadeRun||coopRun);
    if(!((arcadeRun||coopRun)&&RiftIntro.wanted()))loadingScreen.show(fighter,loadingMode,access?.kind==='bots'?access.players:undefined);
    loadingScreen.progress('prepare');
    if(access?.kind!=='party'&&await beforeStart())return;
    library.background(false);const selection=prepareSelection(fighter);selection.catch(()=>{ });
    loadingScreen.progress('connect');
    hud.loading(arcadeRun?'Opening the rift…':coopRun?'Opening a co-op rift…':practiceRun?'Entering training…':objectiveRun?'Entering the battlefield…':'Connecting to arena…',100);await network.leave();
    clearFighters();resetSwaps();
    pauseLink.reset();roomFrozen=false;fightShown=false;
    network=riftRun?localRift:royaleRun?royale:duelRun?duel:arcadeRun?arcade:practiceRun?practice:objectiveRun?localObjective:online;timeline.delayMs=riftRun||royaleRun||duelRun||arcadeRun||practiceRun||objectiveRun?LOCAL_DELAY:ONLINE_DELAY;
    audio.reset();areaFx.reset();effects.reset();luffyEffects.reset();ninjaEffects.reset();killuaEffects.reset();gutsEffects.reset();gojoEffects.reset();spiritBombEffects.reset();lawEffects.reset();emperorEffects.reset();swordStandEffects.reset();awakeningEffects.reset();clashEffects.reset();manga.reset();timeline.reset();lastEvent=0;targetId=null;targeting.reset();viewKeys.reset();objectiveAudio.reset();riftAudio.reset();survivalTargets.clear();riftTargets.clear();riftPredictionTargets.clear();riftAssets.clear();riftField.clear();riftUI.clear();camera.reset();
    horde.clear();grunts.clear();gore.clear();survivalFx.reset();techniques.reset();lastEntrance=0;lastRoar=0;bossesWanted='';lastHordeVoice=0;lastBossVoice=0;lastSmash=0;bossShoutAt.clear();stages.rift?.restore();
    if(arcadeRun||coopRun)audio.preload(everyTake());
    if(access?.kind==='objective'&&access.objective==='last-stand'||access?.kind==='party'&&access.travel.mode==='last-stand')objectiveAudio.preload();
    if((arcadeRun||coopRun)&&RiftIntro.wanted()){riftIntro.preload();story=riftIntro.play();}
    if(riftRun){await localRift.connect(fighter,name);localClock=localRift.snapshot?.serverTime??0;}else if(arcadeRun){
      await arcade.connect(fighter,mode,name);localClock=arcade.snapshot?.serverTime??0;
      survivalHud.enter(fighter);
    }else if(royaleRun&&access?.kind==='bots'){
      await royale.connect(fighter,name,access.players,access.place,access.field);localClock=royale.snapshot?.serverTime??0;
    }else if(duelRun){
      await duel.connect(fighter,name,access?.kind==='duel'?access.rival:undefined,access?.kind==='duel'?access.place:undefined);localClock=duel.snapshot?.serverTime??0;
    }else if(practiceRun){
      await practice.connect(fighter,name);localClock=practice.snapshot?.serverTime??0;
    }else if(objectiveRun&&access?.kind==='objective'){
      await localObjective.connect(fighter,name,access.objective,access.access as 'solo'|'bots',1,access.place);localClock=localObjective.snapshot?.serverTime??0;
    }else{
      await online.connect(fighter,mode,name,access);
      if(coopRun){coopRunSeen=-1;coopTravel='';survivalHud.enter(fighter);firstWorld=prepareRound(1,[]);}
    }
    if(epoch!==startEpoch)return;
    const careerMode:CareerMode=access?.kind==='rift-war'?'rift-war':access?.kind==='duel'?'duel':arcadeRun?'survival':coopRun?'coop':access?.kind==='party'?(access.travel.mode==='royale'?'private':access.travel.mode) as CareerMode:access?.kind==='objective'?access.objective:access?.kind==='bots'?'bots':access?.kind==='create-private'||access?.kind==='join-private'?'private':'royale';
    if(mode!=='training')career.start(careerMode);
    playerTwoPresence(mode==='training'?'Training':CAREER_MODES[careerMode]);
    loadingScreen.progress('room');
    const joined=performance.now();while(!network.snapshot){if(epoch!==startEpoch)return;if(performance.now()-joined>12000)throw new Error('The arena did not respond. Try again.');await new Promise(resolve=>setTimeout(resolve,50));}
    {const room=network.snapshot,stage=room.stage??'harbor';
      loadingScreen.room(STAGES[stage]?.name,room.players.filter(p=>!p.enemy).map(p=>({fighter:p.fighter,self:p.id===network.id})),id=>library.has(id),()=>stageLoaded===stage);}
    loadingScreen.progress('assets');
    await ensureSnapshotAssets(network.snapshot,()=>{loadingScreen.progress('warm');openAudio();},selection);if(epoch!==startEpoch)return;
    pilot=autopilotParam&&autopilotAllowed?new Autopilot(.8,network.id):undefined;
    hud.setSurvival(arcadeRun||coopRun);lastMatchStart=[fighter,mode,name,access?.kind==='bots'&&access.lone?{kind:'bots',players:access.players}:access];hud.resultAgainLabel=access?.kind==='duel'?(access.access==='online'?'FIND NEXT DUEL':access.access==='bot'?'DUEL AGAIN':'NEW FRIEND DUEL'):access?.kind==='create-private'||access?.kind==='join-private'?'NEW PRIVATE ROOM':'PLAY AGAIN';
    music.setContext(fighter,undefined,'combat');musicPanel.setEnabled(settings.musicEnabled);started=true;fetchPlannedBots();clearInterval(inputTimer);inputClock.reset();unacked.length=0;inputTimer=setInterval(pushInput,1000/INPUT_HZ) as unknown as number;hud.enter(fighter);loadingScreen.done();input.enabled=true;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(epoch!==startEpoch)return;fightShown=true;if(network===online)online.ready();
      if(coopRun&&access?.kind==='party')void Promise.all([firstWorld.catch(()=>{}),story]).then(()=>{const run=online.run?.run;if(epoch===startEpoch&&network===online&&run!==undefined)online.loaded(run);});}));
    if(practiceRun){const room=network.snapshot!,foe=room.players.find(p=>p.isBot);
      if(foe){vsPending=true;setTimeout(()=>{vsPending=false;if(epoch!==startEpoch)return;
        void vsSplash.play({left:{fighter,name:FIGHTERS[fighter].name,tag:`YOU · ${name}`},rights:[{fighter:foe.fighter,name:FIGHTERS[foe.fighter].name,tag:'SPARRING BOT'}],stage:STAGES[room.stage]?.name})
          .then(()=>{if(epoch===startEpoch)void vsSplash.fight();});},420);}}
    input.yaw=network.snapshot?.players.find(p=>p.id===network.id)?.yaw??Math.PI;camera.lookAlong(input.yaw);}catch(error){loadingScreen.hide();if(epoch!==startEpoch)return;await network.leave();library.background(true);network=online;if(await recover(error))return;
    reportStartFailure(error);
    hud.error(error instanceof Error?error.message:String(error));}finally{openAudio();}};
survivalHud.onChoose=id=>{if(network===arcade)arcade.choose(id);else online.choose(id);};
survivalHud.onReroll=()=>{if(network===arcade)arcade.reroll();else online.reroll();};
async function prepareRound(_round:number,extra:readonly string[],stage?:StageId){
  const epoch=startEpoch,current=()=>epoch===startEpoch;
  if(!started)hud.loading('Summoning the horde…',100);
  gore.prepare();

  const [,stageTextures]=await Promise.all([grunts.load(),stage&&isRiftStage(stage)?preloadRiftAssets(stage):[]]);
  if(!current())return;
  if(stage)await stages.preload(stage);
  if(!current())return;
  if(extra.length)await horde.load(extra,label=>{if(!started)hud.loading(label,100);});
  if(!current())return;
  const release=extra.length?horde.warm(view.scene,extra):()=>{};
  try{await view.compileScene();if(current()){if(started)await view.uploadTexturesOverFrames(current,stageTextures);else view.uploadTextures(undefined,stageTextures);}}
  catch(error){console.warn('Survival: warm-up failed',error);}finally{release();}}
arcade.prepare=prepareRound;
let bossesWanted='';
function wantBosses(ids:readonly string[],portraits=true){
  ids=[...new Set(ids.filter(id=>!!ENEMIES[id]))].sort();
  const models=[...new Set(ids.map(id=>ENEMIES[id].model))].sort();
  const key=`${portraits}:`+models.join(',');
  const added=models.some(model=>!bossesWanted.includes(model));
  if(key===bossesWanted)return;
  bossesWanted=key;
  const epoch=startEpoch,current=()=>epoch===startEpoch&&key===bossesWanted&&started;
  void horde.load(ids).then(()=>{
    if(!current()){horde.collect();return;}
    horde.keepOnly(ids);if(!added)return;
    const release=horde.warm(view.scene,ids);
    const warm=warming.then(async()=>{
      for(const root of horde.warmRoots(ids)){
        if(!current())return;
        await view.compileScene(root);
      }
    }).finally(release);
    warming=warm.then(()=>{},()=>{});
  }).catch(error=>console.warn('Survival: boss load failed',error));
  if(portraits)for(const id of ids){const portrait=new Image();portrait.decoding='async';portrait.src=`/assets/survival/portraits/${id}.webp`;}
  horde.keepOnly(ids);
}
let coopRunSeen=-1,coopTravel='';
function coopFrame(sv:RunView){
  if(sv.phase!=='lobby'&&riftIntro.open)riftIntro.close();
  if(sv.run!==undefined&&sv.run!==coopRunSeen){
    if(coopRunSeen>=0){survivalHud.enter(sv.party[0]?.fighter??hud.selected);survivalFx.reset();techniques.reset();lastEntrance=0;lastRoar=0;lastHordeVoice=0;lastBossVoice=0;lastSmash=0;stages.rift?.restore();}
    coopRunSeen=sv.run;
  }
  if(sv.phase==='travel'&&sv.run!==undefined){const run=sv.run,key=`${run}:${sv.round}`,epoch=startEpoch;if(key!==coopTravel){coopTravel=key;void prepareRound(sv.round+1,[],sv.next).catch(console.warn).finally(()=>{if(epoch===startEpoch&&network===online)online.loaded(run);});}}
}
survivalHud.onRetry=()=>{if(coop()){online.backToLobby();return;}const fighter=arcade.game?.fighter??hud.selected;void hud.onStart(fighter,'match','You',{kind:'survival'});};
survivalHud.onLeave=()=>returnToLobby();
const autopilotParam=new URLSearchParams(location.search).has('autopilot');
const autopilotAllowed=import.meta.env.DEV||['localhost','127.0.0.1','[::1]'].includes(location.hostname);
let pilot:Autopilot|undefined;
let inputTimer=0;
const inputClock=new InputClock();
function sendCommand(){
  const snapshot=network.snapshot;
  if(!snapshot||!network.id)return;
  const moving=movementMask(input.keys);
  let command=input.command(targetId,viewKeys.movementBasis(camera.movementBasis(moving),moving));
  command.yaw=camera.aimYaw;
  command.lock=targeting.locked;
  if(network===online&&timeline.drawnAt!==null)command.view=timeline.drawnAt;
  if(pilot&&survival()){const auto=pilot.command(snapshot.players,snapshot.serverTime);command={...auto,seq:command.seq};if(auto.targetId)targetId=auto.targetId;}
  const sent=exercise.active?exercise.command(command,snapshot,network.id)
    :input.enabled?command:{...command,moveX:0,moveZ:0,attack:undefined,jump:false,dash:false,guard:false,awaken:false};
  if(!network.send(sent))return;if(network===online)unacked.push(sent.seq);prediction.submit(sent);
  for(const cast of presentEvents(prediction.takeCasts(),snapshot.players)){
    if(cast.fighter==='naruto'&&cast.slot==='heavy')predictedVisuals.push({...cast,id:PREDICTED_EVENT_BASE+cast.id});
    if(cast.slot)predictedCasts.set(castKey(cast),performance.now());
    if(cast.slot==='area'&&cast.move&&cast.fighter)showAreaBanner(cast.body??cast.fighter,cast.move,cast.fighter);
    else if(cast.move&&!(cast.slot==='ultimate'&&carded()))hud.notify(cast.move.toUpperCase(),1.1);
    audio.handle([{...cast,id:PREDICTED_EVENT_BASE+cast.id}],network.id,presentPlayers(snapshot.players));
  }
}
const MAX_IN_FLIGHT=40,unacked:number[]=[];
function inFlight(){
  const ack=network.snapshot?.players.find(p=>p.id===network.id)?.ackSeq;
  if(ack!==undefined)while(unacked.length&&unacked[0]<=ack)unacked.shift();
  return unacked.length;
}
function pushInput(){
  if(!started||!network.snapshot||!network.id||!network.predictionReady)return;
  localPausePump();
  if(localNetwork()?.paused){inputClock.reset();return;}
  if(network===online&&pauseLink.holding){inputClock.reset();return;}
  if(network===online)prediction.flush();
  const due=inputClock.advance(performance.now()),wire=network===online;
  for(let steps=0;steps<due&&!(wire&&inFlight()>=MAX_IN_FLIGHT);steps++)sendCommand();
}
function localPausePump(){
  const local=localNetwork();if(!local)return;
  local.paused=bugReport.open||hud.settingsOpen||document.hidden||!fightShown
    ||network===arcade&&riftIntro.open||network===practice&&(vsSplash.open||vsPending||swapPicker.open);
}
function pausePump(){
  localPausePump();
  if(network!==online||!online.room)return;
  const request=pauseLink.update(document.hidden||started&&(bugReport.open||hud.settingsOpen||swapPicker.open),performance.now());
  if(request)online.control(request);
}
document.addEventListener('visibilitychange',pausePump);
function returnToLobby(tellParty=true){finale.reset();resetSwaps();pauseLink.reset();roomFrozen=false;fightShown=false;vsSplash.skip();audio.setSpace(undefined);audio.setAmbience(undefined);cutIn.hide();cutInSeen.clear();loadingScreen.hide();library.background(true);startEpoch++;career.leave();playerTwoPresence(null);if(tellParty)party.send('party-home');objectivePhase='';objectiveRound=0;duelRoundKey='';matchBell.reset();objectiveField.reset();started=false;riftIntro.close();survivalHud.leave();horde.clear();grunts.clear();gore.clear();bossesWanted='';survivalFx.reset();techniques.reset();horde.keepOnly([]);hud.setSurvival(false);introFor=null;victoryFor=null;clearInterval(inputTimer);inputTimer=0;prediction.stop();localCollision=undefined;localCollisionStage=null;collisionGeneration++;predictedCasts.clear();predictedVisuals.length=0;wantStage('harbor');input.enabled=false;input.clear();document.exitPointerLock?.();void network.leave();audio.reset();effects.reset();luffyEffects.reset();ninjaEffects.reset();killuaEffects.reset();gutsEffects.reset();gojoEffects.reset();spiritBombEffects.reset();lawEffects.reset();emperorEffects.reset();swordStandEffects.reset();awakeningEffects.reset();clashEffects.reset();manga.reset();timeline.reset();clearFighters();lastEvent=0;targetId=null;targeting.reset();viewKeys.reset();objectiveAudio.reset();riftAudio.reset();survivalTargets.clear();riftTargets.clear();riftPredictionTargets.clear();riftAssets.clear();riftField.clear();riftUI.clear();camera.reset();musicContext='';music.setContext(hud.selected,undefined,'lobby');network=online;timeline.delayMs=ONLINE_DELAY;hud.lobby();fighterLabEntry?.show();}
hud.onLeave=()=>{returnToLobby();if(party.joined)partyUI.show();};
for(const each of [online,arcade,practice,duel,royale,localObjective,localRift])each.onDisconnect=(reason,code)=>{
  const over=code===4006;
  const shown=started&&finale.ended?timeline.sample(performance.now())?.snapshot:undefined,self=shown?.players.find(p=>p.id===finaleSelf);
  if(shown&&self){skipFinale(true);hud.roomGone=true;hud.update(shown,self,undefined,over);if(over)hud.link(undefined);riftUI.update(shown,finaleSelf);if(!over)hud.banner(reason);return;}
  returnToLobby();hud.banner(reason);};
for(const each of [online,arcade,practice,duel,royale,localObjective,localRift])each.onControlReset=()=>{unacked.length=0;input.clear();input.enabled=false;prediction.stop();localCollision=undefined;localCollisionStage=null;collisionGeneration++;predictedCasts.clear();predictedVisuals.length=0;inputClock.reset();};
let objectiveRound=0,objectivePhase='',duelRoundKey='';
const matchBell=new MatchBell();
const onSnapshot=(snapshot:GameSnapshot)=>{
  if(network===online&&started&&lastMatchStart){const local=loneQueue(snapshot,network.id,lastMatchStart[3],online.plannedBots);if(local){playLocally(local);return;}}
  if(network===online){const frozen=!!snapshot.pause?.paused;if(roomFrozen&&!frozen)timeline.reanchor();roomFrozen=frozen;pauseLink.observe(snapshot);pausePump();}
  const duelKey=snapshot.duel?`${snapshot.duel.set}:${snapshot.duel.round}`:'';
  if(snapshot.duel?.phase==='playing'&&snapshot.status==='active'&&duelKey!==duelRoundKey){if(duelRoundKey){clearFighters();}duelRoundKey=duelKey;timeline.reset();camera.reset();introFor=null;victoryFor=null;network.onControlReset();input.yaw=snapshot.players.find(p=>p.id===network.id)?.yaw??Math.PI;camera.lookAlong(input.yaw);}
  if(!snapshot.duel)duelRoundKey='';
  if(matchBell.rang(snapshot)){input.yaw=snapshot.players.find(p=>p.id===network.id)?.yaw??Math.PI;camera.reset();camera.lookAlong(input.yaw);}
  hud.modes.snapshot(snapshot);
  if(started&&practiceRoom(snapshot))watchSwaps(snapshot);
  career.observe(snapshot,network.id);
  if(started)streamSnapshotAssets(snapshot);
  const modeView=objectiveOf(snapshot),warView=riftOf(snapshot),round=modeView?.round??warView?.round??0;
  if(round!==objectiveRound){
    objectiveRound=round;objectivePhase='';timeline.reset();lastEvent=0;prediction.stop();localCollision=undefined;localCollisionStage=null;collisionGeneration++;input.clear();inputClock.reset();unacked.length=0;predictedCasts.clear();predictedVisuals.length=0;objectiveField.reset();horde.clear();techniques.reset();bossesWanted='';
    audio.reset();areaFx.reset();effects.reset();luffyEffects.reset();ninjaEffects.reset();killuaEffects.reset();gutsEffects.reset();gojoEffects.reset();spiritBombEffects.reset();lawEffects.reset();emperorEffects.reset();swordStandEffects.reset();awakeningEffects.reset();clashEffects.reset();manga.reset();camera.reset();victoryFor=null;introFor=null;targeting.reset();targetId=null;
    clearFighters();
  }
  if((modeView?.phase??warView?.phase)==='active'&&objectivePhase!=='active'){input.yaw=snapshot.players.find(p=>p.id===network.id)?.yaw??Math.PI;input.clear();camera.reset();}
  if(modeView?.kind==='last-stand')wantBosses([...new Set([...(modeView.village?.incoming??[]),...snapshot.players.flatMap(p=>p.enemy?[p.enemy]:[])])],false);
  objectivePhase=modeView?.phase??warView?.phase??'';
  timeline.push(snapshot,performance.now());
  if(!started||!network.id||!network.predictionReady)return;
  inputClock.report(snapshot.queued);
  if(network===arcade||network===practice||network===localObjective||network===localRift||network===duel||network===royale)return;
  riftPredictionTargets.update(snapshot,network.id);
  const external=warView?riftPredictionTargets:undefined,assist=warView?{magnet:RIFT_RULES.aimMagnet}:undefined;
  if(!prediction.enabled){if(snapshot.players.some(p=>p.id===network.id)){ensureLocalCollision(snapshot.stage??'harbor');prediction.start(network.id,snapshot,localCollision);prediction.setExternalTargets(external,assist);}}
  else {prediction.setExternalTargets(external,assist);prediction.receive(snapshot);}
};
online.onSnapshot=onSnapshot;arcade.onSnapshot=onSnapshot;practice.onSnapshot=onSnapshot;localObjective.onSnapshot=onSnapshot;duel.onSnapshot=onSnapshot;royale.onSnapshot=onSnapshot;localRift.onSnapshot=onSnapshot;
let pendingCompile=false,compiling=false;
const involved=(event:CombatEvent)=>event.actorId===network.id||event.targetId===network.id;
const nearby=(event:CombatEvent)=>{
  const at=event.endpoint??event.origin;
  if(!at||!shownSelf)return Infinity;
  return Math.hypot(at.x-shownSelf.x,at.z-shownSelf.z);
};
const witness=(event:CombatEvent)=>involved(event)?1:Math.max(0,1-nearby(event)/16)*.45;
const eventStyle=(event:CombatEvent)=>event.fighter&&event.slot
  ?(event.slot==='light'&&(event.chain??0)>0?rushMove(event.fighter,event.chain!,false):MOVES[event.fighter][event.slot]).style:undefined;
const impactDetail=(event:CombatEvent)=>{const awakened=!borrowedEvent(event)&&!!network.snapshot?.players.find(p=>p.id===event.actorId)?.awakened,big=bigBlowOf(event,awakened)||cinematicBlowOf(event,awakened);
  return {chain:event.chain,fromBehind:event.fromBehind,reaction:event.reaction,...(big?{big,tint:elementFor(event.fighter,event.slot,awakened,event.chain??0,event.branch as ComboKey|undefined).spike}:{}),...(event.downed?{downed:true}:{}),...(event.lift?{lift:event.lift}:{})};};
const bigBlowSound=(event:CombatEvent)=>{
  if(event.kind!=='hit')return;
  const awakened=!borrowedEvent(event)&&!!network.snapshot?.players.find(p=>p.id===event.actorId)?.awakened;
  if(!bigBlowOf(event,awakened))return;
  audio.bigBlow(event.endpoint??event.origin??{x:0,y:0,z:0},event.actorId,.8+Math.min(.35,(event.damage??60)/300));
  if(event.actorId===network.id||event.targetId===network.id)
    music.punch(event.slot==='special'?BIG_HITSTOP.special:event.slot==='ultimate'?BIG_HITSTOP.ultimate:event.branch?BIG_HITSTOP.ender:BIG_HITSTOP.finisher);
};
const blowHeading=(event:CombatEvent)=>event.origin&&event.endpoint
  ?new THREE.Vector3(event.endpoint.x-event.origin.x,0,event.endpoint.z-event.origin.z):undefined;
function survivalSounds(snapshot:GameSnapshot){
  for(const event of snapshot.events){
    const at=event.endpoint??event.origin;if(!at)continue;
    const mine=event.targetId===network.id;
    if(event.enemy&&event.kind==='cast')audio.cue('swing-a',event.origin??at,.28,.85+Math.random()*.25,event.actorId,0);
    else if(event.enemy&&event.kind==='release'&&event.slot==='special')audio.cue('crack',at,.45,.7,event.actorId,1);
    else if(event.enemy&&event.kind==='hit'&&mine){audio.cue('body-a',at,.9,.95+Math.random()*.1,event.actorId,4);audio.cue('crack',at,.3,1.3,event.actorId,3);}
    else if(event.enemy&&(event.kind==='blocked'||event.kind==='guard-break')&&mine)audio.cue('crack',at,event.kind==='guard-break'?.8:.45,event.kind==='guard-break'?.8:1.5,event.actorId,3);
    else if(isProc(event.move)&&event.kind==='hit'&&!isQuiet(event.move))audio.cue('body-b',at,.22,1.25+Math.random()*.2,'proc',0);
    else if(event.kind==='eliminated'&&event.targetId!==network.id&&event.targetId&&!fighters.has(event.targetId))audio.cue('ground',at,.35,.75+Math.random()*.2,'fall',0,.25);
    else if(event.kind==='poise-break')audio.cue('bomb',at,.7,1.35,'break',4);
  }
}
let lastHordeVoice=0,hordeVoiceBudget=6,hordeVoiceAt=0;
function hordeVoices(){
  const events:readonly HordeEvent[]=network===arcade?arcade.game?.horde.eventsSince(lastHordeVoice)??[]:online.hordeEvents.filter(event=>event.id>lastHordeVoice);
  if(!events.length)return;
  lastHordeVoice=events[events.length-1].id;
  const now=performance.now()/1000;hordeVoiceBudget=Math.min(6,hordeVoiceBudget+(now-hordeVoiceAt)*7);hordeVoiceAt=now;
  const me=shownSelf;
  for(const event of events){
    const kind=GRUNTS[event.type];if(!kind)continue;
    const distance=me?Math.hypot(event.x-me.x,event.z-me.z):0;if(distance>30)continue;
    const lines=LINES[VOICE_OF[kind.id]??'beast'],pitch=(PITCH[kind.id]??1)*(.94+Math.random()*.12);
    const at={x:event.x,y:event.y+1.4,z:event.z},owner=`g${event.serial}`;
    const say=(family:Family,gain:number,chance:number,delay=0)=>{if(hordeVoiceBudget<1||Math.random()>chance*(distance<8?1.6:1))return;hordeVoiceBudget--;audio.sample(take(family),at,gain,pitch,owner,0,delay);};
    switch(event.kind){
      case 'windup':{const move=kind.moves[event.value];if(move?.kind==='charge'){say(lines.cry,.8,1);break;}say(lines.swing,.55,.4);if(move&&move.kind!=='shot'&&distance<14)audio.cue(Math.random()<.5?'swing-a':'swing-b',at,.2,.9+Math.random()*.25,owner,0,move.contact*.9);break;}
      case 'death':say(lines.die,.62,.45);if(event.value===DEATH.SLICED||event.value===DEATH.BURST)audio.sample(take('gore'),at,.5,.9+Math.random()*.25,owner,0);break;
      case 'spawn':say(lines.cry,.5,.12);break;
      case 'bark':say(lines.hurt,.6,.8);break;
      case 'topple':say(lines.hurt,.45,.12);break;
      case 'slam':audio.cue('bomb',at,.55,.8,owner,1);audio.sample(take('stomp'),at,.8,.8,owner,1);break;
      case 'explode':audio.cue('bomb',at,.8,1.1,owner,1);audio.sample(take('gore'),at,.6,.8,owner,1);break;
      case 'shot':{const element=kind.moves[event.value]?.element;const steel=element==='steel'||element==='blaster';audio.cue(steel?'crack':'release-ki',at,steel?.35:.25,steel?.75:1.3+Math.random()*.2,owner,0);break;}
    }
  }
}
let lastBossVoice=0,lastSmash=0;const bossShoutAt=new Map<string,number>();
function smashes(sv:RunView){
  for(const item of sv.feed){
    if(item.id<=lastSmash||item.kind!=='smash')continue;lastSmash=item.id;
    stages.rift?.smash(item.value??0);
    const at={x:item.x??0,y:.5,z:item.z??0};audio.cue('crack',at,.5,.7+Math.random()*.2,'prop',1);audio.cue('ground',at,.3,1.3,'prop',0,.03);
  }
}
function speakBoss(enemy:string,moment:BossMoment,at:{x:number;y:number;z:number},owner:string,gain=.9){
  const line=bossLine(enemy,moment);if(!line)return;
  if('url' in line)audio.sample(line.url,at,gain,line.rate,owner,3,0,'voice');else audio.cue(line.cue,at,gain,line.rate,owner,3);
}
function bossVoices(sv:RunView,snapshot:GameSnapshot){
  for(const item of sv.feed){
    if(item.id<=lastBossVoice)continue;lastBossVoice=item.id;
    if(!item.enemy||(item.kind!=='boss'&&item.kind!=='enraged'&&item.kind!=='break'&&item.kind!=='down'))continue;
    const body=item.actor?horde.body(item.actor):undefined,pos=body?.group.position;
    const at={x:pos?.x??item.x??shownSelf?.x??0,y:(pos?.y??item.y??0)+2,z:pos?.z??item.z??shownSelf?.z??0};
    const moment:BossMoment=item.kind==='boss'?'entrance':item.kind==='enraged'?'rage':item.kind==='break'?'hurt':'defeat';
    speakBoss(item.enemy,moment,at,item.actor??item.enemy,moment==='hurt'?.8:1);
  }
  const now=performance.now()/1000;
  for(const event of snapshot.events){
    if(event.kind!=='cast'||!event.enemy||!isChampion(event.actorId))continue;
    if(now<(bossShoutAt.get(event.actorId)??0)||Math.random()>.45)continue;
    bossShoutAt.set(event.actorId,now+2.6);
    const at=event.origin??shownSelf??{x:0,y:0,z:0};speakBoss(event.enemy,'attack',{x:at.x,y:at.y+1.5,z:at.z},event.actorId,.8);
  }
}
function bodiesFor(snapshot:GameSnapshot){
  const war=riftOf(snapshot);
  for(const [id,body] of hiddenRiftBodies){if(snapshot.players.some(p=>p.id===id)){hiddenRiftBodies.delete(id);body.group.visible=true;fighters.set(id,body);}else if(!war?.seats.some(s=>s.id===id)){body.dispose();hiddenRiftBodies.delete(id);}}
  for(const p of snapshot.players){if(p.enemy||!library.has(p.fighter))continue;const outfit=packHas(p.fighter)?undefined:library.outfitReady((p.id===network.id&&network===practice&&snapshot.roomMode==='training'?laboratoryOutfit(p.fighter):undefined)??p.outfit??(p.id===network.id?playerOutfit(p.fighter):undefined),p.fighter),have=fighters.get(p.id); if(have&&(have.outfitId!==outfit||have.bodyFighter!==p.fighter)){if(have.bodyFighter!==p.fighter)rebodied=true;have.dispose();fighters.delete(p.id);}if(!fighters.has(p.id)){const fighter=library.create(p,outfit);fighters.set(p.id,fighter);view.scene.add(fighter.group);pendingCompile=true;}}
  for(const [id,fighter] of fighters)if(!snapshot.players.some(p=>p.id===id&&!p.enemy)){if(war?.seats.some(s=>s.id===id)){fighter.group.visible=false;hiddenRiftBodies.set(id,fighter);}else fighter.dispose();fighters.delete(id);}
}
let rebodied=false;
function clearFlights(){audio.reset();areaFx.reset();effects.reset();luffyEffects.reset();ninjaEffects.reset();killuaEffects.reset();gutsEffects.reset();gojoEffects.reset();spiritBombEffects.reset();lawEffects.reset();emperorEffects.reset();swordStandEffects.reset();awakeningEffects.reset();clashEffects.reset();manga.reset();predictedCasts.clear();predictedVisuals.length=0;}
function applyCombatFrame(snapshot:GameSnapshot){
  bodiesFor(snapshot);
  if(rebodied){rebodied=false;if(practiceRoom(snapshot)){clearFlights();retainRoomEffects([...snapshot.players,...benched().map(fighter=>({fighter}))],effects);}}
  const self=snapshot.players.find(p=>p.id===network.id);if(self)targetId=targeting.update(targetPlayers(snapshot),self,snapshot.events,snapshot.serverTime,input.yaw);
  {const rival=autoLock.want(snapshot,network.id,startEpoch,targeting.locked);if(rival){targeting.lockOn(rival);targetId=rival;}}
  const echoed=new Set<number>();
  if(prediction.enabled)for(const event of snapshot.events){
    if(event.kind!=='cast'||event.actorId!==network.id||!event.slot)continue;
    const at=predictedCasts.get(castKey(event));
    if(at===undefined||performance.now()-at>1200)continue;
    predictedCasts.delete(castKey(event));echoed.add(event.id);
  }
  const defence=objectiveOf(snapshot)?.kind==='last-stand',hordeMode=survival()||defence;
  const notable=(id:string)=>defence?id===objectiveOf(snapshot)?.village?.bossActor:isChampion(id);
  const roster=riftOf(snapshot)?snapshot.events.filter(event=>event.kind!=='eliminated'||snapshot.players.some(p=>p.id===event.targetId)):hordeMode?snapshot.events.filter(event=>!event.enemy&&!isProc(event.move)&&!(event.kind==='eliminated'&&event.targetId&&event.targetId!==network.id&&!notable(event.targetId))):snapshot.events;
  const bodies=hordeMode?snapshot.players.filter(p=>!p.enemy):snapshot.players;
  audio.handle(roster.filter(event=>!echoed.has(event.id)&&!prediction.impactWasPresented(event)),network.id,presentPlayers(bodies));manga.handle(roster,network.id,bodies);
  if(objectiveOf(snapshot))objectiveAudio.update(snapshot,network.id);
  if(riftOf(snapshot))riftAudio.update(snapshot,network.id);
  if(hordeMode)survivalSounds(snapshot);if(survival())hordeVoices();
  for(const event of snapshot.events){if(event.id<=lastEvent)continue;lastEvent=event.id;
    eventCounts[event.kind]=(eventCounts[event.kind]??0)+1;
    {const pulse=pulseFor(event,network.id??'',id=>!!snapshot.players.find(player=>player.id===id)?.enemy);if(pulse)input.feel(pulse);}if(event.actorId===network.id&&event.kind==='cast'&&event.move&&!echoed.has(event.id)&&!(event.slot==='ultimate'&&carded())){if(event.slot==='area'&&event.fighter)showAreaBanner(event.body??event.fighter,event.move,event.fighter);else hud.notify(event.move.toUpperCase(),1.1);}if(event.actorId===network.id&&event.kind==='awaken'&&event.move){if(!carded())hud.notify(event.move.toUpperCase(),1.8);camera.impact(.4);}if((event.kind==='hit'||event.kind==='blocked')&&event.endpoint&&(event.damage||event.downed)){
      const heading=event.origin?new THREE.Vector3(event.endpoint.x-event.origin.x,event.endpoint.y-event.origin.y,event.endpoint.z-event.origin.z):undefined;
      const landed=event.kind==='hit';
      const struck=snapshot.players.find(player=>player.id===event.targetId);
      const height=struck?event.endpoint.y-struck.y:undefined;
      const detail=impactDetail(event);
      if(!prediction.impactWasPresented(event))bigBlowSound(event);
      if(!prediction.impactWasPresented(event))fighters.get(event.targetId??'')?.impact(true,event.slot,eventStyle(event),event.contactIndex,heading,landed?event.damage??0:(event.damage??0)*2.2,height,detail);
      if(landed&&!prediction.impactWasPresented(event)&&(event.slot==='light'||event.slot==='heavy'))fighters.get(event.actorId)?.impact(false,event.slot,undefined,undefined,heading,event.damage,undefined,detail);
      if(!landed)fighters.get(event.actorId)?.impact(false,event.slot,undefined,undefined,heading,event.damage,undefined,detail);
      const artOnCrowd=survival()&&isProc(event.move)&&!event.critical&&!!event.targetId&&!isChampion(event.targetId);
      if(landed&&!!event.damage&&!isQuiet(event.move)&&!artOnCrowd&&(involved(event)||nearby(event)<14)){
        const struck=event.targetId;
        damageNumbers.show(event.damage,new THREE.Vector3(event.endpoint.x,event.endpoint.y,event.endpoint.z),
          event.slot==='special'||event.slot==='ultimate'||event.slot==='area',
          struck?()=>{const body=fighters.get(struck);return body?bodyCentre(body,numberAnchor):horde.centre(struck,numberAnchor)??grunts.centre(struck,numberAnchor);}:undefined,struck,!!event.bullseye,event.fighter==='rengoku'&&event.slot==='area');
      }}
      if(event.kind==='hit'&&!prediction.impactWasPresented(event)&&!isQuiet(event.move)){
        const weight=witness(event)*(isProc(event.move)?.35:1);
        if(weight>.01){
          camera.impact(Math.min(1,(.2+screenWorth(event)/460)*weight),blowHeading(event),involved(event)?hitTier(event.slot,event.chain):0);
          if(involved(event)){
            camera.holdFor(Math.min(1,(event.damage??0)/240));markerHoldUntil=performance.now()/1000+.5;
            view.punch(Math.min(.55,screenWorth(event)/420)*settings.effects);
          }
        }
      }
      if(event.actorId===network.id&&event.kind==='rejected'&&event.reason)hud.notify(REJECTIONS[event.reason]??event.reason.toUpperCase(),.7);
      if(event.kind==='just-guard'){if(event.targetId===network.id)hud.notify('PARRY',.8);camera.impact(.5*witness(event),blowHeading(event),involved(event)?1:0);}
      if(event.kind==='guard-break'){camera.impact(.6*witness(event),blowHeading(event),involved(event)?2:0);if(event.targetId===network.id)hud.notify('GUARD BROKEN',.9);else if(event.actorId===network.id)hud.notify('GUARD BREAK',.9);}
      if(event.kind==='eliminated'&&event.actorId===network.id&&event.heal){const me=snapshot.players.find(p=>p.id===network.id);if(me?.maxHp)hud.notify(`+${Math.max(1,Math.round(event.heal/me.maxHp*100))}% HP`,1);}
      if(event.kind==='wall-splat')camera.impact(.46*witness(event));
      if(event.kind==='ground-bounce')camera.impact(.36*witness(event));
      if(event.kind==='land'&&(event.drop??0)>=1)camera.impact(Math.min(.6,.12+((event.drop??0)-1)*.07)*witness(event));
      if(event.kind==='projectile-clash')camera.impact(.42*witness(event));
      if(event.kind==='break'){
        camera.impact(.4*witness(event),blowHeading(event));
        if(event.actorId===network.id)hud.notify('BREAK',.8);
        else if(event.targetId===network.id)hud.notify('BROKEN',.8);
      }}
};
let commonLoad:Promise<void>|undefined;
const compiledFighters=new Set<FighterId>();let warming=Promise.resolve(),effectsWarmed=false;
const startupProgress=()=>hud.loadingStages(startup.snapshot().stages.map(s=>`${s.name}: ${s.state}`).join(' / '));
startup.onChange=startupProgress;
function prepareSelection(fighter:FighterId){
  commonLoad??=startup.stage('Sky',()=>view.loadSky()).then(()=>{}).catch(e=>{commonLoad=undefined;throw e;});
  return Promise.all([commonLoad,library.ensure([fighter],label=>{if(!started)hud.loading(label,20);}),roomExtras([fighter])]).then(()=>{});
}
function roomExtras(ids:readonly FighterId[],donors:readonly FighterId[]=[]){
  void audio.prepare(ids);
  audio.preload(ids.map(id=>HOME_VOICES[id]).filter((url):url is string=>!!url));
  const fx=donors.length?[...ids,...donors]:ids;
  emperorEffects.load(fx);
  return Promise.all([ninjaEffects.load(fx),swordStandEffects.load(fx),effects.load(fx)]).then(()=>{});
}
let stageLoaded:StageId|null=null;
async function loadStage(stage:StageId){
  if(stage==='harbor')await startup.stage('Harbor',()=>stages.preload('harbor'));else await stages.preload(stage);
  stageLoaded=stage;
}
async function ensureSnapshotAssets(snapshot:GameSnapshot,onWarm?:()=>void,also?:Promise<unknown>){
  const epoch=startEpoch,current=()=>epoch===startEpoch;
  const ids=riftAssets.ids(snapshot),donors=effectDonors(snapshot.players,ids);
  refreshAssetVersions();
  const keep=new Set<FighterId>([...ids,...donors,hud.selected,...trainingBench,...swaps.waiting(),...(network===online?online.plannedBots:[])]);
  for(const id of library.releaseGpu(keep))compiledFighters.delete(id);
  library.evict(keep,Math.max(0,(view.governor.relaxed?LIBRARY_STRONG:16)-ids.filter(id=>!library.has(id)).length));
  if(!started||practiceRoom(snapshot))audio.retain(keep);
  const incoming=objectiveOf(snapshot)?.kind==='last-stand'?objectiveOf(snapshot)?.village?.incoming:undefined;
  const loadStart=performance.now();stamp('assets-start');prefetchRoomFx(snapshot.players);
  const soundLater:{armory?:Promise<void>}|undefined=started?undefined:{};
  const extras=roomExtras(ids,[...donors,...benched()]).then(r=>{stamp('extras');return r;}),warmFx=extras.then(()=>{if(!started&&current())retainRoomEffects(snapshot.players,effects);return warmRoomAssets(snapshot.players,{current,areaFx,renderer:view.renderer,camera:view.camera,audio,soundLater});}).then(r=>{stamp('room-fx');return r;});
  const prepareEarly=(id:FighterId)=>{if(started)return;const go=()=>{if(!current()||started)return;try{for(const root of library.prepare(id))view.uploadTextures(root);}catch(error){console.warn('Fighter prepared on the warm-up instead',id,error);}};
    const idle=(globalThis as {requestIdleCallback?:(work:()=>void,options?:{timeout:number})=>number}).requestIdleCallback;if(idle)idle(go,{timeout:400});else setTimeout(go,0);};
  await Promise.all([Promise.all(ids.map(id=>library.ensure([id]).then(()=>prepareEarly(id)))).then(()=>stamp('bodies')),loadStage(snapshot.stage??'harbor').then(()=>stamp('stage')),extras,warmFx,...(also?[also]:[]),...(incoming?[horde.load(incoming),objectiveField.prepare()]:[]),...(riftOf(snapshot)?[riftField.load()]:[])]);
  stamp('assets-loaded');
  if(!current()){horde.collect();return;}
  if(incoming)horde.warm(view.scene,incoming);
  const compileRoom=()=>incoming?stages.withStageLighting(snapshot.stage??'hidden-leaf',()=>view.compileScene()):view.compileScene();
  onWarm?.();await new Promise(resolve=>setTimeout(resolve,0));
  const warm=warming.then(async()=>{
    if(!current())return;
    const needed=ids.filter(id=>!compiledFighters.has(id));if(!needed.length)return;
    const bodies=library.warmup(view.scene,needed);
    const sharedEffects=!effectsWarmed;effectsWarmed=true;
    try{if(sharedEffects)try{awakeningEffects.warmup();clashEffects.warmup();}catch(error){console.warn('Shared effects warm-up',error);}
      const kakashi=bodies.get('warm-kakashi');if(kakashi)ninjaEffects.warmup(kakashi);swordStandEffects.update(0,0,bodies);await compileRoom();if(started)await view.uploadTexturesOverFrames(current);else view.uploadTextures();needed.forEach(id=>compiledFighters.add(id));}
    finally{library.hideWarmup();library.disposeWarmup();if(sharedEffects){awakeningEffects.hideWarmup();clashEffects.hideWarmup();}}
  });warming=warm.catch(()=>{});await warm;
  if(!current()){horde.collect();return;}
  if(started)await view.uploadTexturesOverFrames(current);else view.uploadTextures();
  stamp('warm-compiled');
  if(!started){bodiesFor(snapshot);try{await compileRoom();}catch{ }view.uploadTextures();stamp('room-compiled');
    if(warmEnabled()&&performance.now()-loadStart<45000){const place=stages.root(snapshot.stage??'harbor');view.warmDraw(warmRoots(),[...[...fighters.values()].map(fighter=>fighter.group),...(place?[place]:[])]);stamp('warm-drawn');await warmEffekseer(view.renderer,view.camera).catch(()=>{});stamp('effekseer');}
    if(soundLater){await warmRoomSound({current,audio,soundCap:30_000,armory:soundLater.armory});if(!current()){horde.collect();return;}}}
  if(!started)streamKey=riftAssets.key(snapshot)+transplantKey(snapshot.players);
  if(network.snapshot&&assetSignature(network.snapshot)===assetSignature(snapshot)&&network===online&&!online.coop)online.room?.send('assets-ready',assetSignature(snapshot));
}
let streamKey='',streamPending=false,streamRetryAt=0;
let plannedFetched='';
function fetchPlannedBots(){
  const bots=online.plannedBots,key=bots.join();
  if(!started||network!==online||!bots.length||key===plannedFetched)return;plannedFetched=key;
  void library.ensure(bots).catch(error=>{plannedFetched='';console.warn('Planned bots',error);});
  void audio.prepare(bots);prefetchRoomFx(bots.map(fighter=>({fighter})));
}
online.onPlannedBots=fetchPlannedBots;
function streamSnapshotAssets(snapshot:GameSnapshot){
  const key=riftAssets.key(snapshot)+transplantKey(snapshot.players);if(streamPending||key===streamKey||performance.now()<streamRetryAt)return;streamPending=true;
  void ensureSnapshotAssets(snapshot).then(()=>{streamKey=key;}).catch(error=>{streamRetryAt=performance.now()+5000;hud.notify('Loading fighters — retrying…');console.warn('Match assets',error);}).finally(()=>{streamPending=false;});
}
const swaps=new SwapLedger(),hudRoot=root.querySelector<HTMLElement>('#interface')!;
const trainingBench:FighterId[]=[];
const swapLog:{side:SwapSide;fighter:FighterId;from:FighterId;cold:boolean;uploaded:boolean;readyMs?:number;shownMs?:number;moved?:number;failed?:string}[]=[];
const swapLanding:{actor:string;fighter:FighterId;askedAt:number;at?:{x:number;z:number};entry:typeof swapLog[number]}[]=[];
const swapActor=(side:SwapSide)=>side==='self'?network.id:'sparring-bot';
const swapNote=(side:SwapSide,fighter?:FighterId)=>{const key=side==='self'?'swapSelf':'swapOpponent';if(fighter)hudRoot.dataset[key]=fighter;else delete hudRoot.dataset[key];};
function resetSwaps(){swaps.reset();swapNote('self');swapNote('opponent');trainingBench.length=0;swapLanding.length=0;}
function benched():FighterId[]{return [...trainingBench,...swaps.waiting()];}
const pooledCasters=()=>{let n=0;for(const pool of warmRoots())pool.traverse(o=>{if((o as THREE.Mesh).isMesh&&o.castShadow)n++;});return n;};
async function prepareSwap(room:GameSnapshot,fighter:FighterId,side:SwapSide){
  const self=room.players.find(p=>p.id===network.id)!,casters=warmEnabled()?pooledCasters():0;
  await ensureSnapshotAssets({...room,players:[...room.players,{...self,id:'training-switch',fighter,forge:undefined,outfit:undefined,isBot:side==='opponent'}]});
  if(!warmEnabled())return;
  if(pooledCasters()>casters)view.warmDraw(warmRoots());
  await warmEffekseer(view.renderer,view.camera).catch(()=>{});
}
async function switchTraining(side:SwapSide,fighter:FighterId,random=false){
  const room=network.snapshot,now=room?.players.find(p=>p.id===swapActor(side));
  if(!started||!room||!practiceRoom(room)||!now)return;
  {const memory=swapMemory(side,fighter,random);if(memory)saveModePrefs('training',memory);}
  if(now.fighter===fighter){swaps.drop(side);swapNote(side);return;}
  const ask=swaps.ask(side,fighter,performance.now()),epoch=startEpoch,current=()=>epoch===startEpoch&&started&&swaps.current(ask);
  const entry:typeof swapLog[number]={side,fighter,from:now.fighter,cold:!library.has(fighter),uploaded:compiledFighters.has(fighter)};swapLog.push(entry);if(swapLog.length>40)swapLog.shift();
  swapNote(side,fighter);
  try{
    await prepareSwap(room,fighter,side);
    if(!current())return;
    entry.readyMs=Math.round(performance.now()-ask.askedAt);
    {const stood=network.snapshot?.players.find(p=>p.id===swapActor(side));swapLanding.push({actor:swapActor(side),fighter,askedAt:ask.askedAt,at:stood&&{x:stood.x,z:stood.z},entry});}
    swaps.sent(ask,performance.now());network.room?.send('training',{lab:SWAP_LAB[side],value:fighter});
  }catch(error){
    console.warn('Training switch',fighter,error);entry.failed=String(error instanceof Error?error.message:error).slice(0,160);
    if(!current())return;
    swaps.drop(side,ask);swapNote(side);hud.notify(`COULD NOT LOAD ${FIGHTERS[fighter].name.toUpperCase()}`,1.6);
  }
}
function watchSwaps(snapshot:GameSnapshot){
  const fighterOf=(side:SwapSide)=>snapshot.players.find(p=>p.id===swapActor(side))?.fighter;
  const before={self:swaps.shown('self'),opponent:swaps.shown('opponent')};
  const seen=swaps.observe({self:fighterOf('self'),opponent:fighterOf('opponent')},performance.now());
  for(const ask of seen.settled){swapNote(ask.side);const landing=swapLanding.find(each=>each.askedAt===ask.askedAt),stands=snapshot.players.find(p=>p.id===swapActor(ask.side));if(landing?.at&&stands)landing.entry.moved=+Math.hypot(stands.x-landing.at.x,stands.z-landing.at.z).toFixed(3);}
  for(const ask of seen.lapsed){swapNote(ask.side);const at=swapLanding.findIndex(landing=>landing.askedAt===ask.askedAt);if(at>=0){swapLanding[at].entry.failed='the room did not switch';swapLanding.splice(at,1);}hud.notify('THIS ROOM CANNOT SWITCH FIGHTERS',1.8);}
  for(const side of seen.changed){
    const fighter=fighterOf(side)!,was=before[side];
    if(was){const at=trainingBench.indexOf(was);if(at>=0)trainingBench.splice(at,1);trainingBench.unshift(was);trainingBench.length=Math.min(trainingBench.length,view.governor.relaxed?TRAINING_BENCH_STRONG:TRAINING_BENCH);}
    if(side==='self'){hud.refighter(fighter);hud.select(fighter);if(lastMatchStart)lastMatchStart[0]=fighter;}
  }
}
startup.readyMs=Math.round(performance.now()-startup.started);hud.ready();
{const prefetch=()=>{const idle=(globalThis as {requestIdleCallback?:(go:()=>void,options?:{timeout:number})=>number}).requestIdleCallback;const go=()=>void import('./game/rapierCollision').catch(()=>{});if(idle)idle(go,{timeout:2000});else setTimeout(go,200);};
  if(document.readyState==='complete')prefetch();else{let done=false;const once=()=>{if(!done){done=true;prefetch();}};window.addEventListener('load',once,{once:true});setTimeout(once,3000);}}
if(import.meta.env.MODE==='fighter-lab'){
  const candidate=laboratoryFighter();
  if(candidate){
    root.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${candidate}"]`)?.click();
    void showFighterLaboratory(candidate);
  }
}
if(activePack()?.modes&&!activePack()!.modes!.includes('royale'))root.querySelector<HTMLButtonElement>('.home-mode[data-mode="training"]')?.click();
restoreSelection(root);watchMatch(()=>started);
let backgroundRunning=false;
let rosterPolicy={allowed:false,reason:'not decided yet'};
async function backgroundRoster(){if(backgroundRunning)return;backgroundRunning=true;try{rosterPolicy=backgroundRosterPolicy(readSignals(view.governor.relaxed));await startup.stage('Background fighters',()=>rosterPolicy.allowed&&!activePack()?library.load(()=>{},hud.selected):library.ensure(activePackRoster()??[hud.selected]));}catch(error){console.warn('Background roster will retry on demand',error);}finally{backgroundRunning=false;}}
hud.onRetryLoading=()=>{if(startup.stages.some(s=>s.name==='Harbor'&&s.state==='failed'))location.reload();else{hud.ready();void backgroundRoster();}};
if(!phone())setTimeout(()=>void backgroundRoster(),1500);
let spectating:string|null=null;
let introFor:number|null=null,victoryFor:string|null=null;
const bodyOf=(id:string)=>fighters.get(id)??riftTargets.body(id)??(survival()||objectiveOf(network.snapshot)?.kind==='last-stand'?(horde.body(id) as unknown as Fighter|undefined)??survivalTargets.body(id):undefined);
const fighterById=(id:string)=>fighters.get(id)??(survival()&&isBoss(id)?(horde.body(id) as unknown as Fighter|undefined)??survivalTargets.body(id):undefined);
function cinematics(snapshot:GameSnapshot){
  camera.director.handle(snapshot.events,network.id,fighterById);
  const startsAt=snapshot.lobby?.startsAt??null;
  if(snapshot.status==='waiting'&&startsAt!==null&&introFor!==startsAt){introFor=startsAt;camera.intro(Math.max(0,startsAt-snapshot.serverTime));}
  if(snapshot.status==='waiting'&&startsAt===null&&introFor!==null){introFor=null;camera.intro(0);}
  const champion=snapshot.status==='finished'?finaleWinner(snapshot):undefined;
  if(champion&&victoryFor!==champion.id){const winner=fighters.get(champion.id);if(winner){victoryFor=champion.id;const mine=finaleMine(snapshot,network.id),team=!!objectiveOf(snapshot)||!!riftOf(snapshot);audio.cheer(1,true);if(!survival()){const line=HOME_VOICES[winner.state.fighter],own=audio.winLine(winner.state.fighter,mine?1.9:.8);if(own===undefined&&line)audio.quote(line,.85,mine?1.9:.8);if(!mine)audio.lossLine(.8+(own??lineSeconds(winner.state.fighter)??0)+.4);}camera.victory(winner,6);
    const self=snapshot.players.find(p=>p.id===network.id);if(mine&&!survival()&&self)audio.announce(self.damageTaken||team?VICTORY_LINE:FLAWLESS_LINE,.95,.55);}}
  if(snapshot.status!=='finished')victoryFor=null;
}
function spectate(self:PlayerState,snapshot:GameSnapshot){
  const dead=!self.alive&&(snapshot.status==='active'||spectating!==null&&finale.holding(seconds()))&&(snapshot.roomMode!=='training'||!!objectiveOf(snapshot));
  const mode=objectiveOf(snapshot)??riftOf(snapshot);
  const wanted=dead?(mode?squadSubject(snapshot.players,self,spectating):(targetId&&fighters.has(targetId)?targetId:null)):null;
  if(wanted!==spectating){spectating=wanted;camera.cut();}
  if(objectiveOf(snapshot))hud.objectives.watching(wanted?snapshot.players.find(p=>p.id===wanted):undefined,snapshot.players.filter(p=>p.alive&&p.team===self.team&&p.id!==self.id).length);
}
function switchSquadSubject(self:PlayerState,snapshot:GameSnapshot,direction:number){
  const next=squadSubject(snapshot.players,self,spectating,direction);
  if(next!==spectating){spectating=next;camera.cut();}
}
installPanelFlags();
const gate=new FrameGate(),viewFrustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4();
function frame(now:number){requestAnimationFrame(frame);Fighter.beginFrame(now);
  const covered=(hud.settingsOpen||bugReport.open)&&!reportCapture&&(localNetwork()?.paused||network===online&&roomFrozen);
  if(covered!==hudCovered){hudCovered=covered;document.body.classList.toggle('fight-covered',covered);}
  const canvasSize=view.renderer.domElement.width*65536+view.renderer.domElement.height;
  if(covered&&canvasSize===drawnSize){previous=now;return;}
  if(!gate.draw(now,previous,settings.powerMode==='cool'?30:60))return;
  const steps=frameSteps((now-previous)/1000);previous=now;const dt=steps.world,rawDt=steps.camera;
  pausePump();
  let presented:ReturnType<CombatTimeline['sample']>;
  if(network===arcade||network===practice||network===localObjective||network===localRift||network===duel||network===royale){
    const local=network===royale?royale:network===duel?duel:network===arcade?arcade:network===practice?practice:network===localRift?localRift:localObjective,newest=timeline.newest??0,scale=network===arcade?arcade.game?.timeScale??1:1;
    localClock=Math.min(newest,Math.max(newest-3/60,localClock+rawDt*(local.paused?0:scale)));
    presented=timeline.at(localClock-LOCAL_DELAY/1000);
  }else presented=timeline.sample(now);
  prediction.visualTime=presented?.time??NaN;
  const snapshot=presentSnapshot(started?presented?.snapshot:undefined);
  {const reading=finaleStateOf(snapshot,id=>fighters.has(id),lineSeconds);if(reading.end&&network.id)finaleSelf=network.id;finale.observe(reading.end,reading.running,seconds());finaleSkip.update(finale.holding(seconds()),finale.elapsed(seconds()));}
  view.setHordeWorkload(survival()||!!riftOf(snapshot)||objectiveOf(snapshot)?.kind==='last-stand');
  hud.presentMatch(network.snapshot,network.id,bugReport.open);
  input.enabled=started&&!finale.holding(seconds())&&(!riftOf(network.snapshot)||riftOf(network.snapshot)?.phase==='active')&&!riftUI.blocking&&!vsSplash.open&&!partyUI.open&&!careerUI.open&&(!objectiveOf(network.snapshot)||objectiveOf(network.snapshot)?.phase==='active')&&!hud.objectives.blocking&&network.predictionReady&&!hud.introOpen&&!hud.resultsOpen&&!bugReport.open&&!hud.settingsOpen&&!swapPicker.open&&!shell.dockChoice&&!document.hidden&&!riftIntro.open&&!(snapshot?.lobby?.visibility==='private'&&snapshot.status==='waiting')&&!(survival()&&(survivalHud.draftOpen||survivalHud.resultsOpen||runView()?.phase==='travel'));input.update(dt);pushInput();environment.update(now/1000);stages.update(now/1000);
  touch.update(input.enabled,started&&network.snapshot?.status!=='waiting'&&!hud.objectives.blocking);
  if(qualityWatch.frame(rawDt,started&&!settings.qualityChosen&&settings.quality!=='low'&&!hud.settingsOpen&&!document.hidden,view.governor.scale<=view.governor.floor+1e-3,settings.powerMode==='cool'?30:60)){stepDown(settings);view.applySettings(settings);}
  objectiveField.update(snapshot,presented?.time??0,network.id,view.camera);
  riftField.setTarget(targeting.locked?targetId:null);riftField.update(snapshot,network.id,view.camera,dt);riftUI.update(snapshot,network.id,targeting.locked?targetId:null);
  if(snapshot){const serverTime=presented!.time;wantStage(snapshot.stage??'harbor');
    const localImpacts=presentEvents(prediction.takeImpacts(),snapshot.players).map(event=>({...event,id:predictedImpactId++,serverTime}));
    applyCombatFrame(snapshot);prediction.markAuthoritativeImpacts(snapshot.events);let self:PlayerState|undefined;
    cinematics(snapshot);cutIns(snapshot);
    const renderAlpha=inputClock.alpha(performance.now());
    viewProjection.multiplyMatrices(view.camera.projectionMatrix,view.camera.matrixWorldInverse);viewFrustum.setFromProjectionMatrix(viewProjection);
    for(const p of snapshot.players){if(p.enemy||!fighters.has(p.id))continue;const fighter=fighters.get(p.id)!,opponent=snapshot.players.find(o=>o.id===(p.id===network.id?targetId:p.target));const shown=p.id===network.id?(prediction.sample(steps.correction,p,renderAlpha)??p):prediction.sampleRemote(steps.correction,p,renderAlpha);fighter.targetDistance=opponent?Math.hypot(opponent.x-shown.x,opponent.z-shown.z):Infinity;fighter.targetPoint=opponent?(fighter.targetPoint??new THREE.Vector3()).set(opponent.x,opponent.y+1.45,opponent.z):undefined;fighter.cameraPoint=view.camera.position;fighter.unseen=p.id!==network.id&&p.id!==targetId&&p.id!==spectating&&!fighter.inView(viewFrustum,view.camera.position);fighter.update(dt,shown,true,rawDt);if(p.id===network.id){self=shown;shownSelf=shown;}}
    if(objectiveOf(snapshot)?.kind==='last-stand'){survivalFx.uploadNextTexture();horde.update(snapshot.players,dt,serverTime,view.camera);horde.handle(snapshot.events);techniques.handle(snapshot.events,serverTime);techniques.feed(objectiveOf(snapshot)?.village?.warnings??[],serverTime);}
    if(survival()){
      const sv=runView(),scale=runScale();
      grunts.threats=survivalTargets.glows;
      horde.update(snapshot.players,dt*scale,serverTime,view.camera);horde.handle(snapshot.events);techniques.handle(snapshot.events,serverTime);
      grunts.focus=shownSelf?.alive?gruntFocus.set(shownSelf.x,shownSelf.y+1.1,shownSelf.z):undefined;
      const frames=hordeFrames();if(frames)grunts.update(frames,serverTime,dt*scale,view.camera);
      gore.density=settings.effects;gore.update(dt*scale,performance.now()/1000);
      for(const event of snapshot.events)if(event.kind==='eliminated'&&event.targetId&&event.targetId!==network.id){const body=horde.body(event.targetId);if(body)survivalFx.death(body.group.position.x,body.group.position.y,body.group.position.z,body.def.height,serverTime,body.def.role==='boss');}
      if(sv){career.survival(sv.result,sv.run??0);survivalFx.handle(sv.feed,serverTime,shownSelf?numberAnchor.set(shownSelf.x,shownSelf.y,shownSelf.z):undefined);techniques.feed(sv.feed,serverTime);bossVoices(sv,snapshot);smashes(sv);
        for(const id of rivalIds()){const rival=fighters.get(id);if(rival)survivalFx.aura(rival.group.position.x,rival.group.position.y,rival.group.position.z,serverTime);}
        for(const member of sv.party)if(member.rage){const body=fighters.get(member.id);if(body)survivalFx.rage(body.group.position.x,body.group.position.y,body.group.position.z,serverTime);}
        wantBosses(sv.upcoming??[]);
        survivalFx.update(sv,serverTime,dt,view.camera);survivalHud.update(sv,network===arcade?arcade.game!.fighter:sv.party[0]?.fighter??hud.selected);
        view.sky.setRift(sv.eclipse,sv.eclipse*.85);
        if(coop())coopFrame(sv);
        survivalFx.allies(sv.party.slice(1).filter(member=>member.down).map(member=>{const body=snapshot.players.find(p=>p.id===member.id);return{x:body?.x??0,y:body?.y??0,z:body?.z??0,rescue:member.rescue};}),serverTime);
        for(const item of sv.feed)if(item.id>lastEntrance&&item.kind==='boss'&&item.actor){
          const body=horde.body(item.actor);
          if(!body&&serverTime-item.at<1)break;
          lastEntrance=item.id;if(body&&settings.cinematics)camera.victory(body as unknown as Fighter,item.boss?2.6:1.6);}
        for(const item of sv.feed)if(item.id>lastRoar&&item.kind==='enraged'){lastRoar=item.id;if(item.actor)horde.body(item.actor)?.taunt(serverTime,1.6);}
      }
    }
    for(const [id,body] of fighters){
      if(!body.steps.length)continue;
      const mine=id===network.id;
      for(const step of body.steps){audio.step(step,step.speed,mine);effects.footstep(step,serverTime);}
      body.steps.length=0;
    }
    for(const event of localImpacts){
      const heading=blowHeading(event);
      const detail=impactDetail(event);
      bigBlowSound(event);
      fighters.get(event.targetId??'')?.impact(true,event.slot,'melee',event.contactIndex,heading,event.damage,undefined,detail);
      fighters.get(event.actorId)?.impact(false,event.slot,undefined,undefined,heading,event.damage,undefined,detail);
      camera.impact(Math.min(1,.2+screenWorth(event)/460),heading,hitTier(event.slot,event.chain));
      camera.holdFor(Math.min(1,(event.damage??0)/240));markerHoldUntil=performance.now()/1000+.5;
      view.punch(Math.min(.55,screenWorth(event)/420)*settings.effects);
    }
    audio.handle(localImpacts,network.id,presentPlayers(snapshot.players));
    effects.localId=network.id||undefined;SIGNATURE.localId=effects.localId;
    const shown=presentFighters(fighters);
    effects.handle(predictedVisuals.splice(0),shown);effects.handle(localImpacts,shown);
    const areaEvents=survival()?snapshot.events.filter(event=>!isProc(event.move)):snapshot.events;
    const fx=areaFx.handle(areaEvents,network.id||undefined,snapshot.players,event=>effects.handleAuthoredAreas([event],shown));
    effects.handle(fx.filter(event=>!prediction.impactWasPresented(event)),shown);ninjaEffects.handle(fx,shown);killuaEffects.handle(fx);gojoEffects.handle(fx);lawEffects.handle(fx,shown);emperorEffects.handle(fx,shown);swordStandEffects.handle(fx);awakeningEffects.handle(fx,fighters);clashEffects.handle(fx);
    if(survival())survivalFx.contacts(snapshot.events,serverTime);
    if(self&&started){const own=fighters.get(self.id)!;const move=['light','heavy','special','ultimate'].includes(self.action)?MOVES[self.fighter][self.action as AttackSlot]:undefined;const elapsed=own.state.actionTime*self.actionDuration;
      {const canvas=view.renderer.domElement.dataset,phase=move?(elapsed<move.contacts[0]?'charge':'release'):'none',pose=move&&elapsed>move.contacts[0]*.74&&elapsed<move.contacts[0]*.89?'held':'transition';if(canvas.action!==self.action)canvas.action=self.action;if(canvas.phase!==phase)canvas.phase=phase;if(canvas.pose!==pose)canvas.pose=pose;}
      if(new URLSearchParams(location.search).has('capture'))view.renderer.domElement.dataset.motion=JSON.stringify(own.motionEvidence());spectate(self,snapshot);const subject=spectating?fighters.get(spectating):undefined;
      input.arrowsLook=false;
      if(input.enabled&&viewKeys.lockHold(rawDt,input.keys)&&targeting.locked){targeting.release();autoLock.decline(network.snapshot,startEpoch);hud.notify('LOCK RELEASED',.7);}
      const focusing=(settings.cameraMode==='dynamic'||settings.cameraMode==='arena'||settings.cameraMode==='smart')&&self.alive&&!subject;
      if(focusing){const picked=camera.picker.update(rawDt,riftOf(snapshot)?riftTargets.players:survival()?survivalTargets.players:snapshot.players,self,camera.movementYaw,snapshot.events,targeting.locked?targetId:null,targetId);if(!targeting.locked)targetId=picked;camera.focusHint.pending=camera.picker.pending??'';camera.focusHint.share=camera.picker.pendingShare;}
      else{camera.focusHint.pending='';camera.focusHint.share=0;}
      camera.stageBounds=STAGES[snapshot.stage??'harbor'];
      audio.setSpace(survival()||objectiveOf(snapshot)||settings.quality==='low'?undefined:snapshot.stage);
      audio.setAmbience(survival()||objectiveOf(snapshot)?undefined:snapshot.stage);
      if(input.enabled)viewKeys.steer(rawDt,input,self,targetId?bodyOf(targetId)?.group.position:undefined,camera.movementYaw,movementMask(input.keys),camera.blocked);
      let rivals=0,rival='';for(const p of snapshot.players)if(p.id!==self.id&&p.alive&&!p.enemy&&(self.team===undefined||p.team!==self.team)){rivals++;rival=p.id;}
      camera.sole=rivals===1;const held=targetId||(camera.sole&&(settings.cameraMode==='arena'||settings.cameraMode==='smart')&&!camera.battlefield?rival:'');
      camera.mode=settings.cameraMode;camera.style=settings.cameraStyle;camera.cinematics=settings.cinematics;camera.finisherCuts=roanEnabled();camera.cuts.arena=carded();camera.battlefield=survival()||!!objectiveOf(snapshot)||!!riftOf(snapshot);
      if(survival()){survivalTargets.present(gruntPosition,targetId,camera.picker.pending);for(const [id,body] of horde.cameraBodies)survivalTargets.crowd.set(id,body);}
      camera.extraSubjects=riftOf(snapshot)?riftTargets.crowd:survival()?survivalTargets.crowd:objectiveOf(snapshot)?.kind==='last-stand'?horde.cameraBodies:undefined;
      camera.movementBasis(movementMask(input.keys,!input.arrowsLook));
      if(subject){const foeId=subject.state.target;const foe=foeId&&foeId!==network.id?fighters.get(foeId):undefined;camera.update(rawDt,subject,input.yaw,input.pitch,occluders(),settings.shake,foe?.state.alive?foe:undefined,!!foe);}
      else camera.update(rawDt,own,input.yaw,input.pitch,occluders(),settings.shake,held?bodyOf(held):undefined,targeting.locked);
      input.yaw=camera.inputYaw;
      input.pitch=camera.inputPitch;
      touch.meters(self,snapshot.serverTime);
      const target=(riftOf(snapshot)?riftTargets.players:survival()?survivalTargets.players:snapshot.players).find(p=>p.id===targetId);if(now-lastHud>70){hud.update(snapshot,self,target,network!==online||now-network.receivedAt<1500);hud.link(network===online?online.link.note(now):undefined);const phase=snapshot.status==='finished'?'results':'combat';
        const sv=survival()?runView():undefined;
        const rival=sv?undefined:target&&!target.enemy?target.fighter:undefined;
        const lead=sv?RIFT_SCORE:self.fighter,second=sv?undefined:rival,tune=sv?.phase==='over'?'results':phase;
        const context=`${lead}:${second}:${tune}`;if(context!==musicContext){musicContext=context;music.setContext(lead,second,tune);}
        if(new URLSearchParams(location.search).has('stats')){const perf=view.perf();hud.perf(`${perf.fps.toFixed(1)} FPS · P95 ${perf.p95.toFixed(1)}ms · ${fighters.size} FIGHTERS · ${perf.drawCalls} DRAWS · ${(perf.triangles/1000).toFixed(0)}K TRI · ${perf.samples} SAMPLES · ${settings.quality.toUpperCase()}${network===online&&Number.isFinite(online.link.rtt)?` · PING ${Math.round(online.link.rtt)}MS`:''}`,true);}else hud.perf('',false);lastHud=now;}
      const markerWant=self.action==='ultimate'||target?.action==='ultimate'?0:performance.now()/1000<markerHoldUntil?MARKER_HIT_DIM:1;markerFade+=(markerWant-markerFade)*Math.min(1,rawDt*(markerWant<markerFade?20:5));
      if(target){const drawn=fighters.get(target.id);if(drawn)drawn.visualCenter(marker);else if(!horde.centre(target.id,marker)&&!grunts.centre(target.id,marker))marker.set(target.x,target.y+1.1*(target.size??1),target.z);marker.y+=.65*(target.size??1);marker.project(view.camera);
        const tint=target.enemy?`#${(ENEMIES[target.enemy]?.color??0xd51d34).toString(16).padStart(6,'0')}`:undefined;
        if(!drawn&&!horde.centre(target.id,marker)&&!grunts.centre(target.id,marker))marker.set(target.x,target.y+1.1*(target.size??1),target.z);hud.targetMarker(0,0,targeting.locked||Math.hypot(target.x-self.x,target.z-self.z)>3.3,targeting.locked,{id:target.id,name:target.name,bot:target.isBot&&!target.enemy,fighter:target.fighter,hp:target.hp/target.maxHp,distance:Math.hypot(target.x-self.x,target.y-self.y,target.z-self.z),color:tint,threatBody:drawn??riftTargets.body(target.id)??horde.body(target.id)??survivalTargets.body(target.id),body:drawn,centre:drawn?undefined:marker,size:target.size??1,camera:view.camera},markerFade);}else hud.targetMarker(0,0,false);
    }
    const steady=steadyBodies(shown);
    if(self){const move=areaMoveOf(self),lock=targetId?snapshot.players.find(p=>p.id===targetId&&p.alive):undefined;input.aim.follow(self,input.yaw,lock,move.range,move.radius,areaReady(self,snapshot.serverTime));}else input.aim.cancel();
    areaFx.update(serverTime,input.aim.view,self,floorAt);
    effects.update(serverTime,dt,steady);awakeningEffects.update(serverTime,dt,fighters,settings.effects,view.camera);luffyEffects.update(serverTime,steady,settings.effects);ninjaEffects.update(serverTime,dt,steady,settings.effects);killuaEffects.update(serverTime,steady,settings.effects);gutsEffects.update(serverTime,steady,settings.effects);gojoEffects.update(serverTime,dt,steady,settings.effects);spiritBombEffects.update(serverTime,steady,settings.effects);lawEffects.update(serverTime,steady,settings.effects);emperorEffects.update(serverTime,steady,settings.effects,view.camera);swordStandEffects.update(serverTime,dt,steady,settings.effects,view.camera);strikeTrails.update(dt,steady,view.camera);clashEffects.update(serverTime,view.camera,settings.effects);
    if(survival()||objectiveOf(snapshot)?.kind==='last-stand')techniques.update(serverTime);
  }
  if(shownSelf)view.setFocus(shownSelf);
  hud.tick();damageNumbers.update(view.camera);manga.update(view.camera);letterbox.set(camera.cuts.bars);view.cinemaGrade(camera.cuts.grade);if(camera.cuts.opened!==heardCinema){heardCinema=camera.cuts.opened;if(camera.cuts.openedKind==='confirm'&&camera.cuts.active)audio.ui('fx-swing-huge',.22,.1);}
  if(((started||!hud.homeVisible)&&!survivalHud.treeShown)||reportCapture){grunts.prepareCamera(view.camera);view.render(rawDt);drawnSize=view.renderer.domElement.width*65536+view.renderer.domElement.height;}
  for(let i=swapLanding.length-1;i>=0;i--){const landing=swapLanding[i];if(fighters.get(landing.actor)?.bodyFighter===landing.fighter){landing.entry.shownMs=Math.round(performance.now()-landing.askedAt);swapLanding.splice(i,1);}}
  if(reportCapture){const capture=reportCapture;reportCapture=undefined;try{capture(view.renderer.domElement.toDataURL('image/jpeg',.8));}catch{ }}
  if(pendingCompile&&!compiling){pendingCompile=false;compiling=true;
    void view.compileScene().catch(()=>{}).finally(()=>{compiling=false;});}
}
requestAnimationFrame(frame);
reloadWhenRestored(window);
reloadIfNotRestored(view.renderer.domElement,window);
window.addEventListener('pagehide',()=>{clearInterval(inputTimer);void party.leave();career.leave();void network.leave();library.disposeWarmup();effects.dispose();luffyEffects.dispose();ninjaEffects.dispose();killuaEffects.dispose();gutsEffects.dispose();gojoEffects.dispose();spiritBombEffects.dispose();lawEffects.dispose();emperorEffects.dispose();swordStandEffects.dispose();awakeningEffects.dispose();clashEffects.dispose();manga.dispose();environment.dispose();stages.dispose();audio.dispose();musicPanel.dispose();});
const eventCounts:Record<string,number>={};
const REJECTIONS:Record<string,string>={cooldown:'NOT READY',stamina:'NO STAMINA','ultimate-meter':'ULTIMATE NOT CHARGED'};
Object.defineProperty(window,'arenaEvidence',{get:()=>({trainingSwap:{pending:{self:swaps.pending('self'),opponent:swaps.pending('opponent')},log:swapLog,bench:[...trainingBench],picker:swapPicker.open},areaAim:input.aim.view,areaEvents:areaFx.drawn,areaLooks:areaFx.laidLooks,pause:{state:pauseLink.state,holding:pauseLink.holding,pausable:hud.modes.pausable(),paused:hud.modes.paused(),fightShown},rosterPolicy,fightersLoaded:library.loadedCount,textureSharing,survival:survival()?runView():undefined,coop:coop(),horde:horde.count,enemyResources:horde.resources,localOperation:network===localObjective,grunts:network===arcade?arcade.game?.horde.alive??0:online.hordeFrames.frames.reduce((n:number,f:{n:number})=>Math.max(n,f.n),0),enemies:()=>horde.evidence(),performance:view.perf(),eventCounts,state:network.snapshot,playerId:network.id,local:shownSelf,predicted:prediction.action,prediction:prediction.diagnostics,replays:{replayed:prediction.replayed,folded:prediction.folded},link:network===online?online.link.view(performance.now()):undefined,predicting:prediction.enabled&&prediction.active,locked:targeting.locked,targetId,targetCandidates:survival()?survivalTargets.players.filter(p=>p.alive&&p.id!==network.id&&(shownSelf?.team===undefined||p.team!==shownSelf.team)).map(p=>p.id):undefined,targetProxyCapacity:riftOf(network.snapshot)?riftTargets.capacity:survivalTargets.capacity,riftBodies:{shown:fighters.size,hidden:hiddenRiftBodies.size},cameraMode:camera.mode,cameraStyle:camera.style,styleBlend:camera.styleBlend,lockStyle:settings.lockStyle,lockGlow:{...hud.threatGlow.state},cameraFocusHistory:camera.picker.historyEntries,cameraEventHistory:camera.director.historyEntries,scene:view.scene,renderer:view.renderer,camera:view.camera,assets:[...fighters.values()].map(f=>({id:f.state.id,fighter:f.state.fighter,clips:f.clips.map(c=>c.name)})),motion:[...fighters.values()].map(f=>({id:f.state.id,...f.motionEvidence()}))})});
