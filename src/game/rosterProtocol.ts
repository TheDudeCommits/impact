export const ROSTER_PROTOCOL = 'jump-roster-v21-sniper-desert-restriction';
export const ROSTER_REFRESH_MESSAGE = 'Refresh Impact to load the updated fighter roster.';
export interface RosterProtocolOptions { rosterProtocol?: unknown; }
export function requireRosterProtocol(value: unknown): void {
  if (value !== ROSTER_PROTOCOL) throw new Error(ROSTER_REFRESH_MESSAGE);
}
