export const INK_IMPACT_URL = '/assets/vfx/ink-impacts.png';
export const INK_IMPACT_GRID = 8;
export const INK_IMPACTS = {
  burst: { start: 0, frames: 12, directional: true },
  burst2: { start: 12, frames: 12, directional: true },
  slash: { start: 24, frames: 8, directional: true },
  blast: { start: 32, frames: 12, directional: false },
  flash: { start: 44, frames: 4, directional: false },
  ring: { start: 48, frames: 8, directional: false },
} as const;
export type InkImpact = keyof typeof INK_IMPACTS;
