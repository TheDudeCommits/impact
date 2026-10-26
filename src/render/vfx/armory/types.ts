import type * as THREE from 'three';


export type ArmoryLightHandle = object | null;

export interface ArmoryLightsApi {
  acquire(): ArmoryLightHandle;
  set(handle: ArmoryLightHandle, position: THREE.Vector3, color: THREE.Color, intensity: number, distance: number, dt: number): void;
  release(handle: ArmoryLightHandle): void;
  update(dt: number): void;
  reset(): void;
  dispose(): void;
}

export interface ArmoryShakeApi {
  add(amount: number, decay?: number, frequency?: number): void;
  rumble(amount: number, dt: number): void;
  update(dt: number): void;
  reset(): void;
}

export interface ArmoryFlashApi {
  trigger(color: THREE.Color, strength: number, decay?: number): void;
  update(dt: number): void;
  reset(): void;
}

export interface ArmoryContext {
  scene: THREE.Object3D;
  camera: THREE.Camera;
  environment: { scene: THREE.Object3D; renderer?: { gl: unknown }; equirect?: THREE.Texture | null; registerShadowCaster?<M>(material: M): M; registerShadowCasterWithPatch?<M>(material: M, patch: unknown): M };
  particles: unknown;
  lights: ArmoryLightsApi;
  decals: unknown;
  fissures: unknown;
  bursts: unknown;
  shake: ArmoryShakeApi;
  flash: ArmoryFlashApi;
}

export interface ArmoryAbility {
  readonly element: string;
  readonly group: THREE.Group;
  phase: string;
  readonly origin: THREE.Vector3;
  readonly direction: THREE.Vector3;
  readonly side: THREE.Vector3;
  length: number;
  front: number;
  u: number;
  readonly position: THREE.Vector3;
  age: number;
  light: ArmoryLightHandle;
  readonly isActive: boolean;
  readonly isFinished: boolean;
  readonly impactDuration: number;
  readonly fadeDuration: number;
  readonly config: Record<string, unknown>;
  spawn(origin: THREE.Vector3, direction: THREE.Vector3, distance: number): void;
  update(dt: number): void;
  destroy(): void;
  dispose(): void;
}

export type ArmoryAbilityClass = new (context: ArmoryContext) => ArmoryAbility;

export interface ArmorySoundLayer {
  readonly sound: string;
  readonly gain: number;
  readonly delay?: number;
  readonly pitch?: number;
  readonly minIntensity?: number;
  readonly maxIntensity?: number;
  readonly params?: Readonly<Record<string, number | string>>;
}
export interface ArmorySoundProfile {
  readonly kind?: string;
  readonly cast?: readonly ArmorySoundLayer[];
  readonly charge?: readonly ArmorySoundLayer[];
  readonly loop?: {
    readonly layers: readonly ArmorySoundLayer[]; readonly at: 'cast' | 'release' | 'impact'; readonly until: 'impact' | 'fade' | 'end'; readonly max: number;
    readonly fade?: number;
  };
  readonly impacts?: readonly { readonly on: 'first' | 'hit'; readonly layers: readonly ArmorySoundLayer[]; readonly gap?: number; readonly min?: number }[];
  readonly tail?: readonly ArmorySoundLayer[];
}
export type ArmorySoundName =
  | { readonly type: 'synth'; readonly recipe: string; readonly loop: boolean; readonly params: Readonly<Record<string, number | string>> }
  | { readonly type: 'sample'; readonly bank: string; readonly files: readonly string[]; readonly formats: readonly string[]; readonly loop: boolean; readonly durations: readonly number[] };
