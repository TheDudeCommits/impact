export type MacroClass = 'size' | 'glow' | 'alpha' | 'color' | 'speed' | 'dur' | 'power';

export const ESSENTIALS = Object.freeze([
  { key: '_glow', label: 'Glow', min: .3, max: 2, step: .01, value: 1 },
  { key: '_speed', label: 'Speed', min: .25, max: 2, step: .01, value: 1 },
  { key: '_power', label: 'Power', min: .3, max: 2, step: .01, value: 1 },
] as const);
export interface Macros { glow?: number; speed?: number; power?: number }

const HEX = /^#[0-9a-f]{6}$/i;
const EXCLUDE = /^(range|minRange|cooldown|castAnim|seed|zoneRange)$|hitstop|^hs[A-Z]|timescale/i;
const SHAPE = /(curve|jitter|bias|ratio|frac|fraction|falloff|power|exp|exponent|sharp|sharpness|taper|angle|tilt|lean|twist|bend|phase|aspect|threshold|min|max|start|end|offset|seed|octaves|lacunarity|gamma|contrast|invert|mono)$/i;
const FREQ_SCALE = /(noise|crystal|vein|fracture|crawl|cell|glint|grain|detail|freq|tex|uv|pattern|turb|warp|ripple|wave|band|stripe|crack|tile|voronoi|break|erode|ragged|jag|flicker|time|life)\w*scale$/i;
const RE = {
  power1: /(shake|flash|rumble)/i,
  dur: /(time|duration|life|lifetime|delay|hold|linger|stagger|interval|period|fade|fadein|fadeout|settle|windup|decay)$/i,
  speed: /(speed|spin|velocity|swirl|rise|spinrate)$/i,
  glow: /(glow|intensity|emissive|emission|bloom|bright|brightness|gain|flare|luminance|exposure)$/i,
  alpha: /(opacity|alpha)$/i,
  size: /(size|scale|radius|radii|length|width|height|reach|spread|span|thickness|thick|girth|diameter|extent|footprint)$/i,
  power2: /(count|density|strength|amount|rate|burst|particles|sparks|embers|motes|chips|debris|shards|punch|force|kick|impulse|distortion|distort|refraction|turbulence|boost)$/i,
};
const COUNT = /(count|particles|sparks|embers|motes|chips|debris|shards)$/i;

export function classifyKey(key: string, value: unknown): MacroClass | null {
  if (EXCLUDE.test(key)) return null;
  if (typeof value === 'string') return HEX.test(value) ? 'color' : null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (RE.power1.test(key) && !/(time|duration|delay|life|decay|speed|color|colour|freq|frequency|rate)$/i.test(key)) return 'power';
  if (SHAPE.test(key)) return null;
  if (RE.dur.test(key)) return value > 0 ? 'dur' : null;
  if (RE.speed.test(key) || /(flap|climb|spin|pulse|throb|flicker|beat|orbit)rate$/i.test(key)) return 'speed';
  if (RE.glow.test(key)) return 'glow';
  if (RE.alpha.test(key)) return 'alpha';
  if (RE.size.test(key)) return FREQ_SCALE.test(key) ? null : 'size';
  if (RE.power2.test(key)) return 'power';
  return null;
}

export function macroValue(key: string, shipped: unknown, m: Macros): number | undefined {
  const cls = classifyKey(key, shipped);
  if (cls === null || typeof shipped !== 'number') return undefined;
  const glow = m.glow ?? 1, speed = m.speed ?? 1, power = m.power ?? 1;
  switch (cls) {
    case 'glow': return glow === 1 ? undefined : shipped * glow;
    case 'alpha': return glow === 1 ? undefined : Math.min(1, shipped * glow);
    case 'speed': return speed === 1 ? undefined : shipped * speed;
    case 'dur': return speed === 1 ? undefined : shipped / Math.max(.05, speed);
    case 'power': {
      if (power === 1) return undefined;
      if (COUNT.test(key) || Number.isInteger(shipped) && /(rate|count)$/i.test(key)) return Math.max(1, Math.round(shipped * Math.min(1, power)));
      return shipped * power;
    }
    default: return undefined;
  }
}

export function splitSettings(settings: Readonly<Record<string, number | string | boolean>> | undefined): { macros: Macros; own: Record<string, number | string | boolean> } {
  const macros: Macros = {}, own: Record<string, number | string | boolean> = {};
  for (const [key, value] of Object.entries(settings ?? {})) {
    if (key === '_glow' && typeof value === 'number') macros.glow = value;
    else if (key === '_speed' && typeof value === 'number') macros.speed = value;
    else if (key === '_power' && typeof value === 'number') macros.power = value;
    else if (!key.startsWith('_')) own[key] = value;
  }
  return { macros, own };
}


function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360; s = Math.min(1, Math.max(0, s)); l = Math.min(1, Math.max(0, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function turnHue(hex: string, hue: number) {
  if (!hue || !HEX.test(hex)) return hex;
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h + hue, s, l);
}
