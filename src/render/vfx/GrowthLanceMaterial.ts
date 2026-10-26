import { NormalBlending, Color, BackSide, ShaderMaterial, Vector3, Vector4 } from 'three';
import { noiseGLSL } from './noise';

export const MAX_LANCES = 6;


const LANCE_VERTEX = `
  #define LTAU 6.283185307179586
  #define LPI  3.141592653589793

  attribute float aLance;

  uniform vec3  uOrigin[MAX_LANCES];
  uniform vec3  uTarget[MAX_LANCES];
  uniform vec4  uState[MAX_LANCES];
  uniform vec3 uAccent[MAX_LANCES];
  varying vec3 vAccent;

  uniform float uTime;
  uniform float uRadius;
  uniform float uRadiusMuzzle;
  uniform float uRadiusCurve;
  uniform float uFlare;
  uniform float uFlareWidth;
  uniform float uThrob;
  uniform float uThrobBands;
  uniform float uThrobSpeed;
  uniform float uWander;
  uniform float uWanderScale;
  uniform float uWanderSpeed;
  uniform float uStrike;
  uniform float uHold;

  varying float vT;
  varying float vA;
  varying float vFacing;
  varying float vLife;
  varying float vSeed;
  varying float vLive;
  varying float vReach;
  varying float vViewZ;

  ${noiseGLSL}

  void main() {
    int slot = int(aLance + 0.5);
    vec3 from = uOrigin[slot];
    vec3 to = uTarget[slot];
    vec4 state = uState[slot];
    vAccent = uAccent[slot];

    float life = state.x;
    float seed = state.y;
    float width = state.z;
    float live = state.w;

    // How far down the line the lance has actually reached. Fast, and eased out
    // so it *lands* rather than stopping dead.
    float reach = clamp(life / max(uStrike, 1e-3), 0.0, 1.0);
    reach = 1.0 - pow(1.0 - reach, 3.0);
    // And how much of it is left. It holds while it cuts, then snaps out.
    float spent = clamp((life - uHold) / max(1.0 - uHold, 1e-3), 0.0, 1.0);
    float fade = 1.0 - spent * spent;

    vec3 delta = to - from;
    float span = max(length(delta), 0.01);
    vec3 dir = delta / span;
    vec3 n1 = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 n2 = normalize(cross(dir, n1));

    float t = position.x * reach;
    float a = position.y;
    float angle = a * LTAU;
    vec3 nrm = n1 * cos(angle) + n2 * sin(angle);

    /* ---- half-width at t ---- */
    float r = mix(uRadiusMuzzle, uRadius, pow(clamp(t, 0.0, 1.0), max(uRadiusCurve, 0.01)));
    r *= 1.0 + uThrob * sin((t * uThrobBands - uTime * uThrobSpeed) * LTAU + seed * 13.0);
    // Periodic angular coordinates keep the seam closed while billows travel
    // toward the victim. The hand attachment and authoritative axis stay fixed.
    float billow = snoise(vec3(cos(angle) * 2.7, sin(angle) * 2.7, t * 10.0 - uTime * 7.0 + seed));
    r *= 1.0 + billow * .17 * smoothstep(0.0, .08, t);
    r *= 1.0 + uFlare * smoothstep(1.0 - max(uFlareWidth, 1e-3), 1.0, t / max(reach, 1e-3));
    r *= width * fade;
    // Drawn to a point at the head while it is still travelling, so the strike
    // is a spearhead rather than a rod that appears at full length.
    r *= smoothstep(0.0, 0.06, position.x) * (1.0 - smoothstep(0.86, 1.0, position.x) * (1.0 - reach));

    /* ---- the axis, with a little life in it ---- */
    vec3 axis = mix(from, to, t);
    float ends = sin(clamp(position.x, 0.0, 1.0) * LPI);
    axis += n1 * snoise(vec3(t * uWanderScale, uTime * uWanderSpeed, seed)) * uWander * ends;
    axis += n2 * snoise(vec3(t * uWanderScale + 21.3, uTime * uWanderSpeed, seed + 4.1)) * uWander * ends;

    vec3 here = axis + nrm * max(r, 1e-5);
    // An idle slot is collapsed onto its own origin: no fragments, no branch.
    here = mix(from, here, live);

    vT = t;
    vA = a;
    vLife = life;
    vSeed = seed;
    vLive = live;
    vReach = reach;
    // Normalize across the tube's cross-section: looking along its axis must
    // not suppress the white center and leave a uniformly blue pipe.
    vec3 viewRay = normalize(cameraPosition - here);
    vec3 radialView = viewRay - dir * dot(viewRay, dir);
    vFacing = clamp(abs(dot(radialView, nrm)) / max(length(radialView), 1e-3), 0.0, 1.0);

    vec4 mv = viewMatrix * vec4(here, 1.0);
    vViewZ = mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const LANCE_FRAGMENT = `
  #define LTAU 6.283185307179586

  uniform float uTime;
  uniform float uCoreFill;
  uniform float uEdgePower;
  uniform float uSheath;
  uniform float uCoils;
  uniform float uCoilTurns;
  uniform float uCoilSpeed;
  uniform float uCoilWidth;
  uniform float uCoilGain;
  uniform float uMotes;
  uniform float uMoteScale;
  uniform float uMoteSpeed;
  uniform float uHeadGlow;
  uniform float uHeadWidth;
  uniform float uHold;
  uniform float uIntensity;
  uniform float uOpacity;
  uniform float uSoftFade;
  varying vec3 vAccent;
  uniform vec3  uColorCore;
  uniform vec3  uColorInner;
  uniform vec3  uColorOuter;
  uniform vec3  uColorCoil;

  uniform sampler2D uSceneDepth;
  uniform vec2  uResolution;
  uniform float uCameraNear;
  uniform float uCameraFar;
  uniform float uGlobalGlow;

  varying float vT;
  varying float vA;
  varying float vFacing;
  varying float vLife;
  varying float vSeed;
  varying float vLive;
  varying float vReach;
  varying float vViewZ;

  ${noiseGLSL}

  void main() {
    if (vLive < 0.5) discard;

    float spent = clamp((vLife - uHold) / max(1.0 - uHold, 1e-3), 0.0, 1.0);
    float fade = 1.0 - spent * spent;

    // Weighted toward the axis: the path a view ray takes through the tube is
    // longest looking straight down it, so that is where the white belongs.
    float core = pow(clamp(vFacing, 0.0, 1.0), max(uCoreFill, 0.05));
    // ... and the opposite weighting for the sheath around it, which is what
    // gives the lance a silhouette instead of a soft edge.
    float sheath = pow(1.0 - clamp(vFacing, 0.0, 1.0), max(uEdgePower, 0.05)) * uSheath;

    /* ---- the helices ---- */
    float coilPhase = vA * uCoils - vT * uCoilTurns + uTime * uCoilSpeed + vSeed;
    float coil = abs(fract(coilPhase) - 0.5) * 2.0;
    coil = 1.0 - smoothstep(0.0, max(uCoilWidth, 1e-3), coil);
    coil *= uCoilGain;

    /* ---- motes carried along inside it ---- */
    float motes = snoise01(vec3(vA * 3.0, vT * uMoteScale - uTime * uMoteSpeed, vSeed * 7.0));
    motes = pow(motes, 8.0) * uMotes;

    /* ---- the head, where it is going through something ---- */
    float head = 1.0 - smoothstep(0.0, max(uHeadWidth, 1e-3), abs(vT - vReach));
    head *= uHeadGlow;

    float flow = snoise(vec3(cos(vA * LTAU) * 3.0, sin(vA * LTAU) * 3.0, vT * 22.0 - uTime * 12.0 + vSeed));
    float ribbon = smoothstep(.1,.65,flow);

    // Keep the silhouette blue, with a narrow white axis and restrained coils.
    // Single-surface normal blending is deliberate: overlapping additive tube
    // faces erased both the fighter and the contour in the release capture.
    vec3 color = mix(uColorOuter, uColorInner, smoothstep(.14,.75,core));
    color = mix(color, uColorCore, smoothstep(.66 + flow*.1,.98,core)*.9);
    color = mix(color, uColorInner*.8, ribbon*(.26+.18*sheath));
    color += uColorCoil * min(.2,coil*.22+motes*.08+head*.025);
    color *= uIntensity * (.94+sheath*.06);
    if(length(vAccent)>.01){float strength=max(color.r,max(color.g,color.b));float white=smoothstep(.5,1.1,min(color.r,min(color.g,color.b)));color=mix(vAccent*strength,vec3(strength),white*.9);}
    float alpha = (.98+.02*core) * fade * uOpacity;
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    if (alpha < 0.004) discard;

    color *= uGlobalGlow;
    color /= 1.0 + color * 0.1;
    gl_FragColor = vec4(color, alpha);
  }
`;

export function createGrowthLanceMaterial() {
  const origin = [];
  const target = [];
  const state = [];
  for (let i = 0; i < MAX_LANCES; i++) {
    origin.push(new Vector3());
    target.push(new Vector3(0, 1, 0));
    state.push(new Vector4(0, 0, 1, 0));
  }

  const material = new ShaderMaterial({
    name: 'GrowthLance',
    defines: { MAX_LANCES },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: NormalBlending,
    side: BackSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 }, uGlobalGlow: { value: 1 },
      uOrigin: { value: origin },
      uTarget: { value: target },
      uState: { value: state },
      uAccent: { value: Array.from({length:MAX_LANCES},()=>new Vector3()) },

      uRadius: { value: 0.34 },
      uRadiusMuzzle: { value: 0.12 },
      uRadiusCurve: { value: 1.4 },
      uFlare: { value: 0.2 },
      uFlareWidth: { value: 0.14 },
      uThrob: { value: 0.12 },
      uThrobBands: { value: 3 },
      uThrobSpeed: { value: 2.2 },
      uWander: { value: 0.025 },
      uWanderScale: { value: 4 },
      uWanderSpeed: { value: 1.6 },
      uStrike: { value: 0.025 },
      uHold: { value: 0.76 },

      uCoreFill: { value: 1.8 },
      uEdgePower: { value: 2.6 },
      uSheath: { value: 0.6 },
      uCoils: { value: 2 },
      uCoilTurns: { value: 7 },
      uCoilSpeed: { value: 1.1 },
      uCoilWidth: { value: 0.34 },
      uCoilGain: { value: 0.35 },
      uMotes: { value: 1.1 },
      uMoteScale: { value: 14 },
      uMoteSpeed: { value: 3.2 },
      uHeadGlow: { value: 2.2 },
      uHeadWidth: { value: 0.06 },
      uIntensity: { value: 0.9 },
      uOpacity: { value: 1 },
      uSoftFade: { value: 0.35 },
      uColorCore: { value: new Color(1.25, 1.42, 1.5) },
      uColorInner: { value: new Color(0.003, 0.22, 1.45) },
      uColorOuter: { value: new Color(0.0006, 0.025, 0.3) },
      uColorCoil: { value: new Color(0.06, 0.65, 1.3) }
    },
    vertexShader: LANCE_VERTEX,
    fragmentShader: LANCE_FRAGMENT
  });

  return material;
}
