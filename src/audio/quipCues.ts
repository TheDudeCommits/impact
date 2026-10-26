import type { FighterId } from '../game/types';
import { ROSTER_QUIP_CUES, ROSTER_FIGHTER_QUIPS } from './rosterVoiceCues';
export const QUIP_CUES = {
  ...ROSTER_QUIP_CUES,
  'vo-goku-quip-resolve': 'voice/vo-goku-quip-resolve.wav',
  'vo-goku-quip-advantage': 'voice/vo-goku-quip-advantage.wav',
  'vo-naruto-quip-resolve': 'voice/vo-naruto-quip-resolve.wav',
  'vo-naruto-quip-advantage': 'voice/vo-naruto-quip-advantage.wav',
  'vo-luffy-quip-resolve': 'voice/vo-luffy-quip-resolve.wav',
  'vo-luffy-quip-advantage': 'voice/vo-luffy-quip-advantage.wav',
  'vo-zoro-quip-resolve': 'voice/vo-zoro-quip-resolve.wav',
  'vo-zoro-quip-advantage': 'voice/vo-zoro-quip-advantage.wav',
  'vo-sanji-quip-resolve': 'voice/vo-sanji-quip-resolve.wav',
  'vo-sanji-quip-advantage': 'voice/vo-sanji-quip-advantage.wav',
  'vo-vegeta-quip-resolve': 'voice/vo-vegeta-quip-resolve.wav',
  'vo-vegeta-quip-advantage': 'voice/vo-vegeta-quip-advantage.wav',
  'vo-kakashi-quip-resolve': 'voice/vo-kakashi-quip-resolve.wav',
  'vo-kakashi-quip-advantage': 'voice/vo-kakashi-quip-advantage.wav',
  'vo-sasuke-quip-resolve': 'voice/vo-sasuke-quip-resolve.wav',
  'vo-sasuke-quip-advantage': 'voice/vo-sasuke-quip-advantage.wav',
  'vo-jotaro-quip-resolve': 'voice/vo-jotaro-quip-resolve.wav',
  'vo-jotaro-quip-advantage': 'voice/vo-jotaro-quip-advantage.wav',
  'vo-ichigo-quip-resolve': 'voice/vo-ichigo-quip-resolve.wav',
  'vo-ichigo-quip-advantage': 'voice/vo-ichigo-quip-advantage.wav',
  'vo-ace-quip-resolve': 'voice/vo-ace-quip-resolve.wav',
  'vo-ace-quip-advantage': 'voice/vo-ace-quip-advantage.wav',
  'vo-law-quip-resolve': 'voice/vo-law-quip-resolve.wav',
  'vo-law-quip-advantage': 'voice/vo-law-quip-advantage.wav',
  'vo-dio-quip-resolve': 'voice/vo-dio-quip-resolve.wav',
  'vo-dio-quip-advantage': 'voice/vo-dio-quip-advantage.wav',
  'vo-guts-quip-resolve': 'voice/vo-guts-quip-resolve.wav',
  'vo-guts-quip-advantage': 'voice/vo-guts-quip-advantage.wav',
  'vo-killua-quip-resolve': 'voice/vo-killua-quip-resolve.wav',
  'vo-killua-quip-advantage': 'voice/vo-killua-quip-advantage.wav',
  'vo-kaido-quip-resolve': 'voice/vo-kaido-quip-resolve.wav',
  'vo-kaido-quip-advantage': 'voice/vo-kaido-quip-advantage.wav',
  'vo-whitebeard-quip-resolve': 'voice/vo-whitebeard-quip-resolve.wav',
  'vo-whitebeard-quip-advantage': 'voice/vo-whitebeard-quip-advantage.wav',
  'vo-shanks-quip-resolve': 'voice/vo-shanks-quip-resolve.wav',
  'vo-shanks-quip-advantage': 'voice/vo-shanks-quip-advantage.wav',
  'vo-roger-quip-resolve': 'voice/vo-roger-quip-resolve.wav',
  'vo-roger-quip-advantage': 'voice/vo-roger-quip-advantage.wav',
  'vo-aizen-quip-resolve': 'voice/vo-aizen-quip-resolve.wav',
  'vo-aizen-quip-advantage': 'voice/vo-aizen-quip-advantage.wav',
  'vo-sukuna-quip-resolve': 'voice/vo-sukuna-quip-resolve.wav',
  'vo-sukuna-quip-advantage': 'voice/vo-sukuna-quip-advantage.wav',
  'vo-griffith-quip-resolve': 'voice/vo-griffith-quip-resolve.wav',
  'vo-griffith-quip-advantage': 'voice/vo-griffith-quip-advantage.wav',
  'vo-meruem-quip-resolve': 'voice/vo-meruem-quip-resolve.wav',
  'vo-meruem-quip-advantage': 'voice/vo-meruem-quip-advantage.wav',
  'vo-goku-black-quip-resolve': 'voice/vo-goku-black-quip-resolve.wav',
  'vo-goku-black-quip-advantage': 'voice/vo-goku-black-quip-advantage.wav',
  'vo-jiren-quip-resolve': 'voice/vo-jiren-quip-resolve.wav',
  'vo-jiren-quip-advantage': 'voice/vo-jiren-quip-advantage.wav',
  'vo-golden-frieza-quip-resolve': 'voice/vo-golden-frieza-quip-resolve.wav',
  'vo-golden-frieza-quip-advantage': 'voice/vo-golden-frieza-quip-advantage.wav',
  'vo-gohan-beast-quip-resolve': 'voice/vo-gohan-beast-quip-resolve.wav',
  'vo-gohan-beast-quip-advantage': 'voice/vo-gohan-beast-quip-advantage.wav',
  'vo-saitama-quip-resolve': 'voice/vo-saitama-quip-resolve.wav',
  'vo-saitama-quip-advantage': 'voice/vo-saitama-quip-advantage.wav',
  'vo-akaza-quip-resolve': 'voice/vo-akaza-quip-resolve.wav',
  'vo-akaza-quip-advantage': 'voice/vo-akaza-quip-advantage.wav',
  'vo-itachi-quip-resolve': 'voice/vo-itachi-quip-resolve.wav',
  'vo-itachi-quip-advantage': 'voice/vo-itachi-quip-advantage.wav',
  'vo-madara-quip-resolve': 'voice/vo-madara-quip-resolve.wav',
  'vo-madara-quip-advantage': 'voice/vo-madara-quip-advantage.wav',
  'vo-tanjiro-quip-resolve': 'voice/vo-tanjiro-quip-resolve.wav',
  'vo-tanjiro-quip-advantage': 'voice/vo-tanjiro-quip-advantage.wav',
  'vo-levi-quip-resolve': 'voice/vo-levi-quip-resolve.wav',
  'vo-levi-quip-advantage': 'voice/vo-levi-quip-advantage.wav',
  'vo-gon-quip-resolve': 'voice/vo-gon-quip-resolve.wav',
  'vo-gon-quip-advantage': 'voice/vo-gon-quip-advantage.wav',
  'vo-gojo-quip-resolve': 'voice/vo-gojo-quip-resolve.wav',
  'vo-gojo-quip-advantage': 'voice/vo-gojo-quip-advantage.wav',
  'vo-sung-jinwoo-quip-resolve': 'voice/vo-sung-jinwoo-quip-resolve.wav',
  'vo-sung-jinwoo-quip-advantage': 'voice/vo-sung-jinwoo-quip-advantage.wav',
} as const;
export type QuipMoment = 'resolve' | 'advantage';
export const FIGHTER_QUIPS = {
  ...ROSTER_FIGHTER_QUIPS,
  "goku": {
    "resolve": "vo-goku-quip-resolve",
    "advantage": "vo-goku-quip-advantage"
  },
  "naruto": {
    "resolve": "vo-naruto-quip-resolve",
    "advantage": "vo-naruto-quip-advantage"
  },
  "luffy": {
    "resolve": "vo-luffy-quip-resolve",
    "advantage": "vo-luffy-quip-advantage"
  },
  "zoro": {
    "resolve": "vo-zoro-quip-resolve",
    "advantage": "vo-zoro-quip-advantage"
  },
  "sanji": {
    "resolve": "vo-sanji-quip-resolve",
    "advantage": "vo-sanji-quip-advantage"
  },
  "vegeta": {
    "resolve": "vo-vegeta-quip-resolve",
    "advantage": "vo-vegeta-quip-advantage"
  },
  "kakashi": {
    "resolve": "vo-kakashi-quip-resolve",
    "advantage": "vo-kakashi-quip-advantage"
  },
  "sasuke": {
    "resolve": "vo-sasuke-quip-resolve",
    "advantage": "vo-sasuke-quip-advantage"
  },
  "jotaro": {
    "resolve": "vo-jotaro-quip-resolve",
    "advantage": "vo-jotaro-quip-advantage"
  },
  "ichigo": {
    "resolve": "vo-ichigo-quip-resolve",
    "advantage": "vo-ichigo-quip-advantage"
  },
  "ace": {
    "resolve": "vo-ace-quip-resolve",
    "advantage": "vo-ace-quip-advantage"
  },
  "law": {
    "resolve": "vo-law-quip-resolve",
    "advantage": "vo-law-quip-advantage"
  },
  "dio": {
    "resolve": "vo-dio-quip-resolve",
    "advantage": "vo-dio-quip-advantage"
  },
  "guts": {
    "resolve": "vo-guts-quip-resolve",
    "advantage": "vo-guts-quip-advantage"
  },
  "killua": {
    "resolve": "vo-killua-quip-resolve",
    "advantage": "vo-killua-quip-advantage"
  },
  "kaido": {
    "resolve": "vo-kaido-quip-resolve",
    "advantage": "vo-kaido-quip-advantage"
  },
  "whitebeard": {
    "resolve": "vo-whitebeard-quip-resolve",
    "advantage": "vo-whitebeard-quip-advantage"
  },
  "shanks": {
    "resolve": "vo-shanks-quip-resolve",
    "advantage": "vo-shanks-quip-advantage"
  },
  "roger": {
    "resolve": "vo-roger-quip-resolve",
    "advantage": "vo-roger-quip-advantage"
  },
  "aizen": {
    "resolve": "vo-aizen-quip-resolve",
    "advantage": "vo-aizen-quip-advantage"
  },
  "sukuna": {
    "resolve": "vo-sukuna-quip-resolve",
    "advantage": "vo-sukuna-quip-advantage"
  },
  "griffith": {
    "resolve": "vo-griffith-quip-resolve",
    "advantage": "vo-griffith-quip-advantage"
  },
  "meruem": {
    "resolve": "vo-meruem-quip-resolve",
    "advantage": "vo-meruem-quip-advantage"
  },
  "goku-black": {
    "resolve": "vo-goku-black-quip-resolve",
    "advantage": "vo-goku-black-quip-advantage"
  },
  "jiren": {
    "resolve": "vo-jiren-quip-resolve",
    "advantage": "vo-jiren-quip-advantage"
  },
  "golden-frieza": {
    "resolve": "vo-golden-frieza-quip-resolve",
    "advantage": "vo-golden-frieza-quip-advantage"
  },
  "gohan-beast": {
    "resolve": "vo-gohan-beast-quip-resolve",
    "advantage": "vo-gohan-beast-quip-advantage"
  },
  "saitama": {
    "resolve": "vo-saitama-quip-resolve",
    "advantage": "vo-saitama-quip-advantage"
  },
  "akaza": {
    "resolve": "vo-akaza-quip-resolve",
    "advantage": "vo-akaza-quip-advantage"
  },
  "itachi": {
    "resolve": "vo-itachi-quip-resolve",
    "advantage": "vo-itachi-quip-advantage"
  },
  "madara": {
    "resolve": "vo-madara-quip-resolve",
    "advantage": "vo-madara-quip-advantage"
  },
  "tanjiro": {
    "resolve": "vo-tanjiro-quip-resolve",
    "advantage": "vo-tanjiro-quip-advantage"
  },
  "levi": {
    "resolve": "vo-levi-quip-resolve",
    "advantage": "vo-levi-quip-advantage"
  },
  "gon": {
    "resolve": "vo-gon-quip-resolve",
    "advantage": "vo-gon-quip-advantage"
  },
  "gojo": {
    "resolve": "vo-gojo-quip-resolve",
    "advantage": "vo-gojo-quip-advantage"
  },
  "sung-jinwoo": {
    "resolve": "vo-sung-jinwoo-quip-resolve",
    "advantage": "vo-sung-jinwoo-quip-advantage"
  }
} as const satisfies Record<FighterId, Record<QuipMoment, keyof typeof QUIP_CUES | undefined>>;
