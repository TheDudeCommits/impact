import { KIZARU_AWAKENING } from './fighters/kizaru';
import { BOA_HANCOCK_AWAKENING } from './fighters/boa-hancock';
import { EREN_TITAN_AREA, EREN_TITAN_AREA_LOOK, EREN_TITAN_MOVES, EREN_TITAN_RUSH } from './fighters/eren';
import { MOVES, RUSH, RUSH_STAGES, rushStagesOf, type MoveDefinition } from './moves';
import { AREA_BY_ELEMENT, areaMoveFrom } from '../engine/sim/areaMoves';
import type { AttackSlot, FighterId } from './types';

export const AWAKENING_COST = 100;
export const AWAKENING_SECONDS = 18;
export const AWAKENING_ENTRY = 0.9;
export const AWAKENING_SWAP = 0.34;
export function awakeningSwapAt(fighter: FighterId) { return AWAKENINGS[fighter].swapAt ?? AWAKENING_SWAP; }
export const AWAKENED_DAMAGE = 1.3;
export const AWAKENED_RESIST = 0.8;
export const AWAKENED_SPEED = 1.15;

export interface AwakeningDefinition {
  name: string;
  aura: readonly [number, number];
  kind: 'form' | 'summon' | 'stand' | 'aura';
  hair?: number;
  baseHair?: number;
  flames?: boolean;
  auraGlow?: number;
  formScale?: number;
  formTint?: number;
  formOpacity?: number;
  formForward?: number;
  clips?: readonly string[];
  swapAt?: number;
}

const define = (a: AwakeningDefinition) => a;

export const AWAKENINGS: Record<FighterId, AwakeningDefinition> = {
  toji:define({name:'HEAVENLY RESTRICTION',kind:'aura',aura:[0xc6cec8,0x707870],auraGlow:0,flames:false,clips:['Heavenly Restriction'],swapAt:.40}),
  crocodile:define({"name":"DESERT SOVEREIGN","kind":"aura","aura":[15324064,13212501],"auraGlow":0.1,"clips":["Desert Sovereign"],"swapAt":0.46}),
  usopp:define({"name":"OBSERVATION HAKI","kind":"aura","aura":[15138768,9027394],"auraGlow":0.12,"clips":["Observation Haki"],"swapAt":0.47}),
  sakura:define({"name":"STRENGTH OF A HUNDRED","kind":"form","aura":[16761311,15964099],"auraGlow":0.1,"clips":["Strength of a Hundred"],"swapAt":0.504}),
  meliodas:define({"name":"ASSAULT MODE","kind":"form","aura":[7680950,1510441],"auraGlow":0.1,"clips":["The Dragon Awakens"],"swapAt":0.5}),
  escanor:define({"name":"HIGH NOON","kind":"form","aura":[16759363,16774350],"auraGlow":0.1,"clips":["High Noon"],"swapAt":0.4}),
  tatsumaki:define({name:'UNRESTRAINED ESPER',kind:'aura',aura:[0x5dffac,0xeaffef],auraGlow:.08,clips:['Unrestrained Esper'],swapAt:.55}),
  makima:define({name:'CONTROL DEVIL',kind:'aura',aura:[0xd69b47,0x782822],auraGlow:.08,clips:['The Control Devil'],swapAt:.567}),
  kenpachi:define({"name":"UNSEALED REIATSU","kind":"form","aura":[16760103,2299659],"auraGlow":0.1,"clips":["Unsealed Reiatsu"],"swapAt":0.69}),
  minato:define({"name":"SAGE STILLNESS","kind":"form","aura":[16764745,7809023],"auraGlow":0.1,"clips":["Sage Stillness"],"swapAt":0.522}),
  'nico-robin':define({name:'GIGANTE FLEUR',kind:'aura',aura:[0xf2aad2,0x815a64],auraGlow:.09,clips:['Gigante Fleur'],swapAt:.486}),
  'kaiju-no-8':define({name:'FORTITUDE 9.8',kind:'aura',aura:[0x57d7bd,0xbbffe5],auraGlow:.04,clips:['Full Power Release'],swapAt:.513}),
  eren:define({name:'ATTACK TITAN',kind:'form',aura:[0xffe2a1,0x45896e],auraGlow:.04,clips:['Freedom Awakens','Attack Titan Emergence'],swapAt:.594}),
  asuka:define({name:'SOUL SYNCHRONIZATION',kind:'form',aura:[16751152,15739698],auraGlow:.025,clips:['Soul Synchronization'],swapAt:.432}),
  netero:define({name:'PRAYER BEYOND SOUND',kind:'aura',aura:[16768893,15313723],auraGlow:.08,clips:['Prayer Beyond Sound'],swapAt:.585}),
  rengoku:define({name:'SET YOUR HEART ABLAZE',kind:'aura',aura:[0xffb441,0xe84b26],auraGlow:.08,clips:['Set Your Heart Ablaze'],swapAt:.9*73/108}),
  shinji:define({name:'BERSERK RELEASE',kind:'aura',aura:[16752955,8993741],auraGlow:.09,clips:['Berserk Release'],swapAt:.576}),
  jolyne:define({name:'UNBOUND RESOLVE',kind:'stand',aura:[8969118,7330525],auraGlow:.08,clips:['Unbound Resolve'],swapAt:.576,formScale:1}),
  'might-guy':define({name:'GATE OF DEATH',kind:'form',aura:[0xffb4a0,0xe73a3e],auraGlow:.06,clips:['Gate of Death'],swapAt:.558}),
  akame:define({name:'LITTLE WAR HORN',kind:'form',aura:[0xdd2949,0x220b20],auraGlow:.04,clips:['Little War Horn'],swapAt:.513}),
  pikachu:define({name:'THUNDER CHARGE',kind:'aura',aura:[0xfffee8,0xf5cf2a],auraGlow:.06,clips:['Thunder Charge'],swapAt:.567}),
  garou:define({name:'COSMIC FEAR',kind:'form',aura:[0x8e87ff,0x2696ec],auraGlow:.08,clips:['Cosmic Fear'],swapAt:.549}),
  esdeath:define({name:"DEMON'S EXTRACT",kind:'aura',aura:[0x9fe5ff,0x326da7],auraGlow:.08,clips:["Demon's Extract"],swapAt:.684}),
  mikasa:define({name:'ACKERMAN RESOLVE',kind:'aura',aura:[0xd6e1e8,0xbd3544],auraGlow:.03,clips:['Ackerman Resolve'],swapAt:.594}),
  'alphonse-elric':define({name:'SOULBOUND PROMISE',kind:'aura',aura:[0x78d9e8,0x314853],auraGlow:.07,clips:['Soulbound Promise'],swapAt:.63}),
  'ken-kaneki':define({name:'KAKUGAN UNBOUND',kind:'form',aura:[0xbc2456,0x140d18],auraGlow:.08,clips:['Kakugan Unbound'],swapAt:.423}),
  grimmjow:define({"name":"PANTERA","kind":"form","aura":[5298687,1342397],"auraGlow":0.1,"clips":["Pantera Release"],"swapAt":0.657}),
  byakuya:define({name:'SENBONZAKURA KAGEYOSHI',kind:'aura',aura:[0xf794ca,0xffdbea],auraGlow:.08,clips:['Senbonzakura Kageyoshi'],swapAt:.504}),
  yamamoto:define({name:'ZANKA NO TACHI',kind:'aura',aura:[0xffb14b,0x341c13],auraGlow:.06,clips:['Zanka no Tachi'],swapAt:.576}),
  pain:define({name:'DEVA PATH ASCENDANT',kind:'aura',aura:[0xab8fd4,0x302139],auraGlow:.1,clips:['Deva Path Ascendant'],swapAt:.54}),
  'edward-elric':define({name:'FULLMETAL RESOLVE',kind:'aura',aura:[0x62cfff,0xe8fbff],auraGlow:.08,clips:['Fullmetal Resolve'],swapAt:.63}),
  hiei:define({"name":"JAGAN: DRAGON ABSORPTION","kind":"form","aura":[9063886,1511971],"auraGlow":0.1,"clips":["Dragon Absorption"],"swapAt":0.549}),
  aokiji:define({name:'COLD JUSTICE',kind:'aura',aura:[0x83c7e7,0xe9faff],auraGlow:.06,clips:['Cold Justice'],swapAt:.58}),
  doflamingo:define({name:'EVER WHITE',kind:'aura',aura:[0xfffaf1,0xf074ad],auraGlow:.07,clips:['Ever White'],swapAt:.55}),
  hisoka:define({"name":"MAGICIAN\u2019S MALICE","kind":"aura","aura":[15692487,16767474],"auraGlow":0.08,"clips":["Magicians Malice"],"swapAt":0.62}),
  blackbeard:define({name:"EMPEROR'S AMBITION",kind:'aura',aura:[0xb074e5,0x89c9e0],auraGlow:.09,clips:['Emperor Ambition'],swapAt:.55}),
  nanami:define({name:'OVERTIME',kind:'aura',aura:[0xc8e998,0x78c6b0],auraGlow:.08,clips:['Overtime Release'],swapAt:.378}),
  josuke:define({"name":"UNBREAKABLE TEMPER","kind":"stand","aura":[15763125,8445170],"auraGlow":0.1,"formScale":1.15,"clips":["Unbreakable Temper"],"swapAt":0.62}),
  tsunade:define({"name":"HUNDRED HEALINGS","kind":"form","aura":[15466487,6549427],"auraGlow":0.1,"clips":["Hundred Healings"],"swapAt":0.504}),
  jiraiya:define({"name":"MOUNT MYOBOKU SAGE","kind":"form","aura":[10075800,16301691],"auraGlow":0.08,"clips":["Mount Myoboku Sage"],"swapAt":0.576}),
  hinata:define({name:'TWIN LION FISTS',kind:'aura',aura:[0xdbeeff,0xbaa9f0],auraGlow:.12,clips:['Twin Lion Release'],swapAt:.63}),
  gintoki:define({"name":"WHITE YAKSHA RESOLVE","kind":"aura","aura":[10340333,15988991],"auraGlow":0.1,"clips":["White Yaksha Resolve"],"swapAt":0.62}),
  kizaru:define(KIZARU_AWAKENING),
  yamato:define({name:'ONI RESOLVE',kind:'aura',aura:[0xf5edff,0xc9adeb],auraGlow:.13,clips:['Oni Resolve'],swapAt:.55}),
  jinbe:define({name:'HEART OF THE SEA',kind:'aura',aura:[0xe8fdff,0x42c4df],auraGlow:.12,clips:['Heart of the Sea'],swapAt:.46}),
  enel:define({"name":"MANTRA ASCENDANT","kind":"aura","aura":[7395839,16766809],"auraGlow":0.12,"clips":["Mantra Ascendant"],"swapAt":0.54}),
  rukia: define({"name":"HAKKA NO TOGAME","kind":"form","aura":[15925247,6932456],"auraGlow":0.1,"clips":["Hakka no Togame"],"swapAt":0.585}),
  yuta: define({"name":"QUEEN OF CURSES","kind":"aura","aura":[16050687,7559846],"auraGlow":0.13,"clips":["Ring Pact"],"swapAt":0.504}),
  yuji:define({"name": "AWAKENED SOUL", "kind": "aura", "aura": [15721960, 14357301], "auraGlow": 0.12, "clips": ["Soul Resolve"], "swapAt": 0.58}),
  todoroki: define({name:'PHOSPHOR',kind:'aura',aura:[0xe4ffff,0x58d9f3],auraGlow:.16,clips:['Phosphor'],swapAt:.585}),
  endeavor: define({name:'FLASHFIRE',kind:'aura',aura:[0xfff1b5,0xff6b22],auraGlow:.18,clips:['Flashfire Ignition'],swapAt:.522}),
  yoruichi: define({name:'SHUNKO',kind:'aura',aura:[0xf4eaff,0xa663ee],auraGlow:.18,clips:['Shunko Release'],swapAt:.486}),
  'all-might': define({ name: 'ONE FOR ALL: EMBERS', kind: 'aura', aura: [0xfffbee, 0xf6c65a], auraGlow: .1, clips: ['One For All'], swapAt: .54 }),
  bakugo: define({ name: 'CLUSTER', kind: 'aura', aura: [0xfff6d8, 0xff791e], auraGlow: .1, clips: ['Cluster Ignition'], swapAt: .549 }),
  deku: define({ name: 'VIGILANTE: FULL COWLING', kind: 'form', aura: [0xe7fff3, 0x32db99], auraGlow: .14, formScale: 1.84/1.78, clips: ['Vigilante Resolve'], swapAt: .504 }),
  broly: define({ name: 'FULL POWER SUPER SAIYAN', kind: 'form', aura: [0xe4ff8b, 0x67d92d], auraGlow: .2, formScale: 2.26/2.1, clips: ['Unbound Fury'], swapAt: .477 }),
  denji: define({ name: 'RIPCORD OVERDRIVE', kind: 'aura', aura: [0xffefd0, 0xffa847], auraGlow: .15, clips: ['Ripcord Awakening'], swapAt: .63 }),
  akainu: define({ name: 'ABSOLUTE JUSTICE', kind: 'aura', aura: [0xffdb90, 0xdd3c17], auraGlow: .2, clips: ['Absolute Justice'], swapAt: .35 }),
  mihawk: define({ name: 'HAWK EYE FOCUS', kind: 'aura', aura: [0xeaf5cf, 0x73a56d], auraGlow: .35, clips: ['Hawk-Eye Focus'] }),
  'boa-hancock': define(BOA_HANCOCK_AWAKENING),
  nami: define({ name: 'WEATHERIA: WEATHER MASTERY', kind: 'aura', aura: [0xd6f6ff, 0x54bde8], auraGlow: .25, clips: ['Weatheria Awakening'], swapAt: .65 }),
  goku: define({ name: 'SUPER SAIYAN', kind: 'aura', aura: [0xffe37a, 0xffa227], hair: 0xffd23d,
    flames: true, clips: ['awaken-powerup', 'spirit-bomb', 'goku-ready', '02-STANCE'] }),
  vegeta: define({ name: 'SUPER SAIYAN', kind: 'aura', aura: [0xffe37a, 0xff8c1f], hair: 0xffcf3a,
    flames: true, clips: ['awaken-powerup', 'Galick Gun', '_Idle'] }),
  naruto: define({ name: 'KURAMA', kind: 'form', aura: [0xffd873, 0xff7d1c], formScale: 1.8, formForward: -3.2,
    clips: ['Rasengan charge', 'Naruto pose', '_Idle'] }),
  luffy: define({ name: 'GEAR 5', kind: 'form', aura: [0xffffff, 0xcfd6ff], formScale: 1.08,
    clips: ['flagget_lp', 'flagget', '_Idle'] }),
  ichigo: define({ name: 'FINAL GETSUGA', kind: 'form', aura: [0x9b6ad6, 0x1a1026], formScale: 1.06,
    clips: ['stay_show', 'Block', '_Idle'], swapAt: AWAKENING_ENTRY * .82 }),
  zoro: define({ name: 'ASURA', kind: 'form', aura: [0x9cf07c, 0x11361a], formScale: 1.06,
    clips: ['opening', 'flagget', '_Idle'] }),
  sanji: define({ name: 'IFRIT JAMBE', kind: 'aura', aura: [0x7fc8ff, 0x1b4fd0],
    clips: ['opening', 'flagget', '_Idle'] }),
  sasuke: define({ name: 'SUSANOO', kind: 'summon', aura: [0xb469ff, 0x4a1a86],
    formScale: 4.2, formTint: 0x8a3ce0, formOpacity: .42,
    clips: ['Indras Arrow', 'Amaterasu', '_Idle'] }),
  kakashi: define({ name: 'SUSANOO', kind: 'summon', aura: [0x6ad4ff, 0x123f7a],
    formScale: 4.2, formTint: 0x2f8ae0, formOpacity: .42,
    clips: ['Lightning Blade', 'Kamui Lightning Blade', '_Idle'] }),
  jotaro: define({ name: 'THE WORLD', kind: 'stand', aura: [0xd0a6ff, 0x2a1440], formScale: 1.5,
    clips: ['The World', '_Idle'] }),
  ace: define({ name: 'FLAME EMPEROR', kind: 'aura', aura: [0xffb347, 0xff3d00],
    flames: true, clips: ['opening', 'flagget', '_Idle'] }),
  law: define({ name: 'AWAKENED ROOM', kind: 'aura', aura: [0x7fe0ff, 0x1a3fa0],
    clips: ['opening', 'flagget', '_Idle'] }),
  gojo: define({ name: 'SIX EYES', kind: 'aura', aura: [0x9fe8ff, 0x2a5fd0],
    clips: ['_Idle'] }),
  dio: define({ name: 'ZA WARUDO', kind: 'stand', aura: [0xffe27a, 0x8a5a10], formScale: 1.5,
    clips: ['Za Warudo', '_Idle'] }),
  guts: define({ name: 'BERSERKER ARMOR', kind: 'form', aura: [0xff2a2a, 0x2b0000], formScale: 1.02,
    clips: ['Berserker Rampage', '_Idle'] }),
  killua: define({ name: 'GODSPEED', kind: 'aura', aura: [0xbfe6ff, 0x3a6fff],
    clips: ['_Idle'] }),
  kaido: define({ name: 'MAN BEAST FORM', kind: 'form', aura: [0xc39bff, 0x3a0d6e], formScale: 1.1,
    clips: ['awaken-roar', '_Idle'] }),
  whitebeard: define({ name: 'GURA GURA NO MI', kind: 'aura', aura: [0xa8d8ff, 0x2a6ad8],
    flames: true, auraGlow: .3, clips: ['awaken-quake', '_Idle'] }),
  shanks: define({ name: 'HAOSHOKU HAKI', kind: 'aura', aura: [0xff2a3a, 0x1a0006],
    flames: true, auraGlow: .3, clips: ['awaken-haki', '_Idle'] }),
  roger: define({ name: 'KING OF THE PIRATES', kind: 'aura', aura: [0xffb020, 0x140800],
    flames: true, auraGlow: .3, clips: ['awaken-ace', '_Idle'] }),
  aizen: define({ name: 'THE HOGYOKU', kind: 'form', aura: [0xb070ff, 0x24083f], formScale: 1.08,
    clips: ['awaken-hogyoku', '_Idle'] }),
  sukuna: define({ name: 'KING OF CURSES', kind: 'form', aura: [0xff2a3a, 0x1c0204], formScale: 1.24,
    clips: ['awaken-shrine', '_Idle'] }),
  griffith: define({ name: 'FEMTO · WING OF DARKNESS', kind: 'form', aura: [0xe8e0ff, 0x4a2a8a], formScale: 1.1,
    clips: ['awaken-femto', '_Idle'] }),
  meruem: define({ name: 'THE KING · REBORN', kind: 'aura', aura: [0x7affa8, 0x1ab866],
    flames: true, auraGlow: .3, clips: ['awaken-king', '_Idle'] }),
  'goku-black': define({ name: 'SUPER SAIYAN ROSE', kind: 'aura', aura: [0xff6ad8, 0xc8208c], hair: 0xff6ad8,
    flames: true, auraGlow: .3, clips: ['awaken-rose', '_Idle'] }),
  jiren: define({ name: 'FULL POWER', kind: 'aura', aura: [0xff5a3a, 0xc8101e],
    flames: true, auraGlow: .3, clips: ['awaken-full-power', '_Idle'] }),
  'golden-frieza': define({ name: 'BLACK FRIEZA', kind: 'form', aura: [0xf0d4ff, 0x7a2bd8], formScale: 1,
    clips: ['awaken-golden', '_Idle'] }),
  'gohan-beast': define({ name: 'BEAST', kind: 'aura', aura: [0xc8a0ff, 0xc23a7a], baseHair: 0x1a1d2a,
    flames: true, auraGlow: .3, clips: ['awaken-beast', '_Idle'] }),
  saitama: define({ name: 'SERIOUS MODE', kind: 'aura', aura: [0xffd060, 0xe8402a],
    flames: true, auraGlow: .3, clips: ['awaken-serious', '_Idle'] }),
  akaza: define({ name: 'UPPER MOON THREE', kind: 'aura', aura: [0x6a9cff, 0x1a3a9a],
    flames: true, auraGlow: .3, clips: ['awaken-upper-moon', '_Idle'] }),
  itachi: define({ name: 'SUSANOO', kind: 'summon', aura: [0xffe6dc, 0xe8442a],
    formScale: 4.2, formTint: 0xe8502a, formOpacity: .42,
    clips: ['awaken-susanoo', '_Idle'] }),
  madara: define({ name: 'PERFECT SUSANOO', kind: 'summon', aura: [0xd8ecff, 0x2a6ae8],
    formScale: 4.2, formTint: 0x2a62f0, formOpacity: .42,
    clips: ['awaken-susanoo', '_Idle'] }),
  tanjiro: define({ name: 'SUN BREATHING', kind: 'aura', aura: [0xffa040, 0xff4a10],
    flames: true, auraGlow: .3, clips: ['awaken-sun', '_Idle'] }),
  levi: define({ name: 'STRONGEST SOLDIER', kind: 'aura', aura: [0x5ae89a, 0x0e4a2a],
    flames: true, auraGlow: .3, clips: ['awaken-captain', '_Idle'] }),
  'sung-jinwoo': define({ name: 'SHADOW MONARCH', kind: 'form', aura: [0xeee2ff, 0x6a3df0], formScale: 1.12,
    clips: ['awaken-monarch', '_Idle'] }),
  gon: define({ name: 'ADULT GON', kind: 'form', aura: [0xffc83a, 0xe08a0c], formScale: 2.0, flames: true, auraGlow: .3,
    clips: ['awaken-adult', '_Idle'] }),
};

const whole = (base: MoveDefinition, own: MoveDefinition): Partial<MoveDefinition> => ({ ...Object.fromEntries(Object.keys(base).map(key => [key, undefined])), ...own });
const TITAN_AREA = areaMoveFrom(AREA_BY_ELEMENT[EREN_TITAN_AREA.element], EREN_TITAN_AREA as Parameters<typeof areaMoveFrom>[1], EREN_TITAN_AREA_LOOK);
const TITAN: Partial<Record<AttackSlot, Partial<MoveDefinition>>> = {
  light: whole(MOVES.eren.light, EREN_TITAN_MOVES.light), heavy: whole(MOVES.eren.heavy, EREN_TITAN_MOVES.heavy),
  special: whole(MOVES.eren.special, EREN_TITAN_MOVES.special), ultimate: whole(MOVES.eren.ultimate, EREN_TITAN_MOVES.ultimate),
  area: whole(MOVES.eren.area, TITAN_AREA),
};
export const AWAKENED_MOVES: Partial<Record<FighterId, Partial<Record<AttackSlot, Partial<MoveDefinition>>>>> = {
  eren: TITAN,
  naruto:{
    light:{name:'Kurama Claw Barrage'},
    heavy:{name:'Crushing Fang',duration:.78,contacts:[.37],cooldown:1.1,lunge:8,lungeDelay:0,chargeIn:undefined,palmHold:undefined,lockAim:undefined},
    special:{name:'Tailed Beast Blast'},
    ultimate:{name:'Tailed Beast Bomb'},
  },
  luffy:{
    special:{name:'Gum-Gum Dawn Gatling',radius:1.3},
  },
  jotaro: {
    ultimate: {
      duration: 4.2, contacts: [.58, 1, 1.15, 1.3, 1.45, 1.6, 1.75, 1.9, 2.05, 2.2, 2.35, 2.5, 2.65, 2.8, 2.95, 3.3],
      damage: 34, finisherDamage: 216, stun: .2, finisherStun: 2.3,
      knockback: 2, finisherKnockback: 18,
      timeStop: { contact: 0, duration: 2.7, radius: 6.5 },
    },
  },
  dio: {
    ultimate: {
      duration: 4.35, contacts: [.58, 1, 1.15, 1.3, 1.45, 1.6, 1.75, 1.9, 2.05, 2.2, 2.35, 2.5, 2.65, 2.8, 2.95, 3.3],
      damage: 34, finisherDamage: 242, stun: .2, finisherStun: 2.3,
      knockback: 2, finisherKnockback: 18,
      timeStop: { contact: 0, duration: 2.7, radius: 6.5 },
    },
  },
};

export function moveFor(fighter: FighterId, slot: AttackSlot, awakened: boolean): MoveDefinition {
  const base = MOVES[fighter][slot];
  const change = awakened ? AWAKENED_MOVES[fighter]?.[slot] : undefined;
  return change ? { ...base, ...change } : base;
}

export const AWAKENED_RUSH: Partial<Record<FighterId, readonly (Partial<MoveDefinition> | undefined)[]>> = {
  naruto: [{ name: 'Kurama Swipe' }, { name: 'Tail Lash' }, { name: 'Tailed Beast Slam' }],
  eren: rushStagesOf(EREN_TITAN_RUSH, EREN_TITAN_MOVES.light).map((stage, i) => whole(RUSH.eren[i], stage)),
};

export function rushMove(fighter: FighterId, stage: number, awakened: boolean): MoveDefinition {
  if (stage <= 0) return moveFor(fighter, 'light', awakened);
  const index = Math.min(stage, RUSH_STAGES - 1) - 1;
  const base = RUSH[fighter][index];
  const change = awakened ? AWAKENED_RUSH[fighter]?.[index] : undefined;
  return change ? { ...base, ...change } : base;
}
