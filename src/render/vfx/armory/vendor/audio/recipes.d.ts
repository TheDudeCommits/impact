// Type declarations only: the implementation of this module is not part of the public repository (see README.md).
export interface ArmoryRecipeVoice { readonly end: number; stop?(when: number, fade?: number): number }
export type ArmoryKit = { readonly ac: BaseAudioContext };
export type ArmoryRecipe = (kit: ArmoryKit, out: AudioNode, t: number, p: Record<string, unknown>) => ArmoryRecipeVoice;
export declare function makeKit(ac: BaseAudioContext): ArmoryKit;
export declare const RECIPES: Readonly<Record<string, ArmoryRecipe>>;
export declare const RECIPE_INFO: Readonly<Record<string, { readonly loop: boolean; readonly about: string; readonly params: Readonly<Record<string, number | string>> }>>;
export declare const LOOP_RECIPES: ReadonlySet<string>;
