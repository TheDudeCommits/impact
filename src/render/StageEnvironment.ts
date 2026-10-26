import {RiftWarWorld} from './moba/RiftWarWorld';
import {BloodCitadel} from './objectives/BloodCitadel';
import {HiddenLeafVillage} from './objectives/HiddenLeafVillage';
import {coverStage,installCameraCutaway} from './CameraCutaway';
import {ArenaEnvironment} from './ArenaEnvironment';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { STAGES, type StageId } from '../game/stages';
import { stageColliders } from '../game/environmentLayout';
import { previewStage } from './look/preview';
import { hiddenByLook, lookStageMaterial } from './look/stageMaterials';
import { placeCaster, showPlaceCasters } from './look/placeShadows';
import { MERGED_PLACES, mergeStaticMeshes } from './stages/mergeStatic';
import { isRiftStage } from '../game/riftLayouts';
import { RiftStage } from './rift/RiftStage';
import { dressStage, type StageDressing } from './stages/dressing';
import { dressGround } from './ground';
import { passWhileHidden } from './hiddenMatrices';

interface Loaded { root: THREE.Group; occluders: THREE.Object3D[]; rift?: RiftStage; objective?: HiddenLeafVillage | BloodCitadel | RiftWarWorld; harbour?: ArenaEnvironment; dressing?: StageDressing }

export class StageEnvironment {
  public occluders: THREE.Object3D[] = [];
  public current: StageId | null = null;
  private readonly loader = new GLTFLoader();
  private readonly loaded = new Map<StageId, Loaded>();
  private readonly pending = new Map<StageId, Promise<Loaded>>();
  private disposed = false;

  constructor(private readonly scene: THREE.Scene) {}

  preload(stage: StageId): Promise<void> {
    return this.fetch(stage).then(() => undefined);
  }

  withStageLighting<T>(stage: StageId, compile: () => T): T {
    if (!this.loaded.has(stage)) return compile();
    const previous = [...this.loaded.values()].map(entry => [entry.root, entry.root.visible] as const);
    for (const [id, entry] of this.loaded) entry.root.visible = id === stage;
    try { return compile(); }
    finally { for (const [root, visible] of previous) root.visible = visible; }
  }

  async show(requested: StageId): Promise<void> {
    const stage = previewStage(requested);
    if (this.current === stage) return;
    const model = STAGES[stage].model;
    if (!model && !isRiftStage(stage) && stage!=='hidden-leaf' && stage!=='blood-citadel' && stage!=='rift-war' && stage!=='harbor') { this.hideAll(); this.current = stage; this.occluders = []; return; }
    const entry = await this.fetch(stage);
    if (this.disposed) return;
    this.hideAll();
    entry.root.visible = true;
    entry.rift?.restore();
    this.current = stage;
    this.occluders = entry.occluders;
    showPlaceCasters(entry.root);
    this.loaded.delete(stage);this.loaded.set(stage,entry);
    for(const [id,other] of [...this.loaded])if(id!==stage)this.release(id,other);
  }

  releaseAll() {
    showPlaceCasters(null);
    for (const [id, entry] of [...this.loaded]) this.release(id, entry);
    this.current = null; this.occluders = [];
  }

  private hideAll() {
    for (const entry of this.loaded.values()) entry.root.visible = false;
  }

  private fetch(stage: StageId): Promise<Loaded> {
    const existing = this.loaded.get(stage);
    if (existing) return Promise.resolve(existing);
    let promise = this.pending.get(stage);
    if (!promise) {
      promise = this.build(stage).then(entry => {
        this.pending.delete(stage);
        if (this.disposed) { this.release(stage, entry); throw new Error('StageEnvironment disposed'); }
        passWhileHidden(entry.root);
        coverStage([entry.root]);
        this.loaded.set(stage, entry);
        return entry;
      }).catch(error=>{this.pending.delete(stage);throw error;});
      this.pending.set(stage, promise);
    }
    return promise;
  }

  root(stage: StageId): THREE.Object3D | undefined { return this.loaded.get(previewStage(stage))?.root; }

  get rift(): RiftStage | undefined { return this.current ? this.loaded.get(this.current)?.rift : undefined; }
  update(time: number) { this.rift?.update(time); if(this.current){const entry=this.loaded.get(this.current);entry?.objective?.update(time);entry?.harbour?.update(time);entry?.dressing?.update(time);} }

  private async build(stage: StageId): Promise<Loaded> {
    const definition = STAGES[stage];
    if (stage === 'harbor') {
      const harbour = new ArenaEnvironment(this.scene);
      harbour.root.visible = false; passWhileHidden(harbour.root);
      try { await harbour.load(); } catch (error) { harbour.dispose(); throw error; }
      return { root: harbour.root, occluders: harbour.occluders, harbour };
    }
    if(stage==='rift-war'){const war=new RiftWarWorld();war.root.visible=false;try{await war.load();}catch(error){war.dispose();throw error;}this.scene.add(war.root);return {root:war.root,occluders:war.occluders,objective:war};}
    if(stage==='hidden-leaf'||stage==='blood-citadel'){const village=stage==='hidden-leaf'?new HiddenLeafVillage():new BloodCitadel();village.root.visible=false;await village.load();this.scene.add(village.root);return {root:village.root,occluders:village.occluders,objective:village};}
    if (isRiftStage(stage)) {
      const rift = new RiftStage(stage);
      const root = new THREE.Group();
      root.name = `Stage:${stage}`; root.visible = false;
      root.add(rift.root);
      this.scene.add(root);
      return { root, occluders: rift.occluders, rift };
    }
    const gltf: GLTF = await this.loader.loadAsync(definition.model!);
    const root = new THREE.Group();
    root.name = `Stage:${stage}`;
    root.visible = false;
    root.add(gltf.scene);
    gltf.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      object.receiveShadow = true;
      const looked = (Array.isArray(object.material) ? object.material : [object.material])
        .map(material => lookStageMaterial(material, stage, object.name, { doubleSided: definition.doubleSided }));
      object.material = Array.isArray(object.material) ? looked : looked[0];
      for (const material of looked) {
        if (material.userData.lookBackdrop) object.receiveShadow = false;
        if (hiddenByLook(stage, material.name)) object.visible = false;
        if (placeCaster(stage, material.name)) object.userData.placeCaster = true;
        installCameraCutaway(material);
      }
    });
    const occluders: THREE.Object3D[] = [];
    const wall = new THREE.MeshBasicMaterial({ visible: false });
    const { walls, landmarks } = stageColliders(stage);
    for (const c of walls) {
      const alongZ = c.halfZ > c.halfX;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 1 : c.halfX * 2, 14, alongZ ? c.halfZ * 2 : 1), wall);
      mesh.position.set(alongZ ? Math.sign(c.x) * (Math.abs(c.x) - c.halfX + .1) : 0, 7,
        alongZ ? 0 : Math.sign(c.z) * (Math.abs(c.z) - c.halfZ + .1));
      mesh.visible = false;
      root.add(mesh);
      occluders.push(mesh);
    }
    for (const c of landmarks) {
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(c.halfX * 2, c.halfY * 2, c.halfZ * 2), wall);
      proxy.position.set(c.x, c.y, c.z);
      proxy.visible = false;
      proxy.name = 'stage-landmark-occluder';
      root.add(proxy);
      occluders.push(proxy);
    }
    const dressing = await dressStage(stage, root, gltf.scene);
    await dressGround(stage, root, gltf.scene);
    if (MERGED_PLACES.has(stage)) mergeStaticMeshes(gltf.scene);
    this.scene.add(root);
    return { root, occluders, dressing };
  }

  private release(stage: StageId, entry: Loaded) {
    this.scene.remove(entry.root);
    if (entry.harbour) { entry.harbour.dispose(); this.loaded.delete(stage); if (this.current === stage) { this.current = null; this.occluders = []; } return; }
    entry.objective?.dispose();
    entry.dressing?.dispose();
    if (entry.rift) { entry.rift.dispose(); this.loaded.delete(stage); if (this.current === stage) { this.current = null; this.occluders = []; } return; }
    entry.root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      if(object instanceof THREE.InstancedMesh)object.dispose();
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
        material.dispose();
      }
    });
    this.loaded.delete(stage);
    if (this.current === stage) { this.current = null; this.occluders = []; }
  }

  dispose() {
    this.disposed = true;
    for (const [stage, entry] of [...this.loaded]) this.release(stage, entry);
    this.pending.clear();
  }
}
