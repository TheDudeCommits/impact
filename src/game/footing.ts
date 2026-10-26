import type { StageId } from './stages';

export interface LiquidFloor { kind: 'water' | 'blood'; level: number; lit: number; shade: number }
export const LIQUID_FLOORS: Partial<Record<StageId, LiquidFloor>> = {
  'valley-of-the-end': { kind: 'water', level: 0, lit: 0xf4fbff, shade: 0x86b7dc },
  'malevolent-shrine': { kind: 'blood', level: 0, lit: 0xc42a36, shade: 0x4e0a14 },
};
export const LIQUID_REACH = .25;
export function onLiquid(floor: LiquidFloor | undefined, y: number) { return !!floor && Math.abs(y - floor.level) < LIQUID_REACH; }
