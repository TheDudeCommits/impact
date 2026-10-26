import { loadSettings, type Settings } from '../../config';

export type GroundQuality = Settings['quality'];

export interface GroundTier {
  blades: number;
  reach: number;
  decals: number;
  water: { sim: boolean; cell: number; rate: number };
  prints: number;
}

export const GROUND_TIERS: Record<GroundQuality, GroundTier> = {
  high: { blades: 1, reach: 34, decals: 1, water: { sim: true, cell: .3, rate: 60 }, prints: 384 },
  medium: { blades: .5, reach: 24, decals: .6, water: { sim: true, cell: .42, rate: 60 }, prints: 192 },
  low: { blades: 0, reach: 0, decals: .35, water: { sim: false, cell: 0, rate: 0 }, prints: 0 },
};

export function readQuality(): GroundQuality { return loadSettings().quality; }

export class QualityWatch {
  current: GroundQuality = readQuality();
  private frames = 0;
  constructor(private readonly every = 90) {}
  poll() {
    if (++this.frames % this.every) return false;
    const next = readQuality();
    if (next === this.current) return false;
    this.current = next;
    return true;
  }
}
