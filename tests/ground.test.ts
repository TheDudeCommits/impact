import fs from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { STAGES, type StageId } from '../src/game/stages';
import { propColliders } from '../src/game/stageProps';
import { GROUND_DECISIONS, GROUNDS } from '../src/render/ground';
import { GROUND_TIERS } from '../src/render/ground/quality';
import { box, circle, DENSITY, FLOWERS, GroundField, HEIGHT, path, SPARE, spawnSeats, TerrainField, valueNoise } from '../src/render/ground/mask';
import { clumpGeometry, GrassField, grassRings, PRESS_POINTS, pressPoints, ringCapacity } from '../src/render/ground/grass';
import { FlowerField } from '../src/render/ground/flowers';
import { GroundFrame } from '../src/render/ground/frame';
import { ClumpGrid, CLUMP_ROW } from '../src/render/ground/clumps';
import { coverGeometry } from '../src/render/ground/cover';
import { groundMaterial } from '../src/render/ground/toon';
import { shaderPatchKeys } from '../src/render/look/shaderPatch';
import { coverStage } from '../src/render/CameraCutaway';
import { CHUNIN_GROUND, CHUNIN_PATHS } from '../src/render/ground/places/chuninFinal';
import { cornerLawn, KAMI_CORNERS, kamiBeds } from '../src/render/ground/places/kamiLookout';
import { TOURNAMENT_FIELD, TOURNAMENT_GROUND, TOURNAMENT_PIECES } from '../src/render/ground/places/martialArtsTournament';
import { TOURNAMENT_MASTS } from '../src/render/stages/martialArtsTournament';
import { SandPrints } from '../src/render/ground/sand';
import { LitterField, leafGeometry } from '../src/render/ground/litter';
import { chuninLitter } from '../src/render/ground/places/chuninFinal';
import { CHUNIN_OWN_TREES } from '../src/render/stages/chuninFinal';
import { treeRing } from '../src/render/stages/chuninFinal';
import { underlay, type GroundContext } from '../src/render/ground/build';

describe('the ground registry', () => {
  it('has a decision, with its reason, for every place of the main game', () => {
    const places = (Object.keys(STAGES) as StageId[]).filter(s => !s.startsWith('rift-') && s !== 'hidden-leaf' && s !== 'blood-citadel');
    expect(Object.keys(GROUND_DECISIONS).sort()).toEqual(places.sort());
    for (const [stage, d] of Object.entries(GROUND_DECISIONS)) expect(d.why.length, stage).toBeGreaterThan(20);
    for (const stage of Object.keys(GROUNDS) as StageId[]) expect(GROUND_DECISIONS[stage as keyof typeof GROUND_DECISIONS].ground.length, stage).toBeGreaterThan(0);
  });

  it('loads each place\'s plan on its own, and lays it from the place-building hook', async () => {
    for (const [stage, load] of Object.entries(GROUNDS)) {
      const plan = await load!();
      expect(plan.grass?.length || plan.water || plan.sand, stage).toBeTruthy();
    }
    const environment = fs.readFileSync('src/render/StageEnvironment.ts', 'utf8');
    expect(environment).toContain('await dressGround(stage, root, gltf.scene);');
  });
});

describe('quality tiers', () => {
  const work = (q: 'high' | 'medium' | 'low') => grassRings(GROUND_TIERS[q]).reduce((n, r) => {
    const area = Math.PI * (r.fadeOut[1] ** 2 - r.fadeIn[0] ** 2);
    return n + area / (r.cell * r.cell) * clumpGeometry(r.blades, r.segments, 1, 1).getAttribute('position').count;
  }, 0);
  it('cut what they draw: medium about half of high, low no blades at all and still water', () => {
    expect(work('medium')).toBeLessThan(work('high') * .6);
    expect(work('medium')).toBeGreaterThan(work('high') * .25);
    expect(work('low')).toBe(0);
    expect(GROUND_TIERS.low.water.sim).toBe(false);
    const waves = (q: 'high' | 'medium') => GROUND_TIERS[q].water.rate / GROUND_TIERS[q].water.cell ** 2;
    expect(waves('medium')).toBeLessThan(waves('high') * .6);
    expect(waves('medium')).toBeGreaterThan(waves('high') * .35);
    expect(GROUND_TIERS.medium.decals).toBeLessThan(GROUND_TIERS.high.decals);
  });

  it('hand each ring over to the next across its fade, out to the tier\'s reach', () => {
    for (const q of ['high', 'medium'] as const) {
      const rings = grassRings(GROUND_TIERS[q]);
      expect(rings[0].fadeIn).toEqual([0, 0]);
      for (let k = 1; k < rings.length; k++) {
        expect(rings[k].fadeIn, `${q} ring ${k}`).toEqual(rings[k - 1].fadeOut);
        expect(rings[k].cell).toBeGreaterThan(rings[k - 1].cell);
      }
      expect(rings.at(-1)!.fadeOut[1]).toBe(GROUND_TIERS[q].reach);
      for (const r of rings) expect(ringCapacity(r)).toBeGreaterThan(100);
    }
  });
});

describe('a quality change while the place is up', () => {
  it('rebuilds the rings for the new tier, and leaves no blades and no flowers on low', () => {
    const frame = new GroundFrame(), field = new GroundField({ x0: -20, z0: -20, x1: 20, z1: 20 }, .5).fill(DENSITY, 1).fill(HEIGHT, 1).fill(FLOWERS, 1);
    const grass = new GrassField(frame, { cpu: field, floor: 0, region: { x0: -10, z0: -10, x1: 10, z1: 10 } }, { height: .4, root: 0x224422, cool: 0x339966, warm: 0x77bb55 });
    const flowers = new FlowerField(frame, { cpu: field, region: { x0: -10, z0: -10, x1: 10, z1: 10 }, baseY: 0 }, .4, { colors: [0xffffff] });
    const rings = () => grass.root.children.length;
    expect(rings()).toBe(grassRings(GROUND_TIERS.high).length);
    grass.setQuality(GROUND_TIERS.medium); flowers.setQuality(GROUND_TIERS.medium);
    expect(rings()).toBe(2); expect(flowers.mesh.visible).toBe(true);
    grass.setQuality(GROUND_TIERS.low); flowers.setQuality(GROUND_TIERS.low);
    expect(rings()).toBe(0); expect(flowers.mesh.visible).toBe(false);
    grass.setQuality(GROUND_TIERS.high); flowers.setQuality(GROUND_TIERS.high);
    expect(rings()).toBe(3); expect(flowers.mesh.visible).toBe(true);
    grass.dispose(); flowers.dispose();
  });
});

describe('culling the clumps to the lens', () => {
  const lens = (x: number, z: number, toward: [number, number]) => {
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, .1, 400);
    camera.position.set(x, 3, z); camera.lookAt(toward[0], 0, toward[1]); camera.updateMatrixWorld(true);
    return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  };
  const grid = (capacity = 20000) => new ClumpGrid({ region: { x0: -30, z0: -30, x1: 30, z1: 30 }, cell: .5, block: 4, salt: 3, capacity, top: .5,
    clump: (x, _z, h1) => x > 20 ? 0 : h1 < .8 ? 1 : 0, floor: () => .05 });
  const slots = (g: ClumpGrid) => (g.texture.image as { data: Float32Array }).data;

  it('lays out a clump per cell where the mask has grass, and only there', () => {
    const g = grid();
    expect(g.count).toBeGreaterThan(50 * 60 * 4 * .7); expect(g.count).toBeLessThan(50 * 60 * 4 * .9);
    for (let k = 0; k < g.count * 5; k += 5) { expect(g.data[k]).toBeLessThanOrEqual(20.5); expect(g.data[k + 1]).toBeCloseTo(.05, 6); }
  });

  it('draws only the clumps in the lens\'s view and in the band, nearest blocks first, and writes them for the shader', () => {
    const g = grid(), frustum = lens(0, 0, [0, -10]);
    const n = g.cull(0, 0, frustum, { fadeIn: [0, 0], fadeOut: [10, 12] }, 'grass', .5);
    expect(n).toBeGreaterThan(100);
    const data = slots(g);
    let last = 0, ordered = 0;
    for (let i = 0; i < n; i++) {
      const x = data[i * 4], z = data[i * 4 + 2], d = Math.hypot(x, z);
      expect(z).toBeLessThan(1.5); expect(d).toBeLessThanOrEqual(12);
      expect(Math.abs(x)).toBeLessThan(Math.abs(z) * 1.1 + 2.5);
      if (d + 6 >= last) ordered++; last = Math.max(last, d);
      expect(data[i * 4 + 3]).toBeGreaterThan(0); expect(data[i * 4 + 3]).toBeLessThanOrEqual(1);
    }
    expect(ordered / n).toBeGreaterThan(.95);
    const behind = g.cull(0, 0, lens(0, 0, [0, 10]), { fadeIn: [0, 0], fadeOut: [10, 12] }, 'grass', .5);
    expect(behind).toBeGreaterThan(100);
    expect(slots(g)[2]).toBeGreaterThan(-1.5);
    const all = g.data.length / 5;
    expect(n).toBeLessThan(all * Math.PI * 12 * 12 / (60 * 60) * .5);
  });

  it('hands a ring over through its fade: clumps in the fade band shrink, and fewer of them show', () => {
    const g = grid(), frustum = lens(0, 0, [0, -10]);
    const n = g.cull(0, 0, frustum, { fadeIn: [4, 6], fadeOut: [10, 12] }, 'grass', .5), data = slots(g);
    let inFade = 0, small = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(data[i * 4], data[i * 4 + 2]);
      expect(d).toBeGreaterThanOrEqual(4);
      if (d < 6 || d > 10) { inFade++; if (data[i * 4 + 3] < .99) small++; }
    }
    expect(inFade).toBeGreaterThan(0); expect(small).toBeGreaterThan(0);
  });

  it('stops at its capacity, keeping the nearest, and uploads only the rows it wrote', () => {
    const g = grid(10);
    expect(g.capacity).toBe(CLUMP_ROW);
    const n = g.cull(0, 0, lens(0, 0, [0, -10]), { fadeIn: [0, 0], fadeOut: [28, 30] }, 'grass', .5);
    expect(n).toBe(CLUMP_ROW);
    expect(g.texture.updateRanges).toEqual([{ start: 0, count: CLUMP_ROW * 4 }]);
    const data = slots(g);
    expect(Math.hypot(data[0], data[2])).toBeLessThan(6);
    g.dispose();
  });
});

describe('a grass field', () => {
  it('builds clumps of tapering blades rooted round their middle', () => {
    const g = clumpGeometry(7, 3, 1, 1);
    expect(g.getAttribute('position').count).toBe(7 * (3 * 2 + 1));
    expect(g.index!.count / 3).toBe(7 * (3 * 2 - 1));
    expect(g.getAttribute('lookHead').count).toBe(g.getAttribute('position').count);
    const y = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < y.count; i++) expect(y.getY(i)).toBeGreaterThanOrEqual(0), expect(y.getY(i)).toBeLessThanOrEqual(1);
  });

  it('is pressed by the fighters standing in it - wider under a body down in it - and by nobody in the air', () => {
    const out = Array.from({ length: PRESS_POINTS }, () => new THREE.Vector4(9, 9, 9, 9));
    pressPoints([
      { x: 1, y: 0, z: 2, hx: 1, hy: 1, hz: 2 },
      { x: -3, y: 0, z: 0, hx: -3.8, hy: .25, hz: .4 },
      { x: 5, y: 3, z: 5, hx: 5, hy: 4, hz: 5 },
    ], out);
    expect(out[0].toArray()).toEqual([1, 0, 2, .62]);
    expect(out[1].toArray()).toEqual([-3, 0, 0, .62]);
    expect(out[2].x).toBe(-3.8); expect(out[2].w).toBeGreaterThan(out[1].w);
    for (let k = 3; k < out.length; k++) expect(out[k].w).toBe(0);
  });

  it('is lit by the fighters\' cel shading, and passes the camera cutaway by', () => {
    const material = groundMaterial('test blades', 'ground-test-v1', () => {});
    const keys = shaderPatchKeys(material);
    expect(keys.some(k => k.startsWith('look-toon-')), keys.join()).toBe(true);
    expect(keys.at(-1)).toBe('ground-test-v1');
    const root = new THREE.Group(), scene = new THREE.Scene();
    root.add(new THREE.Mesh(new THREE.BufferGeometry(), material)); scene.add(root);
    expect(coverStage([root.children[0]])).toBe(0);
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: THREE.ShaderLib.toon.vertexShader, fragmentShader: THREE.ShaderLib.toon.fragmentShader, defines: {} };
    material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).not.toContain('cutDither');
    expect(shader.uniforms.uLookSilhouette.value).toBe(0);
    expect(shader.uniforms.uRimPeak.value).toBe(0);
    material.dispose();
  });
});

describe('the ground\'s tick', () => {
  it('runs once a frame from the scene\'s own hook, before the passes, while the ground is shown', () => {
    const frame = new GroundFrame(), scene = new THREE.Scene(), group = new THREE.Group(), camera = new THREE.PerspectiveCamera();
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    group.add(mesh); scene.add(group); frame.watch(group); frame.drive(mesh);
    let ticks = 0;
    frame.add({ tick: () => { ticks++; } });
    const renderer = { info: { autoReset: false, render: { frame: 1 } } } as unknown as THREE.WebGLRenderer;
    const draw = () => mesh.onBeforeRender(renderer, scene, camera, mesh.geometry, mesh.material as THREE.Material, null as unknown as THREE.Group);
    const before = () => scene.onBeforeRender(renderer, scene, camera, null as unknown as THREE.BufferGeometry, null as unknown as THREE.Material, null as unknown as THREE.Group);
    draw(); expect(ticks).toBe(1);
    renderer.info.render.frame++; before(); draw(); draw(); expect(ticks).toBe(2);
    renderer.info.render.frame++; group.visible = false; before(); expect(ticks).toBe(2);
    group.visible = true;
    frame.detach(); renderer.info.render.frame++; before(); expect(ticks).toBe(2);
  });
});

describe('the floor under an opaque sheet', () => {
  it('is earth, never the sky: a plain plane just under the sheet, out past the field, that the cutaway never dithers', () => {
    const rect = { x0: -76, z0: -76, x1: 76, z1: 76 }, mesh = underlay(rect, .051, 0x766a5c, 'test underlay');
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox!;
    expect(b.max.y).toBeLessThan(.051); expect(b.min.y).toBeGreaterThan(-.05);
    expect(b.min.x).toBeLessThan(rect.x0); expect(b.max.z).toBeGreaterThan(rect.z1);
    const root = new THREE.Group(); root.add(mesh); new THREE.Scene().add(root);
    expect(coverStage([mesh])).toBe(0);
    mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
  });
});

describe('ground masks', () => {
  it('paint shapes with feathered edges and read back bilinearly', () => {
    const field = new GroundField({ x0: -10, z0: -10, x1: 10, z1: 10 }, .25);
    field.paint(DENSITY, circle(0, 0, 5), 1, 'set', 1);
    expect(field.sample(DENSITY, 0, 0)).toBeCloseTo(1, 5);
    expect(field.sample(DENSITY, 8, 0)).toBe(0);
    expect(field.sample(DENSITY, 5, 0)).toBeGreaterThan(.3); expect(field.sample(DENSITY, 5, 0)).toBeLessThan(.7);
    field.paint(DENSITY, box(0, 0, 1, 2, Math.PI / 2), 0, 'min', .2);
    expect(field.sample(DENSITY, 1.5, 0)).toBeLessThan(.05);
    expect(field.sample(DENSITY, 0, 1.6)).toBeGreaterThan(.9);
    field.paint(DENSITY, path([[-9, -9], [9, -9]], 1), .5, 'max', .2);
    expect(field.sample(DENSITY, 0, -9)).toBeCloseTo(.5, 1);
    expect(field.share(DENSITY, .5)).toBeGreaterThan(.15);
    const bytes = field.bytes();
    expect(bytes.length).toBe(field.width * field.height * 4);
  });

  it('bake a floor\'s height from the place\'s triangles, keeping the highest that faces up', () => {
    const t = new TerrainField({ x0: 0, z0: 0, x1: 10, z1: 10 }, 1, -5);
    const laid = t.lay([[0, 1, 0, 10, 1, 0, 0, 1, 10], [0, 2, 0, 10, 2, 0, 0, 2, 10], [0, 0, 0, 0, 9, 0, 0, 0, 10]]);
    expect(laid).toBeGreaterThan(30);
    expect(t.sample(2, 2)).toBeCloseTo(2, 5);
    expect(t.sample(9.5, 9.5)).toBe(-5);
    const noise = valueNoise(3);
    expect(noise(1.5, 2.5)).toBeCloseTo(valueNoise(3)(1.5, 2.5), 10);
  });

  it('mirror the royale\'s seats (simulation.ts safeSpawn): twelve on the spawn ellipse, inside the bounds', () => {
    for (const stage of ['chunin-final', 'valley-of-the-end', 'kami-lookout'] as const) {
      const { halfX, halfZ, spawnRadius } = STAGES[stage], seats = spawnSeats(stage);
      expect(seats).toHaveLength(12);
      for (const [x, z] of seats) {
        expect(Math.abs(x)).toBeLessThan(halfX); expect(Math.abs(z)).toBeLessThan(halfZ);
        expect(Math.hypot(x / Math.min(spawnRadius, halfX - .9), z / Math.min(spawnRadius * halfZ / halfX, halfZ - .9))).toBeCloseTo(1, 5);
      }
    }
  });
});

describe('the Chūnin Exam Arena\'s field', () => {
  const field = () => {
    const plan = CHUNIN_GROUND.grass![0], f = new GroundField(plan.rect, plan.texel ?? .5);
    plan.paint(f, {} as GroundContext);
    return f;
  };
  it('is grass across most of the stadium floor, worn to earth along its tracks, at the props\' feet and on the seats', () => {
    const f = field();
    let grown = 0, n = 0;
    for (let z = -70; z <= 70; z += 2) for (let x = -70; x <= 70; x += 2) if (Math.hypot(x, z) < 70) { n++; if (f.sample(DENSITY, x, z) > .5) grown++; }
    expect(grown / n).toBeGreaterThan(.55);
    expect(grown / n).toBeLessThan(.9);
    for (const track of CHUNIN_PATHS) for (let k = 0; k + 1 < track.length; k++) {
      const [x0, z0] = track[k], [x1, z1] = track[k + 1];
      if (Math.hypot(x0, z0) > 70) continue;
      expect(f.sample(DENSITY, (x0 + x1) / 2, (z0 + z1) / 2), `track at ${x0},${z0}`).toBeLessThan(.2);
    }
    for (const c of propColliders('chunin-final')) expect(f.sample(DENSITY, c.x, c.z)).toBeLessThan(.05);
    for (const [x, z] of spawnSeats('chunin-final')) expect(f.sample(DENSITY, x, z)).toBeLessThan(.3);
    expect(f.sample(SPARE, 0, 0)).toBeCloseTo(1, 3);
    expect(f.sample(SPARE, 74, 0)).toBeGreaterThan(.9);
    expect(f.share(FLOWERS, .5)).toBeGreaterThan(.05); expect(f.share(FLOWERS, .5)).toBeLessThan(.5);
  });

  it('stands knee-high at most: no blade over 0.7 m', () => {
    const f = field(), look = CHUNIN_GROUND.grass![0].look;
    let tallest = 0;
    for (let z = -70; z <= 70; z += 1) for (let x = -70; x <= 70; x += 1) tallest = Math.max(tallest, f.sample(HEIGHT, x, z));
    expect(look.height * tallest * 1.28).toBeLessThan(.7);
    expect(look.height * tallest * 1.28).toBeGreaterThan(.5);
  });

  it('lays its own ground sheet over the floor wherever the field reaches', () => {
    const f = field(), g = coverGeometry(f, .05, 1.5, SPARE);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x).toBeGreaterThan(74);
    expect(g.boundingBox!.min.y).toBeCloseTo(.065, 3);
    expect(g.index!.count / 6).toBeGreaterThan(Math.PI * 70 * 70 / 2.25 * .9);
  });

  it('frames the fight with trees whose trunks stand out of reach, inside the wall', () => {
    const spots = treeRing();
    expect(spots.length).toBeGreaterThanOrEqual(12);
    for (const s of spots) {
      expect(Math.max(Math.abs(s.x), Math.abs(s.z)), `${s.x},${s.z}`).toBeGreaterThanOrEqual(STAGES['chunin-final'].halfX + 1.8 - 1e-6);
      expect(Math.hypot(s.x, s.z) + 7.2 * s.scale * .8).toBeLessThanOrEqual(77.4);
    }
    const angles = spots.map(s => (Math.atan2(s.x, s.z) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
    let widest = 0;
    for (let k = 0; k < angles.length; k++) widest = Math.max(widest, ((angles[(k + 1) % angles.length] - angles[k]) + Math.PI * 2) % (Math.PI * 2));
    expect(widest).toBeGreaterThan(.25);
    expect(widest).toBeLessThan(Math.PI / 2);
  });
});

describe('Kami\'s Lookout\'s gardens', () => {
  it('lays lawns in the four corners round the rim, never on the tiles the fight is held on', () => {
    const { inner, outer, half } = KAMI_CORNERS, flat = () => .5;
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) expect(cornerLawn(sx * 36, sz * 36, inner, outer, half, flat), `${sx},${sz}`).toBe(1);
    for (const [x, z] of [[50, 0], [-50, 0], [0, 50], [0, -50], [18, 18], [0, 0], [42, 42]]) expect(cornerLawn(x, z, inner, outer, half, flat), `${x},${z}`).toBe(0);
    for (let a = 0; a < Math.PI * 2; a += .2) expect(cornerLawn(Math.cos(a) * 30, Math.sin(a) * 30, inner, outer, half, flat)).toBe(0);
  });

  it('knows the gardens\' beds: the four in the south half and the rim\'s', () => {
    const beds = kamiBeds();
    expect(beds.filter(b => Math.hypot(b.x, b.z) < 45)).toHaveLength(4);
    expect(beds.length).toBeGreaterThan(8);
    for (const b of beds) expect(b.radius).toBeGreaterThan(1.2);
  });
});

describe('the World Martial Arts Tournament\'s lawn', () => {
  it('grows round the ring out to the wall, never on the ring, the competitors\' walk, or under stream E\'s pieces', () => {
    const plan = TOURNAMENT_GROUND.grass![0];
    const field = new GroundField(plan.rect, plan.texel ?? .5);
    plan.paint(field, {} as GroundContext);
    const at = (x: number, z: number) => field.sample(DENSITY, x, z);
    for (const [x, z] of [[22, 8], [-23, -8], [8, -22], [-10, 23], [20, 12], [27, 22], [-27, -21]]) expect(at(x, z), `${x},${z}`).toBeGreaterThan(.4);
    for (const [x, z] of [[0, 0], [12, -12], [-15, 15], [TOURNAMENT_FIELD.wall + 1.5, 0]]) expect(at(x, z), `${x},${z}`).toBeLessThan(.05);
    expect(at(0, 24)).toBeLessThan(.05);
    for (const [x, z] of TOURNAMENT_PIECES) expect(at(x, z), `${x},${z}`).toBeLessThan(.05);
    for (const [x, z] of TOURNAMENT_MASTS) expect(at(x, z), `${x},${z}`).toBeLessThan(.05);
    expect(plan.floor).toBe(TOURNAMENT_FIELD.level);
  });

  it('parts round every ringside piece stream E places with fixed coordinates (a moved piece fails here, not on the lawn)', () => {
    const source = fs.readFileSync('src/render/stages/martialArtsTournament.ts', 'utf8');
    const placed = [...source.matchAll(/kit\.place\('[^']+', \{ x: (-?[\d.]+), z: (-?[\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    expect(placed.length).toBeGreaterThan(4);
    for (const [x, z] of placed) expect(TOURNAMENT_PIECES.some(([px, pz, r]) => Math.hypot(px - x, pz - z) < r * .5), `${x},${z}`).toBe(true);
  });
});

describe('sand that takes footprints', () => {
  it('lays a print where a foot comes down, one per step (not a heap where a fighter shuffles), and none on low', () => {
    const frame = new GroundFrame();
    const prints = new SandPrints(frame, { name: 'test sand', rect: { x0: -10, z0: -10, x1: 10, z1: 10 }, level: 0 }, 64);
    const foot = (x: number, z: number) => ({ x, y: 0, z, down: true, speed: 0 });
    const body = { id: 'a', x: 0, y: 0, z: 0, vx: 0, vz: 0, yaw: 0, hx: 0, hy: 1, hz: 0, feet: [foot(0, 0), foot(.3, 0)] as [ReturnType<typeof foot>, ReturnType<typeof foot>], stepped: [true, true] as [boolean, boolean] };
    const tick = () => prints.tick({ bodies: [body], time: 1, dt: 1 / 60 } as unknown as Parameters<SandPrints['tick']>[0]);
    tick();
    expect(prints.laid).toBe(2);
    tick(); tick();
    expect(prints.laid).toBe(2);
    body.feet[0] = foot(0, .6); tick();
    expect(prints.laid).toBe(3);
    body.x = 30; body.feet[0] = foot(30, 2); tick();
    expect(prints.laid).toBe(3);
    prints.setQuality(GROUND_TIERS.low); body.x = 0; body.feet[1] = foot(2, 2); tick();
    expect(prints.laid).toBe(3);
    expect(prints.mesh.visible).toBe(false);
    prints.mesh.geometry.dispose(); (prints.mesh.material as THREE.Material).dispose();
  });
});

describe('fallen leaves', () => {
  it('lie where the place says, a share of them on every tier, culled to the lens', () => {
    const frame = new GroundFrame();
    const field = new GroundField({ x0: -20, z0: -20, x1: 20, z1: 20 }, .5);
    const litter = new LitterField(frame, { cpu: field, region: { x0: -10, z0: -10, x1: 10, z1: 10 }, floor: 0 }, { colors: [0x9a7642], where: x => x > 0 ? .5 : 0 }, 'test litter');
    const high = litter.count;
    expect(high).toBeGreaterThan(100);
    litter.setQuality(GROUND_TIERS.medium);
    expect(litter.count).toBeLessThan(high * .8); expect(litter.count).toBeGreaterThan(high * .4);
    litter.setQuality(GROUND_TIERS.low);
    expect(litter.count).toBeGreaterThan(0);
    expect(litter.count).toBeLessThan(high * .5);
    litter.dispose(); litter.mesh.geometry.dispose(); (litter.mesh.material as THREE.Material).dispose();
    const leaf = leafGeometry();
    expect(leaf.index!.count / 3).toBe(6);
    expect(leaf.getAttribute('position').getY(0)).toBeGreaterThan(0);
  });

  it('gathers on Chūnin\'s tracks and under its trees, and stays sparse in the open field', () => {
    const where = chuninLitter();
    const plan = CHUNIN_GROUND.grass![0];
    const field = new GroundField(plan.rect, plan.texel ?? .5);
    plan.paint(field, {} as GroundContext);
    const near = (x: number, z: number) => where(x, z, field);
    const [tx, tz] = CHUNIN_OWN_TREES[0];
    const sample = (f: (k: number) => number) => { let s = 0; for (let k = 0; k < 64; k++) s += f(k); return s / 64; };
    const underTree = sample(k => near(tx + Math.cos(k) * 2, tz + Math.sin(k) * 2));
    const onTrack = sample(k => near(8 + (k % 8) * .1, -10 + Math.floor(k / 8) * .5));
    expect(underTree).toBeGreaterThan(.25);
    expect(onTrack).toBeGreaterThan(.2);
    const open = sample(k => near(-30 + (k % 8) * 1.5, 18 + Math.floor(k / 8) * 1.5));
    expect(open).toBeLessThan(onTrack * .7);
  });
});
