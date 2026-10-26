import * as THREE from 'three';
import { MOVES } from '../game/moves';
import { beats } from './signature/ultimateClock';
import type { Fighter } from './Fighter';
import type { AttackSlot } from '../game/types';
import { elementFor, type Element } from './vfx/palette';
import { VfxKit } from './vfx/VfxKit';
import { noiseGLSL } from './vfx/noise';
import { roanEnabled } from './look/roanPass';
import { DREAM_IMPACT } from './dreamFlag';

const SAMPLES = 16, SUB = 3, STRIP = (SAMPLES - 1) * SUB + 1, LIFE = .22;
const INNER = .42;
const MIN_BAND = .035;
const GLOW = .18;
const HEAVY_BLADE = 1.35, HEAVY_LIFE = 1.45;

const VERTEX = `
attribute vec2 aTrail; attribute float aAcross;
varying vec2 vTrail; varying float vAcross; varying float vDepth;
void main(){ vTrail = aTrail; vAcross = aAcross; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
const FRAGMENT = `
uniform vec3 uHot; uniform vec3 uRim; uniform vec3 uBody; uniform float uStrength; uniform float uArmed; uniform float uDark; uniform float uGlow; uniform float uClock; uniform float uSeed; uniform float uHeavy; uniform float uSolid;
varying vec2 vTrail; varying float vAcross; varying float vDepth;
${noiseGLSL}
void main(){
  float fade = vTrail.x, head = vTrail.y;
  // Across the smear. A blade: 0 at the inner edge, 1 on the tip's path and
  // 1 + uGlow at the skirt ahead of it. A fist: 1 down the middle, 0 at the
  // sides.
  float s = mix(1.0 - abs(vAcross), (vAcross * .5 + .5) * (1.0 + uGlow), uArmed);
  float d = 1.0 - s, px = max(fwidth(s), 1e-4);
  float n = snoise(vec3(head * 5.0 + uSeed, s * 2.5, uClock * 1.6));
  // The cutting edge: about two pixels of white heat on the tip's path (down
  // the middle of a fist's smear), whatever the smear's size on screen.
  float edge = exp(-abs(d) / (px * 1.8));
  // A glow ahead of a blade's edge, and the band behind it thinning to the
  // grip, with the energy boiling along it and torn apart as it ages.
  float outer = uArmed * step(d, 0.0) * exp(d / max(uGlow * .45, px));
  float band = step(0.0, d) * smoothstep(0.0, mix(.8, .45, uArmed), s) * (.62 + .38 * n) * smoothstep(.12, .5, fade + .3 * n);
  float life = fade * (.35 + .65 * head) * uStrength;
  vec3 rgb; float alpha;
  // Energy gathers at the edge: the band is brightest just behind it.
  float heat = pow(clamp(s, 0.0, 1.0), 2.5);
  if (uDark > .5) {
    // A dark blade (Guts, Ichigo). Round 3c: the second critic still saw
    // Guts's crescent as "a thin red laser line that undersells the sword" -
    // its near-black body vanished against any dark background and only the
    // two-pixel edge read. Now it is a heavy crescent that reads on a dark
    // wall and a sunlit floor alike: a thick white-hot cutting edge (a few
    // pixels plus a share of the band), a wide crimson body behind it that
    // deepens to blood-black toward the grip, and dark wind streaks running
    // along the arc - the Getsuga's colours in the weight of a manga swing.
    float hotWidth = px * 3.5 + .045 * uHeavy + .02;
    float hot = exp(-max(d, 0.0) / hotWidth) * step(0.0, d);
    float crimson = 1.0 - smoothstep(0.0, .42 + .18 * uHeavy, d);
    float streak = smoothstep(.62, .92, .5 + .5 * sin(s * (26.0 + 18.0 * uHeavy) + n * 3.5 + head * 2.0));
    vec3 deep = vec3(.05, .004, .008);
    vec3 body = mix(deep, uRim * 1.15, crimson) * (1.0 - .5 * streak * (1.0 - hot));
    rgb = body * band + uHot * hot * (.4 + .6 * band) + uRim * outer * .9;
    alpha = min(.92, band * (.5 + .38 * crimson) + hot * .45);
  } else {
    rgb = uHot * edge + uRim * outer * .7 + uBody * band * (.35 + .7 * heat);
    alpha = band * .24 + edge * .12;
    if (uSolid > .5) {
      // The Rise of a Ninja pass: a drawn smear - a solid, white-hot core along
      // the path that cools into the move's colour, an ink line on its outer
      // edge, and it tears into dry-brush streaks toward the tail.
      float core = smoothstep(.25, .75, s);
      float rim = (1.0 - smoothstep(px * 1.2, px * 3.2 + .06, s)) * step(.02, s) * (1.0 - uArmed);
      float dry = smoothstep(.25, .6, n * .5 + .5 + fade * .6 - (1.0 - head) * .35);
      vec3 body = mix(uBody * 1.25, uHot, core * (.45 + .55 * head));
      rgb = body * band * dry + uHot * edge * .8 + uRim * outer * .7;
      alpha = min(.95, band * dry * (.62 + .3 * core) + edge * .3);
      rgb = mix(rgb, vec3(.025, .02, .035) * alpha, rim * .85 * band);
    }
  }
  // Round 3c: a swing that sweeps past the lens fades there instead of
  // painting the frame - a great sword's crescent is metres across, and the
  // finisher's swept past the camera and over the victim in one red sheet.
  life *= smoothstep(.9, 2.6, vDepth);
  if (max(alpha, max(rgb.r, max(rgb.g, rgb.b))) * life < .002) discard;
  gl_FragColor = vec4(rgb * life, alpha * life);
}`;

type Trail = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; positions: THREE.BufferAttribute; trail: THREE.BufferAttribute;
  tips: THREE.Vector3[]; inners: THREE.Vector3[]; ages: number[]; spare: THREE.Vector3[]; armed: boolean;
  bold?: boolean;
  body?: THREE.Vector3;
  heavy: number;
};

const _white = new THREE.Color();
const _p = new THREE.Vector3(), _cam = new THREE.Vector3(), _dir = new THREE.Vector3(), _toCam = new THREE.Vector3(),
  _side = new THREE.Vector3(), _band = new THREE.Vector3(), _outer = new THREE.Vector3(), _inner = new THREE.Vector3();
const _curve: THREE.Vector3[] = Array.from({ length: STRIP }, () => new THREE.Vector3());
const _curveIn: THREE.Vector3[] = Array.from({ length: STRIP }, () => new THREE.Vector3());
const _curveFade = new Float32Array(STRIP), _curveHead = new Float32Array(STRIP);

function seed(id: string) { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 4001; return h / 100; }

function catmull(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number, out: THREE.Vector3) {
  const t2 = t * t, t3 = t2 * t;
  const a = -.5 * t3 + t2 - .5 * t, b = 1.5 * t3 - 2.5 * t2 + 1, c = -1.5 * t3 + 2 * t2 + .5 * t, d = .5 * t3 - .5 * t2;
  return out.set(p0.x * a + p1.x * b + p2.x * c + p3.x * d, p0.y * a + p1.y * b + p2.y * c + p3.y * d, p0.z * a + p1.z * b + p2.z * c + p3.z * d);
}

export function darkBlade(el: Element) {
  const ink = (el.ink >> 16 & 255) + (el.ink >> 8 & 255) + (el.ink & 255), r = el.rim >> 16 & 255, g = el.rim >> 8 & 255;
  return ink < 16 && r > 180 && g < 60;
}
export function smearBody(rim: number, out: THREE.Color) {
  out.setHex(rim);
  const max = Math.max(out.r, out.g, out.b), min = Math.min(out.r, out.g, out.b);
  if (max <= 0 || (max - min) / max < .3) out.setRGB(.28, .5, 1);
  return out;
}

function smearMaterial(seedValue: number) {
  return new THREE.ShaderMaterial({
    name: 'StrikeSmear', vertexShader: VERTEX, fragmentShader: FRAGMENT,
    uniforms: { uHot: { value: new THREE.Color() }, uRim: { value: new THREE.Color() }, uBody: { value: new THREE.Color() }, uStrength: { value: 1 }, uArmed: { value: 0 }, uDark: { value: 0 },
      uGlow: { value: GLOW }, uClock: { value: 0 }, uSeed: { value: seedValue }, uHeavy: { value: 0 }, uSolid: { value: roanEnabled() ? 1 : 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}

export class StrikeTrails {
  private trails = new Map<string, Trail>();
  private clock = 0;
  private kit: VfxKit;
  constructor(private scene: THREE.Scene) {
    this.kit = VfxKit.for(scene);
    const warm = new THREE.Mesh(new THREE.BufferGeometry(), smearMaterial(0));
    warm.geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    warm.geometry.setAttribute('aTrail', new THREE.Float32BufferAttribute(new Float32Array(6), 2));
    warm.geometry.setAttribute('aAcross', new THREE.Float32BufferAttribute(new Float32Array(3), 1));
    warm.name = 'strike-trail-warmup'; warm.frustumCulled = false; warm.position.y = -50;
    warm.onAfterRender = () => { warm.visible = false; };
    scene.add(warm);
  }
  private create(id: string) {
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(STRIP * 2 * 3), 3), trail = new THREE.BufferAttribute(new Float32Array(STRIP * 2 * 2), 2);
    const across = new THREE.BufferAttribute(new Float32Array(Array.from({ length: STRIP * 2 }, (_, i) => i % 2 ? -1 : 1)), 1);
    positions.setUsage(THREE.DynamicDrawUsage); trail.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positions); geometry.setAttribute('aTrail', trail); geometry.setAttribute('aAcross', across);
    const index: number[] = [];
    for (let i = 0; i < STRIP - 1; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geometry.setIndex(index); geometry.setDrawRange(0, 0);
    const material = smearMaterial(seed(id));
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `strike-trail-${id}`; mesh.frustumCulled = false; mesh.renderOrder = 6;
    this.scene.add(mesh);
    const record: Trail = { mesh, positions, trail, tips: [], inners: [], ages: [], armed: false, heavy: 0,
      spare: Array.from({ length: (SAMPLES + 1) * 2 }, () => new THREE.Vector3()) };
    this.trails.set(id, record); return record;
  }
  update(dt: number, fighters: ReadonlyMap<string, Fighter>, camera: THREE.Camera) {
    camera.getWorldPosition(_cam);
    const budget = this.kit.budget;
    this.clock += dt;
    for (const [id, fighter] of fighters) {
      const s = fighter.state; const trail = this.trails.get(id) ?? this.create(id);
      if(s.fighter==='rengoku'||s.fighter==='meliodas'||s.fighter==='escanor'||s.fighter==='tatsumaki'||s.fighter==='makima'||s.fighter==='kenpachi'||s.fighter==='minato'||s.fighter==='edward-elric'||s.fighter==='pain'||s.fighter==='nico-robin'||s.fighter==='kaiju-no-8'||s.fighter==='eren'&&!!s.awakened||s.fighter==='asuka'||s.fighter==='netero'||s.fighter==='shinji'||s.fighter==='jolyne'||s.fighter==='might-guy'||s.fighter==='akame'||s.fighter==='pikachu'||s.fighter==='garou'||s.fighter==='esdeath'||s.fighter==='mikasa'||s.fighter==='alphonse-elric'||s.fighter==='ken-kaneki'||s.fighter==='grimmjow'||s.fighter==='byakuya'||s.fighter==='yamamoto'||s.fighter==='hiei'||s.fighter==='sakura'||s.fighter==='aokiji'||s.fighter==='doflamingo'||s.fighter==='hisoka'||s.fighter==='blackbeard'||s.fighter==='yuji'||s.fighter==='jinbe'||s.fighter==='gintoki'||s.fighter==='tsunade'||s.fighter==='jiraiya'||s.fighter==='nanami'||s.fighter==='josuke'){this.clear(trail);trail.mesh.visible=false;continue;}
      if (trail.body && trail.body.distanceToSquared(fighter.group.position) > 2.25) this.clear(trail);
      (trail.body ??= new THREE.Vector3()).copy(fighter.group.position);
      const slot = (s.action === 'light' || s.action === 'heavy' || s.action === 'special' || s.action === 'ultimate') ? s.action as AttackSlot : undefined;
      const move = slot ? MOVES[s.fighter][slot] : undefined, elapsed = s.actionTime * s.actionDuration;
      const finisher = slot === 'light' && (s.chain ?? 0) >= 3;
      const roan = roanEnabled();
      const width = (slot === 'heavy' || slot === 'ultimate' || finisher ? (roan ? .27 : .15) : slot === 'special' ? (roan ? .22 : .12) : (roan ? .19 : .1)) * (.7 + .3 * budget);
      let active = false;
      if (move && move.style === 'melee' && s.alive && !s.timeStopped) for (let i = 0, n = beats(s, move); i < n; i++) { const c = move.contacts[i]; if (elapsed > c - .14 && elapsed < c + .07) { active = true; break; } }
      if (active) {
        trail.bold = slot === 'heavy' || slot === 'ultimate' || finisher || !!s.branch;
        const el = elementFor(s.fighter, slot, !!s.awakened);
        const u = trail.mesh.material.uniforms, dark = darkBlade(el);
        u.uDark.value = dark ? 1 : 0;
        if (dark) {
          u.uRim.value.setHex(el.rim); u.uHot.value.setRGB(1.9, 1.35, 1.25);
          u.uBody.value.setRGB(.03, .006, .008);
        } else {
          smearBody(el.rim, u.uBody.value); u.uRim.value.copy(u.uBody.value);
          u.uHot.value.setHex(el.spike).multiplyScalar(2.1);
        }
        const special = fighter.meleeContactPoint(0, _p);
        if (!special) fighter.strikePoint(_p);
        const armed = !special && fighter.armed;
        if (armed !== trail.armed) { this.clear(trail); trail.armed = armed; u.uArmed.value = armed ? 1 : 0; }
        const heavy = armed && _p.distanceTo(fighter.handR) > HEAVY_BLADE ? 1 : 0;
        if (heavy !== trail.heavy) { trail.heavy = heavy; u.uHeavy.value = heavy; }
        if (!trail.tips.length || trail.tips[0].distanceToSquared(_p) > .0004) {
          const tip = trail.tips.length >= SAMPLES ? trail.tips.pop()! : trail.spare.pop() ?? new THREE.Vector3();
          const inner = trail.inners.length >= SAMPLES ? trail.inners.pop()! : trail.spare.pop() ?? new THREE.Vector3();
          if (trail.ages.length >= SAMPLES) trail.ages.pop();
          tip.copy(_p);
          if (armed) inner.copy(fighter.handR).lerp(_p, INNER); else inner.copy(_p);
          trail.tips.unshift(tip); trail.inners.unshift(inner); trail.ages.unshift(0);
        }
      }
      const step = s.hitstop && !s.timeStopped ? dt * .12 : dt;
      for (let i = 0; i < trail.ages.length; i++) trail.ages[i] += step;
      const life = LIFE * (trail.heavy ? HEAVY_LIFE : 1);
      while (trail.ages.length && trail.ages[trail.ages.length - 1] > life) { trail.spare.push(trail.tips.pop()!, trail.inners.pop()!); trail.ages.pop(); }
      const n = trail.tips.length;
      if (n < 2) { trail.mesh.visible = false; continue; }
      trail.mesh.visible = true;
      trail.mesh.material.uniforms.uStrength.value = (.55 + .45 * budget) * (DREAM_IMPACT && !trail.armed && !trail.bold ? .35 : 1);
      trail.mesh.material.uniforms.uClock.value = this.clock;
      let m = 0;
      for (let i = 0; i < n - 1; i++) {
        const p0 = trail.tips[Math.max(0, i - 1)], p1 = trail.tips[i], p2 = trail.tips[i + 1], p3 = trail.tips[Math.min(n - 1, i + 2)];
        const q0 = trail.inners[Math.max(0, i - 1)], q1 = trail.inners[i], q2 = trail.inners[i + 1], q3 = trail.inners[Math.min(n - 1, i + 2)];
        for (let k = 0; k < SUB; k++) {
          const t = k / SUB;
          catmull(p0, p1, p2, p3, t, _curve[m]); catmull(q0, q1, q2, q3, t, _curveIn[m]);
          const age = trail.ages[i] + (trail.ages[i + 1] - trail.ages[i]) * t;
          _curveFade[m] = Math.max(0, 1 - age / life); _curveHead[m] = 1 - (i + t) / (n - 1); m++;
        }
      }
      _curve[m].copy(trail.tips[n - 1]); _curveIn[m].copy(trail.inners[n - 1]);
      _curveFade[m] = Math.max(0, 1 - trail.ages[n - 1] / life); _curveHead[m] = 0; m++;
      for (let i = 0; i < m; i++) {
        const point = _curve[i], next = _curve[Math.min(m - 1, i + 1)], prev = _curve[Math.max(0, i - 1)];
        _dir.subVectors(next, prev); if (_dir.lengthSq() < 1e-8) _dir.set(0, 1, 0);
        _toCam.subVectors(_cam, point);
        _band.crossVectors(_dir, _toCam);
        if (i === 0 || _band.lengthSq() > .02 * _dir.lengthSq() * _toCam.lengthSq()) _side.copy(_band).normalize();
        const fade = _curveFade[i], head = _curveHead[i];
        if (trail.armed) {
          _band.subVectors(_curveIn[i], point).multiplyScalar(.2 + .8 * Math.pow(fade, .7));
          const length = _band.length(), sign = _band.dot(_side) >= 0 ? 1 : -1;
          const facing = length > 1e-6 ? Math.abs(_band.dot(_side)) / length : 1;
          const open = 1 - THREE.MathUtils.smoothstep(facing, .12, .55);
          if (open > 0) _band.lerp(_outer.copy(_side).multiplyScalar(sign * length * .6), open * .85);
          const across = _band.dot(_side), missing = Math.max(0, MIN_BAND * (.4 + .6 * fade) - Math.abs(across));
          _outer.copy(point).addScaledVector(_band, -GLOW).addScaledVector(_side, -sign * missing * .3);
          _inner.copy(point).add(_band).addScaledVector(_side, sign * missing * .7);
        } else {
          const w = width * (.25 + .75 * fade) * (i === 0 ? .55 : 1);
          _outer.copy(point).addScaledVector(_side, w);
          _inner.copy(point).addScaledVector(_side, -w);
        }
        trail.positions.setXYZ(i * 2, _outer.x, _outer.y, _outer.z);
        trail.positions.setXYZ(i * 2 + 1, _inner.x, _inner.y, _inner.z);
        trail.trail.setXY(i * 2, fade, head); trail.trail.setXY(i * 2 + 1, fade, head);
      }
      trail.positions.needsUpdate = true; trail.trail.needsUpdate = true; trail.mesh.geometry.setDrawRange(0, (m - 1) * 6);
    }
    for (const [id, trail] of this.trails) if (!fighters.has(id)) { trail.mesh.removeFromParent(); trail.mesh.geometry.dispose(); trail.mesh.material.dispose(); this.trails.delete(id); }
  }
  private clear(trail: Trail) {
    while (trail.tips.length) trail.spare.push(trail.tips.pop()!);
    while (trail.inners.length) trail.spare.push(trail.inners.pop()!);
    trail.ages.length = 0;
  }
}
