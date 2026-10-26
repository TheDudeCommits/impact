import type * as THREE from 'three';
import type { FighterId, PlayerState } from '../../../game/types';
import { MOVES } from '../../../game/moves';
import { AWAKENED_MOVES } from '../../../game/awakening';
import { forgedMoves } from '../../../engine/sim/forgedKits';
import { presentationKit } from '../../../engine/client/forgeLive';
import areaLooks from '../../../engine/sim/areaLooks.json';
import { MOVE_SLOTS } from './fxLookup';
import { forgeFxDirector } from './forgeFx';
import { ARMORY_CASTINGS } from './vendor/castings';
import { armoryRollout } from './rollout';
import { splitSettings } from './macros';
import type { ForgeFx } from '../../../engine/sim/forge';
import type { KitValues } from './fxStage';

type RoomPlayer = Pick<PlayerState, 'fighter'> & Partial<Pick<PlayerState, 'forge' | 'enemy'>>;
const LOOKS = areaLooks as Readonly<Record<string, readonly string[]>>;

export function playerFx(player: RoomPlayer): string[] {
  const out = new Set<string>();
  const kit = presentationKit(player);
  if (kit) {
    for (const slot of MOVE_SLOTS) { const effect = kit.slots[slot as keyof typeof kit.slots]?.fx?.effect; if (effect) out.add(effect); }
    if (kit.aura?.effect) out.add(kit.aura.effect);
  }
  const move = forgedMoves(player.forge)?.area ?? MOVES[player.fighter as FighterId]?.area;
  const look = move?.area?.fx ?? LOOKS[player.fighter]?.[0];
  if (look) out.add(look);
  const awake = AWAKENED_MOVES[player.fighter as FighterId]?.area?.area?.fx;
  if (awake) out.add(awake);
  return [...out];
}

export function castingFx(fighter: string, rollout: ReadonlySet<string> = armoryRollout()): string[] {
  if (!rollout.has(fighter)) return [];
  const slots = ARMORY_CASTINGS[fighter]?.slots;
  if (!slots) return [];
  const out = new Set<string>();
  for (const [slot, cast] of Object.entries(slots)) {
    if (!cast?.pick || cast.pick.includes('/')) continue;
    if (slot === 'body' && (cast as { when?: string }).when === 'never') continue;
    out.add(cast.pick);
  }
  return [...out];
}

export function roomFxValues(players: readonly RoomPlayer[]): Map<string, KitValues[]> {
  const out = new Map<string, KitValues[]>(), seen = new Set<string>();
  const add = (fx: ForgeFx | undefined) => {
    if (!fx?.effect || !fx.settings) return;
    const values = splitSettings(fx.settings), key = fx.effect + JSON.stringify(values);
    if (seen.has(key) || (!Object.keys(values.own).length && !Object.keys(values.macros).length)) return;
    seen.add(key); out.set(fx.effect, [...(out.get(fx.effect) ?? []), values]);
  };
  for (const player of players) {
    if (player.enemy) continue;
    const kit = presentationKit(player);
    if (!kit) continue;
    for (const slot of MOVE_SLOTS) add(kit.slots[slot as keyof typeof kit.slots]?.fx);
    add(kit.aura);
  }
  return out;
}

export function roomFxIds(players: readonly RoomPlayer[]): string[] {
  const out = new Set<string>();
  for (const player of players) if (!player.enemy) for (const id of playerFx(player)) out.add(id);
  return [...out];
}

export function roomChunkIds(players: readonly RoomPlayer[], rollout: ReadonlySet<string> = armoryRollout()): string[] {
  const out = new Set<string>(roomFxIds(players));
  for (const player of players) if (!player.enemy) for (const id of castingFx(player.fighter, rollout)) out.add(id);
  return [...out];
}

export function warmRoomFx(players: readonly RoomPlayer[], opts: { cap?: number; between?: () => Promise<unknown>; current?: () => boolean } = {}): Promise<void> {
  const director = forgeFxDirector();
  const ids = roomFxIds(players);
  return director && ids.length ? director.warm(ids, { ...opts, variants: roomFxValues(players) }) : Promise.resolve();
}

export const warmRoots = (): THREE.Object3D[] => forgeFxDirector()?.roots() ?? [];

export const warmEffekseer = (renderer: THREE.WebGLRenderer, camera: THREE.Camera, cap?: number): Promise<void> => forgeFxDirector()?.effekseer(renderer, camera, cap) ?? Promise.resolve();
export const prefetchEffekseer = (renderer?: THREE.WebGLRenderer, camera?: THREE.Camera): void => forgeFxDirector()?.prefetchEffekseer(renderer, camera);
