import { Color, CustomBlending, DoubleSide, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial } from 'three';
import { noiseGLSL } from './noise';

export function fireFistMaterial() {
  return new ShaderMaterial({
    name: 'HikenFire', transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uTime: { value: 0 }, uTint: { value: new Color(0xff6a12) } },
    vertexShader: `uniform float uTime;varying vec3 vFlame;varying vec3 vNormal;varying vec3 vView;${noiseGLSL}
      void main(){
        vFlame=position;
        float n=snoise(position*4.+vec3(0.,0.,uTime*5.));
        float small=snoise(position*10.+vec3(0.,0.,uTime*8.));
        vec3 p=position+normal*(n*.10+small*.035);
        vNormal=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(p,1.);vView=-mv.xyz;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `uniform float uTime;varying vec3 vFlame;varying vec3 vNormal;varying vec3 vView;${noiseGLSL}
      void main(){
        vec3 flow=vFlame*vec3(4.,4.,1.7)+vec3(0.,0.,uTime*4.);
        float n=snoise(flow)*.72+snoise(flow*2.3)*.28;
        float facing=max(0.,dot(normalize(vNormal),normalize(vView)));
        float heat=n*.45+facing*.35+.25;
        // Red edges, an orange body and a white-gold heart over the bloom
        // threshold, flickering with the flow: the fist is burning, not lit.
        float flick=.9+.1*sin(uTime*31.+vFlame.z*9.);
        vec3 color=mix(vec3(.88,.045,.006),vec3(1.5,.36,.02),smoothstep(.1,.35,heat));
        color=mix(color,vec3(2.3,.95,.12),smoothstep(.45,.64,heat));
        color=mix(color,vec3(3.2,2.3,.95),smoothstep(.78,.95,heat)*flick);
        float edge=smoothstep(.01,.24+n*.1,facing);
        gl_FragColor=vec4(color,edge*.94);
      }`,
  });
}

export function fireTongueMaterial() {
  return new ShaderMaterial({
    name: 'HikenWake', transparent: true, depthWrite: false, toneMapped: false,
    side: DoubleSide, forceSinglePass: true,
    blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 p;varying float seed;void main(){p=uv;seed=instanceColor.r*19.;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime;varying vec2 p;varying float seed;
      void main(){
        float sway=(sin(p.y*8.-uTime*11.+seed)*.12+sin(p.y*17.+uTime*9.+seed)*.035)*p.y;
        float width=.43*pow(1.-p.y,.65)*(1.+.18*sin(p.y*21.-uTime*14.+seed));
        float radial=abs(p.x-.5-sway)/max(.001,width);
        float alpha=(1.-smoothstep(.58,1.,radial))*smoothstep(0.,.12,p.y)*(1.-smoothstep(.7,1.,p.y));
        vec3 color=mix(vec3(1.,.12,.008),vec3(1.8,.55,.03),1.-radial);
        color=mix(color,vec3(3.,2.,.5),(1.-smoothstep(.08,.5,radial))*(1.-p.y));
        gl_FragColor=vec4(color*alpha*.8,alpha*.3*smoothstep(.3,1.,radial));
      }`,
  });
}
