import type { SigElement } from './signatures';

export type RelicTrigger = 'crowded' | 'combo' | 'special' | 'dash' | 'foresight' | 'heavy' | 'ultimate' | 'awakening';

export interface RelicDefinition {
  id: string;
  name: string;
  kanji: string;
  element: SigElement;
  trigger: RelicTrigger;
  gap: number;
  text: string;
}

export const RELIC_SLOTS = 3;

export const RELICS: readonly RelicDefinition[] = [
  { id: 'jabra', name: 'WOLF HOWL', kanji: '遠吠', element: 'sound', trigger: 'crowded', gap: 7,
    text: 'When the crowd closes in, you howl: a ring of sound rolls out 9 metres and throws them all down.' },
  { id: 'grimmjow', name: 'DESGARRÓN', kanji: '豹爪', element: 'ki', trigger: 'combo', gap: 2,
    text: 'Every 8th hit of a combo tears five claws of light across the ground ahead of you.' },
  { id: 'hollow-ichigo', name: 'GETSUGA TENSHŌ', kanji: '月牙', element: 'blood', trigger: 'special', gap: 4,
    text: 'Your specials loose a black Getsuga: it tears 16 metres on toward what they struck.' },
  { id: 'lucci', name: 'ROKUŌGAN', kanji: '六王銃', element: 'sound', trigger: 'dash', gap: 3.5,
    text: 'Your dash ends in a Rokuōgan: the shock goes on through everything 7 metres ahead.' },
  { id: 'katakuri', name: 'FUTURE SIGHT', kanji: '未来視', element: 'steel', trigger: 'foresight', gap: 8,
    text: 'Every 8 seconds the next blow at you is seen coming: it misses, and a mochi thrust answers it. A just guard answers too.' },
  { id: 'aokiji', name: 'ICE AGE', kanji: '氷河時代', element: 'ice', trigger: 'special', gap: 5,
    text: 'Your specials freeze the ground they hit: everything within 4.5 metres is frozen solid.' },
  { id: 'akainu', name: 'MAGMA FIST', kanji: '大噴火', element: 'magma', trigger: 'heavy', gap: 1.1,
    text: 'Your heavy blows leave magma where they land: it burns whatever stands in it for 4 seconds.' },
  { id: 'dio', name: 'THE WORLD', kanji: '世界', element: 'light', trigger: 'ultimate', gap: 0,
    text: 'Your ultimate stops time: for 2 seconds nothing moves but you.' },
  { id: 'whitebeard', name: 'QUAKE', kanji: '震震', element: 'sound', trigger: 'heavy', gap: 5,
    text: 'A heavy blow cracks the air: the ground splits six ways from where it landed.' },
  { id: 'sukuna', name: 'MALEVOLENT SHRINE', kanji: '領域展開', element: 'blood', trigger: 'awakening', gap: 0,
    text: 'Awakened, you open your domain: everything within 7 metres is cut, again and again, until it closes.' },
];

export const relicOf = (id: string | undefined) => RELICS.find(relic => relic.id === id);

export const RELIC_LEAVE = 'relic-leave';
export const RELIC_GIVE = 'relic-give:';
export const giveCard = (held: string) => `${RELIC_GIVE}${held}`;
export const givenOf = (card: string | undefined) => card?.startsWith(RELIC_GIVE) ? card.slice(RELIC_GIVE.length) : undefined;
export const isRelicCard = (card: string | undefined) => card === RELIC_LEAVE || !!givenOf(card);

export const relicScale = (level: number) => 1 + Math.max(0, level - 1) * .07;
