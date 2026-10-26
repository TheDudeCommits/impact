import type { FighterId } from '../game/types';
import { homeRosterPages, homeSeries } from './HomeRosterOrder';

export const HOME_VOLUME_SIZE = 16;
export function rosterVolumes<T>(roster: readonly T[]): readonly (readonly T[])[] {
  return Array.from({ length: Math.ceil(roster.length / HOME_VOLUME_SIZE) }, (_, i) =>
    roster.slice(i * HOME_VOLUME_SIZE, (i + 1) * HOME_VOLUME_SIZE));
}
export function rosterVolume<T>(roster: readonly T[], fighter: T): number {
  return Math.floor(Math.max(0, roster.indexOf(fighter)) / HOME_VOLUME_SIZE) + 1;
}
export function volumeWindow(current: number, count: number): number[] {
  const start = Math.max(1, Math.min(current - 1, count - 2));
  return Array.from({ length: Math.min(3, count) }, (_, i) => start + i);
}

export function showPortraits(scope: ParentNode) {
  for (const image of scope.querySelectorAll<SVGImageElement>('image[data-href]')) { image.setAttribute('href', image.getAttribute('data-href')!); image.removeAttribute('data-href'); }
}
const whenIdle = (work: () => void) => { const idle = (globalThis as { requestIdleCallback?: (go: () => void, options?: { timeout: number }) => number }).requestIdleCallback; if (idle) idle(work, { timeout: 3000 }); else setTimeout(work, 400); };
function readyNeighbours(lobby: HTMLElement, pages: HTMLElement[], at: number) {
  whenIdle(() => { for (const page of pages) if (Math.abs(pages.indexOf(page) - at) === 1 && page.isConnected && page.closest('.lobby') === lobby) showPortraits(page); });
}

export function showHomeVolume(lobby: HTMLElement, volume: number, focus = false) {
  const pages = [...lobby.querySelectorAll<HTMLElement>('.home-volume')].filter(page=>page.dataset.active!=='false');
  const page = pages.find(page => Number(page.dataset.volume) === volume);
  if (!page) return;
  const displaced = pages.some(item => item !== page && item.contains(document.activeElement));
  for (const item of pages) item.hidden = item !== page;
  showPortraits(page); readyNeighbours(lobby, pages, pages.indexOf(page));
  const visible = volumeWindow(volume, pages.length);
  for (const tab of lobby.querySelectorAll<HTMLButtonElement>('[data-volume-tab]')) {
    const value = Number(tab.dataset.volumeTab);
    tab.hidden = !visible.includes(value);
    tab.setAttribute('aria-pressed', String(value === volume));
    if (value === volume && (focus || displaced)) { tab.focus({ preventScroll: true }); tab.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  for (const step of lobby.querySelectorAll<HTMLButtonElement>('[data-volume-step]')) {
    step.hidden = pages.length<=3;
    step.disabled = Number(step.dataset.volumeStep) < 0 ? volume === 1 : volume === pages.length;
  }
}

export function stepHomeVolume(lobby: HTMLElement, direction: number) {
  const current = lobby.querySelector<HTMLElement>('[data-volume-tab][aria-pressed="true"]');
  showHomeVolume(lobby, Number(current?.dataset.volumeTab ?? 1) + direction, true);
}

type AnimePicker = HTMLElement & { value:string };
export function filterHomeRoster(lobby:HTMLElement,anime:string,selected?:FighterId) {
  const buttons=[...lobby.querySelectorAll<HTMLButtonElement>('.home-fighter[data-fighter]')];
  const byId=new Map(buttons.map(button=>[button.dataset.fighter as FighterId,button]));
  const pages=homeRosterPages([...byId.keys()].filter(id=>!anime||homeSeries(id)===anime));
  const storage=lobby.querySelector<HTMLElement>('.home-filtered-fighters')!;
  const oldFocus=buttons.find(button=>button===document.activeElement);
  for(const button of buttons)storage.append(button);
  const containers=[...lobby.querySelectorAll<HTMLElement>('.home-volume')];
  containers.forEach((container,i)=>{
    const page=pages[i];container.dataset.active=String(!!page);container.hidden=true;
    if(!page)return;
    for(const [side,ids] of [['left',page.left],['right',page.right]] as const){
      const wing=container.querySelector<HTMLElement>(`.home-wing-${side}`)!;
      wing.querySelectorAll('.home-empty-slot').forEach(slot=>slot.remove());
      wing.hidden=false;
      wing.style.setProperty('--home-roster-mobile-rows',String(Math.max(1,Math.ceil(page.left.length/2))));
      for(const id of ids)wing.append(byId.get(id)!);
      if(ids.length<page.left.length)wing.insertAdjacentHTML('beforeend','<span class="home-empty-slot" aria-hidden="true"></span>');
    }
    lobby.querySelector(`[data-volume-tab="${i+1}"]`)?.setAttribute('aria-label',`Volume ${i+1}, ${page.fighters.length} fighters`);
  });
  const picker=lobby.querySelector<AnimePicker>('[data-home-anime]');
  if(picker){picker.value=anime;picker.classList.toggle('is-filtered',!!anime);picker.title=anime?`Filter anime: ${anime}`:'Filter anime';}
  const volume=selected?Math.max(0,pages.findIndex(page=>page.fighters.includes(selected)))+1:1;
  showHomeVolume(lobby,volume);
  if(oldFocus)picker?.focus({preventScroll:true});
}
export function revealHomeFighter(lobby:HTMLElement,fighter:FighterId) {
  const button=lobby.querySelector<HTMLButtonElement>(`.home-fighter[data-fighter="${fighter}"]`);
  if(!button)return;
  if(button.closest('.home-filtered-fighters'))filterHomeRoster(lobby,'',fighter);
  const volume=Number(button.closest<HTMLElement>('[data-volume]')?.dataset.volume);
  if(volume)showHomeVolume(lobby,volume);
}

export function bindHomeVolumes(lobby: HTMLElement) {
  { const shown = [...lobby.querySelectorAll<HTMLElement>('.home-volume')], at = shown.findIndex(page => !page.hidden);
    const go = () => readyNeighbours(lobby, shown, at);
    if (document.readyState === 'complete') go(); else { let done = false; const once = () => { if (!done) { done = true; go(); } }; window.addEventListener('load', once, { once: true }); setTimeout(once, 4000); } }
  lobby.querySelector('[data-home-anime]')?.addEventListener('change',event=>{
    const anime=(event.currentTarget as AnimePicker).value;
    const selected=!anime?lobby.querySelector<HTMLElement>('.home-fighter[aria-pressed="true"]')?.dataset.fighter as FighterId:undefined;
    filterHomeRoster(lobby,anime,selected);
  });
  for (const tab of lobby.querySelectorAll<HTMLButtonElement>('[data-volume-tab]')) {
    tab.onclick = () => showHomeVolume(lobby, Number(tab.dataset.volumeTab));
  }
  for (const step of lobby.querySelectorAll<HTMLButtonElement>('[data-volume-step]')) {
    step.onclick = () => stepHomeVolume(lobby, Number(step.dataset.volumeStep));
  }
  lobby.querySelector('.home-volumes')?.addEventListener('keydown', event => {
    const e = event as KeyboardEvent;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Home' || e.key === 'End') showHomeVolume(lobby, e.key === 'Home' ? 1 : lobby.querySelectorAll('.home-volume:not([data-active="false"])').length, true);
    else stepHomeVolume(lobby, e.key === 'ArrowRight' ? 1 : -1);
  });
}
