import * as THREE from 'three';
import { noiseGLSL } from '../vfx/noise';

export const ENERGY = 0, DARK = 1, CLEAVE = 2;
export interface SlashStyle { mode: number; edge: THREE.Color; body: THREE.Color; glow: THREE.Color }
export const SLASH = {
  mihawk: { mode: ENERGY, edge: new THREE.Color(2.6, 3.2, 2.3), body: new THREE.Color(.16, .86, .3), glow: new THREE.Color(.07, .55, .16) },
  zoro: { mode: ENERGY, edge: new THREE.Color(2.2, 3.3, 2.0), body: new THREE.Color(.28, 1.25, .42), glow: new THREE.Color(.1, .75, .25) },
  getsuga: { mode: DARK, edge: new THREE.Color(3.2, .42, .3), body: new THREE.Color(.02, .004, .006), glow: new THREE.Color(1.0, .06, .05) },
  mugetsu: { mode: CLEAVE, edge: new THREE.Color(1.1, .1, .3), body: new THREE.Color(.01, .002, .01), glow: new THREE.Color(.5, .03, .12) },
  dragonslayer: { mode: DARK, edge: new THREE.Color(1.9, .22, .14), body: new THREE.Color(.03, .008, .008), glow: new THREE.Color(.6, .04, .03) },
} satisfies Record<string, SlashStyle>;
const vertex = `uniform float uProfile;varying vec2 p;varying float vFacing;
void main(){
  p=uv*2.-1.;vec4 world;
  if(uProfile>.5){
    vec3 center=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;
    vec3 axis=normalize((modelMatrix*vec4(0.,0.,1.,0.)).xyz);
    float wide=length((modelMatrix*vec4(1.,0.,0.,0.)).xyz),tall=length((modelMatrix*vec4(0.,1.,0.,0.)).xyz);
    vec3 side=cross(axis,normalize(cameraPosition-center));float s=length(side);
    side=s>1e-4?side/s:vec3(0.,1.,0.);if(side.y<0.)side=-side;
    world=vec4(center-axis*position.x*wide+side*position.y*tall,1.);vFacing=s;
  }else{
    world=modelMatrix*vec4(position,1.);
    vFacing=abs(dot(normalize((modelMatrix*vec4(0.,0.,1.,0.)).xyz),normalize(cameraPosition-world.xyz)));
  }
  gl_Position=projectionMatrix*viewMatrix*world;
}`;
const fragment = `
varying vec2 p;varying float vFacing;
uniform vec3 uEdge;uniform vec3 uBody;uniform vec3 uGlow;uniform float uFade;uniform float uClock;uniform float uMode;uniform float uSeed;uniform float uArc;uniform float uThick;
${noiseGLSL}
void main(){
  vec3 rgb;float alpha;
  if(uMode>1.5){
    // Mugetsu: a pillar of black, torn at its edges, smoking.
    float taper=pow(max(0.,1.-p.y*p.y),.6);
    float n=snoise(vec3(p.x*3.+uSeed,p.y*2.5-uClock*3.,uClock*.5));
    float w=.3*taper*(.82+.3*n);
    float d=abs(p.x+sin(p.y*3.+uClock*2.)*.03);
    float body=1.-smoothstep(w*.78,w,d);
    float rim=exp(-abs(d-w)*42.)*taper;
    float smoke=smoothstep(.15,.85,snoise(vec3(p*3.2+vec2(0.,-uClock*2.2),uSeed)))*(1.-smoothstep(w,w*2.8,d))*taper;
    rgb=uEdge*rim*1.3+uBody*body+uGlow*smoke*.25;
    alpha=max(body*.96,smoke*.55);
  }else{
    float r=length(p),th=atan(p.y,-p.x);
    float u=th/uArc;
    float arc=1.-smoothstep(.8,1.,abs(u));
    float T=uThick*pow(max(0.,1.-u*u),.65);
    float n=snoise(vec3(th*3.+uSeed,r*6.-uClock*5.,uClock*.7));
    float d=.9+n*.018-r;
    float band=smoothstep(-.01,.006,d)*(1.-smoothstep(T*.82,T,d))*arc;
    float edge=exp(-max(0.,d)*34.)*step(-.02,d)*arc;
    float outer=exp(-max(0.,-d)*15.)*step(d,0.)*arc;
    float behind=max(0.,d-T);
    float trail=smoothstep(.3,.9,snoise(vec3(th*8.+uSeed,behind*3.-uClock*6.,uSeed*.3)))*exp(-behind*5.)*step(T,d)*arc;
    float ink=exp(-abs(d-T)*70.)*arc*step(.02,T);
    if(uMode>.5){
      rgb=uEdge*edge*1.2+uGlow*outer*.8+uBody*band+uGlow*trail*.3;
      alpha=max(band*.93,trail*.45);
    }else{
      rgb=uEdge*edge+uBody*band*(.55+.45*n)+uGlow*outer*.8+uBody*trail*.55;
      alpha=band*.2+ink*.55+trail*.05;
      rgb*=1.-ink*.85;
    }
  }
  float seen=uFade*smoothstep(.12,.55,vFacing);
  gl_FragColor=vec4(rgb*seen,alpha*seen);
}`;
export function slashWaveMaterial() {
  return new THREE.ShaderMaterial({
    name: 'SignatureSlashWave', vertexShader: vertex, fragmentShader: fragment, side: THREE.DoubleSide,
    uniforms: { uEdge: { value: new THREE.Color() }, uBody: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uFade: { value: 1 }, uClock: { value: 0 }, uMode: { value: 0 }, uSeed: { value: 0 }, uArc: { value: 1.3 }, uThick: { value: .26 }, uProfile: { value: 0 } },
    transparent: true, depthWrite: false, toneMapped: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}
export function applySlashStyle(material: THREE.ShaderMaterial, style: SlashStyle, seed: number, arc = 1.3, thick = .26, profile = false) {
  const u = material.uniforms; (u.uEdge.value as THREE.Color).copy(style.edge); (u.uBody.value as THREE.Color).copy(style.body); (u.uGlow.value as THREE.Color).copy(style.glow);
  u.uMode.value = style.mode; u.uSeed.value = seed % 97; u.uFade.value = 0; u.uArc.value = arc; u.uThick.value = thick; u.uProfile.value = profile ? 1 : 0;
}
