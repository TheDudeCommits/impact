import * as THREE from 'three';
import type {CombatEvent} from '../game/types';
import type {Fighter} from './Fighter';
import {MOVES} from '../game/moves';
import {comboMove,COMBO_KEYS,type ComboKey} from '../game/combos';
import type {MoveDefinition} from '../game/moves';
const ENDER_MOVES:(MoveDefinition|null|undefined)[]=[];
function enderMove(key:ComboKey,awakened:boolean){const i=COMBO_KEYS.indexOf(key)*2+(awakened?1:0);let move=ENDER_MOVES[i];if(move===undefined){move=comboMove('law',key,awakened)??null;ENDER_MOVES[i]=move;}return move??undefined;}
import {WHIFF_CLEAR} from './signature/ultimateClock';
import {ElectricKit} from './signature/ElectricKit';
import {struckBody} from './signature/struck';
import {GLOW,RING,STAR} from './signature/GlowBatch';
import {slashWaveMaterial,applySlashStyle,ENERGY,type SlashStyle} from './signature/SlashWave';
import {SHAMBLES,cubeAt} from './law/shambles';

const ROOMS = 4;
const FLASHES = 4;
const OPEN = .35;
const FADE = .45;
const SHOCK = .42;

interface Room { mesh: THREE.Mesh; material: THREE.ShaderMaterial; actorId: string; since: number; until: number; radius: number; active: boolean; pulse: boolean; ultimate?: boolean;
  anchored: boolean; anchor: THREE.Vector3; opens: number; closeAt: number; toward: string; ward: number }
interface Swap { key: number; from: THREE.Vector3; yaw: number; swapped: boolean; done: boolean }
interface Cube { group: THREE.Group; since: number; yaw: number; at: THREE.Vector3; active: boolean; spin: number }
interface Flash { since: number; seed: number; active: boolean; position: THREE.Vector3; actorId: string; targetId: string }
interface Knife { mesh: THREE.Group; material: THREE.MeshBasicMaterial; reach: number; at: number }
const KNIFE_HELD = .5, KNIFE_RUN = .08;

const ROOM_RADIUS = { special: 3.6, ultimate: SHAMBLES.room, awaken: 4.6 } as const;
const ROOM_LIGHT = new THREE.Color(.5, 1.55, 2.4), ROOM_EDGE = new THREE.Color(.7, 2.1, 2.9), ROOM_FILL = new THREE.Color(.25, .75, 1.2);
const CUBES = 2, POP = .24;
const SHOCK_COLOR = { glow: new THREE.Color(.55, .85, 2.4), light: new THREE.Color(.6, .85, 1.7) };
const KIKOKU: SlashStyle = { mode: ENERGY, edge: new THREE.Color(1.7, 2.6, 3.2), body: new THREE.Color(.22, .75, 1.5), glow: new THREE.Color(.08, .45, 1.0) };
const CUTS = 4, CUT_SECONDS = .2;
const GAMMA = { blade: new THREE.Color(2.1, 1.9, .55), glow: new THREE.Color(1.2, 1.05, .25), light: new THREE.Color(1.3, 1.15, .45) };
const HEART = new THREE.Color(2.6, .25, .3);
function bodyCenterOf(body: Fighter, out: THREE.Vector3) { const hips = body.joints.get('Hips'); return hips ? hips.getWorldPosition(out) : out.copy(body.group.position).setY(body.group.position.y + 1.05); }

export class LawEffects {
  private sphere = new THREE.SphereGeometry(1, 40, 24);
  private kit: ElectricKit;
  private rooms: Room[] = [];
  private flashes: Flash[] = [];
  private seen = new Set<number>();
  private origin = new THREE.Vector3();
  private hand = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private tip = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private knives = new Map<string,Knife>();
  private knifeGeometry = new THREE.ConeGeometry(.085,.7,4);
  private knifeQuaternion = new THREE.Quaternion();
  private cutGeometry = new THREE.PlaneGeometry(1, 1);
  private cuts: {mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>; since: number; active: boolean}[] = [];
  private lastCut = new Map<string, number>();
  private time = 0;
  private heartGeometry = new THREE.BoxGeometry(.2, .2, .2);
  private heartMaterial = new THREE.MeshBasicMaterial({color: new THREE.Color(.55, 1.3, 2.2), transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
  private hearts: {cube: THREE.Mesh; owner: string; since: number; from: THREE.Vector3; to: THREE.Vector3}[] = [];
  private swaps = new Map<string, Swap>();
  private cubes: Cube[] = [];
  private cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  private cubeEdges = new THREE.EdgesGeometry(this.cubeGeometry);
  private cubeFill = new THREE.MeshBasicMaterial({color: ROOM_FILL, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
  private cubeLine = new THREE.LineBasicMaterial({color: ROOM_EDGE, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false});
  private hidden = new Map<string, Fighter>();
  private hideNow = new Set<string>();
  private pops = Array.from({length: 4}, () => ({at: new THREE.Vector3(), since: -9, seed: 0}));
  private c = new THREE.Vector3();
  private d = new THREE.Vector3();

  constructor(private scene: THREE.Scene) {
    this.kit = new ElectricKit(scene, 'counter-shock-bolts', 1200);
    for (let i = 0; i < CUTS; i++) {
      const mesh = new THREE.Mesh(this.cutGeometry, slashWaveMaterial()); mesh.name = 'kikoku-cut'; mesh.frustumCulled = false; mesh.renderOrder = 4;
      applySlashStyle(mesh.material, KIKOKU, i * 11, 1.2, .16); mesh.scale.setScalar(.001); mesh.position.set(0, -50, 0); scene.add(mesh);
      const cut = {mesh, since: 0, active: false}; mesh.onAfterRender = () => { if (!cut.active) mesh.visible = false; }; this.cuts.push(cut);
    }
    for (let i = 0; i < ROOMS; i++) {
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        uniforms: {uTime: {value: 0}, uOpacity: {value: 0}, uColour: {value: new THREE.Color(0x7fe0ff)}, uFloor: {value: -2}, uBand: {value: 0}},
        vertexShader: 'varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;void main(){vLocal=position;vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}',
        fragmentShader: `varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;uniform float uTime;uniform float uOpacity;uniform vec3 uColour;uniform float uFloor;uniform float uBand;
          void main(){float facing=abs(dot(normalize(vNormal),normalize(vView)));float rim=pow(1.0-facing,2.2);
          float lines=smoothstep(.92,1.0,sin(vLocal.y*14.0-uTime*1.8))*.35;
          float d=vLocal.y-uFloor;float foot=uBand*step(-.005,d)*(exp(-d*55.0)*.95+(1.0-smoothstep(0.0,.12,d))*.4);
          float alpha=(.10+rim*.55+lines+foot)*uOpacity;
          gl_FragColor=vec4(mix(uColour,vec3(1.0),rim*.6+lines+foot*.5)*(1.0+rim*1.4+foot*1.2),alpha);}`,
      });
      const mesh = new THREE.Mesh(this.sphere, material); mesh.name = `law-room-${i}`; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3;
      scene.add(mesh);
      this.rooms.push({mesh, material, actorId: '', since: 0, until: 0, radius: 1, active: false, pulse: false,
        anchored: false, anchor: new THREE.Vector3(), opens: OPEN, closeAt: NaN, toward: '', ward: 0});
    }
    for (let i = 0; i < CUBES; i++) {
      const group = new THREE.Group(); group.name = 'law-shambles-cube'; group.visible = false; group.renderOrder = 4;
      const fill = new THREE.Mesh(this.cubeGeometry, this.cubeFill), edges = new THREE.LineSegments(this.cubeEdges, this.cubeLine);
      fill.frustumCulled = edges.frustumCulled = false; fill.renderOrder = edges.renderOrder = 4;
      group.add(fill, edges); scene.add(group);
      this.cubes.push({group, since: -9, yaw: 0, at: new THREE.Vector3(), active: false, spin: 0});
    }
    for (let i = 0; i < FLASHES; i++) this.flashes.push({since: 0, seed: 0, active: false, position: new THREE.Vector3(), actorId: '', targetId: ''});
    this.heart('');
  }
  private heart(owner: string) {
    let held = this.hearts.find(h => h.owner === owner) ?? this.hearts.find(h => h.since < this.time - 1);
    if (!held) {
      const cube = new THREE.Mesh(this.heartGeometry, this.heartMaterial); cube.name = 'law-mes-heart'; cube.visible = false; cube.frustumCulled = false; cube.renderOrder = 4;
      this.scene.add(cube); held = {cube, owner, since: -9, from: new THREE.Vector3(), to: new THREE.Vector3()}; this.hearts.push(held);
    }
    held.owner = owner;
    return held;
  }

  private open(actorId: string, since: number, seconds: number, radius: number, pulse: boolean, ultimate = false, anchor?: THREE.Vector3, ward = 0) {
    const room = this.rooms.find(r => !r.active) ?? this.rooms.reduce((a, b) => a.since <= b.since ? a : b);
    room.actorId = actorId; room.since = since; room.until = since + seconds; room.radius = radius; room.active = true; room.pulse = pulse; room.ultimate = ultimate;
    room.anchored = !!anchor; if (anchor) room.anchor.copy(anchor);
    room.opens = ultimate ? SHAMBLES.open : OPEN; room.closeAt = NaN; room.toward = ''; room.ward = ward;
    room.mesh.visible = true;
  }

  handle(events: readonly CombatEvent[], fighters: ReadonlyMap<string, Fighter>) {
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value!);
      if (event.fighter !== 'law') continue;
      if (event.kind === 'cast' && (event.slot === 'special' || event.slot === 'ultimate') && !event.branch) {
        const move = MOVES.law[event.slot];
        const actor = fighters.get(event.actorId);
        const ultimate = event.slot === 'ultimate', awakened = !!actor?.state.awakened, pulse = awakened && !ultimate;
        const anchor = !ultimate ? undefined : actor ? this.c.copy(actor.group.position).setY(actor.group.position.y + .95)
          : this.c.set(event.origin?.x ?? 0, event.origin?.y ?? .95, event.origin?.z ?? 0);
        this.open(event.actorId, event.serverTime, pulse ? OPEN + FADE : move.duration, ROOM_RADIUS[event.slot], pulse, ultimate, anchor, ultimate && !awakened ? SHAMBLES.ward : 0);
      }
      if (event.kind === 'awaken') this.open(event.actorId, event.serverTime, OPEN + FADE + .3, ROOM_RADIUS.awaken, true);
      if (event.kind === 'hit' && event.slot === 'ultimate') {
        const flash = this.flashes.find(f => !f.active) ?? this.flashes.reduce((a, b) => a.since <= b.since ? a : b);
        const victim = event.targetId ? fighters.get(event.targetId) : undefined;
        if (victim) { flash.position.copy(victim.group.position); flash.position.y += 1.1; }
        else if (event.endpoint) flash.position.set(event.endpoint.x, event.endpoint.y, event.endpoint.z);
        else if (event.origin) flash.position.set(event.origin.x, event.origin.y, event.origin.z);
        else continue;
        flash.since = event.serverTime; flash.seed = event.seed ?? event.id; flash.active = true; flash.actorId = event.actorId; flash.targetId = event.targetId ?? '';
      }
    }
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, density: number) {
    this.time = time;
    const kit = this.kit; kit.begin(time, density);
    for(const [id,knife]of this.knives){
      knife.mesh.visible=false;
      if(!fighters.has(id)){knife.mesh.removeFromParent();knife.material.dispose();this.knives.delete(id);}
    }
    this.hideNow.clear();
    for(const [id,actor]of fighters){
      if(actor.state.fighter!=='law'||!actor.state.alive)continue;
      const elapsed=actor.state.actionTime*actor.state.actionDuration;
      if(actor.state.action==='ultimate'&&!actor.state.branch)this.shambles(id,actor,elapsed,time);
      if(actor.state.action==='light'){
        const contact=MOVES.law.light.contacts[0],key=Math.round(actor.state.actionStarted*1000);
        if(elapsed>=contact&&elapsed<contact+.1&&this.lastCut.get(id)!==key){
          this.lastCut.set(id,key);const cut=this.cuts.find(c=>!c.active)??this.cuts.reduce((a,b)=>a.since<=b.since?a:b);
          cut.active=true;cut.since=time;cut.mesh.visible=true;applySlashStyle(cut.mesh.material,KIKOKU,key,1.2,.16);
          const yaw=actor.state.yaw;cut.mesh.position.copy(actor.group.position).add(this.a.set(Math.sin(yaw)*1.25,1.1,Math.cos(yaw)*1.25));cut.mesh.rotation.set(0,yaw,.5);cut.mesh.scale.setScalar(2.6);
        }
      }
      if(actor.state.action==='ultimate'){
        const contact=MOVES.law.ultimate.contacts[0],charge=THREE.MathUtils.smoothstep(elapsed,contact-.75,contact-.05)*(1-THREE.MathUtils.smoothstep(elapsed,contact+.05,contact+.3));
        if(charge>.02){kit.ball(actor.handL,charge,7,NaN,SHOCK_COLOR.glow,SHOCK_COLOR.light,.3);kit.ball(actor.handR,charge*.8,9,NaN,SHOCK_COLOR.glow,SHOCK_COLOR.light,.27);}
      }
      if((actor.state.action==='heavy'||actor.state.action==='special')&&actor.state.branch)this.ender(id,actor,actor.state.branch,elapsed,time,fighters);
      if(actor.state.action!=='special'||actor.state.branch)continue;
      const gamma=MOVES.law.special,cut=gamma.contacts[0],after=gamma.duration-cut;
      const strength=THREE.MathUtils.smoothstep(elapsed,.1,.35)*(1-THREE.MathUtils.smoothstep(elapsed,cut+.32*after,cut+.77*after));
      if(strength<=0)continue;
      let knife=this.knives.get(id);
      if(!knife){
        const material=new THREE.MeshBasicMaterial({color:new THREE.Color(1.8,1.6,.55),toneMapped:false,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
        const mesh=new THREE.Group();mesh.name='law-gamma-knife';
        const blade=new THREE.Mesh(this.knifeGeometry,material);blade.position.y=.37;blade.scale.z=.28;mesh.add(blade);
        const heel=new THREE.Mesh(this.knifeGeometry,material);heel.rotation.z=Math.PI;heel.position.y=-.15;heel.scale.set(.5,.35,.14);mesh.add(heel);
        this.scene.add(mesh);knife={mesh,material,reach:KNIFE_HELD,at:time};this.knives.set(id,knife);
      }
      knife.mesh.visible=true;knife.mesh.position.copy(actor.handL);knife.material.opacity=strength;
      const wrist=actor.joints.get('LeftHand'),forearm=actor.joints.get('LeftForeArm');
      this.direction.set(Math.sin(actor.state.yaw),0,Math.cos(actor.state.yaw));
      if(wrist&&forearm){
        this.direction.copy(actor.handL).sub(forearm.getWorldPosition(this.origin)).normalize();
        this.knifeQuaternion.setFromUnitVectors(this.up,this.direction);
        knife.mesh.quaternion.copy(this.knifeQuaternion);
      }
      const landedOn=elapsed>=cut-.03?struckBody(actor,fighters):undefined,step=Math.max(0,time-knife.at);knife.at=time;
      knife.reach=landedOn?Math.min(1,knife.reach+step/KNIFE_RUN):elapsed<cut?KNIFE_HELD:knife.reach;
      const size=.85+.15*strength;knife.mesh.scale.set(size,size*knife.reach,size);
      const flicker=.85+.15*Math.sin(time*37+id.length);
      this.tip.copy(actor.handL).addScaledVector(this.direction,.72*knife.mesh.scale.y);
      this.a.copy(actor.handL).addScaledVector(this.direction,-.08);
      kit.bolts.segment(this.a,this.tip,.06*strength,GAMMA.glow,strength*flicker,.3);
      kit.halos.add(this.b.copy(this.a).lerp(this.tip,.45),.55*strength,GAMMA.glow,.35*strength*flicker,GLOW,.05);
      kit.lights.add(this.b,2.2,GAMMA.light,.6*strength*flicker);
    }
    for (const room of this.rooms) {
      if (!room.active) continue;
      const age = time - room.since;
      const actor = fighters.get(room.actorId);
      if (room.ultimate && actor && !room.pulse && age > .1) {
        const s = actor.state;
        if (s.action !== 'ultimate') room.until = Math.min(room.until, time + FADE);
        else if (s.whiffedAt !== undefined) room.until = Math.min(room.until, Math.max(time, s.whiffedAt + WHIFF_CLEAR) + FADE * .5);
      }
      if (age < -.1 || age > room.until - room.since || !actor || !actor.state.alive) { room.active = false; room.mesh.visible = false; continue; }
      const opening = THREE.MathUtils.smoothstep(age, 0, room.opens);
      const remaining = room.until - time;
      let closing = 1 - THREE.MathUtils.smoothstep(FADE - remaining, 0, FADE);
      this.hand.copy(actor.handL);
      if (room.anchored) this.origin.copy(room.anchor); else { this.origin.copy(actor.group.position); this.origin.y += .95; }
      let full = room.radius;
      if (Number.isFinite(room.closeAt)) {
        const u = THREE.MathUtils.smoothstep(time - room.closeAt, 0, SHAMBLES.close), other = room.toward ? fighters.get(room.toward) : undefined;
        this.d.copy(actor.group.position); if (other?.state.alive) this.d.add(other.group.position).multiplyScalar(.5);
        this.d.y += .95;
        if (room.ward > 0) { this.origin.lerp(this.d, u); full = room.radius + (room.ward - room.radius) * u; }
        else if (u >= 1) { room.active = false; room.mesh.visible = false; continue; } else closing *= 1 - u;
      }
      room.mesh.position.copy(this.hand).lerp(this.origin, opening);
      const breath = room.anchored ? .02 : .08;
      const radius = Math.max(.05, full * (opening * (1 - breath) + breath * Math.sin(time * 2.1 + room.since) * opening));
      room.mesh.scale.setScalar(radius);
      room.material.uniforms.uTime.value = time;
      room.material.uniforms.uBand.value = room.anchored ? 1 : 0;
      room.material.uniforms.uFloor.value = room.anchored ? (actor.group.position.y - room.mesh.position.y) / radius : -2;
      room.material.uniforms.uOpacity.value = (room.pulse ? .3 : .42) * closing * (0.6 + .4 * Math.min(1, density));
    }
    for (const flash of this.flashes) {
      if (!flash.active) continue;
      const age = time - flash.since;
      if (age < -.05 || age > SHOCK) { flash.active = false; continue; }
      const life = Math.max(0, age) / SHOCK, strength = (1 - life) * (1 - life);
      const victim = flash.targetId ? fighters.get(flash.targetId) : undefined;
      if (victim) { flash.position.copy(victim.group.position); flash.position.y += 1.1; }
      kit.flash(flash.position, Math.min(1.3, strength * 1.4), flash.seed % 97, 1.5 + life * 1.2, SHOCK_COLOR.glow);
      kit.glows.add(flash.position, 2.4 * (1 - life * .5), SHOCK_COLOR.glow, strength, STAR, .12, flash.seed % 89);
      const law = fighters.get(flash.actorId);
      if (law && strength > .1) { kit.arc(law.handL, flash.position, kit.tick * 3 + 1, .05 * strength, SHOCK_COLOR.glow, strength, 2, 3, .25); kit.arc(law.handR, flash.position, kit.tick * 3 + 2, .035 * strength, SHOCK_COLOR.glow, strength, 1, 3, .25); }
      const crawl = Math.max(3, Math.round(7 * kit.density));
      for (let i = 0; i < crawl; i++) {
        const r = kit.painter.rng.seed(kit.tick * 17 + i * 101 + flash.seed);
        this.a.set(r.signed() * .35, r.signed() * .8, r.signed() * .35).add(flash.position);
        this.b.set(r.signed() * .4, r.signed() * .9, r.signed() * .4).add(flash.position);
        kit.arc(this.a, this.b, kit.tick * 29 + i + flash.seed, .026 * strength + .006, SHOCK_COLOR.glow, strength, 1, 3, .35);
      }
      if (kit.ticked) kit.painter.emit(flash.position, Math.round(4 * kit.density), 4.5 * strength + 1, kit.tick + flash.seed, .012, .5);
    }
    for (const heart of this.hearts) {
      const age = time - heart.since, law = fighters.get(heart.owner);
      heart.cube.visible = age >= 0 && age < .8 && !!law;
      if (!heart.cube.visible) continue;
      heart.to.copy(law!.handL);
      const go = THREE.MathUtils.smoothstep(age, .08, .5);
      heart.cube.position.copy(heart.from).lerp(heart.to, go); heart.cube.position.y += Math.sin(go * Math.PI) * .45;
      heart.cube.rotation.set(age * 3.1, age * 4.3, 0); heart.cube.scale.setScalar(.6 + .4 * Math.min(1, age / .08));
      this.heartMaterial.opacity = .55 * (1 - THREE.MathUtils.smoothstep(age, .6, .8));
      kit.glows.add(heart.cube.position, .13, HEART, 1 - THREE.MathUtils.smoothstep(age, .6, .8), GLOW, .4);
      if (age < .12) kit.glows.add(heart.from, .5, SHOCK_COLOR.glow, 1 - age / .12, STAR, .2, 5);
    }
    for (const cut of this.cuts) {
      if (!cut.active) continue;
      const age = time - cut.since;
      if (age > CUT_SECONDS) { cut.active = false; cut.mesh.visible = false; continue; }
      cut.mesh.material.uniforms.uFade.value = 1 - THREE.MathUtils.smoothstep(age, .05, CUT_SECONDS); cut.mesh.material.uniforms.uClock.value = time;
    }
    let lit = 0;
    for (const cube of this.cubes) {
      if (!cube.active) continue;
      const age = time - cube.since, at = cubeAt(age);
      if (!at) { cube.active = false; cube.group.visible = false; continue; }
      cube.group.visible = true;
      cube.group.position.set(cube.at.x, cube.at.y + at.height, cube.at.z);
      const tumble = Math.max(0, 1 - age / SHAMBLES.fall);
      cube.group.rotation.set(cube.spin * tumble * 1.3, cube.yaw + cube.spin * tumble * 2.2, cube.spin * tumble * .9);
      cube.group.scale.setScalar(SHAMBLES.cube * at.scale);
      lit = Math.max(lit, at.opacity);
      if (age < .5) kit.halos.add(cube.group.position, .55 * at.scale, ROOM_FILL, .5 * at.opacity * (1 - age / .5), GLOW, .05);
    }
    this.cubeLine.opacity = lit; this.cubeFill.opacity = .22 * lit;
    for (const p of this.pops) {
      const age = time - p.since;
      if (age < 0 || age > POP) continue;
      const u = age / POP, fade = (1 - u) * (1 - u);
      kit.glows.add(p.at, .35 + .55 * u, ROOM_LIGHT, fade * .8, RING, .06, p.seed % 89, .45 + .45 * u);
      kit.glows.add(p.at, .4 * (1 - .5 * u), ROOM_LIGHT, fade, STAR, .22, p.seed % 97);
      if (age < .12) kit.lights.add(p.at, 3, SHOCK_COLOR.light, .7 * (1 - age / .12));
    }
    for (const [id, body] of this.hidden) if (!this.hideNow.has(id) || fighters.get(id) !== body) { body.group.visible = true; this.hidden.delete(id); }
    kit.end();
  }

  private shambles(id: string, actor: Fighter, elapsed: number, time: number) {
    const s = actor.state, key = Math.round(s.actionStarted * 1000);
    let swap = this.swaps.get(id);
    if (!swap) { swap = {key: NaN, from: new THREE.Vector3(), yaw: 0, swapped: false, done: false}; this.swaps.set(id, swap); }
    if (swap.key !== key) { swap.key = key; swap.from.copy(actor.group.position); swap.yaw = s.yaw; swap.swapped = swap.done = false; }
    const at = SHAMBLES.at;
    if (elapsed < at - 1 / 120) { swap.from.copy(actor.group.position); swap.yaw = s.yaw; }
    else if (!swap.done) {
      if (elapsed > at + .3) swap.done = true;
      else if (actor.group.position.distanceTo(swap.from) > SHAMBLES.jump) {
        swap.done = swap.swapped = true;
        const cube = this.cubes.find(c => !c.active) ?? this.cubes.reduce((a, b) => a.since <= b.since ? a : b);
        cube.active = true; cube.since = time; cube.at.copy(swap.from); cube.yaw = swap.yaw; cube.spin = (key % 2 ? 1 : -1) * (.8 + (key % 7) / 14);
        this.pop(this.a.copy(swap.from).setY(swap.from.y + 1.05), key);
        for (const room of this.rooms) if (room.active && room.ultimate && room.actorId === id) { room.closeAt = time; room.toward = s.target ?? ''; }
      }
    }
    if (swap.swapped && elapsed < at + SHAMBLES.hold) {
      this.hideNow.add(id);
      if (!this.hidden.has(id)) { actor.group.visible = false; this.hidden.set(id, actor); }
    }
    const sign = THREE.MathUtils.smoothstep(elapsed, at - .22, at - .04) * (1 - THREE.MathUtils.smoothstep(elapsed, at, at + .06));
    if (sign > .02) this.kit.halos.add(actor.handL, .32 * sign, ROOM_LIGHT, .8 * sign, GLOW, .12);
  }

  private pop(at: THREE.Vector3, seed: number) {
    const slot = this.pops.reduce((a, b) => a.since <= b.since ? a : b);
    slot.at.copy(at); slot.since = this.time; slot.seed = seed;
  }

  private ender(id: string, actor: Fighter, branch: ComboKey, elapsed: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const s = actor.state, move = enderMove(branch, !!s.awakened);
    if (!move) return;
    const contact = move.contacts[0], key = Math.round(s.actionStarted * 1000) * 8 + 1;
    if (elapsed < contact || elapsed > contact + .1 || this.lastCut.get(id) === key || branch === 'airSpecial' && !s.grounded) return;
    this.lastCut.set(id, key);
    if (move.style === 'field' && (branch === 'airSpecial' || move.range < .5)) { this.open(id, time, OPEN + FADE + .15, Math.max(1.6, move.radius), true); return; }
    if (move.style !== 'melee') return;
    const struck = branch === 'llls' ? struckBody(actor, fighters) : undefined;
    if (struck) { const heart = this.heart(id); heart.since = time; bodyCenterOf(struck, heart.from); heart.from.y += .25; heart.to.copy(actor.handL); }
    const cut = this.cuts.find(c => !c.active) ?? this.cuts.reduce((a, b) => a.since <= b.since ? a : b);
    cut.active = true; cut.since = time; cut.mesh.visible = true; applySlashStyle(cut.mesh.material, KIKOKU, key, 1.3, .2);
    const yaw = s.yaw, roll = branch === 'llh' ? -1.25 : branch === 'lllh' || branch === 'airHeavy' ? 1.35 : branch === 'llls' ? -.2 : .5;
    cut.mesh.position.copy(actor.group.position).add(this.a.set(Math.sin(yaw) * 1.35, branch === 'airHeavy' ? .7 : 1.1, Math.cos(yaw) * 1.35)); cut.mesh.rotation.set(0, yaw, roll); cut.mesh.scale.setScalar(3.1);
  }

  reset() {
    this.seen.clear();
    for (const room of this.rooms) { room.active = false; room.mesh.visible = false; room.closeAt = NaN; }
    for (const cube of this.cubes) { cube.active = false; cube.group.visible = false; }
    for (const p of this.pops) p.since = -9;
    for (const body of this.hidden.values()) body.group.visible = true;
    this.hidden.clear(); this.swaps.clear();
    for (const flash of this.flashes) flash.active = false;
    for (const cut of this.cuts) { cut.active = false; cut.mesh.visible = false; } this.lastCut.clear();
    this.kit.reset();
    for(const knife of this.knives.values())knife.mesh.visible=false;
  }

  dispose() {
    this.reset();
    for (const heart of this.hearts) heart.cube.removeFromParent(); this.hearts = []; this.heartGeometry.dispose(); this.heartMaterial.dispose();
    for (const cube of this.cubes) cube.group.removeFromParent(); this.cubes = []; this.cubeGeometry.dispose(); this.cubeEdges.dispose(); this.cubeFill.dispose(); this.cubeLine.dispose();
    for (const room of this.rooms) { room.mesh.removeFromParent(); room.material.dispose(); }
    this.kit.dispose();
    for (const cut of this.cuts) { cut.mesh.removeFromParent(); cut.mesh.material.dispose(); } this.cutGeometry.dispose();
    for(const knife of this.knives.values()){knife.mesh.removeFromParent();knife.material.dispose();}this.knives.clear();this.knifeGeometry.dispose();
    this.sphere.dispose();
  }
}
