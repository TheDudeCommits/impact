import type { FighterId } from '../../game/types';
import { PROFILES_A } from './profilesA';
import { PROFILES_B } from './profilesB';
import { PROFILE_KILLUA } from './profileKillua';
import { PROFILES_SHOP } from './profilesShop';

export interface IdleProfile {
  model?: string;
  clip?: string;
  fidgets?: readonly string[];
  breath?: number;
  sway?: number;
  gaze?: number;
  stance?: 'guard' | 'relaxed' | 'weapon' | 'stand';
  bounce?: number;
  fidgetEvery?: readonly [number, number];
  dip?: number;
  ready?: string;
}

export const DEFAULT_IDLE: IdleProfile = {};

export const IDLE_PROFILES: Partial<Record<FighterId, IdleProfile>> = {
  toji:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.014,gaze:.025,dip:0},
  crocodile:{"clip":"_Idle","ready":"_Idle","stance":"guard","breath":0.025,"sway":0.018,"gaze":0.04,"dip":0},
  usopp:{"clip":"_Idle","ready":"_Idle","stance":"guard","breath":0.025,"sway":0.02,"gaze":0.04,"dip":0},
  sakura:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  meliodas:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  escanor:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  tatsumaki:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.04,sway:.02,gaze:.06,dip:0},
  makima:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.10,sway:.04,gaze:.10,dip:0},
  kenpachi:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.1,sway:.06,gaze:.1,dip:0},
  minato:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.03,gaze:.1,dip:0},
  'nico-robin':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.015,sway:.012,gaze:.025,dip:0},
  'kaiju-no-8':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.01,gaze:.025,dip:0},
  eren:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:1,sway:.5,gaze:.8,dip:2.2},
  asuka:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.01,gaze:.025,dip:0},
  netero:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.01,gaze:.025,dip:0},
  shinji:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.01,gaze:.025,dip:0},
  jolyne:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.018,sway:.015,gaze:.04,dip:0},
  'might-guy':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.02,sway:.015,gaze:.04,dip:0},
  akame:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.025,sway:.015,gaze:.035,dip:0},
  pikachu:{clip:'_Idle',ready:'_Idle',stance:'relaxed',breath:0,sway:0,gaze:0,dip:0,bounce:0},
  garou:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.035,sway:.025,gaze:.07,dip:0},
  esdeath:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.035,sway:.018,gaze:.07,dip:0},
  mikasa:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.04,sway:.02,gaze:.08,dip:0},
  'alphonse-elric':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.04,sway:.02,gaze:.08,dip:0},
  'ken-kaneki':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.07,sway:.025,gaze:.09,dip:0},
  grimmjow:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.03,gaze:.09,dip:0},
  byakuya:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.07,sway:.025,gaze:.08,dip:0},
  rengoku:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.025,sway:.015,gaze:.04,dip:0},
  yamamoto:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.07,sway:.025,gaze:.08,dip:0},
  pain:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.07,sway:.03,gaze:.08,dip:0},
  'edward-elric':{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.03,gaze:.1,dip:0},
  hiei:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  aokiji:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.08,sway:.04,gaze:.08,dip:.02},
  doflamingo:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.1,sway:.05,gaze:.1,dip:.02},
  hisoka:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.13,sway:.07,gaze:.11,dip:.03},
  blackbeard:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.12,sway:.06,gaze:.1,dip:.03},
  nanami:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.16,sway:.09,gaze:.12,dip:.04},
  josuke:{clip:'_Idle',ready:'_Idle',stance:'stand',breath:.16,sway:.09,gaze:.12,dip:.04},
  tsunade:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.19,sway:.10,gaze:.12,dip:.04},
  jiraiya:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.19,sway:.10,gaze:.12,dip:.04},
  hinata:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.18,sway:.10,gaze:.12,dip:.04},
  gintoki:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.20,sway:.12,gaze:.14,dip:.05},
  kizaru:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.1,sway:.06,gaze:.1,dip:.03},
  yamato:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.16,sway:.1,gaze:.12,dip:.04},
  jinbe:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.15,sway:.08,gaze:.12,dip:.04},
  enel:{clip:'_Idle',ready:'_Idle',stance:'weapon',breath:.16,sway:.1,gaze:.16,dip:.04},
  rukia: {clip:'_Idle',ready:'_Idle',stance:'guard',breath:.18,sway:.12,gaze:.12,dip:.06},
  yuta: {clip:'_Idle',ready:'_Idle',stance:'guard',breath:.18,sway:.12,gaze:.12,dip:.06},
  yuji:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.22,sway:.14,gaze:.15,dip:.06},
  todoroki:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.2,sway:.12,gaze:.1,dip:.06},
  endeavor:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.18,sway:.1,gaze:.1,dip:.05},
  yoruichi:{clip:'_Idle',ready:'_Idle',stance:'guard',breath:.22,sway:.16,gaze:.15,dip:.08},
  ...PROFILES_A, ...PROFILES_B, ...PROFILE_KILLUA, ...PROFILES_SHOP,
  mihawk: { clip: '_Idle', ready: '_Idle', stance: 'weapon', breath: .35, sway: .2, gaze: .25, dip: .15 },
  'all-might': { clip: '_Idle', ready: '_Idle', stance: 'guard', breath: .2, sway: .12, gaze: .1, dip: .06 },
  bakugo: { clip: '_Idle', ready: '_Idle', stance: 'guard', breath: .2, sway: .12, gaze: .1, dip: .06 },
  deku: { clip: '_Idle', ready: '_Idle', stance: 'guard', breath: .25, sway: .12, gaze: .1, dip: .06 },
  broly: { clip: '_Idle', ready: '_Idle', stance: 'guard', breath: .2, sway: .12, gaze: .1, dip: .06 },
  denji: { clip: '_Idle', ready: '_Idle', stance: 'weapon', breath: .2, sway: .12, gaze: .1, dip: .06 },
  akainu: { clip: '_Idle', ready: '_Idle', stance: 'relaxed', breath: .18, sway: .12, gaze: .15, dip: .05 },
  'boa-hancock': { clip: '_Idle', ready: '_Idle', stance: 'relaxed', breath: .15, sway: .15, gaze: .2, dip: .05 },
  nami: { clip: '_Idle', ready: '_Idle', stance: 'weapon', breath: .3, sway: .2, gaze: .3, dip: .1 },
};
