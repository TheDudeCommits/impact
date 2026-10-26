import type { FighterId } from '../../game/types';
import { EMBLEMS, type Emblem } from './emblems';
import { SYMBOLS } from './symbols';
import { isJapanese, ringLatin, type GlyphSet } from './glyphText';

let glyphs: GlyphSet | undefined, loading: Promise<GlyphSet | undefined> | undefined;
const paths = new Map<string, Path2D>();
export function loadGlyphs(): Promise<GlyphSet | undefined> {
  return loading ??= import('./glyphs.json').then(m => (glyphs = (m.default ?? m) as unknown as GlyphSet), () => undefined);
}
export const glyphsReady = () => !!glyphs;
const pathOf = (d: string) => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };

export interface SealText { fighter: FighterId; en: string; ja: string }
type Layer = 'emblem' | 'text' | 'stroke';
interface Ink { mask: boolean; colour: string; ink: string; paper: string }
const MASK: Record<Layer, string> = { emblem: '#ff0000', text: '#00ff00', stroke: '#0000ff' };

function rng(seed: string) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }

function enso(ctx: CanvasRenderingContext2D, r: number, width: number, from: number, to: number, random: () => number) {
  const steps = 260;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps, t = from + (to - from) * k, taper = Math.min(1, k / .08) * Math.min(1, (1 - k) / .22) ** .7;
    const w = width * (.55 + .45 * taper) * (.88 + random() * .24), rr = r + (random() - .5) * width * .18;
    ctx.beginPath(); ctx.arc(Math.cos(t) * rr, Math.sin(t) * rr, w / 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineWidth = width * .08;
  for (let s = 0; s < 5; s++) {
    const off = (random() - .5) * width * .9, a0 = from + random() * (to - from) * .6, a1 = a0 + (to - from) * (.15 + random() * .3);
    ctx.beginPath(); ctx.arc(0, 0, r + off, a0, Math.min(a1, to)); ctx.stroke();
  }
}

function glyph(ctx: CanvasRenderingContext2D, char: string, size: number, centreBox = false) {
  const g = glyphs?.glyphs[char];
  if (!g) return;
  const s = size / glyphs!.em, [d, adv, x0, y0, x1, y1] = g;
  ctx.save();
  if (centreBox) ctx.translate(-(x0 + x1) / 2 * s, -(y0 + y1) / 2 * s); else ctx.translate(-adv / 2 * s, 0);
  ctx.scale(s, s); ctx.fill(pathOf(d)); ctx.restore();
}
const advance = (char: string, size: number) => char === ' ' ? size * .32 : (glyphs?.glyphs[char]?.[1] ?? 0) * size / (glyphs?.em ?? 200);

function emblem(ctx: CanvasRenderingContext2D, e: Emblem, radius: number) {
  if ('symbol' in e) {
    const s = radius * 2 / 100;
    ctx.save(); ctx.translate(-radius, -radius); ctx.scale(s, s); ctx.fill(pathOf(SYMBOLS[e.symbol]), 'nonzero'); ctx.restore();
    return;
  }
  const chars = [...e.glyph], n = chars.length, d = radius * 2;
  const cells: [number, number, number][] = n === 1 ? [[0, 0, d * .92]]
    : n === 4 ? [[d * .25, -d * .25, d * .5], [d * .25, d * .25, d * .5], [-d * .25, -d * .25, d * .5], [-d * .25, d * .25, d * .5]]
      : chars.map((_, i) => [0, (i - (n - 1) / 2) * d * .92 / n, d * .92 / n * 1.04]);
  chars.forEach((c, i) => { const [x, y, size] = cells[i]; ctx.save(); ctx.translate(x, y); glyph(ctx, c, size, true); ctx.restore(); });
}

function ringText(ctx: CanvasRenderingContext2D, text: SealText, r: number, size: number) {
  const parts = [...(text.ja ? [text.ja] : []), ringLatin(text.en)].filter(Boolean);
  if (!parts.length || !glyphs) return;
  const dot = size * .55;
  const lengthOf = (s: string, sz: number) => [...s].reduce((sum, c) => sum + advance(c, isJapanese(c) ? sz * 1.05 : sz), 0);
  let sz = size, unit = parts.reduce((sum, p) => sum + lengthOf(p, sz) + dot, 0);
  if (unit > Math.PI * 2 * r * .96) { sz *= Math.PI * 2 * r * .96 / unit; unit = parts.reduce((sum, p) => sum + lengthOf(p, sz) + dot, 0); }
  const times = Math.max(1, Math.floor(Math.PI * 2 * r / unit)), spare = (Math.PI * 2 * r - times * unit) / (times * parts.length);
  let at = -Math.PI / 2 - (lengthOf(parts[0], sz) / 2) / r;
  const place = (c: string, w: number, draw: () => void) => {
    const mid = at + w / 2 / r;
    ctx.save(); ctx.rotate(mid + Math.PI / 2); ctx.translate(0, -r); draw(); ctx.restore();
    at += w / r;
  };
  for (let k = 0; k < times; k++) for (const part of parts) {
    for (const c of part) {
      const s = isJapanese(c) ? sz * 1.05 : sz, w = advance(c, s);
      if (c === ' ') { at += w / r; continue; }
      place(c, w, () => { if (isJapanese(c)) glyph(ctx, c, s, true); else { ctx.translate(0, s * .36); glyph(ctx, c, s); } });
    }
    at += spare / r;
    place('·', dot, () => { ctx.beginPath(); ctx.arc(0, 0, dot * .18, 0, Math.PI * 2); ctx.fill(); });
  }
}

export function paintSeal(ctx: CanvasRenderingContext2D, text: SealText, ink: Partial<Ink> = {}) {
  const { mask = true, colour = '#c21a1a', paper = '#f6ecd6' } = ink, inkColour = ink.ink ?? '#1a0d0d';
  const size = ctx.canvas.width, R = size / 2 * .985, random = rng(`${text.fighter}|${text.en}`);
  const e = EMBLEMS[text.fighter];
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  if (mask) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size); ctx.globalCompositeOperation = 'lighter'; }
  ctx.translate(size / 2, size / 2); ctx.scale(R, R);
  const paint = (layer: Layer) => { const c = mask ? MASK[layer] : layer === 'emblem' || layer === 'text' ? paper : inkColour; ctx.fillStyle = c; ctx.strokeStyle = c; };
  if (!mask) { ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(0, 0, .86, 0, Math.PI * 2); ctx.fill(); }
  paint('stroke');
  enso(ctx, .9, .1, -Math.PI * .42, Math.PI * 1.43, random);
  ctx.lineWidth = .028; ctx.beginPath(); ctx.arc(0, 0, .63, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = .012; ctx.beginPath(); ctx.arc(0, 0, .595, 0, Math.PI * 2); ctx.stroke();
  paint('text');
  ringText(ctx, text, .765, .17);
  paint('emblem');
  emblem(ctx, e, .52);
  ctx.restore();
}

export function paintLine(canvas: HTMLCanvasElement, text: string, colour: string) {
  const size = canvas.height * .82, chars = [...text];
  const width = Math.max(1, Math.ceil(chars.reduce((sum, c) => sum + advance(c, isJapanese(c) ? size : size), 0) + size * .2));
  canvas.width = width;
  const ctx = canvas.getContext('2d');
  if (!ctx || !glyphs) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colour;
  let x = size * .1;
  for (const c of chars) {
    const w = advance(c, size);
    if (c !== ' ') { ctx.save(); ctx.translate(x + w / 2, canvas.height / 2); glyph(ctx, c, size, isJapanese(c)); ctx.restore(); }
    x += w;
  }
}
