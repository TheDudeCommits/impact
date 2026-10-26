import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COOKIE_GLSL, cookieUniforms, setCloudTime, setCookieLook } from '../src/render/look/lightCookie';
import { lookFor, STAGE_LOOKS } from '../src/render/look/stageLooks';
import { CLOUD_FLOOR, CLOUD_SPAN } from '../src/render/look/roanPass';
import { STAGES, type StageId } from '../src/game/stages';

const fract = (x: number) => x - Math.floor(x);
function hash(px: number, py: number) {
  let qx = fract(px * .1031), qy = fract(py * .1031), qz = fract(px * .1031);
  const d = qx * (qy + 33.33) + qy * (qz + 33.33) + qz * (qx + 33.33);
  qx += d; qy += d; qz += d;
  return fract((qx + qy) * qz);
}
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function shadeOverTime(stage: StageId) {
  const look = lookFor(stage), k = look.cloudShadows!, def = STAGES[stage], n = Math.hypot(...look.key.dir);
  const sun = look.key.dir.map(v => v / n), t = (k.height ?? 60) / Math.max(sun[1], .3), N = 20, shares: number[] = [];
  for (let time = 0; time <= 600; time += .5) {
    let shaded = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = (-1 + (i + .5) * 2 / N) * def.halfX, z = (-1 + (j + .5) * 2 / N) * def.halfZ;
      const ax = (x + sun[0] * t - k.wind[0] * time) / k.scale, az = (z + sun[2] * t - k.wind[1] * time) / k.scale;
      if (smoothstep(k.cover - k.soft, k.cover + k.soft, noise(ax, az) * .65 + noise(ax * 2.07 + 13.7, az * 2.07 + 13.7) * .35) > .5) shaded++;
    }
    shares.push(shaded / (N * N));
  }
  return shares;
}

describe('cloud shadows', () => {
  const clouded = (Object.keys(STAGE_LOOKS) as StageId[]).filter(stage => lookFor(stage).cloudShadows);
  it('drift over the sunny outdoor places only - not a hall, a domain, a night or a rift', () => {
    expect(clouded.sort()).toEqual(['enies-lobby', 'harbor', 'kami-lookout', 'marineford', 'martial-arts-tournament', 'onigashima', 'pains-crater', 'shiganshina']);
    for (const stage of clouded) {
      const look = lookFor(stage), clouds = look.cloudShadows!;
      expect(look.key.dir[1], stage).toBeGreaterThan(.4);
      expect(clouds.floor, stage).toBeGreaterThanOrEqual(CLOUD_FLOOR); expect(clouds.floor, stage).toBeLessThan(.9);
      expect(clouds.cover, stage).toBeGreaterThan(.5);
      expect(clouds.fighters, stage).toBeLessThanOrEqual(.5);
      expect(Math.hypot(...clouds.wind), stage).toBeLessThan(2.5);
    }
  });
  it('never lay one cloud\'s shade over a whole small ring: no cloud wider than CLOUD_SPAN of the floor it crosses', () => {
    for (const stage of clouded) {
      const def = STAGES[stage], short = 2 * Math.min(def.halfX, def.halfZ), shares = shadeOverTime(stage);
      expect(lookFor(stage).cloudShadows!.scale, stage).toBeLessThanOrEqual(CLOUD_SPAN * short + 1e-9);
      const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
      expect(mean, `${stage}: the floor's mean share in shade`).toBeLessThan(.5);
      if (short < 40) {
        expect(Math.max(...shares), `${stage}: the most of the ring ever in shade at once`).toBeLessThan(.8);
        expect(mean, stage).toBeLessThan(.3);
      }
    }
  });
  it('are switched off by every look that has none, so a rift never inherits the last place\'s', () => {
    setCookieLook(lookFor('harbor'));
    expect(cookieUniforms.uCloudOn.value).toBe(1);
    expect(cookieUniforms.uCloud.value.w).toBeCloseTo(lookFor('harbor').cloudShadows!.floor, 6);
    for (const stage of ['rift-village', 'chunin-exam-room', 'malevolent-shrine'] as StageId[]) {
      setCookieLook(lookFor('harbor')); setCookieLook(lookFor(stage));
      expect(cookieUniforms.uCloudOn.value, stage).toBe(0);
    }
    setCookieLook(lookFor('chunin-exam-room'));
    expect(cookieUniforms.uCookieOn.value).toBe(1);
    setCloudTime(12.5);
    expect(cookieUniforms.uCloudTime.value).toBe(12.5);
  });
  it('shade the stage through the key light\'s cookie, and the fighters by their own share', () => {
    expect(COOKIE_GLSL).toContain('float lookCookie( vec3 p ) { return lookWindow( p ) * lookCloud( p ); }');
    expect(COOKIE_GLSL).toMatch(/if \( uCloudOn < \.5 \) return 1\.;/);
    const toon = fs.readFileSync('src/render/look/toonShading.ts', 'utf8');
    expect(toon).toContain('mix( 1., lookWindow( vLookWorld ), uCookieFighters ) * mix( 1., lookCloud( vLookWorld ), uCloudFighters )');
    expect(fs.readFileSync('src/render/GameRenderer.ts', 'utf8')).toContain('setCloudTime(this.time)');
  });
});
