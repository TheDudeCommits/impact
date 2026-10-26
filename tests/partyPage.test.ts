import { describe, expect, it, vi } from 'vitest';
import { DISCORD_COPY, DISCORD_INVITE, discordButton, openDiscord } from '../src/ui/social/discord';
import { partySkeleton, welcomeMarkup } from '../src/ui/social/PartyUI';

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
describe('the party page', () => {
  it('invites to the Discord before and inside a party: the copy, the link, one button with the mark', () => {
    expect(DISCORD_INVITE).toBe('https://discord.gg/dCSHhJ73bW');
    expect(DISCORD_COPY).toBe('Need friends to play with? Join our Discord server!');
    for (const html of [welcomeMarkup(), welcomeMarkup({ joining: '123456' }), welcomeMarkup({ connecting: true, code: '12' }), partySkeleton()]) {
      expect(text(html)).toContain(DISCORD_COPY);
      expect(html).toContain(`data-party-discord="${DISCORD_INVITE}"`);
      const block = html.match(/<button[^>]*data-party-discord[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';
      expect(block).toContain('<svg');
      expect(text(block)).toContain(DISCORD_COPY);
      expect(html).not.toMatch(/<a[\s>]/);
      expect(html).not.toMatch(/<select/);
    }
    expect(partySkeleton()).toContain('pt-discord pt-compact');
    expect(welcomeMarkup()).not.toContain('pt-compact');
    expect(discordButton()).toContain('aria-label="Need friends to play with? Join our Discord server! (Discord opens in a new tab)"');
  });
  it('opens the invite in a new tab that cannot reach back into the game', () => {
    const open = vi.fn();
    openDiscord(open);
    expect(open).toHaveBeenCalledWith(DISCORD_INVITE, '_blank', 'noopener');
  });
});
