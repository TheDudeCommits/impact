import { ROSTER_PROTOCOL } from '../game/rosterProtocol';
import {SURVIVAL_PROTOCOL} from '../survival/coopNet';
import {RIFT_PROTOCOL,RIFT_RULES} from '../game/moba/model';
import {OBJECTIVE_PROTOCOL} from '../game/objectives/model';
import { LIGHT_CHASE_WINDOW, MOVES, RUSH, RUSH_STAGES, RUSH_WINDOW, SIMULATION_HZ, SNAPSHOT_HZ } from '../game/moves';
import type { FighterId } from '../game/types';
import { errorCounts } from './ops/errorCounts';

export const MOVEMENT_PROTOCOL = 'omni-sequenced-input-v76-duel-seats';

const timing = (move: { duration: number; contacts: number[] }) => ({ duration: move.duration, contacts: move.contacts });

export function healthReport(revision = process.env.BUILD_REVISION ?? 'local') {
  return {
    rosterProtocol:ROSTER_PROTOCOL,
    riftWar:true,riftProtocol:RIFT_PROTOCOL,riftSnapshotHz:RIFT_RULES.snapshotHz,
    survivalProtocol:SURVIVAL_PROTOCOL, duel:true, duelProtocol:1, objectiveModes: ['bad-blood','last-stand'], objectiveProtocol: OBJECTIVE_PROTOCOL, partyProtocol:1, customRooms:true, assetGate:true,
    ok: true, game: 'anime-arena-royale', movementProtocol: MOVEMENT_PROTOCOL, revision, room: 'arena',
    errors: errorCounts(),
    simulationHz: SIMULATION_HZ, snapshotHz: SNAPSHOT_HZ, rushStages: RUSH_STAGES, rushWindow: RUSH_WINDOW,
    lightChaseWindow: LIGHT_CHASE_WINDOW,
    combatTimings: Object.fromEntries((Object.keys(MOVES) as FighterId[]).map(fighter => [fighter, {
      ...Object.fromEntries(Object.entries(MOVES[fighter]).map(([slot, move]) => [slot, timing(move)])),
      rush: RUSH[fighter].map(timing),
    }])),
  };
}
