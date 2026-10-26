import * as THREE from 'three';

/**
 * The ICE element's looks. A preset is colour only: the kit's shapes and timings come from each cue's params, so one
 * fighter's ice differs from another's by what it is made of, not by a second set of effects.
 *
 * Every colour reaches the shaders as an instance attribute (the tint) or a uniform, never as a shader constant, so a
 * second preset in the same fight costs no compile.
 */
export type IcePresetId = 'ice/aokiji' | 'ice/esdeath' | 'ice/rukia' | 'ice/todoroki';

export interface IcePreset {
  /** A tuned preset's id (IcePresetId), or `ice/<fighter>` for one built from a casting palette (`presetFromPalette`). */
  readonly id: string;
  /** The crystals' body: the colour of a facet seen edge-on, before the depth darkens it. */
  readonly body: THREE.Color;
  /** A second body colour, mixed in per crystal, so a field is not one flat tint. */
  readonly pale: THREE.Color;
  /** Frost: rims, cut edges, the milky tips, the floor's sheet. */
  readonly frost: THREE.Color;
  /** The cold light under the floor sheet's cracks and seams. */
  readonly seam: THREE.Color;
  /** The mist's colour. */
  readonly mist: THREE.Color;
  /** The cold light the ice throws on the fighters and the floor (hex, for the light pool). */
  readonly light: number;
}

const preset = (id: IcePresetId, body: number, pale: number, frost: number, seam: number, mist: number, light: number): IcePreset =>
  Object.freeze({ id, body: new THREE.Color(body), pale: new THREE.Color(pale), frost: new THREE.Color(frost), seam: new THREE.Color(seam), mist: new THREE.Color(mist), light });

/** Aokiji's ice is sea ice: glass-clear blue going deep where it is thick, white where it is frosted, from his palette
 *  (vfx/palette.ts: spike 0xe9faff, rim 0x83c7e7, light 0x306b9e). */
export const ICE_PRESETS: Readonly<Partial<Record<IcePresetId, IcePreset>>> = Object.freeze({
  'ice/aokiji': preset('ice/aokiji', 0x74c4ea, 0xa9e2fb, 0xeefbff, 0x2f7fc0, 0xd8f1ff, 0x8fd6ff),
  // Room for the roster's other ice, tuned with their pilots (not drawn yet): Esdeath's (palette rim 0x91dfff, harder
  // and whiter), Rukia's (Sode no Shirayuki, near white) and Todoroki's (his right side's frost).
});

/** Presets built at run time from fighters' casting palettes (`definePreset`), by id. */
const DEFINED = new Map<string, IcePreset>();

/** A preset by id: a tuned one, else one defined from a casting palette; an unknown id falls back to Aokiji's, so a
 *  cue never draws nothing. */
export function icePreset(id: string): IcePreset {
  return ICE_PRESETS[id as IcePresetId] ?? DEFINED.get(id) ?? ICE_PRESETS['ice/aokiji']!;
}

/** Make `preset` the one `icePreset(preset.id)` answers with, unless a tuned preset has that id (a tuned look wins). */
export function definePreset(preset: IcePreset) {
  if (!ICE_PRESETS[preset.id as IcePresetId]) DEFINED.set(preset.id, preset);
  return icePreset(preset.id);
}

const hsl = { h: 0, s: 0, l: 0 };
/** Whether a colour can be ice: cool (cyan to violet) or nearly grey. A fire-and-ice fighter's palette (Todoroki's) has
 *  a warm main for its fire; its ice is then built from the rim and the core. */
function icy(c: THREE.Color) { c.getHSL(hsl); return hsl.s < .2 || (hsl.h > .42 && hsl.h < .8); }

/**
 * A fighter's ice from its casting palette (src/engine/vfx/casting.json `palette`): the core is the frost (rims, cut
 * edges, the floor's sheet), the main the crystals' body, the rim the cold light in the seams. Built to agree with the
 * tuned Aokiji preset: his palette (core eefbff, main 74c4ea, rim 2f7fc0) gives back his body, frost and seam exactly
 * and his pale, mist and light within a few levels. When the main is warm (a fire-and-ice fighter's), the body is the
 * rim lifted toward the core instead, and the seam a deeper, clearer version of the rim, so the cracks still read.
 */
export function presetFromPalette(id: string, palette: { core: string; main: string; rim: string }): IcePreset {
  const core = new THREE.Color(palette.core), main = new THREE.Color(palette.main), rim = new THREE.Color(palette.rim);
  let body = main, seam = rim;
  if (!icy(main)) {
    body = rim.clone().lerp(core, .35);
    rim.getHSL(hsl);
    seam = new THREE.Color().setHSL(hsl.h, Math.max(hsl.s, .6), Math.min(hsl.l, .62));
  }
  const pale = body.clone().lerp(core, .45), mist = core.clone().lerp(body, .2), light = body.clone().lerp(core, .3);
  return Object.freeze({ id, body, pale, frost: core, seam, mist, light: light.getHex() });
}
