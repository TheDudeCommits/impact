import type { FighterId } from '../../game/types';
import type { ArtOverride, PackDefinition, PackMode } from './pack';

let active: PackDefinition | undefined;

export function setActivePack(pack: PackDefinition | undefined) { active = pack; }
export const activePack = () => active;
export const activePackRoster = (): readonly FighterId[] | undefined => active ? (Object.keys(active.slots) as FighterId[]).filter(id => !!active!.slots[id]) : undefined;
export const packHas = (id: string | undefined) => !!active && !!id && !!active.slots[id as FighterId];
export const packArt = (id: string | undefined, kind: keyof ArtOverride): string | undefined => active && id ? active.slots[id as FighterId]?.art?.[kind] : undefined;
export const packQuiets = (id: string | undefined) => !!active && !!id && !!active.slots[id as FighterId]?.quiet;

export function startMode(mode: string, access?: { kind: string; objective?: string; travel?: { mode?: string } }): PackMode | undefined {
  if (!access || access.kind === 'public') return mode === 'training' ? 'training' : 'royale';
  switch (access.kind) {
    case 'duel': return 'duel';
    case 'bots': return 'royale';
    case 'survival': case 'coop-create': case 'coop-join': return 'arcade';
    case 'objective': return access.objective === 'bad-blood' ? 'bad-blood' : 'last-stand';
    case 'rift-war': return 'rift-war';
    case 'party': return (access.travel?.mode as PackMode | undefined) ?? undefined;
    default: return undefined;
  }
}
export function packRefuses(mode: string, access?: { kind: string; objective?: string; travel?: { mode?: string } }): string | undefined {
  if (!active?.modes) return undefined;
  const wanted = startMode(mode, access);
  if (wanted && active.modes.includes(wanted)) return undefined;
  const plays = active.modes.map(each => each.replace(/-/g, ' ').toUpperCase()).join(', ');
  return `The ${active.name} pack plays ${plays} in this build. Pick ${active.modes.includes('training') ? 'TRAINING GROUND' : plays} to fight with it.`;
}
