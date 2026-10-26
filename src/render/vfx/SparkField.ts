import * as THREE from 'three';
import { noiseGLSL } from './noise';
import { noiseTexture, NOISE_GLSL } from './noiseTexture';
import { VEIL_GLSL, veilUniforms } from './VictimVeil';
import { INK_IMPACT_URL } from './inkImpactAtlas';

export const SPRITE = { core: 0, star: 1, ring: 2, streak: 3, puff: 4, flare: 5, shard: 7, glow: 8, burst: 9, ink: 10, szstar: 11, bolt: 12, crescent: 13, bubble: 14, flame: 15, cloud: 16, celshard: 17 } as const;
export const DREAM_KINDS = 11;
const inkUniforms: { value: THREE.Texture }[] = [];
let inkReady = false, inkLoading = false, inkLoaded: THREE.Texture | undefined;
let inkBlank: THREE.Texture | undefined;
const inkTexture = () => {
  if (inkLoaded) return inkLoaded;
  if (!inkBlank) { inkBlank = new THREE.DataTexture(new Uint8Array(4), 1, 1); inkBlank.needsUpdate = true; }
  return inkBlank;
};
export function loadInkImpacts() {
  if (inkLoading || typeof document === 'undefined') return;
  inkLoading = true;
  new THREE.TextureLoader().load(INK_IMPACT_URL, loaded => {
    loaded.colorSpace = THREE.NoColorSpace; loaded.generateMipmaps = true; loaded.minFilter = THREE.LinearMipmapLinearFilter; loaded.anisotropy = 4;
    inkLoaded = loaded;
    for (const u of inkUniforms) u.value = loaded;
    inkReady = true;
  });
}
export const inkImpactsReady = () => inkReady;
export const ANCHORS = 16;
export const ORIENT = { billboard: 0, velocity: 1, plane: 2, axial: 3 } as const;

const STRIDE = 32;
const colour = new THREE.Color();

export class SpriteSpec {
  kind = 0; orient = 0;
  x = 0; y = 0; z = 0; vx = 0; vy = 0; vz = 0;
  born = 0; life = .3; gravity = 0; drag = 0;
  size0 = 1; size1 = 1; grow = .2;
  stretch = 1;
  r = 1; g = 1; b = 1; intensity = 1;
  r2 = 1; g2 = 1; b2 = 1;
  cover = 0;
  seed = 0; rotation = 0; spin = 0;
  trail = 0;
  bias = 0;
  ax = 0; ay = 1; az = 0;
  anchor = 0;
  inkCell = 0; inkFrames = 1;
  reset(kind: number, born: number, life: number) {
    this.kind = kind; this.orient = ORIENT.billboard; this.born = born; this.life = life; this.anchor = 0;
    this.vx = this.vy = this.vz = 0; this.gravity = this.drag = 0; this.size0 = this.size1 = 1; this.grow = .2; this.stretch = 1;
    this.r = this.g = this.b = 1; this.intensity = 1; this.r2 = this.g2 = this.b2 = 1; this.cover = 0;
    this.seed = Math.random() * 97; this.rotation = 0; this.spin = 0; this.trail = 0; this.bias = 0; this.ax = 0; this.ay = 1; this.az = 0;
    this.inkCell = 0; this.inkFrames = 1;
    return this;
  }
  at(p: { x: number; y: number; z: number }) { this.x = p.x; this.y = p.y; this.z = p.z; return this; }
  pos(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  velocity(x: number, y: number, z: number) { this.vx = x; this.vy = y; this.vz = z; return this; }
  sized(from: number, to = from, grow = .2) { this.size0 = from; this.size1 = to; this.grow = grow; return this; }
  hot(hex: number, intensity = 1) { colour.setHex(hex); this.r = colour.r; this.g = colour.g; this.b = colour.b; this.intensity = intensity; return this; }
  cool(hex: number, cover = this.cover) { colour.setHex(hex); this.r2 = colour.r; this.g2 = colour.g; this.b2 = colour.b; this.cover = cover; return this; }
  axis(x: number, y: number, z: number) { this.ax = x; this.ay = y; this.az = z; return this; }
}

const VERTEX = `
attribute vec4 aPosBorn; attribute vec4 aVelLife; attribute vec4 aSize; attribute vec4 aColA;
attribute vec4 aColB; attribute vec4 aKind; attribute vec4 aAxisG; attribute vec4 aExtra;
uniform float uTime; uniform vec3 uAnchor[${ANCHORS}]; uniform vec3 uKey;
varying vec2 vUv; varying vec4 vColA; varying vec4 vColB; varying vec4 vInfo; varying vec3 vShape; varying vec3 vKey;
varying vec3 vVeil;
varying vec2 vInk;
void main(){
  vInk = vec2(aSize.w, aExtra.z);
  float age = uTime - aPosBorn.w, life = aVelLife.w, t = age / max(life, 1e-4);
  // The orientation carries the anchor in its upper bits: orient + 4 * anchor.
  float anchor = floor(aKind.y / 4.0 + 1e-3), orient = aKind.y - anchor * 4.0;
  vUv = position.xy; vColA = aColA; vColB = aColB; vInfo = vec4(t, age, aKind.x, aKind.z); vShape = vec3(1.0, 1.0, orient);
  // A spent or unborn slot collapses to a clipped point: no fragments, no branch in the draw.
  if (age < 0.0 || t >= 1.0 || life <= 0.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  float drag = aExtra.x;
  float travel = drag > 1e-3 ? (1.0 - exp(-drag * age)) / drag : age;
  vec3 center = aPosBorn.xyz + aVelLife.xyz * travel + uAnchor[int(anchor + .5)];
  center.y -= .5 * aAxisG.w * age * age;
  vec3 vel = aVelLife.xyz * exp(-drag * age); vel.y -= aAxisG.w * age;
  float grow = 1.0 - pow(1.0 - clamp(t / max(aSize.z, 1e-3), 0.0, 1.0), 3.0);
  float size = mix(aSize.x, aSize.y, grow);
  float rot = aKind.w + aExtra.y * age;
  // A hit burst is turned on screen to the way the blow travelled; how much
  // of the blow lies across the screen decides how one-sided it is, so a blow
  // straight down the lens still bursts all round.
  if (aKind.x > 8.5 && orient < .5 && dot(aAxisG.xyz, aAxisG.xyz) > 1e-6) {
    vec3 d = (viewMatrix * vec4(aAxisG.xyz, 0.0)).xyz; float across = length(d.xy);
    rot += across > 1e-3 ? atan(d.y, d.x) : 0.0; vShape.x = clamp(across * 1.4, 0.0, 1.0);
  }
  float cs = cos(rot), sn = sin(rot);
  vec2 c = position.xy, rc = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs);
  // The key light in the sprite's own frame, for the smoke's tone bands.
  // Always partly from the side: a cloud lit straight from the lens has no
  // shadow side, and reads as a flat disc.
  vec3 key = normalize((viewMatrix * vec4(uKey, 0.0)).xyz);
  vec2 side = length(key.xy) > .2 ? normalize(key.xy) : vec2(-.5, .85);
  key = normalize(vec3(side, .5));
  vKey = vec3(key.x * cs + key.y * sn, -key.x * sn + key.y * cs, key.z);
  if (orient < .5) {
    vec4 mv = viewMatrix * vec4(center, 1.0);
    // The pull toward the lens is bounded by the distance to it, or a close
    // camera would have the flash in its face.
    mv.z += min(aExtra.w, max(0.0, -mv.z * .3));
    // Never more than about half the screen: a flash a metre from the lens
    // is not a bigger flash, it is a white frame.
    // The dream loop's bursts carry the least share of the frame they take (SpriteSpec.trail: radius over distance),
    // grown with the sprite: a far lens does not shrink a finisher to a jab.
    // (Round 56: and a glow given a share - a big blow's bloom - as the dream kinds are.)
    bool share = aExtra.z > 0.0 && (aKind.x > 10.5 || (aKind.x > 7.5 && aKind.x < 8.5));
    if (share) size *= max(1.0, -mv.z * aExtra.z / max(aSize.y, 1e-3));
    // (Round 27b: the impact frame's own star - VfxKit SZ_SCREEN, its screen share over .35 - may cover the screen; round
    // 49: over .6, off every edge of it.)
    mv.xy += rc * min(size, max(.2, -mv.z) * (aKind.x > 14.5 ? .42 : aKind.x > 10.5 || share ? (aExtra.z > .6 ? 1.15 : aExtra.z > .35 ? .6 : .3) : .18));
    // (Round 54: a crescent facing the lens - a big blow's sweeping arc - carries its stretch for its thickness, as a
    // plane one does.)
    if (aKind.x > 12.5 && aKind.x < 13.5) vShape.y = aSize.w;
    gl_Position = projectionMatrix * mv;
    // Where the corner is in the world, for the victim veil (VictimVeil).
    vVeil = (inverse(viewMatrix) * mv).xyz;
    return;
  }
  vec3 world;
  if (orient < 1.5) {
    float speed = length(vel);
    vec3 dir = speed > 1e-4 ? vel / speed : vec3(0.0, 1.0, 0.0);
    vec3 side = cross(dir, normalize(cameraPosition - center));
    float sl = length(side); side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
    float len = size * aSize.w + speed * aExtra.z;
    vShape.xy = vec2(len / max(size, 1e-4), size);
    // The head leads at the particle; the tail trails behind it.
    world = center + side * c.x * size + dir * (c.y - 1.0) * .5 * len;
  } else if (orient < 2.5) {
    // (A plane sprite's stretch rides in vShape.y: the crescent's echo is a hairline.)
    vShape.y = aSize.w;
    vec3 n = normalize(aAxisG.xyz);
    vec3 t1 = normalize(cross(n, abs(n.y) < .99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(n, t1);
    world = center + (t1 * rc.x + t2 * rc.y) * size;
  } else {
    vec3 axis = normalize(aAxisG.xyz);
    // (Round 67: a line given a trail - which an axial one has no other use for - is laid flat across the lens, its
    // direction as the screen sees it, so a blow thrown away from the lens still draws the whole of its line.)
    if (aKind.x > 11.5 && aKind.x < 12.5 && aExtra.z > 0.0) {
      vec3 view = normalize(cameraPosition - center), across = axis - view * dot(axis, view);
      if (length(across) > 1e-3) axis = normalize(across);
    }
    vec3 side = cross(axis, normalize(cameraPosition - center));
    float sl = length(side); side = sl > 1e-4 ? side / sl : vec3(1.0, 0.0, 0.0);
    vShape.xy = vec2(aSize.w, size);
    world = center + side * c.x * size + axis * c.y * size * aSize.w;
  }
  vec3 toEye = cameraPosition - world; float eye = length(toEye);
  world += toEye / max(eye, 1e-4) * min(aExtra.w, eye * .3);
  vVeil = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const FRAGMENT = `
varying vec2 vUv; varying vec4 vColA; varying vec4 vColB; varying vec4 vInfo; varying vec3 vShape; varying vec3 vKey;
varying vec3 vVeil; uniform float uVeilStrength;
varying vec2 vInk; uniform sampler2D uInk;
${VEIL_GLSL}
${noiseGLSL}
${NOISE_GLSL}
const vec3 INK = vec3(.018, .022, .035);
float edgeFn(vec2 a, vec2 b, vec2 p){ vec2 e = b - a; return dot(p - a, normalize(vec2(-e.y, e.x))); }
// Premultiplied output throughout: rgb is light added, alpha is how much of
// the frame behind is covered. One blend state then draws pure light (a
// flash), solid paint (dust, ink) and everything between in a single pass.
vec4 coreFlash(vec2 uv, float t){
  float r = length(uv), g = exp(-r * r * 5.5), disc = 1.0 - smoothstep(.28, .46, r), k = (1.0 - t) * (1.0 - t);
  return vec4(mix(vColB.rgb, vec3(1.0), g) * (g * .45 + disc * 1.1) * k * vColA.w, 0.0);
}
vec4 starburst(vec2 uv, float t, float seed){
  // The derivative before any early exit: fwidth after a divergent return is
  // undefined on the lanes that stayed.
  float r = length(uv), aa = fwidth(r) * 1.25;
  if (r > 1.05) return vec4(0.0);
  float ang = atan(uv.y, uv.x);
  float n = floor(8.0 + hash11(seed * 7.13) * 6.0);
  float pop = 1.0 - pow(1.0 - clamp(t / .16, 0.0, 1.0), 3.0);
  float thin = smoothstep(.22, 1.0, t);
  float sector = (ang / 6.2831853 + .5) * n, i0 = floor(sector), reach = 0.0;
  for (int k = -1; k <= 1; k++) {
    float idx = i0 + float(k), id = mod(idx + n, n);
    float h1 = hash11(seed + id * 1.618), h2 = hash11(seed * 1.37 + id * 2.414);
    float len = mix(mix(.42, 1.0, h2 * h2), 1.0, step(.8, h1));
    float hw = mix(.26, .5, hash11(seed * 2.1 + id * .77)) * (1.0 - .72 * thin);
    float prof = max(0.0, 1.0 - abs(sector - (idx + .5 + (h1 - .5) * .55)) / hw);
    reach = max(reach, len * prof * prof);
  }
  float body = mix(.36, .1, thin);
  float R = (body + (1.0 - body) * reach) * pop * (1.0 - .18 * thin);
  float inside = 1.0 - smoothstep(R - aa, R + aa, r);
  float inkW = aa * 2.6 + .035;
  float ink = (1.0 - smoothstep(R + inkW - aa, R + inkW + aa, r)) * (1.0 - inside);
  float q = r / max(R, 1e-3), fade = 1.0 - smoothstep(.72, 1.0, t);
  vec3 hot = vec3(1.0) * (1.25 + 2.4 * exp(-t * 18.0));
  // White-hot at the heart, the element's colour through the body of each
  // spike, and its saturated rim colour at the tips.
  vec3 fill = mix(hot, vColA.rgb * 1.25, smoothstep(.06, .38, q));
  fill = mix(fill, vColB.rgb * 1.15, smoothstep(.45, .95, q));
  float halo = exp(-max(r - R, 0.0) * 9.0) * (1.0 - inside) * .45 * (1.0 - t);
  float cover = (inside * .96 + ink * vColB.w) * fade;
  return vec4((fill * inside * vColA.w + INK * ink + vColA.rgb * halo) * fade, cover);
}
vec4 ringShape(vec2 uv, float t, float seed){
  // Most of a ring's quad is the hole in the middle: leave before the lookup.
  float r = length(uv), aa = fwidth(r) * 1.2;
  float th = mix(.11, .022, sqrt(t));
  if (abs(r - .86) > th * .5 + aa * 2.0) return vec4(0.0);
  float ang = atan(uv.y, uv.x);
  float band = 1.0 - smoothstep(th * .5 - aa, th * .5 + aa, abs(r - .86));
  float gaps = smoothstep(.3, .62, tnoise(vec2(ang / 6.2831853 * 2.0 + seed * .37, seed * .11)).g);
  band *= mix(1.0, gaps, .55);
  float fade = pow(1.0 - t, 1.4);
  vec3 col = mix(vColA.rgb, vColB.rgb, smoothstep(0.0, .55, t)) * vColA.w;
  return vec4(col * band * fade, band * vColB.w * fade);
}
vec4 streakShape(vec2 uv, float t){
  float along = uv.y * .5 + .5, w = mix(.1, 1.0, pow(along, .6)), aa = fwidth(uv.x) * 1.5;
  float core = 1.0 - smoothstep(w - aa, w + aa, abs(uv.x));
  float hot = smoothstep(.5, 1.0, along) * (1.0 - smoothstep(0.0, .55, abs(uv.x) / w));
  float fade = 1.0 - smoothstep(.55, 1.0, t);
  vec3 col = mix(vColB.rgb, vColA.rgb, along) * (.55 + along);
  col = mix(col, vec3(1.7), hot * .75);
  return vec4(col * core * fade * vColA.w, core * vColB.w * fade);
}
vec4 puffShape(vec2 uv, float t, float seed, float age){
  // A manga cloud, not a blob: a ragged lobed edge in bold ink, and three
  // flat tones - warm where the key light falls on it, cool in its shadow -
  // read off a sphere bent by the same noise that shapes the edge. It
  // dissolves from the rim inward over the back half of its life.
  // Scaled so the lobes and their ink never reach the edge of the quad.
  vec2 p = uv * 1.3;
  float r = length(p), aaR = fwidth(r);
  if (r > 1.25) return vec4(0.0);
  vec4 na = tnoise(p * .22 + vec2(seed * .13, seed * .07 + age * .05)), nb = tnoise(p * .5 + vec2(seed * .31 - age * .06, seed * .19));
  float n = (na.g - .5) * .42 + (nb.b - .5) * .16;
  float e = r + n, aa = aaR * 1.3 + .004;
  // The silhouette shrinks a little as it goes, and holes eat it from the
  // rim in; the ink stays on the outer silhouette only, so the holes read as
  // the cloud thinning rather than as cracks drawn across it.
  // Holes as big as a lobe, not a speckle: a cloud breaks into pieces and
  // thins out, it does not turn to gravel.
  // The coarsest channel at a finer lookup: lobe-sized holes, with enough
  // texels across them that the bilinear filter does not show as blocks.
  float dissolve = smoothstep(.3, 1.0, t), holes = tnoise(p * .4 + seed * .23).r;
  float edge = .78 - dissolve * .18;
  // Nothing is eaten before the dissolve starts, and then the rim goes first.
  float gone = smoothstep(0.0, .06, (1.0 - holes) * dissolve * 1.5 - max(edge - e, 0.0) * 1.2 - .02);
  float body = (1.0 - smoothstep(edge - aa, edge + aa, e)) * (1.0 - gone);
  float inkW = aaR * 2.4 + .05;
  float ink = (1.0 - smoothstep(edge + inkW - aa, edge + inkW + aa, e)) * smoothstep(edge - aa, edge + aa, e) * (1.0 - gone);
  vec3 nrm = normalize(vec3(p * 1.1 + vec2(na.r - .5, nb.a - .5) * .9, sqrt(max(.08, 1.0 - r * r))));
  float light = dot(nrm, vKey), soft = fwidth(light) + .02;
  float hi = smoothstep(.34 - soft, .34 + soft, light), mid = smoothstep(-.12 - soft, -.12 + soft, light);
  vec3 col = mix(vColB.rgb, mix(mix(vColB.rgb, vColA.rgb, .55), vColA.rgb, hi), mid) * vColA.w;
  float fade = 1.0 - smoothstep(.8, 1.0, t), a = vColB.w * fade;
  return vec4((col * body + INK * ink) * a, max(body, ink) * a);
}
float burstReach(float ang, float lean){
  // Long ahead of the blow, shorter across it, stubs behind it.
  float ahead = .5 + .5 * cos(ang);
  return mix(1.0, mix(.34, 1.0, pow(ahead, 1.5)), lean);
}
vec4 hitBurst(vec2 uv, float t, float seed, float lean){
  // The hit spark: thin spikes of light fanning out along the blow from a
  // small white-hot heart, each one inked along its edge. Mostly light, not
  // paint - the struck body shows between the spikes - so the reaction pose
  // still reads through it.
  float r = length(uv), aa = fwidth(r) * 1.25;
  if (r > 1.05) return vec4(0.0);
  float ang = atan(uv.y, uv.x);
  float n = floor(8.0 + hash11(seed * 7.13) * 4.0);
  float pop = 1.0 - pow(1.0 - clamp(t / .12, 0.0, 1.0), 3.0);
  float thin = smoothstep(.2, 1.0, t);
  float sector = (ang / 6.2831853 + .5) * n, i0 = floor(sector), reach = 0.0;
  for (int k = -1; k <= 1; k++) {
    float idx = i0 + float(k), id = mod(idx + n, n);
    float h1 = hash11(seed + id * 1.618), h2 = hash11(seed * 1.37 + id * 2.414);
    float mid = (idx + .5 + (h1 - .5) * .5) / n * 6.2831853 - 3.14159265;
    float len = mix(mix(.4, 1.0, h2 * h2), 1.0, step(.78, h1)) * burstReach(mid, lean);
    float hw = mix(.2, .38, hash11(seed * 2.1 + id * .77)) * (1.0 - .6 * thin);
    float prof = max(0.0, 1.0 - abs(sector - (idx + .5 + (h1 - .5) * .5)) / hw);
    reach = max(reach, len * prof * prof);
  }
  float body = mix(.26, .06, thin);
  float R = (body + (1.0 - body) * reach) * pop * (1.0 - .25 * thin);
  float inside = 1.0 - smoothstep(R - aa, R + aa, r);
  float inkW = aa * 2.2 + .02;
  float ink = (1.0 - smoothstep(R + inkW - aa, R + inkW + aa, r)) * (1.0 - inside);
  float q = r / max(R, 1e-3), fade = 1.0 - smoothstep(.55, 1.0, t);
  vec3 hot = vec3(1.0) * (2.0 + 2.4 * exp(-t * 14.0));
  vec3 fill = mix(hot, vColA.rgb * 1.4, smoothstep(.1, .42, q));
  fill = mix(fill, vColB.rgb * 1.1, smoothstep(.55, .95, q));
  // Paint only where the spike is thick; light everywhere else.
  float cover = (inside * mix(.62, .12, smoothstep(.12, .5, q)) + ink * vColB.w) * fade;
  return vec4((fill * inside * vColA.w + INK * ink * vColB.w) * fade, cover);
}
vec4 inkShape(vec2 uv, float t){
  // A hand-drawn flipbook (vfx/inkImpactAtlas.ts): R the fill, G its heat, B the ink, A coverage, in an 8x8 grid of
  // cells counted from the image's top left. Coloured here - the rim at the cool edges, the spike's colour through the
  // body, white at the heart (over the bloom's threshold, by the sprite's intensity) - so one atlas serves every element.
  float frames = max(vInk.y, 1.0);
  float cell = vInk.x + min(floor(t * frames), frames - 1.0);
  vec2 local = clamp(uv * .5 + .5, 0.0, 1.0);
  vec2 at = (vec2(mod(cell, 8.0), 7.0 - floor(cell / 8.0)) + local) / 8.0;
  vec4 m = texture2D(uInk, at);
  if (m.a < .004) return vec4(0.0);
  vec3 col = mix(vColB.rgb, vColA.rgb, smoothstep(.12, .65, m.g));
  float white = smoothstep(.7, 1.0, m.g);
  col = mix(col, vec3(1.0), white) * (1.0 + white * (vColA.w - 1.0));
  float fill = m.r, ink = m.b * (1.0 - m.r * .7);
  vec3 rgb = col * fill + INK * ink;
  return vec4(rgb, (fill + ink * (1.0 - fill)) * vColB.w);
}
vec4 flareShape(vec2 uv, float t){
  float r = length(uv);
  if (r > 1.0) return vec4(0.0);
  float a = atan(uv.y, uv.x);
  float rays = pow(abs(cos(a * 2.0)), 90.0) + .55 * pow(abs(cos(a * 2.0 + .785)), 140.0);
  float needle = rays * (1.0 - smoothstep(0.0, 1.0, r));
  float glow = exp(-r * r * 9.0) * 1.1 + exp(-r * 3.2) * .22;
  float k = 1.0 - smoothstep(.45, 1.0, t);
  return vec4(mix(vColB.rgb, vec3(1.0), clamp(glow, 0.0, 1.0)) * (needle * 1.6 + glow) * k * vColA.w, 0.0);
}
vec4 shardShape(vec2 uv, float t, float seed){
  vec2 p0 = vec2(-.9, -.6) + (hash21(seed) - .5) * .5, p1 = vec2(.85, -.7) + (hash21(seed + 1.7) - .5) * .5, p2 = vec2(.05, .95) + (hash21(seed + 3.1) - .5) * .4;
  float d = min(edgeFn(p0, p1, uv), min(edgeFn(p1, p2, uv), edgeFn(p2, p0, uv))), aa = fwidth(d) * 1.2;
  float inside = smoothstep(-aa, aa, d), rim = inside * (1.0 - smoothstep(0.0, .14, d));
  float fade = 1.0 - smoothstep(.5, 1.0, t);
  return vec4((vColA.rgb * .4 * inside + vec3(1.3) * rim) * fade * vColA.w, inside * vColB.w * fade);
}
// Round 24e: a solid cel shard - the reference's jagged yellow shards thrown out of a heavy blow. A flat triangle in the
// spike colour with a band of the rim colour along its edges, no gradient and no glass rim; gone by the end of its life.
vec4 celShard(vec2 uv, float t, float seed){
  vec2 p0 = vec2(-.55, -.9) + (hash21(seed) - .5) * .35, p1 = vec2(.6, -.75) + (hash21(seed + 1.7) - .5) * .35, p2 = vec2((hash11(seed + 3.1) - .5) * .5, 1.0);
  float d = min(edgeFn(p0, p1, uv), min(edgeFn(p1, p2, uv), edgeFn(p2, p0, uv))), aa = fwidth(d) * 1.2;
  float inside = smoothstep(-aa, aa, d);
  if (inside < .001) return vec4(0.0);
  float edge = 1.0 - smoothstep(.12 - aa, .12 + aa, d);
  vec3 col = mix(vColA.rgb, vColB.rgb, edge);
  float fade = 1.0 - smoothstep(.65, 1.0, t);
  return vec4(col * inside * fade * vColA.w, inside * fade * vColB.w);
}
vec4 glowShape(vec2 uv, float t, float axial){
  float g = axial > .5 ? exp(-uv.x * uv.x * 5.0) * (1.0 - smoothstep(.55, 1.0, abs(uv.y))) : exp(-dot(uv, uv) * 4.0);
  float k = smoothstep(0.0, .1, t) * (1.0 - smoothstep(.35, 1.0, t));
  return vec4(mix(vColA.rgb, vec3(1.0), g * g * .6) * g * k * vColA.w, 0.0);
}
// The dream loop's shapes (docs/dream/BENCHMARK.md). A starburst in hard bands, not a gradient: a white-hot heart, the
// spike colour, a band between, the rim colour at the tips and a deeper edge past it. Full size on its first frame;
// the spikes thin, the heart opens and the whole breaks up over the life.
vec4 szStar(vec2 uv, float t, float seed, float lean, float open){
  float r = length(uv), aa = fwidth(r) * 1.15;
  if (r > 1.02) return vec4(0.0);
  float ang = atan(uv.y, uv.x);
  float n = floor(8.0 + hash11(seed * 7.13) * 5.0);
  float thin = smoothstep(0.0, 1.0, t);
  float sector = (ang / 6.2831853 + .5) * n, i0 = floor(sector), reach = 0.0;
  for (int k = -1; k <= 1; k++) {
    float idx = i0 + float(k), id = mod(idx + n, n);
    float h1 = hash11(seed + id * 1.618), h2 = hash11(seed * 1.37 + id * 2.414), h3 = hash11(seed * 2.1 + id * .77);
    float centre = idx + .5 + (h1 - .5) * .6, mid = centre / n * 6.2831853 - 3.14159265;
    // (Round 25: swept further along the blow - long ahead, stubs behind - as the reference's flame shards are.)
    float len = mix(mix(.45, .92, h2 * h2), 1.0, step(.68, h1)) * burstReach(mid, lean * .85);
    float hw = mix(.3, .58, h3) * (1.0 - .55 * thin);
    float prof = max(0.0, 1.0 - abs(sector - centre) / hw);
    reach = max(reach, len * pow(prof, 1.5));
  }
  float body = mix(.4, .14, thin);
  float R = (body + (1.0 - body) * reach) * (1.0 - .3 * thin * thin);
  // (Round 24: a heavy blow's heart (open: its screen floor, SpriteSpec.trail, is a heavy's) opens from a sixth of the
  // life - about two frames - so the burst is a ring of spikes round the struck body by its fourth frame, as the
  // reference's is, not a disc over him. A jab's keeps its bold star through the hold: opened as early, a blind critic
  // read it as "shrunk by the fourth frame".)
  float hole = (open > .5 ? smoothstep(.15, .6, t) * .82 : smoothstep(.4, 1.0, t) * .8) * R;
  float inside = (1.0 - smoothstep(R - aa, R + aa, r)) * smoothstep(hole - aa, hole + aa, r);
  if (inside < .001) return vec4(0.0);
  float q = r / max(R, 1e-3), w = fwidth(q) * 1.2 + .004;
  // Saturated toward the rim colour band by band: a pale spike colour (a ki's near-white) would otherwise paint it white.
  // Under the bloom's knee everywhere but the heart: a cel shape keeps its hard edge only if the glow pass leaves it alone.
  vec3 c0 = vec3(1.0, .98, .92) * (1.0 + .45 * exp(-t * 16.0)), c1 = mix(vColA.rgb, vColB.rgb, .3) * .97, c3 = vColB.rgb * .95, c2 = mix(c1, c3, .55), c4 = vColB.rgb * vec3(.95, .3, .22);
  vec3 col = c0;
  col = mix(col, c1, smoothstep(.17 + .12 * t - w, .17 + .12 * t + w, q));
  col = mix(col, c2, smoothstep(.44 + .08 * t - w, .44 + .08 * t + w, q));
  col = mix(col, c3, smoothstep(.64 - w, .64 + w, q));
  col = mix(col, c4, smoothstep(.87 - w, .87 + w, q));
  float fade = 1.0 - smoothstep(.72, 1.0, t);
  return vec4(col * inside * vColA.w * fade, inside * fade * vColB.w);
}
// A finisher's burst of flame: many jagged tongues shot out of the contact over the first fifth of the life, each
// forked along its edge, saturated yellow over a pink-white heart with an orange-red rim; the middle opens as the
// tongues fly outward. The reference's string-ending blow (docs/dream/BENCHMARK.md, "Finisher cloud").
vec4 flameBurst(vec2 uv, float t, float seed, float lean){
  float r = length(uv), aa = fwidth(r) * 1.2;
  if (r > 1.0) return vec4(0.0);
  float ang = atan(uv.y, uv.x);
  float n = floor(13.0 + hash11(seed * 5.71) * 7.0);
  float grow = 1.0 - pow(1.0 - clamp(t / .2, 0.0, 1.0), 2.0);
  float sector = (ang / 6.2831853 + .5) * n, i0 = floor(sector), reach = 0.0;
  for (int k = -1; k <= 1; k++) {
    float idx = i0 + float(k), id = mod(idx + n, n);
    float h1 = hash11(seed + id * 3.17), h2 = hash11(seed * 1.91 + id * 1.37), h3 = hash11(seed * 2.63 + id * .59);
    float centre = idx + .5 + (h1 - .5) * .7;
    float mid = centre / n * 6.2831853 - 3.14159265;
    float len = mix(.38, 1.0, h2 * h2) * mix(.75, 1.0, step(.35, h3)) * burstReach(mid, lean * .7);
    float hw = mix(.25, .52, h3);
    float d = abs(sector - centre) / hw;
    // A fork: a notch partway along the tongue's edge.
    float fork = step(.55, h1) * smoothstep(.45, .6, r / max(len, 1e-3)) * .35;
    float prof = max(0.0, 1.0 - d - fork * step(.5, d));
    reach = max(reach, len * pow(prof, 1.3));
  }
  float jag = (hash11(floor((ang + 3.14159265) * 34.0) + seed * 3.0) - .5) * .05;
  float R = (.16 + .84 * reach) * grow * (1.0 - .2 * t);
  // Open from the middle early: by a third of its life the body behind it shows through the ring of tongues.
  float hole = smoothstep(.08, .6, t) * R * .92;
  float inside = (1.0 - smoothstep(R - aa, R + aa, r + jag)) * smoothstep(hole - aa, hole + aa, r);
  if (inside < .001) return vec4(0.0);
  float q = r / max(R, 1e-3), w = fwidth(q) * 1.2 + .004;
  // The reference's finisher burns red-magenta at its root and yellow out along its tongues, orange at the tips.
  vec3 heart = mix(vec3(1.0, .82, .9), vec3(1.0), exp(-t * 12.0)) * .95;
  vec3 root = mix(vec3(.98, .2, .36), vColB.rgb, .25) * .95;
  vec3 col = heart;
  col = mix(col, root, smoothstep(.1 - w, .1 + w, q));
  col = mix(col, vColA.rgb * .98, smoothstep(.36 - w, .36 + w, q));
  col = mix(col, mix(vColA.rgb, vColB.rgb, .5) * .96, smoothstep(.8 - w, .8 + w, q));
  float fade = 1.0 - smoothstep(.7, 1.0, t);
  return vec4(col * inside * vColA.w * fade, inside * fade * vColB.w);
}
// A laser-thin line out of the contact, laid along its axis (ORIENT.axial: uv.y -1 at the contact, 1 at the far end):
// its head shoots out in the first third of the life and its tail chases it, so the line flies off rather than fades.
vec4 boltShape(vec2 uv, float t){
  float along = uv.y * .5 + .5, aa = fwidth(uv.x) * 1.4;
  float head = smoothstep(0.0, .32, t), tail = smoothstep(.3, 1.0, t) * 1.02;
  if (along > head || along < tail) return vec4(0.0);
  float local = (along - tail) / max(head - tail, 1e-3);
  float w = mix(.2, 1.0, sin(clamp(local, 0.0, 1.0) * 3.14159265));
  float body = 1.0 - smoothstep(w - aa, w + aa, abs(uv.x));
  float core = 1.0 - smoothstep(w * .4 - aa, w * .4 + aa, abs(uv.x));
  // An intensity under a half is ink, not light: a speed line behind a flung body (CombatEffects.launchTrails).
  vec3 col = vColA.w < .5 ? vColB.rgb : mix(vColB.rgb * 1.1, vec3(1.2), core) * vColA.w;
  return vec4(col * body, body * vColB.w);
}
// A crescent swept round the blow, flat in its plane: an arc thick in the middle and tapering to points, drawn on from
// one tip and wiped off from it again, hot on its inner edge.
vec4 crescentShape(vec2 uv, float t, float seed){
  float r = length(uv), aa = fwidth(r) * 1.3;
  if (r > 1.0) return vec4(0.0);
  float ang = atan(uv.y, uv.x), span = mix(2.3, 3.4, hash11(seed * 3.3));
  float a = (ang + span * .5) / span;
  if (a < 0.0 || a > 1.0) return vec4(0.0);
  float draw = smoothstep(0.0, .3, t), wipe = smoothstep(.4, 1.0, t);
  if (a > draw || a < wipe) return vec4(0.0);
  float along = clamp((a - wipe) / max(draw - wipe, 1e-3), 0.0, 1.0);
  // Tapering to points at both ends (hard tips, never a square cut), thickest a little ahead of the middle; an echo
  // (stretch > 1) is a hairline.
  float prof = pow(sin(along * 3.14159265), 1.4) * (.75 + .25 * along);
  // (Round 54: a stretch between 1.4 and 2, a big blow's sweeping arc, is a line of its own: the reference's are about
  // a twentieth of their radius at the thickest.)
  float R = .8 + .12 * t, th = (vShape.y > 2.0 ? .022 : vShape.y > 1.4 ? .055 : .11) * prof * (1.0 - .45 * t);
  float body = 1.0 - smoothstep(th - aa, th + aa, abs(r - R));
  if (body < .001) return vec4(0.0);
  float inner = smoothstep(R + th * .2, R - th, r);
  // Yellow at the head of the sweep, orange back down its tail, the inner edge lit: no white gloss.
  vec3 col = mix(vColB.rgb * .92, vColA.rgb * .97, along * .7 + inner * .3);
  float fade = 1.0 - smoothstep(.8, 1.0, t);
  return vec4(col * body * vColA.w * fade, body * vColB.w * fade);
}
// The finisher's bubble: a sphere of light blown out of the contact, a bright rim round a thin fill.
vec4 bubbleShape(vec2 uv, float t){
  float r = length(uv), aa = fwidth(r) * 1.2;
  if (r > 1.0) return vec4(0.0);
  // A hard rim line (a cel shape's edge, not a gradient) round a faint flat fill, the line thinning as it spreads.
  float R = .9, fill = 1.0 - smoothstep(R - aa, R + aa, r);
  float w = mix(.12, .04, t), rim = (1.0 - smoothstep(w - aa, w + aa, abs(r - (R - w)))) * fill;
  float k = 1.0 - smoothstep(.2, 1.0, t);
  // A flash for its first frames - a sphere of light, brightest at its rim - then only the rim spreading on.
  // (Round 24: a white-hot sphere for its first four frames - the reference's finisher - and no fill left behind it: a
  // pale disc held over the victim was what the critics read as a smudge.)
  float flash = (1.0 - smoothstep(0.0, .3, t)) * (.45 + .55 * smoothstep(.2, 1.0, r / R));
  vec3 col = mix(vColA.rgb, vec3(1.35), rim * .5 + flash * .55);
  return vec4(col * (fill * (.012 + flash * .55) + rim * .6) * k * vColA.w, (fill * (.006 + flash * .32) + rim * .2) * k * vColB.w);
}
void main(){
  float t = vInfo.x, kind = vInfo.z, seed = vInfo.w;
  vec4 o;
  if (kind < .5) o = coreFlash(vUv, t);
  else if (kind < 1.5) o = starburst(vUv, t, seed);
  else if (kind < 2.5) o = ringShape(vUv, t, seed);
  else if (kind < 3.5) o = streakShape(vUv, t);
  else if (kind < 4.5) o = puffShape(vUv, t, seed, vInfo.y);
  else if (kind < 5.5) o = flareShape(vUv, t);
  else if (kind < 7.5) o = shardShape(vUv, t, seed);
  else if (kind < 8.5) o = glowShape(vUv, t, step(2.5, vShape.z));
  else if (kind < 9.5) o = hitBurst(vUv, t, seed, vShape.x);
  else if (kind < 10.5) o = inkShape(vUv, t);
  else if (kind < 11.5) o = szStar(vUv, t, seed, vShape.x, step(.1, vInk.y));
  else if (kind < 12.5) o = boltShape(vUv, t);
  else if (kind < 13.5) o = crescentShape(vUv, t, seed);
  else if (kind < 14.5) o = bubbleShape(vUv, t);
  else if (kind < 15.5) o = flameBurst(vUv, t, seed, vShape.x);
  // An explosion's cel cloud (VfxKit.explosion): the puff, but held over the victim for its first beat like the hit.
  else if (kind < 16.5) o = puffShape(vUv, t, seed, vInfo.y);
  else o = celShard(vUv, t, seed);
  if (o.a < .002 && max(o.r, max(o.g, o.b)) < .002) discard;
  // Premultiplied, so the whole of it thins over a victim; the dream loop's shapes only after their first three frames
  // (DREAM_KINDS): the reference covers its victim for that long and no longer.
  float keep = victimVeil(vVeil, uVeilStrength);
  // (Round 24: a heavy blow's shapes give way from 20 ms - its burst is over the victim; a jab's keep the hold a beat
  // longer, as before, or the star over the chest reads small: a blind critic measured round 24's jab 20-50% smaller.)
  float heavy = step(.1, vInk.y);
  if (kind > 10.5) keep = mix(1.0, victimVeil(vVeil, max(uVeilStrength, .95)), smoothstep(mix(.03, .02, heavy), mix(.07, .045, heavy), vInfo.y));
  // (Round 57: a speck of glitter - a white heart given a trail, which a lens-facing one has no other use for - is never
  // veiled: the reference wraps its thrown body in it, and a speck hides none of the body.)
  if (kind < .5 && vInk.y > 0.0) keep = 1.0;
  gl_FragColor = o * keep;
}`;

export class SparkField {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  readonly spec = new SpriteSpec();
  private data: Float32Array;
  private buffer: THREE.InstancedInterleavedBuffer;
  private cursor = 0;
  private epoch = 0;
  private started = false;
  constructor(scene: THREE.Scene, readonly capacity: number, name: string, renderOrder: number, veil = 0) {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.data = new Float32Array(capacity * STRIDE);
    for (let i = 0; i < capacity; i++) this.data[i * STRIDE + 3] = -1e9;
    this.buffer = new THREE.InstancedInterleavedBuffer(this.data, STRIDE, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    ['aPosBorn', 'aVelLife', 'aSize', 'aColA', 'aColB', 'aKind', 'aAxisG', 'aExtra'].forEach((attribute, i) =>
      geometry.setAttribute(attribute, new THREE.InterleavedBufferAttribute(this.buffer, 4, i * 4)));
    geometry.instanceCount = capacity;
    const material = new THREE.ShaderMaterial({
      name: `SparkField-${name}`, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      uniforms: { uTime: { value: 0 }, uNoise: { value: noiseTexture() }, uAnchor: { value: Array.from({ length: ANCHORS }, () => new THREE.Vector3()) }, uKey: { value: new THREE.Vector3(-.4, .8, .45).normalize() }, uInk: { value: inkTexture() }, ...veilUniforms(veil) },
      transparent: true, depthWrite: false, depthTest: true, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    inkUniforms.push(material.uniforms.uInk as { value: THREE.Texture });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.renderOrder = renderOrder;
    scene.add(this.mesh);
  }

  emit() {
    const s = this.spec;
    if (!this.started) { this.started = true; this.epoch = s.born; }
    const d = this.data, o = this.cursor * STRIDE;
    d[o] = s.x; d[o + 1] = s.y; d[o + 2] = s.z; d[o + 3] = s.born - this.epoch;
    d[o + 4] = s.vx; d[o + 5] = s.vy; d[o + 6] = s.vz; d[o + 7] = s.life;
    d[o + 8] = s.size0; d[o + 9] = s.size1; d[o + 10] = s.grow; d[o + 11] = s.kind === SPRITE.ink ? s.inkCell : s.stretch;
    d[o + 12] = s.r; d[o + 13] = s.g; d[o + 14] = s.b; d[o + 15] = s.intensity;
    d[o + 16] = s.r2; d[o + 17] = s.g2; d[o + 18] = s.b2; d[o + 19] = s.cover;
    d[o + 20] = s.kind; d[o + 21] = s.orient + s.anchor * 4; d[o + 22] = s.seed; d[o + 23] = s.rotation;
    d[o + 24] = s.ax; d[o + 25] = s.ay; d[o + 26] = s.az; d[o + 27] = s.gravity;
    d[o + 28] = s.drag; d[o + 29] = s.spin; d[o + 30] = s.kind === SPRITE.ink ? s.inkFrames : s.trail; d[o + 31] = s.bias;
    this.buffer.addUpdateRange(o, STRIDE); this.buffer.needsUpdate = true;
    this.cursor = (this.cursor + 1) % this.capacity;
  }

  live(time: number) {
    let n = 0;
    for (let o = 0; o < this.data.length; o += STRIDE) { const age = time - this.epoch - this.data[o + 3]; if (age >= 0 && age < this.data[o + 7]) n++; }
    return n;
  }

  update(time: number) {
    if (!this.started) { this.started = true; this.epoch = time; }
    if (time - this.epoch > 600 || time < this.epoch - 60) {
      const shift = time - this.epoch;
      for (let o = 3; o < this.data.length; o += STRIDE) this.data[o] = this.data[o] < -1e8 ? this.data[o] : this.data[o] - shift;
      this.epoch = time; this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.data.length); this.buffer.needsUpdate = true;
    }
    this.mesh.material.uniforms.uTime.value = time - this.epoch;
  }

  setAnchor(i: number, x: number, y: number, z: number) { (this.mesh.material.uniforms.uAnchor.value as THREE.Vector3[])[i].set(x, y, z); }
  setKey(x: number, y: number, z: number) { (this.mesh.material.uniforms.uKey.value as THREE.Vector3).set(x, y, z); }

  clear() {
    for (const anchor of this.mesh.material.uniforms.uAnchor.value as THREE.Vector3[]) anchor.set(0, 0, 0);
    for (let o = 3; o < this.data.length; o += STRIDE) this.data[o] = -1e9;
    this.buffer.clearUpdateRanges(); this.buffer.addUpdateRange(0, this.data.length); this.buffer.needsUpdate = true;
    this.cursor = 0;
  }

  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
