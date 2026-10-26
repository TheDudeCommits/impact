import * as THREE from 'three';
import { INK_ON } from '../rift/ink';


export interface GlowSubject {
  id: string;
  colour: number;
  strength: number;
  ring: boolean;
  down: boolean;
}

const HULL_VERTEX = `
#include <common>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
uniform float uWidth;
uniform vec2 uViewport;
void main() {
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	// Out along the normal as the screen sees it, a constant number of pixels.
	// (A back-side material has its normal flipped for it: turned back out.)
	vec3 outward = normalize( transformedNormal );
	#ifdef FLIP_SIDED
		outward = -outward;
	#endif
	vec2 n = ( projectionMatrix * vec4( outward, 0.0 ) ).xy;
	float len = length( n );
	if ( len > 1e-4 ) gl_Position.xy += n / len * uWidth * 2.0 / uViewport * gl_Position.w;
}`;
const HULL_FRAGMENT = `
uniform vec3 uColour;
uniform float uAlpha;
void main() { gl_FragColor = vec4( uColour, uAlpha ); }`;

const RING_VERTEX = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
const RING_FRAGMENT = `
uniform vec3 uColour; uniform float uAlpha; uniform float uTime;
varying vec2 vUv;
void main() {
	vec2 p = vUv * 2.0 - 1.0; float r = length( p ), a = atan( p.y, p.x );
	if ( r > 1.0 ) discard;
	float aa = fwidth( r ) * 1.5;
	float band = smoothstep( .78 - aa, .78, r ) * ( 1.0 - smoothstep( .9, .9 + aa, r ) );
	float ink = smoothstep( .72 - aa, .72, r ) * ( 1.0 - smoothstep( .96, .96 + aa, r ) );
	float ticks = step( .82, fract( ( a + uTime * .8 ) / 6.2831853 * 4.0 ) );
	float alpha = max( band, ink * .7 ) * uAlpha * ( .8 + .2 * ticks );
	if ( alpha < .01 ) discard;
	gl_FragColor = vec4( mix( vec3( .02 ), uColour, band ), alpha );
}`;

const PILLAR_FRAGMENT = `
uniform vec3 uColour; uniform float uAlpha; uniform float uTime;
varying vec2 vUv;
void main() {
	float side = 1.0 - abs( vUv.x * 2.0 - 1.0 );
	float up = 1.0 - vUv.y;
	float beat = .75 + .25 * sin( uTime * 6.0 );
	float alpha = pow( side, 2.2 ) * up * up * uAlpha * beat;
	if ( alpha < .005 ) discard;
	gl_FragColor = vec4( uColour * ( 1.0 + side ), alpha );
}`;

const SKIP = /aura|effect|fx|shadow|outline|glow|trail|smoke|flame|wing_fx/i;

interface Built { hulls: THREE.Mesh[]; material: THREE.ShaderMaterial }

export class HeroGlow {
  private readonly built = new Map<string, Built>();
  private readonly framed = new WeakSet<THREE.Object3D>();
  private readonly viewport = new THREE.Vector2(1920, 1080);
  private readonly rings: { mesh: THREE.Mesh; uniforms: { uColour: { value: THREE.Color }; uAlpha: { value: number }; uTime: { value: number } } }[] = [];
  private readonly pillars: { mesh: THREE.Mesh; uniforms: { uColour: { value: THREE.Color }; uAlpha: { value: number }; uTime: { value: number } } }[] = [];
  private nextLook = 0;

  constructor(private readonly scene: THREE.Scene) {
    const plane = new THREE.PlaneGeometry(2, 2); plane.rotateX(-Math.PI / 2);
    const column = new THREE.CylinderGeometry(.55, .55, 14, 20, 1, true); column.translate(0, 7, 0);
    for (let i = 0; i < 3; i++) {
      const ring = { uColour: { value: new THREE.Color() }, uAlpha: { value: 0 }, uTime: { value: 0 } };
      const mesh = new THREE.Mesh(plane, new THREE.ShaderMaterial({ uniforms: ring, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT,
        transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
      mesh.renderOrder = 9; mesh.frustumCulled = false; mesh.visible = false; mesh.name = `survival-ally-ring-${i}`;
      scene.add(mesh); this.rings.push({ mesh, uniforms: ring });
      const pillar = { uColour: { value: new THREE.Color() }, uAlpha: { value: 0 }, uTime: { value: 0 } };
      const beam = new THREE.Mesh(column, new THREE.ShaderMaterial({ uniforms: pillar, vertexShader: RING_VERTEX, fragmentShader: PILLAR_FRAGMENT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
      beam.renderOrder = 8; beam.frustumCulled = false; beam.visible = false; beam.name = `survival-down-pillar-${i}`;
      scene.add(beam); this.pillars.push({ mesh: beam, uniforms: pillar });
    }
  }

  resize(width: number, height: number) { this.viewport.set(Math.max(1, width), Math.max(1, height)); }

  update(subjects: readonly GlowSubject[], time: number, dt: number) {
    const wanted = new Set(subjects.map(s => s.id));
    const look = time >= this.nextLook;
    if (look) this.nextLook = time + .5;
    let ring = 0, pillar = 0;
    const px = Math.max(1.6, Math.min(4, this.viewport.y / 1080 * 2.6));
    for (const subject of subjects) {
      let built = this.built.get(subject.id);
      if (!built) {
        const material = new THREE.ShaderMaterial({ uniforms: { uColour: { value: new THREE.Color() }, uAlpha: { value: 0 }, uWidth: { value: px }, uViewport: { value: this.viewport } },
          vertexShader: HULL_VERTEX, fragmentShader: HULL_FRAGMENT, side: THREE.BackSide, transparent: true, depthWrite: false, toneMapped: false, fog: false });
        built = { hulls: [], material }; this.built.set(subject.id, built);
      }
      if (look) this.frame(subject.id, built);
      const u = built.material.uniforms;
      const pulse = subject.down ? .55 + .45 * Math.sin(time * 7) : 1;
      const keyline = INK_ON && !subject.down;
      (u.uColour.value as THREE.Color).setHex(keyline ? 0xfffaf0 : subject.colour).multiplyScalar(keyline ? .7 : (1.4 + subject.strength * 1.6) * pulse);
      u.uAlpha.value = Math.min(1, Math.max(0, u.uAlpha.value + (subject.strength > 0 ? dt * 3 : -dt * 3)) );
      u.uWidth.value = px * (subject.down ? 1.3 : keyline ? .7 : 1);
      for (const hull of built.hulls) hull.visible = u.uAlpha.value > .01;
      const body = this.body(subject.id);
      if (!body) continue;
      if (subject.ring && ring < this.rings.length) {
        const r = this.rings[ring++];
        r.mesh.visible = true; r.mesh.position.set(body.x, Math.max(0, body.y) + .06, body.z);
        r.uniforms.uColour.value.setHex(subject.down ? 0xff2a3a : subject.colour).multiplyScalar(1.6);
        r.uniforms.uAlpha.value = subject.down ? .95 : .8; r.uniforms.uTime.value = time;
        r.mesh.scale.setScalar(subject.down ? 1.25 + .1 * Math.sin(time * 6) : .95);
      }
      if (subject.down && pillar < this.pillars.length) {
        const p = this.pillars[pillar++];
        p.mesh.visible = true; p.mesh.position.set(body.x, Math.max(0, body.y), body.z);
        p.uniforms.uColour.value.setHex(0xff2a3a).multiplyScalar(1.4); p.uniforms.uAlpha.value = .55; p.uniforms.uTime.value = time;
      }
    }
    for (let i = ring; i < this.rings.length; i++) this.rings[i].mesh.visible = false;
    for (let i = pillar; i < this.pillars.length; i++) this.pillars[i].mesh.visible = false;
    for (const [id, built] of this.built) if (!wanted.has(id)) this.drop(id, built);
  }

  private readonly wheres = new Map<string, THREE.Vector3>();
  where(id: string) {
    const at = this.body(id);
    if (!at) return undefined;
    let v = this.wheres.get(id);
    if (!v) { v = new THREE.Vector3(); this.wheres.set(id, v); }
    return v.copy(at);
  }

  private readonly bodyAt = new THREE.Vector3();
  private body(id: string) {
    const group = this.scene.getObjectByName(`fighter-${id}`);
    if (!group || !group.visible) return undefined;
    return group.getWorldPosition(this.bodyAt);
  }

  private frame(id: string, built: Built) {
    const name = `fighter-${id}`;
    for (const group of this.scene.getObjectsByProperty('name', name)) {
      group.traverse(node => {
        const mesh = node as THREE.Mesh;
        if (!mesh.isMesh || this.framed.has(mesh) || mesh.userData.glowHull) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (materials.some(m => m.transparent || m.alphaTest > 0 || !m.visible) || SKIP.test(mesh.name) || !mesh.geometry.getAttribute('normal')) return;
        this.framed.add(mesh);
        const skinned = mesh as THREE.SkinnedMesh;
        let hull: THREE.Mesh;
        if (skinned.isSkinnedMesh) {
          const shell = new THREE.SkinnedMesh(mesh.geometry, built.material);
          shell.bindMode = skinned.bindMode; shell.bind(skinned.skeleton, skinned.bindMatrix);
          hull = shell;
        } else hull = new THREE.Mesh(mesh.geometry, built.material);
        if (mesh.morphTargetInfluences) { hull.morphTargetInfluences = mesh.morphTargetInfluences; hull.morphTargetDictionary = mesh.morphTargetDictionary; }
        hull.userData.glowHull = true; hull.name = 'survival-frame';
        hull.frustumCulled = false; hull.castShadow = false; hull.receiveShadow = false;
        hull.renderOrder = mesh.renderOrder + 1;
        mesh.add(hull);
        built.hulls.push(hull);
      });
    }
    built.hulls = built.hulls.filter(hull => { if (hull.parent && hull.parent.parent) return true; hull.removeFromParent(); return false; });
  }

  private drop(id: string, built: Built) {
    for (const hull of built.hulls) hull.removeFromParent();
    built.material.dispose();
    this.built.delete(id);
  }

  clear() {
    for (const [id, built] of this.built) this.drop(id, built);
    for (const r of this.rings) r.mesh.visible = false;
    for (const p of this.pillars) p.mesh.visible = false;
  }

  dispose() {
    this.clear();
    for (const r of this.rings) { r.mesh.removeFromParent(); (r.mesh.material as THREE.Material).dispose(); }
    for (const p of this.pillars) { p.mesh.removeFromParent(); (p.mesh.material as THREE.Material).dispose(); }
    this.rings[0]?.mesh.geometry.dispose(); this.pillars[0]?.mesh.geometry.dispose();
  }
}
