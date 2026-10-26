import { describe, expect, it } from 'vitest';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import * as THREE from 'three';
import { VictimVeil, VEIL_GLSL, VEIL_LIGHT, installVeil, veilKeep, veilUniforms } from '../src/render/vfx/VictimVeil';
import { SparkField } from '../src/render/vfx/SparkField';
import { Beams } from '../src/render/vfx/Beams';
import type { Fighter } from '../src/render/Fighter';

const body = (id: string, action = 'idle', x = 0) => {
  const group = new THREE.Group(); group.position.set(x, 0, 0);
  return { state: { id, fighter: 'goku', action, alive: true, awakened: false }, group, velocity: new THREE.Vector3() } as unknown as Fighter;
};

describe('who is veiled, and when', () => {
  it('opens a beat after the blow, holds through the reaction, and lets go once they are up', () => {
    const veil = new VictimVeil(), victim = body('v', 'launched'), bystander = body('b', 'idle', 3);
    const bodies = new Map([['v', victim], ['b', bystander]]);
    veil.struck('v', 10, true);
    let t = 10;
    const step = (seconds: number) => { for (let n = 0; n < Math.round(seconds * 60); n++) { t += 1 / 60; veil.update(t, 1 / 60, bodies); } };
    step(DREAM_IMPACT ? .03 : .05);
    expect(veil.weight('v'), 'the hit itself lands unveiled').toBe(0);
    step(DREAM_IMPACT ? .22 : .2);
    expect(veil.weight('v')).toBe(1);
    step(1);
    expect(veil.weight('v'), 'held while they are down').toBe(1);
    expect(veil.weight('b'), 'nobody hit, nobody veiled').toBe(0);
    (victim.state as { action: string }).action = 'idle';
    step(.1);
    expect(veil.weight('v')).toBeGreaterThan(0);
    step(.4);
    expect(veil.weight('v')).toBe(0);
  });
  it('gives an ordinary blow VEIL_LIGHT of it, and a big one on the same body the whole of it until they are up', () => {
    const veil = new VictimVeil(), victim = body('v', 'hurt'), bodies = new Map([['v', victim]]);
    let t = 0;
    const step = (seconds: number) => { for (let n = 0; n < Math.round(seconds * 60); n++) { t += 1 / 60; veil.update(t, 1 / 60, bodies); } };
    veil.struck('v', 0); step(.3);
    expect(veil.weight('v'), 'a string blow').toBeCloseTo(VEIL_LIGHT, 5);
    veil.struck('v', t, true); (victim.state as { action: string }).action = 'launched'; step(.3);
    expect(veil.weight('v'), 'the launcher').toBe(1);
    veil.struck('v', t); step(.3);
    expect(veil.weight('v'), 'an air string blow on the thrown body').toBe(1);
    (victim.state as { action: string }).action = 'idle'; step(1.2);
    expect(veil.weight('v'), 'up again').toBe(0);
    (victim.state as { action: string }).action = 'hurt'; veil.struck('v', t); step(.3);
    expect(veil.weight('v'), 'the next string').toBeCloseTo(VEIL_LIGHT, 5);
  });
  it('spans the body soles to crown in the uniforms, and switches a spare slot off', () => {
    const veil = new VictimVeil(), victim = body('v', 'hurt');
    veil.struck('v', 0, true);
    for (let t = 0; t < .5; t += 1 / 60) veil.update(t, 1 / 60, new Map([['v', victim]]));
    const { uVeilA, uVeilB } = veilUniforms(0);
    expect(uVeilA.value[0].y).toBeLessThan(0);
    expect(uVeilB.value[0].y).toBeGreaterThan(1.9);
    expect(uVeilB.value[0].w).toBe(1);
    expect(uVeilB.value[1].w).toBe(0);
  });
});

describe('what is veiled', () => {
  const lens = new THREE.Vector3(0, 1.5, -5), a = new THREE.Vector3(0, 0, 0), b = new THREE.Vector3(0, 2, 0);
  it('an effect between the lens and the body, not one behind it or beside it', () => {
    expect(veilKeep(new THREE.Vector3(0, 1.2, -1), lens, a, b, .42, 1, .7), 'in front, over the chest').toBeCloseTo(.3, 5);
    expect(veilKeep(new THREE.Vector3(0, 1.2, 1.5), lens, a, b, .42, 1, .7), 'behind the body').toBe(1);
    expect(veilKeep(new THREE.Vector3(1.5, 1.2, -1), lens, a, b, .42, 1, .7), 'beside it on screen').toBe(1);
    expect(veilKeep(new THREE.Vector3(0, 1.2, -1), lens, a, b, .42, 0, .7), 'nobody struck').toBe(1);
  });
  it('is compiled into every layer that is drawn over a victim', () => {
    const scene = new THREE.Scene(), sparks = new SparkField(scene, 8, 'test', 1, .55), beams = new Beams(scene);
    expect(sparks.mesh.material.fragmentShader).toContain('victimVeil(vVeil, uVeilStrength)');
    expect(sparks.mesh.material.uniforms.uVeilStrength.value).toBe(.55);
    expect(beams.tube.material.fragmentShader).toContain('victimVeilThrough(');
    expect(beams.corona.material.fragmentShader).toContain('victimVeilThrough(');
    const basic = installVeil(new THREE.MeshBasicMaterial(), .6);
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: '#include <project_vertex>', fragmentShader: '#include <dithering_fragment>' };
    basic.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain('vVeilWorld = (modelMatrix * veilLocal).xyz');
    expect(shader.fragmentShader).toContain('gl_FragColor.a *= victimVeil(vVeilWorld, uVeilStrength)');
    expect(shader.fragmentShader).toContain(VEIL_GLSL.trim().split('\n')[0]);
    expect(shader.uniforms.uVeilStrength.value).toBe(.6);
    sparks.dispose(); beams.dispose();
  });
});
