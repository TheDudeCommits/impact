import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { COOKIE_GLSL, cookieUniforms, setCookieLook, setCookieQuality } from '../src/render/look/lightCookie';
import { lookFor, STAGE_LOOKS } from '../src/render/look/stageLooks';
import { STAGE_PROPS } from '../src/game/stageProps';
import type { StageId } from '../src/game/stages';

const hue = (hex: number) => { const hsl = { h: 0, s: 0, l: 0 }; new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace); return hsl.h * 360; };

describe('the dappled light', () => {
  const dappled = (Object.keys(STAGE_LOOKS) as StageId[]).filter(stage => lookFor(stage).leaves);
  it('falls on the green places only: the Chūnin arena, Kami\'s gardens, the Valley\'s banks', () => {
    expect(dappled.sort()).toEqual(['chunin-final', 'kami-lookout', 'valley-of-the-end']);
    for (const stage of dappled) {
      const leaves = lookFor(stage).leaves!;
      expect(leaves.floor, stage).toBeGreaterThan(.05); expect(leaves.floor, stage).toBeLessThan(.6);
      expect(leaves.soft, stage).toBeGreaterThan(.03);
      expect(leaves.fighters, stage).toBeLessThanOrEqual(.4);
      expect(leaves.height, stage).toBeGreaterThan(3);
      expect(Math.hypot(...(leaves.wind ?? [0, 0])), stage).toBeLessThan(.5);
    }
  });
  it('lies over Kami\'s gardens, not over the open tiles', () => {
    const gardens = (STAGE_PROPS['kami-lookout'] ?? []).filter(p => p.piece === 'br/tree-place');
    const spots = lookFor('kami-lookout').leaves!.spots!;
    for (const g of gardens) expect(spots.some(s => Math.hypot(s[0] - g.x, s[1] - g.z) < 1), `${g.x},${g.z}`).toBe(true);
  });
  it('rides the cookie the stage and the fighters already share, and every look sets it', () => {
    expect(COOKIE_GLSL).toContain('float lookCloud( vec3 p ) { return lookClouds( p ) * lookLeaves( p ); }');
    setCookieLook(lookFor('chunin-final'));
    expect(cookieUniforms.uLeafOn.value).toBe(1);
    for (const stage of ['rift-village', 'chunin-exam-room', 'malevolent-shrine', 'shiganshina'] as StageId[]) {
      setCookieLook(lookFor('chunin-final')); setCookieLook(lookFor(stage));
      expect(cookieUniforms.uLeafOn.value, stage).toBe(0);
    }
  });
  it('costs less on medium and nothing on low', () => {
    setCookieQuality('medium'); setCookieLook(lookFor('chunin-final'));
    expect(cookieUniforms.uLeafOn.value).toBe(1); expect(cookieUniforms.uLeafDetail.value).toBe(0);
    setCookieQuality('low');
    expect(cookieUniforms.uLeafOn.value).toBe(0);
    setCookieQuality('high');
    expect(cookieUniforms.uLeafOn.value).toBe(1); expect(cookieUniforms.uLeafDetail.value).toBe(1);
  });
});

describe('warm light, cool shade, and the ground\'s bounce', () => {
  it('keeps the key warm and shades the natural places teal-green; the Valley keeps its violet', () => {
    for (const stage of ['chunin-final', 'kami-lookout'] as StageId[]) {
      const look = lookFor(stage);
      const key = new THREE.Color(look.key.color);
      expect(key.r, `${stage} key warm`).toBeGreaterThanOrEqual(key.b);
      const shade = hue(look.grade.shadowTint);
      expect(shade, `${stage} shade`).toBeGreaterThan(150); expect(shade, `${stage} shade`).toBeLessThan(205);
    }
    const valley = hue(lookFor('valley-of-the-end').grade.shadowTint);
    expect(valley).toBeGreaterThan(230); expect(valley).toBeLessThan(290);
  });
  it('bounces the grass\'s green into the fighters\' shade on the Chūnin arena', () => {
    const ground = hue(lookFor('chunin-final').hemi.ground);
    expect(ground).toBeGreaterThan(70); expect(ground).toBeLessThan(150);
  });
  it('keeps the fighters as bright where the shade deepens: their share of the ambient rises as the sky\'s light falls', () => {
    const linear = (c: number) => Math.pow(c / 255, 2.2);
    const skyLight = (h: { sky: number; intensity: number }) => h.intensity * (.2126 * linear((h.sky >> 16) & 255) + .7152 * linear((h.sky >> 8) & 255) + .0722 * linear(h.sky & 255));
    for (const stage of ['chunin-final', 'kami-lookout', 'martial-arts-tournament', 'enies-lobby', 'valley-of-the-end'] as StageId[]) {
      const look = lookFor(stage), base = STAGE_LOOKS[stage]!;
      const now = look.toon.ambient * skyLight(look.hemi), was = base.toon.ambient * 1.08 * skyLight(base.hemi);
      expect(now / was, stage).toBeGreaterThan(.85);
    }
  });
});
