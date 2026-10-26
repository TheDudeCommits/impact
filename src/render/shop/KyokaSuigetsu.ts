import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {shareSkeletons} from '../sharedSkeletons';
import type {Fighter} from '../Fighter';

const SHARDS = 96;
const SHARD_SECONDS = .95;
const GRAVITY = 7.5;

interface Piece {p: THREE.Vector3; v: THREE.Vector3; axis: THREE.Vector3; spin: number; size: THREE.Vector3; turn: number}

export class KyokaDecoy {
  private root = new THREE.Group();
  private copy?: THREE.Object3D;
  private source?: THREE.Object3D;
  private bones = new Map<string, THREE.Object3D>();
  private posedAt = new THREE.Vector3();
  private posedScale = new THREE.Vector3(1, 1, 1);
  private shards: THREE.InstancedMesh;
  private glassMaterial: THREE.MeshBasicMaterial;
  private pieces: Piece[] = [];
  private brokeAt = -Infinity;
  private shown = false;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly colour = new THREE.Color();
  private readonly tints: THREE.Color[] = [];
  readonly chest = new THREE.Vector3();
  readonly facing = new THREE.Vector3(0, 0, 1);

  constructor(private readonly scene: THREE.Scene, glow: THREE.Color) {
    this.root.name = 'kyoka-suigetsu-decoy';
    this.root.visible = false;
    this.root.matrixAutoUpdate = false;
    scene.add(this.root);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, .5, 0, -.32, -.42, 0, .22, -.5, 0, .06, -.1, 0], 3));
    geometry.setIndex([0, 1, 3, 0, 3, 2, 3, 1, 2]);
    this.glassMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, toneMapped: false});
    this.shards = new THREE.InstancedMesh(geometry, this.glassMaterial, SHARDS);
    this.shards.name = 'kyoka-suigetsu-shards';
    this.shards.frustumCulled = false;
    this.shards.visible = false;
    this.shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 5; i++) this.tints.push(new THREE.Color(0xffffff).lerp(glow, i / 7));
    for (let i = 0; i < SHARDS; i++) this.shards.setColorAt(i, this.tints[i % this.tints.length]);
    scene.add(this.shards);
  }

  private ready(model: THREE.Object3D) {
    if (this.source === model && this.copy) return;
    if (this.copy) { this.root.remove(this.copy); this.bones.clear(); }
    this.source = model;
    this.copy = clone(model); shareSkeletons(this.copy);
    this.copy.traverse(o => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name, o);
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) { mesh.castShadow = false; mesh.frustumCulled = false; }
    });
    this.root.add(this.copy);
  }

  show(actor: Fighter) {
    const model = actor.model;
    this.ready(model);
    actor.group.updateMatrixWorld(true);
    this.root.matrix.copy(actor.group.matrixWorld);
    this.root.matrixWorldNeedsUpdate = true;
    const copy = this.copy!;
    copy.position.copy(model.position); copy.quaternion.copy(model.quaternion); copy.scale.copy(model.scale);
    this.posedAt.copy(model.position); this.posedScale.copy(model.scale);
    model.traverse(o => {
      if (!(o as THREE.Bone).isBone) return;
      const twin = this.bones.get(o.name);
      if (twin) { twin.position.copy(o.position); twin.quaternion.copy(o.quaternion); twin.scale.copy(o.scale); }
    });
    const originals: THREE.Object3D[] = [], twins: THREE.Object3D[] = [];
    model.traverse(o => originals.push(o)); copy.traverse(o => twins.push(o));
    for (let i = 0; i < Math.min(originals.length, twins.length); i++) twins[i].visible = originals[i].visible;
    copy.visible = true;
    this.root.visible = true;
    this.root.updateMatrixWorld(true);
    const head = this.bones.get('Head') ?? this.bones.get('Spine2');
    const spine = this.bones.get('Spine2') ?? this.bones.get('Spine') ?? head;
    spine?.getWorldPosition(this.chest);
    this.facing.set(0, 0, 1).applyQuaternion(actor.group.quaternion).setY(0).normalize();
    this.shown = true;
  }

  shatter(time: number) {
    if (!this.shown) return;
    this.shown = false;
    this.root.visible = false;
    this.brokeAt = time;
    const anchors: THREE.Vector3[] = [];
    for (const name of ['Head', 'Neck', 'Spine2', 'Spine1', 'Spine', 'Hips', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
      'LeftHand', 'RightHand', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot']) {
      const bone = this.bones.get(name);
      if (bone) anchors.push(bone.getWorldPosition(new THREE.Vector3()));
    }
    if (!anchors.length) anchors.push(this.chest.clone());
    this.pieces.length = 0;
    let seed = Math.floor(time * 997) % 9973;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed % 100000) / 100000; };
    for (let i = 0; i < SHARDS; i++) {
      const at = anchors[i % anchors.length];
      const p = new THREE.Vector3((rand() - .5) * .34, (rand() - .5) * .3, (rand() - .5) * .34).add(at);
      const out = this.v.copy(p).sub(this.chest).setY(0);
      if (out.lengthSq() < 1e-4) out.set(rand() - .5, 0, rand() - .5);
      out.normalize();
      const speed = 1.6 + rand() * 3.2;
      const v = new THREE.Vector3(out.x * speed, .8 + rand() * 2.4 - (p.y < this.chest.y - .6 ? .8 : 0), out.z * speed).addScaledVector(this.facing, -.6 - rand());
      const axis = new THREE.Vector3(rand() - .5, rand() - .5, rand() - .5).normalize();
      const size = .12 + rand() * .22;
      this.pieces.push({p, v, axis, spin: (rand() - .5) * 26, size: new THREE.Vector3(size * (.55 + rand() * .6), size, 1), turn: rand() * Math.PI * 2});
    }
    this.shards.visible = true;
    this.update(time);
  }

  get standing() { return this.shown; }

  crumble(share: number) {
    if (!this.shown || !this.copy) return;
    const u = THREE.MathUtils.clamp(share, 0, 1), f = Math.max(.02, 1 - u * u * (3 - 2 * u));
    const copy = this.copy;
    this.v.copy(this.chest);
    this.root.worldToLocal(this.v);
    copy.position.copy(this.posedAt).sub(this.v).multiplyScalar(f).add(this.v);
    copy.scale.copy(this.posedScale).multiplyScalar(f);
  }

  release() {
    this.shown = false;
    this.root.visible = false;
  }

  joints(names: readonly string[], out: THREE.Vector3[] = []) {
    out.length = 0;
    for (const name of names) {
      const bone = this.bones.get(name);
      out.push(bone ? bone.getWorldPosition(new THREE.Vector3()) : this.chest.clone());
    }
    return out;
  }

  update(time: number) {
    if (!this.shards.visible) return;
    const age = time - this.brokeAt;
    if (age > SHARD_SECONDS || age < 0) { this.shards.visible = false; return; }
    const dt = Math.max(0, age);
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      this.v.copy(piece.p).addScaledVector(piece.v, dt).setY(piece.p.y + piece.v.y * dt - .5 * GRAVITY * dt * dt);
      this.q.setFromAxisAngle(piece.axis, piece.turn + piece.spin * dt);
      const shrink = 1 - THREE.MathUtils.smoothstep(age, SHARD_SECONDS * .55, SHARD_SECONDS);
      this.s.copy(piece.size).multiplyScalar(Math.max(.001, shrink));
      this.m.compose(this.v, this.q, this.s);
      this.shards.setMatrixAt(i, this.m);
    }
    this.shards.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i], glint = .3 + .7 * Math.abs(Math.sin(piece.turn + piece.spin * dt));
      this.shards.setColorAt(i, this.colour.copy(this.tints[i % this.tints.length]).multiplyScalar(glint));
    }
    if (this.shards.instanceColor) this.shards.instanceColor.needsUpdate = true;
    this.glassMaterial.opacity = (age < .06 ? 1 : .85) * (1 - THREE.MathUtils.smoothstep(age, SHARD_SECONDS * .5, SHARD_SECONDS));
  }

  reset() {
    this.shown = false;
    this.root.visible = false;
    this.shards.visible = false;
  }

  dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.shards);
    this.shards.geometry.dispose();
    this.glassMaterial.dispose();
  }
}
