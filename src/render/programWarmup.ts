import * as THREE from 'three';

export interface IntrospectableProgram { getUniforms(): unknown; getAttributes(): unknown }
export interface ProgramSource { info: { programs: readonly IntrospectableProgram[] | null } }

export function introspectPrograms(renderer: ProgramSource): number {
  let asked = 0;
  for (const program of renderer.info.programs ?? []) {
    try { program.getUniforms(); program.getAttributes(); asked++; }
    catch { }
  }
  return asked;
}

const SHADOW_SIDE: Record<THREE.Side, THREE.Side> = { [THREE.FrontSide]: THREE.BackSide, [THREE.BackSide]: THREE.FrontSide, [THREE.DoubleSide]: THREE.DoubleSide };
type Shadowed = THREE.Material & { map?: THREE.Texture | null; alphaMap?: THREE.Texture | null; displacementMap?: THREE.Texture | null; displacementScale?: number; displacementBias?: number; wireframe?: boolean };
export function compileShadowPrograms(renderer: THREE.WebGLRenderer, root: THREE.Object3D, scene: THREE.Object3D, camera: THREE.Camera, keeper: THREE.MeshDepthMaterial): number {
  if (!renderer.shadowMap.enabled) return 0;
  const vsm = renderer.shadowMap.type === THREE.VSMShadowMap, seen = new Set<string>();
  const channel = (t?: THREE.Texture | null) => t ? t.channel : -1;
  let compiled = 0;
  const casters = {
    traverse(visit: (object: THREE.Object3D) => void) {
      root.traverse(object => {
        const o = object as THREE.Mesh & { isSkinnedMesh?: boolean; isInstancedMesh?: boolean; isLine?: boolean; isPoints?: boolean; isBatchedMesh?: boolean; morphTexture?: unknown; instanceColor?: unknown; customDepthMaterial?: THREE.Material };
        if (!(o.isMesh || o.isLine || o.isPoints) || !o.castShadow || !o.material) return;
        const g = o.geometry, a = g?.attributes ?? {}, morph = g?.morphAttributes ?? {}, morphs = (morph.position ?? morph.normal ?? morph.color)?.length ?? 0;
        const shape = [o.isSkinnedMesh, o.isInstancedMesh && [!!o.instanceColor, !!o.morphTexture], o.isBatchedMesh, o.isPoints, o.isLine, morphs, !!morph.normal, !!morph.color, !!a.position, !!a.normal, !!a.uv, !!a.uv1, !!a.uv2, !!a.uv3].join();
        const own = o.material;
        for (const m of (Array.isArray(own) ? own : [own]) as Shadowed[]) {
          if (!m) continue;
          const depth = (o.customDepthMaterial ?? keeper) as Shadowed;
          const side = m.shadowSide ?? (vsm ? m.side : SHADOW_SIDE[m.side]), clips = renderer.localClippingEnabled && m.clipShadows && (m.clippingPlanes?.length ?? 0) > 0;
          const key = [depth === keeper ? '' : depth.uuid, shape, side, channel(m.map), channel(m.alphaMap), m.alphaTest > 0, m.alphaToCoverage, !!m.displacementMap && m.displacementScale !== 0 && channel(m.displacementMap), clips && [m.clippingPlanes!.length, m.clipIntersection]].join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          Object.assign(depth, { side, alphaMap: m.alphaMap ?? null, alphaTest: m.alphaToCoverage ? .5 : m.alphaTest, map: m.map ?? null, clipShadows: m.clipShadows, clippingPlanes: m.clippingPlanes, clipIntersection: m.clipIntersection,
            displacementMap: m.displacementMap ?? null, displacementScale: m.displacementScale ?? 1, displacementBias: m.displacementBias ?? 0, wireframe: !!m.wireframe });
          o.material = depth; compiled++;
          try { visit(o); } finally { o.material = own; }
        }
      });
    },
    traverseVisible() { },
  };
  const lights = { traverseVisible: (visit: (object: THREE.Object3D) => void) => scene.traverseVisible(visit) };
  renderer.compile(casters as unknown as THREE.Object3D, camera, lights as unknown as THREE.Scene);
  return compiled;
}
