import type { RoomLobby } from '../../game/types';
import type { DuelView } from '../../game/duel/DuelSet';

export interface PrivatePanel {
  hidden: boolean;
  party: boolean;
  label: string;
  startHidden: boolean;
  startLabel: string;
  hint: string;
}
export function privatePanel(lobby: RoomLobby | undefined, status: string, serverTime: number, selfId: string,
  room: { coop: boolean; players: number; duel?: Pick<DuelView, 'phase'> }): PrivatePanel {
  const isPrivate = lobby?.visibility === 'private', waiting = status === 'waiting', party = !!lobby?.party;
  const host = !!lobby && lobby.hostId === selfId, between = !!room.duel && room.duel.phase === 'interval';
  const hidden = !isPrivate || !waiting || party && between;
  const label = party ? (lobby?.duel ? 'PARTY DUEL' : room.coop ? 'PARTY RUN' : 'PARTY MATCH') : lobby?.duel ? 'DUEL ROOM' : room.coop ? 'CO-OP ROOM' : 'PRIVATE ROOM';
  const startLabel = room.coop ? 'START RUN' : 'START FIGHT';
  const startHidden = !waiting || !host || party && !!lobby?.autoStart;
  const starting = lobby && lobby.startsAt !== null ? `STARTING IN ${Math.max(0, Math.ceil(lobby.startsAt - serverTime))}s` : '';
  let hint = 'INVITE CODE';
  if (waiting && lobby) {
    if (starting) hint = starting;
    else if (party) hint = lobby.autoStart ? 'STARTS BY ITSELF ONCE EVERYONE IS IN' : host ? (lobby.canStart ? 'START WHEN YOU ARE READY' : 'WAITING FOR THE PARTY') : 'WAITING FOR THE HOST';
    else hint = host ? (lobby.canStart ? (room.coop ? (room.players > 1 ? `PARTY OF ${room.players} · READY` : 'START ALONE, OR WAIT FOR FRIENDS') : 'YOUR ROOM · READY TO START') : 'WAITING FOR A FRIEND') : 'WAITING FOR HOST';
  }
  return { hidden, party, label, startHidden, startLabel, hint };
}
