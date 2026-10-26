import { FALLS } from '../results/placement';
import type { PlayerState } from '../../game/types';
import * as THREE from 'three';
import type { RunResult } from '../../survival/SurvivalGame';
import type { FighterId } from '../../game/types';
import { FIGHTERS } from '../../config';
import { ITEM, ITEMS, priceOf, wornOf } from '../../game/economy/catalog';
import { CURRENCY, EARNED_LINE, money } from '../../game/economy/currency';
import { LOCKED, mayPlay } from '../../game/economy/fighters';
import { isReleasedFighter } from '../../game/rosterAvailability';
import { COOP_LINK } from '../../survival/coopNet';
import type { PartyMember } from '../../survival/SurvivalGame';
import { levelOf, plausible, type Report, type SurvivalReport } from '../../game/economy/earn';
import { deviceReports } from '../../game/economy/device';
import { gameCosmetics } from '../../render/cosmetics/index';
import { Emotes } from '../../render/cosmetics/emotes';
import { entranceHtml, isEntrance, stampHtml } from '../../render/cosmetics/pages';
import { account } from './account';
import { MatchWatcher, type MatchSight } from './report';
import { showPay } from './payout';
import { Shop, homeChip } from './Shop';
import { chipName } from './accountPanel';
import { ShopPreview } from './preview';
import { deleteAccount, finishSignIn, identity, signIn, signOut } from './signin';
import { signInWithPlayerTwo } from './playerTwo';
import { bringOver } from './bringOver';
import { inPlayerTwo } from '../../boot/playerTwo';

let shop: Shop | undefined;
let started = false;

export function mountShop() {
  if (started || typeof document === 'undefined') return;
  started = true;
  deviceReports.begin = () => { void account.open().catch(() => undefined); };
  deviceReports.send = onDevice;
  const find = () => {
    const lobby = document.querySelector<HTMLElement>('.lobby.manga-home'), actions = lobby?.querySelector<HTMLElement>('.home-actions'), heading = lobby?.querySelector<HTMLElement>('.home-heading');
    if (!lobby || !actions || !heading) { requestAnimationFrame(find); return; }
    build(lobby, actions, heading);
  };
  find();
}

function build(lobby: HTMLElement, actions: HTMLElement, heading: HTMLElement) {
  shop = new Shop(lobby, account);
  shop.stage = new ShopPreview();
  shop.accountTab.signIn = signIn; shop.accountTab.signOut = signOut; shop.accountTab.identity = identity; shop.accountTab.deleteAccount = deleteAccount;
  shop.accountTab.playerTwo = inPlayerTwo; shop.accountTab.bringOver = () => bringOver();
  shop.onPlay = (fighter, training) => {
    lobby.querySelector<HTMLButtonElement>(`[data-fighter="${fighter}"]`)?.click();
    if (training) { lobby.querySelector<HTMLButtonElement>('[data-mode="training"]')?.click(); lobby.querySelector<HTMLButtonElement>('#home-play')?.click(); }
  };
  const open = document.createElement('button');
  open.type = 'button'; open.id = 'home-shop'; open.textContent = 'ACCOUNT'; open.setAttribute('aria-haspopup', 'dialog');
  open.onclick = () => shop!.show('shop');
  actions.prepend(open);
  const chip = document.createElement('button');
  chip.type = 'button'; chip.id = 'home-wallet'; chip.className = 'shop-chip'; chip.setAttribute('aria-label', `Your account: open Account. ${EARNED_LINE}`); chip.title = EARNED_LINE;
  chip.onclick = () => shop!.show('rewards');
  heading.append(chip);
  account.on(wallet => { chip.innerHTML = chipName(wallet.account) + homeChip(wallet.account); COOP_LINK.token = account.secret(); dressSelf(); lockRoster(lobby); });
  const opened = account.start();
  void opened.then(() => finishSignIn()).then(done => { if (done) shop!.show('account'); }, () => shop!.show('account'));
  void opened.then(() => signInWithPlayerTwo()).catch(error => console.warn('[Player Two] sign-in did not go through:', error instanceof Error ? error.message : error));
  watchMatches();
  listenForEmotes();
}

const LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z"/></svg>';
function lockRoster(lobby: HTMLElement) {
  for (const [fighter, unlock] of LOCKED) {
    const panel = lobby.querySelector<HTMLElement>(`.home-fighter[data-fighter="${fighter}"]`), item = ITEM.get(unlock);
    if (!panel || !item) continue;
    const locked = !mayPlay(fighter, account.account);
    let badge = panel.querySelector<HTMLElement>('.home-lock');
    if (locked && !badge) { badge = document.createElement('span'); badge.className = 'home-lock'; panel.append(badge); }
    if (badge) badge.innerHTML = locked ? `${LOCK}${item.level ? `LV ${item.level} · ` : ''}${money(priceOf(item))}` : '';
    if (badge && !locked) badge.remove();
    panel.setAttribute('aria-label', `${FIGHTERS[fighter].name.toUpperCase()}${locked ? `, locked: ${priceOf(item).toLocaleString('en-US')} ${CURRENCY.name} in Account` : ''}`);
  }
}

let self = '', selfFighter: FighterId | undefined;
export function wearSelf(id: string, fighter: FighterId) {
  if (!id || (id === self && fighter === selfFighter)) return;
  const layer = gameCosmetics();
  if (self && self !== id) layer?.drop(self);
  self = id; selfFighter = fighter;
  dressSelf();
}
export function unwearSelf() {
  const layer = gameCosmetics();
  if (self) layer?.drop(self);
  for (const id of partyWorn.keys()) layer?.drop(id);
  partyWorn.clear(); toldRoom = undefined;
  if (layer) layer.self = undefined;
  self = ''; selfFighter = undefined;
  emotes?.clear();
}
function dressSelf() {
  const layer = gameCosmetics();
  if (!layer || !self || !selfFighter) return;
  layer.self = self;
  layer.wear(self, account.account?.worn, FIGHTERS[selfFighter].height ?? 1.75, new THREE.Color(FIGHTERS[selfFighter].color).getHex());
  toldRoom = undefined; tellRoom();
}

let toldRoom: unknown;
function tellRoom() {
  const room = COOP_LINK.room ?? COOP_LINK.match, token = account.secret();
  if (!room?.connection.isOpen || !token || toldRoom === room) return;
  toldRoom = room;
  room.send('account', token);
}
const partyWorn = new Map<string, string>();
export function wearParty(members: readonly PartyMember[]) {
  tellRoom();
  const layer = gameCosmetics();
  if (!layer) return;
  const here = new Set<string>();
  for (const member of members) {
    if (member.id === self) continue;
    here.add(member.id);
    const key = member.look?.join(',') ?? '';
    if (partyWorn.get(member.id) === key) continue;
    partyWorn.set(member.id, key);
    if (!key) layer.drop(member.id);
    else layer.wear(member.id, wornOf(member.look), FIGHTERS[member.fighter].height ?? 1.75, new THREE.Color(FIGHTERS[member.fighter].color).getHex());
  }
  for (const id of [...partyWorn.keys()]) if (!here.has(id)) { partyWorn.delete(id); layer.drop(id); }
}
export function partyEmote(hero: string, place: number | undefined, member: PartyMember | undefined) {
  const item = ITEMS[place ?? -1];
  if (!item || item.kind !== 'emote' || hero === self) return;
  emotes ??= new Emotes(document.querySelector<HTMLElement>('#interface') ?? document.body);
  emotes.play(item.id, hero, { name: member?.name ?? 'Fighter', fighter: member?.fighter ?? '' });
  emoteVoice?.(hero);
}

export function playerPage(fighter: FighterId): string {
  const worn = account.account?.worn.entrance;
  if (!isEntrance(worn)) return '';
  const name = playerName() || FIGHTERS[fighter].name;
  return entranceHtml(worn!, { fighter, name, title: ITEM.get(account.account?.worn.title ?? '')?.name, level: levelOf(account.account?.xp ?? 0).level });
}
function playerName(): string {
  if (account.account?.name) return account.account.name;
  let typed = '';
  try { typed = localStorage.getItem('rift-player-name') ?? ''; } catch { }
  return typed.trim() && typed.trim() !== 'Fighter' ? typed : '';
}
export const playerStamp = () => stampHtml(account.account?.worn.stamp);
export const playerOutfit = (fighter: FighterId) => account.account?.worn.outfits?.[fighter];
export function lockedStart(fighter: FighterId, training: boolean): boolean {
  if (!isReleasedFighter(fighter)) return true;
  const unlock = LOCKED.get(fighter);
  if (training || !unlock || mayPlay(fighter, account.account)) return false;
  shop?.showItem(unlock);
  return true;
}
export const playerBanner = () => account.account?.worn.banner;
export const playerTitle = () => ITEM.get(account.account?.worn.title ?? '')?.name;

let emotes: Emotes | undefined;
let emoteVoice: ((hero: string) => void) | undefined;
export function onEmoteVoice(listener: (hero: string) => void) { emoteVoice = listener; }
let lastEmote = 0;
let fighting = 0;
export function inFight() { fighting = performance.now(); }
function canEmote() {
  if (!self || performance.now() - lastEmote < 1100) return false;
  if (document.querySelector('#interface[data-hud="training"]')) return false;
  if (performance.now() - fighting > 400 && !document.querySelector('.combat-hud:not(.hidden)')) return false;
  const typing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
  return !typing && !document.querySelector('.sv-hud.modal, .settings-scrim:not(.hidden), .sv-tree:not(.hidden), .sv-paused:not(.hidden), .shop:not(.hidden)');
}
export function emote(slot: number) {
  const id = account.account?.worn.emotes?.[slot];
  if (!id || !canEmote()) return;
  lastEmote = performance.now();
  emotes ??= new Emotes(document.querySelector<HTMLElement>('#interface') ?? document.body);
  emotes.play(id, self, { name: playerName() || FIGHTERS[selfFighter ?? 'naruto'].name, title: playerTitle(), fighter: selfFighter ?? '' });
  emoteVoice?.(self);
  if (COOP_LINK.room?.connection.isOpen) COOP_LINK.room.send('emote', ITEMS.findIndex(each => each.id === id));
}
function listenForEmotes() {
  window.addEventListener('keydown', event => {
    if (event.repeat) return;
    const slot = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code);
    if (slot >= 0 && canEmote()) emote(slot);
  });
  const held = [false, false, false, false];
  const poll = () => {
    requestAnimationFrame(poll);
    if (!self) return;
    const pad = [...(navigator.getGamepads?.() ?? [])].find(each => each?.connected && each.mapping === 'standard');
    if (!pad) return;
    [12, 15, 13, 14].forEach((button, slot) => { const down = !!pad.buttons[button]?.pressed; if (down && !held[slot]) emote(slot); held[slot] = down; });
  };
  requestAnimationFrame(poll);
}

export function showRunPay(host: HTMLElement, result: RunResult) {
  const state=(window as unknown as {arenaEvidence?:{state?:{reward?:{report:import('../../game/economy/earn').Report}}}}).arenaEvidence?.state;
  const receipt = result.probe ? undefined : state?.reward?.report, own = deviceRun?.report;
  const run = !receipt && deviceRun && !deviceRun.shown && own?.fighter === result.fighter && own.round === result.round && own.seconds === Math.floor(result.seconds) ? deviceRun : undefined;
  if (run) run.shown = true;
  void showPay(host, receipt ?? run?.report, result.victory || result.sealed ? 'THE SEAL EARNED' : 'THIS RUN EARNED', account, !run).catch(() => undefined);
}

let deviceRun: { report: SurvivalReport; shown: boolean } | undefined;
function onDevice(report: Report) {
  if (report.mode === 'survival') {
    const run = deviceRun = { report, shown: false };
    window.setTimeout(() => { if (!run.shown && !('refused' in plausible(report, false))) void account.report(report).catch(() => undefined); }, 60_000);
    return;
  }
  const toast = document.createElement('div');
  toast.className = 'shop-toast';
  (document.querySelector('#interface') ?? document.body).append(toast);
  void showPay(toast, report, report.place === 1 ? 'THE WIN EARNED' : 'THIS MATCH EARNED', account).catch(() => undefined).finally(() => window.setTimeout(() => toast.remove(), 7200));
}

function watchMatches() {
  const watcher = new MatchWatcher((sight, self) => FALLS.place(sight.players as unknown as PlayerState[], sight.winnerId, self));
  window.setInterval(() => {
    const fightOn = !!document.querySelector('.combat-hud:not(.hidden)') || performance.now() - fighting < 1500;
    if (!fightOn) { watcher.look(undefined, '', 0); if (self) unwearSelf(); return; }
    if (performance.now() - fighting < 1500) return;
    let evidence: { state?: MatchSight | null; playerId?: string; survival?: unknown } | undefined;
    try { evidence = (window as unknown as { arenaEvidence?: typeof evidence }).arenaEvidence; } catch { return; }
    if (!evidence || evidence.survival || !evidence.state?.matchId) return;
    const me = evidence.state?.players.find(player => player.id === evidence!.playerId);
    if (me) wearSelf(me.id, me.fighter as FighterId);
    const report = watcher.look(evidence.state ?? undefined, evidence.playerId ?? '', performance.now() / 1000);
    if (!report) return;
    const toast = document.createElement('div');
    toast.className = 'shop-toast';
    (document.querySelector('#interface') ?? document.body).append(toast);
    void showPay(toast, report, report.mode !== 'survival' && report.place === 1 ? 'THE WIN EARNED' : 'THIS MATCH EARNED', account, true).catch(() => undefined).finally(() => window.setTimeout(() => toast.remove(), 7200));
  }, 1000);
}
