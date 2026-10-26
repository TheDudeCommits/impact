import type * as THREE from 'three';
import type { CombatEvent } from '../../../game/types';
import type { Fighter } from '../../Fighter';
import type { Flight } from '../../CombatEffects';
import type { VfxKit } from '../VfxKit';
import type { ForgeFx, ForgeKit } from '../../../engine/sim/forge';
import { ForgeSession } from '../../../engine/client/forgeSession';
import { ARMORY_RUNTIME } from './rollout';
import { setFxDrawn } from './drawn';
import { auraFx, eventFx, kitSlots } from './fxLookup';
import { activeKit, armoryRuntime, registerArmory, setActiveKit, type ArmoryEffectInfo } from '../../../engine/client/forgeLive';
import { ARMORY_EFFECTS } from './vendor/forgeCatalog';
import { ESSENTIALS } from './macros';
import type { KitValues } from './fxStage';


type Stage = import('./fxStage').FxStage;

let current: ForgeFxDirector | undefined;
export const forgeFxDirector = () => current;

export class ForgeFxDirector {
  private stage?: Stage;
  private loading?: Promise<Stage | undefined>;
  private disposed = false;
  private fighters?: ReadonlyMap<string, Fighter>;

  constructor(private readonly scene: THREE.Scene, private readonly kit: VfxKit) { if (ARMORY_RUNTIME) current = this; }

  load(): Promise<Stage | undefined> {
    if (!ARMORY_RUNTIME || this.disposed) return Promise.resolve(undefined);
    return this.loading ??= import('./fxStage').then(m => {
      if (this.disposed) return undefined;
      this.stage = new m.FxStage(this.scene, this.kit);
      return this.stage;
    }, error => { console.warn('armory: the Forge runtime could not load', error); this.loading = undefined; return undefined; });
  }

  covers(event: CombatEvent, fighters: ReadonlyMap<string, Fighter> | undefined = this.fighters): boolean {
    if (!this.stage || !event.slot) return false;
    const fx = eventFx(event, fighters ?? this.fighters);
    return !!fx && this.stage.ready(fx.effect);
  }

  handle(event: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) { this.stage?.handle(event, fighters ?? this.fighters); }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    this.fighters = fighters;
    if (!ARMORY_RUNTIME || this.disposed) return;
    const drawn: { player: string; key: string }[] = [];
    let wanted = false;
    for (const [player, f] of fighters) {
      for (const { key, fx } of kitSlots(f)) {
        wanted = true;
        if (this.stage?.ready(fx.effect)) drawn.push({ player, key });
        else if (this.stage && !this.stage.broken(fx.effect)) void this.stage.ensure(fx.effect);
      }
      if (auraFx(f)) wanted = true;
    }
    setFxDrawn(drawn);
    if (wanted && !this.stage) void this.load();
    this.stage?.update(time, fighters, flights);
  }

  retain(keep: ReadonlySet<string>): string[] { return this.stage ? this.stage.retain(keep) : []; }
  async effekseer(renderer: THREE.WebGLRenderer, camera: THREE.Camera, cap?: number) { await this.stage?.effekseer(renderer, camera, cap); }
  prefetchEffekseer(renderer?: THREE.WebGLRenderer, camera?: THREE.Camera) { this.stage?.prefetchEffekseer(renderer, camera); }
  roots(): THREE.Object3D[] { return this.stage ? this.stage.warmRoots() : []; }
  async prepare(id: string) { const stage = await this.load(); return stage ? stage.ensure(id) : false; }
  async warm(ids: Iterable<string>, opts: { cap?: number; between?: () => Promise<unknown>; current?: () => boolean; variants?: ReadonlyMap<string, readonly KitValues[]> } = {}) {
    const stage = await this.load();
    if (!stage) return;
    const wanted = [...new Set(ids)];
    await Promise.all(wanted.map(id => stage.ensure(id)));
    for (const id of wanted) {
      if (this.disposed || opts.current?.() === false) return;
      await stage.warm(id, opts.cap, opts.variants?.get(id));
      await opts.between?.();
    }
  }
  async zone(casterId: string, fx: ForgeFx, at: THREE.Vector3, radius: number, preroll = 0) { const stage = await this.load(); return stage ? stage.zone(casterId, fx, at, radius, preroll) : false; }
  get laidLooks(): Stage['laidLooks'] { return this.stage?.laidLooks ?? []; }
  async measure(id: string) { const stage = await this.load(); return stage ? stage.measure(id) : undefined; }
  async preview(playerId: string, fx: ForgeFx) { const stage = await this.load(); return stage ? stage.preview(playerId, fx) : false; }

  reset() { this.stage?.reset(); }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (current === this) current = undefined;
    this.stage?.dispose();
    setFxDrawn([]);
  }
}


const NATIVE: readonly ArmoryEffectInfo[] = [
  ['ice/crystal-field', 'Crystal field'], ['ice/lance', 'Ice lance'], ['ice/freeze', 'Freeze on hit'], ['ice/floor-freeze', 'Floor freeze'], ['ice/pheasant', 'Ice pheasant'],
].map(([id, label]) => ({ id, label: `ICE: ${label}`, school: 'ice', kit: 'ice', cast: 'line' as const, thumb: '', essentials: [] }));

let listed: readonly ArmoryEffectInfo[] | undefined;

registerArmory({
  effects: () => listed ??= [
    ...ARMORY_EFFECTS.map(e => ({ id: e.id, label: e.label, school: e.school, kit: e.kit, cast: e.cast, thumb: e.thumb ?? '', essentials: ESSENTIALS })),
    ...NATIVE,
  ],
  async prepare(id: string) {
    const director = forgeFxDirector();
    if (director) { await director.prepare(id); return; }
    const entry = (await import('./vendor/manifest')).ARMORY_MANIFEST[id];
    if (entry) await entry.load();
  },
  preview(playerId: string, fx: ForgeFx) { void forgeFxDirector()?.preview(playerId, fx); },
});

try {
  if (typeof location === 'object' && location && /[?&]area-strikes\b/.test(location.search))
    (window as unknown as { __areaStrikes?: unknown }).__areaStrikes = async (ids: readonly string[]) => {
      const out: Record<string, [number, number][] | null> = {};
      for (const id of ids) out[id] = (await forgeFxDirector()?.measure(id)) ?? null;
      return out;
    };
} catch { }

let smokeSession: ForgeSession | undefined;
try {
  if (typeof location === 'object' && location && /[?&]armory-smoke\b/.test(location.search))
    (window as unknown as { __armoryForge?: unknown }).__armoryForge = { runtime: armoryRuntime, setActiveKit, activeKit,
      applyKit: (kit: ForgeKit) => (smokeSession ??= new ForgeSession()).apply(kit) };
} catch { }
