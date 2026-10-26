import { FIGHTERS } from '../../config';
import { MOVES } from '../../game/moves';
import type { FighterId } from '../../game/types';
import { FIGHTER_IDS } from '../sim/registry';
import { needOf, rank } from './matcher';

export const AREA_LOOKS_FILE = 'src/engine/sim/areaLooks.json';
const KEEP = 3;
const AUTHORED: Readonly<Partial<Record<FighterId, readonly string[]>>> = {
  'kaiju-no-8': ['titan_magmafist'],
  garou: ['breath_wind'],
  rengoku: ['wildfire'],
  crocodile: ['undertow'],
  usopp: ['bloomburst'],
  toji: ['blade_iaido'],
};

export function vendoredCasts(manifest: string): Map<string, 'line' | 'zone'> {
  const out = new Map<string, 'line' | 'zone'>();
  for (const [, id, cast] of manifest.matchAll(/\{ id: '([^']+)', label: '(?:[^'\\]|\\.)*', school: '[^']*', settings: '[^']*', cast: '(line|zone)'/g)) out.set(id, cast as 'line' | 'zone');
  return out;
}

export function areaLooks(manifest: string): Record<string, string[]> {
  const vendored = vendoredCasts(manifest), out: Record<string, string[]> = {};
  for (const id of FIGHTER_IDS) {
    const series = (FIGHTERS as Record<string, { series?: string }>)[id]?.series;
    const ranked = rank(needOf(id as FighterId, 'area', MOVES[id].area, series), { limit: 60 });
    const preferred = (AUTHORED[id] ?? []).filter(effect => vendored.get(effect) === 'zone');
    const inferred = ranked.filter(m => vendored.get(m.effect.id) === 'zone').map(m => m.effect.id);
    out[id] = [...new Set([...preferred, ...inferred])].slice(0, KEEP);
  }
  return out;
}
