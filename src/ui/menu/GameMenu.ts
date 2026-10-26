import { FIGHTERS } from '../../config';
import { promptText } from '../prompts';
import { MODES, type ModeId, type VariantId } from '../modes/catalogue';
import { defenceBasics } from '../modes/defence';
import { coachOn, setCoachOn } from '../modes/prefs';
import type { ModeHudHost } from '../hud/host';
import type { ModeHudFrame } from '../hud/modeHud';
import './gameMenu.css';

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (value: number) => Math.round(value).toLocaleString('en-US');
type Page = 'home' | 'howto' | 'moves' | 'controls' | 'settings' | 'tools' | 'leave';

export function statusLine(mode: ModeId, frame: ModeHudFrame | undefined): string {
  if (!frame) return '';
  const { snapshot, self, run, objective, phase } = frame;
  const alive = snapshot.players.filter(p => p.alive && !p.enemy).length;
  switch (mode) {
    case 'rift-war': return phase==='waiting'?'GATHERING THE TEAMS':phase==='over'?'WAR COMPLETE':'THREE LANES · DESTROY THE ENEMY CORE';
    case 'royale': return phase === 'waiting' ? `${snapshot.players.length} FIGHTERS IN THE ROOM` : `${alive} LEFT · YOUR KOs ${self.kills ?? 0}`;
    case 'duel': {
      const rival = snapshot.players.find(p => p.id !== self.id && !p.enemy);
      return rival ? `YOU ${n(self.hp)} · ${FIGHTERS[rival.fighter].name.toUpperCase()} ${n(rival.hp)}` : 'WAITING FOR A RIVAL';
    }
    case 'training': return `TRAINING · DUMMY ${(snapshot as { trainingBotMode?: string }).trainingBotMode === 'combat' ? 'FIGHTING BACK' : 'STANDING STILL'}`;
    case 'arcade': return run ? `ROUND ${run.round} · ${run.location.name.toUpperCase()} · SCORE ${n(run.score)}` : '';
    case 'last-stand': {
      const city = objective?.village; if (!city) return '';
      const standing = objective!.seats.filter(seat => snapshot.players.find(p => p.id === seat.id)?.alive).length;
      return `WAVE ${city.phase === 'preparation' ? city.wave + 1 : city.wave} · VILLAGE ${n(city.hp)} / ${n(city.maxHp)} · ${standing} DEFENDER${standing === 1 ? '' : 'S'} STANDING · ◈ ${n(city.points)}`;
    }
    case 'bad-blood': {
      const heroes = snapshot.players.filter(p => p.team === 'heroes' && p.alive).length, villains = snapshot.players.filter(p => p.team === 'villains' && p.alive).length;
      return `HEROES ${heroes} · VILLAINS ${villains}`;
    }
  }
}

export class GameMenu {
  private readonly scrim: HTMLElement;
  private readonly card: HTMLElement;
  private readonly nav = document.createElement('nav');
  private readonly live = document.createElement('section');
  private readonly howto = document.createElement('section');
  private readonly leaveCard = document.createElement('section');
  private page: Page = 'home';
  get current() { return this.page; }
  private timer = 0;
  private mode?: ModeId;
  variant: () => VariantId | undefined = () => undefined;

  constructor(private readonly root: HTMLElement, private readonly modes: ModeHudHost) {
    this.scrim = root.querySelector<HTMLElement>('.settings-scrim')!;
    this.card = this.scrim.querySelector<HTMLElement>('.pause-menu')!;
    this.nav.className = 'gm-nav'; this.nav.setAttribute('aria-label', 'Game menu');
    this.live.className = 'gm-live'; this.live.setAttribute('aria-live', 'polite');
    this.howto.className = 'gm-howto';
    this.leaveCard.className = 'gm-leave';
    this.card.prepend(this.nav);
    this.card.querySelector('.pause-header')?.after(this.live);
    this.live.after(this.howto, this.leaveCard);
    this.nav.addEventListener('click', event => this.click(event));
    this.leaveCard.addEventListener('click', event => this.click(event));
    let wasOpen = this.open;
    new MutationObserver(() => { const open = this.open; if (open === wasOpen) return; wasOpen = open; open ? this.opened() : this.closed(); }).observe(this.scrim, { attributes: true, attributeFilter: ['class'] });
    this.card.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-pause-page]');
      if (b && !this.nav.contains(b)) queueMicrotask(() => this.show(b.dataset.pausePage === 'moves' ? 'moves' : 'home'));
    }, true);
    const tool = (command: string, label: string) => { const b = this.card.querySelector<HTMLElement>(`[data-training="${command}"]`); if (b) b.textContent = label; };
    tool('passive', 'Dummy: standing still'); tool('combat', 'Dummy: fighting back'); tool('reset', 'Reset positions'); tool('awakening', 'Fill meters');
  }
  get open() { return !this.scrim.classList.contains('hidden'); }

  private opened() {
    const frame = this.modes.frame, layout = this.modes.layout;
    if (!layout) { this.card.removeAttribute('data-menu'); return; }
    this.mode = layout;
    this.title();
    this.drawNav(); this.drawHowTo(); this.show('home');
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.drawLive(), 500);
    this.drawLive(frame);
    this.nav.querySelector<HTMLElement>('[data-gm="resume"]')?.focus({ preventScroll: true });
  }
  private closed() {
    window.clearInterval(this.timer); this.timer = 0;
    const title = this.card.querySelector('#pause-title'); if (title && this.mode) title.textContent = 'PAUSE MENU';
    delete this.card.dataset.gmPaused;
  }
  private title() {
    const paused = this.modes.paused(), title = this.card.querySelector('#pause-title');
    const text = paused ? 'PAUSE MENU' : 'MENU';
    if (title && title.textContent !== text) title.textContent = text;
    this.card.dataset.gmPaused = String(paused);
  }

  private extras(mode: ModeId): [string, string, string?][] {
    const list: [string, string, string?][] = [];
    if (mode === 'training') list.push(['tools', 'TRAINING TOOLS', 'DUMMY · RESET · LAB']);
    if (mode === 'last-stand') list.push(['shop', 'QUARTERMASTER', this.nearShop() ? 'NEARBY · OPEN' : 'INSIDE THE GATE']);
    if (mode === 'arcade' && this.root.querySelector('#sv-points')) list.push(['tree', 'SKILL TREE']);
    return list;
  }
  private nearShop() { const shop = this.root.querySelector<HTMLElement>('[data-objective-shop]'); return !!shop && !shop.classList.contains('hidden'); }
  private drawNav() {
    const mode = this.mode!, local = this.modes.local();
    const item = (id: string, label: string, small?: string) => `<button type="button" data-gm="${id}"><span>${escape(label)}</span>${small ? `<small>${escape(small)}</small>` : ''}</button>`;
    this.nav.innerHTML = [item('resume', 'RESUME'), item('howto', 'HOW TO PLAY'), item('moves', 'MOVE LIST'), item('controls', 'CONTROLS'), item('settings', 'SETTINGS'),
      '<hr><p>THIS MODE</p>', ...this.extras(mode).map(([id, label, small]) => item(id, label, small)),
      '<hr>', item('leave', local ? 'QUIT TO HOME' : mode === 'training' ? 'LEAVE TRAINING' : mode === 'arcade' ? 'LEAVE RUN' : 'LEAVE MATCH')].join('');
  }
  private drawHowTo() {
    const info = MODES[this.mode!];
    this.howto.innerHTML = `<h3>${escape(info.name)}</h3><p class="gm-goal">${escape(info.goal)}</p><p class="gm-win">${escape(info.win)}</p>
      <h3>HOW TO PLAY</h3><ol class="ux-keys">${info.howTo.map(line => `<li>${promptText(line)}</li>`).join('')}</ol>
      <h3>DEFENCE BASICS</h3><ul class="gm-defence ux-keys ux-defence">${defenceBasics()}</ul>`;
  }
  private drawLive(frame = this.modes.frame) {
    if (!this.mode || !this.open) return;
    const info = MODES[this.mode], variant = this.variant(), paused = this.modes.paused();
    this.title();
    const label = `${info.name}${variant && info.variants[variant] ? ` · ${info.variants[variant]!.label}` : ''}`;
    const status = statusLine(this.mode, frame);
    const note = paused ? '<b class="gm-paused">PAUSED</b><span>Nothing moves until you resume.</span>'
      : '<b class="gm-on">THE MATCH IS STILL ON</b><span>You can be hit while this menu is open.</span>';
    const html = `<small>${escape(label)}</small><strong>${escape(status || info.goal)}</strong><p class="gm-note">${note}</p>`;
    if (this.live.innerHTML !== html) this.live.innerHTML = html;
  }
  home() { this.show('home'); this.nav.querySelector<HTMLElement>('[data-gm="resume"]')?.focus({ preventScroll: true }); }
  show(page: Page) {
    if (!this.mode) return;
    this.page = page;
    this.card.dataset.menu = page;
    if (page !== 'moves' && this.card.dataset.pausePage === 'moves') this.card.dataset.pausePage = 'settings';
    for (const b of this.nav.querySelectorAll<HTMLElement>('[data-gm]')) b.setAttribute('aria-current', String(b.dataset.gm === page || (page === 'home' && b.dataset.gm === 'resume')));
    if (page === 'controls') this.card.querySelector<HTMLDetailsElement>('#key-guide')?.setAttribute('open', '');
    if (page === 'leave') {
      const [head, line, yes] = this.mode === 'training' ? ['LEAVE TRAINING?', 'Nothing is lost: your dummy and trials wait for you.', 'LEAVE']
        : this.mode === 'arcade' ? ['LEAVE THE RUN?', 'You drop out of the run; your party fights on without you.', 'LEAVE RUN']
        : ['LEAVE THE MATCH?', "You'll be knocked out of this match, and it goes on without you.", 'LEAVE MATCH'];
      this.leaveCard.innerHTML = `<h3>${head}</h3><p>${line}</p><div><button type="button" data-gm="leave-yes" class="gm-danger">${yes}</button><button type="button" data-gm="leave-no">STAY</button></div>`;
    }
    this.card.scrollTop = 0;
  }
  private click(event: Event) {
    const b = (event.target as HTMLElement).closest<HTMLElement>('[data-gm]');
    if (!b) return;
    const id = b.dataset.gm!, press = (selector: string) => this.root.querySelector<HTMLElement>(selector)?.click();
    switch (id) {
      case 'resume': press('#resume'); break;
      case 'moves': press('.pause-actions .pause-move-list'); this.show('moves'); break;
      case 'howto': case 'controls': case 'settings': case 'tools': this.show(id); break;
      case 'shop': if (this.nearShop()) press('[data-objective-shop]'); else this.flash(b, 'Walk to the Quartermaster inside the gate.'); break;
      case 'tree': this.treePage(); break;
      case 'leave': if (this.modes.local()) press('#leave-arena'); else { this.show('leave'); this.leaveCard.querySelector<HTMLElement>('[data-gm="leave-no"]')?.focus(); } break;
      case 'leave-yes': press('#leave-arena'); break;
      case 'leave-no': this.show('home'); this.nav.querySelector<HTMLElement>('[data-gm="leave"]')?.focus(); break;
    }
    if (id === 'settings') this.coachRow();
  }
  private treePage() {
    const tree = this.root.querySelector<HTMLElement>('#sv-tree');
    window.setTimeout(() => {
      this.root.querySelector<HTMLElement>('#sv-points')?.click();
      if (!tree || tree.classList.contains('hidden')) return;
      this.scrim.classList.add('gm-behind');
      const back = new MutationObserver(() => {
        if (!tree.classList.contains('hidden') && this.open) return;
        back.disconnect(); this.scrim.classList.remove('gm-behind');
        if (this.open) this.nav.querySelector<HTMLElement>('[data-gm="tree"]')?.focus({ preventScroll: true });
      });
      back.observe(tree, { attributes: true, attributeFilter: ['class'] });
      back.observe(this.scrim, { attributes: true, attributeFilter: ['class'] });
    }, 0);
  }
  private coachRow() {
    const grid = this.card.querySelector('.pause-settings-grid .pause-group');
    if (!grid || grid.querySelector('#gm-coach')) return;
    const row = document.createElement('label');
    row.className = 'pause-toggle'; row.htmlFor = 'gm-coach';
    row.innerHTML = '<span>Coach tips (first match of each mode)</span><input id="gm-coach" type="checkbox">';
    const box = row.querySelector('input')!; box.checked = coachOn(); box.onchange = () => setCoachOn(box.checked);
    grid.append(row);
  }
  private flash(button: HTMLElement, text: string) {
    const small = button.querySelector('small'); if (!small) return;
    const was = small.textContent; small.textContent = text; button.classList.add('gm-flash');
    window.setTimeout(() => { small.textContent = was; button.classList.remove('gm-flash'); }, 2200);
  }
}
