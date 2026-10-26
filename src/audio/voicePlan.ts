import { comboMove, type ComboKey } from '../game/combos';
import { moveFor, rushMove } from '../game/awakening';
import type { MoveDefinition } from '../game/moves';
import { barrageWindow } from '../game/timeStopBarrage';
import type { AttackSlot, CombatEvent, FighterId, ReactionKind } from '../game/types';
import { cueDuration, type AudioCue, type CueLayer } from './cueTypes';
import { DODGE_SHARE, LOW_AGAIN, LOW_HEALTH, LOW_REARM, SITUATION_RULES, situationLayer, situationLines, type SituationLine, type VoiceSituation } from './voiceSituations';
import { AWAKENING_LINES } from './awakeningLines';
import { BANKAI } from './bankaiTiming';
import { SUPER_SAIYAN, SUPER_VEGETA } from './superSaiyanTiming';


export const LIGHT_CALL_COOLDOWN = 9;
export const LIGHT_CALL_CHANCE = .35;
export const EFFORT_CHANCE = .4;
const FLURRY = 1.6;
const EFFORT_LEAD = .1;
const REWIND = 2;
const REMEMBERED = 64;
const DECISIONS = 16;

interface Rationed {
  cues: readonly AudioCue[];
  chance?: number;
}
interface VoiceKit {
  calls: Partial<Record<AttackSlot, AudioCue>>;
  efforts: readonly AudioCue[];
  heavy?: Rationed;
  special?: Rationed;
  barrage?: AudioCue;
  finisher?: { cue: AudioCue; lands: number };
  delays?: Partial<Record<AttackSlot, number>>;
  enders?: Partial<Record<ComboKey, Rationed>>;
  cinematic?: { cue: AudioCue; lands: number; fromConfirm?: boolean };
}

const onRelease = (fighter: FighterId, slot: AttackSlot, word: number) => Math.max(0, Math.round((moveFor(fighter, slot, false).contacts[0] - word) * 100) / 100);

const KITS: Record<FighterId, VoiceKit> = {
  toji:{calls:{heavy:'vo-toji-cut',special:'vo-toji-blink'},efforts:['vo-toji-effort-a','vo-toji-effort-b'],cinematic:{cue:'vo-toji-playtime-over',lands:1.2,fromConfirm:true}},
  usopp:{calls:{heavy:'vo-usopp-impact-wolf',special:'vo-usopp-firebird-star'},efforts:['vo-usopp-effort-a'],cinematic:{cue:'vo-usopp-battle-begins',lands:2.4,fromConfirm:true}},
  crocodile:{calls:{heavy:'vo-crocodile-desert-spada',special:'vo-crocodile-sables'},efforts:[],cinematic:{cue:'vo-crocodile-ground-death',lands:1.3,fromConfirm:true}},
  rengoku:{calls:{heavy:'vo-rengoku-rising-sun',special:'vo-rengoku-blooming-flame'},efforts:['vo-rengoku-effort-a','vo-rengoku-effort-b'],cinematic:{cue:'vo-rengoku-ninth-form',lands:2.69,fromConfirm:true}},
  sakura:{calls:{},efforts:['vo-sakura-effort-c','vo-sakura-effort-d'],heavy:{cues:['vo-sakura-effort-a','vo-sakura-effort-b'],chance:.65},special:{cues:['vo-sakura-blossom-rush'],chance:.8},cinematic:{cue:'vo-sakura-hurricane',lands:2.747,fromConfirm:true}},
  meliodas:{calls:{},efforts:['vo-meliodas-effort-a','vo-meliodas-effort-b','vo-meliodas-effort-c'],heavy:{cues:['vo-meliodas-counter'],chance:.75},special:{cues:['vo-meliodas-hellblaze'],chance:.85},cinematic:{cue:'vo-meliodas-ultimate',lands:2.75,fromConfirm:true}},
  escanor:{calls:{light:'vo-escanor-pride'},efforts:[],heavy:{cues:['vo-escanor-divider'],chance:.65},special:{cues:['vo-escanor-cruel-sun'],chance:.85},cinematic:{cue:'vo-escanor-divine-sword',lands:3.05,fromConfirm:true}},
  tatsumaki:{calls:{},efforts:['vo-tatsumaki-effort-a','vo-tatsumaki-effort-b'],heavy:{cues:['vo-tatsumaki-crush'],chance:.7},special:{cues:['vo-tatsumaki-return-fire'],chance:.85},enders:{lllh:{cues:['vo-tatsumaki-disappear'],chance:.7}},cinematic:{cue:'vo-tatsumaki-smithereens',lands:3.14,fromConfirm:true}},
  makima:{calls:{},efforts:['vo-makima-effort-a','vo-makima-effort-b'],heavy:{cues:['vo-makima-come-here','vo-makima-effort-c'],chance:.65},special:{cues:['vo-makima-quiet'],chance:.9},cinematic:{cue:'vo-makima-ultimate',lands:2.82,fromConfirm:true}},
  kenpachi:{calls:{},efforts:['vo-kenpachi-effort-a','vo-kenpachi-effort-b'],heavy:{cues:['vo-kenpachi-heavy'],chance:.65},special:{cues:['vo-kenpachi-special'],chance:.85},cinematic:{cue:'vo-kenpachi-ultimate',lands:2.79,fromConfirm:true}},
  minato:{calls:{},efforts:['vo-minato-effort-b'],heavy:{cues:['vo-minato-rasengan','vo-minato-effort-a'],chance:.75},special:{cues:['vo-minato-flash-ready'],chance:.85},cinematic:{cue:'vo-minato-tempest',lands:2.8,fromConfirm:true}},
  'nico-robin':{calls:{special:'vo-nico-robin-spank'},efforts:['vo-nico-robin-effort-a','vo-nico-robin-effort-b'],heavy:{cues:['vo-nico-robin-try-this'],chance:.45},cinematic:{cue:'vo-nico-robin-another-job',lands:3.075,fromConfirm:true}},
  'kaiju-no-8':{calls:{special:'vo-kaiju-no-8-break'},efforts:[],heavy:{cues:['vo-kaiju-no-8-break'],chance:.45},cinematic:{cue:'vo-kaiju-no-8-maximum',lands:3.24,fromConfirm:true}},
  eren:{calls:{special:'vo-eren-drive'},efforts:[],heavy:{cues:['vo-eren-drive'],chance:.45},cinematic:{cue:'vo-eren-eradicate',lands:3.46,fromConfirm:true}},
  asuka:{calls:{special:'vo-asuka-field'},efforts:[],heavy:{cues:['vo-asuka-challenge','vo-asuka-take-that'],chance:.55},cinematic:{cue:'vo-asuka-finish',lands:2.988,fromConfirm:true}},
  netero:{calls:{special:'vo-netero-hyakushiki'},efforts:['vo-netero-effort-b'],heavy:{cues:['vo-netero-drive'],chance:.45},cinematic:{cue:'vo-netero-hyakushiki',lands:3.444,fromConfirm:true}},
  shinji:{calls:{special:'vo-shinji-special'},efforts:[],heavy:{cues:['vo-shinji-heavy'],chance:.55},cinematic:{cue:'vo-shinji-ultimate',lands:3.078,fromConfirm:true}},
  jolyne:{calls:{},efforts:['vo-jolyne-effort-a'],heavy:{cues:['vo-jolyne-effort-b'],chance:.65},special:{cues:['vo-jolyne-stone-free','vo-jolyne-ora'],chance:.75},cinematic:{cue:'vo-jolyne-ultimate',lands:3.18,fromConfirm:true}},
  'might-guy':{calls:{special:'vo-might-guy-tiger'},efforts:['vo-might-guy-effort-tap'],heavy:{cues:['vo-might-guy-pressure'],chance:.55},cinematic:{cue:'vo-might-guy-night-guy',lands:1.0,fromConfirm:true},enders:{lh:{cues:['vo-might-guy-pressure'],chance:.55},llh:{cues:['vo-might-guy-chase'],chance:.55},llls:{cues:['vo-might-guy-peacock'],chance:.75}}},
  akame:{calls:{},efforts:[],heavy:{cues:['vo-akame-eliminate'],chance:.55},special:{cues:['vo-akame-swift'],chance:.6},cinematic:{cue:'vo-akame-eliminate',lands:2.87,fromConfirm:true}},
  pikachu:{calls:{},efforts:['vo-pikachu-effort-tap'],heavy:{cues:['vo-pikachu-tail'],chance:.65},special:{cues:['vo-pikachu-bolt'],chance:.75},enders:{lllh:{cues:['vo-pikachu-rush'],chance:.6},llls:{cues:['vo-pikachu-spark'],chance:.6}},cinematic:{cue:'vo-pikachu-tackle',lands:3.08,fromConfirm:true}},
  garou:{calls:{},efforts:[],heavy:{cues:['vo-garou-effort-a','vo-garou-effort-b'],chance:.65},special:{cues:['vo-garou-move-aside'],chance:.7},enders:{lllh:{cues:['vo-garou-read-you'],chance:.6}},cinematic:{cue:'vo-garou-ultimate',lands:3.02,fromConfirm:true}},
  esdeath:{calls:{},efforts:[],heavy:{cues:['vo-esdeath-heavy'],chance:.5},special:{cues:['vo-esdeath-special'],chance:.7},cinematic:{cue:'vo-esdeath-ultimate',lands:2.89,fromConfirm:true}},
  mikasa:{calls:{light:'vo-mikasa-strike'},efforts:[],heavy:{cues:['vo-mikasa-cleave'],chance:.6},special:{cues:['vo-mikasa-crosscut'],chance:.7},cinematic:{cue:'vo-mikasa-finish',lands:3.22,fromConfirm:true}},
  'alphonse-elric':{calls:{},efforts:['vo-alphonse-elric-effort-tap'],heavy:{cues:['vo-alphonse-elric-there'],chance:.6},special:{cues:['vo-alphonse-elric-hit'],chance:.7},enders:{lh:{cues:['vo-alphonse-elric-open'],chance:.5},lllh:{cues:['vo-alphonse-elric-caught'],chance:.5}},cinematic:{cue:'vo-alphonse-elric-finish',lands:3.56,fromConfirm:true}},
  'ken-kaneki':{calls:{light:'vo-ken-kaneki-my-turn'},efforts:[],cinematic:{cue:'vo-ken-kaneki-ultimate',lands:3.02,fromConfirm:true}},
  grimmjow:{calls:{special:'vo-grimmjow-special'},efforts:['vo-grimmjow-effort-c'],heavy:{cues:['vo-grimmjow-heavy'],chance:.5},cinematic:{cue:'vo-grimmjow-ultimate',lands:2.65,fromConfirm:true}},
  byakuya:{calls:{light:'vo-byakuya-ready'},efforts:['vo-byakuya-effort-a','vo-byakuya-effort-b'],heavy:{cues:['vo-byakuya-finish'],chance:.6},special:{cues:['vo-byakuya-refusal'],chance:.7},cinematic:{cue:'vo-byakuya-finish',lands:2.8,fromConfirm:true}},
  yamamoto:{calls:{light:'vo-yamamoto-strike'},efforts:[],heavy:{cues:['vo-yamamoto-cleave'],chance:.65},special:{cues:['vo-yamamoto-flame'],chance:.8},cinematic:{cue:'vo-yamamoto-no-escape',lands:3.14,fromConfirm:true}},
  pain:{calls:{light:'vo-pain-effort-a'},efforts:[],heavy:{cues:['vo-pain-shinra-tensei'],chance:.8},special:{cues:['vo-pain-bansho-tenin'],chance:.9},enders:{lllh:{cues:['vo-pain-effort-b'],chance:.65}},cinematic:{cue:'vo-pain-ultimate',lands:3.08,fromConfirm:true}},
  'edward-elric':{calls:{},efforts:['vo-edward-elric-effort-tap'],heavy:{cues:['vo-edward-elric-strike','vo-edward-elric-effort-a'],chance:.65},special:{cues:['vo-edward-elric-stay-back'],chance:.8},enders:{lllh:{cues:['vo-edward-elric-no-escape'],chance:.65}},cinematic:{cue:'vo-edward-elric-transmute',lands:3.3,fromConfirm:true}},
  hiei:{calls:{},efforts:['vo-hiei-effort-a','vo-hiei-effort-b'],heavy:{cues:['vo-hiei-flame-sword'],chance:.65},special:{cues:['vo-hiei-effort-a'],chance:.75},cinematic:{cue:'vo-hiei-ultimate',lands:1.734,fromConfirm:true}},
  aokiji:{calls:{},efforts:['vo-aokiji-effort-a','vo-aokiji-effort-b'],heavy:{cues:['vo-aokiji-heel'],chance:.65},special:{cues:['vo-aokiji-pheasant'],chance:.8},cinematic:{cue:'vo-aokiji-ice-age',lands:1.15,fromConfirm:true}},
  doflamingo:{calls:{},efforts:['vo-doflamingo-effort-a','vo-doflamingo-effort-b'],heavy:{cues:['vo-doflamingo-out-of-my-way'],chance:.65},special:{cues:['vo-doflamingo-small-fry'],chance:.75},enders:{llls:{cues:['vo-doflamingo-parasite'],chance:.75}},cinematic:{cue:'vo-doflamingo-god-thread',lands:3.18,fromConfirm:true}},
  hisoka:{calls:{heavy:'vo-hisoka-gum'},efforts:['vo-hisoka-effort-a','vo-hisoka-effort-b','vo-hisoka-effort-c'],special:{cues:['vo-hisoka-gum'],chance:.8},cinematic:{cue:'vo-hisoka-encore',lands:2.89,fromConfirm:true}},
  blackbeard:{calls:{heavy:'vo-blackbeard-take-it-all'},efforts:['vo-blackbeard-effort-a','vo-blackbeard-effort-b'],special:{cues:['vo-blackbeard-black-hole'],chance:.8},cinematic:{cue:'vo-blackbeard-liberation',lands:3.25,fromConfirm:true}},
  nanami:{calls:{light:'vo-nanami-cut',heavy:'vo-nanami-ratio'},efforts:[],special:{cues:['vo-nanami-collapse'],chance:.8},cinematic:{cue:'vo-nanami-finish',lands:2.05,fromConfirm:true}},
  josuke:{calls:{heavy:'vo-josuke-diamond'},efforts:['vo-josuke-effort-a','vo-josuke-effort-b','vo-josuke-effort-c'],special:{cues:['vo-josuke-dora'],chance:.8},cinematic:{cue:'vo-josuke-in-range',lands:2.76,fromConfirm:true}},
  tsunade:{calls:{},efforts:['vo-tsunade-effort-a','vo-tsunade-effort-b'],heavy:{cues:['vo-tsunade-effort-c','vo-tsunade-effort-d'],chance:.65},special:{cues:['vo-tsunade-strength'],chance:.8},cinematic:{cue:'vo-tsunade-pure-land',lands:1.1,fromConfirm:true}},
  jiraiya:{calls:{heavy:'vo-jiraiya-rasengan'},efforts:['vo-jiraiya-effort-a','vo-jiraiya-effort-b'],special:{cues:['vo-jiraiya-effort-b'],chance:.65},cinematic:{cue:'vo-jiraiya-ultimate',lands:2.6,fromConfirm:true}},
  hinata:{calls:{},efforts:['vo-hinata-effort-a','vo-hinata-effort-c'],heavy:{cues:['vo-hinata-palm'],chance:.65},special:{cues:['vo-hinata-vacuum'],chance:.85},cinematic:{cue:'vo-hinata-lions',lands:1.35,fromConfirm:true}},
  gintoki:{calls:{},efforts:['vo-gintoki-effort-a','vo-gintoki-effort-b','vo-gintoki-effort-c'],special:{cues:['vo-gintoki-ready'],chance:.75},cinematic:{cue:'vo-gintoki-lets-go',lands:1.52,fromConfirm:true}},
  kizaru:{calls:{},efforts:['vo-kizaru-effort-a','vo-kizaru-effort-b','vo-kizaru-effort-c'],heavy:{cues:['vo-kizaru-finish'],chance:.65},special:{cues:['vo-kizaru-slow'],chance:.85},cinematic:{cue:'vo-kizaru-yasakani',lands:2.06,fromConfirm:true}},
  yamato:{calls:{light:'vo-yamato-lets-go',special:'vo-yamato-narikabura'},efforts:['vo-yamato-effort-a','vo-yamato-effort-b'],heavy:{cues:['vo-yamato-clear-the-way'],chance:.65},cinematic:{cue:'vo-yamato-thunder-bagua',lands:1.54,fromConfirm:true}},
  jinbe:{calls:{},efforts:['vo-jinbe-effort-a','vo-jinbe-effort-b','vo-jinbe-effort-c'],heavy:{cues:['vo-jinbe-karate'],chance:.55},special:{cues:['vo-jinbe-water'],chance:.85},cinematic:{cue:'vo-jinbe-vagabond',lands:1.1,fromConfirm:true}},
  enel:{calls:{light:'vo-enel-enough'},efforts:[],heavy:{cues:['vo-enel-silence'],chance:.55},special:{cues:['vo-enel-judgment'],chance:.8},cinematic:{cue:'vo-enel-raigo',lands:.3,fromConfirm:true}},
  rukia:{calls:{},efforts:['vo-rukia-effort-a','vo-rukia-effort-b','vo-rukia-effort-c'],heavy:{cues:['vo-rukia-tsukishiro'],chance:.7},special:{cues:['vo-rukia-hakuren'],chance:.85},cinematic:{cue:'vo-rukia-quip-resolve',lands:1.2,fromConfirm:true}},
  yuta:{calls:{},efforts:['vo-yuta-effort-a','vo-yuta-effort-b','vo-yuta-effort-c'],heavy:{cues:['vo-yuta-effort-d'],chance:.7},special:{cues:['vo-yuta-command'],chance:.85},cinematic:{cue:'vo-yuta-pure-love',lands:1.6,fromConfirm:true}},
  yuji:{calls:{},efforts:['vo-yuji-effort-a','vo-yuji-effort-b','vo-yuji-effort-c'],heavy:{cues:['vo-yuji-break'],chance:.65},special:{cues:['vo-yuji-close'],chance:.8},cinematic:{cue:'vo-yuji-all-out',lands:1.4,fromConfirm:true}},
  todoroki:{calls:{},efforts:['vo-todoroki-effort-a','vo-todoroki-effort-b','vo-todoroki-effort-c'],
    heavy:{cues:['vo-todoroki-burn'],chance:.65},special:{cues:['vo-todoroki-freeze'],chance:.85},
    cinematic:{cue:'vo-todoroki-maximum',lands:1.65,fromConfirm:true}},
  endeavor:{calls:{},efforts:['vo-endeavor-effort-a','vo-endeavor-effort-b','vo-endeavor-effort-c'],
    heavy:{cues:['vo-endeavor-flame'],chance:.6},special:{cues:['vo-endeavor-spider'],chance:.8},
    cinematic:{cue:'vo-endeavor-burn',lands:2.3,fromConfirm:true}},
  yoruichi:{calls:{},efforts:['vo-yoruichi-effort-a','vo-yoruichi-effort-b','vo-yoruichi-effort-c'],
    heavy:{cues:['vo-yoruichi-finish'],chance:.65},special:{cues:['vo-yoruichi-slow'],chance:.85},
    cinematic:{cue:'vo-yoruichi-flash',lands:2.48,fromConfirm:true}},
  'all-might':{calls:{},efforts:['vo-all-might-effort-a','vo-all-might-effort-b'],
    heavy:{cues:['vo-all-might-effort-c','vo-all-might-effort-d'],chance:.65},special:{cues:['vo-all-might-smash'],chance:.65},
    cinematic:{cue:'vo-all-might-full-power',lands:1.65,fromConfirm:true},
    enders:{lllh:{cues:['vo-all-might-effort-d'],chance:.55},airSpecial:{cues:['vo-all-might-effort-c'],chance:.5}}},
  bakugo:{calls:{},efforts:['vo-bakugo-effort-a','vo-bakugo-effort-b'],
    heavy:{cues:['vo-bakugo-effort-c','vo-bakugo-effort-d'],chance:.65},special:{cues:['vo-bakugo-ap-effort'],chance:.8},
    cinematic:{cue:'vo-bakugo-howitzer-effort',lands:2.8,fromConfirm:true},
    enders:{lllh:{cues:['vo-bakugo-effort-d'],chance:.55},airSpecial:{cues:['vo-bakugo-effort-c'],chance:.5}}},
  deku:{calls:{},efforts:['vo-deku-effort-c','vo-deku-effort-d'],
    heavy:{cues:['vo-deku-effort-a','vo-deku-effort-b'],chance:.65},special:{cues:['vo-deku-air-force-effort'],chance:.8},
    cinematic:{cue:'vo-deku-plus-ultra',lands:1.6,fromConfirm:true},
    enders:{lllh:{cues:['vo-deku-effort-a'],chance:.55},airSpecial:{cues:['vo-deku-effort-c'],chance:.5}}},
  broly:{calls:{},efforts:['vo-broly-effort-a','vo-broly-effort-b','vo-broly-effort-c'],
    heavy:{cues:['vo-broly-effort-d'],chance:.7},special:{cues:['vo-broly-eraser-effort'],chance:.85},
    cinematic:{cue:'vo-broly-gigantic-roar',lands:.55,fromConfirm:true},
    enders:{lllh:{cues:['vo-broly-effort-d'],chance:.55},airSpecial:{cues:['vo-broly-effort-c'],chance:.6}}},
  denji:{calls:{},efforts:['vo-denji-effort-a','vo-denji-effort-b','vo-denji-effort-c'],
    heavy:{cues:['vo-denji-die','vo-denji-effort-b'],chance:.7},special:{cues:['vo-denji-dont-run'],chance:.8},
    cinematic:{cue:'vo-denji-engine',lands:1.2,fromConfirm:true},
    enders:{lllh:{cues:['vo-denji-hurts'],chance:.5},airSpecial:{cues:['vo-denji-effort-c'],chance:.65}}},
  akainu:{calls:{special:'vo-akainu-crimson-hound'},efforts:['vo-akainu-effort-b','vo-akainu-effort-c'],
    heavy:{cues:['vo-akainu-effort-a','vo-akainu-effort-c'],chance:.7},
    cinematic:{cue:'vo-akainu-meteor-volcano',lands:1.65,fromConfirm:true},
    enders:{lllh:{cues:['vo-akainu-effort-a'],chance:.55},airSpecial:{cues:['vo-akainu-effort-c'],chance:.6}}},
  'boa-hancock':{calls:{light:'vo-boa-hancock-pistol-kiss',special:'vo-boa-hancock-slave-arrow'},
    efforts:['vo-boa-hancock-effort-a'], heavy:{cues:['vo-boa-hancock-effort-a'],chance:.65},
    cinematic:{cue:'vo-boa-hancock-where-looking',lands:.85,fromConfirm:true},
    enders:{lllh:{cues:['vo-boa-hancock-effort-a'],chance:.45},airSpecial:{cues:['vo-boa-hancock-effort-a'],chance:.45}}},
  nami:{calls:{},efforts:['vo-nami-effort-a','vo-nami-effort-b','vo-nami-effort-c','vo-nami-effort-d'],
    heavy:{cues:['vo-nami-effort-b','vo-nami-effort-d']},
    special:{cues:['vo-nami-effort-c','vo-nami-effort-d'],chance:.85},
    cinematic:{cue:'vo-nami-discharge',lands:1.15,fromConfirm:true},
    enders:{llh:{cues:['vo-nami-effort-a','vo-nami-effort-b'],chance:.6},
      lllh:{cues:['vo-nami-effort-b','vo-nami-effort-d'],chance:.6},
      airSpecial:{cues:['vo-nami-effort-d'],chance:.65}}},
  mihawk:{calls:{special:'vo-mihawk-black-blade'},
    cinematic:{cue:'vo-mihawk-surpass-blade',lands:1.35,fromConfirm:true},
    efforts:['vo-mihawk-effort-a','vo-mihawk-effort-b','vo-mihawk-effort-c','vo-mihawk-effort-d'],
    heavy:{cues:['vo-mihawk-effort-c','vo-mihawk-effort-d']},
    enders:{lllh:{cues:['vo-mihawk-effort-c','vo-mihawk-effort-d'],chance:.55},airSpecial:{cues:['vo-mihawk-effort-d'],chance:.6}}},
  goku: { calls: { special: 'vo-goku-kamehameha', ultimate: 'goku-spirit' }, efforts: ['vo-goku-ha', 'vo-goku-ya', 'vo-goku-fun'],
    heavy: { cues: ['vo-goku-harya', 'vo-goku-orya'] }, delays: { special: onRelease('goku', 'special', .99) },
    enders: { lllh: { cues: ['vo-goku-orya', 'vo-goku-harya'], chance: .55 }, airSpecial: { cues: ['vo-goku-harya'], chance: .6 } } },
  vegeta: { calls: { heavy: 'vo-vegeta-big-bang', special: 'vo-vegeta-galick', ultimate: 'vo-vegeta-final-flash' },
    efforts: ['vo-vegeta-ha', 'vo-vegeta-da', 'vo-vegeta-fun'], delays: { special: onRelease('vegeta', 'special', .75) },
    enders: { llh: { cues: ['vo-vegeta-fun'], chance: .5 }, airSpecial: { cues: ['vo-vegeta-ha', 'vo-vegeta-da'], chance: .6 } } },
  naruto: { calls: { heavy: 'naruto-rasengan', special: 'naruto-rasenshuriken', ultimate: 'vo-naruto-bijudama' },
    efforts: ['vo-naruto-ura', 'vo-naruto-ha', 'vo-naruto-yo'],
    enders: { llh: { cues: ['vo-naruto-ura'], chance: .5 }, airSpecial: { cues: ['vo-naruto-ura', 'vo-naruto-ha'], chance: .6 } } },
  sasuke: { calls: { heavy: 'vo-sasuke-chidori', special: 'vo-sasuke-amaterasu' }, efforts: ['vo-sasuke-ei', 'vo-sasuke-ya', 'vo-sasuke-fu'],
    enders: { lllh: { cues: ['vo-sasuke-ei'], chance: .5 }, airSpecial: { cues: ['vo-sasuke-ya', 'vo-sasuke-ei'], chance: .6 } } },
  kakashi: { calls: { heavy: 'vo-kakashi-raikiri', special: 'vo-kakashi-raiton-kagebunshin', ultimate: 'vo-kakashi-kamui-raikiri' },
    efforts: ['vo-kakashi-seya', 'vo-kakashi-ti', 'vo-kakashi-fun'],
    enders: { llh: { cues: ['vo-kakashi-seya'], chance: .5 }, airSpecial: { cues: ['vo-kakashi-ti', 'vo-kakashi-seya'], chance: .6 } } },
  luffy: { calls: { light: 'luffy-pistol', heavy: 'vo-luffy-bazooka', special: 'vo-luffy-hawk-gatling', ultimate: 'vo-luffy-gomu-gomu-no' },
    delays: { heavy: onRelease('luffy', 'heavy', .39), special: onRelease('luffy', 'special', .44) },
    efforts: ['vo-luffy-yo', 'vo-luffy-ho', 'vo-luffy-da'], cinematic: { cue: 'vo-luffy-bajrang-gun', lands: .82, fromConfirm: true },
    enders: { llh: { cues: ['vo-luffy-da', 'vo-luffy-yo'], chance: .5 }, airSpecial: { cues: ['vo-luffy-ho', 'vo-luffy-da'], chance: .6 } } },
  zoro: { calls: { light: 'vo-zoro-onigiri', heavy: 'vo-zoro-shishi-sonson', special: 'zoro-phoenix', ultimate: 'zoro-world' },
    efforts: ['vo-zoro-fun', 'vo-zoro-ura', 'vo-zoro-fu'],
    enders: { lllh: { cues: ['vo-zoro-ura'], chance: .45 }, airSpecial: { cues: ['vo-zoro-fu', 'vo-zoro-ura'], chance: .55 } } },
  sanji: { calls: { heavy: 'vo-sanji-concasse', special: 'vo-sanji-mouton', ultimate: 'vo-sanji-hell-memories' },
    efforts: ['vo-sanji-tei', 'vo-sanji-sea', 'vo-sanji-fun'],
    enders: { lllh: { cues: ['vo-sanji-tei'], chance: .5 }, airSpecial: { cues: ['vo-sanji-sea', 'vo-sanji-tei'], chance: .6 } } },
  ichigo: { calls: { special: 'vo-ichigo-getsuga', ultimate: 'ichigo-mugetsu' }, efforts: ['vo-ichigo-fu', 'vo-ichigo-ha', 'vo-ichigo-da'],
    enders: { lllh: { cues: ['vo-ichigo-da', 'vo-ichigo-ha'], chance: .5 }, airSpecial: { cues: ['vo-ichigo-ha', 'vo-ichigo-da'], chance: .6 } } },
  ace: { calls: { light: 'ace-hotarubi', heavy: 'ace-kagero', special: 'vo-ace-hiken', ultimate: 'vo-ace-entei' }, efforts: ['vo-ace-yo', 'vo-ace-orya', 'vo-ace-do'],
    enders: { llh: { cues: ['vo-ace-orya'], chance: .5 }, airSpecial: { cues: ['vo-ace-do', 'vo-ace-orya'], chance: .6 } } },
  law: { calls: { heavy: 'law-injection-shot', special: 'law-gamma-knife', ultimate: 'vo-law-room' }, efforts: ['vo-law-fun', 'vo-law-se', 'vo-law-che'],
    cinematic: { cue: 'law-counter-shock', lands: 1.2 },
    enders: { llls: { cues: ['vo-law-room'], chance: .5 }, airSpecial: { cues: ['vo-law-che', 'vo-law-se'], chance: .55 } } },
  gojo: { calls: { heavy: 'gojo-ao', special: 'gojo-murasaki', ultimate: 'gojo-muryokusho' }, efforts: ['vo-gojo-ha', 'vo-gojo-ya', 'vo-gojo-fu'],
    enders: { lllh: { cues: ['vo-gojo-ya'], chance: .5 }, airSpecial: { cues: ['vo-gojo-ha', 'vo-gojo-ya'], chance: .6 } } },
  jotaro: { calls: { heavy: 'vo-jotaro-star-finger', special: 'jotaro-star', ultimate: 'vo-jotaro-za-warudo' },
    efforts: ['vo-jotaro-ora-1', 'vo-jotaro-ora-2', 'vo-jotaro-ora-4', 'vo-jotaro-fun'],
    barrage: 'vo-jotaro-ora-barrage', finisher: { cue: 'vo-jotaro-oraaa', lands: .15 },
    enders: { llh: { cues: ['vo-jotaro-oraaa'], chance: .55 }, airSpecial: { cues: ['vo-jotaro-ora-4', 'vo-jotaro-ora-2'], chance: .65 } } },
  dio: { calls: { heavy: 'vo-dio-ukete', ultimate: 'vo-dio-za-warudo' }, efforts: ['vo-dio-muda', 'vo-dio-mudada', 'vo-dio-fun', 'vo-dio-fun-2'],
    barrage: 'vo-dio-muda-barrage', finisher: { cue: 'dio-road-roller', lands: 1.8 },
    enders: { lllh: { cues: ['vo-dio-mudada', 'vo-dio-muda'], chance: .55 }, airSpecial: { cues: ['vo-dio-fun'], chance: .5 } } },
  guts: { calls: { special: 'vo-guts-kurai', ultimate: 'vo-guts-roar' }, efforts: ['vo-guts-ha', 'vo-guts-fu', 'vo-guts-sei', 'vo-guts-da'],
    heavy: { cues: ['vo-guts-dora', 'vo-guts-gah'] },
    enders: { lllh: { cues: ['vo-guts-gah', 'vo-guts-sei'], chance: .5 }, airSpecial: { cues: ['vo-guts-sei', 'vo-guts-ha'], chance: .6 } } },
  killua: { calls: { special: 'killua-narukami', ultimate: 'vo-killua-kanmuru' }, efforts: ['vo-killua-ha', 'vo-killua-ta', 'vo-killua-deya'],
    cinematic: { cue: 'killua-shippu', lands: 1.3 },
    enders: { llls: { cues: ['vo-killua-ta'], chance: .45 }, airSpecial: { cues: ['vo-killua-deya', 'vo-killua-ha'], chance: .6 } } },
  kaido: { calls: { light: 'vo-kaido-ora', ultimate: 'vo-kaido-raimei-hakke' }, efforts: ['vo-kaido-effort-a', 'vo-kaido-effort-b', 'vo-kaido-effort-c'],
    enders: { lllh: { cues: ['vo-kaido-laugh'], chance: .5 } } },
  whitebeard: { calls: { ultimate: 'vo-whitebeard-lets-go' }, efforts: ['vo-whitebeard-effort-a', 'vo-whitebeard-effort-b', 'vo-whitebeard-effort-c'],
    enders: { lllh: { cues: ['vo-whitebeard-laugh'], chance: .5 } } },
  shanks: { calls: { ultimate: 'vo-shanks-kamusari' }, efforts: ['vo-shanks-effort-a', 'vo-shanks-effort-b', 'vo-shanks-effort-c', 'vo-shanks-effort-d'] },
  roger: { calls: { ultimate: 'vo-roger-kamusari' }, efforts: ['vo-roger-effort-a', 'vo-roger-effort-b', 'vo-roger-effort-c', 'vo-roger-effort-d'] },
  aizen: { calls: { light: 'vo-aizen-weak', special: 'vo-aizen-senju', ultimate: 'vo-aizen-kurohitsugi' },
    efforts: ['vo-aizen-effort-a', 'vo-aizen-effort-b', 'vo-aizen-effort-c', 'vo-aizen-effort-d'] },
  sukuna: { calls: { light: 'vo-sukuna-tch', heavy: 'vo-sukuna-hachi', special: 'vo-sukuna-kai', ultimate: 'vo-sukuna-domain' },
    efforts: ['vo-sukuna-effort-a', 'vo-sukuna-effort-b', 'vo-sukuna-effort-c', 'vo-sukuna-effort-d'],
    enders: { airSpecial: { cues: ['vo-sukuna-fuga'], chance: .7 } } },
  griffith: { calls: { special: 'vo-griffith-wont-allow', ultimate: 'vo-griffith-mine' },
    efforts: ['vo-griffith-effort-a', 'vo-griffith-effort-b', 'vo-griffith-effort-c', 'vo-griffith-effort-d'] },
  meruem: { calls: { light: 'vo-meruem-i-can-read', heavy: 'vo-meruem-prepare', special: 'vo-meruem-vanish', ultimate: 'vo-meruem-finish' },
    efforts: ['vo-meruem-effort-a', 'vo-meruem-effort-b', 'vo-meruem-effort-c', 'vo-meruem-effort-d'] },
  'goku-black': { calls: { heavy: 'vo-goku-black-instant', special: 'vo-goku-black-kamehameha', ultimate: 'vo-goku-black-retribution' },
    efforts: ['vo-goku-black-effort-a', 'vo-goku-black-effort-b', 'vo-goku-black-effort-c', 'vo-goku-black-effort-d'],
    enders: { lllh: { cues: ['vo-goku-black-finish'], chance: .6 } } },
  jiren: { calls: { special: 'vo-jiren-vanish', ultimate: 'vo-jiren-finish' }, efforts: ['vo-jiren-effort-a', 'vo-jiren-effort-b', 'vo-jiren-effort-c', 'vo-jiren-effort-d'],
    enders: { lllh: { cues: ['vo-jiren-fall'], chance: .7 } } },
  'golden-frieza': { calls: { special: 'vo-golden-frieza-laugh', ultimate: 'vo-golden-frieza-over' },
    efforts: ['vo-golden-frieza-effort-a', 'vo-golden-frieza-effort-b', 'vo-golden-frieza-effort-c', 'vo-golden-frieza-effort-d'],
    enders: { llls: { cues: ['vo-golden-frieza-die'], chance: .6 }, llh: { cues: ['vo-golden-frieza-vanish'], chance: .5 } } },
  'gohan-beast': { calls: { ultimate: 'vo-gohan-beast-makankosappo' }, efforts: ['vo-gohan-beast-effort-a', 'vo-gohan-beast-effort-b', 'vo-gohan-beast-effort-c', 'vo-gohan-beast-effort-d'] },
  saitama: { calls: {}, efforts: ['vo-saitama-effort-a', 'vo-saitama-effort-b', 'vo-saitama-effort-c', 'vo-saitama-effort-d'], cinematic: { cue: 'vo-saitama-serious-punch', lands: .8, fromConfirm: true } },
  akaza: { calls: {}, efforts: ['vo-akaza-effort-a', 'vo-akaza-effort-b', 'vo-akaza-effort-c', 'vo-akaza-effort-d'],
    enders: { llls: { cues: ['vo-akaza-compass-needle'], chance: .8 } } },
  itachi: { calls: {}, efforts: ['vo-itachi-effort-a', 'vo-itachi-effort-b', 'vo-itachi-effort-c', 'vo-itachi-effort-d'], cinematic: { cue: 'vo-itachi-illusion', lands: 1.2, fromConfirm: true } },
  madara: { calls: { special: 'vo-madara-goka' }, efforts: ['vo-madara-effort-a', 'vo-madara-effort-b', 'vo-madara-effort-c', 'vo-madara-effort-d'],
    cinematic: { cue: 'vo-madara-second', lands: 1.4, fromConfirm: true },
    enders: { lllh: { cues: ['vo-madara-its-over'], chance: .6 }, airSpecial: { cues: ['vo-madara-shatter'], chance: .7 } } },
  tanjiro: { calls: {}, efforts: ['vo-tanjiro-effort-a', 'vo-tanjiro-effort-b', 'vo-tanjiro-effort-c', 'vo-tanjiro-effort-d'], cinematic: { cue: 'vo-tanjiro-hinokami', lands: 1.1, fromConfirm: true } },
  levi: { calls: {}, efforts: ['vo-levi-effort-a', 'vo-levi-effort-b', 'vo-levi-effort-c', 'vo-levi-effort-d'] },
  'sung-jinwoo': { calls: {}, efforts: ['vo-sung-jinwoo-effort-a', 'vo-sung-jinwoo-effort-b', 'vo-sung-jinwoo-effort-c'],
    cinematic: { cue: 'vo-sung-jinwoo-arise', lands: .4, fromConfirm: true } },
  gon: { calls: {}, efforts: ['vo-gon-effort-a', 'vo-gon-effort-b', 'vo-gon-effort-c', 'vo-gon-effort-d'], cinematic: { cue: 'vo-gon-jajanken', lands: 1.38, fromConfirm: true } },
};
const KURAMA: VoiceKit = { calls: { heavy: 'kurama-taunt', special: 'kurama-growl', ultimate: 'kurama-growl' }, efforts: [] };
const FORM_CALLS: Partial<Record<FighterId, Partial<Record<AttackSlot, AudioCue>>>> = { luffy: { special: 'vo-luffy-yo' } };

const LEVEL = -16.5;
const MEASURED: Partial<Record<AudioCue, number>> = {
  'goku-kamehameha-full': -14.6, 'goku-spirit': -11.3, 'vegeta-galick': -16.6, 'naruto-rasengan': -8.8,
  'naruto-rasenshuriken': -11.3, 'kurama-link': -19.1, 'kurama-taunt': -19.7, 'kurama-growl': -21.5,
  'luffy-pistol': -17.7, 'luffy-bazooka': -17.4, 'luffy-king-kong': -15.8, 'zoro-onigiri': -16.3,
  'zoro-phoenix': -16.8, 'zoro-world': -15.4, 'jotaro-star': -16.7,
  'jotaro-world': -17.0, 'ichigo-mugetsu': -12.6, 'ace-hotarubi': -20.7, 'ace-kagero': -16.6,
  'law-injection-shot': -14.1, 'law-gamma-knife': -17.3, 'law-counter-shock': -18.0, 'gojo-ao': -16.8,
  'gojo-murasaki': -13.5, 'gojo-muryokusho': -13.2, 'dio-road-roller': -18.8, 'guts-scream': -19.1,
  'killua-narukami': -16.8, 'killua-shippu': -15.3,
};
function levelled(cue: AudioCue, gain: number) {
  const measured = MEASURED[cue];
  if (measured === undefined || Math.abs(LEVEL - measured) <= 1.5) return gain;
  return +(gain * 10 ** ((LEVEL - measured) / 20)).toFixed(3);
}

const PRIORITY: Record<AttackSlot, number> = { light: 0, heavy: 0, special: 1, ultimate: 2, area: 1 };
export const SUPER_LINE_PRIORITY = .5;
export const BIG_BANG_PRIORITY = .75;
export const AWAKENED_HEAVY_PRIORITY = BIG_BANG_PRIORITY;


interface Memory {
  seen: number;
  calledAt: number;
  quietUntil: number;
  lightAt: number;
  effortOnLight: boolean;
  lastEffort?: AudioCue;
  lastHeavy?: AudioCue;
  lastSpecial?: AudioCue;
  decided: Map<string, CueLayer[]>;
  spokeAt: Partial<Record<VoiceSituation, number>>;
  parryTried: number;
  lowSaid: boolean;
  saidAt: Map<SituationLine, number>;
  lastLine: Partial<Record<VoiceSituation, SituationLine>>;
  reacted: Map<string, CueLayer[]>;
}
const memories = new Map<string, Memory>();

function memoryOf(actorId: string, at: number): Memory {
  let memory = memories.get(actorId);
  if (!memory || at < memory.seen - REWIND)
    memory = { seen: at, calledAt: -Infinity, quietUntil: -Infinity, lightAt: -Infinity, effortOnLight: false, decided: new Map(),
      spokeAt: {}, parryTried: -Infinity, lowSaid: false, saidAt: new Map(), lastLine: {}, reacted: new Map() };
  memories.delete(actorId); memories.set(actorId, memory);
  if (memories.size > REMEMBERED) memories.delete(memories.keys().next().value!);
  memory.seen = Math.max(memory.seen, at);
  return memory;
}
function decide(memory: Memory, key: string, layers: CueLayer[]) {
  memory.decided.set(key, layers);
  if (memory.decided.size > DECISIONS) memory.decided.delete(memory.decided.keys().next().value!);
  return layers;
}

export function resetVoiceMemory() { memories.clear(); }

const castKey = (event: CombatEvent) => `${event.actionSeq ?? `#${event.id}`}:${event.slot}:${event.chain ?? 0}:${event.fighter}`;

export function voiceRoll(actorId: string, key: string, purpose: number): number {
  let h = (0x811c9dc5 ^ Math.imul(purpose, 0x9e3779b1)) >>> 0;
  const text = `${actorId}|${key}`;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function rotate(cues: readonly AudioCue[], roll: number, last?: AudioCue): AudioCue {
  let index = Math.min(cues.length - 1, Math.floor(roll * cues.length));
  if (cues.length > 1 && cues[index] === last) index = (index + 1) % cues.length;
  return cues[index];
}

const voice = (cue: AudioCue, gain: number, voicePriority: number, delay = 0, extra: Partial<CueLayer> = {}): CueLayer =>
  ({ cue, bus: 'voice', gain: levelled(cue, gain), voicePriority, phase: 'cast', ...(delay > 0 ? { delay } : {}), ...extra });


export interface VoiceScene { actor?: FighterId; target?: FighterId; targetHealth?: number }

const REACTIONS = new Set<CombatEvent['kind']>(['hit', 'wall-splat', 'ground-bounce', 'eliminated', 'just-guard', 'vanish', 'dodge', 'respawn']);
const THROWN = new Set<ReactionKind>(['launched', 'knockdown', 'splat']);
const PARRY_ONCE = .5;

function speak(memory: Memory, kind: VoiceSituation, fighter: FighterId, speaker: string, event: CombatEvent, share = 1): CueLayer[] {
  const rule = SITUATION_RULES[kind], at = event.serverTime;
  if (at - (memory.spokeAt[kind] ?? -Infinity) < rule.rest) return [];
  if (rule.chance * share < 1 && voiceRoll(speaker, `r${event.id}:${kind}`, 6) >= rule.chance * share) return [];
  const fresh = situationLines(fighter, kind).filter(line => at - (memory.saidAt.get(line) ?? -Infinity) >= rule.again);
  if (!fresh.length) return [];
  const last = memory.lastLine[kind];
  let index = Math.min(fresh.length - 1, Math.floor(voiceRoll(speaker, `r${event.id}:${kind}`, 7) * fresh.length));
  if (fresh.length > 1 && fresh[index] === last) index = (index + 1) % fresh.length;
  const line = fresh[index];
  memory.spokeAt[kind] = at; memory.saidAt.set(line, at); memory.lastLine[kind] = line;
  return [situationLayer(kind, line, speaker)];
}

export function planReaction(event: CombatEvent, scene: VoiceScene = {}): CueLayer[] {
  const at = event.serverTime, key = `${event.kind}#${event.id}`;
  const answer = (id: string, plan: (memory: Memory) => CueLayer[]): CueLayer[] => {
    const memory = memoryOf(id, at), known = memory.reacted.get(key);
    if (known) return known;
    const layers = plan(memory);
    memory.reacted.set(key, layers);
    if (memory.reacted.size > DECISIONS) memory.reacted.delete(memory.reacted.keys().next().value!);
    return layers;
  };
  const actor = scene.actor, target = scene.target, targetId = event.targetId;
  switch (event.kind) {
    case 'respawn': memoryOf(event.actorId, at).lowSaid = false; return [];
    case 'hit': {
      if (!target || !targetId || targetId === event.actorId) return [];
      return answer(targetId, memory => {
        const health = scene.targetHealth;
        if (health !== undefined && health <= 0) return [];
        if (health !== undefined && health > LOW_REARM) memory.lowSaid = false;
        if (memory.lowSaid && at - (memory.spokeAt.low ?? -Infinity) >= LOW_AGAIN) memory.lowSaid = false;
        if (health !== undefined && health <= LOW_HEALTH && !memory.lowSaid) {
          memory.lowSaid = true;
          const line = speak(memory, 'low', target, targetId, event);
          if (line.length) return line;
        }
        return cry(memory, event.reaction && THROWN.has(event.reaction) ? 'hurt-heavy' : 'hurt', target, targetId, event);
      });
    }
    case 'wall-splat': case 'ground-bounce': {
      return actor ? answer(event.actorId, memory => cry(memory, 'hurt-heavy', actor, event.actorId, event)) : [];
    }
    case 'eliminated': {
      const layers: CueLayer[] = [];
      if (target && targetId) layers.push(...answer(targetId, memory => { memory.lowSaid = false; return speak(memory, 'ko', target, targetId, event); }));
      if (actor && event.actorId && event.actorId !== targetId) layers.push(...answer(event.actorId, memory => speak(memory, 'kill', actor, event.actorId, event)));
      return layers;
    }
    case 'just-guard': case 'dodge': return target && targetId ? answer(targetId, memory => parry(memory, target, targetId, event, event.kind === 'dodge' ? DODGE_SHARE : 1)) : [];
    case 'vanish': return actor ? answer(event.actorId, memory => parry(memory, actor, event.actorId, event, 1)) : [];
    default: return [];
  }
}
function cry(memory: Memory, kind: 'hurt' | 'hurt-heavy', fighter: FighterId, speaker: string, event: CombatEvent): CueLayer[] {
  const at = event.serverTime, last = Math.max(memory.spokeAt.hurt ?? -Infinity, memory.spokeAt['hurt-heavy'] ?? -Infinity);
  if (at - last < SITUATION_RULES.hurt.rest) return [];
  const layers = speak(memory, kind, fighter, speaker, event);
  if (layers.length && kind === 'hurt-heavy') memory.spokeAt.hurt = at;
  return layers;
}
function parry(memory: Memory, fighter: FighterId, speaker: string, event: CombatEvent, share: number): CueLayer[] {
  if (event.serverTime - memory.parryTried < PARRY_ONCE) return [];
  memory.parryTried = event.serverTime;
  return speak(memory, 'parry', fighter, speaker, event, share);
}


export function planVoice(event: CombatEvent, awakened = false, scene?: VoiceScene): CueLayer[] {
  const fighter = event.fighter, slot = event.slot;
  if (REACTIONS.has(event.kind)) return planReaction(event, scene);
  if (event.kind === 'awaken') {
    if (fighter === 'naruto') return [voice('kurama-link', .9, 2)];
    if (fighter === 'guts') return [voice('guts-scream', .9, 1, .1)];
    if (fighter === 'kaido') return [voice('vo-kaido-laugh', .9, 2)];
    if (fighter === 'whitebeard') return [voice('vo-whitebeard-laugh', .9, 2)];
    if (fighter === 'aizen') return [voice('vo-aizen-hogyoku', .9, 2)];
    if (fighter === 'sukuna') return [voice('vo-sukuna-fun', .9, 2)];
    if (fighter === 'griffith') return [voice('vo-griffith-free', .9, 2)];
    if (fighter === 'meruem') return [voice('vo-meruem-power', .9, 2)];
    if (fighter === 'goku-black') return [voice('vo-goku-black-true-power', .9, 2)];
    if (fighter === 'jiren') return [voice('vo-jiren-come-all', .9, 2)];
    if (fighter === 'golden-frieza') return [voice('vo-golden-frieza-for-real', .9, 2)];
    if (fighter === 'saitama') return [voice('vo-saitama-serious-series', .9, 2)];
    if (fighter === 'akaza') return [voice('vo-akaza-technique', .9, 2)];
    if (fighter === 'levi') return [voice('vo-levi-choose', .9, 2)];
    if (fighter === 'madara') return [voice('vo-madara-end-this', .9, 2)];
    if (fighter === 'ichigo') return [voice('vo-ichigo-bankai', .95, 2, BANKAI.kai - BANKAI.kaiInLine, { phase: 'release' })];
    if (fighter === 'goku') return [voice('vo-goku-super-saiyan', .95, SUPER_LINE_PRIORITY, SUPER_SAIYAN.line, { phase: 'release' })];
    if (fighter === 'vegeta') return [voice('vo-vegeta-super-vegeta', .95, SUPER_LINE_PRIORITY, SUPER_VEGETA.line, { phase: 'release' })];
    if (fighter === 'todoroki') return [voice('vo-todoroki-phosphor', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'jinbe') return [voice('vo-jinbe-sea', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'sakura') return [voice('vo-sakura-hundred-healings', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'meliodas') return [voice('vo-meliodas-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'escanor') return [voice('vo-escanor-sunshine', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'tatsumaki') return [voice('vo-tatsumaki-serious', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'makima') return [voice('vo-makima-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'kenpachi') return [voice('vo-kenpachi-awaken', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'minato') return [voice('vo-minato-sage', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'nico-robin') return [voice('vo-nico-robin-gigante-fleur', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'kaiju-no-8') return [voice('vo-kaiju-no-8-resolve', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'eren') return [voice('vo-eren-stronger', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'asuka') return [voice('vo-asuka-sync', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'netero') return [voice('vo-netero-prayer', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'toji') return [voice('vo-toji-power-gap', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'usopp') return [voice('vo-usopp-resolve', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'crocodile') return [voice('vo-crocodile-to-sand', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'rengoku') return [voice('vo-rengoku-heart-ablaze', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'shinji') return [voice('vo-shinji-awaken', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'jolyne') return [voice('vo-jolyne-awakening', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'might-guy') return [voice('vo-might-guy-resolve', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'akame') return [voice('vo-akame-resolve', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'pikachu') return [voice('vo-pikachu-charge', .8, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'garou') return [voice('vo-garou-awakening', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'esdeath') return [voice('vo-esdeath-awaken', .85, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'mikasa') return [voice('vo-mikasa-own-will', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'alphonse-elric') return [voice('vo-alphonse-elric-resolve', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'ken-kaneki') return [voice('vo-ken-kaneki-awakening', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'grimmjow') return [voice('vo-grimmjow-awaken', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'byakuya') return [voice('vo-byakuya-bankai', .9, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'yamamoto') return [voice('vo-yamamoto-time-ripe', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'pain') return [voice('vo-pain-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'edward-elric') return [voice('vo-edward-elric-serious', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hiei') return [voice('vo-hiei-awaken', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'aokiji') return [voice('vo-aokiji-justice', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'doflamingo') return [voice('vo-doflamingo-ever-white', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hisoka') return [voice('vo-hisoka-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'blackbeard') return [voice('vo-blackbeard-strongest', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'nanami') return [voice('vo-nanami-overtime', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'josuke') return [voice('vo-josuke-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'tsunade') return [voice('vo-tsunade-hundred-healings', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'jiraiya') return [voice('vo-jiraiya-awaken', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'hinata') return [voice('vo-hinata-resolve', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'gintoki') return [voice('vo-gintoki-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'kizaru') return [voice('vo-kizaru-speed', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'yamato') return [voice('vo-yamato-oden', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'enel') return [voice('vo-enel-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'endeavor') return [voice('vo-endeavor-flashfire', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'yoruichi') return [voice('vo-yoruichi-shunko', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'yuta') return [voice('vo-yuta-ring-pact', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'rukia') return [voice('vo-rukia-bankai', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'yuji') return [voice('vo-yuji-awakening', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    if (fighter === 'broly') return [voice('vo-broly-unbound-fury', .95, SUPER_LINE_PRIORITY, 0, { phase: 'release' })];
    const named = fighter ? AWAKENING_LINES[fighter] : undefined;
    if (named) return [voice(named.cue, .95, SUPER_LINE_PRIORITY, named.line, { phase: 'release' })];
    return [];
  }
  if ((event.kind === 'confirm' || event.kind === 'release') && fighter && slot === 'ultimate') return cinematicVoice(event, fighter, awakened);
  if (event.kind !== 'cast' || !fighter || !slot) return [];
  const kurama = fighter === 'naruto' && awakened, kit = kurama ? KURAMA : KITS[fighter];
  if (!kit) return [];
  if (slot === 'light') return light(event, fighter, kit, awakened);
  if (event.branch) { const ender = comboMove(fighter, event.branch, awakened); return ender ? rationed(event, kit.enders?.[event.branch], slot, ender) : []; }
  const move = moveFor(fighter, slot, awakened);
  if (slot === 'area') { const cue = move.area?.voice as AudioCue | undefined; return cue ? [voice(cue, .95, PRIORITY.area)] : []; }
  if (kit.barrage && (slot === 'special' || slot === 'ultimate')) return stand(slot, move, kit);
  const swapped = awakened ? FORM_CALLS[fighter]?.[slot] : undefined;
  const call = swapped ?? kit.calls[slot];
  if (!call) return rationed(event, slot === 'heavy' ? kit.heavy : slot === 'special' ? kit.special : undefined, slot, move);
  const priority = (fighter === 'goku' || fighter === 'naruto') && !kurama ? 1
    : slot === 'heavy' && fighter === 'vegeta' ? BIG_BANG_PRIORITY
      : slot === 'heavy' && awakened && AWAKENING_LINES[fighter] ? AWAKENED_HEAVY_PRIORITY : PRIORITY[slot];
  const layers = [voice(call, kurama ? .85 : .95, priority, swapped ? 0 : kit.delays?.[slot] ?? 0)];
  return layers;
}

function cinematicStart(move: MoveDefinition) {
  return (move.timeStop?.contact ?? 0) + 1;
}

function cinematicVoice(event: CombatEvent, fighter: FighterId, awakened: boolean): CueLayer[] {
  const kit = fighter === 'naruto' && awakened ? KURAMA : KITS[fighter], move = moveFor(fighter, 'ultimate', awakened);
  if (!kit || !move.confirm) return [];
  const first = cinematicStart(move);
  if (first >= move.contacts.length) return [];
  let at: number;
  if (event.kind === 'confirm') { if (!kit.cinematic?.fromConfirm) return []; at = event.castAge ?? move.contacts[0]; }
  else { if (event.contactIndex !== first || kit.cinematic?.fromConfirm) return []; at = move.contacts[first]; }
  const priority = PRIORITY.ultimate, blow = move.contacts[move.contacts.length - 1];
  if (kit.barrage) return shift(standCinematic(move, kit), at);
  const line = kit.cinematic;
  if (!line) return [];
  return shift([voice(line.cue, .9, priority, Math.max(at, blow - line.lands))], at);
}

function shift(layers: CueLayer[], at: number): CueLayer[] {
  return layers.map(layer => {
    const from = (layer.delay ?? 0) - at, { delay: _delay, ...rest } = layer;
    const duration = layer.duration === undefined ? undefined : Math.max(.2, layer.duration + Math.min(0, from));
    return { ...rest, ...(from > 0 ? { delay: Math.round(from * 1000) / 1000 } : {}), ...(duration !== undefined ? { duration } : {}) };
  });
}

const LIGHT_PHASE: Partial<CueLayer> = { phase: 'release' };

function light(event: CombatEvent, fighter: FighterId, kit: VoiceKit, awakened: boolean): CueLayer[] {
  const memory = memoryOf(event.actorId, event.serverTime), key = castKey(event);
  const known = memory.decided.get(key);
  if (known) return known;
  const at = event.serverTime, stage = event.chain ?? 0, call = kit.calls.light;
  let layers: CueLayer[] = [];
  if (call && stage === 0 && at - memory.calledAt >= LIGHT_CALL_COOLDOWN && voiceRoll(event.actorId, key, 1) < LIGHT_CALL_CHANCE) {
    memory.calledAt = at; memory.quietUntil = at + cueDuration(call);
    layers = [voice(call, fighter === 'naruto' && awakened ? .85 : .95, 0, 0, LIGHT_PHASE)];
    memory.effortOnLight = false;
  } else if (kit.efforts.length && at >= memory.quietUntil && !(memory.effortOnLight && at - memory.lightAt < FLURRY)
    && voiceRoll(event.actorId, key, 2) < EFFORT_CHANCE) {
    const cue = rotate(kit.efforts, voiceRoll(event.actorId, key, 3), memory.lastEffort);
    memory.lastEffort = cue; memory.effortOnLight = true;
    const contact = rushMove(fighter, stage, awakened).contacts[0];
    layers = [voice(cue, .8, 0, Math.max(0, contact - EFFORT_LEAD), LIGHT_PHASE)];
  } else memory.effortOnLight = false;
  memory.lightAt = at;
  return decide(memory, key, layers);
}

function rationed(event: CombatEvent, bank: Rationed | undefined, slot: AttackSlot, move: MoveDefinition): CueLayer[] {
  if (!bank?.cues.length) return [];
  const memory = memoryOf(event.actorId, event.serverTime), key = castKey(event);
  const known = memory.decided.get(key);
  if (known) return known;
  if (voiceRoll(event.actorId, key, 4) >= (bank.chance ?? 1)) return decide(memory, key, []);
  const cue = rotate(bank.cues, voiceRoll(event.actorId, key, 5), slot === 'heavy' ? memory.lastHeavy : memory.lastSpecial);
  if (slot === 'heavy') memory.lastHeavy = cue; else memory.lastSpecial = cue;
  const delay = Math.max(0, move.contacts[0] - Math.min(.35, cueDuration(cue) * .3));
  return decide(memory, key, [voice(cue, .9, PRIORITY[slot], delay)]);
}

export function planBodyEffort(event: CombatEvent, body: FighterId): CueLayer[] {
  const fighter = event.fighter, slot = event.slot, kit = KITS[body];
  if (event.kind !== 'cast' || !fighter || !slot || !kit?.efforts.length) return [];
  const memory = memoryOf(event.actorId, event.serverTime), key = `${castKey(event)}:${body}`;
  const known = memory.decided.get(key);
  if (known) return known;
  const at = event.serverTime, light = slot === 'light';
  const quiet = at < memory.quietUntil || (light && memory.effortOnLight && at - memory.lightAt < FLURRY);
  if (light) memory.lightAt = at;
  if (quiet || (light && voiceRoll(event.actorId, key, 2) >= EFFORT_CHANCE)) { if (light) memory.effortOnLight = false; return decide(memory, key, []); }
  const cue = rotate(kit.efforts, voiceRoll(event.actorId, key, 3), memory.lastEffort);
  memory.lastEffort = cue; if (light) memory.effortOnLight = true;
  const move = light ? rushMove(fighter, 0, false) : moveFor(fighter, slot, false);
  return decide(memory, key, [voice(cue, light ? .8 : .9, light ? 0 : PRIORITY[slot], Math.max(0, (move.contacts[0] ?? 0) - EFFORT_LEAD), light ? LIGHT_PHASE : {})]);
}

const BARRAGE_LEAD = .04;
const BARRAGE_TAIL = .2;

function stand(slot: 'special' | 'ultimate', move: MoveDefinition, kit: VoiceKit): CueLayer[] {
  const call = kit.calls[slot], loop = kit.barrage!, priority = PRIORITY[slot];
  if (slot === 'ultimate' && move.confirm) {
    const window = barrageWindow(move);
    const room = window ? Math.max(0, window.start - BARRAGE_LEAD) - .02 : Infinity;
    return call ? [voice(call, .95, priority, 0, cueDuration(call) > room ? { duration: Math.max(.2, room) } : {})] : [];
  }
  const window = slot === 'ultimate' ? barrageWindow(move)
    : move.contacts.length > 1 ? { start: move.contacts[0], end: move.contacts[move.contacts.length - 1] } : null;
  if (!window) return call ? [voice(call, .95, priority)] : [];
  const layers: CueLayer[] = [];
  let start = Math.max(0, window.start - BARRAGE_LEAD);
  if (call) {
    const said = cueDuration(call), room = start - .02;
    if (slot === 'ultimate') layers.push(voice(call, .95, priority, 0, said > room ? { duration: Math.max(.2, room) } : {}));
    else if (said + .02 <= start) layers.push(voice(call, .95, priority));
  }
  const end = window.end + BARRAGE_TAIL;
  layers.push(voice(loop, .8, priority, start, { loop: true, duration: end - start }));
  if (slot === 'ultimate' && kit.finisher) {
    const blow = move.contacts[move.contacts.length - 1];
    layers.push(voice(kit.finisher.cue, .9, priority, Math.max(end + .02, blow - kit.finisher.lands)));
  }
  return layers;
}

function standCinematic(move: MoveDefinition, kit: VoiceKit): CueLayer[] {
  const window = barrageWindow(move), loop = kit.barrage!, priority = PRIORITY.ultimate;
  if (!window) return [];
  const start = Math.max(0, window.start - BARRAGE_LEAD), end = window.end + BARRAGE_TAIL;
  const layers = [voice(loop, .8, priority, start, { loop: true, duration: end - start })];
  if (kit.finisher) layers.push(voice(kit.finisher.cue, .9, priority, Math.max(end + .02, move.contacts[move.contacts.length - 1] - kit.finisher.lands)));
  return layers;
}
