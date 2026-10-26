import { mediaArt } from './mediaArt';
import {pulseClass} from './pulse';
import {riftOf} from '../game/moba/model';
import { activePackRoster } from '../engine/packs/active';
import { slotNames } from '../engine/client/transplant';
import { commandList } from './commandList';
import {customOf} from '../game/social/custom';
import {customControls,customValue} from './social/CustomControls';
import {privatePanel} from './hud/privatePanel';
import {InkSelect} from './inkSelect';
import {ObjectiveUI} from './objectives/ObjectiveUI';
import {objectiveOf,isObjectiveKind,OBJECTIVE_NAMES} from '../game/objectives/model';
import {MatchIntro} from './MatchIntro';
import {matchResults} from './MatchResults';
import { pauseMenu } from './PauseMenu';
import { BindingEditor } from './BindingEditor';
import { ACTIONS, boundTo, BINDINGS_EVENT, getBindings, isCapturingBinding, keyName, keyNames, MOVE_ACTIONS, resetBindings, type CombatAction } from '../input/bindings';
import { illustratedControls, type ControlDevice } from './HomeControls';
import { inviteUrl, readInvite } from './roomInvite';
import { inPlayerTwo, inviteLink } from '../boot/playerTwo';
import { FIGHTERS, HUD_SKINS, MOVE_LAYOUTS, chooseQuality, type Settings } from '../config';
import { machineQuality } from '../render/qualityTier';
import { mangaHome, mangaPortrait, HOME_MODES, HOME_ROSTER, type HomeMode } from './MangaHome';
import { isLaboratoryPreviewFighter } from '../fighterLab';
import { HomePreview } from './HomePreview';
import { bindHomeVolumes, revealHomeFighter, stepHomeVolume } from './HomeVolumes';
import { homeFighterGuide } from './HomeFighterGuide';
import { homeOptions, optionValue } from './HomePanels';
import type { NetworkAccess } from '../network';
import type { AttackSlot, FighterId, GameSnapshot, PlayerState, RoomMode } from '../game/types';

import { AWAKENINGS, AWAKENING_COST, AWAKENING_SECONDS, moveFor } from '../game/awakening';
import { ULTIMATE_COST } from '../game/moves';
import { LockOnView, quietNotice, type LockTarget } from './LockOnView';
import { THREAT_NAMES, ThreatOutline, type ThreatBody } from '../render/ThreatOutline';
import { nearest, type Direction } from './spatialFocus';
import { keyboardCombatHints, actionControl, actionName, padCombatHints, padName, type PadControl } from '../input/glyphs';
import { touchLabel } from './prompts';
import type { PadFamily, UiAction } from '../input/gamepad';
import { MoveSheet, areaArtUrl, moveSheetOf, moveSheetsFor, moveSheetUrl } from './moveSheet';
import { MoveCardArt } from './moveCardArt';
import { ModeHudHost } from './hud/host';
import { CooldownShare, InkedHud, INK_DEFS, cardsHtml, comboHtml, foePlateHtml, inkedFit, ownPlateHtml } from './hud/inked';
import { PROTO_IDS, ProtoHud, protoClocksHtml } from './hud/protos';
import { MoveTape } from './hud/moveTape';
import { areaMoveCard } from './hud/cardNames';

export type TrainingCommand = 'passive' | 'combat' | 'reset' | 'awakening' | import('../game/training/TrainingLab').LabCommand;
export interface TargetMarkerInfo extends LockTarget { fighter:FighterId; hp:number; threatBody?:ThreatBody;
  bot?:boolean }

const KURAMA_SHORT_MOVES=['CLAW BARRAGE','CRUSHING FANG','BEAST BLAST','BEAST BOMB'] as const;
const MOVE_SLOTS=['light','heavy','special','ultimate','area'] as const;
export class Hud {
  private lastOwnHp:number|null=null;
  private lastFoeHp:number|null=null;
  private lastFoeId:string|null=null;
  private ownHitTimer=0;
  private foeHitTimer=0;
  selected:FighterId=activePackRoster()?.[0]??'naruto';
  private homeMode:HomeMode='bots';
  private duelAccess:'online'|'bot'|'friend'='online';
  private arcadeParty:'solo'|'coop'='solo';
  private homeBusy=true;
  private homePreview:HomePreview;
  private homePreviewFighter?:FighterId;
  private homeReturnFocus:HTMLElement|null=null;
  private controlDevice:ControlDevice='keyboard';
  private controlFamily:PadFamily='xbox';
  private controlsPage:'layout'|'guide'='layout';
  onRetryLoading=()=>{};
  onFightBot=()=>{};
  onReportBug=()=>{};
  onParty=()=>{};onCareer=()=>{};onCustom=(_type:string,_value:unknown)=>{};
  private customKey='';
  private privateKind:'private'|'coop'|'duel'='private';
  private guideFighter:FighterId='naruto';
  private bindingEditor!:BindingEditor;
  botPlayers:number=8;
  private roomSize=8;
  onStart=(_fighter:FighterId,_mode:RoomMode,_name:string,_access?:NetworkAccess)=>{};
  onPrivateStart=()=>{};
  onMusicToggle=(_enabled:boolean)=>{};
  onFighterSelect=(_fighter:FighterId)=>{};
  onFighterPreview=(_fighter:FighterId,_immediate:boolean)=>{};
  onPreviewStop=()=>{};
  private inputMode:'keyboard'|'controller'='keyboard';
  private objectiveCameraHint='';
  private padFamily:PadFamily='generic';
  private editingCode=false;
  private codeDigit=0;
  private privateWaiting=false;
  private rosterKey="";
  onSettings=(_settings:Settings)=>{};
  onResume=()=>{};
  onLeave=()=>{};
  onPlayAgain=()=>{};
  onLaboratoryReview=(_fighter:FighterId)=>{};
  onPractice=()=>{};
  onResults=()=>{};
  finale=()=>false;
  resultAgainLabel='PLAY AGAIN';
  roomGone=false;
  readonly objectives:ObjectiveUI;
  private matchIntro:MatchIntro;
  get introOpen(){return this.matchIntro.open;}
  skipIntro(){return this.matchIntro.skip();}
  get introSplash(){return this.matchIntro.splash;}
  presentMatch(snapshot:GameSnapshot|null,id:string,blocked=false){this.matchIntro.update(snapshot,id,!objectiveOf(snapshot)&&!riftOf(snapshot)&&!this.survivalMode&&!this.settingsOpen&&!blocked);}
  onTraining=(_command:TrainingCommand)=>{};
  private trainingRoom=false;
  private survivalMode=false;
  readonly modes:ModeHudHost;
  setSurvival(on:boolean){this.survivalMode=on;this.root.querySelector('.combat-hud')!.classList.toggle('survival',on);}
  private root:HTMLElement;
  private menu:HTMLElement;
  private settingsPanel:HTMLElement;
  private noticeTimer=0;
  private fallen:string[]=[];
  private resultsKey='';
  private botModeButtons:HTMLButtonElement[]=[];private moveSlots:HTMLElement[]=[];
  private markerKey='';private lockOn?:LockOnView;
  readonly threatGlow=new ThreatOutline();private glowAt=0;private readonly reducedMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):undefined;
  private moveSheet?:MoveSheet;
  private inked!:InkedHud;
  private protos!:ProtoHud;
  private moveTape=new MoveTape();
  private hudLean?:boolean;
  private readonly cooldowns=[0,1,2,3,4].map(()=>new CooldownShare());
  constructor(parent:HTMLElement,readonly settings:Settings) {
    this.root=document.createElement('div');this.root.id='interface';parent.append(this.root);
    this.root.innerHTML=`
    <section class="combat-hud hidden" aria-label="Combat status">
      ${INK_DEFS}${ownPlateHtml()}${protoClocksHtml()}
      <div class="match-status"><button type="button" id="duel-cancel" hidden>CANCEL SEARCH</button><strong id="match-mode">TRAINING</strong><span id="match-detail">Sparring arena</span></div>
      <div class="connection-note hidden" id="connection-note" role="status" aria-live="polite">RECONNECTING · Your controls resume when the connection returns.</div><div class="connection-note weak hidden" id="link-note" role="status"></div><div class="private-status hidden" id="private-status"><span>PRIVATE ROOM</span><strong id="private-code"></strong><button id="copy-room-code" type="button">COPY CODE</button><button id="copy-room-link" type="button">COPY INVITE</button><button id="share-room-link" type="button">SHARE</button><button id="room-leave" type="button">LEAVE ROOM</button><button id="private-start" type="button">START FIGHT</button><small id="private-hint"></small><div class="room-roster" id="room-roster" aria-label="Room participants"></div><div id="private-custom"></div></div>${foePlateHtml()}
      <div class="target-marker hidden" id="target-marker" aria-hidden="true"></div>
      <div class="spectate-chip hidden" id="spectate-chip"><b>ELIMINATED</b><span>spectating</span></div>
      <div class="action-message" id="action-message" role="status"></div>
      ${comboHtml()}
      ${cardsHtml(['LIGHT','HEAVY','SPECIAL','ULTIMATE','AREA'],['J','K','Q','R','G','E'])}
      <div class="controls-hint" id="controls-hint">${keyboardCombatHints()}</div>
      <div class="pointer-hint hidden" id="pointer-hint">CLICK TO FOCUS CAMERA</div>
      <div class="perf hidden" id="perf"></div>
    </section>
    <section class="results-scrim hidden" id="results" role="dialog" aria-modal="true" aria-labelledby="results-title"></section>
    ${mangaHome(this.selected,this.botPlayers)}
    ${pauseMenu(settings)}`;
    this.menu=this.root.querySelector('.lobby')!;this.settingsPanel=this.root.querySelector('.settings-scrim')!;
    this.inked=new InkedHud(this.root);this.protos=new ProtoHud(this.root,PROTO_IDS);this.applySkin();this.applyMoveLayout();
    for(const button of this.settingsPanel.querySelectorAll<HTMLButtonElement>('[data-pause-page]'))button.onclick=()=>this.showPausePage(button.dataset.pausePage as 'settings'|'moves');
    this.matchIntro=new MatchIntro(this.root);
    this.modes=new ModeHudHost(this.root,()=>this.survivalMode);
    this.modes.listeners.push({frame(){},event:event=>this.inked.event(event)});
    this.objectives=new ObjectiveUI(this.root);this.objectives.onStart=access=>this.onStart(access.kind==='objective'&&access.fighter?access.fighter:this.selected,'match',this.playerName(),access);this.objectives.onLeave=()=>this.onLeave();this.objectives.onResults=()=>this.onResults();this.objectives.onPause=()=>this.toggleSettings(true);this.objectives.onShop=()=>this.toggleSettings(false);
    bindHomeVolumes(this.menu);
    this.homePreview=new HomePreview(this.root.querySelector('.home-preview')!);
    this.homePreview.setEnabled(settings.homeAnimations!==false);
    this.root.querySelectorAll<HTMLImageElement>('img').forEach(img=>img.addEventListener('error',()=>{img.style.visibility='hidden';}));
    this.root.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(button=>{
      button.addEventListener('pointerenter',()=>{this.previewFighter(button.dataset.fighter as FighterId);this.onFighterPreview(button.dataset.fighter as FighterId,false);});
      button.addEventListener('focus',()=>{this.previewFighter(button.dataset.fighter as FighterId);this.onFighterPreview(button.dataset.fighter as FighterId,false);});
      const restoreSelectedPreview=()=>{
        if(this.homePreviewFighter!==button.dataset.fighter)return;
        if(button.dataset.fighter!==this.selected)this.onPreviewStop();
        this.previewFighter(this.selected);
      };
      button.addEventListener('pointerleave',restoreSelectedPreview);
      button.addEventListener('blur',restoreSelectedPreview);
      button.onclick=()=>{
      revealHomeFighter(this.menu,button.dataset.fighter as FighterId);
      this.selected=button.dataset.fighter as FighterId;
      this.root.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-pressed',String(el===button));});
      this.previewFighter(this.selected);
      this.updatePlayLabel();
      this.onFighterSelect(this.selected);this.onFighterPreview(this.selected,true);
      };
    });
    this.bindingEditor=new BindingEditor(this.root,()=>this.renderHomeControls());
    window.addEventListener(BINDINGS_EVENT,()=>{if(!isCapturingBinding())this.refreshBindingHints();});
    window.addEventListener('pointerdown',()=>this.focusBy('pointer'),{capture:true,passive:true});
    window.addEventListener('keydown',()=>this.focusBy('keys'),{capture:true});
    this.homeDialog.addEventListener('close',()=>this.bindingEditor.cancel());
    this.homeDialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&this.homeDialog.dataset.kind==='controls'&&!isCapturingBinding()){event.preventDefault();event.stopPropagation();this.controllerAction('back');}});
    this.homeDialog.addEventListener('cancel',event=>{if(this.homeDialog.dataset.kind==='controls'){event.preventDefault();this.returnToOptions();}});
    this.bindHome();
    this.root.querySelector<HTMLButtonElement>('#home-party')!.onclick=()=>this.onParty();
    const custom=this.root.querySelector<HTMLElement>('#private-custom')!;
    custom.addEventListener('change',e=>{const select=e.target as HTMLSelectElement;if(select.dataset.custom)this.onCustom('custom-rules',customValue(select));});
    custom.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLElement>('[data-vote]');if(b)this.onCustom('arena-vote',b.dataset.vote);});
    this.refreshBindingHints();
    this.root.querySelector<HTMLButtonElement>('#settings-close')!.onclick=()=>this.toggleSettings(false);
    this.root.querySelector<HTMLButtonElement>('#resume')!.onclick=()=>this.toggleSettings(false);
    this.root.querySelector<HTMLButtonElement>('#leave-arena')!.onclick=()=>this.onLeave();
    const results=this.root.querySelector<HTMLElement>('#results')!;
    results.addEventListener('click',event=>{const id=(event.target as HTMLElement).closest('button')?.id;if(id==='results-leave')this.onLeave();else if(id==='results-again')this.onPlayAgain();else if(id==='results-practice')this.onPractice();});
    results.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const items=this.focusables(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
    this.root.addEventListener('training-lab', event => { if(this.trainingRoom)this.onTraining((event as CustomEvent<TrainingCommand>).detail); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-training]').forEach(button=>button.onclick=()=>{
      if(this.trainingRoom)this.onTraining(button.dataset.training as TrainingCommand);
    });
    this.botModeButtons=[...this.root.querySelectorAll<HTMLButtonElement>('[data-training="passive"],[data-training="combat"]')];
    this.moveSlots=[...this.root.querySelectorAll<HTMLElement>('.move-slot[data-move]')];
    this.root.querySelector<HTMLButtonElement>('[data-lab-open]')!.onclick=()=>{const lab=this.root.querySelector<HTMLDetailsElement>('.training-lab');if(!this.trainingRoom||!lab)return;this.toggleSettings(false);lab.open=true;};
    this.root.querySelectorAll<HTMLButtonElement>('[data-swap-open]').forEach(button=>button.onclick=()=>{if(!this.trainingRoom)return;this.toggleSettings(false);this.root.dispatchEvent(new CustomEvent('training-swap-open',{detail:button.dataset.swapOpen}));});
    this.root.querySelectorAll<HTMLButtonElement>('[data-bots]').forEach(button=>button.onclick=()=>{
      this.botPlayers=Number(button.dataset.bots);
      this.root.querySelectorAll<HTMLButtonElement>('[data-bots]').forEach(other=>{
        const on=other===button;other.classList.toggle('selected',on);other.setAttribute('aria-pressed',String(on));
      });
      this.selectHomeMode('bots');
    });
    this.root.querySelector<HTMLButtonElement>('#create-private')!.onclick=()=>{if(!this.homeBusy)this.onStart(this.selected,'match',this.playerName(),this.homeDialog.dataset.kind==='duel'?{kind:'duel',access:'host'}:this.homeDialog.dataset.kind==='coop'?{kind:'coop-create'}:{kind:'create-private',players:this.roomSize});};
    this.root.querySelector<HTMLButtonElement>('#quick-coop')!.onclick=()=>{if(!this.homeBusy)this.onStart(this.selected,'match',this.playerName(),{kind:'coop-join',code:'',quick:true});};
    this.root.querySelectorAll<HTMLButtonElement>('[data-room-size]').forEach(button=>button.onclick=()=>{
      this.roomSize=Number(button.dataset.roomSize);
      this.root.querySelectorAll<HTMLButtonElement>('[data-room-size]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    });
    this.root.querySelector<HTMLFormElement>('#home-join-form')!.onsubmit=event=>{
      event.preventDefault();if(this.homeBusy)return;
      const code=this.root.querySelector<HTMLInputElement>('#room-code')!.value.replace(/\D/g,'');
      if(!/^\d{6}$/.test(code)){this.text('home-dialog-status','Enter a six-digit room code.');return;}
      this.onStart(this.selected,'match',this.playerName(),this.homeDialog.dataset.kind==='duel'?{kind:'duel',access:'join',code}:this.homeDialog.dataset.kind==='coop'?{kind:'coop-join',code}:{kind:'join-private',code});
    };
    this.root.querySelector<HTMLInputElement>('#room-code')!.addEventListener('paste',event=>{
      const invite=readInvite(event.clipboardData?.getData('text')??'');if(!invite)return;event.preventDefault();
      this.openHomeDialog(invite.kind);this.root.querySelector<HTMLInputElement>('#room-code')!.value=invite.code;
      this.text('home-dialog-status',`Invite ready · ${invite.kind==='duel'?'Duel':invite.kind==='coop'?'Co-op Survival':'Private match'}. Press Join room when ready.`);
      this.root.querySelector<HTMLElement>('#join-private')!.focus();
    });
    this.root.querySelector<HTMLInputElement>('#room-code')!.addEventListener('input',event=>{const input=event.target as HTMLInputElement;input.value=input.value.replace(/\D/g,'').slice(0,6);});
    this.root.querySelector<HTMLButtonElement>('#private-start')!.onclick=()=>this.onPrivateStart();
    this.root.querySelector<HTMLButtonElement>('#duel-cancel')!.onclick=()=>this.onLeave();
    this.root.querySelector<HTMLButtonElement>('#room-leave')!.onclick=()=>this.onLeave();
    this.root.querySelector<HTMLButtonElement>('#copy-room-link')!.onclick=()=>void this.shareInvite(false);
    this.root.querySelector<HTMLButtonElement>('#share-room-link')!.onclick=()=>void this.shareInvite(true);
    this.root.querySelector<HTMLButtonElement>('#load-retry')!.onclick=()=>this.onRetryLoading();
    this.root.addEventListener('click',event=>{if((event.target as HTMLElement).closest('[data-report-bug]'))this.onReportBug();});
    const invitation=readInvite(location.href);
    if(invitation){
      this.selectHomeMode(invitation.kind==='duel'?'duel':invitation.kind==='coop'?'arcade':'private');
      if(invitation.kind==='coop'){this.arcadeParty='coop';this.root.querySelector('#choose-coop')!.setAttribute('aria-pressed','true');this.root.querySelector('#choose-solo')!.setAttribute('aria-pressed','false');}
      this.openHomeDialog(invitation.kind);this.root.querySelector<HTMLInputElement>('#room-code')!.value=invitation.code;
      const preview=this.root.querySelector<HTMLElement>('#invite-preview')!;preview.textContent=`YOU'RE INVITED · ${invitation.kind==='duel'?'DUEL':invitation.kind==='coop'?'CO-OP SURVIVAL':'PRIVATE MATCH'} · ${invitation.code}. Choose your fighter, then join when ready.`;preview.hidden=false;
    }
    this.root.querySelector<HTMLButtonElement>('#copy-room-code')!.onclick=()=>{const code=this.root.querySelector('#private-code')!.textContent??'';void navigator.clipboard.writeText(code.replace(/\s/g,'')).then(()=>this.notify('ROOM CODE COPIED')).catch(()=>this.notify('SHARE '+code));};
    this.root.querySelector<HTMLSelectElement>('[data-setting="quality"]')!.value=settings.quality;
    this.root.querySelector<HTMLSelectElement>('[data-setting="powerMode"]')!.value=settings.powerMode??'auto';
    this.root.querySelector<HTMLSelectElement>('[data-setting="cameraMode"]')!.value=settings.cameraMode;
    this.root.querySelector<HTMLSelectElement>('[data-setting="cameraStyle"]')!.value=settings.cameraStyle;
    this.root.querySelector<HTMLSelectElement>('[data-setting="lockStyle"]')!.value=settings.lockStyle;
    this.root.querySelector<HTMLSelectElement>('[data-setting="animStyle"]')!.value=settings.animStyle;
    this.root.querySelector<HTMLSelectElement>('[data-setting="hudSkin"]')!.value=settings.hudSkin;
    this.root.querySelector<HTMLSelectElement>('[data-setting="moveLayout"]')!.value=settings.moveLayout;
    this.root.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-setting]').forEach(input=>input.addEventListener(input.type==='range'?'input':'change',()=>this.applySetting(input.dataset.setting!,input)));
    this.settingsPanel.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const items=this.focusables(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
  }
  private applySetting(key:string,input:HTMLInputElement|HTMLSelectElement|InkSelect){
    if(key==='quality')chooseQuality(this.settings,input.value,machineQuality());
    else if(key==='powerMode')this.settings.powerMode=input.value==='cool'||input.value==='full'?input.value:'auto';
    else if(key==='cameraMode')this.settings.cameraMode=input.value as Settings['cameraMode'];
    else if(key==='cameraStyle')this.settings.cameraStyle=input.value==='close'?'close':'classic';
    else if(key==='lockStyle')this.settings.lockStyle=input.value==='brackets'?'brackets':'glow';
    else if(key==='hudSkin'){this.settings.hudSkin=(HUD_SKINS as readonly string[]).includes(input.value)?input.value as Settings['hudSkin']:'halo';this.applySkin();}
    else if(key==='moveLayout'){this.settings.moveLayout=(MOVE_LAYOUTS as readonly string[]).includes(input.value)?input.value as Settings['moveLayout']:'row';this.applyMoveLayout();}
    else if(key==='cinematics')this.settings.cinematics=(input as HTMLInputElement).checked;
    else if(key==='animStyle')this.settings.animStyle=input.value==='snap'||input.value==='classic'?input.value:'twos';
    else if(key==='musicEnabled'){this.setMusicEnabled((input as HTMLInputElement).checked);this.onMusicToggle(this.settings.musicEnabled);}
    else if(key==='homeAnimations'){this.settings.homeAnimations=(input as HTMLInputElement).checked;this.homePreview.setEnabled(this.settings.homeAnimations);}
    else if(key==='errorReports')this.settings.errorReports=(input as HTMLInputElement).checked;
    else (this.settings as unknown as Record<string,number>)[key]=Number(input.value);
    this.root.querySelectorAll<HTMLInputElement|HTMLSelectElement>(`[data-setting="${key}"],[data-home-setting="${key}"]`).forEach(other=>{if(other instanceof HTMLInputElement&&other.type==='checkbox')other.checked=(input as HTMLInputElement).checked;else other.value=input.value;});
    this.root.querySelectorAll(`[data-option-value="${key}"]`).forEach(output=>output.textContent=optionValue(key,Number(input.value)));
    try{localStorage.setItem('rift-settings',JSON.stringify(this.settings));}catch{ }
    this.onSettings(this.settings);
  }
  private previewFighter(fighter:FighterId){this.homePreviewFighter=fighter;void this.homePreview.select(fighter);}
  private get homeDialog(){return this.root.querySelector<HTMLDialogElement>('#home-dialog')!;}
  private updatePlayLabel(){
    const label=HOME_MODES.find(mode=>mode.id===this.homeMode)!.label;
    const play=this.root.querySelector('#home-play')!;
    if(isLaboratoryPreviewFighter(this.selected)){
      play.setAttribute('aria-label',`Review ${FIGHTERS[this.selected].name} in offline Training`);
      play.querySelector('span')!.textContent='TEST FIGHTER';return;
    }
    play.setAttribute('aria-label',`Play ${label}${this.homeMode==='duel'?' · '+this.duelAccess:''} as ${FIGHTERS[this.selected].name}`);
    play.querySelector('span')!.textContent=isObjectiveKind(this.homeMode)?'PLAY NOW':'PLAY';
  }
  private selectHomeMode(mode:HomeMode){
    this.homeMode=mode;
    this.root.querySelector<HTMLElement>(`[data-panel="${mode}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
    this.updatePlayLabel();
  }
  private openHomeDialog(kind:'private'|'arcade'|'options'|'controls'|'coop'|'duel'){
    this.onPreviewStop();
    if(!this.homeDialog.open)this.homeReturnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    this.homeDialog.dataset.kind=kind;
    this.homeDialog.classList.toggle('home-dialog-wide',kind==='options'||kind==='controls');
    this.root.querySelector<HTMLElement>('#invite-preview')!.hidden=true;
    this.text('home-dialog-title',{duel:'DUEL WITH A FRIEND',private:'PRIVATE ROOM',arcade:'ARCADE SURVIVAL',options:'OPTIONS',controls:'CONTROLS',coop:'CO-OP SURVIVAL'}[kind]);
    if(kind==='private'||kind==='coop'||kind==='duel')this.text('code-help',kind==='duel'?'A private 1v1. Share the code or invite link. Both players choose their fighter before joining.':kind==='coop'?'Share your six-digit code, up to 4 fighters. QUICK MATCH puts you in any open party: mid-run, you drop in between rounds.':'Share your six-digit code. Seats your friends leave empty are filled with bots.');
    this.root.querySelector<HTMLElement>('#home-room-size')!.hidden=kind!=='private';
    this.root.querySelector<HTMLElement>('#quick-coop')!.hidden=kind!=='coop';
    for(const [id,show] of [['home-private-fields',kind==='private'||kind==='coop'||kind==='duel'],['home-arcade-note',kind==='arcade'],['home-coop-note',kind==='coop'],['home-options-fields',kind==='options'],['home-controls-fields',kind==='controls']] as const)this.root.querySelector<HTMLElement>('#'+id)!.hidden=!show;
    if(kind==='options')this.root.querySelector('#home-options-fields')!.innerHTML=homeOptions(this.settings);
    if(kind==='controls'){this.guideFighter=this.selected;this.renderHomeControls();this.showControlsPage('layout');}
    this.text('home-dialog-status','');this.homePreview.setPaused(true);
    if(!this.homeDialog.open)this.homeDialog.showModal();
    (this.root.querySelector(kind==='private'||kind==='coop'||kind==='duel'?'#create-private':kind==='options'&&this.inputMode==='controller'?'#home-career':'#home-dialog-close') as HTMLElement).focus();
  }
  private renderHomeControls(){this.root.querySelector('#home-control-layout')!.innerHTML=illustratedControls(this.controlDevice,this.controlFamily);}
  private showControlsPage(page:'layout'|'guide'){
    this.bindingEditor.cancel();this.controlsPage=page;
    this.root.querySelector<HTMLElement>('#home-control-layout')!.hidden=page!=='layout';
    this.root.querySelector<HTMLElement>('#home-guide-fields')!.hidden=page!=='guide';
    this.root.querySelectorAll<HTMLButtonElement>('[data-controls-page]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.controlsPage===page)));
    if(page==='guide')this.renderGuide();
  }
  private async shareInvite(native:boolean){
    const code=this.root.querySelector('#private-code')!.textContent?.replace(/\s/g,'')??'';
    if(!/^\d{6}$/.test(code))return;
    const own=inviteUrl({code,kind:this.privateKind}),url=inPlayerTwo()?await inviteLink({room:code,kind:this.privateKind},own):own;
    try{
      if(native&&navigator.share){await navigator.share({title:'Join me in Impact',text:this.privateKind==='coop'?'Join my co-op party':'Join my private match',url});this.notify('INVITE SHARED');}
      else{await navigator.clipboard.writeText(url);this.notify('INVITE LINK COPIED');}
    }catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;this.text('private-hint',`Copy this invite: ${url}`);}
  }
  private renderGuide(){
    const active=document.activeElement as HTMLElement|null;
    const selector=active?.id?`#${active.id}`:active?.dataset.guideStep?`[data-guide-step="${active.dataset.guideStep}"]`:active?.dataset.guidePick?`[data-guide-pick="${this.guideFighter}"]`:undefined;
    this.root.querySelector('#home-guide-fields')!.innerHTML=homeFighterGuide(this.guideFighter,this.controlDevice,this.controlFamily,this.homeBusy);
    if(selector)this.root.querySelector<HTMLElement>(selector)?.focus({preventScroll:true});
    const track=this.root.querySelector<HTMLElement>('.guide-carousel'),selected=track?.querySelector<HTMLElement>('[aria-pressed=true]');
    if(track&&selected)track.scrollLeft=selected.offsetLeft-(track.clientWidth-selected.offsetWidth)/2;
  }
  private returnToOptions(){this.bindingEditor.cancel();this.openHomeDialog('options');this.root.querySelector<HTMLElement>('#home-controls')?.focus();}
  private bindHome(){
    const rail=this.root.querySelector<HTMLElement>('.home-modes')!,wrap=rail.parentElement!;
    const page=()=>{const max=Math.max(0,rail.scrollWidth-rail.clientWidth);wrap.classList.toggle('has-next',rail.scrollLeft<max-8);wrap.classList.toggle('has-previous',rail.scrollLeft>8);wrap.style.setProperty('--mode-progress',String(max?rail.scrollLeft/max:0));wrap.style.setProperty('--mode-visible',`${Math.min(100,rail.clientWidth/Math.max(1,rail.scrollWidth)*100)}%`);};
    rail.addEventListener('scroll',page,{passive:true});new ResizeObserver(page).observe(rail);
    rail.addEventListener('wheel',event=>{if(event.ctrlKey||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;const max=rail.scrollWidth-rail.clientWidth;if(event.deltaY<0&&rail.scrollLeft<=0||event.deltaY>0&&rail.scrollLeft>=max-1)return;event.preventDefault();rail.scrollLeft+=event.deltaY;},{passive:false});
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.onclick=()=>this.selectHomeMode(button.dataset.mode as HomeMode));
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode-options]').forEach(button=>button.onclick=()=>{const mode=button.dataset.modeOptions;if(isObjectiveKind(mode)){this.selectHomeMode(mode);this.onPreviewStop();this.objectives.open(mode,'',this.selected);}});
    this.root.querySelectorAll<HTMLButtonElement>('[data-duel]').forEach(button=>button.onclick=()=>{
      this.duelAccess=button.dataset.duel as typeof this.duelAccess;
      this.root.querySelectorAll<HTMLButtonElement>('[data-duel]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
      this.selectHomeMode('duel');if(this.duelAccess==='friend')this.openHomeDialog('duel');
    });
    this.root.querySelector<HTMLButtonElement>('#home-play')!.onclick=()=>{
      if(this.homeBusy)return;
      if(isLaboratoryPreviewFighter(this.selected)){this.onLaboratoryReview(this.selected);return;}
      if(isObjectiveKind(this.homeMode)){this.onPreviewStop();this.onStart(this.selected,'match',this.playerName(),{kind:'objective',objective:this.homeMode,access:'bots',fighter:this.selected});return;}
      if(this.homeMode==='duel'){if(this.duelAccess==='friend')this.openHomeDialog('duel');else this.onStart(this.selected,'match',this.playerName(),{kind:'duel',access:this.duelAccess});return;}
      if(this.homeMode==='private'){this.openHomeDialog(this.homeMode);return;}
      if(this.homeMode==='arcade'&&this.arcadeParty==='coop'){this.openHomeDialog('coop');return;}
      this.onStart(this.selected,this.homeMode==='training'?'training':'match',this.playerName(),this.homeMode==='bots'?{kind:'bots',players:this.botPlayers}:this.homeMode==='arcade'?{kind:'survival'}:{kind:'public'});
    };
    for(const action of ['host','join'])this.root.querySelector<HTMLButtonElement>('#choose-'+action)!.onclick=()=>{
      this.selectHomeMode('private');this.openHomeDialog('private');
      if(action==='join')this.root.querySelector<HTMLInputElement>('#room-code')!.focus();
    };
    this.root.querySelector<HTMLButtonElement>('#join-private-tab')!.onclick=()=>this.root.querySelector<HTMLInputElement>('#room-code')!.focus();
    for(const party of ['solo','coop'] as const)this.root.querySelector<HTMLButtonElement>('#choose-'+party)!.onclick=()=>{
      this.arcadeParty=party;
      for(const other of ['solo','coop'])this.root.querySelector('#choose-'+other)!.setAttribute('aria-pressed',String(other===party));
      this.selectHomeMode('arcade');
      if(party==='coop')this.openHomeDialog('coop');
    };
    this.root.querySelector<HTMLButtonElement>('#home-dialog-close')!.onclick=()=>this.homeDialog.close();
    this.homeDialog.addEventListener('close',()=>{this.editingCode=false;this.homePreview.setPaused(false);if(!this.menu.classList.contains('hidden'))this.homeReturnFocus?.focus();});
    this.root.querySelector<HTMLButtonElement>('#home-options')!.onclick=()=>this.openHomeDialog('options');
    this.root.querySelector('#home-options-fields')!.addEventListener('click',event=>{const id=(event.target as Element).closest('button')?.id;if(id==='home-career')this.onCareer();else if(id==='home-controls')this.openHomeDialog('controls');});
    this.root.querySelector('[data-options-back]')!.addEventListener('click',()=>this.returnToOptions());
    this.root.querySelectorAll<HTMLButtonElement>('[data-controls-page]').forEach(button=>button.onclick=()=>this.showControlsPage(button.dataset.controlsPage as 'layout'|'guide'));
    const guide=this.root.querySelector('#home-guide-fields')!;
    guide.addEventListener('keydown',event=>{const e=event as KeyboardEvent;if(!(e.target as HTMLElement).closest('.guide-carousel'))return;let index=HOME_ROSTER.indexOf(this.guideFighter);if(e.key==='ArrowRight')index++;else if(e.key==='ArrowLeft')index--;else if(e.key==='Home')index=0;else if(e.key==='End')index=HOME_ROSTER.length-1;else return;e.preventDefault();this.guideFighter=HOME_ROSTER[(index+HOME_ROSTER.length)%HOME_ROSTER.length];this.renderGuide();});
    guide.addEventListener('wheel',event=>{const e=event as WheelEvent,track=(e.target as HTMLElement).closest<HTMLElement>('.guide-carousel');if(!track||e.ctrlKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;const left=track.scrollLeft,max=track.scrollWidth-track.clientWidth;if(e.deltaY<0&&left<=0||e.deltaY>0&&left>=max-1)return;e.preventDefault();track.scrollBy({left:e.deltaY,behavior:'smooth'});},{passive:false});
    guide.addEventListener('click',event=>{
      const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
      if(button.dataset.guideStep){this.guideFighter=HOME_ROSTER[(HOME_ROSTER.indexOf(this.guideFighter)+Number(button.dataset.guideStep)+HOME_ROSTER.length)%HOME_ROSTER.length];this.renderGuide();}
      else if(button.dataset.guidePick&&HOME_ROSTER.includes(button.dataset.guidePick as FighterId)){this.guideFighter=button.dataset.guidePick as FighterId;this.renderGuide();}
      else if(button.id==='guide-select'||button.id==='guide-training'){
        if(button.id==='guide-training'&&this.homeBusy)return;
        const fighter=this.root.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${this.guideFighter}"]`)!;
        fighter.click();this.homeReturnFocus=fighter;this.homeDialog.close();
        if(button.id==='guide-training'){this.selectHomeMode('training');this.root.querySelector<HTMLButtonElement>('#home-play')!.click();}
      }
    });
    const options=this.root.querySelector('#home-options-fields')!;
    const change=(event:Event)=>{const input=event.target;if(!(input instanceof HTMLInputElement||input instanceof HTMLSelectElement||input instanceof InkSelect)||!input.dataset.homeSetting)return;if((input.type==='range')!==(event.type==='input'))return;this.applySetting(input.dataset.homeSetting,input);};
    options.addEventListener('input',change);options.addEventListener('change',change);
    this.root.querySelector('#home-controls-fields')!.addEventListener('click',event=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;if(button.dataset.bind){this.bindingEditor.start(button,this.controlDevice==='controller');return;}if(button.id==='bindings-reset'){this.bindingEditor.cancel();resetBindings(this.controlDevice);this.renderHomeControls();this.root.querySelector<HTMLElement>('#bindings-reset')?.focus();return;}if(!button.dataset.controlDevice)return;this.bindingEditor.cancel();this.controlDevice=button.dataset.controlDevice as ControlDevice;if(button.dataset.controlFamily)this.controlFamily=button.dataset.controlFamily as PadFamily;this.renderHomeControls();this.root.querySelector<HTMLElement>(this.controlDevice==='keyboard'?'[data-control-device="keyboard"]':`[data-control-family="${this.controlFamily}"]`)!.focus();});
    const name=this.root.querySelector<HTMLInputElement>('#player-name')!;
    try{name.value=localStorage.getItem('rift-player-name')||'Fighter';}catch{ }
    name.addEventListener('change',()=>{
      name.value=name.value.trim().slice(0,18)||'Fighter';
      try{localStorage.setItem('rift-player-name',name.value);}catch{ }
    });
    this.updatePlayLabel();
  }
  loading(text:string,progress:number){this.root.querySelector<HTMLElement>('#load-retry')!.hidden=true;this.root.querySelector<HTMLElement>('#home-loading')!.hidden=progress>=100&&!this.homeBusy;this.text('load-status',text);this.text('load-label','Loading Fighters');if(this.homeDialog.open&&this.homeBusy)this.text('home-dialog-status','');this.root.querySelector<HTMLProgressElement>('#load-progress')!.value=progress;}
  ready(){this.busy(false);this.loading('ARENA READY',100);this.root.querySelector<HTMLElement>('#load-retry')!.hidden=true;}
  loadingStages(text:string){this.text('load-stages',text);}
  loadFailed(message:string){this.loading(message,0);this.busy(true);this.text('load-label','Couldn’t load fighters');this.root.querySelector<HTMLElement>('#load-retry')!.hidden=false;}
  busy(value:boolean){this.homeBusy=value;if(value)this.banner('');this.objectives.busy(value);this.root.querySelectorAll<HTMLButtonElement>('#home-play,#create-private,#join-private,#quick-coop,#guide-training').forEach(b=>b.disabled=value);this.menu.setAttribute('aria-busy',String(value));if(this.homeDialog.open&&this.homeDialog.dataset.kind==='controls'&&this.controlsPage==='guide')this.renderGuide();}
  private applySkin(){const skin=this.settings.hudSkin??'halo';if(this.root.dataset.skin===skin)return;this.root.dataset.skin=skin;inkedFit.comboTop=skin==='halo'?340:300;
    if((PROTO_IDS as readonly string[]).includes(skin)){this.root.dataset.proto=skin;this.protos.refresh();}else delete this.root.dataset.proto;}
  private applyMoveLayout(){this.root.dataset.moves=this.settings.moveLayout??'row';}
  setMusicEnabled(enabled:boolean){this.settings.musicEnabled=enabled;this.root.querySelectorAll<HTMLInputElement>('[data-setting="musicEnabled"],[data-home-setting="musicEnabled"]').forEach(input=>input.checked=enabled);try{localStorage.setItem('rift-settings',JSON.stringify(this.settings));}catch{ }}
  playerName(){return this.root.querySelector<HTMLInputElement>('#player-name')!.value.trim().slice(0,18)||'Fighter';}
  enter(fighter:FighterId){
    this.objectives.closeSetup();
    this.matchIntro.reset();
    this.onPreviewStop();this.homeDialog.close();this.homePreview.setVisible(false);this.menu.classList.add('hidden');this.root.querySelector('.combat-hud')!.classList.remove('hidden');
    this.fallen=[];this.resultsKey='';this.markerKey='';this.roomGone=false;this.root.querySelector('#results')!.classList.add('hidden');
    this.refighter(fighter);
    this.protos.enter(fighter);
  }
  refighter(fighter:FighterId){
    this.lastOwnHp=null;this.lastFoeHp=null;this.lastFoeId=null;
    this.text('pause-fighter-name',FIGHTERS[fighter].name.toUpperCase());this.root.querySelector('#pause-portrait')!.innerHTML=mangaPortrait(fighter);
    this.pauseFighter=fighter;this.renderPauseMoves();
    this.text('own-name',FIGHTERS[fighter].name.toUpperCase());this.inked.enter(fighter);
    const moveBar=this.root.querySelector<HTMLElement>('.move-bar')!;
    moveBar.dataset.artFighter=fighter;
    this.moveSheet??=new MoveSheet(sheet=>moveBar.style.setProperty('--move-sheet',`url('${moveSheetUrl(sheet)}')`));
    this.moveSheet.now(fighter);for(const sheet of moveSheetsFor(fighter))this.moveSheet.warm(sheet);
    const labels=FIGHTERS[fighter].shortMoves??[fighter==='luffy'?'PISTOL':'LIGHT',fighter==='luffy'?'BAZOOKA':'HEAVY',fighter==='goku'?'KAMEHAMEHA':fighter==='luffy'?'RED HAWK':'RASENSHURIKEN',fighter==='goku'?'SPIRIT BOMB':fighter==='luffy'?'KING KONG GUN':'BEAST BOMB'];
    this.root.querySelectorAll<HTMLElement>('.move-slot[data-move]').forEach(slot=>{const i=Number(slot.dataset.move);slot.querySelector('.ik-cap')!.textContent=i===4?areaMoveCard(moveFor(fighter,'area',false)):labels[i];});
  }
  select(fighter:FighterId){
    const button=this.root.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${fighter}"]`);
    if(!button||this.selected===fighter)return;
    revealHomeFighter(this.menu,fighter);this.selected=fighter;
    this.root.querySelectorAll<HTMLButtonElement>('[data-fighter]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-pressed',String(el===button));});
    if(this.menu.classList.contains('hidden'))this.previewDue=true;else this.previewFighter(fighter);
    this.updatePlayLabel();
  }
  private previewDue=false;
  lobby(){if(this.previewDue){this.previewDue=false;this.previewFighter(this.selected);}this.modes.clear();this.objectives.reset();this.matchIntro.reset();this.settingsPanel.classList.add('hidden');this.root.querySelector('#results')!.classList.add('hidden');this.fallen=[];this.resultsKey='';this.roomGone=false;this.root.querySelector('.combat-hud')!.classList.add('hidden');this.menu.classList.remove('hidden');this.homePreview.setVisible(true);this.trainingRoom=false;this.privateWaiting=false;this.root.querySelector('#private-status')!.classList.add('hidden');this.ready();}
  private pauseFighter?:FighterId;
  private renderPauseMoves(){const list=this.root.querySelector<HTMLElement>('#pause-move-list');if(list&&this.pauseFighter)list.innerHTML=commandList(this.pauseFighter,this.root.dataset.input==='touch'?'touch':this.inputMode,this.padFamily);}
  private readonly slotArtists = new Map<HTMLElement, MoveCardArt>();
  private slotArt(slot:HTMLElement,i:number,fighter:FighterId,borrowed?:{from:FighterId;fromSlot:AttackSlot},awakened=false){
    let artist=this.slotArtists.get(slot);
    if(!artist){artist=new MoveCardArt(slot);this.slotArtists.set(slot,artist);}
    const panel=borrowed?(['light','heavy','special','ultimate','area'] as const).indexOf(borrowed.fromSlot):i;
    const sheet=moveSheetOf(fighter,awakened),form=!borrowed&&panel===4&&sheet!==fighter&&!!areaArtUrl(sheet);
    artist.show(form?sheet:borrowed?.from??fighter,panel,!borrowed);
  }
  private showPausePage(page:'settings'|'moves'){
    const card=this.settingsPanel.querySelector<HTMLElement>('.pause-menu');if(!card)return;
    card.dataset.pausePage=page;card.scrollTop=0;
    this.settingsPanel.querySelector<HTMLElement>(page==='moves'?'.pause-moves-head [data-pause-page]':'.pause-move-list')?.focus({preventScroll:true});
  }
  toggleSettings(force?:boolean){
    this.matchIntro.close();
    if(!this.menu.classList.contains('hidden')){if(force===false||this.homeDialog.open)this.homeDialog.close();else this.openHomeDialog('options');return;}
    const open=force??this.settingsPanel.classList.contains('hidden');
    this.settingsPanel.classList.toggle('hidden',!open);
    if(open){document.exitPointerLock?.();const card=this.settingsPanel.querySelector<HTMLElement>('.pause-menu');if(card)card.dataset.pausePage='settings';this.settingsPanel.querySelector<HTMLElement>('#resume')!.focus({preventScroll:true});}else{this.onResume();if(this.settingsPanel.contains(document.activeElement))(document.activeElement as HTMLElement).blur();}
  }
  get settingsOpen(){return this.objectives.setupOpen||this.homeDialog.open||!this.settingsPanel.classList.contains('hidden');}
  update(snapshot:GameSnapshot,self:PlayerState,target:PlayerState|undefined,connected:boolean){
    if(target?.enemy==='rift-unit')target=undefined;
    if(this.lastOwnHp!==null&&self.hp<this.lastOwnHp-1)this.pulseHit('own');
    this.lastOwnHp=self.hp;
    if(target?.id!==this.lastFoeId){this.lastFoeId=target?.id??null;this.lastFoeHp=null;}
    if(target&&this.lastFoeHp!==null&&target.hp<this.lastFoeHp-1)this.pulseHit('foe');
    this.lastFoeHp=target?.hp??null;
    const objective=objectiveOf(snapshot);this.objectives.update(snapshot,self.id);
    this.trainingRoom=snapshot.roomMode==='training'&&!this.survivalMode&&!objective&&!riftOf(snapshot);
    this.root.querySelector('#training-tools')!.classList.toggle('hidden',!this.trainingRoom);
    this.text('pause-mode',riftOf(snapshot)?'RIFT WAR':objective?OBJECTIVE_NAMES[objective.kind]:this.survivalMode?('survival' in snapshot?'ARCADE CO-OP':'ARCADE SURVIVAL'):this.trainingRoom?'TRAINING':snapshot.lobby?.duel?'DUEL':'ONLINE MATCH');
    this.text('settings-session-note',riftOf(snapshot)?.access==='bots'||objective&&(objective.access==='bots'||objective.access==='solo')?'The match is paused. Played locally on this device.':this.survivalMode?('survival' in snapshot?'The co-op run continues while this menu is open.':'The run is paused while this menu is open.'):this.trainingRoom?'Training continues while this menu is open.':'The online match continues while this menu is open.');
    const botMode=(snapshot as GameSnapshot & {trainingBotMode?:'passive'|'combat'}).trainingBotMode;
    for(const button of this.botModeButtons){
      const active=this.trainingRoom&&button.dataset.training===botMode,pressed=String(active);
      if(button.classList.contains('selected')!==active)button.classList.toggle('selected',active);
      if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
    }
    this.inked.comboTick(self.combo??0);
    this.privateKind=snapshot.lobby?.duel?'duel':this.survivalMode?'coop':'private';
    this.privateWaiting=snapshot.lobby?.visibility==='private'&&snapshot.status==='waiting';this.root.querySelector('.combat-hud')!.classList.toggle('waiting-room',this.privateWaiting);
    const lobby=snapshot.lobby;const isPrivate=lobby?.visibility==='private';
    const coopRoom='survival' in snapshot;
    const panel=privatePanel(lobby,snapshot.status,snapshot.serverTime,self.id,{coop:coopRoom,players:snapshot.players.length,duel:snapshot.duel}),status=this.root.querySelector<HTMLElement>('#private-status')!;
    status.classList.toggle('hidden',panel.hidden);status.classList.toggle('waiting',snapshot.status==='waiting');status.classList.toggle('party',panel.party);
    if(isPrivate){this.text('private-code',panel.party?'':lobby.code??'');const start=this.root.querySelector<HTMLButtonElement>('#private-start')!;start.hidden=panel.startHidden;start.disabled=!lobby.canStart||!connected;
      const label=this.root.querySelector('#private-status > span');if(label&&label.textContent!==panel.label)label.textContent=panel.label;
      if(start.textContent!==panel.startLabel)start.textContent=panel.startLabel;
      this.text('private-hint',panel.hint);}
    const cv=customOf(snapshot),ck=JSON.stringify([this.privateWaiting&&cv,lobby?.hostId===self.id,lobby?.startsAt]);
    if(ck!==this.customKey){this.customKey=ck;const panel=this.root.querySelector<HTMLElement>('#private-custom')!,focus=panel.contains(document.activeElement)?(document.activeElement as HTMLElement).dataset.focus:undefined;panel.innerHTML=this.privateWaiting&&cv?customControls(cv,lobby?.hostId===self.id,self.id,lobby?.startsAt===null):'';if(focus)panel.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus({preventScroll:true});}
    if(this.privateWaiting){
      const key=snapshot.players.map(p=>`${p.id}:${p.name}:${p.fighter}`).join('|')+lobby?.hostId;
      if(key!==this.rosterKey){this.rosterKey=key;const roster=this.root.querySelector('#room-roster')!;roster.replaceChildren();
        for(let i=0;i<(coopRoom?4:lobby?.size??12);i++){const player=snapshot.players[i],card=document.createElement('div');card.className='room-player'+(player?'':' empty');
          if(player){const portrait=document.createElement('img');portrait.src=mediaArt(FIGHTERS[player.fighter].portrait);portrait.alt='';const names=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=player.name;detail.textContent=`${FIGHTERS[player.fighter].name} · ${player.id===lobby?.hostId?'HOST':'READY'}`;names.append(name,detail);card.append(portrait,names);}else{card.textContent=`${String(i+1).padStart(2,'0')} · ${lobby?.size&&!coopRoom&&!lobby.duel?'OPEN · BOT AT START':'OPEN SEAT'}`;}roster.append(card);
        }
      }
    }
    this.inked.update(self,target);
    {const custom=customOf(snapshot),clock=custom?.endsAt&&snapshot.status==='active'?Math.max(0,custom.endsAt-snapshot.serverTime):null,inView=!this.matchIntro.open&&snapshot.status==='active';
      const lean=this.settings.quality==='low'||this.settings.powerMode==='cool';if(lean!==this.hudLean){this.hudLean=lean;if(lean)this.root.dataset.hdLean='';else delete this.root.dataset.hdLean;}
      this.protos.update(self,target,snapshot.serverTime,clock,inView);}
    const awakened=!!self.awakened,left=Math.max(0,(self.awakenedUntil??0)-snapshot.serverTime),awakening=self.awakening??0;
    const artFighter=moveSheetOf(self.fighter,awakened);
    const moveBar=this.root.querySelector<HTMLElement>('.move-bar')!;
    if(moveBar.dataset.artFighter!==artFighter){moveBar.dataset.artFighter=artFighter;this.moveSheet?.want(artFighter);}
    const ultimateReady=self.ultimate>=ULTIMATE_COST,awakeningReady=!awakened&&awakening>=AWAKENING_COST,now=performance.now();
    for(const [id,amount,display,ready,active] of [
      ['ultimate-card',self.ultimate/ULTIMATE_COST,`${Math.floor(self.ultimate)}%`,ultimateReady,false],
      ['awakening-card',awakened?left/AWAKENING_SECONDS:awakening/AWAKENING_COST,awakened?`${left.toFixed(1)}s`:`${Math.floor(awakening)}%`,awakeningReady,awakened]
    ] as const){
      const card=this.root.querySelector<HTMLElement>('#'+id)!,done=Math.max(0,Math.min(1,amount)).toFixed(3);
      if(card.style.getPropertyValue('--done')!==done)card.style.setProperty('--done',done);
      if(card.classList.contains('ready')!==ready)card.classList.toggle('ready',ready);
      if(card.classList.contains('awake')!==active)card.classList.toggle('awake',active);
      const number=card.querySelector<HTMLElement>('.ik-charge')!,unit=display.endsWith('%')?'%':'s';
      if(number.textContent!==display.slice(0,-1))number.textContent=display.slice(0,-1);
      if(number.dataset.unit!==unit)number.dataset.unit=unit;
      const label=`${id==='ultimate-card'?'Ultimate':active?AWAKENINGS[self.fighter].name:'Awakening'} ${display}${ready?' ready':''}`;
      if(card.getAttribute('aria-label')!==label)card.setAttribute('aria-label',label);
    }
    this.inked.ultimateTick(ultimateReady,this.root.querySelector<HTMLElement>('#ultimate-card')!,now);
    this.text('awakening-card-title',awakened?'AWAKENED':'AWAKENING');
    this.root.querySelector('.fighter-meter.own')!.classList.toggle('offline',!connected);
    this.root.querySelector('#connection-note')!.classList.toggle('hidden',connected);
    this.text('match-mode',snapshot.lobby?.duel?'DUEL':snapshot.roomMode==='training'?'TRAINING':this.privateWaiting?'PRIVATE LOBBY':`${snapshot.players.filter(p=>p.alive).length} ALIVE`);
    this.root.querySelector<HTMLElement>('#duel-cancel')!.hidden=!(lobby?.duel&&snapshot.status==='waiting'&&!isPrivate&&!snapshot.players.some(p=>p.isBot));
    const bots=snapshot.players.filter(p=>p.isBot).length;
    this.text('match-detail',lobby?.duel?(snapshot.status==='waiting'?(snapshot.players.length<2?(isPrivate?'WAITING FOR A FRIEND':'FINDING AN OPPONENT…'):lobby.startsAt!==null?`GET READY · ${Math.max(0,Math.ceil(lobby.startsAt-snapshot.serverTime))}s`:'WAITING FOR HOST'):'BEST OF THREE · FIRST TO TWO'):snapshot.roomMode==='training'?(bots===1&&snapshot.players.length-bots===1?'1 PLAYER · SPARRING BOT':`${snapshot.players.length-bots} PLAYER${snapshot.players.length-bots===1?'':'S'} · ${bots} SPARRING BOT${bots===1?'':'S'}`):snapshot.status==='waiting'?(bots?`BATTLE ROYALE · ${snapshot.players.length} FIGHTERS`:`${snapshot.players.length} / ${coopRoom?4:lobby?.size??12} FIGHTERS JOINED`):'LAST ONE STANDING');
    if(cv?.endsAt&&snapshot.status==='active'){const remaining=Math.max(0,Math.ceil(cv.endsAt-snapshot.serverTime));this.text('match-detail',`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')} LEFT`);}
    this.moveSlots.forEach(slot=>{
      const i=Number(slot.dataset.move),key=MOVE_SLOTS[i],area=key==='area';const cooldown=Math.max(0,(self.cooldowns[key]??0)-snapshot.serverTime);
      const formShort=self.awakened?self.fighter==='naruto'?KURAMA_SHORT_MOVES:FIGHTERS[self.fighter].formShortMoves:undefined,kurama=!!formShort,borrowed=slotNames(self,key),own=area?moveFor(self.fighter,'area',!!self.awakened).name:undefined;
      const label=borrowed?borrowed.short:own!==undefined?areaMoveCard(moveFor(self.fighter,'area',!!self.awakened)):formShort?formShort[i]:FIGHTERS[self.fighter].shortMoves?.[i]??key.toUpperCase();
      const name=borrowed?borrowed.name:own??(kurama?moveFor(self.fighter,key,true).name:FIGHTERS[self.fighter].moves[i]);if(slot.title!==name)slot.title=name;
      this.slotArt(slot,i,self.fighter,borrowed,!!self.awakened);
      const title=slot.querySelector('.ik-cap')!;if(title.textContent!==label)title.textContent=label;
      slot.classList.toggle('unavailable',cooldown>0.1&&i!==3);slot.classList.toggle('active',self.action===key);
      slot.classList.toggle('cooling',cooldown>0.1);
      if(area){const ready=cooldown<=0.1&&self.alive;if(slot.classList.contains('ready')!==ready)slot.classList.toggle('ready',ready);}
      const share=this.cooldowns[i].of(cooldown);
      if(i!==3){const done=share.toFixed(3);if(slot.style.getPropertyValue('--done')!==done)slot.style.setProperty('--done',done);}
      const numeral=slot.querySelector('.ik-cool')!,seconds=cooldown>0.1?cooldown.toFixed(1):'';if(numeral.textContent!==seconds)numeral.textContent=seconds;
    });
    this.moveTape.tick(this.root,moveBar,now);
    const pointerHint=this.root.querySelector('#pointer-hint')!;
    const hint=this.root.dataset.objective?this.objectiveCameraHint:'CLICK TO FOCUS CAMERA';if(pointerHint.textContent!==hint)pointerHint.textContent=hint;
    pointerHint.classList.toggle('hidden',document.pointerLockElement!==null||this.settingsOpen||this.privateWaiting||this.objectives.blocking||this.inputMode==='controller');
    if(snapshot.status==='waiting')this.fallen.length=0;
    else if(!this.trainingRoom)for(const p of snapshot.players)if(!p.alive&&!this.fallen.includes(p.id))this.fallen.push(p.id);
    this.root.querySelector('#spectate-chip')!.classList.toggle('hidden',self.alive||this.trainingRoom||snapshot.status!=='active');
    if(!self.alive&&this.trainingRoom)this.notify('TRAINING RESET',0.4);
    const finale=snapshot.status==='finished'&&this.finale();
    const finished=((snapshot.status==='finished'&&!finale)||(!self.alive&&'resultsNow' in this.root.dataset))&&!this.trainingRoom&&!this.survivalMode&&!objective&&!riftOf(snapshot);
    this.results(snapshot,self,finished);
    if(snapshot.status==='finished'&&!finished&&!finale&&!objective&&!riftOf(snapshot))this.notify(snapshot.winnerId===self.id?'LAST FIGHTER STANDING':'MATCH COMPLETE',0.4);
    this.modes.update(snapshot,self,target);
  }
  private pulseHit(side:'own'|'foe'){
    const meter=this.root.querySelector<HTMLElement>(`.fighter-meter.${side}`)!;
    pulseClass(meter,'hit');
    if(side==='own')window.clearTimeout(this.ownHitTimer);else window.clearTimeout(this.foeHitTimer);
    const timer=window.setTimeout(()=>meter.classList.remove('hit'),420);
    if(side==='own')this.ownHitTimer=timer;else this.foeHitTimer=timer;
  }
  private refreshBindingHints(){
    const free=(code:string)=>!ACTIONS.some(a=>boundTo(a,code));
    this.objectiveCameraHint=`${free('KeyO')&&free('BracketLeft')?'O / [':'← / →'} LOOK${free('KeyI')?'   I RECENTRE':''}   ${keyNames('target').toUpperCase()} LOCK`;
    const pad=this.inputMode==='controller',family=this.padFamily;
    this.root.querySelectorAll<HTMLElement>('.move-slot').forEach(card=>{const el=card.querySelector<HTMLElement>('kbd');if(!el)return;const action:CombatAction=card.dataset.move?MOVE_ACTIONS[Number(card.dataset.move)]:'awaken',control=action==='awaken'?undefined:actionControl(action);el.textContent=pad?actionName(action,family):keyName(getBindings().keyboard[action][0]);el.className=pad&&family==='playstation'&&control&&['south','east','west','north'].includes(control)?`ps-face ps-${control}`:'';});
    this.root.querySelector('#controls-hint')!.innerHTML=pad?padCombatHints(family):keyboardCombatHints();
    const touch=this.root.dataset.input==='touch',TOUCH_CONTROL:Partial<Record<PadControl,string>>={lstick:'STICK',rstick:'DRAG'};
    this.root.querySelectorAll<HTMLElement>('.key-cards>[data-action]').forEach(card=>{const action=card.dataset.action as CombatAction,el=card.querySelector('kbd');if(!el)return;el.textContent=touch?touchLabel(action)??'':keyNames(action);el.classList.toggle('touch-key',touch);});
    const movement=this.root.querySelector<HTMLElement>('.secondary-keys [data-pad="lstick"]');if(movement)movement.dataset.plain=['forward','left','backward','right'].map(a=>keyName(getBindings().keyboard[a as 'forward'][0])).join(' / ');
    this.root.querySelectorAll<HTMLElement>('.key-cards small[data-pad],.secondary-keys b:is([data-pad],[data-action])').forEach(el=>{
      const control=el.dataset.pad as PadControl,action=el.closest<HTMLElement>('[data-action]')?.dataset.action as CombatAction|undefined,thumb=action?touchLabel(action):TOUCH_CONTROL[control];
      el.dataset.plain??=el.textContent??'';
      el.textContent=touch&&!pad&&thumb?thumb:action?(pad?actionName(action,family):keyNames(action)):pad?padName(family,control):el.dataset.plain;
    });
    if(this.homeDialog.open&&this.controlsPage==='guide')this.renderGuide();
    this.renderPauseMoves();
  }
  setInputMode(mode:'keyboard'|'controller'|'touch',label='Controller',family:PadFamily='generic'){
    const was=this.inputMode,device=mode==='controller'?'controller':'keyboard';
    this.inputMode=device;this.controlDevice=device;this.padFamily=family;if(family!=='generic')this.controlFamily=family;this.root.dataset.input=mode;this.root.dataset.pad=family;
    if(!isCapturingBinding()&&this.homeDialog.open&&this.homeDialog.dataset.kind==='controls'){const device=(document.activeElement as HTMLElement)?.dataset.controlDevice;this.renderHomeControls();if(device)this.root.querySelector<HTMLElement>(`[data-control-device="${device}"]`)?.focus();}
    if(this.homeDialog.open&&this.homeDialog.dataset.kind==='controls'&&this.controlsPage==='guide')this.renderGuide();
    const pad=mode==='controller';
    this.refreshBindingHints();
    this.text('code-help',pad?`${label} · ${padName(family,'south')} edit code · D-pad digits · ${padName(family,'east')} done`:'Share your six-digit code. Up to 12 fighters.');
    if(pad)this.focusBy('pad');
    if(pad&&was!=='controller'&&(!this.menu.classList.contains('hidden')||this.settingsOpen)&&!this.focusables().includes(document.activeElement as HTMLElement))this.focusDefault();
  }
  focusBy(by:'pointer'|'keys'|'pad'){const html=document.documentElement;if(html.dataset.focusBy!==by)html.dataset.focusBy=by;}
  get homeVisible(){return !this.menu.classList.contains('hidden');}
  private nextStep(chosen:HTMLElement){
    if(!this.homeVisible||this.homeDialog.open||this.settingsOpen)return;
    const play=this.root.querySelector<HTMLButtonElement>('#home-play')!;
    if(chosen.matches('.home-fighter')&&!play.disabled)play.focus();
    else if(chosen.matches('.home-mode')&&isObjectiveKind(chosen.dataset.mode)&&!play.disabled)play.focus();
    else if(chosen.matches('.home-mode')&&chosen.dataset.mode!=='private')(this.focusables().find(el=>el.matches('.home-fighter[aria-pressed="true"]'))??this.focusables().find(el=>el.matches('.home-fighter')))?.focus();
  }
  private focusDefault(){
    if(this.objectives.blocking&&this.settingsPanel.classList.contains('hidden')){this.objectives.focus();return;}
    const items=this.focusables(),home=!this.homeDialog.open&&!this.settingsOpen&&!this.resultsOpen&&!this.privateWaiting;
    const preferred=home?items.find(el=>el.matches('[data-fighter][aria-pressed="true"]')):this.resultsOpen?items.find(el=>el.id==='results-again'):this.settingsOpen&&!this.homeDialog.open?items.find(el=>el.id==='resume'):undefined;
    (preferred??items[0])?.focus();
  }
  private focusables(){const container=this.homeDialog.open?this.homeDialog:this.settingsOpen?this.settingsPanel:this.resultsOpen?this.root.querySelector<HTMLElement>('#results')!:this.privateWaiting?this.root.querySelector<HTMLElement>('#private-status')!:this.menu;return [...container.querySelectorAll<HTMLElement>('button,input,select,summary')].filter(el=>el.getBoundingClientRect().width>0&&!(el as HTMLButtonElement).disabled&&el.id!=='player-name');}
  controllerAction(action:UiAction){
    if(isCapturingBinding())return;
    if(this.settingsPanel.classList.contains('hidden')&&this.objectives.controllerAction(action))return;
    if(this.introOpen){if(action==='confirm'||action==='back')this.skipIntro();return;}
    if(this.menu.classList.contains('hidden')&&!this.settingsOpen&&!this.privateWaiting&&!this.resultsOpen)return;
    const items=this.focusables();if(!items.length)return;let active=document.activeElement as HTMLElement;
    if(this.editingCode){const input=this.root.querySelector<HTMLInputElement>('#room-code')!;const digits=input.value.padEnd(6,'0').split('');if(action==='back'||action==='confirm'){this.editingCode=false;this.text('code-help',`Code ready · move to JOIN and press ${padName(this.padFamily,'south')}`);return;}if(action==='left'||action==='right')this.codeDigit=(this.codeDigit+(action==='right'?1:5))%6;else digits[this.codeDigit]=String((Number(digits[this.codeDigit])+(action==='next'?1:9))%10);input.value=digits.join('');input.setSelectionRange(this.codeDigit,this.codeDigit+1);return;}
    if(action==='back'){if(this.homeDialog.open){if(this.homeDialog.dataset.kind==='controls'&&this.controlsPage==='guide'){this.showControlsPage('layout');this.root.querySelector<HTMLElement>('#home-guide')!.focus();return;}if(this.homeDialog.dataset.kind==='controls'){this.returnToOptions();return;}this.homeDialog.close();this.editingCode=false;return;}if(this.settingsOpen)this.toggleSettings(false);else if(this.resultsOpen)this.onLeave();return;}
    if(!items.includes(active)){this.focusDefault();return;}
    if(action==='confirm'){if(active.id==='room-code'){this.editingCode=true;this.codeDigit=0;(active as HTMLInputElement).value=(active as HTMLInputElement).value.padEnd(6,'0');(active as HTMLInputElement).setSelectionRange(0,1);}else{active.click();this.nextStep(active);}return;}
    if((action==='left'||action==='right')&&active instanceof HTMLInputElement&&active.type==='range'){const sign=action==='right'?1:-1;active.value=String(Math.max(Number(active.min),Math.min(Number(active.max),Number(active.value)+sign*Number(active.step||.1))));active.dispatchEvent(new Event('input',{bubbles:true}));active.dispatchEvent(new Event('change',{bubbles:true}));return;}
    if((action==='left'||action==='right')&&active instanceof HTMLSelectElement){active.selectedIndex=Math.max(0,Math.min(active.options.length-1,active.selectedIndex+(action==='right'?1:-1)));active.dispatchEvent(new Event('change',{bubbles:true}));return;}
    if((action==='left'||action==='right')&&active.dataset.guidePick){this.guideFighter=HOME_ROSTER[(HOME_ROSTER.indexOf(this.guideFighter)+(action==='right'?1:-1)+HOME_ROSTER.length)%HOME_ROSTER.length];this.renderGuide();return;}
    if((action==='left'||action==='right')&&active.closest('.home-volumes')){stepHomeVolume(this.menu,action==='right'?1:-1);return;}
    const direction=({previous:'up',next:'down',left:'left',right:'right'} as Record<string,Direction>)[action];
    const to=nearest(active.getBoundingClientRect(),items.map(el=>el.getBoundingClientRect()),direction);
    if(to>=0)items[to].focus();
  }
  get resultsOpen(){return this.objectives.resultsOpen||!this.root.querySelector('#results')!.classList.contains('hidden');}
  targetMarker(x:number,y:number,visible:boolean,locked=false,info?:TargetMarkerInfo,fade=1){
    const now=performance.now()/1000,dt=this.glowAt?now-this.glowAt:0;this.glowAt=now;
    const glow=this.settings.lockStyle!=='brackets'&&locked&&!!info;
    const candidate=info?.threatBody??(info?.body as unknown as ThreatBody|undefined);
    const body=glow&&candidate?.threatInk?candidate:undefined;
    this.threatGlow.update(dt,body,!!this.reducedMotion?.matches);
    if(info){
      if(info.bot)info.name=FIGHTERS[info.fighter]?.name??info.name;
      if(body){info.glow=true;const level=this.threatGlow.state.level;if(level!==-1){info.threat=THREAT_NAMES[level];info.color=this.threatGlow.state.css;}}
    }
    (this.lockOn??=new LockOnView(this.root.querySelector<HTMLElement>('#target-marker')!,this.settings)).update(x,y,visible,locked,info,fade);
  }
  private results(snapshot:GameSnapshot,self:PlayerState,show:boolean){
    const panel=this.root.querySelector<HTMLElement>('#results')!;
    const opening=panel.classList.contains('hidden');
    if(!show){if(!opening)panel.classList.add('hidden');this.resultsKey='';return;}
    const key=snapshot.players.map(p=>`${p.id}:${p.alive?1:0}:${p.kills??0}:${p.damageDealt??0}:${p.damageTaken??0}`).join('|')+'#'+snapshot.winnerId+'#'+this.fallen.join(',')+'#'+JSON.stringify(snapshot.duel)+(this.roomGone?'#gone':'');
    if(opening)panel.classList.remove('hidden');
    if(key===this.resultsKey)return;this.resultsKey=key;
    const expanded=panel.querySelector<HTMLDetailsElement>('details')?.open??false,focus=(document.activeElement as HTMLElement)?.id;
    panel.innerHTML=matchResults(snapshot,self,this.fallen,this.resultAgainLabel,this.roomGone);
    panel.querySelector<HTMLDetailsElement>('details')!.open=expanded;
    if(opening){document.exitPointerLock?.();this.onResults();panel.querySelector<HTMLButtonElement>('#results-again')!.focus({preventScroll:true});}
    else if(focus)panel.querySelector<HTMLElement>('#'+CSS.escape(focus))?.focus({preventScroll:true});
  }

  notify(text:string,duration=1.3){if(quietNotice(text,!!this.lockOn?.live&&!this.privateWaiting))return;this.objectives.notice(text);this.text('action-message',text);this.noticeTimer=performance.now()+duration*1000;}
  tick(){if(this.noticeTimer&&performance.now()>this.noticeTimer){this.text('action-message','');this.noticeTimer=0;}}
  link(text:string|undefined){
    const e=this.root.querySelector<HTMLElement>('#link-note');if(!e)return;
    const show=!!text&&this.root.querySelector('#connection-note')!.classList.contains('hidden');
    if(show&&e.textContent!==text)e.textContent=text!;
    e.classList.toggle('hidden',!show);
  }
  perf(text:string,show:boolean){const e=this.perfLine??=this.root.querySelector<HTMLElement>('#perf')!;if(!show){if(!e.classList.contains('hidden'))e.classList.add('hidden');return;}if(e.textContent!==text)e.textContent=text;e.classList.remove('hidden');}
  private perfLine?:HTMLElement;
  error(message:string){this.objectives.error(message);this.loading(message,0);this.text('load-label',message);this.menu.classList.remove('hidden');this.root.querySelector('.combat-hud')!.classList.add('hidden');this.busy(false);}
  banner(message:string){
    let el=this.menu.querySelector<HTMLElement>('.home-banner');
    if(!el&&!message)return;
    if(!el){el=document.createElement('div');el.className='home-banner';el.setAttribute('role','alert');el.innerHTML='<p></p><button type="button" data-focus="banner-close" aria-label="Dismiss">✕</button>';el.querySelector('button')!.onclick=()=>this.banner('');this.menu.prepend(el);}
    el.querySelector('p')!.textContent=message;el.hidden=!message;
  }
  private text(id:string,value:string){const el=this.root.querySelector('#'+id)!;if(el.textContent!==value)el.textContent=value;}
}
