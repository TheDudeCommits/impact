import {mountPublicRiftMatchmaker} from './moba/publicMatchmaker';
import {riftQueue} from './moba/queue';
import {RiftRoom} from './moba/RiftRoom';
import {PartyRoom} from './social/PartyRoom';
import { defineServer, defineRoom, WebSocketTransport, matchMaker } from 'colyseus';
import { ArenaRoom, BotArenaRoom, PrivateArenaRoom, DuelRoom, PrivateDuelRoom } from './ArenaRoom';
import { SurvivalRoom } from './SurvivalRoom';
import {ObjectiveRoom} from './objectives/ObjectiveRoom';
import { healthReport } from './health';
import { mountEconomy, roomName, sharedEconomy } from './economy/api';
import { netStats } from './netStats';
import { capacity } from './capacity';
import { clusterIndex, clusterLink, clusterRole } from './cluster/link';
import { LinkDriver, LinkPresence } from './cluster/shared';
import { LOAD_KEY, selectProcess, reportLoad, type Load } from './cluster/placement';
import { answerRoomEconomy, installRoomEconomy } from './cluster/economyLink';
import { mountErrorReports, recordServerError, serverErrors } from './ops/errorReports';
import type { ServerErrorEvent } from './ops/errorCounts';

let serving = false;
const stray = (kind: string) => (error: unknown) => {
  if (!serving) { console.error(`[server] ${kind} while starting:`, error); process.exit(1); }
  console.error(`[server] ${kind}; still serving:`, error);
  recordServerError(kind, error);
};
process.on('uncaughtException', stray('uncaught exception'));
process.on('unhandledRejection', stray('unhandled rejection'));

const transport = new WebSocketTransport({ perMessageDeflate: { zlibDeflateOptions: { level: 3 }, threshold: 512, concurrencyLimit: 10, clientNoContextTakeover: true } });
transport.server?.once('error', error => { if (!serving) { console.error('[server] could not listen:', error); process.exit(1); } });

const role = clusterRole(), link = clusterLink();
const presence = role && link ? new LinkPresence(link) : undefined;
if (role === 'rooms' && link) installRoomEconomy(link);
if (role === 'rooms' && link) serverErrors.sink = event => { void link.call('rpc', 'ops.serverError', [event]).catch(() => {}); };
if (role === 'control' && link) link.handle('ops.serverError', event => serverErrors.take(event as ServerErrorEvent));
let clusterView: { roomProcesses: number; up: number; rooms: number; busy: number[]; shedding: number } = { roomProcesses: Number(process.env.CLUSTER_SIZE) || 0, up: 0, rooms: 0, busy: [], shedding: 0 };
if (role === 'control' && presence) setInterval(() => void presence.hgetall(LOAD_KEY).then(all => {
  const loads = Object.values(all ?? {}).flatMap(raw => { try { const load = JSON.parse(raw) as Load; return load.role === 'rooms' && Date.now() - load.at < 10_000 ? [load] : []; } catch { return []; } }).sort((a, b) => a.index - b.index);
  clusterView = { roomProcesses: clusterView.roomProcesses, up: loads.length, rooms: loads.reduce((n, load) => n + load.rooms, 0), busy: loads.map(load => load.busy), shedding: loads.filter(load => load.shedding).length };
}, () => {}), 2000).unref();

export const server = defineServer({
  gracefullyShutdown: false,
  transport,
  ...(presence && link ? { presence, driver: new LinkDriver(link), selectProcessIdToCreateRoom: selectProcess(presence) } : {}),
  rooms: { rift_war:defineRoom(RiftRoom).filterBy(['access']), duel_arena:defineRoom(DuelRoom), private_duel:defineRoom(PrivateDuelRoom), party:defineRoom(PartyRoom), objective_arena: defineRoom(ObjectiveRoom).filterBy(['objective','access']), arena: defineRoom(ArenaRoom).filterBy(['mode']), private_arena: defineRoom(PrivateArenaRoom), bot_arena: defineRoom(BotArenaRoom), survival_arena: defineRoom(SurvivalRoom) },
  express(app) {
    mountPublicRiftMatchmaker(app as never);
    app.get('/rift-war/queue',async (_req:unknown,res:{setHeader(k:string,v:string):void;json(body:unknown):unknown;status(code:number):{json(body:unknown):unknown}})=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');try{res.json(await riftQueue());}catch{res.status(503).json([]);}});
    app.get('/health', (_req: unknown, res: { json(body: unknown): unknown }) => res.json(role === 'control' ? { ...healthReport(), cluster: clusterView } : healthReport()));
    if (role === 'rooms') return;
    mountEconomy(app as never, { dir: process.env.DATA_DIR ? `${process.env.DATA_DIR}/economy` : undefined, privyAppId: process.env.PRIVY_APP_ID,
      adminToken: process.env.ECONOMY_ADMIN_TOKEN });
    if (role === 'control' && link) answerRoomEconomy(link, sharedEconomy, roomName);
    mountErrorReports(app as never, { dir: process.env.DATA_DIR ? `${process.env.DATA_DIR}/economy` : undefined, adminToken: process.env.ECONOMY_ADMIN_TOKEN });
  },
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGUSR2'] as const) process.once(signal, () => void server.gracefullyShutdown(true));

const port = Number(process.env.PORT ?? 2567);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
await server.listen(port, role ? '127.0.0.1' : '0.0.0.0');
serving = true;
if (role && link && presence) {
  link.hello(role, clusterIndex(), matchMaker.processId, port);
  reportLoad(presence, matchMaker.processId, role, clusterIndex(), () => ({ tickMsTotal: netStats.tickMsTotal, shedding: capacity.shedding, rooms: capacity.rooms }));
}
netStats.census = () => ({ rooms: matchMaker.stats.local.roomCount, players: matchMaker.stats.local.ccu });
netStats.extra = () => capacity.report();
capacity.start(() => netStats.writtenOffTotal);
if (capacity.armed) console.log(`[capacity] valve on: ${capacity.roomCap > 0 ? `at most ${capacity.roomCap} match rooms` : 'no room cap'}; load shedding ${capacity.shed ? `on (refuse new rooms after ${capacity.gauge.behindSeconds} s behind, i.e. steps written off or an event-loop stall over ${capacity.gauge.lagMs} ms each second; let go after ${capacity.gauge.clearSeconds} calm s)` : 'off'}. Rooms already running are never touched.`);
netStats.start(undefined, role ? line => console.log(line.replace('[net]', `[net ${role === 'control' ? 'control' : `rooms ${clusterIndex()}`}]`)) : undefined);
console.log(role ? `[cluster] ${role}${role === 'rooms' ? ` ${clusterIndex()}` : ''} listening on 127.0.0.1:${port}` : `Arena server listening on http://localhost:${port} (training, match and co-op survival rooms)`);
