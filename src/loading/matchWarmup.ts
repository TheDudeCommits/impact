import type * as THREE from 'three';
import type { PlayerState } from '../game/types';
import { prefetchEffekseer, roomChunkIds, roomFxIds, warmEffekseer, warmRoomFx, warmRoots } from '../render/vfx/armory/roomFx';
import { loadGlyphs } from '../render/area/StampPainter';

type RoomPlayer = Pick<PlayerState, 'fighter'> & Partial<Pick<PlayerState, 'forge' | 'enemy'>>;

export const warmEnabled = () => { try { return typeof location !== 'object' || !/[?&]nowarm\b/.test(location.search); } catch { return true; } };

export const stamp = (name: string) => { try { performance.mark(`jump:${name}`); } catch { } };

export const nextFrame = () => new Promise<void>(resolve => {
  let done = false;
  const go = () => { if (!done) { done = true; resolve(); } };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
  setTimeout(go, 50);
});

export function prefetchRoomFx(players: readonly RoomPlayer[]) {
  try {
    if (!warmEnabled()) return;
    const ids = roomChunkIds(players);
    void loadGlyphs();
    if (!ids.length) return;
    void import('../render/vfx/armory/vendor/manifest').then(({ ARMORY_MANIFEST }) => {
      for (const id of ids) (ARMORY_MANIFEST as Record<string, { load(): Promise<unknown> } | undefined>)[id]?.load().catch(() => {});
    }, () => {});
  } catch (error) { console.warn('match warm-up: effects could not be fetched ahead', error); }
}

export const WARM_CAP = 10_000;

export function retainRoomEffects(players: readonly RoomPlayer[], effects: { retainEffects(keep: ReadonlySet<string>): string[] }): string[] {
  try { return warmEnabled() ? effects.retainEffects(new Set(roomFxIds(players))) : []; }
  catch (error) { console.warn('match warm-up: the effects of earlier rooms could not be let go', error); return []; }
}

export interface WarmOptions {
  current: () => boolean;
  cap?: number;
  areaFx?: { warmSeal(player: Pick<PlayerState, 'fighter' | 'forge'>): THREE.Texture };
  renderer?: { initTexture(texture: THREE.Texture): void };
  camera?: THREE.Camera;
  audio?: { ready(cap?: number): Promise<void> };
  soundCap?: number;
  soundLater?: { armory?: Promise<void> };
}

async function warmSeals(players: readonly RoomPlayer[], opts: WarmOptions) {
  const { areaFx, renderer } = opts;
  if (!areaFx) return;
  await loadGlyphs();
  let since = performance.now();
  for (const player of players) {
    if (!opts.current()) return;
    if (player.enemy) continue;
    try { const texture = areaFx.warmSeal(player); try { renderer?.initTexture(texture); } catch { } }
    catch (error) { console.warn('match warm-up: a seal could not be painted', error); }
    if (performance.now() - since > 8) { await nextFrame(); since = performance.now(); }
  }
}

const armorySound = (cap: number, current: () => boolean) => import('../render/vfx/armory/runtime').then(runtime => runtime.readySound(cap, current));

async function warmSound(opts: WarmOptions) {
  const cap = opts.soundCap ?? 3000;
  stamp('sound-wait');
  await Promise.all([opts.audio?.ready(cap), armorySound(cap, opts.current)]);
  stamp('sound');
}

export async function warmRoomSound(opts: Pick<WarmOptions, 'current' | 'audio' | 'soundCap'> & { armory?: Promise<void> }): Promise<void> {
  if (!warmEnabled()) return;
  const cap = opts.soundCap ?? 3000, until = performance.now() + cap;
  stamp('sound-wait');
  await Promise.all([opts.audio?.ready(cap).then(() => stamp('sound-bank')), (opts.armory ?? armorySound(cap, opts.current)).then(() => stamp('sound-armory'))]).catch(error => console.warn('match warm-up: sound could not be warmed', error));
  const left = until - performance.now();
  if (left > 50) await opts.audio?.ready(left).catch(() => {});
  stamp('sound');
}

export { warmEffekseer, warmRoots };

export async function warmRoomAssets(players: readonly RoomPlayer[], opts: WarmOptions): Promise<void> {
  if (!warmEnabled()) return;
  const note = (what: string) => (error: unknown) => console.warn(`match warm-up: ${what} could not be warmed`, error);
  let expired = false, timer: ReturnType<typeof setTimeout> | undefined;
  const live = { ...opts, current: () => !expired && opts.current() };
  const work = (async () => {
    try {
      await Promise.all([
        (async () => warmRoomFx(players, { between: nextFrame, current: live.current }))().catch(note('effects')),
        warmSeals(players, live).catch(note('seals')),
      ]);
      try { const renderer = live.renderer as Partial<THREE.WebGLRenderer> | undefined; prefetchEffekseer(typeof renderer?.getContext === 'function' ? renderer as THREE.WebGLRenderer : undefined, live.camera); } catch (error) { note('Effekseer')(error); }
      if (opts.soundLater) opts.soundLater.armory = armorySound(WARM_CAP, opts.current).catch(note('sound'));
      else await warmSound(live).catch(note('sound'));
    } catch (error) { note('the room')(error); }
  })();
  const limit = new Promise<void>(done => { timer = setTimeout(() => { expired = true; done(); }, opts.cap ?? WARM_CAP); });
  try { await Promise.race([work, limit]); }
  finally {
    clearTimeout(timer);
    if (expired) console.warn(`match warm-up: stopped after ${opts.cap ?? WARM_CAP} ms; what is left is built on first use`);
  }
}
