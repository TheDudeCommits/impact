import type { FighterId } from '../game/types';
import type { AudioCue, CueLayer } from './cueTypes';
import { cueDuration } from './cueTypes';
import { FIGHTER_QUIPS } from './quipCues';
import RIFT_LEVELS from './data/riftLineLevels.json';
import REJECTS from './data/voiceRejects.json';
import CUT_LINES from './data/situationLines.json';

export type VoiceSituation = 'hurt' | 'hurt-heavy' | 'ko' | 'kill' | 'bell' | 'parry' | 'low' | 'taunt' | 'win' | 'loss';
export const VOICE_SITUATIONS: readonly VoiceSituation[] = ['hurt', 'hurt-heavy', 'ko', 'kill', 'bell', 'parry', 'low', 'taunt', 'win', 'loss'];

export type SituationLine = AudioCue | `rift:${string}`;

export interface SituationRule {
  chance: number;
  rest: number;
  again: number;
  priority: number;
  gain: number;
  delay: number;
  yields?: 'self' | 'all';
  longest: number;
}

export const SITUATION_RULES: Record<VoiceSituation, SituationRule> = {
  hurt: { chance: .25, rest: 1.2, again: 4, priority: -1, gain: .7, delay: 0, yields: 'all', longest: .9 },
  'hurt-heavy': { chance: .6, rest: 2.5, again: 6, priority: -.5, gain: .78, delay: 0, yields: 'all', longest: 1.7 },
  ko: { chance: 1, rest: 0, again: 0, priority: 1.5, gain: .9, delay: 0, longest: 2.6 },
  kill: { chance: 1, rest: 8, again: 30, priority: 1, gain: .82, delay: .6, yields: 'self', longest: 2.6 },
  bell: { chance: 1, rest: 20, again: 0, priority: 1, gain: .85, delay: 0, yields: 'self', longest: 3.5 },
  parry: { chance: 1, rest: 20, again: 30, priority: .5, gain: .8, delay: .15, yields: 'self', longest: 2 },
  low: { chance: 1, rest: 0, again: 30, priority: 1, gain: .82, delay: .2, yields: 'self', longest: 3.3 },
  taunt: { chance: 1, rest: 8, again: 0, priority: .5, gain: .82, delay: 0, yields: 'self', longest: 3.5 },
  win: { chance: 1, rest: 0, again: 0, priority: 1, gain: .85, delay: 0, longest: 4 },
  loss: { chance: 1, rest: 0, again: 0, priority: 1, gain: .8, delay: 0, longest: 4 },
};
export const LOW_HEALTH = .3, LOW_REARM = .6;
export const DODGE_SHARE = .25;
export const LOW_AGAIN = 90;

type Lines = Partial<Record<VoiceSituation, readonly SituationLine[]>>;

const LINES: Partial<Record<FighterId, Lines>> = {
  aizen: { bell: ['rift:aizen-begin'], taunt: ['rift:aizen-my-sword'], kill: ['rift:aizen-finish'], 'hurt-heavy': ['rift:aizen-careless'], ko: ['rift:aizen-impossible'] },
  akainu: { bell: ['rift:akainu-ends'], low: ['rift:akainu-dance', 'rift:akainu-annoying'], ko: ['rift:akainu-careless'] },
  akame: { bell: ['vo-akame-ready'], taunt: ['vo-akame-quip-insult'], win: ['vo-akame-victory'] },
  'alphonse-elric': { win: ['vo-alphonse-elric-quip-done', 'vo-alphonse-elric-quip-safe'] },
  aokiji: { bell: ['rift:aokiji-arara'], taunt: ['rift:aokiji-seriously'], low: ['rift:aokiji-you-did-it'], hurt: ['rift:aokiji-whoa'], ko: ['rift:aokiji-really'], win: ['vo-aokiji-quip-win'] },
  asuka: { bell: ['vo-asuka-ready'], win: ['vo-asuka-quip-easy'] },
  blackbeard: { bell: ['vo-blackbeard-quip-banquet'], taunt: ['vo-blackbeard-quip-taunt', 'rift:blackbeard-laugh'], parry: ['rift:blackbeard-useless'],
    low: ['rift:blackbeard-laugh2'], 'hurt-heavy': ['rift:blackbeard-damn'], ko: ['rift:blackbeard-impossible'] },
  byakuya: { kill: ['vo-byakuya-finish'], low: ['vo-byakuya-quip-interest'], taunt: ['vo-byakuya-quip-pride'] },
  crocodile: { parry: ['vo-crocodile-ineffective'], ko: ['vo-crocodile-fool'] },
  dio: { taunt: ['rift:dio-laugh'], hurt: ['rift:dio-hun'] },
  doflamingo: { bell: ['vo-doflamingo-quip-execution'] },
  'edward-elric': { parry: ['vo-edward-elric-too-slow'], win: ['vo-edward-elric-quip-finish'] },
  enel: { taunt: ['vo-enel-quip-pride'], parry: ['vo-enel-quip-impressed'] },
  eren: { bell: ['vo-eren-strike'] },
  escanor: { win: ['vo-escanor-quip-win'] },
  esdeath: { taunt: ['vo-esdeath-quip-ready'], win: ['vo-esdeath-resolve'] },
  garou: { taunt: ['vo-garou-quip-monster'], low: ['vo-garou-quip-grow'] },
  gintoki: { low: ['vo-gintoki-quip-rival'] },
  'goku-black': { low: ['rift:goku-black-laugh', 'rift:goku-black-dont-underestimate'], ko: ['rift:goku-black-impossible'] },
  'golden-frieza': { bell: ['rift:golden-frieza-revenge'], 'hurt-heavy': ['rift:golden-frieza-curse-you'], ko: ['rift:golden-frieza-blunder'] },
  griffith: { bell: ['rift:griffith-i-like-you'], taunt: ['rift:griffith-tear-away'], 'hurt-heavy': ['vo-griffith-no'], loss: ['rift:griffith-want-to-know'] },
  grimmjow: { bell: ['vo-grimmjow-quip-ready'], taunt: ['rift:grimmjow-laugh'] },
  hiei: { bell: ['vo-hiei-ready', 'vo-hiei-quip-ready'] },
  hisoka: { low: ['vo-hisoka-quip-interested'], win: ['vo-hisoka-quip-finish'] },
  jiraiya: { bell: ['vo-jiraiya-quip-ready'], win: ['vo-jiraiya-quip-training'] },
  jiren: { bell: ['rift:jiren-no-chance'], 'hurt-heavy': ['rift:jiren-this-power'], ko: ['rift:jiren-defeated'] },
  jolyne: { parry: ['vo-jolyne-quip-stay-away'] },
  josuke: { bell: ['vo-josuke-quip-rival'] },
  kaido: { bell: ['rift:kaido-who-am-i'], taunt: ['rift:kaido-kill'], ko: ['rift:kaido-no-choice'] },
  'kaiju-no-8': { bell: ['vo-kaiju-no-8-strike'] },
  'ken-kaneki': { bell: ['vo-ken-kaneki-quip-name'], loss: ['vo-ken-kaneki-quip-why'] },
  kenpachi: { bell: ['vo-kenpachi-quip-ready', 'rift:kenpachi-cut-you'], taunt: ['rift:kenpachi-fun'], 'hurt-heavy': ['rift:kenpachi-what'], ko: ['rift:kenpachi-boring'] },
  kizaru: { bell: ['vo-kizaru-go', 'rift:kizaru-troubling'], taunt: ['vo-kizaru-quip-challenge'], parry: ['rift:kizaru-too-slow'],
    low: ['rift:kizaru-too-late', 'rift:kizaru-that-hurts'], loss: ['rift:kizaru-overdid'] },
  madara: { bell: ['rift:madara-entertain'], taunt: ['rift:madara-despair'], low: ['rift:madara-cornered'], ko: ['rift:madara-wretch'] },
  makima: { kill: ['vo-makima-quip-thanks'], win: ['vo-makima-quip-victory'] },
  meliodas: { win: ['vo-meliodas-quip-victory'] },
  meruem: { bell: ['rift:meruem-begin'], 'hurt-heavy': ['rift:meruem-what'], loss: ['rift:meruem-checkmate'] },
  'might-guy': { low: ['vo-might-guy-quip-fire'] },
  minato: { win: ['vo-minato-quip-victory'] },
  nanami: { parry: ['vo-nanami-there'], win: ['vo-nanami-quip-win'] },
  netero: { bell: ['vo-netero-quip-play'], loss: ['vo-netero-quip-growth'] },
  'nico-robin': { win: ['vo-nico-robin-quip-teamwork', 'vo-nico-robin-quip-thanks'] },
  pain: { win: ['vo-pain-quip-victory'] },
  rengoku: { bell: ['vo-rengoku-begin'] },
  shinji: { low: ['vo-shinji-resolve'], ko: ['vo-shinji-quip-surprise'], win: ['vo-shinji-victory'] },
  sukuna: { bell: ['rift:sukuna-shall-we'], taunt: ['rift:sukuna-come-at-me'], kill: ['rift:sukuna-eyesore'], low: ['rift:sukuna-difference'] },
  tatsumaki: { bell: ['vo-tatsumaki-quip-result'] },
  todoroki: { bell: ['vo-todoroki-quip-focus'] },
  toji: { bell: ['vo-toji-no-time'], taunt: ['vo-toji-pierce'] },
  usopp: { bell: ['vo-usopp-cover'], taunt: ['vo-usopp-try-this'], hurt: ['vo-usopp-hurt'], win: ['vo-usopp-experience'] },
  whitebeard: { bell: ['rift:whitebeard-iam'], hurt: ['vo-whitebeard-gu'], ko: ['rift:whitebeard-brat'] },
  yamato: { bell: ['vo-yamato-quip-challenge'] },
  yoruichi: { bell: ['vo-yoruichi-quip-challenge'] },
};

for (const [fighter, kinds] of Object.entries(CUT_LINES as Record<string, Partial<Record<VoiceSituation, string[]>>>)) {
  const lines = (LINES[fighter as FighterId] ??= {}) as Record<VoiceSituation, readonly SituationLine[]>;
  for (const [kind, cues] of Object.entries(kinds) as [VoiceSituation, string[]][]) lines[kind] = [...(lines[kind] ?? []), ...(cues as SituationLine[])];
}

const REJECTED = new Set((REJECTS as { rejected: { fighter: string; kind: string; line: string }[] }).rejected.map(row => `${row.fighter}|${row.kind}|${row.line}`));
const kept = (fighter: FighterId, kind: VoiceSituation, lines: readonly SituationLine[], whole = false) =>
  REJECTED.size && !whole ? lines.filter(line => !REJECTED.has(`${fighter}|${kind}|${line}`)) : lines;

export function ownSituationLines(fighter: FighterId, kind: VoiceSituation, whole = false): readonly SituationLine[] {
  return kept(fighter, kind, LINES[fighter]?.[kind] ?? [], whole);
}

export type LineOrigin = 'own' | 'quip' | 'cry';

export function situationSources(fighter: FighterId, kind: VoiceSituation, whole = false): readonly { line: SituationLine; from: LineOrigin }[] {
  const own = ownSituationLines(fighter, kind, whole).map(line => ({ line, from: 'own' as LineOrigin }));
  const quips = FIGHTER_QUIPS[fighter];
  const quip = kind === 'kill' ? quips?.advantage : kind === 'low' || kind === 'parry' ? quips?.resolve : undefined;
  if (quip && !own.some(row => row.line === quip)) return [...own, ...kept(fighter, kind, [quip], whole).map(line => ({ line, from: 'quip' as LineOrigin }))];
  if (own.length) return own;
  const lighter: VoiceSituation | undefined = kind === 'ko' ? 'hurt-heavy' : kind === 'hurt-heavy' ? 'hurt' : undefined;
  if (!lighter) return own;
  return kept(fighter, kind, situationSources(fighter, lighter, whole).map(row => row.line), whole).map(line => ({ line, from: 'cry' as LineOrigin }));
}
export function situationLines(fighter: FighterId, kind: VoiceSituation): readonly SituationLine[] {
  return situationSources(fighter, kind).map(row => row.line);
}

const RIFT = RIFT_LEVELS as unknown as Record<string, [seconds: number, lufs: number]>;
export const isRift = (line: SituationLine): line is `rift:${string}` => line.startsWith('rift:');
export const riftUrl = (line: `rift:${string}`) => `/assets/audio/survival/boss-${line.slice(5)}.m4a`;
export function lineSeconds(line: SituationLine): number { return isRift(line) ? RIFT[line.slice(5)]?.[0] ?? 0 : cueDuration(line); }
const LEVEL = -16.5;
function trim(line: SituationLine): number {
  const measured = isRift(line) ? RIFT[line.slice(5)]?.[1] : undefined;
  return measured === undefined ? 1 : 10 ** ((LEVEL - measured) / 20);
}

export function situationLayer(kind: VoiceSituation, line: SituationLine, speaker: string, delay = 0): CueLayer {
  const rule = SITUATION_RULES[kind], wait = Math.round((rule.delay + delay) * 1000) / 1000;
  return { cue: isRift(line) ? 'swing-a' : line, ...(isRift(line) ? { url: riftUrl(line) } : {}), bus: 'voice', gain: +(rule.gain * trim(line)).toFixed(3),
    voicePriority: rule.priority, phase: 'impact', speaker, ...(wait > 0 ? { delay: wait } : {}), ...(rule.yields ? { yields: rule.yields } : {}) };
}

export function situationSamples(fighters: Iterable<string>): string[] {
  const urls = new Set<string>();
  for (const fighter of fighters) for (const kind of VOICE_SITUATIONS) for (const line of situationLines(fighter as FighterId, kind)) if (isRift(line)) urls.add(riftUrl(line));
  return [...urls];
}

export function allSituationLines(): { fighter: FighterId; kind: VoiceSituation; line: SituationLine; from: LineOrigin; seconds: number }[] {
  const rows: ReturnType<typeof allSituationLines> = [];
  const fighters = new Set<FighterId>([...Object.keys(LINES), ...Object.keys(FIGHTER_QUIPS)] as FighterId[]);
  for (const fighter of fighters) for (const kind of VOICE_SITUATIONS) for (const { line, from } of situationSources(fighter, kind)) rows.push({ fighter, kind, line, from, seconds: lineSeconds(line) });
  return rows;
}
export function listedSituationLines(): { fighter: FighterId; kind: VoiceSituation; line: SituationLine }[] {
  return (Object.entries(LINES) as [FighterId, Lines][]).flatMap(([fighter, lines]) =>
    (Object.entries(lines) as [VoiceSituation, readonly SituationLine[]][]).flatMap(([kind, list]) => list.map(line => ({ fighter, kind, line }))));
}
export const isRejected = (fighter: string, kind: string, line: string) => REJECTED.has(`${fighter}|${kind}|${line}`);
export function auditionRows(): { fighter: FighterId; kind: VoiceSituation; line: SituationLine; from: LineOrigin; seconds: number; rejected: boolean }[] {
  const fighters = new Set<FighterId>([...Object.keys(LINES), ...Object.keys(FIGHTER_QUIPS)] as FighterId[]);
  return [...fighters].flatMap(fighter => VOICE_SITUATIONS.flatMap(kind => situationSources(fighter, kind, true).map(({ line, from }) =>
    ({ fighter, kind, line, from, seconds: lineSeconds(line), rejected: isRejected(fighter, kind, line) }))));
}
