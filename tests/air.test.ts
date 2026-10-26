import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AIR_FRAGMENT, airAt, airUniforms, setAirLook, setAirQuality } from '../src/render/look/air';
import { lookFor } from '../src/render/look/stageLooks';
import type { StageId } from '../src/game/stages';

const PLACES: StageId[] = ['chunin-final', 'kami-lookout', 'martial-arts-tournament', 'enies-lobby', 'valley-of-the-end', 'shiganshina', 'malevolent-shrine'];

describe('the air', () => {
  it('reshapes the fog chunk every fogged material shares, and leaves the linear fog running on top', () => {
    expect(THREE.ShaderChunk.fog_fragment).toBe(AIR_FRAGMENT);
    expect(AIR_FRAGMENT).toContain('smoothstep( fogNear, fogFar, vFogDepth )');
    expect(THREE.ShaderChunk.fog_vertex).toContain('vAirRay');
  });

  it('reaches every material through three\'s own tables: one array, shared, never cloned', () => {
    for (const lib of ['standard', 'physical', 'basic', 'lambert', 'phong', 'points', 'sprite'] as const) {
      const uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib[lib].uniforms);
      expect(uniforms.uAirFog.value, lib).toBe(airUniforms.uAirFog.value);
      expect(uniforms.uAirColor.value, lib).toBe(airUniforms.uAirColor.value);
    }
    expect(THREE.UniformsUtils.merge([THREE.UniformsLib.fog]).uAirShape.value).toBe(airUniforms.uAirShape.value);
    const toon = THREE.UniformsUtils.clone(THREE.ShaderLib.toon.uniforms).uAirFog.value as Float32Array;
    expect(toon).not.toBe(airUniforms.uAirFog.value);
    setAirLook(lookFor('kami-lookout'));
    expect(toon[0]).toBeCloseTo(lookFor('kami-lookout').air!.fighters, 5);
  });

  it('lies on scenery 20-60 m back on every place of the main game, and leaves a fighter in the lens\'s reach alone', () => {
    for (const place of PLACES) {
      const air = lookFor(place).air!;
      expect(air, place).toBeDefined();
      expect(airAt(air, 15, true), place).toBeLessThan(.02);
      expect(air.fighters, place).toBeLessThanOrEqual(.4);
      expect(airAt(air, 60), place).toBeGreaterThan(.1);
      expect(airAt(air, 60), place).toBeGreaterThan(airAt(air, 15) + .08);
      expect(airAt(air, 400), place).toBeGreaterThan(place === 'malevolent-shrine' || place === 'martial-arts-tournament' ? .45 : .65);
    }
  });

  it('keeps every place\'s palette: the Valley\'s violet, the Shrine\'s red', () => {
    const hue = (hex: number) => { const hsl = { h: 0, s: 0, l: 0 }; new THREE.Color(hex).getHSL(hsl); return hsl.h * 360; };
    const valley = hue(lookFor('valley-of-the-end').air!.color!), shrine = hue(lookFor('malevolent-shrine').air!.color!);
    expect(valley).toBeGreaterThan(260); expect(valley).toBeLessThan(330);
    expect(shrine < 15 || shrine > 345).toBe(true);
  });

  it('is off on every place without it - the rifts, Last Stand\'s places, the harbour - so none inherits the last one\'s', () => {
    for (const place of ['rift-village', 'hidden-leaf', 'blood-citadel', 'harbor', 'galactic-arena', 'chunin-exam-room'] as StageId[]) {
      setAirLook(lookFor('shiganshina'));
      setAirLook(lookFor(place));
      expect(Array.from(airUniforms.uAirFog.value), place).toEqual([0, 0, 0, 0]);
    }
  });

  it('drops its shaping on low quality and keeps the haze', () => {
    setAirQuality('low');
    setAirLook(lookFor('valley-of-the-end'));
    expect(airUniforms.uAirFog.value[0]).toBe(1);
    expect(Array.from(airUniforms.uAirShape.value).slice(1)).toEqual([0, 0, 0]);
    setAirQuality('high');
    expect(airUniforms.uAirShape.value[1]).toBeGreaterThan(0);
  });
});
