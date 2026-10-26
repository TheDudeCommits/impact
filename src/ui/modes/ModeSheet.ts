import { isReleasedFighter } from '../../game/rosterAvailability';
import { FIGHTERS } from '../../config';
import type { FighterId, RoomMode } from '../../game/types';
import type { NetworkAccess } from '../../network';
import { factionOf, HEROES, isBadBloodFighter, RULES, VILLAINS } from '../../game/objectives/model';
import type { UiAction } from '../../input/gamepad';
import { fighterCaption, HOME_VOLUMES, HOME_ROSTER, mangaPortrait } from '../MangaHome';
import { HELD, mayPlay } from '../../game/economy/fighters';
import { account } from '../shop/account';
import { goLabel } from './lockedGo';
import '../inkSelect';
import { moveSheetOf, moveSheetUrl } from '../moveSheet';
import { currentDevice, promptKey, promptText } from '../prompts';
import { padKey } from '../../input/glyphs';
import { preloadLoadingArt, type LoadingMode } from '../LoadingScreen';
import { readInvite } from '../roomInvite';
import { nearest, type Direction } from '../spatialFocus';
import { MODES, VARIANT_ORDER, type ModeId, type Panel, type VariantId } from './catalogue';
import { defenceBasics } from './defence';
import { explainerSeen, markExplainerSeen, modePrefs, namedPlaceFor, saveModePrefs } from './prefs';
import { placePicture, placeRow, placeShown } from './place';
import { pictures } from '../hud/protos/proto';
import type { StageChoice } from '../../game/stageChoice';
import { defaultRoyaleFighters } from '../../loading/backgroundPolicy';
import './modeSheet.css';

export interface SheetHost {
  root: HTMLElement;
  fighter(): FighterId;
  name(): string;
  setName(name: string): void;
  busy(): boolean;
  start(fighter: FighterId, mode: RoomMode, access?: NetworkAccess): void;
  changeFighter(): void;
  story?(): void;
}
export interface SheetOpen { variant?: VariantId; code?: string; invited?: boolean; status?: string; showPanels?: boolean }

const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const FIGHTER_COUNTS = [4, 6, 8, 10, 12], ROOM_SIZES = [2, 4, 8, 12];
const MOVE_X: Record<'special' | 'ultimate' | 'awakening', string> = { special: '50%', ultimate: '75%', awakening: '100%' };
const HOME_PLACE: Partial<Record<ModeId, string>> = { 'last-stand': 'hidden-leaf', 'rift-war': 'rift-war' };
export function nextWay(ways: readonly VariantId[], current: VariantId, step: 1 | -1): VariantId {
  const at = Math.max(0, ways.indexOf(current));
  return ways[(at + step + ways.length) % ways.length];
}

function drawable() {
  const canvas = typeof document === 'object' ? document.querySelector<HTMLCanvasElement>('#game-canvas') : null;
  try { return canvas ? !!canvas.getContext('webgl2') : typeof WebGL2RenderingContext !== 'undefined'; } catch { return false; }
}

export class ModeSheet {
  readonly dialog = document.createElement('dialog');
  private mode: ModeId = 'royale';
  private variant: VariantId = 'offline';
  private code = '';
  private status = '';
  private panels = false;
  private rules = false;
  private invited = false;
  private side: 'heroes' | 'villains' = 'heroes';
  private bbFighter: FighterId = 'goku';
  private picks: Partial<Record<'heroes' | 'villains', FighterId>> = {};
  private editing = false;
  private digit = 0;
  pending?: { mode: ModeId; variant: VariantId; at: number };

  constructor(private readonly host: SheetHost) {
    this.dialog.className = 'mode-sheet ms-select';
    this.dialog.setAttribute('aria-labelledby', 'ms-title');
    host.root.append(this.dialog);
    this.dialog.addEventListener('click', event => this.click(event));
    this.dialog.addEventListener('keydown', event => this.key(event));
    this.dialog.addEventListener('change', event=>{const pick=event.target as HTMLElement&{value:string};if(pick.hasAttribute('data-ms-rival'))saveModePrefs(this.mode,{rival:pick.value as FighterId||undefined});
});
    this.dialog.addEventListener('input', event => this.input(event));
    this.dialog.addEventListener('paste', event => this.paste(event));
    this.dialog.addEventListener('close', () => { this.editing = false; });
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); if (performance.now() - this.backAt > 120) this.back(); });
    this.dialog.addEventListener('submit', event => event.preventDefault());
  }
  private get unsupported() { return !drawable(); }
  get open() { return this.dialog.open; }
  get current() { return { mode: this.mode, variant: this.variant }; }
  private get joining() { return this.invited && this.variant === 'friends'; }

  variantFor(mode: ModeId, asked?: VariantId): VariantId {
    const variants = MODES[mode].variants, last = modePrefs(mode).variant;
    return asked && variants[asked] ? asked : last && variants[last] ? last : VARIANT_ORDER.find(v => variants[v])!;
  }
  show(mode: ModeId, options: SheetOpen = {}) {
    this.mode = mode; this.variant = this.variantFor(mode, options.variant);
    this.code = options.code ?? ''; this.status = options.status ?? ''; this.invited = !!options.invited; this.editing = false;
    this.panels = options.showPanels ?? !explainerSeen(mode);
    this.rules = this.panels;
    const fighter = this.host.fighter();
    this.side = factionOf(fighter); this.bbFighter = isBadBloodFighter(fighter) ? fighter : this.side === 'villains' ? 'dio' : 'goku';
    this.picks = { [this.side]: this.bbFighter };
    this.draw();
    this.preload();
    if (!this.dialog.open) this.dialog.showModal();
    this.focus(this.code && this.variant === 'friends' && !this.invited ? '.ms-join input' : '.ms-go');
    this.showStatus();
  }
  close() { if (this.dialog.open) this.dialog.close(); }
  back() { this.backAt = performance.now(); if (this.rules) this.closeRules(); else this.close(); }
  private backAt = -Infinity;

  private get info() { return MODES[this.mode]; }
  private fighter(): FighterId { return (this.mode === 'bad-blood' || this.mode === 'rift-war') ? this.bbFighter : this.host.fighter(); }
  private prefs() { return modePrefs(this.mode); }

  private draw() {
    const info = this.info, v = info.variants[this.variant]!, fighter = this.fighter(), seen = explainerSeen(this.mode);
    const go = goLabel(this.mode, v.go, fighterCaption(fighter), this.locked(fighter), this.joining ? this.code : undefined);
    const art = info.cover ?? `/assets/home/modes/${info.art}.webp`;
    const facts = [info.facts.players, info.facts.length, info.facts.lives].map(f => `<span>${escape(f)}</span>`).join('');
    const howTo = this.panels
      ? `<div class="ms-panels">${info.howTo.map((line, i) => `<figure class="ms-panel"><span class="ms-pic" style="${this.panelArt(info.panels[i], fighter)}"><b>${i + 1}</b></span><figcaption class="ux-keys">${promptText(line)}</figcaption></figure>`).join('')}</div>`
      : `<ol class="ms-bullets ux-keys">${info.howTo.map(line => `<li><span>${promptText(line)}</span></li>`).join('')}</ol>`;
    const defence = `<details class="ms-defence" open><summary>DEFENCE BASICS</summary><ul class="ux-keys ux-defence">${defenceBasics()}</ul></details>`;
    const tabs = VARIANT_ORDER.filter(id => info.variants[id]).map(id => { const each = info.variants[id]!; return `<button type="button" role="tab" data-ms-variant="${id}" aria-selected="${id === this.variant}" tabindex="${id === this.variant ? 0 : -1}">${escape(each.label)}<small>${escape(each.tag)}</small></button>`; }).join('');
    this.dialog.dataset.mode = this.mode; this.dialog.dataset.variant = this.variant;
    const prefs = this.prefs(), shown = this.joining ? undefined : placeShown(this.mode, this.variant, prefs.stage, this.field());
    const home = HOME_PLACE[this.mode], place = shown?.id ?? (shown ? undefined : home);
    const stage = place ? `url('${placePicture(place)}'),url('${placePicture(place, true)}')` : `url('${art}')`;
    this.dialog.classList.toggle('ms-on-art', !place);
    const shots = pictures(fighter, false);
    this.dialog.innerHTML = `
      <div class="ms-stage" style="background-image:${stage}" aria-hidden="true"></div>
      <button type="button" class="ms-close" data-ms-close aria-label="Back to home">×</button>
      <section class="ms-mode">
        ${info.kicker ? `<small class="ms-kicker">${escape(info.kicker)}</small>` : ''}
        <h2 id="ms-title">${escape(info.name)}</h2>
        <p class="ms-goal">${escape(info.goal)}</p>
        <p class="ms-links"><button type="button" class="ms-link" data-ms-howto>HOW TO PLAY</button>${this.mode === 'arcade' && this.host.story ? '<button type="button" class="ms-link" data-ms-story>WATCH THE STORY ▶</button>' : ''}</p>
        <div class="ms-tabs" role="tablist" aria-label="Ways to play">${tabs}</div>
        <p class="ms-note">${escape(this.joining ? "You're joining a friend's room: they choose the rules." : v.note)}</p>
        ${this.modeOptions()}
        ${this.variant === 'online' || this.variant === 'friends' ? `<label class="ms-name"><span>YOUR NAME</span><input maxlength="18" autocomplete="nickname" value="${escape(this.host.name())}"></label>` : ''}
        ${this.variant === 'friends' ? `<form class="ms-join"><input inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6-DIGIT CODE" aria-label="Room code" autocomplete="off" value="${escape(this.code)}"><button type="submit">JOIN</button></form>` : ''}
        <p class="ms-status" role="status" aria-live="polite">${escape(this.status)}</p>
      </section>
      ${shown ? `<section class="ms-where" aria-live="polite"><small>LOCATION · ${shown.at} / ${shown.of}</small><b>${escape(shown.name)}</b><em>${escape(shown.scene)}</em></section>` : ''}
      ${this.joining ? '' : placeRow(this.mode, this.variant, prefs.stage, this.field())}
      <section class="ms-play">
        <div class="ms-bust" aria-hidden="true"><img alt="" src="${shots[0]}" data-pics="${shots.join(' ')}"></div>
        ${this.you(fighter)}
        <button type="button" class="ms-go" data-ms-go${this.host.busy() || this.unsupported ? ' disabled' : ''}><span>${escape(go.label)}<small>${escape(go.note ?? this.goNote())}</small></span><i aria-hidden="true">▶</i></button>
        <p class="ms-hint ux-keys">${this.hint(go.label)}</p>
      </section>
      <section class="ms-rules" role="group" aria-label="How to play"${this.rules ? '' : ' hidden'}>
        <header><h3>HOW TO PLAY</h3>${!seen ? '<span class="ms-stamp">FIRST TIME</span>' : ''}<button type="button" class="ms-rules-close" data-ms-rules-close>${seen ? 'CLOSE ✕' : 'GOT IT ✓'}</button></header>
        <h4>HOW YOU WIN</h4>
        <p class="ms-win">${escape(info.win)}</p>
        <div class="ms-facts">${facts}</div>
        <h4>THE BASICS <button type="button" class="ms-link" data-ms-panels>${this.panels ? 'SHORT VERSION' : 'SHOW ME THE PICTURES'}</button></h4>
        ${howTo}
        ${defence}
      </section>`;
    const bust = this.dialog.querySelector<HTMLImageElement>('.ms-bust img');
    bust?.addEventListener('error', () => { const pics = bust.dataset.pics!.split(' '), next = pics[pics.indexOf(bust.getAttribute('src')!) + 1]; if (next) bust.src = next; else bust.remove(); });
    this.dialog.querySelector('.ms-place-tile[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  private panelArt(panel: Panel, fighter: FighterId) {
    if ('move' in panel) return `background-image:url('${moveSheetUrl(moveSheetOf(fighter, false))}');background-size:500% auto;background-position:${MOVE_X[panel.move]} center;background-color:#0d1825`;
    return `background-image:url('${panel.src}');background-position:${panel.at ?? 'center'}`;
  }
  private field(): number | undefined {
    if (this.mode !== 'royale') return undefined;
    return this.variant === 'offline' ? this.prefs().fighters ?? defaultRoyaleFighters() : this.variant === 'friends' ? this.prefs().roomSize ?? 8 : undefined;
  }
  private modeOptions() {
    const prefs = this.prefs();
    const row = (label: string, attr: string, values: number[], on: number, name = (n: number) => String(n)) => `<div class="ms-option" role="group" aria-label="${label}"><b>${label}</b>${values.map(n => `<button type="button" ${attr}="${n}" aria-pressed="${n === on}">${name(n)}</button>`).join('')}</div>`;
    const rival = (label: string, random: string) => { const face = (id: FighterId) => `<option value="${id}" data-face="${id}" data-short="${escape(fighterCaption(id))}"${prefs.rival === id ? ' selected' : ''}>${escape(FIGHTERS[id].name)}</option>`, out = (ids: readonly FighterId[]) => ids.filter(id => isReleasedFighter(id) && !HELD.has(id)).map(face).join('');
      return `<label class="ms-option ms-rival"><b>${label.toUpperCase()}</b><ink-select layout="faces" data-ms-rival label="${label}"><option value="" data-short="RANDOM"${prefs.rival && HOME_ROSTER.includes(prefs.rival) ? '' : ' selected'}>${random}</option>${HOME_VOLUMES.map((ids,i)=>`<optgroup label="VOL.${i+1}">${out(ids)}</optgroup>`).join('')}</ink-select></label>`; };
    if (this.mode === 'duel' && this.variant === 'offline') return rival('Bot opponent', 'Random rival');
    if (this.mode === 'training') return rival('Opponent', 'Random opponent');
    if (this.mode === 'royale' && this.variant === 'offline') return row('FIGHTERS', 'data-ms-fighters', FIGHTER_COUNTS, prefs.fighters ?? defaultRoyaleFighters());
    if (this.mode === 'royale' && this.variant === 'friends' && !this.joining) return row('ROOM SIZE', 'data-ms-room', ROOM_SIZES, prefs.roomSize ?? 8, n => n === 2 ? '1V1' : String(n));
    if (this.mode === 'last-stand' && this.variant === 'offline') return `<div class="ms-option" role="group" aria-label="Defenders"><b>DEFENDERS</b><button type="button" data-ms-lone="false" aria-pressed="${!prefs.lone}">WITH 3 BOTS</button><button type="button" data-ms-lone="true" aria-pressed="${!!prefs.lone}">LONE DEFENDER</button></div>${prefs.lone ? '<p class="ms-note ms-warn">Just you. Nobody can revive you.</p>' : ''}`;
    if ((this.mode === 'bad-blood' || this.mode === 'rift-war')) {
      const pool = (this.side === 'heroes' ? HEROES : VILLAINS).filter(id => HOME_ROSTER.includes(id));
      return `<div class="ms-option" role="group" aria-label="Your side"><b>YOUR SIDE</b><button type="button" data-ms-side="heroes" aria-pressed="${this.side === 'heroes'}">HEROES <small>↻ ${this.mode === 'rift-war' ? 'DAWN ALLIANCE' : RULES.heroReviveSeconds + 's RETURN'}</small></button><button type="button" data-ms-side="villains" aria-pressed="${this.side === 'villains'}">VILLAINS <small>${this.mode === 'rift-war' ? 'ECLIPSE LEGION' : RULES.villainMultiplier + '× POWER'}</small></button></div>
        <div class="ms-faces" role="group" aria-label="${this.side === 'heroes' ? 'Heroes' : 'Villains'}">${pool.map(id => `<button type="button" data-ms-pick="${id}" aria-pressed="${id === this.bbFighter}" aria-label="${escape(FIGHTERS[id].name)}"><span class="ms-face-art">${mangaPortrait(id)}</span><span class="ms-face-name">${escape(FIGHTERS[id].name.split(' ')[0])}</span></button>`).join('')}</div>`;
    }
    return '';
  }
  private you(fighter: FighterId) {
    const swapped = (this.mode === 'bad-blood' || this.mode === 'rift-war') && fighter !== this.host.fighter();
    return `<div class="ms-you"><span class="ms-face">${mangaPortrait(fighter)}</span><div><small>YOUR FIGHTER${swapped ? ' · FOR THIS MODE' : ''}${this.locked(fighter) ? ' · <b class="ms-locked">LOCKED</b>' : ''}</small><strong>${escape(FIGHTERS[fighter].name)}</strong></div>${(this.mode === 'bad-blood' || this.mode === 'rift-war') ? '' : '<button type="button" class="ms-link" data-ms-change>CHANGE</button>'}</div>`;
  }
  private locked(fighter: FighterId) { return this.mode !== 'training' && !mayPlay(fighter, account.account); }
  private goNote() {
    if (this.unsupported) return 'NEEDS WEBGL 2';
    if (this.variant === 'friends') return "YOU'LL GET A 6-DIGIT CODE";
    if (this.variant === 'online') return this.mode === 'duel' ? 'REAL PLAYERS ONLY' : 'MATCHMAKING';
    if (!this.info.variants[this.variant]?.onDevice) return 'STARTS AT ONCE';
    return this.mode === 'training' ? 'NO STAKES' : 'ON THIS DEVICE';
  }
  private hint(go: string) {
    const { device, family } = currentDevice();
    const arrows = device === 'controller' ? `${padKey(family, 'left')}${padKey(family, 'right')}` : '<kbd>←</kbd><kbd>→</kbd>';
    return `${arrows} WAY TO PLAY · ${promptKey('confirm')} ${escape(go)} · ${promptKey('back')} BACK`;
  }
  private preload() {
    const mode: LoadingMode = this.mode === 'royale' ? (this.variant === 'offline' ? 'bots' : this.variant === 'online' ? 'players' : 'private') : this.mode;
    preloadLoadingArt(mode, this.fighter());
  }

  go(join = false) {
    if (this.host.busy()) { this.say('Preparing your match…'); return; }
    if (this.unsupported) { this.say("This browser can't draw the game: it needs WebGL 2. Try the latest Chrome, Safari, Edge or Firefox."); return; }
    const fighter = this.fighter(), prefs = this.prefs(), mode = this.mode;
    if (join && !/^\d{6}$/.test(this.code)) { this.say('Enter the 6-digit room code.'); this.focus('.ms-join input'); return; }
    const place = join ? undefined : namedPlaceFor(mode, this.variant, this.field());
    const objective = (access: 'quick' | 'bots' | 'solo' | 'host' | 'join'): NetworkAccess => ({ kind: 'objective', objective: mode as 'last-stand' | 'bad-blood', access, role: mode === 'bad-blood' ? factionOf(fighter) : 'defenders', fighter, code: join ? this.code : undefined, place });
    let room: RoomMode = 'match', access: NetworkAccess | undefined;
    switch (mode) {
      case 'rift-war': access = {kind:'rift-war',access:join?'join':this.variant==='offline'?'bots':this.variant==='online'?'quick':'host',code:join?this.code:undefined}; break;
      case 'duel': access = { kind: 'duel', access: join ? 'join' : this.variant === 'offline' ? 'bot' : this.variant === 'online' ? 'online' : 'host', code: join ? this.code : undefined, rival: prefs.rival, place }; break;
      case 'royale': access = join ? { kind: 'join-private', code: this.code } : this.variant === 'offline' ? { kind: 'bots', players: prefs.fighters ?? defaultRoyaleFighters(), place } : this.variant === 'online' ? { kind: 'public' } : { kind: 'create-private', players: prefs.roomSize ?? 8, place }; break;
      case 'training': room = 'training'; break;
      case 'arcade': access = join ? { kind: 'coop-join', code: this.code } : this.variant === 'offline' ? { kind: 'survival' } : this.variant === 'online' ? { kind: 'coop-join', code: '', quick: true } : { kind: 'coop-create' }; break;
      case 'last-stand': access = objective(join ? 'join' : this.variant === 'offline' ? (prefs.lone ? 'solo' : 'bots') : this.variant === 'online' ? 'quick' : 'host'); break;
      case 'bad-blood': access = objective(join ? 'join' : this.variant === 'offline' ? 'bots' : this.variant === 'online' ? 'quick' : 'host'); break;
    }
    saveModePrefs(mode, { variant: this.variant });
    markExplainerSeen(mode);
    this.pending = { mode, variant: this.variant, at: performance.now() };
    this.close();
    this.host.start(fighter, room, access);
  }
  say(text: string) { this.status = text; const el = this.dialog.querySelector('.ms-status'); if (el) el.textContent = text; this.showStatus(); }
  private showStatus() { if (this.status) this.dialog.querySelector('.ms-status')?.scrollIntoView({ block: 'nearest' }); }

  private setVariant(variant: VariantId) {
    if (!this.info.variants[variant] || variant === this.variant) return;
    this.variant = variant; this.status = ''; saveModePrefs(this.mode, { variant });
    this.draw(); this.focus(`[data-ms-variant="${variant}"]`); this.preload();
  }
  private click(event: Event) {
    const target = event.target as HTMLElement;
    if (target === this.dialog) { this.close(); return; }
    const b = target.closest<HTMLButtonElement>('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.msClose !== undefined) this.close();
    else if (d.msVariant) this.setVariant(d.msVariant as VariantId);
    else if (d.msGo !== undefined) this.go(this.joining);
    else if (b.closest('.ms-join') && b.type === 'submit') { event.preventDefault(); this.code = this.dialog.querySelector<HTMLInputElement>('.ms-join input')!.value.replace(/\D/g, ''); this.go(true); }
    else if (d.msPanels !== undefined) { this.panels = !this.panels; this.draw(); this.focus('[data-ms-panels]'); }
    else if (d.msHowto !== undefined) { this.rules = true; this.draw(); this.focus('[data-ms-rules-close]'); }
    else if (d.msRulesClose !== undefined) this.closeRules();
    else if (d.msPlace !== undefined) { saveModePrefs(this.mode, { stage: (d.msPlace || 'random') as StageChoice }); this.redrawKeeping(b); }
    else if (d.msChange !== undefined) { this.close(); this.host.changeFighter(); }
    else if (d.msStory !== undefined) { this.close(); this.host.story?.(); }
    else if (d.msFighters) { saveModePrefs(this.mode, { fighters: Number(d.msFighters) }); this.redrawKeeping(b); }
    else if (d.msRoom) { saveModePrefs(this.mode, { roomSize: Number(d.msRoom) }); this.redrawKeeping(b); }
    else if (d.msLone) { saveModePrefs(this.mode, { lone: d.msLone === 'true' }); this.redrawKeeping(b); }
    else if (d.msSide) {
      this.side = d.msSide as 'heroes' | 'villains';
      const home = this.host.fighter(), own = isBadBloodFighter(home) && factionOf(home) === this.side ? home : undefined;
      this.bbFighter = this.picks[this.side] ?? own ?? (this.side === 'heroes' ? 'goku' : 'dio');
      this.picks[this.side] = this.bbFighter; this.redrawKeeping(b);
    }
    else if (d.msPick) { this.bbFighter = d.msPick as FighterId; this.picks[this.side] = this.bbFighter; this.redrawKeeping(b); }
  }
  private closeRules() { markExplainerSeen(this.mode); this.rules = false; this.panels = false; this.draw(); this.focus('[data-ms-howto]'); }
  private stepPlace(step: 1 | -1) {
    const tiles = [...this.dialog.querySelectorAll<HTMLButtonElement>('.ms-place-tile:not(:disabled)')];
    const at = tiles.findIndex(t => t.getAttribute('aria-selected') === 'true'), next = tiles[(Math.max(0, at) + step + tiles.length) % tiles.length];
    next?.click();
  }
  private redrawKeeping(b: HTMLElement) {
    const attr = Object.keys(b.dataset).find(k => k.startsWith('ms'));
    const value = attr ? b.dataset[attr] : undefined;
    this.draw();
    if (attr) this.focus(`[data-${attr.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${value}"]`);
  }
  private key(event: KeyboardEvent) {
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-ms-variant]');
    if (tab && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault(); this.setVariant(nextWay(VARIANT_ORDER.filter(v => this.info.variants[v]), this.variant, event.key === 'ArrowRight' ? 1 : -1));
    }
    if ((event.target as HTMLElement).closest('.ms-place-tile') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) { event.preventDefault(); this.stepPlace(event.key === 'ArrowRight' ? 1 : -1); return; }
    if (tab && event.key === 'Enter') { event.preventDefault(); this.go(this.joining); return; }
    if (event.key === 'Enter' && (event.target as HTMLElement).closest('.ms-join input')) { event.preventDefault(); this.code = (event.target as HTMLInputElement).value.replace(/\D/g, ''); this.go(true); }
  }
  private input(event: Event) {
    const el = event.target as HTMLInputElement;
    if (el.closest('.ms-join')) { el.value = el.value.replace(/\D/g, '').slice(0, 6); this.code = el.value; }
    else if (el.closest('.ms-name')) this.host.setName(el.value);
  }
  private paste(event: ClipboardEvent) {
    const invite = readInvite(event.clipboardData?.getData('text') ?? '');
    if (!invite || !(event.target as HTMLElement).closest('.ms-join')) return;
    event.preventDefault();
    const mode: ModeId = invite.kind === 'duel' ? 'duel' : invite.kind === 'coop' ? 'arcade' : 'royale';
    this.show(mode, { variant: 'friends', code: invite.code, status: `Invite ready · ${MODES[mode].name}. Press JOIN when ready.` });
  }
  private focus(selector: string) { this.dialog.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true }); }

  controller(action: UiAction): boolean {
    if (!this.dialog.open) return false;
    const scope = this.rules ? this.dialog.querySelector<HTMLElement>('.ms-rules') ?? this.dialog : this.dialog;
    if (this.rules && action === 'back') { this.closeRules(); return true; }
    const items = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled), input, summary')].filter(el => el.getClientRects().length > 0 && !(el as HTMLButtonElement).hidden);
    const active = document.activeElement as HTMLElement;
    const code = this.dialog.querySelector<HTMLInputElement>('.ms-join input');
    if (this.editing && code) {
      const digits = code.value.padEnd(6, '0').split('');
      if (action === 'confirm' || action === 'back') { this.editing = false; this.code = code.value; return true; }
      if (action === 'left' || action === 'right') this.digit = (this.digit + (action === 'right' ? 1 : 5)) % 6;
      else if (action === 'next' || action === 'previous') digits[this.digit] = String((Number(digits[this.digit]) + (action === 'previous' ? 1 : 9)) % 10);
      code.value = digits.join(''); this.code = code.value; code.setSelectionRange(this.digit, this.digit + 1); return true;
    }
    if (action === 'back') { this.close(); return true; }
    if (!items.includes(active)) { (this.rules ? scope.querySelector<HTMLElement>('[data-ms-rules-close]') : this.dialog.querySelector<HTMLElement>('.ms-go'))?.focus(); return true; }
    if (action === 'confirm') {
      if (active === code) { this.editing = true; this.digit = 0; code.value = code.value.padEnd(6, '0'); code.setSelectionRange(0, 1); }
      else if (active.matches('[data-ms-variant]')) this.go(this.joining);
      else active.click();
      return true;
    }
    if (active.matches('.ms-place-tile') && (action === 'left' || action === 'right')) { this.stepPlace(action === 'right' ? 1 : -1); return true; }
    if (active.matches('[data-ms-variant]') && (action === 'left' || action === 'right')) {
      this.setVariant(nextWay(VARIANT_ORDER.filter(v => this.info.variants[v]), this.variant, action === 'right' ? 1 : -1));
      return true;
    }
    const direction = ({ previous: 'up', next: 'down', left: 'left', right: 'right' } as Record<string, Direction>)[action];
    if (!direction) return true;
    const i = nearest(active.getBoundingClientRect(), items.map(el => el.getBoundingClientRect()), direction);
    if (i >= 0) (items[i].matches('[data-ms-variant]') ? this.dialog.querySelector<HTMLElement>('[data-ms-variant][aria-selected="true"]') ?? items[i] : items[i]).focus();
    return true;
  }
}
