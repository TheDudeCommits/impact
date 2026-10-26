// Type declarations only: the implementation of this module is not part of the public repository (see README.md).
import type { ArmoryAbilityClass } from '../types';
export declare const ARMORY_COMMIT = "734f147f39b43c3ec1e90f5978758f50e0bf777b";
export interface ArmoryManifestEntry {
    readonly id: string;
    readonly label: string;
    readonly school: string;
    readonly settings: string;
    readonly cast: 'line' | 'zone';
    readonly hash: string;
    readonly usedBy: readonly string[];
    readonly kit?: string;
    readonly aura?: boolean;
    readonly thumb?: string;
    readonly load: () => Promise<ArmoryAbilityClass>;
}
export declare const ARMORY_MANIFEST: Readonly<Record<string, ArmoryManifestEntry>>;
export declare const ARMORY_ASSETS: readonly string[];
export declare const ARMORY_SLOTS: Readonly<Record<string, Readonly<Record<string, string | null>>>>;
