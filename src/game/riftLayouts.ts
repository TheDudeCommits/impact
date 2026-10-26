import type { StageId } from './stages';

export type RiftPropKind =
  | 'house' | 'ruin' | 'tower' | 'well' | 'cart' | 'hay' | 'fence' | 'rock' | 'tree' | 'grave' | 'sword' | 'statue'
  | 'brazier' | 'pillar' | 'altar' | 'crate' | 'barrel' | 'stake' | 'banner' | 'wall' | 'stone' | 'cage' | 'bones' | 'pyre'
  | 'corpse' | 'gallows'
  | 'torii' | 'lantern' | 'shrine' | 'ice' | 'bamboo'
  | 'ribs' | 'skull'
  | 'mast' | 'hull' | 'pier';

export interface RiftProp {
  kind: RiftPropKind;
  x: number; z: number;
  rot: number;
  w: number; d: number; h: number;
  solid: boolean;
  breakable: boolean;
  seed: number;
  round?: boolean;
}

export interface RiftLayout { stage: StageId; props: RiftProp[] }

export const RIFT_STAGES = ['rift-village', 'rift-swords', 'rift-fortress', 'rift-eclipse', 'rift-frost', 'rift-grove', 'rift-wastes', 'rift-harbor'] as const satisfies readonly StageId[];
export type RiftStageId = (typeof RIFT_STAGES)[number];
export const isRiftStage = (stage: StageId): stage is RiftStageId => (RIFT_STAGES as readonly string[]).includes(stage);

function rng(seed: number) {
  let state = seed | 0 || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}

const prop = (kind: RiftPropKind, x: number, z: number, rot: number, w: number, d: number, h: number, solid: boolean, breakable: boolean, seed: number, round = false): RiftProp =>
  ({ kind, x, z, rot, w, d, h, solid, breakable, seed, ...(round ? { round } : {}) });

const clearOf = (x: number, z: number, r: number) => Math.hypot(x, z + 8) > r && Math.hypot(x, z) > r * .7;

function village(): RiftProp[] {
  const r = rng(0x5eed1), props: RiftProp[] = [];
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2 + (r() - .5) * .18, radius = 24 + r() * 5.5;
    const x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    const ruined = r() < .3;
    props.push(prop(ruined ? 'ruin' : 'house', x, z, a + Math.PI + (r() - .5) * .3, 6 + r() * 2.5, 5 + r() * 1.5, ruined ? 3 : 5.5 + r() * 2, true, false, r()));
  }
  props.push(prop('tower', 0, 21, 0, 5, 5, 16, true, false, r()));
  props.push(prop('well', 7, 6, 0, 2.4, 2.4, 1.2, true, false, r(), true));
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, radius = 6 + r() * 17, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    if (!clearOf(x, z, 5)) continue;
    const roll = r();
    const kind: RiftPropKind = roll < .2 ? 'cart' : roll < .42 ? 'hay' : roll < .62 ? 'barrel' : roll < .78 ? 'crate' : roll < .9 ? 'fence' : 'stake';
    const size = { cart: [2.4, 1.4, 1.4], hay: [1.3, 1.3, 1.1], barrel: [.8, .8, 1], crate: [1, 1, 1], fence: [3, .3, 1.1], stake: [.5, .5, 2.6] }[kind as 'cart'];
    props.push(prop(kind, x, z, r() * Math.PI * 2, size[0], size[1], size[2], false, kind !== 'stake', r()));
  }
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + 1, x = Math.sin(a) * 14, z = Math.cos(a) * 14; if (clearOf(x, z, 5)) props.push(prop('pyre', x, z, r() * 3, 2.6, 2.6, 2.2, true, false, r(), true)); }
  return [...props, ...theDead(0xdead1, 16, [[-12, 11, .4], [13, 9, -.5]], 44)];
}

function theDead(seed: number, count: number, gallows: readonly (readonly [number, number, number])[], spread = 50): RiftProp[] {
  const r = rng(seed), props: RiftProp[] = [];
  for (let i = 0; i < count; i++) {
    const x = (r() - .5) * spread, z = (r() - .5) * spread;
    if (!clearOf(x, z, 4.5)) continue;
    const heap = r() > .8;
    props.push(prop('corpse', x, z, r() * Math.PI * 2, heap ? 2 : 1.2, heap ? 2 : 1.8, heap ? .8 : .4, false, true, heap ? .81 + r() * .19 : r() * .8));
  }
  for (const [x, z, rot] of gallows) props.push(prop('gallows', x, z, rot, 3.4, .6, 3.6, false, false, r()));
  return props;
}

function swords(): RiftProp[] {
  const r = rng(0x5eed2), props: RiftProp[] = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + r() * .4, radius = 13 + r() * 15, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    if (!clearOf(x, z, 6)) continue;
    const tree = r() < .4;
    props.push(prop(tree ? 'tree' : 'rock', x, z, r() * Math.PI * 2, tree ? 1.2 : 2.6 + r() * 2.2, tree ? 1.2 : 2.4 + r() * 2, tree ? 7 + r() * 3 : 1.8 + r() * 2.4, true, false, r(), true));
  }
  for (let i = 0; i < 70; i++) {
    const x = (r() - .5) * 60, z = (r() - .5) * 60;
    if (!clearOf(x, z, 4)) continue;
    const sword = r() < .55;
    props.push(prop(sword ? 'sword' : 'grave', x, z, r() * Math.PI * 2, sword ? .3 : .9, sword ? .1 : .3, sword ? 1.5 + r() * .8 : 1.1 + r() * .5, false, true, r()));
  }
  props.push(prop('statue', 0, 16, 0, 3.2, 3.2, 11, true, false, r(), true));
  return [...props, ...graveRows(), ...theDead(0xdead2, 14, [[-16, -6, 1.2]], 52)];
}

function graveRows(): RiftProp[] {
  const r = rng(0x5eed2b), props: RiftProp[] = [];
  for (let row = 0; row < 9; row++) {
    const z = -26 + row * 6.3 + (r() - .5) * 1.5, tilt = (r() - .5) * .25;
    for (let i = 0; i < 22; i++) {
      const x = -30 + i * 2.8 + (r() - .5) * 1.2, zz = z + x * tilt + (r() - .5) * .8;
      if (!clearOf(x, zz, 4.2) || r() < .18) continue;
      const kind = r();
      if (kind < .62) props.push(prop('sword', x, zz, (r() - .5) * .6, .3, .1, 1.3 + r() * 1, false, true, r()));
      else if (kind < .9) props.push(prop('grave', x, zz, (r() - .5) * .4, .9, .3, 1 + r() * .6, false, true, r()));
      else props.push(prop('stake', x, zz, r() * 6, .5, .5, 2.4, false, false, r()));
    }
  }
  return props;
}

function fortress(): RiftProp[] {
  const r = rng(0x5eed3), props: RiftProp[] = [];
  for (const [x, z] of [[-26, -26], [26, -26], [-26, 26], [26, 26]]) props.push(prop('tower', x, z, 0, 7, 7, 18, true, false, r()));
  for (const side of [-1, 1]) for (const t of [-12, 12]) {
    props.push(prop('wall', side * 29, t, Math.PI / 2, 6, 3, 9, true, false, r()));
    props.push(prop('wall', t, side * 29, 0, 6, 3, 9, true, false, r()));
  }
  props.push(prop('statue', 0, 12, Math.PI, 3.6, 3.6, 8, true, false, r(), true));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = Math.sin(a) * 18, z = Math.cos(a) * 18; if (clearOf(x, z, 5)) props.push(prop('pillar', x, z, 0, 1.8, 1.8, 7, true, false, r(), true)); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .3, x = Math.sin(a) * 10, z = Math.cos(a) * 10 + 4; if (clearOf(x, z, 4)) props.push(prop('brazier', x, z, 0, 1, 1, 1.6, true, false, r(), true)); }
  for (let i = 0; i < 34; i++) {
    const x = (r() - .5) * 50, z = (r() - .5) * 50;
    if (!clearOf(x, z, 5)) continue;
    const roll = r();
    const kind: RiftPropKind = roll < .3 ? 'crate' : roll < .55 ? 'barrel' : roll < .7 ? 'cage' : roll < .85 ? 'banner' : 'stake';
    const size = { crate: [1.1, 1.1, 1.1], barrel: [.8, .8, 1], cage: [1.6, 1.6, 2.2], banner: [.4, .4, 3.4], stake: [.5, .5, 2.6] }[kind as 'crate'];
    props.push(prop(kind, x, z, r() * Math.PI * 2, size[0], size[1], size[2], false, kind !== 'banner', r()));
  }
  return [...props, ...siegeWreck(), ...theDead(0xdead3, 16, [[-18, 2, Math.PI / 2], [18, -4, Math.PI / 2], [5, -21, 0]], 48)];
}

function siegeWreck(): RiftProp[] {
  const r = rng(0x5eed3b), props: RiftProp[] = [];
  for (let i = 0; i < 16; i++) {
    const x = -22 + i * 2.9, z = -12 + Math.sin(i * .7) * 2 + (r() - .5);
    if (!clearOf(x, z, 4.5) || r() < .25) continue;
    props.push(prop(r() < .5 ? 'fence' : 'crate', x, z, (r() - .5) * .5, 2.8, .4, 1.3, false, true, r()));
  }
  for (let i = 0; i < 26; i++) {
    const side = i % 4, t = (r() - .5) * 44, x = side === 0 ? -25 + r() * 2 : side === 1 ? 25 - r() * 2 : t, z = side === 2 ? -25 + r() * 2 : side === 3 ? 25 - r() * 2 : t;
    const roll = r(), kind: RiftPropKind = roll < .3 ? 'cart' : roll < .6 ? 'crate' : roll < .8 ? 'barrel' : 'cage';
    const size = { cart: [2.4, 1.4, 1.4], crate: [1.1, 1.1, 1.1], barrel: [.8, .8, 1], cage: [1.6, 1.6, 2.2] }[kind as 'cart'];
    props.push(prop(kind, x, z, r() * Math.PI * 2, size[0], size[1], size[2], false, true, r()));
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .2, x = Math.sin(a) * 22.5, z = Math.cos(a) * 22.5; if (clearOf(x, z, 5)) props.push(prop('brazier', x, z, 0, 1, 1, 1.6, true, false, r(), true)); }
  return props;
}

function eclipse(): RiftProp[] {
  const r = rng(0x5eed4), props: RiftProp[] = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = Math.sin(a) * 21, z = Math.cos(a) * 21;
    if (!clearOf(x, z, 4)) continue;
    props.push(prop('stone', x, z, a, .8, .8, 5 + r() * 3, true, false, r(), true));
  }
  props.push(prop('altar', 0, 7, 0, 5, 5, 1.4, true, false, r(), true));
  for (let i = 0; i < 46; i++) {
    const x = (r() - .5) * 58, z = (r() - .5) * 58;
    if (!clearOf(x, z, 4)) continue;
    const roll = r();
    const kind: RiftPropKind = roll < .45 ? 'bones' : roll < .7 ? 'stake' : roll < .85 ? 'rock' : 'grave';
    const size = { bones: [1.4, 1.4, .5], stake: [.5, .5, 2.8], rock: [1.4, 1.2, .9], grave: [.9, .3, 1.2] }[kind as 'bones'];
    props.push(prop(kind, x, z, r() * Math.PI * 2, size[0], size[1], size[2], false, kind !== 'stake', r()));
  }
  return [...props, ...theDead(0xdead4, 24, [], 56)];
}


function frost(): RiftProp[] {
  const r = rng(0x5eed5), props: RiftProp[] = [];
  props.push(prop('shrine', 0, 22, Math.PI, 11, 7, 7.5, true, false, r()));
  for (const z of [-19, -8, 3, 13]) props.push(prop('torii', 0, z, 0, 5.2, .7, 5.4, false, false, r()));
  for (let i = 0; i < 7; i++) for (const side of [-1, 1]) {
    const z = -22 + i * 6.2, x = side * (4.2 + r() * .6);
    if (clearOf(x, z, 3.2)) props.push(prop('lantern', x, z, r() * .4, .8, .8, 1.9, false, true, r()));
  }
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2 + (r() - .5) * .3, radius = 20 + r() * 7, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    if (!clearOf(x, z, 5) || (Math.abs(x) < 7 && z > 12)) continue;
    props.push(prop('ice', x, z, r() * Math.PI * 2, 2 + r() * 1.6, 2 + r() * 1.6, 3 + r() * 3.5, true, false, r(), true));
  }
  for (let i = 0; i < 8; i++) {
    const a = r() * Math.PI * 2, radius = 11 + r() * 16, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    if (clearOf(x, z, 6) && Math.abs(x) > 6) props.push(prop('tree', x, z, r() * Math.PI * 2, 1.2, 1.2, 7 + r() * 3, true, false, r(), true));
  }
  for (let i = 0; i < 38; i++) {
    const x = (r() - .5) * 56, z = (r() - .5) * 56;
    if (!clearOf(x, z, 4) || Math.abs(x) < 5.5) continue;
    const roll = r(), kind: RiftPropKind = roll < .45 ? 'grave' : roll < .62 ? 'lantern' : roll < .8 ? 'crate' : roll < .9 ? 'barrel' : 'stake';
    const size = { grave: [.9, .3, 1.1], lantern: [.8, .8, 1.9], crate: [1, 1, 1], barrel: [.8, .8, 1], stake: [.5, .5, 2.6] }[kind as 'grave'];
    props.push(prop(kind, x, z, r() * Math.PI * 2, size[0], size[1], size[2] + (kind === 'grave' ? r() * .5 : 0), false, kind !== 'stake', r()));
  }
  return [...props, ...theDead(0xdead5, 16, [[-15, -3, 1.1]], 50)];
}

function grove(): RiftProp[] {
  const r = rng(0x5eed6), props: RiftProp[] = [];
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + (r() - .5) * .2, radius = 21 + r() * 8, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    if (!clearOf(x, z, 5)) continue;
    props.push(prop('bamboo', x, z, r() * Math.PI * 2, 2.2 + r() * 1.4, 2.2 + r() * 1.4, 9 + r() * 5, true, false, r(), true));
  }
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2, radius = 9 + r() * 8, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    if (clearOf(x, z, 6)) props.push(prop('bamboo', x, z, r() * Math.PI * 2, 1.6 + r(), 1.6 + r(), 8 + r() * 4, true, false, r(), true));
  }
  props.push(prop('shrine', -15, 15, Math.PI * .75, 7, 5.5, 6, true, false, r()));
  props.push(prop('torii', -9, 8.5, Math.PI * .75, 4.6, .6, 4.8, false, false, r()));
  for (let i = 0; i < 16; i++) {
    const x = (r() - .5) * 46, z = (r() - .5) * 46;
    if (clearOf(x, z, 4)) props.push(prop('lantern', x, z, r() * 6, .8, .8, 1.9, false, true, r()));
  }
  for (let i = 0; i < 34; i++) {
    const x = (r() - .5) * 54, z = (r() - .5) * 54;
    if (!clearOf(x, z, 4)) continue;
    const roll = r(), kind: RiftPropKind = roll < .32 ? 'stake' : roll < .55 ? 'grave' : roll < .75 ? 'rock' : roll < .88 ? 'bones' : 'fence';
    const size = { stake: [.5, .5, 2.8], grave: [.9, .3, 1.1], rock: [1.4, 1.2, .9], bones: [1.4, 1.4, .5], fence: [3, .3, 1.1] }[kind as 'stake'];
    props.push(prop(kind, x, z, r() * Math.PI * 2, size[0], size[1], size[2], false, kind !== 'stake', r()));
  }
  return [...props, ...theDead(0xdead6, 18, [[14, -12, .7]], 50)];
}

function wastes(): RiftProp[] {
  const r = rng(0x5eed7), props: RiftProp[] = [];
  props.push(prop('ribs', 0, 13, Math.PI / 2, 16, 11, 11, false, false, r()));
  props.push(prop('skull', 0, 26, Math.PI, 7, 6, 5.5, true, false, r()));
  props.push(prop('ribs', -19, -14, .6, 11, 8, 8, false, false, r()));
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + (r() - .5) * .4, radius = 17 + r() * 11, x = Math.sin(a) * radius, z = Math.cos(a) * radius;
    if (!clearOf(x, z, 6) || Math.hypot(x, z - 16) < 11 || Math.hypot(x + 19, z + 14) < 8) continue;
    props.push(prop('rock', x, z, r() * Math.PI * 2, 2.6 + r() * 2.6, 2.4 + r() * 2.4, 2.4 + r() * 4.5, true, false, r(), true));
  }
  for (let i = 0; i < 4; i++) { const a = i * 1.7 + .4, x = Math.sin(a) * 13, z = Math.cos(a) * 13 - 4; if (clearOf(x, z, 5)) props.push(prop('pyre', x, z, r() * 3, 2.6, 2.6, 2.2, true, false, r(), true)); }
  for (let i = 0; i < 52; i++) {
    const x = (r() - .5) * 60, z = (r() - .5) * 60;
    if (!clearOf(x, z, 4)) continue;
    const roll = r(), kind: RiftPropKind = roll < .45 ? 'bones' : roll < .64 ? 'sword' : roll < .8 ? 'stake' : roll < .92 ? 'grave' : 'cage';
    const size = { bones: [1.4, 1.4, .5], sword: [.3, .1, 1.6], stake: [.5, .5, 2.8], grave: [.9, .3, 1.2], cage: [1.6, 1.6, 2.2] }[kind as 'bones'];
    props.push(prop(kind, x, z, r() * Math.PI * 2, size[0], size[1], size[2] + (kind === 'sword' ? r() * .8 : 0), false, kind !== 'stake', r()));
  }
  return [...props, ...theDead(0xdead7, 22, [[20, 6, -.4]], 56)];
}

function harbor(): RiftProp[] {
  const r = rng(0x5eed8), props: RiftProp[] = [];
  for (const x of [-19, 0, 19]) props.push(prop('pier', x, 22, 0, 4, 20, .5, false, false, r()));
  props.push(prop('hull', -21, 5, .4, 13, 5.5, 5, true, false, r()));
  props.push(prop('hull', 20, -13, -.7, 12, 5, 4.6, true, false, r()));
  for (const [x, z, h] of [[-15, 9, 12], [15, -9, 10], [-6, 17, 9], [24, 8, 11], [-25, -18, 8]] as const) if (clearOf(x, z, 4)) props.push(prop('mast', x, z, r() * 6, .7, .7, h + r() * 3, true, false, r(), true));
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + .35, x = Math.sin(a) * 16.5, z = Math.cos(a) * 16.5; if (clearOf(x, z, 5)) props.push(prop('brazier', x, z, 0, 1.3, 1.3, 1.6, true, false, r(), true)); }
  for (let i = 0; i < 48; i++) {
    const x = (r() - .5) * 56, z = (r() - .5) * 52 - 2;
    if (!clearOf(x, z, 4.5)) continue;
    const roll = r(), kind: RiftPropKind = roll < .3 ? 'crate' : roll < .56 ? 'barrel' : roll < .7 ? 'cart' : roll < .82 ? 'cage' : roll < .92 ? 'fence' : 'rock';
    const size = { crate: [1.1, 1.1, 1.1], barrel: [.8, .8, 1], cart: [2.4, 1.4, 1.4], cage: [1.6, 1.6, 2.2], fence: [3, .3, 1.1], rock: [1.4, 1.2, .9] }[kind as 'crate'];
    props.push(prop(kind, x, z, r() * Math.PI * 2, size[0], size[1], size[2], false, true, r()));
  }
  return [...props, ...theDead(0xdead8, 20, [[-4, -20, 0], [9, 12, 1.4]], 52)];
}

const LAYOUTS = new Map<StageId, RiftLayout>();
export function riftLayout(stage: StageId): RiftLayout {
  let layout = LAYOUTS.get(stage);
  if (!layout) {
    const build: Partial<Record<StageId, () => RiftProp[]>> = { 'rift-village': village, 'rift-swords': swords, 'rift-fortress': fortress, 'rift-eclipse': eclipse,
      'rift-frost': frost, 'rift-grove': grove, 'rift-wastes': wastes, 'rift-harbor': harbor };
    const props = build[stage]?.() ?? [];
    layout = { stage, props };
    LAYOUTS.set(stage, layout);
  }
  return layout;
}

export function propBox(p: RiftProp) {
  if (p.round) return { x: p.x, y: p.h / 2, z: p.z, halfX: p.w / 2, halfY: p.h / 2, halfZ: p.w / 2 };
  const c = Math.abs(Math.cos(p.rot)), s = Math.abs(Math.sin(p.rot));
  return { x: p.x, y: p.h / 2, z: p.z, halfX: (p.w * c + p.d * s) / 2, halfY: p.h / 2, halfZ: (p.w * s + p.d * c) / 2 };
}
