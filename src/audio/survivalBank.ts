import { WEARS } from '../survival/horde/kinds';

export const BANK = {
  'man-swing': 10, 'man-cry': 8, 'man-hurt': 5, 'man-die': 5,
  'beast-swing': 9, 'beast-growl': 10, 'beast-roar': 7, 'beast-hurt': 5, 'beast-die': 7,
  'brute-roar': 5, imp: 7, gore: 18, stomp: 1,
  'zombie-swing': 16, 'zombie-cry': 5, 'zombie-hurt': 6, 'zombie-die': 5, 'demon-roar': 12,
} as const;
export type Family = keyof typeof BANK;
export type Voice = 'man' | 'beast' | 'brute' | 'imp' | 'zombie' | 'demon';

export const VOICE_OF: Record<string, Voice> = {
  marine: 'zombie', 'marine-rifle': 'zombie', husk: 'zombie',
  'beast-pirate': 'man', 'frieza-soldier': 'man', 'rogue-ninja': 'man', 'skiff-guard': 'man',
  hollow: 'demon', 'hollow-cero': 'demon', 'white-zetsu': 'beast', gamorrean: 'beast',
  pacifista: 'brute', 'gifter-brute': 'brute', menos: 'brute', 'apostle-spawn': 'brute',
  saibaman: 'imp', 'cell-jr': 'imp',
};
export const PITCH: Record<string, number> = {
  pacifista: .72, 'gifter-brute': .82, menos: .7, 'apostle-spawn': .66, gamorrean: .78, 'beast-pirate': .9, husk: .86, marine: .96, 'marine-rifle': 1.02,
  'white-zetsu': 1.12, saibaman: 1.18, 'cell-jr': 1.25, hollow: .95, 'hollow-cero': 1.02,
};

for (const [kind, body] of Object.entries(WEARS)) { VOICE_OF[kind] ??= VOICE_OF[body]; PITCH[kind] ??= PITCH[body] ?? 1; }

export const LINES: Record<Voice, { swing: Family; cry: Family; hurt: Family; die: Family }> = {
  man: { swing: 'man-swing', cry: 'man-cry', hurt: 'man-hurt', die: 'man-die' },
  beast: { swing: 'beast-swing', cry: 'beast-roar', hurt: 'beast-hurt', die: 'beast-die' },
  brute: { swing: 'brute-roar', cry: 'demon-roar', hurt: 'beast-hurt', die: 'beast-die' },
  imp: { swing: 'imp', cry: 'imp', hurt: 'imp', die: 'beast-die' },
  zombie: { swing: 'zombie-swing', cry: 'zombie-cry', hurt: 'zombie-hurt', die: 'zombie-die' },
  demon: { swing: 'beast-swing', cry: 'demon-roar', hurt: 'beast-hurt', die: 'beast-die' },
};

const RATE: Partial<Record<Family, number>> = { gore: 5 };
const heard = new Map<Family, number[]>();
export const SILENCE = '/assets/audio/survival/silence.m4a';

export const take = (family: Family, random = Math.random) => {
  const limit = RATE[family];
  if (limit !== undefined && typeof performance === 'object') {
    const now = performance.now() / 1000, times = heard.get(family) ?? [];
    while (times.length && now - times[0] > 1) times.shift();
    if (times.length >= limit) return SILENCE;
    times.push(now); heard.set(family, times);
  }
  return `/assets/audio/survival/${family}-${1 + Math.floor(random() * BANK[family])}.m4a`;
};
export const everyTake = () => [SILENCE, ...(Object.keys(BANK) as Family[]).flatMap(family => Array.from({ length: BANK[family] }, (_, i) => `/assets/audio/survival/${family}-${i + 1}.m4a`))];
