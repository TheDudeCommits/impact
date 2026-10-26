import { requireReleasedFighter } from '../game/rosterAvailability';
const rapier = () => import('../game/rapierCollision').then(module => module.createRapierCollision);
import type { FighterId, GameSnapshot, PlayerInput, RoomMode } from '../game/types';
import { SurvivalGame, PLAYER_ID, type SurvivalView } from './SurvivalGame';
import { locationFor, dungeonFor } from './locations';
import { HordeFrames } from './horde/frame';
import { Autopilot, watchCrowd } from './autopilot';
import { glitch } from '../ui/survival/glitch';
import { carried } from './progressStore';
import type { PathKind } from './paths';
import type {StageId} from '../game/stages';
import { DeviceRun } from '../game/economy/device';

export class LocalArena {
  readonly local = true;
  room: { send(type: string, payload?: unknown): void } | null = null;
  snapshot: GameSnapshot | null = null;
  receivedAt = 0;
  predictionReady = false;
  game: SurvivalGame | null = null;
  onSnapshot = (_snapshot: GameSnapshot) => {};
  onControlReset = () => {};
  onDisconnect = (_reason: string) => {};
  onNotice = (_message: string) => {};
  prepare?: (round: number, extra: readonly string[], stage:StageId) => Promise<void>;
  private pausedNow = false;
  get paused() { return this.pausedNow; }
  set paused(value: boolean) { this.pausedNow = value; if (value) this.clearPresses(); }
  private owed = 0;
  private pressedAttack?: PlayerInput['attack'];
  private pressedJump = false;
  private pressedDash = false;
  private pressedAwaken = false;
  private clearPresses() { this.pressedAttack = undefined; this.pressedJump = this.pressedDash = this.pressedAwaken = false; }
  private travelling = false;
  private generation = 0;
  private fighter: FighterId = 'goku';
  private name = 'You';
  readonly hordeFrames = new HordeFrames();
  private allies: { id: string; pilot: Autopilot }[] = [];
  private allyDown = false;
  private fallAt = 0;
  private kinds: string[] = [];
  private kindsAt = 0;
  private rewards = new DeviceRun();
  get id() { return this.game ? PLAYER_ID : ''; }
  get view(): SurvivalView | undefined { return this.game?.view(); }

  async connect(fighter: FighterId, _mode: RoomMode, name: string, options: { seed?: number; wave?: number } = {}) {
    requireReleasedFighter(fighter);
    const generation=this.generation+1;
    await this.leave();
    if(generation!==this.generation)return;
    this.fighter = fighter; this.name = name;
    const params = new URLSearchParams(typeof location === 'object' ? location.search : '');
    const asked = Number(params.get('round') ?? params.get('wave'));
    const round = options.wave ?? (Number.isInteger(asked) && asked > 0 ? asked : 1);
    const query = new URLSearchParams(typeof location === 'object' ? location.search : '');
    const picks = query.get('picks')?.split(',').filter(Boolean);
    const spawn = query.get('spawn')?.split(',').filter(Boolean);
    const relics = query.get('relics')?.split(',').filter(Boolean);
    const path = (query.get('path') ?? undefined) as PathKind | undefined;
    const bossHp = Number(query.get('bosshp')) || undefined, god = query.has('god'), quiet = query.has('quiet');
    const seed = options.seed ?? (Number(query.get('seed')) || ((Math.random() * 0x7fffffff | 0) || 1));
    const stage = quiet || spawn?.length ? locationFor(round).location.stage : dungeonFor(seed, round).location.stage;
    const collision=await this.destination(stage,round,spawn??[]);
    if(generation!==this.generation){collision?.dispose?.();return;}
    const autoLearn = query.has('autopilot');
    const allies = (query.get('allies')?.split(',').filter(Boolean) ?? []).slice(0, 3) as FighterId[];
    const { unlocked, bonus } = carried(fighter);
    const heroes = allies.length ? [{ id: PLAYER_ID, fighter, name, unlocked, bonus }, ...allies.map((ally, i) => ({ id: `ally-${i + 1}`, fighter: ally, name: `Ally ${i + 1}` }))] : undefined;
    this.game = new SurvivalGame({ fighter, name, seed, collision, round, picks, spawn, bossHp, god, quiet, autoLearn, unlocked, bonus, relics, path, ...(heroes ? { heroes } : {}) });
    this.allies = allies.map((_, i) => ({ id: `ally-${i + 1}`, pilot: new Autopilot(.8, `ally-${i + 1}`) }));
    this.allyDown = query.has('allydown');
    this.fallAt = Number(query.get('fall')) || 0;
    this.kinds = query.get('kinds')?.split(',').filter(Boolean) ?? []; this.kindsAt = 0;
    const points = Number(query.get('points'));
    if (points > 0) for (const hero of this.game.heroes.values()) hero.points = Math.floor(points);
    watchCrowd(this.game.horde);
    this.room = { send: () => {} };
    this.predictionReady = true;
    this.publish();
  }

  send(input: PlayerInput) {
    const game = this.game;
    if (!game) return false;
    if (game.phase === 'travel' && !this.travelling) void this.travel();
    if (this.paused || game.frozen) { this.clearPresses(); this.publish(); return true; }
    this.pressedAttack = input.attack ?? this.pressedAttack;
    this.pressedJump ||= !!input.jump; this.pressedDash ||= !!input.dash; this.pressedAwaken ||= !!input.awaken;
    this.owed += game.timeScale;
    this.rewards.input(input);
    let stepped = false;
    while (this.owed >= 1) {
      this.owed--;
      if (this.pressedAttack || this.pressedJump || this.pressedDash || this.pressedAwaken) {
        input = { ...input, attack: this.pressedAttack, jump: this.pressedJump, dash: this.pressedDash, awaken: this.pressedAwaken };
        this.clearPresses();
      }
      if (this.allies.length) {
        const players = game.sim.playerStates();
        for (const ally of this.allies) game.submit(ally.id, ally.pilot.command(players, game.sim.serverTime, game.horde));
        if (this.allyDown && game.sim.serverTime > 12) { this.allyDown = false; game.sim.damage(this.allies[0].id, 1e6, this.allies[0].id, 'Probe'); }
      }
      if (this.kinds.length && game.phase === 'fight' && game.sim.serverTime >= this.kindsAt && game.probeSpawn(this.kinds)) this.kindsAt = game.sim.serverTime + 15;
      if (this.fallAt && game.sim.serverTime > this.fallAt) {
        this.fallAt = 0;
        for (const hero of game.heroes.values()) { hero.stats.revives = 0; game.sim.damage(hero.id, 1e6, hero.id, 'Probe'); }
      }
      try { game.tick(input); } catch (error) { glitch(error, 'game'); }
      stepped = true;
      this.hordeFrames.next().capture(game.horde, game.sim.serverTime);
      input = { ...input, attack: undefined, jump: false, dash: false, awaken: false, seq: input.seq };
    }
    if (stepped || !this.snapshot) this.publish();
    return true;
  }

  private async travel() {
    const game = this.game;
    if (!game?.travelTo) return;
    this.travelling = true;
    try {
      const collision=await this.destination(game.travelTo,game.wave+1,[]);
      if (this.game === game) game.arrive(collision);else collision?.dispose?.();
    }
    catch (error) { console.warn('Survival: the next stage failed to load', error); if(this.game===game)game.arrive(); }
    finally { if(this.game===game)this.travelling = false; }
  }

  private async destination(stage:StageId,round:number,extra:readonly string[]){
    const [world,assets]=await Promise.allSettled([rapier().then(create=>create(stage)),Promise.resolve().then(()=>this.prepare?.(round,extra,stage))]);
    if(world.status==='rejected')throw world.reason;
    if(assets.status==='rejected'){world.value?.dispose?.();throw assets.reason;}
    return world.value;
  }

  private publish() {
    const game = this.game;
    if (!game) return;
    const snapshot = game.snapshot();
    this.snapshot = snapshot; this.receivedAt = performance.now();
    this.rewards.observe(game.phase, () => game.view(PLAYER_ID).result);
    this.onSnapshot(snapshot);
  }

  choose(id?: string) { this.game?.choose(id); if (this.game?.frozen) this.clearPresses(); }
  reroll() { this.game?.reroll(); this.publish(); }
  async retry() { await this.connect(this.fighter, 'match', this.name); }
  startPrivateMatch() {}
  async leave() {
    this.generation++;
    this.game?.dispose(); this.game = null; this.room = null; watchCrowd(undefined);
    this.snapshot = null; this.receivedAt = 0; this.predictionReady = false; this.owed = 0; this.paused = false; this.travelling = false;
    this.clearPresses();
    this.hordeFrames.clear(); this.rewards.reset();
  }
}
