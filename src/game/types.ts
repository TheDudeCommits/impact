import type { StageId } from './stages';
import type { PredictionCheckpoint,ReactionCheckpoint } from './simulation';
export type { StageId };
export type FighterId = 'goku' | 'naruto' | 'luffy' | 'sanji' | 'vegeta' | 'kakashi' | 'sasuke' | 'zoro' | 'jotaro' | 'ichigo'
  | 'ace' | 'law' | 'gojo' | 'dio' | 'guts' | 'killua'
  | 'kaido' | 'whitebeard' | 'shanks' | 'roger' | 'aizen' | 'sukuna' | 'griffith' | 'meruem' | 'goku-black' | 'jiren' | 'golden-frieza'
  | 'gohan-beast' | 'saitama' | 'akaza' | 'itachi' | 'madara' | 'tanjiro' | 'levi' | 'sung-jinwoo' | 'gon'
  | 'mihawk' | 'boa-hancock' | 'nami' | 'denji' | 'akainu' | 'broly' | 'deku' | 'bakugo' | 'all-might'
  | 'todoroki' | 'endeavor' | 'yoruichi' | 'yuji' | 'yuta' | 'rukia' | 'jinbe' | 'enel' | 'kizaru' | 'yamato' | 'hinata' | 'gintoki' | 'tsunade' | 'jiraiya' | 'nanami' | 'josuke' | 'blackbeard' | 'hisoka' | 'doflamingo' | 'sakura' | 'hiei' | 'meliodas' | 'escanor' | 'tatsumaki' | 'makima' | 'kenpachi' | 'minato' | 'edward-elric' | 'pain' | 'yamamoto' | 'byakuya' | 'grimmjow' | 'ken-kaneki' | 'alphonse-elric' | 'mikasa' | 'esdeath' | 'garou' | 'pikachu' | 'akame' | 'might-guy' | 'jolyne' | 'shinji' | 'netero' | 'asuka' | 'eren' | 'kaiju-no-8' | 'nico-robin' | 'aokiji' | 'rengoku' | 'usopp' | 'crocodile' | 'toji';
export type AttackSlot = 'light' | 'heavy' | 'special' | 'ultimate' | 'area';
export type CoreSlot = Exclude<AttackSlot, 'area'>;
export type ReactionKind = 'flinch' | 'hurt' | 'launched' | 'knockdown' | 'getup' | 'stun' | 'splat';
export type ActionKind = 'idle' | 'run' | 'jump' | 'dash' | 'guard' | 'awaken' | AttackSlot | ReactionKind | 'defeated' | 'victory';
export type RoomMode = 'training' | 'match';

export interface Vec3 { x: number; y: number; z: number }

export interface PlayerState extends Vec3 {
  id: string;
  name: string;
  fighter: FighterId;
  outfit?: string;
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina?: number;
  ultimate: number;
  action: ActionKind;
  actionStarted: number;
  actionDuration: number;
  actionTime: number;
  actionSeq?: number;
  chain?: number;
  branch?: import('./combos').ComboKey;
  actionFrozen?: number;
  target: string | null;
  alive: boolean;
  isBot: boolean;
  grounded: boolean;
  guarding: boolean;
  combo?: number;
  hitstop?: boolean;
  hitstopFrom?: number;
  hitstopUntil?: number;
  awakened?: boolean;
  dashKind?: 'forward' | 'back' | 'side';
  awakenedUntil?: number;
  timeStopped?: boolean;
  ackSeq?: number;
  awakening?: number;
  kills?: number;
  damageDealt?: number;
  damageTaken?: number;
  cooldowns: Record<CoreSlot, number> & { area?: number };
  team?: string;
  enemy?: string;
  move?: string;
  size?: number;
  girth?: number;
  poise?: number;
  heldBy?: string;
  confirmedAt?: number;
  whiffedAt?: number;
  forge?: string;
  status?: ('burn' | 'slow' | 'freeze')[];
}

export interface PlayerInput {
  seq: number;
  moveX: number;
  moveZ: number;
  yaw: number;
  jump?: boolean;
  jumpHeld?: boolean;
  dash?: boolean;
  guard?: boolean;
  awaken?: boolean;
  attack?: AttackSlot;
  aim?: { x: number; z: number };
  targetId?: string | null;
  lock?: boolean;
  view?: number;
}

export type CombatEventKind = 'cast' | 'release' | 'hit' | 'land' | 'blocked' | 'just-guard' | 'guard-break'
  | 'wall-splat' | 'ground-bounce' | 'projectile-clash' | 'break'
  | 'dodge' | 'tech' | 'awaken' | 'awaken-end' | 'eliminated' | 'respawn' | 'winner' | 'rejected'
  | 'status'
  | 'vanish'
  | 'chase'
  | 'poise-break'
  | 'confirm'
  | 'whiff'
  | 'impact';
export interface CombatEvent {
  actionSeq?: number;
  radius?: number;
  due?: number;
  look?: string;
  strikes?: number;
  bullseye?: boolean;
  status?: 'burn' | 'slow' | 'freeze';
  id: number;
  kind: CombatEventKind;
  serverTime: number;
  actorId: string;
  targetId?: string;
  fighter?: FighterId;
  slot?: AttackSlot;
  body?: FighterId;
  move?: string;
  origin?: Vec3;
  endpoint?: Vec3;
  damage?: number;
  contactIndex?: number;
  combo?: number;
  chain?: number;
  branch?: import('./combos').ComboKey;
  reaction?: ReactionKind;
  fromBehind?: boolean;
  reason?: string;
  seed?: number;
  enemy?: string;
  critical?: boolean;
  heal?: number;
  castAge?: number;
  outcome?: import('./moves').Outcome;
  lift?: number;
  drop?: number;
  downed?: boolean;
}

export interface RoomLobby {
  duel?: boolean;
  visibility: 'public' | 'private';
  code?: string;
  hostId: string | null;
  canStart: boolean;
  startsAt: number | null;
  expiresAt: number | null;
  size?: number;
  party?: boolean;
  autoStart?: boolean;
}

export interface PauseView {
  paused: boolean;
  pausing?: boolean;
  pausable: boolean;
  ack: number;
}

export interface GameSnapshot {
  duel?: import('./duel/DuelSet').DuelView;
  matchId?: string;
  reward?: {report: import('./economy/earn').Report; settlement: import('./economy/account').Settlement};
  trainingLab?: import('./training/TrainingLab').LabView;
  pause?: PauseView;
  prediction?: Record<string,PredictionCheckpoint>;
  queued?: number;
  reactions?:Record<string,ReactionCheckpoint>;
  lobby?: RoomLobby;
  stage: StageId;
  trainingBotMode?: 'passive'|'combat';
  players: PlayerState[];
  events: CombatEvent[];
  serverTime: number;
  roomMode: RoomMode;
  status: 'waiting' | 'active' | 'finished';
  winnerId: string | null;
  tick: number;
}

export interface CollisionMovement extends Vec3 {
  grounded?: boolean;
}
export interface CollisionWorld {
  move(id: string, position: Vec3, displacement: Vec3): CollisionMovement;
  remove?(id: string): void;
  raycast?(origin: Vec3, endpoint: Vec3): Vec3;
  dispose?(): void;
}
