export interface PlayerTwoApi {
  identity(): Promise<string>;
  player?: { handle?: string; name?: string } | null;
  presence?: { set(text: string | null, options?: { join?: Record<string, string> }): Promise<unknown> };
  invite?(params: Record<string, string>): Promise<string>;
  params?: Record<string, string> | null;
}
interface Sdk { env?: string; init?: () => Promise<PlayerTwoApi> }
const sdk = (): Sdk | undefined => (globalThis as { PlayerTwo?: Sdk }).PlayerTwo;

let found: Promise<PlayerTwoApi | undefined> | undefined;
export function playerTwo(): Promise<PlayerTwoApi | undefined> {
  return found ??= (async () => {
    const p2 = sdk();
    if (typeof p2?.init !== 'function') return undefined;
    try { const api = await p2.init(); return p2.env === 'p2' && api ? api : undefined; } catch { return undefined; }
  })();
}
export const inPlayerTwo = () => sdk()?.env === 'p2';

export function identityPlayer(token: string): string | undefined {
  try { const sub = (JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown }).sub; return typeof sub === 'string' ? sub : undefined; } catch { return undefined; }
}

let shown: string | null | undefined;
export function presence(text: string | null) {
  if (text === shown) return;
  shown = text;
  void playerTwo().then(p2 => p2?.presence?.set(text)).catch(() => { });
}

export async function inviteLink(params: Record<string, string>, own: string): Promise<string> {
  if (!inPlayerTwo()) return own;
  try { return (await (await playerTwo())?.invite?.(params)) ?? own; } catch { return own; }
}

export function joinHash(params: unknown): string {
  if (!params || typeof params !== 'object') return '';
  const p = params as Record<string, unknown>, code = (value: unknown) => typeof value === 'string' && /^\d{6}$/.test(value) ? value : undefined;
  const room = code(p.room), party = code(p.party);
  if (party) return `#party=${party}`;
  if (room && (p.kind === 'private' || p.kind === 'coop' || p.kind === 'duel')) return `#${new URLSearchParams({ room, kind: p.kind })}`;
  if (room && (p.mode === 'last-stand' || p.mode === 'bad-blood' || p.mode === 'rift-war')) return `#${new URLSearchParams({ mode: p.mode, room })}`;
  return '';
}
