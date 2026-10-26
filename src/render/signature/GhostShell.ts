import * as THREE from 'three';

const skinned = `
#include <common>
#include <skinning_pars_vertex>
`;
const bodyVertex = `${skinned}
varying vec3 vN;varying vec3 vV;
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vN=normalize(transformedNormal);vV=-mvPosition.xyz;
}`;
const bodyFragment = `
uniform vec3 uColor;uniform vec3 uRim;uniform float uOpacity;uniform float uHatch;
varying vec3 vN;varying vec3 vV;
void main(){
  vec3 n=normalize(vN),v=normalize(vV);
  float facing=abs(dot(n,v));
  float rim=pow(1.-facing,3.2);
  float edge=smoothstep(.66,.9,1.-facing);
  float key=.5+.5*clamp(n.y*.7+n.x*.2+.35,0.,1.);
  vec2 f=gl_FragCoord.xy;
  float hatch=smoothstep(.35,.95,sin((f.x+f.y)*.62))*(.3+.7*(1.-key))*uHatch;
  vec3 body=uColor*(key*(1.-.55*hatch));
  float a=uOpacity*(.82+.18*edge);
  gl_FragColor=vec4(body*a+uRim*(edge*.8+rim*.6)*uOpacity,a);
}`;
const rimFragment = `
uniform vec3 uColor;uniform vec3 uRim;uniform float uOpacity;uniform float uHatch;uniform float uTime;uniform float uFill;
varying vec3 vN;varying vec3 vV;varying vec3 vW;
void main(){
  vec3 n=normalize(vN),v=normalize(vV);
  float e=1.-abs(dot(n,v));
  float rim=smoothstep(.5,.8,e),ink=smoothstep(.86,.96,e);
  vec2 f=gl_FragCoord.xy;
  // Hatching only in a band inside the rim, where a pen would shade a form;
  // the middle of the body is left clear.
  float hatch=smoothstep(.72,.98,sin((f.x-f.y)*.5))*smoothstep(.28,.5,e)*(1.-rim)*uHatch;
  float body=smoothstep(.12,.62,e)*uFill;
  float flow=.5+.5*sin(vW.y*4.2-uTime*2.3+sin(vW.x*2.7+vW.z*2.1+uTime*.8)*1.3);
  vec3 col=mix(uRim*rim*1.1+uColor*(hatch*.9+body*(.9+.8*flow))+uRim*body*flow*.25,vec3(.01,.015,.04),ink);
  float a=uOpacity*max(max(rim*.7,ink*.95),.03+hatch*.35+body*(.32+.24*flow));
  gl_FragColor=vec4(col*a,a);
}`;
const rimVertex = `${skinned}
varying vec3 vN;varying vec3 vV;varying vec3 vW;
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vN=normalize(transformedNormal);vV=-mvPosition.xyz;vW=(modelMatrix*vec4(transformed,1.)).xyz;
}`;
const LOOM_WINDOWS = 3;
const loomVertexPars = `
#ifdef GHOST_LOOM
varying vec3 vLoomClip;varying vec3 vLoomRest;
#endif`;
const loomVertex = `
#ifdef GHOST_LOOM
  vLoomClip=gl_Position.xyw;vLoomRest=position;
#endif`;
const loomFragmentPars = `
#ifdef GHOST_LOOM
uniform vec4 uLoomRect[${LOOM_WINDOWS}];uniform vec2 uLoomAt[${LOOM_WINDOWS}];uniform float uDissolve;uniform float uGrain;uniform float uLoomThrough;
varying vec3 vLoomClip;varying vec3 vLoomRest;
float loomKeep(){
  if(vLoomClip.z<=.05)return 1.;
  vec2 ndc=vLoomClip.xy/vLoomClip.z;float keep=1.;
  for(int i=0;i<${LOOM_WINDOWS};i++){
    vec2 at=uLoomAt[i];
    // Round 3f: a shell worn round its subject (uLoomThrough, the Susanoo)
    // thins over it whatever the depth - its far side and its ink hull too,
    // or they show through the window its near side opens (dark patches).
    if(at.x<=0.||(uLoomThrough<.5&&vLoomClip.z>=at.x))continue;
    vec4 r=uLoomRect[i];
    vec2 q=abs(ndc-(r.xy+r.zw)*.5)/max((r.zw-r.xy)*.5,vec2(1e-3));q*=q;
    float inside=(1.-smoothstep(.8,1.3,sqrt(sqrt(q.x*q.x+q.y*q.y))))*max(uLoomThrough,smoothstep(0.,.5,at.x-vLoomClip.z));
    keep=min(keep,mix(1.,at.y,inside));
  }
  return keep;
}
float loomHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float loomNoise(vec3 x){
  vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(loomHash(i),loomHash(i+vec3(1,0,0)),f.x),mix(loomHash(i+vec3(0,1,0)),loomHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(loomHash(i+vec3(0,0,1)),loomHash(i+vec3(1,0,1)),f.x),mix(loomHash(i+vec3(0,1,1)),loomHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
/** How far above the dissolve's threshold this fragment's grain sits: under
 *  zero it is gone. Large while nothing is dissolving. */
float loomGrain(){
  if(uDissolve<=0.)return 1.;
  vec3 p=vLoomRest*uGrain;
  return loomNoise(p)*.72+loomNoise(p*2.7+7.1)*.28-(uDissolve*1.24-.12);
}
#endif`;
const printVertex = `${skinned}
varying vec3 vN;varying vec3 vV;varying vec2 vUv;varying vec3 vW;${loomVertexPars}
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vN=normalize(transformedNormal);vV=-mvPosition.xyz;vUv=uv;vW=(modelMatrix*vec4(transformed,1.)).xyz;${loomVertex}
}`;
const printFragment = `
uniform vec3 uColor;uniform vec3 uRim;uniform float uOpacity;uniform float uHatch;uniform float uTime;
uniform vec3 uShade;uniform vec3 uLight;uniform vec3 uLine;uniform vec2 uLevels;uniform float uFlow;
uniform sampler2D uMap;uniform vec3 uBase;uniform float uGlow;uniform vec4 uGlowUv;
varying vec3 vN;varying vec3 vV;varying vec2 vUv;varying vec3 vW;${loomFragmentPars}
// A value, not a hue: the square root of linear luminance is close enough to
// how light a painted colour looks.
float value(vec2 uv){return sqrt(max(dot(texture2D(uMap,uv).rgb*uBase,vec3(.2126,.7152,.0722)),0.));}
void main(){
  vec3 n=normalize(vN),v=normalize(vV);
  if(!gl_FrontFacing)n=-n;
  float facing=abs(dot(n,v));
  float rim=pow(1.-facing,3.2),edge=smoothstep(.66,.9,1.-facing);
  // Lit from above and a little to the side, in two soft bands.
  float key=smoothstep(.2,.5,n.y*.7+n.x*.25+.3);
  float t=value(vUv);
  // Feature lines: the value's gradient across two screen pixels. Clamped,
  // because across a UV seam the derivative of the UV is the seam.
  vec2 px=clamp(fwidth(vUv),vec2(.00025),vec2(.004));
  float gx=value(vUv+vec2(px.x,0.))-value(vUv-vec2(px.x,0.)),gy=value(vUv+vec2(0.,px.y))-value(vUv-vec2(0.,px.y));
  float line=smoothstep(.09,.2,length(vec2(gx,gy)));
  float painted=1.-smoothstep(.07,.15,t);
  // The print on the ramp, knocked down on the shadow side.
  float s=smoothstep(uLevels.x,uLevels.y,t)*(.6+.4*key);
  vec3 body=s<.5?mix(uShade,uColor,s*2.):mix(uColor,uLight,s*2.-1.);
  // Hatching: thin lines, only where the form turns into shade.
  vec2 f=gl_FragCoord.xy;
  float hatch=smoothstep(.82,.98,sin((f.x+f.y)*.55))*(1.-smoothstep(.15,.42,s))*uHatch;
  body*=1.-.3*hatch;
  float ink=max(line,painted);
  body=mix(body,uLine,ink*.92);
  // The living glow: the edge breathes and bands of the Stand's light climb it.
  float breathe=.82+.18*sin(uTime*2.7+vW.y*1.3);
  float climb=pow(.5+.5*sin(vW.y*7.-uTime*3.4+sin(vW.x*5.+vW.z*4.+uTime*.9)*1.4),10.)*uFlow;
  vec3 glow=uRim*((edge*.75+rim*.55)*breathe+climb*(.18+.6*rim)*(1.-ink));
  // Dark tones hold more of the body than light ones: a painted black is
  // meant to be a solid thing - hair, a mask - not a window on the room.
  float a=min(1.,uOpacity*(.84+.16*edge+.4*ink+.25*(1.-s)));
  // A part that is light, not surface (the eyes): burning, and solid.
  vec2 g0=step(uGlowUv.xy,vUv)*step(vUv,uGlowUv.zw);
  float shine=max(uGlow,g0.x*g0.y);
  vec3 lit=mix(uLight,vec3(2.2),.35)*(1.3+.5*t);
  body=mix(body,lit,shine);a=mix(a,min(1.,uOpacity*1.6),shine);
  gl_FragColor=vec4(body*a+glow*uOpacity,a);
#ifdef GHOST_LOOM
  // Breaking up (see loomGrain), the edge just above the break burning.
  float grain=loomGrain();
  if(grain<0.)discard;
  float burn=1.-smoothstep(0.,.07,grain);
  gl_FragColor=mix(gl_FragColor,vec4(uRim*1.6*uOpacity,uOpacity),burn);
  gl_FragColor*=loomKeep();
#endif
}`;
const depthVertex = `${skinned}${loomVertexPars}
void main(){
  #include <begin_vertex>
  #include <skinbase_vertex>
  #include <skinning_vertex>
  #include <project_vertex>${loomVertex}
}`;
const depthFragment = `${loomFragmentPars}
void main(){
#ifdef GHOST_LOOM
  if(loomGrain()<0.||loomKeep()<.5)discard;
#endif
  gl_FragColor=vec4(0.);
}`;
const inkVertex = `${skinned}${loomVertexPars}
uniform float uWidth;uniform vec2 uViewport;
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vec3 nv=normalize(normalMatrix*objectNormal);
  vec2 d=(projectionMatrix*vec4(nv,0.)).xy;float l=length(d);
  if(l>1e-5)gl_Position.xy+=d/l*uWidth*2./uViewport*gl_Position.w;
  gl_Position.z+=.0004*gl_Position.w;${loomVertex}
}`;
const inkFragment = `uniform vec3 uInk;uniform float uOpacity;${loomFragmentPars}
void main(){
  gl_FragColor=vec4(uInk*uOpacity,uOpacity);
#ifdef GHOST_LOOM
  // Gone before the depth pass is: its hull shows through where that is.
  if(loomGrain()<0.)discard;
  gl_FragColor*=smoothstep(.5,.85,loomKeep());
#endif
}`;
const premultiplied = { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor } as const;
const viewport = new THREE.Vector4(), _anchor = new THREE.Vector3(), _eye = new THREE.Vector3(), _axis = new THREE.Vector3(), _segment = new THREE.Line3();
let white: THREE.DataTexture | undefined;
const blank = () => { if (!white) { white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); white.needsUpdate = true; } return white; };

export interface GhostPrint {
  shade: THREE.ColorRepresentation;
  light: THREE.ColorRepresentation;
  line?: THREE.ColorRepresentation;
  levels?: readonly [number, number];
  flow?: number;
  glow?: RegExp;
  glowUv?: readonly [number, number, number, number];
  loom?: boolean;
  through?: boolean;
  base?: THREE.ColorRepresentation;
  bases?: readonly (readonly [RegExp, THREE.ColorRepresentation | number])[];
}
export interface LoomSubject { group: THREE.Object3D; joints?: ReadonlyMap<string, THREE.Object3D> }
const LOOM_JOINTS = ['Head', 'Hips', 'LeftFoot', 'RightFoot', 'LeftHand', 'RightHand', 'LeftShoulder', 'RightShoulder'] as const;
const LOOM_PAD = .3, LOOM_AHEAD = .3, LOOM_CROWN = 1.9;
const _loomPoint = new THREE.Vector3(), _loomView = new THREE.Vector3();

type Entry = { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; color: THREE.Mesh; ink: THREE.Mesh };
const ghostMesh = (source: THREE.Mesh, material: THREE.Material | THREE.Material[], order: number, name: string) => {
  const skin = source as THREE.SkinnedMesh;
  const mesh = skin.isSkinnedMesh ? new THREE.SkinnedMesh(source.geometry, material) : new THREE.Mesh(source.geometry, material);
  if (skin.isSkinnedMesh) { (mesh as THREE.SkinnedMesh).bind(skin.skeleton, skin.bindMatrix); (mesh as THREE.SkinnedMesh).bindMode = skin.bindMode; }
  mesh.name = source.name + name; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.matrix.identity();
  mesh.castShadow = mesh.receiveShadow = false; mesh.renderOrder = order; mesh.visible = false;
  source.add(mesh); return mesh;
};

export class GhostShell {
  readonly body: THREE.ShaderMaterial;
  readonly depth: THREE.ShaderMaterial;
  readonly ink: THREE.ShaderMaterial;
  private prints = new Map<THREE.Material, THREE.ShaderMaterial>();
  private entries: Entry[] = [];
  private outlines: THREE.Object3D[] = [];
  private on = false;
  private base = 1;
  private anchor?: THREE.Object3D; private axis?: THREE.Object3D; private near = 0; private far = 0;
  readonly rimOnly: boolean;
  private loom?: { uLoomRect: { value: THREE.Vector4[] }; uLoomAt: { value: THREE.Vector2[] }; uDissolve: { value: number }; uGrain: { value: number }; uLoomThrough: { value: number } };
  private loomSubjects: (LoomSubject | undefined)[] = [];
  private loomKeep: number[] = [];
  private loomFrame = -1; private loomCamera?: THREE.Camera;
  private loomBox = { x0: 0, y0: 0, x1: 0, y1: 0, sum: 0, count: 0 };
  constructor(root: THREE.Object3D, color: THREE.ColorRepresentation, rim: THREE.ColorRepresentation, opacity = .62, ink: THREE.ColorRepresentation = 0x07040f, inkPixels = 2.2, rimOnly = false, print?: GhostPrint) {
    this.rimOnly = rimOnly; this.base = opacity;
    const printed = !!print && !rimOnly, loom = printed && !!print.loom;
    if (loom) this.loom = { uLoomRect: { value: Array.from({ length: LOOM_WINDOWS }, () => new THREE.Vector4(2, 2, 2, 2)) }, uLoomAt: { value: Array.from({ length: LOOM_WINDOWS }, () => new THREE.Vector2(0, 1)) }, uDissolve: { value: 0 }, uGrain: { value: 1 }, uLoomThrough: { value: print?.through ? 1 : 0 } };
    const defines = loom ? { defines: { GHOST_LOOM: '' } } : {};
    this.body = new THREE.ShaderMaterial({ name: rimOnly ? 'GhostShellRim' : printed ? 'GhostShellPrint' : 'GhostShellBody', vertexShader: printed ? printVertex : rimOnly ? rimVertex : bodyVertex, fragmentShader: rimOnly ? rimFragment : printed ? printFragment : bodyFragment, depthWrite: false, depthFunc: THREE.LessEqualDepth, toneMapped: false, ...premultiplied, ...defines,
      uniforms: { uColor: { value: new THREE.Color(color) }, uRim: { value: new THREE.Color(rim) }, uOpacity: { value: opacity }, uHatch: { value: 1 }, ...this.loom } });
    if (rimOnly) Object.assign(this.body.uniforms, { uTime: { value: 0 }, uFill: { value: 1 } });
    if (printed) Object.assign(this.body.uniforms, {
      uTime: { value: 0 }, uShade: { value: new THREE.Color(print.shade) }, uLight: { value: new THREE.Color(print.light) }, uLine: { value: new THREE.Color(print.line ?? ink) },
      uLevels: { value: new THREE.Vector2(...(print.levels ?? [.08, .9])) }, uFlow: { value: print.flow ?? 1 },
      uMap: { value: blank() }, uBase: { value: new THREE.Color(1, 1, 1) }, uGlow: { value: 0 }, uGlowUv: { value: new THREE.Vector4(...(print.glowUv ?? [2, 2, -1, -1])) } });
    this.depth = new THREE.ShaderMaterial({ name: 'GhostShellDepth', vertexShader: depthVertex, fragmentShader: depthFragment, colorWrite: false, depthWrite: true, ...defines, uniforms: { ...this.loom } });
    this.ink = new THREE.ShaderMaterial({ name: 'GhostShellInk', vertexShader: inkVertex, fragmentShader: inkFragment, side: THREE.BackSide, depthWrite: false, toneMapped: false, ...premultiplied, ...defines,
      uniforms: { uInk: { value: new THREE.Color(ink) }, uOpacity: { value: 1 }, uWidth: { value: inkPixels }, uViewport: { value: new THREE.Vector2(1600, 900) }, ...this.loom } });
    const meshes: THREE.Mesh[] = [];
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (/-ink$|outline|contact-shadow|shadow/i.test(mesh.name)) { this.outlines.push(mesh); return; }
      meshes.push(mesh);
    });
    for (const mesh of meshes) {
      if (!mesh.visible) continue;
      if (rimOnly) { this.entries.push({ mesh, original: mesh.material, color: mesh, ink: mesh }); continue; }
      const surface = printed ? (Array.isArray(mesh.material) ? mesh.material.map(m => this.printFor(m, print)) : this.printFor(mesh.material, print)) : this.body;
      const color = ghostMesh(mesh, surface, 2, '-ghost'), inkMesh = ghostMesh(mesh, this.ink, 3, '-ghost-ink');
      inkMesh.onBeforeRender = renderer => { renderer.getCurrentViewport(viewport); if (viewport.w > 0) (this.ink.uniforms.uViewport.value as THREE.Vector2).set(viewport.z, viewport.w); };
      this.entries.push({ mesh, original: mesh.material, color, ink: inkMesh });
    }
    if (this.loom) {
      let tall = 0;
      for (const e of this.entries) { const g = e.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox(); tall = Math.max(tall, g.boundingBox!.max.y - g.boundingBox!.min.y); }
      this.loom.uGrain.value = 26 / Math.max(tall, 1e-3);
      for (const e of this.entries) {
        const before = e.mesh.onBeforeRender.bind(e.mesh);
        e.mesh.onBeforeRender = (renderer, scene, camera, geometry, material, group) => { before(renderer, scene, camera, geometry, material, group); this.windows(renderer, camera); };
      }
    }
  }
  setWindow(slot: number, subject: LoomSubject | undefined, keep = .15) { if (slot < 0 || slot >= LOOM_WINDOWS) return; this.loomSubjects[slot] = subject; this.loomKeep[slot] = keep; }
  set dissolve(value: number) { if (this.loom) this.loom.uDissolve.value = value; }
  get dissolve() { return this.loom?.uDissolve.value ?? 0; }
  private windows(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    const frame = renderer.info.render.frame;
    if (!this.loom || (frame === this.loomFrame && camera === this.loomCamera)) return;
    this.loomFrame = frame; this.loomCamera = camera;
    const rects = this.loom.uLoomRect.value, at = this.loom.uLoomAt.value, box = this.loomBox;
    for (let i = 0; i < LOOM_WINDOWS; i++) {
      const subject = this.loomSubjects[i];
      at[i].set(0, 1);
      if (!subject || !subject.group.visible) continue;
      box.x0 = box.y0 = Infinity; box.x1 = box.y1 = -Infinity; box.sum = 0; box.count = 0;
      if (subject.joints) for (const name of LOOM_JOINTS) { const joint = subject.joints.get(name); if (joint) this.boxPoint(joint.getWorldPosition(_loomPoint), camera); }
      if (!box.count) { const p = subject.group.position; for (let k = 0; k < 3; k++) this.boxPoint(_loomPoint.set(p.x, p.y + LOOM_CROWN * k / 2, p.z), camera); }
      if (!box.count) continue;
      rects[i].set(box.x0, box.y0, box.x1, box.y1); at[i].set(Math.max(.01, box.sum / box.count - LOOM_AHEAD), this.loomKeep[i] ?? 1);
    }
  }
  private boxPoint(point: THREE.Vector3, camera: THREE.Camera) {
    const box = this.loomBox, e = camera.projectionMatrix.elements;
    const depth = -_loomView.copy(point).applyMatrix4(camera.matrixWorldInverse).z;
    if (depth < .05) return;
    point.project(camera);
    const up = LOOM_PAD / depth * e[5], across = LOOM_PAD / depth * e[0];
    box.x0 = Math.min(box.x0, point.x - across); box.x1 = Math.max(box.x1, point.x + across);
    box.y0 = Math.min(box.y0, point.y - up); box.y1 = Math.max(box.y1, point.y + up);
    box.sum += depth; box.count++;
  }
  private printFor(source: THREE.Material, print: GhostPrint) {
    let material = this.prints.get(source);
    if (material) return material;
    const src = source as THREE.MeshToonMaterial, u = this.body.uniforms;
    material = new THREE.ShaderMaterial({ name: 'GhostShellPrint', vertexShader: printVertex, fragmentShader: printFragment, depthWrite: false, depthFunc: THREE.LessEqualDepth, toneMapped: false, ...premultiplied, ...(this.loom ? { defines: { GHOST_LOOM: '' } } : {}),
      uniforms: { ...u, uMap: { value: src.map ?? blank() }, uBase: { value: ((part = print.bases?.find(([match]) => match.test(source.name))?.[1]) => part !== undefined ? (typeof part === 'number' && part < 32 ? new THREE.Color(part, part, part) : new THREE.Color(part)) : print.base !== undefined ? new THREE.Color(print.base) : src.color ? src.color.clone() : new THREE.Color(1, 1, 1))() }, uGlow: { value: print.glow?.test(source.name) ? 1 : 0 } } });
    this.prints.set(source, material);
    return material;
  }
  set clock(time: number) { const u = this.body.uniforms.uTime; if (u) u.value = time; }
  get enabled() { return this.on; }
  set enabled(on: boolean) {
    if (on === this.on) return;
    this.on = on;
    for (const e of this.entries) {
      if (this.rimOnly) { e.mesh.material = on ? this.body : e.original; continue; }
      e.mesh.material = on ? this.depth : e.original; e.mesh.renderOrder = on ? 1 : 0; e.color.visible = e.ink.visible = on;
    }
    for (const o of this.outlines) if (o.name.endsWith('-ink') || /outline/i.test(o.name)) o.visible = !on;
  }
  set opacity(value: number) {
    this.base = value;
    this.body.uniforms.uOpacity.value = value; this.ink.uniforms.uOpacity.value = Math.min(1, value * 1.5);
    if (!this.rimOnly) for (const e of this.entries) { const shown = this.on && value > .01; e.color.visible = e.ink.visible = shown; e.mesh.visible = !this.on || shown; }
  }
  fadeRange(near: number, far: number, axis?: THREE.Object3D) { this.near = near; this.far = far; this.axis = axis; }
  fadeNear(anchor: THREE.Object3D, near: number, far: number) {
    this.anchor = anchor; this.near = near; this.far = far;
    const first = this.entries[0]?.mesh;
    if (!first) return;
    const before = first.onBeforeRender.bind(first);
    first.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
      before(renderer, scene, camera, geometry, material, group);
      if (!this.anchor) return;
      this.anchor.getWorldPosition(_anchor); camera.getWorldPosition(_eye);
      if (this.axis) { this.axis.getWorldPosition(_axis); _segment.set(_anchor, _axis).closestPointToPoint(_eye, true, _anchor); }
      const distance = _eye.distanceTo(_anchor), k = THREE.MathUtils.smoothstep(distance, this.near, this.far);
      this.body.uniforms.uOpacity.value = this.base * k; this.ink.uniforms.uOpacity.value = Math.min(1, this.base * 1.5) * k;
      if (this.rimOnly) { const u = this.body.uniforms, span = this.far - this.near; u.uTime.value = performance.now() / 1000; u.uFill.value = THREE.MathUtils.smoothstep(distance, this.near + span * .2, this.near + span * .7); }
    };
  }
  setColors(color: THREE.ColorRepresentation, rim: THREE.ColorRepresentation) { (this.body.uniforms.uColor.value as THREE.Color).set(color); (this.body.uniforms.uRim.value as THREE.Color).set(rim); }
  dispose() {
    this.enabled = false;
    if (!this.rimOnly) for (const e of this.entries) { e.color.removeFromParent(); e.ink.removeFromParent(); }
    this.entries = []; this.body.dispose(); this.depth.dispose(); this.ink.dispose();
    for (const material of this.prints.values()) material.dispose();
    this.prints.clear();
  }
}

export function warmGhosts(scene: THREE.Scene) {
  const group = new THREE.Group(); group.name = 'ghost-shell-warm'; group.position.set(0, -50, 0); group.scale.setScalar(.001);
  const geometry = new THREE.BoxGeometry(1, 1, 1), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4); for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bone = new THREE.Bone(), skinned = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  skinned.add(bone); skinned.bind(new THREE.Skeleton([bone]));
  const rigid = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  group.add(skinned, rigid); scene.add(group);
  const skinnedRim = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); skinnedRim.add(new THREE.Bone()); skinnedRim.bind(new THREE.Skeleton([skinnedRim.children[0] as THREE.Bone])); group.add(skinnedRim);
  const printed = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); printed.add(new THREE.Bone()); printed.bind(new THREE.Skeleton([printed.children[0] as THREE.Bone])); group.add(printed);
  const printedRigid = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); group.add(printedRigid);
  const looming = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); looming.add(new THREE.Bone()); looming.bind(new THREE.Skeleton([looming.children[0] as THREE.Bone])); group.add(looming);
  const print: GhostPrint = { shade: 0x101040, light: 0xffffff };
  const shells = [new GhostShell(skinned, 0x3344cc, 0xffffff), new GhostShell(rigid, 0x3344cc, 0xffffff), new GhostShell(skinnedRim, 0x3344cc, 0xffffff, .5, 0, 2, true),
    new GhostShell(printed, 0x3344cc, 0xffffff, .6, 0, 2, false, print), new GhostShell(printedRigid, 0x3344cc, 0xffffff, .6, 0, 2, false, print),
    new GhostShell(looming, 0x3344cc, 0xffffff, .6, 0, 2, false, { ...print, loom: true })];
  for (const shell of shells) shell.enabled = true;
  group.traverse(o => { o.frustumCulled = false; });
  skinned.onAfterRender = () => { group.visible = false; };
  return { dispose() { group.removeFromParent(); for (const shell of shells) shell.dispose(); geometry.dispose(); for (const mesh of [skinned, rigid, skinnedRim, printed, printedRigid, looming]) (mesh.material as THREE.Material).dispose(); skinned.skeleton.dispose(); skinnedRim.skeleton.dispose(); printed.skeleton.dispose(); looming.skeleton.dispose(); } };
}
