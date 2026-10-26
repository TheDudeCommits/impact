import { take, type Family } from './survivalBank';
import type { AudioCue } from './cuePlan';

export type BossMoment = 'entrance' | 'attack' | 'hurt' | 'rage' | 'defeat';
type Timbre = 'man' | 'beast' | 'brute' | 'fox';
interface BossVoice { timbre: Timbre; pitch: number; own?: Partial<Record<BossMoment, readonly string[]>>; moves?: Record<string, readonly string[]>;
  signatures?: Record<string, readonly string[]> }

export const BOSS_VOICES: Record<string, BossVoice> = {
  kaku: { timbre: 'man', pitch: 1.05 }, jabra: { timbre: 'beast', pitch: 1 }, blueno: { timbre: 'man', pitch: .8 },
  sentomaru: { timbre: 'man', pitch: .8 }, grimmjow: { timbre: 'beast', pitch: 1.05 }, 'hollow-ichigo': { timbre: 'beast', pitch: 1.18 },
  lucci: { timbre: 'beast', pitch: .86 }, ulquiorra: { timbre: 'man', pitch: .95 }, king: { timbre: 'brute', pitch: .92 },
  kenpachi: { timbre: 'man', pitch: .84 }, katakuri: { timbre: 'man', pitch: .78 }, aokiji: { timbre: 'man', pitch: .82 },
  kizaru: { timbre: 'man', pitch: .9 }, akainu: { timbre: 'man', pitch: .74 }, bigmom: { timbre: 'brute', pitch: 1.22 },
  'goku-black': { timbre: 'man', pitch: 1.02 }, 'golden-frieza': { timbre: 'man', pitch: 1.2 }, aizen: { timbre: 'man', pitch: .88 },
  kurama: { timbre: 'fox', pitch: 1 }, jiren: { timbre: 'man', pitch: .72 }, kaido: { timbre: 'brute', pitch: .78 }, 'kaido-hybrid': { timbre: 'brute', pitch: .62 },
  whitebeard: { timbre: 'man', pitch: .68 }, blackbeard: { timbre: 'man', pitch: .82 }, madara: { timbre: 'man', pitch: .9 },
  jabba: { timbre: 'brute', pitch: .74 }, dio: { timbre: 'man', pitch: 1 }, sukuna: { timbre: 'man', pitch: .86 }, griffith: { timbre: 'man', pitch: 1.08 },
  meruem: { timbre: 'beast', pitch: .9 },
};

const FAMILY: Record<Exclude<Timbre, 'fox'>, Record<BossMoment, Family>> = {
  man: { entrance: 'man-cry', attack: 'man-swing', hurt: 'man-hurt', rage: 'man-cry', defeat: 'man-die' },
  beast: { entrance: 'beast-roar', attack: 'beast-swing', hurt: 'beast-hurt', rage: 'beast-roar', defeat: 'beast-die' },
  brute: { entrance: 'brute-roar', attack: 'brute-roar', hurt: 'beast-hurt', rage: 'brute-roar', defeat: 'beast-die' },
};
const FOX: Record<BossMoment, AudioCue> = { entrance: 'kurama-taunt', attack: 'kurama-bite', hurt: 'kurama-growl', rage: 'kurama-growl', defeat: 'kurama-growl' };

const OWN: Record<string, { entrance?: string[]; rage?: string[]; hurt?: string[]; defeat?: string[]; attack?: string[]; moves?: Record<string, string[]>; signatures?: Record<string, string[]> }> = {
  aizen: { entrance: ['aizen-begin', 'aizen-my-sword'], rage: ['aizen-hogyoku'], hurt: ['aizen-careless'], defeat: ['aizen-impossible'], attack: ['aizen-finish', 'aizen-weak'],
    moves: { 'Hadō #90: Kurohitsugi': ['aizen-kurohitsugi'], 'Senjū Kōten Taihō': ['aizen-senju-koten-taiho'] } },
  akainu: { entrance: ['akainu-righteous', 'akainu-ends'], rage: ['akainu-dance'], hurt: ['akainu-annoying'], defeat: ['akainu-careless'], moves: { 'Great Eruption': ['akainu-dai-funka'], 'Meteor Volcano': ['akainu-ryusei-kazan'], 'Hell Hound': ['akainu-inugami-guren'] } },
  aokiji: { entrance: ['aokiji-arara', 'aokiji-seriously'], rage: ['aokiji-you-did-it'], hurt: ['aokiji-whoa'], defeat: ['aokiji-really'], moves: { 'Ice Age': ['aokiji-ice-age'] } },
  bigmom: { entrance: ['bigmom-crush', 'bigmom-sweets'], rage: ['bigmom-laugh', 'bigmom-whos-next'], hurt: ['bigmom-guh'], defeat: ['bigmom-unpleasant'], attack: ['bigmom-take-this'], moves: { 'Zeus Breeze Tempo': ['bigmom-zeus'] } },
  blackbeard: { entrance: ['blackbeard-feast', 'blackbeard-laugh'], rage: ['blackbeard-strongest', 'blackbeard-laugh2'], hurt: ['blackbeard-damn'], defeat: ['blackbeard-impossible'], attack: ['blackbeard-ora', 'blackbeard-useless'], moves: { Liberation: ['blackbeard-liberation'], 'Black Hole Rush': ['blackbeard-black-hole'] } },
  blueno: { entrance: ['blueno-justice'], rage: ['blueno-how-long'], hurt: ['blueno-hmph'], defeat: ['blueno-absurd'], moves: { 'Rankyaku Slam': ['blueno-rankyaku'], 'Air Door Kick': ['blueno-air-door'], 'Tekkai Jab': ['blueno-tekkai'] } },
  'goku-black': { entrance: ['goku-black-zero-mortals', 'goku-black-breath-stops', 'goku-black-instant'], rage: ['goku-black-laugh', 'goku-black-true-power'], hurt: ['goku-black-dont-underestimate'],
    defeat: ['goku-black-impossible'], attack: ['goku-black-finish', 'goku-black-retribution'], moves: { 'Black Kamehameha': ['goku-black-kamehameha'] } },
  'golden-frieza': { entrance: ['golden-frieza-revenge'], rage: ['golden-frieza-laugh', 'golden-frieza-for-real'], hurt: ['golden-frieza-curse-you'], defeat: ['golden-frieza-blunder'],
    attack: ['golden-frieza-vanish', 'golden-frieza-die', 'golden-frieza-over'] },
  grimmjow: { entrance: ['grimmjow-waited'], rage: ['grimmjow-pantera'], attack: ['grimmjow-laugh'], moves: { 'Desgarrón': ['grimmjow-desgarron'] } },
  jabba: { entrance: ['jabba-laugh'], rage: ['jabba-laugh-2'], attack: ['jabba-huttese'] },
  jabra: { entrance: ['jabra-wolf'], rage: ['jabra-true-power'], hurt: ['jabra-tch'], defeat: ['jabra-tekkai'], attack: ['jabra-soru'], moves: { 'Iron Body Fist': ['jabra-tekkai-kenpo'] } },
  jiren: { entrance: ['jiren-no-chance', 'jiren-come-all'], rage: ['jiren-finish'], hurt: ['jiren-this-power'], defeat: ['jiren-defeated'], attack: ['jiren-vanish', 'jiren-fall', 'jiren-take'] },
  kaido: { entrance: ['kaido-greatest-war', 'kaido-who-am-i'], rage: ['kaido-laugh', 'kaido-boring-world'], defeat: ['kaido-no-choice'], attack: ['kaido-kill', 'kaido-ora'], moves: { 'Thunder Bagua': ['kaido-raimei-hakke'] } },
  'kaido-hybrid': { entrance: ['kaido-hybrid-said-kill'], rage: ['kaido-hybrid-laugh'], defeat: ['kaido-hybrid-what-the'], attack: ['kaido-hybrid-wont-escape'], moves: { 'Thunder Bagua': ['kaido-hybrid-raimei-hakke'], 'Bolo Breath': ['kaido-hybrid-bolo-breath'] } },
  kaku: { entrance: ['kaku-excited', 'kaku-leave-it'], rage: ['kaku-hell'], hurt: ['kaku-kuku'], defeat: ['kaku-curse'], moves: { 'Rankyaku Snap': ['kaku-rankyaku'], 'Amane Dachi': ['kaku-amane-dachi'] } },
  katakuri: { entrance: ['katakuri-read-moves', 'katakuri-useless'], rage: ['katakuri-end'], hurt: ['katakuri-blast'], defeat: ['katakuri-unforeseen'], attack: ['katakuri-take'] },
  kenpachi: { entrance: ['kenpachi-cut-you', 'kenpachi-fun'], rage: ['kenpachi-fight-to-death', 'kenpachi-come-kill'], hurt: ['kenpachi-what'], defeat: ['kenpachi-boring'] },
  king: { entrance: ['king-one-king', 'king-creature'], rage: ['king-cost', 'king-know-place'], attack: ['king-in-two', 'king-over'] },
  kizaru: { entrance: ['kizaru-troubling', 'kizaru-you-did-it'], rage: ['kizaru-too-late'], hurt: ['kizaru-that-hurts'], defeat: ['kizaru-overdid'], attack: ['kizaru-too-slow'], moves: { 'Yasakani no Magatama': ['kizaru-yasakani'] } },
  lucci: { entrance: ['lucci-dark-justice', 'lucci-evil'], rage: ['lucci-not-a-game'], hurt: ['lucci-insolent'], defeat: ['lucci-cornered'], attack: ['lucci-vanish'], moves: { Rokuogan: ['lucci-rokuogan'], 'Shigan Barrage': ['lucci-shigan'] } },
  madara: { entrance: ['madara-real-fight', 'madara-entertain'], rage: ['madara-end-this', 'madara-despair'], hurt: ['madara-cornered'], defeat: ['madara-wretch'],
    attack: ['madara-shatter', 'madara-blow-away', 'madara-its-over'], moves: { 'Majestic Destroyer Flame': ['madara-goka-mekkyaku'], 'Tengai Shinsei': ['madara-tengai-shinsei'] } },
  sentomaru: { entrance: ['sentomaru-guard'], rage: ['sentomaru-waited'], hurt: ['sentomaru-guwa'], defeat: ['sentomaru-uncle'], attack: ['sentomaru-ora'], moves: { 'Ashigara Dokkoi': ['sentomaru-ashigara'] } },
  ulquiorra: { entrance: ['ulquiorra-despair', 'ulquiorra-despair-begins'], rage: ['ulquiorra-release', 'ulquiorra-segunda-etapa'], hurt: ['ulquiorra-little'], defeat: ['ulquiorra-espada'],
    attack: ['ulquiorra-vanish', 'ulquiorra-blown', 'ulquiorra-dust'], moves: { 'Lanza del Relámpago': ['ulquiorra-lanza'], 'Cero Oscuras': ['ulquiorra-cero-oscuras'] } },
  'hollow-ichigo': { entrance: ['hollow-ichigo-king', 'hollow-ichigo-zangetsu'], rage: ['hollow-ichigo-finish'], hurt: ['hollow-ichigo-interesting'], attack: ['hollow-ichigo-kill', 'hollow-ichigo-give-up'],
    moves: { 'Getsuga Tenshō': ['hollow-ichigo-getsuga'] } },
  dio: { entrance: ['dio-laugh'], rage: ['dio-laugh'], hurt: ['dio-hun'], attack: ['dio-muda', 'dio-mudada', 'dio-take-this'],
    moves: { 'Muda Muda Barrage': ['dio-muda-muda'], 'ZA WARUDO': ['dio-za-warudo'] }, signatures: { 'ZA WARUDO': ['dio-za-warudo'], 'ROAD ROLLER DA!': ['dio-road-roller'] } },
  sukuna: { entrance: ['sukuna-shall-we', 'sukuna-come-at-me'], rage: ['sukuna-getting-fun', 'sukuna-difference'], hurt: ['sukuna-tch'], attack: ['sukuna-carve', 'sukuna-eyesore', 'sukuna-die'],
    moves: { Dismantle: ['sukuna-kai'], Cleave: ['sukuna-hachi'], 'Open: Fuga': ['sukuna-fuga'] },
    signatures: { DISMANTLE: ['sukuna-kai'], 'MALEVOLENT SHRINE': ['sukuna-domain'], 'OPEN: FUGA': ['sukuna-fuga'] } },
  meruem: { entrance: ['meruem-summit', 'meruem-begin'], rage: ['meruem-power', 'meruem-its-coming'], hurt: ['meruem-what'], defeat: ['meruem-checkmate'], attack: ['meruem-vanish', 'meruem-prepare', 'meruem-finish'],
    signatures: { 'THE KING LEARNS': ['meruem-i-can-read'] } },
  griffith: { entrance: ['griffith-you-are-mine', 'griffith-i-like-you'], rage: ['griffith-free'], hurt: ['griffith-no'], defeat: ['griffith-want-to-know'], attack: ['griffith-wont-allow', 'griffith-tear-away'] },
  whitebeard: { entrance: ['whitebeard-iam', 'whitebeard-step-forward'], rage: ['whitebeard-laugh', 'whitebeard-lets-go'], hurt: ['whitebeard-gu'], defeat: ['whitebeard-brat'] },
};
const url = (name: string) => `/assets/audio/survival/boss-${name}.m4a`;
for (const [id, lines] of Object.entries(OWN)) {
  const voice = BOSS_VOICES[id];
  if (!voice) continue;
  const { moves, signatures, ...moments } = lines;
  voice.own = Object.fromEntries(Object.entries(moments).map(([moment, names]) => [moment, names!.map(url)]));
  if (moves) voice.moves = Object.fromEntries(Object.entries(moves).map(([move, names]) => [move, names.map(url)]));
  if (signatures) voice.signatures = Object.fromEntries(Object.entries(signatures).map(([name, names]) => [name, names.map(url)]));
}

export const BOSS_LINE_FILES: readonly string[] = Object.values(OWN).flatMap(lines => [...Object.entries(lines).filter(([k]) => k !== 'moves' && k !== 'signatures').flatMap(([, v]) => v as string[]), ...Object.values(lines.moves ?? {}).flat(), ...Object.values(lines.signatures ?? {}).flat()]).map(url);

export function signatureLine(enemy: string, name: string | undefined): string | undefined {
  const lines = name ? BOSS_VOICES[enemy]?.signatures?.[name] : undefined;
  return lines?.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;
}

export function moveLine(enemy: string, move: string | undefined): string | undefined {
  const lines = move ? BOSS_VOICES[enemy]?.moves?.[move] : undefined;
  return lines?.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;
}
export function ownLine(enemy: string, moment: BossMoment): string | undefined {
  const lines = BOSS_VOICES[enemy]?.own?.[moment];
  return lines?.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;
}
export function linesOf(enemy: string): string[] {
  const voice = BOSS_VOICES[enemy];
  return voice ? [...Object.values(voice.own ?? {}).flat(), ...Object.values(voice.moves ?? {}).flat(), ...Object.values(voice.signatures ?? {}).flat()] as string[] : [];
}
export function voicedOnCast(enemy: string) { const voice = BOSS_VOICES[enemy]; return !!(voice?.moves || voice?.own?.attack?.length); }
export function attackShout(enemy: string): string | undefined {
  const lines = BOSS_VOICES[enemy]?.own?.attack;
  return lines?.length ? lines[Math.floor(Math.random() * lines.length)] : undefined;
}

export type BossLine = { url: string; rate: number } | { cue: AudioCue; rate: number };

export function bossLine(enemy: string, moment: BossMoment, random = Math.random): BossLine | undefined {
  const voice = BOSS_VOICES[enemy];
  if (!voice) return undefined;
  if (moment === 'attack' && voicedOnCast(enemy)) return undefined;
  if (voice.own?.[moment]?.length) return undefined;
  const rate = voice.pitch * (.96 + random() * .08);
  if (voice.timbre === 'fox') return { cue: FOX[moment], rate };
  return { url: take(FAMILY[voice.timbre][moment], random), rate };
}
