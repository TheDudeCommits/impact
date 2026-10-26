export const BACKGROUND_FIGHTER_LIMIT = 16;

export function rosterPrefetch<T>(roster: readonly T[], preferred?: T): readonly T[] {
  const index = preferred === undefined ? 0 : roster.indexOf(preferred);
  if (index < 0) return [];
  const start = Math.floor(index / BACKGROUND_FIGHTER_LIMIT) * BACKGROUND_FIGHTER_LIMIT;
  return roster.slice(start, start + BACKGROUND_FIGHTER_LIMIT);
}
