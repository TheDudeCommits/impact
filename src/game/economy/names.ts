import ownNames from './ownNames.json';

export const OWN_NAMES: readonly string[] = ownNames.names;

export const NAME_MIN = 3, NAME_MAX = 16;
export const NAME_SHAPE = /^[A-Za-z0-9_]{3,16}$/;
export const NAME_EVERY_DAYS = 30;
const DAY = 86_400_000;

export const nameKey = (name: string) => name.toLowerCase();
export const bareName = (name: string) => name.toLowerCase().replace(/_/g, '').replace(/^\d+|\d+$/g, '');

const RESERVED = new Set(['admin', 'admins', 'administrator', 'mod', 'mods', 'moderator', 'moderators', 'jump', 'jumpimpact', 'impact', 'system', 'sysop',
  'official', 'staff', 'support', 'help', 'helpdesk', 'owner', 'dev', 'devs', 'developer', 'developers', 'team', 'root', 'server', 'bot', 'bots', 'guest', 'guests',
  'fighter', 'player', 'null', 'undefined', 'nan', 'none', 'nobody', 'anonymous', 'anon', 'everyone', 'all', 'here', 'gamemaster', 'privy', 'sumi', 'rift',
  'riftarena', 'shop', 'store', 'account', 'accounts', 'security', 'signin', 'login', 'logout', 'claude', 'anthropic',
  'thedude', 'dude', ...OWN_NAMES]);
const RESERVED_PARTS = ['admin', 'moderator', 'official', 'jumpimpact', 'gamemaster', 'thedude'];

export function nameProblem(raw: unknown): string | undefined {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name.length < NAME_MIN) return `A username has at least ${NAME_MIN} characters.`;
  if (name.length > NAME_MAX) return `A username has at most ${NAME_MAX} characters.`;
  if (!NAME_SHAPE.test(name)) return 'A username is letters (A-Z), digits and _ only.';
  const bare = bareName(name);
  if (RESERVED.has(bare) || RESERVED_PARTS.some(part => bare.includes(part))) return 'That username is reserved.';
  return undefined;
}

export function nameFreeAt(account: { name?: string; nameAt?: number } | undefined): number {
  return account?.name && account.nameAt ? account.nameAt + NAME_EVERY_DAYS * DAY : 0;
}
