import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


export const ROLLER_TIMING = { drop: 1, from: 6.5, held: 2.3, hold: .7, settle: 1.95, slam: .15, wreck: .55, breakUp: .45 } as const;

export interface RollerPose {
  height: number;
  tilt: number;
  squash: number;
  since: number;
  broken: number;
  opacity: number;
}

export function rollerAt(elapsed: number, finisher: number): RollerPose | undefined {
  const T = ROLLER_TIMING, since = elapsed - finisher;
  if (since < -T.drop || since >= T.wreck + T.breakUp) return undefined;
  if (since < -T.hold) {
    const e = 1 - (since + T.drop) / (T.drop - T.hold);
    return { height: T.held + (T.from - T.held) * e * e, tilt: .12 + .26 * e, squash: 1, since, broken: 0, opacity: 1 };
  }
  if (since < -T.slam) {
    const e = (since + T.hold) / (T.hold - T.slam);
    return { height: T.held + (T.settle - T.held) * e, tilt: .12 * (1 - e) + .05 * e, squash: 1, since, broken: 0, opacity: 1 };
  }
  if (since < 0) {
    const e = 1 + since / T.slam;
    return { height: T.settle * (1 - e * e), tilt: .05 * (1 - e), squash: 1, since, broken: 0, opacity: 1 };
  }
  const squash = .8 + .1 * THREE.MathUtils.smoothstep(since, 0, .12);
  const broken = THREE.MathUtils.clamp((since - T.wreck) / T.breakUp, 0, 1);
  return { height: 0, tilt: 0, squash, since, broken, opacity: 1 - THREE.MathUtils.smoothstep(broken, .3, 1) };
}

const TOON_VERTEX = `
varying vec3 vN;varying vec3 vV;varying vec2 vUv;
void main(){
  vec4 world=modelMatrix*vec4(position,1.);
  vN=normalize(mat3(modelMatrix)*normal);vV=cameraPosition-world.xyz;vUv=uv;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
const TOON_FRAGMENT = `
uniform vec3 uLit;uniform vec3 uShade;uniform float uOpacity;uniform sampler2D uMap;
varying vec3 vN;varying vec3 vV;varying vec2 vUv;
void main(){
  vec3 n=normalize(vN),v=normalize(vV);
  // The sourced paint is a Substance olive-yellow made for PBR light: lifted
  // (a power under one) and its saturated texels warmed from olive toward
  // road-roller yellow. White - the primitives' map - is left exactly white.
  vec3 paint=pow(texture2D(uMap,vUv).rgb,vec3(.7));
  float pmax=max(paint.r,max(paint.g,paint.b)),psat=(pmax-min(paint.r,min(paint.g,paint.b)))/max(pmax,1e-3);
  paint.g*=mix(1.,.86,psat);
  float l=dot(n,normalize(vec3(.35,.85,.45)));
  float lit=smoothstep(.02,.12,l),high=smoothstep(.72,.8,l);
  vec3 col=mix(uShade,uLit,lit)*paint+uLit*paint*high*.25;
  float rim=smoothstep(.62,.8,1.-abs(dot(n,v)));
  col=mix(col,uLit*paint*1.1+.04,rim*.35);
  vec2 f=gl_FragCoord.xy;
  col*=1.-.3*smoothstep(.8,.97,sin((f.x-f.y)*.6))*(1.-lit);
  gl_FragColor=vec4(col*uOpacity,uOpacity);
}`;
const INK_FRAGMENT = `uniform float uOpacity;void main(){gl_FragColor=vec4(vec3(0.),uOpacity);}`;
const premultiplied = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } as const;

export const ROLLER_ASSET = '/assets/props/road-roller1.glb';
export const ROADROLLER_ASSETS = [ROLLER_ASSET] as const;
const PIECES: Record<string, { fly: [number, number, number]; spin: [number, number, number] }> = {
  'drum-front': { fly: [0, 2.2, 5.5], spin: [9, 0, 0] },
  'drum-rear': { fly: [.3, 2.4, -4.8], spin: [-9, 0, 1] },
  hood: { fly: [.8, 5.2, 2.6], spin: [3, 1, 2] },
  engine: { fly: [-.6, 4.2, -2], spin: [-2, 1.5, 1] },
  seat: { fly: [-1.4, 6.2, -.4], spin: [-3, 2, 2.5] },
  rollbar: { fly: [1.4, 7.5, -1.8], spin: [4, -3, 3] },
  chassis: { fly: [.4, 2, .3], spin: [1, .5, -1] },
};
const SOURCED = { lit: new THREE.Color(1.6, 1.55, 1.2), shade: new THREE.Color(.6, .58, .76) };
const WHITE = (() => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; })();

interface PartSpec { geometry: THREE.BufferGeometry; paint: 'yellow' | 'iron' | 'glass' | 'tyre' | 'sourced'; at: THREE.Matrix4; fly: THREE.Vector3; spin: THREE.Vector3 }
const PAINT = {
  yellow: [new THREE.Color(1, .74, .06), new THREE.Color(.62, .3, .02)],
  iron: [new THREE.Color(.36, .38, .44), new THREE.Color(.09, .095, .12)],
  glass: [new THREE.Color(.34, .5, .62), new THREE.Color(.06, .1, .14)],
  tyre: [new THREE.Color(.17, .17, .19), new THREE.Color(.045, .045, .05)],
} as const;
const at = (x: number, y: number, z: number, rx = 0, rz = 0) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)).setPosition(x, y, z);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function buildParts(): PartSpec[] {
  const drum = new THREE.CylinderGeometry(.56, .56, 1.5, 22), rim = new THREE.CylinderGeometry(.6, .6, .1, 22);
  const yoke = new THREE.BoxGeometry(1.62, .22, .7), body = new THREE.BoxGeometry(1.25, .78, 1.55), hood = new THREE.BoxGeometry(1.1, .2, 1.1);
  const cab = new THREE.BoxGeometry(1.02, .7, .82), roof = new THREE.BoxGeometry(1.16, .08, .96), glass = new THREE.BoxGeometry(1.04, .38, .84);
  const stack = new THREE.CylinderGeometry(.06, .07, .55, 8), tyre = new THREE.CylinderGeometry(.46, .46, .32, 16), hub = new THREE.CylinderGeometry(.2, .2, .34, 10);
  const side = Math.PI / 2;
  return [
    { geometry: drum, paint: 'iron', at: at(0, .56, .98, 0, side), fly: v(0, 2.2, 5.5), spin: v(9, 0, 0) },
    { geometry: rim, paint: 'yellow', at: at(.74, .56, .98, 0, side), fly: v(2.6, 3, 4.5), spin: v(8, 0, 2) },
    { geometry: rim, paint: 'yellow', at: at(-.74, .56, .98, 0, side), fly: v(-2.6, 3, 4.5), spin: v(8, 0, -2) },
    { geometry: yoke, paint: 'yellow', at: at(0, 1.2, .95), fly: v(.6, 5, 2.4), spin: v(3, 1, 2) },
    { geometry: body, paint: 'yellow', at: at(0, .98, -.28), fly: v(-.4, 3.4, -1.6), spin: v(-1.5, .8, 1) },
    { geometry: hood, paint: 'iron', at: at(0, 1.47, -.45), fly: v(.8, 5.5, -1.2), spin: v(2, 3, -2) },
    { geometry: cab, paint: 'yellow', at: at(0, 1.72, -.52), fly: v(-1, 6.2, -2.4), spin: v(-3, 2, 2.5) },
    { geometry: glass, paint: 'glass', at: at(0, 1.8, -.52), fly: v(-1, 6.2, -2.4), spin: v(-3, 2, 2.5) },
    { geometry: roof, paint: 'yellow', at: at(0, 2.11, -.52), fly: v(1.4, 7.5, -1.8), spin: v(4, -3, 3) },
    { geometry: stack, paint: 'iron', at: at(.42, 1.75, .2), fly: v(2.4, 6.5, .6), spin: v(6, 0, 5) },
    { geometry: tyre, paint: 'tyre', at: at(.66, .46, -.92, 0, side), fly: v(4.4, 2.4, -2), spin: v(0, 0, 11) },
    { geometry: tyre, paint: 'tyre', at: at(-.66, .46, -.92, 0, side), fly: v(-4.4, 2.4, -2), spin: v(0, 0, -11) },
    { geometry: hub, paint: 'yellow', at: at(.7, .46, -.92, 0, side), fly: v(4.4, 2.4, -2), spin: v(0, 0, 11) },
    { geometry: hub, paint: 'yellow', at: at(-.7, .46, -.92, 0, side), fly: v(-4.4, 2.4, -2), spin: v(0, 0, -11) },
  ];
}

const SCALE = 1.5, GRAVITY = 16, INK = 1.05;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _spin = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _squash = new THREE.Matrix4(), HULL = new THREE.Matrix4().makeScale(INK, INK, INK);

export class RoadRoller {
  readonly group = new THREE.Group();
  private opacity = { value: 1 };
  private materials: THREE.ShaderMaterial[] = [];
  private paints = new Map<string, THREE.ShaderMaterial>();
  private ink: THREE.ShaderMaterial;
  private parts: { spec: PartSpec; mesh: THREE.Mesh; ink: THREE.Mesh }[] = [];
  target?: string; yaw = 0; landed = false; broke = false; live = false; nextSmoke = 0;
  readonly spot = new THREE.Vector3();
  constructor(specs: PartSpec[], map?: THREE.Texture) {
    this.group.name = 'road-roller'; this.group.visible = false;
    for (const [name, [lit, shade]] of Object.entries(PAINT)) this.paints.set(name, this.paint(lit, shade, WHITE));
    this.paints.set('sourced', this.paint(SOURCED.lit, SOURCED.shade, map ?? WHITE));
    this.ink = new THREE.ShaderMaterial({ name: 'RoadRollerInk', vertexShader: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: INK_FRAGMENT,
      side: THREE.BackSide, transparent: true, ...premultiplied, uniforms: { uOpacity: this.opacity } });
    this.materials.push(this.ink);
    this.build(specs);
  }
  private paint(lit: THREE.Color, shade: THREE.Color, map: THREE.Texture) {
    const m = new THREE.ShaderMaterial({ name: 'RoadRollerToon', vertexShader: TOON_VERTEX, fragmentShader: TOON_FRAGMENT, transparent: true, toneMapped: false, ...premultiplied,
      uniforms: { uLit: { value: lit.clone() }, uShade: { value: shade.clone() }, uOpacity: this.opacity, uMap: { value: map } } });
    this.materials.push(m);
    return m;
  }
  build(specs: PartSpec[], map?: THREE.Texture) {
    if (map) (this.paints.get('sourced')!.uniforms.uMap as { value: THREE.Texture }).value = map;
    for (const part of this.parts) part.mesh.removeFromParent(), part.ink.removeFromParent();
    this.parts = [];
    for (const spec of specs) {
      const mesh = new THREE.Mesh(spec.geometry, this.paints.get(spec.paint)!), hull = new THREE.Mesh(spec.geometry, this.ink);
      mesh.name = 'road-roller-part'; hull.name = 'road-roller-ink';
      mesh.matrixAutoUpdate = hull.matrixAutoUpdate = false; mesh.frustumCulled = hull.frustumCulled = false;
      this.group.add(mesh, hull); this.parts.push({ spec, mesh, ink: hull });
    }
    this.pose({ height: 0, tilt: 0, squash: 1, since: -1, broken: 0, opacity: 1 }, 0);
  }
  get sourced() { return this.parts.some(p => p.spec.paint === 'sourced'); }
  pose(p: RollerPose, shake: number) {
    this.opacity.value = p.opacity;
    const flight = p.broken * ROLLER_TIMING.breakUp;
    _squash.makeScale(1 + (1 - p.squash) * .35, p.squash, 1 + (1 - p.squash) * .35);
    for (const part of this.parts) {
      _m.copy(part.spec.at);
      if (flight > 0) {
        _m.decompose(_p, _q, _s);
        const f = part.spec.fly, w = part.spec.spin;
        _p.set(_p.x + f.x * flight, Math.max(.1, _p.y + f.y * flight - .5 * GRAVITY * flight * flight), _p.z + f.z * flight);
        _q.premultiply(_spin.setFromEuler(_e.set(w.x * flight, w.y * flight, w.z * flight)));
        _m.compose(_p, _q, _s);
      }
      part.mesh.matrix.multiplyMatrices(_squash, _m);
      part.ink.matrix.multiplyMatrices(part.mesh.matrix, HULL);
    }
    this.group.scale.setScalar(SCALE);
    this.group.rotation.set(p.tilt, this.yaw, 0, 'YXZ');
    this.group.position.set(this.spot.x + (shake ? (Math.random() - .5) * shake : 0), this.spot.y + p.height + (shake ? Math.random() * shake : 0), this.spot.z);
  }
  dispose() { this.group.removeFromParent(); for (const m of this.materials) m.dispose(); }
}

export class RoadRollers {
  private specs = buildParts();
  private pool = new Map<string, RoadRoller>();
  private spare: RoadRoller[] = [];
  private map?: THREE.Texture;
  constructor(private scene: THREE.Scene) {
    const warm = this.make();
    this.warmUp(warm);
    this.spare.push(warm);
    if (typeof document !== 'undefined') void this.load();
  }
  private warm?: THREE.Object3D;
  private warmUp(roller: RoadRoller) {
    this.settle();
    roller.group.visible = true; roller.spot.set(0, -60, 0); roller.pose({ height: 0, tilt: 0, squash: 1, since: -1, broken: 0, opacity: 1 }, 0);
    this.warm = roller.group.children[0];
    this.warm.onAfterRender = () => { roller.group.visible = false; this.settle(); };
  }
  private settle() { if (this.warm) { this.warm.onAfterRender = () => {}; this.warm = undefined; } }
  private make() { const roller = new RoadRoller(this.specs, this.map); this.scene.add(roller.group); return roller; }
  async load() {
    try {
      const gltf = await new GLTFLoader().loadAsync(ROLLER_ASSET);
      gltf.scene.updateMatrixWorld(true);
      const specs: PartSpec[] = [];
      let map: THREE.Texture | undefined;
      gltf.scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const piece = PIECES[mesh.name.replace(/^roller-/, '')] ?? PIECES.chassis;
        map ??= (mesh.material as THREE.MeshStandardMaterial).map ?? undefined;
        specs.push({ geometry: mesh.geometry, paint: 'sourced', at: mesh.matrixWorld.clone(), fly: new THREE.Vector3(...piece.fly), spin: new THREE.Vector3(...piece.spin) });
      });
      if (!specs.length) return;
      const old = this.specs;
      this.specs = specs; this.map = map;
      for (const roller of [...this.pool.values(), ...this.spare]) roller.build(specs, map);
      for (const geometry of new Set(old.map(s => s.geometry))) geometry.dispose();
      const idle = this.spare[this.spare.length - 1];
      if (idle) this.warmUp(idle);
    } catch (error) { console.warn('Road roller model did not load; drawing the primitives', error); }
  }
  for(id: string) {
    let roller = this.pool.get(id);
    if (!roller) { this.settle(); roller = this.spare.pop() ?? this.make(); roller.live = false; roller.group.visible = false; this.pool.set(id, roller); }
    return roller;
  }
  get(id: string) { return this.pool.get(id); }
  release(id: string) { const roller = this.pool.get(id); if (!roller) return; roller.group.visible = false; roller.live = false; this.pool.delete(id); this.spare.push(roller); }
  reset() { for (const id of [...this.pool.keys()]) this.release(id); }
  dispose() {
    for (const roller of [...this.pool.values(), ...this.spare]) roller.dispose();
    this.pool.clear(); this.spare = [];
    for (const spec of new Set(this.specs.map(s => s.geometry))) spec.dispose();
    this.map?.dispose();
  }
}
