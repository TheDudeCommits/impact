import type { RoomMode } from '../game/types';
import type { NetworkAccess } from '../network';
import type { LoadingMode } from './LoadingScreen';

export function loadingModeFor(access: NetworkAccess | undefined, room: RoomMode, survivalRun = false): LoadingMode {
  if (access?.kind === 'rift-war') return 'rift-war';
  if (access?.kind === 'duel') return 'duel';
  if (survivalRun || access?.kind === 'survival' || access?.kind === 'coop-create' || access?.kind === 'coop-join') return 'arcade';
  if (access?.kind === 'objective') return access.objective;
  if (access?.kind === 'bots') return 'bots';
  if (access?.kind === 'create-private' || access?.kind === 'join-private') return 'private';
  if (access?.kind === 'party') return access.travel.mode === 'royale' ? 'party' : access.travel.mode === 'survival' ? 'arcade' : access.travel.mode;
  return room === 'training' ? 'training' : 'players';
}
