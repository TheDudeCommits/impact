import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CombatEvent, PlayerState } from '../src/game/types';
import type { Fighter } from '../src/render/Fighter';
import { NamiWeather } from '../src/render/signature/NamiWeather';
import { VfxKit } from '../src/render/vfx/VfxKit';

const body = (id: string, fighter: PlayerState['fighter']) => ({
  state: { id, fighter, alive: true, action: 'ultimate', actionSeq: 1,
    actionStarted: 0, actionTime: .3, actionDuration: 2.75 } as PlayerState,
  group: new THREE.Group(),
  chargePosition(out: THREE.Vector3) { return out.set(0, 1.3, .3); },
}) as unknown as Fighter;
const cast: CombatEvent = { id: 1, kind: 'cast', serverTime: 0, actorId: 'a',
  fighter: 'nami', slot: 'ultimate', actionSeq: 1, endpoint: { x: 0, y: 1, z: 3 } };
function fixture() {
  const scene = new THREE.Scene(), kit = VfxKit.for(scene), weather = new NamiWeather(scene, kit);
  const actor = body('a', 'nami'), target = body('b', 'goku'); target.group.position.set(0, 0, 3);
  const fighters = new Map([['a', actor], ['b', target]]);
  const clouds = () => scene.children.filter(o => o.name === 'nami-weather-cloud' && o.visible);
  return { scene, weather, actor, target, fighters, clouds,
    update: (time = 1) => weather.update(time, fighters, new Map()),
    dispose: () => { weather.dispose(); kit.release(); } };
}
afterEach(() => vi.restoreAllMocks());

describe('Nami weather presentation lifecycle', () => {
  it('loads its one shared atlas only for a room containing Nami', async () => {
    const load = vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockResolvedValue(new THREE.Texture());
    const f = fixture();
    try {
      await f.weather.load(['goku']); expect(load).not.toHaveBeenCalled();
      await Promise.all([f.weather.load(['nami']), f.weather.load(['nami'])]); expect(load).toHaveBeenCalledTimes(1);
      f.weather.handle(cast, f.fighters); f.update(); expect(f.clouds()).toHaveLength(1);
    } finally { f.dispose(); }
  });

  it('tracks the confirmed target and clears a canceled or whiffed cast', async () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockResolvedValue(new THREE.Texture());
    const f = fixture();
    try {
      await f.weather.load(['nami']); f.weather.handle(cast, f.fighters);
      f.weather.handle({ ...cast, kind: 'confirm', targetId: 'b' }, f.fighters);
      f.target.group.position.set(2, .7, 4); f.update();
      expect(f.clouds()[0].position.x).toBe(2); expect(f.clouds()[0].position.z).toBe(4);
      expect(f.clouds()[0].position.y).toBeCloseTo(3.5);
      f.actor.state.actionSeq = 2; f.update(); expect(f.clouds()).toHaveLength(0);
      f.actor.state.actionSeq = 1; f.weather.handle(cast, f.fighters);
      f.actor.state.whiffedAt = .4; f.update(); expect(f.clouds()).toHaveLength(0);
    } finally { f.dispose(); }
  });

  it('repeated casts reuse the same scene resources and reset leaves no weather', async () => {
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockResolvedValue(new THREE.Texture());
    const f = fixture();
    try {
      await f.weather.load(['nami']); const resources = f.scene.children.slice();
      for (let i = 0; i < 100; i++) { f.weather.handle({ ...cast, id: i }, f.fighters); f.update(i / 60); }
      expect(f.scene.children).toEqual(resources);
      expect(f.clouds().length).toBeLessThanOrEqual(8);
      f.weather.reset(); expect(f.clouds()).toHaveLength(0);
      f.actor.state.action = 'idle'; f.update(); expect(f.clouds()).toHaveLength(0);
    } finally { f.dispose(); }
  });

  it('disposes a late texture instead of reviving a closed renderer', async () => {
    let finish!: (texture: THREE.Texture<HTMLImageElement>) => void;
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const f = fixture(), texture = new THREE.Texture<HTMLImageElement>(), dispose = vi.spyOn(texture, 'dispose');
    const loading = f.weather.load(['nami']); f.dispose(); finish(texture); await loading;
    expect(dispose).toHaveBeenCalledOnce();
    expect(f.scene.children.some(o => o.name === 'nami-weather-cloud')).toBe(false);
  });
});
