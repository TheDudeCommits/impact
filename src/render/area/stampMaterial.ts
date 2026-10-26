import * as THREE from 'three';
import { AREA_BULLSEYE } from '../../engine/sim/areaDamage';

export const STAMP_MARGIN = 1.45;

const vertex = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const fragment = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uMask;
uniform vec3 uColor, uThreatColor, uInk, uPaper;
uniform float uTime, uSpin, uMode, uValid, uForm, uSlam, uFill, uFlash, uBurn, uThreat, uOpacity, uBull, uSimpleRing;
const float M = ${STAMP_MARGIN.toFixed(2)};
const float BULL = ${AREA_BULLSEYE.toFixed(3)};
const float TAU = 6.2831853;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
vec2 turn(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
void main(){
  vec2 p = (vUv - 0.5) * 2.0 * M;
  float r = length(p), ang = atan(p.y, p.x);
  // Physical sweeps retain only a range/warning UI line: no mask, fill, glyph or slam.
  if (uSimpleRing > 0.5) {
    float edge = 1.0 - smoothstep(0.007, 0.022, abs(r - 1.0));
    float opacity = uMode < 0.5 ? 0.72 : (0.35 + 0.3 * uForm) * (1.0 - uBurn);
    vec3 color = mix(uColor, uThreatColor, uThreat);
    if (uMode < 0.5) color = mix(vec3(0.62, 0.34, 0.34), uColor, uValid);
    float alpha = edge * opacity * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha); return;
  }
  float inside = step(r, 1.0);
  float emblem = texture2D(uMask, p * 0.5 + 0.5).r * inside;
  float text = texture2D(uMask, turn(p, -uSpin * 0.35) * 0.5 + 0.5).g * inside;
  float stroke = texture2D(uMask, turn(p, uSpin) * 0.5 + 0.5).b * step(r, 1.02);
  float grain = noise(p * 13.0 + 7.0);
  // The bullseye's ring: a thin brush line, broken here and there.
  float bullRing = (1.0 - smoothstep(0.008, 0.02, abs(r - BULL))) * (0.6 + 0.4 * step(0.3, noise(vec2(ang * 4.0, 5.0))));
  vec3 col = uColor; float alpha = 0.0;

  if (uMode < 0.5) {
    // The reticle: the seal's lines alive in the fighter's colour (red-grey where a release would not cast).
    vec3 c = mix(vec3(0.62, 0.34, 0.34), uColor, uValid);
    float lines = max(max(stroke, bullRing * 0.9), max(text * 0.92, emblem * 0.82));
    float pulse = 0.82 + 0.18 * sin(uTime * 6.0);
    col = mix(c, vec3(1.0), lines * 0.22);
    alpha = max(lines * pulse, inside * (0.07 + 0.04 * uValid));
  } else if (uSlam < 0.0) {
    // Cast, not yet released: the seal forming where it will land.
    vec3 c = mix(uColor, uThreatColor, uThreat * 0.6);
    float lines = max(stroke, max(text, emblem) * 0.8);
    col = c; alpha = lines * uForm * 0.75 + inside * uForm * 0.05;
  } else {
    // Stamped: ink strokes, the seal filling with the fighter's colour from the middle out over the telegraph.
    float edge = (noise(vec2(ang * 3.0, uTime * 1.5)) - 0.5) * 0.08;
    float filled = smoothstep(uFill * 1.04 + 0.02, uFill * 1.04 - 0.02, r + edge) * step(r, 0.97);
    float seal = filled * (0.8 + 0.2 * grain) * (grain > 0.86 ? 0.55 : 1.0);
    float marks = max(text, emblem);
    // Outside the fill the lettering and emblem are the fighter's colour; inside it they are the paper, cut out.
    col = mix(uColor, uPaper, filled);
    alpha = max(seal * 0.86, marks * (0.72 + 0.28 * filled));
    col = mix(col, uColor, seal * (1.0 - marks));
    // The brush strokes in ink, edged in colour; the bullseye's ring in ink too.
    col = mix(col, uInk, stroke * 0.9); alpha = max(alpha, stroke * 0.95);
    col = mix(col, uInk, bullRing * 0.7); alpha = max(alpha, bullRing * 0.75);
    // The slam: ink splashed past the rim, and cracks running out from it.
    float since = uSlam;
    float splashLife = clamp(1.0 - (since - 0.1) / 1.4, 0.0, 1.0);
    float blob = noise(vec2(ang * 5.0 + 3.0, r * 5.5));
    float splash = smoothstep(0.66, 0.74, blob) * step(0.98, r) * smoothstep(1.42, 1.04, r) * splashLife;
    float drops = step(0.93, hash(floor(p * 9.0))) * step(1.02, r) * smoothstep(1.44, 1.15, r) * splashLife;
    float a2 = ang + (noise(vec2(r * 4.0, 2.0)) - 0.5) * 0.5;
    float lane = abs(fract(a2 * 7.0 / TAU + 0.5) - 0.5) * TAU / 7.0 * r;
    float crack = (1.0 - smoothstep(0.004, 0.018 + 0.01 * noise(p * 8.0), lane)) * step(0.95, r) * smoothstep(1.42, 1.08, r) * step(0.0, since);
    float floorInk = max(max(splash, drops), crack * 0.85);
    col = mix(col, uInk, floorInk * (1.0 - inside)); alpha = max(alpha, floorInk * 0.88);
    // An opponent's: a red warning rim, pulsing.
    float rim = uThreat * smoothstep(0.96, 1.0, r) * smoothstep(1.13, 1.07, r) * (0.62 + 0.38 * sin(uTime * 11.0));
    col = mix(col, uThreatColor, rim); alpha = max(alpha, rim);
    // A strike: the seal flashes white-hot.
    col = mix(col, vec3(1.0, 0.97, 0.9), uFlash * 0.75 * inside); alpha = max(alpha, uFlash * 0.8 * inside);
    // A bullseye: its centre flares gold and throws a ring out across the seal.
    if (uBull > 0.0) {
      vec3 gold = vec3(1.0, 0.82, 0.3);
      float disc = smoothstep(BULL + 0.03, BULL - 0.03, r) * uBull;
      float wave = (1.0 - smoothstep(0.0, 0.06, abs(r - (BULL + (1.0 - uBull) * 0.7)))) * uBull * step(r, 1.0);
      col = mix(col, mix(gold, vec3(1.0), 0.45 * uBull), disc); alpha = max(alpha, disc);
      col = mix(col, gold, wave); alpha = max(alpha, wave * 0.9);
    }
    // Burning away: the seal eaten from noisy edges inward, an ember line where it goes.
    if (uBurn > 0.0) {
      float b = noise(p * 4.5 + 11.0) * 0.72 + r * 0.28;
      if (b < uBurn) discard;
      float ember = smoothstep(uBurn + 0.08, uBurn, b);
      col = mix(col, vec3(1.0, 0.52, 0.12), ember); alpha = max(alpha * (1.0 - uBurn * 0.4), ember * 0.9);
    }
  }
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha * uOpacity);
}`;

export function stampMaterial(): THREE.ShaderMaterial & { uniforms: StampUniforms } {
  return new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: {
      uMask: { value: null }, uColor: { value: new THREE.Color('#ffd34d') }, uThreatColor: { value: new THREE.Color('#ff2238') },
      uInk: { value: new THREE.Color('#170c0c') }, uPaper: { value: new THREE.Color('#fff1d6') },
      uTime: { value: 0 }, uSpin: { value: 0 }, uMode: { value: 1 }, uValid: { value: 1 }, uForm: { value: 0 }, uSlam: { value: -1 },
      uFill: { value: 0 }, uFlash: { value: 0 }, uBurn: { value: 0 }, uThreat: { value: 0 }, uOpacity: { value: 1 }, uBull: { value: 0 }, uSimpleRing: { value: 0 },
    },
  }) as THREE.ShaderMaterial & { uniforms: StampUniforms };
}
export interface StampUniforms {
  uMask: { value: THREE.Texture | null }; uColor: { value: THREE.Color }; uThreatColor: { value: THREE.Color }; uInk: { value: THREE.Color }; uPaper: { value: THREE.Color };
  uTime: { value: number }; uSpin: { value: number }; uMode: { value: number }; uValid: { value: number }; uForm: { value: number }; uSlam: { value: number };
  uFill: { value: number }; uFlash: { value: number }; uBurn: { value: number }; uThreat: { value: number }; uOpacity: { value: number };
  uBull: { value: number }; uSimpleRing: { value: number };
  [key: string]: THREE.IUniform;
}

export function rangeMaterial(): THREE.ShaderMaterial & { uniforms: { uTime: { value: number }; uColor: { value: THREE.Color }; uWidth: { value: number } } } {
  return new THREE.ShaderMaterial({
    vertexShader: vertex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    fragmentShader: `
precision mediump float;
varying vec2 vUv;
uniform float uTime, uWidth; uniform vec3 uColor;
void main(){
  vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x) + uTime * 0.12;
  float band = smoothstep(1.0, 1.0 - uWidth * 0.3, r) * smoothstep(1.0 - uWidth, 1.0 - uWidth * 0.7, r);
  float dash = smoothstep(0.25, 0.35, abs(fract(a * 36.0 / 6.2831853) - 0.5) * 2.0);
  float alpha = band * (0.35 + 0.4 * dash);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(uColor, alpha);
}`,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#fff3dc') }, uWidth: { value: .02 } },
  }) as THREE.ShaderMaterial & { uniforms: { uTime: { value: number }; uColor: { value: THREE.Color }; uWidth: { value: number } } };
}
