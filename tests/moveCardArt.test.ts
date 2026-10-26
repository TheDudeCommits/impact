import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/ui/moveSheet', () => ({
  areaArtUrl: (id: string) => id === 'pending' ? undefined : `/area/${id}.webp?v=art`,
  moveSheetUrl: (id: string) => `/moves/${id}.webp`,
  decodeMoveArt: () => Promise.resolve(),
}));
import { MoveCardArt } from '../src/ui/moveCardArt';

function harness() {
  const layers = [0, 1].map(() => {
    const classes = new Set<string>(), properties = new Map<string, string>();
    return { classes, properties, classList: { toggle: (c: string, on: boolean) => on ? classes.add(c) : classes.delete(c) },
      style: { setProperty: (k: string, v: string) => properties.set(k, v), removeProperty: (k: string) => properties.delete(k) } };
  });
  const waiting = new Map<string, { resolve: () => void; reject: () => void }>();
  const load = vi.fn((url: string) => new Promise<void>((resolve, reject) => waiting.set(url, { resolve, reject })));
  const art = new MoveCardArt({ querySelectorAll: () => layers } as unknown as HTMLElement, load);
  const settle = async (id: string, fail = false) => {
    const pending = waiting.get(`/area/${id}.webp?v=art`)!;
    if (fail) pending.reject(); else pending.resolve();
    await Promise.resolve();
  };
  return { art, layers, load, settle };
}

describe('area move artwork', () => {
  it('makes no request for unpublished art and retains the reticle', () => {
    const { art, layers, load } = harness();
    art.show('pending', 4, true);
    expect(load).not.toHaveBeenCalled();
    expect(layers.every(l => l.classes.has('ik-glyph'))).toBe(true);
  });
  it('shows both ink layers only once the independent panel decodes', async () => {
    const { art, layers, settle } = harness();
    art.show('goku', 4, true);
    expect(layers[0].classes.has('ik-glyph')).toBe(true);
    await settle('goku');
    for (const layer of layers) {
      expect(layer.classes.has('ik-area-art')).toBe(true);
      expect(layer.classes.has('ik-glyph')).toBe(false);
      expect(layer.properties.get('--move-sheet')).toContain('/area/goku.webp?v=art');
    }
  });
  it('keeps the reticle when the image cannot decode', async () => {
    const { art, layers, settle } = harness();
    art.show('goku', 4, true); await settle('goku', true);
    expect(layers[0].classes.has('ik-glyph')).toBe(true);
    expect(layers[0].properties.has('--move-sheet')).toBe(false);
  });
  it('ignores an old fighter decode and clears area styling on an ordinary borrowed move', async () => {
    const { art, layers, settle } = harness();
    art.show('goku', 4); art.show('naruto', 4);
    await settle('goku');
    expect(layers[0].properties.has('--move-sheet')).toBe(false);
    await settle('naruto');
    expect(layers[0].properties.get('--move-sheet')).toContain('naruto');
    art.show('naruto', 0, true);
    expect(layers[0].classes.has('ik-area-art')).toBe(false);
    expect(layers[0].classes.has('ik-glyph')).toBe(false);
    expect(layers[0].properties.has('--move-sheet')).toBe(false);
  });
});
