// Type declarations only: the implementation of this module is not part of the public repository (see README.md).
import type { ArmorySoundName, ArmorySoundProfile } from '../types';
export declare const ARMORY_SOUND_PROFILES: Readonly<Record<string, ArmorySoundProfile>>;
export declare const ARMORY_SOUND_NAMES: Readonly<Record<string, ArmorySoundName>>;
export declare const loadRecipes: (() => Promise<typeof import('./audio/recipes.js')>) | undefined;
export declare const ARMORY_SOUND_DROPPED: readonly {
    readonly effect: string;
    readonly sound: string;
    readonly why: string;
}[];
