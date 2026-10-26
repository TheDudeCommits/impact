import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShaderMaterial } from 'three';
import { noiseGLSL } from './noise';

export function windBladeGeometry() {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const segments = 20, rows = 4;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, q = 1 - t;
    const upper = [q*q*.08 + 2*q*t*.90 + t*t*2.5, q*q*.52 + 2*q*t*1.10 + t*t*.03];
    const lower = [q*q*.12 + 2*q*t*.90 + t*t*2.5, q*q*-.52 + 2*q*t*-.55 + t*t*.03];
    for (let j = 0; j <= rows; j++) {
      const w = j / rows;
      positions.push(lower[0] + (upper[0] - lower[0])*w, lower[1] + (upper[1] - lower[1])*w, 0);
      uvs.push(t, w);
      if (i < segments && j < rows) {
        const a = i*(rows+1)+j, b = a+rows+1;
        indices.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

export function windBladeMaterial() {
  return new ShaderMaterial({
    name: 'RasenshurikenWind', transparent: true, depthWrite: false,
    side: DoubleSide, forceSinglePass: true, toneMapped: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vWind;void main(){vWind=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime;varying vec2 vWind;${noiseGLSL}
      void main(){
        float turbulent=snoise(vec3(vWind.x*9.-uTime*8.,vWind.y*4.,uTime*.8));
        float lateral=abs(vWind.y-.5)*2.;
        float edge=1.-smoothstep(.42+turbulent*.14,1.,lateral);
        float tip=1.-smoothstep(.78,1.,vWind.x);
        float streak=.5+.5*sin(vWind.y*35.+vWind.x*11.-uTime*17.+turbulent*2.);
        float density=edge*tip*(.68+.19*streak+.08*turbulent);
        float center=1.-smoothstep(.08,.72,lateral);
        vec3 color=mix(vec3(.22,.60,.81),vec3(.94,.99,1.),center*(.8+.2*streak));
        // The approved blade keeps its silhouette and density exactly; only
        // its spine burns over the bloom threshold, so the wind glows.
        color*=1.+center*center*(1.1+.5*streak)*tip;
        gl_FragColor=vec4(color,density);
      }`,
  });
}
