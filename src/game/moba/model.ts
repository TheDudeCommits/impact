import type {FighterId, GameSnapshot, PlayerState, StageId, Vec3} from '../types';
export const RIFT_PROTOCOL = 3;
export const RIFT_STAGE = 'rift-war' as StageId;
export type RiftTeam = 'heroes' | 'villains';
export type RiftLane = 'top' | 'mid' | 'bot';
export type RiftAccess = 'quick' | 'bots' | 'solo' | 'host' | 'join';
export type RiftPhase = 'lobby' | 'countdown' | 'active' | 'over';
export type RiftItemId = 'vital-seal' | 'spirit-blade' | 'swift-sandals' | 'focus-charm' | 'iron-ward' | 'soul-fang' | 'titan-heart' | 'void-edge' | 'storm-step' | 'sage-scroll' | 'guardian-oath' | 'blood-moon' | 'dawn-oath' | 'rift-compass' | 'shadow-tread' | 'sunbreaker' | 'eclipse-fang' | 'aegis-of-dawn' | 'worldheart' | 'storm-crown' | 'infinite-script';
export interface RiftSeat {
  id:string; name:string; fighter:FighterId; team:RiftTeam; bot:boolean; disconnected?:boolean;
  lane:RiftLane; laneKnown?:boolean; gold:number; earned:number; xp:number; level:number; inventory:RiftItemId[];
  kills:number; deaths:number; assists:number; lastHits:number; structures:number; healing:number;
  boon?:{name:string;until:number};
  respawnAt?:number; recallAt?:number; hasteUntil?:number; buybackAt?:number; buybackCount?:number; role:'vanguard'|'carry'|'support';
}
export type RiftUnitKind = 'melee'|'ranged'|'siege'|'super'|'camp'|'boss';
export const RIFT_BODY_HEIGHT={core:4,tower:3.6,guardian:3.6,barracks:3.2} as const;
export interface RiftUnit extends Vec3 {
  id:string; team:RiftTeam|'neutral'; kind:RiftUnitKind; lane:RiftLane;
  hp:number; maxHp:number; yaw:number; state:'move'|'attack'|'hurt'|'dead'|'idle';
  target:string|null; attackAt:number; radius:number; empowered:boolean; echelon?:number;
}
export interface RiftStructure extends Vec3 {
  id:string; team:RiftTeam; lane:RiftLane|'base'; kind:'tower'|'barracks'|'guardian'|'core';
  tier:number; hp:number; maxHp:number; radius:number; vulnerable:boolean;
  target:string|null; attackAt:number; fireAt?:number; hidden?:boolean;
}
export interface RiftEvent {
  id:number; at:number; kind:'wave'|'tower'|'barracks'|'core'|'kill'|'level'|'purchase'|'recall'|'boss'|'rune'|'ping'|'bolt'|'buyback';
  team?:RiftTeam; actorId?:string; targetId?:string; lane?:RiftLane; x:number; z:number; value?:number; text?:string; hidden?:boolean;
}
export interface RiftRune extends Vec3 {id:string; kind:'haste'|'recovery'; available:boolean; respawnAt:number; hidden?:boolean;}
export interface RiftView {
  kind:'rift-war'; phase:RiftPhase; access:RiftAccess; round:number; hostId:string|null; code?:string;
  capacity:number; fillBots:boolean; startsAt:number|null; startedAt:number; endsAt:number;
  winner:RiftTeam|null; reason:string; seats:RiftSeat[]; structures:RiftStructure[]; units:RiftUnit[];
  wave:number; nextWaveAt:number; bossAt:number; bossRespawnAt:number;
  buffs:Record<RiftTeam,number>; runes:RiftRune[]; events:RiftEvent[];
  party?:boolean; autoStart?:boolean;
  vision?:{team:RiftTeam;circles:{x:number;z:number;radius:number}[]}; bossKnown?:boolean;
}
export type RiftSnapshot = GameSnapshot & {rift:RiftView};
export const riftOf=(snapshot:GameSnapshot|null|undefined):RiftView|undefined=>(snapshot as RiftSnapshot|undefined)?.rift;
export const RIFT_TEAMS:readonly RiftTeam[]=['heroes','villains'];
export const RIFT_LANES:readonly RiftLane[]=['top','mid','bot'];
export const RIFT_TEAM_NAMES:Record<RiftTeam,string>={heroes:'DAWN ALLIANCE',villains:'ECLIPSE LEGION'};
export const RIFT_LANE_NAMES:Record<RiftLane,string>={top:'SHRINE',mid:'RIVER',bot:'FOREST'};
export const enemyTeam=(team:RiftTeam):RiftTeam=>team==='heroes'?'villains':'heroes';
export const RIFT_RULES={capacity:10,teamSize:5,countdown:3,snapshotHz:20,aimMagnet:.6,towerRange:14,waveSeconds:30,firstWave:5,unitCap:192,laneUnitCap:26,recallSeconds:5,fountainRadius:10,shopRadius:14,respawnBase:8,respawnPerLevel:1.3,maxLevel:18,passiveGold:2,startingGold:550,bossFirst:150,bossRespawn:210,bossBuff:100} as const;
export const seatPlayer=(snapshot:RiftSnapshot,id:string):PlayerState|undefined=>snapshot.players.find(p=>p.id===id);

export const buybackCost=(seat:Pick<RiftSeat,'level'|'buybackCount'>):number=>250+seat.level*45+(seat.buybackCount??0)*125;
