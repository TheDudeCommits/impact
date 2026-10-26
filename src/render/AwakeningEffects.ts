import * as THREE from 'three';
import { AWAKENINGS, AWAKENING_ENTRY, awakeningSwapAt } from '../game/awakening';
import type { FighterId } from '../game/types';
import { SIGNATURE, involvesLocal } from './signature/context';
import type { CombatEvent } from '../game/types';
import type { Fighter } from './Fighter';
import { VfxKit } from './vfx/VfxKit';
import { SPRITE, ORIENT } from './vfx/SparkField';
import { AuraShell } from './vfx/AuraShell';
import { ArmamentCoat } from './vfx/ArmamentCoat';
import { GojoInfinity } from './signature/GojoInfinity';
import { IfritJambe, LimbFire, FLAME_EMPEROR } from './signature/IfritJambe';
import { Godspeed } from './signature/Godspeed';
import { AwakenedRoom } from './signature/AwakenedRoom';
import { PowerUp, boltFor, hakiStyle, kiColours, powerTint, reiatsuColours, type Burning, type PowerKind, type PowerStyle } from './vfx/sparking/PowerUp';
import { OWN_ENTRANCES } from '../game/powerUp';
import { PHYSICAL_PRESENCE, standingAura, standingColours } from './standingAura';
import { awakenedPower, shellLook } from './awakenedPower';

const auraOf = (fighter: Fighter): readonly [number, number] => typeof fighter.auraColours === 'function' ? fighter.auraColours() : AWAKENINGS[fighter.state.fighter].aura;
const isOwnLayer = (id: FighterId) => OWN_ENTRANCES.has(id);
const isLocal = (id: string) => SIGNATURE.localId !== undefined && id === SIGNATURE.localId;
const auraScale = (formScale?: number) => THREE.MathUtils.clamp(formScale ?? 1, 1, 1.5);
const powerKind = (id: FighterId): PowerKind => awakenedPower(id).kind;
const HAKI_DARK = 0x14020a;
const hdr = (hex: number) => { const c = new THREE.Color(hex); return c.multiplyScalar(2.2 / Math.max(c.r, c.g, c.b, 1e-3)); };

export class AwakeningEffects {
  private flameGeometry = new THREE.PlaneGeometry(1, 1);
  private flameMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    uniforms: { clock: { value: 0 } },
    vertexShader: `varying vec2 p;varying vec3 tint;varying float seed;
      void main(){p=uv;tint=instanceColor;seed=instanceMatrix[3].x*3.1+instanceMatrix[3].y*5.7+instanceMatrix[3].z*4.3;
      gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 p;varying vec3 tint;varying float seed;uniform float clock;
      void main(){
        float sway=sin(p.y*6.5-clock*7.0+seed)*.15*p.y+sin(p.y*15.0+clock*11.0+seed)*.04;
        float width=.36*pow(max(0.0,1.0-p.y),.55)*(1.0+.18*sin(p.y*19.0-clock*8.0+seed));
        float d=abs(p.x-.5-sway);
        float body=(1.0-smoothstep(width*.45,width,d))*smoothstep(0.0,.09,p.y)*(1.0-smoothstep(.72,1.0,p.y));
        float core=(1.0-smoothstep(0.0,width*.45,d))*body;
        // Additive light accumulates twice over: overlapping cards blow out into
        // a white column, and anything the sum pushes past the bloom threshold
        // throws a halo that bleaches whoever is standing behind the fighter.
        gl_FragColor=vec4(mix(tint,vec3(1.0,.97,.88),core*.4),body*.42);
      }`,
  });
  private flames = new THREE.InstancedMesh(this.flameGeometry, this.flameMaterial, 960);
  private ringGeometry = new THREE.RingGeometry(.9, 1, 64);
  private bursts = new Map<string, { ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; born: number }>();
  private spare: { ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] } = { ring: [] };
  private transform = new THREE.Object3D();
  private colour = new THREE.Color();
  private eye = new THREE.Vector3();
  private seen = new Set<number>();
  private kit: VfxKit;
  private up = new THREE.Vector3(0, 1, 0);
  private shell: AuraShell;
  private coat: ArmamentCoat;
  private power: PowerUp;
  private styles = new Map<Fighter, { key: number; style: PowerStyle }>();
  private infinity: GojoInfinity;
  private ifrit: IfritJambe;
  private emperor: LimbFire;
  private godspeed: Godspeed;
  private room: AwakenedRoom;
  private nextSpark = new Map<Fighter, number>();
  private chest = new THREE.Vector3();
  private entries = new Map<string, { born: number; fighter: FighterId; burst: boolean; next: number }>();
  private gatherAt = new THREE.Vector3();
  private cost = new Float32Array(120);
  private costAt = 0;
  get stats() { const sorted = Float32Array.from(this.cost).sort(); return { ms: sorted[sorted.length >> 1], worst: sorted[sorted.length - 1] }; }
  constructor(private scene: THREE.Scene) {
    this.kit = VfxKit.for(scene);
    this.shell = new AuraShell(scene); this.coat = new ArmamentCoat(scene);
    this.power = new PowerUp(scene, this.kit);
    this.infinity = new GojoInfinity(scene); this.ifrit = new IfritJambe(scene); this.emperor = new LimbFire(scene, FLAME_EMPEROR); this.godspeed = new Godspeed(scene); this.room = new AwakenedRoom(scene);
    this.flames.count = 0; this.flames.setColorAt(0, new THREE.Color(0xffffff));
    this.flames.frustumCulled = false; this.flames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flames.name = 'awakening-aura';
    scene.add(this.flames);
    if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __awakening?: AwakeningEffects }).__awakening = this;
  }

  private wash(colour: number, opacity: number, side: THREE.Side) {
    return new THREE.MeshBasicMaterial({ color: colour, toneMapped: false, transparent: true,
      opacity, depthWrite: false, side, forceSinglePass: true });
  }

  private ring() {
    const ring = this.spare.ring.pop()
      ?? new THREE.Mesh(this.ringGeometry, this.wash(0xffffff, .9, THREE.DoubleSide));
    ring.rotation.x = -Math.PI / 2; ring.visible = true; ring.name = 'awakening-shockwave';
    if (!ring.parent) this.scene.add(ring);
    return ring;
  }
  warmup() {
    this.spare.ring.push(this.ring());
    this.shell.warmup(); this.coat.warmup(); this.infinity.warmup(); this.ifrit.warmup(); this.emperor.warmup(); this.godspeed.warmup(); this.room.warmup();
  }
  hideWarmup() {
    for (const mesh of this.spare.ring) mesh.visible = false;
    this.shell.hideWarmup(); this.coat.hideWarmup(); this.infinity.hideWarmup(); this.ifrit.hideWarmup(); this.emperor.hideWarmup(); this.godspeed.hideWarmup(); this.room.hideWarmup();
  }

  handle(events: readonly CombatEvent[], fighters: ReadonlyMap<string, Fighter>) {
    this.infinity.handle(events, fighters);
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      if (event.kind !== 'awaken' || !event.fighter) continue;
      if (isOwnLayer(event.fighter)) {
        const own = fighters.get(event.actorId);
        if (own && powerKind(event.fighter) === 'haki') this.power.begin(own, event.serverTime, awakeningSwapAt(event.fighter), AWAKENING_ENTRY, this.styleOf(own), false, 1, isLocal(event.actorId), true);
        continue;
      }
      const entry = this.entries.get(event.actorId);
      if (entry) { entry.born = event.serverTime; entry.fighter = event.fighter; entry.burst = false; entry.next = 0; }
      else this.entries.set(event.actorId, { born: event.serverTime, fighter: event.fighter, burst: false, next: 0 });
      const actor = fighters.get(event.actorId);
      if (actor && involvesLocal(event.actorId)) SIGNATURE.screen?.techniqueGrade?.(this.entryColours(actor)[0], .45, awakeningSwapAt(event.fighter) + .25, actor.group.position, 3.2);
      if (actor) {
        const look = AWAKENINGS[event.fighter];
        this.power.begin(actor, event.serverTime, awakeningSwapAt(event.fighter), AWAKENING_ENTRY, this.styleOf(actor), !!look.flames, auraScale(look.formScale), isLocal(event.actorId));
      }
    }
  }

  private burst(id: string, fighter: FighterId, actor: Fighter, time: number) {
    const [core, rim] = this.entryColours(actor);
    const ring = this.ring();
    ring.material.color.set(core);
    ring.position.copy(actor.group.position).setY(actor.group.position.y + .06);
    const running = this.bursts.get(id);
    if (running) { running.ring.visible = false; this.spare.ring.push(running.ring); }
    this.bursts.set(id, { ring, born: time });
    this.arrival(actor.group.position, time, core, rim, powerKind(fighter));
    this.power.break(actor, time);
    if (involvesLocal(id)) {
      this.chest.copy(actor.group.position).y += 1.2;
      SIGNATURE.screen?.impactFrame?.(.8, this.chest);
      SIGNATURE.screen?.speedLines?.(1);
      SIGNATURE.screen?.chromaticPulse?.(.95);
    }
  }

  private gather(actor: Fighter, fighter: FighterId, time: number, u: number, density: number) {
    const [core, rim] = this.entryColours(actor), haki = powerKind(fighter) === 'haki';
    const p = actor.group.position, kit = this.kit, sp = kit.sparks.spec;
    this.gatherAt.set(p.x, p.y + 1.05, p.z);
    kit.lights.request(this.gatherAt.x, this.gatherAt.y, this.gatherAt.z, core, 1.5 + 5 * u, 3 + 2 * u, 1);
    const count = Math.max(1, Math.round((2 + 4 * u) * Math.max(.35, density)));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - .35) * 1.1, r = 1.3 + Math.random() * .7;
      const x = Math.cos(a) * Math.cos(e) * r, y = Math.sin(e) * r, z = Math.sin(a) * Math.cos(e) * r;
      const life = .16 + Math.random() * .08, k = .92 / life;
      sp.reset(SPRITE.streak, time, life).pos(this.gatherAt.x + x, this.gatherAt.y + y, this.gatherAt.z + z).velocity(-x * k, -y * k, -z * k);
      sp.orient = ORIENT.velocity; sp.sized(.035, .012, .4); sp.stretch = 4; sp.trail = .05; sp.drag = 0; sp.gravity = 0;
      sp.hot(i % 3 === 0 && !haki ? 0xffffff : core, 1.9).cool(rim, haki ? .7 : .2); kit.sparks.emit();
    }
  }

  private arrival(p: THREE.Vector3, time: number, core: number, rim: number, kind: PowerKind = 'plain') {
    const kit = this.kit, sp = kit.sparks.spec;
    if (kind === 'haki') {
      kit.ring(p.x, p.y + 1.1, p.z, .6, 6.5, time, .42, core, rim, .5);
      kit.streaks(p.x, p.y + .8, p.z, { spike: core, rim, light: core, ink: 0 }, kit.n(16, 6), 11, .03, time, this.up, 1.2, 2);
      kit.debris.burst(kit.n(14, 5), p.x, p.y, p.z, 0, 1, 0, 6.5, 1.15, .12, p.y, 2);
      kit.dustRing(p.x, p.y, p.z, 10, .5, 5.5, .6, time, .6);
      kit.pulse(p.x, p.y + 1.5, p.z, core, 2.2, 8, time, .45, 2.5);
      return;
    }
    if (kind === 'reiatsu' || kind === 'chakra' || kind === 'cursed' || kind === 'nen') {
      kit.ring(p.x, p.y + 1.1, p.z, .6, 6.5, time, .42, 0xffffff, core, .12);
      sp.reset(SPRITE.core, time, .09).pos(p.x, p.y + 1.1, p.z).sized(.7, 1.6, .3).hot(0xffffff, 2).cool(core); kit.sparks.emit();
      kit.streaks(p.x, p.y + .8, p.z, { spike: 0xffffff, rim: core, light: core, ink: 0 }, kit.n(20, 8), 11, .03, time, this.up, 1.2, 2);
      kit.debris.burst(kit.n(14, 5), p.x, p.y, p.z, 0, 1, 0, 6.5, 1.15, .12, p.y, 2);
      kit.dustRing(p.x, p.y, p.z, 10, .5, 5.5, .6, time, .6);
      kit.pulse(p.x, p.y + 1.5, p.z, core, 3, 9, time, .45, 2.5);
      return;
    }
    kit.ring(p.x, p.y + 1.1, p.z, .6, 6.5, time, .42, 0xffffff, core, .12);
    kit.ring(p.x, p.y + 1.1, p.z, .4, 4.2, time + .06, .38, core, rim, .08);
    sp.reset(SPRITE.core, time, .09).pos(p.x, p.y + 1.1, p.z).sized(.7, 1.6, .3).hot(0xffffff, 2.2).cool(core); kit.sparks.emit();
    sp.reset(SPRITE.glow, time, .38).pos(p.x, p.y + 5.4, p.z).sized(.7, 1.1, .3).hot(core, 1.2); sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.stretch = 4.2; kit.sparks.emit();
    sp.reset(SPRITE.glow, time, .26).pos(p.x, p.y + 5.4, p.z).sized(.2, .32, .3).hot(0xffffff, 1.6); sp.orient = ORIENT.axial; sp.axis(0, 1, 0); sp.stretch = 13; kit.sparks.emit();
    kit.streaks(p.x, p.y + .8, p.z, { spike: 0xffffff, rim: core, light: core, ink: 0 }, kit.n(20, 8), 11, .03, time, this.up, 1.2, 2);
    kit.debris.burst(kit.n(14, 5), p.x, p.y, p.z, 0, 1, 0, 6.5, 1.15, .12, p.y, 2);
    kit.dustRing(p.x, p.y, p.z, 10, .5, 5.5, .6, time, .6);
    kit.pulse(p.x, p.y + 1.5, p.z, core, 3.2, 9, time, .45, 2.5);
  }

  private styleOf(fighter: Fighter): PowerStyle {
    const forced = import.meta.env?.DEV ? (globalThis as unknown as { __auraColours?: readonly [number, number] }).__auraColours : undefined;
    const power = awakenedPower(fighter.state.fighter);
    const [core, rim] = forced ?? power.colours ?? auraOf(fighter), key = core * 0x1000000 + rim;
    let cached = this.styles.get(fighter);
    if (!cached || cached.key !== key) {
      cached = { key, style: { kind: power.kind, colours: power.kind === 'reiatsu' || power.kind === 'cursed' ? reiatsuColours(core, rim) : kiColours(core, rim),
        bolt: power.arcs === undefined ? boltFor(core) : hdr(power.arcs), electric: !!power.electric, arcs: power.arcs !== undefined,
        haki: power.kind === 'haki' ? hakiStyle(power.edge, !!power.conqueror) : undefined,
        motes: power.motes ? { kind: power.motes[0], core: power.motes[1], rim: power.motes[2] } : undefined, ...powerTint(core, rim) } };
      this.styles.set(fighter, cached);
    }
    return cached.style;
  }
  private burn: Burning = { style: undefined as unknown as PowerStyle, scale: 1, strength: 0, local: false };
  private entry: [number, number] = [0, 0];
  private entryColours(fighter: Fighter): readonly [number, number] {
    const style = this.styleOf(fighter);
    if (style.haki) { this.entry[0] = style.haki.hex; this.entry[1] = HAKI_DARK; return this.entry; }
    if (!awakenedPower(fighter.state.fighter).colours) return auraOf(fighter);
    this.entry[0] = style.tint ?? 0xffffff; this.entry[1] = style.shade ?? 0;
    return this.entry;
  }

  private burning(fighter: Fighter, time: number) {
    const state = fighter.state;
    if (!state.awakened || !state.alive) return null;
    const look = AWAKENINGS[state.fighter], power = awakenedPower(state.fighter), kind = power.kind;
    if (!power.motes && power.arcs === undefined && (kind === 'plain' || (kind === 'ki' && standingAura(state.fighter) === undefined) || (kind !== 'haki' && isOwnLayer(state.fighter)))) return null;
    if ((kind === 'chakra' || kind === 'cursed' || kind === 'nen' || kind === 'reiatsu') && !power.shell && !power.motes && power.arcs === undefined) return null;
    const burn = this.burn;
    burn.style = this.styleOf(fighter); burn.scale = auraScale(look.formScale); burn.strength = THREE.MathUtils.clamp((state.awakenedUntil ?? 0) - time, 0, 1); burn.local = isLocal(state.id);
    return burn;
  }

  update(time: number, _dt: number, fighters: ReadonlyMap<string, Fighter>, density: number, camera?: THREE.Camera) {
    const started = performance.now();
    let count = 0;
    for (const [id, entry] of this.entries) {
      const actor = fighters.get(id);
      const swap = awakeningSwapAt(entry.fighter);
      const inEntry = actor?.state.action === 'awaken';
      const elapsed = actor && inEntry ? actor.state.actionTime * actor.state.actionDuration : time - entry.born;
      if (!actor || elapsed > AWAKENING_ENTRY + .3 || elapsed < -.5) { if (!actor || time - entry.born > 3) this.entries.delete(id); if (actor && !inEntry) this.entries.delete(id); continue; }
      if (!entry.burst && elapsed >= swap) { entry.burst = true; this.burst(id, entry.fighter, actor, time); }
      else if (!entry.burst && time >= entry.next) { entry.next = time + .025; this.gather(actor, entry.fighter, time, THREE.MathUtils.clamp(elapsed / swap, 0, 1), density); }
    }
    this.flameMaterial.uniforms.clock.value = time;
    const eye = camera ? camera.getWorldPosition(this.eye) : undefined;
    const budget = Math.round(960 * Math.max(.3, density));
    this.shell.begin(); this.coat.begin();
    for (const fighter of fighters.values()) {
      const state = fighter.state;
      if (!state.awakened || !state.alive) continue;
      const def = AWAKENINGS[state.fighter], aura = standingColours(state.fighter, auraOf(fighter));
      const left = (state.awakenedUntil ?? 0) - time;
      const strength = THREE.MathUtils.clamp(left, 0, 1) * Math.max(.35, density);
      const base = fighter.group.position;
      if (PHYSICAL_PRESENCE.has(state.fighter)) {
        if (state.grounded !== false && left > 0 && time >= (this.nextSpark.get(fighter) ?? 0)) {
          this.nextSpark.set(fighter, time + .28);
          this.kit.dustRing(base.x, base.y, base.z, 6, .38, 1.5, .42, time, .7);
        }
        continue;
      }
      const power = awakenedPower(state.fighter), glow = standingAura(state.fighter), worn = power.shell;
      const gathering = state.action === 'awaken' && state.actionTime * state.actionDuration < awakeningSwapAt(state.fighter);
      if (power.coat && !gathering) {
        const since = state.action === 'awaken' ? state.actionTime * state.actionDuration - awakeningSwapAt(state.fighter) : 1;
        this.coat.draw(fighter, time, THREE.MathUtils.clamp(left, 0, 1) * THREE.MathUtils.clamp(since / .18, 0, 1), power.coat, this.styleOf(fighter).haki?.glow ?? this.colour.set(aura[1]));
      }
      if (glow === undefined || !worn) continue;
      const fade = (def.flames && def.auraGlow === undefined) || !eye || (state.action !== 'ultimate' && state.action !== 'awaken') ? 1
        : THREE.MathUtils.smoothstep(eye.distanceTo(this.chest.set(base.x, base.y + 1.2, base.z)), 2.4, 4.2);
      const near = state.action === 'awaken' ? .2 + .8 * fade : fade;
      this.shell.draw(fighter, time, Math.min(1, strength * 1.2) * (gathering ? .3 : 1) * near, aura[0], aura[1], shellLook(state.fighter));
      this.chest.set(base.x, base.y + 2.6, base.z);
      if (glow > 0) this.kit.lights.request(this.chest.x, this.chest.y, this.chest.z, worn === 'flame' ? aura[0] : this.styleOf(fighter).tint ?? aura[0], 5 * strength * glow, 6, 1);
      if (worn !== 'flame') continue;
      const kind = powerKind(state.fighter);
      if (time >= (this.nextSpark.get(fighter) ?? 0)) {
        this.nextSpark.set(fighter, time + .05 / Math.max(.4, density));
        const sp = this.kit.sparks.spec, a = Math.random() * Math.PI * 2, r = .25 + Math.random() * .2;
        sp.reset(SPRITE.streak, time, .35 + Math.random() * .25).pos(base.x + Math.cos(a) * r, base.y + .2 + Math.random() * 1.5, base.z + Math.sin(a) * r).velocity(Math.cos(a) * .4, 3 + Math.random() * 2.5, Math.sin(a) * .4);
        sp.orient = ORIENT.velocity; sp.sized(.03, .015, .5); sp.stretch = 3; sp.trail = .04; sp.drag = 1.2; sp.gravity = -2; sp.hot(0xffffff, 1.8).cool(aura[1], 0); this.kit.sparks.emit();
      }
      if (kind !== 'plain') continue;
      const facing = eye ? Math.atan2(eye.x - base.x, eye.z - base.z) : 0;
      const head = fighter.drawnJoint?.('Head') ?? fighter.joints?.get('Head');
      if (head) head.getWorldPosition(this.chest); else this.chest.set(base.x, base.y + 1.65, base.z);
      const tongues = Math.round(6 * Math.max(.5, density));
      for (let i = 0; i < tongues && count < budget; i++) {
        const phase = (time * (1.7 + (i % 3) * .35) + i * .618) % 1;
        const angle = i * 2.399963 + time * .8;
        const radius = .13 * (1 - phase * .3);
        const height = .38 * Math.sin(phase * Math.PI) * strength;
        this.transform.position.set(this.chest.x + Math.cos(angle) * radius, this.chest.y + .12 + phase * .35 + height * .5, this.chest.z + Math.sin(angle) * radius);
        this.transform.rotation.set(0, facing, 0);
        this.transform.scale.set(height * .7, height, 1);
        this.transform.updateMatrix();
        this.flames.setMatrixAt(count, this.transform.matrix);
        this.flames.setColorAt(count++, this.colour.set(i % 3 === 0 ? 0xfff2cf : aura[i % 3 === 1 ? 0 : 1]));
      }
    }
    this.shell.end(fighters); this.coat.end(fighters);
    this.power.update(time, _dt, fighters, camera, density, fighter => this.burning(fighter, time));
    this.infinity.update(time, _dt, fighters, density, camera);
    count = this.ifrit.update(time, _dt, fighters, density, this.flames, count, budget, eye);
    count = this.emperor.update(time, _dt, fighters, density, this.flames, count, budget, eye);
    this.godspeed.update(time, fighters, density, _dt);
    this.room.update(time, _dt, fighters, density);
    this.flames.count = count;
    this.flames.instanceMatrix.needsUpdate = true;
    if (this.flames.instanceColor) this.flames.instanceColor.needsUpdate = true;
    for (const [id, burst] of this.bursts) {
      const age = time - burst.born;
      if (age > .85 || age < -.5) { burst.ring.visible = false; this.spare.ring.push(burst.ring); this.bursts.delete(id); continue; }
      const actor = fighters.get(id);
      if (actor) burst.ring.position.set(actor.group.position.x, actor.group.position.y + .06, actor.group.position.z);
      burst.ring.scale.setScalar(.8 + age * 8);
      burst.ring.material.opacity = Math.max(0, .9 - age / .85);
    }
    this.cost[this.costAt] = performance.now() - started; this.costAt = (this.costAt + 1) % this.cost.length;
  }

  reset() {
    for (const burst of this.bursts.values()) { burst.ring.visible = false; this.spare.ring.push(burst.ring); }
    this.bursts.clear(); this.entries.clear();
    this.flames.count = 0;
    this.seen.clear();
    this.shell.reset(); this.coat.reset(); this.power.reset(); this.styles.clear(); this.nextSpark.clear(); this.infinity.reset(); this.ifrit.reset(); this.emperor.reset(); this.godspeed.reset(); this.room.reset();
  }

  dispose() {
    this.reset();
    for (const mesh of this.spare.ring) { mesh.removeFromParent(); mesh.material.dispose(); }
    this.spare = { ring: [] };
    this.flames.removeFromParent(); this.flames.dispose();
    this.flameGeometry.dispose(); this.flameMaterial.dispose();
    this.ringGeometry.dispose();
    this.shell.dispose(); this.coat.dispose(); this.power.dispose(); this.infinity.dispose(); this.ifrit.dispose(); this.emperor.dispose(); this.godspeed.dispose(); this.room.dispose();
    this.kit.release();
  }
}
