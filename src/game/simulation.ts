import { isReleasedFighter } from './rosterAvailability';
import { tidyName } from './displayName';
import { TrainingLab } from './training/TrainingLab';
import { AREA_DEFAULTS, BURN_TICK, FREEZE_IMMUNITY } from './moves';
import { activeWindow, ADV_ON_HIT, PUSH_RADIUS, AIR_CAST_GRAVITY, PLUNGE_HANG, PLUNGE_LIMIT, AIR_DASH_SPEED, DASH_SECONDS, DASH_RISE, DASH_FALL, dashShape, AIR_NORMALS, ARENA_COLLIDERS, BREAK_EVADE, BREAK_FREEZE, BREAK_PUSH, CONTACT_GAP, contactGap, MAX_APPROACH, MAX_CLOSE, MAX_FLOOR_STUN, meleeReach, LAUNCH_GRAVITY, LAUNCH_LEAD, launchLead, STRING_SHOVE, STRING_DRAG, COMBO_WINDOW, GETUP_SECONDS, GUARD_BREAK_STUN,
  HITSTOP, INPUT_BUFFER, JUGGLE_DECAY, JUGGLE_LIFT, KNOCKDOWN_SECONDS, LAUNCH_KNOCKBACK, MAX_HP, MAX_JUGGLE,
  BREAK_CASTS, damageScale,
  MAX_PLAYERS, MOVES, PLAYER_RADIUS, TECH_DELAY, TECH_STAMINA,
  CHIP, GROUND_BOUNCE_LIFT, JUST_GUARD_ADVANTAGE, JUST_GUARD_METER, JUST_GUARD_WINDOW,
  AIR_CONTROL, BLOCK_PUSH, BLOCK_STUN, GROUND_ACCEL, GROUND_BRAKE, GROUND_TURN_ACCEL,
  WALL_SPLAT_SPEED, WALL_SPLAT_STUN,
  FALL_GRAVITY, JUMP_CUT_GRAVITY, JUMP_CUT_AFTER, ULTIMATE_COST, ULTIMATE_PER_DAMAGE, AWAKENING_PER_DAMAGE, AWAKENING_PER_BLOCKED,
  DASH_EVADE, BACKDASH_SECONDS, BACKDASH_TRAVEL, BACKDASH_EVADE, BACKDASH_ALONG,
  SIDESTEP_SECONDS, SIDESTEP_TRAVEL, SIDESTEP_ALONG, dashPeakSpeed,
  airRushName, AIR_RUSH, RUSH_AIR_STAGES, RUSH_STAGES, RUSH_WINDOW,
  VANISH_AIM, VANISH_BEHIND, VANISH_COOLDOWN, VANISH_EVADE, VANISH_ON_JUST_GUARD, VANISH_STUMBLE,
  CHASE_EXIT, CHASE_MAX_SPEED, CHASE_RANGE, CHASE_SECONDS, CHASE_WINDOW, LIGHT_CHASE_WINDOW, LAUNCH_HOLD_RANGE,
  CHARGE_BACKSTEP_UNTIL, DASH_THROUGH_LEAD, DASH_THROUGH_MAX_SPEED, DASH_THROUGH_MISS, DASH_THROUGH_PAST, DASH_THROUGH_REACH, DASH_THROUGH_SIDE,
  HARD_GAP, SPACING_PUSH, CHARGE_DRIVE, CHARGE_SLIDE, STAMINA_OVERDRAW, STAMINA_REGEN, BODY_SIZE } from './moves';
import type { DashKind, MoveDefinition, SlotMoves } from './moves';
import { HELD } from './economy/fighters';
import { comboKeyFor, comboMove, hasCombos, type ComboKey } from './combos';
import { AIR_FLING, AIR_SPIKE_DRIVE, AIR_STRING_LIFTOFF, BEAT_EARLY, ENDER_SCALING, KNOCK_DRAG, MASH_INTERVAL, MASH_SCALE, POP_LAND_STUN, RHYTHM_BONUS, SPIKE_BOUNCE } from './moves';
import { DIZZY_GUARD, DIZZY_SECONDS, LAUNCHING, OUTCOME_DOWN, OUTCOME_LIFT, SPIN_ANGLE, SPIN_SECONDS, STAGGER_GUARD, STAGGER_SPENT, WALL_BOUNCE_BACK, WALL_BOUNCE_LIFT, type Outcome } from './moves';
import { BLOCK_DRAG, BLOCK_PUSH_ENDER, BLOCK_RECOIL, GUARD_COST, GUARD_COST_DAMAGE, GUARD_FRONT, GUARD_REAR_COST, JUST_GUARD_ADVANTAGE_KIT,
  PARRY_FREEZE, PARRY_LOCKOUT, PARRY_REACH, PARRY_REARM, PARRY_STAMINA } from './moves';
import { BIG_ENDER_HOLD, BIG_HITSTOP, BIG_LAUNCH_MOST } from './moves';
import { GROUND_HIT_HOLD, GROUND_HIT_MOST, GROUND_HIT_SHOVE, groundHitDamage } from './moves';
import { isBigBlow } from './bigBlow';
import { bombLead, homeStep, homeWant, inRange, BOMB_COMMIT, BOMB_HOME } from './bombAim';
import { NavGrid } from './botNav';
import { AIR_CAST_BRAKE, AIR_CAST_RISE, AIR_HOME_DROP, AIR_STRIKE_BLIND, AIR_STRIKE_REACH, AIR_STRIKE_SPEED, jumpArc, jumpGravity,
  JUMP_LAND_HARD, JUMP_LAND_RECOVERY, LEAP_GROUNDED, PLUNGE_BRAKE, PLUNGE_IMPACT_DROP, PLUNGE_SNAP } from './moves';
import { AWAKENED_DAMAGE, AWAKENED_RESIST, AWAKENED_SPEED, AWAKENING_COST, AWAKENING_ENTRY,
  AWAKENING_SECONDS, AWAKENINGS, AWAKENED_MOVES, moveFor, rushMove } from './awakening';
import { traitsOf } from '../engine/sim/traits';
import { areaFalloff, isBullseye, strikeOffsets } from '../engine/sim/areaDamage';
import { blinkWindow, planTour, priorVisits, REVISIT_TURN, TIME_STOP_TOURS, tourBlows, tourContacts, visitCount, visitOf, visitVictim,
  type TimeStopTour, type TourStyle } from './timeStopBarrage';
import { STAGES, type StageId } from './stages';
import { stageColliders } from './environmentLayout';
import type { AttackSlot, CollisionMovement, CollisionWorld, CombatEvent, FighterId, GameSnapshot, PlayerInput, PlayerState, ReactionKind, RoomMode, Vec3 } from './types';

const TAU = Math.PI * 2;
const slots: AttackSlot[] = ['light', 'heavy', 'special', 'ultimate', 'area'];
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const LAG_COMPENSATION = .25;
export const RISE_FROM = .9, RISE_REACH = 5.2, RISE_SPEED = 42, RISE_SETTLE = 1.5;
const CHASE_STICK_COS = Math.cos(1.05);
const meleeHeight = (p: PlayerState, q: PlayerState) => {
  const dy = q.y - p.y;
  return Math.abs(dy) <= 1.6 || p.grounded && !q.grounded && dy > 0 && dy <= RISE_REACH;
};
const aimsAsLetGo = (m: MoveDefinition) => m.style === 'projectile' || (m.style !== 'bomb' && !!m.aimOnRelease);
const DEFEAT_TIME = 3;
const position = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z });
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const centre = (p: Vec3): Vec3 => ({ x: p.x, y: p.y + 1.05, z: p.z });
const centreOf = (p: PlayerState): Vec3 => p.size ? { x: p.x, y: p.y + 1.05 * p.size, z: p.z } : centre(p);
const radiusOf = (p: PlayerState) => p.size ? PLAYER_RADIUS * p.size : PLAYER_RADIUS;
const areaBlow = (off: number, radius: number) => ({ scale: areaFalloff(off, radius), bullseye: isBullseye(off, radius) });
const pushOf = (p: PlayerState) => p.girth ?? (p.size ? PUSH_RADIUS * p.size : PUSH_RADIUS);
const attackOrigin=(p:PlayerState,move:MoveDefinition):Vec3=>{const o=move.origin;return o?{x:p.x+Math.cos(p.yaw)*o.right+Math.sin(p.yaw)*o.forward,y:p.y+o.up,z:p.z-Math.sin(p.yaw)*o.right+Math.cos(p.yaw)*o.forward}:centre(p);};
function safeSpawn(index:number, stage:StageId, taken:readonly Vec3[]=[], turn?:number):Vec3 {
  let base=index/12*TAU;
  if(stage!=='harbor'){
    const {halfX,halfZ,spawnRadius}=STAGES[stage];
    const rx=Math.min(spawnRadius,halfX-PLAYER_RADIUS*2);
    const rz=Math.min(spawnRadius*halfZ/halfX,halfZ-PLAYER_RADIUS*2);
    base=turn===undefined?ellipseSeat(index/12+(STAGES[stage].seatTurn??0)/TAU,rx,rz):ellipseSeat(index/12,rx,rz)+turn;
    const room=(x:number,z:number)=>Math.abs(x)<=halfX-PLAYER_RADIUS*2&&Math.abs(z)<=halfZ-PLAYER_RADIUS*2;
    for(const scale of [1,.85,1.15,.7,1.3,.55,.4])for(const offset of [0,.08,-.08,.16,-.16,.24,-.24,.36,-.36,.5,-.5]){
      const x=Math.sin(base+offset)*rx*scale,z=Math.cos(base+offset)*rz*scale;
      if(room(x,z)&&clearOfLandmarks(stage,x,z)&&taken.every(t=>Math.hypot(t.x-x,t.z-z)>2.5))return {x,y:0,z};
    }
    return {x:Math.sin(base)*rx,y:0,z:Math.cos(base)*rz};
  }
  for(const radius of [36,30,24,18,12])for(const offset of [0,.08,-.08,.16,-.16]){
    const p={x:Math.sin(base+offset)*radius,y:0,z:Math.cos(base+offset)*radius};
    const water=p.z < -27 && p.z > -43 && Math.abs(Math.abs(p.x)-27)>3.5;
    if(!water&&!ARENA_COLLIDERS.some(c=>Math.abs(p.x-c.x)<c.halfX+.9&&Math.abs(p.z-c.z)<c.halfZ+.9))return p;
  }
  return {x:Math.sin(base)*9,y:0,z:Math.cos(base)*9};
}

function ellipseSeat(t:number,rx:number,rz:number){
  t=((t%1)+1)%1;
  if(Math.abs(rx-rz)<1e-6)return t*TAU;
  const N=96,arc=[0];
  for(let i=1;i<=N;i++){const a=(i-.5)/N*TAU;arc.push(arc[i-1]+Math.hypot(rx*Math.cos(a),rz*Math.sin(a))*TAU/N);}
  const want=t*arc[N];
  let i=1;while(i<N&&arc[i]<want)i++;
  const f=(want-arc[i-1])/Math.max(arc[i]-arc[i-1],1e-9);
  return (i-1+f)/N*TAU;
}

function clearOfLandmarks(stage:StageId,x:number,z:number){
  const gap=PLAYER_RADIUS*2;
  return !stageColliders(stage).landmarks.some(c=>c.y-c.halfY<1.8&&Math.abs(x-c.x)<c.halfX+gap&&Math.abs(z-c.z)<c.halfZ+gap);
}
function clearSpot(stage:StageId,want:Vec3):Vec3 {
  if(clearOfLandmarks(stage,want.x,want.z))return want;
  const {halfX,halfZ}=STAGES[stage];
  for(let r=1;r<=24;r++)for(let k=0;k<16;k++){
    const a=k/16*TAU,x=want.x+Math.sin(a)*r,z=want.z+Math.cos(a)*r;
    if(Math.abs(x)<=halfX-PLAYER_RADIUS*2&&Math.abs(z)<=halfZ-PLAYER_RADIUS*2&&clearOfLandmarks(stage,x,z))return {x,y:want.y,z};
  }
  return want;
}
function trainingReach(stage:StageId){ return Math.min(12, STAGES[stage].halfZ - 2); }
function trainingSpawn(index:number, stage:StageId):Vec3 {
  const {halfX}=STAGES[stage];
  const spread=Math.min(4,(halfX-PLAYER_RADIUS*2)/2);
  return clearSpot(stage,{ x: (index % 5 - 2) * spread, y: 0, z: trainingReach(stage) * .25 });
}

interface Cinematic { at: number; ids: string[]; evade: number[]; pins?: Vec3[]; from?: Vec3; own: number; done?: boolean }

interface Cast {
  id: number;
  stage: number;
  slot: AttackSlot;
  branch?: ComboKey;
  landed?: boolean;
  plungeFrom?: number;
  dive?: { x: number; y: number; z: number; until: number; rise?: true };
  riseOn?: string;
  move: MoveDefinition;
  start: number;
  networkHold?: number;
  nextContact: number;
  live?: { index: number; until: number }[];
  direction: Vec3;
  endpoint: Vec3;
  lungeTargetId?: string;
  aimId?: string;
  externalAim?: string;
  backstep?: number;
  backstepPlanned?: number;
  backstepUntil?: number;
  through?: { from: Vec3; to: Vec3 };
  tour?: TimeStopTour;
  cine?: Cinematic;
  whiff?: number;
  full?: MoveDefinition;
  connected: boolean;
  airborne: boolean;
  opened: Map<string, number>;
  blink?: { from: Vec3; targetId?: string; to?: Vec3 };
  beat?: boolean;
  mash?: boolean;
}
const AT_REST: CollisionMovement = Object.freeze({ x: 0, y: 0, z: 0, grounded: true });
const REST_DRIFT = .05;

interface Actor {
  inputGap?: number;
  viewLag?: number;
  motionNetworkHold?: number;
  state: PlayerState;
  input: PlayerInput;
  lastSeq: number;
  lastInputAt: number;
  vy: number;
  kx: number;
  kz: number;
  knockbackDrag: number;
  launchSlot?: AttackSlot;
  reaction: ReactionKind | null;
  hitstopFrom: number;
  hitstopUntil: number;
  reactionClip: number;
  comboUntil: number;
  stunUntil: number;
  freezeUntil: number;
  evadeUntil: number;
  dashUntil: number;
  dashX: number;
  dashY: number;
  dashZ: number;
  dashSpeed: number;
  dashEntry: number;
  dashPlateau: number;
  dashSeconds: number;
  dashKind: DashKind;
  jumping: boolean;
  juggleHits: number;
  jumpAt: number;
  jumpStartedAt: number;
  groundedAt: number;
  leapt: boolean;
  landedUntil: number;
  dashAt: number;
  attackAt: number;
  attackSeq?: number;
  attackYaw?: number;
  attackAim?: { x: number; z: number };
  attackHold: number;
  attackNotified: number;
  awakenAt: number;
  awakenEntryUntil: number;
  attackSlot?: AttackSlot;
  cast: Cast | null;
  respawnAt: number;
  nextBotThink: number;
  lastDamageAt: number;
  chainHits: number;
  scalingHits: number;
  spawn: Vec3;
  guardAt: number;
  wasGuarding: boolean;
  guardHeld: boolean;
  guardPressedAt: number;
  guardReleasedAt: number;
  parryCaught: boolean;
  parryLockUntil: number;
  counterUntil: number;
  parriedUntil: number;
  bounceOnLand: boolean;
  launchLead: number; launchSpan: number; launchRun: number;
  downFor?: number;
  wallBounce?: boolean;
  wallBounceBy?: string;
  spinLeft?: number;
  spinRate?: number;
  staggeredAt?: number;
  dizzyAt?: number;
  dizzyOnLand?: boolean;
  pressQueue?: AttackSlot[];
  botSkill: number;
  mx: number;
  mz: number;
  blockedUntil: number;
  castSerial: number;
  rushStage: number;
  rushUntil: number;
  rushOpened: [string, number][];
  chaseTargetId?: string;
  chaseUntil: number;
  lightChaseUntil: number;
  dashChase: boolean;
  vanishedAt: number;
  vanishOn?: string;
  intent: string | null;
  intentCast: number;
  faceYaw: number;
  goneUntil?: number;
  holding?: { cast: number; ids: string[] };
  botRead?: string;
  botGuardFrom?: number;
  botGuardUntil?: number;
  botTimed?: boolean;
  botWinded?: boolean;
  kit?: SlotMoves;
  forged?: Record<AttackSlot, MoveDefinition>;
  statuses?: { burn?: { until: number; dps: number; from: string; next: number }; slow?: { until: number; factor: number };
    freeze?: { until: number }; immuneUntil?: number };
  external?: boolean;
  size?: number;
  poise?: number;
  poiseMax?: number;
  poiseBrokenUntil?: number;
  breaker?: boolean;
  armour?: boolean;
  anchored?: boolean;
  mods?: CombatMods;
  minorArmourUntil?: number;
  externalFreezeTick?: number;
  chosenExternal?: string;
  lightPressAt: number;
  mashStreak: number;
  stringMash: boolean;
  enderRushed: boolean;
  attackBeat: boolean;
  attackPaced: boolean;
  popLand: boolean;
  dazeFor: number;
  knockKind: '' | 'spike' | 'slide';
  floorUntil: number;
  floorHits: number;
  floorTaken: number;
}
const pressClock = () => ({ lightPressAt: -Infinity, mashStreak: 0, stringMash: false, enderRushed: false, attackBeat: false,
  attackPaced: false, popLand: false, dazeFor: 0, knockKind: '' as const,
  floorUntil: -Infinity, floorHits: 0, floorTaken: 0 });

export interface CombatMods {
  damageOut: number;
  damageIn: number;
  speed: number;
  knockbackIn: number;
  stunIn: number;
  cooldown: number;
  stamina: number;
  meterGain: number;
  awakenGain: number;
  lifesteal: number;
  crit: number;
  critDamage: number;
  awakenSeconds: number;
  staminaRegen: number;
  staminaRecovery?: number;
}
export const NEUTRAL_MODS: Readonly<CombatMods> = { damageOut: 1, damageIn: 1, speed: 1, knockbackIn: 1, stunIn: 1,
  cooldown: 1, stamina: 1, meterGain: 1, awakenGain: 1, lifesteal: 0, crit: 0, critDamage: 2, awakenSeconds: 0, staminaRegen: 0 };

export interface CombatantSpec {
  fighter?: FighterId;
  name?: string;
  enemy?: string;
  team: string;
  kit: SlotMoves;
  maxHp: number;
  size?: number;
  poise?: number;
  breaker?: boolean;
  mods?: Partial<CombatMods>;
  spawn: Vec3;
  yaw?: number;
  armour?: boolean;
  anchored?: boolean;
  girth?: number;
}

export interface ExternalBody { id: string; x: number; y: number; z: number; radius: number; height: number; airborne: boolean }
export interface ExternalBlow {
  attackerId: string; slot: AttackSlot; move: MoveDefinition; damage: number; critical: boolean; finisher: boolean;
  pushX: number; pushZ: number;
  knockback: number; stun: number;
  launch: boolean;
  hitstop: number;
}
export interface ExternalTargets {
  hostile?(attackerId:string,body:ExternalBody):boolean;
  query(a: Vec3, b: Vec3, radius: number, out: ExternalBody[]): number;
  receive(body: ExternalBody, blow: ExternalBlow): { damage: number; reaction?: ReactionKind; killed: boolean } | null;
  freeze(centre: Vec3, radius: number, seconds: number, attackerId?:string): void;
  locate(id: string): ExternalBody | undefined;
}
export interface AimAssist { magnet: number }
const MINOR_GRACE = .9;
const BOT_PARRY = [.03, .3] as const;
const BOT_BLOCK = [.2, .5] as const;
const BOT_TIMING = [.07, .045] as const;
const BOT_READ = .4;
const BOT_TURTLE = [.12, .2] as const;
const BOT_REACTION = [.34, .24] as const;
const BOT_REACTION_SPREAD = .03;
const BOT_PARRY_LEAD = .03;
const BOT_GUARD_LEAD = .19;
const unitSpread = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295 * 2 - 1;
};
const BOT_GUARD_STAMINA = 30;
const BOT_WINDED = [8, 18, 14] as const;
const EXTERNAL_METER = .45;
const DETACHED_METER = .35;

export type PredictionCheckpoint = Omit<Actor,'state'|'cast'> & {
  cast: (Omit<Cast,'opened'> & {opened:[string,number][];openedGroup:number}) | null;
  shots: (Omit<Projectile,'opened'> & {opened:[string,number][];openedGroup:number})[];
};
const REACTION_KEYS=['vy','kx','kz','knockbackDrag','reaction','reactionClip','stunUntil','evadeUntil',
  'hitstopFrom','hitstopUntil','freezeUntil','blockedUntil','lastDamageAt','launchSlot','bounceOnLand',
  'juggleHits','chainHits','scalingHits','jumping','jumpStartedAt','dashUntil','mx','mz','goneUntil',
  'popLand','knockKind','dazeFor',
  'parriedUntil',
  'floorUntil','floorHits','floorTaken',
  'launchLead','launchSpan','launchRun'] as const;
export type ReactionCheckpoint=Pick<Actor,typeof REACTION_KEYS[number]>;
interface Projectile {
  actorId: string;
  aimId?: string;
  fighter: FighterId;
  slot: AttackSlot;
  move: MoveDefinition;
  start: Vec3;
  end: Vec3;
  startAt: number;
  duration: number;
  previous: Vec3;
  opened: Map<string, number>;
  castId: number;
  stage: number;
  pierced?: Set<string>;
  beat?: boolean;
  mash?: boolean;
  aimed?: Vec3;
}

export interface SimulationOptions {
  roomMode?: RoomMode;
  stage?: StageId;
  collision?: CollisionWorld;
  trainingBot?: boolean;
  seed?: number;
  capacity?: number;
  respawn?: boolean;
  maxStamina?: number;
  maxHp?: number;
  koHeal?: number;
  resolveAreas?: boolean;
}

interface AreaStrike {
  actorId: string; fighter: FighterId; move: MoveDefinition;
  at: Vec3;
  due: number; offsets: number[]; next: number;
  castId: number; opened: Map<string, number>;
}
interface AreaBlow { scale: number; bullseye: boolean }

const CANCEL_ROUTES: Record<AttackSlot, AttackSlot[]> = {
  area: [],
  light: ['light', 'heavy', 'special', 'ultimate'],
  heavy: ['light', 'heavy', 'special', 'ultimate'],
  special: ['ultimate'],
  ultimate: [],
};
const ARMOUR_BREAKING: AttackSlot[] = ['special', 'ultimate'];
function breaksArmour(incoming: AttackSlot, committed: AttackSlot): boolean {
  return committed === 'ultimate' ? incoming === 'ultimate' : ARMOUR_BREAKING.includes(incoming);
}
const DEFAULT_MELEE_LUNGE = 3.2;
const POISE_SLOT: Record<AttackSlot, number> = { light: 1, heavy: 1.6, special: 2, ultimate: 3, area: 2 };
const POISE_BREAK_STUN = 2.6;
const POISE_GRACE = 1.2;
const POISE_REGEN_DELAY = 3;
const POISE_REGEN = .12;
const drives = (fighter: FighterId, move: MoveDefinition) => move.lunge === undefined || (!!traitsOf(fighter).driveMelee && move.style === 'melee');
const driveWindowOf = (fighter: FighterId, move: MoveDefinition) => move.chargeIn && drives(fighter, move)
  ? Math.min(CHARGE_DRIVE, move.contacts[0] * .65, Math.max(move.contacts[0] - CHARGE_SLIDE, .1)) : Math.min(.35, move.contacts[0] * .65);
function backstepWindow(fighter: FighterId, move: MoveDefinition) {
  const drive = move.dashThrough ? move.contacts[0] - DASH_THROUGH_LEAD
    : drives(fighter, move) ? move.contacts[0] - driveWindowOf(fighter, move) : move.lungeDelay ?? 0;
  return clamp(drive, .1, CHARGE_BACKSTEP_UNTIL);
}
const ROSTER = (Object.keys(MOVES) as FighterId[]).filter(f => isReleasedFighter(f) && !HELD.has(f));
const BACKDASH_SPEED = dashPeakSpeed(BACKDASH_SECONDS, BACKDASH_TRAVEL);
const SIDESTEP_SPEED = dashPeakSpeed(SIDESTEP_SECONDS, SIDESTEP_TRAVEL);
const CHASE_UNIT = dashPeakSpeed(CHASE_SECONDS, 1);
const JUGGLE_RIDE_AHEAD = .25;
const RECOVERY_GRACE = 0.06;
const LIGHT_RECOVERY_GRACE = 0.015;
const MELEE_AIM_COS = Math.cos(0.96);
const CHOSEN_AIM_COS = Math.cos(1.4);
const INTENT_COS = Math.cos(Math.PI / 3);
const INTENT_TURN = .55;
const AGE_EPSILON = 1e-6;
const LANE_FRONT = PLAYER_RADIUS;
const SHOT_TRACK = 6, SHOT_LEAD = 3.5, SHOT_CONE = .9;
const CINEMATIC_MARGIN = .05;
const LET_GO_STUN = .3;
const SCHEDULED = new WeakMap<MoveDefinition, MoveDefinition[]>();
function scheduled(move: MoveDefinition, contact: number): MoveDefinition {
  const damage = move.schedule?.[contact];
  if (damage === undefined) return move;
  let each = SCHEDULED.get(move);
  if (!each) { each = []; SCHEDULED.set(move, each); }
  return each[contact] ??= { ...move, damage, finisherDamage: damage };
}

export function validateInput(raw: unknown): PlayerInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const i = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(i.seq) || (i.seq as number) < 0) return null;
  for (const k of ['moveX', 'moveZ', 'yaw']) if (typeof i[k] !== 'number' || !Number.isFinite(i[k])) return null;
  if (Math.abs(i.moveX as number) > 1 || Math.abs(i.moveZ as number) > 1 || Math.abs(i.yaw as number) > 1e6) return null;
  for (const k of ['jump', 'jumpHeld', 'dash', 'guard', 'awaken', 'lock']) if (i[k] !== undefined && typeof i[k] !== 'boolean') return null;
  if (i.attack !== undefined && !slots.includes(i.attack as AttackSlot)) return null;
  if (i.targetId !== undefined && i.targetId !== null && (typeof i.targetId !== 'string' || i.targetId.length > 128)) return null;
  if (i.view !== undefined && (typeof i.view !== 'number' || !Number.isFinite(i.view) || i.view < 0)) return null;
  const aim = i.aim as { x?: unknown; z?: unknown } | undefined;
  if (aim !== undefined && (!aim || typeof aim !== 'object' || typeof aim.x !== 'number' || typeof aim.z !== 'number'
    || !Number.isFinite(aim.x) || !Number.isFinite(aim.z) || Math.abs(aim.x) > 1e4 || Math.abs(aim.z) > 1e4)) return null;
  return { seq: i.seq as number, moveX: i.moveX as number, moveZ: i.moveZ as number,
    yaw: (((i.yaw as number) + Math.PI) % TAU + TAU) % TAU - Math.PI,
    jump: i.jump as boolean | undefined, jumpHeld: i.jumpHeld as boolean | undefined, dash: i.dash as boolean | undefined,
    guard: i.guard as boolean | undefined, awaken: i.awaken as boolean | undefined,
    attack: i.attack as AttackSlot | undefined,
    targetId: i.targetId as string | null | undefined, lock: i.lock as boolean | undefined,
    ...(i.view !== undefined ? { view: i.view as number } : {}), ...(aim ? { aim: { x: aim.x as number, z: aim.z as number } } : {}) };
}

interface BotMind {
  targetId?: string;
  routes: Map<string, { cells: number[] | null; x: number; z: number; at: number }>;
  best: number; bestAt: number;
  stillX: number; stillZ: number; stillSince: number;
  given: Map<string, number>;
}
const BOT_GIVE_UP_AFTER = 4, BOT_GIVE_UP_FOR = 7;
const BOT_REPLAN = 1.2;
const HUNT_QUIET = 12;
const HUNT_ANYWAY = 24;
const BOT_BUSY = 3, BOT_BUSY_NEAR = 8;
const BOT_SPREAD = 8, BOT_TAKE_ON = 6;

export class ArenaSimulation {
  readonly actors = new Map<string, Actor>();
  readonly roomMode: RoomMode;
  serverTime = 0;
  tick = 0;
  status: GameSnapshot['status'];
  winnerId: string | null = null;
  private events: CombatEvent[] = [];
  readonly trainingLab = new TrainingLab();
  trainingBotMode: 'passive'|'combat'='combat';
  private readonly minds = new Map<string, BotMind>();
  private eventId = 0;
  private randomState: number;
  private projectiles: Projectile[] = [];
  private areas: AreaStrike[] = [];
  private readonly resolveAreas: boolean;
  private startedAt = 0;
  private readonly hunts = new Map<string, { by: string; since: number; anyway?: boolean }>();
  private readonly dealt = new Map<string, { total: number; at: number }>();
  private collision?: CollisionWorld;
  stage: StageId;
  private readonly capacity: number;
  private readonly respawns: boolean;
  readonly staminaMax: number;
  readonly hpMax: number;
  readonly koHeal: number;
  rewind = 0;
  private readonly trail = new Map<string, { t: number; x: number; y: number; z: number }[]>();
  external?: ExternalTargets;
  assist?: AimAssist;
  private readonly nearby: ExternalBody[] = [];

  constructor(options: SimulationOptions = {}) {
    this.roomMode = options.roomMode ?? 'training';
    this.status = this.roomMode === 'training' ? 'active' : 'waiting';
    this.stage = options.stage ?? 'harbor';
    this.collision = options.collision;
    this.capacity = options.capacity ?? MAX_PLAYERS;
    this.respawns = options.respawn ?? true;
    this.staminaMax = options.maxStamina ?? 100;
    this.hpMax = options.maxHp ?? MAX_HP;
    this.koHeal = options.koHeal ?? 0;
    this.resolveAreas = options.resolveAreas ?? true;
    this.randomState = options.seed ?? (((Math.random() * 0x7fffffff) | 0) || 1);
    if (this.roomMode === 'training' && options.trainingBot !== false) {
      this.addPlayer('sparring-bot', this.pick(ROSTER), 'Sparring bot', true, clearSpot(this.stage, { x: 0, y: 0, z: -trainingReach(this.stage) * .55 }));
    }
  }

  pick<T>(items: readonly T[]): T { return items[Math.min(items.length - 1, Math.floor(this.random() * items.length))]; }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  get bounds() { return STAGES[this.stage]; }

  setStage(stage: StageId, collision?: CollisionWorld) {
    if (stage === this.stage && !collision) return;
    this.stage = stage;
    if (collision) {
      this.collision?.dispose?.();
      this.collision = collision;
    }
    for (const actor of this.actors.values()) this.collision?.remove?.(actor.state.id);
  }

  private random() {
    this.randomState ^= this.randomState << 13;
    this.randomState ^= this.randomState >>> 17;
    this.randomState ^= this.randomState << 5;
    return (this.randomState >>> 0) / 4294967296;
  }

  addPlayer(id: string, fighter: FighterId = 'goku', name = 'Fighter', isBot = false, spawn?: Vec3): PlayerState {
    if (this.actors.has(id)) throw new Error('Player already exists');
    if (this.actors.size >= this.capacity) throw new Error('Arena is full');
    if (this.roomMode === 'match' && this.status !== 'waiting') throw new Error('Match already started');
    const index = [...this.actors.values()].filter(a => this.roomMode === 'match' || !a.state.isBot).length;
    const angle = index / MAX_PLAYERS * TAU;
    const origin = spawn ?? (this.roomMode === 'training'
      ? trainingSpawn(index, this.stage)
      : safeSpawn(index, this.stage));
    const state: PlayerState = {
      id, name: tidyName(name, 20),
      fighter: fighter in MOVES ? fighter : 'goku', ...position(origin), yaw: isBot ? 0 : Math.PI,
      hp: this.hpMax, maxHp: this.hpMax, stamina: this.staminaMax, maxStamina: this.staminaMax, ultimate: 0, awakening: 0, action: 'idle',
      actionStarted: this.serverTime, actionDuration: 0, actionTime: 0,
      target: this.roomMode === 'training' && !isBot && this.actors.has('sparring-bot') ? 'sparring-bot' : null,
      alive: true, isBot, grounded: origin.y <= 0.01, guarding: false,
      kills: 0, damageDealt: 0, damageTaken: 0,
      cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0, area: 0 },
    };
    if (BODY_SIZE[state.fighter]) state.size = BODY_SIZE[state.fighter];
    const sparring = this.roomMode === 'training' && !isBot ? this.actors.get('sparring-bot') : undefined;
    if (sparring && ![...this.actors.values()].some(a => !a.state.isBot)) {
      sparring.state.fighter = this.pick(ROSTER.filter(f => f !== state.fighter));
      sparring.state.size = BODY_SIZE[sparring.state.fighter];
    }
    this.actors.set(id, { state, input: { seq: -1, moveX: 0, moveZ: 0, yaw: state.yaw }, lastSeq: -1,
      lastInputAt: this.serverTime, vy: 0, kx: 0, kz: 0, knockbackDrag: 7, reaction: null,
      hitstopFrom: 0, hitstopUntil: 0, comboUntil: 0, stunUntil: 0, freezeUntil:0, evadeUntil: 0, reactionClip: .3,
      dashUntil: 0, dashX: 0, dashY: 0, dashZ: 0, dashSpeed: 24, dashEntry: 0, dashPlateau: 1, juggleHits: 0,
      dashSeconds: DASH_SECONDS, dashKind: 'forward', jumping: false,
      jumpAt: -Infinity, jumpStartedAt: -Infinity, dashAt: -Infinity, attackAt: -Infinity, attackHold: -Infinity, attackNotified: -Infinity,
      groundedAt: -Infinity, leapt: false, landedUntil: -Infinity,
      awakenAt: -Infinity, awakenEntryUntil: 0,
      cast: null, respawnAt: 0, nextBotThink: 0,
      lastDamageAt: -10, chainHits: 0, scalingHits: 0, spawn: position(origin),
      guardAt: -Infinity, wasGuarding: false, guardHeld: false, guardPressedAt: -Infinity,
      guardReleasedAt: -Infinity, parryCaught: false, parryLockUntil: -Infinity, counterUntil: -Infinity, parriedUntil: -Infinity,
      bounceOnLand: false, launchLead: 0, launchSpan: 0, launchRun: 0, botSkill: this.random(),
      mx: 0, mz: 0, blockedUntil: -Infinity, castSerial: 0, rushStage: 0, rushUntil: -Infinity, rushOpened: [],
      chaseUntil: -Infinity, lightChaseUntil: -Infinity, dashChase: false, vanishedAt: -Infinity, intent: null, intentCast: -1, faceYaw: state.yaw,
      ...pressClock() });
    return { ...state, cooldowns: { ...state.cooldowns } };
  }

  addCombatant(id: string, spec: CombatantSpec): PlayerState {
    this.addPlayer(id, spec.fighter ?? 'ace', spec.name ?? 'Enemy', true, spec.spawn);
    const a = this.actors.get(id)!;
    a.kit = { ...spec.kit }; a.external = true;
    a.poise = a.poiseMax = spec.poise ?? 0;
    a.breaker = spec.breaker ?? true;
    a.armour = spec.armour ?? true;
    a.anchored = spec.anchored;
    a.mods = { ...NEUTRAL_MODS, ...spec.mods };
    Object.assign(a.state, { team: spec.team, enemy: spec.enemy, hp: spec.maxHp, maxHp: spec.maxHp,
      yaw: spec.yaw ?? a.state.yaw, size: spec.size && spec.size !== 1 ? spec.size : undefined, poise: a.poiseMax > 0 ? 1 : undefined, girth: spec.girth });
    a.input.yaw = a.state.yaw;
    return { ...a.state, cooldowns: { ...a.state.cooldowns } };
  }

  command(id: string, input: Omit<PlayerInput, 'seq'>): boolean {
    const a = this.actors.get(id);
    return !!a && this.submitInput(id, { ...input, seq: a.lastSeq + 1 });
  }

  setMove(id: string, slot: AttackSlot, move: MoveDefinition) {
    const a = this.actors.get(id);
    if (a?.kit) a.kit[slot] = move;
  }

  setMods(id: string, mods: Partial<CombatMods>) {
    const a = this.actors.get(id);
    if (a) a.mods = { ...NEUTRAL_MODS, ...a.mods, ...mods };
  }
  mods(id: string): Readonly<CombatMods> { return this.actors.get(id)?.mods ?? NEUTRAL_MODS; }

  setTeam(id: string, team: string | undefined) {
    const a = this.actors.get(id);
    if (a) a.state.team = team;
  }

  strike(attackerId: string, targetId: string, slot: AttackSlot, move: MoveDefinition, origin?: Vec3, minor = false, crowd = false) {
    const attacker = this.actors.get(attackerId), target = this.actors.get(targetId);
    if (!target || !target.state.alive || this.status !== 'active') return;
    if (attacker && !this.hostile(attacker.state, target.state)) return;
    const from = origin ?? (attacker ? centre(attacker.state) : centreOf(target.state));
    this.hit(attackerId, target, slot, move, from, true, from, undefined, undefined, undefined, 0, undefined, minor, crowd);
  }

  strikeExternal(attackerId: string, id: string, slot: AttackSlot, move: MoveDefinition, origin?: Vec3) {
    const body = this.external?.locate(id);
    if (!body || this.status !== 'active') return false;
    const attacker = this.actors.get(attackerId);
    return this.hitExternal(attackerId, body, slot, move, origin ?? (attacker ? centre(attacker.state) : { x: body.x, y: body.y + body.height * .55, z: body.z }), true);
  }

  heal(id: string, amount: number) {
    const p = this.actors.get(id)?.state;
    if (p?.alive && amount > 0) p.hp = Math.min(p.maxHp, p.hp + amount);
  }

  setMaxHp(id: string, maxHp: number, heal = 0) {
    const p = this.actors.get(id)?.state;
    if (!p || !(maxHp > 0)) return;
    const share = p.hp / p.maxHp;
    p.maxHp = maxHp; p.hp = Math.min(maxHp, Math.max(1, share * maxHp) + heal);
  }

  addMeter(id: string, ultimate: number, awakening = 0) {
    const p = this.actors.get(id)?.state;
    if (!p) return;
    p.ultimate = Math.min(100, p.ultimate + ultimate);
    p.awakening = Math.min(100, (p.awakening ?? 0) + awakening);
  }

  damage(targetId: string, amount: number, sourceId: string, move: string) {
    const target = this.actors.get(targetId);
    if (!target?.state.alive || this.status !== 'active' || !(amount > 0)) return;
    const p = target.state, before = p.hp;
    p.hp = Math.max(0, p.hp - amount * (target.mods ? target.mods.damageIn : 1));
    this.tally(target, this.actors.get(sourceId), before - p.hp);
    this.emit({ kind: 'hit', actorId: sourceId, targetId, move, damage: Math.round(before - p.hp), origin: centreOf(p), endpoint: centreOf(p) });
    if (p.hp === 0) this.eliminate(target, sourceId);
  }

  revive(id: string, hp: number) {
    const a = this.actors.get(id);
    if (!a || a.state.alive) return;
    const at = position(a.state), yaw = a.state.yaw, ultimate = a.state.ultimate, awakening = a.state.awakening;
    this.respawn(a);
    Object.assign(a.state, at, { yaw, ultimate, awakening, hp: Math.min(a.state.maxHp, Math.max(1, hp)) });
    a.evadeUntil = this.serverTime + 2;
  }

  place(id: string, at: Vec3, yaw = 0) {
    const a = this.actors.get(id);
    if (!a) return;
    Object.assign(a.state, position(at), { yaw, grounded: true });
    a.vy = a.kx = a.kz = a.mx = a.mz = 0; a.spawn = position(at);
    a.input = { ...a.input, yaw, moveX: 0, moveZ: 0 };
    this.collision?.remove?.(id);
  }

  playerStates(): PlayerState[] {
    return [...this.actors.values()].map(a => ({ ...a.state, ackSeq: a.lastSeq, hitstopFrom: a.hitstopFrom, hitstopUntil: a.hitstopUntil, cooldowns: { ...a.state.cooldowns } }));
  }

  drainEvents(): CombatEvent[] { const out = this.events; this.events = []; return out; }

  private hostile(a: PlayerState, b: PlayerState) {
    return a.id !== b.id && (a.team === undefined || a.team !== b.team);
  }

  private faceOff(a: Actor) {
    const p = a.state;
    let nearest = Infinity, yaw = p.yaw;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!q.alive || !this.hostile(p, q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, gap = dx * dx + dz * dz;
      if (gap < nearest && gap > 1e-8) { nearest = gap; yaw = Math.atan2(dx, dz); }
    }
    p.yaw = a.faceYaw = a.input.yaw = yaw;
  }

  private moveOf(a: Actor, slot: AttackSlot, stage = 0): MoveDefinition {
    if (a.kit) return a.kit[slot] ?? a.kit.special;
    if (a.forged && (slot !== 'light' || stage === 0)) return this.forgedMove(a, slot);
    return slot === 'light' ? rushMove(a.state.fighter, stage, !!a.state.awakened) : moveFor(a.state.fighter, slot, !!a.state.awakened);
  }
  private forgedMove(a: Actor, slot: AttackSlot): MoveDefinition {
    const base = a.forged![slot], change = a.state.awakened ? AWAKENED_MOVES[a.state.fighter]?.[slot] : undefined;
    return change ? { ...base, ...change } : base;
  }
  forge(id: string, moves?: Record<AttackSlot, MoveDefinition>, hash?: string): boolean {
    const actor = this.actors.get(id);
    if (!actor || actor.kit || actor.state.isBot) return false;
    if (moves && hash) { actor.forged = moves; actor.state.forge = hash; }
    else { delete actor.forged; delete actor.state.forge; }
    return true;
  }
  private record() {
    const keep = this.serverTime - this.rewind - .1;
    for (const a of this.actors.values()) {
      const id = a.state.id, trail = this.trail.get(id) ?? [];
      trail.push({ t: this.serverTime, x: a.state.x, y: a.state.y, z: a.state.z });
      let old = 0; while (old < trail.length - 2 && trail[old + 1].t <= keep) old++;
      if (old) trail.splice(0, old);
      this.trail.set(id, trail);
    }
    for (const id of this.trail.keys()) if (!this.actors.has(id)) this.trail.delete(id);
  }

  private seenBy(a: Actor, target: PlayerState): PlayerState {
    const lag = this.rewind > 0 && a.viewLag ? a.viewLag : 0;
    if (lag <= 0 || target === a.state) return target;
    const trail = this.trail.get(target.id);
    if (!trail?.length) return target;
    const t = this.serverTime - lag;
    let i = trail.length - 1;
    while (i > 0 && trail[i].t > t) i--;
    const from = trail[i], to = trail[i + 1] ?? { t: this.serverTime, x: target.x, y: target.y, z: target.z };
    if (Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) > 10) return target;
    const w = to.t > from.t ? clamp((t - from.t) / (to.t - from.t), 0, 1) : 1;
    return { ...target, x: from.x + (to.x - from.x) * w, y: from.y + (to.y - from.y) * w, z: from.z + (to.z - from.z) * w };
  }

  private reachOf(a: Actor, slot: AttackSlot, move: MoveDefinition, grounded = true) {
    if (!a.kit) return meleeReach(a.state.fighter, slot, move, grounded);
    return move.style === 'melee' ? move.range + PLAYER_RADIUS : Infinity;
  }
  private roomToFollow(a: Actor, target: Actor, slot: AttackSlot, move: MoveDefinition) {
    const p = a.state, q = target.state, dx = q.x - p.x, dz = q.z - p.z, apart = Math.hypot(dx, dz);
    if (apart < 1e-3) return true;
    const ux = dx / apart, uz = dz / apart, gap = this.gapOf(a, slot, move, p.grounded), reach = apart + STRING_SHOVE;
    for (const other of this.actors.values()) {
      if (other === a || other === target || !other.state.alive || Math.abs(other.state.y - p.y) >= 1.5) continue;
      const ox = other.state.x - p.x, oz = other.state.z - p.z, along = ox * ux + oz * uz, across = ox * uz - oz * ux;
      if (along > LANE_FRONT && along < reach && Math.abs(across) < gap) return false;
    }
    return true;
  }

  private gapOf(a: Actor, slot: AttackSlot, move: MoveDefinition, grounded = true) {
    if (!a.kit) return contactGap(a.state.fighter, slot, move, grounded);
    const reach = this.reachOf(a, slot, move, grounded);
    return Number.isFinite(reach) ? Math.max(PLAYER_RADIUS * 2, Math.min(1.25, reach - .3)) : 1.25;
  }

  removePlayer(id: string) {
    const going = this.actors.get(id);
    if (!going) return;
    this.actors.delete(id);
    this.collision?.remove?.(id);
    this.projectiles = this.projectiles.filter(p => p.actorId !== id);
    this.areas = this.areas.filter(each => each.actorId !== id);
    for (const actor of this.actors.values()) if (actor.state.target === id) actor.state.target = null;
    this.checkWinner();
  }

  clearPlayerInput(id: string) {
    const actor = this.actors.get(id);
    if (!actor) return;
    actor.input = { seq: actor.lastSeq, moveX: 0, moveZ: 0, yaw: actor.state.yaw };
    actor.lastInputAt = this.serverTime - .36;
    actor.state.guarding = false;
  }

  getPlayer(id: string): PlayerState | undefined {
    const p = this.actors.get(id)?.state;
    return p ? { ...p, cooldowns: { ...p.cooldowns } } : undefined;
  }

  submitInput(id: string, raw: unknown): boolean {
    const actor = this.actors.get(id);
    let input = validateInput(raw);
    if (input && actor && this.roomMode === 'training' && !actor.state.isBot) input = this.trainingLab.capture(input);
    if (!actor || !input || input.seq <= actor.lastSeq) return false;
    actor.lastSeq = input.seq;
    if (this.rewind > 0) actor.viewLag = input.view === undefined ? 0 : clamp(this.serverTime - input.view, 0, this.rewind);
    if(input.attack){actor.attackSeq=input.seq;actor.attackYaw=input.yaw;actor.attackAim=input.attack==='area'?input.aim:undefined;this.pressPace(actor,input.attack);}
    actor.lastInputAt = this.serverTime;
    actor.input = { ...input, jump: input.jump || actor.input.jump, dash: input.dash || actor.input.dash,
      awaken: input.awaken || actor.input.awaken, attack: input.attack ?? actor.input.attack };
    if (input.targetId !== undefined) {
      const target = input.targetId ? this.actors.get(input.targetId)?.state : null;
      actor.state.target = target && target.id !== id && target.alive && distance(actor.state, target) < 60 ? target.id : null;
      if (this.external) {const body=!target&&input.targetId?this.external.locate(input.targetId):undefined;actor.chosenExternal=body&&this.external.hostile?.(id,body)!==false?body.id:undefined;}
    }
    return true;
  }

  startMatch(): boolean {
    if (this.roomMode !== 'match' || this.status !== 'waiting' || this.actors.size < 2) return false;
    const seated = this.shuffle([...this.actors.values()]);
    const axis = seated.length === 2 ? STAGES[this.stage].duelAxis : undefined;
    const drawn = Math.floor(this.random() * MAX_PLAYERS);
    const rotate = axis === undefined ? drawn : drawn % 2 * MAX_PLAYERS / 2;
    const taken: Vec3[] = [];
    seated.forEach((actor, seat) => {
      const sector = (Math.round(seat * MAX_PLAYERS / seated.length) + rotate) % MAX_PLAYERS;
      const spawn = safeSpawn(sector, this.stage, taken, axis); taken.push(spawn);
      actor.spawn = position(spawn);
      Object.assign(actor.state, spawn, { hp: actor.state.maxHp, stamina: actor.state.maxStamina ?? this.staminaMax, ultimate: 0, awakening: 0, alive: true,
        yaw: Math.PI, grounded: true, guarding: false, target: null, action: 'idle',
        actionStarted: this.serverTime, actionDuration: 0, actionTime: 0,
        kills: 0, damageDealt: 0, damageTaken: 0,
        cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0, area: 0 } });
      actor.vy = actor.kx = actor.kz = actor.stunUntil = actor.evadeUntil = actor.dashUntil = 0;
      actor.knockbackDrag = 7; actor.freezeUntil=0;actor.state.timeStopped=false;
      actor.reaction = null; actor.hitstopFrom = actor.hitstopUntil = actor.comboUntil = 0;
      actor.state.combo = 0; actor.state.hitstop = false;
      actor.launchSlot = undefined; actor.jumping = false;
      actor.groundedAt = actor.landedUntil = -Infinity; actor.leapt = false;
      actor.dashX = actor.dashY = actor.dashZ = actor.respawnAt = actor.chainHits = actor.scalingHits = actor.juggleHits = 0;
      actor.dashEntry = 0; actor.dashPlateau = 1; actor.dashSeconds = DASH_SECONDS; actor.dashKind = 'forward';
      actor.jumpAt = actor.dashAt = actor.attackAt = actor.awakenAt = actor.guardAt = -Infinity;
      actor.attackHold = actor.attackNotified = -Infinity; actor.reactionClip = .3; Object.assign(actor, pressClock());
      actor.wasGuarding = false; actor.guardHeld = false; actor.guardPressedAt = -Infinity;
      actor.guardReleasedAt = actor.parryLockUntil = actor.counterUntil = actor.parriedUntil = -Infinity; actor.parryCaught = false;
      actor.bounceOnLand = false; actor.launchLead = 0; actor.mx = actor.mz = 0; actor.blockedUntil = -Infinity;
      actor.rushUntil = actor.chaseUntil = actor.lightChaseUntil = actor.vanishedAt = -Infinity; actor.rushOpened = []; actor.chaseTargetId = actor.vanishOn = undefined; actor.dashChase = false;
      actor.awakenEntryUntil = 0; actor.state.awakened = false; actor.state.awakenedUntil = 0;
      actor.cast = null; actor.lastDamageAt = this.serverTime - 10;
      actor.input = { seq: actor.lastSeq, moveX: 0, moveZ: 0, yaw: Math.PI };
      actor.lastInputAt = this.serverTime;
      this.collision?.remove?.(actor.state.id);
    });
    for (const actor of seated) this.faceOff(actor);
    this.events.length = 0; this.projectiles.length = 0; this.areas.length = 0;
    this.hunts.clear(); this.dealt.clear(); this.winnerId = null;
    this.startedAt = this.serverTime;
    this.status = 'active';
    return true;
  }

  private emit(event: Omit<CombatEvent, 'id' | 'serverTime'>) {
    if (this.roomMode === 'training') this.trainingLab.event(event);
    this.events.push({ ...event, id: ++this.eventId, serverTime: this.serverTime });
    if (this.events.length > 256) this.events.shift();
  }

  private freeze(a: Actor, seconds: number) {
    if (this.serverTime >= a.hitstopUntil) a.hitstopFrom = this.serverTime;
    a.hitstopUntil = Math.max(a.hitstopUntil, this.serverTime + seconds);
  }

  private action(a: Actor, action: PlayerState['action'], duration = 0, restart = false) {
    if (restart || a.state.action !== action || slots.includes(action as AttackSlot)) {
      a.state.actionStarted = this.serverTime;
      a.state.actionTime = 0;
      a.state.actionFrozen = 0;
    }
    a.state.action = action;
    a.state.actionDuration = duration;
  }

  private nearestInFront(p: PlayerState, reach: number, cos: number): PlayerState | undefined {
    let best: PlayerState | undefined, bestGap = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!this.hostile(p, q) || !q.alive || !meleeHeight(p, q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
      if (gap > reach + radiusOf(q) || gap < 1e-4) continue;
      if ((Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / gap < cos) continue;
      if (gap < bestGap) { bestGap = gap; best = q; }
    }
    return best;
  }

  private readonly externalView = { id: '', x: 0, y: 0, z: 0, size: 1, alive: false } as unknown as PlayerState;
  private externalAsState(id: string): PlayerState | undefined {
    const body = this.external?.locate(id);
    if (!body) return undefined;
    Object.assign(this.externalView, { id: body.id, x: body.x, y: body.y, z: body.z, size: body.radius / PLAYER_RADIUS, alive: true });
    return this.externalView;
  }

  private assistAim(a: Actor, radius: number): { actor?: PlayerState; body?: ExternalBody } | undefined {
    const p = a.state;
    const lock = p.target ? this.actors.get(p.target)?.state : undefined;
    if (lock?.alive && this.hostile(p, lock) && Math.abs(lock.y - p.y) < 2.2 && Math.hypot(lock.x - p.x, lock.z - p.z) <= radius + radiusOf(lock)) return { actor: lock };
    const chosen = a.chosenExternal ? this.external?.locate(a.chosenExternal) : undefined;
    if (chosen && this.external?.hostile?.(p.id,chosen)!==false && Math.abs(chosen.y - p.y) < 2.2 && Math.hypot(chosen.x - p.x, chosen.z - p.z) <= radius + chosen.radius) return { body: chosen };
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const score = (x: number, z: number, r: number) => {
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d - r > radius) return Infinity;
      return Math.max(0, d - r) + (1 - (d > 1e-4 ? (dx * fx + dz * fz) / d : 1)) * .55;
    };
    let best: { actor?: PlayerState; body?: ExternalBody } | undefined, bestScore = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!q.alive || !this.hostile(p, q) || Math.abs(q.y - p.y) > 1.8) continue;
      const s = score(q.x, q.z, radiusOf(q));
      if (s < bestScore) { bestScore = s; best = { actor: q }; }
    }
    if (this.external) {
      const n = this.external.query(p, p, radius, this.nearby);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        if (this.external.hostile?.(p.id,body)===false || Math.abs(body.y - p.y) > 1.8) continue;
        const s = score(body.x, body.z, body.radius);
        if (s < bestScore) { bestScore = s; best = { body }; }
      }
    }
    return best;
  }

  private cancellable(a: Actor, slot: AttackSlot) {
    const cast = a.cast;
    if (!cast) return true;
    if (!cast.connected || this.serverTime < cast.start + cast.move.contacts[0]) return false;
    if (cast.slot === 'light' && slot === 'light') {
      return cast.nextContact >= cast.move.contacts.length && cast.stage + 1 < this.rushLimit(cast.airborne);
    }
    return CANCEL_ROUTES[cast.slot].includes(slot);
  }

  private rushLimit(airborne: boolean) { return airborne ? RUSH_AIR_STAGES : RUSH_STAGES; }

  private rushStageFor(a: Actor): number {
    const cast = a.cast;
    const next = cast ? (cast.slot === 'light' ? cast.stage + 1 : 0)
      : this.serverTime <= a.rushUntil ? a.rushStage + 1 : 0;
    return next < this.rushLimit(cast ? cast.airborne : !a.state.grounded) ? next : 0;
  }

  private nextPress(a: Actor) {
    const next = a.pressQueue?.[0]; if (!next) return;
    a.pressQueue = a.pressQueue!.length > 1 ? a.pressQueue!.slice(1) : undefined;
    a.attackAt = this.serverTime; a.attackSlot = next;
    a.attackHold = (a.cast ? Math.max(this.serverTime, a.cast.start + a.cast.move.duration) : this.serverTime) + INPUT_BUFFER;
    a.attackBeat = a.attackPaced = false;
  }

  private pressPace(a: Actor, slot: AttackSlot) {
    const gap = this.serverTime - a.lightPressAt;
    if (slot !== 'light') { a.enderRushed = gap < MASH_INTERVAL; return; }
    a.mashStreak = gap < MASH_INTERVAL ? a.mashStreak + 1 : 0;
    a.lightPressAt = this.serverTime;
    if (a.mashStreak) a.stringMash = true;
  }

  private notePress(a: Actor, slot: AttackSlot) {
    if (slot !== 'light') return { beat: !a.enderRushed && this.onBeat(a), paced: false };
    return { beat: false, paced: !a.mashStreak };
  }

  private onBeat(a: Actor) {
    if (a.kit) return false;
    if ((a.attackSlot === 'light' && this.serverTime <= a.attackHold) || a.pressQueue?.length) return false;
    const cast = a.cast;
    if (cast) return cast.slot === 'light' && this.serverTime - cast.start >= cast.move.contacts[0] - BEAT_EARLY;
    return this.serverTime <= a.rushUntil;
  }



  private queuePress(a: Actor, slot: AttackSlot) {
    if (a.kit || !hasCombos(a.state.fighter) || a.attackSlot !== 'light' || this.serverTime > a.attackHold) return false;
    const next = this.rushStageFor(a), queue = a.pressQueue ?? [];
    if (next === 0) { a.pressQueue = undefined; return false; }
    const closed = queue.length > 0 && queue[queue.length - 1] !== 'light';
    if (slot !== 'light') a.pressQueue = closed ? [...queue.slice(0, -1), slot] : [...queue, slot];
    else if (!closed && next + 1 + queue.length < this.rushLimit(a.cast ? a.cast.airborne : !a.state.grounded)) a.pressQueue = [...queue, slot];
    return true;
  }

  private branchFor(a: Actor, slot: AttackSlot): ComboKey | undefined {
    const cast = a.cast;
    const stage = cast?.slot === 'light' ? cast.stage : !cast && this.serverTime <= a.rushUntil ? a.rushStage : -1;
    return comboKeyFor(a.state.fighter, slot, stage, !a.state.grounded);
  }

  private rushFollow(a: Actor, cast: Cast): MoveDefinition | undefined {
    if (a.kit || cast.slot !== 'light' || cast.stage + 1 >= this.rushLimit(cast.airborne)) return undefined;
    return rushMove(a.state.fighter, cast.stage + 1, !!a.state.awakened);
  }

  private chooseIntent(a: Actor, slot: AttackSlot, m: MoveDefinition, continuing: boolean) {
    const p = a.state;
    if (a.input.lock === undefined || a.kit || p.team !== undefined) return;
    const melee = m.style === 'melee', reach = this.intentReach(a, slot, m), view = p.yaw, body = a.faceYaw;
    if (a.input.lock) {
      const locked = this.hardLock(a);
      if (locked) this.turnTo(p, locked);
      return;
    }
    let pick: PlayerState | undefined;
    if (melee) {
      const strike = Math.max(m.range + m.radius + PLAYER_RADIUS, m.dashThrough ? DASH_THROUGH_REACH : 0);
      const vanishedOn = this.serverTime - a.vanishedAt <= VANISH_AIM && a.vanishOn ? this.actors.get(a.vanishOn)?.state : undefined;
      const chasedOn = a.dashChase && this.serverTime <= a.dashUntil + INPUT_BUFFER && a.chaseTargetId ? this.actors.get(a.chaseTargetId)?.state : undefined;
      pick = [vanishedOn, chasedOn].find(q => q?.alive && this.hostile(p, q) && distance(p, q) <= strike);
    }
    if (!pick && continuing && a.intent) {
      const prior = this.actors.get(a.intent)?.state;
      if (prior?.alive && this.hostile(p, prior) && this.inIntent(p, prior, reach, CHOSEN_AIM_COS, melee, view, body)) pick = prior;
    }
    pick ??= this.facingPick(p, reach, melee, view, body);
    a.intent = pick?.id ?? null;
    a.intentCast = a.castSerial + 1;
    if (!pick) return;
    p.target = pick.id;
    this.turnTo(p, pick);
  }

  private turnTo(p: PlayerState, q: PlayerState) {
    const dx = q.x - p.x, dz = q.z - p.z;
    if (Math.hypot(dx, dz) > 1e-4) p.yaw = Math.atan2(dx, dz);
  }

  private intentReach(a: Actor, slot: AttackSlot, m: MoveDefinition) {
    if (m.style !== 'melee') return m.range;
    let reach = Math.max(m.range + m.radius + PLAYER_RADIUS, m.dashThrough ? DASH_THROUGH_REACH : 0);
    if ((m.lunge ?? DEFAULT_MELEE_LUNGE) > 0) reach = Math.max(reach,
      Math.max(this.gapOf(a, slot, m, a.state.grounded), m.spacing ?? 0, m.chargeIn ? PUSH_RADIUS * 2 : 0) + (m.close ?? MAX_CLOSE));
    if (m.teleport) reach = Math.max(reach, m.teleport.reach);
    if (m.timeStop) reach = Math.max(reach, m.timeStop.radius);
    return reach;
  }

  private facingOf(p: PlayerState, q: PlayerState, view: number, body: number) {
    const dx = q.x - p.x, dz = q.z - p.z, flat = Math.hypot(dx, dz);
    if (flat < 1e-4) return 1;
    return Math.max(Math.sin(view) * dx + Math.cos(view) * dz, Math.sin(body) * dx + Math.cos(body) * dz) / flat;
  }

  private inIntent(p: PlayerState, q: PlayerState, reach: number, cos: number, melee: boolean, view: number, body: number) {
    const dy = q.y - p.y, flat = Math.hypot(q.x - p.x, q.z - p.z);
    if (melee && !meleeHeight(p, q)) return false;
    if ((melee ? flat : Math.hypot(flat, dy)) > reach + radiusOf(q) - PLAYER_RADIUS) return false;
    return this.facingOf(p, q, view, body) >= cos;
  }

  private facingPick(p: PlayerState, reach: number, melee: boolean, view: number, body: number): PlayerState | undefined {
    let best: PlayerState | undefined, bestScore = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!q.alive || !this.hostile(p, q) || this.gone(other) || !this.inIntent(p, q, reach, INTENT_COS, melee, view, body)) continue;
      const flat = Math.hypot(q.x - p.x, q.z - p.z);
      const score = (melee ? flat : Math.hypot(flat, q.y - p.y)) + INTENT_TURN * (1 - this.facingOf(p, q, view, body));
      if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && (!best || q.id < best.id))) { best = q; bestScore = score; }
    }
    return best;
  }

  private intentTick(a: Actor) {
    a.faceYaw = a.state.yaw;
    if (!a.intent || a.cast?.id !== a.intentCast || a.input.lock !== false) return;
    const q = this.actors.get(a.intent)?.state;
    if (q?.alive) a.state.target = q.id;
  }

  private hardLock(a: Actor): PlayerState | undefined {
    const p = a.state;
    if (a.input.lock !== true || a.kit || p.team !== undefined || !p.target) return undefined;
    const q = this.actors.get(p.target)?.state;
    return q?.alive && this.hostile(p, q) ? q : undefined;
  }

  private inLane(q: PlayerState, from: Vec3, dx: number, dy: number, dz: number) {
    const n = Math.hypot(dx, dy, dz);
    if (n < 1e-6) return true;
    const cy = q.y + (q.size ? 1.05 * q.size : 1.05);
    return ((q.x - from.x) * dx + (cy - from.y) * dy + (q.z - from.z) * dz) / n >= LANE_FRONT;
  }

  private inBlowLane(a: Actor, cast: Cast, q: PlayerState, origin: Vec3, endpoint: Vec3) {
    if (a.state.team !== undefined || a.kit) return true;
    if (cast.move.style === 'beam') return this.inLane(q, origin, endpoint.x - origin.x, endpoint.y - origin.y, endpoint.z - origin.z);
    if (q.id === a.state.target || q.id === cast.aimId) return true;
    return this.inLane(q, origin, cast.direction.x, 0, cast.direction.z);
  }

  private cast(a: Actor, slot: AttackSlot): 'cast' | 'blocked' | 'cooling' | 'rejected' {
    const p = a.state;
    const stage = slot === 'light' && !a.kit ? this.rushStageFor(a) : 0;
    const branch = a.kit ? undefined : this.branchFor(a, slot);
    const m = branch ? comboMove(p.fighter, branch, !!p.awakened)! : this.moveOf(a, slot, stage);
    const mods = a.mods;
    const chaining = !!a.cast;
    if (!this.cancellable(a, slot) || this.serverTime < a.stunUntil || p.guarding || this.status !== 'active') return 'blocked';
    if (slot === 'light' && this.holdLight(a, stage)) return 'blocked';
    if (slot === 'light' && stage === 0 && a.jumping && !p.grounded && this.serverTime - a.jumpStartedAt < AIR_STRING_LIFTOFF) return 'blocked';
    const gated = !(chaining || stage > 0) || slot === 'special' || slot === 'ultimate' || slot === 'area';
    const staminaCost = mods ? m.stamina * mods.stamina : m.stamina;
    const reason = gated && (p.cooldowns[slot] ?? 0) > this.serverTime ? 'cooldown'
      : p.stamina < staminaCost && !(STAMINA_OVERDRAW && slot !== 'heavy') ? 'stamina'
      : slot === 'ultimate' && p.ultimate < ULTIMATE_COST ? 'ultimate-meter' : null;
    if (reason === 'cooldown') {
      if (a.attackNotified !== a.attackAt) { a.attackNotified = a.attackAt; this.emit({ kind: 'rejected', actorId: p.id, slot, reason }); }
      return 'cooling';
    }
    if (reason) { this.emit({ kind: 'rejected', actorId: p.id, slot, reason }); return 'rejected'; }
    a.dashUntil = Math.min(a.dashUntil, this.serverTime);
    p.yaw=a.attackYaw??a.input.yaw;
    this.chooseIntent(a, slot, m, stage > 0 || chaining);
    p.stamina = Math.max(0, p.stamina - staminaCost);
    if (slot === 'ultimate') p.ultimate = 0;
    p.cooldowns[slot] = this.serverTime + (mods ? m.cooldown * mods.cooldown : m.cooldown);
    if (a.kit) p.move = m.name;
    const from = attackOrigin(p,m);
    const locked = p.target ? this.actors.get(p.target)?.state : null;
    const target = locked && this.hostile(p, locked) ? locked : null;
    let aimedMelee:PlayerState|undefined,aimedExternal:ExternalBody|undefined;
    if (m.style === 'melee') {
      const reach = Math.max(m.range + m.radius + PLAYER_RADIUS, m.dashThrough ? DASH_THROUGH_REACH : 0);
      const chosen = this.hardLock(a) ?? (target?.alive && Math.hypot(target.x - p.x, target.z - p.z) <= reach && meleeHeight(p, target)
        && (Math.sin(p.yaw) * (target.x - p.x) + Math.cos(p.yaw) * (target.z - p.z))
          / (Math.hypot(target.x - p.x, target.z - p.z) || 1) >= CHOSEN_AIM_COS ? target : undefined);
      const vanishedOn = this.serverTime - a.vanishedAt <= VANISH_AIM && a.vanishOn ? this.actors.get(a.vanishOn)?.state : undefined;
      const punish = vanishedOn?.alive && distance(p, vanishedOn) <= reach ? vanishedOn : undefined;
      const chasedOn = a.dashChase && this.serverTime <= a.dashUntil + INPUT_BUFFER && a.chaseTargetId ? this.actors.get(a.chaseTargetId)?.state : undefined;
      const followUp = chasedOn?.alive && distance(p, chasedOn) <= reach ? chasedOn : undefined;
      let facing = punish ?? followUp ?? chosen;
      if (!facing && this.assist) {
        const found = this.assistAim(a, reach + this.assist.magnet);
        if (found?.actor) facing = found.actor; else aimedExternal = found?.body;
      }
      facing ??= this.assist ? undefined : this.nearestInFront(p, reach, MELEE_AIM_COS);
      aimedMelee=facing;
      const faced = facing ? this.seenBy(a, facing) : undefined;
      if (faced) p.yaw = Math.atan2(faced.x - p.x, faced.z - p.z);
      else if (aimedExternal) p.yaw = Math.atan2(aimedExternal.x - p.x, aimedExternal.z - p.z);
    }
    let direction = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
    let shotAim: Vec3 | undefined = target?.alive && distance(p, target) < m.range && m.style !== 'melee' ? centreOf(target) : undefined;
    if (!shotAim && this.assist && m.style !== 'melee') {
      const found = this.assistAim(a, m.range);
      shotAim = found?.actor ? centreOf(found.actor) : found?.body ? { x: found.body.x, y: found.body.y + found.body.height * .55, z: found.body.z } : undefined;
      if (m.aimOnRelease && !found?.actor && found?.body) aimedExternal = found.body;
    }
    if (shotAim) {
      const span = distance(from, shotAim) || 1;
      direction = { x: (shotAim.x - from.x) / span, y: (shotAim.y - from.y) / span, z: (shotAim.z - from.z) / span };
      p.yaw = Math.atan2(direction.x, direction.z);
    }
    let endpoint: Vec3 = { x: from.x + direction.x * m.range, y: from.y + direction.y * m.range, z: from.z + direction.z * m.range };
    if ((m.style === 'bomb'||m.style==='field') && target?.alive && distance(p, target) <= m.range) endpoint = centreOf(target);
    else if ((m.style === 'bomb'||m.style==='field') && this.assist && shotAim && distance(p, shotAim) <= m.range + 1.2) endpoint = shotAim;
    endpoint = this.collision?.raycast?.(from, endpoint) ?? endpoint;
    if (m.area) {
      endpoint = this.areaCentre(a, m, target);
      const dx = endpoint.x - p.x, dz = endpoint.z - p.z, span = Math.hypot(dx, dz);
      if (span > .3) { p.yaw = Math.atan2(dx, dz); direction = { x: dx / span, y: 0, z: dz / span }; }
    }
    a.attackAim = undefined;
    const nearbyMeleeTarget = !!traitsOf(p.fighter).lockNearMeleeLunge && m.style === 'melee' && target?.alive
      && Math.abs(target.y - p.y) < 1.5 && distance(p, target) <= m.range + m.radius + PLAYER_RADIUS
      && (target.x - p.x) * direction.x + (target.z - p.z) * direction.z > 0;
    const prior = a.cast;
    const opened = new Map<string, number>(stage > 0 ? (prior?.slot === 'light' ? prior.opened : a.rushOpened) : []);
    a.rushUntil = -Infinity;
    const aimAt = m.style === 'melee' && (m.chargeIn || m.dashThrough) ? aimedMelee : undefined;
    const backstep = m.chargeIn && aimAt && p.grounded ? Math.max(0, m.chargeIn - Math.hypot(aimAt.x - p.x, aimAt.z - p.z)) : 0;
    if (slot === 'light' && stage === 0) a.stringMash = !a.attackPaced;
    const mash = slot === 'light' && !a.kit && a.stringMash;
    const beat = !!branch && !!a.attackBeat && (prior ? prior.slot === 'light' && prior.connected : a.rushOpened.length > 0);
    a.cast = { id: ++a.castSerial, stage, slot, ...(branch ? { branch } : {}), ...(beat ? { beat } : {}), ...(mash ? { mash } : {}), move: m, start: this.serverTime, nextContact: 0, live: [], direction, endpoint,
      lungeTargetId: nearbyMeleeTarget ? target.id : m.lockAim&&!branch&&!p.awakened?aimedMelee?.id:undefined, connected: false, airborne: !p.grounded, opened,
      aimId: aimAt?.id, ...(aimedExternal ? { externalAim: aimedExternal.id } : {}), ...(backstep > .02 ? { backstep, backstepPlanned: backstep, backstepUntil: backstepWindow(p.fighter, m) } : {}) };
    this.action(a, slot, m.duration);
    if (!p.grounded) this.airborneOpener(a, a.cast);
    else if (m.style === 'melee' && !a.kit) {
      const on = aimedMelee ?? (target?.alive ? target : undefined);
      if (on) { a.cast.riseOn = on.id; this.risingStrike(a, a.cast); }
    }
    p.actionSeq=a.attackSeq;
    if (slot === 'light') p.chain = stage;
    p.branch = branch;
    const airNormal = !branch && !p.grounded && this.drawsAirNormal(p, slot, stage)
      ? slot === 'light' ? airRushName(p.fighter, stage) : AIR_NORMALS[slot] : undefined;
    this.emit({ kind: 'cast', actorId: p.id, fighter: p.fighter, slot, actionSeq:p.actionSeq, chain: slot === 'light' ? stage : undefined, ...(m.area ? { radius: m.radius } : {}),
      ...(branch ? { branch } : {}), move: airNormal ?? m.name, origin: from, endpoint, seed: Math.floor(this.random() * 2147483647) });
    return 'cast';
  }

  private drawsAirNormal(p: PlayerState, slot: AttackSlot, stage: number) {
    const own = slot === 'light' && !!AIR_RUSH[p.fighter]?.[stage];
    const traits = traitsOf(p.fighter), grounded = traits.groundedOpeners;
    if (!own && !traits.airNormals) return false;
    if (p.awakened && (AWAKENINGS[p.fighter].kind === 'form' || traits.awakenedOwnMoves)) return false;
    return own || stage > 0 || !(grounded === 'all' || (!!grounded && grounded.includes(slot)));
  }

  step(dt = 1 / 60, waitingForInput?:ReadonlySet<string>) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) throw new Error('Step must be between 0 and 0.05 seconds');
    if (this.roomMode === 'training' && !this.trainingLab.shouldStep()) return;
    if (this.rewind > 0) this.record();
    this.serverTime += dt;
    this.tick++;
    if (this.status === 'waiting') return;
    for (const a of this.actors.values()) {
      const p = a.state;
      this.intentTick(a);
      this.cinematicTick(a);
      if (this.status === 'finished' && p.id === this.winnerId && p.alive) {
        p.action = 'victory';
        continue;
      }
      if (!p.alive) {
        p.actionTime = p.actionDuration > 0
          ? clamp((this.serverTime - p.actionStarted - (p.actionFrozen ?? 0)) / p.actionDuration, 0, 1) : 0;
        if (this.roomMode === 'training' && this.respawns && this.serverTime >= a.respawnAt) this.respawn(a);
        continue;
      }
      if (a.statuses) this.tickStatus(a);
      if (p.awakened && this.serverTime >= (p.awakenedUntil ?? 0)) {
        p.awakened = false; p.awakenedUntil = 0;
        this.emit({ kind: 'awaken-end', actorId: p.id, fighter: p.fighter });
      }
      p.timeStopped=this.serverTime<a.freezeUntil;
      if(p.timeStopped){
        p.actionFrozen=(p.actionFrozen??0)+dt;if(a.cast)a.cast.start+=dt;
        if(a.stunUntil>this.serverTime-dt)a.stunUntil+=dt;
        if(a.floorUntil>this.serverTime-dt)a.floorUntil+=dt;
        if(a.blockedUntil>this.serverTime-dt)a.blockedUntil+=dt;
        if(a.parriedUntil>this.serverTime-dt)a.parriedUntil+=dt;
        if(a.dashUntil>this.serverTime-dt)a.dashUntil+=dt;
        if(a.evadeUntil>this.serverTime-dt)a.evadeUntil+=dt;
        if(a.awakenEntryUntil>this.serverTime-dt)a.awakenEntryUntil+=dt;
        if(a.rushUntil>this.serverTime-dt)a.rushUntil+=dt;
        if(a.chaseUntil>this.serverTime-dt)a.chaseUntil+=dt;
        if(a.lightChaseUntil>this.serverTime-dt)a.lightChaseUntil+=dt;
        if(p.awakened&&(p.awakenedUntil??0)>this.serverTime-dt)p.awakenedUntil=(p.awakenedUntil??0)+dt;
        a.input.attack=undefined;a.input.dash=a.input.jump=false;
        continue;
      }
      p.hitstop = this.serverTime < a.hitstopUntil;
      if (p.hitstop) {
        p.actionFrozen = (p.actionFrozen ?? 0) + dt;
        if (a.cast) a.cast.start += dt;
        for (const key of ['stunUntil', 'blockedUntil', 'dashUntil', 'evadeUntil', 'comboUntil', 'awakenEntryUntil', 'rushUntil', 'chaseUntil', 'lightChaseUntil', 'parriedUntil', 'floorUntil'] as const) {
          if (a[key] > this.serverTime - dt) a[key] += dt;
        }
        if (p.awakened && (p.awakenedUntil ?? 0) > this.serverTime - dt) p.awakenedUntil = (p.awakenedUntil ?? 0) + dt;
        continue;
      }
      a.inputGap=waitingForInput?.has(p.id)?(a.inputGap??0)+dt:0;
      if(a.inputGap>0&&!a.reaction&&this.serverTime>=a.stunUntil){
        const personalMotion=!p.grounded||a.jumping||a.dashUntil>this.serverTime-dt;
        if(a.inputGap>.35&&!personalMotion&&!a.cast&&this.serverTime>=a.awakenEntryUntil
            &&Math.hypot(a.kx,a.kz)<.01&&!(a.attackSlot&&this.serverTime<=a.attackHold)){
          this.clearPlayerInput(p.id);
          a.attackHold=a.attackAt=a.jumpAt=a.dashAt=a.awakenAt=a.rushUntil=a.chaseUntil=a.lightChaseUntil=-Infinity;
          a.attackSlot=undefined;a.pressQueue=undefined;this.action(a,'idle');p.actionTime=0;
          p.stamina=Math.min(p.maxStamina??100,p.stamina+STAMINA_REGEN*(a.mods?.staminaRecovery??1)*dt);
          continue;
        }
        if(a.inputGap<=.35&&(!a.cast||(a.cast.networkHold??0)+dt<=.35)
            &&(!personalMotion||(a.motionNetworkHold??0)+dt<=.35)){
          if(a.cast){a.cast.start+=dt;a.cast.networkHold=(a.cast.networkHold??0)+dt;}
          if(personalMotion)a.motionNetworkHold=(a.motionNetworkHold??0)+dt;
          if(p.actionDuration>0)p.actionFrozen=(p.actionFrozen??0)+dt;
          if(a.dashUntil>this.serverTime-dt)a.dashUntil+=dt;
          if(a.rushUntil>this.serverTime-dt)a.rushUntil+=dt;
          if(a.chaseUntil>this.serverTime-dt)a.chaseUntil+=dt;
          if(a.lightChaseUntil>this.serverTime-dt)a.lightChaseUntil+=dt;
          if(a.cast&&a.attackHold>this.serverTime-dt)a.attackHold+=dt;
          if(a.jumping)a.jumpStartedAt+=dt;
          a.groundedAt+=dt;if(a.landedUntil>this.serverTime-dt)a.landedUntil+=dt;
          if(!a.cast&&!p.guarding&&this.serverTime>=a.dashUntil)p.stamina=Math.min(p.maxStamina??100,p.stamina+STAMINA_REGEN*(a.mods?.staminaRecovery??1)*dt);
          continue;
        }
        this.clearPlayerInput(p.id);a.dashUntil=0;a.mx=a.mz=0;
        a.jumpAt=a.dashAt=a.awakenAt=a.rushUntil=a.chaseUntil=a.lightChaseUntil=-Infinity;
      }
      if (this.serverTime >= a.comboUntil && p.combo) p.combo = 0;
      if (p.isBot && !a.external) this.thinkBot(a);
      if (a.poiseMax) this.regainPoise(a, dt);
      const stale = this.serverTime - a.lastInputAt > 0.35;
      const input = a.input;
      if (!a.cast && this.serverTime >= a.stunUntil && this.serverTime >= a.dashUntil) {
        const travelling=Math.hypot(input.moveX,input.moveZ)>.01;
        const holdVanishFacing=this.serverTime-a.vanishedAt<=VANISH_AIM&&!travelling;
        if(!holdVanishFacing){
          if(input.guard||input.attack||input.dash)p.yaw=input.yaw;
          else if(travelling)p.yaw=Math.atan2(input.moveX,input.moveZ);
        }
      }
      const lastContact = a.cast ? a.cast.move.contacts[a.cast.move.contacts.length - 1] : 0;
      const grace = a.cast?.slot === 'light' ? LIGHT_RECOVERY_GRACE : RECOVERY_GRACE;
      const recovering = !!a.cast && this.serverTime >= a.cast.start + lastContact + grace;
      p.guarding = !stale && !!input.guard && !a.cast
        && this.serverTime >= a.stunUntil && this.serverTime >= a.dashUntil && p.stamina > 0;
      const guardHeld = !stale && !!input.guard;
      if (guardHeld && !a.guardHeld) {
        a.guardPressedAt = this.serverTime;
        const fresh = this.serverTime - a.guardReleasedAt >= PARRY_REARM - 1e-9 && this.serverTime >= a.parryLockUntil
          && !(p.isBot && a.botGuardUntil !== undefined && !a.botTimed);
        a.guardAt = fresh ? this.serverTime : -Infinity; a.parryCaught = false;
      }
      if (!guardHeld && a.guardHeld) a.guardReleasedAt = this.serverTime;
      a.guardHeld = guardHeld;
      if (a.guardAt > -Infinity && this.serverTime - a.guardAt > JUST_GUARD_WINDOW) {
        if (!a.parryCaught) a.parryLockUntil = a.guardAt + JUST_GUARD_WINDOW + PARRY_LOCKOUT;
        a.guardAt = -Infinity;
      }
      if (p.guarding && !a.wasGuarding) { a.attackHold = -Infinity; a.pressQueue = undefined; }
      a.wasGuarding = p.guarding;
      if (p.guarding) a.rushUntil = -Infinity;
      const controllable = this.serverTime >= a.stunUntil && !a.reaction
        && (!a.cast || recovering) && this.status !== 'finished';
      if (input.jump) a.jumpAt = this.serverTime;
      if (input.dash) { a.dashAt = this.serverTime; a.attackHold = -Infinity; a.pressQueue = undefined; }
      const press = input.attack ? this.notePress(a, input.attack) : undefined;
      if (input.attack && !this.queuePress(a, input.attack)) {
        a.attackAt = this.serverTime; a.attackSlot = input.attack; a.attackBeat = press!.beat; a.attackPaced = press!.paced;
        a.attackHold = (a.cast ? Math.max(this.serverTime, a.cast.start + a.cast.move.duration)
          : a.dashChase ? Math.max(this.serverTime, a.dashUntil) : this.serverTime) + INPUT_BUFFER;
      }
      if (a.pressQueue && this.serverTime > a.attackHold) a.pressQueue = undefined;
      if (input.awaken) a.awakenAt = this.serverTime;
      input.jump = input.dash = input.awaken = false; input.attack = undefined;
      const held = (at: number) => this.serverTime - at <= INPUT_BUFFER;
      const lightChase = a.attackSlot === 'light' && this.serverTime <= a.attackHold ? this.chaseByLight(a) : undefined;
      if (held(a.awakenAt) && !p.awakened && (p.awakening ?? 0) >= AWAKENING_COST && this.status === 'active'
          && this.serverTime >= a.stunUntil && !a.reaction && !a.cast && p.grounded) {
        a.awakenAt = -Infinity;
        p.awakening = 0;
        p.awakened = true;
        p.awakenedUntil = this.serverTime + AWAKENING_SECONDS + (a.mods?.awakenSeconds ?? 0);
        a.awakenEntryUntil = this.serverTime + AWAKENING_ENTRY;
        a.stunUntil = Math.max(a.stunUntil, a.awakenEntryUntil);
        a.evadeUntil = Math.max(a.evadeUntil, a.awakenEntryUntil);
        a.kx = a.kz = 0; a.dashUntil = Math.min(a.dashUntil, this.serverTime);
        this.action(a, 'awaken', AWAKENING_ENTRY, true);
        this.emit({ kind: 'awaken', actorId: p.id, fighter: p.fighter, move: AWAKENINGS[p.fighter].name });
      }
      if (a.reaction === 'launched' && !p.grounded && (held(a.jumpAt) || held(a.dashAt))
          && p.stamina >= TECH_STAMINA && this.serverTime >= a.lastDamageAt + TECH_DELAY) {
        p.stamina -= TECH_STAMINA;
        a.reaction = null;
        a.stunUntil = this.serverTime + .12;
        a.vy = Math.max(a.vy, -2.5); a.kx *= .3; a.kz *= .3; a.knockbackDrag = 9;
        a.evadeUntil = Math.max(a.evadeUntil, this.serverTime + .3);
        a.jumpAt = a.dashAt = -Infinity;
        this.emit({ kind: 'tech', actorId: p.id });
      }
      if (controllable && !p.guarding && held(a.jumpAt) && p.grounded && this.serverTime >= a.landedUntil) { a.vy = jumpArc(p.fighter).speed; a.leapt = this.leap(a, input, stale); p.grounded = false; a.jumping = true; a.motionNetworkHold=0;a.jumpStartedAt = this.serverTime; a.jumpAt = -Infinity; }
      const escapable = !a.cast || a.cast.connected;
      if (controllable && escapable && !p.guarding && (held(a.dashAt) || lightChase) && (p.stamina >= 20 || this.chaseOverdraws(a, lightChase)) && this.serverTime >= a.dashUntil + 0.35
        && this.serverTime >= a.landedUntil) {
        a.dashAt = -Infinity;
        a.motionNetworkHold=0;
        p.stamina = Math.max(0, p.stamina - 20);
        a.cast = null;
        a.rushUntil = -Infinity; a.dashChase = false;
        const n = Math.hypot(input.moveX, input.moveZ);
        a.dashX = n > 0.1 ? input.moveX / n : Math.sin(p.yaw);
        a.dashZ = n > 0.1 ? input.moveZ / n : Math.cos(p.yaw);
        a.dashY = 0;
        const along = n > 0.1 ? a.dashX * Math.sin(p.yaw) + a.dashZ * Math.cos(p.yaw) : 1;
        a.dashKind = along < BACKDASH_ALONG ? 'back' : Math.abs(along) < SIDESTEP_ALONG ? 'side' : 'forward';
        p.dashKind = a.dashKind;
        a.dashSeconds = a.dashKind === 'back' ? BACKDASH_SECONDS : a.dashKind === 'side' ? SIDESTEP_SECONDS : DASH_SECONDS;
        a.dashSpeed = a.dashKind === 'back' ? BACKDASH_SPEED : a.dashKind === 'side' ? SIDESTEP_SPEED : 24;
        a.dashUntil = this.serverTime + a.dashSeconds;
        if (a.dashKind === 'forward') a.evadeUntil = this.serverTime + DASH_EVADE;
        else if (a.dashKind === 'back') a.evadeUntil = this.serverTime + BACKDASH_EVADE;
        const locked = p.target ? this.actors.get(p.target)?.state : undefined;
        const chased = lightChase
          ?? (this.serverTime <= a.chaseUntil && a.chaseTargetId ? this.actors.get(a.chaseTargetId) : undefined);
        if (chased?.state.alive && distance(p, chased.state) <= CHASE_RANGE) this.startChase(a, chased, !!lightChase);
        else if (!p.grounded && locked?.alive) {
          const dx = locked.x - p.x, dy = (locked.y + 0.9) - (p.y + 0.9), dz = locked.z - p.z;
          const span = Math.hypot(dx, dy, dz);
          if (span > 0.4) {
            a.dashX = dx / span; a.dashY = dy / span; a.dashZ = dz / span;
            a.dashKind = 'forward'; a.dashSeconds = DASH_SECONDS;
            a.dashUntil = this.serverTime + DASH_SECONDS; a.evadeUntil = this.serverTime + DASH_EVADE;
            a.dashSpeed = clamp((span - PLAYER_RADIUS * 2) / DASH_SECONDS, 4, AIR_DASH_SPEED);
          }
        }
        p.dashKind = a.dashKind;
        if (a.dashY === 0 && !a.dashChase) this.shapeGroundDash(a, input, dt);
        this.action(a, 'dash', a.dashSeconds);
      }
      if (a.dashChase && this.serverTime < a.dashUntil && a.chaseTargetId) {
        const chased = this.actors.get(a.chaseTargetId);
        if (!chased?.state.alive || chased.reaction === 'splat' || (chased.state.grounded && chased.vy <= 0)) { a.dashUntil = this.serverTime; a.vy = Math.min(a.vy, 0); }
      }
      const chasing = a.dashChase && this.serverTime < a.dashUntil;
      if (p.guarding && this.serverTime < a.counterUntil && a.attackSlot && this.serverTime <= a.attackHold) p.guarding = false;
      if (!chasing && this.serverTime <= a.attackHold && a.attackSlot && this.serverTime >= a.stunUntil && !a.reaction && this.status === 'active') {
        const outcome = this.cast(a, a.attackSlot);
        if (outcome !== 'blocked' && outcome !== 'cooling') { a.attackAt = a.attackHold = -Infinity; this.nextPress(a); }
      }

      let speed = p.guarding ? 2.2 : 7.5;
      if (p.awakened) speed *= AWAKENED_SPEED;
      speed *= this.slowOf(a);
      if (a.mods) speed *= a.mods.speed;
      if (this.serverTime < a.stunUntil || stale || this.status === 'finished') speed = 0;
      const n = Math.max(1, Math.hypot(input.moveX, input.moveZ));
      const travel = a.jumping && !p.grounded && !a.cast && speed > 0 ? Math.max(speed, Math.hypot(a.mx, a.mz)) : speed;
      const wantX = input.moveX / n * travel, wantZ = input.moveZ / n * travel;
      if (this.serverTime < a.stunUntil) { a.mx = a.mz = 0; }
      else {
        const turning=(wantX*a.mx+wantZ*a.mz)<Math.hypot(wantX,wantZ)*Math.hypot(a.mx,a.mz)*.7;
        const rate = (turning?GROUND_TURN_ACCEL:Math.hypot(wantX, wantZ) >= Math.hypot(a.mx, a.mz) ? GROUND_ACCEL : GROUND_BRAKE)
          * (p.grounded ? 1 : AIR_CONTROL) * dt;
        const gapX = wantX - a.mx, gapZ = wantZ - a.mz, gap = Math.hypot(gapX, gapZ);
        if (gap > 1e-6) {
          const take = Math.min(gap, rate) / gap;
          a.mx += gapX * take; a.mz += gapZ * take;
        }
      }
      let vx = a.mx, vz = a.mz;
      if (this.serverTime < a.dashUntil) {
        const through = 1 - (a.dashUntil - this.serverTime) / a.dashSeconds;
        let burst = a.dashSpeed * dashShape(through);
        if (a.dashY !== 0 || a.dashChase) {
          const exit = Math.min(a.dashSpeed, a.dashChase ? CHASE_EXIT : 7.5);
          vx = a.dashX * burst; vz = a.dashZ * burst;
          a.mx = a.dashX * exit; a.mz = a.dashZ * exit;
          a.vy = a.dashY * burst;
        } else {
          const exit = this.dashExit(a, input) * (a.jumping && a.leapt && a.jumpStartedAt >= a.dashUntil - a.dashSeconds ? jumpArc(p.fighter).leap : 1);
          burst = Math.max(burst * a.dashPlateau, through < DASH_RISE ? a.dashEntry : through > 1 - DASH_FALL ? exit : 0);
          vx = a.dashX * burst; vz = a.dashZ * burst;
          a.mx = a.dashX * exit; a.mz = a.dashZ * exit;
        }
      }
      if (a.cast && !recovering) {
        const own = this.castMotion(a, dt, Math.hypot(input.moveX, input.moveZ) >= .05);
        if (own) { vx += own.x; vz += own.z; }
      }
      const approach = this.approach(a);
      const stick = Math.hypot(input.moveX, input.moveZ);
      let pursuing = false;
      if (approach && stick >= .05) {
        const chased = approach.acquired ?? (p.target ? this.actors.get(p.target)?.state : undefined);
        if (chased?.alive && this.actors.has(chased.id)) {
          const seen = this.seenBy(a, chased), dx = seen.x - p.x, dz = seen.z - p.z, gap = Math.hypot(dx, dz) || 1;
          pursuing = (input.moveX * dx + input.moveZ * dz) / (gap * stick) >= CHASE_STICK_COS;
        }
      }
      if (approach && !recovering && (stick < .05 || pursuing)) {
        const cast = a.cast!, { lunge, driveMove, driveWindow, opening, acquired } = approach;
        const castAge=this.serverTime-cast.start;
        const authoredLunge = cast.move.lunge !== undefined;
        {
          const chosenTarget = acquired ?? (p.target ? this.actors.get(p.target)?.state : undefined);
          const seen = chosenTarget && this.actors.has(chosenTarget.id) ? this.seenBy(a, chosenTarget) : chosenTarget;
          const shoved = chosenTarget ? this.actors.get(chosenTarget.id) : undefined;
          const target = seen && shoved && shoved.knockbackDrag === STRING_DRAG && (shoved.kx || shoved.kz) && cast.slot === 'light'
            ? (() => { const at = this.flightAhead(shoved, Math.max(0, cast.start + cast.move.contacts[Math.min(cast.nextContact, cast.move.contacts.length - 1)] - this.serverTime));
              return { ...seen, x: seen.x + at.x - shoved.state.x, z: seen.z + at.z - shoved.state.z }; })()
            : seen;
          const minimumGap = Math.max(this.gapOf(a, cast.slot, cast.move, !cast.airborne), cast.move.spacing ?? 0,
            cast.move.chargeIn ? PUSH_RADIUS * 2 : 0) + (target ? radiusOf(target) - PLAYER_RADIUS : 0);
          let space = target?.alive ? Math.max(0, Math.hypot(target.x - p.x, target.z - p.z) - minimumGap) : Infinity;
          if (cast.move.style === 'melee') {
            for (const other of this.actors.values()) {
              if (other === a || !other.state.alive || Math.abs(other.state.y - p.y) >= 1.5) continue;
              const dx = other.state.x - p.x, dz = other.state.z - p.z;
              const along = dx * cast.direction.x + dz * cast.direction.z;
              const across = dx * cast.direction.z - dz * cast.direction.x;
              if (along > (p.team === undefined && !a.kit ? LANE_FRONT : 0) && Math.abs(across) < minimumGap) {
                space = Math.min(space, Math.max(0, along - Math.sqrt(minimumGap * minimumGap - across * across)));
              }
            }
          }
          if (target?.alive && opening && cast.move.style === 'melee') {
            const dx = target.x - p.x, dz = target.z - p.z, gap = Math.hypot(dx, dz);
            if (gap > 1e-3) {
              const blend = Math.min(1, 7 * dt);
              cast.direction.x += (dx / gap - cast.direction.x) * blend;
              cast.direction.z += (dz / gap - cast.direction.z) * blend;
              const n2 = Math.hypot(cast.direction.x, cast.direction.z) || 1;
              cast.direction.x /= n2; cast.direction.z /= n2;
              p.yaw = Math.atan2(cast.direction.x, cast.direction.z);
            }
          }
          const nextContact = cast.move.contacts[Math.min(cast.nextContact, cast.move.contacts.length - 1)];
          const untilContact = Math.max(.035, cast.start + nextContact - this.serverTime);
          const reachable = cast.move.close ?? MAX_CLOSE;
          const needed = Number.isFinite(space) && space <= reachable ? space / untilContact : 0;
          const authoredSpeed = driveMove && cast.move.chargeIn ? 0
            : lunge * (driveMove && authoredLunge ? Math.min(4, cast.move.contacts[0] / driveWindow) : 1);
          const through = clamp((castAge - (cast.move.contacts[0] - driveWindow)) / Math.max(1e-3, driveWindow), 0, 1);
          const shape = driveMove && cast.move.chargeIn ? Math.sin(Math.PI * Math.min(.5, through)) ** 2
            : target !== seen ? 1
            : .45 + .55 * Math.sin(Math.PI * Math.min(1, through));
          const approachSpeed = Math.min(Math.max(authoredSpeed, Math.min(needed, MAX_APPROACH)) * shape, space / dt);
          if (pursuing) {
            const along = vx * cast.direction.x + vz * cast.direction.z, top = Math.max(0, approachSpeed - along);
            vx += cast.direction.x * top; vz += cast.direction.z * top;
          } else {
            vx += cast.direction.x * approachSpeed;
            vz += cast.direction.z * approachSpeed;
          }
        }
      }
      else if (a.cast?.move.style === 'melee' && a.cast.live?.length && !recovering && !a.cast.through) {
        const cast = a.cast, chased = p.target ? this.actors.get(p.target)?.state : undefined;
        if (chased?.alive && this.hostile(p, chased)) {
          const seen = this.seenBy(a, chased), dx = seen.x - p.x, dz = seen.z - p.z, gap = Math.hypot(dx, dz);
          if (gap > 1e-3 && (dx * cast.direction.x + dz * cast.direction.z) / gap >= MELEE_AIM_COS) {
            const blend = Math.min(1, 7 * dt);
            cast.direction.x += (dx / gap - cast.direction.x) * blend;
            cast.direction.z += (dz / gap - cast.direction.z) * blend;
            const n2 = Math.hypot(cast.direction.x, cast.direction.z) || 1;
            cast.direction.x /= n2; cast.direction.z /= n2;
            p.yaw = Math.atan2(cast.direction.x, cast.direction.z);
          }
        }
      }
      if (a.cast?.dive && this.serverTime < a.cast.dive.until && !p.grounded) {
        vx = a.cast.dive.x; vz = a.cast.dive.z; a.mx = vx * .25; a.mz = vz * .25;
      }
      const plunge = a.cast?.move.plunge && a.cast.airborne && !a.cast.landed && !p.grounded && !a.reaction ? a.cast : undefined;
      const cut = a.jumping && !p.grounded && a.vy > 0 && !a.reaction && !a.input.jumpHeld && !a.cast?.airborne
        && this.serverTime - a.jumpStartedAt >= JUMP_CUT_AFTER;
      if (plunge) {
        const age = this.serverTime - plunge.start;
        if (age < PLUNGE_HANG) a.vy = a.vy > 0 ? a.vy * Math.exp(-PLUNGE_BRAKE * dt) : 0;
        else { plunge.plungeFrom ??= p.y; a.vy = -plunge.move.plunge! * Math.min(1, (age - PLUNGE_HANG + dt) / PLUNGE_SNAP); }
      }
      const dive = a.cast?.dive && this.serverTime < a.cast.dive.until && !p.grounded && !a.reaction ? a.cast.dive : undefined;
      if (dive) a.vy = dive.y;
      else if (a.cast?.dive?.rise && !p.grounded && a.vy > RISE_SETTLE) a.vy = RISE_SETTLE;
      else if (!plunge && a.jumping && a.cast?.airborne && !p.grounded && a.vy > AIR_CAST_RISE)
        a.vy = Math.max(AIR_CAST_RISE, a.vy * Math.exp(-AIR_CAST_BRAKE * dt));
      if (a.reaction && a.reaction !== 'launched' && !p.grounded && a.vy > AIR_CAST_RISE) a.vy = AIR_CAST_RISE;
      const fall = plunge || dive ? 0 : !p.grounded && a.reaction === 'launched' ? LAUNCH_GRAVITY
        : a.cast?.airborne && !p.grounded ? AIR_CAST_GRAVITY
        : a.jumping && !p.grounded && !a.reaction ? jumpGravity(a.vy, cut) : 1;
      if (!(a.dashChase && this.serverTime < a.dashUntil)) a.vy = cut ? Math.max(0, a.vy - 23 * dt * fall) : a.vy - 23 * dt * fall;
      const delta = { x: (vx + a.kx) * dt, y: a.vy * dt, z: (vz + a.kz) * dt };
      if (a.launchLead > 0) {
        if (a.reaction !== 'launched' || p.grounded) a.launchLead = 0;
        else {
          const before = launchLead(a.launchRun / a.launchSpan); a.launchRun += dt;
          delta.y += a.launchLead * (launchLead(a.launchRun / a.launchSpan) - before);
          if (a.launchRun >= a.launchSpan) a.launchLead = 0;
        }
      }
      const corrected: CollisionMovement = this.follows && this.collision && ArenaSimulation.restShortcut && p.id !== this.localId && this.atRest(a, vx, vz, delta.y) ? AT_REST : this.collision?.move(p.id, p, delta) ?? delta;
      const { halfX, halfZ } = this.bounds;
      const wantedX = p.x + corrected.x, wantedZ = p.z + corrected.z;
      p.x = clamp(wantedX, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS);
      p.z = clamp(wantedZ, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS);
      if (a.reaction && a.reaction !== 'splat' && !a.wallBounce && this.serverTime < a.stunUntil) {
        const asked = Math.hypot(delta.x, delta.z);
        const given = Math.hypot(p.x - (wantedX - corrected.x), p.z - (wantedZ - corrected.z));
        const carried = Math.hypot(a.kx, a.kz) >= WALL_SPLAT_SPEED || a.reaction === 'launched';
        if (carried && this.serverTime - a.lastDamageAt < .8 && asked > 0.02 && given < asked * 0.55) {
          a.kx = a.kz = 0;
          a.vy = Math.min(a.vy, 1.4);
          a.reaction = 'splat';
          a.launchSlot = undefined;
          a.stunUntil = Math.max(a.stunUntil, this.serverTime + WALL_SPLAT_STUN);
          a.floorUntil = a.stunUntil + GROUND_HIT_MOST; a.floorHits = a.floorTaken = 0;
          this.action(a, 'splat', Math.max(.05, a.stunUntil - this.serverTime), true);
          this.emit({ kind: 'wall-splat', actorId: p.id, fighter: p.fighter, origin: position(p) });
        }
      }
      if (a.wallBounce) this.wallBounceTick(a, delta, wantedX, wantedZ, corrected);
      p.y = this.collision ? p.y + corrected.y : Math.max(0, p.y + corrected.y);
      if (delta.y > 1e-3 && corrected.y < delta.y * .5 && a.vy > 0) a.vy = 0;
      if(p.y < -4){this.eliminate(a,'water');continue;}
      const wasAirborne = !p.grounded;
      p.grounded = a.vy <= 0 && (corrected.grounded ??
        (!this.collision ? p.y <= 0.03 : corrected.y > delta.y + 0.0001));
      if (p.grounded) {
        if (wasAirborne) {
          a.groundedAt = this.serverTime;
          if (a.jumping && -a.vy >= JUMP_LAND_HARD) a.landedUntil = this.serverTime + JUMP_LAND_RECOVERY;
        }
        if (wasAirborne && a.launchSlot === 'ultimate') {
          this.emit({ kind: 'land', actorId: p.id, fighter: p.fighter, slot: a.launchSlot, origin: position(p) });
        }
        const bouncing = wasAirborne && a.bounceOnLand && a.reaction === 'launched' && p.hp > 0;
        a.bounceOnLand = false;
        if (bouncing) {
          a.vy = a.knockKind === 'spike' ? SPIKE_BOUNCE : GROUND_BOUNCE_LIFT; a.launchLead = 0;
          p.grounded = false;
          a.kx *= .45; a.kz *= .45;
          a.stunUntil = Math.max(a.stunUntil, this.serverTime + .5);
          this.action(a, 'launched', Math.max(.05, a.stunUntil - this.serverTime), true);
          this.emit({ kind: 'ground-bounce', actorId: p.id, fighter: p.fighter, origin: position(p) });
        } else {
          if (wasAirborne && a.reaction === 'launched' && a.dizzyOnLand) {
            a.reaction = 'stun'; a.stunUntil = this.serverTime + (a.dazeFor || DIZZY_SECONDS); a.dizzyOnLand = false;
            a.kx *= .25; a.kz *= .25;
          } else if (wasAirborne && a.reaction === 'launched' && a.popLand) {
            a.reaction = 'hurt'; a.stunUntil = Math.max(a.stunUntil, this.serverTime + POP_LAND_STUN);
            a.kx *= .25; a.kz *= .25;
          } else if (wasAirborne && a.reaction === 'launched') {
            a.reaction = 'knockdown';
            a.stunUntil = a.downFor !== undefined && a.launchSlot !== 'ultimate' ? this.serverTime + a.downFor
              : Math.max(a.stunUntil, this.serverTime + KNOCKDOWN_SECONDS);
            a.floorUntil = a.stunUntil + GROUND_HIT_MOST; a.floorHits = a.floorTaken = 0;
            if (a.knockKind !== 'slide') { a.kx *= .25; a.kz *= .25; }
          }
          a.vy = 0; a.launchSlot = undefined; a.juggleHits = 0; a.jumping = false;a.motionNetworkHold=0;a.launchLead = 0;
          a.downFor = undefined; a.wallBounce = false; a.popLand = false; a.dazeFor = 0; a.knockKind = '';
          if (!(a.dashChase && this.serverTime < a.dashUntil)) a.dashY = 0;
        }
      }
      if ((a.reaction === 'knockdown' || a.reaction === 'stun' || a.reaction === 'splat') && this.serverTime >= a.stunUntil) {
        a.reaction = 'getup';
        a.stunUntil = this.serverTime + GETUP_SECONDS;
      } else if (a.reaction && a.reaction !== 'launched' && this.serverTime >= a.stunUntil) {
        a.reaction = null;
      }
      if (a.spinLeft) this.spinTick(a, dt);
      a.kx *= Math.exp(-a.knockbackDrag * dt); a.kz *= Math.exp(-a.knockbackDrag * dt);
      if (a.cast) {
        const running = a.cast;
        if (aimsAsLetGo(running.move) && running.nextContact === 0) this.trackShot(a, dt);
        if (running.riseOn && !running.dive && p.grounded && running.nextContact === 0) this.risingStrike(a, running);
        this.updateCast(a);
        if (!a.cast && running.slot === 'light' && a.attackSlot === 'light' && this.serverTime <= a.attackHold
            && !(a.dashChase && this.serverTime < a.dashUntil) && this.serverTime >= a.stunUntil && !a.reaction
            && this.status === 'active') {
          const outcome = this.cast(a, 'light');
          if (outcome !== 'blocked' && outcome !== 'cooling') { a.attackAt = a.attackHold = -Infinity; this.nextPress(a); }
        }
      }
      if (!a.cast) {
        if (this.serverTime < a.awakenEntryUntil) this.action(a, 'awaken', AWAKENING_ENTRY);
        else if (this.serverTime < a.blockedUntil && !a.reaction) this.action(a, 'guard');
        else if (this.serverTime < a.stunUntil || a.reaction === 'launched') {
          const kind = a.reaction ?? 'hurt';
          const hold = Math.max(.05, a.stunUntil - p.actionStarted);
          this.action(a, kind, kind === 'flinch' || kind === 'hurt' ? Math.min(hold, a.reactionClip) : hold);
        }
        else if (this.serverTime < a.dashUntil) this.action(a, 'dash', a.dashSeconds);
        else this.action(a, p.guarding ? 'guard' : !p.grounded ? 'jump' : Math.hypot(vx, vz) > 0.1 ? 'run' : 'idle');
      }
      if (!a.cast && !p.guarding && this.serverTime >= a.dashUntil && this.serverTime >= a.blockedUntil) p.stamina = Math.min(p.maxStamina??100, p.stamina + STAMINA_REGEN * (a.mods?.staminaRecovery??1) * dt);
      if (a.mods?.staminaRegen) p.stamina = Math.min(p.maxStamina??100, p.stamina + a.mods.staminaRegen * dt);
      p.actionTime = p.actionDuration > 0
        ? clamp((this.serverTime - p.actionStarted - (p.actionFrozen ?? 0)) / p.actionDuration, 0, 1) : 0;
    }
    this.separateBodies(dt);
    this.updateProjectiles(dt);
    this.updateAreas();
    this.checkWinner();
  }

  private approach(a: Actor) {
    const cast = a.cast;
    if (!cast) return null;
    const lunge = cast.move.lunge ?? (cast.move.style === 'melee' ? DEFAULT_MELEE_LUNGE : 0);
    if (lunge <= 0) return null;
    const p = a.state;
    const acquired = cast.lungeTargetId ? this.actors.get(cast.lungeTargetId)?.state
      : cast.externalAim ? this.externalAsState(cast.externalAim) : undefined;
    const castAge = this.serverTime - cast.start;
    if(castAge<(cast.move.lungeDelay??0))return null;
    if (cast.move.dashThrough || castAge < (cast.backstepPlanned ? cast.backstepUntil ?? 0 : 0)) return null;
    const palmFollowThrough = !!cast.move.palmHold && !cast.airborne && !cast.connected
      && cast.live?.some(contact=>this.serverTime<=contact.until);
    const follow = acquired?.alive && (cast.nextContact < cast.move.contacts.length || palmFollowThrough);
    const driveMove = drives(p.fighter, cast.move);
    const driveWindow = driveWindowOf(p.fighter, cast.move);
    const opening = castAge - AGE_EPSILON < cast.move.contacts[0];
    if (!((opening || follow) && (!driveMove || castAge - AGE_EPSILON >= cast.move.contacts[0] - driveWindow))) return null;
    return { lunge, driveMove, driveWindow, opening, acquired };
  }

  private castMotion(a: Actor, dt: number, steering: boolean): { x: number; z: number } | null {
    const cast = a.cast!, p = a.state, age = this.serverTime - cast.start;
    if (cast.backstep && cast.backstepPlanned && cast.backstepUntil) {
      if (steering) { cast.backstep = 0; return null; }
      const planned = cast.backstepPlanned, through = Math.min(1, age / cast.backstepUntil);
      const due = planned * (1 - Math.cos(Math.PI * through)) / 2;
      const move = through >= 1 ? cast.backstep : Math.min(cast.backstep, Math.max(0, due - (planned - cast.backstep)));
      cast.backstep = Math.max(0, cast.backstep - move);
      const from = cast.aimId ? this.actors.get(cast.aimId)?.state : undefined;
      let ux = -cast.direction.x, uz = -cast.direction.z;
      if (from?.alive) {
        const dx = p.x - from.x, dz = p.z - from.z, n = Math.hypot(dx, dz);
        if (n > 1e-3) { ux = dx / n; uz = dz / n; }
      }
      return { x: ux * move / dt, z: uz * move / dt };
    }
    const contact = cast.move.contacts[0];
    if (!cast.move.dashThrough || cast.nextContact > 0 || steering) return null;
    if (!cast.through) {
      const q = cast.aimId ? this.actors.get(cast.aimId)?.state : undefined;
      let dx = cast.direction.x, dz = cast.direction.z, length = DASH_THROUGH_MISS;
      if (q?.alive && Math.abs(q.y - p.y) < 1.5) {
        const gx = q.x - p.x, gz = q.z - p.z, gap = Math.hypot(gx, gz);
        if (gap > DASH_THROUGH_SIDE && gap <= DASH_THROUGH_REACH) {
          const ax = gx / gap, az = gz / gap, turn = Math.asin(DASH_THROUGH_SIDE / gap);
          dx = ax * Math.cos(turn) - az * Math.sin(turn); dz = az * Math.cos(turn) + ax * Math.sin(turn);
          const along = Math.sqrt(gap * gap - DASH_THROUGH_SIDE * DASH_THROUGH_SIDE);
          const beyond = along + DASH_THROUGH_PAST + PLAYER_RADIUS, { halfX, halfZ } = this.bounds;
          const end = { x: p.x + dx * beyond, y: p.y, z: p.z + dz * beyond };
          const sight = this.collision?.raycast?.(centre(p), centre(end));
          const clear = Math.abs(end.x) <= halfX - PLAYER_RADIUS && Math.abs(end.z) <= halfZ - PLAYER_RADIUS
            && !(sight && distance(sight, centre(end)) > .1);
          if (clear) length = along + DASH_THROUGH_PAST;
          else { dx = ax; dz = az; length = Math.max(0, gap - PUSH_RADIUS * 2); }
        }
      }
      if (age < contact - Math.max(DASH_THROUGH_LEAD, length / DASH_THROUGH_MAX_SPEED)) return null;
      const n = Math.hypot(dx, dz) || 1;
      dx /= n; dz /= n;
      cast.direction = { x: dx, y: 0, z: dz };
      p.yaw = Math.atan2(dx, dz);
      cast.through = { from: position(p), to: { x: p.x + dx * length, y: p.y, z: p.z + dz * length } };
    }
    const left = (cast.through.to.x - p.x) * cast.direction.x + (cast.through.to.z - p.z) * cast.direction.z;
    if (left <= 1e-4) return { x: 0, z: 0 };
    const speed = Math.min(DASH_THROUGH_MAX_SPEED, left / Math.max(dt, cast.start + contact - this.serverTime));
    return { x: cast.direction.x * speed, z: cast.direction.z * speed };
  }

  private passing(a: Actor) { return !!a.cast?.through && a.cast.nextContact === 0 || this.gone(a); }

  private spacing(a: Actor) { return a.cast?.move.spacing ?? 0; }

  private gone(a: Actor) {
    return a.cast ? !!a.cast.blink && !a.cast.blink.to : this.serverTime < (a.goneUntil ?? -Infinity);
  }

  private blink(a: Actor, cast: Cast) {
    const move = cast.move.teleport!, p = a.state, age = this.serverTime - cast.start;
    if (age < move.vanish) return;
    if (!cast.blink) {
      cast.blink = { from: position(p), targetId: this.teleportTarget(a, move.reach)?.id };
      a.dashUntil = Math.min(a.dashUntil, this.serverTime);
    }
    const blink = cast.blink;
    if (!blink.to) {
      const back = this.serverTime + Math.max(0, move.appear - age);
      a.evadeUntil = Math.max(a.evadeUntil, back + .05);
      a.goneUntil = back + .25;
      if (age < move.appear) return;
      this.reappear(a, cast, blink);
    }
    const q = blink.targetId ? this.actors.get(blink.targetId)?.state : undefined;
    if (q?.alive && q.guarding && (cast.nextContact < cast.move.contacts.length || !!cast.live?.length)) {
      q.yaw = Math.atan2(p.x - q.x, p.z - q.z);
    }
  }

  private teleportTarget(a: Actor, reach: number): PlayerState | undefined {
    const p = a.state;
    const within = (q: PlayerState) => q.alive && this.hostile(p, q) && distance(p, q) <= reach + radiusOf(q);
    const locked = p.target ? this.actors.get(p.target)?.state : undefined;
    if (locked && within(locked)) return locked;
    let best: PlayerState | undefined, bestGap = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!within(q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
      if (gap > 1e-4 && (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / gap < CHOSEN_AIM_COS) continue;
      if (gap < bestGap) { bestGap = gap; best = q; }
    }
    return best;
  }

  private reappear(a: Actor, cast: Cast, blink: NonNullable<Cast['blink']>) {
    const p = a.state, move = cast.move.teleport!;
    const target = blink.targetId ? this.actors.get(blink.targetId) : undefined, q = target?.state;
    const beside = target && q?.alive ? this.teleportBehind(a, q, blink.from, move.behind, move.near) : undefined;
    const to = beside ?? this.teleportAhead(a, blink.from, move.miss);
    p.x = to.x; p.y = to.y; p.z = to.z;
    a.mx = a.mz = a.kx = a.kz = 0; a.jumping = false;
    if (beside && target && q) {
      const airborne = !q.grounded;
      p.grounded = !airborne; a.vy = airborne ? Math.min(target.vy, AIR_CAST_RISE) : 0; cast.airborne = airborne;
      const dx = q.x - p.x, dz = q.z - p.z, n = Math.hypot(dx, dz) || 1;
      cast.direction = { x: dx / n, y: 0, z: dz / n };
      p.yaw = Math.atan2(dx, dz);
      cast.lungeTargetId = cast.aimId = q.id;
    } else {
      blink.targetId = undefined;
      if (move.miss > 0) cast.move = { ...cast.move, lunge: 0 };
    }
    blink.to = position(to);
  }

  private teleportBehind(a: Actor, q: PlayerState, from: Vec3, behind: number, near = false): Vec3 | undefined {
    const bx = -Math.sin(q.yaw), bz = -Math.cos(q.yaw);
    let fx = q.x - from.x, fz = q.z - from.z;
    const n = Math.hypot(fx, fz);
    if (n > 1e-4) { fx /= n; fz /= n; } else { fx = bx; fz = bz; }
    let px = fx, pz = fz;
    if (bx * fx + bz * fz > -.5) { px = bx + fx; pz = bz + fz; const m = Math.hypot(px, pz) || 1; px /= m; pz /= m; }
    const sides = near ? [[-fx, -fz], [fz, -fx], [-fz, fx], [fx, fz]] : [[px, pz], [fx, fz], [bx, bz], [fz, -fx], [-fz, fx], [-fx, -fz]];
    for (const [ux, uz] of sides) {
      const spot = this.teleportFits(a, q, q.id, ux, uz, behind, true);
      if (spot) return spot;
    }
    return undefined;
  }

  private teleportAhead(a: Actor, from: Vec3, miss: number): Vec3 {
    const p = a.state, ux = Math.sin(p.yaw), uz = Math.cos(p.yaw);
    for (const share of [1, .75, .5, .25]) {
      const spot = this.teleportFits(a, from, p.id, ux, uz, miss * share, false);
      if (spot) return spot;
    }
    return position(from);
  }

  private teleportFits(a: Actor, anchor: Vec3, skip: string, ux: number, uz: number, length: number, beside: boolean): Vec3 | undefined {
    const p = a.state, { halfX, halfZ } = this.bounds;
    const wanted = { x: ux * length, y: 0, z: uz * length };
    const moved = this.collision?.move(p.id, anchor, wanted) ?? wanted;
    const to = { x: clamp(anchor.x + moved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS), y: anchor.y + (this.collision ? moved.y : 0),
      z: clamp(anchor.z + moved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS) };
    if (beside && Math.hypot(to.x - anchor.x, to.z - anchor.z) < PUSH_RADIUS * 2) return undefined;
    const sight = this.collision?.raycast?.(centre(anchor), centre(to));
    if (sight && distance(sight, centre(to)) > .1) return undefined;
    for (const other of this.actors.values()) {
      const o = other.state;
      if (other === a || o.id === skip || !o.alive || Math.abs(o.y - to.y) >= 1.5) continue;
      if (Math.hypot(o.x - to.x, o.z - to.z) < pushOf(o) + PUSH_RADIUS) return undefined;
    }
    return to;
  }

  private startChase(a: Actor, chased: Actor, byLight = false) {
    const p = a.state, q = chased.state;
    const light = a.forged ? this.moveOf(a, 'light') : rushMove(p.fighter, 0, !!p.awakened), lead = light.contacts[0];
    const meet = this.flightAhead(chased, CHASE_SECONDS + lead);
    const hx = meet.x - p.x, hz = meet.z - p.z, flat = Math.hypot(hx, hz);
    const along = flat > 1e-3 ? Math.max(0, flat - contactGap(p.fighter, 'light', light, false)) / flat : 0;
    const airborne = !q.grounded || chased.vy > 0;
    const to = { x: p.x + hx * along, y: airborne ? meet.y + .5 * 23 * AIR_CAST_GRAVITY * lead * lead : p.y, z: p.z + hz * along };
    const dx = to.x - p.x, dy = to.y - p.y, dz = to.z - p.z, span = Math.hypot(dx, dy, dz);
    if (span > 1e-3) { a.dashX = dx / span; a.dashY = dy / span; a.dashZ = dz / span; }
    a.dashKind = 'forward'; a.dashSeconds = CHASE_SECONDS;
    a.dashUntil = this.serverTime + CHASE_SECONDS; a.evadeUntil = this.serverTime + DASH_EVADE;
    a.dashSpeed = Math.min(CHASE_MAX_SPEED, span * CHASE_UNIT);
    a.dashChase = true; a.chaseUntil = a.lightChaseUntil = -Infinity;
    p.cooldowns.light = Math.min(p.cooldowns.light, this.serverTime);
    if (a.attackHold >= this.serverTime) a.attackHold = Math.max(a.attackHold, a.dashUntil + INPUT_BUFFER);
    if (flat > 1e-3) p.yaw = Math.atan2(hx, hz);
    const travel = a.dashSpeed / CHASE_UNIT;
    this.emit({ kind: 'chase', actorId: p.id, targetId: q.id, fighter: p.fighter, origin: position(p),
      slot: byLight ? 'light' : undefined,
      endpoint: { x: p.x + a.dashX * travel, y: p.y + a.dashY * travel, z: p.z + a.dashZ * travel } });
  }

  private chaseByLight(a: Actor): Actor | undefined {
    if (this.serverTime > a.lightChaseUntil || !a.chaseTargetId) return undefined;
    const chased = this.actors.get(a.chaseTargetId), q = chased?.state;
    if (!chased || !q?.alive || (q.grounded && chased.vy <= 0) || distance(a.state, q) > CHASE_RANGE) return undefined;
    if (!chased.kit && !a.attackPaced && !(a.jumping && !a.state.grounded)) return undefined;
    if (this.hittableInFront(a, this.rushStageFor(a), q.id)) return undefined;
    return chased;
  }

  private hittableInFront(a: Actor, stage: number, except?: string): boolean {
    const p = a.state, m = a.forged && stage === 0 ? this.moveOf(a, 'light') : rushMove(p.fighter, stage, !!p.awakened);
    const yaw = a.attackYaw ?? a.input.yaw;
    const reach = meleeReach(p.fighter, 'light', m, p.grounded);
    const across = m.radius + PLAYER_RADIUS;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (q.id === p.id || q.id === except || !q.alive || Math.abs(q.y - p.y) > across) continue;
      const dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
      if (gap > Math.min(reach, m.range + across) || gap < 1e-4) continue;
      if ((Math.sin(yaw) * dx + Math.cos(yaw) * dz) / gap >= MELEE_AIM_COS) return true;
    }
    return false;
  }

  private holdLight(a: Actor, stage: number): boolean {
    if (this.chaseByLight(a)) return true;
    const p = a.state;
    if (stage > 0 || !p.grounded || !a.chaseTargetId) return false;
    const launched = this.actors.get(a.chaseTargetId), q = launched?.state;
    return !!launched && !!q?.alive && !q.grounded && launched.reaction === 'launched'
      && Math.hypot(q.x - p.x, q.z - p.z) <= LAUNCH_HOLD_RANGE
      && !this.hittableInFront(a, stage, q.id);
  }

  private flightAhead(t: Actor, seconds: number): Vec3 {
    const q = t.state;
    const moving = Math.max(0, seconds - Math.max(0, t.hitstopUntil - this.serverTime));
    const carry = t.knockbackDrag > 0 ? (1 - Math.exp(-t.knockbackDrag * moving)) / t.knockbackDrag : moving;
    const { halfX, halfZ } = this.bounds;
    const g = 23 * (t.reaction === 'launched' ? LAUNCH_GRAVITY : 1);
    return {
      x: clamp(q.x + t.kx * carry, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS),
      y: q.grounded && t.vy <= 0 ? q.y : Math.max(0, q.y + t.vy * moving - .5 * g * moving * moving + this.leadAhead(t, moving)),
      z: clamp(q.z + t.kz * carry, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS),
    };
  }

  private dashExit(a: Actor, input: PlayerInput) {
    const length = Math.hypot(input.moveX, input.moveZ);
    if (length < 1e-4) return 0;
    const along = clamp((input.moveX * a.dashX + input.moveZ * a.dashZ) / length, 0, 1);
    const p = a.state;
    const run = 7.5 * (p.awakened ? AWAKENED_SPEED : 1);
    return Math.min(a.dashSpeed, run) * along;
  }

  private leap(a: Actor, input: PlayerInput, stale: boolean): boolean {
    const p = a.state, speed = Math.hypot(a.mx, a.mz), stick = Math.hypot(input.moveX, input.moveZ);
    if (stale || this.serverTime - a.groundedAt < LEAP_GROUNDED) {
      const run = 7.5 * (p.awakened ? AWAKENED_SPEED : 1) * (a.mods?.speed ?? 1);
      if (speed > run) { a.mx *= run / speed; a.mz *= run / speed; }
      return false;
    }
    if (speed < 1e-3 || stick < .05) return false;
    const along = clamp((input.moveX * a.mx + input.moveZ * a.mz) / (stick * speed), 0, 1);
    const k = 1 + (jumpArc(p.fighter).leap - 1) * along;
    a.mx *= k; a.mz *= k;
    return k > 1;
  }

  private risingStrike(a: Actor, cast: Cast) {
    const target = cast.riseOn ? this.actors.get(cast.riseOn) : undefined, p = a.state;
    if (!target?.state.alive || target.state.grounded || cast.move.dashThrough || cast.move.teleport || cast.move.plunge) return;
    const flat = Math.hypot(target.state.x - p.x, target.state.z - p.z);
    if (flat > this.reachOf(a, cast.slot, cast.move) + (cast.move.close ?? MAX_CLOSE) + radiusOf(target.state) - PLAYER_RADIUS) return;
    const lead = Math.max(2 / 60, cast.start + (cast.move.contacts[0] ?? .2) - this.serverTime);
    const meet = this.aheadOf(a, target, lead);
    const rise = Math.min(meet.y - p.y, RISE_REACH, RISE_SPEED * lead);
    if (rise < RISE_FROM) return;
    const hx = meet.x - p.x, hz = meet.z - p.z, span = Math.hypot(hx, hz);
    const along = span > 1e-3 ? Math.max(0, span - this.gapOf(a, cast.slot, cast.move, false)) / span : 0;
    let vx = hx * along / lead, vz = hz * along / lead;
    const across = Math.hypot(vx, vz), most = Math.min(MAX_APPROACH * 1.5, RISE_SPEED);
    if (across > most) { vx *= most / across; vz *= most / across; }
    if (span > 1e-3) { p.yaw = Math.atan2(hx, hz); cast.direction = { x: hx / span, y: 0, z: hz / span }; }
    cast.dive = { x: vx, y: rise / lead, z: vz, until: this.serverTime + lead, rise: true };
    cast.airborne = true;
    p.grounded = false; a.jumping = false;
  }

  private aheadOf(a: Actor, target: Actor, seconds: number): Vec3 {
    const ahead = seconds - (this.rewind > 0 && a.viewLag ? a.viewLag : 0), q = target.state;
    if (ahead <= 0) {
      const lag = a.viewLag;
      a.viewLag = -ahead;
      const seen = this.seenBy(a, q);
      a.viewLag = lag;
      return position(seen);
    }
    const { halfX, halfZ } = this.bounds;
    return {
      x: clamp(q.x + (target.mx + target.kx) * ahead, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS),
      y: this.heightAhead(target, ahead),
      z: clamp(q.z + (target.mz + target.kz) * ahead, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS),
    };
  }

  private leadAhead(t: Actor, seconds: number) {
    if (!(t.launchLead > 0) || t.reaction !== 'launched') return 0;
    return t.launchLead * (launchLead((t.launchRun + seconds) / t.launchSpan) - launchLead(t.launchRun / t.launchSpan));
  }

  private heightAhead(target: Actor, seconds: number) {
    const q = target.state;
    let y = q.y, vy = target.vy;
    if (q.grounded && vy <= 0) return y;
    const jumping = target.jumping && !target.reaction, g = 23 * (target.reaction === 'launched' ? LAUNCH_GRAVITY : 1), dt = 1 / 60;
    let run = 0;
    for (let t = 0; t < seconds && y >= 0; t += dt) {
      vy -= g * dt * (jumping ? jumpGravity(vy, false) : 1);
      y += vy * dt; run += dt;
    }
    return Math.max(0, y + this.leadAhead(target, run));
  }

  private airborneOpener(a: Actor, cast: Cast) {
    const p = a.state;
    const run = 7.5 * (p.awakened ? AWAKENED_SPEED : 1) * (a.mods?.speed ?? 1), carried = Math.hypot(a.mx, a.mz);
    if (carried > run) { a.mx *= run / carried; a.mz *= run / carried; }
    if (a.kit) return;
    const lead = Math.max(1 / 60, cast.move.contacts[0] ?? .2);
    if (cast.branch === 'airHeavy') {
      const q = this.airAim(a, AIR_STRIKE_REACH, true);
      let vx: number, vy: number, vz: number;
      if (q) {
        const meet = q.state.grounded && q.vy <= 0 ? position(q.state) : this.flightAhead(q, lead);
        const hx = meet.x - p.x, hz = meet.z - p.z, flat = Math.hypot(hx, hz);
        const along = flat > 1e-3 ? Math.max(0, flat - this.gapOf(a, 'heavy', cast.move, false)) / flat : 0;
        vx = hx * along / lead; vz = hz * along / lead; vy = Math.min(AIR_CAST_RISE, (meet.y + .4 - p.y) / lead);
        const speed = Math.hypot(vx, vy, vz);
        if (speed > AIR_STRIKE_SPEED) { vx *= AIR_STRIKE_SPEED / speed; vy *= AIR_STRIKE_SPEED / speed; vz *= AIR_STRIKE_SPEED / speed; }
        if (flat > 1e-3) { p.yaw = Math.atan2(hx, hz); cast.direction = { x: hx / flat, y: 0, z: hz / flat }; }
      } else {
        vx = cast.direction.x * AIR_STRIKE_BLIND[0]; vz = cast.direction.z * AIR_STRIKE_BLIND[0]; vy = -AIR_STRIKE_BLIND[1];
      }
      cast.dive = { x: vx, y: vy, z: vz, until: cast.start + lead };
      return;
    }
    if (cast.slot !== 'light' || cast.stage !== 0) return;
    const q = this.airAim(a, meleeReach(p.fighter, 'light', cast.move, false) + (cast.move.close ?? MAX_CLOSE), false);
    if (!q || (q.state.grounded && q.vy <= 0)) return;
    const meet = this.flightAhead(q, lead);
    a.vy = clamp((meet.y - p.y) / lead + .5 * 23 * AIR_CAST_GRAVITY * lead, -AIR_HOME_DROP, AIR_CAST_RISE);
  }

  private airAim(a: Actor, reach: number, below: boolean): Actor | undefined {
    const p = a.state;
    const fits = (q?: PlayerState) => !!q && q.id !== p.id && q.alive && this.hostile(p, q) && (!below || q.y <= p.y + .5)
      && Math.abs(q.y - p.y) < 8 && Math.hypot(q.x - p.x, q.z - p.z) <= reach;
    const lock = this.hardLock(a);
    if (lock) return fits(lock) ? this.actors.get(lock.id) : undefined;
    const picked = p.target ? this.actors.get(p.target) : undefined;
    if (picked && fits(picked.state)) return picked;
    let best: Actor | undefined, nearest = Infinity;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!fits(q)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      if (d > 1e-3 && (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / d < MELEE_AIM_COS) continue;
      if (d < nearest) { nearest = d; best = other; }
    }
    return best;
  }

  private shapeGroundDash(a: Actor, input: PlayerInput, dt: number) {
    a.dashEntry = Math.max(0, a.mx * a.dashX + a.mz * a.dashZ);
    const exit = this.dashExit(a, input);
    const samples: [number, number][] = [];
    let base = 0;
    for (let k = 0; k * dt < a.dashSeconds; k++) {
      const through = k * dt / a.dashSeconds;
      const sample = a.dashSpeed * dashShape(through);
      base += sample;
      samples.push([sample, through < DASH_RISE ? a.dashEntry : through > 1 - DASH_FALL ? exit : 0]);
    }
    const sum = (scale: number) => samples.reduce((total, [sample, floor]) => total + Math.max(sample * scale, floor), 0);
    let low = 0, high = 1;
    if (sum(1) > base + 1e-9) for (let i = 0; i < 24; i++) { const mid = (low + high) / 2; if (sum(mid) > base) high = mid; else low = mid; }
    else high = 1;
    a.dashPlateau = sum(1) > base + 1e-9 ? (low + high) / 2 : 1;
  }

  private headOn(a: Actor, target: Actor) {
    const other = target.cast;
    if (!other || other.move.style !== 'beam') return false;
    if (other.cine) return false;
    if (this.serverTime - other.start < other.move.contacts[0] - .5) return false;
    return this.facing(target.state, a.state) > .5;
  }

  private facing(p: PlayerState, q: PlayerState) {
    const dx = q.x - p.x, dz = q.z - p.z, n = Math.hypot(dx, dz) || 1;
    return (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / n;
  }

  private cancelBeams(a: Actor, b: Actor, midpoint: Vec3) {
    const castA = a.cast, castB = b.cast;
    if (!castA || !castB) return;
    a.cast = b.cast = null;
    for (const actor of [a, b]) {
      actor.state.cooldowns[actor === a ? castA.slot : castB.slot] =
        Math.max(actor.state.cooldowns[actor === a ? castA.slot : castB.slot] ?? 0, this.serverTime + .35);
      this.action(actor, 'idle');
    }
    this.emit({ kind: 'projectile-clash', actorId: a.state.id, targetId: b.state.id,
      fighter: a.state.fighter, slot: castA.slot, origin: position(midpoint), endpoint: position(midpoint),
      damage: Math.round(castA.move.damage + castB.move.damage) });
  }

  private shotTarget(a: Actor, cast: Cast): { at: Vec3; vx: number; vz: number; actor?: Actor } | undefined {
    const p = a.state, reach = cast.move.range + 2;
    const q = p.target ? this.actors.get(p.target) : undefined;
    if (q?.state.alive && this.hostile(p, q.state) && distance(p, q.state) <= reach) return { at: centreOf(q.state), vx: q.mx + q.kx, vz: q.mz + q.kz, actor: q };
    const body = cast.externalAim ? this.external?.locate(cast.externalAim) : undefined;
    if (body && Math.hypot(body.x - p.x, body.z - p.z) <= reach) return { at: { x: body.x, y: body.y + body.height * .55, z: body.z }, vx: 0, vz: 0 };
    return undefined;
  }

  private trackShot(a: Actor, dt: number) {
    const cast = a.cast!, aim = this.shotTarget(a, cast);
    if (!aim) return;
    const p = a.state, want = Math.atan2(aim.at.x - p.x, aim.at.z - p.z);
    const turn = ((want - p.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI, most = SHOT_TRACK * dt;
    p.yaw += clamp(turn, -most, most);
    cast.direction = { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) };
  }

  private aimShot(a: Actor, cast: Cast, from: Vec3) {
    const aim = this.shotTarget(a, cast);
    if (!aim) return;
    const p = a.state, m = cast.move, speed = m.speed ?? 20;
    let lx = 0, lz = 0, ly = 0;
    for (let pass = 0; pass < 3; pass++) {
      const t = Math.hypot(aim.at.x + lx - from.x, aim.at.y + ly - from.y, aim.at.z + lz - from.z) / speed;
      lx = aim.vx * t; lz = aim.vz * t;
      const lead = Math.hypot(lx, lz);
      if (lead > SHOT_LEAD) { lx *= SHOT_LEAD / lead; lz *= SHOT_LEAD / lead; }
      ly = aim.actor ? this.heightAhead(aim.actor, t) - aim.actor.state.y : 0;
    }
    let dx = aim.at.x + lx - from.x, dy = aim.at.y + ly - from.y, dz = aim.at.z + lz - from.z;
    const yaw = Math.atan2(dx, dz), off = ((yaw - p.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    if (Math.abs(off) > SHOT_CONE) {
      const flat = Math.hypot(dx, dz), turned = p.yaw + Math.sign(off) * SHOT_CONE;
      dx = Math.sin(turned) * flat; dz = Math.cos(turned) * flat;
    }
    const span = Math.hypot(dx, dy, dz);
    if (span < 1e-3) return;
    const dir = { x: dx / span, y: dy / span, z: dz / span };
    const end = { x: from.x + dir.x * m.range, y: from.y + dir.y * m.range, z: from.z + dir.z * m.range };
    cast.endpoint = this.collision?.raycast?.(from, end) ?? end;
    const flat = Math.hypot(dir.x, dir.z);
    if (flat > 1e-3) { p.yaw = Math.atan2(dir.x, dir.z); cast.direction = { x: dir.x / flat, y: 0, z: dir.z / flat }; }
  }

  private bombTarget(a: Actor, cast: Cast): { at: Vec3; vx: number; vz: number } | undefined {
    const aim = this.shotTarget(a, cast), q = a.state.target ? this.actors.get(a.state.target)?.state : undefined;
    if (aim && q && !q.grounded && aim.at.x === q.x && aim.at.z === q.z) aim.at = { x: q.x, y: this.floorUnder(q) + (aim.at.y - q.y), z: q.z };
    return aim;
  }
  private floorUnder(q: PlayerState) {
    if (!this.collision?.raycast) return 0;
    const c = centreOf(q), below = this.collision.raycast(c, { x: c.x, y: c.y - 60, z: c.z });
    return below.y > c.y - 59.9 ? below.y : q.y;
  }

  private aimBomb(a: Actor, cast: Cast, from: Vec3) {
    const aim = this.bombTarget(a, cast);
    if (!aim) return;
    const p = a.state, m = cast.move, end = { x: 0, y: 0, z: 0 };
    bombLead(from, aim.at, aim.vx, aim.vz, m.speed ?? 20, end);
    inRange(end, from, m.range);
    cast.endpoint = this.collision?.raycast?.(from, end) ?? end;
    const dx = end.x - p.x, dz = end.z - p.z, flat = Math.hypot(dx, dz);
    if (flat > 1e-3) { p.yaw = Math.atan2(dx, dz); cast.direction = { x: dx / flat, y: 0, z: dz / flat }; }
  }

  private homeBomb(shot: Projectile, dt: number) {
    const q = shot.aimId ? this.actors.get(shot.aimId) : undefined, thrower = this.actors.get(shot.actorId)?.state;
    const left = shot.startAt + shot.duration - this.serverTime;
    if (!q?.state.alive || thrower && !this.hostile(thrower, q.state) || left <= BOMB_COMMIT || dt <= 0) return;
    homeStep(shot.end, homeWant(centreOf(q.state), q.mx + q.kx, q.mz + q.kz, left, { x: 0, z: 0 }), BOMB_HOME, dt, shot.aimed!);
    inRange(shot.end, shot.start, shot.move.range);
    const wall = this.collision?.raycast?.(shot.start, shot.end);
    if (wall && Math.hypot(wall.x - shot.end.x, wall.z - shot.end.z) > .01) { shot.end.x = wall.x; shot.end.z = wall.z; }
  }

  private updateCast(a: Actor) {
    const cast = a.cast!;
    if (cast.move.teleport) this.blink(a, cast);
    const age = this.serverTime - cast.start - (cast.slot === 'ultimate' ? 0 : AGE_EPSILON);
    if (this.timeStopTour(a, cast)) return;
    if (this.ultimateTick(a, cast)) return;
    if (cast.move.plunge && cast.airborne && !cast.landed) {
      if (!a.state.grounded && this.serverTime - cast.start < PLUNGE_LIMIT) return;
      cast.landed = true;
      const late = this.serverTime - cast.start - cast.move.contacts[0];
      if (late > 0) { cast.start += late; a.state.actionStarted = cast.start; }
      cast.endpoint = { x: a.state.x, y: a.state.y + .3, z: a.state.z };
      const drop = cast.plungeFrom === undefined ? 0 : Math.max(0, cast.plungeFrom - a.state.y);
      if (a.state.grounded && drop >= PLUNGE_IMPACT_DROP)
        this.emit({ kind: 'land', actorId: a.state.id, fighter: a.state.fighter, slot: cast.slot, ...(cast.branch ? { branch: cast.branch } : {}), origin: position(a.state), drop: +drop.toFixed(2) });
      this.updateCast(a); return;
    }
    while (cast.nextContact < cast.move.contacts.length && age >= cast.move.contacts[cast.nextContact]) {
      const contact = cast.nextContact++;
      if (cast.move.area) { this.releaseArea(a, cast, contact); continue; }
      if(cast.move.timeStop?.contact===contact){
        const stop=cast.move.timeStop,origin=centre(a.state);
        const domain=!a.kit&&!!(stop.tour??TIME_STOP_TOURS[a.state.fighter])?.domain;
        this.emit({kind:'release',actorId:a.state.id,fighter:a.state.fighter,slot:cast.slot,origin,endpoint:position(origin),contactIndex:contact});
        for(const target of this.actors.values()){
          if(!this.hostile(a.state,target.state)||!target.state.alive||distance(origin,centreOf(target.state))>stop.radius||this.serverTime<target.evadeUntil
            ||this.floorDodges(target,cast.slot,this.fighterBlow(a,target)))continue;
          const obstruction=domain?undefined:this.collision?.raycast?.(origin,centreOf(target.state));
          if(obstruction&&distance(origin,obstruction)+.1<distance(origin,centreOf(target.state)))continue;
          target.freezeUntil=Math.max(target.freezeUntil,this.serverTime+stop.duration);target.state.timeStopped=true;
        }
        this.external?.freeze(origin,stop.radius,stop.duration,a.state.id);
      }else if(cast.move.style==='field'){
        const origin=centre(a.state),endpoint=cast.endpoint;
        this.emit({kind:'release',actorId:a.state.id,fighter:a.state.fighter,slot:cast.slot,origin,endpoint:position(endpoint),contactIndex:contact,...(cast.branch?{branch:cast.branch}:{})});
        for(const target of this.actors.values()){
          if(!this.hostile(a.state,target.state)||!target.state.alive||distance(centreOf(target.state),endpoint)>cast.move.radius+radiusOf(target.state))continue;
          const obstruction=this.collision?.raycast?.(origin,centreOf(target.state));
          if(obstruction&&distance(origin,obstruction)+.1<distance(origin,centreOf(target.state)))continue;
          this.hit(a.state.id,target,cast.slot,cast.move,endpoint,contact===cast.move.contacts.length-1,endpoint,contact,cast.opened,cast.id,cast.stage);
        }
        if(this.external){
          const n=this.external.query(endpoint,endpoint,cast.move.radius+1.2,this.nearby);
          for(let i=0;i<n;i++){const body=this.nearby[i];
            if(this.external.hostile?.(a.state.id,body)===false||Math.hypot(body.x-endpoint.x,body.y+body.height*.55-endpoint.y,body.z-endpoint.z)>cast.move.radius+body.radius)continue;
            this.hitExternal(a.state.id,body,cast.slot,cast.move,endpoint,contact===cast.move.contacts.length-1,contact,cast.id,cast.stage);}
        }
      }else if (cast.move.style === 'melee' || cast.move.style === 'beam') {
        if (cast.move.track && cast.move.style === 'beam') this.trackLine(a, cast);
        if (cast.move.style === 'beam' || !traitsOf(a.state.fighter).quietMeleeRelease) {
          const origin = cast.through ? centre(cast.through.from) : centre(a.state);
          this.emit({ kind: 'release', actorId: a.state.id, fighter: a.state.fighter, slot: cast.slot, origin,
            endpoint: cast.move.style === 'beam' ? cast.endpoint : cast.through ? centre(a.state)
              : { x: origin.x + cast.direction.x * cast.move.range, y: origin.y, z: origin.z + cast.direction.z * cast.move.range },
            contactIndex: contact, chain: cast.slot === 'light' ? cast.stage : undefined, ...(cast.branch ? { branch: cast.branch } : {}) });
        }
        if (!this.sweep(a, cast, contact) && cast.move.style === 'melee' && a.cast === cast) {
          (cast.live ??= []).push({ index: contact,
            until: Math.min(cast.start + cast.move.duration, this.serverTime + activeWindow(cast.move)) });
        }
        if (a.cast !== cast) return;
      } else {
        const start = attackOrigin(a.state,cast.move);
        if (cast.move.style === 'bomb' ? cast.move.aimOnRelease : aimsAsLetGo(cast.move)) { if (cast.move.style === 'bomb') this.aimBomb(a, cast, start); else this.aimShot(a, cast, start); }
        this.emit({ kind: 'release', actorId: a.state.id, fighter: a.state.fighter,
          slot: cast.slot, origin: start, endpoint: position(cast.endpoint), contactIndex: contact, chain: cast.slot === 'light' ? cast.stage : undefined });
        this.projectiles.push({ actorId: a.state.id, fighter: a.state.fighter, slot: cast.slot, move: cast.move,
          start, end: position(cast.endpoint), startAt: this.serverTime,
          duration: Math.max(0.06, distance(start, cast.endpoint) / (cast.move.speed ?? 20)), previous: start, opened: cast.opened,
          castId: cast.id, stage: cast.stage, aimId: a.state.target ?? undefined, ...(cast.beat ? { beat: true } : {}), ...(cast.mash ? { mash: true } : {}),
          ...(cast.move.aimOnRelease && cast.move.style === 'bomb' ? { aimed: position(cast.endpoint) } : {}) });
      }
    }
    if (cast.live?.length) {
      for (let i = cast.live.length - 1; i >= 0; i--) {
        const open = cast.live[i];
        if (this.serverTime > open.until) { cast.live.splice(i, 1); continue; }
        if (this.sweep(a, cast, open.index)) cast.live.splice(i, 1);
        if (a.cast !== cast) return;
      }
    }
    if (age >= cast.move.duration) {
      a.cast = null;
      if (cast.slot === 'light') {
        a.rushStage = cast.stage;
        a.rushUntil = this.rushFollow(a, cast) ? this.serverTime + RUSH_WINDOW : -Infinity;
        a.rushOpened = [...cast.opened];
      }
    }
  }

  private trackLine(a: Actor, cast: Cast) {
    const q = a.state.target ? this.actors.get(a.state.target)?.state : undefined;
    if (!q?.alive || !this.hostile(a.state, q)) return;
    const from = attackOrigin(a.state, cast.move), c = centreOf(q), range = cast.move.range;
    const dx = c.x - from.x, dy = c.y - from.y, dz = c.z - from.z, n = Math.hypot(dx, dy, dz);
    if (n < 1e-3 || n > range) return;
    const d = cast.direction, dn = Math.hypot(d.x, d.y, d.z) || 1;
    if ((dx * d.x + dy * d.y + dz * d.z) / (n * dn) < Math.cos(cast.move.track!)) return;
    const end = { x: from.x + dx / n * range, y: from.y + dy / n * range, z: from.z + dz / n * range };
    cast.endpoint = this.collision?.raycast?.(from, end) ?? end;
  }

  private sweep(a: Actor, cast: Cast, contact: number): boolean {
    const through = cast.through;
    const origin = through ? centre(through.from) : centre(a.state);
    const tip = through ? centre(a.state) : origin;
    const endpoint = cast.move.style === 'beam' ? cast.endpoint : {
      x: tip.x + cast.direction.x * cast.move.range,
      y: tip.y, z: tip.z + cast.direction.z * cast.move.range,
    };
    let landed = false;
    for (const target of this.actors.values()) {
      if (!this.hostile(a.state, target.state) || !target.state.alive) continue;
      const seen = this.seenBy(a, target.state);
      if (!this.inBlowLane(a, cast, seen, origin, endpoint)) continue;
      const tc = centreOf(seen);
      const girth = radiusOf(target.state) - PLAYER_RADIUS;
      if (through ? segmentDistance(tc, origin, tip) > this.reachOf(a, cast.slot, cast.move, !cast.airborne) + girth
        : segmentDistance(tc, origin, endpoint) > cast.move.radius + radiusOf(target.state)) continue;
      if (cast.move.style === 'beam' && this.headOn(a, target)) {
        this.cancelBeams(a, target,
          { x: (origin.x + tc.x) / 2, y: (origin.y + tc.y) / 2, z: (origin.z + tc.z) / 2 });
        return true;
      }
      const dx = tc.x - origin.x, dz = tc.z - origin.z;
      if (!through && cast.move.style === 'melee' && dx * cast.direction.x + dz * cast.direction.z < -0.1) continue;
      if (!through && cast.move.style === 'melee' && distance(a.state, seen) > this.reachOf(a, cast.slot, cast.move, !cast.airborne) + girth) continue;
      const obstruction = this.collision?.raycast?.(origin, tc);
      if (obstruction && distance(origin, obstruction) + 0.1 < distance(origin, tc)) continue;
      const blow = through ? centre(a.state) : origin;
      this.hit(a.state.id, target, cast.slot, cast.move, blow, contact === cast.move.contacts.length - 1, blow, contact, cast.opened, cast.id, cast.stage, through ? origin : undefined);
      landed = true;
      if (a.cast !== cast) return true;
    }
    if (this.external) {
      const reach = this.reachOf(a, cast.slot, cast.move, !cast.airborne);
      const far = through ? tip : endpoint, wide = through ? reach : cast.move.radius;
      const n = this.external.query(origin, far, wide + 1.2, this.nearby);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        const bc = { x: body.x, y: body.y + body.height * .55, z: body.z }, girth = body.radius - PLAYER_RADIUS;
        if (through ? segmentDistance(bc, origin, tip) > reach + girth : segmentDistance(bc, origin, endpoint) > cast.move.radius + body.radius) continue;
        if (!through && cast.move.style === 'melee') {
          if ((bc.x - origin.x) * cast.direction.x + (bc.z - origin.z) * cast.direction.z < -0.1) continue;
          if (Math.hypot(body.x - a.state.x, body.y - a.state.y, body.z - a.state.z) > reach + girth) continue;
        }
        if (this.hitExternal(a.state.id, body, cast.slot, cast.move, through ? centre(a.state) : origin, contact === cast.move.contacts.length - 1, contact, cast.id, cast.stage)) landed = true;
        if (a.cast !== cast) return true;
      }
    }
    return landed;
  }

  private areaCentre(a: Actor, m: MoveDefinition, target: PlayerState | null): Vec3 {
    const p = a.state, aim = a.attackAim;
    if (m.range === 0) return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) };
    let x: number, z: number;
    if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.z)) { x = aim.x; z = aim.z; }
    else if (target?.alive && Math.hypot(target.x - p.x, target.z - p.z) <= m.range) { x = target.x; z = target.z; }
    else { const ahead = Math.min(AREA_DEFAULTS.aim, m.range); x = p.x + Math.sin(p.yaw) * ahead; z = p.z + Math.cos(p.yaw) * ahead; }
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > m.range && d > 0) { x = p.x + dx / d * m.range; z = p.z + dz / d * m.range; }
    const { halfX, halfZ } = this.bounds;
    x = clamp(x, -halfX, halfX); z = clamp(z, -halfZ, halfZ);
    return { x: +x.toFixed(3), y: this.floorAt(x, z, p.y), z: +z.toFixed(3) };
  }
  private floorAt(x: number, z: number, near: number): number {
    if (!this.collision?.raycast) return 0;
    const top = Math.max(near, 0) + 12, hit = this.collision.raycast({ x, y: top, z }, { x, y: -20, z });
    return hit.y > -19.9 ? +hit.y.toFixed(3) : 0;
  }
  private releaseArea(a: Actor, cast: Cast, contact: number) {
    if (cast.move.range === 0) cast.endpoint = this.areaCentre(a, cast.move, null);
    const m = cast.move, area = m.area!, due = this.serverTime + area.telegraph, offsets = strikeOffsets(m);
    this.emit({ kind: 'release', actorId: a.state.id, fighter: a.state.fighter, slot: cast.slot, origin: centre(a.state), endpoint: position(cast.endpoint),
      contactIndex: contact, radius: m.radius, due: +due.toFixed(4), move: m.name, ...(area.fx ? { look: area.fx } : {}), strikes: offsets.length });
    if (!this.resolveAreas) return;
    this.areas.push({ actorId: a.state.id, fighter: a.state.fighter, move: m, at: position(cast.endpoint), due, offsets, next: 0, castId: cast.id, opened: new Map() });
  }
  private updateAreas() {
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const strike = this.areas[i], m = strike.move, area = m.area!, hits = strike.offsets.length;
      while (strike.next < hits && this.serverTime >= strike.due + strike.offsets[strike.next]) {
        const k = strike.next++, finisher = k === hits - 1, at = strike.at, height = area.height ?? AREA_DEFAULTS.height;
        const caster = this.actors.get(strike.actorId)?.state;
        this.emit({ kind: 'impact', actorId: strike.actorId, fighter: strike.fighter, slot: 'area', origin: position(at), endpoint: position(at),
          contactIndex: k, radius: m.radius, move: m.name, ...(area.fx ? { look: area.fx } : {}), strikes: hits });
        if (caster) for (const target of this.actors.values()) {
          const q = target.state, off = Math.hypot(q.x - at.x, q.z - at.z);
          if (q.id === caster.id || !q.alive || !this.hostile(caster, q)) continue;
          if (off > m.radius + radiusOf(q) || q.y < at.y - 1 || q.y > at.y + height) continue;
          this.hit(strike.actorId, target, 'area', m, at, finisher, at, k, strike.opened, strike.castId, 0, undefined, false, false, areaBlow(off, m.radius));
        }
        if (caster && this.external) {
          const n = this.external.query(at, at, m.radius + 1.2, this.nearby);
          for (let j = 0; j < n; j++) {
            const body = this.nearby[j], off = Math.hypot(body.x - at.x, body.z - at.z);
            if (this.external.hostile?.(strike.actorId, body) === false || off > m.radius + body.radius
              || body.y < at.y - 1 || body.y > at.y + height) continue;
            this.hitExternal(strike.actorId, body, 'area', m, at, finisher, k, strike.castId, 0, areaBlow(off, m.radius));
          }
        }
      }
      if (strike.next >= hits) this.areas.splice(i, 1);
    }
  }

  private updateProjectiles(dt = 0) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      if (shot.aimed) this.homeBomb(shot, dt);
      const t = clamp((this.serverTime - shot.startAt) / shot.duration, 0, 1);
      const point = { x: shot.start.x + (shot.end.x - shot.start.x) * t,
        y: shot.start.y + (shot.end.y - shot.start.y) * t, z: shot.start.z + (shot.end.z - shot.start.z) * t };
      let impacted = t >= 1;
      for (let j = i - 1; j >= 0 && !impacted && shot.move.style !== 'bomb'; j--) {
        const other = this.projectiles[j];
        if (other.actorId === shot.actorId || other.move.style === 'bomb') continue;
        const shooters = [this.actors.get(shot.actorId)?.state, this.actors.get(other.actorId)?.state];
        if (shooters[0] && shooters[1] && !this.hostile(shooters[0], shooters[1])) continue;
        const ot = clamp((this.serverTime - other.startAt) / other.duration, 0, 1);
        const op = { x: other.start.x + (other.end.x - other.start.x) * ot,
          y: other.start.y + (other.end.y - other.start.y) * ot,
          z: other.start.z + (other.end.z - other.start.z) * ot };
        if (distance(point, op) > shot.move.radius + other.move.radius) continue;
        const midpoint = { x: (point.x + op.x) / 2, y: (point.y + op.y) / 2, z: (point.z + op.z) / 2 };
        this.emit({ kind: 'projectile-clash', actorId: shot.actorId, targetId: other.actorId,
          fighter: shot.fighter, slot: shot.slot, origin: midpoint, endpoint: position(midpoint),
          damage: Math.round(shot.move.damage + other.move.damage) });
        this.projectiles.splice(j, 1);
        i--;
        impacted = true;
      }
      const shooter = this.actors.get(shot.actorId)?.state;
      if (!impacted && shot.move.style === 'projectile') {
        for (const a of this.actors.values()) {
          if (!a.state.alive || a.state.id === shot.actorId || (shooter && !this.hostile(shooter, a.state))
            || shooter?.team === undefined && a.state.id !== shot.aimId
              && !this.inLane(a.state, shot.start, shot.end.x - shot.start.x, 0, shot.end.z - shot.start.z)) continue;
          if (segmentDistance(centreOf(a.state), shot.previous, point) <= shot.move.radius + radiusOf(a.state)) {
            this.hit(shot.actorId, a, shot.slot, shot.move, shot.start, true, shot.start, undefined, shot.opened, shot.castId, shot.stage);
            impacted = true;
            break;
          }
        }
        if (!impacted && this.external && shooter) {
          const n = this.external.query(shot.previous, point, shot.move.radius + 1.2, this.nearby);
          for (let k = 0; k < n; k++) {
            const body = this.nearby[k];
            if (shot.pierced?.has(body.id)) continue;
            if (segmentDistance({ x: body.x, y: body.y + body.height * .55, z: body.z }, shot.previous, point) > shot.move.radius + body.radius) continue;
            if (!this.hitExternal(shot.actorId, body, shot.slot, shot.move, shot.start, true, undefined, shot.castId, shot.stage)) continue;
            if (shot.slot === 'light' || shot.slot === 'heavy') { impacted = true; break; }
            (shot.pierced ??= new Set()).add(body.id);
          }
        }
      }
      if (impacted) {
        if (shot.move.style === 'bomb') for (const a of this.actors.values()) {
          if (a.state.alive && a.state.id !== shot.actorId && (!shooter || this.hostile(shooter, a.state))
            && distance(centreOf(a.state), shot.end) <= shot.move.radius + radiusOf(a.state) - PLAYER_RADIUS) {
            this.hit(shot.actorId, a, shot.slot, shot.move, shot.end, true, shot.start, undefined, shot.opened, shot.castId, shot.stage);
          }
        }
        if (shot.move.style === 'bomb' && this.external && shooter) {
          const n = this.external.query(shot.end, shot.end, shot.move.radius + 1.2, this.nearby);
          for (let k = 0; k < n; k++) {
            const body = this.nearby[k];
            if (Math.hypot(body.x - shot.end.x, body.y + body.height * .55 - shot.end.y, body.z - shot.end.z) > shot.move.radius + body.radius - PLAYER_RADIUS) continue;
            this.hitExternal(shot.actorId, body, shot.slot, shot.move, shot.end, true, undefined, shot.castId, shot.stage);
          }
        }
        this.projectiles.splice(i, 1);
      } else shot.previous = point;
    }
  }

  private hit(actorId: string, target: Actor, slot: AttackSlot, move: MoveDefinition, origin: Vec3, finisher: boolean, incomingOrigin = origin, contactIndex?: number, opened?: Map<string, number>, castId?: number, stage = 0, guardFrom?: Vec3, minor = false, crowd = false, area?: AreaBlow) {
    const p = target.state;
    const attacker = this.actors.get(actorId);
    const fighters = this.fighterBlow(attacker, target, minor, crowd);
    if (this.serverTime < target.evadeUntil || this.floorDodges(target, slot, fighters)) { this.emit({ kind: 'dodge', actorId, targetId: p.id, slot, contactIndex }); return; }
    const floored = fighters && slot !== 'ultimate' && this.down(target);
    const own = attacker?.cast && castId !== undefined && attacker.cast.id === castId ? attacker.cast : undefined;
    if (own) own.connected = true;
    let fromX = origin.x - p.x, fromZ = origin.z - p.z;
    if (Math.hypot(fromX, fromZ) < 0.001) {
      fromX = incomingOrigin.x - p.x;
      fromZ = incomingOrigin.z - p.z;
    }
    const faceX = guardFrom ? guardFrom.x - p.x : fromX, faceZ = guardFrom ? guardFrom.z - p.z : fromZ;
    const front = (Math.sin(p.yaw) * faceX + Math.cos(p.yaw) * faceZ) / Math.max(0.001, Math.hypot(faceX, faceZ)) > GUARD_FRONT;
    let damage = (finisher ? move.finisherDamage ?? move.damage : move.damage) * (area?.scale ?? 1) * (attacker?.state.awakened ? AWAKENED_DAMAGE : 1) * (p.awakened ? AWAKENED_RESIST : 1);
    let critical = false;
    if (attacker?.mods || target.mods) {
      damage *= (attacker?.mods?.damageOut ?? 1) * (target.mods?.damageIn ?? 1);
      if (attacker?.mods?.crit && this.random() < attacker.mods.crit) { critical = true; damage *= attacker.mods.critDamage; }
    }
    let guardBreak = false;
    const guardUp = p.guarding || this.serverTime < target.blockedUntil && !target.reaction;
    if (guardUp) {
      if (front && slot !== 'ultimate' && target.guardHeld && this.serverTime - target.guardAt <= JUST_GUARD_WINDOW) {
        target.parryCaught = true;
        p.ultimate = Math.min(100, p.ultimate + JUST_GUARD_METER);
        p.stamina = Math.min(p.maxStamina ?? 100, p.stamina + PARRY_STAMINA);
        this.freeze(target, PARRY_FREEZE);
        const thrower = attacker && attacker !== target ? attacker : undefined;
        const reach = !!thrower && (move.style === 'melee' || distance(thrower.state, p) <= PARRY_REACH);
        const guardedAt = centre(p);
        const vanished = reach && move.style === 'melee' ? this.vanish(target, thrower!) : null;
        if (thrower && (reach || move.style === 'beam')) { thrower.cast = null; thrower.rushUntil = -Infinity; }
        if (thrower && reach) {
          const stagger = thrower.kit ? JUST_GUARD_ADVANTAGE_KIT : JUST_GUARD_ADVANTAGE;
          thrower.stunUntil = Math.max(thrower.stunUntil, this.serverTime + stagger);
          thrower.parriedUntil = this.serverTime + stagger;
          thrower.dashUntil = Math.min(thrower.dashUntil, this.serverTime);
          thrower.reaction = 'hurt'; thrower.reactionClip = stagger; thrower.staggeredAt = this.serverTime;
          this.freeze(thrower, PARRY_FREEZE);
          const n0 = Math.hypot(fromX, fromZ) || 1;
          const shove = vanished ? -VANISH_STUMBLE : 3.5;
          thrower.kx = fromX / n0 * shove; thrower.kz = fromZ / n0 * shove; thrower.knockbackDrag = 10;
          this.action(thrower, 'hurt', stagger, true);
          target.counterUntil = this.serverTime + PARRY_FREEZE + stagger;
          if (p.isBot) target.nextBotThink = Math.min(target.nextBotThink, this.serverTime + PARRY_FREEZE + .22 - .14 * target.botSkill);
        }
        this.emit({ kind: 'just-guard', actorId, targetId: p.id, fighter: attacker?.state.fighter, slot, contactIndex,
          damage: Math.round(damage), chain: slot === 'light' ? stage : undefined, branch: own?.branch,
          reason: reach ? undefined : 'deflect', origin: position(origin), endpoint: guardedAt });
        if (vanished) this.emit({ kind: 'vanish', actorId: p.id, targetId: actorId, fighter: p.fighter, slot,
          origin: vanished.from, endpoint: vanished.to });
        return;
      }
      const guardCost = (GUARD_COST[slot] / Math.max(1, move.area ? strikeOffsets(move).length : move.contacts.length) + GUARD_COST_DAMAGE * damage) * (front ? 1 : GUARD_REAR_COST);
      p.stamina = Math.max(0, p.stamina - guardCost);
      guardBreak = p.stamina === 0 || !!move.guardBreak;
      const unblocked = damage;
      p.awakening = Math.min(100, (p.awakening ?? 0) + unblocked * AWAKENING_PER_BLOCKED);
      damage = Math.max(1, Math.round(damage * (guardBreak ? 0.6 : CHIP[slot])));
      this.emit({ kind: guardBreak ? 'guard-break' : 'blocked', actorId, targetId: p.id, slot, damage,
        contactIndex, origin: position(origin), endpoint: centre(p), fromBehind: !front || undefined,
        chain: slot === 'light' ? stage : undefined, branch: own?.branch });
      if (!guardBreak) {
        const before = p.hp;
        p.hp = slot === 'ultimate' ? Math.max(0, p.hp - damage) : Math.max(1, p.hp - damage);
        this.tally(target, attacker, before - p.hp);
        if (p.hp === 0) { this.eliminate(target, actorId); return; }
        const blockN = Math.hypot(fromX, fromZ) || 1;
        const ender = finisher && (slot === 'light' ? stage >= RUSH_STAGES - 1 : !!own?.branch || !!move.ender);
        const shove = !finisher ? BLOCK_PUSH.light : ender ? Math.max(BLOCK_PUSH_ENDER, BLOCK_PUSH[slot]) : BLOCK_PUSH[slot];
        target.kx = -fromX / blockN * shove; target.kz = -fromZ / blockN * shove;
        target.knockbackDrag = BLOCK_DRAG; target.mx = target.mz = 0;
        target.blockedUntil = this.serverTime + BLOCK_STUN[slot];
        target.stunUntil = Math.max(target.stunUntil, target.blockedUntil);
        const held = HITSTOP[slot] * .6;
        this.freeze(target, held);
        if (attacker && attacker !== target) {
          this.freeze(attacker, held);
          attacker.kx = fromX / blockN * shove * BLOCK_RECOIL; attacker.kz = fromZ / blockN * shove * BLOCK_RECOIL;
          attacker.knockbackDrag = BLOCK_DRAG;
        }
        return;
      }
    }
    const airborneBefore = !p.grounded;
    if (this.serverTime - target.lastDamageAt > 1.2) target.chainHits = target.scalingHits = 0;
    const opening = !opened?.has(p.id);
    if (!crowd && (opening || slot !== 'area' || target.scalingHits === 0)) target.scalingHits++;
    if (opening && !crowd) { target.chainHits++; opened?.set(p.id, target.chainHits); }
    const chain = finisher ? opened?.get(p.id) ?? target.chainHits : target.chainHits;
    const stunScale = Math.max(0.2, 1 - Math.max(0, chain - 1) * 0.14);
    const duel = !crowd && !target.kit && !attacker?.kit;
    const marks = own ?? (duel && castId !== undefined ? this.projectiles.find(s => s.castId === castId && s.actorId === actorId) : undefined);
    const scaled = crowd ? 1 : duel && move.ender ? 1 - (1 - damageScale(target.scalingHits)) * ENDER_SCALING : damageScale(target.scalingHits);
    const standing = damage * scaled * (duel && marks?.beat ? RHYTHM_BONUS : 1) * (duel && marks?.mash ? MASH_SCALE : 1);
    damage = floored ? groundHitDamage(standing, target.floorHits, target.floorTaken, p.maxHp) : Math.max(1, Math.round(standing));
    if (floored) { target.floorHits++; target.floorTaken += damage; }
    target.lastDamageAt = this.serverTime;
    const hpBefore = p.hp;
    p.hp = Math.max(0, p.hp - damage);
    this.tally(target, attacker, hpBefore - p.hp);
    p.guarding = false;
    if (target.jumping) target.vy = Math.min(target.vy, AIR_CAST_RISE);
    target.jumping = false;
    const poise = target.poiseMax && p.hp > 0 && !guardBreak ? this.spendPoise(target, damage, slot) : 'open';
    const poised = poise === 'poised';
    const graced = minor && !target.kit && this.serverTime < (target.minorArmourUntil ?? -Infinity) && !guardBreak;
    const armoured = graced || poised || poise !== 'broken' && !!target.cast && target.armour !== false && p.hp > 0 && !breaksArmour(slot, target.cast.slot) && !guardBreak;
    if (minor && !armoured) target.minorArmourUntil = this.serverTime + MINOR_GRACE;
    if (!armoured) { target.cast = null; target.dashUntil = 0; target.rushUntil = -Infinity; }
    const stun = finisher ? move.finisherStun ?? move.stun : move.stun;
    const n = Math.hypot(fromX, fromZ) || 1;
    const knockback = finisher ? move.finisherKnockback ?? move.knockback : move.knockback;
    const escaped = !floored && !crowd && target.breaker !== false && target.chainHits >= BREAK_CASTS && (opening || finisher);
    const juggling = !floored && !armoured && !escaped && !p.grounded && p.hp > 0 && target.juggleHits < MAX_JUGGLE;
    const shaped = floored ? undefined : this.outcomeOf(target, move, finisher && !armoured && !escaped && !guardBreak && p.hp > 0);
    const launches = !floored && !target.anchored && (juggling || (!armoured && !escaped && finisher && (shaped && shaped !== 'spent' ? LAUNCHING.has(shaped) : knockback >= LAUNCH_KNOCKBACK) && p.hp > 0));
    const broken = poise === 'broken';
    const dizzy = shaped === 'dizzy' && !launches;
    const reaction: ReactionKind = floored ? 'flinch' : guardBreak || dizzy ? 'stun' : launches ? 'launched' : broken ? 'stun' : !finisher || escaped ? 'flinch' : 'hurt';
    const follow = own && slot === 'light' ? this.rushFollow(attacker!, own) : undefined;
    const pending = !own && slot === 'light' && attacker?.cast?.slot === 'light' && attacker.cast.nextContact === 0 ? attacker.cast : undefined;
    const linkTo = follow ? Math.max(own!.move.contacts[0], follow.contacts[0])
      : pending ? pending.start + pending.move.contacts[0] - this.serverTime : undefined;
    const advantage = armoured || guardBreak || !finisher || juggling ? 0
      : linkTo !== undefined ? Math.min(MAX_FLOOR_STUN[slot], linkTo + ADV_ON_HIT[slot])
      : move.style === 'melee' && own ? Math.min(MAX_FLOOR_STUN[slot], own.move.contacts[0] + ADV_ON_HIT[slot]) : 0;
    if (!armoured && floored) target.stunUntil = Math.max(target.stunUntil, Math.min(this.serverTime + GROUND_HIT_HOLD, target.floorUntil));
    else if (!armoured) target.stunUntil = this.serverTime + (dizzy ? move.daze ?? DIZZY_SECONDS : guardBreak ? GUARD_BREAK_STUN
      : linkTo !== undefined ? Math.max(stun * stunScale, advantage) : Math.max(stun, advantage) * stunScale) * (target.mods ? target.mods.stunIn : 1);
    if (!armoured && !floored && target.parriedUntil > this.serverTime) target.stunUntil = Math.max(target.stunUntil, target.parriedUntil);
    if (broken) {
      target.stunUntil = Math.max(target.stunUntil, this.serverTime + POISE_BREAK_STUN);
      target.poiseBrokenUntil = target.stunUntil + POISE_GRACE;
      this.emit({ kind: 'poise-break', actorId: p.id, targetId: actorId, origin: position(p), endpoint: centreOf(p) });
    }
    if (escaped) {
      target.evadeUntil = this.serverTime + BREAK_EVADE; target.stunUntil = this.serverTime + 0.08; target.chainHits = 0;
      opened?.delete(p.id);
    }
    const push = (finisher ? 1 : 0.2) * (armoured ? 0.25 : 1) * (target.mods ? target.mods.knockbackIn : 1);
    if (floored) {
      const shove = Math.min(GROUND_HIT_SHOVE, knockback * push);
      if (shove > Math.hypot(target.kx, target.kz)) { target.kx = -fromX / n * shove; target.kz = -fromZ / n * shove; target.knockbackDrag = 7; }
    } else {
      target.kx = -fromX / n * knockback * push;
      target.kz = -fromZ / n * knockback * push;
      target.knockbackDrag = slot === 'ultimate' ? 3 : move.style === 'beam' ? 4 : finisher && move.finisherKnockback !== undefined ? 5 : 7;
      if (slot === 'light' && finisher && stage < RUSH_STAGES - 1 && !launches && !armoured && move.style === 'melee'
        && STRING_SHOVE > knockback * push / target.knockbackDrag && attacker && this.roomToFollow(attacker, target, slot, move)) {
        const shove = STRING_SHOVE * STRING_DRAG;
        target.kx = -fromX / n * shove; target.kz = -fromZ / n * shove; target.knockbackDrag = STRING_DRAG;
      }
    }
    if (escaped) {
      target.kx = -fromX / n * BREAK_PUSH; target.kz = -fromZ / n * BREAK_PUSH;
      target.knockbackDrag = 9; target.mx = target.mz = 0;
      this.freeze(target, BREAK_FREEZE);
      if (attacker) this.freeze(attacker, BREAK_FREEZE);
      this.emit({ kind: 'break', actorId: p.id, targetId: actorId, fighter: p.fighter, slot,
        origin: position(p), endpoint: centre(p), contactIndex });
    }
    if (launches) {
      if (juggling) {
        target.juggleHits++;
        const lift = JUGGLE_LIFT * Math.max(.25, 1 - (target.juggleHits - 1) * JUGGLE_DECAY);
        target.vy = target.reaction === 'launched' ? Math.max(target.vy, lift) : lift;
        if (own && attacker && !attacker.state.grounded && (move.style === 'melee' || slot === 'light')) {
          const t = JUGGLE_RIDE_AHEAD, level = target.vy + (p.y - attacker.state.y) / t - .5 * 23 * (LAUNCH_GRAVITY - AIR_CAST_GRAVITY) * t;
          attacker.vy = Math.max(attacker.jumping ? Math.min(attacker.vy, AIR_CAST_RISE) : attacker.vy, clamp(level, 0, target.vy + 2));
          attacker.jumping = false;
        }
      } else {
        target.juggleHits = 0;
        target.vy = slot === 'ultimate' ? 11 : slot === 'special' ? 9 : 7.5;
      }
      p.grounded = false; target.launchSlot = slot;
      if (attacker && attacker !== target && p.hp > 0 && !attacker.kit) {
        attacker.chaseTargetId = p.id; attacker.chaseUntil = this.serverTime + CHASE_WINDOW;
        attacker.lightChaseUntil = slot === 'heavy' || (slot === 'light' && stage >= RUSH_STAGES - 1)
          ? this.serverTime + LIGHT_CHASE_WINDOW : -Infinity;
      }
    }
    if (!floored && !armoured && !escaped && finisher && airborneBefore && p.hp > 0 && slot !== 'light') {
      target.bounceOnLand = true;
    }
    if (!armoured && !floored) this.shapeBlow(target, shaped, move, fromX / n, fromZ / n, juggling, launches, attacker, slot === 'light' && stage < RUSH_STAGES - 1);
    if (!armoured && !floored) {
      target.reaction = reaction;
      target.reactionClip = Math.max(.05, stun * 1.25);
      const hold = Math.max(.05, target.stunUntil - this.serverTime);
      this.action(target, reaction, reaction === 'flinch' || reaction === 'hurt' ? Math.min(hold, target.reactionClip) : hold, true);
    }
    p.awakening = Math.min(100, (p.awakening ?? 0) + damage * AWAKENING_PER_DAMAGE * (target.mods ? target.mods.awakenGain : 1));
    const source = attacker?.state;
    if (source && slot !== 'ultimate') source.ultimate = Math.min(100, source.ultimate + damage * ULTIMATE_PER_DAMAGE * (move.detached ? DETACHED_METER : 1) * (attacker?.mods ? attacker.mods.meterGain : 1));
    if (source?.alive && attacker?.mods?.lifesteal && attacker !== target) source.hp = Math.min(source.maxHp, source.hp + (hpBefore - p.hp) * attacker.mods.lifesteal);
    const gap = contactIndex !== undefined && contactIndex + 1 < move.contacts.length
      ? move.contacts[contactIndex + 1] - move.contacts[contactIndex] : Infinity;
    const big = duel && isBigBlow(slot, own?.branch ?? (move.ender ? true : undefined), stage, finisher);
    const bigStop = !big ? 0 : slot === 'special' ? BIG_HITSTOP.special : slot === 'ultimate' ? BIG_HITSTOP.ultimate : own?.branch || move.ender ? BIG_HITSTOP.ender : BIG_HITSTOP.finisher;
    const stop = finisher ? move.hitstop ?? HITSTOP[slot] : Math.min(HITSTOP[slot] * .6, gap * .3);
    const throws = big && !!(own?.branch || move.ender) && slot !== 'special' && slot !== 'ultimate';
    const held = throws ? Math.min(stop, move.fling ? AIR_FLING.hold : BIG_ENDER_HOLD) : big ? Math.max(stop, Math.min(bigStop, reaction === 'launched' ? stop + BIG_LAUNCH_MOST : bigStop)) : stop;
    if (!(minor && armoured) && !floored) this.freeze(target, held * clamp(.7 + damage / 200, .75, 1.25));
    if (attacker) {
      if (!move.detached) this.freeze(attacker, stop * .6);
      attacker.state.combo = this.serverTime < attacker.comboUntil ? (attacker.state.combo ?? 0) + 1 : 1;
      attacker.comboUntil = this.serverTime + COMBO_WINDOW;
    }
    this.emit({ kind: 'hit', actorId, targetId: p.id, fighter: source?.fighter, slot, actionSeq:own?attacker!.state.actionSeq:undefined,
      chain: slot === 'light' ? stage : undefined, ...(own?.branch ? { branch: own.branch } : {}), move: move.name, damage, origin: position(origin), endpoint: centreOf(p), contactIndex,
      combo: attacker?.state.combo, reaction: armoured && poised ? undefined : reaction, fromBehind: !front, ...(critical ? { critical } : {}),
      ...(area?.bullseye ? { bullseye: true } : {}),
      ...(shaped && shaped !== 'spent' && !armoured && (!juggling || shaped === 'groundBounce' || shaped === 'wallBounce') ? { outcome: shaped } : {}),
      ...(target.launchLead > 0 && target.launchRun === 0 ? { lift: target.vy } : {}),
      ...(floored ? { downed: true } : {}) });
    if (finisher && move.status && p.hp > 0) this.afflict(target, actorId, move.status);
    if (p.hp === 0) this.eliminate(target, actorId);
  }

  private afflict(target: Actor, fromId: string, status: NonNullable<MoveDefinition['status']>) {
    const now = this.serverTime, s = target.statuses ??= {};
    if (status.kind === 'burn') s.burn = { until: now + status.seconds, dps: status.dps ?? 0, from: fromId, next: s.burn?.next ?? now + BURN_TICK };
    else if (status.kind === 'slow') s.slow = { until: now + status.seconds, factor: status.factor ?? 1 };
    else if (now >= (s.immuneUntil ?? 0)) {
      s.freeze = { until: now + status.seconds }; s.immuneUntil = now + status.seconds + FREEZE_IMMUNITY;
      target.stunUntil = Math.max(target.stunUntil, now + status.seconds);
    } else return;
    this.emit({ kind: 'status', actorId: fromId, targetId: target.state.id, fighter: target.state.fighter, status: status.kind });
    this.showStatus(target);
  }
  private tickStatus(a: Actor) {
    const s = a.statuses!, now = this.serverTime, p = a.state;
    while (s.burn && now >= s.burn.next && s.burn.next <= s.burn.until + 1e-9) {
      const before = p.hp;
      p.hp = Math.max(1, p.hp - Math.round(s.burn.dps * BURN_TICK));
      this.tally(a, this.actors.get(s.burn.from), before - p.hp);
      s.burn.next += BURN_TICK;
    }
    if (s.burn && now >= s.burn.until) delete s.burn;
    if (s.slow && now >= s.slow.until) delete s.slow;
    if (s.freeze && now >= s.freeze.until) delete s.freeze;
    this.showStatus(a);
    if (!s.burn && !s.slow && !s.freeze && now >= (s.immuneUntil ?? 0)) delete a.statuses;
  }
  private showStatus(a: Actor) {
    const s = a.statuses, kinds = s ? (['burn', 'slow', 'freeze'] as const).filter(kind => s[kind]) : [];
    if (kinds.length) a.state.status = [...kinds]; else delete a.state.status;
  }
  private slowOf(a: Actor) { const slow = a.statuses?.slow; return slow && this.serverTime < slow.until ? slow.factor : 1; }

  private down(t: Actor) { return t.reaction === 'knockdown' || t.reaction === 'splat' && t.state.grounded; }

  private fighterBlow(attacker: Actor | undefined, target: Actor, minor = false, crowd = false) {
    return !!attacker && attacker !== target && !attacker.kit && !target.kit && !minor && !crowd;
  }

  private floorDodges(t: Actor, slot: AttackSlot, fighters: boolean) {
    if (t.reaction === 'getup') return !fighters || slot !== 'ultimate';
    return !fighters && t.reaction === 'knockdown';
  }

  private hitExternal(actorId: string, body: ExternalBody, slot: AttackSlot, move: MoveDefinition, origin: Vec3, finisher: boolean, contactIndex?: number, castId?: number, stage = 0, area?: AreaBlow) {
    const attacker = this.actors.get(actorId);
    const own = attacker?.cast && castId !== undefined && attacker.cast.id === castId ? attacker.cast : undefined;
    let damage = (finisher ? move.finisherDamage ?? move.damage : move.damage) * (area?.scale ?? 1) * (attacker?.state.awakened ? AWAKENED_DAMAGE : 1);
    let critical = false;
    if (attacker?.mods) {
      damage *= attacker.mods.damageOut;
      if (attacker.mods.crit && this.random() < attacker.mods.crit) { critical = true; damage *= attacker.mods.critDamage; }
    }
    const knockback = finisher ? move.finisherKnockback ?? move.knockback : move.knockback;
    const stun = finisher ? move.finisherStun ?? move.stun : move.stun;
    let pushX = body.x - origin.x, pushZ = body.z - origin.z;
    const n = Math.hypot(pushX, pushZ);
    if (n < 1e-3) { pushX = Math.sin(attacker?.state.yaw ?? 0); pushZ = Math.cos(attacker?.state.yaw ?? 0); } else { pushX /= n; pushZ /= n; }
    const gap = contactIndex !== undefined && contactIndex + 1 < move.contacts.length ? move.contacts[contactIndex + 1] - move.contacts[contactIndex] : Infinity;
    const hitstop = finisher ? move.hitstop ?? HITSTOP[slot] : Math.min(HITSTOP[slot] * .6, gap * .3);
    const result = this.external!.receive(body, { attackerId: actorId, slot, move, damage: Math.max(1, Math.round(damage)), critical, finisher,
      pushX, pushZ, knockback, stun, launch: body.airborne || (finisher && knockback >= LAUNCH_KNOCKBACK), hitstop });
    if (!result) return false;
    if (own) own.connected = true;
    const source = attacker?.state;
    if (attacker && source) {
      source.damageDealt = (source.damageDealt ?? 0) + result.damage;
      if (slot !== 'ultimate') source.ultimate = Math.min(100, source.ultimate + result.damage * ULTIMATE_PER_DAMAGE * EXTERNAL_METER * (move.detached ? DETACHED_METER : 1) * (attacker.mods ? attacker.mods.meterGain : 1));
      if (source.alive && attacker.mods?.lifesteal) source.hp = Math.min(source.maxHp, source.hp + result.damage * attacker.mods.lifesteal);
      if (!move.detached && attacker.externalFreezeTick !== this.tick) { attacker.externalFreezeTick = this.tick; this.freeze(attacker, hitstop * .6); }
      source.combo = this.serverTime < attacker.comboUntil ? (source.combo ?? 0) + 1 : 1;
      attacker.comboUntil = this.serverTime + COMBO_WINDOW;
    }
    this.emit({ kind: 'hit', actorId, targetId: body.id, fighter: source?.fighter, slot, actionSeq: own ? attacker!.state.actionSeq : undefined,
      chain: slot === 'light' ? stage : undefined, move: move.name, damage: result.damage, origin: position(origin),
      endpoint: { x: body.x, y: body.y + body.height * .55, z: body.z }, contactIndex, combo: source?.combo, reaction: result.reaction,
      ...(critical ? { critical } : {}), ...(area?.bullseye ? { bullseye: true } : {}) });
    return true;
  }

  private spendPoise(target: Actor, damage: number, slot: AttackSlot): 'poised' | 'broken' | 'open' {
    const left = target.poise ?? 0;
    if (left <= 0) return 'open';
    target.poise = Math.max(0, left - damage * POISE_SLOT[slot]);
    target.state.poise = target.poise / (target.poiseMax || 1);
    return target.poise > 0 ? 'poised' : 'broken';
  }
  private regainPoise(a: Actor, dt: number) {
    const max = a.poiseMax ?? 0, left = a.poise ?? 0;
    if (left >= max) return;
    if (left <= 0) { if (this.serverTime >= (a.poiseBrokenUntil ?? 0)) a.poise = max; }
    else if (this.serverTime - a.lastDamageAt > POISE_REGEN_DELAY) a.poise = Math.min(max, left + max * POISE_REGEN * dt);
    a.state.poise = (a.poise ?? 0) / (max || 1);
  }

  private outcomeOf(t: Actor, move: MoveDefinition, eligible: boolean): Outcome | 'spent' | undefined {
    const outcome = move.outcome;
    if (!outcome || !eligible) return undefined;
    if (LAUNCHING.has(outcome) && (t.anchored || !t.state.grounded && t.juggleHits >= MAX_JUGGLE)) return undefined;
    if ((outcome === 'stagger' || outcome === 'spin') && this.serverTime - (t.staggeredAt ?? -Infinity) < STAGGER_GUARD) return 'spent';
    if (outcome === 'dizzy' && this.serverTime - (t.dizzyAt ?? -Infinity) < DIZZY_GUARD) return 'spent';
    return outcome;
  }

  private shapeBlow(t: Actor, shaped: Outcome | 'spent' | undefined, move: MoveDefinition, toX: number, toZ: number, juggling: boolean, launched: boolean, attacker?: Actor, stringStage = false) {
    const p = t.state;
    t.spinLeft = 0;
    t.popLand = stringStage && shaped === 'hop' && launched && !juggling && !t.kit;
    t.knockKind = shaped === 'knockdown' && (move.knock === 'spike' || move.knock === 'slide') ? move.knock : '';
    if (shaped === 'spent') { t.stunUntil = Math.min(t.stunUntil, this.serverTime + STAGGER_SPENT); return; }
    if (juggling) {
      if (shaped === 'groundBounce' && move.fling) { t.vy = Math.min(t.vy, -AIR_FLING.down); t.kx = -toX * AIR_FLING.away; t.kz = -toZ * AIR_FLING.away; t.knockbackDrag = AIR_FLING.drag; t.bounceOnLand = true; }
      else if (shaped === 'groundBounce') { t.vy = Math.min(t.vy, -AIR_SPIKE_DRIVE); t.bounceOnLand = true; }
      else if (shaped === 'knockdown') {
        const along = move.knock === 'slide' || move.knock === 'splat';
        t.vy = Math.min(t.vy, along ? -5 : -9); t.bounceOnLand = move.knock === 'spike'; t.downFor = move.down ?? OUTCOME_DOWN.knockdown; t.juggleHits = MAX_JUGGLE;
        if (along) t.knockbackDrag = KNOCK_DRAG[move.knock as 'slide' | 'splat'];
      }
      else if (shaped === 'dizzy') { t.vy = Math.min(t.vy, -7); t.bounceOnLand = false; t.dizzyOnLand = true; t.dizzyAt = this.serverTime; t.juggleHits = MAX_JUGGLE; t.dazeFor = move.daze ?? 0; }
      else if (shaped === 'wallBounce') { t.wallBounce = true; t.wallBounceBy = attacker?.state.id; t.knockbackDrag = 4; }
      else if (!shaped) t.wallBounce = false;
      return;
    }
    t.downFor = undefined; t.wallBounce = false; t.wallBounceBy = undefined;
    if (!shaped) return;
    if (shaped === 'stagger') { t.staggeredAt = this.serverTime; t.knockbackDrag = 9; return; }
    if (shaped === 'dizzy') { t.dizzyAt = this.serverTime; t.knockbackDrag = 12; return; }
    if (shaped === 'spin') {
      t.staggeredAt = this.serverTime;
      const side = Math.sin(p.yaw) * toZ - Math.cos(p.yaw) * toX >= 0 ? 1 : -1, turn = SPIN_ANGLE * side;
      const c = Math.cos(turn), s = Math.sin(turn);
      const kx = t.kx * c + t.kz * s, kz = -t.kx * s + t.kz * c;
      t.kx = kx; t.kz = kz; t.knockbackDrag = 6;
      t.spinLeft = TAU; t.spinRate = side * TAU / SPIN_SECONDS;
      return;
    }
    if (!launched) return;
    t.downFor = move.down ?? OUTCOME_DOWN[shaped];
    if (shaped === 'groundBounce') {
      t.vy = move.lift ?? OUTCOME_LIFT.groundBounce; t.kx *= .5; t.kz *= .5; t.bounceOnLand = false; t.launchLead = 0;
      this.emit({ kind: 'ground-bounce', actorId: p.id, fighter: p.fighter, origin: position(p) });
      return;
    }
    t.vy = move.lift ?? OUTCOME_LIFT[shaped];
    if (shaped === 'launch' && t.vy > 0) { t.launchSpan = t.vy / (23 * LAUNCH_GRAVITY); t.launchLead = LAUNCH_LEAD * t.vy * t.launchSpan; t.launchRun = 0; }
    else t.launchLead = 0;
    if (shaped === 'knockdown') {
      t.juggleHits = MAX_JUGGLE;
      if (move.knock === 'spike') {
        t.vy = 0; p.grounded = false; t.bounceOnLand = false; t.kx *= .45; t.kz *= .45; t.launchLead = 0;
        this.emit({ kind: 'ground-bounce', actorId: p.id, fighter: p.fighter, origin: position(p) });
      }
      else if (move.knock === 'slide') { t.vy = move.lift ?? 1.4; t.knockbackDrag = KNOCK_DRAG.slide; }
      else if (move.knock === 'splat') t.knockbackDrag = KNOCK_DRAG.splat;
    }
    if (shaped === 'wallBounce') { t.wallBounce = true; t.wallBounceBy = attacker?.state.id; t.knockbackDrag = 4; }
  }

  private wallBounceTick(a: Actor, delta: Vec3, wantedX: number, wantedZ: number, corrected: CollisionMovement) {
    const p = a.state;
    if (!a.wallBounce || a.reaction !== 'launched' || this.serverTime - a.lastDamageAt >= .8) return;
    const fromX = wantedX - corrected.x, fromZ = wantedZ - corrected.z;
    const asked = Math.hypot(delta.x, delta.z), given = Math.hypot(p.x - fromX, p.z - fromZ);
    if (asked <= .02 || given >= asked * .55) return;
    a.wallBounce = false;
    const rx = delta.x - (p.x - fromX), rz = delta.z - (p.z - fromZ), r = Math.hypot(rx, rz);
    if (r > 1e-4) {
      const nx = rx / r, nz = rz / r, into = a.kx * nx + a.kz * nz;
      a.kx = (a.kx - 2 * into * nx) * WALL_BOUNCE_BACK; a.kz = (a.kz - 2 * into * nz) * WALL_BOUNCE_BACK;
    } else { a.kx *= -WALL_BOUNCE_BACK; a.kz *= -WALL_BOUNCE_BACK; }
    a.knockbackDrag = 5;
    a.vy = Math.max(a.vy, WALL_BOUNCE_LIFT); p.grounded = false; a.launchLead = 0;
    a.downFor = OUTCOME_DOWN.wallBounce;
    a.stunUntil = Math.max(a.stunUntil, this.serverTime + .45);
    this.action(a, 'launched', Math.max(.05, a.stunUntil - this.serverTime), true);
    this.emit({ kind: 'wall-splat', actorId: p.id, fighter: p.fighter, origin: position(p), reaction: 'launched' });
    const by = a.wallBounceBy ? this.actors.get(a.wallBounceBy) : undefined;
    if (by?.state.alive && !by.kit && by !== a && p.hp > 0) {
      by.chaseTargetId = p.id; by.chaseUntil = this.serverTime + CHASE_WINDOW; by.lightChaseUntil = this.serverTime + LIGHT_CHASE_WINDOW;
    }
  }

  private spinTick(a: Actor, dt: number) {
    if (!a.reaction) { a.spinLeft = 0; return; }
    const turn = Math.min(a.spinLeft ?? 0, Math.abs(a.spinRate ?? 0) * dt);
    const yaw = a.state.yaw + Math.sign(a.spinRate ?? 0) * turn;
    a.state.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    a.spinLeft = Math.max(0, (a.spinLeft ?? 0) - turn);
  }

  private vanish(target: Actor, attacker: Actor): { from: Vec3; to: Vec3 } | null {
    if (!VANISH_ON_JUST_GUARD || this.serverTime - target.vanishedAt < VANISH_COOLDOWN) return null;
    const p = target.state, q = attacker.state;
    const swing = attacker.cast?.direction;
    let ux = swing && Math.hypot(swing.x, swing.z) > .5 ? -swing.x : q.x - p.x;
    let uz = swing && Math.hypot(swing.x, swing.z) > .5 ? -swing.z : q.z - p.z;
    const n = Math.hypot(ux, uz);
    if (n < 1e-4) { ux = -Math.sin(q.yaw); uz = -Math.cos(q.yaw); } else { ux /= n; uz /= n; }
    const { halfX, halfZ } = this.bounds;
    for (const [dx, dz] of [[ux, uz], [uz, -ux], [-uz, ux]]) {
      const wanted = { x: dx * VANISH_BEHIND, y: 0, z: dz * VANISH_BEHIND };
      const moved = this.collision?.move(p.id, q, wanted) ?? wanted;
      const to = { x: clamp(q.x + moved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS), y: q.y + (this.collision ? moved.y : 0),
        z: clamp(q.z + moved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS) };
      if (Math.hypot(to.x - q.x, to.z - q.z) < PUSH_RADIUS * 2) continue;
      const sight = this.collision?.raycast?.(centre(q), centre(to));
      if (sight && distance(sight, centre(to)) > .1) continue;
      const from = position(p);
      p.x = to.x; p.y = to.y; p.z = to.z; p.grounded = q.grounded;
      p.yaw = Math.atan2(q.x - to.x, q.z - to.z);
      target.vy = 0; target.mx = target.mz = target.kx = target.kz = 0; target.jumping = false;
      target.dashUntil = Math.min(target.dashUntil, this.serverTime);
      target.evadeUntil = Math.max(target.evadeUntil, this.serverTime + VANISH_EVADE);
      target.vanishedAt = this.serverTime; target.vanishOn = q.id;
      return { from, to: position(to) };
    }
    return null;
  }

  private tally(target: Actor, attacker: Actor | undefined, applied: number) {
    if (applied <= 0) return;
    target.state.damageTaken = (target.state.damageTaken ?? 0) + applied;
    if (attacker && attacker !== target) attacker.state.damageDealt = (attacker.state.damageDealt ?? 0) + applied;
  }

  private eliminate(a: Actor, actorId: string) {
    a.state.alive = false; a.state.hp = 0; a.state.guarding = false; a.cast = null;
    a.state.awakened = false; a.state.awakenedUntil = 0; a.awakenEntryUntil = 0;
    const killer = this.actors.get(actorId);
    if (killer && killer !== a) killer.state.kills = (killer.state.kills ?? 0) + 1;
    const heal = killer && killer !== a && killer.state.alive && this.koHeal > 0
      ? Math.min(killer.state.maxHp - killer.state.hp, killer.state.maxHp * this.koHeal) : 0;
    if (killer && heal > 0) killer.state.hp += heal;
    a.respawnAt = this.serverTime + DEFEAT_TIME;
    this.action(a, 'defeated', DEFEAT_TIME);
    this.emit({ kind: 'eliminated', actorId, targetId: a.state.id, ...(heal > 0 ? { heal } : {}) });
  }

  private respawn(a: Actor) {
    delete a.statuses; delete a.state.status;
    Object.assign(a.state, a.spawn, { hp: a.state.maxHp, stamina: a.state.maxStamina??100, ultimate: 0, awakening: 0, alive: true, grounded: true, guarding: false,
      cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
    a.vy = a.kx = a.kz = a.stunUntil = a.dashUntil = 0;
    a.jumping = false; a.dashSeconds = DASH_SECONDS; a.dashKind = 'forward';
    a.groundedAt = a.landedUntil = -Infinity; a.leapt = false;
    a.knockbackDrag = 7;a.freezeUntil=0;a.state.timeStopped=false;
    a.reaction = null; a.hitstopFrom = a.hitstopUntil = a.comboUntil = 0;
    a.state.combo = 0; a.state.hitstop = false;
    a.launchSlot = undefined;
    a.evadeUntil = this.serverTime + 1.25;
    a.input.moveX = a.input.moveZ = 0;
    a.cast = null; a.chainHits = a.scalingHits = 0; a.dashY = 0; a.dashEntry = 0; a.dashPlateau = 1; a.juggleHits = 0;
    a.jumpAt = a.dashAt = a.attackAt = a.awakenAt = a.guardAt = -Infinity;
    a.attackHold = a.attackNotified = -Infinity; a.pressQueue = undefined; a.reactionClip = .3; Object.assign(a, pressClock());
    a.wasGuarding = false; a.guardHeld = false; a.guardPressedAt = -Infinity;
    a.guardReleasedAt = a.parryLockUntil = a.counterUntil = a.parriedUntil = -Infinity; a.parryCaught = false;
    a.bounceOnLand = false; a.mx = a.mz = 0; a.blockedUntil = -Infinity;
    a.rushUntil = a.chaseUntil = a.lightChaseUntil = a.vanishedAt = -Infinity; a.rushOpened = []; a.chaseTargetId = a.vanishOn = undefined; a.dashChase = false;
    a.awakenEntryUntil = 0; a.state.awakened = false; a.state.awakenedUntil = 0;
    this.action(a, 'idle');
    this.emit({ kind: 'respawn', actorId: a.state.id, origin: position(a.state) });
  }

  trainingCommand(requesterId:string, command:unknown):boolean {
    if(this.roomMode!=='training'||!this.actors.has(requesterId))return false;
    if(command==='passive'||command==='combat'){
      this.trainingBotMode=command;this.trainingLab.behaviour=command;this.trainingLab.stop();
      for(const actor of this.actors.values())if(actor.state.isBot){actor.input={seq:actor.lastSeq+1,moveX:0,moveZ:0,yaw:actor.state.yaw};actor.cast=null;}
      return true;
    }
    if(command==='reset'){
      for(const actor of this.actors.values()){this.respawn(actor);Object.assign(actor.state,{kills:0,damageDealt:0,damageTaken:0});}
      this.projectiles=[];this.areas=[];this.trainingLab.resetPositions(this);return true;
    }
    if(command==='awakening'){Object.assign(this.actors.get(requesterId)!.state,{ultimate:100,awakening:100});return true;}
    return this.trainingLab.command(this,requesterId,command);
  }

  swapFighter(id: string, fighter: FighterId): boolean {
    const swapped = this.actors.get(id);
    if (this.roomMode !== 'training' || !swapped || swapped.external || !(fighter in MOVES)) return false;
    for (const actor of this.actors.values()) {
      const p = actor.state, spawn = actor.spawn, grounded = p.grounded;
      actor.spawn = position(p); this.respawn(actor); actor.spawn = spawn;
      Object.assign(p, { grounded, kills: 0, damageDealt: 0, damageTaken: 0 });
      actor.evadeUntil = 0;
    }
    this.projectiles = []; this.areas = [];
    const p = swapped.state;
    p.fighter = fighter;
    if (BODY_SIZE[fighter]) p.size = BODY_SIZE[fighter]; else delete p.size;
    delete swapped.forged; delete p.forge; delete p.outfit;
    for (const actor of this.actors.values()) this.faceOff(actor);
    return true;
  }

  private thinkBot(a: Actor) {
    if(this.roomMode==='training'){const input=this.trainingLab.dummy(this,a.state.id);if(input){this.submitInput(a.state.id,{...input,seq:a.lastSeq+1});return;}}
    if(this.roomMode==='training'&&this.trainingBotMode==='passive'){a.input.moveX=a.input.moveZ=0;a.input.attack=undefined;a.input.guard=false;return;}
    this.botDefend(a);
    if (this.serverTime < a.nextBotThink) return;
    a.nextBotThink = this.serverTime + .18 + a.botSkill * .16;
    const opponents = [...this.actors.values()].filter(b => b !== a && b.state.alive && this.hostile(a.state, b.state)
      && (this.roomMode === 'match' || !b.state.isBot));
    opponents.sort((x, y) => distance(a.state, x.state) - distance(a.state, y.state));
    if (!opponents.length) { a.input.moveX = a.input.moveZ = 0; return; }
    const nav = this.collision ? NavGrid.for(this.stage) : undefined;
    const mind = nav ? this.mindOf(a) : undefined;
    const other = nav && mind ? this.botTarget(a, mind, opponents, nav) : opponents[0];
    const dx = other.state.x - a.state.x, dz = other.state.z - a.state.z, d = Math.hypot(dx, dz) || 1;
    const head = nav && mind ? this.botHeading(a, mind, other, nav) : undefined;
    const floor = this.fighterBlow(a, other) ? this.botFloor(other) : undefined;

    const fromCentre = Math.hypot(a.state.x, a.state.z);

    const aggression = .6 + a.botSkill * .55;
    const p = a.state;
    const swing = this.botSwing(a);
    const ready = (slot: AttackSlot) => this.serverTime > (p.cooldowns[slot] ?? 0);
    let attack: AttackSlot | undefined, areaPick: { x: number; z: number; caught: number } | undefined;
    const low = BOT_WINDED[0] + BOT_WINDED[2] * a.botSkill;
    a.botWinded = p.stamina < low || !!a.botWinded && p.stamina < low + BOT_WINDED[1];
    const landed = a.cast?.slot === 'light' && a.cast.connected ? a.cast : undefined;
    const chase = !landed && this.serverTime <= a.chaseUntil && (p.stamina >= 20 || STAMINA_OVERDRAW) && this.random() < .3 + a.botSkill * .5;
    const soon = this.incomingMelee(a);
    if (!chase && !landed && !floor && d < 3.4 && a.botGuardUntil === undefined && this.serverTime >= a.counterUntil
        && (soon === undefined || soon > BOT_GUARD_LEAD + .02) && p.stamina >= BOT_GUARD_STAMINA
        && this.random() < BOT_TURTLE[0] + (BOT_TURTLE[1] - BOT_TURTLE[0]) * a.botSkill) {
      const free = a.cast ? Math.max(this.serverTime, a.cast.start + a.cast.move.duration) : this.serverTime;
      a.botGuardFrom = free; a.botGuardUntil = free + .35 + this.random() * .45; a.botTimed = false;
    }
    const wait = !chase && !landed && a.botGuardUntil !== undefined && this.serverTime < a.botGuardUntil;
    if (wait) a.attackHold = a.attackAt = -Infinity;
    const punish = !wait && this.serverTime < a.counterUntil;
    const reeling = this.botFollowUp(a, other);
    const apart = !!head && !head.reachable;
    const sighted = !apart || this.botSight(a, other);
    if (floor && !wait && p.ultimate >= ULTIMATE_COST && ready('ultimate') && d < this.botUltimateReach(a)
        && this.random() < .55 + a.botSkill * .4) attack = 'ultimate';
    else if (chase) attack = 'light';
    else if (wait) attack = undefined;
    else if (punish) attack = ready('heavy') && this.random() < .45 + a.botSkill * .4 ? 'heavy' : 'light';
    else if (reeling) attack = reeling;
    else if (floor === 'rising') attack = undefined;
    else if (floor === 'down') attack = d < swing && !a.botWinded && !this.floorSpent(other) && this.random() < .4 + a.botSkill * .3 ? 'light' : undefined;
    else if ((areaPick = this.botArea(a, opponents)) && (areaPick.caught >= 2 || d > 4.5)
      && this.random() < (areaPick.caught >= 2 ? .55 : .2 + a.botSkill * .15) * aggression) attack = 'area';
    else if (apart) attack = sighted && d < 20 && ready('special') && this.random() < .3 * aggression ? 'special'
      : sighted && this.moveOf(a, 'heavy').style !== 'melee' && d < this.moveOf(a, 'heavy').range && this.random() < .25 ? 'heavy' : undefined;
    else if (p.ultimate >= ULTIMATE_COST && d < 6 && ready('ultimate') && this.random() < .35 * aggression) attack = 'ultimate';
    else if (landed) attack = hasCombos(p.fighter) ? this.botEnder(a, landed) ?? 'light'
      : landed.stage >= 1 && this.random() < .1 + a.botSkill * .3
      ? ready('special') && this.random() < .4 ? 'special' : 'heavy' : 'light';
    else if (d < swing && !a.botWinded) attack = this.random() < .24 ? 'heavy' : 'light';
    else if (d < 23 && sighted && ready('special') && !a.botWinded && this.random() < .12 * aggression) attack = 'special';
    const awaken = !p.awakened && (p.awakening ?? 0) >= AWAKENING_COST && this.random() < .25 * aggression;
    if (attack) { a.botGuardFrom = a.botGuardUntil = undefined; a.botTimed = false; }
    const guard = this.botGuarding(a);
    const strafe = d < 4.5 && !apart ? Math.sin(this.serverTime * .7 + a.botSkill * 6) * .35 : 0;
    const pace = d > 6 ? 1 : .5 + a.botSkill * .3;
    let hx = head ? head.x : dx / d, hz = head ? head.z : dz / d, closing = d > Math.min(2.6, swing - .3);
    if (apart && nav && mind) {
      const hold = sighted && d < 20;
      const middle = !hold && fromCentre > 6 ? this.botRoute(a, mind, 'ring', 0, 0, nav) : undefined;
      closing = !hold && (!!middle || fromCentre > 6 || d > 4);
      if (middle) { hx = middle.x; hz = middle.z; }
    }
    const stuck = mind && closing ? this.botStuck(a, mind) : false;
    let hop = false;
    this.submitInput(a.state.id, { seq: a.lastSeq + 1,
      moveX: (closing ? hx * pace : 0) + dz / d * strafe,
      moveZ: (closing ? hz * pace : 0) - dx / d * strafe,
      yaw: Math.atan2(dx, dz), targetId: other.state.id, attack, guard: guard && !attack, awaken,
      ...(attack === 'area' && areaPick ? { aim: { x: areaPick.x, z: areaPick.z } } : {}),
      dash: chase ? this.serverTime > a.lightChaseUntil : (!head || head.straight) && (d > 9 && this.random() < .18 * aggression
        || d > swing && d < swing + 3 && swing < 2.6 && !other.cast && this.random() < .3 * aggression),
      jump: !chase && (stuck || (hop = d < 6 && this.random() < .05)) });
    if (hop) a.input.moveX = a.input.moveZ = 0;
  }

  private botArea(a: Actor, opponents: Actor[]): { x: number; z: number; caught: number } | undefined {
    const p = a.state;
    if (a.kit || a.botWinded || this.serverTime <= (p.cooldowns.area ?? 0)) return undefined;
    const m = this.moveOf(a, 'area');
    if (!m.area || p.stamina < m.stamina) return undefined;
    const lead = (m.contacts[0] ?? 0) + m.area.telegraph, { halfX, halfZ } = this.bounds;
    const ahead: { x: number; z: number }[] = [];
    for (const o of opponents) {
      if (Math.hypot(o.state.x - p.x, o.state.z - p.z) > m.range + m.radius) continue;
      ahead.push({ x: clamp(o.state.x + (o.mx + o.kx) * lead, -halfX, halfX), z: clamp(o.state.z + (o.mz + o.kz) * lead, -halfZ, halfZ) });
    }
    if (!ahead.length) return undefined;
    const spots = [...ahead];
    for (let i = 0; i < ahead.length; i++) for (let j = i + 1; j < ahead.length; j++) spots.push({ x: (ahead[i].x + ahead[j].x) / 2, z: (ahead[i].z + ahead[j].z) / 2 });
    let best: { x: number; z: number; caught: number } | undefined;
    for (const spot of spots) {
      if (Math.hypot(spot.x - p.x, spot.z - p.z) > m.range) continue;
      let caught = 0;
      for (const each of ahead) if (Math.hypot(each.x - spot.x, each.z - spot.z) <= m.radius * .85) caught++;
      if (!best || caught > best.caught) best = { x: +spot.x.toFixed(2), z: +spot.z.toFixed(2), caught };
    }
    return best;
  }

  private botSwing(a: Actor): number {
    const light = this.moveOf(a, 'light');
    return Math.min(2.9, this.reachOf(a, 'light', light) + Math.min(1.2, MAX_APPROACH * light.contacts[0] * .5));
  }

  private botFloor(o: Actor): 'down' | 'rising' | undefined {
    return this.down(o) ? 'down' : o.reaction === 'getup' ? 'rising' : undefined;
  }

  private floorSpent(o: Actor) { return groundHitDamage(1, o.floorHits, o.floorTaken, o.state.maxHp) === 0; }

  private botUltimateReach(a: Actor): number {
    const move = this.moveOf(a, 'ultimate');
    if (move.timeStop) return move.timeStop.radius - .3;
    return Math.min(6, this.intentReach(a, 'ultimate', move));
  }

  private mindOf(a: Actor): BotMind {
    let mind = this.minds.get(a.state.id);
    if (!mind) {
      mind = { routes: new Map(), best: Infinity, bestAt: this.serverTime,
        stillX: a.state.x, stillZ: a.state.z, stillSince: this.serverTime, given: new Map() };
      this.minds.set(a.state.id, mind);
    }
    return mind;
  }

  private botTarget(a: Actor, mind: BotMind, opponents: Actor[], nav: NavGrid): Actor {
    const now = this.serverTime, p = a.state;
    const open = (o: Actor) => (mind.given.get(o.state.id) ?? -Infinity) <= now;
    const nearest = distance(p, opponents[0].state);
    let chosen = mind.targetId ? opponents.find(o => o.state.id === mind.targetId && open(o)) : undefined;
    if (chosen && distance(p, chosen.state) > nearest * 1.4 + 2) chosen = undefined;
    chosen = this.botHunt(a, mind, opponents, nav) ?? chosen;
    if (chosen) {
      const d = distance(p, chosen.state);
      if (d < 4 || d < mind.best - .5) { mind.best = d; mind.bestAt = now; }
      else if (now - mind.bestAt > BOT_GIVE_UP_AFTER) { mind.given.set(chosen.state.id, now + BOT_GIVE_UP_FOR); chosen = undefined; }
    }
    if (!chosen) {
      let best = Infinity;
      for (let k = 0; k < opponents.length && k < 4; k++) {
        const o = opponents[k], d = distance(p, o.state);
        if (d >= best) break;
        if (!open(o)) continue;
        if (!this.botReachable(a, mind, o, nav)) { mind.given.set(o.state.id, now + BOT_GIVE_UP_FOR); continue; }
        const score = d + this.botCrowd(a, o, d);
        if (score < best) { best = score; chosen = o; }
      }
    }
    chosen ??= opponents[0];
    if (chosen.state.id !== mind.targetId) { mind.targetId = chosen.state.id; mind.best = distance(p, chosen.state); mind.bestAt = now; }
    return chosen;
  }

  private botHunt(a: Actor, mind: BotMind, opponents: Actor[], nav: NavGrid): Actor | undefined {
    if (this.roomMode !== 'match') return undefined;
    const now = this.serverTime, p = a.state;
    for (const [id, hunt] of this.hunts) {
      const quarry = this.actors.get(id), hunter = this.actors.get(hunt.by);
      if (!quarry?.state.alive || !hunter?.state.alive || this.engagedAt(quarry) >= hunt.since
        || !hunt.anyway && this.botBusy(hunter, id) || (this.minds.get(hunt.by)?.given.get(id) ?? -Infinity) > now) this.hunts.delete(id);
      else if (hunt.by === p.id) return quarry;
    }
    const busy = this.botBusy(a);
    for (const o of opponents) {
      const id = o.state.id, quiet = now - this.engagedAt(o);
      if (this.hunts.has(id) || (mind.given.get(id) ?? -Infinity) > now || quiet < HUNT_QUIET) continue;
      const anyway = quiet >= HUNT_ANYWAY;
      if (busy && !anyway || this.freeHunter(o, anyway) !== a || !this.botReachable(a, mind, o, nav)) continue;
      this.hunts.set(id, { by: p.id, since: now, anyway });
      mind.targetId = id; mind.best = distance(p, o.state); mind.bestAt = now;
      return o;
    }
    return undefined;
  }

  private botCrowd(a: Actor, o: Actor, d: number): number {
    if (d <= BOT_TAKE_ON) return 0;
    let on = 0;
    for (const b of this.actors.values()) {
      if (b === a || b === o || !b.state.isBot || !b.state.alive) continue;
      if (this.minds.get(b.state.id)?.targetId === o.state.id) on++;
    }
    return on * BOT_SPREAD;
  }

  private engagedAt(o: Actor): number {
    const p = o.state, total = p.damageDealt ?? 0;
    let mark = this.dealt.get(p.id);
    if (!mark) this.dealt.set(p.id, mark = { total, at: -Infinity });
    else if (mark.total !== total) { mark.total = total; mark.at = this.serverTime; }
    return Math.max(this.startedAt, o.lastDamageAt, o.blockedUntil, mark.at);
  }

  private botBusy(b: Actor, quarry?: string): boolean {
    if (this.serverTime - this.engagedAt(b) < BOT_BUSY) return true;
    const target = this.minds.get(b.state.id)?.targetId;
    const q = target && target !== quarry ? this.actors.get(target)?.state : undefined;
    return !!q?.alive && distance(b.state, q) < BOT_BUSY_NEAR;
  }

  private freeHunter(o: Actor, anyway = false): Actor | undefined {
    let best: Actor | undefined, gap = Infinity;
    for (const b of this.actors.values()) {
      if (b === o || !b.state.isBot || b.external || !b.state.alive || !this.hostile(b.state, o.state)) continue;
      let hunting = false;
      for (const hunt of this.hunts.values()) if (hunt.by === b.state.id) { hunting = true; break; }
      if (hunting || !anyway && this.botBusy(b)) continue;
      const d = distance(b.state, o.state);
      if (d < gap) { gap = d; best = b; }
    }
    return best;
  }

  private botReachable(a: Actor, mind: BotMind, o: Actor, nav: NavGrid): boolean {
    const p = a.state, q = o.state;
    if (Math.abs(q.y - p.y) < 1.3 && nav.clear(p.x, p.z, q.x, q.z)) return true;
    return !!this.botRoute(a, mind, q.id, q.x, q.z, nav, true);
  }

  private botHeading(a: Actor, mind: BotMind, o: Actor, nav: NavGrid): { x: number; z: number; reachable: boolean; straight: boolean } {
    const p = a.state, q = o.state, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (Math.abs(q.y - p.y) < 1.3 && nav.clear(p.x, p.z, q.x, q.z)) return { x: dx / d, z: dz / d, reachable: true, straight: true };
    const way = this.botRoute(a, mind, q.id, q.x, q.z, nav);
    if (!way || !nav.walkable(q.x, q.z) && Math.hypot(dx, dz) < 3.5) return { x: dx / d, z: dz / d, reachable: false, straight: false };
    return { x: way.x, z: way.z, reachable: true, straight: false };
  }

  private botRoute(a: Actor, mind: BotMind, key: string, x: number, z: number, nav: NavGrid, probe = false): { x: number; z: number } | undefined {
    const p = a.state, now = this.serverTime;
    let plan = mind.routes.get(key);
    if (!plan || now - plan.at > BOT_REPLAN || Math.hypot(x - plan.x, z - plan.z) > 2.5) {
      if (!plan && mind.routes.size > 6) for (const [k, v] of mind.routes) if (now - v.at > BOT_REPLAN * 3) mind.routes.delete(k);
      plan = { cells: nav.path(p.x, p.z, x, z), x, z, at: now };
      mind.routes.set(key, plan);
    }
    if (!plan.cells) return undefined;
    if (probe) return { x: 0, z: 0 };
    const to = nav.steer(plan.cells, p.x, p.z);
    const hx = to.x - p.x, hz = to.z - p.z, n = Math.hypot(hx, hz);
    if (n < 1e-3) { const hx2 = x - p.x, hz2 = z - p.z, n2 = Math.hypot(hx2, hz2) || 1; return { x: hx2 / n2, z: hz2 / n2 }; }
    return { x: hx / n, z: hz / n };
  }

  private botStuck(a: Actor, mind: BotMind): boolean {
    const p = a.state, now = this.serverTime;
    if (Math.hypot(p.x - mind.stillX, p.z - mind.stillZ) > .35 || a.cast || a.reaction || !p.grounded) {
      mind.stillX = p.x; mind.stillZ = p.z; mind.stillSince = now;
      return false;
    }
    if (now - mind.stillSince < .9) return false;
    mind.stillSince = now; mind.routes.clear();
    return true;
  }

  private botSight(a: Actor, o: Actor): boolean {
    if (!this.collision?.raycast) return true;
    const from = centreOf(a.state), to = centreOf(o.state), hit = this.collision.raycast(from, to);
    return Math.hypot(hit.x - to.x, hit.y - to.y, hit.z - to.z) < .1;
  }

  private botEnder(a: Actor, landed: Cast): AttackSlot | undefined {
    const p = a.state, chance = ([.06, .16, .3][landed.stage] ?? 0) + a.botSkill * .2;
    if (this.random() >= chance) return undefined;
    if (!p.grounded) return 'heavy';
    return landed.stage === 2 && p.cooldowns.special <= this.serverTime && this.random() < .45 ? 'special' : 'heavy';
  }

  private botFollowUp(a: Actor, other: Actor): AttackSlot | undefined {
    const cast = a.cast, q = other;
    if (!cast?.connected || a.kit) return undefined;
    const reeling = q.reaction === 'hurt' && this.serverTime - (q.staggeredAt ?? -Infinity) < .6 && q.stunUntil - this.serverTime > .25;
    if (!reeling) return undefined;
    if (cast.slot === 'light' && cast.stage >= RUSH_STAGES - 1) return this.serverTime > a.state.cooldowns.special && this.random() < .3 ? 'special' : 'heavy';
    if (cast.slot === 'heavy') return 'light';
    return undefined;
  }

  private chaseOverdraws(a: Actor, lightChase: Actor | undefined) {
    if (!STAMINA_OVERDRAW) return false;
    const chased = lightChase ?? (this.serverTime <= a.chaseUntil && a.chaseTargetId ? this.actors.get(a.chaseTargetId) : undefined);
    return !!chased?.state.alive && distance(a.state, chased.state) <= CHASE_RANGE;
  }

  private botDefend(a: Actor) {
    const p = a.state, now = this.serverTime;
    if (a.botGuardUntil !== undefined && now >= a.botGuardUntil) { a.botGuardFrom = a.botGuardUntil = undefined; a.botTimed = false; }
    let want = this.botGuarding(a);
    if (want && !a.input.guard && !a.botTimed) { const soon = this.incomingMelee(a); if (soon !== undefined && soon <= BOT_GUARD_LEAD) want = false; }
    if (want !== !!a.input.guard || want && now - a.lastInputAt > .2)
      this.submitInput(p.id, { seq: a.lastSeq + 1, moveX: want ? 0 : a.input.moveX, moveZ: want ? 0 : a.input.moveZ, yaw: a.input.yaw,
        targetId: a.input.targetId, guard: want });
    if (a.botTimed || a.cast || a.reaction || now < a.stunUntil || now < a.dashUntil) return;
    for (const other of this.actors.values()) {
      const melee = this.meleeDue(a, other);
      const shot = melee === undefined ? this.shotDue(a, other) : undefined;
      const due = melee ?? shot?.due;
      if (due === undefined || due > BOT_READ) continue;
      const cast = other.cast, move = melee !== undefined ? cast!.move : shot!.shot.move;
      const read = melee !== undefined ? `${other.state.id}:${cast!.id}:${cast!.nextContact}` : `${other.state.id}:shot:${shot!.shot.castId}`;
      if (a.botRead === read) continue;
      a.botRead = read;
      const thrown = melee !== undefined ? cast!.start : cast && cast.id === shot!.shot.castId ? cast.start : shot!.shot.startAt;
      this.botAnswer(a, due, move, melee !== undefined ? cast!.slot : shot!.shot.slot, thrown, read);
      return;
    }
  }

  private botAnswer(a: Actor, due: number, move: MoveDefinition, slot: AttackSlot, thrown = this.serverTime, read = '') {
    if (slot === 'ultimate') return false;
    const now = this.serverTime, skill = a.botSkill, roll = this.random();
    const holding = this.botGuarding(a);
    if (a.state.stamina < BOT_GUARD_STAMINA * .4) return false;
    const parry = BOT_PARRY[0] + (BOT_PARRY[1] - BOT_PARRY[0]) * skill;
    const block = BOT_BLOCK[0] + (BOT_BLOCK[1] - BOT_BLOCK[0]) * skill;
    if (roll < parry) {
      const spread = BOT_TIMING[0] + (BOT_TIMING[1] - BOT_TIMING[0]) * skill;
      const aim = now + due - (BOT_PARRY_LEAD + this.gauss() * spread);
      const reacts = thrown + BOT_REACTION[0] + (BOT_REACTION[1] - BOT_REACTION[0]) * skill
        + BOT_REACTION_SPREAD * unitSpread(`${a.state.id}:${read}`);
      const press = Math.max(now, aim, reacts);
      if (press < now + due && (!holding || press - now >= PARRY_REARM)) {
        a.botGuardFrom = press; a.botGuardUntil = now + due + .3; a.botTimed = true;
        return true;
      }
    }
    if (holding) { a.botGuardUntil = Math.max(a.botGuardUntil!, now + due + .3); return true; }
    if (!move.guardBreak && roll < parry + block && due > BOT_GUARD_LEAD && a.state.stamina >= BOT_GUARD_STAMINA) {
      a.botGuardFrom = now; a.botGuardUntil = now + due + .3;
      return true;
    }
    return false;
  }

  private botGuarding(a: Actor) {
    return a.botGuardUntil !== undefined && this.serverTime >= a.botGuardFrom! && this.serverTime < a.botGuardUntil;
  }

  private gauss() { return (this.random() + this.random() + this.random() + this.random() - 2) * 1.732; }

  private shotDue(a: Actor, other: Actor): { due: number; shot: Projectile } | undefined {
    if (other === a || !this.hostile(other.state, a.state)) return undefined;
    const c = centreOf(a.state);
    for (const shot of this.projectiles) {
      if (shot.actorId !== other.state.id || shot.move.style !== 'projectile') continue;
      const dx = shot.end.x - shot.start.x, dy = shot.end.y - shot.start.y, dz = shot.end.z - shot.start.z;
      const span2 = dx * dx + dy * dy + dz * dz;
      if (span2 < 1e-6) continue;
      const t = clamp(((c.x - shot.start.x) * dx + (c.y - shot.start.y) * dy + (c.z - shot.start.z) * dz) / span2, 0, 1);
      const gap = Math.hypot(shot.start.x + dx * t - c.x, shot.start.y + dy * t - c.y, shot.start.z + dz * t - c.z);
      if (gap > shot.move.radius + radiusOf(a.state)) continue;
      const due = shot.startAt + t * shot.duration - this.serverTime;
      if (due > 0) return { due, shot };
    }
    return undefined;
  }

  private meleeDue(a: Actor, other: Actor): number | undefined {
    const cast = other.cast;
    if (other === a || !cast || cast.move.style !== 'melee' || !other.state.alive || cast.nextContact >= cast.move.contacts.length
      || !this.hostile(other.state, a.state)) return undefined;
    const due = cast.start + cast.move.contacts[cast.nextContact] - this.serverTime;
    if (due < 0 || distance(a.state, other.state) > this.reachOf(other, cast.slot, cast.move, !cast.airborne) + .6) return undefined;
    return due;
  }

  private incomingMelee(a: Actor): number | undefined {
    let soonest: number | undefined;
    for (const other of this.actors.values()) {
      const due = this.meleeDue(a, other);
      if (due !== undefined && due < .4 && (soonest === undefined || due < soonest)) soonest = due;
    }
    return soonest;
  }

  private separateBodies(dt: number) {
    const living = [...this.actors.values()].filter(a => a.state.alive);
    const { halfX, halfZ } = this.bounds;
    const shove = (actor: Actor, ux: number, uz: number, amount: number) => {
      const p = actor.state;
      if (amount <= 1e-6 || p.timeStopped) return 0;
      const delta = { x: ux * amount, y: 0, z: uz * amount };
      const resolved = this.collision?.move(p.id, p, delta) ?? delta;
      const x = clamp(p.x + resolved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS);
      const z = clamp(p.z + resolved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS);
      const went = (x - p.x) * ux + (z - p.z) * uz;
      p.x = x; p.z = z;
      return Math.max(0, went);
    };
    const footing = (actor: Actor) => actor.state.action === 'awaken' ? 0
      : actor.cast ? .3 : this.serverTime < actor.stunUntil ? 1.4 : 1;
    for (let i = 0; i < living.length; i++) for (let j = i + 1; j < living.length; j++) {
      const actorA = living[i], actorB = living[j];
      const a = actorA.state, b = actorB.state;
      const gap = Math.abs(a.y - b.y);
      if (gap > 1.5) continue;
      if (this.passing(actorA) || this.passing(actorB)) continue;
      const airborne = gap > .9 || !a.grounded || !b.grounded;
      let dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      const ux = d > 0.001 ? dx / d : 1, uz = d > 0.001 ? dz / d : 0;
      const holdA = this.spacing(actorA), holdB = this.spacing(actorB), hold = Math.max(holdA, holdB);
      if (hold > pushOf(a) + pushOf(b) && d < hold) {
        const [pusher, pushed, sign] = holdA >= holdB ? [actorA, actorB, 1] as const : [actorB, actorA, -1] as const;
        if (footing(pushed) > 0 && pusher.state.alive) shove(pushed, ux * sign, uz * sign, Math.min(hold - d, SPACING_PUSH * dt));
        dx = b.x - a.x; dz = b.z - a.z; d = Math.hypot(dx, dz);
      }
      const overlap = pushOf(a) + pushOf(b) - d;
      if (overlap <= .02) continue;
      let resolve = overlap * (airborne ? .48 : 1.2);
      const hardGap = a.size || b.size ? HARD_GAP * (pushOf(a) + pushOf(b)) / (PUSH_RADIUS * 2) : HARD_GAP;
      if (gap < .9 && d + resolve < hardGap) resolve = hardGap - d;
      const weightA = footing(actorA), weightB = footing(actorB), total = weightA + weightB;
      const shareA = a.timeStopped ? 0 : b.timeStopped ? 1 : total > 0 ? weightA / total : .5;
      const wantA = resolve * shareA, wantB = resolve - wantA;
      const wentA = shove(actorA, -ux, -uz, wantA);
      const wentB = shove(actorB, ux, uz, wantB + (wantA - wentA));
      const short = wantB + (wantA - wentA) - wentB;
      if (short > 1e-4) shove(actorA, -ux, -uz, short);
    }
  }

  private checkWinner() {
    if (this.roomMode !== 'match' || this.status !== 'active') return;
    const alive = [...this.actors.values()].filter(a => a.state.alive);
    if (alive.length <= 1) {
      this.status = 'finished'; this.winnerId = alive[0]?.state.id ?? null;
      this.projectiles.length = 0;
      for (const actor of this.actors.values()) actor.cast = null;
      const champion = alive[0];
      if (champion) this.action(champion, 'victory');
      this.emit({ kind: 'winner', actorId: this.winnerId ?? 'draw' });
    }
  }

  private timeStopTour(a: Actor, cast: Cast): boolean {
    const move = cast.move, stop = move.timeStop, p = a.state;
    const style = a.kit ? undefined : stop?.tour ?? TIME_STOP_TOURS[p.fighter];
    if (!stop || !style || !tourContacts(move)) return false;
    const age = this.serverTime - cast.start;
    if (!cast.tour) {
      if (cast.nextContact === stop.contact && age >= move.contacts[stop.contact]) cast.tour = { at: this.serverTime, from: position(p), visit: -1 };
      return false;
    }
    const tour = cast.tour;
    if (tour.done) return false;
    if (!tour.order) {
      if (this.follows) return this.awaitVerdict(cast);
      this.planTimeStopTour(a, cast, tour); this.stopTaken(a, cast, tour);
    }
    if (style.domain) this.domainHold(a, cast, tour);
    const order = tour.order!, visited = tour.visited ?? 0;
    if (!order.length) return false;
    if (cast.cine && !cast.cine.done) this.shieldTour(a, cast);
    const visits = visitCount(move, style, visited);
    let k = tour.visit;
    while (k + 1 < visits && age >= blinkWindow(move, k + 1, visits, style)[0]) k++;
    if (k > tour.visit) this.beginTourMove(a, tour, style, k);
    const [start, end] = tour.visit >= 0 ? blinkWindow(move, tour.visit, visits, style) : [0, 0];
    const from = tour.moveFrom ?? tour.from, to = tour.moveTo ?? tour.from;
    const u = tour.visit < 0 ? 0 : end > start ? clamp((age - start) / (end - start), 0, 1) : 1;
    const w = tour.teleport ? (u >= 1 ? 1 : 0) : u * u * (3 - 2 * u);
    p.x = from.x + (to.x - from.x) * w; p.y = from.y + (to.y - from.y) * w; p.z = from.z + (to.z - from.z) * w;
    a.mx = a.mz = a.kx = a.kz = a.vy = 0;
    const facing = tour.visit >= 0 ? this.tourBody(order[visitVictim(move, style, tour.visit, visited)]) : undefined;
    if (facing) {
      const dx = facing.x - p.x, dz = facing.z - p.z, n = Math.hypot(dx, dz);
      if (n > 1e-3) { p.yaw = Math.atan2(dx, dz); cast.direction = { x: dx / n, y: 0, z: dz / n }; }
    }
    const last = move.contacts.length - 1;
    while (cast.nextContact > stop.contact && cast.nextContact <= last && age >= move.contacts[cast.nextContact]) {
      const contact = cast.nextContact++;
      if (contact === last) {
        tour.done = true; this.finishTimeStopTour(a, cast, tour);
        if (cast.cine && !cast.cine.done) this.releaseHold(a, cast);
        return a.cast !== cast;
      }
      const index = visitVictim(move, style, visitOf(move, contact, visits), visited);
      const id: string | undefined = order[index], origin = centre(p);
      const victim = id === undefined ? undefined : this.actors.get(id), body = victim || id === undefined ? undefined : this.external?.locate(id);
      this.emit({ kind: 'release', actorId: p.id, fighter: p.fighter, slot: cast.slot, origin,
        endpoint: victim ? centreOf(victim.state) : body ? { x: body.x, y: body.y + body.height * .55, z: body.z } : position(origin), contactIndex: contact });
      if (victim ? !victim.state.alive : !body) continue;
      tour.struck![index] = position(p);
      const heldFrom = a.hitstopFrom, heldUntil = a.hitstopUntil;
      if (victim) this.holdHit(a, cast, victim, contact, false, origin);
      else this.hitExternal(p.id, body!, cast.slot, cast.cine ? scheduled(move, contact) : move, origin, false, contact, cast.id, cast.stage);
      a.hitstopFrom = heldFrom; a.hitstopUntil = heldUntil;
      if (a.cast !== cast) return true;
    }
    return false;
  }

  private tourBody(id: string): Vec3 | undefined {
    const victim = this.actors.get(id);
    if (victim) return victim.state.alive ? victim.state : undefined;
    const body = this.external?.locate(id);
    return body ? { x: body.x, y: body.y, z: body.z } : undefined;
  }

  private planTimeStopTour(a: Actor, cast: Cast, tour: TimeStopTour) {
    const stop = cast.move.timeStop!, p = a.state, origin = centre(tour.from), until = tour.at + stop.duration - .05;
    const caught: { id: string; x: number; z: number }[] = [];
    for (const other of this.actors.values()) {
      const q = other.state;
      if (!this.hostile(p, q) || !q.alive || other.freezeUntil < until || distance(origin, centreOf(q)) > stop.radius + .01) continue;
      caught.push({ id: q.id, x: q.x, z: q.z });
    }
    if (this.external) {
      const n = this.external.query(origin, origin, stop.radius + 1.2, this.nearby);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        if (this.external.hostile?.(p.id,body)===false || Math.hypot(body.x - origin.x, body.z - origin.z) > stop.radius || this.actors.has(body.id)) continue;
        caught.push({ id: body.id, x: body.x, z: body.z });
      }
    }
    const plan = planTour(tour.from, cast.direction, caught, p.target ?? a.chosenExternal, tourBlows(cast.move));
    tour.order = plan.order; tour.visited = plan.visited; tour.struck = plan.order.map(() => null);
  }

  private domainHold(a: Actor, cast: Cast, tour: TimeStopTour) {
    const stop = cast.move.timeStop!, until = tour.at + stop.duration, left = until - this.serverTime;
    if (left <= .05 || !tour.order) return;
    const p = a.state, origin = centre(tour.from), order = tour.order, cine = cast.cine && !cast.cine.done ? cast.cine : undefined;
    for (const other of this.actors.values()) {
      const q = other.state;
      if (other === a || !this.hostile(p, q) || !q.alive || this.serverTime < other.evadeUntil || other.freezeUntil >= until - .05
        || this.floorDodges(other, cast.slot, this.fighterBlow(a, other))
        || distance(origin, centreOf(q)) > stop.radius || order.includes(q.id)) continue;
      other.freezeUntil = until; q.timeStopped = true;
      order.push(q.id); tour.struck!.push(null);
      if (cine) { cine.ids.push(q.id); cine.evade.push(other.evadeUntil); q.heldBy = p.id; a.holding?.ids.push(q.id); }
    }
    this.external?.freeze(origin, stop.radius, left,p.id);
  }

  private beginTourMove(a: Actor, tour: TimeStopTour, style: TourStyle, k: number) {
    const move = a.cast!.move, p = a.state, visited = tour.visited ?? 0;
    tour.visit = k;
    const id = tour.order![visitVictim(move, style, k, visited)], victim = this.actors.get(id);
    const body = victim ? undefined : this.external?.locate(id);
    const spot = victim?.state.alive ? this.tourSpot(a, victim.state, centreOf(victim.state), Math.max(0, pushOf(victim.state) - PUSH_RADIUS), style, priorVisits(move, style, k, visited))
      : body ? this.tourSpot(a, body, { x: body.x, y: body.y + body.height * .55, z: body.z }, Math.max(0, body.radius - PLAYER_RADIUS), style, priorVisits(move, style, k, visited)) : null;
    tour.moveFrom = position(p);
    tour.moveTo = spot ?? position(p);
    tour.teleport = !style.glide || !spot || !this.tourPathClear(a, p, spot);
  }

  private tourSpot(a: Actor, q: Vec3, middle: Vec3, girth: number, style: TourStyle, prior: number): Vec3 | null {
    const p = a.state, { halfX, halfZ } = this.bounds, strike = style.strike + girth;
    const base = Math.atan2(p.x - q.x, p.z - q.z) + (prior > 0 ? REVISIT_TURN : 0);
    for (let i = 0; i < 12; i++) {
      const angle = base + Math.ceil(i / 2) * (i % 2 ? 1 : -1) * Math.PI / 6;
      const wanted = { x: Math.sin(angle) * strike, y: 0, z: Math.cos(angle) * strike };
      const moved = this.collision?.move(p.id, q, wanted) ?? wanted;
      const to = { x: clamp(q.x + moved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS), y: q.y + (this.collision ? moved.y : 0),
        z: clamp(q.z + moved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS) };
      if (Math.hypot(to.x - q.x, to.z - q.z) < strike - .2) continue;
      const sight = this.collision?.raycast?.(middle, centre(to));
      if (sight && distance(sight, centre(to)) > .1) continue;
      let clear = true;
      for (const other of this.actors.values()) {
        const o = other.state;
        if (other === a || !o.alive || Math.abs(o.y - to.y) >= 1.5) continue;
        if (Math.hypot(o.x - to.x, o.z - to.z) < pushOf(p) + pushOf(o) + .05) { clear = false; break; }
      }
      if (clear) return to;
    }
    return null;
  }

  private tourPathClear(a: Actor, from: Vec3, to: Vec3) {
    const sight = this.collision?.raycast?.(centre(from), centre(to));
    if (sight && distance(sight, centre(to)) > .1) return false;
    const flatFrom = { x: from.x, y: 0, z: from.z }, flatTo = { x: to.x, y: 0, z: to.z };
    for (const other of this.actors.values()) {
      const o = other.state;
      if (other === a || !o.alive || Math.abs(o.y - from.y) >= 1.5) continue;
      if (segmentDistance({ x: o.x, y: 0, z: o.z }, flatFrom, flatTo) < pushOf(a.state) + pushOf(o) - .1) return false;
    }
    return true;
  }

  private finishTimeStopTour(a: Actor, cast: Cast, tour: TimeStopTour) {
    const move = cast.move, last = move.contacts.length - 1, p = a.state, order = tour.order!, primary = (tour.visited ?? 1) - 1;
    const origin = centre(p), primaryId: string | undefined = order[primary], target = primaryId === undefined ? undefined : this.actors.get(primaryId);
    const primaryBody = target || primaryId === undefined ? undefined : this.external?.locate(primaryId);
    this.emit({ kind: 'release', actorId: p.id, fighter: p.fighter, slot: cast.slot, origin,
      endpoint: target ? centreOf(target.state) : primaryBody ? { x: primaryBody.x, y: primaryBody.y + primaryBody.height * .55, z: primaryBody.z } : position(origin), contactIndex: last });
    for (let i = 0; i < order.length; i++) {
      if (i === primary) continue;
      const victim = this.actors.get(order[i]), struck = tour.struck![i], from = centre(struck ?? tour.from);
      if (!victim) {
        const body = this.external?.locate(order[i]);
        if (body) this.hitExternal(p.id, body, cast.slot, move, from, true, last, cast.id, cast.stage);
        if (a.cast !== cast) return;
        continue;
      }
      if (!victim.state.alive) continue;
      if (struck) victim.lastDamageAt = this.serverTime;
      this.holdHit(a, cast, victim, last, true, from);
      if (a.cast !== cast) return;
    }
    if (this.external && (cast.move.timeStop?.tour ?? TIME_STOP_TOURS[p.fighter])?.domain && !a.kit) {
      const centreOfStop = centre(tour.from), stop = move.timeStop!;
      const n = this.external.query(centreOfStop, centreOfStop, stop.radius + 1.2, this.nearby), released = new Set(order);
      for (let i = 0; i < n; i++) {
        const body = this.nearby[i];
        if (this.external.hostile?.(p.id,body)===false || released.has(body.id) || Math.hypot(body.x - centreOfStop.x, body.z - centreOfStop.z) > stop.radius) continue;
        this.hitExternal(p.id, body, cast.slot, move, centreOfStop, true, last, cast.id, cast.stage);
        if (a.cast !== cast) return;
      }
    }
    if (target) {
      if (!target.state.alive) return;
      if (tour.struck![primary]) target.lastDamageAt = this.serverTime;
      this.holdHit(a, cast, target, last, true, origin);
    } else if (primaryBody) this.hitExternal(p.id, primaryBody, cast.slot, move, origin, true, last, cast.id, cast.stage);
  }

  private ultimateTick(a: Actor, cast: Cast): boolean {
    const move = cast.move, p = a.state;
    if (!move.confirm || cast.slot !== 'ultimate' || a.kit || p.team !== undefined || move.timeStop) return false;
    if (cast.cine) return this.playCinematic(a, cast);
    if (move.style === 'projectile' && cast.nextContact === 0 && !cast.full) {
      cast.full = move;
      cast.move = { ...move, finisherDamage: move.damage, finisherStun: move.stun, finisherKnockback: move.knockback };
    }
    if (cast.whiff !== undefined || cast.nextContact === 0) return false;
    if (!cast.connected && this.openerPending(a, cast))
      return cast.nextContact < move.contacts.length && this.serverTime - cast.start >= move.contacts[cast.nextContact];
    if (this.follows) return this.awaitVerdict(cast);
    if (cast.full) { cast.move = cast.full; cast.full = undefined; }
    const held = cast.connected ? this.heldFor(a, cast) : undefined;
    if (!held?.length) { this.whiffUltimate(a, cast); return false; }
    this.confirmUltimate(a, cast, held);
    return this.playCinematic(a, cast);
  }

  private openerPending(a: Actor, cast: Cast) {
    if (cast.live) for (const open of cast.live) if (open.index === 0 && this.serverTime <= open.until) return true;
    for (const shot of this.projectiles) if (shot.actorId === a.state.id && shot.castId === cast.id) return true;
    return false;
  }

  private heldFor(a: Actor, cast: Cast): Actor[] {
    const held: Actor[] = [], p = a.state;
    for (const id of cast.opened.keys()) {
      const victim = this.actors.get(id);
      if (!victim || victim.kit || !victim.state.alive || !this.hostile(p, victim.state)) continue;
      if (id === p.target) held.unshift(victim); else held.push(victim);
    }
    return held;
  }

  private confirmUltimate(a: Actor, cast: Cast, held: Actor[]) {
    const p = a.state, ids: string[] = [], evade: number[] = [], pins: Vec3[] = [];
    for (const victim of held) {
      ids.push(victim.state.id); evade.push(victim.evadeUntil); pins.push(this.holdSpot(a, cast, victim));
      victim.state.heldBy = p.id;
    }
    cast.cine = { at: this.serverTime, ids, evade, pins, from: position(p), own: a.evadeUntil };
    a.holding = { cast: cast.id, ids: ids.slice() };
    p.confirmedAt = this.serverTime;
    const primary = held[0].state;
    this.emit({ kind: 'confirm', actorId: p.id, targetId: primary.id, fighter: p.fighter, slot: cast.slot, actionSeq: p.actionSeq,
      castAge: this.serverTime - cast.start, origin: position(p), endpoint: centreOf(primary), contactIndex: 0 });
  }

  private holdSpot(a: Actor, cast: Cast, victim: Actor): Vec3 {
    const p = a.state, q = victim.state;
    const least = Math.max(pushOf(p) + pushOf(q) + .02, cast.move.spacing ?? 0);
    const dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
    if (gap >= least || Math.abs(q.y - p.y) >= 1.5) return position(q);
    const ux = gap > 1e-4 ? dx / gap : Math.sin(p.yaw), uz = gap > 1e-4 ? dz / gap : Math.cos(p.yaw);
    const wanted = { x: ux * (least - gap), y: 0, z: uz * (least - gap) };
    const moved = this.collision?.move(q.id, q, wanted) ?? wanted;
    const { halfX, halfZ } = this.bounds;
    return { x: clamp(q.x + moved.x, -halfX + PLAYER_RADIUS, halfX - PLAYER_RADIUS), y: q.y,
      z: clamp(q.z + moved.z, -halfZ + PLAYER_RADIUS, halfZ - PLAYER_RADIUS) };
  }

  private playCinematic(a: Actor, cast: Cast): boolean {
    const cine = cast.cine!, move = cast.move, p = a.state;
    if (cine.done) return false;
    const last = move.contacts.length - 1, age = this.serverTime - cast.start;
    const until = cast.start + move.contacts[last] + CINEMATIC_MARGIN;
    if (cine.from) { p.x = cine.from.x; p.y = cine.from.y; p.z = cine.from.z; }
    a.mx = a.mz = a.kx = a.kz = a.vy = 0;
    a.evadeUntil = Math.max(a.evadeUntil, until);
    let primary: PlayerState | undefined;
    for (let i = 0; i < cine.ids.length; i++) {
      const victim = this.actors.get(cine.ids[i]);
      if (!victim) continue;
      if (!victim.state.alive) { this.dropHeld(a, cine, i); continue; }
      this.pinHeld(victim, cine.pins?.[i], until);
      primary ??= victim.state;
    }
    if (primary) {
      const dx = primary.x - p.x, dz = primary.z - p.z, n = Math.hypot(dx, dz);
      if (n > 1e-3) { p.yaw = Math.atan2(dx, dz); cast.direction = { x: dx / n, y: 0, z: dz / n }; }
    }
    while (cast.nextContact <= last && age >= move.contacts[cast.nextContact]) {
      const contact = cast.nextContact++, finisher = contact === last;
      const origin = centre(p);
      this.emit({ kind: 'release', actorId: p.id, fighter: p.fighter, slot: cast.slot, origin,
        endpoint: primary ? centreOf(primary) : position(origin), contactIndex: contact });
      for (let i = 0; i < cine.ids.length; i++) {
        const victim = this.actors.get(cine.ids[i]);
        if (!victim?.state.alive) continue;
        this.holdHit(a, cast, victim, contact, finisher, origin);
        if (a.cast !== cast) return true;
        if (!finisher && victim.state.alive) this.pinHeld(victim, cine.pins?.[i], until);
      }
      if (finisher) { this.releaseHold(a, cast); break; }
    }
    return false;
  }

  private pinHeld(victim: Actor, pin: Vec3 | undefined, until: number) {
    const q = victim.state;
    if (pin) { q.x = pin.x; q.y = pin.y; q.z = pin.z; }
    victim.kx = victim.kz = victim.vy = victim.mx = victim.mz = 0;
    victim.dashUntil = Math.min(victim.dashUntil, this.serverTime);
    victim.stunUntil = Math.max(victim.stunUntil, until);
    victim.evadeUntil = Math.max(victim.evadeUntil, until);
  }

  private shieldTour(a: Actor, cast: Cast) {
    const cine = cast.cine!, until = cast.start + cast.move.contacts[cast.move.contacts.length - 1] + CINEMATIC_MARGIN;
    a.evadeUntil = Math.max(a.evadeUntil, until);
    for (let i = 0; i < cine.ids.length; i++) {
      const victim = this.actors.get(cine.ids[i]);
      if (!victim) continue;
      if (!victim.state.alive) { this.dropHeld(a, cine, i); continue; }
      victim.stunUntil = Math.max(victim.stunUntil, until);
      victim.evadeUntil = Math.max(victim.evadeUntil, until);
    }
  }

  private holdHit(a: Actor, cast: Cast, victim: Actor, contact: number, finisher: boolean, origin: Vec3) {
    const id = a.state.id;
    if (!cast.cine) { this.hit(id, victim, cast.slot, cast.move, origin, finisher, origin, contact, cast.opened, cast.id, cast.stage); return; }
    const keep = victim.evadeUntil;
    victim.evadeUntil = -Infinity;
    if (cast.opened.has(victim.state.id)) victim.lastDamageAt = this.serverTime;
    this.hit(id, victim, cast.slot, scheduled(cast.move, contact), origin, finisher, origin, contact, cast.opened, cast.id, cast.stage);
    if (!finisher) victim.evadeUntil = Math.max(victim.evadeUntil, keep);
  }

  private releaseHold(a: Actor, cast: Cast) {
    const cine = cast.cine!;
    cine.done = true;
    for (let i = 0; i < cine.ids.length; i++) {
      const victim = this.actors.get(cine.ids[i]);
      if (!victim) continue;
      if (victim.state.heldBy === a.state.id) victim.state.heldBy = undefined;
      victim.evadeUntil = Math.max(cine.evade[i], victim.evadeUntil);
    }
    a.evadeUntil = cine.own;
    a.holding = undefined;
  }

  private dropHeld(a: Actor, cine: Cinematic, i: number) {
    const victim = this.actors.get(cine.ids[i]);
    if (victim?.state.heldBy === a.state.id) victim.state.heldBy = undefined;
    cine.ids[i] = '';
  }

  private stopTaken(a: Actor, cast: Cast, tour: TimeStopTour) {
    const p = a.state, order = tour.order!;
    if (!cast.move.confirm || a.kit || p.team !== undefined) return;
    if (!order.length) { this.whiffUltimate(a, cast); return; }
    const evade: number[] = [];
    for (const id of order) {
      const victim = this.actors.get(id);
      evade.push(victim ? victim.evadeUntil : -Infinity);
      if (victim) victim.state.heldBy = p.id;
    }
    cast.cine = { at: this.serverTime, ids: order.slice(), evade, own: a.evadeUntil };
    a.holding = { cast: cast.id, ids: order.slice() };
    p.confirmedAt = this.serverTime;
    const primary = this.actors.get(order[(tour.visited ?? 1) - 1])?.state;
    this.emit({ kind: 'confirm', actorId: p.id, targetId: primary?.id, fighter: p.fighter, slot: cast.slot, actionSeq: p.actionSeq,
      castAge: this.serverTime - cast.start, origin: position(p), endpoint: primary ? centreOf(primary) : undefined, contactIndex: cast.move.timeStop!.contact });
  }

  private whiffUltimate(a: Actor, cast: Cast) {
    const p = a.state, age = this.serverTime - cast.start;
    cast.whiff = this.serverTime;
    p.whiffedAt = this.serverTime;
    cast.move = { ...cast.move, contacts: cast.move.contacts.slice(0, cast.nextContact),
      duration: Math.min(cast.move.duration, age + (cast.move.confirm?.recovery ?? 0)) };
    this.emit({ kind: 'whiff', actorId: p.id, targetId: p.target ?? undefined, fighter: p.fighter, slot: cast.slot, actionSeq: p.actionSeq, castAge: age, origin: position(p) });
  }

  private cinematicTick(a: Actor) {
    const p = a.state, holding = a.holding;
    if (holding && (!a.cast || a.cast.id !== holding.cast || !a.cast.cine || a.cast.cine.done)) {
      a.holding = undefined;
      for (const id of holding.ids) {
        const victim = this.actors.get(id);
        if (!victim || victim.state.heldBy !== p.id) continue;
        victim.state.heldBy = undefined;
        victim.stunUntil = Math.min(victim.stunUntil, this.serverTime + LET_GO_STUN);
      }
    }
    if (p.heldBy !== undefined && !this.actors.get(p.heldBy)?.state.alive) p.heldBy = undefined;
    const ultimate = a.cast?.slot === 'ultimate' ? a.cast : undefined;
    const confirmedAt = ultimate?.cine?.at, whiffedAt = ultimate?.whiff;
    if (p.confirmedAt !== confirmedAt) p.confirmedAt = confirmedAt;
    if (p.whiffedAt !== whiffedAt) p.whiffedAt = whiffedAt;
  }

  private follows = false;
  static restShortcut = true;
  private localId: string | undefined;

  private atRest(a: Actor, vx: number, vz: number, dy: number) {
    const p = a.state;
    return p.grounded && p.alive && !a.reaction && !a.cast && !a.jumping && !a.wallBounce && !a.dashChase && this.serverTime >= a.dashUntil
      && Math.abs(vx) < 1e-9 && Math.abs(vz) < 1e-9 && Math.hypot(a.kx, a.kz) < REST_DRIFT && dy <= 0 && dy > -.01;
  }

  private awaitVerdict(cast: Cast) {
    return cast.nextContact < cast.move.contacts.length && this.serverTime - cast.start >= cast.move.contacts[cast.nextContact];
  }

  predictionCheckpoint(id:string,share=false):PredictionCheckpoint|undefined {
    const actor=this.actors.get(id);if(!actor)return;
    const groups=new Map<Map<string,number>,number>();
    const opened=(map:Map<string,number>)=>{if(!groups.has(map))groups.set(map,groups.size);return {opened:[...map],openedGroup:groups.get(map)!};};
    const checkpoint:Record<string,unknown>={},own=actor as unknown as Record<string,unknown>;
    for(const key of Object.keys(own))if(key!=='state'&&key!=='cast'&&key!=='forged')checkpoint[key]=own[key];
    const cast=actor.cast;
    checkpoint.cast=cast?{...cast,...opened(cast.opened)}:null;
    checkpoint.shots=this.projectiles.filter(p=>p.actorId===id).map(p=>({...p,...opened(p.opened)}));
    return (share?checkpoint:structuredClone(checkpoint)) as PredictionCheckpoint;
  }

  restorePrediction(id:string,checkpoint:PredictionCheckpoint){
    this.follows = true;
    this.localId = id;
    const actor=this.actors.get(id);if(!actor)return;
    const {cast,shots,...rest}=structuredClone(checkpoint);
    const groups=new Map<number,Map<string,number>>();
    const opened=(value:{opened:[string,number][];openedGroup:number})=>{if(!groups.has(value.openedGroup))groups.set(value.openedGroup,new Map(value.opened));return groups.get(value.openedGroup)!;};
    Object.assign(actor,rest,{cast:cast?{...cast,opened:opened(cast)}:null});
    this.projectiles=shots.map(p=>({...p,opened:opened(p)}));
  }

  snapshot(drainEvents = false, withPrediction = false): GameSnapshot {
    const result: GameSnapshot = { players: [...this.actors.values()].map(a => ({ ...a.state, ackSeq: a.lastSeq,
      hitstopFrom: a.hitstopFrom, hitstopUntil: a.hitstopUntil, cooldowns: { ...a.state.cooldowns } })),
      trainingBotMode: this.roomMode==='training'?this.trainingBotMode:undefined,
      trainingLab: this.roomMode==='training'&&this.actors.has('sparring-bot')?this.trainingLab.view():undefined,
      reactions:Object.fromEntries([...this.actors].map(([id,a])=>[id,Object.fromEntries(REACTION_KEYS.map(key=>[key,a[key]])) as ReactionCheckpoint])),
      events: this.events.map(e => ({ ...e, origin: e.origin ? position(e.origin) : undefined, endpoint: e.endpoint ? position(e.endpoint) : undefined })),
      serverTime: this.serverTime, roomMode: this.roomMode, stage: this.stage, status: this.status, winnerId: this.winnerId, tick: this.tick };
    if(withPrediction)result.prediction=Object.fromEntries([...this.actors.keys()].map(id=>[id,this.predictionCheckpoint(id)!]));
    if (drainEvents) this.events.length = 0;
    return result;
  }

  dispose() { this.actors.clear(); this.projectiles.length = 0; this.events.length = 0; this.collision?.dispose?.(); }
}

export function segmentDistance(point: Vec3, from: Vec3, to: Vec3): number {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const length2 = dx * dx + dy * dy + dz * dz;
  const t = length2 < 1e-8 ? 0 : clamp(((point.x - from.x) * dx + (point.y - from.y) * dy + (point.z - from.z) * dz) / length2, 0, 1);
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy, point.z - from.z - t * dz);
}
