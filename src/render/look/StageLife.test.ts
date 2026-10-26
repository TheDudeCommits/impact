import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { MAX_BEAMS, MAX_MOTES, STAGE_LIFE, StageLife } from './StageLife';
import { STAGES } from '../../game/stages';
import { lookFor } from './stageLooks';
import type { SkyDome } from './SkyDome';

type Parts = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[];
const make = () => {
  const sky = { setLife: vi.fn() } as unknown as SkyDome;
  const life = new StageLife(new THREE.Scene(), sky, { height: 900 } as HTMLCanvasElement);
  return { sky, life, parts: life.group.children as Parts };
};
const drawn = (life: StageLife) => {
  const [motes, shafts] = life.group.children as Parts;
  return {
    group: life.group.visible,
    motes: motes.visible ? (motes.geometry as THREE.InstancedBufferGeometry).instanceCount : 0,
    beams: shafts.visible ? shafts.geometry.drawRange.count / 6 : 0,
  };
};
const kami = STAGE_LIFE['kami-lookout']!;

describe('StageLife', () => {
  it('has entries only for real stages, inside the pools', () => {
    for (const [id, c] of Object.entries(STAGE_LIFE)) {
      expect(STAGES[id as keyof typeof STAGES], id).toBeTruthy();
      expect(c.motes?.count ?? 0).toBeLessThanOrEqual(MAX_MOTES);
      expect(c.shafts?.beams.length ?? 0).toBeLessThanOrEqual(MAX_BEAMS);
    }
    expect(kami).toBeTruthy();
  });

  it('draws nothing on a stage with no entry, and hands the sky back its own drift', () => {
    const { life, sky } = make();
    life.setStage('harbor', lookFor('harbor'));
    expect(drawn(life).group).toBe(false);
    expect(sky.setLife).toHaveBeenLastCalledWith(undefined);
  });

  it('scales the motes and shafts with quality and the effects slider', () => {
    const { life, sky } = make();
    life.setStage('kami-lookout', lookFor('kami-lookout'));
    expect(sky.setLife).toHaveBeenLastCalledWith(kami.clouds);
    life.setQuality('high', 1);
    expect(drawn(life)).toEqual({ group: true, motes: kami.motes!.count, beams: kami.shafts!.beams.length });
    life.setQuality('medium', 1);
    const medium = drawn(life);
    expect(medium.motes).toBeLessThan(kami.motes!.count);
    expect(medium.beams).toBe(6);
    life.setQuality('low', 1);
    const low = drawn(life);
    expect(low.motes).toBeGreaterThan(0);
    expect(low.motes).toBeLessThan(medium.motes);
    expect(low.beams).toBe(0);
    life.setQuality('high', 0);
    expect(drawn(life)).toMatchObject({ motes: 0, beams: 0 });
  });

  it('lays each shaft along the sun, from high over the arena down to just under the floor', () => {
    const { life, parts } = make();
    life.setStage('kami-lookout', lookFor('kami-lookout'));
    const u = parts[1].material.uniforms;
    const [x, z] = kami.shafts!.beams[0];
    const s = u.uBeamS.value[0] as THREE.Vector4, d = u.uBeamD.value[0] as THREE.Vector4;
    const sun = u.uSun.value as THREE.Vector3;
    const dir = new THREE.Vector3(d.x, d.y, d.z);
    const foot = new THREE.Vector3(s.x, s.y, s.z).addScaledVector(dir, (s.y - 0) / -dir.y);
    expect(s.y).toBeGreaterThan(20);
    expect(foot.x).toBeCloseTo(x, 3);
    expect(foot.y).toBeCloseTo(0, 3);
    expect(foot.z).toBeCloseTo(z, 3);
    expect(dir.dot(sun)).toBeCloseTo(-1, 5);
    expect(s.y + dir.y * d.w).toBeLessThan(0);
  });

  it('follows the camera, and goes dark with the room', () => {
    const { life, parts } = make();
    life.setStage('kami-lookout', lookFor('kami-lookout'));
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .08, 1500);
    camera.position.set(-3, 1.7, 5.5); camera.lookAt(5, 1, -10); camera.updateMatrixWorld();
    const focus = new THREE.Vector3(0, 0, 3);
    life.update(1, 1 / 60, camera, 0, focus);
    const [motes, shafts] = parts;
    const origin = motes.material.uniforms.uOrigin.value as THREE.Vector3;
    expect(origin.y).toBeCloseTo(kami.motes!.floor);
    expect(Math.hypot(origin.x + kami.motes!.box[0] / 2 - camera.position.x, origin.z + kami.motes!.box[2] / 2 - camera.position.z)).toBeLessThanOrEqual(kami.motes!.lead + 1e-6);
    expect(motes.material.uniforms.uPx.value).toBeGreaterThan(300);
    expect(shafts.visible).toBe(true);
    life.update(1.1, 1 / 60, camera, 1, focus);
    expect(shafts.visible).toBe(false);
    life.update(1.2, 1 / 60, camera, 0, focus);
    expect(shafts.visible).toBe(true);
    camera.position.set(0, 2, 400); camera.lookAt(0, 2, 500); camera.updateMatrixWorld();
    life.update(1.3, 1 / 60, camera, 0, focus);
    expect(shafts.visible).toBe(false);
  });
});
