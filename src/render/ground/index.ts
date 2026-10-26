import type * as THREE from 'three';
import type { StageId } from '../../game/stages';
import type { GroundPlan } from './build';

export const GROUNDS: Partial<Record<StageId, () => Promise<GroundPlan>>> = {
  'chunin-final': () => import('./places/chuninFinal').then(m => m.CHUNIN_GROUND),
  'valley-of-the-end': () => import('./places/valleyOfTheEnd').then(m => m.VALLEY_GROUND),
  'kami-lookout': () => import('./places/kamiLookout').then(m => m.KAMI_GROUND),
  'malevolent-shrine': () => import('./places/malevolentShrine').then(m => m.SHRINE_GROUND),
  'martial-arts-tournament': () => import('./places/martialArtsTournament').then(m => m.TOURNAMENT_GROUND),
  'hueco-mundo': () => import('./places/huecoMundo').then(m => m.HUECO_GROUND),
  'pains-crater': () => import('./places/painsCrater').then(m => m.CRATER_GROUND),
};

export const GROUND_DECISIONS: Record<Exclude<StageId, 'hidden-leaf' | 'blood-citadel' | `rift-${string}`>, { ground: readonly ('grass' | 'water' | 'sand' | 'reeds' | 'moss' | 'leaves')[]; why: string }> = {
  'chunin-final': { ground: ['grass', 'leaves'], why: 'A grass field inside the stadium wall: the reference fights in knee-high grass, and the field measured olive, not green. Fallen leaves on its tracks and under its trees, as on the reference\'s forest path.' },
  'valley-of-the-end': { ground: ['water', 'grass', 'moss'], why: 'The fight stands in the river: it takes the waves, drawn on the river\'s own painted water, so the violet sundown is kept. Grass on the canyon\'s dry rims and ledges, moss where the stone stays wet at the waterline; the reeds in the shallows are the place\'s own dressing already.' },
  'kami-lookout': { ground: ['grass'], why: 'Mr. Popo\'s gardens: lawns in the four corner gardens round the rim (where the lookout\'s own lawn arcs run and its palms, bushes and flower beds stand), its own strips by the palace steps and the south stair, and grass in the gardens\' stone beds. The tiles stay the platform\'s own: the fight is on them.' },
  'martial-arts-tournament': { ground: ['grass'], why: 'The lawn round the ring, as Dragon Ball draws it: the ring stands over a grass field, seen past and below its edges all fight long (the bounds hold the fight on the ring). The ring itself stays stone; the grass parts round stream E\'s ringside pieces and masts, and the competitors\' walk to the gate stays stone.' },
  'malevolent-shrine': { ground: ['water'], why: 'The domain is fought on a lake of blood: it takes the waves as the Valley\'s river does, drawn on the lake\'s own dark mirror (stream E\'s) in the domain\'s reds, coming back off the skulls strewn through it. Nothing grows in a domain.' },
  'enies-lobby': { ground: [], why: 'The Bridge of Hesitation: stone, between stone towers, with the sea far below the fight. Nothing grows or flows where anyone stands.' },
  shiganshina: { ground: [], why: 'A cobbled square under Wall Maria, its wear and its debris stream E\'s. Grass would make the breach\'s day a meadow; the street stays stone.' },
  'chunin-exam-room': { ground: [], why: 'Indoors: the exam hall\'s floor. Nothing grows or flows inside.' },
  'hueco-mundo': { ground: ['sand'], why: 'The white desert under Las Noches: nothing grows there, but its sand takes every footprint and fills in again as the wind crosses it.' },
  onigashima: { ground: [], why: 'The roof of the Skull Dome: tiles over the island\'s fortress, nothing grows or flows on a roof.' },
  'galactic-arena': { ground: [], why: 'A ring of stone floating in space: no ground round it to grow, and no water.' },
  'null-realm': { ground: [], why: 'The Tournament of Power\'s floor in the void: tiles under a starfield, nothing to grow or flow.' },
  harbor: { ground: [], why: 'A paved harbour town: the fight is on cobbles and quays, and the canals lie behind the quay walls, never stood in (no liquid floor). Nothing would grow on its stone.' },
  'pains-crater': { ground: ['sand'], why: 'The crater Shinra Tensei pressed into the Hidden Leaf: bare, swept earth with nothing left growing on it - but loose, so it keeps the fighters\' footprints, filling in as the dust settles.' },
  marineford: { ground: [], why: 'The Oris Plaza\'s flagstones and the bay Aokiji froze solid: nothing grows on either, and the water is ice, stood on, not waded (no liquid floor). Its frost, cracks and wear are the place\'s own.' },
  shibuya: { ground: [], why: 'The Scramble Crossing: asphalt and brick pavement in the middle of Tokyo. Nothing grows on it and nothing flows; its wet sheen and the light pooled on it are the place\'s own dressing (render/stages/shibuya.ts).' },
  'infinity-castle': { ground: [], why: 'Indoors, in Muzan\'s fortress: a tatami hall in a wooden corridor over a void. Nothing grows or flows in it; the lanterns\' light pooled on the mats is the place\'s own dressing (render/stages/infinityCastle.ts).' },
  'heavens-arena': { ground: [], why: 'A ring of stone tiles indoors, 200 floors up: nothing grows on it and nothing lies loose to take a print; its cracks and scuffs are the tiles\' own.' },
};

export async function dressGround(stage: StageId, root: THREE.Group, model: THREE.Object3D) {
  const plan = GROUNDS[stage];
  if (!plan || typeof document === 'undefined') return;
  if (import.meta.env?.DEV && typeof location === 'object' && new URLSearchParams(location.search).has('ground-none')) return;
  try {
    const [{ buildGround }, recipe] = await Promise.all([import('./build'), plan()]);
    await buildGround(stage, root, model, recipe);
  } catch (error) {
    console.warn(`Ground failed: ${stage}`, error);
  }
  const off = import.meta.env?.DEV && typeof location === 'object' ? new URLSearchParams(location.search).get('ground-off') : null;
  if (off) { const pattern = new RegExp(off); root.traverse(o => { if ((o as THREE.Mesh).isMesh && pattern.test(o.name)) o.visible = false; }); }
}
