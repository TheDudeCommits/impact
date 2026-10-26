import type { ModeId } from './catalogue';

export function goLabel(mode: ModeId, go: string, fighter: string, locked: boolean, invite?: string): { label: string; note?: string } {
  if (locked && mode !== 'training') return { label: `UNLOCK ${fighter.toUpperCase()}`, note: 'IN ACCOUNT · OR TRY IN TRAINING' };
  if (invite !== undefined) return { label: 'JOIN ROOM', note: /^\d{6}$/.test(invite) ? `YOUR FRIEND'S ROOM · ${invite}` : "YOUR FRIEND'S ROOM" };
  return { label: go };
}
