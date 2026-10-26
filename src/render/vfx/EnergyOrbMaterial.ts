import { ShaderMaterial, Color, AdditiveBlending, NormalBlending, DoubleSide } from 'three';
import { VEIL, VEIL_GLSL, veilUniforms } from './VictimVeil';
import {noiseGLSL} from './noise';

export function energyOrbMaterial(violet=false,spirit=false){return new ShaderMaterial({
  uniforms:{uTime:{value:0},uTint:{value:new Color(violet?0x7231c7:0x087fdc)},uSpirit:{value:spirit?1:0},uViolet:{value:violet?1:0}},transparent:true,depthWrite:false,toneMapped:false,blending:NormalBlending,
  vertexShader:`varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;void main(){vPosition=position;vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float uTime;uniform vec3 uTint;uniform float uSpirit;uniform float uViolet;varying vec3 vNormal;varying vec3 vView;varying vec3 vPosition;${noiseGLSL}
  void main(){
    vec3 p=normalize(vPosition);float facing=max(0.,dot(normalize(vNormal),normalize(vView)));
    float noise=snoise(p*5.+vec3(0.,uTime*1.7,uTime*.6));
    float detail=snoise(p*17.+vec3(uTime*1.2,0.,-uTime*2.));
    float swirl=sin(atan(p.z,p.x)*9.+p.y*12.-uTime*13.+noise*2.);
    float lines=smoothstep(.81,.99,swirl)*(.55+.45*detail);
    float rim=pow(1.-facing,2.6);
    if(uViolet>.5){
      // Black and white chakra compressed: churning dark shell, violet swirl
      // lines, a burning rim and a core so dense it swallows the light.
      float churn=snoise(p*3.2+vec3(uTime*.9,-uTime*1.3,uTime*.4));
      vec3 shell=mix(vec3(.012,.004,.024),vec3(.2,.05,.36),smoothstep(-.35,.85,churn+lines*.8));
      shell+=vec3(.9,.45,1.9)*lines*(1.-facing)*.9;
      shell+=vec3(1.1,.55,2.4)*rim*1.5+vec3(2.2,1.9,3.2)*pow(rim,5.)*1.3;
      shell=mix(shell,vec3(.004,.001,.008),smoothstep(.72,.98,facing)*.75);
      gl_FragColor=vec4(shell,.985);
      return;
    }
    if(uSpirit>.5){
      // The Spirit Bomb: dense blue-white energy, not a white disc that
      // blooms into a haze over the frame. A saturated blue body churning,
      // streams of energy pouring in from the rim toward the heart (bands in
      // view space that travel inward), a pale burning rim and a small white
      // core - bright where it counts and blue everywhere else.
      vec3 n=normalize(vNormal);
      float ang=atan(n.y,n.x);
      float churn=snoise(p*3.+vec3(uTime*.6,-uTime*.8,uTime*.4));
      float streams=smoothstep(.3,.9,snoise(vec3(ang*3.2,facing*5.-uTime*2.4,uTime*.3)));
      float rings=pow(.5+.5*sin(facing*24.-uTime*8.+churn*2.),8.);
      vec3 deep=vec3(.015,.12,.8),mid=vec3(.2,.62,1.8);
      vec3 spirit=mix(deep,mid,smoothstep(-.5,.9,churn)*.55+streams*.45);
      spirit+=vec3(.6,1.2,2.4)*(streams*.5+rings*.2)*(1.-pow(facing,5.));
      spirit+=vec3(.8,1.45,2.4)*pow(1.-facing,2.4)*1.5;
      spirit=mix(spirit,vec3(2.4,2.8,3.2),pow(facing,18.)*.7);
      gl_FragColor=vec4(spirit,.98);
      return;
    }
    // A saturated, opaque silhouette survives both the pale sky and bloom.
    float interior=smoothstep(.12,.72,facing);
    vec3 color=mix(uTint,vec3(.012,.25,1.0),interior*.62);
    // Fire tints (a fist, a foot, the Entei sun) keep their lines and rim
    // under the bloom threshold, so the body reads orange round the white.
    float warm=step(uTint.b,uTint.r);
    color+=vec3(.005,.025,.07)*(noise*.5+.5)+vec3(.05,.2,.7)*lines*interior*mix(2.2,1.1,warm);
    color+=uTint*rim*mix(1.6,.6,warm);
    // Fire burns orange, not yellow: pull a warm tint's body toward red.
    color*=mix(vec3(1.),vec3(1.,.66,.36),warm);
    // Fire keeps a tighter white heart so the body still reads orange.
    float hot=pow(facing,mix(8.,14.,warm));
    // A fire tint (Red Hawk, Hiken, the Entei sun) burns white-gold at the
    // centre; ki and chakra burn blue-white.
    vec3 white=mix(vec3(2.5,2.75,3.),vec3(3.1,2.55,1.7),warm);
    color=mix(color,white,hot*.92);
    gl_FragColor=vec4(min(color,vec3(4.)),.97);
  }`
});}
export function energyHaloMaterial(){return new ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,blending:AdditiveBlending,
  vertexShader:`varying vec3 n;varying vec3 v;void main(){n=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);v=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec3 n;varying vec3 v;void main(){float f=max(0.,dot(normalize(n),normalize(v)));float a=pow(1.-f,2.)*smoothstep(0.,.2,f)*.2;gl_FragColor=vec4(.015,.45,1.,a);}`
});}

export function energyImpactMaterial(violet = false, duration = .5, ultimate = false) {
  return new ShaderMaterial({
    name: 'CombatPressureShell', transparent: true, depthWrite: false,
    toneMapped: false, blending: NormalBlending,
    uniforms: {
      uTime: { value: 0 }, uAge: { value: 0 }, uDuration: { value: duration }, uSeed: { value: 0 },
      uTint: { value: new Color(violet ? 0x8543e8 : 0x0062d9) }, uUltimate:{value:ultimate?1:0},uFloor:{value:-1000},
      ...veilUniforms(VEIL.burst),
    },
    vertexShader: `uniform float uAge;uniform float uTime;uniform float uSeed;uniform float uUltimate;uniform float uFloor;
      varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;varying float vNoise;varying vec3 vVeil;
      ${noiseGLSL}
      void main(){
        vLocal=normal;
        // Low-frequency BurstSphere billows supply large uneven lobes; a
        // second octave cuts their contours instead of drawing a round rim.
        vec3 np=normal*2.4+vec3(uSeed,uAge*1.8,-uAge);
        vNoise=snoise(np)*.7+snoise(np*2.1)*.3;
        float amount=mix(.012,.13,smoothstep(0.,.18,uAge));
        amount=mix(amount,.05+.29*smoothstep(0.,.08,uAge),uUltimate);
        vec3 displaced=position+normal*vNoise*amount;
        displaced.y=max(displaced.y,uFloor);
        vNormal=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*vec4(displaced,1.);vView=-mv.xyz;vVeil=(modelMatrix*vec4(displaced,1.)).xyz;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader: `uniform float uTime;uniform float uAge;uniform float uDuration;uniform float uSeed;uniform vec3 uTint;uniform float uUltimate;uniform float uVeilStrength;
      varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;varying float vNoise;varying vec3 vVeil;
      ${noiseGLSL}
      ${VEIL_GLSL}
      void main(){
        float facing=max(0.,dot(normalize(vNormal),normalize(vView)));
        float grain=snoise(vLocal*5.+vec3(uAge*2.,uSeed,-uAge));
        if(uUltimate>.5){
          // Opaque hot mass first, then broad disjoint pieces. Removing pieces
          // rather than reducing their opacity prevents the glass-orb stage.
          float dissolve=smoothstep(.14,uDuration,uAge);
          float heat=clamp(.55+vNoise*.48+grain*.14,0.,1.);
          if(heat<dissolve||uAge>=uDuration)discard;
          float edge=1.-smoothstep(.02,.14,heat-dissolve);
          float white=clamp(.12+smoothstep(.12,.9,facing)*.83+edge*.18,0.,1.);
          // Three printed values and sparse dots retain the source burst silhouette.
          float band=smoothstep(.38,.44,white)*.35+smoothstep(.68,.74,white)*.65;
          vec3 color=mix(uTint,vec3(1.08,1.13,1.14),band);
          float contour=1.-smoothstep(.045,.13,facing);
          color=mix(color,vec3(.025,.035,.055),contour*.85);
          float dots=1.-smoothstep(.12,.22,length(fract(gl_FragCoord.xy/4.)-.5));
          color=mix(color,vec3(.04,.075,.10),dots*(1.-band)*.4);
          gl_FragColor=vec4(color,.98*victimVeil(vVeil,uVeilStrength));
          return;
        }
        float rim=pow(1.-facing,2.1);
        float filaments=pow(1.-abs(grain),12.);
        float closed=1.-smoothstep(.025,.13,uAge);
        float fade=1.-smoothstep(uDuration*.32,uDuration,uAge);
        float torn=smoothstep(-.7+.9*smoothstep(.12,uDuration,uAge),.5,vNoise);
        float alpha=(closed*.94+(1.-closed)*(rim*.85+filaments*.2)*torn)*fade;
        if(alpha<.004)discard;
        vec3 color=mix(uTint,vec3(.01,.22,1.),.12+.45*floor((grain*.5+.5)*4.)/4.);
        float hot=pow(facing,9.)*closed*.85+filaments*rim*.3;
        color=mix(color,vec3(1.08,1.22,1.3),clamp(hot,0.,.9));
        gl_FragColor=vec4(color,alpha*victimVeil(vVeil,uVeilStrength));
      }`,
  });
}

export function pressureWaveMaterial(violet = false) {
  return new ShaderMaterial({
    name: 'CombatGroundPressure', transparent: true, depthWrite: false,
    toneMapped: false, blending: NormalBlending, side: DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uAge: { value: 0 }, uSeed: { value: 0 },
      uReach: { value: 7.8 }, uFront: { value: 1.8 }, uWidth: { value: .4 }, uLift: { value: .22 },
      uTint: { value: new Color(violet ? 0x8846ee : 0x069ecc) },
      uDust: { value: 1 }, uEnergy: { value: 1 },
      ...veilUniforms(VEIL.dust),
    },
    vertexShader: `uniform float uReach;uniform float uFront;uniform float uWidth;uniform float uLift;
      varying vec2 vLocal;varying vec3 vVeil;
      void main(){
        vec2 plane=position.xy*uReach;vLocal=plane;
        float d=length(plane)-uFront;
        float packet=exp(-(d*d)/(uWidth*uWidth));
        vVeil=(modelMatrix*vec4(plane,packet*uLift,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(plane,packet*uLift,1.);
      }`,
    fragmentShader: `uniform float uTime;uniform float uAge;uniform float uSeed;uniform float uFront;uniform float uWidth;uniform vec3 uTint;uniform float uDust;uniform float uEnergy;uniform float uVeilStrength;
      varying vec2 vLocal;varying vec3 vVeil;${noiseGLSL}
      ${VEIL_GLSL}
      void main(){
        float r=length(vLocal);if(r<.01)discard;
        vec2 dir=vLocal/r;
        float footprint=max(fwidth(vLocal.x),fwidth(vLocal.y));
        float detail=1.-smoothstep(.03,.18,footprint);
        float wobble=snoise(vec3(dir*3.1,uSeed))*.33;
        float d=r-uFront-wobble*detail;
        float width=max(uWidth,footprint*1.5);
        float packet=exp(-d*d/(width*width))*uWidth/width;
        float phase=atan(dir.y,dir.x)*23.+snoise(vec3(dir*4.,uSeed))*2.4-uTime*2.;
        float teeth=pow(.5+.5*cos(phase),3.);
        float energy=packet*mix(.85,.5+teeth,detail)*(1.-smoothstep(.32,.85,uAge))*uEnergy;
        float lead=exp(-pow((d-width*.2)/(width*.2),2.))*detail;
        float dustNoise=.5+.5*snoise(vec3(vLocal*2.2-dir*uAge*3.,uSeed));
        float dustBand=exp(-pow((d+.5)/(width*1.8),2.));
        float dust=dustBand*(.3+.7*dustNoise)*smoothstep(0.,.035,uAge)*(1.-smoothstep(.48,1.22,uAge))*uDust;
        float alpha=clamp(energy*.9+dust*.6,0.,.94);
        if(alpha<.004)discard;
        vec3 color=mix(vec3(.34,.3,.23),vec3(.72,.66,.49),dustNoise);
        color=mix(color,uTint,energy/max(.001,energy+dust*.34));
        color=mix(color,vec3(.78,1.05,1.15),lead*energy*.35);
        gl_FragColor=vec4(color,alpha*victimVeil(vVeil,uVeilStrength));
      }`,
  });
}

export function groundDustMaterial() {
  return new ShaderMaterial({
    name:'CombatGroundDust', transparent:true, depthWrite:false, toneMapped:false,
    blending:NormalBlending,
    uniforms:{uAge:{value:0},uTime:{value:0},uOpacity:{value:.85},uSeed:{value:0},...veilUniforms(VEIL.dust)},
    vertexShader:`uniform float uAge;uniform float uTime;uniform float uSeed;
      varying vec3 vLocal;varying vec3 vNormal;varying vec3 vView;varying vec3 vVeil;${noiseGLSL}
      void main(){vLocal=normal;float n=snoise(normal*3.4+vec3(uSeed,uAge*.8,0.));
        vec3 p=position*(1.+n*.17);vNormal=normalize(normalMatrix*normal);
        vec4 mv=modelViewMatrix*instanceMatrix*vec4(p,1.);vView=-mv.xyz;vVeil=(modelMatrix*instanceMatrix*vec4(p,1.)).xyz;
        gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uAge;uniform float uTime;uniform float uOpacity;uniform float uSeed;uniform float uVeilStrength;
      varying vec3 vLocal;varying vec3 vNormal;varying vec3 vView;varying vec3 vVeil;${noiseGLSL}
      ${VEIL_GLSL}
      void main(){float n=snoise(vLocal*4.+vec3(uSeed,uAge*1.6,-uAge));
        float facing=max(0.,dot(normalize(vNormal),normalize(vView)));
        float broken=smoothstep(-.55,.1,n+facing*.6);
        float alpha=broken*smoothstep(0.,.2,facing)*uOpacity;
        if(alpha<.01)discard;
        float shade=floor(clamp(n*.35+.55+vLocal.y*.17,0.,1.)*4.)/4.;
        vec3 color=mix(vec3(.23,.20,.16),vec3(.66,.60,.48),shade);
        gl_FragColor=vec4(color,alpha*victimVeil(vVeil,uVeilStrength));}`,
  });
}
