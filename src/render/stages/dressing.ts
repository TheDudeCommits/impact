import * as THREE from 'three';
import type { StageId } from '../../game/stages';
import { StageKit } from './StageKit';
import { StageAmbient } from './ambient';
import { PaintedSky, type PaintedSkyOptions } from './PaintedSky';

export interface StageDressing {
  update(time: number): void;
  dispose(): void;
}

export interface DressContext {
  stage: StageId;
  root: THREE.Group;
  model: THREE.Object3D;
  kit: StageKit;
  ambient: StageAmbient;
  sky(options?: PaintedSkyOptions & { url?: string }): Promise<PaintedSky>;
  texture(url: string, o?: { repeat?: number | [number, number]; srgb?: boolean; anisotropy?: number }): Promise<THREE.Texture>;
}

type Dresser = (context: DressContext) => Promise<void>;

const DRESSERS: Partial<Record<StageId, () => Promise<Dresser>>> = {
  'kami-lookout': () => import('./kamiLookout').then(m => m.dressKamiLookout),
  'valley-of-the-end': () => import('./valleyOfTheEnd').then(m => m.dressValleyOfTheEnd),
  'malevolent-shrine': () => import('./malevolentShrine').then(m => m.dressMalevolentShrine),
  shiganshina: () => import('./shiganshina').then(m => m.dressShiganshina),
  'chunin-final': () => import('./chuninFinal').then(m => m.dressChuninFinal),
  'enies-lobby': () => import('./eniesLobby').then(m => m.dressEniesLobby),
  'martial-arts-tournament': () => import('./martialArtsTournament').then(m => m.dressMartialArtsTournament),
  marineford: () => import('./marineford').then(m => m.dressMarineford),
  shibuya: () => import('./shibuya').then(m => m.dressShibuya),
  'infinity-castle': () => import('./infinityCastle').then(m => m.dressInfinityCastle),
  'pains-crater': () => import('./painsCrater').then(m => m.dressPainsCrater),
  'heavens-arena': () => import('./heavensArena').then(m => m.dressHeavensArena),
  'galactic-arena': () => import('./galacticArena').then(m => m.dressGalacticArena),
  'chunin-exam-room': () => import('./chuninExamRoom').then(m => m.dressChuninExamRoom),
  onigashima: () => import('./onigashima').then(m => m.dressOnigashima),
};

export function isDressed(stage: StageId) { return stage in DRESSERS; }

export async function dressStage(stage: StageId, root: THREE.Group, model: THREE.Object3D): Promise<StageDressing | undefined> {
  const load = DRESSERS[stage];
  if (!load || typeof document === 'undefined') return undefined;
  const kit = new StageKit(root, stage);
  const ambient = new StageAmbient(stage);
  const loader = new THREE.TextureLoader();
  const context: DressContext = {
    stage, root, model, kit, ambient,
    async sky(options = {}) {
      const sky = await PaintedSky.load(options.url ?? `/assets/environment/br/sky-${stage}.webp`, options);
      root.add(sky.mesh);
      ambient.onUpdate(time => sky.update(time));
      return sky;
    },
    async texture(url, o = {}) {
      const texture = await loader.loadAsync(url);
      if (o.repeat !== undefined) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        const [x, y] = typeof o.repeat === 'number' ? [o.repeat, o.repeat] : o.repeat;
        texture.repeat.set(x, y);
      }
      if (o.srgb !== false) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = o.anisotropy ?? 8;
      return texture;
    },
  };
  try {
    const dress = await load();
    await dress(context);
    ambient.finish();
    root.add(ambient.root);
    root.updateMatrixWorld(true);
    return {
      update: time => ambient.update(time),
      dispose: () => { ambient.dispose(); kit.dispose(); },
    };
  } catch (error) {
    console.warn(`Stage dressing failed: ${stage}`, error);
    ambient.dispose(); kit.dispose();
    return undefined;
  }
}
