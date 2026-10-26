import type { FighterId } from '../game/types';
import { FIGHTERS } from '../config';

export type HomeRosterWing = 'heroes' | 'rivals';
export interface HomeRosterPage {
  left: FighterId[]; right: FighterId[];
  fighters: FighterId[];
}
export interface HomeAnimeOption { id: string; label: string; count: number }
export const HOME_PAGE_CAPACITY = 16;
export const HOME_PAGE_ROWS = 2;
export const HOME_ORIGINAL_FIGHTERS = [
  'goku','naruto','luffy','zoro','sanji','vegeta','kakashi','sasuke',
  'jotaro','ichigo','ace','law','gojo','dio','guts','killua',
] as const satisfies readonly FighterId[];
export const HOME_BASELINE_FIGHTERS = [
  'goku','naruto','luffy','zoro','sanji','vegeta','kakashi',
  'sasuke','jotaro','ichigo','ace','law','gojo','dio',
  'guts','killua','kaido','whitebeard','shanks','roger','aizen',
  'sukuna','griffith','meruem','goku-black','jiren','golden-frieza','gohan-beast',
  'saitama','akaza','itachi','madara','tanjiro','levi','sung-jinwoo',
  'gon',
] as const satisfies readonly FighterId[];
export const HOME_EXPANSION_FIGHTERS = [
  'toji',
  'crocodile',
  'usopp',
  'denji','makima','deku','all-might','bakugo','todoroki','endeavor',
  'edward-elric','broly','pain','might-guy','minato','jiraiya','sakura',
  'hinata','tsunade','doflamingo','blackbeard','mihawk','boa-hancock','aokiji',
  'akainu','nami','nico-robin','yuji','nanami','yuta','yoruichi',
  'kenpachi','yamamoto','grimmjow','byakuya','rukia','hisoka','netero',
  'mikasa','eren','gintoki','hiei','akame','esdeath','asuka',
  'shinji','jolyne','josuke','ken-kaneki','escanor','meliodas',
  'yamato','jinbe','enel','kizaru','alphonse-elric','tatsumaki',
  'garou','kaiju-no-8','rengoku',
] as const satisfies readonly FighterId[];
export const HOME_HERO_ORDER = [
  'goku','luffy','naruto','ichigo','gojo','gohan-beast','zoro',
  'kakashi','rukia','yuji','saitama','sanji','minato','yoruichi',
  'yuta','deku','all-might','bakugo','todoroki','tanjiro','rengoku','ace',
  'shanks','roger','whitebeard','nami','usopp','nico-robin','jinbe','yamato',
  'sung-jinwoo','denji','jiraiya','might-guy','tsunade','sakura','hinata',
  'jotaro','josuke','jolyne','levi','mikasa','yamamoto','nanami',
  'gon','netero','tatsumaki','edward-elric','alphonse-elric','meliodas','escanor',
  'gintoki','akame','asuka','shinji','kaiju-no-8',
] as const satisfies readonly FighterId[];
export const HOME_RIVAL_ORDER = [
  'vegeta','sasuke','sukuna','toji','golden-frieza','itachi','aizen','goku-black',
  'madara','grimmjow','broly','pain','dio','jiren','garou','hisoka',
  'griffith','kaido','blackbeard','doflamingo','crocodile','law','mihawk','boa-hancock',
  'akainu','aokiji','kizaru','enel','makima','eren','meruem',
  'killua','guts','hiei','kenpachi','byakuya','ken-kaneki','esdeath',
  'endeavor','akaza',
] as const satisfies readonly FighterId[];

export const HOME_GRADUATED_FIGHTERS: readonly (typeof HOME_EXPANSION_FIGHTERS)[number][] = ['nanami','jolyne','akame','yuta','denji','jiraiya','mikasa','broly','tsunade','sakura','makima','pain','nico-robin','kizaru','akainu','enel','kenpachi','yoruichi','gintoki','minato','all-might','bakugo','todoroki','endeavor','yuji','toji','blackbeard','mihawk','crocodile','netero','hiei','rukia','hinata','might-guy','nami','asuka','escanor','meliodas','alphonse-elric','hisoka','ken-kaneki','garou','kaiju-no-8','shinji','josuke','rengoku','usopp','byakuya','eren','doflamingo','deku','aokiji','esdeath','jinbe','yamato','grimmjow','yamamoto','tatsumaki'];

const wip: ReadonlySet<FighterId> = new Set(HOME_EXPANSION_FIGHTERS);
const rivals: ReadonlySet<FighterId> = new Set(HOME_RIVAL_ORDER);
const graduates: ReadonlySet<FighterId> = new Set(HOME_GRADUATED_FIGHTERS);
export function homeRosterWip(id: FighterId): boolean { return wip.has(id); }
export function homeWipStamp(id: FighterId, graduated: ReadonlySet<FighterId> = graduates): boolean { return wip.has(id) && !graduated.has(id); }
export function homeWing(id: FighterId): HomeRosterWing {
  return rivals.has(id) ? 'rivals' : 'heroes';
}

const SERIES_ALIASES: Readonly<Record<string, string>> = {
  'Dragon Ball Super': 'Dragon Ball',
  'Naruto Shippuden': 'Naruto',
  'Hunter x Hunter': 'Hunter × Hunter',
  'Hunter X Hunter': 'Hunter × Hunter',
  'Fullmetal Alchemist Brotherhood': 'Fullmetal Alchemist',
  'Fullmetal Alchemist: Brotherhood': 'Fullmetal Alchemist',
};
export function homeSeries(id: FighterId): string {
  const series = FIGHTERS[id].series;
  return SERIES_ALIASES[series] ?? series;
}
const ANIME_FAMILIARITY = [
  'Dragon Ball','Naruto','One Piece','Bleach','Jujutsu Kaisen','My Hero Academia',
  'Attack on Titan','Demon Slayer','Hunter × Hunter','JoJo’s Bizarre Adventure',
  'Chainsaw Man','One Punch Man','Pokémon','Fullmetal Alchemist','Neon Genesis Evangelion',
  'Kaiju No. 8','Tokyo Ghoul','Solo Leveling','Berserk','The Seven Deadly Sins','Yu Yu Hakusho','Akame ga Kill!','Gintama',
];
const familiarity = new Map(ANIME_FAMILIARITY.map((name, index) => [name, index]));
export function homeAnimeOptions(roster: readonly FighterId[]): HomeAnimeOption[] {
  const counts = new Map<string, number>();
  for (const id of new Set(roster)) {
    const series = homeSeries(id);
    counts.set(series, (counts.get(series) ?? 0) + 1);
  }
  return [...counts].sort(([a, ac], [b, bc]) => bc - ac
    || (familiarity.get(a) ?? Infinity) - (familiarity.get(b) ?? Infinity)
    || a.localeCompare(b)).map(([id, count]) => ({ id, count, label: `${id} (${count})` }));
}

function orderedWing(roster: readonly FighterId[], wing: HomeRosterWing): FighterId[] {
  const supplied = new Set(roster), order = wing === 'heroes' ? HOME_HERO_ORDER : HOME_RIVAL_ORDER;
  const result: FighterId[] = order.filter(id => supplied.has(id));
  const included = new Set(result);
  for (const id of supplied) if (!included.has(id) && homeWing(id) === wing) {
    result.push(id); included.add(id);
  }
  return result;
}
function arrangeWing(ids: FighterId[], right: boolean): FighterId[] {
  const inner = ids.filter(id => homeWing(id) === 'heroes');
  const outer = ids.filter(id => homeWing(id) === 'rivals');
  if (!inner.length || !outer.length) return ids;
  const result: FighterId[] = Array(ids.length);
  const columns = Array.from({ length: ids.length }, (_, i) => i)
    .sort((a,b) => a % 4 - b % 4 || a - b);
  const first = right ? inner : outer, rest = right ? outer : inner;
  first.forEach((id,i) => { result[columns[i]] = id; });
  let next = 0;
  for (let i = 0; i < result.length; i++) if (!result[i]) result[i] = rest[next++];
  return result;
}

export function homeRosterPages(roster: readonly FighterId[]): HomeRosterPage[] {
  const pages: HomeRosterPage[] = [];
  const supplied = new Set(roster);
  const add = (pool: readonly FighterId[]) => {
    const heroes = orderedWing(pool, 'heroes'), opponents = orderedWing(pool, 'rivals');
    while (heroes.length || opponents.length) {
      const count = Math.min(HOME_PAGE_CAPACITY, heroes.length + opponents.length);
      const leftCount = Math.ceil(count / 2), rightCount = count - leftCount;
      const left = heroes.splice(0, leftCount);
      const right = opponents.splice(0, rightCount);
      if (left.length < leftCount) left.push(...opponents.splice(0, leftCount - left.length));
      if (right.length < rightCount) right.unshift(...heroes.splice(0, rightCount - right.length));
      const leftWing = arrangeWing(left, false), rightWing = arrangeWing(right, true);
      pages.push({ left: leftWing, right: rightWing, fighters: [...leftWing, ...rightWing] });
    }
  };
  if (HOME_ORIGINAL_FIGHTERS.every(id => supplied.has(id))) {
    add(HOME_ORIGINAL_FIGHTERS);
    HOME_ORIGINAL_FIGHTERS.forEach(id => supplied.delete(id));
  }
  add([...supplied]);
  return pages;
}
