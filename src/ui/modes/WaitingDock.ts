import { MIN_MATCH_FIELD, MAX_PLAYERS } from '../../game/moves';
import type { UiAction } from '../../input/gamepad';
import type { ModeHudFrame, HudLayoutId } from '../hud/modeHud';
import { promptKey } from '../prompts';
import { nearest, type Direction } from '../spatialFocus';
import './waitingDock.css';

const LOADING_ROOM = "LOADING EVERYONE'S FIGHTERS…";
export const BOT_OFFER_SECONDS = 30;
const time = (seconds: number) => { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function dockText(frame: ModeHudFrame, waitedSeconds: number, offerAt = BOT_OFFER_SECONDS): { title: string; detail: string; cancel?: string; bot?: string } | undefined {
  if(frame.snapshot.duel?.phase==='interval'){
    const d=frame.snapshot.duel,own=d.scores[frame.self.id]??0,rival=frame.snapshot.players.find(p=>p.id!==frame.self.id),other=d.scores[rival?.id??'']??0;
    return {title:d.round===1?'RUNBACK · FIRST TO TWO':`ROUND ${d.round} · ${own}–${other}`,detail:`GET READY · ${Math.max(0,Math.ceil((d.nextRoundAt??0)-frame.snapshot.serverTime))}s`};
  }
  const { snapshot, self } = frame, lobby = snapshot.lobby;
  if (frame.phase !== 'waiting' || !lobby || snapshot.roomMode !== 'match') return undefined;
  const others = snapshot.players.filter(p => p.id !== self.id), humans = 1 + others.filter(p => !p.isBot).length;
  const left = lobby.startsAt !== null ? Math.max(0, Math.ceil(lobby.startsAt - snapshot.serverTime)) : null;
  const loading = left === 0;
  if (lobby.visibility === 'private') {
    const size = lobby.duel ? 2 : lobby.size ?? MAX_PLAYERS, bots = lobby.duel ? 0 : Math.max(0, size - snapshot.players.length);
    const own = lobby.hostId === self.id;
    return { title: lobby.party ? (lobby.duel ? 'PARTY DUEL' : 'PARTY MATCH') : `${lobby.duel ? 'DUEL ROOM' : own ? 'YOUR ROOM' : 'PRIVATE ROOM'} · ${lobby.code ?? ''}`, detail: loading ? LOADING_ROOM : left !== null ? `STARTING IN ${left}s` : `${snapshot.players.length} / ${size} JOINED${bots ? ` · ${bots} BOT${bots === 1 ? '' : 'S'} AT START` : ''}` };
  }
  if (lobby.duel) return snapshot.players.length < 2
    ? waitedSeconds >= offerAt
      ? { title: `FINDING AN OPPONENT · ${time(waitedSeconds)}`, detail: "NOBODY'S QUEUED · TRY A BOT ON THIS DEVICE?", bot: 'FIGHT A BOT', cancel: 'CANCEL' }
      : { title: `FINDING AN OPPONENT · ${time(waitedSeconds)}`, detail: 'REAL PLAYERS ONLY · NEVER A BOT', cancel: 'CANCEL' }
    : { title: others.every(p => p.isBot) ? 'YOUR BOT RIVAL' : 'OPPONENT FOUND', detail: left !== null && !loading ? `GET READY · ${left}s` : 'LOADING THE ARENA', cancel: undefined };
  if (others.length && humans === 1 && others.every(p => p.isBot)) return { title: 'GET READY', detail: left !== null && !loading ? `THE FIGHT STARTS IN ${left}s` : 'LOADING THE ARENA' };
  const fill = Math.max(0, MIN_MATCH_FIELD - snapshot.players.length);
  if (loading) return { title: 'GET READY', detail: LOADING_ROOM };
  return { title: `FINDING PLAYERS · ${time(waitedSeconds)}`, detail: `${humans} / ${MAX_PLAYERS} JOINED${left !== null ? ` · ${fill ? `BOTS FILL TO ${MIN_MATCH_FIELD} IN ${left}s` : `STARTING IN ${left}s`}` : ''}`, cancel: 'CANCEL' };
}

export class WaitingDock {
  private readonly el = document.createElement('div');
  private since = 0;
  private shown = '';
  private offerAt = BOT_OFFER_SECONDS;
  private waited = 0;
  private offering = false;
  private offeredAt = 0;
  constructor(private readonly root: HTMLElement, private readonly leave: () => void, private readonly fightBot: () => void = () => {}) {
    this.el.className = 'waiting-dock hidden';
    this.el.setAttribute('role', 'status');
    this.el.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-dock-cancel]')) this.leave();
      else if (target.closest('[data-dock-bot]')) this.fightBot();
    });
  }
  frame(frame: ModeHudFrame, layout: HudLayoutId) {
    if (!this.el.isConnected) this.root.querySelector('.combat-hud')?.append(this.el);
    const waiting = (layout === 'royale' || layout === 'duel') && frame.phase === 'waiting' && frame.snapshot.duel?.phase !== 'interval';
    if (!waiting) { this.since = 0; this.hide(); return; }
    if (!this.since) this.since = frame.now;
    this.waited = (frame.now - this.since) / 1000;
    const text = dockText(frame, this.waited, this.offerAt);
    if (!text) { this.hide(); return; }
    if (!!text.bot !== this.offering) { this.offering = !!text.bot; this.offeredAt = frame.now; }
    const pad = this.offering && this.root.dataset.input === 'controller' ? `<small class="dock-pad">${promptKey('confirm')} CHOOSE · ${promptKey('back')} KEEP WAITING</small>` : '';
    const buttons = `${this.offering ? '<i class="dock-break"></i>' : ''}${pad}${text.bot ? `<button type="button" data-dock-bot data-focus="dock-bot">${text.bot}</button>` : ''}${text.cancel ? `<button type="button" data-dock-cancel data-focus="dock-cancel">${text.cancel}</button>` : ''}`;
    if (buttons !== this.shown || !this.el.firstChild) {
      const focus = this.el.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : undefined;
      this.shown = buttons; this.el.innerHTML = `<strong></strong><span></span>${buttons}`;
      if (focus) this.el.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus({ preventScroll: true });
    }
    const title = this.el.querySelector('strong')!, detail = this.el.querySelector('span')!;
    if (title.textContent !== text.title) title.textContent = text.title;
    if (detail.textContent !== text.detail) detail.textContent = text.detail;
    const hint = this.root.querySelector<HTMLElement>('#private-hint');
    if (hint && text.detail === LOADING_ROOM && hint.textContent !== LOADING_ROOM && /STARTING IN 0s/.test(hint.textContent ?? '')) hint.textContent = LOADING_ROOM;
    this.el.classList.remove('hidden'); this.root.dataset.waiting = '';
  }
  controller(action: UiAction): boolean {
    if (!this.padChoice) return false;
    if (performance.now() - this.offeredAt < 1000) return true;
    const buttons = [...this.el.querySelectorAll<HTMLElement>('button')], active = document.activeElement as HTMLElement;
    if (action === 'back') { this.offerAt = this.waited + BOT_OFFER_SECONDS; this.offering = false; active?.blur?.(); return true; }
    if (!buttons.includes(active)) { this.el.querySelector<HTMLElement>('[data-dock-bot]')?.focus({ preventScroll: true }); return true; }
    if (action === 'confirm') { active.click(); return true; }
    const direction = ({ previous: 'up', next: 'down', left: 'left', right: 'right' } as Partial<Record<UiAction, Direction>>)[action];
    const to = direction ? nearest(active.getBoundingClientRect(), buttons.map(b => b.getBoundingClientRect()), direction) : -1;
    if (to >= 0) buttons[to].focus({ preventScroll: true });
    return true;
  }
  get padChoice() { return this.offering && !this.el.classList.contains('hidden') && this.root.dataset.input === 'controller'; }
  clear() { this.since = 0; this.hide(); }
  private hide() { this.offerAt = BOT_OFFER_SECONDS; this.offering = false; if (!this.el.classList.contains('hidden')) this.el.classList.add('hidden'); delete this.root.dataset.waiting; }
}
