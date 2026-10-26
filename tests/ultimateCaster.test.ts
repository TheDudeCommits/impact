import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '../src/render/FollowCamera';
import { OcclusionFader, installOcclusionFade, occlusionTwins } from '../src/render/OcclusionFade';
import { ArenaSimulation } from '../src/game/simulation';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

type Body = Fighter & { state: PlayerState; model: { visible: boolean }; handR: THREE.Vector3 };
function skinned(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const n = geometry.getAttribute('position').count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const bone = new THREE.Bone(), mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone]));
  return mesh;
}
function body(state: PlayerState, cape: boolean): Body {
  const group = new THREE.Group(); group.position.set(state.x, state.y, state.z);
  group.add(skinned(new THREE.BoxGeometry(.5, 1.8, .3).translate(0, .9, 0), new THREE.MeshToonMaterial()));
  if (cape) group.add(skinned(new THREE.BoxGeometry(2.4, 1.3, .05, 12, 6, 1).translate(0, 1.05, -1), new THREE.MeshToonMaterial()));
  return { state: { ...state }, group, velocity: new THREE.Vector3(), model: { visible: true }, handR: new THREE.Vector3() } as unknown as Body;
}
type Frame = { phase: string; weight: number; eye: THREE.Vector3; t: number; camera: THREE.PerspectiveCamera; caster: THREE.Vector3[]; victim: THREE.Vector3; grounded: boolean; window: number };
function film(user: FighterId, at: [number, number], seconds = 7, cape = true) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 5 });
  sim.addPlayer('me', user, 'Me', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('v0', 'goku', 'V', false, { x: at[0], y: 0, z: at[1] });
  sim.actors.get('me')!.state.ultimate = 100;
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200), follow = new FollowCamera(camera);
  follow.mode = 'lockon'; follow.cinematics = true;
  const bodies = new Map<string, Body>(sim.playerStates().map(p => [p.id, body(p, cape && p.id === 'me')]));
  for (const b of bodies.values()) installOcclusionFade(b);
  follow.director.crowd = bodies;
  let input = 0, seq = 0;
  const frames: Frame[] = [], v = new THREE.Vector3();
  const points = (b: Body) => { const out: THREE.Vector3[] = []; b.group.updateMatrixWorld(true); b.group.traverse(o => { const m = o as THREE.SkinnedMesh; if (!m.isSkinnedMesh) return; const n = m.geometry.getAttribute('position').count; for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); out.push(m.localToWorld(v.clone())); } }); return out; };
  for (let i = 0; i < 60 * seconds; i++) {
    sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'v0', attack: i === 30 ? 'ultimate' : undefined });
    sim.step();
    const events: CombatEvent[] = sim.drainEvents();
    for (const p of sim.playerStates()) { const b = bodies.get(p.id)!; Object.assign(b.state, p); b.group.position.set(p.x, p.y, p.z); b.group.rotation.y = p.yaw; b.group.updateMatrixWorld(true); }
    const caster = bodies.get('me')!; caster.model.visible = !(user === 'luffy' && caster.state.action === 'ultimate');
    follow.director.handle(events, 'me', id => bodies.get(id));
    follow.update(1 / 60, bodies.get('me')!, input, 0, [], 0, bodies.get('v0')!, true); input = follow.inputYaw; camera.updateMatrixWorld();
    frames.push({ phase: follow.director.phase, weight: follow.director.weight, eye: camera.position.clone(), t: sim.serverTime, camera: camera.clone(),
      caster: points(bodies.get('me')!), victim: bodies.get('v0')!.group.position.clone(), grounded: !!bodies.get('v0')!.state.grounded,
      window: (camera.userData.rig as { fadeWindow: number }).fadeWindow });
  }
  sim.dispose();
  return { frames, cast: 31 / 60 };
}
const nearest = (eye: THREE.Vector3, points: THREE.Vector3[]) => points.reduce((m, p) => Math.min(m, p.distanceTo(eye)), Infinity);

describe('the caster as drawn stays out of the lens', () => {
  it.each(['guts', 'law', 'zoro'] as FighterId[])('%s: no shot of the ultimate stands inside the cape, and the release sees the victim past it', user => {
    const { frames } = film(user, [.3, 2.2]);
    const shot = frames.filter(f => f.weight > .99 && f.phase !== 'close');
    expect(shot.length, 'the shots are taken').toBeGreaterThan(90);
    let worst = Infinity;
    for (const f of shot) worst = Math.min(worst, nearest(f.eye, f.caster));
    expect(worst, 'the nearest the cape comes to the lens').toBeGreaterThan(.85);
    const release = frames.filter(f => f.phase === 'release' && f.weight > .99);
    let hidden = 0;
    for (const f of release) {
      const chest = f.victim.clone().setY(f.victim.y + 1.1), line = new THREE.Line3(f.eye, chest), q = new THREE.Vector3();
      if (f.caster.filter(p => { line.closestPointToPoint(p, true, q); return q.distanceTo(p) < .1 && q.distanceTo(chest) > .3; }).length > 4) hidden++;
    }
    expect(hidden / Math.max(1, release.length), 'release frames with the victim behind the cape').toBeLessThan(.1);
  });

  it('thins the caster over the victim through the shots about them', () => {
    const { frames } = film('guts', [.3, 2.2]);
    const about = frames.filter(f => (f.phase === 'release' || f.phase === 'swing') && f.weight > .99);
    let crossed = 0, open = 0, run = 0;
    for (const f of about) {
      const chest = f.victim.clone().setY(f.victim.y + 1.1), line = new THREE.Line3(f.eye, chest), q = new THREE.Vector3();
      const hides = f.caster.filter(p => { line.closestPointToPoint(p, true, q); return q.distanceTo(p) < .12 && q.distanceTo(chest) > .3; }).length > 4;
      run = hides ? run + 1 : 0;
      if (run >= 8) { crossed++; if (f.window > .3) open++; }
    }
    if (crossed) expect(open / crossed, 'frames with the cape across the victim and the window open').toBeGreaterThan(.8);
    expect(frames.filter(f => f.phase === 'close' && f.weight > .99).every(f => f.window < .01)).toBe(true);
    expect(about.length).toBeGreaterThan(20);
  });
});

describe('the ultimate ends on the victim, on the floor', () => {
  it.each(['kakashi', 'goku', 'zoro', 'luffy'] as FighterId[])('%s: the impact lens stays under the ceiling, the victim readable, held until they land', user => {
    const { frames, cast } = film(user, [.3, 2.2], 8, false);
    const impact = frames.filter(f => f.phase === 'impact');
    expect(impact.length).toBeGreaterThan(30);
    const flew = impact.some(f => !f.grounded);
    for (const f of impact.filter(g => g.weight > .99)) {
      expect(f.eye.y, `lens height at ${(f.t - cast).toFixed(2)}`).toBeLessThan(user === 'luffy' ? 3.4 : 2.8 + .35);
      if (user === 'luffy' && f.t - impact[0].t > 1) expect(Math.hypot(f.eye.x - f.victim.x, f.eye.z - f.victim.z), 'the lens off the victim').toBeLessThan(5);
      const chest = f.victim.clone().setY(f.victim.y + 1.1).project(f.camera);
      expect(chest.z).toBeLessThan(1);
      expect(Math.abs(chest.x), 'the victim in the frame').toBeLessThan(.95);
      expect(chest.y, 'under the health bars').toBeLessThan(.64);
      expect(chest.y).toBeGreaterThan(-.95);
    }
    if (flew) {
      const landed = impact.findIndex((f, i) => i > 0 && f.grounded && impact.slice(0, i).some(g => !g.grounded));
      expect(landed, 'they land inside the shot').toBeGreaterThan(0);
      expect(impact[landed].weight, 'on screen as they land').toBeGreaterThan(.99);
      const leaving = impact.findIndex(f => f.weight < .99 && f.t > impact[landed].t);
      expect(leaving < 0 || impact[leaving].t - impact[landed].t > .3, 'a beat on them down').toBe(true);
    }
  });
});

describe('the occlusion fade opens the caster over the shot\'s victim', () => {
  it('sooner and further than over the lock-on target, and over the victim\'s box', () => {
    const state = (id: string, x: number, z: number): PlayerState => ({ id, name: id, fighter: 'guts', x, y: 0, z, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
      action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false,
      cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });
    const actor = (id: string, x: number, z: number) => {
      const group = new THREE.Group(); group.position.set(x, 0, z);
      group.add(new THREE.Mesh(new THREE.BoxGeometry(.5, 1.8, .3), new THREE.MeshToonMaterial()));
      const b = { state: state(id, x, z), group, velocity: new THREE.Vector3() } as unknown as Fighter; installOcclusionFade(b); return b;
    };
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
    camera.position.set(.2, 1.4, -2.5); camera.lookAt(0, 1.1, 4); camera.updateMatrixWorld();
    const me = actor('me', .5, 0), victim = actor('victim', 0, 4), crowd = new Map([['me', me], ['victim', victim]]);
    const fader = new OcclusionFader(), fadeOf = (b: Fighter) => {
      const material = occlusionTwins(b)[0].twin;
      const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <project_vertex>', fragmentShader: '#include <clipping_planes_fragment>' } as unknown as THREE.WebGLProgramParametersWithUniforms;
      material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      return (shader.uniforms.uOccFade.value as THREE.Vector2).clone();
    };
    for (let i = 0; i < 60; i++) fader.update(1 / 60, camera, crowd, me, victim, []);
    const gameplay = fadeOf(me).y;
    fader.shotVictim = victim;
    for (let i = 0; i < 60; i++) fader.update(1 / 60, camera, crowd, me, undefined, [me, victim]);
    const shot = fadeOf(me).y;
    expect(gameplay, 'the gameplay shot leaves it alone').toBeLessThan(.01);
    expect(shot, 'the shot opens it').toBeGreaterThan(.7);
    fader.shotVictim = undefined;
    for (let i = 0; i < 60; i++) fader.update(1 / 60, camera, crowd, me, victim, []);
    expect(fadeOf(me).y, 'and closes it after').toBeLessThan(.01);
    me.group.position.x = 1.2; me.state.x = 1.2;
    fader.shotVictim = victim;
    for (let i = 0; i < 60; i++) fader.update(1 / 60, camera, crowd, me, undefined, [me, victim]);
    expect(fadeOf(me).y, 'the joints alone do not open it').toBeLessThan(.01);
    fader.shotHidden = true;
    for (let i = 0; i < 60; i++) fader.update(1 / 60, camera, crowd, me, undefined, [me, victim]);
    expect(fadeOf(me).y, 'the cape on the sight line does').toBeGreaterThan(.7);
  });
});
