import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { FIGHTERS } from '../../config';
import type { AttackSlot, FighterId, PlayerState } from '../../game/types';
import { MOVES } from '../../game/moves';
import type { StageId } from '../../game/stages';
import type { Worn } from '../../game/economy/catalog';
import { outfitFor } from '../../game/economy/outfits';
import { Fighter, bindClips } from '../Fighter';
import { IDLE_PROFILES } from '../idle/profile';
import { LookBloomPass, LookFinalPass } from '../look/LookPost';
import { lookFor } from '../look/stageLooks';
import { Cosmetics } from './Cosmetics';
import { setSkinResolution } from './skins';
import { auraShared } from './auras';

const state = (fighter: FighterId): PlayerState => ({ id: 'stage', name: 'Stage', fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 0,
  action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } });

const _eye = new THREE.Vector3();

export interface StageOptions {
  look?: StageId;
  paper?: number;
  fps?: number;
}

export class FighterStage {
  readonly canvas: HTMLCanvasElement;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, .1, 60);
  readonly cosmetics = new Cosmetics(this.scene);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly loader = new GLTFLoader();
  private readonly sources = new Map<string, Promise<GLTF>>();
  private fighter?: Fighter;
  private shown?: string;
  private ticket = 0;
  private frame = 0;
  private last = 0;
  private time = 0;
  private readonly body: PlayerState = state('naruto');
  private height = 1.75;
  zoom = 1; level = .53;
  lift = 0;
  span = { across: 1.4, tall: 1.15 };
  aim() {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distance = Math.max(this.height * this.span.tall / 2 / tan, this.span.across / 2 / (tan * this.camera.aspect)) / this.zoom;
    this.camera.position.set(0, this.height * (this.level + .03) + distance * this.lift, distance); this.camera.lookAt(0, this.height * this.level, 0);
  }
  dash = false;
  dashReach = 3.6;
  show_ = { kills: false, awake: false, awakeCycle: false, cycle: false, count: 0, style: 0 };
  moves: PlayerState['action'][] = [];
  private moveAt = 0; private moveN = 0;
  private nextKill = 0;
  private killN = 0;
  spin = .35;
  yaw = .5;

  constructor(private host: HTMLElement, private readonly options: StageOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.canvas = this.renderer.domElement;
    host.append(this.canvas);
    const look = lookFor(options.look ?? 'harbor');
    this.scene.background = new THREE.Color(options.paper ?? 0xffffff).multiplyScalar(1 / Math.max(.2, look.exposure));
    this.scene.add(new THREE.HemisphereLight(look.hemi.sky, look.hemi.ground, look.hemi.intensity));
    const key = new THREE.DirectionalLight(look.key.color, look.key.intensity); key.position.set(-.45, .8, .55).multiplyScalar(10); this.scene.add(key);
    const fill = new THREE.DirectionalLight(look.fill.color, look.fill.intensity); fill.position.set(.7, .3, .4).multiplyScalar(10); this.scene.add(fill);
    const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new LookBloomPass(), final = new LookFinalPass();
    Object.assign(bloom.bloom, { threshold: look.bloom.threshold, knee: look.bloom.knee, radius: look.bloom.radius, strength: look.bloom.strength });
    final.bloom = bloom; final.setGrade(look); final.uniforms.uVignette.value = 0;
    this.composer.addPass(bloom); this.composer.addPass(final);
    this.resize();
    this.watcher = new ResizeObserver(() => this.resize());
    this.watcher.observe(host);
  }
  private readonly watcher: ResizeObserver;

  resize() {
    const w = Math.max(2, this.host.clientWidth), h = Math.max(2, this.host.clientHeight);
    this.renderer.setSize(w, h, false); this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.pixels = h * this.renderer.getPixelRatio();
    this.aim();
  }
  private pixels = 1;
  moveTo(host: HTMLElement) {
    if (host === this.host && this.canvas.parentElement === host) return;
    this.watcher.unobserve(this.host);
    this.host = host; host.append(this.canvas);
    this.watcher.observe(host); this.resize();
  }

  private source(id: FighterId, model?: string) {
    const url = model ?? FIGHTERS[id].model;
    let source = this.sources.get(url);
    if (!source) {
      source = (async () => {
        const gltf = await this.loader.loadAsync(url), idle = model ? undefined : IDLE_PROFILES[id]?.model;
        if (idle) try { const clips = bindClips(gltf.scene, (await this.loader.loadAsync(idle)).animations, FIGHTERS[id].name), names = new Set(clips.map(clip => clip.name)); gltf.animations = [...gltf.animations.filter(clip => !names.has(clip.name)), ...clips]; } catch { }
        return gltf;
      })();
      this.sources.set(url, source);
      for (const old of [...this.sources.keys()].slice(0, -3)) this.sources.delete(old);
    }
    return source;
  }

  async show(id: FighterId, worn: Worn) {
    const ticket = ++this.ticket;
    const outfitId = worn.outfits?.[id], outfit = outfitFor(outfitId, id), key = `${id}:${outfit ? outfitId : ''}`;
    if (this.shown !== key) {
      const gltf = await this.source(id, outfit?.model);
      if (ticket !== this.ticket) return;
      this.fighter?.group.removeFromParent(); this.fighter?.dispose();
      Object.assign(this.body, state(id));
      this.fighter = new Fighter(this.body, gltf, false, undefined, outfit ? outfitId : undefined);
      this.fighter.targetPoint = new THREE.Vector3(0, 1.3, 6); this.fighter.targetDistance = 6;
      this.scene.add(this.fighter.group);
      this.shown = key;
      this.height = (outfit?.model ? outfit.height : undefined) ?? FIGHTERS[id].height ?? 1.75;
      this.aim();
    }
    this.cosmetics.wear('stage', worn, this.height, new THREE.Color(FIGHTERS[id].color).getHex());
    this.start();
  }

  start() {
    if (this.frame) return;
    this.last = performance.now();
    const step = (now: number) => {
      this.frame = requestAnimationFrame(step);
      const dt = Math.min(.05, (now - this.last) / 1000);
      if (dt < 1 / (this.options.fps ?? 60) - .002) return;
      this.last = now; this.draw(dt);
    };
    this.frame = requestAnimationFrame(step);
  }
  stop() { cancelAnimationFrame(this.frame); this.frame = 0; }

  draw(dt: number) {
    if (!this.fighter) return;
    this.time += dt; this.yaw += this.spin * dt;
    this.body.yaw = this.yaw;
    if (this.dash) { const beat = this.time % 1.6, across = beat < .22 ? beat / .22 : beat < .8 ? 1 : beat < 1.02 ? 1 - (beat - .8) / .22 : 0; this.body.x = (across * across * (3 - 2 * across) - .5) * this.dashReach; }
    if (this.moves.length) {
      if (this.time >= this.moveAt) {
        const slot = this.moves[this.moveN++ % this.moves.length], length = MOVES[this.body.fighter]?.[slot as AttackSlot]?.duration ?? 1.4;
        this.moveAt = this.time + length + .8; this.body.action = slot; this.body.actionStarted = this.time; this.body.actionDuration = length;
      }
      const into = (this.time - this.body.actionStarted) / this.body.actionDuration;
      if (into >= 1 && this.body.action !== 'idle') this.body.action = 'idle';
      this.body.actionTime = Math.min(1, Math.max(0, into));
    }
    this.fighter.update(dt, this.body, true, dt);
    this.scene.updateMatrixWorld();
    this.camera.getWorldDirection(_eye); this.cosmetics.eye = Math.atan2(_eye.x, _eye.z);
    this.demo();
    setSkinResolution(this.pixels * 1.6); auraShared.uAuraHeight.value = this.pixels;
    this.cosmetics.update(this.time, dt);
    this.composer.render(dt);
  }

  private demo() {
    const d = this.show_, t = this.time;
    const stage = Math.floor(t / 3) % 4, kills = d.cycle ? [0, 100, 500, 2000][stage] : d.count;
    const style = d.cycle ? Math.round(3 - 3 * Math.cos(t / 9 * Math.PI * 2)) : d.style;
    this.cosmetics.react('stage', { kills, style, awake: d.awake || (d.awakeCycle && t % 7 > 3) });
    if (!d.kills || t < this.nextKill) return;
    this.nextKill = t + .75;
    const a = (this.killN * 2.4 + .6) % (Math.PI * 1.4) - Math.PI * .7, r = 1.3 + (this.killN % 3) * .5;
    this.cosmetics.killed('stage', Math.sin(a) * r, 0, Math.cos(a) * r * .6 + .4, ++this.killN % 3 === 0);
  }

  dispose() {
    this.stop(); this.ticket++;
    this.watcher.disconnect();
    this.cosmetics.clear();
    this.fighter?.dispose();
    this.composer.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
