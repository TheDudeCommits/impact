export type BakedGlyph = [d: string, advance: number, x0: number, y0: number, x1: number, y1: number];
export interface GlyphSet { em: number; fonts: { ja: string; latin: string }; glyphs: Record<string, BakedGlyph> }

export const isJapanese = (char: string) => (char.codePointAt(0) ?? 0) >= 0x3000;
export const ringLatin = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export const charsOf = (text: string) => [...text].filter(c => c !== ' ');
