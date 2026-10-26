export const ARENAS_FULL_MESSAGE = 'The arenas are full right now. Training, Arcade and Bot Duel run on your device, or try again in a minute.';
export function isArenasFull(error: unknown): boolean {
  const text = typeof error === 'string' ? error : error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string' ? (error as { message: string }).message : '';
  return text.includes(ARENAS_FULL_MESSAGE);
}
