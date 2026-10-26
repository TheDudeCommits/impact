import { STAGES as STAGE_DEFINITIONS, type StageId } from '../../game/stages';
import type { AirLook, CloudShadowLook, LeafShadowLook, LookPreset } from './stageLooks';

const enabled = typeof location === 'undefined' || new URLSearchParams(location.search).get('roan') !== '0';
export const roanEnabled = () => enabled;

const FIGHTER = { key: .9, neutral: .12, clip: [.62, .92] as const, ambient: 1.08, saturation: 1.16 };

type Override = (look: LookPreset) => void;
const STAGES: Partial<Record<StageId, Override>> = {
  'chunin-exam-room': look => {
    look.key.color = 0xffead2;
    look.hemi.sky = 0x88aed6; look.hemi.ground = 0x56625e; look.hemi.intensity = .78;
    look.fill.color = 0x8fb4ff;
    look.fog.color = 0xa4bcb4;
    look.albedo = { saturation: .55, tint: 0xc8dcd6 };
    look.room = { albedo: 1, key: .42 };
    look.ibl = .75;
    look.ground = { tint: 0xfcfcff, gain: 1.03, max: .8, amount: 1 };
    look.grade = { ...look.grade, highlightTint: 0xffe8c8, shadowTint: 0x2e4c9a, split: .3, saturation: 1.18 };
    look.toon.shadow = 0xb0c0e8; look.toon.mid = 0xffa060;
    look.atmosphere = { ...look.atmosphere, color: 0xfff0d0, color2: 0xe8f4ff, shafts: look.atmosphere.shafts ? { ...look.atmosphere.shafts, color: 0xfff0d4, strength: .5 } : undefined };
  },
  'kami-lookout': look => {
    look.ground = { tint: 0xcddaff, gain: 1.08, max: .8, amount: 1 };
    look.room = { albedo: .74, key: .56 };
    look.exposure = .98;
    look.fog = { ...look.fog, color: 0xb8d4f0 };
    look.grade = { ...look.grade, saturation: 1.24, contrast: 1.16 };
  },
  'chunin-final': look => {
    look.albedo = { saturation: .96, tint: 0xf4fff0 };
    look.ground = { tint: 0xe2f0d6, gain: .67, max: .6, amount: .7 };
  },
  'martial-arts-tournament': look => {
    look.ground = { tint: 0xb7ceff, gain: .745, max: .8, amount: 1 };
    look.room = { albedo: .8, key: .62 };
  },
  'enies-lobby': look => {
    look.ground = { tint: 0xe6edf6, gain: .68, max: .8, amount: 1 };
    look.fog = { ...look.fog, color: 0xb8dcf6, near: 320, far: 1350 };
  },
  harbor: look => {
    look.ground = { tint: 0xd8dce4, gain: .72, max: .8, amount: .8 };
    look.fog = { ...look.fog, color: 0xc8d4e4, near: 30, far: 340 };
  },
  'valley-of-the-end': look => {
    look.grade = { ...look.grade, contrast: 1.25 };
  },

  shiganshina: look => {
    look.ground = { tint: 0xbed8ff, gain: 3.5, max: .8, amount: 1 };
  },
  'pains-crater': look => {
    look.ground = { tint: 0xfffbf5, gain: 1.47, max: .8, amount: 1 };
  },
  marineford: look => {
    look.ground = { tint: 0xdde6ee, gain: .74, max: .8, amount: 1 };
    look.fog = { ...look.fog, color: 0xbcd8f0 };
  },
};

export const CLOUD_SHADOWS: Partial<Record<StageId, CloudShadowLook>> = {
  'martial-arts-tournament': { scale: 11, cover: .64, soft: .1, floor: .72, wind: [1.4, .7], fighters: .45 },
  'enies-lobby': { scale: 11, cover: .63, soft: .1, floor: .72, wind: [-1.2, 1.1], fighters: .45 },
  onigashima: { scale: 24, cover: .55, soft: .09, floor: .7, wind: [-1.1, -.9], fighters: .4 },
  harbor: { scale: 26, cover: .54, soft: .09, floor: .7, wind: [1.5, -.6], fighters: .45 },
  'kami-lookout': { scale: 22, cover: .53, soft: .1, floor: .7, wind: [1.6, .4], height: 90, fighters: .35 },
  shiganshina: { scale: 18, cover: .52, soft: .09, floor: .7, wind: [.9, 1.3], fighters: .45 },
  marineford: { scale: 26, cover: .54, soft: .09, floor: .7, wind: [-1.3, 1.0], fighters: .45 },
  'pains-crater': { scale: 30, cover: .51, soft: .12, floor: .7, wind: [1.6, .6], fighters: .4 },
};
export const GROUND_BUDGET = { keep: .6 };
export const CLOUD_FLOOR = .7;
export const CLOUD_SPAN = .42;
export function cloudsFor(stage: StageId): CloudShadowLook | undefined {
  const k = CLOUD_SHADOWS[stage], def = STAGE_DEFINITIONS[stage];
  if (!k || !def) return k;
  const most = CLOUD_SPAN * 2 * Math.min(def.halfX, def.halfZ);
  return k.scale <= most ? k : { ...k, scale: most };
}

export const AIR: Partial<Record<StageId, AirLook>> = {
  'chunin-final': { start: 16, half: 120, most: .8, color: 0x9ca8c8, base: 0, height: 26, desaturate: .1, sun: { color: 0xe89a78, amount: .6, power: 5 }, fighters: .35 },
  'kami-lookout': { start: 16, half: 110, most: .85, color: 0xa8cce8, base: -6, height: 50, desaturate: .05, fighters: .35 },
  'martial-arts-tournament': { start: 25, half: 115, most: .56, color: 0xc4dcf0, fighters: .35 },
  'enies-lobby': { start: 38, half: 88, most: .72, color: 0x9cc8f0, base: 0, height: 45, desaturate: .03, fighters: .35 },
  'valley-of-the-end': { start: 16, half: 110, most: .75, color: 0xa890b0, base: 0, height: 18, sun: { color: 0xffb070, amount: .7, power: 4 }, fighters: .35 },
  shiganshina: { start: 14, half: 90, most: .8, color: 0xa8bcd0, desaturate: .1, sun: { color: 0xf2e4cc, amount: .4, power: 5 }, fighters: .35 },
  'malevolent-shrine': { start: 16, half: 110, most: .6, color: 0x4a0e14, desaturate: .05, fighters: .3 },
  'pains-crater': { start: 60, half: 420, most: .26, color: 0xb4a890, base: 0, height: 60, desaturate: .04, sun: { color: 0xf8e4c4, amount: .3, power: 4 }, fighters: .3 },
  marineford: { start: 90, half: 500, most: .24, color: 0xa8cbea, desaturate: .02, sun: { color: 0xf6ecd8, amount: .3, power: 5 }, fighters: .3 },
  shibuya: { start: 18, half: 100, most: .85, color: 0x182234, base: 0, height: 46, desaturate: .16, fighters: .3 },
  'infinity-castle': { start: 26, half: 80, most: .9, color: 0x7a4a20, desaturate: .16, fighters: .25 },
  'heavens-arena': { start: 16, half: 55, most: .55, color: 0x2a2a46, base: 0, height: 34, desaturate: .25, fighters: .15 },
};

export const LEAVES: Partial<Record<StageId, LeafShadowLook>> = {
  'chunin-final': { size: 3.5, cover: .44, soft: .08, floor: .1, height: 8, sway: .3, wind: [.12, .08], fighters: .2 },
  'kami-lookout': { size: 2.2, cover: .5, soft: .07, floor: .3, height: 9, sway: .25, wind: [.1, .05],
    spots: [[-28, 22, 8], [28, 22, 8], [-22, 34, 8], [22, 34, 8], [0, 36, 5]], fighters: .2 },
  'valley-of-the-end': { size: 3, cover: .5, soft: .08, floor: .3, height: 7, sway: .3, wind: [.08, .12],
    spots: [[-20.8, -11.5, 5, 80], [9.2, -11.5, 5, 80]], fighters: .2 },
};

const SHADE: Partial<Record<StageId, Override>> = {
  'chunin-final': look => {
    look.key = { ...look.key, color: 0xffc490, intensity: 6.5 };
    look.room = { albedo: .82, key: 1.25 };
    look.hemi = { ...look.hemi, ground: 0x4a7a2a, intensity: .45 };
    look.ibl = .16;
    look.sky = { ...look.sky, zenith: 0x2a8078, horizon: 0xd8a070, ground: 0x3a6a2a };
    look.grade = { ...look.grade, shadowTint: 0x1a7060, split: .4, shadowDesat: .3, contrast: 1.26 };
  },
  'kami-lookout': look => {
    look.key = { ...look.key, color: 0xffe8c8, intensity: 5.3 };
    look.hemi = { ...look.hemi, ground: 0xb8c0d0, intensity: .5 };
    look.ibl = .26;
    look.sky = { ...look.sky, zenith: 0x1e6a9a };
    look.grade = { ...look.grade, shadowTint: 0x1e6a8a, split: .3, contrast: 1.22 };
    look.exposure = .9;
  },
  'martial-arts-tournament': look => {
    look.key = { ...look.key, color: 0xffe6c4, intensity: 5.45 };
    look.hemi = { ...look.hemi, ground: 0x8a96a8, intensity: .4 };
    look.ibl = .2;
    look.grade = { ...look.grade, contrast: 1.26 };
  },
  'enies-lobby': look => {
    look.hemi = { ...look.hemi, intensity: .5 };
    look.ibl = .3;
    look.grade = { ...look.grade, split: .16, contrast: 1.16, vignette: .12 };
    look.exposure = 1;
    look.albedo = { saturation: 1.25, tint: look.albedo?.tint ?? 0xffffff };
  },
  'valley-of-the-end': look => {
    look.hemi = { ...look.hemi, ground: 0x4a3e66, intensity: .78 };
    look.ibl = .38;
  },
  shiganshina: look => {
    look.hemi = { ...look.hemi, ground: 0x6a5a4a, intensity: .52 };
    look.ibl = .3;
    look.grade = { ...look.grade, contrast: 1.2 };
  },
};

function keepFighters(look: LookPreset, shade: Override) {
  const linear = (c: number) => Math.pow(c / 255, 2.2);
  const skyLight = (h: LookPreset['hemi']) => h.intensity * (.2126 * linear((h.sky >> 16) & 255) + .7152 * linear((h.sky >> 8) & 255) + .0722 * linear(h.sky & 255));
  const before = skyLight(look.hemi);
  shade(look);
  look.toon.ambient *= before / Math.max(skyLight(look.hemi), 1e-3);
}

export function roanLook(stage: StageId, base: LookPreset): LookPreset {
  if (!enabled) return base;
  const look: LookPreset = { ...base, key: { ...base.key }, hemi: { ...base.hemi }, fill: { ...base.fill }, rim: { ...base.rim }, toon: { ...base.toon }, fog: { ...base.fog }, grade: { ...base.grade }, atmosphere: { ...base.atmosphere }, bloom: { ...base.bloom } };
  look.toon.key = Math.max(base.toon.key ?? 1, FIGHTER.key);
  look.toon.neutral = Math.min(base.toon.neutral ?? 0, FIGHTER.neutral);
  look.toon.clip = FIGHTER.clip;
  look.toon.ambient = base.toon.ambient * FIGHTER.ambient;
  look.toon.saturation = FIGHTER.saturation;
  STAGES[stage]?.(look);
  const shade = SHADE[stage];
  if (shade) keepFighters(look, shade);
  look.cloudShadows = cloudsFor(stage);
  look.air = AIR[stage];
  look.leaves = LEAVES[stage];
  return look;
}
