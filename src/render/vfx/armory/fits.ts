import * as THREE from 'three';

export interface Fit {
  colours?: Readonly<Record<string, number>>;
  launch?: { readonly forward?: string; readonly side?: string; readonly height?: string };
  end?: string;
  size?: readonly string[];
  counts?: readonly string[];
  levels?: Readonly<Record<string, Readonly<Record<'low' | 'medium' | 'high', number>>>>;
  speed?: string;
  sustain?: string;
  range?: readonly string[];
  set?: Readonly<Record<string, number | string | boolean>>;
  follows?: boolean;
  lift?: readonly string[];
  holdKey?: string;
  zone?: string;
  windup?: readonly string[];
  speedScale?: number;
  bursts?: number;
  decals?: number;
  radius?: readonly [number, number];
  step?: readonly [string, string];
  movable?: boolean;
  pace?: string;
  peak?: number;
  past?: number;
  cost?: { readonly draws: number; readonly gpuMs: number };
  sizeScale?: number;
  auto?: boolean;
}

import { classifyKey } from './macros';

const EMBERS = (prefix: string, a = 0, b = .3, c = .64, d = .95) => ({ [`${prefix}A`]: a, [`${prefix}B`]: b, [`${prefix}C`]: c, [`${prefix}D`]: d });

export const FITS: Readonly<Record<string, Fit>> = Object.freeze({
  extra_rageaura: {
    cost: { draws: 4, gpuMs: 0.3 },
    colours: { colorCore: 0, colorInner: .12, colorOuter: .42, colorEdge: .72, sparkColor: .3, lightColor: .4 },
    decals: .45,
    size: ['radiusX', 'radiusY', 'height', 'shockRadius', 'sparkSize'],
    counts: ['burstSparks', 'riseSparks'],
    follows: true, lift: ['height'], holdKey: 'holdTime',
    set: { shockRadius: 1.6, burstShake: 0, rumble: 0, burstFlash: 0, shockStrength: 0 },
  },
  extra_celflame: {
    cost: { draws: 14, gpuMs: 0.6 },
    colours: { colorCore: .08, colorMid: .42, colorOuter: .78, sparkColor: .45, lightColor: .4 },
    size: ['width', 'height', 'sparkSize', 'scatter'],
    counts: ['count', 'embers', 'emberRate'],
    sustain: 'holdTime', windup: ['startDelay'], step: ['step', 'count'],
    range: ['range', 'minRange'],
    set: { flameShake: 0, firstAt: .05, count: 12, width: 1.6, height: 2.9 },
  },
  dragonbreath: {
    cost: { draws: 9, gpuMs: 3.5 },
    colours: {
      flameColorCore: 0, flameColorMid: .4, flameColorEdge: .72, flameColorDeep: .97, flameColorLight: .34,
      colorTongueCore: 0, colorTongueInner: .28, colorTongueOuter: .64, colorTongueHalo: .93,
      ...EMBERS('colorEmber', 0, .3, .66, .97), ...EMBERS('colorDrip', 0, .3, .72, .97),
      colorBurstA: .66, colorBurstB: .3, colorBurstC: 0, colorCastFlash: .3, colorFlash: 0, lightColor: .42, colorScorchGlow: .55,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    end: 'endHeight',
    size: ['muzzleSize', 'mouthBurstSize', 'emberSize', 'dripSize', 'smokeSize', 'scorchWidth', 'tongueWidth'],
    counts: ['emberRate', 'dripRate', 'smokeRate', 'tongueCount'],
    levels: { flameSteps: { low: 18, medium: 26, high: 38 } },
    speed: 'speed', sustain: 'sustainTime',
    range: ['range', 'minRange'],
    set: { rumble: 0, impactShake: 0, coneFlare: .2, fadeTime: .38 },
  },
  firewhip: {
    cost: { draws: 7, gpuMs: 1.1 },
    colours: {
      lashColorCore: 0, lashColorInner: .28, lashColorOuter: .62, lashColorHalo: .93,
      crackColorBody: .9, crackColorRim: .28, crackColorEdge: .06, crackColorCorona: .35,
      colorCrackBurstA: .9, colorCrackBurstB: .45, colorCrackBurstC: .06, colorCrackFlash: .06,
      colorMuzzleA: .9, colorMuzzleB: .45, colorMuzzleC: .06, colorCastFlash: .3,
      ...EMBERS('colorEmber', 0, .3, .62, .95), colorScorchEmber: .55, lightColor: .42,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    end: 'tipHeight',
    size: ['lashRadius', 'lashRadiusNear', 'crackRadius', 'crackRadiusEnd', 'crackBurstSize', 'muzzleSize', 'scorchRadius', 'emberSize', 'ashSize', 'smokeSize'],
    counts: ['emberRate', 'emberFallRate', 'ashRate', 'smokeRate', 'crackSparks', 'crackAshBurst', 'releaseSparks', 'snapSparks', 'scorchRate'],
    speed: 'speed', sustain: 'lifetime', windup: ['windUp'],
    range: ['range', 'minRange'],
    set: { rumble: 0, crackShake: 0, snapShake: 0 },
  },
  emberflock: {
    cost: { draws: 10, gpuMs: 0.9 },
    colours: {
      ...EMBERS('colorBird', 0, .22, .62, .95), ...EMBERS('colorTrail', .05, .4, .75, .97), ...EMBERS('colorEmber', 0, .3, .62, .95),
      ...EMBERS('colorSpark', 0, .15, .5, .9), colorCharEmber: .55, colorCastFlash: .22, colorShockA: .22, colorShockB: .03,
      colorBurstA: .62, colorBurstB: .3, colorBurstC: 0, colorFlash: .3, lightColor: .4,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    end: 'endHeight',
    size: ['size', 'spacingSide', 'spacingUp', 'columnHeight', 'columnRadius', 'burstSize', 'shockRadius', 'scorchRadius', 'leadRise', 'trailWidth', 'emberSize', 'sparkSize', 'smokeSize'],
    counts: ['birds', 'emberRate', 'sparkRate', 'smokeRate', 'burstSparks', 'burstEmbers', 'columnEmbers', 'gatherSparks'],
    speed: 'speed', sustain: 'lifetime', windup: ['revealTime'],
    range: ['range', 'minRange'],
    set: { rumble: 0, impactShake: 0, columnHeight: 2.4, burstSize: 1.6, shockRadius: 2.6 },
  },
  ext_bend_fire: {
    cost: { draws: 5, gpuMs: 4.2 },
    colours: { colorCore: 0, colorMid: .3, colorEdge: .68, lightColor: .42 },
    launch: { height: 'flightHeight' },
    size: ['headSize', 'flameWidth', 'flameHeight', 'explosionSize', 'streamLength', 'emberSize', 'smokeSize'],
    counts: ['emberRate', 'sparkRate'],
    levels: { volumeSteps: { low: 18, medium: 26, high: 35 } },
    speed: 'speed', speedScale: 1.35,
    range: ['range', 'minRange'],
    set: { explosionShake: 0, heatDistortion: 0, paletteBlend: .45, explosionSize: 2 },
  },
  ext_pyre: {
    cost: { draws: 57, gpuMs: 8.8 },
    colours: {
      colorEmber: .72, colorFlame: .36, colorCore: 0, colorRim: .3, colorField: .55, colorFieldEdge: .18, colorVeil: .42, colorVeilCrest: .5,
      colorScorchEmber: .5, colorFracture: .25, colorShockA: .5, colorShockB: .04,
      colorCinderA: 0, colorCinderB: .38, colorCinderC: .82, ...EMBERS('colorEmber', 0, .25, .62, .95), ...EMBERS('colorUpdraft', .1, .38, .8, .97),
      colorCastFlash: .3, colorFlash: .3, lightColor: .42,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    zone: 'zoneRadius', radius: [2.2, 3.4], movable: true,
    size: ['ringHeight', 'skirtHeight', 'radius', 'veilHeight', 'veilRadius', 'shockRadius', 'trailScorchRadius', 'scorchRadius', 'cinderSize', 'emberSize', 'updraftSize', 'smokeSize'],
    counts: ['smokeRate', 'emberRate', 'updraftRate', 'burstCinders', 'burstSmoke', 'burstEmbers', 'trailScorchRate', 'scorchRate'],
    levels: { density: { low: .35, medium: .45, high: .5 } },
    speed: 'speed', sustain: 'lifetime',
    range: ['range', 'minRange'],
    set: { impactShake: 0, holdShake: 0, rumble: 0, haze: 0 },
  },
  p27_solarnova: {
    colours: { lightColor: .2 },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    zone: 'zoneRadius', radius: [1.6, 2.4], movable: true,
    counts: ['particles', 'fragments'],
    levels: { detail: { low: 0, medium: 1, high: 2 }, rings: { low: 2, medium: 3, high: 5 }, flares: { low: 2, medium: 5, high: 9 }, blades: { low: 4, medium: 10, high: 18 }, rays: { low: 8, medium: 16, high: 28 } },
    pace: 'timeScale', peak: 4.5,
    range: ['range', 'minRange'],
    set: { shake: 0 },
  },
  titan_firefist: {
    cost: { draws: 10, gpuMs: 0.5 },
    colours: {
      fistColorCore: 0, fistColorMid: .22, fistColorBody: .5, fistColorRim: .8,
      trailColorCore: 0, trailColorMid: .25, trailColorBody: .52, trailColorRim: .85,
      boomColorCore: 0, boomColorMid: .25, boomColorBody: .52, boomColorRim: .85,
      tongueColorRim: .08, tongueColorHeart: .25, tongueColorBody: .5,
      ...EMBERS('colorEmber', 0, .25, .52, .92), ...EMBERS('colorStreak', 0, .12, .3, .55),
      colorHitCore: 0, colorHitRim: .5, colorFlash: .2, lightColor: .42,
    },
    launch: { forward: 'handForward', side: 'handSide', height: 'handHeight' },
    size: ['fistSize', 'fistStart', 'boomSize', 'boomRing', 'scorchSize', 'tongueHeight', 'tongueWidth', 'rockSize'],
    counts: ['trailRate', 'emberRate', 'streakRate', 'boomCount', 'boomRocks', 'tongueCount'],
    speed: 'speed', sustain: 'hold', windup: ['charge'],
    range: ['range', 'minRange'],
    past: .4,
    set: { lines: 0, ifStrength: 0, ifFrames: 0, gradeWeight: 0, impactShake: 0, impactFlash: .3, fistSize: 2.3, fistStart: .35, fistGrow: .32,
      fistGlow: 1.15, fistCoreCut: .85, trailGlow: 1.1, trailHeat: .5, boomGlow: 1.3, trailLife: .65, trailSmokeAlpha: .55, boomSmokeAlpha: .6, boomLife: 1.1,
      boomRing: 5.5, boomSize: 1.15, boomCount: 26, boomRocks: 14, scorchSize: 3.6, hitScale: .7, fadeTime: 1.1 },
  },
  blade_crescent: {
    cost: { draws: 9, gpuMs: 1.0 },
    colours: {
      colorCore: 0, colorMid: .42, colorEdge: .86, colorScarHot: 0, colorScar: .42, colorScarEmber: .85,
      ...EMBERS('colorSpark', 0, .15, .42, .9), ...EMBERS('colorMote', 0, .2, .42, .9),
      colorBurstCore: 0, colorBurstMid: .42, colorBurstRim: .88, colorHitCore: 0, colorHitRim: .42, colorFlash: 0, lightColor: .42,
    },
    launch: { forward: 'handForward', height: 'swingHeight' },
    size: ['swingRadius', 'crescentRadius', 'crescentWidth', 'burstSize', 'shellSize', 'ringSize', 'sparkSize', 'moteSize', 'burstHeight'],
    counts: ['sparkRate', 'moteRate', 'debrisRate', 'dustRate', 'endSparks', 'endDebris', 'endDust'],
    speed: 'speed', sustain: 'lifetime', windup: ['windup'],
    range: ['range', 'minRange'],
    set: { ifStrength: 0, ifFrames: 0, impactShake: 0, releaseShake: 0, rumble: 0, shellSize: 1.1, ringSize: 1.4, burstSize: .9, endSparks: 60,
      hitScale: .4, burstExpand: .15, echoes: 1, crescentRadius: 1.7, crescentWidth: .85 },
  },
  extra_cross: {
    cost: { draws: 2, gpuMs: 0.9 },
    colours: { color: .32 },
    launch: { forward: 'handForward', height: 'handHeight' },
    end: 'targetHeight',
    size: ['scale'], windup: ['windup'],
    range: ['range', 'minRange'],
    set: { useColor: 1, impactFrames: 0, distortion: 0, shake: 0 },
  },
  ext_aura_fire: {
    cost: { draws: 13, gpuMs: 1.1 },
    colours: {
      colorRim: .62, colorCore: .1, colorVein: .4, colorFlameCore: 0, colorFlameBody: .42, colorFlameEmber: .8,
      colorOrbCore: 0, colorOrbFlame: .4, colorOrbEmber: .8, colorTrailCore: 0, colorTrailFlame: .45, colorTrailEmber: .85,
      colorFieldCrack: .55, colorFieldEmber: .2, colorFieldRing: .5, ...EMBERS('colorEmber', 0, .3, .66, .96), colorGroundEmber: .55, colorFlash: .3, lightColor: .4,
    },
    counts: ['flames', 'orbs', 'emberRate', 'smokeRate', 'burstEmbers', 'orbEmberRate'],
    size: ['fieldRadius', 'ringRadius'],
    follows: true, holdKey: 'duration',
    set: { activateShake: 0, rumble: 0, fresnel: 0 },
  },
});


export interface Palette { readonly core: string; readonly main: string; readonly rim: string }

const lum = (c: THREE.Color) => .2126 * c.r + .7152 * c.g + .0722 * c.b;
const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color();

export class HeatRamp {
  readonly core = new THREE.Color(); readonly main = new THREE.Color(); readonly rim = new THREE.Color();
  constructor(palette: Palette) {
    this.core.set(palette.core); this.main.set(palette.main); this.rim.set(palette.rim);
    if (lum(this.rim) >= lum(this.main)) this.rim.copy(this.main).multiplyScalar(.32).lerp(_a.setRGB(.3, .02, .01), .35);
  }
  at(t: number, out: THREE.Color) {
    const k = Math.max(0, Math.min(1, t));
    return k <= .5 ? out.copy(this.core).lerp(this.main, k / .5) : out.copy(this.main).lerp(this.rim, (k - .5) / .5);
  }
  recolour(hex: string, t: number) {
    _b.set(hex);
    this.at(t, _c);
    const want = lum(_b), have = lum(_c);
    if (have > 1e-5) _c.multiplyScalar(want / have);
    _c.r = Math.min(1, _c.r); _c.g = Math.min(1, _c.g); _c.b = Math.min(1, _c.b);
    return `#${_c.getHexString()}`;
  }
}

export function guessHeat(key: string): number | undefined {
  if (!/colou?r/i.test(key)) return undefined;
  if (/smoke|ash|scorch|soot|dust|debris|ink|outline|char|rock|shadow|void|ground(?!ember)/i.test(key)) return undefined;
  if (/core|white|hot|tip|bright|flash|A$/i.test(key)) return .05;
  if (/inner|B$|light/i.test(key)) return .3;
  if (/mid|main|body|flame|fire|spark|C$/i.test(key)) return .5;
  if (/edge|outer|rim|ember|D$/i.test(key)) return .75;
  if (/deep|halo|dark/i.test(key)) return .92;
  return .5;
}

const SCREEN = ['ifFrames', 'ifStrength', 'impactFrames', 'impactFrame', 'gradeWeight', 'stoneGrade', 'lines', 'distortion', 'haze', 'heatDistortion'];
const WINDUP = ['charge', 'windup', 'windUp', 'startDelay', 'castDelay', 'revealTime', 'chargeTime', 'gather', 'gatherTime', 'buildUp', 'buildup'];
const STAND_INS = ['statueShow', 'showTarget'];
const CAMERA = ['cameraPull'];
const GLITCH = ['glitchAmount', 'glitchTint', 'glitchScan', 'glitchSort', 'aberration'];
const LAUNCH = ['handForward', 'handSide', 'handHeight'];

const FRAMED: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  cin_dragon: { portalHeight: 5, portalBack: 2, portalOpen: .3, arriveTime: .6, altitude: 1.9, wingspan: 6.9, zoneRadius: 4.7, traceTime: 2.4, departTime: 1 },
};

export function autoFit(defaults: Readonly<Record<string, unknown>>, id?: string): Fit {
  const num = (key: string) => typeof defaults[key] === 'number';
  const [forward, side, height] = LAUNCH.map(key => (num(key) ? key : undefined));
  const set: Record<string, number> = {};
  for (const key of SCREEN) if (num(key)) set[key] = 0;
  for (const key of [...STAND_INS, ...CAMERA]) if (num(key)) set[key] = 0;
  if (num('aberration')) for (const key of GLITCH) if (num(key)) set[key] = 0;
  const size: string[] = [], counts: string[] = [];
  for (const [key, value] of Object.entries(defaults)) {
    if (LAUNCH.includes(key) || key === 'range' || key === 'minRange' || WINDUP.includes(key)) continue;
    const cls = classifyKey(key, value);
    if (cls === 'size') size.push(key);
    else if (cls === 'power' && Number.isInteger(value) && /(count|rate)$/i.test(key)) counts.push(key);
  }
  return {
    ...(forward || side || height ? { launch: { forward, side, height } } : {}),
    range: ['range', 'minRange'].filter(num),
    ...(num('speed') ? { speed: 'speed' } : {}),
    windup: WINDUP.filter(num),
    size, sizeScale: CLOSE_CAMERA * framing(defaults), counts, set: { ...set, ...(id ? FRAMED[id] : undefined) }, auto: true,
  };
}
const CLOSE_CAMERA = .6;
const FRAMED_AT = 11;
function framing(defaults: Readonly<Record<string, unknown>>) {
  const pull = defaults.cameraPull;
  return typeof pull === 'number' && pull > FRAMED_AT ? FRAMED_AT / pull : 1;
}
