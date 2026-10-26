import crypto from 'node:crypto';

export interface Link { pk: string; player: string; handle: string; name: string; until: number }

export const LINK_MS = 10 * 60_000, LINKS_PER_HOUR = 10;

export class LinkCodes {
  private readonly codes = new Map<string, Link>();
  private readonly asked = new Map<string, number[]>();

  issue(pk: string, player: { id: string; handle: string; name: string }, now: number): { code: string; until: number } | null {
    for (const [code, link] of this.codes) if (link.until <= now || link.pk === pk) this.codes.delete(code);
    const hour = (this.asked.get(pk) ?? []).filter(at => at > now - 3600_000);
    if (hour.length >= LINKS_PER_HOUR) return null;
    this.asked.set(pk, [...hour, now]);
    const code = crypto.randomBytes(24).toString('base64url'), until = now + LINK_MS;
    this.codes.set(code, { pk, player: player.id, handle: player.handle, name: player.name, until });
    return { code, until };
  }
  read(code: unknown, now: number): Link | undefined {
    const link = typeof code === 'string' ? this.codes.get(code) : undefined;
    return link && link.until > now ? link : undefined;
  }
  take(code: string) { this.codes.delete(code); }
}
