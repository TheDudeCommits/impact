import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FireField, type FireSpot } from '../rift/fire';
import { addShaderPatch } from '../look/shaderPatch';
import { installCameraCutaway } from '../CameraCutaway';

export class StageAmbient {
  readonly root = new THREE.Group();
  readonly time = { value: 0 };
  private readonly pixelScale = { value: 600 };
  private readonly fires: FireField[] = [];
  private readonly updaters: ((time: number) => void)[] = [];
  private readonly disposables: { dispose(): void }[] = [];
  private readonly size = new THREE.Vector2();

  constructor(name: string) { this.root.name = `${name}: ambient`; }

  update(time: number) {
    this.time.value = time;
    for (const fire of this.fires) fire.update(time);
    for (const update of this.updaters) update(time);
  }

  onUpdate(update: (time: number) => void) { this.updaters.push(update); }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
  }

  private readonly measure = (renderer: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera) => {
    const target = renderer.getRenderTarget();
    const height = target ? target.height : renderer.getDrawingBufferSize(this.size).y;
    const projection = (camera as THREE.PerspectiveCamera).projectionMatrix;
    this.pixelScale.value = height * .5 * projection.elements[5];
  };

  birds(o: { centre: THREE.Vector3Tuple; count: number; radius: number; height?: number; spread?: number; speed?: number; size?: number; color?: number; seed?: number }) {
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, .32, -1, .05, -.18, 0, 0, -.12,
      0, 0, .32, 0, 0, -.12, 1, .05, -.18,
      0, .04, .4, -.1, 0, -.5, .1, 0, -.5,
    ], 3));
    const seed = new Float32Array(o.count * 4);
    let s = o.seed ?? 1;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < o.count; i++) {
      const dir = rand() < .5 ? -1 : 1;
      seed.set([o.radius * (.55 + rand() * .9), (o.height ?? 0) + (rand() - .5) * (o.spread ?? 8),
        dir * (o.speed ?? 6) / o.radius * (.75 + rand() * .5), rand() * Math.PI * 2], i * 4);
    }
    wing.setAttribute('aBird', new THREE.InstancedBufferAttribute(seed, 4));
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uCentre: { value: new THREE.Vector3(...o.centre) }, uScale: { value: o.size ?? .55 }, uColor: { value: new THREE.Color(o.color ?? 0x1a1820) },
      }]),
      vertexShader: `
        attribute vec4 aBird;
        uniform float uTime, uScale;
        uniform vec3 uCentre;
        #include <fog_pars_vertex>
        void main() {
          float a = aBird.w + uTime * aBird.z;
          vec3 at = uCentre + vec3( cos( a ) * aBird.x, aBird.y + sin( uTime * .5 + aBird.w * 3. ) * 1.2, sin( a ) * aBird.x );
          vec3 fwd = normalize( vec3( -sin( a ), 0., cos( a ) ) * sign( aBird.z ) );
          vec3 side = vec3( fwd.z, 0., -fwd.x );
          vec3 p = position;
          float beat = sin( uTime * ( 8. + fract( aBird.w * 7.3 ) * 4. ) + aBird.w * 19. );
          // Glide now and then: the wings held, a little up.
          float glide = smoothstep( .3, .7, sin( uTime * .4 + aBird.w * 5. ) );
          p.y += abs( p.x ) * mix( beat * .75, .18, glide );
          vec3 world = at + ( side * p.x + vec3( 0., 1., 0. ) * p.y + fwd * p.z ) * uScale;
          vec4 mvPosition = viewMatrix * vec4( world, 1. );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = vec4( uColor, 1. );
          #include <fog_fragment>
        }`,
      side: THREE.DoubleSide, fog: true,
    });
    material.uniforms.uTime = this.time;
    const mesh = new THREE.InstancedMesh(wing, material, o.count);
    mesh.frustumCulled = false; mesh.name = 'birds';
    this.root.add(mesh);
    return mesh;
  }

  motes(o: { min: THREE.Vector3Tuple; max: THREE.Vector3Tuple; count: number; velocity: THREE.Vector3Tuple; size: number; color: number; color2?: number;
    opacity?: number; wobble?: number; additive?: boolean; twinkle?: number; seed?: number }) {
    const geometry = new THREE.BufferGeometry();
    const seeds = new Float32Array(o.count * 4);
    let s = o.seed ?? 7;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(o.count * 3), 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    const min = new THREE.Vector3(...o.min), size = new THREE.Vector3(...o.max).sub(min);
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uMin: { value: min }, uSize: { value: size }, uVelocity: { value: new THREE.Vector3(...o.velocity) },
        uPoint: { value: o.size }, uColor: { value: new THREE.Color(o.color) }, uColor2: { value: new THREE.Color(o.color2 ?? o.color) },
        uOpacity: { value: o.opacity ?? 1 }, uWobble: { value: o.wobble ?? 0 }, uTwinkle: { value: o.twinkle ?? 0 },
      }]),
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime, uPoint, uWobble, uPixelScale;
        uniform vec3 uMin, uSize, uVelocity;
        varying float vFade;
        varying float vMix;
        #include <fog_pars_vertex>
        void main() {
          vec3 f = fract( aSeed.xyz + uVelocity * uTime / uSize );
          vec3 p = uMin + f * uSize;
          p.x += sin( uTime * ( .5 + aSeed.w ) + aSeed.w * 31. ) * uWobble;
          p.z += cos( uTime * ( .4 + aSeed.y ) + aSeed.x * 23. ) * uWobble;
          // Fade in and out at the ends of the box the drift runs through.
          vec3 edge = min( f, 1. - f ) * uSize;
          vFade = smoothstep( 0., 1.5, min( min( edge.x, edge.z ), edge.y * 2. ) );
          vMix = aSeed.w;
          vec4 mvPosition = viewMatrix * vec4( p, 1. );
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp( uPoint * ( .6 + aSeed.y * .8 ) * uPixelScale / max( -mvPosition.z, .1 ), 1., 48. );
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uColor, uColor2;
        uniform float uOpacity, uTwinkle, uTime;
        varying float vFade;
        varying float vMix;
        #include <fog_pars_fragment>
        void main() {
          float r = length( gl_PointCoord - .5 ) * 2.;
          float a = smoothstep( 1., .15, r ) * vFade * uOpacity;
          a *= 1. - uTwinkle * ( .5 + .5 * sin( uTime * 6. + vMix * 60. ) );
          if ( a < .01 ) discard;
          gl_FragColor = vec4( mix( uColor, uColor2, vMix ), a );
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    material.uniforms.uTime = this.time; material.uniforms.uPixelScale = this.pixelScale;
    const points = new THREE.Points(geometry, material);
    this.disposables.push(geometry, material);
    points.frustumCulled = false; points.name = 'motes';
    points.onBeforeRender = this.measure;
    this.root.add(points);
    return points;
  }

  puffs(o: { spots: { x: number; y: number; z: number; size: number }[]; color: number; shade?: number; opacity: number; life?: number; rise?: number;
    drift?: THREE.Vector3Tuple; grow?: number; additive?: boolean; flat?: boolean; seed?: number; order?: number;
    cel?: boolean }) {
    const card = new THREE.PlaneGeometry(1, 1);
    const n = o.spots.length;
    const seeds = new Float32Array(n);
    let s = o.seed ?? 11;
    for (let i = 0; i < n; i++) seeds[i] = (s = (s * 16807) % 2147483647) / 2147483647;
    card.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uColor: { value: new THREE.Color(o.color) }, uShade: { value: new THREE.Color(o.shade ?? o.color) }, uOpacity: { value: o.opacity },
        uLife: { value: o.life ?? 6 }, uRise: { value: o.rise ?? 4 }, uDrift: { value: new THREE.Vector3(...(o.drift ?? [0, 0, 0])) },
        uGrow: { value: o.grow ?? 1.8 }, uFlat: { value: o.flat ? 1 : 0 }, uCel: { value: o.cel ? 1 : 0 },
      }]),
      vertexShader: `
        attribute float aSeed;
        uniform float uTime, uLife, uRise, uGrow, uFlat;
        uniform vec3 uDrift;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vSeed;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv; vSeed = aSeed;
          vec3 centre = ( instanceMatrix * vec4( 0., 0., 0., 1. ) ).xyz;
          float size = length( instanceMatrix[ 0 ].xyz );
          float life = uLife > 0. ? fract( uTime / uLife + aSeed ) : .5;
          vec3 at = centre + vec3( 0., uRise * life, 0. ) + uDrift * ( uLife > 0. ? life * uLife : uTime );
          if ( uLife <= 0. ) at.xz += vec2( sin( uTime * .05 + aSeed * 40. ), cos( uTime * .043 + aSeed * 17. ) ) * size * .08;
          size *= mix( 1., uGrow, life );
          vAlpha = uLife > 0. ? sin( life * 3.14159 ) : 1.;
          vec3 right, up;
          if ( uFlat > .5 ) { right = vec3( 1., 0., 0. ); up = vec3( 0., 0., -1. ); }
          else {
            vec3 toCam = normalize( cameraPosition - at );
            right = normalize( cross( vec3( 0., 1., 0. ), toCam ) );
            up = cross( toCam, right );
          }
          float turn = aSeed * 6.2831 + uTime * .05 * ( aSeed - .5 );
          vec2 q = mat2( cos( turn ), -sin( turn ), sin( turn ), cos( turn ) ) * position.xy;
          vec3 world = at + ( right * q.x + up * q.y ) * size;
          vec4 mvPosition = viewMatrix * vec4( world, 1. );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uColor, uShade;
        uniform float uOpacity, uTime, uCel;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vSeed;
        #include <fog_pars_fragment>
        float pHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
        float pNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
          return mix( mix( pHash( i ), pHash( i + vec2( 1., 0. ) ), f.x ), mix( pHash( i + vec2( 0., 1. ) ), pHash( i + vec2( 1., 1. ) ), f.x ), f.y ); }
        void main() {
          vec2 p = vUv * 2. - 1.;
          float n = pNoise( p * 2.3 + vSeed * 17. + uTime * .04 ) * .6 + pNoise( p * 5.1 - vSeed * 9. ) * .4;
          float body = uCel > .5 ? smoothstep( .74, .66, length( p ) + ( n - .5 ) * .7 ) : smoothstep( 1., .25, length( p ) + ( n - .5 ) * .55 );
          float a = body * vAlpha * uOpacity;
          if ( a < .006 ) discard;
          // Lit from above, shaded below (as cels: two tones and a hard terminator).
          float lit = uCel > .5 ? smoothstep( -.06, .06, p.y + .15 + ( n - .5 ) * .9 ) : smoothstep( -.7, .6, p.y + ( n - .5 ) * .6 );
          vec3 colour = mix( uShade, uColor, lit );
          gl_FragColor = vec4( colour, a );
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    material.uniforms.uTime = this.time;
    const mesh = new THREE.InstancedMesh(card, material, n);
    const m = new THREE.Matrix4();
    o.spots.forEach((p, i) => mesh.setMatrixAt(i, m.makeScale(p.size, p.size, p.size).setPosition(p.x, p.y, p.z)));
    mesh.frustumCulled = false; mesh.name = 'puffs';
    mesh.renderOrder = o.order ?? 2;
    this.root.add(mesh);
    return mesh;
  }

  cloth(map: THREE.Texture, o: { x: number; y: number; z: number; width: number; height: number; rot?: number; uv?: [number, number, number, number]; color?: number; wind?: number;
    readable?: boolean;
    lit?: number }) {
    const geometry = new THREE.PlaneGeometry(o.width, o.height, 6, 12);
    geometry.translate(0, -o.height / 2, 0);
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute, p = geometry.getAttribute('position') as THREE.BufferAttribute;
    const [u0, v0, u1, v1] = o.uv ?? [0, 0, 1, 1];
    const cloth = new Float32Array(uv.count * 2), seed = (o.x * 12.9898 + o.z * 78.233) % 6.28;
    for (let i = 0; i < uv.count; i++) {
      cloth[i * 2] = -p.getY(i); cloth[i * 2 + 1] = seed + uv.getX(i) * 2.5;
      uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    }
    geometry.setAttribute('aCloth', new THREE.BufferAttribute(cloth, 2));
    geometry.setAttribute('aClothU', new THREE.BufferAttribute(new Float32Array(uv.count).fill(u0 + u1), 1));
    geometry.rotateY(o.rot ?? 0).translate(o.x, o.y, o.z);
    const material = this.clothMaterial(map, o.color ?? 0xffffff, o.wind ?? 1, o.readable ?? false, o.lit ?? 0);
    const list = this.clothParts.get(material) ?? [];
    list.push(geometry); this.clothParts.set(material, list);
  }
  private readonly clothParts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private readonly cloths = new Map<string, THREE.MeshStandardMaterial>();
  private clothMaterial(map: THREE.Texture, color: number, wind: number, readable: boolean, lit: number) {
    const key = `${map.uuid}|${color}|${wind}|${readable}|${lit}`;
    let material = this.cloths.get(key);
    if (material) return material;
    material = new THREE.MeshStandardMaterial({ map, color, roughness: 1, side: THREE.DoubleSide, alphaTest: .4 });
    const time = this.time;
    addShaderPatch(material, `br-cloth-${wind}`, shader => {
      shader.uniforms.uClothTime = time;
      shader.vertexShader = 'uniform float uClothTime;\nattribute vec2 aCloth;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hang = clamp( aCloth.x / 6., 0., 1. );
        float gust = ${wind.toFixed(2)} * ( .8 + .4 * sin( uClothTime * .37 + aCloth.y ) );
        float wave = sin( aCloth.x * 1.6 + uClothTime * 2.1 + aCloth.y * 2.7 ) * .22 + sin( aCloth.y * 6.3 + aCloth.x * 2. - uClothTime * 2.9 ) * .07;
        transformed += objectNormal * hang * gust * wave;`);
    });
    if (readable) addShaderPatch(material, 'br-cloth-readable', shader => {
      shader.vertexShader = 'attribute float aClothU;\nvarying float vClothU;\n' + shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n        vClothU = aClothU;');
      shader.fragmentShader = 'varying float vClothU;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
          if ( ! gl_FrontFacing ) diffuseColor = vec4( diffuse, opacity ) * texture2D( map, vec2( vClothU - vMapUv.x, vMapUv.y ) );
        #endif`);
    });
    if (lit > 0) addShaderPatch(material, `br-cloth-lit-${lit}`, shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * ${lit.toFixed(3)};`);
    });
    installCameraCutaway(material);
    this.cloths.set(key, material);
    return material;
  }

  finish() {
    for (const [material, list] of this.clothParts) {
      const geometry = mergeGeometries(list);
      list.forEach(g => g.dispose());
      if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'cloth'; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    this.clothParts.clear();
  }

  fire(spots: FireSpot[]) {
    const empty = new THREE.DataTexture(new Uint8Array(8), 1, 2); empty.needsUpdate = true;
    const field = new FireField(Math.max(1, spots.length), { uBroken: { value: empty }, uRiftTime: this.time });
    field.set(spots);
    this.fires.push(field);
    this.disposables.push(empty);
    this.root.add(field.root);
    return field;
  }

  flowWater(material: THREE.MeshStandardMaterial, flow: [number, number], glint = .25) {
    const time = this.time;
    addShaderPatch(material, 'br-flow-water', shader => {
      shader.uniforms.uFlowTime = time;
      shader.uniforms.uFlow = { value: new THREE.Vector2(...flow) };
      shader.fragmentShader = 'uniform float uFlowTime;\nuniform vec2 uFlow;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 flowA = texture2D( map, vMapUv + uFlow * uFlowTime );
          vec4 flowB = texture2D( map, vMapUv * 1.31 + vec2( .37, .11 ) + uFlow * uFlowTime * 1.7 );
          vec4 sampledDiffuseColor = mix( flowA, flowB, .45 );
          diffuseColor *= sampledDiffuseColor;
          float flowGlint = smoothstep( .55, .95, max( flowA.r + flowA.g + flowA.b, flowB.r + flowB.g + flowB.b ) / 3. );
          diffuseColor.rgb += flowGlint * ${glint.toFixed(3)};
        #endif`);
    });
  }

  waterfall(o: { x: number; y: number; z: number; width: number; height: number; rot?: number; color?: number; speed?: number; curve?: number }) {
    const geometry = new THREE.PlaneGeometry(o.width, o.height, 12, 8);
    const p = geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / o.width, v = p.getY(i) / o.height + .5;
      p.setZ(i, (o.curve ?? 1) * (1 - 4 * u * u) * .6 + Math.sin(v * Math.PI) * .4);
    }
    geometry.computeVertexNormals();
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uColor: { value: new THREE.Color(o.color ?? 0xcfe8ff) }, uSpeed: { value: o.speed ?? .55 },
      }]),
      vertexShader: `
        varying vec2 vUv;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4( position, 1. );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime, uSpeed;
        varying vec2 vUv;
        #include <fog_pars_fragment>
        float wHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
        float wNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
          return mix( mix( wHash( i ), wHash( i + vec2( 1., 0. ) ), f.x ), mix( wHash( i + vec2( 0., 1. ) ), wHash( i + vec2( 1., 1. ) ), f.x ), f.y ); }
        void main() {
          float t = uTime * uSpeed;
          // Long streaks falling, faster further down.
          float fall = vUv.y + t * ( 1.2 + ( 1. - vUv.y ) * .6 );
          float streak = wNoise( vec2( vUv.x * 46., fall * 3. ) ) * .6 + wNoise( vec2( vUv.x * 120., fall * 7. ) ) * .4;
          float thick = smoothstep( .25, .85, streak );
          float lip = smoothstep( .9, 1., vUv.y ), foot = smoothstep( .14, 0., vUv.y );
          float sides = smoothstep( 0., .06, vUv.x ) * smoothstep( 1., .94, vUv.x );
          vec3 colour = mix( uColor * .62, vec3( 1. ), thick * .8 + foot * .5 + lip * .3 );
          float alpha = ( .55 + thick * .45 ) * sides * ( 1. - foot * .55 );
          gl_FragColor = vec4( colour * 1.15, alpha );
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    material.uniforms.uTime = this.time;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.rot ?? 0;
    mesh.name = 'waterfall'; mesh.renderOrder = 3;
    this.root.add(mesh);
    return mesh;
  }

  foam(o: { spots: { x: number; z: number; radius: number }[]; y: number; color?: number; opacity?: number }) {
    const card = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const seeds = new Float32Array(o.spots.length).map((_, i) => (i * .618) % 1);
    card.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uColor: { value: new THREE.Color(o.color ?? 0xf4fbff) }, uOpacity: { value: o.opacity ?? .8 },
      }]),
      vertexShader: `
        attribute float aSeed;
        varying vec2 vUv;
        varying float vSeed;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv; vSeed = aSeed;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4( position, 1. );
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity, uTime;
        varying vec2 vUv;
        varying float vSeed;
        #include <fog_pars_fragment>
        float fHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
        float fNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3. - 2. * f );
          return mix( mix( fHash( i ), fHash( i + vec2( 1., 0. ) ), f.x ), mix( fHash( i + vec2( 0., 1. ) ), fHash( i + vec2( 1., 1. ) ), f.x ), f.y ); }
        void main() {
          vec2 p = vUv * 2. - 1.;
          float r = length( p );
          float a = atan( p.y, p.x );
          float n = fNoise( vec2( a * 3. + vSeed * 20., r * 6. - uTime * .9 ) ) * .7 + fNoise( p * 9. + uTime * .3 ) * .3;
          // Thickest at the rim of what it surrounds, frothing outward.
          float ring = smoothstep( .3, .5, r ) * smoothstep( 1., .55, r + ( n - .5 ) * .3 );
          float foam = ring * smoothstep( .35, .65, n + ( 1. - r ) * .25 );
          if ( foam < .02 ) discard;
          gl_FragColor = vec4( uColor, foam * uOpacity );
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    material.uniforms.uTime = this.time;
    const mesh = new THREE.InstancedMesh(card, material, o.spots.length);
    const m = new THREE.Matrix4();
    o.spots.forEach((s, i) => mesh.setMatrixAt(i, m.makeScale(s.radius * 2, 1, s.radius * 2).setPosition(s.x, o.y, s.z)));
    mesh.frustumCulled = false; mesh.name = 'foam'; mesh.renderOrder = 1;
    this.root.add(mesh);
    return mesh;
  }
}

export function seeded(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
