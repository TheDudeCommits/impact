import ALIASES from '../game/data/skeletonAliases.json';

const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const PREFIXES = ['mixamorig1:', 'mixamorig:', 'mixamorig1', 'mixamorig', 'armature|', 'bip01 ', 'bip001 '];

function loose(name: string) {
  let out = name.toLowerCase();
  for (const prefix of PREFIXES) if (out.startsWith(prefix)) { out = out.slice(prefix.length); break; }
  for (;;) {
    const match = out.match(/^(.*)[_.](\d+)$/);
    if (!match) break;
    out = match[1];
  }
  return key(out);
}

export type Canonical = keyof typeof ALIASES;

export function resolveSkeleton(names: Iterable<string>): Map<string, string> {
  const have = new Map<string, string>(), byLoose = new Map<string, string[]>();
  for (const name of names) {
    if (!have.has(key(name))) have.set(key(name), name);
    const l = loose(name);
    byLoose.set(l, [...(byLoose.get(l) ?? []), name]);
  }
  const found = new Map<string, string>(), taken = new Set<string>();
  const claim = (canonical: string, actual: string) => { found.set(canonical, actual); taken.add(actual); };
  const table = ALIASES as Record<string, string[]>;
  for (const canonical of Object.keys(table)) {
    const actual = have.get(key(canonical));
    if (actual !== undefined) claim(canonical, actual);
  }
  for (const [canonical, spellings] of Object.entries(table)) {
    if (found.has(canonical)) continue;
    for (const spelling of spellings) {
      const actual = have.get(key(spelling));
      if (actual !== undefined && !taken.has(actual)) { claim(canonical, actual); break; }
    }
  }
  for (const [canonical, spellings] of Object.entries(table)) {
    if (found.has(canonical)) continue;
    for (const spelling of [canonical, ...spellings]) {
      const options = (byLoose.get(loose(spelling)) ?? []).filter(n => !taken.has(n));
      if (options.length === 1) { claim(canonical, options[0]); break; }
    }
  }
  return found;
}
