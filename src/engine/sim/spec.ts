import type { AwakeningDefinition } from '../../game/awakening';
import type { MoveDefinition, RushShape } from '../../game/moves';
import type { ComboKey } from '../../game/combos';
import type { TourStyle } from '../../game/timeStopBarrage';
import type { AttackSlot, CoreSlot, FighterId } from '../../game/types';
import type { BodyType, ElementKitId } from './archetypes';

export const SPEC_VERSION = 1 as const;

export const ATTACK_SLOTS: readonly AttackSlot[] = ['light', 'heavy', 'special', 'ultimate', 'area'];
export const CORE_SLOTS: readonly CoreSlot[] = ['light', 'heavy', 'special', 'ultimate'];

export interface KitSpec {
  slots: Record<AttackSlot, MoveDefinition>;
  rush: readonly MoveDefinition[];
  rushShape: RushShape;
  airRush?: readonly (string | undefined)[];
  combos: Partial<Record<ComboKey, MoveDefinition>>;
  awakening: AwakeningDefinition;
  awakened: { slots: Partial<Record<AttackSlot, MoveDefinition>>; rush: readonly (MoveDefinition | null)[]; combos: Partial<Record<ComboKey, MoveDefinition>> };
  timeStopTour?: TourStyle;
}

export interface BodySimSpec {
  contactGap: number;
  bodySize: number;
  jumpScale: number;
}

export interface ArchetypeSpec { body: BodyType; elements: readonly ElementKitId[] }

export interface SimFighterSpec {
  spec: typeof SPEC_VERSION;
  id: FighterId;
  pack: 'jump';
  series: string;
  faction: 'heroes' | 'villains';
  availability: { released: boolean; laboratory: boolean };
  archetype: ArchetypeSpec;
  body: BodySimSpec;
  kit: KitSpec;
}
