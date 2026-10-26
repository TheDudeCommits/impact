// Type declarations only: the implementation of this module is not part of the public repository (see README.md).
import type { FighterCasting } from '../../../../engine/vfx/casting';
export type RuntimeCasting = {
    readonly palette: FighterCasting['palette'];
    readonly slots?: Partial<FighterCasting['slots']>;
};
export declare const ARMORY_CASTINGS: Readonly<Record<string, RuntimeCasting>>;
