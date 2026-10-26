import * as THREE from 'three';

export const BONES = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'head_end', 'headfront',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'] as const;
export type BoneName = (typeof BONES)[number];
export const BONE = Object.fromEntries(BONES.map((name, i) => [name, i])) as Record<BoneName, number>;
export const MOTION_FPS = 30;

export interface MotionClip { name: string; row: number; frames: number; duration: number }
interface MotionFile { version: number; nodes: { name: string; parent: number; t: number[]; r: number[]; s: number[] }[];
  clips: { name: string; duration: number; channels: { node: string; path: 'quaternion' | 'position'; times: [number, number]; values: [number, number] }[] }[] }

export interface MotionClips { root: THREE.Group; animations: THREE.AnimationClip[]; hipsRest: number }

export interface ClipSample { row: number; next: number; frac: number }

export class MotionLibrary {
  readonly rest: THREE.Vector3[] = [];
  readonly clips = new Map<string, MotionClip>();
  readonly normal = new THREE.Matrix4();
  texture!: THREE.DataTexture;
  height = 1.8;
  animations: THREE.AnimationClip[] = [];
  hipsRest = 1;
  private constructor() {}

  static retarget(source: MotionLibrary, root: THREE.Object3D): MotionLibrary {
    const library = new MotionLibrary();
    const hips = root.getObjectByName('Hips');
    const rest = hips ? hips.position.length() : source.hipsRest;
    const ratio = rest / Math.max(1e-6, source.hipsRest);
    const clips = source.animations.map(clip => new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.map(track => {
      if (!track.name.startsWith('Hips.') || !track.name.endsWith('.position')) return track;
      const values = Float32Array.from(track.values, v => v * ratio);
      return new THREE.VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
    })));
    library.animations = clips; library.hipsRest = rest;
    library.bake(root, clips);
    return library;
  }

  static native(root:THREE.Object3D,clips:THREE.AnimationClip[]):MotionLibrary {
    const library=new MotionLibrary();library.animations=clips;
    library.hipsRest=root.getObjectByName('Hips')?.position.length()??1;
    library.bake(root,clips,true);return library;
  }

  static async load(url = '/assets/survival/motion/humanoid'): Promise<MotionLibrary> {
    const { root, animations, hipsRest } = await MotionLibrary.clips(url);
    const library = new MotionLibrary();
    library.animations = animations; library.hipsRest = hipsRest;
    library.bake(root, animations);
    return library;
  }

  static async clips(url = '/assets/survival/motion/humanoid'): Promise<MotionClips> {
    const [index, blob] = await Promise.all([fetch(`${url}.json`).then(r => r.json() as Promise<MotionFile>), fetch(`${url}.bin`).then(r => r.arrayBuffer())]);
    const floats = new Float32Array(blob);
    const root = new THREE.Group();
    const objects = index.nodes.map(node => {
      const object = new THREE.Object3D();
      object.name = node.name;
      object.position.fromArray(node.t); object.quaternion.fromArray(node.r); object.scale.fromArray(node.s);
      return object;
    });
    index.nodes.forEach((node, i) => (node.parent >= 0 ? objects[node.parent] : root).add(objects[i]));
    const clips = index.clips.map(clip => new THREE.AnimationClip(clip.name, clip.duration, clip.channels.map(channel => {
      const times = floats.subarray(channel.times[0], channel.times[0] + channel.times[1]);
      const values = floats.subarray(channel.values[0], channel.values[0] + channel.values[1]);
      const name = `${channel.node}.${channel.path}`;
      return channel.path === 'quaternion' ? new THREE.QuaternionKeyframeTrack(name, times, values) : new THREE.VectorKeyframeTrack(name, times, values);
    })));
    return { root, animations: clips, hipsRest: root.getObjectByName('Hips')?.position.length() ?? 1 };
  }

  private bake(scene: THREE.Object3D, animations: THREE.AnimationClip[], grounded=false) {
    scene.updateMatrixWorld(true);
    const nodes = BONES.map(name => {
      const node = scene.getObjectByName(name);
      if (!node) throw new Error(`Motion library is missing bone ${name}`);
      return node;
    });
    const head = new THREE.Vector3().setFromMatrixPosition(nodes[BONE.Head].matrixWorld);
    const front = new THREE.Vector3().setFromMatrixPosition(nodes[BONE.headfront].matrixWorld).sub(head).setY(0).normalize();
    const turn = new THREE.Matrix4().makeRotationY(Math.atan2(front.x, front.z) * -1);
    const restWorld = nodes.map(node => node.matrixWorld.clone());
    let floor = Infinity, top = -Infinity;
    const p = new THREE.Vector3();
    for (const m of restWorld) { p.setFromMatrixPosition(m).applyMatrix4(turn); floor = Math.min(floor, p.y); top = Math.max(top, p.y); }
    const toe = new THREE.Vector3().setFromMatrixPosition(nodes[BONE.LeftToeBase].matrixWorld).applyMatrix4(turn).y;
    floor = Math.min(floor, toe) - .02;
    const normal = new THREE.Matrix4().makeTranslation(0, -floor, 0).multiply(turn);
    this.normal.copy(normal);
    const normalInverse = normal.clone().invert();
    for (const m of restWorld) this.rest.push(new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(normal));
    this.height = top - floor + .1;
    const restInverse = restWorld.map(m => m.clone().invert());
    const wanted = animations.filter(clip => !clip.name.includes('|'));
    let rows = 0;
    for (const clip of wanted) {
      const frames = Math.max(2, Math.round(clip.duration * MOTION_FPS) + 1);
      this.clips.set(clip.name, { name: clip.name, row: rows, frames, duration: clip.duration });
      rows += frames;
    }
    const width = BONES.length * 3;
    const data = new Float32Array(width * rows * 4);
    const mixer = new THREE.AnimationMixer(scene);
    const m = new THREE.Matrix4();
    const correction=new THREE.Matrix4(),hipsRest=new THREE.Vector3().setFromMatrixPosition(restWorld[BONE.Hips]);
    const feet=[BONE.LeftFoot,BONE.RightFoot,BONE.LeftToeBase,BONE.RightToeBase];
    const footFloor=Math.min(...feet.map(b=>restWorld[b].elements[13]));
    for (const clip of wanted) {
      const info = this.clips.get(clip.name)!;
      const action = mixer.clipAction(clip);
      action.play();
      for (let f = 0; f < info.frames; f++) {
        action.time = Math.min(clip.duration, f / MOTION_FPS);
        mixer.update(0);
        scene.updateMatrixWorld(true);
        if(grounded){
          const hip=nodes[BONE.Hips].matrixWorld.elements;
          const falling=/die|knockdown|getup/.test(clip.name);
          let lowest=Infinity;for(const b of falling?BONES.map((_,i)=>i):feet)lowest=Math.min(lowest,nodes[b].matrixWorld.elements[13]);
          correction.makeTranslation(hipsRest.x-hip[12],footFloor-lowest,hipsRest.z-hip[14]);
        }
        const row = info.row + f;
        for (let b = 0; b < BONES.length; b++) {
          if(grounded)m.multiplyMatrices(normal,correction).multiply(nodes[b].matrixWorld);
          else m.multiplyMatrices(normal,nodes[b].matrixWorld);
          m.multiply(restInverse[b]).multiply(normalInverse);
          const e = m.elements, o = (row * width + b * 3) * 4;
          data[o] = e[0]; data[o + 1] = e[4]; data[o + 2] = e[8]; data[o + 3] = e[12];
          data[o + 4] = e[1]; data[o + 5] = e[5]; data[o + 6] = e[9]; data[o + 7] = e[13];
          data[o + 8] = e[2]; data[o + 9] = e[6]; data[o + 10] = e[10]; data[o + 11] = e[14];
        }
      }
      action.stop();
    }
    mixer.uncacheRoot(scene);
    this.texture = new THREE.DataTexture(data, width, rows, THREE.RGBAFormat, THREE.FloatType);
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  posed(bone: number, row: number, out: THREE.Vector3): THREE.Vector3 {
    const d = this.texture.image.data as Float32Array, o = (row * BONES.length * 3 + bone * 3) * 4, r = this.rest[bone];
    return out.set(d[o] * r.x + d[o + 1] * r.y + d[o + 2] * r.z + d[o + 3], d[o + 4] * r.x + d[o + 5] * r.y + d[o + 6] * r.z + d[o + 7], d[o + 8] * r.x + d[o + 9] * r.y + d[o + 10] * r.z + d[o + 11]);
  }

  clip(name: string): MotionClip {
    const clip = this.clips.get(name) ?? this.clips.get('idle');
    if (!clip) throw new Error(`No clip ${name}`);
    return clip;
  }

  sample(clip: MotionClip, seconds: number, loop: boolean, out: ClipSample): ClipSample {
    const span = clip.frames - 1;
    let f = seconds * MOTION_FPS;
    if (loop) f = ((f % span) + span) % span; else f = Math.max(0, Math.min(span, f));
    const i = Math.min(span, Math.floor(f));
    out.row = clip.row + i;
    out.next = clip.row + (i >= span ? (loop ? 0 : span) : i + 1);
    out.frac = f - i;
    return out;
  }
}
