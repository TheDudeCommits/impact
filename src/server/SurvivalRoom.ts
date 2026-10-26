import { requireRosterProtocol, type RosterProtocolOptions } from '../game/rosterProtocol';
import { isReleasedFighter } from '../game/rosterAvailability';
import {RoomRewards} from './economy/RoomRewards';
import { Room, type Client, type FixedTimestepCallback } from 'colyseus';
import { MOVES, SIMULATION_HZ, SNAPSHOT_HZ } from '../game/moves';
import { buildCollision, createRapierCollision } from '../game/rapierCollision';
import type { FighterId } from '../game/types';
import { HordeFrame } from '../survival/horde/frame';
import { SurvivalGame, MAX_PARTY, TREE_SECONDS } from '../survival/SurvivalGame';
import { dungeonFor } from '../survival/locations';
import { SURVIVAL_PROTOCOL, encode, slimView, DRAFT_SECONDS, TRAVEL_SECONDS, type CoopFrame } from '../survival/coopNet';
import { privateCodes, PRIVATE_WAIT_SECONDS } from './privateCodes';
import { InputQueue } from './InputQueue';
import { StepClock } from './StepClock';
import { SoloPause } from './SoloPause';
import { roomName, sharedEconomy } from './economy/api';
import { freshAccount } from './cluster/economyLink';
import { ITEMS, lookOf } from '../game/economy/catalog';
import { outfitFor } from '../game/economy/outfits';
import { lockedOut } from '../game/economy/fighters';
import { owns } from '../game/economy/account';
import { RoomFaults } from './RoomFaults';
import { ResyncGate } from './ResyncGate';
import { capacity } from './capacity';
import { PartyStart, PARTY_COUNTDOWN } from './social/PartyStart';
import type { RoomException, RoomMethodName } from 'colyseus';

interface JoinOptions extends RosterProtocolOptions { assetGate?: boolean; survivalProtocol?: number; fighter?: FighterId; name?: string; code?: string; creationToken?: string;
  quick?: unknown;
  unlocked?: unknown; bonus?: unknown;
  account?: string;
  party?: unknown }
type Seat = { fighter: FighterId; name: string; unlocked: string[]; bonus: number;
  look?: number[]; emotes?: string[]; emotedAt?: number;
  outfit?: string };
export const COOP_RECONNECTION_SECONDS = 20;
export const QUICK_LOBBY_SECONDS = 20;
export const QUICK_RESULTS_SECONDS = 25;

export class SurvivalRoom extends Room {
  game!: SurvivalGame;
  private rewards = new RoomRewards();
  private faults = new RoomFaults(this);
  private resync?: ResyncGate;
  private run = 0;
  private queues = new Map<string, InputQueue>();
  private seats = new Map<string, Seat>();
  private dropped = new Set<string>();
  private hostId: string | null = null;
  private code = '';
  private creationToken?: string;
  private quick = false;
  private quickStartAt = QUICK_LOBBY_SECONDS;
  private overSince = -1;
  private loop = 0;
  private steps = 0;
  private draftSince = -1;
  private treeSince = -1;
  private travelSince = -1;
  private loaded = new Set<string>();
  private expiring = false;
  private readonly hordeFrame = new HordeFrame();
  private hordeSeen = 0;
  private pause?: SoloPause;
  private partyStart = new PartyStart(undefined, 0);
  private partyStartAt = -1;

  async onCreate(options: JoinOptions = {}) {
    requireRosterProtocol(options.rosterProtocol);
    this.quick = options.quick === true;
    if (!this.quick) {
      if (typeof options.creationToken !== 'string' || !/^[-0-9a-f]{36}$/i.test(options.creationToken)) throw new Error('Create a co-op room from the lobby.');
      capacity.admit(this);
      this.creationToken = options.creationToken;
      this.partyStart = new PartyStart(options.party, MAX_PARTY);
      this.code = privateCodes.allocate();
      this.roomId = `coop-${this.code}`;
    } else capacity.admit(this);
    this.maxClients = MAX_PARTY;
    this.maxMessagesPerSecond = 320;
    this.autoDispose = true;
    try {
      if (!this.quick) await this.setPrivate(true);
      const seed = SurvivalRoom.seed();
      this.game = this.lobby(seed, await createRapierCollision(dungeonFor(seed, 1).location.stage));
      await this.setMetadata({ mode: 'survival', visibility: this.quick ? 'public' : 'private', map: this.game.sim.stage, humanCapacity: MAX_PARTY });
    } catch (error) { if (this.code) privateCodes.release(this.code); capacity.release(this); this.game?.dispose(); throw error; }
    this.pause = new SoloPause({ solo: () => this.game.heroes.size === 1 ? this.game.heroes.keys().next().value : undefined,
      open: () => this.game.phase !== 'lobby' && this.game.phase !== 'over', queued: id => this.queues.get(id)?.length ?? 0,
      frozen: () => { for (const queue of this.queues.values()) queue.clear(); this.sendFrames(); },
      thawed: ms => { for (const key of ['draftSince', 'treeSince', 'travelSince', 'overSince'] as const) if (this[key] >= 0) this[key] += ms; this.sendFrames(); },
      beat: () => this.sendFrames() });
    this.onMessage('pause', (client, raw: unknown) => this.pause?.request(client, raw, true));
    this.onMessage('resume', (client, raw: unknown) => this.pause?.request(client, raw, false));
    this.onMessage('input', (client, raw: unknown) => {
      if (this.pause?.frozen) return;
      if (!this.queues.get(client.sessionId)?.push(raw)) client.send('input-rejected', { reason: 'Invalid, stale or excess input' });
    });
    this.resync = new ResyncGate(this, client => {
      this.queues.get(client.sessionId)?.clear();
      this.game.sim.clearPlayerInput(client.sessionId);
      client.sendBytes('resync', encode(this.frame(client.sessionId, this.game.snapshot(false))));
    });
    this.onMessage('start-private-match', client => this.start(client));
    this.onMessage('choose', (client, card: unknown) => this.choose(client, card));
    this.onMessage('reroll', client => { this.game.reroll(client.sessionId); });
    this.onMessage('loaded', (client, run: unknown) => this.loadedBy(client, run));
    this.onMessage('lobby', client => this.backToLobby(client));
    this.onMessage('account', (client, token: unknown) => freshAccount(token, () => this.dress(client, token), () => this.clients.includes(client)));
    this.onMessage('emote', (client, place: unknown) => this.emote(client, place));
    this.onMessage('ping', (client, raw: unknown) => {
      if (typeof raw === 'number' && Number.isFinite(raw)) client.send('pong', { clientTime: raw, serverTime: this.game.sim.serverTime });
    });
    this.setFixedTimestep(() => this.faults.guard(() => this.tick()), SIMULATION_HZ);
  }

  private dress(client: Client, token: unknown) {
    this.rewards.bind(client.sessionId,token);
    const seat = this.seats.get(client.sessionId), account = sharedEconomy()?.book.find(token);
    if (!seat || !account) return;
    seat.look = lookOf(account.worn, seat.fighter); seat.emotes = [...(account.worn.emotes ?? [])];
    this.game.setLook(client.sessionId, seat.look);
    const outfit = account.worn.outfits?.[seat.fighter];
    seat.outfit = outfit && owns(account, outfit) && outfitFor(outfit, seat.fighter) ? outfit : undefined;
    this.game.setOutfit(client.sessionId, seat.outfit);
  }
  private emote(client: Client, place: unknown) {
    const seat = this.seats.get(client.sessionId), item = typeof place === 'number' ? ITEMS[place] : undefined, now = Date.now();
    if (!seat || !item || !seat.emotes?.includes(item.id) || now - (seat.emotedAt ?? 0) < 1000) return;
    seat.emotedAt = now;
    this.game.emote(client.sessionId, place as number);
  }

  private static seed() { return (Math.random() * 0x7fffffff | 0) || 1; }
  private lobby(seed = SurvivalRoom.seed(), collision = buildCollision(dungeonFor(seed, 1).location.stage)) {
    const game = new SurvivalGame({ heroes: [], lobby: true, slowMotion: false, collision, seed });
    this.run++;this.rewards.next(this.run);
    for (const [id, seat] of this.seats) game.addHero({ id, ...seat });
    this.draftSince = this.travelSince = -1;
    this.hordeSeen = 0;
    this.loaded.clear();
    this.quickStartAt = QUICK_LOBBY_SECONDS; this.overSince = -1;
    return game;
  }

  private tick() {
    if (this.pause?.hold()) return;
    this.steps++;
    const game = this.game;
    if (game.phase === 'travel' && game.travelTo) {
      if (this.travelSince < 0) { this.travelSince = Date.now(); this.loaded.clear(); }
      if (!this.loading() || Date.now() - this.travelSince > TRAVEL_SECONDS * 1000) {
        game.arrive(buildCollision(game.travelTo));
        this.travelSince = -1; this.loaded.clear();
      }
    }
    if (game.phase === 'draft' && game.drafting) {
      if (this.draftSince < 0) this.draftSince = Date.now();
      else if (Date.now() - this.draftSince > DRAFT_SECONDS * 1000) game.autoChoose();
    } else this.draftSince = -1;
    if (game.phase === 'draft' && game.upgradingNow) {
      if (this.treeSince < 0) this.treeSince = Date.now();
      else if (Date.now() - this.treeSince > TREE_SECONDS * 1000) { game.closeTrees(); this.treeSince = -1; }
    } else this.treeSince = -1;
    if (this.quick && game.phase === 'lobby' && this.clients.length && !this.dropped.size && (game.sim.serverTime >= this.quickStartAt || game.heroes.size >= MAX_PARTY && game.sim.serverTime >= 3)) this.begin();
    if (this.partyStart.waiting && game.phase === 'lobby') {
      if (this.partyStartAt < 0) { if (this.partyStart.complete(this.seats.size, this.dropped.size) && [...this.seats.keys()].every(id => this.loaded.has(id))) this.partyStartAt = game.sim.serverTime + PARTY_COUNTDOWN; }
      else if (this.dropped.size) this.partyStartAt = -1;
      else if (game.sim.serverTime >= this.partyStartAt) { this.partyStartAt = -1; this.partyStart.started(); this.begin(); }
    }
    if (this.quick && game.phase === 'over') {
      if (this.overSince < 0) { this.overSince = Date.now(); void this.lock(); }
      else if (Date.now() - this.overSince > QUICK_RESULTS_SECONDS * 1000) { this.again(); return; }
    }
    if (!this.quick && game.phase === 'lobby' && game.sim.serverTime >= PRIVATE_WAIT_SECONDS && !this.expiring) {
      this.expiring = true;
      this.broadcast('notice', { message: 'The co-op room expired after 15 minutes in the lobby. Create a new room.' });
      void this.disconnect(4004);
      return;
    }
    const waiting = new Set<string>();
    for (const [id, queue] of this.queues) {
      const input = queue.take();
      if (input) {game.submit(id, input);this.rewards.input(id,input);} else waiting.add(id);
    }
    try { game.step(waiting); } catch (error) { this.faults.fault(error); }
    this.rewards.survival(game,this.run);
    if (this.steps % (SIMULATION_HZ / SNAPSHOT_HZ) === 0) this.sendFrames();
  }

  private sendFrames() {
    const game = this.game, snapshot = game.snapshot();
    const horde = this.packHorde(game);
    for (const client of this.clients) client.sendBytes('frame', encode({ ...this.frame(client.sessionId, snapshot), horde }));
  }

  private packHorde(game: SurvivalGame) {
    this.hordeFrame.capture(game.horde, game.sim.serverTime);
    const events = game.horde.eventsSince(this.hordeSeen);
    this.hordeSeen = game.horde.lastEvent;
    return this.hordeFrame.pack(events.length > 255 ? events.slice(-255) : events);
  }

  private loading() {
    let n = 0;
    for (const id of this.queues.keys()) if (!this.loaded.has(id) && !this.dropped.has(id)) n++;
    return n;
  }

  private frame(id: string, snapshot: ReturnType<SurvivalGame['snapshot']>): CoopFrame {
    const game = this.game, checkpoint = game.sim.predictionCheckpoint(id);
    const lobby = game.phase === 'lobby';
    return { ...this.rewards.forOwner(snapshot,id), status: lobby ? 'waiting' : snapshot.status, ...(this.pause ? { pause: this.pause.view() } : {}),
      ...(checkpoint ? { prediction: { [id]: checkpoint }, queued: this.queues.get(id)?.low } : {}),
      lobby: { visibility: 'private', code: this.quick ? 'QUICK' : this.code, hostId: this.hostId, canStart: lobby && this.dropped.size === 0 && !this.expiring,
        startsAt: this.quick && lobby ? this.quickStartAt : lobby && this.partyStartAt >= 0 ? this.partyStartAt : null, expiresAt: lobby && !this.quick ? PRIVATE_WAIT_SECONDS : null,
        ...(lobby ? this.partyStart.view(game.sim.serverTime) : {}) },
      survival: { ...slimView(game.view(id)), run: this.run, host: id === this.hostId, marked: game.marked(),
        draftLeft: game.phase === 'draft' && this.draftSince >= 0 ? Math.max(0, DRAFT_SECONDS - (Date.now() - this.draftSince) / 1000) : undefined,
        treeLeft: game.phase === 'draft' && this.treeSince >= 0 ? Math.max(0, TREE_SECONDS - (Date.now() - this.treeSince) / 1000) : undefined,
        loading: game.phase === 'travel' ? this.loading() : undefined } };
  }

  choose(client: Client, card: unknown) { if (card === null || typeof card === 'string') this.game.choose(card ?? undefined, client.sessionId); }
  loadedBy(client: Client, run: unknown) { if (run === this.run && (this.game.phase === 'travel' || this.game.phase === 'lobby' && this.partyStart.waiting)) this.loaded.add(client.sessionId); }

  start(client: Client) {
    if (this.game.phase !== 'lobby') return;
    if (client.sessionId !== this.hostId) { client.send('notice', { message: 'Only the room host can start the run.' }); return; }
    if (this.dropped.size) { client.send('notice', { message: 'Waiting for a disconnected fighter to reconnect.' }); return; }
    this.partyStart.started(); this.partyStartAt = -1;
    this.begin();
  }
  private begin() {
    this.game.begin();
    const n = this.game.heroes.size;
    this.broadcast('notice', { message: n > 1 ? `The rift opens — a party of ${n}. The horde grows to match.` : this.quick ? 'The rift opens — fighters who find this room drop in between rounds.' : 'The rift opens — friends with the code can drop in between rounds.' });
  }

  backToLobby(client: Client) {
    if (this.game.phase !== 'over') return;
    if (client.sessionId !== this.hostId) { client.send('notice', { message: 'The host starts the next run.' }); return; }
    this.again();
  }
  private again() {
    const old = this.game;
    this.game = this.lobby();
    old.dispose();
    for (const queue of this.queues.values()) queue.clear();
    void this.unlock();
  }

  onAuth(_client: Client, options: JoinOptions = {}) {requireRosterProtocol(options.rosterProtocol);
    if(options.assetGate && options.survivalProtocol !== SURVIVAL_PROTOCOL) throw new Error('Refresh Impact to load the updated Arcade skill tree.');
    if (options.fighter !== undefined && !isReleasedFighter(options.fighter)) throw new Error('Fighter is not available');
    const locked = options.fighter !== undefined ? lockedOut(options.fighter, sharedEconomy()?.book.find(options.account)) : undefined;
    if (locked) throw new Error(locked);
    if (this.expiring) throw new Error('This co-op room has expired.');
    if (!this.quick && options.code !== this.code && options.creationToken !== this.creationToken) throw new Error('Enter the room code to join this co-op run.');
    if (this.game.phase === 'over') throw new Error('That run has just ended. Join when the party is back in the lobby.');
    if (this.game.phase !== 'lobby' && this.game.heroes.size >= MAX_PARTY) throw new Error('This co-op room is full.');
    return true;
  }

  onJoin(client: Client, options: JoinOptions = {}) {
    this.onAuth(client, options);
    const seat: Seat = { fighter: options.fighter ?? 'goku', name: roomName(options.account, options.name, 18),
      unlocked: Array.isArray(options.unlocked) ? options.unlocked.filter((id): id is string => typeof id === 'string' && id.length < 40).slice(0, 12) : [],
      bonus: typeof options.bonus === 'number' && Number.isFinite(options.bonus) ? Math.max(0, Math.min(2, Math.floor(options.bonus))) : 0 };
    const midRun = this.game.phase !== 'lobby';
    if (!(midRun ? this.game.dropIn({ id: client.sessionId, ...seat }) : this.game.addHero({ id: client.sessionId, ...seat }))) throw new Error('This co-op room is full.');
    this.seats.set(client.sessionId, seat);this.rewards.bind(client.sessionId,options.account,true);
    if (midRun) this.broadcast('notice', { message: `${seat.name} joins the run — in when this round's boss falls.` }, { except: client });
    if (this.hostId === null) this.hostId = client.sessionId;
    this.queues.set(client.sessionId, new InputQueue());
    client.send('welcome', { playerId: client.sessionId, roomId: this.roomId, mode: 'survival', tickRate: SIMULATION_HZ, snapshotRate: SNAPSHOT_HZ, botCount: 0 });
    client.sendBytes('frame', encode(this.frame(client.sessionId, this.game.snapshot(false))));
  }

  async onDrop(client: Client) {
    if (!this.game.heroes.has(client.sessionId)) return;
    this.dropped.add(client.sessionId);
    this.queues.get(client.sessionId)?.clear();
    this.game.sim.clearPlayerInput(client.sessionId);
    this.pause?.drop(client.sessionId);
    try { await this.allowReconnection(client, COOP_RECONNECTION_SECONDS); }
    catch { this.onLeave(client); }
  }

  onReconnect(client: Client) {
    this.dropped.delete(client.sessionId);
    this.resync?.forget(client.sessionId);
    this.queues.get(client.sessionId)?.clear();
    this.game.sim.clearPlayerInput(client.sessionId);
    client.sendBytes('frame', encode(this.frame(client.sessionId, this.game.snapshot(false))));
  }

  onLeave(client: Client) {
    if (this.partyStart.waiting && this.game?.phase === 'lobby') { this.partyStart.left(); this.partyStartAt = -1; }
    this.rewards.leave(client.sessionId);
    const id = client.sessionId;
    this.dropped.delete(id);
    this.resync?.forget(id);
    this.queues.delete(id);
    this.seats.delete(id);
    this.loaded.delete(id);
    this.game.removeHero(id);
    if (this.hostId === id) {
      this.hostId = this.clients.find(other => other.sessionId !== id)?.sessionId ?? null;
      if (this.hostId) this.broadcast('notice', { message: 'The host left — you are hosting now.' });
    }
  }

  override setFixedTimestep(step: FixedTimestepCallback, tickRate = SIMULATION_HZ) {
    const clock = new StepClock(tickRate), loop = ++this.loop, dt = 1 / tickRate;
    let tick = 0, budget = 0, pending = false;
    clock.advance(performance.now());
    const run = () => {
      pending = false;
      if (loop !== this.loop) return;
      if (budget > 0 && clock.take()) { budget--; step({ dt, dtMs: dt * 1000, tick: tick++, subSteps: 1, subDt: dt, subDtMs: dt * 1000 }); }
      if (budget > 0 && clock.owed > 0 && loop === this.loop) { pending = true; setImmediate(run); }
    };
    this.setTimestep(() => {
      if (loop !== this.loop) return;
      clock.advance(performance.now());
      budget = StepClock.PER_CALLBACK;
      if (!pending && clock.owed > 0) { pending = true; setImmediate(run); }
    }, 1000 / tickRate);
  }

  onUncaughtException(error: RoomException, method: RoomMethodName) { this.faults.report(error, method); }

  onDispose() { this.loop++; this.queues.clear(); this.dropped.clear(); this.resync?.clear(); if (this.code) privateCodes.release(this.code); capacity.release(this); this.game?.dispose(); }
}
