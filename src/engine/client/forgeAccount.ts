import { account, economyServer } from '../../ui/shop/account';
import type { FighterId } from '../../game/types';

export interface KeptFighter { hash: string; code: string; name: string; body: FighterId; at: number }

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${economyServer()}/api/economy/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000),
  });
  let json: { error?: string } & Record<string, unknown> = {};
  try { json = await response.json(); } catch { }
  if (!response.ok) throw new Error(json.error ?? `The server answered ${response.status}.`);
  return json as T;
}
const token = () => { const secret = account.secret(); if (!secret) throw new Error('Sign in first (PROFILE, in Account) to keep forged fighters.'); return secret; };

export const saveForged = async (code: string) => call<{ kept: KeptFighter }>('forge-save', { token: token(), code }).then(answer => answer.kept);
export const keptForged = async () => call<{ kept: KeptFighter[] }>('forge-mine', { token: token() }).then(answer => answer.kept);
export const sharedForged = (hash: string) => call<{ kit: Omit<KeptFighter, never> }>('forge-get', { hash }).then(answer => answer.kit);
export const removeForged = async (hash: string) => call<{ kept: KeptFighter[] }>('forge-remove', { token: token(), hash }).then(answer => answer.kept);
export const shareLink = (hash: string) => `${location.origin}${location.pathname}?forge&kit=${hash}`;
