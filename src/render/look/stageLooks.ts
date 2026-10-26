import { roanLook } from './roanPass';
import { sparkingLook } from './sparkingLook';
import type { StageId } from '../../game/stages';

export type Vec3 = readonly [number, number, number];

export interface SkyLook {
  zenith: number; horizon: number; ground: number;
  horizonHeight: number;
  sunColor: number; sunIntensity: number;
  sunSize: number;
  sunGlow: number; sunGlowWidth: number;
  cloudCoverage: number; cloudLit: number; cloudShade: number; cloudRim: number;
  cloudScale: number; cloudSpeed: number;
  stars: number; nebulaA: number; nebulaB: number; nebula: number;
  sunDir?: Vec3;
  eclipse?: number;
}

export interface GradeLook {
  lift: Vec3; gamma: Vec3; gain: Vec3;
  saturation: number; contrast: number;
  shadowTint: number; highlightTint: number; split: number;
  shadowDesat?: number;
  toe?: number;
  vignette: number; vignetteColor: number;
  sharpen?: number;
}

export interface ShaftLook {
  openings: readonly Vec3[];
  width: number; height: number; length: number;
  color: number; strength: number;
}

export interface CookieLook {
  axis: 0 | 2; plane: number;
  bottom: number; top: number; period: number; offset: number; duty: number;
  floor: number;
  fighters: number;
  glow?: number;
}

export interface CloudShadowLook {
  scale: number; cover: number; soft: number;
  floor: number;
  wind: [number, number]; height?: number;
  fighters: number;
}

export interface LeafShadowLook {
  size: number; cover: number; soft: number;
  floor: number;
  height: number;
  spots?: readonly (readonly [number, number, number, number?])[];
  edge?: number;
  sway?: number; wind?: [number, number];
  fighters: number;
}

export interface AirLook {
  start: number; half: number;
  most: number;
  color?: number;
  base?: number; height?: number;
  desaturate?: number;
  sun?: { color: number; amount: number; power?: number };
  fighters: number;
}

export type AtmosphereKind = 'none' | 'dust' | 'leaves' | 'petals' | 'embers' | 'sparkles';

export interface LookPreset {
  key: { color: number; intensity: number; dir: Vec3 };
  hemi: { sky: number; ground: number; intensity: number };
  fill: { color: number; intensity: number; dir: Vec3 };
  rim: { color: number; strength: number; width: number; dir?: Vec3; px?: number; peak?: number };
  toon: { shadow: number; mid: number; midStrength: number; edge: number; soft: number; ambient: number; ink: number;
    floor?: number;
    key?: number;
    neutral?: number;
    fill?: number; fillFloor?: number;
    clip?: readonly [number, number];
    saturation?: number };
  fog: { color: number; near?: number; far?: number };
  sky: SkyLook;
  ibl: number;
  exposure: number;
  toneMapping: 'neutral' | 'aces' | 'agx';
  grade: GradeLook;
  bloom: { strength: number; radius: number; threshold: number; knee: number };
  atmosphere: { kind: AtmosphereKind; count: number; color: number; color2: number; size: number; shafts?: ShaftLook };
  cookie?: CookieLook;
  cloudShadows?: CloudShadowLook;
  air?: AirLook;
  leaves?: LeafShadowLook;
  albedo?: { saturation: number; tint: number };
  room?: { albedo: number; key: number };
  ground?: { tint: number; gain?: number; max: number; amount: number };
  rig?: RigLook;
  finish?: FinishLook;
  finishTint?: Partial<Pick<FinishLook, 'shadow' | 'lift' | 'liftStrength' | 'warm'>>;
  finishGround?: number;
}
export interface RigLook {
  key: number; fill: number;
  shadow: number;
  warm: number; warmStrength: number; cool: number; coolStrength: number; px: number;
  fillColor: number; fillStrength: number;
  shade: number; shadeSaturation: number;
}
export interface FinishLook {
  diffusion: { threshold: number; knee: number; radius: number; strength: number };
  curve: number; shadow: number; lift: number; liftStrength: number; warm: number; vibrance: number;
  grain: number; fringe: number; vignette: number;
  wrap: number;
  haze: { most: number; color: number; range: number };
  ground: number;
}

const dir = (x: number, y: number, z: number): Vec3 => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

const EXAM_KEY = dir(.3, .5, -.81);

export const STAGE_LOOKS: Record<Exclude<StageId, `rift-${string}`|'hidden-leaf'|'blood-citadel'>, LookPreset> & Partial<Record<StageId, LookPreset>> = {
  'chunin-exam-room': {
    key: { color: 0xffdcb0, intensity: 4.9, dir: EXAM_KEY },
    hemi: { sky: 0x9c98c8, ground: 0x6e6070, intensity: .7 },
    fill: { color: 0x9fb3ff, intensity: .25, dir: dir(-.3, .35, .9) },
    rim: { color: 0xffdca0, strength: 2.0, width: .45, dir: EXAM_KEY, px: 2.4, peak: .92 },
    toon: { shadow: 0xb8bce0, mid: 0xff9a5a, midStrength: .35, edge: .02, soft: .035, ambient: 3.3, ink: 0x0c0708, floor: 0x444060,
      key: .75, neutral: .45, fill: 5, fillFloor: .22, clip: [.5, .74] },
    fog: { color: 0xe6c9a0, near: 10, far: 80 },
    sky: {
      zenith: 0x5d7fc4, horizon: 0xffc98f, ground: 0x7a5a48, horizonHeight: .32,
      sunColor: 0xfff0c8, sunIntensity: 14, sunSize: .045, sunGlow: .9, sunGlowWidth: 7,
      cloudCoverage: .42, cloudLit: 0xfff1d6, cloudShade: 0xc9a3b0, cloudRim: 0xfffbe8, cloudScale: 1.1, cloudSpeed: .006,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .2, exposure: 1.15, toneMapping: 'neutral',
    grade: {
      lift: [.012, .01, .022], gamma: [1, 1, 1], gain: [1.02, 1, .97], toe: .45,
      saturation: 1.2, contrast: 1.16, shadowTint: 0x5a4aa8, highlightTint: 0xffd49a, split: .34, shadowDesat: .55,
      vignette: .26, vignetteColor: 0x1a1020,
    },
    bloom: { strength: .6, radius: .55, threshold: 1.12, knee: .4 },
    atmosphere: {
      kind: 'dust', count: 620, color: 0xffe0a0, color2: 0xfff4d8, size: .026,
      shafts: {
        openings: [[-5.5, 4.2, -11.7], [-2.2, 4.4, -11.7], [2.2, 4.4, -11.7], [5.5, 4.2, -11.7]],
        width: 2.2, height: 2.6, length: 22, color: 0xffd08a, strength: 1.0,
      },
    },
    cookie: { axis: 2, plane: -11.8, bottom: 2.4, top: 6.1, period: 3.5, offset: -.45, duty: .78, floor: .3, fighters: .25, glow: .65 },
    albedo: { saturation: .72, tint: 0xfff4ea },
    room: { albedo: .8, key: .38 },
  },
  'chunin-final': {
    key: { color: 0xffb880, intensity: 5.2, dir: dir(-.8, .27, -.55) },
    hemi: { sky: 0x8c88c0, ground: 0x5a5058, intensity: .65 },
    fill: { color: 0x8f9cff, intensity: .3, dir: dir(.6, .4, .7) },
    rim: { color: 0xffc080, strength: 1.9, width: .45, px: 2.4, peak: .92 },
    toon: { shadow: 0xb4b2e2, mid: 0xff8a50, midStrength: .4, edge: .02, soft: .035, ambient: 2.2, ink: 0x0c0708, floor: 0x444060,
      key: .6, neutral: .45, fill: 3, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xe8a07a },
    sky: {
      zenith: 0x3a4a9e, horizon: 0xffa565, ground: 0x6a3f52, horizonHeight: .38,
      sunColor: 0xffe0a0, sunIntensity: 16, sunSize: .05, sunGlow: 1.2, sunGlowWidth: 5,
      cloudCoverage: .46, cloudLit: 0xffb487, cloudShade: 0x9a6a92, cloudRim: 0xffeec0, cloudScale: 1.6, cloudSpeed: .005,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .3, exposure: 1.12, toneMapping: 'neutral',
    grade: {
      lift: [.01, .008, .02], gamma: [1, 1, 1], gain: [1.02, 1, .96], toe: .45,
      saturation: 1.15, contrast: 1.18, shadowTint: 0x4a4aa8, highlightTint: 0xffb880, split: .34, shadowDesat: .55,
      vignette: .26, vignetteColor: 0x1a0c18,
    },
    bloom: { strength: .75, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'leaves', count: 150, color: 0x7fa83a, color2: 0xe08a3a, size: .07 },
    albedo: { saturation: .84, tint: 0xfff8ee },
    room: { albedo: .82, key: .65 },
  },
  'martial-arts-tournament': {
    key: { color: 0xfff2dc, intensity: 5.2, dir: dir(.35, .74, -.57) },
    hemi: { sky: 0xb0d0ff, ground: 0x708058, intensity: .62 },
    fill: { color: 0xb8d0ff, intensity: .25, dir: dir(-.5, .3, -.6) },
    rim: { color: 0xffffff, strength: 1.4, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa4b4e8, mid: 0xffb070, midStrength: .3, edge: .03, soft: .03, ambient: 2.2, ink: 0x0a0c14, floor: 0x404460,
      key: .6, neutral: .3, fill: 2.5, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xcfe6ff },
    sky: {
      zenith: 0x2a78e0, horizon: 0xc6ecff, ground: 0x8aa0a8, horizonHeight: .3,
      sunColor: 0xfffbe8, sunIntensity: 18, sunSize: .04, sunGlow: .6, sunGlowWidth: 9,
      cloudCoverage: .46, cloudLit: 0xffffff, cloudShade: 0xaec3e0, cloudRim: 0xffffff, cloudScale: 1.25, cloudSpeed: .008,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .35, exposure: 1.06, toneMapping: 'neutral',
    grade: {
      lift: [.006, .008, .018], gamma: [1, 1, 1], gain: [1.02, 1.01, .99],
      saturation: 1.18, contrast: 1.15, shadowTint: 0x3a5ad0, highlightTint: 0xfff0d0, split: .28, shadowDesat: .4,
      vignette: .22, vignetteColor: 0x0a1428,
    },
    bloom: { strength: .5, radius: .55, threshold: 1.1, knee: .4 },
    atmosphere: { kind: 'petals', count: 110, color: 0xffd6e4, color2: 0xfff4f8, size: .06 },
    albedo: { saturation: 1.3, tint: 0xfffaf2 },
    room: { albedo: .84, key: .68 },
  },
  'galactic-arena': {
    key: { color: 0xf4fbff, intensity: 4.4, dir: dir(-.3, .85, .42) },
    hemi: { sky: 0x6ad0d8, ground: 0x1a4a52, intensity: .55 },
    fill: { color: 0x40e0d0, intensity: .5, dir: dir(.55, .25, -.8) },
    rim: { color: 0x9ff8ff, strength: 2.1, width: .42, dir: dir(.3, .35, -.9), px: 2.4, peak: .92 },
    toon: { shadow: 0x88b4e6, mid: 0x7fe8ff, midStrength: .28, edge: .03, soft: .035, ambient: 1.6, ink: 0x0a0a1e, floor: 0x3c5066,
      key: .75, neutral: .2, fill: 2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x0e4e56 },
    sky: {
      zenith: 0x052a38, horizon: 0x0f6a70, ground: 0x06222a, horizonHeight: .5,
      sunColor: 0xcffcff, sunIntensity: 0, sunSize: .03, sunGlow: 0, sunGlowWidth: 12,
      cloudCoverage: 0, cloudLit: 0xffffff, cloudShade: 0xffffff, cloudRim: 0xffffff, cloudScale: 1, cloudSpeed: 0,
      stars: 0, nebulaA: 0x0e5a62, nebulaB: 0x143a7a, nebula: 0,
    },
    ibl: .85, exposure: 1.2, toneMapping: 'neutral',
    grade: {
      lift: [.008, .022, .026], gamma: [1, 1, 1], gain: [1, 1.01, 1], toe: .3,
      saturation: 1.14, contrast: 1.1, shadowTint: 0x0e4a4e, highlightTint: 0xfff0c8, split: .26, shadowDesat: .4,
      vignette: .22, vignetteColor: 0x02100f,
    },
    bloom: { strength: .95, radius: .65, threshold: 1, knee: .4 },
    atmosphere: { kind: 'sparkles', count: 260, color: 0x9ffff0, color2: 0xfff2a0, size: .035 },
    room: { albedo: 1, key: .85 },
    ground: { tint: 0xffe9f8, gain: .825, max: .45, amount: 1 },
  },
  'null-realm': {
    key: { color: 0xf2f4ff, intensity: 4.3, dir: dir(-.45, .72, .52) },
    hemi: { sky: 0x7a70d0, ground: 0x2c1a40, intensity: .85 },
    fill: { color: 0xff6ad0, intensity: .5, dir: dir(.55, .25, -.8) },
    rim: { color: 0x7fe0ff, strength: 2.1, width: .42, dir: dir(.3, .35, -.9), px: 2.4, peak: .92 },
    toon: { shadow: 0x8a88e6, mid: 0x7fd8ff, midStrength: .28, edge: .03, soft: .035, ambient: 1.9, ink: 0x0a0a1e, floor: 0x3c3866,
      key: .75, neutral: .2, fill: 2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x1d1a4a },
    sky: {
      zenith: 0x04050f, horizon: 0x241a5c, ground: 0x0c0a1c, horizonHeight: .42,
      sunColor: 0xcfe6ff, sunIntensity: 9, sunSize: .03, sunGlow: .7, sunGlowWidth: 12,
      cloudCoverage: 0, cloudLit: 0xffffff, cloudShade: 0xffffff, cloudRim: 0xffffff, cloudScale: 1, cloudSpeed: 0,
      stars: 1, nebulaA: 0x8a2ab8, nebulaB: 0x1e7ad0, nebula: .85,
    },
    ibl: .7, exposure: 1.14, toneMapping: 'neutral',
    grade: {
      lift: [.014, .012, .04], gamma: [1, 1, 1], gain: [.98, 1, 1.05], toe: .3,
      saturation: 1.14, contrast: 1.1, shadowTint: 0x3a2a9a, highlightTint: 0xd8f0ff, split: .3, shadowDesat: .45,
      vignette: .3, vignetteColor: 0x05030f,
    },
    bloom: { strength: .8, radius: .65, threshold: 1, knee: .4 },
    atmosphere: { kind: 'sparkles', count: 260, color: 0x9fdcff, color2: 0xe4b8ff, size: .035 },
    room: { albedo: .9, key: .8 },
  },
  'enies-lobby': {
    key: { color: 0xfff1d6, intensity: 5.0, dir: dir(.42, .74, .45) },
    hemi: { sky: 0xb8d8ff, ground: 0x6d7c8c, intensity: .7 },
    fill: { color: 0xa9c4ff, intensity: .25, dir: dir(-.5, .3, -.6) },
    rim: { color: 0xffffff, strength: 1.4, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa4b8e8, mid: 0xffb27a, midStrength: .3, edge: .03, soft: .03, ambient: 2.2, ink: 0x0a0e18, floor: 0x404460,
      key: .6, neutral: .3, fill: 2.5, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xcfe7f6 },
    sky: {
      zenith: 0x1d6ad8, horizon: 0xd6f0ff, ground: 0x2a6aa0, horizonHeight: .28,
      sunColor: 0xfffcec, sunIntensity: 18, sunSize: .04, sunGlow: .6, sunGlowWidth: 9,
      cloudCoverage: .5, cloudLit: 0xffffff, cloudShade: 0xa9bfe0, cloudRim: 0xffffff, cloudScale: 1.35, cloudSpeed: .007,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .4, exposure: 1.04, toneMapping: 'neutral',
    grade: {
      lift: [.006, .008, .018], gamma: [1, 1, 1], gain: [1.02, 1.01, .99],
      saturation: 1.18, contrast: 1.13, shadowTint: 0x3a6ad8, highlightTint: 0xfff4dc, split: .26, shadowDesat: .4,
      vignette: .2, vignetteColor: 0x06142a,
    },
    bloom: { strength: .65, radius: .55, threshold: 1, knee: .4 },
    atmosphere: { kind: 'sparkles', count: 90, color: 0xffffff, color2: 0xd8f0ff, size: .025 },
    albedo: { saturation: 1.35, tint: 0xfff6ea },
    room: { albedo: .84, key: .68 },
  },
  'hueco-mundo': {
    key: { color: 0xdde6ff, intensity: 3.6, dir: dir(.5, .62, -.6) },
    hemi: { sky: 0x2c3358, ground: 0xd6d2c8, intensity: .85 },
    fill: { color: 0x7868d8, intensity: .4, dir: dir(-.55, .3, .75) },
    rim: { color: 0xc4ecff, strength: 2.0, width: .42, dir: dir(-.3, .4, .85), px: 2.4, peak: .92 },
    toon: { shadow: 0x8084c0, mid: 0xa8c0ff, midStrength: .22, edge: .03, soft: .035, ambient: 2, ink: 0x06070f, floor: 0x3a3c5a,
      key: .72, neutral: .35, fill: 2.2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x0f1328 },
    sky: {
      zenith: 0x010207, horizon: 0x161c38, ground: 0x0a0c16, horizonHeight: .3,
      sunColor: 0xfff6d8, sunIntensity: 0, sunSize: .001, sunGlow: 0, sunGlowWidth: 1,
      cloudCoverage: 0, cloudLit: 0xffffff, cloudShade: 0xffffff, cloudRim: 0xffffff, cloudScale: 1, cloudSpeed: 0,
      stars: 1, nebulaA: 0x2a1a5a, nebulaB: 0x0a2a4a, nebula: .22,
    },
    ibl: .45, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.01, .01, .03], gamma: [1, 1, 1], gain: [.98, 1, 1.04], toe: .35,
      saturation: .95, contrast: 1.14, shadowTint: 0x2a2a7a, highlightTint: 0xf0f4ff, split: .25, shadowDesat: .5,
      vignette: .32, vignetteColor: 0x02030a,
    },
    bloom: { strength: .7, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'dust', count: 280, color: 0xe8ecff, color2: 0xffffff, size: .028 },
    room: { albedo: 1, key: .95 },
  },
  onigashima: {
    key: { color: 0xffbf8a, intensity: 5.4, dir: dir(.55, .5, -.65) },
    hemi: { sky: 0x7a4a5a, ground: 0x5a3a30, intensity: 1.15 },
    fill: { color: 0x7a9aff, intensity: .6, dir: dir(-.6, .3, .7) },
    rim: { color: 0xffa060, strength: 2.2, width: .42, dir: dir(-.2, .35, -.9), px: 2.4, peak: .92 },
    toon: { shadow: 0xa88ab8, mid: 0xff9a5a, midStrength: .3, edge: .03, soft: .035, ambient: 2.8, ink: 0x0a0406, floor: 0x4a3440,
      key: .7, neutral: .35, fill: 2.4, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x3a161a },
    sky: {
      zenith: 0x0a0306, horizon: 0x8a2a14, ground: 0x1a0806, horizonHeight: .34,
      sunColor: 0xffb070, sunIntensity: 11, sunSize: .075, sunGlow: 1.1, sunGlowWidth: 6, sunDir: dir(.08, .3, -1),
      cloudCoverage: .34, cloudLit: 0xff8a4a, cloudShade: 0x2a0e14, cloudRim: 0xffb070, cloudScale: 1.2, cloudSpeed: .01,
      stars: .35, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .55, exposure: 1.2, toneMapping: 'neutral',
    grade: {
      lift: [.03, .016, .02], gamma: [1, 1, 1], gain: [1.03, 1, .96], toe: .3,
      saturation: 1.12, contrast: 1.16, shadowTint: 0x3a0a2a, highlightTint: 0xffc890, split: .3, shadowDesat: .45,
      vignette: .34, vignetteColor: 0x0a0204,
    },
    bloom: { strength: .9, radius: .65, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 320, color: 0xffa050, color2: 0xff5a1e, size: .03 },
    room: { albedo: 1.15, key: 1 },
  },
  harbor: {
    key: { color: 0xffd8a4, intensity: 4.9, dir: dir(-.5, .42, -.76) },
    hemi: { sky: 0xa8b4e0, ground: 0x625a60, intensity: .7 },
    fill: { color: 0x9fb8ff, intensity: .25, dir: dir(-.6, .35, -.5) },
    rim: { color: 0xffdca8, strength: 1.7, width: .44, px: 2.4, peak: .92 },
    toon: { shadow: 0xb0b4e2, mid: 0xff9a5a, midStrength: .36, edge: .02, soft: .035, ambient: 2.2, ink: 0x0c0708, floor: 0x444060,
      key: .62, neutral: .4, fill: 3, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xf0cfb0 },
    sky: {
      zenith: 0x3b78cc, horizon: 0xffd6a6, ground: 0x6a6a78, horizonHeight: .32,
      sunColor: 0xfff0cc, sunIntensity: 16, sunSize: .045, sunGlow: .85, sunGlowWidth: 7,
      cloudCoverage: .46, cloudLit: 0xfff2dc, cloudShade: 0xa7a6c6, cloudRim: 0xfffaea, cloudScale: 1.15, cloudSpeed: .007,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .38, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.008, .006, .018], gamma: [1, 1, 1], gain: [1.02, 1, .97],
      saturation: 1.18, contrast: 1.15, shadowTint: 0x5a58b8, highlightTint: 0xffd29a, split: .3, shadowDesat: .45,
      vignette: .24, vignetteColor: 0x1a1020,
    },
    bloom: { strength: .65, radius: .55, threshold: 1, knee: .4 },
    atmosphere: { kind: 'petals', count: 180, color: 0xffc6d8, color2: 0xfff0f4, size: .06 },
  },
  'kami-lookout': {
    key: { color: 0xfff4e0, intensity: 5.1, dir: dir(.38, .78, .5) },
    hemi: { sky: 0xb4d2ff, ground: 0xe6e2d8, intensity: .72 },
    fill: { color: 0xb6ccff, intensity: .28, dir: dir(-.5, .3, -.6) },
    rim: { color: 0xffffff, strength: 1.45, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa2b2ea, mid: 0xffb070, midStrength: .3, edge: .03, soft: .03, ambient: 2.2, ink: 0x0a0c16, floor: 0x404864,
      key: .6, neutral: .3, fill: 2.5, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xdcecff },
    sky: {
      zenith: 0x1650cc, horizon: 0xcfe6ff, ground: 0xf4f7ff, horizonHeight: .24,
      sunColor: 0xfffdf0, sunIntensity: 19, sunSize: .04, sunGlow: .65, sunGlowWidth: 9,
      cloudCoverage: .34, cloudLit: 0xffffff, cloudShade: 0xb2c4ea, cloudRim: 0xffffff, cloudScale: 1.4, cloudSpeed: .006,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .38, exposure: 1.04, toneMapping: 'neutral',
    grade: {
      lift: [.006, .008, .02], gamma: [1, 1, 1], gain: [1.01, 1.01, 1],
      saturation: 1.2, contrast: 1.14, shadowTint: 0x3a5ad8, highlightTint: 0xfff4dc, split: .26, shadowDesat: .4,
      vignette: .2, vignetteColor: 0x08142e,
    },
    bloom: { strength: .62, radius: .55, threshold: 1, knee: .4 },
    atmosphere: { kind: 'sparkles', count: 70, color: 0xffffff, color2: 0xdff0ff, size: .025 },
    albedo: { saturation: 1.18, tint: 0xfffaf0 },
    room: { albedo: .82, key: .64 },
  },
  'valley-of-the-end': {
    key: { color: 0xffa868, intensity: 4.4, dir: dir(-.25, .3, -.92) },
    hemi: { sky: 0x9a8ec8, ground: 0x4a4250, intensity: .85 },
    fill: { color: 0x8aa2ff, intensity: .34, dir: dir(.4, .35, .85) },
    rim: { color: 0xffb478, strength: 2, width: .45, dir: dir(-.25, .3, -.92), px: 2.4, peak: .92 },
    toon: { shadow: 0xa6a6e0, mid: 0xff8a50, midStrength: .42, edge: .02, soft: .035, ambient: 2.25, ink: 0x0c0708, floor: 0x403e5e,
      key: .6, neutral: .42, fill: 3, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xb88a90, near: 55, far: 620 },
    sky: {
      zenith: 0x272b6c, horizon: 0xff9858, ground: 0x2c2c3c, horizonHeight: .36,
      sunColor: 0xffe2a8, sunIntensity: 15, sunSize: .055, sunGlow: 1.3, sunGlowWidth: 5,
      cloudCoverage: .5, cloudLit: 0xffb08a, cloudShade: 0x8a6898, cloudRim: 0xffe6c0, cloudScale: 1.5, cloudSpeed: .006,
      stars: .25, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .42, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.012, .008, .024], gamma: [1, 1, 1], gain: [1.03, 1, .95], toe: .45,
      saturation: 1.14, contrast: 1.2, shadowTint: 0x4a46a8, highlightTint: 0xffb47a, split: .34, shadowDesat: .5,
      vignette: .28, vignetteColor: 0x160a18,
    },
    bloom: { strength: .72, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'leaves', count: 90, color: 0x7a9a46, color2: 0xd8803a, size: .06 },
    albedo: { saturation: 1.12, tint: 0xfff2e6 },
    room: { albedo: .92, key: .75 },
  },
  'malevolent-shrine': {
    key: { color: 0xffe2d2, intensity: 4, dir: dir(.38, .7, .6) },
    hemi: { sky: 0x7a4a50, ground: 0x2a0608, intensity: .7 },
    fill: { color: 0xff3036, intensity: .55, dir: dir(-.8, .3, .2) },
    rim: { color: 0xff9a80, strength: 3.1, width: .48, dir: dir(-.2, .45, -.87), px: 2.9, peak: .96 },
    toon: { shadow: 0xb07a86, mid: 0xff7a50, midStrength: .34, edge: .025, soft: .035, ambient: 3.3, ink: 0x080204, floor: 0x5a3a46,
      key: .86, neutral: .72, fill: 3.4, fillFloor: .28, clip: [.5, .74] },
    fog: { color: 0x1c0306, near: 40, far: 460 },
    sky: {
      zenith: 0x030001, horizon: 0x6a0812, ground: 0x140204, horizonHeight: .34,
      sunColor: 0xff5a40, sunIntensity: 0, sunSize: .05, sunGlow: 0, sunGlowWidth: 6,
      cloudCoverage: .12, cloudLit: 0x4a0a10, cloudShade: 0x120204, cloudRim: 0x8a1a1e, cloudScale: 1.9, cloudSpeed: .012,
      stars: 0, nebulaA: 0x7a0612, nebulaB: 0x240206, nebula: .35,
    },
    ibl: .22, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.014, .004, .006], gamma: [1, 1, 1], gain: [1.03, .99, .98], toe: .4,
      saturation: 1.04, contrast: 1.24, shadowTint: 0x3a0612, highlightTint: 0xfff0e8, split: .22, shadowDesat: .3,
      vignette: .34, vignetteColor: 0x0c0002,
    },
    bloom: { strength: .8, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 170, color: 0xff6a3a, color2: 0xa0141e, size: .02 },
    albedo: { saturation: .96, tint: 0xfff4ee },
    room: { albedo: .95, key: .9 },
  },
  shiganshina: {
    key: { color: 0xfff0d6, intensity: 5, dir: dir(.42, .66, .62) },
    hemi: { sky: 0xb4d0ff, ground: 0x8a7c6a, intensity: .68 },
    fill: { color: 0xa8c0ff, intensity: .26, dir: dir(-.5, .3, -.6) },
    rim: { color: 0xfff4e4, strength: 1.5, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa8b4e2, mid: 0xffa868, midStrength: .32, edge: .03, soft: .03, ambient: 2.2, ink: 0x0c0a0c, floor: 0x44445e,
      key: .6, neutral: .35, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xc9d9e6, near: 45, far: 560 },
    sky: {
      zenith: 0x2c6ed4, horizon: 0xd6ecff, ground: 0x7a7e86, horizonHeight: .3,
      sunColor: 0xfffaea, sunIntensity: 17, sunSize: .045, sunGlow: .7, sunGlowWidth: 8,
      cloudCoverage: .56, cloudLit: 0xffffff, cloudShade: 0xa8b8d8, cloudRim: 0xffffff, cloudScale: 1.25, cloudSpeed: .006,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .38, exposure: 1.06, toneMapping: 'neutral',
    grade: {
      lift: [.008, .008, .016], gamma: [1, 1, 1], gain: [1.02, 1.005, .98],
      saturation: 1.06, contrast: 1.14, shadowTint: 0x40549c, highlightTint: 0xfff0d6, split: .24, shadowDesat: .45,
      vignette: .22, vignetteColor: 0x10141c,
    },
    bloom: { strength: .6, radius: .55, threshold: 1, knee: .4 },
    atmosphere: { kind: 'dust', count: 90, color: 0xdccab0, color2: 0xfff4e4, size: .05 },
    albedo: { saturation: 1.12, tint: 0xfff6ea },
    room: { albedo: .94, key: .8 },
  },
  'pains-crater': {
    key: { color: 0xfff0dc, intensity: 4.4, dir: dir(-.62, .52, .3) },
    hemi: { sky: 0x9fb4d8, ground: 0x6e6c6a, intensity: .82 },
    fill: { color: 0x9cacd8, intensity: .32, dir: dir(.6, .3, -.5) },
    rim: { color: 0xffe0b8, strength: 2.6, width: .42, dir: dir(-.62, .52, .3), px: 2.6, peak: .94 },
    toon: { shadow: 0xa8aed0, mid: 0xffa868, midStrength: .32, edge: .03, soft: .03, ambient: 2.4, ink: 0x0c0a0c, floor: 0x46445e,
      key: .62, neutral: .35, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x9aa4b0 },
    sky: {
      zenith: 0x4a5a78, horizon: 0xc8b494, ground: 0x7a6a58, horizonHeight: .32,
      sunColor: 0xffe8c0, sunIntensity: 10, sunSize: .045, sunGlow: .7, sunGlowWidth: 8,
      cloudCoverage: .7, cloudLit: 0xe8dcc8, cloudShade: 0x5e6478, cloudRim: 0xfff0d8, cloudScale: 1.2, cloudSpeed: .008,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .34, exposure: 1.04, toneMapping: 'neutral',
    grade: {
      lift: [.006, .005, .008], gamma: [1, 1, 1], gain: [1.03, 1.0, .96],
      saturation: 1.02, contrast: 1.22, shadowTint: 0x3a5096, highlightTint: 0xfff0dc, split: .34, shadowDesat: .3,
      vignette: .14, vignetteColor: 0x1a140e,
    },
    bloom: { strength: .38, radius: .5, threshold: 1.05, knee: .35 },
    atmosphere: { kind: 'dust', count: 110, color: 0x6a6258, color2: 0xa8988a, size: .03 },
    albedo: { saturation: .88, tint: 0xf4f4ee },
    room: { albedo: .9, key: .78 },
  },
  marineford: {
    key: { color: 0xffe4c4, intensity: 5.4, dir: dir(-.5, .64, .58) },
    hemi: { sky: 0xc4d8f4, ground: 0x9aa2a6, intensity: .72 },
    fill: { color: 0xa8b4ff, intensity: .3, dir: dir(.55, .3, -.6) },
    rim: { color: 0xf4fbff, strength: 1.5, width: .42, px: 2.2, peak: .9 },
    toon: { shadow: 0xa2b8e8, mid: 0xffae76, midStrength: .3, edge: .03, soft: .03, ambient: 2.2, ink: 0x0a0e18, floor: 0x3e4662,
      key: .6, neutral: .3, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0xb8d4ee },
    sky: {
      zenith: 0x1a62d2, horizon: 0xd2ecff, ground: 0x6a8aa8, horizonHeight: .28,
      sunColor: 0xfffcec, sunIntensity: 18, sunSize: .04, sunGlow: .6, sunGlowWidth: 9,
      cloudCoverage: .52, cloudLit: 0xffffff, cloudShade: 0xa6bee2, cloudRim: 0xffffff, cloudScale: 1.3, cloudSpeed: .007,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .38, exposure: .9, toneMapping: 'neutral',
    grade: {
      lift: [.003, .005, .012], gamma: [1, 1, 1], gain: [1.03, 1.01, .98],
      saturation: 1.14, contrast: 1.22, shadowTint: 0x45589c, highlightTint: 0xfff8ee, split: .16, shadowDesat: .4,
      vignette: .2, vignetteColor: 0x06142a,
    },
    bloom: { strength: .38, radius: .5, threshold: 1.22, knee: .35 },
    atmosphere: { kind: 'sparkles', count: 110, color: 0xffffff, color2: 0xcfefff, size: .026 },
    albedo: { saturation: 1.0, tint: 0xfff6ec },
    room: { albedo: .84, key: .72 },
  },
  shibuya: {
    key: { color: 0xc8dcff, intensity: 3.2, dir: dir(.32, .74, .58) },
    hemi: { sky: 0x26507a, ground: 0x24262c, intensity: .82 },
    fill: { color: 0xffa070, intensity: .5, dir: dir(-.8, .35, .3) },
    rim: { color: 0xa8dcff, strength: 3.6, width: .5, dir: dir(.15, .45, -.88), px: 2.9, peak: .97 },
    toon: { shadow: 0x8a98c8, mid: 0xffa070, midStrength: .3, edge: .025, soft: .035, ambient: 3.1, ink: 0x06060c, floor: 0x46507a,
      key: .86, neutral: .6, fill: 3.2, fillFloor: .28, clip: [.5, .74] },
    fog: { color: 0x10172a, near: 70, far: 820 },
    sky: {
      zenith: 0x040408, horizon: 0x142030, ground: 0x0e0e18, horizonHeight: .3,
      sunColor: 0xc8d0ff, sunIntensity: 0, sunSize: .04, sunGlow: 0, sunGlowWidth: 6,
      cloudCoverage: 0, cloudLit: 0x2a2440, cloudShade: 0x0a0812, cloudRim: 0x4a3a6a, cloudScale: 1.6, cloudSpeed: .004,
      stars: 0, nebulaA: 0x1a2040, nebulaB: 0x0a0814, nebula: .15,
    },
    ibl: .26, exposure: 1.12, toneMapping: 'neutral',
    grade: {
      lift: [.012, .008, .022], gamma: [1, 1, 1], gain: [1.02, 1, 1.02], toe: .42,
      saturation: 1.0, contrast: 1.2, shadowTint: 0x0a2c52, highlightTint: 0xfff0dc, split: .24, shadowDesat: .3,
      vignette: .3, vignetteColor: 0x06040c,
    },
    bloom: { strength: .85, radius: .62, threshold: 1, knee: .45 },
    atmosphere: { kind: 'embers', count: 110, color: 0xff8a4a, color2: 0xff4fb0, size: .018 },
    albedo: { saturation: .98, tint: 0xe8f2ff },
    room: { albedo: .94, key: .74 },
    ground: { tint: 0xffebc8, gain: 1.08, max: .5, amount: 1 },
    finishTint: { shadow: 0xc4d6ff, lift: 0x0a1a30, liftStrength: .12, warm: 0xfff3e4 },
  },
  'infinity-castle': {
    key: { color: 0xfff0dc, intensity: 2.9, dir: dir(.3, .72, .62) },
    hemi: { sky: 0x3e3044, ground: 0x241818, intensity: .46 },
    fill: { color: 0x3e7a86, intensity: .7, dir: dir(-.7, .3, -.6) },
    rim: { color: 0xffdca0, strength: 3.9, width: .48, dir: dir(.1, .5, -.86), px: 3.0, peak: .98 },
    toon: { shadow: 0xa08c98, mid: 0xffa060, midStrength: .34, edge: .025, soft: .035, ambient: 3.0, ink: 0x0a0604, floor: 0x5a4a52,
      key: .86, neutral: .6, fill: 3.0, fillFloor: .26, clip: [.5, .74] },
    fog: { color: 0x3a2210, near: 90, far: 700 },
    sky: {
      zenith: 0x050302, horizon: 0x3a2414, ground: 0x0a0604, horizonHeight: .3,
      sunColor: 0xffc890, sunIntensity: 0, sunSize: .04, sunGlow: 0, sunGlowWidth: 6,
      cloudCoverage: 0, cloudLit: 0x3a2414, cloudShade: 0x0c0806, cloudRim: 0x5a3a20, cloudScale: 1.6, cloudSpeed: .004,
      stars: 0, nebulaA: 0x3a2010, nebulaB: 0x100804, nebula: .2,
    },
    ibl: .22, exposure: 1.02, toneMapping: 'neutral',
    grade: {
      lift: [.016, .01, .006], gamma: [1, 1, 1], gain: [1.03, 1, .96], toe: .42,
      saturation: 1.0, contrast: 1.34, shadowTint: 0x1c1844, highlightTint: 0xfff0d4, split: .3, shadowDesat: .3,
      vignette: .28, vignetteColor: 0x0a0604,
    },
    bloom: { strength: .9, radius: .65, threshold: 1, knee: .45 },
    atmosphere: { kind: 'embers', count: 70, color: 0xffa040, color2: 0xffd080, size: .018 },
    albedo: { saturation: .9, tint: 0xfff4ea },
    room: { albedo: 1.0, key: 1.0 },
    ground: { tint: 0xf0e8d4, gain: 1.03, max: .62, amount: 1 },
    finishTint: { shadow: 0xc8c6ee, lift: 0x080616, liftStrength: .1, warm: 0xfff2dc },
  },
  'heavens-arena': {
    key: { color: 0xf4f6ff, intensity: 4.2, dir: dir(.18, .94, .28) },
    hemi: { sky: 0x5c5a6c, ground: 0x1e1e24, intensity: .8 },
    fill: { color: 0xff6ad0, intensity: .5, dir: dir(.3, .25, -1) },
    rim: { color: 0x8fe6ff, strength: 3.2, width: .5, dir: dir(-.2, .35, -.9), px: 2.8, peak: .95 },
    toon: { shadow: 0x9a96e0, mid: 0x8fd8ff, midStrength: .25, edge: .03, soft: .035, ambient: 2.2, ink: 0x0a0a1a, floor: 0x3c3a62,
      key: .72, neutral: .25, fill: 2.2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x121218 },
    sky: {
      zenith: 0x0a0608, horizon: 0x24141e, ground: 0x0c0709, horizonHeight: .4,
      sunColor: 0xe8f0ff, sunIntensity: 0, sunSize: .03, sunGlow: 0, sunGlowWidth: 8,
      cloudCoverage: 0, cloudLit: 0xffffff, cloudShade: 0xffffff, cloudRim: 0xffffff, cloudScale: 1, cloudSpeed: 0,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .55, exposure: 1.1, toneMapping: 'neutral',
    grade: {
      lift: [.012, .01, .03], gamma: [1, 1, 1], gain: [.99, 1, 1.04], toe: .3,
      saturation: 1.12, contrast: 1.16, shadowTint: 0x2a2a4a, highlightTint: 0xeaf4ff, split: .26, shadowDesat: .4,
      vignette: .3, vignetteColor: 0x0c0408,
    },
    bloom: { strength: .8, radius: .6, threshold: .9, knee: .4 },
    atmosphere: { kind: 'dust', count: 160, color: 0xb8c4e0, color2: 0xe8eeff, size: .022 },
    albedo: { saturation: 1.0, tint: 0xffffff },
    room: { albedo: .9, key: .85 },
    ground: { tint: 0xe2eaf4, gain: .78, max: .8, amount: 1 },
    finishGround: .3,
  },
};

const RIFT_LOOKS: Record<'rift-village' | 'rift-swords' | 'rift-fortress' | 'rift-eclipse', LookPreset> = {
  'rift-village': {
    key: { color: 0xff9a5c, intensity: 4.8, dir: dir(-.55, .4, .74) },
    hemi: { sky: 0x4a2634, ground: 0x2a1812, intensity: .85 },
    fill: { color: 0x5a78ff, intensity: .55, dir: dir(.6, .35, -.7) },
    rim: { color: 0xff8848, strength: 2.4, width: .44, dir: dir(.3, .4, -.85), px: 2.4, peak: .92 },
    toon: { shadow: 0x9a7aa8, mid: 0xff8a4a, midStrength: .34, edge: .03, soft: .035, ambient: 2.6, ink: 0x0a0406, floor: 0x40303c,
      key: .72, neutral: .35, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x2c1014 },
    sky: {
      zenith: 0x060204, horizon: 0x9a2a12, ground: 0x120604, horizonHeight: .3,
      sunColor: 0xff3a1c, sunIntensity: 8, sunSize: .085, sunGlow: 1.3, sunGlowWidth: 5, sunDir: dir(.35, .22, 1),
      cloudCoverage: .42, cloudLit: 0xa83a1c, cloudShade: 0x1c070a, cloudRim: 0xff7a3a, cloudScale: 1.1, cloudSpeed: .012,
      stars: .2, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .45, exposure: 1.18, toneMapping: 'neutral',
    grade: {
      lift: [.03, .014, .018], gamma: [1, 1, 1], gain: [1.04, 1, .95], toe: .3,
      saturation: 1.06, contrast: 1.22, shadowTint: 0x2a0a1c, highlightTint: 0xffb070, split: .32, shadowDesat: .5,
      vignette: .42, vignetteColor: 0x080102,
    },
    bloom: { strength: 1, radius: .68, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 400, color: 0xffa050, color2: 0xff4a18, size: .032 },
    room: { albedo: 1.05, key: .95 },
  },
  'rift-swords': {
    key: { color: 0xd8d4e8, intensity: 3.4, dir: dir(.45, .38, -.8) },
    hemi: { sky: 0x5a5868, ground: 0x2a2624, intensity: .95 },
    fill: { color: 0x9a6aa0, intensity: .4, dir: dir(-.6, .3, .7) },
    rim: { color: 0xe4e8ff, strength: 2.1, width: .42, dir: dir(-.3, .4, .85), px: 2.4, peak: .92 },
    toon: { shadow: 0x8a8aa8, mid: 0xd8b0a0, midStrength: .2, edge: .03, soft: .035, ambient: 2.4, ink: 0x07070a, floor: 0x3c3c48,
      key: .7, neutral: .5, fill: 2.2, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x3a3a44 },
    sky: {
      zenith: 0x16161e, horizon: 0x8a7880, ground: 0x1a1a1e, horizonHeight: .34,
      sunColor: 0xffe2c8, sunIntensity: 3, sunSize: .05, sunGlow: .9, sunGlowWidth: 5,
      cloudCoverage: .74, cloudLit: 0x9a8c94, cloudShade: 0x2a2a34, cloudRim: 0xd8c8c8, cloudScale: 1.25, cloudSpeed: .016,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .5, exposure: 1.12, toneMapping: 'neutral',
    grade: {
      lift: [.02, .02, .026], gamma: [1, 1, 1], gain: [1, 1, 1.02], toe: .35,
      saturation: .74, contrast: 1.2, shadowTint: 0x1a1a3a, highlightTint: 0xf0e0d4, split: .28, shadowDesat: .6,
      vignette: .4, vignetteColor: 0x040406,
    },
    bloom: { strength: .8, radius: .6, threshold: 1, knee: .4 },
    atmosphere: { kind: 'dust', count: 460, color: 0xbcbcc4, color2: 0x8a8a92, size: .03 },
    room: { albedo: .95, key: .9 },
  },
  'rift-fortress': {
    key: { color: 0xa8b8ff, intensity: 3.6, dir: dir(-.5, .62, .6) },
    hemi: { sky: 0x1c2644, ground: 0x16100c, intensity: .8 },
    fill: { color: 0xff8a3a, intensity: .5, dir: dir(.6, .25, -.7) },
    rim: { color: 0x9ab8ff, strength: 2.3, width: .44, dir: dir(.4, .45, -.8), px: 2.4, peak: .92 },
    toon: { shadow: 0x7a86b8, mid: 0xffa060, midStrength: .26, edge: .03, soft: .035, ambient: 2.3, ink: 0x05060c, floor: 0x343a54,
      key: .72, neutral: .4, fill: 2.4, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x0e1224 },
    sky: {
      zenith: 0x02030a, horizon: 0x1c2440, ground: 0x08080c, horizonHeight: .3,
      sunColor: 0xdde6ff, sunIntensity: 6, sunSize: .045, sunGlow: .8, sunGlowWidth: 6,
      cloudCoverage: .6, cloudLit: 0x4a5a7a, cloudShade: 0x0a0c14, cloudRim: 0xa0b4e0, cloudScale: 1.15, cloudSpeed: .02,
      stars: .3, nebulaA: 0, nebulaB: 0, nebula: 0,
    },
    ibl: .45, exposure: 1.16, toneMapping: 'neutral',
    grade: {
      lift: [.012, .016, .03], gamma: [1, 1, 1], gain: [1.02, 1, .98], toe: .3,
      saturation: .92, contrast: 1.24, shadowTint: 0x0a1a3a, highlightTint: 0xffc890, split: .3, shadowDesat: .45,
      vignette: .45, vignetteColor: 0x010208,
    },
    bloom: { strength: .9, radius: .62, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 220, color: 0xffa050, color2: 0xff6a2a, size: .028 },
    room: { albedo: 1, key: .95 },
  },
  'rift-eclipse': {
    key: { color: 0xff5a3a, intensity: 4, dir: dir(0, .36, 1) },
    hemi: { sky: 0x5a0a16, ground: 0x1a0406, intensity: 1 },
    fill: { color: 0x7a5aff, intensity: .4, dir: dir(-.6, .3, -.7) },
    rim: { color: 0xff3a2a, strength: 2.6, width: .46, dir: dir(0, .35, 1), px: 2.5, peak: .94 },
    toon: { shadow: 0x9a6a9a, mid: 0xff5a4a, midStrength: .32, edge: .03, soft: .035, ambient: 2.6, ink: 0x0a0204, floor: 0x442030,
      key: .7, neutral: .3, fill: 2.6, fillFloor: .16, clip: [.5, .74] },
    fog: { color: 0x3a060c },
    sky: {
      zenith: 0x0a0002, horizon: 0xa0160e, ground: 0x140204, horizonHeight: .36,
      sunColor: 0xff4a1a, sunIntensity: 9, sunSize: .11, sunGlow: 1.6, sunGlowWidth: 4, sunDir: dir(0, .42, 1),
      cloudCoverage: .36, cloudLit: 0x8a1a14, cloudShade: 0x120204, cloudRim: 0xff6a3a, cloudScale: 1, cloudSpeed: .018,
      stars: 0, nebulaA: 0, nebulaB: 0, nebula: 0, eclipse: 1,
    },
    ibl: .5, exposure: 1.2, toneMapping: 'neutral',
    grade: {
      lift: [.03, .008, .012], gamma: [1, 1, 1], gain: [1.05, .98, .95], toe: .3,
      saturation: 1.1, contrast: 1.24, shadowTint: 0x2a0418, highlightTint: 0xff9070, split: .34, shadowDesat: .5,
      vignette: .46, vignetteColor: 0x060001,
    },
    bloom: { strength: 1.05, radius: .7, threshold: 1, knee: .4 },
    atmosphere: { kind: 'embers', count: 360, color: 0xff5a30, color2: 0xa01a10, size: .03 },
    room: { albedo: 1, key: .95 },
  },
};
Object.assign(STAGE_LOOKS, RIFT_LOOKS);
STAGE_LOOKS['hidden-leaf']={
  ...STAGE_LOOKS.harbor,
  key:{color:0xffd4a3,intensity:2.8,dir:dir(-.65,.42,.6)},
  hemi:{sky:0xa9b7db,ground:0x716258,intensity:.6},
  fill:{color:0x9eafff,intensity:.65,dir:dir(.7,.4,-.6)},
  rim:{color:0xffc991,strength:1.8,width:.42,dir:dir(-.65,.42,.6),px:2,peak:.88},
  fog:{color:0x9d93aa,near:140,far:430},
  sky:{...STAGE_LOOKS.harbor.sky,zenith:0x566f9d,horizon:0xf3bc90,ground:0x655651,
    sunDir:dir(-.65,.18,.6),sunColor:0xffdc9d,sunIntensity:10,sunSize:.033,cloudCoverage:.48,
    cloudLit:0xf8c8a8,cloudShade:0x7e7f9c,cloudRim:0xffe5b8},
  ibl:.32,exposure:1.03,
  grade:{...STAGE_LOOKS.harbor.grade,saturation:1.08,contrast:1.19,shadowTint:0x283d60,highlightTint:0xffd5a8,split:.17,vignette:.22},
  bloom:{strength:.38,radius:.5,threshold:1.1,knee:.3},
  atmosphere:{kind:'leaves',count:60,color:0xd7a466,color2:0x7d9466,size:.035},
};
STAGE_LOOKS['blood-citadel']={
  ...STAGE_LOOKS.harbor,
  key:{color:0xc0d9fa,intensity:3.9,dir:dir(.4,.68,-.65)},
  hemi:{sky:0x788dbd,ground:0x414854,intensity:.62},
  fill:{color:0xe6b39f,intensity:.38,dir:dir(-.7,.4,.5)},
  rim:{color:0xd0e7ff,strength:2.3,width:.44,dir:dir(.4,.68,-.65),px:2.1,peak:.9},
  toon:{...STAGE_LOOKS.harbor.toon,shadow:0x8e9caf,ambient:2.8,floor:0x566176,fill:2,fillFloor:.2,key:.72,neutral:.65},
  fog:{color:0x263e60,near:65,far:240},
  sky:{...STAGE_LOOKS.harbor.sky,zenith:0x142542,horizon:0x6483ab,ground:0x1c2b3d,sunIntensity:0},
  ibl:.3,exposure:1.08,
  grade:{...STAGE_LOOKS.harbor.grade,saturation:1.06,contrast:1.16,shadowTint:0x173455,highlightTint:0xc5dbf6,split:.12,vignette:.2},
  bloom:{strength:.5,radius:.55,threshold:1.05,knee:.35},
  atmosphere:{kind:'embers',count:100,color:0xcfb092,color2:0x6f9bbb,size:.018},
};
STAGE_LOOKS['rift-war']={
  ...STAGE_LOOKS['hidden-leaf'],
  key:{color:0xffd9a3,intensity:3.1,dir:dir(-.55,.7,.42)},
  hemi:{sky:0xb8cbe7,ground:0x454c37,intensity:.6},
  fill:{color:0x90b8e1,intensity:.65,dir:dir(.7,.4,-.6)},
  rim:{color:0xffd6ac,strength:1.75,width:.42,dir:dir(-.55,.7,.42),px:2,peak:.88},
  toon:{...STAGE_LOOKS.harbor.toon,shadow:0x9facc2,ambient:2.6,floor:0x46516b,fill:2.2,fillFloor:.2,key:.72,neutral:.62},
  fog:{color:0xa8aab9,near:110,far:370},
  sky:{...STAGE_LOOKS['valley-of-the-end'].sky},
  ibl:.32,exposure:1.02,
  grade:{...STAGE_LOOKS.harbor.grade,saturation:1.07,contrast:1.17,shadowTint:0x303c5c,highlightTint:0xffdbad,split:.14,vignette:.18},
  bloom:{strength:.24,radius:.4,threshold:1.15,knee:.25},
  atmosphere:{kind:'leaves',count:48,color:0xb9c17c,color2:0xd19a6d,size:.025},
};
Object.assign(STAGE_LOOKS, { 'rift-frost': RIFT_LOOKS['rift-fortress'], 'rift-grove': RIFT_LOOKS['rift-eclipse'], 'rift-wastes': RIFT_LOOKS['rift-swords'], 'rift-harbor': RIFT_LOOKS['rift-fortress'] });

export function lookFor(stage: StageId): LookPreset {
  return sparkingLook(stage, roanLook(stage, STAGE_LOOKS[stage] ?? STAGE_LOOKS.harbor));
}
