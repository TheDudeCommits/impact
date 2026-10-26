import { NAME_FALLBACK, tidyName } from '../game/displayName';
import { OWN_NAMES } from '../game/economy/names';
import { ANYWHERE, LETTER, WORDS } from './economy/names';

const RESERVED_ANYWHERE = ['admin', 'moderator', 'official', 'jumpimpact', 'gamemaster', 'thedude'];
const RESERVED_WORDS = new Set(['mod', 'mods', 'owner', 'owners', 'staff', 'system', 'support', 'dev', 'devs', 'developer', 'developers',
  'gm', 'gms', 'sysop', 'dude', ...OWN_NAMES]);

const LOOKALIKE: Record<string, string> = Object.fromEntries([
  'аa вb гr еe ѕs іi јj кk мm нh оo пn рp сc тt уy хx шw щw ъb ьb һh ԁd ԛq ԝw ӏl ғf',
  'АA ВB ЕE ЅS ІI ЈJ КK МM НH ОO РP СC ТT УY ХX ԀD ԚQ ԜW ӀI ЬB',
  'αa βb γy δd εe ηn ιi κk μu νv οo πn ρp σo ςc τt υu χx ωw ϲc ϳj',
  'ΑA ΒB ΕE ΖZ ΗH ΙI ΚK ΜM ΝN ΟO ΡP ΤT ΥY ΧX ϹC ͿJ',
  'ᴀa ʙb ᴄc ᴅd ᴇe ɢg ʜh ɪi ᴊj ᴋk ʟl ᴍm ɴn ᴏo ᴘp ʀr ꜱs ᴛt ᴜu ᴠv ᴡw ʏy ᴢz ıi ȷj łl øo đd ħh ŧt ƀb ɑa ɡg ɩi ǀl',
].join(' ').split(' ').map(pair => [...pair] as [string, string]));
const SEPARATORS = /[\s\-_.']+/gu, EDGE_DIGITS = /^\d+|\d+$/g;

function latin(text: string) {
  let out = '';
  for (const each of text.normalize('NFKD').replace(/\p{M}/gu, '')) out += LOOKALIKE[each] ?? each;
  return out.toLowerCase();
}
function readings(word: string): string[] {
  const read = word.replace(/[0-9@$]/g, digit => LETTER[digit] ?? digit);
  return [...new Set([read, word.replace(/1/g, 'l').replace(/[0-9@$]/g, digit => LETTER[digit] ?? digit), read.replace(/l/g, 'i').replace(/rn/g, 'm')])];
}

export function refusedName(name: string): boolean {
  const whole = readings(latin(name).replace(SEPARATORS, ''));
  if (whole.some(reading => ANYWHERE.some(word => reading.includes(word)) || RESERVED_ANYWHERE.some(word => reading.includes(word)) || WORDS.has(reading) || RESERVED_WORDS.has(reading))) return true;
  const words = name.split(SEPARATORS).flatMap(part => part.split(/(?<=\p{Ll})(?=\p{Lu})/u)).map(latin).filter(Boolean);
  return words.some(word => [word, word.replace(EDGE_DIGITS, '')].flatMap(readings).some(reading => WORDS.has(reading) || RESERVED_WORDS.has(reading)));
}

export function displayName(raw: unknown, max = 20): string {
  if (typeof raw !== 'string') return NAME_FALLBACK;
  const name = tidyName(raw, max, true);
  return name === NAME_FALLBACK || refusedName(name) || refusedName(tidyName(raw, max)) ? NAME_FALLBACK : name;
}

export function heldKeys(name: string): string[] {
  const base = latin(name);
  return [...new Set([base, base.replace(SEPARATORS, '_'), base.replace(SEPARATORS, '')])];
}
