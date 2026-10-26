export interface NamedClip { readonly name: string }

export const clipKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export function findClipIn<T extends NamedClip>(clips: readonly T[], patterns: readonly string[]): T | undefined {
  for (const pattern of patterns) {
    const key = clipKey(pattern);
    const exact = clips.find(clip => clipKey(clip.name) === key);
    if (exact) return exact;
    const match = clips.find(clip => clipKey(clip.name).includes(key));
    if (match) return match;
  }
  return undefined;
}

export function joinClips<T extends NamedClip>(clips: readonly T[], added: readonly T[]): T[] {
  const names = new Set(added.map(clip => clip.name));
  return [...clips.filter(clip => !names.has(clip.name)), ...added];
}

export function appendClips<T>(clips: T[], added?: readonly T[]): T[] {
  return added?.length ? [...clips, ...added] : clips;
}
