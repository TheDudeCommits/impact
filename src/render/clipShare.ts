import * as THREE from 'three';


export interface ShareStats {
  tracks: number;
  held: number;
  reused: number;
}

const bytes = (array: Float32Array) => {
  const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let text = '';
  for (let i = 0; i < view.length; i++) text += String.fromCharCode(view[i]);
  return text;
};

export class ClipPool {
  private readonly arrays = new Map<string, Float32Array>();
  private readonly names = new Map<string, string>();

  private name(name: string) {
    const known = this.names.get(name);
    if (known !== undefined) return known;
    this.names.set(name, name);
    return name;
  }
  private array(array: Float32Array, stats: ShareStats) {
    const key = bytes(array), known = this.arrays.get(key);
    if (known) { if (known !== array) stats.reused++; return known; }
    this.arrays.set(key, array);
    return array;
  }

  share(track: THREE.KeyframeTrack, stats: ShareStats) {
    stats.tracks++;
    track.name = this.name(track.name);
    const quaternion = track instanceof THREE.QuaternionKeyframeTrack;
    if (!quaternion && !(track instanceof THREE.VectorKeyframeTrack)) return;
    const size = quaternion ? 4 : 3, keys = track.times.length, values = track.values, times = track.times;
    const interpolation = track.getInterpolation();
    if (keys === 0 || values.length !== keys * size || interpolation === undefined || interpolation === THREE.InterpolateSmooth || !(values instanceof Float32Array) || !(times instanceof Float32Array)) return;
    for (let key = 1; key < keys; key++) for (let part = 0; part < size; part++) if (!Object.is(values[key * size + part], values[part])) return;
    stats.held++;
    track.times = this.array(times, stats);
    track.values = this.array(values, stats);
  }
}

export function shareClips(clips: readonly THREE.AnimationClip[] | undefined, pool: ClipPool = new ClipPool(), stats: ShareStats = { tracks: 0, held: 0, reused: 0 }): ShareStats {
  for (const clip of clips ?? []) for (const track of clip.tracks) pool.share(track, stats);
  return stats;
}
