import * as THREE from 'three';
import { VfxKit } from '../vfx/VfxKit';
import { PATH_INFO, type PathKind } from '../../survival/paths';
import type { FeedItem } from '../../survival/SurvivalGame';
import { INK_ON } from '../rift/ink';


const DISC_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const DISC_FRAGMENT = `
uniform vec3 uColor; uniform float uTime; uniform float uAlpha; uniform float uSeed;
varying vec2 vUv;
float h( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float n( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f ); return mix( mix( h( i ), h( i + vec2( 1, 0 ) ), f.x ), mix( h( i + vec2( 0, 1 ) ), h( i + vec2( 1, 1 ) ), f.x ), f.y ); }
void main() {
	vec2 p = vUv * 2.0 - 1.0; p.y *= .72;
	float r = length( p ), a = atan( p.y, p.x );
	if ( r > 1.0 ) discard;
	float swirl = n( vec2( a * 2.0 + r * 5.0 - uTime * 2.2, r * 3.0 - uTime ) + uSeed ) * .6 + n( vec2( a * 5.0 - uTime * 3.0, r * 8.0 ) + uSeed ) * .4;
	float core = 1.0 - smoothstep( .0, .55, r );
	float rim = smoothstep( .8, .98, r ) * ( 1.0 - smoothstep( .98, 1.0, r ) );
	vec3 col = mix( vec3( .02, .01, .03 ), uColor * 1.6, smoothstep( .35, .9, swirl ) * ( .35 + r * .8 ) ) + uColor * rim * 2.4 + vec3( 1.0 ) * core * core * .35;
	gl_FragColor = vec4( col, ( .9 - core * .25 ) * uAlpha );
}`;
const GROUND_FRAGMENT = `
uniform vec3 uColor; uniform float uTime; uniform float uAlpha;
varying vec2 vUv;
void main() {
	vec2 p = vUv * 2.0 - 1.0; float r = length( p ), a = atan( p.y, p.x );
	if ( r > 1.0 ) discard;
	float ring = 1.0 - smoothstep( 0.0, .05, abs( r - .9 ) );
	float runes = step( .5, fract( a / 6.2831853 * 12.0 + uTime * .3 ) ) * step( .74, r ) * step( r, .84 );
	float glow = ( 1.0 - r ) * .35;
	gl_FragColor = vec4( uColor * 1.8, ( ring + runes * .6 + glow ) * uAlpha );
}`;

interface Slot { group: THREE.Group; disc: THREE.Mesh; ground: THREE.Mesh; du: Record<string, THREE.IUniform>; gu: Record<string, THREE.IUniform>; kind?: PathKind; born: number; next: number }

export class ForkFx {
  private slots: Slot[] = [];
  private kit: VfxKit;
  constructor(scene: THREE.Scene) {
    this.kit = VfxKit.for(scene);
    const discGeometry = new THREE.PlaneGeometry(2.4, 3.3), groundGeometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const du = { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 0 }, uSeed: { value: i * 5.3 } };
      const gu = { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uAlpha: { value: 0 } };
      const disc = new THREE.Mesh(discGeometry, new THREE.ShaderMaterial({ uniforms: du, vertexShader: DISC_VERTEX, fragmentShader: DISC_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      const ground = new THREE.Mesh(groundGeometry, new THREE.ShaderMaterial({ uniforms: gu, vertexShader: DISC_VERTEX, fragmentShader: GROUND_FRAGMENT, transparent: true, depthWrite: false,
        blending: INK_ON ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
      disc.position.y = 1.85; ground.position.y = .04; ground.scale.setScalar(1.9);
      const group = new THREE.Group(); group.name = 'survival-fork'; group.visible = false;
      group.add(disc, ground);
      for (const mesh of [disc, ground]) mesh.frustumCulled = false;
      scene.add(group);
      this.slots.push({ group, disc, ground, du, gu, born: -1, next: 0 });
    }
  }

  update(forks: readonly { kind: PathKind; x: number; z: number }[] | undefined, time: number, camera: THREE.Camera) {
    this.slots.forEach((slot, i) => {
      const fork = forks?.[i];
      if (!fork) { slot.group.visible = false; slot.kind = undefined; return; }
      if (slot.kind !== fork.kind) {
        slot.kind = fork.kind; slot.born = time;
        const color = PATH_INFO[fork.kind].color;
        (slot.du.uColor.value as THREE.Color).setHex(color); (slot.gu.uColor.value as THREE.Color).setHex(color);
        this.kit.ring(fork.x, .06, fork.z, .3, 4.5, time, .5, 0xffffff, color, .15, 'flat');
        this.kit.pulse(fork.x, 1.8, fork.z, color, 12, 10, time, .6, 2);
      }
      slot.group.visible = true;
      slot.group.position.set(fork.x, 0, fork.z);
      slot.disc.rotation.y = Math.atan2(camera.position.x - fork.x, camera.position.z - fork.z);
      const grow = Math.min(1, (time - slot.born) / .45);
      slot.disc.scale.setScalar(.2 + grow * .8);
      slot.du.uAlpha.value = grow; slot.gu.uAlpha.value = grow * .9;
      slot.du.uTime.value = slot.gu.uTime.value = time;
      if (time >= slot.next) {
        slot.next = time + .12;
        const color = PATH_INFO[fork.kind].color, a = Math.random() * Math.PI * 2;
        this.kit.smoke(fork.x + Math.cos(a) * 1.1, .3, fork.z + Math.sin(a) * 1.1, -Math.cos(a) * .6, 1.2 + Math.random(), -Math.sin(a) * .6, .35, time, .7, color, 0x06030a);
        if (Math.random() < .25) this.kit.pulse(fork.x, 2, fork.z, color, 6, 7, time, .25, 1);
      }
    });
  }

  feed(item: FeedItem, time: number) {
    if (item.kind !== 'path' || item.x === undefined || item.z === undefined) return;
    const color = PATH_INFO[item.text as PathKind]?.color ?? 0xffffff, k = this.kit;
    k.ring(item.x, .08, item.z, .4, 9, time, .6, 0xffffff, color, .25, 'flat');
    k.ring(item.x, 1.8, item.z, .3, 5, time, .45, 0xffffff, color, .12);
    k.pulse(item.x, 2, item.z, color, 22, 14, time, .8, 3);
  }

  reset() { for (const slot of this.slots) { slot.group.visible = false; slot.kind = undefined; } }
}
