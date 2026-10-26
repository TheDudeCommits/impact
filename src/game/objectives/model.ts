import './siegeEnemies';
import type {FighterId,GameSnapshot,PlayerState,StageId} from '../types';
import type {Contribution,VillageView} from './lastStand';
import type {FighterProgress} from './fighterProgress';
export const OBJECTIVE_PROTOCOL=10;
export type ObjectiveKind='bad-blood'|'last-stand';
export type ObjectiveTeam='heroes'|'villains'|'defenders';
export type RolePreference=ObjectiveTeam|'auto';
export type ObjectiveAccess='quick'|'bots'|'solo'|'host'|'join';
export type ObjectivePhase='lobby'|'countdown'|'active'|'over';
export interface ObjectiveSeat extends Contribution {duty?:import('./defenderOrders').DefenderOrder;progress?:FighterProgress;id:string;fighter:PlayerState['fighter'];name:string;team:ObjectiveTeam;bot:boolean;disconnected?:boolean;reviveAt?:number;revivesLeft:number;rescue:number;down:boolean;}
export interface ObjectiveView {
  kind:ObjectiveKind;phase:ObjectivePhase;round:number;hostId:string|null;code?:string;access:ObjectiveAccess;
  seats:ObjectiveSeat[];capacity:number;startsAt:number|null;endsAt:number;startedAt:number;winner:ObjectiveTeam|'horde'|'draw'|null;reason:string;
  village?:VillageView;fillBots:boolean;
  party?:boolean;autoStart?:boolean;
}
export type ObjectiveSnapshot=GameSnapshot&{objective:ObjectiveView};
export const objectiveOf=(snapshot:GameSnapshot|null|undefined):ObjectiveView|undefined=>(snapshot as ObjectiveSnapshot|undefined)?.objective;
export const OBJECTIVE_NAMES:Record<ObjectiveKind,string>={'bad-blood':'BAD BLOOD','last-stand':'LAST STAND'};
export const TEAM_NAMES:Record<ObjectiveTeam|'horde'|'draw',string>={heroes:'HEROES',villains:'VILLAINS',defenders:'DEFENDERS',horde:'THE HORDE',draw:'DRAW'};
export const OBJECTIVE_STAGE:Record<ObjectiveKind,StageId>={'bad-blood':'blood-citadel','last-stand':'hidden-leaf'};
export const CAPACITY:Record<ObjectiveKind,number>={'bad-blood':6,'last-stand':4};
export const RULES={countdown:3,quickWait:12,soloWait:3,spawnShield:2,heroReviveSeconds:3,rescueSeconds:4,rescueRadius:3,villainMultiplier:1.3} as const;
export const VILLAINS:readonly FighterId[]=['toji','crocodile','garou','esdeath','grimmjow','pain','makima','aokiji','doflamingo','hisoka','blackbeard','kizaru','enel','broly','akainu','mihawk','dio','kaido','aizen','sukuna','griffith','meruem','goku-black','jiren','golden-frieza','akaza','madara'];
export const HEROES:readonly FighterId[]=['usopp','rengoku','nico-robin','kaiju-no-8','eren','asuka','netero','shinji','jolyne','might-guy','akame','mikasa','alphonse-elric','ken-kaneki','byakuya','yamamoto','edward-elric','minato','kenpachi','tatsumaki','escanor','sakura','meliodas','hiei','nanami','josuke','tsunade','jiraiya','hinata','gintoki','yoruichi','yuji','rukia','yamato','todoroki','endeavor','yuta','jinbe','deku','bakugo','all-might','boa-hancock','denji','nami','goku','naruto','luffy','zoro','sanji','vegeta','kakashi','sasuke','jotaro','ichigo','ace','law','gojo','guts','killua','whitebeard','shanks','roger','gohan-beast','saitama','itachi','tanjiro','levi','sung-jinwoo','gon'];
export const isBadBloodFighter=(fighter:FighterId)=>HEROES.includes(fighter)||VILLAINS.includes(fighter);
export const factionOf=(fighter:FighterId):'heroes'|'villains'=>VILLAINS.includes(fighter)?'villains':'heroes';
export function isObjectiveKind(value:unknown):value is ObjectiveKind{return value==='bad-blood'||value==='last-stand';}
export const isRole=(value:unknown):value is RolePreference=>['heroes','villains','defenders','auto'].includes(String(value));
