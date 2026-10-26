import { FIGHTERS } from '../config';
import { AWAKENINGS, AWAKENED_MOVES, AWAKENING_COST, AWAKENING_SECONDS, moveFor } from '../game/awakening';
import { ULTIMATE_COST, type MoveDefinition } from '../game/moves';
import { ITEMS, priceOf } from '../game/economy/catalog';
import { CURRENCY, EARNED_LINE } from '../game/economy/currency';
import type { AttackSlot, FighterId } from '../game/types';
import type { PadFamily } from '../input/gamepad';
import { actionKey } from '../input/glyphs';
import { keyNames, type CombatAction } from '../input/bindings';
import { homeVolumeOf, HOME_ROSTER, mangaPortrait } from './MangaHome';
import { moveSheetOf, moveSheetUrl } from './moveSheet';
import type { ControlDevice } from './HomeControls';
import { commandList } from './commandList';

const escape = (value:string) => value.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const slots:readonly AttackSlot[] = ['light','heavy','special','ultimate'];
const styleName = {melee:'Close combat',beam:'Beam attack',projectile:'Ranged attack',bomb:'Area blast',field:'Area control'};
function moveDescription(move:MoveDefinition) {
  const details=[styleName[move.style]];
  if(move.guardBreak)details.push('Breaks guard');
  if(move.timeStop)details.push('Stops time');
  if(move.close)details.push('Closes distance');
  if(move.contacts.length>1)details.push('Multiple hits');
  return details.join(' · ');
}

export function homeFighterGuide(id:FighterId, device:ControlDevice, family:PadFamily, busy:boolean) {
  const fighter=FIGHTERS[id], awakening=AWAKENINGS[id];
  const item=ITEMS.find(item=>item.kind==='fighter'&&item.fighter===id);
  const unlock=item?`${item.level?`Free at level ${item.level} · or `:''}Account · ${priceOf(item).toLocaleString('en-US')} ${CURRENCY.name}`:'VOL.1 · Free to play';
  const binding=(action:CombatAction)=>device==='controller'?actionKey(action,family):`<kbd>${escape(keyNames(action))}</kbd>`;
  const cards=(awakened:boolean,shown:readonly AttackSlot[])=>shown.map(slot=>{
    const i=slots.indexOf(slot),move=moveFor(id,slot,awakened);
    return `<article class="guide-move"><div class="guide-art" style="--guide-art-x:${i*25}%" role="img" aria-label="${escape(move.name)} illustration"></div><div class="guide-move-copy"><div class="guide-move-slot"><small>${slot.toUpperCase()}</small>${binding(slot)}</div><h4>${escape(move.name)}</h4><p>${moveDescription(move)}</p><dl><div><dt>Cooldown</dt><dd>${move.cooldown}s</dd></div><div><dt>${slot==='ultimate'?'Meter':'Stamina'}</dt><dd>${slot==='ultimate'?ULTIMATE_COST:move.stamina}</dd></div></dl></div></article>`;
  }).join('');
  const area=moveFor(id,'area',false);
  const areaCard=`<article class="guide-move guide-area"><div class="guide-art" role="img" aria-label="Area reticle"></div><div class="guide-move-copy"><div class="guide-move-slot"><small>AREA</small>${binding('area')}</div><h4>${escape(area.name)}</h4><p>${moveDescription(area)} · Hold to place the circle, let go to cast</p><dl><div><dt>Cooldown</dt><dd>${area.cooldown}s</dd></div><div><dt>Stamina</dt><dd>${area.stamina}</dd></div></dl></div></article>`;
  const changed=moveSheetOf(id,true)!==id?[...slots]:slots.filter(slot=>moveFor(id,slot,true).name!==moveFor(id,slot,false).name);
  const boosted=Object.keys(AWAKENED_MOVES[id]??{}).filter(slot=>!changed.includes(slot as AttackSlot));
  return `<div class="fighter-guide" data-guide-fighter="${id}">
    <div class="guide-browser" aria-label="Fighter carousel"><button type="button" data-guide-step="-1" aria-label="Previous fighter">←</button><div class="guide-carousel" role="group" aria-label="Choose a fighter">${HOME_ROSTER.map((key,i)=>`<button type="button" data-guide-pick="${key}" class="guide-portrait" aria-label="${escape(FIGHTERS[key].name)}" aria-pressed="${key===id}" tabindex="${key===id?0:-1}"><span class="guide-portrait-art">${mangaPortrait(key)}</span><span class="guide-portrait-name">${escape(FIGHTERS[key].name)}</span><small>VOL.${homeVolumeOf(key)} · ${String(i+1).padStart(2,'0')}</small></button>`).join('')}</div><button type="button" data-guide-step="1" aria-label="Next fighter">→</button></div>
    <div class="guide-profile"><div><p class="guide-series">${escape(fighter.series)}</p><h3>${escape(fighter.name)}</h3></div><p class="guide-unlock">${escape(unlock)}${item?`<small class="guide-earned">${escape(EARNED_LINE)}</small>`:''}</p></div>
    <div class="guide-moves" style="--guide-sheet:url('${moveSheetUrl(id)}')">${cards(false,slots)}${areaCard}<article class="guide-move guide-awakening"><div class="guide-art" style="--guide-art-x:100%" role="img" aria-label="${escape(awakening.name)} illustration"></div><div class="guide-move-copy"><div class="guide-move-slot"><small>AWAKENING</small>${binding('awaken')}</div><h4>${escape(awakening.name)}</h4><p>${AWAKENING_COST} meter · ${AWAKENING_SECONDS}s duration. Charge by taking damage or guarding.${boosted.length?' Enhances '+boosted.join(' / ')+' while active.':''}</p></div></article></div>
    ${changed.length?`<h4 class="guide-form-heading">${escape(awakening.name)} TECHNIQUES</h4><div class="guide-moves guide-form-moves" style="--guide-sheet:url('${moveSheetUrl(moveSheetOf(id,true))}')">${cards(true,changed)}</div>`:''}
    <h4 class="guide-form-heading">COMMAND LIST</h4>${commandList(id,device,family)}
    <div class="guide-actions"><button type="button" id="guide-select">SELECT FIGHTER</button><button type="button" id="guide-training"${busy?' disabled':''}>${busy?'LOADING FIGHTERS…':'TRY IN TRAINING'}</button></div>
  </div>`;
}
