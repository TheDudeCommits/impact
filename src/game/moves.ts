import { TOJI_MOVES } from './fighters/toji';
import { CROCODILE_MOVES } from './fighters/crocodile';
import { USOPP_MOVES } from './fighters/usopp';
import { TIME_STOP_TOURS, type TourStyle } from './timeStopBarrage';
import { areaMoveOf } from '../engine/sim/areaMoves';
import { applyHouseKits } from '../engine/sim/houseKits';
import { NICO_ROBIN_MOVES } from './fighters/nico-robin';
import { RENGOKU_MOVES } from './fighters/rengoku';
import { KAIJU_MOVES } from './fighters/kaiju-no-8';
import { EREN_MOVES, EREN_RUSH } from './fighters/eren';
import { ASUKA_MOVES } from './fighters/asuka';
import { NETERO_MOVES } from './fighters/netero';
import { SHINJI_MOVES } from './fighters/shinji';
import { JOLYNE_MOVES } from './fighters/jolyne';
import { MIGHT_GUY_MOVES } from './fighters/might-guy';
import { AKAME_MOVES } from './fighters/akame';
import { PIKACHU_MOVES } from './fighters/pikachu';
import { GAROU_MOVES } from './fighters/garou';
import { ESDEATH_MOVES } from './fighters/esdeath';
import { MIKASA_MOVES } from './fighters/mikasa';
import { ALPHONSE_ELRIC_MOVES } from './fighters/alphonse-elric';
import { KANEKI_MOVES } from './fighters/kaneki';
import { GRIMMJOW_MOVES } from './fighters/grimmjow';
import { BYAKUYA_MOVES } from './fighters/byakuya';
import { YAMAMOTO_MOVES } from './fighters/yamamoto';
import { PAIN_MOVES } from './fighters/pain';
import { EDWARD_ELRIC_MOVES } from './fighters/edward-elric';
import { MINATO_MOVES } from './fighters/minato';
import { KENPACHI_MOVES } from './fighters/kenpachi';
import { MAKIMA_MOVES } from './fighters/makima';
import { TATSUMAKI_MOVES } from './fighters/tatsumaki';
import { ESCANOR_MOVES } from './fighters/escanor';
import { MELIODAS_MOVES } from './fighters/meliodas';
import { HIEI_MOVES } from './fighters/hiei';
import { SAKURA_MOVES } from './fighters/sakura';
import { AOKIJI_MOVES } from './fighters/aokiji';
import { DOFLAMINGO_MOVES } from './fighters/doflamingo';
import { HISOKA_MOVES } from './fighters/hisoka';
import { BLACKBEARD_MOVES } from './fighters/blackbeard';
import { NANAMI_MOVES } from './fighters/nanami';
import { JOSUKE_MOVES } from './fighters/josuke';
import { TSUNADE_MOVES } from './fighters/tsunade';
import { JIRAIYA_MOVES } from './fighters/jiraiya';
import { HINATA_MOVES } from './fighters/hinata';
import { GINTOKI_MOVES } from './fighters/gintoki';
import { KIZARU_MOVES } from './fighters/kizaru';
import { YAMATO_MOVES } from './fighters/yamato';
import { JINBE_MOVES } from './fighters/jinbe';
import { ENEL_MOVES } from './fighters/enel';
import { RUKIA_MOVES } from './fighters/rukia';
import { YUTA_MOVES } from './fighters/yuta';
import { YUJI_MOVES } from './fighters/yuji';
import { TODOROKI_MOVES } from './fighters/todoroki';
import { ENDEAVOR_MOVES } from './fighters/endeavor';
import { YORUICHI_MOVES } from './fighters/yoruichi';
import { ALL_MIGHT_MOVES } from './fighters/all-might';
import { BAKUGO_MOVES } from './fighters/bakugo';
import { DEKU_MOVES } from './fighters/deku';
import { BROLY_MOVES } from './fighters/broly';
import { DENJI_MOVES } from './fighters/denji';
import { AKAINU_MOVES } from './fighters/akainu';
import { MIHAWK_MOVES } from './fighters/mihawk';
import { BOA_HANCOCK_MOVES } from './fighters/boa-hancock';
import { NAMI_MOVES } from './fighters/nami';
import { ENVIRONMENT_COLLIDERS } from './environmentLayout';
import contactReach from './data/contactReach.json';
import type { AttackSlot, FighterId } from './types';

export interface MoveDefinition {
  name: string;
  duration: number;
  contacts: number[];
  damage: number;
  range: number;
  radius: number;
  stamina: number;
  cooldown: number;
  stun: number;
  finisherDamage?: number;
  finisherStun?: number;
  knockback: number;
  finisherKnockback?: number;
  style: 'melee' | 'beam' | 'projectile' | 'bomb' | 'field';
  speed?: number;
  aimOnRelease?: boolean;
  guardBreak?: boolean;
  detached?: boolean;
  lunge?: number;
  lungeDelay?: number;
  timeStop?: {contact:number;duration:number;radius:number;
    tour?: TourStyle};
  origin?: {right:number;forward:number;up:number};
  palmHold?: boolean;
  lockAim?: boolean;
  status?: { kind: StatusKind; seconds: number; dps?: number; factor?: number };
  close?: number;
  track?: number;
  active?: number;
  hitstop?: number;
  outcome?: Outcome;
  lift?: number;
  chargeIn?: number;
  dashThrough?: boolean;
  plunge?: number;
  ender?: boolean;
  reach?: number;
  down?: number;
  daze?: number;
  knock?: 'slam' | 'spike' | 'slide' | 'splat';
  fling?: boolean;
  spacing?: number;
  teleport?: { vanish: number; appear: number; reach: number; behind: number; miss: number; near?: boolean };
  confirm?: { recovery: number };
  schedule?: readonly number[];
  area?: AreaSpec;
}

export type SlotMoves = Record<Exclude<AttackSlot, 'area'>, MoveDefinition> & { area?: MoveDefinition };

export interface AreaSpec {
  telegraph: number;
  hits?: number;
  interval?: number;
  fx?: string;
  strikes?: number[];
  height?: number;
  anim?: Exclude<AttackSlot, 'area'> | AreaAnim;
  voice?: string;
  ja?: string;
  card?: string;
  look?: 'burst' | 'zone' | 'rain' | 'pillar';
}
export interface AreaAnim { slot?: Exclude<AttackSlot, 'area'>; clip?: string; from?: FighterId; full?: boolean }
export { AREA_DEFAULTS } from '../engine/sim/areaMoves';

export type StatusKind = 'burn' | 'slow' | 'freeze';
export const FREEZE_IMMUNITY = 2;
export const BURN_TICK = .5;

export type Outcome = 'launch' | 'hop' | 'crumple' | 'stagger' | 'spin' | 'wallBounce' | 'groundBounce' | 'knockdown' | 'dizzy';
export const LAUNCHING: ReadonlySet<Outcome> = new Set(['launch', 'hop', 'crumple', 'wallBounce', 'groundBounce', 'knockdown']);
type Standing = 'stagger' | 'spin' | 'dizzy';
export const OUTCOME_LIFT: Record<Exclude<Outcome, Standing>, number> = {
  launch: 6.6, hop: 5, crumple: 2.2, wallBounce: 3.4, groundBounce: 5.4, knockdown: 3,
};
export const OUTCOME_DOWN: Record<Exclude<Outcome, Standing>, number> = {
  launch: .36, hop: .3, crumple: .34, wallBounce: .34, groundBounce: .34, knockdown: .8,
};
export const DIZZY_SECONDS = 1.3, DIZZY_GUARD = 6;
export const WALL_BOUNCE_BACK = .42, WALL_BOUNCE_LIFT = 6;
export const SPIN_SECONDS = .42, SPIN_ANGLE = 1.05;
export const STAGGER_GUARD = 2.5, STAGGER_SPENT = .35;

export const ACTIVE_WINDOW = 5 / 60;
export const HEAVY_ACTIVE = 7 / 60;
export function activeWindow(move: MoveDefinition): number {
  return move.active ?? (move.duration >= 1 ? HEAVY_ACTIVE : ACTIVE_WINDOW);
}

export const MOVES: Record<FighterId, Record<AttackSlot, MoveDefinition>> = ({
  yuta: YUTA_MOVES,
  rukia: RUKIA_MOVES,
  toji:TOJI_MOVES,crocodile:CROCODILE_MOVES,usopp:USOPP_MOVES,rengoku:RENGOKU_MOVES,sakura:SAKURA_MOVES,meliodas:MELIODAS_MOVES,escanor:ESCANOR_MOVES,tatsumaki:TATSUMAKI_MOVES,makima:MAKIMA_MOVES,kenpachi:KENPACHI_MOVES,minato:MINATO_MOVES,'nico-robin':NICO_ROBIN_MOVES,'kaiju-no-8':KAIJU_MOVES,eren:EREN_MOVES,asuka:ASUKA_MOVES,netero:NETERO_MOVES,shinji:SHINJI_MOVES,jolyne:JOLYNE_MOVES,'might-guy':MIGHT_GUY_MOVES,akame:AKAME_MOVES,pikachu:PIKACHU_MOVES,garou:GAROU_MOVES,esdeath:ESDEATH_MOVES,mikasa:MIKASA_MOVES,'alphonse-elric':ALPHONSE_ELRIC_MOVES,'ken-kaneki':KANEKI_MOVES,grimmjow:GRIMMJOW_MOVES,byakuya:BYAKUYA_MOVES,yamamoto:YAMAMOTO_MOVES,pain:PAIN_MOVES,'edward-elric':EDWARD_ELRIC_MOVES,hiei:HIEI_MOVES,aokiji:AOKIJI_MOVES,doflamingo:DOFLAMINGO_MOVES,hisoka:HISOKA_MOVES,blackbeard:BLACKBEARD_MOVES,nanami:NANAMI_MOVES,josuke:JOSUKE_MOVES,tsunade:TSUNADE_MOVES,
  jiraiya:JIRAIYA_MOVES,
  hinata:HINATA_MOVES,
  gintoki:GINTOKI_MOVES,
  kizaru:KIZARU_MOVES,
  yamato:YAMATO_MOVES,
  jinbe:JINBE_MOVES,
  enel:ENEL_MOVES,
  yuji:YUJI_MOVES,
  todoroki: TODOROKI_MOVES,
  endeavor: ENDEAVOR_MOVES,
  yoruichi: YORUICHI_MOVES,

  'all-might': ALL_MIGHT_MOVES,
  bakugo: BAKUGO_MOVES,
  deku: DEKU_MOVES,
  broly: BROLY_MOVES,
  denji: DENJI_MOVES,
  akainu: AKAINU_MOVES,
  mihawk: MIHAWK_MOVES,
  'boa-hancock': BOA_HANCOCK_MOVES,
  nami: NAMI_MOVES,
  zoro:{
    light:{name:'Oni Giri',duration:.47,contacts:[.18],damage:20,range:2.6,radius:.5,stamina:9,cooldown:.45,stun:.25,knockback:3,lunge:4.5,style:'melee'},
    heavy:{name:'Lion’s Song',duration:.88,contacts:[.42],damage:58,range:2.8,radius:.7,stamina:24,cooldown:1.15,active:HEAVY_ACTIVE,stun:.7,knockback:8,lunge:7,style:'melee',chargeIn:2.4,dashThrough:true,outcome:'launch'},
    special:{name:'1080 Pound Phoenix',duration:1.5,contacts:[.72],damage:126,range:35,radius:1.35,stamina:30,cooldown:4.5,stun:1.1,knockback:11,speed:28,style:'projectile',outcome:'wallBounce'},
  },
  jotaro:{
    light:{name:'Straight Punch',duration:.5,contacts:[.19],damage:23,range:2.2,radius:.5,stamina:10,cooldown:.48,stun:.28,knockback:3.5,lunge:2,style:'melee'},
    heavy:{name:'Star Finger',duration:.8,contacts:[.34],damage:62,range:9,radius:.5,stamina:23,cooldown:1.1,stun:.85,knockback:2.5,speed:40,style:'projectile',outcome:'stagger'},
    special:{name:'Ora Ora Barrage',duration:2.34,contacts:[.6,.77,.94,1.11,1.28,1.45,1.62,1.79],damage:24,range:3,radius:.7,stamina:32,cooldown:4.5,stun:.2,finisherStun:1.1,knockback:0,finisherKnockback:12,lunge:3,style:'melee',outcome:'wallBounce'},
  },
  ichigo:{
    light:{name:'Zangetsu Cut',duration:.48,contacts:[.18],damage:21,range:2.5,radius:.6,stamina:9,cooldown:.46,stun:.24,knockback:3,lunge:2.5,style:'melee'},
    heavy:{name:'Shunpo Strike',duration:.84,contacts:[.38],damage:56,range:2.6,radius:.7,stamina:23,cooldown:1.15,active:HEAVY_ACTIVE,stun:.7,knockback:2,lunge:9,style:'melee',outcome:'hop',lift:5.4},
    special:{name:'Getsuga Tenshō',duration:1.5,contacts:[.7],damage:126,range:35,radius:1.3,stamina:30,cooldown:4.5,stun:1.1,knockback:10,speed:30,style:'projectile',outcome:'launch'},
  },
  kakashi:{
    light:{name:'Kunai Strike',duration:.4,contacts:[.14],damage:17,range:1.8,radius:.35,stamina:8,cooldown:.39,stun:.22,knockback:3,lunge:3,style:'melee'},
    heavy:{name:'Lightning Blade',duration:.92,contacts:[.44],damage:55,range:1.8,radius:.6,stamina:23,cooldown:1.1,active:HEAVY_ACTIVE,stun:.5,knockback:1.5,lunge:6,style:'melee',chargeIn:2,outcome:'crumple'},
    special:{name:'Lightning Shadow Clone',duration:1.45,contacts:[.62],damage:122,range:26,radius:.8,stamina:30,cooldown:4.5,stun:1.4,knockback:5,speed:12,style:'projectile',outcome:'stagger'},
  },
  sasuke:{
    light:{name:'Kusanagi Cut',duration:.42,contacts:[.15],damage:18,range:2.2,radius:.42,stamina:9,cooldown:.41,stun:.23,knockback:3,lunge:2.5,style:'melee'},
    heavy:{name:'Chidori',duration:.92,contacts:[.44],damage:56,range:1.9,radius:.6,stamina:23,cooldown:1.15,active:HEAVY_ACTIVE,stun:.8,knockback:3,lunge:6,style:'melee',chargeIn:2,outcome:'stagger'},
    special:{name:'Amaterasu',duration:2.3,contacts:[.5,.85,1.2,1.55,1.9],damage:27,range:22,radius:2.4,stamina:30,cooldown:4.7,stun:.15,knockback:0,style:'field',outcome:'crumple'},
  },
  sanji:{
    light:{name:'Collier',duration:.36,contacts:[.13],damage:16,range:1.3,radius:.36,stamina:7,cooldown:.36,stun:.22,knockback:2.5,lunge:3.5,style:'melee'},
    heavy:{name:'Concassé',duration:.78,contacts:[.34],damage:52,range:1.7,radius:.65,stamina:21,cooldown:1,active:HEAVY_ACTIVE,stun:.6,knockback:2,lunge:2.5,style:'melee',outcome:'groundBounce'},
    special:{name:'Diable Jambe: Mouton Shot',duration:1.32,contacts:[.58],damage:118,range:16,radius:1.15,stamina:30,cooldown:4.3,stun:1.1,knockback:10,speed:34,aimOnRelease:true,guardBreak:true,style:'projectile',outcome:'launch'},
  },
  vegeta:{
    light:{name:'Ki-Charged Straight',duration:.45,contacts:[.16],damage:20,range:2.3,radius:.5,stamina:9,cooldown:.43,stun:.24,knockback:3,lunge:3,style:'melee'},
    heavy:{name:'Big Bang Attack',duration:.84,contacts:[.37],damage:56,range:24,radius:.8,stamina:24,cooldown:1.25,stun:.5,knockback:8,speed:24,style:'projectile',outcome:'launch'},
    special:{name:'Galick Gun',duration:2,contacts:[.8],damage:128,range:35,radius:.8,stamina:30,cooldown:4.5,stun:1.2,knockback:10,style:'beam',outcome:'wallBounce'},
  },
  goku: {
    light: { name: "Rock, Scissors 'N' Paper: Rock", duration: .42, contacts: [.15], damage: 18, range: 1.2, radius: 0.3, stamina: 6, cooldown: .42, stun: 0.19, knockback: 2, lunge: 5, style: 'melee' },
    heavy: { name: 'Instant Transmission Strike', duration: .84, contacts: [.448], damage: 54, range: 1.4, radius: 0.55, stamina: 23, cooldown: 1.2, stun: 0.7, knockback: 10, lunge: 12, lungeDelay: .298, style: 'melee', active: HEAVY_ACTIVE,
      teleport: { vanish: .165, appear: .298, reach: 10, behind: 1.15, miss: 2.5 }, outcome: 'launch' },
    special: { name: 'Kamehameha', duration: 1.75, contacts: [.75], damage: 122, range: 38, radius: 1.05, stamina: 30, cooldown: 4.2, stun: 1.12, knockback: 10, style: 'beam', outcome: 'wallBounce' },
  },
  luffy: {
    light: {name:'Gum-Gum Pistol', duration:.42, contacts:[.15], damage:17, range:2.5, radius:.4, stamina:8, cooldown:.4, stun:.2, knockback:3, style:'melee'},
    heavy: {name:'Gum-Gum Bazooka', duration:.9, contacts:[.42], damage:68, range:3.6, radius:.8, stamina:24, cooldown:1.2, stun:.7, knockback:13, style:'melee', outcome:'wallBounce'},
    special: {name:'Gum-Gum Hawk Gatling', duration:1.62, contacts:[.5,.59,.68,.77,.86,.95,1.04,1.13,1.25], damage:19, finisherDamage:60, range:16, radius:1, stamina:30, cooldown:4.7, stun:.22, finisherStun:1, knockback:0, finisherKnockback:11, style:'beam', track:.6, outcome:'wallBounce'},
  },
  naruto: {
    light: { name: 'Naruto Uzumaki Barrage', duration: .615, contacts: [.12, .2475, .42], damage: 10, range: 2.6, radius: 0.7, stamina: 9, cooldown: .64, stun: 0.15, knockback: 3, lunge: 1.8, style: 'melee' },
    heavy: { name: 'Rasengan', duration: .88, contacts: [.5], damage: 58, range: 3.3, radius: 1, stamina: 24, cooldown: 1.2, stun: 0.38, knockback: 10, lunge: 6, lungeDelay: .245, style: 'melee', chargeIn: 2, active: HEAVY_ACTIVE, outcome: 'launch', palmHold: true, lockAim: true },
    special: { name: 'Wind Style: Rasenshuriken', duration: 1.35, contacts: [0.5], damage: 125, range: 34, radius: 1.5, stamina: 28, cooldown: 5.5, stun: 0.42, knockback: 9, speed: 24, style: 'projectile' },
  },
  ace:{
    light:{name:'Hotarubi',duration:.44,contacts:[.16],damage:19,range:2.2,radius:.5,stamina:9,cooldown:.42,stun:.24,knockback:3,lunge:3,style:'melee'},
    heavy:{name:'Kagero',duration:.9,contacts:[.38],damage:55,range:8,radius:1.2,stamina:23,cooldown:1.3,stun:.5,knockback:2.5,speed:34,aimOnRelease:true,style:'projectile',outcome:'crumple'},
    special:{name:'Hiken',duration:1.36,contacts:[.6],damage:124,range:20,radius:1.3,stamina:30,cooldown:4.5,stun:1.1,knockback:10,speed:36,aimOnRelease:true,guardBreak:true,style:'projectile',outcome:'launch'},
  },
  law:{
    light:{name:'Kikoku Slash',duration:.46,contacts:[.17],damage:19,range:2.7,radius:.5,stamina:9,cooldown:.44,stun:.25,knockback:3,lunge:4.5,style:'melee'},
    heavy:{name:'Injection Shot',duration:.84,contacts:[.38],damage:56,range:2.8,radius:.6,stamina:23,cooldown:1.1,active:HEAVY_ACTIVE,stun:.65,knockback:4,lunge:8,style:'melee',outcome:'spin'},
    special:{name:'Gamma Knife',duration:1.4,contacts:[.62],damage:124,range:2.4,radius:.8,stamina:30,cooldown:4.5,stun:.5,knockback:1.5,close:4,guardBreak:true,style:'melee',outcome:'crumple'},
  },
  gojo:{
    light:{name:'Cursed Strike',duration:.44,contacts:[.16],damage:19,range:2.2,radius:.5,stamina:9,cooldown:.43,stun:.24,knockback:3,lunge:3,style:'melee'},
    heavy:{name:'Lapse: Blue',duration:.86,contacts:[.38],damage:53,range:14,radius:.8,stamina:24,cooldown:1.25,stun:.5,knockback:-18,speed:26,style:'projectile'},
    special:{name:'Hollow Purple',duration:1.7,contacts:[.8],damage:126,range:38,radius:1.1,stamina:30,cooldown:4.5,stun:1.15,knockback:10,guardBreak:true,style:'beam',outcome:'launch'},
  },
  dio:{
    light:{name:'Muda Punch',duration:.42,contacts:[.15],damage:18,range:2.2,radius:.5,stamina:9,cooldown:.41,stun:.23,knockback:3,lunge:2,style:'melee'},
    heavy:{name:'Knife Throw',duration:.72,contacts:[.28],damage:52,range:12,radius:.5,stamina:22,cooldown:1,stun:.8,knockback:2,speed:32,style:'projectile',outcome:'stagger'},
    special:{name:'Muda Muda Barrage',duration:2.34,contacts:[.6,.77,.94,1.11,1.28,1.45,1.62,1.79],damage:22,range:3,radius:.7,stamina:32,cooldown:4.5,stun:.2,finisherStun:1.1,knockback:0,finisherKnockback:12,lunge:3,style:'melee',outcome:'wallBounce'},
  },
  guts:{
    light:{name:'Dragonslayer Slash',duration:.58,contacts:[.24],damage:27,range:2.9,radius:.8,stamina:11,cooldown:.56,stun:.32,knockback:4.5,lunge:3,style:'melee'},
    heavy:{name:'Cleave',duration:1.02,contacts:[.5],damage:72,range:13,radius:1.3,stamina:26,cooldown:1.3,stun:.75,knockback:3,speed:30,aimOnRelease:true,style:'projectile',outcome:'groundBounce'},
    special:{name:'Cannon Arm',duration:1.36,contacts:[.55],damage:138,range:20,radius:1.2,stamina:30,cooldown:4.7,stun:1.1,knockback:11,speed:46,aimOnRelease:true,guardBreak:true,style:'projectile',outcome:'launch'},
  },
  killua:{
    light:{name:'Claw Strike',duration:.34,contacts:[.12],damage:16,range:2.0,radius:.45,stamina:7,cooldown:.34,stun:.2,knockback:2.5,lunge:5,style:'melee'},
    heavy:{name:'Thunderbolt',duration:.66,contacts:[.26],damage:51,range:2.2,radius:.6,stamina:20,cooldown:.95,stun:.8,knockback:2,lunge:7,style:'melee',outcome:'stagger'},
    special:{name:'Narukami',duration:1.2,contacts:[.5],damage:116,range:14,radius:.7,stamina:30,cooldown:4.2,stun:1.05,knockback:3,speed:45,style:'projectile',outcome:'stagger'},
  },
  kaido:{
    light:{name:'Kanabo Swing',duration:.6,contacts:[.24],damage:27,range:3,radius:.85,stamina:11,cooldown:.58,stun:.33,knockback:4.5,lunge:3,style:'melee'},
    heavy:{name:'Kanabo Smash',duration:1.02,contacts:[.5],damage:72,range:3.2,radius:1,stamina:26,cooldown:1.3,active:HEAVY_ACTIVE,stun:.75,knockback:3,lunge:5,style:'melee',outcome:'groundBounce'},
    special:{name:'Kaifu',duration:1.55,contacts:[.74],damage:136,range:16,radius:1.1,stamina:30,cooldown:4.7,stun:1.1,knockback:11,speed:26,guardBreak:true,style:'projectile',outcome:'spin'},
  },
  whitebeard:{
    light:{name:'Murakumogiri',duration:.6,contacts:[.24],damage:27,range:2.55,radius:.85,stamina:11,cooldown:.58,stun:.32,knockback:4.5,lunge:3.5,style:'melee'},
    heavy:{name:'Bisento Cleave',duration:1.02,contacts:[.5],damage:71,range:3.3,radius:.95,stamina:26,cooldown:1.3,active:HEAVY_ACTIVE,stun:.75,knockback:6,lunge:5,style:'melee',outcome:'wallBounce'},
    special:{name:'Gekishin',duration:1.6,contacts:[.78],damage:132,range:14,radius:1.4,stamina:30,cooldown:4.7,stun:1.2,knockback:13,speed:34,guardBreak:true,style:'projectile',outcome:'wallBounce'},
  },
  shanks:{
    light:{name:'Gryphon Slash',duration:.46,contacts:[.17],damage:19,range:2.55,radius:.55,stamina:9,cooldown:.44,stun:.25,knockback:3,lunge:4.5,style:'melee'},
    heavy:{name:'Haki Thrust',duration:.86,contacts:[.38],damage:57,range:2.9,radius:.6,stamina:23,cooldown:1.1,active:HEAVY_ACTIVE,stun:.65,knockback:5,lunge:8,style:'melee',outcome:'stagger'},
    special:{name:"Conqueror's Haki",duration:1.4,contacts:[.6],damage:112,range:1.2,radius:4.2,stamina:30,cooldown:4.7,stun:1.4,knockback:2,guardBreak:true,style:'melee',outcome:'crumple'},
  },
  roger:{
    light:{name:'Ace Slash',duration:.48,contacts:[.17],damage:20,range:2.55,radius:.6,stamina:9,cooldown:.46,stun:.26,knockback:3.2,lunge:4.5,style:'melee'},
    heavy:{name:'Haki Lunge',duration:.98,contacts:[.46],damage:60,range:3,radius:.7,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:4,lunge:8,style:'melee',outcome:'hop'},
    special:{name:"King's Salute",duration:1.3,contacts:[.6],damage:122,range:22,radius:.7,stamina:30,cooldown:4.4,stun:1.2,knockback:6,speed:48,guardBreak:true,style:'projectile',outcome:'stagger'},
  },
  aizen:{
    light:{name:'Zanjutsu',duration:.44,contacts:[.15],damage:18,range:2.3,radius:.7,stamina:8,cooldown:.42,stun:.24,knockback:4.5,lunge:4,style:'melee'},
    heavy:{name:'Kyōka Suigetsu',duration:.9,contacts:[.5],damage:58,range:3,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.75,knockback:3,lunge:12,lungeDelay:.3,style:'melee',
      teleport:{vanish:.1,appear:.3,reach:8,behind:1.15,miss:2.5},outcome:'crumple'},
    special:{name:'Hadō #91: Senjū Kōten Taihō',duration:1.7,contacts:[.7],damage:126,range:24,radius:1,stamina:30,cooldown:4.6,stun:1.1,knockback:8,speed:38,guardBreak:true,style:'projectile',outcome:'spin'},
  },
  sukuna:{
    light:{name:'Dismantle Cut',duration:.46,contacts:[.16],damage:19,range:2.4,radius:.7,stamina:9,cooldown:.44,stun:.25,knockback:3.5,lunge:4.5,style:'melee'},
    heavy:{name:'Hachi: Cleave',duration:.9,contacts:[.44],damage:61,range:2.8,radius:.9,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.75,knockback:6,lunge:7,style:'melee',outcome:'wallBounce'},
    special:{name:'Kai: Dismantle',duration:1.5,contacts:[.68],damage:128,range:20,radius:1.2,stamina:30,cooldown:4.5,stun:1.1,knockback:5,speed:46,guardBreak:true,style:'projectile',outcome:'stagger'},
  },
  griffith:{
    light:{name:'Sabre Thrust',duration:.44,contacts:[.16],damage:18,range:2.6,radius:.5,stamina:9,cooldown:.42,stun:.24,knockback:3,lunge:5,style:'melee'},
    heavy:{name:"Hawk's Talon",duration:.88,contacts:[.42],damage:60,range:2.8,radius:.75,stamina:24,cooldown:1.15,active:HEAVY_ACTIVE,stun:.7,knockback:3,lunge:7,style:'melee',outcome:'groundBounce'},
    special:{name:'Spear Throw',duration:1.2,contacts:[.5],damage:118,range:24,radius:.7,stamina:30,cooldown:4.4,stun:1.1,knockback:7,speed:40,style:'projectile',outcome:'wallBounce'},
  },
  meruem:{
    light:{name:'Royal Claw',duration:.42,contacts:[.15],damage:18,range:2.2,radius:.75,stamina:8,cooldown:.4,stun:.24,knockback:3,lunge:5.5,style:'melee'},
    heavy:{name:'Tail Whip',duration:.86,contacts:[.4],damage:60,range:3,radius:1,stamina:24,cooldown:1.15,active:HEAVY_ACTIVE,stun:.7,knockback:6,lunge:6,style:'melee',outcome:'wallBounce'},
    special:{name:'Rage Blast',duration:1.3,contacts:[.56],damage:120,range:22,radius:1.2,stamina:30,cooldown:4.6,stun:1.1,knockback:10,speed:30,style:'projectile',outcome:'wallBounce'},
  },
  'goku-black':{
    light:{name:'Black Strike',duration:.44,contacts:[.16],damage:18,range:2.2,radius:.55,stamina:8,cooldown:.42,stun:.24,knockback:3,lunge:5,style:'melee'},
    heavy:{name:'Sword of Retribution',duration:.9,contacts:[.5],damage:56,range:2.2,radius:.7,stamina:23,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:6,lunge:12,lungeDelay:.3,style:'melee',
      teleport:{vanish:.1,appear:.3,reach:8,behind:1.15,miss:2.5},outcome:'crumple'},
    special:{name:'Black Kamehameha',duration:1.7,contacts:[.78],damage:120,range:34,radius:1,stamina:30,cooldown:4.4,stun:1.1,knockback:9,style:'beam',outcome:'wallBounce'},
  },
  jiren:{
    light:{name:'Pride Jab',duration:.46,contacts:[.17],damage:19,range:2.3,radius:.55,stamina:9,cooldown:.44,stun:.25,knockback:3.5,lunge:4.5,style:'melee'},
    heavy:{name:'Rising Fist',duration:.9,contacts:[.44],damage:58,range:2.4,radius:.75,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:3,lunge:7,style:'melee',outcome:'hop',lift:7},
    special:{name:'Power Impact',duration:1.6,contacts:[.74],damage:126,range:26,radius:1.15,stamina:30,cooldown:4.6,stun:1.15,knockback:11,speed:26,style:'projectile',outcome:'wallBounce'},
  },
  'golden-frieza':{
    light:{name:'Death Beam',duration:.42,contacts:[.15],damage:17,range:2.4,radius:.5,stamina:8,cooldown:.4,stun:.24,knockback:3,lunge:5,style:'melee'},
    heavy:{name:'Tail Cyclone',duration:.9,contacts:[.46],damage:56,range:2.9,radius:1,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:7,lunge:5,style:'melee',outcome:'wallBounce'},
    special:{name:'Death Beam Barrage',duration:1.6,contacts:[.72],damage:118,range:26,radius:.6,stamina:30,cooldown:4.4,stun:1.1,knockback:6,speed:60,style:'projectile',outcome:'crumple'},
  },
  'gohan-beast':{
    light:{name:'Beast Fist',duration:.45,contacts:[.16],damage:19,range:2.3,radius:.55,stamina:9,cooldown:.43,stun:.25,knockback:3,lunge:5,style:'melee'},
    heavy:{name:'Rising Kick',duration:.9,contacts:[.46],damage:57,range:2.6,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:4,lunge:7,style:'melee',outcome:'hop',lift:5},
    special:{name:'Masenko',duration:1.8,contacts:[.78],damage:124,range:34,radius:.95,stamina:30,cooldown:4.4,stun:1.1,knockback:9,style:'beam',outcome:'wallBounce'},
  },
  saitama:{
    light:{name:'Normal Punch',duration:.46,contacts:[.17],damage:19,range:2.3,radius:.55,stamina:9,cooldown:.44,stun:.25,knockback:3.5,lunge:5,style:'melee'},
    heavy:{name:'Serious Sneeze',duration:1,contacts:[.5],damage:60,range:16,radius:1.6,stamina:24,cooldown:1.25,stun:.8,knockback:12,style:'beam',outcome:'wallBounce'},
    special:{name:'Consecutive Normal Punches',duration:1.9,contacts:[.52,.64,.76,.88,1,1.12,1.24,1.4],damage:16,range:2.6,radius:.8,stamina:30,cooldown:4.5,stun:.2,finisherStun:1.1,knockback:0,finisherKnockback:11,lunge:3,style:'melee',outcome:'wallBounce'},
  },
  akaza:{
    light:{name:'Straight Punch',duration:.44,contacts:[.16],damage:18,range:2.4,radius:.55,stamina:8,cooldown:.42,stun:.24,knockback:3.5,lunge:5,style:'melee'},
    heavy:{name:'Disorder',duration:1,contacts:[.3,.48,.7],damage:19,finisherDamage:20,range:2.5,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.4,finisherStun:.7,knockback:.6,finisherKnockback:7,lunge:6,style:'melee',outcome:'wallBounce'},
    special:{name:'Destructive Death: Air Type',duration:1.25,contacts:[.52],damage:112,range:18,radius:.9,stamina:30,cooldown:4.4,stun:1.1,knockback:9,speed:44,style:'projectile',outcome:'wallBounce'},
  },
  itachi:{
    light:{name:'Kunai Slash',duration:.42,contacts:[.15],damage:18,range:2.4,radius:.5,stamina:8,cooldown:.4,stun:.23,knockback:3,lunge:5,style:'melee'},
    heavy:{name:'Crow Clone',duration:.9,contacts:[.5],damage:56,range:2.3,radius:.75,stamina:23,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:7,lunge:12,lungeDelay:.3,style:'melee',
      teleport:{vanish:.12,appear:.32,reach:8,behind:1.2,miss:2.5},outcome:'wallBounce'},
    special:{name:'Amaterasu',duration:2.2,contacts:[.6,.95,1.3,1.65],damage:30,range:22,radius:2.2,stamina:30,cooldown:4.7,stun:.15,knockback:0,style:'field',outcome:'crumple'},
  },
  madara:{
    light:{name:'Gunbai Swing',duration:.46,contacts:[.17],damage:19,range:2.5,radius:.65,stamina:8,cooldown:.42,stun:.24,knockback:3.5,lunge:5,style:'melee'},
    heavy:{name:'Rising Kick',duration:.92,contacts:[.46],damage:57,range:2.5,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:4,lunge:7,style:'melee',outcome:'hop',lift:5.2},
    special:{name:'Majestic Destroyer Flame',duration:2,contacts:[.64,.92,1.2,1.48],damage:30,range:16,radius:3.6,stamina:30,cooldown:4.7,stun:.18,knockback:1,style:'field',outcome:'crumple'},
  },
  tanjiro:{
    light:{name:'Water Surface Slash',duration:.44,contacts:[.16],damage:18,range:2.7,radius:.55,stamina:8,cooldown:.42,stun:.24,knockback:3,lunge:5,style:'melee'},
    heavy:{name:'Sword Throw',duration:.95,contacts:[.42],damage:58,range:18,radius:.8,stamina:24,cooldown:1.25,stun:.7,knockback:4,speed:36,style:'projectile',outcome:'stagger'},
    special:{name:'Flowing Dance',duration:1.9,contacts:[.62,1.06,1.33],damage:38,range:2.8,radius:1.4,stamina:30,cooldown:4.6,stun:.4,finisherStun:1,knockback:4,finisherKnockback:9,lunge:6,style:'melee',outcome:'wallBounce'},
  },
  levi:{
    light:{name:'Blade Slash',duration:.42,contacts:[.15],damage:18,range:2.6,radius:.55,stamina:8,cooldown:.4,stun:.23,knockback:3,lunge:5,style:'melee'},
    heavy:{name:'Thunder Spear',duration:.95,contacts:[.42],damage:60,range:20,radius:1.1,stamina:24,cooldown:1.25,stun:.7,knockback:5,speed:38,style:'projectile',outcome:'hop'},
    special:{name:'ODM Dash',duration:1.3,contacts:[.62],damage:118,range:3,radius:.8,stamina:30,cooldown:4.5,stun:1,knockback:6,lunge:9,guardBreak:true,style:'melee',chargeIn:2.8,dashThrough:true,outcome:'spin'},
  },
  'sung-jinwoo':{
    light:{name:'Dagger Cut',duration:.42,contacts:[.15],damage:18,range:2.5,radius:.5,stamina:8,cooldown:.4,stun:.23,knockback:3,lunge:5,style:'melee'},
    heavy:{name:'Twin Fang',duration:.92,contacts:[.48],damage:57,range:2.5,radius:.8,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:7,lunge:8,style:'melee',outcome:'wallBounce'},
    special:{name:"Ruler's Authority",duration:1.7,contacts:[.66,1.12],damage:56,range:18,radius:2.6,stamina:30,cooldown:4.6,stun:.5,knockback:2,style:'field',outcome:'groundBounce'},
  },
  gon:{
    light:{name:'Jajanken: Rock',duration:.44,contacts:[.16],damage:19,range:2.4,radius:.55,stamina:8,cooldown:.42,stun:.24,knockback:3.5,lunge:5,style:'melee'},
    heavy:{name:'Jajanken: Scissors',duration:.9,contacts:[.44],damage:57,range:2.6,radius:.85,stamina:24,cooldown:1.2,active:HEAVY_ACTIVE,stun:.7,knockback:4,lunge:7,style:'melee',outcome:'spin'},
    special:{name:'Jajanken: Paper',duration:1.5,contacts:[.7],damage:124,range:16,radius:1,stamina:30,cooldown:4.5,stun:1.1,knockback:10,speed:26,style:'projectile',outcome:'wallBounce'},
  },
} satisfies Record<FighterId, Omit<Record<AttackSlot, MoveDefinition>, 'ultimate' | 'area'> & { ultimate?: MoveDefinition; area?: MoveDefinition }>) as Record<FighterId, Record<AttackSlot, MoveDefinition>>;

export const WHIFF_RECOVERY = .5;
const WHIFF = { recovery: WHIFF_RECOVERY };
const SANJI_HELL = [40, 26, 36, 50, 248];
const ULTIMATES: Record<FighterId, MoveDefinition> = {
  yuta: YUTA_MOVES.ultimate,
  rukia: RUKIA_MOVES.ultimate,
  toji:TOJI_MOVES.ultimate,crocodile:CROCODILE_MOVES.ultimate,usopp:USOPP_MOVES.ultimate,rengoku:RENGOKU_MOVES.ultimate,sakura:SAKURA_MOVES.ultimate,meliodas:MELIODAS_MOVES.ultimate,escanor:ESCANOR_MOVES.ultimate,tatsumaki:TATSUMAKI_MOVES.ultimate,makima:MAKIMA_MOVES.ultimate,kenpachi:KENPACHI_MOVES.ultimate,minato:MINATO_MOVES.ultimate,'nico-robin':NICO_ROBIN_MOVES.ultimate,'kaiju-no-8':KAIJU_MOVES.ultimate,eren:EREN_MOVES.ultimate,asuka:ASUKA_MOVES.ultimate,netero:NETERO_MOVES.ultimate,shinji:SHINJI_MOVES.ultimate,jolyne:JOLYNE_MOVES.ultimate,'might-guy':MIGHT_GUY_MOVES.ultimate,akame:AKAME_MOVES.ultimate,pikachu:PIKACHU_MOVES.ultimate,garou:GAROU_MOVES.ultimate,esdeath:ESDEATH_MOVES.ultimate,mikasa:MIKASA_MOVES.ultimate,'alphonse-elric':ALPHONSE_ELRIC_MOVES.ultimate,'ken-kaneki':KANEKI_MOVES.ultimate,grimmjow:GRIMMJOW_MOVES.ultimate,byakuya:BYAKUYA_MOVES.ultimate,yamamoto:YAMAMOTO_MOVES.ultimate,pain:PAIN_MOVES.ultimate,'edward-elric':EDWARD_ELRIC_MOVES.ultimate,hiei:HIEI_MOVES.ultimate,aokiji:AOKIJI_MOVES.ultimate,doflamingo:DOFLAMINGO_MOVES.ultimate,hisoka:HISOKA_MOVES.ultimate,blackbeard:BLACKBEARD_MOVES.ultimate,nanami:NANAMI_MOVES.ultimate,josuke:JOSUKE_MOVES.ultimate,tsunade:TSUNADE_MOVES.ultimate,
  jiraiya:JIRAIYA_MOVES.ultimate,
  hinata:HINATA_MOVES.ultimate,
  gintoki:GINTOKI_MOVES.ultimate,
  kizaru:KIZARU_MOVES.ultimate,
  yamato:YAMATO_MOVES.ultimate,
  jinbe:JINBE_MOVES.ultimate,
  enel:ENEL_MOVES.ultimate,
  yuji:YUJI_MOVES.ultimate,
  todoroki: TODOROKI_MOVES.ultimate,
  endeavor: ENDEAVOR_MOVES.ultimate,
  yoruichi: YORUICHI_MOVES.ultimate,

  'all-might': ALL_MIGHT_MOVES.ultimate,
  bakugo: BAKUGO_MOVES.ultimate,
  deku: DEKU_MOVES.ultimate,
  broly: BROLY_MOVES.ultimate,
  denji: DENJI_MOVES.ultimate,
  akainu: AKAINU_MOVES.ultimate,
  mihawk: MIHAWK_MOVES.ultimate,
  'boa-hancock': BOA_HANCOCK_MOVES.ultimate,
  nami: NAMI_MOVES.ultimate,
  zoro:{name:'Billion-fold World Trichiliocosm',duration:2.3,contacts:[.45,1.42,1.5,1.58],schedule:[40,62,62,203],damage:40,finisherDamage:255,range:3.7,radius:1.7,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,lunge:5,guardBreak:true,style:'melee',spacing:2.2,confirm:WHIFF},
  jotaro:{name:'Star Platinum: The World',duration:3.3,contacts:[.58,1,1.16,1.32,1.48,1.64,1.8,1.96,2.12,2.5],damage:40,finisherDamage:245,range:3.6,radius:1.4,stamina:0,cooldown:22,stun:2.3,knockback:16,guardBreak:true,style:'melee',lunge:0,timeStop:{contact:0,duration:1.9,radius:6},confirm:WHIFF},
  ichigo:{name:'Final Getsuga: Mugetsu',duration:2.6,contacts:[.5,1.85],schedule:[55,264],damage:55,finisherDamage:320,range:38,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'beam',confirm:WHIFF},
  kakashi:{name:'Kamui Lightning Blade',duration:2.85,contacts:[.48,.62,.76,2.1],schedule:[40,9,9,315],damage:40,finisherDamage:241,range:2.5,radius:1,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:14,lunge:10,guardBreak:true,style:'melee',confirm:WHIFF},
  sasuke:{name:'Indra’s Arrow',origin:{right:.54,forward:.09,up:2.94},duration:2.55,contacts:[.5,1.8],schedule:[110,198],damage:110,finisherDamage:258,range:40,radius:2,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:15,speed:110,guardBreak:true,style:'projectile',confirm:WHIFF},
  sanji:{name:'Hell Memories',duration:2.95,contacts:[.45,.85,1.15,1.42,2.2],schedule:SANJI_HELL,damage:40,finisherDamage:208,range:2.4,radius:1.2,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,lunge:5.5,guardBreak:true,style:'melee',confirm:WHIFF},
  vegeta:{name:'Final Flash',duration:2.45,contacts:[.52,.65,.74,.83,.92,1.01,1.1,1.19,1.28,1.37,1.7],schedule:[20,11,11,11,11,11,11,11,11,11,609],damage:20,finisherDamage:168,range:42,radius:1.6,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'beam',confirm:WHIFF},
  goku:{name:'Super Spirit Bomb',duration:2.6,contacts:[1.5],damage:285,range:34,radius:3,stamina:0,cooldown:20,stun:2.3,knockback:16,speed:22,style:'bomb',aimOnRelease:true},
  luffy:{name:'Gum-Gum Bajrang Gun',duration:3.05,contacts:[.5,2.3],damage:40,finisherDamage:280,range:10.5,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,lunge:1.5,close:0,style:'melee',confirm:WHIFF},
  naruto:{name:'Tailed Beast Bomb',duration:2,contacts:[1],damage:270,range:34,radius:3,stamina:0,cooldown:20,stun:2.3,knockback:16,speed:24,style:'bomb',aimOnRelease:true},
  ace:{name:'Enkai: Dai Enkai Entei',duration:2.4,contacts:[1.35],damage:290,range:16,radius:3,stamina:0,cooldown:20,stun:2.3,knockback:16,speed:16,guardBreak:true,style:'bomb',aimOnRelease:true},
  law:{name:'ROOM: Counter Shock',duration:2.44,contacts:[.45,1.52,1.74],schedule:[40,92,202],damage:40,finisherDamage:288,range:2.6,radius:1.6,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,lunge:12,lungeDelay:.45,guardBreak:true,style:'melee',confirm:WHIFF,
    teleport:{vanish:.45,appear:.45,reach:10.5,behind:1.15,miss:0,near:true}},
  gojo:{name:'Domain Expansion: Infinite Void',duration:3.15,contacts:[.65,.95,1.25,1.55,1.85,2.3],damage:42,finisherDamage:265,range:3.4,radius:1.4,stamina:0,cooldown:22,stun:2.3,knockback:16,guardBreak:true,style:'melee',lunge:0,timeStop:{contact:0,duration:1.63,radius:3.5},confirm:WHIFF},
  dio:{name:'ZA WARUDO: Road Roller',duration:3.55,contacts:[.58,1,1.16,1.32,1.48,1.64,1.8,1.96,2.12,2.5],damage:40,finisherDamage:259,range:3.6,radius:1.6,stamina:0,cooldown:22,stun:2.3,knockback:16,guardBreak:true,style:'melee',lunge:0,timeStop:{contact:0,duration:1.9,radius:6},confirm:WHIFF},
  guts:{name:'Berserker Rampage',duration:2.65,contacts:[.48,.95,1.25,1.48,1.95],schedule:[45,45,56,72,228],damage:45,finisherDamage:274,range:3.2,radius:1.3,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:5,guardBreak:true,style:'melee',confirm:WHIFF},
  killua:{name:'Godspeed: Whirlwind',duration:2.28,contacts:[.42,.6,.73,.86,.99,1.12,1.25,1.38,1.63],schedule:[22,13,13,13,13,13,13,13,414],damage:22,finisherDamage:172,range:3,radius:1.1,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1,finisherKnockback:16,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  kaido:{name:'Raimei Hakke: Thunder Bagua',duration:2.3,contacts:[.5,1.6],schedule:[40,275],damage:40,finisherDamage:328,range:3.4,radius:2.2,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  whitebeard:{name:'Shima Yurashi: Island Shaker',duration:3.1,contacts:[.55,1.25,1.8,2.35],schedule:[40,40,58,227],damage:40,finisherDamage:248,range:2.6,radius:4,stamina:0,cooldown:22,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'melee',lunge:0,confirm:WHIFF},
  shanks:{name:'Divine Departure',duration:2.4,contacts:[.5,1.6],schedule:[45,269],damage:45,finisherDamage:323,range:30,radius:2.2,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'beam',confirm:WHIFF},
  roger:{name:'Kamusari: Divine Departure',duration:2.36,contacts:[.55,1.62],schedule:[50,264],damage:50,finisherDamage:318,range:3.2,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  aizen:{name:'Hadō #90: Kurohitsugi',duration:2.5,contacts:[.52,1.3,1.45,1.6,1.84],schedule:[52,22,24,26,280],damage:52,finisherDamage:160,range:18,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:0,finisherKnockback:14,guardBreak:true,style:'field',confirm:WHIFF},
  sukuna:{name:'Domain Expansion: Malevolent Shrine',duration:3.15,contacts:[.65,.9,1.1,1.3,1.5,2.3],damage:60,finisherDamage:128,range:3.4,radius:2.4,stamina:0,cooldown:22,stun:2.3,knockback:.4,finisherKnockback:12,guardBreak:true,style:'melee',lunge:0,timeStop:{contact:0,duration:1.63,radius:3.5},confirm:WHIFF},
  griffith:{name:'The Eclipse',duration:2.4,contacts:[.4,1.78],schedule:[44,270],damage:44,finisherDamage:324,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  meruem:{name:"The King's Decree",duration:2.3,contacts:[.42,.98,1.62],schedule:[40,60,238],damage:40,finisherDamage:288,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  'goku-black':{name:'Rose Scythe',duration:2.5,contacts:[.4,1.15,1.8],schedule:[60,40,237],damage:60,finisherDamage:248,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:17,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  jiren:{name:'Full Power Fist',duration:2.55,contacts:[.45,1.85],schedule:[52,261],damage:52,finisherDamage:316,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:18,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  'golden-frieza':{name:'Death Ball',duration:2.6,contacts:[1.45],damage:290,range:30,radius:3.2,stamina:0,cooldown:20,stun:2.3,knockback:16,speed:16,guardBreak:true,style:'bomb',aimOnRelease:true},
  itachi:{name:'Tsukuyomi',duration:2.5,contacts:[.42,1,1.12,1.24,1.36,1.48,1.8],schedule:[46,12,13,14,15,16,420],damage:46,finisherDamage:92,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:10,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  madara:{name:'Heaven Concealed',duration:2.5,contacts:[.42,1.8],schedule:[60,253],damage:60,finisherDamage:308,range:3,radius:2.6,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:12,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  tanjiro:{name:'Hinokami Kagura',duration:2.4,contacts:[.4,1.1,1.78],schedule:[62,44,229],damage:62,finisherDamage:244,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:16,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  levi:{name:'Spinning Assault',duration:2.2,contacts:[.42,.7,.82,.94,1.06,1.18,1.5],schedule:[46,16,16,16,16,16,403],damage:46,finisherDamage:92,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:15,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  'sung-jinwoo':{name:'Arise',duration:2.5,contacts:[.42,1.25,1.4,1.55,1.8],schedule:[50,20,22,24,291],damage:50,finisherDamage:168,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:.4,finisherKnockback:14,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  gon:{name:'First Comes Rock',duration:2.5,contacts:[.42,1.8],schedule:[68,244],damage:68,finisherDamage:300,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  akaza:{name:'Annihilation Type',duration:2.5,contacts:[.42,1.75],schedule:[56,257],damage:56,finisherDamage:312,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:19,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  saitama:{name:'Serious Punch',duration:2.2,contacts:[.5,1.55],schedule:[54,259],damage:54,finisherDamage:314,range:3,radius:2.4,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:24,close:7,guardBreak:true,style:'melee',confirm:WHIFF},
  'gohan-beast':{name:'Special Beam Cannon',duration:2.5,contacts:[.55,1.8],schedule:[48,266],damage:48,finisherDamage:320,range:42,radius:1.1,stamina:0,cooldown:20,stun:.35,finisherStun:2.3,knockback:1.5,finisherKnockback:16,guardBreak:true,style:'beam',confirm:WHIFF},
};
for (const fighter of Object.keys(ULTIMATES) as FighterId[]) MOVES[fighter].ultimate = ULTIMATES[fighter];
for (const fighter of Object.keys(MOVES) as FighterId[]) MOVES[fighter] = { ...MOVES[fighter], area: areaMoveOf(fighter) };

export const HITSTOP: Record<AttackSlot, number> = { light: .08, heavy: .13, special: .16, ultimate: .22, area: .16 };
export const BIG_HITSTOP = { special: .22, ultimate: .26, ender: .2, finisher: .17 } as const;
export const BIG_ENDER_HOLD = .04;
export const BIG_LAUNCH_MOST = .04;
export const ADV_ON_HIT: Record<AttackSlot, number> = { light: .06, heavy: .1, special: .16, ultimate: .5, area: .16 };
export const MAX_FLOOR_STUN: Record<AttackSlot, number> = { light: .5, heavy: .7, special: .9, ultimate: 2.3, area: .9 };
export const BREAK_CASTS = 6;
export const BREAK_EVADE = .28;
export const BREAK_PUSH = 7;
export const BREAK_FREEZE = .12;
export const CHIP: Record<AttackSlot, number> = { light: .04, heavy: .06, special: .1, ultimate: .18, area: .1 };
export const GUARD_COST: Record<AttackSlot, number> = { light: 5, heavy: 14, special: 20, ultimate: 30, area: 20 };
export const GUARD_COST_DAMAGE = .15;
export const GUARD_REAR_COST = 1.5;
export const GUARD_FRONT = .2;
export const JUST_GUARD_WINDOW = .25;
export const PARRY_REARM = .1;
export const PARRY_LOCKOUT = .7;
export const JUST_GUARD_ADVANTAGE = .72;
export const PARRY_FREEZE = .22;
export const JUST_GUARD_METER = 12;
export const PARRY_STAMINA = 15;
export const PARRY_REACH = 4.5;
export const JUST_GUARD_ADVANTAGE_KIT = .34;
export const WALL_SPLAT_SPEED = 4;
export const WALL_SPLAT_STUN = .8;
export const GROUND_BOUNCE_LIFT = 5.4;
export const GROUND_ACCEL = 95;
export const GROUND_BRAKE = 140;
export const GROUND_TURN_ACCEL = 180;
export const AIR_CONTROL = .35;
export const BLOCK_STUN: Record<AttackSlot, number> = { light: .13, heavy: .2, special: .26, ultimate: .32, area: .26 };
export const BLOCK_PUSH: Record<AttackSlot, number> = { light: 3.6, heavy: 9.6, special: 12, ultimate: 14, area: 12 };
export const BLOCK_PUSH_ENDER = 10.8;
export const BLOCK_DRAG = 12;
export const BLOCK_RECOIL = .4;

export const BODY_SIZE: Partial<Record<FighterId, number>> = { kaido: 1.5 };
export const CONTACT_GAP: Record<FighterId, number> = {
  toji:1.17,
  crocodile:1.2,
  usopp:1.12,
  rengoku:1.2,sakura:1.16,meliodas:1.14,escanor:1.3,tatsumaki:1.1,makima:1.12,kenpachi:1.3,minato:1.12,'nico-robin':1.12,'kaiju-no-8':1.15,eren:1.25,asuka:1.35,netero:1.1,shinji:1.10,jolyne:1.2,'might-guy':1.12,akame:1.1,pikachu:1.1,garou:1.12,esdeath:1.2,mikasa:1.15,'alphonse-elric':1.26,'ken-kaneki':1.14,grimmjow:1.14,byakuya:1.15,yamamoto:1.22,pain:1.12,'edward-elric':1.08,hiei:1.1,aokiji:1.2,doflamingo:1.3,hisoka:1.2,blackbeard:1.45,nanami:1.25,josuke:1.25,tsunade:1.2,jiraiya:1.2,hinata:1.15,gintoki:1.55,
  kizaru:1.4,yamato:1.65,
  jinbe:1.45,enel:1.2,
  yuta: 1.15,
  rukia: 1.05,
  yuji:1.15,
  todoroki: 1.2, endeavor: 1.3, yoruichi: 1.15,
  'all-might': 1.3,
  bakugo: 1.2,
  deku: 1.12,
  broly: 1.4,
  denji: 1.18,
  akainu: 1.65,
  mihawk: 1.4,
  'boa-hancock': 1.05,
  nami: 1.2,
  goku: 1.1, sanji: 1.3, zoro: 1.3, ichigo: 1.3, luffy: 1.3,
  jotaro: 1.25, kakashi: 1.1, sasuke: 1.1, vegeta: 1.2, naruto: 1.15,
  ace: 1.3, law: 1.35, gojo: 1.2, dio: 1.25, guts: 1.4, killua: 1.1,
  kaido: 1.45, whitebeard: 1.45, shanks: 1.3, roger: 1.3, aizen: 1.3, sukuna: 1.2, griffith: 1.3, meruem: 1.15, 'goku-black': 1.15, jiren: 1.4, 'golden-frieza': 1.15, 'gohan-beast': 1.15, saitama: 1.2, akaza: 1.2, itachi: 1.2, madara: 1.2, tanjiro: 1.25, levi: 1.25, 'sung-jinwoo': 1.2, gon: 1.15,
};
export const MAX_APPROACH = 12;
export const MAX_CLOSE = 3.2;

const REACH = contactReach as Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>>;
const REACH_OVERRIDE: Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>> = {
  jotaro: { special: 2.1, ultimate: 2.4 },
  luffy: { ultimate: 10.3 },
  shanks: { special: 4.2 },
  aizen: { light: 1.6, heavy: 2.2 },
  sukuna: { light: 2, ultimate: 3.2 },
  meruem: { light: 1.6, heavy: 2.2, special: 3.6 },
  'goku-black': { heavy: 2, ultimate: 2 },
  jiren: { heavy: 1.5 },
  'golden-frieza': { light: 2.2, heavy: 2.4 },
  'gohan-beast': { heavy: 1.6 },
  naruto: { light: .65, heavy: .65 },
  sasuke: { light: .65 },
  gojo: { light: .65 },
  dio: { special: 2.1, ultimate: 2.4 },
  madara: { light: 1, heavy: 1.35 },
  tanjiro: { light: 1.25, heavy: 1.3, special: 1.25 },
  gon: { light: .65, heavy: 1.25, ultimate: .52 },
};
const MELEE_SLACK = .2;
export function contactGap(fighter: FighterId, slot: AttackSlot, move: MoveDefinition, grounded=true) {
  const comfortable = CONTACT_GAP[fighter] ?? 1.25;
  const reach = meleeReach(fighter, slot, move, grounded);
  if (!Number.isFinite(reach)) return comfortable;
  return Math.max(PLAYER_RADIUS * 2, Math.min(comfortable, reach - .3));
}

export function meleeReach(fighter: FighterId, slot: AttackSlot, move: MoveDefinition, grounded=true) {
  if (move.style !== 'melee') return Infinity;
  if (move.ender) return move.range + PLAYER_RADIUS;
  const measured = move.reach ?? (grounded&&fighter==='naruto'&&slot==='heavy'&&move.name==='Rasengan'?.85
    :REACH_OVERRIDE[fighter]?.[slot] ?? REACH[fighter]?.[slot]);
  if (measured === undefined) return move.range + PLAYER_RADIUS;
  return Math.min(move.range + PLAYER_RADIUS, measured + PLAYER_RADIUS + MELEE_SLACK);
}

export const LAUNCH_KNOCKBACK = 6;
export const KNOCKDOWN_SECONDS = .62;
export const GETUP_SECONDS = .4;
export const GROUND_HIT_SCALE = .5;
export const GROUND_HIT_HOLD = .2, GROUND_HIT_MOST = .3;
export const GROUND_HIT_SHOVE = 3;
export const GROUND_HIT_SCALES: readonly number[] = [GROUND_HIT_SCALE, .35, .2, .1];
export const GROUND_HIT_BUDGET = .055;
export function groundHitDamage(standing: number, hits: number, taken: number, maxHp: number): number {
  const left = Math.round(maxHp * GROUND_HIT_BUDGET) - taken;
  if (!(left > 0)) return 0;
  const scale = GROUND_HIT_SCALES[Math.min(Math.max(0, Math.floor(hits)), GROUND_HIT_SCALES.length - 1)];
  return Math.min(left, Math.max(1, Math.round(standing * scale)));
}
export const GUARD_BREAK_STUN = 1.15;
export const COMBO_WINDOW = 1.4;
export const RUSH_STAGES = 4;
export const RUSH_WINDOW = .3;
export const RUSH_AIR_STAGES = 3;
export const MASH_INTERVAL = .14, MASH_SCALE = .75;
export const BEAT_EARLY = .06, RHYTHM_BONUS = 1.15, ENDER_SCALING = .35;
export const POP_LAND_STUN = .32;
export const KNOCK_DRAG = { slide: 2.6, splat: 2.2 } as const;
export const SPIKE_BOUNCE = 3.4;
export const AIR_SPIKE_DRIVE = 16;
export const AIR_FLING = { hold: .1, away: 9, down: 7, drag: 1.2 } as const;
export const AIR_STRING_LIFTOFF = .06;
export const AIR_RUSH_NAMES = ['Air Knee', 'Air Kick', 'Air Smash'] as const;
export const AIR_RUSH: Partial<Record<FighterId, readonly [string | undefined, string, string]>> = {
  toji:["Assassin Rising Edge","Blindside Cut","No Escape"],
  crocodile:["Desert Girasole","Golden Hook","Desert Encierro"],
  usopp:["Trampolia Star","Aerial Kabuto","Skull Bombgrass"],
  sakura:["Rising Blossom","Bloom Backfist","Shattering Blossom"],
  meliodas:["Rising Dragon","Dragon Reversal","Wrath Cleaver"],
  escanor:["Rising Pride","Royal Reversal","Sunlit Divider"],
  tatsumaki:["Psychic Flick","Vector Reversal","Aerial Repulse"],
  makima:["Come Here","Stay Down","Submission"],
  kenpachi:["Captain Rising Cut","Shoulder Reversal","Jagged Execution"],
  minato:["Rising Spiral","Crossing Mark","Spiral Descent"],
  'nico-robin':['Seis Fleur Rise','Tres Fleur Twist','Ocho Fleur Hold'],
  'kaiju-no-8':['Fortitude Uppercut','Armored Hook','Reactor Hammer'],
  asuka:['Rush 1','Rush 2','Rush 3'],
  netero:['Rising Palm','Prayer Reversal','Temple Breaker'],
  rengoku:['Rising Ember','Flame Reversal','Blazing Divider'],
  shinji:['Pylon Breaker','Axial Counter','Core Drive'],
  jolyne:['String Uppercut','Cross Stitch','Prison Break'],
  'might-guy':['Leaf Straight','Leaf Rising Wind','Descending Fang'],
  akame:['Rising Night Raid','Crossing Murasame','Scarlet Descent'],
  pikachu:['Quick Attack','Tail Feint','Falling Iron Tail'],
  garou:['Flowing Redirection','Hunter Cross','Whirlwind Break'],
  esdeath:['Imperial Ascent','Cold Riposte','Execution Point'],
  mikasa:['Scout Reversal','Return Cut','Crossed Blades'],
  'alphonse-elric':['Armored Straight','Rising Steel','Armored Hammer'],
  'ken-kaneki':['Ghoul Knuckle','Rinkaku Reap','Fourfold Pierce'],
  grimmjow:["Panther Cross","Panther Reversal","Feral Rake"],
  byakuya:["Petal Cut","Senkei Cross","Senbonzakura Ender"],
  yamamoto:["Captain Cut","Ryujin Reversal","Ashen Divider"],
  pain:["Receiver Thrust","Almighty Push","Black Rod Verdict"],
  'edward-elric':["Automail Jab","Automail Backfist","Automail Heel"],
  hiei:["Rising Darkness","Reverse Shadow","Demon Crosscut"],
  aokiji:['Ice Saber','Frozen Heel','Glacial Cleave'],
  doflamingo:['Five Color Strings','Puppet Reversal','Sky String Heel'],
  hisoka:['Rising Joker','Falling Card','Elastic Breaker'],
  blackbeard:['Yami Jab','Dark Backfist','Emperor Heel'],
  nanami:['Seven Three Rise','Cross Ratio','Critical Cleave'],
  josuke:['Rising Heart','Diamond Hook','Morioh Breaker'],
  tsunade:['Rising Strength','Rib Breaker','Crushing Heel'],
  jiraiya:['Mountain Palm','Sannin Backhand','Rasengan Drive'],
  hinata:['Rising Gentle Palm','Tenketsu Backpalm','Eight Trigrams Sweep'],
  gintoki:['Rising Bokken','Sash Crosscut','Kabukicho Splitter'],
  kizaru:['Rising Ray','Photon Roundhouse','Flash Heel Drop'],
  yamato:['Takeru Sweep','Oni Backhand','Ogre Descent'],
  jinbe:['Sharkskin Rise','Tide Uppercut','Ocean Hammer'],
  enel:['Ascending Judgment','Staff Backcut','Thunder Downstroke'],
  yuta: ["Rising Resolve","Return Cut","Falling Resolve"],
  rukia: ["Snow Rising Cut","Snow Reverse Cut","White Moon Descent"],
  yuji:['Rising Soul','Liver Hook','Elbow Breaker'],
  todoroki:['Ice Fang','Frost Backfist','Flame Hammer'],
  endeavor:['Jet Uppercut','Flame Backfist','Fire Hammer'],
  yoruichi:['Rising Flash','Hakuda Elbow','Thunder Heel'],
  'all-might': ['Hero Uppercut', 'Hero Backfist', 'Aerial Hammer'],
  bakugo: ['Rising Detonation', 'Blast Cross', 'Aerial Detonation'],
  deku: ['Rising Smash', 'Cowling Cross', 'Shoot Style Aerial'],
  broly: ['Gigantic Rising Fist', 'Aerial Backfist', 'Gigantic Hammer'],
  denji: ['Rising Saw', 'Aerial Reverse Rake', 'Descending Crosscut'],
  akainu: ['Eruption Uppercut', 'Aerial Magma Backfist', 'Molten Descent'],
  mihawk: ['Rising Yoru', 'Aerial Backcut', 'Descending Black Blade'],
  'boa-hancock': ['Empress Rising Heel', 'Perfume Air Kick', 'Empress Heel Drop'],
  nami: ['Rising Clima-Tact', 'Aerial Staff Backcut', 'Descending Clima-Tact'],
  goku: ['Flying Kick', 'Afterimage Strike', 'Meteor Crash'],
  vegeta: ['Aerial Elbow', 'Galick Palm', 'Sledgehammer'],
  naruto: ['Uzumaki Strike', 'Rendan Knee', 'Naruto Rendan'],
  luffy: ['Gum-Gum Bullet', 'Gum-Gum Jet Pistol', 'Two-Fisted Slam'],
  sanji: ['Côtelette', 'Flanchet Shot', 'Party Table Kick Course'],
  kakashi: ['Flying Side Kick', 'Snap Kick', 'Somersault Kick'],
  sasuke: ['Aerial Slash', 'Falling Cut', 'Heel Drop'],
  zoro: ['Twin Blade Cut', 'Overhead Cross Cut', 'Leaping Cut'],
  jotaro: ['Jumping Hook', 'Star Breaker', 'Diving Straight'],
  ichigo: ['Aerial Cut', 'Backhand Cut', 'Overhead Cut'],
  ace: ['Leaping Punch', 'Hooking Punch', 'Diving Fist'],
  law: ['Jumping Cut', 'Kikoku Sweep', 'Kikoku Drop'],
  gojo: ['Flying Punch', 'High Kick', 'Diving Strike'],
  dio: ['Crushing Straight', 'Weak! Weak!', 'Muda Kick'],
  guts: ['Aerial Cleave', 'Rising Swing', 'Falling Chop'],
  killua: ['Whip Kick', 'Claw Swipe', 'Flip Kick'],
};
export function airRushName(fighter: FighterId, stage: number): string | undefined {
  const own = AIR_RUSH[fighter];
  return own ? own[stage] : AIR_RUSH_NAMES[stage];
}
const RUSH_TEMPLATE = [
  { duration: .42, contact: .16, stun: .24, knockback: 2, stamina: 4 },
  { duration: .45, contact: .17, stun: .24, knockback: 2, stamina: 4 },
  { duration: .58, contact: .22, stun: .45, knockback: 3, finisherKnockback: 9.5, stamina: 6, hitstop: HITSTOP.heavy },
] as const;
export type RushShape = 'launch' | 'juggle' | 'spike' | 'carry' | 'stagger' | 'spin';
const RUSH_SHAPES: Record<RushShape, readonly [Partial<MoveDefinition>, Partial<MoveDefinition>, Partial<MoveDefinition>]> = {
  launch: [{}, {}, { outcome: 'launch' }],
  juggle: [{}, { outcome: 'hop', lift: 3.4, knockback: 1 }, { outcome: 'hop', lift: 5.5, finisherKnockback: 4 }],
  spike: [{}, {}, { outcome: 'groundBounce', finisherKnockback: 2 }],
  carry: [{ knockback: 4.5 }, { knockback: 4.5 }, { outcome: 'wallBounce', lift: 4.6, finisherKnockback: 11 }],
  stagger: [{}, {}, { outcome: 'stagger', stun: .62, finisherKnockback: 2.5 }],
  spin: [{}, {}, { outcome: 'spin', stun: .6, finisherKnockback: 3.5 }],
};
export interface RushSpec {
  names: readonly [string, string, string];
  damage: readonly [number, number, number];
  tempo?: number;
  shape: RushShape;
  melee?: Pick<MoveDefinition, 'range' | 'radius' | 'lunge'>;
  stages?: readonly Partial<MoveDefinition>[];
}
const RUSH_SPECS: Record<FighterId, RushSpec> = {
  toji:{names:['Assassin Cut','Blindside Reversal','Predator Edge'],damage:[24,31,48],tempo:.95,shape:'carry'},
  crocodile:{"names":["Desert Girasole","Golden Hook","Desert Encierro"],"damage":[25,27,49],"tempo":1.02,"shape":"carry"},
  usopp:{"names":["Bamboo Javelin","Skull Bombgrass","Green Star Finish"],"damage":[22,26,43],"tempo":1,"shape":"stagger","stages":[{"duration":0.6,"cooldown":0.6,"contacts":[0.26],"style":"projectile","speed":34,"range":12,"lunge":0,"aimOnRelease":true},{"duration":0.7,"cooldown":0.7,"contacts":[0.32],"style":"projectile","speed":34,"range":12,"lunge":0,"aimOnRelease":true},{"duration":0.68,"cooldown":0.68,"contacts":[0.3],"style":"projectile","speed":34,"range":12,"lunge":0,"aimOnRelease":true}]},
  sakura:{names:["Chakra Straight","Bloom Backfist","Chakra Drive"],damage:[23,26,47],tempo:1,shape:'carry'},
  meliodas:{names:['Dragon Handle','Reverse Dragon','Full Counter Return'],damage:[25,27,48],tempo:1,shape:'carry'},
  escanor:{names:['Rhitta Sweep','Royal Reversal','Pride Divider'],damage:[27,29,50],tempo:1,shape:'carry'},
  tatsumaki:{names:['Psychic Flick','Vector Reversal','Pressure Crush'],damage:[24,27,47],tempo:1,shape:'carry'},
  makima:{names:['Directive','Come Here','Stay Down'],damage:[24,27,46],tempo:1,shape:'carry'},
  kenpachi:{names:['Jagged Cleave','Captain Reversal','Reckless Execution'],damage:[25,29,50],tempo:1,shape:'carry'},
  minato:{names:['Marked Kunai','Rising Spiral','Spiral Palm'],damage:[22,27,47],tempo:1,shape:'carry'},
  'nico-robin':{names:['Dos Fleur','Tres Fleur','Cuatro Fleur'],damage:[24,33,48],tempo:1,shape:'carry'},
  'kaiju-no-8':{names:['Reinforced Knuckle','Armored Hook','Fortitude Uppercut'],damage:[27,36,49],tempo:1,shape:'carry'},
  eren:EREN_RUSH,
  asuka:{names:['Progressive Edge','Cyclone Heel','Field Breach'],damage:[25,35,48],tempo:1,shape:'carry'},
  netero:{names:['Gratitude Palm','Prayer Reversal','Heart Elbow'],damage:[22,32,45],tempo:1,shape:'carry'},
  rengoku:{names:['Flame Reversal','Rising Ember','Blazing Divider'],damage:[26,33,47],tempo:1,shape:'carry'},
  shinji:{names:['Synchronized Impact','Axial Cross','Armored Hammer'],damage:[24,34,48],tempo:1,shape:'carry'},
  jolyne:{names:['String Knuckle','Thread Cross','Stone Breaker'],damage:[24,30,48],tempo:1,shape:'carry'},
  'might-guy':{names:['Leaf Straight','Youthful Backfist','Leaf Whirlwind'],damage:[24,34,48],tempo:1,shape:'carry'},
  akame:{names:['Murasame Cut','Crimson Reversal','Night Raid Pierce'],damage:[24,34,48],tempo:1,shape:'carry'},
  pikachu:{names:['Quick Attack','Spark Paw','Rising Spark'],damage:[22,30,43],tempo:1,shape:'carry'},
  garou:{names:['Water Stream','Rock Smashing Palm','Whirlwind Slash'],damage:[25,33,47],tempo:1,shape:'carry'},
  esdeath:{names:['Cold Riposte','Imperial Return','Execution Point'],damage:[25,32,46],tempo:1,shape:'carry'},
  mikasa:{names:['Vaulting Blade','Reverse Reap','Steel Scissor'],damage:[26,33,47],tempo:1,shape:'carry'},
  'alphonse-elric':{names:['Armored Straight','Steel Backhand','Iron Heel'],damage:[27,34,49],tempo:1,shape:'carry'},
  'ken-kaneki':{names:['Rinkaku Hook','Predator Cross','Fourfold Rend'],damage:[24,32,48],tempo:1,shape:'carry'},
  grimmjow:{names:['Rising Talon','Panther Reversal','Predator Breaker'],damage:[24,31,47],tempo:1,shape:'carry'},
  byakuya:{names:['Rising Senbonzakura','Crossing Petals','Petal Descent'],damage:[23,31,47],tempo:1,shape:'carry'},
  yamamoto:{names:['Nadegiri','Rising Ember','Ashen Divider'],damage:[25,32,49],tempo:1,shape:'carry'},
  pain:{names:['Black Receiver','Divine Rejection','Black Rod Verdict'],damage:[26,31,47],tempo:1,shape:'carry'},
  'edward-elric':{names:['Automail Jab','Steel Uppercut','Fullmetal Cleave'],damage:[27,31,49],tempo:1,shape:'carry'},
  hiei:{names:["Shadow Cut","Reverse Cut","Demon Slash"],damage:[23,26,47],tempo:1,shape:'carry'},
  aokiji:{names:['Saber Cut','Frozen Heel','Glacial Cleave'],damage:[24,26,48],tempo:1,shape:'carry'},
  doflamingo:{names:['Thread Rake','Puppet Cut','Heavenly Slash'],damage:[24,26,48],tempo:1,shape:'carry'},
  hisoka:{names:['First Suit','Joker Cut','Elastic Return'],damage:[24,26,48],tempo:1,shape:'carry'},
  blackbeard:{names:['Dark Jab','Quake Counter','Emperor Hammer'],damage:[24,26,48],tempo:1,shape:'carry'},
  nanami:{names:['Cross Ratio','Seven Three Rise','Critical Cleave'],damage:[24,26,48],tempo:1,shape:'carry'},
  josuke:{names:['Dora','Dora Dora','Diamond Hammer'],damage:[24,26,48],tempo:1,shape:'carry'},
  tsunade:{names:['Rib Breaker','Rising Strength','Crushing Heel'],damage:[23,25,48],tempo:1,shape:'carry'},
  jiraiya:{names:['Sannin Backhand','Mountain Palm','Rasengan Drive'],damage:[23,25,48],tempo:1,shape:'carry'},
  hinata:{names:['Rising Gentle Palm','Tenketsu Backpalm','Eight Trigrams Sweep'],damage:[21,23,44],tempo:.94,shape:'carry'},
  gintoki:{names:['Sash Crosscut','Rising Bokken','Kabukicho Splitter'],damage:[24,26,49],tempo:1,shape:'carry'},
  kizaru:{names:['Radiant Kick','Photon Roundhouse','Flash Heel Drop'],damage:[23,25,47],tempo:1,shape:'carry'},
  yamato:{names:['Oni Backhand','Rising Kanabo','Wano Crusher'],damage:[25,27,50],tempo:1.08,shape:'carry'},
  jinbe:{names:['Tide Uppercut','Sharkskin Rise','Ocean Hammer'],damage:[24,26,48],tempo:1.08,shape:'carry'},
  enel:{names:['Thunder Backcut','Rising Judgment','Staff Breaker'],damage:[23,25,47],tempo:1.02,shape:'carry'},
  yuta: {names:["Rising Resolve","Return Cut","Falling Resolve"],damage:[22,24,46],tempo:1,shape:'carry'},
  rukia: {names:["Snow Rising Cut","Snow Reverse Cut","White Moon Descent"],damage:[22,24,46],tempo:1,shape:'carry'},
  yuji:{names:['Divergent Cross','Rising Soul','Elbow Breaker'],damage:[22,24,46],tempo:.95,shape:'carry'},
  todoroki: { names: ['Frost Backfist','Ice Fang','Flame Hammer'], damage:[23,25,47],tempo:1,shape:'carry' },
  endeavor: { names: ['Flame Backfist','Jet Uppercut','Fire Hammer'],damage:[24,26,48],tempo:1.08,shape:'carry' },
  yoruichi: { names: ['Hakuda Elbow','Rising Flash','Thunder Heel'],damage:[22,24,46],tempo:.9,shape:'carry' },
  'all-might': { names: ['Hero Cross', 'Hero Uppercut', 'Double Hammer'], damage: [25, 27, 50], tempo: 1, shape: 'carry' },
  bakugo: { names: ['Blast Cross', 'Rising Detonation', 'Gauntlet Cannon'], damage: [23, 25, 48], tempo: 1, shape: 'carry' },
  deku: { names: ['Cowling Cross', 'Rising Smash', 'Manchester Smash'], damage: [22, 24, 46], tempo: .98, shape: 'carry' },
  broly: { names: ['Berserker Cross', 'Crushing Backfist', 'Gigantic Hammer'], damage: [24, 26, 48], tempo: 1.12, shape: 'carry' },
  denji: { names: ['Reverse Rake', 'Rising Saw', 'Crosscut Downstroke'], damage: [22, 24, 47], tempo: 1, shape: 'carry' },
  akainu: { names: ['Molten Hook', 'Magma Backfist', 'Eruption Hammer'], damage: [23, 25, 48], tempo: 1.08, shape: 'carry' },
  mihawk: { names: ['Yoru Return', 'Rising Black Blade', 'Yoru Downward Stroke'], damage: [21, 23, 47], tempo: 1.08, shape: 'carry' },
  'boa-hancock': { names: ['Perfume Sweep', 'Empress Reverse Heel', 'Empress Heel Drop'], damage: [20, 22, 45], tempo: 1.08, shape: 'carry' },
  nami: { names: ['Clima-Tact Backcut', 'Staff Whirl', 'Weather Downstroke'], damage: [20, 22, 44], tempo: 1.08, shape: 'carry' },
  goku: { names: ['Scissors', 'Paper', 'Meteor Smash'], damage: [17, 18, 49], tempo: .9, shape: 'launch' },
  vegeta: { names: ['Knee Strike', 'Elbow Drop', 'Double Axe Handle'], damage: [19, 21, 45], tempo: 1.05, shape: 'spike' },
  naruto: { names: ['Shadow Clone Jab', 'Clone Uppercut', 'U-Zu-Ma-Ki!'], damage: [17, 18, 54], tempo: .95, shape: 'launch' },
  sasuke: { names: ['Kusanagi Thrust', 'Dancing Leaf Shadow', 'Lion Combo'], damage: [18, 20, 43], tempo: .92, shape: 'spike' },
  kakashi: { names: ['Kunai Slash', 'Leaf Hurricane', 'Lightning Kick'], damage: [17, 19, 45], tempo: .92, shape: 'stagger' },
  luffy: { names: ['Gum-Gum Whip', 'Gum-Gum Stamp', 'Gum-Gum Rifle'], damage: [17, 19, 44], tempo: .95, shape: 'carry' },
  zoro: { names: ['Tora Gari', 'Toro Nagashi', 'Tatsu Maki'], damage: [20, 22, 46], shape: 'carry' },
  sanji: { names: ['Épaule', 'Poitrine', 'Anti-Manner Kick'], damage: [16, 17, 38], tempo: .84, shape: 'juggle' },
  jotaro: { names: ['Ora!', 'Ora Ora!', 'Oraaa!'], damage: [23, 25, 44], tempo: 1.12, shape: 'stagger' },
  ichigo: { names: ['Zangetsu Slash', 'Zangetsu Sweep', 'Point-Blank Getsuga'], damage: [20, 22, 44], tempo: 1.05, shape: 'carry' },
  ace: { names: ['Fire Fist Jab', 'Flame Kick', 'Jūjika'], damage: [19, 20, 43], shape: 'launch' },
  law: { names: ['Amputate', 'Radio Knife', 'Tact'], damage: [19, 21, 43], shape: 'juggle' },
  gojo: { names: ['Cursed Jab', 'Cursed Kick', 'Reversal: Red'], damage: [19, 20, 41], shape: 'carry' },
  dio: { names: ['Muda!', 'Muda Muda!', 'WRYYY!'], damage: [18, 20, 37], tempo: .92, shape: 'spin' },
  guts: { names: ['Backhand Cleave', 'Rising Hew', 'Great Smash'], damage: [27, 30, 52], tempo: 1.25, shape: 'spike' },
  killua: { names: ['Claw Slash', 'Rhythm Echo', 'Lightning Palm'], damage: [15, 16, 36], tempo: .8, shape: 'juggle' },
  kaido: { names: ['Club Backswing', 'Gourd Bash', 'Kanabo Slam'], damage: [26, 29, 50], tempo: 1.2, shape: 'spike' },
  whitebeard: { names: ['Bisento Sweep', 'Rising Cut', 'Quake Palm'], damage: [26, 29, 50], tempo: 1.2, shape: 'carry' },
  shanks: { names: ['Haki Cut', 'Cloak Turn', 'Gryphon Rise'], damage: [19, 21, 43], shape: 'launch' },
  roger: { names: ['Haki Cleave', 'Ace Return', 'Pirate Gale'], damage: [20, 22, 44], shape: 'launch' },
  aizen: { names: ['Reiatsu Turn', 'Flash Step', 'Hōgyoku Rise'], damage: [18, 20, 41], shape: 'juggle' },
  sukuna: { names: ['Curse Slash', 'Curse Claw', 'Curse Rise'], damage: [19, 21, 42], shape: 'launch' },
  griffith: { names: ['Hawk Slash', 'Backcut', 'Rising Wing'], damage: [18, 20, 41], tempo: .95, shape: 'juggle' },
  meruem: { names: ['Royal Jab', 'Hook Kick', 'Rising Talon'], damage: [18, 20, 42], tempo: .9, shape: 'stagger' },
  'goku-black': { names: ['Black Rush', 'Black Spin Kick', 'Black Smash'], damage: [18, 20, 42], tempo: .9, shape: 'launch' },
  jiren: { names: ['Pride Hook', 'Justice Flurry', 'Crushing Heel'], damage: [20, 22, 44], tempo: 1.05, shape: 'spike' },
  'golden-frieza': { names: ['Tail Swipe', 'Piercing Finger', 'Tail Sweep'], damage: [17, 19, 40], tempo: .9, shape: 'carry' },
  'gohan-beast': { names: ['Beast Jab', 'Flying Kick', 'Hammer Drop'], damage: [18, 20, 42], tempo: .95, shape: 'spike' },
  saitama: { names: ['Normal Jab', 'Normal Hook', 'Normal Kick'], damage: [19, 21, 42], tempo: 1, shape: 'carry' },
  akaza: { names: ['Destructive Jab', 'Flash Kick', 'Crown Splitter'], damage: [18, 20, 42], tempo: .9, shape: 'spike' },
  itachi: { names: ['Kunai Cut', 'Shadow Kick', 'Crow Rise'], damage: [17, 19, 41], tempo: .92, shape: 'launch' },
  madara: { names: ['Uchiha Jab', 'Uchiha Kick', 'Uchiha Rise'], damage: [18, 20, 42], tempo: .92, shape: 'launch' },
  tanjiro: { names: ['Water Cut', 'Water Chop', 'Rising Slash'], damage: [17, 20, 42], tempo: .95, shape: 'launch' },
  levi: { names: ['Blade Backcut', 'Blade Kick', 'Rising Blade'], damage: [18, 19, 42], tempo: 1, shape: 'launch' },
  'sung-jinwoo': { names: ['Shadow Cut', 'Shadow Kick', 'Shadow Rise'], damage: [18, 20, 41], tempo: .95, shape: 'launch' },
  gon: { names: ['Rock Jab', 'Hunter Kick', 'Rising Rock'], damage: [18, 20, 41], tempo: .95, shape: 'launch' },
};
export const RUSH_SHAPE: Record<FighterId, RushShape> =
  Object.fromEntries(Object.entries(RUSH_SPECS).map(([fighter, spec]) => [fighter, spec.shape])) as Record<FighterId, RushShape>;
const hundredths = (value: number) => Math.round(value * 100) / 100;
export function rushStagesOf(spec: RushSpec, light: MoveDefinition): readonly MoveDefinition[] {
  const tempo = spec.tempo ?? 1;
  return RUSH_TEMPLATE.map((stage, i): MoveDefinition => ({
    name: spec.names[i], duration: hundredths(stage.duration * tempo), contacts: [hundredths(stage.contact * tempo)],
    damage: spec.damage[i], range: spec.melee?.range ?? light.range, radius: spec.melee?.radius ?? light.radius,
    stamina: stage.stamina,
    cooldown: hundredths(stage.duration * tempo), stun: stage.stun, knockback: stage.knockback,
    ...('finisherKnockback' in stage ? { finisherKnockback: stage.finisherKnockback, hitstop: stage.hitstop } : {}),
    lunge: spec.melee ? spec.melee.lunge : light.lunge, style: 'melee',
    ...(light.reach !== undefined && !spec.melee ? { reach: light.reach } : {}),
    ...RUSH_SHAPES[spec.shape][i],
    ...spec.stages?.[i],
  }));
}
const rushStages = (fighter: FighterId) => rushStagesOf(RUSH_SPECS[fighter], MOVES[fighter].light);
export const RUSH: Record<FighterId, readonly MoveDefinition[]> =
  Object.fromEntries((Object.keys(MOVES) as FighterId[]).map(fighter => [fighter, rushStages(fighter)])) as Record<FighterId, readonly MoveDefinition[]>;

export const HOUSE_APPLIED: readonly string[] = applyHouseKits(MOVES, TIME_STOP_TOURS);

export const VANISH_ON_JUST_GUARD = true;
export const VANISH_BEHIND = 1.25;
export const VANISH_COOLDOWN = 1.5;
export const VANISH_EVADE = .2;
export const VANISH_STUMBLE = 2.5;
export const VANISH_AIM = .6;
export const CHASE_WINDOW = .7;
export const CHASE_SECONDS = .26;
export const CHASE_RANGE = 9;
export const CHASE_MAX_SPEED = 30;
export const CHASE_EXIT = 2;
export const LIGHT_CHASE_WINDOW = .5;
export const LAUNCH_HOLD_RANGE = 6;
export const CHARGE_BACKSTEP_UNTIL = .3;
export const CHARGE_DRIVE = .35;
export const CHARGE_SLIDE = .22;
export const DASH_THROUGH_LEAD = .15;
export const DASH_THROUGH_PAST = 1.4;
export const DASH_THROUGH_SIDE = .55;
export const DASH_THROUGH_REACH = 5;
export const DASH_THROUGH_MISS = 2.6;
export const DASH_THROUGH_MAX_SPEED = 30;
export const SPACING_PUSH = 6;
export const HARD_GAP = .9;
export const SCALING_STEP = .09, SCALING_FLOOR = .35;
export function damageScale(contact: number) {
  return Math.max(SCALING_FLOOR, 1 - (contact - 1) * SCALING_STEP);
}
export const STAMINA_OVERDRAW = true;
export const COMBO_STAMINA = 225;
export const STAMINA_REGEN = 32;
export const KO_HEAL = .2;
export const TECH_STAMINA = 15;
export const TECH_DELAY = .22;

export const AIR_CAST_GRAVITY = .45;
export const PLUNGE_HANG = .15, PLUNGE_LIMIT = 1.6, PLUNGE_BRAKE = 28, PLUNGE_SNAP = .06;
export const PLUNGE_IMPACT_DROP = 3;
export const LAUNCH_GRAVITY = .68;
export const LAUNCH_LEAD = 1.4;
export function launchLead(u: number) { const c = Math.min(1, Math.max(0, u)), r = 1 - c; return c * r * r * r; }
export const STRING_SHOVE = .62, STRING_DRAG = 14;
export const FALL_GRAVITY = 3.3;
export const JUMP_CUT_GRAVITY = 10, JUMP_CUT_AFTER = .07;
export const JUMP_RISE_GRAVITY = 2.3;
export const JUMP_HANG_SPEED = 1.8, JUMP_HANG_GRAVITY = 1;
export const JUMP_SCALE: Record<FighterId, number> = {
  toji:3.4,
  crocodile:3.0,
  usopp:3.2,
  rengoku:3.1,sakura:3.0,meliodas:3.05,escanor:2.75,tatsumaki:3.1,makima:3.0,kenpachi:2.7,minato:3.4,'nico-robin':3.1,'kaiju-no-8':2.8,eren:3.2,asuka:3.1,netero:3.3,shinji:3.1,jolyne:3.15,'might-guy':3.4,akame:3.2,pikachu:3.2,garou:3.2,esdeath:3.1,mikasa:3.2,'alphonse-elric':2.8,'ken-kaneki':3.15,grimmjow:3.1,byakuya:3.1,yamamoto:2.65,pain:2.95,'edward-elric':3.2,hiei:3.1,aokiji:2.95,doflamingo:3.15,hisoka:3.25,blackbeard:2.85,nanami:3.1,josuke:3.1,tsunade:3.0,jiraiya:3.0,hinata:3.25,gintoki:3.0,
  kizaru:3,yamato:2.8,
  jinbe:2.7,enel:3,
  yuta: 3.1,
  rukia: 3.1,
  yuji:3,
  todoroki: 3, endeavor: 2.7, yoruichi: 3.4,
  'all-might': 3.1,
  bakugo: 3.3,
  deku: 3.4,
  broly: 2.7,
  denji: 3,
  akainu: 3,
  mihawk: 2.9,
  'boa-hancock': 2.9,
  nami: 2.9,
  killua: 3.5, levi: 3.5, gon: 3.5,
  sanji: 3.4, naruto: 3.4, sasuke: 3.4, luffy: 3.4,
  kakashi: 3.3, akaza: 3.3, tanjiro: 3.3, 'sung-jinwoo': 3.3,
  goku: 3.1, ichigo: 3.1, griffith: 3.1, itachi: 3.1,
  vegeta: 3, zoro: 3, ace: 3, shanks: 3, gojo: 3, dio: 3, 'goku-black': 3, 'golden-frieza': 3, 'gohan-beast': 3, saitama: 3,
  law: 2.9, roger: 2.9,
  jotaro: 2.8,
  sukuna: 2.75, aizen: 2.75, meruem: 2.7, madara: 2.7, guts: 2.6, jiren: 2.6, kaido: 2.5, whitebeard: 2.5,
};
export function jumpGravity(vy: number, cut: boolean) {
  return cut && vy > 0 ? JUMP_CUT_GRAVITY : Math.abs(vy) <= JUMP_HANG_SPEED ? JUMP_HANG_GRAVITY : vy > 0 ? JUMP_RISE_GRAVITY : FALL_GRAVITY;
}
function flight(speed: number, gravity: (vy: number) => number) {
  const dt = 1 / 60;
  let vy = speed, y = 0, apex = 0, ticks = 0, top = 0;
  while (ticks < 600) {
    vy -= 23 * dt * gravity(vy); y += vy * dt; ticks++;
    if (y > apex) { apex = y; top = ticks; }
    if (vy <= 0 && y <= .03) break;
  }
  return { apex, ticks, top };
}
const BEFORE = flight(8.8, vy => vy < 0 ? 1.7 : 1);
export const JUMP_BEFORE = { apex: BEFORE.apex, air: BEFORE.ticks / 60, carry: 7.5 * BEFORE.ticks / 60 };
const arcs = new Map<FighterId, { speed: number; leap: number; apex: number; air: number; rise: number }>();
export function jumpArc(fighter: FighterId) {
  let arc = arcs.get(fighter);
  if (!arc) {
    const scale = JUMP_SCALE[fighter] ?? 3, apex = scale * JUMP_BEFORE.apex;
    let lo = 8.8, hi = 60;
    for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (flight(mid, vy => jumpGravity(vy, false)).apex < apex) lo = mid; else hi = mid; }
    const own = flight(hi, vy => jumpGravity(vy, false)), air = own.ticks / 60;
    arc = { speed: hi, leap: scale * JUMP_BEFORE.carry / (7.5 * air), apex: own.apex, air, rise: own.top / 60 };
    arcs.set(fighter, arc);
  }
  return arc;
}
export const LEAP_GROUNDED = .3, JUMP_LAND_RECOVERY = .1, JUMP_LAND_HARD = 21;
export const AIR_CAST_RISE = 4;
export const AIR_CAST_BRAKE = 30;
export const AIR_STRIKE_REACH = 8, AIR_STRIKE_SPEED = 28;
export const AIR_STRIKE_BLIND: readonly [number, number] = [6, 11];
export const AIR_HOME_DROP = 12;
export const JUGGLE_LIFT = 6.2;
export const JUGGLE_DECAY = .24;
export const MAX_JUGGLE = 4;
export const DASH_SECONDS = .22;
export const DASH_RISE = .24, DASH_FALL = .32;
export const DASH_PEAK = 1 / (1 - (DASH_RISE + DASH_FALL) / 2);
export const DASH_BURST = DASH_RISE + (1 - DASH_RISE - DASH_FALL) * .35;
export function dashShape(through: number) {
  const u = Math.max(0, Math.min(1, through));
  if (u < DASH_RISE) return DASH_PEAK * (u / DASH_RISE);
  if (u > 1 - DASH_FALL) return DASH_PEAK * ((1 - u) / DASH_FALL);
  return DASH_PEAK;
}

export type DashKind = 'forward' | 'back' | 'side';
export const DASH_EVADE = .13;
export const BACKDASH_SECONDS = .16, BACKDASH_TRAVEL = 3.2, BACKDASH_EVADE = .12, BACKDASH_ALONG = -.5;
export const SIDESTEP_SECONDS = .18, SIDESTEP_TRAVEL = 3.6, SIDESTEP_ALONG = .35;
export function dashPeakSpeed(seconds: number, travel: number, dt = 1 / SIMULATION_HZ) {
  let sum = 0;
  for (let k = 0; k * dt < seconds; k++) sum += dashShape(k * dt / seconds) * dt;
  return travel / sum;
}

export const AIR_DASH_SPEED = 21;
export const INPUT_BUFFER = .18;
export const AIR_NORMAL_FIGHTERS: FighterId[] = ['naruto', 'sanji', 'luffy', 'jotaro', 'vegeta', 'goku', 'dio'];
export const AIR_NORMALS: Partial<Record<AttackSlot, string>> = { light: 'Air Knee', heavy: 'Falling Kick' };

export const SIMULATION_HZ = 60;
export const SNAPSHOT_HZ = 30;
export const MAX_PLAYERS = 12;
export const MAX_HP = 1000;
export const COMBO_HP = 1500;
export const ULTIMATE_COST = 100;
export const ULTIMATE_PER_DAMAGE = .12;
export const AWAKENING_PER_DAMAGE = .14, AWAKENING_PER_BLOCKED = .05;
export const ARENA_HALF_EXTENT = 80;
export const PUSH_RADIUS = 0.55;
export const PLAYER_RADIUS = 0.45;
export const MIN_MATCH_FIELD = 6;
export const PLAYER_HEIGHT = 1.8;

export const ARENA_COLLIDERS = ENVIRONMENT_COLLIDERS;
