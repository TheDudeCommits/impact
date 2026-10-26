import * as THREE from 'three';

export const FIRE = 0, BLACK = 1, BLOOD = 2, ABYSS = 3;
export const flamePalette = (palette: number) => palette / 4;
const vertex = `
varying vec2 vUv;varying vec3 vFire;
void main(){
  vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
  vec3 axisW=(instanceMatrix*vec4(0.,1.,0.,0.)).xyz;
  float w=length((instanceMatrix*vec4(1.,0.,0.,0.)).xyz);
  float h=length(axisW);
  vec2 ax=(modelViewMatrix*vec4(axisW,0.)).xy;float al=length(ax);
  // Right of the axis, so the card keeps its front-facing winding.
  vec2 dir=al>1e-5?ax/al:vec2(0.,1.);vec2 perp=vec2(dir.y,-dir.x);
  // Seen down its axis a tongue is a round puff, not a sliver.
  float len=max(al,h*.55);
  // A tongue at the lens would fill the frame: it shrinks away inside the
  // last couple of metres instead.
  float near=smoothstep(.8,2.4,-center.z);len*=near;w*=near;
  vec4 p=center;
  p.xy+=dir*position.y*len*.25+perp*position.x*w*.09;
  // A little toward the camera, so a flame on a limb is not cut by it.
  p.xyz+=normalize(-center.xyz)*w*.06;
  gl_Position=projectionMatrix*p;
  vUv=vec2(position.x,position.y*.5+.5);vFire=instanceColor;
}`;
const fragment = `
uniform float uTime;varying vec2 vUv;varying vec3 vFire;
// Hash value noise: flames are many and overlap, so this stays cheap (one
// octave pair of 2D value noise, and an early discard outside the teardrop).
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
void main(){
  float y=vUv.y;
  float width=.92*pow(max(0.,1.-y),.75)*smoothstep(-.08,.2,y)+.03;
  if(abs(vUv.x)>width*1.25+.12*y)discard;
  float heat=vFire.r,seed=vFire.g*41.;int pal=int(vFire.b*4.+.5);
  float t=uTime*2.6+seed;
  float n=vnoise(vec2(vUv.x*1.7+seed,y*2.6-t*1.5));
  float m=vnoise(vec2(vUv.x*4.3-seed,y*5.2-t*2.4));
  float x=vUv.x+(n-.5)*.7*y;
  float d=abs(x)/width;
  float body=(1.-smoothstep(.5,1.,d+(m-.5)*.35))*(1.-smoothstep(.7,1.,y+(n-.5)*.3));
  if(body<.01)discard;
  float h=clamp(heat*(1.2-d*.75-y*.6)+(m-.5)*.28,0.,1.);
  vec3 col;float alpha;
  if(pal==1){
    // Amaterasu: the flame is black; only its licking edge glows, violet.
    float rim=smoothstep(.45,.95,d)+smoothstep(.72,.98,y)*.5;
    col=vec3(.3,.04,.42)*rim*(.35+.65*heat)*body+vec3(.012,.004,.02)*body;
    alpha=body*(.88-.3*rim);
  }else if(pal==3){
    // Bankai reiatsu: a black flame whose licking edge burns crimson.
    float rim=smoothstep(.74,.98,d)+smoothstep(.82,.99,y)*.5;
    col=vec3(1.6,.07,.05)*rim*(.25+.75*heat)*body+vec3(.01,.002,.003)*body;
    alpha=body*(.55+.4*heat)*(1.-.25*rim);
  }else if(pal==2){
    float rim=smoothstep(.35,.95,d);
    col=mix(vec3(.05,.004,.004),vec3(1.5,.08,.04),rim*heat)*body;
    alpha=body*(.62-.3*rim);
  }else{
    // Mostly orange and red; white-gold only at the hottest root.
    vec3 c=mix(vec3(.55,.035,.01),vec3(2.1,.5,.05),smoothstep(.1,.45,h));
    c=mix(c,vec3(3.6,2.2,.7),smoothstep(.68,.95,h));
    col=c*body;
    alpha=body*(1.-smoothstep(.06,.3,h))*.5;
  }
  gl_FragColor=vec4(col,alpha);
}`;

export function flameSpriteMaterial() {
  return new THREE.ShaderMaterial({
    name: 'SignatureFlame', vertexShader: vertex, fragmentShader: fragment,
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, toneMapped: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
}
export function flameSpriteGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
  g.setIndex([0, 1, 2, 2, 1, 3]);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  return g;
}
