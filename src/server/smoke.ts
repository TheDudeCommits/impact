import { ROSTER_PROTOCOL } from '../game/rosterProtocol';
import { Client } from '@colyseus/sdk';
import type { GameSnapshot } from '../game/types';
import { COMBO_HP } from '../game/moves';

const endpoint = process.env.ARENA_SERVER ?? 'ws://localhost:2567';
const client = new Client(endpoint);
const rooms: Awaited<ReturnType<Client['joinOrCreate']>>[] = [];
const received = new Map<string, GameSnapshot>();
let snapshots = 0;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (let index = 0; index < 12; index++) {
    const room = await client.joinOrCreate('arena', {rosterProtocol:ROSTER_PROTOCOL, mode: 'match', fighter: index % 2 ? 'naruto' : 'goku', name: `Transport ${index + 1}` });
    room.onMessage('welcome', () => {});
    room.onMessage('notice', () => {});
    room.onMessage('input-rejected', () => {});
    room.onMessage('snapshot', (snapshot: GameSnapshot) => { received.set(room.sessionId, snapshot); snapshots++; });
    rooms.push(room);
  }
  await delay(250);
  const roomIds = new Set(rooms.map(r => r.roomId));
  if (roomIds.size !== 1) throw new Error(`Expected one match room, got ${roomIds.size}`);
  const before = received.get(rooms[0].sessionId)!;
  const actorBefore = before.players.find(p => p.id === rooms[0].sessionId)!;
  for (let seq = 0; seq < 12; seq++) {
    rooms[0].send('input', { seq, moveX: 1, moveZ: 0, yaw: Math.PI / 2, hp: 0, damage: 9999 });
    await delay(50);
  }
  await delay(100);
  const after = received.get(rooms[1].sessionId)!;
  const actorAfter = after.players.find(p => p.id === rooms[0].sessionId)!;
  if (after.players.length !== 12 || after.players.some(p => p.isBot)) throw new Error('Expected twelve clients and no bots');
  if (after.status !== 'active') throw new Error('Full room did not start');
  if (actorAfter.x <= actorBefore.x + 2) throw new Error('Observer did not receive authoritative movement');
  if (actorAfter.hp !== COMBO_HP) throw new Error('Invalid client hp affected state');
  console.log(JSON.stringify({ pass: true, check: 'automated-12-websocket-clients', roomId: rooms[0].roomId,
    connectedClients: rooms.length, botCount: 0, snapshots, simulationTicks: after.tick - before.tick,
    movementObservedByAnotherClient: actorAfter.x - actorBefore.x,
    note: 'Local automated transport test; not human or internet latency acceptance' }, null, 2));
} finally {
  await Promise.all(rooms.map(room => room.leave()));
}
