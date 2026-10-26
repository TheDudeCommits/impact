import { ARMORY_RUNTIME } from './rollout';

export interface SoundAt { readonly x: number; readonly y: number; readonly z: number }

export interface ArmorySoundOut {
  sample(url: string, at: SoundAt, gain: number, rate?: number, owner?: string, priority?: number, delay?: number): void;
  preload(urls: readonly string[]): void;
  sampleSeconds(url: string): number | undefined;
  release?(urls: readonly string[]): void;
}

let out: ArmorySoundOut | undefined;

export function connectArmorySound(audio: ArmorySoundOut) { if (ARMORY_RUNTIME) out = audio; }
export const armorySoundOut = (): ArmorySoundOut | undefined => out;
