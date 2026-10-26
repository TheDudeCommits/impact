import type { FighterId } from '../../game/types';
import { decodeForge, forgeProblems } from '../sim/forge';

export const forgeWanted = () => typeof location === 'object' && new URLSearchParams(location.search).has('forge');

export const forgeDraftKey = (body: FighterId) => `jump-forge-draft:${body}`;
export const forgeOnlineKey = (body: FighterId) => `jump-forge-online:${body}`;

export type ForgeRead = (key: string) => string | null;
const stored: ForgeRead = key => { try { return localStorage.getItem(key); } catch { return null; } };

export const forgeOnline = (body: FighterId, read: ForgeRead = stored) => read(forgeOnlineKey(body)) === '1';
export function setForgeOnline(body: FighterId, on: boolean) {
  try { if (on) localStorage.setItem(forgeOnlineKey(body), '1'); else localStorage.removeItem(forgeOnlineKey(body)); } catch { }
}

export function forgeJoinOption(fighter: FighterId, read: ForgeRead = stored): { forge?: string } {
  if (!forgeOnline(fighter, read)) return {};
  try {
    const code = read(forgeDraftKey(fighter));
    if (!code) return {};
    const kit = decodeForge(code);
    return kit.body === fighter && !forgeProblems(kit, { availability: 'released' }).errors.length ? { forge: code } : {};
  } catch { return {}; }
}
