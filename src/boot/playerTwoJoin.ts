import { joinHash, playerTwo } from './playerTwo';

const WAIT = 3000;
const write = (hash: string) => history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
if (typeof window === 'object' && (globalThis as { PlayerTwo?: unknown }).PlayerTwo && location.hash.length <= 1) {
  const loaded = performance.now(), found = playerTwo().then(p2 => joinHash(p2?.params));
  const hash = await Promise.race([found, new Promise<null>(done => setTimeout(() => done(null), WAIT))]);
  if (hash) write(hash);
  else if (hash === null) void found.then(late => {
    if (late && location.hash.length <= 1 && performance.now() - loaded < 60_000 && !document.querySelector('.combat-hud:not(.hidden)')) { write(late); location.reload(); }
  });
}
