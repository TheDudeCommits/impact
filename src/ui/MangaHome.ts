import type { FighterId } from '../game/types';
import { FIGHTERS } from '../config';
import { mediaArt } from './mediaArt';
import { LABORATORY_FIGHTERS, RELEASED_FIGHTERS, isReleasedFighter } from '../game/rosterAvailability';
import { isLaboratoryPreviewFighter } from '../fighterLab';
import { spriteArt, posePoster, hasPoseSheet } from './HomePreview';
import spriteManifest from '../../public/assets/home/sprites/manifest.json';
import { volumeWindow } from './HomeVolumes';
import { homeRosterPages, homeAnimeOptions, homeWipStamp, homeWing, type HomeRosterPage } from './HomeRosterOrder';
import upcomingArt from '../../public/assets/home/upcoming/manifest.json';
import { MODES, MODE_OF_HOME, VARIANT_ORDER } from './modes/catalogue';
import '../engine/packs/boot';
import { activePackRoster, packArt } from '../engine/packs/active';

export type HomeMode = 'duel' | 'players' | 'bots' | 'private' | 'training' | 'arcade' | 'bad-blood' | 'last-stand' | 'rift-war';
export const HOME_MODES: readonly { id: HomeMode; label: string }[] = [
  {id:'duel',label:'Duel'}, {id:'players',label:'BR vs Players'}, {id:'bots',label:'Battle Royale'},
  {id:'private',label:'Private Room'}, {id:'training',label:'Training Ground'},
  {id:'arcade',label:'Arcade Survival'}, {id:'last-stand',label:'Last Stand'}, {id:'bad-blood',label:'Bad Blood'}, {id:'rift-war',label:'Rift War'},
];
export const HOME_RAIL: readonly HomeMode[] = ['duel','bots','training','arcade','last-stand','bad-blood','rift-war'];
function variantWords(id:HomeMode){
  const mode=MODE_OF_HOME[id].mode,info=MODES[mode];
  const legacy:Partial<Record<string,string>>={'bots:friends':' id="choose-host"','arcade:offline':' id="choose-solo" aria-pressed="true"','arcade:friends':' id="choose-coop" aria-pressed="false"','duel:offline':' data-duel="bot" aria-pressed="false"','duel:online':' data-duel="online" aria-pressed="true"','duel:friends':' data-duel="friend" aria-pressed="false"'};
  const words=VARIANT_ORDER.filter(v=>info.variants[v]).map(v=>`<button type="button" data-variant="${v}" data-variant-mode="${mode}"${legacy[`${id}:${v}`]??''} aria-label="${info.name} · ${info.variants[v]!.label}">${info.variants[v]!.card}</button>`);
  return `<div class="home-private-actions home-variants" role="group" aria-label="Ways to play ${info.name}">${words.join('<span aria-hidden="true">/</span>')}${id==='bots'?'<button type="button" id="choose-join" hidden tabindex="-1">JOIN</button>':''}</div>`;
}
export const HOME_FIGHTERS: readonly FighterId[] = [
  'goku','naruto','luffy','zoro','sanji','vegeta','kakashi','sasuke',
  'jotaro','ichigo','ace','law','gojo','dio','guts','killua',
];
export const HOME_FIGHTERS_2: readonly FighterId[] = ['kaido','whitebeard','shanks','roger','aizen','sukuna','griffith','meruem','goku-black','jiren','golden-frieza','gohan-beast','saitama','akaza','itachi','madara','tanjiro','levi','sung-jinwoo','gon'];
export const HOME_ROSTER: readonly FighterId[] = activePackRoster()?.filter(id => isReleasedFighter(id) || isLaboratoryPreviewFighter(id)) ?? [...RELEASED_FIGHTERS,
  ...(import.meta.env?.MODE === 'fighter-lab' ? LABORATORY_FIGHTERS : [])];
export const HOME_PAGES = homeRosterPages(HOME_ROSTER);
export const HOME_VOLUMES = HOME_PAGES.map(page=>page.fighters);
export const homeVolumeOf = (id:FighterId) => Math.max(0,HOME_VOLUMES.findIndex(page=>page.includes(id)))+1;
export const fighterArt = (id:FighterId) => mediaArt(`/assets/home/fighters/${id}.webp`);
const portraitArt = (id:FighterId) => packArt(id,'portrait') ?? mediaArt(`/assets/home/portraits/${id}.webp`);
export const HOME_ASSETS = [
  ...upcomingArt.fighters.flatMap(fighter=>Object.values(fighter.assets)),
  '/assets/home/upcoming/index.html', '/assets/home/upcoming/manifest.json',
  '/assets/home/upcoming/README.md', '/assets/home/upcoming/production.json',
  ...HOME_MODES.map(m=>`/assets/home/modes/${m.id}.webp`),
  ...HOME_ROSTER.map(fighterArt),
  ...HOME_ROSTER.filter(hasPoseSheet).map(spriteArt), ...HOME_FIGHTERS.map(posePoster), '/assets/home/sprites/manifest.json',
  ...spriteManifest.fighters.filter(fighter=>HOME_ROSTER.includes(fighter.id as FighterId)).flatMap(fighter=>
    ('runtimePages' in fighter ? fighter.runtimePages as {file:string}[] : []).map(page=>`/assets/home/sprites/${page.file}`)),
  ...HOME_ROSTER.filter(id=>!HOME_FIGHTERS.includes(id)).flatMap(id=>[portraitArt(id),posePoster(id)]),
  '/assets/home/manga-faces.webp',
  '/assets/home/fonts/electroharmonix.otf',
  '/assets/home/fonts/LICENSE.txt', '/assets/home/manifest.json',
];

const PORTRAIT_WINDOWS: Partial<Record<FighterId,string>> = {
  goku:'20 541 145 166', naruto:'192 546 128 158', luffy:'342 541 141 166', zoro:'524 541 138 166',
  sanji:'20 748 130 156', vegeta:'171 748 142 156', kakashi:'340 748 141 156', sasuke:'512 748 130 156',
  jotaro:'918 541 146 166', ichigo:'1085 541 151 166', ace:'1262 541 139 166', law:'1420 541 148 166',
  gojo:'945 748 131 154', dio:'1100 748 149 156', guts:'1269 748 138 156', killua:'1426 748 142 156',
};
export const mangaPortrait = (id:FighterId, deferred=false) => { const href=deferred?'data-href':'href'; return PORTRAIT_WINDOWS[id] && !packArt(id,'portrait')
  ? `<svg viewBox="${PORTRAIT_WINDOWS[id]}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><image ${href}="/assets/home/manga-faces.webp" width="1586" height="992"/></svg>`
  : `<svg viewBox="0 0 100 100" preserveAspectRatio="${id==='escanor'?'xMidYMin':'xMidYMid'} slice" aria-hidden="true"><image ${href}="${portraitArt(id)}" width="100" height="100"/></svg>`; };
export const fighterCaption = (id:FighterId) => { const name=FIGHTERS[id]?.name??id, first=name.split(' ')[0]; return (first.toLowerCase()===id?first:name).toUpperCase(); };
const portrait = (id:FighterId, selected:FighterId, index:number, deferred=false) => `
  <button type="button" class="home-fighter" data-fighter="${id}" data-wing="${homeWing(id)}" aria-label="${(FIGHTERS[id]?.name??id).toUpperCase()}" aria-pressed="${id===selected}" style="--tilt:${index%4===3?-3:index%4===0?1:0}deg">
    <span class="home-face">${mangaPortrait(id,deferred)}</span>
    <span class="home-selection-name">${fighterCaption(id)}</span>
    ${homeWipStamp(id)?'<span class="home-wip" title="Work in progress">WIP</span>':''}
    ${isLaboratoryPreviewFighter(id)?'<span class="home-lab-badge">PREVIEW</span>':''}
  </button>`;

function volumeWings(page:HomeRosterPage, selected:FighterId, deferred=false) {
  const wing=(ids:readonly FighterId[],side:string)=>`<div class="home-wing home-wing-${side}" role="group" aria-label="Fighters on the ${side}" style="--home-roster-mobile-rows:${Math.max(1,Math.ceil(page.left.length/2))}">${ids.map((id,i)=>portrait(id,selected,i,deferred)).join('')}${ids.length<page.left.length?'<span class="home-empty-slot" aria-hidden="true"></span>':''}</div>`;
  return wing(page.left,'left')+wing(page.right,'right');
}

export function mangaHome(selected:FighterId, botPlayers:number) {
  const volume=homeVolumeOf(selected), shown=volumeWindow(volume,HOME_VOLUMES.length);
  return `<section class="lobby manga-home" aria-label="Fighter selection">
    <div class="manga-page">
      <div class="home-mode-rail"><div class="home-modes" role="group" aria-label="Choose game mode">
        ${HOME_MODES.filter(mode=>HOME_RAIL.includes(mode.id)).map((mode,i)=>`<div class="home-mode-panel" data-panel="${mode.id}" style="--tilt:${i===0?-2:i===1?1:i===2?-1.5:i===3?-2:0}deg">
          <button type="button" class="home-mode" data-mode="${mode.id}" aria-pressed="${mode.id==='bots'}" aria-label="${mode.label}">
            <span class="home-mode-art"><img src="/assets/home/modes/${MODES[MODE_OF_HOME[mode.id].mode].art}.webp" alt="" draggable="false" fetchpriority="high"></span>
            <span class="home-mode-label">${mode.label.toUpperCase()}</span>
          </button>
          ${variantWords(mode.id)}
        </div>`).join('')}
      </div><div class="home-mode-position" aria-hidden="true"><i></i></div></div>
      <div class="home-heading"><h1 class="home-heading-title">SELECT YOUR FIGHTER</h1><div class="home-roster-controls"><nav class="home-volumes" aria-label="Roster volume">
        <button type="button" data-volume-step="-1" aria-label="Previous roster volume"${volume===1?' disabled':''}>‹</button>
        ${HOME_VOLUMES.map((ids,i)=>`<button type="button" data-volume-tab="${i+1}" aria-pressed="${i+1===volume}" aria-controls="home-volume-${i+1}" aria-label="Volume ${i+1}, ${ids.length} fighters"${shown.includes(i+1)?'':' hidden'}>VOL.${i+1}</button>`).join('')}
        <button type="button" data-volume-step="1" aria-label="Next roster volume"${volume===HOME_VOLUMES.length?' disabled':''}>›</button>
      </nav><ink-select class="home-anime-filter" data-home-anime label="Filter anime" title="Filter anime"><option value="" selected>All anime (${HOME_ROSTER.length})</option>${homeAnimeOptions(HOME_ROSTER).map(anime=>`<option value="${anime.id}">${anime.label}</option>`).join('')}</ink-select></div></div>
      <div class="home-lower">
        <div class="home-roster" role="group" aria-label="Select your fighter">
          ${HOME_PAGES.map((page,i)=>`<div class="home-volume" id="home-volume-${i+1}" data-volume="${i+1}" role="group" aria-label="Volume ${i+1}"${i+1===volume?'':' hidden'}>${volumeWings(page,selected,i+1!==volume)}</div>`).join('')}
          <div class="home-filtered-fighters" hidden></div>
        </div>
        <figure class="home-preview" aria-label="Fighter preview">
          ${HOME_ROSTER.map(id=>`<img data-preview="${id}" ${id===selected?'src':'data-preview-src'}="${posePoster(id)}" alt="${FIGHTERS[id]?.name??id} full-body manga illustration" draggable="false" decoding="async" ${id===selected?'fetchpriority="high"':'loading="lazy" hidden'}>`).join('')}
        </figure>
        <nav class="home-actions" aria-label="Main menu">
          <button type="button" id="home-party" aria-haspopup="dialog">PARTY</button>
          <button type="button" id="home-options" aria-haspopup="dialog">OPTIONS</button>
          <button type="button" id="home-play" class="home-play" aria-label="Play BR vs Bots as Naruto" disabled><span>PLAY</span></button>
        </nav>
      </div>
    </div>
    <div class="home-loading" id="home-loading"><span id="load-label" role="status" aria-live="polite">Loading Fighters</span><button type="button" id="load-retry" hidden>Retry</button><span id="load-status" hidden>Preparing arena…</span><small id="load-stages" hidden></small><progress id="load-progress" hidden max="100" value="0"></progress></div>
    <dialog class="home-dialog" id="home-dialog" aria-labelledby="home-dialog-title">
      <button type="button" id="home-dialog-close" aria-label="Close dialog">×</button>
      <h2 id="home-dialog-title">PRIVATE ROOM</h2>
      <div id="home-private-fields"><p id="invite-preview" class="invite-preview" hidden></p><label for="player-name">YOUR NAME</label><input id="player-name" maxlength="18" placeholder="Fighter" value="Fighter" autocomplete="nickname"><div class="home-room-size" id="home-room-size" role="group" aria-label="Fighters in the room"><span>FIGHTERS</span>${[2,4,8,12].map(n=>`<button type="button" data-room-size="${n}" aria-pressed="${n===8}" aria-label="${n===2?'One versus one':`${n} fighters`}">${n===2?'1V1':n}</button>`).join('')}</div><div class="home-room-tabs"><button type="button" id="create-private">HOST ROOM</button><button type="button" id="join-private-tab">JOIN ROOM</button><button type="button" id="quick-coop" hidden>QUICK MATCH</button></div><form id="home-join-form"><label for="room-code">SIX-DIGIT ROOM CODE</label><input id="room-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="000000" autocomplete="off" aria-describedby="code-help home-dialog-status" required><button id="join-private" type="submit">JOIN ROOM</button></form><small id="code-help">Share your six-digit code. Seats your friends leave empty are filled with bots.</small></div>
      <p id="home-arcade-note" hidden>Arcade Survival: one fighter against an endless horde, wave after wave.</p>
      <p id="home-coop-note" hidden>Up to four fighters in one run. The horde grows with the party; fall, and a friend can pick you back up.</p>
      <div id="home-options-fields" hidden></div>
      <div id="home-controls-fields" hidden><button type="button" class="home-options-back" data-options-back>← OPTIONS</button><nav class="controls-pages" aria-label="Controls sections"><button type="button" data-controls-page="layout" aria-pressed="true">THE CONTROLS</button><button type="button" id="home-guide" data-controls-page="guide" aria-pressed="false">FIGHTER GUIDE</button></nav><div id="home-control-layout"></div><div id="home-guide-fields" hidden></div></div>
      <p id="home-dialog-status" role="status" aria-live="polite"></p>
    </dialog>
  </section>`;
}
