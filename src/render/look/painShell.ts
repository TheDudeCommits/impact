import type { MeshToonMaterial } from 'three';
import { addShaderPatch, replaceOnce } from './shaderPatch';

export function preservePainCloakSurface(material: MeshToonMaterial, fighter: string, mesh: string): void {
  if (fighter !== 'pain' || mesh !== 'body_pain') return;
  addShaderPatch(material, 'pain-cloak-shell-clearance-v2', shader => {
    shader.vertexShader = replaceOnce(shader.vertexShader,
      'gl_Position = projectionMatrix * mvPosition;',
      'float painInkDepth = max(-mvPosition.z, 0.05);\n\t\tmvPosition.xyz *= (painInkDepth + 0.2050) / painInkDepth;\n\t\tgl_Position = projectionMatrix * mvPosition;',
      'Pain cloak shell clearance');
  });
}
