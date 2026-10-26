import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { castThreat, castMove, ThreatOutline, applyThreatInk, threatInk, THREAT_BLOCKABLE, THREAT_IDLE, THREAT_UNBLOCKABLE, THREAT_GLOW,
  RED_HOLD, FALL_HOLD, LOCK_IN, RELEASE_OUT, type ThreatBody, type ThreatSource } from '../src/render/ThreatOutline';
import { LockOnModel, safeArea, defaultPanels, type LockInput } from '../src/ui/LockOnView';
import { lockFrame } from '../src/render/lockAnchors';
import { MOVES } from '../src/game/moves';
import { comboMove } from '../src/game/combos';
import { moveFor, rushMove } from '../src/game/awakening';
import { ENEMIES } from '../src/survival/enemies';
import type { ActionKind, FighterId } from '../src/game/types';


const cast = (fighter: FighterId, action: ActionKind, seconds: number, extra: Partial<ThreatSource> = {}): ThreatSource => {
  const s: ThreatSource = { fighter, action, actionTime: 0, actionDuration: 1, alive: true, ...extra };
  const move = castMove(s);
  s.actionDuration = move?.duration ?? 1; s.actionTime = seconds / s.actionDuration;
  return s;
};

describe('the threat a cast is, off the simulation\'s own data', () => {
  it('not attacking is yellow, whatever the body is doing', () => {
    for (const action of ['idle', 'run', 'dash', 'guard', 'jump', 'hurt', 'launched', 'knockdown', 'awaken'] as ActionKind[])
      expect(castThreat({ fighter: 'luffy', action, actionTime: .5, actionDuration: 1 }).level, action).toBe(THREAT_IDLE);
    expect(castThreat({ fighter: 'luffy', action: 'light', actionTime: .1, actionDuration: .4, alive: false }).level).toBe(THREAT_IDLE);
  });
  it('a guard-breaking move is red from its first frame, through the windup, before the blow lands', () => {
    expect(MOVES.ace.special.guardBreak).toBe(true);
    const first = castThreat(cast('ace', 'special', 0));
    expect(first.level).toBe(THREAT_UNBLOCKABLE);
    expect(first.until).toBeCloseTo(MOVES.ace.special.contacts[0], 5);
    const windup = castThreat(cast('ace', 'special', MOVES.ace.special.contacts[0] * .6));
    expect(windup.level).toBe(THREAT_UNBLOCKABLE); expect(windup.until).toBeGreaterThan(0);
  });
  it('any other cast is orange; past its last blow (and a shot\'s flight) it is yellow again', () => {
    const light = MOVES.luffy.light;
    expect(light.guardBreak).toBeFalsy();
    expect(castThreat(cast('luffy', 'light', 0)).level).toBe(THREAT_BLOCKABLE);
    expect(castThreat(cast('luffy', 'light', light.contacts[0])).level).toBe(THREAT_BLOCKABLE);
    expect(castThreat(cast('luffy', 'light', light.duration * .98)).level, 'recovery').toBe(THREAT_IDLE);
    const s = MOVES.ace.special, flight = Math.min(1.2, s.range / s.speed!);
    expect(castThreat(cast('ace', 'special', s.contacts[0] + flight * .8)).level).toBe(THREAT_UNBLOCKABLE);
  });
  it('every guard-breaking move on the roster reads red, and Goku\'s and Naruto\'s ultimates (which a guard holds) orange', () => {
    for (const [fighter, moves] of Object.entries(MOVES) as [FighterId, typeof MOVES[FighterId]][])
      for (const slot of ['heavy', 'special', 'ultimate'] as const) {
        const level = castThreat(cast(fighter, slot, 0)).level;
        expect(level, `${fighter} ${slot}`).toBe(moveFor(fighter, slot, false).guardBreak ? THREAT_UNBLOCKABLE : THREAT_BLOCKABLE);
      }
    expect(castThreat(cast('goku', 'ultimate', .1)).level).toBe(THREAT_BLOCKABLE);
    expect(castThreat(cast('naruto', 'ultimate', .1)).level).toBe(THREAT_BLOCKABLE);
  });
  it('reads the move the simulation throws: a combo ender, a rush stage, an awakened form', () => {
    const ender = comboMove('luffy', 'llh')!;
    expect(ender).toBeTruthy();
    expect(castMove(cast('luffy', 'heavy', .05, { branch: 'llh' }))).toBe(ender);
    expect(castMove(cast('goku', 'light', .05, { chain: 2 }))).toEqual(rushMove('goku', 2, false));
    expect(castMove(cast('goku', 'ultimate', .05, { awakened: true }))).toEqual(moveFor('goku', 'ultimate', true));
    expect(castThreat({ fighter: 'goku', action: 'heavy', actionTime: .1, actionDuration: 1, enemy: 'grunt' }).level).toBe(THREAT_BLOCKABLE);
  });
  it('reads enemy kits and named attacks instead of the placeholder fighter', () => {
    for(const enemy of ['marine','marine-rifleman','marine-brute','lucci']){
      for(const move of ENEMIES[enemy].moves){
        const s=cast('goku',move.slot,0,{enemy,move:move.name});
        expect(castMove(s)).toBe(move);
        expect(castThreat(s).level,`${enemy}: ${move.name}`).toBe(move.guardBreak?THREAT_UNBLOCKABLE:THREAT_BLOCKABLE);
        s.actionDuration=100;s.actionTime=1;
        expect(castThreat(s).level,'finished attacks are safe').toBe(THREAT_IDLE);
      }
    }
    for(const move of ['Mending seal','Breach charge'])
      expect(castThreat(cast('goku','special',0,{enemy:'marine',move})).level,'support/structure channels do not falsely signal player attacks').toBe(THREAT_IDLE);
  });
});

const body = (fighter: FighterId = 'luffy'): ThreatBody & { state: ThreatSource & { id: string } } =>
  ({ threatInk: threatInk(), state: { id: fighter, fighter, action: 'idle', actionTime: 0, actionDuration: 1, alive: true } }) as never;
const step = (o: ThreatOutline, b: ThreatBody | undefined, seconds: number, dt = 1 / 60) => { for (let t = 0; t < seconds - 1e-9; t += dt) o.update(dt, b); };

describe('the glow on the locked body', () => {
  it('flashes in on a lock and settles on the level\'s brightness; lets go over RELEASE_OUT', () => {
    const o = new ThreatOutline(), b = body();
    o.update(1 / 60, b);
    const first = b.threatInk!.color.value.r;
    step(o, b, LOCK_IN + .4);
    expect(b.threatInk!.mix.value).toBe(1);
    expect(first, 'the flash is brighter than the settled glow').toBeGreaterThan(b.threatInk!.color.value.r);
    expect(o.state.level).toBe(THREAT_IDLE); expect(o.state.css).toBe('#ffd23c');
    step(o, undefined, RELEASE_OUT * .5);
    expect(b.threatInk!.mix.value).toBeGreaterThan(0); expect(b.threatInk!.mix.value).toBeLessThan(1);
    step(o, undefined, RELEASE_OUT);
    expect(b.threatInk!.mix.value).toBe(0); expect(b.threatInk!.widen.value).toBe(0); expect(o.state.level).toBe(-1);
  });
  it('turns red at once for an unblockable windup and holds it past the blow; orange waits a beat; neither flickers through a string\'s gaps', () => {
    const o = new ThreatOutline(), b = body();
    step(o, b, .5);
    Object.assign(b.state, cast('ace', 'special', .05));
    o.update(1 / 60, b);
    expect(o.state.level, 'red on the first frame of the windup').toBe(THREAT_UNBLOCKABLE);
    Object.assign(b.state, { action: 'idle', actionTime: 0 });
    step(o, b, RED_HOLD * .8); expect(o.state.level).toBe(THREAT_UNBLOCKABLE);
    step(o, b, RED_HOLD * .4); expect(o.state.level).toBe(THREAT_IDLE);
    const levels: number[] = [];
    for (let k = 0; k < 4; k++) {
      Object.assign(b.state, cast('luffy', 'light', .02));
      for (let i = 0; i < 18; i++) { o.update(1 / 60, b); levels.push(o.state.level); }
      Object.assign(b.state, { action: 'idle', actionTime: 0 });
      for (let i = 0; i < 6; i++) { o.update(1 / 60, b); levels.push(o.state.level); }
    }
    const fromFirstOrange = levels.slice(levels.indexOf(THREAT_BLOCKABLE));
    expect(new Set(fromFirstOrange), 'no yellow inside the string').toEqual(new Set([THREAT_BLOCKABLE]));
    step(o, b, FALL_HOLD + .05); expect(o.state.level).toBe(THREAT_IDLE);
  });
  it('red is the brightest, yellow the dimmest; the colour eases rather than jumps', () => {
    expect(THREAT_GLOW[0]).toBeLessThan(THREAT_GLOW[1]); expect(THREAT_GLOW[1]).toBeLessThan(THREAT_GLOW[2]);
    const o = new ThreatOutline(), b = body();
    step(o, b, 1);
    const yellow = b.threatInk!.color.value.clone();
    Object.assign(b.state, cast('ace', 'special', .05));
    o.update(1 / 60, b);
    const next = b.threatInk!.color.value, hue = (c: THREE.Color) => c.g / c.r, red = new THREE.Color('#ff2430');
    expect(hue(next), 'one frame in, part of the way to red').toBeLessThan(hue(yellow) - .05);
    expect(hue(next)).toBeGreaterThan(hue(red) + .05);
  });
  it('a switch hands the glow over: the old body fades out as the new one flashes in; only the locked body is ever lit', () => {
    const o = new ThreatOutline(), a = body('luffy'), c = body('zoro'), bystander = body('sanji');
    step(o, a, .5);
    o.update(1 / 60, c);
    expect(a.threatInk!.mix.value).toBeGreaterThan(0); expect(c.threatInk!.mix.value).toBeGreaterThan(0);
    step(o, c, RELEASE_OUT + .05);
    expect(a.threatInk!.mix.value).toBe(0); expect(c.threatInk!.mix.value).toBe(1);
    expect(bystander.threatInk!.mix.value).toBe(0); expect(bystander.threatInk!.widen.value).toBe(0);
  });
  it('lights a form drawn for the body too, and puts it out when it goes', () => {
    const o = new ThreatOutline(), b = body('naruto'), fox = body('naruto');
    (b as { shownBody?: ThreatBody }).shownBody = fox;
    step(o, b, .3);
    expect(fox.threatInk!.mix.value).toBe(1);
    (b as { shownBody?: ThreatBody }).shownBody = b;
    o.update(1 / 60, b);
    expect(fox.threatInk!.mix.value).toBe(0);
  });
});

describe('the ink shell\'s patch', () => {
  it('reads the body\'s own uniforms, pushes the shell out by them and mixes the colour in over the ink', () => {
    const material = new THREE.MeshToonMaterial(), ink = threatInk();
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: 'uniform float uInkWidth;\nuniform float uInkScale;\nvoid main(){\n#include <project_vertex>\n#include <logdepthbuf_vertex>\n}', fragmentShader: 'void main(){\noutgoingLight = uInkColor;\n#include <opaque_fragment>\n}' };
    applyThreatInk(material, ink);
    material.onBeforeCompile(shader as never, undefined as never);
    expect(shader.uniforms.uThreatColor).toBe(ink.color); expect(shader.uniforms.uThreatMix).toBe(ink.mix); expect(shader.uniforms.uThreatWiden).toBe(ink.widen);
    expect(shader.vertexShader).toContain('uThreatWiden');
    expect(shader.vertexShader.indexOf('uThreatWiden > 0.0')).toBeLessThan(shader.vertexShader.indexOf('#include <logdepthbuf_vertex>'));
    expect(shader.fragmentShader.indexOf('outgoingLight = uInkColor;')).toBeLessThan(shader.fragmentShader.indexOf('mix( outgoingLight, uThreatColor, uThreatMix )'));
    const other = new THREE.MeshToonMaterial(); applyThreatInk(other, threatInk());
    expect(other.customProgramCacheKey()).toBe(material.customProgramCacheKey());
  });
});

describe('the reticle in the glow style', () => {
  const W = 1600, H = 900, area = defaultPanels(safeArea(), W, H);
  const input = (locked: boolean, glow: boolean): LockInput => {
    const frame = lockFrame(); Object.assign(frame, { ok: true, inFront: true, ax: 800, ay: 500, dx: 0, dy: 50, l: 760, t: 380, r: 840, b: 620, cx: 800, cy: 390 });
    return { visible: true, locked, id: 'a', name: 'A', distance: 4, frame, w: W, h: H, area, effects: 1, reduced: false, glow };
  };
  it('draws no brackets - the body is the mark - but keeps the pin, the burst and the name', () => {
    const m = new LockOnModel();
    const first = m.step(input(true, true), 1 / 60);
    expect(first.bracket).toBe(false); expect(first.burst).toBe(true); expect(first.stamp).toBe(true);
    for (let i = 0; i < 30; i++) m.step(input(true, true), 1 / 60);
    const plan = m.step(input(true, true), 1 / 60);
    expect(plan.bracket).toBe(false); expect(plan.pin).toBe(true); expect(plan.solid).toBe(true);
    const released = m.step(input(false, true), 1 / 60);
    expect(released.bracket).toBe(false); expect(released.solid).toBe(false);
  });
  it('the brackets style is round 4\'s, unchanged', () => {
    const m = new LockOnModel();
    for (let i = 0; i < 30; i++) m.step(input(true, false), 1 / 60);
    expect(m.step(input(true, false), 1 / 60).bracket).toBe(true);
  });
});
