import crypto from 'node:crypto';

const b64json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Record<string, unknown>;

export class PrivyVerifier {
  private jwks = new Map<string, crypto.KeyObject>();
  private jwksAt = 0;
  constructor(readonly appId: string, private readonly fetcher: typeof fetch = fetch) {}
  get enabled() { return !!this.appId; }

  async verify(token: string): Promise<string> {
    return (await this.check(token)).sub as string;
  }

  async identity(token: string): Promise<{ did: string; emails: string[] }> {
    const payload = await this.check(token, 'The sign-in confirmation');
    let linked: unknown = payload.linked_accounts;
    if (typeof linked === 'string') { try { linked = JSON.parse(linked); } catch { linked = []; } }
    const emails = (Array.isArray(linked) ? linked : []).flatMap((entry: Record<string, unknown> | null) => {
      const type = entry?.type, address = entry?.address ?? entry?.email;
      return (type === 'email' || type === 'google_oauth') && typeof address === 'string' ? [address.trim().toLowerCase()] : [];
    });
    return { did: payload.sub as string, emails };
  }

  private async check(token: string, what = 'The sign-in token'): Promise<Record<string, unknown>> {
    if (!this.enabled) throw new Error('Sign-in is not set up yet.');
    const parts = String(token ?? '').split('.');
    if (parts.length !== 3) throw new Error(`${what} is malformed.`);
    let header: Record<string, unknown>, payload: Record<string, unknown>;
    try { header = b64json(parts[0]); payload = b64json(parts[1]); } catch { throw new Error(`${what} is malformed.`); }
    if (header.alg !== 'ES256') throw new Error(`${what} is of an unexpected type.`);
    const data = Buffer.from(`${parts[0]}.${parts[1]}`), signature = Buffer.from(parts[2], 'base64url');
    const keys = await this.published(typeof header.kid === 'string' ? header.kid : undefined);
    if (!keys.some(key => crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, signature))) throw new Error(`${what} did not check out.`);
    const now = Date.now() / 1000, audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== 'privy.io') throw new Error(`${what} is not from Privy.`);
    if (!audience.includes(this.appId)) throw new Error(`${what} is for another app.`);
    if (typeof payload.exp !== 'number' || payload.exp < now - 30) throw new Error('The sign-in expired. Try again.');
    if (typeof payload.iat === 'number' && payload.iat > now + 120) throw new Error(`${what} is from the future.`);
    if (typeof payload.sub !== 'string' || !/^did:privy:[A-Za-z0-9]+$/.test(payload.sub)) throw new Error(`${what} has no user.`);
    return payload;
  }

  private async published(kid?: string): Promise<crypto.KeyObject[]> {
    const stale = Date.now() - this.jwksAt > 6 * 3600_000 || (kid !== undefined && !this.jwks.has(kid) && Date.now() - this.jwksAt > 60_000);
    if (stale) {
      const response = await this.fetcher(`https://auth.privy.io/api/v1/apps/${encodeURIComponent(this.appId)}/jwks.json`);
      if (!response.ok) throw new Error('Could not reach Privy to check the sign-in.');
      const body = await response.json() as { keys?: (Record<string, unknown> & { kid?: string })[] };
      this.jwks.clear();
      for (const key of body.keys ?? []) this.jwks.set(key.kid ?? String(this.jwks.size), crypto.createPublicKey({ key: key as crypto.JsonWebKeyInput['key'], format: 'jwk' }));
      this.jwksAt = Date.now();
    }
    return kid && this.jwks.has(kid) ? [this.jwks.get(kid)!] : [...this.jwks.values()];
  }
}
