import * as THREE from 'three';
import { INK_ON, inkUniforms } from './ink';

const VERTEX = `
attribute vec2 aCorner;
attribute vec4 aDrop;
uniform float uRainTime;
uniform vec3 uBox;
uniform float uFall;
uniform vec2 uWind;
uniform float uLength;
uniform float uWidth;
uniform float uFloor;
uniform float uSway;
varying float vFade;
varying float vSide;
varying float vAlong;
void main() {
	vec3 fall = normalize( vec3( uWind.x, -uFall, uWind.y ) );
	// Down through the box, over and over, each drop at its own point in it.
	float cycle = fract( aDrop.y + uRainTime * uFall / uBox.y );
	vec3 head;
	head.y = uFloor + ( 1.0 - cycle ) * uBox.y;
	// Across: drifting with the wind, wrapped round wherever the lens is.
	vec2 at = aDrop.xz * uBox.xz + uWind * uRainTime;
	head.xz = cameraPosition.xz + mod( at - cameraPosition.xz + uBox.xz * .5, uBox.xz ) - uBox.xz * .5;
	// Flakes and leaves sway on the air as they come down.
	head.xz += vec2( sin( uRainTime * 1.3 + aDrop.z * 6.2832 ), cos( uRainTime * 1.05 + aDrop.w * 6.2832 ) ) * uSway;
	vec3 mid = head - fall * uLength * aCorner.y;
	vec3 toCam = normalize( cameraPosition - mid );
	vec3 side = normalize( cross( fall, toCam ) ) * uWidth;
	vec4 mv = viewMatrix * vec4( mid + side * aCorner.x, 1.0 );
	gl_Position = projectionMatrix * mv;
	float d = length( mv.xyz );
	vFade = smoothstep( 1.6, 4.0, d ) * ( 1.0 - smoothstep( uBox.x * .3, uBox.x * .48, d ) )
		* smoothstep( 0.0, .06, cycle ) * ( 1.0 - smoothstep( .94, 1.0, cycle ) ) * ( .55 + .45 * aDrop.w );
	vSide = aCorner.x;
	vAlong = aCorner.y;
}`;

const FRAGMENT = `
uniform vec3 uInkDark;
uniform vec3 uInkPaper;
uniform float uInkWeather;
uniform vec3 uRainColor;
uniform float uRainAlpha;
uniform float uRainFlash;
uniform float uRound;
varying float vFade;
varying float vSide;
varying float vAlong;
void main() {
	float across = 1.0 - vSide * vSide;
	// A flake: round and soft, not a streak.
	float shape = mix( across, max( 0.0, 1.0 - vSide * vSide - ( vAlong * 2.0 - 1.0 ) * ( vAlong * 2.0 - 1.0 ) ), uRound );
	float a = uRainAlpha * vFade * shape * ( 1.0 + uRainFlash * 2.5 );
	vec3 color = uRainColor * ( 1.0 + uRainFlash * 3.0 );
	// The inked page (rift/ink.ts): rain a pen stroke, half ink and half paper, so it reads over
	// the white ground and the black sky alike; a snowflake paper with an ink rim; ash ink.
	if ( uInkWeather > .5 ) {
		if ( uInkWeather < 1.5 ) { color = mix( uInkDark, uInkPaper, .42 + uRainFlash * .5 ); a = min( 1.0, a * 2.2 ); }
		else if ( uInkWeather < 2.5 ) {
			float rr = sqrt( vSide * vSide + ( vAlong * 2.0 - 1.0 ) * ( vAlong * 2.0 - 1.0 ) );
			color = mix( uInkPaper * 1.2, uInkDark, smoothstep( .45, .7, rr ) );
			a = uRainAlpha * vFade * ( 1.0 - smoothstep( .85, 1.0, rr ) );
		}
		else if ( uInkWeather < 3.5 ) color = uInkDark;
		// The Grove's leaves: dark, blood-soaked, not red confetti on the paper.
		else { color = mix( uInkDark, uRainColor, .38 ); a *= .8; }
	}
	if ( a < .004 ) discard;
	gl_FragColor = vec4( color, a );
}`;

export interface WeatherSpec { count: number; fall: number; wind: readonly [number, number]; length: number; width: number; color: readonly [number, number, number]; alpha: number; sway: number; round: boolean;
  ink?: number }
export const WEATHER = {
  rain: { count: 4200, fall: 17, wind: [3.2, 1.4], length: .95, width: .011, color: [.62, .68, .82], alpha: .3, sway: 0, round: false, ink: 1 },
  snow: { count: 3400, fall: 1.7, wind: [1, .45], length: .07, width: .05, color: [.95, .97, 1.05], alpha: .8, sway: .55, round: true, ink: 2 },
  ash: { count: 2800, fall: 1.1, wind: [.7, .35], length: .06, width: .045, color: [.62, .58, .56], alpha: .6, sway: .45, round: true, ink: 3 },
  leaves: { count: 1100, fall: 1.9, wind: [1.3, .55], length: .1, width: .07, color: [.62, .05, .04], alpha: .92, sway: 1.1, round: true, ink: 4 },
  drizzle: { count: 2600, fall: 11, wind: [1.6, .7], length: .45, width: .008, color: [.6, .66, .72], alpha: .2, sway: 0, round: false, ink: 1 },
} as const satisfies Record<string, WeatherSpec>;

export class Rain {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(time: { value: number }, spec: WeatherSpec = WEATHER.rain, floor = 0) {
    const count = spec.count;
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('aCorner', new THREE.Float32BufferAttribute([-1, 0, 1, 0, -1, 1, 1, 1], 2));
    quad.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    quad.setIndex([0, 2, 1, 1, 2, 3]);
    const drops = new Float32Array(count * 4);
    let seed = 0x5eed;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < count; i++) { drops[i * 4] = rnd(); drops[i * 4 + 1] = rnd(); drops[i * 4 + 2] = rnd(); drops[i * 4 + 3] = rnd(); }
    quad.setAttribute('aDrop', new THREE.InstancedBufferAttribute(drops, 4));
    quad.instanceCount = count;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uRainTime: time, uBox: { value: new THREE.Vector3(38, 24, 38) }, uFall: { value: spec.fall }, uWind: { value: new THREE.Vector2(...spec.wind) },
        uLength: { value: spec.length }, uWidth: { value: spec.width }, uFloor: { value: floor - 1 }, uSway: { value: spec.sway }, uRound: { value: spec.round ? 1 : 0 },
        uRainColor: { value: new THREE.Color(...spec.color) }, uRainAlpha: { value: spec.alpha }, uRainFlash: { value: 0 },
        uInkDark: inkUniforms.uInkDark, uInkPaper: inkUniforms.uInkPaper, uInkWeather: { value: INK_ON ? spec.ink ?? 0 : 0 },
      },
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(quad, this.material);
    this.mesh.name = 'rift-rain'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
  }

  set flash(value: number) { this.material.uniforms.uRainFlash.value = value; }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}
