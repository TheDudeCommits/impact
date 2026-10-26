export {};
const workers = Number(process.env.ROOM_WORKERS ?? 0);
if (!process.env.CLUSTER_ROLE && Number.isInteger(workers) && workers >= 1 && workers <= 32) {
  const { Primary } = await import('./cluster/primary');
  const port = Number(process.env.PORT ?? 2567), basePort = Number(process.env.CLUSTER_BASE_PORT ?? 9300);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
  await new Primary({ port, roomWorkers: workers, basePort }).start();
} else {
  if (process.env.ROOM_WORKERS && !(Number.isInteger(workers) && workers >= 0 && workers <= 32)) console.warn(`[cluster] ROOM_WORKERS="${process.env.ROOM_WORKERS}" is not a whole number from 0 to 32: one process`);
  await import('./index.ts');
}
