// Type declarations only: the implementation of this module is not part of the public repository (see README.md).
export interface ForgeCatalogEntry {
    readonly id: string;
    readonly label: string;
    readonly school: string;
    readonly kit?: string;
    readonly cast: 'line' | 'zone';
    readonly aura?: boolean;
    readonly thumb?: string;
}
export declare const ARMORY_EFFECTS: readonly ForgeCatalogEntry[];
