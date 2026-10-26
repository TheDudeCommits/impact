import crypto from 'node:crypto';

export const P2_ISSUER = 'https://playertwo.lol';
export const p2Login = (id: string) => `p2:${id}`;
export const p2Of = (login: string) => /^p2:([A-Za-z0-9_-]{16,64})$/.exec(login)?.[1];

export interface PlayerTwoOptions {
  game?: string;
  keys?: string;
  fetcher?: typeof fetch;
  now?: () => number;
}
export interface PlayerTwoPlayer { id: string; handle: string; name: string; level: number; kind: 'full' | 'demo' | 'test' }

const b64json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Record<string, unknown>;
const KINDS = ['full', 'demo', 'test'];

export class PlayerTwoVerifier {
  readonly game: string;
  private readonly keys: string;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private jwks = new Map<string, crypto.KeyObject>();
  private jwksAt = -Infinity;
  private askedAt = -Infinity;
  constructor(options: PlayerTwoOptions = {}) {
    this.game = options.game?.trim() || 'impact';
    this.keys = options.keys?.trim() || `${P2_ISSUER}/.well-known/p2-keys.json`;
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async verify(token: string): Promise<PlayerTwoPlayer> {
    const what = 'The Player Two sign-in';
    const parts = typeof token === 'string' && token.length <= 8192 ? token.split('.') : [];
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error(`${what} is malformed.`);
    let header: Record<string, unknown>, claims: Record<string, unknown>;
    try { header = b64json(parts[0]); claims = b64json(parts[1]); } catch { throw new Error(`${what} is malformed.`); }
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error(`${what} is of an unexpected type.`);
    const key = await this.key(header.kid);
    if (!key || !crypto.verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'))) throw new Error(`${what} did not check out.`);
    const now = this.now() / 1000, audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.typ !== 'p2-id' || claims.iss !== P2_ISSUER) throw new Error(`${what} is not a Player Two identity.`);
    if (!audience.includes(this.game)) throw new Error(`${what} is for another game.`);
    if (typeof claims.exp !== 'number' || claims.exp < now - 30) throw new Error('The Player Two sign-in ran out. Try again.');
    if (typeof claims.iat === 'number' && claims.iat > now + 120) throw new Error(`${what} is from the future.`);
    if (typeof claims.sub !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(claims.sub) || !KINDS.includes(claims.kind as string)) throw new Error(`${what} has no player.`);
    const text = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';
    return { id: claims.sub, handle: text(claims.h, 40), name: text(claims.name, 60), level: Number.isFinite(claims.lvl) ? Math.floor(claims.lvl as number) : 0, kind: claims.kind as PlayerTwoPlayer['kind'] };
  }

  private async key(kid: string): Promise<crypto.KeyObject | undefined> {
    const now = this.now();
    if ((now - this.jwksAt > 3600_000 || !this.jwks.has(kid)) && now - this.askedAt > 60_000) {
      this.askedAt = now;
      const response = await this.fetcher(this.keys).catch(() => undefined);
      const body = response?.ok ? await response.json().catch(() => undefined) as { keys?: (Record<string, unknown> & { kid?: string })[] } | undefined : undefined;
      if (body) {
        const keys = new Map<string, crypto.KeyObject>();
        for (const each of body.keys ?? []) {
          if (each.kty !== 'RSA' || typeof each.kid !== 'string') continue;
          try { keys.set(each.kid, crypto.createPublicKey({ key: { kty: 'RSA', n: each.n, e: each.e } as crypto.JsonWebKeyInput['key'], format: 'jwk' })); } catch { }
        }
        this.jwks = keys; this.jwksAt = now;
      }
    }
    if (!this.jwks.size) throw new Error('Could not reach Player Two to check the sign-in.');
    return this.jwks.get(kid);
  }
}
