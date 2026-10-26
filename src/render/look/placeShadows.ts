import * as THREE from 'three';
import type { StageId } from '../../game/stages';

const CASTERS: Partial<Record<StageId, RegExp>> = {
  'malevolent-shrine': /^Bull_Skull_Material\.001$/,
  marineford: /^Marineford_Cover_(Stone|Ice)$/,
  'pains-crater': /^Crater_Cover(_Tiles)?$/,
};

export function placeCaster(stage: StageId, materialName: string): boolean {
  return CASTERS[stage]?.test(materialName) ?? false;
}

let shown: THREE.Object3D | null = null;
let on = true;
function apply() { shown?.traverse(o => { if (o.userData.placeCaster) o.castShadow = on; }); }
export function showPlaceCasters(root: THREE.Object3D | null) { shown = root; apply(); }
export function setPlaceShadowQuality(quality: 'high' | 'medium' | 'low') { on = quality !== 'low'; apply(); }

const EDGE = `
			// Faded out toward the edge of the sun's box round the fight, so a long shadow ends softly (look/placeShadows.ts).
			vec2 lookShadowEdge = min( shadowCoord.xy, 1.0 - shadowCoord.xy );
			shadow = mix( 1.0, shadow, smoothstep( 0.0, 0.125, min( lookShadowEdge.x, lookShadowEdge.y ) ) );
			return mix( 1.0, shadow, shadowIntensity );`;
let installed = false;
export function installShadowEdge() {
  if (installed) return;
  installed = true;
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const pcf = chunk.indexOf('#if defined( SHADOWMAP_TYPE_PCF )');
  const end = '\t\t\treturn mix( 1.0, shadow, shadowIntensity );';
  const at = chunk.indexOf(end, pcf);
  if (pcf < 0 || at < 0) { console.warn('look: the shadow edge fade did not find three\'s PCF shadow'); return; }
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk.slice(0, at) + EDGE.slice(1) + chunk.slice(at + end.length);
}
installShadowEdge();

export const PLACE_CASTERS = CASTERS;
