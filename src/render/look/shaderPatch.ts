import * as THREE from 'three';

type Shader = THREE.WebGLProgramParametersWithUniforms;
type Edit = (shader: Shader, renderer: THREE.WebGLRenderer) => void;
interface Chain { edits: { key: string; edit: Edit }[]; base: string }

const chains = new WeakMap<THREE.Material, Chain>();
const DEFAULT_COMPILE = THREE.Material.prototype.onBeforeCompile;

export function addShaderPatch(material: THREE.Material, key: string, edit: Edit) {
  let chain = chains.get(material);
  if (!chain) {
    const previous = material.onBeforeCompile;
    const inherited = previous !== DEFAULT_COMPILE;
    chain = { edits: [], base: inherited ? material.customProgramCacheKey() : '' };
    chains.set(material, chain);
    const own = chain;
    material.onBeforeCompile = function (shader, renderer) {
      if (inherited) previous.call(this, shader, renderer);
      for (const { edit } of own.edits) edit(shader, renderer);
    };
    material.customProgramCacheKey = () => [own.base, ...own.edits.map(e => e.key)].filter(Boolean).join('|');
  }
  const existing = chain.edits.find(e => e.key === key);
  if (existing) existing.edit = edit; else chain.edits.push({ key, edit });
  material.needsUpdate = true;
}

export function shaderPatchKeys(material: THREE.Material): string[] {
  return chains.get(material)?.edits.map(e => e.key) ?? [];
}

export function replaceOnce(source: string, find: string, replacement: string, label: string) {
  if (!source.includes(find)) {
    if (typeof console !== 'undefined') console.warn(`look: shader edit "${label}" did not find ${find}`);
    return source;
  }
  return source.replace(find, replacement);
}
