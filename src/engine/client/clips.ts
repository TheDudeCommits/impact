import data from './clips.json';
import type { FighterId } from '../../game/types';

export interface BodyClipMap {
  readonly body: string;
  readonly fingerprint: string;
  readonly clips: Readonly<Record<string, string | null>>;
}
export interface FighterClipMap extends BodyClipMap { readonly form?: BodyClipMap }

export const CLIP_MAP = data as unknown as Readonly<Partial<Record<FighterId, FighterClipMap>>>;

export function clipFingerprint(clips: readonly { readonly name: string; readonly duration: number }[]): string {
  let hash = 0x811c9dc5;
  for (const clip of clips) {
    const text = `${clip.name}\u0000${Number.isFinite(clip.duration) ? Math.round(clip.duration * 1000) : 0}\n`;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; }
  }
  return `${clips.length}:${hash.toString(16).padStart(8, '0')}`;
}

export function clipNameFor(fighter: FighterId, key: string, form = false): string | null | undefined {
  const entry = CLIP_MAP[fighter], clips = (form ? entry?.form : entry)?.clips;
  if (!clips) return undefined;
  if (key in clips) return clips[key];
  const stage = /^rush (\d)$/.exec(key);
  return stage ? clips[`rush fill ${stage[1]}`] : undefined;
}

export function clipMapFor(fighter: FighterId, form: boolean, clips: readonly { readonly name: string; readonly duration: number }[]): BodyClipMap | undefined {
  const entry = CLIP_MAP[fighter], map = form ? entry?.form : entry;
  return map && map.fingerprint === clipFingerprint(clips) ? map : undefined;
}
